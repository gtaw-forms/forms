// src/phmc-field-data/Certificate.js
import { Form } from 'react-bootstrap';
import EmployeeCredentialsSection from '../components/EmployeeCredentialsSection';

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

            <EmployeeCredentialsSection 
                formData={formData}
                setFormData={setFormData}
                groupedOptions={coronerGroupedOptions}
                handleSelectChange={handleSelectChange}
                setShowEmployeeModal={setShowEmployeeModal}
                employeeType="coroner"
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