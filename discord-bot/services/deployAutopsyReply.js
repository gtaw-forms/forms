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
import { state, C } from './deployState.js';
import { setDeployStatus, markReportComplete } from './deployStatus.js';
import { crosspostAutopsyToLssd, retryFailedLssdCrossposts } from './deployLssd.js';
import { crosspostAutopsyToLspd } from './deployLspd.js';
import { clearAssignment, getRotationStatus } from './autopsyRotation.js';

// ── Constants ──
export const CASE_MGMT_FORUM_ID = 266;
export const AUTOPSY_DRY_RUN = process.env.AUTOPSY_DRY_RUN !== 'false'; // default dry-run
export const AUTOPSY_REQUEST_FORUM_ID = 265;

/**
 * Completion reply template for the original autopsy request topic.
 * Posted when the autopsy report is completed.
 */
export const COMPLETION_TEMPLATE = `[divbox=white][center][img]https://i.imgur.com/Hxjt4M2.png[/img][/center][/divbox]

[divbox=white]
Dear REQUESTER_NAME

We have completed the autopsy investigation, and the detailed report has been sent out. I have thoroughly reviewed all findings and compiled the results into a comprehensive document. Please review the report at your earliest convenience, and feel free to reach out if you have any questions or require further information.

[i]Best regards,[/i]
[hr][/hr]
[b]Office of Forensic Medicine Division[/b]
Department of Forensic Medicine and Pathology

[b]Pillbox Hill Medical Center[/b]
[size=85]Elgin Ave/Strawberry Ave, Los Santos, SA
Ph: 50056
Mail: [url=https://phmc.gta.world/ucp.php?i=pm&mode=compose&u=your_id]medical.examiners@phmc.health[/url]
Website: [url]www.phmc.health[/url][/size]

[center][img]https://i.imgur.com/vztjYpe.png[/img][/center]`;

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
 * Mark a completion step as "completed" or "failed" (written after the operation finishes).
 * Writes to Firebase for retry tracking + console log for PM2.
 * Live Discord updates are handled by the per-entry DeployProgressEmbed in the caller.
 */
async function finishCompletionStep(topicId, stepName, ok, detail = '') {
    const status = ok ? 'completed' : 'failed';
    const icon = ok ? '[OK]' : '[WARN]';
    console.log(`[AUTO-COMPLETE] ${icon} ${stepName}: ${ok ? 'OK' : 'FAIL'} ${detail}`);

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

    // Guard: skip reply if already completed in autopsy-requested (prevents duplicate on retry)
    const oocGuard = (reportData.data?.decedentOOC || "").trim();
    if (oocGuard) {
        try {
            const guardSnap = await db.ref("autopsy-requested").orderByChild("oocName").equalTo(oocGuard).once("value");
            let alreadyDone = false;
            if (guardSnap.exists()) guardSnap.forEach(c => { if (c.val().completedAt) alreadyDone = true; });
            if (alreadyDone) {
                console.log(`[AUTO] ${key} already completed — skipping duplicate reply`);
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
            let arSnap = ooc
                ? await db.ref("autopsy-requested").orderByChild("oocName").equalTo(ooc).once("value")
                : null;
            if ((!arSnap || !arSnap.exists()) && name) {
                const nameSnap = await db.ref("autopsy-requested").orderByChild("name").equalTo(name).once("value");
                if (nameSnap.exists()) arSnap = nameSnap;
            }
            if (arSnap && arSnap.exists()) {
                arSnap.forEach((child) => {
                    if (!arEntry) {
                        arEntry = { key: child.key, data: child.val() };
                    }
                });
                if (arEntry && arEntry.data.caseTopicId) {
                    topicId = arEntry.data.caseTopicId;
                    foundTitle = arEntry.data.caseTitle || 'Case #' + topicId;
                    console.log('[AUTO] Found saved caseTopicId=' + topicId + ' — skipping forum search');
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

                if (ooc) {
                    arSnap = await db.ref("autopsy-requested").orderByChild("oocName").equalTo(ooc).once("value");
                }
                if (!arSnap || !arSnap.exists()) {
                    if (name) {
                        console.log('[AUTO-COMPLETE] OOC not found, trying by name: "' + name + '"');
                        arSnap = await db.ref("autopsy-requested").orderByChild("name").equalTo(name).once("value");
                    }
                }
                if (arSnap && arSnap.exists()) {
                    // Convert to array for async iteration (forEach doesn't await)
                    const entries = [];
                    arSnap.forEach((child) => {
                        const entry = child.val();
                        if (entry.completedAt) return;
                        entries.push({ key: child.key, entry, ref: child.ref });
                    });

                    for (const { key, entry, ref } of entries) {
                        completedTopicId = key;
                        completedLssdTopicId = entry.lssdRequestTopicId;
                        completedLspdTopicId = entry.lspdTopicId;
                        completedCaseTitle = (entry.caseTitle || entry.title || "Autopsy Case").replace(/\s*[-–—]\s*UNASSIGNED\s*$/i, '');

                        console.log('[AUTO-COMPLETE] Marking autopsy request as completed in Firebase');
                        ref.update({ completedAt: new Date().toISOString(), completedBbCode: bbCode });
                        console.log("[AUTO] [OK] Marked autopsy-requested #" + key + " as completed");

                        // Decrement the ME's active case count in the rotation tracker
                        if (entry.assignedTo) {
                            clearAssignment(db, entry.assignedTo, key).catch(err => {
                                console.warn(`[AUTO-COMPLETE] rotation tracking error: ${err.message}`);
                            });
                        }

                        // ── Consolidated progress embed (one self-updating message per entry) ──
                        const caseName = entry.name || entry.oocName || key;
                        const progress = new DeployProgressEmbed(state.discordClient, process.env.BOT_LOG_CHANNEL_ID);
                        await progress.start(`Autopsy Completion — ${caseName}`);

                        const requesterName = entry.parsed?.requesterName || "Requesting Party";
                        const caseTitle = entry.caseUrl || entry.title || "Autopsy Case";
                        const completionBb = COMPLETION_TEMPLATE
                            .replace("CASE_TITLE", caseTitle)
                            .replace("REQUESTER_NAME", requesterName);

                        const stepPromises = [];
                        const stepFailed = {};

                        // ── 1. PHMC completion reply ──
                        await progress.addStep('PHMC Reply', 'pending');
                        stepPromises.push((async () => {
                            const stepName = 'phmcCompletionReply';
                            await startCompletionStep(key, stepName, 'Reply to #' + entry.topicId);
                            try {
                                const r = await client.replyToTopic(entry.topicId, AUTOPSY_REQUEST_FORUM_ID, completionBb, { dryRun: false });
                                await finishCompletionStep(key, stepName, r.ok, r.ok ? 'Reply posted to #' + entry.topicId : (r.reason || 'Unknown'));
                                await progress.addStep('PHMC Reply', r.ok ? 'ok' : 'fail', r.ok ? '#' + entry.topicId : (r.reason || 'Failed'));
                                if (!r.ok) stepFailed.PHMC = true;
                            } catch (e) {
                                await finishCompletionStep(key, stepName, false, e.message);
                                await progress.addStep('PHMC Reply', 'fail', e.message);
                                stepFailed.PHMC = true;
                            }
                        })());

                        // ── 2 + 3. LSSD operations on a dedicated isolated client ──
                        // Uses its own browser context + session so it never conflicts
                        // with the PHMC client's session state.
                        const lssdRequestTopicId = entry.lssdRequestTopicId;
                        if (lssdRequestTopicId) {
                            await progress.addStep('LSSD Confirmation Reply', 'pending');
                            await progress.addStep('LSSD Autopsy Report', 'pending');
                            stepPromises.push((async () => {
                                const lssdClient = createIsolatedClient('lssd-complete');
                                try {
                                    // Login to LSSD once for both replies
                                    await lssdClient.login(process.env.FORUM_LSSD_USERNAME, process.env.FORUM_LSSD_PASSWORD, { force: true, baseUrl: 'https://lssd.gta.world' });

                                    // Step 2: Confirmation reply (COMPLETION_TEMPLATE)
                                    console.log('[AUTO-COMPLETE] LSSD confirmation reply — posting COMPLETION_TEMPLATE to #' + lssdRequestTopicId);
                                    const r1 = await lssdClient.replyToTopic(lssdRequestTopicId, 2263, completionBb, { dryRun: false, baseUrl: 'https://lssd.gta.world' });
                                    console.log('[AUTO-COMPLETE] LSSD confirmation reply — ' + (r1.ok ? 'OK #' + lssdRequestTopicId : 'FAILED: ' + (r1.reason || 'Unknown')));
                                    await finishCompletionStep(key, 'lssdCompletionReply', r1.ok, r1.ok ? 'Confirmation reply to #' + lssdRequestTopicId : (r1.reason || 'Unknown'));
                                    await progress.addStep('LSSD Confirmation Reply', r1.ok ? 'ok' : 'fail', r1.ok ? '#' + lssdRequestTopicId : (r1.reason || 'Failed'));
                                    if (!r1.ok) stepFailed.LSSD = true;

                                    // Brief pause to let phpBB commit the first reply and generate a
                                    // fresh form token before loading the reply page for the second post.
                                    await new Promise(r => setTimeout(r, 3000));

                                    // Step 3: Autopsy report (full bbCode) — same topic, same client
                                    console.log('[AUTO-COMPLETE] LSSD autopsy report — posting full report to #' + lssdRequestTopicId);
                                    const r2 = await lssdClient.replyToTopic(lssdRequestTopicId, 2263, bbCode, { dryRun: false, baseUrl: 'https://lssd.gta.world' });
                                    console.log('[AUTO-COMPLETE] LSSD autopsy report — ' + (r2.ok ? 'OK #' + lssdRequestTopicId : 'FAILED: ' + (r2.reason || 'Unknown')));
                                    await finishCompletionStep(key, 'lssdAutopsyReport', r2.ok, r2.ok ? 'Report reply to #' + lssdRequestTopicId : (r2.reason || 'Unknown'));
                                    await progress.addStep('LSSD Autopsy Report', r2.ok ? 'ok' : 'fail', r2.ok ? '#' + lssdRequestTopicId : (r2.reason || 'Failed'));
                                    if (!r2.ok) stepFailed.LSSD = true;
                                } catch (e) {
                                    console.error('[AUTO-COMPLETE] LSSD operation error: ' + e.message);
                                    await finishCompletionStep(key, 'lssdCompletionReply', false, e.message);
                                    await finishCompletionStep(key, 'lssdAutopsyReport', false, e.message);
                                    await progress.addStep('LSSD Confirmation Reply', 'fail', e.message);
                                    await progress.addStep('LSSD Autopsy Report', 'fail', e.message);
                                    stepFailed.LSSD = true;
                                } finally {
                                    // Note: we deliberately do NOT close the isolated client here.
                                    // Closing the context while the health check is creating a
                                    // page on the shared browser triggers harmless but noisy
                                    // stealth plugin errors. GC will handle cleanup.
                                }
                            })());
                        } else {
                            await finishCompletionStep(key, 'lssdCompletionReply', true, 'No LSSD request topic (not an LSSD case)');
                            await finishCompletionStep(key, 'lssdAutopsyReport', true, 'No LSSD request topic (not an LSSD case)');
                        }

                        // ── LSPD crosspost step (mirrors LSSD pattern) ──
                        // Replies to the LSPD certified copy topic created at detection time
                        // with the completed autopsy report.
                        const lspdTopicId = completedLspdTopicId;
                        if (lspdTopicId) {
                            await progress.addStep('LSPD Crosspost', 'pending');
                            stepPromises.push((async () => {
                                const stepName = 'lspdCrosspost';
                                await startCompletionStep(completedTopicId, stepName, 'Reply to LSPD #' + lspdTopicId);
                                try {
                                    // Ensure department passes the LSPD check in crosspostAutopsyToLspd
                                    const lspdReportData = {
                                        data: {
                                            ...(reportData?.data || {}),
                                            department: reportData?.data?.department || 'Los Santos Police Department',
                                            decedentName: reportData?.data?.decedentName || entry.name || '',
                                            decedentOOC: reportData?.data?.decedentOOC || entry.oocName || '',
                                        }
                                    };
                                    const lspdResult = await crosspostAutopsyToLspd(
                                        lspdReportData,
                                        bbCode,
                                        completedTopicId,
                                        state.dbRef,
                                        lspdTopicId,
                                        { caseTitle: completedCaseTitle }
                                    );
                                    const ok = lspdResult.ok && !lspdResult.skipped;
                                    await finishCompletionStep(completedTopicId, stepName, ok, ok ? 'Reply to LSPD #' + lspdTopicId : (lspdResult.error || 'Skipped'));
                                    await progress.addStep('LSPD Crosspost', ok ? 'ok' : 'fail', ok ? '#' + lspdTopicId : (lspdResult.error || 'Failed'));
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
                        await progress.addStep('DM Requester', 'pending');
                        stepPromises.push((async () => {
                            const dmClient = createIsolatedClient('dm');
                            try {
                                // Resolve DM target from the forum topic poster FIRST.
                                // `requesterName` is a character name from the form data (e.g.
                                // "Cristian Fuentes") which is NOT the forum username. Only
                                // use the topic poster's forum username for the PM.
                                let dmTarget = '';
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
                                const dmSubject = "Autopsy Request - " + (entry.title || "Completed");
                                console.log("[AUTO-COMPLETE] Sending DM to " + dmTarget + " (isolated client)");
                                const r = await dmClient.sendPM(dmTarget, dmSubject, bbCode);
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
                    footer: { text: 'PHMC Bot — Startup Scan' },
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
                footer: { text: 'PHMC Bot — Startup Scan' },
            });
            return;
        }

        let retried = 0;
        let stillFailed = 0;

        for (const { key, entry, stepName, stepData, caseLabel } of failedEntries) {
            console.log(`[AUTO-COMPLETE] Retrying ${stepName} for ${caseLabel}...`);

            try {
                const requesterName = entry.parsed?.requesterName || 'Requesting Party';
                const caseTitle = entry.caseUrl || entry.title || 'Autopsy Case';
                const completionBb = COMPLETION_TEMPLATE
                    .replace('CASE_TITLE', caseTitle)
                    .replace('REQUESTER_NAME', requesterName);

                let success = false;

                if (stepName === 'phmcCompletionReply') {
                    if (!entry.topicId) {
                        console.warn(`[AUTO-COMPLETE] Cannot retry ${stepName} for ${caseLabel}: no topicId`);
                        stillFailed++;
                        continue;
                    }
                    const r = await retryClient.replyToTopic(entry.topicId, AUTOPSY_REQUEST_FORUM_ID, completionBb, { dryRun: false });
                    success = r.ok;
                    if (success) console.log(`[AUTO-COMPLETE] [OK] Retry OK — ${stepName} for ${caseLabel} → reply to #${entry.topicId}`);
                    else console.warn(`[AUTO-COMPLETE] [ERR] Retry failed — ${stepName} for ${caseLabel}: ${r.reason || 'Unknown'}`);

                } else if (stepName === 'lssdCompletionReply' || stepName === 'lssdAutopsyReport') {
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
                    // Use topic poster FIRST (forum username), not requesterName
                    // which is a character name like "Cristian Fuentes" that won't work as a PM target.
                    let dmTarget = '';
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
                    if (!dmTarget || dmTarget === 'Requesting Party' || dmTarget === 'PHMC Forms Bot') {
                        console.log(`[AUTO-COMPLETE] ${stepName} for ${caseLabel}: no valid DM target`);
                        success = true;
                    } else if (dmTarget === 'CASELINK [Bot]') {
                        console.log(`[AUTO-COMPLETE] ${stepName} for ${caseLabel}: CASELINK [Bot] — DM skipped (they monitor LSSD forums)`);
                        success = true;
                    } else {
                        const dmSubject = 'Autopsy Request - ' + (entry.title || 'Completed');
                        const r = await retryClient.sendPM(dmTarget, dmSubject, bbCodeToSend);
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

                if (success) retried++;
                else stillFailed++;
            } catch (e) {
                console.error(`[AUTO-COMPLETE] Retry error for ${stepName} of ${caseLabel}: ${e.message}`);
                stillFailed++;
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
                footer: { text: 'PHMC Bot — Startup Scan' },
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
                footer: { text: 'PHMC Bot — Startup Scan' },
            });
        }

    } catch (err) {
        console.error('[AUTO-COMPLETE] Completion step retry scan error:', err.message);
        sendWebhook(null, {
            title: '[ERR] Autopsy Retry Scan Failed',
            description: `Error during retry scan: ${err.message}`,
            color: 0xdc3545,
            footer: { text: 'PHMC Bot — Startup Scan' },
        });
    }
}
