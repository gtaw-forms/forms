// Migration UI — raw-data report detail cards (no BBCode).
// 1:1 with plan/coroner-report-handoff/mock-site.html: same card order, icons,
// row labels, photo groups, history entries and empty-value collapsing.
import React, { useState } from 'react';
import {
  agencyLabel, formatDateTimeUTC, formatTimestampShortUTC, formatTimestampUTC,
  isTruthyFlag, massDate, recordTitle,
} from './viewModel';
import { buildLspdCondensedEmail } from '../../utils/lspdCondensedNotice';

const EMPTY = '—';

export const Row = ({ label, value, cls }) => (
  <div className="row">
    <div className="lbl">{label}</div>
    <div className={`val${cls ? ` ${cls}` : ''}`}>{value === '' || value == null ? EMPTY : value}</div>
  </div>
);

export const Card = ({ icon, heading, tag, children }) => (
  <div className="card">
    <h2>
      {icon ? <span className="ic" aria-hidden="true">{icon}</span> : null}
      {heading}
      {tag ? <span className="tag">{tag}</span> : null}
    </h2>
    <div className="body">{children}</div>
  </div>
);

export const PhotoTile = ({ url, tag }) => {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  const caption = /^data:/i.test(String(url || ''))
    ? 'Embedded image'
    : (String(url || '').length > 110 ? `${String(url).slice(0, 110)}…` : url);
  return (
    <>
      <div className="photo">
        <div
          className={`thumb${broken ? ' broken' : ''}`}
          role="button"
          tabIndex={0}
          title={broken ? 'Image unavailable' : 'Open larger'}
          onClick={() => { if (!broken) setOpen(true); }}
          onKeyDown={(e) => {
            if (!broken && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(true); }
          }}
        >
          <span className="ph" aria-hidden="true">◍</span>
          <img
            src={url}
            alt={tag}
            loading="lazy"
            onError={(e) => { setBroken(true); e.currentTarget.style.display = 'none'; }}
          />
        </div>
        <div className="cap" title={String(url || '')}><b>{tag}</b>{caption}</div>
      </div>
      {open && !broken ? (
        <div className="photo-lightbox" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <button type="button" onClick={() => setOpen(false)}>Close</button>
          <img src={url} alt={tag} onClick={(e) => e.stopPropagation()} />
        </div>
      ) : null}
    </>
  );
};

export const PhotoGrid = ({ label, urls, tag }) => {
  const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
  return (
    <div className="row">
      <div className="lbl">{label} ({list.length})</div>
      {list.length
        ? <div className="photos">{list.map((u, i) => <PhotoTile key={`${u}-${i}`} url={u} tag={`${tag} ${i + 1}`} />)}</div>
        : <div className="val">{EMPTY}</div>}
    </div>
  );
};

/** Side-by-side photo groups (Scene | Morgue screenshots etc.). */
export const PhotoGroups = ({ groups }) => (
  <div className="photo-groups">
    {(groups || []).map((group) => (
      <PhotoGrid key={group.label} label={group.label} urls={group.urls} tag={group.tag} />
    ))}
  </div>
);

export const ListRows = ({ label, items }) => {
  const list = (Array.isArray(items) ? items : []).filter((x) => String(x || '').trim());
  if (!list.length) return null;
  return (
    <div className="row">
      <div className="lbl">{label} ({list.length})</div>
      <ol className="tight">{list.map((x, i) => <li key={i}>{x}</li>)}</ol>
    </div>
  );
};

const Chips = ({ label, items }) => {
  const list = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!list.length) return null;
  return (
    <div className="row">
      <div className="lbl">{label}</div>
      <div className="chiprow">{list.map((s, i) => <span className="chip" key={`${s}-${i}`}>{s}</span>)}</div>
    </div>
  );
};

const rankBadge = (v) => `${v.coronerRank || EMPTY} · SN: ${v.coronerBadge || EMPTY}`;

function CoronerDetail({ v }) {
  return (
    <>
      <Card icon="▤" heading="Details">
        <div className="grid2">
          <div className="accent-left">
            <Row label="DECEDENT" value={v.decedentName} cls="red" />
            <Row label="OOC NAME" value={v.decedentOOC} />
            <Row label="DISPATCHED" value={formatDateTimeUTC(v.dateTime)} />
            <Row label="TIME OF DEATH" value={formatDateTimeUTC(v.pronouncedTimeOfDeath)} />
            <Row label="PLACE OF DEATH" value={v.placeOfDeath} />
          </div>
          <div>
            <Row label="REPORTING OFFICER" value={v.coronerEmployee} />
            <Row label="RANK / BADGE" value={rankBadge(v)} />
            <Row label="REQUESTING DEPARTMENT" value={agencyLabel(v.department)} />
            {isTruthyFlag(v.ReportRequested) ? <Row label="REQUESTING OFFICER" value={v.requestingOfficer || EMPTY} /> : null}
            <Chips label="ASSISTING STAFF" items={v.additionalstaff} />
          </div>
        </div>
      </Card>

      <Card icon="✚" heading="Findings">
        <div className="grid3">
          <Row label="TYPE OF DEATH" value={v.typeOfDeath} />
          <Row label="MANNER OF DEATH" value={v.mannerOfDeath} />
          <Row label="PROBABLE CAUSE" value={v.probableCauseOfDeath} />
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <div className="lbl">CASE SYNOPSIS</div>
          <div className="val long">{v.synopsis || EMPTY}</div>
        </div>
      </Card>

      <Card icon="◍" heading="Evidence & Photos">
        <Row
          label="EVIDENCE LOCKER"
          value={isTruthyFlag(v.evidenceLocker)
            ? `Used — ${v.evidenceLockerItems || 'no refs listed'}`
            : 'Not used'}
        />
        <PhotoGroups
          groups={[
            { label: 'SCENE PHOTOS', urls: v.scenePhotosBBCode, tag: 'Scene photo' },
            { label: 'MORGUE SCREENSHOTS', urls: v.additionalPhotos, tag: 'Morgue' },
          ]}
        />
        {v.additionalPhotos_narrative
          ? (
            <div className="row">
              <div className="lbl">PHOTO NOTES</div>
              <div className="val long">{v.additionalPhotos_narrative}</div>
            </div>
          ) : null}
      </Card>

      <Card icon="♡" heading="Out of Character">
        <div className="grid2">
          <Row label="TYPE OF DEATH" value={v.typeOfDeath} />
          <Row label="PLAYER OOC NAME" value={v.decedentOOC} />
        </div>
      </Card>
    </>
  );
}

function MassDetail({ m }) {
  const requested = String(m.requestingOfficer || '').length > 0;
  const officerName = String(m.requestingOfficer || '').trim();
  return (
    <>
      <Card icon="▤" heading="Incident">
        <div className="grid2">
          <div className="accent-left">
            <Row label="INCIDENT LOCATION" value={m.placeOfDeath} cls="red" />
            <Row label="DISPATCH TIME" value={formatDateTimeUTC(m.dateTime)} />
          </div>
          <div>
            <Row label="REPORTING OFFICER" value={m.coronerEmployee} />
            <Row label="RANK / BADGE" value={rankBadge(m)} />
            <Row label="REQUESTING DEPARTMENT" value={agencyLabel(m.department)} />
            <Row label="REQUESTING OFFICER" value={requested ? (officerName || 'Requested — no name recorded') : 'Not requested'} />
          </div>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <div className="lbl">SCENE OVERVIEW</div>
          <div className="val long">{m.synopsis || EMPTY}</div>
        </div>
      </Card>

      {(m.decedents || []).map((d, i) => {
        const morgueUnavailable = d.morgueStatus === true || d.morgueStatus === 'true';
        return (
          <Card
            key={i}
            icon="○"
            heading={`Decedent ${i + 1} — ${d.decedentName || '?'}`}
            tag={d.decedentOOC || ''}
          >
            <div className="grid3">
              <Row label="TYPE OF DEATH" value={d.typeOfDeath} />
              <Row label="MANNER OF DEATH" value={d.mannerOfDeath} />
              <Row label="PROBABLE CAUSE" value={d.probableCauseOfDeath} />
            </div>
            <div className="row" style={{ marginTop: 14 }}>
              <div className="lbl">PRONOUNCED TIME OF DEATH</div>
              <div className="val">{formatDateTimeUTC(d.pronouncedTimeOfDeath)}</div>
            </div>
            <div className="row">
              <div className="lbl">INJURIES / NOTES</div>
              <div className="val long">{d.synopsis || EMPTY}</div>
            </div>
            <Row label="EVIDENCE LOCKER" value={d.evidenceLockerID ? `Used — ${d.evidenceLockerID}` : 'Not used'} />
            {d.decedentLocation && d.decedentLocation !== m.placeOfDeath
              ? <Row label="DECEDENT LOCATION" value={d.decedentLocation} /> : null}
            {morgueUnavailable
              ? <Row label="MORGUE STATUS" value="Morgue screen photo currently unavailable" cls="warn" /> : null}
            <PhotoGrid label="SCENE PHOTOS" urls={d.scenePhotos} tag="Scene photo" />
            {d.scenePhotos_narrative
              ? (
                <div className="row">
                  <div className="lbl">SCENE PHOTO NOTES</div>
                  <div className="val long">{d.scenePhotos_narrative}</div>
                </div>
              ) : null}
            <PhotoGrid label="OOC IMAGES (INTERNAL — NOT EVIDENCE)" urls={d.additionalImages} tag="OOC" />
            {d.additionalImages_narrative
              ? (
                <div className="row">
                  <div className="lbl">OOC PHOTO NOTES</div>
                  <div className="val long">{d.additionalImages_narrative}</div>
                </div>
              ) : null}
          </Card>
        );
      })}
    </>
  );
}

function AutopsyDetail({ a }) {
  return (
    <>
      <Card icon="▤" heading="Decedent">
        <div className="grid3">
          <Row label="FULL NAME" value={a.decedentName} cls="red" />
          <Row label="OOC NAME" value={a.decedentOOC} />
          <Row label="SEX" value={a.sex} />
          <Row label="DNA PROFILE" value={a.dnaProfile} />
          <Row label="PLACE OF DEATH" value={a.placeOfDeath} />
          <Row label="DATE OF AUTOPSY" value={formatDateTimeUTC(a.autopsyStartTime)} />
        </div>
      </Card>

      <Card icon="✚" heading="Cause & Manner">
        <ListRows label="CAUSE OF DEATH" items={a.deathCausesListItems} />
        <div className="grid2" style={{ marginTop: 12 }}>
          <Row label="HOW INJURY OCCURRED" value={a.causeOfDeath} />
          <Row label="MANNER OF DEATH" value={a.deathType} />
        </div>
      </Card>

      <Card icon="◍" heading="Examination">
        <ListRows label="ANATOMIC SUMMARY" items={a.anatomicSummaryListItems} />
        <div className="row" style={{ marginTop: 12 }}>
          <div className="lbl">EXTERNAL EXAMINATION</div>
          <div className="val long">{a.externalExamination || EMPTY}</div>
        </div>
        <Row label="RADIOLOGY" value={a.RadiologyResult} />
        <ListRows label="CASINGS / METAL OBJECTS RECOVERED" items={a.casings} />
      </Card>

      <Card icon="♦" heading="Toxicology">
        <div className="grid2">
          <Row label="BAC LEVEL" value={a.bacLevel} />
          <Row label="NARCOTIC TRACES" value={a.narcoticTraces} />
        </div>
      </Card>

      <Card icon="♡" heading="Opinion" tag="Medical Examiner's synopsis">
        <div className="row">
          <div className="lbl">OPINION</div>
          <div className="val long">{a.synopsis || EMPTY}</div>
        </div>
      </Card>

      <Card icon="◍" heading="Photography & Diagram">
        <PhotoGrid
          label="DECEDENT PHOTOGRAPHY"
          urls={isTruthyFlag(a.decedentPhotography) ? a.decedentPhotographyImages : []}
          tag="Autopsy"
        />
        <PhotoGrid label="AUTOPSY DIAGRAM" urls={a.autopsyDiagram} tag="Diagram" />
      </Card>
    </>
  );
}

/**
 * Case Information for autopsy reports — mirrors the prototype's "View Case
 * Info" rows (decedent, case/status, assigned ME, requester, DOD/TOD, location,
 * faction, morgue link, synopsis), derived from the saved report values.
 */
export function AutopsyCaseInformation({ values = {}, caseUrl = '' }) {
  const v = values || {};
  const decedent = [v.decedentName, v.decedentOOC ? `((${v.decedentOOC}))` : '']
    .filter(Boolean).join(' ') || EMPTY;
  const rows = [
    ['DECEDENT', decedent],
    ['CASE', v.caseNumber ? `Case #${v.caseNumber}` : EMPTY],
    ['STATUS', v.caseStatusOptions || EMPTY],
    ['ASSIGNED TO', v.assignedTo || v.assignedME || v.coronerEmployee || EMPTY],
    ['REQUESTER', v.Requester || v.requestingOfficer || EMPTY],
    ['DOD / TOD', [v.dateTime, v.timeOfDeath].filter(Boolean).join(' ') || EMPTY],
    ['AUTOPSY DATE', formatDateTimeUTC(v.autopsyStartTime)],
    ['LOCATION', v.placeOfDeath || EMPTY],
    ['FACTION', agencyLabel(v.department)],
    ['MORGUE RECORD', v.morgueCaseId ? `#${v.morgueCaseId}` : (v.morgueRecord || EMPTY)],
  ];
  return (
    <Card icon="▤" heading="Case Information" tag={caseUrl ? 'Linked case' : undefined}>
      <div className="grid2">
        {rows.map(([label, value]) => <Row key={label} label={label} value={value} />)}
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <div className="lbl">SYNOPSIS</div>
        <div className="val long">{v.synopsis || EMPTY}</div>
      </div>
      {caseUrl ? (
        <div className="row" style={{ marginTop: 14 }}>
          <a
            className="btn ghost"
            href={caseUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}
          >
            Open case thread
          </a>
        </div>
      ) : null}
    </Card>
  );
}

export default function ReportDetail({ kind, values }) {
  const v = values || {};
  if (kind === 'mass') return <MassDetail m={v} />;
  if (kind === 'autopsy') return <AutopsyDetail a={v} />;
  if (kind === 'email') return <EmailDetail v={v} />;
  return <CoronerDetail v={v} />;
}

function EmailDetail({ v = {} }) {
  const attached = Array.isArray(v.additionalReports) && v.additionalReports.length > 0
    ? v.additionalReports[0]
    : null;
  return (
    <>
      <Card icon="✉" heading="Recipient">
        <div className="grid2">
          <div className="accent-left">
            <Row label="REQUESTING OFFICER" value={v.requestingOfficer} />
            <Row label="DEPARTMENT" value={agencyLabel(v.department)} />
          </div>
          <div>
            <Row label="DECEDENT" value={v.decedentName} />
            <Row label="OOC NAME" value={v.decedentOOC} />
          </div>
        </div>
      </Card>

      <Card icon="▤" heading="Attached report">
        {attached
          ? (
            <>
              <Row label="TITLE" value={attached.originalKey} />
              <Row label="TYPE" value={attached.formId} />
            </>
          )
          : <div className="empty">No report attached — the notice carries no link.</div>}
      </Card>
    </>
  );
}

/** Photo groups for the Photos tab (same grouping as the mock). */
export function reportPhotoGroups(kind, values = {}) {
  if (kind === 'mass') {
    const groups = [];
    (values.decedents || []).forEach((d, i) => {
      groups.push({
        label: `DECEDENT ${i + 1} — ${d.decedentName || '?'} · SCENE`,
        urls: d.scenePhotos || [],
        tag: 'Scene',
      });
      groups.push({
        label: `DECEDENT ${i + 1} — OOC`,
        urls: d.additionalImages || [],
        tag: 'OOC',
      });
    });
    return groups;
  }
  if (kind === 'autopsy') {
    return [
      { label: 'DECEDENT PHOTOGRAPHY', urls: (isTruthyFlag(values.decedentPhotography) ? values.decedentPhotographyImages : []) || [], tag: 'Autopsy' },
      { label: 'AUTOPSY DIAGRAM', urls: values.autopsyDiagram || [], tag: 'Diagram' },
    ];
  }
  return [
    { label: 'SCENE PHOTOS', urls: values.scenePhotosBBCode || [], tag: 'Scene photo' },
    { label: 'MORGUE SCREENSHOTS', urls: values.additionalPhotos || [], tag: 'Morgue' },
  ];
}

export function reportPhotoCount(kind, values = {}) {
  return reportPhotoGroups(kind, values).reduce((n, g) => n + (g.urls || []).length, 0);
}

/**
 * History entries. Built from real values + saved-report metadata; the mock's
 * fabricated timestamps are not invented here.
 */
export function reportHistory(kind, values = {}, meta = {}) {
  const entries = [];
  const v = values;
  const reportDate = kind === 'mass' ? massDate(v) : (v.date || '');
  const employee = v.coronerEmployee || 'Unknown ME';

  if (kind === 'mass') {
    const count = (v.decedents || []).length;
    entries.push({
      title: `Mass fatality filed by ${employee} (${count} decedent${count === 1 ? '' : 's'})`,
      detail: `${reportDate || EMPTY} · Mass Fatality Report`,
    });
    const lockers = (v.decedents || []).map((d) => d.evidenceLockerID).filter(Boolean);
    entries.push({
      title: `Evidence logged — ${lockers.length ? lockers.join(', ') : 'none'}`,
      detail: `${reportDate || EMPTY} · Evidence locker`,
    });
  } else if (kind === 'autopsy') {
    const count = (v.casings || []).filter(Boolean).length;
    entries.push({
      title: `Autopsy completed by ${employee}`,
      detail: `${formatDateTimeUTC(v.autopsyStartTime)} · Autopsy Report`,
    });
    entries.push({
      title: `${count} projectile${count === 1 ? '' : 's'} recovered via fluoroscopy`,
      detail: `${formatDateTimeUTC(v.autopsyStartTime)} · Radiology`,
    });
  } else {
    entries.push({
      title: `Report filed by ${employee}`,
      detail: `${reportDate || EMPTY} · Coroner Report`,
    });
    entries.push({
      title: `Evidence — ${isTruthyFlag(v.evidenceLocker) ? (v.evidenceLockerItems || 'locker used, no refs') : 'locker not used'}`,
      detail: `${reportDate || EMPTY} · Evidence locker`,
    });
  }

  if (meta.savedAt) {
    entries.push({
      title: 'Saved to PHMC records',
      detail: `${formatTimestampUTC(meta.savedAt)} · Saved report`,
    });
  }
  if (meta.updatedAt && meta.updatedAt !== meta.savedAt) {
    entries.push({
      title: 'Last updated',
      detail: `${formatTimestampShortUTC(meta.updatedAt)} · Saved report`,
    });
  }
  return entries;
}

export function detailTitle(kind, values) {
  if (kind === 'email') {
    try {
      return buildLspdCondensedEmail(values || {}).finalTitle;
    } catch {
      return 'Coroner Email';
    }
  }
  return recordTitle(kind, values);
}
