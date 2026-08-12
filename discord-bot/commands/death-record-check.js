import {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('death-record-check')
    .setDescription('Scan CK reports by date, match against morgue, and draft death records')
    .addStringOption(option =>
        option.setName('date')
            .setDescription('Filter by date of death (DD/MMM/YYYY, e.g. 30/JUN/2026)')
            .setRequired(false))
    .addStringOption(option =>
        option.setName('from')
            .setDescription('Scan from this date onward (DD/MMM/YYYY, e.g. 20/JUL/2026)')
            .setRequired(false));

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({
            content: 'Only the bot owner can run this command.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const dateStr = interaction.options.getString('date');
    const fromStr = interaction.options.getString('from');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const { default: firebase } = await import('../services/firebase.js');
        firebase.init();
        const db = firebase.db;

        const { scanAndDraftCKs } = await import('../services/deathRecordDraft.js');

        // Build description based on filter type
        let confirmMsg;
        if (dateStr) {
            confirmMsg = `Scanning CK coroner reports with date of death **${dateStr}**...`;
        } else if (fromStr) {
            confirmMsg = `Scanning CK coroner reports from **${fromStr}** to present...`;
        } else {
            confirmMsg = 'Scanning **all** CK coroner reports across both paths... This may take a while.';
        }
        await interaction.editReply({ content: confirmMsg });

        const results = await scanAndDraftCKs(db, { date: dateStr || undefined, dateFrom: fromStr || undefined });

        const fields = [
            { name: 'CK Reports Found', value: String(results.total), inline: true },
            { name: 'Already Had Drafts', value: String(results.alreadyExists), inline: true },
            { name: 'New Drafts Created', value: String(results.drafted), inline: true },
        ];

        if (results.drafted > 0) {
            fields.push(
                { name: 'Matched by Name', value: String(results.nameMatched), inline: true },
                { name: 'Matched by Date', value: String(results.dateMatched), inline: true },
                { name: 'No Morgue Match', value: String(results.noMatch), inline: true },
            );
        }

        if (results.errors.length > 0) {
            const errorList = results.errors.slice(0, 5).map(e => `\`${e.slice(0, 80)}\``).join('\n');
            fields.push({
                name: `Errors (${results.errors.length})`,
                value: errorList + (results.errors.length > 5 ? `\n...and ${results.errors.length - 5} more` : ''),
                inline: false,
            });
        }

        let description = dateStr
            ? `Scanned reports with date of death **${dateStr}**`
            : (fromStr
                ? `Scanned reports from **${fromStr}** to present`
                : 'Scanned all CK reports');
        if (results.drafted > 0) {
            description += `\nDraft(s) sent to <#${process.env.DEATH_RECORD_DRAFT_CHANNEL_ID || 'Death Record Drafts'}>. Approve or deny them there.`;
        } else if (results.total === 0) {
            description += '\nNo matching CK reports found for that date.';
        } else {
            description += '\nAll matching CK reports already have drafts.';
        }

        const color = results.errors.length > 0 ? 0xffc107
            : results.drafted > 0 ? 0x28a745
            : 0x007bff;

        const embed = new EmbedBuilder()
            .setTitle('Death Record Scan Complete')
            .setColor(color)
            .setDescription(description)
            .addFields(fields)
            .setFooter({ text: `/${interaction.commandName}${dateStr ? ' date:' + dateStr : fromStr ? ' from:' + fromStr : ''}` })
            .setTimestamp();

        await interaction.editReply({ content: null, embeds: [embed] });

        console.log(`[CMD] /death-record-check${dateStr ? ' date:'+dateStr : ''} — ${results.drafted} drafted, ${results.alreadyExists} existing, ${results.nameMatched} name-match, ${results.dateMatched} date-match, ${results.noMatch} no-match, ${results.errors.length} errors`);
    } catch (err) {
        console.error('[CMD] ❌ death-record-check error:', err.message);
        await interaction.editReply({
            content: `Error: ${err.message.slice(0, 300)}`,
        });
    }
}
