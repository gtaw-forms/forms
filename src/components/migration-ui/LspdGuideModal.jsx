// Staff guide modal — step-by-step tutorial for the LSPD portal delivery.
// Shown once per browser to PHMC staff (see lspdGuide.js), re-openable from
// the Request cards and the LEO view. Exported STEPS is unit-tested.
import React, { useState } from 'react';
import './LspdGuideModal.css';

export const COMPOSE_URL =
  'https://lspd.gta.world/portal/mail/compose?from=01m59agwyjgegcc18hbyem2y05';

export const STEPS = [
  {
    title: 'Prepare the email as normal',
    body: 'Attach the coroner report as normal — that fills in the officer, department and decedent for you — then click Generate. Copy the condensed text; that is exactly what you will paste into the portal.',
  },
  {
    title: 'Open the group inbox',
    body: 'Open the LSPD group compose page and sign in with your GTA World account (OAuth). You send as the Forensic Medicine group so replies land in its shared inbox.',
    warn: 'Ask Coroner Leadership for group access, otherwise you cannot send reports, ping Alyson Frost',
  },
  {
    title: 'Send it as the group',
    body: 'Work down the compose form in order:',
    points: [
      'Check From shows the Forensic Medicine group.',
      'Address it To the requesting officer by exact character name.',
      'Leave \u201CIs this about a request?\u201D on No.',
      'Paste the condensed text as the message with the report subject, then SEND MESSAGE.',
    ],
  },
];

export default function LspdGuideModal({ open, onClose }) {
  const [step, setStep] = useState(0);
  if (!open) return null;
  // Clamp: module reloads (dev HMR) or step-count edits must never crash an
  // open modal holding a now-out-of-range step.
  const safeStep = Math.min(Math.max(0, step), STEPS.length - 1);
  const last = safeStep >= STEPS.length - 1;
  const current = STEPS[safeStep];
  if (!current) return null;

  return (
    <div className="pmc-guide-overlay" role="dialog" aria-modal="true" aria-label="How LSPD delivery works" onClick={onClose}>
      <div className="pmc-guide-card" onClick={(e) => e.stopPropagation()}>
        <div className="pmc-guide-head">
          <div>
            <div className="pmc-guide-kicker">Coroner Email · LSPD portal</div>
            <h2>{current.title}</h2>
          </div>
          <button type="button" className="pmc-guide-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="pmc-guide-dots" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s.title} className={i === safeStep ? 'on' : ''} />
          ))}
        </div>

        {current.warn ? <p className="pmc-guide-warn">{current.warn}</p> : null}
        <p className="pmc-guide-body">{current.body}</p>
        {Array.isArray(current.points) && current.points.length ? (
          <ul className="pmc-guide-points">
            {current.points.map((p) => <li key={p}>{p}</li>)}
          </ul>
        ) : null}
        <p className="pmc-guide-count">Step {safeStep + 1} of {STEPS.length}</p>

        <div className="pmc-guide-foot">
          <button
            type="button"
            className="pmc-guide-btn ghost"
            disabled={safeStep === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            ← Back
          </button>
          {last ? (
            <button type="button" className="pmc-guide-btn" onClick={onClose}>Got it</button>
          ) : (
            <button type="button" className="pmc-guide-btn" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
