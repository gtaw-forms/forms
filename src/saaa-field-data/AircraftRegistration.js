// src/saaa-field-data/AircraftRegistration.js
import React, { useState } from 'react';
import { Form, Button } from 'react-bootstrap';

// Helper component for collapsible section headers (can be moved to a shared components folder)
const CollapsibleHeader = ({ title, isOpen, onToggle, sectionId }) => (
    <Button
        variant="link"
        onClick={onToggle}
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

const AircraftRegistration = ({
    formData,
    handleChange,
    // setFormData, // Include if direct manipulation is needed, e.g., for multi-selects or complex fields
    // Add other props if needed, e.g., options for select dropdowns
}) => {
    // State for collapsible sections
    const [isRegistrantInfoOpen, setIsRegistrantInfoOpen] = useState(true);
    const [isRegistrationTypeOpen, setIsRegistrationTypeOpen] = useState(true);
    const [isCompanyInfoOpen, setIsCompanyInfoOpen] = useState(true);
    const [isAircraftInfoOpen, setIsAircraftInfoOpen] = useState(true);
    const [isCallsignsOpen, setIsCallsignsOpen] = useState(true);

    return (
        <>
            {/* --- REGISTRANT INFORMATION --- */}
            <CollapsibleHeader
                title="REGISTRANT INFORMATION"
                isOpen={isRegistrantInfoOpen}
                onToggle={() => setIsRegistrantInfoOpen(!isRegistrantInfoOpen)}
                sectionId="registrant-info"
            />
            {isRegistrantInfoOpen && (
                <div id="collapse-registrant-info" style={{ paddingTop: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '0.5rem' }}>
                        <Form.Control
                            type="text"
                            name="registrantFirstName"
                            value={formData.registrantFirstName || ''}
                            onChange={handleChange}
                            placeholder="First Name"
                            required
                            className={`form-control ${!formData.registrantFirstName ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="registrantLastName"
                            value={formData.registrantLastName || ''}
                            onChange={handleChange}
                            placeholder="Last Name"
                            required
                            className={`form-control ${!formData.registrantLastName ? 'is-invalid' : ''}`}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
                        <Form.Control
                            type="date"
                            name="registrantDateOfBirth"
                            value={formData.registrantDateOfBirth || ''}
                            onChange={handleChange}
                            placeholder="Date of Birth"
                            required
                            className={`form-control ${!formData.registrantDateOfBirth ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="registrantPlaceOfBirth"
                            value={formData.registrantPlaceOfBirth || ''}
                            onChange={handleChange}
                            placeholder="Place of Birth"
                            required
                            className={`form-control ${!formData.registrantPlaceOfBirth ? 'is-invalid' : ''}`}
                        />
                    </div>
                    <Form.Group className="mb-3">
                        <Form.Label>Address</Form.Label>
                        <Form.Control
                            type="text"
                            name="registrantAddress"
                            value={formData.registrantAddress || ''}
                            onChange={handleChange}
                            placeholder="Full Address"
                            required
                            className={`form-control ${!formData.registrantAddress ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Contact Number</Form.Label>
                        <Form.Control
                            type="tel"
                            name="registrantContactNumber"
                            value={formData.registrantContactNumber || ''}
                            onChange={handleChange}
                            placeholder="e.g., 123-4567"
                            required
                            className={`form-control ${!formData.registrantContactNumber ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                </div>
            )}

            {/* --- REGISTRATION TYPE --- */}
            <CollapsibleHeader
                title="REGISTRATION TYPE"
                isOpen={isRegistrationTypeOpen}
                onToggle={() => setIsRegistrationTypeOpen(!isRegistrationTypeOpen)}
                sectionId="registration-type"
            />
            {isRegistrationTypeOpen && (
                <div id="collapse-registration-type" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Check
                            type="checkbox"
                            label="Commercial"
                            name="registrationTypeCommercial"
                            checked={formData.registrationTypeCommercial || false}
                            onChange={handleChange}
                        />
                        <Form.Check
                            type="checkbox"
                            label="Private"
                            name="registrationTypePrivate"
                            checked={formData.registrationTypePrivate || false}
                            onChange={handleChange}
                        />
                        <Form.Check
                            type="checkbox"
                            label="Utility"
                            name="registrationTypeUtility"
                            checked={formData.registrationTypeUtility || false}
                            onChange={handleChange}
                        />
                        {/* Add validation if at least one must be checked */}
                    </Form.Group>
                </div>
            )}

            {/* --- AGENCY / COMPANY INFORMATION --- */}
            <CollapsibleHeader
                title="AGENCY / COMPANY INFORMATION (If Applicable)"
                isOpen={isCompanyInfoOpen}
                onToggle={() => setIsCompanyInfoOpen(!isCompanyInfoOpen)}
                sectionId="company-info"
            />
            {isCompanyInfoOpen && (
                <div id="collapse-company-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>Company/Agency Name</Form.Label>
                        <Form.Control
                            type="text"
                            name="companyName"
                            value={formData.companyName || ''}
                            onChange={handleChange}
                            placeholder="Enter name (or N/A)"
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Date of Establishment</Form.Label>
                        <Form.Control
                            type="date"
                            name="companyDateOfEstablishment"
                            value={formData.companyDateOfEstablishment || ''}
                            onChange={handleChange}
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Type:</Form.Label>
                        <Form.Check
                            type="checkbox"
                            label="Private"
                            name="companyTypePrivate"
                            checked={formData.companyTypePrivate || false}
                            onChange={handleChange}
                        />
                        <Form.Check
                            type="checkbox"
                            label="Government"
                            name="companyTypeGovernment"
                            checked={formData.companyTypeGovernment || false}
                            onChange={handleChange}
                        />
                    </Form.Group>
                </div>
            )}

            {/* --- AIRCRAFT INFORMATION --- */}
            <CollapsibleHeader
                title="AIRCRAFT INFORMATION"
                isOpen={isAircraftInfoOpen}
                onToggle={() => setIsAircraftInfoOpen(!isAircraftInfoOpen)}
                sectionId="aircraft-info"
            />
            {isAircraftInfoOpen && (
                <div id="collapse-aircraft-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>Aircraft Type</Form.Label>
                        <Form.Control
                            type="text"
                            name="aircraftType"
                            value={formData.aircraftType || ''}
                            onChange={handleChange}
                            placeholder="e.g., Fixed-Wing Single-Engine, Helicopter"
                            required
                            className={`form-control ${!formData.aircraftType ? 'is-invalid' : ''}`}
                        />
                        {/* Consider making this a select if you have predefined types */}
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Aircraft Model</Form.Label>
                        <Form.Control
                            type="text"
                            name="aircraftModel"
                            value={formData.aircraftModel || ''}
                            onChange={handleChange}
                            placeholder="e.g., Buckingham Vestra, Maverick"
                            required
                            className={`form-control ${!formData.aircraftModel ? 'is-invalid' : ''}`}
                        />
                        {/* Consider making this a select if you have predefined models */}
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Date of Purchase</Form.Label>
                        <Form.Control
                            type="date"
                            name="aircraftDateOfPurchase"
                            value={formData.aircraftDateOfPurchase || ''}
                            onChange={handleChange}
                            required
                            className={`form-control ${!formData.aircraftDateOfPurchase ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Photographic Image of the Aircraft (Link)</Form.Label>
                        <Form.Control
                            type="url"
                            name="aircraftImageLink"
                            value={formData.aircraftImageLink || ''}
                            onChange={handleChange}
                            placeholder="https://imgur.com/your-image-link"
                            required
                            className={`form-control ${!formData.aircraftImageLink ? 'is-invalid' : ''}`}
                        />
                        <Form.Text className="text-muted">
                            Please provide a direct link to an image of the aircraft.
                        </Form.Text>
                    </Form.Group>
                </div>
            )}

            {/* --- CALLSIGNS --- */}
            <CollapsibleHeader
                title="CALLSIGNS"
                isOpen={isCallsignsOpen}
                onToggle={() => setIsCallsignsOpen(!isCallsignsOpen)}
                sectionId="callsigns-info"
            />
            {isCallsignsOpen && (
                <div id="collapse-callsigns-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>Requested Callsign</Form.Label>
                        <Form.Control
                            type="text"
                            name="requestedCallsign"
                            value={formData.requestedCallsign || ''}
                            onChange={handleChange}
                            placeholder="e.g., HighFlyer, WingmanMike"
                            required
                            className={`form-control ${!formData.requestedCallsign ? 'is-invalid' : ''}`}
                        />
                        <Form.Text className="text-muted">
                            Refer to SAAA guidelines for callsign availability and format.
                        </Form.Text>
                    </Form.Group>
                </div>
            )}

        </>
    );
};

export default AircraftRegistration;
