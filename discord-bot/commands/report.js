import {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';
import firebase from '../services/firebase.js';
import { getForumClient } from '../services/forumClient.js';
import { generateAutopsyBBCode } from '../services/autopsyGenerator.js';
import { buildAutopsyModal } from '../components/autopsyModal.js';
import { generateCoronerBBCode, mapCoronerData } from '../services/coronerGenerator.js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const data = new SlashCommandBuilder()
    .setName('report')
    .setDescription('Generate and manage reports')
    // ── Utility subcommands ──
    .addSubcommand(sub => sub
        .setName('list')
        .setDescription('List pending reports awaiting deployment')
    )
    .addSubcommand(sub => sub
        .setName('login')
        .setDescription('Set or test forum login credentials')
    )
    .addSubcommand(sub => sub
        .setName('status')
        .setDescription('Check if the forum session is still valid')
    )
    // ── Form subcommand ──
    .addSubcommand(sub => sub
        .setName('form')
        .setDescription('Generate a report from a form type')
        .addStringOption(opt => opt
            .setName('type')
            .setDescription('Type of report to generate')
            .setRequired(true)
            .addChoices(
                { name: 'Autopsy', value: 'autopsy' },
                { name: 'Coroner Report', value: 'coroner' },
                // Future form types:
                // { name: 'Death Record', value: 'deathrecord' },
                // { name: 'Mass Fatality', value: 'mass-fatality' },
            )
        )
    );

// ── Helpers ──

const MANNER_OPTIONS = [
    { label: 'PK (Player Kill)', value: 'PK', emoji: '⚔️' },
    { label: 'CK (Character Kill)', value: 'CK', emoji: '💀' },
    { label: 'Natural', value: 'Natural', emoji: '🕊️' },
    { label: 'Accident', value: 'Accident', emoji: '⚠️' },
    { label: 'Suicide', value: 'Suicide', emoji: '🔫' },
    { label: 'Undetermined', value: 'Undetermined', emoji: '❓' },
];

// ── Per-form-type forum URL overrides ──
// Some form types post to specific sections that may differ from the default base URL.
const FORUM_URL_OVERRIDES = {
    coroner: 'https://phmc.gta.world/posting.php?mode=post&f=489',
};

const FORUM_LABELS = {
    'coroner-report': 'Coroner Report',
    'coroner_email': 'Coroner Email',
    'mass-ftality-test': 'Mass Fatality',
};

function formatReportType(report) {
    return FORUM_LABELS[report.formId] || report.formName || report.formId || 'Unknown';
}

async function findUndeployedReports(db) {
    const snap = await db.ref('testingSavedReports').once('value');
    const data = snap.val();
    if (!data) return [];

    const reports = [];
    for (const [authorId, authorReports] of Object.entries(data)) {
        for (const [key, report] of Object.entries(authorReports)) {
            if (report.hasdeployed === false) {
                reports.push({ authorId, key, report });
            }
        }
    }
    return reports;
}

const FORM_SETUP_MODAL_ID = 'report_form_setup';

/**
 * Show a modal asking for Topic Title and Forum section ID/URL.
 * Returns { submitted, topicTitle, forumId } or null if cancelled.
 */
async function promptFormSetup(interaction) {
    const modal = new ModalBuilder()
        .setCustomId(FORM_SETUP_MODAL_ID)
        .setTitle('Report Setup');

    const titleInput = new TextInputBuilder()
        .setCustomId('topic_title')
        .setLabel('Topic Title')
        .setPlaceholder('e.g. Autopsy Report — John Doe')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(200)
        .setRequired(true);

    const forumInput = new TextInputBuilder()
        .setCustomId('forum_section')
        .setLabel('Forum Section ID or URL')
        .setPlaceholder('Numeric ID (e.g. 6) or forum URL containing f=...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(forumInput),
    );

    await interaction.showModal(modal);

    const submitted = await interaction
        .awaitModalSubmit({
            filter: (i) => i.customId === FORM_SETUP_MODAL_ID && i.user.id === interaction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return null;

    const topicTitle = submitted.fields.getTextInputValue('topic_title').trim();
    const forumRaw = submitted.fields.getTextInputValue('forum_section').trim();

    // Parse numeric ID from raw input — support bare numbers or full URLs containing f=...
    let forumId = null;
    if (/^\d+$/.test(forumRaw)) {
        forumId = parseInt(forumRaw, 10);
    } else {
        const match = forumRaw.match(/[?&]f=(\d+)/);
        if (match) forumId = parseInt(match[1], 10);
    }

    if (!forumId) {
        await submitted.reply({
            content: '❌ Invalid forum section. Enter a numeric ID (e.g. 6) or a forum URL containing `f=...`.',
            flags: MessageFlags.Ephemeral,
        });
        return null;
    }

    return { submitted, topicTitle, forumId };
}

// ── Execute ──

export async function execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const caller = interaction.user.tag;

    console.log(`[REPORT] 🔍 /report ${sub} invoked by ${caller}`);

    switch (sub) {
        case 'list':
            return handleList(interaction);
        case 'login':
            return handleLogin(interaction);
        case 'status':
            return handleStatus(interaction);
        case 'form': {
            const type = interaction.options.getString('type', true);

            // Show setup modal first (Topic Title + Forum section)
            const setup = await promptFormSetup(interaction);
            if (!setup) return; // cancelled or timed out

            const { submitted, topicTitle, forumId } = setup;

            switch (type) {
                case 'autopsy':
                    return handleAutopsy({ interaction, submitted, topicTitle, forumId });
                case 'coroner':
                    return handleCoroner({ interaction, submitted, topicTitle, forumId });
                default:
                    await submitted.editReply({
                        content: `❌ Unknown form type \`${type}\`. Available: \`autopsy\`, \`coroner\`.`,
                    });
            }
            break;
        }
        default:
            await interaction.reply({
                content: `⚠️ Unknown subcommand. Use \`/report form type:autopsy\`, \`list\`, \`login\`, or \`status\`.`,
                flags: MessageFlags.Ephemeral,
            });
    }
}

// ── Sub: list ──

async function handleList(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        firebase.init();
        const db = firebase.db;
        const reports = await findUndeployedReports(db);

        if (reports.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('✅ All Clear')
                .setDescription('No reports currently awaiting deployment.')
                .setFooter({ text: 'Reports are stored in testingSavedReports' });
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        const maxShow = 25;
        const shown = reports.slice(0, maxShow);
        const lines = shown.map((r, i) => {
            const type = formatReportType(r.report);
            const subject = r.report.originalKey || r.key;
            return `\`${i + 1}.\` **${subject}** — ${type}\n> 🆔 \`${r.key}\``;
        });

        const embed = new EmbedBuilder()
            .setColor(0xe67e22)
            .setTitle(`📋 Pending Reports (${reports.length})`)
            .setDescription(lines.join('\n'))
            .setFooter({ text: `Showing ${shown.length} of ${reports.length}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('[REPORT] ❌ list error:', error.message);
        await interaction.editReply({ content: `❌ ${error.message}` });
    }
}

// ── Sub: login (modal) ──

async function handleLogin(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('report_login_modal')
        .setTitle('Forum Login');

    const usernameInput = new TextInputBuilder()
        .setCustomId('forum_username')
        .setLabel('Username')
        .setPlaceholder('Your forum username')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const passwordInput = new TextInputBuilder()
        .setCustomId('forum_password')
        .setLabel('Password')
        .setPlaceholder('Your forum password')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const urlInput = new TextInputBuilder()
        .setCustomId('forum_url')
        .setLabel('Forum URL (optional)')
        .setPlaceholder('http://lspd.gta.world')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

    const row1 = new ActionRowBuilder().addComponents(usernameInput);
    const row2 = new ActionRowBuilder().addComponents(passwordInput);
    const row3 = new ActionRowBuilder().addComponents(urlInput);

    modal.addComponents(row1, row2, row3);
    await interaction.showModal(modal);

    const submitted = await interaction
        .awaitModalSubmit({
            filter: (i) => i.customId === 'report_login_modal' && i.user.id === interaction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) {
        await interaction.followUp({ content: '⏰ Login modal timed out.', flags: MessageFlags.Ephemeral });
        return;
    }

    await submitted.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const username = submitted.fields.getTextInputValue('forum_username');
        const password = submitted.fields.getTextInputValue('forum_password');
        const url = submitted.fields.getTextInputValue('forum_url') || process.env.FORUM_BASE_URL || 'http://lspd.gta.world';

        const origUrl = process.env.FORUM_BASE_URL;
        const origUser = process.env.FORUM_USERNAME;
        const origPass = process.env.FORUM_PASSWORD;
        process.env.FORUM_BASE_URL = url;
        process.env.FORUM_USERNAME = username;
        process.env.FORUM_PASSWORD = password;

        try {
            const client = getForumClient();
            await client.login();
            await submitted.editReply({
                content: `✅ **Login successful!**\n> Session saved for \`${url}\` as **${username}**.`,
            });
        } finally {
            process.env.FORUM_BASE_URL = origUrl;
            process.env.FORUM_USERNAME = origUser;
            process.env.FORUM_PASSWORD = origPass;
        }
    } catch (error) {
        console.error('[REPORT] ❌ login error:', error.message);
        await submitted.editReply({
            content: `❌ **Login failed:** ${error.message.substring(0, 200)}`,
        });
    }
}

// ── Sub: status ──

async function handleStatus(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const client = getForumClient();
        const hasSession = client.hasSession();
        let valid = false;

        if (hasSession) {
            valid = await client.validateSession();
        }

        const embed = new EmbedBuilder()
            .setColor(valid ? 0x2ecc71 : hasSession ? 0xe67e22 : 0xe74c3c)
            .setTitle('🔐 Forum Session Status')
            .addFields(
                {
                    name: 'Stored Session',
                    value: hasSession ? '✅ Exists' : '❌ None',
                    inline: true,
                },
                {
                    name: 'Session Valid',
                    value: valid ? '✅ Yes' : hasSession ? '⚠️ Expired' : 'N/A',
                    inline: true,
                },
                {
                    name: 'Forum URL',
                    value: `\`${client.baseUrl}\``,
                    inline: false,
                },
            )
            .setFooter({ text: valid ? 'Ready' : 'Use /report login to authenticate' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('[REPORT] ❌ status error:', error.message);
        await interaction.editReply({ content: `❌ ${error.message}` });
    }
}

// ── Sub: autopsy ──

async function handleAutopsy({ interaction, submitted, topicTitle, forumId }) {
    const userId = interaction.user.id;
    const username = interaction.user.tag;

    console.log(`[REPORT] 🔍 /report form:autopsy invoked by ${username} (${userId}) | title="${topicTitle}" forum=${forumId}`);

    await submitted.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        // Fetch all records (no query filter — show everything to pick from)
        console.log('[REPORT] 🔄 Fetching morgue records...');
        const allRecords = await firebase.searchMorgueRecords('');
        console.log(`[REPORT] ✅ Found ${allRecords.length} records`);

        if (allRecords.length === 0) {
            await submitted.editReply({ content: '❌ No morgue records found in the database.' });
            return;
        }

        let records = allRecords;
        if (records.length > 25) {
            records.length = 25;
        }

        records.sort((a, b) => {
            const caseA = Number(a.caseId) || 0;
            const caseB = Number(b.caseId) || 0;
            return caseB - caseA;
        });

        // ── Step 1: Show record select menu ──
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('report_autopsy_select_record')
            .setPlaceholder(`Select a record (${records.length} found)`)
            .addOptions(
                records.map(r => {
                    const label = `#${r.caseId} — ${(r.name || 'Unknown').slice(0, 80)}`;
                    return new StringSelectMenuOptionBuilder()
                        .setLabel(label.slice(0, 100))
                        .setValue(r.firebaseKey);
                })
            );

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);

        const response = await submitted.editReply({
            content: `**${topicTitle}** — Select a morgue record:`,
            components: [selectRow],
        });

        const recordCollector = response.createMessageComponentCollector({
            time: 60_000,
            max: 1,
        });

        let selectedRecord = null;

        recordCollector.on('collect', async (selectInteraction) => {
            if (selectInteraction.user.id !== userId) {
                await selectInteraction.reply({
                    content: '❌ This interaction is not for you.',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const recordKey = selectInteraction.values[0];
            selectedRecord = records.find(r => r.firebaseKey === recordKey);

            if (!selectedRecord) {
                await selectInteraction.update({
                    content: '❌ Record not found. Please try again.',
                    components: [],
                });
                return;
            }

            console.log(`[REPORT] 📋 Record selected: Case #${selectedRecord.caseId} — ${selectedRecord.name}`);

            // ── Step 2: Show Manner of Death select menu ──
            const modMenu = new StringSelectMenuBuilder()
                .setCustomId('report_autopsy_select_manner')
                .setPlaceholder('Select Manner of Death')
                .addOptions(
                    MANNER_OPTIONS.map(opt =>
                        new StringSelectMenuOptionBuilder()
                            .setLabel(opt.label)
                            .setValue(opt.value)
                            .setEmoji(opt.emoji)
                    )
                );

            const modRow = new ActionRowBuilder().addComponents(modMenu);

            await selectInteraction.update({
                content: `**${topicTitle}** — Record: #${selectedRecord.caseId} — ${selectedRecord.name}\n**Now select Manner of Death:**`,
                components: [modRow],
            });

            const modCollector = (await selectInteraction.fetchReply()).createMessageComponentCollector({
                time: 60_000,
                max: 1,
            });

            modCollector.on('collect', async (modInteraction) => {
                if (modInteraction.user.id !== userId) {
                    await modInteraction.reply({
                        content: '❌ This interaction is not for you.',
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }

                const mannerOfDeath = modInteraction.values[0];
                console.log(`[REPORT] 🎯 Manner of Death: ${mannerOfDeath}`);

                await modInteraction.showModal(buildAutopsyModal());

                const modalSubmit = await modInteraction
                    .awaitModalSubmit({
                        filter: (i) => i.customId === 'autopsy_modal' && i.user.id === userId,
                        time: 300_000,
                    })
                    .catch(() => null);

                if (!modalSubmit) {
                    console.log('[REPORT] ⏰ Modal submission timed out');
                    await submitted.editReply({
                        content: '⏰ Autopsy report timed out. Use `/report` again to start over.',
                        components: [],
                    });
                    return;
                }

                const deathCauses = modalSubmit.fields.getTextInputValue('deathCausesListItems');
                const causeOfDeath = modalSubmit.fields.getTextInputValue('causeOfDeath');
                const synopsis = modalSubmit.fields.getTextInputValue('synopsis');

                console.log('[REPORT] 📝 Modal submitted — generating BBCode...');

                const userInput = {
                    deathCausesListItems: deathCauses,
                    causeOfDeath,
                    deathType: mannerOfDeath,
                    synopsis,
                };

                const bbcode = generateAutopsyBBCode(
                    selectedRecord,
                    userInput,
                    interaction.member?.displayName || interaction.user.username,
                );

                console.log(`[REPORT] ✅ BBCode ready (${bbcode.length} chars)`);

                await modalSubmit.deferReply({ flags: MessageFlags.Ephemeral });
                await modalSubmit.editReply({ content: `📝 **${topicTitle}** — Posting to forum section **#${forumId}**...` });

                // ── Post to forum ──
                const client = getForumClient();
                let topicUrl = null;
                try {
                    const loginResult = await client.login();
                    console.log(`[REPORT] 🔑 Logged in: ${loginResult.method}`);
                    const postResult = await client.postTopic(forumId, topicTitle, bbcode);
                    topicUrl = postResult.ok ? postResult.url : null;
                    console.log(`[REPORT] 📰 Topic posted: ${topicUrl || 'FAILED'}`);
                } catch (postErr) {
                    console.error('[REPORT] ❌ Forum post failed:', postErr.message);
                }

                const shortPreview = bbcode.length > 300
                    ? bbcode.slice(0, 300) + '...'
                    : bbcode;

                const attachment = new AttachmentBuilder(
                    Buffer.from(bbcode, 'utf-8'),
                    { name: `autopsy-${selectedRecord.caseId}.txt` },
                );

                const statusIcon = topicUrl ? '✅' : '⚠️';
                const statusLine = topicUrl
                    ? `📰 [View Topic](${topicUrl})`
                    : '⚠️ BBCode generated but forum posting failed — use the attached file to post manually.';

                await modalSubmit.editReply({
                    content: `${statusIcon} **${topicTitle}** — ${selectedRecord.name} (#${selectedRecord.caseId}) (${mannerOfDeath})\n${statusLine}\n\`\`\`bbcode\n${shortPreview}\n\`\`\``,
                    files: [attachment],
                });

                await submitted.editReply({
                    content: `✅ **${topicTitle}** — ${topicUrl ? 'Posted to forum!' : 'BBCode ready (forum post failed)'}`,
                    components: [],
                });
            });

            modCollector.on('end', async (collected) => {
                if (collected.size === 0) {
                    console.log('[REPORT] ⏰ MoD selection timed out');
                    try {
                        await selectInteraction.editReply({
                            content: '⏰ Manner of Death selection timed out. Use `/report` again.',
                            components: [],
                        });
                    } catch { /* ignore */ }
                }
            });
        });

        recordCollector.on('end', async (collected) => {
            if (collected.size === 0) {
                console.log('[REPORT] ⏰ Record selection timed out');
                try {
                    await submitted.editReply({
                        content: '⏰ Record selection timed out. Use `/report` again.',
                        components: [],
                    });
                } catch { /* ignore */ }
            }
        });

    } catch (error) {
        console.error('[REPORT] ❌ autopsy error:', error);
        await submitted.editReply({
            content: '❌ An unexpected error occurred. Please try again.',
            components: [],
        });
    }
}

// ── Helper: build a coroner step modal ──

const CORONER_STEPS = {
    scene: { customId: 'coroner_scene', title: 'Scene Information' },
    decedent: { customId: 'coroner_decedent', title: 'Decedent Information' },
    docs: { customId: 'coroner_docs', title: 'Documentation' },
};

function buildCoronerModal(step) {
    const cfg = CORONER_STEPS[step];
    const modal = new ModalBuilder()
        .setCustomId(cfg.customId)
        .setTitle(`Coroner Report — ${cfg.title}`);

    const fields = [];
    if (step === 'scene') {
        fields.push(
            { id: 'disp_datetime', label: 'Dispatched to scene', placeholder: 'e.g. 2026-06-25 14:30', style: TextInputStyle.Short, required: true },
            { id: 'tod', label: 'Time of Death', placeholder: 'e.g. 14:45', style: TextInputStyle.Short, required: true },
            { id: 'dept', label: 'Department (requesting)', placeholder: 'e.g. LSPD', style: TextInputStyle.Short, required: true },
            { id: 'coroner_emp', label: 'Coroner Name', placeholder: 'Your character name', style: TextInputStyle.Short, required: true },
            { id: 'coroner_rank', label: 'Coroner Rank', placeholder: 'e.g. Chief Coroner, Deputy', style: TextInputStyle.Short, required: true },
        );
    } else if (step === 'decedent') {
        fields.push(
            { id: 'dec_name', label: 'Decedent Name', placeholder: 'Full name', style: TextInputStyle.Short, required: true },
            { id: 'dec_ooc', label: 'OOC Decedent Name', placeholder: 'OOC name', style: TextInputStyle.Short, required: true },
            { id: 'death_type', label: 'Type of Death', placeholder: 'PK / CK / Natural / etc.', style: TextInputStyle.Short, required: true },
            { id: 'manner', label: 'Manner of Death', placeholder: 'Homicide / Accident / etc.', style: TextInputStyle.Short, required: true },
            { id: 'place', label: 'Place of Death', placeholder: 'Street / area name', style: TextInputStyle.Short, required: true },
        );
    } else if (step === 'docs') {
        fields.push(
            { id: 'prob_cause', label: 'Probable Cause', placeholder: 'Cause of death', style: TextInputStyle.Short, required: true },
            { id: 'synopsis', label: 'Case Synopsis', placeholder: 'What did you find on scene?', style: TextInputStyle.Paragraph, required: true },
            { id: 'req_officer', label: 'Requesting Officer (if any)', placeholder: 'Officer name or leave blank', style: TextInputStyle.Short, required: false },
            { id: 'assist_staff', label: 'Assisting Staff', placeholder: 'Name(s) or leave blank', style: TextInputStyle.Short, required: false },
            { id: 'evid_items', label: 'Evidence Locker Items', placeholder: 'EL#REF-CODE or leave blank', style: TextInputStyle.Short, required: false },
        );
    }

    fields.forEach(f => {
        const input = new TextInputBuilder()
            .setCustomId(f.id)
            .setLabel(f.label)
            .setPlaceholder(f.placeholder)
            .setStyle(f.style)
            .setRequired(f.required)
            .setMaxLength(f.style === TextInputStyle.Paragraph ? 2000 : 200);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
    });

    return modal;
}

// ── Sub: coroner ──

async function handleCoroner({ interaction, submitted, topicTitle, forumId }) {
    const userId = interaction.user.id;
    const username = interaction.user.tag;

    console.log(`[REPORT] 🔍 /report form:coroner invoked by ${username} (${userId}) | title="${topicTitle}" forum=${forumId}`);

    try {
        // Helper: send a message with a "Continue" button, then on click show the next modal
        const promptStep = async (prevInteraction, stepKey, buttonLabel) => {
            const btn = new ButtonBuilder()
                .setCustomId(`coroner_${stepKey}`)
                .setLabel(buttonLabel)
                .setStyle(ButtonStyle.Primary);
            const row = new ActionRowBuilder().addComponents(btn);

            // Acknowledge the previous interaction by replying (first call) or updating
            if (prevInteraction.replied || prevInteraction.deferred) {
                await prevInteraction.editReply({ content: `📋 **${topicTitle}** — ${buttonLabel}`, components: [row] });
            } else {
                await prevInteraction.reply({ content: `📋 **${topicTitle}** — ${buttonLabel}`, components: [row], flags: MessageFlags.Ephemeral });
            }

            const click = await prevInteraction.channel?.awaitMessageComponent({
                filter: i => i.customId === `coroner_${stepKey}` && i.user.id === userId,
                time: 300_000,
            }).catch(() => null);
            return click; // ButtonInteraction — can showModal
        };

        // ── Step 1: Scene Info ──
        const btn1 = await promptStep(submitted, 'scene', 'Step 1: Scene Information');
        if (!btn1) return;
        await btn1.showModal(buildCoronerModal('scene'));

        const s1 = await btn1.awaitModalSubmit({
            filter: i => i.customId === 'coroner_scene' && i.user.id === userId,
            time: 300_000,
        }).catch(() => null);
        if (!s1) return;

        const sceneData = {};
        s1.fields.fields.forEach(f => { sceneData[f.customId] = f.value; });
        console.log('[REPORT] 📥 Step 1/3 — Scene inputs:', JSON.stringify(sceneData, null, 2));

        // ── Step 2: Decedent Info ──
        const btn2 = await promptStep(s1, 'decedent', 'Step 2: Decedent Information');
        if (!btn2) return;
        await btn2.showModal(buildCoronerModal('decedent'));

        const s2 = await btn2.awaitModalSubmit({
            filter: i => i.customId === 'coroner_decedent' && i.user.id === userId,
            time: 300_000,
        }).catch(() => null);
        if (!s2) return;

        const decData = {};
        s2.fields.fields.forEach(f => { decData[f.customId] = f.value; });
        console.log('[REPORT] 📥 Step 2/3 — Decedent inputs:', JSON.stringify(decData, null, 2));

        // ── Step 3: Documentation ──
        const btn3 = await promptStep(s2, 'docs', 'Step 3: Documentation');
        if (!btn3) return;
        await btn3.showModal(buildCoronerModal('docs'));

        const s3 = await btn3.awaitModalSubmit({
            filter: i => i.customId === 'coroner_docs' && i.user.id === userId,
            time: 300_000,
        }).catch(() => null);
        if (!s3) return;

        const docsData = {};
        s3.fields.fields.forEach(f => { docsData[f.customId] = f.value; });
        console.log('[REPORT] 📥 Step 3/3 — Documentation inputs:', JSON.stringify(docsData, null, 2));

        // ── All data collected — now defer and process ──
        await s3.deferReply({ flags: MessageFlags.Ephemeral });

        // ── Generate BBCode ──
        // Load the template from coroner-report.json
        const schemaPath = resolve(__dirname, '..', '..', 'src', 'formSchemas', 'coroner-report.json');
        const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
        const template = schema.bbcodeTemplate;

        const bbcode = generateCoronerBBCode(template, sceneData, decData, docsData);
        console.log(`[REPORT] ✅ BBCode ready (${bbcode.length} chars) — preview: ${bbcode.slice(0, 200).replace(/\n/g, '\\n')}...`);
        console.log('[REPORT] 📋 Mapped template data:', JSON.stringify(mapCoronerData(sceneData, decData, docsData), null, 2));

        // ── Build preview pages ──
        const previewPages = [
            {
                label: 'Scene Info',
                embed: new EmbedBuilder()
                    .setColor(0x3498db)
                    .setTitle(`📋 Scene Information`)
                    .addFields(
                        { name: '🕐 Dispatched', value: sceneData.disp_datetime || 'N/A', inline: true },
                        { name: '💀 Time of Death', value: sceneData.tod || 'N/A', inline: true },
                        { name: '🏛️ Department', value: sceneData.dept || 'N/A', inline: true },
                        { name: '👤 Coroner', value: sceneData.coroner_emp || 'N/A', inline: true },
                        { name: '🎖️ Rank', value: sceneData.coroner_rank || 'N/A', inline: true },
                    ),
            },
            {
                label: 'Decedent Info',
                embed: new EmbedBuilder()
                    .setColor(0xe67e22)
                    .setTitle(`👤 Decedent Information`)
                    .addFields(
                        { name: '📛 Name', value: decData.dec_name || 'N/A', inline: true },
                        { name: '🎭 OOC', value: decData.dec_ooc || 'N/A', inline: true },
                        { name: '⚔️ Type', value: decData.death_type || 'N/A', inline: true },
                        { name: '📊 Manner', value: decData.manner || 'N/A', inline: true },
                        { name: '📍 Place', value: decData.place || 'N/A', inline: true },
                    ),
            },
            {
                label: 'Documentation',
                embed: new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle(`📄 Documentation`)
                    .addFields(
                        { name: '🔬 Probable Cause', value: docsData.prob_cause || 'N/A', inline: false },
                        { name: '📝 Synopsis', value: (docsData.synopsis || 'N/A').slice(0, 300), inline: false },
                        { name: '👮 Requesting Officer', value: docsData.req_officer || 'N/A', inline: true },
                        { name: '🤝 Assisting Staff', value: docsData.assist_staff || 'None', inline: true },
                        { name: '🔐 Evidence Locker', value: docsData.evid_items || 'None', inline: true },
                    ),
            },
            {
                label: 'BBCode',
                embed: new EmbedBuilder()
                    .setColor(0x9b59b6)
                    .setTitle(`📰 BBCode Preview`)
                    .setDescription(`\`\`\`bbcode\n${(bbcode.length > 500 ? bbcode.slice(0, 500) + '\n...' : bbcode)}\n\`\`\``)
                    .addFields(
                        { name: '📏 Length', value: `${bbcode.length} chars`, inline: true },
                        { name: '📍 Forum', value: `#${forumId}`, inline: true },
                        { name: '📄 File', value: `\`coroner-report.txt\``, inline: true },
                    ),
            },
        ];

        const totalPages = previewPages.length;
        let currentPage = 0;

        const prevBtn = new ButtonBuilder()
            .setCustomId('preview_prev')
            .setLabel('◀ Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true); // disabled on first page

        const nextBtn = new ButtonBuilder()
            .setCustomId('preview_next')
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Secondary);

        const postBtn = new ButtonBuilder()
            .setCustomId('preview_post')
            .setLabel('📝 Post to Forum')
            .setStyle(ButtonStyle.Success);

        const cancelBtn = new ButtonBuilder()
            .setCustomId('preview_cancel')
            .setLabel('✕ Cancel')
            .setStyle(ButtonStyle.Danger);

        const buildRow = (pageIdx) => {
            const row = new ActionRowBuilder().addComponents(
                prevBtn.setDisabled(pageIdx === 0),
                nextBtn.setDisabled(pageIdx === totalPages - 1),
                postBtn,
                cancelBtn,
            );
            return row;
        };

        const attachment = new AttachmentBuilder(
            Buffer.from(bbcode, 'utf-8'),
            { name: `coroner-report-${Date.now()}.txt` },
        );

        const previewMsg = await s3.editReply({
            content: `**${topicTitle}** — Review your report:`,
            embeds: [previewPages[0].embed],
            components: [buildRow(0)],
            files: [attachment],
        });

        // ── Collector for preview navigation ──
        const collector = previewMsg.createMessageComponentCollector({
            time: 300_000, // 5 min
        });

        collector.on('collect', async (btnInt) => {
            if (btnInt.user.id !== userId) {
                await btnInt.reply({ content: '❌ Not your interaction.', flags: MessageFlags.Ephemeral });
                return;
            }

            if (btnInt.customId === 'preview_prev' && currentPage > 0) {
                currentPage--;
            } else if (btnInt.customId === 'preview_next' && currentPage < totalPages - 1) {
                currentPage++;
            } else if (btnInt.customId === 'preview_cancel') {
                collector.stop('cancelled');
                await btnInt.update({ content: '❌ Cancelled.', embeds: [], components: [], files: [] });
                await submitted.editReply({ content: `❌ **${topicTitle}** — Cancelled.`, components: [] });
                return;
            } else if (btnInt.customId === 'preview_post') {
                await btnInt.update({ content: `📝 **${topicTitle}** — Posting to forum...`, embeds: [], components: [] });
                collector.stop('posting');

                // ── Post to forum ──
                const client = getForumClient();
                let topicUrl = null;
                try {
                    const forumUrlOverride = FORUM_URL_OVERRIDES.coroner;
                    const overrideBase = forumUrlOverride ? new URL(forumUrlOverride).origin : null;
                    const loginResult = await client.login(null, null, {
                        force: !!forumUrlOverride,
                        baseUrl: overrideBase || undefined,
                    });
                    console.log(`[REPORT] 🔑 Logged in: ${loginResult.method}`);
                    const postResult = await client.postTopic(forumId, topicTitle, bbcode, forumUrlOverride);
                    topicUrl = postResult.ok ? postResult.url : null;
                    console.log(`[REPORT] 📰 Topic posted: ${topicUrl || 'FAILED'}`);
                } catch (postErr) {
                    console.error('[REPORT] ❌ Forum post failed:', postErr.message);
                }

                const statusIcon = topicUrl ? '✅' : '⚠️';
                const statusLine = topicUrl
                    ? `📰 [View Topic](${topicUrl})`
                    : '⚠️ BBCode generated but posting failed — use the attached file.';

                const shortPreview = bbcode.length > 300
                    ? bbcode.slice(0, 300) + '...'
                    : bbcode;

                await s3.editReply({
                    content: `${statusIcon} **${topicTitle}**\n${statusLine}\n\`\`\`bbcode\n${shortPreview}\n\`\`\``,
                    embeds: [],
                    components: [],
                    files: [attachment],
                });

                await submitted.editReply({
                    content: `✅ **${topicTitle}** — ${topicUrl ? 'Posted to forum!' : 'BBCode ready'}`,
                    components: [],
                });

                console.log(`[REPORT] ✅ Coroner report done for ${username} (${bbcode.length} chars)`);
                return;
            }

            // Update to current page
            await btnInt.update({
                embeds: [previewPages[currentPage].embed],
                components: [buildRow(currentPage)],
            });
        });

        collector.on('end', async (_, reason) => {
            if (reason === 'time') {
                await s3.editReply({ components: [] }).catch(() => {});
                await submitted.editReply({ content: `✅ **${topicTitle}** — Preview expired.`, components: [] }).catch(() => {});
            }
        });

        console.log(`[REPORT] ✅ Coroner report preview shown for ${username} (${bbcode.length} chars) — awaiting action`);

    } catch (error) {
        console.error('[REPORT] ❌ coroner error:', error);
        await submitted.editReply({
            content: '❌ An unexpected error occurred. Please try again.',
            components: [],
        });
    }
}
