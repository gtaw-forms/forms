import React, { useState, useRef, useEffect, useCallback } from 'react'; // Added useCallback
import { Button, OverlayTrigger, Tooltip, Form } from 'react-bootstrap'; // Added Form
import malebodySilhouette from '../assets/male-body-silhouette.jpg';
import femalebodySilhouette from '../assets/female-body-silhouette.png';

// --- Styles (Keep existing styles) ---
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
    flexGrow: 1, // Allow image container to take available space
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'auto', // Add scroll to container if image is larger than space
    marginBottom: '10px',
};
const bodyImageStyle = {
    maxWidth: '100%',
    maxHeight: '100%',
    display: 'block',
    userSelect: 'none',
    objectFit: 'contain',
};
const markerControlsStyle = {
    marginBottom: '15px', // Space below the entire controls wrapper
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px', // Space between buttons
    justifyContent: 'center',
    alignItems: 'center',
    // flexShrink: 0 is on the wrapper div now
};
const modalFooterStyle = {
    borderTop: '1px solid #30363d', paddingTop: '15px', marginTop: 'auto',
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    flexShrink: 0,
};
const processingButtonStyle = {
    color: '#adb5bd',
    backgroundColor: 'rgba(52, 58, 64, 0.3)',
    borderColor: '#495057',
    opacity: 1,
};
// --- End Styles ---

const loadImage = (src) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = src;
    });
};

// Helper function to group and label markers
const getGroupedLabeledMarkers = (markers) => {
    const labeledMarkers = markers.filter(m => m.label && m.label.trim() !== '');
    const grouped = labeledMarkers.reduce((acc, marker) => {
        const labelKey = marker.label.trim().toUpperCase();
        const groupKey = `${marker.type}-${labelKey}`; // Group by type and label

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
            const prefix = String.fromCharCode(65 + index); // A, B, C...
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
    onDiagramImgurUpload
}) => {
    const [markers, setMarkers] = useState([]);
    const [selectedMarkerType, setSelectedMarkerType] = useState('circle');
    const [editingMarkerId, setEditingMarkerId] = useState(null);
    const [draggingMarker, setDraggingMarker] = useState(null); // { id, initialX, initialY, startMouseX, startMouseY, imgWidth, imgHeight }
    const imageRef = useRef(null);
    const imageContainerRef = useRef(null);
    const prevShowRef = useRef(show);
    const canvasRef = useRef(null);
    const [bodyImage, setBodyImage] = useState(null);
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    const [selectedSilhouetteType, setSelectedSilhouetteType] = useState('male'); // 'male' or 'female'
    const wasDragging = useRef(false);

    const IMGUR_CLIENT_ID = process.env.REACT_APP_IMGUR_CLIENT_ID;

    useEffect(() => {
        const imageToLoad = selectedSilhouetteType === 'female' ? femalebodySilhouette : malebodySilhouette;
        loadImage(imageToLoad)
            .then(img => setBodyImage(img))
            .catch(err => {
                console.error(`Failed to load ${selectedSilhouetteType} body silhouette:`, err);
                if (selectedSilhouetteType === 'female') {
                    loadImage(malebodySilhouette).then(setBodyImage).catch(e => console.error("Fallback to male silhouette also failed:", e));
                }
            });
    }, [selectedSilhouetteType]);

    useEffect(() => {
        if (show && !prevShowRef.current) {
            setMarkers(initialMarkers.map(marker => ({
                ...marker,
                label: marker.label || '',
                labelSide: marker.labelSide || 'right',
            })));
            setEditingMarkerId(null);
        }
        prevShowRef.current = show;
    }, [show, initialMarkers]);

    const handleImageClick = (event) => {
        if (editingMarkerId || draggingMarker) {
            setEditingMarkerId(null);
            return;
        }

        const imgElement = imageRef.current;
        const containerElement = imageContainerRef.current;
        if (!containerElement || !imgElement || !imgElement.complete || !bodyImage) return;

        // Check if the click was on the actual image, not letterboxing.
        const imgRect = imgElement.getBoundingClientRect();
        const naturalWidth = bodyImage.naturalWidth;
        const naturalHeight = bodyImage.naturalHeight;
        const naturalAspectRatio = naturalWidth / naturalHeight;
        const elementAspectRatio = imgRect.width / imgRect.height;

        let renderedWidth = imgRect.width;
        let renderedHeight = imgRect.height;
        let renderedContentOffsetX = 0;
        let renderedContentOffsetY = 0;

        if (naturalAspectRatio > elementAspectRatio) {
            renderedHeight = imgRect.width / naturalAspectRatio;
            renderedContentOffsetY = (imgRect.height - renderedHeight) / 2;
        } else {
            renderedWidth = imgRect.height * naturalAspectRatio;
            renderedContentOffsetX = (imgRect.width - renderedWidth) / 2;
        }

        const clickXInImg = event.nativeEvent.offsetX;
        const clickYInImg = event.nativeEvent.offsetY;

        const clickXInImageContent = clickXInImg - renderedContentOffsetX;
        const clickYInImageContent = clickYInImg - renderedContentOffsetY;

        if (clickXInImageContent < 0 || clickXInImageContent > renderedWidth || clickYInImageContent < 0 || clickYInImageContent > renderedHeight) {
            return; // Click was on the letterbox, so ignore it
        }

        // Now calculate the percentage relative to the container
        const containerRect = containerElement.getBoundingClientRect();
        const clickXInContainer = (imgRect.left - containerRect.left) + clickXInImg;
        const clickYInContainer = (imgRect.top - containerRect.top) + clickYInImg;

        let markerXPercent = (clickXInContainer / containerRect.width) * 100;
        let markerYPercent = (clickYInContainer / containerRect.height) * 100;


        const newMarker = {
            x: markerXPercent,
            y: markerYPercent,
            type: selectedMarkerType,
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            label: '',
            // Default the label to the left side if the marker is on the right 20% of the image
            labelSide: markerXPercent > 80 ? 'left' : 'right',
        };
        setMarkers(prevMarkers => [...prevMarkers, newMarker]);
        setEditingMarkerId(newMarker.id);
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

    const drawDiagramOnCanvas = useCallback(async () => {
        if (!canvasRef.current || !bodyImage) {
            console.error("Canvas or body image not ready for drawing.");
            return null;
        }
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const sourceImage = bodyImage;

        canvas.width = sourceImage.naturalWidth;
        canvas.height = sourceImage.naturalHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);

        const markersToDraw = getGroupedLabeledMarkers(markers);

        markers.forEach(marker => {
            const canvasDrawX = (marker.x / 100) * canvas.width;
            const canvasDrawY = (marker.y / 100) * canvas.height;

            if (marker.type === 'circle') {
                ctx.beginPath();
                ctx.arc(canvasDrawX, canvasDrawY, 15, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
                ctx.fill();
                ctx.strokeStyle = 'darkred';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            } else if (marker.type === 'cross') {
                ctx.beginPath();
                ctx.strokeStyle = 'red';
                ctx.lineWidth = 5;
                const crossSize = 15;
                ctx.moveTo(canvasDrawX - crossSize, canvasDrawY - crossSize);
                ctx.lineTo(canvasDrawX + crossSize, canvasDrawY + crossSize);
                ctx.moveTo(canvasDrawX + crossSize, canvasDrawY - crossSize);
                ctx.lineTo(canvasDrawX - crossSize, canvasDrawY + crossSize);
                ctx.stroke();
            }
        });

        markersToDraw.forEach(marker => {
            const canvasDrawX = (marker.x / 100) * canvas.width;
            const canvasDrawY = (marker.y / 100) * canvas.height;
            const labelToDraw = marker.displayLabel;

            if (labelToDraw) {
                const labelFontSize = 20;
                ctx.font = `${labelFontSize}px Arial`;
                const textMetrics = ctx.measureText(labelToDraw);
                const textWidth = textMetrics.width;
                const textHeight = labelFontSize;
                const padding = 4;
                const labelBgWidth = textWidth + (padding * 2);
                const labelBgHeight = textHeight + (padding * 2);

                let labelTextX, labelBgX;
                const baseOffset = 18;
                if (marker.labelSide === 'right') {
                    labelTextX = canvasDrawX + baseOffset;
                    labelBgX = labelTextX - padding;
                    ctx.textAlign = 'left';
                } else {
                    labelTextX = canvasDrawX - baseOffset;
                    labelBgX = labelTextX - textWidth - padding;
                    ctx.textAlign = 'right';
                }
                const labelTextY = canvasDrawY;
                const labelBgY = labelTextY - (textHeight / 2) - padding;

                ctx.fillStyle = 'rgba(50, 50, 50, 0.7)';
                ctx.fillRect(labelBgX, labelBgY, labelBgWidth, labelBgHeight);

                ctx.fillStyle = '#FFFFFF';
                ctx.textBaseline = 'middle';
                ctx.fillText(labelToDraw, labelTextX, labelTextY);
            }
        });
        return canvas;
    }, [markers, bodyImage]);

    const handleCopyToClipboard = useCallback(async () => {
        setIsProcessingImage(true);
        const canvas = await drawDiagramOnCanvas();
        if (canvas && navigator.clipboard && navigator.clipboard.write) {
            canvas.toBlob(async (blob) => {
                if (blob) {
                    try {
                        await navigator.clipboard.write([ new ClipboardItem({ [blob.type]: blob }) ]);
                        if (showNotification) showNotification('Diagram copied to clipboard!', 'check-circle');
                    } catch (err) {
                        console.error('Failed to copy diagram:', err);
                        if (showNotification) showNotification('Failed to copy diagram. See console for details.', 'exclamation-triangle');
                    }
                } else {
                    console.error('Failed to create image blob for clipboard.');
                    if (showNotification) showNotification('Failed to create image blob for clipboard.', 'exclamation-triangle');
                }
                setIsProcessingImage(false);
            }, 'image/png');
        } else {
            console.warn('Clipboard API not available or canvas drawing failed.');
            if (showNotification) showNotification('Clipboard API not available or canvas drawing failed.', 'exclamation-triangle');
            setIsProcessingImage(false);
        }
    }, [drawDiagramOnCanvas, showNotification]);

    const handleUploadToImgur = useCallback(async () => {
        if (!IMGUR_CLIENT_ID) {
            if (showNotification) showNotification('Imgur Client ID is not configured.', 'error');
            return;
        }
        setIsProcessingImage(true);
        const canvas = await drawDiagramOnCanvas();
        if (!canvas) {
            if (showNotification) showNotification('Failed to draw diagram on canvas.', 'exclamation-triangle');
            setIsProcessingImage(false);
            return;
        }
        const dataUrl = canvas.toDataURL('image/png');
        const base64Image = dataUrl.split(',')[1];
        try {
            const formData = new FormData();
            formData.append('image', base64Image);
            const response = await fetch('https://api.imgur.com/3/image', {
                method: 'POST',
                headers: { Authorization: `Client-ID ${IMGUR_CLIENT_ID}` },
                body: formData,
            });
            const result = await response.json();
            if (result.success) {
                if (showNotification) showNotification(`Uploaded to Imgur! Link: ${result.data.link}`, 'check-circle');
                if (onDiagramImgurUpload) onDiagramImgurUpload(result.data.link);
            } else {
                const errorMessage = result.data.error?.message || result.data.error || 'Unknown error';
                console.error('Imgur Upload Failed:', result);
                if (showNotification) showNotification(`Imgur Upload Failed: ${errorMessage}`, 'exclamation-triangle');
            }
        } catch (error) {
            console.error('Error during Imgur upload:', error);
            if (showNotification) showNotification('Error during Imgur upload. See console.', 'exclamation-triangle');
        }
        setIsProcessingImage(false);
    }, [drawDiagramOnCanvas, showNotification, onDiagramImgurUpload, IMGUR_CLIENT_ID]);

    const handleAddLabelToLastMarker = (labelText) => {
        setMarkers(prevMarkers => {
            if (prevMarkers.length === 0) return prevMarkers;
            const lastMarkerIndex = prevMarkers.length - 1;
            return prevMarkers.map((marker, index) =>
                index === lastMarkerIndex ? { ...marker, label: labelText.substring(0, 9) } : marker
            );
        });
        setEditingMarkerId(null);
    };

    const handleRemoveMarker = (markerIdToRemove) => {
        setMarkers(prevMarkers => prevMarkers.filter(marker => marker.id !== markerIdToRemove));
        if (editingMarkerId === markerIdToRemove) {
            setEditingMarkerId(null);
        }
    };

    const handleUndoLastMarker = () => {
        if (markers.length > 0) {
            const lastMarkerId = markers[markers.length - 1].id;
            setMarkers(prev => prev.slice(0, -1));
            if (editingMarkerId === lastMarkerId) {
                setEditingMarkerId(null);
            }
        }
    };

    const handleClearAllMarkers = () => {
        if (markers.length > 0) {
            setMarkers([]);
            setEditingMarkerId(null);
        }
    };

    const handleSave = () => {
        if (onSaveDiagram) {
            onSaveDiagram(markers);
        }
        onHide();
    };

    const handleLabelInputChange = (markerId, value) => {
        setMarkers(prevMarkers => prevMarkers.map(marker =>
            marker.id === markerId ? { ...marker, label: value.substring(0, 9) } : marker
        ));
    };

    const handleLabelInputBlur = () => {
        setEditingMarkerId(null);
    };

    const handleMarkerMouseDown = (e, markerId) => {
        e.preventDefault();
        e.stopPropagation();
        wasDragging.current = false;

        const marker = markers.find(m => m.id === markerId);
        const imgElement = imageRef.current;

        if (!marker || !imgElement || !bodyImage) return;

        const imgRect = imgElement.getBoundingClientRect();
        const naturalWidth = bodyImage.naturalWidth;
        const naturalHeight = bodyImage.naturalHeight;
        const naturalAspectRatio = naturalWidth / naturalHeight;
        const elementAspectRatio = imgRect.width / imgRect.height;

        let renderedWidth = imgRect.width;
        let renderedHeight = imgRect.height;

        if (naturalAspectRatio > elementAspectRatio) {
            renderedHeight = imgRect.width / naturalAspectRatio;
        } else {
            renderedWidth = imgRect.height * naturalAspectRatio;
        }

        setDraggingMarker({
            id: markerId,
            initialX: marker.x,
            initialY: marker.y,
            startMouseX: e.clientX,
            startMouseY: e.clientY,
            imgWidth: renderedWidth, // Use rendered width
            imgHeight: renderedHeight, // Use rendered height
        });
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!draggingMarker) return;
            wasDragging.current = true;

            const deltaX = e.clientX - draggingMarker.startMouseX;
            const deltaY = e.clientY - draggingMarker.startMouseY;

            const deltaPercentX = (deltaX / draggingMarker.imgWidth) * 100;
            const deltaPercentY = (deltaY / draggingMarker.imgHeight) * 100;

            let newX = draggingMarker.initialX + deltaPercentX;
            let newY = draggingMarker.initialY + deltaPercentY;
            console.log(`Dragging: Initial Coords (%): X=${newX}, Y=${newY}`);

            // Clamp values to keep the entire marker inside the image bounds.
            const markerPixelRadius = 10; // Half of the marker's approx pixel size (e.g., 20px)
            const paddingX = (markerPixelRadius / draggingMarker.imgWidth) * 100;
            const paddingY = (markerPixelRadius / draggingMarker.imgHeight) * 100;

            newX = Math.max(paddingX, Math.min(100 - paddingX, newX));
            newY = Math.max(paddingY, Math.min(100 - paddingY, newY));
            console.log(`Dragging: Clamped Coords (%): X=${newX}, Y=${newY}`);

            setMarkers(currentMarkers =>
                currentMarkers.map(m =>
                    m.id === draggingMarker.id
                        ? { ...m, x: newX, y: newY }
                        : m
                )
            );
        };

        const handleMouseUp = () => {
            setDraggingMarker(null);
        };

        if (draggingMarker) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingMarker, markers, bodyImage]); // Add bodyImage to dependency array

    const renderMarker = (marker) => {
        const anchorPointStyle = {
            position: 'absolute',
            left: `${marker.x}%`,
            top: `${marker.y}%`,
            zIndex: 10,
            cursor: draggingMarker && draggingMarker.id === marker.id ? 'grabbing' : 'grab',
        };
        const symbolBaseStyle = {
            position: 'absolute',
            transform: 'translate(-50%, -50%)',
        };
        const circleSymbolStyle = {
            ...symbolBaseStyle,
            width: '15px', height: '15px', backgroundColor: 'rgba(255, 0, 0, 0.7)',
            borderRadius: '50%', border: '1px solid darkred',
        };
        const crossSymbolStyle = {
            ...symbolBaseStyle,
            color: 'red', fontSize: '20px', fontWeight: 'bold',
            lineHeight: '1', userSelect: 'none',
        };

        const labelStyle = {
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '10px', color: '#f0f0f0', backgroundColor: 'rgba(0,0,0,0.6)',
            padding: '1px 4px', borderRadius: '3px', whiteSpace: 'nowrap',
            cursor: 'pointer',
            zIndex: 1,
        };

        if (marker.labelSide === 'right') {
            labelStyle.left = '12px';
        } else {
            labelStyle.right = '12px';
        }

        const labeledMarkers = getGroupedLabeledMarkers(markers);
        const markerWithDisplayLabel = labeledMarkers.find(m => m.id === marker.id);
        const displayLabelText = markerWithDisplayLabel?.displayLabel || marker.label;

        return (
            <div
                key={marker.id}
                style={anchorPointStyle}
                onMouseDown={(e) => handleMarkerMouseDown(e, marker.id)}
            >
                <div
                    style={symbolBaseStyle}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (wasDragging.current) {
                            wasDragging.current = false;
                            return;
                        }
                        handleRemoveMarker(marker.id);
                    }}
                    role="button"
                    aria-label={`Remove ${marker.type}`}
                >
                    {marker.type === 'circle' && <div style={circleSymbolStyle}></div>}
                    {marker.type === 'cross' && <div style={crossSymbolStyle}>X</div>}
                </div>

                {editingMarkerId === marker.id ? (
                    <Form.Control
                        type="text"
                        value={marker.label}
                        onChange={(e) => handleLabelInputChange(marker.id, e.target.value)}
                        onBlur={handleLabelInputBlur}
                        maxLength={9}
                        autoFocus
                        size="sm"
                        style={{
                            position: 'absolute',
                            top: '50%',
                            transform: marker.labelSide === 'right' ? 'translateY(-50%)' : 'translate(-100%, -50%)',
                            [marker.labelSide]: '12px',
                            width: '80px',
                            fontSize: '10px',
                            padding: '1px 4px',
                            backgroundColor: '#16202c',
                            color: '#eeeeeeb0',
                            borderColor: '#30363d',
                            zIndex: 2,
                        }}
                        onClick={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()} // Prevent drag from starting on input
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleLabelInputBlur();
                            }
                        }}
                    />
                ) : (
                    marker.label && (
                        <span
                            style={labelStyle}
                            onClick={(e) => { e.stopPropagation(); setEditingMarkerId(marker.id); }}
                            onMouseDown={e => e.stopPropagation()} // Prevent drag from starting on label
                        >
                            {displayLabelText}
                        </span>
                    )
                )}
            </div>
        );
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

    return (
        <>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
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
                            <img
                                ref={imageRef}
                                src={selectedSilhouetteType === 'female' ? femalebodySilhouette : malebodySilhouette}
                                alt={`Autopsy diagram area - ${selectedSilhouetteType}`}
                                style={bodyImageStyle}
                                onClick={handleImageClick}
                            />
                            {markers.map(marker => renderMarker(marker))}
                        </div>
                        <small style={{ color: '#8b949e', flexShrink: 0 }}>
                            Click diagram to add a marker. Drag marker to reposition. Click marker symbol to remove.
                        </small>
                    </div>
                    <div style={modalFooterStyle}>
                        <Button variant="outline-info" size="sm" onClick={handleCopyToClipboard} disabled={isProcessingImage || !bodyImage || !canvasRef.current} style={isProcessingImage ? processingButtonStyle : {}}>
                            {isProcessingImage ? 'Processing...' : 'Copy Diagram'}
                        </Button>
                        <Button variant="outline-success" size="sm" onClick={handleUploadToImgur} disabled={isProcessingImage || !bodyImage || !canvasRef.current || !IMGUR_CLIENT_ID} style={isProcessingImage ? { ...processingButtonStyle, marginLeft: '10px' } : { marginLeft: '10px' }}>
                            {isProcessingImage ? 'Processing...' : 'Upload to Imgur'}
                        </Button>
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