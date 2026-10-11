// Migration UI — paged global records feed (25/page, never unbounded).
// Wraps the listRecentSavedReports callable (VPS /api/reports/recent).
import { useState, useCallback } from 'react';
import { triggerListRecentSavedReports, triggerGetSavedReport } from '../../services/firebaseFunctions';

export const PAGE_SIZE = 25;
export const FILTERS = [
  { id: 'all', label: 'All', formId: '' },
  { id: 'coroner', label: 'Coroner', formId: 'coroner-report' },
  { id: 'mass', label: 'Mass Fatality', formId: 'mass-ftality-test' },
  { id: 'autopsy', label: 'Autopsy', formId: 'autopsy' },
];

export function useMigrationRecords() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchPage = useCallback(async ({ nextOffset = 0, nextFilter = filter, nextQuery = query, append = false } = {}) => {
    setLoading(true);
    setError('');
    try {
      const formId = (FILTERS.find((f) => f.id === nextFilter) || {}).formId || '';
      const result = await triggerListRecentSavedReports({
        limit: PAGE_SIZE,
        offset: nextOffset,
        ...(formId ? { formId } : {}),
        ...(nextQuery.trim() ? { q: nextQuery.trim() } : {}),
      });
      const reports = Array.isArray(result?.reports) ? result.reports : [];
      const totalCount = Number(result?.total) || 0;
      setTotal(totalCount);
      setOffset(nextOffset);
      setFilter(nextFilter);
      setQuery(nextQuery);
      setRows((prev) => (append ? [...prev, ...reports] : reports));
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
      if (!append) { setRows([]); setTotal(0); }
      return [];
    } finally {
      setLoading(false);
    }
  }, [filter, query]);

  const fetchDetail = useCallback(async (author, key) => {
    const result = await triggerGetSavedReport({ author, key });
    return result || null;
  }, []);

  return { rows, total, offset, filter, query, loading, error, fetchPage, fetchDetail, setFilter, setQuery };
}
