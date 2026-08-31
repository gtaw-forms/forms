/**
 * scanner-ban-test.mjs — verify the morgue-api scanner defenses.
 * Modes:
 *   loopback   — hit pattern-matched junk paths from THIS host (loopback):
 *                expect plain 404s and NO ban (trust guard).
 *   enumerate N baseUrl — hit N DISTINCT unknown paths (expect last ones to
 *                trigger SCAN-path-enumeration ban if over threshold).
 *   hassio baseUrl — single SCAN-hassio probe (expect instant ban response
 *                as 403 BANNED on any follow-up request from same IP).
 */
import fs from 'fs';

const mode = process.argv[2] || 'loopback';
// Extra args: any http(s) token = base URL; bare digits = count.
const extraArgs = process.argv.slice(3);
const BASE = mode === 'loopback' ? 'http://localhost:3001' : (extraArgs.find(a => a.startsWith('http')) || '');
const N = parseInt(mode === 'enumerate' ? extraArgs.find(a => /^\d+$/.test(a)) : '0', 10) || 12;

async function hit(path) {
    try {
        const res = await fetch(`${BASE}/${path}`, { signal: AbortSignal.timeout(8000) });
        const body = res.status === 403 ? ` -> ${res.status} ${(await res.json()).message}` : ` -> ${res.status}`;
        return body;
    } catch (e) {
        return ` -> FAILED ${e.message}`;
    }
}

if (mode === 'loopback') {
    console.log('== loopback trust-guard test (expect 404s, NO bans) ==');
    for (const p of ['api/hassio/app/.%252e/supervisor/info', 'api/auth/cognito/callback', 'api/runscript', 'api/v1/me/']) {
        console.log(`/${p}${await hit(p)}`);
    }
    process.exit(0);
}

if (mode === 'enumerate') {
    console.log(`== enumeration test: ${N} distinct unknown paths vs ${BASE} ==`);
    for (let i = 1; i <= N; i++) {
        const code = await hit(`api/junkpath_${Date.now()}_${i}/probe`);
        console.log(`probe ${i}${code}`);
    }
    process.exit(0);
}

if (mode === 'hassio') {
    console.log('== single SCAN-hassio probe (then one follow-up to see ban) ==');
    console.log(`hassio probe${await hit('api/hassio/app/.%252e/supervisor/info')}`);
    console.log(`follow-up${await hit('api/morgue?q=test')}`);
    process.exit(0);
}
console.error('unknown mode'); process.exit(1);
