/**
 * deathRecordDraftFace.js — Discord review flow for Facebrowser Public Death
 * Record posts. Mirrors the Death Record draft approval workflow but posts to
 * the Facebrowser page instead of the forum.
 *
 * Buttons:  face_approve_<shortId>, face_edit_<shortId>, face_deny_<shortId>
 * Modal:    face_edit_modal_<shortId>
 */
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { shortId, findMorgueRecord } from './deathRecordDraftCache.js';
import { getDraftClient, updateDraftFaceField } from './deathRecordDraftUI.js';
import { generateDraft, baseReportKey, decedentFromReport, buildVirtualReportData } from './deathRecordDraftGenerator.js';
import { generateFacePostContent, postToFace, isFaceConfigured, isFaceDryRun } from './facePost.js';

const FACE_TRACK_PATH = 'facePostDrafts';
const DEATH_RECORD_TRACK_PATH = 'deathRecordDrafts';

export const FACE_DRAFT_CHANNEL_ID = process.env.FACE_DRAFT_CHANNEL_ID || process.env.DEATH_RECORD_DRAFT_CHANNEL_ID;

// Face posts are scheduled (approval + delay) rather than published instantly,
// giving a window for next-of-kin searching. The delay is configurable; the
// sweep publishes due posts regardless of FACE_DRY_RUN (which still simulates).
export const FACE_PUBLISH_DELAY_HOURS = parseFloat(process.env.FACE_PUBLISH_DELAY_HOURS || '48');
const FACE_PUBLISH_DELAY_MS = (Number.isFinite(FACE_PUBLISH_DELAY_HOURS) ? FACE_PUBLISH_DELAY_HOURS : 0) * 3600 * 1000;
const FACE_SWEEP_INTERVAL_MS = 60 * 1000;

const PREFIX_APPROVE = 'face_approve_';
const PREFIX_EDIT = 'face_edit_';
const PREFIX_DENY = 'face_deny_';
const MODAL_PREFIX = 'face_edit_modal_';

// ── Create / send draft ──

/**
 * Resolve the field values used to build a Face post.
 *
 * Drafts created before the values-persistence fix (passive CK listener path
 * `checkAndDraftIfMorgueMatched` and the manual `scanAndDraftCKs` path) lack the
 * `values` object — only bbCode/title/decedentName are stored. When that happens,
 * reconstruct `values` from the source coroner report + morgue record via
 * generateDraft so the social post shows the full record instead of just the name.
 *
 * @param {object} db - Firebase ref
 * @param {object} draftInfo - deathRecordDrafts/<reportKey> entry
 * @param {string} reportKey
 * @returns {Promise<object|null>} values, or null if they can't be derived
 */
async function resolveFacePostValues(db, draftInfo, reportKey) {
    if (draftInfo?.values && Object.values(draftInfo.values).some(v => v)) {
        return draftInfo.values;
    }

    let reportData = null;
    const candidates = [...new Set([reportKey, baseReportKey(reportKey)])];
    for (const candidateKey of candidates) {
        const schedSnap = await db.ref(`scheduledReports/${draftInfo.authorId}/${candidateKey}`).once('value').catch(() => null);
        if (schedSnap?.exists()) { reportData = schedSnap.val(); break; }
        const newSnap = await db.ref(`newSavedReports/${draftInfo.authorId}/${candidateKey}`).once('value').catch(() => null);
        if (newSnap?.exists()) { reportData = newSnap.val(); break; }
    }
    if (!reportData) {
        console.warn(`[FACE] [WARN] ${reportKey} — no values on draft and source report not found, Face post will be minimal`);
        return null;
    }

    // Mass-fatality drafts live under a base key with a _decedentN suffix — merge
    // the per-decedent data so the post shows the right name/date, not the base report.
    if (reportData.formId === 'mass-ftality-test') {
        const dec = decedentFromReport(reportData, reportKey);
        if (dec) reportData = { ...reportData, data: buildVirtualReportData(reportData, dec) };
    }

    const morgueRecord = await findMorgueRecord(db, draftInfo.decedentName, reportData.data?.dateTime || reportData.data?.dateOfDeath, draftInfo.decedentOOC);
    const draft = generateDraft(reportData, morgueRecord);
    return draft?.values || null;
}

/**
 * Schedule the Facebrowser post for a death record. Called from the death
 * record approval flow after the forum post lands.
 *
 * Instead of publishing immediately, writes a `scheduled` entry with a
 * `publishAt` of approval + FACE_PUBLISH_DELAY_HOURS (default 48h); the
 * publish sweep posts it once it's due (real or simulated per FACE_DRY_RUN).
 *
 * @param {object} db - Firebase ref
 * @param {object} draftInfo - deathRecordDrafts/<reportKey> entry
 * @param {string} reportKey
 * @param {object} [opts]
 * @param {string} [opts.forumUrl] - Link to the approved public forum record
 * @returns {Promise<{scheduled: boolean, publishAt: number, already?: boolean}|{url, postId, simulated, already?: boolean}|null>}
 */
export async function createFaceDraft(db, draftInfo, reportKey, { forumUrl } = {}) {
    if (!isFaceConfigured()) {
        console.log('[FACE] [WARN] Face not configured (FACE_API_KEY/FACE_PAGE_ID) — skipping Face post for ' + reportKey);
        return null;
    }

    // Idempotency: never double-schedule. Approved entries are final; a pending
    // schedule is returned as-is.
    const existingSnap = await db.ref(`${FACE_TRACK_PATH}/${reportKey}`).once('value').catch(() => null);
    const existing = existingSnap?.exists() ? existingSnap.val() : null;
    if (existing && (existing.status === 'approved' || existing.status === 'approved_simulated')) {
        console.log(`[FACE] [WARN] ${reportKey} — Face post already published, skipping`);
        return { url: existing.deployedUrl || null, postId: existing.fbPostId || null, simulated: existing.status === 'approved_simulated', already: true };
    }
    if (existing && existing.status === 'scheduled') {
        console.log(`[FACE] [OK] ${reportKey} — Face post already scheduled for ${existing.publishAt ? new Date(existing.publishAt).toUTCString() : '?'}`);
        return { scheduled: true, publishAt: existing.publishAt || null, already: true };
    }

    // Drafts from the passive/scan paths may lack `values` — reconstruct + persist.
    const resolvedValues = await resolveFacePostValues(db, draftInfo, reportKey);
    if (resolvedValues) {
        await db.ref(`${DEATH_RECORD_TRACK_PATH}/${reportKey}`).update({ values: resolvedValues }).catch(() => {});
    }

    const content = generateFacePostContent({ ...draftInfo, values: resolvedValues || {} }, { forumUrl });
    const publishAt = Date.now() + FACE_PUBLISH_DELAY_MS;

    await db.ref(`${FACE_TRACK_PATH}/${reportKey}`).set({
        reportKey,
        content,
        forumUrl: forumUrl || null,
        forumTitle: draftInfo.title || '',
        decedentName: draftInfo.decedentName || '',
        status: 'scheduled',
        publishAt,
        createdAt: Date.now(),
    });

    try { await db.ref(`${FACE_TRACK_PATH}/_ids/${shortId(reportKey)}`).set(reportKey); } catch (e) {}

    console.log(`[FACE] [OK] ${reportKey} — Face post scheduled for ${new Date(publishAt).toUTCString()} (+${FACE_PUBLISH_DELAY_HOURS}h)`);
    return { scheduled: true, publishAt };
}

/**
 * Publish a scheduled Face post now (real or simulated per FACE_DRY_RUN).
 * Updates the facePostDrafts entry and reflects the result on the death record
 * draft embed. No-op unless the entry is `scheduled` and past its publishAt.
 * @param {object} db - Firebase ref
 * @param {string} reportKey
 * @returns {Promise<{url: string, postId: number|null, simulated: boolean}|null>}
 */
async function publishScheduledFacePost(db, reportKey) {
    const snap = await db.ref(`${FACE_TRACK_PATH}/${reportKey}`).once('value').catch(() => null);
    const entry = snap?.exists() ? snap.val() : null;
    if (!entry || entry.status !== 'scheduled') return null;
    if (!entry.publishAt || entry.publishAt > Date.now()) return null;

    let result;
    if (isFaceDryRun()) {
        result = { url: `https://face.gta.world/post/SIM_${Date.now()}`, postId: null, simulated: true };
        console.log(`[FACE] [DRY-RUN] ${reportKey} — Face post simulated (${result.url})`);
    } else {
        try {
            result = await postToFace(entry.content);
            console.log(`[FACE] [OK] ${reportKey} — Face post published as #${result.postId} (${result.url})`);
        } catch (err) {
            console.error(`[FACE] [ERR] ${reportKey} — Face post publish failed: ${err.message}`);
            await db.ref(`${FACE_TRACK_PATH}/${reportKey}`).update({
                status: 'failed',
                lastError: err.message.slice(0, 300),
                publishErrorAt: Date.now(),
            }).catch(() => {});
            return null;
        }
    }

    await db.ref(`${FACE_TRACK_PATH}/${reportKey}`).update({
        status: result.simulated ? 'approved_simulated' : 'approved',
        deployedUrl: result.url,
        fbPostId: result.postId || null,
        deployedAt: Date.now(),
        dryRun: !!result.simulated,
        lastError: null,
    });

    await markDeathRecordFaceField(db, reportKey, result.simulated
        ? `Simulated (FACE_DRY_RUN): ${result.url}`
        : `Published: ${result.url}`);

    return { url: result.url, postId: result.postId || null, simulated: !!result.simulated };
}

let _sweepTimer = null;
const _sweepInFlight = new Set();

/**
 * Start the Face publish sweep — periodically publishes scheduled posts whose
 * 48h wait is over. Call once from index.js on bot ready.
 */
export async function startFacePublishSweep() {
    if (_sweepTimer) {
        console.log('[FACE] Publish sweep already running.');
        return;
    }

    const { default: firebase } = await import('./firebase.js');
    firebase.init();
    const db = firebase.db;

    console.log(`[FACE] Publish sweep starting — ${FACE_PUBLISH_DELAY_HOURS}h delay, checking every ${FACE_SWEEP_INTERVAL_MS / 1000}s.`);

    // First check shortly after startup, then on the interval.
    setTimeout(() => runFacePublishSweep(db), 10 * 1000);
    _sweepTimer = setInterval(() => runFacePublishSweep(db), FACE_SWEEP_INTERVAL_MS);
}

/**
 * Stop the publish sweep (cleanup on shutdown).
 */
export function stopFacePublishSweep() {
    if (_sweepTimer) {
        clearInterval(_sweepTimer);
        _sweepTimer = null;
    }
}

/**
 * Find all scheduled Face posts past their publishAt and publish them.
 */
async function runFacePublishSweep(db) {
    try {
        const snap = await db.ref(FACE_TRACK_PATH).once('value').catch(() => null);
        if (!snap?.exists()) return;

        const now = Date.now();
        const due = [];
        snap.forEach((child) => {
            if (child.key === '_ids') return;
            const v = child.val() || {};
            if (v.status === 'scheduled' && v.publishAt && v.publishAt <= now) due.push(child.key);
        });
        if (due.length === 0) return;

        console.log(`[FACE] Publish sweep — ${due.length} due post(s)`);
        for (const key of due) {
            if (_sweepInFlight.has(key)) continue;
            _sweepInFlight.add(key);
            try {
                await publishScheduledFacePost(db, key);
            } catch (err) {
                console.error(`[FACE] [ERR] Sweep publish failed for ${key}:`, err.message);
            } finally {
                _sweepInFlight.delete(key);
            }
        }
    } catch (err) {
        console.error('[FACE] Publish sweep error:', err.message);
    }
}

async function sendFaceDraftMessage(channel, content, draftInfo, reportKey, forumUrl) {
    const dryRun = isFaceDryRun();
    const bbPreview = content.length > 800 ? content.slice(0, 800) + '...' : content;

    const fields = [
        { name: 'Decedent', value: draftInfo.decedentName || 'Unknown', inline: true },
        { name: 'Forum Record', value: forumUrl || 'Pending', inline: false },
        { name: 'Key', value: `\`${reportKey}\``, inline: false },
    ];
    if (dryRun) {
        fields.push({ name: 'Dry Run', value: '[WARN] FACE_DRY_RUN=true — approve will simulate, nothing posts to Face.', inline: false });
    }

    const embed = new EmbedBuilder()
        .setTitle('Facebrowser Post Draft — Pending Review')
        .setColor(dryRun ? 0xffc107 : 0xffa500)
        .setDescription(`**${draftInfo.title || 'Public Death Record'}**\n\n\`\`\`${bbPreview}\`\`\``)
        .addFields(fields)
        .setFooter({ text: dryRun ? 'Face post draft — DRY RUN | Full text below' : 'Face post draft | Full text below' })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${PREFIX_APPROVE}${shortId(reportKey)}`)
            .setLabel('Approve & Post to Face')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`${PREFIX_EDIT}${shortId(reportKey)}`)
            .setLabel('Edit')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`${PREFIX_DENY}${shortId(reportKey)}`)
            .setLabel('Deny')
            .setStyle(ButtonStyle.Danger),
    );

    const msg = await channel.send({ embeds: [embed], components: [row] });
    console.log(`[FACE] [OK] Face draft sent to #${channel.name} (${msg.id})`);
    return msg;
}

// ── Button router ──

export async function handleFaceButton(interaction) {
    const customId = interaction.customId;

    if (customId.startsWith(PREFIX_APPROVE)) {
        await handleApprove(interaction, customId.slice(PREFIX_APPROVE.length));
    } else if (customId.startsWith(PREFIX_EDIT)) {
        await handleEdit(interaction, customId.slice(PREFIX_EDIT.length));
    } else if (customId.startsWith(PREFIX_DENY)) {
        await handleDeny(interaction, customId.slice(PREFIX_DENY.length));
    }
}

async function resolveReportKey(db, shortKey) {
    if (!shortKey || shortKey.length > 20) return shortKey;
    try {
        const snap = await db.ref(`${FACE_TRACK_PATH}/_ids/${shortKey}`).once('value');
        if (snap.exists()) return snap.val();
    } catch (e) {}
    return shortKey;
}

/**
 * Reflect the Face post result on the original death record draft embed.
 */
async function markDeathRecordFaceField(db, reportKey, text) {
    if (!reportKey) return;
    try {
        const snap = await db.ref(`${DEATH_RECORD_TRACK_PATH}/${reportKey}/messageId`).once('value');
        if (snap.exists() && snap.val()) {
            await updateDraftFaceField(snap.val(), text);
        }
    } catch (e) {}
}

// ── Approve ──

async function handleApprove(interaction, shortKey) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const { default: firebase } = await import('./firebase.js');
        firebase.init();
        const db = firebase.db;
        const reportKey = await resolveReportKey(db, shortKey);

        const draftSnap = await db.ref(`${FACE_TRACK_PATH}/${reportKey}`).once('value');
        const draftInfo = draftSnap.val();
        if (!draftInfo) {
            await interaction.editReply({ content: 'Face draft not found in Firebase.' });
            return;
        }
        if (draftInfo.status === 'approved' || draftInfo.status === 'approved_simulated') {
            await interaction.editReply({ content: 'This Face post has already been approved.' });
            return;
        }

        const content = draftInfo.content;
        if (!content) {
            await interaction.editReply({ content: 'No post content found. The draft may be incomplete.' });
            return;
        }

        if (isFaceDryRun()) {
            const simUrl = `https://face.gta.world/post/SIM_${Date.now()}`;
            await db.ref(`${FACE_TRACK_PATH}/${reportKey}`).update({
                status: 'approved_simulated',
                deployedAt: Date.now(),
                deployedUrl: simUrl,
                approvedBy: interaction.user.tag,
                dryRunNote: 'FACE_DRY_RUN is enabled — simulated post. No actual Face post was created.',
            });

            await updateFaceDraftMessage(draftInfo.messageId, 'approved_simulated', simUrl);

            await interaction.editReply({
                content: `[DRY RUN] Face post simulated successfully!\n${simUrl}\n\nSet FACE_DRY_RUN=false in .env to enable real posting.`,
            });
            console.log(`[FACE] [DONE] ${reportKey} — Simulated approval by ${interaction.user.tag} (FACE_DRY_RUN)`);
            await markDeathRecordFaceField(db, reportKey, 'Simulated (FACE_DRY_RUN)');
            return;
        }

        const result = await postToFace(content);

        await db.ref(`${FACE_TRACK_PATH}/${reportKey}`).update({
            status: 'approved',
            deployedAt: Date.now(),
            deployedUrl: result.url,
            fbPostId: result.postId,
            approvedBy: interaction.user.tag,
            lastError: null,
        });

        await updateFaceDraftMessage(draftInfo.messageId, 'approved', result.url);

        await interaction.editReply({
            content: `Face post published successfully!\n${result.url}`,
        });
        console.log(`[FACE] [OK] ${reportKey} — Approved by ${interaction.user.tag}, posted as #${result.postId}`);
        await markDeathRecordFaceField(db, reportKey, `Published: ${result.url}`);
    } catch (err) {
        console.error(`[FACE] [ERR] Approve error for ${shortKey}:`, err.message);
        try {
            const { default: firebase } = await import('./firebase.js');
            await firebase.db.ref(`${FACE_TRACK_PATH}/${shortKey}`).update({ lastError: err.message.slice(0, 300) }).catch(() => {});
        } catch (e) {}
        await interaction.editReply({
            content: `Error: ${err.message.slice(0, 200)}`,
        });
    }
}

// ── Edit ──

async function handleEdit(interaction, shortKey) {
    try {
        const { default: firebase } = await import('./firebase.js');
        firebase.init();
        const db = firebase.db;
        const reportKey = await resolveReportKey(db, shortKey);

        const draftSnap = await db.ref(`${FACE_TRACK_PATH}/${reportKey}`).once('value');
        const draftInfo = draftSnap.val();
        if (!draftInfo) {
            await interaction.reply({ content: 'Face draft not found in Firebase.', ephemeral: true });
            return;
        }

        const content = draftInfo.content || '';
        if (content.length > 4000) {
            await interaction.reply({
                content: '[WARN] This Face post draft is too large for Discord\'s modal (max 4000 chars).',
                ephemeral: true,
            });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId(`${MODAL_PREFIX}${shortId(reportKey)}`)
            .setTitle(`Edit Face Post — ${draftInfo.decedentName || 'Death Record'}`);

        const contentInput = new TextInputBuilder()
            .setCustomId('faceContent')
            .setLabel('Facebrowser Post Content')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(content)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(contentInput));

        await interaction.showModal(modal);
        console.log(`[FACE] [OK] Edit modal shown for ${reportKey}`);
    } catch (err) {
        console.error(`[FACE] [ERR] Edit error for ${shortKey}:`, err.message);
        if (!interaction.replied) {
            await interaction.reply({ content: `Error: ${err.message.slice(0, 200)}`, ephemeral: true });
        }
    }
}

// ── Edit modal submission ──

export async function handleFaceEditModal(interaction) {
    if (!interaction.customId.startsWith(MODAL_PREFIX)) return;

    const shortKey = interaction.customId.slice(MODAL_PREFIX.length);
    let reportKey = shortKey;
    const editedContent = interaction.fields.getTextInputValue('faceContent');

    try {
        const { default: firebase } = await import('./firebase.js');
        firebase.init();
        const db = firebase.db;
        reportKey = await resolveReportKey(db, shortKey);

        await db.ref(`${FACE_TRACK_PATH}/${reportKey}`).update({
            content: editedContent,
            editedAt: Date.now(),
            editedBy: interaction.user.tag,
            status: 'edited',
        });

        const draftSnap = await db.ref(`${FACE_TRACK_PATH}/${reportKey}`).once('value');
        const draftInfo = draftSnap.val();
        if (draftInfo?.messageId) {
            const bbPreview = editedContent.length > 800 ? editedContent.slice(0, 800) + '...' : editedContent;
            await updateFaceDraftMessageContent(draftInfo.messageId, draftInfo.title, bbPreview);
        }

        await interaction.reply({
            content: 'Face post content updated. Review then click Approve & Post to Face.',
            ephemeral: true,
        });
        console.log(`[FACE] [OK] ${reportKey} — content edited by ${interaction.user.tag}`);
    } catch (err) {
        console.error(`[FACE] [ERR] Edit modal error for ${reportKey}:`, err.message);
        await interaction.reply({ content: `Error: ${err.message.slice(0, 200)}`, ephemeral: true });
    }
}

// ── Deny ──

async function handleDeny(interaction, shortKey) {
    try {
        const { default: firebase } = await import('./firebase.js');
        firebase.init();
        const db = firebase.db;
        const reportKey = await resolveReportKey(db, shortKey);

        const draftSnap = await db.ref(`${FACE_TRACK_PATH}/${reportKey}`).once('value');
        const draftInfo = draftSnap.val();

        await db.ref(`${FACE_TRACK_PATH}/${reportKey}`).update({
            status: 'denied',
            deniedAt: Date.now(),
            deniedBy: interaction.user.tag,
        });

        if (draftInfo?.messageId) {
            await updateFaceDraftMessage(draftInfo.messageId, 'denied');
        }

        await interaction.reply({
            content: 'Face post draft denied and removed.',
            ephemeral: true,
        });
        console.log(`[FACE] [ERR] ${reportKey} — Denied by ${interaction.user.tag}`);
    } catch (err) {
        console.error(`[FACE] [ERR] Deny error for ${shortKey}:`, err.message);
        await interaction.reply({ content: `Error: ${err.message.slice(0, 200)}`, ephemeral: true });
    }
}

// ── Message updates ──

async function updateFaceDraftMessage(msgId, status, resultUrl) {
    const client = getDraftClient();
    if (!client || !FACE_DRAFT_CHANNEL_ID || !msgId) return;

    const channel = await client.channels.fetch(FACE_DRAFT_CHANNEL_ID).catch(() => null);
    if (!channel) return;
    const msg = await channel.messages.fetch(msgId).catch(() => null);
    if (!msg || !msg.embeds[0]) return;

    const approved = status === 'approved' || status === 'approved_simulated';
    const embed = EmbedBuilder.from(msg.embeds[0])
        .setColor(approved ? 0x28a745 : 0xdc3545)
        .setTitle(approved
            ? (status === 'approved_simulated' ? 'Facebrowser Post — Approved (SIMULATED)' : 'Facebrowser Post — Published')
            : 'Facebrowser Post — Denied');

    if (resultUrl) {
        embed.addFields({ name: 'Face URL', value: resultUrl, inline: false });
    }
    if (status === 'approved_simulated') {
        embed.addFields({ name: 'Note', value: '[WARN] Simulated — FACE_DRY_RUN is on, nothing was posted to Face.', inline: false });
    }

    const disabledRow = ActionRowBuilder.from(msg.components[0]);
    disabledRow.components.forEach((btn) => btn.setDisabled(true));

    await msg.edit({ embeds: [embed], components: [disabledRow] });
}

async function updateFaceDraftMessageContent(msgId, title, contentPreview) {
    const client = getDraftClient();
    if (!client || !FACE_DRAFT_CHANNEL_ID || !msgId) return;

    const channel = await client.channels.fetch(FACE_DRAFT_CHANNEL_ID).catch(() => null);
    if (!channel) return;
    const msg = await channel.messages.fetch(msgId).catch(() => null);
    if (!msg || !msg.embeds[0]) return;

    const embed = EmbedBuilder.from(msg.embeds[0])
        .setDescription(`**${title || 'Public Death Record'}**\n\n\`\`\`${contentPreview}\`\`\``)
        .setFooter({ text: 'Face post draft — Edited | Full text below' });

    await msg.edit({ embeds: [embed] });
}
