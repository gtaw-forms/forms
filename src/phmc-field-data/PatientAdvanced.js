import React, { useState } from 'react';
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
    maritalStatus,
    numberChildren,
    financialStatus,
    selectOptions
}) => {
    const [isGeneralInfoOpen, setIsGeneralInfoOpen] = useState(true);
    const [isContactInfoOpen, setIsContactInfoOpen] = useState(true);
    const [isMentalHealthOpen, setIsMentalHealthOpen] = useState(true);
    const [isFamilyHistoryOpen, setIsFamilyHistoryOpen] = useState(true);
    const [isSocialHistoryOpen, setIsSocialHistoryOpen] = useState(true);
    const [isLifestyleOpen, setIsLifestyleOpen] = useState(true);
    const [isMedicalHistoryOpen, setIsMedicalHistoryOpen] = useState(true);
    const [isAdvancedDirectivesOpen, setIsAdvancedDirectivesOpen] = useState(true);
    const [isPaymentInfoOpen, setIsPaymentInfoOpen] = useState(true);
const [activeSection, setActiveSection] = useState('general-info');
        const isPayNow = formData.payNow === true || formData.payNow === 'true';
        const isExempt = formData.isExempt === true || formData.isExempt === 'true';
        const calculateCost = () => {
            if (isExempt) return 0;
            if (formData.UpdateMedicalFile && formData.UpdateMedicalFile.length > 0) {
                return 2000;
            }
            return 2000;
        };
        const approximateCost = calculateCost();


    const dnrOptions = selectOptions.dnr || [];
    const attorneyOptions = selectOptions.attorney || [];
    const dnrOrderOptions = selectOptions.dnrOrder || [];


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

            {/* --- Emergency Contact Information --- */}
            <CollapsibleHeader
                title="Emergency Contact Information"
                isOpen={isContactInfoOpen}
                onToggle={() => setIsContactInfoOpen(!isContactInfoOpen)}
                sectionId="contact-info"
            />
            {isContactInfoOpen && (
                <div id="collapse-contact-info" onFocusCapture={() => setActiveSection('contact-info')}>
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
                title="Medical History"
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
            {/* --- 3. Mental Health History --- */}
            <CollapsibleHeader
                title="Mental Health History"
                isOpen={isMentalHealthOpen}
                onToggle={() => setIsMentalHealthOpen(!isMentalHealthOpen)}
                sectionId="mental-health"
            />
            {isMentalHealthOpen && (
                <div id="collapse-mental-health" onFocusCapture={() => setActiveSection('mental-health')}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control
                            type="text"
                            name="patientMental"
                            value={formData.patientMental}
                            onChange={handleChange}
                            placeholder="Patient Mental Health History"
                            required
                            className={`form-control ${!formData.patientMental ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="patientTherapy"
                            value={formData.patientTherapy}
                            onChange={handleChange}
                            placeholder="Patient Therapy History"
                            required
                            className={`form-control ${!formData.patientTherapy ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="patientTriggers"
                            value={formData.patientTriggers}
                            onChange={handleChange}
                            placeholder="Patient Triggers or Phobias"
                            required
                            className={`form-control ${!formData.patientTriggers ? 'is-invalid' : ''}`}
                        />

                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control
                            type="text"
                            name="patientSupport"
                            value={formData.patientSupport}
                            onChange={handleChange}
                            placeholder="Patient Support and Coping Mechanisms"
                            required
                            className={`form-control ${!formData.patientSupport ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="patientHarm"
                            value={formData.patientHarm}
                            onChange={handleChange}
                            placeholder="Patient Self-Harm or Harm to Others"
                            required
                            className={`form-control ${!formData.patientHarm ? 'is-invalid' : ''}`}
                        />
                    </div>
                </div>
            )}
            {/* ---  Family Health History --- */}
            <CollapsibleHeader
                title="Family Health History"
                isOpen={isFamilyHistoryOpen}
                onToggle={() => setIsFamilyHistoryOpen(!isFamilyHistoryOpen)}
                sectionId="family-history"
            />
            {isFamilyHistoryOpen && (
                <div id="collapse-family-health" onFocusCapture={() => setActiveSection('family-history')}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control
                            type="text"
                            name="patientFam"
                            value={formData.patientFam}
                            onChange={handleChange}
                            placeholder="Patient Immediate Family Members"
                            required
                            className={`form-control ${!formData.patientFam ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="patientGenetic"
                            value={formData.patientGenetic}
                            onChange={handleChange}
                            placeholder="Patient Genetic Conditions or Disorders"
                            required
                            className={`form-control ${!formData.patientGenetic ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="patientFamSocial"
                            value={formData.patientFamSocial}
                            onChange={handleChange}
                            placeholder="Family medical history and lifestyle (e.g. chronic conditions, genetic disorders, smoking, alcohol use), etc"
                            required
                            className={`form-control ${!formData.patientFamSocial ? 'is-invalid' : ''}`}
                        />

                    </div>
                </div>
            )}
            {/* --- Social Information --- */}
            <CollapsibleHeader
                title="Social Information"
                isOpen={isSocialHistoryOpen}
                onToggle={() => setIsSocialHistoryOpen(!isSocialHistoryOpen)}
                sectionId="social-information"
            />
            {isSocialHistoryOpen && (
                <div id="collapse-social-information" onFocusCapture={() => setActiveSection('social-information')}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Select
                            name="maritalStatus"
                            value={formData.maritalStatus || ""}
                            onChange={handleChange}
                            required
                            className={`form-control ${!formData.maritalStatus ? 'is-invalid' : ''}`}
                        >
                            <option value="" disabled>Patient Marital Status</option>
                            {maritalStatus.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                        <Form.Select
                            name="numberChildren"
                            value={formData.numberChildren || ""}
                            onChange={handleChange}
                            required
                            className={`form-control ${!formData.numberChildren ? 'is-invalid' : ''}`}
                        >
                            <option value="" disabled>Number of Children</option>
                            {numberChildren.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                    </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <Form.Control
                                type="text"
                                name="patientReligion"
                                value={formData.patientReligion}
                                onChange={handleChange}
                                placeholder="Patient Cultural or Religious Considerations"
                                required
                            className={`form-control ${!formData.patientReligion ? 'is-invalid' : ''}`}
                            />
                        <Form.Select
                            name="financialStatus"
                            value={formData.financialStatus || ""}
                            onChange={handleChange}
                            required
                            className={`form-control ${!formData.financialStatus ? 'is-invalid' : ''}`}
                        >
                            <option value="" disabled>Number of Children</option>
                            {financialStatus.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                    </div>

                </div>
            )}
            {/* ---  Lifestyle Information --- */}
            <CollapsibleHeader
                title="Lifestyle Information"
                isOpen={isLifestyleOpen}
                onToggle={() => setIsLifestyleOpen(!isLifestyleOpen)}
                sectionId="Lifestyle-Information"
            />
            {isLifestyleOpen && (
                <div id="collapse-Lifestyle-Information" onFocusCapture={() => setActiveSection('Lifestyle-Information')}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control
                            type="text"
                            name="patientSmoker"
                            value={formData.patientSmoker}
                            onChange={handleChange}
                            placeholder="Patient Smoking Status"
                            required
                            className={`form-control ${!formData.patientSmoker ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="patientAlcohol"
                            value={formData.patientAlcohol}
                            onChange={handleChange}
                            placeholder="Patient Alcohol Consumption"
                            required
                            className={`form-control ${!formData.patientAlcohol ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="patientDrugs"
                            value={formData.patientDrugs}
                            onChange={handleChange}
                            placeholder="Patient drug usage or other substance use"
                            required
                            className={`form-control ${!formData.patientDrugs ? 'is-invalid' : ''}`}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control
                            type="text"
                            name="patientExercise"
                            value={formData.patientExercise}
                            onChange={handleChange}
                            placeholder="Patient Exercise Habits"
                            required
                            className={`form-control ${!formData.patientExercise ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="patientDiet"
                            value={formData.patientDiet}
                            onChange={handleChange}
                            placeholder="Patient Dietary Habits"
                            required
                            className={`form-control ${!formData.patientDiet ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="patientSleep"
                            value={formData.patientSleep}
                            onChange={handleChange}
                            placeholder="Patient Sleep Patterns"
                            required
                            className={`form-control ${!formData.patientSleep ? 'is-invalid' : ''}`}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control
                            type="text"
                            name="patientSexLife"
                            value={formData.patientSexLife}
                            onChange={handleChange}
                            placeholder="Patient Sexual Health (EG. Pregnancy, STIs, etc)"
                            required
                            className={`form-control ${!formData.patientSexLife ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="patientJobRisks"
                            value={formData.patientJobRisks}
                            onChange={handleChange}
                            placeholder="Patient Job Risks or Occupational Hazards"
                            required
                            className={`form-control ${!formData.patientJobRisks ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="patientHazards"
                            value={formData.patientHazards}
                            onChange={handleChange}
                            placeholder="Patient Environmental Hazards or Exposures"
                            required
                            className={`form-control ${!formData.patientHazards ? 'is-invalid' : ''}`}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                    <Form.Control
                        type="text"
                        name="patientOther"
                        value={formData.patientOther}
                        onChange={handleChange}
                        placeholder="Other information & preferences"
                        required
                        className={`form-control ${!formData.patientOther ? 'is-invalid' : ''}`}
                    />
                </div>

                </div>
            )}

            {/* ---  Advanced Directives --- */}
            <CollapsibleHeader
                title="Advanced Directives"
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
                        <CollapsibleHeader
                title="Payment Information"
                isOpen={isPaymentInfoOpen}
                onToggle={() => setIsPaymentInfoOpen(!isPaymentInfoOpen)}
                sectionId="payment-info"
            />
            {isPaymentInfoOpen && (
                <div id="collapse-payment-info" onFocusCapture={() => setActiveSection('payment-info')}>

            <Form.Label style={{ marginTop: '5px', color: '#28a745', fontWeight: 'bold' }}>
                This service will cost ${approximateCost.toLocaleString()}.
            </Form.Label>
            <Form.Group className="mb-3" style={{ marginTop: '15px', display: 'flex', alignItems: 'center', gap: '2rem' }}>
                <Form.Check
                    type="radio"
                    id="payNowRadio"
                    label="Pay Now?"
                    name="paymentOption"
                    checked={isPayNow}
                    onChange={() => {
                        setFormData(prev => ({
                            ...prev,
                            payNow: true,
                            isExempt: false,
                        }));
                    }}
                    style={{ marginRight: '1rem' }}
                />
                <Form.Check
                    type="radio"
                    id="exemptRadio"
                    label="I am exempt"
                    name="paymentOption"
                    checked={isExempt}
                    onChange={() => {
                        setFormData(prev => ({
                            ...prev,
                            payNow: false,
                            isExempt: true,
                            paymentProofPhotos: '',
                        }));
                    }}
                />
            </Form.Group>
            {isPayNow && approximateCost > 0 && (
                <span className="helper-text">
                    Tick this box if you wish to provide proof of payment now. Routing: <a href="https://banking.gta.world/transfer" target="_blank" rel="noopener noreferrer">020000062</a>. Please login to Fleeca prior to payment.
                </span>
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





export default PatientAdvanced;
