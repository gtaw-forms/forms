// debug-testing-scripts/death-record-scan.mjs
// Scan the PHMC Death Records forum (f=404) and list every Death Record topic
// posted since Mon May 04, 2026 3:27 pm. Single-page scan — the forum lists
// newest-first, so all topics since the cutoff appear on page 1.
//
// Uses the bot's existing Playwright forum client (stored session / auto login).
// Prints a neat, numbered list to the terminal.
//
// Usage (on VPS or localhost, from discord-bot/):
//   node debug-testing-scripts/death-record-scan.mjs
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
    const envPath = resolve(__dirname, '..', '.env');
    if (!existsSync(envPath)) {
        console.warn('[DEATH-SCAN] No .env found at ' + envPath);
        return;
    }
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const sepIndex = trimmed.indexOf('=');
        if (sepIndex === -1) continue;
        const key = trimmed.slice(0, sepIndex).trim();
        const value = trimmed.slice(sepIndex + 1).trim();
        if (!process.env[key]) process.env[key] = value;
    }
}
loadEnv();

import { getForumClient } from '../services/forumClient.js';

const PHMC_BASE = 'https://phmc.gta.world';
const FORUM_ID = 404;
const CUTOFF = new Date('2026-05-04T15:27:00'); // Mon May 04, 2026 3:27 pm

function parseForumTime(datetimeAttr, displayText) {
    if (datetimeAttr) {
        const t = new Date(datetimeAttr);
        if (!Number.isNaN(t.getTime())) return t;
    }
    const m = (displayText || '').match(/(\w+)\s+(\w+)\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2})\s+(am|pm)/i);
    if (m) {
        const [, , month, day, year, hour, minute, ampm] = m;
        const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
        let h = parseInt(hour, 10) % 12;
        if (/pm/i.test(ampm)) h += 12;
        return new Date(parseInt(year, 10), months[month], parseInt(day, 10), h, parseInt(minute, 10));
    }
    return null;
}

async function scrapePage(client, url) {
    await client.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
    await client.page.waitForTimeout(2000);

    const cfStart = Date.now();
    while (Date.now() - cfStart < 20000) {
        const isCf = await client.page.evaluate(() =>
            document.body?.innerHTML?.includes('cf-wrapper') ||
            document.title?.includes('Just a moment')
        ).catch(() => false);
        if (!isCf) break;
        await client.page.waitForTimeout(1500);
    }

    return client.page.evaluate((base) => {
        const rows = document.querySelectorAll('ul.topiclist li.row');
        const topics = [];
        rows.forEach((row) => {
            const titleEl = row.querySelector('a.topictitle, a.topictitle2, a[href*="viewtopic.php"]');
            if (!titleEl) return;
            const href = titleEl.getAttribute('href') || '';
            const tMatch = href.match(/[?&]t=(\d+)/);
            if (!tMatch) return;
            const title = titleEl.textContent?.trim() || '';
            if (!title) return;

            const timeEl = row.querySelector('time');
            const datetimeAttr = timeEl?.getAttribute('datetime') || null;
            const lastpostText = row.querySelector('.lastpost')?.textContent?.trim() || '';

            topics.push({
                topicId: parseInt(tMatch[1], 10),
                title,
                href: href.startsWith('http') ? href : base + '/' + href.replace(/^\.\//, ''),
                datetimeAttr,
                lastpostText,
            });
        });
        return topics;
    }, PHMC_BASE);
}

async function main() {
    console.log(`[DEATH-SCAN] Scanning PHMC Death Records (f=${FORUM_ID}) for topics since ${CUTOFF.toLocaleString()}...\n`);

    const client = getForumClient();
    await client.ensureBrowser();
    await client.login(null, null, { force: false, baseUrl: PHMC_BASE });

    // Forum lists newest-first — the cutoff (May 2026) is comfortably on page 1,
    // so a single-page scan is sufficient.
    const url = `${PHMC_BASE}/viewforum.php?f=${FORUM_ID}`;
    console.log(`[DEATH-SCAN] Page 1: ${url}`);
    const topics = await scrapePage(client, url);

    const allTopics = [];
    for (const t of topics) {
        const date = parseForumTime(t.datetimeAttr, t.lastpostText);
        t.date = date;
        if (!date) {
            console.log(`[DEATH-SCAN]   #${t.topicId} — unparseable date "${t.lastpostText || '(none)'}"`);
            continue;
        }
        if (date >= CUTOFF) allTopics.push(t);
    }

    allTopics.sort((a, b) => (a.date - b.date));

    console.log(`=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~`);
    console.log(`DEATH RECORDS SINCE ${CUTOFF.toLocaleString()} — ${allTopics.length} found`);
    console.log(`=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~`);
    allTopics.forEach((t, i) => {
        console.log(`${String(i + 1).padStart(3)}. ${t.date.toLocaleString()} — ${t.title}`);
        console.log(`       ${t.href}`);
    });

    await client.close();
    process.exit(0);
}

main().catch(async (err) => {
    console.error('[DEATH-SCAN] Failed:', err.message);
    process.exit(1);
});
