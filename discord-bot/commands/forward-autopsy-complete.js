import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import firebase from '../services/firebase.js';
import { getDiscordId } from '../services/meDiscordNotify.js';
import { buildCompletionPayload, resolveRequesterPing, sendRequesterWebhook, getFactionWebhookUrl } from '../services/requesterWebhook.js';
import { getAgencyForum, isAgencyFaction } from '../services/agencyForums.js';

/**
 * /forward-autopsy-complete — manually send (or re-send) the requester
 * completion webhook for an autopsy case through the REAL faction webhook.
 *
 * Unlike the automatic completion flow this command IGNORES TEST_MODE: its
 * whole purpose is delivering to the live LSSD/SADCR/DAO channels on demand —
 * e.g. recovering a missed notification, retro-fitting a case completed
 * before this feature existed, or re-sending after fixing data.
 *
 * Destination precedence:
 *   1. Explicit `webhook` option override (owner-provided URL)
 *   2. The REAL faction webhook var (AUTOPSY_REQUESTER_WEBHOOK_<FACTION>)
 *      — test mode is bypassed; blank var = refused with an explanation.
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

export const data = new SlashCommandBuilder()
    .setName('forward-autopsy-complete')
    .setDescription('Send/re-send the completion webhook via the REAL faction webhook (owner only — ignores test mode)')
    .addStringOption(opt =>
        opt.setName('case')
            .setDescription('Case number, topic id, or title fragment (e.g. 497, 10023, Bradley)')
            .setRequired(true))
    .addStringOption(opt =>
        opt.setName('faction')
            .setDescription('Override destination faction (defaults to the request\'s own faction)')
            .addChoices(
                { name: 'LSSD', value: 'LSSD' },
                { name: 'SADCR', value: 'SADCR' },
                { name: 'DAO', value: 'DAO' },
                { name: 'LSPD', value: 'LSPD' },
            ))
    .addStringOption(opt =>
        opt.setName('me')
            .setDescription('ME to attribute (defaults to the case assignedTo)')
            .setRequired(false))
    .addStringOption(opt =>
        opt.setName('webhook')
            .setDescription('Explicit webhook URL override (rarely needed — faction URLs live in .env)')
            .setRequired(false));

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can forward completions.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const caseQuery = interaction.options.getString('case').trim();
    const factionOverride = interaction.options.getString('faction');
    const meOverride = interaction.options.getString('me')?.trim() || null;
    const webhookOverride = interaction.options.getString('webhook')?.trim() || null;

    firebase.init();
    const db = firebase.db;

    try {
        const found = await resolveCase(db, caseQuery);
        if (!found) {
            await interaction.editReply({ content: `No case found matching "${caseQuery}" in autopsy-requested. Use a case number, topic id, or title fragment.` });
            return;
        }
        const { topicId, entry } = found;

        const factionKey = String(factionOverride || entry.faction || '').toUpperCase();
        if (!factionKey) {
            await interaction.editReply({ content: `Case has no resolvable faction and no faction override was given. Pass \`faction\` explicitly.` });
            return;
        }

        // ── Resolve destination: explicit override > REAL faction URL (test mode bypassed) ──
        let url = webhookOverride || null;
        let destLabel = 'owner-provided override';
        if (!url) {
            const resolved = getFactionWebhookUrl(factionKey, { ignoreTestMode: true });
            url = resolved.url;
            destLabel = `\`${resolved.envVar}\`${resolved.url ? '' : ' (BLANK)'}`;
        }
        if (!url) {
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(0xffc107)
                    .setTitle('[WARN] No Real Webhook Configured')
                    .setDescription([
                        `${factionKey} has no active real webhook (\`AUTOPSY_REQUESTER_WEBHOOK_${factionKey}\` blank${isAgencyFaction(factionKey) ? '' : ' and not a registry faction'}).`,
                        '',
                        isAgencyFaction(factionKey)
                            ? 'Add the URL to `.env` (then `pm2 restart phmc-bot`), or pass an explicit `webhook` option.'
                            : `${factionKey} is outside the agency registry — use the \`webhook\` option or pick LSSD/SADCR/DAO.`,
                        '',
                        '_Nothing was sent._',
                    ].join('\n'))],
            });
            return;
        }

        // ── Build the same payload as the automatic flow, with real data ──
        const assigned = meOverride || entry.assignedTo || '';
        const meDiscordId = assigned ? await getDiscordId(db, assigned) : null;
        const ping = await resolveRequesterPing(db, entry);

        const cfgA = isAgencyFaction(factionKey) ? getAgencyForum(factionKey) : null;
        const tid = cfgA ? entry[cfgA.topicField] : null;
        const deepLink = (cfgA && tid) ? `${cfgA.baseUrl}/viewtopic.php?t=${tid}` : null;

        const payload = buildCompletionPayload({
            caseTitle: entry.caseTitle || entry.title || '',
            caseNumber: entry.caseNum ?? '',
            meName: assigned,
            meDiscordId,
            requesterSalutation: ping.salutation,
            requesterDiscordId: ping.discordId,
            factionKey,
            postedByCaselink: entry.postedByCaselink === true,
            agencyTopicUrl: deepLink,
        });

        const ok = await sendRequesterWebhook(url, payload, `manual->${factionKey}`);
        console.log(`[REQ-WEBHOOK] Manual forward by ${interaction.user.username}: ${factionKey} ${entry.caseNum || topicId} -> ${ok ? 'OK (real channel)' : 'FAILED'}`);

        const buttonTarget = payload.components[0].components[0].label + ' → ' + payload.components[0].components[0].url;
        const pingDesc = ping.discordId
            ? `<@${ping.discordId}> (numeric ID)`
            : `**${ping.salutation}** (no numeric mapping — name salutation)`;

        const embed = new EmbedBuilder()
            .setColor(ok ? 0x00bcd4 : 0xe74c3c)
            .setTitle(ok ? 'Completion Webhook Forwarded — REAL Channel' : 'Forward Failed')
            .setDescription(ok ? [
                `**Case:** ${entry.caseTitle || entry.title || topicId}`,
                `**Faction:** ${factionKey}${cfgA ? ` (forum f=${cfgA.forumId})` : ''}`,
                `**Ping:** ${pingDesc}`,
                `**ME:** ${assigned || 'unknown'}${meDiscordId ? ` (<@${meDiscordId}>)` : ''}`,
                `**Button:** \`${buttonTarget}\``,
                `**Destination:** ${destLabel} — \`...${url.slice(-12)}\``,
                '',
                '_Sent to the LIVE faction channel — this message is now visible to their staff._',
            ].join('\n') : [
                `Could not deliver to the ${factionKey} webhook (HTTP error/timeout). Nothing was changed anywhere else.`,
                `**Destination was:** ${destLabel}`,
                '',
                '_Re-run after checking the webhook URL/integration status._',
            ].join('\n'))
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[CMD] forward-autopsy-complete error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}
