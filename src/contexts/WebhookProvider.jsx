import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import * as Sentry from "@sentry/react";
import { useWebhooks } from '../hooks/useWebhooks';
import { useImageUpload } from '../hooks/useImageUpload';
import { useNotification } from './NotificationContext.jsx';

const WebhookContext = createContext();

export const useWebhook = () => {
    const context = useContext(WebhookContext);
    if (!context) {
        throw new Error('useWebhook must be used within a WebhookProvider');
    }
    return context;
};

export const WebhookProvider = ({ children, commitInfo }) => {
    // Initialize state from localStorage
    const [webhookTitle, setWebhookTitle] = useState(() => localStorage.getItem('webhookTitle') || '');
    const [webhookMessage, setWebhookMessage] = useState(() => localStorage.getItem('webhookMessage') || '');
    const [mediaUrls, setMediaUrls] = useState(() => {
        try {
            const savedUrls = localStorage.getItem('mediaUrls');
            return savedUrls ? JSON.parse(savedUrls) : [];
        } catch (error) {
            console.error("Error parsing mediaUrls from localStorage", error);
            return [];
        }
    });
    const [isUploading, setIsUploading] = useState(false);
    const { showNotification } = useNotification();

    const { handlePhmcWebhookSubmit, handleWebhookSubmit } = useWebhooks({}, commitInfo, showNotification);
    const { handleImageUpload: uploadImage } = useImageUpload(showNotification);

    // Save state to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('webhookTitle', webhookTitle);
    }, [webhookTitle]);

    useEffect(() => {
        localStorage.setItem('webhookMessage', webhookMessage);
    }, [webhookMessage]);

    useEffect(() => {
        localStorage.setItem('mediaUrls', JSON.stringify(mediaUrls));
    }, [mediaUrls]);

    const clearSavedWebhookState = useCallback(() => {
        setWebhookTitle('');
        setWebhookMessage('');
        setMediaUrls([]);
        localStorage.removeItem('webhookTitle');
        localStorage.removeItem('webhookMessage');
        localStorage.removeItem('mediaUrls');
    }, []);

    const handleLocalImageUpload = async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        setIsUploading(true);
        try {
            const uploadedResults = await uploadImage(event);
            if (uploadedResults && uploadedResults.length > 0) {
                // Extract only the string URLs from the results (which are {url, thumb} objects)
                const newUrls = uploadedResults.map(res => typeof res === 'string' ? res : res.url);
                setMediaUrls(prevUrls => [...prevUrls, ...newUrls]);
                showNotification(`${newUrls.length} image(s) uploaded successfully!`, 'check-circle');
            } else {
                showNotification('Image upload returned no URLs.', 'warning');
            }
        } catch (error) {
            console.error('Error during image upload in WebhookManager:', error);
            Sentry.captureException(error, { extra: { context: 'WebhookManager handleLocalImageUpload' } });
            showNotification('An unexpected error occurred during upload.', 'exclamation-circle');
        } finally {
            setIsUploading(false);
            if (event.target) {
                event.target.value = null;
            }
        }
    };

    const addMediaUrl = (url) => {
        const urlToAdd = url.trim();
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
        showNotification('URL added successfully!', 'check-circle');
    };

    const clearMedia = () => {
        setMediaUrls([]);
    };

    const prepareWebhookData = useCallback(() => {
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

        let firstImageUrlForEmbed = null;
        let mediaDescription = '';
        
        if (mediaUrls.length > 0) {
            mediaDescription = '\n\n**Media:**\n';
            mediaUrls.forEach((url, index) => {
                const isImage = /\.(jpg|jpeg|png|gif)$/i.test(url) || url.includes('ibb.co');
                const isVideo = url.includes('streamable.com');
                const type = isVideo ? 'Video' : isImage ? 'Image' : 'Link';
                
                if (isImage && !firstImageUrlForEmbed) {
                    firstImageUrlForEmbed = url;
                }
                
                mediaDescription += `- ${type} ${index + 1}: ${url}\n`;
            });
        }

        const footerText = `PHMC Form Generator - v${commitInfo?.sha || 'N/A'}`;
        const description = (message + mediaDescription).trim();

        if (description.length > 4096) {
            showNotification('Embed body (including media links) cannot exceed 4096 characters.', 'warning');
            return null;
        }

        const embedFields = [
            { name: "[Delayed Updates] Form Generator Link", value: "https://phmc-tools.gta.world/", inline: false },
            { name: "Alternative Form Generator Link", value: "https://gtaw-forms.github.io/forms/", inline: false }
        ];

        const embed = {
            title: title || "PHMC Form Generator Notification",
            url: "https://phmc-tools.gta.world/",
            description: description || undefined,
            color: 0x7289DA,
            timestamp: new Date().toISOString(),
            image: firstImageUrlForEmbed ? { url: firstImageUrlForEmbed } : undefined,
            fields: embedFields,
            footer: {
                text: footerText
            }
        };

        return {
            username: "PHMC",
            avatar_url: 'https://i.ibb.co/0pgw9hHm/phmc.png',
            embeds: [embed],
        };
    }, [webhookTitle, webhookMessage, mediaUrls, commitInfo, showNotification]);

    const sendWebhook = (type) => {
        const payload = prepareWebhookData();
        if (payload) {
            if (type === 'primary') {
                handleWebhookSubmit(payload);
            } else if (type === 'secondary') {
                handlePhmcWebhookSubmit(payload);
            }
        }
    };

    const value = {
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
    };

    return (
        <WebhookContext.Provider value={value}>
            {children}
        </WebhookContext.Provider>
    );
};
