import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Form, Button } from 'react-bootstrap';
// import domtoimage from 'dom-to-image'; // No longer needed
import { H } from 'highlight.run';
import EMSAMAImage from '../assets/EMSAMA.png';
import { copyToClipboard } from './notificationService'; // <-- NEW IMPORT

import './EmsAmaModal.css'; // Ensure this CSS defines 'LufgaBold' if used, or use a fallback

const EmsAmaModal = ({ show, onHide, showNotification, commitInfo }) => {
    const [patientSignature, setPatientSignature] = useState('');
    const [date, setDate] = useState('');
    const [guardianSignature, setGuardianSignature] = useState('');
    const [paramedicSignature, setParamedicSignature] = useState('');
    const [imgurLink, setImgurLink] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isPreviewVisible, setIsPreviewVisible] = useState(true); // Keep preview visible by default

    // Refs for the visual preview elements (optional, but good for consistency if styles are complex)
    const patientSignaturePreviewRef = useRef(null);
    const datePreviewRef = useRef(null);
    const guardianSignaturePreviewRef = useRef(null);
    const paramedicSignaturePreviewRef = useRef(null);
    // amaCardRef is for the preview container, not directly used by canvas generation
    const amaCardPreviewRef = useRef(null);


    // Webhook queue logic (remains the same as in your original EmsAmaModal)
    const webhookQueue = useRef([]);
    const isWebhookProcessing = useRef(false);
    const lastWebhookCallTimestamp = useRef(0);
    const webhookRateLimitDelay = 1100;


    useEffect(() => {
        if (show) {
            setPatientSignature(localStorage.getItem('emsAmaPatientSignature') || '');
            setDate(localStorage.getItem('emsAmaDate') || '');
            setGuardianSignature(localStorage.getItem('emsAmaGuardianSignature') || '');
            setParamedicSignature(localStorage.getItem('emsAmaParamedicSignature') || '');
            setImgurLink(null);
            // setIsPreviewVisible(false); // Or true, depending on desired default state
        }
    }, [show]);

    const handlePatientSignatureChange = (e) => setPatientSignature(e.target.value);
    const handleDateChange = (e) => setDate(e.target.value);
    const handleGuardianSignatureChange = (e) => setGuardianSignature(e.target.value);
    const handleParamedicSignatureChange = (e) => setParamedicSignature(e.target.value);

    const uploadToImgur = useCallback(async (base64Image) => {
        // This function remains the same as in your original EmsAmaModal
        const imgurClientId = process.env.REACT_APP_IMGUR_CLIENT_ID;
        const accessToken = process.env.REACT_APP_IMGUR_ACCESS_TOKEN;
        const albumId = process.env.REACT_APP_IMGUR_ALBUM_ID;
        const apiUrl = 'https://api.imgur.com/3/image';

        const formData = new FormData();
        formData.append('image', base64Image.split(',')[1]);
        formData.append('album', albumId);

        const headers = {
            'Authorization': `Client-ID ${imgurClientId}`
        };
        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: formData,
            });
            const data = await response.json();
            if (data.success) {
                return data.data.link;
            } else {
                console.error('Imgur upload failed (AMA):', data);
                H.track("Imgur API Error (AMA)", { payload: data, level: "error" });
                throw new Error(`Imgur upload failed: ${data.data?.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Imgur upload failed (AMA):', error);
            H.consumeError(error, { context: 'Imgur Upload Function (AMA)' });
            throw error;
        }
    }, []);

    const processWebhookQueue = useCallback(async () => {
        // This function remains the same as in your original EmsAmaModal
        if (webhookQueue.current.length === 0 || isWebhookProcessing.current) {
            return;
        }
        isWebhookProcessing.current = true;
        const now = Date.now();
        const timeSinceLastCall = now - lastWebhookCallTimestamp.current;

        if (timeSinceLastCall < webhookRateLimitDelay) {
            const delay = webhookRateLimitDelay - timeSinceLastCall;
            setTimeout(() => {
                isWebhookProcessing.current = false;
                processWebhookQueue();
            }, delay);
            return;
        }

        const { webhookURL, message } = webhookQueue.current.shift();

        try {
            const response = await fetch(webhookURL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(message)
            });
            if (!response.ok) {
                const errorData = await response.text();
                console.error('Failed to send Discord webhook (AMA):', response.status, response.statusText, errorData);
                H.track("Discord Webhook Send Failure (AMA)", {
                    payload: { status: response.status, statusText: response.statusText, responseBody: errorData },
                    level: "error"
                });
            } else {
                lastWebhookCallTimestamp.current = Date.now();
            }
        } catch (error) {
            console.error('Error sending Discord webhook (AMA):', error);
            H.consumeError(error, { context: 'Discord Webhook Send Function (AMA)' });
        } finally {
            isWebhookProcessing.current = false;
            if (webhookQueue.current.length > 0) {
                setTimeout(processWebhookQueue, 0);
            }
        }
    }, []);

    const sendDiscordWebhook = useCallback(async (patientSig, formDate, guardianSig, paramedicSig, generatedImgurLink, errorMessage = null) => {
        // This function remains the same as in your original EmsAmaModal
        const webhookURL = process.env.REACT_APP_DEV_WEBHOOK;
        if (!webhookURL) {
            console.warn('Discord webhook URL is not set for AMA.');
            H.track("Discord Webhook URL not set (AMA)", { level: "warning" });
            return;
        }

        const embed = {
            title: "EMS AMA Form Creation Alert!",
            description: "A new EMS AMA form was generated.",
            color: errorMessage ? 0xFF0000 : 0x00FF00,
            fields: [
                { name: "Patient Signature", value: patientSig || "N/A", inline: true },
                { name: "Date", value: formDate || "N/A", inline: true },
                { name: "Guardian Signature", value: guardianSig || "N/A", inline: true },
                { name: "Paramedic Signature", value: paramedicSig || "N/A", inline: true },
                errorMessage ? { name: "Error", value: `\`\`\`${errorMessage.substring(0, 1000)}\`\`\``, inline: false } : null
            ].filter(field => field !== null),
            footer: {
                text: `PHMC Forms Tool | gh-pages ${commitInfo?.sha?.substring(0, 7) || 'N/A'}`
            },
            timestamp: new Date().toISOString()
        };

        if (generatedImgurLink) {
            embed.image = { url: generatedImgurLink };
        } else if (!errorMessage) {
            embed.fields.push({ name: "Image Status", value: "Image uploaded, but link is missing.", inline: false });
        } else {
            embed.fields.push({ name: "Image Status", value: "Image upload failed.", inline: false });
        }

        const message = { embeds: [embed] };
        webhookQueue.current.push({ webhookURL, message });
        if (!isWebhookProcessing.current) {
            processWebhookQueue();
        }
    }, [commitInfo, processWebhookQueue]);

    // Define overlay styles for canvas drawing and preview
    // Ensure font family matches what's loaded (e.g., 'LufgaBold' from EmsAmaModal.css or a safe fallback)
    const patientSignatureOverlayStyle = {
        position: 'absolute', top: '73%', left: '12%', color: 'black',
        fontSize: '20px', fontFamily: 'LufgaBold, Arial, sans-serif', whiteSpace: 'nowrap'
    };
    const dateOverlayStyle = {
        position: 'absolute', top: '83%', left: '12%', color: 'black',
        fontSize: '20px', fontFamily: 'LufgaBold, Arial, sans-serif', whiteSpace: 'nowrap'
    };
    const guardianSignatureOverlayStyle = {
        position: 'absolute', top: '73%', left: '60%', color: 'black',
        fontSize: '20px', fontFamily: 'LufgaBold, Arial, sans-serif', whiteSpace: 'nowrap'
    };
    const paramedicSignatureOverlayStyle = {
        position: 'absolute', top: '83%', left: '60%', color: 'black',
        fontSize: '20px', fontFamily: 'LufgaBold, Arial, sans-serif', whiteSpace: 'nowrap'
    };


    const handleSave = useCallback(async () => {
        setIsSaving(true);
        showNotification('Processing AMA form...', 'upload');

        localStorage.setItem('emsAmaPatientSignature', patientSignature);
        localStorage.setItem('emsAmaDate', date);
        localStorage.setItem('emsAmaGuardianSignature', guardianSignature);
        localStorage.setItem('emsAmaParamedicSignature', paramedicSignature);

        // Get image natural dimensions (assuming EMSAMAImage is 1000x1414 or similar)
        // For more robustness, load image to get dimensions, like in BusinessCardModal
        const amaImageActualWidth = 1000; // Replace with actual width or dynamic loading
        const amaImageActualHeight = 1414; // Replace with actual height or dynamic loading

        const canvas = document.createElement('canvas');
        canvas.width = amaImageActualWidth;
        canvas.height = amaImageActualHeight;
        const ctx = canvas.getContext('2d');

        const loadImage = (src) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "anonymous"; // Important if image is hosted externally and fonts are webfonts
                img.onload = () => resolve(img);
                img.onerror = (err) => {
                    console.error("Failed to load base AMA image for canvas:", err);
                    H.consumeError(err, { context: 'AMA loadImage', payload: { imgSrc: src } });
                    reject(new Error("Failed to load base AMA image."));
                };
                img.src = src;
            });
        };
        
        try {
            const baseImage = await loadImage(EMSAMAImage);
            
            // Ensure fonts are loaded before drawing text
            if (document.fonts && typeof document.fonts.ready === 'function') {
                await document.fonts.ready;
                console.log("Fonts ready for AMA canvas.");
            } else {
                console.warn("document.fonts.ready not available. Text rendering might be inconsistent.");
            }

            ctx.drawImage(baseImage, 0, 0, amaImageActualWidth, amaImageActualHeight);
            ctx.textBaseline = 'top'; // Consistent text positioning

            // Draw Patient Signature
            const patientSigX = amaImageActualWidth * (parseFloat(patientSignatureOverlayStyle.left) / 100);
            const patientSigY = amaImageActualHeight * (parseFloat(patientSignatureOverlayStyle.top) / 100);
            const patientSigFontSize = parseInt(patientSignatureOverlayStyle.fontSize);
            ctx.fillStyle = patientSignatureOverlayStyle.color;
            ctx.font = `${patientSigFontSize}px ${patientSignatureOverlayStyle.fontFamily}`;
            ctx.fillText(patientSignature, patientSigX, patientSigY);

            // Draw Date
            const dateX = amaImageActualWidth * (parseFloat(dateOverlayStyle.left) / 100);
            const dateY = amaImageActualHeight * (parseFloat(dateOverlayStyle.top) / 100);
            const dateFontSize = parseInt(dateOverlayStyle.fontSize);
            ctx.fillStyle = dateOverlayStyle.color;
            ctx.font = `${dateFontSize}px ${dateOverlayStyle.fontFamily}`;
            ctx.fillText(date, dateX, dateY);

            // Draw Guardian Signature
            const guardianSigX = amaImageActualWidth * (parseFloat(guardianSignatureOverlayStyle.left) / 100);
            const guardianSigY = amaImageActualHeight * (parseFloat(guardianSignatureOverlayStyle.top) / 100);
            const guardianSigFontSize = parseInt(guardianSignatureOverlayStyle.fontSize);
            ctx.fillStyle = guardianSignatureOverlayStyle.color;
            ctx.font = `${guardianSigFontSize}px ${guardianSignatureOverlayStyle.fontFamily}`;
            ctx.fillText(guardianSignature, guardianSigX, guardianSigY);

            // Draw Paramedic Signature
            const paramedicSigX = amaImageActualWidth * (parseFloat(paramedicSignatureOverlayStyle.left) / 100);
            const paramedicSigY = amaImageActualHeight * (parseFloat(paramedicSignatureOverlayStyle.top) / 100);
            const paramedicSigFontSize = parseInt(paramedicSignatureOverlayStyle.fontSize);
            ctx.fillStyle = paramedicSignatureOverlayStyle.color;
            ctx.font = `${paramedicSigFontSize}px ${paramedicSignatureOverlayStyle.fontFamily}`;
            ctx.fillText(paramedicSignature, paramedicSigX, paramedicSigY);

            const dataUrl = canvas.toDataURL('image/png');

            showNotification('Uploading to Imgur...', 'upload');
            const link = await uploadToImgur(dataUrl);
            setImgurLink(link);
            showNotification(`AMA Form Saved & Uploaded: ${link}`, 'save');
            sendDiscordWebhook(patientSignature, date, guardianSignature, paramedicSignature, link);

            await copyToClipboard(link, showNotification, 'Imgur link copied to clipboard!');
        } catch (error) {
            console.error('Error in AMA handleSave:', error);
            let errorContext = 'Error generating AMA form';
            let detailedMessage = error.message || String(error);

            if (detailedMessage.includes('Imgur upload failed')) errorContext = 'Imgur Upload Failed';
            else if (detailedMessage.includes('Failed to load base AMA image')) errorContext = 'Base Image Load Failed';
            else errorContext = 'Image Generation Failed';
            
            showNotification(`${errorContext}: ${detailedMessage.substring(0,100)}...`, 'error');
            H.consumeError(error, { payload: { context: 'EMS AMA Save', patientSignature, date, detailedMessage } });
            sendDiscordWebhook(patientSignature, date, guardianSignature, paramedicSignature, null, `${errorContext}: ${detailedMessage}`);
        } finally {
            setIsSaving(false);
        }
    }, [
        patientSignature, date, guardianSignature, paramedicSignature,
        showNotification, uploadToImgur, sendDiscordWebhook, commitInfo,
        patientSignatureOverlayStyle, dateOverlayStyle, guardianSignatureOverlayStyle, paramedicSignatureOverlayStyle
    ]);


    if (!show) {
        return null;
    }

    return (
        <div className="modal-overlay">
            <div className="agency-selector-modal ems-ama-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h4>EMS - Against Medical Advice (AMA)</h4>
                    <Button
                        variant="secondary"
                        className="close"
                        onClick={onHide}
                        aria-label="Close EMS AMA modal"
                    >
                        <i className="fas fa-times"></i>
                    </Button>
                </div>
                <div className="ems-ama-modal-body">
                    {imgurLink && (
                        <div className="imgur-link-container">
                            <p>
                                <strong>Imgur Link: </strong>
                                <a href={imgurLink} target="_blank" rel="noopener noreferrer">
                                    {imgurLink}
                                </a>
                            </p>
                            Instructions!
                            <br />
                            1) /note [id of the blank note item in your inventory] [amount] [name for the cards]
                            <br />
                            2) /note [id of the new note item in your inventory] [amount] [content] [URL from Imgur]
                        </div>
                    )}

                    <Button
                        variant="outline-info"
                        onClick={() => setIsPreviewVisible(!isPreviewVisible)}
                        className="mb-3 w-100"
                    >
                        {isPreviewVisible ? 'Hide Form Preview' : 'Show Form Preview'}
                    </Button>

                    {isPreviewVisible && (
                        <div 
                            className="business-card-image-container" // Re-use class if styles are similar
                            ref={amaCardPreviewRef} 
                            style={{ 
                                position: 'relative', 
                                width: '100%', 
                                maxWidth: '800px', // Adjust as needed for AMA form aspect ratio
                                margin: '0 auto 1rem auto' 
                            }}
                        >
                            <img
                                src={EMSAMAImage}
                                alt="EMS AMA Form Preview"
                                style={{ display: 'block', width: '100%', height: 'auto', border: '1px solid #ccc' }}
                            />
                            <div
                                ref={patientSignaturePreviewRef}
                                style={patientSignatureOverlayStyle} // Use defined style object
                            >
                                {patientSignature}
                            </div>
                            <div
                                ref={datePreviewRef}
                                style={dateOverlayStyle} // Use defined style object
                            >
                                {date}
                            </div>
                            <div
                                ref={guardianSignaturePreviewRef}
                                style={guardianSignatureOverlayStyle} // Use defined style object
                            >
                                {guardianSignature}
                            </div>
                            <div
                                ref={paramedicSignaturePreviewRef}
                                style={paramedicSignatureOverlayStyle} // Use defined style object
                            >
                                {paramedicSignature}
                            </div>
                        </div>
                    )}

                    <div className="business-card-input-fields"> {/* Re-use class if styles are similar */}
                        <Form.Group className="mb-2 ems-ama-input-group">
                            <Form.Label>Patient Signature (Type Name)</Form.Label>
                            <Form.Control size="sm" type="text" placeholder="Enter patient's full name" value={patientSignature} onChange={handlePatientSignatureChange} />
                        </Form.Group>
                        <Form.Group className="mb-2 ems-ama-input-group">
                            <Form.Label>Date</Form.Label>
                            <Form.Control size="sm" type="text" placeholder="e.g., MM/DD/YYYY" value={date} onChange={handleDateChange} />
                        </Form.Group>
                        <Form.Group className="mb-2 ems-ama-input-group">
                            <Form.Label>Guardian Signature (Type Name, If Applicable)</Form.Label>
                            <Form.Control size="sm" type="text" placeholder="Enter guardian's full name" value={guardianSignature} onChange={handleGuardianSignatureChange} />
                        </Form.Group>
                        <Form.Group className="mb-2 ems-ama-input-group">
                            <Form.Label>Paramedic Signature (Type Name)</Form.Label>
                            <Form.Control size="sm" type="text" placeholder="Enter your full name" value={paramedicSignature} onChange={handleParamedicSignatureChange} />
                        </Form.Group>
                    </div>
                </div>
                <Button className="ems-ama-save-button" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save & Upload AMA Form'}
                </Button>
            </div>
        </div>
    );
};

export default EmsAmaModal;
