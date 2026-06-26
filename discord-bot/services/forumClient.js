import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

chromium.use(StealthPlugin());

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = resolve(__dirname, '..', 'forum-session.json');

class ForumClient {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
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

        console.log('[FORUM] 🚀 Launching browser...');
        this.browser = await chromium.launch({
            headless: this.headless,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const opts = { viewport: { width: 1280, height: 900 } };
        if (existsSync(SESSION_FILE)) {
            console.log('[FORUM] 📂 Loading stored session');
            opts.storageState = SESSION_FILE;
        }

        this.context = await this.browser.newContext(opts);
        this.page = await this.context.newPage();

        if (this.debug) {
            this.page.on('console', (msg) => console.log(`[FORUM PAGE] ${msg.type()}: ${msg.text()}`));
            this.page.on('pageerror', (err) => console.error(`[FORUM PAGE ERROR] ${err.message}`));
        }
    }

    async close() {
        if (this.browser) {
            try { await this.browser.close(); } catch { /* ignore */ }
            this.browser = null;
            this.context = null;
            this.page = null;
            console.log('[FORUM] 🛑 Browser closed');
        }
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

    // ── Authentication ──

    async login(overrideUsername, overridePassword, { force = false, baseUrl: baseUrlOverride } = {}) {
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
        await this.page.goto(`${domain}/index.php`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
        await this.page.waitForTimeout(3000);

        // If not forcing, check if already logged in via stored session
        if (!force) {
            await this.page.goto(`${domain}/ucp.php`, { waitUntil: 'networkidle', timeout: 30000 });
            await this.page.waitForTimeout(2000);

            if (!this.page.url().includes('mode=login')) {
                console.log('[FORUM] ✅ Already logged in via stored session');
                return { ok: true, method: 'session' };
            }
        }

        // Fill login form
        console.log('[FORUM] 🔑 Logging in...');
        // Navigate to login page explicitly before filling
        await this.page.goto(`${domain}/ucp.php?mode=login`, { waitUntil: 'networkidle', timeout: 30000 });
        await this.page.waitForTimeout(2000);

        await this.page.fill('input[name="username"]', username);
        await this.page.fill('input[name="password"]', password);

        await this.page.evaluate(() => {
            const btn = document.querySelector('input[type="submit"]') || document.querySelector('button[type="submit"]');
            if (btn) btn.click();
        });

        await this.page.waitForTimeout(5000);

        if (this.page.url().includes('mode=login')) {
            const errText = await this.page.locator('.error, .notification, .alert, #message').first().textContent().catch(() => '(no error element)');
            throw new Error(`Login failed: ${errText}`);
        }

        console.log('[FORUM] ✅ Login successful');
        await this.saveSession();
        return { ok: true, method: 'credentials' };
    }

    async validateSession() {
        if (!this.hasSession()) return false;
        await this.ensureBrowser();
        await this.page.goto(`${this.baseUrl}/ucp.php`, { waitUntil: 'networkidle', timeout: 30000 });
        return !this.page.url().includes('mode=login');
    }

    // ── Topic Posting ──

    async postTopic(forumId, subject, bbCode, forumUrlOverride) {
        await this.ensureBrowser();
        console.log(`[FORUM] 📝 Posting new topic to forum ${forumId}: "${subject}"`);

        const postUrl = forumUrlOverride || `${this.baseUrl}/posting.php?mode=post&f=${forumId}`;
        console.log(`[FORUM] 🌐 Navigating to ${postUrl}`);
        await this.page.goto(postUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await this.page.waitForTimeout(2000);

        // Fill subject
        await this.page.evaluate((s) => {
            const el = document.querySelector('input[name="subject"]');
            if (el) { el.value = s; el.dispatchEvent(new Event('input', { bubbles: true })); }
        }, subject);

        // Fill message
        await this.page.evaluate((msg) => {
            const ta = document.querySelector('textarea[name="message"]');
            if (ta) { ta.value = msg; ta.dispatchEvent(new Event('input', { bubbles: true })); return; }
            const ed = document.querySelector('div[contenteditable="true"]');
            if (ed) { ed.textContent = msg; ed.dispatchEvent(new Event('input', { bubbles: true })); }
        }, bbCode);

        await this.page.waitForTimeout(1000);

        // Debug: dump page state for troubleshooting
        const pageUrl = this.page.url();
        const pageTitle = await this.page.title().catch(() => '(no title)');
        const pageHtml = await this.page.evaluate(() => document.body?.innerHTML?.slice(0, 3000) || '(no body)').catch(() => '(error reading HTML)');
        console.log(`[FORUM] 🔍 Page URL: ${pageUrl}`);
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
        const url = this.page.url();
        const ok = url.includes('viewtopic.php');

        return {
            ok,
            url: ok ? url : null,
            title: subject,
        };
    }

    // ── Private Message ──

    async sendPM(recipient, subject, bbCode) {
        await this.ensureBrowser();
        console.log(`[FORUM] ✉️ Sending PM to ${recipient}: "${subject}"`);

        const composeUrl = `${this.baseUrl}/ucp.php?i=pm&mode=compose&username_list=${encodeURIComponent(recipient)}`;
        await this.page.goto(composeUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await this.page.waitForTimeout(3000);

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
        await this.page.evaluate((msg) => {
            const ta = document.querySelector('textarea[name="message"]');
            if (ta) { ta.value = msg; ta.dispatchEvent(new Event('input', { bubbles: true })); return; }
            const ed = document.querySelector('div[contenteditable="true"]');
            if (ed) { ed.textContent = msg; ed.dispatchEvent(new Event('input', { bubbles: true })); }
        }, bbCode);

        await this.page.waitForTimeout(1000);

        // Submit
        const result = await this.page.evaluate(() => {
            const form = document.querySelector('form[action*="ucp.php"]');
            if (!form) return { ok: false, reason: 'No form found' };
            const btn = form.querySelector('input[type="submit"][name="submit"], input[type="submit"][value="Submit"]');
            if (!btn) return { ok: false, reason: 'No submit button' };
            btn.click();
            return { ok: true };
        });

        if (!result.ok) throw new Error(result.reason);

        await this.page.waitForTimeout(5000);
        const url = this.page.url();
        const ok = url.includes('&msg=') || url.includes('mode=view') || !url.includes('mode=compose');

        return {
            ok,
            url: ok ? url : null,
            recipient,
            subject,
        };
    }

    // ── Forum Mappings ──

    static FORUM_MAP = {
        'coroner-report':  { forumId: 3, name: 'Coroner Reports' },
        'death-record':    { forumId: 4, name: 'Death Records' },
        'mass-ftality-test': { forumId: 5, name: 'Mass Fatality Reports' },
    };

    static resolveForumId(formId, formName) {
        if (ForumClient.FORUM_MAP[formId]) return ForumClient.FORUM_MAP[formId];
        const n = (formName || '').toLowerCase();
        if (n.includes('autopsy')) return { forumId: 6, name: 'Autopsy Requests' };
        return null;
    }
}

// Singleton
let instance = null;
export function getForumClient() {
    if (!instance) instance = new ForumClient();
    return instance;
}

export default ForumClient;
