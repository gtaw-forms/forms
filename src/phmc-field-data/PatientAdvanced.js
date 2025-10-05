import React, { useState } from 'react';
import { Form, Button, InputGroup, OverlayTrigger, Tooltip } from 'react-bootstrap';

import './phmc-tooltips.css'; // Assuming you have a tooltip component
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
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientID" className="phmc-tooltip">Patient ID  (Optional leave blank if unsure)</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientID"
                                value={formData.patientID}
                                onChange={handleChange}
                                placeholder="Patient ID  (Optional leave blank if unsure)"
                                className={`form-control ${!formData.patientID ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> {/* Added marginTop */}

                            <OverlayTrigger
                                placement="top"
                                overlay={<Tooltip id="tooltip-patientTitle" className="phmc-tooltip">Select the patient's title (Mr, Ms, etc).</Tooltip>}
                            >
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
                            </OverlayTrigger>
                            <OverlayTrigger
                                placement="top"
                                overlay={<Tooltip id="tooltip-patientName" className="phmc-tooltip">Patient Name</Tooltip>}
                            >
                                <Form.Control
                                    type="text"
                                    name="patientName"
                                    value={formData.patientName}
                                    onChange={handleChange}
                                    placeholder="Patient Name"
                                    required
                                    className={`form-control ${!formData.patientName ? 'is-invalid' : ''}`}
                                />
                            </OverlayTrigger>
                            <OverlayTrigger
                                placement="top"
                                overlay={<Tooltip id="tooltip-patientDateOfBirth" className="phmc-tooltip">Date of Birth</Tooltip>}
                            >
                                <Form.Control
                                    type="date"
                                    name="patientDateOfBirth"
                                    value={formData.patientDateOfBirth}
                                    onChange={handleChange}
                                    placeholder="Date of Birth"
                                    required
                                    className={`form-control ${!formData.patientDateOfBirth ? 'is-invalid' : ''}`}
                                />
                            </OverlayTrigger>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> 
                            <OverlayTrigger
                                placement="top"
                                overlay={<Tooltip id="tooltip-patientAddress" className="phmc-tooltip">Patient Home Address</Tooltip>}
                            >
                                <Form.Control
                                    type="text"
                                    name="patientAddress"
                                    value={formData.patientAddress}
                                    onChange={handleChange}
                                    placeholder="Patient Home Address"
                                    required
                                    className={`form-control ${!formData.patientAddress ? 'is-invalid' : ''}`}
                                />
                            </OverlayTrigger>
                            <OverlayTrigger
                                placement="top"
                                overlay={<Tooltip id="tooltip-patientGender" className="phmc-tooltip">Patient Gender</Tooltip>}
                            >
                                <Form.Control
                                    type="text"
                                    name="patientGender"
                                    value={formData.patientGender}
                                    onChange={handleChange}
                                    placeholder="Patient Gender"
                                    required
                                    className={`form-control ${!formData.patientGender ? 'is-invalid' : ''}`}
                                />
                            </OverlayTrigger>
                            <OverlayTrigger
                                placement="top"
                                overlay={<Tooltip id="tooltip-patientRace" className="phmc-tooltip">Patient Race</Tooltip>}
                            >
                                <Form.Control
                                    type="text"
                                    name="patientRace"
                                    value={formData.patientRace}
                                    onChange={handleChange}
                                    placeholder="Patient Race"
                                    required
                                    className={`form-control ${!formData.patientRace ? 'is-invalid' : ''}`}
                                />
                            </OverlayTrigger>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}> 
                        <OverlayTrigger
                                placement="top"
                                overlay={<Tooltip id="tooltip-patientPH" className="phmc-tooltip">Patient Phone Number</Tooltip>}
                            >
                            <Form.Control
                                type="text"
                                name="patientPH"
                                value={formData.patientPH}
                                onChange={handleChange}
                                placeholder="Patient Phone Number"
                                required
                                className={`form-control ${!formData.patientPH ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientDiscord" className="phmc-tooltip">(( Patient Discord ID )) </Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientDiscord"
                                value={formData.patientDiscord}
                                onChange={handleChange}
                                placeholder="(( Patient Discord ID )) "
                                required
                                className={`form-control ${!formData.patientDiscord ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
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
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientEmergencyContact" className="phmc-tooltip">Emergency Contact Full Name</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientEmergencyContact"
                                value={formData.patientEmergencyContact}
                                onChange={handleChange}
                                placeholder="Emergency Contact Full Name"
                                required
                                className={`form-control ${!formData.patientEmergencyContact ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientEmergencyContactRelation" className="phmc-tooltip">Emergency Contact Relation to Patient</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientEmergencyContactRelation"
                                value={formData.patientEmergencyContactRelation}
                                onChange={handleChange}
                                placeholder="Emergency Contact Relation to Patient"
                                required
                                className={`form-control ${!formData.patientEmergencyContactRelation ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientEmergencyContactNumber" className="phmc-tooltip">Emergency Contact Contact Number</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientEmergencyContactNumber"
                                value={formData.patientEmergencyContactNumber}
                                onChange={handleChange}
                                placeholder="Emergency Contact Contact Number"
                                required
                                className={`form-control ${!formData.patientEmergencyContactNumber ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientEmergencyContactDiscord" className="phmc-tooltip">(( Patient Emergency Contact Discord )) </Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientEmergencyContactDiscord"
                                value={formData.patientEmergencyContactDiscord}
                                onChange={handleChange}
                                placeholder="(( Patient Emergency Contact Discord )) "
                                required
                                className={`form-control ${!formData.patientEmergencyContactDiscord ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
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
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-allergies" className="phmc-tooltip">Known allergies of the patient.</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientAllergies"
                                value={formData.patientAllergies}
                                onChange={handleChange}
                                placeholder="Patient Known Allergies"
                                required
                                className={`form-control ${!formData.patientAllergies ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientCurrentMedicine" className="phmc-tooltip">Patient Current Medicine</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientCurrentMedicine"
                                value={formData.patientCurrentMedicine}
                                onChange={handleChange}
                                placeholder="Patient Current Medicine"
                                required
                                className={`form-control ${!formData.patientCurrentMedicine ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientChronicDiseases" className="phmc-tooltip">Patient Chronic Conditions</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientChronicDiseases"
                                value={formData.patientChronicDiseases}
                                onChange={handleChange}
                                placeholder="Patient Chronic Conditions"
                                required
                                className={`form-control ${!formData.patientChronicDiseases ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientNotes" className="phmc-tooltip">Patient Traumas & Injuries</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientNotes"
                                value={formData.patientNotes}
                                onChange={handleChange}
                                placeholder="Patient Traumas & Injuries"
                                required
                                className={`form-control ${!formData.patientNotes ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
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
                            <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientMental" className="phmc-tooltip">Patient Mental Health History</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientMental"
                                value={formData.patientMental}
                                onChange={handleChange}
                                placeholder="Patient Mental Health History"
                                required
                                className={`form-control ${!formData.patientMental ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientTherapy" className="phmc-tooltip">Patient Therapy History</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientTherapy"
                                value={formData.patientTherapy}
                                onChange={handleChange}
                                placeholder="Patient Therapy History"
                                required
                                className={`form-control ${!formData.patientTherapy ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                            <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientTriggers" className="phmc-tooltip">Patient Triggers or Phobias</Tooltip>}
                        >
                            
                            <Form.Control
                                type="text"
                                name="patientTriggers"
                                value={formData.patientTriggers}
                                onChange={handleChange}
                                placeholder="Patient Triggers or Phobias"
                                required
                                className={`form-control ${!formData.patientTriggers ? 'is-invalid' : ''}`}
                            />
                            
                        </OverlayTrigger>

                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                            <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientSupport" className="phmc-tooltip">Patient Support and Coping Mechanisms</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientSupport"
                                value={formData.patientSupport}
                                onChange={handleChange}
                                placeholder="Patient Support and Coping Mechanisms"
                                required
                                className={`form-control ${!formData.patientSupport ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                            <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip id="tooltip-patientHarm" className="phmc-tooltip">Patient Self-Harm or Harm to Others</Tooltip>}
                        >
                            <Form.Control
                                type="text"
                                name="patientHarm"
                                value={formData.patientHarm}
                                onChange={handleChange}
                                placeholder="Patient Self-Harm or Harm to Others"
                                required
                                className={`form-control ${!formData.patientHarm ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
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
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientFam" className="phmc-tooltip">Family medical history and lifestyle (e.g. chronic conditions, genetic disorders, smoking, alcohol use).</Tooltip>}>
                            <Form.Control
                                type="text"
                                name="patientFam"
                                value={formData.patientFam}
                                onChange={handleChange}
                                placeholder="Family medical history and lifestyle (e.g. chronic conditions, genetic disorders, smoking, alcohol use), etc"
                                required
                                className={`form-control ${!formData.patientFam ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientGenetic" className="phmc-tooltip">Family medical history and lifestyle (e.g. chronic conditions, genetic disorders, smoking, alcohol use).</Tooltip>}>
                            <Form.Control
                                type="text"
                                name="patientGenetic"
                                value={formData.patientGenetic}
                                onChange={handleChange}
                                placeholder="Family medical history and lifestyle (e.g. chronic conditions, genetic disorders, smoking, alcohol use), etc"
                                required
                                className={`form-control ${!formData.patientFamSocial ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientFamSocial" className="phmc-tooltip">Family medical history and lifestyle (e.g. chronic conditions, genetic disorders, smoking, alcohol use).</Tooltip>}>
                            <Form.Control
                                type="text"
                                name="patientFamSocial"
                                value={formData.patientFamSocial}
                                onChange={handleChange}
                                placeholder="Family medical history and lifestyle (e.g. chronic conditions, genetic disorders, smoking, alcohol use), etc"
                                required
                                className={`form-control ${!formData.patientFamSocial ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
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
                            <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientReligion" className="phmc-tooltip">Cultural or religious considerations for the patient.</Tooltip>}>
                                <Form.Control
                                    type="text"
                                    name="patientReligion"
                                    value={formData.patientReligion}
                                    onChange={handleChange}
                                    placeholder="Patient Cultural or Religious Considerations"
                                    required
                                    className={`form-control ${!formData.patientReligion ? 'is-invalid' : ''}`}
                                />
                            </OverlayTrigger>
                            <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-financialStatus" className="phmc-tooltip">Patient's financial status.</Tooltip>}>
                                <Form.Select
                                    name="financialStatus"
                                    value={formData.financialStatus || ""}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.financialStatus ? 'is-invalid' : ''}`}
                                >
                                    <option value="" disabled>Financial Status</option>
                                    {financialStatus.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </Form.Select>
                            </OverlayTrigger>
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
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientSmoker" className="phmc-tooltip">Patient's smoking status.</Tooltip>}>
                            <Form.Control
                                type="text"
                                name="patientSmoker"
                                value={formData.patientSmoker}
                                onChange={handleChange}
                                placeholder="Patient Smoking Status"
                                required
                                className={`form-control ${!formData.patientSmoker ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientAlcohol" className="phmc-tooltip">Patient's alcohol consumption.</Tooltip>}>
                            <Form.Control
                                type="text"
                                name="patientAlcohol"
                                value={formData.patientAlcohol}
                                onChange={handleChange}
                                placeholder="Patient Alcohol Consumption"
                                required
                                className={`form-control ${!formData.patientAlcohol ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientDrugs" className="phmc-tooltip">Patient's drug or substance use.</Tooltip>}>
                            <Form.Control
                                type="text"
                                name="patientDrugs"
                                value={formData.patientDrugs}
                                onChange={handleChange}
                                placeholder="Patient drug usage or other substance use"
                                required
                                className={`form-control ${!formData.patientDrugs ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientExercise" className="phmc-tooltip">Patient's exercise habits.</Tooltip>}>
                            <Form.Control
                                type="text"
                                name="patientExercise"
                                value={formData.patientExercise}
                                onChange={handleChange}
                                placeholder="Patient Exercise Habits"
                                required
                                className={`form-control ${!formData.patientExercise ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientDiet" className="phmc-tooltip">Patient's dietary habits.</Tooltip>}>
                            <Form.Control
                                type="text"
                                name="patientDiet"
                                value={formData.patientDiet}
                                onChange={handleChange}
                                placeholder="Patient Dietary Habits"
                                required
                                className={`form-control ${!formData.patientDiet ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientSleep" className="phmc-tooltip">Patient's sleep patterns.</Tooltip>}>
                            <Form.Control
                                type="text"
                                name="patientSleep"
                                value={formData.patientSleep}
                                onChange={handleChange}
                                placeholder="Patient Sleep Patterns"
                                required
                                className={`form-control ${!formData.patientSleep ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientSexLife" className="phmc-tooltip">Patient's sexual health (e.g. pregnancy, STIs).</Tooltip>}>
                            <Form.Control
                                type="text"
                                name="patientSexLife"
                                value={formData.patientSexLife}
                                onChange={handleChange}
                                placeholder="Patient Sexual Health (EG. Pregnancy, STIs, etc)"
                                required
                                className={`form-control ${!formData.patientSexLife ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientJobRisks" className="phmc-tooltip">Job risks or occupational hazards for the patient.</Tooltip>}>
                            <Form.Control
                                type="text"
                                name="patientJobRisks"
                                value={formData.patientJobRisks}
                                onChange={handleChange}
                                placeholder="Patient Job Risks or Occupational Hazards"
                                required
                                className={`form-control ${!formData.patientJobRisks ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientHazards" className="phmc-tooltip">Environmental hazards or exposures for the patient.</Tooltip>}>
                            <Form.Control
                                type="text"
                                name="patientHazards"
                                value={formData.patientHazards}
                                onChange={handleChange}
                                placeholder="Patient Environmental Hazards or Exposures"
                                required
                                className={`form-control ${!formData.patientHazards ? 'is-invalid' : ''}`}
                            />
                        </OverlayTrigger>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                    <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-patientOther" className="phmc-tooltip">Other information & preferences.</Tooltip>}>
                        <Form.Control
                            type="text"
                            name="patientOther"
                            value={formData.patientOther}
                            onChange={handleChange}
                            placeholder="Other information & preferences"
                            required
                            className={`form-control ${!formData.patientOther ? 'is-invalid' : ''}`}
                        />
                    </OverlayTrigger>
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
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-dnr" className="phmc-tooltip">Select Living Will / DNR preference.</Tooltip>}>
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
                        </OverlayTrigger>
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-attorney" className="phmc-tooltip">Select Healthcare Power of Attorney.</Tooltip>}>
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
                        </OverlayTrigger>
                        <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-dnrOrder" className="phmc-tooltip">Select Do Not Resuscitate Order.</Tooltip>}>
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
                        </OverlayTrigger>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {formData.dnr === 'other' && (
                            <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-dnrOther" className="phmc-tooltip">Specify other DNR instructions.</Tooltip>}>
                                <Form.Control
                                    type="text"
                                    name="dnrOther"
                                    value={formData.dnrOther}
                                    onChange={handleChange}
                                    placeholder="Other DNR Instructions"
                                    required
                                    className="form-control"
                                />
                            </OverlayTrigger>
                        )}

                        {formData.attorney === 'Yes' && (
                            <>
                                <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-attorneyName" className="phmc-tooltip">Attorney's full name.</Tooltip>}>
                                    <Form.Control
                                        type="text"
                                        name="attorneyName"
                                        value={formData.attorneyName}
                                        onChange={handleChange}
                                        placeholder="Attorney Name"
                                        required
                                        className="form-control"
                                    />
                                </OverlayTrigger>
                                <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-attorneyRelation" className="phmc-tooltip">Relation of attorney to patient.</Tooltip>}>
                                    <Form.Control
                                        type="text"
                                        name="attorneyRelation"
                                        value={formData.attorneyRelation}
                                        onChange={handleChange}
                                        placeholder="Attorney Relation"
                                        required
                                        className={`form-control ${!formData.attorneyRelation ? 'is-invalid' : ''}`}
                                    />
                                </OverlayTrigger>
                                <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-attorneyPH" className="phmc-tooltip">Attorney's phone number.</Tooltip>}>
                                    <Form.Control
                                        type="text"
                                        name="attorneyPH"
                                        value={formData.attorneyPH}
                                        onChange={handleChange}
                                        placeholder="Attorney Phone Number"
                                        required
                                        className="form-control"
                                    />
                                </OverlayTrigger>
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
                    label="  Pay Now?"
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
                    label="  I am exempt"
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
                    Tick this box if you wish to provide proof of payment now. Routing: <a href="https://banking.gta.world/transfer" target="_blank" rel="noopener noreferrer" className="phmc-tooltip">020000062</a>. Please login to Fleeca prior to payment.
                </span>
            )}
                         {isExempt && (
                                            <span className="helper-text">
                    Exemption Information: Citizens that are either a minor (under the age of 18), or are a low income State Citizen are exempted from the payment of this service.
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
                        Upload proof of payment. Supports clipboard pasting (Ctrl+V). Hosted by ImgBB.
                    </span>
                </Form.Group>
            )}
            </div>
            )}

        </>
    );
};





export default PatientAdvanced;
