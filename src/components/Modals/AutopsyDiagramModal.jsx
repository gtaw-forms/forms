import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button, OverlayTrigger, Tooltip, Form } from 'react-bootstrap';
import { Stage, Layer, Image as KonvaImage, Circle, Text, Group, Rect, Line, Transformer } from 'react-konva';
import useImage from 'use-image';

import malebodySilhouette from '../../assets/male-body-silhouette.jpg';
import femalebodySilhouette from '../../assets/female-body-silhouette.png';

// --- Styles ---
const modalOverlayStyle = {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1055,
};
const modalContentStyle = {
    backgroundColor: '#0d1117', color: '#c9d1d9', padding: '20px',
    borderRadius: '8px',
    width: '95%',
    maxWidth: '1400px',
    height: '95vh',
    overflow: 'hidden',
    position: 'relative',
    border: '1px solid #30363d', boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
};
const modalHeaderStyle = {
    fontSize: '1.3em', fontWeight: 'bold', marginBottom: '15px',
    borderBottom: '1px solid #30363d', paddingBottom: '10px',
    color: '#c9d1d9', display: 'flex', justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
};
const modalTitleStyle = { margin: 0 };
const modalCloseButtonStyle = {
    background: 'none', border: 'none', color: '#c9d1d9',
    fontSize: '24px', cursor: 'pointer', lineHeight: '1', padding: '0 5px',
};
const modalBodyStyle = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flexGrow: 1,
    overflow: 'hidden',
    paddingTop: '10px',
};
const diagramMainLayout = {
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    flexGrow: 1,
    overflow: 'hidden',
    padding: '0 10px'
};
const imageContainerStyle = {
    position: 'relative',
    flexGrow: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'auto',
    background: '#0d1117',
    borderRadius: '8px',
    border: '1px solid #334155',
};
const markerControlsStyle = {
    marginBottom: '15px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    justifyContent: 'center',
    alignItems: 'center',
};
const modalFooterStyle = {
    borderTop: '1px solid #30363d', paddingTop: '15px', marginTop: 'auto',
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    flexShrink: 0,
};
// --- End Styles ---

const DEFAULT_OVERRIDE_ZONES = [
    { id: "arm-front-l-lower", x: 63.75, y: 328.21, width: 100, height: 150, rotation: 0, label: "ARM", color: "rgba(255, 165, 0, 0.3)" },
    { id: "arm-front-l-upper", x: 73.41, y: 275.07, width: 100, height: 150, rotation: 0, label: "ARM", color: "rgba(255, 165, 0, 0.3)" },
    { id: "shoulder-front-l", x: 85.00, y: 215.00, width: 70, height: 70, rotation: 0, label: "SHOULDER", color: "rgba(59, 130, 246, 0.3)" },
    { id: "shoulder-front-r", x: 345.00, y: 215.00, width: 70, height: 70, rotation: 0, label: "SHOULDER", color: "rgba(59, 130, 246, 0.3)" },
    { id: "hand-front-l", x: 19.07, y: 479.15, width: 100, height: 150, rotation: 0, label: "HAND", color: "rgba(0, 255, 0, 0.3)" },
    { id: "hand-front-r", x: 384.96, y: 482.77, width: 100, height: 150, rotation: 0, label: "HAND", color: "rgba(0, 255, 0, 0.3)" },
    { id: "arm-front-r-lower", x: 353.56, y: 334.24, width: 100, height: 150, rotation: 0, label: "ARM", color: "rgba(255, 165, 0, 0.3)" },
    { id: "arm-front-r-upper", x: 334.24, y: 279.90, width: 100, height: 150, rotation: 0, label: "ARM", color: "rgba(255, 165, 0, 0.3)" },
    { id: "hand-back-l", x: 533.49, y: 483.98, width: 100, height: 150, rotation: 0, label: "HAND", color: "rgba(0, 255, 0, 0.3)" },
    { id: "hand-back-r", x: 896.96, y: 485.19, width: 100, height: 150, rotation: 0, label: "HAND", color: "rgba(0, 255, 0, 0.3)" },
    { id: "arm-back-l-lower", x: 557.64, y: 336.66, width: 100, height: 150, rotation: 0, label: "ARM", color: "rgba(255, 165, 0, 0.3)" },
    { id: "arm-back-l-upper", x: 578.17, y: 278.70, width: 100, height: 150, rotation: 0, label: "ARM", color: "rgba(255, 165, 0, 0.3)" },
    { id: "shoulder-back-l", x: 585.00, y: 215.00, width: 70, height: 70, rotation: 0, label: "SHOULDER", color: "rgba(59, 130, 246, 0.3)" },
    { id: "shoulder-back-r", x: 845.00, y: 215.00, width: 70, height: 70, rotation: 0, label: "SHOULDER", color: "rgba(59, 130, 246, 0.3)" },
    { id: "arm-back-r-upper", x: 847.45, y: 272.66, width: 100, height: 150, rotation: 0, label: "ARM", color: "rgba(255, 165, 0, 0.3)" },
    { id: "arm-back-r-lower", x: 876.43, y: 333.04, width: 100, height: 150, rotation: 0, label: "ARM", color: "rgba(255, 165, 0, 0.3)" }
];

const getAnatomicalRegion = (x, y, imgWidth, imgHeight, yBoundaries, overrideZones) => {
    if (!imgWidth || !imgHeight) return "Unknown Region";
    
    // 1. Check custom override zones first
    for (const zone of overrideZones) {
        // Hit detection for zone coordinates
        const dx = x - zone.x;
        const dy = y - zone.y;
        const rad = (zone.rotation || 0) * Math.PI / 180;
        const localX = dx * Math.cos(-rad) - dy * Math.sin(-rad);
        const localY = dx * Math.sin(-rad) + dy * Math.cos(-rad);

        if (localX >= 0 && localX <= zone.width && localY >= 0 && localY <= zone.height) {
            return { region: zone.label.toUpperCase(), isBack: x > imgWidth / 2 };
        }
    }

    const relX = x / imgWidth;
    const relY = y / imgHeight;

    const isBack = relX > 0.5;

    let region = "";
    if (relY < yBoundaries.head) region = "HEAD";
    else if (relY < yBoundaries.neck) region = "NECK";
    else if (relY < yBoundaries.chest) region = "CHEST";
    else if (relY < yBoundaries.abdomen) region = "ABDOMEN";
    else if (relY < yBoundaries.genitalia) region = "GENITALIA";
    else region = "LEG";

    if (isBack && region !== "HEAD" && region !== "NECK" && region !== "LEG") {
        region = "BACK";
    }

    return { region, isBack };
};

const getGroupedLabeledMarkers = (markers) => {
    if (!markers) return [];
    const labeledMarkers = markers.filter(m => m && m.label && m.label.trim() !== '');
    const grouped = labeledMarkers.reduce((acc, marker) => {
        if (!marker) return acc;
        const labelKey = marker.label.trim().toUpperCase();
        const groupKey = `${marker.type}-${labelKey}`;

        if (!acc[groupKey]) {
            acc[groupKey] = [];
        }
        acc[groupKey].push(marker);
        return acc;
    }, {});

    const result = [];
    Object.keys(grouped).sort().forEach(groupKey => {
        grouped[groupKey].sort((a, b) => (a?.id || '').localeCompare(b?.id || ''));
        grouped[groupKey].forEach((marker, index) => {
            if (!marker) return;
            const prefix = String.fromCharCode(65 + index);
            result.push({
                ...marker,
                displayLabel: `${marker.label.trim()}-${prefix}`
            });
        });
    });

    return result;
};

const BODY_PART_MAPPING = {
    'head': { x: 215, y: 100 },
    'skull': { x: 215, y: 80 },
    'face': { x: 215, y: 120 },
    'neck': { x: 215, y: 220 },
    'chest': { x: 215, y: 340 },
    'thorax': { x: 215, y: 340 },
    'torso': { x: 215, y: 340 },
    'abdomen': { x: 215, y: 500 },
    'pelvis': { x: 215, y: 600 },
    'hip': { x: 215, y: 600 },
    'groin': { x: 215, y: 620 },
    'genitalia': { x: 215, y: 620 },
    'left arm': { x: 100, y: 400 },
    'right arm': { x: 330, y: 400 },
    'left hand': { x: 50, y: 580 },
    'right hand': { x: 380, y: 580 },
    'left leg': { x: 150, y: 900 },
    'right leg': { x: 280, y: 900 },
    'left thigh': { x: 160, y: 750 },
    'right thigh': { x: 270, y: 750 },
    'left calf': { x: 150, y: 1000 },
    'right calf': { x: 280, y: 1000 },
    'left foot': { x: 150, y: 1150 },
    'right foot': { x: 280, y: 1150 },
    'left shoulder': { x: 120, y: 270 },
    'right shoulder': { x: 310, y: 270 },
    'back': { x: 715, y: 340 },
};

const AutopsyDiagramModal = ({
    show,
    onHide,
    onSaveDiagram,
    initialMarkers = [],
    initialSummaries = [],
    showNotification,
    handleImageUpload
}) => {
    const [markers, setMarkers] = useState([]);

    const hasInitializedRef = useRef(false);

    useEffect(() => {
        if (show && !hasInitializedRef.current) {
            setMarkers(initialMarkers || []);
            hasInitializedRef.current = true;
        } else if (!show) {
            hasInitializedRef.current = false;
        }
    }, [show, initialMarkers]);

    const handleSyncFromSummaries = () => {
        if (!initialSummaries || initialSummaries.length === 0) {
            if (showNotification) showNotification("No anatomic summaries found to sync from.", "info");
            return;
        }

        const newMarkersFromSummary = [];
        const imgWidth = image?.width || 900;

        // Count how many of each summary already exist as markers
        const existingMarkerCounts = markers.reduce((acc, m) => {
            const key = m.summary.trim().toLowerCase();
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        // Count how many of each summary are requested in the initialSummaries
        const requestedCounts = initialSummaries.reduce((acc, s) => {
            if (!s) return acc;
            const key = s.trim().toLowerCase();
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        // Iterate over requested summaries and add only the missing ones
        Object.keys(requestedCounts).forEach(summaryStrKey => {
            const totalNeeded = requestedCounts[summaryStrKey];
            const alreadyHave = existingMarkerCounts[summaryStrKey] || 0;
            const toAdd = totalNeeded - alreadyHave;

            if (toAdd <= 0) return;

            // Find the original casing from the summary list
            const originalSummary = initialSummaries.find(s => s && s.trim().toLowerCase() === summaryStrKey);

            // Detection Logic
            const woundRegex = /^(Gunshot Wound|Gunshot Wounds|Blunt Force Trauma|Stab Wound|Stab Wounds|Laceration|Lacerations|Abrasion|Abrasions|Contusion|Contusions|Bruise|Bruises|Incision|Incisions|Fracture|Fractures|Burn|Burns)\s+to\s+(.*?)(?:,|$|\s+\()/i;
            const match = originalSummary.match(woundRegex);

            if (match) {
                const woundTypeStr = match[1].toLowerCase();
                const bodyPartStr = match[2].toLowerCase().trim();

                let markerType = 'circle';
                let label = 'INJ';
                if (woundTypeStr.includes('gunshot')) { markerType = 'cross'; label = 'GSW'; }
                else if (woundTypeStr.includes('stab')) { markerType = 'cross'; label = 'STAB'; }
                else if (woundTypeStr.includes('blunt')) { markerType = 'circle'; label = 'BFT'; }
                else if (woundTypeStr.includes('lace')) { markerType = 'circle'; label = 'LAC'; }
                else if (woundTypeStr.includes('abra')) { markerType = 'circle'; label = 'ABR'; }

                let coords = BODY_PART_MAPPING[bodyPartStr];
                if (!coords) {
                    const keys = Object.keys(BODY_PART_MAPPING).sort((a, b) => b.length - a.length);
                    const key = keys.find(k => bodyPartStr.includes(k));
                    if (key) coords = BODY_PART_MAPPING[key];
                }

                if (coords) {
                    for (let i = 0; i < toAdd; i++) {
                        const jitterX = (Math.random() - 0.5) * 60; // Increased jitter for visibility
                        const jitterY = (Math.random() - 0.5) * 60;
                        const finalX = coords.x + jitterX;

                        newMarkersFromSummary.push({
                            x: finalX,
                            y: coords.y + jitterY,
                            type: markerType,
                            id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 5)}-${i}`,
                            label: label,
                            labelSide: finalX > imgWidth * 0.8 ? 'left' : 'right',
                            summary: originalSummary,
                            isCustomSummary: true,
                        });
                    }
                }
            }
        });

        if (newMarkersFromSummary.length > 0) {
            setMarkers(prev => [...prev, ...newMarkersFromSummary]);
            if (showNotification) showNotification(`Added ${newMarkersFromSummary.length} markers from summaries.`, "success");
        } else {
            if (showNotification) showNotification("No new markers could be generated from the summaries.", "info");
        }
    };
    const [selectedMarkerType, setSelectedMarkerType] = useState('circle');
    const [editingMarkerId, setEditingMarkerId] = useState(null);
    const [inputPosition, setInputPosition] = useState(null);
    const [selectedSilhouetteType, setSelectedSilhouetteType] = useState('male');
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    const [markerSizeMultiplier, setMarkerSizeMultiplier] = useState(1);
    const [debugMode, setDebugMode] = useState(false);
    const [showMappingDebug, setShowMappingDebug] = useState(false);
    const [selectedBoundaryKey, setSelectedBoundaryKey] = useState(null);
    const [overrideZones, setOverrideZones] = useState(DEFAULT_OVERRIDE_ZONES);
    const [selectedZoneId, setSelectedZoneId] = useState(null);
    const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    const isLocal = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' || 
                    window.location.hostname.startsWith('192.168.') || 
                    window.location.hostname.startsWith('10.');

    useEffect(() => {
        if (!isLocal && debugMode) {
            setDebugMode(false);
        }
    }, [isLocal, debugMode]);

    useEffect(() => {
        const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const imageToLoad = selectedSilhouetteType === 'female' ? femalebodySilhouette : malebodySilhouette;
    const [image, imageStatus] = useImage(imageToLoad);
    
    // Boundary States for Calibration
    const [yBoundaries, setYBoundaries] = useState({
        head: 0.171,
        neck: 0.203,
        chest: 0.349,
        abdomen: 0.461,
        genitalia: 0.526
    });

    const resetBoundaries = () => {
        setYBoundaries({
            head: 0.171,
            neck: 0.203,
            chest: 0.349,
            abdomen: 0.461,
            genitalia: 0.526
        });
        setSelectedBoundaryKey(null);
        setOverrideZones(DEFAULT_OVERRIDE_ZONES);
        setSelectedZoneId(null);
        console.log("%c[DEBUG] Boundaries and Zones reset to calibrated defaults.", "color: #e74c3c; font-weight: bold;");
    };

    useEffect(() => {
        if (!debugMode || !selectedBoundaryKey || !image) return;

        const handleKeyDown = (e) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            e.preventDefault();

            const h = image.height;
            const step = 1 / h; // 1 pixel step
            const direction = e.key === 'ArrowUp' ? -1 : 1;

            setYBoundaries(prev => {
                const newVal = Math.max(0, Math.min(1, prev[selectedBoundaryKey] + (direction * step)));
                const updated = { ...prev, [selectedBoundaryKey]: parseFloat(newVal.toFixed(4)) };
                console.log(`%cDEBUG: REGION - ${selectedBoundaryKey.toUpperCase()} has been moved to ${updated[selectedBoundaryKey]}. These are the final areas:`, "color: #2ecc71; font-weight: bold;", updated);
                return updated;
            });
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [debugMode, selectedBoundaryKey, image]);

    const notificationIdRef = useRef(null);

    const imageContainerRef = useRef(null);
    const stageRef = useRef(null);
    const prevShowRef = useRef(show);

    useEffect(() => {
        if (editingMarkerId && stageRef.current && image) {
            const stage = stageRef.current;
            const marker = markers.find(m => m.id === editingMarkerId);
            if (!marker) {
                setInputPosition(null);
                return;
            }

            const container = imageContainerRef.current;
            if (!container) return;

            const stageDim = { width: stage.width(), height: stage.height() };
            const imageSize = { width: image.width, height: image.height };
            
            const scaleX = stageDim.width / imageSize.width;
            const scaleY = stageDim.height / imageSize.height;

            const markerStageX = marker.x * scaleX;
            const markerStageY = marker.y * scaleY;

            const containerW = container.offsetWidth;
            const containerH = container.offsetHeight;

            const stageOffsetX = (containerW - stageDim.width) / 2;
            const stageOffsetY = (containerH - stageDim.height) / 2;

            setInputPosition({
                top: stageOffsetY + markerStageY + 20, // +20 to be "under" the marker
                left: stageOffsetX + markerStageX - 50, // -50 to center the 100px input
            });
        } else {
            setInputPosition(null);
        }
    }, [editingMarkerId, markers, image, markerSizeMultiplier]);

    const getRelativePointerPosition = (stage) => {
        const pointer = stage.getPointerPosition();
        const stageTransform = stage.getAbsoluteTransform().copy();
        stageTransform.invert();
        return stageTransform.point(pointer);
    };

    const handleStageClick = (e) => {
        if (e.target !== e.target.getStage()) {
            return;
        }

        if (debugMode) {
            setSelectedBoundaryKey(null);
            return;
        }

        const stage = e.target.getStage();
        const pos = getRelativePointerPosition(stage);
        const { region, isBack } = getAnatomicalRegion(pos.x, pos.y, image.width, image.height, yBoundaries, overrideZones);
        const regionText = isBack ? `${region} (Back)` : region;

        const newMarker = {
            x: pos.x,
            y: pos.y,
            type: selectedMarkerType,
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            label: '',
            labelSide: pos.x > image.width * 0.8 ? 'left' : 'right',
            summary: `MARKER_TYPE to the region of ${regionText} (Marker: {LABEL}) `,
            isCustomSummary: false,
        };
        setMarkers(prevMarkers => [...prevMarkers, newMarker]);
        setEditingMarkerId(newMarker.id);
    };

    const handleDragEnd = (e, id) => {
        const stage = e.target.getStage();
        const newMarkers = markers.map(marker => {
            if (marker.id === id) {
                const newX = e.target.x();
                const newY = e.target.y();
                const { region, isBack } = getAnatomicalRegion(newX, newY, image.width, image.height, yBoundaries, overrideZones);
                const regionText = isBack ? `${region} (Back)` : region;

                // Update summary if it's not custom
                let newSummary = marker.summary;
                if (!marker.isCustomSummary) {
                    newSummary = `MARKER_TYPE to the region of ${regionText} (Marker: {LABEL}) `;
                }

                return { ...marker, x: newX, y: newY, summary: newSummary };
            }
            return marker;
        });
        setMarkers(newMarkers);
    };

    const handleToggleLastMarkerLabelSide = () => {
        setMarkers(prevMarkers => {
            if (prevMarkers.length === 0) return prevMarkers;
            const lastLabeledMarkerIndex = prevMarkers.slice().reverse().findIndex(m => m.label && m.label.trim() !== '');

            if (lastLabeledMarkerIndex === -1) {
                if (showNotification) showNotification("No labeled marker to toggle side for. Add a label first.", "info");
                return prevMarkers;
            }
            const originalIndex = prevMarkers.length - 1 - lastLabeledMarkerIndex;

            return prevMarkers.map((marker, index) => {
                if (index === originalIndex) {
                    return { ...marker, labelSide: marker.labelSide === 'right' ? 'left' : 'right' };
                }
                return marker;
            });
        });
    };

    const exportToImage = async (includeLabels) => {
        const stage = stageRef.current;
        if (!stage) return null;

        setEditingMarkerId(null); // Ensure input is hidden before export
        await new Promise(resolve => setTimeout(resolve, 50)); // Wait for state to update

        if (!includeLabels) {
            stage.find('.marker-label-group').forEach(group => group.visible(false));
            stage.draw();
        }

        const dataURL = stage.toDataURL({ pixelRatio: 2 });

        if (!includeLabels) {
            stage.find('.marker-label-group').forEach(group => group.visible(true));
            stage.draw();
        }

        return dataURL;
    };

    const handleCopyToClipboard = async () => {
        setIsProcessingImage(true);
        const dataUrl = await exportToImage(true);
        if (dataUrl) {
            const blob = await (await fetch(dataUrl)).blob();
            try {
                await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
                if (showNotification) showNotification('Diagram copied to clipboard!', 'check-circle');
            } catch (err) {
                console.error('Failed to copy diagram:', err);
                if (showNotification) showNotification('Failed to copy diagram. See console for details.', 'exclamation-triangle');
            }
        }
        setIsProcessingImage(false);
    };

    const handleUpload = async () => {
        setIsProcessingImage(true);
        const dataUrl = await exportToImage(true);
        if (dataUrl && handleImageUpload) {
            await handleImageUpload(dataUrl, 'autopsyDiagramImgurUrl');
        } else if (!handleImageUpload) {
            if (showNotification) showNotification('Image upload handler is not available.', 'error');
        }
        setIsProcessingImage(false);
    };

    const handleAddLabelToLastMarker = (text) => {
        if (!text) return;
        setMarkers(prevMarkers => {
            if (prevMarkers.length === 0) {
                if (showNotification) showNotification("Place a marker first before adding a label.", "info");
                return prevMarkers;
            };
            const lastMarkerIndex = prevMarkers.length - 1;
            return prevMarkers.map((marker, index) =>
                index === lastMarkerIndex ? { ...marker, label: text.substring(0, 9) } : marker
            );
        });
    };

    const handleLabelChange = (id, newLabel) => {
        const newMarkers = markers.slice();
        const marker = newMarkers.find(m => m.id === id);
        if (marker) {
            marker.label = newLabel.substring(0, 9);
        }
        setMarkers(newMarkers);
    };

    const handleSummaryChange = (id, newSummary) => {
        const newMarkers = markers.map(m => 
            m.id === id ? { ...m, summary: newSummary, isCustomSummary: true } : m
        );
        setMarkers(newMarkers);
    };

    const handleRemoveMarker = (markerIdToRemove) => {
        setMarkers(prevMarkers => prevMarkers.filter(marker => marker.id !== markerIdToRemove));
    };

    const handleUndoLastMarker = () => {
        setMarkers(prev => prev.slice(0, -1));
    };

    const handleClearAllMarkers = () => {
        setMarkers([]);
    };

    const handleSave = async () => {
        if (onSaveDiagram) {
            setIsProcessingImage(true);
            const dataUrl = await exportToImage(true);
            let imageUrl = null;
            if (dataUrl && handleImageUpload) {
                const uploadedUrls = await handleImageUpload(dataUrl);
                if (uploadedUrls && uploadedUrls.length > 0) {
                    imageUrl = uploadedUrls[0];
                }
            }
            
            const labeledMarkers = getGroupedLabeledMarkers(markers);
            const summaries = markers.filter(m => m && m.id).map(m => {
                if (m.isCustomSummary) return m.summary;
                const markerWithDisplayLabel = labeledMarkers.find(lm => lm && lm.id === m.id);
                const displayLabel = markerWithDisplayLabel?.displayLabel || m.label || 'None';

                // Determine Marker Type from label
                let markerType = 'Injury';
                const upperLabel = (m.label || '').toUpperCase();
                if (upperLabel.startsWith('GSW')) markerType = 'Gunshot Wound';
                else if (upperLabel.startsWith('STAB')) markerType = 'Stab Wound';
                else if (upperLabel.startsWith('LAC')) markerType = 'Laceration';
                else if (upperLabel.startsWith('BLUNT')) markerType = 'Blunt Force Trauma';
                else if (upperLabel.startsWith('BFT')) markerType = 'Blunt Force Trauma';
                else if (m.label) markerType = m.label;

                return m.summary
                    .replace('MARKER_TYPE', markerType)
                    .replace('{LABEL}', displayLabel);
            }).filter(Boolean);

            onSaveDiagram(markers, imageUrl, summaries);
            setIsProcessingImage(false);
        }
        onHide();
    };

    const increaseMarkerSize = () => setMarkerSizeMultiplier(prev => prev + 0.25);
    const decreaseMarkerSize = () => setMarkerSizeMultiplier(prev => prev - 0.25);

    const addOverrideZone = (label) => {
        const newZone = {
            id: `zone-${Date.now()}`,
            x: image.width * 0.1,
            y: image.height * 0.1,
            width: 100,
            height: 150,
            rotation: 0,
            label: label || 'ARM',
            color: label === 'ARM' ? 'rgba(255, 165, 0, 0.3)' : 'rgba(0, 255, 0, 0.3)'
        };
        setOverrideZones([...overrideZones, newZone]);
        setSelectedZoneId(newZone.id);
    };

    const renderMappingDebug = () => {
        if (!showMappingDebug) return null;
        return (
            <Group listening={false}>
                {Object.entries(BODY_PART_MAPPING).map(([name, coords]) => (
                    <Group key={name} x={coords.x} y={coords.y}>
                        <Circle radius={5} fill="#f59e0b" stroke="white" strokeWidth={1} />
                        <Text 
                            text={name.toUpperCase()} 
                            y={10} 
                            x={-25}
                            width={50}
                            align="center"
                            fill="#f59e0b" 
                            fontSize={10} 
                            fontWeight="bold" 
                            shadowColor="black" 
                            shadowBlur={2} 
                        />
                    </Group>
                ))}
            </Group>
        );
    };

    const renderDebugLines = () => {
        if (!debugMode || !image || showMappingDebug) return null;
        const w = image.width;
        const h = image.height;
        
        const handleYDragEnd = (key, e) => {
            // Calculate absolute Y by adding displacement to original position
            const originalY = yBoundaries[key] * h;
            const newY = (originalY + e.target.y()) / h;
            const updated = { ...yBoundaries, [key]: Math.max(0, Math.min(1, parseFloat(newY.toFixed(3)))) };
            setYBoundaries(updated);
            console.log(`%cDEBUG: REGION - ${key.toUpperCase()} has been moved to ${updated[key]}. These are the final areas:`, "color: #f1c40f; font-weight: bold;", updated);
            e.target.y(0); // Reset displacement offset after state update
        };

        const regions = [
            { label: 'HEAD', start: 0, end: yBoundaries.head, color: 'rgba(255, 0, 0, 0.15)' },
            { label: 'NECK', start: yBoundaries.head, end: yBoundaries.neck, color: 'rgba(0, 255, 0, 0.15)' },
            { label: 'CHEST', start: yBoundaries.neck, end: yBoundaries.chest, color: 'rgba(0, 0, 255, 0.15)' },
            { label: 'ABDOMEN', start: yBoundaries.chest, end: yBoundaries.abdomen, color: 'rgba(255, 255, 0, 0.15)' },
            { label: 'GENITALIA', start: yBoundaries.abdomen, end: yBoundaries.genitalia, color: 'rgba(255, 0, 255, 0.15)' },
            { label: 'LEGS', start: yBoundaries.genitalia, end: 1, color: 'rgba(0, 255, 255, 0.15)' },
        ];

        return (
            <Group listening={debugMode}>
                {/* Zone Visualizers (Shapes) */}
                {regions.map((reg, idx) => (
                    <Rect
                        key={`zone-${idx}`}
                        x={0}
                        y={reg.start * h}
                        width={w}
                        height={(reg.end - reg.start) * h}
                        fill={reg.color}
                        listening={false}
                    />
                ))}

                {/* Custom Override Zones */}
                {overrideZones.map((zone, i) => (
                    <React.Fragment key={zone.id}>
                        <Rect
                            name="override-zone"
                            x={zone.x}
                            y={zone.y}
                            width={zone.width}
                            height={zone.height}
                            rotation={zone.rotation}
                            fill={zone.color}
                            stroke={selectedZoneId === zone.id ? '#3b82f6' : 'transparent'}
                            strokeWidth={2}
                            draggable
                            onClick={() => setSelectedZoneId(zone.id)}
                            onDragEnd={(e) => {
                                const updated = overrideZones.map(z => 
                                    z.id === zone.id ? { ...z, x: e.target.x(), y: e.target.y() } : z
                                );
                                setOverrideZones(updated);
                                console.log("%c[DEBUG] Custom Zones Updated:", "color: #9b59b6; font-weight: bold;", updated);
                            }}
                            onTransformEnd={(e) => {
                                const node = e.target;
                                const updated = overrideZones.map(z => 
                                    z.id === zone.id ? { 
                                        ...z, 
                                        x: node.x(), 
                                        y: node.y(), 
                                        width: Math.max(5, node.width() * node.scaleX()),
                                        height: Math.max(5, node.height() * node.scaleY()),
                                        rotation: node.rotation()
                                    } : z
                                );
                                node.scaleX(1);
                                node.scaleY(1);
                                setOverrideZones(updated);
                                console.log("%c[DEBUG] Custom Zones Transformed:", "color: #9b59b6; font-weight: bold;", updated);
                            }}
                        />
                        <Text 
                            text={zone.label} 
                            x={zone.x} 
                            y={zone.y - 20} 
                            fill="black" 
                            shadowColor="white" 
                            shadowBlur={2} 
                            fontSize={14} 
                            fontWeight="bold" 
                            listening={false}
                            rotation={zone.rotation}
                        />
                        {selectedZoneId === zone.id && (
                            <Transformer
                                boundBoxFunc={(oldBox, newBox) => {
                                    if (newBox.width < 5 || newBox.height < 5) return oldBox;
                                    return newBox;
                                }}
                            />
                        )}
                    </React.Fragment>
                ))}

                {/* Draggable Boundary Handles */}
                {Object.entries(yBoundaries).map(([key, y]) => {
                    const isSelected = selectedBoundaryKey === key;
                    return (
                        <Group key={key}>
                            <Line
                                points={[0, y * h, w, y * h]}
                                stroke={isSelected ? "#3b82f6" : "white"}
                                strokeWidth={isSelected ? 14 : 10}
                                opacity={isSelected ? 0.4 : 0.2}
                            />
                            <Line
                                points={[0, y * h, w, y * h]}
                                stroke={isSelected ? "#3b82f6" : "black"}
                                strokeWidth={isSelected ? 4 : 3}
                                dash={[10, 5]}
                                opacity={1}
                                draggable
                                onClick={() => setSelectedBoundaryKey(key)}
                                dragBoundFunc={(pos) => {
                                    const stage = stageRef.current;
                                    const stageY = stage.getAbsoluteTransform().decompose().y;
                                    const constrainedY = Math.max(stageY, Math.min(stageY + stageDim.height, pos.y));
                                    return { x: stage.getAbsoluteTransform().decompose().x, y: constrainedY };
                                }}
                                onDragStart={() => setSelectedBoundaryKey(key)}
                                onDragEnd={(e) => handleYDragEnd(key, e)}
                            />
                        </Group>
                    );
                })}
                
                {/* Labels */}
                {regions.map((reg, idx) => (
                    <Text 
                        key={`label-${idx}`}
                        text={`${reg.label} (<${reg.end.toFixed(3)})`} 
                        x={15} 
                        y={reg.end * h - 25} 
                        fill="black" 
                        shadowColor="white" 
                        shadowBlur={4} 
                        fontSize={16} 
                        fontWeight="bold" 
                        listening={false} 
                    />
                ))}

                <Line points={[w / 2, 0, w / 2, h]} stroke="black" strokeWidth={2} opacity={0.3} dash={[2, 2]} listening={false} />
            </Group>
        );
    };

    const labeledMarkers = useMemo(() => getGroupedLabeledMarkers(markers), [markers]);

    const renderMarkers = () => {
        const stage = stageRef.current;
        const scale = (stage && stage.scaleX() > 0) ? stage.scaleX() : 1;

        const baseRadius = 9;
        const baseCrossFontSize = 19;
        const baseLabelFontSize = 11;

        return markers.filter(m => m && m.id).map(marker => {
            const markerWithDisplayLabel = labeledMarkers.find(m => m && m.id === marker.id);
            const displayLabelText = markerWithDisplayLabel?.displayLabel || marker.label;

            return (
                <Group
                    key={marker.id}
                    id={marker.id}
                    x={marker.x}
                    y={marker.y}
                    draggable
                    dragBoundFunc={(pos) => {
                        const stage = stageRef.current;
                        const transform = stage.getAbsoluteTransform().copy().invert();
                        const p = transform.point(pos);
                        
                        const constrainedX = Math.max(0, Math.min(image.width, p.x));
                        const constrainedY = Math.max(0, Math.min(image.height, p.y));
                        
                        return stage.getAbsoluteTransform().point({ x: constrainedX, y: constrainedY });
                    }}
                    onDragEnd={(e) => handleDragEnd(e, marker.id)}
                    onDblClick={() => setEditingMarkerId(marker.id)}
                    scaleX={1 / scale}
                    scaleY={1 / scale}
                >
                    {marker.type === 'circle' && (
                        <Circle
                            radius={baseRadius * markerSizeMultiplier}
                            fill="rgba(255, 0, 0, 0.7)"
                            stroke="darkred"
                            strokeWidth={2}
                            onClick={() => handleRemoveMarker(marker.id)}
                        />
                    )}
                    {marker.type === 'cross' && (
                         <Text text="X" fontSize={baseCrossFontSize * markerSizeMultiplier} fill="red" onClick={() => handleRemoveMarker(marker.id)} />
                    )}

                    {displayLabelText && (() => {
                        const labelFontSize = baseLabelFontSize * markerSizeMultiplier;
                        const characterWidth = labelFontSize * 0.7;
                        const textWidth = displayLabelText.length * characterWidth;
                        const hPadding = 4 * markerSizeMultiplier;
                        const vPadding = 2 * markerSizeMultiplier;
                        const rectHeight = labelFontSize + vPadding * 2;
                        const rectWidth = textWidth + hPadding * 2;
                        const offset = 15 * markerSizeMultiplier;

                        return (
                            <Group name="marker-label-group">
                                <Rect
                                    x={marker.labelSide === 'right' ? offset : -offset - rectWidth}
                                    y={-rectHeight / 2}
                                    width={rectWidth}
                                    height={rectHeight}
                                    fill="rgba(0,0,0,0.7)"
                                    cornerRadius={3}
                                />
                                <Text
                                    text={displayLabelText}
                                    x={marker.labelSide === 'right' ? offset + hPadding : -offset - rectWidth + hPadding}
                                    y={-labelFontSize / 2}
                                    fill="white"
                                    fontSize={labelFontSize}
                                />
                            </Group>
                        );
                    })()}
                </Group>
            );
        });
    };

    if (!show) return null;

    const lastLabeledMarker = markers.slice().reverse().find(m => m.label && m.label.trim() !== '');
    const isToggleLabelSideDisabled = !lastLabeledMarker;

    const stageDim = { width: 0, height: 0 };
    if (image && imageContainerRef.current && image.width > 0 && image.height > 0) {
        const container = imageContainerRef.current;
        const containerW = container.offsetWidth;
        const containerH = container.offsetHeight;
        const imgW = image.width;
        const imgH = image.height;

        const scale = Math.min(containerW / imgW, containerH / imgH);
        stageDim.width = imgW * scale;
        stageDim.height = imgH * scale;
    }

    return (
        <>
            <div style={modalOverlayStyle} onClick={onHide}>
                <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                    <div style={modalHeaderStyle}>
                        <h5 style={modalTitleStyle}>Autopsy Diagram</h5>
                        <button onClick={onHide} style={modalCloseButtonStyle} aria-label="Close modal">&times;</button>
                    </div>
                    <div style={modalBodyStyle}>
                        <div style={{ flexShrink: 0 }}>
                            <div style={markerControlsStyle}>
                                 <Button
                                    variant={selectedSilhouetteType === 'male' ? 'info' : 'outline-info'}
                                    size="sm"
                                    onClick={() => setSelectedSilhouetteType('male')}
                                    title="Use Male Silhouette"
                                >
                                    Male Body
                                </Button>
                                <Button
                                    variant={selectedSilhouetteType === 'female' ? 'info' : 'outline-info'}
                                    size="sm"
                                    onClick={() => setSelectedSilhouetteType('female')}
                                    title="Use Female Silhouette"
                                >
                                    Female Body
                                </Button>
                                <Button 
                                    variant="outline-success" 
                                    size="sm" 
                                    onClick={handleSyncFromSummaries} 
                                    title="Sync markers from anatomic summaries"
                                >
                                    <i className="fas fa-sync"></i> Sync from Summaries
                                </Button>
                                <span style={{ borderLeft: '1px solid #30363d', height: '20px', margin: '0 5px' }}></span>

                                <Button variant={selectedMarkerType === 'circle' ? 'danger' : 'outline-danger'} size="sm" onClick={() => setSelectedMarkerType('circle')}>Circle (O)</Button>
                                <Button variant={selectedMarkerType === 'cross' ? 'danger' : 'outline-danger'} size="sm" onClick={() => setSelectedMarkerType('cross')}>Cross (X)</Button>
                                
                                {debugMode && (
                                    <>
                                        <Button variant="outline-info" size="sm" onClick={() => addOverrideZone('ARM')} style={{fontSize: '0.75rem'}}>
                                            <i className="fas fa-plus"></i> ARM Zone
                                        </Button>
                                        <Button variant="outline-success" size="sm" onClick={() => addOverrideZone('HAND')} style={{fontSize: '0.75rem'}}>
                                            <i className="fas fa-plus"></i> HAND Zone
                                        </Button>
                                        <Button variant="outline-primary" size="sm" onClick={() => addOverrideZone('SHOULDER')} style={{fontSize: '0.75rem'}}>
                                            <i className="fas fa-plus"></i> SHOULDER Zone
                                        </Button>
                                    </>
                                )}

                                <Button variant="outline-secondary" size="sm" onClick={handleToggleLastMarkerLabelSide} disabled={isToggleLabelSideDisabled} title="Toggle Last Label's Side">
                                    <i className={`fas fa-exchange-alt`}></i> Toggle Label Side
                                </Button>
                                <Button variant="outline-secondary" size="sm" onClick={handleUndoLastMarker} disabled={markers.length === 0}>Undo</Button>
                                <Button variant="outline-warning" size="sm" onClick={handleClearAllMarkers} disabled={markers.length === 0}>Clear All</Button>
                                
                                {isLocal && (
                                    <>
                                        <Button variant={debugMode ? "warning" : "outline-warning"} size="sm" onClick={() => setDebugMode(!debugMode)}>
                                            <i className="fas fa-bug"></i> {debugMode ? "Debug OFF" : "Debug Mode"}
                                        </Button>
                                        {debugMode && (
                                            <>
                                                <Button variant="outline-danger" size="sm" onClick={resetBoundaries}>
                                                    <i className="fas fa-undo"></i> Reset Debug
                                                </Button>
                                                <Button 
                                                    variant={showMappingDebug ? "warning" : "outline-warning"} 
                                                    size="sm" 
                                                    onClick={() => setShowMappingDebug(!showMappingDebug)}
                                                    title="Toggle Mapping Debug"
                                                >
                                                    <i className="fas fa-map-marker-alt"></i> Mapping Debug
                                                </Button>
                                            </>
                                        )}
                                    </>
                                )}
                            </div>

                            <div style={{ 
                                marginTop: '10px', 
                                padding: '10px', 
                                backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                                borderRadius: '6px',
                                borderLeft: '4px solid #3b82f6',
                                fontSize: '0.85rem',
                                textAlign: 'left',
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                            }}>
                                <div>
                                    <i className="fas fa-info-circle" style={{ marginRight: '8px', color: '#3b82f6' }}></i>
                                    <strong>Professional Resources:</strong> Use <a href="https://www.z-anatomy.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'underline' }}>Z-Anatomy</a> for detailed anatomical references.
                                </div>
                                <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                                    <strong>Disclaimer:</strong> This tool is designed for roleplay purposes. We are playing a game, not a medical simulator.
                                </div>
                            </div>
                        </div>

                        <div style={diagramMainLayout}>
                            <div ref={imageContainerRef} style={imageContainerStyle}>
                                {imageStatus === 'loaded' ? (
                                    <Stage
                                        ref={stageRef}
                                        width={stageDim.width}
                                        height={stageDim.height}
                                        scaleX={stageDim.width / image.width}
                                        scaleY={stageDim.height / image.height}
                                        onClick={handleStageClick}
                                    >
                                        <Layer>
                                            <KonvaImage image={image} width={image.width} height={image.height} listening={false} />
                                            {renderMappingDebug()}
                                            {renderDebugLines()}
                                            {!showMappingDebug && renderMarkers()}
                                        </Layer>
                                    </Stage>
                                ) : (
                                    <div>Loading image...</div>
                                )}
                                {inputPosition && (() => {
                                    const marker = markers.find(m => m.id === editingMarkerId);
                                    if (!marker) return null;

                                    const labeledMarkers = getGroupedLabeledMarkers(markers);
                                    const markerWithDisplayLabel = labeledMarkers.find(lm => lm && lm.id === marker.id);
                                    const displayLabel = markerWithDisplayLabel?.displayLabel || marker.label || 'None';
                                    
                                    // Determine Marker Type from label
                                    let markerType = 'Injury';
                                    const upperLabel = (marker.label || '').toUpperCase();
                                    if (upperLabel.startsWith('GSW')) markerType = 'Gunshot Wound';
                                    else if (upperLabel.startsWith('STAB')) markerType = 'Stab Wound';
                                    else if (upperLabel.startsWith('LAC')) markerType = 'Laceration';
                                    else if (upperLabel.startsWith('BLUNT')) markerType = 'Blunt Force Trauma';
                                    else if (upperLabel.startsWith('BFT')) markerType = 'Blunt Force Trauma';
                                    else if (marker.label) markerType = marker.label;

                                    const displaySummary = marker.isCustomSummary 
                                        ? marker.summary 
                                        : marker.summary
                                            .replace('MARKER_TYPE', markerType)
                                            .replace('{LABEL}', displayLabel);

                                    return (
                                        <div 
                                            style={{
                                                position: 'absolute',
                                                top: `${inputPosition.top}px`,
                                                left: `${inputPosition.left}px`,
                                                width: '220px',
                                                zIndex: 10,
                                                backgroundColor: '#16202c',
                                                padding: '12px',
                                                borderRadius: '8px',
                                                border: '1px solid #3b82f6',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                                textAlign: 'left'
                                            }}
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <Form.Group className="mb-2">
                                                <Form.Label style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '4px' }}>Marker Label</Form.Label>
                                                <Form.Control
                                                    size="sm"
                                                    type="text"
                                                    value={marker?.label || ''}
                                                    onChange={(e) => handleLabelChange(editingMarkerId, e.target.value)}
                                                    placeholder="e.g. GSW"
                                                    style={{ backgroundColor: '#0d1117', color: '#e2e8f0', borderColor: '#334155' }}
                                                    autoFocus
                                                />
                                            </Form.Group>
                                            <Form.Group className="mb-3">
                                                <Form.Label style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '4px' }}>Anatomic Summary</Form.Label>
                                                <Form.Control
                                                    size="sm"
                                                    as="textarea"
                                                    rows={3}
                                                    value={displaySummary || ''}
                                                    onChange={(e) => handleSummaryChange(editingMarkerId, e.target.value)}
                                                    style={{ backgroundColor: '#0d1117', color: '#e2e8f0', borderColor: '#334155', fontSize: '0.8rem' }}
                                                />
                                            </Form.Group>
                                            <div className="d-flex justify-content-end">
                                                <Button size="sm" variant="primary" onClick={() => setEditingMarkerId(null)}>OK</Button>
                                            </div>
                                        </div>
                                    )
                                })()}
                            </div>
                        </div>
                    </div>
                    <div style={modalFooterStyle}>
                        <Button variant="outline-info" size="sm" onClick={handleCopyToClipboard} disabled={isProcessingImage || imageStatus !== 'loaded'}>
                            {isProcessingImage ? 'Processing...' : 'Copy Diagram'}
                        </Button>
                        <Button variant="outline-success" size="sm" onClick={handleUpload} disabled={isProcessingImage || imageStatus !== 'loaded'} style={{ marginLeft: '10px' }}>
                            {isProcessingImage ? 'Processing...' : 'Upload'}
                        </Button>
                        <Button variant="outline-secondary" size="sm" onClick={increaseMarkerSize}>Increase Marker Size</Button>
                        <Button variant="outline-secondary" size="sm" onClick={decreaseMarkerSize}>Decrease Marker Size</Button>
                        <div style={{ flexGrow: 1 }}></div>
                        <Button variant="secondary" onClick={onHide} disabled={isProcessingImage}>Cancel</Button>
                        <Button variant="primary" onClick={handleSave} disabled={isProcessingImage} style={{marginLeft: '10px'}}>Done & Save Diagram</Button>
                    </div>
                </div>
            </div>
        </>
    );
};
export default AutopsyDiagramModal;
