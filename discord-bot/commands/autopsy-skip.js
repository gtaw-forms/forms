import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('autopsy-skip')
    .setDescription('Mark an autopsy request as skipped (stops monitor from re-processing it)')
    .addStringOption(opt =>
        opt.setName('name')
            .setDescription('Name (IC or OOC) of the decedent to skip')
            .setRequired(true))
    .addStringOption(opt =>
        opt.setName('reason')
            .setDescription('Reason for skipping (e.g. duplicate, not an autopsy)')
            .setRequired(false));

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can skip autopsy requests.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const searchName = interaction.options.getString('name').trim();
    const reason = interaction.options.getString('reason') || 'Manual skip';

    try {
        const { initializeApp, cert, getApps } = await import('firebase-admin/app');
        const { getDatabase } = await import('firebase-admin/database');
        const { readFileSync, existsSync } = await import('fs');
        const { resolve } = await import('path');

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
            initializeApp({ credential: cert(serviceAccount), databaseURL });
        }
        const db = getDatabase();

        // Search by OOC name, then IC name
        let snap = await db.ref('autopsy-requested').orderByChild('oocName').equalTo(searchName).once('value');
        if (!snap.exists()) {
            snap = await db.ref('autopsy-requested').orderByChild('name').equalTo(searchName).once('value');
        }

        if (!snap.exists()) {
            await interaction.editReply({
                content: 'No autopsy-requested entry found with name: **' + searchName + '**\n\nSearched by both OOC name and IC name.',
            });
            return;
        }

        let updated = 0;
        const details = [];

        snap.forEach((child) => {
            const entry = child.val();
            const key = child.key;
            child.ref.update({
                caseState: 'skipped',
                skippedAt: new Date().toISOString(),
                skippedBy: interaction.user.tag,
                skipReason: reason,
            });
            details.push('⏭️ Skipped #' + key + ' (' + (entry.name || entry.title || '') + ') — ' + reason);
            updated++;
        });

        const embed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle('Autopsy Request Skipped')
            .setDescription([
                '**Name:** ' + searchName,
                '**Reason:** ' + reason,
                '**Entries updated:** ' + updated,
                '',
                ...details,
            ].join('\n'))
            .setFooter({ text: 'Triggered by ' + interaction.user.tag })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[CMD] autopsy-skip error:', err.message);
        await interaction.editReply({ content: 'Error: ' + err.message });
    }
}
