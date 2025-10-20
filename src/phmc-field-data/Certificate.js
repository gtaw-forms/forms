// src/phmc-field-data/Certificate.js
import React, { useState, useEffect } from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';
import Select from 'react-select';
import useGtaWorldAuth from '../hooks/useGtaWorldAuth';
import { getCharacterName } from '../utils/characterUtils';

const EmployeeCredentialsSection = ({ 
    formData, 
    setFormData, 
    coronerGroupedOptions, 
    handleSelectChange, 
    setShowEmployeeModal 
}) => {
    const { user: gtaWorldUser, isAuthenticated: isGtaAuthenticated } = useGtaWorldAuth();
    const [useGtawName, setUseGtawName] = useState(false);
    
    // Detect localhost/development environment
    const isDevelopmentEnvironment =
        window.location.hostname === 'localhost' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.') ||
        window.location.hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./); 
    
    // Automatically enable GTAW credentials when user is authenticated and not in development
    useEffect(() => {
        if (isGtaAuthenticated && gtaWorldUser && !isDevelopmentEnvironment && !useGtawName) {
            // Check if we have a valid character name
            const gtawCharacterName = getCharacterName(gtaWorldUser);
            
            if (gtawCharacterName) {
                setUseGtawName(true);
            }
        }
    }, [isGtaAuthenticated, gtaWorldUser, isDevelopmentEnvironment, useGtawName]);
    
    // Populate GTAW credentials when useGtawName is enabled
    useEffect(() => {
        if (useGtawName && isGtaAuthenticated && gtaWorldUser) {
            // Check if we have a valid character name
            const gtawCharacterName = getCharacterName(gtaWorldUser);
            
            if (gtawCharacterName) {
                // Clean rank by removing dashes and extra text
                const cleanRank = gtaWorldUser?.faction?.rank ? 
                    gtaWorldUser.faction.rank.split('-')[0].trim() : 'GTAW User';
                
                setFormData(prev => ({
                    ...prev,
                    coronerEmployee: gtawCharacterName,
                    coronerBadge: gtaWorldUser?.character?.id || gtaWorldUser?.id || '', 
                    coronerRank: cleanRank,
                    coronerDiscord: gtaWorldUser?.username || '',
                    coronerPHNumber: '50056'
                }));
            }
        }
    }, [useGtawName, isGtaAuthenticated, gtaWorldUser, setFormData]);

    // Get GTAW character name if available
    const gtawCharacterName = isGtaAuthenticated && gtaWorldUser ? getCharacterName(gtaWorldUser) : null;

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                <Form.Label style={{ marginBottom: 0 }}>Coroner Issuing Certificate</Form.Label>
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
            
            {/* Show GTAW toggle button if authenticated or in development */}
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
                        <strong>Name:</strong> {gtawCharacterName}<br/>
                        <strong>Username:</strong> {gtaWorldUser?.username}<br/>
                        <strong>Badge Number:</strong> {gtaWorldUser?.character?.id || gtaWorldUser?.id}<br/>
                        {gtaWorldUser?.faction?.rank && (
                            <><strong>Rank:</strong> {gtaWorldUser.faction.rank.split('-')[0].trim()}<br/></>
                        )}
                        <small style={{ color: '#6c757d' }}>Click "Use GTAW" again to switch back to database selection</small>
                    </div>
                </div>
            ) : (
                <Select
                    name="coronerEmployee"
                    value={coronerGroupedOptions
                        .flatMap(group => group.options)
                        .find(option => option.value === formData.coronerEmployee) || null}
                    onChange={(selectedOption, actionMeta) => handleSelectChange(selectedOption, actionMeta)}
                    options={coronerGroupedOptions}
                    isClearable
                    placeholder="Search or select coroner..."
                    className={`form-control ${!formData.coronerEmployee ? 'is-invalid' : ''}`}
                    styles={{
                        control: (base, state) => ({
                            ...base,
                            backgroundColor: '#16202c',
                            color: '#eeeeeeb0',
                            borderColor: !formData.coronerEmployee && state.isFocused ? '#dc3545' :
                                         !formData.coronerEmployee ? '#dc3545' :
                                         state.isFocused ? '#86b7fe' : '#6c757d',
                            '&:hover': {
                                borderColor: !formData.coronerEmployee ? '#dc3545' : '#86b7fe'
                            },
                            boxShadow: !formData.coronerEmployee && state.isFocused ? '0 0 0 0.25rem rgba(220, 53, 69, 0.25)' :
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
            )}
            
            {!isGtaAuthenticated && !isDevelopmentEnvironment && (
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
                coronerGroupedOptions={coronerGroupedOptions}
                handleSelectChange={handleSelectChange}
                setShowEmployeeModal={setShowEmployeeModal}
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