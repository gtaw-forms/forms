import React, { useState, useEffect, useMemo } from 'react';
import { database } from '../../firebase';
import { ref, onValue, get } from 'firebase/database';
import { triggerGetMorgueRecords } from '../../services/firebaseFunctions';

const MOCK_ROTATION_LIST = ['Dr. Alyson Frost', 'Dr. Marcus Reed', 'Dr. Emily Hart', 'Dr. Sarah Mitchell', 'Dr. James Walker'];

// Parse a case topic title into { name, oocName }.
// Format: "Case 485 - John Doe ((Marvion Futrell)) [LSPD] - Anne Carter"
const parseCaseTitle = (title) => {
    let rest = String(title || '');
    rest = rest.replace(/^Case\s+\d+\s*-\s*/i, '');
    rest = rest.replace(/\s*-\s*[^-]*$/, '');
    const oocMatch = rest.match(/\(\(\s*([^()]*)\s*\)\)/);
    const oocName = oocMatch ? oocMatch[1].trim() : '';
    const name = rest.replace(/\(\([^()]*\)\)/g, '').replace(/\[(?:LSPD|LSSD|SADCR|DAO)\]/i, '').trim();
    return { name, oocName };
};

const AssignedAutopsiesModal = ({ show, onClose, onLoadCase, factionsData }) => {
    const [assignments, setAssignments] = useState([]);
    const [rotationList, setRotationList] = useState([]);
    const [rotationPosition, setRotationPosition] = useState(0);
    const [loadingCase, setLoadingCase] = useState(null);
    const [morgueErrors, setMorgueErrors] = useState(new Set());

    useEffect(() => {
        if (!show) return;

        const isLocalHost = window.location.hostname === 'localhost';

        if (isLocalHost) {
            const mockData = [
                { id: 'dev-mock-01', name: 'Marcus Johnson', oocName: 'DevTest_Player', faction: 'LSPD', assignedTo: 'Dr. Alyson Frost', topicUrl: null, caseUrl: null, detectedAt: new Date(Date.now() - 60000).toISOString(), parsed: { requesterName: 'Sgt. Riley', placeOfDeath: 'Davis Avenue', deathType: 'PK', dateOfDeath: '10/JUL/2026', timeOfDeath: '22:45' } },
                { id: 'dev-mock-02', name: 'Sarah Chen', oocName: 'AnotherDev', faction: 'LSSD', assignedTo: 'Dr. Marcus Reed', topicUrl: 'https://forum.gta.world/index.php?/topic/99999-mock/', caseUrl: 'https://forum.gta.world/index.php?/topic/100000-mock-case/', detectedAt: new Date(Date.now() - 120000).toISOString(), parsed: { requesterName: 'Deputy Williams', placeOfDeath: 'Paleto Bay', deathType: 'CK', dateOfDeath: '09/JUL/2026', timeOfDeath: '03:15' } },
                { id: 'dev-mock-03', name: 'James Smith', oocName: 'ThirdTester', faction: 'SADCR', assignedTo: 'Dr. Emily Hart', topicUrl: 'https://forum.gta.world/index.php?/topic/100001-mock-request/', caseUrl: null, detectedAt: new Date(Date.now() - 180000).toISOString(), parsed: { requesterName: 'CO Martinez', placeOfDeath: 'Bolingbroke', deathType: 'PK', dateOfDeath: '08/JUL/2026', timeOfDeath: '14:30' } },
                { id: 'dev-mock-04', name: 'Elena Rodriguez', oocName: 'FourthTester', faction: 'LSPD', assignedTo: 'Dr. Alyson Frost', topicUrl: null, caseUrl: null, detectedAt: new Date(Date.now() - 3600000).toISOString(), parsed: { requesterName: 'Officer Blake', placeOfDeath: 'Rockford Hills', deathType: 'PK', dateOfDeath: '07/JUL/2026', timeOfDeath: '19:50' } },
                { id: 'dev-mock-05', name: 'Test Non-Morgue', oocName: 'NoMatchUser', faction: 'DAO', assignedTo: 'Dr. Sarah Mitchell', topicUrl: null, caseUrl: null, detectedAt: new Date().toISOString(), parsed: { requesterName: 'Agent Cross', placeOfDeath: 'Sandy Shores', deathType: 'PK', dateOfDeath: '11/JUL/2026', timeOfDeath: '08:00' } },
            ];
            setAssignments(mockData);
            setRotationList(MOCK_ROTATION_LIST);
            setRotationPosition(2); // Dr. Emily Hart is next in mock
            return;
        }

        // Fetch the full ME rotation list + position
        Promise.all([
            get(ref(database, 'autopsy-requests/rotation/list')),
            get(ref(database, 'autopsy-requests/rotation/position')),
        ]).then(([listSnap, posSnap]) => {
            const list = listSnap.val();
            setRotationList(Array.isArray(list) ? list : []);
            setRotationPosition(typeof posSnap.val() === 'number' ? posSnap.val() : 0);
        }).catch(() => { setRotationList([]); setRotationPosition(0); });

        const r = ref(database, 'autopsy-requested');
        const unsub = onValue(r, (snap) => {
            const data = snap.val();
            const list = [];
            if (data) {
                Object.entries(data)
                    .filter(([, v]) => v.wasMatch && !v.completedAt && (v.assignedTo || (v.caseState === 'multi' && v.cases)))
                    .flatMap(([k, v]) => {
                        // Multi-decedent request (split into one case per decedent):
                        // emit ONE entry per case, each under its own assigned ME.
                        if (v.caseState === 'multi' && v.cases) {
                            const entries = [];
                            Object.entries(v.cases).forEach(([ci, c]) => {
                                if (!c.assignedTo) return;
                                const parsedTitle = parseCaseTitle(c.caseTitle || '');
                                entries.push({
                                    id: `${k}/cases/${ci}`,
                                    name: c.name || parsedTitle.name || v.name || '?',
                                    oocName: c.oocName || parsedTitle.oocName || v.oocName || '',
                                    faction: v.faction || '',
                                    assignedTo: c.assignedTo,
                                    topicUrl: v.topicUrl || '',
                                    caseUrl: c.caseUrl || v.caseUrl || '',
                                    detectedAt: v.detectedAt || '',
                                    parsed: v.parsed || null,
                                });
                            });
                            return entries;
                        }
                        if (!v.assignedTo) return [];
                        return [{
                            id: k, name: v.name || '?', oocName: v.oocName || '',
                            faction: v.faction || '', assignedTo: v.assignedTo,
                            topicUrl: v.topicUrl || '', caseUrl: v.caseUrl || '',
                            detectedAt: v.detectedAt || '',
                            parsed: v.parsed || null,
                        }];
                    })
                    .sort((a, b) => (b.detectedAt || '').localeCompare(a.detectedAt || ''))
                    .forEach(e => list.push(e));
            }
            setAssignments(list);
        });
        return () => unsub();
    }, [show]);

    // ── Group by assigned ME (includes MEs from rotation with 0 cases) ──
    const grouped = useMemo(() => {
        const map = {};
        const members = factionsData?.['364']?.members || {};

        // Helper to get rank for an ME name
        const getRank = (name) => {
            let rank = '';
            Object.values(members).forEach(m => {
                if ((m.characterName || m.name) === name) rank = m.rank || '';
            });
            return rank;
        };

        // First, seed the map with all MEs from the rotation list (even 0-case)
        rotationList.forEach(name => {
            map[name] = { rank: getRank(name), cases: [] };
        });

        // Then add assignments, creating sections for MEs not in the rotation
        assignments.forEach(a => {
            const me = a.assignedTo || 'Unassigned';
            if (!map[me]) {
                map[me] = { rank: getRank(me), cases: [] };
            }
            map[me].cases.push(a);
        });
        return map;
    }, [assignments, factionsData, rotationList]);

    // ── Helpers ──
    const isLocalHost = window.location.hostname === 'localhost';

    const parseTimeToMinutes = (t) => {
        if (!t) return null;
        const m = t.match(/^(\d{1,2}):(\d{2})/);
        return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
    };

    const mockMorgueRecords = [
        { caseId: 'MOCK-2026-001', name: 'Marcus Johnson', causeOfDeath: 'Gunshot wound to the chest', location: 'Davis Avenue', timeOfDeath: '10/JUL/2026 22:45' },
        { caseId: 'MOCK-2026-002', name: 'Sarah Chen', causeOfDeath: 'Blunt force trauma', location: 'Paleto Bay', timeOfDeath: '09/JUL/2026 03:15' },
        { caseId: 'MOCK-2026-003', name: 'James Smith', causeOfDeath: 'Asphyxiation', location: 'Bolingbroke Penitentiary', timeOfDeath: '08/JUL/2026 14:30' },
        { caseId: 'MOCK-2026-004', name: 'Elena Rodriguez', causeOfDeath: 'Stab wound', location: 'Rockford Hills', timeOfDeath: '07/JUL/2026 19:50' },
    ];

    /**
     * Typo-tolerant haystack check for morgue matching: whole term first,
     * then EVERY word must appear (or a one-swap/one-drop variant of it —
     * catches requester typos like "Autospy Test"). The existing score
     * bonuses (location/date/time) still guard against weak cross-matches.
     */
    const haystackMatchesTerm = (hay, term) => {
        if (!term) return false;
        if (hay.includes(term)) return true;
        return term.split(/\s+/).filter(w => w.length >= 3).every(w => {
            const variants = new Set([w]);
            for (let i = 0; i < w.length - 1; i++) {
                if (w[i] !== w[i + 1]) variants.add(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2));
            }
            for (let i = 0; i < w.length; i++) {
                const v = w.slice(0, i) + w.slice(i + 1);
                if (v.length >= 4) variants.add(v);
            }
            return [...variants].some(v => hay.includes(v));
        });
    };

    const handleLoad = async (entry) => {
        setLoadingCase(entry.id);
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

            for (const rec of records) {
                const rn = (rec.name || '').toLowerCase();
                for (const t of terms) {
                    if (!t) continue;
                    let s = 0;
                    if (rn === t) { s = 999; }
                    else if (rn.includes(t)) { s = Math.max(rn.length, 60); }
                    else if (t.includes(rn)) { s = Math.max(t.length, 60); }
                    else if (haystackMatchesTerm(rn, t)) { s = Math.max(rn.length, 55); }
                    else continue;

                    const cause = (rec.causeOfDeath || '').toLowerCase();
                    const loc = (rec.location || '').toLowerCase();
                    if (cause.includes('death reason missing') || (cause.includes('missing') && cause.includes('ck'))) s -= 200;
                    if (loc.includes('location unknown') || loc === 'unknown') s -= 100;
                    if (parsedLoc) {
                        if (loc.includes(parsedLoc.slice(0, 10)) || (parsedLoc.split(',')[0].trim() && loc.includes(parsedLoc.split(',')[0].trim().toLowerCase()))) s += 50;
                        else {
                            const parsedTerms = parsedLoc.split(/[,;\s]+/).filter(Boolean);
                            const locTerms = loc.split(/[,;\s-]+/).filter(t => t.length > 3);
                            const overlap = locTerms.some(lt => parsedTerms.includes(lt));
                            if (overlap) s += 50;
                        }
                    }
                    if (parsedDate) {
                        const dm = parsedDate.match(/(\d{1,2})\/([a-z]+)\/(\d{4})/i);
                        if (dm) {
                            const day = dm[1].padStart(2, '0');
                            const year = dm[3];
                            const mAbbr = dm[2].toLowerCase().substring(0, 3);
                            const rt = (rec.timeOfDeath || '').toLowerCase();
                            if (rt.includes(day) && rt.includes(year) && rt.includes(mAbbr)) {
                                s += 300;
                                const parsedTime = (p.timeOfDeath || '').trim();
                                if (parsedTime && rt.includes(' ')) {
                                    const recTimePart = rt.split(' ')[1] || '';
                                    const parsedMins = parseTimeToMinutes(parsedTime);
                                    const recMins = parseTimeToMinutes(recTimePart);
                                    if (parsedMins !== null && recMins !== null) {
                                        const diff = Math.abs(parsedMins - recMins);
                                        if (diff <= 15) s += 200;
                                        else if (diff <= 60) s += 100;
                                        else if (diff <= 180) s += 50;
                                    }
                                }
                            }
                        }
                    }
                    if (s > bestScore) { bestScore = s; bestMatch = rec; }
                }
            }
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

    const timeAgo = (detectedAt) => {
        if (!detectedAt) return '';
        const h = (Date.now() - new Date(detectedAt).getTime()) / 3600000;
        if (h < 1) return `${Math.round(h * 60)}m`;
        return `${h.toFixed(1)}h`;
    };

    const meNames = Object.keys(grouped);

    if (!show) return null;

    return (
        <div className="modal-overlay open" onClick={onClose} style={{ display: 'flex' }}>
            <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
                <div className="modal-head">
                    <h3><i className="fas fa-microscope" style={{ color: 'var(--teal)' }} /> Assigned Autopsies</h3>
                    <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
                </div>
                <div className="modal-body" style={{ maxHeight: '65vh', overflow: 'auto' }}>
                    {meNames.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px', gap: 10 }}>
                            <i className="fas fa-check-circle" style={{ fontSize: 28, color: 'var(--teal)', opacity: 0.6 }} />
                            <p style={{ color: 'var(--text-faint)', fontSize: 13, margin: 0 }}>No pending assigned autopsies</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {meNames.map(me => (
                                <div key={me}>
                                    {/* ME Section Header */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '10px 14px', marginBottom: 8,
                                        background: 'var(--bg-surface)', borderRadius: 8,
                                        borderLeft: `3px solid ${rotationList[rotationPosition] === me ? 'var(--amber)' : 'var(--teal)'}`,
                                    }}>
                                        <div style={{
                                            width: 28, height: 28, borderRadius: 6,
                                            background: rotationList[rotationPosition] === me ? 'var(--amber-dim)' : 'var(--teal-dim)',
                                            color: rotationList[rotationPosition] === me ? 'var(--amber)' : 'var(--teal)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 13, flexShrink: 0,
                                        }}>
                                            <i className="fas fa-user-md" />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{me}</span>
                                                {rotationList[rotationPosition] === me && (
                                                    <span style={{
                                                        fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8,
                                                        padding: '2px 7px', borderRadius: 4,
                                                        background: 'var(--amber-dim)', color: 'var(--amber)',
                                                        fontFamily: 'var(--mono)', textTransform: 'uppercase',
                                                    }}>
                                                        <i className="fas fa-arrow-right me-1" style={{ fontSize: 8 }} />NEXT
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--mono)', marginTop: 1 }}>
                                                {(grouped[me].rank || 'Medical Examiner').replace(/^\s*[-–—]\s*|\s*[-–—]\s*$/g, '').trim()} &middot; {grouped[me].cases.length} case{grouped[me].cases.length !== 1 ? 's' : ''}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Cases for this ME */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 8 }}>
                                        {grouped[me].cases.length === 0 ? (
                                            <div style={{
                                                padding: '10px 14px', borderRadius: 8,
                                                background: 'var(--bg-surface)', border: '1px dashed var(--border)',
                                                fontSize: 12, color: 'var(--text-faint)', textAlign: 'center',
                                                fontFamily: 'var(--mono)',
                                            }}>
                                                <i className="fas fa-check-circle me-1" style={{ color: 'var(--teal)', fontSize: 11 }} />
                                                No assigned autopsies
                                            </div>
                                        ) : grouped[me].cases.map(a => (
                                            <div key={a.id} style={{
                                                background: 'var(--bg-surface)',
                                                border: '1px solid var(--border)',
                                                borderRadius: 8, padding: '12px 14px',
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                                                            {a.name}
                                                            {a.oocName && <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 12 }}> (({a.oocName}))</span>}
                                                        </div>
                                                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 5 }}>
                                                            {a.faction && (
                                                                <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--text-faint)' }}>
                                                                    <i className="fas fa-shield-alt" style={{ marginRight: 3, fontSize: 10 }} />{a.faction}
                                                                </span>
                                                            )}
                                                            <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--text-faint)' }}>
                                                                <i className="fas fa-clock" style={{ marginRight: 3, fontSize: 10 }} />{timeAgo(a.detectedAt)}
                                                            </span>
                                                            {a.parsed?.deathType && (
                                                                <span style={{
                                                                    fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                                                                    background: a.parsed.deathType === 'CK' ? 'var(--danger-dim)' : 'var(--teal-dim)',
                                                                    color: a.parsed.deathType === 'CK' ? 'var(--danger)' : 'var(--teal)',
                                                                    fontFamily: 'var(--mono)', letterSpacing: 0.5,
                                                                }}>{a.parsed.deathType}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, marginLeft: 12 }}>
                                                        {a.topicUrl && (
                                                            <a href={a.topicUrl} target="_blank" rel="noopener noreferrer"
                                                               className="btn btn-ghost" style={{ fontSize: 10.5, padding: '5px 10px', textDecoration: 'none' }}>
                                                                <i className="fas fa-file-alt me-1" />Request
                                                            </a>
                                                        )}
                                                        {a.caseUrl && (
                                                            <a href={a.caseUrl} target="_blank" rel="noopener noreferrer"
                                                               className="btn btn-ghost" style={{ fontSize: 10.5, padding: '5px 10px', textDecoration: 'none' }}>
                                                                <i className="fas fa-folder me-1" />Case
                                                            </a>
                                                        )}
                                                        {morgueErrors.has(a.id) ? (
                                                            <div style={{ color: 'var(--danger)', fontSize: 10, textAlign: 'right', maxWidth: 180, lineHeight: 1.4 }}>
                                                                <i className="fas fa-exclamation-triangle me-1" />No morgue match — intake may not exist yet.
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => handleLoad(a)} disabled={loadingCase === a.id}
                                                                className="btn btn-primary" style={{ fontSize: 11, padding: '6px 14px', whiteSpace: 'nowrap' }}>
                                                                {loadingCase === a.id ? 'Loading...' : <><i className="fas fa-file-import me-1" />Load</>}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="modal-foot">
                    <button className="btn btn-ghost" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default AssignedAutopsiesModal;
