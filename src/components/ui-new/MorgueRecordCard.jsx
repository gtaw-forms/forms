import React from 'react';

/**
 * MorgueRecordCard.jsx — export-only "Record Card" layout for a morgue intake
 * record. Rendered off-screen by utils/morgueRecordCard.js and captured to PNG
 * with dom-to-image. All styling is INLINE with literal colors (no CSS vars,
 * no icon fonts) so the export is pixel-faithful without app stylesheets.
 *
 * Privacy: casing IDs/types are OOC-sensitive — projectiles render as generic
 * counts only, mirroring the REDACTED modal view (never b.id / b.type).
 */

const INK = '#16233a';
const MUTED = '#5b6b82';
const LINE = '#d7dee8';
const NAVY = '#10294d';
const ACCENT = '#b4232a';

const isGunshot = (f) => String(f?.type || '').toLowerCase().includes('gunshot');
const cleanPart = (p) => (!p || p === '-' || p === '—' ? '—' : String(p));

function woundSummary(findings) {
  const shots = (findings || []).filter(isGunshot);
  const byPart = {};
  for (const f of shots) {
    const p = cleanPart(f.part);
    if (p === '—') continue;
    byPart[p] = (byPart[p] || 0) + 1;
  }
  const parts = Object.entries(byPart).sort((a, b) => b[1] - a[1]);
  const max = parts.length ? parts[0][1] : 0;
  return { shots: shots.length, total: (findings || []).length, parts, max };
}

function projectileCounts(bullets) {
  const arr = Array.isArray(bullets) ? bullets : [];
  let bulletsN = 0, pelletsN = 0;
  for (const b of arr) {
    if (String(b?.type || '').toLowerCase().includes('gauge')) pelletsN += 1;
    else bulletsN += 1;
  }
  return { total: arr.length, bulletsN, pelletsN };
}

const MorgueRecordCard = ({ record }) => {
  const r = record || {};
  const findings = Array.isArray(r.findings) ? r.findings : [];
  const { shots, total, parts, max } = woundSummary(findings);
  const proj = projectileCounts(r.bullets);
  const cause = String(r.causeOfDeath || '—');
  const isCK = /\bck\b/i.test(cause);
  const identified = String(r.identified || '').toLowerCase() === 'yes';

  const kv = (label, value, mono = false) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '5px 0', borderBottom: `1px solid ${LINE}` }}>
      <span style={{ color: MUTED, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      <span style={{ color: INK, fontSize: 13, fontWeight: 600, textAlign: 'right', fontFamily: mono ? "'Courier New', monospace" : 'inherit' }}>{value}</span>
    </div>
  );

  return (
    <div style={{ width: 760, background: '#ffffff', color: INK, fontFamily: "Arial, Helvetica, sans-serif", overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: NAVY, color: '#fff', padding: '20px 28px 16px' }}>
        <div style={{ fontSize: 12, letterSpacing: 2, opacity: 0.85 }}>PILLBOX HILL MEDICAL CENTER — MORGUE INTAKE RECORD</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 }}>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{r.name || 'Unknown'}</div>
          <div style={{ fontSize: 20, fontFamily: "'Courier New', monospace", fontWeight: 700 }}>#{r.caseId || '—'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: identified ? '#1d7a3a' : ACCENT, color: '#fff' }}>
            {identified ? 'IDENTIFIED' : 'UNIDENTIFIED'}
          </span>
          {isCK && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#fff', color: ACCENT }}>CK — CHARACTER KILL</span>
          )}
          {r.sex && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.18)', color: '#fff' }}>{String(r.sex).toUpperCase()}</span>
          )}
        </div>
      </div>

      <div style={{ padding: '18px 28px 8px' }}>
        {/* Key facts */}
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: NAVY, borderBottom: `2px solid ${NAVY}`, paddingBottom: 4, marginBottom: 6 }}>CASE DETAILS</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 28 }}>
          {kv('Time of death', r.timeOfDeath || '—')}
          {kv('Location found', r.location || '—')}
          {kv('Cause of death', cause)}
          {kv('Estimated age', r.estimatedAge || 'Unknown')}
          {kv('Blood alcohol', r.bac || '0.00%')}
          {kv('Narcotics', r.narcotics || 'None')}
        </div>
        <div style={{ marginTop: 2 }}>{kv('DNA profile', r.dnaProfile || 'N/A', true)}</div>

        {/* Physical */}
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: NAVY, borderBottom: `2px solid ${NAVY}`, paddingBottom: 4, margin: '16px 0 6px' }}>PHYSICAL DESCRIPTION</div>
        <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{r.physicalDescription || 'No physical description on file.'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 28, marginTop: 6 }}>
          {kv('Tattoos / marks', r.tattoos || 'None')}
          {kv('Source', r.source || '—')}
        </div>

        {/* Wound chart */}
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: NAVY, borderBottom: `2px solid ${NAVY}`, paddingBottom: 4, margin: '16px 0 6px' }}>
          WOUND DISTRIBUTION — {shots} GUNSHOT{shots === 1 ? '' : 'S'}
        </div>
        {parts.length === 0 && <div style={{ fontSize: 13, color: MUTED }}>No localized wounds recorded.</div>}
        {parts.map(([part, n]) => (
          <div key={part} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
            <span style={{ width: 130, fontSize: 12, color: INK, textAlign: 'right' }}>{part}</span>
            <div style={{ flex: 1, background: '#edf1f6', borderRadius: 4, height: 18 }}>
              <div style={{ width: `${max ? Math.max(6, Math.round((n / max) * 100)) : 0}%`, background: part.toLowerCase() === 'head' ? ACCENT : NAVY, borderRadius: 4, height: 18 }} />
            </div>
            <span style={{ width: 28, fontSize: 13, fontWeight: 800, fontFamily: "'Courier New', monospace" }}>×{n}</span>
          </div>
        ))}

        {/* Wounds table */}
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: NAVY, borderBottom: `2px solid ${NAVY}`, paddingBottom: 4, margin: '16px 0 0' }}>
          WOUND LOG — {total} {total === 1 ? 'ENTRY' : 'ENTRIES'}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 4 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: MUTED, textTransform: 'uppercase', fontSize: 11 }}>
              <th style={{ padding: '4px 6px', borderBottom: `1px solid ${LINE}` }}>#</th>
              <th style={{ padding: '4px 6px', borderBottom: `1px solid ${LINE}` }}>Time</th>
              <th style={{ padding: '4px 6px', borderBottom: `1px solid ${LINE}` }}>Wound</th>
              <th style={{ padding: '4px 6px', borderBottom: `1px solid ${LINE}` }}>Location</th>
              <th style={{ padding: '4px 6px', borderBottom: `1px solid ${LINE}`, textAlign: 'right' }}>Range</th>
            </tr>
          </thead>
          <tbody>
            {findings.map((f, i) => (
              <tr key={i} style={{ background: i % 2 ? '#f5f8fb' : '#fff' }}>
                <td style={{ padding: '3px 6px', fontFamily: "'Courier New', monospace", color: MUTED }}>{i + 1}</td>
                <td style={{ padding: '3px 6px', fontFamily: "'Courier New', monospace" }}>{f.time || '—'}</td>
                <td style={{ padding: '3px 6px', fontWeight: isGunshot(f) ? 700 : 400 }}>{f.type || '—'}</td>
                <td style={{ padding: '3px 6px' }}>{cleanPart(f.part)}</td>
                <td style={{ padding: '3px 6px', textAlign: 'right', fontFamily: "'Courier New', monospace" }}>
                  {f.dist && f.dist !== '-' && f.dist !== '—' ? f.dist : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {total === 0 && <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>No autopsy findings recorded.</div>}

        {/* Projectiles (redacted) */}
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: NAVY, borderBottom: `2px solid ${NAVY}`, paddingBottom: 4, margin: '16px 0 6px' }}>RECOVERED PROJECTILES</div>
        {proj.total > 0 ? (
          <div style={{ fontSize: 13 }}>
            {proj.bulletsN > 0 && <div style={{ padding: '2px 0' }}>Bullet — striation data redacted (OOC) <span style={{ fontWeight: 800 }}>×{proj.bulletsN}</span></div>}
            {proj.pelletsN > 0 && <div style={{ padding: '2px 0' }}>Pellet — striation data redacted (OOC) <span style={{ fontWeight: 800 }}>×{proj.pelletsN}</span></div>}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: MUTED }}>No projectiles or casings recovered.</div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 18, paddingTop: 8, borderTop: `1px solid ${LINE}`, fontSize: 11, color: MUTED }}>
          OOC — Casing IDs and striation details are withheld. Any In-Character use of this record requires a formal autopsy request.
          <div style={{ marginTop: 2 }}>Exported from PHMC Forms · Case #{r.caseId || '—'} · {new Date().toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
};

export default MorgueRecordCard;
