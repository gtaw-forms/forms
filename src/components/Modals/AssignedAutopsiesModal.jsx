import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { database } from '../../firebase';
import { ref, onValue } from 'firebase/database';
import { triggerGetMorgueRecords } from '../../services/firebaseFunctions';

const AssignedAutopsiesModal = ({ show, onClose, onLoadCase }) => {
    const [assignments, setAssignments] = useState([]);
    const [loadingCase, setLoadingCase] = useState(null);
    const [morgueErrors, setMorgueErrors] = useState(new Set());

    useEffect(() => {
        if (!show) return;

        const isLocalHost = window.location.hostname === 'localhost';

        if (isLocalHost) {
            // ── DEV MODE: Mock autopsies for local testing ──
            const mockData = [
                {
                    id: 'dev-mock-01',
                    name: 'Marcus Johnson',
                    oocName: 'DevTest_Player',
                    faction: 'LSPD',
                    assignedTo: 'Dr. Alyson Frost',
                    topicUrl: null,
                    caseUrl: null,
                    detectedAt: new Date(Date.now() - 60000).toISOString(),
                    parsed: {
                        requesterName: 'Sgt. Riley',
                        placeOfDeath: 'Davis Avenue',
                        deathType: 'PK',
                        dateOfDeath: '10/JUL/2026',
                        timeOfDeath: '22:45',
                    },
                },
                {
                    id: 'dev-mock-02',
                    name: 'Sarah Chen',
                    oocName: 'AnotherDev',
                    faction: 'LSSD',
                    assignedTo: 'Dr. Marcus Reed',
                    topicUrl: 'https://forum.gta.world/index.php?/topic/99999-mock/',
                    caseUrl: 'https://forum.gta.world/index.php?/topic/100000-mock-case/',
                    detectedAt: new Date(Date.now() - 120000).toISOString(),
                    parsed: {
                        requesterName: 'Deputy Williams',
                        placeOfDeath: 'Paleto Bay',
                        deathType: 'CK',
                        dateOfDeath: '09/JUL/2026',
                        timeOfDeath: '03:15',
                    },
                },
                {
                    id: 'dev-mock-03',
                    name: 'James Smith',
                    oocName: 'ThirdTester',
                    faction: 'SADCR',
                    assignedTo: 'Dr. Emily Hart',
                    topicUrl: 'https://forum.gta.world/index.php?/topic/100001-mock-request/',
                    caseUrl: null,
                    detectedAt: new Date(Date.now() - 180000).toISOString(),
                    parsed: {
                        requesterName: 'CO Martinez',
                        placeOfDeath: 'Bolingbroke Penitentiary',
                        deathType: 'PK',
                        dateOfDeath: '08/JUL/2026',
                        timeOfDeath: '14:30',
                    },
                },
                {
                    id: 'dev-mock-04',
                    name: 'Elena Rodriguez',
                    oocName: 'FourthTester',
                    faction: 'LSPD',
                    assignedTo: 'Dr. Alyson Frost',
                    topicUrl: null,
                    caseUrl: null,
                    detectedAt: new Date(Date.now() - 3600000).toISOString(),
                    parsed: {
                        requesterName: 'Officer Blake',
                        placeOfDeath: 'Rockford Hills',
                        deathType: 'PK',
                        dateOfDeath: '07/JUL/2026',
                        timeOfDeath: '19:50',
                    },
                },
                {
                    id: 'dev-mock-05',
                    name: 'Test Non-Morgue',
                    oocName: 'NoMatchUser',
                    faction: 'DAO',
                    assignedTo: 'Dr. Sarah Mitchell',
                    topicUrl: null,
                    caseUrl: null,
                    detectedAt: new Date().toISOString(),
                    parsed: {
                        requesterName: 'Agent Cross',
                        placeOfDeath: 'Sandy Shores',
                        deathType: 'PK',
                        dateOfDeath: '11/JUL/2026',
                        timeOfDeath: '08:00',
                    },
                },
            ];
            console.log('[AssignedModal] DEV MODE — loaded ' + mockData.length + ' mock autopsies');
            setAssignments(mockData);
            return;
        }

        // ── PRODUCTION: Read from Firebase ──
        const r = ref(database, 'autopsy-requested');
        const unsub = onValue(r, (snap) => {
            const data = snap.val();
            const list = [];
            if (data) {
                Object.entries(data)
                    .filter(([, v]) => v.assignedTo && v.wasMatch && !v.completedAt)
                    .map(([k, v]) => ({
                        id: k, name: v.name || '?', oocName: v.oocName || '',
                        faction: v.faction || '', assignedTo: v.assignedTo,
                        topicUrl: v.topicUrl || '', caseUrl: v.caseUrl || '',
                        detectedAt: v.detectedAt || '',
                        parsed: v.parsed || null,
                    }))
                    .sort((a, b) => (b.detectedAt || '').localeCompare(a.detectedAt || ''))
                    .forEach(e => list.push(e));
            }
            setAssignments(list);
        });
        return () => unsub();
    }, [show]);

    const isLocalHost = window.location.hostname === 'localhost';

    // Parse "HH:MM" to total minutes for time proximity scoring
    const parseTimeToMinutes = (t) => {
        if (!t) return null;
        const m = t.match(/^(\d{1,2}):(\d{2})/);
        return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
    };

    // Mock morgue records for localhost testing
    const mockMorgueRecords = [
        { caseId: 'MOCK-2026-001', name: 'Marcus Johnson', causeOfDeath: 'Gunshot wound to the chest', location: 'Davis Avenue', timeOfDeath: '10/JUL/2026 22:45' },
        { caseId: 'MOCK-2026-002', name: 'Sarah Chen', causeOfDeath: 'Blunt force trauma', location: 'Paleto Bay', timeOfDeath: '09/JUL/2026 03:15' },
        { caseId: 'MOCK-2026-003', name: 'James Smith', causeOfDeath: 'Asphyxiation', location: 'Bolingbroke Penitentiary', timeOfDeath: '08/JUL/2026 14:30' },
        { caseId: 'MOCK-2026-004', name: 'Elena Rodriguez', causeOfDeath: 'Stab wound', location: 'Rockford Hills', timeOfDeath: '07/JUL/2026 19:50' },
    ];

    const handleLoad = async (entry) => {
        setLoadingCase(entry.id);
        // Clear any previous error for this entry
        setMorgueErrors(prev => { const n = new Set(prev); n.delete(entry.id); return n; });
        try {
            const result = isLocalHost
                ? { records: mockMorgueRecords }
                : await triggerGetMorgueRecords();
            const records = result?.records || [];
            const terms = [entry.oocName.toLowerCase(), entry.name.toLowerCase()].filter(Boolean);
            let bestMatch = null;
            let bestScore = 0;
            const p = entry?.parsed || {};
            const parsedLoc = (p.placeOfDeath || '').toLowerCase();
            const parsedDate = (p.dateOfDeath || '').toLowerCase();

            const debugMatches = [];
            for (const rec of records) {
                const rn = (rec.name || '').toLowerCase();
                for (const t of terms) {
                    if (!t) continue;
                    let s = 0;
                    if (rn === t) { s = 999; }
                    else if (rn.includes(t)) { s = Math.max(rn.length, 60); }
                    else if (t.includes(rn)) { s = Math.max(t.length, 60); }
                    else continue;

                    const cause = (rec.causeOfDeath || '').toLowerCase();
                    const loc = (rec.location || '').toLowerCase();
                    if (cause.includes('death reason missing') || (cause.includes('missing') && cause.includes('ck'))) s -= 200;
                    if (loc.includes('location unknown') || loc === 'unknown') s -= 100;
                    if (parsedLoc) {
                        // Exact location substring match (parsed location is a street address)
                        if (loc.includes(parsedLoc.slice(0, 10)) || (parsedLoc.split(',')[0].trim() && loc.includes(parsedLoc.split(',')[0].trim().toLowerCase()))) s += 50;
                        // Reverse match: check if stored location terms appear in parsed location
                        else {
                            const parsedTerms = parsedLoc.split(/[,;\s]+/).filter(Boolean);
                            const locTerms = loc.split(/[,;\s-]+/).filter(t => t.length > 3); // skip short words
                            const overlap = locTerms.some(lt => parsedTerms.includes(lt));
                            if (overlap) s += 50;
                        }
                    }
                    // Date + time proximity scoring
                    if (parsedDate) {
                        const dm = parsedDate.match(/(\d{1,2})\/([a-z]+)\/(\d{4})/i);
                        if (dm) {
                            const day = dm[1].padStart(2, '0');
                            const year = dm[3];
                            const mAbbr = dm[2].toLowerCase().substring(0, 3);
                            const rt = (rec.timeOfDeath || '').toLowerCase();
                            // Same day/month/year = strong base match
                            if (rt.includes(day) && rt.includes(year) && rt.includes(mAbbr)) {
                                s += 300;
                                // Time proximity bonus: prefer records where time of day is close
                                const parsedTime = (p.timeOfDeath || '').trim();
                                if (parsedTime && rt.includes(' ')) {
                                    const recTimePart = rt.split(' ')[1] || ''; // "22:45" from "10/JUL/2026 22:45"
                                    const parsedMins = parseTimeToMinutes(parsedTime);
                                    const recMins = parseTimeToMinutes(recTimePart);
                                    if (parsedMins !== null && recMins !== null) {
                                        const diff = Math.abs(parsedMins - recMins);
                                        if (diff <= 15) s += 200;      // Within 15 min = very likely match
                                        else if (diff <= 60) s += 100;  // Within 1 hour
                                        else if (diff <= 180) s += 50;  // Within 3 hours
                                    }
                                }
                            }
                        }
                    }

                    debugMatches.push({ caseId: rec.caseId, name: rec.name, term: t, score: s, location: rec.location });
                    if (s > bestScore) { bestScore = s; bestMatch = rec; }
                }
            }
            console.log('[AssignedModal] Match scores for', terms, 'parsedDate=' + parsedDate + ' parsedLoc=' + parsedLoc + ':', JSON.stringify(debugMatches.sort((a,b) => b.score - a.score).slice(0,5)));
            console.log('[AssignedModal] Best: case #' + (bestMatch?.caseId || 'none') + ' score=' + bestScore);
            if (bestMatch && bestScore >= 50) {
                setMorgueErrors(prev => { const n = new Set(prev); n.delete(entry.id); return n; });
                onLoadCase(bestMatch, entry);
                onClose();
            } else {
                setMorgueErrors(prev => new Set(prev).add(entry.id));
            }
        } catch (err) {
            console.error('[AssignedModal] Error loading morgue records:', err);
            setMorgueErrors(prev => new Set(prev).add(entry.id));
        } finally { setLoadingCase(null); }
    };

    if (!show) return null;

    return createPortal(
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        }}>
            <div style={{
                background: '#1a1d2e', border: '1px solid #2d3154', borderRadius: 16,
                width: 540, maxWidth: '95vw', maxHeight: '80vh',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
                    <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#e2e8f0' }}>
                        <i className="fas fa-clipboard-list me-2" style={{ color: '#6366f1' }}></i>
                        Assigned Autopsies
                    </h2>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', color: '#64748b', fontSize: '1.3rem',
                        cursor: 'pointer', padding: '4px 8px', borderRadius: 6, lineHeight: 1,
                    }}><i className="fas fa-times"></i></button>
                </div>
                <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
                    {assignments.length === 0 ? (
                        <p style={{ color: '#64748b', textAlign: 'center', padding: '24px' }}>
                            <i className="fas fa-check-circle me-2" style={{ color: '#28a745' }}></i>
                            No pending assigned autopsies
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {assignments.map((a) => (
                                <div key={a.id} style={{
                                    background: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: '14px 16px',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <strong style={{ color: '#e2e8f0', fontSize: '0.95rem' }}>{a.name}</strong>
                                        <span style={{
                                            background: '#6366f1', color: '#fff', padding: '2px 10px', borderRadius: 10,
                                            fontSize: '0.75rem', fontWeight: 600,
                                        }}>{a.assignedTo}</span>
                                    </div>
                                    {a.oocName && (
                                        <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: 8 }}>
                                            (( {a.oocName} )) {a.faction ? `[${a.faction}]` : ''}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        {a.topicUrl && (
                                            <a href={a.topicUrl} target="_blank" rel="noopener noreferrer"
                                               style={{ color: '#60a5fa', fontSize: '0.8rem', textDecoration: 'none' }}>
                                                <i className="fas fa-file-alt me-1"></i>Request
                                            </a>
                                        )}
                                        {a.caseUrl && (
                                            <a href={a.caseUrl} target="_blank" rel="noopener noreferrer"
                                               style={{ color: '#34d399', fontSize: '0.8rem', textDecoration: 'none' }}>
                                                <i className="fas fa-folder me-1"></i>Case File
                                            </a>
                                        )}
                                        {morgueErrors.has(a.id) ? (
                                            <div style={{ marginLeft: 'auto', color: '#f87171', fontSize: '0.75rem', textAlign: 'right', maxWidth: 200 }}>
                                                <i className="fas fa-exclamation-triangle me-1"></i>This body isn't in the morgue yet — Notify Alyson Frost.
                                            </div>
                                        ) : (
                                            <button onClick={() => handleLoad(a)} disabled={loadingCase === a.id}
                                                style={{
                                                    marginLeft: 'auto', background: loadingCase === a.id ? '#334155' : '#6366f1',
                                                    color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px',
                                                    fontSize: '0.8rem', fontWeight: 600, cursor: loadingCase === a.id ? 'wait' : 'pointer',
                                                }}>
                                                {loadingCase === a.id ? 'Loading...' : <><i className="fas fa-file-import me-1"></i>Load Case</>}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div style={{ padding: '14px 24px 20px', textAlign: 'right', borderTop: '1px solid #2d3154' }}>
                    <button onClick={onClose} style={{
                        padding: '8px 20px', borderRadius: 8, border: '1px solid #3d4166',
                        background: 'transparent', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer',
                    }}>Close</button>
                </div>
            </div>
        </div>,
        document.getElementById('modal-root') || document.body
    );
};

export default AssignedAutopsiesModal;
