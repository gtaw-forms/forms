/**
 * Forum Client — Playwright browser automation layer for phpBB forums.
 *
 * ── Architecture ──
 * All instances share a single Chromium browser (getSharedBrowser), but each
 * ForumClient instance gets its own browser context + page.  This means:
 *   • Default instance (getForumClient) — one context, used for PHMC operations
 *   • Isolated instances (createIsolatedClient) — separate contexts,
 *     each with its own session file and cookie store
 *
 * Every public method acquires a mutex lock (_acquire() / release()), so
 * only one forum operation runs at a time across ALL instances sharing the
 * same browser.  This prevents Cloudflare challenges and phpBB session
 * conflicts.
 *
 * ── Methods ──
 *   login()                 — Authenticate to the forum (username/password or stored session)
 *   postTopic()             — Create a new forum thread in a specified forum
 *   replyToTopic()          — Post a reply in an existing thread
 *   sendPM()                — Send a Private Message to a forum user
 *   searchForum()           — Full-text search across a forum
 *   searchCaseManagement()  — Search case management forum (f=266) by decedent name
 *   getTopicPoster()        — Get the username of the person who created a topic
 *   resolveCaseTopic()      — Find the case topic for a given autopsy request
 *
 * ── Cross-Forum (Agency) Posting ──
 * LSSD, LSPD, SADCR, and DAO forums use ISOLATED instances with separate
 * credentials.  Each call to createIsolatedClient('name') creates a fresh
 * context initialized from its own session file (forum-session-<name>.json).
 * The caller MUST call .login() on the isolated client before use.
 *
 * ── Session Management ──
 * After successful login, the session cookies are saved to a JSON file
 * (forum-session.json by default).  On next startup, login() with force=false
 * checks if the saved session is still valid and skips re-authentication if so.
 * Force-login (force=true) always fills the login form regardless of session
 * state — used for isolated clients and when credentials change.
 *
 * ── Dry-Run ──
 * All posting methods accept { dryRun: true } to fill the form but skip
 * submission.  The filled form content is logged for inspection.
 *
 * @module forumClient
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logActivity, describeActivity, markActivityDone } from './activityLog.js';
import { recordPostingOutcome, throwIfPostingPaused, markShuttingDown, recordAuthEvent } from './postingHealth.js';

chromium.use(StealthPlugin());

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SESSION_FILE = resolve(__dirname, '..', 'forum-session.json');

/**
 * Module-level shared browser process. All ForumClient instances share the
 * same Chromium process but get their own browser context (isolated cookies,
 * localStorage, Cloudflare state) and session file.
 */
let _sharedBrowser = null;
let _browserInitPromise = null;
// Ownership of the shared browser: true when WE launched it via
// chromium.launch() (safe to close), false when attached to the
// systemd-managed persistent Chromium over CDP (never close it — the
// daemon owns its lifecycle; we only drop our local handle).
let _browserOwnedByUs = true;

/**
 * Single Cloudflare gate per navigation chain: timestamp (ms) of the last
 * waitForCloudflare() call that observed a clean (challenge-free) page. A
 * challenge that just passed doesn't need re-polling 3× in one cold
 * postTopic-after-login flow — waitForCloudflare() returns true immediately
 * when this is fresher than 60s. The 120s cap behavior is otherwise identical.
 */
let _lastCfPassAt = 0;

/**
 * Proactive flood pacing: last submit timestamp (ms) per forum account,
 * keyed by `<baseUrl-ish>|<username>`. phpBB rejects rapid consecutive posts
 * from the same account, so postTopic/replyToTopic/sendPM wait out the
 * remainder of a 30s gap (capped at 35s) BEFORE clicking submit. The existing
 * reactive 25s×3 retry loops stay untouched as backstop.
 */
const _lastSubmitAtByAccount = new Map();

async function _paceSubmitBeforeClick(accountKey) {
    const MIN_GAP_MS = 30000;
    const MAX_WAIT_MS = 35000;
    const now = Date.now();
    const last = _lastSubmitAtByAccount.get(accountKey) || 0;
    const elapsed = now - last;
    if (elapsed < MIN_GAP_MS) {
        const waitMs = Math.min(MIN_GAP_MS - elapsed, MAX_WAIT_MS);
        console.log(`[FORUM] ⏳ Flood pacing: last submit ${(elapsed / 1000).toFixed(1)}s ago on ${accountKey} — waiting ${(waitMs / 1000).toFixed(1)}s before submit`);
        await new Promise((r) => setTimeout(r, waitMs));
    }
    _lastSubmitAtByAccount.set(accountKey, Date.now());
}

/**
 * Trusted-input form fill: page.fill() produces isTrusted input events like
 * a real user typing; raw evaluate() fills are isTrusted=false and visible
 * to bot-detection. Falls back to DOM injection when the element isn't
 * actionable, preserving old behavior. Returns true when a value was set.
 */
async function trustedFill(page, selector, value, { timeout = 10000 } = {}) {
    try {
        await page.fill(selector, String(value ?? ''), { timeout });
        return true;
    } catch {
        /* fall through to injection */
    }
    try {
        const ok = await page.evaluate(([sel, v]) => {
            const el = document.querySelector(sel);
            if (!el) return false;
            if ('value' in el) el.value = v; else el.textContent = v;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
        }, [selector, String(value ?? '')]).catch(() => false);
        if (!ok) console.log(`[FORUM] ⚠️ Fill fallback also missed ${selector}`);
        return !!ok;
    } catch {
        return false;
    }
}

/** Message fill across phpBB editor variants (textarea, then contenteditable). */
async function trustedFillMessage(page, bbCode, { timeout = 10000 } = {}) {
    if (await trustedFill(page, 'textarea[name="message"]', bbCode, { timeout })) return true;
    return trustedFill(page, 'div[contenteditable="true"]', bbCode, { timeout });
}

/**
 * Trusted submit click across phpBB button variants. Probes form/button
 * presence FIRST (fast fail) so callers keep their exact 'No form found' /
 * 'No submit button' diagnostics (the breaker keys off them), then clicks
 * via page.click (trusted). Falls back to a synthetic click as last resort.
 */
async function trustedSubmitClick(page, formActionSubstr, buttonSelectors, { timeout = 10000 } = {}) {
    let probe;
    try {
        probe = await page.evaluate(([fsub, sels]) => {
            const form = document.querySelector(`form[action*="${fsub}"]`);
            if (!form) return { ok: false, reason: 'No form found' };
            const btn = form.querySelector(sels.join(', '));
            if (!btn) return { ok: false, reason: 'No submit button' };
            return { ok: true };
        }, [formActionSubstr, buttonSelectors]);
    } catch {
        return { ok: false, reason: 'Submit check failed' };
    }
    if (!probe.ok) return probe;
    for (const sel of buttonSelectors) {
        try {
            await page.click(`form[action*="${formActionSubstr}"] ${sel}`, { timeout });
            return { ok: true };
        } catch {
            /* try next variant */
        }
    }
    try {
        const clicked = await page.evaluate(([fsub, sels]) => {
            const form = document.querySelector(`form[action*="${fsub}"]`);
            const btn = form && form.querySelector(sels.join(', '));
            if (btn) { btn.click(); return true; }
            return false;
        }, [formActionSubstr, buttonSelectors]).catch(() => false);
        return clicked ? { ok: true } : { ok: false, reason: 'No submit button' };
    } catch {
        return { ok: false, reason: 'No submit button' };
    }
}

/**
 * Whether this instance's env credentials belong to the given forum URL.
 * Inline re-login must never submit (e.g.) PHMC credentials to a foreign
 * forum — guaranteed failure that also poisons logs, wastes minutes, and
 * overwrites the session file. The caller must login() with that forum's
 * credentials first. Unparseable URLs preserve legacy behavior.
 */
function _credsMatchDomain(inst, url) {
    try {
        const want = new URL(String(url)).hostname.toLowerCase();
        const have = new URL(inst.baseUrl).hostname.toLowerCase();
        return want === have;
    } catch {
        return true;
    }
}

/**
 * Failure dump: save the FULL page HTML for post-mortem debugging whenever
 * an expected element (form, button, field) is missing. Overwrites per flow
 * (no accumulation): debug/debug-<name>.html. Best-effort, never throws.
 */
async function dumpPageState(page, name) {
    try {
        const html = await page.content().catch(() => '(unable to capture page content)');
        const debugPath = resolve(__dirname, '..', 'debug', `debug-${name}.html`);
        mkdirSync(dirname(debugPath), { recursive: true });
        writeFileSync(debugPath, html, 'utf-8');
        console.log(`[FORUM] 💾 Full page HTML saved to ${debugPath} (${html.length}b)`);
    } catch { /* diagnostics must never break flows */ }
}

/**
 * Global forum gate: max concurrent forum operations across ALL client
 * instances sharing the browser. The old per-instance mutex let N isolated
 * clients hammer the same accounts/forums in parallel (Cloudflare challenges,
 * phpBB flood blocks, session thrash). Every public method funnels through
 * _acquire(), so this bounds total forum concurrency for boot storms and
 * steady state alike. Tune via FORUM_GLOBAL_CONCURRENCY (default 2).
 */
const _globalMax = Math.max(1, parseInt(process.env.FORUM_GLOBAL_CONCURRENCY || '2', 10) || 2);
let _globalActive = 0;
const _globalWaiters = [];

function _acquireGlobal() {
    return new Promise((resolve) => {
        const tryTake = () => {
            if (_globalActive < _globalMax) {
                _globalActive++;
                resolve();
            } else {
                _globalWaiters.push(tryTake);
            }
        };
        tryTake();
    });
}

function _releaseGlobal() {
    _globalActive = Math.max(0, _globalActive - 1);
    const next = _globalWaiters.shift();
    if (next) next();
}

/**
 * Idle-shutdown bookkeeping — frees the ~350MB Chromium footprint when the
 * forum goes quiet. Only REAL navigations (page.goto) reset the timer, not
 * mere ensureBrowser() calls, so hourly scans that skip browser work still
 * let the browser shut down. Relaunch is transparent: session cookies live
 * in the per-instance session files, so the next op logs back in cheaply.
 * Tune via FORUM_BROWSER_IDLE_MS (default 45min; 0 or negative = disabled).
 */
const _liveInstances = new Set();
let _lastBrowserActivity = Date.now();
let _idleSweepTimer = null;

function _idleTimeoutMs() {
    const v = parseInt(process.env.FORUM_BROWSER_IDLE_MS || '', 10);
    if (Number.isFinite(v)) return v;
    return 45 * 60 * 1000;
}

function _touchBrowserActivity() {
    _lastBrowserActivity = Date.now();
}

function _ensureIdleSweeper() {
    if (_idleSweepTimer) return;
    _idleSweepTimer = setInterval(() => {
        (async () => {
            try {
                const idleMs = _idleTimeoutMs();
                if (idleMs <= 0) return;
                if (!_sharedBrowser) return;
                // Daemon-attached browsers ARE the persistence mechanism —
                // idle contexts are cheap, so the sweeper leaves them alone.
                if (!_browserOwnedByUs) { console.debug('[FORUM] Idle sweep skipped — attached to persistent browser (CDP)'); return; }
                if (_globalActive > 0) return; // forum work in flight — don't pull the rug
                if (Date.now() - _lastBrowserActivity < idleMs) return;
                console.log(`[FORUM] Idle ${Math.round((Date.now() - _lastBrowserActivity) / 60000)}m with no forum work — closing shared browser to free memory`);
                await closeSharedBrowser('idle-timeout');
            } catch (err) {
                console.error(`[FORUM] Idle sweep error: ${err.message}`);
            }
        })();
    }, 5 * 60 * 1000);
    if (_idleSweepTimer.unref) _idleSweepTimer.unref();
}

/**
 * Kill any chrome-headless-shell processes that have been orphaned — i.e. their
 * parent is dead (reparented to PID 1). This happens when a previous bot run
 * died abruptly (uncaughtException → exit(1), SIGKILL), leaving its Chromium
 * tree behind. Without this, zombie browsers accumulate and the dashboard
 * shows phantom "main 2 · …" process trees. Only the main browser process needs
 * killing; its children exit on their own. Linux only.
 */
function reapOrphanBrowsers() {
    if (process.platform !== 'linux') return;
    try {
        for (const entry of readdirSync('/proc')) {
            if (!/^\d+$/.test(entry)) continue;
            let status;
            try { status = readFileSync(`/proc/${entry}/status`, 'utf8'); } catch { continue; }
            if (!/chrome-headless-shell|chrome-headless-sh/.test(status)) continue;
            const m = status.match(/^PPid:\s+(\d+)/m);
            const ppid = m ? parseInt(m[1], 10) : 0;
            if (ppid === 1) {
                // Never reap the systemd-managed persistent browser daemon —
                // it may also appear with PPid=1. It listens on
                // --remote-debugging-port and uses the browser-profile dir.
                try {
                    const cmdline = readFileSync(`/proc/${entry}/cmdline`, 'utf8');
                    if (cmdline.includes('remote-debugging-port') || cmdline.includes('browser-profile')) continue;
                } catch { /* unreadable cmdline — fall through to reap as before */ }
                try {
                    process.kill(parseInt(entry, 10), 'SIGKILL');
                    console.log(`[FORUM] 🧹 Reaped orphaned browser process ${entry}`);
                } catch { /* already gone */ }
            }
        }
    } catch { /* best effort */ }
}

/**
 * Best-effort guess at WHY the browser is being spawned: the first caller
 * outside forumClient.js on the stack (e.g. "postTopic (forumClient.js)" stays
 * internal, so we walk up to "processAutopsyRequest (autopsyRequestMonitor.js)").
 */
/**
 * Match a name against a local faction roster file (data/<key>-roster.json,
 * written by the 12h roster sync: { members: [{ name, userId }] }).
 * Instant and flood-free — always preferred over live memberlist search.
 *
 * @param {string} forumKey - lspd|lssd|sadcr
 * @param {string} name - intended recipient
 * @param {number} [threshold=0.85]
 * @returns {{userId: string, username: string, score: number}|null}
 */
export function matchRosterFile(forumKey, name, threshold = 0.85) {
    try {
        const file = resolve(__dirname, '..', 'data', `${forumKey}-roster.json`);
        if (!existsSync(file)) return null;
        const data = JSON.parse(readFileSync(file, 'utf-8'));
        const members = data?.members || [];
        const want = String(name || '').trim().toLowerCase();
        if (!want) return null;
        let best = null;
        for (const m of members) {
            const uname = String(m?.name || '').trim();
            if (!uname) continue;
            const score = nameSimilarity(want, uname.toLowerCase());
            if (score === 1) return { userId: String(m.userId || ''), username: uname, score: 1 };
            if ((!best || score > best.score)) best = { userId: String(m?.userId || ''), username: uname, score };
        }
        if (best && best.score >= threshold && best.userId) return best;
        return null;
    } catch {
        return null;
    }
}

/** Map a forum base URL to its roster key (null when no roster file exists). */
export function rosterKeyForBaseUrl(baseUrl) {
    const b = String(baseUrl || '').toLowerCase();
    if (b.includes('lspd.gta.world')) return 'lspd';
    if (b.includes('lssd.gta.world')) return 'lssd';
    if (b.includes('sadcr.gta.world')) return 'sadcr';
    return null;
}

/**
 * Normalized string similarity 0..1 via Levenshtein distance.
 * Both inputs should already be lowercased by the caller.
 */
export function nameSimilarity(a, b) {
    const s = String(a || '');
    const t = String(b || '');
    if (s === t) return 1;
    if (!s.length || !t.length) return 0;
    let prev = Array.from({ length: t.length + 1 }, (_, i) => i);
    for (let i = 1; i <= s.length; i++) {
        const cur = [i];
        for (let j = 1; j <= t.length; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1));
        }
        prev = cur;
    }
    return 1 - prev[t.length] / Math.max(s.length, t.length);
}

function spawnReason() {
    try {
        const stack = new Error().stack.split('\n');
        for (const line of stack.slice(2)) {
            if (/forumClient\.js/.test(line) || /node_modules/.test(line) || /node:internal/.test(line)) continue;
            const m = line.match(/at (?:async )?([^ (]+)(?: \(([^)]+)\))?/);
            if (!m) continue;
            const fn = (m[1] || '').replace(/^.*\/([^/]+)$/, '$1');
            const file = (m[2] || '').replace(/\\/g, '/').split('/').pop() || '';
            return file ? `${fn} (${file})` : fn;
        }
    } catch { /* ignore */ }
    return 'first browser use';
}

/**
 * Drop a dead shared-browser handle (browser died underneath us): clears the
 * singleton + init promise + all instance page/context refs so the next
 * ensureBrowser() re-attaches (daemon) or relaunches. Never closes anything
 * (there is nothing left to close) and never throws.
 */
function _dropBrowserHandle(reason) {
    try {
        console.log(`[FORUM] Dropping shared browser handle (${reason})`);
        _sharedBrowser = null;
        _browserInitPromise = null;
        for (const inst of _liveInstances) {
            inst.page = null;
            inst.context = null;
        }
    } catch { /* never break callers */ }
}

/** Watch a live browser so an unexpected death resets the singleton promptly. */
function _watchBrowserDisconnect(browser) {
    try {
        browser.on('disconnected', () => {
            if (_sharedBrowser === browser) _dropBrowserHandle('event:disconnected');
        });
    } catch { /* older builds may lack .on — liveness probe covers it */ }
}

/**
 * Whether the shared browser was launched by this process (false when
 * attached to the persistent daemon). Callers that destroy browsers/pages
 * on timeouts must check this first: tearing down pages out from under
 * concurrent flows (e.g. the email worker sharing the default client)
 * breaks them with 'target closed' errors.
 */
export function isBrowserOwnedByUs() {
    return _browserOwnedByUs;
}

/**
 * Close the shared browser (if any) and reset the singleton, so a later call
 * can relaunch. Used on graceful shutdown so pm2 restarts don't orphan Chromium.
 */
export async function closeSharedBrowser(reason = 'shutdown', opts = {}) {
    const browser = _sharedBrowser;
    if (!browser) return;
    if (reason === 'shutdown') {
        // Process is exiting: failures from this point are teardown noise.
        // Tell the health tracker to stop recording outcomes.
        try { markShuttingDown(); } catch { /* tracker optional */ }
    }
    if (!_browserOwnedByUs && !opts.force) {
        // Attached to the persistent daemon — leave it running; only drop
        // our local handle. The stale-handle reset below is identical.
        console.log(`[FORUM] Persistent browser (CDP) left running for ${reason} — dropping local handle only`);
    } else {
        console.log(`[LOG] Destroying browser for ${reason}`);
        try { await browser.close(); } catch { /* already closed */ }
    }
    _sharedBrowser = null;
    _browserInitPromise = null;
    // Drop stale page/context handles on every live instance so the next
    // ensureBrowser() rebuilds them instead of reusing dead objects.
    for (const inst of _liveInstances) {
        try { if (inst.page) await inst.page.close().catch(() => {}); } catch { /* [OK] teardown ignored: page already closed or handle dead; handles nulled below */ }
        try { if (inst.context) await inst.context.close().catch(() => {}); } catch { /* [OK] teardown ignored: context already closed or handle dead; handles nulled below */ }
        inst.page = null;
        inst.context = null;
    }
}

async function getSharedBrowser() {
    if (_sharedBrowser) {
        // Liveness probe: the handle may outlive the browser (daemon swapped
        // or crashed underneath us). A dead handle must be dropped so the
        // CDP-first path below re-attaches (or relaunches) instead of failing
        // every op with 'browser/context closed' forever.
        let alive = false;
        try {
            alive = typeof _sharedBrowser.isConnected !== 'function' || _sharedBrowser.isConnected();
        } catch {
            alive = false;
        }
        if (!alive) {
            console.log('[FORUM] Shared browser disconnected — dropping handle, will re-attach or relaunch');
            _dropBrowserHandle('disconnected');
        } else {
            return _sharedBrowser;
        }
    }
    if (_browserInitPromise) return _browserInitPromise;
    _browserInitPromise = (async () => {
        reapOrphanBrowsers();
        // Prefer the systemd-managed persistent Chromium over CDP; fall back
        // to launching our own browser when absent. Empty-string
        // BROWSER_CDP_URL disables CDP entirely (legacy launch-only).
        const cdpEnv = process.env.BROWSER_CDP_URL;
        const cdpUrl = cdpEnv === '' ? null : (cdpEnv || 'http://127.0.0.1:9222');
        if (cdpUrl && typeof chromium.connectOverCDP === 'function') {
            let cdpTimer = null;
            try {
                const attempt = chromium.connectOverCDP(cdpUrl);
                attempt.catch(() => {}); // avoid unhandled rejection if the race times out first
                const cdpTimeout = new Promise((_, reject) => {
                    cdpTimer = setTimeout(() => reject(new Error('CDP connect timeout (10s)')), 10000);
                    if (cdpTimer.unref) cdpTimer.unref();
                });
                const attached = await Promise.race([attempt, cdpTimeout]);
                _sharedBrowser = attached;
                _browserOwnedByUs = false;
                _watchBrowserDisconnect(attached);
                console.log('[FORUM] Attached to persistent browser (CDP)');
                _touchBrowserActivity();
                _ensureIdleSweeper();
                return attached;
            } catch (err) {
                console.log(`[FORUM] No persistent browser at ${cdpUrl} (${err?.message || err}) — launching own browser`);
            } finally {
                if (cdpTimer) clearTimeout(cdpTimer);
            }
        }
        console.log(`[LOG] Spawning BROWSER for ${spawnReason()}`);
        const browser = await chromium.launch({
            headless: process.env.HEADLESS !== 'false',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-popup-blocking',
                '--disable-gpu',
            ],
        });
        _sharedBrowser = browser;
        _browserOwnedByUs = true;
        _watchBrowserDisconnect(browser);
        _touchBrowserActivity();
        _ensureIdleSweeper();
        return browser;
    })();
    return _browserInitPromise;
}

/**
 * Send a DM to the bot owner via Discord REST API.
 * Used to notify about Cloudflare/origin issues that need attention.
 */
async function notifyOwner(message) {
    const ownerId = process.env.BOT_OWNER_ID;
    const token = process.env.DISCORD_TOKEN;
    if (!ownerId || !token) return;

    try {
        const dmResp = await fetch(`https://discord.com/api/v10/users/${ownerId}/channels`, {
            method: 'POST',
            headers: { 'Authorization': `Bot ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient_id: ownerId }),
        });
        if (!dmResp.ok) { console.error(`[FORUM] ⚠️ Failed to create DM channel: ${dmResp.status}`); return; }
        const dmChannel = await dmResp.json();

        await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bot ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: message }),
        });
    } catch (err) {
        console.error('[FORUM] ⚠️ Failed to notify owner:', err.message);
    }
}

class ForumClient {
    /**
     * @param {object} [opts]
     * @param {string} [opts.sessionFile]  — Path to session file for this instance.
     *        Defaults to the shared forum-session.json. Isolated clients (LSSD, DM, etc.)
     *        use their own file so sessions don't conflict.
     * @param {boolean} [opts.isIsolated]  — When true, this instance does not participate
     *        in the global singleton lock; it has its own independent mutex.
     */
    constructor(opts = {}) {
        this.context = null;
        this.page = null;
        this._lock = Promise.resolve();
        this._lockOwner = null;
        this.sessionFile = opts.sessionFile || DEFAULT_SESSION_FILE;
        this.isIsolated = opts.isIsolated || false;
        this._sessionDir = opts.sessionDir || __dirname;
        _liveInstances.add(this);
    }

    /**
     * Acquire a mutual-exclusion lock so only one forum operation runs at a time.
     * All public methods (login, postTopic, sendPM, etc.) call this first.
     * Returns a unique token; call release(token) to hand the lock back.
     */
    async _acquire(owner = 'unknown') {
        // Global gate first (bounds total concurrency), then the per-instance
        // mutex (serializes each session). Always in this order — the only
        // place both are taken, so no lock-order inversion is possible.
        await _acquireGlobal();
        const token = Symbol('lock-token');
        let release;
        const prev = this._lock;
        this._lock = new Promise((resolve) => { release = resolve; });
        try {
            await prev; // wait for previous holder to finish
        } catch {
            _releaseGlobal();
            throw new Error(`lock interrupted for ${owner}`);
        }
        this._lockOwner = owner;
        console.log(`[FORUM] 🔒 Lock acquired by: ${owner}`);
        return { token, release: () => { this._lockOwner = null; release(token); _releaseGlobal(); } };
    }

    get baseUrl() {
        return process.env.FORUM_BASE_URL || 'http://localhost';
    }

    get username() {
        return process.env.FORUM_USERNAME || '';
    }

    get password() {
        return process.env.FORUM_PASSWORD || '';
    }

    get headless() {
        return process.env.HEADLESS !== 'false'; // default true
    }

    get debug() {
        return process.env.DEBUG === 'true';
    }

    // ── Browser lifecycle ──

    async ensureBrowser() {
        if (this.context && this.page) return;
        _liveInstances.add(this); // re-register after close()

        const browser = await getSharedBrowser();

        const opts = {
            viewport: { width: 1280, height: 900 },
            // Must match the headless-shell major version (149.0.7827.55 at
            // last check): a stale UA against a newer engine (TLS/JA3, Client
            // Hints) is a first-order bot signal to Cloudflare. The .0.0.0
            // suffix is literal — real Chrome sends a frozen UA since reduction.
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
            locale: 'en-US',
            timezoneId: 'America/New_York',
            ignoreHTTPSErrors: true,
            bypassCSP: false,
        };
        if (existsSync(this.sessionFile)) {
            console.log('[FORUM] 📂 Loading stored session from ' + this.sessionFile);
            opts.storageState = this.sessionFile;
        }

        // CDP-attached (persistent daemon) browsers serve browser.newContext()
        // identically — each instance still gets an isolated incognito context.
        this.context = await browser.newContext(opts);
        this.page = await this.context.newPage();

        // Slim the renderer: forum posts/replies need HTML+JS only. Images,
        // fonts, and media burn renderer RAM and slow loads (worse when the
        // box is swapping) without affecting phpBB form fills or the
        // Cloudflare JS challenge. Disable via FORUM_BLOCK_MEDIA=false.
        if (process.env.FORUM_BLOCK_MEDIA !== 'false') {
            await this.page.route('**/*', (route) => {
                const t = route.request().resourceType();
                if (t === 'image' || t === 'media' || t === 'font') return route.abort();
                return route.continue();
            }).catch(() => {});
        }

        // Activity hook — record every navigation so the dashboard can show
        // what the browser is currently doing (scanning, posting, etc).
        const rawGoto = this.page.goto.bind(this.page);
        this.page.goto = async (url, opts) => {
            _touchBrowserActivity(); // real navigation = real forum work
            const act = describeActivity(url);
            logActivity(act.label, act.detail);
            try {
                return await rawGoto(url, opts);
            } finally {
                markActivityDone();
            }
        };

        // Remove webdriver property to avoid detection
        await this.page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        // Override navigator.cookieEnabled to always return true (Cloudflare check)
        await this.page.addInitScript(() => {
            Object.defineProperty(navigator, 'cookieEnabled', { get: () => true, configurable: true });
        });

        if (this.debug) {
            this.page.on('console', (msg) => console.log(`[FORUM PAGE] ${msg.type()}: ${msg.text()}`));
            this.page.on('pageerror', (err) => console.error(`[FORUM PAGE ERROR] ${err.message}`));
        }
    }

    /**
     * Wait for a Cloudflare challenge to resolve.
     * Polls until the page no longer shows Cloudflare challenge HTML.
     */
    async waitForCloudflare(timeoutMs = 45000) {
        // Single gate per navigation chain — a challenge that passed <60s ago
        // (earlier in this same login→post flow) doesn't need re-polling.
        if (Date.now() - _lastCfPassAt < 60000) return true;
        const start = Date.now();
        console.log('[FORUM] ☁️ Waiting for Cloudflare challenge to resolve...');
        while (Date.now() - start < timeoutMs) {
            const isCloudflare = await this.page.evaluate(() => {
                return document.body?.innerHTML?.includes('cf-wrapper') ||
                       document.body?.innerHTML?.includes('challenge-form') ||
                       document.title?.includes('Just a moment');
            }).catch(() => false);

            if (!isCloudflare) {
                console.log(`[FORUM] ✅ Cloudflare challenge passed (${Date.now() - start}ms)`);
                _lastCfPassAt = Date.now();
                return true;
            }
            await this.page.waitForTimeout(1500);
        }
        console.error(`[FORUM] ❌ Cloudflare challenge did not resolve within ${timeoutMs}ms`);
        return false;
    }

    /**
     * Close this instance's browser context and page, releasing resources.
     * Does NOT close the shared browser process — other instances still use it.
     * Call when an isolated client is done (LSSD/DM temp clients).
     */
    async close() {
        // Brief delay to let any in-flight health check page creation finish
        // its stealth plugin hooks before we tear down this context.
        await new Promise(r => setTimeout(r, 1000));
        try {
            if (this.page) await this.page.close().catch(() => {});
            if (this.context) await this.context.close().catch(() => {});
        } catch { /* best effort */ }
        this.page = null;
        this.context = null;
        _liveInstances.delete(this);
    }

    // ── Session ──

    async saveSession() {
        if (!this.context) return;
        const state = await this.context.storageState();
        writeFileSync(this.sessionFile, JSON.stringify(state, null, 2), 'utf-8');
        console.log(`[FORUM] 💾 Session saved to ${this.sessionFile}`);
    }

    hasSession() {
        return existsSync(this.sessionFile);
    }

    /**
     * Validate the current PHMC session is alive. If not, force a fresh login.
     * Call this before any deploy operation to prevent "not permitted" errors from stale sessions.
     */
    async ensureLoggedIn() {
        await this.ensureBrowser();
        const domain = process.env.FORUM_BASE_URL || 'https://phmc.gta.world';
        await this.page.goto(`${domain}/ucp.php`, { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {});
        await this.page.waitForTimeout(2000);
        const stillValid = await this._sessionLooksAlive();
        if (!stillValid) {
            console.log('[FORUM] ⚠️ Session expired — forcing re-login before deploy...');
            await this.login(null, null, { force: true, baseUrl: domain });
        } else {
            console.log('[FORUM] ✅ Session valid');
        }
    }

    /**
     * True session check: phpBB can serve the login form AT ucp.php WITHOUT
     * redirecting, so URL-only checks false-positive (proven live — downstream
     * compose then renders its own login page and everything fails). Check
     * the URL, the title, AND the actual username field.
     */
    async _sessionLooksAlive() {
        try {
            if (this.page.url().includes('mode=login')) return false;
            const title = await this.page.title().catch(() => '');
            if (title.toLowerCase().includes('login')) return false;
            const hasLoginForm = await this.page.evaluate(
                () => !!document.querySelector('input[name="username"]')
            ).catch(() => false);
            return !hasLoginForm;
        } catch {
            return false;
        }
    }

    // ── Authentication ──

    async login(overrideUsername, overridePassword, { force = false, baseUrl: baseUrlOverride } = {}) {
        const lock = await this._acquire('login');
        try {
        await this.ensureBrowser();

        const username = overrideUsername || this.username;
        const password = overridePassword || this.password;

        if (!username || !password) {
            console.error(`[FORUM] ❌ Credentials check failed — FORUM_USERNAME="${this.username}" FORUM_PASSWORD="${this.password ? '(set)' : '(empty)'}"`);
            console.error(`[FORUM] ❌ Env keys available: FORUM_USERNAME=${!!process.env.FORUM_USERNAME} FORUM_PASSWORD=${!!process.env.FORUM_PASSWORD}`);
            throw new Error('No forum credentials provided. Set FORUM_USERNAME / FORUM_PASSWORD in .env or pass them inline.');
        }

        // Use the override domain if provided (e.g. for cross-domain posting)
        const domain = baseUrlOverride || this.baseUrl;
        console.log(`[FORUM] 🌐 Contacting forum (domain: ${domain})${force ? ' [force login]' : ''}`);

        // Hit index first to pass any Cloudflare challenge
        await this.page.goto(`${domain}/index.php`, { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {});
        await this.page.waitForTimeout(3000);
        await this.waitForCloudflare(120000);

        // If not forcing, check if already logged in via stored session.
        // (URL + title + form check — see _sessionLooksAlive. URL alone lies
        // when phpBB serves the login form without redirecting.)
        let fellThroughSessionCheck = false;
        if (!force) {
            await this.page.goto(`${domain}/ucp.php`, { waitUntil: 'networkidle', timeout: 180000 });
            await this.page.waitForTimeout(2000);

            if (await this._sessionLooksAlive()) {
                console.log('[FORUM] ✅ Already logged in via stored session');
                return { ok: true, method: 'session' };
            }
            console.log('[FORUM] ⚠️ Stored session invalid — logging in...');
            fellThroughSessionCheck = true;
        }

        // Fill login form
        console.log('[FORUM] 🔑 Logging in...');
        // Navigate to login page explicitly before filling
        await this.page.goto(`${domain}/ucp.php?mode=login`, { waitUntil: 'networkidle', timeout: 180000 });
        await this.page.waitForTimeout(2000);

        // Debug: dump page state after navigation
        const loginUrl = this.page.url();
        const loginTitle = await this.page.title().catch(() => '(no title)');
        console.log(`[FORUM] 🔍 After login nav: "${loginTitle}" — ${loginUrl}`);

        // If we were redirected away from the login page, we might already be logged in
        if (!loginUrl.includes('mode=login') && !loginUrl.includes('login')) {
            // Try hitting the profile page to confirm we're authenticated
            await this.page.goto(`${domain}/ucp.php`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
            const profileUrl = this.page.url();
            console.log(`[FORUM] 🔍 UCP redirects to: ${profileUrl}`);
            if (!profileUrl.includes('mode=login')) {
                console.log('[FORUM] ✅ Already logged in (redirected away from login page)');
                await this.saveSession();
                return { ok: true, method: 'session' };
            }
        }

        // Check if the username field exists on the current page
        const hasUsernameField = await this.page.evaluate(() => {
            return !!document.querySelector('input[name="username"]');
        });

        if (!hasUsernameField) {
            const loginUrl = this.page.url();
            const loginTitle = await this.page.title().catch(() => '(no title)');
            const pageHtml = await this.page.evaluate(() => document.documentElement?.outerHTML || '(no html)').catch(() => '(error)');
            const snippet = pageHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300).trim();

            // Save full HTML to debug file
            const debugPath = resolve(__dirname, '..', 'debug', 'debug-login-page.html');
            mkdirSync(dirname(debugPath), { recursive: true });
            writeFileSync(debugPath, pageHtml, 'utf-8');

            console.error(`[FORUM] ❌ Login failed — URL: ${loginUrl} Title: "${loginTitle}"`);
            console.error(`[FORUM] 🔍 Page text snippet: "${snippet}..."`);
            console.error(`[FORUM] 💾 Full HTML saved to ${debugPath}`);

            // Check if this is a Cloudflare origin error (522, 524, etc.) and notify the owner
            const cfErrorMatch = loginTitle.match(/\b(5\d{2})\b/) || pageHtml.match(/Error code (5\d{2})/);
            if (cfErrorMatch) {
                const code = cfErrorMatch[1];
                notifyOwner(
                    `⚠️ **Forum is returning Cloudflare ${code}** — the origin server appears to be down or unreachable.\n` +
                    `The bot cannot log in until the forum is back online.\n` +
                    `_Last attempt:_ ${loginTitle}`
                );
            }

            throw new Error(
                `Login page (${loginUrl}) has no username field. Title: "${loginTitle}". ` +
                `Text: "${snippet}..." HTML saved to debug-login-page.html`
            );
        }

        try {
            await this.page.fill('input[name="username"]', username, { timeout: 10000 });
            await this.page.fill('input[name="password"]', password, { timeout: 10000 });
        } catch (fillErr) {
            console.error(`[FORUM] ❌ Failed to fill login form — ${fillErr.message}`);
            console.error(`[FORUM] 🔍 Login page HTML (first 3000 chars):`);
            const pageHtml = await this.page.evaluate(() => document.body?.innerHTML?.slice(0, 3000) || '(no body)').catch(() => '(error)');
            console.log(pageHtml);
            throw fillErr;
        }

        await this.page.evaluate(() => {
            const btn = document.querySelector('input[type="submit"]') || document.querySelector('button[type="submit"]');
            if (btn) btn.click();
        });

        // Wait for the form POST navigation to complete (up to 20s)
        try {
            await this.page.waitForLoadState('networkidle', { timeout: 20000 });
        } catch {
            console.log('[FORUM] ⏳ Login POST navigation timeout — checking URL anyway');
        }
        await this.page.waitForTimeout(2000);

        if (this.page.url().includes('mode=login')) {
            const errText = await this.page.locator('.error, .notification, .alert, #message').first().textContent().catch(() => '(no error element)');

            // Dump full page HTML for debugging login failures
            const debugHtml = await this.page.content().catch(() => '(unable to capture page content)');
            const debugPath = resolve(__dirname, '..', 'debug', 'debug-login-page.html');
            mkdirSync(dirname(debugPath), { recursive: true });
            writeFileSync(debugPath, debugHtml, 'utf-8');
            console.error(`[FORUM] ❌ Login failed — "${errText}" — HTML saved to ${debugPath}`);

            throw new Error(`Login failed: ${errText}`);
        }

        console.log('[FORUM] ✅ Login response OK — verifying the session actually established...');
        // A challenge interstitial or odd redirect can pass the URL check
        // above without logging in — the next op would then fail mysteriously
        // on a login page. Verify like ensureLoggedIn does before declaring OK.
        await this.page.goto(`${domain}/ucp.php`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
        await this.page.waitForTimeout(2000);
        if (!(await this._sessionLooksAlive())) {
            throw new Error('Login failed: session did not establish (verify shows login form)');
        }

        console.log('[FORUM] ✅ Login successful');
        await this.saveSession();
        // Fell through from a dead stored session: record the refresh so
        // session churn is visible (dashboard) before it causes failures.
        // Routine session reuse and explicit force-logins stay quiet.
        if (fellThroughSessionCheck) {
            await recordAuthEvent(domain, 'refreshed').catch(() => {});
        }
        } catch (err) {
            // Login failures feed the auth tracker (dashboard-visible churn).
            await recordAuthEvent(baseUrlOverride || this.baseUrl, 'failed').catch(() => {});
            throw err;
        } finally { lock.release(); }
        return { ok: true, method: 'credentials' };
    }

    // ── Topic Posting ──

    async postTopic(forumId, subject, bbCode, forumUrlOverride) {
        const lock = await this._acquire('postTopic');
        let ok;
        let url;
        try {
        await this.ensureBrowser();
        console.log(`[FORUM] 📝 Posting new topic to forum ${forumId}: "${subject}"`);

        const postUrl = forumUrlOverride || `${this.baseUrl}/posting.php?mode=post&f=${forumId}`;
        console.log(`[FORUM] 🌐 Navigating to ${postUrl}`);
        await this.page.goto(postUrl, { waitUntil: 'networkidle', timeout: 180000 });
        await this.page.waitForTimeout(2000);
        // Cloudflare can challenge ANY navigation (not just login) — the
        // posting form doesn't exist until it resolves. Without this wait a
        // challenged load fails fast with "No form found".
        await this.waitForCloudflare(120000);

        // Check if we got redirected to a login page (session expired) BEFORE filling form
        const pageUrl = this.page.url();
        let pageTitle = await this.page.title().catch(() => '(no title)');
        if (pageUrl.includes('mode=login') || pageTitle.toLowerCase().includes('login')) {
            console.log(`[FORUM] ⚠️ Login page detected — session expired, logging in directly...`);
            if (!_credsMatchDomain(this, postUrl)) {
                throw new Error(`Session expired on ${postUrl} — caller must login() with that forum's credentials first (this client holds ${this.baseUrl} credentials)`);
            }
            // Fill and submit the login form directly on this page (no lock re-entry)
            await this.page.fill('input[name="username"]', this.username, { timeout: 10000 });
            await this.page.fill('input[name="password"]', this.password, { timeout: 10000 });
            await this.page.evaluate(() => {
                const btn = document.querySelector('input[type="submit"]') || document.querySelector('button[type="submit"]');
                if (btn) btn.click();
            });
            await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
            await this.page.waitForTimeout(3000);
            // Save the new session for future use
            await this.saveSession();
            pageTitle = await this.page.title().catch(() => '(no title)');
            console.log(`[FORUM] 🔍 After re-login — page title: "${pageTitle}", URL: ${this.page.url()}`);

            // Wait for the posting form to fully render after login redirect
            await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
            await this.page.waitForTimeout(2000);
        }

        await this.page.waitForTimeout(1000);

        // Fill subject and message with TRUSTED input (now we're definitely on the posting page, not login)
        await trustedFill(this.page, 'input[name="subject"]', subject);
        await trustedFillMessage(this.page, bbCode);
        await this.page.waitForTimeout(500);

        // Debug: dump page state
        const pageHtml = await this.page.evaluate(() => document.body?.innerHTML?.slice(0, 3000) || '(no body)').catch(() => '(error reading HTML)');
        console.log(`[FORUM] 🔍 Page URL: ${this.page.url()}`);
        console.log(`[FORUM] 🔍 Page title: ${pageTitle}`);

        // Submit (trusted click)
        // Proactive flood pacing: per-account 30s gap before clicking submit.
        // The reactive 25s×3 retry loop below stays untouched as backstop.
        await _paceSubmitBeforeClick(`${postUrl.split('/posting.php')[0]}|${this.username}`);
        const result = await trustedSubmitClick(this.page, 'posting.php', [
            'input[type="submit"][name="post"]',
            'input[type="submit"][value="Submit"]',
            'button[type="submit"][name="post"]',
        ]);

        if (!result.ok) {
            console.log(`[FORUM] ❌ ${result.reason} — dumping page state`);
            console.log(`[FORUM] 🔍 HTML snippet (first 2000 chars):`);
            console.log(pageHtml.slice(0, 2000));
            const allForms = await this.page.evaluate(() =>
                Array.from(document.querySelectorAll('form')).map(f => ({
                    action: f.action || f.getAttribute('action'),
                    id: f.id,
                    method: f.method,
                    className: f.className,
                }))
            ).catch(() => []);
            console.log(`[FORUM] 🔍 All forms on page (${allForms.length}):`, JSON.stringify(allForms, null, 2));
            await dumpPageState(this.page, 'posting-page');
            throw new Error(result.reason);
        }

        await this.page.waitForTimeout(3000);
        // Wait for post-submit navigation — Cloudflare or slow phpBB needs time
        try {
            await this.page.waitForLoadState('networkidle', { timeout: 25000 });
        } catch {
            console.log('[FORUM] ⏳ Network did not reach idle after topic submit — checking URL anyway');
        }
        await this.page.waitForTimeout(2000);
        url = this.page.url();
        ok = url.includes('viewtopic.php');

        // ── Flood control / stale form token handling ──
        // Same as replyToTopic: phpBB rejects rapid consecutive posts from the same
        // account. If the submit bounced with a flood or invalid-form error, wait out
        // the flood window, reload the form (fresh token), refill, and resubmit.
        const FLOOD_WAIT_MS = 25000;
        const MAX_FLOOD_RETRIES = 3;

        const detectSubmitError = async () => {
            const text = await this.page.evaluate(() => document.body.innerText || '').catch(() => '');
            if (/cannot make another post so soon after your last/i.test(text)) return 'flood';
            if (/submitted form was invalid/i.test(text)) return 'stale-token';
            return null;
        };

        const reloadAndResubmit = async () => {
            try { await this.page.goto(postUrl, { waitUntil: 'networkidle', timeout: 180000 }); } catch { /* [OK] nav-timeout ignored: refill + resubmit proceeds anyway; outcome verified via URL below */ }
            await this.page.waitForTimeout(2000);
            await trustedFill(this.page, 'input[name="subject"]', subject);
            await trustedFillMessage(this.page, bbCode);
            await this.page.waitForTimeout(500);
            await trustedSubmitClick(this.page, 'posting.php', [
                'input[type="submit"][name="post"]',
                'input[type="submit"][value="Submit"]',
                'button[type="submit"][name="post"]',
            ]);
            await this.page.waitForTimeout(3000);
            try { await this.page.waitForLoadState('networkidle', { timeout: 25000 }); } catch { /* [OK] load-wait timeout ignored: timing hint only; submit outcome verified via URL below */ }
            await this.page.waitForTimeout(2000);
        };

        for (let attempt = 1; attempt <= MAX_FLOOD_RETRIES; attempt++) {
            const errType = await detectSubmitError();
            if (!errType) break;

            if (errType === 'flood') {
                console.log(`[FORUM] ⚠️ FLOOD ENCOUNTERED, WAITING ${FLOOD_WAIT_MS / 1000}s before retry (attempt ${attempt}/${MAX_FLOOD_RETRIES})...`);
                await this.page.waitForTimeout(FLOOD_WAIT_MS);
            } else {
                console.log(`[FORUM] ⚠️ Stale form token detected — reloading form (attempt ${attempt}/${MAX_FLOOD_RETRIES})...`);
            }

            await reloadAndResubmit();
            url = this.page.url();
            if (url.includes('viewtopic.php')) { ok = true; break; }
        }

        // Handle phpBB preview: still on posting.php after submit
        if (!ok && url.includes('posting.php')) {
            console.log(`[FORUM] 🔄 Topic preview detected — re-submitting...`);

            // Try clicking submit again
            try {
                await this.page.evaluate(() => {
                    const form = document.querySelector('form[action*="posting.php"]');
                    if (!form) return false;
                    const btn = form.querySelector(
                        'input[type="submit"][name="post"], ' +
                        'button[type="submit"][name="post"]'
                    );
                    if (!btn) return false;
                    btn.click();
                    return true;
                });
                await Promise.race([
                    this.page.waitForNavigation({ timeout: 20000 }),
                    this.page.waitForTimeout(20000),
                ]);
            } catch { /* [OK] preview-resubmit nav timeout ignored: url re-checked below, falls through to alternative selectors */ }
            url = this.page.url();
            ok = url.includes('viewtopic.php');

            // If still on posting, try alternative selectors
            if (!ok && url.includes('posting.php')) {
                console.log(`[FORUM] 🔄 Topic still on posting page — trying alternative selectors...`);
                try {
                    await this.page.evaluate(() => {
                        const btn =
                            document.querySelector('#postform input[type="submit"][name="post"]') ||
                            document.querySelector('input[type="submit"][value="Submit"]') ||
                            document.querySelector('input[type="submit"][accesskey="s"]') ||
                            document.querySelector('button[type="submit"][name="post"]') ||
                            document.querySelector('input[name="post"][tabindex]');
                        if (btn) { btn.click(); return true; }
                        const form = document.querySelector('form[action*="posting.php"]');
                        if (form) { form.submit(); }
                        return false;
                    });
                    await Promise.race([
                        this.page.waitForNavigation({ timeout: 20000 }),
                        this.page.waitForTimeout(20000),
                    ]);
                } catch { /* [OK] alt-selector resubmit nav timeout ignored: url re-checked below, falls through to success-text check */ }
                url = this.page.url();
                ok = url.includes('viewtopic.php');
            }

            // Final check: look for success text
            if (!ok) {
                try { await this.page.waitForTimeout(10000); } catch { /* [OK] settle-wait ignored: page may be closed; url + success-text checks below still run */ }
                url = this.page.url();
                ok = url.includes('viewtopic.php');
                if (!ok) {
                    const pageText = await this.page.evaluate(() => document.body.innerText || '').catch(() => '');
                    if (pageText.includes('posted successfully') || pageText.includes('Your message has been sent') || pageText.includes('has been submitted')) {
                        console.log(`[FORUM] ✅ Topic page content indicates success despite URL`);
                        ok = true;
                    }
                }
            }
        }

        } finally { lock.release(); }
        return {
            ok,
            url: ok ? url : null,
            title: subject,
        };
    }

    // ── Private Message ──

    async sendPM(recipient, subject, bbCode, { baseUrl: baseUrlOverride, dryRun = false } = {}) {
        const lock = await this._acquire('sendPM');
        let ok;
        let finalUrl;
        let reason = null;
        try {
        await this.ensureBrowser();

        const domain = baseUrlOverride || this.baseUrl;
        console.log(`[FORUM] ✉️ Sending PM to ${recipient}: "${subject}" (via ${domain})`);

        // If using a cross-domain override, just ensure the browser context has cookies for it.
        // Don't force-login — deployPMs already logged in upstream.
        if (baseUrlOverride) {
            console.log(`[FORUM] 🔑 Cross-domain PM — already logged in upstream, navigating directly`);
        }

        const composeUrl = `${domain}/ucp.php?i=pm&mode=compose&username_list=${encodeURIComponent(recipient)}`;
        console.log(`[FORUM] 🌐 Navigating to ${composeUrl}`);
        await this.page.goto(composeUrl, { waitUntil: 'networkidle', timeout: 180000 });
        await this.page.waitForTimeout(3000);
        // Same as postTopic: a challenged compose page has no PM form until
        // Cloudflare resolves.
        await this.waitForCloudflare(120000);

        // Debug: log page state
        const pageUrl = this.page.url();
        const pageTitle = await this.page.title().catch(() => '(no title)');
        console.log(`[FORUM] 🔍 PM page: ${pageTitle} — ${pageUrl}`);

        // ── Recipient handling (three theme shapes) ──
        // 1. URL param worked (field preset / address present) → proceed.
        // 2. Visible username_list input, empty (LSPD) → fill + Add flow.
        // 3. No input at all (SADCR: "Find a member" popup only) → resolve the
        //    user ID via memberlist search and re-open compose with &u=<id>.
        // This runs BEFORE subject/message fill (Add / re-navigate reloads).
        const recipientState = await this.page.evaluate((name) => {
            // phpBB themes vary: username_list is an <input> on some forums,
            // a <textarea> on others (e.g. LSSD) — check both, else the field
            // is wrongly reported missing and we take the ID round-trip.
            const input = document.querySelector('input[name="username_list"]') || document.querySelector('textarea[name="username_list"]');
            if (input && input.value && input.value.trim()) return 'preset';
            const addr = document.querySelector('input[name^="address_list"], input[name="to"], .to-field, .address-list');
            if (addr) {
                const t = (addr.value !== undefined ? addr.value : addr.innerText) || '';
                if (String(t).toLowerCase().includes(name.toLowerCase())) return 'preset';
            }
            if (input) return 'needs-add';
            return 'no-field';
        }, recipient).catch(() => 'error');
        if (recipientState === 'preset') {
            console.log(`[FORUM] ✅ Recipient preset: ${recipient}`);
        } else if (recipientState === 'needs-add') {
            await this.page.evaluate((name) => {
                const input = document.querySelector('input[name="username_list"]') || document.querySelector('textarea[name="username_list"]');
                if (input) { input.value = name; input.dispatchEvent(new Event('input', { bubbles: true })); }
                const addBtn = document.querySelector('input[type="submit"][name="add_to"], button[type="submit"][name="add_to"]');
                if (addBtn) addBtn.click();
            }, recipient).catch(() => {});
            try { await this.page.waitForLoadState('networkidle', { timeout: 25000 }); } catch {
                console.log('[FORUM] ⏳ Network did not reach idle after recipient Add — checking anyway');
            }
            await this.page.waitForTimeout(2000);
            const accepted = await this.page.evaluate((name) => {
                const t = document.body?.innerText || '';
                return t.includes(name);
            }, recipient).catch(() => false);
            if (!accepted) {
                reason = `Recipient "${recipient}" was not accepted by the forum (username may not exist)`;
                throw new Error(reason);
            }
            console.log(`[FORUM] ✅ Recipient added: ${recipient}`);
        } else if (recipientState === 'no-field') {
            // Roster file first (exact match only): the 12h sync banks every
            // member + ID locally, and live memberlist search is broken on
            // some themes (SADCR returns nothing). Fuzzy stays an explicit
            // orchestrator decision — sendPM never guesses on its own.
            // NOTE: lock-free inner call — sendPM already holds this lock.
            let resolved = null;
            const rKey = rosterKeyForBaseUrl(domain);
            if (rKey) {
                const m = matchRosterFile(rKey, recipient, 1);
                if (m && m.userId) {
                    console.log(`[FORUM] 👤 Roster exact: "${recipient}" -> id ${m.userId} ("${m.username}")`);
                    resolved = { userId: m.userId, username: m.username };
                }
            }
            if (!resolved) {
                resolved = await this._resolveMemberUserIdInner([recipient], { baseUrl: domain }).catch(() => null);
            }
            if (!resolved) {
                reason = `Recipient "${recipient}" not found on this forum (memberlist search)`;
                throw new Error(reason);
            }
            console.log(`[FORUM] 🔄 Re-opening compose addressed by user ID ${resolved.userId}`);
            await this.page.goto(`${domain}/ucp.php?i=pm&mode=compose&u=${resolved.userId}`, { waitUntil: 'networkidle', timeout: 180000 }).catch(() => {});
            await this.page.waitForTimeout(2000);
            // Same as the first compose load: a challenge here means no
            // addressee box until it resolves (present-check would false-fail).
            await this.waitForCloudflare(120000);
            const present = await this.page.evaluate((name) => {
                const t = document.body?.innerText || '';
                return t.includes(name);
            }, resolved.username).catch(() => false);
            if (!present) {
                reason = `Recipient "${recipient}" (id ${resolved.userId}) did not stick on compose`;
                throw new Error(reason);
            }
            console.log(`[FORUM] ✅ Recipient addressed by ID: ${resolved.username}`);
        } else {
            reason = `Recipient setup failed (${recipientState}) for "${recipient}"`;
            throw new Error(reason);
        }

        // Fill subject (trusted input)
        await trustedFill(this.page, 'input[name="subject"]', subject);

        // Fill message (trusted input)
        const msgOk = await trustedFillMessage(this.page, bbCode);

        if (!msgOk) {
            console.error(`[FORUM] ❌ No message textarea or editor found — dumping full page HTML`);
            const fullHtml = await this.page.evaluate(() => document.documentElement?.outerHTML || '(no html)').catch(() => '(error)');
            const snippet = fullHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300).trim();
            const debugPath = resolve(__dirname, '..', 'debug', 'debug-pm-page.html');
            mkdirSync(dirname(debugPath), { recursive: true });
            writeFileSync(debugPath, fullHtml, 'utf-8');
            console.log(`[FORUM] 🔍 Page text snippet: "${snippet}..."`);
            console.log(`[FORUM] 🔍 Page URL: ${this.page.url()}`);
            const pageTitle = await this.page.title().catch(() => '(no title)');
            console.log(`[FORUM] 🔍 Page title: "${pageTitle}"`);
            console.log(`[FORUM] 💾 Full HTML saved to ${debugPath}`);
            throw new Error(`No message textarea or editor found on PM compose page. Page: "${pageTitle}" — URL: ${this.page.url()} — HTML saved to debug-pm-page.html`);
        }

        console.log(`[FORUM] ✅ Form filled (${bbCode.length} chars)`);
        await this.page.waitForTimeout(1000);

        if (dryRun) {
            console.log(`[FORUM] 🏜️ DRY RUN — form filled but not submitted. Set dryRun=false to enable.`);
            return { ok: true, url: composeUrl, dryRun: true };
        }

        // Submit (trusted click)
        console.log(`[FORUM] 📤 Submitting PM form...`);
        // Proactive flood pacing: per-account 30s gap before clicking submit.
        await _paceSubmitBeforeClick(`${domain}|${this.username}`);
        const result = await trustedSubmitClick(this.page, 'ucp.php', [
            'input[type="submit"][name="submit"]',
            'input[type="submit"][value="Submit"]',
            'button[type="submit"][name="post"]',
            'button[type="submit"][value="Submit"]',
        ]);

        if (!result.ok) {
            const pageHtml = await this.page.evaluate(() => document.body?.innerHTML?.slice(0, 3000) || '(no body)').catch(() => '(error reading HTML)');
            console.error(`[FORUM] ❌ ${result.reason} — dumping page state`);
            console.log(`[FORUM] 🔍 HTML snippet (first 2000 chars):`);
            console.log(pageHtml.slice(0, 2000));
            await dumpPageState(this.page, 'pm-submit-page');
            throw new Error(result.reason);
        }

        await this.page.waitForTimeout(3000);
        // Wait for post-submit navigation — Cloudflare / slow phpBB needs time
        try {
            await this.page.waitForLoadState('networkidle', { timeout: 25000 });
        } catch {
            console.log('[FORUM] ⏳ Network did not reach idle after PM submit — checking URL anyway');
        }
        await this.page.waitForTimeout(2000);
        finalUrl = this.page.url();
        ok = finalUrl.includes('&msg=') || finalUrl.includes('mode=view') || !finalUrl.includes('mode=compose');

        // ── Handle phpBB Preview Step ──
        // phpBB shows a preview page before the actual send.
        // If we're still on compose with action=post, look for a preview box and re-submit.
        if (!ok && finalUrl.includes('action=post')) {
            // Check for error messages on the page before assuming it's a clean preview
            const errorText = await this.page.evaluate(() => {
                const errEl = document.querySelector('.error, .notification.error, .alert-error');
                return errEl ? errEl.textContent.trim() : null;
            }).catch(() => null);
            if (errorText) {
                console.warn(`[FORUM] ⚠️ PM form has error: "${errorText}" — will retry submit`);
                // Playwright evaluate only accepts ONE argument. Pass object for multiple values.
                await this.page.evaluate(({ subj }) => {
                    const subjEl = document.querySelector('input[name="subject"]');
                    if (subjEl) { subjEl.dispatchEvent(new Event('input', { bubbles: true })); }
                }, { subj: subject });
                await this.page.waitForTimeout(1000);
            } else {
                console.log(`[FORUM] 🔄 Preview detected — clicking final Submit...`);
            }

            await this.page.waitForTimeout(1000);

            const previewResult = await this.page.evaluate(() => {
                // Try to find the actual submit on the preview page
                const form = document.querySelector('form[action*="ucp.php"]');
                if (!form) return { ok: false, reason: 'No form on preview' };
                const btn = form.querySelector(
                    'input[type="submit"][name="post"][accesskey="s"], ' +
                    'input[type="submit"][value="Submit"], ' +
                    'button[type="submit"][name="post"]'
                );
                if (!btn) return { ok: false, reason: 'No submit button on preview' };
                btn.click();
                return { ok: true };
            });

            if (!previewResult.ok) {
                console.log(`[FORUM] ❌ Preview submit: ${previewResult.reason}`);
            } else {
                // Wait for navigation after preview submit
                try {
                    await this.page.waitForLoadState('networkidle', { timeout: 25000 });
                } catch {
                    console.log('[FORUM] ⏳ Network did not reach idle after preview submit');
                }
                await this.page.waitForTimeout(3000);
            }

            // Re-check URL after preview submit
            const postPreviewUrl = this.page.url();
            ok = postPreviewUrl.includes('&msg=') || postPreviewUrl.includes('mode=view') || !postPreviewUrl.includes('mode=compose');
            console.log(`[FORUM] 📬 Post-preview URL: ${postPreviewUrl} — ${ok ? '✅ Sent' : '⚠️ Still on compose'}`);
        }

        // ── Final success check: look for success text on page ──
        // Some forums (like LSSD) don't redirect after successful PM send,
        // but show a "sent successfully" message on the same compose page.
        if (!ok) {
            const successText = await this.page.evaluate(() => {
                const body = document.body?.innerText || '';
                const match = body.match(/sent successfully/i);
                return match ? match[0] : null;
            }).catch(() => null);
            if (successText) {
                console.log(`[FORUM] ✅ Found "${successText}" on page — marking as sent`);
                ok = true;
            }

            // Also check for error messages and log them clearly
            if (!ok) {
                const errMsg = await this.page.evaluate(() => {
                    const errEl = document.querySelector('.error, .notification.error, .alert-error, .alert-danger');
                    return errEl ? errEl.textContent.trim().replace(/\s+/g, ' ').slice(0, 300) : null;
                }).catch(() => null);
                if (errMsg) {
                    console.warn(`[FORUM] ❌ PM error detected: "${errMsg}"`);
                    reason = errMsg;
                } else {
                    reason = 'PM stayed on the compose page with no success confirmation';
                }
            }
        }

        if (!ok) {
            const pageTitle = await this.page.title().catch(() => '(no title)');
            console.log(`[FORUM] ⚠️ PM submit landed on: "${pageTitle}" — ${finalUrl}`);

            // Save full HTML dump for debugging (always on failure)
            const debugHtml = await this.page.evaluate(() => document.documentElement?.outerHTML || '(no html)').catch(() => '(error)');
            const debugPath = resolve(__dirname, '..', 'debug', 'debug-pm-page.html');
            mkdirSync(dirname(debugPath), { recursive: true });
            writeFileSync(debugPath, debugHtml, 'utf-8');
            console.log(`[FORUM] 💾 Full page HTML saved to ${debugPath} for debugging`);
        }

        console.log(`[FORUM] 📬 PM result: ${ok ? '✅ Sent' : `⚠️ ${reason || 'Unknown'}`} — ${finalUrl}`);
        } finally { lock.release(); }

        return {
            ok,
            url: ok ? finalUrl : null,
            recipient,
            subject,
            reason: ok ? null : (reason || 'Unknown'),
        };
    }

    // ── Medical Record Search & Reply ──

    /**
     * Search the PHMC Medical Records forum (f=97) for a patient by their patientID.
     * @param {string} patientID - e.g. "0192"
     * @returns {Promise<{topicId: number|null, title: string|null}>}
     */
    async searchForPatientTopic(patientID) {
        const lock = await this._acquire('searchForPatientTopic');
        let result = { topicId: null, title: null };
        let _candidates = []; // hoisted outside try block for return access
        try {
        await this.ensureBrowser();

        const searchUrl = `https://phmc.gta.world/search.php?keywords=${encodeURIComponent(patientID)}&fid[]=97&sf=all`;
        console.log(`[FORUM] 🔍 Searching for patientID "${patientID}"...`);
        console.log(`[FORUM] 🌐 ${searchUrl}`);

        await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await this.page.waitForTimeout(2000);

        const pageUrl = this.page.url();
        const pageTitle = await this.page.title().catch(() => '(no title)');
        console.log(`[FORUM] 🔍 Search page: "${pageTitle}" — ${pageUrl}`);

        // Check if no results
        const noResults = await this.page.evaluate(() =>
            document.body?.innerText?.includes('No suitable matches were found') ?? false
        ).catch(() => false);

        if (noResults) {
            console.log(`[FORUM] 📭 No existing thread found for patientID "${patientID}"`);
            return result;
        }

        // Collect candidate topic links from search results.
        // Use a[href*="viewtopic.php"] (no topictitle class in this phpBB version),
        // then filter to only keep links that reference a topic (t=) and not a specific post (p=).
        // This avoids matching "Re:" replies, "Jump to post" links, or post body references.
        _candidates = await this.page.evaluate((searchId) => {
            const links = document.querySelectorAll('a[href*="viewtopic.php"]');
            const results = [];
            for (const link of links) {
                const href = link.getAttribute('href') || '';
                const text = link.textContent?.trim() || '';
                // Skip post-specific links (p=) and navigation links
                if (href.includes('p=') || text === 'Jump to post' || text.startsWith('Re:')) continue;
                const match = href.match(/[?&]t=(\d+)/);
                if (match && !results.some(r => r.topicId === parseInt(match[1], 10))) {
                    results.push({
                        topicId: parseInt(match[1], 10),
                        title: text || null,
                        href,
                    });
                }
            }
            return results;
        }).catch(() => []);

        // Debug: log every candidate result
        console.log(`[FORUM] 🔍 Search for "${patientID}" — ${_candidates.length} candidate topic(s) found`);
        for (const c of _candidates) {
            console.log(`[FORUM]   Candidate: #${c.topicId} — "${c.title}"`);
        }

        // Filter: first try exact title match, then all-words match
        const searchLower = patientID.toLowerCase();
        const searchWords = searchLower.split(/\s+/).filter(w => w.length > 2);

        result = _candidates.find(c => c.title?.includes(patientID)) || null;
        if (result) {
            console.log(`[FORUM] ✅ Exact match: #${result.topicId} — "${result.title}"`);
        } else {
            // Fallback: all significant words must appear in the title
            // This prevents "David Tao" from matching "Nicole Tao" (shared last name)
            result = _candidates.find(c => {
                if (!c.title) return false;
                const t = c.title.toLowerCase();
                return searchWords.length > 0 && searchWords.every(w => t.includes(w));
            }) || null;
            if (result) {
                console.log(`[FORUM] ✅ Word-match: #${result.topicId} — "${result.title}"`);
            } else {
                console.log(`[FORUM] ⚠️ No candidate matched all search words: [${searchWords.join(', ')}]`);
            }
        }

        if (result?.topicId) {
            console.log(`[FORUM] ✅ Found topic #${result.topicId}: "${result.title}"`);
        } else {
            console.log('[FORUM] ⚠️ Search returned results but could not parse topic link');
        }
        } finally { lock.release(); }

        return { ...(result || { topicId: null, title: null }), candidates: _candidates };
    }

    /**
     * Search any phpBB forum by keyword. Generic alternative to searchForPatientTopic / searchCaseManagement.
     *
     * @param {string} searchTerm - Keyword to search for
     * @param {number|string} forumId - Forum section ID to search in
     * @param {object} [options]
     * @param {string} [options.baseUrl] - Forum base URL (defaults to phmc.gta.world)
     * @returns {Promise<Array<{topicId: number, title: string}>>}
     */
    async searchForum(searchTerm, forumId, { baseUrl } = {}) {
        const lock = await this._acquire('searchForum');
        try {
            await this.ensureBrowser();
            const domain = baseUrl || this.baseUrl;
            const encoded = encodeURIComponent(searchTerm);
            const forumFilter = forumId != null ? `&fid[]=${forumId}` : '';
            const searchUrl = `${domain}/search.php?keywords=${encoded}&terms=all${forumFilter}&sc=1&sf=all&sr=posts&sk=t&sd=d&st=0&ch=300&t=0&submit=Search`;

            console.log(`[FORUM] 🔍 Searching ${forumId ? `forum f=${forumId}` : 'all forums'} for "${searchTerm}"...`);
            console.log(`[FORUM] 🌐 URL: ${searchUrl}`);
            try {
                await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            } catch (navErr) {
                console.log(`[FORUM] ⚠️ Navigation error (${navErr.message}), retrying with lenient wait...`);
                await this.page.goto(searchUrl, { waitUntil: 'load', timeout: 60000 });
            }
            await this.page.waitForTimeout(2000);

            const pageTitle = await this.page.title().catch(() => '(no title)');
            const finalUrl = this.page.url();
            console.log(`[FORUM] 📄 Page: "${pageTitle}" — ${finalUrl}`);

            // Debug: check page content for understanding what the search returned
            const pageText = await this.page.evaluate(() => document.body?.innerText?.slice(0, 500) || '').catch(() => '');
            const pageHtmlSnippet = await this.page.evaluate(() => document.body?.innerHTML?.slice(0, 3000) || '').catch(() => '');
            const hasNoResults = pageText.includes('No suitable matches were found');
            const hasViewtopicLinks = pageHtmlSnippet.includes('viewtopic.php');

            if (hasNoResults && !hasViewtopicLinks) {
                console.log(`[FORUM] 📭 No results for "${searchTerm}" in f=${forumId}`);
                console.log(`[FORUM] 🔍 Page text preview: "${pageText.slice(0, 200)}"`);
                return [];
            }

            // If we get here but saw "no results" text, the page might have both — log it
            if (hasNoResults) {
                console.log(`[FORUM] ⚠️ 'No results' text found but viewtopic links exist — parsing anyway`);
            }

            // Log all visible topic titles for debugging (try multiple selectors for different phpBB themes)
            const allTitles = await this.page.evaluate(() => {
                const selectors = 'a.topictitle, a.topictitle2, a[href*="viewtopic.php"], .topictitle a';
                const links = document.querySelectorAll(selectors);
                return Array.from(links).map(a => ({ href: a.getAttribute('href') || '', text: a.textContent?.trim() || '' }));
            }).catch(() => []);
            console.log(`[FORUM] 📋 Raw results (${allTitles.length}): ${allTitles.map(t => `"${t.text}"`).join(', ') || 'none'}`);

            const results = await this.page.evaluate((term) => {
                const found = [];
                const selectors = 'a.topictitle, a.topictitle2, a[href*="viewtopic.php"], .topictitle a';
                const links = document.querySelectorAll(selectors);
                links.forEach((link) => {
                    const href = link.getAttribute('href') || '';
                    const match = href.match(/[?&]t=(\d+)/);
                    if (match) {
                        found.push({
                            topicId: parseInt(match[1], 10),
                            title: link.textContent?.trim() || '',
                        });
                    }
                });
                return found;
            }, searchTerm).catch(() => []);

            // Dedup by topicId — same topic can match multiple link selectors
            const seenIds = new Set();
            const deduped = results.filter(r => {
                if (seenIds.has(r.topicId)) return false;
                seenIds.add(r.topicId);
                return true;
            });

            if (deduped.length === 0 && !hasNoResults) {
                // Page loaded, no "no results" text, but we found no links — dump HTML for debugging
                console.log(`[FORUM] ⚠️ Page loaded but no topic links found. Dumping HTML for debugging:`);
                console.log(`[FORUM] 🔍 ${pageHtmlSnippet.slice(0, 1500)}`);
            }

            console.log(`[FORUM] ✅ Found ${deduped.length} result(s) in f=${forumId} for "${searchTerm}"`);
            return deduped;
        } finally {
            lock.release();
        }
    }

    /**
     * Search the Case Management forum (f=266) for topics by decedent name.
     * Used by the Autopsy auto-poster to find the case thread to reply to.
     * Returns all matching topics sorted by most recent activity first,
     * so the handler can decide which one to use.
     *
     * @param {string} searchTerm - decedent name to search for (e.g. "John Doe")
     * @returns {Promise<Array<{topicId: number, title: string}>>}
     */
    async searchCaseManagement(searchTerm) {
        let lock = await this._acquire('searchCaseManagement');
        try {
            await this.ensureBrowser();

            const encoded = encodeURIComponent(searchTerm);
            const searchUrl = `https://phmc.gta.world/search.php?keywords=${encoded}&terms=all&fid[]=266&sc=1&sf=all&sr=posts&sk=t&sd=d&st=0&ch=300&t=0&submit=Search`;
            console.log(`[FORUM] 🔍 Searching Case Management for "${searchTerm}"...`);
            console.log(`[FORUM] 🌐 ${searchUrl}`);

            try {
                await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            } catch (navErr) {
                console.log(`[FORUM] ⚠️ Navigate error (${navErr.message}), retrying with lenient wait...`);
                await this.page.goto(searchUrl, { waitUntil: 'load', timeout: 60000 });
            }
            await this.page.waitForTimeout(2000);

            const pageUrl = this.page.url();
            const pageTitle = await this.page.title().catch(() => '(no title)');
            console.log(`[FORUM] 🔍 Search page: "${pageTitle}" — ${pageUrl}`);

            // Check if session expired — "not permitted to use the search system" means not logged in
            const notPermitted = await this.page.evaluate(() =>
                document.body?.innerText?.includes('not permitted to use the search system') ?? false
            ).catch(() => false);

            if (notPermitted) {
                console.log('[FORUM] ⚠️ Session expired — re-authenticating and retrying search...');
                // Release the global lock before calling login() to avoid deadlock
                lock.release();
                await this.login(null, null, { force: true, baseUrl: 'https://phmc.gta.world' });
                // Re-acquire lock before continuing
                lock = await this._acquire('searchCaseManagement');
                await this.ensureBrowser();
                try {
                    await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                } catch (navErr) {
                    console.log(`[FORUM] ⚠️ Retry navigate error (${navErr.message}), using lenient wait...`);
                    await this.page.goto(searchUrl, { waitUntil: 'load', timeout: 60000 });
                }
                await this.page.waitForTimeout(2000);
                const pageUrl2 = this.page.url();
                const pageTitle2 = await this.page.title().catch(() => '(no title)');
                console.log(`[FORUM] 🔍 Retry search page: "${pageTitle2}" — ${pageUrl2}`);
            }

            // Check if no results
            const noResults = await this.page.evaluate(() =>
                document.body?.innerText?.includes('No suitable matches were found') ?? false
            ).catch(() => false);

            if (noResults) {
                console.log(`[FORUM] 📭 No case threads found for "${searchTerm}"`);
                return [];
            }

            // Parse ALL topic links from search results, preferring name matches
            const results = await this.page.evaluate((term) => {
                const found = [];
                const sel = 'a.topictitle, a.topictitle2, a[href*="viewtopic.php"], .topictitle a';
                const links = document.querySelectorAll(sel);
                links.forEach((link) => {
                    const href = link.getAttribute('href') || '';
                    const match = href.match(/[?&]t=(\d+)/);
                    if (match) {
                        const title = link.textContent?.trim() || '';
                        found.push({
                            topicId: parseInt(match[1], 10),
                            title,
                            // Boost relevance: results containing the search term are preferred
                            relevance: title.toLowerCase().includes(term.toLowerCase()) ? 1 : 0,
                        });
                    }
                });
                // Sort: relevant first, then by topicId (higher = newer)
                found.sort((a, b) => b.relevance - a.relevance || b.topicId - a.topicId);
                return found.map(({ topicId, title }) => ({ topicId, title }));
            }, searchTerm).catch(() => []);

            // Dedup by topicId — search results can include duplicate links to the same topic
            const seenIds = new Set();
            const deduped = results.filter(r => {
                if (seenIds.has(r.topicId)) return false;
                seenIds.add(r.topicId);
                return true;
            });

            if (deduped.length > 0) {
                console.log(`[FORUM] ✅ Found ${deduped.length} case thread(s) for "${searchTerm}"`);
                console.log(`[FORUM] 📋 Best match: #${deduped[0].topicId} — "${deduped[0].title}"`);
                if (deduped.length > 1) {
                    console.log(`[FORUM] ⚠️ ${deduped.length - 1} additional match(es) — using most recent`);
                }
            } else {
                // Debug: dump raw page content to understand the search result format
                console.log('[FORUM] ⚠️ Search returned results but could not parse topic links');
                const pageText = await this.page.evaluate(() => document.body?.innerText?.slice(0, 500) || '').catch(() => '');
                const htmlSnippet = await this.page.evaluate(() => document.body?.innerHTML?.slice(0, 2000) || '').catch(() => '');
                const allTitles = await this.page.evaluate(() => {
                    const links = document.querySelectorAll('a.topictitle, a.topictitle2, a[href*="viewtopic.php"], .topictitle a');
                    return Array.from(links).map(a => ({ href: a.getAttribute('href') || '', text: a.textContent?.trim() || '' }));
                }).catch(() => []);
                console.log(`[FORUM] 📋 All found links (${allTitles.length}): ${JSON.stringify(allTitles.slice(0, 10))}`);
                console.log(`[FORUM] 🔍 Page text preview: "${pageText.slice(0, 300)}"`);
                console.log(`[FORUM] 🔍 HTML snippet: ${htmlSnippet.slice(0, 1500)}`);
            }

            return deduped;
        } finally {
            lock.release();
        }
    }

    /**
     * Post a reply to an existing topic (Medical Records).
     * Navigates to the reply page, fills the form, but does NOT submit — returns the URL.
     * @param {number} topicId - phpBB topic ID
     * @param {number} forumId - forum section ID
     * @param {string} bbCode - The BBCode message to post
     * @returns {Promise<{ok: boolean, url: string|null}>}
     */
    async replyToTopic(topicId, forumId, bbCode, { dryRun = true, baseUrl } = {}) {
        const lock = await this._acquire('replyToTopic');
        let ok;
        let finalUrl;
        try {
        await this.ensureBrowser();

        const domain = baseUrl || 'https://phmc.gta.world';
        const replyUrl = `${domain}/posting.php?mode=reply&f=${forumId}&t=${topicId}`;
        console.log(`[FORUM] 📝 Replying to topic #${topicId} (f=${forumId})...`);
        console.log(`[FORUM] 🌐 ${replyUrl}`);

        // Wrap navigation in try/catch: phpBB redirects (e.g. to a login page or
        // error page) can abort the original navigation with ERR_ABORTED.
        // When that happens, the page still lands on the redirect target — we just
        // need to let it settle and check where we ended up.
        try {
            await this.page.goto(replyUrl, { waitUntil: 'networkidle', timeout: 180000 });
        } catch (navErr) {
            console.log(`[FORUM] ⚠️ Navigation aborted (${navErr.message?.slice(0, 80) || 'unknown'}) — checking where we landed...`);
            await this.page.waitForTimeout(3000);
        }
        await this.page.waitForTimeout(2000);
        // Same as postTopic: a Cloudflare challenge on the reply page means
        // no reply form until it resolves.
        await this.waitForCloudflare(120000);

        const pageUrl = this.page.url();
        let pageTitle = await this.page.title().catch(() => '(no title)');
        console.log(`[FORUM] 🔍 Reply page: "${pageTitle}" — ${pageUrl}`);

        // Detect phpBB "Information" notice pages (topic deleted/moved/no permission).
        // These have no reply form — flag missing topics distinctly so callers can
        // handle them gracefully instead of looping on "No message textarea".
        const infoText = await this.page.evaluate(() => document.body?.innerText?.slice(0, 500) || '').catch(() => '');
        if (/requested topic does not exist|this topic is locked|not exist/i.test(infoText)) {
            const missing = /does not exist/i.test(infoText);
            console.log(`[FORUM] ⚠️ phpBB info page (topic #${topicId}): "${infoText.replace(/\s+/g, ' ').slice(0, 100)}"`);
            return { ok: false, url: pageUrl, reason: missing ? 'Topic does not exist' : 'Topic unavailable', topicMissing: missing };
        }

        // Check if we got a login page (session expired) — phpBB may show a login
        // form on the same reply URL without redirecting, so check title too.
        if (pageUrl.includes('mode=login') || pageUrl.includes('mode=post') || pageTitle.toLowerCase().includes('login')) {
            console.log(`[FORUM] ⚠️ Login page detected — session expired, logging in directly...`);
            if (!_credsMatchDomain(this, replyUrl)) {
                throw new Error(`Session expired on ${replyUrl} — caller must login() with that forum's credentials first (this client holds ${this.baseUrl} credentials)`);
            }
            await this.page.fill('input[name="username"]', this.username, { timeout: 10000 });
            await this.page.fill('input[name="password"]', this.password, { timeout: 10000 });
            await this.page.evaluate(() => {
                const btn = document.querySelector('input[type="submit"]') || document.querySelector('button[type="submit"]');
                if (btn) btn.click();
            });
            await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
            await this.page.waitForTimeout(3000);
            await this.saveSession();

            // Re-navigate to the reply page now that we're authenticated
            console.log(`[FORUM] 🔄 Re-navigating to reply page after re-login...`);
            await this.page.goto(replyUrl, { waitUntil: 'networkidle', timeout: 180000 });
            await this.page.waitForTimeout(3000);
            await this.waitForCloudflare(120000);
            pageTitle = await this.page.title().catch(() => '(no title)');
            console.log(`[FORUM] 🔍 After re-login — page title: "${pageTitle}", URL: ${this.page.url()}`);

            // Still check if we ended up on a login page
            const afterLoginUrl = this.page.url();
            if (afterLoginUrl.includes('mode=login') || afterLoginUrl.includes('mode=post') || pageTitle.toLowerCase().includes('login')) {
                console.error(`[FORUM] ❌ Still on login page after re-auth — cannot reply`);
                return { ok: false, url: afterLoginUrl, reason: 'Redirected to login' };
            }
        }

        // Fill the message body (trusted input)
        const msgOk = await trustedFillMessage(this.page, bbCode);

        if (!msgOk) {
            console.error('[FORUM] ❌ No message textarea found on reply page');
            await dumpPageState(this.page, 'reply-page');
            return { ok: false, url: pageUrl, reason: 'No message textarea' };
        }

        console.log(`[FORUM] ✅ Reply form filled (${bbCode.length} chars)`);

        if (dryRun) {
            console.log(`[FORUM] 🏜️ DRY RUN — form filled but not submitted. Set dryRun=false to enable.`);
            return { ok: true, url: replyUrl, dryRun: true };
        }

        // Submit the reply (trusted click)
        console.log(`[FORUM] 📤 Submitting reply...`);
        // Proactive flood pacing: per-account 30s gap before clicking submit.
        // The reactive 25s×3 retry loop below stays untouched as backstop.
        await _paceSubmitBeforeClick(`${domain}|${this.username}`);
        const result = await trustedSubmitClick(this.page, 'posting.php', [
            'input[type="submit"][name="post"]',
            'input[type="submit"][value="Submit"]',
            'button[type="submit"][name="post"]',
        ]);

        if (!result.ok) {
            console.error(`[FORUM] ❌ ${result.reason}`);
            await dumpPageState(this.page, 'reply-submit-page');
            return { ok: false, url: pageUrl, reason: result.reason };
        }

        await this.page.waitForTimeout(3000);
        // Wait for any post-submit navigation to complete — Cloudflare challenges
        // or slow forum responses can take much longer than the initial 3s.
        try {
            await this.page.waitForLoadState('networkidle', { timeout: 25000 });
        } catch {
            console.log('[FORUM] ⏳ Network did not reach idle after reply submit — checking URL anyway');
        }
        await this.page.waitForTimeout(2000);
        finalUrl = this.page.url();

        // ── Flood control / stale form token handling ──
        // phpBB rejects rapid consecutive posts from the same account. If the submit
        // bounced with a flood or invalid-form error, wait out the flood window,
        // reload the form (fresh token), refill, and resubmit.
        const FLOOD_WAIT_MS = 25000;
        const MAX_FLOOD_RETRIES = 3;

        const fillMessage = async () => {
            const filled = await trustedFillMessage(this.page, bbCode);
            if (!filled) {
                console.error('[FORUM] ❌ No message textarea found on retry form');
                await dumpPageState(this.page, 'reply-retry-page');
            }
            return filled;
        };

        const clickSubmit = async () => {
            const r = await trustedSubmitClick(this.page, 'posting.php', [
                'input[type="submit"][name="post"]',
                'input[type="submit"][value="Submit"]',
                'button[type="submit"][name="post"]',
            ]);
            return r.ok ? true : r.reason;
        };

        const detectSubmitError = async () => {
            const text = await this.page.evaluate(() => document.body.innerText || '').catch(() => '');
            if (/cannot make another post so soon after your last/i.test(text)) return 'flood';
            if (/submitted form was invalid/i.test(text)) return 'stale-token';
            return null;
        };

        // Reload the reply form (fresh token), refill, and resubmit.
        const reloadAndResubmit = async () => {
            try { await this.page.goto(replyUrl, { waitUntil: 'networkidle', timeout: 180000 }); } catch { /* [OK] nav-timeout ignored: refill + resubmit proceeds anyway; outcome verified via finalUrl below */ }
            await this.page.waitForTimeout(2000);
            if (!(await fillMessage())) return;
            console.log(`[FORUM] 📤 Re-submitting reply after reload...`);
            const r = await clickSubmit();
            if (r !== true) { console.error(`[FORUM] ❌ ${r}`); return; }
            await this.page.waitForTimeout(3000);
            try { await this.page.waitForLoadState('networkidle', { timeout: 25000 }); } catch { /* [OK] load-wait timeout ignored: timing hint only; reply outcome verified via finalUrl below */ }
            await this.page.waitForTimeout(2000);
        };

        for (let attempt = 1; attempt <= MAX_FLOOD_RETRIES; attempt++) {
            const errType = await detectSubmitError();
            if (!errType) break;

            if (errType === 'flood') {
                console.log(`[FORUM] ⚠️ FLOOD ENCOUNTERED, WAITING ${FLOOD_WAIT_MS / 1000}s before retry (attempt ${attempt}/${MAX_FLOOD_RETRIES})...`);
                await this.page.waitForTimeout(FLOOD_WAIT_MS);
            } else {
                console.log(`[FORUM] ⚠️ Stale form token detected — reloading form (attempt ${attempt}/${MAX_FLOOD_RETRIES})...`);
            }

            await reloadAndResubmit();
            finalUrl = this.page.url();
            if (finalUrl.includes('viewtopic.php') || finalUrl.includes('p=')) { ok = true; break; }
        }

        // Handle phpBB preview: if still on posting page after submit, click the real Submit button
        if (!ok && !finalUrl.includes('viewtopic.php') && finalUrl.includes('posting.php')) {
            console.log(`[FORUM] 🔄 Preview detected — re-submitting reply...`);

            // Strategy 1: Click the Submit button by name="post"
            let reSubmitted = false;
            try {
                reSubmitted = await this.page.evaluate(() => {
                    const form = document.querySelector('form[action*="posting.php"]');
                    if (!form) return false;
                    const btn = form.querySelector(
                        'input[type="submit"][name="post"], ' +
                        'button[type="submit"][name="post"]'
                    );
                    if (!btn) return false;
                    btn.click();
                    return true;
                });
            } catch { /* [OK] strategy-1 evaluate failure ignored: reSubmitted stays false, falls through to strategy 2 */ }

            if (reSubmitted) {
                try {
                    await Promise.race([
                        this.page.waitForNavigation({ timeout: 20000 }),
                        this.page.waitForTimeout(20000),
                    ]);
                } catch { /* [OK] strategy-1 nav timeout ignored: finalUrl re-checked below, falls through to strategy 2 */ }
                finalUrl = this.page.url();
            }

            // Strategy 2: If still on posting.php, try different button selectors
            if (!finalUrl.includes('viewtopic.php') && finalUrl.includes('posting.php')) {
                console.log(`[FORUM] 🔄 Button click didn't navigate — trying alternative selectors...`);
                try {
                    await this.page.evaluate(() => {
                        // Broader selectors for phpBB themes
                        const btn =
                            document.querySelector('#postform input[type="submit"][name="post"]') ||
                            document.querySelector('input[type="submit"][value="Submit"]') ||
                            document.querySelector('input[type="submit"][accesskey="s"]') ||
                            document.querySelector('button[type="submit"][name="post"]') ||
                            document.querySelector('#preview + input[type="submit"]') ||
                            document.querySelector('input[name="post"][tabindex]');
                        if (btn) { btn.click(); return true; }
                        // Last resort: submit the form directly
                        const form = document.querySelector('form[action*="posting.php"]');
                        if (form) { form.submit(); }
                        return false;
                    });
                    await Promise.race([
                        this.page.waitForNavigation({ timeout: 20000 }),
                        this.page.waitForTimeout(20000),
                    ]);
                } catch { /* [OK] strategy-2 nav timeout ignored: finalUrl re-checked below, falls through to success-text check */ }
                finalUrl = this.page.url();
            }

            // Strategy 3: If still on posting.php, check page for success indicators
            if (!finalUrl.includes('viewtopic.php') && !finalUrl.includes('p=')) {
                // Wait a bit longer — Cloudflare challenges or slow rendering may
                // delay the redirect. Give it 10 more seconds before checking.
                try { await this.page.waitForTimeout(10000); } catch { /* [OK] settle-wait ignored: page may be closed; finalUrl + success-text checks below still run */ }
                finalUrl = this.page.url();

                const pageText = await this.page.evaluate(() => document.body.innerText || '').catch(() => '');
                if (pageText.includes('posted successfully') || pageText.includes('Your message has been sent') || pageText.includes('has been submitted')) {
                    console.log(`[FORUM] ✅ Page content indicates success despite URL`);
                    ok = true;
                }
            }
        }

        ok = ok || finalUrl.includes('viewtopic.php') || finalUrl.includes('p=');
        if (!ok) {
            // Dump full page HTML for debugging submit failures (no truncation)
            const pageHtml = await this.page.content().catch(() => '(unable to capture page content)');
            const dumpPath = resolve(__dirname, '..', 'debug', 'debug-reply-page.html');
            try { mkdirSync(dirname(dumpPath), { recursive: true }); writeFileSync(dumpPath, pageHtml, 'utf-8'); console.log(`[FORUM] 💾 Full page HTML saved to ${dumpPath} for debugging`); } catch (e) { /* [OK] debug-dump ignored: best-effort diagnostics only; must never break the reply path */ }
        }
        console.log(`[FORUM] 📬 Reply ${ok ? '✅ Posted' : '⚠️ Unknown'} — ${finalUrl}`);
        } finally { lock.release(); }

        return { ok, url: ok ? finalUrl : null };
    }

    // ── Topic BBCode Fetcher ──

    /**
     * Navigate to a topic and extract the first post's BBCode from the quote page.
     * Used by the autopsy parser to extract structured fields from request posts.
     */
    async getTopicBbcode(topicId, forumId, { baseUrl } = {}) {
        const lock = await this._acquire('getTopicBbcode');
        try {
            await this.ensureBrowser();
            const domain = baseUrl || this.baseUrl;
            // Step 1: Navigate to the topic to get the post ID
            const topicPage = `${domain}/viewtopic.php?t=${topicId}`;
            await this.page.goto(topicPage, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await this.page.waitForTimeout(2000);
            const postId = await this.page.evaluate(() => {
                const links = document.querySelectorAll('a[href*="#p"]');
                for (const link of links) {
                    const m = link.getAttribute('href') || '';
                    const p = m.match(/[#&?]p=(\d+)/);
                    if (p) return p[1];
                }
                return null;
            }).catch(() => null);
            const qUrl = `${domain}/posting.php?mode=quote&f=${forumId}&p=${postId || topicId}`;
            await this.page.goto(qUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await this.page.waitForTimeout(2000);

            // Handle login redirect
            let pUrl = this.page.url();
            let pTitle = await this.page.title().catch(() => '');
            if (pUrl.includes('mode=login') || pTitle.toLowerCase().includes('login')) {
                console.log('[FORUM] ⚠️ Login on quote fetch — re-authenticating');
                if (!_credsMatchDomain(this, qUrl)) {
                    throw new Error(`Session expired on ${qUrl} — caller must login() with that forum's credentials first`);
                }
                await this.page.fill('input[name="username"]', this.username, { timeout: 10000 });
                await this.page.fill('input[name="password"]', this.password, { timeout: 10000 });
                await this.page.evaluate(() => {
                    const btn = document.querySelector('input[type="submit"]') || document.querySelector('button[type="submit"]');
                    if (btn) btn.click();
                });
                await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
                await this.page.waitForTimeout(3000);
                await this.saveSession();
                await this.page.goto(qUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await this.page.waitForTimeout(2000);
            }

            const bbcode = await this.page.evaluate(() => {
                const ta = document.querySelector('textarea[name="message"]');
                if (ta && ta.value.trim()) return ta.value;
                const all = document.querySelectorAll('textarea');
                for (const t of all) { if (t.value && t.value.length > 50) return t.value; }
                return null;
            }).catch(() => null);
            if (!bbcode) {
                const pageTitle = await this.page.title().catch(() => '?');
                const pageUrl = this.page.url();
                console.log(`[FORUM] ⚠️ BBCode empty — page: "${pageTitle}" — ${pageUrl}`);
            }
            console.log(`[FORUM] 📄 Got topic #${topicId} BBCode (${(bbcode || '').length} chars)`);
            return bbcode;
        } finally { lock.release(); }
    }

    // ── Edit Topic Title ──

    /**
     * Edit the title of a topic's first post. Used to update case status after assignment.
     * Navigates to the edit page, changes the subject, and submits.
     */
    async editTopicTitle(topicId, forumId, newTitle, { baseUrl } = {}) {
        const lock = await this._acquire('editTopicTitle');
        try {
            await this.ensureBrowser();
            const domain = baseUrl || this.baseUrl;
            const topicUrl = `${domain}/viewtopic.php?t=${topicId}`;
            await this.page.goto(topicUrl, { waitUntil: 'domcontentloaded', timeout: 180000 });
            await this.page.waitForTimeout(2000);

            const postId = await this.page.evaluate(() => {
                const links = document.querySelectorAll('a[href*="#p"]');
                for (const link of links) {
                    const m = link.getAttribute('href') || '';
                    const p = m.match(/[#&?]p=(\d+)/);
                    if (p) return p[1];
                }
                return null;
            }).catch(() => null);

            if (!postId) {
                console.log(`[FORUM] ❌ Could not find post ID for topic #${topicId}`);
                return { ok: false };
            }

            const editUrl = `${domain}/posting.php?mode=edit&f=${forumId}&p=${postId}`;
            console.log(`[FORUM] ✏️ Editing topic #${topicId} title → "${newTitle}"`);
            await this.page.goto(editUrl, { waitUntil: 'networkidle', timeout: 180000 });
            await this.page.waitForTimeout(2000);

            // Handle login redirect
            let eUrl = this.page.url();
            let eTitle = await this.page.title().catch(() => '');
            if (eUrl.includes('mode=login') || eTitle.toLowerCase().includes('login')) {
                console.log('[FORUM] ⚠️ Login on edit — re-authenticating');
                if (!_credsMatchDomain(this, editUrl)) {
                    throw new Error(`Session expired on ${editUrl} — caller must login() with that forum's credentials first`);
                }
                await this.page.fill('input[name="username"]', this.username, { timeout: 10000 });
                await this.page.fill('input[name="password"]', this.password, { timeout: 10000 });
                await this.page.evaluate(() => {
                    const btn = document.querySelector('input[type="submit"]') || document.querySelector('button[type="submit"]');
                    if (btn) btn.click();
                });
                await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
                await this.page.waitForTimeout(3000);
                await this.saveSession();
                await this.page.goto(editUrl, { waitUntil: 'networkidle', timeout: 180000 });
                await this.page.waitForTimeout(2000);
            }

            // Fill the new subject
            await this.page.evaluate((s) => {
                const el = document.querySelector('input[name="subject"]');
                if (el) { el.value = s; el.dispatchEvent(new Event('input', { bubbles: true })); }
            }, newTitle);

            await this.page.waitForTimeout(500);

            // Submit
            const result = await this.page.evaluate(() => {
                const form = document.querySelector('form[action*="posting.php"]');
                if (!form) return { ok: false, reason: 'No form' };
                const btn = form.querySelector(
                    'input[type="submit"][name="post"], ' +
                    'input[type="submit"][value="Submit"], ' +
                    'button[type="submit"][name="post"]'
                );
                if (!btn) return { ok: false, reason: 'No button' };
                btn.click();
                return { ok: true };
            });

            if (!result.ok) {
                console.log(`[FORUM] ❌ ${result.reason}`);
                await dumpPageState(this.page, 'edit-title-page');
                return { ok: false };
            }

            await this.page.waitForTimeout(5000);
            const finalUrl = this.page.url();
            const success = finalUrl.includes('viewtopic.php');
            console.log(`[FORUM] ✏️ Title edit ${success ? '✅' : '⚠️'} — ${finalUrl}`);
            return { ok: success, url: success ? finalUrl : null };
        } finally {
            lock.release();
        }
    }

    /**
     * Edit a post's content (and optional subject) in place.
     * Powers self-serve "Edit & Repost" for deployed reports.
     *
     * @param {number|string} topicId - the topic containing the post
     * @param {number|string} forumId - forum section ID
     * @param {number|string|null} postId - the post to edit; when null, resolves the
     *   topic's first post (used for whole-topic content edits)
     * @param {string} newBbCode - replacement message content
     * @param {{ title?: string|null, baseUrl?: string }} [opts]
     * @returns {Promise<{ok: boolean, url?: string, reason?: string}>}
     */
    async editPostContent(topicId, forumId, postId, newBbCode, { title, baseUrl } = {}) {
        const lock = await this._acquire('editPostContent');
        try {
            await this.ensureBrowser();
            const domain = baseUrl || this.baseUrl;

            // Resolve the target post id when not supplied (first post of the topic).
            let targetPostId = postId;
            if (!targetPostId) {
                const topicUrl = `${domain}/viewtopic.php?t=${topicId}`;
                await this.page.goto(topicUrl, { waitUntil: 'domcontentloaded', timeout: 180000 });
                await this.page.waitForTimeout(2000);
                targetPostId = await this.page.evaluate(() => {
                    const links = document.querySelectorAll('a[href*="#p"]');
                    for (const link of links) {
                        const m = (link.getAttribute('href') || '').match(/[#&?]p=(\d+)/);
                        if (m) return m[1];
                    }
                    return null;
                }).catch(() => null);
                if (!targetPostId) {
                    console.log(`[FORUM] ❌ Could not find post ID for topic #${topicId}`);
                    return { ok: false, reason: 'No post id found' };
                }
            }

            const editUrl = `${domain}/posting.php?mode=edit&f=${forumId}&p=${targetPostId}`;
            console.log(`[FORUM] ✏️ Editing post p=${targetPostId} (t=${topicId}, f=${forumId})`);
            await this.page.goto(editUrl, { waitUntil: 'networkidle', timeout: 180000 });
            await this.page.waitForTimeout(2000);

            // Handle login redirect
            let eUrl = this.page.url();
            let eTitle = await this.page.title().catch(() => '');
            if (eUrl.includes('mode=login') || eTitle.toLowerCase().includes('login')) {
                console.log('[FORUM] ⚠️ Login on edit — re-authenticating');
                if (!_credsMatchDomain(this, editUrl)) {
                    throw new Error(`Session expired on ${editUrl} — caller must login() with that forum's credentials first`);
                }
                await this.page.fill('input[name="username"]', this.username, { timeout: 10000 });
                await this.page.fill('input[name="password"]', this.password, { timeout: 10000 });
                await this.page.evaluate(() => {
                    const btn = document.querySelector('input[type="submit"]') || document.querySelector('button[type="submit"]');
                    if (btn) btn.click();
                });
                await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
                await this.page.waitForTimeout(3000);
                await this.saveSession();
                await this.page.goto(editUrl, { waitUntil: 'networkidle', timeout: 180000 });
                await this.page.waitForTimeout(2000);
            }

            // Fill the message body (and optional subject).
            await this.page.evaluate(({ bb, sub }) => {
                const msg = document.querySelector('textarea[name="message"]');
                if (msg) {
                    msg.value = bb;
                    msg.dispatchEvent(new Event('input', { bubbles: true }));
                }
                if (sub != null) {
                    const el = document.querySelector('input[name="subject"]');
                    if (el) { el.value = sub; el.dispatchEvent(new Event('input', { bubbles: true })); }
                }
            }, { bb: newBbCode, sub: title != null ? title : null });

            await this.page.waitForTimeout(500);

            // Submit
            const result = await this.page.evaluate(() => {
                const form = document.querySelector('form[action*="posting.php"]');
                if (!form) return { ok: false, reason: 'No form' };
                const btn = form.querySelector(
                    'input[type="submit"][name="post"], ' +
                    'input[type="submit"][value="Submit"], ' +
                    'button[type="submit"][name="post"]'
                );
                if (!btn) return { ok: false, reason: 'No button' };
                btn.click();
                return { ok: true };
            });

            if (!result.ok) {
                console.log(`[FORUM] ❌ ${result.reason}`);
                await dumpPageState(this.page, 'edit-content-page');
                return { ok: false, reason: result.reason };
            }

            await this.page.waitForTimeout(5000);
            const finalUrl = this.page.url();
            const success = finalUrl.includes('viewtopic.php');
            console.log(`[FORUM] ✏️ Content edit ${success ? '✅' : '⚠️'} — ${finalUrl}`);
            return { ok: success, url: success ? finalUrl : null };
        } finally {
            lock.release();
        }
    }

    /**
     * Fetch the username of the first post author in a topic.
     * Used by the completion flow to DM the correct forum user (not the BBCode name).
     * @param {number|string} topicId
     * @param {{ baseUrl?: string }} [opts]
     * @returns {Promise<string|null>}
     */
    async getTopicPoster(topicId, { baseUrl } = {}) {
        const lock = await this._acquire('getTopicPoster');
        try {
            await this.ensureBrowser();
            const domain = baseUrl || this.baseUrl;
            const url = `${domain}/viewtopic.php?t=${topicId}`;
            await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await this.page.waitForTimeout(2000);

            const username = await this.page.evaluate(() => {
                // phpBB places author links in the first post
                const link = document.querySelector('a.username, a.username-coloured');
                return link ? link.textContent?.trim() || null : null;
            }).catch(() => null);

            console.log(`[FORUM] 👤 Topic #${topicId} poster: "${username || 'not found'}"`);
            return username;
        } catch (err) {
            console.error(`[FORUM] ❌ Failed to get topic poster for #${topicId}: ${err.message}`);
            return null;
        } finally {
            lock.release();
        }
    }

    /**
     * Resolve a forum username from a member-profile URL (memberlist.php?...).
     * Used by the autopsy completion DM to deliver to the requester's forum
     * account captured by the web "Request Autopsy" modal (forumAccountUrl).
     * @param {string} profileUrl
     * @returns {Promise<string|null>} username, or null if unresolvable
     */
    async resolveProfileUsername(profileUrl) {
        if (!profileUrl) return null;
        const lock = await this._acquire('resolveProfileUsername');
        try {
            await this.ensureBrowser();
            await this.page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
            await this.page.waitForTimeout(2000);

            const username = await this.page.evaluate(() => {
                // Prefer an author link on the page; fall back to the profile title.
                const link = document.querySelector('a.username, a.username-coloured');
                if (link && link.textContent?.trim()) return link.textContent.trim();
                const m = document.title.match(/Viewing profile[^|]*[:-]\s*(.+)/i)
                    || document.title.match(/Profile[:-]\s*(.+)/i);
                return m ? m[1].trim() : null;
            }).catch(() => null);

            console.log(`[FORUM] 👤 Profile username: "${username || 'not found'}"`);
            return username;
        } catch (err) {
            console.error(`[FORUM] ❌ Failed to resolve profile username: ${err.message}`);
            return null;
        } finally {
            lock.release();
        }
    }

    // ── Group Members ──

    /**
     * Fetch usernames and user IDs from a phpBB group member list page.
     * Used to assign autopsy cases to Medical Examiners.
     *
     * @param {number|string} groupId - phpBB group ID (e.g. 50 for Medical Examiners)
     * @param {object} [options]
     * @param {string} [options.baseUrl] - Forum base URL
     * @param {string[]} [options.exclude] - Usernames to exclude from results
     * @param {boolean} [options.paginate=false] - If true, scrape all pages via start=N param
     * @returns {Promise<Array<{name: string, userId: string|null}>>}
     */
    async getGroupMembers(groupId, { baseUrl, exclude = [], paginate = false } = {}) {
        const lock = await this._acquire('getGroupMembers');
        try {
            await this.ensureBrowser();
            const domain = baseUrl || this.baseUrl;
            const PAGE_SIZE = 25; // phpBB default page size for memberlist
            const allMembers = [];
            const seen = new Set();
            let start = 0;
            let isLastPage = false;

            while (!isLastPage) {
                const url = `${domain}/memberlist.php?mode=group&g=${groupId}&start=${start}`;
                console.log(`[FORUM] Fetching group members for g=${groupId} (start=${start})...`);
                await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await this.page.waitForTimeout(500);

                const pageMembers = await this.page.evaluate(() => {
                    const results = [];
                    const links = document.querySelectorAll('a.username, a.username-coloured');
                    links.forEach((link) => {
                        const name = link.textContent?.trim();
                        const href = link.getAttribute('href') || '';
                        const uMatch = href.match(/[?&]u=(\d+)/);
                        const userId = uMatch ? uMatch[1] : null;
                        if (name) results.push({ name, userId });
                    });
                    return results;
                }).catch(() => []);

                // Deduplicate across pages and filter exclusions
                let pageNewCount = 0;
                for (const m of pageMembers) {
                    if (!m.name || seen.has(m.name)) continue;
                    if (exclude.some((e) => m.name.toLowerCase() === e.toLowerCase())) continue;
                    seen.add(m.name);
                    allMembers.push(m);
                    pageNewCount++;
                }

                console.log(`[FORUM] Page start=${start}: ${pageNewCount} new members (${pageMembers.length} on page)`);

                // Detect last page: if fewer members than page size, no pagination at all,
                // or a full page produced no new members (stalled/infinite pagination guard)
                if (!paginate || pageMembers.length < PAGE_SIZE || pageNewCount === 0) {
                    isLastPage = true;
                } else {
                    start += PAGE_SIZE;
                }
            }

            console.log(`[FORUM] Found ${allMembers.length} total group members for g=${groupId}${paginate ? ' (all pages)' : ''}`);
            return allMembers;
        } finally {
            lock.release();
        }
    }

    // ── Private Message Inbox ──

    /**
     * Fetch private messages from the PHMC forum inbox.
     * Returns an array of { msgId, subject, sender, date, isNew }.
     * Used for passive PM monitoring (confidential autopsy requests, etc.).
     */
    async getPrivateMessages({ baseUrl } = {}) {
        const lock = await this._acquire('getPrivateMessages');
        try {
            await this.ensureBrowser();
            const domain = baseUrl || this.baseUrl;
            const url = `${domain}/ucp.php?i=pm&folder=inbox`;
            await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
            await this.page.waitForTimeout(3000);

            const pageUrl = this.page.url();
            const pageTitle = await this.page.title().catch(() => '');
            if (pageUrl.includes('mode=login') || pageTitle.toLowerCase().includes('login')) {
                console.log('[FORUM] PM inbox — session expired (no action taken)');
                return []; // Skip this cycle, try again next time
            }

            // Debug: check actual page state
            // Parse PMs: find all links to PM view pages and their context
            const pms = await this.page.evaluate(() => {
                const results = [];
                const links = document.querySelectorAll('a[href*="i=pm&mode=view"], a[href*="pm&f="]');
                links.forEach((link) => {
                    const subject = (link.textContent || '').trim();
                    const href = link.getAttribute('href') || '';
                    const msgMatch = href.match(/[?&]p=(\d+)/) || href.match(/[?&]pm=(\d+)/);
                    const msgId = msgMatch ? msgMatch[1] : '';

                    if (!msgId || !subject) return;

                    // Walk up to find the containing row, then find the sender
                    let row = link.closest('tr, li, div.pm-item, .pm, .message, [class*="pm"]');
                    let sender = '';
                    let date = '';
                    let isNew = false;

                    if (row) {
                        const senderLink = row.querySelector('a.username, a.username-coloured, [class*="username"]');
                        if (senderLink) sender = (senderLink.textContent || '').trim();

                        // Find date - look for text containing time patterns
                        const allText = row.textContent || '';
                        const dateMatch = allText.match(/\d{1,2}\s+\w+\s+\d{4}/);
                        if (dateMatch) date = dateMatch[0];

                        isNew = row.classList.contains('pm_unread') ||
                                !!row.querySelector('strong') ||
                                row.innerHTML.includes('pm_unread');
                    }

                    results.push({ msgId, subject, sender, date, isNew });
                });
                return results;
            });

            console.log('[FORUM] Found ' + pms.length + ' PM(s) in inbox');
            return pms;
        } finally {
            lock.release();
        }
    }

    /**
     * Open a private message and return its full EXPANDED body text.
     * Spoiler toggles (`a[href="#"]` inside the message, e.g. LSPD addendum
     * spoilers) are clicked open first — collapsed content is invisible to
     * innerText otherwise. Subject/sender/date come from the inbox listing;
     * only the body is read here. Read-only: no reply, no state change beyond
     * normal page views.
     *
     * @param {string|number} msgId - PM id (p= param)
     * @param {object} [options]
     * @param {string} [options.baseUrl] - Forum base URL
     * @param {number} [options.folder=0] - PM folder (0 = inbox)
     * @returns {Promise<{msgId: string, url: string, bodyText: string}|null>}
     */
    async readPrivateMessage(msgId, { baseUrl, folder = 0 } = {}) {
        const lock = await this._acquire('readPrivateMessage');
        try {
            await this.ensureBrowser();
            const domain = baseUrl || this.baseUrl;
            const url = `${domain}/ucp.php?i=pm&mode=view&f=${folder}&p=${msgId}`;
            await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
            await this.page.waitForTimeout(2500);

            // Expand in-message spoiler toggles (LSPD addenda render as
            // `a[href="#"]` with onclick=return false; real postlinks have
            // distinct hrefs/classes and are left alone).
            await this.page.evaluate(() => {
                const c = document.querySelector('div.content');
                if (!c) return 0;
                let n = 0;
                for (const a of c.querySelectorAll('a[href="#"]')) {
                    try { a.click(); n++; } catch { /* best effort */ }
                }
                return n;
            }).catch(() => 0);
            await this.page.waitForTimeout(1500);

            const bodyText = await this.page.evaluate(() => {
                const c = document.querySelector('div.content');
                return (c?.innerText || '').trim();
            }).catch(() => '');

            if (!bodyText) {
                console.log(`[FORUM] ⚠️ PM p=${msgId} body empty — page: ${this.page.url()}`);
                return null;
            }

            // Authoritative sender/subject from the view page chrome. The inbox
            // row is unreliable (multiline label text, no username link on some
            // themes). LSPD view pages show "From: Name (Alias)" and the subject
            // in a short heading element.
            const chrome = await this.page.evaluate(() => {
                const all = document.body?.innerText || '';
                const fromM = all.match(/From:\s*([^\n]{1,80})/i);
                // The subject heading is the short block containing the tag —
                // never the nav banner (a bare h2/h3/p scan grabs that instead).
                let subject = null;
                for (const el of document.querySelectorAll('h2, h3, p')) {
                    const t = (el.innerText || '').trim();
                    if (t.length > 4 && t.length < 300 && /\[private autopsy\]/i.test(t)) {
                        subject = t.replace(/^["\s]+|["\s]+$/g, '');
                        break;
                    }
                }
                return { sender: fromM ? fromM[1].trim() : null, subject };
            }).catch(() => ({ sender: null, subject: null }));

            console.log(`[FORUM] 📨 Read PM p=${msgId} (${bodyText.length} chars expanded) from="${chrome.sender || '?'}"`);
            return { msgId: String(msgId), url, bodyText, sender: chrome.sender, subject: chrome.subject };
        } finally {
            lock.release();
        }
    }

    /**
     * Resolve a display string to the exact forum account name via memberlist
     * search. Tries each candidate in order, exact match (case-insensitive),
     * returns the link text (canonical spelling) or null. Used to turn PM
     * "From: Character (Account)" strings into a deliverable PM recipient —
     * signatures and character names never resolve, only accounts do.
     *
     * @param {string[]} candidates - names to try, first resolvable wins
     * @param {object} [options]
     * @param {string} [options.baseUrl] - Forum base URL
     * @returns {Promise<string|null>}
     */
    async resolveMemberUsername(candidates, { baseUrl } = {}) {
        const lock = await this._acquire('resolveMemberUsername');
        try {
            await this.ensureBrowser();
            const domain = baseUrl || this.baseUrl;
            const seen = new Set();
            for (const raw of candidates || []) {
                const name = String(raw || '').trim();
                if (!name || seen.has(name.toLowerCase())) continue;
                seen.add(name.toLowerCase());
                await this.page.goto(
                    `${domain}/memberlist.php?mode=searchuser&username=${encodeURIComponent(name)}&submit=Search`,
                    { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
                await this.page.waitForTimeout(2000);
                const hit = await this.page.evaluate((want) => {
                    const wl = want.toLowerCase();
                    for (const a of document.querySelectorAll('a[href*="memberlist.php"][href*="u="]')) {
                        const t = (a.textContent || '').trim();
                        if (t.toLowerCase() === wl) return t;
                    }
                    return null;
                }, name).catch(() => null);
                if (hit) {
                    console.log(`[FORUM] 👤 Resolved "${name}" -> account "${hit}"`);
                    return hit;
                }
            }
            console.log(`[FORUM] 👤 No account resolved for [${(candidates || []).join('|')}]`);
            return null;
        } finally {
            lock.release();
        }
    }

    /**
     * Fuzzy member lookup: when the exact name resolves to nothing, search by
     * name tokens and return the closest username at or above threshold.
     * Self-heal primitive for misspelled recipients (never auto-sends — the
     * caller decides, and must surface the match it chose).
     *
     * @param {string} name - intended recipient
     * @param {object} [options]
     * @param {string} [options.baseUrl] - Forum base URL
     * @param {number} [options.threshold=0.85] - minimum similarity to accept
     * @returns {Promise<{userId: string, username: string, score: number, checked: number}|null>}
     */
    async resolveMemberUserIdFuzzy(name, { baseUrl, threshold = 0.85 } = {}) {
        const lock = await this._acquire('resolveMemberUserIdFuzzy');
        try {
            await this.ensureBrowser();
            const domain = baseUrl || this.baseUrl;
            // Local roster first: instant, no browser load. The 12h sync banks
            // every faction member with IDs (proven: Isabella Sato u=1954).
            const rosterKey = rosterKeyForBaseUrl(domain);
            if (rosterKey) {
                const hit = matchRosterFile(rosterKey, name, threshold);
                if (hit) {
                    console.log(`[FORUM] 🔍 Fuzzy match "${name}" — roster ${rosterKey}: "${hit.username}" (${Math.round(hit.score * 100)}%)`);
                    return { ...hit, checked: -1, source: 'roster' };
                }
            }
            const tokens = String(name || '').trim().split(/\s+/).filter((t) => t.length > 1);
            // Last token first (surnames discriminate best), then first token.
            const queries = [...new Set([tokens[tokens.length - 1], tokens[0]].filter(Boolean))];
            const candidates = new Map();
            for (const q of queries) {
                await this.page.goto(
                    `${domain}/memberlist.php?mode=searchuser&username=${encodeURIComponent(q)}&submit=Search`,
                    { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
                await this.page.waitForTimeout(2000);
                const hits = await this.page.evaluate(() => {
                    const out = [];
                    for (const a of document.querySelectorAll('a[href*="memberlist.php"][href*="u="]')) {
                        const m = (a.getAttribute('href') || '').match(/[?&]u=(\d+)/);
                        const t = (a.textContent || '').trim();
                        if (m && t) out.push({ userId: m[1], username: t });
                        if (out.length >= 50) break;
                    }
                    return out;
                }).catch(() => []);
                for (const h of hits) {
                    if (!candidates.has(h.userId)) candidates.set(h.userId, h.username);
                }
            }
            const want = String(name || '').trim().toLowerCase();
            let best = null;
            for (const [userId, username] of candidates) {
                const score = nameSimilarity(want, username.toLowerCase());
                if (!best || score > best.score) best = { userId, username, score };
            }
            console.log(`[FORUM] 🔍 Fuzzy match "${name}" — live search checked ${candidates.size}, best: ${best ? `"${best.username}" (${Math.round(best.score * 100)}%)` : 'none'}`);
            if (best && best.score >= threshold) return { ...best, checked: candidates.size, source: 'search' };
            return null;
        } finally {
            lock.release();
        }
    }

    /**
     * Lock-free core of resolveMemberUserId for callers that already hold the
     * instance lock (e.g. sendPM). Never call directly without holding it.
     */
    async _resolveMemberUserIdInner(candidates, { baseUrl } = {}) {
        {
            await this.ensureBrowser();
            const domain = baseUrl || this.baseUrl;
            const seen = new Set();
            for (const raw of candidates || []) {
                const name = String(raw || '').trim();
                if (!name || seen.has(name.toLowerCase())) continue;
                seen.add(name.toLowerCase());
                await this.page.goto(
                    `${domain}/memberlist.php?mode=searchuser&username=${encodeURIComponent(name)}&submit=Search`,
                    { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
                await this.page.waitForTimeout(2000);
                const hit = await this.page.evaluate((want) => {
                    const wl = want.toLowerCase();
                    for (const a of document.querySelectorAll('a[href*="memberlist.php"][href*="u="]')) {
                        const m = (a.getAttribute('href') || '').match(/[?&]u=(\d+)/);
                        const t = (a.textContent || '').trim();
                        if (m && t.toLowerCase() === wl) return { userId: m[1], username: t };
                    }
                    return null;
                }, name).catch(() => null);
                if (hit) {
                    console.log(`[FORUM] 👤 Resolved "${name}" -> id ${hit.userId} ("${hit.username}")`);
                    return hit;
                }
            }
            console.log(`[FORUM] 👤 No user ID resolved for [${(candidates || []).join('|')}]`);
            return null;
        }
    }

    // ── Quote & Repost (for auto case creation) ──

    /**
     * Navigate to a topic's quote page, extract the quoted BBCode, then post it
     * as a new topic in a different forum. Used by the autopsy monitor to create
     * Case Management entries from autopsy requests.
     *
     * @param {number} sourceTopicId - Topic to quote from
     * @param {number} sourceForumId - Forum the source topic is in
     * @param {number} targetForumId - Forum to post the new topic in
     * @param {string} title - Title for the new topic
      * @param {object} [options]
      * @param {string} [options.baseUrl] - Forum base URL
      * @param {string} [options.quotedBbCode] - FUSION POINT: caller-supplied
      *   quoted BBCode (e.g. just read via getTopicBbcode). When provided, the
      *   viewtopic fetch + quote-page extraction below are skipped and the
      *   flow goes straight to the target posting page. All current callers
      *   omit it, so behavior is identical until a caller passes it.
      * @param {string|number} [options.quotePostId] - post id the supplied
      *   quote came from (logging only)
      * @returns {Promise<{ok: boolean, url?: string}>}
      */
            async quoteAndPost(sourceTopicId, sourceForumId, targetForumId, title, { baseUrl, quotedBbCode = null, quotePostId = null } = {}) {
        const lock = await this._acquire("quoteAndPost");
        try {
            await this.ensureBrowser();
            const domain = baseUrl || "https://phmc.gta.world";

            // FUSION POINT: when the caller already holds the quoted BBCode it
            // skips the viewtopic fetch + quote-page extraction entirely.
            let quotedBBCode = quotedBbCode || null;
            if (quotedBBCode) {
                console.log("[FORUM] ♻️ Using caller-supplied quote (p=" + (quotePostId || "?") + ", " + quotedBBCode.length + " chars) — skipping viewtopic/quote re-read");
            } else {
            const topicPage = domain + "/viewtopic.php?t=" + sourceTopicId;
            console.log("[FORUM] Fetching post ID from topic #" + sourceTopicId);
            await this.page.goto(topicPage, { waitUntil: "domcontentloaded", timeout: 60000 });
            await this.page.waitForTimeout(2000);

            const postId = await this.page.evaluate(() => {
                const links = document.querySelectorAll('a[href*="#p"]');
                for (const link of links) {
                    const m = link.getAttribute("href") || "";
                    const p = m.match(/[#&?]p=(\d+)/);
                    if (p) return p[1];
                }
                return null;
            }).catch(() => null);
            console.log("[FORUM] Post ID: " + (postId || "not found"));

            const quoteTarget = postId ? "p=" + postId : "t=" + sourceTopicId;
            const quoteUrl = domain + "/posting.php?mode=quote&" + quoteTarget;
            console.log("[FORUM] Opening quote page...");
            await this.page.goto(quoteUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
            await this.page.waitForTimeout(2000);

            let qUrl = this.page.url();
            let qTitle = await this.page.title().catch(() => "");
            if (qUrl.includes("mode=login") || qTitle.toLowerCase().includes("login")) {
                console.log("[FORUM] Login on quote, re-authing");
                if (!_credsMatchDomain(this, quoteUrl)) {
                    throw new Error(`Session expired on ${quoteUrl} — caller must login() with that forum's credentials first`);
                }
                await this.page.fill('input[name="username"]', this.username, { timeout: 10000 });
                await this.page.fill('input[name="password"]', this.password, { timeout: 10000 });
                await this.page.evaluate(() => {
                    const btn = document.querySelector('input[type="submit"]') || document.querySelector('button[type="submit"]');
                    if (btn) btn.click();
                });
                await this.page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
                await this.page.waitForTimeout(3000);
                await this.saveSession();
                await this.page.goto(quoteUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
                await this.page.waitForTimeout(2000);
            }

            quotedBBCode = await this.page.evaluate(() => {
                const ta = document.querySelector('textarea[name="message"]');
                if (ta && ta.value.trim()) return ta.value;
                const allTas = document.querySelectorAll("textarea");
                for (const t of allTas) { if (t.value && t.value.length > 50) return t.value; }
                return null;
            });

            if (!quotedBBCode) {
                console.log("[FORUM] Could not extract quote");
                return { ok: false };
            }
            console.log("[FORUM] Got quote (" + quotedBBCode.length + " chars)");
            }

            const postUrl = domain + "/posting.php?mode=post&f=" + targetForumId;
            console.log("[FORUM] Posting to f=" + targetForumId + " - " + title);
            await this.page.goto(postUrl, { waitUntil: "networkidle", timeout: 180000 });
            await this.page.waitForTimeout(2000);

            let pUrl = this.page.url();
            let pTitle = await this.page.title().catch(() => "");
            if (pUrl.includes("mode=login") || pTitle.toLowerCase().includes("login")) {
                console.log("[FORUM] Login on post, re-authing");
                if (!_credsMatchDomain(this, postUrl)) {
                    throw new Error(`Session expired on ${postUrl} — caller must login() with that forum's credentials first`);
                }
                await this.page.fill('input[name="username"]', this.username, { timeout: 10000 });
                await this.page.fill('input[name="password"]', this.password, { timeout: 10000 });
                await this.page.evaluate(() => {
                    const btn = document.querySelector('input[type="submit"]') || document.querySelector('button[type="submit"]');
                    if (btn) btn.click();
                });
                await this.page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
                await this.page.waitForTimeout(3000);
                await this.saveSession();
                await this.page.goto(postUrl, { waitUntil: "networkidle", timeout: 180000 });
                await this.page.waitForTimeout(2000);
            }

            await this.page.evaluate((s) => {
                const el = document.querySelector('input[name="subject"]');
                if (el) { el.value = s; el.dispatchEvent(new Event("input", { bubbles: true })); }
            }, title);
            await this.page.evaluate((msg) => {
                const ta = document.querySelector('textarea[name="message"]');
                if (ta) { ta.value = msg; ta.dispatchEvent(new Event("input", { bubbles: true })); }
            }, quotedBBCode);
            await this.page.waitForTimeout(1000);

            const submitResult = await this.page.evaluate(() => {
                const form = document.querySelector('form[action*="posting.php"]');
                if (!form) return { ok: false, reason: "No form" };
                const btn = form.querySelector(
                    'input[type="submit"][name="post"], ' +
                    'input[type="submit"][value="Submit"], ' +
                    'button[type="submit"][name="post"]'
                );
                if (!btn) return { ok: false, reason: "No button" };
                btn.click();
                return { ok: true };
            });
            if (!submitResult.ok) { console.log("[FORUM] " + submitResult.reason); return { ok: false }; }

            await this.page.waitForTimeout(5000);
            const finalUrl = this.page.url();
            const success = finalUrl.includes("viewtopic.php");
            console.log("[FORUM] New topic " + (success ? "created" : "unknown") + " - " + finalUrl);
            return { ok: success, url: success ? finalUrl : null };
        } finally {
            lock.release();
        }
    }// ── Forum Topic Listing ──

    /**
     * Fetch all topics from a forum page with their IDs and titles.
     * Uses its own temporary page (not the shared `this.page`) so it does NOT
     * block concurrent deploy operations. Read-only — no mutex lock needed.
     *
     * @param {number|string} forumId - The forum section ID (e.g. 265)
     * @param {object} [options]
     * @param {string} [options.baseUrl] - Forum base URL (defaults to phmc.gta.world)
     * @param {number} [options.timeout] - Navigation timeout in ms (default 30000)
     * @returns {Promise<Array<{topicId: number, title: string, href: string}>>}
     */
    async getForumTopics(forumId, { baseUrl, timeout = 30000 } = {}) {
        // No lock — creates a disposable page so it won't block deploy operations
        await this.ensureBrowser();

        const domain = baseUrl || this.baseUrl;
        const url = `${domain}/viewforum.php?f=${forumId}`;
        console.log(`[FORUM] 📋 Fetching topics from forum f=${forumId}...`);
        console.log(`[FORUM] 🌐 ${url}`);

        const page = await this.context.newPage();
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
            await page.waitForTimeout(2000);
            // Quick Cloudflare poll (15s max — don't hold up deploys)
            const cfStart = Date.now();
            while (Date.now() - cfStart < 15000) {
                const isCf = await page.evaluate(() =>
                    document.body?.innerHTML?.includes('cf-wrapper') ||
                    document.title?.includes('Just a moment')
                ).catch(() => false);
                if (!isCf) break;
                await page.waitForTimeout(1500);
            }

            const topics = await page.evaluate(() => {
                const results = [];
                const sel = 'a.topictitle, a.topictitle2, a[href*="viewtopic.php"], .topictitle a'; const links = document.querySelectorAll(sel);
                links.forEach((link) => {
                    const href = link.getAttribute('href') || '';
                    const title = link.textContent.trim();
                    const tMatch = href.match(/[?&]t=(\d+)/);
                    if (tMatch && title) {
                        results.push({
                            topicId: parseInt(tMatch[1], 10),
                            title,
                            href: href.startsWith('http') ? href : `https://phmc.gta.world/${href.replace(/^\.\//, '')}`,
                        });
                    }
                });
                return results;
            });

            console.log(`[FORUM] 📋 Found ${topics.length} topics in forum f=${forumId}`);
            return topics;
        } finally {
            await page.close().catch(() => {});
        }
    }

    // ── Forum Mappings ──
    // Hard-coded forum section IDs for auto-deployment.
    // Death Records & Mass Fatality → PHMC forum f=267
    // Coroner Reports → PHMC forum f=489

    static FORUM_MAP = {
        // All report types now post to the same PHMC forum section f=267
        'coroner-report':    { forumId: 267, name: 'Coroner Reports', url: 'https://phmc.gta.world/posting.php?mode=post&f=267' },
        'death_record':      { forumId: 404, name: 'Death Records', url: 'https://phmc.gta.world/posting.php?mode=post&f=404' },
        'mass-ftality-test': { forumId: 267, name: 'Mass Fatality Reports', url: 'https://phmc.gta.world/posting.php?mode=post&f=267' },
        'autopsy':           { forumId: 267, name: 'Autopsy Requests', url: 'https://phmc.gta.world/posting.php?mode=post&f=267' },
        'patient_notes':         { forumId: 97, name: 'Medical Records', url: 'https://phmc.gta.world/posting.php?mode=post&f=97' },
        'er_protocol':           { forumId: 97, name: 'Medical Records', url: 'https://phmc.gta.world/posting.php?mode=post&f=97' },
        'physical_evaluation':   { forumId: 97, name: 'Medical Records', url: 'https://phmc.gta.world/posting.php?mode=post&f=97' },
        'staff-patient-file':    { forumId: 97, name: 'Medical Records', url: 'https://phmc.gta.world/posting.php?mode=post&f=97' },
        'surgical':              { forumId: 97, name: 'Medical Records', url: 'https://phmc.gta.world/posting.php?mode=post&f=97' },
        'session_notes':         { forumId: 97, name: 'Medical Records', url: 'https://phmc.gta.world/posting.php?mode=post&f=97' },
        'intensive_treatment':   { forumId: 97, name: 'Medical Records', url: 'https://phmc.gta.world/posting.php?mode=post&f=97' },
        'psych-eval':            { forumId: 97, name: 'Medical Records', url: 'https://phmc.gta.world/posting.php?mode=post&f=97' },
    };

    static resolveForumId(formId, formName) {
        if (ForumClient.FORUM_MAP[formId]) return ForumClient.FORUM_MAP[formId];
        const n = (formName || '').toLowerCase();
        if (n.includes('autopsy')) return ForumClient.FORUM_MAP.autopsy;
        return null;
    }

    /**
     * Health-check a forum URL using the browser. Follows the same proven flow as login:
     * navigate → Cloudflare poll → check result. Reuses any existing login session.
     *
     * @param {string} url - Forum base URL to check (e.g. https://phmc.gta.world)
     * @returns {Promise<{status: string, latency: number|null, details: string}>}
     */
    async checkHealth(url) {
        // No lock — creates a disposable page so it won't block deploy operations
        await this.ensureBrowser();
        const page = await this.context.newPage();
        const start = Date.now();
        try {
            // Navigate to forum index — 30s hard cap, if blank it's down
            await page.goto(`${url}/index.php`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
            await page.waitForTimeout(2000);

            // Quick Cloudflare poll (30s max — don't hold up deploys)
            const cfStart = Date.now();
            while (Date.now() - cfStart < 30000) {
                const isCf = await page.evaluate(() =>
                    document.body?.innerHTML?.includes('cf-wrapper') ||
                    document.title?.includes('Just a moment')
                ).catch(() => false);
                if (!isCf) break;
                await page.waitForTimeout(1500);
            }

            const latency = Date.now() - start;
            const finalUrl = page.url();
            const pageTitle = await page.title().catch(() => '(no title)');

            // Hard 30s rule: if page is blank, consider it down
            if (finalUrl === 'about:blank' || finalUrl === '') {
                console.log(`[FORUM] ⚠️ Health check for ${url}: blank page (title="${pageTitle}")`);
                return { status: 'Unresponsive', latency: null, details: 'No response within 30s' };
            }

            const title = pageTitle;
            const fullHtml = await page.evaluate(() => document.documentElement?.outerHTML || '').catch(() => '');
            const bodyText = await page.evaluate(() => document.body?.innerText || '').catch(() => '');

            console.log(`[FORUM] 🔍 Health check for ${url}: title="${title}", finalUrl="${finalUrl}", bodyLen=${bodyText.length}, htmlLen=${fullHtml.length}`);

            // Check for Cloudflare error pages FIRST
            const isCfError = title.includes('520:') || title.includes('Attention Required') || title.includes('Just a moment')
                || fullHtml.includes('cf-error-details') || fullHtml.includes('cf-alert')
                || (fullHtml.toLowerCase().includes('cloudflare') && (bodyText.includes('blocked') || bodyText.includes('Please enable cookies')));

            if (isCfError) {
                return { status: 'Outage', latency, details: `Origin server error: ${title.slice(0, 80)}` };
            }

            // Forum is alive — phpBB pages have content, og tags, phpbb-specific HTML
            const isPhpbb = fullHtml.includes('phpbb') || fullHtml.includes('forumlist') || fullHtml.includes('ca-pub')
                || finalUrl.includes('index.php') || finalUrl.includes('mode=login');
            const hasContent = bodyText.length > 80;

            if (isPhpbb || hasContent) {
                return { status: 'Good', latency, details: title.slice(0, 100) };
            }

            // Dump full HTML when unknown for debugging
            const forumName = url.replace(/https?:\/\//, '').split('.')[0];
            const dumpPath = `/tmp/health_${forumName}_${Date.now()}.html`;
            const { writeFileSync } = await import('fs');
            writeFileSync(dumpPath, fullHtml, 'utf-8');
            console.log(`[FORUM] 📄 Dumped ${fullHtml.length}b HTML to ${dumpPath} (status=Unknown)`);

            return { status: 'Unknown', latency, details: title.slice(0, 100) };
        } catch (err) {
            const elapsed = Date.now() - start;
            return { status: 'Unresponsive', latency: elapsed > 29000 ? null : elapsed, details: err.message.slice(0, 120) };
        } finally {
            await page.close().catch(() => {});
        }
    }
}

// Singleton — the default shared client (PHMC forum)
let _defaultInstance = null;
export function getForumClient() {
    if (!_defaultInstance) _defaultInstance = new ForumClient();
    return _defaultInstance;
}

/**
 * Create a new isolated ForumClient with its own browser context, page, and
 * session file. Used for cross-forum operations (LSSD, LSPD, DM) so they
 * don't share session state with the main PHMC client.
 *
 * Each isolated client:
 * - Shares the same Chromium browser process (lightweight)
 * - Has its own browser context (separate cookies, localStorage, Cloudflare state)
 * - Has its own session file on disk
 * - Has its own mutex lock (operations on different clients run in parallel)
 *
 * @param {string} name  — short identifier used for the session filename
 * @returns {ForumClient}
 */
export function createIsolatedClient(name = 'isolated') {
    return new ForumClient({
        sessionFile: resolve(__dirname, '..', `forum-session-${name}.json`),
        isIsolated: true,
        sessionDir: __dirname,
    });
}

// ── Posting circuit-breaker wiring ──
// Every forum WRITE goes through one of these five methods, so wrapping them
// covers all callers (deploys, monitors, sweeps, retries) with outcome
// recording + fail-fast pausing. Reads are untouched. Dry runs never record.
// The gate runs BEFORE lock acquisition so paused ops fail fast instead of
// queueing behind the global forum lock.
function _writeTargetUrl(name, args, inst) {
    try {
        if (name === 'postTopic') return args[3] || inst.baseUrl;
        if (name === 'ensureLoggedIn') return inst.baseUrl;
        const opts = args[args.length - 1];
        const optUrl = (opts && typeof opts === 'object' && opts.baseUrl) || null;
        if (optUrl) return optUrl;
        if (name === 'replyToTopic' || name === 'quoteAndPost') return 'https://phmc.gta.world';
        return inst.baseUrl;
    } catch {
        return null;
    }
}

function _writeIsDryRun(name, args) {
    try {
        const opts = args[args.length - 1];
        if (opts && typeof opts === 'object' && opts.dryRun) return true;
    } catch { /* ignore */ }
    return false;
}

const _WRITE_METHODS = ['postTopic', 'replyToTopic', 'sendPM', 'editPostContent', 'quoteAndPost'];
// login feeds the breaker (a login that can't pass Cloudflare predicts a
// posting failure) but is never gated — monitors need it for reads.
// ensureLoggedIn is only ever called by runDeploy, so it is gated (fail fast)
// but never recorded (its inner login call records on its own — recording
// both would double-count every incident).
const _RECORD_METHODS = ['login'];
const _GATE_METHODS = ['ensureLoggedIn'];
for (const _m of [..._WRITE_METHODS, ..._RECORD_METHODS, ..._GATE_METHODS]) {
    const _orig = ForumClient.prototype[_m];
    if (typeof _orig !== 'function') continue;
    const _gate = _WRITE_METHODS.includes(_m) || _GATE_METHODS.includes(_m);
    const _record = _WRITE_METHODS.includes(_m) || _RECORD_METHODS.includes(_m);
    ForumClient.prototype[_m] = async function (..._args) {
        const _url = _writeTargetUrl(_m, _args, this);
        if (_gate) await throwIfPostingPaused(_url, _m);
        const _dry = _writeIsDryRun(_m, _args);
        const _kind = _m === 'login' ? 'login' : 'write';
        try {
            const _res = await _orig.apply(this, _args);
            if (_record && !_dry && _res && _res.ok === true) {
                await recordPostingOutcome(_url, true, '', _kind).catch(() => {});
            } else if (_record && !_dry && _res && _res.ok === false) {
                await recordPostingOutcome(_url, false, _res.reason || '', _kind).catch(() => {});
            }
            return _res;
        } catch (_err) {
            if (_record && !_dry) await recordPostingOutcome(_url, false, (_err && _err.message) || '', _kind).catch(() => {});
            throw _err;
        }
    };
}

export default ForumClient;
