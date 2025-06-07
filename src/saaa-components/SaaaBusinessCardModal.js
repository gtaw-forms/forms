import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Form, Button } from 'react-bootstrap';
import domtoimage from 'dom-to-image';
import * as Sentry from "@sentry/react";
import SaaaBusinessCardImage from '../assets/saaa-business-card.webp'; // Updated: Path to the new SAAA business card image
// If you have specific CSS for this modal, import it here:
// import './SaaaBusinessCardModal.css';

const SaaaBusinessCardModal = ({ show, onHide, showNotification, commitInfo }) => {
    const [name, setName] = useState('');
    const [rank, setRank] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [imgurLink, setImgurLink] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const businessCardRef = useRef(null);
    const nameRef = useRef(null);
    const rankRef = useRef(null);
    const departmentRef = useRef(null); // Used for phone number overlay

    // Webhook queue and rate limiting
    const webhookQueue = useRef([]);
    const isWebhookProcessing = useRef(false);
    const lastWebhookCallTimestamp = useRef(0);
    const webhookRateLimitDelay = 1100; // 1.1 seconds

    useEffect(() => {
        if (show) {
            // Consider using SAAA specific localStorage keys if needed, e.g., 'saaaName'
            setName(localStorage.getItem('saaaBusinessCardName') || '');
            setRank(localStorage.getItem('saaaBusinessCardRank') || '');
            setPhoneNumber(localStorage.getItem('saaaBusinessCardPhoneNumber') || '');
            setImgurLink(null); // Reset Imgur link when modal opens
        }
    }, [show]);

    const handleNameChange = (e) => setName(e.target.value);
    const handleRankChange = (e) => setRank(e.target.value);
    const handlePhoneNumberChange = (e) => setPhoneNumber(e.target.value);

    const uploadToImgur = useCallback(async (base64Image) => {
        const imgurClientId = process.env.REACT_APP_IMGUR_CLIENT_ID;
        const accessToken = process.env.REACT_APP_IMGUR_ACCESS_TOKEN;
        // Potentially use a different album for SAAA cards if desired
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
        // Potentially use a different webhook URL for SAAA notifications
        const webhookURL = process.env.REACT_APP_SAAA_DISCORD_WEBHOOK_URL || process.env.REACT_APP_DISCORD_WEBHOOK_URL;
        if (!webhookURL) {
            console.warn('Discord webhook URL is not set in environment variables.');
            return;
        }

        const embed = {
            title: "SAAA Business Card Creation Alert!", // Updated Title
            description: "A new SAAA business card was generated.", // Updated Description
            color: errorMessage ? 0xFF0000 : 0x00FF00, // Keep color logic or customize
            fields: [
                { name: "Employee Name", value: cardName || "N/A", inline: true },
                { name: "Employee Rank/Title", value: cardRank || "N/A", inline: true }, // Adjusted field name
                { name: "Phone Number", value: cardPhoneNumber || "N/A", inline: true },
                errorMessage ? { name: "Error", value: errorMessage, inline: false } : null
            ].filter(field => field !== null),
            footer: {
                text: `SAAA Forms Tool | gh-pages ${commitInfo.sha || 'N/A'}` // Updated Footer
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
        showNotification('Uploading SAAA Card, Just a moment....', 'upload'); // Updated notification

        // Consider SAAA specific localStorage keys
        localStorage.setItem('saaaBusinessCardName', name);
        localStorage.setItem('saaaBusinessCardRank', rank);
        localStorage.setItem('saaaBusinessCardPhoneNumber', phoneNumber);

        try {
            const dataUrl = await domtoimage.toPng(businessCardRef.current);
            const link = await uploadToImgur(dataUrl);
            setImgurLink(link);
            showNotification(`SAAA Business Card Saved & Uploaded to Imgur: ${link}`, 'save'); // Updated notification
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
                                message: 'Clipboard writeText failed for SAAA card.', // Updated context
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
            console.error('Error in SAAA handleSave:', error); // Updated context
            let errorContext = 'Error generating SAAA business card'; // Updated context
            let detailedMessage = error.message || String(error);

            if (detailedMessage.includes('Imgur upload failed')) {
                errorContext = 'Imgur Upload Failed';
            } else if (error.name === 'Error' && businessCardRef.current && !domtoimage.toPng) {
                 errorContext = 'Image Conversion Failed';
            }
            showNotification(errorContext, 'error');
            Sentry.captureException(error, { extra: { context: 'SAAA Business Card Save', name, rank } }); // Updated context
            sendDiscordWebhook(name, rank, phoneNumber, null, `${errorContext}: ${detailedMessage}`);
        } finally {
            setIsSaving(false);
        }
    }, [name, rank, phoneNumber, showNotification, uploadToImgur, sendDiscordWebhook, commitInfo]);


    if (!show) {
        return null;
    }

    // IMPORTANT: The overlay div/text positions (top, left, fontSize) for name, rank, and phone number
    // will likely need to be adjusted based on the layout of your new SaaaBusinessCardImage.
    // These are copied from the original and are placeholders.
    return (
        <div className="modal-overlay">
            {/* Consider adding a SAAA-specific class for styling if needed */}
            <div className="agency-selector-modal saaa-business-card-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h4>SAAA Business Card</h4> {/* Updated Title */}
                    <Button
                        variant="secondary"
                        className="close"
                        onClick={onHide}
                        aria-label="Close SAAA business card modal" // Updated ARIA label
                    >
                        <i className="fas fa-times"></i>
                    </Button>
                </div>
                <div className="business-card-content"> {/* You might want a SAAA-specific class here too */}
                    If you get any errors, please let me know on Discord.
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
                    <div className="business-card-image-container" ref={businessCardRef} style={{ position: 'relative', width: '100%', maxWidth: '800px' /* Adjust as needed */ }}>
                        <img
                            src={SaaaBusinessCardImage} // Updated: Use SAAA image
                            alt="SAAA Business Card" // Updated Alt Text
                            style={{ display: 'block', width: '100%', height: 'auto' }}
                        />
                        {/* ADJUST THESE OVERLAY POSITIONS BASED ON YOUR SAAA IMAGE */}
                        <div
                            className="name-overlay"
                            ref={nameRef}
                            style={{
                                position: 'absolute', top: '23.44%', left: '2.75%', color: 'black', // Example values
                                fontSize: '35px', pointerEvents: 'none', cursor: 'default', whiteSpace: 'nowrap' // Example values
                            }}
                        >
                            {name}
                        </div>
                        <div
                            className="rank-overlay"
                            ref={rankRef}
                            style={{
                                position: 'absolute', top: '31.92%', left: '3.31%', color: '#cb1212', // Example values
                                fontSize: '15px', cursor: 'default', pointerEvents: 'none', whiteSpace: 'nowrap' // Example values
                            }}
                        >
                            {rank}
                        </div>
                        <div
                            className="phone-number-overlay"
                            ref={departmentRef}
                            style={{
                                position: 'absolute', top: '53.03%', left: '11.06%', color: 'black', // Example values
                                fontSize: '15px', cursor: 'default', pointerEvents: 'none', whiteSpace: 'nowrap' // Example values
                            }}
                        >
                            {phoneNumber}
                        </div>
                        <div
                            className="static-agency-name-overlay"
                            style={{
                                position: 'absolute',
                                top: '10%', // ADJUST THIS
                                left: '5%',  // ADJUST THIS
                                color: 'black', // ADJUST THIS
                                fontSize: '20px', // ADJUST THIS
                                pointerEvents: 'none',
                                cursor: 'default',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            Los Santos Aviation Administration
                        </div>
                        <div
                            className="static-website-overlay"
                            style={{
                                position: 'absolute',
                                top: '85%', // ADJUST THIS
                                left: '5%',  // ADJUST THIS
                                color: 'grey', // ADJUST THIS
                                fontSize: '12px', // ADJUST THIS
                                pointerEvents: 'none',
                                cursor: 'default',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            ((saaa.gta.world))
                        </div>
                        {/* END: Added Static Text Overlays */}
                    </div>
                    <div className="business-card-input-fields">
                        <Form.Control type="text" placeholder="Name" value={name} onChange={handleNameChange} />
                        <Form.Control type="text" placeholder="Rank/Title" value={rank} onChange={handleRankChange} />
                        <Form.Control type="text" placeholder="Phone Number" value={phoneNumber} onChange={handlePhoneNumberChange} />
                    </div>
                </div>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save SAAA Card'} 
                </Button>
            </div>
        </div>
    );
};

export default SaaaBusinessCardModal;
