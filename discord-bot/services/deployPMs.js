/**
 * PM Deployer — sends coroner emails and other report types as phpBB PMs.
 *
 * Can be used in two ways:
 *   1. Imported as a module — call deployPendingPMs() from commands or auto-deploy listeners
 *   2. Standalone CLI — run `node services/deployPMs.js` for one-shot deploy
 *
 * Cross-forum support:
 *   Coroner emails (PMs) are sent via LSPD forum (lspd.gta.world) to reach requesting officers,
 *   while topic posting goes through the default FORUM_BASE_URL (phmc.gta.world).
 *   The LSPD URL is configured via FORUM_LSPD_URL in .env.
 */

import { readFileSync, existsSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getForumClient } from './forumClient.js';
import firebase from './firebase.js';

// ── Load .env at module level (before anything reads process.env) ──

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
    const envPath = resolve(__dirname, '..', '.env');
    if (!existsSync(envPath)) {
        console.warn('[DEPLOY] ⚠️ No .env file found at', envPath);
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
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

loadEnv(); // <-- runs NOW, before any constants are defined

// ── Configuration (read from process.env AFTER loadEnv) ──

function lspdUrl()    { return process.env.FORUM_LSPD_URL || 'http://lspd.gta.world'; }
function lspdUser()   { return process.env.FORUM_LSPD_USERNAME; }
function lspdPass()   { return process.env.FORUM_LSPD_PASSWORD; }

function lssdUrl()    { return process.env.FORUM_LSSD_URL || 'http://lssd.gta.world'; }
function lssdUser()   { return process.env.FORUM_LSSD_USERNAME; }
function lssdPass()   { return process.env.FORUM_LSSD_PASSWORD; }

function sadcrUrl()   { return process.env.FORUM_SADCR_URL || 'http://sadcr.gta.world'; }
function sadcrUser()  { return process.env.FORUM_SADCR_USERNAME; }
function sadcrPass()  { return process.env.FORUM_SADCR_PASSWORD; }

// ── Firebase Queries ──

/**
 * Find all undeployed reports of a given form type from Firebase.
 */
async function findUndeployedReports(db, formIds) {
    const snapshot = await db.ref('scheduledReports').once('value');
    const data = snapshot.val();
    if (!data) return [];

    const ids = Array.isArray(formIds) ? formIds : [formIds];
    const reports = [];
    for (const [authorId, authorReports] of Object.entries(data)) {
        for (const [key, report] of Object.entries(authorReports)) {
            if (ids.includes(report.formId) && report.hasdeployed === false) {
                reports.push({ authorId, key, report });
            }
        }
    }
    return reports;
}

/**
 * Fetch the pre-saved BBCode for a given report from Firebase.
 */
async function fetchBBCode(db, authorId, key) {
    const snap = await db.ref(`scheduledReportsBBCode/${authorId}/${key}`).once('value');
    const data = snap.val();
    return data?.bbCode || null;
}

/**
 * Mark a report as deployed in Firebase.
 */
async function markDeployed(db, authorId, key, success, extra = {}) {
    await db.ref(`scheduledReports/${authorId}/${key}`).update({
        hasdeployed: success,
        deployedAt: firebase.db ? new Date().toISOString() : Date.now(),
        deployedType: 'pm',
        // Clear any retry queue fields if this was a retry
        retryAt: null,
        deployStatus: success ? 'deployed' : 'failed_permanent',
        ...extra,
    });
}

// ── Recipient Resolution ──

/**
 * Extract the PM recipient from a report's data.
 * Checks common field names used across different form types.
 */
function getRecipient(report) {
    const data = report.data || {};
    return data.requestingOfficer
        || data.requesting_officer
        || data.officerName
        || data.recipient
        || data.officer
        || data.coronerEmployee
        || '';
}

// ── Deployment Logic ──

/**
 * Deploy a single report as a phpBB PM.
 *
 * @param {object} report    - { authorId, key, report } from Firebase
 * @param {object} bbCode    - The pre-saved BBCode string
 * @param {object} client    - ForumClient instance (already logged in)
 * @param {string} forumUrl  - Base URL of the target forum
 * @returns {Promise<{ok: boolean, url: string|null, recipient: string, subject: string}>}
 */
async function deploySingleReport(report, bbCode, client, forumUrl) {
    const { authorId, key, report: reportData } = report;
    const recipient = getRecipient(reportData);
    const subject = reportData.originalKey || key;

    if (!recipient) {
        console.log(`[DEPLOY] ⏭️ ${key} — no recipient found, skipping`);
        return { ok: false, skipped: true, reason: 'No recipient' };
    }

    if (!bbCode) {
        console.log(`[DEPLOY] ⏭️ ${key} — no BBCode found, skipping`);
        return { ok: false, skipped: true, reason: 'No BBCode' };
    }

    console.log(`[DEPLOY] 📨 ${key}`);
    console.log(`  To:      ${recipient}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Forum:   ${forumUrl}`);
    console.log(`  BBCode:  ${bbCode.length} chars`);

    const result = await client.sendPM(recipient, subject, bbCode, {
        baseUrl: forumUrl,
    });

    console.log(`  Result:  ${result.ok ? '✅ Sent' : '❌ Failed'}${result.url ? ` — ${result.url}` : ''}`);
    return result;
}

/**
 * Deploy all pending PM-able reports.
 *
 * @param {object} options
 * @param {string[]} [options.formIds=['coroner_email']] - Form types to deploy
 * @param {string}  [options.forumUrl]                   - Override target forum URL
 * @param {boolean} [options.dryRun=false]               - If true, don't actually send
 * @param {boolean} [options.closeBrowser=true]           - Close browser when done
 * @returns {Promise<{deployed: number, skipped: number, failed: number, results: object[]}>}
 */
export async function deployPendingPMs(options = {}) {
    const {
        formIds = ['coroner_email'],
        forumUrl = lspdUrl(),
        dryRun = process.env.DRY_RUN === 'true',
        closeBrowser = true,
    } = options;

    console.log('═══════════════════════════════════════════');
    console.log('[DEPLOY] 🚀 PM Deployer');
    console.log(`[DEPLOY] 📋 Form types: ${formIds.join(', ')}`);
    console.log(`[DEPLOY] 🌐 Forum:      ${forumUrl}`);
    console.log(`[DEPLOY] 🏜️ Dry run:    ${dryRun}`);
    console.log('═══════════════════════════════════════════');

    // Init Firebase
    firebase.init();
    const db = firebase.db;

    // Find undeployed reports
    const reports = await findUndeployedReports(db, formIds);
    console.log(`[DEPLOY] 📊 Found ${reports.length} undeployed report(s)`);

    if (reports.length === 0) {
        console.log('[DEPLOY] ✅ Nothing to deploy.');
        return { deployed: 0, skipped: 0, failed: 0, results: [] };
    }

    // Get the forum client (fresh session each time)
    const sessionFile = resolve(__dirname, '..', 'forum-session.json');
    if (existsSync(sessionFile)) {
        unlinkSync(sessionFile);
        console.log('[DEPLOY] 🗑️ Removed saved session for fresh login');
    }

    const client = getForumClient();

    // Login to the target forum with the right credentials
    if (!dryRun) {
        const domain = forumUrl.toLowerCase();
        const isLspd = domain.includes('lspd');
        const isLssd = domain.includes('lssd');
        const isSadcr = domain.includes('sadcr');
        let loginUser = null, loginPass = null, forumLabel = '';

        if (isSadcr) {
            loginUser = sadcrUser();
            loginPass = sadcrPass();
            forumLabel = 'SADCR';
            if (!loginUser || !loginPass) {
                console.error('[DEPLOY] ❌ SADCR forum requires FORUM_SADCR_USERNAME and FORUM_SADCR_PASSWORD in .env');
                if (closeBrowser) await client.close();
                return { deployed: 0, skipped: 0, failed: reports.length, results: [] };
            }
        } else if (isLspd) {
            loginUser = lspdUser();
            loginPass = lspdPass();
            forumLabel = 'LSPD';
            if (!loginUser || !loginPass) {
                console.error('[DEPLOY] ❌ LSPD forum requires FORUM_LSPD_USERNAME and FORUM_LSPD_PASSWORD in .env');
                if (closeBrowser) await client.close();
                return { deployed: 0, skipped: 0, failed: reports.length, results: [] };
            }
        } else if (isLssd) {
            loginUser = lssdUser();
            loginPass = lssdPass();
            forumLabel = 'LSSD';
            if (!loginUser || !loginPass) {
                console.error('[DEPLOY] ❌ LSSD forum requires FORUM_LSSD_USERNAME and FORUM_LSSD_PASSWORD in .env');
                if (closeBrowser) await client.close();
                return { deployed: 0, skipped: 0, failed: reports.length, results: [] };
            }
        }

        console.log(`[DEPLOY] 🔑 Logging into ${forumUrl}${forumLabel ? ` (${forumLabel} credentials)` : ''}...`);
        await client.login(loginUser, loginPass, { force: true, baseUrl: forumUrl });
        console.log('[DEPLOY] ✅ Logged in');
    } else {
        console.log('[DEPLOY] 🏜️ DRY RUN — skipping login');
    }

    console.log();

    // Deploy each report
    const results = [];
    for (const report of reports) {
        try {
            const bbCode = await fetchBBCode(db, report.authorId, report.key);

            if (dryRun) {
                const recipient = getRecipient(report.report);
                console.log(`[DEPLOY] 🏜️ [DRY RUN] Would send PM to ${recipient || '(no recipient)'}: "${report.report.originalKey || report.key}"`);
                results.push({ key: report.key, ok: true, dryRun: true });
                continue;
            }

            const result = await deploySingleReport(report, bbCode, client, forumUrl);
            results.push({ ...result, key: report.key });

            if (result.ok) {
                await markDeployed(db, report.authorId, report.key, true);
            } else if (result.skipped) {
                // Still mark as deployed so we don't retry hopeless ones
                await markDeployed(db, report.authorId, report.key, true, {
                    deployNote: result.reason,
                });
            }
        } catch (err) {
            console.error(`[DEPLOY] ❌ Error deploying ${report.key}:`, err.message);

            // Write retry queue metadata so autoDeploy's checkRetryQueue can pick it up
            try {
                const retries = (report.report?.deployRetries || 0) + 1;
                const MAX_RETRIES = 3;
                const RETRY_DELAY_MS = 6 * 60 * 60 * 1000;

                if (retries >= MAX_RETRIES) {
                    await db.ref(`scheduledReports/${report.authorId}/${report.key}`).update({
                        hasdeployed: false,
                        deployStatus: 'failed_permanent',
                        deployMessage: `Gave up after ${retries} attempts. Error: ${err.message.slice(0, 200)}`,
                        deployRetries: retries,
                        deployLastFailedAt: new Date().toISOString(),
                    });
                    console.log(`[DEPLOY] 🛑 ${report.key} — failed ${retries}/${MAX_RETRIES} times, giving up permanently`);
                } else {
                    const retryTime = Date.now() + RETRY_DELAY_MS;
                    const retryAtISO = new Date(retryTime).toISOString();

                    await db.ref(`scheduledReports/${report.authorId}/${report.key}`).update({
                        hasdeployed: false,
                        deployStatus: 'retry_queued',
                        deployMessage: `Re-queued (attempt ${retries}/${MAX_RETRIES}) — next retry at ${retryAtISO}. Error: ${err.message.slice(0, 200)}`,
                        retryAt: retryAtISO,
                        deployRetries: retries,
                        deployLastFailedAt: new Date().toISOString(),
                    });

                    console.log(`[DEPLOY] 🔄 ${report.key} — re-queued for retry at ${retryAtISO} (attempt ${retries}/${MAX_RETRIES})`);
                }
            } catch { /* best effort */ }

            results.push({ key: report.key, ok: false, error: err.message });
        }
        console.log();
    }

    const deployed = results.filter(r => r.ok && !r.dryRun).length;
    const skipped = results.filter(r => r.skipped).length;
    const failed = results.filter(r => !r.ok && !r.skipped && !r.dryRun).length;

    console.log('═══════════════════════════════════════════');
    console.log(`[DEPLOY] ✅ Done — ${deployed} deployed, ${skipped} skipped, ${failed} failed`);
    console.log('═══════════════════════════════════════════');

    // Cleanup
    if (closeBrowser) {
        await client.close();
    }

    return { deployed, skipped, failed, results };
}

// ── Startup Summary (dry-run, no browser) ──

/**
 * Lightweight startup check — counts pending reports and logs them.
 * No browser launch, no login, no sending — safe to run on every startup.
 */
export async function getPendingSummary() {
    try {
        firebase.init();
        const db = firebase.db;

        const reports = await findUndeployedReports(db, ['coroner_email']);
        if (reports.length === 0) {
            console.log('[BOT] ✅ No pending PM deployments found');
            return { pending: 0 };
        }

        console.log(`[BOT] 📋 ${reports.length} pending PM deployment(s) found:`);
        for (const r of reports) {
            const recipient = getRecipient(r.report);
            const name = r.report.originalKey || r.key;
            console.log(`  • ${name} → ${recipient || '(no recipient)'}`);
        }
        console.log(`[BOT] 💡 Run \`node services/deployPMs.js\` or use dry-run to test first`);

        return { pending: reports.length, reports };
    } catch (err) {
        console.error('[BOT] ❌ Failed to check pending deployments:', err.message);
        return { pending: -1, error: err.message };
    }
}

// ── Standalone CLI Entry Point ──

async function main() {
    // .env is already loaded at module level above

    // Parse CLI flags: --forum lspd|lssd, --dry-run, --debug
    const args = process.argv.slice(2);
    const forumFlag = args.indexOf('--forum');
    const forumArg = forumFlag !== -1 && args[forumFlag + 1] ? args[forumFlag + 1].toLowerCase() : null;
    const dryRun = args.includes('--dry-run') || process.env.DRY_RUN === 'true';
    if (args.includes('--debug')) process.env.DEBUG = 'true';

    // Resolve forum URL from flag
    let forumUrl;
    if (forumArg === 'lssd') {
        forumUrl = lssdUrl();
    } else if (forumArg === 'lspd') {
        forumUrl = lspdUrl();
    } else if (forumArg) {
        // Treat as direct URL
        forumUrl = forumArg.startsWith('http') ? forumArg : `http://${forumArg}`;
    }

    const options = { dryRun };
    if (forumUrl) options.forumUrl = forumUrl;

    try {
        const result = await deployPendingPMs(options);
        process.exit(result.failed > 0 ? 1 : 0);
    } catch (err) {
        console.error('[DEPLOY] 💥 Fatal error:', err.message);
        process.exit(1);
    }
}

// Detect if running as standalone script (not imported)
const isStandalone = process.argv[1] && (
    process.argv[1].includes('deployPMs.js')
);

if (isStandalone) {
    console.log('[DEPLOY] 🔧 Running as standalone script');
    main();
}
