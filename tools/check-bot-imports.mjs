#!/usr/bin/env node
/**
 * tools/check-bot-imports.mjs — static "do all named imports resolve?" check
 * for discord-bot/.
 *
 * WHY: the bot is plain ESM with no bundler and no build step, so a committed
 * call site whose implementation was never committed (or was renamed) is not
 * caught by lint. Exactly this shipped on 2026-09-26 (`95d6fbb` committed
 * `autopsyRequestMonitor.js` calling `selectMEsForMass` / `notifyMassAssignmentPanel`
 * while neither implementation was in the repo), which made the committed bot
 * unbootable — and the VPS only worked because it had its own copies.
 *
 * This resolves every relative `import { a, b } from './x.js'` against the
 * target module's exports (static analysis only — nothing is executed) and
 * exits 1 on any unresolved name.
 *
 * Usage: node tools/check-bot-imports.mjs
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, resolve, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const BOT = join(ROOT, 'discord-bot');
const SKIP_DIRS = new Set(['node_modules', 'data', 'logs', '.git', 'debug', 'debug-testing-scripts', 'out']);

function walk(dir) {
    const out = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) out.push(...walk(p)); continue; }
        if (/\.(js|mjs)$/.test(e.name)) out.push(p);
    }
    return out;
}

function readExports(file) {
    const s = readFileSync(file, 'utf8');
    const ex = new Set();
    for (const m of s.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class|var)\s+([A-Za-z_$][\w$]*)/g)) ex.add(m[1]);
    for (const m of s.matchAll(/export\s*\{([^}]+)\}/g)) {
        for (const name of m[1].split(',')) {
            const n = name.trim();
            if (!n) continue;
            ex.add((n.split(/\s+as\s+/)[1] || n).trim());
        }
    }
    if (/\bexport\s+default\b/.test(s)) ex.add('default');
    return ex;
}

const files = walk(BOT);
const issues = [];
for (const file of files) {
    const s = readFileSync(file, 'utf8');
    for (const m of s.matchAll(/\bimport\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)) {
        const spec = m[2];
        if (!spec.startsWith('.')) continue;
        const target = resolve(dirname(file), spec);
        const cand = [target, target + '.js', target + '.mjs', join(target, 'index.js')]
            .find(c => { try { return statSync(c).isFile(); } catch { return false; } });
        if (!cand) { issues.push(`${relative(ROOT, file)}: import '${spec}' -> file NOT FOUND`); continue; }
        const ex = readExports(cand);
        for (const name of m[1].split(',').map(x => x.trim()).filter(Boolean)) {
            const bare = name.split(/\s+as\s+/)[0].trim();
            if (!ex.has(bare)) {
                issues.push(`${relative(ROOT, file)}: '${bare}' is not exported by ${spec}`);
            }
        }
    }
}

if (issues.length) {
    console.error(`[bot-imports] ${issues.length} unresolved import(s):`);
    for (const i of issues) console.error('  - ' + i);
    process.exit(1);
}
console.log(`[bot-imports] OK — every named import across ${files.length} bot modules resolves.`);
