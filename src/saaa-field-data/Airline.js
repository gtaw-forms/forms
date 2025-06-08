import React, { useState } from 'react';
import { Form, Button, Col, Row } from 'react-bootstrap';

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

const Airline = ({
    formData,
    handleChange,
    // setFormData, // Include if direct manipulation is needed
}) => {
    // State for collapsible sections
    const [isCompanyInfoOpen, setIsCompanyInfoOpen] = useState(true);
    const [isSpecializationOpen, setIsSpecializationOpen] = useState(true);
    const [isFlightTeamOpen, setIsFlightTeamOpen] = useState(true);
    const [isFleetInfoOpen, setIsFleetInfoOpen] = useState(true);
    const [isAcknowledgementOpen, setIsAcknowledgementOpen] = useState(true);

    return (
        <>
            <CollapsibleHeader
                title="COMPANY INFORMATION"
                isOpen={isCompanyInfoOpen}
                onToggle={() => setIsCompanyInfoOpen(!isCompanyInfoOpen)}
                sectionId="airline-company-info"
            />
            {isCompanyInfoOpen && (
                <div id="collapse-airline-company-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>Company Name</Form.Label>
                        <Form.Control
                            type="text"
                            name="companyName"
                            value={formData.companyName || ''}
                            onChange={handleChange}
                            placeholder="Enter company name"
                            required
                            className={`form-control ${!formData.companyName ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                    <Row className="mb-3">
                        <Form.Group as={Col} md="6">
                            <Form.Label>Contact Number</Form.Label>
                            <Form.Control
                                type="tel"
                                name="contactNumber"
                                value={formData.contactNumber || ''}
                                onChange={handleChange}
                                placeholder="e.g., 123-4567"
                                required
                                className={`form-control ${!formData.contactNumber ? 'is-invalid' : ''}`}
                            />
                        </Form.Group>
                        <Form.Group as={Col} md="6">
                            <Form.Label>Company Address</Form.Label>
                            <Form.Control
                                type="text"
                                name="companyAddress"
                                value={formData.companyAddress || ''}
                                onChange={handleChange}
                                placeholder="Full company address"
                                required
                                className={`form-control ${!formData.companyAddress ? 'is-invalid' : ''}`}
                            />
                        </Form.Group>
                    </Row>
                    <Form.Group className="mb-3">
                        <Form.Label>Chief Executive Officer (Full Name)</Form.Label>
                        <Form.Control
                            type="text"
                            name="ceoFullName"
                            value={formData.ceoFullName || ''}
                            onChange={handleChange}
                            placeholder="e.g., John Doe"
                            required
                            className={`form-control ${!formData.ceoFullName ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                    {/* CEO First/Last Name fields removed */}
                </div>
            )}

            {/* --- COMPANY / AGENCY SPECIALIZATION --- */}
            <CollapsibleHeader
                title="COMPANY / AGENCY SPECIALIZATION"
                isOpen={isSpecializationOpen}
                onToggle={() => setIsSpecializationOpen(!isSpecializationOpen)}
                sectionId="airline-specialization"
            />
            {isSpecializationOpen && (
                <div id="collapse-airline-specialization" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>Mark with X:</Form.Label>
                        <Form.Check
                            type="checkbox"
                            label="Cargo carrier"
                            name="specCargoCarrier"
                            checked={formData.specCargoCarrier || false}
                            onChange={handleChange}
                        />
                        <Form.Check
                            type="checkbox"
                            label="Passenger carrier"
                            name="specPassengerCarrier"
                            checked={formData.specPassengerCarrier || false}
                            onChange={handleChange}
                        />
                        <Form.Check
                            type="checkbox"
                            label="Other"
                            name="specOther"
                            checked={formData.specOther || false}
                            onChange={handleChange}
                        />
                        {formData.specOther && (
                            <Form.Control
                                type="text"
                                name="specOtherText"
                                value={formData.specOtherText || ''}
                                onChange={handleChange}
                                placeholder="Specify other specialization"
                                required={formData.specOther} // Required if "Other" is checked
                                className={`form-control mt-2 ${formData.specOther && !formData.specOtherText ? 'is-invalid' : ''}`}
                            />
                        )}
                        {/* Add validation if at least one specialization must be chosen */}
                    </Form.Group>
                </div>
            )}

            {/* --- FLIGHT TEAM INFORMATION --- */}
            <CollapsibleHeader
                title="FLIGHT TEAM INFORMATION"
                isOpen={isFlightTeamOpen}
                onToggle={() => setIsFlightTeamOpen(!isFlightTeamOpen)}
                sectionId="airline-flight-team"
            />
            {isFlightTeamOpen && (
                <div id="collapse-airline-flight-team" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>Chief pilot(s) + valid license(s)</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            name="chiefPilots"
                            value={formData.chiefPilots || ''}
                            onChange={handleChange}
                            placeholder="List chief pilots and their license details (e.g., John Doe - CPL #12345)"
                            required
                            className={`form-control ${!formData.chiefPilots ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>List of staff + valid license(s)</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={5}
                            name="staffList"
                            value={formData.staffList || ''}
                            onChange={handleChange}
                            placeholder="List all flight staff and their license details (e.g., Jane Smith - PPL #67890, Mike Brown - ATPL #11223)"
                            required
                            className={`form-control ${!formData.staffList ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                </div>
            )}

            {/* --- FLEET INFORMATION --- */}
            <CollapsibleHeader
                title="FLEET INFORMATION"
                isOpen={isFleetInfoOpen}
                onToggle={() => setIsFleetInfoOpen(!isFleetInfoOpen)}
                sectionId="airline-fleet-info"
            />
            {isFleetInfoOpen && (
                <div id="collapse-airline-fleet-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>Which aircraft does the company / agency operate? (Mark with X)</Form.Label>
                        <Form.Check
                            type="checkbox"
                            label="Single-Engine, Fixed-wing"
                            name="fleetSingleEngineFixed"
                            checked={formData.fleetSingleEngineFixed || false}
                            onChange={handleChange}
                        />
                        <Form.Check
                            type="checkbox"
                            label="Multi-Engine, Fixed-Wing"
                            name="fleetMultiEngineFixed"
                            checked={formData.fleetMultiEngineFixed || false}
                            onChange={handleChange}
                        />
                        <Form.Check
                            type="checkbox"
                            label="Tail-wheel"
                            name="fleetTailWheel"
                            checked={formData.fleetTailWheel || false}
                            onChange={handleChange}
                        />
                        <Form.Check
                            type="checkbox"
                            label="Single-Engine Helicopter"
                            name="fleetSingleEngineHeli"
                            checked={formData.fleetSingleEngineHeli || false}
                            onChange={handleChange}
                        />
                        <Form.Check
                            type="checkbox"
                            label="Multi-Engine Helicopter"
                            name="fleetMultiEngineHeli"
                            checked={formData.fleetMultiEngineHeli || false}
                            onChange={handleChange}
                        />
                        <Form.Check
                            type="checkbox"
                            label="Ultralight"
                            name="fleetUltralight"
                            checked={formData.fleetUltralight || false}
                            onChange={handleChange}
                        />
                        {/* Add validation if at least one aircraft type must be selected */}
                    </Form.Group>
                </div>
            )}

            {/* --- ACKNOWLEDGEMENT & AUTHORIZATION --- */}
            <CollapsibleHeader
                title="ACKNOWLEDGEMENT & AUTHORIZATION"
                isOpen={isAcknowledgementOpen}
                onToggle={() => setIsAcknowledgementOpen(!isAcknowledgementOpen)}
                sectionId="airline-ack"
            />
            {isAcknowledgementOpen && (
                <div id="collapse-airline-ack" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Check
                            type="checkbox"
                            name="ackAuthorize"
                            id="ackAuthorizeAirlineCheckbox"
                            checked={formData.ackAuthorize || false}
                            onChange={handleChange}
                            required
                            label={
                                `By submitting this application, I, ${formData.ceoFullName || '[CEO Full Name]'}, hereby certify that all questions contained in this document were met with truthful statements. I fully authorize the investigation of any content shared on this document. I am aware that lying, omitting, plagiarizing, or maliciously adulterating this application will result in immediate denial and an indefinite ban from applying for future job vacancies.`
                            }
                            className={`${!formData.ackAuthorize ? 'is-invalid' : ''}`}
                        />
                        {!formData.ackAuthorize && <div className="invalid-feedback d-block">You must acknowledge and authorize to submit.</div>}
                    </Form.Group>
                </div>
            )}
        </>
    );
};

export default Airline;
