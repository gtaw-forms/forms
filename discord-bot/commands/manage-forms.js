import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { isOwnerOrWhitelisted } from '../services/permissions.js';
import firebase from '../services/firebase.js';

/**
 * Form blocks toggleable as a unit. Keys are RTDB `forms/<key>` nodes.
 * Medical blocks (ER / Mental Health) were retired with the medical-records
 * sunset — only the Coroner / DMEC block remains.
 */
export const FORM_GROUPS = {
    coroner: {
        label: 'Coroner / DMEC',
        keys: ['coroner-report', 'coroner_email', 'death_record', 'autopsy', 'mass-ftality-test'],
    },
};

const GROUP_CHOICES = Object.entries(FORM_GROUPS).map(([value, g]) => ({ name: g.label, value }));

const silentOption = opt => opt
    .setName('silent')
    .setDescription('Toggle forms without touching the goodbye message (tests/maintenance)')
    .setRequired(false);

export const data = new SlashCommandBuilder()
    .setName('manage-forms')
    .setDescription('(Owner) Enable/disable website form blocks (Coroner)')
    .addSubcommand(sub => sub
        .setName('status')
        .setDescription('Show ENABLED/DISABLED state of form blocks')
        .addStringOption(opt => opt
            .setName('formgroup')
            .setDescription('Which block (default: all)')
            .setRequired(false)
            .addChoices(...GROUP_CHOICES)))
    .addSubcommand(sub => sub
        .setName('enable')
        .setDescription('Show a form block on the website (isHidden=false)')
        .addStringOption(opt => opt
            .setName('formgroup')
            .setDescription('Which block to enable')
            .setRequired(true)
            .addChoices(...GROUP_CHOICES))
        .addBooleanOption(silentOption))
    .addSubcommand(sub => sub
        .setName('disable')
        .setDescription('Hide a form block from the website (isHidden=true)')
        .addStringOption(opt => opt
            .setName('formgroup')
            .setDescription('Which block to disable')
            .setRequired(true)
            .addChoices(...GROUP_CHOICES))
        .addBooleanOption(silentOption));

/** Read live isHidden + display name for every key in the group. */
async function readGroupState(db, groupKey) {
    const group = FORM_GROUPS[groupKey];
    const states = [];
    for (const key of group.keys) {
        const snap = await db.ref(`forms/${key}`).once('value');
        if (!snap.exists()) {
            states.push({ key, name: key, missing: true, hidden: null });
            continue;
        }
        const val = snap.val() || {};
        states.push({ key, name: val.name || key, missing: false, hidden: val.isHidden === true });
    }
    return states;
}

function statusLine(s) {
    if (s.missing) return `— \`${s.key}\` — NOT FOUND in database (skipped)`;
    return s.hidden ? `DISABLED \`${s.name}\`` : `ENABLED \`${s.name}\``;
}

function buildStatusEmbed(groupsData, goodbye) {
    const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('Website Form Blocks — Status')
        .setTimestamp();
    for (const [groupKey, states] of Object.entries(groupsData)) {
        const group = FORM_GROUPS[groupKey];
        const enabled = states.filter(s => !s.missing && !s.hidden).length;
        embed.addFields({
            name: `${group.label} (${enabled}/${states.length} enabled)`,
            value: states.map(statusLine).join('\n'),
        });
    }
    if (goodbye && goodbye.active) {
        const retired = Object.entries(goodbye.blocks || {})
            .filter(([, v]) => v)
            .map(([gk]) => FORM_GROUPS[gk]?.label || gk);
        embed.addFields({
            name: 'Goodbye message: ACTIVE',
            value: retired.length > 0 ? `Naming: ${retired.join(', ')}` : 'Active with no blocks named.',
        });
    }
    embed.setFooter({ text: '/manage-forms enable|disable formgroup:<block> to change' });
    return embed;
}

/**
 * Recompute the goodbye node from live managed-key states. A block counts as
 * retired when at least one of its managed forms is hidden. Deliberately
 * reads only managed keys.
 */
async function syncGoodbye(db, who) {
    const blocks = {};
    for (const gk of Object.keys(FORM_GROUPS)) {
        const states = await readGroupState(db, gk);
        blocks[gk] = states.some(s => !s.missing && s.hidden);
    }
    const active = Object.values(blocks).some(Boolean);
    await db.ref('appMetadata/goodbye').update({
        active, blocks, updatedBy: who, updatedAt: Date.now(),
    });
    return { active, blocks };
}

export async function execute(interaction) {
    if (!isOwnerOrWhitelisted(interaction)) {
        await interaction.reply({ content: 'Only Senior Leadership / the bot owner can manage forms.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    firebase.init();
    const db = firebase.db;
    const sub = interaction.options.getSubcommand();
    const onlyGroup = interaction.options.getString('formgroup');
    const groupKeys = onlyGroup ? [onlyGroup] : Object.keys(FORM_GROUPS);

    try {
        // ── Status (read-only) ──
        if (sub === 'status') {
            const groupsData = {};
            for (const gk of groupKeys) groupsData[gk] = await readGroupState(db, gk);
            const goodbye = (await db.ref('appMetadata/goodbye').once('value')).val();
            await interaction.editReply({ embeds: [buildStatusEmbed(groupsData, goodbye)] });
            return;
        }

        // ── Enable / disable ──
        const enabling = sub === 'enable';
        const silent = interaction.options.getBoolean('silent') === true;
        const targetHidden = !enabling;
        const group = FORM_GROUPS[onlyGroup];
        const states = await readGroupState(db, onlyGroup);

        const missing = states.filter(s => s.missing);
        if (missing.length > 0) {
            await interaction.editReply({
                content: `Aborted — these forms were not found in the database (no changes made): ${missing.map(s => `\`${s.key}\``).join(', ')}`,
            });
            return;
        }

        const changed = [];
        const already = [];
        for (const s of states) {
            if (s.hidden === targetHidden) {
                already.push(s.name);
                continue;
            }
            // Field-level update only — never set() the whole form node.
            await db.ref(`forms/${s.key}`).update({ isHidden: targetHidden });
            changed.push(s.name);
        }

        // Bump the forms version so live website clients refresh their cache
        // (same counter the admin Form Manager bumps on every save).
        if (changed.length > 0) {
            await db.ref('appMetadata/formsDataVersion').transaction(v => (v || 0) + 1);
        }

        // Audit record (best-effort — never fails the toggle).
        const who = `discord:${interaction.user.username} (${interaction.user.id})`;
        try {
            await db.ref('appMetadata/formVisibilityLog').push({
                group: onlyGroup,
                action: sub,
                silent,
                changed,
                alreadyThere: already,
                by: who,
                at: Date.now(),
            });
        } catch (auditErr) {
            console.warn('[manage-forms] audit write failed:', auditErr.message);
        }
        try {
            const { sendLogMessage } = await import('../services/logChannel.js');
            await sendLogMessage(
                `[manage-forms] ${who} ${sub}d block ${group.label}${silent ? ' (silent — goodbye untouched)' : ''}`,
                new EmbedBuilder()
                    .setColor(enabling ? 0x28a745 : 0xffc107)
                    .setTitle(`Form Block ${enabling ? 'Enabled' : 'Disabled'} — ${group.label}`)
                    .setDescription([
                        changed.length > 0
                            ? `**Changed:** ${changed.join(', ')}`
                            : 'No changes — block was already in that state.',
                        already.length > 0 ? `**Already ${enabling ? 'enabled' : 'disabled'}:** ${already.join(', ')}` : null,
                    ].filter(Boolean).join('\n'))
                    .setFooter({ text: `Run by ${interaction.user.tag}` })
                    .setTimestamp()
            );
        } catch (logErr) {
            console.warn('[manage-forms] log-channel notify failed:', logErr.message);
        }

        // Goodbye message follows the toggle automatically (unless silent):
        // disabling a block retires it in the goodbye, enabling lifts it.
        let goodbyeLine = null;
        if (!silent) {
            try {
                const gb = await syncGoodbye(db, who);
                const retired = Object.entries(gb.blocks)
                    .filter(([, v]) => v)
                    .map(([gk]) => FORM_GROUPS[gk]?.label || gk);
                goodbyeLine = gb.active
                    ? `Goodbye message: ACTIVE (naming ${retired.join(', ') || 'no blocks'}).`
                    : 'Goodbye message: lifted (no blocks retired).';
            } catch (gbErr) {
                console.warn('[manage-forms] goodbye sync failed:', gbErr.message);
                goodbyeLine = 'Goodbye message: sync failed (forms toggled OK) — check logs.';
            }
        }

        const embed = new EmbedBuilder()
            .setColor(enabling ? 0x28a745 : 0xffc107)
            .setTitle(`${enabling ? 'Enabled' : 'Disabled'} — ${group.label}`)
            .setDescription([
                changed.length > 0
                    ? `**${enabling ? 'Now visible' : 'Now hidden'} on the website:** ${changed.join(', ')}`
                    : `Block was already ${enabling ? 'enabled' : 'disabled'} — nothing changed.`,
                already.length > 0 && changed.length > 0 ? `Already ${enabling ? 'visible' : 'hidden'}: ${already.join(', ')}` : null,
                '',
                changed.length > 0
                    ? 'Website clients pick this up automatically (forms version bumped).'
                    : null,
                goodbyeLine,
            ].filter(Boolean).join('\n'))
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[manage-forms] error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}
