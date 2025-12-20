import React, { useState, useRef, useEffect } from 'react';
import { Button, OverlayTrigger, Tooltip, Form } from 'react-bootstrap';
import { Stage, Layer, Image as KonvaImage, Circle, Text, Group, Rect } from 'react-konva';
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
    width: '90%',
    maxWidth: '1000px',
    height: '90vh',
    maxHeight: '95vh',
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
const imageContainerStyle = {
    position: 'relative',
    width: '100%',
    flexGrow: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'auto',
    marginBottom: '10px',
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

const getGroupedLabeledMarkers = (markers) => {
    const labeledMarkers = markers.filter(m => m.label && m.label.trim() !== '');
    const grouped = labeledMarkers.reduce((acc, marker) => {
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
        grouped[groupKey].sort((a, b) => a.id.localeCompare(b.id));
        grouped[groupKey].forEach((marker, index) => {
            const prefix = String.fromCharCode(65 + index);
            result.push({
                ...marker,
                displayLabel: `${marker.label.trim()}-${prefix}`
            });
        });
    });

    return result;
};

const AutopsyDiagramModal = ({
    show,
    onHide,
    onSaveDiagram,
    initialMarkers = [],
    showNotification,
    removeNotification,
    handleImageUpload
}) => {
    const [markers, setMarkers] = useState([]);
    const [selectedMarkerType, setSelectedMarkerType] = useState('circle');
    const [editingMarkerId, setEditingMarkerId] = useState(null);
    const [inputPosition, setInputPosition] = useState(null);
    const [selectedSilhouetteType, setSelectedSilhouetteType] = useState('male');
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    const [markerSizeMultiplier, setMarkerSizeMultiplier] = useState(1);
    const notificationIdRef = useRef(null);

    const imageContainerRef = useRef(null);
    const stageRef = useRef(null);
    const prevShowRef = useRef(show);

    const imageToLoad = selectedSilhouetteType === 'female' ? femalebodySilhouette : malebodySilhouette;
    const [image, imageStatus] = useImage(imageToLoad);

    useEffect(() => {
        if (show && !prevShowRef.current) {
            if (showNotification) {
                const message = (
                    <>
                        <strong>Warning:</strong> Resolutions above 1440p may cause marker placement issues. Dragging markers should work correctly.
                        <hr />
                        Instructions: Click on the diagram to add a marker. Click a marker to remove it. Double-click a marker to edit its label. Use the buttons below to change marker types and add labels.
                    </>
                );
                notificationIdRef.current = showNotification(message, 'info', 0);
            }
            setMarkers(initialMarkers.map(marker => ({
                ...marker,
                label: marker.label || '',
                labelSide: marker.labelSide || 'right',
            })));
            setEditingMarkerId(null);
        }

        if (!show && prevShowRef.current) {
            if (notificationIdRef.current && removeNotification) {
                removeNotification(notificationIdRef.current);
                notificationIdRef.current = null;
            }
        }

        prevShowRef.current = show;
    }, [show, initialMarkers, showNotification, removeNotification]);

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

        const stage = e.target.getStage();
        const pos = getRelativePointerPosition(stage);

        const newMarker = {
            x: pos.x,
            y: pos.y,
            type: selectedMarkerType,
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            label: '',
            labelSide: pos.x > image.width * 0.8 ? 'left' : 'right',
        };
        setMarkers(prevMarkers => [...prevMarkers, newMarker]);
        setEditingMarkerId(newMarker.id);
    };

    const handleDragEnd = (e, id) => {
        const newMarkers = markers.slice();
        const marker = newMarkers.find(m => m.id === id);
        if (marker) {
            marker.x = e.target.x();
            marker.y = e.target.y();
        }
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
            onSaveDiagram(markers, imageUrl);
            setIsProcessingImage(false);
        }
        onHide();
    };

    const increaseMarkerSize = () => setMarkerSizeMultiplier(prev => prev + 0.25);
    const decreaseMarkerSize = () => setMarkerSizeMultiplier(prev => prev - 0.25);

    const renderMarkers = () => {
        const labeledMarkers = getGroupedLabeledMarkers(markers);
        const stage = stageRef.current;
        const scale = stage ? stage.scaleX() : 1;

        const baseRadius = 9;
        const baseCrossFontSize = 19;
        const baseLabelFontSize = 11;

        return markers.map(marker => {
            const markerWithDisplayLabel = labeledMarkers.find(m => m.id === marker.id);
            const displayLabelText = markerWithDisplayLabel?.displayLabel || marker.label;

            return (
                <Group
                    key={marker.id}
                    id={marker.id}
                    x={marker.x}
                    y={marker.y}
                    draggable
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

                    {displayLabelText && editingMarkerId !== marker.id && (() => {
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

    const moreLabelButtons = [
        { short: "BLUNT", full: "Blunt Force Trauma" },
        { short: "BURN", full: "Burn Injury" },
        { short: "LAC", full: "Laceration" },
        { short: "FX", full: "Fracture" },
        { short: "BITE", full: "Bite Mark" },
        { short: "TSR", full: "Taser Probe Mark" },
        { short: "CHEM", full: "Chemical Exposure" },
        { short: "ENV", full: "Environmental Exposure" },
        { short: "AMP", full: "Amputation" },
    ];

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
                                <span style={{ borderLeft: '1px solid #30363d', height: '20px', margin: '0 5px' }}></span>

                                <Button variant={selectedMarkerType === 'circle' ? 'danger' : 'outline-danger'} size="sm" onClick={() => setSelectedMarkerType('circle')}>Circle (O)</Button>
                                <Button variant={selectedMarkerType === 'cross' ? 'danger' : 'outline-danger'} size="sm" onClick={() => setSelectedMarkerType('cross')}>Cross (X)</Button>
                                <Button variant="outline-light" size="sm" onClick={() => handleAddLabelToLastMarker('GSW')} disabled={markers.length === 0} style={{fontSize: '0.75rem'}}>GSW</Button>
                                <Button variant="outline-light" size="sm" onClick={() => handleAddLabelToLastMarker('STAB')} disabled={markers.length === 0} style={{fontSize: '0.75rem'}}>STAB</Button>
                                <Button variant="outline-light" size="sm" onClick={() => handleAddLabelToLastMarker('UNK')} disabled={markers.length === 0} style={{fontSize: '0.75rem'}}>UNK</Button>
                                <Button variant="outline-light" size="sm" onClick={() => handleAddLabelToLastMarker('TRAUMA')} disabled={markers.length === 0} style={{fontSize: '0.75rem'}}>TRAUMA</Button>
                                {moreLabelButtons.map(btn => (
                                    <OverlayTrigger
                                        key={btn.short}
                                        placement="top"
                                        overlay={<Tooltip id={`tooltip-${btn.short}`}>{btn.full}</Tooltip>}
                                    >
                                        <Button
                                            variant="outline-light"
                                            size="sm"
                                            onClick={() => handleAddLabelToLastMarker(btn.short)}
                                            disabled={markers.length === 0}
                                            style={{ fontSize: '0.75rem' }}
                                        >
                                            {btn.short}
                                        </Button>
                                    </OverlayTrigger>
                                ))}
                                <Button variant="outline-secondary" size="sm" onClick={handleToggleLastMarkerLabelSide} disabled={isToggleLabelSideDisabled} title="Toggle Last Label's Side">
                                    <i className={`fas fa-exchange-alt`}></i> Toggle Label Side
                                </Button>
                                <Button variant="outline-secondary" size="sm" onClick={handleUndoLastMarker} disabled={markers.length === 0}>Undo</Button>
                                <Button variant="outline-warning" size="sm" onClick={handleClearAllMarkers} disabled={markers.length === 0}>Clear All</Button>
                            </div>
                        </div>

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
                                        {renderMarkers()}
                                    </Layer>
                                </Stage>
                            ) : (
                                <div>Loading image...</div>
                            )}
                            {inputPosition && (() => {
                                const marker = markers.find(m => m.id === editingMarkerId);
                                return (
                                    <Form.Control
                                        style={{
                                            position: 'absolute',
                                            top: `${inputPosition.top}px`,
                                            left: `${inputPosition.left}px`,
                                            width: '100px',
                                            zIndex: 10,
                                            backgroundColor: '#16202c',
                                            color: '#eeeeeeb0',
                                            borderColor: '#30363d',
                                        }}
                                        type="text"
                                        value={marker?.label || ''}
                                        onChange={(e) => handleLabelChange(editingMarkerId, e.target.value)}
                                        onBlur={() => setEditingMarkerId(null)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setEditingMarkerId(null);
                                            }
                                        }}
                                        autoFocus
                                        size="sm"
                                    />
                                )
                            })()}
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
