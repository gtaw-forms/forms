import React, { useEffect, useRef, useState } from 'react';
import './ForwardToDrdbModal.css';

// Small "Send to DRDB" modal for LEO shared reports. No roster lookup exists
// (LSPD forums retired), so the requester types and verifies the receiving
// officer's character name — the light-blue header says exactly that.
export default function ForwardToDrdbModal({ open, reportTitle, submitting, error, onSubmit, onClose }) {
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setName('');
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open ]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = (e) => {
    e?.preventDefault();
    onSubmit(name);
  };

  return (
    <div className="pmc-forward-overlay" role="dialog" aria-modal="true" aria-label="Send to DRDB" onClick={onClose}>
      <div className="pmc-forward-card" onClick={(e) => e.stopPropagation()}>
        <div className="pmc-forward-head">
          <div>
            <div className="pmc-forward-kicker">Send to DRDB</div>
            <h2>{reportTitle || 'Forwarded report'}</h2>
          </div>
          <button type="button" className="pmc-forward-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <p className="pmc-forward-info">
          Please provide the officer&rsquo;s character name — double-check the
          spelling before you click <strong>Submit</strong>. There is no roster
          lookup: the filing goes to exactly the name you enter, and a name the
          portal cannot match will hold the send instead of guessing.
        </p>

        <form onSubmit={submit}>
          <label className="pmc-forward-label" htmlFor="pmc-forward-officer">
            Receiving officer&rsquo;s character name
          </label>
          <input
            id="pmc-forward-officer"
            ref={inputRef}
            type="text"
            className="pmc-forward-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Connor Kennedy"
            maxLength={120}
            autoComplete="off"
            disabled={submitting}
          />
          {error ? <p className="pmc-forward-error" role="alert">{error}</p> : null}
          <div className="pmc-forward-foot">
            <button type="button" className="pmc-forward-btn ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="pmc-forward-btn" disabled={submitting || !name.trim()}>
              <strong>Submit</strong>
            </button>
          </div>
        </form>
        {submitting ? <p className="pmc-forward-wait">Queueing the filing…</p> : null}
      </div>
    </div>
  );
}
