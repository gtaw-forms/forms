import { appendFileSync, statSync, renameSync, existsSync } from 'fs';
import { resolve } from 'path';

const LOG_FILE = resolve(process.cwd(), 'log.txt');
const MAX_LOG_SIZE = 1 * 1024 * 1024; // 1 MB

let initialized = false;

/**
 * Get current timestamp string for log lines
 */
function timestamp() {
    const now = new Date();
    return now.toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Rotate log file if it exceeds the size limit
 */
function rotateIfNeeded() {
    try {
        if (existsSync(LOG_FILE) && statSync(LOG_FILE).size > MAX_LOG_SIZE) {
            const archived = LOG_FILE.replace('.txt', `.${Date.now()}.txt`);
            renameSync(LOG_FILE, archived);
            writeLine('[LOGGER] 🔄 Log file rotated (archived to ' + archived.split('\\').pop() + ')');
        }
    } catch {
        // best effort
    }
}

/**
 * Write a single line to the log file
 */
function writeLine(message) {
    try {
        rotateIfNeeded();
        appendFileSync(LOG_FILE, message + '\n', 'utf-8');
    } catch {
        // best effort — can't log the logger failure
    }
}

/**
 * Initialize the file logger.
 * Intercepts console.log, console.warn, console.error to dual-write
 * to stdout and the log file.
 */
export function initLogger() {
    if (initialized) return;
    initialized = true;

    const sep = '═'.repeat(60);
    writeLine('');
    writeLine(sep);
    writeLine(`[LOGGER] 🚀 Bot session started at ${timestamp()}`);
    writeLine(sep);

    // Save original methods
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;

    console.log = (...args) => {
        const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
        const line = `[${timestamp()}] ${msg}`;
        writeLine(line);
        origLog.apply(console, args);
    };

    console.warn = (...args) => {
        const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
        const line = `[${timestamp()}] ⚠️ ${msg}`;
        writeLine(line);
        origWarn.apply(console, args);
    };

    console.error = (...args) => {
        const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
        const line = `[${timestamp()}] ❌ ${msg}`;
        writeLine(line);
        origError.apply(console, args);
    };

    console.log('[LOGGER] ✅ File logger initialized —', LOG_FILE);

    // Log uncaught exceptions to file before crashing
    process.on('uncaughtException', (error) => {
        const line = `[${timestamp()}] 💥 UNCAUGHT EXCEPTION: ${error.message}\n${error.stack}`;
        writeLine(line);
        origError('[LOGGER] 💥 Uncaught exception written to log.txt');
    });

    process.on('unhandledRejection', (reason) => {
        const line = `[${timestamp()}] 💥 UNHANDLED REJECTION: ${reason}`;
        writeLine(line);
        origWarn('[LOGGER] 💥 Unhandled rejection written to log.txt');
    });
}
