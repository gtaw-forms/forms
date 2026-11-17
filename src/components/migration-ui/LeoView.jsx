// Migration UI — View LEO Reports.
// Every saved report marked `ReportRequested: true` is forwarded to its
// designated agency and surfaced here for OAuth-authenticated users. The
// newest 50 are cached in IndexedDB (instant open, offline-tolerant) and every
// open is audited: live opens server-side, cache hits via logLeoReportView.
import React, { useMemo, useState } from 'react';
import { ref, get, set } from 'firebase/database';
import { database } from '../../firebase';
import { useNotification } from '../../contexts/NotificationContext';
import ReportView from './ReportView';
import {
  LEO_AGENCY_FILTERS, leoAgencyBadge, leoRowMeta,
} from './leoModel';
import {
  agencyLabel, formatDateTimeUTC, formatTimestampShortUTC, kindFromFormId,
  normalizeDepartment, recordTitle,
} from './viewModel';
import { leoCacheId } from '../../utils/leoReportCache';
import { LEO_CACHE_LIMIT } from './leoModel';
import ForwardToDrdbModal from './ForwardToDrdbModal';
import {
  FORWARD_FORM,
  FORWARD_QUEUE_NODE,
  buildForwardEntity,
  findExistingLeg,
  forwardEntityKey,
  nextForwardIdx,
  validateForwardName,
} from '../../utils/forwardDrdb';

// The LEO detail is ReportView plus an agency banner, a forwarded-report status
// line and the DRDB control — the frame, tabs, photos, history, raw payload and
// Share button all come from ReportView. It used to be a hand-copied page,
// which is how Share came to exist in one view and not the other.
function LeoReportDetail({ row, payload, fromCache, demo, viewerName, isAuthenticated, onBack }) {
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwarding, setForwarding] = useState(false);
  const [forwardError, setForwardError] = useState('');
  const { showNotification } = useNotification();
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
  const canForward = isAuthenticated && !demo && kind === 'coroner' && row?.author && row?.key;
  const additionalOfficers = useMemo(
    () => (Array.isArray(values.additionalRecipients) ? values.additionalRecipients : [])
      .filter((r) => r && String(r.officer || '').trim()),
    [values.additionalRecipients],
  );

  // Manual "Send to DRDB": queue one portal leg for the named officer. The
  // bot worker files it like an automatic leg (rebuilds from the live record
  // at delivery, exact-single-recipient match or ABORT). The record itself is
  // restored first when missing — delivery refuses without it.
  const forwardToDrdb = async (rawName) => {
    const v = validateForwardName(rawName);
    if (!v.ok) { setForwardError(v.error); return; }
    setForwardError('');
    setForwarding(true);
    try {
      const author = row.author;
      const reportKey = row.key;
      const queueRef = ref(database, FORWARD_QUEUE_NODE);
      const existing = (await get(queueRef)).val() || {};
      const dup = findExistingLeg(existing, {
        form: FORWARD_FORM, authorId: author, reportKey, recipient: v.name,
      });
      if (dup) {
        setForwardOpen(false);
        showNotification(`This report is already queued for ${v.name}.`, 'info-circle');
        return;
      }
      const recRef = ref(database, `scheduledReports/${author}/${reportKey}`);
      if (!(await get(recRef)).exists() && payload?.report) {
        await set(recRef, payload.report);
        if (payload.bbCode) {
          const bbRef = ref(database, `scheduledReportsBBCode/${author}/${reportKey}`);
          if (!(await get(bbRef)).exists()) await set(bbRef, { bbCode: payload.bbCode });
        }
      }
      // Allocate idx from a fresh read (min 1 — 0 belongs to the automatic
      // leg). Retry if a concurrent forward took the key first.
      let entityKey = null;
      let idx = 1;
      for (let attempt = 0; attempt < 3; attempt++) {
        const ents = (await get(queueRef)).val() || {};
        idx = nextForwardIdx(Object.keys(ents), FORWARD_FORM, author, reportKey);
        entityKey = forwardEntityKey(FORWARD_FORM, author, reportKey, idx);
        const clash = ents[entityKey];
        if (clash && String(clash.recipient || '').trim().toLowerCase() !== v.name.toLowerCase()) continue;
        break;
      }
      await set(ref(database, `${FORWARD_QUEUE_NODE}/${entityKey}`), buildForwardEntity({
        form: FORWARD_FORM, authorId: author, reportKey,
        recipient: v.name, forwardedBy: viewerName || 'Unknown', idx,
      }));
      const check = await get(ref(database, `${FORWARD_QUEUE_NODE}/${entityKey}/recipient`));
      if (String(check.val() || '').trim().toLowerCase() !== v.name.toLowerCase()) {
        throw new Error('the queue write did not stick — please retry');
      }
      setForwardOpen(false);
      showNotification(`This report will be sent soon to ${v.name}.`, 'check-circle');
    } catch (err) {
      const reason = err?.message || 'unknown error';
      setForwardError(`Could not queue this report: ${reason}`);
      showNotification(`Could not queue this report for ${v?.name || 'that officer'}.`, 'exclamation-circle');
    } finally {
      setForwarding(false);
    }
  };

  const banner = (
    <div className="agency-banner">
      <div>
        <div className="cap">DESIGNATED AGENCY</div>
        <div className="name">{agencyCode} — {agency}</div>
      </div>
      <div className="meta">
        Forwarded {formatTimestampShortUTC(forwardedAt)}
        <br />
        {values.requestingOfficer ? `Requesting officer: ${values.requestingOfficer}` : 'No requesting officer recorded'}
        {additionalOfficers.length ? (
          <>
            <br />
            {`Additional officers: ${additionalOfficers.map((r) => String(r.officer).trim()).join(', ')}`}
          </>
        ) : null}
      </div>
    </div>
  );

  const subtitle = (
    <>
      <span className="pill">{agencyCode}</span>
      {demo
        ? <span className="pill amber">Sample</span>
        : <span className={`pill ${fromCache ? 'amber' : 'teal'}`}>{fromCache ? 'Cached copy' : 'Live record'}</span>}
      <span>Reported by {values.coronerEmployee || row.authorName || row.author || '—'} · {formatDateTimeUTC(values.dateTime || values.autopsyStartTime)}</span>
    </>
  );

  const statusLine = (
    <div className="cache-line">
      {demo
        ? <span>Sample data — local preview only. This is not a real forwarded report and nothing is logged.</span>
        : <span>Viewed as {viewerName || 'signed-in user'} — this open was logged for audit.</span>}
    </div>
  );

  return (
    <>
      <ReportView
        kind={kind}
        values={values}
        title={title}
        meta={meta}
        // Sample rows carry no real address, so they can never mint a code.
        author={demo ? '' : (row?.author || '')}
        reportKey={demo ? '' : (row?.key || '')}
        onBack={onBack}
        backLabel="Back to LEO reports"
        eyebrow="FORWARDED REPORT"
        showDatasetSwitcher={false}
        header={banner}
        subtitle={subtitle}
        statusLine={statusLine}
        headerActions={canForward ? (
          <button
            type="button"
            className="btn"
            onClick={() => { setForwardError(''); setForwardOpen(true); }}
          >
            ⇪ Send to DRDB
          </button>
        ) : null}
      />

      <ForwardToDrdbModal
        open={forwardOpen}
        reportTitle={title}
        submitting={forwarding}
        error={forwardError}
        onSubmit={forwardToDrdb}
        onClose={() => { if (!forwarding) { setForwardError(''); setForwardOpen(false); } }}
      />
    </>
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
        isAuthenticated={isAuthenticated}
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
