/**
 * Auto-Deploy Service — monitors Firebase for new reports and deploys them
 * one at a time through a sequential queue.
 *
 * Wired into index.js on bot startup. Never runs more than one deploy at a time.
 */

import firebase from './firebase.js';
import { getForumClient } from './forumClient.js';

// ── Discord Webhook ──

const DEPLOY_WEBHOOK_URL = process.env.DEPLOY_WEBHOOK_URL;

async function sendWebhook(content, embed) {
    if (!DEPLOY_WEBHOOK_URL) return;
    try {
        const payload = {};
        if (content) payload.content = content;
        if (embed) payload.embeds = [embed];
        await fetch(DEPLOY_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (err) {
        console.error('[AUTO] ⚠️ Webhook send failed:', err.message);
    }
}

/**
 * Send a step-by-step progress webhook with a consistent format.
 * Styled with a left border color to show progress vs success vs failure.
 */
async function logStep(label, detail, { color = 0x007bff, isFinal = false } = {}) {
    await sendWebhook(null, {
        title: label,
        description: detail,
        color,
        footer: { text: isFinal ? '' : 'PHMC Bot — Step' },
        timestamp: new Date().toISOString(),
    });
}

// ── Maintenance Mode ──

const MAINTENANCE_PATH = 'appMetadata/botMaintenance';

let _maintenanceMode = false;
let _dbRef = null; // set on startAutoDeploy

/**
 * Check if maintenance mode is active (reads from Firebase).
 */
export async function isMaintenanceMode() {
    if (!_dbRef) return false;
    try {
        const snap = await _dbRef.child(MAINTENANCE_PATH).once('value');
        return snap.val() === true;
    } catch {
        return _maintenanceMode; // fallback to in-memory
    }
}

/**
 * Toggle maintenance mode. When true, all queue processing stops.
 * @param {boolean} enabled
 * @param {object} db - Firebase database ref
 */
export async function setMaintenanceMode(enabled, db) {
    _maintenanceMode = enabled;
    try {
        await db.ref(MAINTENANCE_PATH).set(enabled);
    } catch (err) {
        console.error('[AUTO] ⚠️ Failed to persist maintenance mode:', err.message);
    }

    if (enabled) {
        // Cancel all pending timers
        let cancelled = 0;
        pendingDeployments.forEach((entry) => {
            clearTimeout(entry.timer);
            cancelled++;
        });
        pendingDeployments.clear();
        console.log(`[AUTO] 🛑 Maintenance mode ON — cancelled ${cancelled} pending deployment(s)`);
    } else {
        console.log('[AUTO] ✅ Maintenance mode OFF — queue will resume');
    }
}

// ── Timed Queue ──

const DEFER_MS = 1 * 60 * 1000;          // 1 minute (testing)
const RETRY_DELAY_MS = 6 * 60 * 60 * 1000;  // 6 hours between retries
const RETRY_CHECK_INTERVAL_MS = 30 * 60 * 1000; // check for retry-eligible items every 30 min
const MAX_RETRIES = 3;
let processing = false;

/**
 * Map of entityKey -> { timer, type, data, reportLabel }
 * Allows replacing a queued report if a corrected version arrives within the defer window.
 */
const pendingDeployments = new Map();

/**
 * Set of Firebase report keys that have already been processed (queued or deployed).
 * Tracks seen reports so the Firebase listener doesn't re-enqueue the same item.
 * Cleared on bot restart. Failed deploys are removed from this set to allow retry.
 */
let knownReportKeys = null; // initialized in startAutoDeploy()

/**
 * Build an entity key from report data for dedup matching.
 * Includes decedent + recipient/officer so different departments (LSPD vs LSSD)
 * for the same decedent are treated as separate deployments.
 */
function getEntityKey(data) {
    const d = data.report?.data || {};
    const recipient = d.requestingOfficer || d.requesting_officer || d.officerName || d.recipient || '';
    const dept = d.department || '';
    const decedent = [d.decedentName, d.decedentOOC, d.dateTime || d.dateOfDeath]
        .filter(Boolean)
        .join('|');
    // Key includes decedent + recipient + department so corrections match the right report
    return `${decedent}|${recipient}|${dept}` || data.key;
}

/**
 * Queue a report with a short delay (DEFER_MS).
 * If a newer version of the same report arrives, it replaces the queued one.
 */
async function enqueue(type, data) {
    // Check maintenance mode before queueing
    if (await isMaintenanceMode()) {
        console.log(`[AUTO] ⏸️ Maintenance mode — skipping ${data.report?.originalKey || data.key}`);
        return;
    }

    const entityKey = getEntityKey(data);
    const label = data.report?.originalKey || data.key;
    const firebaseKey = data.key;
    const fireTime = Date.now() + DEFER_MS;
    const deployTime = new Date(fireTime).toLocaleTimeString();

    // Cancel existing timer for this entity (user saved a corrected version)
    if (pendingDeployments.has(entityKey)) {
        const existing = pendingDeployments.get(entityKey);
        clearTimeout(existing.timer);
        console.log(`[AUTO] 🔄 ${label} — replaced by newer version, timer reset`);
    } else {
        console.log(`[AUTO] 📥 ${label} — queued, will deploy at ${deployTime} (awaiting corrections...)`);
        sendWebhook(null, {
            title: '⏳ Report Queued',
            description: `**${label}**\n\`${firebaseKey}\`\nDelaying ~${Math.round(DEFER_MS / 60000)} min for potential corrections.\nDeploy scheduled around **${deployTime}**.`,
            color: 0xffc107,
            footer: { text: 'PHMC Bot — Auto Deploy' },
            timestamp: new Date().toISOString(),
        });
    }

    // Start (or restart) the defer timer
    const timer = setTimeout(() => {
        pendingDeployments.delete(entityKey);
        runDeploy(type, data);
    }, DEFER_MS);

    pendingDeployments.set(entityKey, { timer, type, data, label, fireTime });
}

/**
 * Skip a queued report — cancels its timer, removes from queue, marks in Firebase.
 * @param {string} entityKey - The entity key from getQueuedDeployments()
 * @param {string} skippedBy - Discord user tag who skipped it
 * @returns {Promise<{ok: boolean, label?: string, error?: string}>}
 */
export async function skipReport(entityKey, skippedBy = 'unknown') {
    if (!pendingDeployments.has(entityKey)) {
        return { ok: false, error: 'Report not found in queue (may have already deployed or been skipped)' };
    }

    const entry = pendingDeployments.get(entityKey);
    const { timer, data, label } = entry;

    // Cancel the pending timer
    clearTimeout(timer);
    pendingDeployments.delete(entityKey);

    // Remove from knownReportKeys so it can be re-queued if re-saved later
    if (data?.key && knownReportKeys) {
        knownReportKeys.delete(data.key);
    }

    // Mark in Firebase as skipped
    try {
        if (data?.db && data?.authorId && data?.key) {
            await data.db.ref(`scheduledReports/${data.authorId}/${data.key}`).update({
                hasdeployed: true,
                deployStatus: 'skipped_manual',
                deployMessage: `Skipped by ${skippedBy} via /report-skip at ${new Date().toISOString()}`,
                skippedAt: new Date().toISOString(),
                skippedBy,
            });
        }
    } catch (err) {
        console.error(`[AUTO] ⚠️ Failed to mark skipped report in Firebase: ${err.message}`);
        // Non-fatal — the report is still removed from the in-memory queue
    }

    // Send webhook notification
    await sendWebhook(null, {
        title: '⏭️ Report Skipped — Removed from Queue',
        description: [
            `**Report:** ${label || entityKey}`,
            `**Skipped by:** ${skippedBy}`,
            `**Key:** \`${data?.key || 'unknown'}\``,
        ].join('\n'),
        color: 0x9b59b6,
        footer: { text: 'PHMC Bot — Auto Deploy' },
        timestamp: new Date().toISOString(),
    });

    console.log(`[AUTO] ⏭️ ${label || entityKey} — skipped by ${skippedBy}, removed from queue`);

    return { ok: true, label: label || entityKey };
}

/**
 * Get a snapshot of the currently queued deployments (for slash commands).
 * Returns queued items + currently processing item if any.
 */
export function getQueuedDeployments() {
    const now = Date.now();
    const entries = [];

    // Currently processing (not in the timer map)
    if (processing && currentProcessing) {
        entries.push({
            label: currentProcessing.label,
            type: currentProcessing.type,
            forum: currentProcessing.forum,
            status: 'processing',
            remainingSec: 0,
        });
    }

    // Items in the timer queue
    pendingDeployments.forEach((entry, entityKey) => {
        const remaining = Math.max(0, Math.round((entry.fireTime - now) / 1000));
        const formId = entry.data.report?.formId || '';
        let forumLabel;
        if (formId === 'patient_notes') {
            forumLabel = 'Medical Records';
        } else if (entry.type === 'topic' || entry.type === 'medical-record') {
            const MAP = { 'coroner-report':'Coroner Reports', 'death_record':'Death Records', 'mass-ftality-test':'Mass Fatality', 'autopsy':'Autopsy' };
            forumLabel = MAP[formId] || 'PHMC Forum';
        } else {
            const d = entry.data.report?.data || {};
            const rawDept = d.department || '';
            const deptStr = (typeof rawDept === 'object' ? (rawDept.label || rawDept.value || '') : String(rawDept)).toLowerCase();
            forumLabel = deptStr.includes('lssd') || deptStr.includes('sheriff') ? 'LSSD' : 'LSPD';
        }
        entries.push({
            entityKey,
            label: entry.label,
            type: entry.type,
            forum: forumLabel,
            status: 'queued',
            remainingSec: remaining,
            fireTime: entry.fireTime,
        });
    });
    return entries.sort((a, b) => {
        if (a.status === 'processing') return -1;
        if (b.status === 'processing') return 1;
        return (a.fireTime || 0) - (b.fireTime || 0);
    });
}

/**
 * Track what's currently being processed (for /form-queued status display).
 */
let currentProcessing = null;

/**
 * Actually deploy a report (runs after the 5-min delay clears).
 * Processes sequentially — only one deploy at a time.
 */
async function runDeploy(type, data) {
    if (processing) {
        setTimeout(() => runDeploy(type, data), 5000);
        return;
    }
    processing = true;

    const label = data.report?.originalKey || data.key;
    const d = data.report?.data || {};

    // Determine forum label based on deploy type
    let forumLabel;
    if (type === 'topic' || type === 'medical-record' || type === 'patient_notes') {
        const fInfo = getForumClient().constructor.FORUM_MAP[data.report?.formId];
        forumLabel = fInfo?.name || 'PHMC Forum';
    } else {
        // PM routing — determine by department field
        const rawDept = d.department || '';
        const deptStr = (typeof rawDept === 'object' ? (rawDept.label || rawDept.value || '') : String(rawDept)).toLowerCase();
        forumLabel = deptStr.includes('lssd') || deptStr.includes('sheriff') ? 'LSSD' : 'LSPD';
        console.log(`[AUTO] ℹ️ PM forum resolved: "${forumLabel}" from department "${rawDept}"`);
    }
    currentProcessing = { label, type, forum: forumLabel };

    console.log(`[AUTO] ▶️ Deploying ${label} (${data.key}) to ${forumLabel}...`);
    await sendWebhook(null, {
        title: '🚀 Deploying Report',
        description: `**${label}**\n\`${data.key}\`\nNow sending to **${forumLabel}**...`,
        color: 0x007bff,
        footer: { text: 'PHMC Bot — Auto Deploy' },
        timestamp: new Date().toISOString(),
    });

    try {
        // ── Timeout guard: if deploy takes longer than 10 minutes, abort ──
        // Warn at 3 minutes if still going, so staff know it's just slow, not broken
        const slowWarning = setTimeout(() => {
            console.warn(`[AUTO] ⏳ ${data.key} — deploy taking longer than usual (>3 min), still running...`);
            sendWebhook(null, {
                title: '⏳ Forum Slow to Respond',
                description: `**Key:** \`${data.key}\`\n**Type:** ${type}\n**Report:** ${label}\n\nThe forums appear to be slow to connect — updates will be delayed. The bot is still retrying in the background.`,
                color: 0xffc107,
                footer: { text: 'PHMC Bot — Auto Deploy' },
                timestamp: new Date().toISOString(),
            });
        }, 3 * 60 * 1000);

        const timeout = setTimeout(() => {
            clearTimeout(slowWarning);
            console.error(`[AUTO] ⏰ ${data.key} — deploy timed out after 10 minutes`);
            sendWebhook(null, {
                title: '⏰ Forum Unresponsive',
                description: `**Key:** \`${data.key}\`\n**Type:** ${type}\n**Report:** ${label}\n\nThe forum did not respond within 10 minutes. This may indicate a Cloudflare block, forum outage, or network issue.`,
                color: 0xdc3545,
                footer: { text: 'PHMC Bot — Auto Deploy' },
                timestamp: new Date().toISOString(),
            });
            processing = false;
        }, 10 * 60 * 1000);

        try {
            if (type === 'pm') {
                await handlePM(data);
            } else if (type === 'topic') {
                await handleTopic(data);
            } else if (type === 'patient_notes' || type === 'medical-record') {
                await handleMedicalRecord(data);
            }
        } finally {
            clearTimeout(slowWarning);
            clearTimeout(timeout);
        }
    } catch (err) {
        console.error(`[AUTO] ❌ ${data.key} — Failed:`, err.message);
        console.error(`[AUTO] 🧩 Stack:`, err.stack);

        const retries = (data.report?.deployRetries || 0) + 1;

        try {
            if (retries >= MAX_RETRIES) {
                // Permanently mark as failed — give up after MAX_RETRIES attempts
                console.error(`[AUTO] 🛑 ${data.key} — failed ${retries}/${MAX_RETRIES} times, giving up permanently`);
                await data.db.ref(`scheduledReports/${data.authorId}/${data.key}`).update({
                    hasdeployed: false,
                    deployStatus: 'failed_permanent',
                    deployMessage: `Gave up after ${retries} attempts. Last error: ${err.message.slice(0, 200)}`,
                    deployRetries: retries,
                    deployLastFailedAt: new Date().toISOString(),
                });
            } else {
                // Re-queue for 6 hours later
                const retryTime = Date.now() + RETRY_DELAY_MS;
                const retryAtISO = new Date(retryTime).toISOString();

                await data.db.ref(`scheduledReports/${data.authorId}/${data.key}`).update({
                    hasdeployed: false,
                    deployStatus: 'retry_queued',
                    deployMessage: `Re-queued (attempt ${retries}/${MAX_RETRIES}) — next retry at ${retryAtISO}. Error: ${err.message.slice(0, 200)}`,
                    retryAt: retryAtISO,
                    deployRetries: retries,
                    deployLastFailedAt: new Date().toISOString(),
                });

                console.log(`[AUTO] 🔄 ${data.key} — re-queued for retry at ${retryAtISO} (attempt ${retries}/${MAX_RETRIES})`);
                // KEEP in knownReportKeys to prevent immediate re-trigger from value listener.
                // The periodic checkRetryQueue() will re-enqueue when retryAt passes.
            }
        } catch { /* best effort */ }

        // Truncate stack to fit Discord embed limits (4096 char description)
        const stackTrace = (err.stack || '').slice(0, 1500);
        await sendWebhook(null, {
            title: retries >= MAX_RETRIES ? '❌ Deploy Failed — Giving Up' : '⏳ Deploy Failed — Will Retry in 6h',
            description: [
                `**Key:** \`${data.key}\``,
                `**Type:** ${type}`,
                `**Report:** ${label}`,
                `**Attempt:** ${retries}/${MAX_RETRIES}`,
                retries < MAX_RETRIES ? `**Next retry:** ${new Date(Date.now() + RETRY_DELAY_MS).toISOString()}` : '**Status:** Permanently failed',
                `**Error:** ${err.message.slice(0, 500)}`,
                stackTrace ? `\`\`\`\n${stackTrace}\n\`\`\`` : '',
            ].join('\n'),
            color: retries >= MAX_RETRIES ? 0xdc3545 : 0xffc107,
            footer: { text: 'PHMC Bot — Auto Deploy' },
            timestamp: new Date().toISOString(),
        });
    }

    currentProcessing = null;
    processing = false;
}

// ── Handlers ──

/**
 * Send a coroner email as a PM.
 * Determines the target forum based on report metadata.
 */
async function handlePM(report) {
    const { authorId, key, report: reportData, db } = report;
    const recipient = reportData.data?.requestingOfficer
        || reportData.data?.requesting_officer
        || reportData.data?.officerName
        || reportData.data?.recipient
        || null;

    if (!recipient) {
        console.log(`[AUTO] ⏭️ ${key} — no recipient, marking as deployed`);
        await markDeployed(db, authorId, key, true, { deployNote: 'No recipient' });
        return;
    }

    const bbSnap = await db.ref(`scheduledReportsBBCode/${authorId}/${key}`).once('value');
    const bbCode = bbSnap.val()?.bbCode;
    if (!bbCode) {
        console.log(`[AUTO] ⏭️ ${key} — no BBCode, marking as deployed`);
        await markDeployed(db, authorId, key, true, { deployNote: 'No BBCode' });
        return;
    }

    // Determine forum from the report data
    const rawDept = reportData.data?.department || '';
    const deptStr = (typeof rawDept === 'object' ? (rawDept.label || rawDept.value || '') : String(rawDept)).toLowerCase();
    console.log(`[AUTO] 🔍 Resolving forum — raw department value: "${rawDept}" → parsed: "${deptStr}"`);

    const isLssd = deptStr.includes('lssd') || deptStr.includes('sheriff') || deptStr.includes('lasd');
    const forumUrl = isLssd
        ? (process.env.FORUM_LSSD_URL || 'http://lssd.gta.world')
        : (process.env.FORUM_LSPD_URL || 'http://lspd.gta.world');

    const username = isLssd
        ? process.env.FORUM_LSSD_USERNAME
        : process.env.FORUM_LSPD_USERNAME;
    const password = isLssd
        ? process.env.FORUM_LSSD_PASSWORD
        : process.env.FORUM_LSPD_PASSWORD;

    // Skip if credentials aren't configured for this forum
    if (!username || !password) {
        console.log(`[AUTO] ⏭️ ${key} — no credentials for ${forumUrl}, leaving for manual deploy`);
        return;
    }

    console.log(`[AUTO] 📨 Sending PM to ${recipient} via ${forumUrl}...`);
    const client = getForumClient();
    await client.login(username, password, { force: true, baseUrl: forumUrl });
    const result = await client.sendPM(recipient, reportData.originalKey || key, bbCode, { baseUrl: forumUrl });
    if (result.ok) {
        const label = reportData.originalKey || key;
        await markReportComplete(db, authorId, key, label, 'pm', result.url);
        console.log(`[AUTO] ✅ ${key} — PM sent to ${recipient}`);
    } else {
        console.log(`[AUTO] ⚠️ ${key} — PM send returned failure`);
        await sendWebhook(null, {
            title: '⚠️ Deploy Returned Unknown',
            description: `**Key:** \`${key}\`\n**Forum:** ${forumUrl}\n**Response:** Page returned empty after submit`,
            color: 0xffc107,
            footer: { text: 'PHMC Bot — Auto Deploy' },
            timestamp: new Date().toISOString(),
        });
    }
}

/**
 * Post a report as a forum topic (death_record, mass-fatality, coroner-report).
 */
async function handleTopic(report) {
    const { authorId, key, report: reportData, db } = report;

    const bbSnap = await db.ref(`scheduledReportsBBCode/${authorId}/${key}`).once('value');
    const bbCode = bbSnap.val()?.bbCode;
    if (!bbCode) {
        console.log(`[AUTO] ⏭️ ${key} — no BBCode, marking as deployed`);
        await markDeployed(db, authorId, key, true, { deployNote: 'No BBCode' });
        return;
    }

    // Resolve forum from the mapping
    const forumInfo = getForumClient().constructor.FORUM_MAP[reportData.formId];
    if (!forumInfo) {
        console.log(`[AUTO] ⏭️ ${key} — no forum mapping for ${reportData.formId}`);
        return;
    }

    const DRY_POST = process.env.DRY_POST !== 'false';

    if (DRY_POST) {
        const simUrl = `${forumInfo.url}&dry_run=SIM_${Date.now()}`;
        const label = reportData.originalKey || key;
        await markReportComplete(db, authorId, key, label, 'topic_simulated', simUrl);
        console.log(`[AUTO] 🏜️ ${key} — Simulated topic post to ${forumInfo.name} (DRY_POST)`);
        return;
    }

    console.log(`[AUTO] 📰 Posting topic to ${forumInfo.name} (f=${forumInfo.forumId})...`);
    const client = getForumClient();
    // Force login on PHMC forum (different domain from PM forums)
    await client.login(null, null, { force: true, baseUrl: process.env.FORUM_BASE_URL });
    const result = await client.postTopic(forumInfo.forumId, reportData.originalKey || key, bbCode, forumInfo.url);
    if (result.ok) {
        const label = reportData.originalKey || key;
        await markReportComplete(db, authorId, key, label, 'topic', result.url);
        console.log(`[AUTO] ✅ ${key} — Topic posted: ${result.url}`);
    }
}

// ── Medical Record Handler (reply to existing patient thread, or create new) ──

/**
 * Handle a Patient Note — search for existing patient thread by patientID/name and reply to it.
 * ONLY replies to existing topics — never creates new ones.
 * Dry-run by default for safety — set DRY_REPLY=false in .env to enable live replies.
 */
async function handleMedicalRecord(report) {
    const { authorId, key, report: reportData, db } = report;
    const DRY_REPLY = process.env.DRY_REPLY !== 'false';

    console.log(`[AUTO] 📋 handleMedicalRecord called for ${key} — patientID: "${reportData.data?.patientID}", formId: "${reportData.formId}"`);
    const rawPatientID = (reportData.data?.patientID || '').trim();
    const patientName = reportData.data?.decedentName || reportData.originalKey || '';

    // Require at least patientID OR patientName to proceed
    if (!rawPatientID && !patientName) {
        console.log(`[AUTO] ⏭️ ${key} — no patientID or patientName`);
        await setDeployStatus(db, authorId, key, 'error', 'Missing patient ID or name. Please add one and save again.');
        await logStep('❌ Cannot Process', 'Add a **Patient ID** or **Patient Name** to the report, then save again.', { color: 0xdc3545, isFinal: true });
        return;
    }

    const bbSnap = await db.ref(`scheduledReportsBBCode/${authorId}/${key}`).once('value');
    const bbCode = bbSnap.val()?.bbCode;
    if (!bbCode) {
        console.log(`[AUTO] ⏭️ ${key} — no BBCode, marking as deployed`);
        await setDeployStatus(db, authorId, key, 'error', 'No BBCode content found in report. Please regenerate and save again.');
        await logStep('❌ No BBCode', 'The report has no BBCode content. Regenerate the BBCode and save again.', { color: 0xdc3545, isFinal: true });
        return;
    }

    // ── Near-duplicate check: within the last 5 min, keep only the newest report per patient ──
    // Uses the report-level `timestamp` field (set client-side via Date.now()).
    // If two+ reports for the same patientID are saved within 5 minutes, the oldest is
    // automatically trashed — the newest copy is treated as the definitive version.
    if (rawPatientID && reportData.timestamp) {
        const DUPE_WINDOW_MS = 5 * 60 * 1000;
        const currentTime = reportData.timestamp;
        const allReportsSnap = await db.ref('scheduledReports').once('value');
        let newerDuplicate = false;      // a newer report for this patient within 5 min
        let olderDuplicate = null;       // { authorId, key, label } to trash

        if (allReportsSnap.exists()) {
            allReportsSnap.forEach((authorSnap) => {
                const aId = authorSnap.key;
                authorSnap.forEach((reportSnap) => {
                    const rKey = reportSnap.key;
                    if (rKey === key) return;
                    const r = reportSnap.val();
                    // Check ANY report (deployed or not) — the 5-min window prevents false matches
                    if (r.data?.patientID !== rawPatientID) return;
                    // Skip reports already trashed by a previous run
                    if (r.deployStatus === 'trashed_duplicate') return;

                    const rTime = r.timestamp;
                    if (!rTime) return;
                    const diff = Math.abs(currentTime - rTime);

                    if (diff < DUPE_WINDOW_MS) {
                        if (rTime > currentTime) {
                            newerDuplicate = true; // there's a newer version — this one is stale
                        } else {
                            olderDuplicate = { authorId: aId, key: rKey, label: r.originalKey || rKey };
                        }
                    }
                });
            });
        }

        // If a newer report exists within the window, this one is stale — trash it
        if (newerDuplicate) {
            console.log(`[AUTO] 🗑️ ${key} — trashing old duplicate, a newer report exists for patient ${rawPatientID}`);
            await db.ref(`scheduledReports/${authorId}/${key}`).update({
                hasdeployed: true,
                deployStatus: 'trashed_duplicate',
                deployMessage: `A newer version of this report was saved. This older copy was trashed.`,
                deployedAt: new Date().toISOString(),
                deployedBy: 'autoDeploy',
            });
            await logStep('🗑️ Removed — Duplicate', `A **newer** report exists for patient **#${rawPatientID}**. This older copy was automatically trashed.`, { color: 0xffc107, isFinal: true });
            return;
        }

        // If an older duplicate exists, trash it (this report is the newest, it'll handle the deploy)
        if (olderDuplicate) {
            console.log(`[AUTO] 🗑️ ${olderDuplicate.key} — trashing older duplicate for patient ${rawPatientID}, keeping ${key}`);
            await db.ref(`scheduledReports/${olderDuplicate.authorId}/${olderDuplicate.key}`).update({
                hasdeployed: true,
                deployStatus: 'trashed_duplicate',
                deployMessage: `Replaced by newer report ${key}.`,
                deployedAt: new Date().toISOString(),
                deployedBy: 'autoDeploy',
            });
            console.log(`[AUTO] ✅ ${key} — is the newest report for patient ${rawPatientID}, proceeding with deploy`);
        } else {
            console.log(`[AUTO] ✅ No recent duplicates found for patientID "${rawPatientID}" — proceeding`);
        }
    }

    // Determine search term: numeric = ID search, text = name search
    const isNumericId = /^\d+$/.test(rawPatientID);
    const searchTerm = isNumericId ? rawPatientID : patientName;
    const searchIcon = isNumericId ? `🔢` : `👤`;
    console.log(`[AUTO] ${searchIcon} Searching by ${isNumericId ? 'patientID' : 'name'}: "${searchTerm}"`);

    const client = getForumClient();
    await logStep('🌐 Opening browser...', `Logging into PHMC forum...`);
    await client.login(null, null, { force: true, baseUrl: process.env.FORUM_BASE_URL });

    await logStep('🔍 Searching...', `Looking for thread by **${isNumericId ? 'patient ID' : 'name'}**: \`${searchTerm}\``);

    // Step 1: Search for existing patient thread
    await setDeployStatus(db, authorId, key, 'searching', `Looking for thread by ${isNumericId ? 'ID' : 'name'}: ${searchTerm}...`);
    const { topicId, title: foundTitle } = await client.searchForPatientTopic(searchTerm);

    if (!topicId) {
        console.log(`[AUTO] 📭 No existing thread found for "${searchTerm}"`);
        await setDeployStatus(db, authorId, key, 'topic_not_found', `No thread found for ${searchTerm}. Please create one manually on the forum, then re-save.`);
        await logStep('📭 Topic Not Found', `**\`${searchTerm}\`** — no matching thread exists.\nCreate the patient thread manually on the forum, then save the report again.`, { color: 0xffc107, isFinal: true });
        return;
    }

    // Step 2: Topic found — reply
    console.log(`[AUTO] ✅ Topic found: #${topicId} — "${foundTitle}"`);
    await setDeployStatus(db, authorId, key, 'replying', `Found topic #${topicId}. ${DRY_REPLY ? 'Filling form (dry run — will not submit)' : 'Posting reply...'}`);
    await logStep('✅ Topic Found', `**#${topicId}:** ${foundTitle}\n${DRY_REPLY ? '🔍 Dry run — form will not be submitted' : '📤 Submitting reply...'}`, { color: DRY_REPLY ? 0xffc107 : 0x28a745 });

    const result = await client.replyToTopic(topicId, 97, bbCode, { dryRun: DRY_REPLY });

    if (result.ok && !result.dryRun) {
        const label = reportData.originalKey || key;
        const completed = await markReportComplete(db, authorId, key, label, 'medical-record', result.url);
        if (completed) {
            await logStep('✅ Reply Posted', `[View Reply](<${result.url}>)`, { color: 0x28a745, isFinal: true });
        } else {
            await logStep('⚠️ Reply Posted But Status Update Failed', `Reply was posted at [View Reply](<${result.url}>) but the Firebase status update did not verify. The report may be retried on next restart.`, { color: 0xffc107, isFinal: true });
        }
    } else if (result.dryRun) {
        await setDeployStatus(db, authorId, key, 'dry_run', `Form filled for topic #${topicId} but NOT submitted. Set DRY_REPLY=false to enable.`);
        console.log(`[AUTO] 🏜️ Dry run — form filled for topic #${topicId}`);
        await logStep('🏜️ Dry Run Complete', `**#${topicId}:** ${foundTitle}\nForm filled but **not submitted**. Set \`DRY_REPLY=false\` in .env to enable.`, { color: 0xffc107, isFinal: true });
    } else {
        await setDeployStatus(db, authorId, key, 'reply_failed', result.reason || 'Unknown error replying to topic');
        console.error(`[AUTO] ❌ Failed to reply to topic #${topicId}: ${result.reason || 'Unknown'}`);
        await logStep('❌ Reply Failed', `**Topic #${topicId}:** ${result.reason || 'Unknown error'}`, { color: 0xdc3545, isFinal: true });
    }
}

/**
 * Mark a report as deployed in Firebase.
 */
async function markDeployed(db, authorId, key, success, extra = {}) {
    const updates = {
        hasdeployed: success,
        deployedAt: new Date().toISOString(),
        deployedBy: 'autoDeploy',
        // Clear any retry queue fields if this was a retry
        retryAt: null,
        deployStatus: success ? 'deployed' : 'failed_permanent',
        ...extra,
    };
    await db.ref(`scheduledReports/${authorId}/${key}`).update(updates);
}

/**
 * Write a deploy status message to the report in Firebase.
 * The web app reads this to show feedback in the UI.
 */
async function setDeployStatus(db, authorId, key, status, message) {
    await db.ref(`scheduledReports/${authorId}/${key}`).update({
        deployStatus: status,
        deployMessage: message,
        deployCheckedAt: new Date().toISOString(),
    });
}

/**
 * Mark a report as completed and send a clear completion webhook.
 * Verifies the write succeeded and logs the outcome.
 * Use this from all handlers instead of calling markDeployed directly.
 *
 * @param {object} db - Firebase ref
 * @param {string} authorId
 * @param {string} key - Report key
 * @param {string} label - Human-readable label (form title or key)
 * @param {string} type - Deploy type ('pm', 'topic', 'medical-record')
 * @param {string} [resultUrl] - URL of the deployed content (optional)
 * @returns {Promise<boolean>} true if marked successfully
 */
async function markReportComplete(db, authorId, key, label, type, resultUrl) {
    try {
        // Mark the report as deployed in Firebase with clearing of retry fields
        await markDeployed(db, authorId, key, true);

        // Verify the write persisted by reading back hasdeployed
        const verifySnap = await db.ref(`scheduledReports/${authorId}/${key}/hasdeployed`).once('value');
        const hasdeployed = verifySnap.val();

        if (hasdeployed !== true) {
            console.error(`[AUTO] ❌ ${key} — markDeployed verification FAILED: hasdeployed=${hasdeployed}`);
            return false;
        }

        // Also write the final deploy status
        await setDeployStatus(db, authorId, key, 'deployed', `Successfully deployed to ${type}.`);

        console.log(`[AUTO] ✅ ${key} — marked as COMPLETED (hasdeployed=${hasdeployed}), removing from queue.`);

        // Send a clear completion webhook
        await sendWebhook(null, {
            title: '✅ Report Complete — Removed from Queue',
            description: `**Report:** ${label}\n**Key:** \`${key}\`\n**Type:** ${type}${resultUrl ? `\n**URL:** ${resultUrl}` : ''}\n\n✅ Successfully marked as \`hasdeployed: true\` in Firebase and removed from the deploy queue.`,
            color: 0x28a745,
            footer: { text: 'PHMC Bot — Auto Deploy' },
            timestamp: new Date().toISOString(),
        });

        return true;
    } catch (err) {
        console.error(`[AUTO] ❌ ${key} — FAILED to mark as completed: ${err.message}`);
        try {
            await sendWebhook(null, {
                title: '⚠️ Report Deployed But Status Write Failed',
                description: `**Report:** ${label}\n**Key:** \`${key}\`\n**Error:** ${err.message.slice(0, 300)}\n\nThe reply was posted but **could not be marked as completed** in Firebase. The report may be re-processed on next restart.`,
                color: 0xffc107,
                footer: { text: 'PHMC Bot — Auto Deploy' },
                timestamp: new Date().toISOString(),
            });
        } catch { /* best effort */ }
        return false;
    }
}

// ── Firebase Path Migration ──

const OLD_PATHS = {
    reports: 'testingSavedReports',
    bbcode: 'testingSavedReportBBCode',
};
const NEW_PATHS = {
    reports: 'scheduledReports',
    bbcode: 'scheduledReportsBBCode',
};

/**
 * One-time migration from old Firebase paths (testingSavedReports) to new (scheduledReports).
 * Runs at startup. Copies all data from old paths to new paths, then deletes old paths.
 * Safe to re-run — if new path already has data, it skips that key.
 */
async function migratePaths(db) {
    const migrated = { reports: 0, bbcode: 0 };

    for (const [key, oldPath] of Object.entries(OLD_PATHS)) {
        const newPath = NEW_PATHS[key];
        try {
            const oldSnap = await db.ref(oldPath).once('value');
            if (!oldSnap.exists()) continue;

            // Check if new path already exists (already migrated)
            const newSnap = await db.ref(newPath).once('value');
            const newData = newSnap.val();

            const updates = {};
            oldSnap.forEach((authorSnap) => {
                const authorId = authorSnap.key;
                authorSnap.forEach((reportSnap) => {
                    const reportKey = reportSnap.key;
                    // Skip if already at new path
                    if (newData?.[authorId]?.[reportKey]) return;
                    updates[`${newPath}/${authorId}/${reportKey}`] = reportSnap.val();
                    migrated[key]++;
                });
            });

            if (Object.keys(updates).length > 0) {
                await db.ref().update(updates);
                console.log(`[AUTO] 📦 Migrated ${migrated[key]} entries from ${oldPath} to ${newPath}`);
            }

            // Remove old path now that data is copied
            await db.ref(oldPath).remove();
            console.log(`[AUTO] 🗑️ Removed old path: ${oldPath}`);
        } catch (err) {
            console.error(`[AUTO] ⚠️ Migration error for ${oldPath}: ${err.message}`);
        }
    }

    if (migrated.reports || migrated.bbcode) {
        console.log(`[AUTO] ✅ Migration complete — ${migrated.reports} reports, ${migrated.bbcode} BBCodes moved`);
    }
}

// ── Cleanup Old Deployed Reports ──

const CLEANUP_AFTER_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Delete reports that have been deployed for over 24 hours.
 * Keeps the scheduledReports path clean.
 */
async function cleanupOldDeployed(db) {
    const cutoff = Date.now() - CLEANUP_AFTER_MS;
    let deleted = 0;

    try {
        const snap = await db.ref('scheduledReports').once('value');
        if (!snap.exists()) return 0;

        const updates = {};
        snap.forEach((authorSnap) => {
            const authorId = authorSnap.key;
            authorSnap.forEach((reportSnap) => {
                const report = reportSnap.val();
                if (report.hasdeployed === true) {
                    const deployedAt = new Date(report.deployedAt || report.timestamp || 0).getTime();
                    if (deployedAt > 0 && deployedAt < cutoff) {
                        const key = reportSnap.key;
                        updates[`scheduledReports/${authorId}/${key}`] = null;
                        updates[`scheduledReportsBBCode/${authorId}/${key}`] = null;
                        deleted++;
                    }
                }
            });
        });

        if (Object.keys(updates).length > 0) {
            await db.ref().update(updates);
            console.log(`[AUTO] 🧹 Cleaned up ${deleted} old deployed report(s)`);
        }
    } catch (err) {
        console.error(`[AUTO] ⚠️ Cleanup error: ${err.message}`);
    }

    return deleted;
}

/**
 * Periodically scan for reports in retry_queued status whose retryAt time has passed.
 * Re-enqueues them by updating Firebase status and removing from knownReportKeys
 * so the value listener picks them up.
 */
async function checkRetryQueue() {
    const db = _dbRef;
    if (!db) return;

    console.log(`[AUTO] 🔍 Checking retry queue...`);

    try {
        const snap = await db.ref('scheduledReports').once('value');
        if (!snap.exists()) {
            console.log(`[AUTO] ✅ No reports in retry queue`);
            return;
        }

        const toRequeue = [];

        snap.forEach((authorSnap) => {
            const authorId = authorSnap.key;
            authorSnap.forEach((reportSnap) => {
                const reportKey = reportSnap.key;
                const reportData = reportSnap.val();

                // Only process retry_queued items whose retryAt has passed
                if (reportData.deployStatus !== 'retry_queued') return;
                if (!reportData.retryAt) return;

                const retryTime = new Date(reportData.retryAt).getTime();
                if (retryTime > Date.now()) return;

                toRequeue.push({ authorId, reportKey, reportData });
            });
        });

        if (toRequeue.length === 0) {
            console.log(`[AUTO] ✅ No reports ready for retry`);
            return;
        }

        console.log(`[AUTO] 🔄 Found ${toRequeue.length} report(s) ready for retry, re-queueing...`);

        for (const { authorId, reportKey, reportData } of toRequeue) {
            try {
                // Update Firebase to clear retry status so value listener picks it up fresh
                await db.ref(`scheduledReports/${authorId}/${reportKey}`).update({
                    deployStatus: 'queued',
                    deployMessage: `Re-queued for retry at ${new Date().toISOString()}`,
                    deployCheckedAt: new Date().toISOString(),
                });

                // Remove from knownReportKeys so the value listener will pick it up
                if (knownReportKeys) knownReportKeys.delete(reportKey);

                console.log(`[AUTO] 🔄 ${reportData.originalKey || reportKey} — re-queued for deployment`);
            } catch (err) {
                console.error(`[AUTO] ⚠️ Failed to re-queue ${reportKey}: ${err.message}`);
            }
        }

        console.log(`[AUTO] ✅ Retry queue processed — ${toRequeue.length} report(s) re-queued`);
    } catch (err) {
        console.error(`[AUTO] ⚠️ Retry queue check error: ${err.message}`);
    }
}

// ── Firebase Listener ──

/**
 * Start listening to Firebase for new undeployed reports.
 * Called once on bot startup.
 */
export function startAutoDeploy() {
    firebase.init();
    const db = firebase.db;
    _dbRef = db;

    console.log('[AUTO] 🔍 Starting auto-deploy listener...');

    // ── Check persisted maintenance state ──
    db.ref(MAINTENANCE_PATH).once('value', (snap) => {
        _maintenanceMode = snap.val() === true;
        if (_maintenanceMode) {
            console.log('[AUTO] ⏸️ Maintenance mode was ON (persisted) — queue paused');
            sendWebhook(null, {
                title: '⏸️ Bot Started in Maintenance Mode',
                description: 'Auto-deploy queue is paused. Use `/maintenance off` to resume.',
                color: 0xffc107,
            });
        } else {
            console.log('[AUTO] ✅ No maintenance flag — queue active');
        }
    });

    // ── Startup notification ──
    sendWebhook(null, {
        title: '🤖 Bot Online',
        description: _maintenanceMode ? 'Maintenance mode active — queue paused.' : 'Auto-deploy listener active.',
        color: _maintenanceMode ? 0xffc107 : 0x28a745,
        footer: { text: `PHMC Bot — ${new Date().toLocaleString()}` },
    });

    // ── Migrate old path names to new (one-time, removes old data) ──
    migratePaths(db);

    // ── Cleanup old deployed reports (startup + every 6 hours) ──
    cleanupOldDeployed(db);
    setInterval(() => cleanupOldDeployed(db), 6 * 60 * 60 * 1000);

    // ── Check retry queue on startup and every 30 minutes ──
    // Picks up reports with retry_queued status whose retryAt has passed
    checkRetryQueue();
    setInterval(() => checkRetryQueue(), RETRY_CHECK_INTERVAL_MS);

    // ── Start passive CK listener on newSavedReports ──
    // Monitors opted-out users' reports for CKs and drafts death records
    // when a morgue match is found.
    try {
        import('./deathRecordDraft.js').then(({ startCKListener }) => {
            startCKListener(db);
        }).catch((err) => console.warn('[AUTO] ⚠️ Failed to start CK listener:', err.message));
    } catch (err) {
        console.warn('[AUTO] ⚠️ Could not start CK listener:', err.message);
    }

    // ── Start morgue listener (auto-match pending drafts) ──
    try {
        import('./deathRecordDraft.js').then(({ startMorgueListener }) => {
            startMorgueListener(db);
        }).catch((err) => console.warn('[AUTO] ⚠️ Failed to start morgue listener:', err.message));
    } catch (err) {
        console.warn('[AUTO] ⚠️ Could not start morgue listener:', err.message);
    }

    // ── Listen for new reports at scheduledReports ──
    // Using on('value') because child_added only fires for NEW top-level children (authors),
    // not for reports added under EXISTING authors. value fires on any change.
    knownReportKeys = new Set();
    const CK_EPOCH = 1782864000000; // 2026-07-01T00:00:00Z — reports saved before this are skipped for CK drafting
    console.log(`[AUTO] ⏳ CK drafting: skipping reports saved before 01/JUL/2026`);
    db.ref('scheduledReports').on('value', (snap) => {
        snap.forEach((authorSnap) => {
            const authorId = authorSnap.key;
            authorSnap.forEach((reportSnap) => {
                const reportKey = reportSnap.key;
                if (knownReportKeys.has(reportKey)) return;

                const reportData = reportSnap.val();
                if (reportData.hasdeployed !== false) {
                    knownReportKeys.add(reportKey);
                    return;
                }

                knownReportKeys.add(reportKey);
                console.log(`[AUTO] 📥 ${reportData.originalKey || reportKey}`);

                const item = {
                    authorId,
                    key: reportKey,
                    report: reportData,
                    db,
                };

                if (reportData.formId === 'coroner_email') {
                    enqueue('pm', item);
                } else if (['death_record', 'mass-ftality-test', 'coroner-report', 'autopsy'].includes(reportData.formId)) {
                    enqueue('topic', item);
                } else if (reportData.formId === 'patient_notes') {
                    enqueue('medical-record', item);
                }

                // ── Passive CK check (death record drafting) ──
                // Only for NEW reports (saved after bot startup) to avoid re-processing
                // legacy records. Silently checks morgue and drafts if matched.
                if (reportData.timestamp && reportData.timestamp >= _autoDeployStartupTime) {
                    if (reportData.formId === 'coroner-report' || reportData.formId === 'mass-ftality-test') {
                        import('./deathRecordDraft.js').then(({ passivCKCheck }) => {
                            passivCKCheck(db, authorId, reportKey, reportData)
                                .catch((err) => console.error(`[AUTO] ⚠️ Passive CK error for ${reportKey}:`, err.message));
                        }).catch(() => {});
                    }
                }
            });
        });
    });

    // ── Secondary listener for old path (compat until web app deploys) ──
    // If the web app hasn't been rebuilt, saves still go to testingSavedReports.
    // This listener catches those and routes them into the same queue.
    db.ref('testingSavedReports').on('value', (snap) => {
        snap.forEach((authorSnap) => {
            const authorId = authorSnap.key;
            authorSnap.forEach((reportSnap) => {
                const reportKey = reportSnap.key;
                if (knownReportKeys.has(reportKey)) return;

                const reportData = reportSnap.val();
                if (reportData.hasdeployed !== false) {
                    knownReportKeys.add(reportKey);
                    return;
                }

                knownReportKeys.add(reportKey);
                console.log(`[AUTO] 📥 (legacy path) ${reportData.originalKey || reportKey}`);

                const item = { authorId, key: reportKey, report: reportData, db };

                if (reportData.formId === 'coroner_email') {
                    enqueue('pm', item);
                } else if (['death_record', 'mass-ftality-test', 'coroner-report', 'autopsy'].includes(reportData.formId)) {
                    enqueue('topic', item);
                } else if (reportData.formId === 'patient_notes') {
                    enqueue('medical-record', item);
                }
            });
        });
    });

    console.log('[AUTO] ✅ Auto-deploy listener active.');
}
