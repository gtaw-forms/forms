import React, { useState, useEffect } from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';
import Select from 'react-select';
import useGtaWorldAuth from '../hooks/useGtaWorldAuth';
import { cleanRankText } from '../utils/textUtils';
import CharacterSelector from '../components/CharacterSelector';
import { getCharacterName } from '../utils/characterUtils';
import EmployeeCredentialsSection from '../components/EmployeeCredentialsSection';

const MedicalRecords = ({
    formData,
    handleChange,
    setFormData,
    patientTitleOptions,
    patientPhoneOptions,
    purposeOptions,
    formatOptions,
    medicalRecordOptions,
    phmcGroupedOptions,
    patientBloodType,
    numberChildren,
    maritalStatus,
    patientTitleNew,
    dnrOrder,
    financialStatus,
    attorney,
    dnr,
    UpdateMedicalFile,
    handleImageUpload,
    isUploading,
    setShowEmployeeModal,
    handleSelectChange
}) => {
    const [formType, setFormType] = useState('release'); // 'release' or 'update'

    useEffect(() => {
        setFormData(prev => ({ ...prev, formType }));
    }, [formType, setFormData]);

    // Character selection state
    const [selectedCharacter, setSelectedCharacter] = useState(null);

    // Character selection handler
    const handleCharacterSelect = (character) => {
        if (formType === 'release') {
            // For release form, populate first/last name
            if (character && character.firstname && character.lastname) {
                const updatedFormData = {
                    ...formData,
                    patientFirstName: character.firstname,
                    patientLastName: character.lastname
                };
                setFormData(updatedFormData);
            }
        } else {
            // For update form, populate full name
            if (character && character.fullName) {
                const syntheticEvent = {
                    target: {
                        name: 'patientName',
                        value: character.fullName
                    }
                };
                handleChange(syntheticEvent);
            }
        }
    };

    const calculateCost = () => {
        if (formType === 'release') {
            const selectedCount = formData.MedicalRecordsRelease?.length || 0;
            if (selectedCount === 0) {
                return 0;
            }
            const costPerItem = 5000;
            return selectedCount * costPerItem;
        } else {
            // Update form has fixed cost
            if (formData.UpdateMedicalFile && formData.UpdateMedicalFile.length > 0) {
                return 1000;
            }
            return 0;
        }
    };

    const approximateCost = calculateCost();

    return (
        <>
            <Form.Group className="mb-3">
                <Form.Label>Form Type</Form.Label>
                <div>
                    <Button variant={formType === 'release' ? 'primary' : 'secondary'} onClick={() => setFormType('release')}>Release Medical Records</Button>
                    <Button variant={formType === 'update' ? 'primary' : 'secondary'} onClick={() => setFormType('update')} className="ms-2">Update Medical Records</Button>
                </div>
            </Form.Group>

            {/* Form Type Description */}
            {formType === 'release' && (
                <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
                    <strong>Medical Records Release:</strong> Request copies of existing medical records for treatment continuation, legal purposes, insurance, or personal use. Specify the date range and types of records needed, with authorization for release to designated parties.
                </div>
            )}
            {formType === 'update' && (
                <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
                    <strong>Update Medical Records:</strong> Modify existing patient information including contact details, medical history, emergency contacts, mental health records, family history, social information, lifestyle factors, and advanced healthcare directives.
                </div>
            )}

            {/* Character Selector and Patient Title - Inline */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '1rem', marginBottom: '1rem' }}>
                <div style={{ flex: '2' }}>
                    <CharacterSelector
                        onCharacterSelect={handleCharacterSelect}
                        selectedCharacterId={selectedCharacter?.id}
                        label="Select Character (Login with GTAW to see your characters)"
                        forceDropdown={true}
                    />
                </div>
                <div style={{ flex: '1' }}>
                    <div>
                        <label style={{ marginBottom: '0.5rem', display: 'block' }}>Title</label>
                        <Form.Select
                            name="patientTitle"
                            value={formData.patientTitle}
                            onChange={handleChange}
                            required
                            className={`form-control ${!formData.patientTitle ? 'is-invalid' : ''}`}
                            style={{
                                padding: '8px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                fontSize: '14px'
                            }}
                        >
                            <option value="" disabled>Title</option>
                            {patientTitleOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                    </div>
                </div>
            </div>

            {formType === 'release' ? (
                // RELEASE FORM FIELDS
                <>
                    <Form.Group className="mb-3">
                        <Form.Control
                            type="date"
                            name="patientDateOfBirth"
                            value={formData.patientDateOfBirth}
                            onChange={handleChange}
                            placeholder="Date of Birth"
                            required
                            className={`form-control ${!formData.patientDateOfBirth ? 'is-invalid' : ''}`}
                        />
                        <Form.Label>Gender:</Form.Label>
                        <Form.Check
                            type="radio"
                            label="   Male"
                            name="patientGender"
                            value="Male"
                            checked={formData.patientGender === 'Male'}
                            onChange={handleChange}
                        />
                        <Form.Check
                            type="radio"
                            label="   Female"
                            name="patientGender"
                            value="Female"
                            checked={formData.patientGender === 'Female'}
                            onChange={handleChange}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>Address & ZIP / Postal Code</Form.Label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <Form.Control
                                type="text"
                                name="patientAddress"
                                value={formData.patientAddress}
                                onChange={handleChange}
                                placeholder="Address (Number, Floor, Street)"
                                required
                                className={`form-control ${!formData.patientAddress ? 'is-invalid' : ''}`}
                            />
                            <Form.Control
                                type="text"
                                name="patientZIP"
                                value={formData.patientZIP}
                                onChange={handleChange}
                                placeholder="ZIP / Postal Code ((You can make this up))"
                                required
                                className={`form-control ${!formData.patientZIP ? 'is-invalid' : ''}`}
                            />
                        </div>
                    </Form.Group>

                    <Form.Label>Contact Information</Form.Label>
                    <div className="input-group">
                        <Form.Select
                            name="patientPhoneType"
                            value={formData.patientPhoneType}
                            onChange={(e) => {
                                const selectedType = e.target.value;
                                setFormData(prev => ({
                                    ...prev,
                                    patientPhoneType: selectedType,
                                    patientPhoneMobile: selectedType === 'Mobile' ? prev.patientPhoneMobile : '',
                                    patientPhoneHome: selectedType === 'Home' ? prev.patientPhoneHome : '',
                                    patientPhoneWork: selectedType === 'Work' ? prev.patientPhoneWork : '',
                                    patientPhoneOther: selectedType === 'Other' ? prev.patientPhoneOther : '',
                                }));
                            }}
                            required
                            className={`form-control ${!formData.patientPhoneType ? 'is-invalid' : ''}`}
                        >
                            <option value="" disabled>Phone Type</option>
                            {(patientPhoneOptions || []).map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                        <Form.Control
                            type="text"
                            name="patientPH"
                            value={formData.patientPH}
                            onChange={handleChange}
                            placeholder="Phone Number"
                            required
                            className={`form-control ${!formData.patientPH ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="patientEmail"
                            value={formData.patientEmail}
                            onChange={handleChange}
                            placeholder="Email Address"
                            required
                            className={`form-control ${!formData.patientEmail ? 'is-invalid' : ''}`}
                        />
                    </div>

                    <Form.Label>Purpose of Medical Information Release</Form.Label>
                    <Form.Select
                        name="CarePurposeMedicalInformationRelease"
                        value={formData.CarePurposeMedicalInformationRelease}
                        onChange={(e) => {
                            const selectedType = e.target.value;
                            setFormData(prev => ({
                                ...prev,
                                CarePurposeMedicalInformationRelease: selectedType,
                                PurposeFurtherCare: selectedType === 'Further Treatment' ? prev.PurposeFurtherCare : '',
                                PurposePersonal: selectedType === 'Personal' ? prev.PurposePersonal : '',
                                PurposeAttorney: selectedType === 'Attorney' ? prev.PurposeAttorney : '',
                                PurposeOther: selectedType === 'Other' ? prev.PurposeOther : '',
                            }));
                        }}
                        required
                        className={`form-control ${!formData.CarePurposeMedicalInformationRelease ? 'is-invalid' : ''}`}
                    >
                        <option value="" disabled>Release Information</option>
                        {(purposeOptions || []).map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Form.Select>

                    {formData.CarePurposeMedicalInformationRelease === 'Other' && (
                        <Form.Control
                            type="text"
                            name="patientMedInfoReleaseOther"
                            value={formData.patientMedInfoReleaseOther}
                            onChange={handleChange}
                            placeholder="Add a different release reason (Ex: Insurance / Courts)"
                            required
                            className={`form-control ${!formData.patientMedInfoReleaseOther ? 'is-invalid' : ''}`}
                        />
                    )}

                    <Form.Label>Format of Medical Information Release </Form.Label>
                    <Form.Select
                        name="PurposeMedicalInformationReleaseFormat"
                        value={formData.PurposeMedicalInformationReleaseFormat}
                        onChange={(e) => {
                            const selectedType = e.target.value;
                            setFormData(prev => ({
                                ...prev,
                                PurposeMedicalInformationReleaseFormat: selectedType,
                                CopyofRecords: selectedType === 'CopyofRecords' ? prev.CopyofRecords : '',
                                VerbalRelease: selectedType === 'VerbalRelease' ? prev.VerbalRelease : '',
                                ElectronicRelease: selectedType === 'ElectronicRelease' ? prev.ElectronicRelease : '',
                                Other: selectedType === 'Other' ? prev.Other : '',
                            }));
                        }}
                        required
                        className={`form-control ${!formData.PurposeMedicalInformationReleaseFormat ? 'is-invalid' : ''}`}
                    >
                        <option value="" disabled>Release Information</option>
                        {(formatOptions || []).map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Form.Select>

                    {formData.PurposeMedicalInformationReleaseFormat === 'Other' && (
                        <Form.Control
                            type="text"
                            name="patientMedInfoFormatOther"
                            value={formData.patientMedInfoFormatOther}
                            onChange={handleChange}
                            placeholder="Add a different release option (Ex: FAX)"
                            required
                            className={`form-control ${!formData.patientMedInfoFormatOther ? 'is-invalid' : ''}`}
                        />
                    )}

                    <Form.Label>Record Release Time Frame </Form.Label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control
                            type="text"
                            name="StupidDateFrom"
                            value={formData.StupidDateFrom}
                            onChange={handleChange}
                            placeholder="Treatment Date From"
                            required
                            className={`form-control ${!formData.StupidDateFrom ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="StupidDateTo"
                            value={formData.StupidDateTo}
                            onChange={handleChange}
                            placeholder="Treatment Date To"
                            required
                            className={`form-control ${!formData.StupidDateTo ? 'is-invalid' : ''}`}
                        />
                    </div>

                    <Form.Label>Medical Records to be Released </Form.Label>
                    <Select
                        isMulti
                        name="MedicalRecordsRelease"
                        value={(medicalRecordOptions || []).filter(option =>
                            formData.MedicalRecordsRelease?.includes(option.value)
                        )}
                        onChange={(selectedOptions) => {
                            setFormData(prev => ({
                                ...prev,
                                MedicalRecordsRelease: selectedOptions ? selectedOptions.map(option => option.value) : []
                            }));
                        }}
                        options={medicalRecordOptions || []}
                        className={`form-control ${!formData.MedicalRecordsRelease || formData.MedicalRecordsRelease.length === 0 ? 'is-invalid' : ''}`}
                        placeholder="Select Release Options (Multiple Choice)"
                        styles={{
                            control: (base, state) => ({
                                ...base,
                                minHeight: '38px',
                                backgroundColor: '#16202c',
                                color: '#eeeeeeb0',
                                borderColor: !formData.MedicalRecordsRelease || formData.MedicalRecordsRelease.length === 0 ? '#dc3545' : '#6c757d',
                                '&:hover': {
                                    borderColor: !formData.MedicalRecordsRelease || formData.MedicalRecordsRelease.length === 0 ? '#dc3545' : '#eeeeeeb0'
                                }
                            }),
                            menu: (base) => ({
                                ...base,
                                backgroundColor: '#16202c',
                                zIndex: 1000,
                                border: '1px solid #6c757d',
                                borderRadius: '0.375rem'
                            }),
                            option: (base, state) => ({
                                ...base,
                                backgroundColor: state.isFocused ? '#30363d' : '#16202c',
                                color: '#eeeeeeb0',
                                padding: '0.5rem 1rem',
                                '&:hover': {
                                    backgroundColor: '#30363d'
                                }
                            }),
                            multiValue: (base) => ({
                                ...base,
                                backgroundColor: '#30363d',
                                color: '#eeeeeeb0'
                            }),
                            multiValueLabel: (base) => ({
                                ...base,
                                color: '#eeeeeeb0'
                            }),
                            multiValueRemove: (base) => ({
                                ...base,
                                color: '#6c757d',
                                '&:hover': {
                                    backgroundColor: '#dc3545',
                                    color: '#fff'
                                }
                            }),
                            input: (base) => ({
                                ...base,
                                color: '#eeeeeeb0'
                            }),
                            placeholder: (base) => ({
                                ...base,
                                color: '#6c757d'
                            })
                        }}
                    />

                    {formData.MedicalRecordsRelease && formData.MedicalRecordsRelease.includes('Other') && (
                        <Form.Control
                            type="text"
                            name="MedicalRecordsReleaseOther"
                            value={formData.MedicalRecordsReleaseOther}
                            onChange={handleChange}
                            placeholder="Please specify other records to be released"
                            required
                            className={`form-control ${!formData.MedicalRecordsReleaseOther ? 'is-invalid' : ''}`}
                        />
                    )}

                    <EmployeeCredentialsSection
                        formData={formData}
                        setFormData={setFormData}
                        groupedOptions={phmcGroupedOptions}
                        handleSelectChange={handleSelectChange}
                        setShowEmployeeModal={setShowEmployeeModal}
                        employeeType="phmc"
                    />

                    <Form.Label>Authorization For Release Information</Form.Label>
                    <Form.Control
                        type="date"
                        name="SubmitDate"
                        value={formData.SubmitDate || new Date().toISOString().split('T')[0]}
                        onChange={handleChange}
                        readOnly
                        className="form-control"
                    />
                </>
            ) : (
                // UPDATE FORM FIELDS
                <>
                    <div className="input-group">
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

                    <Form.Label>Update Medical File Options</Form.Label>
                    <Select
                        isMulti
                        name="UpdateMedicalFile"
                        value={(UpdateMedicalFile || []).filter(option =>
                            formData.UpdateMedicalFile?.includes(option.value)
                        )}
                        onChange={(selectedOptions) => {
                            setFormData(prev => ({
                                ...prev,
                                UpdateMedicalFile: selectedOptions ? selectedOptions.map(option => option.value) : []
                            }));
                        }}
                        options={UpdateMedicalFile || []}
                        className={`form-control ${!formData.UpdateMedicalFile || formData.UpdateMedicalFile.length === 0 ? 'is-invalid' : ''}`}
                        placeholder="Which fields do you want to update? (You can type to search!)"
                        classNamePrefix="react-select"
                    />

                    {/* Dynamic Sections based on selected options */}
                    {formData.UpdateMedicalFile?.includes('GeneralInformation') && (
                        <div style={{ marginTop: '20px' }}>
                            <Form.Label>Update General Information </Form.Label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Select
                                    name="patientTitleNew"
                                    value={formData.patientTitleNew}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.patientTitleNew ? 'is-invalid' : ''}`}
                                >
                                    <option value="" disabled>Title</option>
                                    {(patientTitleNew || []).map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </Form.Select>
                                <Form.Control
                                    type="text"
                                    name="patientNameNew"
                                    value={formData.patientNameNew}
                                    onChange={handleChange}
                                    placeholder="Patient Name"
                                    required
                                    className={`form-control ${!formData.patientNameNew ? 'is-invalid' : ''}`}
                                />
                                <Form.Control
                                    type="date"
                                    name="patientDateOfBirthNew"
                                    value={formData.patientDateOfBirthNew}
                                    onChange={handleChange}
                                    placeholder="Date of Birth"
                                    required
                                    className={`form-control ${!formData.patientDateOfBirthNew ? 'is-invalid' : ''}`}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control
                                    type="text"
                                    name="patientAddressNew"
                                    value={formData.patientAddressNew}
                                    onChange={handleChange}
                                    placeholder="Patient Home Address"
                                    required
                                    className={`form-control ${!formData.patientAddressNew ? 'is-invalid' : ''}`}
                                />
                                <Form.Control
                                    type="text"
                                    name="patientGenderNew"
                                    value={formData.patientGenderNew}
                                    onChange={handleChange}
                                    placeholder="Patient Gender"
                                    required
                                    className={`form-control ${!formData.patientGenderNew ? 'is-invalid' : ''}`}
                                />
                                <Form.Control
                                    type="text"
                                    name="patientRaceNew"
                                    value={formData.patientRaceNew}
                                    onChange={handleChange}
                                    placeholder="Patient Race"
                                    required
                                    className={`form-control ${!formData.patientRaceNew ? 'is-invalid' : ''}`}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control
                                    type="text"
                                    name="patientPHNew"
                                    value={formData.patientPHNew}
                                    onChange={handleChange}
                                    placeholder="Patient Phone Number"
                                    required
                                    className={`form-control ${!formData.patientPHNew ? 'is-invalid' : ''}`}
                                />
                                <Form.Control
                                    type="text"
                                    name="patientDiscordNew"
                                    value={formData.patientDiscordNew}
                                    onChange={handleChange}
                                    placeholder="(( Patient Discord ID )) "
                                    required
                                    className={`form-control ${!formData.patientDiscordNew ? 'is-invalid' : ''}`}
                                />
                            </div>
                        </div>
                    )}

                    {formData.UpdateMedicalFile?.includes('MentalHealth') && (
                        <div style={{ marginTop: '20px' }}>
                            <Form.Label>Update Mental Health History</Form.Label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control
                                    type="text"
                                    name="patientMental"
                                    value={formData.patientMental}
                                    onChange={handleChange}
                                    placeholder="Diagnosed Mental Health Conditions"
                                />
                                <Form.Control
                                    type="text"
                                    name="patientTherapy"
                                    value={formData.patientTherapy}
                                    onChange={handleChange}
                                    placeholder="Therapies & Counseling Sessions"
                                />
                                <Form.Control
                                    type="text"
                                    name="patientTriggers"
                                    value={formData.patientTriggers}
                                    onChange={handleChange}
                                    placeholder="Triggers or Sensory Issues"
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control
                                    type="text"
                                    name="patientSupport"
                                    value={formData.patientSupport}
                                    onChange={handleChange}
                                    placeholder="Support & Self Coping Mechanisms"
                                />
                                <Form.Control
                                    type="text"
                                    name="patientHarm"
                                    value={formData.patientHarm}
                                    onChange={handleChange}
                                    placeholder="Self Harm History or Attempts"
                                />
                            </div>
                        </div>
                    )}

                    {formData.UpdateMedicalFile?.includes('EmergencyContact') && (
                        <div style={{ marginTop: '20px' }}>
                            <Form.Label>Update Emergency Contact Information</Form.Label>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
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

                    {formData.UpdateMedicalFile?.includes('MedicalHistory') && (
                        <div style={{ marginTop: '20px' }}>
                            <Form.Label>Update Medical History</Form.Label>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
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

                    {formData.UpdateMedicalFile?.includes('FamilyHistory') && (
                        <div style={{ marginTop: '20px' }}>
                            <Form.Label>Update Medical History</Form.Label>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                                <Form.Control
                                    type="text"
                                    name="patientFam"
                                    value={formData.patientFam}
                                    onChange={handleChange}
                                    placeholder="Immediate Family Members"
                                />
                                <Form.Control
                                    type="text"
                                    name="patientGenetic"
                                    value={formData.patientGenetic}
                                    onChange={handleChange}
                                    placeholder="Genetic Conditions"
                                />
                                <Form.Control
                                    type="text"
                                    name="patientFamSocial"
                                    value={formData.patientFamSocial}
                                    onChange={handleChange}
                                    placeholder="Family Social History"
                                />
                            </div>
                        </div>
                    )}

                    {formData.UpdateMedicalFile?.includes('SocialInformation') && (
                        <>
                            <Form.Label>Update Social Information</Form.Label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Select
                                    name="maritalStatus"
                                    value={formData.maritalStatus || ""}
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
                                    placeholder="Cultural and/or Religious Considerations"
                                />
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
                            </div>
                        </>
                    )}

                    {formData.UpdateMedicalFile?.includes('Lifestyle') && (
                        <>
                            <Form.Label>Update Lifestyle Information</Form.Label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control
                                    type="text"
                                    name="patientSmoker"
                                    value={formData.patientSmoker}
                                    onChange={handleChange}
                                    placeholder="Smoking Habits"
                                    required
                                    className={`form-control ${!formData.patientSmoker ? 'is-invalid' : ''}`}
                                />
                                <Form.Control
                                    type="text"
                                    name="patientAlcohol"
                                    value={formData.patientAlcohol}
                                    onChange={handleChange}
                                    placeholder="Alcohol Consumption"
                                    required
                                    className={`form-control ${!formData.patientAlcohol ? 'is-invalid' : ''}`}
                                />
                                <Form.Control
                                    type="text"
                                    name="Other Substances"
                                    value={formData.patientDrugs}
                                    onChange={handleChange}
                                    placeholder="Drug Use and Other Substances"
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
                                    placeholder="Dietary Information"
                                    required
                                    className={`form-control ${!formData.patientDiet ? 'is-invalid' : ''}`}
                                />
                                <Form.Control
                                    type="text"
                                    name="patientSleep"
                                    value={formData.patientSleep}
                                    onChange={handleChange}
                                    placeholder="Sleeping Patterns"
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
                                    placeholder="Sexual Health (eg. Healthy)"
                                    required
                                    className={`form-control ${!formData.patientSexLife ? 'is-invalid' : ''}`}
                                />
                                <Form.Control
                                    type="text"
                                    name="patientJobRisks"
                                    value={formData.patientJobRisks}
                                    onChange={handleChange}
                                    placeholder="Job risks or hazards"
                                    required
                                    className={`form-control ${!formData.patientJobRisks ? 'is-invalid' : ''}`}
                                />
                                <Form.Control
                                    type="text"
                                    name="patientHazards"
                                    value={formData.patientHazards}
                                    onChange={handleChange}
                                    placeholder="Enviromental Hazards or Risks"
                                    required
                                    className={`form-control ${!formData.patientHazards ? 'is-invalid' : ''}`}
                                />
                                <Form.Control
                                    type="text"
                                    name="patientOther"
                                    value={formData.patientOther}
                                    onChange={handleChange}
                                    placeholder="Other information or preferences"
                                    required
                                    className={`form-control ${!formData.patientOther ? 'is-invalid' : ''}`}
                                />
                            </div>
                        </>
                    )}

                    {formData.UpdateMedicalFile?.includes('AdvancedDirectives') && (
                        <div style={{ marginTop: '20px' }}>
                            <Form.Label>Update Advanced Directives</Form.Label>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
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
                                            placeholder="Power of Attorney Relation"
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
                </>
            )}

            {/* Payment Section - Common to both forms */}
            {approximateCost > 0 && (
                <Form.Label style={{ marginTop: '5px', color: '#28a745', fontWeight: 'bold' }}>
                    This service will cost ${approximateCost.toLocaleString()}
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
                        Tick this box if you wish to provide proof of payment now. Routing: <a href="https://banking.gta.world/transfer" target="_blank" rel="noopener noreferrer">020000062</a>
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
                        Upload proof of payment. Supports clipboard pasting (Ctrl+V). Hosted by ImgBB.
                    </span>
                    {formData.paymentProofPhotos && formData.paymentProofPhotos.split(',').map((url, index) => (
                        url.trim() && <img key={index} src={url.trim()} alt={`Payment Proof ${index + 1}`} style={{ maxWidth: '100px', maxHeight: '100px', marginTop: '5px', marginRight: '5px', border: '1px solid #30363d' }} />
                    ))}
                </Form.Group>
            )}
        </>
    );
};

export default MedicalRecords;