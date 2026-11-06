// Migration UI — email create form (Coroner Email, hardcoded fields).
// Filing saves a coroner_email record through the normal save flow; the bot
// delivers it (portal notice for LSPD, forum PM otherwise). Attaching a
// report fills decedent/officer/department and gives the notice its link.
import React, { useState } from 'react';
import { DEPARTMENT_OPTIONS, normalizeDepartment } from './viewModel';
import { buildLspdCondensedEmail } from '../../utils/lspdCondensedNotice';

export const emptyEmailValues = () => ({
  requestingOfficer: '',
  department: '',
  decedentName: '',
  decedentOOC: '',
  coronerEmployee: '',
  coronerRank: '',
  coronerBadge: '',
  additionalReports: [],
});

const Field = ({ label, req, full, children }) => (
  <div className={`field${full ? ' full' : ''}`}>
    <label>{label}{req ? <span className="req"> *</span> : null}</label>
    {children}
  </div>
);

export default function CreateEmail({ v, set, reports = [], onAttachReport, onOpenGuide }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const attachedList = Array.isArray(v.additionalReports) ? v.additionalReports : [];
  const attached = attachedList.length > 0 ? attachedList[0] : null;
  const isAttached = (r) => attachedList.some(
    (a) => (a.attachedAuthor || '') === (r.author || '') && (a.attachedKey || '') === (r.key || ''),
  );
  const isLspd = normalizeDepartment(v.department) === 'lspd';
  const preview = isLspd
    ? buildLspdCondensedEmail({ ...v, requestingOfficer: v.requestingOfficer, coronerEmployee: v.coronerEmployee || '', coronerRank: v.coronerRank || '', coronerBadge: v.coronerBadge || '' })
    : null;

  return (
    <>
      <div className="card">
        <h2><span className="ic" aria-hidden="true">✉</span>Recipient</h2>
        <div className="body">
          <div className="form-grid">
            <Field label="REQUESTING OFFICER" req>
              <input
                type="text"
                value={v.requestingOfficer}
                placeholder="Officer character name (exact)"
                onChange={(e) => set({ ...v, requestingOfficer: e.target.value })}
              />
            </Field>
            <Field label="DEPARTMENT" req>
              <select value={v.department} onChange={(e) => set({ ...v, department: e.target.value })}>
                <option value="">— Select —</option>
                {DEPARTMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            {onOpenGuide ? (
              <button type="button" className="pmc-guide-link" onClick={onOpenGuide}>
                {isLspd
                  ? '✉ LSPD notices now go via the portal, not forum PM — how this works'
                  : '✉ How does the coroner email reach the department? — quick guide'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card">
        <h2><span className="ic" aria-hidden="true">▤</span>Attached reports</h2>
        <div className="body">
          {attachedList.length > 0 ? (
            <div style={{ marginBottom: 8 }}>
              {attachedList.map((a, i) => (
                <div key={`${a.attachedAuthor || '?'}:${a.attachedKey || i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div className="val" style={{ flex: 1 }}><strong>{a.originalKey || 'Attached report'}</strong></div>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => set({
                      ...v,
                      additionalReports: attachedList.filter((_, k) => k !== i),
                    })}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className="val muted" style={{ marginTop: 4 }}>
                Decedent, officer and department filled from the first report. The notice links straight to it.
              </div>
            </div>
          ) : (
            <div className="val muted" style={{ marginBottom: 8 }}>
              Pick filed reports to fill the fields below and link them in the notice.
            </div>
          )}
          <button
            type="button"
            className="btn ghost"
            onClick={() => setPickerOpen((o) => !o)}
            aria-expanded={pickerOpen}
          >
            {pickerOpen ? 'Hide filed reports' : attachedList.length > 0 ? 'Attach another report…' : 'Browse filed reports…'}
          </button>
          {pickerOpen ? (
            <div style={{ marginTop: 8 }}>
              {(reports || []).length === 0 ? (
                <div className="val muted">No reports loaded yet — open View all records first.</div>
              ) : (
                (reports || []).slice(0, 25).map((r) => {
                  const done = isAttached(r);
                  return (
                    <button
                      key={`${r.author}:${r.key}`}
                      type="button"
                      className="rec"
                      style={done
                        ? { width: '100%', textAlign: 'left', marginBottom: 6, borderColor: '#1d4a3f', background: '#0d1a17', cursor: 'default' }
                        : { width: '100%', textAlign: 'left', marginBottom: 6 }}
                      onClick={() => { if (!done) onAttachReport?.(r); }}
                      disabled={done}
                      title={done ? 'Already attached ✓' : `Attach ${r.title || 'report'}`}
                    >
                      <div className="main">
                        <div className="t">
                          {done ? <span style={{ color: '#7fd4bd' }}>✓ </span> : null}
                          {r.title || 'Untitled report'}
                        </div>
                        <div className="d">{r.authorName || r.author || ''}</div>
                      </div>
                      <div className="arrow">›</div>
                    </button>
                  );
                })
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="card">
        <h2><span className="ic" aria-hidden="true">○</span>Decedent</h2>
        <div className="body">
          <div className="form-grid">
            <Field label="DECEDENT NAME">
              <input
                type="text"
                value={v.decedentName}
                placeholder="Full Name"
                onChange={(e) => set({ ...v, decedentName: e.target.value })}
              />
            </Field>
            <Field label="OOC NAME">
              <input
                type="text"
                value={v.decedentOOC}
                placeholder="OOC Name"
                onChange={(e) => set({ ...v, decedentOOC: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </div>

      {preview ? (
        <div className="card">
          <h2><span className="ic" aria-hidden="true">✉</span>Notice preview</h2>
          <div className="body">
            <div className="val muted" style={{ marginBottom: 8 }}>
              Exactly what the officer receives on the portal. Subject: <strong>{preview.finalTitle}</strong>
            </div>
            <pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{preview.bbcode}</pre>
          </div>
        </div>
      ) : null}
    </>
  );
}
