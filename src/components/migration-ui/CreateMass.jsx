// Migration UI — basic mass-fatality create form (header + repeatable decedent blocks).
import React from 'react';
import { TYPE_OF_DEATH_OPTIONS, MANNER_OF_DEATH_OPTIONS, DEPARTMENT_OPTIONS } from './viewModel';

export const emptyDecedent = () => ({
  decedentName: '', decedentOOC: '', typeOfDeath: 'PK', mannerOfDeath: 'Homicide',
  probableCauseOfDeath: '', pronouncedTimeOfDeath: '', synopsis: '',
  evidenceLockerID: '', decedentLocation: '', scenePhotos: [], additionalImages: [],
  morgueStatus: false,
});

export const emptyMassValues = () => ({
  placeOfDeath: '', dateTime: '', department: '', requestingOfficer: '', synopsis: '',
  decedents: [emptyDecedent(), emptyDecedent()],
});

const F = ({ label, req, children }) => (
  <div className="mig-field"><label>{label}{req && <span className="req"> *</span>}</label>{children}</div>
);

export default function CreateMass({ v, set }) {
  const setDec = (i, patch) => {
    const decedents = v.decedents.map((d, k) => (k === i ? { ...d, ...patch } : d));
    set({ ...v, decedents });
  };
  return (
    <>
      <div className="mig-card"><h2>Incident</h2><div className="body"><div className="mig-form-grid">
        <F label="INCIDENT LOCATION" req><input type="text" value={v.placeOfDeath} onChange={(e) => set({ ...v, placeOfDeath: e.target.value })} /></F>
        <F label="DISPATCH TIME"><input type="datetime-local" value={v.dateTime} onChange={(e) => set({ ...v, dateTime: e.target.value })} /></F>
        <F label="DEPARTMENT"><select value={v.department} onChange={(e) => set({ ...v, department: e.target.value })}>
          <option value="">— Select —</option>
          {DEPARTMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select></F>
        <F label="REQUESTING OFFICER"><input type="text" value={v.requestingOfficer} onChange={(e) => set({ ...v, requestingOfficer: e.target.value })} /></F>
        <div className="mig-field full"><label>SCENE OVERVIEW</label><textarea value={v.synopsis} onChange={(e) => set({ ...v, synopsis: e.target.value })} /></div>
      </div></div></div>
      {v.decedents.map((d, i) => (
        <div className="mig-dec" key={i}>
          <h3><span>Decedent {i + 1}</span>
            {v.decedents.length > 1 && <button type="button" onClick={() => set({ ...v, decedents: v.decedents.filter((_, k) => k !== i) })}>Remove</button>}
          </h3>
          <div className="mig-form-grid">
            <F label="NAME *" ><input type="text" value={d.decedentName} onChange={(e) => setDec(i, { decedentName: e.target.value })} /></F>
            <F label="OOC NAME"><input type="text" value={d.decedentOOC} onChange={(e) => setDec(i, { decedentOOC: e.target.value })} /></F>
            <F label="TYPE"><select value={d.typeOfDeath} onChange={(e) => setDec(i, { typeOfDeath: e.target.value })}>{TYPE_OF_DEATH_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</select></F>
            <F label="MANNER"><select value={d.mannerOfDeath} onChange={(e) => setDec(i, { mannerOfDeath: e.target.value })}>{MANNER_OF_DEATH_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</select></F>
            <F label="PROBABLE CAUSE"><input type="text" value={d.probableCauseOfDeath} onChange={(e) => setDec(i, { probableCauseOfDeath: e.target.value })} /></F>
            <F label="TIME OF DEATH"><input type="datetime-local" value={d.pronouncedTimeOfDeath} onChange={(e) => setDec(i, { pronouncedTimeOfDeath: e.target.value })} /></F>
            <div className="mig-field full"><label>INJURIES / NOTES</label><textarea style={{ minHeight: 52 }} value={d.synopsis} onChange={(e) => setDec(i, { synopsis: e.target.value })} /></div>
            <F label="EVIDENCE LOCKER ID"><input type="text" value={d.evidenceLockerID} placeholder="Blank = not used" onChange={(e) => setDec(i, { evidenceLockerID: e.target.value })} /></F>
            <F label="DECEDENT LOCATION"><input type="text" value={d.decedentLocation} placeholder="Blank = incident location" onChange={(e) => setDec(i, { decedentLocation: e.target.value })} /></F>
            <div className="mig-field full"><label>SCENE PHOTO URLs (one per line)</label><textarea style={{ minHeight: 44 }} value={(d.scenePhotos || []).join('\n')} onChange={(e) => setDec(i, { scenePhotos: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} /></div>
            <div className="mig-field full"><label>OOC IMAGE URLs (one per line)</label><textarea style={{ minHeight: 44 }} value={(d.additionalImages || []).join('\n')} onChange={(e) => setDec(i, { additionalImages: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} /></div>
            <F label="MORGUE SCREEN UNAVAILABLE?"><label style={{ fontSize: 13.5 }}><input type="checkbox" checked={!!d.morgueStatus} onChange={(e) => setDec(i, { morgueStatus: e.target.checked })} /> Unavailable</label></F>
          </div>
        </div>
      ))}
      <button type="button" className="mig-btn mig-btn-ghost" onClick={() => set({ ...v, decedents: [...v.decedents, emptyDecedent()] })}>+ Add decedent</button>
    </>
  );
}
