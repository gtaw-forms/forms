import React, { useState, useEffect } from 'react';
import { Form, Button } from 'react-bootstrap';
import Select from 'react-select'; // Make sure react-select is imported
import EmployeeCredentialsSection from '../components/EmployeeCredentialsSection';


const MentalHealth = ({
    formData,
    handleChange,
    phmcRank,
    groupedOptions, 
    phmcGroupedOptions,
    admission,
    followup,
    setFormData,
    handleSelectChange,
    setShowEmployeeModal
}) => {
    return (
        <>
            <div style={{ display: 'flex', gap: '10px' }}>

                <Form.Control
                    type="text"
                    name="patientID"
                    value={formData.patientID}
                    onChange={handleChange}
                    placeholder="Patient ID"
                    required
                    className={`form-control ${!formData.patientID ? 'is-invalid' : ''}`}
                />
                <Form.Label>Date:</Form.Label>
                <Form.Control
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    required
                    className={`form-control ${!formData.date ? 'is-invalid' : ''}`}
                />
            </div>
            <Form.Select
                name="phmcRank"
                value={formData.phmcRank}
                onChange={handleChange}
                required
                className={`form-control ${!formData.phmcRank ? 'is-invalid' : ''}`}
            >
                <option value="" disabled>PHMC Rank</option>
                {phmcRank.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </Form.Select>


            <EmployeeCredentialsSection 
                formData={formData}
                setFormData={setFormData}
                groupedOptions={phmcGroupedOptions}
                handleSelectChange={handleSelectChange}
                setShowEmployeeModal={setShowEmployeeModal}
                employeeType="phmc"
            />
            <Form.Label></Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    as="textarea"
                    name="patientChiefComplaint"
                    value={formData.patientChiefComplaint}
                    onChange={handleChange}
                    placeholder="Patient Chief Complaint"
                    rows="3"
                    required
                    className={`form-control ${!formData.patientChiefComplaint ? 'is-invalid' : ''}`}

                />

                <Form.Control
                    as="textarea"
                    rows="3"
                    name="patientNotes"
                    value={formData.patientNotes}
                    onChange={handleChange}
                    placeholder="Patient Notes"
                    required
                    className={`form-control ${!formData.patientNotes ? 'is-invalid' : ''}`}
                />
            </div>
            <Select
                name="admission"
                value={admission.find(option => option.value === formData.admission)}
                onChange={(selectedOption) => {
                    setFormData(prev => ({
                        ...prev,
                        admission: selectedOption ? selectedOption.value : ''
                    }));
                }}
                options={admission}
                isClearable
                placeholder="Was Patient Admitted?"
                className="form-control"
                styles={{
                    control: (base) => ({
                        ...base,
                        backgroundColor: '#16202c',
                        color: '#eeeeeeb0',
                        borderColor: '#30363d',
                        '&:hover': {
                            borderColor: '#30363d'
                        }
                    }),
                    menu: (base) => ({
                        ...base,
                        backgroundColor: '#16202c',
                        zIndex: 1000
                    }),
                    option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isFocused ? 'Grey' : '#16202c',
                        color: '#eeeeeeb0'
                    }),
                    singleValue: (base) => ({
                        ...base,
                        color: '#eeeeeeb0'
                    }),
                    input: (base) => ({
                        ...base,
                        color: '#eeeeeeb0'
                    }),
                    placeholder: (base) => ({
                        ...base,
                        color: '#eeeeeeb0'
                    })
                }}
            />
            <Form.Label></Form.Label>
            <Form.Label><br></br></Form.Label>

            <Form.Control
                as="textarea"
                name="patientDiagnosis"
                value={formData.patientDiagnosis}
                onChange={handleChange}
                placeholder="Diagnosis"
                rows="3"
                required
                className={`form-control ${!formData.patientDiagnosis ? 'is-invalid' : ''}`}

            />
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    as="textarea"
                    name="patientProcedure"
                    value={formData.patientProcedure}
                    onChange={handleChange}
                    placeholder="Patient Procedure"
                    rows="2"
                    className={`form-control ${!formData.patientProcedure ? 'is-invalid' : ''}`}

                />

                <Form.Control
                    as="textarea"
                    name="patientMedicine"
                    value={formData.patientMedicine}
                    onChange={handleChange}
                    placeholder="Patient Medicine"
                    rows="2"
                    className={`form-control ${!formData.patientMedicine ? 'is-invalid' : ''}`}
                />
            </div>
            <Select
                name="followup"
                value={followup.find(option => option.value === formData.followup)}
                onChange={(selectedOption) => {
                    setFormData(prev => ({
                        ...prev,
                        followup: selectedOption ? selectedOption.value : ''
                    }));
                }}
                options={followup}
                isClearable
                placeholder="Select Followup Process..."
                className="form-control"
                styles={{
                    control: (base) => ({
                        ...base,
                        backgroundColor: '#16202c',
                        color: '#eeeeeeb0',
                        borderColor: '#30363d',
                        '&:hover': {
                            borderColor: '#30363d'
                        }
                    }),
                    menu: (base) => ({
                        ...base,
                        backgroundColor: '#16202c',
                        zIndex: 1000
                    }),
                    option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isFocused ? 'Grey' : '#16202c',
                        color: '#eeeeeeb0'
                    }),
                    singleValue: (base) => ({
                        ...base,
                        color: '#eeeeeeb0'
                    }),
                    input: (base) => ({
                        ...base,
                        color: '#eeeeeeb0'
                    }),
                    placeholder: (base) => ({
                        ...base,
                        color: '#eeeeeeb0'
                    })
                }}
            />

        </>
    );
};

export default MentalHealth;