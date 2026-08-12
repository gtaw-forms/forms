import { SlashCommandBuilder, MessageFlags } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('face-redraft')
    .setDescription('(Owner) Re-kick the Facebrowser post draft for an approved death record')
    .addStringOption(option =>
        option.setName('reportkey')
            .setDescription('The deathRecordDrafts key (e.g. ..._decedent1)')
            .setRequired(true));

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({
            content: 'Only the bot owner can run this command.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const reportKey = interaction.options.getString('reportkey').trim();

    try {
        const { default: firebase } = await import('../services/firebase.js');
        firebase.init();
        const db = firebase.db;

        const drSnap = await db.ref('deathRecordDrafts/' + reportKey).once('value');
        const draftInfo = drSnap.val();
        if (!draftInfo) {
            await interaction.editReply({ content: 'Death record draft not found: `' + reportKey + '`' });
            return;
        }

        const { createFaceDraft } = await import('../services/deathRecordDraft.js');
        const result = await createFaceDraft(db, draftInfo, reportKey, { forumUrl: draftInfo.deployedUrl });

        if (result?.scheduled && result.publishAt) {
            await interaction.editReply({
                content: `Facebrowser post scheduled for ${new Date(result.publishAt).toUTCString()}.`,
            });
        } else if (result?.url) {
            const suffix = result.simulated ? ' [SIMULATED — FACE_DRY_RUN]' : '';
            const action = result.already ? 'already published' : 'published';
            await interaction.editReply({
                content: `Facebrowser post ${action}${suffix}: ${result.url}`,
            });
        } else {
            await interaction.editReply({
                content: 'Facebrowser post failed or was skipped (check bot logs).',
            });
        }
    } catch (err) {
        console.error('[CMD] face-redraft error:', err.message);
        await interaction.editReply({ content: 'Error: ' + err.message.slice(0, 200) });
    }
}
