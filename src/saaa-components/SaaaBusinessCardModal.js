import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Form, Button } from 'react-bootstrap';
import domtoimage from 'dom-to-image';
import * as Sentry from "@sentry/react";
// import SaaaBusinessCardImageWebP from '../assets/saaa-business-card.webp'; // Removed WebP
import SaaaBusinessCardImagePng from '../assets/saaa-business-card2.png'; // Keep PNG

const SaaaBusinessCardModal = ({ show, onHide, showNotification, commitInfo }) => {
    const [name, setName] = useState('');
    const [rank, setRank] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [imgurLink, setImgurLink] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    // const [usePngImage, setUsePngImage] = useState(false); // Removed state for image toggle

    const businessCardRef = useRef(null);

    const modalContainerStyle = {
        fontFamily: 'Poppins-Medium, sans-serif',
        backgroundColor: '#0d1117',
        color: '#c9d1d9',
        padding: '20px',
        borderRadius: '5px',
        border: '1px solid #30363d',
    };

    const nameOverlayStyle = {
        position: 'absolute', top: '29%', left: '56%', color: 'white',
        fontSize: '35px', // Corrected PX to px
        fontWeight: 'bold',
        pointerEvents: 'none', cursor: 'default', whiteSpace: 'nowrap',
        fontFamily: 'Poppins-Medium, sans-serif',
    };

    const rankOverlayStyle = {
        position: 'absolute', top: '39.9%', left: '54%', color: 'white',
        fontSize: '20px', cursor: 'default', pointerEvents: 'none', whiteSpace: 'nowrap',
        fontFamily: 'Poppins-Medium, sans-serif',
    };

    const phoneNumberOverlayStyle = {
        position: 'absolute',
        top: '52%',
        right: '15%',
        color: 'white',
        fontSize: '25px',
        cursor: 'default',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        fontFamily: 'Poppins-Medium, sans-serif',
        textAlign: 'right',
    };

    const emailOverlayStyle = {
        position: 'absolute',
        top: '62%',
        right: '15%',
        color: 'white',
        fontSize: '25px',
        cursor: 'default',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        fontFamily: 'Poppins-Medium, sans-serif',
        textAlign: 'right',
    };
    const staticAgencyNameOverlayStyle = {
        position: 'absolute', top: '73%', left: '45.4%', color: 'white',
        fontSize: '20px', pointerEvents: 'none', cursor: 'default', whiteSpace: 'nowrap',
        fontFamily: 'Poppins-Medium, sans-serif',
    };
    const staticWebsiteOverlayStyle = {
        position: 'absolute', top: '83%', left: '61.9%', color: 'white',
        fontSize: '19px', pointerEvents: 'none', cursor: 'default', whiteSpace: 'nowrap',
        fontFamily: 'Poppins-Medium, sans-serif',
    };

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
                throw new Error(`Imgur upload failed: ${data.data.error}`);
            }
        } catch (error) {
            console.error('Imgur upload failed:', error);
            throw error;
        }
    }, []);

    const processWebhookQueue = useCallback(async () => {
        if (webhookQueue.current.length === 0 || isWebhookProcessing.current) {
            return;
        }
        isWebhookProcessing.current = true;
        const now = Date.now();
        const timeSinceLastCall = now - lastWebhookCallTimestamp.current;

        if (timeSinceLastCall < webhookRateLimitDelay) {
            const delay = webhookRateLimitDelay - timeSinceLastCall;
            console.log(`Rate limiting Discord webhook. Delaying for ${delay}ms.`);
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
                console.error('Failed to send Discord webhook:', response.status, response.statusText);
            } else {
                lastWebhookCallTimestamp.current = Date.now();
            }
        } catch (error) {
            console.error('Error sending Discord webhook:', error);
        } finally {
            isWebhookProcessing.current = false;
            if (webhookQueue.current.length > 0) {
                setTimeout(processWebhookQueue, 0);
            }
        }
    }, []);

    const sendDiscordWebhook = useCallback(async (cardName, cardRank, cardPhoneNumber, generatedImgurLink, errorMessage = null) => {
        const webhookURL = process.env.REACT_APP_SAAA_DISCORD_WEBHOOK_URL || process.env.REACT_APP_DISCORD_WEBHOOK_URL;
        if (!webhookURL) {
            console.warn('Discord webhook URL is not set in environment variables.');
            return;
        }

        const embed = {
            title: "SAAA Business Card Creation Alert!",
            description: "A new SAAA business card was generated.",
            color: errorMessage ? 0xFF0000 : 0x00FF00,
            fields: [
                { name: "Employee Name", value: cardName || "N/A", inline: true },
                { name: "Employee Rank/Title", value: cardRank || "N/A", inline: true },
                { name: "Phone Number", value: cardPhoneNumber || "N/A", inline: true },
                errorMessage ? { name: "Error", value: errorMessage, inline: false } : null
            ].filter(field => field !== null),
            footer: {
                text: `SAAA Forms Tool | gh-pages ${commitInfo.sha || 'N/A'}`
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
        showNotification('Uploading SAAA Card, Just a moment....', 'upload');

        try {
            // Ensure custom fonts are loaded before capturing
            await document.fonts.ready;

            // Define the canonical dimensions of your business card image
            // Replace these with the actual width and height of SaaaBusinessCardImagePng
            const cardImageActualWidth = 2463; // Example: actual width of saaa-business-card2.png
            const cardImageActualHeight = 1403; // Example: actual height of saaa-business-card2.png

            const dataUrl = await domtoimage.toPng(businessCardRef.current, {
                width: cardImageActualWidth,
                height: cardImageActualHeight,
                // You can also specify quality if needed, e.g., quality: 0.95
            });

            const link = await uploadToImgur(dataUrl);
            setImgurLink(link);
            showNotification(`SAAA Business Card Saved & Uploaded to Imgur: ${link}`, 'save');
            sendDiscordWebhook(name, rank, phoneNumber, link);

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(link)
                    .then(() => {
                        showNotification('Imgur link copied to clipboard!', 'clipboard');
                    })
                    .catch(err => {
                        console.error('Failed to copy Imgur link to clipboard:', err);
                        Sentry.captureException(err, {
                            extra: {
                                message: 'Clipboard writeText failed for SAAA card.',
                                imgurLink: link,
                                userAgent: navigator.userAgent,
                            }
                        });
                        let userMessage = 'Failed to copy Imgur link automatically.';
                        if (err.name === 'NotAllowedError') {
                            userMessage += ' Please grant clipboard permission.';
                        } else if (err.message.includes('focused')) {
                            userMessage += ' Please ensure this window is focused and try copying manually.';
                        } else {
                            userMessage += ' Please copy the link manually.';
                        }
                        showNotification(userMessage, 'error');
                    });
            } else {
                const clipboardWarning = 'Clipboard API not available in this browser/context.';
                console.warn(clipboardWarning);
                Sentry.captureMessage(clipboardWarning, 'warning');
                showNotification('Clipboard API not available. Please copy the link manually.', 'warning');
            }
        } catch (error) {
            console.error('Error in SAAA handleSave:', error);
            let errorContext = 'Error generating SAAA business card';
            let detailedMessage = error.message || String(error);

            if (detailedMessage.includes('Imgur upload failed')) {
                errorContext = 'Imgur Upload Failed';
            } else if (error.name === 'Error' && businessCardRef.current && !domtoimage.toPng) {
                 errorContext = 'Image Conversion Failed';
            }
            showNotification(errorContext, 'error');
            Sentry.captureException(error, { extra: { context: 'SAAA Business Card Save', name, rank } });
            sendDiscordWebhook(name, rank, phoneNumber, null, `${errorContext}: ${detailedMessage}`);
        } finally {
            setIsSaving(false);
        }
    }, [name, rank, phoneNumber, showNotification, uploadToImgur, sendDiscordWebhook, commitInfo]);
    // Removed toggleCardImage function

    if (!show) {
        return null;
    }

    const emailString = name ? `${name.toLowerCase().replace(/\s+/g, '.')}@saaa.gov.us` : '@saaa.gov.us';
    const currentCardImage = SaaaBusinessCardImagePng; // Always use PNG

    return (
        <div className="modal-overlay">
            <div style={modalContainerStyle} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h4 style={{ fontFamily: 'Poppins-Medium, sans-serif' }}>SAAA Business Card</h4>
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
                    <p style={{ fontFamily: 'Poppins-Medium, sans-serif' }}>
                        If you get any errors, please let me know on Discord.
                    </p>
                    {/* Removed Image Toggle Button */}
                    {imgurLink && (
                        <div className="imgur-link-container">
                            <p style={{ fontFamily: 'Poppins-Medium, sans-serif' }}>
                                <strong>Imgur Link: </strong>
                                <a href={imgurLink} target="_blank" rel="noopener noreferrer">
                                    {imgurLink}
                                </a>
                            </p>
                            <span style={{ fontFamily: 'Poppins-Medium, sans-serif' }}>Instructions!</span>
                        </div>
                    )}
                    <div className="business-card-image-container" ref={businessCardRef} style={{ position: 'relative', width: '100%', maxWidth: '800px' }}>
                        <img
                            src={currentCardImage} // Uses the PNG image
                            alt="SAAA Business Card"
                            style={{ display: 'block', width: '100%', height: 'auto' }}
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
                    <div className="business-card-input-fields" style={{ marginTop: '1rem' }}>
                        <Form.Control style={{ fontFamily: 'Poppins-Medium, sans-serif', marginBottom: '0.5rem' }} type="text" placeholder="Name (12 Character Limit)" value={name} onChange={handleNameChange} maxLength={17} />
                        <Form.Control style={{ fontFamily: 'Poppins-Medium, sans-serif', marginBottom: '0.5rem' }} type="text" placeholder="Rank/Title" value={rank} onChange={handleRankChange} />
                        <Form.Control style={{ fontFamily: 'Poppins-Medium, sans-serif' }} type="text" placeholder="Phone Number" value={phoneNumber} onChange={handlePhoneNumberChange} />
                    </div>
                </div>
                <Button style={{ fontFamily: 'Poppins-Medium, sans-serif' }} onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save SAAA Card'}
                </Button>
            </div>
        </div>
    );
};

export default SaaaBusinessCardModal;
