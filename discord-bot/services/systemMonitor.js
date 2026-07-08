/**
 * System Monitor Service — runs periodic health checks and cleanup tasks
 * that were previously handled by Firebase Cloud Functions.
 *
 * Wired into index.js on bot startup.
 * Runs on a 3-hour cycle: health check → morgue check → data cleanup.
 */

import firebase from './firebase.js';
import { sendLogMessage } from './logChannel.js';

async function sendWebhook(content, embed) {
    try {
        await sendLogMessage(content, embed);
    } catch (err) {
        console.error('[MONITOR] ⚠️ Webhook send failed:', err.message);
    }
}

// ── Cloudflare Status Check ──

async function checkCloudflare(db, previousState) {
    const alerts = [];
    const updates = {};

    try {
        const cfResponse = await fetch('https://www.cloudflarestatus.com/api/v2/summary.json');
        if (!cfResponse.ok) return { alerts, updates };

        const cfData = await cfResponse.json();
        const currentIndicator = cfData.status.indicator;
        const currentDescription = cfData.status.description;
        console.log(`[MONITOR] Cloudflare: ${currentIndicator} — ${currentDescription}`);

        // Find active (non-resolved) incidents
        const activeIncident = cfData.incidents?.find(i => {
            const isResolved = i.status === 'resolved' || i.status === 'postmortem';
            return !isResolved;
        });

        let alertTriggered = false;

        if (activeIncident) {
            const lastUpdateId = previousState.cloudflare?.lastUpdateId;
            const latestUpdate = activeIncident.incident_updates?.[0];

            if (latestUpdate && latestUpdate.id !== lastUpdateId) {
                alerts.push({
                    title: `⚠️ Cloudflare: ${activeIncident.name}`,
                    description: `**${latestUpdate.status}**: ${latestUpdate.body}`,
                    color: 0xF1C40F,
                });
                updates.cloudflare = {
                    indicator: currentIndicator,
                    description: currentDescription,
                    activeIncidentId: activeIncident.id,
                    lastUpdateId: latestUpdate.id,
                    lastChecked: Date.now(),
                };
                alertTriggered = true;
            }
        }

        if (!alertTriggered) {
            if (currentIndicator !== 'none' && currentIndicator !== previousState.cloudflare?.indicator) {
                alerts.push({
                    title: '⚠️ Cloudflare Status Changed',
                    description: `Status changed to **${currentDescription}** (${currentIndicator})`,
                    color: 0xF1C40F,
                });
                updates.cloudflare = {
                    indicator: currentIndicator,
                    description: currentDescription,
                    lastChecked: Date.now(),
                };
            } else if (currentIndicator === 'none' && previousState.cloudflare?.indicator !== 'none') {
                alerts.push({
                    title: '✅ Cloudflare Status Resolved',
                    description: 'All Cloudflare systems are operational.',
                    color: 0x00FF00,
                });
                updates.cloudflare = {
                    indicator: 'none',
                    description: 'All Systems Operational',
                    lastChecked: Date.now(),
                };
            }
        }
    } catch (err) {
        console.error('[MONITOR] Cloudflare check error:', err.message);
    }

    return { alerts, updates };
}

// ── GTA World UCP Latency Check ──

async function checkGtawUcp(db, previousState) {
    const alerts = [];
    const updates = {};
    const LATENCY_THRESHOLD = 30000; // 30 seconds

    try {
        const start = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45000);

        const response = await fetch('https://ucp.gta.world/', {
            method: 'GET',
            headers: { 'User-Agent': 'PHMC-Tools/HealthCheck' },
            signal: controller.signal,
        });
        clearTimeout(timeout);

        const latency = Date.now() - start;
        const isSlow = latency > LATENCY_THRESHOLD;
        const currentStatus = isSlow ? 'slow' : 'normal';

        console.log(`[MONITOR] GTAW UCP: ${latency}ms (${currentStatus})`);

        if (isSlow && previousState.gtaw?.status !== 'slow') {
            alerts.push({
                title: '🐢 GTA World UCP High Latency',
                description: `UCP is responding slowly. Latency: **${latency}ms** (Threshold: ${LATENCY_THRESHOLD}ms)`,
                color: 0xE67E22,
            });
        } else if (!isSlow && previousState.gtaw?.status === 'slow') {
            alerts.push({
                title: '🚀 GTA World UCP Latency Normal',
                description: `UCP latency returned to normal (${latency}ms).`,
                color: 0x00FF00,
            });
        }

        updates.gtaw = { status: currentStatus, lastLatency: latency, lastChecked: Date.now() };
    } catch (err) {
        console.error('[MONITOR] GTAW UCP check error:', err.message);
        if (previousState.gtaw?.status !== 'error') {
            alerts.push({
                title: '🔴 GTA World UCP Unreachable',
                description: `Failed to reach UCP. Error: ${err.message}`,
                color: 0xFF0000,
            });
            updates.gtaw = { status: 'error', lastError: err.message, lastChecked: Date.now() };
        }
    }

    return { alerts, updates };
}

// ── Forum Latency Check ──
// Uses the Playwright browser (via ForumClient) so Cloudflare JS challenges
// are executed naturally — gives an accurate picture of true forum availability.
// Runs on the 60-min health cycle; dashboard reads cached results from Firebase.

const FORUM_URLS = [
    { name: 'PHMC', url: process.env.FORUM_BASE_URL  || 'https://phmc.gta.world' },
    { name: 'LSPD', url: process.env.FORUM_LSPD_URL  || 'https://lspd.gta.world' },
    { name: 'LSSD', url: process.env.FORUM_LSSD_URL  || 'https://lssd.gta.world' },
];

async function checkForumLatency() {
    console.log('[MONITOR] 🔍 Checking forum latency (browser-based)...');

    // Import lazily — ForumClient may not be loaded yet
    const { getForumClient } = await import('./forumClient.js');
    const client = getForumClient();

    const results = [];
    for (const forum of FORUM_URLS) {
        try {
            const result = await client.checkHealth(forum.url);
            const latency = result.latency;
            const label = result.status;
            const emoji = label === 'Good' ? '✅' : label === 'Bad' ? '⚠️' : '🔴';
            const color = label === 'Good' ? 0x28a745 : label === 'Bad' ? 0xffc107 : 0xdc3545;

            console.log(`[MONITOR] ${forum.name}: ${latency !== null ? latency + 'ms' : 'N/A'} (${label})${label !== 'Good' ? ' — ' + result.details : ''}`);
            results.push({ name: forum.name, latency, status: label, emoji, color, details: result.details });
        } catch (err) {
            console.log(`[MONITOR] ${forum.name}: Error (${err.message})`);
            results.push({ name: forum.name, latency: null, status: 'Unresponsive', emoji: '🔴', color: 0xdc3545 });
        }
    }
    return results;
}

// ── Morgue Overdue Check ──

async function checkMorgueOverdue(db) {
    console.log('[MONITOR] 🔍 Checking morgue update status...');

    try {
        const snapshot = await db.ref('morgue-records')
            .orderByChild('lastUpdated')
            .limitToLast(1)
            .once('value');

        if (!snapshot.exists()) {
            console.log('[MONITOR] No morgue records found.');
            return;
        }

        let latest = 0;
        snapshot.forEach(child => { latest = child.val().lastUpdated || 0; });

        if (!latest) {
            console.log('[MONITOR] No valid lastUpdated timestamps.');
            return;
        }

        const now = Date.now();
        if (now - latest <= 24 * 60 * 60 * 1000) {
            console.log('[MONITOR] Morgue is up to date.');
            return;
        }

        // Cooldown: only notify once every 6 hours
        const monitorSnap = await db.ref('monitoring/morgueUpdate').once('value');
        const lastNotified = monitorSnap.val()?.lastNotified || 0;
        if (now - lastNotified < 6 * 60 * 60 * 1000) {
            console.log('[MONITOR] Morgue already notified recently, skipping.');
            return;
        }

        const hoursOverdue = Math.floor((now - latest) / (1000 * 60 * 60));

        await sendWebhook('<@228306972204597248>', {
            title: '⚠️ Morgue Database Update Overdue',
            color: 0xe74c3c,
            description: 'The morgue database has not been updated in over 24 hours.',
            fields: [
                { name: 'Last Update', value: new Date(latest).toLocaleString(), inline: true },
                { name: 'Hours Overdue', value: `${hoursOverdue}h`, inline: true },
                { name: 'Timestamp', value: new Date().toLocaleString(), inline: false },
            ],
            footer: { text: 'PHMC Bot — Morgue Monitor' },
            timestamp: new Date().toISOString(),
        });

        await db.ref('monitoring/morgueUpdate').set({ lastNotified: now });
        console.log('[MONITOR] ✅ Morgue overdue notification sent.');
    } catch (err) {
        console.error('[MONITOR] Morgue check error:', err.message);
    }
}

// ── Data Cleanup ──

async function cleanupOldData(db) {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    let cleaned = 0;

    // 1. Clean up old monitoring data (> 1 day)
    try {
        const monitoringSnap = await db.ref('monitoring').once('value');
        if (monitoringSnap.exists()) {
            const updates = {};
            monitoringSnap.forEach(child => {
                const key = child.key;
                // Skip morgueUpdate — it has its own cooldown tracking
                if (key === 'morgueUpdate') return;
                const entry = child.val();
                if (entry.lastChecked && entry.lastChecked < oneDayAgo) {
                    updates[`monitoring/${key}`] = null;
                    cleaned++;
                }
            });
            if (Object.keys(updates).length > 0) {
                await db.ref().update(updates);
                console.log(`[MONITOR] 🧹 Cleaned ${cleaned} old monitoring entries.`);
            }
        }
    } catch (err) {
        console.error('[MONITOR] Monitoring cleanup error:', err.message);
    }

    // 2. Clean up old webhook logs (> 30 days)
    try {
        const webhookSnap = await db.ref('webhook_logs').once('value');
        let wlCleaned = 0;
        if (webhookSnap.exists()) {
            const updates = {};
            webhookSnap.forEach(child => {
                const entry = child.val();
                if (entry.timestamp && entry.timestamp < thirtyDaysAgo) {
                    updates[`webhook_logs/${child.key}`] = null;
                    wlCleaned++;
                }
            });
            if (Object.keys(updates).length > 0) {
                await db.ref().update(updates);
                console.log(`[MONITOR] 🧹 Cleaned ${wlCleaned} old webhook log entries.`);
            }
        }
    } catch (err) {
        console.error('[MONITOR] Webhook log cleanup error:', err.message);
    }
}

// ── Main Health Check Runner ──

export async function runHealthCheck(db) {
    console.log('[MONITOR] 🔍 Running system health checks...');

    const monitoringRef = db.ref('monitoring');
    const snapshot = await monitoringRef.once('value');
    const previousState = snapshot.val() || {};

    // Run checks in parallel
    const [cfResult, gtawResult, forumResults] = await Promise.all([
        checkCloudflare(db, previousState),
        checkGtawUcp(db, previousState),
        checkForumLatency(),
    ]);

    const allAlerts = [...cfResult.alerts, ...gtawResult.alerts];
    const allUpdates = { ...cfResult.updates, ...gtawResult.updates };

    // Save forum results to Firebase (dashboard reads from here)
    const forumState = {};
    for (const f of forumResults) {
        forumState[f.name] = { status: f.status, latency: f.latency, lastChecked: Date.now() };
    }
    allUpdates.forums = forumState;

    // Persist state
    if (Object.keys(allUpdates).length > 0) {
        await monitoringRef.update(allUpdates);
    }

    // Dashboard handles all display — no redundant webhook needed
    if (allAlerts.length > 0) {
        console.log(`[MONITOR] ${allAlerts.length} alert(s) detected (logged to Firebase for dashboard).`);
    }
}

// ── Startup ──

export function startSystemMonitor() {
    firebase.init();
    const db = firebase.db;

    console.log('[MONITOR] ✅ System monitor active (3-hour cycle).');

    // Run immediately on startup
    const runAll = async () => {
        try {
            await runHealthCheck(db);
        } catch (err) {
            console.error('[MONITOR] Health check error:', err.message);
        }

        try {
            await checkMorgueOverdue(db);
        } catch (err) {
            console.error('[MONITOR] Morgue check error:', err.message);
        }

        try {
            await cleanupOldData(db);
        } catch (err) {
            console.error('[MONITOR] Cleanup error:', err.message);
        }
    };

    // Run now, then every 3 hours
    runAll();
    setInterval(runAll, 3 * 60 * 60 * 1000);
}
