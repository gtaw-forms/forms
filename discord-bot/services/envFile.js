/**
 * envFile.js — Safe .env read/upsert utilities for the discord-bot directory.
 *
 * Used by owner-only runtime-toggle commands (/enable-dev-autopsy etc.) to flip
 * behavior flags WITHOUT losing comments/blank lines or requiring an SSH edit.
 *
 * Compatibility contract with index.js's manual loader:
 *   - plain KEY=value lines (no quote handling, values trimmed)
 *   - full-line # comments skipped on load
 *   - NOTE: boot-time loader skips any key already present in process.env, so
 *     genuine OS env vars always outrank .env — same precedence the runtime
 *     toggles rely on (process.env first, file second).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Same resolution as index.js's loadEnv(): <discord-bot>/.env
// PHMC_ENV_FILE exists purely for tests / alternative installs.
export const ENV_PATH = process.env.PHMC_ENV_FILE || path.resolve(__dirname, '..', '.env');

/**
 * Read a single value straight from the .env FILE (not process.env).
 * @param {string} key
 * @returns {string|null} null when key/file missing
 */
export function readEnvValue(key) {
    try {
        const raw = fs.readFileSync(ENV_PATH, 'utf8');
        const re = new RegExp(`^\\s*#?\\s*(?:export\\s+)?${key}\\s*=\\s*(.*)$`, 'm');
        const m = raw.match(re);
        return m ? m[1].trim() : null;
    } catch {
        return null;
    }
}

/**
 * Upsert several KEY=value pairs into the .env file while preserving
 * everything else byte-for-byte (comments, blank lines, ordering, EOL style).
 *
 * Matching lines are replaced IN PLACE. A line whose value matches is left
 * untouched. Fully commented-out occurrences (`# KEY=x`) are uncommented.
 * Duplicate definitions collapse onto the first occurrence. Missing keys are
 * appended at the end of the file.
 *
 * @param {Record<string, string>} pairs — keys written unquoted (loader trims)
 * @returns {{ changed: boolean, updatedKeys: string[], path: string }}
 */
export function upsertEnvValues(pairs) {
    const keys = Object.keys(pairs);
    let raw;
    try {
        raw = fs.readFileSync(ENV_PATH, 'utf8');
    } catch {
        // Missing .env — synthesize a minimal one so the bot picks it up on restart.
        raw = '# Created automatically by PHMC bot runtime toggle\n';
    }

    const crlf = raw.includes('\r\n');
    const eol = crlf ? '\r\n' : '\n';
    let lines = raw.split(/\r?\n/);

    const pending = new Map(Object.entries(pairs));
    const out = [];
    let changed = false;

    for (const line of lines) {
        const trimmed = line.trim();
        let handled = false;

        for (const key of [...pending.keys()]) {
            const re = new RegExp(`^(\\s*)#?\\s*(?:export\\s+)?${key}\\s*=`);
            const m = trimmed.match(re);
            if (!m) continue;
            handled = true;

            const desired = `${key}=${pairs[key]}`;
            if (line === desired) {
                // Already exactly right (incl. formatting) — keep verbatim.
                out.push(line);
            } else {
                out.push(desired);
                changed = true;
            }
            pending.delete(key);
            break;
        }

        if (!handled) out.push(line);
        else lines = lines; // no-op, keeps linters calm about reassignment
    }

    // Append anything still unmatched (skip dupes already resolved above).
    if (pending.size > 0) {
        // Guarantee exactly one blank separator line before the block unless
        // the file ends mid-block (rare) — keeps diffs readable.
        while (out.length > 0 && out[out.length - 1] === '') out.pop();
        out.push('');
        for (const [key, value] of pending.entries()) {
            out.push(`${key}=${value}`);
        }
        changed = true;
    }

    let result = out.join(eol);
    // Preserve a single trailing newline, matching common .env conventions.
    if (result && !result.endsWith('\n')) result += eol;
    else if (raw === '' || raw.endsWith('\n\n')) { /* leave as authored */ }

    if (!changed) {
        // Still normalize nothing — write skipped entirely.
        return { changed: false, updatedKeys: [], path: ENV_PATH };
    }

    fs.writeFileSync(ENV_PATH, result, 'utf8');
    return { changed: true, updatedKeys: keys, path: ENV_PATH };
}
