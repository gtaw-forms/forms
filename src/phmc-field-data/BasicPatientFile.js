
import React, { useState } from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';

// CollapsibleHeader copied from PatientAdvanced.js
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

const BasicPatientFile = ({
    formData,
    handleChange,
    patientTitleOptions,
    patientBloodType,
    setFormData,
    handleImageUpload,
    isUploading,
}) => {
    // Collapsible section state
    const [isGeneralInfoOpen, setIsGeneralInfoOpen] = useState(true);
    const [isContactInfoOpen, setIsContactInfoOpen] = useState(true);
    const [isMedicalHistoryOpen, setIsMedicalHistoryOpen] = useState(true);
    const [isPaymentInfoOpen, setIsPaymentInfoOpen] = useState(true);
        const [setActiveSection] = useState('general-info');
    
    const calculateCost = () => {
    if (formData.UpdateMedicalFile && formData.UpdateMedicalFile.length > 0) {
      return 2000; // Fixed price for "Update Medical File" service
    }
    return 2000;
  };
    const approximateCost = calculateCost();

    return (
        <>
            {/* --- 1. General Information --- */}
            <CollapsibleHeader
                title="General Information"
                isOpen={isGeneralInfoOpen}
                onToggle={() => setIsGeneralInfoOpen(!isGeneralInfoOpen)}
                sectionId="general-info"
            />
            {isGeneralInfoOpen && (
                <div id="collapse-general-info" onFocusCapture={() => setActiveSection('general-info')}>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> {/* Added marginTop */}
                        <Form.Control
                            type="text"
                            name="patientID"
                            value={formData.patientID}
                            onChange={handleChange}
                            placeholder="Patient ID  (Optional leave blank if unsure)"
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
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> 
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
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> 
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

                </div>
            )}

            {/* --- 2. Emergency Contact Information --- */}
            <CollapsibleHeader
                title="Emergency Contact Information"
                isOpen={isContactInfoOpen}
                onToggle={() => setIsContactInfoOpen(!isContactInfoOpen)}
                sectionId="contact-info"
            />
            {isContactInfoOpen && (
                <div id="collapse-contact-info">
                    <div style={{ display: 'flex', gap: '10px' }}>
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
                title="Medical History"
                isOpen={isMedicalHistoryOpen}
                onToggle={() => setIsMedicalHistoryOpen(!isMedicalHistoryOpen)}
                sectionId="medical-history"
            />
            {isMedicalHistoryOpen && (
                <div id="collapse-medical-history">
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Select
                            name="patientBloodType"
                            value={formData.patientBloodType || ""}
                            onChange={handleChange}
                            required
                            className={`form-control ${!formData.patientBloodType ? 'is-invalid' : ''}`}
                        >
                            <option value="" disabled>Patient Blood Type</option>
                            {(patientBloodType || []).map((option) => (
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

            {/* --- 5. Payment Information --- */}
                        <CollapsibleHeader
                title="Payment Information"
                isOpen={isPaymentInfoOpen}
                onToggle={() => setIsPaymentInfoOpen(!isPaymentInfoOpen)}
                sectionId="payment-info"
            />
            {isPaymentInfoOpen && (
                <div id="collapse-payment-info" onFocusCapture={() => setActiveSection('payment-info')}>
            {approximateCost > 0 && (
                <Form.Label style={{ marginTop: '5px', color: '#28a745', fontWeight: 'bold' }}>
                    This service will cost ${approximateCost.toLocaleString()}.
                </Form.Label>
            )}
            {approximateCost > 0 && (
                <Form.Group className="mb-3" style={{ marginTop: '15px' }}>
                    <Form.Check
                        type="checkbox"
                        id="payNowCheckbox"
                        label=" Pay Now?"
                        checked={formData.payNow === true || formData.payNow === 'true'}
                        onChange={(e) => {
                            setFormData(prev => ({
                                ...prev,
                                payNow: e.target.checked,
                            }));
                        }}
                    />

                    <span className="helper-text">
                        Tick this box if you wish to provide proof of payment now. Routing: <a href="https://banking.gta.world/transfer" target="_blank" rel="noopener noreferrer">020000062</a>. Please login to Fleeca prior to payment.
                    </span>

                </Form.Group>
            )}
                 
            {(formData.payNow === true || formData.payNow === 'true') && approximateCost > 0 && (
                <Form.Group className="mb-3 upload-container">
                    <Form.Label>Proof of Payment Image Upload</Form.Label>
                    <InputGroup>
                        <Form.Control
                            as="textarea"
                            rows={2}
                            name="paymentProofPhotos"
                            value={formData.paymentProofPhotos || ''}
                            onChange={handleChange}
                            placeholder="Paste image URL or Upload"
                            required
                            className={`form-control ${!formData.paymentProofPhotos ? 'is-invalid' : ''}`}
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
                                        handleImageUpload({ target: { files: [file] } }, 'paymentProofPhotos');
                                        e.preventDefault();
                                        break;
                                    }
                                }
                                if (containsUrl && !hasImageItem) {
                                    const currentValue = formData.paymentProofPhotos || '';
                                    const cursorPos = e.target.selectionStart;
                                    const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                                    const newValue = currentValue.slice(0, cursorPos) +
                                        (cursorPos > 0 ? separator : '') +
                                        pastedData +
                                        currentValue.slice(cursorPos);
                                    setFormData(prev => ({ ...prev, paymentProofPhotos: newValue }));
                                    e.preventDefault();
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
                                input.multiple = true;
                                input.onchange = (e) => handleImageUpload(e, 'paymentProofPhotos');
                                input.click();
                            }}
                        >
                            <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                            {isUploading ? ' Uploading...' : ' Upload Image(s)'}
                        </Button>
                    </InputGroup>
                    <span className="helper-text">
                        Upload proof of payment. Supports clipboard pasting (Ctrl+V). Hosted by Imgur.
                    </span>
                </Form.Group>
            )}
            </div>
            )}
        </>
    );
};
          
export default BasicPatientFile;
