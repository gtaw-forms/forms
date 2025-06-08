// src/saaa-field-data/Heliport.js
import React, { useState } from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';

// Helper component for collapsible section headers (can be moved to a shared components folder if not already)
const CollapsibleHeader = ({ title, isOpen, onToggle, sectionId }) => (
    <Button
        variant="link"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`collapse-${sectionId}`}
        style={{
            fontWeight: 'bold',
            marginTop: '1rem',
            padding: '0.5rem 0',
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            textAlign: 'left',
            border: 'none',
            background: 'none'
        }}
    >
        {title}
        <i className={`fas ${isOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`} style={{ marginLeft: '10px' }}></i>
    </Button>
);

const Heliport = ({
    formData,
    handleChange,
    handleImageUpload, // Prop for handling image uploads (from App.js)
    isUploading,       // Prop to indicate if an upload is in progress (from App.js)
    setFormData,       // Added setFormData for the paste handler
}) => {
    // State for collapsible sections
    const [isPersonalInfoOpen, setIsPersonalInfoOpen] = useState(true);
    const [isHeliportInfoOpen, setIsHeliportInfoOpen] = useState(true);
    const [isAcknowledgementOpen, setIsAcknowledgementOpen] = useState(true);

    // Paste handler similar to EntryJob.js
    const handlePaste = (e, fieldName) => {
        const clipboardData = e.clipboardData || window.clipboardData;
        if (!clipboardData) return;
        const pastedData = clipboardData.getData('text');
        const items = clipboardData.items;
        let hasImageItem = false;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                hasImageItem = true;
                const file = items[i].getAsFile();
                if (file) {
                    // Create a synthetic event to pass to handleImageUpload
                    const syntheticEvent = { target: { files: [file] } };
                    handleImageUpload(syntheticEvent, fieldName);
                }
                e.preventDefault(); // Prevent pasting text if an image is found
                return;
            }
        }
        // If no image item was found, and it's a URL, append it
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        if (urlRegex.test(pastedData) && !hasImageItem) {
            const currentValue = formData[fieldName] || '';
            const cursorPos = e.target.selectionStart;
            // Add a comma and space if there's existing content and cursor isn't at the beginning
            const textToInsert = (currentValue && currentValue.trim().length > 0 && cursorPos > 0) ? `, ${pastedData}` : pastedData;
            const newValue = currentValue.slice(0, cursorPos) + textToInsert + currentValue.slice(cursorPos);

            setFormData(prev => ({ ...prev, [fieldName]: newValue }));
            e.preventDefault(); // Prevent default paste behavior
        }
    };


    return (
        <>
            {/* --- PERSONAL INFORMATION --- */}
            <CollapsibleHeader
                title="PERSONAL INFORMATION"
                isOpen={isPersonalInfoOpen}
                onToggle={() => setIsPersonalInfoOpen(!isPersonalInfoOpen)}
                sectionId="heliport-personal-info"
            />
            {isPersonalInfoOpen && (
                <div id="collapse-heliport-personal-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>Full Name</Form.Label>
                        <Form.Control
                            type="text"
                            name="registrantFullName"
                            value={formData.registrantFullName || ''}
                            onChange={handleChange}
                            placeholder="Enter your full name"
                            required
                            className={`form-control ${!formData.registrantFullName ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Contact Number(s)</Form.Label>
                        <Form.Control
                            type="text"
                            name="registrantContactNumbers"
                            value={formData.registrantContactNumbers || ''}
                            onChange={handleChange}
                            placeholder="e.g., 123-4567, 987-6543"
                            required
                            className={`form-control ${!formData.registrantContactNumbers ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Residential Address</Form.Label>
                        <Form.Control
                            type="text"
                            name="registrantResidentialAddress"
                            value={formData.registrantResidentialAddress || ''}
                            onChange={handleChange}
                            placeholder="Enter your full residential address"
                            required
                            className={`form-control ${!formData.registrantResidentialAddress ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                </div>
            )}

            {/* --- HELIPORT INFORMATION --- */}
            <CollapsibleHeader
                title="HELIPORT INFORMATION"
                isOpen={isHeliportInfoOpen}
                onToggle={() => setIsHeliportInfoOpen(!isHeliportInfoOpen)}
                sectionId="heliport-info"
            />
            {isHeliportInfoOpen && (
                <div id="collapse-heliport-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>Heliport Address(es)</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={2}
                            name="heliportAddresses"
                            value={formData.heliportAddresses || ''}
                            onChange={handleChange}
                            placeholder="Enter the full address(es) of the heliport location(s)"
                            required
                            className={`form-control ${!formData.heliportAddresses ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Number of Requested Pads</Form.Label>
                        <Form.Control
                            type="number"
                            name="heliportNumPads"
                            value={formData.heliportNumPads || ''}
                            onChange={handleChange}
                            placeholder="e.g., 1"
                            min="1"
                            required
                            className={`form-control ${!formData.heliportNumPads ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3 upload-container"> {/* Added upload-container class */}
                        <Form.Label>Photograph(s) of the Location(s)</Form.Label>
                        <InputGroup>
                            <Form.Control
                                as="textarea" // Changed to textarea
                                rows={2} // Added rows for textarea
                                name="heliportPhotoLinks"
                                value={formData.heliportPhotoLinks || ''}
                                onChange={handleChange}
                                placeholder="Paste Imgur URL(s) or use Upload button"
                                onPaste={(e) => handlePaste(e, 'heliportPhotoLinks')} // Added paste handler
                                className={`form-control ${!formData.heliportPhotoLinks ? 'is-invalid' : ''}`} // Optional: validation
                                // required // Optional: if links are required
                            />
                            <Button
                                variant="success"
                                disabled={isUploading}
                                onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.multiple = true; // Allow multiple files
                                    input.onchange = (e) => handleImageUpload(e, 'heliportPhotoLinks');
                                    input.click();
                                }}
                            >
                                <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                                {isUploading ? ' Uploading...' : ' Upload Photos'}
                            </Button>
                        </InputGroup>
                        <Form.Text className="text-muted">
                            Upload one or more images, or paste direct links (comma-separated if multiple). Supports clipboard pasting (Ctrl+V).
                        </Form.Text>
                        {/* Removed the direct display of links as textarea now shows them */}
                    </Form.Group>

                    <Form.Group className="mb-3 upload-container"> {/* Added upload-container class */}
                        <Form.Label>Layout Plan</Form.Label>
                         <InputGroup>
                            <Form.Control
                                as="textarea" // Changed to textarea
                                rows={2} // Added rows for textarea
                                name="heliportLayoutPlanLinks"
                                value={formData.heliportLayoutPlanLinks || ''}
                                onChange={handleChange}
                                placeholder="Paste Imgur URL(s) or use Upload button"
                                onPaste={(e) => handlePaste(e, 'heliportLayoutPlanLinks')} // Added paste handler
                                className={`form-control ${!formData.heliportLayoutPlanLinks ? 'is-invalid' : ''}`} // Optional: validation
                                // required // Optional: if links are required
                            />
                            <Button
                                variant="success"
                                disabled={isUploading}
                                onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*,.pdf,.doc,.docx'; // Accept common document types too
                                    input.multiple = true; // Allow multiple files
                                    input.onchange = (e) => handleImageUpload(e, 'heliportLayoutPlanLinks');
                                    input.click();
                                }}
                            >
                                <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                                {isUploading ? ' Uploading...' : ' Upload Plan(s)'}
                            </Button>
                        </InputGroup>
                        <Form.Text className="text-muted">
                            Upload image(s) or document(s) for the layout plan, or paste direct links. Supports clipboard pasting (Ctrl+V).
                        </Form.Text>
                        {/* Removed the direct display of links as textarea now shows them */}
                    </Form.Group>
                </div>
            )}

            {/* --- ACKNOWLEDGEMENT & AUTHORIZATION --- */}
            <CollapsibleHeader
                title="ACKNOWLEDGEMENT & AUTHORIZATION"
                isOpen={isAcknowledgementOpen}
                onToggle={() => setIsAcknowledgementOpen(!isAcknowledgementOpen)}
                sectionId="heliport-ack"
            />
            {isAcknowledgementOpen && (
                <div id="collapse-heliport-ack" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Check
                            type="checkbox"
                            name="ackAuthorize"
                            id="ackAuthorizeHeliportCheckbox"
                            checked={formData.ackAuthorize || false}
                            onChange={handleChange}
                            required
                            label={
                                `By submitting this request, I, ${formData.registrantFullName || '[Full Name]'}, hereby certify that the above statements are true and correct to the best of my knowledge. I fully authorize the investigation of any content shared on this document. I am aware that lying, omitting, or maliciously adulterating this request will result in immediate rejection and an indefinite ban from applying for a flight instructor certification.`
                            }
                            className={`${!formData.ackAuthorize ? 'is-invalid' : ''}`}
                        />
                        {!formData.ackAuthorize && <div className="invalid-feedback d-block">You must acknowledge and authorize to submit.</div>}
                    </Form.Group>
                </div>
            )}
        </>
    );
};

export default Heliport;
