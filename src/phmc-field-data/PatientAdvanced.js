// src/main.js
import React, { useState, useEffect } from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';

// Helper component for collapsible section headers - Copied from Nursing.js
const CollapsibleHeader = ({ title, isOpen, onToggle, sectionId }) => (
    <Button
        variant="link"
        onClick={onToggle} // Keep the existing onToggle function
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

const PatientAdvanced = ({
    formData,
    handleChange,
    handleImageUpload,
    isUploading,
    setFormData,
    patientTitleOptions,
    patientBloodType,
    selectOptions
}) => {
    const [isGeneralInfoOpen, setIsGeneralInfoOpen] = useState(true);
    const [isContactInfoOpen, setIsContactInfoOpen] = useState(true);
    const [isMedicalHistoryOpen, setIsMedicalHistoryOpen] = useState(true);
    const [isAdvancedDirectivesOpen, setIsAdvancedDirectivesOpen] = useState(true);
    const [activeSection, setActiveSection] = useState('general-info');

    const dnrOptions = selectOptions.dnr || [];
    const attorneyOptions = selectOptions.attorney || [];
    const dnrOrderOptions = selectOptions.dnrOrder || [];


    return (
        <>
            {/* --- 1. General Information --- */}
            <CollapsibleHeader
                title="1. General Information"
                isOpen={isGeneralInfoOpen}
                onToggle={() => setIsGeneralInfoOpen(!isGeneralInfoOpen)}
                sectionId="general-info"
            />
            {isGeneralInfoOpen && (
                <div id="collapse-general-info" onFocusCapture={() => setActiveSection('general-info')}>
                    <Form.Group className="mb-3">
                                                <Form.Label>Patient ID, leave blank if unsure</Form.Label>

                                                <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> {/* Added marginTop */}

                        <Form.Control
                            type="text"
                            name="patientID"
                            value={formData.patientID}
                            onChange={handleChange}
                            placeholder="Patient ID  (Optional)"
                            className={`form-control ${!formData.patientID ? 'is-invalid' : ''}`}
                        />
                        </div>
                        <Form.Label>Title / Patient Name Name / Date of Birth</Form.Label>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> {/* Added marginTop */}

                            <Form.Select
                                name="patientTitle"
                                value={formData.patientTitle}
                                onChange={handleChange}
                                required
                                className={`form-control ${!formData.patientTitle ? 'is-invalid' : ''}`}
                            >
                                <option value="" disabled>Title</option>
                                {patientTitleOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </Form.Select>
                            <Form.Control
                                type="text"
                                name="patientName"
                                value={formData.patientName}
                                onChange={handleChange}
                                placeholder="Patient Name"
                                required
                                className={`form-control ${!formData.patientName ? 'is-invalid' : ''}`}
                            />
                            <Form.Control
                                type="date"
                                name="patientDateOfBirth"
                                value={formData.patientDateOfBirth}
                                onChange={handleChange}
                                placeholder="Date of Birth"
                                required
                                className={`form-control ${!formData.patientDateOfBirth ? 'is-invalid' : ''}`}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> {/* Added marginTop */}
                            <Form.Control
                                type="text"
                                name="patientAddress"
                                value={formData.patientAddress}
                                onChange={handleChange}
                                placeholder="Patient Home Address"
                                required
                                className={`form-control ${!formData.patientAddress ? 'is-invalid' : ''}`}
                            />
                            <Form.Control
                                type="text"
                                name="patientGender"
                                value={formData.patientGender}
                                onChange={handleChange}
                                placeholder="Patient Gender"
                                required
                                className={`form-control ${!formData.patientGender ? 'is-invalid' : ''}`}
                            />
                            <Form.Control
                                type="text"
                                name="patientRace"
                                value={formData.patientRace}
                                onChange={handleChange}
                                placeholder="Patient Race"
                                required
                                className={`form-control ${!formData.patientRace ? 'is-invalid' : ''}`}
                            />
                        </div>
                    </Form.Group>
                </div>
            )}

            {/* --- 2. Contact Information --- */}
            <CollapsibleHeader
                title="2. Contact Information"
                isOpen={isContactInfoOpen}
                onToggle={() => setIsContactInfoOpen(!isContactInfoOpen)}
                sectionId="contact-info"
            />
            {isContactInfoOpen && (
                <div id="collapse-contact-info" onFocusCapture={() => setActiveSection('contact-info')}>
                    <div className="input-group">
                        <Form.Control
                            type="text"
                            name="patientPH"
                            value={formData.patientPH}
                            onChange={handleChange}
                            placeholder="Patient Phone Number"
                            required
                            className={`form-control ${!formData.patientPH ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="patientDiscord"
                            value={formData.patientDiscord}
                            onChange={handleChange}
                            placeholder="(( Patient Discord ID )) "
                            required
                            className={`form-control ${!formData.patientDiscord ? 'is-invalid' : ''}`}
                        />
                    </div>
                    <Form.Label>Emergency Contact Information </Form.Label>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> {/* Added marginTop */}
                        <Form.Control
                            type="text"
                            name="patientEmergencyContact"
                            value={formData.patientEmergencyContact}
                            onChange={handleChange}
                            placeholder="Emergency Contact Full Name"
                            required
                            className={`form-control ${!formData.patientEmergencyContact ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="patientEmergencyContactRelation"
                            value={formData.patientEmergencyContactRelation}
                            onChange={handleChange}
                            placeholder="Emergency Contact Relation to Patient"
                            required
                            className={`form-control ${!formData.patientEmergencyContactRelation ? 'is-invalid' : ''}`}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control
                            type="text"
                            name="patientEmergencyContactNumber"
                            value={formData.patientEmergencyContactNumber}
                            onChange={handleChange}
                            placeholder="Emergency Contact Contact Number"
                            required
                            className={`form-control ${!formData.patientEmergencyContactNumber ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="patientEmergencyContactDiscord"
                            value={formData.patientEmergencyContactDiscord}
                            onChange={handleChange}
                            placeholder="(( Patient Emergency Contact Discord )) "
                            required
                            className={`form-control ${!formData.patientEmergencyContactDiscord ? 'is-invalid' : ''}`}
                        />
                    </div>
                </div>
            )}

            {/* --- 3. Medical History --- */}
            <CollapsibleHeader
                title="3. Medical History"
                isOpen={isMedicalHistoryOpen}
                onToggle={() => setIsMedicalHistoryOpen(!isMedicalHistoryOpen)}
                sectionId="medical-history"
            />
            {isMedicalHistoryOpen && (
                <div id="collapse-medical-history" onFocusCapture={() => setActiveSection('medical-history')}>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> {/* Added marginTop */}
                        <Form.Select
                            name="patientBloodType"
                            value={formData.patientBloodType || ""}
                            onChange={handleChange}
                            required
                            className={`form-control ${!formData.patientBloodType ? 'is-invalid' : ''}`}
                        >
                            <option value="" disabled>Patient Blood Type</option>
                            {patientBloodType.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control
                            type="text"
                            name="patientAllergies"
                            value={formData.patientAllergies}
                            onChange={handleChange}
                            placeholder="Patient Known Allergies"
                            required
                            className={`form-control ${!formData.patientAllergies ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="patientCurrentMedicine"
                            value={formData.patientCurrentMedicine}
                            onChange={handleChange}
                            placeholder="Patient Current Medicine"
                            required
                            className={`form-control ${!formData.patientCurrentMedicine ? 'is-invalid' : ''}`}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control
                            type="text"
                            name="patientChronicDiseases"
                            value={formData.patientChronicDiseases}
                            onChange={handleChange}
                            placeholder="Patient Chronic Conditions"
                            required
                            className={`form-control ${!formData.patientChronicDiseases ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="patientNotes"
                            value={formData.patientNotes}
                            onChange={handleChange}
                            placeholder="Patient Traumas & Injuries"
                            required
                            className={`form-control ${!formData.patientNotes ? 'is-invalid' : ''}`}
                        />
                    </div>
                </div>
            )}

            {/* --- 4. Advanced Directives --- */}
            <CollapsibleHeader
                title="4. Advanced Directives"
                isOpen={isAdvancedDirectivesOpen}
                onToggle={() => setIsAdvancedDirectivesOpen(!isAdvancedDirectivesOpen)}
                sectionId="advanced-directives"
            />
            {isAdvancedDirectivesOpen && (
                <div id="collapse-advanced-directives" onFocusCapture={() => setActiveSection('advanced-directives')}>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> {/* Added marginTop */}
                        <Form.Select
                            name="dnr"
                            value={formData.dnr}
                            onChange={handleChange}
                            required
                            className={`form-control ${!formData.dnr ? 'is-invalid' : ''}`}
                        >
                            <option value="" disabled>Living Will</option>
                            {dnrOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                        <Form.Select
                            name="attorney"
                            value={formData.attorney}
                            onChange={handleChange}
                            required
                            className={`form-control ${!formData.attorney ? 'is-invalid' : ''}`}
                        >
                            <option value="" disabled>Healthcare Power of Attorney</option>
                            {attorneyOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                        <Form.Select
                            name="dnrOrder"
                            value={formData.dnrOrder}
                            onChange={handleChange}
                            required
                            className={`form-control ${!formData.dnrOrder ? 'is-invalid' : ''}`}
                        >
                            <option value="" disabled>Do Not Resuscitate Order </option>
                            {dnrOrderOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {formData.dnr === 'other' && (
                            <Form.Control
                                type="text"
                                name="dnrOther"
                                value={formData.dnrOther}
                                onChange={handleChange}
                                placeholder="Other DNR Instructions"
                                required
                                className="form-control"
                            />
                        )}

                        {formData.attorney === 'Yes' && (
                            <>
                                <Form.Control
                                    type="text"
                                    name="attorneyName"
                                    value={formData.attorneyName}
                                    onChange={handleChange}
                                    placeholder="Attorney Name"
                                    required
                                    className="form-control"
                                />
                                <Form.Control
                                    type="text"
                                    name="attorneyRelation"
                                    value={formData.attorneyRelation}
                                    onChange={handleChange}
                                    placeholder="Attorney Relation"
                                    required
                                    className={`form-control ${!formData.attorneyRelation ? 'is-invalid' : ''}`}
                                />
                                <Form.Control
                                    type="text"
                                    name="attorneyPH"
                                    value={formData.attorneyPH}
                                    onChange={handleChange}
                                    placeholder="Attorney Phone Number"
                                    required
                                    className="form-control"
                                />
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* --- 5. Payment Information --- */}
            <div onFocusCapture={() => setActiveSection('payment-info')}>
                <Form.Label>Date and Proof of Payment </Form.Label>
                <span className="helper-text"> 14) How do I pay the $2,000 registration fee? <br></br> To pay your $2,000 registration fee, please log into the banking website and navigate to the "Payment" section. Select your preferred payment method (e.g., credit card, debit card), insert our routing number (020000062), enter the required payment details, review the transaction, and confirm your payment. (( Type /transfer 2000 020000062 )) <br></br>If you are a minor or a low-income citizen, please state it in your registration as you are exempt from the payment. </span>
                <Form.Control
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    placeholder="Date"
                    required
                    className={`form-control ${!formData.date ? 'is-invalid' : ''}`}
                />
                <InputGroup>
                    <Form.Control
                        as="textarea"
                        rows="2"
                        name="scenePhotos" // Assuming this field is for payment proof image URL
                        value={formData.scenePhotos}
                        onChange={handleChange}
                        placeholder="Paste image URL here or Upload"
                        required
                        className="form-control"
                        onPaste={(e) => {
                            const clipboardData = e.clipboardData || window.clipboardData;
                            const pastedData = clipboardData.getData('text');
                            const items = clipboardData.items;
                            let hasImageItem = false;
                            const urlRegex = /(https?:\/\/[^\s]+)/g;
                            const containsUrl = urlRegex.test(pastedData);

                            for (let i = 0; i < items.length; i++) {
                                if (items[i].type.indexOf('image') !== -1) {
                                    hasImageItem = true;
                                    const file = items[i].getAsFile();
                                    handleImageUpload({ target: { files: [file] } }, 'scenePhotos');
                                    e.preventDefault();
                                    break;
                                }
                            }
                            if (containsUrl && !hasImageItem) {
                                const currentValue = formData.scenePhotos || '';
                                const cursorPos = e.target.selectionStart;
                                const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                                const newValue = currentValue.slice(0, cursorPos) +
                                    (cursorPos > 0 ? separator : '') +
                                    pastedData +
                                    currentValue.slice(cursorPos);
                                setFormData(prev => ({ ...prev, scenePhotos: newValue }));
                                e.preventDefault();
                            } else {
                                console.log('No URL detected or image item present for payment proof');
                            }
                        }}
                    />
                    <Button
                        variant="success"
                        disabled={isUploading}
                        onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.multiple = true; // Allow multiple if needed, or set to false
                            input.onchange = (e) => handleImageUpload(e, 'scenePhotos');
                            input.click();
                        }}
                    >
                        <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                        {isUploading ? 'Uploading...' : 'Upload Image'}
                    </Button>
                </InputGroup>
            </div>
        </>
    );
};

export default PatientAdvanced;
