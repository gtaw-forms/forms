/**
 * deployPM.js — Forum PM Handler
 *
 * Sends reports (coroner emails, requested reports) as forum private messages.
 * Routes to LSPD/LSSD/SADCR/DAO based on department metadata.
 */

import { getForumClient } from './forumClient.js';
import { logFnCall, DeployProgressEmbed, notifyDeployFailure } from './deployLogger.js';
import { state } from './deployState.js';
import { markDeployed, markReportComplete } from './deployStatus.js';
import { requeueReport } from './deployRetry.js';
 
/**
 * Send a report as a forum PM.
 * Determines the target forum based on report metadata.
 */
export async function handlePM(report) {
    const { authorId, key, report: reportData, db } = report;
    const recipient = (reportData.data?.requestingOfficer
        || reportData.data?.requesting_officer
        || reportData.data?.officerName
        || reportData.data?.recipient
        || '').trim() || null;

    // ── Progress embed ──
    const progress = new DeployProgressEmbed(state.discordClient, process.env.BOT_LOG_CHANNEL_ID);
    if (report._progressMessageId) {
        await progress.resume(report._progressMessageId, report._progressChannelId || process.env.BOT_LOG_CHANNEL_ID, `PM — ${reportData.originalKey || key}`);
    } else {
        await progress.start(`PM — ${reportData.originalKey || key}`);
    }

    if (!recipient) {
        console.log(`[AUTO]  ${key}  no recipient, marking as deployed`);
        await progress.addStep('No Recipient', 'skip', 'No recipient specified');
        await progress.finalize('complete');
        await markDeployed(db, authorId, key, true, { deployNote: 'No recipient' });
        return;
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

    // Determine forum from the report data
    const rawDept = reportData.data?.department || '';
    const deptStr = (typeof rawDept === 'object' ? (rawDept.label || rawDept.value || '') : String(rawDept)).toLowerCase();
    console.log(`[AUTO]  Resolving forum  raw department value: "${rawDept}"  parsed: "${deptStr}"`);

    const isDao = deptStr.includes('dao') || deptStr.includes('atlantic') || deptStr.includes('district attorney');
    const isSadcr = !isDao && (deptStr.includes('sadcr') || deptStr.includes('corrections'));
    const isLssd = !isDao && !isSadcr && (deptStr.includes('lssd') || deptStr.includes('sheriff') || deptStr.includes('lasd'));

    let forumUrl, username, password, forumLabel;
    if (isDao) {
        forumUrl = process.env.FORUM_DAO_URL || 'https://lsda.gta.world';
        username = process.env.FORUM_DAO_USERNAME;
        password = process.env.FORUM_DAO_PASSWORD;
        forumLabel = 'DAO';
    } else if (isSadcr) {
        forumUrl = process.env.FORUM_SADCR_URL || 'http://sadcr.gta.world';
        username = process.env.FORUM_SADCR_USERNAME;
        password = process.env.FORUM_SADCR_PASSWORD;
        forumLabel = 'SADCR';
    } else if (isLssd) {
        forumUrl = process.env.FORUM_LSSD_URL || 'http://lssd.gta.world';
        username = process.env.FORUM_LSSD_USERNAME;
        password = process.env.FORUM_LSSD_PASSWORD;
        forumLabel = 'LSSD';
    } else {
        forumUrl = process.env.FORUM_LSPD_URL || 'http://lspd.gta.world';
        username = process.env.FORUM_LSPD_USERNAME;
        password = process.env.FORUM_LSPD_PASSWORD;
        forumLabel = 'LSPD';
    }

    // Skip if credentials aren't configured for this forum
    if (!username || !password) {
        console.log(`[AUTO]  ${key}  no credentials for ${forumUrl}, leaving for manual deploy`);
        await progress.addStep('No Credentials', 'skip', `${forumLabel} credentials not configured`);
        await progress.finalize('complete');
        return;
    }

    await progress.addStep(`Logging in (${forumLabel})`, 'pending');
    console.log(`[AUTO]  Sending PM to ${recipient} via ${forumUrl}...`);
    const client = getForumClient();
    await client.login(username, password, { force: true, baseUrl: forumUrl });
    await progress.addStep(`Logging in (${forumLabel})`, 'ok');

    await progress.addStep('Sending PM', 'pending', `To: ${recipient}`);
    const result = await client.sendPM(recipient, reportData.originalKey || key, bbCode, { baseUrl: forumUrl });
    if (result.ok) {
        const label = reportData.originalKey || key;
        await progress.addStep('Sending PM', 'ok', result.url || recipient);
        await progress.finalize('complete');
        await markReportComplete(db, authorId, key, label, 'pm', result.url);
        console.log(`[AUTO]  ${key}  PM sent to ${recipient}`);
    } else {
        const reason = result.reason || 'Unknown error sending PM';
        console.log(`[AUTO]  ${key}  PM send returned failure`);
        await notifyDeployFailure(reportData.originalKey || key, 'pm', key, reason);
        await requeueReport(db, authorId, key, 'PM send failed: ' + reason).catch(err =>
            console.warn(`[AUTO]  ${key}  Failed to requeue PM: ${err.message}`)
        );
        await progress.addStep('Sending PM', 'fail', reason);
        await progress.addStep('Retry Scheduled', 'warn', 'Will auto-retry on next cycle');
        await progress.finalize('failed');
    }
}
