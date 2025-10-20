import React, { useState, useEffect } from 'react';
import { Form , Button, InputGroup} from 'react-bootstrap';
import Select from 'react-select';
import ImagePreview from '../components/ImagePreview';
import useGtaWorldAuth from '../hooks/useGtaWorldAuth';
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
    const gtawCharacterName = isGtaAuthenticated && gtaWorldUser ? getCharacterName(gtaWorldUser) : null;

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
                    <i className="fas fa-question-circle" style={{ marginRight: '5px' }}></i>
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
                        <strong>Name:</strong> {gtawCharacterName}<br/>
                        <strong>Username:</strong> {gtaWorldUser?.username}<br/>
                        <strong>Badge Number:</strong> {getCharacterID(gtaWorldUser)}<br/>
                        {gtaWorldUser?.faction?.rank && (
                            <><strong>Rank:</strong> {gtaWorldUser.faction.rank.split('-')[0].trim()}<br/></>
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

const EmailInternal = ({
    formData,
    handleChange,
    setFormData,
    isUploading,
    handleImageUpload,
    phmcGroupedOptions,
    setShowEmployeeModal,
    handleSelectChange
}) => {
    return (
        <>
        <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Control
                type="text"
                name="patientNotes"
                value={formData.patientNotes}
                onChange={handleChange}
                placeholder="Email Subject"
                required
                className={`form-control ${!formData.patientNotes ? 'is-invalid' : ''}`}

            />
            <Form.Control
                type="text"
                name="decedentName"
                value={formData.decedentName}
                onChange={handleChange}
                placeholder="Email Recipient"
                required
                className={`form-control ${!formData.decedentName ? 'is-invalid' : ''}`}

            />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Control
            as="textarea"
            name="synopsis"
            value={formData.synopsis}
            onChange={handleChange}
            rows="4"
            placeholder="Email Body"
            required
            className={`form-control ${!formData.synopsis ? 'is-invalid' : ''}`}
        />
        </div>
        <Form.Group className="mb-3 upload-container">
        <InputGroup>
            <Form.Control
                as="textarea"
                rows="4"
                name="scenePhotos"
                value={formData.scenePhotos}
                onChange={handleChange}
                required
                className={`form-control ${!formData.scenePhotos ? 'is-invalid' : ''}`}
                placeholder="Employee Signature Image"
                onPaste={(e) => {
                    const clipboardData = e.clipboardData || window.clipboardData;
                    const pastedData = clipboardData.getData('text');
                    const items = clipboardData.items;


                    let hasImageItem = false;

                    // Check if pasted content is a URL
                    const urlRegex = /(https?:\/\/[^\s]+)/g;
                    const containsUrl = urlRegex.test(pastedData);


                    // Handle image files from clipboard
                    for (let i = 0; i < items.length; i++) {
                        if (items[i].type.indexOf('image') !== -1) {
                            hasImageItem = true;
                            const file = items[i].getAsFile();
                            handleImageUpload({ target: { files: [file] } }, 'scenePhotos');
                            e.preventDefault();
                            break;
                        }
                    }

                    // If it's a URL and not an image file, allow direct paste
                    if (containsUrl && !hasImageItem) {

                        // Get current value and cursor position
                        const currentValue = formData.scenePhotos || '';
                        const cursorPos = e.target.selectionStart;


                        // Add comma if there's existing content
                        const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                        const newValue = currentValue.slice(0, cursorPos) +
                            (cursorPos > 0 ? separator : '') +
                            pastedData +
                            currentValue.slice(cursorPos);


                        // Update form data
                        setFormData(prev => ({
                            ...prev,
                            scenePhotos: newValue
                        }));

                        e.preventDefault();
                    } else {
                    }
                }}
            />
            <Button
                variant="success"
                disabled={isUploading}
                onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.multiple = true;
                    input.onchange = (e) => handleImageUpload(e, 'scenePhotos');
                    input.click();
                }}
            >
                <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                {isUploading ? 'Uploading...' : 'Upload Images'}
            </Button>

        </InputGroup>
        <span className="helper-text">
        This supports clipboard uploading, ctrl + V! | Hosted by ImgBB! - <a href="https://imgbb.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
        </span>
        <ImagePreview imageUrls={formData.scenePhotos} />
    </Form.Group>

        <EmployeeCredentialsSection 
            formData={formData}
            setFormData={setFormData}
            groupedOptions={phmcGroupedOptions}
            handleSelectChange={handleSelectChange}
            setShowEmployeeModal={setShowEmployeeModal}
            employeeType="phmc"
        />
    <Form.Label></Form.Label>
    <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Control
                type="text"
                name="decedentOOC"
                value={formData.decedentOOC}
                onChange={handleChange}
                placeholder="PHMC Rank / Position"
                required
                className={`form-control ${!formData.decedentOOC ? 'is-invalid' : ''}`}

            />
            <Form.Control
                type="text"
                name="patientCareer"
                value={formData.patientCareer}
                onChange={handleChange}
                placeholder="Assigned Department"
                required
                className={`form-control ${!formData.patientCareer ? 'is-invalid' : ''}`}

            />
        </div>
        </>
);
};

export default EmailInternal;