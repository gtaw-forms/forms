import React, { useState, useMemo, useEffect, useRef } from 'react';
import { generateMorgueBBCode } from '../../utils/morgue';
import { ref, onValue } from 'firebase/database';
import { database } from '../../firebase';
import RequestAutopsyModal from './RequestAutopsyModal';
import MassRequestAutopsyModal from './MassRequestAutopsyModal';
import MorgueBodyMapModal from './MorgueBodyMapModal';

const PAGE_SIZE = 50;
const IS_LOCALHOST = window.location.hostname === 'localhost';

// Stable selection identity — firebaseKey is the record key; caseId is the
// human-facing fallback so a cached record without firebaseKey still selects.
const recordKey = (r) => String(r?.firebaseKey || r?.caseId || r?.name || '');

const MorgueBrowser = ({ records, isLoading, loadRecords, showNotification, isAuthenticated, characterName, user, accessLevel }) => {
  const [search, setSearch] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [requestingAutopsy, setRequestingAutopsy] = useState(null);
  const [showMassModal, setShowMassModal] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [showBodyMap, setShowBodyMap] = useState(false);
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
  useEffect(() => { setPage(1); }, [search]);

  const filtered = useMemo(() => {
    let list = records;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r => (r.name || '').toLowerCase().includes(q) || String(r.caseId || '').includes(q));
    }
    return [...list].sort((a, b) => String(b.caseId || '').localeCompare(String(a.caseId || ''), undefined, { numeric: true }));
  }, [records, search]);

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
      <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)' }}>
        <div className="lookup-bar">
          <input type="text" placeholder="Search by decedent name or case ID…" value={search}
            onChange={e => setSearch(e.target.value)} />
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
          <i className="fas fa-circle-info" />
          <span>Tick bodies to request several autopsies in one case thread. Shift-click selects a range.</span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 22px', position: 'relative' }}>
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
            <button className="btn btn-ghost" onClick={() => loadRecords?.()} style={{ fontSize: 12 }}>
              <i className="fas fa-sync me-1" /> Load Records
            </button>
          </div>
        )}
        {!isLoading && <><div className="records-head-row">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allPageSelected}
            onChange={toggleSelectAllPage}
            title="Select every body on this page"
            aria-label="Select every body on this page"
          />
          <span>Case ID</span>
          <span>Decedent</span>
          <span>Intake Date</span>
          <span style={{ textAlign: 'center' }}>Action</span>
        </div>
        {paginated.map((r, index) => {
          const isSelected = selectedKeys.has(recordKey(r));
          return (
          <div key={r.firebaseKey || r.caseId} className={`record-row${isSelected ? ' selected' : ''}`}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={toggleSelect(r, index)}
              onClick={e => e.stopPropagation()}
              title="Add this body to a batch autopsy request (shift-click for a range)"
              aria-label={`Select ${r.name || 'record'} (case ${r.caseId || 'unknown'})`}
            />
            <div className="case-id">#{r.caseId}</div>
            <div className="decedent">
              {r.name || 'Unknown'}
              <div className="sub">{r.location || '—'}</div>
            </div>
            <div className="date">{r.timeOfDeath ? r.timeOfDeath.split(' ').slice(0, 5).join(' ') : '—'}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
              <button className="btn-view" onClick={() => { setSelectedRecord(r); setShowDetailModal(true); }}>
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
            {records.length === 0 ? 'No morgue records loaded.' : 'No records match your search.'}
          </div>
        )}
        </>}
      </div>

      <div className="doc-footer" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
          Page {safePage} of {totalPages} ({filtered.length} filtered of {records.length} total)
          {selectedCount > 0 && <span style={{ color: 'var(--teal)' }}> · {selectedCount} selected for batch</span>}
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
          <button className="btn btn-ghost" onClick={() => { setSearch(''); setPage(1); loadRecords?.(); }} style={{ fontSize: 11.5, padding: '6px 12px' }}>
            <i className="fas fa-sync" />
          </button>
        </div>
      </div>

      {showDetailModal && selectedRecord && (
        <div className="modal-overlay open" onClick={() => setShowDetailModal(false)} style={{ display: 'flex', zIndex: 1100 }}>
          <div className="modal-box morgue-record-modal" onClick={e => e.stopPropagation()} style={{
            maxWidth: '96vw', width: '96vw', height: '92vh', maxHeight: '92vh',
            display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden',
          }}>
            <div className="modal-head" style={{ flexShrink: 0 }}>
              <h3 style={{ minWidth: 0 }}>
                <i className="fas fa-microscope" style={{ color: 'var(--teal)' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedRecord.name || 'Unknown'}</span>
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <span className="finding-eyebrow" style={{ margin: 0 }}>Case #{selectedRecord.caseId}</span>
                <div className="modal-close" onClick={() => setShowDetailModal(false)} aria-label="Close">✕</div>
              </div>
            </div>

            <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
              <div className="notice-bubble notice-warn">
                <i className="fas fa-exclamation-triangle" style={{ marginTop: 2, flexShrink: 0 }} />
                <span>NOTICE: Law Enforcement MAY use the PHMC Morgue Intake Records for PKs as proof of death for court cases. CKs will require a formal autopsy process which can be requested on the PHMC Forums.</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
                {/* Identity & Discovery */}
                <div className="finding-section" style={{ marginBottom: 0 }}>
                  <div className="finding-section-title">Identity &amp; Discovery</div>
                  <div className="finding-kv"><span>Case ID</span><span className="mono">#{selectedRecord.caseId}</span></div>
                  <div className="finding-kv"><span>Name</span><span>{selectedRecord.name || 'Unknown'}</span></div>
                  <div className="finding-kv"><span>Sex</span><span>{selectedRecord.sex || 'Unknown'}</span></div>
                  <div className="finding-kv"><span>Identified</span><span>{selectedRecord.identified || 'Unknown'}</span></div>
                  <div className="finding-kv"><span>Estimated Age</span><span>{selectedRecord.estimatedAge || 'Unknown'}</span></div>
                  <div className="finding-kv"><span>Location of Discovery</span><span>{selectedRecord.location || '—'}</span></div>
                  <div className="finding-kv"><span>Time of Death</span><span>{selectedRecord.timeOfDeath || '—'}</span></div>
                  {selectedRecord.timeOfDeathISO && (
                    <div className="finding-kv"><span>Time of Death (ISO)</span><span className="mono">{selectedRecord.timeOfDeathISO}</span></div>
                  )}
                  <div className="finding-kv"><span>Cause of Death</span><span>{selectedRecord.causeOfDeath || '—'}</span></div>
                  <div className="finding-kv"><span>DNA Profile</span><span className="mono">{selectedRecord.dnaProfile || 'N/A'}</span></div>
                </div>

                {/* Physical Description */}
                <div className="finding-section" style={{ marginBottom: 0 }}>
                  <div className="finding-section-title">Physical Description</div>
                  <div className="finding-value" style={{ whiteSpace: 'pre-wrap' }}>
                    {selectedRecord.physicalDescription || 'No physical description on file.'}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div className="finding-kv"><span>Tattoos / Marks</span><span>{selectedRecord.tattoos || 'None'}</span></div>
                    <div className="finding-kv"><span>Estimated Age</span><span>{selectedRecord.estimatedAge || 'Unknown'}</span></div>
                  </div>
                </div>

                {/* Forensic Collection & Toxicology */}
                <div className="finding-section" style={{ marginBottom: 0 }}>
                  <div className="finding-section-title">Forensic Collection &amp; Toxicology</div>
                  <div className="finding-kv"><span>Blood Alcohol Concentration</span><span>{selectedRecord.bac || '0.00%'}</span></div>
                  <div className="finding-kv"><span>Traces of Narcotics</span><span>{selectedRecord.narcotics || 'None'}</span></div>
                </div>

                {/* Recovered Projectiles / Casings (REDACTED — casing IDs are OOC-sensitive) */}
                <div className="finding-section" style={{ marginBottom: 0 }}>
                  <div className="finding-section-title">Recovered Projectiles / Casings</div>
                  {(() => {
                    const bArr = Array.isArray(selectedRecord.bullets) ? selectedRecord.bullets : [];
                    return bArr.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {bArr.map((b, i) => (
                          <span key={i} className="mono redacted-text">REDACTED STRIATION - REDACTED {(b.type || '').toLowerCase().includes('gauge') ? 'PELLET' : 'BULLET'} TYPE</span>
                        ))}
                      </div>
                    ) : (
                      <div className="finding-value" style={{ color: 'var(--text-faint)' }}>No projectiles or casings recovered.</div>
                    );
                  })()}
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0 16px' }} />
              <div className="notice-bubble notice-ooc" style={{ marginBottom: 16 }}>
                <i className="fas fa-lock" style={{ marginTop: 2, flexShrink: 0 }} />
                <span>OOC Information — The data below is strictly Out of Character. Any use of this information In Character requires a formal autopsy request.</span>
              </div>

              <div className="finding-section" style={{ marginBottom: 0 }}>
                <div className="finding-section-title">Autopsy Findings</div>
                {selectedRecord.findings?.length > 0 ? (
                  <div className="autopsy-table">
                    <div className="autopsy-row autopsy-head"><span>Time</span><span>Wound Type</span><span>Body Part</span><span>Dist.</span></div>
                    {selectedRecord.findings.map((f, i) => (
                      <div key={i} className="autopsy-row">
                        <span className="mono">{f.time || '—'}</span>
                        <span>{f.type || '—'}</span>
                        <span>{f.part && f.part !== '-' ? f.part : '—'}</span>
                        <span className="mono">{f.dist && f.dist !== '-' ? f.dist : '—'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="finding-value" style={{ color: 'var(--text-faint)' }}>No autopsy findings recorded.</div>
                )}
              </div>

              {selectedRecord.lastUpdated && (
                <div style={{ marginTop: 18, fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--text-faint)' }}>
                  Record last updated {new Date(selectedRecord.lastUpdated).toLocaleString()}
                </div>
              )}
            </div>

            <div className="modal-foot" style={{ flexShrink: 0, padding: '7px 14px', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11.5 }} onClick={() => setShowDetailModal(false)}>Close</button>
              <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11.5 }} onClick={() => {
                // Copy the OOC-safe REDACTED BBCode — casing IDs/types hidden
                // (tox screen + autopsy findings stay full).
                const bbcode = generateMorgueBBCode(selectedRecord, { redacted: true });
                if (bbcode) {
                  navigator.clipboard.writeText(bbcode);
                  showNotification?.('Redacted BBCode copied!', 'success');
                }
              }}>
                <i className="fas fa-file-export me-1" /> Copy BBCode
              </button>
              <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 11.5 }} onClick={() => {
                setRequestingAutopsy(selectedRecord);
                setShowDetailModal(false);
              }}>
                <i className="fas fa-microscope me-1" /> Request Autopsy
              </button>
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
