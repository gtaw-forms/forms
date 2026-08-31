/**
 * probe-morgue-api.mjs — end-to-end check of the morgue API as an external
 * consumer would call it. Prints counts/names only, never the key.
 * Usage (from /opt/phmc-bot/discord-bot):
 *   node debug-testing-scripts/probe-morgue-api.mjs [baseUrl]
 * baseUrl defaults to localhost:3001; pass https://...:3001 to test public path.
 */
import fs from 'fs';

const base = process.argv[2] || 'http://localhost:3001';
const key = (fs.readFileSync('.env', 'utf8').split('\n')
    .map(l => l.trim())
    .find(l => l.startsWith('MORGUE_API_KEYS=')) || '')
    .slice('MORGUE_API_KEYS='.length).split(',')[0].trim();

if (!key) { console.error('[ERR] no MORGUE_API_KEYS in .env'); process.exit(1); }

async function probe(q) {
    const t0 = Date.now();
    try {
        const res = await fetch(`${base}/api/morgue?q=${encodeURIComponent(q)}`, {
            headers: { 'x-api-key': key },
            signal: AbortSignal.timeout(10000),
        });
        const ms = Date.now() - t0;
        if (!res.ok) return console.log(`q="${q}" -> HTTP ${res.status} (${ms}ms)`);
        const j = await res.json();
        const names = (j.records || []).slice(0, 3).map(r => r.name);
        console.log(`q="${q}" -> success:${j.success} total:${j.total} (${ms}ms) first:${names.join(' ; ') || '(none)'}`);
    } catch (e) {
        console.log(`q="${q}" -> FAILED after ${Date.now() - t0}ms: ${e.message}`);
    }
}

await probe('Autopsy Test');
await probe('autospy');      // their possible typo variant
await probe('John Doe');
console.log('base:', base);
