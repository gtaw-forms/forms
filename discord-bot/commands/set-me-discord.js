import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import firebase from '../services/firebase.js';
import { setDiscordMapping } from '../services/meDiscordNotify.js';

export const data = new SlashCommandBuilder()
    .setName('me-discord')
    .setDescription('Link an ME forum name to a Discord user for assignment pings (owner only)')
    .addStringOption(opt =>
        opt.setName('name')
            .setDescription('Forum username (e.g. Arthur Blackwood)')
            .setRequired(true))
    .addUserOption(opt =>
        opt.setName('user')
            .setDescription('Discord user to ping — omit to remove mapping')
            .setRequired(false));

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can manage Discord mappings.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const forumName = interaction.options.getString('name').trim();
    const discordUser = interaction.options.getUser('user');

    firebase.init();
    const db = firebase.db;

    try {
        if (discordUser) {
            await setDiscordMapping(db, forumName, discordUser.id);
            const embed = new EmbedBuilder()
                .setColor(0x28a745)
                .setTitle('ME Discord Mapping Set')
                .setDescription(`**${forumName}** → ${discordUser} (\`${discordUser.id}\`)`)
                .setFooter({ text: 'They will be pinged on future autopsy assignments.' })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        } else {
            await setDiscordMapping(db, forumName, null);
            const embed = new EmbedBuilder()
                .setColor(0xffc107)
                .setTitle('ME Discord Mapping Removed')
                .setDescription(`**${forumName}** → (no Discord user)`)
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
    } catch (err) {
        console.error('[CMD] me-discord error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}
