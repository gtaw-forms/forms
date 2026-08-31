/**
 * Local morgue data — read the morgue records from the VPS-local mirror
 * (morgue-data.json, maintained by morgue-api) instead of pulling the full
 * `morgue-records` RTDB node (~5.5MB per read). Same `{ caseId: record }`
 * shape as RTDB, so existing forEach/entry loops work unchanged.
 *
 * P1 of the RTDB egress reduction: every bot morgue read goes to the file the
 * bot is sitting right next to, not RTDB.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MORGUE_DATA_PATH = resolve(__dirname, '..', 'morgue-data.json');

/**
 * Load the raw morgue data object ({ caseId: record }) or null if the mirror
 * is missing/unreadable.
 */
export function loadLocalMorgueData() {
    try {
        if (!existsSync(MORGUE_DATA_PATH)) return null;
        const parsed = JSON.parse(readFileSync(MORGUE_DATA_PATH, 'utf-8'));
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

/**
 * Load morgue records as a list with firebaseKey, mirroring the RTDB forEach
 * output. Returns [] when the mirror is unavailable.
 */
export function loadLocalMorgueList() {
    const data = loadLocalMorgueData();
    if (!data) return [];
    return Object.keys(data).map(caseId => ({
        ...data[caseId],
        firebaseKey: data[caseId].firebaseKey || caseId,
    }));
}