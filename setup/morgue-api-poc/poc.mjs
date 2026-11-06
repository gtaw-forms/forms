#!/usr/bin/env node
/**
 * PHMC Morgue API — proof of concept (zero dependencies, Node 18+).
 * READ-ONLY: every call here is a GET.
 *
 *   MORGUE_API_KEY=pmc_morgue_xxx node poc.mjs
 *   node poc.mjs --env /opt/phmc-bot/discord-bot/.env      # read the key from a file
 *   node poc.mjs --base http://88.208.243.254:3001
 *
 * The key is never printed. A read key (MORGUE_API_KEYS) is all this needs.
 */
import { readFileSync } from 'fs';

// ── Config ──
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const BASE = (flag('base') || process.env.MORGUE_API_BASE || 'http://localhost:3001').replace(/\/+$/, '');

function readEnvFile(path) {
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}
const firstKey = (raw) => {
  // .env values may be quoted and/or labeled ("forms-functions:pmc_morgue_xxx").
  const value = String(raw || '').trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  const first = value.split(',').map((s) => s.trim()).filter(Boolean)[0] || '';
  const colon = first.indexOf(':');
  const key = colon > 0 ? first.slice(colon + 1).trim() : first;
  return key.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
};

let KEY = process.env.MORGUE_API_KEY || '';
if (!KEY) {
  const envPath = flag('env');
  if (envPath) KEY = firstKey(readEnvFile(envPath).MORGUE_API_KEYS) || '';
}
if (!KEY) {
  console.error('No API key. Set MORGUE_API_KEY or pass --env <file>.');
  process.exit(1);
}

// ── Tiny GET helper ──
async function get(path, { key = KEY, label } = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'x-api-key': key } });
  const json = await res.json().catch(() => null);

  console.log(`\n### ${label || `GET ${path}`}`);
  console.log(`> GET ${path}  ->  ${res.status} ${res.statusText}`);
  console.log(JSON.stringify(json, null, 2));
  return { status: res.status, json };
}

// ── 1. Health (no key required) ──
await get('/api/health', { key: 'none', label: 'Health check (no API key)' });

// ── 2. Version (no key required) ──
await get('/api/version', { key: 'none', label: 'Data version (no API key)' });

// ── 3. List the newest record ──
const list = await get('/api/morgue?limit=1', { label: 'List records (newest first)' });
const sample = list.json?.records?.[0];

// ── 4. Search by name / caseId / location ──
await get('/api/morgue?q=Ryan%20Kennedy&limit=1', { label: 'Search (?q=)' });

// ── 5. Fetch one record by caseId ──
if (sample?.caseId) {
  await get(`/api/morgue/${sample.caseId}`, { label: 'Fetch one record by caseId' });
}

// ── 6. Unknown case (404) ──
await get('/api/morgue/999999999', { label: 'Error: unknown caseId' });

// ── 7. Invalid key (401) ──
await get('/api/morgue?limit=1', { key: 'definitely-not-a-real-key', label: 'Error: invalid key' });

console.log('\nDone.');
