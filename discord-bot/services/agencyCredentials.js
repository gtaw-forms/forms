/**
 * agencyCredentials.js (bot-side) — Read/write the shared faction-forum
 * credentials file (data/agency-credentials.json). The morgue-api reads this
 * file per request, so updates apply immediately with no restart.
 */
import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CREDS_PATH = resolve(__dirname, '..', 'data', 'agency-credentials.json');

export function loadAgencyCredentials() {
    try {
        if (!existsSync(CREDS_PATH)) return {};
        return JSON.parse(readFileSync(CREDS_PATH, 'utf-8'));
    } catch (e) {
        console.warn('[CREDS] Could not load agency credentials:', e.message);
        return {};
    }
}

export function saveAgencyCredentials(creds) {
    const tmp = CREDS_PATH + '.tmp';
    writeFileSync(tmp, JSON.stringify(creds, null, 2));
    renameSync(tmp, CREDS_PATH);
}

/** Upsert a credential keyed by forum hostname. */
export function setAgencyCredential(domain, username, password) {
    const key = String(domain || '').trim().toLowerCase();
    if (!key) throw new Error('Domain is required (e.g. lspd.gta.world).');
    const creds = loadAgencyCredentials();
    creds[key] = { username: String(username || ''), password: String(password || '') };
    saveAgencyCredentials(creds);
    return key;
}

/** Remove a credential keyed by forum hostname. */
export function removeAgencyCredential(domain) {
    const key = String(domain || '').trim().toLowerCase();
    if (!key) throw new Error('Domain is required (e.g. lspd.gta.world).');
    const creds = loadAgencyCredentials();
    delete creds[key];
    saveAgencyCredentials(creds);
    return key;
}
