import {
    SlashCommandBuilder,
    MessageFlags,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
} from 'discord.js';
import { isOwnerOrWhitelisted } from '../services/permissions.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const data = new SlashCommandBuilder()
    .setName('restart')
    .setDescription('Restart the bot (owner only)');

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;

    if (!ownerId) {
        console.log('[RESTART] ⚠️ BOT_OWNER_ID not set in .env');
        await interaction.reply({
            content: '❌ BOT_OWNER_ID is not configured. Set it in your .env file.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    if (!isOwnerOrWhitelisted(interaction)) {
        console.log(`[RESTART] ⛔ Denied — ${interaction.user.tag} (${interaction.user.id}) is not the bot owner`);
        await interaction.reply({
            content: '❌ Only the bot owner can use this command.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    console.log(`[RESTART] 🔄 Owner ${interaction.user.tag} requested a restart`);

    const confirm = new ButtonBuilder()
        .setCustomId('restart_confirm')
        .setLabel('Restart Bot')
        .setStyle(ButtonStyle.Danger);

    const cancel = new ButtonBuilder()
        .setCustomId('restart_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(confirm, cancel);

    await interaction.reply({
        content: '⚠️ **Are you sure you want to restart the bot?**',
        components: [row],
        flags: MessageFlags.Ephemeral,
    });

    const response = await interaction.fetchReply();

    const collector = response.createMessageComponentCollector({
        time: 15_000,
        max: 1,
    });

    collector.on('collect', async (buttonInteraction) => {
        if (!isOwnerOrWhitelisted(buttonInteraction)) {
            await buttonInteraction.reply({
                content: '❌ Only the bot owner can confirm this action.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (buttonInteraction.customId === 'restart_confirm') {
            console.log('[RESTART] ✅ Confirmed — restarting via pm2...');
            await buttonInteraction.update({
                content: '🔄 **Restarting via pm2...**',
                components: [],
            });

            // pm2-managed process: ask pm2 to restart (it respawns us).
            // (Old code shelled `sudo systemctl restart phmc-bot` — no such
            // unit exists, so it always failed noisily while process.exit
            // below did the real restart anyway.)
            const { exec } = await import('child_process');
            exec('pm2 restart phmc-bot', (err) => {
                if (err) {
                    console.error('[RESTART] ❌ pm2 restart failed:', err.message);
                } else {
                    console.log('[RESTART] ✅ pm2 restart issued successfully');
                }
            });

            // Brief delay then exit so the response reaches Discord
            setTimeout(() => process.exit(0), 1000);

        } else {
            console.log('[RESTART] ❌ Cancelled');
            await buttonInteraction.update({
                content: '✅ Restart cancelled.',
                components: [],
            });
        }
    });

    collector.on('end', async (collected) => {
        if (collected.size === 0) {
            try {
                await interaction.editReply({
                    content: '⏰ Restart request timed out.',
                    components: [],
                });
            } catch {
                // message might be gone
            }
        }
    });
}
