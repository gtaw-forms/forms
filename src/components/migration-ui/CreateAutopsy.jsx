// Migration UI — autopsy create form with Morgue API import (~90% autofill).
// Markup/classes mirror mock-site.html #create-autopsy 1:1.
import React, { useState } from 'react';
import { MANNER_OF_DEATH_OPTIONS, nowLocalDateTime } from './viewModel';
import { triggerGetMorgueRecords } from '../../services/firebaseFunctions';
import { NowButton, MapButton, useMapPicker } from './FieldTools';
import { Row } from './ReportDetail';

export const emptyAutopsyValues = () => ({
  decedentName: '', decedentOOC: '', sex: '', dnaProfile: '', placeOfDeath: '',
  autopsyStartTime: '', caseStatusOptions: 'COMPLETED',
  deathCausesListItems: [''], causeOfDeath: '', deathType: 'Homicide',
  anatomicSummaryListItems: [''], externalExamination: '', RadiologyResult: '',
  bacLevel: '', narcoticTraces: '', casings: [''],
  synopsis: '', decedentPhotography: true, decedentPhotographyImages: [], autopsyDiagram: [],
});

const Field = ({ label, req, full, children }) => (
  <div className={`field${full ? ' full' : ''}`}>
    <label>{label}{req ? <span className="req"> *</span> : null}</label>
    {children}
  </div>
);

const lines = (value) => value.split('\n').map((s) => s.trim()).filter(Boolean);

function DynList({ items, setItems, placeholder, addLabel }) {
  const list = items && items.length ? items : [''];
  return (
    <div className="dyn-list">
      {list.map((item, i) => (
        <input
          key={i}
          type="text"
          value={item}
          placeholder={placeholder}
          onChange={(e) => setItems(list.map((x, k) => (k === i ? e.target.value : x)))}
        />
      ))}
      <button type="button" className="btn ghost" style={{ marginTop: 8 }} onClick={() => setItems([...list, ''])}>
        {addLabel}
      </button>
    </div>
  );
}

export default function CreateAutopsy({
  v, set, showNotification, caseInfo, onOpenAssignments, onClearCase,
}) {
  const map = useMapPicker((name) => set({ ...v, placeOfDeath: name }));
  const [morgueOpen, setMorgueOpen] = useState(false);
  const [morgueRows, setMorgueRows] = useState([]);
  const [morgueLoading, setMorgueLoading] = useState(false);
  const [morgueNote, setMorgueNote] = useState('');
  const [morgueQ, setMorgueQ] = useState('');

  const pullMorgue = async () => {
    if (morgueOpen) { setMorgueOpen(false); return; }
    setMorgueLoading(true);
    try {
      const result = await triggerGetMorgueRecords({ q: morgueQ.trim() || undefined, limit: 25 });
      const records = Array.isArray(result?.records) ? result.records : [];
      setMorgueRows(records);
      setMorgueOpen(true);
    } catch (e) {
      showNotification?.(`Morgue lookup failed: ${e?.message || 'unknown error'}`, 'error');
    } finally {
      setMorgueLoading(false);
    }
  };

  const fillFromMorgue = (r) => {
    const findings = Array.isArray(r?.findings)
      ? r.findings.map((f) => `${f.type || ''} to ${f.part || ''}`.trim()).filter(Boolean)
      : [];
    const bullets = r?.bullets && typeof r.bullets === 'object'
      ? (Array.isArray(r.bullets) ? r.bullets : [r.bullets]) : [];
    set({
      ...v,
      decedentName: (r.name || '').replace(/\(\(.+?\)\)/g, '').trim() || v.decedentName,
      sex: r.sex || v.sex,
      dnaProfile: r.dnaProfile || v.dnaProfile,
      placeOfDeath: r.location || v.placeOfDeath,
      deathCausesListItems: findings.length ? findings : v.deathCausesListItems,
      anatomicSummaryListItems: findings.length ? findings : v.anatomicSummaryListItems,
      externalExamination: r.physicalDescription ? `Morgue description:\n${r.physicalDescription}` : v.externalExamination,
      casings: bullets.length
        ? bullets.map((b) => `${String(b.type || '').toLowerCase().includes('gauge') ? 'Pellet' : 'Bullet'} found with striation marks - ${b.type || ''} #${b.id || ''}`)
        : v.casings,
      RadiologyResult: bullets.length
        ? `${bullets.length} projectiles/slugs were identified via fluoroscopy and recovered during the autopsy.`
        : v.RadiologyResult,
    });
    setMorgueNote(`Pulled case #${r.caseId} — ${r.name || 'Unknown'}. ~90% filled: verify identity, complete opinion + toxicology + diagram, then file.`);
    setMorgueOpen(false);
  };

  const entry = caseInfo?.entry || {};
  const morgue = caseInfo?.morgue || {};
  const parsed = entry.parsed || {};
  const caseDecedent = [entry.name || morgue.name, entry.oocName ? `((${entry.oocName}))` : '']
    .filter(Boolean).join(' ') || '';
  const caseLink = entry.caseUrl || entry.topicUrl || '';

  return (
    <>
      <div className="card">
        <h2>
          <span className="ic" aria-hidden="true">▤</span>Case assignment
          {caseInfo ? <span className="tag">{entry.assignedTo ? 'Assigned' : 'Loaded'}</span> : null}
        </h2>
        <div className="body">
          {caseInfo ? (
            <>
              <div className="grid2">
                <Row label="DECEDENT" value={caseDecedent} />
                <Row label="ASSIGNED TO" value={entry.assignedTo} />
                <Row label="REQUESTER" value={parsed.requesterName} />
                <Row label="FACTION" value={String(entry.faction || '').toUpperCase()} />
                <Row label="LOCATION" value={parsed.placeOfDeath || morgue.location} />
                <Row label="MORGUE RECORD" value={morgue.caseId ? `#${morgue.caseId} — ${morgue.name || 'Unknown'}` : ''} />
              </div>
              {caseLink ? (
                <div className="row">
                  <a className="btn ghost" href={caseLink} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                    Open case thread
                  </a>
                </div>
              ) : null}
              <div className="form-actions">
                <button type="button" className="btn ghost" onClick={onOpenAssignments}>Change case</button>
                <button type="button" className="btn ghost" onClick={onClearCase}>Clear case</button>
              </div>
            </>
          ) : (
            <>
              <div className="row">
                <div className="lbl">ASSIGNED AUTOPSY</div>
                <div className="val long">
                  Load an assigned autopsy request to prefill identity, morgue findings, casings and
                  toxicology. Opinion, toxicology and diagram stay manual.
                </div>
              </div>
              <button type="button" className="btn" onClick={onOpenAssignments}>
                View Assignments / Load Case
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <h2><span className="ic" aria-hidden="true">◍</span>Morgue import</h2>
        <div className="body">
          <div className="row">
            <div className="lbl">PULL FROM THE MORGUE SYSTEM</div>
            <div className="val long" style={{ marginBottom: 10 }}>
              Select from the Morgue API — this will fill in 90% of the details. Verify everything
              before filing.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="field" style={{ flex: '1 1 220px', minWidth: 0 }}>
                <input
                  type="text"
                  value={morgueQ}
                  placeholder="Search name / case (blank = recent)"
                  onChange={(e) => setMorgueQ(e.target.value)}
                  aria-label="Search morgue records"
                />
              </div>
              <button type="button" className="btn" onClick={pullMorgue} disabled={morgueLoading}>
                {morgueLoading ? 'Loading…' : 'Select from the Morgue API'}
              </button>
            </div>
          </div>

          {morgueNote ? <div className="notice ok" style={{ marginTop: 12, marginBottom: 0 }}>{morgueNote}</div> : null}

          {morgueOpen && (
            <div style={{ marginTop: 12 }}>
              {morgueRows.length === 0 ? <div className="empty">No morgue records found.</div> : null}
              {morgueRows.slice(0, 10).map((r) => (
                <button
                  key={r.caseId || r.firebaseKey}
                  type="button"
                  className="rec"
                  onClick={() => fillFromMorgue(r)}
                >
                  <div className="type"><span className="pill">#{r.caseId}</span></div>
                  <div className="main">
                    <div className="t">{r.name || 'Unknown'}</div>
                    <div className="d">{[r.location, r.timeOfDeath, r.causeOfDeath].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div className="arrow">›</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2><span className="ic" aria-hidden="true">▤</span>Decedent</h2>
        <div className="body">
          <div className="form-grid">
            <Field label="DECEDENT NAME" req>
              <input type="text" value={v.decedentName} placeholder="Full Name" onChange={(e) => set({ ...v, decedentName: e.target.value })} />
            </Field>
            <Field label="OOC NAME">
              <input type="text" value={v.decedentOOC} placeholder="OOC Name" onChange={(e) => set({ ...v, decedentOOC: e.target.value })} />
            </Field>
            <Field label="SEX">
              <input type="text" value={v.sex} placeholder="Male / Female" onChange={(e) => set({ ...v, sex: e.target.value })} />
            </Field>
            <Field label="DNA PROFILE">
              <input type="text" value={v.dnaProfile} placeholder="e.g. MW-0417-P" onChange={(e) => set({ ...v, dnaProfile: e.target.value })} />
            </Field>
            <Field label="PLACE OF DEATH">
              <div className="input-row">
                <input type="text" value={v.placeOfDeath} placeholder="Street / Area Name" onChange={(e) => set({ ...v, placeOfDeath: e.target.value })} />
                <MapButton onClick={map.open} />
              </div>
            </Field>
            <Field label="DATE OF AUTOPSY">
              <div className="input-row">
                <input type="datetime-local" value={v.autopsyStartTime} onChange={(e) => set({ ...v, autopsyStartTime: e.target.value })} />
                <NowButton onClick={() => set({ ...v, autopsyStartTime: nowLocalDateTime() })} />
              </div>
            </Field>
            <Field label="STATUS">
              <select value={v.caseStatusOptions} onChange={(e) => set({ ...v, caseStatusOptions: e.target.value })}>
                {['COMPLETED', 'PENDING', 'DRAFT'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
        </div>
      </div>

      <div className="card">
        <h2><span className="ic" aria-hidden="true">✚</span>Cause &amp; Manner</h2>
        <div className="body">
          <Field label="CAUSE OF DEATH (one per line — add rows as needed)" full>
            <DynList
              items={v.deathCausesListItems}
              setItems={(x) => set({ ...v, deathCausesListItems: x })}
              placeholder="e.g. Perforating gunshot wound to the head"
              addLabel="+ Add cause"
            />
          </Field>
          <div className="form-grid" style={{ marginTop: 14 }}>
            <Field label="HOW INJURY OCCURRED">
              <input type="text" value={v.causeOfDeath} placeholder="e.g. Drive-by shooting on…" onChange={(e) => set({ ...v, causeOfDeath: e.target.value })} />
            </Field>
            <Field label="MANNER OF DEATH">
              <select value={v.deathType} onChange={(e) => set({ ...v, deathType: e.target.value })}>
                {MANNER_OF_DEATH_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
          </div>
        </div>
      </div>

      <div className="card">
        <h2><span className="ic" aria-hidden="true">◍</span>Examination</h2>
        <div className="body">
          <Field label="ANATOMIC SUMMARY (one per line)" full>
            <DynList
              items={v.anatomicSummaryListItems}
              setItems={(x) => set({ ...v, anatomicSummaryListItems: x })}
              placeholder="e.g. Hemothorax, bilateral"
              addLabel="+ Add finding"
            />
          </Field>
          <Field label="EXTERNAL EXAMINATION" full>
            <textarea value={v.externalExamination} onChange={(e) => set({ ...v, externalExamination: e.target.value })} />
          </Field>
          <div className="form-grid" style={{ marginTop: 14 }}>
            <Field label="RADIOLOGY RESULT">
              <input type="text" value={v.RadiologyResult} onChange={(e) => set({ ...v, RadiologyResult: e.target.value })} />
            </Field>
            <Field label="BAC LEVEL">
              <input type="text" value={v.bacLevel} placeholder="0.00%" onChange={(e) => set({ ...v, bacLevel: e.target.value })} />
            </Field>
            <Field label="NARCOTIC TRACES">
              <input type="text" value={v.narcoticTraces} placeholder="Negative" onChange={(e) => set({ ...v, narcoticTraces: e.target.value })} />
            </Field>
          </div>
          <Field label="CASINGS / METAL OBJECTS (one per line)" full>
            <DynList
              items={v.casings}
              setItems={(x) => set({ ...v, casings: x })}
              placeholder="e.g. Bullet found with striation marks (9mm) #1"
              addLabel="+ Add casing"
            />
          </Field>
        </div>
      </div>

      <div className="card">
        <h2><span className="ic" aria-hidden="true">♡</span>Opinion, Toxicology &amp; Photos</h2>
        <div className="body">
          <div className="form-grid">
            <Field label="OPINION ( examiner synopsis )" full>
              <textarea value={v.synopsis} onChange={(e) => set({ ...v, synopsis: e.target.value })} />
            </Field>
            <div className="field">
              <label className="checkrow">
                <input
                  type="checkbox"
                  checked={!!v.decedentPhotography}
                  onChange={(e) => set({ ...v, decedentPhotography: e.target.checked })}
                />
                DECEDENT PHOTOGRAPHY ATTACHED?
              </label>
            </div>
            <Field label="AUTOPSY DIAGRAM URLs (one per line)">
              <textarea
                style={{ minHeight: 56 }}
                value={(v.autopsyDiagram || []).join('\n')}
                placeholder="https://…"
                onChange={(e) => set({ ...v, autopsyDiagram: lines(e.target.value) })}
              />
            </Field>
            <Field label="PHOTOGRAPHY URLs (one per line)" full>
              <textarea
                style={{ minHeight: 56 }}
                value={(v.decedentPhotographyImages || []).join('\n')}
                placeholder="https://…"
                onChange={(e) => set({ ...v, decedentPhotographyImages: lines(e.target.value) })}
              />
            </Field>
          </div>
        </div>
      </div>

      {map.modal}
    </>
  );
}
