/**
 * infoPanel.js — Leadership Information panel for the PHMC Discord launch.
 *
 * An owner-posted, button-navigated embed explaining what the bot does and
 * which commands matter. Sections:
 *   overview    — what the bot automates
 *   leadership  — essential Leadership / owner commands
 *   staff       — everyday ME & staff commands
 *   support     — outages, maintenance mode, how to report a problem
 *
 * Posted via /info-panel (owner only). Buttons are info_<section> and handled
 * by handleInfoButton() — wire it in index.js alongside the other customId
 * routes. Content is static (no Firebase reads) so the panel can never add
 * RTDB usage.
 */

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { state } from './deployState.js';

const COLOR = 0x2b6cb0;

// Fr0styDev = bot owner. Mention renders as a clickable tag (mentions inside
// embeds don't push-notify — this is intentional for a static panel).
const OWNER_MENTION = process.env.BOT_OWNER_ID
    ? `<@${process.env.BOT_OWNER_ID}>`
    : '<@228306972204597248>';

const SECTIONS = ['overview', 'leadership', 'staff', 'support'];

function sectionTitle(section) {
    switch (section) {
        case 'leadership': return 'PHMC Bot — Leadership Commands';
        case 'staff': return 'PHMC Bot — ME & Staff Guide';
        case 'support': return 'PHMC Bot — Outages & Support';
        case 'overview':
        default: return 'PHMC Bot — What It Does';
    }
}

function sectionBody(section) {
    switch (section) {
        case 'leadership':
            return [
                'Day-to-day you only need these. Anything else — the owner handles it.',
                '',
                '`/dashboard` — live system status (post it here, check it first when something looks wrong)',
                '`/rotation-list` — ME rotation order + who\u2019s carrying what',
                '`/autopsy-loa` — put an ME on/off LOA (blocks new assignments)',
                '`/reassign-autopsy` — move a case to another ME',
                '`/pending-reports` — see what\u2019s stuck waiting to post',
                '',
                `Everything beyond this list (retries, skips, maintenance, restarts, rotation changes) goes through the owner — ${OWNER_MENTION} — who's around daily. Don't guess at owner commands; ask.`,
            ].join('\n');
        case 'staff':
            return [
                '**Everyday commands**',
                '`/morgue` — search the morgue database',
                '`/patient-search` — find a patient thread (medical records forum)',
                '`/card` — generate a PHMC business card',
                '`/rotation-list` — see who\u2019s up next and current caseloads',
                '`/autopsy-loa` — put YOURSELF on/off LOA',
                '`/autopsy-request` — submit a supervised final-autopsy request',
                '',
                '**When you\u2019re assigned a case**',
                '1. You get pinged with the case number + links.',
                '2. Examine in-game, write the autopsy in the Forms app, save.',
                '3. The bot posts your reply to the case topic automatically.',
                '4. The requester gets notified — nothing else you need to do.',
                '',
                'If your reply doesn\u2019t appear within ~10 minutes, tell Leadership (don\u2019t re-save repeatedly — duplicates get skipped).',
            ].join('\n');
        case 'support': {
            const paused = state.maintenanceMode === true;
            return [
                `**Maintenance Status:** ${paused ? '🔴 Outage — queues paused' : '🟢 All Systems Normal'}`,
                '',
                '**Having an issue? Contact Fr0styDev** ' + OWNER_MENTION,
                '',
                '**Before you message, check:**',
                '1. `/dashboard` — red fields say what\u2019s actually broken.',
                '2. The status line above — if it says Outage, sit tight: queued work posts itself when queues resume, nothing is lost.',
                '3. Don\u2019t re-save a failed report twice — each save queues another deploy. Ask first.',
            ].join('\n');
        }
        case 'overview':
        default:
            return [
                'The PHMC bot connects the Forms web app, the forums, and this Discord. It runs 24/7 on PHMC infrastructure.',
                '',
                '**Report pipeline** — forms saved in the app are posted to the right forum automatically (consultations, coroner emails, death records, surgical/ER/psych notes…). If a post fails, the bot retries it and alerts here.',
                '',
                '**Autopsy case management** — watches the request forum, opens a case topic per request, assigns the next ME on rotation, pings them, posts their completed autopsy reply, and notifies the requesting party + faction crossposts.',
                '',
                '**Death records & Facebrowser** — matches CK reports against the morgue, drafts death records for review, and publishes approved Facebrowser posts.',
                '',
                '**Always-on utilities** — `/morgue` search, business cards, live dashboards (system status, deploy queue, ME assignments), and self-healing recovery sweeps that repair missed posts without staff lifting a finger.',
                '',
                'Use the buttons below: **Leadership** for command reference, **ME & Staff** for daily use, **Support** for outages.',
            ].join('\n');
    }
}

export function buildInfoEmbed(section = 'overview') {
    const key = SECTIONS.includes(section) ? section : 'overview';
    return new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(sectionTitle(key))
        .setDescription(sectionBody(key))
        .setFooter({ text: 'PHMC Bot — Information panel' })
        .setTimestamp();
}

export function buildInfoRow(active = 'overview') {
    const buttons = [
        ['overview', 'Overview', '📋'],
        ['leadership', 'Leadership', '🛡️'],
        ['staff', 'ME & Staff', '🩺'],
        ['support', 'Support', '🆘'],
    ].map(([key, label, emoji]) =>
        new ButtonBuilder()
            .setCustomId(`info_${key}`)
            .setLabel(label)
            .setEmoji(emoji)
            .setStyle(key === active ? ButtonStyle.Primary : ButtonStyle.Secondary),
    );
    return new ActionRowBuilder().addComponents(buttons);
}

/** Post a fresh panel to a channel. Returns the sent message. */
export async function postInfoPanel(channel, section = 'overview') {
    const msg = await channel.send({ embeds: [buildInfoEmbed(section)], components: [buildInfoRow(section)] });
    await trackPanel(msg.id, channel.id, section).catch(() => {});
    return msg;
}

/** Button router — returns true when it handled the interaction. */
export async function handleInfoButton(interaction) {
    if (!interaction.isButton() || !interaction.customId.startsWith('info_')) return false;
    const section = interaction.customId.slice('info_'.length);
    if (!SECTIONS.includes(section)) return false;
    try {
        await interaction.deferUpdate();
        await interaction.message.edit({ embeds: [buildInfoEmbed(section)], components: [buildInfoRow(section)] });
        await trackPanel(interaction.message.id, interaction.channelId, section).catch(() => {});
    } catch (err) {
        console.warn(`[INFO-PANEL] Button update failed: ${err.message}`);
    }
    return true;
}

// ── Panel tracking (push updates to already-posted panels) ──
// One tiny RTDB entry per posted panel: appMetadata/infoPanels/<messageId> =
// { channelId, section, updatedAt }. Button taps keep `section` current so a
// refresh re-renders each panel where its readers left it. Writes happen only
// on manual post / button tap / refresh — zero steady-state cost.

const TRACK_PATH = 'appMetadata/infoPanels';

async function trackDb() {
    const { default: firebase } = await import('./firebase.js');
    firebase.init();
    return firebase.db;
}

async function trackPanel(messageId, channelId, section) {
    if (!messageId || !channelId) return;
    const db = await trackDb();
    await db.ref(`${TRACK_PATH}/${messageId}`).set({
        channelId,
        section: SECTIONS.includes(section) ? section : 'overview',
        updatedAt: new Date().toISOString(),
    });
}

/**
 * Re-render every tracked panel from current code, in place.
 * Panels/messages/channels that are gone get untracked silently.
 * @returns {{updated:number, removed:number, failed:number}}
 */
export async function refreshAllPanels(client) {
    const result = { updated: 0, removed: 0, failed: 0 };
    let tracked = {};
    try {
        const db = await trackDb();
        const snap = await db.ref(TRACK_PATH).once('value');
        tracked = snap.exists() ? snap.val() || {} : {};
    } catch (err) {
        console.warn(`[INFO-PANEL] Refresh read failed: ${err.message}`);
        return result;
    }
    const db = await trackDb().catch(() => null);
    for (const [messageId, meta] of Object.entries(tracked)) {
        const section = SECTIONS.includes(meta?.section) ? meta.section : 'overview';
        try {
            const channel = await client.channels.fetch(meta?.channelId).catch(() => null);
            if (!channel?.messages) throw new Error('channel gone');
            const msg = await channel.messages.fetch(messageId).catch(() => null);
            if (!msg) throw new Error('message gone');
            await msg.edit({ embeds: [buildInfoEmbed(section)], components: [buildInfoRow(section)] });
            result.updated++;
        } catch {
            result.failed++;
            try {
                if (db) await db.ref(`${TRACK_PATH}/${messageId}`).remove();
                result.removed++;
            } catch { /* ignore */ }
        }
    }
    return result;
}
