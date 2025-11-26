import React, { useState, useEffect } from 'react';
import { useWebhook } from '../../contexts/WebhookProvider';
import { Form, Button, Alert } from 'react-bootstrap';
import { getDatabase, ref, get } from 'firebase/database';

const WebhookManager = () => {
    const {
        webhookTitle,
        setWebhookTitle,
        webhookMessage,
        setWebhookMessage,
        mediaUrls,
        addMediaUrl,
        clearMedia,
        handleLocalImageUpload,
        isUploading,
        sendWebhook,
        isSending,
        sendResult,
    } = useWebhook();

    const [urlInput, setUrlInput] = useState('');
    const [availableWebhooks, setAvailableWebhooks] = useState([]);
    const [selectedWebhookId, setSelectedWebhookId] = useState('');
    const [customSending, setCustomSending] = useState(false);
    const [customResult, setCustomResult] = useState(null);

    // Load available webhooks from Firebase
    useEffect(() => {
        const loadWebhooks = async () => {
            try {
                const db = getDatabase();
                const webhooksRef = ref(db, 'webhooks');
                const snapshot = await get(webhooksRef);
                if (snapshot.exists()) {
                    const webhooksData = snapshot.val();
                    const webhooksList = Object.keys(webhooksData).map(key => ({
                        id: key,
                        ...webhooksData[key]
                    }));
                    setAvailableWebhooks(webhooksList);
                }
            } catch (error) {
                console.error('Error loading webhooks:', error);
            }
        };
        loadWebhooks();
    }, []);

    const handleAddUrl = () => {
        if (urlInput.trim()) {
            addMediaUrl(urlInput.trim());
            setUrlInput('');
        }
    };

    const handleSendWebhook = async () => {
        if (selectedWebhookId) {
            // Send to custom selected webhook
            await handleSendToCustomWebhook();
        } else {
            // Send to default webhooks (original behavior)
            await sendWebhook('primary'); // or 'secondary'
        }
    };

    const handleSendToCustomWebhook = async () => {
        const selectedWebhook = availableWebhooks.find(w => w.id === selectedWebhookId);
        if (!selectedWebhook) {
            setCustomResult({ success: false, message: 'Please select a webhook destination' });
            return;
        }

        if (!webhookTitle.trim() && !webhookMessage.trim() && mediaUrls.length === 0) {
            setCustomResult({ success: false, message: 'Please enter a title, message, or add media' });
            return;
        }

        setCustomSending(true);
        setCustomResult(null);

        try {
            // Prepare webhook payload similar to WebhookProvider logic
            const title = webhookTitle.trim() || 'PHMC Form Generator Notification';
            const description = webhookMessage.trim() || undefined;
            
            let firstImageUrlForEmbed = null;
            for (const url of mediaUrls) {
                if (/\.(jpg|jpeg|png|gif)$/i.test(url) || url.includes('ibb.co')) {
                    firstImageUrlForEmbed = url;
                    break;
                }
            }

            const embed = {
                title: title,
                url: "https://gtaw-forms.github.io/forms/#/form-handler",
                description: description,
                color: 0x7289DA,
                timestamp: new Date().toISOString(),
                image: firstImageUrlForEmbed ? { url: firstImageUrlForEmbed } : undefined,
                footer: {
                    text: 'PHMC Form Generator - Admin Panel'
                }
            };

            // Add media links if no description
            if (!description && mediaUrls.length > 0) {
                embed.description = 'Media submitted via PHMC Form Generator\n\n**Media:**\n';
                mediaUrls.forEach((url, index) => {
                    const type = url.includes('streamable.com') ? 'Video' : (/\.(jpg|jpeg|png|gif)$/i.test(url) || url.includes('ibb.co')) ? 'Image' : 'Link';
                    embed.description += `- ${type} ${index + 1}: ${url}\n`;
                });
            }

            const payload = {
                username: "PHMC",
                avatar_url: 'https://i.ibb.co/0pgw9hHm/phmc.png',
                embeds: [embed],
            };

            const response = await fetch(selectedWebhook.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                setCustomResult({ success: true, message: `Webhook sent successfully to ${selectedWebhook.name}!` });
                // Clear form after successful send
                setWebhookTitle('');
                setWebhookMessage('');
                clearMedia();
            } else {
                setCustomResult({ success: false, message: `Failed to send webhook: ${response.status}` });
            }
        } catch (error) {
            console.error('Error sending webhook:', error);
            setCustomResult({ success: false, message: 'Network error occurred. Please try again.' });
        } finally {
            setCustomSending(false);
        }
    };

    const isImageUrl = (url) => {
        return /\.(jpg|jpeg|png|gif)$/i.test(url) || url.includes('ibb.co');
    };

    const isStreamableUrl = (url) => {
        return url.includes('streamable.com');
    };

    const titlePlaceholder = "Major Update / Minor Update / Hotfix";
    const messagePlaceholder = "- Added: \n- Fixed: \n- Updated: ";

    const canSend = webhookTitle.trim() || webhookMessage.trim() || mediaUrls.length > 0;
    const resultToShow = customResult || sendResult;

    return (
        <div className="webhook-manager-container">
            {resultToShow && (
                <Alert variant={resultToShow.success ? "success" : "danger"} className="mb-3">
                    <i className={`fas ${resultToShow.success ? 'fa-check' : 'fa-exclamation-triangle'} me-2`}></i>
                    {resultToShow.message}
                </Alert>
            )}
            
            {/* Webhook Selection */}
            <div className="form-group mb-3">
                <label className="form-label">
                    <i className="fas fa-bullhorn me-2"></i>Select Webhook Destination
                </label>
                <Form.Select
                    value={selectedWebhookId}
                    onChange={(e) => setSelectedWebhookId(e.target.value)}
                >
                    <option value="">Default Webhooks (Dev/PHMC)</option>
                    {availableWebhooks.map((webhook) => (
                        <option key={webhook.id} value={webhook.id}>
                            {webhook.name} ({webhook.type})
                        </option>
                    ))}
                </Form.Select>
                <small className="form-text text-muted">
                    {selectedWebhookId ? 'Sending to selected custom webhook' : 'Sending to default environment webhooks'}
                </small>
            </div>
            
            <div className="webhook-form">
                <div className="form-group mb-3">
                    <label className="form-label" htmlFor="webhookEmbedTitle">
                        <i className="fas fa-heading me-2"></i>Embed Title
                    </label>
                    <Form.Control
                        type="text"
                        id="webhookEmbedTitle"
                        placeholder={titlePlaceholder}
                        value={webhookTitle}
                        onChange={(e) => setWebhookTitle(e.target.value)}
                        autoComplete="off"
                    />
                </div>
                
                <div className="form-group mb-3">
                    <label className="form-label" htmlFor="webhookMessageTextarea">
                        <i className="fas fa-align-left me-2"></i>Embed Body
                    </label>
                    <Form.Control
                        as="textarea"
                        id="webhookMessageTextarea"
                        rows={4}
                        placeholder={messagePlaceholder}
                        value={webhookMessage}
                        onChange={(e) => setWebhookMessage(e.target.value)}
                        autoComplete="off"
                    />
                    <small className="form-text text-muted">
                        Supports basic Markdown. Media links will be appended automatically.
                    </small>
                </div>
                
                <div className="form-group mb-3">
                    <label className="form-label" htmlFor="webhookUrlInput">
                        <i className="fas fa-link me-2"></i>Add Media URL
                    </label>
                    <div className="input-group">
                        <input
                            type="url"
                            id="webhookUrlInput"
                            className="form-control"
                            placeholder="Paste Image or Streamable URL..."
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') { 
                                    e.preventDefault(); 
                                    handleAddUrl(); 
                                }
                            }}
                            autoComplete="off"
                        />
                        <button 
                            type="button" 
                            className="btn btn-outline-secondary" 
                            onClick={handleAddUrl}
                            disabled={!urlInput.trim()}
                        >
                            <i className="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
                
                <div className="form-group mb-3">
                    <label className="form-label">
                        <i className="fas fa-upload me-2"></i>Upload Images
                    </label>
                    <div className="d-grid">
                        <button
                            type="button"
                            className={`btn btn-outline-primary ${isUploading ? 'disabled' : ''}`}
                            disabled={isUploading}
                            onClick={() => document.getElementById('webhook-image-input-manager').click()}
                        >
                            <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'} me-2`}></i>
                            {isUploading ? 'Uploading...' : 'Upload Image(s)'}
                        </button>
                        <input
                            id="webhook-image-input-manager"
                            type="file"
                            accept="image/*"
                            multiple
                            style={{ display: 'none' }}
                            onChange={handleLocalImageUpload}
                        />
                    </div>
                    <small className="form-text text-muted">
                        Upload one or more images. Hosted by ImgBB.
                    </small>
                </div>
                
                {mediaUrls.length > 0 && (
                    <div className="form-group mb-3">
                        <label className="form-label">
                            <i className="fas fa-images me-2"></i>Added Media ({mediaUrls.length})
                        </label>
                        <div className="webhook-media-preview d-flex flex-wrap gap-2 mb-2">
                            {mediaUrls.map((url, index) => (
                                <div key={index} className="webhook-media-item">
                                    {isImageUrl(url) ? (
                                        <img
                                            src={url}
                                            alt={`Preview ${index + 1}`}
                                            className="webhook-media-image rounded"
                                            title={url}
                                            onClick={() => window.open(url, '_blank')}
                                            style={{ 
                                                cursor: 'pointer',
                                                width: '60px',
                                                height: '60px',
                                                objectFit: 'cover'
                                            }}
                                        />
                                    ) : isStreamableUrl(url) ? (
                                        <div
                                            className="webhook-media-link btn btn-outline-info btn-sm"
                                            title={url}
                                            onClick={() => window.open(url, '_blank')}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <i className="fas fa-video me-1"></i>
                                            Video
                                        </div>
                                    ) : (
                                        <div
                                            className="webhook-media-link btn btn-outline-secondary btn-sm"
                                            title={url}
                                            onClick={() => window.open(url, '_blank')}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <i className="fas fa-link me-1"></i>
                                            Link
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={clearMedia}
                            title="Clear All Media"
                        >
                            <i className="fas fa-trash me-1"></i>
                            Clear All ({mediaUrls.length})
                        </button>
                    </div>
                )}

                <div className="d-grid mt-4">
                    <Button 
                        variant="primary"
                        size="lg"
                        onClick={handleSendWebhook}
                        disabled={!canSend || isSending || customSending}
                    >
                        {(isSending || customSending) ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                Sending Webhook...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-paper-plane me-2"></i>
                                Send to {selectedWebhookId ? availableWebhooks.find(w => w.id === selectedWebhookId)?.name || 'Selected' : 'Default'} Webhook
                            </>
                        )}
                    </Button>
                </div>
                
                {!canSend && (
                    <small className="text-muted text-center d-block mt-2">
                        Add a title, message, or media to enable sending
                    </small>
                )}
            </div>
        </div>
    );
};

export default WebhookManager;