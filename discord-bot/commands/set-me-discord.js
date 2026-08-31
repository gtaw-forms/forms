/**
 * me-discord.js — Interactive ME → Discord mapping manager.
 *
 * `/me-discord` (owner) lists the MEs on the rotation who don't have a Discord
 * mapping yet, with an "Add: <name>" button per ME. Clicking a button opens a
 * modal to paste the Discord user ID (or @mention); on submit the mapping is
 * stored and the panel re-renders (the ME moves to the Mapped section).
 *
 * Buttons:  me_map_<slug>      → shows the Discord-ID modal
 * Modal:    me_modal_<slug>    → saves the mapping
 */
import {
    SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle,
    ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags,
} from 'discord.js';
import firebase from '../services/firebase.js';
import { setDiscordMapping } from '../services/meDiscordNotify.js';

export const data = new SlashCommandBuilder()
    .setName('me-discord')
    .setDescription('(Owner) Map MEs to Discord IDs for assignment pings');

const slugify = (name) => String(name || '').toLowerCase().replace(/\s+/g, '_');

async function getRotationList(db) {
    const rot = (await db.ref('autopsy-requests/rotation').once('value')).val();
    return (rot && Array.isArray(rot.list)) ? rot.list : [];
}

async function getMapped(db) {
    return (await db.ref('autopsy-requests/discord-members').once('value')).val() || {};
}

async function buildPanel(db) {
    const list = await getRotationList(db);
    const mapped = await getMapped(db);
    const unmapped = list.filter((n) => !mapped[n.toLowerCase()]);
    const mappedMEs = list.filter((n) => mapped[n.toLowerCase()]);

    const embed = new EmbedBuilder()
        .setColor(0x00bcd4)
        .setTitle('ME Discord Mappings')
        .setDescription('Assign Discord IDs so MEs get pinged on autopsy assignments. Click **Add** next to an ME, then paste their Discord user ID (or @mention).')
        .setFooter({ text: `${list.length} MEs on rotation · ${unmapped.length} need mapping` })
        .setTimestamp();

    if (unmapped.length > 0) {
        embed.addFields({ name: '🔔 Need Mapping', value: unmapped.map((n) => `• ${n}`).join('\n'), inline: true });
    }
    if (mappedMEs.length > 0) {
        embed.addFields({
            name: '✅ Mapped',
            value: mappedMEs.map((n) => `• ${n} → <@${mapped[n.toLowerCase()]}>`).join('\n'),
            inline: true,
        });
    }
    if (unmapped.length === 0) {
        embed.setDescription('All MEs on rotation have a Discord mapping. 🎉');
    }

    const rows = [];
    for (let i = 0; i < unmapped.length; i += 5) {
        rows.push(new ActionRowBuilder().addComponents(
            unmapped.slice(i, i + 5).map((n) =>
                new ButtonBuilder()
                    .setCustomId('me_map_' + slugify(n))
                    .setLabel('Add: ' + n)
                    .setStyle(ButtonStyle.Primary)
            )
        ));
    }
    return { embed, components: rows };
}

async function resolveSlug(db, slug) {
    const list = await getRotationList(db);
    return list.find((n) => slugify(n) === slug) || null;
}

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can manage Discord mappings.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    firebase.init();
    const db = firebase.db;
    try {
        const { embed, components } = await buildPanel(db);
        await interaction.editReply({ embeds: [embed], components });
    } catch (err) {
        console.error('[CMD] me-discord error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}

/** me_map_<slug> button → show the Discord-ID modal for that ME. */
export async function handleMeMapButton(interaction) {
    const slug = interaction.customId.replace('me_map_', '');
    firebase.init();
    const db = firebase.db;
    const me = await resolveSlug(db, slug);
    if (!me) {
        await interaction.reply({ content: 'That ME is no longer on the rotation list — run `/me-discord` again.', flags: MessageFlags.Ephemeral });
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId('me_modal_' + slug)
        .setTitle('Add Discord ID — ' + me)
        .addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('discord_id')
                .setLabel('Discord User ID or @mention')
                .setPlaceholder('e.g. 228306972204597248 or <@228306972204597248>')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ));
    await interaction.showModal(modal);
}

/** me_modal_<slug> submit → save the mapping and re-render the panel. */
export async function handleMeMapModal(interaction) {
    const slug = interaction.customId.replace('me_modal_', '');
    const raw = interaction.fields.getTextInputValue('discord_id').trim();
    const idMatch = raw.match(/\d{15,20}/);
    if (!idMatch) {
        await interaction.reply({ content: 'That does not look like a Discord user ID or @mention.', flags: MessageFlags.Ephemeral });
        return;
    }
    const discordId = idMatch[0];

    firebase.init();
    const db = firebase.db;
    const me = await resolveSlug(db, slug);
    if (!me) {
        await interaction.reply({ content: 'That ME is no longer on the rotation list — run `/me-discord` again.', flags: MessageFlags.Ephemeral });
        return;
    }

    await setDiscordMapping(db, me, discordId);
    console.log(`[ME-DISCORD] Mapped ${me} → ${discordId} (by ${interaction.user.username})`);

    const { embed, components } = await buildPanel(db);
    await interaction.update({ embeds: [embed], components });
    await interaction.followUp({ content: `Mapped **${me}** → <@${discordId}>`, flags: MessageFlags.Ephemeral });
}
