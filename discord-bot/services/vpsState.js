/**
 * vpsState.js — tiny VPS-local JSON state store for BOT-INTERNAL state that the
 * web app never touches (notification dedup flags, intake counters, panel
 * message-ID registries, retry indexes). Moving these off RTDB removes Firebase
 * reads/writes for bookkeeping only the bot uses.
 *
 * Storage: data/bot-state/<key>.json — synchronous atomic temp+rename writes
 * with an in-memory cache. The deploy tool excludes data/, so this state
 * survives every `npm run bot:deploy`.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = resolve(__dirname, '..', 'data', 'bot-state');

const cache = new Map();

function fileFor(key) {
    const safe = String(key).replace(/[^a-zA-Z0-9._/-]/g, '_');
    return resolve(STATE_DIR, safe + '.json');
}

function load(key) {
    if (cache.has(key)) return cache.get(key);
    let value = null;
    try {
        const f = fileFor(key);
        if (existsSync(f)) value = JSON.parse(readFileSync(f, 'utf-8'));
    } catch (e) {
        console.warn(`[VPS-STATE] read ${key}: ${e.message}`);
        value = null;
    }
    cache.set(key, value);
    return value;
}

function persist(key) {
    try {
        const f = fileFor(key);
        // Keys may contain '/' (e.g. 'monitoring/morgueUpdate') -> nested path.
        mkdirSync(dirname(f), { recursive: true });
        const tmp = f + '.tmp-' + process.pid;
        writeFileSync(tmp, JSON.stringify(cache.get(key) ?? null, null, 2), 'utf-8');
        renameSync(tmp, f);
    } catch (e) {
        console.warn(`[VPS-STATE] write ${key}: ${e.message}`);
    }
}

/** Read a whole state file. Returns `fallback` when absent or unparseable. */
export function readState(key, fallback = null) {
    const v = load(key);
    if (v === null || v === undefined) {
        cache.set(key, fallback);
        return fallback;
    }
    return v;
}

/** Replace a whole state file. */
export function writeState(key, value) {
    cache.set(key, value);
    persist(key);
}

/** Read-modify-write: `fn(current, fallback)` returns the new whole value. */
export function mutateState(key, fn, fallback = null) {
    const cur = load(key);
    const next = fn(cur === null || cur === undefined ? fallback : cur);
    cache.set(key, next);
    persist(key);
    return next;
}

// ── Child helpers for map-shaped state (panel registries, retry indexes) ──

/** Read `key[child]`. */
export function readChild(key, child, fallback = null) {
    const v = load(key);
    return v && typeof v === 'object' && v[child] !== undefined ? v[child] : fallback;
}

/** Set `key[child] = value` (creates the map if needed). */
export function writeChild(key, child, value) {
    const obj = load(key) && typeof load(key) === 'object' ? load(key) : {};
    obj[child] = value;
    cache.set(key, obj);
    persist(key);
}

/** Delete `key[child]`. */
export function removeChild(key, child) {
    const obj = load(key) && typeof load(key) === 'object' ? load(key) : {};
    delete obj[child];
    cache.set(key, obj);
    persist(key);
}