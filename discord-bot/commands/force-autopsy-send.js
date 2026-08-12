import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import firebase from '../services/firebase.js';
import { getForumClient } from '../services/forumClient.js';
import { clearAssignment } from '../services/autopsyRotation.js';
import { buildCompletionBb } from '../services/completionTemplate.js';

const AUTOPSY_REQUEST_FORUM_ID = 265;
const CASE_MGMT_FORUM_ID = 266;
const PHMC_BASE = 'https://phmc.gta.world';

export const data = new SlashCommandBuilder()
    .setName('force-autopsy-send')
    .setDescription('Force re-send autopsy completion reply + DM + LSSD cross-post')
    .addStringOption(opt =>
        opt.setName('ooc')
            .setDescription('OOC name to search for (e.g. William Smart)')
            .setRequired(true))
    .addStringOption(opt =>
        opt.setName('bbc')
            .setDescription('BBCode for the autopsy report (optional — uses stored if empty)')
            .setRequired(false));

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can run this.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const oocSearch = interaction.options.getString('ooc').trim();
    const manualBb = interaction.options.getString('bbc') || null;

    firebase.init();
    const db = firebase.db;

    try {
        // Find the matching entry
        const allSnap = await db.ref('autopsy-requested').once('value');
        const allEntries = allSnap.val() || {};
        let matched = null;
        let matchedId = null;

        for (const [id, entry] of Object.entries(allEntries)) {
            if (!entry.title || !entry.wasMatch) continue;
            const lower = entry.title.toLowerCase();
            if (lower.includes(oocSearch.toLowerCase()) ||
                (entry.oocName && entry.oocName.toLowerCase().includes(oocSearch.toLowerCase()))) {
                matched = entry;
                matchedId = id;
                break;
            }
        }

        if (!matched) {
            await interaction.editReply({ content: `No request found matching **${oocSearch}**.` });
            return;
        }

        const results = [];
        const client = getForumClient();
        await client.ensureBrowser();
        await client.login(null, null, { force: false, baseUrl: PHMC_BASE });

        // 1. Send completion reply to request topic
        const requesterName = matched.parsed?.requesterName || "Requesting Party";
        const caseTitle = matched.caseUrl || matched.title || "Autopsy Case";
        const completionBb = buildCompletionBb(caseTitle, requesterName, null);

        console.log(`[FORCE-AUTO] Posting completion reply to request topic #${matchedId}...`);
        const replyResult = await client.replyToTopic(matchedId, AUTOPSY_REQUEST_FORUM_ID, completionBb, { dryRun: false, baseUrl: PHMC_BASE });
        results.push(`Completion reply: ${replyResult.ok ? '✅' : '❌ ' + (replyResult.reason || 'failed')}`);

        // 2. Send DM to the forum poster
        const forumUser = await client.getTopicPoster(matchedId, { baseUrl: PHMC_BASE });
        if (forumUser) {
            const dmSubject = matched.title || "Autopsy Request - Completed";

            // Get BBCode — try manual, then stored completedBbCode, then search scheduledReportsBBCode
            let bbCode = manualBb || matched.completedBbCode || null;

            if (!bbCode) {
                // Fallback: search scheduledReports for matching OOC, then fetch BBCode
                try {
                    const reportsSnap = await db.ref('scheduledReports').once('value');
                    if (reportsSnap.exists()) {
                        const entries = [];
                        reportsSnap.forEach((authorSnap) => {
                            const authorId = authorSnap.key;
                            authorSnap.forEach((reportSnap) => {
                                const val = reportSnap.val();
                                const ooc = val?.data?.decedentOOC || val?.decedentOOC || '';
                                if (ooc.toLowerCase().includes(oocSearch.toLowerCase())) {
                                    entries.push({ authorId, reportKey: reportSnap.key });
                                }
                            });
                        });
                        // Fetch BBCode for the first matching entry
                        if (entries.length > 0) {
                            const { authorId, reportKey } = entries[0];
                            console.log(`[FORCE-AUTO] Found matching report: ${authorId}/${reportKey}`);
                            try {
                                const bbSnap = await db.ref(`scheduledReportsBBCode/${authorId}/${reportKey}`).once('value');
                                if (bbSnap.exists()) {
                                    bbCode = bbSnap.val().bbCode || null;
                                }
                            } catch (bbErr) {
                                console.warn(`[FORCE-AUTO] BBCode fetch error: ${bbErr.message}`);
                            }
                        }
                    }
                } catch (scanErr) {
                    console.warn(`[FORCE-AUTO] Report scan error: ${scanErr.message}`);
                }
            }

            if (bbCode) {
                console.log(`[FORCE-AUTO] Sending DM to "${forumUser}"...`);
                try {
                    const dmResult = await client.sendPM(forumUser, dmSubject, bbCode);
                    results.push(`DM to ${forumUser}: ${dmResult.ok ? '✅' : '❌ ' + (dmResult.reason || 'failed')}`);
                } catch (dmErr) {
                    results.push(`DM to ${forumUser}: ❌ ${dmErr.message}`);
                }
            } else {
                results.push('DM: ⏭️ No BBCode found. Provide one via bbc: parameter or submit the report first');
            }
        } else {
            results.push('DM: ⏭️ Could not determine forum poster');
        }

        // 3. LSSD cross-post if applicable
        if (matched.faction === 'LSSD') {
            try {
                const lssdClient = getForumClient();
                await lssdClient.login(process.env.FORUM_LSSD_USERNAME, process.env.FORUM_LSSD_PASSWORD, { force: true, baseUrl: 'https://lssd.gta.world' });
                const lssdResults = await lssdClient.searchForum(`(( ${matched.oocName} ))`, null, { baseUrl: 'https://lssd.gta.world' });
                if (lssdResults.length > 0) {
                    const lssdTopic = lssdResults[0];
                    const lssdReply = await lssdClient.replyToTopic(lssdTopic.topicId, 2263, completionBb, { dryRun: false, baseUrl: 'https://lssd.gta.world' });
                    results.push(`LSSD cross-post: ${lssdReply.ok ? '✅' : '❌ ' + (lssdReply.reason || 'failed')}`);
                } else {
                    results.push('LSSD cross-post: ⏭️ No matching LSSD topic found');
                }
            } catch (lssdErr) {
                results.push(`LSSD cross-post: ❌ ${lssdErr.message}`);
            }
        } else {
            results.push('LSSD cross-post: ⏭️ Not LSSD');
        }

        // Mark Firebase
        await db.ref(`autopsy-requested/${matchedId}/completedAt`).set(new Date().toISOString());
        if (manualBb) await db.ref(`autopsy-requested/${matchedId}/completedBbCode`).set(manualBb);

        // Decrement the ME's active case count in the rotation tracker
        if (matched.assignedTo) {
            clearAssignment(db, matched.assignedTo, matchedId).catch(err => {
                console.warn(`[CMD] force-autopsy-send: rotation tracking error: ${err.message}`);
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('Force Autopsy Send Complete')
            .setDescription(`**${matched.title || oocSearch}**`)
            .addFields({ name: 'Results', value: results.join('\n') })
            .setFooter({ text: `Triggered by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[CMD] force-autopsy-send error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}
