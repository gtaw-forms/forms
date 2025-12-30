import React, { useState, useMemo, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Button, Form, ListGroup, InputGroup, Badge } from 'react-bootstrap';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import mapData from '../../assets/mapData.json';
import { database } from '../../firebase';
import { ref, set, get } from 'firebase/database';

// Fix for default Leaflet markers in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

if (L.Marker.prototype.options) {
    L.Marker.prototype.options.icon = DefaultIcon;
}

// --- CONFIGURATION ---
const MAP_WIDTH = 8192;
const MAP_HEIGHT = 8192;
const MAX_ZOOM = 5; 

// --- STYLES ---
const overlayStyle = {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000,
};

const containerStyle = {
    backgroundColor: '#0d1117', color: '#c9d1d9', width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column', position: 'relative', border: '1px solid #30363d',
};

const headerStyle = {
    padding: '10px 20px', backgroundColor: '#161b22', borderBottom: '1px solid #30363d',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
};

// --- COORDINATE CONVERSION ---
const minX = -3676; const maxX = 4574; const minY = -4864; const maxY = 7636;

const gameToMap = (gameX, gameY) => {
    const mapX = ((gameX - minX) / (maxX - minX)) * MAP_WIDTH;
    const mapY = ((maxY - gameY) / (maxY - minY)) * MAP_HEIGHT;
    return [mapY, mapX];
};

const mapToGame = (mapY, mapX) => {
    const gameX = (mapX / MAP_WIDTH) * (maxX - minX) + minX;
    const gameY = maxY - (mapY / MAP_HEIGHT) * (maxY - minY);
    return { x: gameX, y: gameY };
};

// --- DISTANCE MATH ---
const getDistanceToSegment = (p, a, b) => {
    const l2 = Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
    if (l2 === 0) return Math.sqrt(Math.pow(p.x - a.x, 2) + Math.pow(p.y - a.y, 2));
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt(Math.pow(p.x - (a.x + t * (b.x - a.x)), 2) + Math.pow(p.y - (a.y + t * (b.y - a.y)), 2));
};

const getDistanceToPath = (gameCoords, path) => {
    let minDist = Infinity;
    for (let i = 0; i < path.length - 1; i++) {
        const dist = getDistanceToSegment(gameCoords, path[i], path[i+1]);
        if (dist < minDist) minDist = dist;
    }
    return minDist;
};

const MapEvents = ({ onMapClick }) => {
    useMapEvents({ click(e) { if (typeof onMapClick === 'function') onMapClick(e); } });
    return null;
};

const MapModal = ({ show, onHide, onSelect, initialQuery = '' }) => {
    const [debugMode, setDebugMode] = useState(false);
    const [adminFixMode, setAdminFixMode] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const [tempPath, setTempPath] = useState([]);
    const [showGrid, setShowGrid] = useState(false);
    const [markers, setMarkers] = useState([]);
    const [fixMarkers, setFixMarkers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState(initialQuery);
    const [reporting, setReporting] = useState(null);
    const [liveMapData, setLiveMapData] = useState({ streets: [], hospitals: [] });
    const mapRef = useRef(null);

    const formatDisplayName = (name) => name ? name.replace(/\s*\(zone\s*\d+\)\s*/gi, '').trim() : 'Unknown';

    useEffect(() => {
        if (!show) return;
        const fetchData = async () => {
            setIsLoading(true);
            try {
                let mergedStreets = [...(mapData.streets || [])];
                let mergedHospitals = [...(mapData.hospitals || [])];
                const verifiedRef = ref(database, 'verified_locations');
                const snapshot = await get(verifiedRef);
                if (snapshot.exists()) {
                    Object.values(snapshot.val()).forEach(fix => {
                        const target = fix.type === 'Street' ? mergedStreets : mergedHospitals;
                        const idx = target.findIndex(m => m.name === fix.name);
                        const mergedItem = { ...fix };
                        if (fix.gameX !== undefined) mergedItem.x = fix.gameX;
                        if (fix.gameY !== undefined) mergedItem.y = fix.gameY;
                        if (idx !== -1) target[idx] = { ...target[idx], ...mergedItem };
                        else target.push(mergedItem);
                    });
                }
                setLiveMapData({ streets: mergedStreets, hospitals: mergedHospitals });
            } catch (err) { setLiveMapData(mapData); } finally { setIsLoading(false); }
        };
        fetchData();
    }, [show]);
    
    const factor = 1 / Math.pow(2, MAX_ZOOM);
    const crs = L.extend({}, L.CRS.Simple, { transformation: new L.Transformation(factor, 0, factor, 0) });
    const bounds = [[0, 0], [MAP_HEIGHT, MAP_WIDTH]];
    const phmcPos = gameToMap(340.8, -1396.9);

    const handleLoadFixMarkers = () => {
        const streets = (liveMapData.streets || []).filter(s => s.x !== undefined).map(s => ({ ...s, type: 'Street', id: `s-${s.name}`, position: gameToMap(s.x, s.y) }));
        const hospitals = (liveMapData.hospitals || []).filter(h => h.x !== undefined).map(h => ({ ...h, type: 'Hospital', id: `h-${h.name}`, position: gameToMap(h.x, h.y) }));
        setFixMarkers([...hospitals, ...streets]);
    };

    const handleFixMarkerDragEnd = async (e, marker) => {
        const { lat, lng } = e.target.getLatLng();
        const gameCoords = mapToGame(lat, lng);
        const safeKey = marker.name.toLowerCase().trim().replace(/[.#$[\\\]\/]/g, "_");
        try {
            await set(ref(database, `verified_locations/${safeKey}`), { name: marker.name, type: marker.type, gameX: parseFloat(gameCoords.x.toFixed(2)), gameY: parseFloat(gameCoords.y.toFixed(2)), updatedAt: Date.now() });
            setFixMarkers(prev => prev.map(m => m.id === marker.id ? { ...m, position: [lat, lng] } : m));
        } catch (err) { console.error(err); }
    };

    const handleSavePath = async () => {
        if (tempPath.length < 2) return alert("Need 2+ points.");
        const name = prompt("Street Name:"); if (!name) return;
        const safeKey = name.toLowerCase().trim().replace(/[.#$[\\\]\/]/g, "_");
        try {
            const pathData = tempPath.map(p => ({ x: p.x, y: p.y }));
            await set(ref(database, `verified_locations/${safeKey}`), { name, type: 'Street', path: pathData, updatedAt: Date.now() });
            setLiveMapData(prev => ({ ...prev, streets: [...prev.streets, { name, type: 'Street', path: pathData }] }));
            setTempPath([]); setIsDrawing(false); alert("Saved!");
        } catch (err) { alert("Failed"); }
    };

    const searchResults = useMemo(() => {
        if (!searchQuery || searchQuery.length < 2) return [];
        const q = searchQuery.toLowerCase();
        return [...liveMapData.hospitals.map(h => ({...h, type: 'Hospital'})), ...liveMapData.streets.map(s => ({...s, type: 'Street'}))]
            .filter(item => item.name.toLowerCase().includes(q)).slice(0, 8);
    }, [searchQuery, liveMapData]);

    const handleMapClick = (e) => {
        if (!e || !e.latlng) return;
        const { lat, lng } = e.latlng;
        const gameCoords = mapToGame(lat, lng);
        if (isDrawing) { setTempPath(prev => [...prev, { ...gameCoords, lat, lng }]); return; }
        
        // Calculate distances to all mapped locations
        const allLocations = [
            ...liveMapData.hospitals.map(h => ({...h, type: 'Hospital'})), 
            ...liveMapData.streets.map(s => ({...s, type: 'Street'}))
        ];

        const sortedNearby = allLocations
            .map(loc => {
                let d = loc.path ? getDistanceToPath(gameCoords, loc.path) : (loc.x !== undefined ? Math.sqrt(Math.pow(loc.x - gameCoords.x, 2) + Math.pow(loc.y - gameCoords.y, 2)) : Infinity);
                return { ...loc, distance: d };
            })
            .filter(loc => loc.distance !== Infinity)
            .sort((a, b) => a.distance - b.distance);

        const primary = sortedNearby[0];
        const secondary = sortedNearby.find(loc => 
            loc.type === 'Street' && 
            formatDisplayName(loc.name) !== formatDisplayName(primary?.name)
        );
        
        let crossStreet = null;
        // Intersection threshold: 60 game units
        if (primary?.type === 'Street' && secondary && secondary.distance < 60) {
            crossStreet = secondary.name;
        }
        
        const newMarker = { 
            id: Date.now(), 
            position: [lat, lng], 
            gameX: gameCoords.x.toFixed(2), 
            gameY: gameCoords.y.toFixed(2), 
            nearest: primary?.name || 'Unknown', 
            crossStreet: crossStreet,
            distance: primary ? primary.distance.toFixed(1) : "0" 
        };
        setMarkers(onSelect ? [newMarker] : (prev => [...prev, newMarker]));
    };

    const handleSelectLocation = (loc) => {
        const mapPos = loc.path ? gameToMap(loc.path[0].x, loc.path[0].y) : gameToMap(loc.x, loc.y);
        setMarkers([{ id: 'search', position: mapPos, gameX: loc.x || 0, gameY: loc.y || 0, nearest: loc.name, distance: "0" }]);
        if (mapRef.current) mapRef.current.flyTo(mapPos, 4);
        setSearchQuery('');
    };

    const handleReportLocation = async (marker) => {
        const name = prompt("Name:", onSelect ? (searchQuery || marker.nearest) : marker.nearest);
        if (!name) return;
        setReporting(marker.id);
        const safeKey = name.toLowerCase().trim().replace(/[.#$[\\\]\/]/g, "_");
        try {
            await set(ref(database, `untracked_locations_log/${safeKey}`), { place: name, timestamp: Date.now(), gameX: parseFloat(marker.gameX), gameY: parseFloat(marker.gameY), nearestStreet: marker.nearest, source: "Map" });
            if (onSelect) { onSelect({ name, gameX: parseFloat(marker.gameX), gameY: parseFloat(marker.gameY) }); onHide(); }
            else alert("Reported!");
        } catch (err) { alert("Failed"); } finally { setReporting(null); }
    };

    if (!show) return null;
    const basePath = import.meta.env.BASE_URL || '/';
    const tileUrl = `${basePath}assets/map-tiles/{z}/{y}/{x}.jpg`;

    return ReactDOM.createPortal(
        <div style={overlayStyle} onClick={onHide}>
            <style>{` .leaflet-tile { transition: opacity 0.4s; } .leaflet-tile-loading { opacity: 0; } .search-results-list { max-height: 300px; overflow-y: auto; z-index: 1001; position: absolute; width: 100%; } `}</style>
            <div style={containerStyle} onClick={(e) => e.stopPropagation()}>
                <div style={headerStyle}>
                    <h5 style={{ margin: 0 }}><i className="fas fa-map-marked-alt me-2"></i>{onSelect ? "Select Location" : "GTA V Map"}</h5>
                    <div className="d-flex align-items-center gap-3">
                        {isLoading && <small className="text-info"><i className="fas fa-spinner fa-spin"></i> Syncing...</small>}
                        <Button variant="outline-danger" size="sm" onClick={onHide}>Close</Button>
                    </div>
                </div>

                <div style={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 15, left: 15, zIndex: 1000, width: '300px' }}>
                        <InputGroup size="sm">
                            <InputGroup.Text className="bg-dark border-secondary text-light"><i className="fas fa-search"></i></InputGroup.Text>
                            <Form.Control placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-dark border-secondary text-light shadow-none" />
                        </InputGroup>
                        {searchResults.length > 0 && (
                            <ListGroup className="search-results-list mt-1">
                                {searchResults.map((res, i) => (
                                    <ListGroup.Item key={i} className="bg-dark text-light border-secondary" onClick={() => handleSelectLocation(res)} style={{ cursor: 'pointer' }}>
                                        <div className="d-flex justify-content-between"><span>{formatDisplayName(res.name)}</span><small className="text-muted">{res.type}</small></div>
                                    </ListGroup.Item>
                                ))}
                            </ListGroup>
                        )}
                    </div>

                    <div style={{ position: 'absolute', top: 15, right: 15, zIndex: 1000, background: 'rgba(13,17,23,0.9)', padding: '12px', borderRadius: '10px', border: '1px solid #30363d' }}>
                        <Form.Check type="switch" label="Debug" checked={debugMode} onChange={e => setDebugMode(e.target.checked)} className="text-light small mb-2" />
                        <Form.Check type="switch" label="Admin Fix" checked={adminFixMode} onChange={e => setAdminFixMode(e.target.checked)} className="text-warning small mb-2" />
                        {adminFixMode && (
                            <div className="d-flex flex-column gap-1">
                                <Button variant="warning" size="sm" onClick={handleLoadFixMarkers} style={{ fontSize: '0.7rem' }}>Load Markers</Button>
                                <Button variant={isDrawing ? "danger" : "info"} size="sm" onClick={() => { setIsDrawing(!isDrawing); setTempPath([]); }} style={{ fontSize: '0.7rem' }}>{isDrawing ? "Cancel Path" : "Draw Path"}</Button>
                                {isDrawing && tempPath.length > 1 && <Button variant="success" size="sm" onClick={handleSavePath} style={{ fontSize: '0.7rem' }}>Save Path ({tempPath.length})</Button>}
                            </div>
                        )}
                    </div>

                    <MapContainer center={[MAP_HEIGHT / 2, MAP_WIDTH / 2]} zoom={2} minZoom={0} maxZoom={MAX_ZOOM} scrollWheelZoom={true} crs={crs} style={{ height: '100%', width: '100%', background: '#000' }} maxBounds={bounds} ref={mapRef}>
                        <TileLayer url={tileUrl} noWrap={true} bounds={bounds} minNativeZoom={0} maxNativeZoom={MAX_ZOOM} eventHandlers={{ loading: () => setIsLoading(true), load: () => setIsLoading(false) }} />
                        {showGrid && <TileLayer url="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNTYiIGhlaWdodD0iMjU2Ij48cmVjdCB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMikiIHN0cm9rZS13aWR0aD0iMSIvPjx0ZXh0IHg9IjUiIHk9IjIwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuNSkiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiIGZvbnQtc2l6ZT0iMTIiPng6e3h9IHk6e3l9IHo6e3p9PC90ZXh0Pjwvc3ZnPg==" noWrap={true} opacity={0.8} />}
                        <MapEvents onMapClick={handleMapClick} />
                        <Marker position={phmcPos}><Popup><div style={{ color: '#000' }}><strong>PHMC</strong></div></Popup></Marker>
                        {isDrawing && tempPath.length > 0 && <Polyline positions={tempPath.map(p => [p.lat, p.lng])} color="#ff0000" weight={6} opacity={1.0} dashArray="10, 10" />}
                        {liveMapData.streets.filter(s => s.path).map((s, i) => (
                            <Polyline key={i} positions={s.path.map(p => gameToMap(p.x, p.y))} color="#ee04eeff" weight={5} opacity={0.8} />
                        ))}
                        {adminFixMode && fixMarkers.map((m) => (
                            <Marker key={m.id} position={m.position} draggable={true} eventHandlers={{ dragend: (e) => handleFixMarkerDragEnd(e, m) }}>
                                <Popup><div style={{ color: '#000' }}><strong>{formatDisplayName(m.name)}</strong></div></Popup>
                            </Marker>
                        ))}
                        {markers.map((m) => (
                            <Marker key={m.id} position={m.position}>
                                <Popup>
                                    <div style={{ color: '#000', minWidth: '180px' }}>
                                        <div style={{ borderBottom: '1px solid #ccc', marginBottom: '8px', paddingBottom: '4px' }}>
                                            <strong style={{ fontSize: '1.1rem' }}>Location Info</strong>
                                        </div>
                                        <div style={{ marginBottom: '5px' }}>
                                            <strong>{debugMode ? "DEBUG: Location:" : "Location:"}</strong><br />
                                            <span style={{ color: '#007bff', fontWeight: 'bold' }}>
                                                {formatDisplayName(m.nearest)}
                                                {m.crossStreet && ` & ${formatDisplayName(m.crossStreet)}`}
                                            </span>
                                            {debugMode && <small className="text-muted ms-1">({m.distance}m)</small>}
                                        </div>
                                        
                                        {debugMode && (
                                            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '5px' }}>
                                                Game Coords: X: {m.gameX}, Y: {m.gameY}
                                            </div>
                                        )}
                                        
                                        <div className="mt-3 pt-2" style={{ borderTop: '1px solid #eee' }}>
                                            <Button 
                                                variant={onSelect ? "primary" : "success"} 
                                                size="sm" 
                                                className="w-100"
                                                onClick={() => handleReportLocation(m)}
                                                disabled={reporting === m.id}
                                            >
                                                {reporting === m.id ? '...' : (onSelect ? 'Confirm Selection' : 'Report Location')}
                                            </Button>
                                            <Button 
                                                variant="link" 
                                                size="sm" 
                                                className="w-100 mt-1 text-danger p-0"
                                                onClick={() => setMarkers(prev => prev.filter(marker => marker.id !== m.id))}
                                                style={{ fontSize: '0.75rem', textDecoration: 'none' }}
                                            >
                                                Remove Marker
                                            </Button>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>
            </div>
        </div>,
        document.getElementById('modal-root') || document.body
    );
};

export default MapModal;
