import React from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';
import Select from 'react-select'; // Assuming you might use Select later, keep it for now or remove if unused
import {
    patientTitle,
    patientBloodType,
    maritalStatus,
    numberChildren,
    financialStatus,
    dnr,
    attorney,
    dnrOrder
} from '../data'; // Adjust path if data.js is elsewhere

const PatientAdvanced = ({
    formData,
    handleChange,
    handleImageUpload,
    isUploading,
    setFormData // Needed for onPaste
}) => {
    return (
        <>
            {/* --- Start of JSX block from App.js for bbCodeVersion === 3 --- */}
            <Form.Label>Patient ID, leave blank if unsure</Form.Label>
            <Form.Control
                type="text"
                name="patientID"
                value={formData.patientID}
                onChange={handleChange}
                placeholder="Patient ID  (Optional)"
                className={`form-control ${!formData.patientID ? 'is-invalid' : ''}`}
            />
            <Form.Label>Title / Patient Name Name / Date of Birth</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Select
                    name="patientTitle"
                    value={formData.patientTitle}
                    onChange={handleChange}
                    required
                    className={`form-control ${!formData.patientTitle ? 'is-invalid' : ''}`}
                >
                    <option value="" disabled>Title</option>
                    {patientTitle.map((option) => (
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
                    name="patientDateOfBirth" // Corrected name based on usage in BBCode
                    value={formData.patientDateOfBirth}
                    onChange={handleChange}
                    placeholder="Date of Birth"
                    required
                    className={`form-control ${!formData.patientDateOfBirth ? 'is-invalid' : ''}`}
                />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
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

            <Form.Label>Medical History </Form.Label>

            <div style={{ display: 'flex', gap: '10px' }}>
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
                    name="patientCurrentMedicine" // Corrected name
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
                    name="patientNotes" // This seems to be used for Traumas/Injuries here
                    value={formData.patientNotes}
                    onChange={handleChange}
                    placeholder="Patient Traumas & Injuries"
                    required
                    className={`form-control ${!formData.patientNotes ? 'is-invalid' : ''}`}
                />
            </div>
            <Form.Label>Mental Health History </Form.Label>

            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    type="text"
                    name="patientMental"
                    value={formData.patientMental}
                    onChange={handleChange}
                    placeholder="Diagnosed Mental Health Conditions"
                    required
                    className={`form-control ${!formData.patientMental ? 'is-invalid' : ''}`} // Corrected check
                />
                <Form.Control
                    type="text"
                    name="patientTherapy"
                    value={formData.patientTherapy}
                    onChange={handleChange}
                    placeholder="Therapies & Counseling"
                    required
                    className={`form-control ${!formData.patientTherapy ? 'is-invalid' : ''}`}
                />
                <Form.Control
                    type="text"
                    name="patientTriggers"
                    value={formData.patientTriggers}
                    onChange={handleChange}
                    placeholder="Triggers or Sensors"
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
                    placeholder="Support & Coping Systems"
                    required
                    className={`form-control ${!formData.patientSupport ? 'is-invalid' : ''}`}
                />
                <Form.Control
                    type="text"
                    name="patientHarm"
                    value={formData.patientHarm}
                    onChange={handleChange}
                    placeholder="Self-Harm History or Tendencies"
                    required
                    className={`form-control ${!formData.patientHarm ? 'is-invalid' : ''}`}
                />
            </div>
            <Form.Label>Family Medical History </Form.Label>

            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    type="text"
                    name="patientFam"
                    value={formData.patientFam}
                    onChange={handleChange}
                    placeholder="Immediate Family Members"
                    required
                    className={`form-control ${!formData.patientFam ? 'is-invalid' : ''}`}
                />
                <Form.Control
                    type="text"
                    name="patientGenetic"
                    value={formData.patientGenetic}
                    onChange={handleChange}
                    placeholder="Known Genetic Conditions"
                    required
                    className={`form-control ${!formData.patientGenetic ? 'is-invalid' : ''}`}
                />
                <Form.Control
                    type="text"
                    name="patientFamSocial"
                    value={formData.patientFamSocial}
                    onChange={handleChange}
                    placeholder="Family Social History"
                    required
                    className={`form-control ${!formData.patientFamSocial ? 'is-invalid' : ''}`}
                />
            </div>
            <Form.Label>Social Status </Form.Label>

            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Select
                    name="maritalStatus"
                    value={formData.maritalStatus}
                    onChange={handleChange}
                    required
                    className={`form-control ${!formData.maritalStatus ? 'is-invalid' : ''}`}
                >
                    <option value="" disabled>Marital Status</option>
                    {maritalStatus.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </Form.Select>
                <Form.Select
                    name="numberChildren"
                    value={formData.numberChildren}
                    onChange={handleChange}
                    required
                    className={`form-control ${!formData.numberChildren ? 'is-invalid' : ''}`}
                >
                    <option value="" disabled>Number of Children</option>
                    {numberChildren.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </Form.Select>
                <Form.Control
                    type="text"
                    name="patientReligion"
                    value={formData.patientReligion}
                    onChange={handleChange}
                    placeholder="Patient Religion"
                    required
                    className={`form-control ${!formData.patientReligion ? 'is-invalid' : ''}`}
                />
                <Form.Select
                    name="financialStatus"
                    value={formData.financialStatus}
                    onChange={handleChange}
                    required
                    className={`form-control ${!formData.financialStatus ? 'is-invalid' : ''}`}
                >
                    <option value="" disabled>Income Bracket</option>
                    {financialStatus.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </Form.Select>
            </div>
            <Form.Label>Lifestyle Information </Form.Label>

            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    type="text"
                    name="patientSmoker"
                    value={formData.patientSmoker}
                    onChange={handleChange}
                    placeholder="Patient Smoker Status"
                    required
                    className={`form-control ${!formData.patientSmoker ? 'is-invalid' : ''}`}
                />
                <Form.Control
                    type="text"
                    name="patientAlcohol"
                    value={formData.patientAlcohol}
                    onChange={handleChange}
                    placeholder="Patient Alcohol Use"
                    required
                    className={`form-control ${!formData.patientAlcohol ? 'is-invalid' : ''}`}
                />
                <Form.Control
                    type="text"
                    name="patientDrugs"
                    value={formData.patientDrugs}
                    onChange={handleChange}
                    placeholder="Other Substance Usage"
                    required
                    className={`form-control ${!formData.patientDrugs ? 'is-invalid' : ''}`}
                />
                <Form.Control
                    type="text"
                    name="patientExercise"
                    value={formData.patientExercise}
                    onChange={handleChange}
                    placeholder="Patient Exercise Habits"
                    required
                    className={`form-control ${!formData.patientExercise ? 'is-invalid' : ''}`}
                />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    type="text"
                    name="patientDiet"
                    value={formData.patientDiet}
                    onChange={handleChange}
                    placeholder="Patient Dietary Information"
                    required
                    className={`form-control ${!formData.patientDiet ? 'is-invalid' : ''}`}
                />
                <Form.Control
                    type="text"
                    name="patientSleep"
                    value={formData.patientSleep}
                    onChange={handleChange}
                    placeholder="Patient Sleeping Patterns"
                    required
                    className={`form-control ${!formData.patientSleep ? 'is-invalid' : ''}`}
                />
                <Form.Control
                    type="text"
                    name="patientSexLife"
                    value={formData.patientSexLife}
                    onChange={handleChange}
                    placeholder="Patient Sexual Health"
                    required
                    className={`form-control ${!formData.patientSexLife ? 'is-invalid' : ''}`}
                />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    type="text"
                    name="patientJobRisks"
                    value={formData.patientJobRisks}
                    onChange={handleChange}
                    placeholder="Patient Job Risks"
                    required
                    className={`form-control ${!formData.patientJobRisks ? 'is-invalid' : ''}`}
                />
                <Form.Control
                    type="text"
                    name="patientHazards"
                    value={formData.patientHazards}
                    onChange={handleChange}
                    placeholder="Patient Occupational Hazards"
                    required
                    className={`form-control ${!formData.patientHazards ? 'is-invalid' : ''}`}
                />
                <Form.Control
                    type="text"
                    name="patientOther"
                    value={formData.patientOther}
                    onChange={handleChange}
                    placeholder="Other Information & Preferences"
                    required
                    className={`form-control ${!formData.patientOther ? 'is-invalid' : ''}`}
                />
            </div>
            <Form.Label>Advanced Directives </Form.Label>

            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Select
                    name="dnr"
                    value={formData.dnr}
                    onChange={handleChange}
                    required
                    className={`form-control ${!formData.dnr ? 'is-invalid' : ''}`}
                >
                    <option value="" disabled>Living Will</option>
                    {dnr.map((option) => (
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
                    {attorney.map((option) => (
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
                    {dnrOrder.map((option) => (
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
                    <Form.Control
                        type="text"
                        name="attorneyName"
                        value={formData.attorneyName}
                        onChange={handleChange}
                        placeholder="Attorney Name"
                        required
                        className="form-control"
                    />
                )}
                {formData.attorney === 'Yes' && (
                    <Form.Control
                        type="text"
                        name="attorneyRelation"
                        value={formData.attorneyRelation}
                        onChange={handleChange}
                        placeholder="Attorney Relation"
                        required
                        className="form-control"
                    />
                )}
                {formData.attorney === 'Yes' && (
                    <Form.Control
                        type="text"
                        name="attorneyPH"
                        value={formData.attorneyPH}
                        onChange={handleChange}
                        placeholder="Attorney Phone Number"
                        required
                        className="form-control"
                    />
                )}
            </div>
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
                    onPaste={(e) => { // Keep the paste logic
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
            <span className="helper-text">
                This supports clipboard uploading, ctrl + V! | Hosted by Imgur! - <a href="https://imgur.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
            </span>
            {/* --- End of JSX block --- */}
        </>
    );
};

export default PatientAdvanced;
