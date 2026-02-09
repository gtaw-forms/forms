import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Form, Button } from 'react-bootstrap';
import * as Sentry from "@sentry/react";
import EMSAMAImage from '../../assets/EMSAMA.png';
import { copyToClipboard } from '../UI/notificationService';

import './EmsAmaModal.css';

const EmsAmaModal = ({ show, onHide, showNotification, commitInfo, handleImageUpload }) => {
    const [patientSignature, setPatientSignature] = useState('');
    const [date, setDate] = useState('');
    const [guardianSignature, setGuardianSignature] = useState('');
    const [paramedicSignature, setParamedicSignature] = useState('');
    const [imageUrl, setImageUrl] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isPreviewVisible, setIsPreviewVisible] = useState(true);

    const patientSignaturePreviewRef = useRef(null);
    const datePreviewRef = useRef(null);
    const guardianSignaturePreviewRef = useRef(null);
    const paramedicSignaturePreviewRef = useRef(null);
    const amaCardPreviewRef = useRef(null);

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
            setImageUrl(null);
        }
    }, [show]);

    const handlePatientSignatureChange = (e) => setPatientSignature(e.target.value);
    const handleDateChange = (e) => setDate(e.target.value);
    const handleGuardianSignatureChange = (e) => setGuardianSignature(e.target.value);
    const handleParamedicSignatureChange = (e) => setParamedicSignature(e.target.value);

    const processWebhookQueue = useCallback(async () => {
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
                Sentry.captureMessage("Discord Webhook Send Failure (AMA)", {
                    extra: { status: response.status, statusText: response.statusText, responseBody: errorData },
                    level: "error"
                });
            } else {
                lastWebhookCallTimestamp.current = Date.now();
            }
        } catch (error) {
            console.error('Error sending Discord webhook (AMA):', error);
            Sentry.captureException(error, { extra: { context: 'Discord Webhook Send Function (AMA)' } });
        } finally {
            isWebhookProcessing.current = false;
            if (webhookQueue.current.length > 0) {
                setTimeout(processWebhookQueue, 0);
            }
        }
    }, []);

    const sendDiscordWebhook = useCallback(async (patientSig, formDate, guardianSig, paramedicSig, generatedImageUrl, errorMessage = null) => {
        const webhookURL = import.meta.env.VITE_DEV_WEBHOOK;
        if (!webhookURL) {
            console.warn('Discord webhook URL is not set for AMA.');
            Sentry.captureMessage("Discord Webhook URL not set (AMA)", { level: "warning" });
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
                errorMessage ? { name: "Error", value: ```${errorMessage.substring(0, 1000)}```, inline: false } : null
            ].filter(field => field !== null),
            footer: {
                text: `PHMC Tools Tool | gh-pages ${commitInfo?.sha?.substring(0, 7) || 'N/A'}`
            },
            timestamp: new Date().toISOString()
        };

        if (generatedImageUrl) {
            embed.image = { url: generatedImageUrl };
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

        const amaImageActualWidth = 1000;
        const amaImageActualHeight = 1414;

        const canvas = document.createElement('canvas');
        canvas.width = amaImageActualWidth;
        canvas.height = amaImageActualHeight;
        const ctx = canvas.getContext('2d');

        const loadImage = (src) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => resolve(img);
                img.onerror = (err) => {
                    console.error("Failed to load base AMA image for canvas:", err);
                    Sentry.captureException(err, { extra: { context: 'AMA loadImage', imgSrc: src } });
                    reject(new Error("Failed to load base AMA image."));
                };
                img.src = src;
            });
        };
        
        try {
            const baseImage = await loadImage(EMSAMAImage);
            
            if (document.fonts && typeof document.fonts.ready === 'function') {
                await document.fonts.ready;
                console.log("Fonts ready for AMA canvas.");
            } else {
                console.warn("document.fonts.ready not available. Text rendering might be inconsistent.");
            }

            ctx.drawImage(baseImage, 0, 0, amaImageActualWidth, amaImageActualHeight);
            ctx.textBaseline = 'top';

            const patientSigX = amaImageActualWidth * (parseFloat(patientSignatureOverlayStyle.left) / 100);
            const patientSigY = amaImageActualHeight * (parseFloat(patientSignatureOverlayStyle.top) / 100);
            const patientSigFontSize = parseInt(patientSignatureOverlayStyle.fontSize);
            ctx.fillStyle = patientSignatureOverlayStyle.color;
            ctx.font = `${patientSigFontSize}px ${patientSignatureOverlayStyle.fontFamily}`
            ctx.fillText(patientSignature, patientSigX, patientSigY);

            const dateX = amaImageActualWidth * (parseFloat(dateOverlayStyle.left) / 100);
            const dateY = amaImageActualHeight * (parseFloat(dateOverlayStyle.top) / 100);
            const dateFontSize = parseInt(dateOverlayStyle.fontSize);
            ctx.fillStyle = dateOverlayStyle.color;
            ctx.font = `${dateFontSize}px ${dateOverlayStyle.fontFamily}`
            ctx.fillText(date, dateX, dateY);

            const guardianSigX = amaImageActualWidth * (parseFloat(guardianSignatureOverlayStyle.left) / 100);
            const guardianSigY = amaImageActualHeight * (parseFloat(guardianSignatureOverlayStyle.top) / 100);
            const guardianSigFontSize = parseInt(guardianSignatureOverlayStyle.fontSize);
            ctx.fillStyle = guardianSignatureOverlayStyle.color;
            ctx.font = `${guardianSigFontSize}px ${guardianSignatureOverlayStyle.fontFamily}`
            ctx.fillText(guardianSignature, guardianSigX, guardianSigY);

            const paramedicSigX = amaImageActualWidth * (parseFloat(paramedicSignatureOverlayStyle.left) / 100);
            const paramedicSigY = amaImageActualHeight * (parseFloat(paramedicSignatureOverlayStyle.top) / 100);
            const paramedicSigFontSize = parseInt(paramedicSignatureOverlayStyle.fontSize);
            ctx.fillStyle = paramedicSignatureOverlayStyle.color;
            ctx.font = `${paramedicSigFontSize}px ${paramedicSignatureOverlayStyle.fontFamily}`
            ctx.fillText(paramedicSignature, paramedicSigX, paramedicSigY);

            const dataUrl = canvas.toDataURL('image/png');

            showNotification('Uploading...', 'upload');
            const result = await handleImageUpload(dataUrl);
            const link = result[0].url;
            setImageUrl(link);
            showNotification(`AMA Form Saved & Uploaded: ${link}`, 'save');
            sendDiscordWebhook(patientSignature, date, guardianSignature, paramedicSignature, link);

            await copyToClipboard(link, showNotification, 'Image link copied to clipboard!');
        } catch (error) {
            console.error('Error in AMA handleSave:', error);
            let errorContext = 'Error generating AMA form';
            let detailedMessage = error.message || String(error);

            if (detailedMessage.includes('upload failed')) errorContext = 'Upload Failed';
            else if (detailedMessage.includes('Failed to load base AMA image')) errorContext = 'Base Image Load Failed';
            else errorContext = 'Image Generation Failed';
            
            showNotification(`${errorContext}: ${detailedMessage.substring(0,100)}...`, 'error');
            Sentry.captureException(error, { extra: { context: 'EMS AMA Save', patientSignature, date, detailedMessage } });
            sendDiscordWebhook(patientSignature, date, guardianSignature, paramedicSignature, null, `${errorContext}: ${detailedMessage}`);
        } finally {
            setIsSaving(false);
        }
    }, [
        patientSignature, date, guardianSignature, paramedicSignature,
        showNotification, handleImageUpload, sendDiscordWebhook, commitInfo,
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
                    {imageUrl && (
                        <div className="imgur-link-container">
                            <p>
                                <strong>Image Link: </strong>
                                <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                                    {imageUrl}
                                </a>
                            </p>
                            Instructions!
                            <br />
                            1) /note [id of the blank note item in your inventory] [amount] [name for the cards]
                            <br />
                            2) /note [id of the new note item in your inventory] [amount] [content] [URL from ImgBB]
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
