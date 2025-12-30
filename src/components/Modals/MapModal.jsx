import React, { useState, useMemo, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Button, Form, ListGroup, InputGroup, Badge } from 'react-bootstrap';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import domtoimage from 'dom-to-image';
import { captureMapScreenshotAndUpload } from '../../utils/mapImageUploadUtils';
import 'leaflet/dist/leaflet.css';
import mapData from '../../assets/mapData.json';
import { database } from '../../firebase';
import { ref, set, get } from 'firebase/database';
import { useGtaWorldAuth } from '../../hooks/useGtaWorldAuth';
import { sendDiscordWebhook } from '../../utils/webhookUtils';

// Fix for default Leaflet markers in React/Vite
const DefaultIcon = L.icon({
    iconUrl: `${import.meta.env.BASE_URL}assets/leaflet/marker-icon.png`,
    iconRetinaUrl: `${import.meta.env.BASE_URL}assets/leaflet/marker-icon-2x.png`,
    shadowUrl: `${import.meta.env.BASE_URL}assets/leaflet/marker-shadow.png`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

if (L.Marker.prototype.options) {
    L.Marker.prototype.options.icon = DefaultIcon;
}

// Ensure Leaflet doesn't try to load default icons from the root
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: `${import.meta.env.BASE_URL}assets/leaflet/marker-icon.png`,
    iconRetinaUrl: `${import.meta.env.BASE_URL}assets/leaflet/marker-icon-2x.png`,
    shadowUrl: `${import.meta.env.BASE_URL}assets/leaflet/marker-shadow.png`,
});

const HospitalIcon = L.divIcon({
    html: '<div style="background-color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; justify-content: center; align-items: center; border: 2px solid #dc3545; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"><i class="fas fa-hospital" style="color: #dc3545; font-size: 18px;"></i></div>',
    className: 'custom-hospital-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
});

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

const getProjectedPointOnSegment = (p, a, b) => {
    const l2 = Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
    if (l2 === 0) return { x: a.x, y: a.y };
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return {
        x: a.x + t * (b.x - a.x),
        y: a.y + t * (b.y - a.y)
    };
};

const getProjectedPointOnPath = (gameCoords, path) => {
    let minD2 = Infinity;
    let bestPoint = null;

    for (let i = 0; i < path.length - 1; i++) {
        const proj = getProjectedPointOnSegment(gameCoords, path[i], path[i+1]);
        const d2 = Math.pow(gameCoords.x - proj.x, 2) + Math.pow(gameCoords.y - proj.y, 2);
        if (d2 < minD2) {
            minD2 = d2;
            bestPoint = proj;
        }
    }
    return bestPoint;
};

const findClosestPointBetween = (loc1, loc2) => {
    // We want to find a point on loc2 that is closest to loc1
    // loc1 sources: if path, use vertices. if point, use single point.
    const sources = loc1.path ? loc1.path : [{x: loc1.x, y: loc1.y}];
    
    let bestPoint = null;
    let minD2 = Infinity;

    sources.forEach(p1 => {
        let candidate = null;
        let d2 = Infinity;

        if (loc2.path) {
            candidate = getProjectedPointOnPath(p1, loc2.path);
            if (candidate) {
                d2 = Math.pow(p1.x - candidate.x, 2) + Math.pow(p1.y - candidate.y, 2);
            }
        } else {
            candidate = {x: loc2.x, y: loc2.y};
            d2 = Math.pow(p1.x - candidate.x, 2) + Math.pow(p1.y - candidate.y, 2);
        }

        if (d2 < minD2) {
            minD2 = d2;
            bestPoint = candidate;
        }
    });

    return bestPoint; // Returns {x, y} on loc2
};

const MapEvents = ({ onMapClick, onMapRightClick }) => {
    useMapEvents({ 
        click(e) { if (typeof onMapClick === 'function') onMapClick(e); },
        contextmenu(e) { if (typeof onMapRightClick === 'function') onMapRightClick(e); }
    });
    return null;
};

const MapModal = ({ show, onHide, onSelect, initialQuery = '', setIsUploadingMapImage, mapTargetField }) => {
    const { user, isAuthenticated, characterName } = useGtaWorldAuth();
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
    const [liveMapData, setLiveMapData] = useState({ streets: [], hospitals: [] });
    const [hasAcknowledgedProductionWarning, setHasAcknowledgedProductionWarning] = useState(false);
    const mapRef = useRef(null);

    const logMapAction = async (action, details) => {
        const webhookUrl = import.meta.env.VITE_ADMIN_ACTION_DISCORD_WEBHOOK_URL || import.meta.env.VITE_DEV_WEBHOOK;
        if (!webhookUrl) return;

        const payload = {
            embeds: [{
                title: `🗺️ Map Action: ${action}`,
                color: action.toLowerCase().includes('fix') || action.toLowerCase().includes('path') ? 0xFFAA00 : 0x28A745,
                fields: [
                    { name: "User", value: user?.username || "Unknown", inline: true },
                    { name: "Character", value: characterName || "N/A", inline: true },
                    { name: "Action", value: action, inline: false },
                    ...details
                ],
                timestamp: new Date().toISOString(),
                footer: { text: "PHMC Map System Tracking" }
            }]
        };

        try {
            await sendDiscordWebhook(webhookUrl, payload);
        } catch (err) {
            console.error("Failed to log map action to webhook:", err);
        }
    };

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
        setShowResults(true);
    };

    const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

    const formatDisplayName = (name) => name ? name.replace(/\s*\(zone\s*\d+\)\s*/gi, '').trim() : 'Unknown';

    // DEBUG: Monitor Search Query State
    useEffect(() => {
        if (debugMode) console.log("DEBUG: Search Query State:", searchQuery);
    }, [searchQuery, debugMode]);

    useEffect(() => {
        if (!show) return;
        const fetchData = async () => {
            setIsLoading(true);
            try {
                let mergedStreets = [...(mapData.streets || [])].map(s => ({ ...s, source: 'locations.json' }));
                let mergedHospitals = [...(mapData.hospitals || [])].map(h => ({ ...h, source: 'locations.json' }));
                const verifiedRef = ref(database, 'verified_locations');
                const snapshot = await get(verifiedRef);
                if (snapshot.exists()) {
                    Object.values(snapshot.val()).forEach(fix => {
                        const target = fix.type === 'Street' ? mergedStreets : mergedHospitals;
                        const idx = target.findIndex(m => m.name === fix.name);
                        const mergedItem = { ...fix, source: 'Firebase' };
                        if (fix.gameX !== undefined) mergedItem.x = fix.gameX;
                        if (fix.gameY !== undefined) mergedItem.y = fix.gameY;
                        if (idx !== -1) target[idx] = { ...target[idx], ...mergedItem };
                        else target.push(mergedItem);
                    });
                }
                setLiveMapData({ streets: mergedStreets, hospitals: mergedHospitals });
            } catch (err) { 
                setLiveMapData({
                    streets: (mapData.streets || []).map(s => ({ ...s, source: 'locations.json' })),
                    hospitals: (mapData.hospitals || []).map(h => ({ ...h, source: 'locations.json' }))
                }); 
            } finally { setIsLoading(false); }
        };
        fetchData();
    }, [show]);
    
    const factor = 1 / Math.pow(2, MAX_ZOOM);
    const crs = L.extend({}, L.CRS.Simple, { transformation: new L.Transformation(factor, 0, factor, 0) });
    const bounds = [[0, 0], [MAP_HEIGHT, MAP_WIDTH]];
    const phmcPos = gameToMap(340.8, -1396.9);

    const handleLoadFixMarkers = () => {
        console.log("DEBUG: Loading fix markers. First street source:", liveMapData.streets[0]?.source);
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
            
            logMapAction("Marker Position Fixed", [
                { name: "Location", value: marker.name, inline: true },
                { name: "New Coords", value: `X: ${gameCoords.x.toFixed(2)}, Y: ${gameCoords.y.toFixed(2)}`, inline: true }
            ]);
        } catch (err) { console.error(err); }
    };

    const handleSavePath = () => {
        if (tempPath.length < 2) return alert("Need 2+ points.");
        // Initialize savePathName based on whether we are editing an existing street
        const isEditingExisting = !!selectedStreetForEditing;
        console.log("DEBUG: handleSavePath - selectedStreetForEditing:", selectedStreetForEditing, "Is input disabled (expected)?:", isEditingExisting);
        setSavePathName(isEditingExisting ? selectedStreetForEditing.name : '');
        setSavePathModalVisible(true);
    };

    const confirmSavePath = async () => {
        if (!savePathName && !selectedStreetForEditing) return; // Name is optional for editing existing

        const name = selectedStreetForEditing ? selectedStreetForEditing.name : savePathName;
        if (!name) return alert("Street Name is required!");

        const safeKey = name.toLowerCase().trim().replace(/[.#$[\\\]\/]/g, "_");
        const pathData = tempPath.map(p => ({ x: p.x, y: p.y }));

        try {
            await set(ref(database, `verified_locations/${safeKey}`), { name, type: 'Street', path: pathData, updatedAt: Date.now() });

            setLiveMapData(prev => {
                const existingIndex = prev.streets.findIndex(s => s.name === name);
                if (existingIndex !== -1) {
                    const updatedStreets = [...prev.streets];
                    updatedStreets[existingIndex] = { ...updatedStreets[existingIndex], path: pathData };
                    return { ...prev, streets: updatedStreets };
                } else {
                    return { ...prev, streets: [...prev.streets, { name, type: 'Street', path: pathData }] };
                }
            });
            setTempPath([]);
            setIsDrawing(false);
            setSavePathModalVisible(false);
            setSelectedStreetForEditing(null); // Clear editing state
            alert("Path saved/updated!");

            logMapAction("Street Path Saved", [
                { name: "Street", value: name, inline: true },
                { name: "Nodes", value: `${pathData.length} points`, inline: true }
            ]);
        } catch (err) { alert("Failed to save/update path."); }
    };

    const searchResults = useMemo(() => {
        if (!searchQuery || searchQuery.length < 2) return [];
        
        // Check for intersection search (Street A, Street B)
        if (searchQuery.includes(',')) {
            const parts = searchQuery.split(',').map(s => s.trim().toLowerCase());
            if (parts.length === 2 && parts[0].length > 0 && parts[1].length > 0) {
                const streets = liveMapData.streets.map(s => ({...s, type: 'Street'}));
                // Find best match for each part
                const match1 = streets.find(s => s.name.toLowerCase().includes(parts[0]));
                const match2 = streets.find(s => s.name.toLowerCase().includes(parts[1]));
                
                if (match1 && match2) {
                    return [{
                        name: `${formatDisplayName(match1.name)} & ${formatDisplayName(match2.name)}`,
                        type: 'Intersection',
                        loc1: match1,
                        loc2: match2
                    }];
                }
            }
        }

        const q = searchQuery.toLowerCase();
        return [...liveMapData.hospitals.map(h => ({...h, type: 'Hospital'})), ...liveMapData.streets.map(s => ({...s, type: 'Street'}))]
            .filter(item => item.name.toLowerCase().includes(q)).slice(0, 8);
    }, [searchQuery, liveMapData]);

    const handleMapClick = (e) => {
        if (!e || !e.latlng) return;
        
        if (!isAuthenticated) {
            console.warn("[Map] User not authenticated. Ignoring click.");
            return;
        }

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
            source: 'Manual Placement',
            type: 'Location',
            distance: primary ? primary.distance.toFixed(1) : "0" 
        };
        setMarkers(onSelect ? [newMarker] : (prev => [...prev, newMarker]));
    };

    const handleSelectLocation = (loc) => {
        let mapPos;
        let gameX, gameY;

        // Update search query to match selection
        setSearchQuery(loc.type === 'Intersection' ? loc.name : formatDisplayName(loc.name));
        setShowResults(false);

        if (loc.type === 'Intersection') {
            // Find closest point on loc2 to loc1
            const bestPoint = findClosestPointBetween(loc.loc1, loc.loc2);
            if (bestPoint) {
                gameX = bestPoint.x;
                gameY = bestPoint.y;
                mapPos = gameToMap(gameX, gameY);
            } else {
                // Fallback
                gameX = loc.loc2.x || 0;
                gameY = loc.loc2.y || 0;
                mapPos = loc.loc2.path ? gameToMap(loc.loc2.path[0].x, loc.loc2.path[0].y) : gameToMap(gameX, gameY);
            }
        } else {
            gameX = loc.x || 0;
            gameY = loc.y || 0;
            if (loc.path) {
                gameX = loc.path[0].x;
                gameY = loc.path[0].y;
            }
            mapPos = gameToMap(gameX, gameY);
        }

        setMarkers([{ 
            id: 'search', 
            position: mapPos, 
            gameX: gameX, 
            gameY: gameY, 
            nearest: loc.name, 
            source: loc.source || 'Search',
            type: loc.type || 'Location',
            distance: "0" 
        }]);
        if (mapRef.current) mapRef.current.flyTo(mapPos, 4);
    };

    const handleReportLocation = async (marker) => {
        // Construct the raw name including cross street if available
        let rawLocationName = marker.nearest;
        if (marker.crossStreet) {
            rawLocationName += ` & ${marker.crossStreet}`;
        }
        
        // Use this composite name for rawName, and also as the base for the formatted name
        const name = onSelect ? (searchQuery || rawLocationName) : rawLocationName;
        if (!name) return;
        
        setReporting(marker.id); // Still show reporting spinner for popup button
        setIsSnapshotting(true); // Show "Capturing..." and disable button

        if (setIsUploadingMapImage && mapTargetField) {
            setIsUploadingMapImage(prev => ({ ...prev, [mapTargetField]: true }));
        }

        let screenshotUrl = null;
        let formattedName = name;

        try {
            // AWAIT THE ENTIRE UPLOAD PROCESS HERE, modal remains open
            const { screenshotUrl: uploadedUrl, error: uploadError } = await captureMapScreenshotAndUpload(mapRef.current.getContainer());
            
            if (uploadedUrl) {
                screenshotUrl = uploadedUrl;
                formattedName = `[url=${screenshotUrl}]${name}[/url]`;
            } else if (uploadError) {
                console.error("DEBUG: Map screenshot upload failed:", uploadError);
                // Optionally, show a local alert/notification about the upload failure
                // but still proceed with selecting the location without the image.
                alert("Screenshot upload failed: " + uploadError + ". Proceeding without image.");
            }

            const safeKey = name.toLowerCase().trim().replace(/[.#$[\\\]\/]/g, "_");
            await set(ref(database, `untracked_locations_log/${safeKey}`), { place: name, timestamp: Date.now(), gameX: parseFloat(marker.gameX), gameY: parseFloat(marker.gameY), nearestStreet: marker.nearest, source: "Map" });
            
            if (onSelect) { 
                onSelect({ 
                    name: formattedName, // Final BBCode name with URL if successful
                    rawName: name, // Original name
                    gameX: parseFloat(marker.gameX), 
                    gameY: parseFloat(marker.gameY),
                    screenshot: screenshotUrl, // Final URL
                    isFromMap: true // Indicate this selection came from the map
                }); 
                // onHide() will be called in finally block
            }
            else alert("Reported!");

            logMapAction("Location Reported", [
                { name: "Reported Name", value: name, inline: true },
                { name: "Nearest Street", value: marker.nearest, inline: true },
                { name: "Coords", value: `X: ${marker.gameX}, Y: ${marker.gameY}`, inline: false }
            ]);

        } catch (err) { 
            alert("Failed during reporting/upload: " + err.message); 
        } finally { 
            setReporting(null); 
            setIsSnapshotting(false); // Hide "Capturing..."
            if (setIsUploadingMapImage && mapTargetField) {
                setIsUploadingMapImage(prev => ({ ...prev, [mapTargetField]: false }));
            }
            onHide(); // Close modal here, ONLY AFTER everything is complete
        }
    };

    const handleMapRightClick = (e) => {
        if (!isDrawing || tempPath.length === 0) return;
        
        // Prevent default browser context menu
        e.originalEvent.preventDefault();

        const clickGameCoords = mapToGame(e.latlng.lat, e.latlng.lng);

        let minDistance = Infinity;
        let closestPointIndex = -1;

        tempPath.forEach((p, index) => {
            const dist = Math.sqrt(
                Math.pow(p.x - clickGameCoords.x, 2) + Math.pow(p.y - clickGameCoords.y, 2)
            );
            if (dist < minDistance) {
                minDistance = dist;
                closestPointIndex = index;
            }
        });

        // Only remove if within a reasonable distance (e.g., 50 game units)
        if (closestPointIndex !== -1 && minDistance < 50) { 
            setTempPath(prev => prev.filter((_, index) => index !== closestPointIndex));
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && searchResults.length > 0) {
            handleSelectLocation(searchResults[0]);
        }
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
                    {/* Production Warning Overlay */}
                    {isProduction && !hasAcknowledgedProductionWarning && (
                        <div style={{
                            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                            zIndex: 3000, backgroundColor: 'rgba(0,0,0,0.9)',
                            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                            padding: '40px', textAlign: 'center'
                        }}>
                            <div style={{ color: '#ffc107', fontSize: '4rem', marginBottom: '20px' }}>
                                <i className="fas fa-exclamation-triangle"></i>
                            </div>
                            <h2 style={{ color: '#fff', marginBottom: '20px' }}>Experimental Feature</h2>
                            <p style={{ color: '#ccc', fontSize: '1.2rem', maxWidth: '600px', marginBottom: '30px' }}>
                                This is not ready for production and is merely to test, please do not use this.
                            </p>
                            <Button variant="warning" onClick={() => setHasAcknowledgedProductionWarning(true)}>
                                I Understand
                            </Button>
                        </div>
                    )}

                    <div style={{ position: 'absolute', top: 15, left: 15, zIndex: 1000, width: '300px' }}>
                        <InputGroup size="sm">
                            <InputGroup.Text className="bg-dark border-secondary text-light"><i className="fas fa-search"></i></InputGroup.Text>
                            <Form.Control 
                                placeholder="Search..." 
                                value={searchQuery} 
                                onChange={handleSearchChange} 
                                onKeyDown={handleKeyDown}
                                className="bg-dark border-secondary text-light shadow-none" 
                            />
                        </InputGroup>
                        {showResults && searchResults.length > 0 && (
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
                                <Button variant="warning" size="sm" onClick={() => { handleLoadFixMarkers(); setShowFixMarkers(true); }} style={{ fontSize: '0.7rem' }}>Load Markers</Button>
                                <Form.Check type="switch" label="Hide Markers" checked={!showFixMarkers} onChange={e => setShowFixMarkers(!e.target.checked)} className="text-light small mb-2" />
                                <Button variant={isDrawing ? "danger" : "info"} size="sm" onClick={() => { setIsDrawing(!isDrawing); setTempPath([]); }} style={{ fontSize: '0.7rem' }}>{isDrawing ? "Cancel Path" : "Draw Path"}</Button>
                                {isDrawing && tempPath.length > 1 && <Button variant="success" size="sm" onClick={handleSavePath} style={{ fontSize: '0.7rem' }}>Save Path ({tempPath.length})</Button>}
                            </div>
                        )}
                    </div>

                    {savePathModalVisible && (
                        <div style={{
                            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                            zIndex: 2000, backgroundColor: '#0d1117', border: '1px solid #30363d',
                            padding: '20px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            width: '300px'
                        }}>
                            <h6 className="text-light mb-3">{selectedStreetForEditing ? "Edit Path" : "Save Path"}</h6>
                            <Form.Group className="mb-3">
                                <Form.Label className="text-light small">Street Name</Form.Label>
                                <Form.Control 
                                    size="sm" 
                                    value={savePathName} 
                                    onChange={e => setSavePathName(e.target.value)} 
                                    className="bg-dark border-secondary text-light"
                                    autoFocus
                                    disabled={!!selectedStreetForEditing} // Disable if editing existing
                                />
                            </Form.Group>
                            <div className="d-flex justify-content-end gap-2">
                                <Button variant="secondary" size="sm" onClick={() => setSavePathModalVisible(false)}>Cancel</Button>
                                <Button variant="success" size="sm" onClick={confirmSavePath}>Save</Button>
                            </div>
                        </div>
                    )}

                    <MapContainer center={[MAP_HEIGHT / 2, MAP_WIDTH / 2]} zoom={2} minZoom={0} maxZoom={MAX_ZOOM} scrollWheelZoom={true} crs={crs} style={{ height: '100%', width: '100%', background: '#000' }} maxBounds={bounds} ref={mapRef}>
                        <TileLayer url={tileUrl} noWrap={true} bounds={bounds} minNativeZoom={0} maxNativeZoom={MAX_ZOOM} eventHandlers={{ loading: () => setIsLoading(true), load: () => setIsLoading(false) }} />
                        {showGrid && <TileLayer url="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNTYiIGhlaWdodD0iMjU2Ij48cmVjdCB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMikiIHN0cm9rZS13aWR0aD0iMSIvPjx0ZXh0IHg9IjUiIHk9IjIwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuNSkiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiIGZvbnQtc2l6ZT0iMTIiPng6e3h9IHk6e3l9IHo6e3p9PC90ZXh0Pjwvc3ZnPg==" noWrap={true} opacity={0.8} />}
                        <MapEvents onMapClick={handleMapClick} onMapRightClick={handleMapRightClick} />
                        {isDrawing && tempPath.length > 0 && <Polyline positions={tempPath.map(p => [p.lat, p.lng])} color="#ff0000" weight={6} opacity={1.0} dashArray="10, 10" />}
                        {liveMapData.streets.filter(s => s.path).map((s, i) => (
                            <Polyline 
                                key={i} 
                                positions={s.path.map(p => gameToMap(p.x, p.y))} 
                                color={s.name === selectedStreetForEditing?.name ? "#ffff00" : "#ee04eeff"} // Highlight if selected
                                weight={5} 
                                opacity={0.8}
                                eventHandlers={{
                                    click: (e) => {
                                        const popupContent = document.createElement('div');
                                        ReactDOM.render(
                                            <div style={{ color: '#000' }}>
                                                <strong>Street: {formatDisplayName(s.name)}</strong>
                                                {adminFixMode && (
                                                    <Button 
                                                        variant="primary" 
                                                        size="sm" 
                                                        className="mt-2"
                                                        onClick={() => {
                                                            setSelectedStreetForEditing(s);
                                                            setTempPath(s.path.map(p => ({ x: p.x, y: p.y, lat: gameToMap(p.x, p.y)[0], lng: gameToMap(p.x, p.y)[1] })));
                                                            setIsDrawing(true);
                                                            mapRef.current.closePopup(); // Close the info popup
                                                        }}
                                                    >
                                                        Edit Path
                                                    </Button>
                                                )}
                                            </div>,
                                            popupContent
                                        );

                                        L.popup()
                                            .setLatLng(e.latlng)
                                            .setContent(popupContent)
                                            .openOn(mapRef.current);
                                    },
                                }}
                            />
                        ))}
                        {showFixMarkers && adminFixMode && fixMarkers.map((m) => (
                            <Marker 
                                key={m.id} 
                                position={m.position} 
                                draggable={true} 
                                icon={m.type === 'Hospital' ? HospitalIcon : DefaultIcon}
                                eventHandlers={{ dragend: (e) => handleFixMarkerDragEnd(e, m) }}
                            >
                                <Popup>
                                    <div style={{ color: '#000', minWidth: '180px' }}>
                                        <div style={{ borderBottom: '1px solid #ccc', marginBottom: '8px', paddingBottom: '4px' }}>
                                            <strong style={{ fontSize: '1.1rem' }}>Verified Location</strong>
                                        </div>
                                        <div style={{ marginBottom: '5px' }}>
                                            <strong>Name:</strong><br />
                                            <span style={{ color: '#28a745', fontWeight: 'bold' }}>
                                                {formatDisplayName(m.name)}
                                            </span>
                                        </div>
                                        <div style={{ marginBottom: '5px' }}>
                                            <strong>Type:</strong> {m.type}
                                        </div>
                                        
                                        {debugMode && (
                                            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '5px', borderTop: '1px solid #eee', paddingTop: '5px' }}>
                                                <strong>DEBUG:</strong><br/>
                                                Game Coords: X: {m.x?.toFixed(2)}, Y: {m.y?.toFixed(2)}<br/>
                                                Storage Type: <span className="text-info">{m.source}</span><br/>
                                                (Drag to adjust)
                                            </div>
                                        )}
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                        {markers.map((m) => (
                            <Marker 
                                key={m.id} 
                                position={m.position}
                                icon={m.type === 'Hospital' ? HospitalIcon : DefaultIcon}
                            >
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
                                                Game Coords: X: {m.gameX}, Y: {m.gameY}<br/>
                                                Storage Type: <span className="text-info">{m.source}</span>
                                            </div>
                                        )}
                                        
                                        <div className="mt-3 pt-2" style={{ borderTop: '1px solid #eee' }}>
                                            <Button 
                                                variant={onSelect ? "primary" : "success"} 
                                                size="sm" 
                                                className="w-100"
                                                onClick={() => handleReportLocation(m)}
                                                disabled={reporting === m.id || isSnapshotting}
                                            >
                                                {isSnapshotting ? 'Uploading, one moment...' : (reporting === m.id ? '...' : (onSelect ? 'Confirm Selection' : 'Report Location'))}
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
