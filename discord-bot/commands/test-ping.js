/**
 * test-ping.js — Send a test notification that @mentions the owner in the log
 * channel, to validate that Discord user pings work end-to-end.
 */
import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { sendWebhook } from '../services/deployLogger.js';

export const data = new SlashCommandBuilder()
    .setName('test-ping')
    .setDescription('(Owner) Send a test notification that pings the owner');

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can run this.', flags: MessageFlags.Ephemeral });
        return;
    }

    const embed = new EmbedBuilder()
        .setColor(0x00bcd4)
        .setTitle('🔔 Test Ping')
        .setDescription([
            'This is a test of the bot\'s @mention notification.',
            'If you received a ping, Discord user mentions work correctly.',
        ].join('\n'))
        .setFooter({ text: 'PHMC Bot — ping test' })
        .setTimestamp();

    await sendWebhook(`<@${ownerId}>`, embed);
    await interaction.reply({ content: `Test ping sent to <@${ownerId}> in the log channel.`, flags: MessageFlags.Ephemeral });
}
