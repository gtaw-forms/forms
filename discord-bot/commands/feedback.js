// /feedback — owner-only. Opens a DM; that DM is one OpenCode session.
// ONE active session at a time: if one exists, this offers resume/complete.
import { SlashCommandBuilder, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('feedback')
  .setDescription('Open a feedback inbox with the bot (owner only — bug reports and feature requests)');

export async function execute(interaction) {
  const { startFeedback } = await import('../services/feedback/controller.js');
  await startFeedback(interaction);
}
