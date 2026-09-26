import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { isOwnerOrWhitelisted } from '../services/permissions.js';
import firebase from '../services/firebase.js';
import { notifyMassAssignmentPanel } from '../services/meDiscordNotify.js';
import { MASS_PANEL_STAGING_CHANNEL_ID } from '../services/massAssignmentPanel.js';
import { selectMEsForMass } from '../services/autopsyRotation.js';

// Dummy bodies for the visual test — obviously fake names, staging only.
// They are dealt through the LIVE rotation (read-only, commit:false) so the
// panel shows the real fair-share distribution across current MEs.
// Morgue variants cover every slice line: exact match, possible match,
// searched-but-none, and lookup-unavailable (line hidden).
const DUMMY_CASE_URL = 'https://phmc.gta.world/viewtopic.php?t=19999';
const DUMMY_SYNOPSIS = 'TEST SYNOPSIS: multiple victims recovered from a single-vehicle collision on Hawick Avenue; ballistics pending, no suspects outstanding.';
const DUMMY_BODIES = [
    { name: 'John Doe', ooc: 'Mark Smith', sex: 'Male', dateOfDeath: '12/SEP/2026', timeOfDeath: '09:39 PM', deathType: 'CK', location: 'Davis - Innocence Blvd', morgue: { found: true, caseId: '8f3k', name: 'John Doe', level: 'high', exactName: true, candidateCount: 1 } },
    { name: 'Jane Doe', ooc: 'Ana Ruiz', sex: 'Female', dateOfDeath: '12/SEP/2026', timeOfDeath: '09:41 PM', deathType: 'CK', location: 'Davis - Innocence Blvd', morgue: { found: true, caseId: '9a1q', name: 'Jane Doe', level: 'low', exactName: false, candidateCount: 3 } },
    { name: 'John Doe', ooc: 'Chris Parnell', sex: 'Male', dateOfDeath: '12/SEP/2026', timeOfDeath: '09:44 PM', deathType: 'PK', location: 'Davis - Grove St', morgue: { found: false } },
    { name: 'Jane Doe', ooc: 'Dana Whitfield', sex: 'Female', dateOfDeath: '12/SEP/2026', timeOfDeath: '', deathType: 'PK', location: 'Davis - Grove St', morgue: null },
    { name: 'John Doe', ooc: 'Leo Marsh', sex: 'Male', dateOfDeath: '', timeOfDeath: '', deathType: '', location: 'Davis - Forum Dr', morgue: { found: true, caseId: '7zz2', name: 'Unknown (( Leo Marsh ))', level: 'high', exactName: false, candidateCount: 1 } },
    { name: 'Jane Doe', ooc: 'Riley Quinn', sex: 'Female', dateOfDeath: '12/SEP/2026', timeOfDeath: '10:02 PM', deathType: 'CK', location: 'Davis - Forum Dr', morgue: { found: false } },
];

// Fallback split when rotation is unavailable — round-robin across the
// current roster so every ME still appears on the panel.
const FALLBACK_MES = ['Anne Carter', 'Alyson Frost', 'Arthur Blackwood', 'Eun Jae', 'Sarah Bell'];

export const data = new SlashCommandBuilder()
    .setName('test-mass-panel')
    .setDescription('Post a dummy mass-assignment panel to the staging channel (owner only)');

export async function execute(interaction) {
    if (!isOwnerOrWhitelisted(interaction)) {
        await interaction.reply({ content: 'Only the bot owner can run this.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    firebase.init();
    const db = firebase.db;

    try {
        // Deal the dummies through the live rotation (read-only preview) so
        // the panel reflects the real fair-share distribution, including any
        // newly added MEs. Falls back to a static round-robin when rotation
        // is unavailable.
        let picks = null;
        try {
            picks = await selectMEsForMass(db, DUMMY_BODIES.length, { commit: false });
        } catch (e) {
            console.warn(`[CMD] test-mass-panel: live deal failed (${e.message}) — using fallback roster`);
        }
        if (!picks || picks.every((p) => !p)) {
            picks = DUMMY_BODIES.map((_, i) => FALLBACK_MES[i % FALLBACK_MES.length]);
        }
        const assignments = DUMMY_BODIES.map((b, i) => ({
            ...b,
            me: picks[i] || FALLBACK_MES[i % FALLBACK_MES.length],
            synopsis: DUMMY_SYNOPSIS,
            caseUrl: DUMMY_CASE_URL,
            caseNumber: '512',
            caseTitle: 'Case 512 - Mass Autopsy Request (6 bodies) [LSPD] - TEST',
        }));

        // Explicit staging channel — never resolves to live #autopsies no
        // matter what PHMC_CHANNEL_SEND_ENABLED says on the VPS.
        const res = await notifyMassAssignmentPanel(db, interaction.client, assignments, {
            channelId: MASS_PANEL_STAGING_CHANNEL_ID,
        });

        const embed = new EmbedBuilder()
            .setColor(0x00bcd4)
            .setTitle('Test Mass Panel')
            .setDescription([
                `**Posted:** ${res.posted ? 'yes' : 'no'}${res.reason ? ` (\`${res.reason}\`)` : ''}`,
                `**Panel:** \`${res.panelId || 'n/a'}\``,
                `**Channel:** \`${res.channelId || 'n/a'}\``,
                `**Message:** \`${res.messageId || 'n/a'}\``,
                `**Bodies/MEs:** ${res.bodyCount ?? '?'} / ${res.meCount ?? '?'}`,
                `**Deal:** ${(picks || []).map((p, i) => `Body ${i + 1}→${p || '?'}`).join(' · ')}`,
                '',
                '_Dummy data only. Buttons live 5 min, then rows disable._',
            ].join('\n'))
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[CMD] test-mass-panel error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}
