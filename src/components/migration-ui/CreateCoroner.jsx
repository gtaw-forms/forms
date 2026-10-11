// Migration UI — basic coroner create form (hardcoded dropdowns, no dynamic options).
import React from 'react';
import { TYPE_OF_DEATH_OPTIONS, MANNER_OF_DEATH_OPTIONS, DEPARTMENT_OPTIONS } from './viewModel';

export const emptyCoronerValues = () => ({
  dateTime: '', pronouncedTimeOfDeath: '', placeOfDeath: '', additionalstaff: [],
  ReportRequested: false, requestingOfficer: '', department: '',
  decedentName: '', decedentOOC: '', typeOfDeath: 'PK', mannerOfDeath: 'Homicide',
  probableCauseOfDeath: '', synopsis: '',
  evidenceLocker: false, evidenceLockerItems: '',
  scenePhotosBBCode: [], additionalPhotos: [], additionalPhotos_narrative: '',
});

const F = ({ label, req, children }) => (
  <div className="mig-field"><label>{label}{req && <span className="req"> *</span>}</label>{children}</div>
);
const FF = ({ label, children }) => (
  <div className="mig-field full"><label>{label}</label>{children}</div>
);
const urls = (v, set, key) => (e) => set({ ...v, [key]: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) });

export default function CreateCoroner({ v, set }) {
  return (
    <>
      <div className="mig-card"><h2>Scene</h2><div className="body"><div className="mig-form-grid">
        <F label="DISPATCHED TO SCENE"><input type="datetime-local" value={v.dateTime} onChange={(e) => set({ ...v, dateTime: e.target.value })} /></F>
        <F label="TIME OF DEATH"><input type="time" value={v.pronouncedTimeOfDeath} onChange={(e) => set({ ...v, pronouncedTimeOfDeath: e.target.value })} /></F>
        <F label="PLACE OF DEATH"><input type="text" value={v.placeOfDeath} placeholder="Street / Area Name" onChange={(e) => set({ ...v, placeOfDeath: e.target.value })} /></F>
        <F label="ASSISTING STAFF (comma separated)"><input type="text" value={(v.additionalstaff || []).join(', ')} placeholder="Leave blank if solo" onChange={(e) => set({ ...v, additionalstaff: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></F>
      </div></div></div>
      <div className="mig-card"><h2>Request</h2><div className="body"><div className="mig-form-grid">
        <F label="REPORT REQUESTED?"><label style={{ fontSize: 13.5 }}><input type="checkbox" checked={!!v.ReportRequested} onChange={(e) => set({ ...v, ReportRequested: e.target.checked })} /> Requested</label></F>
        <F label="DEPARTMENT"><select value={v.department} onChange={(e) => set({ ...v, department: e.target.value })}>
          <option value="">— Select —</option>
          {DEPARTMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select></F>
        <FF label="REQUESTING OFFICER"><input type="text" value={v.requestingOfficer} placeholder="Requesting Officer Name" onChange={(e) => set({ ...v, requestingOfficer: e.target.value })} /></FF>
      </div></div></div>
      <div className="mig-card"><h2>Decedent &amp; Findings</h2><div className="body"><div className="mig-form-grid">
        <F label="DECEDENT NAME" req><input type="text" value={v.decedentName} placeholder="Full Name (PK → John/Jane Doe)" onChange={(e) => set({ ...v, decedentName: e.target.value })} /></F>
        <F label="OOC NAME"><input type="text" value={v.decedentOOC} onChange={(e) => set({ ...v, decedentOOC: e.target.value })} /></F>
        <F label="TYPE OF DEATH"><select value={v.typeOfDeath} onChange={(e) => set({ ...v, typeOfDeath: e.target.value, decedentName: e.target.value === 'PK' && !v.decedentName ? 'John Doe' : v.decedentName })}>
          {TYPE_OF_DEATH_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select></F>
        <F label="MANNER OF DEATH"><select value={v.mannerOfDeath} onChange={(e) => set({ ...v, mannerOfDeath: e.target.value })}>
          {MANNER_OF_DEATH_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select></F>
        <FF label="PROBABLE CAUSE"><input type="text" value={v.probableCauseOfDeath} onChange={(e) => set({ ...v, probableCauseOfDeath: e.target.value })} /></FF>
        <FF label="CASE SYNOPSIS"><textarea value={v.synopsis} placeholder="What did you find on scene?" onChange={(e) => set({ ...v, synopsis: e.target.value })} /></FF>
      </div></div></div>
      <div className="mig-card"><h2>Evidence &amp; Photos</h2><div className="body"><div className="mig-form-grid">
        <F label="EVIDENCE LOCKER USED?"><label style={{ fontSize: 13.5 }}><input type="checkbox" checked={!!v.evidenceLocker} onChange={(e) => set({ ...v, evidenceLocker: e.target.checked })} /> Used</label></F>
        <F label="LOCKER REFS"><input type="text" value={v.evidenceLockerItems} placeholder="EL#REF-CODE" onChange={(e) => set({ ...v, evidenceLockerItems: e.target.value })} /></F>
        <FF label="SCENE PHOTO URLs (one per line — body only)"><textarea style={{ minHeight: 52 }} value={(v.scenePhotosBBCode || []).join('\n')} placeholder="https://…" onChange={urls(v, set, 'scenePhotosBBCode')} /></FF>
        <FF label="MORGUE SCREENSHOT URLs (one per line)"><textarea style={{ minHeight: 52 }} value={(v.additionalPhotos || []).join('\n')} placeholder="https://…" onChange={urls(v, set, 'additionalPhotos')} /></FF>
        <FF label="PHOTO NOTES"><input type="text" value={v.additionalPhotos_narrative} onChange={(e) => set({ ...v, additionalPhotos_narrative: e.target.value })} /></FF>
      </div></div></div>
    </>
  );
}
