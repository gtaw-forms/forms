import { useEffect, useRef, useState } from 'react';
import { triggerGetPatientNames } from '../../services/firebaseFunctions';

/**
 * PatientSearch — autocomplete for the medical Patient Name field.
 *
 * Debounced lookup against the VPS patient index (via the getPatientNames
 * Firebase function). Mirrors the OfficerSearch dropdown UX. Selecting a match
 * calls `onSelect(name, id)` so the parent can fill decedentName + patientName
 * (and patientID when the match has one).
 *
 * Never blocks saving — on any API failure it silently falls back to free text.
 */
const PatientSearch = ({ value, onSelect, disabled = false }) => {
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [noMatch, setNoMatch] = useState(false);
  const lastSearched = useRef('');
  const userTypedRef = useRef(false);

  useEffect(() => {
    const name = (value || '').trim();
    if (name.length < 2) { setResults([]); setNoMatch(false); setWaiting(false); return; }
    if (name === lastSearched.current) { setWaiting(false); return; }
    // Programmatic restore (form switch / saved report) never fires onChange, so
    // userTypedRef stays false — don't pop the dropdown over a filled-in name.
    if (!userTypedRef.current) { setWaiting(false); return; }

    setWaiting(true);
    const timer = setTimeout(async () => {
      setWaiting(false);
      setSearching(true);
      await new Promise((r) => setTimeout(r, 50));
      lastSearched.current = name;
      try {
        const result = await triggerGetPatientNames({ q: name });
        const matches = result?.matches || [];
        setResults(matches);
        setNoMatch(matches.length === 0);
      } catch (err) {
        console.warn('[PatientSearch] lookup failed (falling back to free text):', err?.message || err);
        setResults([]);
        setNoMatch(false);
      }
      setSearching(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div style={{ position: 'relative' }}>
      <input type="text"
        value={value}
        onChange={e => { userTypedRef.current = true; lastSearched.current = ''; setNoMatch(false); onSelect(e.target.value, null); }}
        placeholder="Enter patient name for forum search..."
        disabled={disabled}
        style={{
          width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 6,
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          color: 'var(--text)', boxSizing: 'border-box', opacity: disabled ? 0.4 : 1,
        }} />
      {waiting && !searching && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-faint)' }}>Waiting...</div>}
      {searching && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-faint)' }}>Searching...</div>}
      {results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: 'var(--bg-elevated)', border: '1px solid var(--border-accent)', borderRadius: 6, maxHeight: 180, overflow: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          {results.map((m) => (
            <div key={m.name + (m.id || '')} onClick={() => {
              userTypedRef.current = true;
              lastSearched.current = m.name;
              setResults([]); setWaiting(false); setSearching(false); setNoMatch(false);
              onSelect(m.name, m.id);
            }}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ color: 'var(--text)' }}>{m.name}</span>
              {m.id && <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--mono)', fontSize: 11 }}>#{m.id}</span>}
            </div>
          ))}
        </div>
      )}
      {noMatch && !searching && (
        <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 5, fontSize: 10.5, background: 'var(--amber-dim)', border: '1px solid var(--amber)', color: 'var(--amber)', display: 'flex', gap: 5, alignItems: 'flex-start' }}>
          <i className="fas fa-exclamation-triangle" style={{ marginTop: 1 }} />
          <span>No matching patients found — the name will still save as typed.</span>
        </div>
      )}
    </div>
  );
};

export default PatientSearch;
