import React from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';

const BasicPatientFile = ({
    formData,
    handleChange,
    patientTitleOptions: patientTitle, // Changed: Destructure patientTitleOptions and alias to patientTitle
    patientBloodType,
    handleImageUpload,
    isUploading,

}) => {
    return (
        <>
                                                        
        <Form.Group className="mb-3">
        <Form.Label>Patient ID, leave blank if unsure</Form.Label>
        <Form.Control
                    type="text"
                    name="patientID"
                    value={formData.patientID}
                    onChange={handleChange}
                    placeholder="Patient ID  (Optional)"
                    className={`form-control ${!formData.patientID ? 'is-invalid' : ''}`}

                />
        <Form.Label>Title / Patient Name Name  / Date of Birth</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Select
            name="patientTitle"
            value={formData.patientTitle}
            onChange={handleChange}
            required
            className={`form-control ${!formData.patientTitle ? 'is-invalid' : ''}`}
        >
            <option value="" disabled>Title</option>
            {/* Ensure patientTitle (the options array) is not null/undefined before mapping */}
            {(patientTitle || []).map((option) => (
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
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    placeholder="Date of Birth"
                    required
                    className={`form-control ${!formData.date ? 'is-invalid' : ''}`}

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

        </Form.Group>
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
            {(patientBloodType || []).map((option) => ( // Added fallback for patientBloodType as well
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
            <Form.Label>Date and Proof of Payment </Form.Label>
                <span className="helper-text"> 14) How do I pay the $2,000 registration fee? <br></br> To pay your $2,000 registration fee, please log into the banking website and navigate to the "Payment" section. Select your preferred payment method (e.g., credit card, debit card), insert our routing number (020000062), enter the required payment details, review the transaction, and confirm your payment. (( Type /transfer 2000 020000062 )) <br></br>If you are a minor or a low-income citizen, please state it in your registration as you are excempt from the payment. </span>
            <InputGroup>
                <Form.Control
                    as="textarea"
                    rows="2"
                    name="scenePhotos"
                    value={formData.scenePhotos}
                    onChange={handleChange}
                    placeholder="Upload your proof of payment here!"
                    required
                    className="form-control"
                    onPaste={(e) => {
                        e.preventDefault();
                        const items = e.clipboardData.items;
                        for (let i = 0; i < items.length; i++) {
                            if (items[i].type.indexOf('image') !== -1) {
                                const file = items[i].getAsFile();
                                handleImageUpload({ target: { files: [file] } }, 'scenePhotos');
                            }
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
                        input.onchange = (e) => handleImageUpload(e, 'scenePhotos');
                        input.click();
                    }}
                >
                    <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                    {isUploading ? 'Uploading...' : 'Upload Images'}
                </Button>

            </InputGroup>

        </>

    );
};
          
export default BasicPatientFile;
