import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import firebase from '../services/firebase.js';
import { getRotationStatus } from '../services/autopsyRotation.js';

export const data = new SlashCommandBuilder()
    .setName('rotation-set')
    .setDescription('Configure the autopsy ME rotation list (owner only)')
    .addStringOption(opt =>
        opt.setName('list')
            .setDescription('Comma-separated ME names in rotation order, e.g. "Anne Carter, Arthur Blackwood"')
            .setRequired(false))
    .addIntegerOption(opt =>
        opt.setName('position')
            .setDescription('Set the position pointer (1-based) — who gets the next case')
            .setRequired(false)
            .setMinValue(1))
    .addStringOption(opt =>
        opt.setName('change')
            .setDescription('ME name to set as next in rotation')
            .setRequired(false)
            .setAutocomplete(true));

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can manage the rotation.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    firebase.init();
    const db = firebase.db;

    const listStr = interaction.options.getString('list');
    const position = interaction.options.getInteger('position');
    const changeName = interaction.options.getString('change');

    if (!listStr && !position && !changeName) {
        await interaction.editReply({ content: 'Provide `list` (comma-separated names), `position` (number), or `change` (ME name). Use `/rotation-list` to see the current state.' });
        return;
    }

    try {
        const updates = {};

        if (listStr) {
            const names = listStr
                .split(',')
                .map(n => n.trim())
                .filter(n => n.length > 0);

            if (names.length < 2) {
                await interaction.editReply({ content: 'The rotation list must have at least 2 ME names.' });
                return;
            }

            updates['autopsy-requests/rotation/list'] = names;
            // Reset position to 0 when setting a new list
            updates['autopsy-requests/rotation/position'] = 0;

            await db.ref().update(updates);

            const status = await getRotationStatus(db);

            const embed = new EmbedBuilder()
                .setColor(0x28a745)
                .setTitle('Rotation List Updated')
                .setDescription(`**${names.length} MEs** in rotation:\n${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}`)
                .addFields(
                    { name: 'Position Reset', value: `Next assignment starts at #1 (${names[0]})`, inline: false },
                    { name: 'Note', value: 'Use `/rotation-set position:N` to adjust the pointer if needed.', inline: false },
                )
                .setFooter({ text: 'Rotation managed by PHMC Bot' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (changeName) {
            const status = await getRotationStatus(db);
            if (!status.configured) {
                await interaction.editReply({ content: 'No rotation list exists yet. Set the list first with `/rotation-set list:"Name1, Name2, ..."`' });
                return;
            }

            const idx = status.list.findIndex(n => n.toLowerCase() === changeName.toLowerCase());
            if (idx === -1) {
                await interaction.editReply({ content: `Could not find "${changeName}" in the rotation list. Use \`/rotation-list\` to see all MEs.` });
                return;
            }

            await db.ref('autopsy-requests/rotation/position').set(idx);

            const embed = new EmbedBuilder()
                .setColor(0x28a745)
                .setTitle('Rotation Next Changed')
                .setDescription(`Next assignment will go to **${status.list[idx]}** (#${idx + 1} of ${status.list.length})`)
                .setFooter({ text: 'Rotation managed by PHMC Bot' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (position !== null) {
            // Need to validate against current list length
            const status = await getRotationStatus(db);
            if (!status.configured) {
                await interaction.editReply({ content: 'No rotation list exists yet. Set the list first with `/rotation-set list:"Name1, Name2, ..."`' });
                return;
            }

            const zeroBased = position - 1;
            if (zeroBased < 0 || zeroBased >= status.list.length) {
                await interaction.editReply({ content: `Position must be between 1 and ${status.list.length} (there are ${status.list.length} MEs in the rotation).` });
                return;
            }

            await db.ref('autopsy-requests/rotation/position').set(zeroBased);

            const embed = new EmbedBuilder()
                .setColor(0x28a745)
                .setTitle('Rotation Position Updated')
                .setDescription(`Next assignment will go to **${status.list[zeroBased]}** (position #${position} of ${status.list.length})`)
                .setFooter({ text: 'Rotation managed by PHMC Bot' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    } catch (err) {
        console.error('[CMD] rotation-set error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}

/** Autocomplete for the `change` option — suggests ME names from the rotation list. */
export async function autocomplete(interaction) {
    firebase.init();
    const db = firebase.db;
    const status = await getRotationStatus(db);
    const names = status.list || [];
    const focused = interaction.options.getFocused().toLowerCase();
    const filtered = names.filter(n => n.toLowerCase().includes(focused)).slice(0, 25);
    await interaction.respond(filtered.map(n => ({ name: n, value: n })));
}
