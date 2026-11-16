#!/usr/bin/env node
// tools/feedback-sessions.mjs — view the VPS feedback sessions from your PC.
// The bot's OpenCode server binds 127.0.0.1:4096 on the VPS, so tunnel it first:
//   ssh -i ~/.ssh/phmc_vps -L 4096:127.0.0.1:4096 root@88.208.243.254
// (keep that terminal open), then in another terminal:
//   node tools/feedback-sessions.mjs                    # list sessions
//   node tools/feedback-sessions.mjs --messages <id>    # read a session
// Needs @opencode-ai/sdk resolvable: `npm install -g @opencode-ai/sdk` and
// run with NODE_PATH set to the global root (see hint on failure).
import { createRequire } from 'module';

const args = process.argv.slice(2);
const urlIdx = args.indexOf('--url');
const baseUrl = (urlIdx >= 0 ? args[urlIdx + 1] : process.env.OPENCODE_URL || 'http://127.0.0.1:4096').replace(/\/$/, '');
const msgIdx = args.indexOf('--messages');
const messagesId = msgIdx >= 0 ? args[msgIdx + 1] : null;
const limIdx = args.indexOf('--limit');
const limit = limIdx >= 0 ? Number(args[limIdx + 1]) || 20 : 20;

let sdk;
try {
  const require = createRequire(import.meta.url);
  sdk = require('@opencode-ai/sdk');
} catch {
  try {
    sdk = await import('@opencode-ai/sdk');
  } catch {
    console.error('[FAIL] @opencode-ai/sdk not found.');
    console.error('Install it globally, then re-run with the global root on NODE_PATH:');
    console.error('  npm install -g @opencode-ai/sdk');
    console.error('  NODE_PATH="$(npm root -g)" node tools/feedback-sessions.mjs');
    process.exit(1);
  }
}

const create = sdk.createOpencodeClient || sdk.default?.createOpencodeClient;
if (typeof create !== 'function') {
  console.error('[FAIL] createOpencodeClient not found in the installed SDK.');
  process.exit(1);
}

const client = create({ baseUrl });
const sessions = await client.session.list().then((r) => r?.data || r || []).catch((e) => {
  console.error(`[FAIL] could not reach ${baseUrl}: ${e.message}`);
  console.error('Is the SSH tunnel up? (see header comment)');
  process.exit(1);
});

if (!messagesId) {
  if (!sessions.length) { console.log('(no sessions on this server)'); process.exit(0); }
  for (const s of sessions) {
    const info = s?.info || s;
    console.log(`${info.id}  ${info.title || '(untitled)'}  updated=${info.time?.updated || info.updatedAt || '?'}`);
  }
  console.log('\nRead one: node tools/feedback-sessions.mjs --messages <id>');
  process.exit(0);
}

const msgs = await client.session.messages({ path: { id: messagesId } }).then((r) => r?.data || r || []);
const slice = msgs.slice(-limit);
for (const m of slice) {
  const role = m?.info?.role || m?.role || '?';
  const parts = m?.parts || [];
  const text = parts.filter((p) => p?.type === 'text' && p.text).map((p) => p.text).join('\n');
  const tools = parts.filter((p) => p?.type === 'tool' || p?.type === 'tool_use').map((p) => p.tool || p.name || 'tool');
  console.log(`--- [${role}] ---`);
  if (text) console.log(text.slice(0, 2000));
  if (tools.length) console.log(`(tools: ${tools.join(', ')})`);
}
