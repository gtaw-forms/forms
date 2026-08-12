// debug-testing-scripts/inspect-autopsy.js
// One-off diagnostic: dump the autopsy-requested entry for a given case topic
// or request topic, or by OOC/name match. Prints the full Firebase entry.
//
// Usage (on VPS, from discord-bot/):  node debug-testing-scripts/inspect-autopsy.js <caseTopicId|requestTopicId|search>
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
    const envPath = resolve(__dirname, '..', '.env');
    if (!existsSync(envPath)) return;
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const sepIndex = trimmed.indexOf('=');
        if (sepIndex === -1) continue;
        const key = trimmed.slice(0, sepIndex).trim();
        const value = trimmed.slice(sepIndex + 1).trim();
        if (!process.env[key]) process.env[key] = value;
    }
}
loadEnv();

import firebase from '../services/firebase.js';
firebase.init();
const db = firebase.db;

const search = (process.argv[2] || '').toLowerCase();

const snap = await db.ref('autopsy-requested').once('value');
const entries = snap.val() || {};
let found = 0;
for (const [id, e] of Object.entries(entries)) {
    const match =
        id === search ||
        String(e.caseTopicId || '') === search ||
        String(e.topicId || '') === search ||
        (e.title || '').toLowerCase().includes(search) ||
        (e.oocName || '').toLowerCase().includes(search);
    if (!match) continue;
    found++;
    console.log(`\n=== KEY: ${id} ===`);
    console.log(JSON.stringify(e, null, 2));
}
if (!found) console.log(`[INSPECT] No entries matched "${search}" in autopsy-requested (${Object.keys(entries).length} total)`);
process.exit(0);
