import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Form, Button } from 'react-bootstrap';
import domtoimage from 'dom-to-image';
import * as Sentry from "@sentry/react";
import EMSAMAImage from '../assets/EMSAMA.png';

import './EmsAmaModal.css';

const EmsAmaModal = ({ show, onHide, showNotification, commitInfo }) => {
    const [patientSignature, setPatientSignature] = useState('');
    const [date, setDate] = useState('');
    const [guardianSignature, setGuardianSignature] = useState('');
    const [paramedicSignature, setParamedicSignature] = useState('');
    const [imgurLink, setImgurLink] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);

    const amaCardRef = useRef(null);
    const patientSignatureRef = useRef(null);
    const dateRef = useRef(null);
    const guardianSignatureRef = useRef(null);
    const paramedicSignatureRef = useRef(null);

    useEffect(() => {
        if (show) {
            setPatientSignature(localStorage.getItem('emsAmaPatientSignature') || '');
            setDate(localStorage.getItem('emsAmaDate') || '');
            setGuardianSignature(localStorage.getItem('emsAmaGuardianSignature') || '');
            setParamedicSignature(localStorage.getItem('emsAmaParamedicSignature') || '');
            setImgurLink(null);
            setIsPreviewVisible(false);
        }
    }, [show]);

    const handlePatientSignatureChange = (e) => setPatientSignature(e.target.value);
    const handleDateChange = (e) => setDate(e.target.value);
    const handleGuardianSignatureChange = (e) => setGuardianSignature(e.target.value);
    const handleParamedicSignatureChange = (e) => setParamedicSignature(e.target.value);

    const uploadToImgur = useCallback(async (base64Image) => {
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
                console.error('Imgur upload failed:', data);
                Sentry.captureMessage("Imgur API Error", { extra: data, level: "error" });
                throw new Error(`Imgur upload failed: ${data.data?.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Imgur upload failed:', error);
            Sentry.captureException(error, { extra: { context: 'Imgur Upload Function' } });
            throw error;
        }
    }, []);

    const webhookQueue = useRef([]);
    const isWebhookProcessing = useRef(false);
    const lastWebhookCallTimestamp = useRef(0);
    const webhookRateLimitDelay = 1100;

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
                console.error('Failed to send Discord webhook:', response.status, response.statusText, errorData);
                Sentry.captureMessage("Discord Webhook Send Failure", {
                    extra: { status: response.status, statusText: response.statusText, responseBody: errorData },
                    level: "error"
                });
            } else {
                lastWebhookCallTimestamp.current = Date.now();
            }
        } catch (error) {
            console.error('Error sending Discord webhook:', error);
            Sentry.captureException(error, { extra: { context: 'Discord Webhook Send Function' } });
        } finally {
            isWebhookProcessing.current = false;
            if (webhookQueue.current.length > 0) {
                setTimeout(processWebhookQueue, 0);
            }
        }
    }, []);

    const sendDiscordWebhook = useCallback(async (patientSig, formDate, guardianSig, paramedicSig, generatedImgurLink, errorMessage = null) => {
        const webhookURL = process.env.REACT_APP_DISCORD_WEBHOOK_URL;
        if (!webhookURL) {
            console.warn('Discord webhook URL is not set in environment variables.');
            Sentry.captureMessage("Discord Webhook URL not set", { level: "warning" });
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

    const handleSave = useCallback(async () => {
        setIsSaving(true); // Set saving state immediately

        let currentAmaCardRef = amaCardRef.current;

        // If preview is not visible, show it and wait for DOM update
        if (!isPreviewVisible) {
            setIsPreviewVisible(true);
            // Wait for the next render cycle for amaCardRef to be available
            // This ensures the DOM element is present for domtoimage
            await new Promise(resolve => setTimeout(resolve, 50)); // Adjust delay if necessary
            currentAmaCardRef = amaCardRef.current; // Re-fetch the ref after state update and delay
        }

        if (!currentAmaCardRef) {
            showNotification("Form preview could not be loaded. Please try again.", 'error');
            Sentry.captureMessage("amaCardRef.current is null in handleSave even after attempting to show preview.", {
                extra: { isPreviewVisibleState: isPreviewVisible }, // Log the state at this point
                level: "error"
            });
            setIsSaving(false); // Reset saving state on early exit
            return;
        }
        
        showNotification('Processing AMA form...', 'upload');

        localStorage.setItem('emsAmaPatientSignature', patientSignature);
        localStorage.setItem('emsAmaDate', date);
        localStorage.setItem('emsAmaGuardianSignature', guardianSignature);
        localStorage.setItem('emsAmaParamedicSignature', paramedicSignature);

        try {
            const dataUrl = await domtoimage.toPng(currentAmaCardRef, {
                // quality: 0.95,
                // bgcolor: '#ffffff'
            });
            showNotification('Uploading to Imgur...', 'upload');
            const link = await uploadToImgur(dataUrl);
            setImgurLink(link);
            showNotification(`AMA Form Saved & Uploaded: ${link}`, 'save');
            sendDiscordWebhook(patientSignature, date, guardianSignature, paramedicSignature, link);

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(link)
                    .then(() => {
                        showNotification('Imgur link copied to clipboard!', 'clipboard');
                    })
                    .catch(err => {
                        console.error('Failed to copy Imgur link to clipboard:', err);
                        Sentry.captureException(err, {
                            extra: {
                                message: 'Clipboard writeText failed for AMA form.',
                                imgurLink: link,
                                userAgent: navigator.userAgent,
                            }
                        });
                        let userMessage = 'Failed to copy Imgur link automatically.';
                        if (err.name === 'NotAllowedError') userMessage += ' Please grant clipboard permission.';
                        else if (err.message.includes('focused')) userMessage += ' Please ensure this window is focused.';
                        else userMessage += ' Please copy the link manually.';
                        showNotification(userMessage, 'error');
                    });
            } else {
                const clipboardWarning = 'Clipboard API not available for AMA form.';
                console.warn(clipboardWarning);
                Sentry.captureMessage(clipboardWarning, { level: 'warning' });
                showNotification('Clipboard API not available. Please copy the link manually.', 'warning');
            }
        } catch (error) {
            console.error('Error in AMA handleSave:', error);
            let errorContext = 'Error generating AMA form';
            let detailedMessage = error.message || String(error);

            if (detailedMessage.includes('Imgur upload failed')) errorContext = 'Imgur Upload Failed';
            else if (error.name === 'Error' && domtoimage && !domtoimage.toPng) errorContext = 'Image Conversion Library Error';
            else if (error.name === 'Error') errorContext = 'Image Conversion Failed';

            showNotification(`${errorContext}: ${detailedMessage.substring(0,100)}...`, 'error');
            Sentry.captureException(error, { extra: { context: 'EMS AMA Save', patientSignature, date } });
            sendDiscordWebhook(patientSignature, date, guardianSignature, paramedicSignature, null, `${errorContext}: ${detailedMessage}`);
        } finally {
            setIsSaving(false);
        }
    }, [
        patientSignature, date, guardianSignature, paramedicSignature, 
        showNotification, uploadToImgur, sendDiscordWebhook, commitInfo,
        isPreviewVisible, setIsPreviewVisible // Added dependencies
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
                        <div className="business-card-image-container" ref={amaCardRef} style={{ position: 'relative', width: '100%', maxWidth: '800px', margin: '0 auto 1rem auto' }}>
                            <img
                                src={EMSAMAImage}
                                alt="EMS AMA Form Preview"
                                style={{ display: 'block', width: '100%', height: 'auto', border: '1px solid #ccc' }}
                            />
                            <div
                                className="patient-signature-overlay"
                                ref={patientSignatureRef}
                                style={{
                                    position: 'absolute', top: '73%', left: '12%', color: 'black',
                                    fontSize: '20px', pointerEvents: 'none', cursor: 'default', whiteSpace: 'nowrap'
                                }}
                            >
                                {patientSignature}
                            </div>
                            <div
                                className="date-overlay"
                                ref={dateRef}
                                style={{
                                    position: 'absolute', top: '83%', left: '12%', color: 'black',
                                    fontSize: '20px', cursor: 'default', pointerEvents: 'none', whiteSpace: 'nowrap'
                                }}
                            >
                                {date}
                            </div>
                            <div
                                className="guardian-signature-overlay"
                                ref={guardianSignatureRef}
                                style={{
                                    position: 'absolute', top: '73%', left: '60%', color: 'black',
                                    fontSize: '20px', cursor: 'default', pointerEvents: 'none', whiteSpace: 'nowrap'
                                }}
                            >
                                {guardianSignature}
                            </div>
                            <div
                                className="paramedic-signature-overlay"
                                ref={paramedicSignatureRef}
                                style={{
                                    position: 'absolute', top: '83%', left: '60%', color: 'black',
                                    fontSize: '20px', cursor: 'default', pointerEvents: 'none', whiteSpace: 'nowrap'
                                }}
                            >
                                {paramedicSignature}
                            </div>
                        </div>
                    )}

                    <div className="business-card-input-fields">
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
                {/* Hint text removed */}
                <Button className="ems-ama-save-button" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save & Upload AMA Form'}
                </Button>
            </div>
        </div>
    );
};

export default EmsAmaModal;
