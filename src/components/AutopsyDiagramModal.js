// src/components/AutopsyDiagramModal.js
import React, { useState, useRef, useEffect } from 'react';
import { Button } from 'react-bootstrap';
// Placeholder for a human body silhouette or diagram
import bodySilhouette from '../assets/body-silhouette.jpg'; // Ensure you have this image

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
const bodyImageStyle = {
    maxWidth: '100%',
    maxHeight: '100%',
    display: 'block',
    userSelect: 'none',
    objectFit: 'contain',
};
const markerControlsStyle = {
    marginBottom: '15px',
    display: 'flex',
    flexWrap: 'wrap', // Allow buttons to wrap if space is tight
    gap: '10px',
    justifyContent: 'center',
    alignItems: 'center', // Align items vertically
    flexShrink: 0,
};
const modalFooterStyle = {
    borderTop: '1px solid #30363d', paddingTop: '15px', marginTop: 'auto',
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    flexShrink: 0,
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

const AutopsyDiagramModal = ({ show, onHide, onSaveDiagram, initialMarkers = [] }) => {
    const [markers, setMarkers] = useState([]);
    const [selectedMarkerType, setSelectedMarkerType] = useState('circle');
    const imageRef = useRef(null);
    const imageContainerRef = useRef(null);
    const prevShowRef = useRef(show);
    const canvasRef = useRef(null);
    const [bodyImage, setBodyImage] = useState(null);
    const [isProcessingImage, setIsProcessingImage] = useState(false);

    // Environment variable for Imgur Client ID
    const IMGUR_CLIENT_ID = process.env.REACT_APP_IMGUR_CLIENT_ID;

    useEffect(() => {
        loadImage(bodySilhouette) 
            .then(img => setBodyImage(img))
            .catch(err => console.error("Failed to load body silhouette:", err));
    }, []);

    useEffect(() => {
        if (show && !prevShowRef.current) {
            setMarkers(initialMarkers.map(marker => ({ ...marker, label: marker.label || '' })));
        }
        prevShowRef.current = show;
    }, [show, initialMarkers]);

    const drawDiagramOnCanvas = async () => {
        if (!canvasRef.current || !bodyImage) {
            console.error("Canvas or body image not ready for drawing.");
            return null;
        }
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = bodyImage.naturalWidth;
        canvas.height = bodyImage.naturalHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bodyImage, 0, 0, canvas.width, canvas.height);

        markers.forEach(marker => {
            const xPx = (marker.x / 100) * canvas.width;
            const yPx = (marker.y / 100) * canvas.height;
            if (marker.type === 'circle') {
                ctx.beginPath();
                ctx.arc(xPx, yPx, 7.5, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
                ctx.fill();
                ctx.strokeStyle = 'darkred';
                ctx.lineWidth = 1;
                ctx.stroke();
            } else if (marker.type === 'cross') {
                ctx.beginPath();
                ctx.strokeStyle = 'blue';
                ctx.lineWidth = 2;
                const crossSize = 10;
                ctx.moveTo(xPx - crossSize, yPx - crossSize);
                ctx.lineTo(xPx + crossSize, yPx + crossSize);
                ctx.moveTo(xPx + crossSize, yPx - crossSize);
                ctx.lineTo(xPx - crossSize, yPx + crossSize);
                ctx.stroke();
            }
            if (marker.label) {
                ctx.font = '12px Arial';
                ctx.fillStyle = '#000000';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(marker.label, xPx + 15, yPx);
            }
        });
        return canvas;
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
                        console.log('[DEBUG] Diagram copied to clipboard!');
                        alert('Diagram copied to clipboard!');
                    } catch (err) {
                        console.error('[DEBUG] Failed to copy diagram to clipboard:', err);
                        alert('Failed to copy diagram. See console for details.');
                    }
                } else {
                    alert('Failed to create image blob for clipboard.');
                }
                setIsProcessingImage(false);
            }, 'image/png');
        } else {
            alert('Clipboard API not available or canvas drawing failed.');
            setIsProcessingImage(false);
        }
    };

    const handleUploadToImgur = async () => {
        if (!IMGUR_CLIENT_ID) {
            alert('Imgur Client ID is not configured. Please check environment variables.');
            console.error('[DEBUG] Imgur Client ID (REACT_APP_IMGUR_CLIENT_ID) is missing.');
            return;
        }

        setIsProcessingImage(true);
        const canvas = await drawDiagramOnCanvas();
        if (!canvas) {
            alert('Failed to draw diagram on canvas.');
            setIsProcessingImage(false);
            return;
        }

        // Imgur API expects image as base64, file, or URL.
        // For client-side, sending the raw blob is often preferred if the API supports it,
        // or base64 encoded string. toDataURL gives base64.
        const dataUrl = canvas.toDataURL('image/png');
        const base64Image = dataUrl.split(',')[1]; // Get base64 part

        try {
            const formData = new FormData();
            formData.append('image', base64Image);
            // formData.append('type', 'base64'); // 'type' is often inferred or not needed when sending base64 directly

            const response = await fetch('https://api.imgur.com/3/image', {
                method: 'POST',
                headers: {
                    // Use Client-ID for authorization for anonymous/application uploads
                    Authorization: `Client-ID ${IMGUR_CLIENT_ID}`,
                    // 'Accept': 'application/json', // Good practice
                },
                body: formData,
            });

            const result = await response.json();

            if (result.success) {
                console.log('[DEBUG] Imgur Upload Successful:', result.data.link);
                alert(`Uploaded to Imgur! Link: ${result.data.link}`);
                // Optionally, you could pass this link back via onSaveDiagram or another callback
                // For example: if (onSaveDiagram) onSaveDiagram(markers, result.data.link);
            } else {
                console.error('[DEBUG] Imgur Upload Failed:', result.data.error || result.status, result);
                alert(`Imgur Upload Failed: ${result.data.error?.message || result.data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('[DEBUG] Error uploading to Imgur:', error);
            alert('Error during Imgur upload. See console.');
        }
        setIsProcessingImage(false);
    };

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
            };
            setMarkers(prevMarkers => [...prevMarkers, newMarker]);
        }
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

    const renderMarker = (marker) => {
        const markerContainerStyle = {
            position: 'absolute',
            left: `${marker.x}%`,
            top: `${marker.y}%`,
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            zIndex: 10,
        };
        const mainMarkerVisualSyle = marker.type === 'circle' ? {
            width: '15px', height: '15px', backgroundColor: 'rgba(255, 0, 0, 0.7)',
            borderRadius: '50%', border: '1px solid darkred',
        } : {
            color: 'blue', fontSize: '20px', fontWeight: 'bold', lineHeight: '1',
        };
        const labelTextStyle = {
            marginLeft: '4px', fontSize: '10px', color: '#f0f0f0',
            backgroundColor: 'rgba(0,0,0,0.5)', padding: '1px 3px',
            borderRadius: '3px', whiteSpace: 'nowrap', pointerEvents: 'none',
        };
        return (
            <div key={marker.id} style={markerContainerStyle}
                onClick={(e) => { e.stopPropagation(); handleRemoveMarker(marker.id); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleRemoveMarker(marker.id); }}}
                role="button" tabIndex={0}
                aria-label={`Remove ${marker.type}${marker.label ? ' ' + marker.label : ''} at ${marker.x.toFixed(0)}%, ${marker.y.toFixed(0)}%`}
            >
                <div style={mainMarkerVisualSyle}>{marker.type === 'cross' ? 'X' : null}</div>
                {marker.label && <span style={labelTextStyle}>{marker.label}</span>}
            </div>
        );
    };

    if (!show) return null;

    return (
        <div style={modalOverlayStyle} onClick={onHide}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                <div style={modalHeaderStyle}>
                    <h5 style={modalTitleStyle}>Autopsy Diagram (TESTING) </h5>
                    <button onClick={onHide} style={modalCloseButtonStyle} aria-label="Close modal">&times;</button>
                </div>

                <div style={modalBodyStyle}>
                    <div style={markerControlsStyle}>
                        <Button
                            variant={selectedMarkerType === 'circle' ? 'danger' : 'outline-danger'}
                            size="sm"
                            onClick={() => setSelectedMarkerType('circle')}
                        >
                            Circle (O)
                        </Button>
                        <Button
                            variant={selectedMarkerType === 'cross' ? 'primary' : 'outline-primary'}
                            size="sm"
                            onClick={() => setSelectedMarkerType('cross')}
                        >
                            Cross (X)
                        </Button>
                        {/* Label Buttons */}
                        <Button variant="outline-light" size="sm" onClick={() => handleAddLabelToLastMarker('(GSW)')} disabled={markers.length === 0} style={{fontSize: '0.75rem'}}>GSW</Button>
                        <Button variant="outline-light" size="sm" onClick={() => handleAddLabelToLastMarker('(STAB)')} disabled={markers.length === 0} style={{fontSize: '0.75rem'}}>STAB</Button>
                        <Button variant="outline-light" size="sm" onClick={() => handleAddLabelToLastMarker('(UNK)')} disabled={markers.length === 0} style={{fontSize: '0.75rem'}}>UNK</Button>
                        <Button variant="outline-light" size="sm" onClick={() => handleAddLabelToLastMarker('(TRAUMA)')} disabled={markers.length === 0} style={{fontSize: '0.75rem'}}>TRAUMA</Button>

                        <Button variant="outline-secondary" size="sm" onClick={handleUndoLastMarker} disabled={markers.length === 0}>Undo</Button>
                        <Button variant="outline-warning" size="sm" onClick={handleClearAllMarkers} disabled={markers.length === 0}>Clear All</Button>
                    </div>

                    <div ref={imageContainerRef} style={imageContainerStyle}>
                        <img
                            ref={imageRef}
                            src={bodySilhouette} // Changed from bodySilhouettePath
                            alt="Autopsy diagram area"
                            style={bodyImageStyle}
                            onClick={handleImageClick}
                        />
                        {markers.map(marker => renderMarker(marker))}
                    </div>
                    <small style={{ color: '#8b949e', flexShrink: 0 }}>
                        Click diagram to place marker. Click marker to remove. Add label to last placed marker.
                    </small>
                </div>

                <div style={modalFooterStyle}>
                        <Button
                            variant="outline-info"
                            size="sm"
                            onClick={handleCopyToClipboard}
                            disabled={isProcessingImage || !bodyImage || !canvasRef.current} // Added !canvasRef.current
                        >
                            {isProcessingImage ? 'Processing...' : 'Copy Diagram'}
                        </Button>
                        <Button
                            variant="outline-success"
                            size="sm"
                            onClick={handleUploadToImgur}
                            disabled={isProcessingImage || !bodyImage || !canvasRef.current || !IMGUR_CLIENT_ID} // Added !canvasRef.current
                            style={{marginLeft: '10px'}}
                        >
                            {isProcessingImage ? 'Processing...' : 'Upload to Imgur'}
                        </Button>
                    <Button variant="secondary" onClick={onHide} disabled={isProcessingImage}>Cancel</Button>
                    <Button variant="primary" onClick={handleSave} disabled={isProcessingImage}>Done & Save Diagram</Button>
                </div>
            </div>
        </div>
    );
};

export default AutopsyDiagramModal;
