/**
 * Death Record Draft Service — detects CK Coroner Reports and Mass Fatality
 * reports in scheduledReports, drafts a Death Record BBCode from morgue data,
 * and sends it to a Discord channel for approval/rejection.
 *
 * Wired into autoDeploy.js — runs when CK reports are detected.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Constants ──

const DEATH_RECORD_FORUM_ID = 404;
const TEMPLATE_PATH = resolve(__dirname, '..', 'templates', 'death-record.json');
const DRAFT_TRACK_PATH = 'deathRecordDrafts';

let _client = null;
let _forumClient = null;

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

// ── Template Loading ──

let _template = null;

function loadTemplate() {
    if (_template) return _template;
    try {
        const raw = readFileSync(TEMPLATE_PATH, 'utf-8');
        _template = JSON.parse(raw);
        console.log('[DRAFT] ✅ Death Record template loaded');
        return _template;
    } catch (err) {
        console.error('[DRAFT] ❌ Failed to load template:', err.message);
        return null;
    }
}

// ── BBCode Filler ──

/**
 * Fill the Death Record BBCode template with field values.
 * Only replaces {{fieldName}} placeholders that have a value.
 */
function fillTemplate(template, values) {
    let bbcode = template.bbcodeTemplate;
    for (const [key, val] of Object.entries(values)) {
        const placeholder = `{{${key}}}`;
        if (bbcode.includes(placeholder)) {
            bbcode = bbcode.replaceAll(placeholder, val ?? '');
        }
    }
    return bbcode;
}

// ── Morgue Lookup ──

/**
 * Query Firebase morgue-records for a decedent by name (case-insensitive).
 * Returns the best match or null.
 */
async function findMorgueRecord(db, decedentName) {
    if (!decedentName) return null;

    const snap = await db.ref('morgue-records').once('value');
    if (!snap.exists()) return null;

    const nameLower = decedentName.toLowerCase().trim();
    let bestMatch = null;
    let bestScore = 0;

    snap.forEach((child) => {
        const rec = child.val();
        const recName = (rec.name || '').toLowerCase().trim();
        if (recName === nameLower) {
            bestScore = 999;
            bestMatch = { ...rec, firebaseKey: child.key };
            return true; // exact match, stop
        }
        if (recName.includes(nameLower) || nameLower.includes(recName)) {
            const score = Math.max(
                recName.includes(nameLower) ? recName.length : 0,
                nameLower.includes(recName) ? nameLower.length : 0
            );
            if (score > bestScore) {
                bestScore = score;
                bestMatch = { ...rec, firebaseKey: child.key };
            }
        }
    });

    return bestMatch;
}

// ── Draft Generation ──

/**
 * Generate a Death Record draft from a coroner report + morgue data.
 * Returns { bbCode, title, summary } or null if essential data is missing.
 */
function generateDraft(reportData, morgueRecord) {
    const data = reportData.data || {};
    const template = loadTemplate();
    if (!template) return null;

    const decedentName = data.decedentName || morgueRecord?.name || 'UNKNOWN';
    const decedentOOC = data.decedentOOC || 'N/A';

    // Strip time from date of death — public records should show date only
    // Handles both "YYYY-MM-DD HH:MM" (space-separated) and "YYYY-MM-DDTHH:MM" (ISO) formats
    const stripTime = (dateStr) => {
        if (!dateStr || dateStr === 'UNKNOWN') return dateStr;
        // Remove time from ISO format: "2026-06-30T20:23" → "2026-06-30"
        const isoMatch = dateStr.match(/^(\d{4}-\d{2}-\d{2})T/i);
        if (isoMatch) return isoMatch[1];
        // Remove trailing time: "2026-06-30 20:23" → "2026-06-30"
        return dateStr.replace(/\s+\d{1,2}:\d{2}(\s*(?:AM|PM))?$/i, '').trim();
    };

    // Build title: [CASE #year-caseNum] Name ((OOC)) | Date
    const year = new Date().getFullYear();
    const caseNum = morgueRecord?.caseId || data.caseNumber || 'UNKNOWN';
    const rawDod = data.dateOfDeath || data.dateTime || morgueRecord?.timeOfDeath || 'UNKNOWN';
    const dod = stripTime(rawDod);
    const title = `[CASE #${year}-${caseNum}] ${decedentName} ((${decedentOOC})) | ${dod}`;

    // Resolve age with morgue bug indicator
    const rawAge = data.age || morgueRecord?.estimatedAge || '';
    const age = (rawAge && rawAge !== 'Unknown' && rawAge !== 'unknown')
        ? rawAge
        : 'Unknown ((Morgue Script Bug))';

    // Resolve body status — default to HELD for morgue-sourced records
    const bodyStatus = data.bodyStatus || 'HELD';

    // Resolve ethnicity with morgue bug indicator
    const ethnicity = data.ethnicity || '((Unknown due to Morgue Bug))';

    // Map values from report data + morgue record
    const values = {
        decedentName,
        decedentOOC: decedentOOC,
        age,
        caseNumber: String(morgueRecord?.caseId || data.caseNumber || ''),
        coldCaseStatus: data.coldCaseStatus || 'Active',
        bodyStatus,
        sex: data.sex || morgueRecord?.sex || 'Unknown',
        ethnicity,
        placeOfDeath: data.placeOfDeath || morgueRecord?.location || '',
        Manner: data.Manner || data.mannerOfDeath || morgueRecord?.causeOfDeath || 'Unknown',
        selectEmployee: data.selectEmployee || data.coronerEmployee || data.phmcEmployee || '',
        otherSignificantConditions: data.otherSignificantConditions || '',
        dateOfDeath: dod,
        deathRecordType: data.deathRecordType || 'Identified',
    };

    const bbCode = fillTemplate(template, values);

    // Build a summary of what was filled
    const filledFields = Object.entries(values)
        .filter(([, v]) => v && v !== 'Unknown' && v !== 'N/A')
        .map(([k]) => k)
        .join(', ');

    return { bbCode, title, values, filledFields };
}

// ── Discord Sending ──

const DRAFT_CHANNEL_ID = process.env.DEATH_RECORD_DRAFT_CHANNEL_ID || process.env.DASHBOARD_CHANNEL_ID;

/**
 * Send a Death Record draft to Discord with review buttons.
 * @param {object} draft - Generated draft { bbCode, title, values, filledFields }
 * @param {object} reportData - Original report data
 * @param {string} authorId
 * @param {string} reportKey
 * @param {boolean} needsMorgue - True if no morgue record was found at draft time
 */
async function sendDraft(draft, reportData, authorId, reportKey, needsMorgue) {
    if (!_client) {
        console.warn('[DRAFT] ⚠️ No Discord client — cannot send draft');
        return null;
    }
    if (!DRAFT_CHANNEL_ID) {
        console.warn('[DRAFT] ⚠️ No DEATH_RECORD_DRAFT_CHANNEL_ID in .env');
        return null;
    }

    const channel = await _client.channels.fetch(DRAFT_CHANNEL_ID).catch(() => null);
    if (!channel) {
        console.error('[DRAFT] ❌ Could not fetch draft channel');
        return null;
    }

    // Truncate BBCode preview for the embed (first 800 chars)
    const bbPreview = draft.bbCode.length > 800
        ? draft.bbCode.slice(0, 800) + '...'
        : draft.bbCode;

    const fields = [
        { name: 'Decedent', value: reportData.data?.decedentName || 'Unknown', inline: true },
        { name: 'OOC', value: reportData.data?.decedentOOC || 'N/A', inline: true },
        { name: 'Department', value: reportData.data?.department || 'N/A', inline: true },
        { name: 'Report Type', value: reportData.formId || 'Unknown', inline: true },
    ];

    // Add morgue status note if no match was found
    let footerText = 'PHMC Death Record Draft — Full BBCode attached as .txt';
    if (needsMorgue) {
        fields.push({ name: 'Morgue Status', value: '⚠️ No morgue record found. Use **Check Morgue** to re-check later.', inline: false });
        footerText = 'PHMC Death Record Draft — Pending morgue data | Click Check Morgue to re-query';
    }

    fields.push(
        { name: 'BBCode Preview', value: `\`\`\`${bbPreview}\`\`\``, inline: false },
        { name: 'Key', value: `\`${reportKey}\``, inline: false },
    );

    const embed = new EmbedBuilder()
        .setTitle('Death Record Draft — Pending Review')
        .setColor(needsMorgue ? 0xff6b35 : 0xffa500)
        .setDescription(`**${draft.title}**`)
        .addFields(fields)
        .setFooter({ text: footerText })
        .setTimestamp();

    // Attach the full BBCode as a text file
    const bbFile = new AttachmentBuilder(Buffer.from(draft.bbCode, 'utf-8'), { name: 'death-record-bbcode.txt' });

    const row = new ActionRowBuilder();
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`dr_approve_${reportKey}`)
            .setLabel('Approve & Post')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`dr_edit_${reportKey}`)
            .setLabel('Edit')
            .setStyle(ButtonStyle.Primary),
    );
    // Show Check Morgue button only when no morgue record was found
    if (needsMorgue) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`dr_checkmorgue_${reportKey}`)
                .setLabel('Check Morgue')
                .setStyle(ButtonStyle.Secondary),
        );
    }
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`dr_deny_${reportKey}`)
            .setLabel('Deny')
            .setStyle(ButtonStyle.Danger),
    );

    const msg = await channel.send({
        embeds: [embed],
        components: [row],
        files: [bbFile],
    });

    console.log(`[DRAFT] 📨 Draft sent to #${channel.name} (${msg.id})`);
    return msg;
}

/**
 * Update the draft message after approval/denial.
 */
async function updateDraftMessage(msgId, status, resultUrl) {
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

    // Disable all buttons
    const disabledRow = ActionRowBuilder.from(msg.components[0]);
    disabledRow.components.forEach((btn) => btn.setDisabled(true));

    await msg.edit({ embeds: [embed], components: [disabledRow] });
}

// ── Main Entry Point ──

/**
 * Process a report for Death Record drafting.
 * Called from autoDeploy when a CK coroner report or mass fatality is detected.
 *
 * @param {object} db - Firebase database ref
 * @param {string} authorId
 * @param {string} reportKey
 * @param {object} reportData - The report data from scheduledReports
 * @returns {Promise<boolean>} true if a draft was sent
 */
export async function processCKReport(db, authorId, reportKey, reportData) {
    const data = reportData?.data || {};
    const typeOfDeath = data.typeOfDeath?.value || data.typeOfDeath || '';

    // Only process CK deaths
    if (typeOfDeath.toUpperCase() !== 'CK') {
        return false;
    }

    // Check if we already sent a draft for this report
    const draftSnap = await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).once('value').catch(() => null);
    if (draftSnap?.exists()) {
        console.log(`[DRAFT] ⏭️ ${reportKey} — draft already sent`);
        return false;
    }

    const decedentName = data.decedentName || '';
    console.log(`[DRAFT] 🖊️ Processing CK report ${reportKey} — ${decedentName}`);

    // Look up in morgue records
    const morgueRecord = await findMorgueRecord(db, decedentName);
    if (morgueRecord) {
        console.log(`[DRAFT] 📋 Found morgue match: Case #${morgueRecord.caseId}`);
    } else {
        console.log(`[DRAFT] ⚠️ No morgue record found for "${decedentName}" — using report data only`);
    }

    // Generate the draft
    const draft = generateDraft(reportData, morgueRecord);
    if (!draft) {
        console.error(`[DRAFT] ❌ Failed to generate draft for ${reportKey}`);
        return false;
    }

    const needsMorgue = !morgueRecord;

    // Send to Discord
    const msg = await sendDraft(draft, reportData, authorId, reportKey, needsMorgue);
    if (!msg) {
        return false;
    }

    // Store the full BBCode in Firebase for approval use
    await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).set({
        authorId,
        reportKey,
        title: draft.title,
        bbCode: draft.bbCode,
        decedentName,
        decedentOOC: data.decedentOOC || '',
        status: 'pending_review',
        needsMorgue,
        morgueCheckedAt: needsMorgue ? null : Date.now(),
        messageId: msg.id,
        channelId: DRAFT_CHANNEL_ID,
        createdAt: Date.now(),
        formId: reportData.formId,
    });

    console.log(`[DRAFT] ✅ Draft sent for ${reportKey}${needsMorgue ? ' (awaiting morgue data)' : ''}`);
    return true;
}

/**
 * Handle the Edit modal submission — save the edited BBCode and update the draft.
 */
export async function handleEditModal(interaction) {
    const customId = interaction.customId;
    if (!customId.startsWith(MODAL_PREFIX)) return;

    const reportKey = customId.slice(MODAL_PREFIX.length);
    const editedBbcode = interaction.fields.getTextInputValue('bbCode');

    try {
        const { default: firebase } = await import('./firebase.js');
        firebase.init();
        const db = firebase.db;

        await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).update({
            bbCode: editedBbcode,
            editedAt: Date.now(),
            editedBy: interaction.user.tag,
            status: 'edited',
        });

        // Update the draft embed to show it was edited
        if (DRAFT_CHANNEL_ID) {
            const channel = await _client.channels.fetch(DRAFT_CHANNEL_ID).catch(() => null);
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
                        // Update the BBCode Preview field (index 4)
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
        console.log(`[DRAFT] ✅ ${reportKey} — BBCode edited by ${interaction.user.tag}`);
    } catch (err) {
        console.error(`[DRAFT] ❌ Edit modal error for ${reportKey}:`, err.message);
        await interaction.reply({ content: `Error: ${err.message.slice(0, 200)}`, ephemeral: true });
    }
}

// ── Button Handler ──

const PREFIX_APPROVE = 'dr_approve_';
const PREFIX_EDIT = 'dr_edit_';
const PREFIX_DENY = 'dr_deny_';
const PREFIX_CHECKMORGUE = 'dr_checkmorgue_';
const MODAL_PREFIX = 'dr_edit_modal_';

/**
 * Handle a Death Record draft button interaction.
 * Called from index.js interactionCreate.
 */
export async function handleDraftButton(interaction) {
    const customId = interaction.customId;

    if (customId.startsWith(PREFIX_APPROVE)) {
        await handleApprove(interaction, customId.slice(PREFIX_APPROVE.length));
    } else if (customId.startsWith(PREFIX_EDIT)) {
        await handleEdit(interaction, customId.slice(PREFIX_EDIT.length));
    } else if (customId.startsWith(PREFIX_CHECKMORGUE)) {
        await handleCheckMorgue(interaction, customId.slice(PREFIX_CHECKMORGUE.length));
    } else if (customId.startsWith(PREFIX_DENY)) {
        await handleDeny(interaction, customId.slice(PREFIX_DENY.length));
    }
}

/**
 * Handle the Edit button — show a modal with the BBCode pre-filled.
 */
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

        const modal = new ModalBuilder()
            .setCustomId(`${MODAL_PREFIX}${reportKey}`)
            .setTitle(`Edit Death Record — ${draftInfo.decedentName || reportKey.slice(0, 20)}`);

        const bbcodeInput = new TextInputBuilder()
            .setCustomId('bbCode')
            .setLabel('Death Record BBCode')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(draftInfo.bbCode || '')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(bbcodeInput));

        await interaction.showModal(modal);
        console.log(`[DRAFT] ✏️ Edit modal shown for ${reportKey}`);
    } catch (err) {
        console.error(`[DRAFT] ❌ Edit error for ${reportKey}:`, err.message);
        if (!interaction.replied) {
            await interaction.reply({ content: `Error: ${err.message.slice(0, 200)}`, ephemeral: true });
        }
    }
}

async function handleApprove(interaction, reportKey) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const { default: firebase } = await import('./firebase.js');
        firebase.init();
        const db = firebase.db;

        // Get draft tracking info
        const draftSnap = await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).once('value');
        const draftInfo = draftSnap.val();
        if (!draftInfo) {
            await interaction.editReply({ content: 'Draft info not found in Firebase.' });
            return;
        }

        // Use the generated Death Record BBCode stored in the draft
        const bbCode = draftInfo.bbCode;
        if (!bbCode) {
            await interaction.editReply({ content: 'No draft BBCode found. The draft may be incomplete.' });
            return;
        }

        const DRY_POST = process.env.DRY_POST !== 'false';

        if (DRY_POST) {
            // Simulate posting — don't touch the real forum
            const simUrl = `https://phmc.gta.world/viewtopic.php?t=SIM_${Date.now()}`;

            await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).update({
                status: 'simulated',
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
            console.log(`[DRAFT] 🏜️ ${reportKey} — Simulated approval by ${interaction.user.tag} (DRY_POST)`);
        } else {
            // Real forum posting
            const { getForumClient } = await import('./forumClient.js');
            const client = getForumClient();
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
                    deployedAt: Date.now(),
                    deployedUrl: result.url,
                    approvedBy: interaction.user.tag,
                });

                await updateDraftMessage(draftInfo.messageId, 'approved', result.url);

                await interaction.editReply({
                    content: `Death Record posted successfully!\n${result.url}`,
                });
                console.log(`[DRAFT] ✅ ${reportKey} — Approved by ${interaction.user.tag}, posted to f=${DEATH_RECORD_FORUM_ID}`);
            } else {
                await interaction.editReply({
                    content: 'Failed to post to forum. Check bot logs.',
                });
            }
        }
    } catch (err) {
        console.error(`[DRAFT] ❌ Approve error for ${reportKey}:`, err.message);
        await interaction.editReply({
            content: `Error: ${err.message.slice(0, 200)}`,
        });
    }
}

/**
 * Start a Firebase listener on morgue-records that automatically re-checks
 * pending drafts whenever morgue data changes.
 * Call once at bot startup from autoDeploy.js.
 */
export function startMorgueListener(db) {
    console.log('[DRAFT] 🔍 Starting morgue record listener...');
    let debounceTimer = null;

    // Use child_added + child_changed instead of value so we only process the
    // specific morgue record that was added/changed, not iterate ALL records.
    const handleMorgueChange = (snap) => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            try {
                const morgueRecord = snap.val();
                const morgueName = (morgueRecord?.name || '').trim().toLowerCase();
                if (!morgueName) return;

                // Only process drafts whose decedent name matches this specific record
                const pendingSnap = await db.ref(DRAFT_TRACK_PATH)
                    .orderByChild('needsMorgue')
                    .equalTo(true)
                    .once('value');
                if (!pendingSnap.exists()) return;
                if (morgueRecord.caseId !== undefined) {
                    console.log(`[DRAFT] 🔎 Morgue change: Case #${morgueRecord.caseId} — ${morgueRecord.name}`);
                }

                pendingSnap.forEach((child) => {
                    const draft = child.val();
                    // Skip drafts already approved/denied (death record already handled)
                    if (draft.status === 'approved' || draft.status === 'denied') return;
                    // Skip drafts that aren't pending review
                    if (draft.status !== 'pending_review' && draft.status !== 'edited' && draft.status !== 'morgue_updated') return;

                    const draftName = (draft.decedentName || '').trim().toLowerCase();

                    // Only match if names are EQUAL (case-insensitive), not partial
                    if (draftName !== morgueName) return;

                    // Found a potential match — recheck with source report validation
                    recheckMorgueForDraft(db, child.key).then((found) => {
                        if (found) {
                            db.ref(`${DRAFT_TRACK_PATH}/${child.key}`).once('value').then((s) => {
                                const updated = s.val();
                                if (updated?.bbCode) {
                                    updateDraftWithMorgue(draft.messageId, updated.bbCode);
                                }
                            });
                            console.log(`[DRAFT] 📋 Auto-matched morgue Case #${morgueRecord.caseId} for ${draft.decedentName}`);
                        }
                    }).catch((err) => console.error('[DRAFT] ⚠️ Morgue match error:', err.message));
                });
            } catch (err) {
                console.error('[DRAFT] ⚠️ Morgue listener error:', err.message);
            }
        }, 3000); // 3s debounce to batch rapid changes
    };

    db.ref('morgue-records').on('child_added', handleMorgueChange);
    db.ref('morgue-records').on('child_changed', handleMorgueChange);

    console.log('[DRAFT] ✅ Morgue record listener active');
}

/**
 * Query all pending drafts that need morgue data.
 * Used by dashboardManager.js to show pending records.
 * @param {object} db - Firebase database ref
 * @returns {Promise<Array<{decedentName, reportKey, title, createdAt}>>}
 */
export async function getPendingMorgueRecords(db) {
    try {
        const snap = await db.ref(DRAFT_TRACK_PATH)
            .orderByChild('needsMorgue')
            .equalTo(true)
            .once('value');
        if (!snap.exists()) return [];

        const pending = [];
        snap.forEach((child) => {
            const val = child.val();
            if (val.status === 'pending_review' || val.status === 'edited') {
                pending.push({
                    decedentName: val.decedentName || 'Unknown',
                    reportKey: child.key,
                    title: val.title || '',
                    createdAt: val.createdAt || 0,
                });
            }
        });
        return pending;
    } catch (err) {
        console.error('[DRAFT] ⚠️ getPendingMorgueRecords error:', err.message);
        return [];
    }
}

/**
 * Re-check morgue records for a draft that was created without a match.
 * Called by the "Check Morgue" button or the morgue listener.
 * @param {object} db - Firebase database ref
 * @param {string} reportKey
 * @returns {Promise<boolean>} true if morgue data was found and draft updated
 */
export async function recheckMorgueForDraft(db, reportKey) {
    try {
        const draftSnap = await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).once('value');
        const draftInfo = draftSnap.val();
        if (!draftInfo) return false;
        if (!draftInfo.needsMorgue) return false;

        // ── Death record already handled? ──
        // If the draft was already approved or denied, skip — a death record
        // was already posted or intentionally discarded for this coroner report.
        if (draftInfo.status === 'approved' || draftInfo.status === 'denied') {
            console.log(`[DRAFT] ⏭️ ${reportKey} — draft already ${draftInfo.status}, skipping morgue re-check`);
            return false;
        }

        const morgueRecord = await findMorgueRecord(db, draftInfo.decedentName);
        if (!morgueRecord) {
            await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).update({
                morgueCheckedAt: Date.now(),
            });
            return false;
        }

        // ── Source report existence check ──
        // Fetch the original report data — try scheduledReports first (opted-in),
        // fall back to newSavedReports (opted-out/localhost).
        let reportData = null;
        const scheduledSnap = await db.ref(`scheduledReports/${draftInfo.authorId}/${reportKey}`).once('value');
        if (scheduledSnap.exists()) {
            reportData = scheduledSnap.val();
        } else {
            const newSaveSnap = await db.ref(`newSavedReports/${draftInfo.authorId}/${reportKey}`).once('value');
            if (newSaveSnap.exists()) {
                reportData = newSaveSnap.val();
            }
        }
        if (!reportData) {
            console.log(`[DRAFT] ⏭️ ${reportKey} — source coroner report not found in either path`);
            return false;
        }

        // ── Verify it's still a CK report ──
        const typeOfDeath = reportData.data?.typeOfDeath?.value || reportData.data?.typeOfDeath || '';
        if (typeOfDeath.toUpperCase() !== 'CK') {
            console.log(`[DRAFT] ⏭️ ${reportKey} — source report is no longer a CK`);
            return false;
        }

        const newDraft = generateDraft(reportData, morgueRecord);
        if (!newDraft) return false;

        await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).update({
            bbCode: newDraft.bbCode,
            needsMorgue: false,
            morgueCheckedAt: Date.now(),
            morgueCaseId: morgueRecord.caseId,
            status: draftInfo.status === 'pending_review' ? 'morgue_updated' : draftInfo.status,
        });

        console.log(`[DRAFT] 📋 Morgue data updated for ${reportKey} — Case #${morgueRecord.caseId}`);
        return true;
    } catch (err) {
        console.error(`[DRAFT] ⚠️ recheckMorgueForDraft error for ${reportKey}:`, err.message);
        return false;
    }
}

/**
 * Update the Discord draft message after a morgue re-check found data.
 */
async function updateDraftWithMorgue(msgId, newBbCode) {
    if (!_client || !DRAFT_CHANNEL_ID) return;
    const channel = await _client.channels.fetch(DRAFT_CHANNEL_ID).catch(() => null);
    if (!channel) return;
    const msg = await channel.messages.fetch(msgId).catch(() => null);
    if (!msg || !msg.embeds[0]) return;

    const embed = EmbedBuilder.from(msg.embeds[0])
        .setColor(0xffa500)
        .setFooter({ text: 'PHMC Death Record Draft — Morgue data matched | Full BBCode attached' });

    // Update morgue status field if it exists (index 4)
    if (embed.data.fields?.[4]?.name === 'Morgue Status') {
        embed.spliceFields(4, 1, { name: 'Morgue Status', value: '✅ Morgue record found!', inline: false });
    }

    // Update BBCode preview (last field before Key)
    const bbPreview = newBbCode.length > 800 ? newBbCode.slice(0, 800) + '...' : newBbCode;
    const previewIdx = embed.data.fields?.findIndex((f) => f.name === 'BBCode Preview');
    if (previewIdx !== -1 && previewIdx !== undefined) {
        embed.spliceFields(previewIdx, 1, { name: 'BBCode Preview', value: `\`\`\`${bbPreview}\`\`\``, inline: false });
    }

    // Remove the Check Morgue button, enable Approve
    const row = ActionRowBuilder.from(msg.components[0]);
    row.components = row.components.filter((btn) => btn.data.custom_id !== `dr_checkmorgue_${msgId.replace('dr_checkmorgue_', '')}`);

    await msg.edit({ embeds: [embed], components: [row] });
}

async function handleCheckMorgue(interaction, reportKey) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const { default: firebase } = await import('./firebase.js');
        firebase.init();
        const db = firebase.db;

        const found = await recheckMorgueForDraft(db, reportKey);
        if (found) {
            // Update the Discord message
            const draftSnap = await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).once('value');
            const draftInfo = draftSnap.val();
            if (draftInfo?.messageId) {
                await updateDraftWithMorgue(draftInfo.messageId, draftInfo.bbCode);
            }
            await interaction.editReply({
                content: `✅ Morgue record found! Draft updated with Case #${draftInfo?.morgueCaseId || '?'}.`,
            });
            console.log(`[DRAFT] ✅ ${reportKey} — Morgue re-check found data (via ${interaction.user.tag})`);
        } else {
            await interaction.editReply({
                content: '⚠️ No morgue record found yet for this decedent. If the data was recently added, try again later.',
            });
            console.log(`[DRAFT] ⏭️ ${reportKey} — Morgue re-check found nothing (via ${interaction.user.tag})`);
        }
    } catch (err) {
        console.error(`[DRAFT] ❌ checkMorgue error for ${reportKey}:`, err.message);
        await interaction.editReply({ content: `Error: ${err.message.slice(0, 200)}` });
    }
}

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

        if (draftInfo?.messageId) {
            await updateDraftMessage(draftInfo.messageId, 'denied');
        }

        await interaction.reply({
            content: 'Death Record draft denied and removed.',
            ephemeral: true,
        });
        console.log(`[DRAFT] ❌ ${reportKey} — Denied by ${interaction.user.tag}`);
    } catch (err) {
        console.error(`[DRAFT] ❌ Deny error for ${reportKey}:`, err.message);
        await interaction.reply({
            content: `Error: ${err.message.slice(0, 200)}`,
            ephemeral: true,
        });
    }
}

// ── Passive CK Monitoring ──

/**
 * Fixed cutoff timestamp — reports saved before 01/JUL/2026 are legacy and
 * skipped by the passive listener to avoid re-processing old records.
 */
const CK_EPOCH = 1782864000000; // 2026-07-01T00:00:00Z

/**
 * Set of report keys already seen by the passive CK listener (newSavedReports).
 */
let _knownPassiveCKKeys = null;

/**
 * Shared helper: silently check if a report is a CK (coroner-report or
 * mass-ftality-test), look up the morgue database, and create a death record
 * draft ONLY if a morgue match is found.
 *
 * If no morgue match exists, does nothing — no pending draft is created.
 * The /death-record-check command can be used later for manual catch-up.
 *
 * @param {object} db - Firebase ref
 * @param {string} authorId
 * @param {string} reportKey
 * @param {object} reportData
 * @returns {Promise<boolean>} true if a draft was created
 */
async function checkAndDraftIfMorgueMatched(db, authorId, reportKey, reportData) {
    const data = reportData?.data || {};
    const decedentName = data.decedentName || '';
    if (!decedentName) return false;

    // Already has a draft?
    const draftSnap = await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).once('value').catch(() => null);
    if (draftSnap?.exists()) return false;

    // Check morgue for a name match
    const morgueRecord = await findMorgueRecord(db, decedentName);
    if (!morgueRecord) {
        console.log(`[DRAFT] ⏭️ ${reportKey} — ${decedentName}: no morgue match yet, waiting silently`);
        return false;
    }

    // Found a match — generate and send the draft
    const draft = generateDraft(reportData, morgueRecord);
    if (!draft) return false;

    const msg = await sendDraft(draft, reportData, authorId, reportKey, false);
    if (!msg) return false;

    await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).set({
        authorId,
        reportKey,
        title: draft.title,
        bbCode: draft.bbCode,
        decedentName,
        decedentOOC: data.decedentOOC || '',
        status: 'pending_review',
        needsMorgue: false,
        morgueCheckedAt: Date.now(),
        morgueCaseId: morgueRecord.caseId || null,
        messageId: msg.id,
        channelId: DRAFT_CHANNEL_ID,
        createdAt: Date.now(),
        formId: reportData.formId,
    });

    console.log(`[DRAFT] ✅ Auto-drafted death record for ${reportKey} — ${decedentName} (Case #${morgueRecord.caseId})`);
    return true;
}

/**
 * Route a report to the passive CK check — handles both coroner-report (single)
 * and mass-ftality-test (array of decedents).
 *
 * For mass fatality reports, each CK decedent in the decedents[] array gets
 * its own death record draft under a composite key `${reportKey}_decN`.
 */
export async function passivCKCheck(db, authorId, reportKey, reportData) {
    if (reportData.formId === 'coroner-report') {
        const typeOfDeath = reportData.data?.typeOfDeath?.value || reportData.data?.typeOfDeath || '';
        if (typeOfDeath.toUpperCase() !== 'CK') return;
        await checkAndDraftIfMorgueMatched(db, authorId, reportKey, reportData);
    }

    if (reportData.formId === 'mass-ftality-test') {
        const decedents = Array.isArray(reportData.data?.decedents) ? reportData.data.decedents : [];
        for (let i = 0; i < decedents.length; i++) {
            const dec = decedents[i];
            const decType = (dec.typeOfDeath || '').toString().toUpperCase();
            if (decType !== 'CK') continue;

            // Build a virtual coroner-report-like data object for this decedent
            const virtualData = {
                ...reportData.data,
                decedentName: dec.decedentName || 'Unknown',
                decedentOOC: dec.decedentOOC || '',
                dateTime: dec.pronouncedTimeOfDeath || dec.dateOfDeath || reportData.data?.dateTime || '',
                dateOfDeath: dec.dateOfDeath || dec.pronouncedTimeOfDeath || '',
                typeOfDeath: 'CK',
                age: dec.age || '',
                sex: dec.sex || '',
                ethnicity: dec.ethnicity || '',
                placeOfDeath: dec.location || dec.placeOfDeath || '',
                bodyStatus: dec.bodyStatus || 'HELD',
                Manner: dec.mannerOfDeath || dec.causeOfDeath || '',
            };

            const virtualReport = { ...reportData, data: virtualData };
            const virtualKey = `${reportKey}_decedent${i}`;
            await checkAndDraftIfMorgueMatched(db, authorId, virtualKey, virtualReport);
        }
    }
}

/**
 * Start a listener on newSavedReports that passively monitors for CK reports
 * (coroner-report and mass-ftality-test) from opted-out users.
 *
 * Silently checks each report against the morgue database. Only creates a
 * death record draft if a morgue match is found. Reports saved before the
 * bot started are skipped (legacy records).
 *
 * Called from autoDeploy.js at startup alongside the scheduledReports listener.
 */
export function startCKListener(db) {
    if (_knownPassiveCKKeys) {
        console.log('[DRAFT] ⏭️ Passive CK listener already active');
        return;
    }

    _knownPassiveCKKeys = new Set();

    console.log(`[DRAFT] 🔍 Passive CK listener active on newSavedReports — skipping reports saved before 01/JUL/2026`);

    db.ref('newSavedReports').on('value', (snap) => {
        snap.forEach((authorSnap) => {
            const authorId = authorSnap.key;
            authorSnap.forEach((reportSnap) => {
                const reportKey = reportSnap.key;
                if (_knownPassiveCKKeys.has(reportKey)) return;
                _knownPassiveCKKeys.add(reportKey);

                const reportData = reportSnap.val();

                // ── Legacy gate: skip reports saved before the CK epoch ──
                if (reportData.timestamp && reportData.timestamp < CK_EPOCH) return;

                if (reportData.formId === 'coroner-report' || reportData.formId === 'mass-ftality-test') {
                    passivCKCheck(db, authorId, reportKey, reportData);
                }
            });
        });
    });

    console.log('[DRAFT] ✅ Passive CK listener active');
}

// ── Manual CK Scan (for /death-record-check command) ──

/**
 * Parse a date string in "DD/MMM/YYYY" format (e.g. "30/JUN/2026") to a Date.
 * Returns null on invalid input.
 */
function parseDateFilter(str) {
    if (!str) return null;
    const m = str.match(/^(\d{1,2})\/([A-Za-z]{3})\/(\d{4})$/);
    if (!m) return null;
    const months = {JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};
    const month = months[m[2].toUpperCase()];
    if (month === undefined) return null;
    return new Date(Date.UTC(parseInt(m[3]), month, parseInt(m[1])));
}

/**
 * Normalise a date to UTC date string "YYYY-MM-DD" for comparison.
 */
function toUTCDateKey(date) {
    if (!date || isNaN(date.getTime())) return null;
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Scan CK coroner reports (optionally filtered by date of death), match against
 * morgue records by name (exact) then closest date, and create death record drafts.
 *
 * Does NOT auto-trigger — only runs when called manually via /death-record-check.
 *
 * @param {object} db - Firebase database ref
 * @param {object} [options]
 * @param {string} [options.date] - Filter by date of death, "DD/MMM/YYYY" format
 * @returns {Promise<{total:number, drafted:number, alreadyExists:number, nameMatched:number, dateMatched:number, noMatch:number, errors:string[]}>}
 */
export async function scanAndDraftCKs(db, options = {}) {
    const results = { total: 0, drafted: 0, alreadyExists: 0, nameMatched: 0, dateMatched: 0, noMatch: 0, errors: [] };
    const ckReports = [];

    // Parse optional date filter
    const filterDate = parseDateFilter(options.date);
    const filterDateKey = filterDate ? toUTCDateKey(filterDate) : null;

    // Scan both report paths
    for (const path of ['scheduledReports', 'newSavedReports']) {
        const snap = await db.ref(path).once('value').catch(() => null);
        if (!snap?.exists()) continue;

        snap.forEach((authorSnap) => {
            const authorId = authorSnap.key;
            authorSnap.forEach((reportSnap) => {
                const reportKey = reportSnap.key;
                const reportData = reportSnap.val();

                // Must be a CK coroner report
                if (reportData.formId !== 'coroner-report') return;
                const typeOfDeath = reportData.data?.typeOfDeath?.value || reportData.data?.typeOfDeath || '';
                if (typeOfDeath.toUpperCase() !== 'CK') return;

                // Optional date filter — compare UTC date of death
                if (filterDateKey) {
                    const dod = reportData.data?.dateTime || reportData.data?.dateOfDeath || '';
                    if (!dod) return;
                    const reportDate = new Date(dod);
                    const reportDateKey = toUTCDateKey(reportDate);
                    if (!reportDateKey || reportDateKey !== filterDateKey) return;
                }

                ckReports.push({ authorId, reportKey, reportData });
            });
        });
    }

    results.total = ckReports.length;

    // Load all morgue records once for date-based matching
    const morgueSnap = await db.ref('morgue-records').once('value').catch(() => null);
    const allMorgueRecords = [];
    if (morgueSnap?.exists()) {
        morgueSnap.forEach((child) => {
            allMorgueRecords.push({ ...child.val(), firebaseKey: child.key });
        });
    }

    for (const { authorId, reportKey, reportData } of ckReports) {
        try {
            // Skip if draft already exists
            const draftSnap = await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).once('value').catch(() => null);
            if (draftSnap?.exists()) {
                results.alreadyExists++;
                continue;
            }

            const decedentName = (reportData.data?.decedentName || '').trim().toLowerCase();

            // Step 1: Try exact name match against morgue records
            let morgueMatch = allMorgueRecords.find(
                (m) => (m.name || '').trim().toLowerCase() === decedentName
            );

            // Step 2: Fall back to closest date match
            if (!morgueMatch) {
                const reportDod = reportData.data?.dateTime || reportData.data?.dateOfDeath || '';
                const reportTime = new Date(reportDod).getTime();

                if (!isNaN(reportTime) && allMorgueRecords.length > 0) {
                    let bestDist = Infinity;
                    for (const m of allMorgueRecords) {
                        // Try timeOfDeath first, then lastUpdated
                        let mTime = m.timeOfDeath ? new Date(m.timeOfDeath).getTime() : NaN;
                        if (isNaN(mTime)) mTime = m.lastUpdated || 0;
                        if (!mTime || isNaN(mTime)) continue;

                        const dist = Math.abs(reportTime - mTime);
                        if (dist < bestDist) {
                            bestDist = dist;
                            morgueMatch = m;
                        }
                    }
                }

                if (morgueMatch) {
                    results.dateMatched++;
                    console.log(`[DRAFT] 📅 Date-matched ${reportKey} → morgue Case #${morgueMatch.caseId || '?'} (${decedentName})`);
                } else {
                    results.noMatch++;
                }
            } else {
                results.nameMatched++;
                console.log(`[DRAFT] 👤 Name-matched ${reportKey} → morgue Case #${morgueMatch.caseId || '?'}`);
            }

            // Generate draft with best available morgue data
            const draft = generateDraft(reportData, morgueMatch || null);
            if (!draft) {
                results.errors.push(`${reportKey}: template error`);
                continue;
            }

            const needsMorgue = !morgueMatch;

            // Send to Discord
            const msg = await sendDraft(draft, reportData, authorId, reportKey, needsMorgue);
            if (!msg) {
                results.errors.push(`${reportKey}: failed to send draft to Discord`);
                continue;
            }

            // Persist draft tracking in Firebase
            await db.ref(`${DRAFT_TRACK_PATH}/${reportKey}`).set({
                authorId,
                reportKey,
                title: draft.title,
                bbCode: draft.bbCode,
                decedentName: reportData.data?.decedentName || '',
                decedentOOC: reportData.data?.decedentOOC || '',
                status: 'pending_review',
                needsMorgue,
                morgueCheckedAt: morgueMatch ? Date.now() : null,
                morgueCaseId: morgueMatch?.caseId || null,
                messageId: msg.id,
                channelId: DRAFT_CHANNEL_ID,
                createdAt: Date.now(),
                formId: reportData.formId,
                scanDate: options.date || null,
            });

            results.drafted++;
            console.log(`[DRAFT] ✅ Draft created for ${reportKey}${needsMorgue ? ' (awaiting morgue)' : ''}`);
        } catch (err) {
            results.errors.push(`${reportKey}: ${err.message.slice(0, 120)}`);
            console.error(`[DRAFT] ❌ scanAndDraftCKs error for ${reportKey}:`, err.message);
        }
    }

    return results;
}
