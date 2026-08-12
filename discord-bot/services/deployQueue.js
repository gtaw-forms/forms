/**
 * Deploy Queue — queue management + maintenance mode + consent gating.
 *
 * Queue + maintenance are kept in one module because of a circular dependency:
 *   - enqueue() checks isMaintenanceMode()
 *   - setMaintenanceMode() re-scans and calls enqueue() / consentGateAndEnqueue()
 */

import { getForumClient } from './forumClient.js';
import { logFnCall, sendWebhook, DeployProgressEmbed } from './deployLogger.js';
import { state, C } from './deployState.js';
import { checkUserConsent, skipDueToConsent } from './deployConsent.js';
import { setDeployStatus } from './deployStatus.js';

//  Import runDeploy lazily to avoid circular dependency (autoDeploy imports deployQueue which uses runDeploy)
let _runDeploy = null;
async function getRunDeploy() {
    if (!_runDeploy) {
        const m = await import('./deployExecutor.js');
        _runDeploy = m.runDeploy;
    }
    return _runDeploy;
}

// ── Consent-Gated Enqueue ──

export async function consentGateAndEnqueue(type, item, formId) {
    logFnCall('deployQueue', 'consentGateAndEnqueue', 'Gate and enqueue', { type, formId });
    const consented = await checkUserConsent(item.db, item.authorId, formId);
    if (!consented) {
        await skipDueToConsent(item.db, item.authorId, item.key, formId, item.report.originalKey || item.key);
        return;
    }
    enqueue(type, item);
}

// ── Maintenance Mode ──

export async function isMaintenanceMode() {
    logFnCall('deployQueue', 'isMaintenanceMode', 'Checking maintenance mode');
    if (!state.dbRef) return false;
    try {
        const snap = await state.dbRef.child(C.MAINTENANCE_PATH).once('value');
        return snap.val() === true;
    } catch {
        return state.maintenanceMode;
    }
}

export async function setMaintenanceMode(enabled, db) {
    logFnCall('deployQueue', 'setMaintenanceMode', 'Setting maintenance mode', { enabled });
    state.maintenanceMode = enabled;
    try {
        await db.ref(C.MAINTENANCE_PATH).set(enabled);
    } catch (err) {
        console.error('[AUTO] Failed to persist maintenance mode:', err.message);
    }

    if (enabled) {
        let cancelled = 0;
        state.pendingDeployments.forEach((entry) => {
            clearTimeout(entry.timer);
            cancelled++;
        });
        state.pendingDeployments.clear();
        console.log(`[AUTO] Maintenance mode ON — cancelled ${cancelled} pending deployment(s)`);
    } else {
        console.log('[AUTO] Maintenance mode OFF — queue will resume');
        try {
            const snap = await db.ref('scheduledReports').once('value');
            let requeued = 0;
            snap.forEach((authorSnap) => {
                const authorId = authorSnap.key;
                authorSnap.forEach((reportSnap) => {
                    const reportKey = reportSnap.key;
                    if (state.knownReportKeys?.has(reportKey)) return;
                    const reportData = reportSnap.val();
                    if (reportData.hasdeployed !== false) return;
                    if (!state.knownReportKeys) return;
                    state.knownReportKeys.add(reportKey);
                    const item = { authorId, key: reportKey, report: reportData, db };
                    const formId = reportData.formId;
                    if (formId === 'coroner_email') consentGateAndEnqueue('pm', item, formId);
                    else if (['death_record', 'mass-ftality-test', 'coroner-report'].includes(formId)) consentGateAndEnqueue('topic', item, formId);
                    else if (['patient_notes', 'er_protocol', 'physical_evaluation', 'staff-patient-file', 'surgical', 'session_notes', 'intensive_treatment', 'psych-eval', 'testing-compact-mode'].includes(formId)) consentGateAndEnqueue('medical-record', item, formId);
                    else if (formId === 'autopsy') consentGateAndEnqueue('autopsy-reply', item, formId);
                    requeued++;
                });
            });
            if (requeued > 0) console.log(`[AUTO] Re-queued ${requeued} report(s) after maintenance mode off`);
        } catch (err) {
            console.error('[AUTO] Failed to re-scan reports after maintenance:', err.message);
        }
    }
}

// ── Timed Queue ──

function getEntityKey(data) {
    logFnCall('deployQueue', 'getEntityKey', 'Getting entity key');
    const d = data.report?.data || {};
    const recipient = d.requestingOfficer || d.requesting_officer || d.officerName || d.recipient || '';
    const dept = d.department || '';
    const decedent = [d.decedentName, d.decedentOOC, d.dateTime || d.dateOfDeath].filter(Boolean).join('|');
    const raw = `${decedent}|${recipient}|${dept}` || data.key;
    if (raw.length > 90) {
        let hash = 0;
        for (let i = 0; i < raw.length; i++) { hash = ((hash << 5) - hash) + raw.charCodeAt(i); hash |= 0; }
        return `sk_${Math.abs(hash).toString(36)}`;
    }
    return raw;
}

export async function enqueue(type, data) {
    logFnCall('deployQueue', 'enqueue', 'Enqueueing deploy', { type, key: data.key });
    if (await isMaintenanceMode()) {
        console.log(`[AUTO] Maintenance mode — skipping ${data.report?.originalKey || data.key}`);
        return;
    }

    const entityKey = getEntityKey(data);
    const label = data.report?.originalKey || data.key;
    const firebaseKey = data.key;
    const fireTime = Date.now() + C.DEFER_MS;
    const deployTime = new Date(fireTime).toLocaleTimeString();

    // Extract patient info early for progress embed enrichment
    const d = data.report?.data || {};
    const patientName = d.decedentName || d.patientName || d.decedentOOC || '';

    if (state.pendingDeployments.has(entityKey)) {
        const existing = state.pendingDeployments.get(entityKey);
        clearTimeout(existing.timer);
        console.log(`[AUTO] ${label} replaced by newer version, timer reset`);
        // Mark the OLD report as trashed so it's not picked up on restart
        if (existing.data?.authorId && existing.data?.key) {
            const oldDb = existing.data.db || state.dbRef;
            if (oldDb) {
                oldDb.ref(`scheduledReports/${existing.data.authorId}/${existing.data.key}`).update({
                    hasdeployed: true,
                    deployStatus: 'trashed_duplicate',
                    deployMessage: `Replaced by newer save ${firebaseKey}.`,
                    deployedAt: new Date().toISOString(),
                    deployedBy: 'autoDeploy',
                }).catch((err) => console.warn(`[AUTO] Failed to trash old duplicate ${existing.data.key}: ${err.message}`));
            }
        }
        // Update user-facing status with new timeline
        const minutes = Math.round(C.DEFER_MS / 60000);
        const msg = `Queued — will auto-deploy around ${deployTime} (${minutes} min). Re-save to make edits before then.`;
        setDeployStatus(data.db || state.dbRef, data.authorId, data.key, 'queued', msg).catch(() => {});
    } else {
        const enrichedLabel = patientName ? `${label} — ${patientName}` : label;
        console.log(`[AUTO] ${enrichedLabel} queued, will deploy at ${deployTime}`);
        let queueDetail = '';
        if (type === 'pm') {
            const recipient = d.requestingOfficer || d.requesting_officer || d.officerName || d.recipient || 'Unknown';
            const rawDept = d.department || '';
            const deptStr = (typeof rawDept === 'object' ? (rawDept.label || rawDept.value || '') : String(rawDept)) || '?';
            queueDetail = `\n**To:** ${recipient} (${deptStr})`;
        } else if (type === 'topic') {
            const fInfo = getForumClient().constructor.FORUM_MAP[data.report?.formId];
            queueDetail = `\n**Forum:** ${fInfo?.name || 'PHMC Forum'}`;
        } else if (type === 'autopsy-reply') {
            queueDetail = `\n**Forum:** Case Management (reply)`;
        }
        // (no standalone webhook — the progress embed below covers queue status)

        // Write user-facing status so the web app shows a clear notification
        const minutes = Math.round(C.DEFER_MS / 60000);
        const msg = `Queued — will auto-deploy around ${deployTime} (${minutes} min). Re-save to make edits before then.`;
        setDeployStatus(data.db || state.dbRef, data.authorId, data.key, 'queued', msg).catch(() => {});
    }

    // Post a unified progress embed (will be edited by the deploy handler later)
    let progressMessageId = null;
    try {
        const embed = new DeployProgressEmbed(state.discordClient, process.env.BOT_LOG_CHANNEL_ID);
        const minutes = Math.round(C.DEFER_MS / 60000);
        const displayLabel = patientName ? `${label} — ${patientName}` : label;
        await embed.start(`Queued: ${displayLabel} — deploys ~${deployTime} (${minutes} min)`);
        progressMessageId = embed.messageId;
    } catch (e) { /* progress embed is optional */ }

    const timer = setTimeout(async () => {
        state.pendingDeployments.delete(entityKey);
        if (progressMessageId) {
            data._progressMessageId = progressMessageId;
            data._progressChannelId = process.env.BOT_LOG_CHANNEL_ID;
        }
        const runDeploy = await getRunDeploy();
        runDeploy(type, data);
    }, C.DEFER_MS);

    state.pendingDeployments.set(entityKey, { timer, type, data, label, fireTime, progressMessageId });
}

export async function skipReport(entityKey, skippedBy = 'unknown') {
    logFnCall('deployQueue', 'skipReport', 'Skipping report', { entityKey });
    const pipeIdx = entityKey.indexOf('|');
    let authorId, reportKey, label;

    if (state.pendingDeployments.has(entityKey)) {
        const entry = state.pendingDeployments.get(entityKey);
        clearTimeout(entry.timer);
        state.pendingDeployments.delete(entityKey);
        label = entry.label || entityKey;
        authorId = entry.data?.authorId;
        reportKey = entry.data?.key;
        if (reportKey && state.knownReportKeys) state.knownReportKeys.delete(reportKey);
        if (authorId && reportKey && state.dbRef) {
            try {
                await state.dbRef.child(`scheduledReports/${authorId}/${reportKey}`).update({
                    hasdeployed: true,
                    deployStatus: 'skipped_manual',
                    deployMessage: `Skipped by ${skippedBy} via /report-skip at ${new Date().toISOString()}`,
                    skippedAt: new Date().toISOString(),
                    skippedBy,
                });
            } catch (err) {
                console.error(`[AUTO] Failed to mark skipped report: ${err.message}`);
            }
        }
    } else if (pipeIdx !== -1) {
        authorId = entityKey.slice(0, pipeIdx);
        reportKey = entityKey.slice(pipeIdx + 1);
        label = reportKey;
        if (state.dbRef) {
            try {
                const snap = await state.dbRef.child(`scheduledReports/${authorId}/${reportKey}`).once('value');
                const report = snap.val();
                label = report?.originalKey || reportKey;
                await state.dbRef.child(`scheduledReports/${authorId}/${reportKey}`).update({
                    hasdeployed: true,
                    deployStatus: 'skipped_manual',
                    deployMessage: `Skipped by ${skippedBy} via /report-skip at ${new Date().toISOString()}`,
                    skippedAt: new Date().toISOString(),
                    skippedBy,
                });
            } catch (err) {
                console.error(`[AUTO] Failed to mark skipped report: ${err.message}`);
                return { ok: false, error: `Failed to update Firebase: ${err.message}` };
            }
        }
    } else {
        return { ok: false, error: 'Report not found in queue (may have already deployed or been skipped)' };
    }

    await sendWebhook(null, {
        title: ' Report Skipped — Removed from Queue',
        description: [`**Report:** ${label}`, `**Skipped by:** ${skippedBy}`, `**Key:** \`${reportKey || 'unknown'}\``].join('\n'),
        color: 0x9b59b6,
        footer: { text: 'PHMC Bot — Auto Deploy' },
        timestamp: new Date().toISOString(),
    });
    console.log(`[AUTO] ${label} skipped by ${skippedBy}, removed from queue`);
    return { ok: true, label };
}

export function getQueuedDeployments() {
    const now = Date.now();
    const entries = [];

    if (state.processing && state.currentProcessing) {
        entries.push({
            label: state.currentProcessing.label,
            type: state.currentProcessing.type,
            forum: state.currentProcessing.forum,
            status: 'processing',
            remainingSec: 0,
        });
    }

    state.pendingDeployments.forEach((entry, entityKey) => {
        const remaining = Math.max(0, Math.round((entry.fireTime - now) / 1000));
        const formId = entry.data.report?.formId || '';
        let forumLabel;
        if (['patient_notes', 'er_protocol', 'physical_evaluation', 'staff-patient-file', 'surgical', 'session_notes', 'intensive_treatment', 'psych-eval', 'testing-compact-mode'].includes(formId)) forumLabel = 'Medical Records';
        else if (entry.type === 'topic' || entry.type === 'medical-record') {
            const MAP = { 'coroner-report': 'Coroner Reports', 'death_record': 'Death Records', 'mass-ftality-test': 'Mass Fatality', 'autopsy': 'Autopsy' };
            forumLabel = MAP[formId] || 'PHMC Forum';
        } else if (entry.type === 'autopsy-reply') forumLabel = 'Case Management';
        else {
            const d = entry.data.report?.data || {};
            const rawDept = d.department || '';
            const deptStr = (typeof rawDept === 'object' ? (rawDept.label || rawDept.value || '') : String(rawDept)).toLowerCase();
            if (deptStr.includes('dao') || deptStr.includes('atlantic') || deptStr.includes('district attorney')) forumLabel = 'DAO';
            else if (deptStr.includes('sadcr') || deptStr.includes('corrections')) forumLabel = 'SADCR';
            else if (deptStr.includes('lssd') || deptStr.includes('sheriff')) forumLabel = 'LSSD';
            else forumLabel = 'LSPD';
        }
        entries.push({ entityKey, label: entry.label, type: entry.type, forum: forumLabel, status: 'queued', remainingSec: remaining, fireTime: entry.fireTime });
    });
    const sorted = entries.sort((a, b) => {
        if (a.status === 'processing') return -1;
        if (b.status === 'processing') return 1;
        return (a.fireTime || 0) - (b.fireTime || 0);
    });
    // Log only when the queue actually has something in it — the 30s dashboard
    // poll would otherwise spam the console with a no-op read every cycle.
    if (sorted.length > 0) {
        logFnCall('deployQueue', 'getQueuedDeployments', `Queue snapshot (${sorted.length} queued/processing)`);
    }
    return sorted;
}

export async function getStuckReports() {
    logFnCall('deployQueue', 'getStuckReports', 'Getting stuck reports');
    if (!state.dbRef) return [];
    const snap = await state.dbRef.child('scheduledReports').once('value');
    if (!snap.exists()) return [];
    const stuck = [];
    snap.forEach((authorSnap) => {
        const authorId = authorSnap.key;
        authorSnap.forEach((reportSnap) => {
            const report = reportSnap.val();
            if (report.deployStatus === 'pick_timed_out') {
                stuck.push({ authorId, key: reportSnap.key, label: report.originalKey || reportSnap.key });
            }
        });
    });
    return stuck;
}
