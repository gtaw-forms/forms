import {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} from 'discord.js';
import firebase from '../services/firebase.js';
import {
    RECORDS_PER_PAGE,
    buildRecordEmbed,
    buildSearchComponents,
    buildSearchEmbed,
} from '../components/morgueSearch.js';

export const data = new SlashCommandBuilder()
    .setName('morgue')
    .setDescription('Search the PHMC Morgue database')
    .addStringOption(option =>
        option
            .setName('search')
            .setDescription('Search by name, case number, or location')
            .setRequired(false)
    );

/**
 * Handle the /morgue slash command
 */
export async function execute(interaction) {
    const query = interaction.options.getString('search') || '';
    const userId = interaction.user.id;
    const username = interaction.user.tag;

    // TODO: Future role-based restriction
    // Example:
    //   const allowedRoles = ['123456789012345678', '987654321098765432'];
    //   const memberRoles = interaction.member.roles.cache.map(r => r.id);
    //   if (!allowedRoles.some(r => memberRoles.includes(r))) {
    //       return interaction.reply({ content: '❌ You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
    //   }

    console.log(`[MORGUE] 🔍 /morgue invoked by ${username} (${userId}) | query="${query}"`);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        // --- Fetch from Firebase ---
        console.log('[MORGUE] 🔄 Fetching records from Firebase...');
        const records = await firebase.searchMorgueRecords(query);
        console.log(`[MORGUE] ✅ Found ${records.length} records`);

        if (records.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle('No Results')
                .setDescription(
                    query
                        ? `No morgue records matched your search for **${query}**.`
                        : 'No morgue records found in the database.'
                )
                .setFooter({ text: 'Records are synced daily from in-game logs' })
                .setTimestamp();

            console.log('[MORGUE] 📭 No records to display');
            await interaction.editReply({ embeds: [embed], components: [] });
            return;
        }

        // --- Build first page ---
        const page = 1;
        const embed = buildSearchEmbed(records, page, query);
        const { selectRow, buttonRow } = buildSearchComponents(records, page);

        console.log(`[MORGUE] 📄 Displaying page ${page}/${Math.ceil(records.length / RECORDS_PER_PAGE)}`);

        const response = await interaction.editReply({
            embeds: [embed],
            components: [selectRow, buttonRow],
        });

        // --- Collector for interactions on this message ---
        const collector = response.createMessageComponentCollector({
            time: 5 * 60 * 1000, // 5 minutes
        });

        let currentPage = 1;

        collector.on('collect', async (componentInteraction) => {
            console.log(`[MORGUE] 🖱️ ${componentInteraction.user.tag} interacted: ${componentInteraction.customId}`);

            try {
                if (componentInteraction.customId === 'morgue_select') {
                    // --- Record detail selected ---
                    const recordKey = componentInteraction.values[0];
                    const record = records.find(r => r.firebaseKey === recordKey);

                    if (!record) {
                        console.log(`[MORGUE] ⚠️ Record ${recordKey} not found in current result set`);
                        await componentInteraction.reply({
                            content: '❌ That record is no longer available in this result set. Please search again.',
                            flags: MessageFlags.Ephemeral,
                        });
                        return;
                    }

                    console.log(`[MORGUE] 📋 User selected record: Case #${record.caseId} — ${record.name}`);

                    const detailEmbed = buildRecordEmbed(record);

                    // Simple back button to return to list
                    const backButton = new ButtonBuilder()
                        .setCustomId('morgue_back')
                        .setLabel('◀ Back to Results')
                        .setStyle(ButtonStyle.Primary);

                    const backRow = new ActionRowBuilder().addComponents(backButton);

                    await componentInteraction.update({
                        embeds: [detailEmbed],
                        components: [backRow],
                    });

                } else if (componentInteraction.customId === 'morgue_back') {
                    // --- Back to results list ---
                    console.log(`[MORGUE] 🔙 Returning to results page ${currentPage}`);
                    const listEmbed = buildSearchEmbed(records, currentPage, query);
                    const { selectRow: newSelect, buttonRow: newButtons } = buildSearchComponents(records, currentPage);

                    await componentInteraction.update({
                        embeds: [listEmbed],
                        components: [newSelect, newButtons],
                    });

                } else if (componentInteraction.customId === 'morgue_next') {
                    // --- Next page ---
                    currentPage++;
                    console.log(`[MORGUE] 📄 Navigating to page ${currentPage}`);
                    const listEmbed = buildSearchEmbed(records, currentPage, query);
                    const { selectRow: newSelect, buttonRow: newButtons } = buildSearchComponents(records, currentPage);

                    await componentInteraction.update({
                        embeds: [listEmbed],
                        components: [newSelect, newButtons],
                    });

                } else if (componentInteraction.customId === 'morgue_prev') {
                    // --- Previous page ---
                    currentPage--;
                    console.log(`[MORGUE] 📄 Navigating to page ${currentPage}`);
                    const listEmbed = buildSearchEmbed(records, currentPage, query);
                    const { selectRow: newSelect, buttonRow: newButtons } = buildSearchComponents(records, currentPage);

                    await componentInteraction.update({
                        embeds: [listEmbed],
                        components: [newSelect, newButtons],
                    });
                }
            } catch (error) {
                console.error(`[MORGUE] ❌ Error handling interaction:`, error.message);
                if (componentInteraction.replied || componentInteraction.deferred) {
                    await componentInteraction.followUp({
                        content: '❌ An error occurred while processing your request.',
                        flags: MessageFlags.Ephemeral,
                    });
                } else {
                    await componentInteraction.reply({
                        content: '❌ An error occurred while processing your request.',
                        flags: MessageFlags.Ephemeral,
                    });
                }
            }
        });

        collector.on('end', async () => {
            console.log('[MORGUE] ⏰ Collector expired — disabling components');
            try {
                // Disable all components after timeout
                const disabledEmbed = EmbedBuilder.from(response.embeds[0])
                    .setFooter({ text: 'Session expired — use /morgue again to search' });

                const disabledRows = response.components.map(row => {
                    const newRow = { ...row, components: row.components.map(comp => ({ ...comp, disabled: true })) };
                    return newRow;
                });

                await interaction.editReply({ embeds: [disabledEmbed], components: disabledRows });
            } catch {
                // Message may have already been deleted
                console.log('[MORGUE] ⚠️ Could not disable components (message may be gone)');
            }
        });

    } catch (error) {
        console.error(`[MORGUE] ❌ Fatal error:`, error);
        await interaction.editReply({
            content: '❌ An unexpected error occurred while searching the morgue database. Please try again later.',
            embeds: [],
            components: [],
        });
    }
}
