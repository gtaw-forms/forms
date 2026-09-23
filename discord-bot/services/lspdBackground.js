/**
 * lspdBackground.js — Read-only LSPD background-check lookup.
 *
 * Searches the LSPD "Criminal Record Request Form — PHMC" topic (t=73256) for
 * an applicant name and classifies the result:
 *   • completed — an LSPD reply quotes the request AND contains a summary marker
 *   • pending   — a request post exists but no quoting summary reply was found
 *   • not_found — the scoped search returned zero matches
 *
 * READ-ONLY: this module never calls postTopic / replyToTopic / sendPM.
 * Uses an isolated forum client ('lspd-bgcheck') so the PHMC default session
 * is never touched. Each lookup creates a fresh client; concurrent lookups
 * share only the Chromium process.
 *
 * LSPD theme notes (probed 2026-09-13):
 *   • No `.post` wrapper — each post is a `div.postbody` paired by index with
 *     a `dl.postprofile`. Author/date also appear in the `by X - date` line.
 *   • `search.php` honors the `t=<topicId>` scope param (unlike `fid[]=0`).
 *   • Result links carry per-post anchors: `viewtopic.php?p=<pid>#p<pid>`.
 *
 * ── Concurrency ──
 * Lookups run through a module-level FIFO queue: they share one Chromium
 * process, one LSPD account and one session file, so two simultaneous runs
 * would thrash the login (double force-login + session-file race). Each call
 * waits for the previous lookup to fully finish; waiters are told their queue
 * position via onStep.
 */

import { createIsolatedClient } from './forumClient.js';

const BGCHECK_TOPIC_ID = 73256;
const MAX_DETAIL_POSTS = 6;

// A reply is a "summary" when it quotes the request and carries a verdict marker.
const SUMMARY_RE = /criminal history record summary|no derogatory record|derogatory record on file|driving license:/i;
const LICENSE_RE = /driving license:\s*([A-Z ]+)/i;
const RECORD_LINE_RE = /(infraction record|misdemeanor record|felony record)\s*(.*)/i;

// Request-post fields: "Name of Employee: X / Serial number of Employee: #N /
// Name of Applicant: Y / Reason: Z".
const REQ_EMPLOYEE_RE = /name of employee:\s*(.+)/i;
const REQ_SERIAL_RE = /serial number of employee:\s*(#?\S+)/i;
const REQ_APPLICANT_RE = /name of applicant:\s*(.+)/i;
const REQ_REASON_RE = /reason:\s*(.+)/i;
// Post date from the "by X - Fri Jan 23, 2026 9:41 am" line in the post text
// (the LSPD theme has no parseable `.author` element, so match the text).
const POST_DATE_RE = /by\s+[^\n]*?-\s*((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s+[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s*[ap]m)/i;

function cfg() {
    const baseUrl = (process.env.FORUM_LSPD_URL || 'https://lspd.gta.world').replace(/\/$/, '');
    const username = process.env.FORUM_LSPD_USERNAME || '';
    const password = process.env.FORUM_LSPD_PASSWORD || '';
    if (!username || !password) {
        throw new Error('LSPD forum credentials are not configured (FORUM_LSPD_USERNAME / FORUM_LSPD_PASSWORD).');
    }
    return { baseUrl, username, password };
}

// FIFO gate — resolves when the previous lookup has fully released.
let _tail = Promise.resolve();
let _waiting = 0;

/**
 * Look up an applicant's background check (queued behind any running lookup).
 * @param {string} name - applicant name (case-insensitive)
 * @param {(label: string) => void} [onStep] - progress callback for the command
 * @returns {Promise<{verdict: 'completed'|'pending'|'not_found', matches: object[], summaries: object[], requests: object[], topicUrl: string, queued: boolean}>}
 */
export async function lookupBackgroundCheck(name, onStep = () => {}) {
    const clean = String(name || '').trim();
    if (clean.length < 3) throw new Error('Name must be at least 3 characters.');
    const { baseUrl, username, password } = cfg();
    const topicUrl = `${baseUrl}/viewtopic.php?t=${BGCHECK_TOPIC_ID}`;

    let release;
    const prev = _tail;
    _tail = new Promise((resolve) => { release = resolve; });
    _waiting++;
    const queued = _waiting > 1;
    try {
        if (queued) {
            console.log(`[LSPD-BG] "${clean}" — queued behind ${_waiting - 1} lookup(s)`);
            await onStep(`Queued — ${_waiting - 1} lookup(s) ahead, starting shortly...`);
        }
        await prev;
        return { ...(await runLookup(clean, baseUrl, username, password, topicUrl, onStep)), queued };
    } finally {
        _waiting--;
        release();
    }
}

async function runLookup(clean, baseUrl, username, password, topicUrl, onStep) {

    const client = createIsolatedClient('lspd-bgcheck');
    try {
        onStep('Preparing browser (spawning or reusing the idle instance)...');
        // force:true — isolated clients in this codebase always credential-login
        // (group-morgue-check, deployLspd). A force:false "session reuse" can
        // false-positive as logged in with no session file, and guest search
        // silently returns zero matches.
        await client.login(username, password, { force: true, baseUrl });
        onStep('Logged in to the LSPD forum. Searching the background-check topic...');
        await client.ensureBrowser();
        const page = client.page;

        const searchUrl =
            `${baseUrl}/search.php?keywords=${encodeURIComponent(clean)}` +
            `&terms=all&sf=msgonly&sr=posts&t=${BGCHECK_TOPIC_ID}&submit=Search`;
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
        await page.waitForTimeout(2500);

        const postIds = await page.evaluate(() => {
            const ids = [];
            const seen = new Set();
            for (const a of document.querySelectorAll('a[href*="viewtopic.php?p="]')) {
                const m = (a.getAttribute('href') || '').match(/[?&]p=(\d+)/);
                if (m && !seen.has(m[1])) { seen.add(m[1]); ids.push(m[1]); }
            }
            const noMatch = (document.body?.innerText || '').includes('No suitable matches were found');
            return { ids, noMatch };
        }).catch(() => ({ ids: [], noMatch: false }));

        if (postIds.noMatch || postIds.ids.length === 0) {
            console.log(`[LSPD-BG] "${clean}" — no matches in t=${BGCHECK_TOPIC_ID}`);
            return { verdict: 'not_found', matches: [], summaries: [], requests: [], topicUrl };
        }

        const targets = postIds.ids.slice(0, MAX_DETAIL_POSTS);
        console.log(`[LSPD-BG] "${clean}" — ${postIds.ids.length} match(es), reading ${targets.length}`);
        onStep(`Found ${postIds.ids.length} match(es). Reading ${targets.length} post(s)...`);

        const matches = [];
        const seenSnippets = new Set();
        for (const pid of targets) {
            try {
                for (const m of await readPageMatches(client, baseUrl, pid, clean)) {
                    const key = (m.snippet || '').slice(0, 120);
                    if (seenSnippets.has(key)) continue;
                    seenSnippets.add(key);
                    matches.push(m);
                }
            } catch (err) {
                console.warn(`[LSPD-BG] Skipping p=${pid}: ${err.message}`);
            }
            if (matches.length >= 12) break;
        }

        const summaries = matches.filter((m) => m.isSummary);
        const requests = matches.filter((m) => !m.isSummary && m.isRequest);
        const verdict = summaries.length > 0 ? 'completed' : requests.length > 0 ? 'pending' : 'not_found';
        console.log(`[LSPD-BG] "${clean}" — verdict=${verdict} summaries=${summaries.length} requests=${requests.length}`);
        return { verdict, matches, summaries, requests, topicUrl };
    } finally {
        await client.close().catch(() => {});
    }
}

/**
 * Read EVERY post on the target post's page that mentions the name.
 * Required because the `#p<pid>` anchor is a plain div (not inside the
 * postbody), and a page holds ~20 posts — the first name match is usually
 * the request while the summary reply sits a few posts later.
 */
async function readPageMatches(client, baseUrl, pid, name) {
    const page = client.page;
    const url = `${baseUrl}/viewtopic.php?p=${pid}#p${pid}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const raws = await page.evaluate((wanted) => {
        const bodies = [...document.querySelectorAll('div.postbody')];
        const profiles = [...document.querySelectorAll('dl.postprofile')];
        const nl = wanted.toLowerCase();
        const out = [];
        bodies.forEach((body, idx) => {
            const text = body.innerText || '';
            if (!text.toLowerCase().includes(nl)) return;
            let author = body.querySelector('.author a.username, .author a.username-coloured, a.username, a.username-coloured')?.textContent?.trim() || null;
            if (!author && profiles[idx]) {
                author = profiles[idx].querySelector('a.username, a.username-coloured')?.textContent?.trim() || null;
            }
            const authorLine = body.querySelector('.author')?.innerText?.replace(/\s+/g, ' ').trim() || null;
            // LSPD theme: the "by X - <date>" line is the postbody's previous
            // sibling (DIV.pull-left), e.g. "by Elizabeth Nixon - Sun Aug 16, 2026 12:15 pm".
            const byLine = body.previousElementSibling?.innerText?.replace(/\s+/g, ' ').trim() || null;
            const quoteEl = body.querySelector('blockquote, .quote');
            const citeEl = body.querySelector('cite');
            out.push({
                text: text.slice(0, 4000),
                author,
                authorLine,
                byLine,
                quote: quoteEl ? quoteEl.innerText.slice(0, 800) : null,
                cite: citeEl ? citeEl.innerText.slice(0, 200) : null,
            });
        });
        return out;
    }, name).catch(() => []);

    return raws.map((raw) => {
        const isSummary = SUMMARY_RE.test(raw.text) && !!raw.quote;
        const isRequest = REQ_APPLICANT_RE.test(raw.text);
        const firstLine = (re) => {
            const m = raw.text.match(re);
            return m ? m[1].split('\n')[0].trim().slice(0, 120) : null;
        };

        // Record lines (Infraction / Misdemeanor / Felony) for the embed.
        // The value usually sits on the NEXT line ("Felony Record\nNo records on file.").
        const recordLines = [];
        const textLines = raw.text.split('\n').map((l) => l.trim()).filter(Boolean);
        textLines.forEach((line, i) => {
            if (recordLines.length >= 6) return;
            const m = line.match(RECORD_LINE_RE);
            if (!m) return;
            let value = (m[2] || '').trim().slice(0, 80);
            if (!value && textLines[i + 1] && !RECORD_LINE_RE.test(textLines[i + 1])) {
                value = textLines[i + 1].slice(0, 80);
            }
            recordLines.push(`${m[1].trim()} — ${value || '...'}`);
        });
        if (isSummary && recordLines.length === 0 && /no derogatory record/i.test(raw.text)) {
            recordLines.push('Record — No Derogatory Record on File');
        }

        const licM = raw.text.match(LICENSE_RE);
        // Date: prefer the sibling "by X - <date>" line, then .author, then body text.
        const byDateM = (raw.byLine || '').match(/-\s*((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s+[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s*[ap]m)/i);
        const byAuthorM = !raw.author && raw.byLine ? raw.byLine.match(/by\s+(.+?)\s*-\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i) : null;
        const dateM = byDateM || (raw.authorLine || '').match(/(?:»|-)\s*(.+)$/) || raw.text.match(POST_DATE_RE);

        return {
            postId: pid,
            url,
            author: raw.author || (byAuthorM ? byAuthorM[1].trim().slice(0, 60) : null),
            date: dateM ? dateM[1].trim().slice(0, 60) : null,
            isSummary,
            isRequest,
            quoteAuthor: raw.cite ? raw.cite.replace(/\s*wrote:[\s\S]*$/i, '').trim().slice(0, 60) : null,
            licenseStatus: licM ? licM[1].trim().slice(0, 40) : null,
            recordLines,
            request: {
                employee: firstLine(REQ_EMPLOYEE_RE),
                serial: firstLine(REQ_SERIAL_RE),
                applicant: firstLine(REQ_APPLICANT_RE),
                reason: firstLine(REQ_REASON_RE),
            },
            snippet: raw.text.slice(0, 300).replace(/\s+/g, ' '),
        };
    });
}
