// Migration UI — raw-data report detail cards (no BBCode).
import React from 'react';
import { DEPARTMENT_NAMES, formatDateTimeUTC, coronerTitle, massTitle, autopsyTitle } from './viewModel';

const Row = ({ label, value, cls }) => (
  <div className="mig-row"><div className="mig-lbl">{label}</div><div className={`mig-val${cls ? ` ${cls}` : ''}`}>{value}</div></div>
);
const Card = ({ heading, tag, children }) => (
  <div className="mig-card"><h2>{heading}{tag ? <span className="tag">{tag}</span> : null}</h2><div className="body">{children}</div></div>
);
const PhotoGrid = ({ label, urls }) => (
  <div className="mig-row"><div className="mig-lbl">{label} ({(urls || []).length})</div>
    {urls && urls.length
      ? <div className="mig-photos">{urls.map((u, i) => <div className="mig-photo" key={i}><img src={u} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} /><div className="cap">{u}</div></div>)}</div>
      : <div className="mig-val">—</div>}
  </div>
);
const ListRows = ({ label, items }) => (
  items && items.filter(Boolean).length
    ? <div className="mig-row"><div className="mig-lbl">{label} ({items.filter(Boolean).length})</div>
      <ol style={{ margin: '2px 0 0 18px' }}>{items.filter(Boolean).map((x, i) => <li key={i}>{x}</li>)}</ol></div>
    : null
);

function CoronerDetail({ v }) {
  return (
    <>
      <Card heading="Details"><div className="mig-grid2"><div>
        <Row label="DECEDENT" value={v.decedentName || '—'} cls="red" />
        <Row label="OOC NAME" value={v.decedentOOC || '—'} />
        <Row label="DISPATCHED" value={formatDateTimeUTC(v.dateTime)} />
        <Row label="TIME OF DEATH" value={formatDateTimeUTC(v.pronouncedTimeOfDeath)} />
        <Row label="PLACE OF DEATH" value={v.placeOfDeath || '—'} />
      </div><div>
        <Row label="REPORTING OFFICER" value={v.coronerEmployee || '—'} />
        <Row label="RANK / BADGE" value={`${v.coronerRank || '—'} · SN: ${v.coronerBadge || '—'}`} />
        <Row label="REQUESTING DEPARTMENT" value={DEPARTMENT_NAMES[String(v.department || '').toLowerCase()] || v.department || '—'} />
        {v.ReportRequested ? <Row label="REQUESTING OFFICER" value={v.requestingOfficer || '—'} /> : null}
        {(v.additionalstaff || []).length ? <Row label="ASSISTING STAFF" value={(v.additionalstaff || []).join(', ')} /> : null}
      </div></div></Card>
      <Card heading="Findings"><div className="mig-grid3">
        <Row label="TYPE OF DEATH" value={v.typeOfDeath || '—'} />
        <Row label="MANNER OF DEATH" value={v.mannerOfDeath || '—'} />
        <Row label="PROBABLE CAUSE" value={v.probableCauseOfDeath || '—'} />
      </div>
        <div style={{ marginTop: 12 }}><Row label="CASE SYNOPSIS" value={v.synopsis || '—'} cls="long" /></div>
      </Card>
      <Card heading="Evidence & Photos">
        <Row label="EVIDENCE LOCKER" value={v.evidenceLocker ? `Used — ${v.evidenceLockerItems || 'no refs listed'}` : 'Not used'} />
        <PhotoGrid label="SCENE PHOTOS" urls={v.scenePhotosBBCode} />
        <PhotoGrid label="MORGUE SCREENSHOTS" urls={v.additionalPhotos} />
        {v.additionalPhotos_narrative ? <Row label="PHOTO NOTES" value={v.additionalPhotos_narrative} cls="long" /> : null}
      </Card>
      <Card heading="Out of Character"><div className="mig-grid3">
        <Row label="TYPE OF DEATH" value={v.typeOfDeath || '—'} />
        <Row label="PLAYER OOC NAME" value={v.decedentOOC || '—'} />
        <Row label="RECORD" value="Internal only — not evidence" />
      </div></Card>
    </>
  );
}

function MassDetail({ m }) {
  return (
    <>
      <Card heading="Incident"><div className="mig-grid2"><div>
        <Row label="INCIDENT LOCATION" value={m.placeOfDeath || '—'} cls="red" />
        <Row label="DISPATCH TIME" value={formatDateTimeUTC(m.dateTime)} />
      </div><div>
        <Row label="REPORTING OFFICER" value={m.coronerEmployee || '—'} />
        <Row label="RANK / BADGE" value={`${m.coronerRank || '—'} · SN: ${m.coronerBadge || '—'}`} />
        <Row label="REQUESTING DEPARTMENT" value={DEPARTMENT_NAMES[String(m.department || '').toLowerCase()] || m.department || '—'} />
        <Row label="REQUESTING OFFICER" value={m.requestingOfficer || '—'} />
      </div></div>
        <div style={{ marginTop: 12 }}><Row label="SCENE OVERVIEW" value={m.synopsis || '—'} cls="long" /></div>
      </Card>
      {(m.decedents || []).map((d, i) => (
        <Card key={i} heading={`Decedent ${i + 1} — ${d.decedentName || '?'}`} tag={d.decedentOOC || ''}>
          <div className="mig-grid3">
            <Row label="TYPE OF DEATH" value={d.typeOfDeath || '—'} />
            <Row label="MANNER OF DEATH" value={d.mannerOfDeath || '—'} />
            <Row label="PROBABLE CAUSE" value={d.probableCauseOfDeath || '—'} />
          </div>
          <div style={{ marginTop: 12 }}><Row label="PRONOUNCED TIME OF DEATH" value={formatDateTimeUTC(d.pronouncedTimeOfDeath)} /></div>
          <Row label="INJURIES / NOTES" value={d.synopsis || '—'} cls="long" />
          <Row label="EVIDENCE LOCKER" value={d.evidenceLockerID ? `Used — ${d.evidenceLockerID}` : 'Not used'} />
          {d.decedentLocation && d.decedentLocation !== m.placeOfDeath ? <Row label="DECEDENT LOCATION" value={d.decedentLocation} /> : null}
          {(d.morgueStatus === true || d.morgueStatus === 'true') ? <Row label="MORGUE STATUS" value="Morgue screen photo currently unavailable" cls="warn" /> : null}
          <PhotoGrid label="SCENE PHOTOS" urls={d.scenePhotos} />
          <PhotoGrid label="OOC IMAGES (INTERNAL — NOT EVIDENCE)" urls={d.additionalImages} />
        </Card>
      ))}
    </>
  );
}

function AutopsyDetail({ a }) {
  return (
    <>
      <Card heading="Decedent"><div className="mig-grid3">
        <Row label="FULL NAME" value={a.decedentName || '—'} cls="red" />
        <Row label="OOC NAME" value={a.decedentOOC || '—'} />
        <Row label="SEX" value={a.sex || '—'} />
        <Row label="DNA PROFILE" value={a.dnaProfile || '—'} />
        <Row label="PLACE OF DEATH" value={a.placeOfDeath || '—'} />
        <Row label="DATE OF AUTOPSY" value={formatDateTimeUTC(a.autopsyStartTime)} />
      </div></Card>
      <Card heading="Cause & Manner">
        <ListRows label="CAUSE OF DEATH" items={a.deathCausesListItems} />
        <div className="mig-grid2" style={{ marginTop: 10 }}>
          <Row label="HOW INJURY OCCURRED" value={a.causeOfDeath || '—'} />
          <Row label="MANNER OF DEATH" value={a.deathType || '—'} />
        </div>
      </Card>
      <Card heading="Examination">
        <ListRows label="ANATOMIC SUMMARY" items={a.anatomicSummaryListItems} />
        <div style={{ marginTop: 10 }}><Row label="EXTERNAL EXAMINATION" value={a.externalExamination || '—'} cls="long" /></div>
        <Row label="RADIOLOGY" value={a.RadiologyResult || '—'} />
        <ListRows label="CASINGS / METAL OBJECTS RECOVERED" items={a.casings} />
      </Card>
      <Card heading="Toxicology"><div className="mig-grid2">
        <Row label="BAC LEVEL" value={a.bacLevel || '—'} />
        <Row label="NARCOTIC TRACES" value={a.narcoticTraces || '—'} />
      </div></Card>
      <Card heading="Opinion" tag="Medical Examiner's synopsis">
        <Row label="OPINION" value={a.synopsis || '—'} cls="long" />
      </Card>
      <Card heading="Photography & Diagram">
        <PhotoGrid label="DECEDENT PHOTOGRAPHY" urls={a.decedentPhotography ? a.decedentPhotographyImages : []} />
        <PhotoGrid label="AUTOPSY DIAGRAM" urls={a.autopsyDiagram} />
      </Card>
    </>
  );
}

export default function ReportDetail({ kind, values }) {
  if (kind === 'mass') return <MassDetail m={values} />;
  if (kind === 'autopsy') return <AutopsyDetail a={values} />;
  return <CoronerDetail v={values} />;
}

export function detailTitle(kind, values) {
  if (kind === 'mass') return massTitle(values);
  if (kind === 'autopsy') return autopsyTitle(values);
  return coronerTitle(values);
}
