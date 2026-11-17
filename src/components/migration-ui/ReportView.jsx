// Migration UI — single-report view, 1:1 with mock-site.html #view-report:
// dataset switcher, title/sub pills, Overview / Photos / History tabs, raw
// payload. Data comes from the live saved-reports API.
//
// `readOnly` is the shared-link variant (route #/report/<author>/<key>, see
// components/report-share/): one report, no dataset switcher, no back button
// and no raw payload — someone following an outside link must not be able to
// pivot into any other report and must not see the internal record shape.
import React, { useMemo, useState } from 'react';
import ReportDetail, {
  AutopsyCaseInformation, Card, PhotoGroups, reportHistory, reportPhotoCount, reportPhotoGroups,
} from './ReportDetail';
import { formatDateTimeUTC } from './viewModel';
import { useNotification } from '../../contexts/NotificationContext';
import { copyReportShareLink } from '../report-share/shareAction';

const KIND_PREFIX = { coroner: 'Coroner Report — ', mass: 'Mass Fatality — ', autopsy: 'Autopsy — ', email: 'Coroner Email — ' };
const DATASETS = [
  { kind: 'coroner', label: 'Coroner' },
  { kind: 'mass', label: 'Mass Fatality' },
  { kind: 'autopsy', label: 'Autopsy' },
];

function subtitleFor(kind, values = {}) {
  const pills = kind === 'mass'
    ? ['Mass Fatality', `${(values.decedents || []).length} decedents`]
    : kind === 'autopsy'
      ? ['Autopsy', values.deathType, values.caseStatusOptions]
      : [values.typeOfDeath, values.mannerOfDeath];
  const when = kind === 'autopsy' ? values.autopsyStartTime : values.dateTime;
  const verb = kind === 'autopsy' ? 'Examined by' : 'Reported by';
  return (
    <>
      {pills.filter(Boolean).map((p, i) => <span className="pill" key={`${p}-${i}`}>{p}</span>)}
      <span>{verb} {values.coronerEmployee || '—'} · {formatDateTimeUTC(when)}</span>
    </>
  );
}

export default function ReportView({
  kind, values, title, meta = {}, notice = '', onSwitchDataset, onBack, readOnly = false,
  author = '', reportKey = '',
}) {
  const { showNotification } = useNotification();
  const [tab, setTab] = useState('overview');
  const [sharing, setSharing] = useState(false);
  const photoGroups = useMemo(() => reportPhotoGroups(kind, values), [kind, values]);
  const photoCount = useMemo(() => reportPhotoCount(kind, values), [kind, values]);
  const history = useMemo(() => reportHistory(kind, values, meta), [kind, values, meta]);
  const hasPhotos = photoGroups.some((g) => (g.urls || []).length);

  const shareLink = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      await copyReportShareLink({
        author, key: reportKey, formId: values?.formId || '', showNotification,
      });
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="wrap">
      {readOnly ? null : (
        <div className="switchrow">
          <button type="button" className="btn ghost" onClick={onBack}>← Back to records</button>
          <span className="cap" style={{ marginLeft: 6 }}>REPORT DATASET:</span>
          <div className="tabs rep-switch">
            {DATASETS.map((d) => (
              <button
                key={d.kind}
                type="button"
                className={kind === d.kind ? 'active' : ''}
                onClick={() => onSwitchDataset?.(d.kind)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {notice ? <div className="notice warn">{notice}</div> : null}

      <div className="report-title">{KIND_PREFIX[kind] || ''}{title}</div>
      <div className="report-sub">{subtitleFor(kind, values)}</div>

      <div className="tabs">
        <button type="button" className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>
          ▤ Overview
        </button>
        <button type="button" className={tab === 'photos' ? 'active' : ''} onClick={() => setTab('photos')}>
          ◍ Photos<span className="n">{photoCount}</span>
        </button>
        <button type="button" className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          ◷ History<span className="n">{history.length}</span>
        </button>
        <button
          type="button"
          onClick={shareLink}
          disabled={sharing}
          title="Copy a short share link for this report"
          style={{ marginLeft: 6, color: 'var(--teal)' }}
        >
          {sharing ? '…' : '⤴ Share'}
        </button>
      </div>

      {tab === 'overview' && (
        <>
          {kind === 'autopsy'
            ? <AutopsyCaseInformation values={values} caseUrl={values.caseUrl || ''} />
            : null}
          <ReportDetail kind={kind} values={values} />
        </>
      )}

      {tab === 'photos' && (
        <Card icon="◍" heading="All photos">
          {hasPhotos
            ? <PhotoGroups groups={photoGroups} />
            : <div className="empty">No photos attached to this report.</div>}
        </Card>
      )}

      {tab === 'history' && (
        <Card icon="◷" heading="History">
          {history.length
            ? history.map((entry, i) => (
              <div className="hist" key={`${entry.title}-${i}`}>
                <div className="dot" />
                <div>
                  <div className="t">{entry.title}</div>
                  <div className="d">{entry.detail}</div>
                </div>
              </div>
            ))
            : <div className="empty">No history recorded.</div>}
        </Card>
      )}

      {readOnly ? null : (
        <details className="raw" style={{ marginTop: 18 }}>
          <summary>Raw payload (what the API stores / returns)</summary>
          <pre>{JSON.stringify({ kind, title, ...values }, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
