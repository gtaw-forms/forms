import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import firebase from '../services/firebase.js';
import { getForumClient } from '../services/forumClient.js';
import { parseAutopsyRequestBbcode } from '../services/autopsyRequestMonitor.js';

export const data = new SlashCommandBuilder()
    .setName('sync-autopsy-requests')
    .setDescription('Re-scan logged autopsy requests and parse their fields');

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can run this.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        firebase.init();
        const db = firebase.db;
        const snap = await db.ref('autopsy-requested').once('value');
        if (!snap.exists()) {
            await interaction.editReply({ content: 'No autopsy requests found in database.' });
            return;
        }

        const entries = [];
        snap.forEach(c => { const v = c.val(); if (v.wasMatch) entries.push({ id: c.key, title: v.title, topicId: v.topicId }); });

        if (entries.length === 0) {
            await interaction.editReply({ content: 'No matching autopsy requests to sync.' });
            return;
        }

        await interaction.editReply({ content: `Syncing ${entries.length} request(s)...` });

        const client = getForumClient();
        await client.ensureBrowser();
        let synced = 0;
        let failed = 0;

        for (const entry of entries) {
            try {
                const bbcode = await client.getTopicBbcode(entry.topicId, 265, { baseUrl: 'https://phmc.gta.world' });
                if (bbcode) {
                    const parsed = parseAutopsyRequestBbcode(bbcode);
                    if (Object.keys(parsed).length > 0) {
                        await db.ref(`autopsy-requested/${entry.id}/parsed`).set(parsed);
                        synced++;
                    }
                }
            } catch (err) {
                console.error(`[SYNC] Failed for #${entry.topicId}: ${err.message}`);
                failed++;
            }
        }

        const embed = new EmbedBuilder()
            .setColor(failed > 0 ? 0xffc107 : 0x28a745)
            .setTitle('Autopsy Sync Complete')
            .setDescription(`${synced} synced, ${failed} failed out of ${entries.length} total`)
            .setFooter({ text: `Triggered by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[CMD] sync-autopsy-requests error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}
