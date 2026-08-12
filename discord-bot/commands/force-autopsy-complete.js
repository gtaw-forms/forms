import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { clearAssignment } from '../services/autopsyRotation.js';

export const data = new SlashCommandBuilder()
    .setName('force-autopsy-complete')
    .setDescription('Force-mark an autopsy-requested entry as completed (owner only)')
    .addStringOption(opt =>
        opt.setName('name')
            .setDescription('Name (IC or OOC) of the decedent to search')
            .setRequired(true))
    .addStringOption(opt =>
        opt.setName('status')
            .setDescription('Status to set (default: completed)')
            .setRequired(false)
            .addChoices(
                { name: 'Completed', value: 'completed' },
                { name: 'Failed — retry', value: 'failed' },
            ));

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can force-mark autopsies.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const searchName = interaction.options.getString('name').trim();
    const status = interaction.options.getString('status') || 'completed';

    try {
        const { initializeApp, cert, getApps } = await import('firebase-admin/app');
        const { getDatabase } = await import('firebase-admin/database');
        const { readFileSync, existsSync } = await import('fs');
        const { resolve } = await import('path');

        // Initialize Firebase if not already
        const keyPath = resolve(process.cwd(), process.env.FIREBASE_ADMIN_KEY_PATH || '../firebase-admin-key.json');
        if (!existsSync(keyPath)) {
            await interaction.editReply({ content: 'Firebase admin key not found at: ' + keyPath });
            return;
        }
        const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf-8'));
        const databaseURL = process.env.FIREBASE_DATABASE_URL;
        if (!databaseURL) {
            await interaction.editReply({ content: 'FIREBASE_DATABASE_URL not set in .env' });
            return;
        }

        if (getApps().length === 0) {
            initializeApp({
                credential: cert(serviceAccount),
                databaseURL,
            });
        }
        const db = getDatabase();

        // Look up the entry — try OOC name first, then IC name
        let snap = await db.ref('autopsy-requested').orderByChild('oocName').equalTo(searchName).once('value');

        if (!snap.exists()) {
            console.log('[CMD] force-autopsy-complete: OOC name not found, trying IC name: "' + searchName + '"');
            snap = await db.ref('autopsy-requested').orderByChild('name').equalTo(searchName).once('value');
        }

        if (!snap.exists()) {
            await interaction.editReply({
                content: 'No autopsy-requested entry found with name: **' + searchName + '**\n\n'
                    + 'Searched by both OOC name and IC name. Ensure the name matches exactly how it appears in Firebase.',
            });
            return;
        }

        let updated = 0;
        const details = [];

        snap.forEach((child) => {
            const entry = child.val();
            const key = child.key;
            const alreadyDone = !!entry.completedAt;

            if (status === 'completed') {
                child.ref.update({
                    completedAt: new Date().toISOString(),
                    completedBy: 'force-autopsy-complete (owner: ' + interaction.user.tag + ')',
                });
                // Decrement the ME's active case count in the rotation tracker
                if (entry.assignedTo) {
                    clearAssignment(db, entry.assignedTo, key).catch(err => {
                        console.warn(`[CMD] force-autopsy-complete: rotation tracking error: ${err.message}`);
                    });
                }
                details.push((alreadyDone ? '🔄 Re-marked' : '✅ Marked') + ' #' + key + ' (' + (entry.title || '') + ')');
            } else if (status === 'failed') {
                child.ref.update({
                    completedAt: null,
                    completedBy: null,
                    deployStatus: 'failed_manual',
                    deployMessage: 'Force-marked as failed by owner',
                });
                details.push('❌ Marked as failed #' + key);
            }
            updated++;
        });

        const embed = new EmbedBuilder()
            .setColor(status === 'completed' ? 0x28a745 : 0xffc107)
            .setTitle('Autopsy Force-' + (status === 'completed' ? 'Completed' : 'Failed'))
            .setDescription([
                '**OOC:** ' + ooc,
                '**Entries updated:** ' + updated,
                '',
                ...details,
            ].join('\n'))
            .setFooter({ text: 'Triggered by ' + interaction.user.tag })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[CMD] force-autopsy-complete error:', err.message);
        await interaction.editReply({ content: 'Error: ' + err.message });
    }
}
