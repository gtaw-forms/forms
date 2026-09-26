/** One-shot wall probe: load the posting page, dump state, submit a TEST topic only if the form is present. */
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'url';

chromium.use(StealthPlugin());

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION = resolve(__dirname, '..', 'forum-session.json');
const TARGET = 'https://phmc.gta.world/posting.php?mode=post&f=265';
const DUMP = (n) => `/tmp/probe-${n}.html`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function summarize(label, page) {
    return (async () => {
        const url = page.url();
        const title = await page.title().catch(() => '(no title)');
        const html = await page.content().catch(() => '');
        const text = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
        const forms = await page.evaluate(() =>
            Array.from(document.querySelectorAll('form')).map((f) => f.getAttribute('action') || '(no action)')
        ).catch(() => []);
        const challenged = /just a moment/i.test(title) || /cf-chl|challenge-form|cf-wrapper/.test(html);
        return { label, url, title, htmlLen: html.length, textLen: text.length, forms, challenged, textHead: text.replace(/\s+/g, ' ').slice(0, 300) };
    })();
}

let browser = null;
try {
    browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--disable-gpu', '--no-first-run'],
    });
    const opts = {
        viewport: { width: 1280, height: 900 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        locale: 'en-US',
        ignoreHTTPSErrors: true,
    };
    if (existsSync(SESSION)) {
        console.log(JSON.stringify({ session: true }));
        opts.storageState = SESSION;
    } else {
        console.log(JSON.stringify({ session: false }));
    }
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    // Mirror production: block images/media/fonts.
    await page.route('**/*', (route) => {
        const t = route.request().resourceType();
        if (t === 'image' || t === 'media' || t === 'font') return route.abort();
        return route.continue();
    }).catch(() => {});

    await page.goto(TARGET, { waitUntil: 'networkidle', timeout: 120000 }).catch((e) => console.log(JSON.stringify({ gotoError: e.message.slice(0, 120) })));
    await sleep(3000);
    let s = await summarize('after-load', page);
    console.log(JSON.stringify(s));
    writeFileSync(DUMP('1-after-load'), await page.content().catch(() => ''), 'utf8');

    // Patient watch: up to WAIT_MS for the form to appear. Snapshot every
    // 30s (Ray ID changes reveal Cloudflare auto-retries).
    const WAIT_MS = parseInt(process.argv[2] || '600000', 10);
    const rayOf = (t) => {
        const m = String(t).match(/Ray ID:\s*([a-f0-9]+)/i);
        return m ? m[1] : null;
    };
    let formSeen = s.forms.some((a) => String(a).includes('posting.php'));
    const t0 = Date.now();
    while (!formSeen && Date.now() - t0 < WAIT_MS) {
        await sleep(30000);
        const cur = await summarize('watch', page).catch(() => null);
        if (!cur) break;
        formSeen = cur.forms.some((a) => String(a).includes('posting.php'));
        console.log(JSON.stringify({
            watch: true,
            elapsedS: Math.round((Date.now() - t0) / 1000),
            title: cur.title,
            ray: rayOf(cur.textHead),
            htmlLen: cur.htmlLen,
            forms: cur.forms.length,
            challenged: cur.challenged,
        }));
    }

    const hasForm = formSeen;
    if (!hasForm) {
        console.log(JSON.stringify({ submit: 'skipped', reason: 'no posting form appeared within watch window' }));
        writeFileSync(DUMP('2-after-wait'), await page.content().catch(() => ''), 'utf8');
    } else {
        const subject = '[TEST] Wall-probe post — DELETE ME ((Bot Test))';
        const body = 'Automated connectivity probe by the PHMC bot. This thread will be deleted manually. Please ignore.';
        // Trusted input (mirrors production): real key/click events.
        await page.fill('input[name="subject"]', subject, { timeout: 10000 }).catch(() => {});
        const filledMsg = await page.fill('textarea[name="message"]', body, { timeout: 10000 }).then(() => true).catch(() => false);
        if (!filledMsg) await page.fill('div[contenteditable="true"]', body, { timeout: 10000 }).catch(() => {});
        await sleep(1000);
        const clicked = await page.click('form[action*="posting.php"] input[type="submit"][name="post"], form[action*="posting.php"] input[type="submit"][value="Submit"], form[action*="posting.php"] button[type="submit"][name="post"]', { timeout: 15000 }).then(() => true).catch(() => false);
        console.log(JSON.stringify({ trustedSubmitClicked: clicked }));
        await sleep(5000);
        try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
        await sleep(2000);
        s = await summarize('after-submit', page);
        console.log(JSON.stringify(s));
        writeFileSync(DUMP('3-after-submit'), await page.content().catch(() => ''), 'utf8');
        console.log(JSON.stringify({ submit: s.url.includes('viewtopic.php') ? 'SUCCESS' : 'UNCLEAR', resultUrl: s.url }));
    }

    // ── Phase 2: GTA.World main site access check (read-only, no submit) ──
    console.log(JSON.stringify({ phase: 'gtaworld-access' }));
    await page.goto('https://gta.world/', { waitUntil: 'networkidle', timeout: 120000 }).catch((e) => console.log(JSON.stringify({ gotoError: e.message.slice(0, 120) })));
    await sleep(3000);
    let g = await summarize('gtaworld-load', page);
    console.log(JSON.stringify(g));
    writeFileSync(DUMP('4-gtaworld'), await page.content().catch(() => ''), 'utf8');
    const gw0 = Date.now();
    while (g.challenged && Date.now() - gw0 < 60000) {
        await sleep(10000);
        g = await summarize('gtaworld-poll', page).catch(() => null);
        if (!g) break;
    }
    if (g) {
        console.log(JSON.stringify({ phase: 'gtaworld-final', challenged: g.challenged, title: g.title, url: g.url, forms: g.forms.length }));
        writeFileSync(DUMP('5-gtaworld-final'), await page.content().catch(() => ''), 'utf8');
    }
} catch (err) {
    console.log(JSON.stringify({ fatal: err.message.slice(0, 200) }));
} finally {
    try { await browser.close(); } catch {}
}
process.exit(0);
