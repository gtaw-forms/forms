import {
    SlashCommandBuilder,
    MessageFlags,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
} from 'discord.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

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

    if (interaction.user.id !== ownerId) {
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
        if (buttonInteraction.user.id !== ownerId) {
            await buttonInteraction.reply({
                content: '❌ Only the bot owner can confirm this action.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (buttonInteraction.customId === 'restart_confirm') {
            console.log('[RESTART] ✅ Confirmed — restarting via systemd...');
            await buttonInteraction.update({
                content: '🔄 **Restarting via systemd...**',
                components: [],
            });

            // Use systemd to restart — this works with the service setup
            const { exec } = await import('child_process');
            exec('sudo systemctl restart phmc-bot', (err) => {
                if (err) {
                    console.error('[RESTART] ❌ systemctl restart failed:', err.message);
                } else {
                    console.log('[RESTART] ✅ systemctl restart issued successfully');
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
