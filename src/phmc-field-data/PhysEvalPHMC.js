import React, { useState, useEffect } from 'react';
import { Form, Button } from 'react-bootstrap';
import Select from 'react-select';
import useGtaWorldAuth from '../hooks/useGtaWorldAuth';

const EmployeeCredentialsSection = ({ 
    formData, 
    setFormData, 
    groupedOptions,
    handleSelectChange, 
    setShowEmployeeModal,
    employeeType
}) => {
    const { user: gtaWorldUser, isAuthenticated: isGtaAuthenticated } = useGtaWorldAuth();
    const [useGtawName, setUseGtawName] = useState(false);
    
    // Declare field names first (before useEffect)
    const employeeNameField = `${employeeType}Employee`;
    const employeeBadgeField = `${employeeType}Badge`;
    const employeeRankField = `${employeeType}Rank`;
    const employeeDiscordField = `${employeeType}Discord`;
    const employeePHNumberField = `${employeeType}PHNumber`;
    
    // Automatically enable GTAW credentials when user is authenticated
    useEffect(() => {
        if (isGtaAuthenticated && gtaWorldUser && !useGtawName) {
            // Check if we have a valid character name
            const gtawCharacterName = gtaWorldUser.faction ? 
                ((gtaWorldUser.faction.firstname && gtaWorldUser.faction.lastname) ? 
                    `${gtaWorldUser.faction.firstname} ${gtaWorldUser.faction.lastname}` : 
                    gtaWorldUser.faction.characterName || gtaWorldUser.username) : 
                gtaWorldUser.username;
            
            if (gtawCharacterName) {
                setUseGtawName(true);
                
                // Clean rank by removing dashes and extra text
                const cleanRank = gtaWorldUser?.faction?.rank ? 
                    gtaWorldUser.faction.rank.split('-')[0].trim() : 'GTAW User';
                
                setFormData(prev => ({
                    ...prev,
                    [employeeNameField]: gtawCharacterName,
                    [employeeBadgeField]: gtaWorldUser?.character?.id || gtaWorldUser?.id || '', 
                    [employeeRankField]: cleanRank,
                    [employeeDiscordField]: gtaWorldUser?.username || '',
                    [employeePHNumberField]: '50056'
                }));
            }
        }
    }, [isGtaAuthenticated, gtaWorldUser, useGtawName, setFormData, employeeNameField, employeeBadgeField, employeeRankField, employeeDiscordField, employeePHNumberField]);

    // Get GTAW character name if available
    const gtawCharacterName = isGtaAuthenticated && gtaWorldUser && gtaWorldUser.faction ? 
        ((gtaWorldUser.faction.firstname && gtaWorldUser.faction.lastname) ? 
            `${gtaWorldUser.faction.firstname} ${gtaWorldUser.faction.lastname}` : 
            gtaWorldUser.faction.characterName || gtaWorldUser.username) : 
        (isGtaAuthenticated && gtaWorldUser ? gtaWorldUser.username : null);

    const handleGtawToggle = () => {
        if (!useGtawName && gtawCharacterName) {
            // Switch to GTAW name
            setUseGtawName(true);
            
            // Clean rank by removing dashes and extra text
            const cleanRank = gtaWorldUser?.faction?.rank ? 
                gtaWorldUser.faction.rank.split('-')[0].trim() : 'GTAW User';
            
            setFormData(prev => ({
                ...prev,
                [employeeNameField]: gtawCharacterName,
                [employeeBadgeField]: gtaWorldUser?.id || '', // Use character ID as badge number
                [employeeRankField]: cleanRank,
                [employeeDiscordField]: gtaWorldUser?.username || '',
                [employeePHNumberField]: '50056'
            }));
        } else {
            // Switch back to Firebase selection
            setUseGtawName(false);
            setFormData(prev => ({
                ...prev,
                [employeeNameField]: '',
                [employeeBadgeField]: '',
                [employeeRankField]: '',
                [employeeDiscordField]: '',
                [employeePHNumberField]: '50056'
            }));
        }
    };

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                <Form.Label style={{ marginBottom: 0 }}>Employee Credentials</Form.Label>
                <button
                    type="button"
                    onClick={() => setShowEmployeeModal(true)}
                    className="close-button"
                    style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.8rem',     
                        lineHeight: '1.2'       
                    }}
                >
                    <i className="fas fa-question-circle" style={{ marginRight: '5px' }}></i> {/* Changed icon */}
                    Missing Name?
                </button>
                {isGtaAuthenticated && gtawCharacterName && (
                    <button
                        type="button"
                        onClick={handleGtawToggle}
                        className="close-button"
                        style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.8rem',
                            lineHeight: '1.2',
                            backgroundColor: useGtawName ? '#28a745' : '#007bff',
                            color: 'white',
                            border: 'none'
                        }}
                        title={useGtawName ? `Using GTAW: ${gtawCharacterName}` : `Use GTAW name: ${gtawCharacterName}`}
                    >
                        <i className={`fas ${useGtawName ? 'fa-check' : 'fa-user'}`} style={{ marginRight: '5px' }}></i>
                        {useGtawName ? 'Using GTAW' : 'Use GTAW'}
                    </button>
                )}
            </div>
            
            {useGtawName ? (
                <div style={{ 
                    padding: '10px', 
                    backgroundColor: '#1a2332', 
                    border: '1px solid #28a745', 
                    borderRadius: '4px',
                    marginBottom: '1rem'
                }}>
                    <div style={{ color: '#28a745', fontWeight: 'bold', marginBottom: '5px' }}>
                        <i className="fas fa-user-check" style={{ marginRight: '8px' }}></i>
                        Using GTAW OAuth Credentials
                    </div>
                    <div style={{ color: '#eeeeeeb0' }}>
                        <strong>Name:</strong> {gtawCharacterName}<br/>
                        <strong>Username:</strong> {gtaWorldUser?.username}<br/>
                        <strong>Badge Number:</strong> {gtaWorldUser?.character.id}<br/>
                        {gtaWorldUser?.faction?.rank && (
                            <><strong>Rank:</strong> {gtaWorldUser.faction.rank.split('-')[0].trim()}<br/></>
                        )}
                        <small style={{ color: '#6c757d' }}>Click "Use GTAW" again to switch back to database selection</small>
                    </div>
                </div>
            ) : (
                <Select
                    name={employeeNameField}
                    value={groupedOptions
                        .flatMap(group => group.options)
                        .find(option => option.value === formData[employeeNameField]) || null}
                    onChange={(selectedOption) => handleSelectChange(selectedOption, { name: employeeNameField })}
                    options={groupedOptions}
                    isClearable
                    placeholder={`Search or select ${employeeType}...`}
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
            )}
        </>
    );
};

const PhysEval = ({
            formData,
            handleChange,
            phmcGroupedOptions,
            setFormData,
            phmcRank,
            setShowEmployeeModal,
            BodyMassIndex,
            temperature,
            heartRate,
            breathing,
            bloodPressure,
            patientJob,
            patientJobRisks,
            patientAllergiesRisk,
            patientMedicineRegular,
            patientOther,
            predisposition,
            handleSelectChange,
            
        }) => {
    return (
    <>
                                <p>The FORM below must be used and added to the file for each medical appointment, following the others.</p>
                                <Form.Label>Patient ID | Date:</Form.Label>
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

                                <Form.Control
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    className="form-control"
                                    
                                /> </div>

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


                                    <Form.Label>Patient Measurements</Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>

                                    <Form.Control
                                        type="text"
                                        name="patientHeight"
                                        value={formData.patientHeight}
                                        onChange={handleChange}
                                        placeholder="Height"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientWeight"
                                        value={formData.patientWeight}
                                        onChange={handleChange}
                                        placeholder="Weight"
                                    />

                                    <Form.Select
                                        name="BodyMassIndex"
                                        value={formData.BodyMassIndex}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                BodyMassIndex: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Body Mass Index</option>
                                        {BodyMassIndex.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select></div>


                                    <Form.Label>Vitals</Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Select
                                        name="temperature"
                                        value={formData.temperature}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                temperature: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Select Temperature</option>
                                        {temperature.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="heartRate"
                                        value={formData.heartRate}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                heartRate: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Select Heart Rate</option>
                                        {heartRate.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="breathing"
                                        value={formData.breathing}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                breathing: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Breathing</option>
                                        {breathing.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="bloodPressure"
                                        value={formData.bloodPressure}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                bloodPressure: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Blood Pressure</option>
                                        {bloodPressure.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select></div>

                                <Form.Group className="mb-3">
                                    <Form.Label>Anamnesis</Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Select
                                        name="patientJob"
                                        value={formData.patientJob}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                patientJob: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Patient Job</option>
                                        {patientJob.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="patientJobRisks"
                                        value={formData.patientJobRisks}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                patientJobRisks: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Job Risks (Optional) </option>
                                        {patientJobRisks.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="patientAllergiesRisk"
                                        value={formData.patientAllergiesRisk}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                patientAllergiesRisk: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Patient Allergies Risk</option>
                                        {patientAllergiesRisk.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
</div>
                                    <div style={{ display: 'flex', gap: '10px' }}>

                                    {formData.patientJob === 'Yes' && (
                                    <Form.Control
                                    type="text"
                                    name="patientCareer"
                                    value={formData.patientCareer}
                                    onChange={handleChange}
                                    placeholder="Patient Job"
                                    required
                                    className="form-control"
                                    />
                                )}
                                    {formData.patientJob === 'No' && (
                                    <Form.Control
                                    type="text"
                                    name="patientCareer"
                                    value={formData.patientCareer}
                                    onChange={handleChange}
                                    placeholder="Patient Job No"
                                    required
                                    className="form-control"
                                    />
                                )} 
                                    {formData.patientJobRisks === 'Yes' && (
                                    <Form.Control
                                    type="text"
                                    name="careerRisks"
                                    value={formData.careerRisks}
                                    onChange={handleChange}
                                    placeholder="Patient Job Risks"
                                    required
                                    className="form-control"
                                    />
                                )} 
                                  {formData.patientAllergiesRisk === 'Yes' && (
                                    <Form.Control
                                    type="text"
                                    name="patientAllergies"
                                    value={formData.patientAllergies}
                                    onChange={handleChange}
                                    placeholder="Patient Allergies Risks"
                                    required
                                    className="form-control"
                                    />
                                )} 

                                </div>
                                
                                <div style={{ display: 'flex', gap: '10px' }}>

                                <Form.Select
                                        name="patientMedicineRegular"
                                        value={formData.patientMedicineRegular}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                patientMedicineRegular: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Patient Current Medications</option>
                                        {patientMedicineRegular.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="patientOther"
                                        value={formData.patientOther}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                patientOther: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Patient Imparements?</option>
                                        {patientOther.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="predisposition"
                                        value={formData.predisposition}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                predisposition: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Predisposition</option>
                                        {predisposition.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select></div>
                                    <div style={{ display: 'flex', gap: '10px' }}>

                                    {formData.patientMedicineRegular === 'Yes' && (
                                    <Form.Control
                                    type="text"
                                    name="patientMedicine"
                                    value={formData.patientMedicine}
                                    onChange={handleChange}
                                    placeholder="What medication(s) is the patient currently taking?"
                                    required
                                    className="form-control"
                                    />
                                )} 
                                    {formData.patientOther === 'Yes' && (
                                    <Form.Control
                                    type="text"
                                    name="patientImpairments"
                                    value={formData.patientImpairments}
                                    onChange={handleChange}
                                    placeholder="Patient Imparements"
                                    required
                                    className="form-control"
                                    />
                                )} </div>
                                        <Form.Control
                                        as="textarea"
                                        name="patientSummary"
                                        value={formData.patientSummary}
                                        onChange={handleChange}
                                        rows="4"
                                        required
                                        className={`form-control ${!formData.patientSummary ? 'is-invalid' : ''}`}
                                        placeholder="Assessment Statement"
                                    />
                                </Form.Group>
                            </>
    );
};

export default PhysEval;