import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Form, Button } from 'react-bootstrap';
// import domtoimage from 'dom-to-image'; // No longer needed for image generation
import * as Sentry from "@sentry/react";
import BusinessCardImage from '../assets/business-card.png';
import { copyToClipboard } from './notificationService'; // <-- NEW IMPORT

const BusinessCardModal = ({ show, onHide, showNotification, commitInfo }) => {
    const [name, setName] = useState('');
    const [rank, setRank] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [imgurLink, setImgurLink] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Refs for input fields or visual preview elements if needed, but not for image generation source
    const nameRef = useRef(null);
    const rankRef = useRef(null);
    const departmentRef = useRef(null); // For phone number overlay

    // Webhook queue logic (remains the same)
    const webhookQueue = useRef([]);
    const isWebhookProcessing = useRef(false);
    const lastWebhookCallTimestamp = useRef(0);
    const webhookRateLimitDelay = 1100;

    useEffect(() => {
        if (show) {
            setName(localStorage.getItem('name') || '');
            setRank(localStorage.getItem('rank') || '');
            setPhoneNumber(localStorage.getItem('phoneNumber') || '');
            setImgurLink(null);
        }
    }, [show]);

    const handleNameChange = (e) => setName(e.target.value);
    const handleRankChange = (e) => setRank(e.target.value);
    const handlePhoneNumberChange = (e) => setPhoneNumber(e.target.value);

    const uploadToImgur = useCallback(async (base64Image) => {
        // This function remains the same
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
                Sentry.captureMessage("Imgur API Error (Business Card)", { extra: data, level: "error" });
                throw new Error(`Imgur upload failed: ${data.data?.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Imgur upload failed:', error);
            Sentry.captureException(error, { extra: { context: 'Imgur Upload Function (Business Card)' } });
            throw error;
        }
    }, []);

    const processWebhookQueue = useCallback(async () => {
        // This function remains the same
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
                console.error('Failed to send Discord webhook (Business Card):', response.status, response.statusText, errorData);
                Sentry.captureMessage("Discord Webhook Send Failure (Business Card)", {
                    extra: { status: response.status, statusText: response.statusText, responseBody: errorData },
                    level: "error"
                });
            } else {
                lastWebhookCallTimestamp.current = Date.now();
            }
        } catch (error) {
            console.error('Error sending Discord webhook (Business Card):', error);
            Sentry.captureException(error, { extra: { context: 'Discord Webhook Send Function (Business Card)' } });
        } finally {
            isWebhookProcessing.current = false;
            if (webhookQueue.current.length > 0) {
                setTimeout(processWebhookQueue, 0);
            }
        }
    }, []);

    const sendDiscordWebhook = useCallback(async (cardName, cardRank, cardPhoneNumber, generatedImgurLink, debugDetails, errorMessage = null) => {
        const webhookURL = process.env.REACT_APP_DEV_WEBHOOK;
        if (!webhookURL) {
            console.warn('Discord webhook URL is not set in environment variables.');
            Sentry.captureMessage("Discord Webhook URL not set (Business Card)", { level: "warning" });
            return;
        }

        const {
            screenResolution = 'N/A',
            windowSize = 'N/A',
            userAgent = 'N/A',
            devicePixelRatio = 'N/A',
            canvasWidth = 0,
            canvasHeight = 0
        } = debugDetails || {};

        const embed = {
            title: "Business Card Creation Alert!",
            description: "A new business card was generated.",
            color: errorMessage ? 0xFF0000 : 0x00FF00, // Red for error, Green for success
            fields: [
                { name: "Employee Name", value: cardName || "N/A", inline: true },
                { name: "Employee Rank", value: cardRank || "N/A", inline: true },
                { name: "Phone Number", value: cardPhoneNumber || "N/A", inline: true },
                // Debug Information
                { name: "Screen Resolution", value: screenResolution, inline: true },
                { name: "Window Size", value: windowSize, inline: true },
                { name: "Device Pixel Ratio", value: devicePixelRatio.toString(), inline: true },
                { name: "Canvas Gen. Size", value: `${canvasWidth}x${canvasHeight}`, inline: true },
                { name: "User Agent", value: `\`\`\`${userAgent.substring(0, 950)}\`\`\``, inline: false },
                errorMessage ? { name: "Error", value: `\`\`\`${errorMessage.substring(0, 1000)}\`\`\``, inline: false } : null
            ].filter(field => field !== null),
            footer: {
                text: `PHMC Tools Tool | gh-pages ${commitInfo?.sha?.substring(0, 7) || 'N/A'}`
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

    // Define these styles once, as they are used for both preview and canvas drawing
    const nameOverlayStyle = {
        position: 'absolute', top: '23.44%', left: '2.75%', color: 'black',
        fontSize: '35px', pointerEvents: 'none', cursor: 'default', whiteSpace: 'nowrap',
        fontFamily: 'LufgaMedium, Arial, sans-serif' // Use the font name defined in @font-face
    };

    const rankOverlayStyle = {
        position: 'absolute', top: '31.92%', left: '3.31%', color: '#cb1212',
        fontSize: '15px', cursor: 'default', pointerEvents: 'none', whiteSpace: 'nowrap',
        fontFamily: 'LufgaMedium, Arial, sans-serif' // Use the font name
    };

    const phoneNumberOverlayStyle = {
        position: 'absolute', top: '53.03%', left: '12.06%', color: 'black',
        fontSize: '15px', cursor: 'default', pointerEvents: 'none', whiteSpace: 'nowrap',
        fontFamily: 'LufgaMedium, Arial, sans-serif' // Use the font name
    };


    const handleSave = useCallback(async () => {
        setIsSaving(true);
        showNotification('Processing Business Card...', 'upload');

        localStorage.setItem('name', name);
        localStorage.setItem('rank', rank);
        localStorage.setItem('phoneNumber', phoneNumber);

        const cardImageActualWidth = 750;
        const cardImageActualHeight = 440;

        const captureDebugDetails = () => ({
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            windowSize: `${window.innerWidth}x${window.innerHeight}`,
            userAgent: navigator.userAgent,
            devicePixelRatio: window.devicePixelRatio || 1,
            canvasWidth: cardImageActualWidth,
            canvasHeight: cardImageActualHeight
        });

        const canvas = document.createElement('canvas');
        canvas.width = cardImageActualWidth;
        canvas.height = cardImageActualHeight;
        const ctx = canvas.getContext('2d');

        const loadImage = (src) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => resolve(img);
                img.onerror = (err) => {
                    console.error("Failed to load base image for canvas:", err);
                    reject(new Error("Failed to load base image."));
                };
                img.src = src;
            });
        };

        try {
            const baseImage = await loadImage(BusinessCardImage);
            if (document.fonts && typeof document.fonts.ready === 'function') {
                await document.fonts.ready;
            }

            ctx.drawImage(baseImage, 0, 0, cardImageActualWidth, cardImageActualHeight);
            ctx.textBaseline = 'top';

            const nameX = cardImageActualWidth * (parseFloat(nameOverlayStyle.left) / 100);
            const nameY = cardImageActualHeight * (parseFloat(nameOverlayStyle.top) / 100);
            const nameFontSize = parseInt(nameOverlayStyle.fontSize);
            ctx.fillStyle = nameOverlayStyle.color;
            ctx.font = `${nameFontSize}px ${nameOverlayStyle.fontFamily || 'sans-serif'}`;
            ctx.fillText(name, nameX, nameY);

            const rankX = cardImageActualWidth * (parseFloat(rankOverlayStyle.left) / 100);
            const rankY = cardImageActualHeight * (parseFloat(rankOverlayStyle.top) / 100);
            const rankFontSize = parseInt(rankOverlayStyle.fontSize);
            ctx.fillStyle = rankOverlayStyle.color;
            ctx.font = `${rankFontSize}px ${rankOverlayStyle.fontFamily || 'sans-serif'}`;
            ctx.fillText(rank, rankX, rankY);

            const phoneX = cardImageActualWidth * (parseFloat(phoneNumberOverlayStyle.left) / 100);
            const phoneY = cardImageActualHeight * (parseFloat(phoneNumberOverlayStyle.top) / 100);
            const phoneFontSize = parseInt(phoneNumberOverlayStyle.fontSize);
            ctx.fillStyle = phoneNumberOverlayStyle.color;
            ctx.font = `${phoneFontSize}px ${phoneNumberOverlayStyle.fontFamily || 'sans-serif'}`;
            ctx.fillText(phoneNumber, phoneX, phoneY);

            const dataUrl = canvas.toDataURL('image/png');
            
            showNotification('Uploading to Imgur...', 'upload');
            const link = await uploadToImgur(dataUrl);
            setImgurLink(link);
            showNotification(`Business Card Saved & Uploaded: ${link}`, 'save');
            
            const debugInfo = captureDebugDetails();
            sendDiscordWebhook(name, rank, phoneNumber, link, debugInfo);

            await copyToClipboard(link, showNotification, 'Imgur link copied to clipboard!');
        } catch (error) {
            console.error('Error in Business Card handleSave:', error);
            let errorContext = 'Error generating business card';
            let detailedMessage = error.message || String(error);

            if (detailedMessage.includes('Imgur upload failed')) errorContext = 'Imgur Upload Failed';
            else if (detailedMessage.includes('Failed to load base image')) errorContext = 'Base Image Load Failed';
            else errorContext = 'Image Generation Failed';
            
            showNotification(`${errorContext}: ${detailedMessage.substring(0,100)}...`, 'error');
            Sentry.captureException(error, { extra: { context: 'Business Card Save', name, rank, detailedMessage } });
            
            const debugInfoForError = captureDebugDetails();
            sendDiscordWebhook(name, rank, phoneNumber, null, debugInfoForError, `${errorContext}: ${detailedMessage}`);
        } finally {
            setIsSaving(false);
        }
    }, [name, rank, phoneNumber, showNotification, uploadToImgur, sendDiscordWebhook, commitInfo, nameOverlayStyle, rankOverlayStyle, phoneNumberOverlayStyle]);


    if (!show) {
        return null;
    }

    return (
        <div className="modal-overlay">
            <div className="agency-selector-modal business-card-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h4>Business Card</h4>
                    <Button
                        variant="secondary"
                        className="close"
                        onClick={onHide}
                        aria-label="Close business card modal"
                    >
                        <i className="fas fa-times"></i>
                    </Button>
                </div>
                <div className="business-card-content">
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
                    <div 
                        className="business-card-image-container" 
                        style={{ 
                            position: 'relative', 
                            width: '100%', 
                            maxWidth: '800px',
                            margin: '0 auto 1rem auto'
                        }}
                    >
                        <img
                            src={BusinessCardImage}
                            alt="Business Card Preview"
                            style={{ display: 'block', width: '100%', height: 'auto', border: '1px solid #ccc' }}
                        />
                        <div
                            className="name-overlay"
                            ref={nameRef}
                            style={nameOverlayStyle}
                        >
                            {name}
                        </div>
                        <div
                            className="rank-overlay"
                            ref={rankRef}
                            style={rankOverlayStyle}
                        >
                            {rank}
                        </div>
                        <div
                            className="phone-number-overlay"
                            ref={departmentRef}
                            style={phoneNumberOverlayStyle}
                        >
                            {phoneNumber}
                        </div>
                    </div>
                    <div className="business-card-input-fields" style={{ marginTop: '1rem' }}>
                        <Form.Control className="mb-2" type="text" placeholder="Name" value={name} onChange={handleNameChange} />
                        <Form.Control className="mb-2" type="text" placeholder="Rank" value={rank} onChange={handleRankChange} />
                        <Form.Control className="mb-2" type="text" placeholder="Phone Number" value={phoneNumber} onChange={handlePhoneNumberChange} />
                    </div>
                </div>
                <Button className="mt-3 w-100" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save & Upload Business Card'}
                </Button>
            </div>
        </div>
    );
};

export default BusinessCardModal;
