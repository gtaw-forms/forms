/**
 * lspdPortal.js — session machinery for the LSPD Community Portal.
 *
 * The LSPD board migrated off phpBB: no API, GTAW-OAuth login. This module
 * owns the Playwright session on the persistent daemon browser (same CDP the
 * forum client uses), signed in as the PHMC liaison account: session open +
 * silent SSO re-auth + expiry alerts. The native form driver
 * (lspdPortalForms.js) files through openSessionContext; inbox delivery was
 * removed Nov 2026 (LSPD takes no inbox notices — their portal replaced
 * them).
 *
 * Session: /opt/phmc-bot/lspd-portal-session.json (SIBLING of the mirrored
 * discord-bot/ tree — deploy-bot excludes nothing here because the file is
 * outside the mirror; it survives bot:deploy and is never in git). Captured
 * once via a manual UCP login (OTP + reCAPTCHA defeat automation); when it
 * expires the driver alerts Discord (throttled) and every pending entity
 * retries on the normal queue backoff until the session is re-added.
 *
 * Contexts opened here are always closed; the daemon
 * browser and any parked tabs are never touched.
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { logFnCall, sendWebhook } from './deployLogger.js';

chromium.use(StealthPlugin());

const TAG = 'LSPD-PORTAL';
const PORTAL = 'https://lspd.gta.world';
// Operator kill-switch (2026-11): gates the native form filings (the only
// automated portal delivery left after the Nov 2026 inbox retirement).
// Operator kill-switch (2026-11): the LSPD portal is bugged for new users,
// so automated delivery is paused until further notice. Default OFF — set
// LSPD_PORTAL_ENABLED=true to resume. While paused every send attempt fails
// retryably (never sessionInvalid, never alerting): entities sit in
// retry_queued and deliver on the first sweep after re-enable. Nothing is
// lost, nothing is sent half-broken to the dead board.
export const LSPD_PORTAL_ENABLED = process.env.LSPD_PORTAL_ENABLED === 'true';
const SESSION_PATH = (process.env.LSPD_PORTAL_SESSION || '/opt/phmc-bot/lspd-portal-session.json').trim();
// Developer mention for session-renewal pings (same convention as deployExecutor).
const DEV_MENTION = '<@228306972204597248>';
const ALERT_STAMP = '/opt/phmc-bot/.lspd-portal-session-alert';
const ALERT_THROTTLE_MS = 6 * 60 * 60 * 1000;
// Liaison identity for the character-select step of SSO re-auth.
const PORTAL_CHARACTER = (process.env.LSPD_PORTAL_CHARACTER || 'Alyson Frost').trim();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cdpUrl() {
  const env = process.env.BROWSER_CDP_URL;
  return env === '' ? null : (env || 'http://127.0.0.1:9222');
}

/** Throttled Discord alert: the portal session needs a manual re-login. */
export async function alertPortalSessionNeeded(reason) {
  try {
    let last = 0;
    try { last = Number(readFileSync(ALERT_STAMP, 'utf8')) || 0; } catch { /* first alert */ }
    if (Date.now() - last < ALERT_THROTTLE_MS) {
      console.log(`[${TAG}] Session alert throttled (last ${new Date(last).toISOString()})`);
      return;
    }
    try { writeFileSync(ALERT_STAMP, String(Date.now()), 'utf8'); } catch { /* non-fatal */ }
    await sendWebhook(null, {
      title: '🟡 LSPD Portal session expired — re-login needed',
      description: [
        `**Reason:** ${reason || 'portal reports signed-out'}`,
        '',
        'LSPD liaison form filings are queuing for retry and will NOT deliver until the session is renewed.',
        '',
        '**Renew (takes ~2 min):**',
        '1. On your PC: `node tools/capture-lspd-session.mjs` (opens the portal login in Chrome)',
        '2. Sign in with GTA World → complete UCP + OTP → pick the coroner character',
        '3. Type `done` in that terminal — it prints the SCP command',
        `4. Copy the session to the VPS: \`${SESSION_PATH}\` (overwrites, root-only)`,
        '5. The next queue sweep (≤10 min) resumes delivery automatically.',
        '',
        `${DEV_MENTION} — session renewal needed for LSPD portal delivery.`,
      ].join('\n'),
      color: 0xffc107,
      footer: { text: 'PHMC Bot — LSPD Portal' },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[${TAG}] Session alert failed:`, err.message);
  }
}

/**
 * Attach to the daemon browser and open a private context carrying the
 * portal session. Returns { browser, ctx } — callers MUST close ctx (never
 * the browser). Throws when the daemon is unreachable.
 *
 * Exported for the liaison-forms driver (lspdPortalForms.js), which opens
 * the same session on the record-submission pages instead of mail compose.
 */
export async function openSessionContext() {
  const url = cdpUrl();
  if (!url) throw new Error('Portal delivery needs the daemon browser (BROWSER_CDP_URL is disabled)');
  // The daemon intermittently races an extension service-worker attach during
  // CDP connect (playwright-core assertion, process-fatal) — retry the open a
  // few times with a breather instead of dying on the first attempt.
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const browser = await chromium.connectOverCDP(url);
      const ctx = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        ignoreHTTPSErrors: true,
        ...(existsSync(SESSION_PATH) ? { storageState: SESSION_PATH } : {}),
      });
      return { browser, ctx };
    } catch (err) {
      lastErr = err;
      console.warn(`[${TAG}] Session open attempt ${attempt}/3 failed (${String(err?.message || err).slice(0, 120)}) — retrying`);
      await sleep(4000);
    }
  }
  throw lastErr || new Error('Could not open a portal session context');
}

/**
 * Silent re-auth attempt: bounce through the portal's own OAuth start and see
 * if the (long-lived, ~30d) UCP session carries us back signed in with a fresh
 * portal cookie. Navigation only — fills nothing, clicks nothing except the
 * OAuth-start URL itself (equivalent to pressing "Sign in with GTA World").
 * Any login form, consent button or challenge → immediate false, human alert
 * path stays. On success the refreshed jar is persisted to the session file.
 *
 * @returns {Promise<{ok:boolean, signedInAs:string|null}>}
 */
export async function trySilentReauth() {
  let ctx = null;
  try {
    ({ ctx } = await openSessionContext());
    const page = await ctx.newPage();
    // The OAuth start, exactly as the portal's own sign-in button addresses it.
    await page.goto(`${PORTAL}/portal/auth/gtaworld`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
    await sleep(5000);
    const url = page.url();
    const text = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
    // Landed on a UCP login form or equivalent challenge: hands off to a human.
    if (/\/login/.test(url) || /password|reCAPTCHA|one-time|OTP/i.test(text.slice(0, 2000))) {
      console.log(`[LSPD-PORTAL] Silent re-auth needs interaction (at ${url.split('?')[0]}) — leaving to human renewal`);
      return { ok: false, signedInAs: null };
    }
    // Character select (fresh portal session, UCP SSO already accepted):
    // pick the liaison identity — the exact click the manual login ends with.
    // Anything but exactly one match hands off to a human.
    if (/select-character/.test(url)) {
      const picked = await page.evaluate((want) => {
        const cands = [];
        for (const el of document.querySelectorAll('button, a, [role="option"], li')) {
          const t = (el.innerText || '').trim().replace(/\s+/g, ' ');
          if (t && t.toLowerCase().includes(want.toLowerCase()) && t.length < 120) cands.push(t);
        }
        const uniq = [...new Set(cands)];
        if (uniq.length !== 1) return { matched: uniq.length, clicked: false };
        for (const el of document.querySelectorAll('button, a, [role="option"], li')) {
          const t = (el.innerText || '').trim().replace(/\s+/g, ' ');
          if (t === uniq[0]) {
            const btn = el.tagName === 'BUTTON' || el.tagName === 'A' ? el : el.querySelector('button, a');
            if (btn) { btn.click(); return { matched: 1, clicked: true }; }
          }
        }
        return { matched: 1, clicked: false };
      }, PORTAL_CHARACTER).catch(() => ({ matched: -1, clicked: false }));
      console.log(JSON.stringify({ characterSelect: picked }));
      if (!picked?.clicked) return { ok: false, signedInAs: null };
      await sleep(5000);
      const after = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
      const done = after.match(/Signed in as ([^\n]+)/);
      if (!done) {
        console.log('[LSPD-PORTAL] Character pick did not land signed in — leaving to human renewal');
        return { ok: false, signedInAs: null };
      }
      try {
        await ctx.storageState({ path: SESSION_PATH });
      } catch (e) {
        console.warn(`[LSPD-PORTAL] Could not persist refreshed session: ${e.message}`);
      }
      console.log(`[LSPD-PORTAL] Silent re-auth OK as ${done[1].trim()} (via character select) — session file refreshed`);
      return { ok: true, signedInAs: done[1].trim() };
    }
    const m = text.match(/Signed in as ([^\n]+)/);
    if (!m) {
      console.log(`[LSPD-PORTAL] Silent re-auth landed somewhere unexpected: ${url.split('?')[0]}`);
      return { ok: false, signedInAs: null };
    }
    // Fresh portal cookie — persist the jar so the next delivery finds it.
    try {
      await ctx.storageState({ path: SESSION_PATH });
    } catch (e) {
      console.warn(`[LSPD-PORTAL] Could not persist refreshed session: ${e.message}`);
    }
    console.log(`[LSPD-PORTAL] Silent re-auth OK as ${m[1].trim()} — session file refreshed`);
    return { ok: true, signedInAs: m[1].trim() };
  } catch (err) {
    console.error(`[LSPD-PORTAL] Silent re-auth failed:`, err.message);
    return { ok: false, signedInAs: null };
  } finally {
    try { await ctx?.close(); } catch { /* ignore */ }
  }
}
/**
 * Read-only health check: is the stored session still signed in?
 * Pure probe — no navigation side effects, no session writes.
 * @returns {Promise<{ok:boolean, signedInAs:string|null}>}
 */
export async function checkPortalSession() {
  logFnCall('lspdPortal', 'checkPortalSession', 'Probing portal session');
  if (!existsSync(SESSION_PATH)) return { ok: false, signedInAs: null };
  let ctx = null;
  try {
    ({ ctx } = await openSessionContext());
    const page = await ctx.newPage();
    await page.goto(`${PORTAL}/portal`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
    await sleep(3000);
    if (/\/login/.test(page.url())) return { ok: false, signedInAs: null };
    const text = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
    const m = text.match(/Signed in as ([^\n]+)/);
    return { ok: !!m, signedInAs: m ? m[1].trim() : null };
  } catch (err) {
    console.error(`[${TAG}] Session check failed:`, err.message);
    return { ok: false, signedInAs: null };
  } finally {
    try { await ctx?.close(); } catch { /* ignore */ }
  }
}

// ── Inbox retirement (Nov 2026) ────────────────────────────────────────────
// sendPortalMessage was removed: LSPD takes no inbox notices (their portal
// replaced them). This module keeps the session machinery (openSessionContext,
// silent re-auth, expiry alerts) that the native form driver
// (lspdPortalForms.js) files through.
