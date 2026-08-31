/**
 * factionRosterSync.js — Daily LSPD/LSSD/SADCR member roster sync.
 *
 * Scrapes LSPD (g=44), LSSD (g=66), and SADCR (g=11) phpBB group member
 * lists and saves them to local JSON files on the VPS. The files are
 * consumed by morgue-api.js for the /api/roster/check endpoint.
 *
 * Runs roughly every 12 hours (with random offset). Notifies bot-spam on completion.
 * Fires on bot startup if the last sync was >12h ago.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getForumClient, createIsolatedClient } from './forumClient.js';
import { sendLogMessage } from './logChannel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ──

const ROSTER_DIR = resolve(__dirname, '..', 'data');
const LSPD_GROUP_ID = 44;
const LSSD_GROUP_ID = 66;
const SADCR_GROUP_ID = 11;
const COOLDOWN_MS = 12 * 60 * 60 * 1000;  // 12 hours
const SYNC_WINDOW_MS = 30 * 60 * 1000;  // + up to 30 min random offset

const FACTION_CONFIG = {
    lspd: {
        groupId: LSPD_GROUP_ID,
        baseUrl: process.env.FORUM_LSPD_URL || 'https://lspd.gta.world',
        file: 'lspd-roster.json',
        label: 'LSPD',
        usernameEnv: 'FORUM_LSPD_USERNAME',
        passwordEnv: 'FORUM_LSPD_PASSWORD',
    },
    lssd: {
        groupId: LSSD_GROUP_ID,
        baseUrl: process.env.FORUM_LSSD_URL || 'https://lssd.gta.world',
        file: 'lssd-roster.json',
        label: 'LSSD',
        usernameEnv: 'FORUM_LSSD_USERNAME',
        passwordEnv: 'FORUM_LSSD_PASSWORD',
    },
    sadcr: {
        groupId: SADCR_GROUP_ID,
        baseUrl: process.env.FORUM_SADCR_URL || 'https://sadcr.gta.world',
        file: 'sadcr-roster.json',
        label: 'SADCR',
        usernameEnv: 'FORUM_SADCR_USERNAME',
        passwordEnv: 'FORUM_SADCR_PASSWORD',
    },
};

// ── State ──

let _syncTimer = null;

// ── Helpers ──

function getDataPath(filename) {
    if (!existsSync(ROSTER_DIR)) {
        mkdirSync(ROSTER_DIR, { recursive: true });
    }
    return resolve(ROSTER_DIR, filename);
}

function getLastSyncTime() {
    try {
        const path = getDataPath('sync-meta.json');
        if (existsSync(path)) {
            const meta = JSON.parse(readFileSync(path, 'utf-8'));
            return meta.lastSyncAt || 0;
        }
    } catch { /* ignore */ }
    return 0;
}

function saveLastSyncTime() {
    try {
        const path = getDataPath('sync-meta.json');
        writeFileSync(path, JSON.stringify({ lastSyncAt: Date.now() }), 'utf-8');
    } catch (err) {
        console.warn('[ROSTER-SYNC] Failed to save sync meta:', err.message);
    }
}

/**
 * Scrape one faction's member list and save to disk.
 * Returns the member array or null on failure.
 */
async function scrapeFaction(config) {
    console.log(`[ROSTER-SYNC] Scraping ${config.label} (g=${config.groupId})...`);
    const client = createIsolatedClient(`roster-${config.label.toLowerCase()}`);
    try {
        await client.login(
            process.env[config.usernameEnv],
            process.env[config.passwordEnv],
            { force: true, baseUrl: config.baseUrl }
        );

        const members = await client.getGroupMembers(config.groupId, {
            baseUrl: config.baseUrl,
            paginate: true,
        });

        const data = {
            members,
            lastUpdated: new Date().toISOString(),
            count: members.length,
        };

        writeFileSync(getDataPath(config.file), JSON.stringify(data, null, 2), 'utf-8');
        console.log(`[ROSTER-SYNC] ${config.label}: ${members.length} members saved to ${config.file}`);
        return members;
    } catch (err) {
        console.error(`[ROSTER-SYNC] ${config.label} scrape failed:`, err.message);
        return null;
    } finally {
        try { client.close(); } catch { /* ignore */ }
    }
}

/**
 * Run a full sync of all configured factions.
 */
export async function syncFactionRosters() {
    console.log('[ROSTER-SYNC] Starting faction roster sync...');

    const results = {};
    for (const key of Object.keys(FACTION_CONFIG)) {
        const config = FACTION_CONFIG[key];
        results[key] = await scrapeFaction(config);
    }

    saveLastSyncTime();

    const counts = Object.keys(FACTION_CONFIG)
        .map((key) => `${key.toUpperCase()}: ${results[key]?.length ?? 0}`)
        .join(', ');
    console.log(`[ROSTER-SYNC] Sync complete — ${counts}`);

    // Notify bot-spam channel
    try {
        await sendLogMessage(`[ROSTER-SYNC] Faction rosters synced — ${counts} members`);
    } catch (err) {
        console.warn('[ROSTER-SYNC] Failed to send log notification:', err.message);
    }

    return results;
}

/**
 * Schedule the next sync at a random time within the window.
 */
function scheduleNextSync() {
    const delay = COOLDOWN_MS + Math.floor(Math.random() * SYNC_WINDOW_MS);
    const next = new Date(Date.now() + delay);
    console.log(`[ROSTER-SYNC] Next sync scheduled at ${next.toLocaleString()} (in ${Math.round(delay / 3600000)}h)`);

    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(async () => {
        await syncFactionRosters();
        scheduleNextSync();
    }, delay);
}

/**
 * Start the roster sync system. Called once on bot startup.
 * Syncs immediately if the last sync was longer ago than COOLDOWN_MS,
 * otherwise schedules the next sync at the COOLDOWN_MS mark.
 */
export function startFactionRosterSync() {
    console.log('[ROSTER-SYNC] Starting faction roster sync service...');

    const lastSync = getLastSyncTime();
    const elapsed = Date.now() - lastSync;

    if (elapsed > COOLDOWN_MS) {
        console.log(`[ROSTER-SYNC] Last sync was ${Math.round(elapsed / 3600000)}h ago — running now`);
        syncFactionRosters().then(() => scheduleNextSync());
    } else {
        const remaining = COOLDOWN_MS - elapsed;
        console.log(`[ROSTER-SYNC] Last sync was ${Math.round(elapsed / 3600000)}h ago — next in ${Math.round(remaining / 3600000)}h`);
        scheduleNextSync();
    }
}

/**
 * Read the current roster data from disk (for API consumption).
 */
export function getFactionRoster(faction) {
    const config = FACTION_CONFIG[faction];
    if (!config) return null;
    try {
        const path = getDataPath(config.file);
        if (!existsSync(path)) return null;
        return JSON.parse(readFileSync(path, 'utf-8'));
    } catch {
        return null;
    }
}

/**
 * Read roster sync status for the dashboard.
 * Returns { lastSyncAt, nextSyncAt, lspdCount, lssdCount, sadcrCount } or null.
 */
export function getRosterSyncStatus() {
    try {
        const metaPath = getDataPath('sync-meta.json');
        let lastSyncAt = 0;
        if (existsSync(metaPath)) {
            const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
            lastSyncAt = meta.lastSyncAt || 0;
        }

        const nextSyncAt = lastSyncAt > 0 ? lastSyncAt + COOLDOWN_MS + Math.floor(Math.random() * SYNC_WINDOW_MS) : 0;

        const lspdData = getFactionRoster('lspd');
        const lssdData = getFactionRoster('lssd');
        const sadcrData = getFactionRoster('sadcr');

        return {
            lastSyncAt: lastSyncAt || null,
            nextSyncAt: nextSyncAt || null,
            lspdCount: lspdData?.count ?? lspdData?.members?.length ?? 0,
            lssdCount: lssdData?.count ?? lssdData?.members?.length ?? 0,
            sadcrCount: sadcrData?.count ?? sadcrData?.members?.length ?? 0,
        };
    } catch {
        return null;
    }
}
