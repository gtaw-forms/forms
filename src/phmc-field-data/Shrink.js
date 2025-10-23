import React, { useState, useEffect } from 'react';
import { Form, Button } from 'react-bootstrap'; 
import Select from 'react-select';
import useGtaWorldAuth from '../hooks/useGtaWorldAuth';
import { cleanRankText } from '../utils/textUtils';
import { getCharacterName, getCharacterID } from '../utils/characterUtils';

// Check if we're in development environment
const isDevelopmentEnvironment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

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
                
                const cleanRank = gtaWorldUser?.faction?.rank ? 
                    cleanRankText(gtaWorldUser.faction.rank) : 'GTAW User';
                
                // Get character data using helper function
                const characterId = getCharacterID(gtaWorldUser);
                
                setFormData(prev => ({
                    ...prev,
                    [employeeNameField]: gtawCharacterName,
                    [employeeBadgeField]: getCharacterID(gtaWorldUser) || '', 
                    [employeeRankField]: cleanRank,
                    [employeeDiscordField]: gtaWorldUser?.username || '',
                    [employeePHNumberField]: '50056'
                }));
            }
        }
    }, [isGtaAuthenticated, gtaWorldUser, useGtawName, setFormData, employeeNameField, employeeBadgeField, employeeRankField, employeeDiscordField, employeePHNumberField]);

    // Get GTAW character name if available
    const gtawCharacterName = isGtaAuthenticated && gtaWorldUser ? getCharacterName(gtaWorldUser) : null;

    const handleGtawToggle = () => {
        if (!useGtawName && gtawCharacterName) {
            // Switch to GTAW name
            setUseGtawName(true);
            
            // Clean rank by removing dashes and extra text
            const cleanRank = gtaWorldUser?.faction?.rank || 'GTAW User';
            
            setFormData(prev => ({
                ...prev,
                [employeeNameField]: gtawCharacterName,
                [employeeBadgeField]: getCharacterID(gtaWorldUser) || '', // Use character ID as badge number
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
                {isDevelopmentEnvironment && !isGtaAuthenticated && (
                    <div style={{ 
                        padding: '5px 10px', 
                        backgroundColor: '#ffc107', 
                        color: '#000', 
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                    }}>
                        <i className="fas fa-code" style={{ marginRight: '5px' }}></i>
                        Development Mode: Manual Selection Enabled
                    </div>
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
                        <strong>Character Name:</strong> {gtawCharacterName}<br/>
                        <strong>UCP User:</strong> {gtaWorldUser?.username}<br/>
                        <strong>Badge Number:</strong> {getCharacterID(gtaWorldUser)}<br/>
                        {gtaWorldUser?.faction?.rank && (
                            <><strong>Rank:</strong> {gtaWorldUser.faction.rank}<br/></>
                        )}
                        <small style={{ color: '#6c757d' }}>Click "Use GTAW" again to switch back to database selection</small>
                    </div>
                </div>
            ) : isDevelopmentEnvironment ? (
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
            ) : null}
            
            {!useGtawName && !isGtaAuthenticated && !isDevelopmentEnvironment && (
                <div style={{ 
                    padding: '15px', 
                    backgroundColor: '#2a2a2a', 
                    border: '1px solid #6c757d', 
                    borderRadius: '4px',
                    marginBottom: '1rem',
                    textAlign: 'center'
                }}>
                    <div style={{ color: '#6c757d', marginBottom: '10px' }}>
                        <i className="fas fa-exclamation-triangle" style={{ marginRight: '8px' }}></i>
                        GTAW Authentication Required
                    </div>
                    <div style={{ color: '#ccc', fontSize: '0.9rem' }}>
                        Please log in with your GTAW account to automatically populate your credentials.
                    </div>
                </div>
            )}
        </>
    );
};

const Shrink = ({
    formData,
    handleChange,
    setFormData,
    phmcGroupedOptions,
    phmcRank,
    Appearance,
    Behavior,
    Speech,
    Mood,
    ThoughtProcess,
    ThoughtContent,
    Insight,
    Cognition,
    Risk,
    admission,
    followup,
    setShowEmployeeModal,
    handleSelectChange
}) => {
    return (
        <>
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
                <Form.Control
                as="textarea"
                name="patientChiefComplaint"
                value={formData.patientChiefComplaint}
                onChange={handleChange}
                placeholder="Patient Chief Complaint"
                rows="3"
                className={`form-control ${!formData.patientChiefComplaint ? 'is-invalid' : ''}`}
                />

            <Form.Label> Presenting Problem</Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    type="text"
                    name="patientVisitReason"
                    value={formData.patientVisitReason}
                    onChange={handleChange}
                    placeholder="Description of the issue (eg: anxiety, depression)"
                    required
                    className={`form-control ${!formData.patientVisitReason ? 'is-invalid' : ''}`}

                />
                <Form.Control
                    type="text"
                    name="patientSymptoms"
                    value={formData.patientSymptoms}
                    onChange={handleChange}
                    placeholder="Onset and duration of symptoms"
                    required
                    className={`form-control ${!formData.patientSymptoms ? 'is-invalid' : ''}`}

                />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    type="text"
                    name="patientTriggers"
                    value={formData.patientTriggers}
                    onChange={handleChange}
                    placeholder="Triggers or stressors:"
                    required
                    className={`form-control ${!formData.patientTherapyMedicine ? 'is-invalid' : ''}`}

                />
                <Form.Control
                    type="text"
                    name="patientStress"
                    value={formData.patientStress}
                    onChange={handleChange}
                    placeholder="Impact on daily life:"
                    required
                    className={`form-control ${!formData.patientCareer ? 'is-invalid' : ''}`}

                />
            </div>

            <Form.Label> Mental Status Examination (MSE) </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>

            <Form.Select
                    name="Appearance"
                    value={formData.Appearance}
                    onChange={handleChange}
                    required
                    className={`form-control ${!formData.Appearance ? 'is-invalid' : ''}`}
                >
                    <option value="" disabled>Appearance</option>
                    {Appearance.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </Form.Select>
                <Form.Select
                    name="Behavior"
                    value={formData.Behavior}
                    onChange={handleChange}
                    required
                    className={`form-control ${!formData.Behavior ? 'is-invalid' : ''}`}
                >
                    <option value="" disabled>Behavior</option>
                    {Behavior.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </Form.Select>
                <Form.Select
                    name="Speech"
                    value={formData.Speech}
                    onChange={handleChange}
                    required
                    className={`form-control ${!formData.Speech ? 'is-invalid' : ''}`}
                >
                    <option value="" disabled>Speech</option>
                    {Speech.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </Form.Select>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Select
                        name="Mood"
                        value={formData.Mood}
                        onChange={handleChange}
                        required
                        className={`form-control ${!formData.Mood ? 'is-invalid' : ''}`}
                    >
                        <option value="" disabled>Mood</option>
                        {Mood.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Form.Select>
                    <Form.Select
                        name="Affect"
                        value={formData.Affect}
                        onChange={handleChange}
                        required
                        className={`form-control ${!formData.Affect ? 'is-invalid' : ''}`}
                    >
                        <option value="" disabled>Affect</option>
                        {Behavior.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Form.Select>
                    <Form.Select
                        name="ThoughtProcess"
                        value={formData.ThoughtProcess}
                        onChange={handleChange}
                        required
                        className={`form-control ${!formData.ThoughtProcess ? 'is-invalid' : ''}`}
                    >
                        <option value="" disabled>Thought Process</option>
                        {ThoughtProcess.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Form.Select>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Select
                        name="ThoughtContent"
                        value={formData.ThoughtContent}
                        onChange={handleChange}
                        required
                        className={`form-control ${!formData.ThoughtContent ? 'is-invalid' : ''}`}
                    >
                        <option value="" disabled>Thought Content</option>
                        {ThoughtContent.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Form.Select>
                    <Form.Select
                        name="Insight"
                        value={formData.Insight}
                        onChange={handleChange}
                        required
                        className={`form-control ${!formData.Insight ? 'is-invalid' : ''}`}
                    >
                        <option value="" disabled>Insight</option>
                        {Insight.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Form.Select>
                    <Form.Select
                        name="Cognition"
                        value={formData.Cognition}
                        onChange={handleChange}
                        required
                        className={`form-control ${!formData.Cognition ? 'is-invalid' : ''}`}
                    >
                        <option value="" disabled>Cognition</option>
                        {Cognition.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Form.Select>
                    </div>
                    <Form.Label> Psychiatric History </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Control
                as="textarea"
                name="patientTreatment"
                value={formData.patientTreatment}
                onChange={handleChange}
                placeholder="Past psychiatric diagnoses and treatments:"
                rows="3"
                className={`form-control ${!formData.patientTreatment ? 'is-invalid' : ''}`}
                />
                <Form.Control
                as="textarea"
                name="patientMedicalRecord"
                value={formData.patientMedicalRecord}
                onChange={handleChange}
                placeholder="Hospitalizations"
                rows="3"
                className={`form-control ${!formData.patientMedicalRecord ? 'is-invalid' : ''}`}
                                />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Control
                as="textarea"
                name="patientFamily"
                value={formData.patientFamily}
                onChange={handleChange}
                placeholder="Family psychiatric history:"
                rows="3"
                className={`form-control ${!formData.patientFamily ? 'is-invalid' : ''}`}
                 />
                <Form.Control
                as="textarea"
                name="patientJobRisks"
                value={formData.patientJobRisks}
                onChange={handleChange}
                placeholder="History of self-harm or suicide attempts"
                rows="3"
                className={`form-control ${!formData.patientJobRisks ? 'is-invalid' : ''}`}
                                />
                </div>
                <Form.Label> Medical History </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Control
                as="textarea"
                name="patientCondition"
                value={formData.patientCondition}
                onChange={handleChange}
                placeholder="Current and past medical conditions:"
                rows="3"
                className={`form-control ${!formData.patientCondition ? 'is-invalid' : ''}`}
                 />
                <Form.Control
                as="textarea"
                name="patientChronicDiseases"
                value={formData.patientChronicDiseases}
                onChange={handleChange}
                placeholder="Medications (including psychiatric and non-psychiatric):"
                rows="3"
                className={`form-control ${!formData.patientChronicDiseases ? 'is-invalid' : ''}`}
                />
                <Form.Control
                as="textarea"
                name="patientAllergies"
                value={formData.patientAllergies}
                onChange={handleChange}
                placeholder="Patient Allergies"
                rows="3"
                className={`form-control ${!formData.patientAllergies ? 'is-invalid' : ''}`}
                />
            </div>
            <Form.Label> Substance Abuse History </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Control
                type="text"
                name="patientDrugs"
                value={formData.patientDrugs}
                onChange={handleChange}
                placeholder="Use of alcohol, drugs, nicotine, and other substances:"
                className={`form-control ${!formData.patientDrugs ? 'is-invalid' : ''}`}
                 />
                <Form.Control
                type="text"
                name="patientDrugsUsage"
                value={formData.patientDrugsUsage}
                onChange={handleChange}
                placeholder="Frequency and duration of use:"
                className={`form-control ${!formData.patientDrugsUsage ? 'is-invalid' : ''}`}
                />
                <Form.Control
                type="text"
                name="patientMental"
                value={formData.patientMental}
                onChange={handleChange}
                placeholder="Impact on mental health"
                className={`form-control ${!formData.patientMental ? 'is-invalid' : ''}`}
                />
            </div>
            <Form.Label> Psychosocial History </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Control
                type="text"
                name="patientFam"
                value={formData.patientFam}
                onChange={handleChange}
                placeholder="Childhood and family background:"
                className={`form-control ${!formData.patientFam ? 'is-invalid' : ''}`}
                 />
                <Form.Control
                type="text"
                name="patientJob"
                value={formData.patientJob}
                onChange={handleChange}
                placeholder="Education and employment history:"
                className={`form-control ${!formData.patientJob ? 'is-invalid' : ''}`}
                />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                type="text"
                name="patientRelationship"
                value={formData.patientRelationship}
                onChange={handleChange}
                placeholder="Relationships and support system:"
                className={`form-control ${!formData.patientRelationship ? 'is-invalid' : ''}`}
                />
                <Form.Control
                type="text"
                name="patientLegal"
                value={formData.patientLegal}
                onChange={handleChange}
                placeholder="Legal issues"
                className={`form-control ${!formData.patientLegal ? 'is-invalid' : ''}`}
                />
            </div>
            <Form.Label> Risk Assessment </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Select
                name="Risk"
                value={formData.Risk}
                onChange={handleChange}
                required
                className={`form-control ${!formData.Risk ? 'is-invalid' : ''}`}
            >
                <option value="" disabled>Risk Assessment</option>
                {Risk.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </Form.Select>
                <Form.Control
                type="text"
                name="patientRiskAssessment"
                value={formData.patientRiskAssessment}
                onChange={handleChange}
                placeholder="Risk Assessment Details:"
                className={`form-control ${!formData.patientRiskAssessment ? 'is-invalid' : ''}`}
                />
                </div>
                <Form.Label> Findings </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                type="text"
                name="patientFindings"
                value={formData.patientFindings}
                onChange={handleChange}
                placeholder="Patient Notes / Findings:"
                className={`form-control ${!formData.patientFindings ? 'is-invalid' : ''}`}
                />
                </div>

                <Form.Label> Discharge Diagnosis </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                type="text"
                name="patientDiagnosis"
                value={formData.patientDiagnosis}
                onChange={handleChange}
                placeholder="Primary Diagnosis:"
                className={`form-control ${!formData.patientDiagnosis ? 'is-invalid' : ''}`}
                />
                </div>
                <Form.Label> Therapy </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Select
                name="admission"
                value={formData.admission}
                onChange={handleChange}
                required
                className={`form-control ${!formData.admission ? 'is-invalid' : ''}`}
            >
                <option value="" disabled>Admission</option>
                {admission.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </Form.Select>
                <Form.Control
                type="text"
                name="patientTreatmentPlan"
                value={formData.patientTreatmentPlan}
                onChange={handleChange}
                placeholder="Treatment Plan:"
                className={`form-control ${!formData.patientTreatmentPlan ? 'is-invalid' : ''}`}
                />
                <Form.Control
                type="text"
                name="patientTherapyMedicine"
                value={formData.patientTherapyMedicine}
                onChange={handleChange}
                placeholder="Medicine:"
                className={`form-control ${!formData.patientTherapyMedicine ? 'is-invalid' : ''}`}
                />
                <Form.Select
                name="followup"
                value={formData.followup}
                onChange={handleChange}
                required
                className={`form-control ${!formData.followup ? 'is-invalid' : ''}`}
            >
                <option value="" disabled>Follow Up</option>
                {followup.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </Form.Select>

                </div>
                <Form.Label> Treatment Plan / Recommendations </Form.Label>
        <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                type="text"
                name="patientTreatmentMedicine"
                value={formData.patientTreatmentMedicine}
                onChange={handleChange}
                placeholder="Medications:"
                className={`form-control ${!formData.patientTreatmentMedicine ? 'is-invalid' : ''}`}

                />
                <Form.Control
                type="text"
                name="patientTherapy"
                value={formData.patientTherapy}
                onChange={handleChange}
                placeholder="Therapy (e.g., CBT, DBT):"
                className={`form-control ${!formData.patientTherapy ? 'is-invalid' : ''}`}
                /></div> 
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                type="text"
                name="patientFollowUp"
                value={formData.patientFollowUp}
                onChange={handleChange}
                placeholder="Follow-up appointments:"
                className={`form-control ${!formData.patientFollowUp ? 'is-invalid' : ''}`}

                />
                <Form.Control
                type="text"
                name="patientSafety"
                value={formData.patientSafety}
                onChange={handleChange}
                placeholder="Safety planning (if at risk):"
                className={`form-control ${!formData.patientSafety ? 'is-invalid' : ''}`}
                />

                </div>

                </>
);
};

export default Shrink;