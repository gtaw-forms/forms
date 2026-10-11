import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { isOwnerOrWhitelisted } from '../services/permissions.js';

export const data = new SlashCommandBuilder()
    .setName('fix-autopsy')
    .setDescription('Fix incorrect data in an autopsy request entry')
    .addStringOption(opt =>
        opt.setName('name')
            .setDescription('Current OOC or IC name to search for')
            .setRequired(true))
    .addStringOption(opt =>
        opt.setName('newname')
            .setDescription('Correct IC name')
            .setRequired(false))
    .addStringOption(opt =>
        opt.setName('newooc')
            .setDescription('Correct OOC name')
            .setRequired(false))
        .addStringOption(opt =>
            opt.setName('newfaction')
            .setDescription('Correct faction')
            .setRequired(false)
            .addChoices(
                { name: 'LSPD', value: 'LSPD' },
                { name: 'LSSD', value: 'LSSD' },
            ))
        .addBooleanOption(opt =>
            opt.setName('refreshpanels')
            .setDescription('Re-resolve morgue match and upgrade posted panels to FOUND')
            .setRequired(false))
        .addBooleanOption(opt =>
            opt.setName('flippanels')
            .setDescription('Flip posted panels of completed cases to their completed summary')
            .setRequired(false));

export async function execute(interaction) {
    if (!isOwnerOrWhitelisted(interaction)) {
        await interaction.reply({ content: 'Only the bot owner can fix autopsy data.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const searchName = interaction.options.getString('name').trim();
        const newName = interaction.options.getString('newname')?.trim();
        const newOoc = interaction.options.getString('newooc')?.trim();
        const newFaction = interaction.options.getString('newfaction')?.trim();
        const doRefresh = interaction.options.getBoolean('refreshpanels') === true;
        const doFlip = interaction.options.getBoolean('flippanels') === true;

        if (!newName && !newOoc && !newFaction && !doRefresh && !doFlip) {
            await interaction.editReply({ content: 'Provide at least one field to fix: newname, newooc, newfaction, refreshpanels, or flippanels.' });
            return;
        }

    try {
        const { initializeApp, cert, getApps } = await import('firebase-admin/app');
        const { getDatabase } = await import('firebase-admin/database');
        const { readFileSync, existsSync } = await import('fs');
        const { resolve } = await import('path');

        const keyPath = resolve(process.cwd(), process.env.FIREBASE_ADMIN_KEY_PATH || '../firebase-admin-key.json');
        if (!existsSync(keyPath)) {
            await interaction.editReply({ content: 'Firebase admin key not found.' });
            return;
        }
        const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf-8'));
        const databaseURL = process.env.FIREBASE_DATABASE_URL;
        if (!databaseURL) {
            await interaction.editReply({ content: 'FIREBASE_DATABASE_URL not set.' });
            return;
        }

        if (getApps().length === 0) {
            initializeApp({ credential: cert(serviceAccount), databaseURL });
        }
        const db = getDatabase();

        // Search by OOC name, then IC name, then topicId
        let snap = await db.ref('autopsy-requested').orderByChild('oocName').equalTo(searchName).once('value');
        if (!snap.exists()) {
            snap = await db.ref('autopsy-requested').orderByChild('name').equalTo(searchName).once('value');
        }
        if (!snap.exists() && /^\d+$/.test(searchName)) {
            snap = await db.ref('autopsy-requested/' + searchName).once('value');
            if (snap.exists()) {
                const e = snap.val();
                const wrapped = {};
                wrapped[searchName] = e;
                // Mirror a real child snapshot: the fix loop below calls
                // child.ref.update(...) — the wrapper must provide ref too
                // (topicId search previously crashed here).
                const fakeRef = db.ref('autopsy-requested/' + searchName);
                snap = { exists: () => true, forEach: (fn) => { fn({ key: searchName, val: () => e, ref: fakeRef }); return true; }, val: () => wrapped };
            }
        }

        if (!snap.exists()) {
            await interaction.editReply({ content: 'No autopsy-requested entry found for: **' + searchName + '**' });
            return;
        }

        let updated = 0;
        const details = [];

        snap.forEach((child) => {
            const entry = child.val();
            const key = child.key;
            const updates = {};
            if (newName) updates.name = newName;
            if (newOoc) updates.oocName = newOoc;
            if (newFaction) updates.faction = newFaction;
            child.ref.update(updates);
            const parts = [];
            if (newName) parts.push('name: ' + entry.name + ' -> ' + newName);
            if (newOoc) parts.push('OOC: ' + (entry.oocName || '') + ' -> ' + newOoc);
            if (newFaction) parts.push('faction: ' + (entry.faction || '') + ' -> ' + newFaction);
            details.push('Fixed #' + key + ' (' + (parts.join(', ') || 'no field changes') + ')');
            updated++;
        });

        // Panel refresh: re-resolve morgue for open cases with posted panels
        // and upgrade to FOUND in place (upgrade-only, same rules as the
        // morgue-change trigger — never downgrades, never reposts/re-pings).
        if (doRefresh) {
            const { resolveMorgueStatus, refreshSinglePanelV2 } = await import('../services/singlePanelV2.js');
            const refreshed = [];
            const walk = [];
            snap.forEach((child) => walk.push([child.key, child.val()]));
            for (const [key, stale] of walk) {
                const entry = (await db.ref('autopsy-requested/' + key).once('value')).val() || stale;
                const rows = [];
                if (entry.cases && typeof entry.cases === 'object') {
                    for (const [ci, c] of Object.entries(entry.cases)) {
                        if (!/^\d+$/.test(ci) || !c || !c.assignedTo || c.completedAt) continue;
                        const hasPanel = (c.singlePanel && c.singlePanel.panelId)
                            || (entry.singlePanel && entry.singlePanel.panelId);
                        if (!hasPanel) continue;
                        rows.push({ idx: parseInt(ci, 10), name: c.name, ooc: c.oocName });
                    }
                } else if (entry.assignedTo && entry.singlePanel && entry.singlePanel.panelId && !entry.completedAt) {
                    rows.push({ idx: null, name: entry.name, ooc: entry.oocName });
                }
                for (const r of rows) {
                    const fresh = await resolveMorgueStatus(db, { ooc: r.ooc || '', decedent: r.name || '' });
                    if (!fresh || fresh.status !== 'FOUND') {
                        refreshed.push('#' + key + (r.idx !== null ? '/' + r.idx : '') + ': still ' + (fresh ? fresh.status : 'unresolved'));
                        continue;
                    }
                    const res = await refreshSinglePanelV2(db, interaction.client, key, r.idx, fresh);
                    if (res.refreshed) {
                        const path = r.idx === null
                            ? `autopsy-requested/${key}/morgue`
                            : `autopsy-requested/${key}/cases/${r.idx}/morgue`;
                        await db.ref(path).set({ status: 'FOUND', caseId: fresh.caseId || null, checkedAt: new Date().toISOString() }).catch(() => {});
                        refreshed.push('#' + key + (r.idx !== null ? '/' + r.idx : '') + ': upgraded to FOUND (#' + (fresh.caseId || '?') + ')');
                    } else {
                        refreshed.push('#' + key + (r.idx !== null ? '/' + r.idx : '') + ': refresh skipped (' + (res.reason || '?') + ')');
                    }
                }
            }
            if (refreshed.length) details.push('', '**Panel refresh:**', ...refreshed);
            else details.push('', 'Panel refresh: no open paneled cases found.');
        }

        // Panel flip: completed cases whose posted panel still shows the
        // assigned summary (e.g. completion ran outside the normal flow).
        // completeSinglePanel reads Firebase truth at call time and edits the
        // posted message in place; registry refs are cleaned on flip.
        if (doFlip) {
            const { completeSinglePanel } = await import('../services/singlePanelV2.js');
            const flipped = [];
            const walk = [];
            snap.forEach((child) => walk.push([child.key, child.val()]));
            for (const [key, stale] of walk) {
                const entry = (await db.ref('autopsy-requested/' + key).once('value')).val() || stale;
                const rows = [];
                if (entry.cases && typeof entry.cases === 'object') {
                    for (const [ci, c] of Object.entries(entry.cases)) {
                        if (!/^\d+$/.test(ci) || !c || !c.completedAt) continue;
                        const hasPanel = (c.singlePanel && c.singlePanel.panelId)
                            || (entry.singlePanel && entry.singlePanel.panelId);
                        if (!hasPanel) continue;
                        rows.push(parseInt(ci, 10));
                    }
                } else if (entry.completedAt && entry.singlePanel && entry.singlePanel.panelId) {
                    rows.push(null);
                }
                for (const idx of rows) {
                    const res = await completeSinglePanel(db, interaction.client, { requestTopicId: key, caseIdx: idx });
                    flipped.push('#' + key + (idx !== null ? '/' + idx : '') + ': ' + (res.flipped ? 'flipped to completed' : 'not flipped (' + (res.reason || '?') + ')'));
                }
            }
            if (flipped.length) details.push('', '**Panel flip:**', ...flipped);
            else details.push('', 'Panel flip: no completed paneled cases found.');
        }

        const embed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle('Autopsy Data Fixed')
            .setDescription(['**Searched:** ' + searchName, '**Entries updated:** ' + updated, '', ...details].join('\n'))
            .setFooter({ text: 'Triggered by ' + interaction.user.tag })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[CMD] fix-autopsy error:', err.message);
        await interaction.editReply({ content: 'Error: ' + err.message });
    }
}
