/**
 * deathRecordDraftUI.js — Discord embeds, buttons, and message management
 * for the Death Record draft approval workflow.
 */
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import { shortId } from './deathRecordDraftCache.js';
import { generateFacePostContent, isFaceConfigured } from './facePost.js';

let _client = null;
let _forumClient = null;

export const DRAFT_CHANNEL_ID = process.env.DEATH_RECORD_DRAFT_CHANNEL_ID || process.env.DASHBOARD_CHANNEL_ID;

// ── Client Registration ──

/**
 * Register the bot client instance (called from index.js).
 */
export function setDraftClient(client) {
    _client = client;
}

/**
 * Register the forum client (called from autoDeploy.js setup).
 */
export function setDraftForumClient(fc) {
    _forumClient = fc;
}

/**
 * Get the bot client (for use by action handlers that need to fetch/edit messages).
 * @returns {object|null}
 */
export function getDraftClient() {
    return _client;
}


// ── Draft Message Sending ──

/**
 * Render the match-confidence field for a draft embed.
 * Shows the confidence score plus similarly-matching candidates so reviewers
 * (and later debuggers) can see why a specific morgue case was chosen.
 */
function formatMatchField(matchInfo) {
    if (!matchInfo) return null;

    const head = matchInfo.identified
        ? `[OK] HIGH — ${matchInfo.oocMatched ? 'unidentified case' : 'identified case'} #${matchInfo.caseId || '?'}`
        : `[WARN] LOW — unidentified case #${matchInfo.caseId || '?'}`;

    const notes = [];
    if (matchInfo.oocMatched) {
        notes.push(`record is "Unknown (( ... ))" — OOC (( ${matchInfo.recordOocName || '?'} )) validated against report decedentOOC`);
    }
    if (!matchInfo.referenceDateUsed && matchInfo.candidateCount > 1) {
        notes.push('no usable reference date — closest-date tie-break skipped');
    }
    if (matchInfo.sourceAge === 'Unknown') {
        notes.push('morgue record has no estimated age');
    }
    if (matchInfo.referenceDateParsed) {
        notes.push(`reference date: ${matchInfo.referenceDateParsed}`);
    }

    const lines = [head];
    for (const n of notes) lines.push(`  • ${n}`);

    if (matchInfo.candidates?.length > 0) {
        const parts = matchInfo.candidates.slice(0, 4).map((c) => {
            const label = c.identified ? (c.name || `#${c.caseId || '?'}`) : `#${c.caseId || '?'} (unidentified)`;
            const when = c.dateDistanceDays != null ? ` ~${c.dateDistanceDays}d from ref` : ' (no date)';
            const age = c.estimatedAge && c.estimatedAge !== 'Unknown' ? `, age ${c.estimatedAge}` : '';
            return `${label}${when}${age}`;
        });
        lines.push(`Candidates: ${parts.join(' | ')}${matchInfo.candidates.length > 4 ? ' | …' : ''}`);
    }

    return { name: 'Match Confidence', value: lines.join('\n'), inline: false };
}

/**
 * Send a Death Record draft to Discord with review buttons.
 * @param {object} draft - Generated draft { bbCode, title, values, filledFields }
 * @param {object} reportData - Original report data
 * @param {string} authorId
 * @param {string} reportKey
 * @param {boolean} needsMorgue - True if no morgue record was found at draft time
 * @param {object|null} matchInfo - Match debug { level, identified, candidates, ... } from findMorgueRecord
 */
export async function sendDraft(draft, reportData, authorId, reportKey, needsMorgue, matchInfo) {
    if (!_client) {
        console.warn('[DRAFT] [WARN] No Discord client — cannot send draft');
        return null;
    }
    if (!DRAFT_CHANNEL_ID) {
        console.warn('[DRAFT] [WARN] No DEATH_RECORD_DRAFT_CHANNEL_ID in .env');
        return null;
    }

    const channel = await _client.channels.fetch(DRAFT_CHANNEL_ID).catch(() => null);
    if (!channel) {
        console.error('[DRAFT] [ERR] Could not fetch draft channel');
        return null;
    }

    const bbPreview = draft.bbCode.length > 800
        ? draft.bbCode.slice(0, 800) + '...'
        : draft.bbCode;

    const lowMatch = matchInfo?.level === 'low';

    const fields = [
        { name: 'Decedent', value: reportData.data?.decedentName || 'Unknown', inline: true },
        { name: 'OOC', value: reportData.data?.decedentOOC || 'N/A', inline: true },
        { name: 'Department', value: reportData.data?.department || 'N/A', inline: true },
        { name: 'Report Type', value: reportData.formId || 'Unknown', inline: true },
    ];

    let footerText = 'PHMC Death Record Draft — Full BBCode attached as .txt';
    if (needsMorgue) {
        fields.push({ name: 'Morgue Status', value: '[WARN] No morgue record found. Use Check Morgue to re-check later.', inline: false });
        footerText = 'PHMC Death Record Draft — Pending morgue data | Click Check Morgue to re-query';
    }

    fields.push(
        { name: 'BBCode Preview', value: `\`\`\`${bbPreview}\`\`\``, inline: false },
        { name: 'Key', value: `\`${reportKey}\``, inline: false },
    );

    const matchField = formatMatchField(matchInfo);
    if (matchField) fields.push(matchField);

    // Show reviewers exactly what the automated Facebrowser post will say. Uses
    // the same generator as publish time (only the forum link, added at publish,
    // is absent). The content is short — well under Discord's 1024-char field cap.
    if (isFaceConfigured()) {
        const faceContent = generateFacePostContent({
            title: draft.title,
            decedentName: reportData.data?.decedentName || '',
            values: draft.values || {},
        });
        const facePreview = faceContent.length > 850 ? faceContent.slice(0, 850) + '…' : faceContent;
        fields.push({
            name: 'Face Post Preview',
            value: '```' + facePreview + '```\n*(Auto-posted on approve — forum link appended at publish)*',
            inline: false,
        });
    }

    if (lowMatch) {
        footerText = 'PHMC Death Record Draft — Low-confidence morgue match | Verify details before approve';
    }

    const embed = new EmbedBuilder()
        .setTitle('Death Record Draft — Pending Review')
        .setColor(needsMorgue ? 0xff6b35 : lowMatch ? 0xe67e22 : 0xffa500)
        .setDescription(`**${draft.title}**`)
        .addFields(fields)
        .setFooter({ text: footerText })
        .setTimestamp();

    const bbFile = new AttachmentBuilder(Buffer.from(draft.bbCode, 'utf-8'), { name: 'death-record-bbcode.txt' });

    const row = new ActionRowBuilder();
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`dr_approve_${shortId(reportKey)}`)
            .setLabel('Approve & Post')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`dr_editfields_${shortId(reportKey)}`)
            .setLabel('Edit Fields')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`dr_edit_${shortId(reportKey)}`)
            .setLabel('Edit BBCode')
            .setStyle(ButtonStyle.Secondary),
    );
    if (needsMorgue || lowMatch) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`dr_checkmorgue_${shortId(reportKey)}`)
                .setLabel('Check Morgue')
                .setStyle(ButtonStyle.Secondary),
        );
    }
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`dr_deny_${shortId(reportKey)}`)
            .setLabel('Deny')
            .setStyle(ButtonStyle.Danger),
    );

    const msg = await channel.send({
        embeds: [embed],
        components: [row],
        files: [bbFile],
    });

    console.log(`[DRAFT] [OK] Draft sent to #${channel.name} (${msg.id})`);
    return msg;
}

// ── Draft Message Update ──

/**
 * Update the draft message after approval/denial.
 */
export async function updateDraftMessage(msgId, status, resultUrl) {
    if (!_client || !DRAFT_CHANNEL_ID) return;

    const channel = await _client.channels.fetch(DRAFT_CHANNEL_ID).catch(() => null);
    if (!channel) return;

    const msg = await channel.messages.fetch(msgId).catch(() => null);
    if (!msg) return;

    const embed = EmbedBuilder.from(msg.embeds[0])
        .setColor(status === 'approved' ? 0x28a745 : 0xdc3545)
        .setTitle(status === 'approved' ? 'Death Record — Approved & Posted' : 'Death Record — Denied');

    if (resultUrl) {
        embed.addFields({ name: 'Forum URL', value: resultUrl, inline: false });
    }

    const disabledRow = ActionRowBuilder.from(msg.components[0]);
    disabledRow.components.forEach((btn) => btn.setDisabled(true));

    await msg.edit({ embeds: [embed], components: [disabledRow] });
}

/**
 * Add or update a "Facebrowser Post" field on a death record draft embed so
 * staff can see the Face post status (draft sent / published) on the original
 * death record message without opening a separate view.
 * @param {string} msgId - death record draft message id
 * @param {string} text - status text (e.g. "Draft sent for review", "Published: <url>")
 */
export async function updateDraftFaceField(msgId, text) {
    if (!_client || !DRAFT_CHANNEL_ID || !msgId) return;
    const channel = await _client.channels.fetch(DRAFT_CHANNEL_ID).catch(() => null);
    if (!channel) return;
    const msg = await channel.messages.fetch(msgId).catch(() => null);
    if (!msg || !msg.embeds[0]) return;

    const embed = EmbedBuilder.from(msg.embeds[0]);
    const field = { name: 'Facebrowser Post', value: text, inline: false };
    const idx = (embed.data.fields || []).findIndex((f) => f.name === 'Facebrowser Post');
    if (idx !== -1) embed.spliceFields(idx, 1, field);
    else embed.addFields(field);

    await msg.edit({ embeds: [embed] });
}

/**
 * Update the Discord draft message after a morgue re-check found data.
 * @param {string} msgId - death record draft message id
 * @param {string} newBbCode - regenerated BBCode
 * @param {object|null} matchInfo - match debug from the re-check
 */
export async function updateDraftWithMorgue(msgId, newBbCode, matchInfo) {
    if (!_client || !DRAFT_CHANNEL_ID) return;
    const channel = await _client.channels.fetch(DRAFT_CHANNEL_ID).catch(() => null);
    if (!channel) return;
    const msg = await channel.messages.fetch(msgId).catch(() => null);
    if (!msg || !msg.embeds[0]) return;

    const embed = EmbedBuilder.from(msg.embeds[0])
        .setColor(matchInfo?.level === 'low' ? 0xe67e22 : 0xffa500)
        .setFooter({ text: matchInfo?.level === 'low'
            ? 'PHMC Death Record Draft — Re-checked, still low-confidence | Verify before approve'
            : 'PHMC Death Record Draft — Morgue data matched | Full BBCode attached' });

    if (embed.data.fields?.[4]?.name === 'Morgue Status') {
        embed.spliceFields(4, 1, { name: 'Morgue Status', value: '[OK] Morgue record found!', inline: false });
    }

    const matchField = formatMatchField(matchInfo);
    const matchIdx = (embed.data.fields || []).findIndex((f) => f.name === 'Match Confidence');
    if (matchField) {
        if (matchIdx !== -1) embed.spliceFields(matchIdx, 1, matchField);
        else embed.addFields(matchField);
    } else if (matchIdx !== -1) {
        embed.spliceFields(matchIdx, 1);
    }

    const bbPreview = newBbCode.length > 800 ? newBbCode.slice(0, 800) + '...' : newBbCode;
    const previewIdx = embed.data.fields?.findIndex((f) => f.name === 'BBCode Preview');
    if (previewIdx !== -1 && previewIdx !== undefined) {
        embed.spliceFields(previewIdx, 1, { name: 'BBCode Preview', value: `\`\`\`${bbPreview}\`\`\``, inline: false });
    }

    const row = ActionRowBuilder.from(msg.components[0]);
    row.components = row.components.filter((btn) => !(btn.data.custom_id || '').startsWith('dr_checkmorgue_'));

    await msg.edit({ embeds: [embed], components: [row] });
}
