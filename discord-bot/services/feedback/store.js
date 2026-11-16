// feedback/store.js — single-session persistence + state machine guard.
// Persisted to data/bot-state/feedback.json (data/ is excluded from bot:deploy,
// so the session survives deploys). Reattach to the live OpenCode session on
// startup via the stored opencodeSessionId.
import { readState, writeState } from '../vpsState.js';
import { STATES, ALLOWED_TRANSITIONS } from './constants.js';

const STORE_KEY = 'feedback/session';
const HISTORY_KEY = 'feedback/history';
const HISTORY_MAX = 20;

function blankStore() {
  return { active: null };
}

export function loadStore() {
  const raw = readState(STORE_KEY, null);
  if (!raw || typeof raw !== 'object') return blankStore();
  if (!raw.active) return { active: null };
  return raw;
}

function saveStore(store) {
  writeState(STORE_KEY, store);
}

export function getActiveSession() {
  const store = loadStore();
  return store.active;
}

export function hasActiveSession() {
  return !!getActiveSession();
}

export function createSessionRecord(fields) {
  const now = new Date().toISOString();
  const store = loadStore();
  const record = {
    id: fields.id,
    ownerId: fields.ownerId,
    channelId: fields.channelId || null, // owner DM channel
    messageId: fields.messageId || null, // the ONE bot message edited in place
    opencodeSessionId: fields.opencodeSessionId || null,
    state: STATES.REVIEWING,
    pausedFrom: null,
    preDeployTag: null,
    createdAt: now,
    updatedAt: now,
    // Render data (kept small; the full log lives in log.js, not here).
    data: fields.data || {},
  };
  store.active = record;
  saveStore(store);
  return record;
}

export function updateSession(patch) {
  const store = loadStore();
  if (!store.active) return null;
  store.active = {
    ...store.active,
    ...patch,
    data: patch.data !== undefined ? patch.data : store.active.data,
    updatedAt: new Date().toISOString(),
  };
  saveStore(store);
  return store.active;
}

export function updateSessionData(patch) {
  const store = loadStore();
  if (!store.active) return null;
  store.active.data = { ...(store.active.data || {}), ...patch };
  store.active.updatedAt = new Date().toISOString();
  saveStore(store);
  return store.active;
}

export function canTransition(from, to) {
  if (!from || !to) return false;
  if (from === to) return true;
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function transitionTo(to, patch = {}) {
  const store = loadStore();
  if (!store.active) throw new Error('No active feedback session.');
  const from = store.active.state;
  if (!canTransition(from, to)) {
    throw new Error(`Illegal feedback transition ${from} -> ${to}.`);
  }
  const next = { ...patch };
  if (to === STATES.PAUSED) next.pausedFrom = from;
  return updateSession({ ...next, state: to });
}

export function clearSession() {
  const store = loadStore();
  store.active = null;
  saveStore(store);
}

export function archiveSession() {
  // COMPLETED keeps the record briefly for the final summary, then frees the
  // single-session slot. Callers should transitionTo(COMPLETED) first for the
  // DONE -> COMPLETED render, then call this to free the slot.
  clearSession();
}

/** Past sessions, newest first (capped). Powers /feedback-list. */
export function getHistory() {
  const raw = readState(HISTORY_KEY, null);
  return Array.isArray(raw) ? raw : [];
}

/** Append one terminal record: {id, shortId, outcome, summary, detail?, preDeployTag?}. */
export function appendHistory(entry) {
  const list = getHistory();
  list.unshift({ ...entry, endedAt: new Date().toISOString() });
  writeState(HISTORY_KEY, list.slice(0, HISTORY_MAX));
}

/** Guard so a session that fails twice only records history once. */
export function markHistoryRecorded() {
  updateSessionData({ historyRecorded: true });
}
