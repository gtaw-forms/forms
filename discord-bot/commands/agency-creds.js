import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { loadAgencyCredentials, setAgencyCredential, removeAgencyCredential } from '../services/agencyCredentials.js';

export const data = new SlashCommandBuilder()
    .setName('agency-creds')
    .setDescription('(Owner) Manage faction forum credentials (data/agency-credentials.json)')
    .addSubcommand(sub => sub.setName('list').setDescription('List configured credential domains'))
    .addSubcommand(sub => sub.setName('set')
        .setDescription('Set or update a credential')
        .addStringOption(o => o.setName('domain').setDescription('Forum hostname, e.g. lspd.gta.world').setRequired(true))
        .addStringOption(o => o.setName('username').setDescription('Account username').setRequired(true))
        .addStringOption(o => o.setName('password').setDescription('Account password').setRequired(true)))
    .addSubcommand(sub => sub.setName('remove')
        .setDescription('Remove a credential')
        .addStringOption(o => o.setName('domain').setDescription('Forum hostname, e.g. lspd.gta.world').setRequired(true)));

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can run this.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const sub = interaction.options.getSubcommand();
    try {
        if (sub === 'list') {
            const creds = loadAgencyCredentials();
            const keys = Object.keys(creds);
            await interaction.editReply({
                content: keys.length
                    ? 'Configured credential domains:\n' + keys.map(k => `- \`${k}\``).join('\n')
                    : 'No credentials configured yet.',
            });
        } else if (sub === 'set') {
            const domain = interaction.options.getString('domain');
            const username = interaction.options.getString('username');
            const password = interaction.options.getString('password');
            const key = setAgencyCredential(domain, username, password);
            await interaction.editReply({
                content: `[OK] Credential set for \`${key}\` (morgue-api picks it up immediately).`,
            });
        } else if (sub === 'remove') {
            const domain = interaction.options.getString('domain');
            const key = removeAgencyCredential(domain);
            await interaction.editReply({ content: `[OK] Credential removed for \`${key}\`.` });
        }
    } catch (e) {
        await interaction.editReply({ content: `Error: ${e.message}` });
    }
}
