// Migration UI — full shell matching plan/coroner-report-handoff/mock-site.html:
// sidebar (View all records + Reports nav) + topbar + main views.
// Route: /migration-ui. Saves through the SAME Firebase flow.
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useData } from '../../contexts/DataContext';
import { useNotification } from '../../contexts/NotificationContext';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import useBbcodeGenerator from '../../hooks/useBbcodeGenerator';
import { useFormSaver } from '../../hooks/useFormSaver';
import { resolveEmployeeCredentials } from '../../utils/identityUtils';
import { cleanRankText } from '../../utils/textUtils';
import { MIGRATION_FORM_IDS } from './viewModel';
import { useMigrationRecords, PAGE_SIZE, FILTERS } from './useMigrationRecords';
import ReportDetail, { detailTitle } from './ReportDetail';
import CreateCoroner, { emptyCoronerValues } from './CreateCoroner';
import CreateMass, { emptyMassValues } from './CreateMass';
import CreateAutopsy, { emptyAutopsyValues } from './CreateAutopsy';
import './styles.css';

const KIND_LABEL = { coroner: 'Coroner', mass: 'Mass Fatality', autopsy: 'Autopsy' };
const KIND_TO_FILTER = { coroner: 'coroner', mass: 'mass', autopsy: 'autopsy' };

export default function MigrationUI() {
  const { showNotification } = useNotification();
  const { formsData, agencyDataStore, factionsData, factionListData } = useData();
  const { user, isAuthenticated, characterName } = useGtaWorldAuth();

  const [view, setView] = useState('records'); // records | detail | create
  const [createKind, setCreateKind] = useState('coroner');
  const [drafts, setDrafts] = useState({ coroner: emptyCoronerValues(), mass: emptyMassValues(), autopsy: emptyAutopsyValues() });
  const [detail, setDetail] = useState(null); // { kind, author, key, values, title, raw }
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const rec = useMigrationRecords();

  // First 25 load only once signed in (the callable requires auth).
  const authed = isAuthenticated;
  useEffect(() => {
    if (authed) rec.fetchPage({ nextOffset: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const formsByKey = useMemo(() => {
    const map = {};
    for (const f of formsData || []) if (f.firebaseKey) map[f.firebaseKey] = f;
    return map;
  }, [formsData]);
  const selectedCreateForm = formsByKey[MIGRATION_FORM_IDS[createKind]] || null;
  const draft = drafts[createKind];

  const resolvedCredentials = useMemo(
    () => (isAuthenticated && user
      ? resolveEmployeeCredentials(user, { factionListData, cleanRank: cleanRankText })
      : null),
    [user, isAuthenticated, factionListData],
  );

  const finalSelectOptions = useMemo(() => ({}), []);
  const { generateBBCode } = useBbcodeGenerator(
    selectedCreateForm, draft, finalSelectOptions, agencyDataStore,
    user, factionsData, factionListData, resolvedCredentials,
  );
  const { saveReport } = useFormSaver(user, isAuthenticated, { factionListData, resolvedCredentials });

  const goRecords = useCallback((filterId = 'all', q = '') => {
    if (!isAuthenticated) { showNotification('Sign in first — records load after sign-in.', 'warning'); return; }
    setView('records');
    rec.fetchPage({ nextOffset: 0, nextFilter: filterId, nextQuery: q });
    window.scrollTo(0, 0);
  }, [rec, isAuthenticated, showNotification]);

  const guardedFetch = useCallback((args) => {
    if (!isAuthenticated) { showNotification('Sign in first — records load after sign-in.', 'warning'); return; }
    rec.fetchPage(args);
  }, [rec, isAuthenticated, showNotification]);

  const openDetail = useCallback(async (row) => {
    const kind = row.formId === MIGRATION_FORM_IDS.mass ? 'mass'
      : row.formId === MIGRATION_FORM_IDS.autopsy ? 'autopsy' : 'coroner';
    setDetailLoading(true);
    setView('detail');
    try {
      const payload = await rec.fetchDetail(row.author, row.key);
      const report = payload?.report || {};
      const values = report.data && typeof report.data === 'object' ? report.data : {};
      setDetail({ kind, author: row.author, key: row.key, values, title: report.originalKey || row.title, raw: payload });
      window.scrollTo(0, 0);
    } catch (e) {
      showNotification(`Failed to open report: ${e?.message || 'unknown error'}`, 'error');
      setView('records');
    } finally {
      setDetailLoading(false);
    }
  }, [rec, showNotification]);

  const submitCreate = useCallback(async () => {
    setFormError('');
    if (!selectedCreateForm) { setFormError('Form definition still loading — try again in a moment.'); return; }
    let values = draft;
    if (createKind === 'coroner') {
      if (!draft.decedentName.trim()) { setFormError('Decedent name is required.'); return; }
    } else if (createKind === 'mass') {
      if (!draft.placeOfDeath.trim()) { setFormError('Incident location is required.'); return; }
      const named = draft.decedents.filter((d) => d.decedentName.trim());
      if (!named.length) { setFormError('At least one decedent with a name is required.'); return; }
      values = { ...draft, decedents: named };
    } else {
      if (!draft.decedentName.trim()) { setFormError('Decedent name is required.'); return; }
      values = {
        ...draft,
        deathCausesListItems: (draft.deathCausesListItems || []).filter((s) => s.trim()),
        anatomicSummaryListItems: (draft.anatomicSummaryListItems || []).filter((s) => s.trim()),
        casings: (draft.casings || []).filter((s) => s.trim()),
      };
    }
    setSaving(true);
    try {
      const gen = generateBBCode();
      if (!gen?.bbcode) { setFormError('Failed to generate report text. Check the fields.'); return; }
      const result = await saveReport(selectedCreateForm, values, gen.finalTitle, gen.bbcode);
      if (result?.success) {
        setDrafts((prev) => ({
          ...prev,
          coroner: createKind === 'coroner' ? emptyCoronerValues() : prev.coroner,
          mass: createKind === 'mass' ? emptyMassValues() : prev.mass,
          autopsy: createKind === 'autopsy' ? emptyAutopsyValues() : prev.autopsy,
        }));
        await rec.fetchPage({ nextOffset: 0, nextFilter: rec.filter, nextQuery: rec.query });
        setView('records');
      } else if (result?.error !== 'cancelled-duplicate') {
        setFormError(`Save failed: ${result?.error || 'unknown error'}`);
      }
    } finally {
      setSaving(false);
    }
  }, [selectedCreateForm, draft, createKind, generateBBCode, saveReport, rec]);

  const page = Math.floor(rec.offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(rec.total / PAGE_SIZE));

  // Sidebar highlight follows where the user is (mock parity).
  const activeNav = view === 'records'
    ? (rec.filter === 'all' ? '' : KIND_TO_FILTER[rec.filter] || '')
    : view === 'detail' && detail ? detail.kind
    : view === 'create' ? createKind : '';
  const displayName = characterName || user?.username || 'Not signed in';
  const initials = displayName.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="mig-shell">
      <aside className="mig-side">
        <div className="mig-brand"><div className="mig-cross">+</div><div><b>PHMC</b><span>Pillbox Hill Medical</span></div></div>
        <button type="button" className="mig-side-btn" onClick={() => goRecords('all', searchInput)}>View all records</button>
        <div className="mig-nav-sec">Reports</div>
        {['coroner', 'mass', 'autopsy'].map((k) => (
          <button key={k} type="button"
            className={`mig-nav-item${activeNav === k ? ' active' : ''}`}
            onClick={() => goRecords(KIND_TO_FILTER[k], searchInput)}>
            <span className="g">{k === 'autopsy' ? '◍' : '✚'}</span>
            {k === 'coroner' ? 'Coroner Reports' : k === 'mass' ? 'Mass Fatality' : 'Autopsy Reports'}
          </button>
        ))}
      </aside>

      <main className="mig-main">
        <header className="mig-top">
          <div className="who">{displayName}{resolvedCredentials?.rank ? ` · ${resolvedCredentials.rank}` : ''}</div>
          <div className="user"><span className="avatar">{initials}</span> {displayName}</div>
        </header>

        <div className="mig-wrap">
          {!isAuthenticated && (
            <div className="mig-card"><div className="body"><div className="mig-val">Not signed in — sign in from the prototype header, then return here. Records load after sign-in; filing requires PHMC membership.</div></div></div>
          )}

          {view === 'records' && (
            <>
              <div className="mig-head">
                <div><h1>All records</h1><p>{rec.total === 0 ? 'No records loaded yet.' : `${rec.rows.length} of ${rec.total} records (25 per page)`}</p></div>
                <button type="button" className="mig-btn" onClick={() => setView('create')}>+ Add report</button>
              </div>
              <div className="mig-tools">
                <input type="search" value={searchInput} placeholder="Search title, decedent, officer…"
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') guardedFetch({ nextOffset: 0, nextQuery: searchInput }); }} />
                <div className="mig-pills">
                  {FILTERS.map((f) => (
                    <button key={f.id} type="button" className={rec.filter === f.id ? 'active' : ''}
                      onClick={() => guardedFetch({ nextOffset: 0, nextFilter: f.id, nextQuery: searchInput })}>{f.label}</button>
                  ))}
                  <button type="button" onClick={() => guardedFetch({ nextOffset: 0, nextQuery: searchInput })}>Search</button>
                </div>
              </div>
              {rec.loading && <div className="mig-val">Loading records…</div>}
              {rec.error && <div className="mig-err">{rec.error}</div>}
              {rec.rows.map((r) => (
                <button key={`${r.author}:${r.key}`} type="button" className="mig-rec" onClick={() => openDetail(r)}>
                  <span className="grow"><span className="t">{r.title}</span><span className="d">{r.authorName || r.author} · {r.formName}</span></span>
                  <span>›</span>
                </button>
              ))}
              {rec.total > PAGE_SIZE && (
                <div className="mig-pager">
                  <button type="button" className="mig-btn mig-btn-ghost" disabled={rec.offset === 0 || rec.loading}
                    onClick={() => guardedFetch({ nextOffset: Math.max(0, rec.offset - PAGE_SIZE) })}>← Prev</button>
                  <span>Page {page} of {pageCount}</span>
                  <button type="button" className="mig-btn mig-btn-ghost" disabled={rec.offset + PAGE_SIZE >= rec.total || rec.loading}
                    onClick={() => guardedFetch({ nextOffset: rec.offset + PAGE_SIZE })}>Next →</button>
                </div>
              )}
            </>
          )}

          {view === 'detail' && (
            <>
              <div><button type="button" className="mig-btn mig-btn-ghost" onClick={() => setView('records')}>← Back to records</button></div>
              {detailLoading && <div className="mig-val">Loading report…</div>}
              {detail && (
                <>
                  <h1 style={{ fontSize: 19, margin: '12px 0 4px' }}>{KIND_LABEL[detail.kind]} — {detail.title}</h1>
                  <p style={{ color: '#8e8e96', fontSize: 13, marginBottom: 14 }}>{detail.author} · {detail.key}</p>
                  <ReportDetail kind={detail.kind} values={detail.values} />
                  <details className="mig-card"><summary style={{ padding: '12px 16px', cursor: 'pointer' }}>Raw payload (what the API returns)</summary>
                    <pre style={{ padding: 16, fontSize: 12, overflowX: 'auto' }}>{JSON.stringify(detail.raw, null, 2)}</pre>
                  </details>
                </>
              )}
            </>
          )}

          {view === 'create' && (
            <>
              <div className="mig-head">
                <div><h1>New report</h1><p>Filing saves through the normal flow (bot deploy unchanged).</p></div>
                <button type="button" className="mig-btn mig-btn-ghost" onClick={() => setView('records')}>← Back to records</button>
              </div>
              <div className="mig-pills" style={{ marginBottom: 12 }}>
                {['coroner', 'mass', 'autopsy'].map((k) => (
                  <button key={k} type="button" className={createKind === k ? 'active' : ''} onClick={() => { setCreateKind(k); setFormError(''); }}>{KIND_LABEL[k]}</button>
                ))}
              </div>
              {createKind === 'coroner' && <CreateCoroner v={drafts.coroner} set={(v) => setDrafts((p) => ({ ...p, coroner: v }))} />}
              {createKind === 'mass' && <CreateMass v={drafts.mass} set={(v) => setDrafts((p) => ({ ...p, mass: v }))} />}
              {createKind === 'autopsy' && <CreateAutopsy v={drafts.autopsy} set={(v) => setDrafts((p) => ({ ...p, autopsy: v }))} showNotification={showNotification} />}
              {formError && <div className="mig-err">{formError}</div>}
              <div className="mig-actions">
                <button type="button" className="mig-btn" disabled={saving} onClick={submitCreate}>
                  {saving ? 'Filing…' : 'File report'}
                </button>
                <button type="button" className="mig-btn mig-btn-ghost" onClick={() => setView('records')}>Cancel</button>
              </div>
              <div className="mig-val" style={{ color: '#8e8e96' }}>
                Title: {detailTitle(createKind, createKind === 'mass' ? { ...draft, date: undefined } : draft)}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
