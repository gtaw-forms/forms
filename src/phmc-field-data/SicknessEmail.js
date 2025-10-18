import React, { useState, useEffect } from 'react'; // Import useState and useEffect
import { Form, InputGroup, Button } from 'react-bootstrap';
import Select from 'react-select';
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
                <Form.Label style={{ marginBottom: 0 }}>PHMC Employee Sending Email</Form.Label>
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
                    onChange={(selectedOption, actionMeta) => { // <--- MODIFIED onChange
                        handleSelectChange(selectedOption, actionMeta); 
                    }}
                    options={groupedOptions}
                    isClearable
                    placeholder={`Search or select ${employeeType}...`}
                    className={`form-control ${!formData[employeeNameField] ? 'is-invalid' : ''}`}
                    styles={{
                        control: (base) => ({
                            ...base,
                            backgroundColor: '#16202c',
                            color: '#eeeeeeb0',
                            borderColor: '#30363d',
                            '&:hover': { borderColor: '#30363d' }
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

const SicknessEmail = ({
    formData,
    handleChange,
    setFormData,
    phmcGroupedOptions,
    handleImageUpload,
    isUploading,
    onAttachReportSummaryRequest, 
    handleSelectChange,
    setShowEmployeeModal
}) => {
    // New state to track if consent has been confirmed
    const [consentConfirmed, setConsentConfirmed] = useState(false);

    return (
        <>
            <Form.Group className="mb-3">
                <Form.Label>Email Purpose</Form.Label>
                <Form.Select
                    name="emailPurpose"
                    value={formData.emailPurpose}
                    onChange={handleChange}
                    required
                    className={`form-control ${!formData.emailPurpose ? 'is-invalid' : ''}`}
                >
                    <option value="" disabled>Select Email Type</option>
                    <option value="Sickness Note">Sickness Note</option>
                    <option value="Illness Confirmation">Illness Confirmation</option>
                </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>Recipient Name</Form.Label>
                <Form.Control
                    type="text"
                    name="emailRecipient"
                    value={formData.emailRecipient}
                    onChange={handleChange}
                    placeholder="e.g., Employer, School, Individual"
                    required
                    className={`form-control ${!formData.emailRecipient ? 'is-invalid' : ''}`}
                />
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>Patient Name</Form.Label>
                <Form.Control
                    type="text"
                    name="patientName"
                    value={formData.patientName}
                    onChange={handleChange}
                    placeholder="Full Name of Patient"
                    required
                    className={`form-control ${!formData.patientName ? 'is-invalid' : ''}`}
                />
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>Date Patient Was Seen at PHMC</Form.Label>
                <Form.Control
                    type="date"
                    name="dateOfVisit"
                    value={formData.dateOfVisit}
                    onChange={handleChange}
                    required
                    className={`form-control ${!formData.dateOfVisit ? 'is-invalid' : ''}`}
                />
            </Form.Group>

            {formData.emailPurpose === 'Sickness Note' && (
                <>
                    <Form.Group className="mb-3">
                        <Form.Label>Sickness Start Date</Form.Label>
                        <Form.Control
                            type="date"
                            name="sicknessStartDate"
                            value={formData.sicknessStartDate}
                            onChange={handleChange}
                            required
                            className={`form-control ${!formData.sicknessStartDate ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Sickness End Date</Form.Label>
                        <Form.Control
                            type="date"
                            name="sicknessEndDate"
                            value={formData.sicknessEndDate}
                            onChange={handleChange}
                            required
                            className={`form-control ${!formData.sicknessEndDate ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Reason for Sickness (Brief)</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={2}
                            name="reasonForSickness"
                            value={formData.reasonForSickness}
                            onChange={handleChange}
                            placeholder="e.g., Influenza, common cold, minor injury"
                            required
                            className={`form-control ${!formData.reasonForSickness ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                </>
            )}

            {formData.emailPurpose === 'Illness Confirmation' && (
                <>
                    <Form.Group className="mb-3">
                        <Form.Label>Diagnosed Illness/Condition</Form.Label>
                        <Form.Control
                            type="text"
                            name="illnessCondition"
                            value={formData.illnessCondition}
                            onChange={handleChange}
                            placeholder="e.g., Strep Throat, Fractured Arm, Anxiety Disorder"
                            required
                            className={`form-control ${!formData.illnessCondition ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Purpose of Confirmation</Form.Label>
                        <Form.Control
                            type="text"
                            name="confirmationPurpose"
                            value={formData.confirmationPurpose}
                            onChange={handleChange}
                            placeholder="e.g., For employment records, school attendance, insurance claim"
                            required
                            className={`form-control ${!formData.confirmationPurpose ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                </>
            )}

            {/* NEW: Attach Report Summary Section with Consent Confirmation */}
            <Form.Group className="mb-3">
                <Form.Label>Attached Report Summary (from ER Protocol or Consultation Notes)</Form.Label>
                <InputGroup>
                    <Form.Control
                        as="textarea"
                        rows={6}
                        name="attachedReportSummary"
                        value={formData.attachedReportSummary || ''}
                        onChange={handleChange}
                        placeholder={
                            consentConfirmed
                                ? "BBCode summary of an attached report will appear here."
                                : "Click 'Confirm Consent' to enable attaching reports. YOU MUST GET PATIENT CONSENT BEFORE ATTACHING A REPORT SUMMARY!!! BIG HIPAA VIOLATION IF NO APPROVAL AND YOU INCLUDE IMPORTANT MEDICAL INFORMATION"
                        }
                        readOnly={!consentConfirmed} // Make textarea read-only until consent is confirmed
                    />
                    {!consentConfirmed ? (
                        <Button
                            variant="warning" // Use a warning color to draw attention
                            onClick={() => setConsentConfirmed(true)}
                        >
                            <i className="fas fa-check-circle"></i> Confirm Consent
                        </Button>
                    ) : (
                        <Button
                            variant="info"
                            onClick={() => onAttachReportSummaryRequest((reportData) => {
                                // This callback is executed when a report is selected in the modal
                                // reportData will contain bbCode, data, originalKey, etc.
                                setFormData(prev => ({
                                    ...prev,
                                    attachedReportSummary: reportData.bbCode // Populate with the full BBCode
                                }));
                            })}
                        >
                            <i className="fas fa-paperclip"></i> Attach Report
                        </Button>
                    )}
                </InputGroup>
                <span className="helper-text">
                    First, confirm you have patient consent. Then, click "Attach Report" to select a saved ER Protocol or Consultation Notes report. Its BBCode will be inserted here.
                </span>
            </Form.Group>

            <Form.Group className="mb-3">
                <EmployeeCredentialsSection 
                    formData={formData}
                    setFormData={setFormData}
                    groupedOptions={phmcGroupedOptions}
                    handleSelectChange={handleSelectChange}
                    setShowEmployeeModal={setShowEmployeeModal}
                    employeeType="phmc"
                />
            </Form.Group>

            <Form.Group className="mb-3 upload-container">
                <Form.Label>Employee Signature Image (Optional)</Form.Label>
                <InputGroup>
                    <Form.Control
                        as="textarea"
                        rows={2}
                        name="phmcEmployeeSignatureImage"
                        value={formData.phmcEmployeeSignatureImage || ''}
                        onChange={handleChange}
                        placeholder="Paste image URL or Upload"
                        className="form-control"
                        onPaste={(e) => {
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
                                    handleImageUpload({ target: { files: [file] } }, 'phmcEmployeeSignatureImage');
                                    e.preventDefault();
                                    break;
                                }
                            }
                            if (containsUrl && !hasImageItem) {
                                const currentValue = formData.phmcEmployeeSignatureImage || '';
                                const cursorPos = e.target.selectionStart;
                                const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                                const newValue = currentValue.slice(0, cursorPos) +
                                    (cursorPos > 0 ? separator : '') +
                                    pastedData +
                                    currentValue.slice(cursorPos);
                                setFormData(prev => ({ ...prev, phmcEmployeeSignatureImage: newValue }));
                                e.preventDefault();
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
                            input.multiple = false;
                            input.onchange = (e) => handleImageUpload(e, 'phmcEmployeeSignatureImage');
                            input.click();
                        }}
                    >
                        <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                        {isUploading ? ' Uploading...' : ' Upload Image'}
                    </Button>
                </InputGroup>
                <ImagePreview imageUrls={formData.phmcEmployeeSignatureImage} />
                <span className="helper-text">
                    Upload your signature image. Supports clipboard pasting (Ctrl+V). Hosted by ImgBB.
                </span>
            </Form.Group>
                        <Form.Control
            type="date"
            name="SubmitDate"
            value={formData.SubmitDate || new Date().toISOString().split('T')[0]}
            onChange={handleChange}
            readOnly 
            className="form-control" 
            />
            
        </>
    );
};

export default SicknessEmail;