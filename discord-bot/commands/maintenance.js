import {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('maintenance')
    .setDescription('Pause/resume deploy queues and set the web maintenance splash (owner only)')
    .addSubcommand(sub => sub
        .setName('on')
        .setDescription('Pause all queued and future deployments')
    )
    .addSubcommand(sub => sub
        .setName('off')
        .setDescription('Resume auto-deployments')
    )
    .addSubcommand(sub => sub
        .setName('status')
        .setDescription('Check if maintenance mode is active')
    )
    .addSubcommandGroup(group => group
        .setName('splash')
        .setDescription('Full-screen maintenance/outage splash for the web app')
        .addSubcommand(sub => sub
            .setName('on')
            .setDescription('Show the splash and pause all queues')
            .addStringOption(o => o
                .setName('title')
                .setDescription('Splash title (e.g. Major Maintenance)')
                .setRequired(true))
            .addStringOption(o => o
                .setName('message')
                .setDescription('Splash message shown to users')
                .setRequired(true))
            .addStringOption(o => o
                .setName('eta')
                .setDescription('Optional ETA text (e.g. approx. 2 hours)')
                .setRequired(false)))
        .addSubcommand(sub => sub
            .setName('off')
            .setDescription('Lift the splash and resume all queues')
        )
        .addSubcommand(sub => sub
            .setName('status')
            .setDescription('Show current splash + queue-pause state')
        )
    );

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;

    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({
            content: '❌ Only the bot owner can use this command.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const { isMaintenanceMode, setMaintenanceMode } = await import('../services/autoDeploy.js');
        const firebase = (await import('../services/firebase.js')).default;
        firebase.init();
        const db = firebase.db;

        const group = interaction.options.getSubcommandGroup(false);
        const sub = interaction.options.getSubcommand();

        // ── Splash screen (web overlay) ──
        if (group === 'splash') {
            const maintenancePath = 'appMetadata/maintenance';
            const current = (await db.ref(maintenancePath).once('value')).val() || {};
            const splash = current.splash || {};
            const who = `discord:${interaction.user.username}`;

            if (sub === 'status') {
                const queuePaused = await isMaintenanceMode();
                const embed = new EmbedBuilder()
                    .setColor(splash.active ? 0xffc107 : 0x2ecc71)
                    .setTitle(splash.active ? '🚧 Maintenance Splash: ON' : 'Maintenance Splash: OFF')
                    .setDescription(splash.active
                        ? `**${splash.title || 'Maintenance'}**\n${splash.message || ''}${splash.eta ? `\n⏱ ETA: ${splash.eta}` : ''}`
                        : 'No full-screen splash is active.')
                    .addFields(
                        { name: 'Deploy queues', value: queuePaused ? '⏸️ Paused (all deploys)' : '✅ Active' },
                        { name: 'Last set by', value: splash.updatedBy || '—' }
                    )
                    .setFooter({ text: 'Use /maintenance splash on|off to change' })
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            if (sub === 'on') {
                const title = interaction.options.getString('title');
                const message = interaction.options.getString('message');
                const eta = interaction.options.getString('eta') || '';
                await db.ref(maintenancePath).set({
                    ...current,
                    active: true,
                    splash: { active: true, title, message, eta, updatedBy: who, updatedAt: Date.now() },
                    updatedAt: Date.now(),
                    updatedBy: who,
                });
                await setMaintenanceMode(true, db);
                const embed = new EmbedBuilder()
                    .setColor(0xffc107)
                    .setTitle('🚧 Maintenance Splash Enabled')
                    .setDescription(`**${title}**\n${message}${eta ? `\n⏱ ETA: ${eta}` : ''}\n\n⏸️ All deploy queues paused.`)
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            // sub === 'off'
            await db.ref(maintenancePath).set({
                ...current,
                active: false,
                splash: { ...splash, active: false, updatedBy: who, updatedAt: Date.now() },
                updatedAt: Date.now(),
                updatedBy: who,
            });
            await setMaintenanceMode(false, db);
            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('✅ Maintenance Splash Disabled')
                .setDescription('Splash lifted. All deploy queues resumed.')
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // ── Legacy queue maintenance (on/off/status) ──
        if (sub === 'status') {
            const mode = await isMaintenanceMode();
            const embed = new EmbedBuilder()
                .setColor(mode ? 0xffc107 : 0x2ecc71)
                .setTitle(mode ? '⏸️ Maintenance Mode: ON' : '✅ Maintenance Mode: OFF')
                .setDescription(mode
                    ? 'Auto-deployments are paused. No reports will be queued or sent.'
                    : 'Auto-deployments are active. New reports will be queued normally.')
                .setFooter({ text: 'Use /maintenance on|off to toggle' })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        const enabling = sub === 'on';
        await setMaintenanceMode(enabling, db);

        const embed = new EmbedBuilder()
            .setColor(enabling ? 0xffc107 : 0x2ecc71)
            .setTitle(enabling ? '⏸️ Maintenance Mode Enabled' : '✅ Maintenance Mode Disabled')
            .setDescription(enabling
                ? 'All pending deployments have been cancelled. New reports will not be queued.'
                : 'Auto-deployments have resumed. New reports will be queued normally.')
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('[MAINTENANCE] ❌ Error:', error.message);
        await interaction.editReply({ content: `❌ ${error.message}` });
    }
}
