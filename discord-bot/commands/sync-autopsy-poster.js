import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import firebase from '../services/firebase.js';
import { getForumClient } from '../services/forumClient.js';

export const data = new SlashCommandBuilder()
    .setName('sync-autopsy-poster')
    .setDescription('Re-scan autopsy topics to fetch/update the forum poster username');

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
            await interaction.editReply({ content: 'No autopsy requests found.' });
            return;
        }

        const entries = [];
        snap.forEach(c => {
            const v = c.val();
            if (v.wasMatch && v.topicId) entries.push({ id: c.key, topicId: v.topicId, currentPoster: v.forumPoster || null });
        });

        if (entries.length === 0) {
            await interaction.editReply({ content: 'No matching entries to scan.' });
            return;
        }

        await interaction.editReply({ content: `Scanning ${entries.length} topic(s) for forum posters...` });

        const client = getForumClient();
        await client.ensureBrowser();
        let updated = 0;
        let skipped = 0;
        let failed = 0;

        for (const entry of entries) {
            try {
                const poster = await client.getTopicPoster(entry.topicId, { baseUrl: 'https://phmc.gta.world' });
                if (poster) {
                    if (poster !== entry.currentPoster) {
                        await db.ref(`autopsy-requested/${entry.id}/forumPoster`).set(poster);
                        updated++;
                    } else {
                        skipped++;
                    }
                } else {
                    failed++;
                }
            } catch (err) {
                console.error(`[SYNC-POSTER] Failed for #${entry.topicId}: ${err.message}`);
                failed++;
            }
        }

        const embed = new EmbedBuilder()
            .setColor(failed > 0 ? 0xffc107 : 0x28a745)
            .setTitle('Forum Poster Sync Complete')
            .setDescription(`${updated} updated, ${skipped} already correct, ${failed} failed out of ${entries.length} total`)
            .setFooter({ text: `Triggered by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[CMD] sync-autopsy-poster error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}
