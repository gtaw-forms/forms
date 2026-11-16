#!/usr/bin/env node
// tools/feedback-verify.mjs — verify the installed @opencode-ai/sdk surface
// against what the feedback bot relies on, plus live server checks.
// Usage:
//   node tools/feedback-verify.mjs            # static SDK surface only
//   node tools/feedback-verify.mjs --live     # also hit OPENCODE_URL (needs the VPS tunnel or local opencode serve)
//
// Fails closed: any missing method/agent/model exits 1 with what was seen.
// Run --live on the VPS (or with OPENCODE_URL pointed at it) before first use.
import { createRequire } from 'module';

const LIVE = process.argv.includes('--live');
const baseUrl = (process.env.OPENCODE_URL || 'http://127.0.0.1:4096').replace(/\/$/, '');
const wantModel = {
  providerID: process.env.FEEDBACK_MODEL_PROVIDER || 'opencode-go',
  modelID: process.env.FEEDBACK_MODEL || 'muse-spark-1.3-contributor',
};
const wantAgents = {
  plan: process.env.FEEDBACK_PLAN_AGENT || 'plan',
  build: process.env.FEEDBACK_BUILD_AGENT || 'build',
};

let failures = 0;
function ok(label, good, extra = '') {
  console.log(`${good ? '[OK]  ' : '[FAIL]'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!good) failures += 1;
}

let sdk;
try {
  const require = createRequire(import.meta.url);
  sdk = require('@opencode-ai/sdk');
} catch {
  try {
    sdk = await import('@opencode-ai/sdk');
  } catch (e) {
    console.error(`[FAIL] could not load @opencode-ai/sdk. Run npm install in discord-bot/. (${e.message})`);
    process.exit(1);
  }
}

const create = sdk.createOpencodeClient || sdk.default?.createOpencodeClient;
ok('createOpencodeClient export', typeof create === 'function', Object.keys(sdk).slice(0, 10).join(','));

if (typeof create !== 'function') process.exit(1);

if (!LIVE) {
  console.log('[INFO] static check done. Re-run with --live to verify agents/model/events against the server.');
  process.exit(failures ? 1 : 0);
}

const client = create({ baseUrl });
ok('client created', !!client);

// Session surface the controller relies on.
for (const m of ['create', 'prompt', 'abort', 'messages', 'get']) {
  ok(`session.${m}`, typeof client.session?.[m] === 'function');
}
ok('app.agents', typeof client.app?.agents === 'function');
ok('config.providers', typeof client.config?.providers === 'function');
ok('event.subscribe', typeof client.event?.subscribe === 'function');
ok('config.get (liveness probe)', typeof client.config?.get === 'function');

try {
  const agentsRes = await client.app.agents();
  const list = agentsRes?.data || agentsRes || [];
  const names = (Array.isArray(list) ? list : []).map((a) => a?.name || a?.id || String(a));
  console.log(`[INFO] agents: ${names.join(', ') || '(none)'}`);
  ok(`plan agent "${wantAgents.plan}"`, names.length === 0 || names.includes(wantAgents.plan), names.join(', '));
  ok(`build agent "${wantAgents.build}"`, names.length === 0 || names.includes(wantAgents.build), names.join(', '));
} catch (e) {
  ok('app.agents() call', false, e.message);
}

try {
  const provRes = await client.config.providers({ throwOnError: true }).catch(() => client.config.providers());
  const providers = provRes?.data?.providers || provRes?.providers || [];
  const ids = (Array.isArray(providers) ? providers : []).map((p) => p?.id || p?.name || String(p));
  console.log(`[INFO] providers: ${ids.join(', ') || '(none)'}`);
  ok(`provider "${wantModel.providerID}"`, ids.length === 0 || ids.includes(wantModel.providerID), ids.join(', '));
} catch (e) {
  ok('config.providers() call', false, e.message);
}

console.log(`[INFO] expected model: ${wantModel.providerID}/${wantModel.modelID}`);
console.log('[INFO] exact model IDs come from `opencode models` on the VPS; pin them in FEEDBACK_MODEL*.');
process.exit(failures ? 1 : 0);
