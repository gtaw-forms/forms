import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { isSupervisorUp } from '../services/permissions.js';

export const data = new SlashCommandBuilder()
    .setName('background')
    .setDescription('Look up an applicant background check on the LSPD forum (read-only)')
    .addStringOption(opt =>
        opt.setName('name')
            .setDescription('Applicant name to search for (e.g. Jane Doe)')
            .setRequired(true)
            .setMinLength(3)
            .setMaxLength(60));

const STEP_TIMEOUT_MS = 120000;

export async function execute(interaction) {
    if (!isSupervisorUp(interaction)) {
        await interaction.reply({ content: 'Only Supervisors and up can check background checks.', flags: MessageFlags.Ephemeral });
        return;
    }

    const name = interaction.options.getString('name').trim();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Progress steps ACCUMULATE in a single message: each step edits the
    // deferred reply to append the new line (Step 1 / Step 1+2 / ...), so the
    // user sees one growing checklist, never a wall of messages.
    const steps = [];
    const say = async (text) => {
        steps.push(text);
        try { await interaction.editReply({ content: steps.join('\n').slice(0, 1900) }); } catch { /* best effort */ }
    };

    try {
        const { lookupBackgroundCheck } = await import('../services/lspdBackground.js');
        console.log(`[CMD] background: "${name}" requested by ${interaction.user.tag}`);

        let timedOut = false;
        const timer = setTimeout(async () => {
            timedOut = true;
            await say(`[WAIT] Still working on "${name}" — the forum is slow. I will post the result when it lands...`);
        }, STEP_TIMEOUT_MS);

        let result;
        try {
            result = await lookupBackgroundCheck(name, async (step) => {
                if (!timedOut) await say(`[CHECK] ${step}`);
            });
        } finally {
            clearTimeout(timer);
        }

        steps.push(`[DONE] Lookup finished for "${name}".`);
        await interaction.editReply({ content: steps.join('\n').slice(0, 1900), embeds: [buildEmbed(name, result, interaction)] });
    } catch (err) {
        console.error('[CMD] background error:', err.message);
        await interaction.editReply({ content: `[ERR] Background check failed: ${err.message}` });
    }
}

function buildEmbed(name, result, interaction) {
    const color = result.verdict === 'completed' ? 0x28a745 : result.verdict === 'pending' ? 0xf39c12 : 0x6c757d;
    const title = result.verdict === 'completed'
        ? `Background Check — COMPLETED: ${name}`
        : result.verdict === 'pending'
            ? `Background Check — PENDING: ${name}`
            : `Background Check — NOT FOUND: ${name}`;

    const embed = new EmbedBuilder().setColor(color).setTitle(title).setTimestamp()
        .setFooter({ text: `Requested by ${interaction.user.tag}` });

    if (result.verdict === 'not_found') {
        const hint = result.matches.length > 0
            ? `Found ${result.matches.length} mention(s) but none parsed as a request or summary — links below.`
            : 'No request for this name exists in the LSPD topic. Check the spelling and try again (search is exact-keyword; very fresh posts may lag the index).';
        embed.setDescription(`${hint}\n\n[Topic](${result.topicUrl})`);
    }

    const show = [...result.summaries, ...result.requests].slice(0, 6);
    for (const m of show) {
        const lines = [];
        // Applicant first — every block states who the record is for so a
        // neighboring post from the same page can never be mistaken for the subject.
        lines.push(`**Applicant:** ${m.request?.applicant || name}`);
        if (m.author) lines.push(`**By:** ${m.author}${m.date ? ` — ${m.date}` : ''}`);
        if (m.isSummary && m.quoteAuthor) lines.push(`**Reply to:** ${m.quoteAuthor}`);
        if (m.request?.employee) lines.push(`**Employee:** ${m.request.employee}${m.request.serial ? ` (${m.request.serial})` : ''}`);
        if (m.request?.reason) lines.push(`**Reason:** ${m.request.reason}`);
        if (m.licenseStatus) lines.push(`**License:** ${m.licenseStatus}`);
        if (m.recordLines?.length > 0) lines.push(...m.recordLines.map((l) => `**${l}**`));
        lines.push(`[Jump to post](${m.url})`);
        embed.addFields({
            name: m.isSummary ? `Completed — ${m.author || 'LSPD'}` : `Request — ${m.author || 'unknown'}`,
            value: lines.join('\n').slice(0, 1024),
            inline: false,
        });
    }

    if (result.matches.length > show.length) {
        embed.addFields({
            name: 'More matches',
            value: `${result.matches.length - show.length} additional mention(s) not shown. [Open the topic](${result.topicUrl})`,
            inline: false,
        });
    } else if (result.verdict !== 'not_found') {
        embed.addFields({ name: 'Topic', value: `[Open the background-check topic](${result.topicUrl})`, inline: false });
    }

    return embed;
}
