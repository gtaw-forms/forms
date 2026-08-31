/**
 * autopsy-request.js — Submit a supervised final-autopsy request.
 *
 * Flow:
 *   /autopsy-request case:<morgueCaseId> me:<ME>
 *     1. If `case` is given, the morgue record prefills Section 2 (decedent) fields.
 *     2. Three chained modals collect the remaining template fields.
 *     3. A preview embed is posted in Discord (dry run) with the full request
 *        BBCode + .txt attachment and Approve / Edit / Deny buttons.
 *     4. On Approve the request topic is posted to f=265 in the standard format,
 *        carrying an `ASSIGNED: <ME> for Final Autopsy Exams` marker in Section 3
 *        that the autopsy monitor honors (assigns that ME instead of rotation).
 */
import { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import firebase from '../services/firebase.js';
import { getForumClient } from '../services/forumClient.js';
import { getRotationStatus } from '../services/autopsyRotation.js';
import { shortId } from '../services/deathRecordDraftCache.js';

const DRAFT_PATH = 'autopsy-request-drafts';
const PHMC_BASE = 'https://phmc.gta.world';
const REQUEST_FORUM_ID = 265;

const SYNOPSIS_DEFAULT = 'This body has been donated by Los Santos County for research and education purposes for the purposes of forensic analysis';
const REASON_DEFAULT = 'Authorized training by Los Santos County.';

const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };

// Holds chained-modal field state per user (cleared after Modal 3 / deny).
const _modalState = new Map();

// ── Command Definition ──

export const data = new SlashCommandBuilder()
    .setName('autopsy-request')
    .setDescription('Submit a supervised final-autopsy request (preview in Discord, then posts to f=265)')
    .addStringOption(opt =>
        opt.setName('case')
            .setDescription('Morgue case # to prefill decedent fields')
            .setRequired(false))
    .addStringOption(opt =>
        opt.setName('me')
            .setDescription('ME to assign (Final Autopsy Exams) — leave blank for rotation')
            .setRequired(false)
            .setAutocomplete(true));

// ── Permission ──

async function isAllowed(interaction, db) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (ownerId && interaction.user.id === ownerId) return true;

    // ME gate: the Discord user must be mapped to a rotation ME
    // (autopsy-requests/discord-members/<forum_name> = discordUserId).
    try {
        const snap = await db.ref('autopsy-requests/discord-members').once('value');
        if (!snap.exists()) return false;
        let meName = null;
        snap.forEach((child) => { if (child.val() === interaction.user.id) meName = child.key; });
        if (!meName) return false;
        const status = await getRotationStatus(db);
        return (status.list || []).some(n => n.toLowerCase() === meName.toLowerCase());
    } catch {
        return false;
    }
}

/** Autocomplete for the `me` option — rotation ME names. */
export async function autocomplete(interaction) {
    if (interaction.options.getFocused(true).name !== 'me') {
        await interaction.respond([]);
        return;
    }
    try {
        firebase.init();
        const db = firebase.db;
        const status = await getRotationStatus(db);
        const names = status.list || [];
        const focused = interaction.options.getFocused().toLowerCase();
        const filtered = names.filter(n => n.toLowerCase().includes(focused)).slice(0, 25);
        await interaction.respond(filtered.map(n => ({ name: n, value: n })));
    } catch (err) {
        console.error('[AUTO-REQ] Autocomplete error:', err.message);
        await interaction.respond([]);
    }
}

// ── Morgue prefill ──

function morgueTimeToFields(raw) {
    const m = String(raw || '').match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return { dod: '', tod: '' };
    const mon = MONTHS[m[2].toLowerCase()];
    if (!mon) return { dod: '', tod: '' };
    const dod = `${String(m[1]).padStart(2, '0')}/${m[2].substring(0, 3).toUpperCase()}/${m[3]}`;
    let h = parseInt(m[4], 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const tod = `${String(h).padStart(2, '0')}:${m[5]} ${ampm}`;
    return { dod, tod };
}

async function prefillFromMorgue(db, caseId) {
    const recs = await firebase.searchMorgueRecords(caseId);
    const rec = recs.find(r => String(r.caseId) === String(caseId));
    if (!rec) return {};
    const oocMatch = String(rec.name || '').match(/\(\(\s*([^)]*?)\s*\)\)/);
    const clean = String(rec.name || '').replace(/\(\([^)]*\)\)/g, '').trim();
    const { dod, tod } = morgueTimeToFields(rec.timeOfDeath);
    return {
        name: clean,
        ooc: oocMatch ? oocMatch[1].trim() : '',
        gender: rec.sex || '',
        dod,
        tod,
        location: rec.location || '',
    };
}

// ── Modals ──

function textInput(id, label, opts = {}) {
    const input = new TextInputBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setStyle(opts.paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setRequired(opts.required ?? true)
        .setMaxLength(opts.maxLength || 256);
    if (opts.value) input.setValue(opts.value);
    if (opts.placeholder) input.setPlaceholder(opts.placeholder);
    return input;
}

function modalRow(...inputs) {
    return new ActionRowBuilder().addComponents(...inputs);
}

function buildModal1(prefill) {
    const modal = new ModalBuilder()
        .setCustomId('ar_modal_1')
        .setTitle('Autopsy Request — Decedent (1/3)');
    modal.addComponents(
        modalRow(textInput('name', 'Decedent Name (IC)', { value: prefill.name || '', placeholder: 'John Doe' })),
        modalRow(textInput('ooc', 'Decedent OOC', { value: prefill.ooc || '', placeholder: 'Mark Smith' })),
        modalRow(textInput('gender', 'Gender', { value: prefill.gender || '', placeholder: 'Male / Female' })),
        modalRow(textInput('dod', 'Date of Death (DD/MMM/YYYY)', { value: prefill.dod || '', placeholder: '29/JUL/2026' })),
        modalRow(textInput('tod', 'Time of Death (12h AM/PM)', { value: prefill.tod || '', placeholder: '05:52 PM' })),
    );
    return modal;
}

function buildModal2(prefill) {
    const modal = new ModalBuilder()
        .setCustomId('ar_modal_2')
        .setTitle('Autopsy Request — Decedent (2/3)');
    modal.addComponents(
        modalRow(textInput('ethnicity', 'Ethnicity', { value: prefill.ethnicity || '', placeholder: 'e.g. African American', required: false })),
        modalRow(textInput('location', 'Location (street, area)', { value: prefill.location || '', placeholder: 'Davis - Innocence Blvd' })),
        modalRow(textInput('pkck', 'PK/CK', { value: prefill.pkck || '', placeholder: 'CK' })),
        modalRow(textInput('cexamine', '/cexamine image link', { required: false, placeholder: 'https://i.imgur.com/...' })),
        modalRow(textInput('cinjuries', '/cinjuries image link', { required: false, placeholder: 'https://i.imgur.com/...' })),
    );
    return modal;
}

function buildModal3(prefill) {
    const modal = new ModalBuilder()
        .setCustomId('ar_modal_3')
        .setTitle('Autopsy Request — Requester (3/3)');
    modal.addComponents(
        modalRow(textInput('req_name', 'Requester Name', { value: prefill.req_name || '', placeholder: 'Your character name' })),
        modalRow(textInput('req_rank', 'Rank', { value: prefill.req_rank || '', placeholder: 'Medical Examiner' })),
        modalRow(textInput('req_dept', 'Department / Assignment', { value: prefill.req_dept || '', placeholder: 'PHMC - EMS' })),
        modalRow(textInput('req_badge', 'Badge / Serial Number', { value: prefill.req_badge || '', placeholder: 'Serial #' })),
        modalRow(textInput('faction', 'Faction tag for request title', { value: prefill.faction || 'LSSD', placeholder: 'LSPD / LSSD' })),
    );
    return modal;
}

// ── BBCode Builder ──

function buildRequestBbcode(f) {
    return `[divbox=grey][center][img]https://i.imgur.com/s5acD6S.png[/img][/center][/divbox]
[divbox=white]
[br][/br]
[center][b][size=170]AUTOPSY REQUEST[/size][/b][/center]
[center][size=65]LOS SANTOS DEPARTMENT OF MEDICAL EXAMINER-CORONER[/size][/center]
[color=transparent]SPACER[/color]
[hr][/hr]
[center]Provide [b]full[/b] or [b]partial[/b] search input using the following fields:
[/center]
[hr][/hr]
[divbox=lightgrey][color=#800000][b]SECTION 1: REQUESTER'S INFORMATION[/b][/color][/divbox]
[divbox=white][b]1.) Name:[/b] ${f.req_name || 'N/A'}
[b]2.) Rank:[/b] ${f.req_rank || 'N/A'}
[b]3.) Department / Assignment:[/b] ${f.req_dept || 'N/A'}
[b]4.) Badge/Serial Number:[/b] ${f.req_badge || 'N/A'}
[b] 5.) Read and understood [url=https://phmc.gta.world/viewtopic.php?t=9572]Autopsy Guidelines[/url][/b]: YES
[b]6.) Contact Information:[/b]: 
[list][*]Cell Number: N/A
[*](( Discord Name: ${f.req_discord || 'N/A'} ))[/list]

[/divbox]
[br][/br][divbox=lightgrey][color=#800000][b]SECTION 2: DECEDENT'S INFORMATION[/b][/color][/divbox]
[divbox=white][size=85](If you are requesting for multiple bodies, you can number them instead of separate topics. EX: John Doe (1), John Doe (2)) - You must include the OOC names here in brackets next to the name, EX: John Doe ((Mark Smith)) [/size]
[b]1.) Decedent Name:[/b] ${f.name} (( ${f.ooc} ))
[b]2.) Gender:[/b] ${f.gender || 'N/A'}
[b]3.) Ethnicity:[/b] ${f.ethnicity || 'N/A'}
[b]4.) Date of Death:[/b] ${f.dod || 'N/A'}
[b]5.) Time of Death:[/b] ${f.tod || 'N/A'}
[b]6.) Location:[/b] ${f.location || 'N/A'}
[/divbox]
[br][/br][divbox=lightgrey][color=#800000][b]SECTION 3: DETAILS[/b][/color][/divbox]
[divbox=white][size=85](Summarize what you observed at the crime scene, include everything related to death and victim; casings, weapons etc.)[/size]
[b]1.) Synopsis:[/b] ${SYNOPSIS_DEFAULT}
[b]2.) Reason for Autopsy:[/b] ${REASON_DEFAULT}
${f.me ? `[b]ASSIGNED:[/b] ${f.me} for Final Autopsy Exams` : ''}
[/divbox]
[br][/br][divbox=lightgrey][color=#800000][b][ooc]SECTION 4: OOC INFORMATION[/ooc][/b][/color][/divbox]
[divbox=white][size=85](/cexamine and /cinjuries are no longer mandatory fields for PKs, post them if you happen to have them on hand. CKs have a mandatory cexamine and cinjuries)[/size]
[b]1.) PK/CK[/b]: ${f.pkck || 'N/A'}
[b]2.) /cexamine[/b]: ${f.cexamine ? `[img]${f.cexamine}[/img]` : 'N/A'}
[b]3.) /cinjuries[/b]: ${f.cinjuries ? `[img]${f.cinjuries}[/img]` : 'N/A'}
[/divbox][/divbox]`;
}

// ── Execute ──

export async function execute(interaction) {
    firebase.init();
    const db = firebase.db;

    if (!(await isAllowed(interaction, db))) {
        await interaction.reply({ content: 'Only the bot owner or a registered Medical Examiner can submit autopsy requests.', flags: MessageFlags.Ephemeral });
        return;
    }

    const caseId = (interaction.options.getString('case') || '').trim();
    const me = (interaction.options.getString('me') || '').trim();

    let prefill = { caseId, me };
    if (caseId) {
        try {
            const morguePrefill = await prefillFromMorgue(db, caseId);
            Object.assign(prefill, morguePrefill);
            console.log(`[AUTO-REQ] Prefilled from morgue case #${caseId}: ${JSON.stringify(morguePrefill)}`);
        } catch (err) {
            console.warn(`[AUTO-REQ] Morgue prefill failed for ${caseId}: ${err.message}`);
        }
    }

    _modalState.set(interaction.user.id, prefill);
    await interaction.showModal(buildModal1(prefill));
}

// ── Modal handlers (chained) ──

export async function handleModal(interaction) {
    const customId = interaction.customId;
    const state = _modalState.get(interaction.user.id) || {};

    if (customId === 'ar_modal_1') {
        for (const id of ['name', 'ooc', 'gender', 'dod', 'tod']) {
            state[id] = interaction.fields.getTextInputValue(id);
        }
        _modalState.set(interaction.user.id, state);
        await interaction.showModal(buildModal2(state));
        return;
    }

    if (customId === 'ar_modal_2') {
        for (const id of ['ethnicity', 'location', 'pkck', 'cexamine', 'cinjuries']) {
            state[id] = interaction.fields.getTextInputValue(id);
        }
        _modalState.set(interaction.user.id, state);
        await interaction.showModal(buildModal3(state));
        return;
    }

    if (customId === 'ar_modal_3') {
        for (const id of ['req_name', 'req_rank', 'req_dept', 'req_badge', 'faction']) {
            state[id] = interaction.fields.getTextInputValue(id);
        }
        _modalState.delete(interaction.user.id);

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const bbcode = buildRequestBbcode(state);
        const faction = (state.faction || 'LSSD').toUpperCase().replace(/[^\w]/g, '');
        const title = `Autopsy Request - ${state.name || 'Unknown'} (( ${state.ooc || ''} )) [${faction}]`;

        const nonce = `${Date.now()}_${interaction.user.id.slice(-4)}`;
        const draft = {
            bbcode,
            title,
            me: state.me || '',
            caseId: state.caseId || '',
            fields: state,
            authorId: interaction.user.id,
            createdAt: Date.now(),
        };
        try {
            await db.ref(`${DRAFT_PATH}/${nonce}`).set(draft);
        } catch (err) {
            await interaction.editReply({ content: `[ERR] Failed to save preview draft: ${err.message}` });
            return;
        }
        try { await db.ref(`${DRAFT_PATH}/_ids/${shortId(nonce)}`).set(nonce); } catch (e) {}

        const bbPreview = bbcode.length > 800 ? bbcode.slice(0, 800) + '...' : bbcode;

        // Rotation status for the preview — show surge/next-up when the request
        // will be auto-assigned (no explicit ME marker).
        let rotationField = null;
        if (!state.me) {
            try {
                const rot = await getRotationStatus(db);
                if (rot.configured) {
                    rotationField = rot.surgeMode
                        ? `**🔀 Surge mode active** — every ME has an active case. Will assign the **least-loaded** ME, ties broken by **oldest last-assigned**${rot.surgePick ? ` → next up: **${rot.surgePick}**` : ''}.`
                        : `Rotation next up: **${rot.effectiveNext || 'none available'}**.`;
                }
            } catch (e) {
                console.warn('[AUTO-REQ] Rotation status unavailable:', e.message);
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0xffa500)
            .setTitle('Autopsy Request Preview (Dry Run)')
            .setDescription(`**${title}**`)
            .addFields(
                { name: 'Assigned ME', value: state.me || 'Auto (rotation)', inline: true },
                { name: 'Morgue Case #', value: state.caseId || '—', inline: true },
                { name: 'Decedent', value: `${state.name || 'Unknown'} ((${state.ooc || ''}))`, inline: false },
                { name: 'Section 3 Marker', value: state.me ? `ASSIGNED: ${state.me} for Final Autopsy Exams` : 'No assigned marker (rotation will pick)', inline: false },
                ...(rotationField ? [{ name: 'Rotation Status', value: rotationField, inline: false }] : []),
                { name: 'BBCode Preview', value: `\`\`\`${bbPreview}\`\`\``, inline: false },
            )
            .setFooter({ text: 'Nothing has been posted — Approve to submit to f=265.' })
            .setTimestamp();

        const bbFile = new AttachmentBuilder(Buffer.from(bbcode, 'utf-8'), { name: 'autopsy-request-bbcode.txt' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ar_appr_${shortId(nonce)}`).setLabel('Approve & Post').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`ar_edit_${shortId(nonce)}`).setLabel('Edit').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`ar_deny_${shortId(nonce)}`).setLabel('Deny').setStyle(ButtonStyle.Danger),
        );

        let previewMsg = null;
        try {
            const channel = interaction.channel;
            previewMsg = await channel.send({ embeds: [embed], components: [row], files: [bbFile] });
            await db.ref(`${DRAFT_PATH}/${nonce}/messageId`).set(previewMsg.id).catch(() => {});
            await db.ref(`${DRAFT_PATH}/${nonce}/channelId`).set(channel.id).catch(() => {});
        } catch (err) {
            console.error('[AUTO-REQ] Preview send failed:', err.message);
            await interaction.editReply({ content: `[ERR] Failed to send preview: ${err.message}` });
            return;
        }

        await interaction.editReply({ content: `Preview posted — **Approve** to submit, **Edit** to revise, **Deny** to discard.` });
        console.log(`[AUTO-REQ] Preview sent for "${title}" (nonce ${nonce})`);
    }
}

// ── Button handlers ──

async function resolveNonce(db, shortKey) {
    try {
        const snap = await db.ref(`${DRAFT_PATH}/_ids/${shortKey}`).once('value');
        if (snap.exists()) return snap.val();
    } catch (e) {}
    return shortKey;
}

async function loadDraft(db, interaction, shortKey) {
    const nonce = await resolveNonce(db, shortKey);
    const snap = await db.ref(`${DRAFT_PATH}/${nonce}`).once('value').catch(() => null);
    return snap?.exists() ? { nonce, draft: snap.val() } : null;
}

export async function handleButton(interaction) {
    const customId = interaction.customId;
    if (!customId.startsWith('ar_')) return;

    firebase.init();
    const db = firebase.db;

    if (customId.startsWith('ar_appr_')) {
        const shortKey = customId.slice('ar_appr_'.length);
        const found = await loadDraft(db, interaction, shortKey);
        if (!found) {
            await interaction.reply({ content: 'Preview draft not found (may already be posted).', flags: MessageFlags.Ephemeral });
            return;
        }
        const { nonce, draft } = found;
        if (draft.authorId !== interaction.user.id && interaction.user.id !== process.env.BOT_OWNER_ID) {
            await interaction.reply({ content: 'Only the requester or bot owner can approve this.', flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
            const client = getForumClient();
            await client.ensureBrowser();
            await client.login(null, null, { force: false, baseUrl: PHMC_BASE });

            const postUrl = `${PHMC_BASE}/posting.php?mode=post&f=${REQUEST_FORUM_ID}`;
            await client.page.goto(postUrl, { waitUntil: 'networkidle', timeout: 180000 });
            await client.page.waitForTimeout(2000);

            let pUrl = client.page.url();
            if (pUrl.includes('mode=login')) {
                console.log('[AUTO-REQ] Re-authenticating...');
                await client.login(null, null, { force: true, baseUrl: PHMC_BASE });
                await client.page.goto(postUrl, { waitUntil: 'networkidle', timeout: 180000 });
                await client.page.waitForTimeout(2000);
            }

            await client.page.evaluate((s) => {
                const el = document.querySelector('input[name="subject"]');
                if (el) { el.value = s; el.dispatchEvent(new Event('input', { bubbles: true })); }
            }, draft.title);

            await client.page.evaluate((msg) => {
                const ta = document.querySelector('textarea[name="message"]');
                if (ta) { ta.value = msg; ta.dispatchEvent(new Event('input', { bubbles: true })); }
            }, draft.bbcode);

            await client.page.waitForTimeout(500);

            const submitResult = await client.page.evaluate(() => {
                const form = document.querySelector('form[action*="posting.php"]');
                if (!form) return { ok: false, reason: 'No form' };
                const btn = form.querySelector('input[type="submit"][name="post"], input[type="submit"][value="Submit"], button[type="submit"][name="post"]');
                if (!btn) return { ok: false, reason: 'No submit button' };
                btn.click();
                return { ok: true };
            });

            if (!submitResult.ok) {
                await interaction.editReply({ content: `Failed to post topic: ${submitResult.reason}` });
                return;
            }

            await client.page.waitForTimeout(5000);
            const finalUrl = client.page.url();

            // Update the preview message to reflect the post
            try {
                const channel = interaction.channel;
                const msg = await channel.messages.fetch(draft.messageId).catch(() => null);
                if (msg) {
                    const doneEmbed = EmbedBuilder.from(msg.embeds[0])
                        .setColor(0x28a745)
                        .setTitle('Autopsy Request Posted')
                        .setDescription(`**${draft.title}**\n[View Request](<${finalUrl}>)`)
                        .setFooter({ text: 'The autopsy monitor will create the case and assign the marked ME.' });
                    const doneRow = ActionRowBuilder.from(msg.components[0]);
                    doneRow.components.forEach(btn => btn.setDisabled(true));
                    await msg.edit({ embeds: [doneEmbed], components: [doneRow] });
                }
            } catch (msgErr) {
                console.warn('[AUTO-REQ] Preview update failed:', msgErr.message);
            }

            await db.ref(`${DRAFT_PATH}/${nonce}`).remove().catch(() => {});
            await db.ref(`${DRAFT_PATH}/_ids/${shortId(nonce)}`).remove().catch(() => {});

            await interaction.editReply({ content: `Request posted to f=265: <${finalUrl}>\nAssigned ME marker: **${draft.me || 'rotation'}**. The monitor will create the case and tag the ME.` });
            console.log(`[AUTO-REQ] Posted autopsy request "${draft.title}" → ${finalUrl}`);
        } catch (err) {
            console.error('[AUTO-REQ] Approve error:', err.message);
            await interaction.editReply({ content: `[ERR] ${err.message}` });
        }
        return;
    }

    if (customId.startsWith('ar_edit_')) {
        const shortKey = customId.slice('ar_edit_'.length);
        const found = await loadDraft(db, interaction, shortKey);
        if (!found) {
            await interaction.reply({ content: 'Preview draft not found (may already be posted).', flags: MessageFlags.Ephemeral });
            return;
        }
        const { nonce, draft } = found;
        if (draft.authorId !== interaction.user.id && interaction.user.id !== process.env.BOT_OWNER_ID) {
            await interaction.reply({ content: 'Only the requester or bot owner can edit this.', flags: MessageFlags.Ephemeral });
            return;
        }
        // Retire this draft so the old preview can't be approved/denied after a revision.
        await db.ref(`${DRAFT_PATH}/${nonce}`).remove().catch(() => {});
        await db.ref(`${DRAFT_PATH}/_ids/${shortId(nonce)}`).remove().catch(() => {});
        _modalState.set(interaction.user.id, { ...draft.fields, me: draft.me, caseId: draft.caseId });
        await interaction.showModal(buildModal1(draft.fields));
        return;
    }

    if (customId.startsWith('ar_deny_')) {
        const shortKey = customId.slice('ar_deny_'.length);
        const found = await loadDraft(db, interaction, shortKey);
        if (!found) {
            await interaction.reply({ content: 'Preview draft not found.', flags: MessageFlags.Ephemeral });
            return;
        }
        const { nonce, draft } = found;
        if (draft.authorId !== interaction.user.id && interaction.user.id !== process.env.BOT_OWNER_ID) {
            await interaction.reply({ content: 'Only the requester or bot owner can deny this.', flags: MessageFlags.Ephemeral });
            return;
        }
        await db.ref(`${DRAFT_PATH}/${nonce}`).remove().catch(() => {});
        await db.ref(`${DRAFT_PATH}/_ids/${shortId(nonce)}`).remove().catch(() => {});
        try {
            const channel = interaction.channel;
            const msg = await channel.messages.fetch(draft.messageId).catch(() => null);
            if (msg) {
                const doneEmbed = EmbedBuilder.from(msg.embeds[0])
                    .setColor(0xdc3545)
                    .setTitle('Autopsy Request Denied');
                const doneRow = ActionRowBuilder.from(msg.components[0]);
                doneRow.components.forEach(btn => btn.setDisabled(true));
                await msg.edit({ embeds: [doneEmbed], components: [doneRow] });
            }
        } catch (msgErr) {}
        await interaction.reply({ content: 'Preview discarded.', flags: MessageFlags.Ephemeral });
        return;
    }
}
