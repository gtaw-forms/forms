// c:\Users\cross\Documents\GitHub\phmc-forms\src\phmc-civilian-fields\Ems.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Form, Button, InputGroup, Spinner } from 'react-bootstrap'; // Added InputGroup and Spinner

// Helper component for collapsible section headers
const CollapsibleHeader = ({ title, isOpen, onToggle, sectionId }) => (
    <Button
        variant="link"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`collapse-${sectionId}`}
        style={{
            fontWeight: 'bold',
            marginTop: '1rem',
            padding: '0.5rem 0',
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            textAlign: 'left',
            border: 'none',
            background: 'none'
        }}
    >
        {title}
        <i className={`fas ${isOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`} style={{ marginLeft: '10px' }}></i>
    </Button>
);

const LOCAL_STORAGE_KEY_EMS = 'emsApplicationFormData';
const EXPIRY_DURATION_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

const emsFormFields = [
    'recruitmentPosition', 'applicantTitleAndFullName', 'genderMale', 'genderFemale', 'genderOther',
    'applicantGenderOtherText', 'applicantDOBAndPlace', 'applicantAddress', 'applicantContactDetails',
    'applicantMedicalConditions', 'citizenUS', 'citizenPermanent', 'citizenNone',
    'eduHighSchool', 'eduCertificate', 'eduDiploma', 'eduAssociate', 'eduBachelor', 'eduMaster', 'eduDoctorate',
    'applicantSchoolName', 'applicantEnrollmentTerm', 'applicantMajor', 'applicantLanguages',
    'applicantPrevEmployment', 'applicantPrevDuties', 'applicantPrevDismissalReason', // For Paramedic/EMT
    'emsLicenseLink', 'emsPartTimeReason', // For OtherEMS
    'applicantMotivationLetter', // For Paramedic/EMT
    'oocUcpName', 'oocForumName', 'oocDiscord', 'oocTimezone',
    'oocMedicalExperience', // For Paramedic/EMT
    'oocAdminRecordLink', 'oocStatsLink', 'charBackground',
    'oocOtherCharLicenseProof', 'dfpSanFireLink', 'dfpPhmcLink', 'dfpLegalFactionLink' // For OtherEMS
];


const EMSFields = ({
    formData,
    handleChange,
    setFormData,
    selectOptions,
    handleImageUpload, // Added prop
    isUploading        // Added prop
}) => {
    const positionDetails = selectOptions?.emsPositionDetailsData || {};
    const selectedRole = formData.recruitmentPosition || '';

    const isParamedic = selectedRole === 'Paramedic';
    const isEMT = selectedRole === 'EMT';
    const isEMTTrainee = selectedRole === 'EMT Trainee';
    const isOtherEMS = selectedRole && !isParamedic && !isEMT && !isEMTTrainee;

    const [openSections, setOpenSections] = useState({
        personalInfo: true,
        educationalInfo: true,
        employmentInfo: true, 
        licensingInfo: true,  
        motivationalLetter: true, 
        oocInfo: true, 
    });

    // --- START localStorage Logic ---
    useEffect(() => {
        try {
            const savedDataString = localStorage.getItem(LOCAL_STORAGE_KEY_EMS);
            if (savedDataString) {
                const savedData = JSON.parse(savedDataString);
                if (savedData && savedData.data && savedData.timestamp) {
                    if (Date.now() - savedData.timestamp < EXPIRY_DURATION_MS) {
                        const relevantSavedData = {};
                        emsFormFields.forEach(field => {
                            if (savedData.data.hasOwnProperty(field)) {
                                relevantSavedData[field] = savedData.data[field];
                            }
                        });
                        setFormData(prev => ({ ...prev, ...relevantSavedData }));
                    } else {
                        localStorage.removeItem(LOCAL_STORAGE_KEY_EMS);
                    }
                }
            }
        } catch (error) {
            console.error("Error loading EMS form data from localStorage:", error);
            localStorage.removeItem(LOCAL_STORAGE_KEY_EMS);
        }
    }, [setFormData]);

    useEffect(() => {
        try {
            const dataToSave = {};
            emsFormFields.forEach(field => {
                if (formData.hasOwnProperty(field)) {
                    dataToSave[field] = formData[field];
                }
            });
            const emsDataWithTimestamp = {
                data: dataToSave,
                timestamp: Date.now()
            };
            localStorage.setItem(LOCAL_STORAGE_KEY_EMS, JSON.stringify(emsDataWithTimestamp));
        } catch (error) {
            console.error("Error saving EMS form data to localStorage:", error);
        }
    }, [formData]);
    // --- END localStorage Logic ---


    const toggleSection = (sectionName) => {
        setOpenSections(prev => ({ ...prev, [sectionName]: !prev[sectionName] }));
    };
    const oocFieldsConfig = {
        Paramedic: [
            { label: '5.1 User Control Panel (UCP) Username', name: 'oocUcpName', type: 'text' },
            { label: '5.2 GTA:W Forum Account Name', name: 'oocForumName', type: 'text' },
            { label: '5.3 Discord Name', name: 'oocDiscord', type: 'text', placeholder: "username#1234 or new username format" },
            { label: '5.4 Timezone', name: 'oocTimezone', type: 'text', placeholder: "e.g., UTC+0, EST, PST" },
            { label: '5.5 Do you have any real life medical experience or have you roleplayed in medical factions in the past?:', name: 'oocMedicalExperience', type: 'textarea', rows: 3, placeholder: "Describe in detail (or N/A)" },
            { label: '5.6 Unedited Screenshot of your Admin Record with the current date & time displayed:', name: 'oocAdminRecordLink', type: 'imageupload', placeholder: "Direct link to image (e.g., Imgur)" },
            { label: '5.7 Provide a screenshot of your character\'s statistics (/stats) which you\'re applying with:', name: 'oocStatsLink', type: 'imageupload', placeholder: "Direct link to image (e.g., Imgur)" },
            { label: '5.8 Provide your character\'s background story:', name: 'charBackground', type: 'textarea', rows: 5 }
        ],
        EMT: [
            { label: '5.1 User Control Panel (UCP) Username', name: 'oocUcpName', type: 'text' },
            { label: '5.2 Unedited Screenshot of your Admin Record:', name: 'oocAdminRecordLink', type: 'imageupload', placeholder: "Direct link to image (e.g., Imgur)" },
            { label: '5.3 GTA:W Forum Account Name', name: 'oocForumName', type: 'text' },
            { label: '5.4 Discord Name', name: 'oocDiscord', type: 'text', placeholder: "username#1234 or new username format" },
            { label: '5.5 Timezone', name: 'oocTimezone', type: 'text', placeholder: "e.g., UTC+0, EST, PST" },
            { label: '5.6 Do you have any real life medical experience or have you roleplayed in medical factions in the past?:', name: 'oocMedicalExperience', type: 'textarea', rows: 3, placeholder: "Describe in detail (or N/A)" },
            { label: '5.7 Provide a screenshot of your character\'s statistics (/stats) which you\'re applying with:', name: 'oocStatsLink', type: 'imageupload', placeholder: "Direct link to image (e.g., Imgur)" },
            { label: '5.8 Provide your character\'s background story:', name: 'charBackground', type: 'textarea', rows: 5 }
        ],
        'EMT Trainee': [ // Updated for EMT Trainee
            { label: '4.1 User Control Panel (UCP) Username', name: 'oocUcpName', type: 'text' },
            { label: '4.2 GTA:W Forum Account Name', name: 'oocForumName', type: 'text' },
            { label: '4.3 Discord Name', name: 'oocDiscord', type: 'text', placeholder: "username#1234 or new username format" },
            { label: '4.4 Timezone', name: 'oocTimezone', type: 'text', placeholder: "e.g., UTC+0, EST, PST" },
            { label: '4.5 Do you have any real life medical experience or have you roleplayed in medical factions in the past?:', name: 'oocMedicalExperience', type: 'textarea', rows: 3, placeholder: "Describe in detail (or N/A)" },
            { label: '4.6 Unedited Screenshot of your Admin Record with the current date & time displayed:', name: 'oocAdminRecordLink', type: 'imageupload', placeholder: "Direct link to image (e.g., Imgur)" },
            { label: '4.7 Provide a screenshot of your character\'s statistics (/stats) which you\'re applying with:', name: 'oocStatsLink', type: 'imageupload', placeholder: "Direct link to image (e.g., Imgur)" },
            { label: '4.8 If you are a part of another official faction, please post a link to your DFP request from both Pillbox Hill Medical Center and your current faction. If utilizing the same character, permissions from LFM must be acquired and provided as well:', name: 'oocOtherFactionDfpLfm', type: 'text', placeholder: "ANSWER/LINK(S)" },
            { label: '4.9 Provide your character\'s background story:', name: 'charBackground', type: 'textarea', rows: 5 }
        ]
    };

    return (
        <>
            {/* ... (Personal Information - Section 1, Educational Background - Section 2 remain the same) ... */}
             {/* --- 1. Personal Information (Common to all) --- */}
             <CollapsibleHeader
                title="1. Personal Information"
                isOpen={openSections.personalInfo}
                onToggle={() => toggleSection('personalInfo')}
                sectionId="ems-personal-info"
            />
            {openSections.personalInfo && (
                <div id="collapse-ems-personal-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>1.0 Position Applying For</Form.Label>
                        <Form.Select
                            name="recruitmentPosition"
                            value={formData.recruitmentPosition || ''}
                            onChange={handleChange}
                            required
                            className={`form-control ${!formData.recruitmentPosition ? 'is-invalid' : ''} mb-4`}
                        >
                            <option value="">Select an EMS Position...</option>
                            {Object.entries(positionDetails).map(([key, position]) => (
                                <option
                                    key={key}
                                    value={key}
                                    style={position.status === "CLOSED" ? { color: 'red', fontWeight: 'bold' } : {}}
                                    disabled={position.status === "CLOSED"}
                                >
                                    {position.displayName}{position.status === "CLOSED" ? " (Applications Closed)" : ""}
                                </option>
                            ))}
                        </Form.Select>
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.1 Title & Full Name</Form.Label>
                        <Form.Control
                            type="text"
                            name="applicantTitleAndFullName"
                            value={formData.applicantTitleAndFullName || ''}
                            onChange={handleChange}
                            placeholder="e.g., Mr. John Smith, Ms. Jane Doe"
                            required
                            className={`form-control ${!formData.applicantTitleAndFullName ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-1">
                        <Form.Label>1.2 Gender</Form.Label>
                        <div style={{ display: 'flex', gap: '1rem' }} className="mb-4">
                            <Form.Check
                                inline type="checkbox" label="Male" name="genderMale"
                                checked={formData.genderMale || false} onChange={handleChange}
                            />
                            <Form.Check
                                inline type="checkbox" label="Female" name="genderFemale"
                                checked={formData.genderFemale || false} onChange={handleChange}
                            />
                            <Form.Check
                                inline type="checkbox" label="Other" name="genderOther"
                                checked={formData.genderOther || false} onChange={handleChange}
                            />
                        </div>
                        {formData.genderOther && (
                            <Form.Control
                                type="text" name="applicantGenderOtherText" value={formData.applicantGenderOtherText || ''}
                                onChange={handleChange}
                                placeholder="Specify other gender"
                                className={`mt-2 form-control ${formData.genderOther && !formData.applicantGenderOtherText ? 'is-invalid' : ''} mb-4`}
                                required={formData.genderOther}
                            />
                        )}
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.3 Date & Place of Birth</Form.Label>
                        <Form.Control
                            type="text" name="applicantDOBAndPlace" value={formData.applicantDOBAndPlace || ''}
                            onChange={handleChange}
                            placeholder="DD/MMM/YYYY in CITY" required
                            className={`form-control ${!formData.applicantDOBAndPlace ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.4 Address</Form.Label>
                        <Form.Control
                            type="text" name="applicantAddress" value={formData.applicantAddress || ''}
                            onChange={handleChange}
                            placeholder="Your residential address" required
                            className={`form-control ${!formData.applicantAddress ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.5 Contact Details</Form.Label>
                        <Form.Control
                            type="text" name="applicantContactDetails" value={formData.applicantContactDetails || ''}
                            onChange={handleChange}
                            placeholder="Phone Number / Email" required
                            className={`form-control ${!formData.applicantContactDetails ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.6 Have you been diagnosed with a medical condition, allergies, or prescribed any medication?</Form.Label>
                        <Form.Control
                            as="textarea" rows={2} name="applicantMedicalConditions" value={formData.applicantMedicalConditions || ''}
                            onChange={handleChange}
                            placeholder="List any relevant medical information, or N/A" required
                            className={`form-control ${!formData.applicantMedicalConditions ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.7 Citizenship</Form.Label>
                        <div className="mb-4">
                            <Form.Check
                                inline type="checkbox" label="United States Citizen" name="citizenUS"
                                checked={formData.citizenUS || false} onChange={handleChange}
                            />
                            <Form.Check
                                inline type="checkbox" label="Permanent resident alien status and applied for U.S. Citizenship" name="citizenPermanent"
                                checked={formData.citizenPermanent || false} onChange={handleChange}
                            />
                            <Form.Check
                                inline type="checkbox" label="None of the above" name="citizenNone"
                                checked={formData.citizenNone || false} onChange={handleChange}
                            />
                        </div>
                    </Form.Group>
                </div>
            )}

            {/* --- 2. Educational Background (Common to all) --- */}
            <CollapsibleHeader
                title="2. Educational Background"
                isOpen={openSections.educationalInfo}
                onToggle={() => toggleSection('educationalInfo')}
                sectionId="ems-educational-info"
            />
            {openSections.educationalInfo && (
                <div id="collapse-ems-educational-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>2.1 Highest Level of Education</Form.Label>
                        <div className="mb-4">
                            <Form.Check inline type="checkbox" label="High School Diploma" name="eduHighSchool" checked={formData.eduHighSchool || false} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Certificate (Sub-bachelor or vocational)" name="eduCertificate" checked={formData.eduCertificate || false} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Diploma (Sub-bachelor or vocational)" name="eduDiploma" checked={formData.eduDiploma || false} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Associate Degree" name="eduAssociate" checked={formData.eduAssociate || false} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Bachelor's Degree" name="eduBachelor" checked={formData.eduBachelor || false} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Master's Degree" name="eduMaster" checked={formData.eduMaster || false} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Doctorate" name="eduDoctorate" checked={formData.eduDoctorate || false} onChange={handleChange} />
                        </div>
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>2.2.1 School Name</Form.Label>
                        <Form.Control type="text" name="applicantSchoolName" value={formData.applicantSchoolName || ''} onChange={handleChange} placeholder="Name of the institution" required className={`form-control ${!formData.applicantSchoolName ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>2.2.2 Enrollment Term</Form.Label>
                        <Form.Control type="text" name="applicantEnrollmentTerm" value={formData.applicantEnrollmentTerm || ''} onChange={handleChange} placeholder="DD/MMM/YYYY to DD/MMM/YYYY" required className={`form-control ${!formData.applicantEnrollmentTerm ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>2.2.3 Major Course of Study</Form.Label>
                        <Form.Control type="text" name="applicantMajor" value={formData.applicantMajor || ''} onChange={handleChange} placeholder="Your major or field of study" required className={`form-control ${!formData.applicantMajor ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>2.3 Additional Languages</Form.Label>
                        <Form.Control type="text" name="applicantLanguages" value={formData.applicantLanguages || ''} onChange={handleChange} placeholder="List any additional languages spoken (or N/A)" required className={`form-control ${!formData.applicantLanguages ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                </div>
            )}

            {/* Section 3: Employment History (Paramedic/EMT ONLY) */}
            {(isParamedic || isEMT) && ( // MODIFIED: Exclude EMT Trainee
                <>
                    <CollapsibleHeader
                        title="3. Employment History"
                        isOpen={openSections.employmentInfo}
                        onToggle={() => toggleSection('employmentInfo')}
                        sectionId="ems-employment-info"
                    />
                    {openSections.employmentInfo && (
                        <div id="collapse-ems-employment-info" style={{ paddingTop: '0.5rem' }}>
                            {/* ... Employment history fields ... */}
                            <Form.Group className="mb-3">
                                <Form.Label>3.1 Previous Employment</Form.Label>
                                <Form.Control type="text" name="applicantPrevEmployment" value={formData.applicantPrevEmployment || ''} onChange={handleChange} placeholder="ROLE at COMPANY between DD/MMM/YYYY to DD/MMM/YYYY (or N/A)" required className={`form-control ${!formData.applicantPrevEmployment ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>3.2 Duties</Form.Label>
                                <Form.Control as="textarea" rows={3} name="applicantPrevDuties" value={formData.applicantPrevDuties || ''} onChange={handleChange} placeholder="Describe your duties (or N/A)" required className={`form-control ${!formData.applicantPrevDuties ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>3.3 Reason for Dismissal (if applicable)</Form.Label>
                                <Form.Control as="textarea" rows={2} name="applicantPrevDismissalReason" value={formData.applicantPrevDismissalReason || ''} onChange={handleChange} placeholder="Reason for leaving previous employment (or N/A)" className="form-control mb-4" />
                            </Form.Group>
                        </div>
                    )}
                </>
            )}

            {/* Section 3: Licensing & Request Information (OtherEMS ONLY) */}
            {isOtherEMS && (
                <>
                    <CollapsibleHeader
                        title="3. Licensing & Request Information"
                        isOpen={openSections.licensingInfo}
                        onToggle={() => toggleSection('licensingInfo')}
                        sectionId="ems-licensing-info"
                    />
                    {openSections.licensingInfo && (
                        <div id="collapse-ems-licensing-info" style={{ paddingTop: '0.5rem' }}>
                            {/* ... Licensing fields ... */}
                            <Form.Group className="mb-3">
                                <Form.Label>3.1 Provide a copy of your Emergency Medical Technician license (( /licenses ))</Form.Label>
                                <InputGroup>
                                    <Form.Control
                                        type="text"
                                        name="emsLicenseLink"
                                        value={formData.emsLicenseLink || ''}
                                        onChange={handleChange}
                                        placeholder="Link to license screenshot"
                                        required
                                        className={`form-control ${!formData.emsLicenseLink ? 'is-invalid' : ''}`}
                                    />
                                    <Button
                                        variant="outline-secondary"
                                        onClick={() => document.getElementById('ems-licenseUpload').click()}
                                        disabled={isUploading}
                                    >
                                        {isUploading ? <Spinner as="span" animation="border" size="sm" /> : <i className="fas fa-upload"></i>}
                                    </Button>
                                </InputGroup>
                                <input
                                    type="file"
                                    id="ems-licenseUpload"
                                    style={{ display: 'none' }}
                                    accept="image/*"
                                    onChange={(e) => handleImageUpload(e, 'emsLicenseLink')}
                                />
                                <div className="mb-4"></div> {/* Spacer */}
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>3.2 Please write a short paragraph about why you believe you should be offered a slot with our part-time program:</Form.Label>
                                <Form.Control as="textarea" rows={4} name="emsPartTimeReason" value={formData.emsPartTimeReason || ''} onChange={handleChange} required className={`form-control ${!formData.emsPartTimeReason ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                        </div>
                    )}
                </>
            )}

            {/* Section 4: Motivational Letter (Paramedic/EMT ONLY) */}
            {(isParamedic || isEMT) && ( // MODIFIED: Exclude EMT Trainee
                <>
                    <CollapsibleHeader
                        title="4. Motivational Letter"
                        isOpen={openSections.motivationalLetter}
                        onToggle={() => toggleSection('motivationalLetter')}
                        sectionId="ems-motivational-letter"
                    />
                    {openSections.motivationalLetter && (
                        <div id="collapse-ems-motivational-letter" style={{ paddingTop: '0.5rem' }}>
                            <Form.Group className="mb-3">
                                <Form.Label>4.1 Motivational Letter</Form.Label>
                                <Form.Control
                                    as="textarea" rows={8} name="applicantMotivationLetter" value={formData.applicantMotivationLetter || ''}
                                    onChange={handleChange}
                                    placeholder="Describe why you wish to join us, why we should choose you rather than someone else, and why the qualities required from this job correspond to you."
                                    required className={`form-control ${!formData.applicantMotivationLetter ? 'is-invalid' : ''} mb-4`}
                                />
                            </Form.Group>
                        </div>
                    )}
                </>
            )}

            {/* OOC Section: Section 5 for Paramedic/EMT, Section 4 for EMT Trainee/OtherEMS */}
            {(isParamedic || isEMT || isEMTTrainee) && (
                <>
                    <CollapsibleHeader
                        title={isEMTTrainee ? "4. (( Out of Character information ))" : "5. (( Out of Character information ))"}
                        isOpen={openSections.oocInfo}
                        onToggle={() => toggleSection('oocInfo')}
                        sectionId="ems-ooc-info-main"
                    />
                    {openSections.oocInfo && (
                        <div id="collapse-ems-ooc-info-main" style={{ paddingTop: '0.5rem' }}>
                            {(oocFieldsConfig[selectedRole] || []).map(field => (
                                <Form.Group className="mb-3" key={`${selectedRole}-${field.name}`}>
                                    <Form.Label>{field.label}</Form.Label>
                                    {field.type === 'textarea' ? (
                                        <Form.Control
                                            as="textarea"
                                            rows={field.rows || 3}
                                            name={field.name}
                                            value={formData[field.name] || ''}
                                            onChange={handleChange}
                                            placeholder={field.placeholder || ''}
                                            required
                                            className={`form-control ${!formData[field.name] ? 'is-invalid' : ''} mb-4`}
                                        />
                                    ) : field.type === 'imageupload' ? (
                                        <>
                                            <InputGroup>
                                                <Form.Control
                                                    type="url"
                                                    name={field.name}
                                                    value={formData[field.name] || ''}
                                                    onChange={handleChange}
                                                    placeholder={field.placeholder || "Direct link to image (e.g., Imgur)"}
                                                    required
                                                    className={`form-control ${!formData[field.name] ? 'is-invalid' : ''}`}
                                                />
                                                <Button
                                                    variant="outline-secondary"
                                                    onClick={() => document.getElementById(`ems-ooc-${field.name}-upload`).click()}
                                                    disabled={isUploading}
                                                >
                                                    {isUploading ? <Spinner as="span" animation="border" size="sm" /> : <i className="fas fa-upload"></i>}
                                                </Button>
                                            </InputGroup>
                                            <input
                                                type="file"
                                                id={`ems-ooc-${field.name}-upload`}
                                                style={{ display: 'none' }}
                                                accept="image/*"
                                                onChange={(e) => handleImageUpload(e, field.name)}
                                            />
                                            <div className="mb-4"></div> {/* Spacer */}
                                        </>
                                    ) : ( // Default to text input
                                        <Form.Control
                                            type="text"
                                            name={field.name}
                                            value={formData[field.name] || ''}
                                            onChange={handleChange}
                                            placeholder={field.placeholder || ''}
                                            required
                                            className={`form-control ${!formData[field.name] ? 'is-invalid' : ''} mb-4`}
                                        />
                                    )}
                                </Form.Group>
                            ))}
                        </div>
                    )}
                </>
            )}

            {isOtherEMS && ( // OOC for Other EMS (Part-Time Program)
                 <>
                    <CollapsibleHeader
                        title="4. (( Out of Character information ))"
                        isOpen={openSections.oocInfo}
                        onToggle={() => toggleSection('oocInfo')}
                        sectionId="ems-ooc-info-other"
                    />
                    {openSections.oocInfo && (
                        <div id="collapse-ems-ooc-info-other" style={{ paddingTop: '0.5rem' }}>
                            {/* ... OOC fields for Other EMS ... */}
                            <Form.Group className="mb-3">
                                <Form.Label>4.1 User Control Panel (UCP) Username</Form.Label>
                                <Form.Control type="text" name="oocUcpName" value={formData.oocUcpName || ''} onChange={handleChange} required className={`form-control ${!formData.oocUcpName ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>4.2 GTA:W Forum Account Name</Form.Label>
                                <Form.Control type="text" name="oocForumName" value={formData.oocForumName || ''} onChange={handleChange} required className={`form-control ${!formData.oocForumName ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>4.3 Discord Name</Form.Label>
                                <Form.Control type="text" name="oocDiscord" value={formData.oocDiscord || ''} onChange={handleChange} placeholder="username#1234 or new username format" required className={`form-control ${!formData.oocDiscord ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>4.4 Timezone</Form.Label>
                                <Form.Control type="text" name="oocTimezone" value={formData.oocTimezone || ''} onChange={handleChange} placeholder="e.g., UTC+0, EST, PST" required className={`form-control ${!formData.oocTimezone ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>4.5 Do you have any real life medical experience or have you roleplayed in medical factions in the past?:</Form.Label>
                                <Form.Control as="textarea" rows={3} name="oocMedicalExperience" value={formData.oocMedicalExperience || ''} onChange={handleChange} placeholder="Describe in detail (or N/A)" required className={`form-control ${!formData.oocMedicalExperience ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>4.6 Unedited Screenshot of your Admin Record:</Form.Label>
                                <InputGroup>
                                    <Form.Control
                                        type="text"
                                        name="oocAdminRecordLink"
                                        value={formData.oocAdminRecordLink || ''}
                                        onChange={handleChange}
                                        placeholder="Direct link to image (e.g., Imgur)"
                                        required
                                        className={`form-control ${!formData.oocAdminRecordLink ? 'is-invalid' : ''}`}
                                    />
                                     <Button
                                        variant="outline-secondary"
                                        onClick={() => document.getElementById('ems-other-oocAdminRecordUpload').click()}
                                        disabled={isUploading}
                                    >
                                        {isUploading ? <Spinner as="span" animation="border" size="sm" /> : <i className="fas fa-upload"></i>}
                                    </Button>
                                </InputGroup>
                            <input
                                    type="file"
                                    id="ems-other-oocAdminRecordUpload"
                                    style={{ display: 'none' }}
                                    accept="image/*"
                                    onChange={(e) => handleImageUpload(e, 'oocAdminRecordLink')}
                                />
                                <div className="mb-4"></div> {/* Spacer */}
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>4.7 Provide a screenshot of your character's statistics (/stats) which you're applying with:</Form.Label>
                                <InputGroup>
                                    <Form.Control
                                        type="text"
                                        name="oocStatsLink"
                                        value={formData.oocStatsLink || ''}
                                        onChange={handleChange}
                                        placeholder="Direct link to image (e.g., Imgur)"
                                        required
                                        className={`form-control ${!formData.oocStatsLink ? 'is-invalid' : ''}`}
                                    />
                                    <Button
                                        variant="outline-secondary"
                                        onClick={() => document.getElementById('ems-other-oocStatsUpload').click()}
                                        disabled={isUploading}
                                    >
                                        {isUploading ? <Spinner as="span" animation="border" size="sm" /> : <i className="fas fa-upload"></i>}
                                    </Button>
                                </InputGroup>
                                <input
                                    type="file"
                                    id="ems-other-oocStatsUpload"
                                    style={{ display: 'none' }}
                                    accept="image/*"
                                    onChange={(e) => handleImageUpload(e, 'oocStatsLink')}
                                />
                                <div className="mb-4"></div> {/* Spacer */}
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>4.8 If you are a part of another official faction, please post a link to your DFP request from both Pillbox Hill Medical Center and your current faction. If utilizing the same character, permissions from LFM must be acquired and provided as well:</Form.Label>
                                <Form.Control type="text" name="oocOtherFactionDfpLfm" value={formData.oocOtherFactionDfpLfm || ''} onChange={handleChange} placeholder="ANSWER/LINK(S)" className="form-control mb-4" />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>4.9 Provide your character's background story:</Form.Label>
                                <Form.Control as="textarea" rows={5} name="charBackground" value={formData.charBackground || ''} onChange={handleChange} required className={`form-control ${!formData.charBackground ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                        </div>
                    )}
                </>
            )}
        </>
    );
};

export default EMSFields;
