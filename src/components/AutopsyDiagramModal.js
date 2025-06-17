// src/components/AutopsyDiagramModal.js
import React, { useState, useRef, useEffect } from 'react';
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
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
    // REMOVED: const [showMoreLabelButtons, setShowMoreLabelButtons] = useState(false);
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
            setMarkers(initialMarkers.map(marker => ({
                ...marker,
                label: marker.label || '',
                labelSide: marker.labelSide || 'right'
            })));
            // REMOVED: setShowMoreLabelButtons(false);
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
                label: '',
                labelSide: 'right',
            };
            setMarkers(prevMarkers => [...prevMarkers, newMarker]);
        }
    };

    const handleToggleLastMarkerLabelSide = () => {
        setMarkers(prevMarkers => {
            if (prevMarkers.length === 0) return prevMarkers;
            let lastLabeledMarkerIndex = -1;
            for (let i = prevMarkers.length - 1; i >= 0; i--) {
                if (prevMarkers[i].label && prevMarkers[i].label.trim() !== '') {
                    lastLabeledMarkerIndex = i;
                    break;
                }
            }
            if (lastLabeledMarkerIndex === -1) {
                 if (showNotification) showNotification("No labeled marker to toggle side for. Add a label first.", "info");
                return prevMarkers;
            }
            return prevMarkers.map((marker, index) => {
                if (index === lastLabeledMarkerIndex) {
                    return { ...marker, labelSide: marker.labelSide === 'right' ? 'left' : 'right' };
                }
                return marker;
            });
        });
    };

    const drawDiagramOnCanvas = async () => {
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

        const markersToDraw = [];
        let labelPrefixCounter = 0;
        markers.forEach(m => {
            if (m.label && m.label.trim() !== '') {
                markersToDraw.push({
                    ...m,
                    displayLabel: `${String.fromCharCode(65 + labelPrefixCounter++)}-${m.label}`
                });
            } else {
                markersToDraw.push(m);
            }
        });


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

            const labelToDraw = marker.displayLabel || marker.label;

            if (labelToDraw) {
                const labelFontSize = 20;
                ctx.font = `${labelFontSize}px Arial`;
                const textMetrics = ctx.measureText(labelToDraw);
                const textWidth = textMetrics.width;
                const textHeight = labelFontSize;
                const padding = 4;
                const labelBgWidth = textWidth + (padding * 2);
                const labelBgHeight = textHeight + (padding * 2);
                const labelTextY = canvasDrawY;
                const labelBgY = canvasDrawY - (textHeight / 2) - padding;

                let labelBgX, labelTextX;
                if (marker.labelSide === 'right') {
                    labelTextX = canvasDrawX + 18;
                    labelBgX = labelTextX - padding;
                    ctx.textAlign = 'left';
                } else {
                    labelTextX = canvasDrawX - 18;
                    labelBgX = labelTextX - textWidth - padding;
                    ctx.textAlign = 'right';
                }

                ctx.fillStyle = 'rgba(50, 50, 50, 0.7)';
                ctx.fillRect(labelBgX, labelBgY, labelBgWidth, labelBgHeight);

                ctx.fillStyle = '#FFFFFF';
                ctx.textBaseline = 'middle';
                ctx.fillText(labelToDraw, labelTextX, labelTextY);
            }
        });
        return canvas;
    };

    const renderMarker = (marker, index, allMarkers) => {
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
            pointerEvents: 'none', zIndex: 1,
        };

        if (marker.labelSide === 'right') {
            labelStyle.left = '12px';
        } else {
            labelStyle.right = '12px';
        }

        let displayLabelText = marker.label;
        if (marker.label && marker.label.trim() !== '') {
            let labeledMarkerIndex = -1;
            let count = 0;
            for (let i = 0; i < allMarkers.length; i++) {
                if (allMarkers[i].label && allMarkers[i].label.trim() !== '') {
                    if (allMarkers[i].id === marker.id) {
                        labeledMarkerIndex = count;
                        break;
                    }
                    count++;
                }
            }
            if (labeledMarkerIndex !== -1) {
                const prefix = String.fromCharCode(65 + labeledMarkerIndex);
                displayLabelText = `${prefix}-${marker.label}`;
            }
        }

        return (
            <div
                key={marker.id} style={anchorPointStyle}
                onClick={(e) => { e.stopPropagation(); handleRemoveMarker(marker.id); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleRemoveMarker(marker.id); }}}
                role="button" tabIndex={0}
                aria-label={`Remove ${marker.type}${displayLabelText ? ' ' + displayLabelText : ''} at ${marker.x.toFixed(0)}%, ${marker.y.toFixed(0)}%`}
            >
                {marker.type === 'circle' && <div style={circleSymbolStyle}></div>}
                {marker.type === 'cross' && <div style={crossSymbolStyle}>X</div>}
                {marker.label && <span style={labelStyle}>{displayLabelText}</span>}
            </div>
        );
    };

    const handleCopyToClipboard = async () => {
        setIsProcessingImage(true);
        const canvas = await drawDiagramOnCanvas();
        if (canvas && navigator.clipboard && navigator.clipboard.write) {
            canvas.toBlob(async (blob) => {
                if (blob) {
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ [blob.type]: blob })
                        ]);
                        if (showNotification) showNotification('Diagram copied to clipboard!', 'success');
                    } catch (err) {
                        if (showNotification) showNotification('Failed to copy diagram. See console for details.', 'error');
                    }
                } else {
                    if (showNotification) showNotification('Failed to create image blob for clipboard.', 'error');
                }
                setIsProcessingImage(false);
            }, 'image/png');
        } else {
            if (showNotification) showNotification('Clipboard API not available or canvas drawing failed.', 'error');
            setIsProcessingImage(false);
        }
    };

    const handleUploadToImgur = async () => {
        if (!IMGUR_CLIENT_ID) {
            if (showNotification) showNotification('Imgur Client ID is not configured.', 'error');
            return;
        }
        setIsProcessingImage(true);
        const canvas = await drawDiagramOnCanvas();
        if (!canvas) {
            if (showNotification) showNotification('Failed to draw diagram on canvas.', 'error');
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
                if (showNotification) showNotification(`Uploaded to Imgur! Link: ${result.data.link}`, 'success');
                if (onDiagramImgurUpload) onDiagramImgurUpload(result.data.link);
            } else {
                const errorMessage = result.data.error?.message || result.data.error || 'Unknown error';
                if (showNotification) showNotification(`Imgur Upload Failed: ${errorMessage}`, 'error');
            }
        } catch (error) {
            if (showNotification) showNotification('Error during Imgur upload. See console.', 'error');
        }
        setIsProcessingImage(false);
    };
    const handleAddLabelToLastMarker = (labelText) => {
        setMarkers(prevMarkers => {
            if (prevMarkers.length === 0) return prevMarkers;
            const lastMarkerIndex = prevMarkers.length - 1;
            return prevMarkers.map((marker, index) =>
                index === lastMarkerIndex ? { ...marker, label: labelText } : marker
            );
        });
    };
    const handleRemoveMarker = (markerIdToRemove) => {
        setMarkers(prevMarkers => prevMarkers.filter(marker => marker.id !== markerIdToRemove));
    };
    const handleUndoLastMarker = () => {
        if (markers.length > 0) {
            setMarkers(prev => prev.slice(0, -1));
        }
    };
    const handleClearAllMarkers = () => {
        if (markers.length > 0) {
            setMarkers([]);
        }
    };
    const handleSave = () => {
        if (onSaveDiagram) {
            onSaveDiagram(markers);
        }
        onHide();
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
                                <Button variant="outline-light" size="sm" onClick={() => handleAddLabelToLastMarker('(GSW)')} disabled={markers.length === 0} style={{fontSize: '0.75rem'}}>GSW</Button>
                                <Button variant="outline-light" size="sm" onClick={() => handleAddLabelToLastMarker('(STAB)')} disabled={markers.length === 0} style={{fontSize: '0.75rem'}}>STAB</Button>
                                <Button variant="outline-light" size="sm" onClick={() => handleAddLabelToLastMarker('(UNK)')} disabled={markers.length === 0} style={{fontSize: '0.75rem'}}>UNK</Button>
                                <Button variant="outline-light" size="sm" onClick={() => handleAddLabelToLastMarker('(TRAUMA)')} disabled={markers.length === 0} style={{fontSize: '0.75rem'}}>TRAUMA</Button>
                                {moreLabelButtons.map(btn => (
                                    <OverlayTrigger
                                        key={btn.short}
                                        placement="top"
                                        overlay={<Tooltip id={`tooltip-${btn.short}`}>{btn.full}</Tooltip>}
                                    >
                                        <Button
                                            variant="outline-light"
                                            size="sm"
                                            onClick={() => handleAddLabelToLastMarker(`(${btn.short})`)}
                                            disabled={markers.length === 0}
                                            style={{ fontSize: '0.75rem' }}
                                        >
                                            {btn.short}
                                        </Button>
                                    </OverlayTrigger>
                                ))}
                                {/* REMOVED: Show More Types button */}
                                <Button variant="outline-secondary" size="sm" onClick={handleToggleLastMarkerLabelSide} disabled={isToggleLabelSideDisabled} title="Toggle Last Label's Side">
                                    <i className={`fas fa-exchange-alt`}></i> Toggle Label
                                </Button>
                                <Button variant="outline-secondary" size="sm" onClick={handleUndoLastMarker} disabled={markers.length === 0}>Undo</Button>
                                <Button variant="outline-warning" size="sm" onClick={handleClearAllMarkers} disabled={markers.length === 0}>Clear All</Button>
                            </div>
                            {/* REMOVED: Conditional rendering div for more buttons */}
                        </div> {/* End Wrapper div for controls */}

                        <div ref={imageContainerRef} style={imageContainerStyle}>
                            <img ref={imageRef} src={bodySilhouette} alt="Autopsy diagram area" style={bodyImageStyle} onClick={handleImageClick} />
                            {markers.map((marker, index) => renderMarker(marker, index, markers))}
                        </div>
                        <small style={{ color: '#8b949e', flexShrink: 0 }}>
                            Click diagram to place marker. Click marker to remove. Add label to last placed marker.
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
