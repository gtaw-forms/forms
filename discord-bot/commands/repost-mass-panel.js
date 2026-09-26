import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { isOwnerOrWhitelisted } from '../services/permissions.js';
import firebase from '../services/firebase.js';
import { repostMassPanel, MASS_PANEL_STAGING_CHANNEL_ID } from '../services/massAssignmentPanel.js';

export const data = new SlashCommandBuilder()
    .setName('repost-mass-panel')
    .setDescription('Re-post a dead mass panel as a fresh message, mentions off (owner only)')
    .addStringOption((opt) =>
        opt.setName('request')
            .setDescription('Request topic id in autopsy-requested (e.g. 10174)')
            .setRequired(true))
    .addStringOption((opt) =>
        opt.setName('channel')
            .setDescription('Where to post: channel mention, ID, or exact name (defaults to staging)')
            .setRequired(false))
    .addBooleanOption((opt) =>
        opt.setName('ping')
            .setDescription('Tag the MEs (default OFF — reposts never ping unless asked)')
            .setRequired(false));

/**
 * Resolve the destination: mention (<#id>), raw id, or channel name in this
 * guild. Falls back to the staging channel. Returns { id, how }.
 */
function resolveChannelId(interaction, input) {
    const raw = String(input || '').trim();
    if (!raw) return { id: MASS_PANEL_STAGING_CHANNEL_ID, how: 'staging default' };
    const mention = raw.match(/^<#(\d+)>$/);
    if (mention) return { id: mention[1], how: 'mention' };
    if (/^\d+$/.test(raw)) return { id: raw, how: 'id' };
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
    const want = norm(raw);
    const channels = interaction.guild?.channels?.cache;
    if (channels && want) {
        for (const [, ch] of channels) {
            if (typeof ch?.messages?.fetch !== 'function') continue;
            if (norm(ch.name) === want || norm(ch.name).includes(want)) {
                return { id: ch.id, how: `name #${ch.name}` };
            }
        }
    }
    return { id: null, how: null };
}

export async function execute(interaction) {
    if (!isOwnerOrWhitelisted(interaction)) {
        await interaction.reply({ content: 'Only the bot owner can run this.', flags: MessageFlags.Ephemeral });
        return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    firebase.init();
    const db = firebase.db;
    const requestId = interaction.options.getString('request').trim();
    const channelInput = interaction.options.getString('channel') || '';
    const ping = interaction.options.getBoolean('ping') === true;

    const resolved = resolveChannelId(interaction, channelInput);
    if (!resolved.id) {
        await interaction.editReply({
            content: `Couldn't resolve channel "${channelInput}" — mention it (#name), paste its ID, or leave blank for staging.`,
        });
        return;
    }

    try {
        const res = await repostMassPanel(db, interaction.client, requestId, {
            channelId: resolved.id,
            noPing: !ping,
        });
        const embed = new EmbedBuilder()
            .setColor(res.posted ? 0x00bcd4 : 0xe74c3c)
            .setTitle('Repost Mass Panel')
            .setDescription([
                `**Posted:** ${res.posted ? 'yes' : 'no'}${res.reason ? ` (\`${res.reason}\`)` : ''}`,
                `**Panel:** \`${res.panelId || 'n/a'}\``,
                `**Channel:** \`${res.channelId || 'n/a'}\``,
                `**Message:** \`${res.messageId || 'n/a'}\``,
                `**Bodies/MEs:** ${res.bodyCount ?? '?'} / ${res.meCount ?? '?'}`,
                `**Mentions:** ${ping ? 'ON (tagged)' : 'OFF (nobody pinged)'}`,
            ].join('\n'))
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[CMD] repost-mass-panel error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}
