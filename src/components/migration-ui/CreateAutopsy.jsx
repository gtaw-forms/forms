// Migration UI — basic autopsy create form with Morgue API import (~90% autofill).
import React, { useState } from 'react';
import { MANNER_OF_DEATH_OPTIONS } from './viewModel';
import { triggerGetMorgueRecords } from '../../services/firebaseFunctions';

export const emptyAutopsyValues = () => ({
  decedentName: '', decedentOOC: '', sex: '', dnaProfile: '', placeOfDeath: '',
  autopsyStartTime: '', caseStatusOptions: 'COMPLETED',
  deathCausesListItems: [''], causeOfDeath: '', deathType: 'Homicide',
  anatomicSummaryListItems: [''], externalExamination: '', RadiologyResult: '',
  bacLevel: '', narcoticTraces: '', casings: [''],
  synopsis: '', decedentPhotography: true, decedentPhotographyImages: [], autopsyDiagram: [],
});

const F = ({ label, req, children }) => (
  <div className="mig-field"><label>{label}{req && <span className="req"> *</span>}</label>{children}</div>
);
const FF = ({ label, children }) => (
  <div className="mig-field full"><label>{label}</label>{children}</div>
);

function DynList({ items, setItems, placeholder, addLabel }) {
  return (
    <div>
      {items.map((it, i) => (
        <input key={i} type="text" style={{ marginBottom: 8, width: '100%' }} value={it} placeholder={placeholder}
          onChange={(e) => setItems(items.map((x, k) => (k === i ? e.target.value : x)))} />
      ))}
      <button type="button" className="mig-btn mig-btn-ghost" onClick={() => setItems([...items, ''])}>{addLabel}</button>
    </div>
  );
}

export default function CreateAutopsy({ v, set, showNotification }) {
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
      ? r.findings.map((f) => `${f.type || ''} to ${f.part || ''}`.trim()).filter(Boolean) : [];
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
    setMorgueNote(`Pulled case #${r.caseId} — verify identity, then complete opinion + toxicology + diagram.`);
    setMorgueOpen(false);
  };

  return (
    <>
      <div className="mig-card"><h2>Morgue import</h2><div className="body">
        <div className="mig-row"><div className="mig-lbl">PULL FROM THE MORGUE SYSTEM</div>
          <div className="mig-val" style={{ marginBottom: 10 }}>Select from the Morgue API — this will fill in 90% of the details. Verify everything before filing.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input type="text" value={morgueQ} placeholder="Search name / case (blank = recent)" onChange={(e) => setMorgueQ(e.target.value)} style={{ flex: '1 1 200px' }} />
            <button type="button" className="mig-btn" onClick={pullMorgue} disabled={morgueLoading}>
              {morgueLoading ? 'Loading…' : 'Select from the Morgue API'}
            </button>
          </div>
        </div>
        {morgueNote && <div className="mig-ok">{morgueNote}</div>}
        {morgueOpen && (
          <div style={{ marginTop: 10 }}>
            {morgueRows.length === 0 && <div className="mig-val">No morgue records found.</div>}
            {morgueRows.slice(0, 10).map((r) => (
              <button key={r.caseId || r.firebaseKey} type="button" className="mig-rec" style={{ marginBottom: 8 }} onClick={() => fillFromMorgue(r)}>
                <span className="grow"><span className="t">#{r.caseId} — {r.name}</span><span className="d">{r.location || ''}</span></span>
                <span>›</span>
              </button>
            ))}
          </div>
        )}
      </div></div>
      <div className="mig-card"><h2>Decedent</h2><div className="body"><div className="mig-form-grid">
        <F label="DECEDENT NAME" req><input type="text" value={v.decedentName} onChange={(e) => set({ ...v, decedentName: e.target.value })} /></F>
        <F label="OOC NAME"><input type="text" value={v.decedentOOC} onChange={(e) => set({ ...v, decedentOOC: e.target.value })} /></F>
        <F label="SEX"><input type="text" value={v.sex} onChange={(e) => set({ ...v, sex: e.target.value })} /></F>
        <F label="DNA PROFILE"><input type="text" value={v.dnaProfile} onChange={(e) => set({ ...v, dnaProfile: e.target.value })} /></F>
        <F label="PLACE OF DEATH"><input type="text" value={v.placeOfDeath} onChange={(e) => set({ ...v, placeOfDeath: e.target.value })} /></F>
        <F label="DATE OF AUTOPSY"><input type="datetime-local" value={v.autopsyStartTime} onChange={(e) => set({ ...v, autopsyStartTime: e.target.value })} /></F>
        <F label="STATUS"><select value={v.caseStatusOptions} onChange={(e) => set({ ...v, caseStatusOptions: e.target.value })}>
          {['COMPLETED', 'PENDING', 'DRAFT'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select></F>
      </div></div></div>
      <div className="mig-card"><h2>Cause &amp; Manner</h2><div className="body">
        <FF label="CAUSE OF DEATH (add rows as needed)"><DynList items={v.deathCausesListItems} setItems={(x) => set({ ...v, deathCausesListItems: x })} addLabel="+ Add cause" /></FF>
        <div className="mig-form-grid" style={{ marginTop: 12 }}>
          <F label="HOW INJURY OCCURRED"><input type="text" value={v.causeOfDeath} onChange={(e) => set({ ...v, causeOfDeath: e.target.value })} /></F>
          <F label="MANNER OF DEATH"><select value={v.deathType} onChange={(e) => set({ ...v, deathType: e.target.value })}>
            {MANNER_OF_DEATH_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select></F>
        </div>
      </div></div>
      <div className="mig-card"><h2>Examination</h2><div className="body">
        <FF label="ANATOMIC SUMMARY"><DynList items={v.anatomicSummaryListItems} setItems={(x) => set({ ...v, anatomicSummaryListItems: x })} addLabel="+ Add finding" /></FF>
        <FF label="EXTERNAL EXAMINATION"><textarea value={v.externalExamination} onChange={(e) => set({ ...v, externalExamination: e.target.value })} /></FF>
        <div className="mig-form-grid">
          <F label="RADIOLOGY RESULT"><input type="text" value={v.RadiologyResult} onChange={(e) => set({ ...v, RadiologyResult: e.target.value })} /></F>
          <F label="BAC LEVEL"><input type="text" value={v.bacLevel} onChange={(e) => set({ ...v, bacLevel: e.target.value })} /></F>
          <F label="NARCOTIC TRACES"><input type="text" value={v.narcoticTraces} onChange={(e) => set({ ...v, narcoticTraces: e.target.value })} /></F>
        </div>
        <FF label="CASINGS / METAL OBJECTS"><DynList items={v.casings} setItems={(x) => set({ ...v, casings: x })} addLabel="+ Add casing" /></FF>
      </div></div>
      <div className="mig-card"><h2>Opinion &amp; Photos</h2><div className="body"><div className="mig-form-grid">
        <FF label="OPINION (examiner synopsis)"><textarea value={v.synopsis} onChange={(e) => set({ ...v, synopsis: e.target.value })} /></FF>
        <F label="PHOTOGRAPHY ATTACHED?"><label style={{ fontSize: 13.5 }}><input type="checkbox" checked={!!v.decedentPhotography} onChange={(e) => set({ ...v, decedentPhotography: e.target.checked })} /> Attached</label></F>
        <FF label="PHOTOGRAPHY URLs (one per line)"><textarea style={{ minHeight: 52 }} value={(v.decedentPhotographyImages || []).join('\n')} onChange={(e) => set({ ...v, decedentPhotographyImages: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} /></FF>
        <FF label="DIAGRAM URLs (one per line)"><textarea style={{ minHeight: 52 }} value={(v.autopsyDiagram || []).join('\n')} onChange={(e) => set({ ...v, autopsyDiagram: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} /></FF>
      </div></div></div>
    </>
  );
}
