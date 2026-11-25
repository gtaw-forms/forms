import { Client, GatewayIntentBits, Partials, REST, Routes, Collection, MessageFlags, EmbedBuilder } from 'discord.js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { isOwnerOrWhitelisted } from './services/permissions.js';

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
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
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

    // Command modules — auto-loaded from commands/ (services/commandLoader.js).
    // Adding a new file there registers it everywhere below; no list to update.
    const { loadCommandModules } = await import('./services/commandLoader.js');
    const loadedCommands = await loadCommandModules();
    const commands = loadedCommands.map((c) => c.data.toJSON());

    // PHMC guild gets a trimmed public set (env-overridable); the primary
    // guild keeps the full arsenal. Guild IDs are committable, not secrets.
    const phmcGuildId = process.env.PHMC_GUILD_ID || '860254678653992992';
    const phmcCommandNames = (process.env.PHMC_COMMANDS || 'reassign-autopsy,autopsy-loa,card,outstanding-autopsies,repost-mass-panel,manage-forms')
        .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        if (guildId) {
            console.log(`[BOT] 📍 Registering commands for guild: ${guildId}`);
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, guildId),
                { body: commands },
            );
            console.log('[BOT] ✅ Commands registered to guild successfully');
            if (phmcGuildId && phmcGuildId !== guildId) {
                const trimmed = commands.filter(c => phmcCommandNames.includes(String(c.name || '').toLowerCase()));
                for (const n of phmcCommandNames) {
                    if (!trimmed.some(c => String(c.name || '').toLowerCase() === n)) {
                        console.warn(`[BOT] ⚠️ PHMC command '${n}' not found in registry — skipped`);
                    }
                }
                console.log(`[BOT] 📍 Registering ${trimmed.length} trimmed commands for PHMC guild: ${phmcGuildId}`);
                await rest.put(
                    Routes.applicationGuildCommands(client.user.id, phmcGuildId),
                    { body: trimmed },
                );
                console.log('[BOT] ✅ Trimmed commands registered to PHMC guild');
            }
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

    // ── Register bot client for PHMC-channel sends (autopsies notices) ──
    try {
        const { setPhmcClient } = await import('./services/phmcChannels.js');
        setPhmcClient(client);
    } catch (err) {
        console.warn('[BOT] ⚠️ PHMC channel client failed to register (non-fatal):', err.message);
    }

    // ── Register bot client for mass-autopsy ME panels (name buttons) ──
    try {
        const { setMassPanelClient, startMassPanelWatcher } = await import('./services/massAssignmentPanel.js');
        setMassPanelClient(client);
        startMassPanelWatcher(client);
    } catch (err) {
        console.warn('[BOT] ⚠️ Mass panel client failed to register (non-fatal):', err.message);
    }

    // ── Register bot client for mass-autopsy V2 panels (live cutover) ──
    try {
        const { setMassPanelV2Client, startMassPanelV2Watcher } = await import('./services/massPanelV2.js');
        setMassPanelV2Client(client);
        startMassPanelV2Watcher(client);
    } catch (err) {
        console.warn('[BOT] ⚠️ Mass V2 panel client failed to register (non-fatal):', err.message);
    }

    // ── Register bot client for single-autopsy V2 panels (info/reassign) ──
    try {
        const { setSinglePanelClient } = await import('./services/singlePanelV2.js');
        setSinglePanelClient(client);
    } catch (err) {
        console.warn('[BOT] ⚠️ Single V2 panel client failed to register (non-fatal):', err.message);
    }

    // ── Rich presence baseline (idle until a task pushes a label) ──
    try {
        const { setPresenceClient, initPresence } = await import('./services/presence.js');
        setPresenceClient(client);
        initPresence();
    } catch (err) {
        console.warn('[BOT] ⚠️ Presence init failed (non-fatal):', err.message);
    }

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

    // ── Start central tick scheduler (single 30s evaluator; ticks register via registerTick) ──
    try {
        const { startScheduler } = await import('./services/scheduler.js');
        startScheduler();
    } catch (err) {
        console.warn('[BOT] ⚠️ Scheduler failed to start (non-fatal):', err.message);
    }

    // ── Start dashboard manager (live status embed, 5-min refresh) ──
    try {
        const { setDashboardClient, startDashboardManager } = await import('./services/dashboardManager.js');
        setDashboardClient(client);
        startDashboardManager();
    } catch (err) {
        console.warn('[BOT] ⚠️ Dashboard manager failed to start (non-fatal):', err.message);
    }

    // ── Start AdGuard Home metrics dashboard (10-min refresh) ──
    try {
        const { setAghClient, startAghMetrics } = await import('./services/aghMetrics.js');
        setAghClient(client);
        startAghMetrics();
    } catch (err) {
        console.warn('[BOT] ⚠️ AGH metrics manager failed to start (non-fatal):', err.message);
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

    // ── Start web autopsy request poster (autopsy-requests/pending -> f=265) ──
    try {
        const { startWebAutopsyRequestPoster } = await import('./services/webAutopsyRequestPoster.js');
        startWebAutopsyRequestPoster();
    } catch (err) {
        console.warn('[BOT] ⚠️ Web autopsy request poster failed to start (non-fatal):', err.message);
    }

    // ── Start web PRIVATE autopsy intake (autopsy-requests/private-pending ->
    // confidential f=266 case; PRIVATE_WEB_MODE=off by default) ──
    try {
        const { startPrivateWebAutopsyIntake } = await import('./services/privateWebAutopsyIntake.js');
        startPrivateWebAutopsyIntake();
    } catch (err) {
        console.warn('[BOT] ⚠️ Web private autopsy intake failed to start (non-fatal):', err.message);
    }

    // ── Start deploy notifier (deployNotifications -> log channel) ──
    try {
        const { startDeployNotifier } = await import('./services/deployNotifier.js');
        startDeployNotifier();
    } catch (err) {
        console.warn('[BOT] ⚠️ Deploy notifier failed to start (non-fatal):', err.message);
    }

    // ── Start morgue-match logger (morgueMatchLogs -> log channel) ──
    try {
        const { startMorgueMatchLogger } = await import('./services/morgueMatchLogger.js');
        startMorgueMatchLogger();
    } catch (err) {
        console.warn('[BOT] ⚠️ Morgue-match logger failed to start (non-fatal):', err.message);
    }

    // ── Start coroner-email worker (dedicated queue entity; Phase 0 — ──
    // Firebase listener only, no forum traffic at boot) ──
    try {
        const firebase = (await import('./services/firebase.js')).default;
        firebase.init();
        const { startCoronerEmailWorker } = await import('./services/coronerEmailQueue.js');
        startCoronerEmailWorker(firebase.db);
    } catch (err) {
        console.warn('[BOT] ⚠️ Coroner-email worker failed to start (non-fatal):', err.message);
    }

    // ── Start portal-forms worker (lspd-portal-form-queue entity; same ──
    // lifecycle as the coroner-email queue; dry-run verify only by default) ──
    try {
        const firebase = (await import('./services/firebase.js')).default;
        firebase.init();
        const { startPortalFormWorker } = await import('./services/lspdPortalFormQueue.js');
        startPortalFormWorker(firebase.db);
    } catch (err) {
        console.warn('[BOT] ⚠️ Portal-forms worker failed to start (non-fatal):', err.message);
    }

    // ── Start forms cache sync (mirror RTDB forms/forms_staging to VPS disk) ──
    try {
        const firebase = (await import('./services/firebase.js')).default;
        firebase.init();
        const { startFormsCacheSync } = await import('./services/formsCacheSync.js');
        startFormsCacheSync(firebase.db);
    } catch (err) {
        console.warn('[BOT] ⚠️ Forms cache sync failed to start (non-fatal):', err.message);
    }

    // ── Start test-run reporter (testRun/active -> DeployProgressEmbed) ──
    try {
        const firebase = (await import('./services/firebase.js')).default;
        firebase.init();
        const { startTestRunReporter } = await import('./services/testRunReporter.js');
        startTestRunReporter(firebase.db, client);
    } catch (err) {
        console.warn('[BOT] [WARN] Test-run reporter failed to start (non-fatal):', err.message);
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

    // ── Start CCTV scheduler (daily fetch of all cameras via fetch-all.cjs) ──
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

    // ── Restore feedback session (single-slot; reattach to OpenCode) ──
    try {
        const { restoreActiveSession } = await import('./services/feedback/controller.js');
        await restoreActiveSession(client);
    } catch (err) {
        console.warn('[BOT] ⚠️ Feedback restore failed (non-fatal):', err.message);
    }

    // ── Phased boot queue (forum-heavy starters, one at a time) ──
    // Phase 0 above touched Discord/Firebase only. The recovery heartbeat keeps
    // its own 30s timer (failed work first — unchanged). Everything below runs
    // strictly in order via the shared browser warmup + global forum gate.
    try {
        const { runStartupQueue, warmupBrowser, WARMUP_DELAY_MS } = await import('./services/startupQueue.js');
        const queue = [
            {
                name: 'browser-warmup',
                run: async () => {
                    await new Promise((r) => setTimeout(r, WARMUP_DELAY_MS));
                    await warmupBrowser();
                },
            },
            {
                // Awaits the real sync (starter now returns it) — or returns
                // fast when the cooldown schedules it later.
                name: 'roster-sync',
                run: async () => {
                    const { startFactionRosterSync } = await import('./services/factionRosterSync.js');
                    await startFactionRosterSync();
                },
            },
            {
                // Awaits the real first scan, then starts the monitor without
                // repeating it (rotation init continues in background, gated).
                name: 'autopsy-monitor',
                run: async () => {
                    const { checkForNewRequests, startAutopsyRequestMonitor } = await import('./services/autopsyRequestMonitor.js');
                    await checkForNewRequests();
                    startAutopsyRequestMonitor({ immediate: false });
                },
            },
        ];
        runStartupQueue(queue).catch((err) => console.warn('[BOT] ⚠️ Phased boot queue failed (non-fatal):', err.message));
    } catch (err) {
        console.warn('[BOT] ⚠️ Phased boot queue failed to start (non-fatal):', err.message);
    }
});

client.on('interactionCreate', async (interaction) => {
    // Abuse-observable audit trail: every interaction -> file log, sensitive
    // commands -> Discord log channel. Never throws (best effort).
    let auditCtx = null;
    try {
        const { auditReceive } = await import('./services/auditLog.js');
        auditCtx = auditReceive(interaction);
    } catch { /* audit must never break command handling */ }

    // Handle dashboard refresh button
    if (interaction.isButton() && interaction.customId === 'dashboard_refresh') {
        const { handleDashboardRefresh } = await import('./services/dashboardManager.js');
        await handleDashboardRefresh(interaction);
        return;
    }

    // Handle Feedback bot buttons (fb:<action>:<sessionId> — owner only)
    if (interaction.isButton() && interaction.customId.startsWith('fb:')) {
        const { onFeedbackButton } = await import('./services/feedback/controller.js');
        if (await onFeedbackButton(interaction)) return;
    }

    // Handle /global-stats page buttons (Overview / Full Breakdown / Heatmap)
    if (interaction.isButton() && interaction.customId.startsWith('global_stats_page_')) {
        const { handleStatsPage } = await import('./commands/global-stats.js');
        await handleStatsPage(interaction);
        return;
    }

    // Handle dashboard restart button
    if (interaction.isButton() && interaction.customId === 'dashboard_restart') {
        const { handleDashboardRestart } = await import('./services/dashboardManager.js');
        await handleDashboardRestart(interaction);
        return;
    }

    // Handle AGH metrics refresh button (optional — AGH files are personal/gitignored)
    if (interaction.isButton() && interaction.customId === 'agh_refresh') {
        try {
            const { handleAghRefresh } = await import('./services/aghMetrics.js');
            await handleAghRefresh(interaction);
        } catch (err) {
            console.warn('[BOT] ⚠️ AGH refresh handler unavailable:', err.message);
        }
        return;
    }

    // Handle queue dashboard refresh button
    if (interaction.isButton() && interaction.customId === 'queue_refresh') {
        const { handleQueueRefresh } = await import('./services/queueDashboard.js');
        await handleQueueRefresh(interaction);
        return;
    }

    // Handle Information panel section buttons
    if (interaction.isButton() && interaction.customId.startsWith('info_')) {
        const { handleInfoButton } = await import('./services/infoPanel.js');
        if (await handleInfoButton(interaction)) return;
    }

    // Handle Autopsy topic picker buttons (PHMC Case Management + LSSD cross-post)
    const pickPrefixes = ['autopsy_pick_', 'lssd_xp_'];
    if (interaction.isButton() && pickPrefixes.some(p => interaction.customId.startsWith(p))) {
        const { resolveAutopsyTopic } = await import('./services/autoDeploy.js');
        await resolveAutopsyTopic(interaction);
        return;
    }

    // Handle Mass Autopsy ME panel buttons (mass_<panelId>_<meIdx> / mass_<panelId>_cancel)
    if (interaction.isButton() && interaction.customId.startsWith('mass_')) {
        const { handleMassPanelButton } = await import('./services/massAssignmentPanel.js');
        await handleMassPanelButton(interaction);
        return;
    }

    // Handle Mass Autopsy V2 PROTOTYPE panel buttons (massv2_<panelId>_<slot>)
    if (interaction.isButton() && interaction.customId.startsWith('massv2_')) {
        const { handleMassPanelV2Button } = await import('./services/massPanelV2.js');
        await handleMassPanelV2Button(interaction);
        return;
    }

    // Handle Single Autopsy V2 panel buttons (singlev2_<panelId>_<slot>)
    if (interaction.isButton() && interaction.customId.startsWith('singlev2_')) {
        const { handleSinglePanelV2Button } = await import('./services/singlePanelV2.js');
        await handleSinglePanelV2Button(interaction);
        return;
    }

    // Handle /me-discord interactive mapping (Add buttons → Discord-ID modal)
    if (interaction.isButton() && interaction.customId.startsWith('me_map_')) {
        const { handleMeMapButton } = await import('./commands/set-me-discord.js');
        await handleMeMapButton(interaction);
        return;
    }
    if (interaction.isModalSubmit() && interaction.customId.startsWith('me_modal_')) {
        const { handleMeMapModal } = await import('./commands/set-me-discord.js');
        await handleMeMapModal(interaction);
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

    // Handle Feedback ask-question modal (fb:ask:new — opened by /feedback)
    if (interaction.isModalSubmit() && interaction.customId.startsWith('fb:ask:')) {
        const { onFeedbackAskModal } = await import('./services/feedback/controller.js');
        if (await onFeedbackAskModal(interaction)) return;
    }

    // Handle Feedback answer-questions modal (fb:answer:<sessionId>)
    if (interaction.isModalSubmit() && interaction.customId.startsWith('fb:answer:')) {
        const { onFeedbackModal } = await import('./services/feedback/controller.js');
        if (await onFeedbackModal(interaction)) return;
    }

    // Handle /report-retry select menu
    if (interaction.isStringSelectMenu() && interaction.customId === 'retry_report_select') {
        if (!isOwnerOrWhitelisted(interaction)) {
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
            // (without this the reset above is silently ignored — the key was
            // primed as seen and the listener skips known keys).
            const { state } = await import('./services/deployState.js');
            try { state.knownReportKeys?.delete(reportKey); } catch { /* ignore */ }

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
        if (!isOwnerOrWhitelisted(interaction)) {
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

    // Handle Mass Autopsy V2 PROTOTYPE unified reassign modal submit
    // (massv2_reasmodal_<panelId>) — opened by the Reassign button above
    if (interaction.isModalSubmit() && interaction.customId.startsWith('massv2_reasmodal_')) {
        const { handleMassPanelV2ReassignModal } = await import('./services/massPanelV2.js');
        if (await handleMassPanelV2ReassignModal(interaction)) return;
    }
    if (interaction.isModalSubmit() && interaction.customId.startsWith('singlev2_reasmodal_')) {
        const { handleSinglePanelV2ReassignModal } = await import('./services/singlePanelV2.js');
        if (await handleSinglePanelV2ReassignModal(interaction)) return;
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
        try {
            const { auditCommandDone } = await import('./services/auditLog.js');
            auditCommandDone(auditCtx, { ok: true });
        } catch { /* best effort */ }
    } catch (error) {
        try {
            const { auditCommandDone } = await import('./services/auditLog.js');
            auditCommandDone(auditCtx, { ok: false, error });
        } catch { /* best effort */ }
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

// ── Feedback DMs: the owner answers plan questions by DM; that DM is the session ──
client.on('messageCreate', async (message) => {
    try {
        if (message.author?.bot) return;
        if (message.guildId) return; // DMs only
        const { onOwnerDm } = await import('./services/feedback/controller.js');
        await onOwnerDm(message);
    } catch (err) {
        console.warn('[BOT] Feedback DM handler failed (non-fatal):', err.message);
    }
});

// ── Guild join/leave flags (abuse-observable: a surprise server join pages
// the owner immediately; leaves are logged quietly) ──
client.on('guildCreate', async (guild) => {
    try {
        const { sendLogMessage } = await import('./services/logChannel.js');
        const ownerId = process.env.BOT_OWNER_ID || '228306972204597248';
        const info = `${guild.name} (id ${guild.id}, ~${guild.memberCount ?? '?'} members, ownerId ${guild.ownerId ?? '?'})`;
        console.log(`[BOT] [AUDIT] Joined new server: ${info}`);
        await sendLogMessage(`<@${ownerId}> Priority Note: Server Joined: ${info}`, {
            title: 'Server Joined',
            description: `**${guild.name}**\nServer ID: \`${guild.id}\`\nMembers: ~${guild.memberCount ?? '?'}\nOwner ID: \`${guild.ownerId ?? '?'}\`\nJoined: <t:${Math.floor(Date.now() / 1000)}:F>`,
            color: 0xe74c3c,
            footer: { text: 'If this was not expected, remove the bot and rotate the token if leaked.' },
        });
    } catch { /* best effort — never break gateway handling */ }
});

client.on('guildDelete', async (guild) => {
    try {
        const { sendLogMessage } = await import('./services/logChannel.js');
        console.log(`[BOT] [AUDIT] Removed from server: ${guild.name} (${guild.id})`);
        await sendLogMessage(null, {
            title: 'Server Left',
            description: `**${guild.name}**\nServer ID: \`${guild.id}\``,
            color: 0x6c757d,
        });
    } catch { /* best effort */ }
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
    // Fail fast: an uncaught exception leaves the process in an unknown state
    // (e.g. a half-connected Discord websocket after a handshake timeout). Exit
    // so pm2 does a clean restart instead of the bot limping along broken.
    process.exit(1);
});

// ── Graceful shutdown (pm2 sends SIGTERM on restart) ──
// Close the shared Playwright browser so Chromium isn't orphaned, then exit.
for (const sig of ['SIGTERM', 'SIGINT']) {
    process.on(sig, async () => {
        console.log(`[BOT] 🛑 ${sig} received — shutting down`);
        try {
            const { closeSharedBrowser } = await import('./services/forumClient.js');
            await closeSharedBrowser('shutdown');
        } catch { /* best effort */ }
        process.exit(0);
    });
}

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

    // Command modules — auto-loaded from commands/ (services/commandLoader.js).
    // Adding a new file there registers + dispatches it; no index.js edit.
    const { loadCommandModules } = await import('./services/commandLoader.js');
    for (const cmd of await loadCommandModules()) {
        const handler = { execute: cmd.execute };
        if (typeof cmd.autocomplete === 'function') handler.autocomplete = cmd.autocomplete;
        client.commands.set(cmd.name, handler);
    }

    console.log('[BOT] 🔌 Connecting to Discord...');
    await client.login(token);
}

start().catch(error => {
    console.error('[BOT] ❌ Failed to start:', error.message);
    process.exit(1);
});
