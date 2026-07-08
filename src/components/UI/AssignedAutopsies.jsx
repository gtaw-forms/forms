import React, { useState, useEffect } from 'react';
import { database } from '../../firebase';
import { ref, onValue } from 'firebase/database';
import { triggerGetMorgueRecords } from '../../services/firebaseFunctions';

const AssignedAutopsies = ({ showNotification, onLoadCase }) => {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingCase, setLoadingCase] = useState(null);

    useEffect(() => {
        const r = ref(database, 'autopsy-requested');
        const unsub = onValue(r, (snap) => {
            const data = snap.val();
            if (!data) { setAssignments([]); setLoading(false); return; }

            const list = Object.entries(data)
                .filter(([, v]) => v.assignedTo && v.wasMatch)
                .map(([k, v]) => ({
                    id: k,
                    name: v.name || '?',
                    oocName: v.oocName || '',
                    faction: v.faction || '',
                    assignedTo: v.assignedTo,
                    topicUrl: v.topicUrl || '',
                    caseUrl: v.caseUrl || '',
                    detectedAt: v.detectedAt || '',
                }))
                .sort((a, b) => (b.detectedAt || '').localeCompare(a.detectedAt || ''));

            setAssignments(list);
            setLoading(false);
        });

        return () => unsub();
    }, []);

    const handleLoadCase = async (entry) => {
        setLoadingCase(entry.id);
        try {
            // Fetch morgue records via Cloud Function (Firebase .read=false blocks direct SDK access)
            const result = await triggerGetMorgueRecords();
            const records = result?.records || [];
            let bestMatch = null;
            let bestScore = 0;

            const searchTerms = [
                (entry.oocName || '').toLowerCase().trim(),
                (entry.name || '').toLowerCase().trim(),
            ].filter(Boolean);

            for (const rec of records) {
                const recName = (rec.name || '').toLowerCase().trim();
                for (const term of searchTerms) {
                    if (!term) continue;
                    if (recName === term) { bestMatch = rec; bestScore = Infinity; break; }
                    if (recName.includes(term) || term.includes(recName)) {
                        const score = Math.max(
                            recName.includes(term) ? recName.length : 0,
                            term.includes(recName) ? term.length : 0
                        );
                        if (score > bestScore) { bestScore = score; bestMatch = rec; }
                    }
                }
                if (bestScore === Infinity) break;
            }

            if (bestMatch) {
                console.log('[AssignedAutopsies] Found morgue match:', bestMatch.name);
                if (onLoadCase) onLoadCase(bestMatch, entry);
            } else {
                if (showNotification) showNotification('No morgue record found for ' + (entry.oocName || entry.name), 'warning');
            }
        } catch (err) {
            console.error('[AssignedAutopsies] Error loading case:', err);
            if (showNotification) showNotification('Error loading case: ' + err.message, 'error');
        } finally {
            setLoadingCase(null);
        }
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                <i className="fas fa-spinner fa-spin me-2"></i>Loading assignments...
            </div>
        );
    }

    if (assignments.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '0.9rem' }}>
                <i className="fas fa-inbox me-2"></i>No assigned autopsies
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {assignments.map((a) => (
                <div
                    key={a.id}
                    style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: 10,
                        padding: '12px 14px',
                        fontSize: '0.85rem',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <strong style={{ color: '#e2e8f0' }}>
                            {a.name}
                        </strong>
                        <span style={{
                            background: '#6366f1',
                            color: '#fff',
                            padding: '2px 10px',
                            borderRadius: 10,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                        }}>
                            {a.assignedTo}
                        </span>
                    </div>
                    {a.oocName && (
                        <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: 4 }}>
                            (( {a.oocName} )) {a.faction ? `[${a.faction}]` : ''}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 10, marginTop: 6, alignItems: 'center' }}>
                        {a.topicUrl && (
                            <a href={a.topicUrl} target="_blank" rel="noopener noreferrer"
                                style={{ color: '#60a5fa', fontSize: '0.8rem', textDecoration: 'none' }}>
                                <i className="fas fa-file-alt me-1"></i>Original
                            </a>
                        )}
                        {a.caseUrl && (
                            <a href={a.caseUrl} target="_blank" rel="noopener noreferrer"
                                style={{ color: '#34d399', fontSize: '0.8rem', textDecoration: 'none' }}>
                                <i className="fas fa-folder me-1"></i>Case File
                            </a>
                        )}
                        <button
                            onClick={() => handleLoadCase(a)}
                            disabled={loadingCase === a.id}
                            style={{
                                marginLeft: 'auto',
                                background: loadingCase === a.id ? '#334155' : '#6366f1',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 6,
                                padding: '5px 12px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: loadingCase === a.id ? 'wait' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                            }}
                        >
                            {loadingCase === a.id ? (
                                <><i className="fas fa-spinner fa-spin"></i> Searching...</>
                            ) : (
                                <><i className="fas fa-file-import"></i> Load Case</>
                            )}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default AssignedAutopsies;
