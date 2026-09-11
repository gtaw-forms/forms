/**
 * phmcDashboard.js — dedicated PHMC Discord status dashboard.
 *
 * Simplified sibling of the main system dashboard: every section EXCEPT VPS
 * stats. Posts to the mapped PHMC channel (PHMC_CHANNELS.dashboard) on the
 * main dashboard's 10-min cycle, reusing its already-gathered data — zero
 * extra RTDB reads.
 *
 * PHMC PROCESS — READ-ONLY UNTIL AUTHORIZED: every post AND edit goes through
 * the PHMC_CHANNEL_SEND_ENABLED gate (see phmcChannels.js). While the VPS
 * .env does not set it to 'true', the cycle only logs suppression — the
 * mapping can still be proven any time with /phmc-dashboard status (fetch
 * only, never posts). Flip the env var + restart when the bot joins the
 * PHMC guild and the mapping is verified; the next cycle posts automatically.
 */

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { PHMC_CHANNELS, getChannelId, channelSendEnabled } from './phmcChannels.js';

export const PHMC_DASHBOARD_CONFIG_PATH = 'appMetadata/phmcDashboard';

export function buildPhmcEmbed(data) {
    const color = data.forums.some(f => f.status === 'Unresponsive')
        ? 0xdc3545 : data.forums.some(f => f.status === 'Bad')
        ? 0xffc107 : data.cloudflare.emoji === '⚠️'
        ? 0xffc107 : 0x28a745;

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle('🏥 PHMC Dashboard')
        .setDescription(`Last refreshed: <t:${Math.floor(Date.now() / 1000)}:R>\nData checked: ${data.lastCheckTime ? `<t:${Math.floor(data.lastCheckTime / 1000)}:R>` : 'awaiting first health check...'}`)
        .setFooter({ text: 'Full refresh every 10 minutes' });

    // Forum Status
    const forumLines = data.forums.map(f => {
        const parts = [f.name];
        if (f.latency != null) parts.push(`${f.latency}ms`);
        parts.push(f.status);
        return parts.join(' ');
    }).join('\n');
    embed.addFields({ name: '🌐 Forum Status', value: forumLines || 'No data', inline: false });

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
        embed.addFields({ name: '📦 Deploy Queue', value: '✅ No reports awaiting deployment', inline: false });
    }

    // Scheduled Face posts
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
        embed.addFields({ name: '📅 Scheduled Face Posts', value: '✅ None scheduled', inline: false });
    }

    // Scheduled Tasks
    const taskLines = [];
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
    const am = data.autopsyMonitor || {};
    if (am.active) {
        const intervalMin = Math.round((am.intervalMs || 300000) / 60000);
        const lastCheck = am.lastCheckTime ? `<t:${Math.floor(am.lastCheckTime / 1000)}:R>` : 'pending...';
        const statusIcon = am.lastCheckTime === null ? '⏳' : am.lastCheckSuccess ? '✅' : '❌';
        taskLines.push(`${statusIcon} **Autopsy Monitor** — every ${intervalMin}min (f=265)\n└ last check: ${lastCheck}`);
    } else {
        taskLines.push('⏹️ **Autopsy Monitor** — inactive');
    }
    embed.addFields({ name: '🔄 Scheduled Tasks', value: taskLines.join('\n') || 'None configured', inline: false });

    // ME Assignments
    const meLines = [];
    const assignments = data.meAssignments || [];
    const loaList = data.meLoa || [];
    const loaLower = loaList.map(n => n.toLowerCase());
    if (assignments.length > 0) {
        assignments.forEach((a) => {
            const loaTag = loaLower.includes(a.name.toLowerCase()) ? ' [LOA]' : '';
            const oocM = (a.caseNum || '').match(/\(\(\s*(.*?)\s*\)\)/);
            const oocLabel = oocM ? oocM[1] : a.caseNum || 'Case';
            const caseLink = a.caseUrl ? `[${oocLabel}](<${a.caseUrl}>)` : `*${oocLabel}*`;
            meLines.push(`**${a.name}**${loaTag} — ${caseLink}`);
        });
    }
    if (loaList.length > 0) meLines.push('', `_On LOA: ${loaList.join(', ')}_`);
    if (meLines.length === 0) meLines.push('No active assignments');
    embed.addFields({ name: '🔬 ME Assignments', value: meLines.join('\n'), inline: false });

    return embed;
}

function buildPhmcRow() {
    // Refresh only — deliberately no Restart button on the PHMC server.
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('phmc_dashboard_refresh')
            .setLabel('Refresh Now')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Secondary)
    );
}

/**
 * Post or update the PHMC dashboard using already-gathered data.
 * Gated: returns false without touching Discord unless channel sends are
 * explicitly enabled in the VPS .env.
 */
export async function postPhmcDashboard(client, db, data) {
    if (!client || !data) return false;
    if (!channelSendEnabled()) {
        console.log('[PHMC-DASH] Suppressed (read-only mode — set PHMC_CHANNEL_SEND_ENABLED=true to post)');
        return false;
    }
    const channelId = getChannelId('dashboard');
    if (!channelId) {
        console.warn('[PHMC-DASH] No dashboard channel mapped');
        return false;
    }
    try {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel || typeof channel.send !== 'function') {
            console.warn(`[PHMC-DASH] Channel ${channelId} not found or not sendable`);
            return false;
        }
        const snap = await db.ref(PHMC_DASHBOARD_CONFIG_PATH).once('value').catch(() => null);
        const messageId = snap?.val()?.messageId || null;
        const embed = buildPhmcEmbed(data);
        const row = buildPhmcRow();
        if (messageId) {
            try {
                const msg = await channel.messages.fetch(messageId);
                await msg.edit({ embeds: [embed], components: [row] });
                return true;
            } catch { /* gone — post fresh below */ }
        }
        const msg = await channel.send({ embeds: [embed], components: [row] });
        await db.ref(PHMC_DASHBOARD_CONFIG_PATH).set({
            messageId: msg.id,
            channelId,
            updatedAt: new Date().toISOString(),
        }).catch(() => {});
        console.log('[PHMC-DASH] 📋 Dashboard posted');
        return true;
    } catch (err) {
        console.warn(`[PHMC-DASH] Update failed: ${err.message}`);
        return false;
    }
}

/** Prove the channel mapping resolves (fetch only — never posts). */
export async function checkPhmcMapping(client) {
    const channelId = getChannelId('dashboard');
    if (!channelId) return { ok: false, reason: 'no dashboard channel mapped' };
    try {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) return { ok: false, reason: `channel ${channelId} not visible to the bot`, channelId };
        return { ok: true, channelId, name: channel.name || '?', sendable: typeof channel.send === 'function' };
    } catch (err) {
        return { ok: false, reason: err.message, channelId };
    }
}

/** Refresh-button router — returns true when handled. */
export async function handlePhmcRefresh(interaction) {
    if (!interaction.isButton() || interaction.customId !== 'phmc_dashboard_refresh') return false;
    await interaction.deferUpdate().catch(() => {});
    try {
        const { default: firebase } = await import('./firebase.js');
        firebase.init();
        const db = firebase.db;
        if (!db) return true;
        // Manual refresh = live gather (same pattern as the main dashboard button).
        const { gatherDashboardData } = await import('./dashboardManager.js');
        const data = await gatherDashboardData(db, true);
        data.lastCheckTime = Date.now();
        await postPhmcDashboard(interaction.client, db, data);
    } catch (err) {
        console.warn(`[PHMC-DASH] Refresh failed: ${err.message}`);
    }
    return true;
}
