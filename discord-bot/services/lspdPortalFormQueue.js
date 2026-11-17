/**
 * lspdPortalFormQueue.js — Dedicated queue for LSPD portal liaison FORM
 * submissions (coroner-report + medical-examiner + mass-fatality), mirroring
 * the coroner-email-queue.js entity lifecycle exactly:
 *
 * Entity: lspd-portal-form-queue/<form>|<authorId>|<reportKey>
 *   { form, authorId, reportKey, recipient, context,
 *     status, attempts, retryAt, lastError,
 *     formUrl, sentAt, createdAt, updatedAt }
 * Status: queued → sending → sent | retry_queued. Dry-run verifies hold as
 * retry_queued (never terminal) until a live submit lands. Retries never expire (backoff 30m/2h/6h, capped at
 * the last step). Stuck `sending` (>30m, e.g. crash mid-send) resets to
 * queued on sweep. Sent entities prune after 7 days.
 *
 * Delivery goes through lspdPortalForms.js (dry-run default: fill + verify,
 * never submit). Anything the payload builder rejects (unmapped manner,
 * missing approver, dead link) lands in retry_queued LOUDLY with an
 * ABORT-prefixed lastError — the send is aborted, never defaulted, and the
 * sweep keeps it visible instead of silently dropping it.
 */

import { registerTick, unregisterTick } from './scheduler.js';
import { appendDrdbSend } from './drdbAudit.js';

export const FORM_QUEUE_NODE = 'lspd-portal-form-queue';
const BACKOFF_MS = [30 * 60 * 1000, 2 * 60 * 60 * 1000, 6 * 60 * 60 * 1000];
const STUCK_MS = 30 * 60 * 1000;
const PRUNE_SENT_MS = 7 * 24 * 60 * 60 * 1000;
const SWEEP_MS = 10 * 60 * 1000;

let _db = null;
const _inFlight = new Set();

export function formKey(form, authorId, reportKey, idx = 0) {
  // Per-recipient entities carry a numeric suffix; idx 0 keeps the legacy
  // key so in-flight single-recipient entities are untouched.
  return idx > 0 ? `${form}|${authorId}|${reportKey}|${idx}` : `${form}|${authorId}|${reportKey}`;
}

/**
 * Enqueue a portal form submission. Idempotent: an existing non-terminal
 * entity is left alone; terminal (sent/dry_run) entities are never requeued.
 * Validates buildability NOW (fail-closed at enqueue) but the worker
 * rebuilds from the live record at delivery time.
 * @returns {Promise<string|null>} entity key, or null when skipped/refused
 */
export async function enqueuePortalForm(db, {
  form, authorId, reportKey, recipient, data = {}, context = {}, idx = 0,
}) {
  if (form !== 'coroner-report' && form !== 'medical-examiner' && form !== 'mass-fatality') {
    console.warn(`[FORMS-QUEUE] Refusing to enqueue — unknown form "${form}"`);
    return null;
  }
  if (!authorId || !reportKey || !recipient) {
    console.warn('[FORMS-QUEUE] Refusing to enqueue — missing author/report/recipient');
    return null;
  }
  const { buildCoronerFormPayload, buildMedicalExaminerPayload, buildMassFatalityPayload } = await import('./lspdPortalForms.js');
  const built = form === 'coroner-report'
    ? buildCoronerFormPayload(data)
    : form === 'mass-fatality'
      ? buildMassFatalityPayload(data)
      : buildMedicalExaminerPayload(data, context);
  if (!built.ok) {
    console.error(`[FORMS-QUEUE] Refusing to enqueue ${form} ${authorId}|${reportKey} — ${(built.errors || []).join(' | ').slice(0, 300)}`);
    return null;
  }
  const key = formKey(form, authorId, reportKey, idx);
  try {
    const existing = (await db.ref(`${FORM_QUEUE_NODE}/${key}`).once('value')).val();
    if (existing && !['failed'].includes(existing.status)) {
      console.log(`[FORMS-QUEUE] ${key} already ${existing.status} — leaving alone`);
      return key;
    }
    const now = new Date().toISOString();
    await db.ref(`${FORM_QUEUE_NODE}/${key}`).set({
      form, authorId, reportKey,
      recipient, context,
      status: 'queued', attempts: 0,
      retryAt: null, lastError: null, formUrl: null, sentAt: null,
      createdAt: existing?.createdAt || now, updatedAt: now,
    });
    console.log(`[FORMS-QUEUE] Enqueued ${key} → ${recipient} (${form})`);
    // Kick the worker inline so delivery starts now, not on the next sweep.
    processFormQueue().catch(() => {});
    return key;
  } catch (err) {
    console.error(`[FORMS-QUEUE] Enqueue failed for ${key}: ${err.message}`);
    return null;
  }
}

/** Read a single entity (null when missing). */
async function getEntity(key) {
  try {
    const snap = await _db.ref(`${FORM_QUEUE_NODE}/${key}`).once('value');
    return snap.exists() ? snap.val() : null;
  } catch {
    return null;
  }
}

/**
 * Process every due entity, strictly one at a time (form fills are slow and
 * share the browser — no parallelism). Due = queued, retry_queued past
 * retryAt, or stuck sending. Skips entities already terminal or in flight.
 */
export async function processFormQueue() {
  if (!_db) return;
  let snap;
  try {
    snap = await _db.ref(FORM_QUEUE_NODE).once('value');
  } catch (err) {
    console.warn(`[FORMS-QUEUE] Queue read failed: ${err.message}`);
    return;
  }
  if (!snap?.exists()) return;
  const now = Date.now();
  const due = [];
  snap.forEach((child) => {
    const e = child.val() || {};
    if (_inFlight.has(child.key)) return;
    if (e.status === 'queued') { due.push([child.key, e]); return; }
    if (e.status === 'retry_queued' && e.retryAt && now >= new Date(e.retryAt).getTime()) due.push([child.key, e]);
    if (e.status === 'sending' && e.updatedAt && now - new Date(e.updatedAt).getTime() > STUCK_MS) due.push([child.key, e]);
  });
  for (const [key, entity] of due) {
    _inFlight.add(key);
    try {
      await processOneForm(key, entity);
    } catch (err) {
      console.error(`[FORMS-QUEUE] ${key} processor error: ${err.message}`);
    } finally {
      _inFlight.delete(key);
    }
  }
  // Prune old terminal entities so the node stays small (sent after 7 days;
  // dry_run is kept as an audit trail).
  try {
    const updates = {};
    snap.forEach((child) => {
      const e = child.val() || {};
      if (e.status === 'sent' && e.sentAt && now - new Date(e.sentAt).getTime() > PRUNE_SENT_MS) updates[`${FORM_QUEUE_NODE}/${child.key}`] = null;
    });
    if (Object.keys(updates).length > 0) {
      await _db.ref().update(updates);
      console.log(`[FORMS-QUEUE] Pruned ${Object.keys(updates).length} old sent entities`);
    }
  } catch { /* best effort */ }
}

async function processOneForm(key, _entity) {
  // Re-read + claim under the in-flight guard (single process).
  const fresh = await getEntity(key);
  if (!fresh || _inFlight.has(`${key}:claimed`)) return;
  if (!['queued', 'retry_queued', 'sending'].includes(fresh.status)) return;
  if (fresh.status === 'retry_queued' && fresh.retryAt && Date.now() < new Date(fresh.retryAt).getTime()) return;

  await _db.ref(`${FORM_QUEUE_NODE}/${key}`).update({ status: 'sending', updatedAt: new Date().toISOString() });
  console.log(`[FORMS-QUEUE] Delivering ${key} → ${fresh.recipient} (${fresh.form}), attempt ${(fresh.attempts || 0) + 1}`);

  // Progress embed with before/after snapshots (separate image messages —
  // edits drop attachments, so snapshots never ride the embed itself).
  const { DeployProgressEmbed } = await import('./deployLogger.js');
  const { state } = await import('./deployState.js');
  const progress = new DeployProgressEmbed(state.discordClient, process.env.BOT_LOG_CHANNEL_ID);
  await progress.start(`Portal Form — ${fresh.form} → ${fresh.recipient}`);
  await progress.addStep('Delivery', 'pending');

  let result;
  try {
    // Rebuild from the live record (data may have been fixed since enqueue).
    const snap = await _db.ref(`scheduledReports/${fresh.authorId}/${fresh.reportKey}`).once('value');
    const report = snap.exists() ? snap.val() : null;
    if (!report?.data) {
      result = { ok: false, reason: 'Report record missing at delivery — refusing to file from stale data' };
    } else {
      const forms = await import('./lspdPortalForms.js');
      // LIVE submits (Nov 2026: filings enabled by operator). The driver
      // still refuses unless LSPD_PORTAL_ENABLED + LSPD_FORMS_DRY_RUN=false.
      // Multi-recipient: the entity owns its leg's addressee — stamp it onto
      // the rebuilt payload so the "Requesting officer" text field names the
      // officer this filing is actually for, not the report's primary.
      const legData = { ...report.data, requestingOfficer: fresh.recipient || report.data.requestingOfficer };
      const deliver = fresh.form === 'coroner-report'
        ? forms.deliverCoronerReportForm({ recipient: fresh.recipient, data: legData, submit: true })
        : fresh.form === 'mass-fatality'
          ? forms.deliverMassFatalityForm({ recipient: fresh.recipient, data: legData, submit: true })
          : forms.deliverMedicalExaminerForm({
            recipient: fresh.recipient, data: report.data,
            context: { ...(fresh.context || {}), meName: (fresh.context || {}).meName || report.data?.coronerEmployee || '', approvedBy: (fresh.context || {}).approvedBy || forms.ME_APPROVED_BY },
            submit: true,
          });
      result = await deliver;
      if (result.ok && Array.isArray(result.warnings)) {
        for (const w of result.warnings) console.warn(`[FORMS-QUEUE] ${key} warning: ${w}`);
      }
    }
  } catch (err) {
    result = { ok: false, reason: err.message };
  }

  const attempts = (fresh.attempts || 0) + 1;
  if (result.ok && result.dryRun) {
    // Hold-pending semantics (Nov 2026): a dry-run verify is NOT a filing.
    // Requeue on the normal backoff instead of going terminal — the entity
    // keeps retrying until a live submit lands.
    await progress.addStep('Delivery', 'warn', 'Dry run verified — NOT submitted, holding for live submit');
    await progress.snapshot(`Before submit (dry run, not submitted) — ${fresh.form} → ${fresh.recipient}`, result.beforeScreenshot);
    await progress.finalize('failed');
    const retryAt = new Date(Date.now() + (BACKOFF_MS[attempts - 1] || BACKOFF_MS[BACKOFF_MS.length - 1])).toISOString();
    await _db.ref(`${FORM_QUEUE_NODE}/${key}`).update({
      status: 'retry_queued', attempts, retryAt,
      lastError: 'Dry-run verify only — holding for live submit',
      updatedAt: new Date().toISOString(),
    });
    console.log(`[FORMS-QUEUE] ${key} DRY RUN — holding for live submit, retry at ${retryAt}`);
  } else if (result.ok) {
    await progress.addStep('Delivery', 'ok', result.formUrl || result.threadId || 'sent');
    await progress.snapshot(`Before submit — ${fresh.form} → ${fresh.recipient}`, result.beforeScreenshot);
    await progress.snapshot(`After submit — ${fresh.form} → ${fresh.recipient}`, result.screenshot);
    await progress.finalize('complete');
    await _db.ref(`${FORM_QUEUE_NODE}/${key}`).update({
      status: 'sent', attempts, formUrl: result.formUrl || null,
      sentAt: new Date().toISOString(),
      lastError: null, updatedAt: new Date().toISOString(),
    });
    // Mirror onto the report record (existing dashboard/audit UX reads it).
    try {
      await _db.ref(`scheduledReports/${fresh.authorId}/${fresh.reportKey}`).update({
        [`lspdFormUrl_${fresh.form}`]: result.formUrl || null,
        [`lspdFormSentAt_${fresh.form}`]: new Date().toISOString(),
      });
    } catch { /* best effort */ }
    // drdb-sent audit: this IS the automatic LSPD send (consent-gated deploy
    // path), so record it. The flag itself is derived from this log at read
    // time — no report mutation, pre-DRDB reports keep reading false.
    try {
      const sentSnap = await _db.ref(`scheduledReports/${fresh.authorId}/${fresh.reportKey}/originalKey`).once('value');
      appendDrdbSend({
        author: fresh.authorId, key: fresh.reportKey,
        title: sentSnap.exists() ? sentSnap.val() : fresh.reportKey,
        agency: 'lspd', recipient: fresh.recipient,
        formUrl: result.formUrl || null, reference: result.reference || null,
      });
    } catch { /* best effort — the send already landed */ }
    console.log(`[FORMS-QUEUE] ${key} SENT → ${fresh.recipient}${result.formUrl ? ` (${result.formUrl})` : ''}`);
  } else {
    // No exhaustion: failures retry forever on the backoff schedule.
    // Builder ABORTs (unmapped manner etc.) are prefixed so the sweep log
    // shows the send was refused, not merely failed.
    const why = result.aborted ? `ABORT: ${result.reason}` : String(result.reason || 'Unknown');
    await progress.addStep('Delivery', 'fail', why.slice(0, 200));
    await progress.snapshot(`Failed state (filled, not submitted) — ${fresh.form} → ${fresh.recipient}`, result.beforeScreenshot);
    await progress.finalize('failed');
    const retryAt = new Date(Date.now() + (BACKOFF_MS[attempts - 1] || BACKOFF_MS[BACKOFF_MS.length - 1])).toISOString();
    await _db.ref(`${FORM_QUEUE_NODE}/${key}`).update({
      status: 'retry_queued', attempts, retryAt,
      lastError: why.slice(0, 300),
      updatedAt: new Date().toISOString(),
    });
    console.log(`[FORMS-QUEUE] ${key} failed (attempt ${attempts}) — retry at ${retryAt}: ${why.slice(0, 200)}`);
  }
}

/** Start the worker: immediate sweep, then every 10 min. No portal traffic at boot. */
export function startPortalFormWorker(db) {
  _db = db;
  console.log('[FORMS-QUEUE] Worker started (sweep every 10 min)');
  processFormQueue().catch(() => {});
  unregisterTick('portal-form-sweep');
  registerTick('portal-form-sweep', { intervalMs: SWEEP_MS, fn: () => processFormQueue().catch(() => {}) });
}

/** Stop the worker (cleanup on shutdown). */
export function stopPortalFormWorker() {
  unregisterTick('portal-form-sweep');
}
