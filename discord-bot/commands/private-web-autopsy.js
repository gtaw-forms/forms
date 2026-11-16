/**
 * private-web-autopsy.js — Owner-only runtime mode for the web private
 * autopsy intake (services/privateWebAutopsyIntake.js).
 *
 *   off    — queue only: web "Private Autopsy" submissions wait, nothing is posted
 *   dryrun — validate + Discord "would create" notice; never touches the forum
 *   live   — create the confidential f=266 case, assign the ME, notify staff
 *
 * Persistence: writes PRIVATE_WEB_MODE into the bot's .env (the file index.js
 * loads at boot) so the mode survives restarts; process.env updates immediately.
 */
import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { isOwnerOrWhitelisted } from '../services/permissions.js';
import firebase from '../services/firebase.js';
import { privateWebMode } from '../services/privateWebAutopsyIntake.js';
import { readEnvValue, upsertEnvValues, ENV_PATH } from '../services/envFile.js';

export const data = new SlashCommandBuilder()
    .setName('private-web-autopsy')
    .setDescription('(Owner) Mode for web PRIVATE autopsy requests (autopsy-requests/private-pending)')
    .addStringOption(opt =>
        opt.setName('action')
            .setDescription('What to do')
            .setRequired(true)
            .addChoices(
                { name: 'Off — queue only (nothing posted)', value: 'off' },
                { name: 'Dry run — validate + Discord notice, no forum post', value: 'dryrun' },
                { name: 'Live — create the confidential f=266 case', value: 'live' },
                { name: 'Status', value: 'status' },
            ));

export async function execute(interaction) {
    if (!isOwnerOrWhitelisted(interaction)) {
        await interaction.reply({ content: 'Only the bot owner can run this.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const action = interaction.options.getString('action');

    try {
        if (action === 'status') {
            const counts = await countPending();
            const mode = privateWebMode();
            const embed = new EmbedBuilder()
                .setColor(mode === 'live' ? 0x9b59b6 : mode === 'dryrun' ? 0xff9800 : 0x28a745)
                .setTitle(`Web Private Autopsy — ${mode.toUpperCase()}`)
                .setDescription([
                    `**Runtime:** \`PRIVATE_WEB_MODE=${mode}\``,
                    `**On disk (\`.env\`):** \`PRIVATE_WEB_MODE=${readEnvValue('PRIVATE_WEB_MODE') ?? '(unset)'}\``,
                    `**Queued (pending):** ${counts.pending}`,
                    `**Rejected / needs review:** ${counts.rejected} / ${counts.needsReview}`,
                    `**Posted:** ${counts.posted}`,
                    '',
                    mode === 'live'
                        ? 'New private submissions open a confidential f=266 case immediately — no public f=265 topic, no crosspost.'
                        : mode === 'dryrun'
                            ? 'Submissions validate and post a Discord notice only; nothing is created.'
                            : 'Submissions stay queued in `autopsy-requests/private-pending`.',
                ].join('\n'))
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        process.env.PRIVATE_WEB_MODE = action;
        const w = upsertEnvValues({ PRIVATE_WEB_MODE: action });

        // Entries submitted while the intake was off are still queued — process
        // them now instead of waiting for another RTDB event or a restart.
        if (action === 'dryrun' || action === 'live') {
            try {
                const { resumePrivateWebIntake } = await import('../services/privateWebAutopsyIntake.js');
                await resumePrivateWebIntake();
            } catch (err) {
                console.warn('[WEB-PRIVATE] Resume after mode change failed:', err.message);
            }
        }

        const embed = new EmbedBuilder()
            .setColor(action === 'live' ? 0x9b59b6 : action === 'dryrun' ? 0xff9800 : 0x28a745)
            .setTitle(action === 'live'
                ? '[WARN] Web Private Autopsy — LIVE'
                : action === 'dryrun'
                    ? '[OK] Web Private Autopsy — Dry Run'
                    : '[OK] Web Private Autopsy — Off')
            .setDescription([
                action === 'live'
                    ? 'New web private requests now create the confidential f=266 case, assign the ME by rotation and notify staff. Nothing is posted to f=265 and nothing is crossposted.'
                    : action === 'dryrun'
                        ? 'New web private requests validate and post a Discord "would create" notice. No forum posts.'
                        : 'Web private requests stay queued — nothing is posted.',
                '',
                action === 'live'
                    ? 'LSPD private cases file to DRDB on completion (LSPD portal flags apply); LSSD/SADCR/DAO receive a forum PM.'
                    : '',
                `_Config saved to \`${ENV_PATH}\` (${w.changed ? 'written' : 'already up to date'}) — survives restarts._`,
            ].filter(Boolean).join('\n'))
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[WEB-PRIVATE] Mode toggle failed:', err.message);
        await interaction.editReply({ content: `[ERR] Failed to update mode: ${err.message}` });
    }
}

async function countPending() {
    const out = { pending: '?', posted: 0, rejected: 0, needsReview: 0 };
    try {
        firebase.init();
        const snap = await firebase.db.ref('autopsy-requests/private-pending').once('value');
        const all = snap.val() || {};
        out.pending = 0;
        for (const v of Object.values(all)) {
            if (!v) continue;
            const status = String(v.status || 'pending');
            if (status === 'pending') out.pending += 1;
            else if (status === 'posted' || status === 'dryrun') out.posted += 1;
            else if (status === 'rejected' || status === 'duplicate') out.rejected += 1;
            else if (status === 'needs-review') out.needsReview += 1;
        }
    } catch { /* counts are informational only */ }
    return out;
}
