/**
 * Posting Health — per-forum write-path circuit breaker.
 *
 * Website Online (index.php loads) and Posting Status (posting.php submits)
 * are different things behind Cloudflare: reads can sail through while every
 * write stalls on a Turnstile challenge. This module tracks REAL posting
 * outcomes per forum host and pauses new write attempts while a host's write
 * path is down — without burning the report retry budget.
 *
 * ── How it works ──
 * forumClient wraps its five write methods (postTopic, replyToTopic, sendPM,
 * editPostContent, quoteAndPost) so every submit records an outcome here and
 * checks throwIfPostingPaused() first (fail fast, no browser work).
 * runDeploy treats the POSTING_PAUSED error as a pause: the report is
 * rescheduled via rescheduleReportProbe() with its retry count PRESERVED.
 *
 * State machine per host: ok -> degraded (1-2 recent wall-signals) ->
 * blocked (>=N consecutive wall-signals). Any success resets to ok.
 * Half-open probing: once the current probe interval has passed since the
 * last failure, one attempt is let through — it either clears the breaker
 * or re-blocks it. The probe interval ESCALATES the longer a host stays
 * blocked (30min -> 1h -> 2h -> 4h cap) so multi-day outages don't burn a
 * full attempt + staff embeds every 30 minutes forever; it snaps back to
 * base on the first success. Failures older than STALE_MS don't count (an
 * empty queue must not keep a recovered forum paused forever).
 *
 * Tune via env: POSTING_BLOCK_FAILURES (default 3), POSTING_PROBE_MS
 * (default 30min base), POSTING_PROBE_CAP_MS (default 4h),
 * POSTING_STALE_MS (default 6h).
 *
 * State lives in memory (single bot process) and is mirrored to
 * monitoring/posting/<host> in RTDB for the dashboard + restart recovery.
 *
 * Tune via env: POSTING_BLOCK_FAILURES (default 3), POSTING_PROBE_MS
 * (default 30min), POSTING_STALE_MS (default 6h).
 *
 * This module has NO static local imports besides deployState (a leaf), so
 * it can be imported anywhere without cycles. Firebase + webhooks resolve
 * lazily and every failure is swallowed — the tracker must never break a
 * deploy.
 *
 * @module postingHealth
 */

import { state } from './deployState.js';

const _mem = new Map(); // host -> record
let _seeded = false;
// Set when the process is shutting down (SIGTERM path calls
// closeSharedBrowser('shutdown')): failures during teardown are the restart
// itself killing in-flight ops, not forum health — recording them would
// poison the breaker, dashboard, and retry counts with noise.
let _shuttingDown = false;

/** Called by forumClient shutdown path; suppresses outcome recording after. */
export function markShuttingDown() {
    _shuttingDown = true;
}

export function postingTuning() {
    const num = (v, d) => {
        const n = parseInt(String(v || ''), 10);
        return Number.isFinite(n) && n > 0 ? n : d;
    };
    return {
        failuresToBlock: num(process.env.POSTING_BLOCK_FAILURES, 3),
        probeMs: num(process.env.POSTING_PROBE_MS, 30 * 60 * 1000),
        probeCapMs: num(process.env.POSTING_PROBE_CAP_MS, 4 * 60 * 60 * 1000),
        staleMs: num(process.env.POSTING_STALE_MS, 6 * 60 * 60 * 1000),
    };
}

/**
 * Current half-open probe interval for a host: doubles every 3 consecutive
 * failures past the block threshold, capped. Resets implicitly on success
 * (consecutiveFailures -> 0).
 */
export function currentProbeMs(consecutiveFailures) {
    const t = postingTuning();
    const steps = Math.max(0, Math.floor(((consecutiveFailures || 0) - t.failuresToBlock) / 3));
    return Math.min(t.probeMs * 2 ** steps, t.probeCapMs);
}

export function probeIntervalMs() {
    return postingTuning().probeMs;
}

/** Normalize any forum URL to its host key (phmc.gta.world). Null when unparseable. */
export function hostKey(url) {
    try {
        return new URL(String(url)).hostname.toLowerCase();
    } catch {
        return null;
    }
}

/** RTDB-safe node name for a host (dots are illegal in RTDB keys). */
export function rtdbKey(host) {
    return String(host).replace(/\./g, '_');
}

// Failure reasons that describe THIS submission being bad (wrong recipient,
// missing topic, locked thread, no consent...) — never a wall signal.
const NON_WALL_RE =
    /recipient|username_list|memberlist|username may not exist|did not stick|no close match|topic does not exist|topic unavailable|this topic is locked|not permitted|login failed|consent|blocked_empty_employee|dry run/i;

/**
 * Does this failure reason implicate the write path (challenge, timeout,
 * navigation, submit machinery)? Unknown reasons fail closed toward true:
 * backpressure signals like phpBB flood control SHOULD pause us.
 */
export function isWallSignal(reason) {
    const r = String(reason || '');
    if (!r) return true;
    if (NON_WALL_RE.test(r)) return false;
    return true;
}

function _blank(host) {
    return {
        host,
        status: 'unknown',
        consecutiveFailures: 0,
        lastOkAt: 0,
        lastWriteOkAt: 0,
        lastFailAt: 0,
        lastReason: '',
        updatedAt: Date.now(),
    };
}

function _dbRef(path) {
    try {
        if (state.dbRef) {
            const root = state.dbRef;
            if (typeof root.child === 'function') return root.child(path);
            if (typeof root.ref === 'function') return root.ref(path);
        }
    } catch { /* memory-only fallback */ }
    return null;
}

async function _seedOnce() {
    if (_seeded) return;
    _seeded = true;
    try {
        const ref = _dbRef('monitoring/posting');
        if (!ref) return;
        const snap = await ref.once('value').catch(() => null);
        if (!snap || !snap.exists()) return;
        snap.forEach((child) => {
            const v = child.val() || {};
            if (v.host) _mem.set(v.host, { ..._blank(v.host), ...v });
        });
    } catch { /* memory-only fallback */ }
}

async function _mirror(rec) {
    try {
        const ref = _dbRef(`monitoring/posting/${rtdbKey(rec.host)}`);
        if (!ref) return;
        await ref.set({
            host: rec.host,
            status: rec.status,
            consecutiveFailures: rec.consecutiveFailures,
            lastOkAt: rec.lastOkAt,
            lastWriteOkAt: rec.lastWriteOkAt || 0,
            lastFailAt: rec.lastFailAt,
            lastReason: String(rec.lastReason || '').slice(0, 160),
            updatedAt: rec.updatedAt,
        }).catch(() => {});
    } catch { /* dashboard mirror is best-effort */ }
}

async function _notify(title, description, color) {
    try {
        const { sendWebhook } = await import('./deployLogger.js');
        await sendWebhook(null, { title, description, color, footer: { text: 'PHMC Bot — Posting Health' } }).catch(() => {});
    } catch { /* alerts are best-effort */ }
}

/**
 * Record one forum automation outcome. Only real WRITES reset the breaker:
 * a login that passes Cloudflare proves the read path is alive, but read
 * paths clear while write paths stay walled — letting login successes reset
 * the counter makes the breaker flap forever and never pause (observed:
 * infinite hourly attempts). So login success updates lastOkAt (liveness
 * telemetry) but never touches status/failures; login wall-failures still
 * count, since a login that can't pass predicts posting failure.
 */
export async function recordPostingOutcome(url, ok, reason, kind = 'write') {
    try {
        if (_shuttingDown) return null; // teardown noise, not signal
        const host = hostKey(url);
        if (!host) return null;
        await _seedOnce();
        const t = postingTuning();
        const now = Date.now();
        let rec = _mem.get(host) || _blank(host);

        if (ok) {
            // Login success is liveness only — never resets breaker state.
            if (kind === 'login') {
                rec = { ...rec, lastOkAt: now, updatedAt: now };
                _mem.set(host, rec);
                return rec;
            }
            const wasBlocked = rec.status === 'blocked';
            const changed = wasBlocked || rec.status !== 'ok' || (rec.consecutiveFailures || 0) > 0;
            rec = {
                ...rec,
                status: 'ok',
                consecutiveFailures: 0,
                lastOkAt: now,
                lastWriteOkAt: kind === 'write' ? now : (rec.lastWriteOkAt || 0),
                lastReason: '',
                updatedAt: now,
            };
            _mem.set(host, rec);
            // Logins succeed constantly (every sweep) — mirror only on change
            // so we don't write RTDB on every monitor pass.
            if (changed) await _mirror(rec);
            if (wasBlocked) {
                console.log(`[POSTING] ✅ ${host} write path recovered — breaker closed`);
                await _notify('✅ Posting Recovered', `**Forum:** ${host}\nWrite path is working again — paused deploys will resume.`, 0x28a745);
            }
            return rec;
        }

        if (!isWallSignal(reason)) return rec; // bad submission, not a sick forum

        const fresh = now - (rec.lastFailAt || 0) <= t.staleMs;
        const failures = fresh ? (rec.consecutiveFailures || 0) + 1 : 1;
        const wasBlocked = rec.status === 'blocked';
        rec = {
            ...rec,
            consecutiveFailures: failures,
            lastFailAt: now,
            lastReason: String(reason || 'unknown').slice(0, 160),
            updatedAt: now,
            status: failures >= t.failuresToBlock ? 'blocked' : 'degraded',
        };
        _mem.set(host, rec);
        await _mirror(rec);
        if (!wasBlocked && rec.status === 'blocked') {
            console.error(`[POSTING] 🛑 ${host} write path blocked (${failures} consecutive failures) — pausing new attempts`);
            await _notify(
                '🛑 Posting Blocked — Deploys Paused',
                `**Forum:** ${host}\n**Failures:** ${failures} consecutive\n**Last:** ${rec.lastReason}\n\nNew write attempts are paused (retry budget preserved) until a probe succeeds.`,
                0xdc3545
            );
        }
        return rec;
    } catch {
        return null;
    }
}

/**
 * Fail fast when the host's write path is blocked. Resolves silently when
 * healthy, stale, or due for a half-open probe. Throws a POSTING_PAUSED
 * error otherwise — callers must let it propagate (runDeploy converts it
 * into a budget-preserving reschedule).
 */
export async function throwIfPostingPaused(url, op) {
    const host = hostKey(url);
    if (!host) return;
    await _seedOnce();
    const t = postingTuning();
    const rec = _mem.get(host);
    if (!rec || rec.status !== 'blocked') return;
    const now = Date.now();
    if (now - (rec.lastFailAt || 0) > t.staleMs) return; // stale intel — allow a fresh attempt
    const probeMs = currentProbeMs(rec.consecutiveFailures);
    if (now - (rec.lastFailAt || 0) >= probeMs) return; // half-open: let one probe through
    const err = new Error(
        `Posting to ${host} paused — write path blocked (${rec.consecutiveFailures} failures, next probe ${agoStr(rec.lastFailAt + probeMs, now)})`
    );
    err.code = 'POSTING_PAUSED';
    err.postingHost = host;
    err.postingOp = op || 'write';
    throw err;
}

/** Escalated probe interval for a host (base when unknown). */
export function probeMsForHost(host) {
    const rec = host ? _mem.get(host) : null;
    return currentProbeMs(rec ? rec.consecutiveFailures : 0);
}

/** Display status for one mirrored record (applies the staleness rule). */export function displayStatus(rec, now = Date.now()) {
    const t = postingTuning();
    if (!rec) return 'unknown';
    if (rec.status === 'blocked' && now - (rec.lastFailAt || 0) <= t.staleMs) return 'blocked';
    if ((rec.consecutiveFailures || 0) > 0 && now - (rec.lastFailAt || 0) <= t.staleMs) return 'degraded';
    if (rec.status === 'ok') return 'ok';
    return 'unknown';
}

/** Short label for a forum host (phmc.gta.world -> PHMC). */
export function shortName(host) {
    return String(host || '').split('.')[0].toUpperCase() || 'FORUM';
}

/** Human duration for probe cadence (30m, 1h, 4h). */
function durStr(ms) {
    const m = Math.round(ms / 60000);
    if (m < 60) return `${m}m`;
    const h = m / 60;
    return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
}

/** Relative-time helper shared by the dashboard (s/m/h/d). */
export function agoStr(ts, now = Date.now()) {
    if (!ts) return 'never';
    const s = Math.max(0, Math.floor((now - ts) / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 48) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

/**
 * Render Posting Status lines from the RTDB mirror object
 * (monitoring/posting). Returns { lines, blocked } for the dashboard.
 */
export function formatPostingLines(postingObj, now = Date.now()) {
    const entries = Object.values(postingObj || {}).filter((r) => r && r.host);
    if (entries.length === 0) return { lines: 'No posting attempts recorded yet', blocked: false };
    let blocked = false;
    const lines = entries.map((r) => {
        const st = displayStatus(r, now);
        const name = shortName(r.host);
        if (st === 'blocked') {
            blocked = true;
            return `${name} — 🔴 BLOCKED · ${r.consecutiveFailures || 0} fails · last ${agoStr(r.lastFailAt, now)} · probes every ${durStr(currentProbeMs(r.consecutiveFailures))} · ${String(r.lastReason || 'unknown').slice(0, 80)}`;
        }
        if (st === 'degraded') {
            return `${name} — 🟡 shaky · ${r.consecutiveFailures || 0} fails · last ${agoStr(r.lastFailAt, now)}`;
        }
        if (st === 'ok') {
            const lastPost = r.lastWriteOkAt ? `last post ${agoStr(r.lastWriteOkAt, now)}` : 'no posts yet';
            return `${name} — 🟢 OK · ${lastPost}`;
        }
        return `${name} — ⚪ no recent data`;
    });
    return { lines: lines.join('\n'), blocked };
}

/**
 * Auth event tracking — the machine-readable login flag. Routine session
 * reuse never writes (hot path stays quiet); only forced logins (session
 * was dead, re-authenticated) and login failures are mirrored, so session
 * churn becomes visible on the dashboard BEFORE it causes vague downstream
 * errors. Telemetry-only: never throws, never blocks.
 */
export async function recordAuthEvent(url, kind) {
    try {
        const host = hostKey(url);
        if (!host) return;
        const ref = _dbRef(`monitoring/session/${rtdbKey(host)}`);
        if (!ref) return;
        const now = Date.now();
        const cur = (await ref.once('value').catch(() => null))?.val() || {};
        if (kind === 'failed') {
            await ref.update({
                host,
                loginFailures: (cur.loginFailures || 0) + 1,
                lastFailureAt: now,
                updatedAt: now,
            }).catch(() => {});
        } else {
            await ref.update({
                host,
                forcedLogins: (cur.forcedLogins || 0) + 1,
                lastForcedAt: now,
                updatedAt: now,
            }).catch(() => {});
        }
    } catch { /* telemetry only */ }
}

/** Render Sessions lines from the RTDB mirror (null when nothing recorded). */
export function formatSessionLines(sessionObj, now = Date.now()) {
    const entries = Object.values(sessionObj || {}).filter((r) => r && r.host);
    if (entries.length === 0) return null;
    return entries.map((r) => {
        const name = shortName(r.host);
        const bits = [];
        if (r.forcedLogins) bits.push(`re-authenticated ${r.forcedLogins}x${r.lastForcedAt ? `, last ${agoStr(r.lastForcedAt, now)}` : ''}`);
        if (r.loginFailures) bits.push(`failures ${r.loginFailures}${r.lastFailureAt ? `, last ${agoStr(r.lastFailureAt, now)}` : ''}`);
        if (bits.length === 0) return `${name} — session stable`;
        return `${name} — ${bits.join(' · ')}`;
    }).join('\n');
}
