// feedback/log.js — per-session event log with secret redaction.
// Full log never goes in an embed; "View Full Log" replies ephemerally with
// the .txt attachment built here.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = resolve(__dirname, '..', '..', 'data', 'bot-state', 'feedback-logs');

const memory = new Map(); // sessionId -> string[]

function ensureDir() {
  try { mkdirSync(LOG_DIR, { recursive: true }); } catch { /* ignore */ }
}

function redact(text) {
  let s = String(text ?? '');
  // Discord webhook URLs are tokens: never persist them.
  s = s.replace(/https:\/\/discord\.com\/api\/webhooks\/[^\s"']+/gi, '[REDACTED-WEBHOOK]');
  // Generic token shapes.
  s = s.replace(/(xox[bap]-[A-Za-z0-9-]+)/g, '[REDACTED-TOKEN]');
  s = s.replace(/(pmc_morgue_[A-Za-z0-9]+)/g, '[REDACTED-KEY]');
  s = s.replace(/(sk-[A-Za-z0-9-_]+)/g, '[REDACTED-KEY]');
  // Env-secret values, when present in this process.
  for (const key of ['DISCORD_BOT_TOKEN', 'FORUM_PASSWORD', 'FORUM_LSPD_PASSWORD', 'FORUM_LSSD_PASSWORD', 'FORUM_SADCR_PASSWORD', 'FORUM_DAO_PASSWORD', 'AGH_PASSWORD', 'FACE_API_KEY']) {
    const v = process.env[key];
    if (v && v.length >= 6 && s.includes(v)) s = s.split(v).join('[REDACTED]');
  }
  return s;
}

function fileFor(sessionId) {
  const safe = String(sessionId).replace(/[^a-zA-Z0-9._-]/g, '_');
  return resolve(LOG_DIR, `${safe}.txt`);
}

export function appendLog(sessionId, line) {
  const s = `[${new Date().toISOString()}] ${redact(line)}`;
  if (!memory.has(sessionId)) memory.set(sessionId, []);
  memory.get(sessionId).push(s);
  try {
    ensureDir();
    writeFileSync(fileFor(sessionId), memory.get(sessionId).join('\n') + '\n', 'utf-8');
  } catch { /* best effort */ }
}

export function appendEvent(sessionId, event, raw) {
  let line;
  try {
    line = typeof raw === 'string' ? raw : JSON.stringify(event?.raw ?? raw ?? event);
  } catch {
    line = `[unserializable ${event?.kind || 'event'}]`;
  }
  appendLog(sessionId, `${event?.kind || 'event'}: ${line}`.slice(0, 2000));
}

export function getLogText(sessionId) {
  if (memory.has(sessionId)) return memory.get(sessionId).join('\n');
  try {
    const f = fileFor(sessionId);
    if (existsSync(f)) {
      const text = readFileSync(f, 'utf-8');
      memory.set(sessionId, text.split('\n').filter(Boolean));
      return text;
    }
  } catch { /* ignore */ }
  return '(empty log)';
}

export function logAttachment(sessionId) {
  return { name: `feedback-${String(sessionId).slice(0, 12)}.txt`, text: redact(getLogText(sessionId)).slice(0, 500000) };
}

export function clearLog(sessionId) {
  memory.delete(sessionId);
}

export { redact };
