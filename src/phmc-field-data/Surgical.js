import React, { useState, useEffect } from 'react';
import { Form, Button } from 'react-bootstrap';
import Select from 'react-select';
import useGtaWorldAuth from '../hooks/useGtaWorldAuth';
import { getCharacterName, getCharacterID } from '../utils/characterUtils';

const EmployeeCredentialsSection = ({ 
    formData, 
    setFormData, 
    groupedOptions, 
    handleSelectChange, 
    setShowEmployeeModal,
    employeeType = 'phmc'
}) => {
    const {
        user: gtaWorldUser,
        isAuthenticated: isGtaAuthenticated,
        canSwapCharacters,
        swapCharacter,
        swappableCharacters,
        factionData
    } = useGtaWorldAuth();

    const [useGtawName, setUseGtawName] = useState(false);
        const employeeNameField = `${employeeType}Employee`;
    const employeeBadgeField = `${employeeType}Badge`;
    const employeeRankField = `${employeeType}Rank`;
    const employeeDiscordField = `${employeeType}Discord`;
    const employeePHNumberField = `${employeeType}PHNumber`;

    const isDevelopmentEnvironment =
        window.location.hostname === 'localhost' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.') ||
        window.location.hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./); 
    
    useEffect(() => {
        if (isGtaAuthenticated && gtaWorldUser && !useGtawName) {
            // Check if we have a valid character name
            const gtawCharacterName = getCharacterName(gtaWorldUser);
            
            if (gtawCharacterName && gtawCharacterName !== 'GTAW User') {
                setUseGtawName(true);
                
                // Clean rank by removing dashes
                const cleanRank = gtaWorldUser?.faction?.rank ? 
                    gtaWorldUser.faction.rank.replace(/-/g, '').trim() : 'GTAW User';
                
                // Get character data using helper function
                const characterId = getCharacterID(gtaWorldUser);
                
                setFormData(prev => ({
                    ...prev,
                    [employeeNameField]: gtawCharacterName,
                    [employeeBadgeField]: characterId, 
                    [employeeRankField]: cleanRank,
                    [employeeDiscordField]: gtaWorldUser?.username || '',
                    [employeePHNumberField]: '50056'
                }));
            }
        }
    }, [isGtaAuthenticated, gtaWorldUser, useGtawName, setFormData, employeeNameField, employeeBadgeField, employeeRankField, employeeDiscordField, employeePHNumberField]);
    
    useEffect(() => {
        if (useGtawName && isGtaAuthenticated && gtaWorldUser && factionData) {
            const cleanRank = factionData.rank ? factionData.rank.split('-')[0].trim() : 'GTAW User';
            setFormData(prev => ({
                ...prev,
                coronerEmployee: factionData.characterName,
                coronerBadge: factionData.characterId || '',
                coronerRank: cleanRank,
                coronerDiscord: gtaWorldUser?.username || '',
                coronerPHNumber: '50056'
            }));
        }
    }, [factionData, useGtawName, isGtaAuthenticated, gtaWorldUser, setFormData]);

    const gtawCharacterName = factionData?.characterName || null;

    const handleSwap = () => {
        if (!canSwapCharacters || !factionData) return;

        const currentIndex = swappableCharacters.findIndex(c => c.character.characterId === factionData.characterId);
        const nextIndex = (currentIndex + 1) % swappableCharacters.length;
        const nextCharacterId = swappableCharacters[nextIndex].character.characterId;
        swapCharacter(nextCharacterId);
    };

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                <Form.Label style={{ marginBottom: 0 }}>Employee Name</Form.Label>
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
                    <i className="fas fa-question-circle" style={{ marginRight: '5px' }}></i>
                    Missing Name?
                </button>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                {(isGtaAuthenticated && gtawCharacterName) && (
                    <button
                        type="button"
                        onClick={() => setUseGtawName(!useGtawName)}
                        className="btn btn-outline-light"
                        style={{
                            padding: '0.375rem 0.75rem',
                            fontSize: '0.875rem',
                            border: useGtawName ? '1px solid #28a745' : '1px solid #6c757d',
                            color: useGtawName ? '#28a745' : '#6c757d'
                        }}
                        title={useGtawName ? `Using GTAW: ${gtawCharacterName}` : `Use GTAW name: ${gtawCharacterName}`}
                    >
                        <i className={`fas ${useGtawName ? 'fa-check' : 'fa-user'}`} style={{ marginRight: '5px' }}></i>
                        {useGtawName ? 'Using GTAW' : 'Use GTAW'}
                    </button>
                )}
                                {canSwapCharacters && useGtawName && factionData && (
                    <button type="button" onClick={handleSwap} className="btn btn-outline-info" style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}>
                        <i className="fas fa-random" style={{ marginRight: '5px' }}></i>
                        Switch Employee
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
                        <strong>Badge Number:</strong> {factionData?.characterId || gtaWorldUser?.id}<br/>
                        {factionData?.rank && (
                            <><strong>Rank:</strong> {factionData.rank.split('-')[0].trim()}<br/></>
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
                    className={`form-control ${!formData[employeeNameField] ? 'is-invalid' : ''}`}
                    styles={{ 
                        control: (base, state) => ({
                            ...base,
                            backgroundColor: '#16202c',
                            color: '#eeeeeeb0',
                            borderColor: !formData[employeeNameField] && state.isFocused ? '#dc3545' :
                                         !formData[employeeNameField] ? '#dc3545' :
                                         state.isFocused ? '#86b7fe' : '#6c757d',
                            '&:hover': {
                                borderColor: !formData[employeeNameField] ? '#dc3545' : '#86b7fe'
                            },
                            boxShadow: !formData[employeeNameField] && state.isFocused ? '0 0 0 0.25rem rgba(220, 53, 69, 0.25)' :
                                       state.isFocused ? '0 0 0 0.25rem rgba(13, 110, 253, 0.25)' : null,
                        }),
                        menu: (base) => ({ ...base, backgroundColor: '#16202c', zIndex: 1000 }),
                        option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? 'Grey' : '#16202c', color: '#eeeeeeb0' }),
                        singleValue: (base) => ({ ...base, color: '#eeeeeeb0' }),
                        input: (base) => ({ ...base, color: '#eeeeeeb0' }),
                        placeholder: (base) => ({ ...base, color: '#eeeeeeb0' }),
                        group: (base) => ({ ...base, paddingTop: 8, paddingBottom: 8 }),
                        groupHeading: (base) => ({ ...base, color: '#6c757d', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: 4 })
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
const Surgical = ({ // Renamed component to follow PascalCase convention
            formData,
            handleChange,
            phmcGroupedOptions, // Added this prop
            setFormData,
            phmcRank,
            patientConsent,
            complications,
            procedureGood,
            setShowEmployeeModal,
            handleSelectChange
        }) => {
    return (
    <>
    <p>The FORM below must be used and added to the file for each surgery appointment, following the others.</p>
    <Form.Label>Patient ID, leave blank if unsure</Form.Label>
    <Form.Control
                type="text"
                name="patientID"
                value={formData.patientID}
                onChange={handleChange}
                placeholder="Patient ID  (Optional)"
                className={`form-control ${!formData.patientID ? 'is-invalid' : ''}`}

            />

        <Form.Label>Appointment Date</Form.Label>
        <Form.Control
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            className={`form-control ${!formData.date ? 'is-invalid' : ''}`}

            required
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

    <Select
        isMulti
        name="extraStaff"
        options={phmcGroupedOptions.map(group => ({
            label: group.label,
            options: group.options.map(option => ({ value: option.value, label: option.label }))
        }))}
        value={Array.isArray(formData.extraStaff)
            ? formData.extraStaff.map(staff => ({ value: staff, label: staff }))
            : []}
        onChange={(selectedOptions) => {
            const selectedValues = selectedOptions ? selectedOptions.map(option => option.value) : [];
            handleChange({
                target: {
                    name: 'extraStaff',
                    value: selectedValues
                }
            });
        }}
        className="form-control"
        placeholder="Enter staff present (( Leave empty if none)  )) "
        styles={{                                        
            control: (base) => ({
        ...base,
        minHeight: '38px',
        backgroundColor: '#16202c',
        color: '#eeeeeeb0',
        borderColor: '#6c757d',
        '&:hover': {
            borderColor: '#eeeeeeb0'
        }
    }),
    menu: (base) => ({
        ...base,
        backgroundColor: '#16202c',
        zIndex: 1000,
        border: '1px solid #6c757d',
        borderRadius: '0.375rem'
    }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isFocused ? '#30363d' : '#16202c',
        color: '#eeeeeeb0',
        padding: '0.5rem 1rem',
        '&:hover': {
            backgroundColor: '#30363d'
        }
    }),
    multiValue: (base) => ({
        ...base,
        backgroundColor: '#30363d',
        color: '#eeeeeeb0'
    }),
    multiValueLabel: (base) => ({
        ...base,
        color: '#eeeeeeb0'
    }),
    multiValueRemove: (base) => ({
        ...base,
        color: '#6c757d',
        '&:hover': {
            backgroundColor: '#dc3545',
            color: '#fff'
        }
    }),
    input: (base) => ({
        ...base,
        color: '#eeeeeeb0'
    }),
    placeholder: (base) => ({
        ...base,
        color: '#6c757d'
    })
}}
/>                                
    <Form.Label></Form.Label>
        <Form.Label>Surgical Inquiry   </Form.Label>
        <Form.Control
            type="text"
            name="surgeryProcedures"
            value={formData.surgeryProcedures}
            onChange={handleChange}
            placeholder="Name of the procedure	"
            required
        />

        <div style={{ display: 'flex', gap: '10px' }}>
        <Form.Select
        name="patientConsentOption"
        value={formData.patientConsentOption}
        onChange={(e) => {
            const selectedType = e.target.value;
            setFormData(prev => ({
                ...prev,
                patientConsentOption: selectedType,
                patientConsentYes: selectedType === 'Yes' ? prev.patientConsentYes : '',
                patientConsentNo: selectedType === 'No' ? prev.patientConsentNo : '',
            }));
        }}
        required
        className={`form-control ${!formData.patientConsentOption ? 'is-invalid' : ''}`}
    >
        <option value="" disabled>Patient Consented?</option>
        {patientConsent.map((option) => (
            <option key={option.value} value={option.value}>{option.value}</option>
        ))}
    </Form.Select>        
    <Form.Select
        name="patientComplicationOptions"
        value={formData.patientComplicationOptions}
        onChange={(e) => {
            const selectedType = e.target.value;
            setFormData(prev => ({
                ...prev,
                patientComplicationOptions: selectedType,
                patientComplicationsYes: selectedType === 'Yes' ? prev.patientComplicationsYes : '',
                patientComplicationsNo: selectedType === 'No' ? prev.patientComplicationsNo : '',
            }));
        }}
        required
        className={`form-control ${!formData.patientComplicationOptions ? 'is-invalid' : ''}`}
    >
        <option value="" disabled>Surgery Complications?</option>
        {complications.map((option) => (
            <option key={option.value} value={option.value}>{option.value}</option>
        ))}
    </Form.Select>
    <Form.Select
        name="procedureGoodOptions"
        value={formData.procedureGoodOptions}
        onChange={(e) => {
            const selectedType = e.target.value;
            setFormData(prev => ({
                ...prev,
                procedureGoodOptions: selectedType,
                procedureGoodYes: selectedType === 'Yes' ? prev.procedureGoodYes : '',
                procedureGoodNo: selectedType === 'No' ? prev.procedureGoodNo : '',
            }));
        }}
        required
        className={`form-control ${!formData.procedureGoodOptions ? 'is-invalid' : ''}`}
    >
        <option value="" disabled>Procedure Good?</option>
        {procedureGood.map((option) => (
            <option key={option.value} value={option.value}>{option.value}</option>
        ))}
    </Form.Select>
    </div>

        <Form.Label> Post-Anesthesia Report</Form.Label>
        <div style={{ display: 'flex', gap: '10px' }}>
        <Form.Control
            as="textarea"
            name="patientSummaryConsultation"
            value={formData.patientSummaryConsultation}
            onChange={handleChange}
            placeholder="Summary of Consultation"
            rows="4"
            required
            className={`form-control ${!formData.patientSummaryConsultation ? 'is-invalid' : ''}`}
        />
        <Form.Control
            as="textarea"
            name="patientAddress"
            value={formData.patientAddress}
            onChange={handleChange}
            rows="4"
            required
            className={`form-control ${!formData.patientAddress ? 'is-invalid' : ''}`}
            placeholder="Post-Operative Anesthesia Details	"
        /></div>
        <Form.Label> Summary of Surgical Procedure</Form.Label>
        <Form.Control
            as="textarea"
            name="patientSummary"
            value={formData.patientSummary}
            onChange={handleChange}
            rows="4"
            required
            className={`form-control ${!formData.patientSummary ? 'is-invalid' : ''}`}
            placeholder="Summary of Surgical Procedure	"
        />
</>
    );
};

export default Surgical; // Export with PascalCase name