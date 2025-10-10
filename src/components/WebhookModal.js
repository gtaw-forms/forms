import React, { useState, useEffect } from 'react';
import * as Sentry from "@sentry/react";
import BaseModal from './BaseModal';
import './WebhookModal.css';
// Remove inline styles as they're now in WebhookModal.css

// --- End Styles ---

const LS_WEBHOOK_TITLE_CONTENT = 'webhookModal_title_content';
const LS_WEBHOOK_TITLE_TIMESTAMP = 'webhookModal_title_timestamp';
const LS_WEBHOOK_MESSAGE_CONTENT = 'webhookModal_message_content';
const LS_WEBHOOK_MESSAGE_TIMESTAMP = 'webhookModal_message_timestamp';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const FORM_GENERATOR_URL = "https://phmc-tools.gta.world/";
const ALTERNATIVE_FORM_GENERATOR_URL = "https://gtaw-forms.github.io/forms/";

const WebhookModal = ({
    show,
    onClose,
    webhookTitle,
    setWebhookTitle,
    webhookMessage,
    setWebhookMessage,
    onSubmit, // Renamed from handleWebhookSubmit for clarity in App.js
    onSubmitPhmc, // Renamed from handlePhmcWebhookSubmit for clarity in App.js
    showNotification,
    commitInfo,
    modalHeaderText = "Send Webhook Embed", // More generic default
    primaryButtonText = "Send to Primary Hook",
    primaryWebhookUrlIdentifier = "N/A", // To display which REACT_APP_ variable is used
    secondaryButtonText = "Send to Secondary Hook",
    secondaryWebhookUrlIdentifier = "N/A", // To display which REACT_APP_ variable is used
    showSecondaryButton = true, // Prop to control visibility of the second button
    handleImageUpload
}) => {
    const [mediaUrls, setMediaUrls] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [urlInput, setUrlInput] = useState('');
    const phmcLogoUrl = 'https://i.ibb.co/0pgw9hHm/phmc.png';

    useEffect(() => {
        if (show) {
                setShowConfirmation(false);
                setConfirmationAction(null);

            const savedTitle = localStorage.getItem(LS_WEBHOOK_TITLE_CONTENT);
            const savedTitleTs = localStorage.getItem(LS_WEBHOOK_TITLE_TIMESTAMP);
            if (savedTitle && savedTitleTs && (Date.now() - parseInt(savedTitleTs, 10) < ONE_DAY_MS)) {
                setWebhookTitle(savedTitle);
            } else {
                localStorage.removeItem(LS_WEBHOOK_TITLE_CONTENT);
                localStorage.removeItem(LS_WEBHOOK_TITLE_TIMESTAMP);
            }

            const savedMessage = localStorage.getItem(LS_WEBHOOK_MESSAGE_CONTENT);
            const savedMessageTs = localStorage.getItem(LS_WEBHOOK_MESSAGE_TIMESTAMP);
            if (savedMessage && savedMessageTs && (Date.now() - parseInt(savedMessageTs, 10) < ONE_DAY_MS)) {
                setWebhookMessage(savedMessage);
            } else {
                localStorage.removeItem(LS_WEBHOOK_MESSAGE_CONTENT);
                localStorage.removeItem(LS_WEBHOOK_MESSAGE_TIMESTAMP);
            }
        }
    }, [show, setWebhookTitle, setWebhookMessage]);

    useEffect(() => {
        if (show && typeof webhookTitle === 'string') {
            localStorage.setItem(LS_WEBHOOK_TITLE_CONTENT, webhookTitle);
            localStorage.setItem(LS_WEBHOOK_TITLE_TIMESTAMP, Date.now().toString());
        }
    }, [webhookTitle, show]);

    useEffect(() => {
        if (show && typeof webhookMessage === 'string') {
            localStorage.setItem(LS_WEBHOOK_MESSAGE_CONTENT, webhookMessage);
            localStorage.setItem(LS_WEBHOOK_MESSAGE_TIMESTAMP, Date.now().toString());
        }
    }, [webhookMessage, show]);

    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmationAction, setConfirmationAction] = useState(null); // { type: 'primary' | 'secondary', payload: object, identifier: string }

    const handleLocalImageUpload = async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        setIsUploading(true);
        
        try {
            // The handleImageUpload prop is expected to be the function from MainApp
            const uploadedUrls = await handleImageUpload(event); 
            
            if (uploadedUrls && uploadedUrls.length > 0) {
                setMediaUrls(prevUrls => [...prevUrls, ...uploadedUrls]);
                showNotification(`${uploadedUrls.length} image(s) uploaded successfully!`, 'check-circle');
            } else {
                showNotification('Image upload returned no URLs.', 'warning');
            }
        } catch (error) {
            console.error('Error during image upload in WebhookModal:', error);
            Sentry.captureException(error, { extra: { context: 'WebhookModal handleLocalImageUpload' } });
            showNotification('An unexpected error occurred during upload.', 'exclamation-circle');
        } finally {
            setIsUploading(false);
            // It's good practice to clear the file input after handling
            if(event.target) {
                event.target.value = null;
            }
        }
    };

    const handleAddUrl = () => {
        const urlToAdd = urlInput.trim();
        if (!urlToAdd) {
            showNotification('Please enter a URL.', 'warning');
            return;
        }
        if (!urlToAdd.startsWith('http://') && !urlToAdd.startsWith('https://')) {
            showNotification('Invalid URL format. Must start with http:// or https://', 'warning');
            return;
        }
        if (mediaUrls.includes(urlToAdd)) {
            showNotification('This URL has already been added.', 'info-circle');
            return;
        }
        setMediaUrls(prevUrls => [...prevUrls, urlToAdd]);
        setUrlInput('');
        showNotification('URL added successfully!', 'check-circle');
    };

    const clearMedia = () => {
        setMediaUrls([]);
    };
    const isImageUrl = (url) => {
        return /\.(jpg|jpeg|png|gif)$/i.test(url) || url.includes('ibb.co');
    };
    const isStreamableUrl = (url) => {
        return url.includes('streamable.com');
    };

    const prepareWebhookDataInternal = () => {
        const title = webhookTitle.trim();
        const message = webhookMessage.trim();
        if (!title && !message && mediaUrls.length === 0) {
            showNotification('Please enter a title, message, or add media (image/URL).', 'warning');
            return null;
        }
        if (title.length > 256) {
            showNotification('Embed title cannot exceed 256 characters.', 'warning');
            return null;
        }
        let description = message || '';
        let firstImageUrlForEmbed = null;
        for (const url of mediaUrls) {
            if (isImageUrl(url)) {
                firstImageUrlForEmbed = url;
                break;
            }
        }
        const footerText = `PHMC Form Generator - v${commitInfo?.sha || 'N/A'} `;
        if (description.length > 4096) {
            showNotification('Embed body (message content) cannot exceed 4096 characters.', 'warning');
            return null;
        }
        const embedFields = [];
        if (FORM_GENERATOR_URL) {
            embedFields.push({ name: "[Delayed Updates] Form Generator Link", value: FORM_GENERATOR_URL, inline: false });
        }
        if (ALTERNATIVE_FORM_GENERATOR_URL) {
            embedFields.push({ name: "Alternative Form Generator Link", value: ALTERNATIVE_FORM_GENERATOR_URL, inline: false });
        }
        const embed = {
            title: title || "PHMC Form Generator Notification",
            url: FORM_GENERATOR_URL,
            description: description.trim() || undefined,
            color: 0x7289DA,
            timestamp: new Date().toISOString(),
            image: firstImageUrlForEmbed ? { url: firstImageUrlForEmbed } : undefined,
            fields: embedFields,
            footer: {
                text: footerText
            }
        };
        if (!message && !title && mediaUrls.length > 0) {
             embed.description = `Media submitted via PHMC Form Generator - v${commitInfo?.sha || 'N/A'}`;
             embed.description += '\n\n**Media:**\n';
             mediaUrls.forEach((url, index) => {
                 const type = isStreamableUrl(url) ? 'Video' : isImageUrl(url) ? 'Image' : 'Link';
                 embed.description += `- ${type} ${index + 1}: ${url}\n`;
             });
             if (embed.description.length > 4096) {
                showNotification('Embed body (including media links) cannot exceed 4096 characters.', 'warning');
                return null;
             }
        }
        const payload = {
            username: "PHMC",
            avatar_url: phmcLogoUrl,
            embeds: [embed],
        };
        return payload;
    };

    const handlePrimarySubmit = () => {
        const payload = prepareWebhookDataInternal();
        if (payload && onSubmit) {
            setConfirmationAction({ type: 'primary', payload, identifier: primaryWebhookUrlIdentifier });
            setShowConfirmation(true);
        }
    };

    const handleSecondarySubmit = () => {
        const payload = prepareWebhookDataInternal();
        if (payload && onSubmitPhmc) {
            setConfirmationAction({ type: 'secondary', payload, identifier: secondaryWebhookUrlIdentifier });
            setShowConfirmation(true);
        }
    };

    const executeConfirmedSend = () => {
        if (!confirmationAction) return;

        if (confirmationAction.type === 'primary' && onSubmit) {
            onSubmit(confirmationAction.payload);
        } else if (confirmationAction.type === 'secondary' && onSubmitPhmc) {
            onSubmitPhmc(confirmationAction.payload);
        }
        setShowConfirmation(false);
        setConfirmationAction(null);
    };

    const cancelSend = () => {
        setShowConfirmation(false);
        setConfirmationAction(null);
    };
    if (!show) {
        return null;
    }

    const titlePlaceholder = "Major Update / Minor Update / Hotfix";
    const messagePlaceholder = `- Added: \n- Fixed: \n- Updated: `;

    return (
        <BaseModal
            isOpen={show}
            onClose={onClose}
            title={modalHeaderText}
            modalSize="large"
            className="webhook-modal"
            closeOnOverlayClick={!showConfirmation}
        >
            <div className="webhook-content">
                {showConfirmation && confirmationAction && (
                    <div className="webhook-confirmation">
                        <p className="webhook-confirmation-text">
                            Confirm sending webhook to: <br />
                            PLEASE MAKE SURE THIS IS CORRECT BEFORE PROCEEDING!
                            <strong>{confirmationAction.identifier}</strong>
                        </p>
                        <div className="webhook-confirmation-buttons">
                            <button className="webhook-button webhook-button-secondary" onClick={cancelSend}>
                                Cancel
                            </button>
                            <button className="webhook-button webhook-button-primary" onClick={executeConfirmedSend}>
                                Confirm Send
                            </button>
                        </div>
                    </div>
                )}

                <fieldset disabled={showConfirmation}>
                    <div className="webhook-form">
                        <form className="webhook-form">
                            <div className="webhook-form-group">
                                <label className="webhook-form-label" htmlFor="webhookEmbedTitle">Embed Title</label>
                                <input
                                    type="text"
                                    id="webhookEmbedTitle"
                                    className="webhook-form-control"
                                    placeholder={titlePlaceholder}
                                    value={webhookTitle}
                                    onChange={(e) => setWebhookTitle(e.target.value)}
                                />
                            </div>
                            <div className="webhook-form-group">
                                <label className="webhook-form-label" htmlFor="webhookMessageTextarea">Embed Body</label>
                                <textarea
                                    id="webhookMessageTextarea"
                                    className="webhook-form-control"
                                    rows={4}
                                    placeholder={messagePlaceholder}
                                    value={webhookMessage}
                                    onChange={(e) => setWebhookMessage(e.target.value)}
                                />
                                <span className="webhook-form-text">
                                    Supports basic Markdown. Media links will be appended automatically if only media is provided.
                                </span>
                            </div>
                            <div className="webhook-form-group">
                                <label className="webhook-form-label" htmlFor="webhookUrlInput">Add Media URL (Image or Streamable)</label>
                                <div className="webhook-input-group">
                                    <input
                                        type="url"
                                        id="webhookUrlInput"
                                        className="webhook-form-control"
                                        placeholder="Paste Image or Streamable URL..."
                                        value={urlInput}
                                        onChange={(e) => setUrlInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddUrl(); } }}
                                    />
                                    <button type="button" className="webhook-button webhook-button-secondary" onClick={handleAddUrl}>
                                        <i className="fas fa-plus"></i> Add URL
                                    </button>
                                </div>
                            </div>
                            <div className="webhook-form-group">
                                <label className="webhook-form-label">Upload Image(s)</label>
                                <div className="webhook-input-group">
                                    <button
                                        type="button"
                                        className={`webhook-button webhook-button-primary ${isUploading ? 'disabled' : ''}`}
                                        disabled={isUploading}
                                        onClick={() => document.getElementById('webhook-image-input').click()}
                                    >
                                        <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                                        {isUploading ? ' Uploading...' : ' Upload Image(s)'}
                                    </button>
                                    <input
                                        id="webhook-image-input"
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        style={{ display: 'none' }}
                                        onChange={handleLocalImageUpload}
                                    />
                                </div>
                                <span className="webhook-form-text">
                                    Upload one or more images. Hosted by ImgBB.
                                </span>
                            </div>
                            {mediaUrls.length > 0 && (
                                <div className="webhook-form-group">
                                    <label className="webhook-form-label">Added Media ({mediaUrls.length})</label>
                                    <div className="webhook-media-preview">
                                        {mediaUrls.map((url, index) => (
                                            <div key={index} className="webhook-media-item">
                                                {isImageUrl(url) ? (
                                                    <img src={url} alt={`Preview ${index + 1}`} className="webhook-media-image" title={url} />
                                                ) : isStreamableUrl(url) ? (
                                                    <div className="webhook-media-link" title={url}>
                                                        <i className="fas fa-video webhook-media-icon"></i>
                                                        <span>Streamable Link</span>
                                                    </div>
                                                ) : (
                                                    <div className="webhook-media-link" title={url}>
                                                        <i className="fas fa-link webhook-media-icon"></i>
                                                        <span>External Link</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <button 
                                        type="button"
                                        className="webhook-button webhook-button-secondary"
                                        onClick={clearMedia}
                                        title="Clear All Media"
                                    >
                                        Clear All Media ({mediaUrls.length})
                                    </button>
                                </div>
                            )}
                        </form>
                    </div>
                    <div className="webhook-footer">
                        <div className="webhook-spacer"></div>
                        <button 
                            type="button" 
                            className="webhook-button webhook-button-secondary" 
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="webhook-button webhook-button-warning"
                            onClick={handlePrimarySubmit}
                            title={`Uses: ${primaryWebhookUrlIdentifier}`}
                        >
                            <i className="fas fa-vial"></i> {primaryButtonText}
                        </button>
                        {showSecondaryButton && (
                            <button
                                type="button"
                                className="webhook-button webhook-button-primary"
                                onClick={handleSecondarySubmit}
                                title={`Uses: ${secondaryWebhookUrlIdentifier}`}
                            >
                                <i className="fas fa-paper-plane"></i> {secondaryButtonText}
                            </button>
                        )}
                    </div>
                </fieldset>
            </div>
        </BaseModal>
    );
};

export default WebhookModal;
