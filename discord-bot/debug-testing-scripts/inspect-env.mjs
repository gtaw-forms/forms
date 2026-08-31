/**
 * inspect-env.mjs — print .env SIZE + KEY NAMES ONLY (never values).
 * Run from /opt/phmc-bot/discord-bot:  node debug-testing-scripts/inspect-env.mjs [path-to-env]
 */
import fs from 'fs';

const target = process.argv[2] || '.env';
let raw;
try {
    raw = fs.readFileSync(target, 'utf8');
} catch (e) {
    console.error(`[ERR] cannot read ${target}: ${e.message}`);
    process.exit(1);
}

const bytes = Buffer.byteLength(raw, 'utf8');
const active = [];
const commented = [];
for (const l of raw.split(/\r?\n/)) {
    const t = l.trim();
    if (!t) continue;
    if (t.startsWith('#')) {
        const m = t.match(/^#\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
        if (m) commented.push(m[1]);
        continue;
    }
    const i = t.indexOf('=');
    if (i >= 1) active.push(t.slice(0, i).trim());
}

console.log(`file      : ${target}`);
console.log(`bytes     : ${bytes}`);
console.log(`active    : ${active.length}`);
console.log(`commented : ${commented.length}`);
console.log('--- active keys ---');
console.log([...new Set(active)].sort().join('\n'));
console.log('--- commented-out keys ---');
console.log([...new Set(commented)].sort().join('\n'));
