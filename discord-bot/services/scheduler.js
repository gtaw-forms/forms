/**
 * services/scheduler.js — central tick scheduler (single-evaluator pattern).
 *
 * Replaces N independent setInterval sweeps with one ref'd 30s evaluator loop.
 * Each entry ({ intervalMs, jitterMs, runAtStart, fn }) is checked every base
 * tick; due entries run async with a per-task reentrancy guard (skip + warn,
 * no overlap, no queue buildup).
 *
 * The loop is intentionally kept ref'd (no unref()): these ticks are the bot's
 * heartbeat, same as today's ref'd sweeps. Unref'ing would let the process exit
 * while ticks are the only thing keeping it alive.
 *
 * Base tick: SCHEDULER_TICK_MS env, default 30000, min clamp 5000.
 *
 * Migrate: periodic polling sweeps with fixed intervals (health checks, poster
 * retries, dashboard refreshes, index rebuilds) — anything that is "every N
 * minutes, skip if the last run is still going".
 * Do NOT migrate: event-driven watchers (Firebase on-value listeners, Discord
 * interaction handlers) and per-event one-shot timers (setTimeout retries,
 * debounces, backoff chains). Those stay out.
 *
 * Leaf module: Node builtins only, zero local imports (no cycle risk).
 */

/** @type {Map<string, import('./scheduler-types.js').TickEntry>} */
const entries = new Map();

/** @type {NodeJS.Timeout | null} */
let timer = null;

const DEFAULT_TICK_MS = 30000;
const MIN_TICK_MS = 5000;

function resolveTickMs() {
  const raw = Number(process.env.SCHEDULER_TICK_MS);
  if (!Number.isFinite(raw)) return DEFAULT_TICK_MS;
  return Math.max(MIN_TICK_MS, Math.floor(raw));
}

function jitterDelay(jitterMs) {
  const j = Number(jitterMs) || 0;
  if (j <= 0) return 0;
  return Math.floor(Math.random() * (Math.floor(j) + 1));
}

async function runEntry(name, entry) {
  const startedAt = Date.now();
  try {
    await entry.fn();
    entry.lastRunAt = startedAt;
    entry.lastOk = true;
    entry.lastError = null;
  } catch (err) {
    entry.lastRunAt = startedAt;
    entry.lastOk = false;
    entry.lastError = err?.message ?? String(err);
    console.error(`[Scheduler] Tick '${name}' failed:`, err?.message ?? err);
  } finally {
    entry.running = false;
    // Same schedule on success and error — never retry-storm.
    entry.nextRunAt = Date.now() + entry.intervalMs + jitterDelay(entry.jitterMs);
  }
}

function evaluate() {
  const now = Date.now();
  for (const [name, entry] of entries) {
    if (now < entry.nextRunAt) continue;
    if (entry.running) {
      entry.skipCount += 1;
      console.warn(`[Scheduler] Skipping tick '${name}' — previous run still in progress (skip #${entry.skipCount})`);
      continue;
    }
    entry.running = true;
    // Fire-and-forget (guarded inside runEntry); never blocks the evaluator.
    runEntry(name, entry);
  }
}

/**
 * Register (or replace) a periodic tick.
 * @param {string} name unique tick name
 * @param {{ intervalMs: number, jitterMs?: number, runAtStart?: boolean, fn: () => void | Promise<void> }} opts
 * @returns {void}
 */
export function registerTick(name, { intervalMs, jitterMs = 0, runAtStart = false, fn }) {
  if (typeof name !== 'string' || !name) throw new TypeError('registerTick: name must be a non-empty string');
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) throw new TypeError('registerTick: intervalMs must be a positive number');
  if (typeof fn !== 'function') throw new TypeError('registerTick: fn must be a function');
  if (entries.has(name)) {
    console.warn(`[Scheduler] Re-registering tick '${name}' — replacing previous entry`);
  }
  const now = Date.now();
  entries.set(name, {
    intervalMs,
    jitterMs: Number(jitterMs) > 0 ? Number(jitterMs) : 0,
    runAtStart: Boolean(runAtStart),
    fn,
    running: false,
    lastRunAt: null,
    lastOk: null,
    lastError: null,
    skipCount: 0,
    // runAtStart entries are due immediately so the first evaluation runs
    // them; otherwise spread the first fire by rand(0..jitterMs).
    nextRunAt: runAtStart ? now : now + jitterDelay(jitterMs),
  });
}

/**
 * Remove a tick entry. No-op if absent.
 * @param {string} name
 * @returns {void}
 */
export function unregisterTick(name) {
  entries.delete(name);
}

/**
 * Start the single internal evaluator loop (idempotent; no-op if started).
 * Runs the first evaluation immediately so runAtStart entries fire fast.
 * @returns {void}
 */
export function startScheduler() {
  if (timer) return;
  const tickMs = resolveTickMs();
  // Re-arm: runAtStart entries are due now on every (re)start.
  const now = Date.now();
  for (const entry of entries.values()) {
    if (entry.runAtStart && !entry.running && entry.nextRunAt > now) {
      entry.nextRunAt = now;
    }
  }
  // Kept ref'd on purpose — these ticks are the bot's heartbeat.
  timer = setInterval(evaluate, tickMs);
  evaluate();
}

/**
 * Clear the evaluator loop. Registered entries are kept — a later
 * startScheduler() re-arms evaluation.
 * @returns {void}
 */
export function stopScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/**
 * @returns {Array<{ name: string, intervalMs: number, lastRunAt: number | null, lastOk: boolean | null, lastError: string | null, skipCount: number, nextRunAt: number }>}
 */
export function getTickStatus() {
  return [...entries.entries()].map(([name, e]) => ({
    name,
    intervalMs: e.intervalMs,
    lastRunAt: e.lastRunAt,
    lastOk: e.lastOk,
    lastError: e.lastError,
    skipCount: e.skipCount,
    nextRunAt: e.nextRunAt,
  }));
}
