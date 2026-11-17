import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } from 'discord.js';
import { isSupervisorUp } from '../services/permissions.js';
import firebase from '../services/firebase.js';
import { getForumClient } from '../services/forumClient.js';
import { reassignME } from '../services/autopsyRotation.js';
import { notifyAssignment } from '../services/meDiscordNotify.js';

export const data = new SlashCommandBuilder()
    .setName('reassign-autopsy')
    .setDescription('Reassign autopsy cases via interactive menu');

/** Load ME names from the Firebase rotation list */
export async function getMeNames(db) {
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
    if (!isSupervisorUp(interaction)) {
        await interaction.reply({ content: 'Only Supervisors and up can reassign cases.', flags: MessageFlags.Ephemeral });
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
            if (entry.assignedTo && !entry.completedAt) {
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
    // Select-menu interactions must be acknowledged within 3 s. Acknowledge
    // first: the DB read + menu build below can be delayed when the event loop
    // is busy with forum work (that timeout was reported as "application
    // didn't respond in time").
    try { await interaction.deferUpdate(); } catch { /* already acknowledged */ }
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

    await interaction.editReply({
        content: `Selected topic #${topicId}. Now pick the new ME:`,
        components: [row],
    });
}

/**
 * Shared reassignment core — used by the slash command's ME picker and by the
 * V2 panels (single + mass), which import it as `performReassign`.
 *
 * Handles one case (top-level entry) or one body of a multi/mass collection
 * (`caseIdx`): resolves the f=266 case topic, retitles it, posts the
 * reassignment notice, updates Firebase, moves the rotation count and pings the
 * new ME. `dryRun` skips every forum/Discord write.
 *
 * @returns {Promise<{ok:boolean, already?:boolean, dryRun?:boolean,
 *   error?:string, currentAssigned?:string, newME?:string,
 *   decedentName?:string, caseUrl?:string}>}
 *
 * `client` is the discord.js client (used to edit the original assignment panel
 * or post a fallback card); `forumClient` is an optional forum-client override
 * used by tests. Both default to the process singletons.
 */
export async function performReassign({
    db,
    client = null,
    forumClient = null,
    topicId,
    caseIdx = null,
    newME,
    basePath = 'autopsy-requested',
    dryRun = false,
} = {}) {
    const name = String(newME || '').trim();
    if (!db || !topicId || !name) return { ok: false, error: 'Missing db, topic or new ME' };

    try {
    const entry = ((await db.ref(`${basePath}/${topicId}`).once('value')).val()) || {};
    const hasCase = caseIdx !== null && caseIdx !== undefined && caseIdx !== '';
    const caseRec = hasCase ? ((entry.cases || {})[String(caseIdx)] || null) : null;
    if (hasCase && !caseRec) return { ok: false, error: `Case ${caseIdx} not found on this request` };

    const currentAssigned = String(caseRec?.assignedTo || entry.assignedTo || 'UNASSIGNED');
    if (currentAssigned.toLowerCase() === name.toLowerCase()) {
        return {
            ok: true, already: true, dryRun, currentAssigned, newME: name,
            decedentName: caseRec?.name || entry.name || topicId,
        };
    }

    const sourceTitle = String(caseRec?.caseTitle || entry.caseTitle || entry.title || '');
    const oocMatch = sourceTitle.match(/\(\(\s*(.*?)\s*\)\)/);
    const oocName = oocMatch ? oocMatch[1] : null;
    let caseTopicId = caseRec?.caseTopicId || entry.caseTopicId || null;
    let oldTitle = sourceTitle || null;

    const forum = forumClient || getForumClient();
    const baseUrl = process.env.FORUM_BASE_URL;

    // Fall back to a forum search only when the stored topic/title is missing.
    if ((!caseTopicId || !oldTitle) && oocName) {
        await forum.ensureBrowser();
        await forum.login(process.env.FORUM_USERNAME, process.env.FORUM_PASSWORD, { baseUrl });
        const results = await forum.searchForum(`((${oocName}))`, 266, { baseUrl });
        const hit = results.find((t) => t.title && t.title.includes('Case'));
        if (hit) { caseTopicId = hit.topicId; oldTitle = hit.title; }
    }
    if (!caseTopicId || !oldTitle) return { ok: false, error: 'Could not find case topic in f=266 for this request' };

    // Replace the ME suffix; "- UNASSIGNED" is the creation-time placeholder.
    let newTitle;
    if (oldTitle.includes('- UNASSIGNED')) {
        newTitle = oldTitle.replace('- UNASSIGNED', `- ${name}`);
    } else {
        const lastDash = oldTitle.lastIndexOf(' - ');
        newTitle = lastDash > 3 ? oldTitle.substring(0, lastDash + 3) + name : `- ${name}`;
    }

    // "Case 472 - Samuel Cerniglia [LSPD] - ME" -> "Samuel Cerniglia"
    const decedentMatch = oldTitle.match(/Case\s+\w+\s*-\s*(.*?)\s*(?:\[|\s*-)/);
    const decedentName = caseRec?.name || (decedentMatch ? decedentMatch[1].trim() : (oocName || topicId));

    if (!dryRun) {
        await forum.ensureBrowser();
        await forum.login(process.env.FORUM_USERNAME, process.env.FORUM_PASSWORD, { baseUrl });
        await forum.editTopicTitle(caseTopicId, 266, newTitle, { baseUrl });

        let newUid = '0';
        try {
            const memberList = await forum.getGroupMembers(50, { baseUrl, exclude: ['PHMC Forms Bot'], paginate: true });
            newUid = memberList.find((m) => m.name.toLowerCase() === name.toLowerCase())?.userId || '0';
        } catch (err) {
            console.warn(`[CMD] reassign: ME member lookup failed: ${err.message}`);
        }
        const reassignBBCode = `[quote="${name}" user_id=${newUid}]\n[/quote]\n\n[b]Reassigned:[/b] [b]${currentAssigned}[/b] → [color=#33D6C0][b]${name}[/b][/color]\n[b]Case:[/b] ${decedentName}`;
        await forum.replyToTopic(caseTopicId, 266, reassignBBCode, { dryRun: false, baseUrl }).catch((err) => {
            console.warn(`[CMD] reassign: reply post failed: ${err.message}`);
        });
    }

    // Per-body state lives under cases/<idx>; single cases at the top level.
    const scope = caseRec ? `${basePath}/${topicId}/cases/${caseIdx}` : `${basePath}/${topicId}`;
    await db.ref(`${scope}/assignedTo`).set(name);
    if (newTitle !== oldTitle) {
        await db.ref(`${scope}/caseTitle`).set(newTitle).catch((err) => {
            console.warn(`[CMD] reassign: caseTitle sync failed: ${err.message}`);
        });
    }

    await reassignME(db, caseRec?.assignedTo || entry.assignedTo || null, name, topicId).catch((err) => {
        console.warn(`[CMD] reassign: rotation tracking error: ${err.message}`);
    });

    if (!dryRun) {
        const caseUrl = `${baseUrl}/viewtopic.php?t=${caseTopicId}`;
        // Prefer editing the ORIGINAL assignment panel in place: it already
        // carries the full context (decedent, case number, deadline, morgue
        // status, links). Only post a fresh assignment card when no panel ref
        // exists or the message is gone.
        let refreshed = false;
        try {
            const { refreshSinglePanelAssignment } = await import('../services/singlePanelV2.js');
            const refreshedRes = await refreshSinglePanelAssignment(db, client, {
                requestTopicId: topicId,
                caseIdx: hasCase ? caseIdx : null,
            });
            refreshed = !!(refreshedRes && refreshedRes.refreshed);
            if (!refreshed) {
                console.log(`[CMD] reassign: panel refresh skipped (${refreshedRes?.reason || 'unknown'}) — posting a full assignment card`);
            }
        } catch (err) {
            console.warn(`[CMD] reassign: panel refresh failed: ${err.message}`);
        }
        if (!refreshed) {
            await notifyAssignment(db, name, decedentName || oldTitle, caseUrl, {
                decedent: caseRec?.name || entry.name || '',
                ooc: caseRec?.oocName || entry.oocName || '',
                caseNumber: caseRec?.caseNum || entry.caseNum || '',
                deathType: caseRec?.deathType || (entry.parsed && entry.parsed.deathType) || entry.deathType || '',
                requestTopicId: topicId,
                caseIdx: hasCase ? caseIdx : null,
                client: client || undefined,
                label: 'Autopsy Case Reassigned',
                embedTitle: '🔬 Autopsy Case Reassigned',
            }).catch((err) => {
                console.warn(`[CMD] reassign: notifyAssignment failed: ${err.message}`);
            });
        }
    }

    return {
        ok: true, already: false, dryRun, currentAssigned, newME: name, decedentName,
        caseUrl: `${baseUrl}/viewtopic.php?t=${caseTopicId}`,
    };
    } catch (err) {
        // Never throw into an interaction handler: a rejected promise after a
        // deferred reply leaves the user on "thinking..." until the token dies.
        console.error('[CMD] reassign core error:', err.message);
        return { ok: false, error: err.message };
    }
}

/**
 * Handle the ME selection from /reassign-autopsy — thunk over performReassign,
 * keeping the command's richer confirmation embed.
 */
export async function onMePick(interaction) {
    if (!isSupervisorUp(interaction)) {
        await interaction.reply({ content: 'Only Supervisors and up can reassign cases.', flags: MessageFlags.Ephemeral });
        return;
    }

    const customId = interaction.customId; // reassign_me_pick_<topicId>
    const topicId = customId.replace('reassign_me_pick_', '');
    const newME = interaction.values[0];

    await interaction.deferUpdate();

    // Give immediate visual feedback — the forum work below takes seconds.
    await interaction.editReply({
        content: `Reassigning topic #${topicId} to **${newME}**... please wait (editing forum title + posting notice).`,
        components: [],
    }).catch(() => {});

    firebase.init();
    const db = firebase.db;

    try {
        const res = await performReassign({ db, client: interaction.client, topicId, newME });

        if (res.already) {
            await interaction.editReply({ content: `Already assigned to **${newME}**.`, components: [] });
            return;
        }
        if (!res.ok) {
            await interaction.editReply({ content: `Error: ${res.error || 'reassign failed'}`, components: [] });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('Autopsy Case Reassigned')
            .setDescription(`**${res.decedentName}** — reassigned from **${res.currentAssigned}** to **${res.newME}**`)
            .addFields(
                { name: 'Previous', value: res.currentAssigned, inline: true },
                { name: 'New', value: res.newME, inline: true },
                { name: 'Topic', value: `[View Case](<${res.caseUrl}>)`, inline: false }
            )
            .setFooter({ text: `Reassigned by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.editReply({ content: null, embeds: [embed], components: [] });
    } catch (err) {
        console.error('[CMD] reassign-autopsy error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}`, components: [] }).catch(() => {});
    }
}
