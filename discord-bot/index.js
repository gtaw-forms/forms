import { Client, GatewayIntentBits, REST, Routes, Collection, MessageFlags } from 'discord.js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ──────────────────────────────────────────
// Load .env manually (avoid dotenv dep)
// ──────────────────────────────────────────
function loadEnv() {
    const envPath = resolve(__dirname, '.env');
    if (!existsSync(envPath)) {
        console.warn('[BOT] ⚠️ No .env file found at', envPath);
        console.warn('[BOT] ⚠️ Copy .env.example to .env and fill in your values');
        return;
    }

    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const sepIndex = trimmed.indexOf('=');
        if (sepIndex === -1) continue;
        const key = trimmed.slice(0, sepIndex).trim();
        const value = trimmed.slice(sepIndex + 1).trim();
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }

    console.log('[BOT] ✅ .env loaded');
}

loadEnv();

// ──────────────────────────────────────────
// Initialize file logger
// ──────────────────────────────────────────
const { initLogger } = await import('./services/logger.js');
initLogger();

// ──────────────────────────────────────────
// Client setup
// ──────────────────────────────────────────
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildEmojisAndStickers,
    ],
});

client.commands = new Collection();

// ──────────────────────────────────────────
// Command registration
// ──────────────────────────────────────────
async function registerCommands() {
    const token = process.env.DISCORD_BOT_TOKEN;
    const guildId = process.env.GUILD_ID;

    if (!token) {
        console.error('[BOT] ❌ DISCORD_BOT_TOKEN is not set in .env');
        process.exit(1);
    }

    console.log('[BOT] 🔧 Registering slash commands...');

    const morgue = await import('./commands/morgue.js');
    const card = await import('./commands/card.js');
    const restart = await import('./commands/restart.js');
    const autopsy = await import('./commands/autopsy.js');
    const user = await import('./commands/user.js');
    const formQueued = await import('./commands/form-queued.js');
    const maintenance = await import('./commands/maintenance.js');
    const dashboard = await import('./commands/dashboard.js');
    const reportSkip = await import('./commands/report-skip.js');
    const deathRecordCheck = await import('./commands/death-record-check.js');
    const deathRecordPending = await import('./commands/death-record-pending.js');
    const pendingReports = await import('./commands/pending-reports.js');
    const purgeDeathDrafts = await import('./commands/purge-death-drafts.js');
    const reportRetry = await import('./commands/report-retry.js');
    const forceAutopsyCheck = await import('./commands/force-autopsy-check.js');
    const autopsyLoa = await import('./commands/autopsy-loa.js');
    const syncAutopsyRequests = await import('./commands/sync-autopsy-requests.js');
    const reassignAutopsy = await import('./commands/reassign-autopsy.js');
    const syncAutopsyPoster = await import('./commands/sync-autopsy-poster.js');
    const forceAutopsySend = await import('./commands/force-autopsy-send.js');
    const assignAutopsy = await import('./commands/assign-autopsy.js');
    const testAutopsy = await import('./commands/test-autopsy.js');
    const forceAutopsyComplete = await import('./commands/force-autopsy-complete.js');
    const autopsySkip = await import('./commands/autopsy-skip.js');
    const rotationList = await import('./commands/rotation-list.js');
    const rotationSet = await import('./commands/rotation-set.js');
    const massAutopsy = await import('./commands/mass-autopsy.js');
    const meDiscord = await import('./commands/set-me-discord.js');
    const testNotify = await import('./commands/test-autopsy-notify.js');
    const patientSearch = await import('./commands/patient-search.js');
    const fixAutopsy = await import('./commands/fix-autopsy.js');
    const groupMorgueCheck = await import('./commands/group-morgue-check.js');
    const faceRedraft = await import('./commands/face-redraft.js');
    const agencyCreds = await import('./commands/agency-creds.js');
    const dev = await import('./commands/dev.js');
    const autopsyRequest = await import('./commands/autopsy-request.js');
    const autopsyStats = await import('./commands/autopsy-stats.js');
    const commands = [
        morgue.data.toJSON(),
        card.data.toJSON(),
        restart.data.toJSON(),
        autopsy.data.toJSON(),
        user.data.toJSON(),
        formQueued.data.toJSON(),
        maintenance.data.toJSON(),
        dashboard.data.toJSON(),
        reportSkip.data.toJSON(),
        deathRecordCheck.data.toJSON(),
        deathRecordPending.data.toJSON(),
        pendingReports.data.toJSON(),
        purgeDeathDrafts.data.toJSON(),
        reportRetry.data.toJSON(),
        forceAutopsyCheck.data.toJSON(),
        autopsyLoa.data.toJSON(),
        syncAutopsyRequests.data.toJSON(),
        reassignAutopsy.data.toJSON(),
        syncAutopsyPoster.data.toJSON(),
        forceAutopsySend.data.toJSON(),
        assignAutopsy.data.toJSON(),
        testAutopsy.data.toJSON(),
        forceAutopsyComplete.data.toJSON(),
        rotationList.data.toJSON(),
        rotationSet.data.toJSON(),
        massAutopsy.data.toJSON(),
        meDiscord.data.toJSON(),
        fixAutopsy.data.toJSON(),
        testNotify.data.toJSON(),
        patientSearch.data.toJSON(),
        groupMorgueCheck.data.toJSON(),
        faceRedraft.data.toJSON(),
        agencyCreds.data.toJSON(),
        dev.data.toJSON(),
        autopsyRequest.data.toJSON(),
        autopsyStats.data.toJSON(),
    ];

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        if (guildId) {
            console.log(`[BOT] 📍 Registering commands for guild: ${guildId}`);
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, guildId),
                { body: commands },
            );
            console.log('[BOT] ✅ Commands registered to guild successfully');
        } else {
            console.log('[BOT] 🌍 Registering commands globally (may take up to 1 hour to propagate)');
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commands },
            );
            console.log('[BOT] ✅ Commands registered globally');
        }
    } catch (error) {
        console.error('[BOT] ❌ Failed to register commands:', error.message);
    }
}

// ──────────────────────────────────────────
// Event handlers
// ──────────────────────────────────────────
client.once('clientReady', async () => {
    console.log('═══════════════════════════════════════════');
    console.log(`[BOT] ✅ Logged in as ${client.user.tag}`);
    console.log(`[BOT] 🌐 Servers: ${client.guilds.cache.size}`);
    console.log(`[BOT] 🆔 Client ID: ${client.user.id}`);
    console.log('═══════════════════════════════════════════');

    // ── Validate required env vars ──
    const REQUIRED_ENV = [
        'DISCORD_BOT_TOKEN',
        'FIREBASE_DATABASE_URL',
        'FIREBASE_ADMIN_KEY_PATH',
        'FORUM_BASE_URL',
        'FORUM_USERNAME',
        'FORUM_PASSWORD',
        'BOT_LOG_CHANNEL_ID',
        'BOT_OWNER_ID',
    ];
    const RECOMMENDED_ENV = [
        'FORUM_LSPD_URL', 'FORUM_LSPD_USERNAME', 'FORUM_LSPD_PASSWORD',
        'FORUM_LSSD_URL', 'FORUM_LSSD_USERNAME', 'FORUM_LSSD_PASSWORD',
        'FORUM_SADCR_URL', 'FORUM_SADCR_USERNAME', 'FORUM_SADCR_PASSWORD',
        'FORUM_DAO_URL', 'FORUM_DAO_USERNAME', 'FORUM_DAO_PASSWORD',
        'CORONER_EMAIL_DRY_RUN', 'CORONER_EMAIL_ALLOWED',
        'MEDICAL_RECORD_DRY_RUN', 'MEDICAL_RECORD_ALLOWED',
    ];
    for (const key of REQUIRED_ENV) {
        if (!process.env[key]) console.warn(`[BOT] ⚠️ Missing required env var: ${key}`);
    }
    for (const key of RECOMMENDED_ENV) {
        if (!process.env[key]) console.log(`[BOT] ℹ️ Optional env var not set: ${key}`);
    }

    // ── Register log channel (for startup, error, crash messages) ──
    const { setLogClient, sendLogMessage } = await import('./services/logChannel.js');
    setLogClient(client);

    // ── Log startup to the log channel ──
    sendLogMessage(null, {
        title: 'Bot Online',
        description: `Logged in as **${client.user.tag}**\nServers: ${client.guilds.cache.size}\nCommands registered.\nAuto-deploy listener active.`,
        color: 0x28a745,
        footer: { text: new Date().toLocaleString() },
    });

    await registerCommands();

    // ── Start auto-deploy listener (monitors Firebase, queues deployments) ──
    try {
        const { startAutoDeploy } = await import('./services/autoDeploy.js');
        startAutoDeploy();
    } catch (err) {
        console.warn('[BOT] ⚠️ Auto-deploy failed to start (non-fatal):', err.message);
    }

    // ── Start system monitor (health checks, morgue overdue, data cleanup) ──
    try {
        const { startSystemMonitor } = await import('./services/systemMonitor.js');
        startSystemMonitor();
    } catch (err) {
        console.warn('[BOT] ⚠️ System monitor failed to start (non-fatal):', err.message);
    }

    // ── Start dashboard manager (live status embed, 5-min refresh) ──
    try {
        const { setDashboardClient, startDashboardManager } = await import('./services/dashboardManager.js');
        setDashboardClient(client);
        startDashboardManager();
    } catch (err) {
        console.warn('[BOT] ⚠️ Dashboard manager failed to start (non-fatal):', err.message);
    }

    // ── Register Death Record Draft client (for Approve/Deny buttons) ──
    try {
        const { setDraftClient } = await import('./services/deathRecordDraft.js');
        setDraftClient(client);
        console.log('[BOT] ✅ Death Record Draft client registered');
    } catch (err) {
        console.warn('[BOT] ⚠️ Death Record Draft client failed to register (non-fatal):', err.message);
    }

    // ── Register Auto-Deploy client (for interactive autopsy topic picker) ──
    try {
        const { setAutoDeployClient } = await import('./services/autoDeploy.js');
        setAutoDeployClient(client);
        console.log('[BOT] ✅ Auto-deploy client registered');
    } catch (err) {
        console.warn('[BOT] ⚠️ Auto-deploy client failed to register (non-fatal):', err.message);
    }

    // ── Start autopsy request monitor (checks forum for new requests) ──
    try {
        const { startAutopsyRequestMonitor } = await import('./services/autopsyRequestMonitor.js');
        startAutopsyRequestMonitor();
    } catch (err) {
        console.warn('[BOT] ⚠️ Autopsy request monitor failed to start (non-fatal):', err.message);
    }

    // ── Start queue dashboard (lightweight deploy queue embed in bot-spam) ──
    try {
        const { setQueueDashboardClient, setupQueueDashboard } = await import('./services/queueDashboard.js');
        setQueueDashboardClient(client);
        const logChannelId = process.env.BOT_LOG_CHANNEL_ID;
        if (logChannelId) {
            await setupQueueDashboard(logChannelId);
            console.log('[BOT] ✅ Queue dashboard posted to bot-spam');
        }
    } catch (err) {
        console.warn('[BOT] ⚠️ Queue dashboard failed to start (non-fatal):', err.message);
    }

    // ── Start CCTV scheduler (fetches all cameras every 6 hours) ──
    try {
        const { startCctvScheduler } = await import('./services/cctvScheduler.js');
        startCctvScheduler();
    } catch (err) {
        console.warn('[BOT] ⚠️ CCTV scheduler failed to start (non-fatal):', err.message);
    }

    // ── Start Face publish sweep (publishes scheduled Face posts after their delay) ──
    try {
        const { startFacePublishSweep } = await import('./services/deathRecordDraftFace.js');
        startFacePublishSweep().catch((err) => console.warn('[BOT] ⚠️ Face publish sweep failed to start (non-fatal):', err.message));
    } catch (err) {
        console.warn('[BOT] ⚠️ Face publish sweep failed to start (non-fatal):', err.message);
    }
});

client.on('interactionCreate', async (interaction) => {
    // Handle dashboard refresh button
    if (interaction.isButton() && interaction.customId === 'dashboard_refresh') {
        const { handleDashboardRefresh } = await import('./services/dashboardManager.js');
        await handleDashboardRefresh(interaction);
        return;
    }

    // Handle dashboard restart button
    if (interaction.isButton() && interaction.customId === 'dashboard_restart') {
        const { handleDashboardRestart } = await import('./services/dashboardManager.js');
        await handleDashboardRestart(interaction);
        return;
    }

    // Handle queue dashboard refresh button
    if (interaction.isButton() && interaction.customId === 'queue_refresh') {
        const { handleQueueRefresh } = await import('./services/queueDashboard.js');
        await handleQueueRefresh(interaction);
        return;
    }

    // Handle Autopsy topic picker buttons (PHMC Case Management + LSSD cross-post)
    const pickPrefixes = ['autopsy_pick_', 'lssd_xp_'];
    if (interaction.isButton() && pickPrefixes.some(p => interaction.customId.startsWith(p))) {
        const { resolveAutopsyTopic } = await import('./services/autoDeploy.js');
        await resolveAutopsyTopic(interaction);
        return;
    }

    // Handle Death Record draft buttons (Approve/Edit/Fields/Check/Deny)
    if (interaction.isButton() && (interaction.customId.startsWith('dr_approve_') || interaction.customId.startsWith('dr_edit_') || interaction.customId.startsWith('dr_editfields_') || interaction.customId.startsWith('dr_checkmorgue_') || interaction.customId.startsWith('dr_deny_'))) {
        const { handleDraftButton } = await import('./services/deathRecordDraft.js');
        await handleDraftButton(interaction);
        return;
    }

    // Handle Death Record draft Edit modal submission
    if (interaction.isModalSubmit() && interaction.customId.startsWith('dr_editbbc_modal_')) {
        const { handleEditModal } = await import('./services/deathRecordDraft.js');
        await handleEditModal(interaction);
        return;
    }

    // Handle Death Record draft Edit Fields modal submission
    if (interaction.isModalSubmit() && interaction.customId.startsWith('dr_editfld_modal_')) {
        const { handleEditFieldsModal } = await import('./services/deathRecordDraft.js');
        await handleEditFieldsModal(interaction);
        return;
    }

    // Handle Facebrowser post draft buttons (Approve/Edit/Deny)
    if (interaction.isButton() && (interaction.customId.startsWith('face_approve_') || interaction.customId.startsWith('face_edit_') || interaction.customId.startsWith('face_deny_'))) {
        const { handleFaceButton } = await import('./services/deathRecordDraft.js');
        await handleFaceButton(interaction);
        return;
    }

    // Handle Facebrowser post draft Edit modal submission
    if (interaction.isModalSubmit() && interaction.customId.startsWith('face_edit_modal_')) {
        const { handleFaceEditModal } = await import('./services/deathRecordDraft.js');
        await handleFaceEditModal(interaction);
        return;
    }

    // Handle Developer panel buttons (dev_*)
    if (interaction.isButton() && interaction.customId.startsWith('dev_')) {
        const { handleDevButton } = await import('./services/devPanel.js');
        await handleDevButton(interaction);
        return;
    }

    // Handle Developer panel Agency Credentials modal
    if (interaction.isModalSubmit() && interaction.customId.startsWith('dev_creds_modal')) {
        const { handleDevCredsModal } = await import('./services/devPanel.js');
        await handleDevCredsModal(interaction);
        return;
    }

    // Handle Developer panel action modals (dev_modal_* — autopsy/death-record args)
    if (interaction.isModalSubmit() && interaction.customId.startsWith('dev_modal_')) {
        const { handleDevActionModal } = await import('./services/devPanel.js');
        await handleDevActionModal(interaction);
        return;
    }

    // Handle autopsy-request preview buttons (Approve / Edit / Deny)
    if (interaction.isButton() && (interaction.customId.startsWith('ar_appr_') || interaction.customId.startsWith('ar_edit_') || interaction.customId.startsWith('ar_deny_'))) {
        const { handleButton } = await import('./commands/autopsy-request.js');
        await handleButton(interaction);
        return;
    }

    // Handle autopsy-request chained modal submissions
    if (interaction.isModalSubmit() && interaction.customId.startsWith('ar_modal_')) {
        const { handleModal } = await import('./commands/autopsy-request.js');
        await handleModal(interaction);
        return;
    }

    // Handle /report-retry select menu
    if (interaction.isStringSelectMenu() && interaction.customId === 'retry_report_select') {
        const ownerId = process.env.BOT_OWNER_ID;
        if (!ownerId || interaction.user.id !== ownerId) {
            await interaction.reply({
                content: 'Only the bot owner can retry reports.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const value = interaction.values[0];
        const [authorId, reportKey] = value.split('|');

        const { default: firebase } = await import('./services/firebase.js');
        firebase.init();
        const db = firebase.db;

        try {
            // Reset the report so the listener picks it up
            await db.ref(`scheduledReports/${authorId}/${reportKey}`).update({
                deployStatus: 'queued',
                deployMessage: 'Re-queued by staff via /report-retry',
                deployCheckedAt: new Date().toISOString(),
                hasdeployed: false,
                retryAt: null,
            });

            // Remove from knownReportKeys so the value listener re-processes it
            const { getQueuedDeployments } = await import('./services/autoDeploy.js');

            const embed = new EmbedBuilder()
                .setColor(0x28a745)
                .setTitle('Report Re-queued')
                .setDescription(`**${reportKey}** has been reset and will be picked up by the deploy listener shortly.`)
                .setFooter({ text: `Retried by ${interaction.user.tag}` })
                .setTimestamp();
            await interaction.update({ embeds: [embed], components: [] });
        } catch (err) {
            console.error('[RETRY] Failed to retry report:', err.message);
            await interaction.update({
                content: `Failed to retry: ${err.message}`,
                embeds: [],
                components: [],
            });
        }
        return;
    }

    // Handle skip_report_select
    if (interaction.isStringSelectMenu() && interaction.customId === 'skip_report_select') {
        const ownerId = process.env.BOT_OWNER_ID;
        if (!ownerId || interaction.user.id !== ownerId) {
            await interaction.reply({
                content: 'Only the bot owner can skip queued reports.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const entityKey = interaction.values[0];
        const { skipReport } = await import('./services/autoDeploy.js');
        const result = await skipReport(entityKey, interaction.user.tag);

        const { EmbedBuilder } = await import('discord.js');
        if (result.ok) {
            const embed = new EmbedBuilder()
                .setColor(0x9b59b6)
                .setTitle('Report Skipped')
                .setDescription(`**${result.label}** has been removed from the deploy queue and marked as \`skipped_manual\`.`)
                .setFooter({ text: `Skipped by ${interaction.user.tag}` })
                .setTimestamp();
            await interaction.update({ embeds: [embed], components: [] });
        } else {
            const embed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle('Could Not Skip')
                .setDescription(result.error || 'An unknown error occurred.')
                .setTimestamp();
            await interaction.update({ embeds: [embed], components: [] });
        }
        return;
    }

    // Handle reassign-autopsy case pick
    if (interaction.isStringSelectMenu() && interaction.customId === 'reassign_case_pick') {
        const { onCasePick } = await import('./commands/reassign-autopsy.js');
        await onCasePick(interaction);
        return;
    }

    // Handle reassign-autopsy ME pick
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('reassign_me_pick_')) {
        const { onMePick } = await import('./commands/reassign-autopsy.js');
        await onMePick(interaction);
        return;
    }

    // Handle autocomplete for commands that support it
    if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (command?.autocomplete) {
            try {
                await command.autocomplete(interaction);
            } catch (err) {
                console.error(`[BOT] ❌ Autocomplete error for /${interaction.commandName}:`, err.message);
            }
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    console.log(`[BOT] 🎯 Command received: /${interaction.commandName} from ${interaction.user.tag} (${interaction.user.id})`);

    const command = client.commands.get(interaction.commandName);
    if (!command) {
        console.log(`[BOT] ⚠️ Unknown command: ${interaction.commandName}`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        // DiscordAPIError[10062] = Unknown interaction (expired 3s window) — silent skip
        if (error?.code === 10062) {
            console.log(`[BOT] ⏰ Interaction expired for /${interaction.commandName} — skipped reply`);
            return;
        }
        console.error(`[BOT] ❌ Error executing /${interaction.commandName}:`, error);
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: '❌ An unexpected error occurred. Please try again.',
                    flags: MessageFlags.Ephemeral,
                });
            } else {
                await interaction.reply({
                    content: '❌ An unexpected error occurred. Please try again.',
                    flags: MessageFlags.Ephemeral,
                });
            }
        } catch (replyErr) {
            // If the reply itself also fails (e.g. already expired), just log and move on
            if (replyErr?.code !== 10062) {
                console.error(`[BOT] ⚠️ Failed to send error reply:`, replyErr.message);
            }
        }
    }
});

// ── Crash handlers (set up before login to catch early crashes) ──
// Logs to both the file (via logger.js) and the Discord log channel.
process.on('uncaughtException', async (error) => {
    console.error(`[BOT] 💥 UNCAUGHT EXCEPTION: ${error.message}`);
    console.error(error.stack);
    try {
        const { sendCrashReport } = await import('./services/logChannel.js');
        await sendCrashReport('Uncaught Exception', error);
    } catch { /* best effort */ }
});

process.on('unhandledRejection', async (reason) => {
    console.error(`[BOT] 💥 UNHANDLED REJECTION:`, reason);
    try {
        const { sendCrashReport } = await import('./services/logChannel.js');
        await sendCrashReport('Unhandled Rejection', reason);
    } catch { /* best effort */ }
});

// ──────────────────────────────────────────
// Start bot
// ──────────────────────────────────────────
async function start() {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
        console.error('[BOT] ❌ DISCORD_BOT_TOKEN is not set. Create a .env file from .env.example');
        process.exit(1);
    }

    // Load command modules
    const morgueCmd = await import('./commands/morgue.js');
    client.commands.set(morgueCmd.data.name, { execute: morgueCmd.execute });

    const cardCmd = await import('./commands/card.js');
    client.commands.set(cardCmd.data.name, { execute: cardCmd.execute });

    const restartCmd = await import('./commands/restart.js');
    client.commands.set(restartCmd.data.name, { execute: restartCmd.execute });

    const autopsyCmd = await import('./commands/autopsy.js');
    client.commands.set(autopsyCmd.data.name, { execute: autopsyCmd.execute });

    const userCmd = await import('./commands/user.js');
    client.commands.set(userCmd.data.name, { execute: userCmd.execute });

    const formQueuedCmd = await import('./commands/form-queued.js');
    client.commands.set(formQueuedCmd.data.name, { execute: formQueuedCmd.execute });

    const maintenanceCmd = await import('./commands/maintenance.js');
    client.commands.set(maintenanceCmd.data.name, { execute: maintenanceCmd.execute });

    const dashboardCmd = await import('./commands/dashboard.js');
    client.commands.set(dashboardCmd.data.name, { execute: dashboardCmd.execute });

    const reportSkipCmd = await import('./commands/report-skip.js');
    client.commands.set(reportSkipCmd.data.name, { execute: reportSkipCmd.execute });

    const deathRecordCheckCmd = await import('./commands/death-record-check.js');
    client.commands.set(deathRecordCheckCmd.data.name, { execute: deathRecordCheckCmd.execute });

    const deathRecordPendingCmd = await import('./commands/death-record-pending.js');
    client.commands.set(deathRecordPendingCmd.data.name, { execute: deathRecordPendingCmd.execute });

    const pendingReportsCmd = await import('./commands/pending-reports.js');
    client.commands.set(pendingReportsCmd.data.name, { execute: pendingReportsCmd.execute });

    const purgeDeathDraftsCmd = await import('./commands/purge-death-drafts.js');
    client.commands.set(purgeDeathDraftsCmd.data.name, { execute: purgeDeathDraftsCmd.execute });

    const reportRetryCmd = await import('./commands/report-retry.js');
    client.commands.set(reportRetryCmd.data.name, { execute: reportRetryCmd.execute });

    const forceAutopsyCheckCmd = await import('./commands/force-autopsy-check.js');
    client.commands.set(forceAutopsyCheckCmd.data.name, { execute: forceAutopsyCheckCmd.execute });

    const autopsyLoaCmd = await import('./commands/autopsy-loa.js');
    client.commands.set(autopsyLoaCmd.data.name, { execute: autopsyLoaCmd.execute });

    const syncAutopsyRequestsCmd = await import('./commands/sync-autopsy-requests.js');
    client.commands.set(syncAutopsyRequestsCmd.data.name, { execute: syncAutopsyRequestsCmd.execute });

    const reassignAutopsyCmd = await import('./commands/reassign-autopsy.js');
    client.commands.set(reassignAutopsyCmd.data.name, { execute: reassignAutopsyCmd.execute });

    const syncAutopsyPosterCmd = await import('./commands/sync-autopsy-poster.js');
    client.commands.set(syncAutopsyPosterCmd.data.name, { execute: syncAutopsyPosterCmd.execute });

    const forceAutopsySendCmd = await import('./commands/force-autopsy-send.js');
    client.commands.set(forceAutopsySendCmd.data.name, { execute: forceAutopsySendCmd.execute });

    const assignAutopsyCmd = await import('./commands/assign-autopsy.js');
    client.commands.set(assignAutopsyCmd.data.name, { execute: assignAutopsyCmd.execute });

    const autopsyRequestCmd = await import('./commands/autopsy-request.js');
    client.commands.set(autopsyRequestCmd.data.name, { execute: autopsyRequestCmd.execute, autocomplete: autopsyRequestCmd.autocomplete });

    const autopsyStatsCmd = await import('./commands/autopsy-stats.js');
    client.commands.set(autopsyStatsCmd.data.name, { execute: autopsyStatsCmd.execute });

    const testAutopsyCmd = await import('./commands/test-autopsy.js');
    client.commands.set(testAutopsyCmd.data.name, { execute: testAutopsyCmd.execute });

    const forceAutopsyCompleteCmd = await import('./commands/force-autopsy-complete.js');
    client.commands.set(forceAutopsyCompleteCmd.data.name, { execute: forceAutopsyCompleteCmd.execute });
    const autopsySkipCmd = await import('./commands/autopsy-skip.js');
    client.commands.set(autopsySkipCmd.data.name, { execute: autopsySkipCmd.execute });
    const fixAutopsyCmd = await import('./commands/fix-autopsy.js');
    client.commands.set(fixAutopsyCmd.data.name, { execute: fixAutopsyCmd.execute });

    const rotationListCmd = await import('./commands/rotation-list.js');
    client.commands.set(rotationListCmd.data.name, { execute: rotationListCmd.execute });

    const rotationSetCmd = await import('./commands/rotation-set.js');
    client.commands.set(rotationSetCmd.data.name, { execute: rotationSetCmd.execute, autocomplete: rotationSetCmd.autocomplete });

    const patientSearchCmd = await import('./commands/patient-search.js');
    client.commands.set(patientSearchCmd.data.name, { execute: patientSearchCmd.execute });

    const massAutopsyCmd = await import('./commands/mass-autopsy.js');
    client.commands.set(massAutopsyCmd.data.name, { execute: massAutopsyCmd.execute });

    const meDiscordCmd = await import('./commands/set-me-discord.js');
    client.commands.set(meDiscordCmd.data.name, { execute: meDiscordCmd.execute });

    const testNotifyCmd = await import('./commands/test-autopsy-notify.js');
    client.commands.set(testNotifyCmd.data.name, { execute: testNotifyCmd.execute });

    const groupMorgueCheckCmd = await import('./commands/group-morgue-check.js');
    client.commands.set(groupMorgueCheckCmd.data.name, { execute: groupMorgueCheckCmd.execute });

    const faceRedraftCmd = await import('./commands/face-redraft.js');
    client.commands.set(faceRedraftCmd.data.name, { execute: faceRedraftCmd.execute });

    const agencyCredsCmd = await import('./commands/agency-creds.js');
    client.commands.set(agencyCredsCmd.data.name, { execute: agencyCredsCmd.execute });

    const devCmd = await import('./commands/dev.js');
    client.commands.set(devCmd.data.name, { execute: devCmd.execute });

    console.log('[BOT] 🔌 Connecting to Discord...');
    await client.login(token);
}

start().catch(error => {
    console.error('[BOT] ❌ Failed to start:', error.message);
    process.exit(1);
});
