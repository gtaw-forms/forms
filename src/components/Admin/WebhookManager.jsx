import { logAdminAction, getUserContext } from '../../utils/adminLogger';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import React, { useState, useEffect } from 'react';
import { useWebhook } from '../../contexts/WebhookProvider';
import { Form, Button, Alert, Spinner } from 'react-bootstrap';
import { getDatabase, ref, get } from 'firebase/database';

const WebhookManager = () => {
    const { user: gtawUser, username: gtawUsername } = useGtaWorldAuth();
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
        clearSavedWebhookState, // Added from WebhookProvider
    } = useWebhook();

    // Initialize state from localStorage for local components
    const [urlInput, setUrlInput] = useState(() => localStorage.getItem('webhookUrlInput') || '');
    const [availableWebhooks, setAvailableWebhooks] = useState([]);
    const [selectedWebhookId, setSelectedWebhookId] = useState(() => localStorage.getItem('selectedWebhookId') || '');
    const [customSending, setCustomSending] = useState(false);
    const [customResult, setCustomResult] = useState(null);

    // Save local state to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('webhookUrlInput', urlInput);
    }, [urlInput]);

    useEffect(() => {
        localStorage.setItem('selectedWebhookId', selectedWebhookId);
    }, [selectedWebhookId]);

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
            const { userAgent, timeZone } = getUserContext();
            logAdminAction(
                gtawUsername,
                'Sent Custom Webhook',
                `Title: ${webhookTitle}\nMessage: ${webhookMessage.substring(0, 100)}...\nMedia URLs: ${mediaUrls.join(', ')}`,
                'Webhook Manager',
                userAgent,
                timeZone,
                gtawUsername,
                gtawUser
            );

            // Prepare webhook payload similar to WebhookProvider logic
            const title = webhookTitle.trim() || 'PHMC Form Generator Notification';
            const message = webhookMessage.trim();
            
            let firstImageUrlForEmbed = null;
            let mediaDescription = '';
            
            if (mediaUrls.length > 0) {
                mediaDescription = '\n\n**Media:**\n';
                mediaUrls.forEach((url, index) => {
                    const isImage = typeof url === 'string' && (/\.(jpg|jpeg|png|gif)$/i.test(url) || url.includes('ibb.co'));
                    const isVideo = typeof url === 'string' && url.includes('streamable.com');
                    const type = isVideo ? 'Video' : isImage ? 'Image' : 'Link';
                    
                    if (isImage && !firstImageUrlForEmbed) {
                        firstImageUrlForEmbed = url;
                    }
                    
                    mediaDescription += `- ${type} ${index + 1}: ${url}\n`;
                });
            }

            const embed = {
                title: title,
                url: "https://gtaw-forms.github.io/forms/#/form-handler",
                description: (message + mediaDescription).trim() || undefined,
                color: 0x7289DA,
                timestamp: new Date().toISOString(),
                image: firstImageUrlForEmbed ? { url: firstImageUrlForEmbed } : undefined,
                footer: {
                    text: 'PHMC Form Generator - Admin Panel'
                }
            };

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
                setUrlInput(''); // Clear local url input
                setSelectedWebhookId(''); // Clear local selected webhook
                clearSavedWebhookState(); // Clear saved state from WebhookProvider
                localStorage.removeItem('webhookUrlInput'); // Clear local storage for urlInput
                localStorage.removeItem('selectedWebhookId'); // Clear local storage for selectedWebhookId
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
        return typeof url === 'string' && (/\.(jpg|jpeg|png|gif)$/i.test(url) || url.includes('ibb.co'));
    };

    const isStreamableUrl = (url) => {
        return typeof url === 'string' && url.includes('streamable.com');
    };

    const titlePlaceholder = "Major Update / Minor Update / Hotfix";
    const messagePlaceholder = "- Added: \n- Fixed: \n- Updated: ";

    const canSend = webhookTitle.trim() || webhookMessage.trim() || mediaUrls.length > 0;
    const resultToShow = customResult || sendResult;

    return (
        <div className="admin-section">
            {resultToShow && (
                <Alert variant={resultToShow.success ? "success" : "danger"} className="border-0 shadow-sm mb-4">
                    <i className={`fas ${resultToShow.success ? 'fa-check-circle' : 'fa-exclamation-triangle'} me-2`}></i>
                    {resultToShow.message}
                </Alert>
            )}
            
            <div className="row g-4">
                <div className="col-12">
                    <div className="form-group mb-4">
                        <label className="form-label small text-muted uppercase fw-bold mb-2">
                            <i className="fas fa-bullhorn me-2 text-indigo"></i>Target Destination
                        </label>
                        <Form.Select
                            className="bg-dark border-secondary text-white py-2"
                            value={selectedWebhookId}
                            onChange={(e) => setSelectedWebhookId(e.target.value)}
                        >
                            <option value="">Default System Webhooks (Production)</option>
                            {availableWebhooks.map((webhook) => (
                                <option key={webhook.id} value={webhook.id}>
                                    {webhook.name} [{webhook.type}]
                                </option>
                            ))}
                        </Form.Select>
                        <div className="mt-2 text-muted italic small">
                            {selectedWebhookId ? 'Broadcasting to selected high-priority endpoint' : 'Broadcasting to default environment alerts'}
                        </div>
                    </div>
                </div>

                <div className="col-md-6">
                    <div className="form-group mb-3">
                        <label className="form-label small text-muted uppercase fw-bold mb-2" htmlFor="webhookEmbedTitle">
                            <i className="fas fa-heading me-2"></i>Announcement Title
                        </label>
                        <Form.Control
                            className="bg-dark border-secondary text-white"
                            type="text"
                            id="webhookEmbedTitle"
                            placeholder={titlePlaceholder}
                            value={webhookTitle}
                            onChange={(e) => setWebhookTitle(e.target.value)}
                            autoComplete="off"
                        />
                    </div>
                    
                    <div className="form-group mb-3">
                        <label className="form-label small text-muted uppercase fw-bold mb-2" htmlFor="webhookMessageTextarea">
                            <i className="fas fa-align-left me-2"></i>Announcement Body
                        </label>
                        <Form.Control
                            className="bg-dark border-secondary text-white"
                            as="textarea"
                            id="webhookMessageTextarea"
                            rows={6}
                            placeholder={messagePlaceholder}
                            value={webhookMessage}
                            onChange={(e) => setWebhookMessage(e.target.value)}
                            autoComplete="off"
                        />
                        <div className="mt-2 text-muted small">
                            Markdown supported. Standard headers will be appended automatically.
                        </div>
                    </div>
                </div>

                <div className="col-md-6">
                    <div className="form-group mb-4">
                        <label className="form-label small text-muted uppercase fw-bold mb-2" htmlFor="webhookUrlInput">
                            <i className="fas fa-link me-2"></i>External Asset Link
                        </label>
                        <div className="input-group">
                            <Form.Control
                                type="url"
                                id="webhookUrlInput"
                                className="bg-dark border-secondary text-white font-monospace small"
                                placeholder="Paste asset URL..."
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddUrl(); } }}
                                autoComplete="off"
                            />
                            <Button variant="outline-primary" onClick={handleAddUrl} disabled={!urlInput.trim()}>
                                <i className="fas fa-plus"></i>
                            </Button>
                        </div>
                    </div>
                    
                    <div className="form-group mb-4">
                        <label className="form-label small text-muted uppercase fw-bold mb-2">
                            <i className="fas fa-upload me-2"></i>Upload Visual Assets
                        </label>
                        <div className="d-grid">
                            <Button
                                variant="outline-info"
                                className="py-3 admin-btn border-dashed"
                                disabled={isUploading}
                                onClick={() => document.getElementById('webhook-image-input-manager').click()}
                            >
                                {isUploading ? (
                                    <><Spinner animation="border" size="sm" className="me-2" /> Processing...</>
                                ) : (
                                    <><i className="fas fa-cloud-upload-alt me-2"></i>Attach Images</>
                                )}
                            </Button>
                            <input id="webhook-image-input-manager" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleLocalImageUpload} />
                        </div>
                    </div>
                    
                    {mediaUrls.length > 0 && (
                        <div className="form-group mb-3">
                            <label className="form-label small text-muted uppercase fw-bold mb-2">
                                <i className="fas fa-images me-2"></i>Linked Assets ({mediaUrls.length})
                            </label>
                            <div className="d-flex flex-wrap gap-2 mb-3">
                                {mediaUrls.map((url, index) => (
                                    <div key={index} className="position-relative">
                                        {isImageUrl(url) ? (
                                            <img src={url} alt="asset" className="rounded border border-secondary" style={{ width: '60px', height: '60px', objectFit: 'cover' }} />
                                        ) : (
                                            <div className="btn btn-dark btn-sm rounded font-monospace small px-2 py-3" style={{ height: '60px' }}>
                                                {url.includes('streamable') ? 'VIDEO' : 'LINK'}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <Button variant="outline-danger" size="sm" onClick={clearMedia} className="admin-btn small"><i className="fas fa-trash me-2"></i>Clear Assets</Button>
                        </div>
                    )}
                </div>

                <div className="col-12 mt-4">
                    <Button 
                        variant="primary"
                        className="w-100 py-3 admin-btn shadow-lg fw-bold"
                        onClick={handleSendWebhook}
                        disabled={!canSend || isSending || customSending}
                    >
                        {isSending || customSending ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" className="me-2" /> Broadcasting...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-paper-plane me-2"></i>
                                Send to {selectedWebhookId ? availableWebhooks.find(w => w.id === selectedWebhookId)?.name || 'Endpoint' : 'System Alerts'}
                            </>
                        )}
                    </Button>
                    {!canSend && <div className="text-center text-muted small mt-3 italic">Select destination and provide message body or assets to enable broadcast.</div>}
                </div>
            </div>
            <style>{`
                .uppercase { text-transform: uppercase; }
                .italic { font-style: italic; }
                .border-dashed { border-style: dashed !important; border-width: 2px !important; }
            `}</style>
        </div>
    );
};

export default WebhookManager;