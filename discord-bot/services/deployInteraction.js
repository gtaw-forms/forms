/**
 * Deploy Interaction — interactive autopsy topic picker buttons.
 * Handles staff picking which case thread to reply to.
 */

import { getForumClient } from './forumClient.js';
import { logFnCall, sendWebhook, logStep } from './deployLogger.js';
import { state, C } from './deployState.js';
import { setDeployStatus, markReportComplete } from './deployStatus.js';
import { crosspostAutopsyToLssd } from './deployLssd.js';

const AUTOPSY_DRY_RUN = process.env.AUTOPSY_DRY_RUN !== 'false';
const COMPLETION_TEMPLATE = `[divbox=white][center][img]https://i.imgur.com/Hxjt4M2.png[/img][/center][/divbox]

[divbox=white][br][/br][center][b]Autopsy Request - Completed[/b]
[/center]
[br][/br]
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
            try {
                const ooc = (reportData.data?.decedentOOC || '').trim();
                console.log('[AUTO-COMPLETE] Parsed OOC name from report');
                if (ooc && state.dbRef) {
                    const arSnap = await state.dbRef.child('autopsy-requested').orderByChild('oocName').equalTo(ooc).once('value');
                    if (arSnap.exists()) {
                        arSnap.forEach((child) => {
                            const entry = child.val();
                            completedTopicId = child.key;
                            if (entry.completedAt) return;

                            console.log('[AUTO-COMPLETE] Marking autopsy request as completed in Firebase');
                            const requesterName = entry.parsed?.requesterName || 'Requesting Party';
                            const caseTitle = entry.caseUrl || entry.title || 'Autopsy Case';
                            const completionBb = COMPLETION_TEMPLATE
                                .replace('CASE_TITLE', caseTitle)
                                .replace('REQUESTER_NAME', requesterName);

                            child.ref.update({ completedAt: new Date().toISOString(), completedBbCode: bbCode });
                            console.log('[AUTO] Marked autopsy-requested #' + child.key + ' as completed');

                            // Reply with completion notice
                            console.log('[AUTO-COMPLETE] Sending completion reply to request topic #' + entry.topicId);
                            client.replyToTopic(entry.topicId, C.AUTOPSY_REQUEST_FORUM_ID, completionBb, { dryRun: false })
                                .then((r) => {
                                    if (r.ok) console.log('[AUTO] Completion reply posted to request #' + entry.topicId);
                                    else console.warn('[AUTO] Completion reply to request #' + entry.topicId + ' failed');
                                })
                                .catch((e) => console.warn('[AUTO] Completion reply error:', e.message));

                            // DM the requester via forum username
                            client.getTopicPoster(entry.topicId, { baseUrl: process.env.FORUM_BASE_URL })
                                .then((forumUser) => {
                                    const dmTarget = forumUser || requesterName;
                                    if (!dmTarget || dmTarget === 'Requesting Party') {
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
                        });
                    }
                }
            } catch (e) {
                console.warn('[AUTO] Completion marker error:', e.message);
            }

            // LSSD cross-post
            console.log('[AUTO-COMPLETE] LSSD cross-post triggered');
            crosspostAutopsyToLssd(reportData, bbCode, completedTopicId, db).catch(() => {});
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
