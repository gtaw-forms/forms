#!/usr/bin/env node
/**
 * tools/probe-functions.mjs — post-incident triage for Cloud Functions gen2.
 *
 * Answers one question fast: are the deployed functions actually executing, or
 * is the platform failing to start containers (the 2026-10-22 Cloud Run
 * incident signature: instant 500 at Google Frontend, latency 0s, no container
 * logs, no CORS headers)?
 *
 * Interpretation:
 *   200/400/401/403/404 -> the container started and answered. 400/401 are the
 *                          normal answer to a bare unauthenticated POST.
 *   500/503             -> container never started: check GCP status for
 *                          Cloud Run before touching code.
 *
 * Usage:
 *   node tools/probe-functions.mjs                # every function gcloud knows
 *   node tools/probe-functions.mjs --region=europe-west4
 *   node tools/probe-functions.mjs getFormsData checkOfficerName ...
 *
 * Read-only: unauthenticated POSTs with an empty body. No secrets.
 */
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const regionArg = args.find((a) => a.startsWith('--region='))?.split('=')[1];
const region = regionArg || 'europe-west2';
const project = (args.find((a) => a.startsWith('--project='))?.split('=')[1]) || 'gtaw-forms';
const explicit = args.filter((a) => !a.startsWith('--'));

// Critical-path functions probed when gcloud is unavailable.
const FALLBACK = [
    'getPublicConfig', 'checkOfficerName', 'getOfficerRoster', 'getAgencyCredentials',
    'checkFactionMembership', 'refreshGtawUser', 'getFormsData', 'listRecentSavedReports',
    'listLeoReports', 'logLeoPanelAccess', 'saveSavedReport', 'sendWebhookProxy',
];

function listFunctions() {
    if (explicit.length > 0) return explicit;
    try {
        // shell:true so gcloud resolves on Windows (gcloud.cmd, not an .exe).
        const out = execSync(
            `gcloud functions list --project ${project} --regions ${region} --format="value(name)"`,
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
        );
        const names = out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        if (names.length > 0) return names;
    } catch {
        // gcloud missing/not authenticated — fall through to the known set.
    }
    console.warn('[probe] gcloud unavailable — probing the built-in critical set only.');
    return FALLBACK;
}

const HEALTHY = new Set(['200', '400', '401', '403']);

async function probe(name) {
    const url = `https://${region}-${project}.cloudfunctions.net/${name}`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Origin: 'https://gtaw-forms.github.io' },
            body: JSON.stringify({ data: {} }),
            signal: AbortSignal.timeout(20000),
        });
        const code = String(res.status);
        // 404 is ambiguous: wrong name/region, or a function that was deleted.
        const state = code === '404' ? 'missing' : (HEALTHY.has(code) ? 'ok' : 'fail');
        return { name, code, state };
    } catch (err) {
        return { name, code: 'ERR', state: 'fail', note: err?.message || String(err) };
    }
}

const names = listFunctions();
console.log(`[probe] ${names.length} function(s) in ${region} (project ${project})\n`);

const results = [];
for (const name of names) {
    const result = await probe(name);
    results.push(result);
    const mark = result.state === 'ok' ? 'ok  ' : (result.state === 'missing' ? '?   ' : 'FAIL');
    console.log(`  ${mark} ${name.padEnd(30)} ${result.code}${result.note ? ` (${result.note})` : ''}`);
}

const failed = results.filter((r) => r.state === 'fail');
const missing = results.filter((r) => r.state === 'missing');
const executing = results.length - failed.length - missing.length;
console.log(`\n${executing}/${results.length} executing`
    + (failed.length ? `, ${failed.length} failing` : '')
    + (missing.length ? `, ${missing.length} not found in ${region}` : ''));
if (failed.length > 0) {
    console.log('\n500/503 with no CORS headers means the container never started.');
    console.log('Check https://status.cloud.google.com for a Cloud Run incident before changing code.');
    process.exitCode = 1;
}
