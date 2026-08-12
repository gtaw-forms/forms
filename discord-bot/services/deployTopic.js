/**
 * deployTopic.js — Forum Topic Handler
 *
 * Posts death records, mass-fatality, and coroner reports as new forum topics.
 * Triggers auto-coroner-email when a report was requested.
 */

import { getForumClient } from './forumClient.js';
import { logFnCall, DeployProgressEmbed, notifyDeployFailure } from './deployLogger.js';
import { state } from './deployState.js';
import { markDeployed, markReportComplete, setDeployStatus } from './deployStatus.js';

/**
 * Post a report as a forum topic (death_record, mass-fatality, coroner-report).
 */
export async function handleTopic(report) {
    const { authorId, key, report: reportData, db } = report;

    const progress = new DeployProgressEmbed(state.discordClient, process.env.BOT_LOG_CHANNEL_ID);
    if (report._progressMessageId) {
        await progress.resume(report._progressMessageId, report._progressChannelId || process.env.BOT_LOG_CHANNEL_ID, `Topic — ${reportData.originalKey || key}`);
    } else {
        await progress.start(`Topic — ${reportData.originalKey || key}`);
    }

    const bbSnap = await db.ref(`scheduledReportsBBCode/${authorId}/${key}`).once('value');
    const bbCode = bbSnap.val()?.bbCode;
    if (!bbCode) {
        console.log(`[AUTO]  ${key}  no BBCode, marking as deployed`);
        await progress.addStep('No BBCode', 'skip', 'No BBCode content found');
        await progress.finalize('complete');
        await markDeployed(db, authorId, key, true, { deployNote: 'No BBCode' });
        return;
    }

    // Resolve forum from the mapping
    const forumInfo = getForumClient().constructor.FORUM_MAP[reportData.formId];
    if (!forumInfo) {
        console.log(`[AUTO]  ${key}  no forum mapping for ${reportData.formId}`);
        await progress.addStep('No Forum Mapping', 'fail', `Form ID: ${reportData.formId}`);
        await progress.finalize('failed');
        return;
    }

    const DRY_POST = process.env.DRY_POST !== 'false';
    const forumLabel = forumInfo.name || 'Forum';

    if (DRY_POST) {
        const simUrl = `${forumInfo.url}&dry_run=SIM_${Date.now()}`;
        const label = reportData.originalKey || key;
        await progress.addStep('Dry Run', 'ok', forumLabel);
        await progress.finalize('complete');
        await markReportComplete(db, authorId, key, label, 'topic_simulated', simUrl);
        console.log(`[AUTO]  ${key}  Simulated topic post to ${forumInfo.name} (DRY_POST)`);
        return;
    }

    await progress.addStep('Login', 'pending');
    console.log(`[AUTO]  Posting topic to ${forumInfo.name} (f=${forumInfo.forumId})...`);
    const client = getForumClient();
    await client.login(null, null, { force: false, baseUrl: process.env.FORUM_BASE_URL });
    await progress.addStep('Login', 'ok');

    await progress.addStep('Posting Topic', 'pending', forumLabel);
    const result = await client.postTopic(forumInfo.forumId, reportData.originalKey || key, bbCode, forumInfo.url);
    if (!result.ok) {
        const reason = result.reason || 'Unknown error posting topic';
        console.error(`[AUTO]  ${key}  Topic post failed: ${reason}`);
        await setDeployStatus(db, authorId, key, 'reply_failed', reason);
        await progress.addStep('Posting Topic', 'fail', reason);
        await progress.finalize('failed');
        await notifyDeployFailure(reportData.originalKey || key, 'topic', key, reason);
        return;
    }
    if (result.ok) {
        const label = reportData.originalKey || key;
        await progress.addStep('Posting Topic', 'ok', result.url || forumLabel);
        await progress.finalize('complete');
        await markReportComplete(db, authorId, key, label, 'topic', result.url);
        console.log(`[AUTO]  ${key}  Topic posted: ${result.url}`);

        // After topic is posted, trigger coroner email if report was requested
        const isRequested = reportData.formId === 'coroner-report'
            ? reportData.data?.ReportRequested === true || reportData.data?.ReportRequested === 'true'
            : reportData.formId === 'mass-ftality-test' && !!reportData.data?.requestingOfficer;
        if (isRequested) {
            console.log('[AUTO]  Report requested — triggering auto coroner email');
            import('./deployCoronerEmail.js').then(({ handleCoronerEmail }) => {
                handleCoronerEmail({ authorId, key, report: reportData, db }).catch(err => {
                    console.error('[CORONER-EMAIL] Handler error:', err.message);
                });
            }).catch(err => {
                console.error('[CORONER-EMAIL] Failed to import handler:', err.message);
            });
        }
    }
}
