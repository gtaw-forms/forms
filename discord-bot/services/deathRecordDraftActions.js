/**
 * deathRecordDraftActions.js — Discord button/modal interaction handlers for
 * the Death Record draft approval workflow.
 */
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { sendLogMessage } from './logChannel.js';
import { updateDraftMessage, updateDraftWithMorgue, updateDraftFaceField, getDraftClient, DRAFT_CHANNEL_ID } from './deathRecordDraftUI.js';
import { FACE_PUBLISH_DELAY_HOURS } from './deathRecordDraftFace.js';
import { recheckMorgueForDraft } from './deathRecordDraftScan.js';
import { shortId } from './deathRecordDraftCache.js';
import { loadTemplate, fillTemplate } from './deathRecordDraftGenerator.js';

const DRAFT_TRACK_PATH = 'deathRecordDrafts';
const FACE_TRACK_PATH = 'facePostDrafts';
const DEATH_RECORD_FORUM_ID = 404;

// ── Facebrowser Post Kickoff ──

/**
 * Schedule the Facebrowser post after a death record is approved & posted to
 * the forum. Never throws into the forum approval flow.
 * @returns {Promise<{scheduled?: boolean, publishAt?: number, published?: boolean, url?: string, simulated?: boolean, error?: string}>}
 */
async function kickOffFaceDraft(db, draftInfo, reportKey, forumUrl) {
    try {
        const { createFaceDraft } = await import('./deathRecordDraftFace.js');
        const result = await createFaceDraft(db, draftInfo, reportKey, { forumUrl });
        if (result?.scheduled) {
            console.log(`[DRAFT] [OK] ${reportKey} — Facebrowser post scheduled for ${result.publishAt ? new Date(result.publishAt).toUTCString() : '?'}`);
            return { scheduled: true, publishAt: result.publishAt };
        }
        if (result?.url) {
            console.log(`[DRAFT] [OK] ${reportKey} — Facebrowser post ${result.simulated ? 'simulated' : 'published'}: ${result.url}`);
            return { published: true, url: result.url, simulated: !!result.simulated };
        }
        return { published: false };
    } catch (err) {
        console.error(`[DRAFT] [ERR] Face publish kickoff failed for ${reportKey}:`, err.message);
        return { published: false, error: err.message };
    }
}

/**
 * Reflect the Face publish result on the death record draft embed.
 */
async function markFaceOnDraftEmbed(draftInfo, faceResult) {
    if (!draftInfo?.messageId) return;
    let text;
    if (faceResult?.scheduled && faceResult.publishAt) {
        text = `Scheduled to publish ${new Date(faceResult.publishAt).toUTCString()} (+${FACE_PUBLISH_DELAY_HOURS}h delay)`;
    } else if (faceResult?.published && faceResult.url) {
        text = faceResult.simulated ? `Simulated (FACE_DRY_RUN): ${faceResult.url}` : `Published: ${faceResult.url}`;
    } else {
        text = 'Face post failed (check bot logs)';
    }
    await updateDraftFaceField(draftInfo.messageId, text).catch(() => {});
}

// ── Prefix constants ──

const PREFIX_APPROVE = 'dr_approve_';
const PREFIX_EDIT = 'dr_edit_';
const PREFIX_EDITFIELDS = 'dr_editfields_';
const PREFIX_DENY = 'dr_deny_';
const PREFIX_CHECKMORGUE = 'dr_checkmorgue_';
const MODAL_BBCODE_PREFIX = 'dr_editbbc_modal_';
const MODAL_FIELDS_PREFIX = 'dr_editfld_modal_';

// ── Button Router ──

/** Resolve a shortId back to full reportKey using the _ids index. */
async function resolveReportKey(db, shortKey) {
    if (!shortKey || shortKey.length > 20) return shortKey;
    try {
        const snap = await db.ref(DRAFT_TRACK_PATH + '/_ids/' + shortKey).once('value');
        if (snap.exists()) return snap.val();
    } catch(e) {}
    return shortKey;
}

/**
 * Handle a Death Record draft button interaction.
 * Called from index.js interactionCreate.
 */
export async function handleDraftButton(interaction) {
    const customId = interaction.customId;

    for (const pfx of [PREFIX_APPROVE, PREFIX_EDIT, PREFIX_EDITFIELDS, PREFIX_CHECKMORGUE, PREFIX_DENY]) {
        if (customId.startsWith(pfx)) {
            const shortKey = customId.slice(pfx.length);
            if (shortKey.length > 20) break;
            try {
                const { default: firebase } = await import('./firebase.js');
                firebase.init();
                const db = firebase.db;
                let resolved = null;
                const snap = await db.ref(DRAFT_TRACK_PATH + '/_ids/' + shortKey).once('value');
                if (snap.exists()) {
                    resolved = snap.val();
                } else {
                    // Legacy drafts created before the _ids index existed may have no
                    // entry — fall back to hashing each draft key to find the match.
                    const drafts = await db.ref(DRAFT_TRACK_PATH).once('value').catch(() => null);
                    if (drafts?.exists()) {
                        drafts.forEach((child) => {
                            if (!resolved && shortId(child.key) === shortKey) resolved = child.key;
                        });
                    }
                }
                if (resolved) interaction.customId = pfx + resolved;
            } catch(e) {}
            break;
        }
    }

    if (customId.startsWith(PREFIX_APPROVE)) {
        await handleApprove(interaction, interaction.customId.slice(PREFIX_APPROVE.length));
    } else if (customId.startsWith(PREFIX_EDIT)) {
        await handleEdit(interaction, interaction.customId.slice(PREFIX_EDIT.length));
    } else if (customId.startsWith(PREFIX_EDITFIELDS)) {
        await handleEditFields(interaction, interaction.customId.slice(PREFIX_EDITFIELDS.length));
    } else if (customId.startsWith(PREFIX_CHECKMORGUE)) {
        await handleCheckMorgue(interaction, interaction.customId.slice(PREFIX_CHECKMORGUE.length));
    } else if (customId.startsWith(PREFIX_DENY)) {
        await handleDeny(interaction, interaction.customId.slice(PREFIX_DENY.length));
    }
}

// ── Approve ──

async function handleApprove(interaction, reportKey) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const { default: firebase } = await import('./firebase.js');
        firebase.init();
        const db = firebase.db;

        const draftSnap = await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).once('value');
        const draftInfo = draftSnap.val();
        if (!draftInfo) {
            await interaction.editReply({ content: 'Draft info not found in Firebase.' });
            return;
        }

        // Mark as mid-deploy so a crash/restart can be detected and recovered
        // (see recoverInterruptedDeathRecordApprovals).
        await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).update({ deploying: true, deployStartedAt: Date.now() }).catch(() => {});

        const bbCode = draftInfo.bbCode;
        if (!bbCode) {
            await interaction.editReply({ content: 'No draft BBCode found. The draft may be incomplete.' });
            return;
        }

        const DRY_POST = process.env.DRY_POST !== 'false';

        if (DRY_POST) {
            const simUrl = `https://phmc.gta.world/viewtopic.php?t=SIM_${Date.now()}`;

            await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).update({
                status: 'simulated',
                deploying: false,
                deployedAt: Date.now(),
                deployedUrl: simUrl,
                approvedBy: interaction.user.tag,
                isSimulated: true,
                dryRunNote: 'DRY_POST is enabled — simulated post. No actual forum content was created.',
            });

            await updateDraftMessage(draftInfo.messageId, 'approved', simUrl + ' (SIMULATED)');

            await interaction.editReply({
                content: `[DRY RUN] Death Record simulated successfully!\n${simUrl}\n\nSet DRY_POST=false in .env to enable real forum posting.`,
            });
            console.log(`[DRAFT] [DONE] ${reportKey} — Simulated approval by ${interaction.user.tag} (DRY_POST)`);

            // Draft the Facebrowser post for a separate review & approve step.
            const faceResult = await kickOffFaceDraft(db, draftInfo, reportKey, simUrl);
            await markFaceOnDraftEmbed(draftInfo, faceResult);
        } else {
            const { getForumClient } = await import('./forumClient.js');
            const client = getForumClient();
            await sendLogMessage(null, {
                title: '[DONE] Death Record Posting',
                description: `**${draftInfo.title}**\nApproved by **${interaction.user.tag}**\nPosting to Death Records forum (f=404)...`,
                color: 0x007bff,
            });
            await client.login(null, null, { force: true, baseUrl: process.env.FORUM_BASE_URL });
            const result = await client.postTopic(
                DEATH_RECORD_FORUM_ID,
                draftInfo.title,
                bbCode,
                `https://phmc.gta.world/posting.php?mode=post&f=${DEATH_RECORD_FORUM_ID}`
            );

            if (result.ok) {
                await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).update({
                    status: 'approved',
                    deploying: false,
                    deployedAt: Date.now(),
                    deployedUrl: result.url,
                    approvedBy: interaction.user.tag,
                });

                await updateDraftMessage(draftInfo.messageId, 'approved', result.url);

                await interaction.editReply({
                    content: `Death Record posted successfully!\n${result.url}`,
                });

                // Publish the Facebrowser post first so its link can be folded
                // into the success embed (no separate Face review step).
                const faceResult = await kickOffFaceDraft(db, draftInfo, reportKey, result.url);
                await markFaceOnDraftEmbed(draftInfo, faceResult);

                const faceLine = faceResult?.scheduled && faceResult.publishAt
                    ? `\nFace post scheduled for ${new Date(faceResult.publishAt).toUTCString()} (+${FACE_PUBLISH_DELAY_HOURS}h)`
                    : (faceResult?.published && faceResult.url
                        ? `\n[View Facebrowser Post](<${faceResult.url}>)${faceResult.simulated ? ' *(SIMULATED)*' : ''}`
                        : '');
                await sendLogMessage(null, {
                    title: '[OK] Death Record Posted',
                    description: `**${draftInfo.title}**\n[View Post](<${result.url}>)${faceLine}`,
                    color: 0x28a745,
                });
                console.log(`[DRAFT] [OK] ${reportKey} — Approved by ${interaction.user.tag}, posted to f=404`);
            } else {
                await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).update({ deploying: false }).catch(() => {});
                await interaction.editReply({
                    content: 'Failed to post to forum. Check bot logs.',
                });
            }
        }
    } catch (err) {
        console.error(`[DRAFT] [ERR] Approve error for ${reportKey}:`, err.message);
        try {
            const { default: firebase } = await import('./firebase.js');
            await firebase.db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).update({ deploying: false }).catch(() => {});
        } catch (e) {}
        await interaction.editReply({
            content: `Error: ${err.message.slice(0, 200)}`,
        });
    }
}

// ── Edit BBCode ──

async function handleEdit(interaction, reportKey) {
    try {
        const { default: firebase } = await import('./firebase.js');
        firebase.init();
        const db = firebase.db;

        const draftSnap = await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).once('value');
        const draftInfo = draftSnap.val();
        if (!draftInfo) {
            await interaction.reply({ content: 'Draft info not found in Firebase.', ephemeral: true });
            return;
        }

        if ((draftInfo.bbCode || '').length > 4000) {
            await interaction.reply({
                content: '[WARN] This Death Record draft is too large to edit in Discord\'s modal (max 4000 characters). Please edit it directly on the forum post, then ask staff to approve it.',
                ephemeral: true,
            });
            return;
        }

        // Index shortId -> reportKey so the submit handler can resolve it back.
        // Discord caps modal custom IDs at 100 chars; long report keys would crash otherwise.
        try { await db.ref(DRAFT_TRACK_PATH + '/_ids/' + shortId(reportKey)).set(reportKey); } catch (e) {}

        const modal = new ModalBuilder()
            .setCustomId(`${MODAL_BBCODE_PREFIX}${shortId(reportKey)}`)
            .setTitle(`Edit Death Record — ${draftInfo.decedentName || reportKey.slice(0, 20)}`);

        const bbcodeInput = new TextInputBuilder()
            .setCustomId('bbCode')
            .setLabel('Death Record BBCode')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(draftInfo.bbCode || '')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(bbcodeInput));

        await interaction.showModal(modal);
        console.log(`[DRAFT] [OK] Edit modal shown for ${reportKey}`);
    } catch (err) {
        console.error(`[DRAFT] [ERR] Edit error for ${reportKey}:`, err.message);
        if (!interaction.replied) {
            await interaction.reply({ content: `Error: ${err.message.slice(0, 200)}`, ephemeral: true });
        }
    }
}

// ── Edit Fields ──

async function handleEditFields(interaction, reportKey) {
    try {
        const { default: firebase } = await import('./firebase.js');
        firebase.init();
        const db = firebase.db;

        const draftSnap = await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).once('value');
        const draftInfo = draftSnap.val();
        if (!draftInfo) {
            await interaction.reply({ content: 'Draft info not found in Firebase.', ephemeral: true });
            return;
        }

        const values = draftInfo.values || {};
        // Index shortId -> reportKey so the submit handler can resolve it back.
        try { await db.ref(DRAFT_TRACK_PATH + '/_ids/' + shortId(reportKey)).set(reportKey); } catch (e) {}

        const modal = new ModalBuilder()
            .setCustomId(`${MODAL_FIELDS_PREFIX}${shortId(reportKey)}`)
            .setTitle(`Edit Fields — ${draftInfo.decedentName || reportKey.slice(0, 20)}`);

        const manner = new TextInputBuilder()
            .setCustomId('field_Manner')
            .setLabel('Cause of Death / Manner')
            .setStyle(TextInputStyle.Short)
            .setValue(values.Manner || '')
            .setRequired(false)
            .setMaxLength(256);

        const placeOfDeath = new TextInputBuilder()
            .setCustomId('field_placeOfDeath')
            .setLabel('Place of Death')
            .setStyle(TextInputStyle.Short)
            .setValue(values.placeOfDeath || '')
            .setRequired(false)
            .setMaxLength(256);

        const decedentName = new TextInputBuilder()
            .setCustomId('field_decedentName')
            .setLabel('Decedent Name')
            .setStyle(TextInputStyle.Short)
            .setValue(values.decedentName || '')
            .setRequired(false)
            .setMaxLength(128);

        const decedentOOC = new TextInputBuilder()
            .setCustomId('field_decedentOOC')
            .setLabel('OOC Name')
            .setStyle(TextInputStyle.Short)
            .setValue(values.decedentOOC || '')
            .setRequired(false)
            .setMaxLength(128);

        modal.addComponents(
            new ActionRowBuilder().addComponents(manner),
            new ActionRowBuilder().addComponents(placeOfDeath),
            new ActionRowBuilder().addComponents(decedentName),
            new ActionRowBuilder().addComponents(decedentOOC),
        );

        await interaction.showModal(modal);
        console.log(`[DRAFT] [OK] Edit Fields modal shown for ${reportKey}`);
    } catch (err) {
        console.error(`[DRAFT] [ERR] Edit Fields error for ${reportKey}:`, err.message);
        if (!interaction.replied) {
            await interaction.reply({ content: `Error: ${err.message.slice(0, 200)}`, ephemeral: true });
        }
    }
}

// ── Edit BBCode Modal Submission ──

/**
 * Handle the Edit modal submission — save the edited BBCode and update the draft.
 */
export async function handleEditModal(interaction) {
    const customId = interaction.customId;
    if (!customId.startsWith(MODAL_BBCODE_PREFIX)) return;

    const shortKey = customId.slice(MODAL_BBCODE_PREFIX.length);
    let reportKey = shortKey;
    const editedBbcode = interaction.fields.getTextInputValue('bbCode');

    try {
        const { default: firebase } = await import('./firebase.js');
        firebase.init();
        const db = firebase.db;
        reportKey = await resolveReportKey(db, shortKey);

        await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).update({
            bbCode: editedBbcode,
            editedAt: Date.now(),
            editedBy: interaction.user.tag,
            status: 'edited',
        });

        if (DRAFT_CHANNEL_ID) {
            const channel = await getDraftClient().channels.fetch(DRAFT_CHANNEL_ID).catch(() => null);
            if (channel) {
                const draftSnap = await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).once('value');
                const draftInfo = draftSnap.val();
                if (draftInfo?.messageId) {
                    const msg = await channel.messages.fetch(draftInfo.messageId).catch(() => null);
                    if (msg && msg.embeds[0]) {
                        const embed = EmbedBuilder.from(msg.embeds[0]);
                        const bbPreview = editedBbcode.length > 800
                            ? editedBbcode.slice(0, 800) + '...'
                            : editedBbcode;
                        embed.spliceFields(4, 1, { name: 'BBCode Preview', value: `\`\`\`${bbPreview}\`\`\``, inline: false });
                        embed.setFooter({ text: 'PHMC Death Record Draft — Edited | Full BBCode attached' });
                        await msg.edit({ embeds: [embed] });
                    }
                }
            }
        }

        await interaction.reply({
            content: 'Death Record BBCode updated. Review the changes then click Approve & Post.',
            ephemeral: true,
        });
        console.log(`[DRAFT] [OK] ${reportKey} — BBCode edited by ${interaction.user.tag}`);
    } catch (err) {
        console.error(`[DRAFT] [ERR] Edit modal error for ${reportKey}:`, err.message);
        await interaction.reply({ content: `Error: ${err.message.slice(0, 200)}`, ephemeral: true });
    }
}

// ── Edit Fields Modal Submission ──

/**
 * Handle the Edit Fields modal submission - update field values, re-generate BBCode,
 * save to Firebase, and update the Discord embed.
 */
export async function handleEditFieldsModal(interaction) {
    const customId = interaction.customId;
    if (!customId.startsWith(MODAL_FIELDS_PREFIX)) return;

    const shortKey = customId.slice(MODAL_FIELDS_PREFIX.length);
    let reportKey = shortKey;
    const updatedValues = {
        Manner: interaction.fields.getTextInputValue('field_Manner'),
        placeOfDeath: interaction.fields.getTextInputValue('field_placeOfDeath'),
        decedentName: interaction.fields.getTextInputValue('field_decedentName'),
        decedentOOC: interaction.fields.getTextInputValue('field_decedentOOC'),
    };

    try {
        const { default: firebase } = await import('./firebase.js');
        firebase.init();
        const db = firebase.db;
        reportKey = await resolveReportKey(db, shortKey);

        const draftSnap = await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).once('value');
        const draftInfo = draftSnap.val();
        if (!draftInfo) {
            await interaction.reply({ content: 'Draft info not found in Firebase.', ephemeral: true });
            return;
        }

        const mergedValues = { ...(draftInfo.values || {}), ...updatedValues };

        const template = loadTemplate();
        if (!template) {
            await interaction.reply({ content: 'Failed to load Death Record template.', ephemeral: true });
            return;
        }
        const newBbCode = fillTemplate(template, mergedValues);

        await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).update({
            bbCode: newBbCode,
            values: mergedValues,
            decedentName: updatedValues.decedentName || draftInfo.decedentName,
            decedentOOC: updatedValues.decedentOOC || draftInfo.decedentOOC,
            editedAt: Date.now(),
            editedBy: interaction.user.tag,
            status: 'edited',
        });

        if (DRAFT_CHANNEL_ID) {
            const channel = await getDraftClient().channels.fetch(DRAFT_CHANNEL_ID).catch(() => null);
            if (channel) {
                const msg = await channel.messages.fetch(draftInfo.messageId).catch(() => null);
                if (msg && msg.embeds[0]) {
                    const embed = EmbedBuilder.from(msg.embeds[0]);
                    const bbPreview = newBbCode.length > 800
                        ? newBbCode.slice(0, 800) + '...'
                        : newBbCode;
                    embed.spliceFields(4, 1, { name: 'BBCode Preview', value: '```' + bbPreview + '```', inline: false });
                    embed.spliceFields(0, 1, { name: 'Decedent', value: mergedValues.decedentName || draftInfo.decedentName || 'Unknown', inline: true });
                    embed.spliceFields(1, 1, { name: 'OOC', value: mergedValues.decedentOOC || draftInfo.decedentOOC || 'N/A', inline: true });
                    embed.setFooter({ text: 'PHMC Death Record Draft - Fields Edited | Full BBCode attached' });
                    await msg.edit({ embeds: [embed] });
                }
            }
        }

        if (DRAFT_CHANNEL_ID) {
            const channel = await getDraftClient().channels.fetch(DRAFT_CHANNEL_ID).catch(() => null);
            if (channel) {
                const msg = await channel.messages.fetch(draftInfo.messageId).catch(() => null);
                if (msg) {
                    const bbFile = new AttachmentBuilder(Buffer.from(newBbCode, 'utf-8'), { name: 'death-record-bbcode.txt' });
                    await msg.edit({ files: [bbFile] });
                }
            }
        }

        await interaction.reply({
            content: 'Death Record fields updated. BBCode regenerated. Review then click Approve & Post.',
            ephemeral: true,
        });
        console.log('[DRAFT] [OK] ' + reportKey + ' - Fields edited by ' + interaction.user.tag);
    } catch (err) {
        console.error('[DRAFT] [ERR] Edit Fields modal error for ' + reportKey + ': ' + err.message);
        await interaction.reply({ content: 'Error: ' + err.message.slice(0, 200), ephemeral: true });
    }
}

// ── Check Morgue ──

async function handleCheckMorgue(interaction, reportKey) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const { default: firebase } = await import('./firebase.js');
        firebase.init();
        const db = firebase.db;

        const found = await recheckMorgueForDraft(db, reportKey);
        if (found) {
            const draftSnap = await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).once('value');
            const draftInfo = draftSnap.val();
            if (draftInfo?.messageId) {
                await updateDraftWithMorgue(draftInfo.messageId, draftInfo.bbCode, draftInfo.morgueMatch || null);
            }
            await interaction.editReply({
                content: `[OK] Morgue record found! Draft updated with Case #${draftInfo?.morgueCaseId || '?'}.`,
            });
            console.log(`[DRAFT] [OK] ${reportKey} — Morgue re-check found data (via ${interaction.user.tag})`);
        } else {
            await interaction.editReply({
                content: '[WARN] No better morgue record found yet for this decedent. If the data was recently added, try again later.',
            });
            console.log(`[DRAFT] [WARN] ${reportKey} — Morgue re-check found nothing better (via ${interaction.user.tag})`);
        }
    } catch (err) {
        console.error(`[DRAFT] [ERR] checkMorgue error for ${reportKey}:`, err.message);
        await interaction.editReply({ content: `Error: ${err.message.slice(0, 200)}` });
    }
}

// ── Deny ──

async function handleDeny(interaction, reportKey) {
    try {
        const { default: firebase } = await import('./firebase.js');
        firebase.init();
        const db = firebase.db;

        const draftSnap = await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).once('value');
        const draftInfo = draftSnap.val();

        await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).update({
            status: 'denied',
            deniedAt: Date.now(),
            deniedBy: interaction.user.tag,
        });

        // Cancel any scheduled Facebrowser post for the denied death record.
        try {
            const fSnap = await db.ref(`${FACE_TRACK_PATH}/${reportKey}`).once('value').catch(() => null);
            if (fSnap?.exists() && fSnap.val().status === 'scheduled') {
                await db.ref(`${FACE_TRACK_PATH}/${reportKey}`).update({
                    status: 'cancelled',
                    cancelledAt: Date.now(),
                    cancelledBy: interaction.user.tag,
                }).catch(() => {});
                console.log(`[DRAFT] [OK] ${reportKey} — scheduled Face post cancelled`);
            }
        } catch (e) {}

        if (draftInfo?.messageId) {
            await updateDraftMessage(draftInfo.messageId, 'denied');
        }

        await interaction.reply({
            content: 'Death Record draft denied and removed.',
            ephemeral: true,
        });
        console.log(`[DRAFT] [ERR] ${reportKey} — Denied by ${interaction.user.tag}`);
    } catch (err) {
        console.error(`[DRAFT] [ERR] Deny error for ${reportKey}:`, err.message);
        await interaction.reply({
            content: `Error: ${err.message.slice(0, 200)}`,
            ephemeral: true,
        });
    }
}
