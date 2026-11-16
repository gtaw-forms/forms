// forwardDrdb.js — pure helpers for the migration-ui "Send to DRDB" forward.
//
// An LSPD viewer of a shared (LEO) report can file it to one named officer.
// The client writes a queue leg that the bot's `lspdPortalFormQueue` worker
// picks up exactly like an automatic leg: payload rebuilt from the live
// record at delivery, exact-single-recipient match or ABORT, retries forever,
// audit line on send (which flips `drdb-sent`). No roster lookup exists
// (LSPD forums retired), so the requester verifies the spelling — the modal
// says so, and delivery refuses to guess.
//
// Key rule: forward legs ALWAYS carry idx >= 1. idx 0 (bare key) belongs to
// the automatic primary leg — occupying it would make a later automatic
// enqueue for the same report no-op ("already queued").
export const FORWARD_QUEUE_NODE = 'lspd-portal-form-queue';
export const FORWARD_FORM = 'coroner-report';
export const FORWARD_SOURCE = 'migration-ui-forward';
export const MAX_OFFICER_NAME_LENGTH = 120;

/** Non-empty, trimmed officer name (≤120 chars), or an error string. */
export function validateForwardName(raw) {
  const name = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!name) return { ok: false, error: 'Enter the officer\u2019s character name.' };
  if (name.length > MAX_OFFICER_NAME_LENGTH) {
    return { ok: false, error: `That name is ${name.length} characters — keep it under ${MAX_OFFICER_NAME_LENGTH}.` };
  }
  return { ok: true, name };
}

/** Queue entity key. idx 0 is the bare legacy key (never used for forwards). */
export function forwardEntityKey(form, authorId, reportKey, idx = 0) {
  const base = `${form}|${authorId}|${reportKey}`;
  return idx > 0 ? `${base}|${idx}` : base;
}

/**
 * Next free forward idx for this report: max existing suffix + 1, minimum 1
 * (idx 0 stays reserved for the automatic leg). Non-numeric suffixes and
 * other reports' keys are ignored.
 */
export function nextForwardIdx(existingKeys, form, authorId, reportKey) {
  const prefix = `${form}|${authorId}|${reportKey}`;
  let max = 0;
  for (const key of existingKeys || []) {
    if (key === prefix) { max = Math.max(max, 0); continue; }
    if (!key.startsWith(`${prefix}|`)) continue;
    const n = Number(key.slice(prefix.length + 1));
    if (Number.isInteger(n) && n >= 0) max = Math.max(max, n);
  }
  return Math.max(1, max + 1);
}

/** Queue entity the bot worker consumes (mirrors `enqueuePortalForm`). */
export function buildForwardEntity({ form, authorId, reportKey, recipient, forwardedBy, idx, nowIso }) {
  const now = nowIso || new Date().toISOString();
  return {
    form,
    authorId,
    reportKey,
    recipient,
    context: {
      forwardedBy: forwardedBy || 'Unknown',
      forwardedAt: now,
      source: FORWARD_SOURCE,
    },
    status: 'queued',
    attempts: 0,
    retryAt: null,
    lastError: null,
    formUrl: null,
    sentAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * A still-pending leg for the same report + officer (case-insensitive):
 * forwarding twice must surface "already queued", never file twice.
 */
export function findExistingLeg(entities, { form, authorId, reportKey, recipient }) {
  const want = String(recipient || '').trim().toLowerCase();
  if (!want) return null;
  const prefix = `${form}|${authorId}|${reportKey}`;
  for (const [key, e] of Object.entries(entities || {})) {
    if (key !== prefix && !key.startsWith(`${prefix}|`)) continue;
    if (!['queued', 'retry_queued', 'sending'].includes(e?.status)) continue;
    if (String(e?.recipient || '').trim().toLowerCase() === want) return key;
  }
  return null;
}
