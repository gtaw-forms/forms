/**
 * Dashboard Manager — posts and maintains a live system status embed
 * in a designated Discord channel, refreshing every 5 minutes.
 *
 * Wired into index.js on bot startup. Manages a persistent dashboard
 * that survives bot restarts via Firebase config.
 */

import firebase from './firebase.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const DASHBOARD_REFRESH_MS = 5 * 60 * 1000; // 5 minutes — uses cached monitoring data, no browser opens
const DASHBOARD_CONFIG_PATH = 'appMetadata/dashboard';

let client = null;
let refreshInterval = null;

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

async function gatherDashboardData(db, force = false) {
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

    // 4. Morgue latest update
    try {
        const morgueSnap = await db.ref('morgue-records')
            .orderByChild('lastUpdated')
            .limitToLast(1)
            .once('value');
        if (morgueSnap.exists()) {
            let latest = 0;
            morgueSnap.forEach(child => { latest = child.val().lastUpdated || 0; });
            const hoursAgo = (now - latest) / 3600000;
            if (hoursAgo > 24) {
                data.morgue = { emoji: '🔴', text: `${Math.floor(hoursAgo)}h overdue` };
            } else if (hoursAgo > 12) {
                data.morgue = { emoji: '⚠️', text: `${Math.floor(hoursAgo)}h ago` };
            } else if (hoursAgo < 1) {
                data.morgue = { emoji: '✅', text: `${Math.floor(hoursAgo * 60)}min ago` };
            } else {
                data.morgue = { emoji: '✅', text: `${Math.floor(hoursAgo)}h ago` };
            }
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

    // 6. Scheduled tasks (periodic monitors)
    try {
        const { getMonitorStatus } = await import('./autopsyRequestMonitor.js');
        data.autopsyMonitor = getMonitorStatus();
    } catch {
        data.autopsyMonitor = { active: false };
    }

    // 7. ME assignments from Firebase
    try {
        const assignSnap = await db.ref('autopsy-requested').once('value');
        const meList = [];
        if (assignSnap.exists()) {
            assignSnap.forEach((child) => {
                const c = child.val();
                if (c.assignedTo && !c.completedAt) {
                    meList.push({
                        name: c.assignedTo,
                        caseNum: c.title || '?',
                        caseUrl: c.caseUrl || null,
                        topicId: c.topicId,
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

    return data;
}

// ── Embed Builder ──

function buildDashboardEmbed(data) {
    const color = data.forums.some(f => f.status === 'Unresponsive')
        ? 0xdc3545 : data.forums.some(f => f.status === 'Bad')
        ? 0xffc107 : data.cloudflare.emoji === '⚠️'
        ? 0xffc107 : 0x28a745;

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle('🖥️ PHMC System Dashboard')
        .setDescription(`Last refreshed: <t:${Math.floor(Date.now() / 1000)}:R>\nData checked: ${data.lastCheckTime ? `<t:${Math.floor(data.lastCheckTime / 1000)}:R>` : 'awaiting first health check...'}`)
        .setFooter({ text: 'Auto-refreshes every 5 minutes' });

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

    // Deploy Queue
    if (data.queue.length > 0) {
        const queueLines = data.queue.slice(0, 5).map(e => {
            const timeStr = e.status === 'processing'
                ? '🔄 Processing now'
                : `<t:${Math.floor(e.fireTime / 1000)}:R>`;
            return `**${e.label}** — ${timeStr}`;
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

    // Scheduled Tasks
    const taskLines = [];
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
            `└ LSPD: ${am.lspdCount ?? '?'} requests | LSSD: ${am.lssdCount ?? '?'} requests — last check: ${lastCheck}`
        );
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
            // Extract OOC name from request title for a cleaner link label
            const oocM = (a.caseNum || '').match(/\(\(\s*(.*?)\s*\)\)/);
            const oocLabel = oocM ? oocM[1] : a.caseNum || 'Case';
            const caseLink = a.caseUrl ? `[${oocLabel}](<${a.caseUrl}>)` : `*${oocLabel}*`;
            meLines.push(`**${a.name}**${loaTag} — ${caseLink}`);
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

async function postOrUpdateDashboard(db) {
    if (!client) return;

    try {
        const configSnap = await db.ref(DASHBOARD_CONFIG_PATH).once('value');
        const config = configSnap.val();
        if (!config || !config.channelId) return;

        const channel = await client.channels.fetch(config.channelId).catch(() => null);
        if (!channel) {
            console.warn('[DASHBOARD] ⚠️ Configured channel not found, clearing config.');
            await db.ref(DASHBOARD_CONFIG_PATH).set(null);
            return;
        }

        const row = buildRefreshRow();

        console.log('[DASHBOARD] 🔄 Running auto-refresh cycle...');

        // Flip to pending state so it's visibly clear a refresh is happening
        if (config.messageId) {
            try {
                const msg = await channel.messages.fetch(config.messageId);
                const pendingEmbed = new EmbedBuilder()
                    .setColor(0xffc107)
                    .setTitle('🖥️ PHMC System Dashboard')
                    .setDescription('⏳ Forum checks in progress...')
                    .addFields({
                        name: '🌐 Forum Status',
                        value: '⏳ **PHMC** — Pending...\n⏳ **LSPD** — Pending...\n⏳ **LSSD** — Pending...',
                        inline: false,
                    })
                    .setFooter({ text: 'Reading cached forum data...' });
                await msg.edit({ embeds: [pendingEmbed], components: [row] });
            } catch {
                // Message deleted — will post fresh below
            }
        }

        // Use cached monitoring data for auto-refresh (no browser checks = no lock contention).
        // Live browser checks still happen via the "Refresh Now" button and system monitor.
        const [data] = await Promise.all([
            gatherDashboardData(db, false),
            new Promise(r => setTimeout(r, 1000)),
        ]);
        data.lastCheckTime = Date.now();
        const embed = buildDashboardEmbed(data);

        if (config.messageId) {
            try {
                const msg = await channel.messages.fetch(config.messageId);
                await msg.edit({ embeds: [embed], components: [row] });
                return;
            } catch {
                // Message was deleted — will post new one below
            }
        }

        // No existing message — post a new one
        const msg = await channel.send({ embeds: [embed], components: [row] });
        await db.ref(DASHBOARD_CONFIG_PATH).update({ messageId: msg.id });
        console.log(`[DASHBOARD] 📋 Dashboard posted in #${channel.name}`);
    } catch (err) {
        console.error('[DASHBOARD] ⚠️ Update error:', err.message);
    }
}

// ── Button Handler ──

export async function handleDashboardRefresh(interaction) {
    if (!interaction.isButton() || interaction.customId !== 'dashboard_refresh') return false;

    await interaction.deferReply({ ephemeral: true });

    try {
        const db = firebase.db;
        if (!db) {
            await interaction.editReply({ content: '⏳ Firebase not ready yet, please try again in a moment.' });
            return true;
        }

        // Helper to build a partial embed with mix of live + pending results
        const buildPartial = (results) => {
            const order = ['PHMC', 'LSPD', 'LSSD'];
            const lines = order.map(name => {
                const r = results.find(x => x.name === name);
                if (!r) return `⏳ **${name}** — Pending...`;
                const emoji = r.status === 'Good' ? '✅' : r.status === 'Bad' ? '⚠️' : '🔴';
                const latency = r.latency != null ? ` ${r.latency}ms` : '';
                return `${emoji} **${name}**${latency} — ${r.status}`;
            }).join('\n');

            return new EmbedBuilder()
                .setColor(0xffc107)
                .setTitle('🖥️ PHMC System Dashboard')
                .setDescription('⏳ Forum checks in progress...')
                .addFields({ name: '🌐 Forum Status', value: lines, inline: false })
                .setFooter({ text: 'Checking forums one at a time...' });
        };

        // Step 1: Show all pending
        const row = buildRefreshRow();
        await interaction.message.edit({ embeds: [buildPartial([])], components: [row] });

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
            // Update embed after each forum completes
            await interaction.message.edit({ embeds: [buildPartial(liveResults)], components: [row] });
        }

        // Step 3: Gather non-forum data and build final embed
        const data = await gatherDashboardData(db, false);
        data.forums = liveResults.map(f => ({
            ...f,
            emoji: f.status === 'Good' ? '✅' : f.status === 'Bad' ? '⚠️' : '🔴',
            lastChecked: Date.now(),
        }));
        data.lastCheckTime = Date.now();

        const finalEmbed = buildDashboardEmbed(data);
        await interaction.message.edit({ embeds: [finalEmbed], components: [row] });
        await interaction.editReply({ content: '✅ Dashboard refreshed! (live data)' });
    } catch (err) {
        console.error('[DASHBOARD] Refresh error:', err.message);
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

    await interaction.deferReply({ ephemeral: true });

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

export function startDashboardManager() {
    firebase.init();
    const db = firebase.db;

    // Recursive timer — next cycle starts after current one finishes (no overlap)
    async function scheduleNext() {
        await postOrUpdateDashboard(db);
        refreshInterval = setTimeout(scheduleNext, DASHBOARD_REFRESH_MS);
    }

    // Check if a dashboard is configured and start the cycle
    postOrUpdateDashboard(db).then(() => {
        refreshInterval = setTimeout(scheduleNext, DASHBOARD_REFRESH_MS);
    });

    console.log(`[DASHBOARD] ✅ Dashboard manager active (${DASHBOARD_REFRESH_MS / 60000}-min cycle, cached data).`);
}

export function stopDashboardManager() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
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
