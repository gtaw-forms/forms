// debug-testing-scripts/face-find-page.mjs
// Find the Facebrowser page(s) owned by the FACE_API_KEY account.
//
// Usage (from discord-bot/):
//   node debug-testing-scripts/face-find-page.mjs
//   node debug-testing-scripts/face-find-page.mjs --name "phmc"        # filter by name/username keyword
//   node debug-testing-scripts/face-find-page.mjs --set --name "phmc"  # write the first match to FACE_PAGE_ID in .env
//
// Reads FACE_API_KEY from .env (see .env.example). Read-only unless --set is passed.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE = 'https://face.gta.world/api/v1/page-api';

function loadEnv() {
    const envPath = resolve(__dirname, '..', '.env');
    if (!existsSync(envPath)) {
        console.warn('[FACE-FIND] No .env found at ' + envPath);
        return [];
    }
    const content = readFileSync(envPath, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const sepIndex = trimmed.indexOf('=');
        if (sepIndex === -1) continue;
        const key = trimmed.slice(0, sepIndex).trim();
        const value = trimmed.slice(sepIndex + 1).trim();
        if (!process.env[key]) process.env[key] = value;
    }
    return lines;
}

loadEnv();

function parseArgs(argv) {
    const opts = { name: '', set: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--set') opts.set = true;
        else if (arg === '--name') opts.name = (argv[++i] || '').toLowerCase();
        else if (arg.startsWith('--name=')) opts.name = arg.slice('--name='.length).toLowerCase();
    }
    return opts;
}

async function call(path, opts = {}) {
    const res = await fetch(BASE + path, {
        ...opts,
        headers: {
            'Authorization': `Bearer ${process.env.FACE_API_KEY}`,
            'Content-Type': 'application/json',
            ...(opts.headers || {}),
        },
    });
    let body = null;
    try { body = await res.json(); } catch { body = await res.text(); }
    return { status: res.status, ok: res.ok, body };
}

function setFacePageIdInEnv(lines, pageId) {
    const envPath = resolve(__dirname, '..', '.env');
    const idx = lines.findIndex((l) => /^\s*FACE_PAGE_ID\s*=/.test(l.trim()));
    const assignment = `FACE_PAGE_ID=${pageId}`;
    if (idx !== -1) {
        lines[idx] = assignment;
    } else {
        // Append under the Face section marker if present, else at end of file.
        const sectionIdx = lines.findIndex((l) => l.trim().toUpperCase().includes('FACE') && l.trim().startsWith('#'));
        if (sectionIdx !== -1) {
            lines.splice(sectionIdx + 1, 0, assignment);
        } else {
            lines.push(assignment);
        }
    }
    writeFileSync(envPath, lines.join('\n'));
    console.log(`[FACE-FIND] [OK] FACE_PAGE_ID=${pageId} written to .env`);
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));

    if (!process.env.FACE_API_KEY) {
        console.error('[FACE-FIND] [ERR] FACE_API_KEY not found in .env. Add it first (see .env.example).');
        process.exit(1);
    }

    console.log('[FACE-FIND] Querying /pages/mine ...');
    const res = await call('/pages/mine');
    if (!res.ok) {
        console.error(`[FACE-FIND] [ERR] /pages/mine failed (${res.status}): ${JSON.stringify(res.body)}`);
        process.exit(1);
    }

    const pages = Array.isArray(res.body?.pages) ? res.body.pages : [];
    if (pages.length === 0) {
        console.log('[FACE-FIND] [WARN] No pages found for this key. Create/assign the page under the key account.');
        process.exit(0);
    }

    let matches = pages;
    if (opts.name) {
        matches = pages.filter((p) =>
            (p.name || '').toLowerCase().includes(opts.name) ||
            (p.username || '').toLowerCase().includes(opts.name)
        );
        if (matches.length === 0) {
            console.log(`[FACE-FIND] [WARN] No pages matching "${opts.name}". All pages:`, pages.length);
        }
    }

    console.log('\n=== Matches ===');
    matches.forEach((p) => {
        console.log(`  id=${p.id}  name="${p.name}"  username="${p.username}"  category=${p.category}`);
    });

    if (matches.length === 0 && pages.length > 0) {
        console.log('\nAll pages under this key:');
        pages.forEach((p) => {
            console.log(`  id=${p.id}  name="${p.name}"  username="${p.username}"  category=${p.category}`);
        });
    }

    if (opts.set && matches.length > 0) {
        setFacePageIdInEnv(loadEnv(), matches[0].id);
        console.log(`[FACE-FIND] [OK] Using page "${matches[0].name}" (id=${matches[0].id})`);
    } else if (opts.set && matches.length === 0) {
        console.error('[FACE-FIND] [ERR] --set requested but no matching page found.');
        process.exit(1);
    }

    console.log('\n[DONE] face-find-page complete');
}

main().catch((err) => {
    console.error('[FACE-FIND] [ERR] Failed:', err.message);
    process.exit(1);
});
