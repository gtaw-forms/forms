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
import { logActivity, describeActivity } from './activityLog.js';

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
 * Close the shared browser (if any) and reset the singleton, so a later call
 * can relaunch. Used on graceful shutdown so pm2 restarts don't orphan Chromium.
 */
export async function closeSharedBrowser(reason = 'shutdown') {
    const browser = _sharedBrowser;
    if (!browser) return;
    console.log(`[LOG] Destroying browser for ${reason}`);
    try { await browser.close(); } catch { /* already closed */ }
    _sharedBrowser = null;
    _browserInitPromise = null;
}

async function getSharedBrowser() {
    if (_sharedBrowser) return _sharedBrowser;
    if (_browserInitPromise) return _browserInitPromise;
    _browserInitPromise = (async () => {
        reapOrphanBrowsers();
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
    }

    /**
     * Acquire a mutual-exclusion lock so only one forum operation runs at a time.
     * All public methods (login, postTopic, sendPM, etc.) call this first.
     * Returns a unique token; call release(token) to hand the lock back.
     */
    async _acquire(owner = 'unknown') {
        const token = Symbol('lock-token');
        let release;
        const prev = this._lock;
        this._lock = new Promise((resolve) => { release = resolve; });
        await prev; // wait for previous holder to finish
        this._lockOwner = owner;
        console.log(`[FORUM] 🔒 Lock acquired by: ${owner}`);
        return { token, release: () => { this._lockOwner = null; release(token); } };
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

        const browser = await getSharedBrowser();

        const opts = {
            viewport: { width: 1280, height: 900 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            locale: 'en-US',
            timezoneId: 'America/New_York',
            ignoreHTTPSErrors: true,
            bypassCSP: false,
        };
        if (existsSync(this.sessionFile)) {
            console.log('[FORUM] 📂 Loading stored session from ' + this.sessionFile);
            opts.storageState = this.sessionFile;
        }

        this.context = await browser.newContext(opts);
        this.page = await this.context.newPage();

        // Activity hook — record every navigation so the dashboard can show
        // what the browser is currently doing (scanning, posting, etc).
        const rawGoto = this.page.goto.bind(this.page);
        this.page.goto = async (url, opts) => {
            const act = describeActivity(url);
            logActivity(act.label, act.detail);
            return rawGoto(url, opts);
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
        const stillValid = !this.page.url().includes('mode=login');
        if (!stillValid) {
            console.log('[FORUM] ⚠️ Session expired — forcing re-login before deploy...');
            await this.login(null, null, { force: true, baseUrl: domain });
        } else {
            console.log('[FORUM] ✅ Session valid');
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

        // If not forcing, check if already logged in via stored session
        if (!force) {
            await this.page.goto(`${domain}/ucp.php`, { waitUntil: 'networkidle', timeout: 180000 });
            await this.page.waitForTimeout(2000);

            if (!this.page.url().includes('mode=login')) {
                console.log('[FORUM] ✅ Already logged in via stored session');
                return { ok: true, method: 'session' };
            }
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

        console.log('[FORUM] ✅ Login successful');
        await this.saveSession();
        } finally { lock.release(); }
        return { ok: true, method: 'credentials' };
    }

    async validateSession() {
        if (!this.hasSession()) return false;
        await this.ensureBrowser();
        await this.page.goto(`${this.baseUrl}/ucp.php`, { waitUntil: 'networkidle', timeout: 180000 });
        return !this.page.url().includes('mode=login');
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

        // Check if we got redirected to a login page (session expired) BEFORE filling form
        const pageUrl = this.page.url();
        let pageTitle = await this.page.title().catch(() => '(no title)');
        if (pageUrl.includes('mode=login') || pageTitle.toLowerCase().includes('login')) {
            console.log(`[FORUM] ⚠️ Login page detected — session expired, logging in directly...`);
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

        // Fill subject and message (now we're definitely on the posting page, not login)
        await this.page.evaluate((s) => {
            const el = document.querySelector('input[name="subject"]');
            if (el) { el.value = s; el.dispatchEvent(new Event('input', { bubbles: true })); }
        }, subject);
        await this.page.evaluate((msg) => {
            const ta = document.querySelector('textarea[name="message"]');
            if (ta) { ta.value = msg; ta.dispatchEvent(new Event('input', { bubbles: true })); return; }
            const ed = document.querySelector('div[contenteditable="true"]');
            if (ed) { ed.textContent = msg; ed.dispatchEvent(new Event('input', { bubbles: true })); }
        }, bbCode);
        await this.page.waitForTimeout(500);

        // Debug: dump page state
        const pageHtml = await this.page.evaluate(() => document.body?.innerHTML?.slice(0, 3000) || '(no body)').catch(() => '(error reading HTML)');
        console.log(`[FORUM] 🔍 Page URL: ${this.page.url()}`);
        console.log(`[FORUM] 🔍 Page title: ${pageTitle}`);

        // Submit
        const result = await this.page.evaluate(() => {
            const form = document.querySelector('form[action*="posting.php"]');
            if (!form) return { ok: false, reason: 'No form found' };
            // Try various submit button selectors — phpBB uses <input> or <button>
            const btn = form.querySelector(
                'input[type="submit"][name="post"], ' +
                'input[type="submit"][value="Submit"], ' +
                'button[type="submit"][name="post"]'
            );
            if (!btn) return { ok: false, reason: 'No submit button' };
            btn.click();
            return { ok: true };
        });

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
            try { await this.page.goto(postUrl, { waitUntil: 'networkidle', timeout: 180000 }); } catch {}
            await this.page.waitForTimeout(2000);
            await this.page.evaluate((s) => {
                const el = document.querySelector('input[name="subject"]');
                if (el) { el.value = s; el.dispatchEvent(new Event('input', { bubbles: true })); }
            }, subject);
            await this.page.evaluate((msg) => {
                const ta = document.querySelector('textarea[name="message"]');
                if (ta) { ta.value = msg; ta.dispatchEvent(new Event('input', { bubbles: true })); return; }
                const ed = document.querySelector('div[contenteditable="true"]');
                if (ed) { ed.textContent = msg; ed.dispatchEvent(new Event('input', { bubbles: true })); }
            }, bbCode);
            await this.page.waitForTimeout(500);
            await this.page.evaluate(() => {
                const form = document.querySelector('form[action*="posting.php"]');
                if (!form) return false;
                const btn = form.querySelector(
                    'input[type="submit"][name="post"], ' +
                    'input[type="submit"][value="Submit"], ' +
                    'button[type="submit"][name="post"]'
                );
                if (!btn) return false;
                btn.click();
                return true;
            });
            await this.page.waitForTimeout(3000);
            try { await this.page.waitForLoadState('networkidle', { timeout: 25000 }); } catch {}
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
            } catch {}
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
                } catch {}
                url = this.page.url();
                ok = url.includes('viewtopic.php');
            }

            // Final check: look for success text
            if (!ok) {
                try { await this.page.waitForTimeout(10000); } catch {}
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

        // Debug: log page state
        const pageUrl = this.page.url();
        const pageTitle = await this.page.title().catch(() => '(no title)');
        console.log(`[FORUM] 🔍 PM page: ${pageTitle} — ${pageUrl}`);

        // Recipient is set via the URL parameter username_list=Name above,
        // which phpBB handles server-side. Most themes don't render a visible
        // username_list input on the page — so we skip any DOM manipulation here.

        // Fill subject
        await this.page.evaluate((s) => {
            const el = document.querySelector('input[name="subject"]');
            if (el) { el.value = s; el.dispatchEvent(new Event('input', { bubbles: true })); }
        }, subject);

        // Fill message
        const msgOk = await this.page.evaluate((msg) => {
            const ta = document.querySelector('textarea[name=\"message\"]');
            if (ta) { ta.value = msg; ta.dispatchEvent(new Event('input', { bubbles: true })); return true; }
            const ed = document.querySelector('div[contenteditable="true"]');
            if (ed) { ed.textContent = msg; ed.dispatchEvent(new Event('input', { bubbles: true })); return true; }
            return false;
        }, bbCode);

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

        // Submit
        console.log(`[FORUM] 📤 Submitting PM form...`);
        const result = await this.page.evaluate(() => {
            const form = document.querySelector('form[action*="ucp.php"]');
            if (!form) return { ok: false, reason: 'No form found' };
            // Try multiple button patterns — some phpBB forums use <input>, others use <button>
            const btn = form.querySelector(
                'input[type="submit"][name="submit"], ' +
                'input[type="submit"][value="Submit"], ' +
                'button[type="submit"][name="post"], ' +
                'button[type="submit"][value="Submit"]'
            );
            if (!btn) return { ok: false, reason: 'No submit button' };
            btn.click();
            return { ok: true };
        });

        if (!result.ok) {
            const pageHtml = await this.page.evaluate(() => document.body?.innerHTML?.slice(0, 3000) || '(no body)').catch(() => '(error reading HTML)');
            console.error(`[FORUM] ❌ ${result.reason} — dumping page state`);
            console.log(`[FORUM] 🔍 HTML snippet (first 2000 chars):`);
            console.log(pageHtml.slice(0, 2000));
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
                    const errEl = document.querySelector('.error, .notification.error');
                    return errEl ? errEl.textContent.trim() : null;
                }).catch(() => null);
                if (errMsg) {
                    console.warn(`[FORUM] ❌ PM error detected: "${errMsg}"`);
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

        console.log(`[FORUM] 📬 PM result: ${ok ? '✅ Sent' : '⚠️ Unknown'} — ${finalUrl}`);
        } finally { lock.release(); }

        return {
            ok,
            url: ok ? finalUrl : null,
            recipient,
            subject,
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

        await this.page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 180000 });
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
                await this.page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 180000 });
            } catch (navErr) {
                console.log(`[FORUM] ⚠️ Navigation error (${navErr.message}), retrying with lenient wait...`);
                await this.page.goto(searchUrl, { waitUntil: 'load', timeout: 180000 });
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
                await this.page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 180000 });
            } catch (navErr) {
                console.log(`[FORUM] ⚠️ Navigate error (${navErr.message}), retrying with lenient wait...`);
                await this.page.goto(searchUrl, { waitUntil: 'load', timeout: 180000 });
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
                    await this.page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 180000 });
                } catch (navErr) {
                    console.log(`[FORUM] ⚠️ Retry navigate error (${navErr.message}), using lenient wait...`);
                    await this.page.goto(searchUrl, { waitUntil: 'load', timeout: 180000 });
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
            pageTitle = await this.page.title().catch(() => '(no title)');
            console.log(`[FORUM] 🔍 After re-login — page title: "${pageTitle}", URL: ${this.page.url()}`);

            // Still check if we ended up on a login page
            const afterLoginUrl = this.page.url();
            if (afterLoginUrl.includes('mode=login') || afterLoginUrl.includes('mode=post') || pageTitle.toLowerCase().includes('login')) {
                console.error(`[FORUM] ❌ Still on login page after re-auth — cannot reply`);
                return { ok: false, url: afterLoginUrl, reason: 'Redirected to login' };
            }
        }

        // Fill the message body
        const msgOk = await this.page.evaluate((msg) => {
            const ta = document.querySelector('textarea[name=\"message\"]');
            if (ta) { ta.value = msg; ta.dispatchEvent(new Event('input', { bubbles: true })); return true; }
            const ed = document.querySelector('div[contenteditable="true"]');
            if (ed) { ed.textContent = msg; ed.dispatchEvent(new Event('input', { bubbles: true })); return true; }
            return false;
        }, bbCode);

        if (!msgOk) {
            console.error('[FORUM] ❌ No message textarea found on reply page');
            return { ok: false, url: pageUrl, reason: 'No message textarea' };
        }

        console.log(`[FORUM] ✅ Reply form filled (${bbCode.length} chars)`);

        if (dryRun) {
            console.log(`[FORUM] 🏜️ DRY RUN — form filled but not submitted. Set dryRun=false to enable.`);
            return { ok: true, url: replyUrl, dryRun: true };
        }

        // Submit the reply
        console.log(`[FORUM] 📤 Submitting reply...`);
        const result = await this.page.evaluate(() => {
            const form = document.querySelector('form[action*="posting.php"]');
            if (!form) return { ok: false, reason: 'No form found' };
            const btn = form.querySelector(
                'input[type="submit"][name="post"], ' +
                'input[type="submit"][value="Submit"], ' +
                'button[type="submit"][name="post"]'
            );
            if (!btn) return { ok: false, reason: 'No submit button' };
            btn.click();
            return { ok: true };
        });

        if (!result.ok) {
            console.error(`[FORUM] ❌ ${result.reason}`);
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
            const filled = await this.page.evaluate((msg) => {
                const ta = document.querySelector('textarea[name="message"]');
                if (ta) { ta.value = msg; ta.dispatchEvent(new Event('input', { bubbles: true })); return true; }
                const ed = document.querySelector('div[contenteditable="true"]');
                if (ed) { ed.textContent = msg; ed.dispatchEvent(new Event('input', { bubbles: true })); return true; }
                return false;
            }, bbCode);
            if (!filled) console.error('[FORUM] ❌ No message textarea found on retry form');
            return filled;
        };

        const clickSubmit = async () => {
            const r = await this.page.evaluate(() => {
                const form = document.querySelector('form[action*="posting.php"]');
                if (!form) return { ok: false, reason: 'No form found' };
                const btn = form.querySelector(
                    'input[type="submit"][name="post"], ' +
                    'input[type="submit"][value="Submit"], ' +
                    'button[type="submit"][name="post"]'
                );
                if (!btn) return { ok: false, reason: 'No submit button' };
                btn.click();
                return { ok: true };
            });
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
            try { await this.page.goto(replyUrl, { waitUntil: 'networkidle', timeout: 180000 }); } catch {}
            await this.page.waitForTimeout(2000);
            if (!(await fillMessage())) return;
            console.log(`[FORUM] 📤 Re-submitting reply after reload...`);
            const r = await clickSubmit();
            if (r !== true) { console.error(`[FORUM] ❌ ${r}`); return; }
            await this.page.waitForTimeout(3000);
            try { await this.page.waitForLoadState('networkidle', { timeout: 25000 }); } catch {}
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
            } catch {}

            if (reSubmitted) {
                try {
                    await Promise.race([
                        this.page.waitForNavigation({ timeout: 20000 }),
                        this.page.waitForTimeout(20000),
                    ]);
                } catch {}
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
                } catch {}
                finalUrl = this.page.url();
            }

            // Strategy 3: If still on posting.php, check page for success indicators
            if (!finalUrl.includes('viewtopic.php') && !finalUrl.includes('p=')) {
                // Wait a bit longer — Cloudflare challenges or slow rendering may
                // delay the redirect. Give it 10 more seconds before checking.
                try { await this.page.waitForTimeout(10000); } catch {}
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
            try { mkdirSync(dirname(dumpPath), { recursive: true }); writeFileSync(dumpPath, pageHtml, 'utf-8'); console.log(`[FORUM] 💾 Full page HTML saved to ${dumpPath} for debugging`); } catch (e) {}
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
            await this.page.goto(topicPage, { waitUntil: 'domcontentloaded', timeout: 180000 });
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
            await this.page.goto(qUrl, { waitUntil: 'networkidle', timeout: 180000 });
            await this.page.waitForTimeout(2000);

            // Handle login redirect
            let pUrl = this.page.url();
            let pTitle = await this.page.title().catch(() => '');
            if (pUrl.includes('mode=login') || pTitle.toLowerCase().includes('login')) {
                console.log('[FORUM] ⚠️ Login on quote fetch — re-authenticating');
                await this.page.fill('input[name="username"]', this.username, { timeout: 10000 });
                await this.page.fill('input[name="password"]', this.password, { timeout: 10000 });
                await this.page.evaluate(() => {
                    const btn = document.querySelector('input[type="submit"]') || document.querySelector('button[type="submit"]');
                    if (btn) btn.click();
                });
                await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
                await this.page.waitForTimeout(3000);
                await this.saveSession();
                await this.page.goto(qUrl, { waitUntil: 'networkidle', timeout: 180000 });
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
            await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
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

                // Detect last page: if fewer members than page size OR no pagination at all
                if (!paginate || pageMembers.length < PAGE_SIZE) {
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
     * @returns {Promise<{ok: boolean, url?: string}>}
     */
            async quoteAndPost(sourceTopicId, sourceForumId, targetForumId, title, { baseUrl } = {}) {
        const lock = await this._acquire("quoteAndPost");
        try {
            await this.ensureBrowser();
            const domain = baseUrl || "https://phmc.gta.world";

            const topicPage = domain + "/viewtopic.php?t=" + sourceTopicId;
            console.log("[FORUM] Fetching post ID from topic #" + sourceTopicId);
            await this.page.goto(topicPage, { waitUntil: "domcontentloaded", timeout: 180000 });
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
            await this.page.goto(quoteUrl, { waitUntil: "networkidle", timeout: 180000 });
            await this.page.waitForTimeout(2000);

            let qUrl = this.page.url();
            let qTitle = await this.page.title().catch(() => "");
            if (qUrl.includes("mode=login") || qTitle.toLowerCase().includes("login")) {
                console.log("[FORUM] Login on quote, re-authing");
                await this.page.fill('input[name="username"]', this.username, { timeout: 10000 });
                await this.page.fill('input[name="password"]', this.password, { timeout: 10000 });
                await this.page.evaluate(() => {
                    const btn = document.querySelector('input[type="submit"]') || document.querySelector('button[type="submit"]');
                    if (btn) btn.click();
                });
                await this.page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
                await this.page.waitForTimeout(3000);
                await this.saveSession();
                await this.page.goto(quoteUrl, { waitUntil: "networkidle", timeout: 180000 });
                await this.page.waitForTimeout(2000);
            }

            const quotedBBCode = await this.page.evaluate(() => {
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

            const postUrl = domain + "/posting.php?mode=post&f=" + targetForumId;
            console.log("[FORUM] Posting to f=" + targetForumId + " - " + title);
            await this.page.goto(postUrl, { waitUntil: "networkidle", timeout: 180000 });
            await this.page.waitForTimeout(2000);

            let pUrl = this.page.url();
            let pTitle = await this.page.title().catch(() => "");
            if (pUrl.includes("mode=login") || pTitle.toLowerCase().includes("login")) {
                console.log("[FORUM] Login on post, re-authing");
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
     * navigate → waitForCloudflare → check result. Reuses any existing login session.
     *
     * @param {string} url - Forum base URL to check (e.g. https://phmc.gta.world)
     * @returns {Promise<{status: string, latency: number|null, details: string}>}
     */
    async checkHealth(url) {
        const lock = await this._acquire('checkHealth');
        try {
        await this.ensureBrowser();
        const page = await this.context.newPage();
        const start = Date.now();
        try {
            // Navigate to forum index — 30s hard cap, if blank it's down
            await page.goto(`${url}/index.php`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
            await page.waitForTimeout(2000);

            // Quick Cloudflare challenge poll (30s max)
            await this.waitForCloudflare(30000);

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
        } finally { lock.release(); }
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

export default ForumClient;
