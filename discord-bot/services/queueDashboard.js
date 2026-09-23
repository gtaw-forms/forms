/**
 * Queue Dashboard — lightweight embed showing the deploy queue in real time.
 *
 * Posts to the bot-spam channel and updates every 30 seconds.
 * No browser checks. Three data sources, all cheap:
 *   1. In-memory deploy queue (queued/processing, with fire times) — free.
 *   2. The tiny `retry-queue` RTDB index (failed forms + retry countdowns).
 *   3. The tiny `coroner-email-queue` RTDB node (pending emails).
 * Sources 2+3 refresh every 5 min into memory (≈600 tiny reads/day total);
 * countdowns render live regardless. Manual Refresh always reads fresh.
 * Never blocks the deploy system.
 */

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getQueuedDeployments } from './autoDeploy.js';
import { C } from './deployState.js';

const REFRESH_MS = 30 * 1000; // 30 seconds
const CONFIG_PATH = 'appMetadata/queueDashboard';
const MAX_RETRY_ATTEMPTS = C.MAX_RETRIES || 3;

let client = null;
let refreshTimer = null;
// Cached dashboard config (RTDB cost optimization): the 30s tick used to
// re-read appMetadata/queueDashboard every cycle (2,880 tiny reads/day).
// Now it's read once at startup/setup and kept in memory.
let cachedConfig = null;
// Label fallback cache for legacy retry-queue rows written before labels
// were indexed: key -> { label, formId } from a single-report read.
const retryLabelCache = new Map();
// Firebase-read cache: the in-memory queue is free to render every 30s, but
// the retry-queue + email-queue RTDB reads are cached for 5 min (≈576 tiny
// reads/day instead of ≈5,760). Countdowns (<t:...:R>) render live anyway.
const FIREBASE_CACHE_MS = 5 * 60 * 1000;
let firebaseCache = { at: 0, failed: null, emails: null };

export function setQueueDashboardClient(c) {
    client = c;
}

/** Read the tiny retry-queue index (failed forms awaiting their retry). */
async function getFailedRetries(db) {
    try {
        const snap = await db.ref('retry-queue').once('value').catch(() => null);
        if (!snap?.exists()) return [];
        const rows = [];
        snap.forEach((child) => {
            const v = child.val() || {};
            if (v.authorId && v.reportKey && v.retryAt) rows.push(v);
        });
        rows.sort((a, b) => new Date(a.retryAt).getTime() - new Date(b.retryAt).getTime());
        return rows;
    } catch {
        return [];
    }
}

/** Read non-terminal coroner-email entities (own tiny node, no big scans). */
async function getPendingEmails(db) {
    try {
        const snap = await db.ref('coroner-email-queue').once('value').catch(() => null);
        if (!snap?.exists()) return [];
        const rows = [];
        snap.forEach((child) => {
            const v = child.val() || {};
            if (['queued', 'sending', 'retry_queued', 'failed'].includes(v.status)) {
                rows.push({ key: child.key, ...v });
            }
        });
        return rows;
    } catch {
        return [];
    }
}

/** Fill in label/formId for pre-label index rows (one small read, cached). */
async function resolveRetryLabel(db, row) {
    if (row.label) return row;
    const key = `${row.authorId}|${row.reportKey}`;
    const cached = retryLabelCache.get(key);
    if (cached) return { ...row, ...cached };
    try {
        const snap = await db.ref(`scheduledReports/${row.authorId}/${row.reportKey}`).once('value').catch(() => null);
        const d = snap?.val() || {};
        const filled = {
            label: String(d.originalKey || row.reportKey || '').slice(0, 80),
            formId: String(d.formId || '').slice(0, 40),
        };
        retryLabelCache.set(key, filled);
        if (retryLabelCache.size > 200) retryLabelCache.clear();
        return { ...row, ...filled };
    } catch {
        return row;
    }
}

function truncateLines(lines, maxChars = 900) {
    let out = '';
    let shown = 0;
    for (const line of lines) {
        if ((out + line).length > maxChars) break;
        out += (out ? '\n' : '') + line;
        shown++;
    }
    if (shown < lines.length) out += `\n…and ${lines.length - shown} more`;
    return out || '(none)';
}

async function buildQueueEmbed(db, { fresh = false } = {}) {
    const entries = getQueuedDeployments();
    let failed = firebaseCache.failed || [];
    let emails = firebaseCache.emails || [];
    if (db && (fresh || Date.now() - firebaseCache.at > FIREBASE_CACHE_MS)) {
        failed = await getFailedRetries(db);
        emails = await getPendingEmails(db);
        firebaseCache = { at: Date.now(), failed, emails };
    }

    const embed = new EmbedBuilder()
        .setColor(failed.length > 0 ? 0xe74c3c : entries.length > 0 ? 0xffc107 : 0x28a745)
        .setTitle('Deploy Queue')
        .setDescription(`Last updated: <t:${Math.floor(Date.now() / 1000)}:R>`)
        .setFooter({ text: `Auto-refreshes every ${REFRESH_MS / 1000}s` });

    if (entries.length === 0) {
        embed.addFields({ name: 'Queued Forms — INFO', value: 'No reports awaiting deployment', inline: false });
    } else {
        const lines = entries.map((e, i) => {
            const icon = e.status === 'processing' ? '🔄' : '⏳';
            const timeStr = e.status === 'processing'
                ? 'Processing now'
                : `<t:${Math.floor(e.fireTime / 1000)}:R>`;
            const forumStr = e.forum ? ` (${e.forum})` : '';
            const typeStr = e.type ? ` [${e.type}]` : '';
            return `**${i + 1}.** ${icon} **${e.label}**${typeStr}${forumStr}\n└ ${timeStr}`;
        });
        embed.addFields({ name: `Queued Forms — INFO (${entries.length})`, value: truncateLines(lines), inline: false });
    }

    if (failed.length === 0) {
        embed.addFields({ name: 'Failed Queued Forms', value: 'No failed retries pending', inline: false });
    } else {
        const lines = [];
        for (const row of failed.slice(0, 10)) {
            const full = await resolveRetryLabel(db, row);
            const attempts = `${row.deployRetries || 0}/${MAX_RETRY_ATTEMPTS}`;
            const formStr = full.formId ? ` [${full.formId}]` : '';
            const detail = full.detail ? `\n└ ${full.detail.slice(0, 120)}` : '';
            lines.push(`❌ **${full.label || row.reportKey}**${formStr} — attempt ${attempts} — starting <t:${Math.floor(new Date(row.retryAt).getTime() / 1000)}:R>${detail}`);
        }
        if (failed.length > 10) lines.push(`…and ${failed.length - 10} more`);
        embed.addFields({ name: `Failed Queued Forms (${failed.length})`, value: truncateLines(lines), inline: false });
    }

    if (emails.length > 0) {
        const lines = emails.slice(0, 8).map((e) => {
            const where = e.forumLabel ? ` (${e.forumLabel} → ${e.recipient || '?'})` : '';
            if (e.status === 'retry_queued' && e.retryAt) {
                return `⏳ **${e.subject || e.key}**${where} — attempt ${e.attempts || 0} — starting <t:${Math.floor(new Date(e.retryAt).getTime() / 1000)}:R>`;
            }
            if (e.status === 'failed') {
                return `❌ **${e.subject || e.key}**${where} — failed${e.lastError ? `: ${String(e.lastError).slice(0, 100)}` : ''}`;
            }
            const stateIcon = e.status === 'sending' ? '🔄' : '⏳';
            return `${stateIcon} **${e.subject || e.key}**${where} — ${e.status}`;
        });
        if (emails.length > 8) lines.push(`…and ${emails.length - 8} more`);
        embed.addFields({ name: `Coroner Emails (${emails.length})`, value: truncateLines(lines), inline: false });
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
        // Refresh cache on first tick (or if wiped); setup/destroy keep it fresh.
        if (!cachedConfig) {
            const configSnap = await db.ref(CONFIG_PATH).once('value');
            cachedConfig = configSnap.val() || null;
        }
        const config = cachedConfig;
        if (!config || !config.channelId) return;

        const channel = await client.channels.fetch(config.channelId).catch(() => null);
        if (!channel) {
            console.warn('[QUEUE] Channel not found, clearing config.');
            await db.ref(CONFIG_PATH).set(null);
            cachedConfig = null;
            return;
        }

        const embed = await buildQueueEmbed(db);
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
        cachedConfig = { ...config, messageId: msg.id };
        console.log(`[QUEUE] Posted in #${channel.name}`);
    } catch (err) {
        console.error('[QUEUE] Update error:', err.message);
    }
}

export async function handleQueueRefresh(interaction) {
    if (!interaction.isButton() || interaction.customId !== 'queue_refresh') return false;

    await interaction.deferReply({ ephemeral: true });
    const firebase = (await import('./firebase.js')).default;
    firebase.init();
    const embed = await buildQueueEmbed(firebase.db, { fresh: true });
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
    cachedConfig = { channelId, messageId: null };
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
    cachedConfig = null;
    console.log('[QUEUE] Dashboard destroyed');
}
