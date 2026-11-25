import React from 'react';

/**
 * MorgueRecordCard.jsx — the morgue intake record, as a designed "Record Card".
 * Used BOTH as the in-app record detail view (MorgueBrowser modal body) and as
 * the PNG export (utils/morgueRecordCard.js renders it off-screen and captures
 * it with dom-to-image). Single source of truth: what you see is what exports.
 *
 * All styling is INLINE with literal colors (no CSS vars, no icon fonts) so the
 * export is pixel-faithful without app stylesheets.
 *
 * Privacy: casing IDs/types are OOC-sensitive — projectiles render as generic
 * counts only, mirroring the REDACTED modal view (never b.id / b.type).
 */

const BG = '#111a26';
const PANEL = '#182434';
const INK = '#e9f0f7';
const MUTED = '#8ea3b8';
const LINE = '#26374c';
const NAVY = '#0c2038';
const BAR = '#4f8fd0';
const ACCENT = '#e0494f';
const SECTION = '#9fc0e8';

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

const MorgueRecordCard = ({ record, actions }) => {
  const r = record || {};
  const findings = Array.isArray(r.findings) ? r.findings : [];
  const { shots, total, parts, max } = woundSummary(findings);
  const proj = projectileCounts(r.bullets);
  const cause = String(r.causeOfDeath || '—');
  const isCK = /\bck\b/i.test(cause);
  const identified = String(r.identified || '').toLowerCase() === 'yes';

  const kv = (label, value, mono = false) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '5px 0', borderBottom: `1px solid ${LINE}` }}>
      <span style={{ color: MUTED, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ color: INK, fontSize: 13, fontWeight: 600, textAlign: 'right', fontFamily: mono ? "'Courier New', monospace" : 'inherit' }}>{value}</span>
    </div>
  );

  const sec = (title) => (
    <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: SECTION, borderBottom: `2px solid ${SECTION}`, paddingBottom: 4, margin: '16px 0 6px' }}>{title}</div>
  );

  return (
    <div style={{ width: '100%', maxWidth: 860, margin: '0 auto', background: BG, color: INK, fontFamily: "Arial, Helvetica, sans-serif", overflow: 'hidden', borderRadius: 10, border: `1px solid ${LINE}` }}>
      {/* Header */}
      <div style={{ background: NAVY, color: '#fff', padding: '20px 28px 16px' }}>
        <div style={{ fontSize: 12, letterSpacing: 2, opacity: 0.8 }}>PILLBOX HILL MEDICAL CENTER — MORGUE INTAKE RECORD</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginTop: 6 }}>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{r.name || 'Unknown'}</div>
          <div style={{ fontSize: 20, fontFamily: "'Courier New', monospace", fontWeight: 700, whiteSpace: 'nowrap' }}>#{r.caseId || '—'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: identified ? '#1d7a3a' : ACCENT, color: '#fff' }}>
            {identified ? 'IDENTIFIED' : 'UNIDENTIFIED'}
          </span>
          {isCK && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#fff', color: ACCENT }}>CK — CHARACTER KILL</span>
          )}
          {r.sex && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.16)', color: '#fff' }}>{String(r.sex).toUpperCase()}</span>
          )}
        </div>
      </div>

      <div style={{ padding: '18px 28px 8px' }}>
        {/* Legal notice — lives inside the card so shared PNGs carry it too. */}
        <div style={{
          background: 'rgba(232,163,76,0.10)', border: '1px solid rgba(232,163,76,0.45)',
          color: '#e8b64c', fontSize: 12, borderRadius: 8, padding: '10px 14px', marginBottom: 14,
        }}>
          <span style={{ fontWeight: 800 }}>⚠ NOTICE:&nbsp;</span>
          Law Enforcement MAY use the PHMC Morgue Intake Records for PKs as proof of death for court cases. CKs will require a formal autopsy process which can be requested on the PHMC Forums.
        </div>
        {/* Key facts */}
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: SECTION, borderBottom: `2px solid ${SECTION}`, paddingBottom: 4, marginBottom: 6 }}>CASE DETAILS</div>
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
        {sec('PHYSICAL DESCRIPTION')}
        <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{r.physicalDescription || 'No physical description on file.'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 28, marginTop: 6 }}>
          {kv('Tattoos / marks', r.tattoos || 'None')}
          {kv('Source', 'PHMC Morgue')}
        </div>

        {/* Wound chart */}
        {sec(`WOUND DISTRIBUTION — ${shots} GUNSHOT${shots === 1 ? '' : 'S'}`)}
        {parts.length === 0 && <div style={{ fontSize: 13, color: MUTED }}>No localized wounds recorded.</div>}
        {parts.map(([part, n]) => (
          <div key={part} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
            <span style={{ width: 130, fontSize: 12, color: INK, textAlign: 'right' }}>{part}</span>
            <div style={{ flex: 1, background: '#223146', borderRadius: 4, height: 18 }}>
              <div style={{ width: `${max ? Math.max(6, Math.round((n / max) * 100)) : 0}%`, background: part.toLowerCase() === 'head' ? ACCENT : BAR, borderRadius: 4, height: 18 }} />
            </div>
            <span style={{ width: 28, fontSize: 13, fontWeight: 800, fontFamily: "'Courier New', monospace" }}>×{n}</span>
          </div>
        ))}

        {/* Wounds table */}
        {sec(`WOUND LOG — ${total} ${total === 1 ? 'ENTRY' : 'ENTRIES'}`)}
        {total > 0 ? (
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
                <tr key={i} style={{ background: i % 2 ? PANEL : 'transparent' }}>
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
        ) : (
          <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>No autopsy findings recorded.</div>
        )}

        {/* Projectiles (redacted) */}
        {sec('RECOVERED PROJECTILES')}
        {proj.total > 0 ? (
          <div style={{ fontSize: 13 }}>
            {proj.bulletsN > 0 && <div style={{ padding: '2px 0' }}>Bullet — striation data redacted (OOC) <span style={{ fontWeight: 800 }}>×{proj.bulletsN}</span></div>}
            {proj.pelletsN > 0 && <div style={{ padding: '2px 0' }}>Pellet — striation data redacted (OOC) <span style={{ fontWeight: 800 }}>×{proj.pelletsN}</span></div>}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: MUTED }}>No projectiles or casings recovered.</div>
        )}

        {/* In-app actions (Close / Prev / Next / …) — the PNG export renders
            the card without actions, so exports stay clean. */}
        {actions && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18, paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
            {actions}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 18, paddingTop: 8, borderTop: `1px solid ${LINE}`, fontSize: 11, color: MUTED }}>
          OOC — Casing IDs and striation details are withheld. Any In-Character use of this record requires a formal autopsy request.
          <div style={{ marginTop: 2 }}>
            Exported from PHMC Forms · Case #{r.caseId || '—'}
            {r.lastUpdated ? ` · Record updated ${new Date(Number(r.lastUpdated)).toLocaleString()}` : ''}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MorgueRecordCard;
