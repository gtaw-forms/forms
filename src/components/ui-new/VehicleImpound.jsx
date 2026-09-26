import React, { useState, useEffect } from 'react';
import ImageUploader from '../form-handler/ImageUploader';
import ImagePreviewModal from '../Modals/ImagePreviewModal';
import { triggerGetTowReports, triggerSaveTowReport, triggerAddTowAccess, triggerRemoveTowAccess } from '../../services/firebaseFunctions';
import { getTowCache, setTowCache } from '../../utils/towCache';
import { useTowAccess, isLeadershipAccess, TOW_LOCAL_ACCESS_KEY } from '../../hooks/useTowAccess';

// ─── Tow Reports ───
// Viewers: PHMC members auto-pass, contractors pass via UCP-name grant;
// localhost stays open for dev. Managers (grant/revoke): tow-supervisor
// flag, PHMC leadership, or superadmin (function-enforced; UI mirrors it).
const VehicleImpound = ({ showNotification, isAuthenticated, characterName, ucpName, isPhmcMember, accessLevel }) => {
    // Localhost has no Firebase Auth (repo-wide convention) — reports run
    // browser-local there; prod path uses the callable functions + RTDB.
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const LOCAL_KEY = 'phmc_tow_reports_poc';
    const officer = characterName || (isLocal ? 'Localhost User' : 'Unknown');
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ plate: '', make: '', model: '', authorizingEmployee: '', location: '', reason: '', photos: [] });
    const emptyForm = { plate: '', make: '', model: '', authorizingEmployee: '', location: '', reason: '', photos: [] };
    // Shared access state (grants, gates, supervisor flag).
    const { accessList, hasAccess, isTowSupervisor, reloadAccess } = useTowAccess({ isAuthenticated, characterName, ucpName, isPhmcMember });
    const canManageTow = isTowSupervisor || isLeadershipAccess(accessLevel);
    const [showAccess, setShowAccess] = useState(false);
    const [newUcp, setNewUcp] = useState('');
    const [newSup, setNewSup] = useState(false);
    // Remembers a successful server load across re-runs so a later failure
    // (cold function, auth flip) keeps the good list instead of blanking it.
    const serverOk = React.useRef(false);
    // Last-rendered IndexedDB cache (version-checked against the server).
    const cacheRef = React.useRef(null);
    // Sync status line: makes server vs local visible instead of mysterious.
    const [syncStatus, setSyncStatus] = useState({ state: 'checking', detail: '', localOnly: 0 });
    // Bounded gallery viewer (same as scenePhotos) — never a full-size tab.
    const [gallery, setGallery] = useState(null); // { images, index }

    // Server list via callable function, with local fallback when the
    // function isn't deployed/reachable yet.
    const readLocalEntries = () => {
        try {
            const raw = localStorage.getItem(LOCAL_KEY);
            const list = raw ? (JSON.parse(raw) || []) : [];
            return (Array.isArray(list) ? list : []).filter(e => e && !String(e.id || '').startsWith('demo-'));
        } catch { return []; }
    };
    const mergeWithLocals = (serverList) => {
        const list = [...serverList];
        const ids = new Set(list.map(r => r.id));
        let localOnly = 0;
        for (const e of readLocalEntries()) {
            if (!ids.has(e.id)) { list.push({ ...e, _localOnly: true }); localOnly++; }
        }
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return { list, localOnly };
    };
    const loadFromServer = async (dbg) => {
        const res = await triggerGetTowReports();
        const serverList = Array.isArray(res?.reports) ? res.reports : [];
        const serverVersion = res?.version ?? null;
        // Migrate browser-local entries the server lacks (matches by plate +
        // createdAt, so revisits never duplicate). This replaces the old
        // one-shot flag, which could be consumed while empty and strand
        // pre-deploy saves locally forever.
        if (isLocal) {
            try {
                const raw = localStorage.getItem(LOCAL_KEY);
                const stored = raw ? JSON.parse(raw) || [] : [];
                const mine = (Array.isArray(stored) ? stored : []).filter(e => e && !String(e.id || '').startsWith('demo-'));
                const have = new Set(serverList.map(r => `${String(r.plate || '').toUpperCase()}|${r.createdAt || 0}`));
                let migrated = false;
                for (const e of mine) {
                    if (have.has(`${String(e.plate || '').toUpperCase()}|${e.createdAt || 0}`)) continue;
                    try {
                        await triggerSaveTowReport({
                            plate: e.plate, make: e.make, model: e.model,
                            authorizingEmployee: e.authorizingEmployee, location: e.location,
                            reason: e.reason, photos: e.photos, officerName: e.officerName,
                        });
                        migrated = true;
                    } catch (err) { console.warn(`[TOW-DBG] ${dbg} migrate ${e.plate} failed: ${err?.message || err}`); }
                }
                if (migrated) {
                    const res2 = await triggerGetTowReports();
                    const list2 = Array.isArray(res2?.reports) ? res2.reports : [];
                    const have2 = new Set(list2.map(r => `${String(r.plate || '').toUpperCase()}|${r.createdAt || 0}`));
                    const remaining = mine.filter(e => !have2.has(`${String(e.plate || '').toUpperCase()}|${e.createdAt || 0}`));
                    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(remaining)); } catch { /* ignore */ }
                    console.warn(`[TOW-DBG] ${dbg} migration done, ${mine.length - remaining.length}/${mine.length} moved server-side`);
                    serverList.length = 0;
                    serverList.push(...list2);
                }
            } catch (err) { console.warn(`[TOW-DBG] ${dbg} migration error: ${err?.message || err}`); }
        }
        // Merge leftover browser-local entries so a reachable-but-empty
        // server never hides local work.
        const { list, localOnly } = mergeWithLocals(serverList);
        // Version-checked refresh: persist + re-render only when the server
        // version moved since what we show (avoids flicker on every visit).
        const prevVersion = cacheRef.current?.version;
        if (serverVersion === null || serverVersion === undefined || serverVersion !== prevVersion) {
            if (serverVersion !== null && serverVersion !== undefined) {
                cacheRef.current = { version: serverVersion, reports: serverList };
                setTowCache(serverVersion, serverList).catch(() => {});
            }
            console.warn(`[TOW-DBG] ${dbg} loadFromServer OK server=${list.length - localOnly} localOnly=${localOnly} v=${serverVersion} (refresh)`);
            setEntries(list);
        } else {
            console.warn(`[TOW-DBG] ${dbg} loadFromServer OK v=${serverVersion} unchanged — keeping current list`);
        }
        setLoading(false);
        setSyncStatus({ state: 'online', detail: '', localOnly });
    };
    const loadLocal = (dbg) => {
        try {
            const list = readLocalEntries();
            list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            console.warn(`[TOW-DBG] ${dbg} loadLocal count=${list.length}`);
            setEntries(list.map(e => ({ ...e, _localOnly: true })));
            setSyncStatus({ state: 'offline', detail: 'function unreachable', localOnly: list.length });
        } catch { setEntries([]); }
        setLoading(false);
    };

    useEffect(() => {
        const mountId = Math.random().toString(36).slice(2, 6);
        console.warn(`[TOW-DBG] ${mountId} effect start (isAuth=${isAuthenticated})`);
        let cancelled = false;
        (async () => {
            // Instant paint from IndexedDB (version-checked refresh follows).
            try {
                const cached = await getTowCache();
                if (cancelled) return;
                if (cached) {
                    cacheRef.current = { version: cached.version, reports: cached.reports };
                    const { list, localOnly } = mergeWithLocals(cached.reports || []);
                    console.warn(`[TOW-DBG] ${mountId} cache paint v=${cached.version} count=${list.length}`);
                    setEntries(list);
                    setLoading(false);
                    setSyncStatus({ state: 'cache', detail: '', localOnly });
                }
            } catch { /* fall through to network */ }
            if (cancelled) return;
            // Migration lives inside loadFromServer now (content-matched, so
            // pre-deploy saves move up on the next successful load instead of
            // depending on a one-shot flag).
            // One retry for cold-starting functions. A failed
            // reload must never clobber an already-good list with emptiness
            // (the flash-then-"no reports" bug on auth-flip re-runs).
            let loaded = false;
            let lastErr = '';
            for (let attempt = 0; attempt < 2 && !loaded && !cancelled; attempt++) {
                if (attempt > 0) await new Promise(r => setTimeout(r, 3000));
                try {
                    await loadFromServer(`${mountId} try${attempt}`);
                    loaded = true;
                } catch (err) { lastErr = err?.message || String(err); console.warn(`[TOW-DBG] ${mountId} try${attempt} failed: ${lastErr}`); }
            }
            if (cancelled) return;
            if (!loaded) {
                console.warn(`[TOW-DBG] ${mountId} all tries failed (${lastErr}), serverOk=${serverOk.current}`);
                if (serverOk.current) {
                    setLoading(false);
                    setSyncStatus(s => ({ ...s, state: 'offline', detail: lastErr }));
                }
                else if (isLocal) { loadLocal(`${mountId} fallback`); setSyncStatus(s => ({ ...s, state: 'offline', detail: lastErr })); }
                else { setEntries([]); setLoading(false); }
            } else {
                serverOk.current = true;
            }
        })();
        return () => { cancelled = true; console.warn(`[TOW-DBG] ${mountId} cleanup`); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated]);

    const writeLocalAccess = (next) => {
        try { localStorage.setItem(TOW_LOCAL_ACCESS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
        reloadAccess();
    };

    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    const handleAddAccess = async () => {
        const name = newUcp.trim();
        if (!name) return;
        if (accessList.some(a => String(a.ucpName || '').trim().toLowerCase() === name.toLowerCase())) {
            showNotification?.('That UCP name already has access.', 'info');
            return;
        }
        try {
            if (isLocal) {
                try {
                    const res = await triggerAddTowAccess({ ucpName: name, supervisor: newSup, actor: officer });
                    // Write-through mirror so the browser store (what this
                    // view reads on localhost) stays consistent with RTDB.
                    writeLocalAccess([{ id: (res && res.id) || `local-${Date.now()}`, ucpName: name, supervisor: newSup, addedBy: officer, addedAt: Date.now() }, ...accessList]);
                } catch {
                    writeLocalAccess([{ id: `local-${Date.now()}`, ucpName: name, supervisor: newSup, addedBy: officer, addedAt: Date.now() }, ...accessList]);
                }
            } else {
                await triggerAddTowAccess({ ucpName: name, supervisor: newSup, actor: officer });
            }
            setNewUcp('');
            setNewSup(false);
            showNotification?.(`Access granted to ${name}${newSup ? ' (supervisor)' : ''}.`, 'success');
        } catch (err) {
            showNotification?.('Grant failed: ' + (err?.message || err), 'error');
        }
    };

    const handleRemoveAccess = async (entry) => {
        try {
            if (isLocal) {
                try {
                    await triggerRemoveTowAccess({ id: entry.id, actor: officer });
                } catch { /* fall through to local mirror */ }
                writeLocalAccess(accessList.filter(a => a.id !== entry.id));
            } else {
                await triggerRemoveTowAccess({ id: entry.id, actor: officer });
            }
        } catch (err) {
            showNotification?.('Revoke failed: ' + (err?.message || err), 'error');
        }
    };

    const handleSoftDelete = async (e, deleted) => {
        try {
            const payload = {
                id: e.id, plate: e.plate || '', make: e.make || '', model: e.model || '',
                authorizingEmployee: e.authorizingEmployee || '', location: e.location || '',
                reason: e.reason || '', photos: Array.isArray(e.photos) ? e.photos : [],
                officerName: officer, deleted, deletedBy: officer,
            };
            if (isLocal) {
                try {
                    await triggerSaveTowReport(payload);
                } catch {
                    saveLocal(payload);
                }
            } else {
                await triggerSaveTowReport(payload);
            }
            await refresh();
            setConfirmDeleteId(null);
            showNotification?.(deleted ? 'Report soft-deleted.' : 'Report restored.', 'success');
        } catch (err) {
            showNotification?.('Failed: ' + (err?.message || err), 'error');
        }
    };

    const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    const refresh = async () => {
        try {
            await loadFromServer();
        } catch {
            if (isLocal) loadLocal();
            else throw new Error('unreachable');
        }
    };

    const saveLocal = (record) => {
        let stored = [];
        try {
            stored = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
            if (!Array.isArray(stored)) stored = [];
        } catch { stored = []; }
        if (record.id && String(record.id).startsWith('local-')) {
            const i = stored.findIndex(e => e && e.id === record.id);
            if (i >= 0) stored[i] = { ...stored[i], ...record };
            else stored.unshift(record);
        } else if (!record.id || String(record.id).startsWith('demo-')) {
            stored.unshift({ ...record, id: `local-${Date.now()}`, createdBy: officer, createdAt: Date.now() });
        }
        try { localStorage.setItem(LOCAL_KEY, JSON.stringify(stored)); } catch { /* ignore */ }
        loadLocal();
    };

    const handleSave = async () => {
        if (!form.plate.trim()) { showNotification?.('License plate is required.', 'warning'); return; }
        setSaving(true);
        try {
            const payload = {
                ...(editingId ? { id: editingId } : {}),
                plate: form.plate.trim(),
                make: form.make.trim(),
                model: form.model.trim(),
                authorizingEmployee: form.authorizingEmployee.trim(),
                location: form.location.trim(),
                reason: form.reason.trim(),
                photos: Array.isArray(form.photos) ? form.photos : [],
                officerName: officer,
            };
            if (isLocal) {
                try {
                    await triggerSaveTowReport(payload);
                } catch {
                    // Function not deployed/reachable — stay browser-local.
                    // Server-owned ids can't be edited locally; save a copy.
                    if (payload.id && !String(payload.id).startsWith('local-') && !String(payload.id).startsWith('demo-')) {
                        const { id, ...rest } = payload;
                        saveLocal(rest);
                    } else {
                        saveLocal(payload);
                    }
                }
            } else {
                await triggerSaveTowReport(payload);
            }
            await refresh();
            setForm({ ...emptyForm });
            setEditingId(null);
            setShowForm(false);
            showNotification?.('Tow report saved.', 'success');
        } catch (err) {
            showNotification?.('Save failed: ' + (err?.message || err), 'error');
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (e) => {
        setEditingId(e.id);
        setForm({
            plate: e.plate || '', make: e.make || '', model: e.model || '',
            authorizingEmployee: e.authorizingEmployee || '', location: e.location || '',
            reason: e.reason || '', photos: Array.isArray(e.photos) ? e.photos : [],
        });
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingId(null);
        setForm({ ...emptyForm });
    };

    const inputStyle = {
        width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)',
        color: 'var(--text)', borderRadius: 8, padding: '9px 12px', fontSize: 13, boxSizing: 'border-box',
    };
    const labelStyle = { display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 };

    if (!isAuthenticated && !isLocal) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12, color: 'var(--text-muted)' }}>
                <i className="fas fa-car-crash" style={{ fontSize: 40, opacity: 0.3 }} />
                <p style={{ fontSize: 14, margin: 0 }}>Sign in to view and file tow reports.</p>
            </div>
        );
    }

    if (!hasAccess) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12, color: 'var(--text-muted)' }}>
                <i className="fas fa-lock" style={{ fontSize: 40, opacity: 0.3 }} />
                <p style={{ fontSize: 14, margin: 0 }}>Tow Reports is restricted — ask a supervisor to add your UCP name.</p>
            </div>
        );
    }

    return (
        // Scrollable: main-content is overflow:hidden, so without this the
        // form + gallery clip once they exceed the viewport (Save unreachable).
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 10px 16px 2px' }}>
            <div className="patient-note" style={{ background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid rgba(232,163,61,0.25)' }}>
                <span>POC</span>
                <span><strong>Prototype</strong> — localhost only, not linked in production. Reports {isLocal ? 'stay in this browser' : <>save to <span style={{ fontFamily: 'var(--mono)' }}>vehicle-impounds</span></>}.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 15, color: 'var(--text)', flex: 1 }}>Towed Vehicles ({entries.length})</h3>
                {canManageTow && (
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '8px 14px' }} onClick={() => setShowAccess(v => !v)}>
                    <i className="fas fa-user-shield me-1" /> Supervisor Access
                </button>
                )}
                <button className="btn btn-primary" style={{ fontSize: 12, padding: '8px 14px' }} onClick={() => { if (showForm) closeForm(); else setShowForm(true); }}>
                    <i className={`fas ${showForm ? 'fa-times' : 'fa-plus'} me-1`} /> {showForm ? 'Cancel' : 'New Tow Report'}
                </button>
            </div>
            {syncStatus.state !== 'checking' && (
                <div style={{ fontSize: 11, color: syncStatus.state === 'online' ? 'var(--text-faint)' : 'var(--amber)', fontFamily: 'var(--mono)', marginBottom: 10 }}>
                    Server: {syncStatus.state}{syncStatus.localOnly > 0 ? ` · ${syncStatus.localOnly} local-only` : ''}{syncStatus.detail ? ` (${syncStatus.detail})` : ''}
                </div>
            )}

            {showAccess && canManageTow && (
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-accent)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                        <i className="fas fa-user-shield me-1" style={{ color: 'var(--amber)' }} /> Who can access Tow Reports
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginBottom: 10 }}>
                        PHMC employees always have access. Contractors need a UCP grant below — tick Supervisor for those who may manage this list.
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                        <input style={{ ...inputStyle, flex: 1 }} value={newUcp} onChange={e => setNewUcp(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleAddAccess(); }} placeholder="UCP name (e.g. JohnDoe99)" />
                        <button className="btn btn-primary" style={{ fontSize: 12, padding: '8px 14px', whiteSpace: 'nowrap' }} onClick={handleAddAccess}>
                            <i className="fas fa-plus me-1" /> Grant
                        </button>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                        <input type="checkbox" checked={newSup} onChange={e => setNewSup(e.target.checked)} style={{ width: 15, height: 15, margin: 0 }} />
                        Tow Supervisor — may grant and revoke access
                    </label>
                    {accessList.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {accessList.map(a => (
                                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 7 }}>
                                    <i className="fas fa-user" style={{ color: 'var(--teal)', fontSize: 11 }} />
                                    <span style={{ fontSize: 12.5, color: 'var(--text)', flex: 1 }}>{a.ucpName}</span>
                                    {a.supervisor === true && (
                                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--amber)', border: '1px solid var(--amber)', borderRadius: 5, padding: '2px 7px' }}>SUPERVISOR</span>
                                    )}
                                    <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>by {a.addedBy || '?'}</span>
                                    <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => handleRemoveAccess(a)}>
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {showForm && (
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-accent)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
                        {editingId ? 'Edit Tow Report' : 'New Tow Report'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                        <div><label style={labelStyle}>License Plate *</label>
                            <input style={{ ...inputStyle, fontFamily: 'var(--mono)', textTransform: 'uppercase' }} value={form.plate} onChange={e => setField('plate', e.target.value)} placeholder="ABC 123" /></div>
                        <div><label style={labelStyle}>Impound Location</label>
                            <input style={inputStyle} value={form.location} onChange={e => setField('location', e.target.value)} placeholder="Street / area" /></div>
                        <div><label style={labelStyle}>Make</label>
                            <input style={inputStyle} value={form.make} onChange={e => setField('make', e.target.value)} placeholder="e.g. Benefactor" /></div>
                        <div><label style={labelStyle}>Model</label>
                            <input style={inputStyle} value={form.model} onChange={e => setField('model', e.target.value)} placeholder="e.g. Dubsta" /></div>
                        <div><label style={labelStyle}>Authorizing Employee</label>
                            <input style={inputStyle} value={form.authorizingEmployee} onChange={e => setField('authorizingEmployee', e.target.value)} placeholder="Who authorized the tow" /></div>
                        <div><label style={labelStyle}>Reason</label>
                            <input style={inputStyle} value={form.reason} onChange={e => setField('reason', e.target.value)} placeholder="e.g. Abandoned, evidence hold" /></div>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                        <label style={labelStyle}>Vehicle Photos</label>
                        <ImageUploader images={form.photos} onImagesChange={v => setField('photos', v)} maxImages={6} fieldName="towPhotos" />
                    </div>
                    <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={saving} onClick={handleSave}>
                        <i className="fas fa-save me-1" /> {saving ? 'Saving…' : 'Save Tow Report'}
                    </button>
                </div>
            )}

            {loading ? (
                <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>Loading…</p>
            ) : entries.length === 0 ? (
                <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>No tow reports yet — file the first one above.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {entries.map(e => {
                        const isDel = !!e.deleted;
                        const tcol = isDel ? '#ff9d9d' : 'var(--text)';
                        const tmut = isDel ? '#e08a8a' : 'var(--text-muted)';
                        return (
                        <div key={e.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 14, color: 'var(--teal)', background: 'var(--teal-dim)', padding: '3px 10px', borderRadius: 6 }}>{e.plate || 'NO PLATE'}</span>
                                {e._localOnly && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--amber)', border: '1px solid var(--amber)', borderRadius: 5, padding: '2px 7px' }} title="Not on the server yet">LOCAL</span>}
                                <span style={{ fontSize: 12.5, color: tcol }}>{[e.make, e.model].filter(Boolean).join(' ') || 'Unknown vehicle'}</span>
                                {isDel && <span style={{ fontSize: 10, fontWeight: 700, color: '#ff6b6b', border: '1px solid #ff6b6b', borderRadius: 5, padding: '2px 7px' }}>DELETED</span>}
                                <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                                    {e.createdAt ? new Date(e.createdAt).toLocaleString() : ''}
                                </span>
                                <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }} onClick={() => startEdit(e)}>
                                    <i className="fas fa-pen me-1" /> Edit
                                </button>
                                {isDel ? (
                                <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0, borderColor: 'var(--teal)', color: 'var(--teal)' }} onClick={() => handleSoftDelete(e, false)}>
                                    <i className="fas fa-undo me-1" /> Restore
                                </button>
                                ) : confirmDeleteId === e.id ? (
                                <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0, borderColor: '#ff6b6b', color: '#ff6b6b' }} onClick={() => handleSoftDelete(e, true)}>
                                    Confirm delete?
                                </button>
                                ) : (
                                <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }} onClick={() => setConfirmDeleteId(e.id)}>
                                    <i className="fas fa-trash me-1" /> Delete
                                </button>
                                )}
                            </div>
                            <div style={{ fontSize: 12, color: tmut, marginBottom: e.reason ? 4 : 0 }}>
                                {[e.location && `Impound: ${e.location}`, e.authorizingEmployee && `Authorized by: ${e.authorizingEmployee}`, e.officerName && `By: ${e.officerName}`].filter(Boolean).join(' · ')}
                            </div>
                            {e.reason && <div style={{ fontSize: 12.5, color: tcol, marginBottom: 6 }}>{e.reason}</div>}
                            {Array.isArray(e.photos) && e.photos.length > 0 && (
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                                    {e.photos.slice(0, 4).map((url, i) => (
                                        <img key={i} src={url} alt={`tow photo ${i + 1}`}
                                            onClick={() => setGallery({ images: e.photos, index: i })}
                                            style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', cursor: 'zoom-in' }} />
                                    ))}
                                    {e.photos.length > 4 && (
                                        <div onClick={() => setGallery({ images: e.photos, index: 4 })}
                                            style={{ width: 64, height: 64, borderRadius: 6, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-muted)', cursor: 'zoom-in' }}>
                                            +{e.photos.length - 4}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        );
                    })}
                </div>
            )}
            {gallery && (
                <ImagePreviewModal
                    isOpen={!!gallery}
                    onClose={() => setGallery(null)}
                    images={gallery.images}
                    currentIndex={gallery.index}
                    onIndexChange={(i) => setGallery(g => g ? { ...g, index: i } : g)}
                />
            )}
        </div>
    );
};

export default VehicleImpound;
