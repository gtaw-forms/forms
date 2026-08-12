/**
 * CCTV Scheduler — runs fetch-all.js every 6 hours and posts results to bot-spam.
 *
 * The script runs fetch-all.js --headless, waits for it to complete,
 * then sends a summary message to the bot log channel.
 *
 * Manual fetches via the frontend API are independent of this timer.
 */

import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { sendLogMessage } from './logChannel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = '/opt/phmc-bot/cctv-script';
const FETCH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

let _timer = null;
let _intervalHandle = null;

/**
 * Start the CCTV fetch scheduler.
 * Called once from index.js on bot ready.
 */
export function startCctvScheduler() {
    if (_timer) {
        console.log('[CCTV] Scheduler already running.');
        return;
    }

    console.log(`[CCTV] Scheduler starting — will fetch every 6 hours.`);

    // Run after 5-minute delay so startup health checks (Playwright) finish first,
    // then every 6 hours. This avoids 4+ Playwright instances running concurrently.
    setTimeout(runCctvFetch, 5 * 60 * 1000);
    _intervalHandle = setInterval(runCctvFetch, FETCH_INTERVAL_MS);
    _timer = true;
}

/**
 * Stop the scheduler (cleanup on shutdown).
 */
export function stopCctvScheduler() {
    if (_intervalHandle) {
        clearInterval(_intervalHandle);
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
        });

        let stdout = '';
        child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
        child.stderr.on('data', (chunk) => { stdout += chunk.toString(); }); // merge stderr too

        const exitCode = await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                child.kill();
                resolve('TIMEOUT');
            }, 150_000); // 2.5 min timeout
            child.on('close', (code) => {
                clearTimeout(timeout);
                resolve(code);
            });
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (exitCode === 'TIMEOUT') {
            console.warn('[CCTV] Scheduled fetch timed out after 150s');
            sendLogMessage('[CCTV] Scheduled fetch timed out after 150s.');
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
