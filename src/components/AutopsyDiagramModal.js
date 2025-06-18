// src/components/AutopsyDiagramModal.js
import React, { useState, useRef, useEffect, useCallback } from 'react'; // Added useCallback
import { Button, OverlayTrigger, Tooltip, Form } from 'react-bootstrap'; // Added Form
import bodySilhouette from '../assets/body-silhouette.jpg';

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
        const labelKey = marker.label.trim().toUpperCase(); // Group by trimmed uppercase label
        if (!acc[labelKey]) {
            acc[labelKey] = [];
        }
        acc[labelKey].push(marker);
        return acc;
    }, {});

    const result = [];
    // Sort groups alphabetically by label key
    Object.keys(grouped).sort().forEach(labelKey => {
        // Sort markers within each group (e.g., by placement order using id)
        grouped[labelKey].sort((a, b) => a.id.localeCompare(b.id)); // Sort by ID (timestamp + random)
        grouped[labelKey].forEach((marker, index) => {
            const prefix = String.fromCharCode(65 + index); // A, B, C... within the group
            result.push({
                ...marker,
                displayLabel: `${prefix}-${marker.label.trim()}`
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
    const [editingMarkerId, setEditingMarkerId] = useState(null); // State to track which marker label is being edited
    const imageRef = useRef(null);
    const imageContainerRef = useRef(null);
    const prevShowRef = useRef(show);
    const canvasRef = useRef(null);
    const [bodyImage, setBodyImage] = useState(null);
    const [isProcessingImage, setIsProcessingImage] = useState(false);

    const IMGUR_CLIENT_ID = process.env.REACT_APP_IMGUR_CLIENT_ID;

    useEffect(() => {
        loadImage(bodySilhouette)
            .then(img => setBodyImage(img))
            .catch(err => console.error("Failed to load body silhouette:", err));
    }, []);

    useEffect(() => {
        if (show && !prevShowRef.current) {
            // When modal opens, load initial markers and ensure they have label/labelSide properties
            setMarkers(initialMarkers.map(marker => ({
                ...marker,
                label: marker.label || '', // Ensure label exists
                labelSide: marker.labelSide || 'right' // Ensure labelSide exists
            })));
            setEditingMarkerId(null); // Reset editing state
        }
        prevShowRef.current = show;
    }, [show, initialMarkers]);

    const handleImageClick = (event) => {
        const imgElement = imageRef.current;
        const containerElement = imageContainerRef.current;

        if (!imgElement || !imgElement.complete || !containerElement) {
            return;
        }
        if (imgElement.naturalWidth === 0 || imgElement.naturalHeight === 0) {
            return;
        }

        const imgRect = imgElement.getBoundingClientRect();
        const containerRect = containerElement.getBoundingClientRect();
        const clickXInImgElement = event.clientX - imgRect.left;
        const clickYInImgElement = event.clientY - imgRect.top;
        const imgElementBoxWidth = imgRect.width;
        const imgElementBoxHeight = imgRect.height;
        const naturalWidth = imgElement.naturalWidth;
        const naturalHeight = imgElement.naturalHeight;
        const imgElementBoxAspectRatio = imgElementBoxWidth / imgElementBoxHeight;
        const naturalAspectRatio = naturalWidth / naturalHeight;
        let renderedImageContentWidth, renderedImageContentHeight;

        if (naturalAspectRatio > imgElementBoxAspectRatio) {
            renderedImageContentWidth = imgElementBoxWidth;
            renderedImageContentHeight = imgElementBoxWidth / naturalAspectRatio;
        } else {
            renderedImageContentHeight = imgElementBoxHeight;
            renderedImageContentWidth = imgElementBoxHeight * naturalAspectRatio;
        }

        const internalOffsetX = (imgElementBoxWidth - renderedImageContentWidth) / 2;
        const internalOffsetY = (imgElementBoxHeight - renderedImageContentHeight) / 2;

        if (
            clickXInImgElement >= internalOffsetX &&
            clickXInImgElement <= internalOffsetX + renderedImageContentWidth &&
            clickYInImgElement >= internalOffsetY &&
            clickYInImgElement <= internalOffsetY + renderedImageContentHeight
        ) {
            const clickAbsoluteXInContainer = (imgRect.left - containerRect.left) + clickXInImgElement;
            const clickAbsoluteYInContainer = (imgRect.top - containerRect.top) + clickYInImgElement;
            const markerXPercent = containerRect.width > 0 ? (clickAbsoluteXInContainer / containerRect.width) * 100 : 0;
            const markerYPercent = containerRect.height > 0 ? (clickAbsoluteYInContainer / containerRect.height) * 100 : 0;
            const finalX = Math.max(0, Math.min(100, markerXPercent));
            const finalY = Math.max(0, Math.min(100, markerYPercent));

            const newMarker = {
                x: finalX,
                y: finalY,
                type: selectedMarkerType,
                id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
                label: '', // New markers start with an empty label
                labelSide: 'right',
            };
            setMarkers(prevMarkers => [...prevMarkers, newMarker]);
            setEditingMarkerId(newMarker.id); // Immediately start editing the label of the new marker
        }
    };

    const handleToggleLastMarkerLabelSide = () => {
        setMarkers(prevMarkers => {
            if (prevMarkers.length === 0) return prevMarkers;
            // Find the last marker that has a label
            const lastLabeledMarkerIndex = prevMarkers.slice().reverse().findIndex(m => m.label && m.label.trim() !== '');

            if (lastLabeledMarkerIndex === -1) {
                 if (showNotification) showNotification("No labeled marker to toggle side for. Add a label first.", "info");
                return prevMarkers;
            }
            // Adjust index for the original array
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

        const displayedImgElement = imageRef.current;
        const containerElement = imageContainerRef.current;

        if (!displayedImgElement || !containerElement) {
            console.error("DOM elements for coordinate transformation not found in drawDiagramOnCanvas");
            return canvas;
        }

        const containerRect = containerElement.getBoundingClientRect();
        const displayedImgRect = displayedImgElement.getBoundingClientRect();
        const naturalWidth = sourceImage.naturalWidth;
        const naturalHeight = sourceImage.naturalHeight;
        const displayedImgBoxWidth = displayedImgRect.width;
        const displayedImgBoxHeight = displayedImgRect.height;
        const naturalAspectRatio = naturalWidth / naturalHeight;
        const displayedImgBoxAspectRatio = displayedImgBoxWidth > 0 ? displayedImgBoxWidth / displayedImgBoxHeight : naturalAspectRatio;

        let visualContentW, visualContentH;
        if (naturalAspectRatio > displayedImgBoxAspectRatio) {
            visualContentW = displayedImgBoxWidth;
            visualContentH = displayedImgBoxWidth / naturalAspectRatio;
        } else {
            visualContentH = displayedImgBoxHeight;
            visualContentW = displayedImgBoxHeight * naturalAspectRatio;
        }

        const visualContentOffsetXInDisplayedImg = (displayedImgBoxWidth - visualContentW) / 2;
        const visualContentOffsetYInDisplayedImg = (displayedImgBoxHeight - visualContentH) / 2;
        const visualContentScreenX = displayedImgRect.left + visualContentOffsetXInDisplayedImg;
        const visualContentScreenY = displayedImgRect.top + visualContentOffsetYInDisplayedImg;

        // Use the helper to get markers with grouped display labels
        const markersToDraw = getGroupedLabeledMarkers(markers);


        markers.forEach(marker => { // Iterate through original markers to draw symbols
             const markerScreenX = containerRect.left + (marker.x / 100) * containerRect.width;
            const markerScreenY = containerRect.top + (marker.y / 100) * containerRect.height;
            const markerX_RelativeToVisual = markerScreenX - visualContentScreenX;
            const markerY_RelativeToVisual = markerScreenY - visualContentScreenY;

            let percX_onVisual = visualContentW > 0 ? (markerX_RelativeToVisual / visualContentW) * 100 : 0;
            let percY_onVisual = visualContentH > 0 ? (markerY_RelativeToVisual / visualContentH) * 100 : 0;

            percX_onVisual = Math.max(0, Math.min(100, percX_onVisual));
            percY_onVisual = Math.max(0, Math.min(100, percY_onVisual));

            const canvasDrawX = (percX_onVisual / 100) * canvas.width;
            const canvasDrawY = (percY_onVisual / 100) * canvas.height;

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
                ctx.strokeStyle = 'blue';
                ctx.lineWidth = 5;
                const crossSize = 15;
                ctx.moveTo(canvasDrawX - crossSize, canvasDrawY - crossSize);
                ctx.lineTo(canvasDrawX + crossSize, canvasDrawY + crossSize);
                ctx.moveTo(canvasDrawX + crossSize, canvasDrawY - crossSize);
                ctx.lineTo(canvasDrawX - crossSize, canvasDrawY + crossSize);
                ctx.stroke();
            }
        });

        // Draw labels separately using the grouped list
        markersToDraw.forEach(marker => {
             const markerScreenX = containerRect.left + (marker.x / 100) * containerRect.width;
            const markerScreenY = containerRect.top + (marker.y / 100) * containerRect.height;
            const markerX_RelativeToVisual = markerScreenX - visualContentScreenX;
            const markerY_RelativeToVisual = markerScreenY - visualContentScreenY;

            let percX_onVisual = visualContentW > 0 ? (markerX_RelativeToVisual / visualContentW) * 100 : 0;
            let percY_onVisual = visualContentH > 0 ? (markerY_RelativeToVisual / visualContentH) * 100 : 0;

            percX_onVisual = Math.max(0, Math.min(100, percX_onVisual));
            percY_onVisual = Math.max(0, Math.min(100, percY_onVisual));

            const canvasDrawX = (percX_onVisual / 100) * canvas.width;
            const canvasDrawY = (percY_onVisual / 100) * canvas.height;

            const labelToDraw = marker.displayLabel; // Use the displayLabel from the grouped list

            if (labelToDraw) {
                const labelFontSize = 20; // Adjust font size as needed for canvas
                ctx.font = `${labelFontSize}px Arial`; // Use a standard font for canvas
                const textMetrics = ctx.measureText(labelToDraw);
                const textWidth = textMetrics.width;
                const textHeight = labelFontSize; // Approximation
                const padding = 4;
                const labelBgWidth = textWidth + (padding * 2);
                const labelBgHeight = textHeight + (padding * 2);
                const labelTextY = canvasDrawY; // Center text vertically on the marker Y
                const labelBgY = canvasDrawY - (textHeight / 2) - padding; // Position background based on text height

                let labelBgX, labelTextX;
                if (marker.labelSide === 'right') {
                    labelTextX = canvasDrawX + 18; // Offset from marker center
                    labelBgX = labelTextX - padding;
                    ctx.textAlign = 'left';
                } else {
                    labelTextX = canvasDrawX - 18; // Offset from marker center
                    labelBgX = labelTextX - textWidth - padding; // Position background to the left of text
                    ctx.textAlign = 'right';
                }

                ctx.fillStyle = 'rgba(50, 50, 50, 0.7)'; // Background color for label
                ctx.fillRect(labelBgX, labelBgY, labelBgWidth, labelBgHeight);

                ctx.fillStyle = '#FFFFFF'; // Text color
                ctx.textBaseline = 'middle'; // Align text vertically to the middle
                ctx.fillText(labelToDraw, labelTextX, labelTextY);
            }
        });
        return canvas;
    }, [markers, bodyImage]); // Add markers and bodyImage to dependencies

    const handleCopyToClipboard = useCallback(async () => {
        setIsProcessingImage(true);
        const canvas = await drawDiagramOnCanvas();
        if (canvas && navigator.clipboard && navigator.clipboard.write) {
            canvas.toBlob(async (blob) => {
                if (blob) {
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ [blob.type]: blob })
                        ]);
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
    }, [drawDiagramOnCanvas, showNotification]); // Add dependencies

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
    }, [drawDiagramOnCanvas, showNotification, onDiagramImgurUpload, IMGUR_CLIENT_ID]); // Add dependencies

    const handleAddLabelToLastMarker = (labelText) => {
        setMarkers(prevMarkers => {
            if (prevMarkers.length === 0) return prevMarkers;
            const lastMarkerIndex = prevMarkers.length - 1;
            return prevMarkers.map((marker, index) =>
                index === lastMarkerIndex ? { ...marker, label: labelText.substring(0, 9) } : marker // Apply label and limit length
            );
        });
        setEditingMarkerId(null); // Stop editing after applying a predefined label
    };

    const handleRemoveMarker = (markerIdToRemove) => {
        setMarkers(prevMarkers => prevMarkers.filter(marker => marker.id !== markerIdToRemove));
        if (editingMarkerId === markerIdToRemove) {
            setEditingMarkerId(null); // Stop editing if the edited marker is removed
        }
    };

    const handleUndoLastMarker = () => {
        if (markers.length > 0) {
            const lastMarkerId = markers[markers.length - 1].id;
            setMarkers(prev => prev.slice(0, -1));
            if (editingMarkerId === lastMarkerId) {
                setEditingMarkerId(null); // Stop editing if the undone marker was being edited
            }
        }
    };

    const handleClearAllMarkers = () => {
        if (markers.length > 0) {
            setMarkers([]);
            setEditingMarkerId(null); // Stop editing
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
            marker.id === markerId ? { ...marker, label: value.substring(0, 9) } : marker // Update label and limit length
        ));
    };

    const handleLabelInputBlur = () => {
        // Stop editing when the input loses focus
        setEditingMarkerId(null);
    };

    const renderMarker = (marker) => {
        const anchorPointStyle = {
            position: 'absolute',
            left: `${marker.x}%`,
            top: `${marker.y}%`,
            zIndex: 10,
        };
        const symbolBaseStyle = {
            position: 'absolute',
            transform: 'translate(-50%, -50%)',
            cursor: 'pointer',
        };
        const circleSymbolStyle = {
            ...symbolBaseStyle,
            width: '15px', height: '15px', backgroundColor: 'rgba(255, 0, 0, 0.7)',
            borderRadius: '50%', border: '1px solid darkred',
        };
        const crossSymbolStyle = {
            ...symbolBaseStyle,
            color: 'blue', fontSize: '20px', fontWeight: 'bold',
            lineHeight: '1', userSelect: 'none',
        };

        const labelStyle = {
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '10px', color: '#f0f0f0', backgroundColor: 'rgba(0,0,0,0.6)',
            padding: '1px 4px', borderRadius: '3px', whiteSpace: 'nowrap',
            cursor: 'pointer', // Make label clickable
            zIndex: 1,
        };

        if (marker.labelSide === 'right') {
            labelStyle.left = '12px';
        } else {
            labelStyle.right = '12px';
        }

        // Find the display label using the helper function
        const labeledMarkers = getGroupedLabeledMarkers(markers);
        const markerWithDisplayLabel = labeledMarkers.find(m => m.id === marker.id);
        const displayLabelText = markerWithDisplayLabel?.displayLabel || marker.label; // Use displayLabel if available, fallback to raw label


        return (
            <div
                key={marker.id} style={anchorPointStyle}
                // Click on the anchor point removes the marker
                onClick={(e) => { e.stopPropagation(); handleRemoveMarker(marker.id); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleRemoveMarker(marker.id); }}}
                role="button" tabIndex={0}
                aria-label={`Remove ${marker.type}${displayLabelText ? ' ' + displayLabelText : ''} at ${marker.x.toFixed(0)}%, ${marker.y.toFixed(0)}%`}
            >
                {marker.type === 'circle' && <div style={circleSymbolStyle}></div>}
                {marker.type === 'cross' && <div style={crossSymbolStyle}>X</div>}

                {/* Conditionally render input or label */}
                {editingMarkerId === marker.id ? (
                     <Form.Control
                        type="text"
                        value={marker.label}
                        onChange={(e) => handleLabelInputChange(marker.id, e.target.value)}
                        onBlur={handleLabelInputBlur}
                        maxLength={9} // Limit input length
                        autoFocus // Automatically focus the input when it appears
                        size="sm"
                        style={{
                            position: 'absolute',
                            top: '50%',
                            transform: marker.labelSide === 'right' ? 'translateY(-50%)' : 'translate(-100%, -50%)', // Position based on side
                            [marker.labelSide]: '12px', // Position based on side
                            width: '80px', // Adjust width as needed
                            fontSize: '10px',
                            padding: '1px 4px',
                            backgroundColor: '#16202c',
                            color: '#eeeeeeb0',
                            borderColor: '#30363d',
                            zIndex: 2, // Ensure input is above other elements
                        }}
                        onClick={e => e.stopPropagation()} // Prevent click on input from closing modal/removing marker
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault(); // Prevent form submission if it were in a form
                                handleLabelInputBlur(); // Treat Enter as blur
                            }
                        }}
                    />
                ) : (
                    marker.label && ( // Only show label element if label exists
                        <span
                            style={labelStyle}
                            onClick={(e) => { e.stopPropagation(); setEditingMarkerId(marker.id); }} // Click label to edit
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
                        {/* Wrapper div for controls */}
                        <div style={{ flexShrink: 0 }}>
                            <div style={markerControlsStyle}>
                                <Button variant={selectedMarkerType === 'circle' ? 'danger' : 'outline-danger'} size="sm" onClick={() => setSelectedMarkerType('circle')}>Circle (O)</Button>
                                <Button variant={selectedMarkerType === 'cross' ? 'primary' : 'outline-primary'} size="sm" onClick={() => setSelectedMarkerType('cross')}>Cross (X)</Button>
                                {/* Always show all label buttons */}
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
                                            onClick={() => handleAddLabelToLastMarker(btn.short)} // Pass only the short code
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
                        </div> {/* End Wrapper div for controls */}

                        <div ref={imageContainerRef} style={imageContainerStyle}>
                            <img ref={imageRef} src={bodySilhouette} alt="Autopsy diagram area" style={bodyImageStyle} onClick={handleImageClick} />
                            {markers.map(marker => renderMarker(marker))} {/* Pass individual marker */}
                        </div>
                        <small style={{ color: '#8b949e', flexShrink: 0 }}>
                            Click diagram to place marker. Click marker to remove. Click label to edit (max 9 chars).
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
