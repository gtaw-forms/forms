/**
 * Deploy Executor — sequential deploy orchestrator with timeout guard.
 * Runs one deploy at a time. Handles errors, retries, and forum routing.
 */

import { getForumClient } from './forumClient.js';
import { logFnCall, sendWebhook } from './deployLogger.js';
import { state, C } from './deployState.js';
import { requeueReport } from './deployRetry.js';

// Lazy import handlers to avoid circular deps (handlers import deployQueue, which imports us)
let _handlers = null;
async function getHandlers() {
    if (!_handlers) _handlers = await import('./autoDeploy.js');
    return _handlers;
}

export async function runDeploy(type, data) {
    logFnCall('deployExecutor', 'runDeploy', 'Running deploy', { type, key: data.key });

    if (state.processing) {
        setTimeout(() => runDeploy(type, data), 5000);
        return;
    }
    state.processing = true;

    // Validate PHMC session before any deploy — force re-login if expired
    try {
        const client = getForumClient();
        await client.ensureLoggedIn();
    } catch (sessionErr) {
        console.warn(`[AUTO] Session check failed, continuing anyway: ${sessionErr.message}`);
    }

    const label = data.report?.originalKey || data.key;
    const d = data.report?.data || {};

    // Determine forum label based on deploy type
    let forumLabel;
    if (type === 'topic' || type === 'medical-record' || type === 'patient_notes') {
        const fInfo = getForumClient().constructor.FORUM_MAP[data.report?.formId];
        forumLabel = fInfo?.name || 'PHMC Forum';
    } else if (type === 'autopsy-reply') {
        forumLabel = 'Case Management';
    } else {
        const rawDept = d.department || '';
        const deptStr = (typeof rawDept === 'object' ? (rawDept.label || rawDept.value || '') : String(rawDept)).toLowerCase();
        if (deptStr.includes('sadcr')) forumLabel = 'SADCR';
        else if (deptStr.includes('lssd') || deptStr.includes('sheriff')) forumLabel = 'LSSD';
        else forumLabel = 'LSPD';
        console.log(`[AUTO] PM forum resolved: "${forumLabel}" from department "${rawDept}"`);
    }
    state.currentProcessing = { label, type, forum: forumLabel };

    let deployDetail = '\n**Sending to:** ' + forumLabel;
    if (type === 'pm') {
        const recipient = d.requestingOfficer || d.requesting_officer || d.officerName || d.recipient || 'Unknown';
        deployDetail += '\n**Recipient:** ' + recipient;
    } else if (type === 'topic') {
        const fInfo = getForumClient().constructor.FORUM_MAP[data.report?.formId];
        if (fInfo) deployDetail += '\n**Forum:** ' + fInfo.name;
    } else if (type === 'autopsy-reply') {
        deployDetail += '\n**Forum:** Case Management (reply)';
    }

    console.log('[AUTO] Deploying ' + label + ' (' + data.key + ') to ' + forumLabel + '...');
    await sendWebhook(null, {
        title: ' Deploying Report',
        description: '**' + label + '**\n`' + data.key + '`' + deployDetail,
        color: 0x007bff,
        footer: { text: 'PHMC Bot — Auto Deploy' },
        timestamp: new Date().toISOString(),
    });

    try {
        // Timeout guard: warn at 3 min, abort at 10 min
        const slowWarning = setTimeout(() => {
            console.warn('[AUTO] ' + data.key + ' deploy taking longer than usual (>3 min)');
            sendWebhook(null, {
                title: ' Forum Slow to Respond',
                description: '**Key:** `' + data.key + '`\n**Type:** ' + type + '\n**Report:** ' + label,
                color: 0xffc107,
                footer: { text: 'PHMC Bot — Auto Deploy' },
                timestamp: new Date().toISOString(),
            });
        }, 3 * 60 * 1000);

        const timeout = setTimeout(() => {
            clearTimeout(slowWarning);
            console.error('[AUTO] ' + data.key + ' deploy timed out after 10 minutes');
            sendWebhook(null, {
                title: ' Forum Unresponsive',
                description: '**Key:** `' + data.key + '`\n**Type:** ' + type + '\n**Report:** ' + label,
                color: 0xdc3545,
                footer: { text: 'PHMC Bot — Auto Deploy' },
                timestamp: new Date().toISOString(),
            });
            state.processing = false;
        }, 10 * 60 * 1000);

        try {
            const h = await getHandlers();
            if (type === 'pm') await h.handlePM(data);
            else if (type === 'topic') await h.handleTopic(data);
            else if (type === 'patient_notes' || type === 'medical-record') await h.handleMedicalRecord(data);
            else if (type === 'autopsy-reply') await h.handleAutopsyReply(data);
        } finally {
            clearTimeout(slowWarning);
            clearTimeout(timeout);
        }
    } catch (err) {
        console.error('[AUTO] ' + data.key + ' Failed:', err.message);
        console.error('[AUTO] Stack:', err.stack);

        const retries = (data.report?.deployRetries || 0) + 1;

        try {
            if (retries >= C.MAX_RETRIES) {
                console.error('[AUTO] ' + data.key + ' failed ' + retries + '/' + C.MAX_RETRIES + ' times, giving up permanently');
                await data.db.ref('scheduledReports/' + data.authorId + '/' + data.key).update({
                    hasdeployed: false,
                    deployStatus: 'failed_permanent',
                    deployMessage: 'Gave up after ' + retries + ' attempts. Last error: ' + err.message.slice(0, 200),
                    deployRetries: retries,
                    deployLastFailedAt: new Date().toISOString(),
                });
                await data.db.ref('retry-queue/' + data.authorId + '|' + data.key).remove().catch(() => {});
            } else {
                const retryTime = Date.now() + C.RETRY_DELAY_MS;
                await requeueReport(data.db, data.authorId, data.key, {
                    ...data.report,
                    deployRetries: retries,
                });
                await sendWebhook(null, {
                    title: ' Report Re-queued for Retry',
                    description: '**' + label + '**\n`' + data.key + '`\n**Error:** ' + err.message.slice(0, 300) + '\n\nRetry scheduled **' + new Date(retryTime).toLocaleString() + '** (attempt ' + retries + '/' + C.MAX_RETRIES + ')',
                    color: 0xffc107,
                    footer: { text: 'PHMC Bot — Auto Deploy' },
                    timestamp: new Date().toISOString(),
                });
            }
        } catch (retryErr) {
            console.error('[AUTO] Retry error:', retryErr.message);
        }
    } finally {
        state.processing = false;
        state.currentProcessing = null;
    }
}
