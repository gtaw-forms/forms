import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { isOwnerOrWhitelisted } from '../services/permissions.js';
import { getChannelId, channelSendEnabled } from '../services/phmcChannels.js';
import { checkPhmcMapping, postPhmcDashboard } from '../services/phmcDashboard.js';

export const data = new SlashCommandBuilder()
    .setName('phmc-dashboard')
    .setDescription('(Owner) Dedicated PHMC Discord status dashboard')
    .addSubcommand(sub => sub
        .setName('status')
        .setDescription('Check the channel mapping + send gate (fetch only, never posts)'))
    .addSubcommand(sub => sub
        .setName('post')
        .setDescription('Gather live data and post/update the PHMC dashboard now'));

export async function execute(interaction) {
    if (!isOwnerOrWhitelisted(interaction)) {
        await interaction.reply({
            content: '❌ Only the bot owner can use this command.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const gate = channelSendEnabled() ? 'OPEN (posts allowed)' : 'READ-ONLY (suppressed)';
    const mapped = getChannelId('dashboard');

    if (sub === 'status') {
        const check = await checkPhmcMapping(interaction.client);
        await interaction.editReply({
            content: [
                `**PHMC dashboard** — gate: **${gate}**`,
                `Mapped channel: \`${mapped || '(none)'}\``,
                check.ok
                    ? `✅ Mapping resolves: #${check.name} (sendable: ${check.sendable ? 'yes' : 'no'})`
                    : `❌ ${check.reason}`,
                channelSendEnabled()
                    ? 'Next 10-min cycle will post/update automatically.'
                    : 'Set `PHMC_CHANNEL_SEND_ENABLED=true` in the VPS .env + restart to authorize posting.',
            ].join('\n'),
        });
        return;
    }

    // post — live gather + gated post
    if (!channelSendEnabled()) {
        await interaction.editReply({
            content: `❌ Gate is READ-ONLY — nothing was posted (mapped: \`${mapped || '(none)'}\`). Set \`PHMC_CHANNEL_SEND_ENABLED=true\` + restart to authorize.`,
        });
        return;
    }
    try {
        const { default: firebase } = await import('../services/firebase.js');
        firebase.init();
        const db = firebase.db;
        if (!db) {
            await interaction.editReply({ content: '⏳ Firebase not ready yet, try again in a moment.' });
            return;
        }
        const { gatherDashboardData } = await import('../services/dashboardManager.js');
        const gathered = await gatherDashboardData(db, true);
        gathered.lastCheckTime = Date.now();
        const ok = await postPhmcDashboard(interaction.client, db, gathered);
        await interaction.editReply({ content: ok ? '✅ PHMC dashboard posted/updated.' : '❌ Post failed — check the bot logs.' });
    } catch (err) {
        await interaction.editReply({ content: `❌ Post failed: ${err.message}` });
    }
}
