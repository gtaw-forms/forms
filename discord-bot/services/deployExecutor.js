/**
 * Deploy Executor — sequential deploy orchestrator with timeout guard.
 * Runs one deploy at a time. Handles errors, retries, and forum routing.
 */

import { getForumClient } from './forumClient.js';
import { logFnCall, sendWebhook, notifyDeployFailure } from './deployLogger.js';
import { state, C } from './deployState.js';
import { requeueReport } from './deployRetry.js';
import { checkUserConsent, skipDueToConsent } from './deployConsent.js';

// Lazy import handlers from the dedicated handler modules
let _handlers = null;
async function getHandlers() {
    if (!_handlers) {
        const [pm, topic, med, autopsy] = await Promise.all([
            import('./deployPM.js'),
            import('./deployTopic.js'),
            import('./deployMedicalRecord.js'),
            import('./deployAutopsyReply.js'),
        ]);
        _handlers = {
            handlePM: pm.handlePM,
            handleTopic: topic.handleTopic,
            handleMedicalRecord: med.handleMedicalRecord,
            handleAutopsyReply: autopsy.handleAutopsyReply,
        };
    }
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

    // ── Consent re-check ──
    // User may have opted out since the report was queued (or never set preferences).
    // If consent was revoked, skip the deploy and mark it in Firebase.
    const formId = data.report?.formId;
    if (formId) {
        const consented = await checkUserConsent(data.db, data.authorId, formId);
        if (!consented) {
            console.log(`[AUTO] ${label} skipped — user has not consented to ${formId}`);

            // Update progress embed if one exists
            if (data._progressMessageId && state.discordClient) {
                try {
                    const channel = await state.discordClient.channels.fetch(data._progressChannelId);
                    const msg = await channel.messages.fetch(data._progressMessageId);
                    await msg.edit({ content: `[SKIPPED] ${label} — user revoked consent for ${formId}`, embeds: [], components: [] });
                } catch { /* progress embed is optional */ }
            }

            await skipDueToConsent(data.db, data.authorId, data.key, formId, label);
            state.processing = false;
            return;
        }
    }

    const d = data.report?.data || {};

    // ── 🛑 CRITICAL GATE: empty employee identity (emergency handbrake) ──
    // A report with an empty coronerEmployee / phmcEmployee must NEVER be
    // deployed — it ships blanks to the forum (Sarah Bell / Xavier Bogdanovic
    // incident, 2026-08-11). Hard-stop here, mark the report, notify the
    // developer, and do NOT retry — the data must be fixed first.
    const EMPLOYEE_FIELD_BY_FORM = {
        'coroner-report': 'coronerEmployee',
        'coroner_email': 'coronerEmployee',
        'death_record': 'coronerEmployee',
        'mass-ftality-test': 'coronerEmployee',
        'autopsy': 'coronerEmployee',
        'patient_notes': 'phmcEmployee',
        'er_protocol': 'phmcEmployee',
        'physical_evaluation': 'phmcEmployee',
        'staff-patient-file': 'phmcEmployee',
        'surgical': 'phmcEmployee',
        'session_notes': 'phmcEmployee',
        'intensive_treatment': 'phmcEmployee',
        'psych-eval': 'phmcEmployee',
        'general_consultation': 'phmcEmployee',
        'testing-compact-mode': 'phmcEmployee', // legacy rename alias
    };
    const expectedField = EMPLOYEE_FIELD_BY_FORM[formId] || null;
    let employeeMissing = false;
    if (expectedField) {
        const val = d[expectedField];
        employeeMissing = !val || !String(val).trim();
    } else if (type === 'topic' || type === 'pm') {
        // Unknown form id on a PHMC deploy: block only if BOTH employee
        // fields are missing/empty (never false-positive a legit form).
        const cVal = d.coronerEmployee;
        const pVal = d.phmcEmployee;
        employeeMissing = (!cVal || !String(cVal).trim()) && (!pVal || !String(pVal).trim());
    }

    if (employeeMissing) {
        const missingField = expectedField || 'coronerEmployee/phmcEmployee';
        console.error(`[AUTO] 🛑 BLOCKED ${label} — ${missingField} is empty. Not deploying.`);
        try {
            await data.db.ref(`scheduledReports/${data.authorId}/${data.key}`).update({
                hasdeployed: false,
                deployStatus: 'blocked_empty_employee',
                deployMessage: `BLOCKED: ${missingField} is empty. Fix the report data (re-save in the app or run tools/fix-empty-coroner.mjs), then set hasdeployed:false + deployStatus:"pending" and restart the bot.`,
                deployCheckedAt: new Date().toISOString(),
            });
            await data.db.ref(`retry-queue/${data.authorId}|${data.key}`).remove().catch(() => {});
        } catch (statusErr) {
            console.error('[AUTO] Failed to mark blocked status:', statusErr.message);
        }

        await sendWebhook(null, {
            title: '🛑 DEPLOY BLOCKED — Empty Employee Identity',
            description: [
                '**Report:** ' + label,
                '**Key:** `' + data.key + '`',
                '**Type:** ' + type,
                '**Form:** ' + (formId || 'unknown'),
                '**Missing field:** `' + missingField + '`',
                '',
                '🛠 <@228306972204597248> — fix the report data first (re-save in the app, or `node tools/fix-empty-coroner.mjs --include-scheduled --apply`), then set `hasdeployed:false` + `deployStatus:"pending"` and restart the bot.',
            ].join('\n'),
            color: 0xdc3545,
            footer: { text: 'PHMC Bot — Auto Deploy (emergency handbrake)' },
            timestamp: new Date().toISOString(),
        });

        if (data._progressMessageId && state.discordClient) {
            try {
                const channel = await state.discordClient.channels.fetch(data._progressChannelId);
                const msg = await channel.messages.fetch(data._progressMessageId);
                await msg.edit({ content: `[BLOCKED] ${label} — empty employee identity, deploy halted`, embeds: [], components: [] });
            } catch { /* progress embed is optional */ }
        }
        state.processing = false;
        return;
    }

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
        if (deptStr.includes('dao') || deptStr.includes('atlantic') || deptStr.includes('district attorney')) forumLabel = 'DAO';
        else if (deptStr.includes('sadcr')) forumLabel = 'SADCR';
        else if (deptStr.includes('lssd') || deptStr.includes('sheriff')) forumLabel = 'LSSD';
        else forumLabel = 'LSPD';
        console.log(`[AUTO] PM forum resolved: "${forumLabel}" from department "${rawDept}"`);
    }
    state.currentProcessing = { label, type, forum: forumLabel };

    console.log('[AUTO] Deploying ' + label + ' (' + data.key + ') to ' + forumLabel + '...');

    try {
        // Timeout guard: warn at 1 min, abort at 10 min
        const slowWarning = setTimeout(() => {
            console.warn('[AUTO] ' + data.key + ' deploy taking longer than usual (>1 min)');
            sendWebhook(null, {
                title: ' Forum Slow to Respond',
                description: '**Key:** `' + data.key + '`\n**Type:** ' + type + '\n**Report:** ' + label,
                color: 0xffc107,
                footer: { text: 'PHMC Bot — Auto Deploy' },
                timestamp: new Date().toISOString(),
            });
        }, 1 * 60 * 1000);

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

        // User-facing alert so staff see ANY deploy failure in the log channel.
        await notifyDeployFailure(label, type, data.key, err.message);

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
