// filepath: src/components/WebhookModal.js
import React from 'react';
import { Button, Form } from 'react-bootstrap';

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
    width: '90%',
    maxWidth: '500px',
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
// --- End Styles ---

// Updated props to include title state
const WebhookModal = ({
    show,
    onClose,
    webhookTitle,      // <-- New prop for title
    setWebhookTitle,   // <-- New prop for title setter
    webhookMessage,
    setWebhookMessage,
    onSubmit,
    onSubmitPhmc
}) => {
    if (!show) {
        return null;
    }

    return (
        <div style={modalOverlayStyle} onClick={onClose}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                <div style={modalHeaderStyle}>
                    <h5 style={modalTitleStyle}>Send Dev Webhook Embed</h5> {/* Updated Title */}
                    <button onClick={onClose} style={closeButtonStyle} aria-label="Close modal">
                        &times;
                    </button>
                </div>

                <div style={modalBodyStyle}>
                    <Form>
                        {/* --- New Title Input --- */}
                        <Form.Group controlId="webhookEmbedTitle" className="mb-3"> {/* Added margin-bottom */}
                            <Form.Label style={formLabelStyle}>Embed Title</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Enter the embed title..."
                                value={webhookTitle}
                                onChange={(e) => setWebhookTitle(e.target.value)}
                                style={formControlStyle}
                            />
                        </Form.Group>
                        {/* --- End New Title Input --- */}

                        <Form.Group controlId="webhookMessageTextarea">
                            <Form.Label style={formLabelStyle}>Embed Body</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={8} // Increased rows slightly
                                placeholder="Enter the embed body content. Use markdown for formatting (e.g., * item 1, - item 2)."
                                value={webhookMessage}
                                onChange={(e) => setWebhookMessage(e.target.value)}
                                style={formControlStyle}
                            />
                             <Form.Text style={{ color: '#6c757d', fontSize: '0.85em' }}>
                                Supports basic Markdown: `*italic*`, `**bold**`, `link text`, `* list item`, `- list item`.
                            </Form.Text>
                        </Form.Group>
                    </Form>
                </div>

                <div style={modalFooterStyle}>
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    {/* Existing Dev Webhook Button */}
                    <Button variant="warning" onClick={onSubmit} title="Send to the Development Webhook"> {/* Changed variant for distinction */}
                        <i className="fas fa-vial"></i> Send Dev Embed
                    </Button>
                    {/* New PHMC Webhook Button */}
                    <Button variant="primary" onClick={onSubmitPhmc} title="Send to the Official PHMC Webhook"> {/* Use the new handler */}
                        <i className="fas fa-paper-plane"></i> Send to PHMC Discord
                    </Button>
                </div>

            </div>
        </div>
    );
};

export default WebhookModal;
