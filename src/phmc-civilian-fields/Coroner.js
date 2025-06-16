// src/phmc-civilian-fields/Coroner.js
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

const LOCAL_STORAGE_KEY_CORONER = 'coronerApplicationFormData';
const EXPIRY_DURATION_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

const coronerFormFields = [
    'recruitmentPosition', 'applicantTitleAndFullName', 'genderMale', 'genderFemale', 'genderOther',
    'applicantGenderOtherText', 'applicantDOBAndPlace', 'applicantAddress', 'applicantContactDetails',
    'applicantMedicalConditions', 'citizenUS', 'citizenPermanent', 'citizenNone',
    'eduHighSchool', 'eduCertificate', 'eduDiploma', 'eduAssociate', 'eduBachelor', 'eduMaster', 'eduDoctorate',
    'applicantSchoolName', 'applicantEnrollmentTerm', 'applicantMajor', 'applicantLanguages',
    'applicantPrevEmployment', 'applicantPrevDuties', 'applicantPrevDismissalReason',
    'applicantMotivationLetter', 'oocUcpName', 'oocForumName', 'oocDiscord', 'oocTimezone',
    'oocMedicalExperience', 'oocAdminRecordLink', 'oocStatsLink', 'charBackground'
];


const CoronerFields = ({
    formData,
    handleChange,
    setFormData, 
    selectOptions,
    handleImageUpload, // Added prop
    isUploading        // Added prop
}) => {
    const positionDetails = selectOptions?.coronerPositionDetailsData || {};
    const [isOocInfoOpen, setIsOocInfoOpen] = useState(true);

    const [openSections, setOpenSections] = useState({
        personalInfo: true,
        educationalInfo: true,
        employmentInfo: true,
        motivationalLetter: true,
        oocInfo: true,
    });

    const prevCompletionStatusOnBlurRef = useRef({});

     useEffect(() => {
        const sections = Object.keys(openSections);
        sections.forEach(sectionId => {
            if (prevCompletionStatusOnBlurRef.current[sectionId] === undefined) {
                prevCompletionStatusOnBlurRef.current[sectionId] = false;
            }
        });
    }, [openSections]); 

    useEffect(() => {
        try {
            const savedDataString = localStorage.getItem(LOCAL_STORAGE_KEY_CORONER);
            if (savedDataString) {
                const savedData = JSON.parse(savedDataString);
                if (savedData && savedData.data && savedData.timestamp) {
                    if (Date.now() - savedData.timestamp < EXPIRY_DURATION_MS) {
                        const relevantSavedData = {};
                        coronerFormFields.forEach(field => {
                            if (savedData.data.hasOwnProperty(field)) {
                                relevantSavedData[field] = savedData.data[field];
                            }
                        });
                        setFormData(prev => ({ ...prev, ...relevantSavedData }));
                    } else {
                        localStorage.removeItem(LOCAL_STORAGE_KEY_CORONER);
                    }
                }
            }
        } catch (error) {
            console.error("Error loading coroner form data from localStorage:", error);
            localStorage.removeItem(LOCAL_STORAGE_KEY_CORONER);
        }
    }, [setFormData]);

    useEffect(() => {
        try {
            const dataToSave = {};
            coronerFormFields.forEach(field => {
                if (formData.hasOwnProperty(field)) {
                    dataToSave[field] = formData[field];
                }
            });
            const coronerDataWithTimestamp = {
                data: dataToSave,
                timestamp: Date.now()
            };
            localStorage.setItem(LOCAL_STORAGE_KEY_CORONER, JSON.stringify(coronerDataWithTimestamp));
        } catch (error) {
            console.error("Error saving coroner form data to localStorage:", error);
        }
    }, [formData]);

    const checkFieldsCompletion = useCallback((fieldsToCheck) => {
        for (const field of fieldsToCheck) {
            if (typeof field === 'string') {
                const value = formData[field];
                if (typeof value === 'string' && !value.trim()) return false;
                if (typeof value === 'boolean' && !value) return false; 
                if (value === undefined || value === null) return false;
            } else if (typeof field === 'object' && field.anyOf) { 
                if (!field.anyOf.some(subField => formData[subField])) return false;
            } else if (typeof field === 'object' && field.conditional) { 
                if (formData[field.conditional.if.field] === field.conditional.if.value) {
                    const conditionalValue = formData[field.conditional.then.field];
                    if (typeof conditionalValue === 'string' && !conditionalValue.trim()) return false;
                    if (conditionalValue === undefined || conditionalValue === null) return false;
                }
            }
        }
        return true;
    }, [formData]);

    const sectionRequiredFields = {
        personalInfo: [
            'recruitmentPosition', 'applicantTitleAndFullName',
            { anyOf: ['genderMale', 'genderFemale', 'genderOther'] },
            { conditional: { if: { field: 'genderOther', value: true }, then: { field: 'applicantGenderOtherText' } } },
            'applicantDOBAndPlace', 'applicantAddress', 'applicantContactDetails', 'applicantMedicalConditions',
            { anyOf: ['citizenUS', 'citizenPermanent', 'citizenNone'] }
        ],
        educationalInfo: [
            { anyOf: ['eduHighSchool', 'eduCertificate', 'eduDiploma', 'eduAssociate', 'eduBachelor', 'eduMaster', 'eduDoctorate'] },
            'applicantSchoolName', 'applicantEnrollmentTerm', 'applicantMajor', 'applicantLanguages'
        ],
        employmentInfo: [
            'applicantPrevEmployment', 'applicantPrevDuties', 
        ],
        motivationalLetter: ['applicantMotivationLetter'],
        oocInfo: [
            'oocUcpName', 'oocForumName', 'oocDiscord', 'oocTimezone',
            'oocMedicalExperience', 'oocAdminRecordLink', 'oocStatsLink', 'charBackground'
        ]
    };

    const handleSectionFieldBlur = useCallback((sectionId, isOpenState, setIsOpenFunction, requiredFieldsKey) => {
        const isNowComplete = checkFieldsCompletion(sectionRequiredFields[requiredFieldsKey]);
        const wasCompleteAtLastBlur = prevCompletionStatusOnBlurRef.current[sectionId] === true;

        if (isOpenState && isNowComplete && !wasCompleteAtLastBlur) {
            setIsOpenFunction(false); 
        }
        prevCompletionStatusOnBlurRef.current[sectionId] = isNowComplete; 
    }, [checkFieldsCompletion, sectionRequiredFields]);


    const toggleSection = (sectionName) => {
        setOpenSections(prev => ({ ...prev, [sectionName]: !prev[sectionName] }));
    };

    return (
        <>
            {/* --- 1. Personal Information --- */}
            <CollapsibleHeader
                title="1. Personal Information"
                isOpen={openSections.personalInfo}
                onToggle={() => toggleSection('personalInfo')}
                sectionId="coroner-personal-info"
            />
            {openSections.personalInfo && (
                <div id="collapse-coroner-personal-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>1.0 Position Applying For</Form.Label>
                        <Form.Select
                            name="recruitmentPosition"
                            value={formData.recruitmentPosition || ''}
                            onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('personalInfo', openSections.personalInfo, (val) => setOpenSections(p => ({...p, personalInfo: val})), 'personalInfo')}
                            required
                            className={`form-control ${!formData.recruitmentPosition ? 'is-invalid' : ''} mb-4`}
                        >
                            <option value="">Select a Coroner Position...</option>
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
                            onBlur={() => handleSectionFieldBlur('personalInfo', openSections.personalInfo, (val) => setOpenSections(p => ({...p, personalInfo: val})), 'personalInfo')}
                            placeholder="e.g., Dr. John Smith, Ms. Jane Doe"
                            required
                            className={`form-control ${!formData.applicantTitleAndFullName ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-1">
                        <Form.Label>1.2 Gender</Form.Label>
                        <div
                            style={{ display: 'flex', gap: '1rem' }}
                            className="mb-4"
                            onBlur={() => handleSectionFieldBlur('personalInfo', openSections.personalInfo, (val) => setOpenSections(p => ({...p, personalInfo: val})), 'personalInfo')}
                        >
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
                                onBlur={() => handleSectionFieldBlur('personalInfo', openSections.personalInfo, (val) => setOpenSections(p => ({...p, personalInfo: val})), 'personalInfo')}
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
                            onBlur={() => handleSectionFieldBlur('personalInfo', openSections.personalInfo, (val) => setOpenSections(p => ({...p, personalInfo: val})), 'personalInfo')}
                            placeholder="DD/MMM/YYYY in CITY" required
                            className={`form-control ${!formData.applicantDOBAndPlace ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.4 Address</Form.Label>
                        <Form.Control
                            type="text" name="applicantAddress" value={formData.applicantAddress || ''}
                            onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('personalInfo', openSections.personalInfo, (val) => setOpenSections(p => ({...p, personalInfo: val})), 'personalInfo')}
                            placeholder="Your residential address" required
                            className={`form-control ${!formData.applicantAddress ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.5 Contact Details</Form.Label>
                        <Form.Control
                            type="text" name="applicantContactDetails" value={formData.applicantContactDetails || ''}
                            onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('personalInfo', openSections.personalInfo, (val) => setOpenSections(p => ({...p, personalInfo: val})), 'personalInfo')}
                            placeholder="Phone Number / Email" required
                            className={`form-control ${!formData.applicantContactDetails ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.6 Do you have a diagnosed medical condition?:</Form.Label>
                        <Form.Control
                            as="textarea" rows={2} name="applicantMedicalConditions" value={formData.applicantMedicalConditions || ''}
                            onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('personalInfo', openSections.personalInfo, (val) => setOpenSections(p => ({...p, personalInfo: val})), 'personalInfo')}
                            placeholder="List any relevant medical information, or N/A" required
                            className={`form-control ${!formData.applicantMedicalConditions ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.7 Citizenship</Form.Label>
                        <div
                            className="mb-4"
                            onBlur={() => handleSectionFieldBlur('personalInfo', openSections.personalInfo, (val) => setOpenSections(p => ({...p, personalInfo: val})), 'personalInfo')}
                        >
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

            {/* --- 2. Educational Background --- */}
            <CollapsibleHeader
                title="2. Educational Background"
                isOpen={openSections.educationalInfo}
                onToggle={() => toggleSection('educationalInfo')}
                sectionId="coroner-educational-info"
            />
            {openSections.educationalInfo && (
                <div id="collapse-coroner-educational-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>2.1 Highest Level of Education</Form.Label>
                        <div
                            className="mb-4"
                            onBlur={() => handleSectionFieldBlur('educationalInfo', openSections.educationalInfo, (val) => setOpenSections(p => ({...p, educationalInfo: val})), 'educationalInfo')}
                        >
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
                        <Form.Control type="text" name="applicantSchoolName" value={formData.applicantSchoolName || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('educationalInfo', openSections.educationalInfo, (val) => setOpenSections(p => ({...p, educationalInfo: val})), 'educationalInfo')} placeholder="Name of the institution" required className={`form-control ${!formData.applicantSchoolName ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>2.2.2 Enrollment Term</Form.Label>
                        <Form.Control type="text" name="applicantEnrollmentTerm" value={formData.applicantEnrollmentTerm || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('educationalInfo', openSections.educationalInfo, (val) => setOpenSections(p => ({...p, educationalInfo: val})), 'educationalInfo')} placeholder="DD/MMM/YYYY to DD/MMM/YYYY" required className={`form-control ${!formData.applicantEnrollmentTerm ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>2.2.3 Major Course of Study</Form.Label>
                        <Form.Control type="text" name="applicantMajor" value={formData.applicantMajor || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('educationalInfo', openSections.educationalInfo, (val) => setOpenSections(p => ({...p, educationalInfo: val})), 'educationalInfo')} placeholder="e.g., Forensic Science, Biology" required className={`form-control ${!formData.applicantMajor ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>2.3 Additional Languages</Form.Label>
                        <Form.Control type="text" name="applicantLanguages" value={formData.applicantLanguages || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('educationalInfo', openSections.educationalInfo, (val) => setOpenSections(p => ({...p, educationalInfo: val})), 'educationalInfo')} placeholder="List any additional languages spoken (or N/A)" required className={`form-control ${!formData.applicantLanguages ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                </div>
            )}

            {/* --- 3. Employment History --- */}
            <CollapsibleHeader
                title="3. Employment History"
                isOpen={openSections.employmentInfo}
                onToggle={() => toggleSection('employmentInfo')}
                sectionId="coroner-employment-info"
            />
            {openSections.employmentInfo && (
                <div id="collapse-coroner-employment-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>3.1 Previous Employment</Form.Label>
                        <Form.Control type="text" name="applicantPrevEmployment" value={formData.applicantPrevEmployment || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('employmentInfo', openSections.employmentInfo, (val) => setOpenSections(p => ({...p, employmentInfo: val})), 'employmentInfo')} placeholder="ROLE at COMPANY between DD/MMM/YYYY to DD/MMM/YYYY (or N/A)" required className={`form-control ${!formData.applicantPrevEmployment ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>3.2 Duties</Form.Label>
                        <Form.Control as="textarea" rows={3} name="applicantPrevDuties" value={formData.applicantPrevDuties || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('employmentInfo', openSections.employmentInfo, (val) => setOpenSections(p => ({...p, employmentInfo: val})), 'employmentInfo')} placeholder="Describe your duties (or N/A)" required className={`form-control ${!formData.applicantPrevDuties ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>3.3 Reason for Dismissal (if applicable)</Form.Label>
                        <Form.Control as="textarea" rows={2} name="applicantPrevDismissalReason" value={formData.applicantPrevDismissalReason || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('employmentInfo', openSections.employmentInfo, (val) => setOpenSections(p => ({...p, employmentInfo: val})), 'employmentInfo')} placeholder="Reason for leaving previous employment (or N/A)" className="form-control mb-4" />
                    </Form.Group>
                </div>
            )}

            {/* --- 4. Motivational Letter --- */}
            <CollapsibleHeader
                title="4. Motivational Letter"
                isOpen={openSections.motivationalLetter}
                onToggle={() => toggleSection('motivationalLetter')}
                sectionId="coroner-motivational-letter"
            />
            {openSections.motivationalLetter && (
                <div id="collapse-coroner-motivational-letter" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>4.1 Motivational Letter</Form.Label>
                        <Form.Control
                            as="textarea" rows={8} name="applicantMotivationLetter" value={formData.applicantMotivationLetter || ''}
                            onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('motivationalLetter', openSections.motivationalLetter, (val) => setOpenSections(p => ({...p, motivationalLetter: val})), 'motivationalLetter')}
                            placeholder="Describe why you wish to join us, why we should choose you rather than someone else, and why the qualities required from this job correspond to you."
                            required className={`form-control ${!formData.applicantMotivationLetter ? 'is-invalid' : ''} mb-4`}
                        />
                    </Form.Group>
                </div>
            )}

            {/* --- 5. (( Out of Character information )) --- */}
            <CollapsibleHeader
                title="5. (( Out of Character information ))"
                isOpen={openSections.oocInfo}
                onToggle={() => toggleSection('oocInfo')}
                sectionId="coroner-ooc-info"
            />
            {openSections.oocInfo && (
                <div id="collapse-coroner-ooc-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3" controlId="psychOocUcpName">
                        <Form.Label className="field-label">5.1 User Control Panel (UCP) Username:</Form.Label>
                        <Form.Control type="text" name="oocUcpName" value={formData.oocUcpName || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} placeholder="Your UCP name" required className={`form-control ${!formData.oocUcpName?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.oocUcpName?.trim() && <div className="invalid-feedback d-block">UCP Username is required.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychOocForumName">
                        <Form.Label className="field-label">5.2 GTA:W Forum Account Name:</Form.Label>
                        <Form.Control type="text" name="oocForumName" value={formData.oocForumName || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} placeholder="Your forum name" required className={`form-control ${!formData.oocForumName?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.oocForumName?.trim() && <div className="invalid-feedback d-block">Forum Name is required.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychOocDiscord">
                        <Form.Label className="field-label">5.3 Discord Name:</Form.Label>
                        <Form.Control type="text" name="oocDiscord" value={formData.oocDiscord || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} placeholder="yourdiscord#1234 or new username" required className={`form-control ${!formData.oocDiscord?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.oocDiscord?.trim() && <div className="invalid-feedback d-block">Discord Name is required.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychOocTimezone">
                        <Form.Label className="field-label">5.4 Timezone:</Form.Label>
                        <Form.Control type="text" name="oocTimezone" value={formData.oocTimezone || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} placeholder="e.g., EST, PST, GMT+2" required className={`form-control ${!formData.oocTimezone?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.oocTimezone?.trim() && <div className="invalid-feedback d-block">Timezone is required.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychOocMedicalExperience">
                        <Form.Label className="field-label">5.5 Real life medical experience or past medical RP:</Form.Label>
                        <Form.Control as="textarea" rows={3} name="oocMedicalExperience" value={formData.oocMedicalExperience || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} placeholder="Describe any relevant experience" required className={`form-control ${!formData.oocMedicalExperience?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.oocMedicalExperience?.trim() && <div className="invalid-feedback d-block">This field is required.</div>}
                    </Form.Group>
                    
                    <Form.Group className="mb-3">
                        <Form.Label>5.6 Unedited Screenshot of your Admin Record with the current date & time displayed:</Form.Label>
                        <InputGroup>
                            <Form.Control
                                type="text"
                                name="oocAdminRecordLink"
                                value={formData.oocAdminRecordLink || ''}
                                onChange={handleChange}
                                onBlur={() => handleSectionFieldBlur('oocInfo', openSections.oocInfo, (val) => setOpenSections(p => ({...p, oocInfo: val})), 'oocInfo')}
                                placeholder="Direct link to image (e.g., Imgur)"
                                required
                                className={`form-control ${!formData.oocAdminRecordLink ? 'is-invalid' : ''}`}
                            />
                            <Button
                                variant="outline-secondary"
                                onClick={() => document.getElementById('coroner-oocAdminRecordUpload').click()}
                                disabled={isUploading}
                            >
                                {isUploading ? <Spinner as="span" animation="border" size="sm" /> : <i className="fas fa-upload"></i>}
                            </Button>
                        </InputGroup>
                        <input
                            type="file"
                            id="coroner-oocAdminRecordUpload"
                            style={{ display: 'none' }}
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'oocAdminRecordLink')}
                        />
                        <div className="mb-4"></div> {/* Spacer */}
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>5.7 Provide a screenshot of your character's statistics (/stats) which you're applying with:</Form.Label>
                        <InputGroup>
                            <Form.Control
                                type="text"
                                name="oocStatsLink"
                                value={formData.oocStatsLink || ''}
                                onChange={handleChange}
                                onBlur={() => handleSectionFieldBlur('oocInfo', openSections.oocInfo, (val) => setOpenSections(p => ({...p, oocInfo: val})), 'oocInfo')}
                                placeholder="Direct link to image (e.g., Imgur)"
                                required
                                className={`form-control ${!formData.oocStatsLink ? 'is-invalid' : ''}`}
                            />
                            <Button
                                variant="outline-secondary"
                                onClick={() => document.getElementById('coroner-oocStatsUpload').click()}
                                disabled={isUploading}
                            >
                                {isUploading ? <Spinner as="span" animation="border" size="sm" /> : <i className="fas fa-upload"></i>}
                            </Button>
                        </InputGroup>
                        <input
                            type="file"
                            id="coroner-oocStatsUpload"
                            style={{ display: 'none' }}
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'oocStatsLink')}
                        />
                        <div className="mb-4"></div> {/* Spacer */}
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>5.8 Provide your character's background story:</Form.Label>
                        <Form.Control as="textarea" rows={5} name="charBackground" value={formData.charBackground || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', openSections.oocInfo, (val) => setOpenSections(p => ({...p, oocInfo: val})), 'oocInfo')} required className={`form-control ${!formData.charBackground ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                </div>
            )}
        </>
    );
};

export default CoronerFields;
