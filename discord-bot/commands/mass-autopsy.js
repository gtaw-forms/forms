import { SlashCommandBuilder, EmbedBuilder, MessageFlags, AttachmentBuilder } from 'discord.js';
import firebase from '../services/firebase.js';
import { getForumClient } from '../services/forumClient.js';
import { parseMassAutopsyBbcode, executeMassAutopsy } from '../services/massAutopsy.js';

export const data = new SlashCommandBuilder()
    .setName('mass-autopsy')
    .setDescription('Create multiple autopsy cases from a multi-body BBCode file, distributed round-robin')
    .addAttachmentOption(opt =>
        opt.setName('bbc')
            .setDescription('.txt file with the multi-body autopsy BBCode')
            .setRequired(true))
    .addStringOption(opt =>
        opt.setName('requester')
            .setDescription('Requester forum name (used in completion template)')
            .setRequired(false))
    .addBooleanOption(opt =>
        opt.setName('dryrun')
            .setDescription('Simulate without posting (default: true)')
            .setRequired(false));

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can run mass autopsies.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const bbAttachment = interaction.options.getAttachment('bbc');
    const requesterName = interaction.options.getString('requester') || '';
    const dryRun = interaction.options.getBoolean('dryrun') ?? true;
    const PHMC_BASE = 'https://phmc.gta.world';

    if (!bbAttachment) {
        await interaction.editReply({ content: 'No BBCode file provided.' });
        return;
    }

    firebase.init();
    const db = firebase.db;

    try {
        // ── Fetch and parse BBCode ──
        await interaction.editReply({ content: 'Downloading and parsing BBCode...' });

        const resp = await fetch(bbAttachment.url);
        const bbcode = await resp.text();

        const bodies = parseMassAutopsyBbcode(bbcode);

        if (bodies.length === 0) {
            await interaction.editReply({ content: 'No valid body sections found. Each body must start with `1.) Name:` including OOC name in brackets `((OOC Name))`.' });
            return;
        }

        if (bodies.length > 50) {
            await interaction.editReply({ content: `Too many bodies (${bodies.length}). Maximum is 50 per run.` });
            return;
        }

        const missingOoc = bodies.filter(b => !b.oocName);
        if (missingOoc.length > 0) {
            await interaction.editReply({ content: `The following bodies are missing OOC names (require ((OOC Name)) after the name):\n${missingOoc.map(b => `- ${b.name}`).join('\n')}` });
            return;
        }

        // ── Setup forum client ──
        await interaction.editReply({ content: `Parsed **${bodies.length}** bod${bodies.length > 1 ? 'ies' : 'y'}. ${dryRun ? '[DRY RUN]' : 'Connecting to forum...'}` });

        const client = getForumClient();
        await client.ensureBrowser();
        await client.login(null, null, { force: true, baseUrl: PHMC_BASE });

        // ── Execute ──
        await interaction.editReply({ content: `Processing ${bodies.length} bod${bodies.length > 1 ? 'ies' : 'y'} across rotation...` });

        const results = await executeMassAutopsy(db, client, bodies, { dryRun, requesterName, baseUrl: PHMC_BASE });

        // ── Build summary ──
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        const lines = results.map((r) => {
            const icon = r.success ? (dryRun ? '[DRY]' : '[OK]') : '[FAIL]';
            const me = r.assignedTo ? ` -> ${r.assignedTo}` : '';
            const err = r.error ? ` — ${r.error}` : '';
            return `${icon} Case #${r.caseNum}: ${r.name} ((${r.oocName}))${me}${err}`;
        });

        // Build BBCode attachment for dry-run (first body only, as .txt file)
        const attachments = [];
        if (dryRun && results.length > 0) {
            const first = results[0];
            const safeName = first.oocName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() || 'body';
            attachments.push(
                new AttachmentBuilder(Buffer.from(first.initialContent, 'utf-8'), { name: `case_${first.caseNum}_${safeName}.txt` })
            );
        }

        const requesterLine = requesterName ? `\nRequester: ${requesterName}` : '';

        const embed = new EmbedBuilder()
            .setColor(failCount === 0 ? 0x28a745 : failCount === results.length ? 0xdc3545 : 0xffc107)
            .setTitle(dryRun ? '[DRY RUN] Mass Autopsy Results' : 'Mass Autopsy Results')
            .setDescription([
                `**${successCount}** of **${results.length}** bod${results.length > 1 ? 'ies' : 'y'} processed.${requesterLine}`,
                failCount > 0 ? `**${failCount}** failed.` : '',
                dryRun ? '\n_First body BBCode attached as .txt — run with `dryrun:false` to post live._' : '',
                '',
                ...lines,
            ].filter(Boolean).join('\n'))
            .setFooter({ text: `Mass autopsy by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.editReply({ content: null, embeds: [embed], files: attachments });
    } catch (err) {
        console.error('[CMD] mass-autopsy error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}
