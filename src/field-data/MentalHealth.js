import React from 'react';
import { Form } from 'react-bootstrap';
import Select from 'react-select'; // Make sure react-select is imported

const MentalHealth = ({
    formData,
    handleChange,
    phmcRank,
    phmcGroupedOptions,
    admission,
    followup,
    setFormData // We need this for the Select's onChange logic
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
                            className="form-control"
                            />

                            <Form.Label>Date:</Form.Label>
                            <Form.Control
                            type="date"
                            name="date"
                            value={formData.date}
                            onChange={handleChange}
                            required
                            className="form-control"
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

 
                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        // eslint-disable-next-line no-unused-vars
                                        const lastName = selectedOption ? selectedOption.lastName : '';
                                        setFormData(prev => ({
                                            ...prev,
                                            phmcEmployee: selectedOption ? selectedOption.value : '',
                                            lastName: selectedOption ? selectedOption.lastName : '' // Use lastName from the selected option
                                        }));
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
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
                                <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control
                                        as="textarea"
                                        name="patientChiefComplaint"
                                        value={formData.patientChiefComplaint}
                                        onChange={handleChange}
                                        placeholder="Patient Chief Complaint"
                                        rows="3"
                                        required
                                                                                        />

                                    <Form.Control
                                        as="textarea"
                                        rows="3"
                                        name="patientNotes"
                                        value={formData.patientNotes}
                                        onChange={handleChange}
                                        placeholder="Patient Notes"
                                        required
                                        className="form-control"
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
                                                />
        <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Control
                                        as="textarea"
                                        name="patientProcedure"
                                        value={formData.patientProcedure}
                                        onChange={handleChange}
                                        placeholder="Patient Procedure"
                                        rows="2"
                                    />

                                    <Form.Control
                                        as="textarea"
                                        name="patientMedicine"
                                        value={formData.patientMedicine}
                                        onChange={handleChange}
                                        placeholder="Patient Medicine"
                                        rows="2"
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