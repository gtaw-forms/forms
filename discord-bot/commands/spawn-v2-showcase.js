import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { isOwnerOrWhitelisted } from '../services/permissions.js';
import firebase from '../services/firebase.js';
import { postMassPanelV2 } from '../services/massPanelV2.js';
import { buildDashboardV2 } from '../services/dashboardV2.js';
import { gatherDashboardData } from '../services/dashboardManager.js';
import { lastActivity, isBrowserActive } from '../services/activityLog.js';
import { selectMEsForMass } from '../services/autopsyRotation.js';

// Dev-showcase channel (dev Discord, NOT prod). Everything V2 we've built
// gets spawned here on demand for visual review.
export const V2_SHOWCASE_CHANNEL_ID = '872558945766633513';

const DUMMY_CASE_URL = 'https://phmc.gta.world/viewtopic.php?t=19999';
const DUMMY_COMPLETION_URL = 'https://phmc.gta.world/viewtopic.php?p=19998#p19998';
const DUMMY_SYNOPSIS = 'SHOWCASE SYNOPSIS: multiple victims recovered from a single-vehicle collision on Hawick Avenue; ballistics pending, no suspects outstanding. Scene was secured and all bodies transported to the county morgue.';
const DUMMY_BODIES = [
    { name: 'John Doe', ooc: 'Mark Smith', sex: 'Male', dateOfDeath: '12/SEP/2026', timeOfDeath: '09:39 PM', deathType: 'CK', location: 'Davis - Innocence Blvd', completed: true, morgue: { found: true, caseId: '8f3k', name: 'John Doe', level: 'high', exactName: true, candidateCount: 1 } },
    { name: 'Jane Doe', ooc: 'Ana Ruiz', sex: 'Female', dateOfDeath: '12/SEP/2026', timeOfDeath: '09:41 PM', deathType: 'CK', location: 'Davis - Innocence Blvd', morgue: { found: true, caseId: '9a1q', name: 'Jane Doe', level: 'low', exactName: false, candidateCount: 3 } },
    { name: 'John Doe', ooc: 'Chris Parnell', sex: 'Male', dateOfDeath: '12/SEP/2026', timeOfDeath: '09:44 PM', deathType: 'PK', location: 'Davis - Grove St', morgue: { found: false } },
    { name: 'Jane Doe', ooc: 'Dana Whitfield', sex: 'Female', dateOfDeath: '12/SEP/2026', timeOfDeath: '', deathType: 'PK', location: 'Davis - Grove St', morgue: null },
    { name: 'John Doe', ooc: 'Leo Marsh', sex: 'Male', dateOfDeath: '', timeOfDeath: '', deathType: '', location: 'Davis - Forum Dr', morgue: { found: true, caseId: '7zz2', name: 'Unknown (( Leo Marsh ))', level: 'high', exactName: false, candidateCount: 1 } },
    { name: 'Jane Doe', ooc: 'Riley Quinn', sex: 'Female', dateOfDeath: '12/SEP/2026', timeOfDeath: '10:02 PM', deathType: 'CK', location: 'Davis - Forum Dr', morgue: { found: false } },
];

const FALLBACK_MES = ['Anne Carter', 'Alyson Frost', 'Arthur Blackwood', 'Eun Jae', 'Sarah Bell'];

export const data = new SlashCommandBuilder()
    .setName('spawn-v2-showcase')
    .setDescription('DEV ONLY: spawn all V2 components into the showcase channel (owner only)')
    .addStringOption((o) => o
        .setName('channel')
        .setDescription('Override destination channel id (default: dev showcase channel)')
        .setRequired(false))
    .addStringOption((o) => o
        .setName('layout')
        .setDescription('Mass panel layout (default: sections)')
        .setRequired(false)
        .addChoices(
            { name: 'sections', value: 'sections' },
            { name: 'compact', value: 'compact' },
        ))
    .addStringOption((o) => o
        .setName('request')
        .setDescription('Link a mass request topic id instead of live #10174 (working reassign demo)')
        .setRequired(false))
    .addBooleanOption((o) => o
        .setName('reassign_demo')
        .setDescription('Seed a fresh fake mass fixture + post its linked panel (dry-run reassigns)')
        .setRequired(false));

export async function execute(interaction) {
    if (!isOwnerOrWhitelisted(interaction)) {
        await interaction.reply({ content: 'Only the bot owner can run this.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    firebase.init();
    const db = firebase.db;
    const results = [];
    const destChannelId = (interaction.options?.getString('channel') || '').trim() || V2_SHOWCASE_CHANNEL_ID;
    const compactLayout = (interaction.options?.getString('layout') || '').trim().toLowerCase() === 'compact';

    try {
        // Fake reassign demo: seed a FRESH fixture on the isolated dev node
        // (no monitor/dashboard/rotation reader touches it) and post its
        // linked panel with the working Reassign button. Reassigns execute
        // dry (Firebase assignedTo only — no forum/Discord/rotation writes),
        // so supervisors can click through safely. Takes precedence over
        // `request` and skips the rest of the showcase (focused demo).
        if (interaction.options?.getBoolean('reassign_demo') === true) {
            const res = await spawnReassignDemo(db, interaction, destChannelId, compactLayout);
            await interaction.editReply({ embeds: [res] });
            return;
        }

        // 1. V2 mass assignment panel — LIVE #10174 by default (the mass
        // collection the team reviews against), so the showcase visualizes
        // the real thing: real Case Info slices, real Load links, real morgue
        // notes. `request` links an arbitrary collection instead (bare topic
        // id, or `basePath/topicId` for dev fixtures) with the working
        // reassign demo on. Falls back to rotation-dealt dummies only when
        // the default read fails. Default copies omit Reassign (visualization
        // only); explicitly linked copies include it.
        const SHOWCASE_MASS_TOPIC_ID = '10174';
        const linkArg = (interaction.options?.getString('request') || '').trim();
        let linkBasePath = 'autopsy-requested';
        let requestTopicId = SHOWCASE_MASS_TOPIC_ID;
        let devMode = false;
        if (linkArg) {
            const parts = linkArg.split('/').filter(Boolean);
            if (parts.length > 1) {
                requestTopicId = parts.pop();
                linkBasePath = parts.join('/');
            } else {
                requestTopicId = linkArg;
            }
            devMode = linkBasePath !== 'autopsy-requested';
        }
        let assignments = null;
        let dealNote = '';
        try {
            const { buildPanelAssignmentsFromEntry } = await import('../services/massAssignmentPanel.js');
            const liveEntry = (await db.ref(`${linkBasePath}/${requestTopicId}`).once('value')).val() || {};
            const liveAssignments = (liveEntry.isMassSingleThread === true && liveEntry.cases)
                ? await buildPanelAssignmentsFromEntry(db, liveEntry)
                : [];
            if (liveAssignments.length > 0) {
                assignments = liveAssignments;
                dealNote = `${devMode ? 'DEV (dry run)' : 'Live'} ${linkBasePath}/${requestTopicId}: ${assignments.length} bodies / ${new Set(assignments.map((a) => a.me)).size} MEs`;
            } else if (linkArg) {
                await interaction.editReply({ content: `Not a mass collection (or no ME-bearing assignments): ${linkBasePath}/${requestTopicId}.` });
                return;
            } else {
                console.warn('[CMD] spawn-v2-showcase: live #10174 unreadable/closed — dummy fallback');
            }
        } catch (e) {
            if (linkArg) {
                await interaction.editReply({ content: `Failed to read ${linkBasePath}/${requestTopicId}: ${e.message}` });
                return;
            }
            console.warn(`[CMD] spawn-v2-showcase: live #10174 read failed (${e.message}) — dummy fallback`);
        }
        if (!assignments) {
            // Dummy fallback must not ride on the live link (reassign would
            // resolve bodies against the wrong collection).
            requestTopicId = null;
            devMode = false;
            let picks = null;
            try {
                picks = await selectMEsForMass(db, DUMMY_BODIES.length, { commit: false });
            } catch (e) {
                console.warn(`[CMD] spawn-v2-showcase: live deal failed (${e.message}) — using fallback roster`);
            }
            if (!picks || picks.every((p) => !p)) {
                picks = DUMMY_BODIES.map((_, i) => FALLBACK_MES[i % FALLBACK_MES.length]);
            }
            assignments = DUMMY_BODIES.map((b, i) => ({
                ...b,
                me: picks[i] || FALLBACK_MES[i % FALLBACK_MES.length],
                synopsis: DUMMY_SYNOPSIS,
                caseUrl: DUMMY_CASE_URL,
                caseNumber: '512',
                caseTitle: 'Case 512 - Mass Autopsy Request (6 bodies) [LSPD] - V2 SHOWCASE',
            }));
            dealNote = `DUMMY fallback (live #10174 unavailable): ${assignments.map((a, i) => `Body ${i + 1}→${a.me}`).join(' · ')}`;
        }
        // Reassign shows whenever the panel is really linked (live or
        // fixture — the modal executes for real, dry on fixtures). Dummy
        // fallbacks omit it: nothing executable to point at.
        const useReassign = requestTopicId !== null;
        const panelRes = await postMassPanelV2(db, interaction.client, assignments, {
            channelId: destChannelId,
            devReassign: useReassign,
            compact: compactLayout,
            requestTopicId,
            devMode,
        });
        results.push(`Mass panel V2 (${compactLayout ? 'compact' : 'sections'}): ${panelRes.posted ? `posted (panel \`${panelRes.panelId}\`, msg \`${panelRes.messageId}\`, text ${panelRes.metrics?.textChars}/4000, comps ${panelRes.metrics?.componentCount}/40)` : `FAILED (\`${panelRes.reason || '?'}\`)`} — ${dealNote}${useReassign ? ' (reassign executes)' : ' (reassign omitted: visualization only)'}`);

        // 1b. V2 single-assignment panel (dummy data, unlinked showcase copy:
        // Info renders the snapshot, Reassign points at /reassign-autopsy).
        // Carries a Load Case button into the live collection so the button
        // visualizes too (no requestTopicId: no Firebase writes, no flip).
        try {
            const { postSinglePanelV2, SINGLE_V2_FORMS_URL } = await import('../services/singlePanelV2.js');
            const singleRes = await postSinglePanelV2(db, interaction.client, {
                me: 'Alyson Frost',
                caseNumber: '901',
                caseTitle: 'Case 901 - Showcase Doe ((Showcase Ooc)) - V2 SHOWCASE',
                decedent: 'Showcase Doe',
                ooc: 'Showcase Ooc',
                caseUrl: DUMMY_CASE_URL,
                loadUrl: `${SINGLE_V2_FORMS_URL}#/load/${requestTopicId || SHOWCASE_MASS_TOPIC_ID}/0`,
                deathType: 'CK',
                deadline: 'CK — 72h wait window',
                synopsis: DUMMY_SYNOPSIS,
                title: 'Autopsy Case Assigned',
            }, { channelId: destChannelId });
            results.push(`Single panel V2: ${singleRes.posted ? `posted (panel \`${singleRes.panelId}\`, msg \`${singleRes.messageId}\`, text ${singleRes.metrics?.textChars}/4000, comps ${singleRes.metrics?.componentCount}/40)` : `FAILED (\`${singleRes.reason || '?'}\`)`}`);
        } catch (e) {
            results.push(`Single panel V2: FAILED (\`${e.message}\`)`);
        }

        // 1c. V2 single-assignment COMPLETED demo (same dummy ME, delivered
        // variant — shipped as a plain message via the pure builder, since
        // showcase panels are unlinked and completeSinglePanel needs Firebase).
        try {
            const { buildSingleCompletedPayload, alignedDecedentCaseLine } = await import('../services/singlePanelV2.js');
            const doneBuilt = buildSingleCompletedPayload({
                me: 'Alyson Frost',
                caseNumber: '902',
                decedentLine: alignedDecedentCaseLine({ decedent: 'Showcase Doe', ooc: 'Showcase Ooc' }).replace(/^🧍 Decedent — /, ''),
                caseTitle: 'Case 902 - Showcase Doe ((Showcase Ooc)) - V2 SHOWCASE',
                completedUnix: Math.floor(Date.now() / 1000),
                delivered: true,
                sentLine: 'LSSD',
                forumUrl: DUMMY_COMPLETION_URL,
                caseUrl: DUMMY_CASE_URL,
            });
            const doneOver = doneBuilt.metrics.textChars > 4000 || doneBuilt.metrics.componentCount > 40 || doneBuilt.metrics.topLevel > 10;
            if (doneOver) {
                results.push(`Single completed V2: SKIPPED (over budget: text ${doneBuilt.metrics.textChars}, comps ${doneBuilt.metrics.componentCount})`);
            } else {
                const channel = await interaction.client.channels.fetch(destChannelId);
                const doneMsg = await channel.send({ flags: doneBuilt.flags, components: doneBuilt.components });
                results.push(`Single completed V2: posted (msg \`${doneMsg?.id || '?'}\`, text ${doneBuilt.metrics.textChars}/4000, comps ${doneBuilt.metrics.componentCount}/40)`);
            }
        } catch (e) {
            results.push(`Single completed V2: FAILED (\`${e.message}\`)`);
        }

        // 2. V2 dashboard snapshot (live gathered data, one-off post).
        try {
            const data = await gatherDashboardData(db, false);
            data.lastCheckTime = Date.now();
            const built = buildDashboardV2(data, { lastActivity, isBrowserActive });
            const over = built.metrics.textChars > 4000 || built.metrics.componentCount > 40 || built.metrics.topLevel > 10;
            if (over) {
                results.push(`Dashboard V2: SKIPPED (over budget: text ${built.metrics.textChars}, comps ${built.metrics.componentCount})`);
            } else {
                const channel = await interaction.client.channels.fetch(destChannelId);
                // Snapshot is for LOOKING: strip the button row so nobody
                // restarts the bot from a showcase copy (Refresh would also
                // rewrite this snapshot — use the managed board instead).
                const snapComponents = built.components.filter((c) => c && c.type !== 1);
                const dashMsg = await channel.send({ flags: built.flags, components: snapComponents });
                results.push(`Dashboard V2: posted (msg \`${dashMsg?.id || '?'}\`, text ${built.metrics.textChars}/4000, comps ${built.metrics.componentCount}/40)`);
            }
        } catch (e) {
            results.push(`Dashboard V2: FAILED (\`${e.message}\`)`);
        }

        await interaction.editReply({
            embeds: [{
                title: 'V2 Showcase',
                description: results.map((r) => `• ${r}`).join('\n') + '\n\n_Dummy mass data; dashboard is a live-data snapshot (buttons on the snapshot are decorative — use the managed board)._',
                color: 0x9b59b6,
            }],
        });
    } catch (err) {
        console.error('[CMD] spawn-v2-showcase error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}

// ── Fake reassign demo ──
// Seeds a fresh obviously-fake mass fixture (fixed id, overwritten every
// run) and posts its linked panel with the working Reassign button, so the
// full supervisor flow can be clicked through safely: submits execute dry
// (Firebase assignedTo writes only — no forum title/reply, ME pings,
// rotation counts, or legacy refresh). Returns the summary embed.
const REASSIGN_DEMO_NODE = 'devmass-showcase';

const REASSIGN_DEMO_BODIES = [
    { name: 'QaDummy Alpha', ooc: 'QaDummy_OocA', sex: 'Male', dateOfDeath: '19/SEP/2026', timeOfDeath: '08:00 PM', deathType: 'CK', location: 'Davis - Demo Blvd' },
    { name: 'QaDummy Bravo', ooc: 'QaDummy_OocB', sex: 'Female', dateOfDeath: '19/SEP/2026', timeOfDeath: '08:05 PM', deathType: 'PK', location: 'Davis - Demo Blvd' },
    { name: 'QaDummy Charlie', ooc: 'QaDummy_OocC', sex: 'Male', dateOfDeath: '19/SEP/2026', timeOfDeath: '08:10 PM', deathType: 'CK', location: 'Davis - Demo Ct' },
];

async function spawnReassignDemo(db, interaction, destChannelId, compactLayout) {
    const fail = (detail) => ({
        title: 'V2 Reassign Demo',
        description: `FAILED (\`${detail}\`)`,
        color: 0xe74c3c,
    });
    try {
        let picks = null;
        try {
            picks = await selectMEsForMass(db, REASSIGN_DEMO_BODIES.length, { commit: false });
        } catch (e) {
            console.warn(`[CMD] spawn-v2-showcase: reassign-demo deal failed (${e.message}) — using fallback roster`);
        }
        if (!picks || picks.every((p) => !p)) {
            picks = REASSIGN_DEMO_BODIES.map((_, i) => FALLBACK_MES[i % FALLBACK_MES.length]);
        }
        // Body 0+2 share ME[0] (multi-body slice), body 1 goes to ME[1].
        const deal = [picks[0], picks[1] || picks[0], picks[0]];
        const cases = {};
        REASSIGN_DEMO_BODIES.forEach((b, i) => {
            cases[i] = {
                assignedTo: deal[i] || FALLBACK_MES[i % FALLBACK_MES.length],
                name: b.name,
                oocName: b.ooc,
                sex: b.sex,
                dateOfDeath: b.dateOfDeath,
                timeOfDeath: b.timeOfDeath,
                placeOfDeath: b.location,
            };
        });
        await db.ref(`dev-autopsy-requested/${REASSIGN_DEMO_NODE}`).set({
            isMassSingleThread: true,
            caseNum: '900',
            caseTitle: 'Case 900 - Mass Autopsy Request (3 bodies) [LSPD] - V2 REASSIGN DEMO',
            caseUrl: DUMMY_CASE_URL,
            detectedAt: new Date().toISOString(),
            parsed: { deathType: 'CK', synopsis: DUMMY_SYNOPSIS },
            cases,
        });
        const { postMassPanelV2 } = await import('../services/massPanelV2.js');
        const { buildPanelAssignmentsFromEntry } = await import('../services/massAssignmentPanel.js');
        const entry = (await db.ref(`dev-autopsy-requested/${REASSIGN_DEMO_NODE}`).once('value')).val() || {};
        const assignments = await buildPanelAssignmentsFromEntry(db, entry);
        if (assignments.length === 0) {
            return fail('fixture seeded but no ME-bearing assignments resolved');
        }
        const res = await postMassPanelV2(db, interaction.client, assignments, {
            channelId: destChannelId,
            devReassign: true,
            compact: compactLayout,
            requestTopicId: REASSIGN_DEMO_NODE,
            devMode: true,
        });
        const m = res.metrics || {};
        if (!res.posted) {
            return fail(res.reason || 'panel post failed');
        }
        return {
            title: 'V2 Reassign Demo',
            description: [
                `Mass panel V2 (${compactLayout ? 'compact' : 'sections'}): posted (panel \`${res.panelId}\`, msg \`${res.messageId}\`, text ${m.textChars ?? '?'}/4000, comps ${m.componentCount ?? '?'}/40)`,
                `**Deal:** ${assignments.map((a, i) => `Body ${i + 1}→${a.me}`).join(' · ')}`,
                '',
                '_Fake `QaDummy_*` bodies on an isolated node — press **Reassign** as a Supervisor and submit: executes dry (assignedTo flips only), then the panel rebuilds. Re-running this command re-seeds the fixture._',
            ].join('\n'),
            color: 0x9b59b6,
        };
    } catch (err) {
        console.error('[CMD] spawn-v2-showcase reassign-demo error:', err.message);
        return fail(err.message);
    }
}
