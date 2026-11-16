// /feedback-list — owner-only. Shows the live session (with stage/step
// detail) plus terminal history: deployed / closed / failed / superseded.
import { SlashCommandBuilder, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('feedback-list')
  .setDescription('List feedback sessions and their stages (owner only)');

export async function execute(interaction) {
  const { isOwner } = await import('../services/feedback/controller.js');
  if (!isOwner(interaction.user.id)) {
    await interaction.reply({ content: 'Only the bot owner can use this.', flags: MessageFlags.Ephemeral });
    return;
  }
  const { getActiveSession, getHistory } = await import('../services/feedback/store.js');
  const { buildFeedbackHistoryView, toDiscordMessage } = await import('../services/feedback/render.js');
  const view = buildFeedbackHistoryView(getActiveSession(), getHistory());
  const msg = await toDiscordMessage(view);
  await interaction.reply({ embeds: msg.embeds, flags: MessageFlags.Ephemeral });
}
