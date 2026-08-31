/**
 * inspect-morgue-file.mjs — local-file stats + autopsy-name matches (names only).
 * Run from /opt/phmc-bot/discord-bot:  node debug-testing-scripts/inspect-morgue-file.mjs
 */
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('morgue-data.json', 'utf8'));
const arr = Object.values(data);
console.log('records total:', arr.length);
if (arr.length > 0) {
    const sorted = [...arr].sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
    console.log('newest lastUpdated:', new Date(sorted[0].lastUpdated || 0).toISOString());
    console.log('oldest lastUpdated:', new Date(sorted[sorted.length - 1].lastUpdated || 0).toISOString());
}
const re = /autops?y/i;
const hits = arr.filter(r => re.test(`${r.name || ''} ${r.caseId || ''}`));
console.log('autopsy-ish records:', hits.length);
for (const r of hits.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0)).slice(0, 12)) {
    console.log(`- ${r.caseId} | name="${r.name}" | upd=${new Date(r.lastUpdated || 0).toISOString()}`);
}
