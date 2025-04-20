import React, { useState } from 'react'; // Removed useEffect as it's not needed here now
import { Button, Form, InputGroup } from 'react-bootstrap'; // Added InputGroup
import * as Sentry from "@sentry/react"; // Import Sentry

// --- Styles (Keep existing styles: modalOverlayStyle, modalContentStyle, etc.) ---
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
const imageUrlContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '10px',
};
const imageUrlTextStyle = {
    flexGrow: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '0.9em',
    color: '#8b949e', // Dimmer color for URL
};
const clearImageButtonStyle = {
    padding: '2px 6px',
    fontSize: '0.8em',
    backgroundColor: '#6e7681', // Grey button
    color: '#ffffff',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
};
const imagePreviewContainerStyle = {
    display: 'flex',
    flexWrap: 'wrap', // Allow previews to wrap
    gap: '10px',      // Space between previews
    marginTop: '10px',
};

// --- End Styles ---

// Updated props to include title state
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
    commitInfo
}) => {
    const [imageUrls, setImageUrls] = useState([]); // Now an array
    const [isUploading, setIsUploading] = useState(false);
    const phmcLogoUrl = 'https://i.imgur.com/QMaz0OC.png'; // Keep this for avatar


    const handleImageUpload = async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        // Don't clear previous URLs immediately if you want additive uploads
        // setImageUrls([]); // Optional: Clear existing images on new selection

        const uploadPromises = [];
        for (let i = 0; i < files.length; i++) {
            // Add a delay between uploads if needed (e.g., 1 second)
            // await new Promise(resolve => setTimeout(resolve, 1000 * i));
            uploadPromises.push(uploadSingleImageToImgur(files[i]));
        }

        try {
            // Use Promise.allSettled to handle individual upload successes/failures
            const results = await Promise.allSettled(uploadPromises);

            const successfulUrls = [];
            let failedCount = 0;
            let firstErrorMessage = '';

            results.forEach(result => {
                if (result.status === 'fulfilled') {
                    successfulUrls.push(result.value);
                } else {
                    failedCount++;
                    if (!firstErrorMessage) {
                        firstErrorMessage = result.reason.message;
                    }
                    console.error('Imgur upload failed:', result.reason.message);
                    Sentry.captureMessage(`Imgur upload failed in WebhookModal: ${result.reason.message}`, "error");
                }
            });

            // Add newly uploaded URLs to the existing list
            setImageUrls(prevUrls => [...prevUrls, ...successfulUrls]);

            // Provide feedback
            if (successfulUrls.length > 0) {
                showNotification(`${successfulUrls.length} image(s) uploaded successfully!`, 'check-circle');
            }
            if (failedCount > 0) {
                showNotification(`${failedCount} image(s) failed to upload. Error: ${firstErrorMessage}`, 'exclamation-circle');
            }

        } catch (error) {
            // This catch block might be less likely to be hit with Promise.allSettled,
            // but keep it for unexpected issues.
            console.error('General upload process error:', error);
            Sentry.captureException(error, { extra: { context: 'WebhookModal Multi-Image Upload Process' } });
            showNotification('An unexpected error occurred during upload.', 'exclamation-circle');
        } finally {
            setIsUploading(false);
            // Clear the file input value so the same file(s) can be selected again if needed
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

        return data.data.link; // Return the URL on success
    };

    // --- Updated clear function ---
    const clearImages = () => {
        setImageUrls([]);
    };
    // --- End Updated ---

    // --- Updated Data Preparation Logic ---
    const prepareWebhookDataInternal = () => {
        const title = webhookTitle.trim();
        const message = webhookMessage.trim();

        // Check if there's any content (title, message, or images)
        if (!title && !message && imageUrls.length === 0) {
            showNotification('Please enter a title, message, or upload at least one image.', 'warning');
            return null;
        }
        if (title.length > 256) {
            showNotification('Embed title cannot exceed 256 characters.', 'warning');
            return null;
        }

        // Prepare description with potential additional image links
        let description = message || '';
        if (imageUrls.length > 1) {
            description += '\n\n**Additional Images:**\n';
            imageUrls.slice(1).forEach((url, index) => {
                description += `- Image ${index + 2}\n`;
            });
        }

        // Add footer regardless of other content
        description += `\n\nPHMC Form Generator - v${commitInfo?.sha || 'N/A'}`;


        if (description.length > 4096) {
            showNotification('Embed body (including image links) cannot exceed 4096 characters.', 'warning');
            return null;
        }

        const embed = {
            title: title || undefined,
            description: description.trim() || undefined, // Omit if completely empty after trimming
            color: 0x7289DA,
            timestamp: new Date().toISOString(),
            // Use the first image URL for the main embed image, if available
            image: imageUrls.length > 0 ? { url: imageUrls[0] } : undefined,
        };

        // Further cleanup if only image(s) were provided
        if (!message && !title && imageUrls.length > 0) {
             embed.description = `Image(s) submitted via PHMC Form Generator - v${commitInfo?.sha || 'N/A'}`;
             if (imageUrls.length > 1) {
                 embed.description += '\n\n**Additional Images:**\n';
                 imageUrls.slice(1).forEach((url, index) => {
                     embed.description += `- Image ${index + 2}\n`;
                 });
             }
        } else if (!message && title && imageUrls.length > 0) {
            // If title and image(s) but no message, keep the generated description with links
        }


        const payload = {
            username: "PHMC",
            avatar_url: phmcLogoUrl,
            embeds: [embed],
        };

        return payload;
    };
    // --- End Data Preparation ---

    // --- Modified Submit Handlers ---
    const handleDevSubmit = () => {
        const payload = prepareWebhookDataInternal();
        if (payload) {
            onSubmit(payload); // Pass the prepared payload UP to App.js's handler
        }
    };

    const handlePhmcSubmit = () => {
        const payload = prepareWebhookDataInternal();
        if (payload) {
            onSubmitPhmc(payload); // Pass the prepared payload UP to App.js's handler
        }
    };
    // --- End Modified Submit Handlers ---


    if (!show) {
        return null;
    }

    return (
        <div style={modalOverlayStyle} onClick={onClose}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                <div style={modalHeaderStyle}>
                    <h5 style={modalTitleStyle}>Send Dev Webhook Embed</h5>
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
                                placeholder="Enter the embed title..."
                                value={webhookTitle}
                                onChange={(e) => setWebhookTitle(e.target.value)}
                                style={formControlStyle}
                            />
                        </Form.Group>

                        <Form.Group controlId="webhookMessageTextarea" className="mb-3"> {/* Added mb-3 */}
                            <Form.Label style={formLabelStyle}>Embed Body</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={6} // Adjusted rows
                                placeholder="Enter the embed body content..."
                                value={webhookMessage}
                                onChange={(e) => setWebhookMessage(e.target.value)}
                                style={formControlStyle}
                            />
                            <Form.Text style={{ color: '#6c757d', fontSize: '0.85em' }}>
                                Supports basic Markdown. Additional image links will be appended here.
                            </Form.Text>
                        </Form.Group>

                        {/* --- Updated Image Upload Section --- */}
                        <Form.Group controlId="webhookImageUpload" className="mb-3">
                            <Form.Label style={formLabelStyle}>Embed Image(s)</Form.Label>
                            <InputGroup>
                                <Button
                                    variant="success"
                                    disabled={isUploading}
                                    onClick={() => document.getElementById('webhook-image-input').click()}
                                >
                                    <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                                    {isUploading ? ' Uploading...' : ' Upload Image(s)'}
                                </Button>
                                {/* Hidden file input - ADDED multiple attribute */}
                                <input
                                    id="webhook-image-input"
                                    type="file"
                                    accept="image/*"
                                    multiple // <-- Allow multiple file selection
                                    style={{ display: 'none' }}
                                    onChange={handleImageUpload}
                                />
                            </InputGroup>
                            {/* Display multiple previews */}
                            {imageUrls.length > 0 && (
                                <div style={imagePreviewContainerStyle}>
                                    {imageUrls.map((url, index) => (
                                        <div key={index} style={{ position: 'relative' }}>
                                            <img src={url} alt={`Preview ${index + 1}`} style={imagePreviewStyle} />
                                            {/* Optional: Add individual clear buttons if needed */}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* Clear All button */}
                            {imageUrls.length > 0 && (
                                <button onClick={clearImages} style={{...clearImageButtonStyle, marginTop: '10px'}} title="Clear All Images">
                                    Clear All Images ({imageUrls.length})
                                </button>
                            )}
                            <Form.Text style={{ color: '#6c757d', fontSize: '0.85em' }}>
                                Upload one or more images. The first image will be featured. Hosted by Imgur.
                            </Form.Text>
                        </Form.Group>
                        {/* --- End Updated --- */}
                    </Form>
                </div>

                <div style={modalFooterStyle}>
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
            </div>
        </div>
    );
};

export default WebhookModal;
