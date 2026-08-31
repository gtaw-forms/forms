import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import firebase from '../services/firebase.js';
import { isDevTestActive, getDevTestME } from '../services/autopsyRotation.js';
import { readEnvValue, upsertEnvValues, ENV_PATH } from '../services/envFile.js';

export const data = new SlashCommandBuilder()
    .setName('enable-dev-autopsy')
    .setDescription('(Owner) Force every new autopsy to one ME — normal pipeline otherwise (dev testing)')
    .addStringOption(opt =>
        opt.setName('action')
            .setDescription('What to do')
            .setRequired(true)
            .addChoices(
                { name: 'Enable — force all assignments', value: 'enable' },
                { name: 'Disable — resume fair rotation', value: 'disable' },
                { name: 'Status', value: 'status' },
            ))
    .addStringOption(opt =>
        opt.setName('me')
            .setDescription('Forum username of the forced ME (default: Alyson Frost)')
            .setRequired(false));

/**
 * Owner-only runtime toggle for DEV TEST assignment mode.
 *
 * When enabled, ALL new autopsy cases are assigned to the configured ME
 * (default Alyson Frost) while the rest of the pipeline runs exactly as in
 * production — detection, case creation, certified-copy crossposts, acks,
 * completion webhooks, retries. Already-assigned cases stay untouched.
 *
 * Persistence: writes AUTOPSY_DEV_TEST / AUTOPSY_DEV_TEST_ME into the bot's
 * .env (same file index.js loads at boot) so the mode survives restarts.
 * Runtime process.env is updated immediately — no restart needed either way.
 */
export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can run this.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const action = interaction.options.getString('action');
    let me = (interaction.options.getString('me') || '').trim();

    try {
        if (action === 'status') {
            await interaction.editReply({ embeds: [buildStatusEmbed()] });
            return;
        }

        if (action === 'disable') {
            // Flip the flag off; keep the stored ME so re-enabling remembers it.
            process.env.AUTOPSY_DEV_TEST = 'false';
            const w = upsertEnvValues({ AUTOPSY_DEV_TEST: 'false' });
            const embed = new EmbedBuilder()
                .setColor(0x28a745)
                .setTitle('[OK] DEV TEST Autopsy Mode — Disabled')
                .setDescription([
                    'Fair rotation (+ supervised `ASSIGNED:` markers and LOA rules) is back in control for **new** cases.',
                    '',
                    '**Note:** existing dev-forced cases remain with their assigned ME — use `/reassign-autopsy` if any need moving.',
                    `_Config saved to \`${ENV_PATH}\` (${w.changed ? 'written' : 'already up to date'}) — survives restarts._`,
                ].join('\n'))
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // ── Enable ──
        // Default forced ME: Alyson Frost (per request); remember custom value.
        const forcedME = me || process.env.AUTOPSY_DEV_TEST_ME || getDevTestME() || 'Alyson Frost';
        process.env.AUTOPSY_DEV_TEST = 'true';
        process.env.AUTOPSY_DEV_TEST_ME = forcedME;

        const w = upsertEnvValues({
            AUTOPSY_DEV_TEST: 'true',
            AUTOPSY_DEV_TEST_ME: forcedME,
        });

        console.log(`[DEV-TEST] ENABLED via /enable-dev-autopsy by ${interaction.user.username} — all autopsy assignments -> ${forcedME}`);

        const embed = new EmbedBuilder()
            .setColor(0xff9800)
            .setTitle('[WARN] DEV TEST Autopsy Mode — Enabled')
            .setDescription([
                `Every **new** autopsy case will be assigned to **${forcedME}**.`,
                '',
                '**Everything else runs 100% normally:** detection, case creation, certified-copy crossposts (LSSD/SADCR/DAO), acknowledgements, requester completion webhooks, retry sweeps.',
                '- Fair rotation: bypassed',
                '- LOA checks: bypassed for the forced ME',
                '- Supervised `ASSIGNED:` markers: overridden',
                '- Already-assigned cases: untouched',
                `- Pings need a mapping: \`autopsy-requests/discord-members/${forcedME.toLowerCase()}\``,
                '',
                `_Config saved to \`${ENV_PATH}\` (${w.changed ? 'written' : 'already up to date'}) — survives restarts. Run with \`action: Disable\` to restore rotation._`,
            ].join('\n'))
            .setFooter({ text: 'Remember to disable before going back to production' })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[DEV-TEST] Toggle failed:', err.message);
        await interaction.editReply({ content: `[ERR] Failed to update mode: ${err.message}` });
    }
}

/** Build the current-state status embed (runtime + on-disk values). */
function buildStatusEmbed() {
    const active = isDevTestActive();
    const runtimeME = getDevTestME() || '(mode off)';
    const fileFlag = readEnvValue('AUTOPSY_DEV_TEST');
    const fileME = readEnvValue('AUTOPSY_DEV_TEST_ME');

    return new EmbedBuilder()
        .setColor(active ? 0xff9800 : 0x28a745)
        .setTitle(`DEV TEST Autopsy Mode — ${active ? 'ACTIVE' : 'Inactive'}`)
        .setDescription([
            `**Runtime flag:** ${active ? '`AUTOPSY_DEV_TEST=true`' : 'off'}`,
            `**Forced ME:** ${active ? `**${runtimeME}**` : runtimeME}`,
            `**On disk (\`.env\`):** \`AUTOPSY_DEV_TEST=${fileFlag ?? '(unset)'}\`, \`AUTOPSY_DEV_TEST_ME=${fileME ?? '(unset)'}\``,
            '',
            active
                ? 'New cases go straight to the forced ME; everything else (crossposts, acks, completion webhooks, retries) runs normally.'
                : 'Normal fair-rotation assignment is running. Enable with `action: Enable`.',
        ].join('\n'))
        .setTimestamp();
}
