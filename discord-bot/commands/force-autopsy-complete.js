import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('force-autopsy-complete')
    .setDescription('Force-mark an autopsy-requested entry as completed (owner only)')
    .addStringOption(opt =>
        opt.setName('ooc')
            .setDescription('OOC name to mark as completed')
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

    const ooc = interaction.options.getString('ooc').trim();
    const status = interaction.options.getString('status') || 'completed';

    try {
        const admin = (await import('firebase-admin')).default;
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

        let app;
        try {
            app = admin.app();
        } catch {
            app = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL,
            });
        }
        const db = admin.database();

        // Look up the entry
        const snap = await db.ref('autopsy-requested').orderByChild('oocName').equalTo(ooc).once('value');

        if (!snap.exists()) {
            await interaction.editReply({
                content: 'No autopsy-requested entry found with OOC name: **' + ooc + '**',
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
