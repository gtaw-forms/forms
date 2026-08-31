import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import firebase from '../services/firebase.js';
import { notifyRequesterOfCompletion, getFactionWebhookUrl, isTestMode } from '../services/requesterWebhook.js';

export const data = new SlashCommandBuilder()
    .setName('test-requester-webhook')
    .setDescription('Test the requester completion webhook with a real case (owner only)')
    .addStringOption(opt =>
        opt.setName('case')
            .setDescription('Case number, topic id, or title fragment to pull real data for (e.g. 486, 10021, Bradley)')
            .setRequired(true))
    .addStringOption(opt =>
        opt.setName('faction')
            .setDescription('Force a faction override (LSSD / SADCR / DAO) to preview that faction\'s routing')
            .addChoices(
                { name: 'LSSD', value: 'LSSD' },
                { name: 'SADCR', value: 'SADCR' },
                { name: 'DAO', value: 'DAO' },
            ));

/**
 * Resolve a real autopsy case from the `autopsy-requested` node.
 * Matches by case number, topic id, or a case-title fragment.
 */
async function resolveCase(db, needle) {
    const snap = await db.ref('autopsy-requested').once('value');
    const all = snap.val() || {};
    const q = String(needle).trim().toLowerCase();

    for (const [topicId, e] of Object.entries(all)) {
        if (!e || typeof e !== 'object') continue;
        const caseNum = String(e.caseNum || e.caseNumber || '');
        const caseTitle = e.caseTitle || e.title || '';
        const caseTopicId = String(e.caseTopicId || topicId || '');
        if (
            caseNum.toLowerCase() === q ||
            caseTopicId.toLowerCase() === q ||
            caseTitle.toLowerCase().includes(q)
        ) {
            return { topicId, entry: e };
        }
    }
    return null;
}

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can run this.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const caseQuery = interaction.options.getString('case').trim();
    const factionOverride = interaction.options.getString('faction');

    firebase.init();
    const db = firebase.db;

    try {
        const found = await resolveCase(db, caseQuery);
        if (!found) {
            await interaction.editReply({ content: `No case found matching "${caseQuery}" in autopsy-requested. Use a case number, topic id, or title fragment.` });
            return;
        }
        const { topicId, entry } = found;
        const caseTitle = entry.caseTitle || entry.title || `Case ${topicId}`;
        const caseNum = entry.caseNum || '';
        const caseTopicUrl = entry.caseUrl || null;

        // Routing preview — where THIS send will land
        const routeKey = factionOverride || String(entry.faction || '').toUpperCase();
        const { url: routeUrl, envVar } = getFactionWebhookUrl(routeKey);
        const routingStatus = !routeUrl
            ? `**No webhook configured** (\`${envVar}\` blank) — send would be skipped`
            : (isTestMode()
                ? `[TEST MODE] routed via \`${envVar}\` -> test webhook`
                : `Live faction webhook (\`${envVar}\`)`);

        // Send the FULL real-data notification through the same path as a live completion.
        const res = await notifyRequesterOfCompletion(db, entry, {
            caseNumber: caseNum,
            caseTitle,
            faction: factionOverride || undefined,
            meName: entry.assignedTo || '',
        });

        const embed = new EmbedBuilder()
            .setColor(res.ok ? 0x28a745 : 0xdc3545)
            .setTitle('Test Requester Webhook (real case)')
            .setDescription([
                `**Case:** ${caseTitle}`,
                `**Resolved from:** \`${topicId}\``,
                `**CASELINK posted:** ${entry.postedByCaselink === true ? 'yes' : 'no (webhook gates on this in live flow)'}`,
                `**Requester tag:** ${entry.requesterDiscordTag ? `\`${entry.requesterDiscordTag}\`` : '(not parsed)'}`,
                `**Routing:** ${routingStatus}`,
                '',
                res.ok
                    ? `_Sent the full webhook payload for this real case above_${res.testMode ? ` [TEST -> ${res.target}]` : ''}.`
                    : `_Not sent: ${res.reason || 'unknown'}_`,
            ].join('\n'))
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        await interaction.editReply({ content: `Test failed: ${err.message}` });
    }
}
