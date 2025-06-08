import React, { useState } from 'react'; // Import useState
import { Form, Button, InputGroup } from 'react-bootstrap';

// Helper component for collapsible section headers
const CollapsibleHeader = ({ title, isOpen, onToggle, sectionId }) => (
    <Button
        variant="link"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`collapse-${sectionId}`}
        className="collapsible-header-button" // Add a class for styling
        style={{
            fontWeight: 'bold',
            marginTop: '1rem',
            padding: '0.5rem 0', // Adjust padding
            textDecoration: 'none',
            color: 'inherit', // Inherit text color
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            textAlign: 'left',
            border: 'none', // Remove button border
            background: 'none' // Remove button background
        }}
    >
        {title}
        <i className={`fas ${isOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`} style={{ marginLeft: '10px' }}></i>
    </Button>
);

const EntryJob = ({
    formData,
    handleChange,
    setFormData,
    isUploading,
    handleImageUpload,
    patientTitleOptions, // Use the original prop name here
}) => {
    // State for collapsible sections (default to open)
    const [isGeneralInfoOpen, setIsGeneralInfoOpen] = useState(true);
    const [isHealthInfoOpen, setIsHealthInfoOpen] = useState(true);
    const [isEducationalInfoOpen, setIsEducationalInfoOpen] = useState(true);
    const [isEmploymentInfoOpen, setIsEmploymentInfoOpen] = useState(true);
    const [isLicensesOpen, setIsLicensesOpen] = useState(true);
    const [isOocOpen, setIsOocOpen] = useState(true);
    const [isAcknowledgementOpen, setIsAcknowledgementOpen] = useState(true);

    // Filter out the "Master" option
    const filteredPatientTitleOptions = (patientTitleOptions || []).filter(
        option => option.value !== 'Mstr'
    );

    const handlePaste = (e, fieldName) => {
        const clipboardData = e.clipboardData || window.clipboardData;
        if (!clipboardData) return;
        const pastedData = clipboardData.getData('text');
        const items = clipboardData.items;
        let hasImageItem = false;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                hasImageItem = true;
                const file = items[i].getAsFile();
                if (file) {
                    const syntheticEvent = { target: { files: [file] } };
                    handleImageUpload(syntheticEvent, fieldName);
                }
                e.preventDefault();
                return;
            }
        }
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        if (urlRegex.test(pastedData) && !hasImageItem) {
            const currentValue = formData[fieldName] || '';
            const cursorPos = e.target.selectionStart;
            const textToInsert = (currentValue && currentValue.trim().length > 0 && cursorPos > 0) ? `, ${pastedData}` : pastedData;
            const newValue = currentValue.slice(0, cursorPos) + textToInsert + currentValue.slice(cursorPos);
            setFormData(prev => ({ ...prev, [fieldName]: newValue }));
            e.preventDefault();
        }
    };

    return (
        <>
            {/* --- 1. GENERAL INFORMATION --- */}
            <CollapsibleHeader
                title="1. GENERAL INFORMATION"
                isOpen={isGeneralInfoOpen}
                onToggle={() => setIsGeneralInfoOpen(!isGeneralInfoOpen)}
                sectionId="general-info"
            />
            {isGeneralInfoOpen && (
                <div id="collapse-general-info">
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '0.5rem', marginTop: '0.5rem' }}>
                        <Form.Select
                            name="patientTitle"
                            value={formData.patientTitle || ''}
                            onChange={handleChange}
                            required
                            className={`form-control ${!formData.patientTitle ? 'is-invalid' : ''}`}
                        >
                            <option value="" disabled>Title</option>
                            {/* Use the filtered options */}
                            {filteredPatientTitleOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                        <Form.Control
                            type="text"
                            name="patientFirstName"
                            value={formData.patientFirstName || ''}
                            onChange={handleChange}
                            placeholder="First Name"
                            required
                            className={`form-control ${!formData.patientFirstName ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="patientLastName"
                            value={formData.patientLastName || ''}
                            onChange={handleChange}
                            placeholder="Last Name"
                            required
                            className={`form-control ${!formData.patientLastName ? 'is-invalid' : ''}`}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
                        <Form.Control
                            type="text"
                            name="patientContactNumber"
                            value={formData.patientContactNumber || ''}
                            onChange={handleChange}
                            placeholder="Contact Number"
                            required
                            className={`form-control ${!formData.patientContactNumber ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="date"
                            name="patientDOB"
                            value={formData.patientDOB || ''}
                            onChange={handleChange}
                            placeholder="Date of Birth"
                            required
                            className={`form-control ${!formData.patientDOB ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="patientBirth"
                            value={formData.patientBirth || ''}
                            onChange={handleChange}
                            placeholder="Place of Birth"
                            required
                            className={`form-control ${!formData.patientBirth ? 'is-invalid' : ''}`}
                        />
                    </div>
                </div>
            )}

            {/* --- 2. HEALTH INFORMATION --- */}
            <CollapsibleHeader
                title="2. HEALTH INFORMATION"
                isOpen={isHealthInfoOpen}
                onToggle={() => setIsHealthInfoOpen(!isHealthInfoOpen)}
                sectionId="health-info"
            />
            {isHealthInfoOpen && (
                <div id="collapse-health-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>Do you have, or have you ever been diagnosed with any visual or hearing impairment(s), cardiovascular issue(s), color blindness or speech disorder(s)?</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={2}
                            name="healthImpairments"
                            value={formData.healthImpairments || ''}
                            onChange={handleChange}
                            placeholder="Answer"
                            required
                            className={`form-control ${!formData.healthImpairments ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Do you have, or have you ever been diagnosed with any health issues that may impede your ability to stand for long periods of time?</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={2}
                            name="healthStandingIssues"
                            value={formData.healthStandingIssues || ''}
                            onChange={handleChange}
                            placeholder="Answer"
                            required
                            className={`form-control ${!formData.healthStandingIssues ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                </div>
            )}

            {/* --- 3. EDUCATIONAL INFORMATION --- */}
            <CollapsibleHeader
                title="3. EDUCATIONAL INFORMATION"
                isOpen={isEducationalInfoOpen}
                onToggle={() => setIsEducationalInfoOpen(!isEducationalInfoOpen)}
                sectionId="edu-info"
            />
            {isEducationalInfoOpen && (
                <div id="collapse-edu-info" style={{ paddingTop: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '0.5rem' }}>
                        <Form.Control
                            type="text"
                            name="eduHighSchoolName"
                            value={formData.eduHighSchoolName || ''}
                            onChange={handleChange}
                            placeholder="High School - Name"
                            required
                            className={`form-control ${!formData.eduHighSchoolName ? 'is-invalid' : ''}`}
                        />
                        <Form.Control
                            type="text"
                            name="eduHighSchoolYear"
                            value={formData.eduHighSchoolYear || ''}
                            onChange={handleChange}
                            placeholder="High School - Year of Graduation"
                            required
                            className={`form-control ${!formData.eduHighSchoolYear ? 'is-invalid' : ''}`}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
                        <Form.Control
                            type="text"
                            name="eduCollegeName"
                            value={formData.eduCollegeName || ''}
                            onChange={handleChange}
                            placeholder="College/University - Name (or N/A)"
                            className="form-control"
                        />
                        <Form.Control
                            type="text"
                            name="eduCollegeYear"
                            value={formData.eduCollegeYear || ''}
                            onChange={handleChange}
                            placeholder="College/University - Year (or N/A)"
                            className="form-control"
                        />
                        <Form.Control
                            type="text"
                            name="eduCollegeDegree"
                            value={formData.eduCollegeDegree || ''}
                            onChange={handleChange}
                            placeholder="College/University - Qualification (or N/A)"
                            className="form-control"
                        />
                    </div>
                </div>
            )}

            {/* --- 4. EMPLOYMENT INFORMATION --- */}
            <CollapsibleHeader
                title="4. EMPLOYMENT INFORMATION"
                isOpen={isEmploymentInfoOpen}
                onToggle={() => setIsEmploymentInfoOpen(!isEmploymentInfoOpen)}
                sectionId="emp-info"
            />
            {isEmploymentInfoOpen && (
                <div id="collapse-emp-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>Have you ever worked for any Government Agency before?</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={2}
                            name="empGovExperience"
                            value={formData.empGovExperience || ''}
                            onChange={handleChange}
                            placeholder="Answer (If yes, please specify)"
                            required
                            className={`form-control ${!formData.empGovExperience ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                    <Form.Label>Previous Employers (List up to two, or N/A if none):</Form.Label>
                    <div className="mb-3 p-2 border rounded">
                        <Form.Label>Previous Employer 1:</Form.Label>
                        <Form.Control type="text" name="empPrev1Name" value={formData.empPrev1Name || ''} onChange={handleChange} placeholder="Employer Name (or N/A)" className="mb-2 form-control" />
                        <Form.Control type="text" name="empPrev1Period" value={formData.empPrev1Period || ''} onChange={handleChange} placeholder="Period of Employment (DD/MM/YY - DD/MM/YY or N/A)" className="mb-2 form-control" />
                        <Form.Control type="text" name="empPrev1Rank" value={formData.empPrev1Rank || ''} onChange={handleChange} placeholder="Rank or Position (or N/A)" className="mb-2 form-control" />
                        <Form.Control as="textarea" rows={2} name="empPrev1Reason" value={formData.empPrev1Reason || ''} onChange={handleChange} placeholder="Reason for leaving (or N/A)" className="form-control" />
                    </div>
                    <div className="mb-3 p-2 border rounded">
                        <Form.Label>Previous Employer 2:</Form.Label>
                        <Form.Control type="text" name="empPrev2Name" value={formData.empPrev2Name || ''} onChange={handleChange} placeholder="Employer Name (or N/A)" className="mb-2 form-control" />
                        <Form.Control type="text" name="empPrev2Period" value={formData.empPrev2Period || ''} onChange={handleChange} placeholder="Period of Employment (DD/MM/YY - DD/MM/YY or N/A)" className="mb-2 form-control" />
                        <Form.Control type="text" name="empPrev2Rank" value={formData.empPrev2Rank || ''} onChange={handleChange} placeholder="Rank or Position (or N/A)" className="mb-2 form-control" />
                        <Form.Control as="textarea" rows={2} name="empPrev2Reason" value={formData.empPrev2Reason || ''} onChange={handleChange} placeholder="Reason for leaving (or N/A)" className="form-control" />
                    </div>
                </div>
            )}

            {/* --- 5. LICENSES, PERMITS & CITIZENSHIP --- */}
            <CollapsibleHeader
                title="5. LICENSES, PERMITS & CITIZENSHIP"
                isOpen={isLicensesOpen}
                onToggle={() => setIsLicensesOpen(!isLicensesOpen)}
                sectionId="licenses-info"
            />
            {isLicensesOpen && (
                <div id="collapse-licenses-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>Do you possess a valid United States of America citizenship?</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={1}
                            name="licCitizenship"
                            value={formData.licCitizenship || ''}
                            onChange={handleChange}
                            placeholder="Answer (Yes/No)"
                            required
                            className={`form-control ${!formData.licCitizenship ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Do you possess a valid Pilot License? (A pilot license is not required to apply, except for the position of Flight Instructor / Safety Investigator)</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={1}
                            name="licPilotLicense"
                            value={formData.licPilotLicense || ''}
                            onChange={handleChange}
                            placeholder="Answer (Yes/No, if yes, specify type if applicable)"
                            required
                            className={`form-control ${!formData.licPilotLicense ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                </div>
            )}

            {/* --- 6. (( OUT OF CHARACTER )) --- */}
            <CollapsibleHeader
                title="6. (( OUT OF CHARACTER ))"
                isOpen={isOocOpen}
                onToggle={() => setIsOocOpen(!isOocOpen)}
                sectionId="ooc-info"
            />
            {isOocOpen && (
                <div id="collapse-ooc-info" style={{ paddingTop: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '0.5rem' }}>
                        <Form.Control type="text" name="oocUcpName" value={formData.oocUcpName || ''} onChange={handleChange} placeholder="UCP Name" required className={`form-control ${!formData.oocUcpName ? 'is-invalid' : ''}`} />
                        <Form.Control type="text" name="oocDiscord" value={formData.oocDiscord || ''} onChange={handleChange} placeholder="Discord" required className={`form-control ${!formData.oocDiscord ? 'is-invalid' : ''}`} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
                        <Form.Control type="text" name="oocForumName" value={formData.oocForumName || ''} onChange={handleChange} placeholder="Forum Name" required className={`form-control ${!formData.oocForumName ? 'is-invalid' : ''}`} />
                        <Form.Control type="text" name="oocTimezone" value={formData.oocTimezone || ''} onChange={handleChange} placeholder="Timezone (e.g., UTC-5)" required className={`form-control ${!formData.oocTimezone ? 'is-invalid' : ''}`} />
                    </div>
                    <Form.Group className="mb-3">
                        <Form.Label>How long have you been playing on GTA World?</Form.Label>
                        <Form.Control type="text" name="oocGtawPlaytime" value={formData.oocGtawPlaytime || ''} onChange={handleChange} placeholder="Answer" required className={`form-control ${!formData.oocGtawPlaytime ? 'is-invalid' : ''}`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Are you able to communicate effectively in English?</Form.Label>
                        <Form.Control type="text" name="oocEnglishProficiency" value={formData.oocEnglishProficiency || ''} onChange={handleChange} placeholder="Answer (Yes/No)" required className={`form-control ${!formData.oocEnglishProficiency ? 'is-invalid' : ''}`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Are you currently a member of any other official faction on any of your characters? If yes, post a screenshot of the double faction permission in your answer below.</Form.Label>
                        <Form.Control as="textarea" rows={3} name="oocOtherFactionInfo" value={formData.oocOtherFactionInfo || ''} onChange={handleChange} placeholder="Answer (Include link to permission screenshot if applicable)" required className={`form-control ${!formData.oocOtherFactionInfo ? 'is-invalid' : ''}`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Are you currently banned from any faction? If yes, please elaborate.</Form.Label>
                        <Form.Control as="textarea" rows={2} name="oocFactionBans" value={formData.oocFactionBans || ''} onChange={handleChange} placeholder="Answer" required className={`form-control ${!formData.oocFactionBans ? 'is-invalid' : ''}`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Please list all of your characters below, excluding the one you are applying with:</Form.Label>
                        <Form.Control as="textarea" rows={3} name="oocOtherCharacters" value={formData.oocOtherCharacters || ''} onChange={handleChange} placeholder="Character Name (UCP) - Faction (if any)" required className={`form-control ${!formData.oocOtherCharacters ? 'is-invalid' : ''}`} />
                    </Form.Group>
                    <Form.Group className="mb-3 upload-container">
                        <Form.Label>Admin Record Screenshot</Form.Label>
                        <InputGroup>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                name="adminRecordLink"
                                value={formData.adminRecordLink || ''}
                                onChange={handleChange}
                                placeholder="Paste Imgur URL or use Upload button"
                                className={`form-control ${!formData.adminRecordLink ? 'is-invalid' : ''}`}
                                onPaste={(e) => handlePaste(e, 'adminRecordLink')}
                                required
                            />
                            <Button
                                variant="success"
                                disabled={isUploading}
                                onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.multiple = false;
                                    input.onchange = (e) => handleImageUpload(e, 'adminRecordLink');
                                    input.click();
                                }}
                            >
                                <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                                {isUploading ? 'Uploading...' : 'Upload Admin Record'}
                            </Button>
                        </InputGroup>
                        <span className="helper-text">Post a clear, unedited screenshot of your admin record. Supports clipboard pasting (Ctrl+V).</span>
                    </Form.Group>
                    <Form.Group className="mb-3 upload-container">
                        <Form.Label>In-Game Stats Screenshot</Form.Label>
                        <InputGroup>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                name="inGameStatsLink"
                                value={formData.inGameStatsLink || ''}
                                onChange={handleChange}
                                placeholder="Paste Imgur URL or use Upload button"
                                className={`form-control ${!formData.inGameStatsLink ? 'is-invalid' : ''}`}
                                onPaste={(e) => handlePaste(e, 'inGameStatsLink')}
                                required
                            />
                            <Button
                                variant="success"
                                disabled={isUploading}
                                onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.multiple = false;
                                    input.onchange = (e) => handleImageUpload(e, 'inGameStatsLink');
                                    input.click();
                                }}
                            >
                                <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                                {isUploading ? 'Uploading...' : 'Upload Stats'}
                            </Button>
                        </InputGroup>
                        <span className="helper-text">Post a clear, unedited screenshot of your in-game stats. Supports clipboard pasting (Ctrl+V).</span>
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Write a brief background of your character:</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={5}
                            name="charBackground"
                            value={formData.charBackground || ''}
                            onChange={handleChange}
                            placeholder="Character Background"
                            required
                            className={`form-control ${!formData.charBackground ? 'is-invalid' : ''}`}
                        />
                    </Form.Group>
                </div>
            )}

            {/* --- 7. ACKNOWLEDGEMENT & AUTHORIZATION --- */}
            <CollapsibleHeader
                title="7. ACKNOWLEDGEMENT & AUTHORIZATION"
                isOpen={isAcknowledgementOpen}
                onToggle={() => setIsAcknowledgementOpen(!isAcknowledgementOpen)}
                sectionId="ack-info"
            />
            {isAcknowledgementOpen && (
                <div id="collapse-ack-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Check
                            type="checkbox"
                            name="ackAuthorize"
                            id="ackAuthorizeCheckbox"
                            checked={formData.ackAuthorize || false}
                            onChange={handleChange}
                            required
                            label={
                                `By submitting this application, I, ${formData.patientFirstName || '[First Name]'} ${formData.patientLastName || '[Last Name]'}, hereby certify that all questions contained in this document were met with truthful statements. I fully authorize the investigation of any content shared on this document. I am aware that lying, omitting, plagiarizing, or maliciously adulterating this application will result in immediate denial and an indefinite ban from applying for future job vacancies.`
                            }
                            className={`${!formData.ackAuthorize ? 'is-invalid' : ''}`}
                        />
                        {!formData.ackAuthorize && <div className="invalid-feedback d-block">You must acknowledge and authorize to submit.</div>}
                    </Form.Group>
                </div>
            )}
        </>
    );
};

export default EntryJob;
