import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { generateMorgueBBCode } from '../../utils/morgue';
import { triggerWebhookProxy } from '../../services/firebaseFunctions';
import { ref, onValue } from 'firebase/database';
import { database } from '../../firebase';

const PAGE_SIZE = 50;
const IS_LOCALHOST = window.location.hostname === 'localhost';

const MorgueBrowser = ({ records, isLoading, loadRecords, showNotification, isAuthenticated, characterName, user }) => {
  const [search, setSearch] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [page, setPage] = useState(1);

  const canAccess = IS_LOCALHOST || isAuthenticated;

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

  // Don't load records if user isn't authenticated (bypass on localhost)
  useEffect(() => {
    if (!canAccess) return;
    if (!isLoading && records.length === 0 && loadRecords) loadRecords();
  }, [canAccess]);

  const logMorgueAction = useCallback((action, detail) => {
    try {
      triggerWebhookProxy('admin', {
        embeds: [{
          title: `Morgue — ${action}`,
          color: 0x3498db,
          fields: [
            { name: 'User', value: characterName || user?.username || 'Unknown', inline: true },
            { name: 'Detail', value: detail || '—', inline: false },
            { name: 'UA', value: navigator.userAgent?.substring(0, 80) || 'Unknown', inline: false },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: 'Morgue Audit Log' },
        }],
      }).catch(() => {});
    } catch { /* silent */ }
  }, [characterName, user]);

  const requestMorgueUpdate = useCallback(() => {
    const who = characterName || user?.username || 'Unknown';
    try {
      triggerWebhookProxy('admin', {
        content: `<@228306972204597248> **Morgue Record Update Requested** — ${who}`,
        embeds: [{
          title: 'Morgue Record Update Requested',
          color: 0xf1c40f,
          description: `**${who}** has requested a morgue record update.`,
          fields: [
            { name: 'User (OAuth)', value: who, inline: true },
            { name: 'Requested At', value: new Date().toISOString(), inline: true },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: 'Morgue — Update Request' },
        }],
      }).catch(() => {});
    } catch { /* silent */ }
  }, [characterName, user]);

  // Log the initial load/search
  useEffect(() => {
    if (records.length > 0 && canAccess) {
      logMorgueAction('Accessed', `${records.length} records loaded`);
    }
  }, [records.length, canAccess]);

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

  // Debounced search logging (fires after `filtered` is computed so the entry count is accurate)
  const searchLogTimer = useRef(null);
  useEffect(() => {
    if (!search.trim() || !canAccess) return;
    clearTimeout(searchLogTimer.current);
    searchLogTimer.current = setTimeout(() => {
      const n = filtered.length;
      logMorgueAction('Search', `"${search.trim()}" — ${n} entr${n === 1 ? 'y' : 'ies'} found`);
    }, 2000);
    return () => clearTimeout(searchLogTimer.current);
  }, [search, canAccess, filtered.length]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);


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
          <span>Case ID</span>
          <span>Decedent</span>
          <span>Intake Date</span>
          <span style={{ textAlign: 'center' }}>Action</span>
        </div>
        {paginated.map(r => (
          <div key={r.caseId || r.firebaseKey} className="record-row">
            <div className="case-id">#{r.caseId}</div>
            <div className="decedent">
              {r.name || 'Unknown'}
              <div className="sub">{r.location || '—'}</div>
            </div>
            <div className="date">{r.timeOfDeath ? r.timeOfDeath.split(' ').slice(0, 4).join(' ') : '—'}</div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button className="btn-view" onClick={() => { setSelectedRecord(r); setShowDetailModal(true); logMorgueAction('View Record', `#${r.caseId} — ${r.name || 'Unknown'}`); }}>
                <i className="fas fa-eye me-1" style={{ fontSize: 10 }} /> View Record
              </button>
            </div>
          </div>
        ))}
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
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '6px 12px' }}
            disabled={safePage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
            <i className="fas fa-chevron-left me-1" /> Prev
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 11.5, padding: '6px 12px' }}
            onClick={() => {
              requestMorgueUpdate();
              showNotification?.('Update request sent to the bot developer!', 'success');
            }}>
            <i className="fas fa-bullhorn me-1" /> Request Update
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
        <div className="modal-overlay open" onClick={() => setShowDetailModal(false)} style={{ display: 'flex' }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <div className="modal-head">
              <h3><i className="fas fa-microscope" style={{ color: 'var(--teal)' }} /> Morgue Intake Record</h3>
              <div className="modal-close" onClick={() => setShowDetailModal(false)}>✕</div>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflow: 'auto' }}>
              <div className="finding-header">
                <div className="finding-eyebrow">Case #{selectedRecord.caseId}</div>
                <h2 className="finding-title">Morgue Intake Records for {selectedRecord.name || 'Unknown'}</h2>
              </div>

              <div className="notice-bubble notice-warn">
                <span>⚠️</span>
                <span>NOTICE: Law Enforcement MAY use the PHMC Morgue Intake Records for PKs as proof of death for court cases. CKs will require a formal autopsy process which can be requested on the PHMC Forums.</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Left column — Discovery Details */}
                <div className="finding-section" style={{ marginBottom: 0 }}>
                  <div className="finding-section-title">Discovery Details</div>
                  <div className="finding-kv"><span>Case ID</span><span className="mono">#{selectedRecord.caseId}</span></div>
                  {selectedRecord.estimatedAge && <div className="finding-kv"><span>Age</span><span>{selectedRecord.estimatedAge}</span></div>}
                  {selectedRecord.sex && <div className="finding-kv"><span>Sex</span><span>{selectedRecord.sex}</span></div>}
                  {selectedRecord.timeOfDeath && <div className="finding-kv"><span>Time of Death</span><span>{selectedRecord.timeOfDeath}</span></div>}
                  {selectedRecord.location && <div className="finding-kv"><span>Location of Discovery</span><span>{selectedRecord.location}</span></div>}
                  {selectedRecord.causeOfDeath && <div className="finding-kv"><span>Cause of Death</span><span>{selectedRecord.causeOfDeath}</span></div>}
                  {selectedRecord.dnaProfile && <div className="finding-kv"><span>DNA Profile</span><span className="mono">{selectedRecord.dnaProfile}</span></div>}
                </div>

                {/* Right column — Physical Description */}
                {selectedRecord.physicalDescription && (
                  <div className="finding-section" style={{ marginBottom: 0 }}>
                    <div className="finding-section-title">Physical Description</div>
                    <div className="finding-value" style={{ fontSize: 12, maxHeight: 200, overflow: 'auto' }}>{selectedRecord.physicalDescription}</div>
                  </div>
                )}
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0 16px' }} />
              <div className="notice-bubble notice-ooc" style={{ marginBottom: 16 }}>
                <span>🔒</span>
                <span>OOC Information — The data below is strictly Out of Character. Any use of this information In Character requires a formal autopsy request.</span>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0 0 16px' }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Left — Forensic Collection */}
                <div className="finding-section" style={{ marginBottom: 0 }}>
                  <div className="finding-section-title">Forensic Collection &amp; Toxicology</div>
                  <div className="finding-kv"><span>Alcohol / Narcotics Screen</span><span>BAC: {selectedRecord.bac || '0.00%'} | Narcotics: {selectedRecord.narcotics || 'N/A'}</span></div>
                </div>

                {/* Right — Casings (REDACTED — casing IDs are OOC-sensitive) */}
                {(() => {
                  const bArr = Array.isArray(selectedRecord.bullets) ? selectedRecord.bullets : [];
                  return bArr.length > 0 && (
                    <div className="finding-section" style={{ marginBottom: 0 }}>
                      <div className="finding-section-title">Recovered Projectiles / Casings</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {bArr.map((b, i) => (
                          <span key={i} className="mono redacted-text">REDACTED STRIATION - REDACTED {(b.type || '').toLowerCase().includes('gauge') ? 'PELLET' : 'BULLET'} TYPE</span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {selectedRecord.findings?.length > 0 && (
                <div className="finding-section" style={{ marginTop: 20 }}>
                  <div className="finding-section-title">Autopsy Findings</div>
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
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setShowDetailModal(false)}>Close</button>
              <button className="btn btn-primary" onClick={() => {
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

            </div>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
};

export default MorgueBrowser;
