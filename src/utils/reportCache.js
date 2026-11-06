/**
 * Saved-reports cache — IndexedDB-backed, page-scoped.
 *
 * What it fixes:
 *   - The records list is only ever fetched 25 rows at a time (never the whole
 *     store), but every reload used to re-fetch page 1. Now the last-viewed
 *     feeds are cached and re-rendered instantly; the network refresh is
 *     skipped while the cache is fresh (5 min) or runs in the background when
 *     it is stale.
 *   - Report detail payloads are cached (LRU, max 50) so reopening a report is
 *     instant; a background revalidation keeps the cached copy current.
 *
 * Scope: feed entries are capped (8) and payloads capped (50) — this is a
 * working-set cache, not a mirror of the whole saved-reports store.
 */

import { idbGet, idbSet } from './idbCache';

export const REPORT_FEEDS_KEY = 'saved-reports:feeds';
export const REPORT_PAYLOADS_KEY = 'saved-reports:payloads';
export const REPORT_CACHE_TTL_MS = 300_000;
export const REPORT_FEEDS_LIMIT = 8;
export const REPORT_PAYLOADS_LIMIT = 50;

/** Stable feed id for one filter/query/page combination. */
export function reportFeedKey({ filter = 'all', query = '', offset = 0 } = {}) {
  return `${filter || 'all'}|${String(query || '').trim().toLowerCase()}|${Number(offset) || 0}`;
}

/** Newest-first, capped feed map. Pure — exported for tests. */
export function trimFeedEntries(feeds, limit = REPORT_FEEDS_LIMIT) {
  const list = Object.entries(feeds || {})
    .filter(([, entry]) => entry && Array.isArray(entry.rows))
    .sort((a, b) => (Number(b[1].cachedAt) || 0) - (Number(a[1].cachedAt) || 0));
  return Object.fromEntries(list.slice(0, limit));
}

/** Most recently used payloads, capped. Pure — exported for tests. */
export function trimReportPayloads(entries, limit = REPORT_PAYLOADS_LIMIT) {
  const list = Object.entries(entries || {})
    .filter(([, entry]) => entry && entry.payload)
    .sort((a, b) => {
      const at = Number(a[1].lastAccessedAt || a[1].cachedAt || 0);
      const bt = Number(b[1].lastAccessedAt || b[1].cachedAt || 0);
      return bt - at;
    });
  return Object.fromEntries(list.slice(0, limit));
}

export function reportPayloadId(author, key) {
  return `${author || ''}::${key || ''}`;
}

/** Read one cached feed page: { rows, total, cachedAt }. */
export async function readReportFeed(key) {
  const feeds = await idbGet(REPORT_FEEDS_KEY);
  const entry = feeds && feeds[key];
  return entry && Array.isArray(entry.rows) ? entry : null;
}

/** Cache one feed page, trim to the working-set limit. */
export async function writeReportFeed(key, { rows = [], total = 0 } = {}) {
  const feeds = (await idbGet(REPORT_FEEDS_KEY)) || {};
  feeds[key] = { rows, total: Number(total) || rows.length, cachedAt: Date.now() };
  await idbSet(REPORT_FEEDS_KEY, trimFeedEntries(feeds));
}

/** Read a cached report detail and mark it recently used. */
export async function readCachedReportPayload(author, key) {
  const entries = (await idbGet(REPORT_PAYLOADS_KEY)) || {};
  const id = reportPayloadId(author, key);
  const entry = entries[id];
  if (!entry?.payload) return null;
  entries[id] = { ...entry, lastAccessedAt: Date.now() };
  await idbSet(REPORT_PAYLOADS_KEY, trimReportPayloads(entries));
  return entry.payload;
}

/** Cache one report detail payload (LRU, max 50). */
export async function writeCachedReportPayload(author, key, payload) {
  const entries = (await idbGet(REPORT_PAYLOADS_KEY)) || {};
  const id = reportPayloadId(author, key);
  const now = Date.now();
  entries[id] = { payload, cachedAt: now, lastAccessedAt: now };
  await idbSet(REPORT_PAYLOADS_KEY, trimReportPayloads(entries));
}

/** Drop every cached feed page (keep cached report details). */
export async function clearReportFeeds() {
  await idbSet(REPORT_FEEDS_KEY, {});
}

/** Drop every cached feed page + detail payload. */
export async function clearReportsCache() {
  await idbSet(REPORT_FEEDS_KEY, {});
  await idbSet(REPORT_PAYLOADS_KEY, {});
}
