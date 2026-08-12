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
import { state, C } from './deployState.js';
import { setDeployStatus, markReportComplete } from './deployStatus.js';
import { crosspostAutopsyToLssd, retryFailedLssdCrossposts, searchLssdRequestTopic } from './deployLssd.js';
import { crosspostAutopsyToLspd } from './deployLspd.js';
import { clearAssignment, getRotationStatus } from './autopsyRotation.js';

import { COMPLETION_TEMPLATE, buildCompletionBb } from './completionTemplate.js';

// ── Constants ──
export const CASE_MGMT_FORUM_ID = 266;
export const AUTOPSY_DRY_RUN = process.env.AUTOPSY_DRY_RUN !== 'false'; // default dry-run
export const AUTOPSY_REQUEST_FORUM_ID = 265;

// Re-export for backwards compatibility (moved to services/completionTemplate.js)
export { COMPLETION_TEMPLATE };

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
 * @param {string} opts.bbCode — full autopsy report BBCode
 * @param {object} opts.progress — DeployProgressEmbed instance
 * @param {object} opts.stepFailed — shared step-failure tracker
 * @returns {Promise<{ok: boolean, url: string|null, skipped?: boolean}>}
 */
async function postLssdCombinedReply({ key, entry, reportData, completionBb, bbCode, progress, stepFailed }) {
    const markLssdFailure = async (reason) => {
        console.warn(`[AUTO-COMPLETE] LSSD crosspost for #${key} — ${reason}`);
        await finishCompletionStep(key, 'lssdCombinedReply', false, reason);
        if (state.dbRef) {
            state.dbRef.child(`autopsy-requested/${key}`).update({
                lssdCrosspostStatus: 'failed',
                lssdCrosspostError: reason,
                lssdCrosspostBbCode: bbCode,
                lssdCrosspostOoc: entry.oocName || reportData.data?.decedentOOC || '',
            }).catch(() => {});
        }
    };

    const lssdRequestTopicId = entry.lssdRequestTopicId;

    // Private cases (confidential autopsies) never crosspost to LSSD.
    if (entry.isPrivate === true) {
        console.log(`[AUTO-COMPLETE] Private case #${key} — skipping LSSD crosspost`);
        await finishCompletionStep(key, 'lssdCombinedReply', true, 'Private case — LSSD crosspost skipped');
        return { ok: true, url: null, skipped: true };
    }

    // The REQUEST record is authoritative for faction — the report's department
    // field is only a hint (MEs sometimes leave it on the wrong agency mid-batch).
    const rawDept = reportData.data?.department || '';
    const deptStr = (typeof rawDept === 'object' ? (rawDept.label || rawDept.value || '') : String(rawDept)).toLowerCase();
    const oocName = reportData.data?.decedentOOC || entry.oocName || '';
    const decedentName = reportData.data?.decedentName || entry.name || '';
    const entryFaction = (entry.faction || '').toLowerCase();
    const titleTag = (/\[(lssd|lspd)\]/i.exec(entry.title || '') || [])[1]?.toLowerCase() || '';
    const isLssdRequest = entryFaction === 'lssd' || titleTag === 'lssd' || deptStr.includes('lssd') || deptStr.includes('sheriff');
    const lssdDept = deptStr.includes('lssd') || deptStr.includes('sheriff');
    const lspdDept = deptStr.includes('lspd') || deptStr.includes('police');
    if ((entryFaction === 'lssd' && lspdDept && !lssdDept) || (entryFaction === 'lspd' && lssdDept && !lspdDept)) {
        console.warn(`[AUTO-COMPLETE] Faction mismatch — request="${entryFaction}" but report department="${deptStr}". Trusting the request.`);
    }

    // Searchable only if we have an OOC name or a non-generic decedent name.
    // The actual search (scoped to the LSSD autopsy forum f=2263, trying
    // "Name (( OOC ))" then the plain name) lives in searchLssdRequestTopic.
    const searchable = oocName || (decedentName && !/^john\s*doe$/i.test(decedentName) ? decedentName : '');

    if (!isLssdRequest) {
        await finishCompletionStep(key, 'lssdCombinedReply', true, 'No LSSD request topic (not an LSSD case)');
        return { ok: true, url: null };
    }

    if (!searchable) {
        await markLssdFailure('LSSD case but no searchable name (no OOC / generic name) — force crosspost manually');
        await progress.addStep('LSSD Completion + Report', 'fail', 'No searchable name');
        return { ok: false, url: null };
    }

    // Combined reply: completion notice + full autopsy report in one post.
    const lssdCombinedBb = completionBb + '\n\n[hr][/hr]\n\n' + bbCode;

    if (lssdRequestTopicId) {
        await progress.addStep('LSSD Completion + Report', 'pending');
        const lssdClient = createIsolatedClient('lssd-complete');
        try {
            // Login to LSSD once for the combined reply
            await lssdClient.login(process.env.FORUM_LSSD_USERNAME, process.env.FORUM_LSSD_PASSWORD, { force: true, baseUrl: 'https://lssd.gta.world' });

            console.log('[AUTO-COMPLETE] LSSD combined reply — posting completion + report to #' + lssdRequestTopicId);
            const r = await lssdClient.replyToTopic(lssdRequestTopicId, 2263, lssdCombinedBb, { dryRun: false, baseUrl: 'https://lssd.gta.world' });
            console.log('[AUTO-COMPLETE] LSSD combined reply — ' + (r.ok ? 'OK #' + lssdRequestTopicId : 'FAILED: ' + (r.reason || 'Unknown')));
            await finishCompletionStep(key, 'lssdCombinedReply', r.ok, r.ok ? 'Completion + report to #' + lssdRequestTopicId : (r.reason || 'Unknown'));
            await progress.addStep('LSSD Completion + Report', r.ok ? 'ok' : 'fail', r.ok ? '#' + lssdRequestTopicId : (r.reason || 'Failed'));
            if (!r.ok) stepFailed.LSSD = true;
            return { ok: r.ok, url: r.ok ? (r.url || null) : null };
        } catch (e) {
            console.error('[AUTO-COMPLETE] LSSD operation error: ' + e.message);
            await finishCompletionStep(key, 'lssdCombinedReply', false, e.message);
            await progress.addStep('LSSD Completion + Report', 'fail', e.message);
            stepFailed.LSSD = true;
            return { ok: false, url: null };
        } finally {
            // Note: we deliberately do NOT close the isolated client here.
            // Closing the context while the health check is creating a
            // page on the shared browser triggers harmless but noisy
            // stealth plugin errors. GC will handle cleanup.
        }
    }

    // Fallback: if no LSSD topic ID was saved during detection, try to find it now.
    await progress.addStep('LSSD Completion + Report', 'pending');
    const lssdClient = createIsolatedClient('lssd-complete');
    try {
        console.log('[AUTO-COMPLETE] LSSD fallback — searching LSSD autopsy forum (f=2263)...');
        await lssdClient.login(process.env.FORUM_LSSD_USERNAME, process.env.FORUM_LSSD_PASSWORD, { force: true, baseUrl: 'https://lssd.gta.world' });
        const foundTopic = await searchLssdRequestTopic(lssdClient, { oocName, name: decedentName });
        const fallbackTopicId = foundTopic?.topicId || null;

        if (fallbackTopicId) {
            console.log('[AUTO-COMPLETE] LSSD fallback — found topic #' + fallbackTopicId);
            if (state.dbRef) {
                state.dbRef.child(`autopsy-requested/${key}/lssdRequestTopicId`).set(String(fallbackTopicId)).catch(() => {});
            }
            const r = await lssdClient.replyToTopic(fallbackTopicId, 2263, lssdCombinedBb, { dryRun: false, baseUrl: 'https://lssd.gta.world' });
            await finishCompletionStep(key, 'lssdCombinedReply', r.ok, r.ok ? 'Fallback completion + report to #' + fallbackTopicId : (r.reason || 'Unknown'));
            await progress.addStep('LSSD Completion + Report', r.ok ? 'ok' : 'fail', r.ok ? '#' + fallbackTopicId : (r.reason || 'Failed'));
            if (!r.ok) { stepFailed.LSSD = true; await markLssdFailure('Completion + report reply failed: ' + (r.reason || 'Unknown')); }
            if (r.ok && state.dbRef) {
                state.dbRef.child(`autopsy-requested/${key}`).update({
                    lssdCrosspostStatus: 'completed',
                    lssdCrosspostError: null,
                    lssdRequestTopicId: String(fallbackTopicId),
                    lssdCrosspostedAt: new Date().toISOString(),
                }).catch(() => {});
            }
            return { ok: r.ok, url: r.ok ? (r.url || null) : null };
        } else {
            console.log('[AUTO-COMPLETE] LSSD fallback — no topic found for ' + (oocName || decedentName));
            await markLssdFailure('LSSD request topic not found via search');
            await progress.addStep('LSSD Completion + Report', 'fail', 'No LSSD topic found');
            return { ok: false, url: null };
        }
    } catch (e) {
        console.error('[AUTO-COMPLETE] LSSD fallback error: ' + e.message);
        await finishCompletionStep(key, 'lssdCombinedReply', false, e.message);
        await progress.addStep('LSSD Completion + Report', 'fail', e.message);
        stepFailed.LSSD = true;
        await markLssdFailure(e.message);
        return { ok: false, url: null };
    } finally {
        try { await lssdClient.close(); } catch {}
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
    }
}

/**
 * Handle an Autopsy report — search Case Management forum (f=266) by decedent name
 * and reply to the case thread with the autopsy BBCode.
 * Dry-run by default for safety — set AUTOPSY_DRY_RUN=false in .env to enable live posting.
 */
export async function handleAutopsyReply(report) {
    const { authorId, key, report: reportData, db } = report;
    const DRY = AUTOPSY_DRY_RUN;

    console.log(`[AUTO]  handleAutopsyReply called for ${key}  name: "${reportData.data?.decedentName}"`);

    // Determine search terms from report data
    const decedentName = (reportData.data?.decedentName || '').trim();
    const decedentOOC = (reportData.data?.decedentOOC || '').trim();
    const searchTerm = decedentOOC || decedentName || reportData.originalKey || '';

    if (!searchTerm) {
        console.log(`[AUTO]  ${key}  no decedent name to search for`);
        await setDeployStatus(db, authorId, key, 'error', 'Missing decedent name. Add a name to the report and save again.');
        await logStep(' Cannot Process', 'Add a **Decedent Name** to the autopsy report, then save again.', { color: 0xdc3545, isFinal: true });
        return;
    }

    // Guard: skip reply if ALL matching autopsy-requested entries for this OOC+name are
    // already completed (prevents duplicate on retry for a fully-processed case).
    // If even one matching entry is still pending (no completedAt), proceed — there is still
    // an active request to reply to.
    const oocGuard = (reportData.data?.decedentOOC || "").trim();
    const nameGuard = (reportData.data?.decedentName || "").trim();
    if (oocGuard && nameGuard) {
        try {
            const guardSnap = await db.ref("autopsy-requested").orderByChild("oocName").equalTo(oocGuard).once("value");
            let anyPending = false;
            let allComplete = true;
            if (guardSnap.exists()) guardSnap.forEach(c => {
                const entry = c.val();
                if (entry.name === nameGuard) {
                    if (entry.completedAt) { /* complete — counts toward allComplete */ }
                    else anyPending = true;
                }
            });
            if (guardSnap.exists()) allComplete = !anyPending;
            // Only skip if there are matching entries AND all of them are completed (no pending request)
            if (!anyPending && guardSnap.exists()) {
                console.log(`[AUTO] ${key} all requests for this OOC+name are already completed — skipping duplicate reply`);
                await setDeployStatus(db, authorId, key, "already_completed", "Skipped duplicate reply.");
                await markReportComplete(db, authorId, key, reportData.originalKey || key, "autopsy-reply-skip", null);
                return;
            }
        } catch (e) { console.warn(`[AUTO] completion guard error: ${e.message}`); }
    }

    const bbSnap = await db.ref(`scheduledReportsBBCode/${authorId}/${key}`).once('value');
    const bbCode = bbSnap.val()?.bbCode;
    if (!bbCode) {
        console.log(`[AUTO]  ${key}  no BBCode, marking as deployed`);
        await setDeployStatus(db, authorId, key, 'error', 'No BBCode content found in report. Regenerate and save again.');
        await logStep(' No BBCode', 'The report has no BBCode content. Regenerate and save again.', { color: 0xdc3545, isFinal: true });
        return;
    }

    const client = getForumClient();
    const progress = new DeployProgressEmbed(state.discordClient, process.env.BOT_LOG_CHANNEL_ID);
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
            let arSnap = null;
            // Prefer matching the real decedent OOC name (stored in oocName OR name)
            if (ooc) {
                arSnap = await db.ref("autopsy-requested").orderByChild("oocName").equalTo(ooc).once("value");
                if (!arSnap.exists()) {
                    const byName = await db.ref("autopsy-requested").orderByChild("name").equalTo(ooc).once("value");
                    if (byName.exists()) arSnap = byName;
                }
            }
            // Fallback: decedent name field — but NEVER a generic "John Doe" placeholder
            if ((!arSnap || !arSnap.exists()) && name && !/^john\s*doe$/i.test(name)) {
                arSnap = await db.ref("autopsy-requested").orderByChild("name").equalTo(name).once("value");
                if (!arSnap.exists()) {
                    const byOoc = await db.ref("autopsy-requested").orderByChild("oocName").equalTo(name).once("value");
                    if (byOoc.exists()) arSnap = byOoc;
                }
            }
            if (arSnap && arSnap.exists()) {
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

            await setDeployStatus(db, authorId, key, 'topic_not_found', `No case thread found for "${searchTerm}". Create one manually, then re-save.`);
            await progress.addStep('Case Not Found', 'fail', 'No matching PHMC or LSSD thread exists');
            await progress.finalize('failed');
            return;
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
            ].join('\n'))
            .setFooter({ text: `Expires in 5 min | ${pickId}` })
            .setTimestamp();

        const rows = [];
        // Split into rows of up to 3 buttons each (Discord limit: 5 per row)
        for (let i = 0; i < caseThreads.length; i += 3) {
            const chunk = caseThreads.slice(i, i + 3);
            const row = new ActionRowBuilder().addComponents(
                chunk.map((t, j) =>
                    new ButtonBuilder()
                        .setCustomId(`${pickId}_${t.topicId}`)
                        .setLabel(`#${t.topicId}`)
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
            setTimeout(async () => {
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
            }, 5 * 60 * 1000);

            console.log(`[AUTO]  Waiting for staff to pick a thread for "${searchTerm}"`);
            return;
        } catch (err) {
            console.error(`[AUTO]  Failed to prompt staff for topic pick: ${err.message}`);
            // Fall through to auto-pick the first result
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

    const result = await client.replyToTopic(topicId, CASE_MGMT_FORUM_ID, bbCode, { dryRun: DRY });

    if (result.ok && !result.dryRun) {
        await progress.addStep('Autopsy Posted', 'ok', result.url || '');
        const label = reportData.originalKey || key;
        const completed = await markReportComplete(db, authorId, key, label, 'autopsy-reply', result.url);
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
                if (topicId) {
                    arSnap = await db.ref("autopsy-requested").orderByChild("caseTopicId").equalTo(String(topicId)).once("value");
                    if (arSnap.exists()) console.log('[AUTO-COMPLETE] Matched by caseTopicId #' + topicId);
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
                if ((!arSnap || !arSnap.exists()) && topicId) {
                    const allReqSnap = await db.ref("autopsy-requested").once("value");
                    const allReq = allReqSnap.val() || {};
                    outer:
                    for (const [key, entry] of Object.entries(allReq)) {
                        if (entry.caseState !== 'multi' || !entry.cases) continue;
                        for (const [ci, c] of Object.entries(entry.cases)) {
                            if (String(c.caseTopicId) === String(topicId)) {
                                console.log(`[AUTO-COMPLETE] Matched multi-decedent record #${key} case ${ci} by caseTopicId #${topicId}`);
                                multiMatch = { key, entry, ci: parseInt(ci, 10), caseRec: c };
                                break outer;
                            }
                        }
                    }
                }

                const entries = [];
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
                    // Convert to array for async iteration (forEach doesn't await)
                    arSnap.forEach((child) => {
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
                        if (caseRec) {
                            // Per-case completion — the request stays open until
                            // every decedent's case has completed.
                            await ref.child(`cases/${caseIdx}`).update({ completedAt: new Date().toISOString(), completedBbCode: bbCode });
                            const casesSnap = await ref.child('cases').once('value');
                            const allCasesDone = Object.values(casesSnap.val() || {}).every(c => c.completedAt);
                            if (allCasesDone) {
                                await ref.update({ completedAt: new Date().toISOString(), completedBbCode: bbCode });
                                console.log('[AUTO-COMPLETE] All decedent cases complete — request marked completed');
                            }
                        } else {
                            await ref.update({ completedAt: new Date().toISOString(), completedBbCode: bbCode });
                        }
                        console.log("[AUTO] [OK] Marked autopsy-requested #" + key + " as completed");

                        // Decrement the ME's active case count in the rotation tracker
                        const completingMe = caseRec?.assignedTo || entry.assignedTo;
                        if (completingMe) {
                            clearAssignment(db, completingMe, key).catch(err => {
                                console.warn(`[AUTO-COMPLETE] rotation tracking error: ${err.message}`);
                            });
                        }

                        // ── Consolidated progress embed (one self-updating message per entry) ──
                        const caseName = caseRec?.name || caseRec?.oocName || entry.name || entry.oocName || key;
                        const progress = new DeployProgressEmbed(state.discordClient, process.env.BOT_LOG_CHANNEL_ID);
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

                        // ── LSSD completion + report — posts FIRST for LSSD cases ──
                        // The combined reply (completion notice + full report) goes out to
                        // f=2263 before the PHMC completion notice so its topic URL can be
                        // embedded in the f=265 reply below (LSSD_COMPLETION_LINK template).
                        let completionBb = buildCompletionBb(caseTitle, requesterName, null);
                        let lssdCompletionUrl = null;
                        if (!isPrivateEntry) {
                            const lssdRes = await postLssdCombinedReply({
                                key, entry, reportData, completionBb, bbCode, progress, stepFailed,
                            });
                            lssdCompletionUrl = lssdRes.url;
                            if (lssdRes.ok && lssdCompletionUrl && state.dbRef) {
                                await state.dbRef.child(`autopsy-requested/${key}`).update({
                                    lssdCompletionUrl,
                                    lssdCrosspostStatus: 'completed',
                                    lssdCrosspostedAt: new Date().toISOString(),
                                }).catch(() => {});
                            }
                            if (lssdCompletionUrl) completionBb = buildCompletionBb(caseTitle, requesterName, lssdCompletionUrl);
                        } else {
                            await finishCompletionStep(key, 'lssdCombinedReply', true, 'Private case — LSSD crosspost skipped');
                            await progress.addStep('LSSD Completion + Report', 'ok', 'Skipped (private case)');
                        }

                        // ── PHMC completion reply ──
                        // Runs after the LSSD post, carrying the direct LSSD link when one was posted.
                        await progress.addStep('PHMC Reply', 'pending');
                        stepPromises.push((async () => {
                            const stepName = 'phmcCompletionReply';
                            await startCompletionStep(key, stepName, 'Reply to #' + entry.topicId);
                            try {
                                const r = await client.replyToTopic(entry.topicId, AUTOPSY_REQUEST_FORUM_ID, completionBb, { dryRun: false });
                                const skipped = r.topicMissing === true;
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
                        } else if (lspdTopicId || isLspdCase) {
                            await progress.addStep('LSPD Crosspost', 'pending');
                            stepPromises.push((async () => {
                                const stepName = 'lspdCrosspost';
                                const label = lspdTopicId ? 'Reply to LSPD #' + lspdTopicId : 'Create LSPD topic';
                                await startCompletionStep(completedTopicId, stepName, label);
                                try {
                                    const lspdReportData = {
                                        data: {
                                            ...(reportData?.data || {}),
                                            department: reportData?.data?.department || 'Los Santos Police Department',
                                            decedentName: reportData?.data?.decedentName || caseRec?.name || entry.name || '',
                                            decedentOOC: reportData?.data?.decedentOOC || caseRec?.oocName || entry.oocName || '',
                                        }
                                    };
                                    // Pass null lspdTopicId when missing — crosspostAutopsyToLspd
                                    // will create a new topic on the LSPD forum as fallback.
                                    const lspdResult = await crosspostAutopsyToLspd(
                                        lspdReportData,
                                        bbCode,
                                        completedTopicId,
                                        state.dbRef,
                                        lspdTopicId || null,
                                        { caseTitle: completedCaseTitle, caseTopicId: caseRec?.caseTopicId || entry.caseTopicId }
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

                            // Resolve forum target for private pm_forum deliveries
                            let pmForumBaseUrl = null;
                            let pmForumUser = null;
                            let pmForumPass = null;
                            if (isPrivateEntry && entry.pmForum) {
                                const forumKey = String(entry.pmForum).toLowerCase();
                                if (forumKey === 'lssd') {
                                    pmForumBaseUrl = 'https://lssd.gta.world';
                                    pmForumUser = process.env.FORUM_LSSD_USERNAME;
                                    pmForumPass = process.env.FORUM_LSSD_PASSWORD;
                                } else if (forumKey === 'lspd') {
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

                                // Login to the target forum before composing the PM.
                                // The isolated client starts with no session cookies,
                                // so it must authenticate or phpBB will show the login page.
                                if (isPmForumDelivery) {
                                    await dmClient.login(pmForumUser, pmForumPass, { force: true, baseUrl: pmForumBaseUrl });
                                } else {
                                    await dmClient.login(null, null, { force: true, baseUrl: process.env.FORUM_BASE_URL });
                                }

                                let dmTarget = '';
                                let dmBaseUrl = pmForumBaseUrl || process.env.FORUM_BASE_URL;

                                if (isPmForumDelivery) {
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
                                console.log("[AUTO-COMPLETE] Sending DM to " + dmTarget + " (isolated client)");
                                const r = await dmClient.sendPM(dmTarget, dmSubject, bbCode, { baseUrl: dmBaseUrl });
                                await finishCompletionStep(key, 'dmSent', r.ok, r.ok ? 'DM sent to ' + dmTarget : (r.reason || 'Unknown'));
                                await progress.addStep('DM Requester', r.ok ? 'ok' : 'fail', r.ok ? dmTarget : (r.reason || 'Failed'));
                                if (!r.ok) stepFailed.DM = true;
                            } catch (e) {
                                await finishCompletionStep(key, 'dmSent', false, e.message);
                                await progress.addStep('DM Requester', 'fail', e.message);
                                stepFailed.DM = true;
                            } finally {
                                // Same reasoning as LSSD client — leaving context open avoids
                                // noisy stealth plugin race with the health check.
                            }
                        })());

                        // Wait for all completion steps, then finalize
                        const results = await Promise.allSettled(stepPromises);
                        const anyFailed = Object.keys(stepFailed).length > 0;
                        if (anyFailed) {
                            const failedList = Object.keys(stepFailed).join(', ');
                            await progress.addStep('Retry Scheduled', 'warn', `${failedList} — will auto-retry on next cycle`);
                        }
                        await progress.finalize(anyFailed ? 'failed' : 'complete');
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
            await setDeployStatus(db, authorId, key, 'reply_failed', result.reason || 'Unknown error replying to case thread');
            console.error(`[AUTO]  Failed to reply to case #${topicId}: ${result.reason || 'Unknown'}`);
            await progress.addStep('Reply Failed', 'fail', result.reason || 'Unknown');
            await progress.finalize('failed');
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
export async function retryFailedCompletionSteps(db) {
    logFnCall('autoDeploy', 'retryFailedCompletionSteps', 'Scanning for failed completion steps to retry');
    const COOLDOWN_MS = 30 * 60 * 1000; // skip steps retried within the last 30 min
    try {
        const snap = await db.ref('autopsy-requested').once('value');
        if (!snap.exists()) return;

        const failedEntries = [];
        let attemptingCount = 0;

        snap.forEach((child) => {
            const entry = child.val();
            const steps = entry.completionSteps;
            if (!steps) return;

            const caseLabel = `"${entry.name || entry.oocName || 'Unknown'}" (#${child.key})`;

            for (const [stepName, stepData] of Object.entries(steps)) {
                if (stepData?.status === 'failed') {
                    // Cooldown: skip steps retried within the last 30 min so a persistently
                    // stuck step doesn't spam the sweep (now running every 10 min).
                    if (stepData.retriedAt && (Date.now() - new Date(stepData.retriedAt).getTime()) < COOLDOWN_MS) {
                        console.log(`[AUTO-COMPLETE] ${stepName} for ${caseLabel} — retried <30 min ago, cooling down`);
                        continue;
                    }
                    failedEntries.push({ key: child.key, entry, stepName, stepData, caseLabel });
                    console.warn(`[AUTO-COMPLETE] FAILED ${stepName} for ${caseLabel}: ${stepData.detail || 'No details'}`);
                } else if (stepData?.status === 'attempting') {
                    attemptingCount++;
                    console.warn(`[AUTO-COMPLETE] ATTEMPTING (crash mid-op) ${stepName} for ${caseLabel} — ${stepData.detail || ''} — SKIPPING to avoid duplicate. Check manually if needed.`);
                }
            }
        });

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
                const completionBb = buildCompletionBb(caseTitle, requesterName, entry.lssdCompletionUrl);

                let success = false;

                if (stepName === 'phmcCompletionReply') {
                    if (!entry.topicId) {
                        console.warn(`[AUTO-COMPLETE] Cannot retry ${stepName} for ${caseLabel}: no topicId`);
                        stillFailed++;
                        continue;
                    }
                    const r = await retryClient.replyToTopic(entry.topicId, AUTOPSY_REQUEST_FORUM_ID, completionBb, { dryRun: false });
                    success = r.ok || r.topicMissing === true;
                    if (success) {
                        console.log(r.topicMissing
                            ? `[AUTO-COMPLETE] [OK] Retry OK — ${stepName} for ${caseLabel}: request topic no longer exists (nothing to reply to)`
                            : `[AUTO-COMPLETE] [OK] Retry OK — ${stepName} for ${caseLabel} → reply to #${entry.topicId}`);
                    } else {
                        console.warn(`[AUTO-COMPLETE] [ERR] Retry failed — ${stepName} for ${caseLabel}: ${r.reason || 'Unknown'}`);
                    }

                } else if (stepName === 'lssdCombinedReply') {
                    const lssdTopicId = entry.lssdRequestTopicId;
                    if (!lssdTopicId) {
                        console.log(`[AUTO-COMPLETE] [OK] Retry OK — ${stepName} for ${caseLabel}: not an LSSD case`);
                        success = true;
                    } else {
                        const reportBb = entry.completedBbCode || '';
                        if (!reportBb) {
                            console.warn(`[AUTO-COMPLETE] Cannot retry ${stepName} for ${caseLabel}: no completedBbCode`);
                            // Mark as resolved — can't retry without the report content
                            success = true;
                        } else {
                            await retryClient.login(process.env.FORUM_LSSD_USERNAME, process.env.FORUM_LSSD_PASSWORD, { force: true, baseUrl: 'https://lssd.gta.world' });
                            const content = completionBb + '\n\n[hr][/hr]\n\n' + reportBb;
                            console.log(`[AUTO-COMPLETE] Retrying LSSD completion + report to #${lssdTopicId}...`);
                            const r = await retryClient.replyToTopic(lssdTopicId, 2263, content, { dryRun: false, baseUrl: 'https://lssd.gta.world' });
                            success = r.ok;
                            console.log(`[AUTO-COMPLETE] LSSD completion + report retry — ${r.ok ? 'OK' : 'FAILED: ' + (r.reason || 'Unknown')}`);
                            if (r.ok && r.url && state.dbRef) {
                                await state.dbRef.child(`autopsy-requested/${key}`).update({ lssdCompletionUrl: r.url }).catch(() => {});
                            }
                        }
                    }

                } else if (stepName === 'lssdCompletionReply' || stepName === 'lssdAutopsyReport') {
                    // Legacy steps — entries completed before the combined-reply change.
                    const lssdTopicId = entry.lssdRequestTopicId;
                    if (!lssdTopicId) {
                        console.log(`[AUTO-COMPLETE] [OK] Retry OK — ${stepName} for ${caseLabel}: not an LSSD case`);
                        success = true;
                    } else {
                        await retryClient.login(process.env.FORUM_LSSD_USERNAME, process.env.FORUM_LSSD_PASSWORD, { force: true, baseUrl: 'https://lssd.gta.world' });
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
                        const bbCodeToSend = entry.completedBbCode || '';
                        if (!bbCodeToSend) {
                            console.warn(`[AUTO-COMPLETE] Cannot retry ${stepName} for ${caseLabel}: no completedBbCode`);
                            stillFailed++;
                            continue;
                        }
                        console.log(`[AUTO-COMPLETE] Retrying LSPD crosspost to #${lspdTopicId}...`);
                        await retryClient.login(process.env.FORUM_LSPD_USERNAME, process.env.FORUM_LSPD_PASSWORD, { force: true, baseUrl: 'https://lspd.gta.world' });
                        const r = await retryClient.replyToTopic(lspdTopicId, 1361, bbCodeToSend, { dryRun: false, baseUrl: 'https://lspd.gta.world' });
                        success = r.ok;
                        console.log(`[AUTO-COMPLETE] LSPD crosspost retry — ${r.ok ? 'OK' : 'FAILED: ' + (r.reason || 'Unknown')}`);
                    }

                } else if (stepName === 'dmSent') {
                    const bbCodeToSend = entry.completedBbCode;
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
                            await retryClient.login(process.env.FORUM_LSSD_USERNAME, process.env.FORUM_LSSD_PASSWORD, { force: true, baseUrl: dmBaseUrl });
                        } else if (forumKey === 'lspd') {
                            dmBaseUrl = 'https://lspd.gta.world';
                            await retryClient.login(process.env.FORUM_LSPD_USERNAME, process.env.FORUM_LSPD_PASSWORD, { force: true, baseUrl: dmBaseUrl });
                        } else {
                            await retryClient.login(null, null, { force: true, baseUrl: dmBaseUrl });
                        }
                        console.log(`[AUTO-COMPLETE] Private case retry DM target: ${dmTarget} via ${dmBaseUrl}`);
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
                        const r = await retryClient.sendPM(dmTarget, dmSubject, bbCodeToSend, { baseUrl: dmBaseUrl });
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
        try { retryClient.close(); } catch (e) { /* ignore */ }

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
