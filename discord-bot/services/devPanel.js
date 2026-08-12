/**
 * devPanel.js — Button/modal handlers for the /dev developer tools panel,
 * including the "Autopsy & Death Records" sub-panel.
 */
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { exec } from 'child_process';
import { loadAgencyCredentials, setAgencyCredential, removeAgencyCredential } from './agencyCredentials.js';

// ── Panel definitions ──

const MAIN_ACTIONS = [
    { id: 'dev_restart', label: 'Restart Bot', style: 'danger' },
    { id: 'dev_creds', label: 'Agency Credentials', style: 'primary' },
    { id: 'dev_creds_list', label: 'List Credentials', style: 'secondary' },
    { id: 'dev_autopsy', label: 'Autopsy & Death Records', style: 'primary' },
];

// No-arg commands — run their execute() directly.
const DIRECT_ACTIONS = [
    { id: 'dev_autopsy_rotation',   label: 'Rotation List',          file: 'rotation-list.js' },
    { id: 'dev_autopsy_check',      label: 'Force Autopsy Check',    file: 'force-autopsy-check.js' },
    { id: 'dev_autopsy_syncreq',    label: 'Sync Autopsy Requests',  file: 'sync-autopsy-requests.js' },
    { id: 'dev_autopsy_syncposter', label: 'Sync Autopsy Poster',    file: 'sync-autopsy-poster.js' },
    { id: 'dev_dr_pending',         label: 'Death Records Pending',  file: 'death-record-pending.js' },
];

// Arg commands — opened via a modal, then executed with a patched options resolver.
const MODAL_ACTIONS = [
    { id: 'dev_autopsy_send', label: 'Force Autopsy Send', file: 'force-autopsy-send.js', args: [
        { key: 'ooc', label: 'OOC name to search', required: true },
        { key: 'bbc', label: 'BBCode (optional)', required: false },
    ]},
    { id: 'dev_dr_face', label: 'Face Redraft', file: 'face-redraft.js', args: [
        { key: 'reportkey', label: 'Death record key', required: true },
    ]},
    { id: 'dev_dr_check', label: 'Death Record Check', file: 'death-record-check.js', args: [
        { key: 'date', label: 'Date (DD/MMM/YYYY)', required: false },
        { key: 'from', label: 'Scan from date', required: false },
    ]},
];

function isOwner(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    return !!ownerId && interaction.user.id === ownerId;
}

function btnStyle(s) {
    return s === 'danger' ? ButtonStyle.Danger : s === 'secondary' ? ButtonStyle.Secondary : ButtonStyle.Primary;
}

function panelEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(title)
        .setColor(0x5865f2)
        .setDescription(description)
        .setFooter({ text: 'PHMC Bot - Developer Panel' })
        .setTimestamp();
}

/** Post the main developer panel (used by /dev). */
export async function showDevPanel(interaction) {
    if (!isOwner(interaction)) {
        await interaction.reply({ content: 'Only the bot owner can use the dev panel.', flags: MessageFlags.Ephemeral });
        return;
    }
    const row = new ActionRowBuilder().addComponents(
        MAIN_ACTIONS.map(a => new ButtonBuilder().setCustomId(a.id).setLabel(a.label).setStyle(btnStyle(a.style)))
    );
    await interaction.reply({ embeds: [panelEmbed('Developer Tools', 'Pick an action below:')], components: [row], flags: MessageFlags.Ephemeral });
}

async function showAutopsyPanel(interaction, isUpdate) {
    const directRow = new ActionRowBuilder().addComponents(
        DIRECT_ACTIONS.map(a => new ButtonBuilder().setCustomId(a.id).setLabel(a.label).setStyle(ButtonStyle.Secondary))
    );
    const modalRow = new ActionRowBuilder().addComponents(
        MODAL_ACTIONS.map(a => new ButtonBuilder().setCustomId(a.id).setLabel(a.label).setStyle(ButtonStyle.Primary))
    );
    modalRow.addComponents(new ButtonBuilder().setCustomId('dev_back').setLabel('Back').setStyle(ButtonStyle.Danger));

    const embed = panelEmbed('Autopsy & Death Records', 'Pick an action. Buttons run immediately; Primary buttons open a prompt for arguments.');
    if (isUpdate) {
        await interaction.update({ embeds: [embed], components: [directRow, modalRow] });
    } else {
        await interaction.reply({ embeds: [embed], components: [directRow, modalRow], flags: MessageFlags.Ephemeral });
    }
}

async function runDirectAction(interaction, action) {
    try {
        const { execute } = await import('../commands/' + action.file);
        await execute(interaction);
    } catch (e) {
        console.error(`[DEV] ${action.id} error:`, e.message);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            }
            await interaction.editReply({ content: `Error running ${action.label}: ${e.message}` });
        } catch (e2) { /* interaction already resolved */ }
    }
}

function buildActionModal(action) {
    const modal = new ModalBuilder().setCustomId('dev_modal_' + action.id).setTitle(action.label);
    for (const a of action.args) {
        const input = new TextInputBuilder()
            .setCustomId('dev_arg_' + a.key)
            .setLabel(a.label)
            .setStyle(TextInputStyle.Short)
            .setRequired(!!a.required);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
    }
    return modal;
}

export async function handleDevButton(interaction) {
    if (!isOwner(interaction)) {
        await interaction.reply({ content: 'Only the bot owner can use the dev panel.', flags: MessageFlags.Ephemeral });
        return;
    }

    const id = interaction.customId;

    if (id === 'dev_restart') {
        await interaction.deferUpdate();
        await interaction.followUp({ content: 'Restarting the bot...', flags: MessageFlags.Ephemeral });
        exec('pm2 restart phmc-bot', (err) => {
            if (err) console.error('[DEV] restart error:', err.message);
        });
        return;
    }

    if (id === 'dev_creds') {
        const modal = new ModalBuilder()
            .setCustomId('dev_creds_modal')
            .setTitle('Agency Credentials');

        const action = new TextInputBuilder()
            .setCustomId('dev_creds_action')
            .setLabel('Action (set or remove)')
            .setStyle(TextInputStyle.Short)
            .setValue('set')
            .setRequired(true);
        const domain = new TextInputBuilder()
            .setCustomId('dev_creds_domain')
            .setLabel('Domain (e.g. lspd.gta.world)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        const username = new TextInputBuilder()
            .setCustomId('dev_creds_user')
            .setLabel('Username')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);
        const password = new TextInputBuilder()
            .setCustomId('dev_creds_pass')
            .setLabel('Password')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(action),
            new ActionRowBuilder().addComponents(domain),
            new ActionRowBuilder().addComponents(username),
            new ActionRowBuilder().addComponents(password),
        );
        await interaction.showModal(modal);
        return;
    }

    if (id === 'dev_creds_list') {
        await interaction.deferUpdate();
        const creds = loadAgencyCredentials();
        const keys = Object.keys(creds);
        await interaction.followUp({
            embeds: [panelEmbed('Agency Credentials', keys.length ? keys.map(k => `- \`${k}\``).join('\n') : 'None configured yet.')],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (id === 'dev_autopsy') {
        await showAutopsyPanel(interaction, true);
        return;
    }

    if (id === 'dev_back') {
        const row = new ActionRowBuilder().addComponents(
            MAIN_ACTIONS.map(a => new ButtonBuilder().setCustomId(a.id).setLabel(a.label).setStyle(btnStyle(a.style)))
        );
        await interaction.update({ embeds: [panelEmbed('Developer Tools', 'Pick an action below:')], components: [row] });
        return;
    }

    const direct = DIRECT_ACTIONS.find(a => a.id === id);
    if (direct) {
        await runDirectAction(interaction, direct);
        return;
    }

    const modalAction = MODAL_ACTIONS.find(a => a.id === id);
    if (modalAction) {
        await interaction.showModal(buildActionModal(modalAction));
        return;
    }
}

/** Handler for the agency-credentials modal. */
export async function handleDevCredsModal(interaction) {
    if (!isOwner(interaction)) {
        await interaction.reply({ content: 'Only the bot owner can do this.', flags: MessageFlags.Ephemeral });
        return;
    }

    const action = interaction.fields.getTextInputValue('dev_creds_action').trim().toLowerCase();
    const domain = interaction.fields.getTextInputValue('dev_creds_domain').trim();
    const username = interaction.fields.getTextInputValue('dev_creds_user');
    const password = interaction.fields.getTextInputValue('dev_creds_pass');

    try {
        if (action === 'remove') {
            removeAgencyCredential(domain);
            await interaction.reply({ content: `[OK] Removed credential for \`${domain}\`.`, flags: MessageFlags.Ephemeral });
        } else {
            setAgencyCredential(domain, username, password);
            await interaction.reply({ content: `[OK] Set credential for \`${domain}\` (morgue-api picks it up immediately).`, flags: MessageFlags.Ephemeral });
        }
    } catch (e) {
        await interaction.reply({ content: `Error: ${e.message}`, flags: MessageFlags.Ephemeral });
    }
}

/** Handler for the autopsy/death-record arg modals (dev_modal_*). */
export async function handleDevActionModal(interaction) {
    if (!isOwner(interaction)) {
        await interaction.reply({ content: 'Only the bot owner can do this.', flags: MessageFlags.Ephemeral });
        return;
    }

    const actionId = interaction.customId.slice('dev_modal_'.length);
    const action = MODAL_ACTIONS.find(a => a.id === actionId);
    if (!action) {
        await interaction.reply({ content: 'Unknown dev action.', flags: MessageFlags.Ephemeral });
        return;
    }

    const values = {};
    for (const a of action.args) {
        values[a.key] = interaction.fields.getTextInputValue('dev_arg_' + a.key);
    }

    // Patch a getString resolver so the existing command's execute() works on a modal submit.
    const patched = Object.assign(interaction, {
        options: {
            getString: (name) => (values[name] !== undefined && values[name] !== '' ? values[name] : null),
        },
    });

    try {
        const { execute } = await import('../commands/' + action.file);
        await execute(patched);
    } catch (e) {
        console.error(`[DEV] ${action.id} error:`, e.message);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            }
            await interaction.editReply({ content: `Error running ${action.label}: ${e.message}` });
        } catch (e2) { /* interaction already resolved */ }
    }
}
