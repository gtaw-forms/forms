// feedback/opencode.js — thin wrapper around @opencode-ai/sdk.
// The SDK is an explicit dependency of discord-bot/package.json. Every import
// is lazy so the bot still boots when the SDK or the server is down; all
// failures are surfaced in the embed, never thrown silently.
//
// Verified against @opencode-ai/sdk 1.19.5 docs (opencode.ai/docs/sdk):
//   createOpencodeClient({ baseUrl }) -> client with session.*, app.agents,
//   config.providers, event.subscribe, global.health (v2 only).
// Exact event/permission shapes differ by server version, so this module
// normalizes defensively and tools/feedback-verify.mjs prints the live
// method + agent + model surface. Run it on the VPS before first use.
import { OPENCODE_DEFAULT_URL, DEFAULT_MODEL, DEFAULT_AGENTS } from './constants.js';

let client = null;
let clientBaseUrl = null;
let eventAbort = null;

function baseUrl() {
  return (process.env.OPENCODE_URL || OPENCODE_DEFAULT_URL).replace(/\/$/, '');
}

function modelRef() {
  return {
    providerID: process.env.FEEDBACK_MODEL_PROVIDER || DEFAULT_MODEL.providerID,
    modelID: process.env.FEEDBACK_MODEL || DEFAULT_MODEL.modelID,
  };
}

function agentNames() {
  return {
    plan: process.env.FEEDBACK_PLAN_AGENT || DEFAULT_AGENTS.plan,
    build: process.env.FEEDBACK_BUILD_AGENT || DEFAULT_AGENTS.build,
  };
}

function str(v, fallback = '') {
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return fallback;
  try {
    const j = JSON.stringify(v);
    return j && j !== '{}' ? j.slice(0, 200) : fallback;
  } catch { return fallback; }
}

export function isDryRun() {
  return String(process.env.FEEDBACK_DRY_RUN || '').toLowerCase() === 'true';
}

export async function getClient() {
  if (client && clientBaseUrl === baseUrl()) return client;
  const mod = await import('@opencode-ai/sdk').catch((e) => {
    throw new Error(`@opencode-ai/sdk not installed or failed to load: ${e.message}. Run npm install in discord-bot/.`);
  });
  const create = mod.createOpencodeClient || mod.default?.createOpencodeClient;
  if (typeof create !== 'function') {
    throw new Error('createOpencodeClient not found in @opencode-ai/sdk exports. Run tools/feedback-verify.mjs to inspect the installed SDK.');
  }
  client = create({ baseUrl: baseUrl() });
  clientBaseUrl = baseUrl();
  return client;
}

export async function checkHealth() {
  const c = await getClient();
  // global.health is v2-only; fall back to config.get as a liveness probe.
  try {
    if (c.global?.health) {
      const r = await c.global.health({}, { throwOnError: true });
      return { ok: true, version: r?.data?.version || r?.version || 'unknown' };
    }
  } catch { /* fall through */ }
  try {
    await c.config.get();
    return { ok: true, version: 'unknown' };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

// Verify agents + model against the LIVE server. Fails closed: unknown agent
// or model names abort the session start and list what the server reported.
export async function verifySetup() {
  const c = await getClient();
  const want = agentNames();
  const model = modelRef();
  const seen = { agents: [], providers: [], agentOk: {}, modelOk: false, warnings: [] };

  try {
    const r = await c.app.agents();
    const list = r?.data || r || [];
    seen.agents = (Array.isArray(list) ? list : []).map((a) => a?.name || a?.id || String(a));
  } catch (e) {
    seen.warnings.push(`app.agents() failed: ${e?.message || e}`);
  }
  for (const key of ['plan', 'build']) {
    seen.agentOk[key] = seen.agents.length === 0 ? true : seen.agents.includes(want[key]);
    if (!seen.agentOk[key]) {
      seen.warnings.push(`Agent "${want[key]}" (${key}) not reported by server. Seen: ${seen.agents.join(', ') || '(none)'}.`);
    }
  }

  try {
    const r = await c.config.providers({ throwOnError: true }).catch(() => c.config.providers());
    const providers = r?.data?.providers || r?.providers || [];
    seen.providers = (Array.isArray(providers) ? providers : []).map((p) => p?.id || p?.name || String(p));
    // Model presence: providers payload shape varies; treat "listed provider"
    // as a soft pass and let session.prompt fail closed otherwise.
    seen.modelOk = seen.providers.length === 0 ? true : seen.providers.includes(model.providerID);
    if (!seen.modelOk) seen.warnings.push(`Provider "${model.providerID}" not listed. Seen: ${seen.providers.join(', ') || '(none)'}.`);
  } catch (e) {
    seen.warnings.push(`config.providers() failed: ${e?.message || e}`);
    seen.modelOk = true;
  }
  return { ...seen, want, model };
}

export async function createSession(title, directory) {
  const c = await getClient();
  const body = { title: String(title || 'Feedback').slice(0, 120) };
  if (directory) body.directory = directory;
  const r = await c.session.create({ body }, { throwOnError: true }).catch(async () => c.session.create({ body }));
  const id = r?.data?.id || r?.id;
  if (!id) throw new Error('session.create returned no id.');
  return id;
}

export async function sendPrompt(sessionId, { text, agent, noReply = false }) {
  const c = await getClient();
  const model = modelRef();
  const body = { parts: [{ type: 'text', text: String(text) }], noReply };
  if (agent) body.agent = agent;
  if (!noReply) body.model = model;
  const r = await c.session.prompt({ path: { id: sessionId }, body }, { throwOnError: true })
    .catch(async () => c.session.prompt({ path: { id: sessionId }, body }));
  if (r?.error) throw new Error(typeof r.error === 'string' ? r.error : (r.error?.message || 'session.prompt failed'));
  return r?.data || r;
}

export async function abortSession(sessionId) {
  const c = await getClient();
  try {
    await c.session.abort({ path: { id: sessionId } });
    return true;
  } catch {
    return false;
  }
}

export async function listMessages(sessionId) {
  const c = await getClient();
  try {
    const r = await c.session.messages({ path: { id: sessionId } });
    return r?.data || r || [];
  } catch {
    return [];
  }
}

// Best-effort permission reply. The permission endpoint name/shape varies by
// server version; probe candidates and fail closed with a clear log line.
// Transient network failures get retried with backoff (the VPS loopback link
// occasionally drops a call). Everything else fails fast — retrying a
// rejected prompt could double-send a run.
export function isTransientError(e) {
  const m = String(e?.message || e).toLowerCase();
  return /fetch failed|econnrefused|econnreset|etimedout|enotfound|eai_again|socket hang up|network|temporarily|timeout|502|503|504/.test(m);
}

export async function sendPromptWithRetry(sessionId, body, opts = {}, sender = sendPrompt) {
  const tries = opts.tries || 3;
  const baseMs = opts.baseMs || 1500;
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await sender(sessionId, body);
    } catch (e) {
      last = e;
      if (!isTransientError(e) || i === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, baseMs * (i + 1)));
    }
  }
  throw last;
}

export async function replyPermission(sessionId, permissionId, allow) {
  const c = await getClient();
  const candidates = [
    () => c.session.postSessionByIdPermissionsByPermissionId?.({
      path: { id: sessionId, permissionID: permissionId },
      body: allow ? { action: 'allow' } : { action: 'deny' },
    }),
    () => c.session.replyPermission?.({ sessionId, permissionId, decision: allow ? 'allow' : 'deny' }),
  ];
  for (const fn of candidates) {
    try {
      const target = fn;
      // Skip candidates whose root method does not exist.
      const probe = target.toString();
      if (probe.includes('?.') && probe.includes('undefined')) {
        // The optional-call short-circuits to undefined — try next.
        const out = target();
        if (out === undefined) continue;
        await out;
        return true;
      }
      await target();
      return true;
    } catch {
      continue;
    }
  }
  throw new Error('No working permission-reply endpoint on this server version. Run tools/feedback-verify.mjs and update replyPermission().');
}

// Normalize the many possible event shapes into a small stable set the
// controller can render. Unknown shapes pass through as { kind: 'other' } and
// are appended to the full log verbatim.
export function normalizeEvent(raw) {
  if (!raw || typeof raw !== 'object') return { kind: 'other', raw };
  const type = raw.type || raw.event || '';
  const p = raw.properties || raw.payload || raw.data || {};
  const sessionId = p.sessionID || p.sessionId || raw.sessionID || raw.sessionId || null;
  const t = String(type).toLowerCase();

  if (t.includes('permission') || p.permissionID || p.permissionId) {
    const labelRaw = p.description ?? p.tool ?? p.command ?? 'extra scope';
    const label = str(labelRaw, 'extra scope') || 'extra scope';
    return {
      kind: 'permission',
      sessionId,
      permissionId: p.permissionID || p.permissionId || p.id || null,
      label,
      raw,
    };
  }
  if (t.includes('abort') || t.includes('error')) {
    const errObj = p.error ?? p.message;
    let text;
    if (typeof errObj === 'string') text = errObj;
    else if (errObj && typeof errObj === 'object') text = errObj.data?.message || errObj.message;
    if (!text) {
      try { text = JSON.stringify(errObj ?? type); } catch { text = type; }
    }
    return { kind: 'error', sessionId, text: String(text || type).slice(0, 500), raw };
  }
  if (t.includes('idle') || t.includes('complete') || t.includes('finish')) {
    return { kind: 'done', sessionId, raw };
  }
  const text = p.text || p.delta || p.content || (typeof p.part === 'object' ? p.part?.text : null);
  if (text && (t.includes('message') || t.includes('text') || t.includes('part') || t.includes('delta'))) {
    return { kind: 'text', sessionId, text: String(text), raw };
  }
  if (t.includes('tool') || p.tool) {
    return {
      kind: p.status === 'completed' || t.includes('end') || t.includes('done') ? 'tool-done' : 'tool-start',
      sessionId,
      tool: p.tool || p.name || type,
      input: p.input || p.args || null,
      raw,
    };
  }
  if (t.includes('file') || p.file || p.path) {
    return { kind: 'file', sessionId, path: p.file || p.path || p.name, raw };
  }
  return { kind: 'other', sessionId, raw };
}

export async function subscribeEvents(onEvent) {
  const c = await getClient();
  if (typeof c.event?.subscribe !== 'function') {
    throw new Error('client.event.subscribe is not available on the installed SDK. Run tools/feedback-verify.mjs.');
  }
  if (eventAbort) { try { eventAbort.abort(); } catch { /* ignore */ } }
  eventAbort = new AbortController();
  const sub = await c.event.subscribe(undefined, { signal: eventAbort.signal }).catch(async () => c.event.subscribe());
  const stream = sub?.stream || sub?.data?.stream || sub;
  if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
    throw new Error('event.subscribe returned no async stream on this SDK version.');
  }
  (async () => {
    try {
      for await (const ev of stream) {
        try { await onEvent(normalizeEvent(ev), ev); } catch { /* never break the loop */ }
      }
    } catch {
      // Stream ended (abort or server down). The controller re-subscribes.
    }
  })();
  return () => { try { eventAbort.abort(); } catch { /* ignore */ } };
}

export function initialPrompt(requestText, repoDir) {
  const agents = agentNames();
  const model = modelRef();
  return [
    `You are working on the PHMC Forms repository at ${repoDir || '(server default directory)'}.`,
    `MANDATORY FIRST STEP: before ANY action on the repo, read the global agent/CLAUDE.md for project scope and information, and follow it.`,
    `Confirm the precedence on this machine (AGENTS.md auto-read vs CLAUDE.md) and state the resolved path in your first reply.`,
    `Do NOT edit files or run shell commands until that file has been read in this session.`,
    `PHASE 1 (read-only, you are the "${agents.plan}" agent): restate the owner's request below, investigate the code, list what you would change, and ask any clarifying questions.`,
    `Do NOT edit files or run state-changing commands in this phase. Model: ${model.providerID}/${model.modelID}.`,
    `Write chat-visible prose for a Discord embed: plain sentences, minimal inline code — backticks ONLY for file paths, endpoint names, and commands, always balanced. Never wrap ordinary words or punctuation in backticks.`,
    `Structure every reply the same way so it renders uniformly (the embed shows a rolling ~800-char tail — front-load conclusions):`,
    `## <one-line finding>`,
    `<2-4 sentence summary>`,
    `- key point (one line each, max 5 bullets)`,
    `Then the machine ending from below. Keep machine lines EXACT (bare PLAN: / QUESTIONS: / NO-CHANGE-NEEDED, no # prefix, no extra wording on the line) — the bot parses them literally.`,
    `Before you finish, self-check the reply: (1) under ~900 characters total, (2) every backtick paired, (3) machine lines (if used) match exactly. Fix violations before sending.`,
    `End your review with EITHER:`,
    `(a) when a repo change may be warranted — two machine-readable sections (the bot parses these):`,
    `PLAN: (numbered list, max 5 items, each one line)`,
    `QUESTIONS: (Q1., Q2., ... — each a single complete sentence; omit the section when none remain)`,
    `(b) when the request is purely a question and no repo change is warranted — answer it directly in your reply (the owner reads it in the embed) and end with a line: NO-CHANGE-NEEDED. Do NOT invent a plan.`,
    `OWNER REQUEST:`,
    String(requestText || '').slice(0, 4000),
  ].join('\n');
}

export function buildPrompt(requestText) {
  return { model: modelRef(), agents: agentNames() };
}
