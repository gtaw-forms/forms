/**
 * Dashboard Manager — posts and maintains a live system status embed
 * in a designated Discord channel, refreshing every 5 minutes.
 *
 * Wired into index.js on bot startup. Manages a persistent dashboard
 * that survives bot restarts via Firebase config.
 */

import firebase from './firebase.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { getVpsStats } from './vpsStats.js';
import { lastActivity, isBrowserActive } from './activityLog.js';
import { firstApiKey } from './apiKeyUtil.js';
import { formatTimeSuffix, TERMINAL_STATES } from './outstandingAutopsies.js';
import { buildDashboardV2, isV2DashboardMessage } from './dashboardV2.js';
import { formatPostingLines, formatSessionLines } from './postingHealth.js';
import { registerTick, unregisterTick } from './scheduler.js';

const DASHBOARD_REFRESH_MS = 10 * 60 * 1000; // 10 minutes — was 5m, 412k×12/hr=4.9 MB/hr → now 2.4 MB/hr pending VPS move
const VPS_STATS_REFRESH_MS = 60000; // VPS CPU/MEM/activity field refreshes every 60s. Discord's message-endpoint bucket allows 5 edits/5s per channel — 1/60s uses ~2%.
const DASHBOARD_CONFIG_PATH = 'appMetadata/dashboard';

let client = null;
let refreshInterval = null;
let statsInterval = null;
let cachedConfig = null;
let editInProgress = false;
// VPS-stats updater resilience: consecutive Discord REST failures trip a
// cooldown so a transient egress blip doesn't log an error every 60s.
let vpsStatsFails = 0;
let vpsStatsPausedUntil = 0;
const VPS_STATS_FAIL_PAUSE_MS = 5 * 60 * 1000;
let refreshing = false;
let assignWatcherRef = null;
let assignWatcherPrimed = false;
let assignRefreshTimer = null;
let eventRefreshRunning = false;
// Last gathered dashboard data — the 60s VPS updater rebuilds the V2 payload
// from this + fresh VPS stats (V2 messages carry no embed to patch in place).
let lastDashboardData = null;

/**
 * Register the bot client instance (called from index.js on ready).
 */
export function setDashboardClient(c) {
    client = c;
}

// ── Custom Emoji IDs for Forum Status ──

const FORUM_EMOJI_IDS = {
    PHMC: '1520764376066429100',
    LSPD: '1520764433029271552',
    LSSD: '1520764412598812712',
};

/**
 * Resolve a forum's custom emoji for use in the dashboard embed.
 * Uses the Discord client cache to get the proper emoji name.
 * Falls back gracefully to a text label if unavailable.
 */
const _emojiCache = new Map();
function forumEmoji(name) {
    const id = FORUM_EMOJI_IDS[name];
    if (!id) return name;

    if (_emojiCache.has(name)) return _emojiCache.get(name);

    if (client) {
        const emoji = client.emojis.cache.get(id);
        if (emoji) {
            const str = String(emoji);
            _emojiCache.set(name, str);
            return str;
        }
    }

    _emojiCache.set(name, name);
    return name;
}

// ── Data Gathering ──

// Browser-based forum check — uses Playwright to handle Cloudflare challenges
async function liveForumCheck() {
    const { getForumClient } = await import('./forumClient.js');
    const client = getForumClient();

    const FORUMS = [
        { name: 'PHMC', url: process.env.FORUM_BASE_URL || 'https://phmc.gta.world' },
        { name: 'LSPD', url: process.env.FORUM_LSPD_URL || 'https://lspd.gta.world' },
        { name: 'LSSD', url: process.env.FORUM_LSSD_URL || 'https://lssd.gta.world' },
    ];

    const results = [];
    for (const forum of FORUMS) {
        try {
            const result = await client.checkHealth(forum.url);
            const latency = result.latency;
            const emoji = result.status === 'Good' ? '✅' : result.status === 'Bad' ? '⚠️' : '🔴';
            results.push({ name: forum.name, latency, status: result.status, emoji, lastChecked: Date.now() });
        } catch {
            results.push({ name: forum.name, latency: null, status: 'Unresponsive', emoji: '🔴', lastChecked: Date.now() });
        }
    }
    return results;
}

export async function gatherDashboardData(db, force = false) {
    const now = Date.now();
    const data = {};

    // 1. Read entire monitoring subtree ONCE (replaces 4 separate reads)
    let monitoringData = {};
    try {
        const monitoringSnap = await db.ref('monitoring').once('value');
        monitoringData = monitoringSnap.val() || {};
    } catch (err) {
        console.error('[DASHBOARD] Monitoring data error:', err.message);
    }

    // 2. Forum latency
    if (force) {
        // Live HTTP check (Refresh button)
        data.forums = await liveForumCheck();
    } else {
        // From cached monitoring data (auto-refresh)
        data.forums = [];
        try {
            const forumsVal = monitoringData.forums;
            if (forumsVal && typeof forumsVal === 'object') {
                data.forums = Object.entries(forumsVal)
                    .filter(([, f]) => f && typeof f === 'object')
                    .map(([name, f]) => ({
                        name,
                        latency: f.latency,
                        status: f.status || 'Unknown',
                        emoji: f.status === 'Good' ? '✅' : f.status === 'Bad' ? '⚠️' : '🔴',
                        lastChecked: f.lastChecked,
                    }));
                const order = { PHMC: 0, LSPD: 1, LSSD: 2 };
                data.forums.sort((a, b) => (order[a.name] ?? 99) - (order[b.name] ?? 99));
            }
        } catch (err) {
            console.error('[DASHBOARD] Forum data error:', err.message);
        }
        if (data.forums.length === 0) {
            data.forums = [
                { name: 'PHMC', status: 'Pending...', emoji: '⏳', latency: null },
                { name: 'LSPD', status: 'Pending...', emoji: '⏳', latency: null },
                { name: 'LSSD', status: 'Pending...', emoji: '⏳', latency: null },
            ];
        }
    }

    // 2b. Posting Status (write-path circuit breaker state — Website Online
    // and Posting Status are different things behind Cloudflare).
    data.posting = monitoringData.posting || {};
    // 2c. Session churn (forced logins / login failures per forum).
    data.sessions = monitoringData.session || {};

    // 3. Cloudflare status (from already-fetched monitoring data)
    const cf = monitoringData.cloudflare || {};
    data.cloudflare = cf.indicator === 'none'
        ? { emoji: '✅', text: 'All Systems Operational' }
        : { emoji: '⚠️', text: `${cf.description || cf.indicator || 'Unknown'} (${cf.indicator || '?'})` };

    // 4. GTAW UCP status (from already-fetched monitoring data)
    const gtaw = monitoringData.gtaw || {};
    const statusMap = {
        normal: { emoji: '✅', text: `${gtaw.lastLatency || '?'}ms` },
        slow:   { emoji: '⚠️', text: `${gtaw.lastLatency || '?'}ms (High Latency)` },
        error:  { emoji: '🔴', text: `Unreachable${gtaw.lastError ? ': ' + gtaw.lastError.slice(0, 60) : ''}` },
    };
    data.gtaw = statusMap[gtaw.status] || { emoji: '❓', text: 'Unknown' };

    // 5. Track when monitoring data was last gathered (from already-fetched data)
    const timestamps = [];
    if (monitoringData.cloudflare?.lastChecked) timestamps.push(monitoringData.cloudflare.lastChecked);
    if (monitoringData.gtaw?.lastChecked) timestamps.push(monitoringData.gtaw.lastChecked);
    if (monitoringData.forums) {
        Object.values(monitoringData.forums).forEach(f => {
            if (f?.lastChecked) timestamps.push(f.lastChecked);
        });
    }
    data.lastCheckTime = timestamps.length > 0 ? Math.max(...timestamps) : null;

    // 4. Morgue latest update — VPS primary (RTDB stale since dual-write off)
    try {
        let latest = 0;
        // Try VPS API first
        try {
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), 3500);
            const res = await fetch('http://127.0.0.1:3001/api/morgue?limit=1', {
                headers: { 'x-api-key': firstApiKey(process.env.MORGUE_API_KEYS) },
                signal: controller.signal,
            });
            clearTimeout(t);
            if (res.ok) {
                const j = await res.json();
                latest = j.records?.[0]?.lastUpdated || 0;
            }
        } catch { /* VPS health read best-effort ignored: RTDB fallback below covers it */ }
        if (!latest) {
            const morgueSnap = await db.ref('morgue-records').orderByChild('lastUpdated').limitToLast(1).once('value');
            if (morgueSnap.exists()) morgueSnap.forEach(child => { latest = child.val().lastUpdated || 0; });
        }
        if (latest) {
            const hoursAgo = (now - latest) / 3600000;
            if (hoursAgo > 48) data.morgue = { emoji: '🔴', text: `${Math.floor(hoursAgo)}h overdue` };
            else if (hoursAgo > 12) data.morgue = { emoji: '⚠️', text: `${Math.floor(hoursAgo)}h ago` };
            else if (hoursAgo < 1) data.morgue = { emoji: '✅', text: `${Math.floor(hoursAgo * 60)}min ago` };
            else data.morgue = { emoji: '✅', text: `${Math.floor(hoursAgo)}h ago` };
        } else {
            data.morgue = { emoji: '⚠️', text: 'No records found' };
        }
    } catch {
        data.morgue = { emoji: '❓', text: 'Error reading' };
    }

    // 5. Deploy queue
    try {
        const { getQueuedDeployments } = await import('./autoDeploy.js');
        data.queue = getQueuedDeployments();
    } catch {
        data.queue = [];
    }

    // 5b. Retry-queue entries (reports waiting out 6h/probe delays). Without
    // these the Deploy Queue reads empty for hours while work is actually
    // pending — with inexhaustible retries that's the normal state, not an
    // empty queue. The index is tiny by design (label/formId/retryAt only).
    try {
        const rqSnap = await db.ref('retry-queue').once('value').catch(() => null);
        if (rqSnap && rqSnap.exists()) {
            rqSnap.forEach((child) => {
                const r = child.val() || {};
                if (!r.retryAt) return;
                data.queue.push({
                    label: String(r.label || r.reportKey || child.key).slice(0, 80),
                    type: r.formId ? String(r.formId) : 'retry',
                    forum: '',
                    status: 'retry',
                    fireTime: new Date(r.retryAt).getTime() || 0,
                });
            });
            data.queue.sort((a, b) => {
                if (a.status === 'processing') return -1;
                if (b.status === 'processing') return 1;
                return (a.fireTime || 0) - (b.fireTime || 0);
            });
        }
    } catch (err) {
        console.warn(`[DASHBOARD] retry-queue read failed: ${err.message}`);
    }

    // 6. Scheduled tasks (periodic monitors)
    try {
        const { getMonitorStatus } = await import('./autopsyRequestMonitor.js');
        data.autopsyMonitor = getMonitorStatus();
    } catch (err) {
        // Never silent: a failed status import previously rendered as
        // "Autopsy Monitor — inactive" with zero trace. Surface it instead.
        console.warn(`[DASHBOARD] autopsyMonitor status import failed: ${err.message}`);
        data.autopsyMonitor = { active: false, statusError: err.message };
    }

    // 7. Roster sync status
    try {
        const { getRosterSyncStatus } = await import('./factionRosterSync.js');
        data.rosterSync = getRosterSyncStatus();
    } catch {
        data.rosterSync = null;
    }

    // 8. ME assignments from Firebase — only active requests are needed here.
    // Requires the completedAt index in database.rules.json; keep the result
    // bounded by the actual active-case set rather than recent history.
    try {
        const assignSnap = await db.ref('autopsy-requested').orderByChild('completedAt').equalTo(null).once('value');
        // Assignment timestamps (rotation tracker, keyed by REQUEST topic id)
        // for per-row waiting times. Best-effort — rows fall back to detectedAt.
        let assignTimes = {};
        try {
            const trackSnap = await db.ref('autopsy-requests/assignments').once('value');
            const trackData = trackSnap.val() || {};
            for (const [meKey, rec] of Object.entries(trackData)) {
                const rCases = (rec && rec.cases) || {};
                for (const [reqId, meta] of Object.entries(rCases)) {
                    if (meta && meta.assignedAt) assignTimes[`${String(meKey).toLowerCase()}|${reqId}`] = meta.assignedAt;
                }
            }
        } catch { /* timing falls back to detectedAt */ }
        const meList = [];
        if (assignSnap.exists()) {
            assignSnap.forEach((child) => {
                const c = child.val();
                // Parity with getOutstandingCases: terminal states (skipped /
                // cancelled / denied / dry_run) are never outstanding, even
                // with no completedAt (e.g. superseded pre-mass duplicates).
                if (TERMINAL_STATES.has(String(c.caseState || '').toLowerCase())) return;
                const deathType = String(c.parsed?.deathType || '').trim();
                const multi = String(c.caseState || '') === 'multi';
                const cases = multi && c.cases && typeof c.cases === 'object' ? Object.values(c.cases) : [];
                if (multi && cases.length > 0) {
                    // Multi-decedent / mass collection: one row per assigned ME
                    // + their decedent so names are never comma-merged (top-level
                    // assignedTo is the dashboard aggregate). Mass collections
                    // share ONE case topic (OP index post) — every row links to
                    // it and carries its Body i/N slot: `Case N (Body i/N)`.
                    const indexed = Object.entries(c.cases)
                        .map(([k, cc]) => ({ idx: k, cc }))
                        .sort((a, b) => Number(a.idx) - Number(b.idx));
                    const total = indexed.length;
                    // Shared OP topic: explicit top-level caseTopicId/caseUrl wins;
                    // otherwise adopt it when every sub-case points at one topic.
                    let sharedTopicId = c.caseTopicId || null;
                    let sharedUrl = c.caseUrl || null;
                    if (!sharedTopicId) {
                        const ids = new Set(indexed.map(({ cc }) => cc && cc.caseTopicId).filter(Boolean));
                        if (ids.size === 1) {
                            sharedTopicId = [...ids][0];
                            sharedUrl = indexed.map(({ cc }) => cc.caseUrl).find(Boolean) || null;
                        }
                    }
                    indexed.forEach(({ idx, cc }, slot) => {
                        if (cc && cc.assignedTo && !cc.completedAt) {
                            // Shared-thread mass bodies carry no caseNum/title of
                            // their own — fall back to the parent collection
                            // (else every row renders `Case ? (Body i/N)`).
                            const numM = String(cc.caseNum || cc.caseTitle || '').match(/Case\s*(\w+)/i)
                                || String(c.caseNum || c.caseTitle || c.title || '').match(/Case\s*(\w+)/i);
                            const num = cc.caseNum || (numM ? numM[1] : null) || c.caseNum || '?';
                            const decedent = cc.oocName || cc.name || cc.caseTitle || '';
                            meList.push({
                                name: cc.assignedTo,
                                caseNum: cc.caseTitle || cc.oocName || cc.name || 'Case',
                                label: `Case ${num} (Body ${slot + 1}/${total})`,
                                decedent,
                                caseUrl: sharedUrl || cc.caseUrl || null,
                                topicId: sharedTopicId || cc.caseTopicId || null,
                                requestId: child.key,
                                detectedAt: c.detectedAt || null,
                                deathType,
                                assignedAt: assignTimes[`${String(cc.assignedTo).toLowerCase()}|${child.key}`] || null,
                            });
                        }
                    });
                    return;
                }
                if (c.assignedTo && !c.completedAt) {
                    meList.push({
                        name: c.assignedTo,
                        caseNum: c.title || '?',
                        caseUrl: c.caseUrl || null,
                        topicId: c.topicId,
                        requestId: child.key,
                        detectedAt: c.detectedAt || null,
                        deathType,
                        assignedAt: assignTimes[`${String(c.assignedTo).toLowerCase()}|${child.key}`] || null,
                    });
                }
            });
        }
        data.meAssignments = meList;

        // LOA list
        const loaSnap = await db.ref('autopsy-requests/loa').once('value');
        data.meLoa = [];
        if (loaSnap.exists()) {
            loaSnap.forEach((child) => {
                if (child.val() === true) data.meLoa.push(child.key);
            });
        }
    } catch {
        data.meAssignments = [];
        data.meLoa = [];
    }

    // 9. Scheduled Face posts (awaiting their publish delay) — scheduled-only
    // query (needs the facePostDrafts status index); approved history never ships.
    try {
        const faceList = [];
        const faceSnap = await db.ref('facePostDrafts').orderByChild('status').equalTo('scheduled').once('value');
        if (faceSnap.exists()) {
            faceSnap.forEach((child) => {
                if (child.key === '_ids') return;
                const v = child.val();
                if (v && v.status === 'scheduled' && v.publishAt) {
                    faceList.push({
                        reportKey: child.key,
                        decedentName: v.decedentName || '',
                        publishAt: v.publishAt,
                    });
                }
            });
        }
        faceList.sort((a, b) => a.publishAt - b.publishAt);
        data.facePosts = faceList;
    } catch {
        data.facePosts = [];
    }

    // 10. VPS resources (CPU/MEM/uptime/procs)
    try {
        data.vps = await getVpsStats();
    } catch (err) {
        console.error('[DASHBOARD] VPS stats error:', err.message);
        data.vps = null;
    }

    return data;
}

// ── Embed Builder ──

function formatBytes(bytes) {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(0) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
}

function formatUptime(sec) {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function buildRefreshingVpsField() {
    return [
        '**CPU** — 🔄',
        '**MEM** — 🔄',
        '**SWAP** — 🔄',
        '**Uptime** — 🔄',
        '**Procs** — 🔄',
        '**Browser** — 🔄',
        '**Last activity** — refreshing…',
    ].join('\n');
}

/**
 * Build a "refreshing" embed from the live message: keeps every current field,
 * but swaps the VPS Resources field for the REFRESHING placeholder. Used to flip
 * the field state transiently during the auto-refresh gather, so it never shows stale data.
 */
function buildRefreshingEmbed(msg) {
    const fields = (msg.embeds[0]?.fields || []).map(f => ({
        name: f.name,
        value: f.value,
        inline: f.inline === true,
    }));
    const vpsIdx = fields.findIndex(f => f.name === '🖥️ VPS Resources');
    const refreshing = { name: '🖥️ VPS Resources', value: buildRefreshingVpsField(), inline: false };
    if (vpsIdx !== -1) fields[vpsIdx] = refreshing;
    else fields.push(refreshing);

    return new EmbedBuilder()
        .setColor(0xffc107)
        .setTitle('🖥️ PHMC System Dashboard')
        .setDescription('🔄 Refreshing data…')
        .addFields(fields);
}

function buildVpsField(vps) {
    if (refreshing) return buildRefreshingVpsField();
    const { cpuPct, mem, swap, load, uptime, procs } = vps;
    const memPct = mem && mem.total > 0 ? Math.round((mem.used / mem.total) * 100) : null;
    const swapPct = swap && swap.total > 0 ? Math.round((swap.used / swap.total) * 100) : null;

    const lines = [
        `**CPU** — ${cpuPct != null ? cpuPct.toFixed(1) + '%' : 'n/a'} (load ${load != null ? load.toFixed(2) : 'n/a'})`,
        `**MEM** — ${formatBytes(mem.used)} / ${formatBytes(mem.total)}${memPct != null ? ` (${memPct}%)` : ''}`,
    ];
    if (swapPct != null && swap.total > 0) {
        lines.push(`**SWAP** — ${formatBytes(swap.used)} / ${formatBytes(swap.total)} (${swapPct}%)`);
    }
    lines.push(`**Uptime** — ${formatUptime(uptime)}`);

    const chrome = procs?.chrome;
    const node = procs?.node;
    const chromeDetail = chrome?.breakdown && Object.keys(chrome.breakdown).length
        ? Object.entries(chrome.breakdown).map(([k, v]) => `${k} ${v}`).join(' · ')
        : null;
    const nodeDetail = node?.breakdown && Object.keys(node.breakdown).length
        ? Object.entries(node.breakdown).map(([k, v]) => `${k} ${v}`).join(' · ')
        : null;
    lines.push(
        `**Procs** — chrome ×${chrome?.total != null ? chrome.total : '?'}${chromeDetail ? ` (${chromeDetail})` : ''} · node ×${node?.total != null ? node.total : '?'}${nodeDetail ? ` (${nodeDetail})` : ''}`
    );

    const act = lastActivity();
    const active = isBrowserActive();
    const status = active ? '🟢 **Active**' : '⚪ **Idle**';
    if (act) {
        const ago = Math.floor((Date.now() - act.at) / 1000);
        const agoStr = ago < 60 ? `${ago}s ago` : ago < 3600 ? `${Math.floor(ago / 60)}m ago` : `${(ago / 3600).toFixed(1)}h ago`;
        lines.push(`**Browser** — ${status}`);
        lines.push(`**Last activity** — ${act.label} (${act.detail}) · ${agoStr}`);
    } else {
        lines.push(`**Browser** — ${status}`);
        lines.push(`**Last activity** — none (no browser activity yet)`);
    }

    return lines.join('\n');
}

function buildDashboardEmbed(data) {
    const posting = formatPostingLines(data.posting);
    const color = posting.blocked ? 0xdc3545
        : data.forums.some(f => f.status === 'Unresponsive')
        ? 0xdc3545 : data.forums.some(f => f.status === 'Bad')
        ? 0xffc107 : data.cloudflare.emoji === '⚠️'
        ? 0xffc107 : 0x28a745;

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle('🖥️ PHMC System Dashboard')
        .setDescription(`Last refreshed: <t:${Math.floor(Date.now() / 1000)}:R>\nData checked: ${data.lastCheckTime ? `<t:${Math.floor(data.lastCheckTime / 1000)}:R>` : 'awaiting first health check...'}`)
        .setFooter({ text: 'VPS stats every 60s • full refresh every 5 minutes' });

    // Forum Status (uses custom server emojis where available)
    const forumLines = data.forums.map(f => {
        const parts = [forumEmoji(f.name)];
        if (f.latency != null) parts.push(`${f.latency}ms`);
        parts.push(f.status);
        return parts.join(' ');
    }).join('\n');

    embed.addFields({
        name: '🌐 Forum Status',
        value: forumLines || 'No data',
        inline: false,
    });

    // Posting Status (write path — split from Website Online above)
    embed.addFields({
        name: '📝 Posting Status',
        value: posting.lines || 'No data',
        inline: false,
    });

    // Sessions (forced-login churn — leading indicator before post failures)
    const sessions = formatSessionLines(data.sessions);
    if (sessions) {
        embed.addFields({
            name: '🔑 Sessions',
            value: sessions,
            inline: false,
        });
    }

    // Services summary
    embed.addFields({
        name: '☁️ Services',
        value: [
            `**Cloudflare** — ${data.cloudflare.emoji} ${data.cloudflare.text}`,
            `**GTAW UCP** — ${data.gtaw.emoji} ${data.gtaw.text}`,
            `**Morgue** — ${data.morgue.emoji} ${data.morgue.text}`,
        ].join('\n'),
        inline: false,
    });

    // VPS resources
    if (data.vps) {
        embed.addFields({
            name: '🖥️ VPS Resources',
            value: buildVpsField(data.vps),
            inline: false,
        });
    }

    // Deploy Queue
    if (data.queue.length > 0) {
        const queueLines = data.queue.slice(0, 5).map(e => {
            const icon = e.status === 'processing' ? '🔄 ' : e.status === 'retry' ? '🔁 ' : '';
            const timeStr = e.status === 'processing'
                ? 'Processing now'
                : `<t:${Math.floor(e.fireTime / 1000)}:R>`;
            return `${icon}**${e.label}** — ${timeStr}`;
        }).join('\n');
        embed.addFields({
            name: `📦 Deploy Queue (${data.queue.length})`,
            value: queueLines || 'None',
            inline: false,
        });
    } else {
        embed.addFields({
            name: '📦 Deploy Queue',
            value: '✅ No reports awaiting deployment',
            inline: false,
        });
    }

    // Scheduled Face posts (awaiting their publish delay)
    const faceList = data.facePosts || [];
    if (faceList.length > 0) {
        const faceLines = faceList.slice(0, 5).map(f => {
            const who = f.decedentName || f.reportKey;
            return `**${who}** — <t:${Math.floor(f.publishAt / 1000)}:R>`;
        }).join('\n');
        embed.addFields({
            name: `📅 Scheduled Face Posts (${faceList.length})`,
            value: faceLines + (faceList.length > 5 ? `\n...and ${faceList.length - 5} more` : ''),
            inline: false,
        });
    } else {
        embed.addFields({
            name: '📅 Scheduled Face Posts',
            value: '✅ None scheduled',
            inline: false,
        });
    }

    // Scheduled Tasks
    const taskLines = [];

    // Roster sync
    const rs = data.rosterSync;
    if (rs && rs.lastSyncAt) {
        const lastSync = `<t:${Math.floor(rs.lastSyncAt / 1000)}:R>`;
        const nextSync = rs.nextSyncAt ? `<t:${Math.floor(rs.nextSyncAt / 1000)}:R>` : 'pending...';
        taskLines.push(
            `📋 **Roster Sync** — every 12h (+random)\n` +
            `└ LSPD: ${rs.lspdCount} | LSSD: ${rs.lssdCount} — last: ${lastSync} — next: ${nextSync}`
        );
    } else {
        taskLines.push('📋 **Roster Sync** — pending first sync');
    }

    // Autopsy Request Monitor
    const am = data.autopsyMonitor || {};
    if (am.active) {
        const intervalMin = Math.round((am.intervalMs || 300000) / 60000);
        const lastCheck = am.lastCheckTime
            ? `<t:${Math.floor(am.lastCheckTime / 1000)}:R>`
            : 'pending...';
        const statusIcon = am.lastCheckTime === null ? '⏳' : am.lastCheckSuccess ? '✅' : '❌';
        taskLines.push(
            `${statusIcon} **Autopsy Monitor** — every ${intervalMin}min (f=265)\n` +
            `└ last check: ${lastCheck}`
        );
    } else if (am.statusError) {
        taskLines.push(`⚠️ **Autopsy Monitor** — status unavailable (${am.statusError})`);
    } else {
        taskLines.push('⏹️ **Autopsy Monitor** — inactive');
    }

    embed.addFields({
        name: '🔄 Scheduled Tasks',
        value: taskLines.join('\n') || 'None configured',
        inline: false,
    });

    // ME Assignments
    const meLines = [];
    const assignments = data.meAssignments || [];
    const loaList = data.meLoa || [];
    const loaLower = loaList.map(n => n.toLowerCase());

    if (assignments.length > 0) {
        assignments.forEach((a) => {
            const loaTag = loaLower.includes(a.name.toLowerCase()) ? ' [LOA]' : '';
            // Mass/multi rows carry an explicit `Case N (Body i/N)` label;
            // legacy rows fall back to the OOC name extracted from the title.
            let linkLabel;
            if (a.label) {
                linkLabel = a.label;
            } else {
                const oocM = (a.caseNum || '').match(/\(\(\s*(.*?)\s*\)\)/);
                linkLabel = oocM ? oocM[1] : a.caseNum || 'Case';
            }
            const caseLink = a.caseUrl ? `[${linkLabel}](<${a.caseUrl}>)` : `*${linkLabel}*`;
            const decedentSuffix = a.label && a.decedent ? ` (${a.decedent})` : '';
            const timeSuffix = formatTimeSuffix(a);
            meLines.push(`**${a.name}**${loaTag} — ${caseLink}${decedentSuffix}${timeSuffix ? ` ${timeSuffix}` : ''}`);
        });
    }
    if (loaList.length > 0) {
        meLines.push('', `_On LOA: ${loaList.join(', ')}_`);
    }
    if (meLines.length === 0) meLines.push('No active assignments');

    embed.addFields({
        name: '🔬 ME Assignments',
        value: meLines.join('\n'),
        inline: false,
    });

    return embed;
}

// ── Message Management ──

function buildRefreshRow() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('dashboard_refresh')
                .setLabel('Refresh Now')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('dashboard_restart')
                .setLabel('Restart Bot')
                .setEmoji('🔁')
                .setStyle(ButtonStyle.Danger)
        );
}

/**
 * Smoothly update an existing dashboard message: start from the current embed,
 * swap the colour/description and replace its fields with freshly built ones.
 * Avoids the jarring full-rebuild + pending-flash of posting a new embed.
 * Falls back to a plain replace if the message has no embed yet.
 */
async function patchDashboardEmbed(msg, newEmbed, components) {
    const payload = { embeds: [newEmbed] };
    if (components !== undefined) payload.components = [components];
    if (!msg.embeds.length) {
        await msg.edit(payload);
        return;
    }

    const old = msg.embeds[0];
    const fields = (newEmbed.data.fields || []).map(f => ({
        name: f.name,
        value: f.value,
        inline: !!f.inline,
    }));

    const patched = EmbedBuilder.from(old)
        .setColor(newEmbed.data.color ?? old.color)
        .setDescription(newEmbed.data.description ?? old.description);
    patched.spliceFields(0, old.fields.length, ...fields);

    payload.embeds = [patched];
    await msg.edit(payload);
}

/**
 * Rendered V2 payload for sends/edits. Conversion edits (legacy embed
 * message -> V2) explicitly clear embeds; content is always '' on our
 * messages so it needs no clearing. NOTE: never include a `stickers` key —
 * the API rejects edits carrying it at all (403/50080 "Cannot edit stickers
 * within a message"), even as an empty array.
 */
function v2EditPayload(built) {
    return { embeds: [], flags: built.flags, components: built.components };
}

function v2Opts(extra = {}) {
    return { emojiFor: forumEmoji, lastActivity, isBrowserActive, ...extra };
}

/**
 * err.message alone ("Received one or more errors") hides everything — always
 * log code/status/raw validation errors with it so the next failure is
 * diagnosable from the log alone.
 */
function logDiscordErr(tag, err) {
    let raw = '';
    try {
        raw = JSON.stringify(err?.rawError ?? err?.errors ?? null)?.slice(0, 2000) || '';
    } catch { /* non-serializable */ }
    console.error(`[DASHBOARD] ${tag}: code=${err?.code} status=${err?.status} msg=${err?.message}${raw ? ` raw=${raw}` : ''}`);
}

/**
 * Delete any other PHMC System Dashboard embeds in the channel that aren't the
 * managed message. Called each refresh cycle so stale duplicates self-heal.
 */
async function cleanupOrphanDashboards(channel, activeMessageId) {
    if (!channel) return;
    try {
        const messages = await channel.messages.fetch({ limit: 20 });
        for (const msg of messages.values()) {
            if (msg.id === activeMessageId) continue;
            const isLegacy = (msg.embeds || []).some(e => e.title === '🖥️ PHMC System Dashboard');
            if ((isLegacy || isV2DashboardMessage(msg)) && msg.deletable) {
                await msg.delete().catch(() => {});
                console.log(`[DASHBOARD] 🧹 Deleted orphan dashboard message ${msg.id}`);
            }
        }
    } catch (err) {
        console.error('[DASHBOARD] Orphan cleanup error:', err.message);
    }
}

async function postOrUpdateDashboard(db) {
    if (!client) return null;

    try {
        const configSnap = await db.ref(DASHBOARD_CONFIG_PATH).once('value');
        const config = configSnap.val();
        if (!config || !config.channelId) return null;
        cachedConfig = config;

        const channel = await client.channels.fetch(config.channelId).catch(() => null);
        if (!channel) {
            console.warn('[DASHBOARD] ⚠️ Configured channel not found, clearing config.');
            await db.ref(DASHBOARD_CONFIG_PATH).set(null);
            return null;
        }

        // Clean up orphaned dashboard messages — delete any other PHMC System
        // Dashboard embeds in the channel that aren't the one we manage. Prevents
        // duplicates from old configs / re-posts after message deletion.
        await cleanupOrphanDashboards(channel, config.messageId);

        const row = buildRefreshRow();

        console.log('[DASHBOARD] 🔄 Running auto-refresh cycle...');

        // Show a transient "REFRESHING" state while we gather cached data.
        // Rendered from the last gathered data (V2) so the VPS block reads
        // refreshing instead of stale. Skipped on first boot (no cache yet).
        refreshing = true;
        if (config.messageId && lastDashboardData) {
            try {
                const msg = await channel.messages.fetch(config.messageId);
                const rBuilt = buildDashboardV2(lastDashboardData, v2Opts({ refreshing: true }));
                await msg.edit(v2EditPayload(rBuilt));
            } catch { /* old message gone — will post new below */ }
        }

        // Use cached monitoring data for auto-refresh (no browser checks = no lock contention).
        // Live browser checks still happen via the "Refresh Now" button and system monitor.
        let data;
        try {
            const [gathered] = await Promise.all([
                gatherDashboardData(db, false),
                new Promise(r => setTimeout(r, 1000)),
            ]);
            data = gathered;
        } finally {
            refreshing = false;
        }
        data.lastCheckTime = Date.now();
        lastDashboardData = data;
        const built = buildDashboardV2(data, v2Opts());
        if (built.metrics.textChars > 4000 || built.metrics.componentCount > 40 || built.metrics.topLevel > 10) {
            // Over budget (shouldn't happen — the builder trims assignments):
            // frozen legacy embed path as emergency fallback.
            console.warn(`[DASHBOARD] V2 over budget (text ${built.metrics.textChars}, comps ${built.metrics.componentCount}) — legacy fallback`);
            const embed = buildDashboardEmbed(data);
            if (config.messageId) {
                try {
                    const msg = await channel.messages.fetch(config.messageId);
                    await patchDashboardEmbed(msg, embed, row);
                    cachedConfig = { ...config };
                    return data;
                } catch (err) {
                    logDiscordErr(`Legacy patch failed for ${config.messageId} — will post new`, err);
                }
            }
            const msg = await channel.send({ embeds: [embed], components: [row] });
            await db.ref(DASHBOARD_CONFIG_PATH).update({ messageId: msg.id });
            cachedConfig = { ...config, messageId: msg.id };
            console.log(`[DASHBOARD] 📋 Dashboard posted (legacy fallback) in #${channel.name}`);
            return data;
        }

        if (config.messageId) {
            try {
                const msg = await channel.messages.fetch(config.messageId);
                // In-place conversion on first V2 cycle (legacy embed -> V2);
                // smooth V2->V2 update afterwards.
                await msg.edit(v2EditPayload(built));
                cachedConfig = { ...config };
                return data;
            } catch (err) {
                logDiscordErr(`Patch failed for ${config.messageId} — will post new`, err);
            }
        }

        // No existing message — post a new one
        const msg = await channel.send({ flags: built.flags, components: built.components });
        await db.ref(DASHBOARD_CONFIG_PATH).update({ messageId: msg.id });
        cachedConfig = { ...config, messageId: msg.id };
        console.log(`[DASHBOARD] 📋 Dashboard posted in #${channel.name}`);
        return data;
    } catch (err) {
        logDiscordErr('Update error', err);
        return null;
    }
}

// ── VPS Stats Lightweight Updater ──
// Refreshes only the VPS Resources field every 60s by patching the existing
// dashboard message in place (same technique as patchDashboardEmbed). Does NOT
// re-gather forums/queue — those stay on the 5-min cycle. Discord allows ~5
// edits per 5s per channel; one edit per 60s is well within budget.

async function updateVpsStatsField() {
    if (!client || editInProgress) return;
    if (!cachedConfig || !cachedConfig.channelId || !cachedConfig.messageId) return;
    if (Date.now() < vpsStatsPausedUntil) return;

    editInProgress = true;
    try {
        const channel = await client.channels.fetch(cachedConfig.channelId).catch(() => null);
        if (!channel) return;

        const msg = await channel.messages.fetch(cachedConfig.messageId).catch(() => null);
        if (!msg) return;
        // V2 messages carry no embed to patch — rebuild from the last gathered
        // data + fresh VPS stats (same numbers, new timestamp). No cache yet
        // (first boot) means the full cycle hasn't run: skip, don't clobber.
        if (!lastDashboardData) return;

        const vps = await getVpsStats();
        const built = buildDashboardV2({ ...lastDashboardData, vps }, v2Opts({ refreshing }));
        await msg.edit(v2EditPayload(built));
        vpsStatsFails = 0;
    } catch (err) {
        vpsStatsFails++;
        if (vpsStatsFails >= 6) {
            // ~6 min of consecutive failures — pause the 60s loop for 5 min and
            // log once instead of once per cycle.
            vpsStatsPausedUntil = Date.now() + VPS_STATS_FAIL_PAUSE_MS;
            vpsStatsFails = 0;
            console.warn('[DASHBOARD] VPS stats updater paused 5m after repeated failures:', err.message);
        } else if (vpsStatsFails === 1) {
            logDiscordErr('VPS stats update error', err);
        }
    } finally {
        editInProgress = false;
    }
}

// ── Button Handler ──

export async function handleDashboardRefresh(interaction) {
    if (!interaction.isButton() || interaction.customId !== 'dashboard_refresh') return false;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const db = firebase.db;
        if (!db) {
            await interaction.editReply({ content: '⏳ Firebase not ready yet, please try again in a moment.' });
            return true;
        }

        // V2 progress payload: header + single forum-status container (no
        // stickers key — edits carrying it are rejected outright, see helper).
        const v2Progress = (lines) => ({
            embeds: [], flags: MessageFlags.IsComponentsV2,
            components: [
                { type: 10, content: '# PHMC System Dashboard\n⏳ Forum checks in progress...' },
                { type: 17, components: [{ type: 10, content: `## Forum Status\n${lines}` }] },
                buildRefreshRow(),
            ],
        });
        const progressLines = (results) => ['PHMC', 'LSPD', 'LSSD'].map((name) => {
            const r = results.find((x) => x.name === name);
            if (!r) return `⏳ **${name}** — Pending...`;
            const emoji = r.status === 'Good' ? '✅' : r.status === 'Bad' ? '⚠️' : '🔴';
            const latency = r.latency != null ? ` ${r.latency}ms` : '';
            return `${emoji} **${name}**${latency} — ${r.status}`;
        }).join('\n');

        // Step 1: Show all pending
        await interaction.message.edit(v2Progress(progressLines([])));

        // Step 2: Check forums one by one, updating as we go
        const { getForumClient } = await import('./forumClient.js');
        const client = getForumClient();
        const FORUMS = [
            { name: 'PHMC', url: process.env.FORUM_BASE_URL || 'https://phmc.gta.world' },
            { name: 'LSPD', url: process.env.FORUM_LSPD_URL || 'https://lspd.gta.world' },
            { name: 'LSSD', url: process.env.FORUM_LSSD_URL || 'https://lssd.gta.world' },
        ];

        const liveResults = [];
        for (const forum of FORUMS) {
            try {
                const result = await client.checkHealth(forum.url);
                liveResults.push({ name: forum.name, latency: result.latency, status: result.status });
            } catch {
                liveResults.push({ name: forum.name, latency: null, status: 'Unresponsive' });
            }
            // Update after each forum completes
            await interaction.message.edit(v2Progress(progressLines(liveResults)));
        }

        // Step 3: Gather non-forum data and build the final V2 payload
        const data = await gatherDashboardData(db, false);
        data.forums = liveResults.map(f => ({
            ...f,
            emoji: f.status === 'Good' ? '✅' : f.status === 'Bad' ? '⚠️' : '🔴',
            lastChecked: Date.now(),
        }));
        data.lastCheckTime = Date.now();
        lastDashboardData = data;

        const built = buildDashboardV2(data, v2Opts());
        await interaction.message.edit(v2EditPayload(built));
        await interaction.editReply({ content: '✅ Dashboard refreshed! (live data)' });
    } catch (err) {
        logDiscordErr('Refresh error', err);
        await interaction.editReply({ content: '⏳ Refresh triggered, please wait for the next auto-refresh cycle.' });
    }

    return true;
}

/**
 * Handle the "Restart Bot" button — gracefully restarts the bot process.
 * Designed for PM2-managed processes which auto-restart on exit.
 */
export async function handleDashboardRestart(interaction) {
    if (!interaction.isButton() || interaction.customId !== 'dashboard_restart') return false;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const db = firebase.db;
        if (!db) {
            await interaction.editReply({ content: '[ERR] Firebase not ready yet, please try again in a moment.' });
            return true;
        }

        // Post confirmation message, then restart
        await interaction.editReply({ content: '🔁 Restarting bot... Dashboard will return in a few seconds.' });

        console.log('[DASHBOARD] Restart triggered via dashboard button by ' + interaction.user.tag);

        // Brief delay so the ephemeral reply lands before the process dies
        setTimeout(() => {
            console.log('[DASHBOARD] Initiating PM2 restart (process.exit)...');
            process.exit(0);
        }, 1500);
    } catch (err) {
        console.error('[DASHBOARD] Restart error:', err.message);
        // If defer failed, try direct reply
        try { await interaction.editReply({ content: '[ERR] Failed to restart: ' + err.message }); } catch { /* ignore */ }
    }

    return true;
}

// ── Startup / Teardown ──

/**
 * One dashboard cycle: main (dev) dashboard only. The dedicated PHMC board
 * was removed (unused) — its renderer (phmcDashboard.js) and command are gone.
 */
async function runDashboardCycle(db) {
    await postOrUpdateDashboard(db);
}

export function startDashboardManager() {
    firebase.init();
    const db = firebase.db;

    // First cycle runs immediately (first boot); subsequent cycles fire on the
    // shared scheduler (reentrancy guard built in — replaces recursive setTimeout).
    runDashboardCycle(db).then(() => {
        registerTick('dashboard-refresh', { intervalMs: DASHBOARD_REFRESH_MS, fn: () => runDashboardCycle(db) });
        statsInterval = setInterval(updateVpsStatsField, VPS_STATS_REFRESH_MS);
    });

    startAssignmentWatcher(db);

    console.log(`[DASHBOARD] ✅ Dashboard manager active (${DASHBOARD_REFRESH_MS / 60000}-min cycle, cached data; VPS stats every ${VPS_STATS_REFRESH_MS / 1000}s).`);
}

export function stopDashboardManager() {
    unregisterTick('dashboard-refresh');
    if (refreshInterval) {
        clearTimeout(refreshInterval);
        refreshInterval = null;
    }
    if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
    }
    if (assignWatcherRef) {
        assignWatcherRef.off('value');
        assignWatcherRef = null;
    }
    if (assignRefreshTimer) {
        clearTimeout(assignRefreshTimer);
        assignRefreshTimer = null;
    }
}

// ── Live assignment updates ──
// Watches the tiny autopsy-requests/assignments node — touched by
// recordAssignment/clearAssignment on every assign, reassign, and completion —
// and triggers an out-of-cycle dashboard rebuild so ME Assignments reflects
// changes within seconds instead of waiting for the 10-min cycle. Debounced to
// coalesce bursts (e.g. multi-decedent batch assigns); the initial listener
// fire is ignored so startup doesn't double-refresh.
function startAssignmentWatcher(db) {
    try {
        const ref = db.ref('autopsy-requests/assignments');
        assignWatcherRef = ref;
        ref.on('value', () => {
            if (!assignWatcherPrimed) { assignWatcherPrimed = true; return; }
            if (assignRefreshTimer) clearTimeout(assignRefreshTimer);
            assignRefreshTimer = setTimeout(() => {
                assignRefreshTimer = null;
                if (eventRefreshRunning) return;
                eventRefreshRunning = true;
                console.log('[DASHBOARD] Assignment change detected — running live refresh...');
                postOrUpdateDashboard(db).catch(() => {}).finally(() => { eventRefreshRunning = false; });
            }, 5000);
        });
        console.log('[DASHBOARD] Assignment watcher active (live ME Assignments updates).');
    } catch (err) {
        console.warn('[DASHBOARD] Assignment watcher failed to start (non-fatal):', err.message);
    }
}

/**
 * Re-post or destroy the dashboard on command.
 * Called from the dashboard slash command.
 */
export async function setupDashboard(channelId) {
    const db = firebase.db;
    await db.ref(DASHBOARD_CONFIG_PATH).set({
        channelId,
        messageId: null,
        createdAt: new Date().toISOString(),
    });
    // Post immediately
    await postOrUpdateDashboard(db);
}

export async function destroyDashboard() {
    const db = firebase.db;
    try {
        const configSnap = await db.ref(DASHBOARD_CONFIG_PATH).once('value');
        const config = configSnap.val();
        if (config?.channelId && config?.messageId && client) {
            const channel = await client.channels.fetch(config.channelId).catch(() => null);
            if (channel) {
                try {
                    const msg = await channel.messages.fetch(config.messageId);
                    await msg.delete();
                } catch { /* already deleted */ }
            }
        }
    } catch { /* ignore */ }
    await db.ref(DASHBOARD_CONFIG_PATH).set(null);
}
