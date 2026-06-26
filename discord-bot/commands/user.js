import {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('user')
    .setDescription('Look up a Discord user by their ID')
    .addStringOption(option =>
        option
            .setName('id')
            .setDescription('Discord user ID (right-click user → Copy ID)')
            .setRequired(true)
    );

// ── Public flag bit definitions ──
const PUBLIC_FLAGS = [
    { bit: 0,  label: '🛠️ Discord Staff' },
    { bit: 1,  label: '💎 Partner' },
    { bit: 2,  label: '🏅 HypeSquad Events' },
    { bit: 3,  label: '🐛 Bug Hunter (Lv 1)' },
    { bit: 6,  label: '🔵 HypeSquad Bravery' },
    { bit: 7,  label: '🟣 HypeSquad Brilliance' },
    { bit: 8,  label: '🟢 HypeSquad Balance' },
    { bit: 9,  label: '🌟 Early Supporter' },
    { bit: 10, label: '👥 Team User' },
    { bit: 14, label: '🐞 Bug Hunter (Lv 2)' },
    { bit: 16, label: '✅ Verified Bot' },
    { bit: 17, label: '🔧 Verified Developer' },
    { bit: 18, label: '🛡️ Certified Moderator' },
    { bit: 19, label: '🤖 HTTP Bot' },
    { bit: 22, label: '🚫 Spammer' },
    { bit: 23, label: '⚡ Active Developer' },
];

const PREMIUM_LABELS = {
    0: 'None',
    1: 'Nitro Classic',
    2: 'Nitro',
    3: 'Nitro Basic',
};

// ── Avatar decoration types ──
function decodeFlags(publicFlags) {
    if (!publicFlags) return [];
    return PUBLIC_FLAGS
        .filter(({ bit }) => publicFlags & (1 << bit))
        .map(({ label }) => label);
}

export async function execute(interaction) {
    const rawId = interaction.options.getString('id', true).trim();
    const caller = interaction.user.tag;

    console.log(`[USER] 🔍 /user invoked by ${caller} | id="${rawId}"`);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        // Validate snowflake
        if (!/^\d{17,20}$/.test(rawId)) {
            await interaction.editReply({
                content: '❌ That doesn\'t look like a valid Discord user ID. It should be a 17–20 digit number.\n> 💡 Enable **Developer Mode** in Discord settings → right-click a user → **Copy ID**.',
            });
            return;
        }

        const user = await interaction.client.users.fetch(rawId, { force: true });
        if (!user) {
            await interaction.editReply({
                content: `❌ No Discord user found with ID \`${rawId}\`. They may have deleted their account or the bot cannot see them.`,
            });
            return;
        }

        // Fetch fresh data for banner / newer fields not always in cache
        const fresh = await user.fetch({ force: true });

        const created = Math.floor(user.createdTimestamp / 1000);
        const avatarUrl = user.displayAvatarURL({ size: 256 });
        const avatarFull = user.displayAvatarURL({ size: 1024 });
        const bannerUrl = fresh.banner ? fresh.bannerURL({ size: 512 }) : null;
        const bannerFull = fresh.banner ? fresh.bannerURL({ size: 1024 }) : null;

        // ── Decode flags ──
        const badges = decodeFlags(user.flags?.bitfield ?? fresh.publicFlags);
        const badgesStr = badges.length > 0 ? badges.join('\n') : 'None';

        // ── Build embed ──
        const embed = new EmbedBuilder()
            .setColor(user.hexAccentColor || 0x5865f2)
            .setTitle(`${user.username}${user.globalName ? ` (${user.globalName})` : ''}`)
            .setThumbnail(avatarUrl)

            .addFields(
                // Row 1
                {
                    name: '🆔 User ID',
                    value: `\`${user.id}\``,
                    inline: true,
                },
                {
                    name: '🏷️ Display Name',
                    value: user.globalName || '*Not set*',
                    inline: true,
                },
                {
                    name: '🤖 Bot?',
                    value: user.bot ? 'Yes' : 'No',
                    inline: true,
                },

                // Row 2
                {
                    name: '🔐 MFA Enabled?',
                    value: user.mfaEnabled !== undefined ? (user.mfaEnabled ? 'Yes' : 'No') : '*Unknown*',
                    inline: true,
                },
                {
                    name: '⚙️ System User?',
                    value: user.system ? 'Yes' : 'No',
                    inline: true,
                },
                {
                    name: '🌐 Locale',
                    value: user.locale ? `\`${user.locale}\`` : '*Unknown*',
                    inline: true,
                },

                // Row 3
                {
                    name: '📅 Account Created',
                    value: `<t:${created}:D> (<t:${created}:R>)`,
                    inline: false,
                },

                // Row 4 — Nitro
                {
                    name: '💎 Nitro',
                    value: PREMIUM_LABELS[user.premiumType ?? 0] || 'None',
                    inline: true,
                },
                {
                    name: '🖼️ Avatar',
                    value: `[Open Avatar](${avatarFull})`,
                    inline: true,
                },
            );

        // ── Avatar Decoration ──
        if (fresh.avatarDecorationData) {
            const deco = fresh.avatarDecorationData;
            embed.addFields({
                name: '✨ Avatar Decoration',
                value: `SKU: \`${deco.skuId || deco.sku_id || '?'}\`\nAsset: \`${deco.asset}\``,
                inline: false,
            });
        }

        // ── Primary Guild (Clan) ──
        if (fresh.primaryGuild) {
            const pg = fresh.primaryGuild;
            const line = [
                pg.identityGuildId ? `Guild: \`${pg.identityGuildId}\`` : null,
                pg.identityEnabled ? 'Identity: ✅ Enabled' : 'Identity: ❌ Disabled',
                pg.tag ? `Tag: **${pg.tag}**` : null,
            ].filter(Boolean).join('\n');
            embed.addFields({
                name: '🏰 Primary Guild (Clan)',
                value: line || '*Present*',
                inline: false,
            });
        }

        // ── Nameplate / Collectibles ──
        if (fresh.collectibles?.nameplate) {
            const np = fresh.collectibles.nameplate;
            embed.addFields({
                name: '🪪 Nameplate',
                value: [
                    np.asset ? `Asset: \`${np.asset}\`` : null,
                    np.palette ? `Palette: **${np.palette}**` : null,
                    np.label ? `Label: *${np.label}*` : null,
                ].filter(Boolean).join('\n') || '*Present*',
                inline: false,
            });
        }

        // ── Badges / Public Flags ──
        embed.addFields({
            name: '🏅 Badges',
            value: badgesStr,
            inline: true,
        });

        // ── Banner ──
        if (bannerUrl) {
            embed.setImage(bannerUrl);
            embed.addFields({
                name: '🎨 Banner',
                value: `[Open Banner](${bannerFull})`,
                inline: true,
            });
        }

        // ── Accent colour ──
        if (user.hexAccentColor) {
            embed.addFields({
                name: '🎨 Accent Color',
                value: `\`${user.hexAccentColor}\``,
                inline: true,
            });
        }

        embed
            .setFooter({ text: `Requested by ${caller} · ID: ${user.id}` })
            .setTimestamp();

        console.log(`[USER] ✅ Found ${user.tag} (${user.id})`);
        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error(`[USER] ❌ Error:`, error.message);

        if (error.code === 10007) {
            await interaction.editReply({
                content: `❌ No Discord user found with ID \`${rawId}\`. The account may have been deleted.`,
            });
            return;
        }
        if (error.code === 50001) {
            await interaction.editReply({
                content: '❌ The bot does not have access to that user (they may be in a shared server the bot isn\'t in).',
            });
            return;
        }
        await interaction.editReply({
            content: '❌ An unexpected error occurred while looking up that user.',
        });
    }
}
