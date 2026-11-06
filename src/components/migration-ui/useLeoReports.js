// LEO Reports — data hook.
// Feeds the LEO view from the forwarded-report callable, with a smart
// IndexedDB cache: cached rows render immediately, the live feed refreshes in
// the background, and the 50 most recently forwarded reports stay available
// offline. Every report open is audited (live opens server-side, cache hits
// through the dedicated view-log callable).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  triggerListLeoReports, triggerGetLeoReport, triggerLogLeoReportView, triggerLogLeoPanelAccess,
  triggerGetSavedReport,
} from '../../services/firebaseFunctions';
import {
  readLeoIndex, writeLeoIndex, writeCachedLeoReport, readCachedLeoReport,
  readLeoEntries, reconcileLeoCache, clearLeoCache, invalidateLeoIndex, leoCacheId,
} from '../../utils/leoReportCache';
import { filterLeoRows, LEO_CACHE_LIMIT } from './leoModel';
import { DEMO_LEO_ROWS, findDemoLeoPayload } from './demoData';
import { isLocalPreview } from './viewModel';
import { getAppBuildId } from '../../utils/buildVersion';

const warnOnce = (() => {
  const seen = new Set();
  return (tag, error) => {
    if (seen.has(tag)) return;
    seen.add(tag);
    console.warn(`[LEO] ${tag}:`, error?.message || error);
  };
})();

// Re-render cached rows instantly without re-hitting the API on every mount.
export const LEO_CACHE_TTL_MS = 120_000;

export function useLeoReports({ enabled = false, active = true, characterName = '' } = {}) {
  const [allRows, setAllRows] = useState([]);   // newest 50 forwarded, unfiltered
  const [total, setTotal] = useState(0);        // every forwarded report on the server
  const [agency, setAgency] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState('');
  const [fromCache, setFromCache] = useState(false);
  const [cacheCount, setCacheCount] = useState(0);
  const [cachedIds, setCachedIds] = useState(() => new Set());
  const [demoMode, setDemoMode] = useState(false);
  const mountedRef = useRef(true);
  const allRowsRef = useRef([]);
  const panelAccessLoggedRef = useRef(false);

  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => { allRowsRef.current = allRows; }, [allRows]);

  const load = useCallback(async ({ force = false } = {}) => {
    setError('');
    // No OAuth: a local preview uses clearly-labelled sample rows. Never read
    // the real cache here — it may hold reports this viewer is not signed in
    // for, and demo rows must not touch the audit log.
    if (!enabled) {
      if (isLocalPreview()) {
        setAllRows(DEMO_LEO_ROWS);
        setTotal(DEMO_LEO_ROWS.length);
        setDemoMode(true);
        setFromCache(false);
      } else {
        setAllRows([]);
        setTotal(0);
        setDemoMode(false);
      }
      setHydrated(true);
      setLoading(false);
      return;
    }
    setLoading(true);

    let cachedIndex = null;
    // 1) Cache first — instant list even on a cold/slow network.
    try {
      cachedIndex = await readLeoIndex();
      if (cachedIndex?.rows?.length && mountedRef.current) {
        setAllRows(cachedIndex.rows);
        setTotal(Number(cachedIndex.total) || cachedIndex.rows.length);
        setFromCache(true);
      }
      const kept = await reconcileLeoCache(cachedIndex?.rows || []);
      const entries = await readLeoEntries();
      if (mountedRef.current) {
        setCacheCount(kept);
        setCachedIds(new Set(Object.keys(entries)));
      }
    } catch (cacheErr) {
      warnOnce('cache read failed', cacheErr);
    } finally {
      if (mountedRef.current) setHydrated(true);
    }

    // Fresh cache → no network call at all (Refresh passes force=true).
    if (!force && cachedIndex?.rows?.length
      && Date.now() - Number(cachedIndex.cachedAt) < LEO_CACHE_TTL_MS) {
      if (mountedRef.current) setLoading(false);
      return;
    }

    // 2) Live feed — the newest 50 forwarded reports.
    try {
      const result = await triggerListLeoReports({ limit: LEO_CACHE_LIMIT, offset: 0 });
      const rows = Array.isArray(result?.reports) ? result.reports : [];
      if (!mountedRef.current) return;
      setAllRows(rows);
      setTotal(Number(result?.total) || rows.length);
      setFromCache(false);
      setDemoMode(false);
      setError('');
      await writeLeoIndex({ rows, total: Number(result?.total) || rows.length });
      const kept = await reconcileLeoCache(rows);
      const entries = await readLeoEntries();
      if (mountedRef.current) {
        setCacheCount(kept);
        setCachedIds(new Set(Object.keys(entries)));
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const code = err?.code || '';
      const message = err?.message || 'Failed to load LEO reports.';
      // Local preview: fall back to sample rows only when there is nothing
      // cached/live to show; never mask real cached reports with samples.
      if (isLocalPreview() && !allRowsRef.current.length) {
        setAllRows(DEMO_LEO_ROWS);
        setTotal(DEMO_LEO_ROWS.length);
        setDemoMode(true);
        setFromCache(false);
        setError('');
        return;
      }
      const looksUndeployed = code === 'not-found' || code === 'unimplemented'
        || code === 'internal' || /function.*not.*found|does not exist/i.test(message);
      setError(looksUndeployed
        ? `LEO feed unavailable [${code || 'unknown'}]: ${message}. This build is localhost-only — the listLeoReports callable and the VPS /api/reports/leo endpoint are implemented but not deployed.`
        : message);
      if (!allRowsRef.current.length) setFromCache(false);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (active) load();
    // `load` is stable per auth state; active only flips when the LEO view opens.
  }, [active, load]);

  // Panel-open audit: one call per LEO visit (not per refresh/filter). This is
  // deliberately independent of the feed cache — a cache hit still logs.
  useEffect(() => {
    if (!active) {
      panelAccessLoggedRef.current = false;
      return;
    }
    if (!enabled || panelAccessLoggedRef.current) return;
    panelAccessLoggedRef.current = true;
    const onPrototype = typeof window !== 'undefined'
      && window.location.hash.includes('ui-prototype');
    triggerLogLeoPanelAccess({
      source: onPrototype ? 'prototype' : 'migration-ui',
      // The Auth claim only carries a PHMC faction character; LEO users are
      // often not PHMC, so send the signed-in client's active character as a
      // display hint. UID/OAuth remain server-verified.
      characterName: String(characterName || ''),
      appBuild: getAppBuildId(),
    }).catch(() => { panelAccessLoggedRef.current = false; });
  }, [active, enabled, characterName]);

  const rows = useMemo(
    () => filterLeoRows(allRows, { agency, query }),
    [allRows, agency, query],
  );

  /**
   * Open one forwarded report. Returns `{ payload, fromCache }` where payload
   * is the same `{ success, report, bbCode }` shape as getSavedReport.
   */
  const openReport = useCallback(async (row) => {
    const author = row?.author;
    const key = row?.key;
    if (!author || !key) throw new Error('Report identity is missing.');

    // Sample rows never hit the cache, the callables or the audit log.
    if (row?.demo) {
      const payload = findDemoLeoPayload(key);
      if (!payload) throw new Error('Sample report is missing.');
      return { payload, fromCache: false, demo: true };
    }

    const cached = await readCachedLeoReport(author, key);
    if (cached?.payload) {
      // Cache hit: audit the view (source=cache), then revalidate quietly.
      triggerLogLeoReportView({ author, key, source: 'cache', characterName })
        .catch((err) => warnOnce('cache view log failed', err));
      triggerGetSavedReport({ author, key })
        .then((payload) => { if (payload?.report) writeCachedLeoReport({ author, key, payload }); })
        .catch((err) => warnOnce('cache revalidate failed', err));
      return { payload: cached.payload, fromCache: true };
    }

    // Live open: the server logs the view before returning the payload.
    const payload = await triggerGetLeoReport({ author, key, characterName });
    await writeCachedLeoReport({ author, key, payload, viewedAt: Date.now() });
    setCacheCount((count) => Math.min(count + 1, LEO_CACHE_LIMIT));
    setCachedIds((prev) => {
      const next = new Set(prev);
      next.add(leoCacheId(author, key));
      return next;
    });
    return { payload, fromCache: false };
  }, [characterName]);

  const clearCache = useCallback(async () => {
    await clearLeoCache();
    setCacheCount(0);
    setCachedIds(new Set());
  }, []);

  /**
   * Live-feed invalidation (report store changed): drop the cached index so
   * the next open fetches, and refresh immediately when the LEO tab is open.
   * Cached payloads stay — opening a still-forwarded report remains instant.
   */
  const invalidate = useCallback(async () => {
    try {
      await invalidateLeoIndex();
    } catch {
      /* IndexedDB unavailable — the forced load below still refreshes */
    }
    if (active) await load({ force: true });
  }, [active, load]);

  return {
    rows, total, agency, query, loading, hydrated, error, fromCache, cacheCount, cachedIds,
    demoMode, setAgency, setQuery, load, openReport, clearCache, invalidate,
  };
}
