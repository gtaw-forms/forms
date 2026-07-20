import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } from 'discord.js';
import firebase from '../services/firebase.js';
import { getForumClient } from '../services/forumClient.js';
import { reassignME } from '../services/autopsyRotation.js';

export const data = new SlashCommandBuilder()
    .setName('reassign-autopsy')
    .setDescription('Reassign autopsy cases via interactive menu');

/** Load ME names from the Firebase rotation list */
async function getMeNames(db) {
    try {
        const snap = await db.ref('autopsy-requests/rotation/list').once('value');
        const list = snap.val();
        if (Array.isArray(list) && list.length > 0) return list;
    } catch (e) {
        console.warn('[CMD] reassign: could not load rotation list:', e.message);
    }
    // Fallback
    return ['Anne Carter', 'Arthur Blackwood', 'Alyson Frost', 'Sarah Bell', 'Eun Jae', 'Edward Baskin'];
}

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can reassign cases.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    firebase.init();
    const db = firebase.db;

    try {
        const allSnap = await db.ref('autopsy-requested').once('value');
        const allEntries = allSnap.val() || {};

        // Debug: log total entries
        let hasAssigned = 0, hasTitle = 0, isAutopsy = 0, notCompleted = 0;
        const activeCases = [];
        for (const [topicId, entry] of Object.entries(allEntries)) {
            if (entry.assignedTo) hasAssigned++;
            if (entry.title) hasTitle++;
            if (entry.title && entry.title.toLowerCase().includes('autopsy request')) isAutopsy++;
            if (!entry.completedAt) notCompleted++;
            if (entry.assignedTo && !entry.completedAt && entry.title && entry.title.toLowerCase().includes('autopsy request')) {
                activeCases.push({ topicId, ...entry });
            }
        }
        console.log(`[CMD] reassign: entries=${Object.keys(allEntries).length} assigned=${hasAssigned} title=${hasTitle} autopsyTitle=${isAutopsy} notCompleted=${notCompleted} matched=${activeCases.length}`);

        if (activeCases.length === 0) {
            await interaction.editReply({ content: `No active assigned cases found. (${Object.keys(allEntries).length} total entries, ${hasAssigned} assigned)` });
            return;
        }

        const options = activeCases.slice(0, 25).map(c => {
            const oocM = (c.title || '').match(/\(\(\s*(.*?)\s*\)\)/);
            const oocLabel = oocM ? `((${oocM[1]}))` : '?';
            const label = `${c.assignedTo || '?'} — ${oocLabel}`.substring(0, 100);
            return { label, description: (c.title || '').substring(0, 100), value: String(c.topicId) };
        });

        // Validate no duplicate values
        const seen = new Set();
        options.forEach(o => {
            if (seen.has(o.value)) console.warn(`[CMD] reassign: DUPLICATE value: ${o.value}`);
            seen.add(o.value);
        });

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('reassign_case_pick')
                    .setPlaceholder('Select a case to reassign...')
                    .addOptions(options)
            );

        await interaction.editReply({
            content: 'Select a case to reassign:',
            components: [row],
        });
    } catch (err) {
        console.error('[CMD] reassign-autopsy error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}

/**
 * Handle the case selection from the reassign menu.
 * Shows a second menu to pick the new ME.
 */
export async function onCasePick(interaction) {
    const topicId = interaction.values[0];
    firebase.init();
    const db = firebase.db;
    const meNames = await getMeNames(db);
    const row = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('reassign_me_pick_' + topicId)
                .setPlaceholder('Select new ME...')
                .addOptions(meNames.map(name => ({
                    label: name,
                    value: name,
                })))
        );

    await interaction.update({
        content: `Selected topic #${topicId}. Now pick the new ME:`,
        components: [row],
    });
}

/**
 * Handle the ME selection — perform the actual reassignment.
 */
export async function onMePick(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can reassign cases.', flags: MessageFlags.Ephemeral });
        return;
    }

    const customId = interaction.customId; // reassign_me_pick_<topicId>
    const topicId = customId.replace('reassign_me_pick_', '');
    const newME = interaction.values[0];

    await interaction.deferUpdate();

    firebase.init();
    const db = firebase.db;

    try {
        // Get the entry from Firebase
        const entrySnap = await db.ref(`autopsy-requested/${topicId}`).once('value');
        const entry = entrySnap.val() || {};
        const currentAssigned = entry.assignedTo || 'UNASSIGNED';

        if (currentAssigned.toLowerCase() === newME.toLowerCase()) {
            await interaction.editReply({ content: `Already assigned to **${newME}**.`, components: [] });
            return;
        }

        // Extract OOC name — try caseTitle first, fall back to request title
        const oocMatch = (entry.caseTitle || entry.title || '').match(/\(\(\s*(.*?)\s*\)\)/);
        const oocName = oocMatch ? oocMatch[1] : null;

        // Try stored caseTopicId first (most reliable — avoids forum search)
        let topicIdNum = entry.caseTopicId || null;
        let oldTitle = entry.caseTitle || null;

        // Fall back to forum search if no stored caseTopicId
        if (!topicIdNum || !oldTitle) {
            if (oocName) {
                const searchClient = getForumClient();
                await searchClient.ensureBrowser();
                await searchClient.login(process.env.FORUM_USERNAME, process.env.FORUM_PASSWORD, { baseUrl: process.env.FORUM_BASE_URL });
                const caseResults = await searchClient.searchForum(`((${oocName}))`, 266, { baseUrl: process.env.FORUM_BASE_URL });
                const caseTopic = caseResults.find(t => t.title && t.title.includes('Case'));
                if (caseTopic) {
                    topicIdNum = caseTopic.topicId;
                    oldTitle = caseTopic.title;
                }
            }
        }

        if (!topicIdNum || !oldTitle) {
            await interaction.editReply({ content: `Could not find case topic in f=266 for this request.`, components: [] });
            return;
        }

        // Build new title
        let newTitle;
        if (oldTitle.includes('- UNASSIGNED')) {
            newTitle = oldTitle.replace('- UNASSIGNED', `- ${newME}`);
        } else {
            const lastDash = oldTitle.lastIndexOf(' - ');
            newTitle = lastDash > 3 ? oldTitle.substring(0, lastDash + 3) + newME : `- ${newME}`;
        }

        // Update forum
        const client = getForumClient();
        await client.ensureBrowser();
        await client.login(process.env.FORUM_USERNAME, process.env.FORUM_PASSWORD, { baseUrl: process.env.FORUM_BASE_URL });
        await client.editTopicTitle(topicIdNum, 266, newTitle, { baseUrl: process.env.FORUM_BASE_URL });

        // Update Firebase
        await db.ref(`autopsy-requested/${topicId}/assignedTo`).set(newME);

        // Update active case counts in the rotation tracker
        // Handles decrementing old ME and incrementing new ME
        // Pass null for oldName when it was never assigned (skip decrement)
        await reassignME(db, entry.assignedTo || null, newME, topicId).catch(err => {
            console.warn(`[CMD] reassign: rotation tracking error: ${err.message}`);
        });

        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('Autopsy Case Reassigned')
            .setDescription(`**${newME}** assigned to **${oocName || topicId}**.`)
            .addFields(
                { name: 'Previous', value: currentAssigned, inline: true },
                { name: 'New', value: newME, inline: true },
                { name: 'Topic', value: `[View Case](<${process.env.FORUM_BASE_URL}/viewtopic.php?t=${topicIdNum}>)`, inline: false }
            )
            .setFooter({ text: `Reassigned by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.editReply({ content: null, embeds: [embed], components: [] });
    } catch (err) {
        console.error('[CMD] reassign-autopsy error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}`, components: [] });
    }
}
