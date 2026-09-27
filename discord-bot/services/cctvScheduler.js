/**
 * CCTV Scheduler — runs fetch-all.js daily and posts results to bot-spam.
 *
 * Daily cadence (was 6-hourly): footage logs are incremental by ID so nothing
 * is lost between runs, and manual checks via the frontend API cover gaps.
 * The script runs fetch-all.js --headless, waits for it to complete,
 * then sends a summary message to the bot log channel.
 *
 * Manual fetches via the frontend API are independent of this timer.
 */

import { spawn } from 'child_process';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { sendLogMessage } from './logChannel.js';
import { registerTick, unregisterTick } from './scheduler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = '/opt/phmc-bot/cctv-script';
const FETCH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours (daily)

let _timer = null;
let _intervalHandle = null;
let _registerTimer = null;
let _startupTimeout = null;

/**
 * Start the CCTV fetch scheduler.
 * Called once from index.js on bot ready.
 */
export function startCctvScheduler() {
    if (_timer) {
        console.log('[CCTV] Scheduler already running.');
        return;
    }

    console.log(`[CCTV] Scheduler starting — will fetch daily.`);

    // Run after 5-minute delay so startup health checks (Playwright) finish first,
    // then every 24 hours. This avoids 4+ Playwright instances running concurrently.
    // (The 5m one-shot below is NOT part of this migration — owned separately.)
    _startupTimeout = setTimeout(runCctvFetch, 5 * 60 * 1000);
    // Delayed initial registration: the scheduler fires non-runAtStart ticks at
    // the first evaluation, so registering now would add an immediate extra
    // fetch at boot (defeating the 5m settle delay above). Registering after
    // one full interval preserves the original setInterval phase (first tick
    // ~24h after start, steady daily cadence after).
    if (_registerTimer) clearTimeout(_registerTimer);
    _registerTimer = setTimeout(() => {
        _registerTimer = null;
        registerTick('cctv-fetch', {
            intervalMs: FETCH_INTERVAL_MS,
            runAtStart: false,
            fn: () => runCctvFetch(),
        });
        _intervalHandle = true;
    }, FETCH_INTERVAL_MS);
    _timer = true;
}

/**
 * Stop the scheduler (cleanup on shutdown).
 */
export function stopCctvScheduler() {
    if (_startupTimeout) {
        clearTimeout(_startupTimeout);
        _startupTimeout = null;
    }
    if (_registerTimer) {
        clearTimeout(_registerTimer);
        _registerTimer = null;
    }
    if (_intervalHandle) {
        unregisterTick('cctv-fetch');
        _intervalHandle = null;
    }
    _timer = null;
    console.log('[CCTV] Scheduler stopped.');
}

/**
 * Run fetch-all.js --headless and send the result to bot-spam.
 */
async function runCctvFetch() {
    const startTime = Date.now();
    console.log('[CCTV] Running scheduled fetch...');

    try {
        const child = spawn('node', ['fetch-all.js', '--headless'], {
            cwd: SCRIPT_PATH,
            stdio: ['ignore', 'pipe', 'pipe'],
            // Own process group so we can kill the whole tree on timeout —
            // SIGTERM to the node wrapper alone orphans the headless-browser
            // grandchildren, which leak RAM on this small (1.8GB, no-swap) box.
            detached: true,
        });

        let stdout = '';
        child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
        child.stderr.on('data', (chunk) => { stdout += chunk.toString(); }); // merge stderr too

        const killTree = () => {
            try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ }
        };

        const exitCode = await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                killTree();
                resolve('TIMEOUT');
            }, 150_000); // 2.5 min timeout
            child.on('close', (code) => {
                clearTimeout(timeout);
                killTree(); // sweep any lingering browser grandchildren
                resolve(code);
            });
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        // Self-diagnosis: keep the tail so a dead/empty run arrives with its
        // own cause attached instead of a bare "?/? cameras".
        const outTail = String(stdout || '').trim().split('\n').slice(-15).join('\n') || '(no output captured)';
        const exitDesc = exitCode === 'TIMEOUT' ? 'TIMEOUT (killed after 150s)' : `exit code ${exitCode}`;

        if (exitCode === 'TIMEOUT') {
            console.warn(`[CCTV] Scheduled fetch timed out after 150s\n--- output tail ---\n${outTail}`);
            sendLogMessage(`[CCTV] Scheduled fetch timed out after 150s.\n\`\`\`\n${outTail.slice(0, 1500)}\n\`\`\``);
            return;
        }

        // Parse summary from stdout (try multiple patterns for robustness)
        const newEntriesMatch = stdout.match(/[Nn]ew.*[Tt]otal.*lines:\s+(\d+)/);
        const newEntries = newEntriesMatch ? parseInt(newEntriesMatch[1], 10) : 0;
        const failedMatch = stdout.match(/[Ff]ailed:\s+(\d+)/);
        const failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;
        const successMatch = stdout.match(/[Cc]ameras fetched:\s*(\d+)\s*\/\s*(\d+)/);
        const successCount = successMatch ? successMatch[1] : '?';
        const totalCameras = successMatch ? successMatch[2] : '?';

        const message = [
            `[CCTV] Logs fetched — ${newEntries} new entries across ${successCount}/${totalCameras} cameras`,
            failed > 0 ? ` (${failed} failed)` : '',
            ` | ${elapsed}s`,
        ].filter(Boolean).join('');

        console.log(message);

        // Brief summary for Discord (avoid spam with full camera list)
        let detail = `**CCTV Logs Fetched**\n\`${newEntries}\` new entries | \`${elapsed}s\` | \`${successCount}/${totalCameras}\` cameras`;
        // Unparseable run (crash / empty output / non-zero exit): attach the
        // exit code + output tail so the cause is visible without VPS access.
        if (!successMatch || exitCode !== 0) {
            const diag = `\n\`exit: ${exitDesc}\`\n\`\`\`\n${outTail.slice(0, 1500)}\n\`\`\``;
            detail += diag;
            console.warn(`[CCTV] Unparseable run (${exitDesc})\n--- output tail ---\n${outTail}`);
        }
        // Only add cameras that got new entries
        if (newEntries > 0) {
            const cameraLines = stdout.split('\n').filter(l => l.includes('#') && l.includes('stored'));
            const activeCameras = cameraLines.filter(l => l.includes('new entries'));
            if (activeCameras.length > 0) {
                detail += '\n```';
                activeCameras.slice(0, 5).forEach(l => {
                    const clean = l.trim().replace(/─/g, '');
                    if (clean) detail += `\n${clean}`;
                });
                if (activeCameras.length > 5) detail += `\n...and ${activeCameras.length - 5} more`;
                detail += '\n```';
            }
        }

        sendLogMessage(detail);

    } catch (err) {
        console.error('[CCTV] Scheduled fetch error:', err.message);
        sendLogMessage(`[CCTV] Fetch error: ${err.message}`);
    }
}
