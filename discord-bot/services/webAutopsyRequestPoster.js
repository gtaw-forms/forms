/**
 * Web Autopsy Request Poster — takes web "Request Autopsy" submissions
 * (autopsy-requests/pending, written by the web app's RequestAutopsyModal) and
 * posts them as request topics to PHMC f=265, so the standard autopsy monitor
 * picks them up (case creation + ME assignment, incl. DEV TEST mode).
 *
 * Safety: gated behind AUTOPSY_REQUEST_AUTO_POST=true (off by default). When
 * off, pending entries simply stay queued. Toggleable live via the owner
 * command /web-autopsy-autopost (persists to .env, survives restarts).
 *
 * Env:
 *   AUTOPSY_REQUEST_AUTO_POST=true|false   — master switch (default false)
 *   AUTOPSY_REQUEST_WEBHOOK_URL            — Discord webhook for submit/post
 *                                           notifications (dev-routed while DEV
 *                                           TEST mode is active)
 *
 * RTDB optimization: real-time `child_added` / `child_changed` listeners, NOT a
 * poll sweep — the VPS is pushed changes and never re-reads the whole queue.
 * Retries after a failed post are scheduled per-entry with a timer (one
 * targeted read per retry attempt), and restart recovery comes free from the
 * listener's initial replay.
 *
 * Notifications: as soon as a new pending entry arrives (real-time, on submit),
 * a "New autopsy request submitted" alert is posted (stamped
 * `submittedNotifiedAt` so it fires once); after the topic posts, a second
 * alert carries the forum link.
 *
 * Wired into index.js on bot startup. Posts one topic at a time; the shared
 * forum client mutex serializes this against the autopsy monitor and deploys.
 */

import firebase from './firebase.js';
import { getForumClient } from './forumClient.js';
import { isDevTestActive, devWebhookUrl } from './devRouting.js';

const PENDING_PATH = 'autopsy-requests/pending';
const PHMC_BASE = 'https://phmc.gta.world';
const PHMC_FORUM_ID = 265;
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 5 * 60 * 1000;
const SEND_TIMEOUT_MS = 10000;
const NOTIFY_WEBHOOK_ENV = 'AUTOPSY_REQUEST_WEBHOOK_URL';

let _listenerRef = null;
const _queue = []; // { id, entry } — processed sequentially (one topic at a time)
let _draining = false;
const _retryTimers = new Map(); // entry id -> timeout handle

export function isAutoPostEnabled() {
    return String(process.env.AUTOPSY_REQUEST_AUTO_POST || '').toLowerCase() === 'true';
}

// Resolved per-send so a runtime /enable-dev-autopsy toggle applies immediately.
// DEV TEST mode routes to the dev webhook (or drops when none is configured).
function getNotifyWebhookUrl() {
    if (isDevTestActive()) return devWebhookUrl(NOTIFY_WEBHOOK_ENV);
    return process.env[NOTIFY_WEBHOOK_ENV] || '';
}

async function postNotification(webhookUrl, payload) {
    if (!webhookUrl) return false;
    try {
        const res = await Promise.race([
            fetch(webhookUrl + '?with_components=true', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('webhook send timed out')), SEND_TIMEOUT_MS)),
        ]);
        if (!res.ok) {
            console.warn(`[WEB-REQ] Notification failed (HTTP ${res.status})`);
            return false;
        }
        return true;
    } catch (err) {
        console.warn(`[WEB-REQ] Notification send error: ${err.message}`);
        return false;
    }
}

async function sendSubmittedNotification(id, entry) {
    const url = getNotifyWebhookUrl();
    if (!url) return false;
    const payload = {
        username: 'PHMC Autopsy Requests',
        content: '**New autopsy request submitted**',
        embeds: [{
            title: entry.topicTitle || 'Autopsy Request',
            color: 0x00bcd4,
            fields: [
                { name: 'Decedent', value: `${entry.decedentName || 'Unknown'}${entry.oocName ? ` ((${entry.oocName}))` : ''}`, inline: true },
                { name: 'Morgue Case #', value: entry.caseId || '—', inline: true },
                { name: 'Requester', value: entry.requesterName || 'Unknown', inline: true },
                ...(entry.requesterDept ? [{ name: 'Department', value: entry.requesterDept, inline: true }] : []),
            ],
            timestamp: new Date().toISOString(),
        }],
    };
    const ok = await postNotification(url, payload);
    console.log(`[WEB-REQ] ${ok ? 'Sent' : 'Failed to send'} submitted notification for #${id}`);
    return ok;
}

async function sendPostedNotification(topicUrl, title) {
    const url = getNotifyWebhookUrl();
    if (!url) return false;
    const payload = {
        username: 'PHMC Autopsy Requests',
        content: `**Autopsy request posted to the forum**${topicUrl ? ` — <${topicUrl}>` : ''}`,
        embeds: [{
            title,
            color: 0x28a745,
            timestamp: new Date().toISOString(),
        }],
    };
    const ok = await postNotification(url, payload);
    console.log(`[WEB-REQ] ${ok ? 'Sent' : 'Failed to send'} posted notification`);
    return ok;
}

export function startWebAutopsyRequestPoster() {
    firebase.init();
    console.log(`[WEB-REQ] Starting web autopsy request poster (auto-post=${isAutoPostEnabled()}) — RTDB listener, no polling`);
    const ref = firebase.db.ref(PENDING_PATH);
    _listenerRef = ref;

    // New submissions are pushed to us in real-time (initial replay covers any
    // entries that were already queued at boot — already-posted/failed entries
    // are skipped so a restart never re-posts). No periodic reads.
    ref.on('child_added', (snap) => {
        if (!snap.exists()) return;
        const entry = snap.val();
        if (!entry || typeof entry !== 'object') return;
        if (String(entry.status || 'pending') !== 'pending') return;
        _queue.push({ id: snap.key, entry });
        drain();
    });

    // A failed post flips the entry back to 'pending' with a future
    // nextRetryAt — schedule that retry with a timer (no polling).
    ref.on('child_changed', (snap) => {
        if (!snap.exists()) return;
        const entry = snap.val();
        if (!entry || typeof entry !== 'object') return;
        if ((entry.attempts || 0) > 0 && String(entry.status || 'pending') === 'pending' && entry.nextRetryAt) {
            scheduleRetry(snap.key, entry);
        }
    });
}

export function stopWebAutopsyRequestPoster() {
    if (_listenerRef) {
        _listenerRef.off('child_added');
        _listenerRef.off('child_changed');
        _listenerRef = null;
    }
    for (const t of _retryTimers.values()) clearTimeout(t);
    _retryTimers.clear();
    _queue.length = 0;
}

// Sequential queue worker — one topic post at a time.
async function drain() {
    if (_draining) return;
    if (!isAutoPostEnabled()) return;
    _draining = true;
    try {
        const db = firebase.db;
        while (_queue.length > 0) {
            const { id, entry } = _queue.shift();
            if (String(entry.status || 'pending') !== 'pending') continue; // safety: never re-post done entries
            try {
                // Immediate "submitted" alert on first sight of the request
                // (real-time, independent of posting).
                if (!entry.submittedNotifiedAt) {
                    await sendSubmittedNotification(id, entry);
                    await db.ref(`${PENDING_PATH}/${id}`).update({ submittedNotifiedAt: Date.now() }).catch(() => {});
                }
                await postOne(db, id, entry);
            } catch (err) {
                console.error(`[WEB-REQ] #${id} posting error: ${err.message}`);
                await markFailed(db, id, entry, err.message);
            }
        }
    } finally {
        _draining = false;
    }
}

// Per-entry retry timer: one targeted read when the backoff elapses.
function scheduleRetry(id, entry) {
    const wait = Math.max(0, (entry.nextRetryAt || 0) - Date.now());
    if (_retryTimers.has(id)) clearTimeout(_retryTimers.get(id));
    const t = setTimeout(async () => {
        _retryTimers.delete(id);
        try {
            const db = firebase.db;
            const snap = await db.ref(`${PENDING_PATH}/${id}`).once('value');
            if (!snap.exists()) return;
            const cur = snap.val();
            if (!cur || String(cur.status || 'pending') !== 'pending') return;
            if (cur.nextRetryAt && Date.now() < cur.nextRetryAt) { scheduleRetry(id, cur); return; }
            _queue.push({ id, entry: cur });
            drain();
        } catch (err) {
            console.error(`[WEB-REQ] #${id} retry re-check error: ${err.message}`);
        }
    }, wait);
    _retryTimers.set(id, t);
}

async function postOne(db, id, entry) {
    const title = String(entry.topicTitle || '').trim();
    const bbCode = String(entry.requestBBCode || '').trim();
    if (!title || !bbCode) {
        const msg = 'Missing topicTitle or requestBBCode';
        console.warn(`[WEB-REQ] #${id} ${msg} — marking failed`);
        await db.ref(`${PENDING_PATH}/${id}`).update({
            status: 'failed',
            lastError: msg,
            lastAttemptAt: Date.now(),
        });
        return;
    }

    const client = getForumClient();
    await client.ensureBrowser();
    const res = await client.postTopic(
        PHMC_FORUM_ID,
        title,
        bbCode,
        `${PHMC_BASE}/posting.php?mode=post&f=${PHMC_FORUM_ID}`
    );
    if (!res.ok) throw new Error('Topic post returned not-ok');

    await db.ref(`${PENDING_PATH}/${id}`).update({
        status: 'posted',
        topicUrl: res.url || '',
        postedAt: Date.now(),
        postedBy: 'bot',
    });
    // Hand the requester's deliver-to forum account to the completion pipeline:
    // the monitor attaches this to the autopsy-requested entry, so the "DM
    // Requester" step PMs the real requester instead of skipping (topic poster
    // is the bot for web submissions).
    const tMatch = (res.url || '').match(/[?&]t=(\d+)/);
    if (tMatch) {
        await db.ref(`autopsy-requests/web-meta/${tMatch[1]}`).set({
            source: 'web-morgue',
            agencyForum: entry.agencyForum || '',
            forumAccountUrl: entry.forumAccountUrl || '',
            requesterName: entry.requesterName || '',
        }).catch(() => {});
    }
    console.log(`[WEB-REQ] [OK] Posted #${id} "${title}" -> ${res.url}`);
    await sendPostedNotification(res.url, title);
}

async function markFailed(db, id, entry, message) {
    const attempts = (entry.attempts || 0) + 1;
    const done = attempts >= MAX_ATTEMPTS;
    const update = {
        status: done ? 'failed' : 'pending',
        attempts,
        lastError: message,
        lastAttemptAt: Date.now(),
    };
    if (!done) update.nextRetryAt = Date.now() + RETRY_BACKOFF_MS;
    await db.ref(`${PENDING_PATH}/${id}`).update(update);
    console.warn(`[WEB-REQ] #${id} attempt ${attempts}/${MAX_ATTEMPTS} failed${done ? ' — giving up' : `, retry after backoff`}: ${message}`);
    if (done) {
        const url = getNotifyWebhookUrl();
        if (url) {
            await postNotification(url, {
                username: 'PHMC Autopsy Requests',
                content: '**Autopsy request auto-post FAILED**',
                embeds: [{
                    title: entry.topicTitle || 'Autopsy Request',
                    color: 0xdc3545,
                    fields: [{ name: 'Reason', value: message || 'Unknown error', inline: false }],
                    timestamp: new Date().toISOString(),
                }],
            });
        }
    }
}