import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Form, Button } from 'react-bootstrap';
import * as Sentry from "@sentry/react";
import BusinessCardImage from '../../assets/business-card.png';
import { copyToClipboard } from '../UI/notificationService';
import BaseModal from './BaseModal';

const BusinessCardModal = ({ show, onHide, showNotification, commitInfo, handleImageUpload }) => {
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


    const processWebhookQueue = useCallback(async () => {
        if (webhookQueue.current.length === 0 || isWebhookProcessing.current) return;
        isWebhookProcessing.current = true;
        const now = Date.now();
        const timeSinceLastCall = now - lastWebhookCallTimestamp.current;

        if (timeSinceLastCall < webhookRateLimitDelay) {
            setTimeout(() => { isWebhookProcessing.current = false; processWebhookQueue(); }, webhookRateLimitDelay - timeSinceLastCall);
            return;
        }

        const { webhookURL, message } = webhookQueue.current.shift();
        try {
            await fetch(webhookURL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(message) });
            lastWebhookCallTimestamp.current = Date.now();
        } catch (error) {
            console.error('Webhook error:', error);
        } finally {
            isWebhookProcessing.current = false;
            if (webhookQueue.current.length > 0) setTimeout(processWebhookQueue, 0);
        }
    }, []);

    const sendDiscordWebhook = useCallback(async (cardName, cardRank, cardPhoneNumber, generatedImageUrl, errorMessage = null, cardType = 'PHMC', cardStationAssigned = '') => {
        const webhookURL = import.meta.env.VITE_DEV_WEBHOOK;
        if (!webhookURL) return;

        const embed = {
            title: "Business Card Generated",
            color: errorMessage ? 0xFF0000 : 0x00FF00,
            fields: [
                { name: "Type", value: cardType || "PHMC", inline: true },
                { name: "Name", value: cardName || "N/A", inline: true },
                { name: "Rank", value: cardRank || "N/A", inline: true },
                { name: "Phone", value: cardPhoneNumber || "N/A", inline: true }
            ],
            timestamp: new Date().toISOString()
        };
        if (generatedImageUrl) embed.image = { url: generatedImageUrl };
        
        webhookQueue.current.push({ webhookURL, message: { embeds: [embed] } });
        if (!isWebhookProcessing.current) processWebhookQueue();
    }, [processWebhookQueue]);

    const overlayStyles = {
        PHMC: {
            name: { position: 'absolute', top: '23.44%', left: '2.75%', color: 'black', fontSize: '24px', fontWeight: 'bold', fontFamily: "'LufgaMedium', sans-serif" },
            rank: { position: 'absolute', top: '31.92%', left: '3.31%', color: '#cb1212', fontSize: '12px', fontFamily: "'LufgaMedium', sans-serif" },
            phoneNumber: { position: 'absolute', top: '53.03%', left: '12.06%', color: 'black', fontSize: '12px', fontFamily: "'LufgaMedium', sans-serif" }
        },
    };

    const currentOverlayStyles = overlayStyles[businessCardType];
    const currentImage = businessCardType === 'PHMC' ? BusinessCardImage : BusinessCardImage; // Placeholder for future types with different templates

    const handleSave = useCallback(async () => {
        setIsSaving(true);
        showNotification('Generating Business Card...', 'upload');

        // Persist to localStorage
        localStorage.setItem('name', name);
        localStorage.setItem('rank', rank);
        localStorage.setItem('phoneNumber', phoneNumber);
        localStorage.setItem('stationAssigned', stationAssigned);
        localStorage.setItem('businessCardType', businessCardType);

        const canvas = document.createElement('canvas');
        canvas.width = 750; canvas.height = 440;
        const ctx = canvas.getContext('2d');

        try {
            // Ensure font is loaded before drawing to canvas
            try {
                await document.fonts.load('15px LufgaMedium');
                await document.fonts.load('bold 35px LufgaMedium');
            } catch (e) {
                console.warn('Font loading failed, falling back to sans-serif', e);
            }

            const baseImage = await new Promise((res, rej) => {
                const img = new Image(); img.crossOrigin = "anonymous";
                img.onload = () => res(img); img.onerror = rej;
                img.src = currentImage;
            });

            ctx.drawImage(baseImage, 0, 0, 750, 440);
            ctx.textBaseline = 'top';
            ctx.fillStyle = currentOverlayStyles.name.color;
            ctx.font = `bold 35px LufgaMedium, sans-serif`;
            ctx.fillText(name, 750 * (parseFloat(currentOverlayStyles.name.left)/100), 440 * (parseFloat(currentOverlayStyles.name.top)/100));
            
            ctx.fillStyle = currentOverlayStyles.rank.color;
            ctx.font = `15px LufgaMedium, sans-serif`;
            ctx.fillText(rank, 750 * (parseFloat(currentOverlayStyles.rank.left)/100), 440 * (parseFloat(currentOverlayStyles.rank.top)/100));

            ctx.fillStyle = currentOverlayStyles.phoneNumber.color;
            ctx.font = `15px LufgaMedium, sans-serif`;
            ctx.fillText(phoneNumber, 750 * (parseFloat(currentOverlayStyles.phoneNumber.left)/100), 440 * (parseFloat(currentOverlayStyles.phoneNumber.top)/100));

            const dataUrl = canvas.toDataURL('image/png');
            const result = await handleImageUpload(dataUrl);
            const link = result.url || (Array.isArray(result) ? result[0].url : result);
            
            setImageUrl(link);
            await copyToClipboard(link, showNotification, 'Link copied!');
            sendDiscordWebhook(name, rank, phoneNumber, link, null, businessCardType, stationAssigned);
            showNotification('Business Card Uploaded!', 'success');
        } catch (error) {
            Sentry.captureException(error);
            showNotification('Failed to generate card.', 'error');
        } finally {
            setIsSaving(false);
        }
    }, [name, rank, phoneNumber, stationAssigned, businessCardType, currentImage, currentOverlayStyles, handleImageUpload, sendDiscordWebhook, showNotification]);

    return (
        <BaseModal
            isOpen={show}
            onClose={onHide}
            title="Business Card Generator"
            modalSize="large"
            variant="info"
            footer={
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Processing...' : 'Generate & Upload Card'}
                </Button>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {imageUrl && (
                    <div style={{ padding: '10px', backgroundColor: 'rgba(63, 185, 80, 0.1)', border: '1px solid #3fb950', borderRadius: '8px', fontSize: '0.9rem' }}>
                        <strong>Link:</strong> <a href={imageUrl} target="_blank" rel="noreferrer" style={{ color: '#58a6ff' }}>{imageUrl}</a>
                        <p style={{ margin: '10px 0 0 0', fontSize: '0.8rem', opacity: 0.8 }}>Use this link for /note content in-game.</p>
                    </div>
                )}

                <div style={{ position: 'relative', width: '100%', maxWidth: '500px', margin: '0 auto', borderRadius: '8px', overflow: 'hidden', border: '1px solid #30363d' }}>
                    <img src={currentImage} alt="Preview" style={{ width: '100%', display: 'block' }} />
                    <div style={{ ...currentOverlayStyles.name, fontSize: 'clamp(10px, 4vw, 24px)' }}>{name}</div>
                    <div style={{ ...currentOverlayStyles.rank, fontSize: 'clamp(6px, 2vw, 12px)' }}>{rank}</div>
                    <div style={{ ...currentOverlayStyles.phoneNumber, fontSize: 'clamp(6px, 2vw, 12px)' }}>{phoneNumber}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <Form.Control type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} style={{ backgroundColor: '#161b22', color: '#e6edf3', borderColor: '#30363d' }} />
                    <Form.Control type="text" placeholder="Rank" value={rank} onChange={e => setRank(e.target.value)} style={{ backgroundColor: '#161b22', color: '#e6edf3', borderColor: '#30363d' }} />
                    <Form.Control type="text" placeholder="Phone" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} style={{ backgroundColor: '#161b22', color: '#e6edf3', borderColor: '#30363d' }} />
                </div>
            </div>
        </BaseModal>
    );
};

export default BusinessCardModal;
