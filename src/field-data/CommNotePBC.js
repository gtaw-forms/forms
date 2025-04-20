import React from 'react';
import { Form } from 'react-bootstrap';
import Select from 'react-select'; // Make sure react-select is imported

const CommNotePBC = ({
    formData,
    handleChange,
    setShowMissingEmployeeModal,
    phmcGroupedOptions,
    departmentLarge,
    setFormData // We need this for the Select's onChange logic
}) => {
    return (
        <>
            {/* The JSX code block for bbCodeVersion === 22 */}
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
            <Form.Control
                type="text" // Changed from 'textarea' as it was likely a typo in original
                name="patientNotes"
                value={formData.patientNotes}
                onChange={handleChange}
                placeholder="Patient's Notes"
                required
                className={`form-control ${!formData.patientNotes ? 'is-invalid' : ''}`}
            />

            <Form.Label></Form.Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                <Form.Label style={{ marginBottom: 0 }}>Employee Credentials</Form.Label>
                <button
                    type="button"
                    onClick={() => setShowMissingEmployeeModal(true)}
                    className="close-button" // Consider a more specific class if needed
                    style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.8rem',
                        lineHeight: '1.2'
                    }}
                >
                    <i className="fas fa-question-circle" style={{ marginRight: '5px' }}></i>
                    Missing Name?
                </button>
            </div>

            <Select
                name="phmcEmployee"
                value={phmcGroupedOptions
                    .flatMap(group => group.options)
                    .find(option => option.value === formData.phmcEmployee) || null}
                onChange={(selectedOption) => {
                    // This logic needs setFormData, which is passed as a prop
                    const lastName = selectedOption ? selectedOption.lastName : '';
                    setFormData(prev => ({
                        ...prev,
                        phmcEmployee: selectedOption ? selectedOption.value : '',
                        lastName: lastName // Use lastName from the selected option
                    }));
                }}
                options={phmcGroupedOptions}
                isClearable
                placeholder="Search or select doctor..."
                className="form-control"
                styles={{ // Keep the styles for react-select
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
            <Select
                name="departmentLarge"
                value={departmentLarge.find(option => option.value === formData.departmentLarge)}
                onChange={(selectedOption) => {
                    // This uses the standard handleChange for simple value updates
                    handleChange({
                        target: {
                            name: 'departmentLarge',
                            value: selectedOption ? selectedOption.value : ''
                        }
                    });
                }}
                options={departmentLarge}
                isClearable
                placeholder="Select Department..."
                className="form-control"
                styles={{ // Keep the styles for react-select
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
        </>
    );
};

export default CommNotePBC;