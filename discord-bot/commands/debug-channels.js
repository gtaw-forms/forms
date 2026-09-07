import { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChannelType } from 'discord.js';
import { isOwnerOrWhitelisted } from '../services/permissions.js';

const TYPE_LABELS = {
    [ChannelType.GuildText]: 'Text',
    [ChannelType.GuildVoice]: 'Voice',
    [ChannelType.GuildCategory]: 'Category',
    [ChannelType.GuildAnnouncement]: 'Announcement',
    [ChannelType.GuildForum]: 'Forum',
    [ChannelType.GuildStageVoice]: 'Stage',
    [ChannelType.GuildMedia]: 'Media',
    [ChannelType.PublicThread]: 'Public Thread',
    [ChannelType.PrivateThread]: 'Private Thread',
    [ChannelType.AnnouncementThread]: 'Announcement Thread',
};

export const data = new SlashCommandBuilder()
    .setName('debug-channels')
    .setDescription('List every channel ID in this server (owner only)');

export async function execute(interaction) {
    if (!isOwnerOrWhitelisted(interaction)) {
        await interaction.reply({ content: 'Only the bot owner can run this.', flags: MessageFlags.Ephemeral });
        return;
    }

    const guild = interaction.guild;

    try {
        await guild.channels.fetch();
    } catch (err) {
        console.warn(`[DEBUG-CHANNELS] Channel fetch failed: ${err.message}`);
    }

    const channels = [...guild.channels.cache.values()];

    const groups = {};
    for (const channel of channels) {
        const label = TYPE_LABELS[channel.type] || `Type ${channel.type}`;
        if (!groups[label]) groups[label] = [];
        const parentName = channel.parent ? channel.parent.name : null;
        groups[label].push(`${parentName ? `**[${parentName}]** ` : ''}#${channel.name} — \`${channel.id}\``);
    }

    const lines = [];
    for (const [label, items] of Object.entries(groups)) {
        lines.push(`**${label} (${items.length})**`);
        lines.push(...items);
    }

    let text = lines.join('\n');
    if (text.length > 3800) {
        text = text.substring(0, 3800) + '\n… (truncated)';
    }

    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`${guild.name} — Channels (${channels.length})`)
        .setDescription(text || 'No channels found.')
        .setFooter({ text: `Requested by ${interaction.user.tag}` })
        .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}