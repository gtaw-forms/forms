import React, { useState, useEffect } from 'react';
import { Form, InputGroup, Button} from 'react-bootstrap';
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
            const gtawCharacterName = getCharacterName(gtaWorldUser);
            
            if (gtawCharacterName && gtawCharacterName !== 'GTAW User') {
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
const cleanRank = gtaWorldUser?.faction?.rank || 'GTAW User';            
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
                        <strong>Badge Number:</strong> {gtaWorldUser?.character.id}<br/>
                        {gtaWorldUser?.faction?.rank && (
                            <><strong>Rank:</strong> {gtaWorldUser.faction.rank.split('-')[0].trim()}<br/></>
                        )}
                        <small style={{ color: '#6c757d' }}>Click "Use GTAW" again to switch back to database selection</small>
                    </div>
                </div>
            ) : isDevelopmentEnvironment ? (
                <Select
                    name="coronerEmployee"
                    value={groupedOptions
                        .flatMap(group => group.options)
                        .find(option => option.value === formData.coronerEmployee) || null}
                    onChange={(selectedOption, actionMeta) => handleSelectChange(selectedOption, actionMeta)}
                    options={groupedOptions}
                    isClearable
                    placeholder="Search or select ..."
                    className={`form-control ${!formData.coronerEmployee ? 'is-invalid' : ''}`}
                    classNamePrefix="react-select"
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

const GeneralConsult = ({
    formData,
    handleChange,
    setFormData,
    phmcRank,
    phmcGroupedOptions,
    setShowEmployeeModal,
    phmcEmployee,
    lab,
    bloodOxy,
    temperature,
    heartRate,
    breathing,
    bloodPressure,
    findings,
    lungs,
    pupils,
    wounds,
    ecg,
    sono,
    assignedDepartment,
    followup,
    admission,
    isUploading,
    handleImageUpload,
    handleSelectChange
}) => {
    return (
                            <> 
                                <p>If you require assistance with this form <a href="https://phmc.gta.world/viewforum.php?f=66" target="_blank" rel="noopener noreferrer">use this link! It should contain the information you require.  </a> If you still need help, use the PHMC Discord. </p>

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
                                <div style={{ display: 'flex', gap: '10px' }}>

                                <Form.Control
                                    type="text"
                                    name="patientChiefComplaint"
                                    value={formData.patientChiefComplaint}
                                    onChange={handleChange}
                                    placeholder="Patient Chief Complaint"
                                    required
                                    className={`form-control ${!formData.patientChiefComplaint ? 'is-invalid' : ''}`}
                                    />
                                                        <Form.Select
                                name="assignedDepartment"
                                value={formData.assignedDepartment}
                                onChange={handleChange}
                                required
                                className={`form-control ${!formData.assignedDepartment ? 'is-invalid' : ''}`}
                            >
                                <option value="" disabled>Assigned Department</option>
                                {assignedDepartment.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </Form.Select>

                                </div> 


                                <Form.Label>Vitals Section </Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Select
                                                name="temperature"
                                                value={formData.temperature}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.temperature ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Vitals</option>
                                                {temperature.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="heartRate"
                                                value={formData.heartRate}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.heartRate ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Heart Rate</option>
                                                {heartRate.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="breathing"
                                                value={formData.breathing}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.breathing ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Breathing</option>
                                                {breathing.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="bloodPressure"
                                                value={formData.bloodPressure}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.bloodPressure ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Blood Pressure</option>
                                                {bloodPressure.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                        <Form.Select
                                            name="bloodOxy"
                                            value={formData.bloodOxy}
                                            onChange={handleChange}
                                            required
                                            className={`form-control ${!formData.bloodOxy ? 'is-invalid' : ''}`}
                                        >
                                            <option value="" disabled>Blood Oxygen</option>
                                            {bloodOxy.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </Form.Select>
                                            
                                            </div>
                                            <Form.Label>Findings </Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Select
                                                name="findings"
                                                value={formData.findings}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.findings ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>General Health Conditions</option>
                                                {findings.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="lungs"
                                                value={formData.lungs}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.lungs ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Patient Lungs</option>
                                                {lungs.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="pupils"
                                                value={formData.pupils}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.pupils ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Patient Pupils</option>
                                                {pupils.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                            
                                            <Form.Select
                                                name="wounds"
                                                value={formData.wounds}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.wounds ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Patient Wounds</option>
                                                {wounds.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="ecg"
                                                value={formData.ecg}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.wounds ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>ECG Results</option>
                                                {ecg.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="sono"
                                                value={formData.sono}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.wounds ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Sonography Results</option>
                                                {sono.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            </div>

                                <Select
                                    isMulti
                                    name="lab"
                                    value={lab.filter(option =>
                                        (formData.lab || []).includes(option.value)
                                    )}
                                    onChange={(selectedOptions) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            lab: selectedOptions ? selectedOptions.map(option => option.value) : []
                                        }));
                                    }}
                                    options={lab}
                                    className="form-control"
                                    placeholder="Select lab results..."
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
                                /><Form.Label></Form.Label>
                            <Form.Label>Preliminary Diagnosis </Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>

                                <Form.Control
                                    as="textarea"
                                    name="patientDiagnosis"
                                    value={formData.patientDiagnosis}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Patient Diagnosis"
                                    required
                                    className={`form-control ${!formData.patientDiagnosis ? 'is-invalid' : ''}`}
                                />
                                <Form.Control
                                    as="textarea"
                                    name="patientSecondaryDiagnosis"
                                    value={formData.patientSecondaryDiagnosis}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Patient Secondary Diagnosis"
                                    required
                                    className={`form-control ${!formData.patientSecondaryDiagnosis ? 'is-invalid' : ''}`}
                                />
                                </div>
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
                                <Form.Label>Treatment Plan</Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control
                                    as="textarea"
                                    name="patientProcedure"
                                    value={formData.patientProcedure}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Treatment Plan Notes (verbal advice/further recommendations/additional notes)"
                                    required
                                    className={`form-control ${!formData.patientProcedure ? 'is-invalid' : ''}`}
                                />
                                </div> 

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
                        placeholder="You MUST upload an image of the prescription slip in this section for recordkeeping purposes. (If Applicable)"
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
            </Form.Group>

                                <Form.Select
                                name="followup"
                                value={formData.followup}
                                onChange={handleChange}
                                required
                                className={`form-control ${!formData.followup ? 'is-invalid' : ''}`}
                            >
                                <option value="" disabled>Follow Up?</option>
                                {followup.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </Form.Select>

                            </>
    );
};
          
export default GeneralConsult;