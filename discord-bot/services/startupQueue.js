/**
 * startupQueue.js — Phased, sequential bot startup for forum-heavy services.
 *
 * Problem: every starter fired at once on boot (autopsy scan, roster sync,
 * recovery sweep, index rebuild, PM poll), hammering one shared Chromium,
 * the same forum accounts and phpBB flood limits simultaneously.
 *
 * Fix: Phase 0 (Discord/Firebase-only starters) still runs immediately from
 * index.js. Everything touching a forum goes through runStartupQueue() below —
 * one task at a time, each with a timeout, failures logged and skipped so a
 * single broken starter never wedges the boot. Steady-state intervals are
 * unchanged; only the boot order is serialized. Combined with the global
 * forum semaphore in forumClient.js, overlap is bounded even afterwards.
 */

const DEFAULT_TASK_TIMEOUT_MS = 12 * 60 * 1000;
const WARMUP_DELAY_MS = 15 * 1000;

/**
 * Warm up the shared browser once: spawn Chromium + pass Cloudflare + verify
 * the PHMC session (reuse-first; login() falls back to the form when needed).
 * Every later task then reuses a warm browser and (usually) live sessions.
 */
export async function warmupBrowser() {
    const { getForumClient } = await import('./forumClient.js');
    const baseUrl = process.env.FORUM_BASE_URL || 'https://phmc.gta.world';
    const client = getForumClient();
    await client.ensureBrowser();
    await client.login(null, null, { force: false, baseUrl });
    console.log('[STARTUP] Browser warm — Chromium up, PHMC session valid');
}

/**
 * Run named startup tasks strictly in order.
 * @param {Array<{name: string, run: () => Promise<void>}>} tasks
 * @param {object} [options]
 * @param {number} [options.taskTimeoutMs] - per-task cap, then skip to next
 */
export async function runStartupQueue(tasks, { taskTimeoutMs = DEFAULT_TASK_TIMEOUT_MS } = {}) {
    console.log(`[STARTUP] Phased boot — ${tasks.length} forum task(s), one at a time`);
    for (let i = 0; i < tasks.length; i++) {
        const { name, run } = tasks[i];
        const t0 = Date.now();
        console.log(`[STARTUP] Phase 2.${i + 1}/${tasks.length} starting: ${name}`);
        try {
            await Promise.race([
                run(),
                new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out after ${taskTimeoutMs}ms`)), taskTimeoutMs)),
            ]);
            console.log(`[STARTUP] Phase 2.${i + 1} done: ${name} (${Math.round((Date.now() - t0) / 1000)}s)`);
        } catch (err) {
            console.warn(`[STARTUP] Phase 2.${i + 1} FAILED: ${name} — ${err.message} (continuing boot)`);
        }
    }
    console.log('[STARTUP] Phased boot complete — all starters running');
}

export { WARMUP_DELAY_MS };
