/**
 * deployAutopsyReply.js — Autopsy Reply Handler + Completion Flow
 *
 * Handles autopsy reports: searches Case Management (f=266) by decedent name,
 * replies with the autopsy BBCode, then runs the completion workflow (PHMC reply,
 * LSSD reply, DM to requester). Also retries failed completion steps on startup.
 *
 * Dry-run by default for safety — set AUTOPSY_DRY_RUN=false in .env to enable live posting.
 */

import { getForumClient, createIsolatedClient } from './forumClient.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { logFnCall, sendWebhook, logStep, DeployProgressEmbed } from './deployLogger.js';
import { notifySelfHeal, sendLogMessage } from './logChannel.js';
import { state } from './deployState.js';
import { isMaintenanceMode } from './deployQueue.js';
import { setDeployStatus, markReportComplete } from './deployStatus.js';
import { crosspostAutopsyToLssd, searchLssdRequestTopic } from './deployLssd.js';
import { crosspostAutopsyToLspd } from './deployLspd.js';
import { getAgencyForum, isAgencyFaction } from './agencyForums.js';
import { notifyRequesterOfCompletion } from './requesterWebhook.js';
import { clearAssignment } from './autopsyRotation.js';

import { COMPLETION_TEMPLATE, buildCompletionBb } from './completionTemplate.js';

// ── Constants ──
export const CASE_MGMT_FORUM_ID = 266;
export const AUTOPSY_DRY_RUN = process.env.AUTOPSY_DRY_RUN !== 'false'; // default dry-run
export const AUTOPSY_REQUEST_FORUM_ID = 265;

// Per-pick expiry timers, keyed by pickId — cleared when the pick resolves
// so a resolved pick never fires a stale re-queue.
const pickExpiryTimers = new Map();

// Re-export for backwards compatibility (moved to services/completionTemplate.js)
export { COMPLETION_TEMPLATE };

/**
 * Extract a reply post id (p=) from a posted-content URL.
 * @param {string} url
 * @returns {string|null}
 */
export function extractReplyPostId(url) {
    return (String(url || '').match(/[?&]p=(\d+)/) || [])[1] || null;
}

// ── Mass-collection (shared-thread) completion helpers ──
//
// Mass Autopsy Rework model: one shared f=266 thread holds one reply PER BODY
// (each ME's report), tracked under cases/<idx>/{replyPostId,replyUrl,
// completedAt,completedBbCode}. The collection-level steps (f=265 PHMC reply,
// agency combined reply, LSPD crosspost, requester DM, CASELINK webhook) fire
// ONCE per collection with ONE batched payload when every body is done —
// partials never emit premature singles.
//
// Per-topic multi records (each case owns its own f=266 topic via
// cases/<idx>/caseTopicId) keep the legacy per-case behaviour below.

/** phpBB post-size fallback threshold for batched mass payloads. */
export const MASS_BATCH_BODY_CAP = 55000;

/**
 * True when the record is a shared-thread mass collection: 2+ per-case
 * records under cases/<idx> with NO distinct per-case f=266 topics (every ME
 * reports into the one collection-level thread).
 * Per-topic multis (distinct cases/<idx>/caseTopicId values) return false.
 * @param {object} entry — autopsy-requested record
 */
export function isSharedThreadCollection(entry) {
    if (!entry || typeof entry !== 'object') return false;
    const cases = entry.cases;
    if (!cases || typeof cases !== 'object') return false;
    const idxs = Object.keys(cases).filter((k) => /^\d+$/.test(k));
    if (idxs.length < 2) return false;
    const topics = new Set(idxs.map((i) => String(cases[i]?.caseTopicId || '').trim()).filter(Boolean));
    if (topics.size === 0) return true;
    const top = String(entry.caseTopicId || entry.topicId || '').trim();
    return !!top && topics.size === 1 && topics.has(top);
}

/**
 * Match a report to one cases/<idx> member, OOC-exact-first, never a generic
 * "John Doe" name match. Mirrors the 553-607 lookup semantics (same pass
 * order, same prefer-uncompleted-then-highest-caseNum tie-break) but also
 * matches shared-thread members that carry no individual caseTopicId.
 * @param {object} allReq — autopsy-requested node value
 * @param {string} ooc — report decedentOOC
 * @param {string} name — report decedentName
 * @returns {{rkey: string, ci: number, caseRec: object, entry: object}|null}
 */
export function matchCollectionCase(allReq, ooc, name) {
    if (!allReq || typeof allReq !== 'object') return null;
    const oocL = String(ooc || '').trim().toLowerCase();
    const nameL = String(name || '').trim().toLowerCase();
    const nameUsable = !!nameL && !/^john\s*doe$/i.test(String(name || '').trim());
    const pickBest = (cur, cand) => {
        if (!cur) return cand;
        if (!!cur.caseRec.completedAt && !cand.caseRec.completedAt) return cand;
        if (!!cur.caseRec.completedAt === !!cand.caseRec.completedAt) {
            const cNum = parseInt(cand.caseRec.caseNum, 10) || 0;
            const bNum = parseInt(cur.caseRec.caseNum, 10) || 0;
            if (cNum > bNum) return cand;
        }
        return cur;
    };
    let best = null;
    if (oocL) {
        for (const [rkey, entry] of Object.entries(allReq)) {
            if (!entry || !entry.cases || typeof entry.cases !== 'object') continue;
            for (const [ci, c] of Object.entries(entry.cases)) {
                if (!c || !/^\d+$/.test(ci)) continue;
                if (String(c.oocName || '').trim().toLowerCase() !== oocL) continue;
                best = pickBest(best, { rkey, ci: parseInt(ci, 10), caseRec: c, entry });
            }
        }
    }
    if (!best && nameUsable) {
        for (const [rkey, entry] of Object.entries(allReq)) {
            if (!entry || !entry.cases || typeof entry.cases !== 'object') continue;
            for (const [ci, c] of Object.entries(entry.cases)) {
                if (!c || !/^\d+$/.test(ci)) continue;
                if (String(c.name || '').trim().toLowerCase() !== nameL) continue;
                best = pickBest(best, { rkey, ci: parseInt(ci, 10), caseRec: c, entry });
            }
        }
    }
    return best;
}

export function buildBatchedBodiesPayload(casesObj) {
    const idxs = Object.keys(casesObj || {}).filter((k) => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
    const N = idxs.length;
    const parts = idxs.map((i, pos) => {
        const c = casesObj[i] || {};
        const who = [String(c.name || '').trim(), c.oocName ? `(( ${String(c.oocName).trim()} ))` : ''].filter(Boolean).join(' ').trim();
        const head = `--- BODY ${pos + 1}/${N}${who ? `: ${who}` : ''} ---`;
        return `${head}\n${c.completedBbCode || '(report pending)'}`;
    });
    return { text: parts.join('\n\n'), count: N };
}

/**
 * True when a collection has every body completed (or when the record is not
 * a multi-case collection at all). Retry gating keys off this so partials
 * never emit premature singles.
 * @param {object} entry — autopsy-requested record
 */
export function collectionCasesDone(entry) {
    const cases = entry?.cases;
    if (!cases || typeof cases !== 'object') return true;
    const idxs = Object.keys(cases).filter((k) => /^\d+$/.test(k));
    if (idxs.length === 0) return true;
    return idxs.every((i) => !!(cases[i] || {}).completedAt);
}

/**
 * Split an over-cap batched payload via the mass-post chunker when that
 * worker's module is present. Optional import — resolves to a single-element
 * array when massPostChunker.js is absent (this checkout) or unusable.
 * @param {string} text — batched payload
 * @returns {Promise<string[]>}
 */
export async function chunkMassPayloadIfNeeded(text) {
    const body = String(text || '');
    if (!body || body.length <= MASS_BATCH_BODY_CAP) return [body];
    try {
        const mod = await import('./massPostChunker.js');
        const fn = mod?.chunkBbCode || mod?.chunkMassPost || mod?.default;
        if (typeof fn === 'function') {
            const out = await fn(body);
            if (Array.isArray(out) && out.length && out.every((p) => typeof p === 'string')) return out;
        }
    } catch { /* massPostChunker.js not present — fall through to whole post */ }
    return [body];
}

/**
 * Post a forum reply, or EDIT the existing reply when this exact post was
 * already made in a prior run (re-queue / retry / restart after a successful
 * post). Prevents duplicate forum replies — the reply post id is captured
 * from the reply URL at post time and persisted by the caller for future runs.
 *
 * Edit failures do NOT fall back to a new post (that would duplicate); they
 * surface as failure for retry, which attempts the edit again.
 *
 * @param {object} client — forum client (default or isolated)
 * @param {object} opts
 * @param {string|number} opts.topicId
 * @param {string|number} opts.forumId
 * @param {string} opts.bbCode
 * @param {string} [opts.baseUrl]
 * @param {string} [opts.title] — subject for edits
 * @param {string} [opts.existingPostId] — reply post id from a prior run
 * @param {Array<string>|object} [opts.existingPostIds] — per-body reply post ids
 *   for a shared-thread mass collection (array or {index: postId} map). When
 *   opts.bodyIndex selects an entry, that id wins over opts.existingPostId.
 * @param {number} [opts.bodyIndex] — body index into opts.existingPostIds
 * @param {boolean} [opts.dryRun=false]
 * @param {string} [opts.logTag='REPLY']
 * @returns {Promise<{ok: boolean, url: string|null, postId: string|null, edited: boolean, reason?: string, topicMissing?: boolean}>}
 */
export async function postOrEditReply(client, { topicId, forumId, bbCode, baseUrl, title, existingPostId, existingPostIds = null, bodyIndex = null, dryRun = false, logTag = 'REPLY' }) {
    // Per-body resolution for shared-thread mass collections: each ME's report
    // owns its own reply inside the one shared f=266 thread, so re-runs must
    // edit that body's reply (not post a duplicate, not edit another body's).
    // Single-post callers pass only existingPostId — behaviour unchanged.
    let pid = '';
    if (bodyIndex !== null && bodyIndex !== undefined && existingPostIds) {
        const raw = Array.isArray(existingPostIds) ? existingPostIds[bodyIndex] : existingPostIds[bodyIndex];
        pid = String(raw || '').trim();
    }
    if (!pid) pid = String(existingPostId || '').trim();
    if (pid && /^\d+$/.test(pid) && !dryRun) {
        console.log(`[AUTO] ${logTag} already posted (p=${pid}) — editing in place instead of duplicating`);
        const editRes = await client.editPostContent(topicId, forumId, pid, bbCode, { title, baseUrl });
        if (editRes.ok) {
            return { ok: true, url: editRes.url || null, postId: extractReplyPostId(editRes.url) || pid, edited: true };
        }
        console.warn(`[AUTO] ${logTag} edit of p=${pid} failed (${editRes.reason || 'unknown'}) — not posting duplicate`);
        return { ok: false, url: null, postId: pid, edited: false, reason: editRes.reason || 'Edit failed' };
    }
    const r = await client.replyToTopic(topicId, forumId, bbCode, { dryRun, baseUrl });
    if (!r.ok) return { ...r, postId: null, edited: false };
    return { ...r, postId: extractReplyPostId(r.url), edited: false };
}

/**
 * Post the LSSD combined completion + report reply to the LSSD autopsy forum
 * (f=2263). Runs FIRST for LSSD cases in the completion flow so the posted
 * reply URL can be embedded in the f=265 PHMC completion notice.
 *
 * Uses its own isolated browser client so it never conflicts with the PHMC
 * client's session state. Returns { ok, url } where url is the posted reply URL.
 *
 * @param {object} opts
 * @param {string} opts.key — autopsy-requested entry key
 * @param {object} opts.entry — autopsy-requested entry
 * @param {object} opts.reportData — the submitted report data
 * @param {string} opts.completionBb — rendered completion template (no URL)
 * @param {string} opts.bbCode — full autopsy report BBCode (single-body path)
 * @param {Array<{name?: string, oocName?: string, bbCode?: string}>} [opts.bodies] — array
 *   input for a completed mass collection: one combined reply carries every
 *   body with `--- BODY i/N ---` headers, one completion URL set per collection
 * @param {string} [opts.batchedBbCode] — prebuilt batched bodies block (alternative
 *   to opts.bodies; opts.bodies wins when both are given)
 * @param {object} opts.progress — DeployProgressEmbed instance
 * @param {object} opts.stepFailed — shared step-failure tracker
 * @returns {Promise<{ok: boolean, url: string|null, skipped?: boolean}>}
 */
async function postLssdCombinedReply({ key, entry, reportData, completionBb, bbCode, bodies = null, batchedBbCode = null, progress, stepFailed }) {
    // ── Faction resolution FIRST so status/failure writers key per faction ──
    // The REQUEST record is authoritative for faction — the report's department
    // field is only a hint (MEs sometimes leave it on the wrong agency mid-batch).
    // Registry factions (LSSD/SADCR/DAO) all live on lssd.gta.world and share the
    // FORUM_LSSD_* credentials — see services/agencyForums.js. LSPD keeps its own
    // separate crosspost step below.
    const rawDept = reportData.data?.department || '';
    const deptStr = (typeof rawDept === 'object' ? (rawDept.label || rawDept.value || '') : String(rawDept)).toLowerCase();
    const oocName = reportData.data?.decedentOOC || entry.oocName || '';
    const decedentName = reportData.data?.decedentName || entry.name || '';
    const entryFaction = (entry.faction || '').toLowerCase();
    const titleTag = (/\[(lssd|lspd|sadcr|dao)\]/i.exec(entry.title || '') || [])[1]?.toLowerCase() || '';

    let effFaction = isAgencyFaction(entryFaction) ? entryFaction.toUpperCase()
        : isAgencyFaction(titleTag) ? titleTag.toUpperCase()
        : (deptStr.includes('lssd') || deptStr.includes('sheriff')) ? 'LSSD'
        : null;
    const cfgA = effFaction ? getAgencyForum(effFaction) : null;
    // Firebase status-key prefix. LSSD keeps its exact legacy strings
    // (lssdCrosspostStatus etc.); SADCR/DAO derive their own (sadcr* / dao*).
    // The completion-step NAME stays 'lssdCombinedReply' for every registry
    // faction so retryFailedCompletionSteps keeps a single branch.
    const fx = effFaction ? effFaction.toLowerCase() : 'lssd';

    // Faction mismatch sanity — trust the REQUEST record.
    if ((entryFaction === 'lssd' && deptStr.includes('lspd') && !deptStr.includes('lssd') && !deptStr.includes('sheriff'))
        || (entryFaction === 'lspd' && (deptStr.includes('lssd') || deptStr.includes('sheriff')))) {
        console.warn(`[AUTO-COMPLETE] Faction mismatch — request="${entryFaction}" but report department="${deptStr}". Trusting the request.`);
    }

    const markLssdFailure = async (reason) => {
        console.warn(`[AUTO-COMPLETE] ${fx.toUpperCase()} crosspost for #${key} — ${reason}`);
        await finishCompletionStep(key, 'lssdCombinedReply', false, reason);
        if (state.dbRef) {
            state.dbRef.child(`autopsy-requested/${key}`).update({
                [`${fx}CrosspostStatus`]: 'failed',
                [`${fx}CrosspostError`]: reason,
                [`${fx}CrosspostBbCode`]: bbCode,
                [`${fx}CrosspostOoc`]: entry.oocName || reportData.data?.decedentOOC || '',
            }).catch(() => {});
        }
    };

    // Request topic id for the effective faction (lssdRequestTopicId |
    // sadcrRequestTopicId | daoRequestTopicId — legacy LSSD name unchanged).
    const lssdRequestTopicId = cfgA ? (entry[cfgA.topicField] || '') : '';

    // Private cases (confidential autopsies) never crosspost to any agency forum.
    if (entry.isPrivate === true) {
        console.log(`[AUTO-COMPLETE] Private case #${key} — skipping LSSD crosspost`);
        await finishCompletionStep(key, 'lssdCombinedReply', true, 'Private case — agency crosspost skipped');
        return { ok: true, url: null, skipped: true };
    }

    // Not a registry faction (and no LSSD dept hint) — nothing to do here.
    if (!cfgA) {
        await finishCompletionStep(key, 'lssdCombinedReply', true, `No agency request topic (${effFaction || 'no registry faction'})`);
        return { ok: true, url: null };
    }

    // Searchable only if we have an OOC name or a non-generic decedent name.
    // The actual search (scoped to the faction's autopsy subforum, trying
    // "Name (( OOC ))" then the plain name) lives in searchLssdRequestTopic.
    const searchable = oocName || (decedentName && !/^john\s*doe$/i.test(decedentName) ? decedentName : '');

    if (!searchable) {
        await markLssdFailure(`${effFaction} case but no searchable name (no OOC / generic name) — force crosspost manually`);
        await progress.addStep(`${effFaction} Completion + Report`, 'fail', 'No searchable name');
        return { ok: false, url: null };
    }

    // Combined reply: completion notice + full autopsy report(s) in one post.
    // Array input (completed mass collection) concatenates every body with
    // `--- BODY i/N ---` headers; the single-body path below is unchanged.
    const batchedBodies = Array.isArray(bodies) && bodies.length
        ? bodies.map((b, idx) => {
            const who = [String(b?.name || '').trim(), b?.oocName ? `(( ${String(b.oocName).trim()} ))` : ''].filter(Boolean).join(' ').trim();
            return `--- BODY ${idx + 1}/${bodies.length}${who ? `: ${who}` : ''} ---\n${b?.bbCode || ''}`;
        }).join('\n\n')
        : (batchedBbCode || null);
    const lssdCombinedBb = completionBb + '\n\n[hr][/hr]\n\n' + (batchedBodies || bbCode);
    const agencyBaseUrl = cfgA.baseUrl;
    const agencyForumId = cfgA.forumId;

    if (lssdRequestTopicId) {
        await progress.addStep(`${effFaction} Completion + Report`, 'pending');
        const lssdClient = createIsolatedClient('lssd-complete');
        try {
            // Registry factions share the same forum account (all subforums of
            // lssd.gta.world) — creds are picked per faction prefix (FORUM_LSSD_*).
            await lssdClient.login(process.env[`FORUM_${cfgA.credPrefix}_USERNAME`], process.env[`FORUM_${cfgA.credPrefix}_PASSWORD`], { force: false, baseUrl: agencyBaseUrl });

            console.log(`[AUTO-COMPLETE] ${effFaction} combined reply — posting completion + report to #${lssdRequestTopicId}`);
            // Edit-in-place when this crosspost reply already exists (re-run after
            // a successful post) — the reply post id is persisted below on success.
            // Over-cap batched payloads split via the optional 55k chunk fallback.
            const existingCrosspostPostId = entry[`${fx}CrosspostReplyPostId`] || null;
            const crosspostParts = await chunkMassPayloadIfNeeded(lssdCombinedBb);
            if (crosspostParts.length > 1) console.log(`[AUTO-COMPLETE] ${effFaction} combined reply — ${crosspostParts.length} part(s) (55k chunk fallback)`);
            let r = null;
            let rFirst = null;
            for (let pi = 0; pi < crosspostParts.length; pi++) {
                r = await postOrEditReply(lssdClient, {
                    topicId: lssdRequestTopicId,
                    forumId: agencyForumId,
                    bbCode: crosspostParts[pi],
                    baseUrl: agencyBaseUrl,
                    // Edit-in-place only for the single-part case.
                    existingPostId: crosspostParts.length === 1 ? existingCrosspostPostId : null,
                    logTag: `${effFaction}-CROSSPOST${crosspostParts.length > 1 ? `-P${pi + 1}` : ''}`,
                });
                if (!rFirst) rFirst = r;
                if (!r.ok) break;
            }
            r = r || { ok: false, reason: 'No payload' };
            console.log(`[AUTO-COMPLETE] ${effFaction} combined reply — ` + (r.ok ? (r.edited ? 'EDITED #' : 'OK #') + lssdRequestTopicId : 'FAILED: ' + (r.reason || 'Unknown')));
            await finishCompletionStep(key, 'lssdCombinedReply', r.ok, r.ok ? `${r.edited ? 'Edited' : 'Completion + report to'} ${effFaction} #` + lssdRequestTopicId : (r.reason || 'Unknown'));
            await progress.addStep(`${effFaction} Completion + Report`, r.ok ? 'ok' : 'fail', r.ok ? '#' + lssdRequestTopicId : (r.reason || 'Failed'));
            if (!r.ok) stepFailed.LSSD = true;
            // Persist the reply post id so future re-runs edit instead of duplicating.
            // One completion URL set per collection (first part of a chunked batch).
            if (r.ok && (rFirst || r).postId && state.dbRef) {
                await state.dbRef.child(`autopsy-requested/${key}`).update({
                    [`${fx}CrosspostReplyPostId`]: (rFirst || r).postId,
                    [`${fx}CrosspostReplyUrl`]: (rFirst || r).url || null,
                }).catch(() => {});
            }
            return { ok: r.ok, url: r.ok ? ((rFirst || r).url || null) : null };
        } catch (e) {
            console.error(`[AUTO-COMPLETE] ${effFaction} operation error: ` + e.message);
            await finishCompletionStep(key, 'lssdCombinedReply', false, e.message);
            await progress.addStep(`${effFaction} Completion + Report`, 'fail', e.message);
            stepFailed.LSSD = true;
            return { ok: false, url: null };
        } finally {
            // Close the isolated client's context. Previously skipped to avoid
            // noisy stealth plugin errors racing the health check, but that left
            // renderer processes (one per context) alive forever — a ~200MB leak
            // per operation. close() delays 1s for health-check page creation to
            // settle, then suppresses all errors (proven by the fallback path below).
            try { await lssdClient.close(); } catch { /* isolated browser cleanup best-effort ignored: reply result already recorded */ }
        }
    }

    // Fallback: if no request-topic ID was saved during detection, try to find it now.
    await progress.addStep(`${effFaction} Completion + Report`, 'pending');
    const lssdClient = createIsolatedClient('lssd-complete');
    try {
        console.log(`[AUTO-COMPLETE] ${effFaction} fallback — searching ${effFaction} autopsy forum (f=${agencyForumId})...`);
        await lssdClient.login(process.env[`FORUM_${cfgA.credPrefix}_USERNAME`], process.env[`FORUM_${cfgA.credPrefix}_PASSWORD`], { force: false, baseUrl: agencyBaseUrl });
        const foundTopic = await searchLssdRequestTopic(lssdClient, { oocName, name: decedentName }, { forumId: agencyForumId, baseUrl: agencyBaseUrl });
        const fallbackTopicId = foundTopic?.topicId || null;

        if (fallbackTopicId) {
            console.log(`[AUTO-COMPLETE] ${effFaction} fallback — found topic #${fallbackTopicId}`);
            if (state.dbRef) {
                state.dbRef.child(`autopsy-requested/${key}/${savedKeyField()}`).set(String(fallbackTopicId)).catch(() => {});
            }
            const existingFallbackPostId = entry[`${fx}CrosspostReplyPostId`] || null;
            const fallbackParts = await chunkMassPayloadIfNeeded(lssdCombinedBb);
            let r = null;
            let rFirst = null;
            for (let pi = 0; pi < fallbackParts.length; pi++) {
                r = await postOrEditReply(lssdClient, {
                    topicId: fallbackTopicId,
                    forumId: agencyForumId,
                    bbCode: fallbackParts[pi],
                    baseUrl: agencyBaseUrl,
                    // Edit-in-place only for the single-part case.
                    existingPostId: fallbackParts.length === 1 ? existingFallbackPostId : null,
                    logTag: `${effFaction}-CROSSPOST-FALLBACK${fallbackParts.length > 1 ? `-P${pi + 1}` : ''}`,
                });
                if (!rFirst) rFirst = r;
                if (!r.ok) break;
            }
            r = r || { ok: false, reason: 'No payload' };
            await finishCompletionStep(key, 'lssdCombinedReply', r.ok, r.ok ? `${r.edited ? 'Edited fallback' : 'Fallback'} completion + report to #${fallbackTopicId}` : (r.reason || 'Unknown'));
            await progress.addStep(`${effFaction} Completion + Report`, r.ok ? 'ok' : 'fail', r.ok ? '#' + fallbackTopicId : (r.reason || 'Failed'));
            if (!r.ok) { stepFailed.LSSD = true; await markLssdFailure('Completion + report reply failed: ' + (r.reason || 'Unknown')); }
            if (r.ok && state.dbRef) {
                state.dbRef.child(`autopsy-requested/${key}`).update({
                    [`${fx}CrosspostStatus`]: 'completed',
                    [`${fx}CrosspostError`]: null,
                    [savedKeyField()]: String(fallbackTopicId),
                    [`${fx}CrosspostedAt`]: new Date().toISOString(),
                    ...((rFirst || r).postId ? { [`${fx}CrosspostReplyPostId`]: (rFirst || r).postId, [`${fx}CrosspostReplyUrl`]: (rFirst || r).url || null } : {}),
                }).catch(() => {});
            }
            return { ok: r.ok, url: r.ok ? ((rFirst || r).url || null) : null };
        } else {
            console.log(`[AUTO-COMPLETE] ${effFaction} fallback — no topic found for ` + (oocName || decedentName));
            await markLssdFailure(`${effFaction} request topic not found via search`);
            await progress.addStep(`${effFaction} Completion + Report`, 'fail', `No ${effFaction} topic found`);
            return { ok: false, url: null };
        }
    } catch (e) {
        console.error(`[AUTO-COMPLETE] ${effFaction} fallback error: ` + e.message);
        await finishCompletionStep(key, 'lssdCombinedReply', false, e.message);
        await progress.addStep(`${effFaction} Completion + Report`, 'fail', e.message);
        stepFailed.LSSD = true;
        await markLssdFailure(e.message);
        return { ok: false, url: null };
    } finally {
        try { await lssdClient.close(); } catch { /* isolated browser cleanup best-effort ignored: failure already recorded */ }
    }

    // Field holding the effective faction's saved request-topic id.
    function savedKeyField() {
        return cfgA.topicField; // lssdRequestTopicId | sadcrRequestTopicId | daoRequestTopicId
    }
}

/**
 * Build the DM/PM subject for a completed autopsy report.
 *
 * Private (confidential) cases never expose the decedent's IC name in the
 * subject — only the OOC name, so the recipient knows who it's about without
 * leaking the case subject in a PM title.
 *
 * @param {object} entry — autopsy-requested entry
 * @returns {string}
 */
function buildDmSubject(entry) {
    if (entry && entry.isPrivate === true) {
        const ooc = (entry.oocName || '').trim();
        return ooc ? `Autopsy Request - REDACTED - ((${ooc}))` : 'Autopsy Request - REDACTED - (Confidential)';
    }
    return 'Autopsy Request - ' + (entry?.title || 'Completed');
}

/**
 * Two-phase completion step tracking for safe auto-retry.
 *
 * Phase 1 — startCompletionStep: writes {status:"attempting"} BEFORE the operation.
 * Phase 2 — finishCompletionStep: updates to {status:"completed"} or {status:"failed"} AFTER.
 *
 * On restart, retryFailedCompletionSteps uses this to distinguish:
 *   "failed"    → genuine failure, auto-retry
 *   "attempting" → crash during op, skip (result is ambiguous, could be a duplicate)
 *   "completed" → already done, skip
 */

/**
 * Mark a completion step as "attempting" (written before the actual operation starts).
 * Stores at autopsy-requested/<topicId>/completionSteps/<stepName>
 */
async function startCompletionStep(topicId, stepName, detail = '') {
    if (!topicId || !state.dbRef) return;
    try {
        await state.dbRef
            .child(`autopsy-requested/${topicId}/completionSteps/${stepName}`)
            .set({ status: 'attempting', startedAt: new Date().toISOString(), detail });
    } catch (e) {
        // Fire-and-forget
    }
}

/**
 * Post a clear failure alert to the log channel when a completion step fails.
 * Self-healing retries handle the actual repair; this exists so staff SEE the
 * failure immediately and can investigate before/while the retry sweep runs.
 */
async function notifyCompletionStepFailure(topicId, stepName, detail) {
    if (!topicId) return;
    const embed = new EmbedBuilder()
        .setColor(0xdc3545)
        .setTitle(`Autopsy Completion Step Failed`)
        .setDescription([
            `**Case:** #${topicId}`,
            `**Step:** \`${stepName}\``,
            `**Reason:** ${detail || 'Unknown error'}`,
            '',
            'The recovery sweep will retry this automatically. Check `pm2 logs phmc-bot` for details.',
        ].join('\n'))
        .setFooter({ text: 'PHMC Bot — Autopsy Completion' })
        .setTimestamp();
    await sendLogMessage(null, embed);
}

/**
 * Tiny retry index for failed completion steps (RTDB cost optimization).
 *
 * The recovery sweep used to download the whole 400KB+ autopsy-requested node
 * every 10 min just to find failed steps. Now a failure drops a marker here and
 * the sweep reads this index first, then fetches ONLY the listed entries.
 * Markers are also (re)seeded from the monitor's startup snapshot (free — same
 * read that rebuilds assignment counts), so pre-deploy failures aren't lost.
 */
export const STEP_RETRY_PATH = 'completionStepRetries';

export function markStepRetry(topicId, stepName, detail = '') {
    if (!topicId || !stepName || !state.dbRef) return;
    try {
        state.dbRef
            .child(`${STEP_RETRY_PATH}/${topicId}/${stepName}`)
            .set({ failedAt: new Date().toISOString(), detail: String(detail || '').slice(0, 300) })
            .catch(() => {});
    } catch { /* fire-and-forget */ }
}

export function clearStepRetry(topicId, stepName) {
    if (!topicId || !stepName || !state.dbRef) return;
    try {
        state.dbRef.child(`${STEP_RETRY_PATH}/${topicId}/${stepName}`).remove().catch(() => {});
    } catch { /* fire-and-forget */ }
}

/**
 * Mark a completion step as "completed" or "failed" (written after the operation finishes).
 * Writes to Firebase for retry tracking + console log for PM2. On failure, posts a
 * dedicated alert to the log channel so staff are informed (self-healing still retries).
 * Live Discord updates are handled by the per-entry DeployProgressEmbed in the caller.
 */
async function finishCompletionStep(topicId, stepName, ok, detail = '') {
    const status = ok ? 'completed' : 'failed';
    const icon = ok ? '[OK]' : '[WARN]';
    console.log(`[AUTO-COMPLETE] ${icon} ${stepName}: ${ok ? 'OK' : 'FAIL'} ${detail}`);

    if (!ok) {
        // User-facing alert — failures must be visible in the log channel, not silent.
        await notifyCompletionStepFailure(topicId, stepName, detail);
    }

    // Firebase status (best-effort, never throws)
    if (topicId && state.dbRef) {
        try {
            await state.dbRef
                .child(`autopsy-requested/${topicId}/completionSteps/${stepName}`)
                .set({ status, updatedAt: new Date().toISOString(), detail });
        } catch (e) {
            // Fire-and-forget — don't let tracking failures block anything
        }
        // Keep the tiny retry index in sync so the sweep never scans the full node.
        if (ok) clearStepRetry(topicId, stepName);
        else markStepRetry(topicId, stepName, detail);
    }
}

/**
 * Handle an Autopsy report — search Case Management forum (f=266) by decedent name
 * and reply to the case thread with the autopsy BBCode.
 * Dry-run by default for safety — set AUTOPSY_DRY_RUN=false in .env to enable live posting.
 */
export async function handleAutopsyReply(report) {
    const { authorId, key, report: reportData, db } = report;

    // Respect maintenance mode — skip regardless of caller path
    if (await isMaintenanceMode().catch(() => false)) {
        console.log(`[AUTO]  ${key}  maintenance mode — skipping autopsy reply`);
        return;
    }

    const DRY = AUTOPSY_DRY_RUN;

    console.log(`[AUTO]  handleAutopsyReply called for ${key}  name: "${reportData.data?.decedentName}"`);

    // Determine search terms from report data
    const decedentName = (reportData.data?.decedentName || '').trim();
    const decedentOOC = (reportData.data?.decedentOOC || '').trim();
    const searchTerm = decedentOOC || decedentName || reportData.originalKey || '';

    if (!searchTerm) {
        console.log(`[AUTO]  ${key}  no decedent name to search for`);
        await logStep(' Cannot Process', 'Add a **Decedent Name** to the autopsy report, then save again.', { color: 0xdc3545, isFinal: true });
        const e = new Error('Missing decedent name. Add a name to the report and save again.');
        e.code = 'DATA_TERMINAL';
        e.terminalStatus = 'error';
        throw e;
    }

    // Guard: skip reply if ALL matching autopsy-requested entries for this OOC+name are
    // already completed (prevents duplicate on retry for a fully-processed case).
    // If even one matching entry is still pending (no completedAt), proceed — there is still
    // an active request to reply to.
    // MASS EXEMPTION FIRST: a report belonging to an OPEN mass-collection body
    // must never trip this guard on a HISTORICAL entry reusing the same OOC+name
    // (seen live: body "Jane Doe ((Autopsy Test))" skipped because an August entry
    // "Jane Doe ((Autopsy Test))" was completed). An open body proceeds; a body
    // whose match is already completed falls through to the normal guard below.
    // Per-body dedup still applies downstream ("already completed — skipping").
    const oocGuard = (reportData.data?.decedentOOC || "").trim();
    const nameGuard = (reportData.data?.decedentName || "").trim();
    if (oocGuard && nameGuard) {
        try {
            const massSnap = await db.ref("autopsy-requested").once("value");
            const massHit = matchCollectionCase(massSnap.val() || {}, oocGuard, nameGuard);
            if (massHit && !massHit.caseRec.completedAt) {
                console.log(`[AUTO] ${key} belongs to open mass body #${massHit.rkey}/${massHit.ci} — bypassing duplicate guard`);
            } else {
                const guardSnap = await db.ref("autopsy-requested").orderByChild("oocName").equalTo(oocGuard).once("value");
                let anyPending = false;
                let matched = 0;
                if (guardSnap.exists()) guardSnap.forEach(c => {
                    const entry = c.val();
                    if (entry.caseState === 'multi' && entry.cases && typeof entry.cases === 'object') {
                        // Mass collections complete per body — a top-level match
                        // says nothing; evaluate the matching bodies instead.
                        for (const cc of Object.values(entry.cases)) {
                            if (!cc || String(cc.oocName || '').trim() !== oocGuard) continue;
                            if (String(cc.name || '').trim() !== nameGuard) continue;
                            matched++;
                            if (!cc.completedAt) anyPending = true;
                        }
                        return;
                    }
                    if (entry.name === nameGuard) {
                        matched++;
                        if (!entry.completedAt) anyPending = true;
                    }
                });
                // Only skip when at least one entry actually matched this OOC+name
                // AND all matched entries are completed. A bare oocName hit with a
                // different decedent name (or no match at all) must NOT skip —
                // otherwise a live case never gets its reply (false positive seen
                // 2026-09-10: report "John Doe ((Gabriel Ontiveros))" skipped while
                // case 10103 was still open).
                if (matched > 0 && !anyPending) {
                    console.log(`[AUTO] ${key} all requests for this OOC+name are already completed — skipping duplicate reply`);
                    await setDeployStatus(db, authorId, key, "already_completed", "Skipped duplicate reply.");
                    await markReportComplete(db, authorId, key, reportData.originalKey || key, "autopsy-reply-skip", null);
                    return;
                }
            }
        } catch (e) { console.warn(`[AUTO] completion guard error: ${e.message}`); }
    }

    const bbSnap = await db.ref(`scheduledReportsBBCode/${authorId}/${key}`).once('value');
    const bbCode = bbSnap.val()?.bbCode;
    if (!bbCode) {
        console.log(`[AUTO]  ${key}  no BBCode, marking as deployed`);
        await logStep(' No BBCode', 'The report has no BBCode content. Regenerate and save again.', { color: 0xdc3545, isFinal: true });
        const e = new Error('No BBCode content found in report. Regenerate and save again.');
        e.code = 'DATA_TERMINAL';
        e.terminalStatus = 'error';
        throw e;
    }

    const client = getForumClient();
    const progress = new DeployProgressEmbed(state.discordClient, process.env.BOT_LOG_CHANNEL_ID, reportData.appBuild);
    if (report._progressMessageId) {
        await progress.resume(report._progressMessageId, report._progressChannelId || process.env.BOT_LOG_CHANNEL_ID, `Autopsy Report — ${reportData.originalKey || key}`);
    } else {
        await progress.start(`Autopsy Report — ${reportData.originalKey || key}`);
    }

    await progress.addStep('PHMC Login', 'pending');
    await client.login(null, null, { force: false, baseUrl: process.env.FORUM_BASE_URL });
    await progress.addStep('PHMC Login', 'ok');

    await progress.addStep('Searching Case Mgmt', 'pending', `Looking for "${searchTerm}"`);

    await setDeployStatus(db, authorId, key, 'searching', `Searching for "${searchTerm}" in Case Management...`);

    // Try direct topic lookup first (saves a forum search)
    let topicId, foundTitle;
    let arEntry = null;

    try {
        const ooc = (reportData.data?.decedentOOC || "").trim();
        const name = (reportData.data?.decedentName || "").trim();
        const searchKey = ooc || name;
        if (searchKey) {
            // ── Shared-thread fast path ──
            // A report belonging to a mass-collection body resolves straight
            // to the shared thread HERE — ahead of the saved caseTopicId
            // lookup below (the webapp may carry a stale binding from a
            // long-completed case, e.g. entry 9736) and ahead of the forum
            // search (whose title match can hit the wrong thread). Once set,
            // topicId skips every later resolution stage automatically.
            // matchCollectionCase prefers incomplete bodies, then highest
            // caseNum. Requires a known collection topic — otherwise fall
            // through to normal resolution.
            let sharedHit = null;
            try {
                const allSharedSnap = await db.ref("autopsy-requested").once("value");
                const hit = matchCollectionCase(allSharedSnap.val() || {}, ooc, name);
                if (hit && isSharedThreadCollection(hit.entry) && hit.entry.caseTopicId) sharedHit = hit;
            } catch (e) {
                console.warn('[AUTO] Shared-thread fast path lookup failed:', e.message);
            }
            if (sharedHit) {
                topicId = String(sharedHit.entry.caseTopicId);
                foundTitle = sharedHit.entry.caseTitle || 'Case #' + topicId;
                console.log(`[AUTO] Shared collection #${sharedHit.rkey} body ${sharedHit.ci} ("${sharedHit.caseRec.name || ''}" ((${sharedHit.caseRec.oocName || ''}))) — using shared thread #${topicId}, skipping saved binding + forum search`);
                await progress.addStep('Case Found', 'ok', '#' + topicId + ' ' + foundTitle + ` (mass body ${sharedHit.ci + 1})`);
            }
            let arSnap = null;
            // Prefer matching the real decedent OOC name (stored in oocName OR name)
            if (!sharedHit && ooc) {
                arSnap = await db.ref("autopsy-requested").orderByChild("oocName").equalTo(ooc).once("value");
                if (!arSnap.exists()) {
                    const byName = await db.ref("autopsy-requested").orderByChild("name").equalTo(ooc).once("value");
                    if (byName.exists()) arSnap = byName;
                }
            }
            // Fallback: decedent name field — but NEVER a generic "John Doe" placeholder.
            // Skipped entirely on a shared-thread hit (topic already resolved).
            if (!sharedHit && (!arSnap || !arSnap.exists()) && name && !/^john\s*doe$/i.test(name)) {
                arSnap = await db.ref("autopsy-requested").orderByChild("name").equalTo(name).once("value");
                if (!arSnap.exists()) {
                    const byOoc = await db.ref("autopsy-requested").orderByChild("oocName").equalTo(name).once("value");
                    if (byOoc.exists()) arSnap = byOoc;
                }
            }
            if (!sharedHit && arSnap && arSnap.exists()) {
                // If multiple entries share the OOC/name (same player, several cases),
                // prefer the active (not yet completed) one, then the most recent.
                let best = null;
                arSnap.forEach((child) => {
                    const cand = { key: child.key, data: child.val() };
                    const candTs = (cand.data.detectedAt ? new Date(cand.data.detectedAt).getTime() : 0) || parseInt(child.key, 10) || 0;
                    if (!best) { best = cand; return; }
                    if (best.data.completedAt && !cand.data.completedAt) { best = cand; return; }
                    if (!!best.data.completedAt === !!cand.data.completedAt && candTs > ((best.data.detectedAt ? new Date(best.data.detectedAt).getTime() : 0) || parseInt(best.key, 10) || 0)) {
                        best = cand;
                    }
                });
                arEntry = best;
                if (arEntry && arEntry.data.caseTopicId) {
                    topicId = arEntry.data.caseTopicId;
                    foundTitle = arEntry.data.caseTitle || 'Case #' + topicId;
                    console.log('[AUTO] Found saved caseTopicId=' + topicId + ' (entry ' + arEntry.key + ') — skipping forum search');
                    await progress.addStep('Case Found', 'ok', '#' + topicId + ' ' + foundTitle);
                }
            }
        }
    } catch (e) {
        console.warn('[AUTO] Direct lookup failed:', e.message);
    }

    // Multi-decedent fallback: multi records keep OOC/name + caseTopicId at the
    // PER-CASE level (cases/<idx>), not the top level — so the top-level lookup
    // above misses them (e.g. Marvion Futrell lives at request 9951 / cases/0,
    // caseTopicId 9955). Scan the per-case data and use the tracked topic
    // directly instead of prompting staff to pick.
    if (!topicId) {
        try {
            const ooc = (reportData.data?.decedentOOC || "").trim();
            const name = (reportData.data?.decedentName || "").trim();
            const oocL = ooc.toLowerCase();
            const nameL = name.toLowerCase();
            const nameUsable = !!name && !/^john\s*doe$/i.test(name);
            const allReqSnap = await db.ref("autopsy-requested").once("value");
            const allReq = allReqSnap.val() || {};
            const pickBest = (cur, cand) => {
                if (!cur) return cand;
                const cDone = !!cand.caseRec.completedAt;
                const bDone = !!cur.caseRec.completedAt;
                if (bDone && !cDone) return cand;
                if (bDone === cDone) {
                    const cNum = parseInt(cand.caseRec.caseNum, 10) || 0;
                    const bNum = parseInt(cur.caseRec.caseNum, 10) || 0;
                    if (cNum > bNum) return cand;
                }
                return cur;
            };
            let bestMulti = null; // { rkey, ci, caseRec }
            // Pass 1 — exact OOC match (takes priority so a name-only "John Doe"
            // tie-break can never override the specific decedent's case).
            for (const [rkey, entry] of Object.entries(allReq)) {
                if (String(entry.caseState || '') !== 'multi' || !entry.cases || typeof entry.cases !== 'object') continue;
                for (const [ci, c] of Object.entries(entry.cases)) {
                    if (!c || !c.caseTopicId) continue;
                    const cOoc = String(c.oocName || '').trim().toLowerCase();
                    if (!ooc || !cOoc || cOoc !== oocL) continue;
                    bestMulti = pickBest(bestMulti, { rkey, ci: parseInt(ci, 10), caseRec: c });
                }
            }
            // Pass 2 — name match (only if no OOC hit; never a generic "john doe").
            if (!bestMulti) {
                for (const [rkey, entry] of Object.entries(allReq)) {
                    if (String(entry.caseState || '') !== 'multi' || !entry.cases || typeof entry.cases !== 'object') continue;
                    for (const [ci, c] of Object.entries(entry.cases)) {
                        if (!c || !c.caseTopicId) continue;
                        const cName = String(c.name || '').trim().toLowerCase();
                        if (!nameUsable || !cName || cName !== nameL) continue;
                        bestMulti = pickBest(bestMulti, { rkey, ci: parseInt(ci, 10), caseRec: c });
                    }
                }
            }
            if (bestMulti) {
                topicId = bestMulti.caseRec.caseTopicId;
                foundTitle = bestMulti.caseRec.caseTitle || 'Case #' + topicId;
                console.log(`[AUTO] Found multi-decedent caseTopicId=${topicId} (request #${bestMulti.rkey}, case ${bestMulti.ci}) — skipping forum search`);
                await progress.addStep('Case Found', 'ok', '#' + topicId + ' ' + foundTitle);
            }
        } catch (e) {
            console.warn('[AUTO] Multi-decedent direct lookup failed:', e.message);
        }
    }

    // Fall back to forum search if no direct topic found
    if (!topicId) {
        const caseThreads = await client.searchCaseManagement(searchTerm);

        if (caseThreads.length === 0) {
            console.log(`[AUTO] No PHMC case thread found for "${searchTerm}"`);
            await progress.addStep('Case Not Found', 'fail', searchTerm);
            const rawDept = reportData.data?.department || '';
            const deptStr = (typeof rawDept === 'object' ? (rawDept.label || rawDept.value || '') : String(rawDept)).toLowerCase();
            if (deptStr.includes('lssd') || deptStr.includes('sheriff')) {
                console.log('[AUTO-COMPLETE] LSSD cross-post triggered');
                const lssdResult = await crosspostAutopsyToLssd(reportData, bbCode, null, db);
                if (lssdResult.awaitingPick) {
                    return;
                }
                if (lssdResult.ok && !lssdResult.skipped) {
                    const label = reportData.originalKey || key;
                    await markReportComplete(db, authorId, key, label, 'autopsy-lssd', lssdResult.url);
                    await progress.addStep('Posted to LSSD', 'ok');
                    await progress.finalize('complete');
                    return;
                }
            }

            await progress.addStep('Case Not Found', 'fail', 'No matching PHMC or LSSD thread exists');
            await progress.finalize('failed');
            const e = new Error(`No case thread found for "${searchTerm}". Create one manually, then re-save.`);
            e.code = 'DATA_TERMINAL';
            e.terminalStatus = 'topic_not_found';
            throw e;
        }

        if (caseThreads.length > 1 && state.discordClient) {
            // Multiple matches — let staff pick
            const pickId = `autopsy_pick_${++state.autopsyPickCounter}`;
            state.pendingAutopsyPicks.set(pickId, { db, authorId, key, reportData, bbCode, topics: caseThreads });

        console.log(`[AUTO]  ${caseThreads.length} case threads found for "${searchTerm}"  prompting staff`);

        // Build the embed and buttons
        const embed = new EmbedBuilder()
            .setColor(0xffc107)
            .setTitle('Multiple Case Threads Found')
            .setDescription([
                `**Report:** ${reportData.originalKey || key}`,
                `**Search:** \`${searchTerm}\``,
                '',
                'Multiple matching threads found. Pick the correct one:',
                ...caseThreads.slice(0, 10).map((t, i) => `${i + 1}. **#${t.topicId}** — ${(t.title || '').trim() || '(no title)'}`),
            ].join('\n'))
            .setFooter({ text: `Expires in 5 min | ${pickId}` })
            .setTimestamp();

        const rows = [];
        // Discord button labels cap at 80 chars — keep the case # and truncate the title
        const buttonLabel = (t) => {
            const title = (t.title || '').trim();
            if (!title) return `#${t.topicId}`;
            const suffix = ` #${t.topicId}`;
            const maxTitle = 80 - suffix.length;
            const trimmed = title.length > maxTitle ? title.slice(0, maxTitle - 1) + '…' : title;
            return trimmed + suffix;
        };
        // Split into rows of up to 3 buttons each (Discord limit: 5 per row)
        for (let i = 0; i < caseThreads.length; i += 3) {
            const chunk = caseThreads.slice(i, i + 3);
            const row = new ActionRowBuilder().addComponents(
                chunk.map((t) =>
                    new ButtonBuilder()
                        .setCustomId(`${pickId}_${t.topicId}`)
                        .setLabel(buttonLabel(t))
                        .setStyle(ButtonStyle.Primary)
                )
            );
            rows.push(row);
        }

        // Add a "None of these" cancel button
        rows.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`${pickId}_cancel`)
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
        ));

        try {
            const channelId = process.env.BOT_LOG_CHANNEL_ID;
            if (!channelId) throw new Error('No BOT_LOG_CHANNEL_ID configured');
            const channel = await state.discordClient.channels.fetch(channelId);
            await channel.send({ embeds: [embed], components: rows });

            // Cancel pending pick after 5 minutes and re-queue the report
            pickExpiryTimers.set(pickId, setTimeout(async () => {
                pickExpiryTimers.delete(pickId);
                const expired = state.pendingAutopsyPicks.get(pickId);
                if (expired) {
                    state.pendingAutopsyPicks.delete(pickId);
                    console.log(`[AUTO]  Autopsy pick ${pickId} expired  re-queuing ${expired.key}`);

                    // Remove from state.knownReportKeys so it gets picked up by the listener again
                    if (state.knownReportKeys) state.knownReportKeys.delete(expired.key);

                    // Mark in Firebase so the web app shows why it's stuck
                    try {
                        await expired.db.ref(`scheduledReports/${expired.authorId}/${expired.key}`).update({
                            deployStatus: 'pick_timed_out',
                            deployMessage: 'Topic pick timed out (5 min). The report will be re-attempted on the next save.',
                            deployCheckedAt: new Date().toISOString(),
                        });
                    } catch (err) {
                        console.error(`[AUTO]  Failed to update timeout status: ${err.message}`);
                    }
                }
            }, 5 * 60 * 1000));

            console.log(`[AUTO]  Waiting for staff to pick a thread for "${searchTerm}"`);
            return;
        } catch (err) {
            console.error(`[AUTO]  Failed to prompt staff for topic pick: ${err.message}`);
            // Fall through to auto-pick the first result
        }
        if (pickExpiryTimers.has(pickId)) {
            clearTimeout(pickExpiryTimers.get(pickId));
            pickExpiryTimers.delete(pickId);
        }
        state.pendingAutopsyPicks.delete(pickId);
    }

    // Auto-pick: use the most recent/relevant match
    topicId = caseThreads[0].topicId;
    foundTitle = caseThreads[0].title;
    if (caseThreads.length > 1) {
        console.log(`[AUTO]  ${caseThreads.length} case threads found  auto-picked most recent: #${topicId} "${foundTitle}"`);
    }
    } // end fallback search

    // Topic found — reply
    console.log(`[AUTO]  Case thread found: #${topicId}  "${foundTitle}"`);
    await setDeployStatus(db, authorId, key, 'replying', `Found case #${topicId}. ${DRY ? 'Filling form (dry run)' : 'Posting reply...'}`);
    await progress.addStep('Case Found', 'ok', `#${topicId} ${foundTitle}`);
    await progress.addStep('Posting Reply', 'pending');

    // ── Mass-collection per-body reply target (best-effort, never fatal) ──
    // Shared-thread collections hold one reply PER BODY inside the one f=266
    // thread: resolve this report's cases/<idx> member (OOC-exact-first, never
    // generic John Doe) so the post below edits that body's own reply, and
    // point the reply at the shared thread when the members carry no
    // individual caseTopicId. Per-topic records skip the override entirely.
    let massBodyCtx = null; // { rkey, ci, caseRec, entry }
    let massReplyTopicId = topicId;
    try {
        const mOoc = (reportData.data?.decedentOOC || '').trim();
        const mName = (reportData.data?.decedentName || '').trim();
        if (mOoc || (mName && !/^john\s*doe$/i.test(mName))) {
            const mSnap = await db.ref('autopsy-requested').once('value');
            const hit = matchCollectionCase(mSnap.val() || {}, mOoc, mName);
            if (hit && isSharedThreadCollection(hit.entry)) {
                massBodyCtx = hit;
                massReplyTopicId = String(hit.entry.caseTopicId || hit.entry.topicId || topicId);
                console.log(`[AUTO] Mass collection #${hit.rkey} body ${hit.ci} — per-body reply in shared thread #${massReplyTopicId}`);
            } else if (hit && hit.caseRec && hit.caseRec.replyPostId) {
                // Per-topic multi whose case already tracked its own reply —
                // reuse it for edit-in-place on re-runs.
                massBodyCtx = hit;
            }
        }
    } catch (e) { console.warn('[AUTO] Mass per-body reply lookup failed:', e.message); }

    // ── Edit-in-place when this entry already posted ──
    // A re-queued / retried / restarted entry that already has a live reply
    // edits it instead of posting a duplicate (e.g. post succeeded but marking
    // failed, or manual re-queue). deployPostId is captured by markReportComplete.
    // Mass collections pass the body's own reply id (per-body, shared thread).
    const massBodyPostId = massBodyCtx ? String(massBodyCtx.caseRec?.replyPostId || '').trim() : '';
    const result = await postOrEditReply(client, {
        topicId: massReplyTopicId,
        forumId: CASE_MGMT_FORUM_ID,
        bbCode,
        title: reportData.originalKey || undefined,
        existingPostId: massBodyPostId || reportData.deployPostId,
        ...(massBodyCtx ? { existingPostIds: { [massBodyCtx.ci]: massBodyPostId }, bodyIndex: massBodyCtx.ci } : {}),
        dryRun: DRY,
        logTag: 'CASE-REPLY',
    });
    // This body's f=266 reply identity — persisted to cases/<idx> below.
    const f266ReplyPostId = result.postId || massBodyPostId || null;
    const f266ReplyUrl = result.url || massBodyCtx?.caseRec?.replyUrl || null;

    if (result.ok && !result.dryRun) {
        await progress.addStep('Autopsy Posted', 'ok', (result.edited ? 'Edited ' : '') + (result.url || ''));
        const label = reportData.originalKey || key;
        // Preserve the original post id on edit (the edit URL may not carry p=).
        const completeUrl = result.edited && reportData.deployUrl ? reportData.deployUrl : result.url;
        const completed = await markReportComplete(db, authorId, key, label, 'autopsy-reply', completeUrl);
        if (completed) {
            let completedTopicId = null;
            let completedLssdTopicId = null;
            let completedLspdTopicId = null;
            let completedCaseTitle = null;
            try {
                const ooc = (reportData.data?.decedentOOC || "").trim();
                const name = (reportData.data?.decedentName || "").trim();
                console.log('[AUTO-COMPLETE] Parsed OOC="' + ooc + '" name="' + name + '"');
                let arSnap = null;

                // 1. STRONGEST match: the Case Management topic we just replied to.
                //    caseTopicId is unique per entry, so this can only match the real case —
                //    avoids the old name-based fallback cross-matching unrelated entries
                //    that share a generic decedent name (e.g. "John Doe").
                //    MUST use massReplyTopicId (the effective reply target after the
                //    per-body override), never the pre-override topicId: the report
                //    may carry a stale saved caseTopicId (e.g. loaded from a long-
                //    completed case in the webapp modal) while the reply itself
                //    correctly landed in the shared thread.
                if (massReplyTopicId) {
                    arSnap = await db.ref("autopsy-requested").orderByChild("caseTopicId").equalTo(String(massReplyTopicId)).once("value");
                    if (arSnap.exists()) console.log('[AUTO-COMPLETE] Matched by caseTopicId #' + massReplyTopicId);
                }

                // 2. Fallback: match by the decedent OOC name against oocName OR name fields
                //    (requests may store the real name in either).
                if (!arSnap || !arSnap.exists()) {
                    if (ooc) {
                        let by = await db.ref("autopsy-requested").orderByChild("oocName").equalTo(ooc).once("value");
                        if (!by.exists()) by = await db.ref("autopsy-requested").orderByChild("name").equalTo(ooc).once("value");
                        if (by.exists()) console.log('[AUTO-COMPLETE] Matched by OOC "' + ooc + '"');
                        arSnap = by;
                    }
                }

                // 3. Last resort: match by the decedent name, but NEVER a generic "John Doe"
                //    placeholder — that matches every unrelated test entry.
                if (!arSnap || !arSnap.exists()) {
                    if (name && !/^john\s*doe$/i.test(name)) {
                        let by = await db.ref("autopsy-requested").orderByChild("name").equalTo(name).once("value");
                        if (!by.exists()) by = await db.ref("autopsy-requested").orderByChild("oocName").equalTo(name).once("value");
                        if (by.exists()) console.log('[AUTO-COMPLETE] Matched by name "' + name + '"');
                        arSnap = by;
                    }
                }

                // 4. Multi-decedent records keep per-case caseTopicIds under
                //    cases/<idx> (the top-level record has no caseTopicId) —
                //    scan them so completion crossposts work per case.
                let multiMatch = null;
                if ((!arSnap || !arSnap.exists()) && massReplyTopicId) {
                    const allReqSnap = await db.ref("autopsy-requested").once("value");
                    const allReq = allReqSnap.val() || {};
                    outer:
                    for (const [key, entry] of Object.entries(allReq)) {
                        if (entry.caseState !== 'multi' || !entry.cases) continue;
                        for (const [ci, c] of Object.entries(entry.cases)) {
                            if (String(c.caseTopicId) === String(massReplyTopicId)) {
                                console.log(`[AUTO-COMPLETE] Matched multi-decedent record #${key} case ${ci} by caseTopicId #${topicId}`);
                                multiMatch = { key, entry, ci: parseInt(ci, 10), caseRec: c };
                                break outer;
                            }
                        }
                    }
                }

                // 1b. Shared-thread mass collections carry the COLLECTION topic
                // at top level, so a step-1 hit must NOT complete the whole
                // collection. Resolve the matching BODY via OOC/name and route
                // it down the multi path instead. Hits that resolve to nothing
                // are quarantined (skipped, never completed) — completing a
                // collection on an ambiguous match is worse than deferring it.
                const sharedResolved = [];
                const sharedQuarantined = new Set();
                if (arSnap && arSnap.exists()) {
                    arSnap.forEach((child) => {
                        const e = child.val();
                        if (!(e && e.isMassSingleThread === true && e.cases && typeof e.cases === 'object')) return;
                        sharedQuarantined.add(child.key);
                        if (e.completedAt) return;
                        const hit = matchCollectionCase({ [child.key]: e }, ooc, name);
                        if (hit && !hit.caseRec.completedAt) {
                            console.log(`[AUTO-COMPLETE] Shared collection #${child.key}: report belongs to body ${hit.ci} ("${hit.caseRec.name || ''}" ((${hit.caseRec.oocName || ''}))) — per-body completion`);
                            sharedResolved.push({
                                key: child.key,
                                entry: { ...e, _caseIdx: hit.ci, _caseRec: hit.caseRec },
                                ref: child.ref,
                            });
                        } else if (hit) {
                            console.log(`[AUTO-COMPLETE] Shared collection #${child.key}: body ${hit.ci} already completed — skipping`);
                        } else {
                            console.warn(`[AUTO-COMPLETE] Shared collection #${child.key}: report OOC="${ooc}" name="${name}" matches no body — quarantined, needs supervisor triage (NOT completing collection)`);
                        }
                    });
                }

                const entries = [];
                for (const s of sharedResolved) entries.push(s);
                if (multiMatch) {
                    const { key, entry, ci, caseRec } = multiMatch;
                    if (caseRec.completedAt) {
                        console.log(`[AUTO-COMPLETE] Case ${ci} of #${key} already completed — skipping`);
                    } else {
                        // Augment the entry with per-case context for the loop below.
                        const ctx = { ...entry, _caseIdx: ci, _caseRec: caseRec };
                        entries.push({ key, entry: ctx, ref: db.ref(`autopsy-requested/${key}`) });
                    }
                } else if (arSnap && arSnap.exists()) {
                    // Convert to array for async iteration (forEach doesn't await).
                    // Shared-thread hits are excluded here — quarantined above
                    // (resolved ones already pushed as multi entries).
                    arSnap.forEach((child) => {
                        if (sharedQuarantined.has(child.key)) return;
                        const entry = child.val();
                        if (entry.completedAt) return;
                        entries.push({ key: child.key, entry, ref: child.ref });
                    });
                }

                    for (const { key, entry, ref } of entries) {
                        completedTopicId = key;
                        completedLssdTopicId = entry.lssdRequestTopicId;
                        completedLspdTopicId = entry.lspdTopicId;
                        // Multi-decedent records: use the per-case record for
                        // identity/state so each case completes independently.
                        const caseRec = entry._caseRec || null;
                        const caseIdx = entry._caseIdx ?? null;
                        completedCaseTitle = ((caseRec?.caseTitle || entry.caseTitle || entry.title || "Autopsy Case")).replace(/\s*[-–—]\s*UNASSIGNED\s*$/i, '');

                        // Private cases (confidential autopsies) never crosspost to LSPD/LSSD.
                        const isPrivateEntry = entry.isPrivate === true;

                        console.log('[AUTO-COMPLETE] Marking autopsy request as completed in Firebase');
                        const isMulti = caseRec != null;
                        let allCasesDone = true;
                        let massCasesVal = null; // fresh cases/<idx> map for batched payloads below
                        if (isMulti) {
                            // Per-case completion — the request stays open until
                            // every decedent's case has completed.
                            // This body's own f=266 reply identity lands here too
                            // (per-body replyPostId/replyUrl inside the shared
                            // thread); other bodies' rows are never touched.
                            const ownBody = massBodyCtx && massBodyCtx.rkey === key && massBodyCtx.ci === caseIdx;
                            await ref.child(`cases/${caseIdx}`).update({
                                completedAt: new Date().toISOString(),
                                completedBbCode: bbCode,
                                ...(ownBody && f266ReplyPostId ? { replyPostId: f266ReplyPostId } : {}),
                                ...(ownBody && f266ReplyUrl ? { replyUrl: f266ReplyUrl } : {}),
                            });
                            const casesSnap = await ref.child('cases').once('value');
                            massCasesVal = casesSnap.val() || {};
                            allCasesDone = Object.values(massCasesVal).every(c => c.completedAt);
                            const doneCount = Object.values(massCasesVal).filter(c => c.completedAt).length;
                            const totalCount = Object.values(massCasesVal).length;
                            console.log(`[MASS] #${key} BODY ${Number(caseIdx) + 1}/${totalCount} DONE: ${caseRec?.name || '?'} ((${caseRec?.oocName || '?'})) by ${caseRec?.assignedTo || entry.assignedTo || '?'} — collection ${doneCount}/${totalCount}${allCasesDone ? ' — ALL COMPLETE, batched send follows' : ' (external sends deferred)'}`);
                            if (allCasesDone) {
                                await ref.update({ completedAt: new Date().toISOString(), completedBbCode: bbCode });
                                console.log('[AUTO-COMPLETE] All decedent cases complete — request marked completed');
                                // Retire the mass panel(s) now that there is
                                // nothing left to press them for (best-effort —
                                // rows disable, Firebase refs cleared). Both
                                // generations retire; only the posted one hits.
                                try {
                                    const { retireMassPanel } = await import('./massAssignmentPanel.js');
                                    await retireMassPanel(db, state.discordClient, key).catch(() => {});
                                    const { retireMassPanelV2 } = await import('./massPanelV2.js');
                                    await retireMassPanelV2(db, state.discordClient, key).catch(() => {});
                                } catch { /* panel retire best-effort ignored: completion itself already persisted */ }
                            }
                        } else {
                            await ref.update({ completedAt: new Date().toISOString(), completedBbCode: bbCode });
                        }
                        console.log("[AUTO] [OK] Marked autopsy-requested #" + key + " as completed");

                        // Decrement the ME's active case count in the rotation tracker.
                        // Per-body ME only (caseRec.assignedTo) — other bodies'
                        // assignments in a shared-thread collection are untouched.
                        const completingMe = caseRec?.assignedTo || entry.assignedTo;
                        if (completingMe) {
                            clearAssignment(db, completingMe, key).catch(err => {
                                console.warn(`[AUTO-COMPLETE] rotation tracking error: ${err.message}`);
                            });
                        }

                        // ── Consolidated progress embed (one self-updating message per entry) ──
                        const caseName = caseRec?.name || caseRec?.oocName || entry.name || entry.oocName || key;
                        const progress = new DeployProgressEmbed(state.discordClient, process.env.BOT_LOG_CHANNEL_ID, entry.appBuild);
                        await progress.start(`Autopsy Completion — ${caseName}`);

                        const requesterName = entry.parsed?.requesterName || "Requesting Party";
                        const caseTitle = entry.caseUrl || entry.title || "Autopsy Case";
                        const stepPromises = [];
                        const stepFailed = {};

                        // Save the report BBCode + OOC name so retryFailedLssdCrossposts /
                        // the force script can re-post if these steps fail or are skipped.
                        if (state.dbRef) {
                            state.dbRef.child(`autopsy-requested/${key}`).update({
                                lssdCrosspostBbCode: bbCode,
                                lssdCrosspostOoc: entry.oocName || reportData.data?.decedentOOC || '',
                            }).catch(() => {});
                        }

                        // ── Agency completion + report — posts FIRST for registry-faction cases ──
                        // The combined reply (completion notice + full report) goes out to the
                        // requesting faction's OWN subforum (LSSD f=2263 / SADCR f=2328 /
                        // DAO f=2331 — all on lssd.gta.world) before the PHMC completion notice
                        // so its topic URL can be embedded in the f=265 reply below.
                        const completionFaction = isPrivateEntry
                            ? 'private'
                            : (String(entry.faction || '').toLowerCase()
                                || (/\[(lssd|lspd|sadcr|dao)\]/i.exec(entry.title || '') || [])[1]?.toLowerCase()
                                || null);
                        const completionAgencyCfg = isAgencyFaction(completionFaction)
                            ? getAgencyForum(completionFaction)
                            : null;
                        const completionFx = completionAgencyCfg ? completionFaction.toLowerCase() : 'lssd';
                        const completionLspdUrl = completedLspdTopicId
                            ? `https://lspd.gta.world/viewtopic.php?t=${completedLspdTopicId}`
                            : null;
                        let completionBb = buildCompletionBb(caseTitle, requesterName, { faction: completionFaction, lspdUrl: completionLspdUrl, formsAutopsy: entry.formsAutopsy });
                        // Shared-thread mass collection: the agency combined reply
                        // fires ONCE with every body (array input) when the last
                        // body completes; partials defer so no premature singles
                        // go out. One completion URL set per collection (top level).
                        const sharedBatch = isMulti && isSharedThreadCollection(entry);
                        let agencyBodies = null;
                        if (sharedBatch && allCasesDone) {
                            const batch = buildBatchedBodiesPayload(massCasesVal || {});
                            agencyBodies = Object.keys(massCasesVal || {}).filter((k) => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b).map((i) => ({
                                name: massCasesVal[i]?.name || '',
                                oocName: massCasesVal[i]?.oocName || '',
                                bbCode: massCasesVal[i]?.completedBbCode || '',
                            }));
                            console.log(`[AUTO-COMPLETE] Shared collection — batched agency reply (${batch.count} bodies)`);
                        }
                        let agencyCompletionUrl = null;
                        if (!isPrivateEntry && sharedBatch && !allCasesDone) {
                            await startCompletionStep(key, 'lssdCombinedReply', 'Deferred — collection has pending bodies');
                            await finishCompletionStep(key, 'lssdCombinedReply', true, 'Deferred — not all bodies complete');
                            await progress.addStep('Agency Completion + Report', 'ok', 'Deferred until all bodies complete');
                        } else if (!isPrivateEntry) {
                            const lssdRes = await postLssdCombinedReply({
                                key, entry, reportData, completionBb, bbCode, bodies: agencyBodies, progress, stepFailed,
                            });
                            agencyCompletionUrl = lssdRes.url;
                            if (lssdRes.ok && agencyCompletionUrl && state.dbRef) {
                                await state.dbRef.child(`autopsy-requested/${key}`).update({
                                    [`${completionFx}CompletionUrl`]: agencyCompletionUrl,
                                    [`${completionFx}CrosspostStatus`]: 'completed',
                                    [`${completionFx}CrosspostedAt`]: new Date().toISOString(),
                                }).catch(() => {});
                            }
                            if (agencyCompletionUrl) completionBb = buildCompletionBb(caseTitle, requesterName, { faction: completionFaction, lssdUrl: agencyCompletionUrl, lspdUrl: completionLspdUrl, formsAutopsy: entry.formsAutopsy });
                        } else {
                            await finishCompletionStep(key, 'lssdCombinedReply', true, 'Private case — agency crosspost skipped');
                            await progress.addStep('Agency Completion + Report', 'ok', 'Skipped (private case)');
                        }

                        // ── PHMC completion reply ──
                        // Runs after the LSSD post, carrying the direct LSSD link when one was posted.
                        // Multi-decedent requests defer the "COMPLETED" notice until EVERY
                        // decedent's case is done, so the requester never sees a premature
                        // "We have completed the autopsy investigation" for an open request.
                        await progress.addStep('PHMC Reply', 'pending');
                        stepPromises.push((async () => {
                            const stepName = 'phmcCompletionReply';
                            if (isMulti && !allCasesDone) {
                                await startCompletionStep(key, stepName, 'Deferred — request has pending decedents');
                                await finishCompletionStep(key, stepName, true, 'Deferred — not all decedent cases complete');
                                await progress.addStep('PHMC Reply', 'ok', 'Deferred until all decedents complete');
                                return;
                            }
                            await startCompletionStep(key, stepName, 'Reply to #' + entry.topicId);
                            try {
                                // Shared-thread collection: the public request-thread
                                // reply is the SINGLE default completion notice —
                                // no per-body repetition, no report links. Full
                                // reports travel via DM + case thread.
                                let payloads = [completionBb];
                                if (sharedBatch && allCasesDone) {
                                    console.log(`[AUTO-COMPLETE] Shared collection — single completion notice`);
                                }
                                let r = null;
                                let firstR = null;
                                for (let pi = 0; pi < payloads.length; pi++) {
                                    // Edit-in-place only for the single-part case;
                                    // multi-part batches post fresh parts.
                                    r = payloads.length === 1
                                        ? await postOrEditReply(client, {
                                            topicId: entry.topicId,
                                            forumId: AUTOPSY_REQUEST_FORUM_ID,
                                            bbCode: payloads[pi],
                                            existingPostId: entry.phmcCompletionReplyPostId || null,
                                            logTag: 'PHMC-COMPLETION',
                                        })
                                        : await client.replyToTopic(entry.topicId, AUTOPSY_REQUEST_FORUM_ID, payloads[pi], { dryRun: false });
                                    if (!firstR) firstR = r;
                                    if (!r.ok) break;
                                }
                                r = r || { ok: false, reason: 'No payload' };
                                const skipped = r.topicMissing === true;
                                // Persist the reply post id so a future retry edits
                                // instead of posting a duplicate completion notice.
                                if (r.ok && state.dbRef) {
                                    const replyPostId = extractReplyPostId((firstR || r).url);
                                    if (replyPostId) {
                                        await state.dbRef.child(`autopsy-requested/${key}`).update({
                                            phmcCompletionReplyPostId: replyPostId,
                                            phmcCompletionReplyUrl: (firstR || r).url || null,
                                        }).catch(() => {});
                                    }
                                }
                                await finishCompletionStep(key, stepName, r.ok || skipped, skipped ? 'Request topic #' + entry.topicId + ' no longer exists — nothing to reply to' : (r.ok ? 'Reply posted to #' + entry.topicId : (r.reason || 'Unknown')));
                                await progress.addStep('PHMC Reply', r.ok || skipped ? 'ok' : 'fail', skipped ? 'Topic gone' : (r.ok ? '#' + entry.topicId : (r.reason || 'Failed')));
                                if (!r.ok && !skipped) stepFailed.PHMC = true;
                            } catch (e) {
                                await finishCompletionStep(key, stepName, false, e.message);
                                await progress.addStep('PHMC Reply', 'fail', e.message);
                                stepFailed.PHMC = true;
                            }
                        })());
                        // LSSD cross-post + DM handled as completion steps below (in parallel).

                        // ── LSPD crosspost step ──
                        // Replies to the LSPD certified copy topic (created at detection time)
                        // with the completed autopsy report. Falls back to creating the LSPD
                        // topic now if it wasn't created during detection (race condition guard).
                        const lspdTopicId = completedLspdTopicId;
                        // Faction is determined by the REQUEST (entry.faction / [LSPD] tag) — the
                        // report's department field is only a hint for requests with no clear tag.
                        const lspdFaction = (entry.faction || '').toLowerCase();
                        const lspdTitleTag = (/\[(lssd|lspd)\]/i.exec(entry.title || '') || [])[1]?.toLowerCase() || '';
                        const lspdDept = (typeof reportData?.data?.department === 'object'
                            ? (reportData.data.department.label || reportData.data.department.value || '')
                            : (reportData?.data?.department || '')).toLowerCase();
                        const isLssdEntry = lspdFaction === 'lssd' || lspdTitleTag === 'lssd';
                        const isLspdCase = lspdFaction === 'lspd' || lspdTitleTag === 'lspd'
                            || (!isLssdEntry && (lspdDept.includes('lspd') || lspdDept.includes('police')));
                        if (isPrivateEntry) {
                            await finishCompletionStep(completedTopicId, 'lspdCrosspost', true, 'Private case — LSPD crosspost skipped');
                            await progress.addStep('LSPD Crosspost', 'ok', 'Skipped (private case)');
                        } else if (sharedBatch && !allCasesDone) {
                            await startCompletionStep(completedTopicId, 'lspdCrosspost', 'Deferred — collection has pending bodies');
                            await finishCompletionStep(completedTopicId, 'lspdCrosspost', true, 'Deferred — not all bodies complete');
                            await progress.addStep('LSPD Crosspost', 'ok', 'Deferred until all bodies complete');
                        } else if (lspdTopicId || isLspdCase) {
                            await progress.addStep('LSPD Crosspost', 'pending');
                            stepPromises.push((async () => {
                                const stepName = 'lspdCrosspost';
                                const label = lspdTopicId ? 'Reply to LSPD #' + lspdTopicId : 'Create LSPD topic';
                                await startCompletionStep(completedTopicId, stepName, label);
                                try {
                                    // crosspostAutopsyToLspd re-gates on the report's
                                    // department text — but demo/fill-in reports may
                                    // carry a non-LSPD department while the REQUEST
                                    // is unambiguously LSPD. Fall back to the
                                    // request's own department line (real request
                                    // data, not fabricated) so LSPD cases are never
                                    // skipped on a report-field technicality.
                                    const reqDeptFallback = entry.parsed?.requesterDept || 'Los Santos Police Department';
                                    const lspdReportData = {
                                        data: {
                                            ...(reportData?.data || {}),
                                            department: (!lspdDept.includes('lspd') && !lspdDept.includes('police') && isLspdCase)
                                                ? reqDeptFallback
                                                : (reportData?.data?.department || 'Los Santos Police Department'),
                                            decedentName: reportData?.data?.decedentName || caseRec?.name || entry.name || '',
                                            decedentOOC: reportData?.data?.decedentOOC || caseRec?.oocName || entry.oocName || '',
                                        }
                                    };
                                    // Pass null lspdTopicId when missing — crosspostAutopsyToLspd
                                    // will create a new topic on the LSPD forum as fallback.
                                    // Shared-thread collection: ONE crosspost carrying
                                    // every body (array joined with BODY headers).
                                    // crosspostAutopsyToLspd takes a single bbCode
                                    // string, so the batch is joined at this call
                                    // site — no change needed in deployLspd.js.
                                    let lspdBbCode = bbCode;
                                    let lspdCaseTitle = completedCaseTitle;
                                    if (sharedBatch && allCasesDone) {
                                        const batch = buildBatchedBodiesPayload(massCasesVal || {});
                                        lspdBbCode = batch.text;
                                        const caseNums = Object.keys(massCasesVal || {}).filter((k) => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b).map((i) => massCasesVal[i]?.caseNum).filter(Boolean);
                                        lspdCaseTitle = `Mass Autopsy — ${batch.count} bodies${caseNums.length ? ` (Cases ${caseNums.join(', ')})` : ''}`;
                                        console.log(`[AUTO-COMPLETE] Shared collection — batched LSPD crosspost (${batch.count} bodies)`);
                                    }
                                    const lspdResult = await crosspostAutopsyToLspd(
                                        lspdReportData,
                                        lspdBbCode,
                                        completedTopicId,
                                        state.dbRef,
                                        lspdTopicId || null,
                                        { caseTitle: lspdCaseTitle, caseTopicId: caseRec?.caseTopicId || entry.caseTopicId }
                                    );
                                    const ok = lspdResult.ok && !lspdResult.skipped;
                                    const detail = lspdTopicId ? '#' + lspdTopicId : (lspdResult.url || '');
                                    await finishCompletionStep(completedTopicId, stepName, ok, ok ? (lspdTopicId ? 'Reply to LSPD #' + lspdTopicId : 'Created LSPD topic') : (lspdResult.error || 'Skipped'));
                                    await progress.addStep('LSPD Crosspost', ok ? 'ok' : 'fail', detail || (lspdResult.error || 'Failed'));
                                    if (!ok) stepFailed.LSPD = true;
                                } catch (e) {
                                    console.error('[AUTO-COMPLETE] LSPD crosspost error: ' + e.message);
                                    await finishCompletionStep(completedTopicId, stepName, false, e.message);
                                    await progress.addStep('LSPD Crosspost', 'fail', e.message);
                                    stepFailed.LSPD = true;
                                }
                            })());
                        } else {
                            await finishCompletionStep(completedTopicId, 'lspdCrosspost', true, 'No LSPD topic ID (not an LSPD case)');
                        }

                        // ── 4. DM the requester on its own isolated client ──
                        // For private cases with pm_forum, DM goes to pmRecipient on the
                        // configured forum (LSPD/LSSD/PHMC). Otherwise the standard flow
                        // resolves the PHMC topic poster as the DM target.
                        await progress.addStep('DM Requester', 'pending');
                        stepPromises.push((async () => {
                            const dmClient = createIsolatedClient('dm');

                            // Multi-decedent requests defer the DM until every decedent
                            // is done — no premature "completed" DM for an open request.
                            if (isMulti && !allCasesDone) {
                                await progress.addStep('DM Requester', 'ok', 'Deferred until all decedents complete');
                                try { await dmClient.close(); } catch { /* isolated DM client cleanup best-effort ignored: deferred step already recorded */ }
                                return;
                            }

                            // Resolve forum target for private pm_forum / web-forms
                            // deliveries (LSPD/LSSD/SADCR/DAO/PHMC)
                            let pmForumBaseUrl = null;
                            let pmForumUser = null;
                            let pmForumPass = null;
                            const deliveryForumKey = String(
                                (isPrivateEntry && entry.pmForum) ? entry.pmForum
                                : (entry.formsAutopsy === true ? (entry.agencyForum || 'phmc') : '')
                            ).toLowerCase();
                            if (deliveryForumKey) {
                                if (deliveryForumKey === 'lssd' || deliveryForumKey === 'sadcr' || deliveryForumKey === 'dao') {
                                    pmForumBaseUrl = 'https://lssd.gta.world';
                                    pmForumUser = process.env.FORUM_LSSD_USERNAME;
                                    pmForumPass = process.env.FORUM_LSSD_PASSWORD;
                                } else if (deliveryForumKey === 'lspd') {
                                    pmForumBaseUrl = 'https://lspd.gta.world';
                                    pmForumUser = process.env.FORUM_LSPD_USERNAME;
                                    pmForumPass = process.env.FORUM_LSPD_PASSWORD;
                                } else {
                                    pmForumBaseUrl = process.env.FORUM_BASE_URL || 'https://phmc.gta.world';
                                    pmForumUser = process.env.FORUM_USERNAME;
                                    pmForumPass = process.env.FORUM_PASSWORD;
                                }
                            }

                            try {
                                const isPmForumDelivery = isPrivateEntry && entry.pmForum && entry.pmRecipient && pmForumBaseUrl && pmForumUser && pmForumPass;
                                const isFormsDelivery = entry.formsAutopsy === true && !!entry.forumAccountUrl;

                                // Login to the target forum before composing the PM.
                                // The isolated client starts with no session cookies,
                                // so it must authenticate or phpBB will show the login page.
                                if (isPmForumDelivery || isFormsDelivery) {
                                    await dmClient.login(pmForumUser, pmForumPass, { force: false, baseUrl: pmForumBaseUrl });
                                } else {
                                    await dmClient.login(null, null, { force: false, baseUrl: process.env.FORUM_BASE_URL });
                                }

                                let dmTarget = '';
                                let dmBaseUrl = pmForumBaseUrl || process.env.FORUM_BASE_URL;

                                if (isFormsDelivery) {
                                    // Web "Request Autopsy" — resolve the requester's
                                    // forum account from the profile URL captured at
                                    // submission, so the completion PM reaches the real
                                    // requester instead of the bot (topic poster).
                                    const profUser = await dmClient.resolveProfileUsername(entry.forumAccountUrl);
                                    dmTarget = profUser || '';
                                    if (!dmTarget) console.warn(`[AUTO-COMPLETE] Forms DM target unresolvable for ${entry.forumAccountUrl}`);
                                    else console.log(`[AUTO-COMPLETE] Forms autopsy DM target: ${dmTarget} via ${dmBaseUrl}`);
                                } else if (isPmForumDelivery) {
                                    // Private case — DM the explicit forum recipient.
                                    dmTarget = entry.pmRecipient.trim();
                                    console.log(`[AUTO-COMPLETE] Private case DM target: ${dmTarget} via ${pmForumBaseUrl}`);
                                } else {
                                    // Resolve DM target from the forum topic poster FIRST.
                                    // `requesterName` is a character name from the form data (e.g.
                                    // "Cristian Fuentes") which is NOT the forum username. Only
                                    // use the topic poster's forum username for the PM.
                                    try {
                                        const forumUser = await client.getTopicPoster(entry.topicId, { baseUrl: process.env.FORUM_BASE_URL });
                                        dmTarget = forumUser || '';
                                    } catch (lookupErr) {
                                        console.warn('[AUTO-COMPLETE] Topic poster lookup failed: ' + lookupErr.message);
                                    }
                                    if (!dmTarget) {
                                        // Last resort: CASELINK [BOT] is the automated requester for
                                        // LSSD/LSPD cases. If the topic poster can't be resolved, DM
                                        // this account as a safe default so the completion report
                                        // still reaches the department's intake system.
                                        dmTarget = 'CASELINK [BOT]';
                                        console.warn('[AUTO-COMPLETE] Topic poster not found, using CASELINK [BOT] as fallback');
                                    }
                                }

                                if (!dmTarget || dmTarget === "Requesting Party" || dmTarget === 'PHMC Forms Bot') {
                                    await finishCompletionStep(key, 'dmSent', true, 'No valid DM target — skipped');
                                    await progress.addStep('DM Requester', 'skip', 'No valid target');
                                    return;
                                }
                                // CASELINK [Bot] only checks LSSD forums — DMs are redundant for automated requests
                                if (dmTarget === 'CASELINK [Bot]') {
                                    console.log("[AUTO-COMPLETE] CASELINK [Bot] target — DM skipped (they monitor LSSD forums directly)");
                                    await finishCompletionStep(key, 'dmSent', true, 'Automated request — DM not needed');
                                    await progress.addStep('DM Requester', 'skip', 'CASELINK monitors LSSD');
                                    return;
                                }
                                const dmSubject = buildDmSubject(entry);
                                // Shared-thread collection: ONE batched DM — every body
                                // with `--- BODY i/N ---` headers (chunked when over
                                // the 55k cap). Single-body path sends bbCode as before.
                                let dmPayloads = [bbCode];
                                if (sharedBatch && allCasesDone) {
                                    const batch = buildBatchedBodiesPayload(massCasesVal || {});
                                    dmPayloads = await chunkMassPayloadIfNeeded(batch.text);
                                    console.log("[AUTO-COMPLETE] Shared collection — batched DM (" + batch.count + " bodies, " + dmPayloads.length + " part(s)) to " + dmTarget + " (isolated client)");
                                } else {
                                    console.log("[AUTO-COMPLETE] Sending DM to " + dmTarget + " (isolated client)");
                                }
                                let r = { ok: false, reason: 'No payload' };
                                for (let pi = 0; pi < dmPayloads.length; pi++) {
                                    const partSubject = dmPayloads.length > 1 ? `${dmSubject} (${pi + 1}/${dmPayloads.length})` : dmSubject;
                                    r = await dmClient.sendPM(dmTarget, partSubject, dmPayloads[pi], { baseUrl: dmBaseUrl });
                                    if (!r.ok) break;
                                }
                                await finishCompletionStep(key, 'dmSent', r.ok, r.ok ? 'DM sent to ' + dmTarget : (r.reason || 'Unknown'));
                                await progress.addStep('DM Requester', r.ok ? 'ok' : 'fail', r.ok ? dmTarget : (r.reason || 'Failed'));
                                if (!r.ok) stepFailed.DM = true;
                            } catch (e) {
                                await finishCompletionStep(key, 'dmSent', false, e.message);
                                await progress.addStep('DM Requester', 'fail', e.message);
                                stepFailed.DM = true;
                            } finally {
                                // Close the isolated DM client's context. Leaving it open
                                // leaked a renderer process per autopsy completion — same
                                // fix as the LSSD client above.
                                try { await dmClient.close(); } catch { /* isolated DM client cleanup best-effort ignored: DM result already recorded */ }
                            }
                        })());

                        // Requester Discord notification (CASELINK requests only) — see
                        // services/requesterWebhook.js. Pings the officer when their numeric Discord
                        // ID resolves, else greets by name. A blank faction webhook var (DAO default)
                        // returns {skipped:true} and the step completes silently.
                        if (entry.postedByCaselink === true && !isPrivateEntry) {
                            await progress.addStep('Requester Discord Notification', 'pending');
                            stepPromises.push((async () => {
                                const stepName = 'requesterWebhook';
                                if (isMulti && !allCasesDone) {
                                    await startCompletionStep(key, stepName, 'Deferred — request has pending decedents');
                                    await finishCompletionStep(key, stepName, true, 'Deferred — not all decedent cases complete');
                                    await progress.addStep('Requester Discord Notification', 'ok', 'Deferred until all decedents complete');
                                    return;
                                }
                                await startCompletionStep(key, stepName, 'POST requester-completion webhook');
                                try {
                                    let agencyTopicUrlForButton = null;
                                    if (completionAgencyCfg) {
                                        const tid = entry[completionAgencyCfg.topicField];
                                        if (tid) agencyTopicUrlForButton = `${completionAgencyCfg.baseUrl}/viewtopic.php?t=${tid}`;
                                    }
                                    // Shared-thread collection: ONE webhook call per
                                    // collection with the combined case list (no
                                    // change needed in requesterWebhook.js — the
                                    // batch is expressed via caseNumber/caseTitle).
                                    let hookCaseNumber = caseRec?.caseNum ?? entry.caseNum ?? '';
                                    let hookCaseTitle = completedCaseTitle;
                                    let hookMeName = completingMe || '';
                                    if (sharedBatch && allCasesDone) {
                                        const sIdxs = Object.keys(massCasesVal || {}).filter((k) => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
                                        const caseNums = sIdxs.map((i) => massCasesVal[i]?.caseNum).filter(Boolean);
                                        const meNames = [...new Set(sIdxs.map((i) => massCasesVal[i]?.assignedTo).filter(Boolean))];
                                        hookCaseNumber = caseNums.join(', ');
                                        hookCaseTitle = `Mass Autopsy — ${sIdxs.length} bodies${caseNums.length ? ` (Cases ${caseNums.join(', ')})` : ''}`;
                                        if (meNames.length) hookMeName = meNames.join(', ');
                                        console.log(`[AUTO-COMPLETE] Shared collection — batched requester webhook (${sIdxs.length} bodies)`);
                                    }
                                    const res = await notifyRequesterOfCompletion(db, {
                                        ...entry,
                                        assignedTo: hookMeName || entry.assignedTo || '',
                                    }, {
                                        caseNumber: hookCaseNumber,
                                        caseTitle: hookCaseTitle,
                                        faction: completionFaction ? String(completionFaction).toUpperCase() : '',
                                        agencyTopicUrl: agencyTopicUrlForButton,
                                        meName: hookMeName || '',
                                    });
                                    const detail = res.ok
                                        ? (res.testMode ? `Sent [TEST -> ${res.target}]` : `Sent -> ${res.target}`)
                                        : (res.reason === 'test_url_missing' ? 'Test mode ON but TEST_URL empty'
                                            : res.skipped ? `Skipped — ${res.reason}` : (res.reason || 'Send failed'));
                                    const okFlag = !!res.ok;
                                    const skippedFlag = !okFlag && !!res.skipped;
                                    await finishCompletionStep(key, stepName, okFlag || skippedFlag, detail);
                                    await progress.addStep('Requester Discord Notification', okFlag ? 'ok' : (skippedFlag ? 'skip' : 'fail'), detail);
                                    if (!okFlag && !skippedFlag) stepFailed.REQUESTERWEBHOOK = true;
                                } catch (e) {
                                    await finishCompletionStep(key, stepName, false, e.message);
                                    await progress.addStep('Requester Discord Notification', 'fail', e.message);
                                    stepFailed.REQUESTERWEBHOOK = true;
                                }
                            })());
                        } else {
                            const skipWhy = isPrivateEntry ? 'Private case' : 'Not a CASELINK request';
                            await finishCompletionStep(key, 'requesterWebhook', true, `${skipWhy} — webhook skipped`);
                            await progress.addStep('Requester Discord Notification', 'skip', skipWhy);
                        }

// Wait for all completion steps, then finalize
                        const results = await Promise.allSettled(stepPromises);
                        const anyFailed = Object.keys(stepFailed).length > 0;
                        if (anyFailed) {
                            const failedList = Object.keys(stepFailed).join(', ');
                            await progress.addStep('Retry Scheduled', 'warn', `${failedList} — will auto-retry on next cycle`);
                        }
                        await progress.finalize(anyFailed ? 'failed' : 'complete');
                        // Flip the single-V2 assignment panel (if one was posted)
                        // to its basic completed summary — best-effort, never
                        // disturbs the completion itself. Reads Firebase truth
                        // so undelivered sends render as pending, not asserted.
                        try {
                            const { completeSinglePanel } = await import('./singlePanelV2.js');
                            await completeSinglePanel(db, state.discordClient, { requestTopicId: key, caseIdx }).catch(() => {});
                        } catch { /* panel flip best-effort ignored: completion itself already persisted */ }
                    }

            } catch (e) { console.warn("[AUTO] Completion marker error:", e.message); }
            // LSSD/LSPD cross-posts are handled as completion steps above.
        } else {
                await logStep(' Autopsy Posted But Status Update Failed', `Reply was posted at [View Reply](<${result.url}>) but the Firebase status update did not verify.`, { color: 0xffc107, isFinal: true });
            await progress.addStep('Status Update Failed', 'fail', result.url || '');
            await progress.finalize('failed');
        }
    } else if (result.dryRun) {
            await setDeployStatus(db, authorId, key, 'dry_run', `Form filled for case #${topicId} but NOT submitted. Set AUTOPSY_DRY_RUN=false to enable.`);
            console.log(`[AUTO]  Dry run  form filled for case #${topicId}`);
            await progress.addStep('Dry Run Complete', 'ok', `#${topicId} ${foundTitle}`);
            await progress.finalize('complete');
        } else {
            console.error(`[AUTO]  Failed to reply to case #${topicId}: ${result.reason || 'Unknown'}`);
            await progress.addStep('Reply Failed', 'fail', result.reason || 'Unknown');
            await progress.finalize('failed');
            const e = new Error(`Failed to reply to case #${topicId}: ${result.reason || 'Unknown error replying to case thread'}`);
            e.code = 'RETRYABLE';
            throw e;
        }
    }

/**
 * On startup, retry autopsy completion steps left in "failed" state
 * from a previous bot session. Uses two-phase tracking to safely
 * handle ambiguity:
 *
 *   "failed"     → operation genuinely threw → auto-retry
 *   "attempting" → bot crashed mid-op → skip (prevents duplicates)
 *   "completed"  → already done → skip
 *
 * Retries re-post forum replies (COMPLETION_TEMPLATE) and re-send DMs
 * (using stored completedBbCode from Firebase).
 */
export async function retryFailedCompletionSteps(db, { entries } = {}) {
    logFnCall('autoDeploy', 'retryFailedCompletionSteps', 'Scanning for failed completion steps to retry');

    // Respect maintenance mode — skip retries during an outage
    if (await isMaintenanceMode().catch(() => false)) {
        console.log('[AUTO]  maintenance mode — skipping completion-step retry scan');
        return;
    }

    const COOLDOWN_MS = 30 * 60 * 1000; // skip steps retried within the last 30 min
    try {
        // Single shared marker read: the tiny completionStepRetries index names
        // every known failed step, so fetch ONLY those entries — never the full
        // node. Both the scan below and the merge reuse this one read.
        // (Startup reseeds markers from the monitor snapshot; finishCompletionStep
        // + the retry tail below keep them live. A missing marker with a failed
        // step self-heals on the next restart reseed.)
        let markers = {};
        try {
            const mSnap = await db.ref(STEP_RETRY_PATH).once('value');
            markers = mSnap.exists() ? mSnap.val() || {} : {};
        } catch { markers = {}; }
        if (entries === undefined) {
            // Marker-driven scan: fetch ONLY the marker-listed entries.
            const markerKeys = Object.keys(markers);
            if (markerKeys.length === 0) return; // nothing failed — zero entry reads
            entries = {};
            for (const topicId of markerKeys) {
                try {
                    const eSnap = await db.ref(`autopsy-requested/${topicId}`).once('value');
                    if (eSnap.exists()) {
                        entries[topicId] = eSnap.val() || {};
                    } else {
                        // Stale markers — entry gone, drop them.
                        for (const s of Object.keys(markers[topicId] || {})) clearStepRetry(topicId, s);
                    }
                } catch { /* keep markers for the next sweep */ }
            }
            // Drop markers whose steps are no longer failed (manually fixed or
            // resolved out-of-band) so the index can't go stale.
            for (const [topicId, entry] of Object.entries(entries)) {
                for (const s of Object.keys(markers[topicId] || {})) {
                    const st = entry?.completionSteps?.[s]?.status;
                    if (!st || st === 'completed') clearStepRetry(topicId, s);
                }
            }
        }
        // Merge marker-listed entries the caller didn't include. The heartbeat
        // passes an INCOMPLETE-only snapshot, so failed steps on completed
        // cases (e.g. a DM send that failed after the case was marked
        // completed) would otherwise never be retried despite having markers.
        // Reuses the shared marker read above (best-effort).
        try {
            entries = entries || {};
            for (const topicId of Object.keys(markers)) {
                if (entries[topicId]) continue;
                try {
                    const eSnap = await db.ref(`autopsy-requested/${topicId}`).once('value');
                    if (eSnap.exists()) {
                        entries[topicId] = eSnap.val() || {};
                    } else {
                        for (const s of Object.keys(markers[topicId] || {})) clearStepRetry(topicId, s);
                    }
                } catch { /* keep markers for the next sweep */ }
            }
        } catch { /* marker merge best-effort */ }
        if (Object.keys(entries).length === 0) return;

        const failedEntries = [];
        let attemptingCount = 0;

        for (const [key, entry] of Object.entries(entries)) {
            if (!entry) continue;
            const steps = entry.completionSteps;
            if (!steps) continue;

            const caseLabel = `"${entry.name || entry.oocName || 'Unknown'}" (#${key})`;

            for (const [stepName, stepData] of Object.entries(steps)) {
                if (stepData?.status === 'failed') {
                    // Cooldown: skip steps retried within the last 30 min so a persistently
                    // stuck step doesn't spam the sweep (now running every 10 min).
                    if (stepData.retriedAt && (Date.now() - new Date(stepData.retriedAt).getTime()) < COOLDOWN_MS) {
                        console.log(`[AUTO-COMPLETE] ${stepName} for ${caseLabel} — retried <30 min ago, cooling down`);
                        continue;
                    }
                    failedEntries.push({ key, entry, stepName, stepData, caseLabel });
                    console.warn(`[AUTO-COMPLETE] FAILED ${stepName} for ${caseLabel}: ${stepData.detail || 'No details'}`);
                } else if (stepData?.status === 'attempting') {
                    attemptingCount++;
                    console.warn(`[AUTO-COMPLETE] ATTEMPTING (crash mid-op) ${stepName} for ${caseLabel} — ${stepData.detail || ''} — SKIPPING to avoid duplicate. Check manually if needed.`);
                }
            }
        }

        if (failedEntries.length === 0) {
            if (attemptingCount > 0) {
                sendWebhook(null, {
                    title: '[WARN] Autopsy — Ambiguous Steps (skipped)',
                    description: `${attemptingCount} step(s) left in "attempting" state (bot crash mid-operation). Skipped to avoid duplicate posts. If replies/DMs didn't go through, use the manual retry command.`,
                    color: 0xffc107,
                    footer: { text: 'PHMC Bot — Recovery Sweep' },
                });
            }
            return;
        }

        // ── Initialize a forum client for retries ──
        let retryClient;
        try {
            retryClient = getForumClient();
            await retryClient.login(null, null, { force: false, baseUrl: process.env.FORUM_BASE_URL });
        } catch (e) {
            console.error(`[AUTO-COMPLETE] Failed to init forum client for retries: ${e.message}`);
            sendWebhook(null, {
                title: '[ERR] Autopsy Retry Failed — No Forum Client',
                description: `Could not init forum client to retry ${failedEntries.length} failed step(s). Check PM2 logs and forum credentials.`,
                color: 0xdc3545,
                footer: { text: 'PHMC Bot — Recovery Sweep' },
            });
            return;
        }

        let retried = 0;
        let stillFailed = 0;

        for (const { key, entry, stepName, stepData, caseLabel } of failedEntries) {
            console.log(`[AUTO-COMPLETE] Retrying ${stepName} for ${caseLabel}...`);

            // Mass-collection gating: partial collections never emit premature
            // singles — collection-level steps retry only when every body is
            // done. Markers are kept so the next sweep picks them up.
            const retryShared = isSharedThreadCollection(entry);
            const retryAllDone = collectionCasesDone(entry);
            if (retryShared && !retryAllDone && (stepName === 'phmcCompletionReply' || stepName === 'dmSent' || stepName === 'requesterWebhook' || stepName === 'lssdCombinedReply' || stepName === 'lspdCrosspost')) {
                console.log(`[AUTO-COMPLETE] ${stepName} for ${caseLabel} — collection partial, deferring (no premature single)`);
                continue;
            }
            // ONE batched payload source for completed-collection retries.
            const retryBatch = (retryShared && retryAllDone) ? buildBatchedBodiesPayload(entry.cases || {}) : null;

            // Private cases never crosspost to LSPD/LSSD — mark crosspost steps as resolved.
            if (entry.isPrivate === true && (stepName === 'lssdCombinedReply' || stepName === 'lssdCompletionReply'
                || stepName === 'lssdAutopsyReport' || stepName === 'lspdCrosspost')) {
                console.log(`[AUTO-COMPLETE] [OK] ${stepName} for ${caseLabel} — private case, crosspost skipped`);
                await finishCompletionStep(key, stepName, true, 'Private case — crosspost skipped');
                continue;
            }

            try {
                const requesterName = entry.parsed?.requesterName || 'Requesting Party';
                const caseTitle = entry.caseUrl || entry.title || 'Autopsy Case';
                const retryFaction = entry.isPrivate === true
                    ? 'private'
                    : (String(entry.faction || '').toLowerCase()
                        || (/\[(lssd|lspd|sadcr|dao)\]/i.exec(entry.title || '') || [])[1]?.toLowerCase()
                        || null);
                const retryLspdUrl = entry.lspdTopicId ? `https://lspd.gta.world/viewtopic.php?t=${entry.lspdTopicId}` : null;
                // Faction-prefixed completion URL (lssdCompletionUrl legacy key for LSSD;
                // sadcrCompletionUrl / daoCompletionUrl for the newer registry factions).
                const retryAgencyCfg = isAgencyFaction(retryFaction) ? getAgencyForum(retryFaction) : null;
                const retryFx = retryAgencyCfg ? String(retryFaction).toLowerCase() : 'lssd';
                const completionBb = buildCompletionBb(caseTitle, requesterName, { faction: retryFaction, lssdUrl: entry[`${retryFx}CompletionUrl`], lspdUrl: retryLspdUrl, formsAutopsy: entry.formsAutopsy });

                let success = false;

                if (stepName === 'phmcCompletionReply') {
                    if (!entry.topicId) {
                        console.warn(`[AUTO-COMPLETE] Cannot retry ${stepName} for ${caseLabel}: no topicId`);
                        stillFailed++;
                        continue;
                    }
                    // Shared-thread collection: single default completion notice
                    // on retry (no per-body repetition, no report links).
                    // Edit-in-place only for the single-part case.
                    let retryPhmcPayloads = [completionBb];
                    if (retryBatch) {
                        console.log(`[AUTO-COMPLETE] Shared collection — single completion notice retry`);
                    }
                    // Edit-in-place when this completion reply already exists
                    // (prior run posted but the step stayed failed).
                    let r = null;
                    let rFirst = null;
                    for (let pi = 0; pi < retryPhmcPayloads.length; pi++) {
                        r = retryPhmcPayloads.length === 1
                            ? await postOrEditReply(retryClient, {
                                topicId: entry.topicId,
                                forumId: AUTOPSY_REQUEST_FORUM_ID,
                                bbCode: retryPhmcPayloads[pi],
                                existingPostId: entry.phmcCompletionReplyPostId || null,
                                logTag: 'PHMC-COMPLETION-RETRY',
                            })
                            : await retryClient.replyToTopic(entry.topicId, AUTOPSY_REQUEST_FORUM_ID, retryPhmcPayloads[pi], { dryRun: false });
                        if (!rFirst) rFirst = r;
                        if (!r.ok) break;
                    }
                    r = r || { ok: false, reason: 'No payload' };
                    success = r.ok || r.topicMissing === true;
                    if (success) {
                        console.log(r.topicMissing
                            ? `[AUTO-COMPLETE] [OK] Retry OK — ${stepName} for ${caseLabel}: request topic no longer exists (nothing to reply to)`
                            : `[AUTO-COMPLETE] [OK] Retry OK — ${stepName} for ${caseLabel} → ${r.edited ? 'edited reply' : 'reply'} to #${entry.topicId}`);
                        if (r.ok && (rFirst || r).postId && state.dbRef) {
                            await state.dbRef.child(`autopsy-requested/${key}`).update({
                                phmcCompletionReplyPostId: (rFirst || r).postId,
                                phmcCompletionReplyUrl: (rFirst || r).url || null,
                            }).catch(() => {});
                        }
                    } else {
                        console.warn(`[AUTO-COMPLETE] [ERR] Retry failed — ${stepName} for ${caseLabel}: ${r.reason || 'Unknown'}`);
                    }

                } else if (stepName === 'lssdCombinedReply') {
                    // Registry-faction branch — LSSD keeps legacy keys; SADCR/DAO resolve
                    // their own subforum/topic-field via the agencyForums registry.
                    const rCfg = isAgencyFaction(retryFaction) ? getAgencyForum(retryFaction)
                        : null;
                    const rFx = rCfg ? String(retryFaction).toLowerCase() : 'lssd';
                    const lssdTopicId = rCfg ? entry[rCfg.topicField] : '';
                    if (!lssdTopicId) {
                        console.log(`[AUTO-COMPLETE] [OK] Retry OK — ${stepName} for ${caseLabel}: not a registry-agency case`);
                        success = true;
                    } else {
                        // Shared-thread collection: ONE batched payload on retry.
                        const reportBb = retryBatch ? retryBatch.text : (entry.completedBbCode || '');
                        if (!reportBb) {
                            console.warn(`[AUTO-COMPLETE] Cannot retry ${stepName} for ${caseLabel}: no completedBbCode`);
                            // Mark as resolved — can't retry without the report content
                            success = true;
                        } else {
                            await retryClient.login(process.env[`FORUM_${rCfg.credPrefix}_USERNAME`], process.env[`FORUM_${rCfg.credPrefix}_PASSWORD`], { force: false, baseUrl: rCfg.baseUrl });
                            const content = completionBb + '\n\n[hr][/hr]\n\n' + reportBb;
                            console.log(`[AUTO-COMPLETE] Retrying ${rCfg === getAgencyForum('LSSD') ? 'LSSD' : String(retryFaction).toUpperCase()} completion + report to #${lssdTopicId}...`);
                            const agencyRetryParts = await chunkMassPayloadIfNeeded(content);
                            let r = null;
                            let rFirst = null;
                            for (let pi = 0; pi < agencyRetryParts.length; pi++) {
                                r = await postOrEditReply(retryClient, {
                                    topicId: lssdTopicId,
                                    forumId: rCfg.forumId,
                                    bbCode: agencyRetryParts[pi],
                                    baseUrl: rCfg.baseUrl,
                                    existingPostId: agencyRetryParts.length === 1 ? (entry[`${rFx}CrosspostReplyPostId`] || null) : null,
                                    logTag: `${String(retryFaction).toUpperCase()}-CROSSPOST-RETRY${agencyRetryParts.length > 1 ? `-P${pi + 1}` : ''}`,
                                });
                                if (!rFirst) rFirst = r;
                                if (!r.ok) break;
                            }
                            r = r || { ok: false, reason: 'No payload' };
                            success = r.ok;
                            console.log(`[AUTO-COMPLETE] Agency completion + report retry — ${r.ok ? (r.edited ? 'EDITED' : 'OK') : 'FAILED: ' + (r.reason || 'Unknown')}`);
                            if (r.ok && (rFirst || r).url && state.dbRef) {
                                await state.dbRef.child(`autopsy-requested/${key}`).update({
                                    [`${rFx}CompletionUrl`]: (rFirst || r).url,
                                    ...((rFirst || r).postId ? { [`${rFx}CrosspostReplyPostId`]: (rFirst || r).postId, [`${rFx}CrosspostReplyUrl`]: (rFirst || r).url } : {}),
                                }).catch(() => {});
                            }
                        }
                    }

                } else if (stepName === 'requesterWebhook') {
                    // Stateless resend from entry fields — notifyRequesterOfCompletion
                    // self-resolves faction topic deep-link, ME ping and requester tag.
                    // Worst case (crash after send) is one duplicate message, the same
                    // accepted trade-off as every other completion-step retry.
                    try {
                        // Shared-thread collection: ONE webhook call per
                        // collection with the combined case list.
                        let hookCaseNumber = entry.caseNum ?? '';
                        let hookCaseTitle = entry.caseTitle || entry.title || '';
                        let hookMeName = entry.assignedTo || '';
                        if (retryBatch) {
                            const sIdxs = Object.keys(entry.cases || {}).filter((k) => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
                            const caseNums = sIdxs.map((i) => entry.cases[i]?.caseNum).filter(Boolean);
                            const meNames = [...new Set(sIdxs.map((i) => entry.cases[i]?.assignedTo).filter(Boolean))];
                            hookCaseNumber = caseNums.join(', ');
                            hookCaseTitle = `Mass Autopsy — ${sIdxs.length} bodies${caseNums.length ? ` (Cases ${caseNums.join(', ')})` : ''}`;
                            if (meNames.length) hookMeName = meNames.join(', ');
                        }
                        const res = await notifyRequesterOfCompletion(db, entry, {
                            caseNumber: hookCaseNumber,
                            caseTitle: hookCaseTitle,
                            faction: entry.faction ? String(entry.faction).toUpperCase() : '',
                            meName: hookMeName,
                        });
                        success = !!res.ok || !!res.skipped;
                        if (!success) console.warn(`[AUTO-COMPLETE] Requester webhook retry failed: ${res.reason || 'Send failed'}`);
                        else console.log(`[AUTO-COMPLETE] [OK] Retry OK — requesterWebhook for ${caseLabel}${res.testMode ? ` [TEST -> ${res.target}]` : ` -> ${res.target}`}`);
                    } catch (e) {
                        console.error(`[AUTO-COMPLETE] Requester webhook retry error for ${caseLabel}: ${e.message}`);
                        success = false;
                    }

                } else if (stepName === 'lssdCompletionReply' || stepName === 'lssdAutopsyReport') {
                    // Legacy steps — entries completed before the combined-reply change.
                    const lssdTopicId = entry.lssdRequestTopicId;
                    if (!lssdTopicId) {
                        console.log(`[AUTO-COMPLETE] [OK] Retry OK — ${stepName} for ${caseLabel}: not an LSSD case`);
                        success = true;
                    } else {
                        await retryClient.login(process.env.FORUM_LSSD_USERNAME, process.env.FORUM_LSSD_PASSWORD, { force: false, baseUrl: 'https://lssd.gta.world' });
                        const isReport = stepName === 'lssdAutopsyReport';
                        const content = isReport ? (entry.completedBbCode || '') : completionBb;
                        const label = isReport ? 'autopsy report' : 'confirmation reply';
                        if (isReport && !content) {
                            console.warn(`[AUTO-COMPLETE] Cannot retry ${stepName} for ${caseLabel}: no completedBbCode`);
                            // Mark as resolved — can't retry without the report content
                            success = true;
                        } else {
                            console.log(`[AUTO-COMPLETE] Retrying LSSD ${label} to #${lssdTopicId}...`);
                            const r = await retryClient.replyToTopic(lssdTopicId, 2263, content, { dryRun: false, baseUrl: 'https://lssd.gta.world' });
                            success = r.ok;
                            console.log(`[AUTO-COMPLETE] LSSD ${label} retry — ${r.ok ? 'OK' : 'FAILED: ' + (r.reason || 'Unknown')}`);
                        }
                    }

                } else if (stepName === 'lspdCrosspost') {
                    const lspdTopicId = entry.lspdTopicId;
                    if (!lspdTopicId) {
                        console.log(`[AUTO-COMPLETE] [OK] Retry OK — ${stepName} for ${caseLabel}: not an LSPD case`);
                        success = true;
                    } else {
                        // Shared-thread collection: ONE batched payload on retry.
                        const bbCodeToSend = retryBatch ? retryBatch.text : (entry.completedBbCode || '');
                        if (!bbCodeToSend) {
                            console.warn(`[AUTO-COMPLETE] Cannot retry ${stepName} for ${caseLabel}: no completedBbCode`);
                            stillFailed++;
                            continue;
                        }
                        console.log(`[AUTO-COMPLETE] Retrying LSPD crosspost to #${lspdTopicId}...`);
                        await retryClient.login(process.env.FORUM_LSPD_USERNAME, process.env.FORUM_LSPD_PASSWORD, { force: false, baseUrl: 'https://lspd.gta.world' });
                        const r = await retryClient.replyToTopic(lspdTopicId, 1361, bbCodeToSend, { dryRun: false, baseUrl: 'https://lspd.gta.world' });
                        success = r.ok;
                        console.log(`[AUTO-COMPLETE] LSPD crosspost retry — ${r.ok ? 'OK' : 'FAILED: ' + (r.reason || 'Unknown')}`);
                    }

                } else if (stepName === 'dmSent') {
                    // Shared-thread collection: ONE batched DM on retry.
                    const bbCodeToSend = retryBatch ? retryBatch.text : entry.completedBbCode;
                    if (!bbCodeToSend) {
                        console.warn(`[AUTO-COMPLETE] Cannot retry ${stepName} for ${caseLabel}: no completedBbCode stored`);
                        stillFailed++;
                        continue;
                    }
                    // Private cases with pm_forum: DM the configured recipient on that forum.
                    let dmTarget = '';
                    let dmBaseUrl = process.env.FORUM_BASE_URL;
                    if (entry.isPrivate === true && entry.pmForum && entry.pmRecipient) {
                        dmTarget = entry.pmRecipient.trim();
                        const forumKey = String(entry.pmForum).toLowerCase();
                        if (forumKey === 'lssd') {
                            dmBaseUrl = 'https://lssd.gta.world';
                            await retryClient.login(process.env.FORUM_LSSD_USERNAME, process.env.FORUM_LSSD_PASSWORD, { force: false, baseUrl: dmBaseUrl });
                        } else if (forumKey === 'lspd') {
                            dmBaseUrl = 'https://lspd.gta.world';
                            await retryClient.login(process.env.FORUM_LSPD_USERNAME, process.env.FORUM_LSPD_PASSWORD, { force: false, baseUrl: dmBaseUrl });
                        } else {
                            await retryClient.login(null, null, { force: false, baseUrl: dmBaseUrl });
                        }
                        console.log(`[AUTO-COMPLETE] Private case retry DM target: ${dmTarget} via ${dmBaseUrl}`);
                    } else if (entry.formsAutopsy === true && entry.forumAccountUrl) {
                        // Web "Request Autopsy" — deliver to the requester's forum
                        // account captured at submission (agencyForum + profile URL).
                        const fKey = String(entry.agencyForum || 'phmc').toLowerCase();
                        if (fKey === 'lssd' || fKey === 'sadcr' || fKey === 'dao') {
                            dmBaseUrl = 'https://lssd.gta.world';
                            await retryClient.login(process.env.FORUM_LSSD_USERNAME, process.env.FORUM_LSSD_PASSWORD, { force: false, baseUrl: dmBaseUrl });
                        } else if (fKey === 'lspd') {
                            dmBaseUrl = 'https://lspd.gta.world';
                            await retryClient.login(process.env.FORUM_LSPD_USERNAME, process.env.FORUM_LSPD_PASSWORD, { force: false, baseUrl: dmBaseUrl });
                        } else {
                            await retryClient.login(null, null, { force: false, baseUrl: dmBaseUrl });
                        }
                        const profUser = await retryClient.resolveProfileUsername(entry.forumAccountUrl).catch(() => null);
                        dmTarget = profUser || '';
                        console.log(`[AUTO-COMPLETE] Forms autopsy retry DM target: ${dmTarget || '(unresolved)'} via ${dmBaseUrl}`);
                    } else {
                        // Use topic poster FIRST (forum username), not requesterName
                        // which is a character name like "Cristian Fuentes" that won't work as a PM target.
                        try {
                            const forumUser = await retryClient.getTopicPoster(entry.topicId, { baseUrl: process.env.FORUM_BASE_URL });
                            dmTarget = forumUser || '';
                        } catch (lookupErr) {
                            console.warn('[AUTO-COMPLETE] Topic poster lookup failed during retry: ' + lookupErr.message);
                        }
                        if (!dmTarget) {
                            dmTarget = 'CASELINK [BOT]';
                            console.warn('[AUTO-COMPLETE] Topic poster not found during retry, using CASELINK [BOT] as fallback');
                        }
                    }
                    if (!dmTarget || dmTarget === 'Requesting Party' || dmTarget === 'PHMC Forms Bot') {
                        console.log(`[AUTO-COMPLETE] ${stepName} for ${caseLabel}: no valid DM target`);
                        success = true;
                    } else if (dmTarget === 'CASELINK [Bot]') {
                        console.log(`[AUTO-COMPLETE] ${stepName} for ${caseLabel}: CASELINK [Bot] — DM skipped (they monitor LSSD forums)`);
                        success = true;
                    } else {
                        const dmSubject = buildDmSubject(entry);
                        const dmRetryParts = retryBatch ? await chunkMassPayloadIfNeeded(bbCodeToSend) : [bbCodeToSend];
                        let r = { ok: false, reason: 'No payload' };
                        for (let pi = 0; pi < dmRetryParts.length; pi++) {
                            const partSubject = dmRetryParts.length > 1 ? `${dmSubject} (${pi + 1}/${dmRetryParts.length})` : dmSubject;
                            r = await retryClient.sendPM(dmTarget, partSubject, dmRetryParts[pi], { baseUrl: dmBaseUrl });
                            if (!r.ok) break;
                        }
                        success = r.ok;
                        if (success) console.log(`[AUTO-COMPLETE] [OK] Retry OK — ${stepName} for ${caseLabel} → DM to ${dmTarget}`);
                        else console.warn(`[AUTO-COMPLETE] [ERR] Retry failed — ${stepName} for ${caseLabel}: ${r.reason || 'Unknown'}`);
                    }

                } else {
                    console.warn(`[AUTO-COMPLETE] Unknown step "${stepName}" for ${caseLabel} — skipped`);
                    stillFailed++;
                    continue;
                }

                // Update Firebase status
                if (key && state.dbRef) {
                    await state.dbRef
                        .child(`autopsy-requested/${key}/completionSteps/${stepName}`)
                        .set({
                            status: success ? 'completed' : 'failed',
                            updatedAt: new Date().toISOString(),
                            detail: success
                                ? `Retried on restart — OK`
                                : (stepData.detail || 'Retry failed'),
                            retriedAt: new Date().toISOString(),
                        });
                    // Keep the tiny retry index in sync (see STEP_RETRY_PATH).
                    if (success) clearStepRetry(key, stepName);
                    else markStepRetry(key, stepName, stepData.detail || 'Retry failed');
                }

                if (success) {
                    retried++;
                    notifySelfHeal(key, `${stepName} failed`, 'Completion step retried OK');
                } else {
                    stillFailed++;
                    notifySelfHeal(key, `${stepName} failed`, 'Retry FAILED - will retry next sweep');
                }
            } catch (e) {
                console.error(`[AUTO-COMPLETE] Retry error for ${stepName} of ${caseLabel}: ${e.message}`);
                stillFailed++;
                notifySelfHeal(key, `${stepName} failed`, `ERROR: ${e.message}`);
            }
        }

        // Cleanup
        try { await retryClient.close(); } catch (e) { /* ignore */ }

        // ── Summary webhook ──
        if (stillFailed === 0) {
            sendWebhook(null, {
                title: '[OK] Autopsy Completion Retry — All Resolved',
                description: `Successfully retried ${retried}/${failedEntries.length} failed step(s) from the previous session.`,
                color: 0x28a745,
                footer: { text: 'PHMC Bot — Recovery Sweep' },
            });
        } else {
            // Build a fresh list of what's still failed from Firebase
            let remaining = [];
            for (const f of failedEntries) {
                try {
                    const s = await db.ref(`autopsy-requested/${f.key}/completionSteps/${f.stepName}`).once('value');
                    if (s.exists() && s.val()?.status === 'failed') {
                        remaining.push(`• **${f.stepName}** for ${f.caseLabel}: ${f.stepData.detail || 'No details'}`);
                    }
                } catch (e) {
                    remaining.push(`• **${f.stepName}** for ${f.caseLabel}: (unable to check status)`);
                }
            }
            sendWebhook(null, {
                title: `[WARN] Autopsy Completion Retry — ${stillFailed} Still Failed`,
                description: `${retried} succeeded, ${stillFailed} still failed.\n\n**Remaining failures:**\n${remaining.join('\n') || 'None'}\n\nCheck PM2 logs for details.`,
                color: 0xffc107,
                footer: { text: 'PHMC Bot — Recovery Sweep' },
            });
        }

    } catch (err) {
        console.error('[AUTO-COMPLETE] Completion step retry scan error:', err.message);
        sendWebhook(null, {
            title: '[ERR] Autopsy Retry Scan Failed',
            description: `Error during retry scan: ${err.message}`,
            color: 0xdc3545,
            footer: { text: 'PHMC Bot — Recovery Sweep' },
        });
    }
}
