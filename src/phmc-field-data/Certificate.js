// src/phmc-field-data/Certificate.js
import React, { useState, useEffect } from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';
import Select from 'react-select';
import useGtaWorldAuth from '../hooks/useGtaWorldAuth';
import { getCharacterName, getCharacterID } from '../utils/characterUtils';

const EmployeeCredentialsSection = ({ 
    formData, 
    setFormData, 
    groupedOptions, 
    handleSelectChange, 
    setShowEmployeeModal,
    employeeType = 'coroner'
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