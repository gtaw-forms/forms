import React, { useState } from 'react';
import { useWebhook } from '../../contexts/WebhookProvider';
import '../WebhookModal.css'; // Reusing the CSS for now

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
    } = useWebhook();

    const [urlInput, setUrlInput] = useState('');

    const handleAddUrl = () => {
        addMediaUrl(urlInput);
        setUrlInput('');
    };

    const isImageUrl = (url) => {
        return /\.(jpg|jpeg|png|gif)$/i.test(url) || url.includes('ibb.co');
    };

    const isStreamableUrl = (url) => {
        return url.includes('streamable.com');
    };

    const titlePlaceholder = "Major Update / Minor Update / Hotfix";
    const messagePlaceholder = "- Added: \n- Fixed: \n- Updated: ";

    return (
        <div className="webhook-manager-container">
            <div className="webhook-form">
                <div className="webhook-form-group">
                    <label className="webhook-form-label" htmlFor="webhookEmbedTitle">Embed Title</label>
                    <input
                        type="text"
                        id="webhookEmbedTitle"
                        className="webhook-form-control"
                        placeholder={titlePlaceholder}
                        value={webhookTitle}
                        onChange={(e) => setWebhookTitle(e.target.value)}
                        autoComplete="off"
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
                        autoComplete="off"
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
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); handleAddUrl(); }
                            }}
                            autoComplete="off"
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
                            onClick={() => document.getElementById('webhook-image-input-manager').click()}
                        >
                            <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                            {isUploading ? ' Uploading...' : ' Upload Image(s)'}
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
                                        <img
                                            src={url}
                                            alt={`Preview ${index + 1}`}
                                            className="webhook-media-image"
                                            title={url}
                                            onClick={() => window.open(url, '_blank')}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    ) : isStreamableUrl(url) ? (
                                        <div
                                            className="webhook-media-link"
                                            title={url}
                                            onClick={() => window.open(url, '_blank')}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <i className="fas fa-video webhook-media-icon"></i>
                                            <span>Streamable Link</span>
                                        </div>
                                    ) : (
                                        <div
                                            className="webhook-media-link"
                                            title={url}
                                            onClick={() => window.open(url, '_blank')}
                                            style={{ cursor: 'pointer' }}
                                        >
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
            </div>
            <div className="webhook-footer">
                <div className="webhook-spacer"></div>
                <button
                    type="button"
                    className="webhook-button webhook-button-warning"
                    onClick={() => sendWebhook('primary')}
                    title={`Uses: ${process.env.REACT_APP_DEV_WEBHOOK}`}
                >
                    <i className="fas fa-vial"></i> Send to Dev Hook
                </button>
                <button
                    type="button"
                    className="webhook-button webhook-button-primary"
                    onClick={() => sendWebhook('secondary')}
                    title={`Uses: ${process.env.REACT_APP_PHMC_DISCORD}`}
                >
                    <i className="fas fa-paper-plane"></i> Send to PHMC Hook
                </button>
            </div>
        </div>
    );
};

export default WebhookManager;
