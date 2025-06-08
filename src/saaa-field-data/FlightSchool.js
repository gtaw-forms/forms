// src/saaa-field-data/FlightSchool.js
import React, { useState } from 'react';
import { Form, Button } from 'react-bootstrap';
import Select from 'react-select'; // For multi-select if you prefer over checkboxes

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

// Define options for aircraft types and models
const aircraftTypeOptions = [
    { value: 'SingleEngineFixedWing', label: 'Single-Engine, Fixed-wing' },
    { value: 'MultiEngineFixedWing', label: 'Multi-Engine, Fixed-Wing' },
    { value: 'TailWheel', label: 'Tail-wheel' },
    { value: 'SingleEngineHelicopter', label: 'Single-Engine Helicopter' },
    { value: 'MultiEngineHelicopter', label: 'Multi-Engine Helicopter' },
    { value: 'Ultralight', label: 'Ultralight' },
];

const aircraftModelOptions = [
    { value: 'Vestra', label: 'Vestra' }, { value: 'Miljet', label: 'Miljet' },
    { value: 'BuckinghamLuxor', label: 'Buckingham Luxor' }, { value: 'BuckinghamShamal', label: 'Buckingham Shamal' },
    { value: 'Cuban800', label: 'Cuban 800' }, { value: 'Duster', label: 'Duster' },
    { value: 'Dodo', label: 'Dodo' }, { value: 'Mallard', label: 'Mallard' },
    { value: 'Mammatus', label: 'Mammatus' }, { value: 'Velum', label: 'Velum' },
    { value: 'BuckinghamNimbus', label: 'Buckingham Nimbus' }, { value: 'BuckinghamAlphaZ1', label: 'Buckingham Alpha-Z1' },
    { value: 'BuckinghamHowardNX25', label: 'Buckingham Howard NX-25' }, { value: 'MammothMogul', label: 'Mammoth Mogul' },
    { value: 'P45Nokota', label: 'P-45 Nokota' }, { value: 'WesternCompanySeabreeze', label: 'Western Company Seabreeze' },
    { value: 'PegassiUltralight', label: 'Pegassi Ultralight' }, { value: 'JobuiltValum5Seats', label: 'Jobuilt Valum (5 seats)' },
    { value: 'Valkyrie', label: 'Valkyrie' }, { value: 'Swift', label: 'Swift' },
    { value: 'Buzzard', label: 'Buzzard' }, { value: 'Frogger', label: 'Frogger' },
    { value: 'Maverick', label: 'Maverick' }, { value: 'PoliceMaverick', label: 'Police Maverick' },
    { value: 'Volatus', label: 'Volatus' }, { value: 'SuperVolito', label: 'SuperVolito' },
    { value: 'Havok', label: 'Havok' },
];

// Define common styles for react-select (can be moved to a shared style file)
const customSelectStyles = {
    control: (base, state) => ({ /* ... your preferred styles ... */
        ...base, minHeight: '38px', backgroundColor: '#16202c', color: '#eeeeeeb0',
        borderColor: state.isFocused ? '#86b7fe' : '#30363d',
        boxShadow: state.isFocused ? '0 0 0 0.25rem rgba(13, 110, 253, 0.25)' : null,
        '&:hover': { borderColor: '#86b7fe' }
    }),
    menu: (base) => ({ ...base, backgroundColor: '#16202c', zIndex: 1000, border: '1px solid #30363d', borderRadius: '0.375rem' }),
    option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#30363d' : '#16202c', color: '#eeeeeeb0', padding: '0.5rem 1rem', '&:hover': { backgroundColor: '#30363d' } }),
    multiValue: (base) => ({ ...base, backgroundColor: '#30363d', color: '#eeeeeeb0' }),
    multiValueLabel: (base) => ({ ...base, color: '#eeeeeeb0' }),
    multiValueRemove: (base) => ({ ...base, color: '#6c757d', '&:hover': { backgroundColor: '#dc3545', color: '#fff' } }),
    input: (base) => ({ ...base, color: '#eeeeeeb0' }),
    placeholder: (base) => ({ ...base, color: '#6c757d' }),
};


const FlightSchool = ({
    formData,
    handleChange,
    setFormData, // Needed for multi-select
    // Add other props if needed, e.g., isMobile for responsive styles
}) => {
    const [isRegInfoOpen, setIsRegInfoOpen] = useState(true);
    const [isCompanyInfoOpen, setIsCompanyInfoOpen] = useState(true);
    const [isChiefPilotInfoOpen, setIsChiefPilotInfoOpen] = useState(true);
    const [isTrainingPlanOpen, setIsTrainingPlanOpen] = useState(true);

    // Handler for multi-select components
    const handleMultiSelectChange = (selectedOptions, fieldName) => {
        setFormData(prev => ({
            ...prev,
            [fieldName]: selectedOptions ? selectedOptions.map(option => option.value) : []
        }));
    };

    return (
        <>
            {/* --- REGISTRANT INFORMATION --- */}
            <CollapsibleHeader
                title="REGISTRANT INFORMATION"
                isOpen={isRegInfoOpen}
                onToggle={() => setIsRegInfoOpen(!isRegInfoOpen)}
                sectionId="reg-info"
            />
            {isRegInfoOpen && (
                <div id="collapse-reg-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>Full Name</Form.Label>
                        <Form.Control type="text" name="regFullName" value={formData.regFullName || ''} onChange={handleChange} placeholder="Firstname Lastname" required />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Contact Number</Form.Label>
                        <Form.Control type="text" name="regContactNumber" value={formData.regContactNumber || ''} onChange={handleChange} placeholder="e.g., 123-4567" required />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Position</Form.Label>
                        <Form.Control type="text" name="regPosition" value={formData.regPosition || ''} onChange={handleChange} placeholder="e.g., Owner, Manager" required />
                    </Form.Group>
                </div>
            )}

            {/* --- COMPANY/ENTITY INFORMATION --- */}
            <CollapsibleHeader
                title="COMPANY/ENTITY INFORMATION"
                isOpen={isCompanyInfoOpen}
                onToggle={() => setIsCompanyInfoOpen(!isCompanyInfoOpen)}
                sectionId="company-info"
            />
            {isCompanyInfoOpen && (
                <div id="collapse-company-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>Company/Entity Name</Form.Label>
                        <Form.Control type="text" name="companyName" value={formData.companyName || ''} onChange={handleChange} placeholder="e.g., LS Flight Academy" required />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Company/Entity Address</Form.Label>
                        <Form.Control type="text" name="companyAddress" value={formData.companyAddress || ''} onChange={handleChange} placeholder="e.g., Los Santos International Airport, Hangar 1" required />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>Aircraft Types (Select all that apply)</Form.Label>
                        <Select
                            isMulti
                            name="aircraftTypesSelected"
                            options={aircraftTypeOptions}
                            value={aircraftTypeOptions.filter(option => formData.aircraftTypesSelected?.includes(option.value))}
                            onChange={(selected) => handleMultiSelectChange(selected, 'aircraftTypesSelected')}
                            className="form-control p-0"
                            classNamePrefix="react-select"
                            styles={customSelectStyles}
                            placeholder="Select aircraft types..."
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>Aircraft Makes & Models (Select all that apply)</Form.Label>
                        <Select
                            isMulti
                            name="aircraftModelsSelected"
                            options={aircraftModelOptions}
                            value={aircraftModelOptions.filter(option => formData.aircraftModelsSelected?.includes(option.value))}
                            onChange={(selected) => handleMultiSelectChange(selected, 'aircraftModelsSelected')}
                            className="form-control p-0"
                            classNamePrefix="react-select"
                            styles={customSelectStyles}
                            placeholder="Select aircraft makes & models..."
                        />
                    </Form.Group>
                </div>
            )}

            {/* --- CHIEF PILOT INFORMATION --- */}
            <CollapsibleHeader
                title="CHIEF PILOT INFORMATION"
                isOpen={isChiefPilotInfoOpen}
                onToggle={() => setIsChiefPilotInfoOpen(!isChiefPilotInfoOpen)}
                sectionId="chief-pilot-info"
            />
            {isChiefPilotInfoOpen && (
                <div id="collapse-chief-pilot-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>Full Name</Form.Label>
                        <Form.Control type="text" name="chiefPilotFullName" value={formData.chiefPilotFullName || ''} onChange={handleChange} placeholder="Firstname Lastname" required />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Contact Number</Form.Label>
                        <Form.Control type="text" name="chiefPilotContactNumber" value={formData.chiefPilotContactNumber || ''} onChange={handleChange} placeholder="e.g., 123-4567" required />
                    </Form.Group>
                </div>
            )}

            {/* --- TRAINING PLAN --- */}
            <CollapsibleHeader
                title="TRAINING PLAN"
                isOpen={isTrainingPlanOpen}
                onToggle={() => setIsTrainingPlanOpen(!isTrainingPlanOpen)}
                sectionId="training-plan"
            />
            {isTrainingPlanOpen && (
                <div id="collapse-training-plan" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>Training Plan Details or Link</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={4}
                            name="trainingPlanLink"
                            value={formData.trainingPlanLink || ''}
                            onChange={handleChange}
                            placeholder="Provide details of your training plan or a link to an external document (Google Docs, PDF, etc.)."
                            required
                        />
                        <Form.Text className="text-muted">
                            This should outline curriculum, flight hours, ground school topics, safety procedures, and instructor qualifications.
                        </Form.Text>
                    </Form.Group>
                </div>
            )}
        </>
    );
};

export default FlightSchool;
