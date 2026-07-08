import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

chromium.use(StealthPlugin());

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = resolve(__dirname, '..', 'forum-session.json');

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
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this._lock = Promise.resolve();
        this._lockOwner = null;
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
        if (this.browser && this.context) return;


        this.browser = await chromium.launch({
            headless: this.headless,
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

        const opts = {
            viewport: { width: 1280, height: 900 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            locale: 'en-US',
            timezoneId: 'America/New_York',
            ignoreHTTPSErrors: true,
            bypassCSP: false,
        };
        if (existsSync(SESSION_FILE)) {
            console.log('[FORUM] 📂 Loading stored session');
            opts.storageState = SESSION_FILE;
        }

        this.context = await this.browser.newContext(opts);
        this.page = await this.context.newPage();

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

    async close() {
        const lock = await this._acquire('close');
        try {
        if (this.browser) {
            try { await this.browser.close(); } catch { /* ignore */ }
            this.browser = null;
            this.context = null;
            this.page = null;
            console.log('[FORUM] 🛑 Browser closed');
        }
        } finally { lock.release(); }
    }

    // ── Session ──

    async saveSession() {
        if (!this.context) return;
        const state = await this.context.storageState();
        writeFileSync(SESSION_FILE, JSON.stringify(state, null, 2), 'utf-8');
        console.log(`[FORUM] 💾 Session saved to ${SESSION_FILE}`);
    }

    hasSession() {
        return existsSync(SESSION_FILE);
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
            const debugPath = resolve(__dirname, '..', 'debug-login-page.html');
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
            const debugPath = resolve(__dirname, '..', 'debug-login-page.html');
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

        await this.page.waitForTimeout(5000);
        url = this.page.url();
        ok = url.includes('viewtopic.php');

        } finally { lock.release(); }
        return {
            ok,
            url: ok ? url : null,
            title: subject,
        };
    }

    // ── Private Message ──

    async sendPM(recipient, subject, bbCode, { baseUrl: baseUrlOverride } = {}) {
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

        // Ensure recipient is filled
        await this.page.evaluate((r) => {
            const el = document.querySelector('input[name="username_list"]');
            if (el && !el.value) { el.value = r; el.dispatchEvent(new Event('input', { bubbles: true })); }
        }, recipient);

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
            console.error(`[FORUM] ❌ No message textarea or editor found — dumping page state`);
            const pageHtml = await this.page.evaluate(() => document.body?.innerHTML?.slice(0, 3000) || '(no body)').catch(() => '(error reading HTML)');
            console.log(`[FORUM] 🔍 HTML snippet:`);
            console.log(pageHtml.slice(0, 2000));
            throw new Error('No message textarea or editor found on PM compose page');
        }

        console.log(`[FORUM] ✅ Form filled (${bbCode.length} chars)`);
        await this.page.waitForTimeout(1000);

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
        finalUrl = this.page.url();
        ok = finalUrl.includes('&msg=') || finalUrl.includes('mode=view') || !finalUrl.includes('mode=compose');

        // ── Handle phpBB Preview Step ──
        // phpBB shows a preview page before the actual send.
        // If we're still on compose with action=post, look for a preview box and re-submit.
        if (!ok && finalUrl.includes('action=post')) {
            const hasPreview = await this.page.evaluate(() => {
                // phpBB shows a preview box or a second submit form
                return !!(
                    document.getElementById('preview') ||
                    document.querySelector('.postbody, .pm_preview, .preview') ||
                    document.querySelector('input[type="submit"][name="post"][accesskey="s"]')
                );
            }).catch(() => false);

            if (hasPreview) {
                console.log(`[FORUM] 🔄 Preview detected — clicking final Submit...`);
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
                    await this.page.waitForTimeout(5000);
                }
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
        }

        if (!ok) {
            const pageTitle = await this.page.title().catch(() => '(no title)');
            console.log(`[FORUM] ⚠️ PM submit landed on: "${pageTitle}" — ${finalUrl}`);

            // Save full HTML dump for debugging (always on failure)
            const debugHtml = await this.page.evaluate(() => document.documentElement?.outerHTML || '(no html)').catch(() => '(error)');
            const debugPath = resolve(__dirname, '..', 'debug-pm-page.html');
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
        try {
        await this.ensureBrowser();

        const searchUrl = `https://phmc.gta.world/search.php?keywords=${encodeURIComponent(patientID)}&fid[]=97&sf=firstpost`;
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
            return { topicId: null, title: null };
        }

        // Parse the first result link — phpBB search results link to viewtopic.php?t=XXXXX
        const result = await this.page.evaluate((searchId) => {
            // Look for topic links in results — they point to viewtopic.php?t=XXXXX
            const links = document.querySelectorAll('a[href*="viewtopic.php"]');
            for (const link of links) {
                const href = link.getAttribute('href') || '';
                const match = href.match(/[?&]t=(\d+)/);
                if (match) {
                    const title = link.textContent?.trim() || '';
                    // Verify the result contains our search ID to avoid false matches
                    if (title.includes(searchId)) {
                        return { topicId: parseInt(match[1], 10), title };
                    }
                }
            }
            // Fallback: return first topic link even if title doesn't match
            for (const link of links) {
                const href = link.getAttribute('href') || '';
                const match = href.match(/[?&]t=(\d+)/);
                if (match) {
                    return { topicId: parseInt(match[1], 10), title: link.textContent?.trim() || null };
                }
            }
            return { topicId: null, title: null };
        }, patientID).catch(() => ({ topicId: null, title: null }));

        if (result.topicId) {
            console.log(`[FORUM] ✅ Found topic #${result.topicId}: "${result.title}"`);
        } else {
            console.log('[FORUM] ⚠️ Search returned results but could not parse topic link');
        }
        } finally { lock.release(); }

        return result;
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

        await this.page.goto(replyUrl, { waitUntil: 'networkidle', timeout: 180000 });
        await this.page.waitForTimeout(2000);

        const pageUrl = this.page.url();
        const pageTitle = await this.page.title().catch(() => '(no title)');
        console.log(`[FORUM] 🔍 Reply page: "${pageTitle}" — ${pageUrl}`);

        // Check if the topic exists / we can access it
        if (pageUrl.includes('mode=login') || pageUrl.includes('mode=post')) {
            console.error(`[FORUM] ❌ Cannot reply — redirected to "${pageUrl}"`);
            return { ok: false, url: pageUrl, reason: 'Redirected away from reply page' };
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
        finalUrl = this.page.url();

        // Handle phpBB preview: if still on posting page after submit, click the real Submit button
        if (!finalUrl.includes('viewtopic.php') && finalUrl.includes('posting.php')) {
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
                const pageText = await this.page.evaluate(() => document.body.innerText || '').catch(() => '');
                if (pageText.includes('posted successfully') || pageText.includes('Your message has been sent') || pageText.includes('has been submitted')) {
                    console.log(`[FORUM] ✅ Page content indicates success despite URL`);
                    ok = true;
                }
            }
        }

        ok = ok || finalUrl.includes('viewtopic.php') || finalUrl.includes('p=');
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
     * @returns {Promise<Array<{name: string, userId: string|null}>>}
     */
    async getGroupMembers(groupId, { baseUrl, exclude = [] } = {}) {
        const lock = await this._acquire('getGroupMembers');
        try {
            await this.ensureBrowser();
            const domain = baseUrl || this.baseUrl;
            const url = `${domain}/memberlist.php?mode=group&g=${groupId}`;
            console.log(`[FORUM] 👥 Fetching group members for g=${groupId}...`);
            await this.page.goto(url, { waitUntil: 'networkidle', timeout: 180000 });
            await this.page.waitForTimeout(2000);

            const members = await this.page.evaluate(() => {
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

            console.log(`[FORUM] 👥 Group members: [${members.map(m => `"${m.name}"`).join(', ')}]`);

            // Deduplicate and filter exclusions
            const seen = new Set();
            const filtered = members.filter(({ name }) => {
                if (!name || seen.has(name)) return false;
                if (exclude.some((e) => name.toLowerCase() === e.toLowerCase())) return false;
                seen.add(name);
                return true;
            });

            console.log(`[FORUM] 👥 Found ${filtered.length} group members (${members.length} total, ${exclude.length} excluded)`);
            return filtered;
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
        'patient_notes':     { forumId: 97,  name: 'Medical Records', url: 'https://phmc.gta.world/posting.php?mode=post&f=97' },
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

// Singleton
let instance = null;
export function getForumClient() {
    if (!instance) instance = new ForumClient();
    return instance;
}

export default ForumClient;
