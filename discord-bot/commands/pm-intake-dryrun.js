import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } from 'discord.js';
import { isOwnerOrWhitelisted } from '../services/permissions.js';

export const data = new SlashCommandBuilder()
    .setName('pm-intake-dryrun')
    .setDescription('TEST ONLY: simulate PM intake — shows case BBCode + ME picks, posts nothing')
    .addStringOption(opt =>
        opt.setName('pm_id')
            .setDescription('LSPD inbox PM id (p= number)')
            .setRequired(true));

export async function execute(interaction) {
    if (!isOwnerOrWhitelisted(interaction)) {
        await interaction.reply({ content: 'Only the bot owner can run intake dry-runs.', flags: MessageFlags.Ephemeral });
        return;
    }

    const msgId = interaction.options.getString('pm_id').trim();
    if (!/^\d+$/.test(msgId)) {
        await interaction.reply({ content: '[ERR] pm_id must be the numeric PM id.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const { createIsolatedClient } = await import('../services/forumClient.js');
        const { parsePrivateAutopsyPm, buildIntakeCaseBbcode, previewIntakeAssignments } = await import('../services/privateAutopsyPmMonitor.js');
        const firebase = (await import('../services/firebase.js')).default;

        const baseUrl = (process.env.FORUM_LSPD_URL || 'https://lspd.gta.world').replace(/\/$/, '');
        const client = createIsolatedClient('lspd-pm-dryrun');
        try {
            await interaction.editReply({ content: '[CHECK] Logging in to the LSPD forum...' });
            await client.login(process.env.FORUM_LSPD_USERNAME, process.env.FORUM_LSPD_PASSWORD, { force: true, baseUrl });

            await interaction.editReply({ content: '[CHECK] Reading PM...' });
            const read = await client.readPrivateMessage(msgId, { baseUrl });
            if (!read) {
                await interaction.editReply({ content: `[ERR] Could not read PM p=${msgId}.` });
                return;
            }

            const parsed = parsePrivateAutopsyPm(read.bodyText);
            if (parsed.bodies.length === 0) {
                await interaction.editReply({ content: `[WARN] No addenda parsed in PM p=${msgId}.` });
                return;
            }

            await interaction.editReply({ content: `[CHECK] Simulating ${parsed.bodies.length} case(s) against live rotation...` });
            firebase.init();
            const mes = await previewIntakeAssignments(firebase.db, parsed.bodies.length);

            const pm = { msgId, subject: read.subject || '(unknown subject)', sender: read.sender || '(unknown sender)' };
            const files = parsed.bodies.map((b, i) => {
                const bbcode = buildIntakeCaseBbcode(pm, b, parsed.cover.cfNo);
                const safeOoc = (b.decedent.oocName || b.decedent.name).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().slice(0, 30) || 'body';
                return { bbcode, name: `intake_${msgId}_${b.label}_${safeOoc}.txt`, body: b, me: mes[i] };
            });

            const embed = new EmbedBuilder()
                .setColor(0x9b59b6)
                .setTitle(`[DRY RUN] PM p=${msgId} — ${parsed.bodies.length} private case(s), nothing posted`)
                .setDescription([
                    `**From:** ${pm.sender}`,
                    `**Subject:** ${pm.subject}`,
                    parsed.cover.cfNo ? `**CF No:** ${parsed.cover.cfNo}` : null,
                    `**Delivery (live):** completion PMs to **${pm.sender}** on LSPD`,
                ].filter(Boolean).join('\n'))
                .addFields(files.map((f) => ({
                    name: `${f.body.label} — ${f.body.decedent.name}${f.body.decedent.oocName ? ` ((${f.body.decedent.oocName}))` : ' (OOC unknown)'}`,
                    value: `**PK/CK:** ${f.body.pkck || 'unknown'} — **ME:** ${f.me}\nBBCode attached: \`${f.name}\``,
                    inline: false,
                })))
                .setFooter({ text: `Dry run by ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({
                content: `[DONE] Dry run complete — ${files.length} BBCode file(s) attached, zero forum posts.`,
                embeds: [embed],
                files: files.map((f) => new AttachmentBuilder(Buffer.from(f.bbcode, 'utf-8'), { name: f.name })),
            });
        } finally {
            await client.close().catch(() => {});
        }
    } catch (err) {
        console.error('[CMD] pm-intake-dryrun error:', err.message);
        await interaction.editReply({ content: `[ERR] Dry run failed: ${err.message}` });
    }
}
