import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Form, Button } from 'react-bootstrap';
import * as Sentry from "@sentry/react";
import BusinessCardImage from '../../assets/business-card.png';
import '../Modals/BusinessCard.css';
import BaseModal from '../Modals/BaseModal';

const copyToClipboard = async (text, showNotification, message) => {
  try {
    await navigator.clipboard.writeText(text);
    if (showNotification && message) {
      showNotification(message, 'success');
    }
  } catch (err) {
    console.error('Failed to copy text: ', err);
    if (showNotification) {
      showNotification('Failed to copy to clipboard', 'error');
    }
  }
};

const overlayStyles = {
  name: { position: 'absolute', top: '23.44%', left: '2.75%', color: 'black', fontSize: '35px', pointerEvents: 'none', cursor: 'default', whiteSpace: 'nowrap', fontFamily: 'LufgaMedium, Arial, sans-serif' },
  rank: { position: 'absolute', top: '31.92%', left: '3.31%', color: '#cb1212', fontSize: '15px', cursor: 'default', pointerEvents: 'none', whiteSpace: 'nowrap', fontFamily: 'LufgaMedium, Arial, sans-serif' },
  phoneNumber: { position: 'absolute', top: '52.77%', left: '12.56%', color: 'black', fontSize: '15px', cursor: 'default', pointerEvents: 'none', whiteSpace: 'nowrap', fontFamily: 'LufgaMedium, Arial, sans-serif' }
};

const isDevHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname.startsWith('192.'));

const BusinessCardModal = ({ show, onHide, showNotification, commitInfo, handleImageUpload, defaultName = '', defaultRank = '', swappableCharacters = [], onSwapCharacter = null, canSwapCharacters = false }) => {
  const [name, setName] = useState('');
  const [rank, setRank] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showCharList, setShowCharList] = useState(false);
  const [devPair, setDevPair] = useState(0);
  const [debug, setDebug] = useState(() => (isDevHost ? localStorage.getItem('phmc_bizcard_debug') === '1' : false));

  // Localhost-only: cycle two dummy name/rank pairs to test the card layout.
  const toggleDevPair = () => {
    setDevPair(prev => {
      const next = prev === 0 ? 1 : 0;
      setName(next === 0 ? 'Dev Name 1' : 'Dev Name 2');
      setRank(next === 0 ? 'Dev Rank 1' : 'Dev Rank 2');
      return next;
    });
  };

  const toggleDebug = () => {
    setDebug(prev => {
      const next = !prev;
      localStorage.setItem('phmc_bizcard_debug', next ? '1' : '0');
      return next;
    });
  };

  // ── Debug mode: draggable overlay boxes + live coordinate readout ──
  const containerRef = useRef(null);
  const draggingRef = useRef(null);

  const [overlayPos, setOverlayPos] = useState({
    name: { top: parseFloat(overlayStyles.name.top), left: parseFloat(overlayStyles.name.left) },
    rank: { top: parseFloat(overlayStyles.rank.top), left: parseFloat(overlayStyles.rank.left) },
    phoneNumber: { top: parseFloat(overlayStyles.phoneNumber.top), left: parseFloat(overlayStyles.phoneNumber.left) },
  });

  const onPointerMove = useCallback((e) => {
    const d = draggingRef.current;
    if (!d) return;
    const dxPct = ((e.clientX - d.startX) / d.width) * 100;
    const dyPct = ((e.clientY - d.startY) / d.height) * 100;
    setOverlayPos(prev => ({
      ...prev,
      [d.field]: {
        top: Math.max(0, Math.min(100, d.startTop + dyPct)),
        left: Math.max(0, Math.min(100, d.startLeft + dxPct)),
      },
    }));
  }, []);

  const onPointerUp = useCallback(() => {
    draggingRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }, [onPointerMove]);

  const startDrag = (field) => (e) => {
    if (!debug) return;
    e.preventDefault();
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    draggingRef.current = {
      field,
      startX: e.clientX,
      startY: e.clientY,
      startTop: overlayPos[field].top,
      startLeft: overlayPos[field].left,
      width: rect.width,
      height: rect.height,
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  useEffect(() => () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }, [onPointerMove, onPointerUp]);

  // Debug: overlay uses the dragged position + visible box. Off: the real styles.
  const overlayStyle = (field, base) => {
    if (!debug) return base;
    const pos = overlayPos[field];
    return {
      ...base,
      top: `${pos.top}%`,
      left: `${pos.left}%`,
      pointerEvents: 'auto',
      cursor: 'move',
      touchAction: 'none',
      outline: '1px dashed #ff3b3b',
      background: 'rgba(255,59,59,0.12)',
    };
  };

  const webhookQueue = useRef([]);
  const isWebhookProcessing = useRef(false);
  const lastWebhookCallTimestamp = useRef(0);
  const webhookRateLimitDelay = 1100;

  useEffect(() => {
    if (show) {
      // Prefer OAuth credentials (character name / rank) over any stored values.
      setName(defaultName || localStorage.getItem('name') || '');
      setRank(defaultRank || localStorage.getItem('rank') || '');
      setPhoneNumber(localStorage.getItem('phoneNumber') || '');
      setImageUrl(null);
    }
  }, [show, defaultName, defaultRank]);

  const handleNameChange = (e) => setName(e.target.value);
  const handleRankChange = (e) => setRank(e.target.value);
  const handlePhoneNumberChange = (e) => setPhoneNumber(e.target.value);

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

  const sendDiscordWebhook = useCallback(async (cardName, cardRank, cardPhoneNumber, generatedImageUrl, errorMessage = null) => {
    const webhookURL = import.meta.env.VITE_DEV_WEBHOOK;
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
        { name: "Employee Name", value: cardName || "N/A", inline: true },
        { name: "Employee Rank", value: cardRank || "N/A", inline: true },
        { name: "Phone Number", value: cardPhoneNumber || "N/A", inline: true }
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
  }, [processWebhookQueue]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    showNotification('Processing Business Card...', 'upload');

    localStorage.setItem('name', name);
    localStorage.setItem('rank', rank);
    localStorage.setItem('phoneNumber', phoneNumber);

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
      const baseImage = await loadImage(BusinessCardImage);
      if (document.fonts && typeof document.fonts.ready === 'function') {
        await document.fonts.ready;
      }

      ctx.drawImage(baseImage, 0, 0, cardImageActualWidth, cardImageActualHeight);
      ctx.textBaseline = 'top';

      const nameX = cardImageActualWidth * (parseFloat(overlayStyles.name.left) / 100);
      const nameY = cardImageActualHeight * (parseFloat(overlayStyles.name.top) / 100);
      const nameFontSize = parseInt(overlayStyles.name.fontSize);
      ctx.fillStyle = overlayStyles.name.color;
      ctx.font = `${nameFontSize}px ${overlayStyles.name.fontFamily || 'sans-serif'}`;
      ctx.fillText(name, nameX, nameY);

      const rankX = cardImageActualWidth * (parseFloat(overlayStyles.rank.left) / 100);
      const rankY = cardImageActualHeight * (parseFloat(overlayStyles.rank.top) / 100);
      const rankFontSize = parseInt(overlayStyles.rank.fontSize);
      ctx.fillStyle = overlayStyles.rank.color;
      ctx.font = `${rankFontSize}px ${overlayStyles.rank.fontFamily || 'sans-serif'}`;
      ctx.fillText(rank, rankX, rankY);

      const phoneX = cardImageActualWidth * (parseFloat(overlayStyles.phoneNumber.left) / 100);
      const phoneY = cardImageActualHeight * (parseFloat(overlayStyles.phoneNumber.top) / 100);
      const phoneFontSize = parseInt(overlayStyles.phoneNumber.fontSize);
      ctx.fillStyle = overlayStyles.phoneNumber.color;
      ctx.font = `${phoneFontSize}px ${overlayStyles.phoneNumber.fontFamily || 'sans-serif'}`;
      ctx.fillText(phoneNumber, phoneX, phoneY);

      const dataUrl = canvas.toDataURL('image/png');

      showNotification('Uploading...', 'upload');
      const link = await handleImageUpload(dataUrl);
      console.log('Image upload result:', { link, type: typeof link });

      setImageUrl(link);
      showNotification(`Business Card Saved & Uploaded: ${link}`, 'save');

      sendDiscordWebhook(name, rank, phoneNumber, link);

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

      sendDiscordWebhook(name, rank, phoneNumber, null, `${errorContext}: ${detailedMessage}`);
    } finally {
      setIsSaving(false);
    }
  }, [name, rank, phoneNumber, showNotification, handleImageUpload, sendDiscordWebhook, commitInfo]);

  return (
    <BaseModal
      isOpen={show}
      onClose={onHide}
      title="Business Card"
      modalSize="full"
      variant="info"
    >
      <div className="business-card-content">
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
        <div className="business-card-image-container" ref={containerRef}>
          <img
            src={BusinessCardImage}
            alt="Business Card Preview"
          />
          <div className="name-overlay" style={overlayStyle('name', overlayStyles.name)} onPointerDown={startDrag('name')}>{name}</div>
          <div className="rank-overlay" style={overlayStyle('rank', overlayStyles.rank)} onPointerDown={startDrag('rank')}>{rank}</div>
          <div className="phone-number-overlay" style={overlayStyle('phoneNumber', overlayStyles.phoneNumber)} onPointerDown={startDrag('phoneNumber')}>{phoneNumber}</div>
        </div>
        {debug && (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: '#0f172a', border: '1px solid #334155', fontFamily: 'monospace', fontSize: 12 }}>
            {['name', 'rank', 'phoneNumber'].map(f => {
              const p = overlayPos[f];
              const fs = overlayStyles[f].fontSize;
              return (
                <div key={f} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '2px 0' }}>
                  <span style={{ color: '#94a3b8', textTransform: 'capitalize' }}>{f}</span>
                  <span style={{ color: '#e2e8f0' }}>top: {p.top.toFixed(2)}% · left: {p.left.toFixed(2)}% · font: {fs}</span>
                </div>
              );
            })}
            <div style={{ color: '#64748b', marginTop: 6 }}>Drag the boxes on the card — copy these values into overlayStyles.</div>
          </div>
        )}
        <div className="business-card-input-fields">
          <div style={{ display: 'flex', gap: 8 }}>
            <Form.Control type="text" placeholder="Name" value={name} onChange={handleNameChange} style={{ marginBottom: 0 }} />
            <Form.Control type="text" placeholder="Rank" value={rank} onChange={handleRankChange} style={{ marginBottom: 0 }} />
          </div>
          <div style={{ position: 'relative', display: 'flex', gap: 8, marginTop: 8 }}>
            <Form.Control type="text" placeholder="Phone Number" value={phoneNumber} onChange={handlePhoneNumberChange} style={{ flex: 1, marginBottom: 0 }} />
            {canSwapCharacters && swappableCharacters.length > 0 && (
              <>
                <Button variant="outline-secondary" onClick={() => setShowCharList(v => !v)} style={{ flexShrink: 0 }}>
                  <i className="fas fa-exchange-alt me-1" /> Switch Character
                </Button>
                {showCharList && (
                  <div style={{
                    position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 6,
                    background: '#121A2C', border: '1px solid #324467', borderRadius: 10,
                    boxShadow: '0 12px 40px rgba(0,0,0,0.5)', overflow: 'hidden', zIndex: 100,
                  }}>
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid #25324D', fontSize: 10.5, fontWeight: 700, color: '#8B96AE', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Switch Character
                    </div>
                    {swappableCharacters.map(c => (
                      <div key={c.id}
                        onClick={() => { onSwapCharacter?.(c); setShowCharList(false); }}
                        style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #25324D', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#182238'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#182238', color: '#E7ECF5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                          {c.characterName?.charAt(0) || '?'}
                        </div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#E7ECF5' }}>{c.characterName}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {isDevHost && (
              <>
                <Button variant="outline-secondary" onClick={toggleDevPair} style={{ flexShrink: 0 }}>
                  <i className="fas fa-user-edit me-1" />Dev: {devPair === 0 ? 'Name 1' : 'Name 2'}
                </Button>
                <Button variant="outline-secondary" onClick={toggleDebug} style={{ flexShrink: 0 }}>
                  {debug ? 'Hide Debug' : 'Debug Layout'}
                </Button>
              </>
            )}
            <Button onClick={handleSave} disabled={isSaving} style={{ flex: 1 }}>
              {isSaving ? 'Saving...' : 'Save & Upload Business Card'}
            </Button>
          </div>
        </div>
      </div>
    </BaseModal>
  );
};

export default BusinessCardModal;
