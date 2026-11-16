// feedback/controller.js — orchestrates the two-phase feedback session.
// One turn = ONE bot message with ONE embed, edited in place (message.edit,
// or interaction.update for button presses). Edits throttle to ~1/sec.
import { execFile } from 'child_process';
import { existsSync, statSync } from 'fs';
import { MessageFlags } from 'discord.js';
import { STATES } from './constants.js';
import {
  getActiveSession,
  createSessionRecord,
  updateSession,
  updateSessionData,
  transitionTo,
  archiveSession,
  appendHistory,
  markHistoryRecorded,
} from './store.js';
import { buildFeedbackView, toDiscordMessage } from './render.js';
import { appendLog, appendEvent, getLogText, logAttachment } from './log.js';
import { parseFeedbackCustomId } from './constants.js';

function repoDir() {
  return process.env.FEEDBACK_REPO_DIR || process.cwd();
}

// Branch the agent commits + pushes (spec said main; the repo has no main —
// the work branch is `source`). Overridable per environment.
function deployBranch() {
  return (process.env.FEEDBACK_DEPLOY_BRANCH || 'source').trim() || 'source';
}

function ownerId() {
  return process.env.BOT_OWNER_ID || '';
}

export function isOwner(userId) {
  const owner = ownerId();
  return !!owner && userId === owner;
}

function shortId(len = 6) {
  return Math.random().toString(16).slice(2, 2 + len);
}

// ── Edit throttle (1/sec, coalescing) ──
const editState = new Map(); // messageId -> { timer, pending }

async function editMessageThrottled(message, view, sessionId, immediate = false) {
  const key = message.id;
  const entry = editState.get(key) || {};
  entry.pending = view;
  if (immediate) {
    if (entry.timer) { clearTimeout(entry.timer); entry.timer = null; }
    editState.set(key, entry);
    await flushEdit(message, sessionId);
    return;
  }
  editState.set(key, entry);
  if (entry.timer) return;
  entry.timer = setTimeout(() => flushEdit(message, sessionId), 1000);
}

async function flushEdit(message, sessionId) {
  const entry = editState.get(message.id);
  if (!entry) return;
  entry.timer = null;
  const view = entry.pending;
  entry.pending = null;
  if (!view) return;
  try {
    const msg = await toDiscordMessage(view);
    await message.edit(msg);
  } catch (e) {
    appendLog(sessionId, `edit failed: ${e?.message || e}`);
  }
}

async function renderActive(client, record, immediate = false) {
  const view = buildFeedbackView(record.state, record.data || {});
  try {
    const channel = await client.channels.fetch(record.channelId);
    const message = await channel.messages.fetch(record.messageId);
    await editMessageThrottled(message, view, record.id, immediate);
  } catch (e) {
    appendLog(record.id, `render failed: ${e?.message || e}`);
  }
}

function runCmd(cmd, args, cwd, timeoutMs = 600000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd, timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ ok: !err, code: err?.code ?? 0, stdout: String(stdout || ''), stderr: String(stderr || '').slice(0, 4000) });
    });
  });
}

function parsePlanSections(text) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const plan = [];
  const questions = [];
  let mode = null;
  let sawPlan = false;
  let sawQ = false;
  for (const line of lines) {
    if (/^plan\s*:?$/i.test(line)) { mode = 'plan'; sawPlan = true; continue; }
    if (/^questions\s*:?$/i.test(line)) { mode = 'q'; sawQ = true; continue; }
    if (mode === 'plan' && /^\d+[.)]\s+/.test(line)) {
      const item = line.replace(/^\d+[.)]\s+/, '').slice(0, 300);
      if (item.length >= 5) plan.push(item);
    } else if (mode === 'q') {
      // Numbered (Q1. ...) or trailing-? lines — but only substantive,
      // complete-sentence questions. Short fragments ("public?") are agent
      // thinking-aloud, not questions for the owner.
      let q = null;
      const m = line.match(/^q\d+[.)]?\s*(.*)/i);
      if (m) q = m[1];
      else if (/\?\s*$/.test(line)) q = line;
      if (q) {
        q = q.trim().slice(0, 300);
        if (q.length >= 15 && /\s/.test(q)) questions.push(q);
      }
    }
  }
  return { plan, questions, sawPlan, sawQ };
}

// The mandatory gate: agent/CLAUDE.md (or AGENTS.md at repo root) must be
// read before any edit/shell. Tracked from file/tool events.
const CLAUDE_RES = [/agent\/CLAUDE\.md$/i, /(^|\/)AGENTS\.md$/i, /CLAUDE\.md$/i];
const EDIT_RES = [/^edit\b/i, /^write\b/i, /apply_patch/i, /shell/i, /bash/i, /exec/i];

export function isClaudeReadEvent(ev) {
  const p = ev?.path || ev?.tool || '';
  if (ev?.kind === 'file') return CLAUDE_RES.some((re) => re.test(String(p)));
  return false;
}

export function isStateChangingEvent(ev) {
  if (ev?.kind !== 'tool-start') return false;
  const t = `${ev.tool || ''} ${JSON.stringify(ev.input || '')}`;
  return EDIT_RES.some((re) => re.test(t));
}

// A session is replaceable when it never got going: pre-execution state with
// no plan items and no progress. Anything with real work keeps the guard.
export function isReplaceableSession(rec) {
  if (!rec) return false;
  if (![STATES.REVIEWING, STATES.AWAITING_ANSWERS, STATES.READY, STATES.PAUSED].includes(rec.state)) return false;
  const d = rec.data || {};
  if ((d.progress || []).length) return false;
  if ((d.planItems || []).length) return false;
  return true;
}

// Re-render a replaced/abandoned session's status message as a closed marker
// so the outcome is visible inline instead of silently destroyed.
async function markSuperseded(client, oldRec, reason) {
  try {
    const { buildFeedbackView, toDiscordMessage } = await import('./render.js');
    const data = {
      ...(oldRec.data || {}),
      shortId: oldRec.id,
      sessionId: oldRec.id,
      supersedeReason: reason || null,
      lastRequest: (!oldRec.data?.awaitingRequest && oldRec.data?.requestSummary) ? oldRec.data.requestSummary : null,
    };
    const view = buildFeedbackView(STATES.SUPERSEDED, data);
    const msg = await toDiscordMessage(view);
    const channel = await client.channels.fetch(oldRec.channelId);
    const m = await channel.messages.fetch(oldRec.messageId);
    await m.edit(msg);
    appendLog(oldRec.id, 'old status message marked superseded');
  } catch (e) {
    appendLog(oldRec.id, `supersede render failed: ${e?.message || e}`);
  }
}

// Mostly-live output: the SSE stream carries tool/permission events but not
// reliably the agent's prose, so poll session.messages every few seconds and
// render the tail of the latest assistant message. Single global ticker;
// each tick no-ops unless a session is actively running.
let liveTextTimer = null;

export function startLiveTextTicker(client) {
  if (liveTextTimer) clearInterval(liveTextTimer);
  liveTextTimer = setInterval(() => {
    tickLiveText(client).catch(() => {});
  }, 5000);
}

async function tickLiveText(client) {
  const rec = getActiveSession();
  if (!rec || !rec.opencodeSessionId || rec.data?.awaitingRequest) return;
  if (![STATES.REVIEWING, STATES.AWAITING_ANSWERS, STATES.READY, STATES.WORKING, STATES.TESTING, STATES.DEPLOYING].includes(rec.state)) return;
  const { isDryRun, listMessages } = await import('./opencode.js');
  if (isDryRun()) return;
  try {
    const msgs = await listMessages(rec.opencodeSessionId);
    const texts = assistantTexts(msgs);
    if (!texts.length) return;
    const full = texts.join('\n\n').slice(-4000);
    if (full === rec.data?.liveFull) return;
    const prev = rec.data?.liveFull || '';
    const added = full.length > prev.length && full.startsWith(prev) ? full.slice(prev.length) : full;
    // Window the display text HERE, where the full text (and therefore the
    // true line boundary) is known — never store a pre-cut fragment.
    const { tailClip } = await import('./render.js');
    updateSessionData({ liveText: tailClip(full, 1000), liveFull: full });
    if (added.trim()) appendLog(rec.id, `agent: ${added.trim().slice(0, 1500)}`);
    await renderActive(client, getActiveSession());
  } catch { /* next tick */ }
}

// Kill-switch: FEEDBACK_ENABLED=false blocks new sessions (pauses /feedback
// until further notice) while leaving any live session fully usable.
export function isFeedbackEnabled() {
  return String(process.env.FEEDBACK_ENABLED ?? 'true').toLowerCase() !== 'false';
}

// ── Session start (/feedback) ──
export async function startFeedback(interaction) {
  if (!isOwner(interaction.user.id)) {
    await interaction.reply({ content: 'Only the bot owner can use this.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (!isFeedbackEnabled()) {
    await interaction.reply({ content: 'Feedback sessions are paused until further notice.', flags: MessageFlags.Ephemeral });
    return;
  }
  const existing = getActiveSession();
  if (existing) {
    if (isReplaceableSession(existing)) {
      // Replaced, not silently destroyed: the old status message is
      // re-rendered as a closed marker and the outcome goes to history.
      appendHistory({
        id: existing.id,
        shortId: existing.data?.shortId || existing.id,
        outcome: 'superseded',
        summary: existing.data?.requestSummary || '',
        detail: 'replaced by a newer /feedback before anything started',
      });
      await markSuperseded(interaction.client, existing, 'a newer /feedback replaced this session before anything started — nothing was changed');
      appendLog(existing.id, 'replaced by new /feedback — previous session never started (no plan, no progress)');
      if (existing.opencodeSessionId) {
        try {
          const { abortSession, isDryRun } = await import('./opencode.js');
          if (!isDryRun()) await abortSession(existing.opencodeSessionId);
        } catch { /* orphan session is harmless */ }
      }
      archiveSession();
    } else {
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`fb:abandon:${existing.id}`).setLabel('Abandon & start fresh').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`fb:keep:${existing.id}`).setLabel('Keep current').setStyle(ButtonStyle.Secondary),
      );
      await interaction.reply({
        content: `One feedback session is already active (${existing.id} — ${existing.state}). Abandoning archives it and frees the slot; its OpenCode run is aborted.`,
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }
  // No prompt text here — the modal IS the prompt. Showing it is the
  // acknowledgement, so this must run before any defer.
  await openAskModal(interaction);
}

// Modal descriptor (pure data — unit-tested for Discord limits without
// needing discord.js). One paragraph field for the request text.
export function askModalDescriptor() {
  return {
    customId: 'fb:ask:new',
    title: 'Ask PHMC Bot',
    fields: [
      {
        customId: 'fb:ask:text',
        label: 'Your feedback, question or query',
        placeholder: 'Describe the bug, ask the question…',
        required: true,
        maxLength: 2000,
      },
    ],
  };
}

async function openAskModal(interaction) {
  const d = askModalDescriptor();
  const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
  const modal = new ModalBuilder().setCustomId(d.customId).setTitle(d.title);
  for (const f of d.fields) {
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(f.customId)
        .setLabel(f.label)
        .setPlaceholder(f.placeholder)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(f.required)
        .setMaxLength(f.maxLength),
    ));
  }
  await interaction.showModal(modal);
  appendLog(interaction.user?.id || 'owner', 'ask modal opened from /feedback');
}

// Modal submit: the request text arrives with the session slot already
// validated. Opens the DM, creates the session, and starts the review.
export async function onFeedbackAskModal(interaction) {
  if (interaction.customId !== 'fb:ask:new') return false;
  if (!isOwner(interaction.user.id)) {
    await interaction.reply({ content: 'Only the bot owner can use this.', flags: MessageFlags.Ephemeral });
    return true;
  }
  let text = '';
  try { text = interaction.fields.getTextInputValue('fb:ask:text')?.trim() || ''; } catch { /* ignore */ }
  if (!text) {
    await interaction.reply({ content: 'Empty request — nothing started.', flags: MessageFlags.Ephemeral });
    return true;
  }
  const existing = getActiveSession();
  if (existing) {
    await interaction.reply({ content: 'The slot filled while you were typing — run /feedback again.', flags: MessageFlags.Ephemeral });
    return true;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    await beginSessionFromText(interaction.client, interaction.user, text.slice(0, 2000));
    await interaction.editReply({ content: 'Feedback session started — check your DM.' });
  } catch (e) {
    await interaction.editReply({ content: `Could not start: ${e?.message || e}` });
  }
  return true;
}

// Shared session bootstrap once the request text is known (modal submit or
// first DM): open the DM, post the status message, start the review.
async function beginSessionFromText(client, user, text) {
  let dm;
  try {
    dm = await user.createDM();
  } catch (e) {
    throw new Error(`Could not open a DM: ${e?.message || e}`);
  }
  const sid = shortId();
  const record = createSessionRecord({
    id: sid,
    ownerId: user.id,
    channelId: dm.id,
    data: {
      shortId: sid, sessionId: sid,
      awaitingRequest: false,
      requestSummary: text.slice(0, 200),
      investigated: [], progress: [], planItems: [], questions: [],
      phaseLabel: 'Starting review…',
    },
  });
  appendLog(sid, `session opened for ${user.tag || user.id} with request text`);
  const { buildFeedbackView: build, toDiscordMessage: toMsg } = await import('./render.js');
  const bootView = build(STATES.REVIEWING, record.data);
  const bootMsg = await toMsg(bootView);
  const botMessage = await dm.send(bootMsg);
  updateSession({ messageId: botMessage.id });
  appendLog(sid, `status message ${botMessage.id} in DM ${dm.id}`);
  await startReviewWithText(client, getActiveSession() || record, text);
  return sid;
}

// First owner message (DM-first path): record the request, then run the
// shared review start.
async function startReviewFromDm(message, rec) {
  updateSessionData({ awaitingRequest: false, requestSummary: message.content.slice(0, 200), phaseLabel: 'Starting review…' });
  await renderActive(message.client, getActiveSession() || rec, true);
  await startReviewWithText(message.client, rec, message.content);
}

// Shared Phase 1 start once the request text is known: verify setup, create
// the OpenCode session, and send the review prompt (with the mandatory
// CLAUDE.md-first instruction).
async function startReviewWithText(client, rec, text) {
  const { DEFAULT_AGENTS } = await import('./constants.js');
  const { getClient, checkHealth, verifySetup, createSession, sendPromptWithRetry, initialPrompt } = await import('./opencode.js');
  try {
    await getClient();
  } catch (e) {
    await failActive(client, rec.id, 'OpenCode server unreachable', `Could not connect to OpenCode at ${process.env.OPENCODE_URL || 'http://127.0.0.1:4096'}: ${e.message}. Start it with the opencode-serve systemd unit.`);
    return;
  }
  const health = await checkHealth();
  if (!health.ok) {
    await failActive(client, rec.id, 'OpenCode server unreachable', `Health check failed: ${health.error}`);
    return;
  }
  const setup = await verifySetup();
  appendLog(rec.id, `agents: ${setup.agents.join(', ') || '(none reported)'} model: ${setup.model.providerID}/${setup.model.modelID}`);
  if (!setup.agentOk.plan || !setup.agentOk.build || !setup.modelOk) {
    await failActive(client, rec.id, 'OpenCode setup mismatch', setup.warnings.join('\n') || 'setup verification failed');
    return;
  }
  let opencodeSessionId;
  try {
    opencodeSessionId = await createSession(`feedback-${rec.id}`, repoDir());
  } catch (e) {
    await failActive(client, rec.id, 'Could not create OpenCode session', e.message);
    return;
  }
  updateSession({ opencodeSessionId });
  appendLog(rec.id, `opencode session ${opencodeSessionId}`);
  const planAgent = process.env.FEEDBACK_PLAN_AGENT || DEFAULT_AGENTS.plan;
  appendLog(rec.id, 'attaching event stream before phase-1 prompt');
  await attachEventStream(client, rec.id).catch((e) => appendLog(rec.id, `event stream attach failed: ${e.message}`));
  startLiveTextTicker(client);
  // session.prompt long-polls until the run completes — do NOT await it here,
  // or the stream (and the embed) would miss the whole run. Fire and forget:
  // stream events drive the UI; this settles completion/failure/backfill.
  sendPromptWithRetry(opencodeSessionId, { text: initialPrompt(text, repoDir()), agent: planAgent }).then(async () => {
    appendLog(rec.id, 'phase-1 prompt run completed');
    await backfillPlanFromMessages(client, rec.id);
    await flushChatToChannel(client, rec.id);
  }).catch(async (e) => {
    await failActive(client, rec.id, 'Review failed', e.message, 'REVIEWING');
  });
  const rec2 = getActiveSession();
  if (rec2) await renderActive(client, rec2, true);
}

// Dry-run review driver (also used by tools/feedback-dryrun.mjs via samples).
async function playDryReview(client, sid, script, playScript) {
  const { getActiveSession: get } = await import('./store.js');
  const abort = { aborted: false };
  playDryReview._abort = abort;
  await playScript(script, async (ev) => {
    await handleReviewEvent(client, sid, ev);
    const rec = get();
    if (rec && rec.id === sid) await renderActive(client, rec);
  }, abort);
  const rec = get();
  if (rec && rec.id === sid) {
    updateSessionData({
      planItems: [
        'Disable the button and show a spinner while the request is pending.',
        'Ignore repeat clicks in submit.js.',
        'Re-enable on error with a message.',
      ],
      questions: ['Spinner on the button, or a full-form overlay?', 'Add a regression test for double-submit?'],
    });
    transitionTo(STATES.AWAITING_ANSWERS, {});
    const rec2 = get();
    await renderActive(client, rec2, true);
    appendLog(sid, 'dry-run review complete');
  }
}

async function handleReviewEvent(client, sid, ev) {
  appendEvent(sid, ev, ev);
  if (ev.kind === 'file' && ev.path) {
    const rec = getActiveSession();
    const inv = [...(rec?.data?.investigated || [])];
    if (!inv.some((l) => String(l).includes(ev.path))) inv.push(`Read ${ev.path}`);
    updateSessionData({ investigated: inv.slice(-20) });
  } else if (ev.kind === 'tool-start' || ev.kind === 'tool-done') {
    const rec = getActiveSession();
    const inv = [...(rec?.data?.investigated || [])];
    inv.push(`${ev.kind === 'tool-done' ? 'Ran' : 'Running'} ${ev.tool || 'tool'}`);
    updateSessionData({ investigated: inv.slice(-20) });
  } else if (ev.kind === 'text' && ev.text) {
    const rec = getActiveSession();
    const draft = `${rec?.data?.planDraft || ''}\n${ev.text}`.slice(-4000);
    updateSessionData({ planDraft: draft });
  }
}

export async function failActive(client, sid, failTitle, error, failedStep) {
  const { getActiveSession: get } = await import('./store.js');
  const rec = get();
  if (!rec || rec.id !== sid) return;
  try { transitionTo(STATES.FAILED, {}); } catch { updateSession({ state: STATES.FAILED }); }
  updateSessionData({ failTitle, error: String(error || '').slice(0, 1000), failedStep: failedStep || rec.state });
  if (!rec.data?.historyRecorded) {
    appendHistory({
      id: rec.id,
      shortId: rec.data?.shortId || rec.id,
      outcome: 'failed',
      summary: rec.data?.requestSummary || '',
      detail: String(failTitle || '').slice(0, 160),
      preDeployTag: rec.preDeployTag || null,
    });
    markHistoryRecorded();
  }
  appendLog(sid, `FAILED: ${failTitle}: ${error}`);
  const rec2 = get();
  await renderActive(client, rec2, true);
  if (rec2) await note(client, rec2, `Failed: ${failTitle} — ${String(error || '').slice(0, 200)}`);
}

// ── Owner DM messages ──
export async function onOwnerDm(message) {
  if (message.author?.bot) return;
  if (!isOwner(message.author.id)) return;
  const rec = getActiveSession();
  if (!rec) {
    try {
      await message.channel.send('No active feedback session — run /feedback to open one (a question box will pop up).');
    } catch { /* best effort */ }
    return;
  }
  if (rec.channelId && message.channelId !== rec.channelId) return;
  appendLog(rec.id, `owner: ${message.content.slice(0, 2000)}`);

  const { isDryRun } = await import('./opencode.js');

  // First message carries the request itself — nothing has run yet by design.
  if (!rec.opencodeSessionId) {
    if (isDryRun()) {
      updateSessionData({ awaitingRequest: false, requestSummary: message.content.slice(0, 200) || 'Dry-run request' });
      const { playScript, DRY_RUN_SCRIPT } = await import('./dryrun.js');
      await playDryReview(message.client, rec.id, DRY_RUN_SCRIPT, playScript);
      return;
    }
    await startReviewFromDm(message, rec);
    return;
  }

  if (isDryRun()) {
    // In dry-run, a DM during AWAITING answers revises the plan.
    if (rec.state === STATES.AWAITING_ANSWERS || rec.state === STATES.REVIEWING || rec.state === STATES.PAUSED) {
      updateSessionData({ planRevised: true });
      if (rec.state === STATES.PAUSED) {
        try { transitionTo(STATES.REVIEWING, {}); } catch { /* stay */ }
      } else if (rec.state === STATES.REVIEWING) {
        try { transitionTo(STATES.AWAITING_ANSWERS, {}); } catch { /* stay */ }
      }
      const rec2 = getActiveSession();
      await renderActive(message.client, rec2, true);
    }
    return;
  }

  const { sendPromptWithRetry } = await import('./opencode.js');
  const { STATES: S } = await import('./constants.js');

  // Follow-up: forward to the live session; the event stream revises the plan.
  // The embed resets first ("Processing new input…") so stale plan/questions
  // never linger next to the fresh context. If the agent is mid-run and the
  // server refuses concurrent prompts, the message is held and auto-forwarded
  // when the step finishes — never lost, never charged against the session.
  updateSessionData(freshContextPatch());
  await renderActive(message.client, getActiveSession(), true);
  try {
    await sendPromptWithRetry(rec.opencodeSessionId, { text: message.content.slice(0, 4000) });
    if (rec.state === S.PAUSED) {
      const pausedFrom = rec.pausedFrom || S.REVIEWING;
      try { transitionTo(pausedFrom === S.PAUSED ? S.REVIEWING : pausedFrom, {}); } catch { /* stay */ }
    }
  } catch (e) {
    const msg = e?.message || String(e);
    if (/busy|already running|in progress|concurrent|locked|turn/i.test(msg)) {
      updateSessionData({ pendingDm: message.content.slice(0, 4000) });
      appendLog(rec.id, `owner DM held (agent busy, ${message.content.length} chars) — will forward when the step finishes`);
      try {
        await message.channel.send('The agent is still working — I have held your message and will send it when this step finishes.');
      } catch { /* best effort */ }
      return;
    }
    await failActive(message.client, rec.id, 'Prompt failed', msg, rec.state);
    return;
  }
  const rec2 = getActiveSession();
  if (rec2) await renderActive(message.client, rec2, true);
}

// ── Button routing (fb:<action>:<sessionId>) ──
export async function onFeedbackButton(interaction) {
  const parsed = parseFeedbackCustomId(interaction.customId);
  if (!parsed) {
    // Starts with fb: but malformed (e.g. pre-fix double-prefixed buttons).
    // Ack fast so it never hangs into a timeout.
    if (interaction.customId.startsWith('fb:')) {
      await interaction.reply({ content: 'That button is from an outdated message — use the buttons on the latest status message.', flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }
    return false;
  }
  if (!isOwner(interaction.user.id)) {
    await interaction.reply({ content: 'Only the bot owner can use this.', flags: MessageFlags.Ephemeral });
    return true;
  }
  const rec = getActiveSession();
  if (!rec || rec.id !== parsed.sessionId) {
    await interaction.reply({ content: 'That session is no longer active.', flags: MessageFlags.Ephemeral });
    return true;
  }
  const { action } = parsed;
  appendLog(rec.id, `button: ${action}`);

  // Nothing has started yet (still waiting for the first DM): only the log
  // is valid. Answered here, before any defer, so this stays instant.
  if (rec.data?.awaitingRequest && action !== 'log') {
    await interaction.reply({ content: 'Send your request in this DM first — nothing has started yet.', flags: MessageFlags.Ephemeral });
    return true;
  }

  // Modals are their own acknowledgement — showModal must run first, before
  // any defer. Everything else defers below.
  if (action === 'answer') {
    await handleAnswerButton(interaction, rec);
    return true;
  }

  // Discord kills interactions after 3s, and every action below does slow
  // work first (OpenCode abort, git ops, message fetches). Acknowledge NOW,
  // then do the work: deferReply for ephemeral-only actions, deferUpdate
  // for actions that edit the main message.
  try {
    if (action === 'log' || action === 'revert-cancel' || action === 'keep' || action === 'abandon') {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }
    } else if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate();
    }
  } catch (e) {
    appendLog(rec.id, `button ack failed (${action}): ${e?.message || e}`);
    return true;
  }

  switch (action) {
    case 'approve':
      await handleApprove(interaction, rec);
      return true;
    case 'noaction':
      await handleNoAction(interaction, rec);
      return true;
    case 'retry':
      await handleRetry(interaction, rec);
      return true;
    case 'pause':
      await handlePause(interaction, rec);
      return true;
    case 'resume':
      await handleResume(interaction, rec);
      return true;
    case 'log':
      await handleLog(interaction, rec);
      return true;
    case 'revert':
      await handleRevertAsk(interaction, rec);
      return true;
    case 'revert-confirm':
      await handleRevertConfirm(interaction, rec);
      return true;
    case 'revert-cancel':
      await interaction.editReply({ content: 'Revert cancelled.' });
      return true;
    case 'keep':
      await interaction.editReply({ content: 'Keeping the current session.' });
      return true;
    case 'abandon':
      await handleAbandon(interaction, rec);
      return true;
    case 'complete':
      await handleComplete(interaction, rec);
      return true;
    case 'allow':
    case 'deny':
      await handlePermissionDecision(interaction, rec, action === 'allow');
      return true;
    default:
      return false;
  }
}

// Edit the ONE status message after the interaction was acknowledged
// (deferUpdate). Callers must defer first — this never calls update().
async function updateMainMessage(interaction, rec) {
  const view = (await import('./render.js')).buildFeedbackView(rec.state, rec.data || {});
  const msg = await (await import('./render.js')).toDiscordMessage(view);
  try {
    if (interaction.deferred && !interaction.replied) {
      await interaction.editReply(msg);
    } else if (!interaction.replied && !interaction.deferred) {
      await interaction.update(msg);
    } else {
      const channel = await interaction.client.channels.fetch(rec.channelId);
      const m = await channel.messages.fetch(rec.messageId);
      await m.edit(msg);
    }
  } catch (e) {
    appendLog(rec.id, `main-message edit failed: ${e?.message || e}`);
  }
}

// Ephemeral follow-up after deferUpdate (the main message keeps its own flow).
async function tellOwner(interaction, content) {
  try {
    await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
  } catch (e) {
    console.warn(`[feedback] followUp failed: ${e?.message || e}`);
  }
}

// ── Chat narration ──
// The embed is the state dashboard; the DM thread is the readable record.
// Steps, prose, plans and questions go here as plain text (no field limits),
// chunked to Discord's 2000-char message cap, longest-complete-chunks first.
export function chunkText(t, max = 2000) {
  const s = String(t ?? '').trim();
  if (!s) return [];
  if (s.length <= max) return [s];
  const chunks = [];
  let rest = s;
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n\n', max);
    if (cut < max * 0.4) cut = rest.lastIndexOf('\n', max);
    if (cut < max * 0.4) cut = rest.lastIndexOf(' ', max);
    if (cut < max * 0.4) cut = max;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks.filter(Boolean);
}

// Post plain text to the session DM. Never throws — chat is best-effort;
// the embed + log remain the source of truth.
export async function postChat(client, rec, text) {
  let body = String(text ?? '').trim();
  if (!body || !rec?.channelId) return 0;
  let note = '';
  if (body.length > 6000) {
    body = body.slice(0, 5940);
    note = '\n\n(…earlier part in View Full Log)';
  }
  const chunks = chunkText(body, note ? 1940 : 2000);
  try {
    const channel = await client.channels.fetch(rec.channelId);
    for (let i = 0; i < chunks.length; i++) {
      await channel.send(chunks[i] + (i === chunks.length - 1 ? note : ''));
    }
    appendLog(rec.id, `chat posted ${chunks.length} message(s), ${body.length} chars`);
    return chunks.length;
  } catch (e) {
    appendLog(rec.id, `chat post failed: ${e?.message || e}`);
    return 0;
  }
}

// One milestone line in the DM thread (step narration).
export async function note(client, rec, line) {
  await postChat(client, rec, line);
}

// Post newly completed assistant prose to the DM thread. Idempotent via the
// chatBaseline watermark: repeat calls (restore + done for the same run)
// post nothing new.
export async function flushChatToChannel(client, sid) {
  const rec = getActiveSession();
  if (!rec || rec.id !== sid || !rec.opencodeSessionId) return;
  const { listMessages } = await import('./opencode.js');
  const msgs = await listMessages(rec.opencodeSessionId).catch(() => null);
  if (!msgs) return;
  const { cleanProse } = await import('./render.js');
  const full = assistantTexts(msgs).join('\n\n').slice(-8000);
  if (!full.trim()) return;
  const base = rec.data?.chatBaseline || '';
  const newPart = full && base && full.startsWith(base) ? full.slice(base.length) : full;
  if (!newPart.trim()) {
    if (full !== base) updateSessionData({ chatBaseline: full });
    return;
  }
  const posted = await postChat(client, rec, cleanProse(newPart));
  if (posted) updateSessionData({ chatBaseline: full, liveText: '', liveFull: full });
}

async function handleApprove(interaction, rec) {
  const { STATES: S, DEFAULT_AGENTS } = await import('./constants.js');
  if (![S.REVIEWING, S.AWAITING_ANSWERS, S.READY].includes(rec.state)) {
    await tellOwner(interaction, `Cannot approve from ${rec.state}.`);
    return;
  }
  const { isDryRun } = await import('./opencode.js');
  try { transitionTo(S.READY, {}); } catch { /* already ready */ }
  try { transitionTo(S.WORKING, {}); } catch (e) {
    await tellOwner(interaction, e.message);
    return;
  }
  updateSessionData({ phaseLabel: 'Applying changes', progress: [{ text: 'Approved plan — starting execution…', done: false }] });
  // Fresh execution window: the review-era prose/plan text must not linger
  // in Latest once the build agent takes over.
  updateSessionData({ liveText: '', liveFull: '', planDraft: '' });
  const rec2 = getActiveSession();
  await updateMainMessage(interaction, rec2);
  appendLog(rec.id, 'plan approved — executing with build agent');

  if (isDryRun()) {
    const { playScript, DRY_RUN_EXEC_SCRIPT } = await import('./dryrun.js');
    const abort = { aborted: false };
    playDryReview._abort = abort;
    await playScript(DRY_RUN_EXEC_SCRIPT, async (ev) => {
      appendEvent(rec.id, ev, ev);
      const r = getActiveSession();
      if (r && r.id === rec.id) {
        const prog = [...(r.data?.progress || []), `${ev.kind === 'tool-done' ? 'Finished' : 'Started'} ${ev.tool || 'step'}`];
        updateSessionData({ progress: prog.slice(-20) });
        await renderActive(interaction.client, getActiveSession());
      }
    }, abort);
    await finishDryExecution(interaction.client, rec.id);
    return;
  }

  await note(interaction.client, rec, 'Approved — executing the plan.');
  const buildAgent = process.env.FEEDBACK_BUILD_AGENT || DEFAULT_AGENTS.build;
  const { sendPromptWithRetry, isTransientError } = await import('./opencode.js');
  try {
    await sendPromptWithRetry(rec.opencodeSessionId, {
      text: `Approved plan. Execute it now as the "${buildAgent}" agent. Stay within the approved scope; surface an Allow/Deny permission request for anything outside it.`,
      agent: buildAgent,
    });
  } catch (e) {
    const why = isTransientError(e)
      ? `Could not reach OpenCode after 3 tries (${e?.message || e}). Check opencode-serve on the VPS: systemctl status opencode-serve.`
      : (e?.message || e);
    await failActive(interaction.client, rec.id, 'Execution failed to start', why, 'WORKING');
    return;
  }
  await flushChatToChannel(interaction.client, rec.id);
}

async function finishDryExecution(client, sid) {
  const { STATES: S } = await import('./constants.js');
  const rec = getActiveSession();
  if (!rec || rec.id !== sid) return;
  try { transitionTo(S.TESTING, {}); } catch { /* ignore */ }
  updateSessionData({ checks: ['Tests passed (42/42) — dry run, no tests executed'] });
  await renderActive(client, getActiveSession(), true);
  try { transitionTo(S.DEPLOYING, {}); } catch { /* ignore */ }
  updateSessionData({
    checks: ['Tests passed (42/42) — dry run', 'Tagged pre-feedback-dryrun', 'Pushed to source · deploy succeeded (simulated)'],
    filesChanged: [
      { path: 'src/forms/IntakeForm.js', size: '4.2 KB', added: 18, removed: 3 },
      { path: 'src/forms/submit.js', size: '1.9 KB', added: 11, removed: 2 },
      { path: 'tests/submit.test.js', size: '0.8 KB', added: 24, removed: 0 },
    ],
    summary: 'Dry run: the submit button disables with a spinner, repeat clicks are ignored, re-enables on error. No files were changed.',
  });
  await renderActive(client, getActiveSession(), true);
  try { transitionTo(S.DONE, {}); } catch { /* ignore */ }
  await renderActive(client, getActiveSession(), true);
}

// Explicit abandon from the /feedback slot offer: archive a started session
// the owner no longer wants, mark its message, free the slot.
async function handleAbandon(interaction, rec) {
  const cur = getActiveSession();
  if (!cur || cur.id !== rec.id) {
    await interaction.editReply({ content: 'That session is already gone — run /feedback to start fresh.' });
    return;
  }
  appendHistory({
    id: cur.id,
    shortId: cur.data?.shortId || cur.id,
    outcome: 'closed',
    summary: cur.data?.requestSummary || '',
    detail: 'abandoned by owner via /feedback',
  });
  await markSuperseded(interaction.client, cur, 'abandoned by the owner via /feedback — nothing further will run');
  if (cur.opencodeSessionId) {
    try {
      const { abortSession, isDryRun } = await import('./opencode.js');
      if (!isDryRun()) await abortSession(cur.opencodeSessionId);
    } catch { /* ignore */ }
  }
  archiveSession();
  appendLog(cur.id, 'session abandoned by owner — slot free');
  await interaction.editReply({ content: 'Session closed and archived. Run /feedback again for a fresh session.' });
}

async function handleNoAction(interaction, rec) {
  const { STATES: S } = await import('./constants.js');
  if (![S.REVIEWING, S.AWAITING_ANSWERS, S.READY].includes(rec.state)) {
    await tellOwner(interaction, `Not applicable from ${rec.state}.`);
    return;
  }
  // The owner is the judge — close immediately with their request as context.
  // The slot frees right away (history recorded, message left as a
  // button-less tombstone); no separate Complete press needed.
  updateSessionData({
    noActionReason: `Owner marked no action needed: ${(rec.data?.requestSummary || 'no summary').slice(0, 300)}`,
    noActionAsked: false,
    verdict: null,
  });
  try { transitionTo(S.NO_ACTION, {}); } catch (e) {
    await tellOwner(interaction, e.message);
    return;
  }
  appendLog(rec.id, 'owner pressed No Action Needed — session closed with no changes');
  await updateMainMessage(interaction, getActiveSession());
  appendHistory({
    id: rec.id,
    shortId: rec.data?.shortId || rec.id,
    outcome: 'no-action',
    summary: rec.data?.requestSummary || '',
    preDeployTag: null,
  });
  archiveSession();
  try {
    const channel = await interaction.client.channels.fetch(rec.channelId);
    const m = await channel.messages.fetch(rec.messageId);
    await m.edit({ components: [] });
  } catch (e) {
    appendLog(rec.id, `tombstone edit failed: ${e?.message || e}`);
  }
  await note(interaction.client, rec, 'Closed — no action needed.');
}

// Pure: owner answers -> follow-up prompt text for the plan agent. Exported
// for the isolation tests.
export function buildAnswerPrompt(answers) {
  const lines = answers.map(({ q, a }, i) => `A${i + 1} (re: ${q}): ${a}`);
  return [
    'Owner answers to the plan questions:',
    ...lines,
    'Revise the plan accordingly and re-emit PLAN: and QUESTIONS: sections (omit QUESTIONS when none remain).',
    'Re-check the format rules before sending (under ~900 chars, backticks paired, machine lines exact).',
  ].join('\n');
}

// Opens the answer modal. showModal IS the acknowledgement — callers must
// route here before any defer.
async function handleAnswerButton(interaction, rec) {
  const { STATES: S } = await import('./constants.js');
  const questions = rec.data?.questions || [];
  if (![S.REVIEWING, S.AWAITING_ANSWERS, S.READY].includes(rec.state) || !questions.length) {
    await interaction.reply({ content: 'There are no open questions right now.', flags: MessageFlags.Ephemeral });
    return;
  }
  const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
  const modal = new ModalBuilder().setCustomId(`fb:answer:${rec.id}`).setTitle('Answer the plan questions');
  questions.slice(0, 5).forEach((q, i) => {
    const qs = String(q).slice(0, 300) || `Question ${i + 1}`;
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(`fb:aq:${i}`)
        .setLabel(`Q${i + 1}. ${qs.slice(0, 40)}`)
        .setPlaceholder(qs.slice(0, 100))
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false),
    ));
  });
  await interaction.showModal(modal);
  appendLog(rec.id, 'answer-questions modal opened');
}

// Handles the submitted answer modal.
export async function onFeedbackModal(interaction) {
  const parts = String(interaction.customId || '').split(':');
  if (parts.length !== 3 || parts[0] !== 'fb' || parts[1] !== 'answer') return false;
  if (!isOwner(interaction.user.id)) {
    await interaction.reply({ content: 'Only the bot owner can use this.', flags: MessageFlags.Ephemeral });
    return true;
  }
  const rec = getActiveSession();
  if (!rec || rec.id !== parts[2]) {
    await interaction.reply({ content: 'That session is no longer active.', flags: MessageFlags.Ephemeral });
    return true;
  }
  const { STATES: S } = await import('./constants.js');
  const questions = rec.data?.questions || [];
  if (![S.REVIEWING, S.AWAITING_ANSWERS, S.READY].includes(rec.state) || !questions.length) {
    await interaction.reply({ content: 'There are no open questions right now.', flags: MessageFlags.Ephemeral });
    return true;
  }
  const answers = [];
  questions.slice(0, 5).forEach((q, i) => {
    let v = '';
    try { v = interaction.fields.getTextInputValue(`fb:aq:${i}`)?.trim() || ''; } catch { /* missing field */ }
    if (v) answers.push({ q: String(q), a: v.slice(0, 1000) });
  });
  if (!answers.length) {
    await interaction.reply({ content: 'No answers entered — nothing sent.', flags: MessageFlags.Ephemeral });
    return true;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  appendLog(rec.id, `owner answered ${answers.length}/${questions.slice(0, 5).length} question(s) via modal`);
  const { isDryRun, sendPromptWithRetry } = await import('./opencode.js');
  updateSessionData(freshContextPatch());
  await renderActive(interaction.client, getActiveSession());
  if (isDryRun()) {
    updateSessionData({ planRevised: true });
    await interaction.editReply({ content: 'Dry run: answers recorded (simulated) — the agent would now revise the plan.' });
    await renderActive(interaction.client, getActiveSession());
    return true;
  }
  try {
    await sendPromptWithRetry(rec.opencodeSessionId, { text: buildAnswerPrompt(answers) });
    updateSessionData({ planRevised: true });
    await interaction.editReply({ content: 'Answers sent — the agent is revising the plan. Watch the status message for "Plan updated".' });
  } catch (e) {
    await interaction.editReply({ content: `Could not send answers: ${e.message}` });
    return true;
  }
  await renderActive(interaction.client, getActiveSession());
  return true;
}

// Restarts a wrongly-failed (or genuinely failed) review from the stored
// request: aborts any lingering run, re-attaches stream + ticker, and sends
// the original request back to the plan agent for a fresh run.
async function handleRetry(interaction, rec) {
  const { STATES: S, DEFAULT_AGENTS } = await import('./constants.js');
  if (rec.state !== S.FAILED) {
    await tellOwner(interaction, `Nothing to retry from ${rec.state}.`);
    return;
  }
  const { isDryRun, sendPromptWithRetry, abortSession, initialPrompt } = await import('./opencode.js');
  updateSessionData({ failTitle: null, error: null, failedStep: null, phaseLabel: 'Retrying review…', progress: [{ text: 'Retrying review from the stored request…', done: false }], liveText: '', liveFull: '', planDraft: '' });
  try { transitionTo(S.REVIEWING, {}); } catch (e) {
    await tellOwner(interaction, e.message);
    return;
  }
  appendLog(rec.id, 'owner pressed Retry — restarting review from the stored request');
  await updateMainMessage(interaction, getActiveSession());
  if (isDryRun()) {
    await renderActive(interaction.client, getActiveSession(), true);
    return;
  }
  const stored = rec.data?.requestSummary || '';
  if (!rec.opencodeSessionId || /waiting|describe the bug/i.test(stored)) {
    await tellOwner(interaction, 'No finished request to retry from — describe it in the DM and I will start the review.');
    return;
  }
  await abortSession(rec.opencodeSessionId);
  await attachEventStream(interaction.client, rec.id).catch((e) => appendLog(rec.id, `event stream attach failed: ${e.message}`));
  startLiveTextTicker(interaction.client);
  const planAgent = process.env.FEEDBACK_PLAN_AGENT || DEFAULT_AGENTS.plan;
  sendPromptWithRetry(rec.opencodeSessionId, { text: initialPrompt(stored, repoDir()), agent: planAgent }).then(async () => {
    await backfillPlanFromMessages(interaction.client, rec.id);
    await flushChatToChannel(interaction.client, rec.id);
  }).catch(async (e) => {
    await failActive(interaction.client, rec.id, 'Retry failed', e.message, 'REVIEWING');
  });
  const rec2 = getActiveSession();
  if (rec2) await renderActive(interaction.client, rec2, true);
}

// Fresh slate when the owner sends new input mid-session: the old plan,
// questions and prose no longer apply, so the embed resets to a
// "processing" view instead of echoing stale content. The agent holds full
// history server-side and re-emits sections in its revision.
export function freshContextPatch() {
  return {
    planDraft: '', planItems: [], questions: [], liveText: '', liveFull: '',
    verdict: null, noActionAsked: false, noActionReason: null, answered: false,
    planRevised: false, phaseLabel: 'Processing new input…',
  };
}

async function handlePause(interaction, rec, silent = false) {
  const say = silent ? (c) => appendLog(rec.id, `pause: ${c}`) : (c) => tellOwner(interaction, c);
  const { STATES: S } = await import('./constants.js');
  if (![S.REVIEWING, S.AWAITING_ANSWERS, S.READY, S.WORKING, S.TESTING, S.DEPLOYING].includes(rec.state)) {
    await say(`Nothing to pause from ${rec.state}.`);
    return;
  }
  const { isDryRun, abortSession } = await import('./opencode.js');
  if (playDryReview._abort) playDryReview._abort.aborted = true;
  if (!isDryRun() && rec.opencodeSessionId) await abortSession(rec.opencodeSessionId);
  try { transitionTo(S.PAUSED, {}); } catch (e) {
    await say(e.message);
    return;
  }
  appendLog(rec.id, `paused from ${rec.state}`);
  if (!silent) {
    await updateMainMessage(interaction, getActiveSession());
    await note(interaction.client, getActiveSession() || rec, 'Paused — send feedback or press Resume when ready.');
  }
}

async function handleResume(interaction, rec) {
  const { STATES: S } = await import('./constants.js');
  if (rec.state !== S.PAUSED) {
    await tellOwner(interaction, `Not paused (state ${rec.state}).`);
    return;
  }
  const back = rec.pausedFrom && rec.pausedFrom !== S.PAUSED ? rec.pausedFrom : S.REVIEWING;
  try { transitionTo(back, {}); } catch (e) {
    await tellOwner(interaction, e.message);
    return;
  }
  appendLog(rec.id, `resumed to ${back} — re-confirming plan`);
  const rec2 = getActiveSession();
  await updateMainMessage(interaction, rec2);
  await note(interaction.client, getActiveSession() || rec2 || rec, 'Resumed — re-confirming the plan.');
  const { isDryRun, sendPromptWithRetry } = await import('./opencode.js');
  if (!isDryRun() && rec.opencodeSessionId) {
    try {
      await sendPromptWithRetry(rec.opencodeSessionId, { text: 'Resuming. Re-confirm the approved plan first; if anything changed while paused, say so before continuing.' });
    } catch (e) {
      await failActive(interaction.client, rec.id, 'Resume failed', e.message, back);
    }
  }
}

async function handleLog(interaction, rec) {
  const { name, text } = logAttachment(rec.id);
  try {
    await interaction.editReply({
      content: `Full log for session ${rec.id} (redacted).`,
      files: [{ attachment: Buffer.from(text, 'utf-8'), name }],
    });
  } catch (e) {
    appendLog(rec.id, `log editReply failed: ${e?.message || e}`);
  }
}

async function handleRevertAsk(interaction, rec) {
  const { STATES: S } = await import('./constants.js');
  if (![S.DONE, S.FAILED].includes(rec.state)) {
    await tellOwner(interaction, `Revert applies to DONE/FAILED sessions (now ${rec.state}).`);
    return;
  }
  const tag = rec.preDeployTag;
  if (!tag) {
    await tellOwner(interaction, 'No pre-deploy tag recorded for this session — nothing to revert to.');
    return;
  }
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`fb:revert-confirm:${rec.id}`).setLabel(`Confirm revert to ${tag}`).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`fb:revert-cancel:${rec.id}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );
  await interaction.followUp({
    content: `This resets ${deployBranch()} to \`${tag}\` and force-pushes. Confirm?`,
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleRevertConfirm(interaction, rec) {
  await interaction.followUp({ content: `Reverting ${deployBranch()} to \`${rec.preDeployTag}\`…`, flags: MessageFlags.Ephemeral });
  const dir = repoDir();
  const tag = rec.preDeployTag;
  const reset = await runCmd('git', ['reset', '--hard', tag], dir);
  appendLog(rec.id, `git reset --hard ${tag}: ok=${reset.ok} ${reset.stdout.slice(0, 500)} ${reset.stderr.slice(0, 500)}`);
  if (!reset.ok) {
    await failActive(interaction.client, rec.id, 'Revert failed', reset.stderr || 'git reset failed', 'DONE');
    return;
  }
  const push = await runCmd('git', ['push', '--force-with-lease', 'origin', deployBranch()], dir);
  appendLog(rec.id, `git push --force-with-lease origin ${deployBranch()}: ok=${push.ok}`);
  if (!push.ok) {
    await failActive(interaction.client, rec.id, 'Revert push failed', push.stderr || 'git push failed', 'DONE');
    return;
  }
  updateSessionData({ checks: [...(rec.data?.checks || []), `Reverted ${deployBranch()} to ${tag}`] });
  await interaction.followUp({ content: `Reverted ${deployBranch()} to \`${tag}\`.`, flags: MessageFlags.Ephemeral });
  await renderActive(interaction.client, getActiveSession(), true);
}

async function handleComplete(interaction, rec) {
  const { STATES: S } = await import('./constants.js');
  if (![S.DONE, S.FAILED, S.NO_ACTION].includes(rec.state)) {
    await tellOwner(interaction, `Complete applies to DONE/FAILED/NO_ACTION sessions (now ${rec.state}).`);
    return;
  }
  const { isDryRun, abortSession } = await import('./opencode.js');
  if (!isDryRun() && rec.opencodeSessionId) await abortSession(rec.opencodeSessionId).catch(() => false);
  appendLog(rec.id, 'session completed + archived — slot free');
  try { transitionTo(S.COMPLETED, {}); } catch { updateSession({ state: S.COMPLETED }); }
  await note(interaction.client, rec, 'Session complete — archived. Run /feedback for a fresh session.');
  const done = getActiveSession();
  if (done) {
    const view = (await import('./render.js')).buildFeedbackView(done.state, done.data || {});
    const msg = await (await import('./render.js')).toDiscordMessage(view);
    try {
      await interaction.editReply(msg);
    } catch (e) {
      appendLog(rec.id, `complete editReply failed: ${e?.message || e}`);
    }
  } else {
    await tellOwner(interaction, 'Session complete.');
  }
  if (!rec.data?.historyRecorded) {
    appendHistory({
      id: rec.id,
      shortId: rec.data?.shortId || rec.id,
      outcome: rec.state === 'DONE' ? 'deployed' : rec.state === 'NO_ACTION' ? 'no-action' : 'closed',
      summary: rec.data?.requestSummary || rec.data?.summary || rec.data?.noActionReason || '',
      preDeployTag: rec.preDeployTag || null,
    });
    markHistoryRecorded();
  }
  archiveSession();
}

async function handlePermissionDecision(interaction, rec, allow) {
  const pending = rec.data?.permissionPending;
  if (!pending) {
    await tellOwner(interaction, 'No pending permission request.');
    return;
  }
  updateSessionData({ permissionPending: null });
  appendLog(rec.id, `permission ${allow ? 'ALLOWED' : 'DENIED'}: ${pending.label || pending.permissionId || ''}`);
  // Resolve the waiting line so the embed stops nagging for an answered ask.
  {
    const cur = getActiveSession();
    const prog = [...(cur?.data?.progress || [])];
    const outcome = `Permission ${allow ? 'allowed' : 'denied'}${pending.label ? `: ${pending.label}` : ''}`;
    let swapped = false;
    const next = prog.map((p) => {
      const text = typeof p === 'string' ? p : p.text;
      if (!swapped && typeof text === 'string' && text.startsWith('Waiting on permission')) {
        swapped = true;
        return typeof p === 'string' ? outcome : { ...p, text: outcome, done: true };
      }
      return p;
    });
    if (!swapped) next.push(outcome);
    updateSessionData({ progress: next.slice(-20) });
  }
  await note(interaction.client, getActiveSession() || rec, `Permission ${allow ? 'allowed' : 'denied'}${pending.label ? `: ${pending.label}` : ''}.`);
  const { isDryRun, replyPermission } = await import('./opencode.js');
  if (!isDryRun() && pending.permissionId && rec.opencodeSessionId) {
    try {
      await replyPermission(rec.opencodeSessionId, pending.permissionId, allow);
    } catch (e) {
      await tellOwner(interaction, `Permission reply failed: ${e.message}`);
      return;
    }
  }
  if (!allow) {
    await handlePause(interaction, getActiveSession() || rec, true);
    await updateMainMessage(interaction, getActiveSession() || rec);
    return;
  }
  await updateMainMessage(interaction, getActiveSession() || rec);
}

// ── Live event stream → in-place render ──
// Events are processed strictly in order through a chain: concurrent
// read-modify-write cycles used to clobber each other's progress lines and
// freeze stale buttons into the embed. Never awaits in parallel per process.
let eventChain = Promise.resolve();

export async function attachEventStream(client, sid) {
  const { subscribeEvents, isDryRun } = await import('./opencode.js');
  if (isDryRun()) return () => {};
  return subscribeEvents(async (ev) => {
    eventChain = eventChain.then(() => handleOneEvent(client, sid, ev)).catch((e) => {
      appendLog(sid, `event handler failed: ${e?.message || e}`);
    });
  });
}

async function handleOneEvent(client, sid, ev) {
  const rec = getActiveSession();
  if (!rec || rec.id !== sid) return;
  if (ev.sessionId && rec.opencodeSessionId && ev.sessionId !== rec.opencodeSessionId) return;
  appendEvent(sid, ev, ev.raw);
  await handleStreamEvent(client, rec, ev);
}

async function handleStreamEvent(client, rec, ev) {
  const { STATES: S } = await import('./constants.js');
  const cur = getActiveSession();
  if (!cur || cur.id !== rec.id) return;
  let data = { ...(cur.data || {}) };

  if (ev.kind === 'permission') {
    // Ignore permission asks for a different session; unattributed ones are
    // still shown (the server validates on reply).
    if (ev.sessionId && rec.opencodeSessionId && ev.sessionId !== rec.opencodeSessionId) return;
    data.permissionPending = { permissionId: ev.permissionId, label: ev.label };
    updateSessionData({ permissionPending: data.permissionPending });
    await renderActive(client, getActiveSession());
    return;
  }
  if (ev.kind === 'error') {
    // Only fail a session the error is attributed to. Unattributable errors
    // (e.g. aborting an already-archived session) are logged, never charged
    // against the live session — a wrong FAILED used to strand sessions here.
    if (ev.sessionId && rec.opencodeSessionId && ev.sessionId !== rec.opencodeSessionId) return;
    if (!ev.sessionId) {
      appendLog(cur.id, `unattributed session error (not charged): ${(ev.text || 'unknown').slice(0, 300)}`);
      return;
    }
    await failActive(client, cur.id, 'Session error', ev.text || 'unknown error', cur.state);
    return;
  }
  if (ev.kind === 'file' && ev.path) {
    const key = cur.state === S.WORKING || cur.state === S.TESTING || cur.state === S.DEPLOYING ? 'progress' : 'investigated';
    const list = [...(data[key] || [])];
    if (!list.some((l) => String(typeof l === 'string' ? l : l.text).includes(ev.path))) {
      list.push(`Read ${ev.path}`);
      data[key] = list.slice(-20);
    }
    // Mandatory gate: remember once agent/CLAUDE.md (or root AGENTS.md) is seen.
    if (!data.claudeRead && isClaudeReadEvent(ev)) data.claudeRead = true;
    updateSessionData(data);
    await renderActive(client, getActiveSession());
    return;
  }
  if (ev.kind === 'tool-start') {
    if (isStateChangingEvent(ev) && !data.claudeRead) {
      await failActive(client, cur.id, 'Aborted: CLAUDE.md gate', 'The agent attempted an edit/shell before the mandatory agent/CLAUDE.md read was observed in the event stream.', cur.state);
      const { abortSession } = await import('./opencode.js');
      if (cur.opencodeSessionId) await abortSession(cur.opencodeSessionId);
      return;
    }
    if (cur.state === S.READY) { try { transitionTo(S.WORKING, {}); } catch { /* ignore */ } }
    const prog = [...(data.progress || [])];
    prog.push({ text: `Started ${ev.tool || 'step'}…`, done: false });
    updateSessionData({ progress: prog.slice(-20) });
    await renderActive(client, getActiveSession());
    return;
  }
  if (ev.kind === 'tool-done') {
    const prog = [...(data.progress || [])];
    const last = prog.map((p) => (typeof p === 'string' ? p : p.text)).lastIndexOf(`Started ${ev.tool || 'step'}…`);
    if (last >= 0) prog[last] = { text: `Finished ${ev.tool || 'step'}`, done: true };
    else prog.push({ text: `Finished ${ev.tool || 'step'}`, done: true });
    updateSessionData({ progress: prog.slice(-20) });
    await renderActive(client, getActiveSession());
    return;
  }
  if (ev.kind === 'text' && ev.text) {
    if (cur.state === S.REVIEWING || cur.state === S.AWAITING_ANSWERS || cur.state === S.READY) {
      const draft = `${data.planDraft || ''}\n${ev.text}`.slice(-6000);
      // Parse the trailing window, not the whole history: a revision that
      // re-emits its sections replaces the old ones (answered questions
      // clear instead of lingering), while sections scrolled out of view
      // keep their previous values.
      const tail = draft.slice(-2000);
      const { plan, questions, sawPlan, sawQ } = parsePlanSections(tail);
      updateSessionData({
        planDraft: draft,
        planItems: (sawPlan && plan.length) ? plan : data.planItems,
        questions: sawQ ? questions : data.questions,
        // Fresh sections mean fresh content — drop one-shot phase labels
        // ("Processing…", "Assessing…") so the status line reads current.
        phaseLabel: (plan.length || questions.length) ? null : data.phaseLabel,
      });
      // No-action verdict (asked via the No Action Needed button): the agent
      // ends its assessment with VERDICT: NO-ACTION or ACTION-REQUIRED.
      const vm = tail.match(/VERDICT:\s*(NO-ACTION|ACTION-REQUIRED)|NO-CHANGE-NEEDED/i);
      if (vm) {
        // A direct answer, not a plan: surface it, don't force plan shape.
        if (/NO-CHANGE-NEEDED/i.test(vm[0]) && !/VERDICT/i.test(vm[0])) {
          updateSessionData({ answered: true });
          appendLog(cur.id, 'agent answered directly — no change proposed');
          await renderActive(client, getActiveSession(), true);
          return;
        }
        if ((vm[1] || '').toUpperCase() === 'NO-ACTION') {
          // Only the verdict asked for counts — a stale one arriving after
          // fresher input must not close the session.
          if (data.noActionAsked) {
            const reason = tail.slice(vm.index + vm[0].length).trim().split('\n').filter(Boolean).slice(0, 3).join(' ').slice(0, 500)
              || 'Agent judged no repo change warranted.';
            updateSessionData({ noActionReason: reason, noActionAsked: false });
            try { transitionTo(S.NO_ACTION, {}); } catch { /* stay */ }
            appendLog(cur.id, `verdict: NO-ACTION — ${reason.slice(0, 200)}`);
          } else {
            appendLog(cur.id, 'ignoring stale NO-ACTION verdict — newer input arrived after the ask');
          }
          await renderActive(client, getActiveSession(), true);
          return;
        }
        updateSessionData({ verdict: 'action-required', noActionAsked: false });
      }
      if ((plan.length || questions.length) && !data.planRevised) updateSessionData({ planRevised: true });
    }
    await renderActive(client, getActiveSession());
    return;
  }
  if (ev.kind === 'done') {
    await handlePhaseDone(client, cur);
  }
}

export async function handlePhaseDone(client, cur) {
  const { STATES: S } = await import('./constants.js');
  // A DM held during a busy run goes out now that the step finished.
  const pending = cur.data?.pendingDm;
  if (pending) {
    const { sendPromptWithRetry } = await import('./opencode.js');
    updateSessionData({ pendingDm: null });
    appendLog(cur.id, `forwarding held DM (${pending.length} chars)`);
    try {
      await sendPromptWithRetry(cur.opencodeSessionId, { text: pending });
      await renderActive(client, getActiveSession());
    } catch (e) {
      await failActive(client, cur.id, 'Prompt failed', e?.message || e, cur.state);
    }
    return;
  }
  if ([S.REVIEWING, S.AWAITING_ANSWERS].includes(cur.state)) {
    const fresh = getActiveSession();
    // Assessment run finished without a VERDICT line: don't hang on
    // "Assessing…" — hand the prose back and let the owner decide.
    if (fresh && fresh.id === cur.id && fresh.data?.noActionAsked) {
      updateSessionData({ noActionAsked: false, phaseLabel: 'Assessment done — no verdict returned. Read Latest, then Approve, ask again, or No Action.' });
      appendLog(cur.id, 'assessment run finished without a VERDICT line');
      await renderActive(client, getActiveSession(), true);
      return;
    }
    const d = getActiveSession()?.data || {};
    const hasContent = !!(d.planItems?.length || d.questions?.length);
    try { transitionTo(S.AWAITING_ANSWERS, {}); } catch { /* stay */ }
    updateSessionData({ planRevised: hasContent, answered: hasContent ? !!d.answered : true });
    await renderActive(client, getActiveSession(), true);
    return;
  }
  if ([S.READY, S.WORKING].includes(cur.state)) {
    await runTestsAndDeploy(client, cur.id);
  }
}

// ── Phase 2 completion: tests → tag → commit → push ──
export async function runTestsAndDeploy(client, sid) {
  const { STATES: S } = await import('./constants.js');
  let rec = getActiveSession();
  if (!rec || rec.id !== sid) return;
  try { transitionTo(S.TESTING, {}); } catch { /* ignore */ }
  updateSessionData({ phaseLabel: 'Testing', progress: [...(rec.data?.progress || []), 'Running tests/lint…'] });
  await renderActive(client, getActiveSession(), true);
  await note(client, getActiveSession() || rec, 'Running tests…');

  const dir = repoDir();
  appendLog(sid, `running tests in ${dir}`);
  const tests = await runCmd('npm', ['test'], dir);
  appendLog(sid, `npm test ok=${tests.ok} code=${tests.code}\n${tests.stdout.slice(0, 3000)}\n${tests.stderr.slice(0, 2000)}`);
  if (!tests.ok) {
    await failActive(client, sid, 'Failed: tests', `Tests failed — aborting, nothing pushed.\n${tests.stderr.slice(0, 500) || tests.stdout.slice(0, 500)}`, 'TESTING');
    return;
  }
  rec = getActiveSession();
  try { transitionTo(S.DEPLOYING, {}); } catch { /* ignore */ }
  updateSessionData({ checks: ['Tests passed'] });
  await renderActive(client, getActiveSession(), true);

  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const tag = `pre-feedback-${stamp}`;
  const branch = await runCmd('git', ['rev-parse', '--abbrev-ref', 'HEAD'], dir);
  if (branch.stdout.trim() !== deployBranch()) {
    await failActive(client, sid, 'Failed: wrong branch', `Repo is on "${branch.stdout.trim()}", not ${deployBranch()}. Refusing to tag/push.`, 'DEPLOYING');
    return;
  }
  const tagRes = await runCmd('git', ['tag', tag], dir);
  if (!tagRes.ok) {
    await failActive(client, sid, 'Failed: tag', tagRes.stderr || 'git tag failed', 'DEPLOYING');
    return;
  }
  updateSession({ preDeployTag: tag });
  appendLog(sid, `tagged ${tag}`);

  const files = await collectChangedFiles(dir);
  updateSessionData({ filesChanged: files });

  const add = await runCmd('git', ['add', '-A'], dir);
  if (!add.ok) {
    await failActive(client, sid, 'Failed: git add', add.stderr, 'DEPLOYING');
    return;
  }
  const summary = (getActiveSession()?.data?.oneLineResult || getActiveSession()?.data?.requestSummary || 'feedback fix').slice(0, 120);
  const commit = await runCmd('git', ['commit', '-m', `feedback: ${summary} [${tag}]`], dir);
  if (!commit.ok && !/nothing to commit/i.test(commit.stdout + commit.stderr)) {
    await failActive(client, sid, 'Failed: commit', commit.stderr || commit.stdout, 'DEPLOYING');
    return;
  }
  appendLog(sid, `commit: ${(commit.stdout + commit.stderr).slice(0, 1000)}`);
  const push = await runCmd('git', ['push', 'origin', deployBranch()], dir);
  appendLog(sid, `push ${deployBranch()} ok=${push.ok} ${(push.stdout + push.stderr).slice(0, 1000)}`);
  if (!push.ok) {
    await failActive(client, sid, 'Failed: push', push.stderr || 'git push failed', 'DEPLOYING');
    return;
  }
  await runCmd('git', ['push', 'origin', tag], dir);

  updateSessionData({
    checks: ['Tests passed', `Tagged ${tag}`, `Pushed to ${deployBranch()} · deploy succeeded`],
    summary: getActiveSession()?.data?.planDraft?.slice(0, 500) || getActiveSession()?.data?.requestSummary || '',
  });
  try { transitionTo(S.DONE, {}); } catch { updateSession({ state: S.DONE }); }
  await renderActive(client, getActiveSession(), true);
  appendLog(sid, `DONE — deployed to ${deployBranch()}`);
  const doneRec = getActiveSession();
  if (doneRec) await note(client, doneRec, `Deployed to ${deployBranch()}: ${(doneRec.data?.oneLineResult || doneRec.data?.requestSummary || 'done').slice(0, 200)}`);
}

async function collectChangedFiles(dir) {
  const numstat = await runCmd('git', ['diff', '--numstat', 'HEAD~1', 'HEAD'], dir).catch(() => ({ stdout: '' }));
  void numstat;
  const out = [];
  try {
    const res = await runCmd('git', ['diff', '--numstat', 'HEAD~1', 'HEAD'], dir);
    for (const line of res.stdout.split('\n')) {
      const m = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
      if (!m) continue;
      const path = m[3];
      let size = '';
      try {
        const full = `${dir}/${path}`;
        if (existsSync(full) && statSync(full).isFile()) {
          const bytes = statSync(full).size;
          size = bytes > 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
        }
      } catch { /* ignore */ }
      out.push({ path, size, added: Number(m[1]), removed: Number(m[2]) });
      if (out.length >= 20) break;
    }
  } catch { /* ignore */ }
  return out;
}

// Missed live events (restart, or prompt sent before the stream attached):
// recover the latest assistant text directly and parse plan/questions.
async function backfillPlanFromMessages(client, sid) {
  const rec = getActiveSession();
  if (!rec || rec.id !== sid || !rec.opencodeSessionId) return;
  if (rec.state !== STATES.REVIEWING && rec.state !== STATES.AWAITING_ANSWERS) return;
  const { listMessages } = await import('./opencode.js');
  const msgs = await listMessages(rec.opencodeSessionId).catch(() => null);
  if (!msgs) return;
  const texts = assistantTexts(msgs);
  const draft = texts.join('\n').slice(-6000);
  if (!draft.trim()) return;
  const { plan, questions } = parsePlanSections(draft);
  const patch = { planDraft: draft };
  if (plan.length) patch.planItems = plan;
  if (questions.length) patch.questions = questions;
  if (plan.length || questions.length) patch.planRevised = true;
  updateSessionData(patch);
  if ((plan.length || questions.length) && getActiveSession()?.state === STATES.REVIEWING) {
    try { transitionTo(STATES.AWAITING_ANSWERS, {}); } catch { /* stay */ }
  }
  appendLog(sid, `backfilled plan from ${texts.length} assistant message(s)`);
  await renderActive(client, getActiveSession(), true);
}

function assistantTexts(messages) {
  const out = [];
  for (const m of messages || []) {
    const role = m?.info?.role || m?.role;
    if (role !== 'assistant') continue;
    const text = (m?.parts || []).filter((p) => p?.type === 'text' && p.text).map((p) => p.text).join('\n').trim();
    if (text) out.push(text);
  }
  return out;
}

// ── Startup restore ──
export async function restoreActiveSession(client) {
  const rec = getActiveSession();
  if (!rec) return null;
  appendLog(rec.id, `restore after restart (state ${rec.state})`);
  const { checkHealth, listMessages } = await import('./opencode.js');
  const health = await checkHealth().catch(() => ({ ok: false }));
  if (!health.ok) {
    appendLog(rec.id, 'restore: OpenCode unreachable — session kept, stream detached');
    return rec;
  }
  if (rec.opencodeSessionId) {
    const msgs = await listMessages(rec.opencodeSessionId).catch(() => null);
    if (msgs === null) appendLog(rec.id, 'restore: could not reattach to OpenCode session (kept for manual resume)');
    else {
      appendLog(rec.id, `restore: reattached (${Array.isArray(msgs) ? msgs.length : '?'} messages)`);
      // Missed live events while down — recover the latest plan text directly.
      await backfillPlanFromMessages(client, rec.id);
      // Baseline the chat watermark from history so the next flush posts
      // only genuinely new prose instead of reposting the backlog.
      const full = assistantTexts(msgs).join('\n\n').slice(-8000);
      if (full && full !== getActiveSession()?.data?.chatBaseline) updateSessionData({ chatBaseline: full });
    }
  }
  await attachEventStream(client, rec.id).catch((e) => appendLog(rec.id, `restore: stream failed: ${e.message}`));
  startLiveTextTicker(client);
  await renderActive(client, rec, true);
  return rec;
}

export { parsePlanSections };
