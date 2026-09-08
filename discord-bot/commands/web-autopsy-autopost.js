/**
 * web-autopsy-autopost.js — Owner-only runtime toggle for the web autopsy
 * request auto-poster (services/webAutopsyRequestPoster.js).
 *
 * When ON, autopsy-requests/pending entries written by the web app's "Request
 * Autopsy" modal are posted to PHMC f=265 automatically; the standard monitor
 * then creates the case + assigns an ME (DEV TEST mode routes to the forced ME).
 *
 * Persistence: writes AUTOPSY_REQUEST_AUTO_POST into the bot's .env (same file
 * index.js loads at boot) so the mode survives restarts. Runtime process.env is
 * updated immediately — no restart needed either way.
 */
import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { isOwnerOrWhitelisted } from '../services/permissions.js';
import firebase from '../services/firebase.js';
import { isAutoPostEnabled } from '../services/webAutopsyRequestPoster.js';
import { readEnvValue, upsertEnvValues, ENV_PATH } from '../services/envFile.js';

export const data = new SlashCommandBuilder()
    .setName('web-autopsy-autopost')
    .setDescription('(Owner) Toggle auto-posting of web autopsy requests from autopsy-requests/pending to f=265')
    .addStringOption(opt =>
        opt.setName('action')
            .setDescription('What to do')
            .setRequired(true)
            .addChoices(
                { name: 'Enable — auto-post pending web requests', value: 'on' },
                { name: 'Disable — queue only (do not post)', value: 'off' },
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
            const pendingCount = await countPending();
            const embed = new EmbedBuilder()
                .setColor(isAutoPostEnabled() ? 0xff9800 : 0x28a745)
                .setTitle(`Web Autopsy Auto-Post — ${isAutoPostEnabled() ? 'ON' : 'OFF'}`)
                .setDescription([
                    `**Runtime flag:** ${isAutoPostEnabled() ? '`AUTOPSY_REQUEST_AUTO_POST=true`' : 'off'}`,
                    `**On disk (\`.env\`):** \`AUTOPSY_REQUEST_AUTO_POST=${readEnvValue('AUTOPSY_REQUEST_AUTO_POST') ?? '(unset)'}\``,
                    `**Pending web requests:** ${pendingCount}`,
                    '',
                    isAutoPostEnabled()
                        ? '`autopsy-requests/pending` entries are posted to f=265 automatically (dev-test assignment via `/enable-dev-autopsy` if active).'
                        : 'Pending web requests stay queued — nothing is posted. Enable with `action: Enable`.',
                ].join('\n'))
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        const value = action === 'on' ? 'true' : 'false';
        process.env.AUTOPSY_REQUEST_AUTO_POST = value;
        const w = upsertEnvValues({ AUTOPSY_REQUEST_AUTO_POST: value });

        const embed = new EmbedBuilder()
            .setColor(action === 'on' ? 0xff9800 : 0x28a745)
            .setTitle(action === 'on' ? '[WARN] Web Autopsy Auto-Post — Enabled' : '[OK] Web Autopsy Auto-Post — Disabled')
            .setDescription([
                action === 'on'
                    ? 'New `autopsy-requests/pending` entries from the web app will be posted to **f=265** automatically.'
                    : 'Web autopsy requests will stay queued — nothing is posted to the forum.',
                '',
                'Pair with `/enable-dev-autopsy` (DEV TEST) to force all assignments to the dev ME.',
                `_Config saved to \`${ENV_PATH}\` (${w.changed ? 'written' : 'already up to date'}) — survives restarts._`,
            ].join('\n'))
            .setFooter({ text: 'Remember to disable before going back to production' })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[WEB-REQ] Toggle failed:', err.message);
        await interaction.editReply({ content: `[ERR] Failed to update mode: ${err.message}` });
    }
}

async function countPending() {
    try {
        firebase.init();
        const snap = await firebase.db.ref('autopsy-requests/pending').once('value');
        const data = snap.val() || {};
        return Object.values(data).filter(v => v && String(v.status || 'pending') === 'pending').length;
    } catch {
        return '?';
    }
}