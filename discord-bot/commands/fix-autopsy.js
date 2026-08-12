import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('fix-autopsy')
    .setDescription('Fix incorrect data in an autopsy request entry')
    .addStringOption(opt =>
        opt.setName('name')
            .setDescription('Current OOC or IC name to search for')
            .setRequired(true))
    .addStringOption(opt =>
        opt.setName('newname')
            .setDescription('Correct IC name')
            .setRequired(false))
    .addStringOption(opt =>
        opt.setName('newooc')
            .setDescription('Correct OOC name')
            .setRequired(false))
    .addStringOption(opt =>
        opt.setName('newfaction')
            .setDescription('Correct faction')
            .setRequired(false)
            .addChoices(
                { name: 'LSPD', value: 'LSPD' },
                { name: 'LSSD', value: 'LSSD' },
            ));

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can fix autopsy data.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const searchName = interaction.options.getString('name').trim();
    const newName = interaction.options.getString('newname')?.trim();
    const newOoc = interaction.options.getString('newooc')?.trim();
    const newFaction = interaction.options.getString('newfaction')?.trim();

    if (!newName && !newOoc && !newFaction) {
        await interaction.editReply({ content: 'Provide at least one field to fix: newname, newooc, or newfaction.' });
        return;
    }

    try {
        const { initializeApp, cert, getApps } = await import('firebase-admin/app');
        const { getDatabase } = await import('firebase-admin/database');
        const { readFileSync, existsSync } = await import('fs');
        const { resolve } = await import('path');

        const keyPath = resolve(process.cwd(), process.env.FIREBASE_ADMIN_KEY_PATH || '../firebase-admin-key.json');
        if (!existsSync(keyPath)) {
            await interaction.editReply({ content: 'Firebase admin key not found.' });
            return;
        }
        const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf-8'));
        const databaseURL = process.env.FIREBASE_DATABASE_URL;
        if (!databaseURL) {
            await interaction.editReply({ content: 'FIREBASE_DATABASE_URL not set.' });
            return;
        }

        if (getApps().length === 0) {
            initializeApp({ credential: cert(serviceAccount), databaseURL });
        }
        const db = getDatabase();

        // Search by OOC name, then IC name, then topicId
        let snap = await db.ref('autopsy-requested').orderByChild('oocName').equalTo(searchName).once('value');
        if (!snap.exists()) {
            snap = await db.ref('autopsy-requested').orderByChild('name').equalTo(searchName).once('value');
        }
        if (!snap.exists() && /^\d+$/.test(searchName)) {
            snap = await db.ref('autopsy-requested/' + searchName).once('value');
            if (snap.exists()) {
                const e = snap.val();
                const wrapped = {};
                wrapped[searchName] = e;
                snap = { exists: () => true, forEach: (fn) => { fn({ key: searchName, val: () => e }); return true; }, val: () => wrapped };
            }
        }

        if (!snap.exists()) {
            await interaction.editReply({ content: 'No autopsy-requested entry found for: **' + searchName + '**' });
            return;
        }

        let updated = 0;
        const details = [];

        snap.forEach((child) => {
            const entry = child.val();
            const key = child.key;
            const updates = {};
            if (newName) updates.name = newName;
            if (newOoc) updates.oocName = newOoc;
            if (newFaction) updates.faction = newFaction;
            child.ref.update(updates);
            const parts = [];
            if (newName) parts.push('name: ' + entry.name + ' -> ' + newName);
            if (newOoc) parts.push('OOC: ' + (entry.oocName || '') + ' -> ' + newOoc);
            if (newFaction) parts.push('faction: ' + (entry.faction || '') + ' -> ' + newFaction);
            details.push('Fixed #' + key + ' (' + parts.join(', ') + ')');
            updated++;
        });

        const embed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle('Autopsy Data Fixed')
            .setDescription(['**Searched:** ' + searchName, '**Entries updated:** ' + updated, '', ...details].join('\n'))
            .setFooter({ text: 'Triggered by ' + interaction.user.tag })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[CMD] fix-autopsy error:', err.message);
        await interaction.editReply({ content: 'Error: ' + err.message });
    }
}
