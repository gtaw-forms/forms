// Migration UI — paged global records feed (25/page, never unbounded).
// Wraps the listRecentSavedReports callable (VPS /api/reports/recent) and a
// small IndexedDB working-set cache: cached pages render instantly, the feed
// is only re-fetched when the cache is stale (5 min) or the user forces it.
import { useState, useCallback, useRef } from 'react';
import { triggerListRecentSavedReports, triggerGetSavedReport } from '../../services/firebaseFunctions';
import {
  reportFeedKey, readReportFeed, writeReportFeed, REPORT_CACHE_TTL_MS,
  readCachedReportPayload, writeCachedReportPayload, clearReportFeeds,
} from '../../utils/reportCache';
import { filterDemoRecords, findDemoRecordPayload } from './demoData';
import { isLocalPreview } from './viewModel';

export const PAGE_SIZE = 25;
export const FILTERS = [
  { id: 'all', label: 'All', formId: '' },
  { id: 'coroner', label: 'Coroner', formId: 'coroner-report' },
  { id: 'mass', label: 'Mass Fatality', formId: 'mass-ftality-test' },
  { id: 'autopsy', label: 'Autopsy', formId: 'autopsy' },
  { id: 'email', label: 'Email', formId: 'coroner_email' },
];

export function useMigrationRecords({ liveRefresh = false } = {}) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fromCache, setFromCache] = useState(false);
  // Localhost sample feed (see below): true while sample rows are shown.
  const [demoMode, setDemoMode] = useState(false);
  // Same-feed requests in flight share one callable invocation. Rapid tab/filter
  // clicks used to fire one listRecentSavedReports per click (seen in the VPS
  // log at 17:50: three "mass" calls inside two seconds).
  const inFlightRef = useRef(new Map());

  const fetchPage = useCallback(async ({
    nextOffset = 0, nextFilter = filter, nextQuery = query, append = false, force = false,
  } = {}) => {
    const formId = (FILTERS.find((f) => f.id === nextFilter) || {}).formId || '';
    const feedKey = reportFeedKey({ filter: nextFilter, query: nextQuery, offset: nextOffset });

    // Same-feed request already running → reuse it (no duplicate API call).
    if (!append && !force) {
      const existing = inFlightRef.current.get(feedKey);
      if (existing) return existing;
    }

    // 1) Cache first — instant render, and skip the network while fresh.
    if (!append && !force) {
      try {
        const cached = await readReportFeed(feedKey);
        if (cached) {
          setRows(cached.rows);
          setTotal(Number(cached.total) || cached.rows.length);
          setOffset(nextOffset);
          setFilter(nextFilter);
          setQuery(nextQuery);
          setError('');
          setFromCache(true);
          setDemoMode(false);
          if (Date.now() - Number(cached.cachedAt) < REPORT_CACHE_TTL_MS) {
            setLoading(false);
            return cached.rows;
          }
        }
      } catch {
        /* IndexedDB unavailable — fall through to the network */
      }
      // Another call may have started while the cache read was awaiting.
      const started = inFlightRef.current.get(feedKey);
      if (started) return started;
    }

    const request = (async () => {
      setLoading(true);
      setError('');
      try {
        const result = await triggerListRecentSavedReports({
          limit: PAGE_SIZE,
          offset: nextOffset,
          ...(formId ? { formId } : {}),
          ...(nextQuery.trim() ? { q: nextQuery.trim() } : {}),
        });
        const reports = Array.isArray(result?.reports) ? result.reports : [];
        const totalCount = Number(result?.total) || 0;
        // Local preview with an empty store (e.g. a fresh localhost login):
        // show clearly-labelled sample rows instead of a bare empty state.
        // Only on the unfiltered feed — a filtered/queried empty stays empty,
        // and samples are never written to the cache.
        if (isLocalPreview() && !nextQuery.trim() && nextFilter === 'all'
          && reports.length === 0 && totalCount === 0) {
          const demo = filterDemoRecords({});
          setRows(demo);
          setTotal(demo.length);
          setOffset(0);
          setFilter(nextFilter);
          setQuery(nextQuery);
          setError('');
          setFromCache(false);
          setDemoMode(true);
          return demo;
        }
        setTotal(totalCount);
        setOffset(nextOffset);
        setFilter(nextFilter);
        setQuery(nextQuery);
        setRows((prev) => (append ? [...prev, ...reports] : reports));
        setFromCache(false);
        setDemoMode(false);
        if (!append) {
          await writeReportFeed(feedKey, { rows: reports, total: totalCount });
        }
        return reports;
      } catch (e) {
        // The callable only exists after `firebase deploy --only functions`.
        // A missing callable surfaces as not-found/unimplemented — and as a
        // bare 'internal' when the Functions host returns non-JSON for the
        // unknown endpoint. Surface the raw code either way so a real
        // post-deploy server error is never misdiagnosed as "not deployed".
        const code = e?.code || '';
        const msg = e?.message || 'Failed to load records.';
        const looksUndeployed = code === 'not-found' || code === 'unimplemented'
          || code === 'internal' || /function.*not.*found|does not exist/i.test(msg);
        setError(looksUndeployed
          ? `Records feed unavailable [${code || 'unknown'}]: ${msg}. If the functions deploy predates listRecentSavedReports, run: firebase deploy --only functions, then npm run bot:deploy.`
          : msg);
        // Local preview with nothing on screen (callable missing/failed):
        // sample rows, same rules as the empty-store path above.
        if (isLocalPreview() && !nextQuery.trim() && nextFilter === 'all'
          && !append && !rows.length) {
          const demo = filterDemoRecords({});
          setRows(demo);
          setTotal(demo.length);
          setOffset(0);
          setFilter(nextFilter);
          setQuery(nextQuery);
          setError('');
          setFromCache(false);
          setDemoMode(true);
          return demo;
        }
        // Keep a cached page on screen; only clear when there is nothing to show.
        if (!append && !rows.length) { setRows([]); setTotal(0); }
        return [];
      } finally {
        setLoading(false);
      }
    })();

    if (!append) {
      inFlightRef.current.set(feedKey, request);
      try {
        return await request;
      } finally {
        inFlightRef.current.delete(feedKey);
      }
    }
    return request;
  }, [filter, query, rows.length]);

  const fetchDetail = useCallback(async (author, key, { force = false } = {}) => {
    // Sample rows never hit the cache or the callables.
    if (author === 'Demo_Author') {
      const demo = findDemoRecordPayload(author, key);
      if (!demo) throw new Error('Sample report is missing.');
      return demo;
    }
    if (!force) {
      const cached = await readCachedReportPayload(author, key);
      if (cached) {
        // Serve instantly, revalidate quietly for the next open.
        triggerGetSavedReport({ author, key })
          .then((payload) => { if (payload?.report) writeCachedReportPayload(author, key, payload); })
          .catch(() => {});
        return cached;
      }
    }
    const result = await triggerGetSavedReport({ author, key });
    await writeCachedReportPayload(author, key, result);
    return result;
  }, []);

  /**
   * Live-feed invalidation: drop every cached page, then reload the feed the
   * user is currently looking at. Called when appMetadata/reportsDataVersion
   * changes (another user saved/deleted a report).
   */
  const invalidateAndRefresh = useCallback(async () => {
    try {
      await clearReportFeeds();
    } catch {
      /* IndexedDB unavailable — the forced fetch below still refreshes */
    }
    if (!liveRefresh) return;
    await fetchPage({
      nextOffset: offset,
      nextFilter: filter,
      nextQuery: query,
      force: true,
    });
  }, [fetchPage, liveRefresh, offset, filter, query]);

  return {
    rows, total, offset, filter, query, loading, error, fromCache, demoMode,
    fetchPage, fetchDetail, invalidateAndRefresh, setFilter, setQuery,
  };
}
