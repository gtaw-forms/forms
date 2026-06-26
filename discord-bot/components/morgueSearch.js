import {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';

const RECORDS_PER_PAGE = 25;

/**
 * Build an embed for a single morgue record detail view
 */
function buildRecordEmbed(record) {
    const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`Case #${record.caseId} — ${record.name}`)
        .addFields(
            { name: 'Sex', value: record.sex || 'Unknown', inline: true },
            { name: 'Identified', value: record.identified || 'Unknown', inline: true },
            { name: 'Location', value: record.location || 'Unknown', inline: true },
            { name: 'Time of Death', value: record.timeOfDeath || 'Unknown', inline: true },
            { name: 'Cause of Death', value: record.causeOfDeath || 'Unknown', inline: false },
            { name: 'DNA Profile', value: record.dnaProfile ? `\`${record.dnaProfile}\`` : 'N/A', inline: false },
            { name: 'BAC', value: record.bac || '0.00%', inline: true },
            { name: 'Narcotics', value: record.narcotics || 'None', inline: true },
        )
        .setFooter({ text: `Record ID: ${record.firebaseKey}` })
        .setTimestamp();

    if (record.physicalDescription) {
        const desc = record.physicalDescription.length > 500
            ? record.physicalDescription.slice(0, 497) + '...'
            : record.physicalDescription;
        embed.addFields({ name: 'Physical Description', value: desc, inline: false });
    }

    if (record.adminNote) {
        embed.addFields({ name: 'Admin Note', value: record.adminNote, inline: false });
    }

    if (record.findings && record.findings.length > 0) {
        const findingsText = record.findings
            .slice(0, 10)
            .map(f => `\`${f.time}\` ${f.type} — ${f.part} (${f.dist})`)
            .join('\n');
        embed.addFields({
            name: `Autopsy Findings (${record.findings.length})`,
            value: findingsText || 'No findings recorded',
            inline: false,
        });
    }

    if (record.bullets && record.bullets.length > 0) {
        const bulletsText = record.bullets
            .map(b => `• ${b.type} #${b.id}`)
            .join('\n');
        embed.addFields({ name: 'Recovered Bullets', value: bulletsText, inline: false });
    }

    return embed;
}

/**
 * Build the select menu + navigation components for a page of records
 */
function buildSearchComponents(records, page) {
    const totalPages = Math.ceil(records.length / RECORDS_PER_PAGE);
    const start = (page - 1) * RECORDS_PER_PAGE;
    const pageRecords = records.slice(start, start + RECORDS_PER_PAGE);

    // --- Select Menu ---
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('morgue_select')
        .setPlaceholder(`Select a record (page ${page}/${totalPages})`);

    for (const record of pageRecords) {
        const label = `${record.caseId} — ${record.name}`.slice(0, 100);
        selectMenu.addOptions({
            label,
            value: record.firebaseKey,
        });
    }

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    // --- Navigation Buttons ---
    const buttons = [];

    buttons.push(
        new ButtonBuilder()
            .setCustomId('morgue_prev')
            .setLabel('◀ Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page <= 1)
    );

    buttons.push(
        new ButtonBuilder()
            .setCustomId('morgue_page')
            .setLabel(`Page ${page}/${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
    );

    buttons.push(
        new ButtonBuilder()
            .setCustomId('morgue_next')
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages)
    );

    const buttonRow = new ActionRowBuilder().addComponents(buttons);

    return { selectRow, buttonRow, totalPages };
}

/**
 * Build the initial embed for the search results page
 */
function buildSearchEmbed(records, page, query) {
    const totalPages = Math.ceil(records.length / RECORDS_PER_PAGE);
    const start = (page - 1) * RECORDS_PER_PAGE;
    const pageRecords = records.slice(start, start + RECORDS_PER_PAGE);

    const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('Morgue Record Search')
        .setDescription(
            query
                ? `Showing results for: **${query}**`
                : 'Showing all morgue records'
        )
        .addFields(
            { name: 'Total Records', value: String(records.length), inline: true },
            { name: 'Page', value: `${page}/${totalPages}`, inline: true },
            { name: 'Records Shown', value: String(pageRecords.length), inline: true },
        )
        .setFooter({ text: 'Use the menu below to view a record' })
        .setTimestamp();

    if (pageRecords.length > 0) {
        const list = pageRecords
            .map(r => `\`#${r.caseId}\` **${r.name}** — ${r.location || 'Unknown location'}`)
            .join('\n');
        embed.addFields({ name: 'Records', value: list.slice(0, 1024), inline: false });
    } else {
        embed.addFields({ name: 'Records', value: 'No records found.', inline: false });
    }

    return embed;
}

export {
    RECORDS_PER_PAGE,
    buildRecordEmbed,
    buildSearchComponents,
    buildSearchEmbed,
};
