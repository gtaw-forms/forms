/**
 * autopsy-dev-testing.js — Owner-only "Autopsy Dev Testing" mode: simulate the
 * autopsy pipeline end to end without touching the outside world.
 *
 *   enable  — intake + completion run as simulations (no forum posts/replies,
 *             no ME Discord DMs, no crossposts/PMs, assignments computed but
 *             never written). Discord gets "would do" summaries instead.
 *   disable — back to live behavior.
 *   status  — runtime + on-disk values, effective dry-run, simulated-entry count.
 *   purge   — delete simulated (dry_run) autopsy-requested entries.
 *
 * Scope: f=265 intake (singular, legacy-multi, mass) + completion replies.
 * Private intake keeps its own PRIVATE_WEB_MODE; already-posted completions
 * and failed-step retries are never simulated.
 *
 * Persistence: writes AUTOPSY_DEV_TESTING into the bot's .env (same file
 * index.js loads at boot) so the mode survives restarts; process.env updates
 * immediately, so no restart is needed either way.
 */
import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { isOwnerOrWhitelisted } from '../services/permissions.js';
import { isAutopsyDevTesting, effectiveAutopsyDryRun } from '../services/autopsyDevTesting.js';
import { readEnvValue, upsertEnvValues, ENV_PATH } from '../services/envFile.js';
import firebase from '../services/firebase.js';

export const data = new SlashCommandBuilder()
    .setName('autopsy-dev-testing')
    .setDescription('(Owner) Simulate the autopsy pipeline: no forum posts, DMs or crossposts')
    .addStringOption(opt =>
        opt.setName('action')
            .setDescription('What to do')
            .setRequired(true)
            .addChoices(
                { name: 'Enable — simulate intake + completion', value: 'enable' },
                { name: 'Disable — back to live', value: 'disable' },
                { name: 'Status', value: 'status' },
                { name: 'Purge — delete simulated entries', value: 'purge' },
            ));

async function countSimulated() {
    try {
        firebase.init();
        const snap = await firebase.db.ref('autopsy-requested').once('value');
        const all = snap.val() || {};
        let n = 0;
        for (const v of Object.values(all)) {
            if (v && (v.caseState === 'dry_run' || v.dryRun === true)) n += 1;
        }
        return n;
    } catch { return '?'; }
}

export async function execute(interaction) {
    if (!isOwnerOrWhitelisted(interaction)) {
        await interaction.reply({ content: 'Only the bot owner can run this.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const action = interaction.options.getString('action');

    try {
        if (action === 'status') {
            const simCount = await countSimulated();
            const embed = new EmbedBuilder()
                .setColor(isAutopsyDevTesting() ? 0xff9800 : 0x28a745)
                .setTitle(`Autopsy Dev Testing — ${isAutopsyDevTesting() ? 'SIMULATING' : 'LIVE'}`)
                .setDescription([
                    `**Runtime:** \`AUTOPSY_DEV_TESTING=${isAutopsyDevTesting() ? 'true' : 'false'}\``,
                    `**On disk (\`.env\`):** \`AUTOPSY_DEV_TESTING=${readEnvValue('AUTOPSY_DEV_TESTING') ?? '(unset)'}\``,
                    `**Effective dry-run:** ${effectiveAutopsyDryRun() ? 'yes' : 'no'} (legacy \`AUTOPSY_DRY_RUN=${readEnvValue('AUTOPSY_DRY_RUN') ?? '(unset)'}\`)`,
                    `**Simulated entries:** ${simCount}`,
                    '',
                    isAutopsyDevTesting()
                        ? 'Intake parses + validates, computes the ME pick WITHOUT writing it, and posts "would do" summaries. No forum posts/replies, no ME DMs, no crossposts/PMs. Completions take the dry-run path (no reply, no completion marking).'
                        : 'Live behavior. Intake creates cases + assigns MEs; completions post replies and crosspost.',
                ].join('\n'))
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (action === 'purge') {
            firebase.init();
            const snap = await firebase.db.ref('autopsy-requested').once('value');
            const all = snap.val() || {};
            const victims = Object.entries(all)
                .filter(([, v]) => v && (v.caseState === 'dry_run' || v.dryRun === true))
                .map(([k]) => k);
            for (const k of victims) {
                await firebase.db.ref(`autopsy-requested/${k}`).remove().catch(() => {});
            }
            console.log(`[DEV-TEST] Purged ${victims.length} simulated autopsy-requested entries via /autopsy-dev-testing by ${interaction.user.username}`);
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(0x28a745)
                    .setTitle('[OK] Purged simulated entries')
                    .setDescription(`Deleted **${victims.length}** \`dry_run\` autopsy-requested ${victims.length === 1 ? 'entry' : 'entries'}. Live cases untouched.`)
                    .setTimestamp()],
            });
            return;
        }

        const enabling = action === 'enable';
        process.env.AUTOPSY_DEV_TESTING = enabling ? 'true' : 'false';
        const w = upsertEnvValues({ AUTOPSY_DEV_TESTING: enabling ? 'true' : 'false' });

        console.log(`[DEV-TEST] ${enabling ? 'ENABLED' : 'DISABLED'} via /autopsy-dev-testing by ${interaction.user.username}`);
        const embed = new EmbedBuilder()
            .setColor(enabling ? 0xff9800 : 0x28a745)
            .setTitle(enabling ? '[WARN] Autopsy Dev Testing — SIMULATING' : '[OK] Autopsy Dev Testing — LIVE')
            .setDescription([
                enabling
                    ? 'Intake + completion now simulate: "would do" Discord summaries instead of forum posts/replies, ME DMs, crossposts and completion marking. Assignments are computed but never written.'
                    : 'Live behavior restored: intake creates cases + assigns MEs; completions post and crosspost.',
                '',
                'Private intake keeps its own mode (`/private-web-autopsy`). Already-posted completions are never touched.',
                `_Config saved to \`${ENV_PATH}\` (${w.changed ? 'written' : 'already up to date'}) — survives restarts, no restart needed._`,
            ].join('\n'))
            .setFooter({ text: enabling ? 'Remember to disable before going back to production' : '' })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[DEV-TEST] Toggle failed:', err.message);
        await interaction.editReply({ content: `[ERR] Failed to update mode: ${err.message}` });
    }
}
