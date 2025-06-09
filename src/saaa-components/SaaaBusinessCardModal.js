import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Form, Button } from 'react-bootstrap';
// import domtoimage from 'dom-to-image'; // No longer needed for image generation
import * as Sentry from "@sentry/react";
import SaaaBusinessCardImagePng from '../assets/saaa-business-card2.png';
// Make sure you have a CSS file for this component if Poppins-Medium is defined there
// import './SaaaBusinessCardModal.css';

const SaaaBusinessCardModal = ({ show, onHide, showNotification, commitInfo }) => {
    const [name, setName] = useState('');
    const [rank, setRank] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [imgurLink, setImgurLink] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // This ref is now only for the visual preview container, not for dom-to-image
    const businessCardPreviewRef = useRef(null);

    // --- Define Styles for Preview and Canvas ---
    // Ensure 'Poppins-Medium' is loaded via CSS (@font-face)
    const poppinsFontFamily = '"Poppins-Medium", Arial, sans-serif';

    const modalContainerStyle = {
        fontFamily: poppinsFontFamily,
        backgroundColor: '#0d1117',
        color: '#c9d1d9',
        padding: '20px',
        borderRadius: '5px',
        border: '1px solid #30363d',
    };

    const nameOverlayStyle = {
        position: 'absolute', top: '29%', left: '56%', color: 'white',
        fontSize: '35px',
        fontWeight: 'bold',
        pointerEvents: 'none', cursor: 'default', whiteSpace: 'nowrap',
        fontFamily: poppinsFontFamily,
    };

    const rankOverlayStyle = {
        position: 'absolute', top: '39.9%', left: '54%', color: 'white',
        fontSize: '20px', cursor: 'default', pointerEvents: 'none', whiteSpace: 'nowrap',
        fontFamily: poppinsFontFamily,
    };

    const phoneNumberOverlayStyle = {
        position: 'absolute',
        top: '52%',
        right: '15%', // For canvas, we'll need to calculate X from right
        color: 'white',
        fontSize: '25px',
        cursor: 'default',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        fontFamily: poppinsFontFamily,
        textAlign: 'right', // For canvas, use ctx.textAlign = 'right'
    };

    const emailOverlayStyle = {
        position: 'absolute',
        top: '62%',
        right: '15%', // For canvas, calculate X from right
        color: 'white',
        fontSize: '25px',
        cursor: 'default',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        fontFamily: poppinsFontFamily,
        textAlign: 'right', // For canvas, use ctx.textAlign = 'right'
    };
    const staticAgencyNameOverlayStyle = {
        position: 'absolute', top: '73%', left: '45.4%', color: 'white',
        fontSize: '20px', pointerEvents: 'none', cursor: 'default', whiteSpace: 'nowrap',
        fontFamily: poppinsFontFamily,
    };
    const staticWebsiteOverlayStyle = {
        position: 'absolute', top: '83%', left: '61.9%', color: 'white',
        fontSize: '19px', pointerEvents: 'none', cursor: 'default', whiteSpace: 'nowrap',
        fontFamily: poppinsFontFamily,
    };
    // --- End Styles ---


    const webhookQueue = useRef([]);
    const isWebhookProcessing = useRef(false);
    const lastWebhookCallTimestamp = useRef(0);
    const webhookRateLimitDelay = 1100;

    useEffect(() => {
        if (show) {
            setName(localStorage.getItem('saaaBusinessCardName') || '');
            setRank(localStorage.getItem('saaaBusinessCardRank') || '');
            setPhoneNumber(localStorage.getItem('saaaBusinessCardPhoneNumber') || '');
            setImgurLink(null);
        }
    }, [show]);


    useEffect(() => {
        // This effect for saving to localStorage can remain as is
        if (show) {
            localStorage.setItem('saaaBusinessCardName', name);
            localStorage.setItem('saaaBusinessCardRank', rank);
            localStorage.setItem('saaaBusinessCardPhoneNumber', phoneNumber);
        }
    }, [name, rank, phoneNumber, show]);

    const handleNameChange = (e) => setName(e.target.value);
    const handleRankChange = (e) => setRank(e.target.value);
    const handlePhoneNumberChange = (e) => setPhoneNumber(e.target.value);

    const uploadToImgur = useCallback(async (base64Image) => {
        const imgurClientId = process.env.REACT_APP_IMGUR_CLIENT_ID;
        const accessToken = process.env.REACT_APP_IMGUR_ACCESS_TOKEN;
        const albumId = process.env.REACT_APP_IMGUR_SAAA_ALBUM_ID || process.env.REACT_APP_IMGUR_ALBUM_ID;
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
                Sentry.captureMessage("Imgur API Error (SAAA Card)", { extra: data, level: "error" });
                throw new Error(`Imgur upload failed: ${data.data?.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Imgur upload failed:', error);
            Sentry.captureException(error, { extra: { context: 'Imgur Upload Function (SAAA Card)' } });
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
                console.error('Failed to send Discord webhook (SAAA Card):', response.status, response.statusText, errorData);
                Sentry.captureMessage("Discord Webhook Send Failure (SAAA Card)", {
                    extra: { status: response.status, statusText: response.statusText, responseBody: errorData },
                    level: "error"
                });
            } else {
                lastWebhookCallTimestamp.current = Date.now();
            }
        } catch (error) {
            console.error('Error sending Discord webhook (SAAA Card):', error);
            Sentry.captureException(error, { extra: { context: 'Discord Webhook Send Function (SAAA Card)' } });
        } finally {
            isWebhookProcessing.current = false;
            if (webhookQueue.current.length > 0) {
                setTimeout(processWebhookQueue, 0);
            }
        }
    }, []);

    const sendDiscordWebhook = useCallback(async (cardName, cardRank, cardPhoneNumber, generatedImgurLink, debugDetails, errorMessage = null) => {
        const webhookURL = process.env.REACT_APP_SAAA_DISCORD_WEBHOOK_URL || process.env.REACT_APP_DISCORD_WEBHOOK_URL;
        if (!webhookURL) {
            console.warn('SAAA Discord webhook URL is not set in environment variables.');
            Sentry.captureMessage("SAAA Discord Webhook URL not set", { level: "warning" });
            return;
        }

        // Use debugDetails passed from handleSave
        const {
            screenResolution = 'N/A',
            windowSize = 'N/A',
            userAgent = 'N/A',
            devicePixelRatio = 'N/A',
            canvasWidth = 0,
            canvasHeight = 0
        } = debugDetails || {};

        const embed = {
            title: "SAAA Business Card Creation Alert!",
            description: "A new SAAA business card was generated.",
            color: errorMessage ? 0xFF0000 : 0x00FF00, // Red for error, Green for success
            fields: [
                { name: "Employee Name", value: cardName || "N/A", inline: true },
                { name: "Employee Rank/Title", value: cardRank || "N/A", inline: true },
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
                text: `SAAA Forms Tool | gh-pages ${commitInfo?.sha?.substring(0, 7) || 'N/A'}`
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
        setIsSaving(true);
        showNotification('Processing SAAA Card...', 'upload');

        // Canvas dimensions (already defined in your handleSave)
        const cardImageActualWidth = 800;
        const cardImageActualHeight = 455;

        // Prepare debug details object
        const captureDebugDetails = () => ({
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            windowSize: `${window.innerWidth}x${window.innerHeight}`,
            userAgent: navigator.userAgent,
            devicePixelRatio: window.devicePixelRatio || 1, // Default to 1 if undefined
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
                    console.error("Failed to load base SAAA card image for canvas:", err);
                    reject(new Error("Failed to load base SAAA card image."));
                };
                img.src = src;
            });
        };

        try {
            if (document.fonts && typeof document.fonts.ready === 'function') {
                await document.fonts.ready;
            }
            const baseImage = await loadImage(SaaaBusinessCardImagePng);
            ctx.drawImage(baseImage, 0, 0, cardImageActualWidth, cardImageActualHeight);
            ctx.textBaseline = 'top';

            // ... (your existing canvas drawing logic for name, rank, phone, email, static text) ...
            // 2. Draw Name
            const nameX = cardImageActualWidth * (parseFloat(nameOverlayStyle.left) / 100);
            const nameY = cardImageActualHeight * (parseFloat(nameOverlayStyle.top) / 100);
            const nameFontSize = parseInt(nameOverlayStyle.fontSize);
            ctx.fillStyle = nameOverlayStyle.color;
            ctx.font = `${nameOverlayStyle.fontWeight || ''} ${nameFontSize}px ${nameOverlayStyle.fontFamily}`;
            ctx.fillText(name, nameX, nameY);

            // 3. Draw Rank
            const rankX = cardImageActualWidth * (parseFloat(rankOverlayStyle.left) / 100);
            const rankY = cardImageActualHeight * (parseFloat(rankOverlayStyle.top) / 100);
            const rankFontSize = parseInt(rankOverlayStyle.fontSize);
            ctx.fillStyle = rankOverlayStyle.color;
            ctx.font = `${rankFontSize}px ${rankOverlayStyle.fontFamily}`;
            ctx.fillText(rank, rankX, rankY);
            
            // 4. Draw Phone Number (right-aligned)
            const phoneRightMargin = parseFloat(phoneNumberOverlayStyle.right);
            const phoneX = cardImageActualWidth * (1 - (phoneRightMargin / 100));
            const phoneY = cardImageActualHeight * (parseFloat(phoneNumberOverlayStyle.top) / 100);
            const phoneFontSize = parseInt(phoneNumberOverlayStyle.fontSize);
            ctx.fillStyle = phoneNumberOverlayStyle.color;
            ctx.font = `${phoneFontSize}px ${phoneNumberOverlayStyle.fontFamily}`;
            ctx.textAlign = 'right';
            ctx.fillText(phoneNumber, phoneX, phoneY);
            ctx.textAlign = 'left'; 

            // 5. Draw Email (right-aligned)
            const emailString = name ? `${name.toLowerCase().replace(/\s+/g, '.')}@saaa.gov.us` : '@saaa.gov.us';
            const emailRightMargin = parseFloat(emailOverlayStyle.right); 
            const emailX = cardImageActualWidth * (1 - (emailRightMargin / 100));
            const emailY = cardImageActualHeight * (parseFloat(emailOverlayStyle.top) / 100);
            const emailFontSize = parseInt(emailOverlayStyle.fontSize);
            ctx.fillStyle = emailOverlayStyle.color;
            ctx.font = `${emailFontSize}px ${emailOverlayStyle.fontFamily}`;
            ctx.textAlign = 'right';
            ctx.fillText(emailString, emailX, emailY);
            ctx.textAlign = 'left'; 

            // 6. Draw Static Agency Name
            const agencyX = cardImageActualWidth * (parseFloat(staticAgencyNameOverlayStyle.left) / 100);
            const agencyY = cardImageActualHeight * (parseFloat(staticAgencyNameOverlayStyle.top) / 100);
            const agencyFontSize = parseInt(staticAgencyNameOverlayStyle.fontSize);
            ctx.fillStyle = staticAgencyNameOverlayStyle.color;
            ctx.font = `${agencyFontSize}px ${staticAgencyNameOverlayStyle.fontFamily}`;
            ctx.fillText("Los Santos International Airport", agencyX, agencyY);

            // 7. Draw Static Website
            const webX = cardImageActualWidth * (parseFloat(staticWebsiteOverlayStyle.left) / 100);
            const webY = cardImageActualHeight * (parseFloat(staticWebsiteOverlayStyle.top) / 100);
            const webFontSize = parseInt(staticWebsiteOverlayStyle.fontSize);
            ctx.fillStyle = staticWebsiteOverlayStyle.color;
            ctx.font = `${webFontSize}px ${staticWebsiteOverlayStyle.fontFamily}`;
            ctx.fillText("((saaa.gta.world))", webX, webY);


            const dataUrl = canvas.toDataURL('image/png');
            
            showNotification('Uploading to Imgur...', 'upload');
            const link = await uploadToImgur(dataUrl);
            setImgurLink(link);
            showNotification(`SAAA Business Card Saved & Uploaded: ${link}`, 'save');
            
            const debugInfo = captureDebugDetails(); // Capture details before sending
            sendDiscordWebhook(name, rank, phoneNumber, link, debugInfo);

            // ... (clipboard logic) ...
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(link)
                    .then(() => {
                        showNotification('Imgur link copied to clipboard!', 'clipboard');
                    })
                    .catch(err => {
                        console.error('Failed to copy Imgur link to clipboard:', err);
                        Sentry.captureException(err, {
                            extra: {
                                message: 'Clipboard writeText failed (SAAA Card).',
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
                const clipboardWarning = 'Clipboard API not available for SAAA Card.';
                console.warn(clipboardWarning);
                Sentry.captureMessage(clipboardWarning, { level: 'warning' });
                showNotification('Clipboard API not available. Please copy the link manually.', 'warning');
            }

        } catch (error) {
            console.error('Error in SAAA handleSave:', error);
            let errorContext = 'Error generating SAAA business card';
            let detailedMessage = error.message || String(error);

            if (detailedMessage.includes('Imgur upload failed')) errorContext = 'Imgur Upload Failed';
            else if (detailedMessage.includes('Failed to load base SAAA card image')) errorContext = 'Base Image Load Failed';
            else errorContext = 'Image Generation Failed';
            
            showNotification(`${errorContext}: ${detailedMessage.substring(0,100)}...`, 'error');
            Sentry.captureException(error, { extra: { context: 'SAAA Business Card Save', name, rank, detailedMessage } });
            
            const debugInfoForError = captureDebugDetails(); // Capture details for error webhook
            sendDiscordWebhook(name, rank, phoneNumber, null, debugInfoForError, `${errorContext}: ${detailedMessage}`);
        } finally {
            setIsSaving(false);
        }
    }, [name, rank, phoneNumber, showNotification, uploadToImgur, sendDiscordWebhook, commitInfo, poppinsFontFamily, nameOverlayStyle, rankOverlayStyle, phoneNumberOverlayStyle, emailOverlayStyle, staticAgencyNameOverlayStyle, staticWebsiteOverlayStyle]);

    if (!show) {
        return null;
    }

    const emailString = name ? `${name.toLowerCase().replace(/\s+/g, '.')}@saaa.gov.us` : '@saaa.gov.us';
    const currentCardImage = SaaaBusinessCardImagePng;

    return (
        <div className="modal-overlay">
            <div style={modalContainerStyle} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h4 style={{ fontFamily: poppinsFontFamily }}>SAAA Business Card</h4>
                    <Button
                        variant="secondary"
                        className="close"
                        onClick={onHide}
                        aria-label="Close SAAA business card modal"
                    >
                        <i className="fas fa-times"></i>
                    </Button>
                </div>
                <div className="business-card-content">
                    <p style={{ fontFamily: poppinsFontFamily }}>
                        If you get any errors, please let me know on Discord.
                    </p>
                    {imgurLink && (
                        <div className="imgur-link-container">
                            <p style={{ fontFamily: poppinsFontFamily }}>
                                <strong>Imgur Link: </strong>
                                <a href={imgurLink} target="_blank" rel="noopener noreferrer">
                                    {imgurLink}
                                </a>
                            </p>
                            <span style={{ fontFamily: poppinsFontFamily }}>Instructions!</span>
                        </div>
                    )}
                    {/* Visual Preview Area */}
                    <div 
                        className="business-card-image-container" 
                        ref={businessCardPreviewRef} // Ref for the preview container
                        style={{ 
                            position: 'relative', 
                            width: '100%', 
                            maxWidth: '800px', // Or your card's natural width for preview
                            margin: '0 auto 1rem auto'
                        }}
                    >
                        <img
                            src={currentCardImage}
                            alt="SAAA Business Card Preview"
                            style={{ display: 'block', width: '100%', height: 'auto', border: '1px solid #ccc' }}
                        />
                        <div className="name-overlay" style={nameOverlayStyle}>
                            {name}
                        </div>
                        <div className="rank-overlay" style={rankOverlayStyle}>
                            {rank}
                        </div>
                        <div className="phone-number-overlay" style={phoneNumberOverlayStyle}>
                            {phoneNumber}
                        </div>
                        <div className="email-overlay" style={emailOverlayStyle}>
                            {emailString}
                        </div>
                        <div className="static-agency-name-overlay" style={staticAgencyNameOverlayStyle}>
                            Los Santos International Airport
                        </div>
                        <div className="static-website-overlay" style={staticWebsiteOverlayStyle}>
                            ((saaa.gta.world))
                        </div>
                    </div>
                    {/* Input Fields */}
                    <div className="business-card-input-fields" style={{ marginTop: '1rem' }}>
                        <Form.Control style={{ fontFamily: poppinsFontFamily, marginBottom: '0.5rem' }} type="text" placeholder="Name (17 Character Limit)" value={name} onChange={handleNameChange} maxLength={17} />
                        <Form.Control style={{ fontFamily: poppinsFontFamily, marginBottom: '0.5rem' }} type="text" placeholder="Rank/Title" value={rank} onChange={handleRankChange} />
                        <Form.Control style={{ fontFamily: poppinsFontFamily }} type="text" placeholder="Phone Number" value={phoneNumber} onChange={handlePhoneNumberChange} />
                    </div>
                </div>
                <Button style={{ fontFamily: poppinsFontFamily }} className="mt-3 w-100" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save SAAA Card'}
                </Button>
            </div>
        </div>
    );
};

export default SaaaBusinessCardModal;
