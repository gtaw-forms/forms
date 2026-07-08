import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import firebase from '../services/firebase.js';

export const data = new SlashCommandBuilder()
    .setName('autopsy-loa')
    .setDescription('Toggle LOA status for a Medical Examiner (prevents case assignment)')
    .addStringOption(opt => opt.setName('username').setDescription('Forum username').setRequired(true));

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can manage LOA.', flags: MessageFlags.Ephemeral });
        return;
    }

    firebase.init();
    const db = firebase.db;

    const username = interaction.options.getString('username').trim();
    const key = username.toLowerCase();
    const loaRef = db.ref(`autopsy-requests/loa/${key}`);

    try {
        const snap = await loaRef.once('value');
        const currentlyOnLoa = snap.val() === true;

        await loaRef.set(currentlyOnLoa ? null : true);
        const status = currentlyOnLoa ? 'removed from LOA' : 'placed on LOA';

        // Get current LOA list
        const allLoa = await db.ref('autopsy-requests/loa').once('value');
        const onLoa = [];
        if (allLoa.exists()) {
            allLoa.forEach(c => { if (c.val() === true) onLoa.push(c.key); });
        }

        const embed = new EmbedBuilder()
            .setColor(currentlyOnLoa ? 0x28a745 : 0xffc107)
            .setTitle('Medical Examiner LOA')
            .setDescription(`**${username}** ${status}.`)
            .addFields({ name: 'Currently on LOA', value: onLoa.length > 0 ? onLoa.join(', ') : 'None' })
            .setFooter({ text: `Updated by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } catch (err) {
        console.error('[CMD] autopsy-loa error:', err.message);
        await interaction.reply({ content: `Error: ${err.message}`, flags: MessageFlags.Ephemeral });
    }
}
