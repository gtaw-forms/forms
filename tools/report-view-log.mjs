#!/usr/bin/env node
/**
 * tools/report-view-log.mjs — read the saved-report view audit trail.
 *
 * The migration UI logs one JSON line per report open to the VPS at
 * data/report-view-access.log (metadata only: viewer, OAuth, UID, report,
 * form, context, IP). This tool fetches the newest entries through the
 * protected GET /api/reports/views endpoint — no SSH needed.
 *
 * Usage:
 *   node tools/report-view-log.mjs [--limit=200] [--author=Alyson_Frost] [--key=CASE_...]
 *
 * Credentials come from functions/.env (MORGUE_API_KEY / MORGUE_API_URL) and
 * are never printed.
 */
import fs from 'fs';
import path from 'path';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...rest] = a.replace(/^--/, '').split('=');
  return [k, rest.join('=') || 'true'];
}));
const limit = Math.min(Math.max(Number(args.limit) || 200, 1), 1000);

function readEnv(name) {
  try {
    const text = fs.readFileSync(path.join(process.cwd(), 'functions', '.env'), 'utf8');
    const line = text.split(/\r?\n/).find((l) => l.trim().startsWith(`${name}=`));
    if (!line) return '';
    return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
  } catch { return ''; }
}

const key = readEnv('MORGUE_API_KEY');
const base = (readEnv('MORGUE_API_URL') || 'http://88.208.243.254').replace(/\/$/, '');
if (!key) {
  console.error('MORGUE_API_KEY missing from functions/.env');
  process.exit(1);
}

const res = await fetch(`${base}/api/reports/views?limit=${limit}`, {
  headers: { 'x-api-key': key },
});
const text = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  process.exit(1);
}
const data = JSON.parse(text);
let views = data.views || [];
if (args.author) views = views.filter((v) => v.author === args.author);
if (args.key) views = views.filter((v) => v.key === args.key);

console.log(`${views.length} view(s) (newest first)\n`);
for (const v of views) {
  console.log([
    v.time,
    `${v.viewer} | ${v.oauth}`,
    v.uid ? `uid=${v.uid}` : 'uid=-',
    `${v.author}/${v.key}`,
    v.formId || '-',
    v.context || '-',
    v.title || '',
  ].join('  '));
}
