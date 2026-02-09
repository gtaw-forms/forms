import React, { useState, useMemo, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Button, Form, ListGroup, InputGroup, Badge } from 'react-bootstrap';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Rectangle, Polygon, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { captureMapScreenshot } from '../../utils/mapImageUploadUtils';
import { useImageUpload } from '../../hooks/useImageUpload';
import 'leaflet/dist/leaflet.css';
import { ref, set, get, getDatabase } from 'firebase/database';
import { useGtaWorldAuth } from '../../hooks/useGtaWorldAuth';
import { isGoogleAuthenticated, getGoogleUser } from '../../services/gtaWorldAuth';
import { sendDiscordWebhook } from '../../utils/webhookUtils';
import { useAuth } from '../../contexts/AuthContext';
import { database } from '../../firebase';
import { useNotification } from '../../contexts/NotificationContext';
import phmcLogo from '../../assets/hospital_logo.png';

// --- LEAFLET ICON FIXES ---
const DefaultIcon = L.icon({
    iconUrl: `${import.meta.env.BASE_URL}assets/leaflet/marker-icon.png`,
    iconRetinaUrl: `${import.meta.env.BASE_URL}assets/leaflet/marker-icon-2x.png`,
    shadowUrl: `${import.meta.env.BASE_URL}assets/leaflet/marker-shadow.png`,
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
if (L.Marker.prototype.options) { L.Marker.prototype.options.icon = DefaultIcon; }
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: `${import.meta.env.BASE_URL}assets/leaflet/marker-icon.png`,
    iconRetinaUrl: `${import.meta.env.BASE_URL}assets/leaflet/marker-icon-2x.png`,
    shadowUrl: `${import.meta.env.BASE_URL}assets/leaflet/marker-shadow.png`,
});

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
const gameToMap = (gX, gY) => [((maxY - gY) / (maxY - minY)) * MAP_HEIGHT, ((gX - minX) / (maxX - minX)) * MAP_WIDTH];
const mapToGame = (mY, mX) => ({ x: (mX / MAP_WIDTH) * (maxX - minX) + minX, y: maxY - (mY / MAP_HEIGHT) * (maxY - minY) });
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
            this._div = L.DomUtil.create('div', 'info');
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
        return () => {
            info.remove();
        }
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
    const [showGrid, setShowGrid] = useState(false);
    const [markers, setMarkers] = useState([]);
    const [fixMarkers, setFixMarkers] = useState([]);
    const [showFixMarkers, setShowFixMarkers] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState(initialQuery);
    const [showResults, setShowResults] = useState(false);
    const [savePathModalVisible, setSavePathModalVisible] = useState(false);
    const [savePathName, setSavePathName] = useState('');
    const [reporting, setReporting] = useState(null);
    const [isSnapshotting, setIsSnapshotting] = useState(false);
    const [selectedStreetForEditing, setSelectedStreetForEditing] = useState(null);
    const [liveMapData, setLiveMapData] = useState({ streets: [], hospitals: [], buildings: [], regions: [] });
    
    // --- EXPERIMENTAL: Regional Zones ---
    const [isDrawingRegion, setIsDrawingRegion] = useState(false);
    const [regionStart, setRegionStart] = useState(null); // [lat, lng]
    const [tempRegion, setTempRegion] = useState(null); // [[lat1, lng1], [lat2, lng2]]
    
    const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
    const [tempPolygonPath, setTempPolygonPath] = useState([]); // [[lat, lng], ...]
    // ------------------------------------

    const [strobeOpacity, setStrobeOpacity] = useState(1.0);
    const [fakeRestriction, setFakeRestriction] = useState(true);
    const [mapEnabled, setMapEnabled] = useState(false);
    const [viewPaths, setViewPaths] = useState(false);
    const [showRegions, setShowRegions] = useState(true);
    const [showStreets, setShowStreets] = useState(true);
    const mapRef = useRef(null);
    const hasConfirmedRef = useRef(false);

    const isMassFatality = useMemo(() => {
        return selectedForm?.name === 'Mass Fatality Report' || 
               selectedForm?.id === 'mass-fatality' || 
               selectedForm?.firebaseKey === 'mass-fatality' ||
               selectedForm?.firebaseKey === 'mass-ftality-test'; // handle typo from legacy
    }, [selectedForm]);

    // Handle Abrupt Close (Auto-Save Draft)
    useEffect(() => {
        if (show) {
            hasConfirmedRef.current = false;
        } else {
            // Modal closing
            if (!hasConfirmedRef.current && onSelect && markers.length > 0 && !isMassFatality) {
                const m = markers[markers.length - 1]; // Use last placed marker
                const name = m.nearest + (m.crossStreet ? ` & ${m.crossStreet}` : "");
                
                console.log("[MapModal] Abrupt close detected. Auto-saving draft location:", name);
                
                onSelect({ 
                    name: name, // Plain text, no BBCode URL
                    rawName: name, 
                    gameX: parseFloat(m.gameX), 
                    gameY: parseFloat(m.gameY), 
                    screenshot: null, 
                    isFromMap: true 
                });
                
                // Optional: clear markers so it doesn't trigger again if state persists (though component might unmount)
                setMarkers([]); 
            }
        }
    }, [show, markers, onSelect, isMassFatality]);

    useEffect(() => {
        const fetchMapStatus = async () => {
            try {
                const dbRef = ref(database, '/map/settings/enabled');
                const snapshot = await get(dbRef);
                if (snapshot.exists()) {
                    setMapEnabled(snapshot.val());
                }
            } catch (error) {
                console.error("Error fetching map status:", error);
            }
        };
        fetchMapStatus();
    }, []);

    const isGoogleAdmin = isGoogleAuthenticated();
    const googleUser = getGoogleUser();
    // Allow any authenticated user (or dev mode) to see debug controls for now, or revert to strict perms later.
    // Original: const isAuthorized = isGoogleAdmin || (gtawUser?.faction_rank_id >= 13 && gtawUser?.faction === 'PHMC');
    // Fix: For now, let's enable it for any authenticated PHMC member to allow drawing/debugging or use isProduction flag.
    const isAuthorized = true; // FORCE ENABLE FOR DEBUGGING AS REQUESTED

    const { showNotification } = useNotification();
    const { isUploading: isUploadingHook, handleImageUpload } = useImageUpload(showNotification, null);

    const isProduction = import.meta.env.PROD;

    // Manage restriction overlay based on mapEnabled status
    useEffect(() => {
        if (show) {
            setFakeRestriction(!mapEnabled);
        }
    }, [show, mapEnabled]);

    // Manual Strobe Logic (Bypasses Leaflet SVG Overrides)
    useEffect(() => {
        const interval = setInterval(() => {
            setStrobeOpacity(prev => (prev === 1.0 ? 0.3 : 1.0));
        }, 800);
        return () => clearInterval(interval);
    }, []);

    const formatDisplayName = (n) => n ? n.replace(/\s*\(zone\s*\d+\)\s*/gi, '').trim() : 'Unknown';

    // Styles
    const overlayStyle = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 };
    const containerStyle = { backgroundColor: '#0d1117', color: '#c9d1d9', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', border: '1px solid #30363d' };
    const headerStyle = { padding: '10px 20px', backgroundColor: '#161b22', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 };

    const factor = 1 / Math.pow(2, MAX_ZOOM);
    const crs = L.extend({}, L.CRS.Simple, { transformation: new L.Transformation(factor, 0, factor, 0) });
    const bounds = [[0, 0], [MAP_HEIGHT, MAP_WIDTH]];
    const phmcPos = gameToMap(340.8, -1396.9);

    const logMapAction = async (action, details) => {
        const url = import.meta.env.VITE_DISCORD_WEBHOOK_ADMIN || import.meta.env.VITE_DEV_WEBHOOK; if (!url) return;
        const payload = { embeds: [{ title: `🗺️ Map Action: ${action}`, color: action.toLowerCase().includes('fix')||action.toLowerCase().includes('path')?0xFFAA00:0x28A745, fields: [{name:"Env",value:isProduction?"🚀 Prod":"🛠️ Local",inline:true},{name:"User",value:gtawUser?.username||"Unknown",inline:true},{name:"Char",value:characterName||"N/A",inline:true},{name:"Action",value:action,inline:false},...details], timestamp: new Date().toISOString() }] };
        try { await sendDiscordWebhook(url, payload); } catch(err){console.error(err);}
    };

    useEffect(() => {
        if (!show) return;
        const fetchData = async () => {
            setIsLoading(true);
            try {
                let mS = []; let mH = []; let mB = []; let mR = [];
                const snapshot = await get(ref(database, 'verified_locations'));
                if (snapshot.exists()) {
                    Object.values(snapshot.val()).forEach(fix => {
                        const item = { ...fix };
                        if (fix.gameX !== undefined) item.x = fix.gameX;
                        if (fix.gameY !== undefined) item.y = fix.gameY;

                        if (fix.type === 'Street') mS.push(item);
                        else if (fix.type === 'Hospital') mH.push(item);
                        else if (fix.type === 'Building') mB.push(item);
                        else if (fix.type === 'Region' || fix.type === 'Polygon') mR.push(item);
                        else mH.push(item); // Fallback
                    });
                }
                setLiveMapData({ streets: mS, hospitals: mH, buildings: mB, regions: mR });
            } catch (err) {
                console.error("Error fetching live map data:", err);
                setLiveMapData({ streets: [], hospitals: [], buildings: [], regions: [] });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [show]);

    const handleLoadFixMarkers = () => {
        const s = (liveMapData.streets || []).filter(x => x.x !== undefined).map(x => ({ ...x, type: 'Street', id: `s-${x.name}`, position: gameToMap(x.x, x.y) }));
        const h = (liveMapData.hospitals || []).filter(x => x.x !== undefined).map(x => ({ ...x, type: 'Hospital', id: `h-${x.name}`, position: gameToMap(x.x, x.y) }));
        const b = (liveMapData.buildings || []).filter(x => x.x !== undefined).map(x => ({ ...x, type: 'Building', id: `b-${x.name}`, position: gameToMap(x.x, x.y) }));
        setFixMarkers([...h, ...s, ...b]);
    };

    const handleFixMarkerDragEnd = async (e, m) => {
        const { lat, lng } = e.target.getLatLng(); const g = mapToGame(lat, lng);
        const key = m.name.toLowerCase().trim().replace(/[.#$[\\\]/]/g, "_");
        try {
            await set(ref(database, `verified_locations/${key}`), { name: m.name, type: m.type, gameX: parseFloat(g.x.toFixed(2)), gameY: parseFloat(g.y.toFixed(2)), updatedAt: Date.now() });
            setFixMarkers(p => p.map(x => x.id === m.id ? { ...x, position: [lat, lng] } : x));
            logMapAction("Marker Fixed", [{ name: "Loc", value: m.name, inline: true }, { name: "Coords", value: `X:${g.x.toFixed(2)}, Y:${g.y.toFixed(2)}`, inline: true }]);
        } catch (err) { console.error(err); }
    };

    const handleDeletePath = async (s) => {
        if (!window.confirm(`Delete path for "${s.name}"?`)) return;
        const key = s.name.toLowerCase().trim().replace(/[.#$[\\\]/]/g, "_");
        try {
            await set(ref(database, `verified_locations/${key}`), null);
            setLiveMapData(p => ({ ...p, streets: p.streets.filter(x => x.name !== s.name) }));
            logMapAction("Path Deleted", [{ name: "Street", value: s.name, inline: true }]);
        } catch (err) { 
            console.error("MapModal - handleDeletePath error:", err);
            showNotification(`Failed to delete path: ${err.message}`, "error"); 
        }
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
                if (idx !== -1) { const u = [...p.streets]; u[idx] = { ...u[idx], path: pathData }; return { ...p, streets: u }; }
                return { ...p, streets: [...p.streets, { name, type: 'Street', path: pathData }] };
            });
            setTempPath([]); setIsDrawing(false); setSavePathModalVisible(false); setSelectedStreetForEditing(null); showNotification("Saved!", "success");
            logMapAction("Path Saved", [{ name: "Street", value: name, inline: true }, { name: "Nodes", value: `${pathData.length} pts`, inline: true }]);
        } catch (err) { 
            console.error("MapModal - confirmSavePath error:", err);
            showNotification(`Failed to save path: ${err.message}`, "error"); 
        }
    };

    const searchResults = useMemo(() => {
        if (!searchQuery || searchQuery.length < 2) return [];
        if (searchQuery.includes(',')) {
            const pts = searchQuery.split(',').map(s => s.trim().toLowerCase());
            if (pts.length === 2 && pts[0] && pts[1]) {
                const sts = liveMapData.streets.map(s => ({...s, type: 'Street'}));
                const m1 = sts.find(s => s.name.toLowerCase().includes(pts[0]));
                const m2 = sts.find(s => s.name.toLowerCase().includes(pts[1]));
                if (m1 && m2) return [{ name: `${formatDisplayName(m1.name)} & ${formatDisplayName(m2.name)}`, type: 'Intersection', loc1: m1, loc2: m2 }];
            }
        }
        const q = searchQuery.toLowerCase();
        return [
            ...liveMapData.hospitals.map(h => ({...h, type: 'Hospital'})), 
            ...liveMapData.streets.map(s => ({...s, type: 'Street'})),
            ...liveMapData.buildings.map(b => ({...b, type: 'Building'}))
        ].filter(item => item.name.toLowerCase().includes(q)).slice(0, 8);
    }, [searchQuery, liveMapData]);

    const handleMapClick = (e) => {
        if (isDrawing) {
            if (!e || !e.latlng) return;
            const { lat, lng } = e.latlng;
            const g = mapToGame(lat, lng);
            setTempPath(p => [...p, { ...g, lat, lng }]);
        }
        
        // --- EXPERIMENTAL: Regional Zone Click Logic ---
        if (isDrawingRegion) {
            if (!e || !e.latlng) return;
            const { lat, lng } = e.latlng;
            
            if (!regionStart) {
                setRegionStart([lat, lng]);
                setTempRegion([[lat, lng], [lat, lng]]);
            } else {
                // Finalize drawing
                const bounds = [regionStart, [lat, lng]];
                const name = prompt("Enter name for this Regional Zone (e.g. Chiliad State Wilderness):");
                if (name) {
                    saveRegionalZone(name, bounds);
                }
                setRegionStart(null);
                setTempRegion(null);
                setIsDrawingRegion(false);
            }
        }

        if (isDrawingPolygon) {
            if (!e || !e.latlng) return;
            const { lat, lng } = e.latlng;
            setTempPolygonPath(prev => [...prev, [lat, lng]]);
        }
        // ----------------------------------------------
    };

    const handleSavePolygon = async () => {
        if (tempPolygonPath.length < 3) return showNotification("Polygons need at least 3 points!", "warning");
        const name = prompt("Enter name for this Territorial Polygon (e.g. Grove Street Neighborhood):");
        if (!name) return;

        const key = name.toLowerCase().trim().replace(/[.#$[\\\]/]/g, "_");
        try {
            const data = {
                name,
                type: 'Polygon',
                positions: tempPolygonPath, // Store points
                updatedAt: Date.now()
            };
            await set(ref(database, `verified_locations/${key}`), data);
            setLiveMapData(p => ({ ...p, regions: [...p.regions, data] }));
            setTempPolygonPath([]);
            setIsDrawingPolygon(false);
            showNotification(`Polygon "${name}" saved!`, "success");
            logMapAction("Polygon Saved", [{ name: "Name", value: name, inline: true }]);
        } catch (err) {
            console.error("Failed to save polygon:", err);
            showNotification("Error saving polygon: " + err.message, "error");
        }
    };

    const handleMouseMove = (e) => {
        if (isDrawingRegion && regionStart && e.latlng) {
            setTempRegion([regionStart, [e.latlng.lat, e.latlng.lng]]);
        }
    };

    // --- EXPERIMENTAL: Save Logic ---
    const saveRegionalZone = async (name, bounds) => {
        const key = name.toLowerCase().trim().replace(/[.#$[\\\]/]/g, "_");
        // Convert map bounds back to game coordinates for storage? 
        // Or store bounds directly as [[lat,lng],[lat,lng]]
        try {
            const data = {
                name,
                type: 'Region',
                bounds: bounds, // Store as [[lat1, lng1], [lat2, lng2]]
                updatedAt: Date.now()
            };
            await set(ref(database, `verified_locations/${key}`), data);
            setLiveMapData(p => ({ ...p, regions: [...p.regions, data] }));
            showNotification(`Region "${name}" saved!`, "success");
            logMapAction("Region Saved", [{ name: "Name", value: name, inline: true }]);
        } catch (err) {
            console.error("Failed to save regional zone:", err);
            showNotification("Error saving region: " + err.message, "error");
        }
    };
    // --------------------------------

    const handleMapDblClick = (e) => {
        if (!e || !e.latlng || (!isAuthenticated && isProduction)) return;
        if (isDrawing || isDrawingRegion || isDrawingPolygon) return; // Disable marker placement while drawing

        const { lat, lng } = e.latlng; const g = mapToGame(lat, lng);
        
        const all = [...liveMapData.hospitals.map(h => ({...h, type: 'Hospital'})), ...liveMapData.streets.map(s => ({...s, type: 'Street'}))];
        const sorted = all.map(loc => ({ ...loc, distance: loc.path ? getDistPath(g, loc.path) : (loc.x !== undefined ? Math.sqrt(Math.pow(loc.x - g.x, 2) + Math.pow(loc.y - g.y, 2)) : Infinity) }))
            .filter(l => l.distance !== Infinity).sort((a, b) => a.distance - b.distance);

        const p1 = sorted[0];
        const p2 = sorted.find(l => l.type === 'Street' && formatDisplayName(l.name) !== formatDisplayName(p1?.name));
        let cross = (p1?.type === 'Street' && p2 && p2.distance < 60) ? p2.name : null;
        
        // --- EXPERIMENTAL: Region Detection ---
        const regionMatch = liveMapData.regions.find(r => {
            if (r.type === 'Region' && r.bounds) {
                return L.latLngBounds(r.bounds).contains([lat, lng]);
            }
            if (r.type === 'Polygon' && r.positions) {
                return L.latLngBounds(r.positions).contains([lat, lng]);
            }
            return false;
        });
        const regionName = regionMatch ? regionMatch.name : null;
        // --------------------------------------

        const nm = { 
            id: Date.now(), 
            position: [lat, lng], 
            gameX: g.x.toFixed(2), 
            gameY: g.y.toFixed(2), 
            nearest: p1?.name || 'Unknown', 
            crossStreet: cross, 
            region: regionName, // Add region to marker
            source: 'Manual', 
            type: 'Body', 
            distance: p1 ? p1.distance.toFixed(1) : "0" 
        };
        
        // Modified Logic: If Mass Fatality, always append. If onSelect (and not MF), replace.
        setMarkers(prev => {
            if (isMassFatality) return [...prev, nm];
            if (onSelect) return [nm];
            return [...prev, nm];
        });
    };

    const handleSelectLocation = (loc) => {
        let mP; let gX, gY;
        setSearchQuery(loc.type === 'Intersection' ? loc.name : formatDisplayName(loc.name)); setShowResults(false);
        if (loc.type === 'Intersection') {
            const b = findClosestBetween(loc.loc1, loc.loc2);
            gX = b ? b.x : loc.loc2.x || 0; gY = b ? b.y : loc.loc2.y || 0; mP = gameToMap(gX, gY);
        } else {
            gX = loc.x || loc.path?.[0].x || 0; gY = loc.y || loc.path?.[0].y || 0; mP = gameToMap(gX, gY);
        }

        // --- EXPERIMENTAL: Region Detection for Search ---
        const regionMatch = liveMapData.regions.find(r => {
            if (r.type === 'Region' && r.bounds) {
                return L.latLngBounds(r.bounds).contains(mP);
            }
            if (r.type === 'Polygon' && r.positions) {
                return L.latLngBounds(r.positions).contains(mP);
            }
            return false;
        });
        const regionName = regionMatch ? regionMatch.name : null;
        // ------------------------------------------------

        setMarkers([{ 
            id: 'search', 
            position: mP, 
            gameX: gX, 
            gameY: gY, 
            nearest: loc.name, 
            region: regionName, // Add region to marker
            source: loc.source || 'Search', 
            type: loc.type || 'Location', 
            distance: "0" 
        }]);
        if (mapRef.current) mapRef.current.flyTo(mP, 4);
    };

    const handleReportLocation = async (marker) => {
        hasConfirmedRef.current = true;
        let rN = marker.nearest + (marker.crossStreet ? ` & ${marker.crossStreet}` : "");
        let name = onSelect ? (searchQuery || rN) : rN;

        // Only prompt if it's NOT a body location, otherwise just use the location name
        if (marker.type !== 'Body') {
            let pT = "Location Name:"; 
            if (marker.type === 'Building') pT = "Building Name:";
            const userProvidedName = prompt(pT, name);
            if (!userProvidedName) return;
            name = userProvidedName;
        }
        
        setReporting(marker.id); const snapshot = !!onSelect;
        if (snapshot) { setIsSnapshotting(true); if (setIsUploadingMapImage && mapTargetField) setIsUploadingMapImage(prev => ({ ...prev, [mapTargetField]: true })); }

        let sU = null; let fN = name;
        try {
            if (snapshot) {
                const { dataUrl, error } = await captureMapScreenshot(mapRef.current.getContainer());
                if (dataUrl) {
                    const result = await handleImageUpload(dataUrl);
                    if (result && result.length > 0) {
                        sU = result[0].url;
                        fN = `[url=${sU}]${name}[/url]`;
                    } else {
                        showNotification("Img Upload Failed", "error");
                    }
                } else if (error) {
                    showNotification("Screenshot Failed: " + error, "error");
                }
            }

            const key = name.toLowerCase().trim().replace(/[.#$[\\\]/]/g, "_");

            if (marker.type === 'Building') {
                await set(ref(database, `verified_locations/${key}`), { name, type: 'Building', gameX: parseFloat(marker.gameX), gameY: parseFloat(marker.gameY), updatedAt: Date.now() });
                // Also update local state to show it immediately
                setLiveMapData(prev => ({ ...prev, buildings: [...prev.buildings, { name, type: 'Building', x: parseFloat(marker.gameX), y: parseFloat(marker.gameY) }] }));
            } else {
                // Check if this location is already known to prevent logging known streets as "untracked"
                const isKnownStreet = liveMapData.streets.some(s => s.name.toLowerCase() === name.toLowerCase());
                const isKnownHospital = liveMapData.hospitals.some(h => h.name.toLowerCase() === name.toLowerCase());
                const isKnownBuilding = liveMapData.buildings.some(b => b.name.toLowerCase() === name.toLowerCase());

                if (!isKnownStreet && !isKnownHospital && !isKnownBuilding) {
                    await set(ref(database, `untracked_locations_log/${key}`), { place: name, timestamp: Date.now(), gameX: parseFloat(marker.gameX), gameY: parseFloat(marker.gameY), nearestStreet: marker.nearest, source: "Map", type: marker.type });
                } else {
                    console.log(`[MapModal] Skipping untracked log for '${name}' as it is already a known location.`);
                }
            }

            if (onSelect) onSelect({ name: fN, rawName: name, gameX: parseFloat(marker.gameX), gameY: parseFloat(marker.gameY), screenshot: sU, isFromMap: true });
            else showNotification("Reported successfully!", "success");
            logMapAction("Location Reported", [{ name: "Type", value: marker.type, inline: true }, { name: "Name", value: name, inline: true }, { name: "Nearest", value: marker.nearest, inline: true }, { name: "Coords", value: `X:${marker.gameX}, Y:${marker.gameY}`, inline: false }]);
        } catch (err) { 
            console.error("MapModal - handleReportLocation error:", err);
            showNotification(`Error saving location: ${err.message || "Unknown error"}`, "error"); 
        } finally { setReporting(null); setIsSnapshotting(false); if (setIsUploadingMapImage && mapTargetField) setIsUploadingMapImage(prev => ({ ...prev, [mapTargetField]: false })); if (snapshot) onHide(); }
    };

    const handleMassFatalityCapture = async () => {
        hasConfirmedRef.current = true;
        if (markers.length === 0) {
            showNotification("No markers placed on the map.", "warning");
            return;
        }

        setIsSnapshotting(true);
        if (setIsUploadingMapImage && mapTargetField) setIsUploadingMapImage(prev => ({ ...prev, [mapTargetField]: true }));

        try {
            const { dataUrl, error } = await captureMapScreenshot(mapRef.current.getContainer());
            if (error) throw new Error(error);
            
            const urls = await handleImageUpload(dataUrl);
            if (!urls || urls.length === 0) throw new Error("Image upload failed");

            const sU = urls[0].url;
            
            // Generate a descriptive name for the location(s)
            let locationName = "Multiple Locations";
            if (markers.length === 1) {
                locationName = markers[0].nearest + (markers[0].crossStreet ? ` & ${markers[0].crossStreet}` : "");
            } else {
                // Group by street name
                const streetCounts = {};
                markers.forEach(m => {
                    const street = formatDisplayName(m.nearest || "Unknown Location");
                    streetCounts[street] = (streetCounts[street] || 0) + 1;
                });

                const parts = [];
                Object.entries(streetCounts).forEach(([street, count]) => {
                    const label = count === 1 ? "body" : "bodies";
                    parts.push(`${count} ${label} on ${street}`);
                });

                locationName = parts.join(', ');
            }

            const formattedBBCode = `[url=${sU}]${locationName}[/url]`;
            
            if (onSelect) {
                onSelect({ 
                    name: formattedBBCode, 
                    rawName: locationName, 
                    // Use the first marker's coords as reference, or calculate centroid if needed
                    gameX: parseFloat(markers[0].gameX), 
                    gameY: parseFloat(markers[0].gameY), 
                    screenshot: sU, 
                    isFromMap: true,
                    markerCount: markers.length
                });
            }
            onHide();

        } catch (err) {
            console.error("Mass Fatality Capture Error:", err);
            showNotification("Failed to capture mass fatality data: " + err.message, "error");
        } finally {
            setIsSnapshotting(false);
            if (setIsUploadingMapImage && mapTargetField) setIsUploadingMapImage(prev => ({ ...prev, [mapTargetField]: false }));
        }
    };

    const handleMapRightClick = (e) => {
        if (!isDrawing || tempPath.length === 0) return; e.originalEvent.preventDefault();
        const cg = mapToGame(e.latlng.lat, e.latlng.lng);
        let mD = Infinity; let cI = -1;
        tempPath.forEach((p, i) => { const d = Math.sqrt(Math.pow(p.x - cg.x, 2) + Math.pow(p.y - cg.y, 2)); if (d < mD) { mD = d; cI = i; } });
        if (cI !== -1 && mD < 50) setTempPath(p => p.filter((_, i) => i !== cI));
    };

    if (!show) return null;
    const basePath = import.meta.env.BASE_URL || '/';
    const tileUrl = `${basePath}assets/map-tiles/{z}/{y}/{x}.jpg`;

        return ReactDOM.createPortal(
            <div style={overlayStyle} onClick={onHide}>
                <style>{` 
                    .leaflet-tile { transition: opacity 0.4s; } 
                    .leaflet-tile-loading { opacity: 0; } 
                    .search-results-list { max-height: 300px; overflow-y: auto; z-index: 1001; position: absolute; width: 100%; } 
                    @keyframes glitch {
                        0% { text-shadow: 2px 2px 0px #ff00ff, -2px -2px 0px #00ffff; transform: translate(0); }
                        20% { text-shadow: -2px 2px 0px #ff00ff, 2px -2px 0px #00ffff; transform: translate(-2px, 2px); }
                        40% { text-shadow: 2px -2px 0px #ff00ff, -2px 2px 0px #00ffff; transform: translate(2px, -2px); }
                        60% { text-shadow: -2px -2px 0px #ff00ff, 2px 2px 0px #00ffff; transform: translate(-2px, -2px); }
                        80% { text-shadow: 2px 2px 0px #ff00ff, -2px -2px 0px #00ffff; transform: translate(2px, 2px); }
                        100% { text-shadow: 2px 2px 0px #ff00ff, -2px -2px 0px #00ffff; transform: translate(0); }
                    }
                    .glitch-text { animation: glitch 0.3s infinite; }
                    .pixelated-text { font-family: 'Courier New', Courier, monospace; letter-spacing: 2px; }
                    .info { padding: 6px 8px; font: 14px/16px Arial, Helvetica, sans-serif; background: white; background: rgba(255,255,255,0.8); box-shadow: 0 0 15px rgba(0,0,0,0.2); border-radius: 5px; color: #333; }
                    .info h4 { margin: 0 0 5px; color: #777; }
                `}</style>
                <div style={containerStyle} onClick={(e) => e.stopPropagation()}>                <div style={headerStyle}>
                    <h5 style={{ margin: 0 }}><i className="fas fa-map-marked-alt me-2"></i>{onSelect ? "Select Location" : "GTA V Map"}</h5>
                    <div className="d-flex align-items-center gap-3">
                        {isLoading && <small className="text-info"><i className="fas fa-spinner fa-spin"></i> Syncing...</small>}
                        <Button variant="outline-danger" size="sm" onClick={onHide}>Close</Button>
                    </div>
                </div>

                <div style={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
                    {fakeRestriction && (
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 3100, backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px', textAlign: 'center', backdropFilter: 'blur(10px)' }}>
                            <div style={{ color: '#dc3545', fontSize: '5rem', marginBottom: '20px' }}>
                                <i className="fas fa-tools"></i>
                            </div>
                            <h2 style={{ color: '#fff', marginBottom: '20px', fontWeight: 'bold' }}>
                                MAP UNDER MAINTENANCE
                            </h2>
                            <p style={{ color: '#8b949e', fontSize: '1.2rem', maxWidth: '600px', marginBottom: '30px', lineHeight: '1.5' }}>
                                The map feature is currently disabled for maintenance or system updates. <br /><br />
                                Please check back later or contact an administrator if you believe this is an error.
                            </p>
                            {!isProduction && (
                                <Button variant="outline-secondary" size="sm" onClick={() => setFakeRestriction(false)} style={{ marginTop: '20px', fontFamily: 'monospace' }}>
                                    [DEBUG: BYPASS RESTRICTION]
                                </Button>
                            )}
                        </div>
                    )}

                    <div style={{ position: 'absolute', top: 15, left: 15, zIndex: 1000, width: '300px' }}>
                        <InputGroup size="sm">
                            <InputGroup.Text className="bg-dark border-secondary text-light"><i className="fas fa-search"></i></InputGroup.Text>
                            <Form.Control placeholder="Search..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }} className="bg-dark border-secondary text-light shadow-none" />
                        </InputGroup>
                        {showResults && searchResults.length > 0 && (
                            <ListGroup className="search-results-list mt-1">
                                {searchResults.map((res, i) => (
                                    <ListGroup.Item key={i} className="bg-dark text-light border-secondary" onClick={() => handleSelectLocation(res)} style={{ cursor: 'pointer' }}><div className="d-flex justify-content-between"><span>{formatDisplayName(res.name)}</span><small className="text-muted">{res.type}</small></div></ListGroup.Item>
                                ))}
                            </ListGroup>
                        )}
                    </div>

                    <div style={{ position: 'absolute', top: 15, right: 15, zIndex: 1000, background: 'rgba(13,17,23,0.9)', padding: '12px', borderRadius: '10px', border: '1px solid #30363d' }}>
                        {isAuthorized && (
                            <>
                                <Form.Check type="switch" label="Debug" checked={debugMode} onChange={e => setDebugMode(e.target.checked)} className="text-light small mb-2" />
                                <Form.Check type="switch" label="Debug: View Paths" checked={viewPaths} onChange={e => setViewPaths(e.target.checked)} className="text-info small mb-2" />
                                <Form.Check type="switch" label="Admin Fix" checked={adminFixMode} onChange={e => setAdminFixMode(e.target.checked)} className="text-warning small mb-2" />
                                {adminFixMode && (
                                    <div className="d-flex flex-column gap-1">
                                        <Button variant="warning" size="sm" onClick={() => { handleLoadFixMarkers(); setShowFixMarkers(true); }} style={{ fontSize: '0.7rem' }}>Load Markers</Button>
                                        <Form.Check type="switch" label="Hide Markers" checked={!showFixMarkers} onChange={e => setShowFixMarkers(!e.target.checked)} className="text-light small mb-2" />
                                        <Form.Check type="switch" label="Hide Regions" checked={!showRegions} onChange={e => setShowRegions(!e.target.checked)} className="text-light small mb-2" />
                                        <Form.Check type="switch" label="Hide Streets" checked={!showStreets} onChange={e => setShowStreets(!e.target.checked)} className="text-light small mb-2" />
                                        <Button variant={isDrawing ? "danger" : "info"} size="sm" onClick={() => { setIsDrawing(!isDrawing); setTempPath([]); setSelectedStreetForEditing(null); setIsDrawingRegion(false); }} style={{ fontSize: '0.7rem' }}>{isDrawing ? "Cancel Path" : "Draw Path"}</Button>
                                        {isDrawing && tempPath.length > 1 && <Button variant="success" size="sm" onClick={handleSavePath} style={{ fontSize: '0.7rem' }}>Save Path ({tempPath.length})</Button>}
                                        
                                        {!isProduction && (
                                            <>
                                                {/* --- EXPERIMENTAL: Regional Zone Button --- */}
                                                <Button 
                                                    variant={isDrawingRegion ? "danger" : "outline-info"} 
                                                    size="sm" 
                                                    onClick={() => { 
                                                        setIsDrawingRegion(!isDrawingRegion); 
                                                        setRegionStart(null); 
                                                        setTempRegion(null);
                                                        setIsDrawing(false); 
                                                    }} 
                                                    style={{ fontSize: '0.7rem', marginTop: '5px' }}
                                                >
                                                    {isDrawingRegion ? "Cancel Region" : "Draw Region (Exp)"}
                                                </Button>

                                                <Button 
                                                    variant={isDrawingPolygon ? "danger" : "outline-warning"} 
                                                    size="sm" 
                                                    onClick={() => { 
                                                        setIsDrawingPolygon(!isDrawingPolygon); 
                                                        setTempPolygonPath([]); 
                                                        setIsDrawing(false); 
                                                        setIsDrawingRegion(false);
                                                    }} 
                                                    style={{ fontSize: '0.7rem', marginTop: '5px' }}
                                                >
                                                    {isDrawingPolygon ? "Cancel Polygon" : "Draw Polygon (Exp)"}
                                                </Button>
                                                {isDrawingPolygon && tempPolygonPath.length > 2 && (
                                                    <Button 
                                                        variant="success" 
                                                        size="sm" 
                                                        onClick={handleSavePolygon} 
                                                        style={{ fontSize: '0.7rem', marginTop: '5px' }}
                                                    >
                                                        Save Polygon ({tempPolygonPath.length})
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {savePathModalVisible && (
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 2000, backgroundColor: '#0d1117', border: '1px solid #30363d', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', width: '300px' }}>
                            <h6 className="text-light mb-3">{selectedStreetForEditing ? "Edit Path" : "Save Path"}</h6>
                            <Form.Control size="sm" value={savePathName} onChange={e => setSavePathName(e.target.value)} className="bg-dark border-secondary text-light mb-3" autoFocus disabled={!!selectedStreetForEditing} />
                            <div className="d-flex justify-content-end gap-2"><Button variant="secondary" size="sm" onClick={() => setSavePathModalVisible(false)}>Cancel</Button><Button variant="success" size="sm" onClick={confirmSavePath}>Save</Button></div>
                        </div>
                    )}

                    <MapContainer center={[MAP_HEIGHT / 2, MAP_WIDTH / 2]} zoom={2} minZoom={0} maxZoom={MAX_ZOOM} scrollWheelZoom={true} crs={crs} style={{ height: '100%', width: '100%', background: '#000' }} maxBounds={bounds} ref={mapRef}>
                        <TileLayer url={tileUrl} noWrap={true} bounds={bounds} minNativeZoom={0} maxNativeZoom={MAX_ZOOM} eventHandlers={{ loading: () => setIsLoading(true), load: () => setIsLoading(false) }} />
                        {showGrid && <TileLayer url="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNTYiIGhlaWdodD0iMjU2Ij48cmVjdCB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMikiIHN0cm9rZS13aWR0aD0iMSIvPjx0ZXh0IHg9IjUiIHk9IjIwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuNSkiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiIGZvbnQtc2l6ZT0iMTIiPng6e3h9IHk6e3l9IHo6e3p9PC90ZXh0Pjwvc3ZnPg==" noWrap={true} opacity={0.8} />}
                        <MapEvents onMapClick={handleMapClick} onMapDblClick={handleMapDblClick} onMapRightClick={handleMapRightClick} onMouseMove={handleMouseMove} />
                        <Info />
                                                                        {isDrawing && tempPath.length > 0 && (
                                                                            <Polyline 
                                                                                positions={tempPath.map(p => [p.lat, p.lng])} 
                                                                                pathOptions={{ 
                                                                                    color: "#ff0000", 
                                                                                    weight: 6, 
                                                                                    dashArray: "10, 10",
                                                                                    opacity: strobeOpacity // PULSE EFFECT ENABLED
                                                                                }} 
                                                                            />
                                                                        )}

                                                                        {/* --- EXPERIMENTAL: Regional Zones Rendering --- */}
                                                                        {!isProduction && (
                                                                            <>
                                                                                {tempRegion && (
                                                                                    <Rectangle 
                                                                                        bounds={tempRegion}
                                                                                        pathOptions={{ color: '#00ff00', weight: 2, fillOpacity: 0.2 }}
                                                                                    />
                                                                                )}
                                                                                {isDrawingPolygon && tempPolygonPath.length > 0 && (
                                                                                    <Polygon 
                                                                                        positions={tempPolygonPath}
                                                                                        pathOptions={{ color: '#ff00ff', weight: 2, fillOpacity: 0.2, dashArray: '5, 5' }}
                                                                                    />
                                                                                )}

                                                                                {showRegions && liveMapData.regions.map((region, i) => {
                                                                                    if (region.type === 'Region' && region.bounds) {
                                                                                        return (
                                                                                            <Rectangle 
                                                                                                key={`region-${i}`}
                                                                                                bounds={region.bounds}
                                                                                                pathOptions={{ color: '#00ffcc', weight: 1, fillOpacity: 0.1, dashArray: '5, 5' }}
                                                                                            >
                                                                                                <Popup><div style={{ color: '#000' }}><strong>Region: {region.name}</strong></div></Popup>
                                                                                            </Rectangle>
                                                                                        );
                                                                                    }
                                                                                    if (region.type === 'Polygon' && (region.positions || region.bounds)) {
                                                                                        // Leaflet Polygon component handles MultiPolygon automatically if positions is nested array
                                                                                        return (
                                                                                            <Polygon 
                                                                                                key={`poly-${i}`}
                                                                                                positions={region.positions || region.bounds}
                                                                                                pathOptions={{ color: '#ffcc00', weight: 1, fillOpacity: 0.1 }}
                                                                                            >
                                                                                                <Popup><div style={{ color: '#000' }}><strong>Territory: {region.name}</strong></div></Popup>
                                                                                            </Polygon>
                                                                                        );
                                                                                    }
                                                                                    return null;
                                                                                })}
                                                                            </>
                                                                        )}
                                                                        {/* ------------------------------------------- */}

                                                                        {showStreets && (viewPaths || !isProduction) && liveMapData.streets.filter(s => s.path).map((s, i) => (
                                                                            <Polyline 
                                                                                key={i} 
                                                                                positions={s.path.map(p => gameToMap(p.x, p.y))} 
                                                                                pathOptions={{
                                                                                    color: s.name === selectedStreetForEditing?.name ? "#ffff00" : "#ee04eeff",
                                                                                    weight: 5,
                                                                                    opacity: strobeOpacity
                                                                                }}
                                                                                eventHandlers={{ click: (e) => {
                                                                                    const popupContent = document.createElement('div');
                                                                                    const root = createRoot(popupContent);
                                                                                    root.render(<div style={{ color: '#000' }}><strong>{formatDisplayName(s.name)}</strong>{adminFixMode && <div className="d-flex flex-column gap-2 mt-2"><Button variant="primary" size="sm" className="w-100" onClick={() => { setSelectedStreetForEditing(s); setTempPath(s.path.map(p => ({ x: p.x, y: p.y, lat: gameToMap(p.x, p.y)[0], lng: gameToMap(p.x, p.y)[1] }))); setIsDrawing(true); mapRef.current.closePopup(); }}>Edit</Button><Button variant="danger" size="sm" className="w-100" onClick={() => { handleDeletePath(s); mapRef.current.closePopup(); }}>Delete</Button></div>}
                                                                                </div>);
                                                                                    L.popup().setLatLng(e.latlng).setContent(popupContent).openOn(mapRef.current);
                                                                                }}}
                                                                            />
                                                                        ))}
                        {showFixMarkers && adminFixMode && fixMarkers.map((m) => (
                            <Marker key={m.id} position={m.position} draggable={true} icon={m.type === 'Hospital' ? HospitalIcon : (m.type === 'Body' ? BodyIcon : (m.type === 'Building' ? BuildingIcon : (m.type === 'Fire Station' ? FireStationIcon : DefaultIcon)))} eventHandlers={{ dragend: (e) => handleFixMarkerDragEnd(e, m) }}><Popup><div style={{ color: '#000' }}><strong>{formatDisplayName(m.name)}</strong></div></Popup></Marker>
                        ))}
                        {liveMapData.hospitals.map((h, i) => (
                            <Marker key={`permanent-h-${i}`} position={gameToMap(h.x, h.y)} icon={HospitalIcon}>
                                <Popup>
                                    <div style={{ color: '#000' }}>
                                        <div style={{ borderBottom: '1px solid #ccc', marginBottom: '4px', paddingBottom: '2px' }}><strong>Hospital</strong></div>
                                        <strong>{formatDisplayName(h.name)}</strong>
                                        {onSelect && <Button variant="primary" size="sm" className="w-100 mt-2" onClick={() => handleReportLocation({ ...h, gameX: h.x, gameY: h.y, nearest: h.name, type: 'Hospital' })}>Select</Button>}
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                        {liveMapData.buildings.map((b, i) => (
                            <Marker key={`permanent-b-${i}`} position={gameToMap(b.x, b.y)} icon={BuildingIcon}>
                                <Popup>
                                    <div style={{ color: '#000' }}>
                                        <div style={{ borderBottom: '1px solid #ccc', marginBottom: '4px', paddingBottom: '2px' }}><strong>Building</strong></div>
                                        <strong>{formatDisplayName(b.name)}</strong>
                                        {onSelect && <Button variant="primary" size="sm" className="w-100 mt-2" onClick={() => handleReportLocation({ ...b, gameX: b.x, gameY: b.y, nearest: b.name, type: 'Building' })}>Select</Button>}
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                        {markers.map((m) => (
                            <Marker key={m.id} position={m.position} icon={m.type === 'Hospital' ? HospitalIcon : (m.type === 'Body' ? BodyIcon : (m.type === 'Building' ? BuildingIcon : (m.type === 'Fire Station' ? FireStationIcon : DefaultIcon)))}>
                                <Popup>
                                    <div style={{ color: '#000', minWidth: '180px' }}>
                                        <div style={{ borderBottom: '1px solid #ccc', marginBottom: '8px', paddingBottom: '4px' }}><strong style={{ fontSize: '1.1rem' }}>Location Info</strong></div>
                                        <div style={{ marginBottom: '5px' }}><strong>{debugMode ? "DEBUG: Location:" : "Location:"}</strong><br /><span style={{ color: '#007bff', fontWeight: 'bold' }}>{formatDisplayName(m.nearest)}{m.crossStreet && ` & ${formatDisplayName(m.crossStreet)}`}</span>{debugMode && <small className="text-muted ms-1">({m.distance}m)</small>}</div>
                                        
                                        {/* --- EXPERIMENTAL: Region Display --- */}
                                        {m.region && (
                                            <div style={{ marginBottom: '5px' }}>
                                                <strong>Region:</strong><br />
                                                <span style={{ color: '#2ecc71', fontWeight: 'bold' }}>{m.region}</span>
                                            </div>
                                        )}
                                        {/* ------------------------------------ */}

                                        <div className="mt-2 mb-2 d-flex flex-wrap gap-1 justify-content-center">
                                            <Badge bg={m.type === 'Body' ? "dark" : "secondary"} style={{ cursor: 'pointer'} } onClick={() => setMarkers(prev => prev.map(marker => marker.id === m.id ? { ...marker, type: 'Body' } : marker))}>Body</Badge>
                                            <Badge bg={m.type === 'Building' ? "info" : "secondary"} style={{ cursor: 'pointer'} } onClick={() => setMarkers(prev => prev.map(marker => marker.id === m.id ? { ...marker, type: 'Building' } : marker))}>Building</Badge>
                                            <Badge bg={m.type === 'Fire Station' ? "danger" : "secondary"} style={{ cursor: 'pointer'} } onClick={() => setMarkers(prev => prev.map(marker => marker.id === m.id ? { ...marker, type: 'Fire Station' } : marker))}>Fire Station</Badge>
                                        </div>
                                        <div className="mt-3 pt-2" style={{ borderTop: '1px solid #eee' }}>
                                            {!isMassFatality && (
                                                <Button variant={onSelect ? "primary" : "success"} size="sm" className="w-100" onClick={() => handleReportLocation(m)} disabled={reporting === m.id || isSnapshotting}>{isSnapshotting ? 'Uploading File' : (reporting === m.id ? 'Uploading File... ' : (onSelect ? 'Confirm Death Location' : 'Report'))}</Button>
                                            )}
                                            <Button variant="link" size="sm" className="w-100 mt-1 text-danger p-0" onClick={() => setMarkers(prev => prev.filter(marker => marker.id !== m.id))} style={{ fontSize: '0.75rem', textDecoration: 'none' }}>Remove</Button>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>

                    {isMassFatality && onSelect && markers.length > 0 && (
                        <div style={{ position: 'absolute', bottom: '30px', right: '10px', zIndex: 1000 }}>
                            <Button 
                                variant="danger" 
                                onClick={handleMassFatalityCapture}
                                disabled={isSnapshotting}
                                style={{ boxShadow: '0 0 10px rgba(0,0,0,0.5)', fontWeight: 'bold' }}
                            >
                                {isSnapshotting ? (
                                    <><i className="fas fa-spinner fa-spin me-2"></i>Capturing...</>
                                ) : (
                                    <><i className="fas fa-camera me-2"></i>Capture Location Data ({markers.length})</>
                                )}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.getElementById('modal-root') || document.body
    );
};

export default MapModal;
