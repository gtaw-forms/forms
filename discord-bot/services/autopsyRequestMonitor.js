/**
 * Autopsy Request Monitor — periodically checks PHMC Forum f=265
 * for new Autopsy / Death Certificate Requests, logs them to Firebase,
 * maintains faction counters, and sends Discord notifications.
 *
 * Title format:  Autopsy Request - Character Name ((Player Name)) - [LSPD]
 * Faction identifiers: LSPD, LSSD
 *
 * Firestore paths:
 *   autopsy-requested/<topicId>  — { title, name, oocName, faction, topicUrl, topicId, detectedAt }
 *   autopsy-requests/<faction>/count  — incrementing counter
 *
 * Wired into index.js on bot startup.
 */

import firebase from './firebase.js';
import { getForumClient } from './forumClient.js';
import { searchLssdRequestTopic } from './deployLssd.js';
import { getAgencyForum, isAgencyFaction } from './agencyForums.js';
import { sendLogMessage, notifySelfHeal } from './logChannel.js';
import { selectME, selectMEsForMass, initializeRotationFromGroup, syncRotationFromGroup, getDevTestME, isDevTestActive } from './autopsyRotation.js';
import { TERMINAL_STATES } from './outstandingAutopsies.js';
import { DeployProgressEmbed } from './deployLogger.js';
import { state as deployState } from './deployState.js';
import { registerTick, unregisterTick } from './scheduler.js';

// ── Optional 55k-char chunk fallback (massPostChunker.js, Task 6) ──
// ESM-only module — resolved lazily via dynamic import (a static require()
// would throw ERR_REQUIRE_ESM / ReferenceError and leave the chunk path dead).
let massChunkerFn = null;
let massChunkerResolved = false;
async function getMassChunker() {
    if (massChunkerResolved) return massChunkerFn;
    massChunkerResolved = true;
    try {
        const mod = await import('./massPostChunker.js');
        const fn = mod.splitAtBodyBoundaries || mod.chunkBbCode || mod.chunkMassPost || mod.chunk || mod.split || mod.default;
        if (typeof fn === 'function') massChunkerFn = fn;
    } catch { /* module absent — single-post fallback */ }
    return massChunkerFn;
}

// ── Constants ──

const PHMC_FORUM_ID = 265;
const PHMC_BASE = 'https://phmc.gta.world';
const LSSD_BASE = 'https://lssd.gta.world';
const CHECK_INTERVAL_MS = parseInt(process.env.AUTOPSY_MONITOR_INTERVAL || '', 10) || 15 * 60 * 1000;

// Ack status field names in Firebase. Kebab-case for visibility when browsing
// the DB — used by the ack step here and by the auto-recovery retry in autoDeploy.js.
export const ACK_FIELD_NAMES = {
    phmc: 'phmc-acknowledge-reply',
    lssd: 'lssd-acknowledge-reply',
    lspd: 'lspd-acknowledge-reply',
    sadcr: 'sadcr-acknowledge-reply',
    dao: 'dao-acknowledge-reply',
};

// ── Case lifecycle states (`caseState` on autopsy-requested/<topicId>) ──
// 'complete' means the INTAKE pipeline finished (case file created, ME
// assigned, acks/crossposts done, counters updated — Step 4). It does NOT mean
// the autopsy was performed; a finished examination is marked by `completedAt`
// + `completedBbCode` on the entry. Readers keying on the literal 'complete':
// the monitor skip-guard, systemMonitor FINAL_STATES, autopsy-stats, and the
// force-lssd gate — do not rename the value without migrating existing RTDB
// records, or old entries will re-enter intake (duplicate case files + pings).
//   case_created → me_assigned → ack_sent → complete
//   dry_run (AUTOPSY_DRY_RUN) · multi (multi-decedent parent) · skipped
//   (systemMonitor FINAL_STATES additionally reserves cancelled/denied)
export const CASE_STATES = {
    CASE_CREATED: 'case_created',
    ME_ASSIGNED: 'me_assigned',
    ACK_SENT: 'ack_sent',
    COMPLETE: 'complete',
    DRY_RUN: 'dry_run',
    MULTI: 'multi',
    SKIPPED: 'skipped',
};

// Autopsy Request - Name ((OOC Name)) - [LSPD/LSSD]  OR  [Autopsy Request] Name [Faction]
// Supports: various dash chars, with/without brackets, with/without ((OOC)).
// Faction tags now include SADCR and DAO (their requests previously fell into
// the body-fallback path with an empty faction).
// The name group is a non-empty string WITHOUT parens, so it stops at the first
// ((...)) pair. Extra ((...)) groups (e.g. "((Discord Name: ...))") after the
// OOC are skipped by (?:\(\([^)]*\)\)[\s\S]*?)? before the faction tag.
const TITLE_REGEX = /^(?:\[)?Autopsy\s+Request(?:\])?\s*[-–—]?\s*([^()[\]"']+)(?:\s*\(\(([^()]*)\)\))?[\s\S]*?\[?(LSPD|LSSD|SADCR|DAO)\]?/i;

/**
 * Map a free-text "Department / Assignment" value onto a faction key.
 * Order matters — check the specific agencies before the broad LSSD keyword
 * (SADCR/DAO forums physically live on the lssd domain but are NOT LSSD).
 * @param {string} deptRaw
 * @returns {string} 'LSSD' | 'LSPD' | 'SADCR' | 'DAO' | ''
 */
function factionFromDept(deptRaw) {
    const d = String(deptRaw || '').toLowerCase();
    if (/\bdistrict\s+attorney\b|\bdao\b/.test(d)) return 'DAO';
    if (/\bsadcr\b|\bcorrections\b/.test(d)) return 'SADCR';
    if (/lssd|sheriff|lasd/.test(d)) return 'LSSD';
    if (/lspd|\bpolice\b/.test(d)) return 'LSPD';
    return '';
}

// ── State ──

let _monitorTimer = null;
let _db = null;
let _isFirstCycle = true;
let _lastCheckTime = null;
let _lastCheckSuccess = false;

// ── Discord Notification ──

/**
 * Send a notification embed to the log channel.
 */
async function sendNotification(title, description, color = 0x00bcd4) {
    try {
        await sendLogMessage(null, {
            title,
            description,
            color,
            footer: { text: 'PHMC Bot — Autopsy Monitor' },
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        console.error('[AUTOPSY-MON] Failed to send notification:', err.message);
    }
}

/**
 * Send a notification to bot-spam channel via sendLogMessage.
 */
async function sendWebhookSummary(message) {
    try {
        await sendLogMessage(message, null);
    } catch (err) {
        console.error('[AUTOPSY-MON] Failed to send notification:', err.message);
    }
}

// ── Single Live Progress Embed Per Request ──

// In-memory progress instances, keyed by request topicId. Survives across
// monitor cycles so the state machine resumes the SAME embed without re-reading
// Firebase; after a restart, the persisted progressMessageId + progressSteps
// (preserved on the entry by the caller) restore the embed's full history.
const _progressCache = new Map();

class AutopsyProgress {
    constructor(db, topicId) {
        this.db = db;
        this.topicId = topicId;
        this.embed = null;
        this.failed = false;
        this.steps = [];
    }

    /**
     * Start (or resume) the single live-updating embed for this request.
     * @returns {Promise<boolean>} true when the embed is editable
     */
    async init(title, existingEntry = {}) {
        this.embed = new DeployProgressEmbed(deployState.discordClient, process.env.BOT_LOG_CHANNEL_ID);
        const savedSteps = Array.isArray(existingEntry.progressSteps) ? existingEntry.progressSteps : [];
        if (savedSteps.length > 0) this.steps = savedSteps;
        this.embed.steps = this.steps;

        const msgId = existingEntry.progressMessageId || '';
        const channelId = existingEntry.progressChannelId || process.env.BOT_LOG_CHANNEL_ID || '';
        if (msgId && channelId) {
            await this.embed.resume(msgId, channelId, title);
        }
        if (!this.embed.messageId) {
            await this.embed.start(title);
            if (this.embed.messageId) {
                await this.db.ref(`autopsy-requested/${this.topicId}/progressMessageId`).set(this.embed.messageId).catch(() => {});
                await this.db.ref(`autopsy-requested/${this.topicId}/progressChannelId`).set(this.embed.channelId).catch(() => {});
            }
        }
        return !!this.embed.messageId;
    }

    // progressSteps is memory-only during the run (this.steps backs the live
    // embed); persisted once on finalize alongside progressFinalized so a
    // restart can still resume the full history. progressMessageId /
    // progressChannelId keep their immediate writes (needed for resume).
    async addStep(name, status, detail = '') {
        if (!this.embed) return;
        if (status === 'fail') this.failed = true;
        await this.embed.addStep(name, status, detail);
    }

    async finalize(status) {
        if (!this.embed) return;
        const final = status || (this.failed ? 'failed' : 'complete');
        await this.embed.finalize(final);
        await this.db.ref(`autopsy-requested/${this.topicId}`).update({ progressFinalized: final, progressSteps: this.steps }).catch(() => {});
        _progressCache.delete(this.topicId);
    }
}

async function getAutopsyProgress(db, topicId, title, existingEntry = {}) {
    const cached = _progressCache.get(topicId);
    if (cached) return cached;
    const progress = new AutopsyProgress(db, topicId);
    const ready = await progress.init(title, existingEntry);
    if (!ready) return null;
    _progressCache.set(topicId, progress);
    return progress;
}

// ── Title Parsing ──

/**
 * Split a parsed request into individual decedents.
 *
 * Multi-decedent requests appear in three shapes:
 *   "John Doe ((Dylan Bongo, Marvion Futrell))" — 1 IC name, N OOC names
 *   "John Doe, Jane Doe ((OOC Name))"           — N IC names, 1 OOC name
 *   "John Doe, Jane Doe ((A, B))"               — N of both (paired by index)
 *
 * Single-name requests return one decedent with the original values, so the
 * existing single-case flow is untouched.
 *
 * @param {{ name: string, oocName: string }} parsed
 * @returns {Array<{ name: string, oocName: string }>}
 */
function splitDecedents(parsed) {
    const nameParts = String(parsed.name || '').split(',').map(s => s.trim()).filter(Boolean);
    const oocParts = String(parsed.oocName || '').split(',').map(s => s.trim()).filter(Boolean);

    let decedents;
    if (nameParts.length <= 1 && oocParts.length <= 1) {
        decedents = [{ name: parsed.name, oocName: parsed.oocName }];
    } else if (nameParts.length <= 1) {
        decedents = oocParts.map(o => ({ name: parsed.name, oocName: o }));
    } else if (oocParts.length <= 1) {
        decedents = nameParts.map(n => ({ name: n, oocName: parsed.oocName }));
    } else {
        // Both sides have multiple names — pair by index, trailing extras reuse
        // the last OOC name so no decedent is ever dropped.
        decedents = nameParts.map((n, i) => ({
            name: n,
            oocName: oocParts[i] || oocParts[oocParts.length - 1],
        }));
    }
    parsed.decedents = decedents;
    return decedents;
}

/**
 * Parse a forum topic title to extract autopsy request details.
 * @param {string} title
 * @returns {{ name: string, oocName: string, faction: string, decedents: Array<{ name: string, oocName: string }> } | null}
 */
function parseTopicTitle(title) {
    const match = title.trim().match(TITLE_REGEX);
    if (!match) return null;
    const parsed = {
        name: (match[1] || '').trim(),
        oocName: (match[2] || '').trim(),
        faction: match[3] ? match[3].toUpperCase() : '',
    };
    splitDecedents(parsed);
    return parsed;
}

/**
 * Resolve the name a new case should be filed under.
 *
 * Override ONLY on positive evidence of a requester-titled request: the
 * body yields exactly one decedent that differs from the title name, AND the
 * title name matches a known requester identity (body requesterName or topic
 * poster). Standard requests (title == decedent, or no body decedent) flow
 * through untouched ({ overridden: false }).
 *
 * Pure — safe to unit-test headlessly.
 */
export function resolveCaseDecedent({ titleName, titleOoc, bbFields, requesterPoster } = {}) {
    try {
        const list = bbFields && Array.isArray(bbFields.decedentNames) ? bbFields.decedentNames : [];
        const singleBody = list.length === 1 ? list[0] : null;
        const bodyDecedent = (singleBody && singleBody.name ? String(singleBody.name) : String((bbFields && bbFields.decedentName) || '')).trim();
        const titleNameL = String(titleName || '').trim().toLowerCase();
        const requesterIds = [bbFields && bbFields.requesterName, requesterPoster]
            .map((v) => String(v || '').trim().toLowerCase()).filter(Boolean);
        if (bodyDecedent && bodyDecedent.toLowerCase() !== titleNameL && requesterIds.includes(titleNameL)) {
            return {
                overridden: true,
                name: bodyDecedent,
                oocName: (singleBody && singleBody.oocName ? String(singleBody.oocName) : '') || String(titleOoc || ''),
            };
        }
    } catch { /* fall through to title names */ }
    return { overridden: false, name: titleName, oocName: titleOoc };
}

// ── Agency Request Topic Resolution (LSSD / SADCR / DAO — shared lssd.gta.world) ──

/**
 * Thin wrapper over searchLssdRequestTopic targeting any registry forum.
 * (SADCR f=2328 and DAO f=2331 are subforums of the same lssd domain, so the
 * LSSD search client and login work unchanged.)
 */
async function searchAgencyRequestTopic(client, { oocName, name }, cfg) {
    return searchLssdRequestTopic(client, { oocName, name }, { forumId: cfg.forumId, baseUrl: cfg.baseUrl });
}

/**
 * Find (or conservatively create) the request topic for an autopsy request on
 * the requesting faction's own forum. Mirrors the original LSSD-only flow:
 *
 *   1. Reuse a preserved topic id from a previous cycle (reset-safe).
 *   2. Search the faction forum for a matching existing topic ("Name (( OOC ))"
 *      first, then the plain name) — CASELINK creates its own topics.
 *   3. Nothing found → resolve the PHMC topic poster. CASELINK poster → skip
 *      creation (never duplicate). Unresolvable poster → skip conservatively
 *      (recovery sweep / manual handling covers it). Human poster → one final
 *      re-search to close the CASELINK race window, then create a "certified
 *      copy" topic containing the raw request BBCode and persist
 *      <faction>RequestTopicId + created-by-bot + crosspostStatus flags.
 *
 * @param {object} p
 * @param {object} p.db — Firebase Admin RTDB
 * @param {string|number} p.topicId — PHMC request topic id (record key)
 * @param {string} p.faction — 'LSSD' | 'SADCR' | 'DAO'
 * @param {string} [p.oocName] [p.name] — decedent OOC / IC names for matching
 * @param {string} [p.requestBbCode] — raw request BBCode (certified copy body)
 * @param {string} [p.caseLabelLine] — case title/label shown in the copy body
 * @param {string} [p.existingTopicId] — preserved faction topic id, if any
 * @param {string} [p.requesterPoster] — PHMC topic poster (avoids re-fetch)
 * @returns {Promise<{topicId: string|null}>}
 */
async function ensureAgencyRequestTopic({
    db, topicId, faction, oocName = '', name = '',
    requestBbCode = '', caseLabelLine = '', existingTopicId = '', requesterPoster = '',
    topicTitle = '',
}) {
    const cfg = getAgencyForum(faction);
    if (!cfg) return { topicId: null };
    const factionLower = String(faction).toLowerCase();
    const facTag = String(faction).toUpperCase();

    // 1. Preserved topic id (e.g. reset-tool run) — reuse, never duplicate.
    // When the caller passes its incident-label topicTitle (mass flow), heal
    // a pre-fix first-body title to match (best-effort). Search-found topics
    // below are someone else's — never retitled.
    if (existingTopicId) {
        console.log(`[AUTOPSY-MON] Reusing existing ${String(faction).toUpperCase()} request topic #${existingTopicId}`);
        if (topicTitle) {
            try {
                const healClient = getForumClient();
                await healClient.login(
                    process.env[`FORUM_${cfg.credPrefix}_USERNAME`],
                    process.env[`FORUM_${cfg.credPrefix}_PASSWORD`],
                    { force: false, baseUrl: cfg.baseUrl }
                );
                await healClient.editTopicTitle(String(existingTopicId), cfg.forumId, topicTitle, { baseUrl: cfg.baseUrl });
                console.log(`[AUTOPSY-MON] Healed ${String(faction).toUpperCase()} topic #${existingTopicId} title to incident-label shape`);
            } catch (err) {
                console.warn(`[AUTOPSY-MON] [WARN] ${String(faction).toUpperCase()} title heal failed: ${err.message}`);
            }
        }
        return { topicId: String(existingTopicId) };
    }

    const client = getForumClient();
    try {
        await client.login(
            process.env[`FORUM_${cfg.credPrefix}_USERNAME`],
            process.env[`FORUM_${cfg.credPrefix}_PASSWORD`],
            { force: false, baseUrl: cfg.baseUrl }
        );
    } catch (err) {
        console.warn(`[AUTOPSY-MON] Step 3 — ${String(faction).toUpperCase()} forum login error: ${err.message}`);
        return { topicId: null };
    }

    // 2. Search for an existing request topic on the faction forum.
    try {
        const found = await searchAgencyRequestTopic(client, { oocName, name }, cfg);
        if (found) {
            console.log(`[AUTOPSY-MON] Found ${String(faction).toUpperCase()} topic #${found.topicId} for acknowledgement`);
            db.ref(`autopsy-requested/${topicId}/${cfg.topicField}`).set(found.topicId).catch(() => {});
            return { topicId: found.topicId };
        }
        console.log(`[AUTOPSY-MON] Step 3 — ${String(faction).toUpperCase()} topic search returned no results for ${oocName || name}; checking poster for CASELINK...`);
    } catch (err) {
        console.warn(`[AUTOPSY-MON] Step 3 — ${String(faction).toUpperCase()} topic search error: ${err.message}`);
        return { topicId: null };
    }

    // 3. Nothing found — resolve the PHMC poster before creating anything.
    let poster = requesterPoster;
    if (!poster) {
        try {
            poster = await getForumClient().getTopicPoster(topicId, { baseUrl: PHMC_BASE }) || '';
        } catch { poster = ''; }
    }
    const isCaselink = !!(poster && /caselink/i.test(poster));
    console.log(`[AUTOPSY-MON] Step 3 — PHMC request poster: "${poster || 'unknown'}" (caselink: ${isCaselink})`);

    if (isCaselink) {
        console.log(`[AUTOPSY-MON] Step 3 — CASELINK request — ${String(faction).toUpperCase()} creates its own topic; skipping creation to avoid duplication`);
        return { topicId: null };
    }
    if (!poster) {
        console.warn(`[AUTOPSY-MON] Step 3 — Could not resolve request poster — skipping ${String(faction).toUpperCase()} topic creation to avoid duplicating a potential CASELINK topic. Handle manually or via recovery sweep.`);
        return { topicId: null };
    }

    // Human request — close the CASELINK race window with one more search,
    // then post the certified-copy topic with the RAW request BBCode verbatim.
    try {
        const recheck = await searchAgencyRequestTopic(client, { oocName, name }, cfg);
        if (recheck) {
            console.log(`[AUTOPSY-MON] Step 3 — ${String(faction).toUpperCase()} topic appeared during recheck: #${recheck.topicId}`);
            db.ref(`autopsy-requested/${topicId}/${cfg.topicField}`).set(recheck.topicId).catch(() => {});
            return { topicId: recheck.topicId };
        }

        // Dynamic mass title when provided (mass single-thread passes its
        // incident-label title); otherwise the legacy singular shape.
        const finalTitle = topicTitle || `Autopsy Request - ${name}${oocName ? ` ((${oocName}))` : ''} [${facTag}]`;
        const topicBody = requestBbCode
            ? `[divbox=white][center][b][size=170]AUTOPSY REQUEST — CERTIFIED COPY [/size][/b][/center][hr][/hr]\n${requestBbCode}\n[hr][/hr][b]Case:[/b] ${caseLabelLine}\n[b]Status:[/b] Under Investigation\n[/divbox]`
            : `[divbox=white][b]Autopsy Request[/b]\n[b]Decedent:[/b] ${name}${oocName ? ` ((${oocName}))` : ''}\n[b]Case:[/b] ${caseLabelLine}\n[b]Status:[/b] Under Investigation\n[/divbox]`;
        const postUrl = `${cfg.baseUrl}/posting.php?mode=post&f=${cfg.forumId}`;
        const res = await client.postTopic(cfg.forumId, finalTitle, topicBody, postUrl);
        if (res.ok) {
            const tM = res.url.match(/[?&]t=(\d+)/);
            if (tM) {
                const newTopicId = tM[1];
                console.log(`[AUTOPSY-MON] Created ${facTag} request topic #${newTopicId} for non-caselink request`);
                // Batched: topic id + creation flags in one update (same values, same timing — all post after the forum post lands).
                db.ref(`autopsy-requested/${topicId}`).update({ [cfg.topicField]: newTopicId, [`${factionLower}RequestCreatedByBot`]: true, [`${factionLower}CrosspostStatus`]: 'pending' }).catch(() => {});
                return { topicId: newTopicId };
            }
            console.warn(`[AUTOPSY-MON] Step 3 — ${facTag} topic created but could not extract topic ID from URL: ${res.url}`);
        } else {
            console.warn(`[AUTOPSY-MON] Step 3 — ${facTag} topic creation failed: ${res.reason || 'unknown'}`);
        }
    } catch (err) {
        console.warn(`[AUTOPSY-MON] Step 3 — ${facTag} topic creation error: ${err.message}`);
    }
    return { topicId: null };
}

// ── Forum Check ──

/**
 * Check the forum for new autopsy request topics.
 * Matches titles, saves new ones to Firebase, increments counters, and notifies.
 */
export async function checkForNewRequests() {
    if (!_db) {
        _db = firebase.db;
    }

    console.log('[AUTOPSY-MON] Checking for new autopsy requests...');

    try {
        const client = getForumClient();

        // Ensure the browser is launched (uses stored session cookies automatically)
        await client.ensureBrowser();

        // Fetch topics from the forum listing page — uses its own disposable page
        // and does NOT hold the mutex lock, so it won't block deploys.
        const topics = await client.getForumTopics(PHMC_FORUM_ID, { baseUrl: PHMC_BASE });

        if (topics.length === 0) {
            console.log('[AUTOPSY-MON] No topics found on the page');
            return;
        }

        // Debug: log all topic titles to see what the forum returns
        console.log(`[AUTOPSY-MON] Topics in f=265: ${topics.map(t => `"${t.title}"`).join(', ')}`);

        // Load only the topics currently returned by the forum. The previous
        // whole-node read downloaded the entire historical autopsy registry on
        // every 15-minute scan just to deduplicate this page.
        let processed = {};
        try {
            const processedSnapshots = await Promise.all(topics.map(topic =>
                _db.ref(`autopsy-requested/${topic.topicId}`).once('value')
            ));
            topics.forEach((topic, index) => {
                const snap = processedSnapshots[index];
                if (snap.exists()) processed[topic.topicId] = snap.val();
            });
        } catch (err) {
            console.error('[AUTOPSY-MON] Failed to read processed topics:', err.message);
            return;
        }

        // Load current LOA list from Firebase
        let loaSet = new Set();
        try {
            const loaSnap = await _db.ref('autopsy-requests/loa').once('value');
            const loa = loaSnap.val() || {};
            Object.entries(loa).forEach(([name, val]) => {
                if (val === true) loaSet.add(name.toLowerCase());
            });
        } catch (err) {
            console.error('[AUTOPSY-MON] Failed to read LOA list:', err.message);
        }

        const newRequests = [];

        for (const topic of topics) {
            // Skip topics already being processed by the state machine
            // (has caseState = actively being worked on)
            // This allows re-processing of entries saved during the first cycle
            // (which have wasMatch=true but no caseState set)
            const prevEntry = processed[topic.topicId];
            if (prevEntry && prevEntry.caseState) continue;
            // Honor the negative cache: a previous scan already fetched this
            // topic's body and ruled it out (guideline/template/form). Without
            // this, the 3 pinned fixtures get re-fetched every 15-min cycle
            // (~6 wasted browser navigations each). Title must still match —
            // a retitled topic gets re-evaluated instead of skipped forever.
            if (prevEntry && prevEntry.wasMatch === false && prevEntry.title === topic.title) continue;

            let parsed = parseTopicTitle(topic.title);
            let parsedBbFields = {};
            let requestBbCode = '';

            if (!parsed) {
                // ── Body-based fallback ──
                // The title didn't match the standard format (e.g. "[Autopsy Request]
                // Jane Doe (Abigail Hills)" with no [LSPD]/[LSSD] tag). Fetch the topic
                // body and check whether it actually looks like a REAL autopsy request
                // (with a real decedent name + department) before treating it as a match.
                // Guard against the pinned guidelines/template topic, whose body contains
                // placeholder values like "ANSWER", "EX: LSPD - Homicide", "[NAME]", etc.
                const titleLower = (topic.title || '').toLowerCase();
                const isTemplateTitle = /guideline|template|instructions|example|info\b|\[form\]/.test(titleLower);
                const PLACEHOLDER_RE = /answer|example|ex:\s|ex\.|placeholder|\[name\]|\[ooc\]|xxxx|insert|n\/a\b/i;

                console.log(`[AUTOPSY-MON] Title did not match regex: #${topic.topicId} "${topic.title}" — checking body...`);
                try {
                    const client = getForumClient();
                    const bbcode = await client.getTopicBbcode(topic.topicId, 265, { baseUrl: PHMC_BASE });
                    if (bbcode) {
                        // ── Mass request pre-check (Task 2) ──
                        // "[Mass Autopsy Request]" titles (or >=2 BODY headers)
                        // bypass the dept/name gate — the single-thread branch
                        // below validates every body (missing ((OOC)) or
                        // ANSWER placeholders → parked, never partial data).
                        // Template/guideline-titled posts skip the probe so
                        // they negative-cache like the singular template post.
                        if (!parsed && !isTemplateTitle && isMassRequest(topic.title, bbcode)) {
                            const massProbe = parseMassRequestBbcode(bbcode);
                            if (!massProbe.error && massProbe.bodies.length > 0) {
                                console.log(`[AUTOPSY-MON] Mass request detected for #${topic.topicId} — routing to single-thread intake`);
                                const firstMass = massProbe.bodies[0];
                                const massTitle = parseMassTitle(topic.title);
                                parsed = {
                                    name: firstMass.name,
                                    oocName: firstMass.oocName,
                                    faction: factionFromDept(massProbe.shared.requesterDept || '') || (massTitle ? massTitle.agency : ''),
                                };
                                splitDecedents(parsed);
                                parsedBbFields = { ...massProbe.shared };
                                requestBbCode = bbcode;
                            }
                        }
                        if (!parsed) {
                        const bodyFields = parseAutopsyRequestBbcode(bbcode);
                        const deptRaw = (bodyFields.requesterDept || '').trim();
                        const nameRaw = (bodyFields.decedentName || '').trim();
                        // Registry factions (LSSD/LSPD/SADCR/DAO) — see factionFromDept.
                        const hasDept = !!factionFromDept(deptRaw);
                        const hasName = !!nameRaw;

                        // Reject template/placeholder bodies — not real requests.
                        const nameLooksReal = hasName && !PLACEHOLDER_RE.test(nameRaw);
                        const deptLooksReal = hasDept && !PLACEHOLDER_RE.test(deptRaw);

                        if (isTemplateTitle) {
                            console.log(`[AUTOPSY-MON] #${topic.topicId} looks like a template/guideline — not a request`);
                        } else if ((hasDept && deptLooksReal) || (hasName && nameLooksReal)) {
                            console.log(`[AUTOPSY-MON] Body confirmed autopsy request for #${topic.topicId} (dept="${deptRaw}", name="${nameRaw}")`);
                            const oocMatch = topic.title.match(/\(\(\s*(.*?)\s*\)\)/) || topic.title.match(/\(\s*(.*?)\s*\)/);
                            // The body's Name field sometimes already includes "(OOC)" —
                            // strip it so the case title doesn't show a duplicate.
                            let cleanName = (nameLooksReal ? nameRaw : '');
                            if (oocMatch && oocMatch[1]) {
                                cleanName = cleanName
                                    .replace(/\(\([\s\S]*?\)\)/g, '')     // strip full ((OOC)) pairs
                                    .replace(/\(\s*[\w.'\-\s]+\)/g, '')   // strip single (OOC) pairs
                                    .replace(/\(\s*\)/g, '')              // drop any leftover empty ()
                                    .trim();
                            }
                            if (!cleanName) {
                                cleanName = topic.title.replace(/^(?:\[)?Autopsy\s+Request(?:\])?\s*[-–—]?\s*/i, '').replace(/\(\(.*?\)\)/g, '').replace(/\(.*?\)/g, '').trim() || topic.title;
                            }
                            parsed = {
                                name: cleanName,
                                oocName: (oocMatch && oocMatch[1] ? oocMatch[1].trim() : ''),
                                faction: factionFromDept(deptRaw),
                            };
                            splitDecedents(parsed);
                            parsedBbFields = bodyFields;
                            requestBbCode = bbcode;
                            // NOTE: do NOT pre-save requestBbCode/parsed as child nodes here —
                            // the main flow's `set(entry)` below replaces the whole node and
                            // would wipe them. They're attached to `entry` instead (below).
                            // Fall through to the normal match-processing path below.
                        }
                        } // end if (!parsed) — mass requests bypass the dept/name gate above
                    }
                } catch (err) {
                    console.warn(`[AUTOPSY-MON] Body fallback error for #${topic.topicId}: ${err.message}`);
                }

                if (!parsed) {
                    console.log(`[AUTOPSY-MON] Topic did not match regex: topicId=${topic.topicId} title="${topic.title}"`);
                    // Save non-matching topics as processed (negative cache)
                    // so we never re-check them
                    await _db.ref(`autopsy-requested/${topic.topicId}`).set({
                        title: topic.title,
                        topicId: topic.topicId,
                        detectedAt: new Date().toISOString(),
                        wasMatch: false,
                    }).catch((err) => {
                        console.error(`[AUTOPSY-MON] Failed to save non-match: ${err.message}`);
                    });
                    continue;
                }
            }

            // --- New matching request found ---

            // ── Requester identity (resolved at detection time, reused later) ──
            // The forum username of whoever posted the request ("CASELINK [Bot]"
            // vs a human officer) gates BOTH the agency-topic duplication guard
            // and the completion webhook. Looked up here once so Step 3 never
            // needs its own ad-hoc fetch.
            let requesterPoster = prevEntry?.requesterPoster || '';
            try {
                const phmcClient = getForumClient();
                await phmcClient.ensureBrowser();
                const freshPoster = await phmcClient.getTopicPoster(topic.topicId, { baseUrl: PHMC_BASE });
                if (freshPoster) requesterPoster = String(freshPoster);
            } catch (err) {
                console.warn(`[AUTOPSY-MON] Poster lookup failed for #${topic.topicId}: ${err.message}`);
            }
            const postedByCaselink = !!(requesterPoster && /caselink/i.test(requesterPoster));
            if (requesterPoster) {
                console.log(`[AUTOPSY-MON] Request poster for #${topic.topicId}: "${requesterPoster}" (caselink: ${postedByCaselink})`);
            }

            const entry = {
                title: topic.title,
                name: parsed.name,
                oocName: parsed.oocName,
                faction: parsed.faction,
                topicUrl: topic.href,
                topicId: topic.topicId,
                detectedAt: new Date().toISOString(),
                wasMatch: true,
                // If the body fallback already parsed the request, persist those fields
                // with the entry (a later `set` here would otherwise overwrite them).
                ...(requestBbCode ? {
                    requestBbCode,
                    parsed: parsedBbFields,
                    ...(parsedBbFields.requesterDiscord && !isDna(parsedBbFields.requesterDiscord) ? { requesterDiscordTag: parsedBbFields.requesterDiscord } : {}),
                } : {}),
                // Preserve crosspost topic ids across reprocessing so a re-run
                // REUSES the existing LSPD/LSSD/SADCR/DAO topics instead of duplicating them
                // (e.g. resetting a botched request to re-run with a fixed parser).
                ...(prevEntry?.lspdTopicId ? { lspdTopicId: prevEntry.lspdTopicId } : {}),
                ...(prevEntry?.lssdRequestTopicId ? { lssdRequestTopicId: prevEntry.lssdRequestTopicId } : {}),
                ...(prevEntry?.lssdRequestCreatedByBot ? { lssdRequestCreatedByBot: true } : {}),
                ...(prevEntry?.sadcrRequestTopicId ? { sadcrRequestTopicId: prevEntry.sadcrRequestTopicId } : {}),
                ...(prevEntry?.daoRequestTopicId ? { daoRequestTopicId: prevEntry.daoRequestTopicId } : {}),
                ...(prevEntry?.requesterDiscordTag ? { requesterDiscordTag: prevEntry.requesterDiscordTag } : {}),
                // Requester identity fields (poster lookup re-runs each cycle only
                // while no caseState exists; never write a false over a true).
                ...(requesterPoster ? { requesterPoster } : {}),
                ...(postedByCaselink ? { postedByCaselink: true } : {}),
                // Preserve the live progress embed so reprocessing/restarts
                // RESUME the same Discord message instead of posting a new one.
                ...(prevEntry?.progressMessageId ? { progressMessageId: prevEntry.progressMessageId } : {}),
                ...(prevEntry?.progressChannelId ? { progressChannelId: prevEntry.progressChannelId } : {}),
                ...(prevEntry?.progressSteps ? { progressSteps: prevEntry.progressSteps } : {}),
            };

            // Web "Request Autopsy" submissions (auto-posted by the bot) carry
            // the requester's deliver-to forum account in a web-meta stub keyed
            // by topic id. Attach it to the entry so the completion "DM
            // Requester" step PMs the real requester instead of skipping (the
            // topic poster is the bot for web submissions).
            try {
                const metaSnap = await _db.ref(`autopsy-requests/web-meta/${topic.topicId}`).once('value');
                if (metaSnap.exists()) {
                    const meta = metaSnap.val() || {};
                    if (meta.source === 'web-morgue') {
                        entry.formsAutopsy = true;
                        if (meta.agencyForum) entry.agencyForum = String(meta.agencyForum);
                        if (meta.forumAccountUrl) entry.forumAccountUrl = String(meta.forumAccountUrl);
                        console.log(`[AUTOPSY-MON] #${topic.topicId} forms autopsy — agencyForum=${entry.agencyForum || 'phmc'} forumAccountUrl=${entry.forumAccountUrl ? 'set' : 'none'}`);
                    }
                }
            } catch (err) {
                console.warn(`[AUTOPSY-MON] web-meta read failed for #${topic.topicId}: ${err.message}`);
            }

            await _db.ref(`autopsy-requested/${topic.topicId}`).set(entry);

            console.log(`[AUTOPSY-MON] Saved: ${topic.title}`);

            // Parse and store structured fields from the request post.
            // Skipped when the body-based fallback already populated them above.
            if (!requestBbCode) {
            try {
                console.log(`[AUTOPSY-MON] Fetching BBCode for #${topic.topicId}...`);
                const client = getForumClient();
                const bbcode = await client.getTopicBbcode(topic.topicId, 265, { baseUrl: PHMC_BASE });
                if (bbcode) {
                    parsedBbFields = parseAutopsyRequestBbcode(bbcode);
                    requestBbCode = bbcode;
                    // Batched: raw BBCode + requester tag + parsed fields in one
                    // update. Same values/conditions as the old scatter (tag only
                    // when a non-DNA requesterDiscord exists, parsed only when
                    // non-empty); entry.requesterDiscordTag still set in memory.
                    const parseUpdate = { requestBbCode: bbcode };
                    // Requester Discord contact string (username or numeric ID) —
                    // consumed by the completion webhook for the requester ping.
                    if (parsedBbFields.requesterDiscord && !isDna(parsedBbFields.requesterDiscord)) {
                        entry.requesterDiscordTag = parsedBbFields.requesterDiscord;
                        parseUpdate.requesterDiscordTag = parsedBbFields.requesterDiscord;
                    }
                    if (Object.keys(parsedBbFields).length > 0) {
                        parseUpdate.parsed = parsedBbFields;
                        console.log(`[AUTOPSY-MON] Parsed ${Object.keys(parsedBbFields).length} fields from request`);
                    }
                    // Save the raw request BBCode for later crosspost use (LSPD/LSSD forum topics)
                    await _db.ref(`autopsy-requested/${topic.topicId}`).update(parseUpdate).catch(() => {});
                }
            } catch (err) {
                console.warn(`[AUTOPSY-MON] Parse error for #${topic.topicId}: ${err.message}`);
            }
            }

            // ── Create Case Management entry (state machine — resumes on restart) ──
            // Multi-decedent requests ("Name ((A, B))" or numbered Section 2
            // bodies: "John Doe[1]((OOC A))", "John Doe[2]((OOC B))") are split
            // into one case per decedent, each with its own ME assignment.
            // Single-decedent requests keep the original top-level state
            // machine unchanged.
            //
            // The request BODY is the authoritative source (the template
            // explicitly numbers multiple bodies); fall back to the title's
            // comma split when the body wasn't parseable.
            // ── Mass Autopsy Request — single-thread intake (Task 2) ──
            // Title "[Mass Autopsy Request]" OR >=2 "--- BODY N ---" headers →
            // ONE case number, ONE f=266 topic with concatenated bodies, one
            // grouped ack, faction counter +N. Branches BEFORE the legacy multi
            // path below — the comma-title split and everything after it is
            // untouched.
            if (requestBbCode && isMassRequest(topic.title, requestBbCode)) {
                try {
                    const mass = parseMassRequestBbcode(requestBbCode);
                    if (mass.error) {
                        // Structural defect (e.g. a body missing ((OOC))) with the
                        // full BBCode present → park as skipped so it never files
                        // partial data; needs a supervisor fix on the source post.
                        console.warn(`[AUTOPSY-MON] [WARN] Mass request parse failed for #${topic.topicId}: ${mass.error}`);
                        // Batched: error + skip marker in one update (same values).
                        await _db.ref(`autopsy-requested/${topic.topicId}`).update({ massParseError: mass.error, caseState: 'skipped', skipReason: mass.error }).catch(() => {});
                    } else {
                        await processMassRequest({ db: _db, topic, parsed, mass, requestBbCode, processed });
                    }
                } catch (err) {
                    console.error(`[AUTOPSY-MON] [ERR] Mass request handling failed for #${topic.topicId}: ${err.message}`);
                }
                newRequests.push(entry);
                continue;
            }

            const bodyDecedents = parsedBbFields.decedentNames && parsedBbFields.decedentNames.length > 1
                ? parsedBbFields.decedentNames.map(d => ({ name: d.name, oocName: d.oocName, marker: d.marker }))
                : null;
            const decedents = bodyDecedents
                || ((parsed.decedents && parsed.decedents.length > 0) ? parsed.decedents : [{ name: parsed.name, oocName: parsed.oocName }]);

            if (decedents.length > 1) {
                try {
                    await processMultiDecedentRequest({
                        db: _db, topic, parsed, decedents, requestBbCode, parsedBbFields, loaSet, processed,
                    });
                } catch (err) {
                    console.error(`[AUTOPSY-MON] Multi-decedent case creation error: ${err.message}`);
                }
            } else {
            try {
                const caseRef = _db.ref(`autopsy-requested/${topic.topicId}`);
                const existingEntry = processed[topic.topicId] || {};
                let state = existingEntry.caseState || '';

                const setState = async (s) => {
                    state = s;
                    await caseRef.child('caseState').set(s);
                    console.log(`[AUTOPSY-MON] State #${topic.topicId}: ${s}`);
                };

                // Determine case number (skip if resuming).
                // Empty-listing guard (same as the mass path): an empty f=266
                // scan means a stale session, not an empty forum — abort and
                // retry next cycle rather than filing "Case 1".
                let caseNum = existingEntry.caseNum || '';
                if (!caseNum && !['case_created','me_assigned','ack_sent','complete'].includes(state)) {
                    try {
                        const cc = getForumClient();
                        await cc.ensureBrowser();
                        let existingTopics = await cc.getForumTopics(266, { baseUrl: PHMC_BASE });
                        if (!existingTopics || existingTopics.length === 0) {
                            console.warn('[AUTOPSY-MON] [WARN] Case-number scan empty — forcing login and retrying once');
                            try {
                                await cc.login(null, null, { force: true, baseUrl: PHMC_BASE });
                                existingTopics = await cc.getForumTopics(266, { baseUrl: PHMC_BASE });
                            } catch { /* retry-login best-effort ignored: empty-list guard below aborts safely with an ERR log */ }
                        }
                        if (!existingTopics || existingTopics.length === 0) {
                            console.error('[AUTOPSY-MON] [ERR] Case-number scan empty twice — aborting, NOT filing; will retry next cycle');
                            await setState('');
                            continue;
                        }
                        let highest = 0;
                        for (const t of existingTopics) {
                            const m = t.title.match(/Case\s*(\d+)/i);
                            if (m) { const n = parseInt(m[1], 10); if (n > highest) highest = n; }
                        }
                        caseNum = String(highest + 1);
                        await caseRef.child('caseNum').set(caseNum);
                        console.log(`[AUTOPSY-MON] Highest case: #${highest} -> new: #${caseNum}`);
                    } catch (err) {
                        console.warn(`[AUTOPSY-MON] Case number lookup: ${err.message}`);
                    }
                }

                // Requester-titled requests: the topic title holds the REQUESTER's
                // name (e.g. "[Autopsy Request] Stefan Maroto [SADCR]") while
                // the body names the real decedent (decedentName "John Weber").
                // Filing the case under the requester misnames the case topic
                // and every downstream artifact (assignment pings, dashboard).
                let caseName = parsed.name;
                let caseOoc = parsed.oocName;
                try {
                    const r = resolveCaseDecedent({
                        titleName: parsed.name,
                        titleOoc: parsed.oocName,
                        bbFields: parsedBbFields,
                        requesterPoster,
                    });
                    if (r.overridden) {
                        console.log(`[AUTOPSY-MON] Requester-titled request #${topic.topicId}: title names "${parsed.name}" (requester) — filing case as decedent "${r.name}"`);
                        caseName = r.name;
                        caseOoc = r.oocName;
                        // Batched: overridden decedent identity in one update (same values, same overridden-only condition).
                        await caseRef.update({ name: caseName, oocName: caseOoc }).catch(() => {});
                    }
                } catch (e) {
                    console.warn(`[AUTOPSY-MON] Decedent-title guard failed for #${topic.topicId}: ${e.message} — using title name`);
                }

                const caseNumStr = caseNum ? ` ${caseNum}` : '';
                const factionTag = parsed.faction ? ` [${parsed.faction}]` : '';
                const oocPart = caseOoc ? ` ((${caseOoc}))` : '';
                const caseTitle = `Case${caseNumStr} - ${caseName}${oocPart}${factionTag} - UNASSIGNED`;
                const isDryRun = process.env.AUTOPSY_DRY_RUN !== 'false';

                if (isDryRun) {
                    console.log(`[AUTOPSY-MON] DRY RUN — would create case for #${topic.topicId}`);
                    await sendWebhookSummary(`**[DRY RUN] Autopsy Case Would Be Created**\n${caseTitle}\nTopic: ${topic.href}`);
                    // Set caseState to prevent re-processing on the next cycle
                    await caseRef.child('caseState').set('dry_run').catch(() => {});
                    newRequests.push(entry);
                    continue;
                }

                // Consolidated live progress embed (one self-updating message per
                // request — replaces the old "Autopsy Case Created" webhook, owner
                // ping, and "New Autopsy Request Detected" notifications).
                const progress = await getAutopsyProgress(_db, topic.topicId, `Autopsy Case — ${caseName}${oocPart}${factionTag}`, existingEntry);
                if (progress) await progress.addStep('Autopsy Case Detected', 'ok', 'Fetching Information');

                // Step 1: Create case topic in f=266
                if (state === '') {
                    console.log(`[AUTOPSY-MON] Creating case: "${caseTitle}"`);
                    if (progress) await progress.addStep('FOUND: CASE', 'pending');
                    const cc = getForumClient();
                    const result = await cc.quoteAndPost(topic.topicId, 265, 266, caseTitle, { baseUrl: PHMC_BASE });
                    if (!result.ok) {
                        console.warn(`[AUTOPSY-MON] Case creation failed: ${result.reason || 'unknown'}`);
                        if (progress) {
                            await progress.addStep('FOUND: CASE', 'fail', result.reason || 'unknown');
                            await progress.finalize();
                        }
                        newRequests.push(entry);
                        continue;
                    }
                    console.log(`[AUTOPSY-MON] Case created: ${result.url}`);
                    // Batched: caseUrl (+caseTopicId when the URL carries t=) +
                    // caseTitle + caseState in one update. Same values/timing as
                    // the old scatter; keeps setState's in-memory `state` flip + log.
                    const caseCreatedUpdate = { caseUrl: result.url, caseTitle, caseState: 'case_created' };
                    const tMatch = result.url.match(/[?&]t=(\d+)/);
                    if (tMatch) caseCreatedUpdate.caseTopicId = tMatch[1];
                    await caseRef.update(caseCreatedUpdate);
                    state = 'case_created';
                    console.log(`[AUTOPSY-MON] State #${topic.topicId}: case_created`);
                    if (progress) {
                        await progress.addStep('FOUND: CASE', 'ok', caseTitle);
                        await progress.addStep('POSTED TO CASE MANAGEMENT', 'ok', result.url);
                    }
                }

                const caseUrl = existingEntry.caseUrl || (await caseRef.child('caseUrl').once('value')).val() || '';

                // Step 2: Assign ME via fair rotation
                let assignedName = null;
                if (state === 'case_created') {
                    await setState('me_assigned');
                    if (progress) await progress.addStep('ASSIGNED MEDICAL EXAMINER', 'pending');
                    const cc = getForumClient();
                    try {
                        // Fetch group members (needed for user IDs in BBCode and to optionally init rotation)
                        const memberList = await cc.getGroupMembers(50, { baseUrl: PHMC_BASE, exclude: ['PHMC Forms Bot'], paginate: true });

                        // Auto-init rotation list from forum group on first run (no-op if already set)
                        await initializeRotationFromGroup(_db, memberList);

                        // Check for new/departed MEs and update rotation dynamically
                        const syncResult = await syncRotationFromGroup(_db, memberList);
                        if (syncResult && (syncResult.added.length > 0 || syncResult.removed.length > 0)) {
                            const msg = [
                                syncResult.added.length > 0 ? `New MEs added to rotation: ${syncResult.added.join(', ')}` : '',
                                syncResult.removed.length > 0 ? `Removed from rotation: ${syncResult.removed.join(', ')}` : '',
                            ].filter(Boolean).join(' | ');
                            console.log(`[ROTATION] ${msg}`);
                            try { await sendLogMessage(`[ROTATION] ${msg}`); } catch { /* ignore */ }
                        }

                        // Supervised final-autopsy requests carry an explicit
                        // "ASSIGNED: <ME> for Final Autopsy Exams" marker — honor it
                        // (unless that ME is on LOA), otherwise use the fair rotation.
                        // DEV TEST MODE outranks BOTH — every case goes to the forced ME.
                        const devForcedME = getDevTestME();
                        const overrideRaw = (parsedBbFields.assignedOverride || '').trim();
                        const overrideName = overrideRaw.replace(/\s+for\s+Final\s+Autopsy\s+Exams.*$/i, '').trim();
                        const overrideLoa = overrideName ? loaSet.has(overrideName.toLowerCase()) : false;
                        if (devForcedME) {
                            assignedName = devForcedME;
                            console.log(`[AUTOPSY-MON] DEV TEST MODE — forcing ${devForcedME} for #${topic.topicId}${overrideName ? ' (overriding supervised ASSIGNED marker)' : ''}`);
                        } else if (overrideName && !overrideLoa) {
                            assignedName = overrideName;
                            console.log(`[AUTOPSY-MON] Assigned-override ME for #${topic.topicId}: ${assignedName}`);
                        } else {
                            if (overrideName && overrideLoa) {
                                console.warn(`[AUTOPSY-MON] Assigned-override ME "${overrideName}" is on LOA — falling back to rotation`);
                            }
                            // Use the rotation-based selection (handles recency, load balance, surge)
                            assignedName = await selectME(_db, topic.topicId, caseNum);
                        }

                        if (assignedName) {
                            const tMatch = caseUrl.match(/[?&]t=(\d+)/);
                            if (tMatch) {
                                const member = memberList.find(m => m.name.toLowerCase() === assignedName.toLowerCase());
                                const uid = member?.userId || '0';
                                const assignBBCode = `[quote="${assignedName}" user_id=${uid}]\n[/quote]\n\n[b]${assignedName}[/b] - You have been assigned this autopsy case file.`;
                                // Mark 'attempting' BEFORE posting so the recovery sweep
                                // doesn't double-post while this reply is mid-flight.
                                await caseRef.child('assignmentReplyStatus').set('attempting').catch(() => {});
                                const replyResult = await cc.replyToTopic(tMatch[1], 266, assignBBCode, { dryRun: false, baseUrl: PHMC_BASE });
                                if (replyResult.ok) {
                                    console.log(`[AUTOPSY-MON] Assigned ${assignedName} to case #${tMatch[1]}`);
                                    const newTitle = caseTitle.replace('- UNASSIGNED', `- ${assignedName}`);
                                    await cc.editTopicTitle(tMatch[1], 266, newTitle, { baseUrl: PHMC_BASE });
                                    // Save the updated title to Firebase so the completion flow uses the clean title
                                    // Batched: assignee + retitled caseTitle + completed status in one update.
                                    await caseRef.update({ assignedTo: assignedName, caseTitle: newTitle, assignmentReplyStatus: 'completed' }).catch(() => {});
                                    // Tag the assigned ME on Discord (if a mapping exists)
                                    try {
                                        const { notifyAssignment } = await import('./meDiscordNotify.js');
                                        await notifyAssignment(_db, assignedName, newTitle || caseTitle, caseUrl, {
                                            decedent: parsed.name,
                                            ooc: parsed.oocName,
                                            caseNumber: caseNum,
                                            deathType: parsedBbFields.deathType || parsed.deathType,
                                            requestTopicId: topic.topicId,
                                        });
                                    } catch (err) {
                                        console.warn(`[AUTOPSY-MON] ME Discord notify failed: ${err.message}`);
                                    }
                                    if (progress) await progress.addStep('ASSIGNED MEDICAL EXAMINER', 'ok', assignedName);
                                } else {
                                    const reason = replyResult.reason || replyResult.url || 'unknown';
                                    console.warn(`[AUTOPSY-MON] Assignment reply failed for ${assignedName} — reason: ${reason} — will retry next cycle`);
                                    // Batched: assignee (kept, as before) + failed status + state reset so the machine retries next cycle.
                                    await caseRef.update({ assignedTo: assignedName, assignmentReplyStatus: 'failed', caseState: 'case_created' }).catch(() => {});
                                    if (progress) await progress.addStep('ASSIGNED MEDICAL EXAMINER', 'fail', 'Assignment reply failed — will retry next cycle');
                                }
                            }
                        } else {
                            console.log('[AUTOPSY-MON] No ME available to assign — check rotation list and LOA status');
                            if (progress) await progress.addStep('ASSIGNED MEDICAL EXAMINER', 'fail', 'No ME available — check rotation/LOA');
                        }
                    } catch (err) {
                        console.error(`[AUTOPSY-MON] Assignment error: ${err.message}`);
                        if (progress) await progress.addStep('ASSIGNED MEDICAL EXAMINER', 'fail', err.message);
                    }
                }

                // Step 3: Send acknowledgement reply
                if (state === 'me_assigned') {
                    try {
                        const requesterName = parsedBbFields.requesterName || parsed.name || '';
                        let agencyAckTopicId = null;   // request topic on the faction's own forum
                        let agencyFactionKey = null;   // 'LSSD' | 'SADCR' | 'DAO'
                        let lspdTopicId = null;  // declared here for access in the ack call below

                        // --- Agency crosspost: locate/create the request topic on the faction's own forum ---
                        // LSSD/SADCR/DAO are registry factions whose forums ALL sit on lssd.gta.world,
                        // so one pipeline serves them: search-first ("Name (( OOC ))" then plain name)
                        // because CASELINK posts its own topics; creation happens ONLY for requests
                        // whose PHMC poster positively resolves to a human account (never duplicate a
                        // CASELINK topic; unresolvable posters defer to recovery/manual).
                        // The raw request BBCode goes in verbatim inside the certified-copy shell.
                        if (isAgencyFaction(parsed.faction) && (parsed.oocName || parsed.name)) {
                            const cfgA = getAgencyForum(parsed.faction);
                            const existingAgencyTopicId = existingEntry[cfgA.topicField]
                                || (await caseRef.child(cfgA.topicField).once('value')).val()
                                || '';
                            const ensured = await ensureAgencyRequestTopic({
                                db: _db,
                                topicId: topic.topicId,
                                faction: parsed.faction,
                                oocName: parsed.oocName,
                                name: parsed.name,
                                requestBbCode,
                                caseLabelLine: caseTitle,
                                existingTopicId: existingAgencyTopicId,
                                requesterPoster: entry.requesterPoster || existingEntry.requesterPoster || '',
                            });
                            agencyAckTopicId = ensured.topicId;
                            agencyFactionKey = String(parsed.faction).toUpperCase();
                        } else {
                            console.log('[AUTOPSY-MON] Step 3 — Agency crosspost skipped (faction=' + (parsed.faction || 'none') + ', oocName=' + (parsed.oocName || 'none') + ', name=' + (parsed.name || 'none') + ')');
                        }

                        // --- LSPD: Create topic on LSPD forum f=1361 immediately on detection ---
                        if (parsed.faction === 'LSPD') {
                            // Reuse a preserved LSPD topic id (reprocessing after a
                            // reset) instead of creating a duplicate.
                            const existingLspd = existingEntry.lspdTopicId || (await caseRef.child('lspdTopicId').once('value')).val() || '';
                            if (existingLspd) {
                                lspdTopicId = String(existingLspd);
                                console.log('[AUTOPSY-MON] Reusing existing LSPD topic #' + lspdTopicId + ' for request');
                            } else {
                            try {
                                const lspdClient = getForumClient();
                                await lspdClient.login(process.env.FORUM_LSPD_USERNAME, process.env.FORUM_LSPD_PASSWORD, { force: false, baseUrl: 'https://lspd.gta.world' });
                                const lspdTopicTitle = 'Autopsy Request - ' + parsed.name + (parsed.oocName ? ' ((' + parsed.oocName + '))' : '') + ' [LSPD]';
                                const lspdTopicBody = requestBbCode
                                    ? '[divbox=white][center][b][size=170]AUTOPSY REQUEST — CERIFIED COPY [/size][/b][/center][hr][/hr]\n' + requestBbCode + '\n[hr][/hr][b]Case:[/b] ' + caseTitle + '\n[b]Status:[/b] Under Investigation\n[/divbox]'
                                    : '[divbox=white][b]Autopsy Request[/b]\n[b]Decedent:[/b] ' + parsed.name + (parsed.oocName ? ' ((' + parsed.oocName + '))' : '') + '\n[b]Case:[/b] ' + caseTitle + '\n[b]Status:[/b] Under Investigation\n[/divbox]';
                                const lspdResult = await lspdClient.postTopic(1361, lspdTopicTitle, lspdTopicBody, 'https://lspd.gta.world/posting.php?mode=post&f=1361');
                                if (lspdResult.ok) {
                                    const tM = lspdResult.url.match(/[?&]t=(\d+)/);
                                    if (tM) {
                                        lspdTopicId = tM[1];  // was: const lspdTopicId
                                        console.log('[AUTOPSY-MON] Created LSPD topic #' + lspdTopicId + ' for request');
                                        // Batched: topic id + crosspost status in one update (same values).
                                        _db.ref('autopsy-requested/' + topic.topicId).update({ lspdTopicId, lspdCrosspostStatus: 'pending' }).catch(() => {});
                                    } else {
                                        console.warn('[AUTOPSY-MON] Step 3 — LSPD topic created but could not extract topic ID from URL: ' + lspdResult.url);
                                    }
                                } else {
                                    console.warn('[AUTOPSY-MON] Step 3 — Failed to create LSPD topic: ' + (lspdResult.reason || 'unknown'));
                                }
                            } catch (err) {
                                console.warn('[AUTOPSY-MON] Step 3 — LSPD topic creation error: ' + err.message);
                            }
                            }
                        } else {
                            console.log('[AUTOPSY-MON] Step 3 — LSPD topic creation skipped (faction=' + (parsed.faction || 'none') + ')');
                        }

                        // --- Send acknowledgement reply to PHMC + the faction's own forum + LSPD ---
                        const ackOpts = { baseUrl: PHMC_BASE, lspdTopicId };
                        if (agencyFactionKey === 'LSSD') ackOpts.lssdTopicId = agencyAckTopicId;
                        else if (agencyFactionKey) {
                            // SADCR/DAO ride the generic registry branch (own subforum, shared login)
                            ackOpts.agencyTopicId = agencyAckTopicId;
                            ackOpts.agencyFaction = agencyFactionKey;
                        }
                        const ackResult = await sendAutopsyAcknowledgement(topic.topicId, requesterName, null, ackOpts);

                        // Log which ack targets were hit
                        if (ackResult.phmc) console.log('[AUTOPSY-MON] Acknowledgement sent to PHMC #' + topic.topicId);
                        if (agencyFactionKey && ackResult[agencyFactionKey.toLowerCase()]) console.log('[AUTOPSY-MON] Acknowledgement sent to ' + agencyFactionKey + ' #' + agencyAckTopicId);
                        if (ackResult.lspd) console.log('[AUTOPSY-MON] Acknowledgement sent to LSPD #' + lspdTopicId);

                        // Save ack status to Firebase for retry tracking.
                        // Visible field names (ACK_FIELD_NAMES) + timestamps, so a
                        // failed/missing ack is easy to spot and auto-retried later.
                        const ackStatus = {};
                        const ackAt = {};
                        const nowIso = new Date().toISOString();
                        for (const [target, ok] of Object.entries(ackResult)) {
                            const field = ACK_FIELD_NAMES[target];
                            if (!field) continue;
                            if (ok === true) ackStatus[field] = 'completed';
                            else if (ok === false) ackStatus[field] = 'failed';
                            if (ok === true || ok === false) ackAt[field + '-at'] = nowIso;
                        }
                        if (Object.keys(ackStatus).length > 0) {
                            _db.ref('autopsy-requested/' + topic.topicId).update({ ...ackStatus, ...ackAt }).catch(() => {});
                            const failedAcks = Object.entries(ackStatus).filter(([, s]) => s === 'failed').map(([f]) => f);
                            if (failedAcks.length > 0) {
                                console.warn(`[AUTOPSY-MON] ⚠️ Ack FAILED for #${topic.topicId}: ${failedAcks.join(', ')} — flagged for automatic retry`);
                            }
                            console.log(`[AUTOPSY-MON] ACK status saved for #${topic.topicId}: ` + Object.entries(ackStatus).map(([f, s]) => `${f}=${s}`).join(', '));
                        }

                        // ── Crosspost step on the live progress embed ──
                        if (progress) {
                            if (parsed.faction === 'LSPD') {
                                const url = lspdTopicId ? `https://lspd.gta.world/viewtopic.php?t=${lspdTopicId}` : '';
                                if (ackResult.lspd === true) await progress.addStep('CROSSPOSTED TO LSPD', 'ok', url || 'Certified copy posted');
                                else if (ackResult.lspd === false) await progress.addStep('CROSSPOSTED TO LSPD', 'fail', url ? `Ack failed — ${url}` : 'Ack failed');
                                else await progress.addStep('CROSSPOSTED TO LSPD', 'skip', 'No LSPD certified copy for this request');
                            } else if (parsed.faction === 'LSSD') {
                                const url = agencyAckTopicId ? `https://lssd.gta.world/viewtopic.php?t=${agencyAckTopicId}` : '';
                                if (ackResult.lssd === true) await progress.addStep('CROSSPOSTED TO LSSD', 'ok', url || 'Certified copy posted');
                                else if (ackResult.lssd === false) await progress.addStep('CROSSPOSTED TO LSSD', 'fail', url ? `Ack failed — ${url}` : 'Ack failed');
                                else await progress.addStep('CROSSPOSTED TO LSSD', 'skip', 'No LSSD certified copy for this request');
                            } else if (isAgencyFaction(parsed.faction)) {
                                // SADCR/DAO — same shape as the LSSD branch, faction-keyed.
                                const cfgP = getAgencyForum(parsed.faction);
                                const url = agencyAckTopicId ? `${cfgP.baseUrl}/viewtopic.php?t=${agencyAckTopicId}` : '';
                                const okFlag = ackResult[String(parsed.faction).toLowerCase()];
                                const lbl = `CROSSPOSTED TO ${String(parsed.faction).toUpperCase()}`;
                                if (okFlag === true) await progress.addStep(lbl, 'ok', url || 'Certified copy posted');
                                else if (okFlag === false) await progress.addStep(lbl, 'fail', url ? `Ack failed — ${url}` : 'Ack failed');
                                else await progress.addStep(lbl, 'skip', 'No certified copy for this request');
                            }
                        }

                        await setState('ack_sent');
                    } catch (err) {
                        console.warn('[AUTOPSY-MON] Acknowledgement error: ' + err.message);
                    }
                }

                // Step 4: Update counters
                if (state === 'ack_sent') {
                    try {
                        const countKey = ['LSPD', 'LSSD', 'SADCR', 'DAO'].includes(parsed.faction) ? parsed.faction : 'OTHER';
                        const countRef = _db.ref(`autopsy-requests/${countKey}/count`);
                        const countSnap = await countRef.once('value');
                        const newCount = (countSnap.val() || 0) + 1;
                        await countRef.set(newCount);
                        await _db.ref(`autopsy-requests/${countKey}/lastUpdated`).set(Date.now());
                        console.log(`[AUTOPSY-MON] Counters updated — ${countKey}: ${newCount}`);
                    } catch (err) {
                        console.warn(`[AUTOPSY-MON] Counter update: ${err.message}`);
                    }
                    await setState('complete');
                    if (progress) await progress.finalize();
                }

            } catch (err) {
                console.error(`[AUTOPSY-MON] Case creation error: ${err.message}`);
            }
            }

            newRequests.push(entry);
        }

        // ── Discord Notifications ──
        if (_isFirstCycle) {
            _lastCheckTime = Date.now();
            _lastCheckSuccess = true;
            if (newRequests.length > 0) {
                await sendNotification(
                    'Autopsy Request Monitor — Initial Scan Complete',
                    `Found **${newRequests.length}** existing request(s) saved to Firebase. New requests will be notified as they appear.`,
                    0x00bcd4
                );
                await sendWebhookSummary(
                    `**Autopsy Monitor — Initial Scan** — ${newRequests.length} existing request(s) registered`
                );
            } else {
                console.log('[AUTOPSY-MON] No existing requests found on initial scan');
            }
            _isFirstCycle = false;
            return;
        }

        // Subsequent cycles — each new request already got its own live
        // progress embed during processing (case created → ME assigned →
        // crossposted), so no per-request or batch notification is needed here.
        if (newRequests.length > 0) {
            console.log(`[AUTOPSY-MON] ${newRequests.length} new request(s) processed this cycle`);
        } else {
            console.log('[AUTOPSY-MON] No new autopsy requests found');
        }

        _lastCheckTime = Date.now();
        _lastCheckSuccess = true;

    } catch (err) {
        _lastCheckTime = Date.now();
        _lastCheckSuccess = false;
        console.error('[AUTOPSY-MON] Error during forum check:', err.message);
        console.error(err.stack);
    }
}

/**
 * Single-thread intake for MASS autopsy requests (Task 2).
 *
 * Unlike the legacy multi path (one f=266 topic per decedent), a mass request
 * files ONE case number, ONE f=266 topic with concatenated bodies, one grouped
 * ack, and bumps the faction counter by the body count. Per-body rows live
 * under `autopsy-requested/<topicId>/cases/<i>/` with assignment/completion
 * left null for downstream workers.
 *
 * Firebase shape written:
 *   autopsy-requested/<topicId>/caseState = 'multi'
 *   autopsy-requested/<topicId>/isMassSingleThread = true
 *   autopsy-requested/<topicId>/caseNum, caseTitle, caseUrl, caseTopicId
 *   autopsy-requested/<topicId>/decedentCount = N
 *   autopsy-requested/<topicId>/cases/<i> = { name, oocName,
 *     assignedTo: null, completedAt: null, replyPostId: null }
 *
 * DRY_RUN respected throughout: with AUTOPSY_DRY_RUN=true (never set
 * dryRun:false in tests) no forum post/reply is made — state is recorded and
 * the function returns after the dry-run summary.
 */
async function processMassRequest({ db, topic, parsed, mass, requestBbCode, processed }) {
    const topicId = topic.topicId;
    const rootRef = db.ref(`autopsy-requested/${topicId}`);
    const existing = (processed && processed[topicId]) || {};
    const bodies = (mass && mass.bodies) || [];
    const N = bodies.length;
    if (N === 0) return;
    const isDryRun = process.env.AUTOPSY_DRY_RUN !== 'false';
    const factionTag = parsed.faction ? ` [${parsed.faction}]` : '';
    // phpBB flood control trips on rapid same-author posts. The mass flow
    // emits an OP post + N replies + an ack in one burst, so it paces itself
    // proactively (the forumClient 25s×3 flood retry stays as backstop).
    // Without this the process can die mid-burst (e.g. SIGINT during a flood
    // wait) leaving replies/title/panel/ack half-done with no resume path.
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const MASS_OP_SETTLE_MS = 20000; // OP post -> first reply
    const MASS_REPLY_GAP_MS = 15000; // between consecutive replies
    const MASS_ACK_GAP_MS = 15000; // last reply -> ack

    // Marker so the detection loop skips this topic on later cycles.
    // Batched: intake markers in one update (same values; dryRun only when dry-run, as before).
    const massIntakeUpdate = { caseState: 'multi', isMassSingleThread: true, decedentCount: N };
    if (isDryRun) massIntakeUpdate.dryRun = true;
    await rootRef.update(massIntakeUpdate).catch(() => {});
    // Parser warnings (duplicate headers, incomplete bodies) persist for ME
    // visibility and are logged + added to the progress embed below.
    const massWarnings = (mass && Array.isArray(mass.warnings) ? mass.warnings : []).filter(Boolean);
    if (massWarnings.length > 0) {
        await rootRef.child('bodyWarnings').set(massWarnings).catch(() => {});
        for (const w of massWarnings) console.warn(`[MASS] #${topicId} WARN: ${w}`);
    }
    const massSkipped = (mass && Array.isArray(mass.skippedBodies) ? mass.skippedBodies : []).filter(Boolean);
    if (massSkipped.length > 0) {
        await rootRef.child('skippedBodies').set(massSkipped).catch(() => {});
        for (const s of massSkipped) console.warn(`[MASS] #${topicId} SKIPPED BODY ${s.label}: ${s.reason}`);
    }

    // Per-body intake trace — one FOUND line per body so detection issues
    // are debuggable from the log alone (which body parsed, what fields).
    console.log(`[MASS] #${topicId}: ${N} ${N === 1 ? 'body' : 'bodies'} parsed from request`);
    for (let i = 0; i < N; i++) {
        const b = bodies[i];
        console.log(`[MASS] #${topicId} BODY ${i + 1}/${N} FOUND: ${b.name || '?'} ((${b.oocName || '?'})) | ${b.sex || '?'} | ${b.dateOfDeath || '?'} ${b.timeOfDeath || ''} | ${b.placeOfDeath || '?'}`);
    }
    const sharedBits = mass.shared || {};
    console.log(`[MASS] #${topicId} shared: requester="${sharedBits.requesterName || '?'}" deathType="${sharedBits.deathType || '?'}" override="${(sharedBits.assignedOverride || '').trim() || 'none'}"`);

    // Per-body rows — full field snapshot per body (not just identity) so
    // downstream readers (panel refresh, dashboards) can rebuild without the
    // original post. Assignment/completion owned downstream; intake leaves
    // assignedTo/completedAt/replyPostId null (RTDB stores null as absent).
    for (let i = 0; i < N; i++) {
        const b = bodies[i];
        const cRef = db.ref(`autopsy-requested/${topicId}/cases/${i}`);
        // Batched: full per-body field snapshot in one update (same values;
        // nulls delete the keys, matching the old set(null) semantics).
        const bodyUpdate = {
            name: b.name || '',
            oocName: b.oocName || '',
            sex: b.sex || '',
            ethnicity: b.ethnicity || '',
            dateOfDeath: b.dateOfDeath || '',
            timeOfDeath: b.timeOfDeath || '',
            placeOfDeath: b.placeOfDeath || '',
            assignedTo: null,
            completedAt: null,
            replyPostId: null,
        };
        if (Array.isArray(b.incomplete) && b.incomplete.length > 0) {
            bodyUpdate.incompleteFields = b.incomplete;
        }
        await cRef.update(bodyUpdate).catch(() => {});
        console.log(`[MASS] #${topicId} BODY ${i + 1}/${N} Firebase cases/${i} staged (full field snapshot, assignment pending)`);
    }

    // ONE case number: max Case N in f=266 + 1 (single lookup, not per body).
    // An EMPTY listing almost always means a stale session/login wall, NOT an
    // empty forum — allocating from it files a duplicate "Case 1" (seen live:
    // f=266 returned 0 topics, thread filed as Case 1). Retry once after a
    // forced login; if still empty, abort WITHOUT filing and re-arm detection
    // so the next cycle retries. Never allocate from an empty scan.
    let caseNum = existing.caseNum || '';
    if (!caseNum) {
        try {
            const cc = getForumClient();
            await cc.ensureBrowser();
            let existingTopics = await cc.getForumTopics(266, { baseUrl: PHMC_BASE });
            if (!existingTopics || existingTopics.length === 0) {
                console.warn('[AUTOPSY-MON] [WARN] Mass case-number scan empty — forcing login and retrying once');
                try {
                    await cc.login(null, null, { force: true, baseUrl: PHMC_BASE });
                    existingTopics = await cc.getForumTopics(266, { baseUrl: PHMC_BASE });
                } catch { /* retry-login best-effort ignored: empty-list guard below aborts safely with an ERR log */ }
            }
            if (!existingTopics || existingTopics.length === 0) {
                console.error('[AUTOPSY-MON] [ERR] Mass case-number scan empty twice — aborting, NOT filing Case 1; will retry next cycle');
                // Batched: re-arm marker + error in one update (same values).
                await rootRef.update({ caseState: '', caseNumError: 'empty f=266 listing' }).catch(() => {});
                return;
            }
            let highest = 0;
            for (const t of existingTopics) {
                const m = t.title.match(/Case\s*(\d+)/i);
                if (m) { const n = parseInt(m[1], 10); if (n > highest) highest = n; }
            }
            caseNum = String(highest + 1);
            await rootRef.child('caseNum').set(caseNum).catch(() => {});
            console.log(`[AUTOPSY-MON] [OK] Mass request — highest case #${highest} -> single case #${caseNum} for ${N} bodies`);
        } catch (err) {
            console.warn(`[AUTOPSY-MON] [WARN] Mass case-number lookup: ${err.message}`);
        }
    }

    // Case thread title carries the incident label from the request title
    // (e.g. "Test Davis Shooting"), NOT the generic "Mass Autopsy Request" —
    // and NEVER the ME roster (5 names overflow forum title limits and bury
    // the incident):   Case XX - IncidentName (N bodies) [AGENCY] - ASSIGNED
    // Falls back to the generic label when the title won't parse.
    let incidentLabel = 'Mass Autopsy Request';
    try {
        const parsedMassTitle = parseMassTitle(topic.title);
        if (parsedMassTitle && parsedMassTitle.label) incidentLabel = parsedMassTitle.label;
    } catch { /* fallback above */ }
    const caseTitle = `Case ${caseNum} - ${incidentLabel} (${N} ${N === 1 ? 'body' : 'bodies'})${factionTag} - UNASSIGNED`;
    await rootRef.child('caseTitle').set(caseTitle).catch(() => {});

    if (isDryRun) {
        console.log(`[AUTOPSY-MON] DRY RUN — would create single mass case for #${topicId}: "${caseTitle}"`);
        try {
            const sharedOverride = (mass.shared && mass.shared.assignedOverride) || '';
            const preview = await selectMEsForMass(db, N, { overrides: bodies.map(() => sharedOverride), commit: false });
            console.log(`[AUTOPSY-MON] DRY RUN — mass assignment preview: ${preview.map((p, i) => `Body ${i + 1}->${p || '(none)'}`).join(' | ')}`);
        } catch (e) {
            console.warn(`[AUTOPSY-MON] DRY RUN — mass assignment preview failed: ${e.message}`);
        }
        await sendWebhookSummary(`**[DRY RUN] Mass Autopsy Case Would Be Created**\n${caseTitle}\nTopic: ${topic.href}`);
        return;
    }

    const progress = await getAutopsyProgress(db, topicId, `Mass Autopsy — ${N} ${N === 1 ? 'body' : 'bodies'}${factionTag}`, existing).catch(() => null);
    if (progress) await progress.addStep('Autopsy Case Detected', 'ok', `${N} bodies — single case thread`);

    // ONE postTopic(266) with concatenated bodies (raw request BBCode verbatim
    // under a one-line mass header — zero re-formatting, zero data loss).
    const fullBody = `[b]Mass Autopsy Request — ${incidentLabel} — ${N} ${N === 1 ? 'body' : 'bodies'} (single case thread)[/b]\n${requestBbCode || ''}`;
    let chunks = [fullBody];
    if (fullBody.length > 55000) {
        // 55k-char chunk fallback — split ONLY at --- BODY --- boundaries via
        // the chunker module; overflow chunks post as replies to the same
        // single case thread. Falls back to the single body when absent.
        // Probes splitAtBodyBoundaries first (canonical Task-6 export), then
        // the legacy entry points shared with chunkMassPayloadIfNeeded() in
        // deployAutopsyReply.js so both call sites agree.
        try {
            const fn = await getMassChunker();
            if (typeof fn === 'function') {
                const out = await fn(fullBody, 55000);
                if (Array.isArray(out) && out.length && out.every((p) => typeof p === 'string')) chunks = out;
            }
        } catch { chunks = [fullBody]; }
    }

    try {
        const cc = getForumClient();
        const result = await cc.postTopic(266, caseTitle, chunks[0], `${PHMC_BASE}/posting.php?mode=post&f=266`);
        if (!result.ok) {
            console.warn(`[AUTOPSY-MON] [WARN] Mass case creation failed: ${result.reason || 'unknown'}`);
            if (progress) {
                await progress.addStep('FOUND: CASE', 'fail', result.reason || 'unknown');
                await progress.finalize();
            }
            return;
        }
        console.log(`[AUTOPSY-MON] [OK] Mass case created: ${result.url}`);
        // Batched: caseUrl (+caseTopicId when the URL carries t=) in one update (same values).
        const massCaseUpdate = { caseUrl: result.url };
        const tMatch = (result.url || '').match(/[?&]t=(\d+)/);
        const massCaseTopicId = tMatch ? tMatch[1] : '';
        if (massCaseTopicId) massCaseUpdate.caseTopicId = massCaseTopicId;
        await rootRef.update(massCaseUpdate).catch(() => {});
        if (progress) {
            await progress.addStep('FOUND: CASE', 'ok', caseTitle);
            await progress.addStep('POSTED TO CASE MANAGEMENT', 'ok', result.url);
            if (massWarnings.length > 0) {
                await progress.addStep('REQUEST WARNINGS', 'warn', massWarnings.slice(0, 5).join(' | ') + (massWarnings.length > 5 ? ` (+${massWarnings.length - 5} more)` : ''));
            }
        }

        // Overflow chunks (only when the optional chunker split the body) go
        // on as replies to the same single case thread — still ONE topic.
        // Paced: back-to-back replies trip phpBB flood control.
        if (massCaseTopicId && chunks.length > 1) {
            for (let ci = 1; ci < chunks.length; ci++) {
                await sleep(MASS_REPLY_GAP_MS);
                try {
                    const r = await cc.replyToTopic(massCaseTopicId, 266, chunks[ci], { dryRun: false, baseUrl: PHMC_BASE });
                    console.log(`[AUTOPSY-MON] Mass overflow chunk ${ci + 1}/${chunks.length}: ${r.ok ? '[OK]' : '[WARN] ' + (r.reason || 'failed')}`);
                } catch (e) {
                    console.warn(`[AUTOPSY-MON] [WARN] Mass overflow chunk ${ci + 1} error: ${e.message}`);
                }
            }
        }

        // ── Batch ME assignment (Mass Rework Fix 2a) ──
        // ONE snapshot pick for all N bodies via selectMEsForMass (no stale-count
        // races, no N sequential selectME reads). The single shared Section-3
        // ASSIGNED: marker applies to every body; a LOA'd marker falls back to
        // rotation per body inside the picker (never forces all N onto one ME).
        // Replies are grouped per ME inside the ONE shared thread; the title
        // carries the aggregate ME list (shared-OP convention, Fix 3).
        let massCaseTitle = caseTitle;
        try {
            const ccAssign = getForumClient();
            let memberList = [];
            try {
                memberList = await ccAssign.getGroupMembers(50, { baseUrl: PHMC_BASE, exclude: ['PHMC Forms Bot'], paginate: true });
                await initializeRotationFromGroup(db, memberList);
                await syncRotationFromGroup(db, memberList);
            } catch (e) {
                console.warn(`[AUTOPSY-MON] [WARN] Mass rotation sync: ${e.message}`);
            }
            const sharedOverride = (mass.shared && mass.shared.assignedOverride) || '';
            const rawPicks = await selectMEsForMass(db, N, {
                overrides: bodies.map(() => sharedOverride),
                commit: true,
                topicIds: bodies.map(() => topicId),
                caseNums: bodies.map(() => caseNum),
            });
            // Canonical forum casing for display (titles, Firebase, panel):
            // dev-test pins and overrides may arrive lowercase — resolve
            // against the group roster, falling back to the raw pick.
            const massPicks = rawPicks.map((p) => {
                if (!p) return p;
                const hit = memberList.find((m) => m.name.toLowerCase() === String(p).toLowerCase());
                return hit ? hit.name : p;
            });
            const uniqueMEs = [];
            for (let i = 0; i < N; i++) {
                const me = massPicks[i] || null;
                const cRef = db.ref(`autopsy-requested/${topicId}/cases/${i}`);
                // Batched: per-body assignment outcome in one update (same values per branch).
                if (me) {
                    await cRef.update({ assignedTo: me, assignmentReplyStatus: 'attempting' }).catch(() => {});
                    if (!uniqueMEs.includes(me)) uniqueMEs.push(me);
                    console.log(`[MASS] #${topicId} BODY ${i + 1}/${N} ASSIGNED: ${bodies[i].name || '?'} ((${bodies[i].oocName || '?'})) -> ${me}`);
                } else {
                    await cRef.update({ assignmentReplyStatus: 'failed' }).catch(() => {});
                    console.warn(`[MASS] #${topicId} BODY ${i + 1}/${N} UNASSIGNED: ${bodies[i].name || '?'} — no ME available (check rotation/LOA)`);
                }
            }
            if (uniqueMEs.length > 0) {
                await rootRef.child('assignedTo').set(uniqueMEs.join(', ')).catch(() => {});
            }
            // Morgue pre-match runs BEFORE the assignment post so the post, the
            // panel, and the ack all share one result per body. Best-effort and
            // never fatal: null = lookup unavailable (stays silent everywhere),
            // { found:false } = definitive miss (flagged everywhere).
            let morgueByBody = bodies.map(() => null);
            try {
                const { findMorgueRecord } = await import('./deathRecordDraftCache.js');
                for (let i = 0; i < N; i++) {
                    // Two-pass match (mirrors deathRecordDraftScan): IC name
                    // first, then the OOC name as the search term — PK
                    // bodies filed as "John Doe" match "Unknown (( OOC ))"
                    // morgue records only via the second pass.
                    const tries = [bodies[i].name];
                    if (bodies[i].oocName && bodies[i].oocName.toLowerCase() !== String(bodies[i].name || '').toLowerCase()) {
                        tries.push(bodies[i].oocName);
                    }
                    let rec = null;
                    let via = '';
                    for (const term of tries) {
                        if (!term || rec) continue;
                        try {
                            rec = await findMorgueRecord(db, term, bodies[i].dateOfDeath, bodies[i].oocName);
                            if (rec) via = ` via "${term}"`;
                        } catch {
                            rec = null;
                        }
                    }
                    try {
                        if (rec) {
                            const q = rec.matchQuality || {};
                            morgueByBody[i] = {
                                found: true,
                                caseId: rec.caseId || '',
                                name: rec.name || '',
                                level: q.level || '',
                                exactName: !!q.exactName,
                                candidateCount: typeof q.candidateCount === 'number' ? q.candidateCount : null,
                            };
                            console.log(`[MASS] #${topicId} BODY ${i + 1}/${N} MORGUE: CASE-${rec.caseId || '?'} "${rec.name || '?'}" (${q.exactName ? 'exact' : (q.level || 'possible')})${via}`);
                        } else {
                            morgueByBody[i] = { found: false };
                            console.log(`[MASS] #${topicId} BODY ${i + 1}/${N} MORGUE: none found matching "${bodies[i].name || '?'}"${bodies[i].oocName ? ` / "${bodies[i].oocName}"` : ''}`);
                        }
                    } catch {
                        morgueByBody[i] = null;
                        console.warn(`[MASS] #${topicId} BODY ${i + 1}/${N} MORGUE: lookup failed (stays silent)`);
                    }
                }
            } catch {
                morgueByBody = bodies.map(() => null);
                console.warn(`[MASS] #${topicId} morgue pre-match unavailable (import failed)`);
            }
            if (massCaseTopicId && uniqueMEs.length > 0) {
                // Settle pause: the OP post just landed — replying instantly
                // is what tripped flood control on the first live run.
                console.log(`[AUTOPSY-MON] Mass pacing: waiting ${MASS_OP_SETTLE_MS / 1000}s after OP post before the assignment reply`);
                await sleep(MASS_OP_SETTLE_MS);
                // ONE assignment post for the whole batch (all ME quote-pings +
                // the full body→ME table), not one reply per ME — single-thread
                // means single assignment post.
                const quotes = uniqueMEs.map((me) => {
                    const member = memberList.find((m) => m.name.toLowerCase() === me.toLowerCase());
                    const uid = member?.userId || '0';
                    return `[quote="${me}" user_id=${uid}]\n[/quote]`;
                }).join('\n');
                const tableLines = [];
                for (let i = 0; i < N; i++) {
                    const me = massPicks[i];
                    if (!me) {
                        tableLines.push(`Body ${i + 1}/${N}: ${bodies[i].name || 'Unknown'} ((${bodies[i].oocName || 'Unknown OOC'})) — UNASSIGNED (no ME available)`);
                    } else {
                        tableLines.push(`Body ${i + 1}/${N}: ${bodies[i].name || 'Unknown'} ((${bodies[i].oocName || 'Unknown OOC'})) → [b]${me}[/b]`);
                    }
                }
                // Definitive morgue misses are flagged right in the assignment
                // post (staff feedback: a quiet absence gets missed). Lookup
                // failures (null) stay silent — never alarm on our own error.
                const noRecordIdxs = [];
                for (let i = 0; i < N; i++) {
                    if (morgueByBody[i] && morgueByBody[i].found === false) noRecordIdxs.push(i);
                }
                let noRecordBlock = '';
                if (noRecordIdxs.length > 0) {
                    const scope = noRecordIdxs.length === N ? 'any of these bodies' : 'the following bodies';
                    const who = noRecordIdxs.map((i) => `Body ${i + 1}/${N}: ${bodies[i].name || 'Unknown'} ((${bodies[i].oocName || 'Unknown OOC'}))`).join('; ');
                    noRecordBlock = `\n\n[b]Note — no morgue record found for ${scope}:[/b] ${who}. MEs: import manually or confirm identity before examining.`;
                }
                const assignBBCode = `${quotes}\n\n[b]Mass Autopsy Assignments — Case ${caseNum} (${N} ${N === 1 ? 'body' : 'bodies'})[/b]\n[list]${tableLines.map((l) => `[*]${l}`).join('')}[/list]${noRecordBlock}`;
                try {
                    const r = await ccAssign.replyToTopic(massCaseTopicId, 266, assignBBCode, { dryRun: false, baseUrl: PHMC_BASE });
                    for (let i = 0; i < N; i++) {
                        if (!massPicks[i]) continue;
                        await db.ref(`autopsy-requested/${topicId}/cases/${i}/assignmentReplyStatus`).set(r.ok ? 'completed' : 'failed').catch(() => {});
                    }
                    if (r.ok) console.log(`[AUTOPSY-MON] [OK] Mass assignment reply posted for ${uniqueMEs.join(', ')} (${N} bodies) on #${massCaseTopicId}`);
                    else console.warn(`[AUTOPSY-MON] [WARN] Mass assignment reply failed — will retry next cycle`);
                } catch (e) {
                    console.warn(`[AUTOPSY-MON] [WARN] Mass assignment reply error: ${e.message}`);
                    for (let i = 0; i < N; i++) {
                        if (!massPicks[i]) continue;
                        await db.ref(`autopsy-requested/${topicId}/cases/${i}/assignmentReplyStatus`).set('failed').catch(() => {});
                    }
                }
                // Mass shared-thread titles stay incident-shaped: ME names live
                // in the assignment post + panel, never in the forum title.
                massCaseTitle = caseTitle.replace('- UNASSIGNED', '- ASSIGNED');
                try {
                    await ccAssign.editTopicTitle(massCaseTopicId, 266, massCaseTitle, { baseUrl: PHMC_BASE });
                    await rootRef.child('caseTitle').set(massCaseTitle).catch(() => {});
                } catch (e) {
                    console.warn(`[AUTOPSY-MON] [WARN] Mass title edit failed: ${e.message}`);
                }
            }
            // Single panel message tagging all MEs (Fix 1b: panel module falls
            // back to the startup-registered Discord client). Panel posted →
            // skip per-ME pings; panel failed → fall back to one ping per ME.
            try {
                const { notifyMassAssignmentPanel, notifyAssignment } = await import('./meDiscordNotify.js');
                const sharedDeathType = (mass.shared && mass.shared.deathType) || '';
                // Morgue results come from the hoisted pre-match above (shared
                // with the assignment post) — no second lookup here.
                const panelAssignments = [];
                for (let i = 0; i < N; i++) {
                    if (!massPicks[i]) continue;
                    panelAssignments.push({
                        me: massPicks[i],
                        name: bodies[i].name,
                        ooc: bodies[i].oocName,
                        sex: bodies[i].sex,
                        dateOfDeath: bodies[i].dateOfDeath,
                        timeOfDeath: bodies[i].timeOfDeath,
                        deathType: sharedDeathType,
                        synopsis: (mass.shared && mass.shared.synopsis) || '',
                        placeOfDeath: bodies[i].placeOfDeath,
                        morgue: morgueByBody[i],
                        caseUrl: result.url,
                        caseNum,
                        caseTitle: massCaseTitle,
                    });
                }
                const panelRes = await notifyMassAssignmentPanel(db, null, panelAssignments, { requestTopicId: topicId });
                if (!panelRes || !panelRes.posted) {
                    const caseUrl = result.url || '';
                    for (const me of uniqueMEs) {
                        try {
                            await notifyAssignment(db, me, massCaseTitle, caseUrl, {
                                isMassAutopsy: true,
                                caseNumber: caseNum,
                                deathType: (mass.shared && mass.shared.deathType) || '',
                                requestTopicId: topicId,
                            });
                        } catch (e) {
                            console.warn(`[AUTOPSY-MON] Mass fallback notify failed for ${me}: ${e.message}`);
                        }
                    }
                }
            } catch (e) {
                console.warn(`[AUTOPSY-MON] Mass panel notify failed: ${e.message}`);
            }
            if (progress) {
                if (uniqueMEs.length > 0) await progress.addStep('ASSIGNED MEDICAL EXAMINER', 'ok', `Mass batch: ${uniqueMEs.join(', ')} (${N} bodies)`);
                else await progress.addStep('ASSIGNED MEDICAL EXAMINER', 'fail', 'No ME available — check rotation/LOA');
            }
        } catch (err) {
            console.error(`[AUTOPSY-MON] [ERR] Mass assignment error: ${err.message}`);
            if (progress) await progress.addStep('ASSIGNED MEDICAL EXAMINER', 'fail', err.message);
        }

        // ── Agency crosspost (LSSD/SADCR/DAO registry — mass single-thread) ──
        // Mirrors the legacy multi-decedent Step 3 agency branch (isAgencyFaction
        // gate, ensureAgencyRequestTopic with caseLabelLine, agencyAckTopicId /
        // agencyFactionKey capture, ackOpts wiring below). caseLabelLine carries
        // one line per body with the just-completed batch assignment (read back
        // from Firebase — massPicks is scoped inside the assignment try above).
        // Declared with let so the LSPD worker can extend the same ack call
        // below with its own lspdTopicId.
        let agencyAckTopicId = null;   // request topic on the faction's own forum
        let agencyFactionKey = null;   // 'LSSD' | 'SADCR' | 'DAO'
        if (!isDryRun && isAgencyFaction(parsed.faction) && N > 0) {
            try {
                const cfgA = getAgencyForum(parsed.faction);
                if (!cfgA) {
                    console.log('[AUTOPSY-MON] Step 3 — Agency crosspost skipped (unknown faction=' + (parsed.faction || 'none') + ')');
                } else {
                    const searchOoc = parsed.oocName || (bodies[0] && bodies[0].oocName) || '';
                    const searchName = parsed.name || (bodies[0] && bodies[0].name) || '';
                    if (!searchOoc && !searchName) {
                        console.log('[AUTOPSY-MON] Step 3 — Agency crosspost skipped (no decedent name/OOC for search)');
                    } else {
                        const existingAgencyTopicId = existing[cfgA.topicField]
                            || (await rootRef.child(cfgA.topicField).once('value')).val()
                            || '';
                        const meByBody = [];
                        for (let i = 0; i < N; i++) {
                            try {
                                meByBody.push((await rootRef.child(`cases/${i}/assignedTo`).once('value')).val() || '');
                            } catch { meByBody.push(''); }
                        }
                        const caseLabelLine = bodies.map((b, i) => `Case ${caseNum} — Body ${i + 1}/${N}: ${b.name || 'Unknown'} ((${b.oocName || 'Unknown OOC'})) → ${meByBody[i] || 'UNASSIGNED'}`).join(' | ');
                        const ensured = await ensureAgencyRequestTopic({
                            db,
                            topicId,
                            faction: parsed.faction,
                            oocName: searchOoc,
                            name: searchName,
                            requestBbCode,
                            caseLabelLine,
                            existingTopicId: existingAgencyTopicId,
                            requesterPoster: existing.requesterPoster || '',
                            topicTitle: `[Mass Autopsy Request] ${incidentLabel} [${String(parsed.faction).toUpperCase()}]`,
                        });
                        agencyAckTopicId = ensured.topicId;
                        agencyFactionKey = String(parsed.faction).toUpperCase();
                        if (!agencyAckTopicId) {
                            console.log('[AUTOPSY-MON] Step 3 — Agency crosspost yielded no topic (faction=' + agencyFactionKey + ')');
                        }
                    }
                }
            } catch (err) {
                console.warn('[AUTOPSY-MON] [WARN] Mass agency crosspost error: ' + err.message);
            }
        } else {
            console.log('[AUTOPSY-MON] Step 3 — Agency crosspost skipped (faction=' + (parsed.faction || 'none') + ')');
        }

        // ── LSPD crosspost (mass single-thread) ──
        // Mirrors the legacy multi-decedent LSPD branch (parsed.faction ===
        // 'LSPD' gate, reuse existing lspdTopicId from existing/rootRef, else
        // create the f=1361 request copy and persist lspdTopicId). caseLabelLine
        // lists all bodies with their MEs, read back from cases/<i>/assignedTo
        // like the agency block above (massPicks is scoped to the assignment try).
        // Declared with let so the shared ack call below carries agency + LSPD.
        let lspdTopicId = null;   // request topic on the LSPD forum (f=1361)
        if (!isDryRun && parsed.faction === 'LSPD' && N > 0) {
            try {
                const existingLspd = existing.lspdTopicId
                    || (await rootRef.child('lspdTopicId').once('value')).val()
                    || '';
                if (existingLspd) {
                    lspdTopicId = String(existingLspd);
                    console.log('[AUTOPSY-MON] Reusing existing LSPD topic #' + lspdTopicId + ' for mass request');
                    // Heal pre-fix first-body titles to the incident-label shape
                    // (best-effort — the topic stays usable if this fails).
                    try {
                        const healClient = getForumClient();
                        await healClient.login(process.env.FORUM_LSPD_USERNAME, process.env.FORUM_LSPD_PASSWORD, { force: false, baseUrl: 'https://lspd.gta.world' });
                        await healClient.editTopicTitle(lspdTopicId, 1361, `[Mass Autopsy Request] ${incidentLabel} [LSPD]`, { baseUrl: 'https://lspd.gta.world' });
                        console.log('[AUTOPSY-MON] Healed LSPD topic #' + lspdTopicId + ' title to incident-label shape');
                    } catch (e) {
                        console.warn('[AUTOPSY-MON] [WARN] Mass LSPD title heal failed: ' + e.message);
                    }
                } else {
                    const searchOoc = parsed.oocName || (bodies[0] && bodies[0].oocName) || '';
                    const searchName = parsed.name || (bodies[0] && bodies[0].name) || '';
                    const meByBody = [];
                    for (let i = 0; i < N; i++) {
                        try {
                            meByBody.push((await rootRef.child(`cases/${i}/assignedTo`).once('value')).val() || '');
                        } catch { meByBody.push(''); }
                    }
                    const caseLabelLine = bodies.map((b, i) => `Case ${caseNum} — Body ${i + 1}/${N}: ${b.name || 'Unknown'} ((${b.oocName || 'Unknown OOC'})) → ${meByBody[i] || 'UNASSIGNED'}`).join(' | ');
                    const lspdClient = getForumClient();
                    await lspdClient.login(process.env.FORUM_LSPD_USERNAME, process.env.FORUM_LSPD_PASSWORD, { force: false, baseUrl: 'https://lspd.gta.world' });
                    // Dynamic mass title mirroring the request thread — never the
                    // legacy singular "Autopsy Request - Name ((OOC))" shape.
                    const lspdTopicTitle = `[Mass Autopsy Request] ${incidentLabel} [LSPD]`;
                    const lspdTopicBody = requestBbCode
                        ? '[divbox=white][center][b][size=170]AUTOPSY REQUEST — CERIFIED COPY [/size][/b][/center][hr][/hr]\n' + requestBbCode + '\n[hr][/hr][b]Cases:[/b] ' + caseLabelLine + '\n[b]Status:[/b] Under Investigation\n[/divbox]'
                        : '[divbox=white][b]Autopsy Request[/b]\n[b]Decedent:[/b] ' + searchName + (searchOoc ? ' ((' + searchOoc + '))' : '') + '\n[b]Cases:[/b] ' + caseLabelLine + '\n[b]Status:[/b] Under Investigation\n[/divbox]';
                    const lspdResult = await lspdClient.postTopic(1361, lspdTopicTitle, lspdTopicBody, 'https://lspd.gta.world/posting.php?mode=post&f=1361');
                    if (lspdResult.ok) {
                        const tM = (lspdResult.url || '').match(/[?&]t=(\d+)/);
                        if (tM) {
                            lspdTopicId = tM[1];
                            console.log('[AUTOPSY-MON] Created LSPD topic #' + lspdTopicId + ' for mass request');
                            // Batched: topic id + crosspost status in one update (same values).
                            rootRef.update({ lspdTopicId, lspdCrosspostStatus: 'pending' }).catch(() => {});
                        } else {
                            console.warn('[AUTOPSY-MON] [WARN] Mass LSPD topic created but could not extract topic ID from URL: ' + lspdResult.url);
                        }
                    } else {
                        console.warn('[AUTOPSY-MON] [WARN] Mass LSPD topic creation failed: ' + (lspdResult.reason || 'unknown'));
                    }
                }
            } catch (err) {
                console.warn('[AUTOPSY-MON] [WARN] Mass LSPD crosspost error: ' + err.message);
            }
        } else {
            console.log('[AUTOPSY-MON] Step 3 — LSPD topic creation skipped (faction=' + (parsed.faction || 'none') + ')');
        }

        // One grouped ack on the PHMC request topic. Paced after the last
        // assignment reply for the same flood-control reason as above.
        try {
            await sleep(MASS_ACK_GAP_MS);
            const requesterName = (mass.shared && mass.shared.requesterName) || parsed.name || '';
            const ackOpts = { baseUrl: PHMC_BASE };
            ackOpts.lspdTopicId = lspdTopicId;
            if (agencyFactionKey === 'LSSD') ackOpts.lssdTopicId = agencyAckTopicId;
            else if (agencyFactionKey) {
                ackOpts.agencyTopicId = agencyAckTopicId;
                ackOpts.agencyFaction = agencyFactionKey;
            }
            const ackResult = await sendAutopsyAcknowledgement(topic.topicId, requesterName, null, ackOpts);
            if (ackResult.phmc) console.log(`[AUTOPSY-MON] [OK] Grouped acknowledgement sent to PHMC #${topic.topicId}`);
            if (agencyFactionKey && ackResult[agencyFactionKey.toLowerCase()]) console.log(`[AUTOPSY-MON] [OK] Grouped acknowledgement sent to ${agencyFactionKey} #${agencyAckTopicId}`);
            if (parsed.faction === 'LSPD' && ackResult.lspd) console.log(`[AUTOPSY-MON] [OK] Grouped acknowledgement sent to LSPD #${lspdTopicId}`);
            const ackStatus = {};
            const ackAt = {};
            const nowIso = new Date().toISOString();
            for (const [target, ok] of Object.entries(ackResult)) {
                const field = ACK_FIELD_NAMES[target];
                if (!field) continue;
                if (ok === true) ackStatus[field] = 'completed';
                else if (ok === false) ackStatus[field] = 'failed';
                if (ok === true || ok === false) ackAt[field + '-at'] = nowIso;
            }
            if (Object.keys(ackStatus).length > 0) {
                db.ref(`autopsy-requested/${topicId}`).update({ ...ackStatus, ...ackAt }).catch(() => {});
            }
            if (progress) {
                if (ackResult.phmc === true) await progress.addStep('ACK SENT', 'ok', 'Grouped acknowledgement');
                else if (ackResult.phmc === false) await progress.addStep('ACK SENT', 'fail', 'Ack failed — flagged for retry');
                else await progress.addStep('ACK SENT', 'skip', 'No ack target');
                if (agencyFactionKey) {
                    const cfgP = getAgencyForum(agencyFactionKey);
                    const url = (agencyAckTopicId && cfgP) ? `${cfgP.baseUrl}/viewtopic.php?t=${agencyAckTopicId}` : '';
                    const lbl = `CROSSPOSTED TO ${agencyFactionKey}`;
                    const okFlag = ackResult[agencyFactionKey.toLowerCase()];
                    if (okFlag === true) await progress.addStep(lbl, 'ok', url || 'Certified copy posted');
                    else if (okFlag === false) await progress.addStep(lbl, 'fail', url ? `Ack failed — ${url}` : 'Ack failed');
                    else await progress.addStep(lbl, 'skip', 'No certified copy for this request');
                }
                if (parsed.faction === 'LSPD') {
                    const lspdUrl = lspdTopicId ? `https://lspd.gta.world/viewtopic.php?t=${lspdTopicId}` : '';
                    if (ackResult.lspd === true) await progress.addStep('CROSSPOSTED TO LSPD', 'ok', lspdUrl || 'Certified copy posted');
                    else if (ackResult.lspd === false) await progress.addStep('CROSSPOSTED TO LSPD', 'fail', lspdUrl ? `Ack failed — ${lspdUrl}` : 'Ack failed');
                    else await progress.addStep('CROSSPOSTED TO LSPD', 'skip', 'No LSPD certified copy for this request');
                }
            }
        } catch (err) {
            console.warn(`[AUTOPSY-MON] [WARN] Mass acknowledgement error: ${err.message}`);
        }

        // Faction counter +N (one bump for the whole batch).
        try {
            const countKey = ['LSPD', 'LSSD', 'SADCR', 'DAO'].includes(parsed.faction) ? parsed.faction : 'OTHER';
            const countRef = db.ref(`autopsy-requests/${countKey}/count`);
            const countSnap = await countRef.once('value');
            const newCount = (countSnap.val() || 0) + N;
            await countRef.set(newCount);
            await db.ref(`autopsy-requests/${countKey}/lastUpdated`).set(Date.now());
            console.log(`[AUTOPSY-MON] [OK] Counters updated — ${countKey}: +${N} -> ${newCount}`);
        } catch (err) {
            console.warn(`[AUTOPSY-MON] [WARN] Mass counter update: ${err.message}`);
        }
        if (progress) await progress.finalize();
    } catch (err) {
        console.error(`[AUTOPSY-MON] [ERR] Mass case creation error: ${err.message}`);
    }
}

/**
 * Case state machine for MULTI-decedent autopsy requests.
 *
 * One request topic with N decedents ("John Doe[1]((OOC A))", "John Doe[2]
 * ((OOC B))") gets N case topics in f=266, each with its own case number,
 * its own fair-rotation ME assignment, and its own per-decedent state under
 * `autopsy-requested/<topicId>/cases/<idx>/`. Crossposts + acknowledgement
 * run ONCE per request after the cases are handled.
 *
 * The top-level record gets `caseState: 'multi'` so detection skips it, plus
 * `decedentCount` and an aggregated `assignedTo` for dashboards.
 */
async function processMultiDecedentRequest({ db, topic, parsed, decedents, requestBbCode, parsedBbFields, loaSet, processed }) {
    const topicId = topic.topicId;
    const rootRef = db.ref(`autopsy-requested/${topicId}`);
    const existing = processed[topicId] || {};
    const isDryRun = process.env.AUTOPSY_DRY_RUN !== 'false';

    // Marker so the detection loop skips this topic on later cycles.
    await rootRef.child('caseState').set('multi').catch(() => {});
    await rootRef.child('decedentCount').set(decedents.length).catch(() => {});

    // Consolidated live progress embed (one self-updating message per request).
    const progress = isDryRun ? null : await getAutopsyProgress(db, topicId, `Autopsy Case — ${parsed.name}${parsed.oocName ? ` ((${parsed.oocName}))` : ''}`, existing);
    if (progress) await progress.addStep('Autopsy Case Detected', 'ok', `Fetching Information — ${decedents.length} decedent(s)`);

    // ── Shared case-number base (one lookup, sequential per decedent) ──
    // Empty-listing guard (same as the mass path): abort and re-arm rather
    // than filing Case 1..N from a stale session's empty scan.
    let caseBase = existing.caseNum ? parseInt(String(existing.caseNum), 10) : 0;
    if (!existing.caseNum) {
        try {
            const cc = getForumClient();
            await cc.ensureBrowser();
            let existingTopics = await cc.getForumTopics(266, { baseUrl: PHMC_BASE });
            if (!existingTopics || existingTopics.length === 0) {
                console.warn('[AUTOPSY-MON] [WARN] Multi case-number scan empty — forcing login and retrying once');
                try {
                    await cc.login(null, null, { force: true, baseUrl: PHMC_BASE });
                    existingTopics = await cc.getForumTopics(266, { baseUrl: PHMC_BASE });
                } catch { /* retry-login best-effort ignored: empty-list guard below aborts safely with an ERR log */ }
            }
            if (!existingTopics || existingTopics.length === 0) {
                console.error('[AUTOPSY-MON] [ERR] Multi case-number scan empty twice — aborting, NOT filing; will retry next cycle');
                await rootRef.child('caseState').set('').catch(() => {});
                return;
            }
            let highest = 0;
            for (const t of existingTopics) {
                const m = t.title.match(/Case\s*(\d+)/i);
                if (m) { const n = parseInt(m[1], 10); if (n > highest) highest = n; }
            }
            caseBase = highest;
            await rootRef.child('caseNum').set(String(caseBase)).catch(() => {});
            console.log(`[AUTOPSY-MON] Highest case: #${caseBase} -> new cases #${caseBase + 1}..${caseBase + decedents.length}`);
        } catch (err) {
            console.warn(`[AUTOPSY-MON] Case number lookup: ${err.message}`);
        }
    }

    const assignedNames = [];
    const caseTitles = [];

    for (let i = 0; i < decedents.length; i++) {
        const decedent = decedents[i];
        const caseRef = db.ref(`autopsy-requested/${topicId}/cases/${i}`);
        const caseNum = String(caseBase + 1 + i);
        const marker = decedent.marker ? `[${decedent.marker}]` : '';
        const oocPart = decedent.oocName ? ` ((${decedent.oocName}))` : '';
        const factionTag = parsed.faction ? ` [${parsed.faction}]` : '';
        const caseTitle = `Case ${caseNum} - ${decedent.name}${marker}${oocPart}${factionTag} - UNASSIGNED`;
        caseTitles.push(caseTitle);

        // Per-case decedent identity — consumed by the web Assigned Autopsies
        // modal so each case shows under its own assigned ME.
        await caseRef.child('name').set(decedent.name).catch(() => {});
        await caseRef.child('oocName').set(decedent.oocName || '').catch(() => {});

        const existingCase = (await caseRef.once('value')).val() || {};
        const caseState = existingCase.caseState || '';
        if (caseState === 'complete' || caseState === 'dry_run') continue;

        if (isDryRun) {
            console.log(`[AUTOPSY-MON] DRY RUN — would create case for ${decedent.name}${marker}${oocPart}`);
            await sendWebhookSummary(`**[DRY RUN] Autopsy Case Would Be Created**\n${caseTitle}\nTopic: ${topic.href}`);
            await caseRef.child('caseState').set('dry_run').catch(() => {});
            continue;
        }

        // ── Step 1: Create the case topic in f=266 ──
        if (caseState === '') {
            console.log(`[AUTOPSY-MON] Creating case: "${caseTitle}"`);
            if (progress) await progress.addStep('FOUND: CASE', 'pending', `Decedent ${i + 1}/${decedents.length} — ${decedent.name}`);
            const cc = getForumClient();
            const result = await cc.quoteAndPost(topic.topicId, 265, 266, caseTitle, { baseUrl: PHMC_BASE });
            if (!result.ok) {
                console.warn(`[AUTOPSY-MON] Case creation failed: ${result.reason || 'unknown'}`);
                if (progress) await progress.addStep('FOUND: CASE', 'fail', `${decedent.name} — ${result.reason || 'unknown'}`);
                continue;
            }
            console.log(`[AUTOPSY-MON] Case created: ${result.url}`);
            await caseRef.child('caseUrl').set(result.url);
            const tMatch = result.url.match(/[?&]t=(\d+)/);
            if (tMatch) await caseRef.child('caseTopicId').set(tMatch[1]);
            await caseRef.child('caseTitle').set(caseTitle);
            await caseRef.child('caseNum').set(caseNum);
            await caseRef.child('caseState').set('case_created');
            if (progress) {
                await progress.addStep('FOUND: CASE', 'ok', caseTitle);
                await progress.addStep('POSTED TO CASE MANAGEMENT', 'ok', result.url);
            }
        }

        const caseUrl = existingCase.caseUrl || (await caseRef.child('caseUrl').once('value')).val() || '';

        // ── Step 2: Assign ME via fair rotation (per decedent) ──
        let assignedName = null;
        if (caseState === 'case_created' || (!existingCase.caseState && caseUrl)) {
            await caseRef.child('caseState').set('me_assigned');
            if (progress) await progress.addStep('ASSIGNED MEDICAL EXAMINER', 'pending', `Decedent ${i + 1}/${decedents.length} — ${decedent.name}`);
            const cc = getForumClient();
            try {
                const memberList = await cc.getGroupMembers(50, { baseUrl: PHMC_BASE, exclude: ['PHMC Forms Bot'], paginate: true });
                await initializeRotationFromGroup(db, memberList);
                const syncResult = await syncRotationFromGroup(db, memberList);
                if (syncResult && (syncResult.added.length > 0 || syncResult.removed.length > 0)) {
                    const msg = [
                        syncResult.added.length > 0 ? `New MEs added to rotation: ${syncResult.added.join(', ')}` : '',
                        syncResult.removed.length > 0 ? `Removed from rotation: ${syncResult.removed.join(', ')}` : '',
                    ].filter(Boolean).join(' | ');
                    console.log(`[ROTATION] ${msg}`);
                    try { await sendLogMessage(`[ROTATION] ${msg}`); } catch { /* ignore */ }
                }

                // DEV TEST MODE outranks supervised overrides + rotation here too.
                const devForcedME = getDevTestME();
                const overrideRaw = (parsedBbFields.assignedOverride || '').trim();
                const overrideName = overrideRaw.replace(/\s+for\s+Final\s+Autopsy\s+Exams.*$/i, '').trim();
                const overrideLoa = overrideName ? loaSet.has(overrideName.toLowerCase()) : false;
                if (devForcedME) {
                    assignedName = devForcedME;
                    console.log(`[AUTOPSY-MON] DEV TEST MODE — forcing ${devForcedME} for #${topicId}/${i}${overrideName ? ' (overriding supervised ASSIGNED marker)' : ''}`);
                } else if (overrideName && !overrideLoa) {
                    assignedName = overrideName;
                    console.log(`[AUTOPSY-MON] Assigned-override ME for #${topicId}/${i}: ${assignedName}`);
                } else {
                    if (overrideName && overrideLoa) {
                        console.warn(`[AUTOPSY-MON] Assigned-override ME "${overrideName}" is on LOA — falling back to rotation`);
                    }
                    assignedName = await selectME(db, topicId, caseNum);
                }

                if (assignedName) {
                    const tMatch = caseUrl.match(/[?&]t=(\d+)/);
                    if (tMatch) {
                        const member = memberList.find(m => m.name.toLowerCase() === assignedName.toLowerCase());
                        const uid = member?.userId || '0';
                        const assignBBCode = `[quote="${assignedName}" user_id=${uid}]\n[/quote]\n\n[b]${assignedName}[/b] - You have been assigned this autopsy case file.`;
                        await caseRef.child('assignmentReplyStatus').set('attempting').catch(() => {});
                        const replyResult = await cc.replyToTopic(tMatch[1], 266, assignBBCode, { dryRun: false, baseUrl: PHMC_BASE });
                        await caseRef.child('assignedTo').set(assignedName);
                        if (replyResult.ok) {
                            console.log(`[AUTOPSY-MON] Assigned ${assignedName} to case #${tMatch[1]}`);
                            const newTitle = caseTitle.replace('- UNASSIGNED', `- ${assignedName}`);
                            await cc.editTopicTitle(tMatch[1], 266, newTitle, { baseUrl: PHMC_BASE });
                            await caseRef.child('caseTitle').set(newTitle).catch(() => {});
                            await caseRef.child('assignmentReplyStatus').set('completed').catch(() => {});
                            assignedNames.push(assignedName);
                            try {
                                const { notifyAssignment } = await import('./meDiscordNotify.js');
                                await notifyAssignment(db, assignedName, newTitle || caseTitle, caseUrl, {
                                    decedent: decedent.name,
                                    ooc: decedent.oocName,
                                    caseNumber: caseNum,
                                    deathType: decedent.deathType || parsedBbFields.deathType || parsed.deathType,
                                    requestTopicId: topicId,
                                    caseIdx: i,
                                });
                            } catch (err) {
                                console.warn(`[AUTOPSY-MON] ME Discord notify failed: ${err.message}`);
                            }
                            if (progress) await progress.addStep('ASSIGNED MEDICAL EXAMINER', 'ok', assignedName);
                        } else {
                            const reason = replyResult.reason || replyResult.url || 'unknown';
                            console.warn(`[AUTOPSY-MON] Assignment reply failed for ${assignedName} — reason: ${reason} — will retry next cycle`);
                            await caseRef.child('assignmentReplyStatus').set('failed').catch(() => {});
                            await caseRef.child('caseState').set('case_created').catch(() => {});
                            if (progress) await progress.addStep('ASSIGNED MEDICAL EXAMINER', 'fail', 'Assignment reply failed — will retry next cycle');
                        }
                    }
                } else {
                    console.log('[AUTOPSY-MON] No ME available to assign — check rotation list and LOA status');
                    if (progress) await progress.addStep('ASSIGNED MEDICAL EXAMINER', 'fail', 'No ME available — check rotation/LOA');
                }
            } catch (err) {
                console.error(`[AUTOPSY-MON] Assignment error: ${err.message}`);
                if (progress) await progress.addStep('ASSIGNED MEDICAL EXAMINER', 'fail', err.message);
            }
        }
    }

    // Aggregated top-level fields for dashboards/recovery that read the
    // request record (per-decedent detail lives under cases/<idx>).
    if (assignedNames.length > 0) {
        await rootRef.child('assignedTo').set(assignedNames.join(', ')).catch(() => {});
    }
    await rootRef.child('caseCount').set(decedents.length).catch(() => {});

    // ── Step 3 (once per request): crossposts + acknowledgement ──
    if (!isDryRun) {
        const multiAckState = existing.multiAckState || (await rootRef.child('multiAckState').once('value')).val() || '';
        if (multiAckState !== 'ack_sent') {
            try {
                const requesterName = parsedBbFields.requesterName || parsed.name || '';
                const displayTitle = caseTitles[0] || `Case - ${parsed.name} ((${parsed.oocName}))`;
                let agencyAckTopicId = null;   // request topic on the faction's own forum
                let agencyFactionKey = null;   // 'LSSD' | 'SADCR' | 'DAO'
                let lspdTopicId = null;

                // --- Agency crosspost (registry factions share one pipeline) ---
                if (isAgencyFaction(parsed.faction) && (parsed.oocName || parsed.name)) {
                    const cfgA = getAgencyForum(parsed.faction);
                    const existingAgencyTopicId = existing[cfgA.topicField]
                        || (await rootRef.child(cfgA.topicField).once('value')).val()
                        || '';
                    const ensured = await ensureAgencyRequestTopic({
                        db,
                        topicId,
                        faction: parsed.faction,
                        oocName: parsed.oocName,
                        name: parsed.name,
                        requestBbCode,
                        caseLabelLine: caseTitles.join(' | '),
                        existingTopicId: existingAgencyTopicId,
                        requesterPoster: existing.requesterPoster || '',
                    });
                    agencyAckTopicId = ensured.topicId;
                    agencyFactionKey = String(parsed.faction).toUpperCase();
                } else {
                    console.log('[AUTOPSY-MON] Step 3 — Agency crosspost skipped (faction=' + (parsed.faction || 'none') + ')');
                }

                // --- LSPD: Create topic on LSPD forum f=1361 ---
                if (parsed.faction === 'LSPD') {
                    // Reuse a preserved LSPD topic id (reprocessing after a
                    // reset) instead of creating a duplicate.
                    const existingLspd = existing.lspdTopicId || (await rootRef.child('lspdTopicId').once('value')).val() || '';
                    if (existingLspd) {
                        lspdTopicId = String(existingLspd);
                        console.log('[AUTOPSY-MON] Reusing existing LSPD topic #' + lspdTopicId + ' for request');
                    } else {
                    try {
                        const lspdClient = getForumClient();
                        await lspdClient.login(process.env.FORUM_LSPD_USERNAME, process.env.FORUM_LSPD_PASSWORD, { force: false, baseUrl: 'https://lspd.gta.world' });
                        const lspdTopicTitle = 'Autopsy Request - ' + parsed.name + (parsed.oocName ? ' ((' + parsed.oocName + '))' : '') + ' [LSPD]';
                        const lspdTopicBody = requestBbCode
                            ? '[divbox=white][center][b][size=170]AUTOPSY REQUEST — CERIFIED COPY [/size][/b][/center][hr][/hr]\n' + requestBbCode + '\n[hr][/hr][b]Cases:[/b] ' + caseTitles.join(' | ') + '\n[b]Status:[/b] Under Investigation\n[/divbox]'
                            : '[divbox=white][b]Autopsy Request[/b]\n[b]Decedent:[/b] ' + parsed.name + (parsed.oocName ? ' ((' + parsed.oocName + '))' : '') + '\n[b]Cases:[/b] ' + caseTitles.join(' | ') + '\n[b]Status:[/b] Under Investigation\n[/divbox]';
                        const lspdResult = await lspdClient.postTopic(1361, lspdTopicTitle, lspdTopicBody, 'https://lspd.gta.world/posting.php?mode=post&f=1361');
                        if (lspdResult.ok) {
                            const tM = lspdResult.url.match(/[?&]t=(\d+)/);
                            if (tM) {
                                lspdTopicId = tM[1];
                                db.ref(`autopsy-requested/${topicId}/lspdTopicId`).set(lspdTopicId).catch(() => {});
                                db.ref(`autopsy-requested/${topicId}/lspdCrosspostStatus`).set('pending').catch(() => {});
                            }
                        } else {
                            console.warn('[AUTOPSY-MON] Step 3 — Failed to create LSPD topic: ' + (lspdResult.reason || 'unknown'));
                        }
                    } catch (err) {
                        console.warn('[AUTOPSY-MON] Step 3 — LSPD topic creation error: ' + err.message);
                    }
                    }
                } else {
                    console.log('[AUTOPSY-MON] Step 3 — LSPD topic creation skipped (faction=' + (parsed.faction || 'none') + ')');
                }

                // --- Send acknowledgement reply to PHMC + the faction's own forum + LSPD ---
                const ackOpts = { baseUrl: PHMC_BASE, lspdTopicId };
                if (agencyFactionKey === 'LSSD') ackOpts.lssdTopicId = agencyAckTopicId;
                else if (agencyFactionKey) {
                    ackOpts.agencyTopicId = agencyAckTopicId;
                    ackOpts.agencyFaction = agencyFactionKey;
                }
                // Skipped bodies ride along in the ack so the requester knows
                // exactly what to re-submit (filed bodies proceed normally).
                // [OK] Multi path has no mass.skippedBodies (mass-flow only) —
                // fall back to any persisted skippedBodies on the request record.
                const multiSkipped = Array.isArray(existing.skippedBodies) ? existing.skippedBodies : [];
                if (multiSkipped.length > 0) ackOpts.skippedBodies = multiSkipped;
                // [OK] No morgue pre-match exists in the multi-decedent path
                // (morgueByBody/bodies/N are processMassRequest scope) — the
                // dead block referencing them is removed; ackOpts.morgueMissing
                // stays unset, which sendAutopsyAcknowledgement already handles.
                const morgueMissing = [];
                if (morgueMissing.length > 0) ackOpts.morgueMissing = morgueMissing;
                const ackResult = await sendAutopsyAcknowledgement(topic.topicId, requesterName, null, ackOpts);

                if (ackResult.phmc) console.log('[AUTOPSY-MON] Acknowledgement sent to PHMC #' + topic.topicId);
                if (agencyFactionKey && ackResult[agencyFactionKey.toLowerCase()]) console.log('[AUTOPSY-MON] Acknowledgement sent to ' + agencyFactionKey + ' #' + agencyAckTopicId);
                if (ackResult.lspd) console.log('[AUTOPSY-MON] Acknowledgement sent to LSPD #' + lspdTopicId);

                const ackStatus = {};
                const ackAt = {};
                const nowIso = new Date().toISOString();
                for (const [target, ok] of Object.entries(ackResult)) {
                    const field = ACK_FIELD_NAMES[target];
                    if (!field) continue;
                    if (ok === true) ackStatus[field] = 'completed';
                    else if (ok === false) ackStatus[field] = 'failed';
                    if (ok === true || ok === false) ackAt[field + '-at'] = nowIso;
                }
                if (Object.keys(ackStatus).length > 0) {
                    db.ref(`autopsy-requested/${topicId}`).update({ ...ackStatus, ...ackAt }).catch(() => {});
                    const failedAcks = Object.entries(ackStatus).filter(([, s]) => s === 'failed').map(([f]) => f);
                    if (failedAcks.length > 0) {
                        console.warn(`[AUTOPSY-MON] ⚠️ Ack FAILED for #${topicId}: ${failedAcks.join(', ')} — flagged for automatic retry`);
                    }
                }

                await rootRef.child('multiAckState').set('ack_sent').catch(() => {});

                // ── Crosspost step on the live progress embed ──
                if (progress) {
                    if (parsed.faction === 'LSPD') {
                        const url = lspdTopicId ? `https://lspd.gta.world/viewtopic.php?t=${lspdTopicId}` : '';
                        if (ackResult.lspd === true) await progress.addStep('CROSSPOSTED TO LSPD', 'ok', url || 'Certified copy posted');
                        else if (ackResult.lspd === false) await progress.addStep('CROSSPOSTED TO LSPD', 'fail', url ? `Ack failed — ${url}` : 'Ack failed');
                        else await progress.addStep('CROSSPOSTED TO LSPD', 'skip', 'No LSPD certified copy for this request');
                    } else if (parsed.faction === 'LSSD') {
                        const url = agencyAckTopicId ? `https://lssd.gta.world/viewtopic.php?t=${agencyAckTopicId}` : '';
                        if (ackResult.lssd === true) await progress.addStep('CROSSPOSTED TO LSSD', 'ok', url || 'Certified copy posted');
                        else if (ackResult.lssd === false) await progress.addStep('CROSSPOSTED TO LSSD', 'fail', url ? `Ack failed — ${url}` : 'Ack failed');
                        else await progress.addStep('CROSSPOSTED TO LSSD', 'skip', 'No LSSD certified copy for this request');
                    } else if (isAgencyFaction(parsed.faction)) {
                        // SADCR/DAO — faction-keyed mirror of the LSSD branch.
                        const cfgP = getAgencyForum(parsed.faction);
                        const url = agencyAckTopicId ? `${cfgP.baseUrl}/viewtopic.php?t=${agencyAckTopicId}` : '';
                        const okFlag = ackResult[String(parsed.faction).toLowerCase()];
                        const lbl = `CROSSPOSTED TO ${String(parsed.faction).toUpperCase()}`;
                        if (okFlag === true) await progress.addStep(lbl, 'ok', url || 'Certified copy posted');
                        else if (okFlag === false) await progress.addStep(lbl, 'fail', url ? `Ack failed — ${url}` : 'Ack failed');
                        else await progress.addStep(lbl, 'skip', 'No certified copy for this request');
                    }
                }
            } catch (err) {
                console.warn('[AUTOPSY-MON] Acknowledgement error: ' + err.message);
            }
        }

        // ── Step 4 (once per request): update counters ──
        if (multiAckState === 'ack_sent' || (await rootRef.child('multiAckState').once('value')).val() === 'ack_sent') {
            try {
                const countKey = ['LSPD', 'LSSD', 'SADCR', 'DAO'].includes(parsed.faction) ? parsed.faction : 'OTHER';
                const countRef = db.ref(`autopsy-requests/${countKey}/count`);
                const countSnap = await countRef.once('value');
                const newCount = (countSnap.val() || 0) + 1;
                await countRef.set(newCount);
                await db.ref(`autopsy-requests/${countKey}/lastUpdated`).set(Date.now());
                console.log(`[AUTOPSY-MON] Counters updated — ${countKey}: ${newCount}`);
            } catch (err) {
                console.warn(`[AUTOPSY-MON] Counter update: ${err.message}`);
            }
            await rootRef.child('multiComplete').set(true).catch(() => {});
            if (progress) await progress.finalize();
        }
    }
}

// ── Autopsy Request Field Parser ──

/**
 * Parse one decedent line from Section 2 of an autopsy request.
 * Template format (multi-decedent bodies are numbered):
 *   "1.) Decedent Name: John Doe[1]((Marvion Futrell))"
 *   "1.) Decedent Name: John Doe (2) ((Dylan Bongo))"
 *   "1.) Decedent Name: John Doe ((OOC Name))"
 *
 * @param {string} raw — the value after "Decedent Name:" (already trimmed)
 * @returns {{ raw: string, name: string, marker: string, oocName: string } | null}
 */
function parseDecedentNameLine(raw) {
    if (!raw) return null;
    let rest = String(raw).trim();
    let oocName = '';
    const oocMatch = rest.match(/\(\(\s*([^()]*)\s*\)\)/);
    if (oocMatch) {
        oocName = oocMatch[1].trim();
        rest = rest.replace(oocMatch[0], '').trim();
    }
    let marker = '';
    const markerMatch = rest.match(/\[(\d+)\]|\((\d+)\)\s*$/);
    if (markerMatch) {
        marker = markerMatch[1] || markerMatch[2] || '';
        rest = rest.replace(markerMatch[0], '').trim();
    }
    const name = rest.replace(/[[\]()]/g, '').trim();
    if (!name) return null;
    return { raw: String(raw).trim(), name, marker, oocName };
}

// ── Mass Autopsy Request detector + parser (Task 2) ──

const MASS_TITLE_RE = /\[?Mass Autopsy Request\]?/i;
const MASS_BODY_HEADER_RE = /---\s*BODY\s*(\d+)\s*---/gi;
// "1.) Decedent Name:" (template label) or bare "1.) Name:" (legacy).
const MASS_NAME_LINE_RE = /(?:Decedent\s+Name(?:\(s?\))?|1\.\)\s*Name)\s*:\s*(.+)/i;
const MASS_NAME_LINE_GLOBAL_RE = /(?:Decedent\s+Name(?:\(s?\))?|1\.\)\s*Name)\s*:/gi;
// Mass title contract (no OOC names — bodies are the sole OOC source).
// Agency tag optional; unknown trailing tags (e.g. [PHMC]) are stripped by
// parseMassTitle() below instead of failing the parse.
// Placeholder bodies (the pinned template post's ANSWER ((OOC NAME)) example
// blocks) must never file — parked as skipped instead of partial data.
const MASS_PLACEHOLDER_RE = /^(answer|example|ex:|placeholder|\[name\]|\[ooc\]|ooc name|unknown ooc|xxxx|insert|n\/a\b|na\b|none|tbd)$/i;

/**
 * Parse a mass title into its incident label + agency. The agency tag is
 * optional and any unrecognized trailing [TAG] (e.g. [PHMC]) is stripped
 * from the label rather than failing the parse:
 *   [Mass Autopsy Request] Davis Shooting [LSPD]  -> { label, agency: LSPD }
 *   [Mass Autopsy Request] Test Davis Shooting [PHMC] -> { label, agency: '' }
 * @param {string} title
 * @returns {{ label: string, agency: string } | null}
 */
export function parseMassTitle(title) {
    const t = String(title || '');
    if (!MASS_TITLE_RE.test(t)) return null;
    let rest = t.replace(/\[?Mass Autopsy Request\]?/i, '').trim().replace(/^[-–—]\s*/, '');
    let agency = '';
    const am = rest.match(/\[?(LSPD|LSSD|SADCR|DAO)\]?\s*$/i);
    if (am) {
        agency = am[1].toUpperCase();
        rest = rest.slice(0, am.index).trim();
    }
    rest = rest.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
    if (!rest) return null;
    return { label: rest, agency };
}

/**
 * Detect a Mass Autopsy Request: the title carries
 * "[Mass Autopsy Request]" OR the BBCode holds >=2 "--- BODY N ---" headers.
 *
 * @param {string} title — forum topic title
 * @param {string} bbcode — raw request post BBCode (may be empty)
 * @returns {boolean}
 */
export function isMassRequest(title, bbcode) {
    if (MASS_TITLE_RE.test(String(title || ''))) return true;
    const headers = String(bbcode || '').match(/---\s*BODY\s*\d+\s*---/gi);
    return !!headers && headers.length >= 2;
}

/**
 * Parse a Mass Autopsy Request's BBCode into per-body records.
 *
 * Slice-boundary approach mirrors parseMassAutopsyBbcode() in
 * services/massAutopsy.js: collect header boundary indices, slice between
 * them, then run the existing per-field regexes on each slice — so EVERY
 * body gets { name, oocName, sex, ethnicity, dateOfDeath, timeOfDeath,
 * placeOfDeath }. Sections 1/3/4 are parsed ONCE via
 * parseAutopsyRequestBbcode() and shared across all bodies.
 *
 * parseDecedentNameLine() is reused as-is (NOT extended) for the per-body
 * "1.) Decedent Name:" value. A body missing its ((OOC)) name is a hard error:
 * returns { error } instead of filing partial data. Same for ANSWER-style
 * placeholder bodies (MASS_PLACEHOLDER_RE).
 *
 * Headerless fallback: posts with no --- BODY N --- headers but a Section 2
 * holding repeated Name lines (requesters who repeat the six fields without
 * headers) split on Name-line occurrences, numbered by order. Requires the
 * SECTION 2 marker so Section-1 requester lines can't misread as bodies.
 * Only reached for posts the caller already classified as mass — untagged
 * posts keep the singular/legacy-multi paths untouched.
 *
 * @param {string} bbcode
 * @returns {{ bodies: Array, shared: object, decedentCount: number, warnings: Array } | { error: string }}
 */
export function parseMassRequestBbcode(bbcode) {
    const text = String(bbcode || '');
    if (!text) return { error: 'Empty BBCode — cannot parse mass request' };

    // Step 1: collect BODY header boundaries (slice logic a la massAutopsy.js).
    // Bodies are numbered POSITIONALLY (order of appearance) — requesters
    // duplicate and misnumber headers constantly ("--- BODY 2 ---" x4), so the
    // printed number is advisory only. Duplicates, gaps and out-of-order
    // headers are collected as warnings, never errors.
    MASS_BODY_HEADER_RE.lastIndex = 0;
    const boundaries = [];
    let m;
    while ((m = MASS_BODY_HEADER_RE.exec(text)) !== null) {
        boundaries.push({ index: m.index, end: m.index + m[0].length, num: m[1] });
    }
    const headerWarnings = [];
    if (boundaries.length > 0) {
        const printed = boundaries.map((b) => b.num);
        const seen = new Set();
        const dupes = [];
        for (const n of printed) {
            if (seen.has(n)) {
                if (!dupes.includes(n)) dupes.push(n);
            } else {
                seen.add(n);
            }
        }
        if (dupes.length > 0) {
            headerWarnings.push(`duplicate BODY header(s) ${dupes.map((n) => `--- BODY ${n} ---`).join(', ')} — bodies numbered by order of appearance`);
        }
        const nums = printed.map(Number);
        const sequential = nums.every((n, k) => n === k + 1);
        if (!sequential && dupes.length === 0) {
            headerWarnings.push(`BODY headers out of order or gapped (${printed.join(', ')}) — bodies numbered by order of appearance`);
        }
    }

    // Step 3 slices this source (raw post when headers exist; the stripped
    // Section-2 region when the fallback below applies).
    let source = text;

    // Step 1b (fallback): no BODY headers — split Section 2 on repeated
    // "1.) Decedent Name:" lines (requesters who repeat the six fields without
    // headers). Numbered by occurrence order. Only reached for posts the caller
    // already classified as mass (title tag); untagged posts keep the legacy
    // paths, so this never hijacks singular/legacy-multi intake. Requires at
    // least the SECTION 2 marker — without it the requester's Section-1
    // "1.) Name:" line would misread as a body.
    if (boundaries.length === 0) {
        const sec2Start = text.search(/SECTION\s*2/i);
        if (sec2Start === -1) return { error: 'No --- BODY N --- headers found' };
        const sec3Start = text.search(/SECTION\s*3/i);
        const regionEnd = sec3Start === -1 || sec3Start < sec2Start ? text.length : sec3Start;
        const stripped = text.slice(sec2Start, regionEnd).replace(/\[.*?\]/g, '');
        MASS_NAME_LINE_GLOBAL_RE.lastIndex = 0;
        let nm;
        while ((nm = MASS_NAME_LINE_GLOBAL_RE.exec(stripped)) !== null) {
            boundaries.push({ index: nm.index, end: nm.index, num: String(boundaries.length + 1) });
        }
        if (boundaries.length === 0) return { error: 'No --- BODY N --- headers found' };
        source = stripped;
    }

    // Step 2: Sections 1/3/4 parsed once and shared (decedent keys stripped —
    // callers must use `bodies`, never the shared decedent leftovers).
    const shared = parseAutopsyRequestBbcode(text);
    delete shared.decedentName;
    delete shared.decedentNames;
    delete shared.sex;
    delete shared.ethnicity;
    delete shared.dateOfDeath;
    delete shared.timeOfDeath;
    delete shared.placeOfDeath;

    // Step 3: per-slice fields with the existing Section 2 regexes.
    // NOTE: the template labels the line "1.) Decedent Name:" — match that
    // first (same alternation as parseAutopsyRequestBbcode's decedent match);
    // bare "1.) Name:" is the legacy fallback only.
    // Template hint artifacts ("(DATE YOU FOUND THE BODY)", the /CDAMAGES
    // time hint) are stripped from date/time values — requesters leave them
    // in, and they are template text, never decedent data.
    const HINT_PAREN_RE = /\(\s*(DATE YOU FOUND THE BODY|TIME LSFD\/PHMC DECEASED DECEASED, YOU CAN USE \/CDAMAGES TO FIND TIMES)\s*\)/gi;
    const cleanHint = (v) => String(v || '').replace(HINT_PAREN_RE, '').replace(/\s{2,}/g, ' ').trim();
    const FIELD_LABEL_RE = /[1-6]\.\)\s*(Decedent\s+Name|Name|Gender|Ethnicity|Date of Death|Time of Death|Location)\s*:/i;
    const bodies = [];
    const bodyWarnings = [];
    // Bodies that fail identity validation are SKIPPED with a recorded reason
    // (file-good/flag-bad policy) — only an empty result parks the post.
    // Each skipped body stays visible: Firebase skippedBodies + logs + the
    // request-thread ack names it for re-submit. Never silently dropped.
    const skippedBodies = [];
    for (let i = 0; i < boundaries.length; i++) {
        // Positional label — printed header numbers are unreliable (see above).
        const label = String(i + 1);
        const start = boundaries[i].end;
        const end = boundaries[i + 1] ? boundaries[i + 1].index : source.length;
        const slice = source.slice(start, end);
        const clean = slice.replace(/\[.*?\]/g, '').trim();

        // A header with no fields at all (stray/double-pasted header) is
        // skipped with a warning instead of parking the whole post.
        if (!FIELD_LABEL_RE.test(clean)) {
            const w = `BODY ${label} has no body fields — skipped`;
            bodyWarnings.push(w);
            skippedBodies.push({ label, name: '', oocName: '', reason: 'empty block (no fields)' });
            continue;
        }

        const n1 = clean.match(MASS_NAME_LINE_RE);
        const nameLine = parseDecedentNameLine(n1 ? n1[1].trim() : '');
        if (!nameLine || !nameLine.oocName) {
            const w = `BODY ${label} missing ((OOC)) name — skipped, needs re-submit`;
            bodyWarnings.push(w);
            skippedBodies.push({ label, name: (nameLine && nameLine.name) || '', oocName: '', reason: 'missing ((OOC)) name' });
            continue;
        }
        // Template-post guard: ANSWER ((OOC NAME)) example blocks parse
        // structurally but are placeholders — skipped, never filed. (A post
        // where EVERY body is a placeholder still parks via the empty-result
        // error below, so the staged template itself can never file.)
        if (MASS_PLACEHOLDER_RE.test(String(nameLine.name || '').trim()) ||
            MASS_PLACEHOLDER_RE.test(String(nameLine.oocName || '').trim())) {
            const w = `BODY ${label} holds placeholder values ("${nameLine.name}" ((${nameLine.oocName}))) — skipped`;
            bodyWarnings.push(w);
            skippedBodies.push({ label, name: nameLine.name, oocName: nameLine.oocName, reason: 'placeholder values' });
            continue;
        }
        let sex = (clean.match(/2\.\)\s*Gender:\s*(.+)/i) || [])[1] || '';
        sex = String(sex).trim();
        if (/^M$/i.test(sex)) sex = 'Male';
        else if (/^F$/i.test(sex)) sex = 'Female';
        else if (/^male$/i.test(sex)) sex = 'Male';
        else if (/^female$/i.test(sex)) sex = 'Female';
        const ethnicity = ((clean.match(/3\.\)\s*Ethnicity:\s*(.+)/i) || [])[1] || '').trim();
        const dateOfDeath = cleanHint((clean.match(/4\.\)\s*Date of Death:\s*(.+)/i) || [])[1] || '');
        const timeOfDeath = cleanHint((clean.match(/5\.\)\s*Time of Death:\s*(.+)/i) || [])[1] || '');
        const placeOfDeath = ((clean.match(/6\.\)\s*Location:\s*(.+)/i) || [])[1] || '').trim();
        // Incomplete-field warnings: missing OR still-template-hint values are
        // recorded per body (Firebase + logs) so MEs see what's absent.
        const incomplete = [];
        if (!sex) incomplete.push('Gender');
        if (!ethnicity) incomplete.push('Ethnicity');
        if (!dateOfDeath) incomplete.push('Date of Death');
        if (!timeOfDeath) incomplete.push('Time of Death');
        if (!placeOfDeath) incomplete.push('Location');
        if (incomplete.length > 0) {
            bodyWarnings.push(`BODY ${label} (${nameLine.name} ((${nameLine.oocName}))) incomplete: ${incomplete.join(', ')} missing`);
        }
        bodies.push({
            name: nameLine.name,
            oocName: nameLine.oocName,
            sex,
            ethnicity,
            dateOfDeath,
            timeOfDeath,
            placeOfDeath,
            incomplete,
        });
    }
    if (bodies.length === 0) {
        return { error: 'No parseable bodies found' + (bodyWarnings.length ? ` (${bodyWarnings.join('; ')})` : '') };
    }

    return { bodies, shared, decedentCount: bodies.length, warnings: [...headerWarnings, ...bodyWarnings], skippedBodies };
}

/**
 * Parse structured fields from an autopsy request post's BBCode.
 * The request template has labeled sections like "1.) Name: ANSWER".
 * Returns a flat object of extracted fields.
 */
// Missing/blank requester contact fields parse as D.N.A (Did Not Answer) so
// downstream displays never show raw 'ANSWER' placeholders or empty strings.
export const DNA_VALUE = 'D.N.A (Did Not Answer)';
const DNA_BLANK_RE = /^(answer|n\/a\b|na\b|none|unknown|tbd|—|–|-|\.+)$/i;
export function isDna(value) {
    return String(value ?? '').trim() === DNA_VALUE;
}
function dna(value) {
    const v = String(value ?? '').trim();
    if (!v || DNA_BLANK_RE.test(v)) return DNA_VALUE;
    return v;
}
// Strip forum wrapper parens ("(( value ))") from contact values. Only 2+
// paren runs are wrappers — a single trailing ")" belongs to the value itself
// (notably the D.N.A constant ends with one).
function unwrapContact(value) {
    return String(value ?? '')
        .replace(/\){2,}\s*$/, '')
        .replace(/^\s*\({2,}/, '')
        .trim();
}

export function parseAutopsyRequestBbcode(bbcode) {
    const fields = {};
    if (!bbcode) return fields;

    // Section 2: Decedent info
    const patterns = {
        decedentName: /1\.\)\s*Name:\s*(.+)/i,
        sex: /2\.\)\s*Gender:\s*(.+)/i,
        ethnicity: /3\.\)\s*Ethnicity:\s*(.+)/i,
        dateOfDeath: /4\.\)\s*Date of Death:\s*(.+)/i,
        timeOfDeath: /5\.\)\s*Time of Death:\s*(.+)/i,
        placeOfDeath: /6\.\)\s*Location:\s*(.+)/i,
        // Requester info (Section 1)
        requesterName: /1\.\)\s*Name:\s*(.+)/i,
        requesterDept: /3\.\)\s*Department\s*\/\s*Assignment:\s*(.+)/i,
        // Details (Section 3)
        synopsis: /1\.\)\s*Synopsis:\s*(.+)/i,
        causeDetail: /2\.\)\s*Reason for Autopsy:\s*(.+)/i,
        // OOC (Section 4)
        deathType: /1\.\)\s*PK\/CK:\s*(.+)/i,
    };

    // Simple line-by-line extraction
    const lines = bbcode.split('\n');
    let currentSection = null;

    for (const line of lines) {
        const trimmed = line.replace(/\[.*?\]/g, '').trim();
        if (trimmed.includes('SECTION 1')) { currentSection = 'requester'; continue; }
        if (trimmed.includes('SECTION 2')) { currentSection = 'decedent'; continue; }
        if (trimmed.includes('SECTION 3')) { currentSection = 'details'; continue; }
        if (trimmed.includes('SECTION 4') || trimmed.includes('OOC INFORMATION')) { currentSection = 'ooc'; continue; }

        if (currentSection === 'decedent') {
            const m1 = trimmed.match(/Decedent\s+Name(?:\(s?\))?:\s*(.+)/i) || trimmed.match(/1\.\)\s*Name:\s*(.+)/i);
            if (m1) {
                fields.decedentName = m1[1].trim();
                // Multi-decedent requests number each body in Section 2
                // ("John Doe[1]((OOC A))", "John Doe[2]((OOC B))"). Collect ALL
                // decedent lines so each gets its own autopsy case.
                const parsedLine = parseDecedentNameLine(m1[1].trim());
                if (parsedLine) {
                    fields.decedentNames = fields.decedentNames || [];
                    fields.decedentNames.push(parsedLine);
                }
            }
            const m2 = trimmed.match(/2\.\)\s*Gender:\s*(.+)/i);
            if (m2) {
                let val = m2[1].trim();
                if (/^M$/i.test(val)) val = 'Male';
                else if (/^F$/i.test(val)) val = 'Female';
                fields.sex = val;
            }
            const m3 = trimmed.match(/3\.\)\s*Ethnicity:\s*(.+)/i);
            if (m3) fields.ethnicity = m3[1].trim();
            const m4 = trimmed.match(/4\.\)\s*Date of Death:\s*(.+)/i);
            if (m4) fields.dateOfDeath = m4[1].trim();
            const m5 = trimmed.match(/5\.\)\s*Time of Death:\s*(.+)/i);
            if (m5) fields.timeOfDeath = m5[1].trim();
            const m6 = trimmed.match(/6\.\)\s*Location:\s*(.+)/i);
            if (m6) fields.placeOfDeath = m6[1].trim();
        }

        if (currentSection === 'requester') {
            const m1 = trimmed.match(/1\.\)\s*Name:\s*(.+)/i);
            if (m1) fields.requesterName = dna(m1[1]);
            const m2 = trimmed.match(/2\.\)\s*Rank:\s*(.+)/i);
            if (m2) fields.requesterRank = dna(m2[1]);
            const m3 = trimmed.match(/3\.\)\s*Department\s*\/\s*Assignment:\s*(.+)/i);
            if (m3) fields.requesterDept = dna(m3[1]);
            const m4 = trimmed.match(/4\.\)\s*Badge(?:\/Serial Number)?:\s*(.+)/i);
            if (m4) fields.requesterBadge = dna(m4[1]);
            // Cell Number lives in the Contact list ("[*]Cell Number: ...").
            const mCell = trimmed.match(/Cell\s*(?:Number|#|No\.?)?\s*:\s*(.+)/i);
            if (mCell && !fields.requesterCell) {
                fields.requesterCell = dna(unwrapContact(mCell[1]));
            }
            // Forum Account line ("[*]Forum Account: <url>"). Prefer the raw
            // [url=...] href when the poster linked it — tag-stripping keeps
            // only the link text, which may be "My Profile" instead of the URL.
            const mForumHref = line.match(/Forum\s*Account\s*:[^[]*\[url=([^\]]+)\]/i);
            if (mForumHref && !fields.forumAccountUrl) {
                fields.forumAccountUrl = dna(mForumHref[1]);
            }
            const mForum = trimmed.match(/Forum\s*Account\s*(?:URL|Link|Profile)?\s*:\s*(.+)/i);
            if (mForum && !fields.forumAccountUrl) {
                fields.forumAccountUrl = dna(unwrapContact(mForum[1]));
            }
            // Contact Information line — "(( Discord Name: ._diaaa ))" or a numeric
            // "Discord ID:". BBCode tags are already stripped, so the raw value is
            // e.g. "._diaaa ))" → trim the wrapping parens off. This is a USERNAME
            // string, not necessarily a mentionable snowflake; resolution to a
            // real ping lives in services/requesterWebhook.js.
            const mDis = trimmed.match(/Discord(?:\s*(?:Name|ID|Tag|Username))?\s*:\s*(.+)/i);
            if (mDis && !fields.requesterDiscord) {
                fields.requesterDiscord = dna(unwrapContact(mDis[1]));
            }
        }

        if (currentSection === 'details') {
            const s1 = trimmed.match(/1\.\)\s*Synopsis:\s*(.+)/i);
            if (s1) fields.synopsis = s1[1].trim();
            const s2 = trimmed.match(/2\.\)\s*Reason for Autopsy:\s*(.+)/i);
            if (s2) fields.causeDetail = s2[1].trim();
            // Supervised final-autopsy requests carry an explicit assignee marker.
            const as = trimmed.match(/ASSIGNED:\s*(.+)/i);
            if (as) fields.assignedOverride = as[1].trim();
        }

        if (currentSection === 'ooc') {
            const o1 = trimmed.match(/1\.\)\s*PK\/CK:\s*(.+)/i);
            if (o1) fields.deathType = o1[1].trim();
        }
    }

    // Backfill DNA for required requester fields absent from the whole post
    // (e.g. older templates without a Rank line). Runs once AFTER the line
    // loop — never per-line, or it would shadow real values seen later.
    for (const k of ['requesterName', 'requesterRank', 'requesterDept', 'requesterBadge', 'requesterCell', 'requesterDiscord', 'forumAccountUrl']) {
        if (fields[k] === undefined) fields[k] = DNA_VALUE;
    }

    return fields;
}

// ── Acknowledgement Template ──

export const ACK_TEMPLATE = `[divbox=white][center][img]https://i.imgur.com/Hxjt4M2.png[/img][/center]
[hr][/hr]
[bold][br][/br]Autopsy Request - Under Investigation[/bold]

Dear REQUESTING_NAME,

We have received your autopsy request and it is currently under thorough investigation. Our team is diligently reviewing all pertinent information and conducting the necessary examinations to ensure a comprehensive and accurate analysis.

During this investigation, we will schedule the decedent for autopsy, which can take up to 5 working days, unless deemed a critically urgent autopsy, if urgent, you must inform the Department in advance.

[i]Kind regards,[/i]
[hr][/hr]
[bold]Office of the Forensic Medicine Division[/bold]
Department of Forensic Medicine and Pathology

[bold]Pillbox Hill Medical Center[/bold]
[size=85]Elgin Avenue/Strawberry Avenue, Pillbox Hill, Los Santos, SA
Phone: 61122335
Mail:[url=https://phmc.gta.world/ucp.php?i=pm&mode=compose][color=#808080]medical.examiners@phmc.health[/color][/url]
Website: [url][color=#808080]www.phmc.health[/color][/url][/size]
[br][/br]
[center][img]https://imgur.com/vztjYpe.png[/img][/center]
[br][/br][/divbox]`;

/**
 * Send an acknowledgement reply to the autopsy request topic (and the requesting
 * faction's own forum if applicable).
 * Called after case creation + assignment in the detection flow.
 *
 * Agency targets:
 *   - lssdTopicId    → LSSD f=2263 (legacy explicit param, unchanged behavior)
 *   - agencyTopicId + agencyFaction → generic registry branch for SADCR/DAO
 *     (their forums share the lssd.gta.world domain and FORUM_LSSD_* credentials —
 *     see services/agencyForums.js)
 */
export async function sendAutopsyAcknowledgement(topicId, requesterName, bbCode, { baseUrl, lssdTopicId, lspdTopicId, agencyTopicId, agencyFaction, skippedBodies, morgueMissing } = {}) {
    const client = getForumClient();
    const name = (requesterName && !isDna(requesterName)) ? requesterName : 'Requesting Party';
    let ackBbcode = ACK_TEMPLATE.replace('REQUESTING_NAME', name);
    // Skipped mass bodies are named in the ack so the requester knows exactly
    // what to re-submit (filed bodies proceed normally).
    if (Array.isArray(skippedBodies) && skippedBodies.length > 0) {
        const items = skippedBodies.map((s) => {
            const who = [s.name, s.oocName ? `((${s.oocName}))` : ''].filter(Boolean).join(' ').trim() || 'unnamed body';
            return `[*] Body ${s.label || '?'}: ${who} — ${s.reason || 'could not be filed'}. Please re-submit this body.`;
        });
        ackBbcode += `\n\n[hr][/hr]\n[b]Bodies NOT filed (${skippedBodies.length}):[/b]\n[list]${items.join('')}[/list]`;
    }
    // Definitive morgue misses are flagged in the ack so the REQUESTER (who
    // can fix the name) sees it — MEs get the same flag in the case thread
    // post and the Discord panel.
    if (Array.isArray(morgueMissing) && morgueMissing.length > 0) {
        const items = morgueMissing.map((s) => {
            const who = [s.name, s.oocName ? `((${s.oocName}))` : ''].filter(Boolean).join(' ').trim() || 'unnamed body';
            return `[*] Body ${s.label || '?'}: ${who} — no morgue record found. Please verify the name/OOC spelling.`;
        });
        ackBbcode += `\n\n[hr][/hr]\n[b]No morgue record found (${morgueMissing.length}):[/b]\n[list]${items.join('')}[/list]`;
    }
    const results = { phmc: null, lssd: null, lspd: null };

    // Reply to PHMC autopsy request topic
    try {
        const r = await client.replyToTopic(topicId, 265, ackBbcode, { dryRun: false, baseUrl: baseUrl || PHMC_BASE });
        results.phmc = r.ok;
        console.log(`[AUTOPSY-MON] Ack reply to PHMC #${topicId}: ${r.ok ? 'OK' : 'FAIL'}`);
    } catch (err) {
        console.error(`[AUTOPSY-MON] Ack PHMC reply failed: ${err.message}`);
    }

    // Reply to LSSD forum if a topic ID was provided
    if (lssdTopicId) {
        try {
            const client_lssd = getForumClient();
            await client_lssd.login(process.env.FORUM_LSSD_USERNAME, process.env.FORUM_LSSD_PASSWORD, { force: false, baseUrl: 'https://lssd.gta.world' });
            const r = await client_lssd.replyToTopic(lssdTopicId, 2263, ackBbcode, { dryRun: false, baseUrl: 'https://lssd.gta.world' });
            results.lssd = r.ok;
            console.log(`[AUTOPSY-MON] Ack reply to LSSD #${lssdTopicId}: ${r.ok ? 'OK' : 'FAIL'}`);
        } catch (err) {
            console.error(`[AUTOPSY-MON] Ack LSSD reply failed: ${err.message}`);
        }
    } else {
        console.log('[AUTOPSY-MON] Step 3 — LSSD ack reply skipped (no LSSD topic ID)');
    }

    // Generic registry branch — SADCR/DAO acknowledgement on their own subforum.
    // Reaches here when the monitor resolved the faction request topic via
    // ensureAgencyRequestTopic (not the legacy LSSD param path).
    if (!lssdTopicId && agencyTopicId && agencyFaction) {
        const cfgA = getAgencyForum(agencyFaction);
        if (cfgA) {
            try {
                const client_ag = getForumClient();
                await client_ag.login(process.env[`FORUM_${cfgA.credPrefix}_USERNAME`], process.env[`FORUM_${cfgA.credPrefix}_PASSWORD`], { force: false, baseUrl: cfgA.baseUrl });
                const r = await client_ag.replyToTopic(agencyTopicId, cfgA.forumId, ackBbcode, { dryRun: false, baseUrl: cfgA.baseUrl });
                results[agencyFaction.toLowerCase()] = r.ok;
                console.log(`[AUTOPSY-MON] Ack reply to ${String(agencyFaction).toUpperCase()} #${agencyTopicId}: ${r.ok ? 'OK' : 'FAIL'}`);
            } catch (err) {
                console.error(`[AUTOPSY-MON] Ack ${String(agencyFaction).toUpperCase()} reply failed: ${err.message}`);
            }
        }
    }

    // Reply to LSPD forum if a topic ID was provided
    if (lspdTopicId) {
        try {
            const client_lspd = getForumClient();
            await client_lspd.login(process.env.FORUM_LSPD_USERNAME, process.env.FORUM_LSPD_PASSWORD, { force: false, baseUrl: 'https://lspd.gta.world' });
            const r = await client_lspd.replyToTopic(lspdTopicId, 1361, ackBbcode, { dryRun: false, baseUrl: 'https://lspd.gta.world' });
            results.lspd = r.ok;
            console.log(`[AUTOPSY-MON] Ack reply to LSPD #${lspdTopicId}: ${r.ok ? 'OK' : 'FAIL'}`);
        } catch (err) {
            console.error(`[AUTOPSY-MON] Ack LSPD reply failed: ${err.message}`);
        }
    } else {
        console.log('[AUTOPSY-MON] Step 3 — LSPD ack reply skipped (no LSPD topic ID)');
    }

    return results;
}

// ── Lifecycle ──

/**
 * Initialize the rotation list from the forum ME group at startup.
 * Fire-and-forget — never blocks or throws.
 */
async function initializeRotationAtStartup() {
    try {
        const { getRotationStatus, initializeRotationFromGroup, syncRotationFromGroup } = await import('./autopsyRotation.js');
        const status = await getRotationStatus(_db);
        const client = getForumClient();
        let memberList = [];
        try {
            memberList = await client.getGroupMembers(50, { baseUrl: PHMC_BASE, exclude: ['PHMC Forms Bot'], paginate: true });
        } catch (e) {
            console.warn(`[AUTOPSY-MON] Could not load forum group members: ${e.message}`);
        }
        if (!status.configured && memberList.length > 0) {
            await initializeRotationFromGroup(_db, memberList);
            console.log(`[AUTOPSY-MON] Auto-initialized rotation list: ${memberList.map(m => m.name).join(', ')}`);
        } else if (memberList.length > 0) {
            const syncResult = await syncRotationFromGroup(_db, memberList);
            if (syncResult && (syncResult.added.length > 0 || syncResult.removed.length > 0)) {
                const msg = [
                    syncResult.added.length > 0 ? `New MEs added to rotation: ${syncResult.added.join(', ')}` : '',
                    syncResult.removed.length > 0 ? `Removed from rotation: ${syncResult.removed.join(', ')}` : '',
                ].filter(Boolean).join(' | ');
                console.log(`[ROTATION] ${msg}`);
                try { await sendLogMessage(`[ROTATION] ${msg}`); } catch { /* ignore */ }
            }
        }
    } catch (err) {
        console.warn(`[AUTOPSY-MON] Rotation auto-init skipped (non-fatal): ${err.message}`);
    }

    // Rebuild active case counts from scratch every startup.
    // This picks up legacy assignments + catches any drift between restarts.
    // Uses set() (not increment) so it's always correct regardless of how many
    // times it runs — no double-counting.
    try {
        const snap = await _db.ref('autopsy-requested').once('value');
        const entries = snap.val() || {};

        // Build per-ME assignment data from scratch
        const assignments = {};
        const countAssignment = (meName, topicId, caseNum, detectedAt) => {
            if (!meName) return;
            const key = meName.toLowerCase();
            if (!assignments[key]) {
                assignments[key] = { active: 0, cases: {}, lastAssigned: 0 };
            }
            assignments[key].active++;
            assignments[key].cases[`${topicId}`] = {
                assignedAt: detectedAt ? new Date(detectedAt).getTime() : Date.now(),
                caseNum: caseNum || '',
            };
            const ts = detectedAt ? new Date(detectedAt).getTime() : 0;
            if (ts > assignments[key].lastAssigned) {
                assignments[key].lastAssigned = ts;
            }
        };
        for (const [topicId, entry] of Object.entries(entries)) {
            if (entry.completedAt) continue;
            // Terminal entries are never active work. Without this, skipped
            // stubs (e.g. Case 519 #10154, superseded by the mass re-file)
            // resurrect as active cases on every restart.
            if (TERMINAL_STATES.has(String(entry.caseState || '').toLowerCase())) continue;
            // Multi-decedent requests hold per-case assignments under cases/<idx>.
            // Per-body completion must be respected: a mass collection only sets
            // entry.completedAt once EVERY body is done, so counting finished
            // bodies re-adds cases that clearAssignment already released —
            // inflating the ME's load and skewing fair-share dealing
            // (2026-09-17 report: Perez/Pérez et al. "done but still assigned").
            if (entry.caseState === 'multi' && entry.cases) {
                for (const c of Object.values(entry.cases)) {
                    if (!c || c.completedAt) continue;
                    countAssignment(c.assignedTo, topicId, c.caseNum, entry.detectedAt);
                }
            } else {
                countAssignment(entry.assignedTo, topicId, entry.caseNum, entry.detectedAt);
            }
        }

        await _db.ref('autopsy-requests/assignments').set(assignments);
        const total = Object.keys(assignments).length;
        const totalCases = Object.values(assignments).reduce((s, a) => s + a.active, 0);
        if (totalCases > 0) {
            console.log(`[AUTOPSY-MON] Rebuilt assignment counts: ${total} ME(s) with ${totalCases} active case(s)`);
        }
        // Seed completion-step retry markers (RTDB cost optimization, free — same
        // snapshot). The recovery sweep reads only the tiny completionStepRetries
        // index instead of this full node, so failed steps need markers to be found.
        try {
            const { markStepRetry } = await import('./deployAutopsyReply.js');
            let failed = 0, ambiguous = 0;
            for (const [topicId, entry] of Object.entries(entries)) {
                const steps = entry?.completionSteps;
                if (!steps || typeof steps !== 'object') continue;
                for (const [sName, sData] of Object.entries(steps)) {
                    if (sData?.status === 'failed') {
                        failed++;
                        markStepRetry(topicId, sName, sData?.detail || 'Seeded at startup');
                    } else if (sData?.status === 'attempting') {
                        ambiguous++;
                    }
                }
            }
            if (failed > 0) console.log(`[AUTOPSY-MON] Seeded ${failed} completion-step retry marker(s)`);
            if (ambiguous > 0) console.warn(`[AUTOPSY-MON] ${ambiguous} step(s) stuck in "attempting" (crash mid-op) — skipped to avoid duplicates, check manually if needed`);
        } catch (seedErr) {
            console.warn(`[AUTOPSY-MON] Retry-marker seeding skipped: ${seedErr.message}`);
        }
        // Retry any failed assignment replies from previous sessions
        // (also runs as part of the recovery heartbeat via retryFailedAssignmentReplies)
        await retryFailedAssignmentReplies(_db, { entries });
    } catch (err) {
        console.warn(`[AUTOPSY-MON] Assignment rebuild skipped: ${err.message}`);
    }
}

/**
 * Retry failed/missing assignment replies (ME assignment quote on the f=266 case topic).
 * Runs as part of the recovery heartbeat (startup + every 10 min) and at monitor startup.
 *
 * @param {object} db — Firebase RTDB (defaults to the module _db)
 * @param {object} [opts] — { entries, memberList } to avoid re-fetching when the caller already has them
 */
export async function retryFailedAssignmentReplies(db, { entries, memberList } = {}) {
    const ref = db || _db;
    if (!ref) return;
    try {
        if (!entries) {
            const snap = await ref.ref('autopsy-requested').once('value');
            entries = snap.val() || {};
        }

        // Scan FIRST without touching the browser: only fetch the ME roster and
        // force a login when an entry genuinely needs a retry. A quiet heartbeat
        // with nothing to fix should do zero forum work (no memberlist, no login).
        const needsRetry = (e) => {
            if (!e || e.completedAt) return false;
            if (e.caseState === 'multi' && e.cases) {
                return Object.values(e.cases).some(c => c && c.assignedTo &&
                    c.assignmentReplyStatus !== 'completed' && c.assignmentReplyStatus !== 'attempting' &&
                    (c.caseTopicId || (e.isMassSingleThread && e.caseTopicId)));
            }
            return !!(e.assignedTo && e.assignmentReplyStatus !== 'completed' &&
                e.assignmentReplyStatus !== 'attempting' && e.caseTopicId);
        };
        const hasRetries = Object.values(entries).some(needsRetry);
        if (!hasRetries) return;

        const cc = getForumClient();
        // Force a PHMC session — the default client may have been left on LSPD/LSSD
        // by earlier heartbeat checks (retryMissingLspdCrossposts force-logs it to LSPD).
        await cc.login(null, null, { force: false, baseUrl: PHMC_BASE });

        if (!memberList) {
            try {
                memberList = await cc.getGroupMembers(50, { baseUrl: PHMC_BASE, exclude: ['PHMC Forms Bot'], paginate: true });
            } catch (e) {
                console.warn(`[AUTOPSY-MON] Could not load member list for retry: ${e.message}`);
                memberList = [];
            }
        }

        let retried = 0;
        for (const [topicId, entry] of Object.entries(entries)) {
            // Multi-decedent requests keep per-case state under cases/<idx>
            if (entry.caseState === 'multi' && entry.cases) {
                // Shared-thread mass collection: ONE grouped retry reply for all
                // failed bodies (mirrors the single live assignment post), never
                // one reply per body.
                if (entry.isMassSingleThread === true && entry.caseTopicId && !entry.completedAt) {
                    const failedIdxs = Object.entries(entry.cases)
                        .filter(([ci, c]) => /^\d+$/.test(ci) && c && c.assignedTo
                            && c.assignmentReplyStatus !== 'completed'
                            && c.assignmentReplyStatus !== 'attempting' && !c.caseTopicId)
                        .map(([ci]) => ci)
                        .sort((a, b) => Number(a) - Number(b));
                    if (failedIdxs.length > 0) {
                        const total = Object.keys(entry.cases).filter((k) => /^\d+$/.test(k)).length;
                        const caseNum = entry.caseNum || '?';
                        const quotes = [];
                        const seenMes = [];
                        for (const ci of failedIdxs) {
                            const me = entry.cases[ci].assignedTo;
                            if (!seenMes.map((x) => x.toLowerCase()).includes(me.toLowerCase())) {
                                seenMes.push(me);
                                const member = memberList.find((m) => m.name.toLowerCase() === me.toLowerCase());
                                quotes.push(`[quote="${me}" user_id=${member?.userId || '0'}]\n[/quote]`);
                            }
                        }
                        const tableLines = failedIdxs.map((ci) => {
                            const c = entry.cases[ci];
                            return `Body ${Number(ci) + 1}/${total}: ${c.name || 'Unknown'} ((${c.oocName || 'Unknown OOC'})) → [b]${c.assignedTo}[/b]`;
                        });
                        const retryBb = `${quotes.join('\n')}\n\n[b]Mass Autopsy Assignments — Case ${caseNum} (retry)[/b]\n[list]${tableLines.map((l) => `[*]${l}`).join('')}[/list]`;
                        try {
                            const r = await cc.replyToTopic(entry.caseTopicId, 266, retryBb, { dryRun: false, baseUrl: PHMC_BASE });
                            if (r.ok) {
                                for (const ci of failedIdxs) {
                                    await ref.ref(`autopsy-requested/${topicId}/cases/${ci}/assignmentReplyStatus`).set('completed').catch(() => {});
                                }
                                console.log(`[AUTOPSY-MON] Retried grouped assignment reply for #${topicId} (${failedIdxs.length} bodies) on #${entry.caseTopicId} — OK`);
                                notifySelfHeal(topicId, 'assignment reply failed', 'Grouped assignment reply posted to case topic');
                                retried++;
                            } else {
                                console.warn(`[AUTOPSY-MON] Retry grouped assignment reply failed for #${topicId}: ${r.reason || 'Unknown'}`);
                                notifySelfHeal(topicId, 'assignment reply failed', `Retry FAILED: ${r.reason || 'Unknown'}`);
                            }
                        } catch (err) {
                            console.error(`[AUTOPSY-MON] Grouped assignment reply retry error for ${topicId}: ${err.message}`);
                            notifySelfHeal(topicId, 'assignment reply failed', `ERROR: ${err.message}`);
                        }
                    }
                }
                for (const [ci, c] of Object.entries(entry.cases)) {
                    if (c.assignedTo && c.assignmentReplyStatus !== 'completed' && !entry.completedAt) {
                        // Shared-thread mass collections keep no per-case topic —
                        // retries post into the parent collection OP topic.
                        const sharedThread = entry.isMassSingleThread === true && !c.caseTopicId;
                        const caseTopicId = c.caseTopicId || (sharedThread ? entry.caseTopicId : null);
                        if (!caseTopicId) continue;
                        if (sharedThread) continue; // handled by the grouped retry above
                        if (c.assignmentReplyStatus === 'attempting') {
                            console.log(`[AUTOPSY-MON] Assignment reply for #${topicId}/case${ci} is in progress ('attempting') — skipping retry`);
                            continue;
                        }
                        const member = memberList.find(m => m.name.toLowerCase() === c.assignedTo.toLowerCase());
                        const uid = member?.userId || '0';
                        const assignBBCode = `[quote="${c.assignedTo}" user_id=${uid}]\n[/quote]\n\n[b]${c.assignedTo}[/b] - You have been assigned this autopsy case file.`;
                        const basePath = `autopsy-requested/${topicId}/cases/${ci}`;
                        try {
                            const r = await cc.replyToTopic(caseTopicId, 266, assignBBCode, { dryRun: false, baseUrl: PHMC_BASE });
                            if (r.ok) {
                                await ref.ref(`${basePath}/assignmentReplyStatus`).set('completed').catch(() => {});
                                console.log(`[AUTOPSY-MON] Retried assignment reply for ${c.assignedTo} on #${caseTopicId} — OK`);
                                notifySelfHeal(topicId, 'assignment reply failed', 'Assignment reply posted to case topic');
                                // Shared-thread titles are aggregate (Fix 3) — never
                                // rename the OP per body here; per-topic multis keep
                                // the existing per-case rename below.
                                if (!sharedThread && c.caseTitle && c.caseTitle.includes('UNASSIGNED')) {
                                    const newTitle = c.caseTitle.replace('- UNASSIGNED', `- ${c.assignedTo}`);
                                    try {
                                        await cc.editTopicTitle(caseTopicId, 266, newTitle, { baseUrl: PHMC_BASE });
                                        await ref.ref(`${basePath}/caseTitle`).set(newTitle).catch(() => {});
                                        console.log(`[AUTOPSY-MON] Retry also updated case title: "${newTitle}"`);
                                    } catch (e) {
                                        console.warn(`[AUTOPSY-MON] Retry title update failed: ${e.message}`);
                                    }
                                }
                                retried++;
                            } else {
                                console.warn(`[AUTOPSY-MON] Retry assignment reply failed for ${c.assignedTo} on #${caseTopicId}: ${r.reason || 'Unknown'}`);
                                notifySelfHeal(topicId, 'assignment reply failed', `Retry FAILED: ${r.reason || 'Unknown'}`);
                            }
                        } catch (err) {
                            console.error(`[AUTOPSY-MON] Assignment reply retry error for ${topicId}/case${ci}: ${err.message}`);
                            notifySelfHeal(topicId, 'assignment reply failed', `ERROR: ${err.message}`);
                        }
                    }
                }
                continue;
            }
            if (entry.assignedTo && entry.assignmentReplyStatus !== 'completed' && !entry.completedAt) {
                const caseTopicId = entry.caseTopicId;
                if (!caseTopicId) continue;

                // Skip entries whose reply is currently being posted ('attempting').
                // The main monitor sets this before posting, so a concurrent sweep
                // won't double-post. Only retry 'failed' or genuinely missing replies.
                if (entry.assignmentReplyStatus === 'attempting') {
                    console.log(`[AUTOPSY-MON] Assignment reply for #${topicId} is in progress ('attempting') — skipping retry`);
                    continue;
                }

                // Look up user ID for the quote tag
                const member = memberList.find(m => m.name.toLowerCase() === entry.assignedTo.toLowerCase());
                const uid = member?.userId || '0';
                const assignBBCode = `[quote="${entry.assignedTo}" user_id=${uid}]\n[/quote]\n\n[b]${entry.assignedTo}[/b] - You have been assigned this autopsy case file.`;

                try {
                    const r = await cc.replyToTopic(caseTopicId, 266, assignBBCode, { dryRun: false, baseUrl: PHMC_BASE });
                    if (r.ok) {
                        await ref.ref(`autopsy-requested/${topicId}/assignmentReplyStatus`).set('completed').catch(() => {});
                        console.log(`[AUTOPSY-MON] Retried assignment reply for ${entry.assignedTo} on #${caseTopicId} — OK`);
                        notifySelfHeal(topicId, 'assignment reply failed', 'Assignment reply posted to case topic');

                        // Also update the topic title if it still has UNASSIGNED
                        if (entry.caseTitle && entry.caseTitle.includes('UNASSIGNED')) {
                            const newTitle = entry.caseTitle.replace('- UNASSIGNED', `- ${entry.assignedTo}`);
                            try {
                                await cc.editTopicTitle(caseTopicId, 266, newTitle, { baseUrl: PHMC_BASE });
                                await ref.ref(`autopsy-requested/${topicId}/caseTitle`).set(newTitle).catch(() => {});
                                console.log(`[AUTOPSY-MON] Retry also updated case title: "${newTitle}"`);
                            } catch (e) {
                                console.warn(`[AUTOPSY-MON] Retry title update failed: ${e.message}`);
                            }
                        }

                        retried++;
                    } else {
                        console.warn(`[AUTOPSY-MON] Retry assignment reply failed for ${entry.assignedTo} on #${caseTopicId}: ${r.reason || 'Unknown'}`);
                        notifySelfHeal(topicId, 'assignment reply failed', `Retry FAILED: ${r.reason || 'Unknown'}`);
                    }
                } catch (err) {
                    console.error(`[AUTOPSY-MON] Assignment reply retry error for ${topicId}: ${err.message}`);
                    notifySelfHeal(topicId, 'assignment reply failed', `ERROR: ${err.message}`);
                }
            }
        }
        if (retried > 0) console.log(`[AUTOPSY-MON] Retried ${retried} failed assignment reply/ies`);
    } catch (err) {
        console.warn(`[AUTOPSY-MON] Assignment reply retry skipped: ${err.message}`);
    }
}

/**
 * Start the autopsy request monitor.
 * Called once on bot startup from index.js.
 */
export function startAutopsyRequestMonitor({ immediate = true } = {}) {
    console.log('[AUTOPSY-MON] Starting autopsy request monitor...');

    firebase.init();
    _db = firebase.db;
    _isFirstCycle = true;

    // Boot-chatter trim (2026-09-23): the "Monitor Active" webhook post
    // duplicated the index.js "Bot Online" startup embed, so it is now
    // console.log-only. Liveness remains observable via getMonitorStatus()
    // (dashboard) and the per-cycle scan logs.
    console.log(`[AUTOPSY-MON] Active (checking f=265 every ${Math.round(CHECK_INTERVAL_MS / 60000)}min)`);


    // Initialize rotation list from forum group on startup (no-op if already configured)
    // This runs async — doesn't block the first check cycle
    initializeRotationAtStartup();

    // Loud startup reminder when DEV TEST assignment forcing is active.
    if (isDevTestActive()) {
        const devMsg = `[DEV TEST] Autopsy assignments FORCED to ${getDevTestME()} — fair rotation + supervised overrides bypassed`;
        console.warn('[AUTOPSY-MON] ' + devMsg);
        Promise.resolve(sendLogMessage(devMsg)).catch(() => { /* non-fatal */ });
    }

    // First check maps to runAtStart — unless the phased boot queue already
    // ran it (pass { immediate: false } to avoid a double first scan).
    // On restart, pending cases with partial state will resume from where they left off.
    // _monitorTimer doubles as the armed flag for getMonitorStatus().
    registerTick('autopsy-monitor', {
        intervalMs: CHECK_INTERVAL_MS,
        runAtStart: immediate,
        fn: () => checkForNewRequests(),
    });
    _monitorTimer = true;
}

/**
 * Get the current status of the autopsy request monitor for the dashboard.
 * Active when the interval timer is armed OR a check completed within the
 * last two intervals (covers dashboards gathered mid-restart before the
 * starter re-arms the timer — a recent successful check means alive).
 * @returns {{ active: boolean, intervalMs: number, lastCheckTime: number|null, lastCheckSuccess: boolean }}
 */
export function getMonitorStatus() {
    const recentCheck = _lastCheckTime && (Date.now() - _lastCheckTime < 2 * CHECK_INTERVAL_MS);
    return {
        active: _monitorTimer !== null || !!recentCheck,
        intervalMs: CHECK_INTERVAL_MS,
        lastCheckTime: _lastCheckTime,
        lastCheckSuccess: _lastCheckSuccess,
    };
}

/**
 * Stop the monitor (for testing / graceful shutdown).
 */
export function stopAutopsyRequestMonitor() {
    if (_monitorTimer) {
        unregisterTick('autopsy-monitor');
        _monitorTimer = null;
        console.log('[AUTOPSY-MON] Monitor stopped');
    }
}
