import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { isOwnerOrWhitelisted } from '../services/permissions.js';
import firebase from '../services/firebase.js';

// Demo mass-completion: fabricates one FAKE autopsy report per open body of a
// mass collection and queues them through the REAL completion pipeline
// (matching, per-body marking, batched send, requester DM). Test-only: every
// BBCode block is bannered TEST DATA, DMs go to the request topic poster.
// The request thread, case thread, panel message and DM are all deletable
// after the run. Requires maintenance mode OFF (queue must be live).
function demoBbcode(body, i, N, me) {
    const name = body.name || 'Unknown';
    const ooc = body.oocName || 'Unknown OOC';
    return `[divbox=white][center][b][size=150]DEMO AUTOPSY REPORT — TEST DATA ONLY[/size][/b][/center]
[hr][/hr]
[b]Decedent:[/b] ${name} ((${ooc}))
[b]Body:[/b] ${i + 1}/${N}
[b]Examiner:[/b] ${me || 'Unassigned'}
[b]Findings (fabricated):[/b]
[list][*]Cause of death: demo cardiac event (fabricated)
[*]Manner of death: demo natural (fabricated)
[*]Toxicology: demo negative (fabricated)[/list]
[b]Opinion:[/b] This is a fabricated demo report for mass-autopsy pipeline testing. No real examination performed.
[i]Performed by ${me || 'demo ME'} — Carcer Way, Strawberry Avenue, Los Santos, SA[/i][/divbox]`;
}

export const data = new SlashCommandBuilder()
    .setName('demo-mass-complete')
    .setDescription('Queue FAKE autopsy completions for every open body of a mass request (owner only)')
    .addStringOption((opt) =>
        opt.setName('request')
            .setDescription('Request topic id in autopsy-requested (e.g. 10161)')
            .setRequired(true));

export async function execute(interaction) {
    if (!isOwnerOrWhitelisted(interaction)) {
        await interaction.reply({ content: 'Only the bot owner can run this.', flags: MessageFlags.Ephemeral });
        return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    firebase.init();
    const db = firebase.db;
    const requestId = interaction.options.getString('request').trim();

    try {
        const snap = await db.ref(`autopsy-requested/${requestId}`).once('value');
        const entry = snap.val();
        if (!entry) {
            await interaction.editReply({ content: `No autopsy-requested/${requestId} found.` });
            return;
        }
        if (entry.isMassSingleThread !== true || !entry.cases) {
            await interaction.editReply({ content: `#${requestId} is not a single-thread mass collection.` });
            return;
        }
        const idxs = Object.keys(entry.cases).filter((k) => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
        const open = idxs.filter((i) => entry.cases[String(i)] && !entry.cases[String(i)].completedAt);
        if (open.length === 0) {
            await interaction.editReply({ content: `All bodies of #${requestId} are already completed.` });
            return;
        }

        const authorId = `demo_${interaction.user.id}`;
        const now = Date.now();
        const queued = [];
        for (const i of open) {
            const body = entry.cases[String(i)];
            const me = body.assignedTo || 'Alyson Frost';
            const key = `DEMO_mass_${requestId}_${i}_${now}`;
            const title = `Case ${entry.caseNum || '?'} - ${body.name || 'Unknown'} ((${body.oocName || 'Unknown OOC'})) [DEMO]`;
            await db.ref(`scheduledReports/${authorId}/${key}`).set({
                formId: 'autopsy',
                hasdeployed: false,
                deployStatus: 'pending',
                originalKey: title,
                title,
                timestamp: now,
                data: {
                    decedentName: body.name || 'Unknown',
                    decedentOOC: body.oocName || 'Unknown OOC',
                    coronerEmployee: me,
                    department: 'PHMC - Forensic Medicine',
                    deathType: 'PK',
                },
            });
            await db.ref(`scheduledReportsBBCode/${authorId}/${key}`).set({
                bbCode: demoBbcode(body, i, idxs.length, me),
            });
            queued.push(`Body ${i + 1}/${idxs.length}: ${body.name} ((${body.oocName})) → ${me}`);
        }

        const embed = new EmbedBuilder()
            .setColor(0xffc107)
            .setTitle('Demo Mass Completion Queued')
            .setDescription([
                `**Request:** \`autopsy-requested/${requestId}\` → case thread #${entry.caseTopicId || '?'}`,
                `**Queued ${queued.length} fake report(s)** (author \`${authorId}\`):`,
                ...queued.map((q) => `• ${q}`),
                '',
                '_Fake BBCode is bannered TEST DATA ONLY. Watch the queue deploy, then delete the demo rows + forum posts._',
            ].join('\n'))
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[CMD] demo-mass-complete error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}
