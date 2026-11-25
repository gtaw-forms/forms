import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  recordContainsCK, morgueLastUpdatedAt, isMorgueOverdue, formatMorgueAge,
} from '../../utils/morgue';
import { ref, onValue } from 'firebase/database';
import { database } from '../../firebase';
import { triggerRequestMorgueUpdate } from '../../services/firebaseFunctions';
import RequestAutopsyModal from './RequestAutopsyModal';
import MassRequestAutopsyModal from './MassRequestAutopsyModal';
import MorgueBodyMapModal from './MorgueBodyMapModal';
import MorgueRecordCard from './MorgueRecordCard';
import { downloadMorgueRecordCard, uploadMorgueRecordCard } from '../../utils/morgueRecordCard.jsx';

const PAGE_SIZE = 50;
const IS_LOCALHOST = window.location.hostname === 'localhost';

// Mirrors functions/index.js MORGUE_UPDATE_COOLDOWN_MS (one ping per window).
const REQUEST_COOLDOWN_MS = 2 * 60 * 60 * 1000;

const formatStamp = (ts) => (ts ? new Date(Number(ts)).toLocaleString() : 'unknown');

// Compact intake stamp for the card rows: "Tuesday, 24 November 2026 16:20:13"
// → "Tue 24 Nov 2026, 16:20". Falls back to the first words when unparseable.
const shortTOD = (t) => {
  const m = String(t || '').match(/(\w+),\s*(\d+)\s*(\w+)\s*(\d+)\s*(\d+):(\d+)/);
  if (!m) return String(t || '—').split(' ').slice(0, 4).join(' ') || '—';
  return `${m[1].slice(0, 3)} ${m[2]} ${m[3].slice(0, 3)} ${m[4]}, ${m[5]}:${m[6]}`;
};

// Stable selection identity — firebaseKey is the record key; caseId is the
// human-facing fallback so a cached record without firebaseKey still selects.
const recordKey = (r) => String(r?.firebaseKey || r?.caseId || r?.name || '');

const MorgueBrowser = ({ records, isLoading, loadRecords, showNotification, isAuthenticated, characterName, user, accessLevel }) => {
  const [search, setSearch] = useState('');
  const [ckOnly, setCkOnly] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [requestingAutopsy, setRequestingAutopsy] = useState(null);
  const [showMassModal, setShowMassModal] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [showBodyMap, setShowBodyMap] = useState(false);
  const [exportingCard, setExportingCard] = useState(false);
  const [uploadingCard, setUploadingCard] = useState(false);
  const [page, setPage] = useState(1);
  const lastClickedIndexRef = useRef(-1);
  const selectAllRef = useRef(null);

  const canAccess = IS_LOCALHOST || isAuthenticated;

  // Auto-load guard: fire at most ONCE per access-session. `loadRecords` is not
  // referentially stable (it re-creates when its DataContext deps change), so a
  // bare [deps] effect re-fires on every render; if the fetch fails and leaves
  // `records` empty, that became an unbounded reload loop (hundreds/sec).
  const autoLoadFiredRef = useRef(false);

  // Morgue audit telemetry retired 2026-10-08 (hourly rollup removed).
  // Former audit helpers (logMorgueAction/requestMorgueUpdate) deleted with it.


  // ── Morgue Admin Banner ──
  const [morgueBanner, setMorgueBanner] = useState(null);
  useEffect(() => {
    const r = ref(database, 'appMetadata/morgueBanner');
    const unsub = onValue(r, (snap) => {
      const val = snap.val();
      setMorgueBanner(val && val.text ? val : null);
    });
    return () => unsub();
  }, []);

  // ── Freshness: when the records were last imported, and the last manual
  // "please refresh" request (shared across users, written by the callable). ──
  const [dataVersionAt, setDataVersionAt] = useState(null);
  const [updateRequest, setUpdateRequest] = useState(null);
  const [requestingUpdate, setRequestingUpdate] = useState(false);
  // Minute ticker so "updated 3 hours ago" / the cooldown label stay honest
  // without re-rendering the (large) record list on a timer.
  const [clockTick, setClockTick] = useState(() => Date.now());

  useEffect(() => {
    const versionUnsub = onValue(ref(database, 'appMetadata/morgueDataVersion'), (snap) => {
      const v = Number(snap.val()) || 0;
      setDataVersionAt(v || null);
    });
    const requestUnsub = onValue(ref(database, 'appMetadata/morgueUpdateRequest'), (snap) => {
      const v = snap.val();
      setUpdateRequest(v && Number(v.at) ? { at: Number(v.at), by: v.by || null } : null);
    });
    const timer = setInterval(() => setClockTick(Date.now()), 60000);
    return () => { versionUnsub(); requestUnsub(); clearInterval(timer); };
  }, []);

  // The records themselves carry `lastUpdated` (import time). The version
  // metadata is authoritative for deletions, so use whichever is newer.
  const recordsLastUpdated = useMemo(
    () => morgueLastUpdatedAt(records, dataVersionAt),
    [records, dataVersionAt],
  );

  const isOverdue = isMorgueOverdue(recordsLastUpdated, clockTick);
  const cooldownRemainingMs = updateRequest?.at
    ? Math.max(0, REQUEST_COOLDOWN_MS - (clockTick - updateRequest.at))
    : 0;

  const handleRequestUpdate = async () => {
    if (requestingUpdate || cooldownRemainingMs > 0) return;
    setRequestingUpdate(true);
    try {
      const res = await triggerRequestMorgueUpdate();
      if (res?.at) setUpdateRequest({ at: Number(res.at), by: res.by || null });
      if (res?.posted) {
        if (res.notified === false) {
          showNotification?.('Update request recorded, but the Discord ping failed — staff will still see it in the panel.', 'warning');
        } else {
          showNotification?.('Morgue update requested — the records team has been notified.', 'success');
        }
      } else {
        showNotification?.(
          `An update was already requested ${formatMorgueAge(res?.at)}${res?.by ? ` by ${res.by}` : ''} — the records team has been notified.`,
          'info',
        );
      }
    } catch (err) {
      const message = String(err?.message || '');
      const code = String(err?.code || '');
      let note = `Could not send the update request: ${message || 'unknown error'}`;
      if (code === 'functions/not-found' || /not-found|does not exist/i.test(message)) {
        note = 'Update requests are not available yet — the request service has not been deployed.';
      } else if (code === 'functions/unauthenticated' || /unauthenticated|sign in/i.test(message)) {
        note = 'Sign in to request a morgue update.';
      } else if (code === 'functions/resource-exhausted') {
        note = message;
      }
      showNotification?.(note, 'error');
    } finally {
      setRequestingUpdate(false);
    }
  };

  // ── Set banner function for admins (passed via prop) ──
  // This gets wired from the prototype's misc panel

  // Don't load records if user isn't authenticated (bypass on localhost).
  // Fires once per access-session; the "Load Records" button and the refresh
  // control remain the explicit re-fetch paths.
  useEffect(() => {
    if (!canAccess) return;
    if (autoLoadFiredRef.current) return;
    if (isLoading || records.length > 0 || !loadRecords) return;
    autoLoadFiredRef.current = true;
    loadRecords();
  }, [canAccess, isLoading, loadRecords, records.length]);

  // Reset to page 1 when search/filter changes
  useEffect(() => { setPage(1); }, [search, ckOnly]);

  const ckCount = useMemo(() => records.filter(recordContainsCK).length, [records]);

  const filtered = useMemo(() => {
    let list = records;
    if (ckOnly) list = list.filter(recordContainsCK);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r => (r.name || '').toLowerCase().includes(q) || String(r.caseId || '').includes(q));
    }
    return [...list].sort((a, b) => String(b.caseId || '').localeCompare(String(a.caseId || ''), undefined, { numeric: true }));
  }, [records, search, ckOnly]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // ── Batch (mass) autopsy selection ──
  // Selection is keyed by record and survives paging/filtering; the "select
  // page" checkbox operates on exactly what is on screen. Shift-click selects
  // a range inside the current page (same as a file list).
  const selectedRecords = useMemo(
    () => records
      .filter(r => selectedKeys.has(recordKey(r)))
      // Same order as the list (case id desc) so "Body 1..N" matches what the
      // user ticked, including selections hidden by an active search.
      .sort((a, b) => String(b.caseId || '').localeCompare(String(a.caseId || ''), undefined, { numeric: true })),
    [records, selectedKeys],
  );
  const selectedCount = selectedRecords.length;
  const pageSelectedCount = paginated.filter(r => selectedKeys.has(recordKey(r))).length;
  const allPageSelected = paginated.length > 0 && pageSelectedCount === paginated.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = pageSelectedCount > 0 && pageSelectedCount < paginated.length;
    }
  }, [pageSelectedCount, paginated.length]);

  // Drop keys whose record disappeared after a reload so the batch modal can
  // never submit a body that is no longer in the morgue list.
  useEffect(() => {
    setSelectedKeys(prev => {
      if (prev.size === 0) return prev;
      const live = new Set(records.map(recordKey));
      const next = new Set();
      let changed = false;
      prev.forEach(k => { if (live.has(k)) next.add(k); else changed = true; });
      return changed ? next : prev;
    });
  }, [records]);

  const toggleSelect = (record, index) => (e) => {
    const key = recordKey(record);
    const shift = !!(e?.nativeEvent?.shiftKey || e?.shiftKey);
    setSelectedKeys(prev => {
      const next = new Set(prev);
      const anchor = lastClickedIndexRef.current;
      if (shift && anchor >= 0 && anchor < paginated.length && anchor !== index) {
        const [a, b] = anchor < index ? [anchor, index] : [index, anchor];
        for (let i = a; i <= b; i++) next.add(recordKey(paginated[i]));
      } else if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    lastClickedIndexRef.current = index;
  };
  const toggleSelectAllPage = () => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (allPageSelected) paginated.forEach(r => next.delete(recordKey(r)));
      else paginated.forEach(r => next.add(recordKey(r)));
      return next;
    });
    lastClickedIndexRef.current = -1;
  };
  const clearSelection = () => { setSelectedKeys(new Set()); lastClickedIndexRef.current = -1; };

  // Step through the (filtered, newest-first) list from the open record.
  const stepRecord = (dir) => {
    setSelectedRecord(cur => {
      if (!cur) return cur;
      const list = (filtered && filtered.length ? filtered : paginated);
      const i = list.findIndex(r => recordKey(r) === recordKey(cur));
      if (i < 0) return list[0] || cur;
      return list[(i + dir + list.length) % list.length];
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {!canAccess && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: 16 }}>
          <i className="fas fa-lock" style={{ fontSize: 32, color: 'var(--text-muted)', opacity: 0.4 }} />
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, color: 'var(--text)' }}>Authentication Required</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13, maxWidth: 360 }}>
              You must be signed in to access morgue records. Sign in with a GTA World account (employee or non-employee).
            </p>
          </div>
        </div>
      )}

      {canAccess && (<>
      {morgueBanner && (
        <div style={{
          padding: '10px 16px', margin: '8px 22px 0', borderRadius: 8,
          background: morgueBanner.type === 'warning' ? 'var(--amber-dim)' : 'var(--teal-dim)',
          border: `1px solid ${morgueBanner.type === 'warning' ? 'var(--amber)' : 'var(--teal)'}`,
          color: morgueBanner.type === 'warning' ? 'var(--amber)' : 'var(--teal)',
          fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <i className={`fas ${morgueBanner.type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`} style={{ marginTop: 1 }} />
          <span style={{ flex: 1 }}>{morgueBanner.text}</span>
        </div>
      )}
      <div style={{ padding: '12px 18px 10px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Morgue Records</span>
          <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>{records.length.toLocaleString()} intakes</span>
          <span style={{
            marginLeft: 'auto', fontSize: 11, whiteSpace: 'nowrap',
            color: isOverdue ? 'var(--amber)' : 'var(--teal)',
            border: `1px solid ${isOverdue ? 'var(--amber)' : 'var(--teal)'}`,
            borderRadius: 20, padding: '4px 12px',
          }}>
            {recordsLastUpdated ? <>● Updated {formatMorgueAge(recordsLastUpdated, clockTick)} (about every 48h)</> : 'No records loaded'}
          </span>
        </div>
        <div className="lookup-bar" style={{ marginBottom: 8 }}>
          <input type="text" placeholder="Search by decedent name, OOC name, case ID or street…" value={search}
            onChange={e => setSearch(e.target.value)} />
          <button
            className="btn btn-ghost"
            style={{
              fontSize: 12, whiteSpace: 'nowrap', borderRadius: 20, padding: '8px 16px',
              ...(ckOnly ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : {}),
            }}
            onClick={() => setCkOnly(v => !v)}
            title="Show only records with a (CK) marker in any field">
            CK only{ckOnly ? ` (${filtered.length})` : ckCount > 0 ? ` (${ckCount})` : ''}
          </button>
          {selectedCount > 0 && (
            <div className="batch-tools">
              <span className="batch-count" title="Selection is kept while paging and filtering">
                <i className="fas fa-square-check me-1" />{selectedCount} selected
              </span>
              <button
                className="btn btn-primary"
                style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                disabled={selectedCount < 2}
                title={selectedCount < 2 ? 'Select at least 2 bodies — use the row action for a single autopsy' : `File one batch request for ${selectedCount} bodies`}
                onClick={() => setShowMassModal(true)}
              >
                <i className="fas fa-layer-group me-1" />
                Request {selectedCount} {selectedCount === 1 ? 'Autopsy' : 'Autopsies'}
              </button>
              <button className="btn btn-ghost" style={{ fontSize: 12, whiteSpace: 'nowrap' }} onClick={clearSelection} title="Clear the batch selection">
                <i className="fas fa-xmark me-1" /> Clear
              </button>
            </div>
          )}
          <button className="btn btn-ghost" style={{ fontSize: 12, whiteSpace: 'nowrap' }}
            onClick={() => { setShowBodyMap(true); }}
            title="Show a map of body counts per street">
            <i className="fas fa-map-location-dot me-1" /> Body Map
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allPageSelected}
            onChange={toggleSelectAllPage}
            title="Select every body on this page"
            aria-label="Select every body on this page"
          />
          <span>Showing {filtered.length} of {records.length} · newest first · tick rows for batch requests (shift-click selects a range)</span>
          {selectedCount > 0 && <span style={{ color: 'var(--teal)' }}>· {selectedCount} selected</span>}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '10px 18px', position: 'relative' }}>
        {isLoading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            background: 'rgba(11,18,32,0.85)', zIndex: 5,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '3px solid var(--border)', borderTopColor: 'var(--teal)',
              animation: 'spin 0.8s linear infinite',
            }} />
            <div style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--mono)' }}>
              Loading morgue records...
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        {!isLoading && records.length === 0 && !search && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: 12 }}>
            <i className="fas fa-database" style={{ fontSize: 28, opacity: 0.3, color: 'var(--text-faint)' }} />
            <p style={{ color: 'var(--text-faint)', fontSize: 13, margin: 0 }}>No morgue records loaded.</p>
            <button className="btn btn-ghost" onClick={() => loadRecords?.({ force: true })} style={{ fontSize: 12 }}>
              <i className="fas fa-sync me-1" /> Load Records
            </button>
          </div>
        )}
        {!isLoading && <>
        {paginated.map((r, index) => {
          const isSelected = selectedKeys.has(recordKey(r));
          const isCK = recordContainsCK(r);
          const sexBadge = /^f/i.test(String(r.sex || '')) ? 'FEMALE' : /^m/i.test(String(r.sex || '')) ? 'MALE' : '';
          const narcRaw = String(r.narcotics || '').trim();
          const narcParts = narcRaw && !/^(n\/a|none)$/i.test(narcRaw) ? narcRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
          const narcLabel = narcParts.length > 1 ? `${narcParts[0]} +${narcParts.length - 1}` : narcParts[0] || '';
          const woundCount = Array.isArray(r.findings) ? r.findings.length : 0;
          const slugCount = Array.isArray(r.bullets) ? r.bullets.length : 0;
          return (
          <div key={r.firebaseKey || r.caseId} style={{
            display: 'flex', gap: 12, alignItems: 'center',
            background: '#111a26',
            border: `1px solid ${isSelected ? 'var(--teal)' : isCK ? '#e0494f' : '#26374c'}`,
            borderLeft: `4px solid ${isCK ? '#e0494f' : 'var(--teal)'}`,
            borderRadius: 10, padding: '12px 16px', marginBottom: 8,
          }}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={toggleSelect(r, index)}
              onClick={e => e.stopPropagation()}
              title="Add this body to a batch autopsy request (shift-click for a range)"
              aria-label={`Select ${r.name || 'record'} (case ${r.caseId || 'unknown'})`}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#8ea3b8' }}>#{r.caseId}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#e9f0f7' }}>{r.name || 'Unknown'}</span>
                {isCK && (
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, padding: '2px 8px', borderRadius: 20, background: '#e0494f', color: '#fff' }}>CK</span>
                )}
                {sexBadge && (
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, padding: '2px 8px', borderRadius: 20, background: '#33475f', color: '#fff' }}>{sexBadge}</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#8ea3b8', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.location || '—'} · {shortTOD(r.timeOfDeath)} · {r.causeOfDeath || '—'} · {woundCount} {woundCount === 1 ? 'wound' : 'wounds'}
                {slugCount > 0 && <> · {slugCount} {slugCount === 1 ? 'projectile' : 'projectiles'}</>}
                {narcLabel && <> · <span style={{ color: '#e8b64c' }}>● {narcLabel}</span></>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="btn-view" style={{ borderColor: 'transparent', color: 'var(--text-muted)' }} onClick={() => { setSelectedRecord(r); setShowDetailModal(true); }}>
                <i className="fas fa-eye me-1" style={{ fontSize: 10 }} /> View Record
              </button>
              <button className="btn-view" style={{ borderColor: 'var(--teal)', color: 'var(--teal)' }} onClick={() => { setRequestingAutopsy(r); }}>
                <i className="fas fa-microscope me-1" style={{ fontSize: 10 }} /> Request Autopsy
              </button>
            </div>
          </div>
          );
        })}
        {filtered.length === 0 && !isLoading && !(records.length === 0 && !search) && (
          <div className="no-results" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-faint)', fontSize: 13 }}>
            <i className="fas fa-microscope" style={{ fontSize: 28, display: 'block', marginBottom: 8, opacity: 0.3 }} />
            {records.length === 0 ? 'No morgue records loaded.' : ckOnly && !search.trim() ? 'No records contain a (CK) marker.' : 'No records match your search.'}
          </div>
        )}
        </>}
      </div>

      <div className="doc-footer" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 18px' }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
          Page {safePage} of {totalPages} ({filtered.length} filtered of {records.length} total)
          {ckOnly && <span style={{ color: 'var(--amber)' }}> · CK only</span>}
          {selectedCount > 0 && <span style={{ color: 'var(--teal)' }}> · {selectedCount} selected for batch</span>}
          {' · '}
          <span
            style={{ color: isOverdue ? 'var(--amber)' : 'var(--text-faint)' }}
            title={`Morgue records are re-imported by hand about every 48 hours, sometimes longer.\nLast import: ${formatStamp(recordsLastUpdated)}`}
          >
            {recordsLastUpdated
              ? <>
                  Updated {formatMorgueAge(recordsLastUpdated, clockTick)}{isOverdue ? ' — overdue' : ''}
                  <span style={{ opacity: 0.7 }}> (about every 48h)</span>
                </>
              : records.length > 0 ? 'Update time unavailable' : 'No records loaded'}
          </span>
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 11.5, padding: '6px 12px', whiteSpace: 'nowrap' }}
            disabled={requestingUpdate || cooldownRemainingMs > 0}
            title={
              cooldownRemainingMs > 0
                ? `A refresh was already requested ${formatMorgueAge(updateRequest?.at, clockTick)}${updateRequest?.by ? ` by ${updateRequest.by}` : ''} — the records team has been notified`
                : updateRequest?.at
                  ? `Last requested ${formatMorgueAge(updateRequest.at, clockTick)}${updateRequest.by ? ` by ${updateRequest.by}` : ''} — ask again if the records still look stale`
                  : 'Ask the records team to re-import the latest in-game morgue logs (about every 48 hours)'
            }
            onClick={handleRequestUpdate}
          >
            <i className={`fas ${cooldownRemainingMs > 0 ? 'fa-check' : 'fa-bullhorn'} me-1`} />
            {requestingUpdate ? 'Requesting…' : cooldownRemainingMs > 0 ? 'Update Requested' : 'Request Morgue Records Updates'}
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '6px 12px' }}
            disabled={safePage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
            <i className="fas fa-chevron-left me-1" /> Prev
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--mono)', padding: '0 4px' }}>
            {safePage} / {totalPages}
          </span>
          <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '6px 12px' }}
            disabled={safePage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
            Next <i className="fas fa-chevron-right ms-1" />
          </button>
          <button className="btn btn-ghost"
            title="Re-download the morgue database (this does not ask staff to re-import the in-game morgue)"
            onClick={() => { setSearch(''); setPage(1); loadRecords?.({ force: true }); }}
            style={{ fontSize: 11.5, padding: '6px 12px' }}>
            <i className="fas fa-sync" />
          </button>
        </div>
      </div>

      {showDetailModal && selectedRecord && (
        <div className="modal-overlay open" onClick={() => setShowDetailModal(false)} style={{ display: 'flex', zIndex: 1100 }}>
          <div className="modal-box morgue-record-modal" onClick={e => e.stopPropagation()} style={{
            width: 'auto', maxWidth: '96vw', height: '92vh', maxHeight: '92vh',
            display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden',
            position: 'relative', margin: '0 auto',
          }}>
            {/* No header bar — the Record Card below carries the identity. */}
            <div className="modal-close" onClick={() => setShowDetailModal(false)} aria-label="Close" title="Close"
              style={{ position: 'absolute', top: 10, right: 12, zIndex: 2 }}>✕</div>

            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
              {/* The card is the whole modal now: notice + actions live inside it. */}
              <MorgueRecordCard
                record={selectedRecord}
                actions={<>
                  <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11.5 }} onClick={() => setShowDetailModal(false)}>Close</button>
                  <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11.5 }} disabled={exportingCard} title="Save the record card image to this device" onClick={async () => {
                    // Export the designed Record Card as a PNG snapshot.
                    setExportingCard(true);
                    try {
                      await downloadMorgueRecordCard(selectedRecord);
                      showNotification?.(`Record card saved (Case #${selectedRecord?.caseId}).`, 'success');
                    } catch (err) {
                      console.warn('[MorgueBrowser] Record card export failed:', err?.message || err);
                      showNotification?.('Record card export failed.', 'error');
                    } finally {
                      setExportingCard(false);
                    }
                  }}>
                    <i className="fas fa-download me-1" /> {exportingCard ? 'Rendering…' : 'Download Record (Local)'}
                  </button>
                  <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11.5 }} disabled={uploadingCard} title="Upload the card image and copy its link" onClick={async () => {
                    // Upload the same snapshot ImgLink (same host/album as the
                    // form image uploader) and hand back the URL.
                    setUploadingCard(true);
                    try {
                      const url = await uploadMorgueRecordCard(selectedRecord);
                      try { await navigator.clipboard.writeText(url); } catch { /* clipboard best-effort */ }
                      showNotification?.(`Record card uploaded — link copied: ${url}`, 'success');
                    } catch (err) {
                      console.warn('[MorgueBrowser] Record card upload failed:', err?.message || err);
                      showNotification?.(`Record card upload failed: ${err?.message || 'unknown error'}`, 'error');
                    } finally {
                      setUploadingCard(false);
                    }
                  }}>
                    <i className="fas fa-link me-1" /> {uploadingCard ? 'Uploading…' : 'Download Record (URL)'}
                  </button>
                  <button className="btn btn-ghost" style={{ padding: '5px 16px', fontSize: 11.5, color: 'var(--teal)', borderColor: 'var(--teal)' }} onClick={() => {
                    setRequestingAutopsy(selectedRecord);
                    setShowDetailModal(false);
                  }}>
                    <i className="fas fa-microscope me-1" /> Request Autopsy
                  </button>
                  <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11.5 }} onClick={() => stepRecord(-1)} title="Previous record in the list">
                    <i className="fas fa-chevron-left me-1" /> Prev
                  </button>
                  <button className="btn btn-primary" style={{ padding: '5px 16px', fontSize: 11.5, fontWeight: 700, background: 'var(--teal)', borderColor: 'var(--teal)', color: '#062a26' }} onClick={() => stepRecord(1)} title="Next record in the list">
                    Next <i className="fas fa-chevron-right ms-1" />
                  </button>
                </>}
              />
              <div style={{ height: 10 }} />
            </div>
          </div>
        </div>
      )}
      </>)}
      {showBodyMap && (
        <MorgueBodyMapModal
          show={showBodyMap}
          onClose={() => setShowBodyMap(false)}
          records={records}
          isLoading={isLoading}
          accessLevel={accessLevel}
        />
      )}
      {requestingAutopsy && (
        <RequestAutopsyModal
          show={!!requestingAutopsy}
          record={requestingAutopsy}
          onClose={() => setRequestingAutopsy(null)}
          showNotification={showNotification}
          characterName={characterName}
          user={user}
        />
      )}
      {showMassModal && (
        <MassRequestAutopsyModal
          show={showMassModal}
          records={selectedRecords}
          onClose={() => setShowMassModal(false)}
          onSubmitted={() => clearSelection()}
          showNotification={showNotification}
          characterName={characterName}
          user={user}
        />
      )}
    </div>
  );
};

export default MorgueBrowser;
