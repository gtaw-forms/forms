/**
 * Deploy Interaction — interactive autopsy topic picker buttons.
 * Handles staff picking which case thread to reply to.
 */

import { getForumClient } from './forumClient.js';
import { logFnCall, sendWebhook, logStep } from './deployLogger.js';
import { state, C } from './deployState.js';
import { setDeployStatus, markReportComplete } from './deployStatus.js';
import { crosspostAutopsyToLssd } from './deployLssd.js';
import { crosspostAutopsyToLspd } from './deployLspd.js';
import { clearAssignment } from './autopsyRotation.js';
import { buildCompletionBb } from './completionTemplate.js';

const AUTOPSY_DRY_RUN = process.env.AUTOPSY_DRY_RUN !== 'false';

export async function resolveAutopsyTopic(interaction) {
    logFnCall('deployInteraction', 'resolveAutopsyTopic', 'Resolving autopsy topic pick');
    const customId = interaction.customId;

    const parts = customId.split('_');
    const cancelIdx = parts.indexOf('cancel');

    if (cancelIdx > 0) {
        const pickId = parts.slice(0, cancelIdx).join('_');
        const pending = state.pendingAutopsyPicks.get(pickId);
        if (pending) {
            state.pendingAutopsyPicks.delete(pickId);
            await interaction.update({ content: 'Cancelled — no topic selected. Re-save the report to try again.', embeds: [], components: [] });
        } else {
            await interaction.update({ content: 'This selection has expired.', flags: 64 });
        }
        return;
    }

    const topicIdStr = parts.pop();
    const pickId = parts.join('_');
    const pending = state.pendingAutopsyPicks.get(pickId);

    if (!pending) {
        await interaction.update({ content: 'This selection has expired (5 min timeout). Re-save the report to try again.', embeds: [], components: [] });
        return;
    }

    const topicId = parseInt(topicIdStr, 10);
    const topic = pending.topics.find(t => t.topicId === topicId);
    if (!topic) {
        await interaction.update({ content: 'Topic #' + topicId + ' not found in results.', flags: 64 });
        return;
    }

    state.pendingAutopsyPicks.delete(pickId);
    console.log('[AUTO] Staff picked topic #' + topicId + ' "' + topic.title + '"');

    await interaction.update({ content: 'Picked **#' + topicId + '** — proceeding with reply...', embeds: [], components: [] });

    const { db, authorId, key, reportData, bbCode, lssd, phmcTopicId } = pending;
    const client = getForumClient();

    // LSSD cross-post pick
    if (lssd) {
        await client.login(process.env.FORUM_LSSD_USERNAME, process.env.FORUM_LSSD_PASSWORD, { force: true, baseUrl: 'https://lssd.gta.world' });
        await interaction.editReply({ content: 'Posting to LSSD thread #' + topicId + '...' });
        const r = await client.replyToTopic(topicId, 2263, bbCode, { dryRun: false, baseUrl: 'https://lssd.gta.world' });
        const status = r.ok ? 'completed' : 'failed';
        if (db && phmcTopicId) {
            try {
                const fbUpdate = {
                    lssdCrosspostStatus: status,
                    lssdCrosspostUpdatedAt: new Date().toISOString(),
                    ...(r.ok ? { lssdTopicId: topicId, lssdCrosspostedAt: new Date().toISOString() } : {}),
                    ...(!r.ok ? { lssdCrosspostError: (r.reason || 'Unknown') } : {}),
                };
                await db.ref('autopsy-requested/' + phmcTopicId).update(fbUpdate);
            } catch (err) {
                console.warn('[AUTO-CROSSPOST] Failed to write status:', err.message);
            }
        }
        if (r.ok) {
            await interaction.editReply({ content: 'Cross-posted to LSSD thread #' + topicId + '\n' + (r.url || '') });
        } else {
            await interaction.editReply({ content: 'Failed: ' + (r.reason || 'Unknown') });
        }
        return;
    }

    // Autopsy reply pick
    const DRY = AUTOPSY_DRY_RUN;
    await client.login(null, null, { force: false, baseUrl: process.env.FORUM_BASE_URL });
    await setDeployStatus(db, authorId, key, 'replying', 'Staff picked case #' + topicId + '. ' + (DRY ? 'Filling form (dry run)' : 'Posting reply...'));
    await sendWebhook(null, {
        title: ' Autopsy — Case Selected',
        description: '**Report:** ' + (reportData.originalKey || key) + '\n**Case:** #' + topicId + ' ' + topic.title + '\n' + (DRY ? ' Dry run' : ' Submitting...'),
        color: DRY ? 0xffc107 : 0x28a745,
    });

    const result = await client.replyToTopic(topicId, C.CASE_MGMT_FORUM_ID, bbCode, { dryRun: DRY });

    if (result.ok && !result.dryRun) {
        const label = reportData.originalKey || key;
        const completed = await markReportComplete(db, authorId, key, label, 'autopsy-reply', result.url);
        if (completed) {
            await logStep(' Autopsy Posted', '[View Reply](' + result.url + ')', { color: 0x28a745, isFinal: true });

            // Mark as completed in autopsy-requested
            let completedTopicId = null;
            let completedLssdTopicId = null;
            let completedLspdTopicId = null;
            let completionCaseTitle = null;
            let completionCaseTopicId = null;
            try {
                const ooc = (reportData.data?.decedentOOC || '').trim();
                const name = (reportData.data?.decedentName || '').trim();
                console.log('[AUTO-COMPLETE] Parsed OOC name from report');

                if (state.dbRef) {
                    // STRONGEST match: the case topic we just replied to (unique).
                    // Also covers multi-decedent records whose caseTopicId lives at
                    // cases/<idx> — the old top-level oocName-only lookup missed them
                    // and left multi cases never-completed/never-crossposted.
                    const topicKey = String(topicId);
                    const allReqSnap = await state.dbRef.child('autopsy-requested').once('value');
                    const allReq = allReqSnap.val() || {};
                    let matched = null; // { key, entry, ci, caseRec }
                    outer:
                    for (const [key, entry] of Object.entries(allReq)) {
                        if (String(entry.caseState || '') === 'multi' && entry.cases && typeof entry.cases === 'object') {
                            for (const [ci, c] of Object.entries(entry.cases)) {
                                if (String(c.caseTopicId) === topicKey) {
                                    matched = { key, entry, ci: parseInt(ci, 10), caseRec: c };
                                    break outer;
                                }
                            }
                        } else if (String(entry.caseTopicId) === topicKey) {
                            matched = { key, entry, ci: null, caseRec: null };
                            break outer;
                        }
                    }

                    // Fallback: match by OOC name (top-level, then multi per-case).
                    if (!matched && ooc) {
                        const byOoc = await state.dbRef.child('autopsy-requested').orderByChild('oocName').equalTo(ooc).once('value');
                        if (byOoc.exists()) {
                            byOoc.forEach((child) => {
                                if (matched) return;
                                const entry = child.val();
                                if (String(entry.caseState || '') === 'multi') return; // handled below
                                matched = { key: child.key, entry, ci: null, caseRec: null };
                            });
                        }
                        if (!matched) {
                            const oocL = ooc.toLowerCase();
                            for (const [key, entry] of Object.entries(allReq)) {
                                if (String(entry.caseState || '') !== 'multi' || !entry.cases || typeof entry.cases !== 'object') continue;
                                for (const [ci, c] of Object.entries(entry.cases)) {
                                    if (String(c.oocName || '').trim().toLowerCase() === oocL) {
                                        matched = { key, entry, ci: parseInt(ci, 10), caseRec: c };
                                        break;
                                    }
                                }
                                if (matched) break;
                            }
                        }
                    }

                    if (matched) {
                        const { key, entry, ci, caseRec } = matched;
                        const alreadyDone = caseRec ? !!caseRec.completedAt : !!entry.completedAt;
                        if (alreadyDone) {
                            console.log('[AUTO-COMPLETE] #' + key + (caseRec ? ' case ' + ci : '') + ' already completed — skipping');
                        } else {
                            completedTopicId = key;
                            completedLssdTopicId = entry.lssdRequestTopicId || caseRec?.lssdRequestTopicId || null;
                            completedLspdTopicId = entry.lspdTopicId || caseRec?.lspdTopicId || null;
                            completionCaseTitle = ((caseRec?.caseTitle || entry.caseUrl || entry.title || 'Autopsy Case')).replace(/\s*[-–—]\s*UNASSIGNED\s*$/i, '');
                            completionCaseTopicId = caseRec?.caseTopicId || entry.caseTopicId || null;

                            // Private cases have no public request topic and never crosspost.
                            // Mark them completed but skip the public reply + crossposts.
                            if (entry.isPrivate === true) {
                                console.log('[AUTO-COMPLETE] Private case #' + key + ' — marking completed, skipping public reply + crossposts');
                                if (caseRec) {
                                    await state.dbRef.child(`autopsy-requested/${key}/cases/${ci}`).update({ completedAt: new Date().toISOString(), completedBbCode: bbCode });
                                    const casesSnap = await state.dbRef.child(`autopsy-requested/${key}/cases`).once('value');
                                    const allDone = Object.values(casesSnap.val() || {}).every(c => c.completedAt);
                                    if (allDone) await state.dbRef.child(`autopsy-requested/${key}`).update({ completedAt: new Date().toISOString(), completedBbCode: bbCode });
                                } else {
                                    await state.dbRef.child(`autopsy-requested/${key}`).update({ completedAt: new Date().toISOString(), completedBbCode: bbCode });
                                }
                                const completingMe = caseRec?.assignedTo || entry.assignedTo;
                                if (completingMe) clearAssignment(db, completingMe, key).catch(err => console.warn(`[AUTO-COMPLETE] rotation tracking error: ${err.message}`));
                                console.log('[AUTO] Marked private autopsy-requested #' + key + ' as completed');
                            } else {
                                console.log('[AUTO-COMPLETE] Marking autopsy request as completed in Firebase');
                                const requesterName = entry.parsed?.requesterName || 'Requesting Party';
                                const completionFaction = entry.isPrivate === true
                                    ? 'private'
                                    : (String(entry.faction || '').toLowerCase()
                                        || (/\[(lssd|lspd)\]/i.exec(entry.title || '') || [])[1]?.toLowerCase()
                                        || null);
                                const completionLspdUrl = completedLspdTopicId
                                    ? `https://lspd.gta.world/viewtopic.php?t=${completedLspdTopicId}`
                                    : null;
                                const completionBb = buildCompletionBb(completionCaseTitle, requesterName, { faction: completionFaction, lspdUrl: completionLspdUrl });

                                const isMulti = caseRec != null;
                                let allCasesDone = true;
                                if (isMulti) {
                                    // Per-case completion — the request stays open until
                                    // every decedent's case has completed.
                                    await state.dbRef.child(`autopsy-requested/${key}/cases/${ci}`).update({ completedAt: new Date().toISOString(), completedBbCode: bbCode });
                                    const casesSnap = await state.dbRef.child(`autopsy-requested/${key}/cases`).once('value');
                                    allCasesDone = Object.values(casesSnap.val() || {}).every(c => c.completedAt);
                                    if (allCasesDone) await state.dbRef.child(`autopsy-requested/${key}`).update({ completedAt: new Date().toISOString(), completedBbCode: bbCode });
                                } else {
                                    await state.dbRef.child(`autopsy-requested/${key}`).update({ completedAt: new Date().toISOString(), completedBbCode: bbCode });
                                }
                                console.log('[AUTO] Marked autopsy-requested #' + key + ' as completed');

                                // Decrement the ME's active case count in the rotation tracker
                                const completingMe = caseRec?.assignedTo || entry.assignedTo;
                                if (completingMe) {
                                    clearAssignment(db, completingMe, key).catch(err => console.warn(`[AUTO-COMPLETE] rotation tracking error: ${err.message}`));
                                }

                                // Reply with completion notice — deferred for multi until EVERY
                                // decedent's case is done so the requester never sees a premature
                                // "We have completed the autopsy investigation" for an open request.
                                const requestTopicId = entry.topicId || caseRec?.topicId || null;
                                if (requestTopicId && (!isMulti || allCasesDone)) {
                                    console.log('[AUTO-COMPLETE] Sending completion reply to request topic #' + requestTopicId);
                                    client.replyToTopic(requestTopicId, C.AUTOPSY_REQUEST_FORUM_ID, completionBb, { dryRun: false })
                                        .then((r) => {
                                            if (r.ok) console.log('[AUTO] Completion reply posted to request #' + requestTopicId);
                                            else console.warn('[AUTO] Completion reply to request #' + requestTopicId + ' failed');
                                        })
                                        .catch((e) => console.warn('[AUTO] Completion reply error:', e.message));
                                } else if (requestTopicId) {
                                    console.log('[AUTO-COMPLETE] Deferring completion reply to request #' + requestTopicId + ' until all decedents complete');
                                }

                                // DM the requester via forum username (deferred for multi
                                // until every decedent's case is done)
                                if (!isMulti || allCasesDone) {
                                    client.getTopicPoster(entry.topicId, { baseUrl: process.env.FORUM_BASE_URL })
                                        .then((forumUser) => {
                                            let dmTarget = requesterName || '';
                                            if (!dmTarget || dmTarget === 'Requesting Party' || dmTarget.toLowerCase().includes('bot')) {
                                                dmTarget = forumUser || '';
                                            }
                                            if (!dmTarget || dmTarget === 'Requesting Party' || dmTarget.toLowerCase().includes('bot')) {
                                                console.log('[AUTO-COMPLETE] No valid DM target — skipping DM');
                                                return;
                                            }
                                            const dmSubject = entry.title || 'Autopsy Request - Completed';
                                            console.log('[AUTO-COMPLETE] Sending DM to ' + dmTarget);
                                            client.sendPM(dmTarget, dmSubject, bbCode)
                                                .then((r) => {
                                                    if (r.ok) console.log('[AUTO] DM sent to ' + dmTarget);
                                                    else console.warn('[AUTO] DM to ' + dmTarget + ' failed');
                                                })
                                                .catch((e) => console.warn('[AUTO] DM error:', e.message));
                                        })
                                        .catch((e) => console.warn('[AUTO] Topic poster lookup error:', e.message));
                                } else {
                                    console.log('[AUTO-COMPLETE] Deferring DM until all decedents complete');
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('[AUTO] Completion marker error:', e.message);
            }

            // LSSD cross-post
            if (completedTopicId) {
                console.log('[AUTO-COMPLETE] LSSD cross-post triggered');
                crosspostAutopsyToLssd(reportData, bbCode, completedTopicId, db, completedLssdTopicId).catch(() => {});
            }
            // LSPD cross-post (was missing — posts the completed report to the
            // LSPD certified-copy topic created at detection time).
            if (completedTopicId) {
                console.log('[AUTO-COMPLETE] LSPD cross-post triggered');
                crosspostAutopsyToLspd(reportData, bbCode, completedTopicId, db, completedLspdTopicId, {
                    caseTitle: completionCaseTitle || reportData.originalKey || 'Autopsy Case',
                    caseTopicId: completionCaseTopicId || topicId,
                }).catch(() => {});
            }
        } else {
            await logStep(' Autopsy Posted But Status Update Failed', 'Reply was posted at [View Reply](<' + result.url + '>) but the Firebase status update did not verify.', { color: 0xffc107, isFinal: true });
        }
    } else if (result.dryRun) {
        await setDeployStatus(db, authorId, key, 'dry_run', 'Form filled for case #' + topicId + ' but NOT submitted. Set AUTOPSY_DRY_RUN=false to enable.');
        console.log('[AUTO] Dry run — form filled for case #' + topicId);
        await logStep(' Dry Run Complete', '**#' + topicId + ':** ' + (topic.title || '') + '\nForm filled but **not submitted**.', { color: 0xffc107, isFinal: true });
    } else {
        await setDeployStatus(db, authorId, key, 'reply_failed', result.reason || 'Unknown error replying to case thread');
        console.error('[AUTO] Failed to reply to case #' + topicId + ': ' + (result.reason || 'Unknown'));
        await logStep(' Reply Failed', '**Case #' + topicId + ':** ' + (result.reason || 'Unknown error'), { color: 0xdc3545, isFinal: true });
    }
}
