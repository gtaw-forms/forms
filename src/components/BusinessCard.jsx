import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Form, Button } from 'react-bootstrap';
import * as Sentry from "@sentry/react";
import BusinessCardImage from '../assets/business-card.png';
import './BusinessCardModal.css';

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
  phoneNumber: { position: 'absolute', top: '63.25%', left: '12.06%', color: 'black', fontSize: '15px', cursor: 'default', pointerEvents: 'none', whiteSpace: 'nowrap', fontFamily: 'LufgaMedium, Arial, sans-serif' }
};

const BusinessCardModal = ({ show, onHide, showNotification, commitInfo, handleImageUpload }) => {
  const [name, setName] = useState('');
  const [rank, setRank] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const webhookQueue = useRef([]);
  const isWebhookProcessing = useRef(false);
  const lastWebhookCallTimestamp = useRef(0);
  const webhookRateLimitDelay = 1100;

  useEffect(() => {
    if (show) {
      setName(localStorage.getItem('name') || '');
      setRank(localStorage.getItem('rank') || '');
      setPhoneNumber(localStorage.getItem('phoneNumber') || '');
      setImageUrl(null);
    }
  }, [show]);

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
              src={BusinessCardImage}
              alt="Business Card Preview"
            />
            <div className="name-overlay" style={overlayStyles.name}>{name}</div>
            <div className="rank-overlay" style={overlayStyles.rank}>{rank}</div>
            <div className="phone-number-overlay" style={overlayStyles.phoneNumber}>{phoneNumber}</div>
          </div>
          <div className="business-card-input-fields">
            <Form.Control className="mb-2" type="text" placeholder="Name" value={name} onChange={handleNameChange} />
            <Form.Control className="mb-2" type="text" placeholder="Rank" value={rank} onChange={handleRankChange} />
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
