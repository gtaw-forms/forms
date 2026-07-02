/**
 * Queue Dashboard — lightweight embed showing the deploy queue in real time.
 *
 * Posts to the bot-spam channel and updates every 30 seconds.
 * No browser checks, no Firebase reads — purely in-memory queue data.
 * Never blocks the deploy system.
 */

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getQueuedDeployments } from './autoDeploy.js';

const REFRESH_MS = 30 * 1000; // 30 seconds
const CONFIG_PATH = 'appMetadata/queueDashboard';

let client = null;
let refreshTimer = null;

export function setQueueDashboardClient(c) {
    client = c;
}

function buildQueueEmbed() {
    const entries = getQueuedDeployments();

    const embed = new EmbedBuilder()
        .setColor(entries.length > 0 ? 0xffc107 : 0x28a745)
        .setTitle('Deploy Queue')
        .setDescription(`Last updated: <t:${Math.floor(Date.now() / 1000)}:R>`)
        .setFooter({ text: `Auto-refreshes every ${REFRESH_MS / 1000}s` });

    if (entries.length === 0) {
        embed.addFields({
            name: 'Status',
            value: 'No reports awaiting deployment',
            inline: false,
        });
    } else {
        const lines = entries.map((e, i) => {
            const icon = e.status === 'processing' ? '🔄' : '⏳';
            const timeStr = e.status === 'processing'
                ? 'Processing now'
                : `<t:${Math.floor(e.fireTime / 1000)}:R>`;
            const forumStr = e.forum ? ` (${e.forum})` : '';
            return `**${i + 1}.** ${icon} **${e.label}**${forumStr}\n└ ${timeStr}`;
        });
        embed.addFields({
            name: `Queue (${entries.length})`,
            value: lines.join('\n'),
            inline: false,
        });
    }

    return embed;
}

function buildRefreshRow() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('queue_refresh')
                .setLabel('Refresh')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Secondary),
        );
}

async function postOrUpdate(db) {
    if (!client) return;

    try {
        const configSnap = await db.ref(CONFIG_PATH).once('value');
        const config = configSnap.val();
        if (!config || !config.channelId) return;

        const channel = await client.channels.fetch(config.channelId).catch(() => null);
        if (!channel) {
            console.warn('[QUEUE] Channel not found, clearing config.');
            await db.ref(CONFIG_PATH).set(null);
            return;
        }

        const embed = buildQueueEmbed();
        const row = buildRefreshRow();

        if (config.messageId) {
            try {
                const msg = await channel.messages.fetch(config.messageId);
                await msg.edit({ embeds: [embed], components: [row] });
                return;
            } catch {
                // deleted — post fresh below
            }
        }

        const msg = await channel.send({ embeds: [embed], components: [row] });
        await db.ref(CONFIG_PATH).update({ messageId: msg.id });
        console.log(`[QUEUE] Posted in #${channel.name}`);
    } catch (err) {
        console.error('[QUEUE] Update error:', err.message);
    }
}

export async function handleQueueRefresh(interaction) {
    if (!interaction.isButton() || interaction.customId !== 'queue_refresh') return false;

    await interaction.deferReply({ ephemeral: true });
    const embed = buildQueueEmbed();
    const row = buildRefreshRow();
    await interaction.message.edit({ embeds: [embed], components: [row] });
    await interaction.editReply({ content: 'Queue refreshed.' });
    return true;
}

export async function startQueueDashboard() {
    const { default: firebase } = await import('./firebase.js');
    firebase.init();
    const db = firebase.db;

    async function tick() {
        await postOrUpdate(db);
        refreshTimer = setTimeout(tick, REFRESH_MS);
    }

    // Check if configured and start
    db.ref(CONFIG_PATH).once('value', (snap) => {
        if (snap.val()) {
            tick();
            console.log(`[QUEUE] Dashboard active (${REFRESH_MS / 1000}s cycle)`);
        } else {
            console.log('[QUEUE] Not configured — use /queue-dashboard setup to enable');
        }
    });
}

export async function setupQueueDashboard(channelId) {
    const firebase = await import('./firebase.js');
    firebase.default.init();
    const db = firebase.default.db;

    await db.ref(CONFIG_PATH).set({
        channelId,
        messageId: null,
        createdAt: new Date().toISOString(),
    });
    await postOrUpdate(db);

    // Start the timer if not running
    if (!refreshTimer) {
        async function tick() {
            await postOrUpdate(db);
            refreshTimer = setTimeout(tick, REFRESH_MS);
        }
        tick();
    }
}

export async function destroyQueueDashboard() {
    const firebase = await import('./firebase.js');
    firebase.default.init();
    const db = firebase.default.db;

    try {
        const configSnap = await db.ref(CONFIG_PATH).once('value');
        const config = configSnap.val();
        if (config?.channelId && config?.messageId && client) {
            const channel = await client.channels.fetch(config.channelId).catch(() => null);
            if (channel) {
                try {
                    const msg = await channel.messages.fetch(config.messageId);
                    await msg.delete();
                } catch { /* gone */ }
            }
        }
    } catch { /* ignore */ }
    await db.ref(CONFIG_PATH).set(null);
    console.log('[QUEUE] Dashboard destroyed');
}
