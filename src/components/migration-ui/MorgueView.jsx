// Migration UI — View Morgue Records.
// Read-only viewer for the live morgue intake store (same data source as the
// morgue lookup: GET /api/morgue behind getMorgueRecords). 1:1 visual language
// with the mock platform: records list, report-style tabs, cards and raw payload.
import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { formatTimestampShortUTC, isLocalPreview } from './viewModel';
import { DEMO_MORGUE_RECORDS } from './demoData';
import { recordContainsCK } from '../../utils/morgue';

const EMPTY = '—';
const norm = (value) => String(value || '').trim();
const isIdentified = (record) => {
  const identified = norm(record?.identified).toLowerCase();
  if (identified === 'no' || identified === 'unknown' || identified === 'n/a') return false;
  if (identified === 'yes' || identified === 'true' || identified === 'identified') return true;
  return !!norm(record?.name);
};

function bulletsOf(record) {
  const bullets = record?.bullets;
  if (!bullets) return [];
  const list = Array.isArray(bullets) ? bullets : [bullets];
  return list.filter(Boolean).map((b) => {
    if (typeof b === 'string') return { type: b, id: '' };
    return { type: b.type || b.kind || 'Unknown', id: b.id || b.number || '' };
  });
}

function Row({ label, value, cls }) {
  return (
    <div className="row">
      <div className="lbl">{label}</div>
      <div className={`val${cls ? ` ${cls}` : ''}`}>{value === '' || value == null ? EMPTY : value}</div>
    </div>
  );
}

function Card({ icon, heading, tag, children }) {
  return (
    <div className="card">
      <h2>
        {icon ? <span className="ic" aria-hidden="true">{icon}</span> : null}
        {heading}
        {tag ? <span className="tag">{tag}</span> : null}
      </h2>
      <div className="body">{children}</div>
    </div>
  );
}

function ListRows({ label, items }) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return null;
  return (
    <div className="row">
      <div className="lbl">{label} ({list.length})</div>
      <ol className="tight">{list.map((item, i) => <li key={i}>{item}</li>)}</ol>
    </div>
  );
}

function FindingsTable({ findings }) {
  const rows = Array.isArray(findings) ? findings.filter(Boolean) : [];
  if (!rows.length) return null;
  return (
    <div className="row">
      <div className="lbl">AUTOPSY FINDINGS ({rows.length})</div>
      <div style={{ overflowX: 'auto', marginTop: 6 }}>
        <table className="morgue-table">
          <thead>
            <tr><th>TIME</th><th>WOUND TYPE</th><th>BODY PART</th><th>DIST.</th></tr>
          </thead>
          <tbody>
            {rows.map((f, i) => (
              <tr key={i}>
                <td className="mono">{f.time || EMPTY}</td>
                <td>{f.type || EMPTY}</td>
                <td>{f.part || EMPTY}</td>
                <td>{f.dist || EMPTY}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MorgueRecordDetail({ record, demo, onBack }) {
  const [tab, setTab] = useState('overview');
  const bullets = bulletsOf(record);
  const oocMatch = String(record.name || '').match(/\(\((.*?)\)\)/);
  const oocName = oocMatch ? oocMatch[1].trim() : '';
  const icName = String(record.name || '').replace(/\(\(.*?\)\)/g, '').trim() || record.name || 'Unknown';
  const title = `Morgue record — Case #${record.caseId || '?'}`;

  return (
    <div className="wrap">
      <div className="switchrow">
        <button type="button" className="btn ghost" onClick={onBack}>← Back to morgue records</button>
        <span className="cap" style={{ marginLeft: 6 }}>MORGUE INTAKE</span>
      </div>

      <div className="report-title">{title}</div>
      <div className="report-sub">
        {demo ? <span className="pill amber">Sample</span> : null}
        {record.sex ? <span className="pill">{record.sex}</span> : null}
        <span className={`pill ${isIdentified(record) ? 'teal' : 'amber'}`}>
          {isIdentified(record) ? 'IDENTIFIED' : record.identified || 'UNIDENTIFIED'}
        </span>
        {oocName ? <span className="pill">OOC {oocName}</span> : null}
        {record.dnaProfile ? <span className="pill">DNA {record.dnaProfile}</span> : null}
      </div>

      {demo ? (
        <div className="notice warn">
          Sample record — local preview only. Fictional morgue intake shown because no morgue
          records are available without OAuth.
        </div>
      ) : null}

      <div className="tabs">
        <button type="button" className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>▤ Overview</button>
        <button type="button" className={tab === 'forensic' ? 'active' : ''} onClick={() => setTab('forensic')}>✚ Forensic</button>
        <button type="button" className={tab === 'raw' ? 'active' : ''} onClick={() => setTab('raw')}>◷ Raw</button>
      </div>

      {tab === 'overview' && (
        <>
          <Card icon="▤" heading="Decedent">
            <div className="grid2">
              <div className="accent-left">
                <Row label="NAME" value={icName} cls="red" />
                <Row label="OOC NAME" value={oocName || EMPTY} />
                <Row label="SEX" value={record.sex} />
                <Row label="IDENTIFIED" value={record.identified} />
                <Row label="LOCATION" value={record.location} />
                <Row label="TIME OF DEATH" value={record.timeOfDeath} />
                <Row label="TIME OF DEATH (ISO)" value={record.timeOfDeathISO} />
                <Row label="CAUSE OF DEATH" value={record.causeOfDeath} />
              </div>
              <div>
                <Row label="DNA PROFILE" value={record.dnaProfile} />
                <Row label="ESTIMATED AGE" value={record.estimatedAge} />
                <Row label="TATTOOS" value={record.tattoos} />
                <Row label="CASE ID" value={`#${record.caseId || '?'}`} />
                {record.source ? <Row label="SOURCE" value={record.source} /> : null}
                <Row label="LAST UPDATED" value={record.lastUpdated ? formatTimestampShortUTC(record.lastUpdated) : EMPTY} />
              </div>
            </div>
          </Card>

          <Card icon="○" heading="Physical description">
            <div className="row">
              <div className="lbl">PHYSICAL DESCRIPTION</div>
              <div className="val long">{record.physicalDescription || EMPTY}</div>
            </div>
            {record.adminNote
              ? (
                <div className="row" style={{ marginTop: 14 }}>
                  <div className="lbl">ADMINISTRATIVE NOTES</div>
                  <div className="val long">{record.adminNote}</div>
                </div>
              ) : null}
          </Card>

          <div className="notice">
            OOC Information — this morgue record is strictly Out of Character. Any use of this
            information In Character requires a formal autopsy request.
          </div>
        </>
      )}

      {tab === 'forensic' && (
        <>
          <div className="notice warn">
            OOC Information — casing identities and the findings below are strictly Out of Character.
            Any use In Character requires a formal autopsy request.
          </div>

          <Card icon="✚" heading="Toxicology">
            <div className="grid2">
              <Row label="BAC LEVEL" value={record.bac} />
              <Row label="NARCOTIC TRACES" value={record.narcotics} />
            </div>
          </Card>

          <Card icon="◍" heading="Ballistics & findings">
            <ListRows
              label="CASINGS / METAL OBJECTS RECOVERED"
              items={bullets.map((b) => (
                `REDACTED STRIATION - REDACTED ${String(b.type || '').toLowerCase().includes('gauge') ? 'PELLET' : 'BULLET'} TYPE`
              ))}
            />
            <FindingsTable findings={record.findings} />
            {!bullets.length && !(record.findings || []).length
              ? <div className="empty">No forensic findings recorded for this case.</div>
              : null}
          </Card>
        </>
      )}

      {tab === 'raw' && (
        <details className="raw" open>
          <summary>Raw payload (what the morgue API returns)</summary>
          <pre>{JSON.stringify(record, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}

export default function MorgueView({ onBackToRecords, isAuthenticated = false }) {
  const { morgueRecords, morgueLoading, loadMorgueRecords, morgueRecordsError } = useData();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all'); // all | identified | unidentified
  const [ckOnly, setCkOnly] = useState(false);
  const [selected, setSelected] = useState(null);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      // Local preview: fictional intake so the view is reviewable without OAuth.
      if (isLocalPreview()) setDemoMode(true);
      return;
    }
    if (!(morgueRecords || []).length) loadMorgueRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && morgueRecordsError && isLocalPreview() && !(morgueRecords || []).length) {
      setDemoMode(true);
    }
  }, [isAuthenticated, morgueRecordsError, morgueRecords]);

  const sourceRecords = useMemo(
    () => (demoMode ? DEMO_MORGUE_RECORDS : (morgueRecords || [])),
    [demoMode, morgueRecords],
  );

  const sorted = useMemo(() => {
    return [...sourceRecords].sort((a, b) => {
      const au = Number(a?.lastUpdated) || 0;
      const bu = Number(b?.lastUpdated) || 0;
      if (au !== bu) return bu - au;
      return String(b?.caseId || '').localeCompare(String(a?.caseId || ''), undefined, { numeric: true });
    });
  }, [sourceRecords]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sorted.filter((record) => {
      const identified = isIdentified(record);
      if (status === 'identified' && !identified) return false;
      if (status === 'unidentified' && identified) return false;
      if (ckOnly && !recordContainsCK(record)) return false;
      if (!needle) return true;
      const hay = [
        record.name, record.caseId, record.location, record.causeOfDeath,
        record.sex, record.dnaProfile, record.identified,
      ].join(' ').toLowerCase();
      return hay.includes(needle);
    });
  }, [sorted, status, query, ckOnly]);

  if (selected) {
    return (
      <MorgueRecordDetail
        record={selected}
        demo={demoMode}
        onBack={() => { setSelected(null); window.scrollTo(0, 0); }}
      />
    );
  }

  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1>Morgue records</h1>
          <p>
            {demoMode
              ? `${filtered.length} sample records · local preview (no OAuth required)`
              : morgueLoading && !sorted.length
                ? 'Loading morgue intake…'
                : `${filtered.length} of ${sorted.length} records · newest intake first`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isAuthenticated ? (
            <button type="button" className="btn ghost" onClick={() => loadMorgueRecords()}>Reload</button>
          ) : null}
          <button type="button" className="btn" onClick={onBackToRecords}>View all records</button>
        </div>
      </div>

      {demoMode ? (
        <div className="notice warn">
          Sample data — local preview only. These fictional intake records show the morgue viewer
          without OAuth; no live morgue data is exposed and nothing is written.
        </div>
      ) : null}

      <div className="tools">
        <input
          type="search"
          value={query}
          placeholder="Search name, case #, location, cause…"
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="tabs rep-switch">
          {[
            { id: 'all', label: 'All' },
            { id: 'identified', label: 'Identified' },
            { id: 'unidentified', label: 'Unidentified' },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              className={status === option.id ? 'active' : ''}
              onClick={() => setStatus(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={ckOnly} onChange={(e) => setCkOnly(e.target.checked)} />
          CK only
        </label>
      </div>

      {morgueRecordsError && !demoMode ? (
        <div className="notice err">
          Morgue records could not be loaded
          {morgueRecordsError === 'auth_failed' ? ' — sign in again.' : ' — try Reload.'}
        </div>
      ) : null}

      {!morgueLoading && (!morgueRecordsError || demoMode) && !filtered.length ? (
        <div className="empty">
          {sorted.length ? 'No morgue records match this filter.' : 'No morgue records available yet.'}
        </div>
      ) : null}

      {filtered.map((record) => (
        <button
          key={record.caseId || record.firebaseKey}
          type="button"
          className="rec"
          onClick={() => { setSelected(record); window.scrollTo(0, 0); }}
        >
          <div className="type"><span className="pill">#{record.caseId || '?'}</span></div>
          <div className="main">
            <div className="t">{record.name || 'Unknown'}</div>
            <div className="d">
              {[record.location, record.timeOfDeath, record.causeOfDeath].filter(Boolean).join(' · ') || 'No intake details'}
            </div>
          </div>
          <div>
            <span className={`pill ${isIdentified(record) ? 'teal' : 'amber'}`}>
              {isIdentified(record) ? 'Identified' : 'Unidentified'}
            </span>
          </div>
          <div className="arrow">›</div>
        </button>
      ))}
    </div>
  );
}
