import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { ref, get, set } from 'firebase/database';
import { database } from '../../firebase';
import 'leaflet/dist/leaflet.css';
import { aggregateStreetBodies, buildStreetIndex, streetAnchor, normalizeStreetName } from '../../utils/morgueStreetResolver';

// Drawing tools only ever run for leadership / localhost; the write also goes
// through /verified_locations, which enforces auth at the DB rules layer.

// Same projection + tile set as MapModal — game coords -> 8192px map space.
const MAP_WIDTH = 8192; const MAP_HEIGHT = 8192; const MAX_ZOOM = 5;
const minX = -3676; const maxX = 4574; const minY = -4864; const maxY = 7636;

const gameToMap = (gX, gY) => {
  const x = parseFloat(gX);
  const y = parseFloat(gY);
  if (isNaN(x) || isNaN(y)) return [0, 0];
  return [((maxY - y) / (maxY - minY)) * MAP_HEIGHT, ((x - minX) / (maxX - minX)) * MAP_WIDTH];
};

const mapToGame = (mY, mX) => ({
  x: (mX / MAP_WIDTH) * (maxX - minX) + minX,
  y: maxY - (mY / MAP_HEIGHT) * (maxY - minY),
});

const vertexIcon = L.divIcon({
  className: 'body-map-vertex',
  html: '<div style="width:8px;height:8px;border-radius:50%;background:#ffd166;border:1px solid #111;"></div>',
  iconSize: [8, 8], iconAnchor: [4, 4],
});

// Captures clicks only while drawing is active (avoids changing normal map UX).
const DrawEvents = ({ active, onAddPoint, onRemoveLast, onFinish }) => {
  useMapEvents({
    click(e) { if (active) onAddPoint(e.latlng); },
    contextmenu(e) { if (active) { e.originalEvent?.preventDefault?.(); onRemoveLast(); } },
    dblclick(e) { if (active) { e.originalEvent?.preventDefault?.(); onFinish(); } },
  });
  return null;
};

// Bubble radius scales with the square root of the count so area tracks volume
// without a single hotspot swallowing the map.
const radiusForCount = (count) => Math.min(46, 8 + Math.sqrt(count) * 2.6);
const colorForCount = (count) => {
  if (count >= 150) return '#ff4d4d';
  if (count >= 80) return '#ff8c42';
  if (count >= 30) return '#ffd166';
  if (count >= 10) return '#33d6c0';
  return '#58a6ff';
};

const IS_LOCALHOST = typeof window !== 'undefined' && window.location.hostname === 'localhost';

// Client mirror of the leadership gate used elsewhere (useTowAccess).
const isLeadershipAccess = (accessLevel) =>
  ['superadmin', 'admin', 'management'].includes(String(accessLevel || '').toLowerCase());

const MorgueBodyMapModal = ({ show, onClose, records, isLoading, accessLevel }) => {
  const [verifiedLocations, setVerifiedLocations] = useState(null);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [hideBubbles, setHideBubbles] = useState(false);
  const [showStreetOutlines, setShowStreetOutlines] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tempPath, setTempPath] = useState([]);
  const [draftName, setDraftName] = useState('');
  const [saving, setSaving] = useState(false);
  const mapRef = useRef(null);

  // Admin controls: real leadership access, or an explicit localhost dev flag.
  const canUseAdminTools = IS_LOCALHOST || isLeadershipAccess(accessLevel);

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    const fetchLocations = async () => {
      setLoadingLocations(true);
      try {
        const snap = await get(ref(database, 'verified_locations'));
        if (!cancelled) setVerifiedLocations(snap.exists() ? snap.val() : {});
      } catch (err) {
        console.error('[MorgueBodyMap] verified_locations fetch failed:', err);
        if (!cancelled) setVerifiedLocations({});
      } finally {
        if (!cancelled) setLoadingLocations(false);
      }
    };
    fetchLocations();
    return () => { cancelled = true; };
  }, [show]);

  const { bubbles, mapped, skipped, total } = useMemo(
    () => aggregateStreetBodies(records, verifiedLocations || {}),
    [records, verifiedLocations],
  );

  // Streets with geometry + the subset that actually has bodies — the admin
  // overlay distinguishes mapped (has bodies) from unmapped (drawn, no bodies).
  const streetOutlines = useMemo(() => {
    const index = buildStreetIndex(verifiedLocations || {});
    const byKey = new Map();
    for (const [key, s] of index) byKey.set(key, s);
    const bubbleKeys = new Set(bubbles.map(b => normalizeStreetName(b.name)));
    return [...byKey.entries()].map(([key, s]) => ({
      key,
      name: s.name,
      path: s.path || null,
      hasBodies: bubbleKeys.has(key),
      anchor: streetAnchor(s),
    }));
  }, [verifiedLocations, bubbles]);

  // ── Drawing a new street (admin only) ──
  const addPoint = (latlng) => {
    setTempPath(prev => [...prev, { lat: latlng.lat, lng: latlng.lng }]);
  };
  const removeLastPoint = () => setTempPath(prev => prev.slice(0, -1));
  const cancelDraw = () => { setIsDrawing(false); setTempPath([]); setDraftName(''); };

  const saveStreet = async () => {
    const name = draftName.trim();
    if (!name) return;
    if (tempPath.length < 2) return;
    const key = name.toLowerCase().trim().replace(/[.#$[\]/]/g, '_');
    const path = tempPath.map(p => {
      const g = mapToGame(p.lat, p.lng);
      return { x: Number(g.x.toFixed(2)), y: Number(g.y.toFixed(2)) };
    });
    setSaving(true);
    try {
      await set(ref(database, `verified_locations/${key}`), {
        name, type: 'Street', path, updatedAt: Date.now(),
      });
      // Reflect locally so the new line + any newly-resolved bubbles appear
      // without a full refetch.
      setVerifiedLocations(prev => ({ ...(prev || {}), [key]: { name, type: 'Street', path, updatedAt: Date.now() } }));
      cancelDraw();
    } catch (err) {
      console.error('[MorgueBodyMap] Save street failed:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  const busy = loadingLocations || isLoading;

  return (
    <div className="modal-overlay open" onClick={onClose} style={{ display: 'flex', zIndex: 1050 }}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{
        maxWidth: '96vw', width: '96vw', height: '92vh', maxHeight: '92vh',
        display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden',
      }}>
        <div className="modal-head" style={{ flexShrink: 0 }}>
          <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-map-location-dot" style={{ color: 'var(--teal)' }} /> Morgue Body Map — Bubbles by Street
          </h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div style={{ flexShrink: 0, padding: '8px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', fontSize: 11.5, fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>
          {busy ? (
            <span><i className="fas fa-spinner fa-spin me-2" style={{ color: 'var(--teal)' }} />Resolving street locations…</span>
          ) : (
            <>
              <span><strong style={{ color: 'var(--teal)' }}>{bubbles.length}</strong> streets mapped</span>
              <span><strong style={{ color: 'var(--text)' }}>{mapped}</strong> bodies placed</span>
              <span title="Records whose location could not be resolved to a known street">— <strong style={{ color: 'var(--amber)' }}>{skipped}</strong> skipped (unmapped location)</span>
              <span style={{ opacity: 0.7 }}>{total} total records</span>
            </>
          )}

          {canUseAdminTools && (
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--amber)', fontSize: 10.5, letterSpacing: 0.5 }}>
                <i className="fas fa-user-shield me-1" />ADMIN
              </span>
              <label style={{ display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={showStreetOutlines} onChange={e => setShowStreetOutlines(e.target.checked)} />
                Show street outlines
              </label>
              <label style={{ display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={hideBubbles} onChange={e => setHideBubbles(e.target.checked)} />
                Hide body bubbles
              </label>

              {!isDrawing ? (
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px', borderColor: 'var(--amber)', color: 'var(--amber)' }}
                  onClick={() => { setIsDrawing(true); setTempPath([]); setDraftName(''); setShowStreetOutlines(true); }}>
                  <i className="fas fa-pen-ruler me-1" />Draw street
                </button>
              ) : (
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-faint)', fontSize: 10.5 }}>
                    {tempPath.length} pt{tempPath.length === 1 ? '' : 's'} · right-click undo
                  </span>
                  <input type="text" placeholder="Street name…" value={draftName} onChange={e => setDraftName(e.target.value)}
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '4px 8px', fontSize: 11.5, width: 150 }} />
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}
                    disabled={saving || !draftName.trim() || tempPath.length < 2} onClick={saveStreet}>
                    {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-floppy-disk me-1" />}Save
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={cancelDraw}>
                    Cancel
                  </button>
                </span>
              )}
            </span>
          )}
        </div>

        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#000' }}>
          <MapContainer
            center={gameToMap(0, 0)}
            zoom={3}
            minZoom={2}
            maxZoom={MAX_ZOOM}
            crs={L.extend({}, L.CRS.Simple, { transformation: new L.Transformation(1 / 32, 0, 1 / 32, 0) })}
            style={{ height: '100%', width: '100%', background: '#000' }}
            ref={mapRef}
          >
            <TileLayer url={`${import.meta.env.BASE_URL}assets/map-tiles/{z}/{y}/{x}.jpg`} noWrap={true} />

            <DrawEvents active={isDrawing} onAddPoint={addPoint} onRemoveLast={removeLastPoint} onFinish={() => {}} />

            {/* In-progress street line */}
            {isDrawing && tempPath.length > 1 && (
              <Polyline
                positions={tempPath.map(p => [p.lat, p.lng])}
                pathOptions={{ color: '#ff4444', weight: 5, opacity: 0.9 }}
              />
            )}
            {isDrawing && tempPath.map((p, i) => (
              <Marker key={`v-${i}`} position={[p.lat, p.lng]} icon={vertexIcon} />
            ))}

            {showStreetOutlines && streetOutlines.filter(s => s.path).map((s) => (
              <Polyline
                key={`outline-${s.key}`}
                positions={s.path.map(p => gameToMap(p.x, p.y)).filter(pos => pos[0] !== 0 || pos[1] !== 0)}
                pathOptions={{
                  color: s.hasBodies ? '#33d6c0' : '#8b96ae',
                  weight: s.hasBodies ? 4 : 2,
                  opacity: s.hasBodies ? 0.7 : 0.4,
                }}
              >
                <Tooltip sticky>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                    {s.name}{s.hasBodies ? '' : ' (drawn, no bodies)'}
                  </span>
                </Tooltip>
              </Polyline>
            ))}

            {!busy && !hideBubbles && bubbles.map((b) => {
              const pos = gameToMap(b.anchor.x, b.anchor.y);
              const color = colorForCount(b.count);
              return (
                <CircleMarker
                  key={b.name}
                  center={pos}
                  radius={radiusForCount(b.count)}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.35, weight: 2 }}
                >
                  <Tooltip direction="top" offset={[0, -4]} opacity={1}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                      <strong>{b.name}</strong>
                      <div>{b.count} {b.count === 1 ? 'body' : 'bodies'}</div>
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>

          {!busy && !hideBubbles && bubbles.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>No resolvable locations in the current records.</span>
            </div>
          )}
        </div>

        <div className="modal-foot" style={{ flexShrink: 0, justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
            Approximate — bubbles anchored to street midpoints, not exact death coordinates.
          </span>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default MorgueBodyMapModal;
