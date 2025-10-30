import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Form, Button } from 'react-bootstrap';
import * as Sentry from "@sentry/react";
import BusinessCardImage from '../assets/business-card.png';
import LSFD_BusinessCardImage from '../assets/lsfd_business_card.png';
import { copyToClipboard } from '../components/notificationService';
import './BusinessCardModal.css';


const BusinessCardModal = ({ show, onHide, showNotification, commitInfo, handleImageUpload }) => {
    const lsfdStations = {
        'Station 1': 'Paleto Boulevard, Paleto Bay, Los Santos County',
        'Station 52': 'Rockford Drive, Rockford Hills, Los Santos',
        'Station 63': 'Bay City Avenue, Vespucci, Los Santos',
        'Station 9': 'Macdonald Street, Davis, Los Santos',
    };

    const [name, setName] = useState('');
    const [rank, setRank] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [stationAssigned, setStationAssigned] = useState('');
    const [imageUrl, setImageUrl] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [businessCardType, setBusinessCardType] = useState('PHMC');

    const webhookQueue = useRef([]);
    const isWebhookProcessing = useRef(false);
    const lastWebhookCallTimestamp = useRef(0);
    const webhookRateLimitDelay = 1100;

    useEffect(() => {
        if (show) {
            setName(localStorage.getItem('name') || '');
            setRank(localStorage.getItem('rank') || '');
            setPhoneNumber(localStorage.getItem('phoneNumber') || '');
            setStationAssigned(localStorage.getItem('stationAssigned') || '');
            setBusinessCardType(localStorage.getItem('businessCardType') || 'PHMC');
            setImageUrl(null);
        }
    }, [show]);

    useEffect(() => {
        if (businessCardType === 'LSFD' && !phoneNumber) {
            setPhoneNumber('333');
        }
    }, [businessCardType, phoneNumber]);

    const handleNameChange = (e) => setName(e.target.value);
    const handleRankChange = (e) => setRank(e.target.value);
    const handlePhoneNumberChange = (e) => setPhoneNumber(e.target.value);
    const handleStationAssignedChange = (e) => setStationAssigned(e.target.value);

    const getStationAddress = useCallback((station) => {
        return lsfdStations[station] || '';
    }, [lsfdStations]);

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
                console.error('Failed to send Discord webhook (Business Card):', {
                    status: response.status,
                    statusText: response.statusText,
                    errorData,
                    payload: message
                });
                Sentry.captureMessage("Discord Webhook Send Failure (Business Card)", {
                    extra: {
                        status: response.status,
                        statusText: response.statusText,
                        responseBody: errorData,
                        webhookPayload: JSON.stringify(message),
                        embedCount: message.embeds?.length,
                        firstEmbed: message.embeds?.[0]
                    },
                    level: "error"
                });
            } else {
                console.log('Discord webhook sent successfully');
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

    const sendDiscordWebhook = useCallback(async (cardName, cardRank, cardPhoneNumber, generatedImageUrl, errorMessage = null, cardType = 'PHMC', cardStationAssigned = '') => {
        const webhookURL = process.env.REACT_APP_DEV_WEBHOOK;
        if (!webhookURL) {
            console.warn('Discord webhook URL is not set in environment variables.');
            Sentry.captureMessage("Discord Webhook URL not set (Business Card)", { level: "warning" });
            return;
        }

        const embed = {
            title: "Business Card Creation Alert!",
            description: "A new business card was generated.",
            color: errorMessage ? 0xFF0000 : 0x00FF00,
            fields: [
                { name: "Business Card Type", value: cardType || "PHMC", inline: true },
                { name: "Employee Name", value: cardName || "N/A", inline: true },
                { name: "Employee Rank", value: cardRank || "N/A", inline: true },
                { name: "Phone Number", value: cardPhoneNumber || "N/A", inline: true },
                ...(cardType === 'LSFD' ? [
                    { name: "Station Assigned", value: cardStationAssigned || "N/A", inline: true },
                    { name: "Station Address", value: getStationAddress(cardStationAssigned) || "N/A", inline: false }
                ] : [])
            ],
            footer: {
                text: `PHMC Tools Tool | gh-pages ${commitInfo?.sha?.substring(0, 7) || 'N/A'}`
            },
            timestamp: new Date().toISOString()
        };

        if (errorMessage) {
            embed.fields.push({
                name: "Error",
                value: errorMessage.substring(0, 1000),
                inline: false
            });
        }

        const imageUrlString = typeof generatedImageUrl === 'string' ? generatedImageUrl : String(generatedImageUrl || '');

        if (imageUrlString && (imageUrlString.startsWith('http://') || imageUrlString.startsWith('https://'))) {
            embed.image = { url: imageUrlString };
            embed.fields.push({
                name: "Image Status",
                value: "Successfully uploaded and attached.",
                inline: false
            });
        } else if (!errorMessage) {
            console.log('Invalid image URL:', { generatedImageUrl, type: typeof generatedImageUrl });
            embed.fields.push({
                name: "Image Status",
                value: `Image uploaded, but link is invalid or missing. Received: ${imageUrlString.substring(0, 100)}`,
                inline: false
            });
        } else {
            embed.fields.push({
                name: "Image Status",
                value: "Image upload failed.",
                inline: false
            });
        }

        const message = { embeds: [embed] };
        webhookQueue.current.push({ webhookURL, message });
        if (!isWebhookProcessing.current) {
            processWebhookQueue();
        }
    }, [processWebhookQueue, getStationAddress]);

    const overlayStyles = {
        PHMC: {
            name: { position: 'absolute', top: '23.44%', left: '2.75%', color: 'black', fontSize: '35px', pointerEvents: 'none', cursor: 'default', whiteSpace: 'nowrap', fontFamily: 'LufgaMedium, Arial, sans-serif' },
            rank: { position: 'absolute', top: '31.92%', left: '3.31%', color: '#cb1212', fontSize: '15px', cursor: 'default', pointerEvents: 'none', whiteSpace: 'nowrap', fontFamily: 'LufgaMedium, Arial, sans-serif' },
            phoneNumber: { position: 'absolute', top: '53.03%', left: '12.06%', color: 'black', fontSize: '15px', cursor: 'default', pointerEvents: 'none', whiteSpace: 'nowrap', fontFamily: 'LufgaMedium, Arial, sans-serif' }
        },
        LSFD: {
            name: { position: 'absolute', top: '10.44%', left: '2.75%', color: 'BLACK', fontSize: '35px', pointerEvents: 'none', cursor: 'default', whiteSpace: 'nowrap', fontFamily: 'LufgaMedium, Arial, sans-serif' },
            rank: { position: 'absolute', top: '20.0%', left: '2.75%', color: 'white', fontSize: '19px', cursor: 'default', pointerEvents: 'none', whiteSpace: 'nowrap', fontFamily: 'LufgaMedium, Arial, sans-serif' },
            stationAssigned: { position: 'absolute', top: '76.50%', left: '11.3%', color: 'black', fontSize: '15px', cursor: 'default', pointerEvents: 'none', whiteSpace: 'nowrap', fontFamily: 'LufgaMedium, Arial, sans-serif' },
            stationAddress: { position: 'absolute', top: '79.50%', left: '11.3%', color: 'black', fontSize: '12px', cursor: 'default', pointerEvents: 'none', whiteSpace: 'nowrap', fontFamily: 'LufgaMedium, Arial, sans-serif' },
            phoneNumber: { position: 'absolute', top: '55.99%', left: '11.3%', color: 'black', fontSize: '15px', cursor: 'default', pointerEvents: 'none', whiteSpace: 'nowrap', fontFamily: 'LufgaMedium, Arial, sans-serif' }
        }
    };

    const currentOverlayStyles = overlayStyles[businessCardType];
    const currentImage = businessCardType === 'PHMC' ? BusinessCardImage : LSFD_BusinessCardImage;

    const handleSave = useCallback(async () => {
        setIsSaving(true);
        showNotification('Processing Business Card...', 'upload');

        localStorage.setItem('name', name);
        localStorage.setItem('rank', rank);
        localStorage.setItem('phoneNumber', phoneNumber);
        localStorage.setItem('stationAssigned', stationAssigned);
        localStorage.setItem('businessCardType', businessCardType);

        const cardImageActualWidth = 750;
        const cardImageActualHeight = 440;

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
            const baseImage = await loadImage(currentImage);
            if (document.fonts && typeof document.fonts.ready === 'function') {
                await document.fonts.ready;
            }

            ctx.drawImage(baseImage, 0, 0, cardImageActualWidth, cardImageActualHeight);
            ctx.textBaseline = 'top';

            const nameX = cardImageActualWidth * (parseFloat(currentOverlayStyles.name.left) / 100);
            const nameY = cardImageActualHeight * (parseFloat(currentOverlayStyles.name.top) / 100);
            const nameFontSize = parseInt(currentOverlayStyles.name.fontSize);
            ctx.fillStyle = currentOverlayStyles.name.color;
            ctx.font = `${nameFontSize}px ${currentOverlayStyles.name.fontFamily || 'sans-serif'}`;
            ctx.fillText(name, nameX, nameY);

            const rankX = cardImageActualWidth * (parseFloat(currentOverlayStyles.rank.left) / 100);
            const rankY = cardImageActualHeight * (parseFloat(currentOverlayStyles.rank.top) / 100);
            const rankFontSize = parseInt(currentOverlayStyles.rank.fontSize);
            ctx.fillStyle = currentOverlayStyles.rank.color;
            ctx.font = `${rankFontSize}px ${currentOverlayStyles.rank.fontFamily || 'sans-serif'}`;
            ctx.fillText(rank, rankX, rankY);

            if (businessCardType === 'LSFD' && currentOverlayStyles.stationAssigned) {
                const stationX = cardImageActualWidth * (parseFloat(currentOverlayStyles.stationAssigned.left) / 100);
                const stationY = cardImageActualHeight * (parseFloat(currentOverlayStyles.stationAssigned.top) / 100);
                const stationFontSize = parseInt(currentOverlayStyles.stationAssigned.fontSize);
                ctx.fillStyle = currentOverlayStyles.stationAssigned.color;
                ctx.font = `${stationFontSize}px ${currentOverlayStyles.stationAssigned.fontFamily || 'sans-serif'}`;
                ctx.fillText(stationAssigned, stationX, stationY);

                if (currentOverlayStyles.stationAddress && stationAssigned) {
                    const addressX = cardImageActualWidth * (parseFloat(currentOverlayStyles.stationAddress.left) / 100);
                    const addressY = cardImageActualHeight * (parseFloat(currentOverlayStyles.stationAddress.top) / 100);
                    const addressFontSize = parseInt(currentOverlayStyles.stationAddress.fontSize);
                    ctx.fillStyle = currentOverlayStyles.stationAddress.color;
                    ctx.font = `${addressFontSize}px ${currentOverlayStyles.stationAddress.fontFamily || 'sans-serif'}`;
                    ctx.fillText(getStationAddress(stationAssigned), addressX, addressY);
                }
            }

            const phoneX = cardImageActualWidth * (parseFloat(currentOverlayStyles.phoneNumber.left) / 100);
            const phoneY = cardImageActualHeight * (parseFloat(currentOverlayStyles.phoneNumber.top) / 100);
            const phoneFontSize = parseInt(currentOverlayStyles.phoneNumber.fontSize);
            ctx.fillStyle = currentOverlayStyles.phoneNumber.color;
            ctx.font = `${phoneFontSize}px ${currentOverlayStyles.phoneNumber.fontFamily || 'sans-serif'}`;
            ctx.fillText(phoneNumber, phoneX, phoneY);

            const dataUrl = canvas.toDataURL('image/png');

            showNotification('Uploading...', 'upload');
            const link = await handleImageUpload(dataUrl);
            console.log('Image upload result:', { link, type: typeof link });

            setImageUrl(link);
            showNotification(`Business Card Saved & Uploaded: ${link}`, 'save');

            sendDiscordWebhook(name, rank, phoneNumber, link, null, businessCardType, stationAssigned);

            await copyToClipboard(link, showNotification, 'Image link copied to clipboard!');
        } catch (error) {
            console.error('Error in Business Card handleSave:', error);
            let errorContext = 'Error generating business card';
            let detailedMessage = error.message || String(error);

            if (detailedMessage.includes('upload failed')) errorContext = 'Upload Failed';
            else if (detailedMessage.includes('Failed to load base image')) errorContext = 'Base Image Load Failed';
            else errorContext = 'Image Generation Failed';

            showNotification(`${errorContext}: ${detailedMessage.substring(0, 100)}...`, 'error');
            Sentry.captureException(error, { extra: { context: 'Business Card Save', name, rank, detailedMessage } });

            sendDiscordWebhook(name, rank, phoneNumber, null, `${errorContext}: ${detailedMessage}`, businessCardType, stationAssigned);
        } finally {
            setIsSaving(false);
        }
    }, [name, rank, phoneNumber, stationAssigned, businessCardType, showNotification, handleImageUpload, sendDiscordWebhook, commitInfo, currentOverlayStyles, currentImage, getStationAddress]);

    if (!show) {
        return null;
    }

    return (
        <div className="modal-overlay">
            <div className="business-card-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h4>Business Card</h4>
                    <button
                        type="button"
                        className="modal-close-btn"
                        onClick={onHide}
                        aria-label="Close"
                    >
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div className="business-card-content">
                    <div className="business-card-type-selector">
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <Form.Check
                                type="radio"
                                label="PHMC"
                                name="businessCardType"
                                value="PHMC"
                                checked={businessCardType === 'PHMC'}
                                onChange={(e) => setBusinessCardType(e.target.value)}
                                inline
                            />
                            <Form.Check
                                type="radio"
                                label="LSFD"
                                name="businessCardType"
                                value="LSFD"
                                checked={businessCardType === 'LSFD'}
                                onChange={(e) => setBusinessCardType(e.target.value)}
                                inline
                            />
                        </div>
                    </div>
                    {imageUrl && (
                        <div className="image-link-container">
                            <p>
                                <strong>Image Link: </strong>
                                <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                                    {imageUrl}
                                </a>
                            </p>
                            Instructions!
                            <br />
                            1) /note [id of the blank note item in your inventory] [amount] NAME [name for the cards]
                            <br />
                            2) /note [id of the new note item in your inventory] [amount] CONTENT {imageUrl}
                        </div>
                    )}
                    <div className="business-card-image-container">
                        <img
                            src={currentImage}
                            alt="Business Card Preview"
                        />
                        <div className="name-overlay" style={currentOverlayStyles.name}>{name}</div>
                        <div className="rank-overlay" style={currentOverlayStyles.rank}>{rank}</div>
                        {businessCardType === 'LSFD' && (
                            <>
                                <div className="station-assigned-overlay" style={currentOverlayStyles.stationAssigned}>{stationAssigned}</div>
                                {stationAssigned && (
                                    <div className="station-address-overlay" style={currentOverlayStyles.stationAddress}>{getStationAddress(stationAssigned)}</div>
                                )}
                            </>
                        )}
                        <div className="phone-number-overlay" style={currentOverlayStyles.phoneNumber}>{phoneNumber}</div>
                    </div>
                    <div className="business-card-input-fields">
                        <Form.Control className="mb-2" type="text" placeholder="Name" value={name} onChange={handleNameChange} />
                        <Form.Control className="mb-2" type="text" placeholder="Rank" value={rank} onChange={handleRankChange} />
                        {businessCardType === 'LSFD' && (
                            <>
                                <Form.Select
                                    className="mb-2"
                                    value={stationAssigned}
                                    onChange={handleStationAssignedChange}
                                    aria-label="Select Station"
                                >
                                    <option value="">Select Station</option>
                                    {Object.keys(lsfdStations).map(station => (
                                        <option key={station} value={station}>{station}</option>
                                    ))}
                                </Form.Select>
                            </>
                        )}
                        <Form.Control className="mb-2" type="text" placeholder="Phone Number" value={phoneNumber} onChange={handlePhoneNumberChange} />
                    </div>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save & Upload Business Card'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default BusinessCardModal;
