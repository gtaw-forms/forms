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

// ── System Resource Check ──

async function checkSystemResources() {
    const alerts = [];
    try { const { execSync } = await import('child_process');
        // CPU load (1-minute average as percentage of total cores)
        const loadAvg = execSync('cat /proc/loadavg | cut -d" " -f1').toString().trim();
        const cpuCores = execSync('nproc').toString().trim();
        const loadPct = (parseFloat(loadAvg) / parseInt(cpuCores)) * 100;

        // Memory usage percentage
        const memInfo = execSync("free | awk '/Mem:/ {printf \"%.1f\", $3/$2 * 100}'").toString().trim();
        const memPct = parseFloat(memInfo);

        // Disk usage percentage on root
        const diskInfo = execSync("df / | awk 'NR==2 {gsub(/%/,\"\"); print $5}'").toString().trim();
        const diskPct = parseInt(diskInfo);

        console.log(`[MONITOR] System: CPU=${loadPct.toFixed(1)}%  RAM=${memPct.toFixed(1)}%  DISK=${diskPct}%`);

        if (loadPct > 80) alerts.push({ title: '🔴 High CPU Load', description: `CPU at **${loadPct.toFixed(1)}%** (load avg: ${loadAvg}, cores: ${cpuCores})`, color: 0xe74c3c });
        if (memPct > 85) alerts.push({ title: '🔴 High Memory Usage', description: `RAM at **${memPct.toFixed(1)}%**`, color: 0xe67e22 });
        if (diskPct > 90) alerts.push({ title: '🔴 Low Disk Space', description: `Disk at **${diskPct}%**`, color: 0xe74c3c });
    } catch (err) { console.warn('[MONITOR] System resource check failed:', err.message); }
    return alerts;
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

    // Run all forum checks in parallel to reduce wall-clock time and browser churn
    const results = await Promise.all(FORUM_URLS.map(async (forum) => {
        try {
            const result = await client.checkHealth(forum.url);
            const latency = result.latency;
            const label = result.status;
            const emoji = label === 'Good' ? '✅' : label === 'Bad' ? '⚠️' : '🔴';
            const color = label === 'Good' ? 0x28a745 : label === 'Bad' ? 0xffc107 : 0xdc3545;

            console.log(`[MONITOR] ${forum.name}: ${latency !== null ? latency + 'ms' : 'N/A'} (${label})${label !== 'Good' ? ' — ' + result.details : ''}`);
            return { name: forum.name, latency, status: label, emoji, color, details: result.details };
        } catch (err) {
            console.log(`[MONITOR] ${forum.name}: Error (${err.message})`);
            return { name: forum.name, latency: null, status: 'Unresponsive', emoji: '🔴', color: 0xdc3545 };
        }
    }));
    return results;
}

// ── Morgue Overdue Check ──

async function checkMorgueOverdue(db) {
    const MORGUE_OVERDUE_HOURS = 48;
    const MORGUE_OVERDUE_MS = MORGUE_OVERDUE_HOURS * 60 * 60 * 1000;
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
        if (now - latest <= MORGUE_OVERDUE_MS) {
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
            description: `The morgue database has not been updated in over ${MORGUE_OVERDUE_HOURS} hours.`,
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

// ── Overdue Autopsy Check ──

// CK and PK requests get different wait windows: CKs are fast-tracked (up to 3
// days), PKs get longer (up to 5 days). Requests without a parsed type fall back
// to AUTOPSY_OVERDUE_HOURS.
const hours = (name, def) => {
    const v = parseFloat(process.env[name] || '');
    return Number.isFinite(v) && v > 0 ? v : def;
};
const OVERDUE_DEFAULT_HOURS = hours('AUTOPSY_OVERDUE_HOURS', 48);
const OVERDUE_CK_HOURS = hours('AUTOPSY_OVERDUE_HOURS_CK', 72);
const OVERDUE_PK_HOURS = hours('AUTOPSY_OVERDUE_HOURS_PK', 120);

async function checkOverdueAutopsies(db) {
    console.log(`[MONITOR] 🔍 Checking for overdue autopsies (CK>${OVERDUE_CK_HOURS}h, PK>${OVERDUE_PK_HOURS}h, other>${OVERDUE_DEFAULT_HOURS}h)...`);

    const thresholdHoursFor = (v) => {
        const type = String(v.parsed?.deathType || '').toLowerCase();
        if (type.includes('ck')) return OVERDUE_CK_HOURS;
        if (type.includes('pk')) return OVERDUE_PK_HOURS;
        return OVERDUE_DEFAULT_HOURS;
    };

    try {
        const snap = await db.ref('autopsy-requested').once('value');
        if (!snap.exists()) return;

        const now = Date.now();
        const FINAL_STATES = new Set(['complete', 'dry_run', 'skipped', 'cancelled', 'denied']);
        const overdue = [];

        snap.forEach((child) => {
            const v = child.val() || {};
            if (v.wasMatch === false && !v.name) return;
            if (v.completedAt) return;
            if (FINAL_STATES.has(String(v.caseState || '').toLowerCase())) return;
            const detected = v.detectedAt ? new Date(v.detectedAt).getTime() : 0;
            if (!detected) return;
            const limitHours = thresholdHoursFor(v);
            if (now - detected <= limitHours * 60 * 60 * 1000) return;
            overdue.push({
                name: v.name || child.key,
                assignedTo: v.assignedTo || '',
                state: v.caseState || 'detected',
                since: detected,
                caseNum: v.caseNum || '',
                type: String(v.parsed?.deathType || '').trim() || '?',
                limitHours,
            });
        });

        if (overdue.length === 0) {
            console.log('[MONITOR] No overdue autopsies.');
            return;
        }

        // Cooldown — alert at most once per 6 hours while cases remain overdue.
        const cdSnap = await db.ref('monitoring/autopsyOverdue').once('value');
        const lastNotified = cdSnap.val()?.lastNotified || 0;
        if (now - lastNotified < 6 * 60 * 60 * 1000) {
            console.log('[MONITOR] Overdue autopsies already notified recently, skipping.');
            return;
        }

        overdue.sort((a, b) => a.since - b.since);
        const lines = overdue.slice(0, 10).map((o) => {
            const days = Math.floor((now - o.since) / 86400000);
            const since = new Date(o.since).toISOString().slice(0, 10);
            return `• ${o.name}${o.assignedTo ? ` → ${o.assignedTo}` : ' (unassigned)'} [${o.type}] — ${o.state} — since ${since} (${days}d, limit ${o.limitHours}h)${o.caseNum ? ` — Case #${o.caseNum}` : ''}`;
        }).join('\n');

        const ownerPing = process.env.BOT_OWNER_ID ? `<@${process.env.BOT_OWNER_ID}>` : '<@228306972204597248>';

        await sendWebhook(ownerPing, {
            title: '⚠️ Overdue Autopsy Requests',
            color: 0xe74c3c,
            description: `**${overdue.length} autopsy request(s)** are past their wait window and may need investigation. (CK limit: ${OVERDUE_CK_HOURS}h · PK limit: ${OVERDUE_PK_HOURS}h)`,
            fields: [
                { name: 'Overdue Cases', value: lines.length > 1024 ? lines.slice(0, 1024) : lines, inline: false },
            ],
            footer: { text: 'PHMC Bot — Autopsy Monitor' },
            timestamp: new Date().toISOString(),
        });

        await db.ref('monitoring/autopsyOverdue').set({ lastNotified: now, count: overdue.length });
        console.log(`[MONITOR] ✅ Overdue autopsy notification sent (${overdue.length} cases).`);
    } catch (err) {
        console.error('[MONITOR] Overdue autopsy check error:', err.message);
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
    const [sysAlerts, cfResult, gtawResult, forumResults] = await Promise.all([
        checkSystemResources(),
        checkCloudflare(db, previousState),
        checkGtawUcp(db, previousState),
        checkForumLatency(),
    ]);

    const allAlerts = [...sysAlerts, ...cfResult.alerts, ...gtawResult.alerts];
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

    // Send high-severity alerts (CPU/memory/disk) to Discord immediately
    for (const alert of allAlerts) {
        try {
            await sendLogMessage('', {
                title: alert.title,
                color: alert.color || 0xf1c40f,
                description: alert.description,
                footer: { text: 'PHMC Bot — System Monitor' },
                timestamp: new Date().toISOString(),
            });
        } catch (err) {
            console.error(`[MONITOR] Failed to send alert webhook: ${err.message}`);
        }
    }

    if (allAlerts.length > 0) {
        console.log(`[MONITOR] ${allAlerts.length} alert(s) detected and sent to Discord.`);
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
            await checkOverdueAutopsies(db);
        } catch (err) {
            console.error('[MONITOR] Overdue autopsy check error:', err.message);
        }

        try {
            await cleanupOldData(db);
        } catch (err) {
            console.error('[MONITOR] Cleanup error:', err.message);
        }
    };

    // Run now, then every 2 hours
    runAll();
    setInterval(runAll, 2 * 60 * 60 * 1000);
}
