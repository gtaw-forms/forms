import { Form } from 'react-bootstrap';
import Select from 'react-select'; // Make sure react-select is imported
import EmployeeCredentialsSection from '../components/EmployeeCredentialsSection';

// Destructure the props that this component will need from App.js
const PHMCCommentaryNoteQuestions = ({
    formData,
    handleChange,
    setShowEmployeeModal,
    phmcGroupedOptions,
    departmentLarge,
    setFormData, // We need this for the Select's onChange logic
    handleSelectChange 
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
                as="textarea" 
                name="patientNotes"
                value={formData.patientNotes}
                onChange={handleChange}
                placeholder="Patient Notes"
                rows="6"
                required
                className={`form-control ${!formData.patientNotes ? 'is-invalid' : ''}`}
            />

            <Form.Label></Form.Label>
            <EmployeeCredentialsSection 
                formData={formData}
                setFormData={setFormData}
                groupedOptions={phmcGroupedOptions}
                handleSelectChange={handleSelectChange}
                setShowEmployeeModal={setShowEmployeeModal}
                employeeType="phmc"
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

export default PHMCCommentaryNoteQuestions;