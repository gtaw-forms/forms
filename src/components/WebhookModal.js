import React, { useState, useEffect } from 'react';
import { Button, Form, InputGroup } from 'react-bootstrap';
import * as Sentry from "@sentry/react";

// --- Styles (Keep existing styles) ---
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
    justifyContent: 'flex-end', // Buttons will remain to the right
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
// --- End Styles ---

const LS_WEBHOOK_TITLE_CONTENT = 'webhookModal_title_content';
const LS_WEBHOOK_TITLE_TIMESTAMP = 'webhookModal_title_timestamp';
const LS_WEBHOOK_MESSAGE_CONTENT = 'webhookModal_message_content';
const LS_WEBHOOK_MESSAGE_TIMESTAMP = 'webhookModal_message_timestamp';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const FORM_GENERATOR_URL = "https://gtaw-forms.github.io/forms/";

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
    modalHeaderText = "Send Dev Webhook Embed"
}) => {
    const [mediaUrls, setMediaUrls] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [urlInput, setUrlInput] = useState('');
    const phmcLogoUrl = 'https://i.imgur.com/QMaz0OC.png';

    useEffect(() => {
        if (show) {
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


    const handleImageUpload = async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        const uploadPromises = [];
        for (let i = 0; i < files.length; i++) {
            uploadPromises.push(uploadSingleImageToImgur(files[i]));
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
                    console.error('Imgur upload failed:', result.reason.message);
                    Sentry.captureMessage(`Imgur upload failed in WebhookModal: ${result.reason.message}`, "error");
                }
            });

            setMediaUrls(prevUrls => [...prevUrls, ...successfulUrls]);

            if (successfulUrls.length > 0) {
                showNotification(`${successfulUrls.length} image(s) uploaded successfully!`, 'check-circle');
            }
            if (failedCount > 0) {
                showNotification(`${failedCount} image(s) failed to upload. Error: ${firstErrorMessage}`, 'exclamation-circle');
            }

        } catch (error) {
            console.error('General upload process error:', error);
            Sentry.captureException(error, { extra: { context: 'WebhookModal Multi-Image Upload Process' } });
            showNotification('An unexpected error occurred during upload.', 'exclamation-circle');
        } finally {
            setIsUploading(false);
            event.target.value = null;
        }
    };
    const uploadSingleImageToImgur = async (file) => {
        const imgurAccessToken = process.env.REACT_APP_IMGUR_ACCESS_TOKEN;
        const imgurAlbumId = process.env.REACT_APP_IMGUR_ALBUM_ID;

        if (!imgurAccessToken || !imgurAlbumId) {
            throw new Error("Imgur API credentials not configured.");
        }

        const formData = new FormData();
        formData.append('image', file);
        formData.append('album', imgurAlbumId);

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
        return /\.(jpg|jpeg|png|gif)$/i.test(url) || url.includes('imgur.com');
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

        const footerText = `PHMC Form Generator - v${commitInfo?.sha || 'N/A'} | ${FORM_GENERATOR_URL}`;

        if (description.length > 4096) {
            showNotification('Embed body (message content) cannot exceed 4096 characters.', 'warning');
            return null;
        }

        // --- MODIFICATION START: Add URL to embed title and as a field ---
        const embedFields = [];
        if (FORM_GENERATOR_URL) {
            embedFields.push({ name: "Form Generator Link", value: FORM_GENERATOR_URL, inline: false });
        }
        // --- MODIFICATION END ---

        const embed = {
            title: title || "PHMC Form Generator Notification", // Default title if user leaves it blank
            // --- MODIFICATION START: Make title a link ---
            url: FORM_GENERATOR_URL,
            // --- MODIFICATION END ---
            description: description.trim() || undefined,
            color: 0x7289DA,
            timestamp: new Date().toISOString(),
            image: firstImageUrlForEmbed ? { url: firstImageUrlForEmbed } : undefined,
            fields: embedFields, // Add the new field here
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


    const handleDevSubmit = () => {
        const payload = prepareWebhookDataInternal();
        if (payload) {
            onSubmit(payload);
        }
    };

    const handlePhmcSubmit = () => {
        const payload = prepareWebhookDataInternal();
        if (payload) {
            onSubmitPhmc(payload);
        }
    };


    if (!show) {
        return null;
    }

    const titlePlaceholder = "Major Update / Minor Update / Hotfix";
    const messagePlaceholder = `- Added: \n- Fixed: \n- Updated: `;

    return (
        <div style={modalOverlayStyle} onClick={onClose}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
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
                                Supports basic Markdown. Media links will be appended automatically if only media is provided.
                            </Form.Text>
                        </Form.Group>

                        <Form.Group controlId="webhookUrlInput" className="mb-3">
                            <Form.Label style={formLabelStyle}>Add Media URL (Image or Streamable)</Form.Label>
                            <InputGroup>
                                <Form.Control
                                    type="url"
                                    placeholder="Paste Image or Streamable URL..."
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

                        <Form.Group controlId="webhookImageUpload" className="mb-3">
                            <Form.Label style={formLabelStyle}>Upload Image(s)</Form.Label>
                            <InputGroup>
                                <Button
                                    variant="success"
                                    disabled={isUploading}
                                    onClick={() => document.getElementById('webhook-image-input').click()}
                                >
                                    <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                                    {isUploading ? ' Uploading...' : ' Upload Image(s)'}
                                </Button>
                                <input
                                    id="webhook-image-input"
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    style={{ display: 'none' }}
                                    onChange={handleImageUpload}
                                />
                            </InputGroup>
                            <Form.Text style={{ color: '#6c757d', fontSize: '0.85em' }}>
                                Upload one or more images. Hosted by Imgur.
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
                                            ) : isStreamableUrl(url) ? (
                                                <div style={urlPreviewStyle} title={url}>
                                                    <i className="fas fa-video" style={urlIconStyle}></i>
                                                    <span style={urlTextStyle}>Streamable Link</span>
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

                {/* --- MODIFICATION START: Removed Form Generator URL from modal footer --- */}
                <div style={modalFooterStyle}>
                    {/* The div that previously showed the formGeneratorUrl is removed */}
                    <div style={{ flexGrow: 1 }}></div> {/* This will push buttons to the right if no URL is shown */}
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="warning" onClick={handleDevSubmit} title="Send to the Development Webhook">
                        <i className="fas fa-vial"></i> Send Dev Embed
                    </Button>
                    <Button variant="primary" onClick={handlePhmcSubmit} title="Send to the Official PHMC Webhook">
                        <i className="fas fa-paper-plane"></i> Send to PHMC Discord
                    </Button>
                </div>
                {/* --- MODIFICATION END --- */}
            </div>
        </div>
    );
};

export default WebhookModal;
