/**
 * coronerEmailQueue.js — Dedicated queue for coroner-email PM deliveries.
 *
 * Previously the email was a side-effect stapled to the topic deploy sharing
 * one status: when the topic posted but the PM failed, the report read
 * "deployed" and the email was stranded with no record and no retry.
 * Now each email is its own entity with its own lifecycle, attempts and
 * backoff — the topic deploy never touches email state again.
 *
 * Entity: coroner-email-queue/<authorId>|<reportKey>
 *   { authorId, reportKey, topicId, topicUrl, recipient, forumLabel,
 *     subject, bbCode, status, attempts, maxAttempts, retryAt, lastError,
 *     pmUrl, sentAt, createdAt, updatedAt }
 * Status: queued → sending → sent | retry_queued | failed (+ dry_run terminal
 * for dry-run passes). Stuck `sending` (>30m, e.g. crash mid-send) resets to
 * queued on sweep. Sent entities prune after 7 days.
 */

import { logFnCall } from './deployLogger.js';

export const EMAIL_NODE = 'coroner-email-queue';
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [30 * 60 * 1000, 2 * 60 * 60 * 1000, 6 * 60 * 60 * 1000];
const STUCK_MS = 30 * 60 * 1000;
const PRUNE_SENT_MS = 7 * 24 * 60 * 60 * 1000;
const SWEEP_MS = 10 * 60 * 1000;

let _db = null;
let _sweepTimer = null;
const _inFlight = new Set();

export function emailKey(authorId, reportKey) {
    return `${authorId}|${reportKey}`;
}

/**
 * Enqueue an email delivery. Idempotent: an existing non-terminal entity is
 * left alone; terminal (sent/failed/dry_run) entities are never requeued.
 * @returns {Promise<string|null>} entity key, or null when skipped
 */
export async function enqueueCoronerEmail(db, {
    authorId, reportKey, topicId = null, topicUrl = null,
    recipient, department = '', forumLabel, subject, bbCode,
}) {
    if (!authorId || !reportKey || !recipient || !bbCode) {
        console.warn('[CORONER-QUEUE] Refusing to enqueue — missing author/report/recipient/bbCode');
        return null;
    }
    const key = emailKey(authorId, reportKey);
    try {
        const existing = (await db.ref(`${EMAIL_NODE}/${key}`).once('value')).val();
        if (existing && !['failed'].includes(existing.status)) {
            console.log(`[CORONER-QUEUE] ${key} already ${existing.status} — leaving alone`);
            return key;
        }
        const now = new Date().toISOString();
        await db.ref(`${EMAIL_NODE}/${key}`).set({
            authorId, reportKey, topicId, topicUrl,
            recipient, department, forumLabel, subject, bbCode,
            status: 'queued', attempts: 0, maxAttempts: MAX_ATTEMPTS,
            retryAt: null, lastError: null, pmUrl: null, sentAt: null,
            createdAt: existing?.createdAt || now, updatedAt: now,
        });
        console.log(`[CORONER-QUEUE] Enqueued ${key} → ${recipient} (${forumLabel})`);
        // Kick the worker inline so delivery starts now, not on the next sweep.
        processEmailQueue().catch(() => {});
        return key;
    } catch (err) {
        console.error(`[CORONER-QUEUE] Enqueue failed for ${key}: ${err.message}`);
        return null;
    }
}

/** Read a single entity (null when missing). */
async function getEntity(key) {
    try {
        const snap = await _db.ref(`${EMAIL_NODE}/${key}`).once('value');
        return snap.exists() ? snap.val() : null;
    } catch {
        return null;
    }
}

/**
 * Process every due entity, strictly one at a time (PM sends are slow and
 * share the browser — no parallelism). Due = queued, retry_queued past
 * retryAt, or stuck sending. Skips entities already terminal or in flight.
 */
export async function processEmailQueue() {
    if (!_db) return;
    let snap;
    try {
        snap = await _db.ref(EMAIL_NODE).once('value');
    } catch (err) {
        console.warn(`[CORONER-QUEUE] Queue read failed: ${err.message}`);
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
            await processOneEmail(key, entity);
        } catch (err) {
            console.error(`[CORONER-QUEUE] ${key} processor error: ${err.message}`);
        } finally {
            _inFlight.delete(key);
        }
    }
    // Prune old sent entities so the node stays small.
    try {
        const updates = {};
        snap.forEach((child) => {
            const e = child.val() || {};
            if (e.status === 'sent' && e.sentAt && now - new Date(e.sentAt).getTime() > PRUNE_SENT_MS) updates[`${EMAIL_NODE}/${child.key}`] = null;
        });
        if (Object.keys(updates).length > 0) {
            await _db.ref().update(updates);
            console.log(`[CORONER-QUEUE] Pruned ${Object.keys(updates).length} old sent entities`);
        }
    } catch { /* best effort */ }
}

async function processOneEmail(key, entity) {
    // Re-read + claim under the in-flight guard (single process).
    const fresh = await getEntity(key);
    if (!fresh || _inFlight.has(key + ':claimed')) return;
    if (!['queued', 'retry_queued', 'sending'].includes(fresh.status)) return;
    if (fresh.status === 'retry_queued' && fresh.retryAt && Date.now() < new Date(fresh.retryAt).getTime()) return;

    await _db.ref(`${EMAIL_NODE}/${key}`).update({ status: 'sending', updatedAt: new Date().toISOString() });
    console.log(`[CORONER-QUEUE] Delivering ${key} → ${fresh.recipient} (${fresh.forumLabel}), attempt ${(fresh.attempts || 0) + 1}/${fresh.maxAttempts || MAX_ATTEMPTS}`);

    let result;
    try {
        const { deliverCoronerEmail } = await import('./deployCoronerEmail.js');
        result = await deliverCoronerEmail({
            recipient: fresh.recipient,
            subject: fresh.subject,
            bbCode: fresh.bbCode,
            department: fresh.department || fresh.forumLabel,
            forumLabel: fresh.forumLabel,
            progressTitle: `Coroner Email — ${fresh.subject || key}`,
        });
    } catch (err) {
        result = { ok: false, reason: err.message };
    }

    const attempts = (fresh.attempts || 0) + 1;
    const maxAttempts = fresh.maxAttempts || MAX_ATTEMPTS;
    if (result.ok) {
        await _db.ref(`${EMAIL_NODE}/${key}`).update({
            status: 'sent', attempts, pmUrl: result.url || null,
            sentTo: result.sentTo || fresh.recipient, sentAt: new Date().toISOString(),
            lastError: null, updatedAt: new Date().toISOString(),
        });
        // Mirror onto the report record (existing dashboard/audit UX reads it).
        try {
            await _db.ref(`scheduledReports/${fresh.authorId}/${fresh.reportKey}`).update({
                coronerEmailUrl: result.url || null,
                coronerEmailSentAt: new Date().toISOString(),
                coronerEmailTo: result.sentTo || fresh.recipient,
            });
        } catch { /* best effort */ }
        console.log(`[CORONER-QUEUE] ${key} SENT → ${result.sentTo || fresh.recipient}${result.url ? ` (${result.url})` : ''}`);
    } else if (attempts >= maxAttempts) {
        await _db.ref(`${EMAIL_NODE}/${key}`).update({
            status: 'failed', attempts, lastError: String(result.reason || 'Unknown').slice(0, 300),
            updatedAt: new Date().toISOString(),
        });
        console.error(`[CORONER-QUEUE] ${key} FAILED permanently after ${attempts} attempts: ${result.reason}`);
    } else {
        const retryAt = new Date(Date.now() + (BACKOFF_MS[attempts - 1] || BACKOFF_MS[BACKOFF_MS.length - 1])).toISOString();
        await _db.ref(`${EMAIL_NODE}/${key}`).update({
            status: 'retry_queued', attempts, retryAt,
            lastError: String(result.reason || 'Unknown').slice(0, 300),
            updatedAt: new Date().toISOString(),
        });
        console.log(`[CORONER-QUEUE] ${key} failed (attempt ${attempts}/${maxAttempts}) — retry at ${retryAt}: ${result.reason}`);
    }
}

/** Start the worker: immediate sweep, then every 10 min. No forum at boot. */
export function startCoronerEmailWorker(db) {
    _db = db;
    console.log('[CORONER-QUEUE] Worker started (sweep every 10 min)');
    processEmailQueue().catch(() => {});
    if (_sweepTimer) clearInterval(_sweepTimer);
    _sweepTimer = setInterval(() => processEmailQueue().catch(() => {}), SWEEP_MS);
}
