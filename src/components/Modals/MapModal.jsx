import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Button, Form, ListGroup, InputGroup, Badge, Spinner } from 'react-bootstrap';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Rectangle, Polygon, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { captureMapScreenshot } from '../../utils/mapImageUploadUtils';
import { useImageUpload } from '../../hooks/useImageUpload';
import 'leaflet/dist/leaflet.css';
import { ref, set, get, onValue } from 'firebase/database';
import { useGtaWorldAuth } from '../../hooks/useGtaWorldAuth';
import { isGoogleAuthenticated, getGoogleUser } from '../../services/gtaWorldAuth';

import { useAuth } from '../../contexts/AuthContext';
import { database } from '../../firebase';
import { useNotification } from '../../contexts/NotificationContext';
import phmcLogo from '../../assets/hospital_logo.png';
import BaseModal from './BaseModal';

// --- LEAFLET ICON FIXES ---
const DefaultIcon = L.icon({
    iconUrl: `${import.meta.env.BASE_URL}assets/leaflet/marker-icon.png`,
    iconRetinaUrl: `${import.meta.env.BASE_URL}assets/leaflet/marker-icon-2x.png`,
    shadowUrl: `${import.meta.env.BASE_URL}assets/leaflet/marker-shadow.png`,
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
if (L.Marker.prototype.options) { L.Marker.prototype.options.icon = DefaultIcon; }

const HospitalIcon = L.icon({
    iconUrl: phmcLogo,
    iconSize: [35, 35],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
    className: 'custom-hospital-icon'
});

const BodyIcon = L.divIcon({
    html: '<div style="background-color: #333; border-radius: 50%; width: 30px; height: 30px; display: flex; justify-content: center; align-items: center; border: 2px solid #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"><i class="fas fa-skull-crossbones" style="color: #fff; font-size: 16px;"></i></div>',
    className: 'custom-body-icon', iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15]
});
const BuildingIcon = L.divIcon({
    html: '<div style="background-color: #4a5568; border-radius: 50%; width: 30px; height: 30px; display: flex; justify-content: center; align-items: center; border: 2px solid #cbd5e0; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"><i class="fas fa-building" style="color: #fff; font-size: 16px;"></i></div>',
    className: 'custom-building-icon', iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15]
});
const FireStationIcon = L.divIcon({
    html: '<div style="background-color: #fd7e14; border-radius: 50%; width: 30px; height: 30px; display: flex; justify-content: center; align-items: center; border: 2px solid #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"><i class="fas fa-fire" style="color: #fff; font-size: 16px;"></i></div>',
    className: 'custom-fire-icon', iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15]
});

// --- CONSTANTS ---
const MAP_WIDTH = 8192; const MAP_HEIGHT = 8192; const MAX_ZOOM = 5; 
const minX = -3676; const maxX = 4574; const minY = -4864; const maxY = 7636;

// --- HELPERS ---
const gameToMap = (gX, gY) => {
    const x = parseFloat(gX);
    const y = parseFloat(gY);
    if (isNaN(x) || isNaN(y)) return [0, 0];
    return [((maxY - y) / (maxY - minY)) * MAP_HEIGHT, ((x - minX) / (maxX - minX)) * MAP_WIDTH];
};

const mapToGame = (mY, mX) => ({ 
    x: (mX / MAP_WIDTH) * (maxX - minX) + minX, 
    y: maxY - (mY / MAP_HEIGHT) * (maxY - minY) 
});

const getDistSeg = (p, a, b) => {
    const l2 = Math.pow(a.x-b.x,2)+Math.pow(a.y-b.y,2); if (l2===0) return Math.sqrt(Math.pow(p.x-a.x,2)+Math.pow(p.y-a.y,2));
    let t = Math.max(0, Math.min(1, ((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/l2));
    return Math.sqrt(Math.pow(p.x-(a.x+t*(b.x-a.x)),2)+Math.pow(p.y-(a.y+t*(b.y-a.y)),2));
};
const getDistPath = (g, path) => {
    let min = Infinity; for(let i=0; i<path.length-1; i++) { const d=getDistSeg(g,path[i],path[i+1]); if(d<min) min=d; } return min;
};
const findClosestBetween = (l1, l2) => {
    const src = l1.path ? l1.path : [{x:l1.x, y:l1.y}]; let best=null; let minD2=Infinity;
    src.forEach(p1 => {
        let cand = l2.path ? (function(p, path) {
            let mD2=Infinity; let bp=null; for(let i=0; i<path.length-1; i++) {
                const a=path[i]; const b=path[i+1]; const l2=Math.pow(a.x-b.x,2)+Math.pow(a.y-b.y,2);
                let t=l2===0?0:Math.max(0,Math.min(1,((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/l2));
                const pr={x:a.x+t*(b.x-a.x), y:a.y+t*(b.y-a.y)}; const d2=Math.pow(p.x-pr.x,2)+Math.pow(p.y-pr.y,2);
                if(d2<mD2){mD2=d2; bp=pr;}
            } return bp;
        })(p1, l2.path) : {x:l2.x, y:l2.y};
        let d2 = cand ? Math.pow(p1.x-cand.x,2)+Math.pow(p1.y-cand.y,2) : Infinity;
        if(d2<minD2){minD2=d2; best=cand;}
    }); return best;
};

const MapEvents = ({ onMapClick, onMapDblClick, onMapRightClick, onMouseMove }) => {
    useMapEvents({ 
        click(e){if(onMapClick) onMapClick(e);},
        dblclick(e){if(onMapDblClick) onMapDblClick(e);}, 
        contextmenu(e){if(onMapRightClick) onMapRightClick(e);},
        mousemove(e){if(onMouseMove) onMouseMove(e);}
    }); 
    return null;
};

const Info = () => {
    const map = useMap();
    useEffect(() => {
        const info = L.control({ position: 'bottomright' });
        info.onAdd = function () {
            this._div = L.DomUtil.create('div', 'info-control');
            this.update();
            return this._div;
        };
        info.update = function () {
            this._div.innerHTML = '<h4>Map Controls</h4>' +
                '<b>Double-click</b> to place a marker.<br/> - Click Confirm after placing it! <br/>' +
                '<b>Right-click</b> a path node to remove it.<br/>' +
                'Use the search bar to find locations.';
        };
        info.addTo(map);
        return () => info.remove();
    }, [map]);
    return null;
}

const MapModal = ({ show, onHide, onSelect, initialQuery='', setIsUploadingMapImage, mapTargetField, selectedForm }) => {
    const { user: gtawUser, isAuthenticated, characterName } = useGtaWorldAuth();
    const { currentUser } = useAuth();
    const [debugMode, setDebugMode] = useState(false);
    const [adminFixMode, setAdminFixMode] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const [tempPath, setTempPath] = useState([]);
    const [markers, setMarkers] = useState([]);
    const [fixMarkers, setFixMarkers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState(initialQuery);
    const [savePathModalVisible, setSavePathModalVisible] = useState(false);
    const [savePathName, setSavePathName] = useState('');
    const [reporting, setReporting] = useState(null);
    const [isSnapshotting, setIsSnapshotting] = useState(false);
    const [selectedStreetForEditing, setSelectedStreetForEditing] = useState(null);
    const [liveMapData, setLiveMapData] = useState({ streets: [], hospitals: [], buildings: [], regions: [] });
    
    // --- EXPERIMENTAL: Regional Zones ---
    const [isDrawingRegion, setIsDrawingRegion] = useState(false);
    const [regionStart, setRegionStart] = useState(null);
    const [tempRegion, setTempRegion] = useState(null);
    const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
    const [tempPolygonPath, setTempPolygonPath] = useState([]);

    const [strobeOpacity, setStrobeOpacity] = useState(1.0);
    const isProduction = import.meta.env.PROD;
    const isAuthorized = !isProduction; // Restrict to development environments
    const [showStreets, setShowStreets] = useState(isAuthorized);
    const mapRef = useRef(null);
    const hasConfirmedRef = useRef(false);

    const { showNotification } = useNotification();
    const { handleImageUpload } = useImageUpload(showNotification, null);

    const isMassFatality = useMemo(() => {
        return selectedForm?.id === 'mass-fatality' || 
               selectedForm?.firebaseKey === 'mass-fatality' ||
               selectedForm?.firebaseKey === 'mass-ftality-test';
    }, [selectedForm]);

    // Handle Abrupt Close (Auto-Save Draft)
    useEffect(() => {
        if (!show && !hasConfirmedRef.current && onSelect && markers.length > 0 && !isMassFatality) {
            const m = markers[markers.length - 1];
            const name = m.nearest + (m.crossStreet ? ` & ${m.crossStreet}` : "");
            onSelect({ 
                name: name, 
                rawName: name, 
                gameX: parseFloat(m.gameX), 
                gameY: parseFloat(m.gameY), 
                screenshot: null, 
                isFromMap: true 
            });
            setMarkers([]); 
        }
    }, [show, markers, onSelect, isMassFatality]);

    useEffect(() => {
        const interval = setInterval(() => {
            setStrobeOpacity(prev => (prev === 1.0 ? 0.3 : 1.0));
        }, 800);
        return () => clearInterval(interval);
    }, []);

    const formatDisplayName = (n) => n ? n.replace(/\s*\(zone\s*\d+\)\s*/gi, '').trim() : 'Unknown';

    useEffect(() => {
        if (!show) return;
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const snapshot = await get(ref(database, 'verified_locations'));
                if (snapshot.exists()) {
                    let mS = []; let mH = []; let mB = []; let mR = [];
                    Object.values(snapshot.val()).forEach(fix => {
                        const item = { ...fix };
                        if (fix.gameX !== undefined) item.x = fix.gameX;
                        if (fix.gameY !== undefined) item.y = fix.gameY;
                        if (fix.type === 'Street') mS.push(item);
                        else if (fix.type === 'Hospital') mH.push(item);
                        else if (fix.type === 'Building') mB.push(item);
                        else if (fix.type === 'Region' || fix.type === 'Polygon') mR.push(item);
                        else mH.push(item);
                    });
                    setLiveMapData({ streets: mS, hospitals: mH, buildings: mB, regions: mR });
                }
            } catch (err) { console.error(err); }
            finally { setIsLoading(false); }
        };
        fetchData();
    }, [show]);

    const handleLoadFixMarkers = () => {
        const s = (liveMapData.streets || []).filter(x => x.x !== undefined).map(x => ({ ...x, type: 'Street', id: `s-${x.name}`, position: gameToMap(x.x, x.y) }));
        const h = (liveMapData.hospitals || []).filter(x => x.x !== undefined).map(x => ({ ...x, type: 'Hospital', id: `h-${x.name}`, position: gameToMap(x.x, x.y) }));
        const b = (liveMapData.buildings || []).filter(x => x.x !== undefined).map(x => ({ ...x, type: 'Building', id: `b-${x.name}`, position: gameToMap(x.x, x.y) }));
        setFixMarkers([...h, ...s, ...b]);
    };

    const handleSavePath = () => {
        setSavePathName(selectedStreetForEditing ? selectedStreetForEditing.name : '');
        setSavePathModalVisible(true);
    };

    const confirmSavePath = async () => {
        const name = selectedStreetForEditing ? selectedStreetForEditing.name : savePathName;
        if (!name) return showNotification("Name required!", "warning");
        const key = name.toLowerCase().trim().replace(/[.#$[\\\]/]/g, "_");
        const pathData = tempPath.map(p => ({ x: p.x, y: p.y }));
        try {
            await set(ref(database, `verified_locations/${key}`), { name, type: 'Street', path: pathData, updatedAt: Date.now() });
            setLiveMapData(p => {
                const idx = p.streets.findIndex(x => x.name === name);
                const u = [...p.streets];
                if (idx !== -1) { u[idx] = { ...u[idx], path: pathData }; return { ...p, streets: u }; }
                return { ...p, streets: [...p.streets, { name, type: 'Street', path: pathData }] };
            });
            setTempPath([]); setIsDrawing(false); setSavePathModalVisible(false); setSelectedStreetForEditing(null);
            showNotification("Saved!", "success");
        } catch (err) { showNotification(`Failed to save path: ${err.message}`, "error"); }
    };

    const searchResults = useMemo(() => {
        if (!searchQuery || searchQuery.length < 2) return [];
        const q = searchQuery.toLowerCase();
        return [
            ...liveMapData.hospitals.map(h => ({...h, type: 'Hospital'})), 
            ...liveMapData.streets.map(s => ({...s, type: 'Street'})),
            ...liveMapData.buildings.map(b => ({...b, type: 'Building'}))
        ].filter(item => item.name.toLowerCase().includes(q)).slice(0, 8);
    }, [searchQuery, liveMapData]);

    const handleSelectLocation = (loc) => {
        setSearchQuery(formatDisplayName(loc.name));
        const gX = loc.x || loc.gameX || (loc.path ? loc.path[0].x : 0);
        const gY = loc.y || loc.gameY || (loc.path ? loc.path[0].y : 0);
        const mP = gameToMap(gX, gY);
        setMarkers([{ id: 'search', position: mP, gameX: gX, gameY: gY, nearest: loc.name, type: loc.type || 'Location' }]);
        if (mapRef.current) mapRef.current.flyTo(mP, 4);
    };

    const handleMapClick = (e) => {
        if (isDrawing) {
            const { lat, lng } = e.latlng;
            const g = mapToGame(lat, lng);
            setTempPath(p => [...p, { ...g, lat, lng }]);
        }
        if (isDrawingRegion) {
            const { lat, lng } = e.latlng;
            if (!regionStart) {
                setRegionStart([lat, lng]);
                setTempRegion([[lat, lng], [lat, lng]]);
            } else {
                setRegionStart(null); setTempRegion(null); setIsDrawingRegion(false);
            }
        }
        if (isDrawingPolygon) {
            const { lat, lng } = e.latlng;
            setTempPolygonPath(prev => [...prev, [lat, lng]]);
        }
    };

    const findNearestLocation = (gX, gY) => {
        const g = { x: parseFloat(gX), y: parseFloat(gY) };
        let results = [];

        // 1. Check Streets (Path based distance)
        (liveMapData.streets || []).forEach(s => {
            if (s.path && s.path.length > 1) {
                const dist = getDistPath(g, s.path);
                results.push({ name: s.name, dist, type: 'Street' });
            } else if (s.x !== undefined && s.y !== undefined) {
                 const dist = Math.sqrt(Math.pow(g.x - (s.x || s.gameX), 2) + Math.pow(g.y - (s.y || s.gameY), 2));
                 results.push({ name: s.name, dist, type: 'Street' });
            }
        });

        // 2. Check Hospitals/Buildings (Point based distance)
        [...(liveMapData.hospitals || []), ...(liveMapData.buildings || [])].forEach(loc => {
            const lx = loc.x || loc.gameX;
            const ly = loc.y || loc.gameY;
            if (lx !== undefined && ly !== undefined) {
                const dist = Math.sqrt(Math.pow(g.x - lx, 2) + Math.pow(g.y - ly, 2));
                results.push({ name: loc.name, dist, type: loc.type });
            }
        });

        if (results.length === 0) return { nearest: "Unknown Location", crossStreet: null };

        // Sort by distance
        results.sort((a, b) => a.dist - b.dist);

        const best = results[0];
        
        // Intersection Detection
        const streets = results.filter(r => r.type === 'Street');
        if (streets.length > 1) {
            const s1 = streets[0];
            const s2 = streets[1];
            // If we are close to both streets (within 60 units), call it an intersection
            if (s1.dist < 60 && s2.dist < 60 && s1.name !== s2.name) {
                return { nearest: s1.name, crossStreet: s2.name };
            }
        }

        return { nearest: best.name, crossStreet: null };
    };

    // Auto-resolve 'Checking...' markers when liveMapData is available
    useEffect(() => {
        if (!liveMapData.streets.length) return;
        
        const needsResolving = markers.some(m => m.nearest === 'Checking...');
        if (needsResolving) {
            setMarkers(prev => prev.map(m => {
                if (m.nearest === 'Checking...') {
                    const { nearest, crossStreet } = findNearestLocation(m.gameX, m.gameY);
                    return { ...m, nearest, crossStreet };
                }
                return m;
            }));
        }
    }, [markers, liveMapData]);

    const handleMapDblClick = (e) => {
        if (!e || !e.latlng || isDrawing || isDrawingRegion || isDrawingPolygon) return;
        const { lat, lng } = e.latlng; const g = mapToGame(lat, lng);
        const nm = { id: Date.now(), position: [lat, lng], gameX: g.x.toFixed(2), gameY: g.y.toFixed(2), nearest: 'Checking...', type: 'Body' };
        setMarkers(prev => isMassFatality ? [...prev, nm] : [nm]);
    };

    const handleRemoveMarker = (id) => {
        setMarkers(prev => prev.filter(m => m.id !== id));
    };

    const handleMapRightClick = (e) => {
        if (isDrawing) {
            setTempPath(p => p.slice(0, -1));
        }
    };

    const getMarkerName = (m) => {
        let n = m.nearest;
        let c = m.crossStreet;
        if (n === 'Checking...') {
            const res = findNearestLocation(m.gameX, m.gameY);
            n = res.nearest;
            c = res.crossStreet;
        }
        return n + (c ? ` & ${c}` : "");
    };

    const handleCaptureAll = async () => {
        setIsSnapshotting(true);
        try {
            // Force map to refresh its internal size and tile rendering state before capture
            if (mapRef.current) {
                mapRef.current.invalidateSize();
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            const { dataUrl, error } = await captureMapScreenshot(mapRef.current.getContainer());
            if (error && !dataUrl) {
                console.warn("Screenshot failed, falling back to text:", error);
                showNotification("Screenshot capture failed, using text-only location.", "warning");
            }
            const result = await handleImageUpload(dataUrl);
            const sU = result?.[0]?.url;

            // Resolve all marker names and count frequencies
            const counts = {};
            const resolvedMarkers = markers.map(m => {
                let n = m.nearest;
                if (n === 'Checking...') {
                    const res = findNearestLocation(m.gameX, m.gameY);
                    n = res.nearest;
                }
                counts[n] = (counts[n] || 0) + 1;
                return { ...m, resolvedName: n };
            });

            // Determine the primary street (highest frequency)
            let maxCount = 0;
            let primaryStreet = "Unknown Street";
            Object.entries(counts).forEach(([street, count]) => {
                if (count > maxCount) {
                    maxCount = count;
                    primaryStreet = street;
                }
            });

            const countText = `${markers.length} decedents on ${primaryStreet}`;
            const fN = sU ? `[url=${sU}]${countText}[/url]` : countText;
            
            if (onSelect) {
                onSelect({ 
                    name: fN, 
                    rawName: countText, 
                    gameX: markers[0]?.gameX || 0, 
                    gameY: markers[0]?.gameY || 0, 
                    screenshot: sU, 
                    isFromMap: true,
                    allMarkers: resolvedMarkers.map(m => ({ ...m, nearest: getMarkerName(m) })) 
                });
            }
            onHide();
        } catch (err) { 
            console.error("Capture All failed:", err);
            showNotification("Error capturing locations: " + err.message, "error"); 
        }
        finally { setIsSnapshotting(false); }
    };

    const handleReportLocation = async (marker) => {
        hasConfirmedRef.current = true;
        let name = getMarkerName(marker);
        setReporting(marker.id);
        setIsSnapshotting(true);
        try {
            // Force map to refresh its internal size and tile rendering state before capture
            if (mapRef.current) {
                mapRef.current.invalidateSize();
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            const { dataUrl, error } = await captureMapScreenshot(mapRef.current.getContainer());
            if (error && !dataUrl) {
                console.warn("Screenshot failed, falling back to text:", error);
                showNotification("Screenshot capture failed, using text-only location.", "warning");
            }
            const result = await handleImageUpload(dataUrl);
            const sU = result?.[0]?.url;
            const fN = sU ? `[url=${sU}]${name}[/url]` : name;
            if (onSelect) onSelect({ name: fN, rawName: name, gameX: parseFloat(marker.gameX), gameY: parseFloat(marker.gameY), screenshot: sU, isFromMap: true });
            onHide();
        } catch (err) { 
            console.error("Report Location failed:", err);
            showNotification("Error reporting location: " + err.message, "error"); 
        }
        finally { setReporting(null); setIsSnapshotting(false); }
    };

    return (
        <BaseModal
            isOpen={show}
            onClose={onHide}
            title={onSelect ? "Select Location" : "GTA V Interactive Map"}
            modalSize="full"
            variant="info"
            noPadding={true}
            footer={
                <div className="d-flex justify-content-between w-100 align-items-center">
                    <div>
                        {isLoading && <small className="text-info"><i className="fas fa-spinner fa-spin me-2"></i>Syncing Map Data...</small>}
                    </div>
                    <div className="d-flex gap-2">
                        {markers.length > 0 && <Button variant="outline-danger" size="sm" onClick={() => setMarkers([])} disabled={isSnapshotting}>Clear All</Button>}
                        {isMassFatality && markers.length > 0 && <Button variant="danger" size="sm" onClick={handleCaptureAll} disabled={isSnapshotting}>Capture All ({markers.length})</Button>}
                        <Button variant="secondary" size="sm" onClick={onHide}>Close Map</Button>
                    </div>
                </div>
            }
        >
            <div style={{ height: '100%', width: '100%', position: 'relative', display: 'flex', flexDirection: 'column', backgroundColor: '#000' }}>
                <style>{`
                    .info-control { padding: 10px; background: rgba(13, 17, 23, 0.9); color: #fff; border: 1px solid #30363d; border-radius: 8px; }
                    .info-control h4 { margin: 0 0 5px; font-size: 1rem; color: #58a6ff; }
                    .search-overlay { position: absolute; top: 15px; left: 15px; z-index: 1000; width: 300px; }
                    .admin-overlay { position: absolute; top: 15px; right: 15px; z-index: 1000; background: rgba(13,17,23,0.9); padding: 12px; border-radius: 10px; border: 1px solid #30363d; }
                `}</style>

                {/* Search Overlay */}
                <div className="search-overlay">
                    <InputGroup size="sm">
                        <InputGroup.Text className="bg-dark border-secondary text-light"><i className="fas fa-search"></i></InputGroup.Text>
                        <Form.Control placeholder="Search streets or buildings..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-dark border-secondary text-light shadow-none" />
                    </InputGroup>
                    {searchQuery.length > 1 && searchResults.length > 0 && (
                        <ListGroup className="mt-1 shadow-lg">
                            {searchResults.map((res, i) => (
                                <ListGroup.Item key={i} className="bg-dark text-light border-secondary" onClick={() => handleSelectLocation(res)} style={{ cursor: 'pointer' }}>
                                    <div className="d-flex justify-content-between"><span>{formatDisplayName(res.name)}</span><small className="text-muted">{res.type}</small></div>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    )}
                </div>

                {/* Admin Overlay */}
                {isAuthorized && (
                    <div className="admin-overlay">
                        <Form.Check type="switch" label="Debug" checked={debugMode} onChange={e => setDebugMode(e.target.checked)} className="text-light small mb-2" />
                        <Form.Check type="switch" label="Admin Fix" checked={adminFixMode} onChange={e => setAdminFixMode(e.target.checked)} className="text-warning small mb-2" />
                        {adminFixMode && (
                            <div className="d-flex flex-column gap-1">
                                <Form.Check type="switch" label="Show Paths" checked={showStreets} onChange={e => setShowStreets(e.target.checked)} className="text-info small mb-2" />
                                <Button variant="warning" size="sm" onClick={handleLoadFixMarkers} style={{ fontSize: '0.7rem' }}>Load Markers</Button>
                                <Button variant={isDrawing ? "danger" : "info"} size="sm" onClick={() => { setIsDrawing(!isDrawing); setTempPath([]); }} style={{ fontSize: '0.7rem' }}>{isDrawing ? "Cancel Path" : "Draw Path"}</Button>
                                {isDrawing && tempPath.length > 1 && <Button variant="success" size="sm" onClick={handleSavePath} style={{ fontSize: '0.7rem' }}>Save Path</Button>}
                            </div>
                        )}
                    </div>
                )}

                {/* Map Container */}
                <div style={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
                    <MapContainer 
                        center={gameToMap(0, 0)} 
                        zoom={3} 
                        minZoom={2} 
                        maxZoom={MAX_ZOOM} 
                        crs={L.extend({}, L.CRS.Simple, { transformation: new L.Transformation(1/32, 0, 1/32, 0) })} 
                        style={{ height: '100%', width: '100%', background: '#000' }} 
                        ref={mapRef}
                    >
                        <TileLayer url={`${import.meta.env.BASE_URL}assets/map-tiles/{z}/{y}/{x}.jpg`} noWrap={true} />
                        <MapEvents onMapClick={handleMapClick} onMapDblClick={handleMapDblClick} onMapRightClick={handleMapRightClick} />
                        <Info />

                        {/* Drawing Path */}
                        {isDrawing && tempPath.length > 0 && (
                            <Polyline 
                                positions={tempPath.map(p => [p.lat, p.lng])} 
                                pathOptions={{ color: "#ff4444", weight: 6, opacity: strobeOpacity }} 
                            />
                        )}

                        {/* Permanent Markers */}
                        {liveMapData.hospitals.filter(h => h.x !== undefined).map((h, i) => (
                            <Marker key={`h-${i}`} position={gameToMap(h.x, h.y)} icon={HospitalIcon}>
                                <Popup><div className="text-dark"><strong>{h.name}</strong></div></Popup>
                            </Marker>
                        ))}

                        {/* User Placed Markers */}
                        {markers.map((m) => (
                            <Marker key={m.id} position={m.position} icon={m.type === 'Body' ? BodyIcon : BuildingIcon}>
                                <Popup>
                                    <div className="text-dark p-2" style={{ minWidth: '180px' }}>
                                        <strong>{getMarkerName(m).replace(' & ', ' x ')}</strong><br/>
                                        <small className="text-muted">{m.type} Location (X:{m.gameX} Y:{m.gameY})</small>
                                        <div className="d-flex gap-2 mt-2">
                                            <Button variant="primary" size="sm" className="flex-grow-1" onClick={() => handleReportLocation(m)} disabled={isSnapshotting}>
                                                {isSnapshotting ? <Spinner size="sm" /> : "Confirm"}
                                            </Button>
                                            <Button variant="outline-danger" size="sm" onClick={() => handleRemoveMarker(m.id)} disabled={isSnapshotting} title="Remove Marker">
                                                <i className="fas fa-trash"></i>
                                            </Button>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}

                        {/* Streets / Paths */}
                        {showStreets && liveMapData.streets.filter(s => s.path).map((s, i) => (
                            <Polyline 
                                key={i} 
                                positions={s.path.map(p => gameToMap(p.x, p.y)).filter(pos => pos[0] !== 0 || pos[1] !== 0)} 
                                pathOptions={{ color: "#58a6ff", weight: 4, opacity: 0.6 }} 
                            />
                        ))}
                    </MapContainer>
                </div>
            </div>
        </BaseModal>
    );
};

export default MapModal;
