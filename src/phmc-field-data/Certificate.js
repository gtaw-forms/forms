// src/phmc-field-data/Certificate.js
import React from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';
import Select from 'react-select';

const Certificate = ({
    formData,
    handleChange,
    setFormData,
    coronerGroupedOptions,
    handleSelectChange,
    setShowEmployeeModal,
    isUploading,
    handleImageUpload,
    currentUtcTime, // Assuming you want to display current time for date/time fields
}) => {
    return (
        <>
            <p>This form is used to generate a Certificate of Death. Please fill out all required fields accurately.</p>

            {/* Coroner Employee Selection */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                <Form.Label style={{ marginBottom: 0 }}>Coroner Issuing Certificate</Form.Label>
                <button
                    type="button"
                    onClick={() => setShowEmployeeModal(true)}
                    className="close-button"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', lineHeight: '1.2' }}
                >
                    <i className="fas fa-question-circle" style={{ marginRight: '5px' }}></i>
                    Missing Name?
                </button>
            </div>
            <Select
                name="coronerEmployee"
                value={coronerGroupedOptions
                    .flatMap(group => group.options)
                    .find(option => option.value === formData.coronerEmployee) || null}
                onChange={(selectedOption, actionMeta) => handleSelectChange(selectedOption, actionMeta)}
                options={coronerGroupedOptions}
                isClearable
                placeholder="Search or select coroner..."
                className={`form-control ${!formData.coronerEmployee ? 'is-invalid' : ''}`}
                styles={{
                    control: (base, state) => ({
                        ...base,
                        backgroundColor: '#16202c',
                        color: '#eeeeeeb0',
                        borderColor: !formData.coronerEmployee && state.isFocused ? '#dc3545' :
                                     !formData.coronerEmployee ? '#dc3545' :
                                     state.isFocused ? '#86b7fe' : '#6c757d',
                        '&:hover': {
                            borderColor: !formData.coronerEmployee ? '#dc3545' : '#86b7fe'
                        },
                        boxShadow: !formData.coronerEmployee && state.isFocused ? '0 0 0 0.25rem rgba(220, 53, 69, 0.25)' :
                                   state.isFocused ? '0 0 0 0.25rem rgba(13, 110, 253, 0.25)' : null,
                    }),
                    menu: (base) => ({ ...base, backgroundColor: '#16202c', zIndex: 1000 }),
                    option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? 'Grey' : '#16202c', color: '#eeeeeeb0' }),
                    singleValue: (base) => ({ ...base, color: '#eeeeeeb0' }),
                    input: (base) => ({ ...base, color: '#eeeeeeb0' }),
                    placeholder: (base) => ({ ...base, color: '#eeeeeeb0' }),
                    group: (base) => ({ ...base, paddingTop: 8, paddingBottom: 8 }),
                    groupHeading: (base) => ({ ...base, color: '#6c757d', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: 4 })
                }}
            />
            <Form.Label></Form.Label>

            {/* Decedent Information */}
            <Form.Label>Decedent Information</Form.Label>
            <Form.Control
                type="text"
                name="decedentName"
                value={formData.decedentName}
                onChange={handleChange}
                placeholder="Decedent's Full Name"
                required
                className={`form-control ${!formData.decedentName ? 'is-invalid' : ''}`}
            />
                        <Form.Label>Decedent Age | Date of Birth (If available)</Form.Label>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <Form.Control
                    type="number"
                    name="patientAge"
                    value={formData.patientAge}
                    onChange={handleChange}
                    placeholder="Decedent's Age"
                    required
                    className={`form-control ${!formData.patientAge ? 'is-invalid' : ''}`}
                />
                <Form.Control
                    type="date"
                    name="patientDateOfBirth"
                    value={formData.patientDateOfBirth}
                    onChange={handleChange}
                    placeholder="Decedent's Date of Birth"
                    required
                    className={`form-control ${!formData.patientDateOfBirth ? 'is-invalid' : ''}`}
                />
            </div>

            {/* Cause and Time of Death */}
            <Form.Control
                type="text"
                name="probableCauseOfDeath"
                value={formData.probableCauseOfDeath}
                onChange={handleChange}
                placeholder="Probable Cause of Death"
                required
                className={`form-control ${!formData.probableCauseOfDeath ? 'is-invalid' : ''}`}
            />
                        <Form.Label>Time of Death | Deate of Death</Form.Label>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                
                <Form.Control
                    type="time"
                    name="TimeofDeath"
                    value={formData.TimeofDeath}
                    onChange={handleChange}
                    placeholder="Time of Death"
                    required
                    className={`form-control ${!formData.TimeofDeath ? 'is-invalid' : ''}`}
                />
                                <Form.Control
                    type="date"
                    name="dateofdeath"
                    value={formData.dateofdeath}
                    onChange={handleChange}
                    placeholder="Date of Death"
                    required
                    className={`form-control ${!formData.dateofdeath ? 'is-invalid' : ''}`}
                />

            </div>

            {/* Witness and Certificate Date */}
            <Form.Label>Witness and Certificate Date</Form.Label>
            <Form.Control
                type="text"
                name="witnessName"
                value={formData.witnessName}
                onChange={handleChange}
                placeholder="Witness Name"
                required
                className={`form-control ${!formData.witnessName ? 'is-invalid' : ''}`}
            />
            <Form.Control
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                placeholder="Certificate Issue Date"
                required
                className={`form-control ${!formData.date ? 'is-invalid' : ''}`}
                style={{ marginTop: '10px' }}
            />
            <span style={{ fontSize: '0.8em', color: '#6c757d', marginLeft: '10px' }}>
                (Current Server Time: {currentUtcTime})
            </span>
        </>
    );
};

export default Certificate;
