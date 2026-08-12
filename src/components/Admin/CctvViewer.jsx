import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, Spinner, Alert, Form, Table } from 'react-bootstrap';
import { triggerGetCctvData, triggerCctvFetch } from '../../services/firebaseFunctions';

const ITEMS_PER_PAGE = 15;

// Module-level + localStorage cache — survives page refreshes
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_KEY_CAMERAS = 'cctv_cameras';
const CACHE_KEY_LOGS_PREFIX = 'cctv_logs_';

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch { return null; }
}

function cacheSet(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

function cacheClear() {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('cctv_'));
    keys.forEach(k => localStorage.removeItem(k));
  } catch {}
}

let _cachedCameras = null;
let _cachedLogs = {};
let _cachedSearchResults = null;

const CctvViewer = ({ showInAppNotification, hideHeader }) => {
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMode, setSearchMode] = useState('camera'); // 'camera' | 'all'
  const [searchResults, setSearchResults] = useState(null);
  const [cameraFilter, setCameraFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingCameras, setIsLoadingCameras] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isSearchingAll, setIsSearchingAll] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);
  const [searchAllDebounce, setSearchAllDebounce] = useState(null);

  // ── Load camera list on mount ──────────────────────────────────────────
  const loadCameras = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = _cachedCameras || cacheGet(CACHE_KEY_CAMERAS);
      if (cached) {
        console.debug('[CCTV] Camera list loaded from cache');
        setCameras(cached);
        setIsLoadingCameras(false);
        return;
      }
    }
    setIsLoadingCameras(true);
    setError(null);
    const t0 = performance.now();
    console.debug('[CCTV] Fetching camera list...');
    try {
      const result = await triggerGetCctvData({});
      const t1 = performance.now();
      console.debug(`[CCTV] Firebase function returned in ${(t1 - t0).toFixed(0)}ms`);
      if (result.success) {
        _cachedCameras = result.data || [];
        cacheSet(CACHE_KEY_CAMERAS, _cachedCameras);
        setCameras(_cachedCameras);
        console.debug(`[CCTV] Loaded ${_cachedCameras.length} cameras (total: ${(performance.now() - t0).toFixed(0)}ms)`);
      } else {
        setError(result.error || 'Failed to load cameras.');
        console.error('[CCTV] API error:', result.error);
      }
    } catch (err) {
      console.error(`[CCTV] Failed after ${(performance.now() - t0).toFixed(0)}ms:`, err.message);
      setError(err.message || 'Failed to load cameras.');
    } finally {
      setIsLoadingCameras(false);
    }
  }, []);

  useEffect(() => {
    loadCameras();
  }, [loadCameras]);

  // ── Load logs for selected camera ─────────────────────────────────────
  const loadLogs = useCallback(async (cameraId, forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = _cachedLogs[cameraId] || cacheGet(CACHE_KEY_LOGS_PREFIX + cameraId);
      if (cached) {
        setLogs(cached);
        setIsLoadingLogs(false);
        return;
      }
    }
    setIsLoadingLogs(true);
    setError(null);
    try {
      const result = await triggerGetCctvData({ cameraId });
      if (result.success) {
        const logs = result.data?.logs || [];
        _cachedLogs[cameraId] = logs;
        cacheSet(CACHE_KEY_LOGS_PREFIX + cameraId, logs);
        setLogs(logs);
      } else {
        setLogs([]);
        setError(result.error || 'Failed to load logs.');
      }
    } catch (err) {
      setLogs([]);
      setError(err.message || 'Failed to load logs.');
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  const handleSelectCamera = (cameraId) => {
    setSelectedCamera(cameraId);
    setSearchTerm('');
    setSearchResults(null);
    setCurrentPage(1);
    loadLogs(cameraId);
  };

  // ── Search All Cameras ─────────────────────────────────────────────────
  const performSearchAll = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSearchResults(null);
      return;
    }
    // Check cache for this query
    if (_cachedSearchResults?.query === query) {
      setSearchResults(_cachedSearchResults);
      return;
    }
    setIsSearchingAll(true);
    try {
      const result = await triggerGetCctvData({ search: query });
      if (result.success) {
        _cachedSearchResults = result.data;
        setSearchResults(_cachedSearchResults);
      } else {
        setSearchResults(null);
      }
    } catch (err) {
      setSearchResults(null);
    } finally {
      setIsSearchingAll(false);
    }
  }, []);

  const handleSearchAllChange = (value) => {
    setSearchTerm(value);
    // Debounce: wait 400ms after typing stops
    if (searchAllDebounce) clearTimeout(searchAllDebounce);
    const timer = setTimeout(() => {
      performSearchAll(value);
    }, 400);
    setSearchAllDebounce(timer);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (searchAllDebounce) clearTimeout(searchAllDebounce);
    };
  }, [searchAllDebounce]);

  const switchSearchMode = (mode) => {
    setSearchMode(mode);
    setSearchTerm('');
    setSearchResults(null);
    setCurrentPage(1);
    if (mode === 'all' && selectedCamera) {
      setSelectedCamera(null);
    }
  };

  // ── Fetch latest records ───────────────────────────────────────────────
  const handleFetchLatest = async () => {
    setIsFetching(true);
    _cachedCameras = null;
    _cachedLogs = {};
    _cachedSearchResults = null;
    cacheClear();
    try {
      const result = await triggerCctvFetch();
      if (result.success) {
        showInAppNotification && showInAppNotification('Fetch triggered — refreshing data in ~35s.', 'info');
        setTimeout(async () => {
          await loadCameras(true);
          if (selectedCamera) {
            await loadLogs(selectedCamera, true);
          }
          setIsFetching(false);
          showInAppNotification && showInAppNotification('CCTV data refreshed.', 'success');
        }, 35000);
      } else {
        setIsFetching(false);
        showInAppNotification && showInAppNotification('Failed to trigger fetch.', 'error');
      }
    } catch (err) {
      setIsFetching(false);
      showInAppNotification && showInAppNotification(`Error: ${err.message}`, 'error');
    }
  };

  // ── Filter cameras by name/id ──────────────────────────────────────────
  const filteredCameras = useMemo(() => {
    if (!cameraFilter) return cameras;
    const q = cameraFilter.toLowerCase();
    return cameras.filter(
      (cam) =>
        String(cam.id).includes(q) ||
        (cam.name || '').toLowerCase().includes(q)
    );
  }, [cameras, cameraFilter]);

  // ── Filter logs by search term (single-camera mode) ────────────────────
  const filteredLogs = useMemo(() => {
    if (!searchTerm) return logs;
    const q = searchTerm.toLowerCase();
    return logs.filter(
      (entry) =>
        (entry.message || '').toLowerCase().includes(q) ||
        (entry.date || '').toLowerCase().includes(q)
    );
  }, [logs, searchTerm]);

  // ── Pagination ─────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLogs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLogs, currentPage]);

  const handlePageChange = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, searchMode]);

  // ── Strip HTML from date strings ───────────────────────────────────────
  const stripHtml = (html) => {
    if (!html) return '';
    return html.replace(/<[^>]+>/g, '').trim();
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="cctv-viewer">
      <style>{`
        .cctv-viewer .cctv-layout {
          display: flex;
          gap: 20px;
          height: calc(100vh - 260px);
          min-height: 500px;
        }
        .cctv-viewer .cctv-sidebar {
          width: 320px;
          min-width: 320px;
          display: flex;
          flex-direction: column;
          background: rgba(255,255,255,0.03);
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .cctv-viewer .cctv-sidebar-header {
          padding: 15px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .cctv-viewer .cctv-sidebar-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }
        .cctv-viewer .cctv-camera-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          cursor: pointer;
          border-radius: 6px;
          transition: background 0.15s;
          margin-bottom: 2px;
        }
        .cctv-viewer .cctv-camera-item:hover {
          background: rgba(255,255,255,0.06);
        }
        .cctv-viewer .cctv-camera-item.active {
          background: rgba(13, 110, 253, 0.2);
          border: 1px solid rgba(13, 110, 253, 0.3);
        }
        .cctv-viewer .cctv-camera-id {
          font-weight: 700;
          font-size: 0.85rem;
          color: var(--admin-accent, #6f42c1);
          margin-right: 10px;
        }
        .cctv-viewer .cctv-camera-name {
          font-size: 0.8rem;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cctv-viewer .cctv-camera-count {
          font-size: 0.75rem;
          color: var(--text-muted, #6c757d);
          margin-left: 8px;
          white-space: nowrap;
        }
        .cctv-viewer .cctv-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: rgba(255,255,255,0.03);
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.08);
          overflow: hidden;
        }
        .cctv-viewer .cctv-main-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 15px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          gap: 15px;
          flex-wrap: wrap;
        }
        .cctv-viewer .cctv-search {
          flex: 1;
          min-width: 200px;
          max-width: 400px;
        }
        .cctv-viewer .cctv-search-mode-toggle {
          display: flex;
          background: rgba(255,255,255,0.05);
          border-radius: 6px;
          padding: 2px;
        }
        .cctv-viewer .cctv-search-mode-btn {
          border: none;
          background: transparent;
          color: var(--text-muted, #6c757d);
          padding: 6px 14px;
          border-radius: 5px;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.15s;
        }
        .cctv-viewer .cctv-search-mode-btn.active {
          background: var(--admin-accent, #6f42c1);
          color: #fff;
        }
        .cctv-viewer .cctv-search-mode-btn:hover:not(.active) {
          color: #fff;
        }
        .cctv-viewer .cctv-table-wrap {
          flex: 1;
          overflow-y: auto;
        }
        .cctv-viewer .cctv-table-wrap table {
          margin-bottom: 0;
        }
        .cctv-viewer .cctv-camera-group-heading {
          background: rgba(255,255,255,0.04);
          padding: 10px 16px;
          font-weight: 700;
          font-size: 0.9rem;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          position: sticky;
          top: 0;
          z-index: 1;
        }
        .cctv-viewer .cctv-pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px;
          border-top: 1px solid rgba(255,255,255,0.08);
          font-size: 0.85rem;
        }
        .cctv-viewer .cctv-pagination .page-info {
          color: var(--text-muted, #6c757d);
        }
        .cctv-viewer .cctv-no-data {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
          color: var(--text-muted, #6c757d);
          padding: 40px;
          text-align: center;
        }
        .cctv-viewer .cctv-match-badge {
          display: inline-block;
          background: rgba(13, 110, 253, 0.2);
          color: #6ea8fe;
          border-radius: 10px;
          padding: 1px 8px;
          font-size: 0.75rem;
          margin-left: 8px;
        }
      `}</style>

      <div className="d-flex justify-content-between align-items-center mb-3">
        {!hideHeader && (
        <h2 className="mb-0 fw-800">
          <i className="fas fa-video me-3 text-indigo"></i>CCTV Camera Logs
        </h2>
        )}
        <Button
          variant="outline-primary"
          onClick={handleFetchLatest}
          disabled={isFetching}
          className="d-flex align-items-center gap-2"
        >
          {isFetching ? (
            <><Spinner animation="border" size="sm" /> Fetching...</>
          ) : (
            <><i className="fas fa-sync-alt"></i> Fetch Latest Records</>
          )}
        </Button>
      </div>

      {error && !isLoadingCameras && (
        <Alert variant="danger" dismissible onClose={() => setError(null)} className="py-2">
          <i className="fas fa-exclamation-triangle me-2"></i>{error}
          <Button variant="link" className="text-white ms-2 p-0" onClick={loadCameras}>
            Retry
          </Button>
        </Alert>
      )}

      {isLoadingCameras ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="text-muted mt-2">Loading cameras...</p>
        </div>
      ) : cameras.length === 0 ? (
        <div className="text-center py-5">
          <i className="fas fa-video-slash fa-3x text-muted mb-3"></i>
          <p className="text-muted">No CCTV data available — the daily fetch may not have run yet.</p>
          <Button variant="outline-primary" onClick={handleFetchLatest} disabled={isFetching}>
            <i className="fas fa-play me-2"></i>Run Fetch Now
          </Button>
        </div>
      ) : (
        <div className="cctv-layout">
          {/* ── Left sidebar: camera list ── */}
          <div className="cctv-sidebar">
            <div className="cctv-sidebar-header">
              <Form.Control
                type="text"
                placeholder="Filter cameras..."
                value={cameraFilter}
                onChange={(e) => setCameraFilter(e.target.value)}
                className="bg-dark border-secondary text-white"
                size="sm"
              />
              <small className="text-muted mt-1 d-block">
                {filteredCameras.length} / {cameras.length} cameras
              </small>
            </div>
            <div className="cctv-sidebar-list">
              {filteredCameras.map((cam) => (
                <div
                  key={cam.id}
                  className={`cctv-camera-item ${selectedCamera === cam.id ? 'active' : ''}`}
                  onClick={() => handleSelectCamera(cam.id)}
                >
                  <span className="cctv-camera-id">#{cam.id}</span>
                  <span className="cctv-camera-name" title={cam.name}>
                    {cam.name}
                  </span>
                  <span className="cctv-camera-count">
                    <i className={`fas fa-circle fa-xs me-1 ${cam.hasLogs ? 'text-success' : 'text-secondary'}`}></i>
                    {cam.logCount}
                  </span>
                </div>
              ))}
              {filteredCameras.length === 0 && (
                <div className="text-center text-muted py-4 small">
                  No cameras matching "{cameraFilter}"
                </div>
              )}
            </div>
          </div>

          {/* ── Right panel: log viewer ── */}
          <div className="cctv-main">
            {/* ── Search mode toggle ── */}
            <div className="cctv-main-header">
              <div className="cctv-search-mode-toggle">
                <button
                  className={`cctv-search-mode-btn ${searchMode === 'camera' ? 'active' : ''}`}
                  onClick={() => switchSearchMode('camera')}
                >
                  <i className="fas fa-camera me-1"></i> This Camera
                </button>
                <button
                  className={`cctv-search-mode-btn ${searchMode === 'all' ? 'active' : ''}`}
                  onClick={() => switchSearchMode('all')}
                >
                  <i className="fas fa-search me-1"></i> All Cameras
                </button>
              </div>

              {searchMode === 'camera' && selectedCamera && (
                <div className="d-flex align-items-center gap-2">
                  <strong className="text-indigo">#{selectedCamera}</strong>
                  <span className="text-muted small">
                    {cameras.find((c) => c.id === selectedCamera)?.name || ''}
                  </span>
                  <span className="text-muted small">({filteredLogs.length} entries)</span>
                </div>
              )}

              <Form.Control
                type="text"
                placeholder={searchMode === 'all' ? 'Search across all cameras...' : 'Search messages...'}
                value={searchTerm}
                onChange={(e) =>
                  searchMode === 'all'
                    ? handleSearchAllChange(e.target.value)
                    : setSearchTerm(e.target.value)
                }
                className="cctv-search bg-dark border-secondary text-white"
                size="sm"
              />
            </div>

            {/* ── Search All Cameras results ── */}
            {searchMode === 'all' ? (
              <>
                {isSearchingAll ? (
                  <div className="cctv-no-data">
                    <div>
                      <Spinner animation="border" variant="primary" />
                      <p className="mt-2 text-muted">Searching all cameras...</p>
                    </div>
                  </div>
                ) : !searchTerm || searchTerm.length < 2 ? (
                  <div className="cctv-no-data">
                    <div>
                      <i className="fas fa-search fa-3x mb-3 d-block"></i>
                      <p>Enter at least 2 characters to search across all cameras.</p>
                    </div>
                  </div>
                ) : searchResults && searchResults.totalMatches > 0 ? (
                  <div className="cctv-table-wrap">
                    <div className="px-3 py-2 small text-muted border-bottom border-secondary">
                      Found <strong>{searchResults.totalMatches}</strong> matches across{' '}
                      <strong>{searchResults.camerasWithMatches}</strong> camera(s)
                      {searchTerm && <> for "<strong>{searchResults.query}</strong>"</>}
                    </div>
                    {searchResults.results.map((group) => (
                      <div key={group.cameraId}>
                        <div className="cctv-camera-group-heading">
                          <span className="text-indigo">#{group.cameraId}</span>
                          {' '}{group.cameraName}
                          <span className="cctv-match-badge">{group.matchCount} matches</span>
                        </div>
                        <Table hover responsive className="mb-0" variant="dark">
                          <thead>
                            <tr>
                              <th style={{ width: '160px' }}>Date</th>
                              <th>Message</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.logs.slice(0, ITEMS_PER_PAGE).map((entry) => (
                              <tr key={entry.id}>
                                <td className="text-nowrap small">{stripHtml(entry.date)}</td>
                                <td className="small">{entry.message}</td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                        {group.matchCount > ITEMS_PER_PAGE && (
                          <div className="small text-muted text-center py-2">
                            Showing {ITEMS_PER_PAGE} of {group.matchCount} matches for this camera.
                            <Button
                              variant="link"
                              size="sm"
                              className="ms-2 text-info"
                              onClick={() => handleSelectCamera(group.cameraId)}
                            >
                              View full camera log
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : searchTerm && searchTerm.length >= 2 && searchResults ? (
                  <div className="cctv-no-data">
                    <div>
                      <i className="fas fa-search-minus fa-3x mb-3 d-block"></i>
                      <p>No matches found for "<strong>{searchTerm}</strong>".</p>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              /* ── Single Camera view ── */
              <>
                {!selectedCamera ? (
                  <div className="cctv-no-data">
                    <div>
                      <i className="fas fa-hand-pointer fa-3x mb-3 d-block"></i>
                      <p>Select a camera from the list to view its logs.</p>
                    </div>
                  </div>
                ) : isLoadingLogs ? (
                  <div className="cctv-no-data">
                    <div>
                      <Spinner animation="border" variant="primary" />
                      <p className="mt-2 text-muted">Loading logs...</p>
                    </div>
                  </div>
                ) : logs.length === 0 ? (
                  <div className="cctv-no-data">
                    <p className="text-muted">No logs recorded for this camera.</p>
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="cctv-no-data">
                    <p className="text-muted">No entries match your search.</p>
                  </div>
                ) : (
                  <div className="cctv-table-wrap">
                    <Table hover responsive className="mb-0" variant="dark">
                      <thead>
                        <tr>
                          <th style={{ width: '160px' }}>Date</th>
                          <th>Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedLogs.map((entry) => (
                          <tr key={entry.id}>
                            <td className="text-nowrap small">
                              {stripHtml(entry.date)}
                            </td>
                            <td className="small">{entry.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}

                {filteredLogs.length > ITEMS_PER_PAGE && (
                  <div className="cctv-pagination">
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => handlePageChange(currentPage - 1)}
                    >
                      <i className="fas fa-chevron-left"></i>
                    </Button>
                    <span className="page-info">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => handlePageChange(currentPage + 1)}
                    >
                      <i className="fas fa-chevron-right"></i>
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CctvViewer;
