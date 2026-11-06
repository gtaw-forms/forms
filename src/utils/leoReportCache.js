/**
 * LEO report cache — IndexedDB-backed smart cache for forwarded reports.
 *
 * What is cached:
 *   - the forwarded-report index (rows shown in the LEO list), and
 *   - full report payloads, capped at `LEO_CACHE_LIMIT` (50) entries.
 *
 * "Smart" rules:
 *   - only reports still present in the forwarded feed are kept (pruned on
 *     every successful index refresh);
 *   - the 50 most recently viewed/cached payloads win (LRU by lastViewedAt,
 *     falling back to cachedAt);
 *   - cached payloads are served instantly on open, then revalidated in the
 *     background — opening a report never waits on the network when a cache
 *     entry exists.
 *
 * Uses the shared `phmc-cache` IndexedDB store through idbCache.js, which
 * already degrades silently when IndexedDB is unavailable.
 */

import { idbGet, idbSet } from './idbCache';

export const LEO_CACHE_LIMIT = 50;
export const LEO_INDEX_KEY = 'leo-reports:index';
export const LEO_ENTRIES_KEY = 'leo-reports:entries';

/** Stable cache id for one report. */
export function leoCacheId(author, key) {
  return `${author || ''}::${key || ''}`;
}

/**
 * Keep at most `limit` cached payloads, newest by lastViewedAt/cachedAt.
 * Pure — exported for tests and for the prune step.
 */
export function trimLeoEntries(entries, limit = LEO_CACHE_LIMIT) {
  const list = Object.entries(entries || {})
    .filter(([, entry]) => entry && entry.payload)
    .sort((a, b) => {
      const at = Number(a[1].lastViewedAt || a[1].cachedAt || 0);
      const bt = Number(b[1].lastViewedAt || b[1].cachedAt || 0);
      return bt - at;
    });
  return Object.fromEntries(list.slice(0, limit));
}

/** Drop payloads that are no longer in the live forwarded index. */
export function pruneLeoEntries(entries, allowedIds, limit = LEO_CACHE_LIMIT) {
  const allowed = allowedIds instanceof Set ? allowedIds : new Set(allowedIds || []);
  const kept = {};
  for (const [id, entry] of Object.entries(entries || {})) {
    if (allowed.has(id) && entry && entry.payload) kept[id] = entry;
  }
  return trimLeoEntries(kept, limit);
}

/** Read the cached forwarded index: { rows, total, cachedAt }. */
export async function readLeoIndex() {
  const cached = await idbGet(LEO_INDEX_KEY);
  return cached && Array.isArray(cached.rows) ? cached : null;
}

/** Replace the cached forwarded index. */
export async function writeLeoIndex(index) {
  await idbSet(LEO_INDEX_KEY, { ...index, cachedAt: Date.now() });
}

/** Read every cached payload entry: { [cacheId]: { payload, cachedAt, lastViewedAt } }. */
export async function readLeoEntries() {
  const entries = await idbGet(LEO_ENTRIES_KEY);
  return entries && typeof entries === 'object' ? entries : {};
}

/** Read one cached payload entry. */
export async function readCachedLeoReport(author, key) {
  const entries = await readLeoEntries();
  return entries[leoCacheId(author, key)] || null;
}

/**
 * Insert/refresh one payload and trim to the LRU limit.
 * `viewedAt` marks a real open; without it the entry keeps its lastViewedAt.
 */
export async function writeCachedLeoReport({ author, key, payload, viewedAt = null }) {
  const id = leoCacheId(author, key);
  const entries = await readLeoEntries();
  const previous = entries[id];
  const now = Date.now();
  entries[id] = {
    payload,
    cachedAt: now,
    lastViewedAt: viewedAt || previous?.lastViewedAt || now,
    author,
    key,
  };
  await idbSet(LEO_ENTRIES_KEY, trimLeoEntries(entries));
}

/**
 * Reconcile the payload cache with a fresh forwarded index: drop reports the
 * index no longer carries, trim to 50, and return the number kept.
 */
export async function reconcileLeoCache(rows) {
  const entries = await readLeoEntries();
  const allowed = (rows || []).map((row) => leoCacheId(row.author, row.key));
  const pruned = pruneLeoEntries(entries, allowed);
  await idbSet(LEO_ENTRIES_KEY, pruned);
  return Object.keys(pruned).length;
}

/** Mark the cached forwarded index stale without dropping cached payloads. */
export async function invalidateLeoIndex() {
  await idbSet(LEO_INDEX_KEY, { rows: [], total: 0, invalidatedAt: Date.now() });
}

/** Remove every cached LEO report (used by the "clear cache" control). */
export async function clearLeoCache() {
  await idbSet(LEO_INDEX_KEY, { rows: [], total: 0, clearedAt: Date.now() });
  await idbSet(LEO_ENTRIES_KEY, {});
}
