/**
 * browser-daemon.mjs — systemd-supervised persistent Chromium for PHMC forum automation.
 *
 * Why this exists: the bot cold-starts a fresh Chromium per process lifetime, so every
 * deploy triggers a fresh-challenge storm. This supervisor instead launches the bot's OWN
 * Playwright-bundled Chromium (versions can never drift — same binary the bot would use)
 * with a STABLE on-disk profile (aging cookies/HSTS/cache like a real user) plus a
 * loopback-only CDP port the bot attaches to via `connectOverCDP('http://127.0.0.1:9222')`.
 *
 * Supervision contract (systemd `Restart=always` relaunches both on crash):
 *  - spawn the Chromium child with stdio inherited (logs flow to the journal),
 *  - wait for child exit; on exit, log + exit with the child's code,
 *  - on SIGTERM/SIGINT forward the signal to the child, then exit (clean `systemctl stop`).
 *
 * Env (everything else passes through to the child untouched):
 *  - BROWSER_DEBUG_PORT   CDP port, default 9222.
 *  - BROWSER_PROFILE_DIR  stable profile dir, default /opt/phmc-bot/browser-profile.
 *  - BROWSER_EXECUTABLE_PATH  fallback binary path, only used if
 *    `chromium.executablePath()` is unavailable on the installed playwright-extra.
 *  - BROWSER_HEADED       'true' runs headed Chrome under Xvfb (virtual
 *    display) instead of headless — closer to a real user (window system,
 *    compositing, real rendering pipeline). Needs the `Xvfb` binary.
 *    Default 'false' (headless). Same profile dir either way, so history
 *    survives mode switches.
 *  - BROWSER_XVFB_DISPLAY X display to use/create, default ':99'.
 *  - BROWSER_XVFB_SCREEN  screen spec, default '1280x900x24'.
 *
 * No secrets. No network calls except the loopback CDP readiness poll.
 */

import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-extra';

const TAG = '[browser-daemon]';
const DEFAULT_PORT = 9222;
const DEFAULT_PROFILE_DIR = '/opt/phmc-bot/browser-profile';
const READY_POLL_CAP_MS = 30000; // ~30s cap, then continue regardless (systemd doesn't need notify)
const READY_POLL_INTERVAL_MS = 1000;
const READY_POLL_TIMEOUT_MS = 5000; // per-attempt fetch timeout (AbortSignal discipline, cf. imageProxy.js)
const STOP_GRACE_MS = 15000; // force-exit if the child ignores the forwarded signal

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parsePort(raw, fallback) {
    if (raw == null || raw === '') return fallback;
    const n = Number.parseInt(String(raw), 10);
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
        console.warn(`${TAG} Invalid BROWSER_DEBUG_PORT=${JSON.stringify(raw)} — using ${fallback}`);
        return fallback;
    }
    return n;
}

/**
 * Resolve the browser binary via the installed playwright-extra. Verified on
 * playwright-extra 4.3.6: `chromium` is an AugmentedBrowserLauncher
 * (PlaywrightExtraClass & playwright-core BrowserType), and BrowserType
 * declares `executablePath(): string` (playwright-core types.d.ts). Runtime-checked
 * locally: `typeof chromium.executablePath === 'function'` and it resolves to the
 * bundled `chromium-1228/chrome-win64/chrome.exe`. No versioned cache path is
 * hardcoded anywhere — whatever Playwright version is installed resolves its own binary.
 */
function resolveExecutable() {
    if (chromium && typeof chromium.executablePath === 'function') {
        try {
            const p = chromium.executablePath();
            if (p) return { path: p, source: 'playwright-extra chromium.executablePath()' };
        } catch (err) {
            console.warn(`${TAG} chromium.executablePath() threw (${err?.message || err}) — trying fallback`);
        }
    } else {
        console.warn(`${TAG} chromium.executablePath is not a function on this playwright-extra — trying fallback`);
    }
    if (process.env.BROWSER_EXECUTABLE_PATH) {
        return { path: process.env.BROWSER_EXECUTABLE_PATH, source: 'BROWSER_EXECUTABLE_PATH' };
    }
    console.error(
        `${TAG} FATAL: cannot resolve a Chromium binary — chromium.executablePath() is unavailable ` +
        'and BROWSER_EXECUTABLE_PATH is unset. Install a compatible playwright-extra or set the env var.'
    );
    process.exit(1);
}

function binaryVersion(exe) {
    try {
        const out = spawnSync(exe, ['--version'], { encoding: 'utf8', timeout: 15000 });
        const v = out.stdout?.trim() || out.stderr?.trim();
        if (out.status === 0 && v) return v;
        return `${v || 'unknown'} (exit ${out.status})`;
    } catch (err) {
        return `unknown (${err?.message || err})`;
    }
}

/** Single CDP readiness probe; null on any failure (timeout, refused, bad payload). */
async function probeCdp(port) {
    const url = `http://127.0.0.1:${port}/json/version`;
    let timer = null;
    try {
        let signal;
        let controller = null;
        if (typeof AbortSignal.timeout === 'function') {
            signal = AbortSignal.timeout(READY_POLL_TIMEOUT_MS);
        } else {
            // Older Node fallback (AbortController + setTimeout discipline, cf. dashboardManager.js).
            controller = new AbortController();
            timer = setTimeout(() => controller.abort(), READY_POLL_TIMEOUT_MS);
            signal = controller.signal;
        }
        const res = await fetch(url, { signal });
        if (!res.ok) return null;
        const data = await res.json().catch(() => null);
        return data?.webSocketDebuggerUrl ? data : null;
    } catch {
        return null;
    } finally {
        if (timer) clearTimeout(timer);
    }
}

async function main() {
    const port = parsePort(process.env.BROWSER_DEBUG_PORT, DEFAULT_PORT);
    const profileDir = process.env.BROWSER_PROFILE_DIR || DEFAULT_PROFILE_DIR;
    const { path: exe, source } = resolveExecutable();
    const exeVersion = binaryVersion(exe);

    // Stable on-disk profile, private to root (cookies/HSTS/cache age like a real user).
    mkdirSync(profileDir, { recursive: true, mode: 0o700 });
    try {
        chmodSync(profileDir, 0o700); // enforce on pre-existing dirs
    } catch (err) {
        console.warn(`${TAG} Could not chmod ${profileDir} (${err?.message || err}) — continuing`);
    }

    const headed = String(process.env.BROWSER_HEADED || '').toLowerCase() === 'true';
    const xvfbDisplay = process.env.BROWSER_XVFB_DISPLAY || ':99';
    const xvfbScreen = process.env.BROWSER_XVFB_SCREEN || '1280x900x24';

    // NOTE on --remote-debugging-address=127.0.0.1: verified against the bundled
    // Chromium — the flag is accepted and the listener binds 127.0.0.1 only. It is
    // also redundant there: --remote-debugging-port already defaults to loopback on
    // this build. Kept as defense-in-depth; Chromium ignores unknown switches
    // without failing, so this cannot break startup. The unit's ExecStartPost
    // double-checks the bind with `ss -ltn`.
    const args = [
        ...(headed ? [] : ['--headless']),
        `--remote-debugging-port=${port}`,
        '--remote-debugging-address=127.0.0.1',
        `--remote-allow-origins=http://127.0.0.1:${port}`,
        `--user-data-dir=${profileDir}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-popup-blocking',
        '--disable-dev-shm-usage',
        'about:blank',
    ];

    console.log(`${TAG} Starting: ${exe} (via ${source})`);
    console.log(`${TAG} Binary: ${exeVersion} | port=${port} profile=${profileDir} mode=${headed ? 'headed-xvfb' : 'headless'}`);

    // Deferred exit notification — the resolver is stored BEFORE spawn so a
    // fast-crashing child can never slip past the 'exit' listener.
    let notifyExit;
    const exitedPromise = new Promise((resolve) => { notifyExit = resolve; });
    const onChildExit = (who) => (code, signal) => notifyExit({ who, code, signal });

    // Headed mode: Xvfb first (Chrome needs a display). Supervised together —
    // if either dies, take down the other and let systemd relaunch the set.
    let xvfb = null;
    if (headed) {
        console.log(`${TAG} Starting Xvfb ${xvfbDisplay} (${xvfbScreen})`);
        xvfb = spawn('Xvfb', [xvfbDisplay, '-screen', '0', xvfbScreen], { stdio: 'inherit' });
        xvfb.on('exit', (code, signal) => {
            console.error(`${TAG} Xvfb exited (code=${code} signal=${signal}) — stopping Chromium too`);
            try { child.kill('SIGTERM'); } catch { /* already gone */ }
            notifyExit({ who: 'xvfb', code: code ?? 1, signal });
        });
        xvfb.on('error', (err) => {
            console.error(`${TAG} FATAL: failed to spawn Xvfb (${err?.message || err}) — is xvfb installed?`);
            process.exit(1);
        });
        await sleep(2000); // let the X socket come up
        if (xvfb.exitCode !== null) {
            console.error(`${TAG} FATAL: Xvfb died during startup`);
            process.exit(1);
        }
        process.env.DISPLAY = xvfbDisplay;
    }

    const child = spawn(exe, args, { stdio: 'inherit' }); // env passes through untouched
    child.on('exit', (code, signal) => {
        if (xvfb && xvfb.exitCode === null) {
            try { xvfb.kill('SIGTERM'); } catch { /* already gone */ }
        }
        onChildExit('chromium')(code, signal);
    });
    child.on('error', (err) => {
        console.error(`${TAG} FATAL: failed to spawn Chromium (${err?.message || err})`);
        process.exit(1);
    });

    let shuttingDown = false;
    let forceTimer = null;
    const handleSignal = (sig) => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`${TAG} Received ${sig} — forwarding to supervised processes`);
        for (const proc of [child, xvfb]) {
            if (proc && proc.exitCode === null && !proc.killed) {
                try {
                    proc.kill(sig);
                } catch (err) {
                    console.warn(`${TAG} Signal forward failed (${err?.message || err})`);
                }
            }
        }
        forceTimer = setTimeout(() => {
            console.warn(`${TAG} Child ignored ${sig} for ${STOP_GRACE_MS}ms — force-exiting`);
            process.exit(sig === 'SIGINT' ? 130 : 143);
        }, STOP_GRACE_MS);
        if (forceTimer.unref) forceTimer.unref();
    };
    process.on('SIGTERM', () => handleSignal('SIGTERM'));
    process.on('SIGINT', () => handleSignal('SIGINT'));

    // READY probe: poll loopback /json/version up to the cap, then continue regardless.
    if (typeof fetch !== 'function') {
        console.warn(`${TAG} Global fetch unavailable — skipping CDP readiness probe, supervising anyway`);
    } else {
        const deadline = Date.now() + READY_POLL_CAP_MS;
        let ready = null;
        while (Date.now() < deadline) {
            if (child.exitCode !== null) break; // child already gone — exit path handles it
            ready = await probeCdp(port);
            if (ready) break;
            await sleep(READY_POLL_INTERVAL_MS);
        }
        if (ready) {
            console.log(
                `${TAG} READY cdp=http://127.0.0.1:${port} profile=${profileDir} ` +
                `binary="${exeVersion}" browser="${ready.Browser || 'unknown'}"`
            );
        } else if (child.exitCode === null) {
            console.log(
                `${TAG} CDP endpoint http://127.0.0.1:${port}/json/version not responding ` +
                `after ${READY_POLL_CAP_MS / 1000}s — continuing regardless (child still supervised)`
            );
        }
    }

    const { who, code, signal } = await exitedPromise;
    if (forceTimer) clearTimeout(forceTimer);
    if (signal) {
        console.log(`${TAG} ${who || 'child'} exited on signal ${signal} — supervisor exiting (systemd will relaunch)`);
        process.exit(shuttingDown ? 0 : 1);
    }
    console.log(`${TAG} ${who || 'child'} exited with code ${code} — supervisor exiting with the same code`);
    process.exit(code ?? 1);
}

await main();
