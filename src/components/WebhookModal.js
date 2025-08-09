import ReactDOM from 'react-dom';
import React, { useState, useEffect } from 'react';
import { Button, Form, InputGroup } from 'react-bootstrap';
import * as Sentry from "@sentry/react";

// --- Styles (unchanged) ---
const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1050,
};

const modalContentStyle = {
    backgroundColor: '#0d1117',
    color: '#c9d1d9',
    padding: '20px',
    borderRadius: '5px',
    width: '100%',
    maxWidth: '800px',
    maxHeight: '80vh',
    overflowY: 'auto',
    position: 'relative',
    border: '1px solid #30363d',
};

const modalHeaderStyle = {
    fontSize: '1.2em',
    fontWeight: 'bold',
    marginBottom: '15px',
    borderBottom: '1px solid #30363d',
    paddingBottom: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#c9d1d9',
};

const modalTitleStyle = {
    margin: 0,
};

const closeButtonStyle = {
    background: 'none',
    border: 'none',
    color: '#c9d1d9',
    fontSize: '24px',
    cursor: 'pointer',
    lineHeight: '1',
    padding: '0 5px',
};

const modalBodyStyle = {
    paddingTop: '10px',
};

const modalFooterStyle = {
    borderTop: '1px solid #30363d',
    paddingTop: '15px',
    marginTop: '20px',
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '10px',
};

const formControlStyle = {
    backgroundColor: '#0d1117',
    color: '#c9d1d9',
    borderColor: '#30363d',
    width: '100%',
};

const formLabelStyle = {
    color: '#c9d1d9',
    marginBottom: '8px',
    display: 'block',
};

const imagePreviewStyle = {
    maxWidth: '100px',
    maxHeight: '100px',
    marginTop: '10px',
    display: 'block',
    border: '1px solid #30363d',
    borderRadius: '4px',
};

const clearImageButtonStyle = {
    padding: '2px 6px',
    fontSize: '0.8em',
    backgroundColor: '#6e7681',
    color: '#ffffff',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
};

const imagePreviewContainerStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginTop: '10px',
};

const urlPreviewStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 8px',
    border: '1px solid #30363d',
    borderRadius: '4px',
    backgroundColor: '#161b22',
    fontSize: '0.9em',
    maxWidth: '250px',
};

const urlIconStyle = {
    color: '#8b949e',
};

const urlTextStyle = {
    color: '#c9d1d9',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
};

const confirmationDialogStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: '#161b22',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #444c56',
    zIndex: 1060,
    textAlign: 'center',
    boxShadow: '0 0 15px rgba(0,0,0,0.5)',
};

const confirmationTextStyle = {
    marginBottom: '15px',
    fontSize: '1.1em',
    color: '#e6edf3',
};

const confirmationButtonsStyle = {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
};

// --- End Styles ---

const LS_WEBHOOK_TITLE_CONTENT = 'webhookModal_title_content';
const LS_WEBHOOK_TITLE_TIMESTAMP = 'webhookModal_title_timestamp';
const LS_WEBHOOK_MESSAGE_CONTENT = 'webhookModal_message_content';
const LS_WEBHOOK_MESSAGE_TIMESTAMP = 'webhookModal_message_timestamp';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const FORM_GENERATOR_URL = "https://gtaw-forms.github.io/forms/";

const isImageUrl = (url) => {
    return /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(url);
};

const isVideoUrl = (url) => {
    return /\.(mp4)$/i.test(url);
};

const isVideoFile = (file) => {
    return file.type.startsWith('video/');
};

const WebhookModal = ({
    show,
    onClose,
    webhookTitle,
    setWebhookTitle,
    webhookMessage,
    setWebhookMessage,
    onSubmit,
    onSubmitPhmc,
    showNotification,
    commitInfo,
    modalHeaderText = "Send Webhook Embed",
    primaryButtonText = "Send to Primary Hook",
    primaryWebhookUrlIdentifier = "N/A",
    secondaryButtonText = "Send to Secondary Hook",
    secondaryWebhookUrlIdentifier = "N/A",
    showSecondaryButton = true,
}) => {
    const [mediaUrls, setMediaUrls] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [urlInput, setUrlInput] = useState('');
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmationAction, setConfirmationAction] = useState(null);
    const phmcLogoUrl = 'https://i.imgur.com/QMaz0OC.png';

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

    const uploadSingleMediaToImgur = async (file) => {
        const imgurAccessToken = process.env.REACT_APP_IMGUR_ACCESS_TOKEN;
        const imgurAlbumId = process.env.REACT_APP_IMGUR_ALBUM_ID;
        if (!imgurAccessToken || !imgurAlbumId) {
            throw new Error("Imgur API credentials not configured.");
        }
        if (isVideoFile(file) && file.size > 200 * 1024 * 1024) {
            throw new Error("Video file exceeds Imgur's 200 MB limit.");
        }
        const formData = new FormData();
        formData.append('image', file);
        formData.append('album', imgurAlbumId);
        formData.append('type', 'file');
        const response = await fetch('https://api.imgur.com/3/image', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${imgurAccessToken}` },
            body: formData,
        });
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.data.error || 'Unknown Imgur error');
        }
        return data.data.link;
    };

    const handleMediaUpload = async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        setIsUploading(true);
        const uploadPromises = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            uploadPromises.push(uploadSingleMediaToImgur(file));
        }
        try {
            const results = await Promise.allSettled(uploadPromises);
            const successfulUrls = [];
            let failedCount = 0;
            let firstErrorMessage = '';
            results.forEach(result => {
                if (result.status === 'fulfilled') {
                    successfulUrls.push(result.value);
                } else {
                    failedCount++;
                    if (!firstErrorMessage) firstErrorMessage = result.reason.message;
                    console.error('Upload failed:', result.reason.message);
                    Sentry.captureMessage(`Upload failed in WebhookModal: ${result.reason.message}`, "error");
                }
            });
            setMediaUrls(prevUrls => [...prevUrls, ...successfulUrls]);
            if (successfulUrls.length > 0) {
                showNotification(`${successfulUrls.length} file(s) uploaded successfully!`, 'check-circle');
            }
            if (failedCount > 0) {
                showNotification(`${failedCount} file(s) failed to upload. Error: ${firstErrorMessage}`, 'exclamation-circle');
            }
        } catch (error) {
            console.error('General upload process error:', error);
            Sentry.captureException(error, { extra: { context: 'WebhookModal Multi-File Upload Process' } });
            showNotification('An unexpected error occurred during upload.', 'exclamation-circle');
        } finally {
            setIsUploading(false);
            event.target.value = null;
        }
    };

    const handleAddUrl = () => {
        const urlToAdd = urlInput.trim();
        if (!urlToAdd) {
            showNotification('Please enter a URL.', 'warning');
            return;
        }
        if (!isImageUrl(urlToAdd) && !isVideoUrl(urlToAdd)) {
            showNotification('URL must be an image (jpg, png, etc.) or a video (mp4).', 'warning');
            return;
        }
        setMediaUrls(prevUrls => [...prevUrls, urlToAdd]);
        setUrlInput('');
        showNotification('URL added successfully!', 'check-circle');
    };

    const clearMedia = () => {
        setMediaUrls([]);
        showNotification('All media cleared.', 'trash');
    };

    const buildWebhookPayload = () => {
        // Split mediaUrls into video URLs and image URLs
        const videoUrls = mediaUrls.filter(url => isVideoUrl(url)).map(url => `<${url}>`);
        const imageUrls = mediaUrls.filter(url => isImageUrl(url));

        // Build embed description with message only (exclude URLs)
        const descriptionParts = [];
        if (webhookMessage) {
            descriptionParts.push(webhookMessage);
        }

        const embed = {
            title: webhookTitle || 'Untitled',
            description: descriptionParts.join('\n') || 'No content provided.',
            color: 0x00ff00,
            timestamp: new Date().toISOString(),
            footer: { text: `Sent via ${FORM_GENERATOR_URL}` },
        };

        // Add image to embed if an image URL is available
        if (imageUrls.length > 0) {
            embed.image = { url: imageUrls[0] };
        }

        // Add PHMC logo as thumbnail for secondary webhook
        if (confirmationAction?.type === 'secondary') {
            embed.thumbnail = { url: phmcLogoUrl };
        }

        const payload = {
            content: videoUrls.length > 0 ? videoUrls.join('\n') : undefined,
            embeds: [embed],
        };

        // Validate payload
        if (embed.title === 'Untitled' && embed.description === 'No content provided.' && !embed.image && !payload.content) {
            throw new Error('Cannot send an empty webhook.');
        }

        return payload;
    };

    const handlePrimarySubmit = () => {
        try {
            const payload = buildWebhookPayload();
            setConfirmationAction({
                type: 'primary',
                payload,
                identifier: primaryWebhookUrlIdentifier,
            });
            setShowConfirmation(true);
        } catch (error) {
            showNotification(error.message, 'warning');
        }
    };

    const handleSecondarySubmit = () => {
        try {
            const payload = buildWebhookPayload();
            setConfirmationAction({
                type: 'secondary',
                payload,
                identifier: secondaryWebhookUrlIdentifier,
            });
            setShowConfirmation(true);
        } catch (error) {
            showNotification(error.message, 'warning');
        }
    };

    const executeConfirmedSend = async () => {
        const { type, payload, identifier } = confirmationAction;
        const webhookUrl = type === 'primary'
            ? process.env[primaryWebhookUrlIdentifier]
            : process.env[secondaryWebhookUrlIdentifier];
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to send ${type} webhook embed. Status: ${response.status} ${JSON.stringify(errorData)}`);
            }
            showNotification('Webhook sent successfully!', 'check-circle');
            setMediaUrls([]);
            setWebhookTitle('');
            setWebhookMessage('');
        } catch (error) {
            console.error('Webhook send error:', error);
            Sentry.captureException(error, { extra: { context: `WebhookModal ${type} Send`, identifier } });
            showNotification(error.message, 'exclamation-circle');
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

    const modalDialogContent = (
        <div style={modalOverlayStyle} onClick={showConfirmation ? undefined : onClose}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                {showConfirmation && confirmationAction && (
                    <div style={confirmationDialogStyle}>
                        <p style={confirmationTextStyle}>
                            Confirm sending webhook to: <br />
                            PLEASE MAKE SURE THIS IS CORRECT BEFORE PROCEEDING!
                            <strong>{confirmationAction.identifier}</strong>
                        </p>
                        <div style={confirmationButtonsStyle}>
                            <Button variant="secondary" onClick={cancelSend}>Cancel</Button>
                            <Button variant="success" onClick={executeConfirmedSend}>Confirm Send</Button>
                        </div>
                    </div>
                )}
                <fieldset disabled={showConfirmation}>
                    <div style={modalHeaderStyle}>
                        <h5 style={modalTitleStyle}>{modalHeaderText}</h5>
                        <button onClick={onClose} style={closeButtonStyle} aria-label="Close modal">
                            &times;
                        </button>
                    </div>
                    <div style={modalBodyStyle}>
                        <Form>
                            <Form.Group controlId="webhookEmbedTitle" className="mb-3">
                                <Form.Label style={formLabelStyle}>Embed Title</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder={titlePlaceholder}
                                    value={webhookTitle}
                                    onChange={(e) => setWebhookTitle(e.target.value)}
                                    style={formControlStyle}
                                />
                            </Form.Group>
                            <Form.Group controlId="webhookMessageTextarea" className="mb-3">
                                <Form.Label style={formLabelStyle}>Embed Body</Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={4}
                                    placeholder={messagePlaceholder}
                                    value={webhookMessage}
                                    onChange={(e) => setWebhookMessage(e.target.value)}
                                    style={formControlStyle}
                                />
                                <Form.Text style={{ color: '#6c757d', fontSize: '0.85em' }}>
                                    Supports basic Markdown. Videos (mp4) and images appear as embedded previews.
                                </Form.Text>
                            </Form.Group>
                            <Form.Group controlId="webhookUrlInput" className="mb-3">
                                <Form.Label style={formLabelStyle}>Add Media URL (Image or Video)</Form.Label>
                                <InputGroup>
                                    <Form.Control
                                        type="url"
                                        placeholder="Paste Image or Video URL (jpg, png, mp4)..."
                                        value={urlInput}
                                        onChange={(e) => setUrlInput(e.target.value)}
                                        style={formControlStyle}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddUrl(); } }}
                                    />
                                    <Button variant="info" onClick={handleAddUrl}>
                                        <i className="fas fa-plus"></i> Add URL
                                    </Button>
                                </InputGroup>
                            </Form.Group>
                            <Form.Group controlId="webhookMediaUpload" className="mb-3">
                                <Form.Label style={formLabelStyle}>Upload Image(s) or Video(s)</Form.Label>
                                <InputGroup>
                                    <Button
                                        variant="success"
                                        disabled={isUploading}
                                        onClick={() => document.getElementById('webhook-media-input').click()}
                                    >
                                        <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                                        {isUploading ? ' Uploading...' : ' Upload Media'}
                                    </Button>
                                    <input
                                        id="webhook-media-input"
                                        type="file"
                                        accept="image/*,video/mp4"
                                        multiple
                                        style={{ display: 'none' }}
                                        onChange={handleMediaUpload}
                                    />
                                </InputGroup>
                                <Form.Text style={{ color: '#6c757d', fontSize: '0.85em' }}>
                                    Upload images or videos (mp4, max 200 MB, 60s) to Imgur. Videos and images appear as embedded previews.
                                </Form.Text>
                            </Form.Group>
                            {mediaUrls.length > 0 && (
                                <Form.Group className="mb-3">
                                    <Form.Label style={formLabelStyle}>Added Media ({mediaUrls.length})</Form.Label>
                                    <div style={imagePreviewContainerStyle}>
                                        {mediaUrls.map((url, index) => (
                                            <div key={index} style={{ position: 'relative' }}>
                                                {isImageUrl(url) ? (
                                                    <img src={url} alt={`Preview ${index + 1}`} style={imagePreviewStyle} title={url} />
                                                ) : isVideoUrl(url) ? (
                                                    <div style={urlPreviewStyle} title={url}>
                                                        <i className="fas fa-video" style={urlIconStyle}></i>
                                                        <span style={urlTextStyle}>Video Link</span>
                                                    </div>
                                                ) : (
                                                    <div style={urlPreviewStyle} title={url}>
                                                        <i className="fas fa-link" style={urlIconStyle}></i>
                                                        <span style={urlTextStyle}>External Link</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={clearMedia} style={{...clearImageButtonStyle, marginTop: '10px'}} title="Clear All Media">
                                        Clear All Media ({mediaUrls.length})
                                    </button>
                                </Form.Group>
                            )}
                        </Form>
                    </div>
                    <div style={modalFooterStyle}>
                        <div style={{ flexGrow: 1 }}></div>
                        <Button variant="secondary" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            variant="warning"
                            onClick={handlePrimarySubmit}
                            title={`Uses: ${primaryWebhookUrlIdentifier}`}
                        >
                            <i className="fas fa-vial"></i> {primaryButtonText}
                        </Button>
                        {showSecondaryButton && (
                            <Button
                                variant="primary"
                                onClick={handleSecondarySubmit}
                                title={`Uses: ${secondaryWebhookUrlIdentifier}`}
                            >
                                <i className="fas fa-paper-plane"></i> {secondaryButtonText}
                            </Button>
                        )}
                    </div>
                </fieldset>
            </div>
        </div>
    );

    return ReactDOM.createPortal(
        modalDialogContent,
        document.getElementById('modal-root')
    );
};

export default WebhookModal;