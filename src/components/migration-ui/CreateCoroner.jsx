// Migration UI — basic coroner create form (hardcoded dropdowns, no dynamic options).
// Markup/classes mirror mock-site.html #create-coroner 1:1.
import React, { useMemo } from 'react';
import Select from 'react-select';
import { TYPE_OF_DEATH_OPTIONS, MANNER_OF_DEATH_OPTIONS, DEPARTMENT_OPTIONS, nowLocalDateTime, nowLocalTime, normalizeDepartment } from './viewModel';
import { NowButton, MapButton, useMapPicker } from './FieldTools';
import { platformSelectStyles } from './platformSelectStyles';
import { formatCharacterNameForDisplay } from '../../utils/identityUtils';

export const emptyCoronerValues = () => ({
  dateTime: '', pronouncedTimeOfDeath: '', placeOfDeath: '', additionalstaff: [],
  ReportRequested: false, requestingOfficer: '', department: '',
  decedentName: '', decedentOOC: '', typeOfDeath: 'PK', mannerOfDeath: 'Homicide',
  probableCauseOfDeath: '', synopsis: '',
  evidenceLocker: false, evidenceLockerItems: '',
  scenePhotosBBCode: [], additionalPhotos: [], additionalPhotos_narrative: '',
});

const Field = ({ label, req, full, children }) => (
  <div className={`field${full ? ' full' : ''}`}>
    <label>{label}{req ? <span className="req"> *</span> : null}</label>
    {children}
  </div>
);

const urls = (v, set, key) => (e) => set({
  ...v,
  [key]: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
});

export default function CreateCoroner({ v, set, factionsData, onOpenGuide }) {
  const map = useMapPicker((name) => set({ ...v, placeOfDeath: name }));
  const employeeOptions = useMemo(() => {
    const members = factionsData?.['364']?.members;
    if (!members) return [];
    const seen = new Set();
    return Object.values(members)
      .map((member) => member?.characterName)
      .filter((name) => {
        if (!name || seen.has(name)) return false;
        seen.add(name);
        return true;
      })
      .map((name) => ({ value: name, label: formatCharacterNameForDisplay(name) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [factionsData]);
  return (
    <>
      <div className="card">
        <h2><span className="ic" aria-hidden="true">▤</span>Scene</h2>
        <div className="body">
          <div className="form-grid">
            <Field label="DISPATCHED TO SCENE">
              <div className="input-row">
                <input type="datetime-local" value={v.dateTime} onChange={(e) => set({ ...v, dateTime: e.target.value })} />
                <NowButton onClick={() => set({ ...v, dateTime: nowLocalDateTime() })} />
              </div>
            </Field>
            <Field label="TIME OF DEATH">
              <div className="input-row">
                <input type="time" value={v.pronouncedTimeOfDeath} onChange={(e) => set({ ...v, pronouncedTimeOfDeath: e.target.value })} />
                <NowButton onClick={() => set({ ...v, pronouncedTimeOfDeath: nowLocalTime() })} />
              </div>
            </Field>
            <Field label="PLACE OF DEATH">
              <div className="input-row">
                <input type="text" value={v.placeOfDeath} placeholder="Street / Area Name" onChange={(e) => set({ ...v, placeOfDeath: e.target.value })} />
                <MapButton onClick={map.open} />
              </div>
            </Field>
            <Field label="ADDITIONAL EMPLOYEES">
              <Select
                isMulti
                isSearchable
                isClearable
                closeMenuOnSelect={false}
                classNamePrefix="pmc-select"
                options={employeeOptions}
                styles={platformSelectStyles}
                value={employeeOptions.filter((o) => (v.additionalstaff || []).includes(o.value))}
                onChange={(selected) => set({ ...v, additionalstaff: selected ? selected.map((o) => o.value) : [] })}
                placeholder="Search and select employee(s)…"
                noOptionsMessage={() => 'No PHMC employees match.'}
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
                  checked={!!v.ReportRequested}
                  onChange={(e) => set({ ...v, ReportRequested: e.target.checked })}
                />
                REPORT REQUESTED?
              </label>
            </div>
            <div className={`request-details${v.ReportRequested ? ' has-officer' : ''}`}>
              {v.ReportRequested ? (
                <Field label="REQUESTING OFFICER">
                  <input
                    type="text"
                    value={v.requestingOfficer}
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
            {v.ReportRequested && onOpenGuide ? (
              <button type="button" className="pmc-guide-link" onClick={onOpenGuide}>
                {normalizeDepartment(v.department) === 'lspd'
                  ? '✉ LSPD notices now go via the portal, not forum PM — how this works'
                  : '✉ How does the coroner email reach the department? — quick guide'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card">
        <h2><span className="ic" aria-hidden="true">○</span>Decedent &amp; Findings</h2>
        <div className="body">
          <div className="form-grid">
            <Field label="DECEDENT NAME" req>
              <input
                type="text"
                value={v.decedentName}
                placeholder="Full Name (PK → John/Jane Doe)"
                onChange={(e) => set({ ...v, decedentName: e.target.value })}
              />
            </Field>
            <Field label="OOC NAME">
              <input type="text" value={v.decedentOOC} placeholder="OOC Name" onChange={(e) => set({ ...v, decedentOOC: e.target.value })} />
            </Field>
            <Field label="TYPE OF DEATH">
              <select
                value={v.typeOfDeath}
                onChange={(e) => set({
                  ...v,
                  typeOfDeath: e.target.value,
                  decedentName: e.target.value === 'PK' && !v.decedentName ? 'John Doe' : v.decedentName,
                })}
              >
                {TYPE_OF_DEATH_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="MANNER OF DEATH">
              <select value={v.mannerOfDeath} onChange={(e) => set({ ...v, mannerOfDeath: e.target.value })}>
                {MANNER_OF_DEATH_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="PROBABLE CAUSE" full>
              <input
                type="text"
                value={v.probableCauseOfDeath}
                placeholder="Cause of death"
                onChange={(e) => set({ ...v, probableCauseOfDeath: e.target.value })}
              />
            </Field>
            <Field label="CASE SYNOPSIS" full>
              <textarea
                value={v.synopsis}
                placeholder="What did you find on scene? Condition of the decedent?"
                onChange={(e) => set({ ...v, synopsis: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="card">
        <h2><span className="ic" aria-hidden="true">◍</span>Evidence &amp; Photos</h2>
        <div className="body">
          <div className="form-grid">
            <div className="field">
              <label className="checkrow">
                <input
                  type="checkbox"
                  checked={!!v.evidenceLocker}
                  onChange={(e) => set({ ...v, evidenceLocker: e.target.checked })}
                />
                EVIDENCE LOCKER USED?
              </label>
            </div>
            {v.evidenceLocker ? (
              <Field label="LOCKER REFS" full>
                <input
                  type="text"
                  value={v.evidenceLockerItems}
                  placeholder="EL#REF-CODE"
                  onChange={(e) => set({ ...v, evidenceLockerItems: e.target.value })}
                />
              </Field>
            ) : null}
            <Field label="SCENE PHOTO URLs (one per line — body only)" full>
              <textarea
                style={{ minHeight: 56 }}
                value={(v.scenePhotosBBCode || []).join('\n')}
                placeholder="https://…"
                onChange={urls(v, set, 'scenePhotosBBCode')}
              />
            </Field>
            <Field label="MORGUE SCREENSHOT URLs (one per line)" full>
              <textarea
                style={{ minHeight: 56 }}
                value={(v.additionalPhotos || []).join('\n')}
                placeholder="https://…"
                onChange={urls(v, set, 'additionalPhotos')}
              />
            </Field>
            <Field label="PHOTO NOTES" full>
              <input
                type="text"
                value={v.additionalPhotos_narrative}
                placeholder="Optional caption"
                onChange={(e) => set({ ...v, additionalPhotos_narrative: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </div>

      {map.modal}
    </>
  );
}
