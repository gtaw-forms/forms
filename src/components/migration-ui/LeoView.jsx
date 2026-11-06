// Migration UI — View LEO Reports.
// Every saved report marked `ReportRequested: true` is forwarded to its
// designated agency and surfaced here for OAuth-authenticated users. The
// newest 50 are cached in IndexedDB (instant open, offline-tolerant) and every
// open is audited: live opens server-side, cache hits via logLeoReportView.
import React, { useMemo, useState } from 'react';
import ReportDetail, {
  AutopsyCaseInformation, Card, PhotoGroups, reportHistory, reportPhotoCount, reportPhotoGroups,
} from './ReportDetail';
import {
  LEO_AGENCY_FILTERS, leoAgencyBadge, leoRowMeta,
} from './leoModel';
import {
  agencyLabel, formatDateTimeUTC, formatTimestampShortUTC, kindFromFormId,
  normalizeDepartment, recordTitle,
} from './viewModel';
import { leoCacheId } from '../../utils/leoReportCache';
import { LEO_CACHE_LIMIT } from './leoModel';

function LeoReportDetail({ row, payload, fromCache, demo, viewerName, onBack }) {
  const [tab, setTab] = useState('overview');
  const report = useMemo(() => payload?.report || {}, [payload]);
  const values = useMemo(
    () => (report.data && typeof report.data === 'object' ? report.data : {}),
    [report],
  );
  const kind = kindFromFormId(report.formId || row.formId);
  const title = report.originalKey || row.title || recordTitle(kind, values);
  const department = normalizeDepartment(values.department || row.department);
  const agency = agencyLabel(department);
  const agencyCode = leoAgencyBadge({ department });
  const forwardedAt = row.timestamp || report.timestamp;
  const meta = useMemo(
    () => ({ savedAt: report.timestamp || row.timestamp, updatedAt: row.updatedAt }),
    [report.timestamp, row.timestamp, row.updatedAt],
  );
  const photoGroups = useMemo(() => reportPhotoGroups(kind, values), [kind, values]);
  const photoCount = useMemo(() => reportPhotoCount(kind, values), [kind, values]);
  const history = useMemo(() => reportHistory(kind, values, meta), [kind, values, meta]);
  const hasPhotos = photoGroups.some((g) => (g.urls || []).length);

  return (
    <div className="wrap">
      <div className="switchrow">
        <button type="button" className="btn ghost" onClick={onBack}>← Back to LEO reports</button>
        <span className="cap" style={{ marginLeft: 6 }}>FORWARDED REPORT</span>
      </div>

      <div className="agency-banner">
        <div>
          <div className="cap">DESIGNATED AGENCY</div>
          <div className="name">{agencyCode} — {agency}</div>
        </div>
        <div className="meta">
          Forwarded {formatTimestampShortUTC(forwardedAt)}
          <br />
          {values.requestingOfficer ? `Requesting officer: ${values.requestingOfficer}` : 'No requesting officer recorded'}
        </div>
      </div>

      <div className="report-title">
        {kind === 'coroner' ? 'Coroner Report — ' : kind === 'mass' ? 'Mass Fatality — ' : 'Autopsy — '}
        {title}
      </div>
      <div className="report-sub">
        <span className="pill">{agencyCode}</span>
        {demo
          ? <span className="pill amber">Sample</span>
          : <span className={`pill ${fromCache ? 'amber' : 'teal'}`}>{fromCache ? 'Cached copy' : 'Live record'}</span>}
        <span>Reported by {values.coronerEmployee || row.authorName || row.author || '—'} · {formatDateTimeUTC(values.dateTime || values.autopsyStartTime)}</span>
      </div>

      <div className="cache-line">
        {demo
          ? <span>Sample data — local preview only. This is not a real forwarded report and nothing is logged.</span>
          : <span>Viewed as {viewerName || 'signed-in user'} — this open was logged for audit.</span>}
      </div>

      <div className="tabs">
        <button type="button" className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>▤ Overview</button>
        <button type="button" className={tab === 'photos' ? 'active' : ''} onClick={() => setTab('photos')}>◍ Photos<span className="n">{photoCount}</span></button>
        <button type="button" className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>◷ History<span className="n">{history.length}</span></button>
      </div>

      {tab === 'overview' && (
        <>
          {kind === 'autopsy'
            ? <AutopsyCaseInformation values={values} caseUrl={values.caseUrl || ''} />
            : null}
          <ReportDetail kind={kind} values={values} />
        </>
      )}

      {tab === 'photos' && (
        <Card icon="◍" heading="All photos">
          {hasPhotos
            ? <PhotoGroups groups={photoGroups} />
            : <div className="empty">No photos attached to this report.</div>}
        </Card>
      )}

      {tab === 'history' && (
        <Card icon="◷" heading="History">
          {history.map((entry, i) => (
            <div className="hist" key={`${entry.title}-${i}`}>
              <div className="dot" />
              <div>
                <div className="t">{entry.title}</div>
                <div className="d">{entry.detail}</div>
              </div>
            </div>
          ))}
        </Card>
      )}

      <details className="raw" style={{ marginTop: 18 }}>
        <summary>Raw payload (what the API stores / returns)</summary>
        <pre>{JSON.stringify({ kind, agency, forwardedAt, report }, null, 2)}</pre>
      </details>
    </div>
  );
}

export default function LeoView({
  leo, isAuthenticated, viewerName, onBackToRecords, recordsLabel = 'View all records',
  onOpenGuide,
}) {
  const [selected, setSelected] = useState(null); // { row, payload, fromCache }
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState('');

  const open = async (row) => {
    setOpening(true);
    setOpenError('');
    try {
      const result = await leo.openReport(row);
      setSelected({
        row,
        payload: result.payload,
        fromCache: result.fromCache,
        demo: !!result.demo,
      });
      window.scrollTo(0, 0);
    } catch (err) {
      setOpenError(err?.message || 'Failed to open the forwarded report.');
    } finally {
      setOpening(false);
    }
  };

  if (selected) {
    return (
      <LeoReportDetail
        row={selected.row}
        payload={selected.payload}
        fromCache={selected.fromCache}
        demo={selected.demo}
        viewerName={viewerName}
        onBack={() => { setSelected(null); window.scrollTo(0, 0); }}
      />
    );
  }

  if (!isAuthenticated && !leo.demoMode) {
    return (
      <div className="wrap">
        <div className="page-head">
          <div>
            <h1>LEO reports</h1>
            <p>Reports forwarded to law-enforcement agencies.</p>
          </div>
          <button type="button" className="btn ghost" onClick={onBackToRecords}>{recordsLabel}</button>
        </div>
        <div className="notice warn">
          Sign in with GTA World OAuth to view LEO reports. Forwarded reports are visible to
          signed-in users only, and every open is logged.
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1>LEO reports</h1>
          <p>
            {leo.demoMode
              ? `${(leo.rows || []).length} sample reports · local preview (no OAuth required)`
              : `${(leo.rows || []).length} forwarded report${(leo.rows || []).length === 1 ? '' : 's'} shown${leo.total > (leo.rows || []).length ? ` · ${leo.total} total on record` : ''} · newest first`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn ghost" onClick={() => leo.load({ force: true })} disabled={leo.loading}>
            {leo.loading ? 'Refreshing…' : leo.demoMode ? 'Reset samples' : 'Refresh'}
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => leo.clearCache()}
            disabled={!leo.cacheCount || leo.demoMode}
          >
            Clear cache
          </button>
          {onOpenGuide ? (
            <button type="button" className="btn ghost" onClick={onOpenGuide} title="How LSPD delivery works">
              ✉ LSPD guide
            </button>
          ) : null}
          <button type="button" className="btn" onClick={onBackToRecords}>{recordsLabel}</button>
        </div>
      </div>

      {leo.demoMode ? (
        <div className="notice warn">
          Sample data — local preview only. These fictional forwards demonstrate the agency labels,
          cache and access-log surfaces without OAuth. Nothing here is real and nothing is logged.
        </div>
      ) : null}

      <div className="cache-line">
        <span className={`pill ${leo.demoMode ? 'amber' : leo.fromCache ? 'amber' : 'teal'}`}>
          {leo.demoMode ? 'Sample data' : leo.fromCache ? 'Served from cache' : 'Live feed'}
        </span>
        <span>
          {leo.demoMode
            ? 'Sign in with GTA World OAuth to load the real forwarded feed and enable the IndexedDB cache + audit log.'
            : `Opened reports cached: ${leo.cacheCount}/${LEO_CACHE_LIMIT} · the newest 50 forwarded reports are indexed locally; opened payloads are cached (LRU, max 50) for instant reopen and offline replay.`}
        </span>
      </div>

      <div className="tools">
        <input
          type="search"
          value={leo.query}
          placeholder="Search title, decedent, officer, agency…"
          onChange={(e) => leo.setQuery(e.target.value)}
        />
        <div className="tabs rep-switch">
          {LEO_AGENCY_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={leo.agency === filter.id ? 'active' : ''}
              onClick={() => leo.setAgency(filter.id)}
            >
              {filter.id === 'all' ? 'All agencies' : filter.short}
            </button>
          ))}
        </div>
      </div>

      {leo.error ? <div className="notice err">{leo.error}</div> : null}
      {openError ? <div className="notice err">{openError}</div> : null}
      {opening ? <div className="notice">Opening forwarded report…</div> : null}

      {leo.loading && !(leo.rows || []).length ? <div className="notice">Loading forwarded reports…</div> : null}

      {!leo.loading && !(leo.rows || []).length && !leo.error ? (
        <div className="empty">
          No forwarded reports match this filter. Coroner reports appear once saved with
          &ldquo;Report requested&rdquo; checked; mass fatality reports appear once their
          &ldquo;Requested&rdquo; box is ticked.
        </div>
      ) : null}

      {(leo.rows || []).map((row) => {
        const cached = leo.cachedIds?.has(leoCacheId(row.author, row.key));
        return (
          <button
            key={`${row.author}:${row.key}`}
            type="button"
            className="rec"
            onClick={() => open(row)}
            disabled={opening}
          >
            <div className="type"><span className="pill">{leoAgencyBadge(row)}</span></div>
            <div className="main">
              <div className="t">{row.title || 'Untitled report'}</div>
              <div className="d">
                {leoRowMeta(row)}
                {' · '}
                {row.authorName || row.author || 'Unknown author'}
              </div>
            </div>
            <div>
              <span className={`pill ${row.demo || cached ? 'amber' : 'teal'}`}>
                {row.demo ? 'Sample' : cached ? 'Cached' : 'Forwarded'}
              </span>
            </div>
            <div className="arrow">›</div>
          </button>
        );
      })}

      <div className="notice" style={{ marginTop: 14 }}>
        {leo.demoMode
          ? 'Sample data only — the real list requires OAuth and contains coroner reports explicitly marked “Report requested” plus mass fatality reports with “Requested” ticked (LSPD, LSSD, SADCR, DAO, LSFD, SAAA).'
          : (
            <>
              Shown: coroner reports marked <strong>Report requested</strong>, plus mass fatality
              reports with <strong>Requested</strong> ticked ({LEO_AGENCY_FILTERS.slice(1).map((f) => f.short).join(', ')}).
              Access is logged with your character, OAuth name and UID for audit.
            </>
          )}
      </div>
    </div>
  );
}
