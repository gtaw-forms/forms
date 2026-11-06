// Migration UI — mass-fatality create form (header + repeatable decedent blocks).
// Markup/classes mirror mock-site.html #create-mass 1:1.
import React from 'react';
import { TYPE_OF_DEATH_OPTIONS, MANNER_OF_DEATH_OPTIONS, DEPARTMENT_OPTIONS, nowLocalDateTime, normalizeDepartment } from './viewModel';
import { NowButton, MapButton, useMapPicker } from './FieldTools';

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

const Field = ({ label, req, full, children }) => (
  <div className={`field${full ? ' full' : ''}`}>
    <label>{label}{req ? <span className="req"> *</span> : null}</label>
    {children}
  </div>
);

const lines = (value) => value.split('\n').map((s) => s.trim()).filter(Boolean);

export default function CreateMass({ v, set, onOpenGuide }) {
  const map = useMapPicker((name) => set({ ...v, placeOfDeath: name }));
  // The real mass form's `requesting_officer` field has a "Requested" checkbox
  // bound to a non-empty requestingOfficer (a single space when unnamed).
  const requested = String(v.requestingOfficer || '').length > 0;
  const setDec = (i, patch) => {
    const decedents = v.decedents.map((d, k) => (k === i ? { ...d, ...patch } : d));
    set({ ...v, decedents });
  };

  return (
    <>
      <div className="card">
        <h2><span className="ic" aria-hidden="true">▤</span>Incident</h2>
        <div className="body">
          <div className="form-grid">
            <Field label="INCIDENT LOCATION" req>
              <div className="input-row">
                <input
                  type="text"
                  value={v.placeOfDeath}
                  placeholder="Where it happened"
                  onChange={(e) => set({ ...v, placeOfDeath: e.target.value })}
                />
                <MapButton onClick={map.open} />
              </div>
            </Field>
            <Field label="DISPATCH TIME">
              <div className="input-row">
                <input type="datetime-local" value={v.dateTime} onChange={(e) => set({ ...v, dateTime: e.target.value })} />
                <NowButton onClick={() => set({ ...v, dateTime: nowLocalDateTime() })} />
              </div>
            </Field>
            <Field label="SCENE OVERVIEW" full>
              <textarea
                value={v.synopsis}
                placeholder="What happened at the scene?"
                onChange={(e) => set({ ...v, synopsis: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="card">
        <h2><span className="ic" aria-hidden="true">✚</span>Request</h2>
        <div className="body">
          <div className="request-block">
            <div className="field check-field">
              <label className="checkrow">
                <input
                  type="checkbox"
                  checked={requested}
                  onChange={(e) => set({ ...v, requestingOfficer: e.target.checked ? (v.requestingOfficer || ' ') : '' })}
                />
                REQUESTED?
              </label>
            </div>
            <div className={`request-details${requested ? ' has-officer' : ''}`}>
              {requested ? (
                <Field label="REQUESTING OFFICER">
                  <input
                    type="text"
                    value={String(v.requestingOfficer || '').trim()}
                    placeholder="Requesting Officer Name"
                    onChange={(e) => set({ ...v, requestingOfficer: e.target.value })}
                  />
                </Field>
              ) : null}
              <Field label="DEPARTMENT">
                <select value={v.department} onChange={(e) => set({ ...v, department: e.target.value })}>
                  <option value="">— Select —</option>
                  {DEPARTMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            </div>
            {requested && onOpenGuide ? (
              <button type="button" className="pmc-guide-link" onClick={onOpenGuide}>
                {normalizeDepartment(v.department) === 'lspd'
                  ? '✉ LSPD notices now go via the portal, not forum PM — how this works'
                  : '✉ How does the coroner email reach the department? — quick guide'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {v.decedents.map((d, i) => (
        <div className="dec-block" key={i}>
          <h3>
            <span>Decedent {i + 1}</span>
            {v.decedents.length > 1 && (
              <button
                type="button"
                onClick={() => set({ ...v, decedents: v.decedents.filter((_, k) => k !== i) })}
              >
                Remove
              </button>
            )}
          </h3>
          <div className="form-grid">
            <Field label="NAME" req>
              <input
                type="text"
                value={d.decedentName}
                placeholder="Full Name"
                onChange={(e) => setDec(i, { decedentName: e.target.value })}
              />
            </Field>
            <Field label="OOC NAME">
              <input
                type="text"
                value={d.decedentOOC}
                placeholder="OOC Name"
                onChange={(e) => setDec(i, { decedentOOC: e.target.value })}
              />
            </Field>
            <Field label="TYPE">
              <select value={d.typeOfDeath} onChange={(e) => setDec(i, { typeOfDeath: e.target.value })}>
                {TYPE_OF_DEATH_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="MANNER">
              <select value={d.mannerOfDeath} onChange={(e) => setDec(i, { mannerOfDeath: e.target.value })}>
                {MANNER_OF_DEATH_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="PROBABLE CAUSE">
              <input
                type="text"
                value={d.probableCauseOfDeath}
                placeholder="Cause of death"
                onChange={(e) => setDec(i, { probableCauseOfDeath: e.target.value })}
              />
            </Field>
            <Field label="TIME OF DEATH">
              <div className="input-row">
                <input
                  type="datetime-local"
                  value={d.pronouncedTimeOfDeath}
                  onChange={(e) => setDec(i, { pronouncedTimeOfDeath: e.target.value })}
                />
                <NowButton onClick={() => setDec(i, { pronouncedTimeOfDeath: nowLocalDateTime() })} />
              </div>
            </Field>
            <Field label="INJURIES / NOTES" full>
              <textarea
                style={{ minHeight: 56 }}
                value={d.synopsis}
                onChange={(e) => setDec(i, { synopsis: e.target.value })}
              />
            </Field>
            <Field label="EVIDENCE LOCKER ID">
              <input
                type="text"
                value={d.evidenceLockerID}
                placeholder="EL#REF-CODE (blank = not used)"
                onChange={(e) => setDec(i, { evidenceLockerID: e.target.value })}
              />
            </Field>
            <Field label="DECEDENT LOCATION">
              <input
                type="text"
                value={d.decedentLocation}
                placeholder="Blank = incident location"
                onChange={(e) => setDec(i, { decedentLocation: e.target.value })}
              />
            </Field>
            <Field label="SCENE PHOTO URLs (one per line)" full>
              <textarea
                style={{ minHeight: 48 }}
                value={(d.scenePhotos || []).join('\n')}
                placeholder="https://…"
                onChange={(e) => setDec(i, { scenePhotos: lines(e.target.value) })}
              />
            </Field>
            <Field label="OOC IMAGE URLs (one per line)" full>
              <textarea
                style={{ minHeight: 48 }}
                value={(d.additionalImages || []).join('\n')}
                placeholder="https://…"
                onChange={(e) => setDec(i, { additionalImages: lines(e.target.value) })}
              />
            </Field>
            <div className="field">
              <label className="checkrow">
                <input
                  type="checkbox"
                  checked={!!d.morgueStatus}
                  onChange={(e) => setDec(i, { morgueStatus: e.target.checked })}
                />
                MORGUE SCREEN UNAVAILABLE?
              </label>
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        className="btn ghost"
        onClick={() => set({ ...v, decedents: [...v.decedents, emptyDecedent()] })}
      >
        + Add decedent
      </button>

      {map.modal}
    </>
  );
}
