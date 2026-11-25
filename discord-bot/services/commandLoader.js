/**
 * commandLoader.js — single source of truth for Discord slash commands.
 *
 * Scans discord-bot/commands/*.js and loads every module that exports
 * `{ data, execute }` (plus optional `autocomplete`). Replaces the old
 * hand-maintained lists in index.js (registerCommands + client.commands.set),
 * where adding commands/autopsy-dev-testing.js without touching index.js
 * meant the command silently never appeared.
 *
 * Deliberately NOT loaded (kept out of the picker):
 * - private-web-autopsy.js: retired mode switch, superseded by
 *   web-autopsy-autopost. Loading it would re-expose dead UI.
 *
 * A module that fails to import (gitignored personal file absent, syntax
 * slip in a half-written file) is warned about and skipped — it must never
 * sink the boot. Name collisions: first file wins, later ones warned.
 */
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMANDS_DIR = join(__dirname, '..', 'commands');

const SKIP_FILES = new Set(['private-web-autopsy.js']);

export async function loadCommandModules() {
    const loaded = [];
    const seen = new Set();
    let files = [];
    try {
        files = readdirSync(COMMANDS_DIR).filter((f) => f.endsWith('.js')).sort();
    } catch (err) {
        console.error(`[BOT] ❌ Cannot read commands dir: ${err.message}`);
        return loaded;
    }
    for (const file of files) {
        if (SKIP_FILES.has(file)) {
            console.log(`[BOT] ⏭️ Skipping retired command module: ${file}`);
            continue;
        }
        try {
            const mod = await import(pathToFileURL(join(COMMANDS_DIR, file)).href);
            const name = mod?.data?.name;
            if (!name || typeof mod.execute !== 'function') {
                console.warn(`[BOT] ⚠️ ${file} exports no data.name/execute — skipped`);
                continue;
            }
            if (seen.has(name)) {
                console.warn(`[BOT] ⚠️ Duplicate command name '${name}' in ${file} — skipped (first wins)`);
                continue;
            }
            seen.add(name);
            const entry = { file, name, data: mod.data, execute: mod.execute };
            if (typeof mod.autocomplete === 'function') entry.autocomplete = mod.autocomplete;
            loaded.push(entry);
        } catch (err) {
            console.warn(`[BOT] ⚠️ Could not load command ${file} — skipped (${err.message})`);
        }
    }
    console.log(`[BOT] 🔧 Loaded ${loaded.length} command modules from commands/`);
    return loaded;
}
