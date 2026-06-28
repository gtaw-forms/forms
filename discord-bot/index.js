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
    const commands = [
        morgue.data.toJSON(),
        card.data.toJSON(),
        restart.data.toJSON(),
        autopsy.data.toJSON(),
        user.data.toJSON(),
        formQueued.data.toJSON(),
        maintenance.data.toJSON(),
        dashboard.data.toJSON(),
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
});

client.on('interactionCreate', async (interaction) => {
    // Handle dashboard refresh button
    if (interaction.isButton() && interaction.customId === 'dashboard_refresh') {
        const { handleDashboardRefresh } = await import('./services/dashboardManager.js');
        await handleDashboardRefresh(interaction);
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
        console.error(`[BOT] ❌ Error executing /${interaction.commandName}:`, error);
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
    }
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

    console.log('[BOT] 🔌 Connecting to Discord...');
    await client.login(token);
}

start().catch(error => {
    console.error('[BOT] ❌ Failed to start:', error.message);
    process.exit(1);
});
