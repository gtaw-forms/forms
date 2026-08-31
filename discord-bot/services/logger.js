import { appendFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'fs';
import { resolve, join, basename } from 'path';

const LOGS_DIR = resolve(process.cwd(), 'logs');
const MAX_SESSION_SIZE = 25 * 1024 * 1024; // safety cap if a single session balloons
const KEEP_SESSIONS = 12; // prune oldest session files, keep this many

let currentFile = null;
let initialized = false;

/**
 * Get current timestamp string for log lines
 */
function timestamp() {
    const now = new Date();
    return now.toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Compact start-of-session stamp for the filename: 2026-08-28-163001
 */
function sessionStamp() {
    const d = new Date();
    const p = (n, l = 2) => String(n).padStart(l, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Delete oldest session files beyond KEEP_SESSIONS so the logs dir stays tidy.
 */
function pruneOldSessions() {
    try {
        const files = readdirSync(LOGS_DIR)
            .filter(f => /^(bot|api)-\d{4}-\d{2}-\d{2}-\d{6}(\.\d+)?\.log$/.test(f))
            .sort();
        while (files.length > KEEP_SESSIONS) {
            const victim = files.shift();
            try { rmSync(join(LOGS_DIR, victim)); } catch { /* already gone */ }
        }
    } catch { /* best effort */ }
}

/**
 * Write a single line to the current session's log file.
 * If a single session ever outgrows the safety cap, roll it to <name>.1
 * (that file won't match the session regex, so pruning won't touch it).
 */
function writeLine(message) {
    if (!currentFile) return;
    try {
        if (existsSync(currentFile) && statSync(currentFile).size > MAX_SESSION_SIZE) {
            renameSync(currentFile, currentFile + '.1');
        }
        appendFileSync(currentFile, message + '\n', 'utf-8');
    } catch {
        // best effort — can't log the logger failure
    }
}

/**
 * Initialize the per-session file logger.
 * Each process start opens a fresh log file (logs/<label>-<timestamp>.log)
 * and intercepts console.log/warn/error to dual-write to stdout and that file.
 *
 * @param {string} label - 'bot' (index.js) or 'api' (morgue-api.js)
 */
export function initLogger(label = 'bot') {
    if (initialized) return;
    initialized = true;

    try { mkdirSync(LOGS_DIR, { recursive: true }); } catch { /* best effort */ }
    pruneOldSessions();

    currentFile = join(LOGS_DIR, `${label}-${sessionStamp()}.log`);

    const sep = '═'.repeat(60);
    writeLine('');
    writeLine(sep);
    writeLine(`[LOGGER] 🚀 ${label === 'api' ? 'Morgue API' : 'Bot'} session started at ${timestamp()} → logs/${basename(currentFile)}`);
    writeLine(sep);

    // Save original methods
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;

    console.log = (...args) => {
        const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
        writeLine(`[${timestamp()}] ${msg}`);
        origLog.apply(console, args);
    };

    console.warn = (...args) => {
        const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
        writeLine(`[${timestamp()}] ⚠️ ${msg}`);
        origWarn.apply(console, args);
    };

    console.error = (...args) => {
        const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
        writeLine(`[${timestamp()}] ❌ ${msg}`);
        origError.apply(console, args);
    };

    console.log('[LOGGER] ✅ File logger initialized —', currentFile);

    // Log uncaught exceptions to file before crashing
    process.on('uncaughtException', (error) => {
        writeLine(`[${timestamp()}] 💥 UNCAUGHT EXCEPTION: ${error.message}\n${error.stack}`);
        origError('[LOGGER] 💥 Uncaught exception written to session log');
    });

    process.on('unhandledRejection', (reason) => {
        writeLine(`[${timestamp()}] 💥 UNHANDLED REJECTION: ${reason}`);
        origWarn('[LOGGER] 💥 Unhandled rejection written to session log');
    });
}