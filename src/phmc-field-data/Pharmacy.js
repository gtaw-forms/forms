import React, { useState, useEffect } from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';
import Select from 'react-select'; // Make sure react-select is imported
import ImagePreview from '../components/ImagePreview';
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
                    className="close-button" // Consider a more specific class if needed
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
                    styles={{ // Keep the styles for react-select
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

// Destructure the props that this component will need from App.js
const Pharmacy = ({
    formData,
    handleChange,
    setShowEmployeeModal,
    phmcGroupedOptions,
    isUploading,
    handleImageUpload, 
    setFormData, // We need this for the Select's onChange logic
    handleSelectChange
}) => {
    return (
        <>
            {/* The JSX code block for bbCodeVersion === 22 */}
            <Form.Control
                type="text"
                name="patientID"
                value={formData.patientID}
                onChange={handleChange}
                placeholder="Patient ID (If available)"
                required
                className="form-control"
            />

            <Form.Label>Perscription Issued Date:</Form.Label>
            <Form.Control
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                className="form-control"
            />
            <Form.Control
                type="text" 
                name="drugName"
                value={formData.drugName}
                onChange={handleChange}
                placeholder="Drug Name"
                required
                className={`form-control ${!formData.drugName ? 'is-invalid' : ''}`}
            />
            <Form.Control
                type="text" 
                name="drugDiag"
                value={formData.drugDiag}
                onChange={handleChange}
                placeholder="Diagnosis / Reasoning for Drug"
                required
                className={`form-control ${!formData.drugDiag ? 'is-invalid' : ''}`}
            />
            <Form.Control
                type="text" 
                name="drugStr"
                value={formData.drugStr}
                onChange={handleChange}
                placeholder="Drug Strength"
                required
                className={`form-control ${!formData.drugStr ? 'is-invalid' : ''}`}
            />
            <Form.Control
                type="text" 
                name="drugCourse"
                value={formData.drugCourse}
                onChange={handleChange}
                placeholder="Drug Course"
                required
                className={`form-control ${!formData.drugCourse ? 'is-invalid' : ''}`}
            />
            <Form.Group className="mb-3 upload-container">
                <InputGroup>
                    <Form.Control
                        as="textarea"
                        name="scenePhotos"
                        value={formData.scenePhotos}
                        onChange={handleChange}
                        rows="2"
                        required
                        className={`form-control ${!formData.scenePhotos ? 'is-invalid' : ''}`}
                        placeholder="Upload Scene Photos (comma-separated)"
                        onPaste={(e) => { // Keep the paste logic
                            const clipboardData = e.clipboardData || window.clipboardData;
                            const pastedData = clipboardData.getData('text');
                            const items = clipboardData.items;
                            let hasImageItem = false;
                            const urlRegex = /(https?:\/\/[^\s]+)/g;
                            const containsUrl = urlRegex.test(pastedData);

                            for (let i = 0; i < items.length; i++) {
                                if (items[i].type.indexOf('image') !== -1) {
                                    hasImageItem = true;
                                    const file = items[i].getAsFile();
                                    handleImageUpload({ target: { files: [file] } }, 'scenePhotos');
                                    e.preventDefault();
                                    break;
                                }
                            }
                            if (containsUrl && !hasImageItem) {
                                const currentValue = formData.scenePhotos || '';
                                const cursorPos = e.target.selectionStart;
                                const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                                const newValue = currentValue.slice(0, cursorPos) +
                                    (cursorPos > 0 ? separator : '') +
                                    pastedData +
                                    currentValue.slice(cursorPos);
                                setFormData(prev => ({ ...prev, scenePhotos: newValue }));
                                e.preventDefault();
                            } else {
                                console.log('No URL detected or image item present');
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
                <ImagePreview imageUrls={formData.scenePhotos} />
                <span className="helper-text">
                    This supports clipboard uploading, ctrl + V! | Hosted by ImgBB! - <a href="https://imgbb.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                </span>
            </Form.Group>
            <Form.Group className="mb-3 upload-container">
                <div className="input-group">
                    <Form.Control
                        as="textarea"
                        name="additionalImages"
                        value={formData.additionalImages}
                        onChange={handleChange}
                        rows="2"
                        required
                        className={`form-control ${!formData.additionalImages ? 'is-invalid' : ''}`}
                        placeholder="Morgue Screen, Cinjuries, CDNA Links (comma-separated)"
                        onPaste={(e) => { // Keep the paste logic
                            const clipboardData = e.clipboardData || window.clipboardData;
                            const pastedData = clipboardData.getData('text');
                            const items = clipboardData.items;
                            let hasImageItem = false;
                            const urlRegex = /(https?:\/\/[^\s]+)/g;
                            const containsUrl = urlRegex.test(pastedData);

                            for (let i = 0; i < items.length; i++) {
                                if (items[i].type.indexOf('image') !== -1) {
                                    hasImageItem = true;
                                    const file = items[i].getAsFile();
                                    handleImageUpload({ target: { files: [file] } }, 'additionalImages');
                                    e.preventDefault();
                                    break;
                                }
                            }
                            if (containsUrl && !hasImageItem) {
                                const currentValue = formData.additionalImages || '';
                                const cursorPos = e.target.selectionStart;
                                const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                                const newValue = currentValue.slice(0, cursorPos) +
                                    (cursorPos > 0 ? separator : '') +
                                    pastedData +
                                    currentValue.slice(cursorPos);
                                setFormData(prev => ({ ...prev, additionalImages: newValue }));
                                e.preventDefault();
                            } else {
                                console.log('No URL detected or image item present');
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
                            input.onchange = (e) => handleImageUpload(e, 'additionalImages');
                            input.click();
                        }}
                    >
                        <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                        {isUploading ? 'Uploading...' : 'Upload Images'}
                    </Button>
                </div>
                <ImagePreview imageUrls={formData.additionalImages} />
                <span className="helper-text">
                    This supports clipboard uploading, ctrl + V! | Hosted by ImgBB! - <a href="https://imgbb.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                </span>
                <label>Morgue Bugs:</label> {/* Use <Form.Label> ? */}
                <Form.Check
                    type="checkbox"
                    id="morgueStatus"
                    label="       Tick if Morgue Screen is unavailable / broken / inaccesssable"
                    checked={formData.morgueStatus === 'true'}
                    onChange={(e) => setFormData(prev => ({ // Use setFormData passed as prop
                        ...prev,
                        morgueStatus: e.target.checked.toString()
                    }))}
                />
            </Form.Group>

            <Form.Label></Form.Label>
            <EmployeeCredentialsSection 
                formData={formData}
                setFormData={setFormData}
                groupedOptions={phmcGroupedOptions}
                handleSelectChange={handleSelectChange}
                setShowEmployeeModal={setShowEmployeeModal}
                employeeType="phmc"
            />
            <Form.Label></Form.Label>
        </>
    );
};

export default Pharmacy;