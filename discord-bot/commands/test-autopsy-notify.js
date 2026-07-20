import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import firebase from '../services/firebase.js';
import { notifyAssignment, getDiscordId } from '../services/meDiscordNotify.js';

export const data = new SlashCommandBuilder()
    .setName('test-autopsy-notify')
    .setDescription('Test the ME Discord assignment ping (owner only)')
    .addStringOption(opt =>
        opt.setName('name')
            .setDescription('Forum username of the ME (e.g. Arthur Blackwood)')
            .setRequired(true))
    .addStringOption(opt =>
        opt.setName('case')
            .setDescription('Case number or title (e.g. 43 or "Case 43 - John Doe")')
            .setRequired(true))
    .addBooleanOption(opt =>
        opt.setName('mass')
            .setDescription('Simulate as mass autopsy (default: false)')
            .setRequired(false));

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can run this.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const name = interaction.options.getString('name').trim();
    const caseStr = interaction.options.getString('case').trim();
    const isMass = interaction.options.getBoolean('mass') ?? false;

    firebase.init();
    const db = firebase.db;

    try {
        // Show current mapping status
        const discordId = await getDiscordId(db, name);
        const mappingStatus = discordId
            ? `<@${discordId}> (\`${discordId}\`)`
            : '**No Discord mapping** — will use plain name fallback';

        // Send test notification
        const caseTitle = caseStr.startsWith('Case') ? caseStr : `Case ${caseStr}`;
        await notifyAssignment(db, name, caseTitle, null, { isMassAutopsy: isMass });

        const embed = new EmbedBuilder()
            .setColor(0x00bcd4)
            .setTitle('Test Autopsy Notification')
            .setDescription([
                `**ME:** ${name}`,
                `**Case:** ${caseTitle}`,
                `**Type:** ${isMass ? 'Mass Autopsy' : 'Standard Assignment'}`,
                '',
                `**Discord Mapping:** ${mappingStatus}`,
                '',
                '_A notification has been sent to the bot-spam channel above._',
            ].join('\n'))
            .setFooter({ text: 'If the ping looks wrong, use /me-discord to fix the mapping.' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[CMD] test-autopsy-notify error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}
