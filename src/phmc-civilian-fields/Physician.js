// c:\Users\cross\Documents\GitHub\phmc-forms\src\phmc-civilian-fields\Physician.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Form, Button, InputGroup, Spinner } from 'react-bootstrap'; // Added InputGroup and Spinner

// Helper component for collapsible section headers (remains the same)
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

const LOCAL_STORAGE_KEY = 'physicianApplicationFormData';
const EXPIRY_DURATION_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

const physicianFormFields = [
    'recruitmentPosition', 'applicantTitleAndFullName', 'genderMale', 'genderFemale', 'genderOther',
    'applicantGenderOtherText', 'applicantDOBAndPlace', 'applicantAddress', 'applicantContactDetails',
    'locationPHMC', 'locationPBC', 'applicantMedicalConditions', 'citizenUS', 'citizenPermanent', 'citizenNone',
    'eduHighSchool', 'eduCertificate', 'eduDiploma', 'eduAssociate', 'eduBachelor', 'eduMaster', 'eduDoctorate',
    'applicantSchoolName', 'applicantEnrollmentTerm', 'applicantMajor', 'applicantLanguages',
    'applicantPrevEmployment', 'applicantPrevDuties', 'applicantPrevDismissalReason',
    'applicantMotivationLetter', 'oocUcpName', 'oocForumName', 'oocDiscord', 'oocTimezone',
    'oocMedicalExperience', 'oocAdminRecordLink', 'oocStatsLink', 'charBackground'
];

const PhysicianFields = ({
    formData,
    handleChange,
    setFormData,
    physicianRecruitmentDetails,
    handleImageUpload, // Added prop
    isUploading        // Added prop
}) => {
    const positionDetails = physicianRecruitmentDetails || {};

    const [isPersonalInfoOpen, setIsPersonalInfoOpen] = useState(true);
    const [isEducationalInfoOpen, setIsEducationalInfoOpen] = useState(true);
    const [isEmploymentInfoOpen, setIsEmploymentInfoOpen] = useState(true);
    const [isMotivationalLetterOpen, setIsMotivationalLetterOpen] = useState(true);
    const [isOocInfoOpen, setIsOocInfoOpen] = useState(true);

    const prevCompletionStatusOnBlurRef = useRef({});

    useEffect(() => {
        const sections = ['personalInfo', 'educationalInfo', 'employmentInfo', 'motivationalLetter', 'oocInfo'];
        sections.forEach(sectionId => {
            if (prevCompletionStatusOnBlurRef.current[sectionId] === undefined) {
                prevCompletionStatusOnBlurRef.current[sectionId] = false;
            }
        });
    }, []);

    useEffect(() => {
        try {
            const savedDataString = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedDataString) {
                const savedData = JSON.parse(savedDataString);
                if (savedData && savedData.data && savedData.timestamp) {
                    if (Date.now() - savedData.timestamp < EXPIRY_DURATION_MS) {
                        const relevantSavedData = {};
                        physicianFormFields.forEach(field => {
                            if (savedData.data.hasOwnProperty(field)) {
                                relevantSavedData[field] = savedData.data[field];
                            }
                        });
                        setFormData(prev => ({ ...prev, ...relevantSavedData }));
                    } else {
                        localStorage.removeItem(LOCAL_STORAGE_KEY);
                    }
                }
            }
        } catch (error) {
            console.error("Error loading physician form data from localStorage:", error);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
    }, [setFormData]);

    useEffect(() => {
        try {
            const dataToSave = {};
            physicianFormFields.forEach(field => {
                if (formData.hasOwnProperty(field)) {
                    dataToSave[field] = formData[field];
                }
            });
            const physicianDataWithTimestamp = {
                data: dataToSave,
                timestamp: Date.now()
            };
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(physicianDataWithTimestamp));
        } catch (error) {
            console.error("Error saving physician form data to localStorage:", error);
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
            'applicantDOBAndPlace', 'applicantAddress', 'applicantContactDetails',
            { anyOf: ['locationPHMC', 'locationPBC'] },
            'applicantMedicalConditions',
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


    return (
        <>

            {/* --- 1. Personal Information --- */}
            <CollapsibleHeader
                title="1. Personal Information"
                isOpen={isPersonalInfoOpen}
                onToggle={() => setIsPersonalInfoOpen(!isPersonalInfoOpen)}
                sectionId="personal-info"
            />
            {isPersonalInfoOpen && (
                <div id="collapse-personal-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>1.0 Position Applying For</Form.Label>
                        <Form.Select
                            name="recruitmentPosition"
                            value={formData.recruitmentPosition || ''}
                            onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            required
                            className={`form-control ${!formData.recruitmentPosition ? 'is-invalid' : ''} mb-4`} // Added mb-4
                        >
                            <option value="">Select a Position...</option>
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
                         {!formData.recruitmentPosition && <div className="invalid-feedback d-block custom-validation-message">Position is required.</div>}
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.1 Title & Full Name</Form.Label>
                        <Form.Control
                            type="text"
                            name="applicantTitleAndFullName"
                            value={formData.applicantTitleAndFullName || ''}
                            onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            placeholder="e.g., Dr. John Smith"
                            required
                            className={`form-control ${!formData.applicantTitleAndFullName ? 'is-invalid' : ''} mb-4`} // Added mb-4
                        />
                        {!formData.applicantTitleAndFullName && <div className="invalid-feedback d-block custom-validation-message">Title & Full Name is required.</div>}
                    </Form.Group>

                    <Form.Group className="mb-1"> {/* Keep mb-1 on Form.Group for tighter group, or change to mb-3 if desired */}
                        <Form.Label>1.2 Gender</Form.Label>
                        <div 
                            style={{ display: 'flex', gap: '1rem' }} 
                            className="gender-checkbox-group mb-4" // Added mb-4 to the div wrapping checkboxes
                            onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
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
                        {/* This validation message appears if no gender is selected */}
                        {!(formData.genderMale || formData.genderFemale || formData.genderOther) && <div className="invalid-feedback d-block custom-validation-message">Gender selection is required.</div>}
                        
                        {formData.genderOther && (
                            <Form.Control
                                type="text" name="applicantGenderOtherText" value={formData.applicantGenderOtherText || ''}
                                onChange={handleChange} onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                                placeholder="Specify other gender"
                                className={`mt-2 form-control ${!formData.applicantGenderOtherText ? 'is-invalid' : ''} mb-4`} // Added mb-4, mt-2 is for spacing from checkboxes
                                required={formData.genderOther}
                            />
                        )}
                        {formData.genderOther && !formData.applicantGenderOtherText && <div className="invalid-feedback d-block custom-validation-message">Specification for 'Other' gender is required.</div>}
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.3 Date & Place of Birth</Form.Label>
                        <Form.Control
                            type="text" name="applicantDOBAndPlace" value={formData.applicantDOBAndPlace || ''}
                            onChange={handleChange} onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            placeholder="DD/MMM/YYYY in CITY" required
                            className={`form-control ${!formData.applicantDOBAndPlace ? 'is-invalid' : ''} mb-4`} // Added mb-4
                        />
                        {!formData.applicantDOBAndPlace && <div className="invalid-feedback d-block custom-validation-message">Date & Place of Birth is required.</div>}
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.4 Address</Form.Label>
                        <Form.Control
                            type="text" name="applicantAddress" value={formData.applicantAddress || ''}
                            onChange={handleChange} onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            placeholder="Your residential address" required
                            className={`form-control ${!formData.applicantAddress ? 'is-invalid' : ''} mb-4`} // Added mb-4
                        />
                        {!formData.applicantAddress && <div className="invalid-feedback d-block custom-validation-message">Address is required.</div>}
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.5 Contact Details</Form.Label>
                        <Form.Control
                            type="text" name="applicantContactDetails" value={formData.applicantContactDetails || ''}
                            onChange={handleChange} onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            placeholder="Phone Number / Email" required
                            className={`form-control ${!formData.applicantContactDetails ? 'is-invalid' : ''} mb-4`} // Added mb-4
                        />
                        {!formData.applicantContactDetails && <div className="invalid-feedback d-block custom-validation-message">Contact Details are required.</div>}
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.6 Desired Employment Location</Form.Label>
                        <div 
                            onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            className="mb-4" // Added mb-4 to the div wrapping checkboxes
                        >
                            <Form.Check
                                inline type="checkbox" label="Pillbox Hill Medical Center (City of Los Santos)" name="locationPHMC"
                                checked={formData.locationPHMC || false} onChange={handleChange}
                            />
                            <Form.Check
                                inline type="checkbox" label="PHMC Paleto Bay Clinic (Paleto Bay)" name="locationPBC"
                                checked={formData.locationPBC || false} onChange={handleChange}
                            />
                        </div>
                        {!(formData.locationPHMC || formData.locationPBC) && <div className="invalid-feedback d-block custom-validation-message">At least one location must be selected.</div>}
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.7 Medical Conditions, Allergies, or Prescribed Medication</Form.Label>
                        <Form.Control
                            as="textarea" rows={3} name="applicantMedicalConditions" value={formData.applicantMedicalConditions || ''}
                            onChange={handleChange} onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            placeholder="List any relevant medical information, or N/A" required
                            className={`form-control ${!formData.applicantMedicalConditions ? 'is-invalid' : ''} mb-4`} // Added mb-4
                        />
                        {!formData.applicantMedicalConditions && <div className="invalid-feedback d-block custom-validation-message">This field is required (enter N/A if none).</div>}
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.8 Citizenship</Form.Label>
                        <div 
                            onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            className="mb-4" // Added mb-4 to the div wrapping checkboxes
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
                        {!(formData.citizenUS || formData.citizenPermanent || formData.citizenNone) && <div className="invalid-feedback d-block custom-validation-message">Citizenship status is required.</div>}
                    </Form.Group>
                </div>
            )}

            {/* --- 2. Educational Background --- */}
            <CollapsibleHeader
                title="2. Educational Background"
                isOpen={isEducationalInfoOpen}
                onToggle={() => setIsEducationalInfoOpen(!isEducationalInfoOpen)}
                sectionId="educational-info"
            />
            {isEducationalInfoOpen && (
                <div id="collapse-educational-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>2.1 Highest Level of Education</Form.Label>
                        <div 
                            onBlur={() => handleSectionFieldBlur('educationalInfo', isEducationalInfoOpen, setIsEducationalInfoOpen, 'educationalInfo')}
                            className="mb-4" // Added mb-4 to the div wrapping checkboxes
                        >
                            <Form.Check inline type="checkbox" label="High School Diploma" name="eduHighSchool" checked={formData.eduHighSchool || false} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Certificate (Sub-bachelor or vocational)" name="eduCertificate" checked={formData.eduCertificate || false} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Diploma (Sub-bachelor or vocational)" name="eduDiploma" checked={formData.eduDiploma || false} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Associate Degree" name="eduAssociate" checked={formData.eduAssociate || false} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Bachelor's Degree" name="eduBachelor" checked={formData.eduBachelor || false} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Master's Degree" name="eduMaster" checked={formData.eduMaster || false} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Doctorate" name="eduDoctorate" checked={formData.eduDoctorate || false} onChange={handleChange} />
                        </div>
                        {!(formData.eduHighSchool || formData.eduCertificate || formData.eduDiploma || formData.eduAssociate || formData.eduBachelor || formData.eduMaster || formData.eduDoctorate) && <div className="invalid-feedback d-block custom-validation-message">Highest level of education is required.</div>}
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>2.2.1 School Name</Form.Label>
                        <Form.Control type="text" name="applicantSchoolName" value={formData.applicantSchoolName || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('educationalInfo', isEducationalInfoOpen, setIsEducationalInfoOpen, 'educationalInfo')} placeholder="Name of the institution" required className={`form-control ${!formData.applicantSchoolName ? 'is-invalid' : ''} mb-4`} />
                        {!formData.applicantSchoolName && <div className="invalid-feedback d-block custom-validation-message">School Name is required.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>2.2.2 Enrollment Term</Form.Label>
                        <Form.Control type="text" name="applicantEnrollmentTerm" value={formData.applicantEnrollmentTerm || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('educationalInfo', isEducationalInfoOpen, setIsEducationalInfoOpen, 'educationalInfo')} placeholder="DD/MMM/YYYY to DD/MMM/YYYY" required className={`form-control ${!formData.applicantEnrollmentTerm ? 'is-invalid' : ''} mb-4`} />
                        {!formData.applicantEnrollmentTerm && <div className="invalid-feedback d-block custom-validation-message">Enrollment Term is required.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>2.2.3 Major Course of Study</Form.Label>
                        <Form.Control type="text" name="applicantMajor" value={formData.applicantMajor || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('educationalInfo', isEducationalInfoOpen, setIsEducationalInfoOpen, 'educationalInfo')} placeholder="Your major or field of study" required className={`form-control ${!formData.applicantMajor ? 'is-invalid' : ''} mb-4`} />
                        {!formData.applicantMajor && <div className="invalid-feedback d-block custom-validation-message">Major Course of Study is required.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>2.3 Additional Languages</Form.Label>
                        <Form.Control type="text" name="applicantLanguages" value={formData.applicantLanguages || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('educationalInfo', isEducationalInfoOpen, setIsEducationalInfoOpen, 'educationalInfo')} placeholder="List any additional languages spoken (or N/A)" required className={`form-control ${!formData.applicantLanguages ? 'is-invalid' : ''} mb-4`} />
                        {!formData.applicantLanguages && <div className="invalid-feedback d-block custom-validation-message">This field is required (enter N/A if none).</div>}
                    </Form.Group>
                </div>
            )}

            {/* --- 3. Employment History --- */}
            <CollapsibleHeader
                title="3. Employment History"
                isOpen={isEmploymentInfoOpen}
                onToggle={() => setIsEmploymentInfoOpen(!isEmploymentInfoOpen)}
                sectionId="employment-info"
            />
            {isEmploymentInfoOpen && (
                <div id="collapse-employment-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>3.1 Previous Employment</Form.Label>
                        <Form.Control type="text" name="applicantPrevEmployment" value={formData.applicantPrevEmployment || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('employmentInfo', isEmploymentInfoOpen, setIsEmploymentInfoOpen, 'employmentInfo')} placeholder="ROLE at COMPANY between DD/MMM/YYYY to DD/MMM/YYYY (or N/A)" required className={`form-control ${!formData.applicantPrevEmployment ? 'is-invalid' : ''} mb-4`} />
                        {!formData.applicantPrevEmployment && <div className="invalid-feedback d-block custom-validation-message">This field is required (enter N/A if none).</div>}
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>3.2 Duties</Form.Label>
                        <Form.Control as="textarea" rows={3} name="applicantPrevDuties" value={formData.applicantPrevDuties || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('employmentInfo', isEmploymentInfoOpen, setIsEmploymentInfoOpen, 'employmentInfo')} placeholder="Describe your duties (or N/A)" required className={`form-control ${!formData.applicantPrevDuties ? 'is-invalid' : ''} mb-4`} />
                        {!formData.applicantPrevDuties && <div className="invalid-feedback d-block custom-validation-message">This field is required (enter N/A if none).</div>}
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>3.3 Reason for Dismissal (if applicable)</Form.Label>
                        <Form.Control as="textarea" rows={2} name="applicantPrevDismissalReason" value={formData.applicantPrevDismissalReason || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('employmentInfo', isEmploymentInfoOpen, setIsEmploymentInfoOpen, 'employmentInfo')} placeholder="Reason for leaving previous employment (or N/A)" className="form-control mb-4" />
                        {/* No validation message for optional field, but added mb-4 */}
                    </Form.Group>
                </div>
            )}

            {/* --- 4. Motivational Letter --- */}
            <CollapsibleHeader
                title="4. Motivational Letter"
                isOpen={isMotivationalLetterOpen}
                onToggle={() => setIsMotivationalLetterOpen(!isMotivationalLetterOpen)}
                sectionId="motivational-letter"
            />
            {isMotivationalLetterOpen && (
                <div id="collapse-motivational-letter" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>4.1 Motivational Letter</Form.Label>
                        <Form.Control
                            as="textarea" rows={8} name="applicantMotivationLetter" value={formData.applicantMotivationLetter || ''}
                            onChange={handleChange} onBlur={() => handleSectionFieldBlur('motivationalLetter', isMotivationalLetterOpen, setIsMotivationalLetterOpen, 'motivationalLetter')}
                            placeholder="Describe why you wish to join us, why we should choose you rather than someone else, and why the qualities required from this job correspond to you."
                            required className={`form-control ${!formData.applicantMotivationLetter ? 'is-invalid' : ''} mb-4`}
                        />
                        {!formData.applicantMotivationLetter && <div className="invalid-feedback d-block custom-validation-message">Motivational Letter is required.</div>}
                    </Form.Group>
                </div>
            )}

            {/* --- 5. (( Out of Character information )) --- */}
            <CollapsibleHeader
                title="5. (( Out of Character information ))"
                isOpen={isOocInfoOpen}
                onToggle={() => setIsOocInfoOpen(!isOocInfoOpen)}
                sectionId="ooc-info"
            />
            {isOocInfoOpen && (
                <div id="collapse-ooc-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3">
                        <Form.Label>5.1 User Control Panel (UCP) Username</Form.Label>
                        <Form.Control type="text" name="oocUcpName" value={formData.oocUcpName || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} required className={`form-control ${!formData.oocUcpName ? 'is-invalid' : ''} mb-4`} />
                        {!formData.oocUcpName && <div className="invalid-feedback d-block custom-validation-message">UCP Username is required.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>5.2 GTA:W Forum Account Name</Form.Label>
                        <Form.Control type="text" name="oocForumName" value={formData.oocForumName || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} required className={`form-control ${!formData.oocForumName ? 'is-invalid' : ''} mb-4`} />
                        {!formData.oocForumName && <div className="invalid-feedback d-block custom-validation-message">Forum Name is required.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>5.3 Discord Name</Form.Label>
                        <Form.Control type="text" name="oocDiscord" value={formData.oocDiscord || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} placeholder="username#1234 or new username format" required className={`form-control ${!formData.oocDiscord ? 'is-invalid' : ''} mb-4`} />
                        {!formData.oocDiscord && <div className="invalid-feedback d-block custom-validation-message">Discord Name is required.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>5.4 Timezone</Form.Label>
                        <Form.Control type="text" name="oocTimezone" value={formData.oocTimezone || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} placeholder="e.g., UTC+0, EST, PST" required className={`form-control ${!formData.oocTimezone ? 'is-invalid' : ''} mb-4`} />
                        {!formData.oocTimezone && <div className="invalid-feedback d-block custom-validation-message">Timezone is required.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>5.5 Real-life Medical Experience / Medical Faction Roleplay History</Form.Label>
                        <Form.Control as="textarea" rows={3} name="oocMedicalExperience" value={formData.oocMedicalExperience || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} required className={`form-control ${!formData.oocMedicalExperience ? 'is-invalid' : ''} mb-4`} />
                        {!formData.oocMedicalExperience && <div className="invalid-feedback d-block custom-validation-message">This field is required.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>5.6 Admin Record Screenshot Link</Form.Label>
                        <InputGroup>
                            <Form.Control
                                type="url"
                                name="oocAdminRecordLink"
                                value={formData.oocAdminRecordLink || ''}
                                onChange={handleChange}
                                onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')}
                                placeholder="Direct link to image (e.g., Imgur)"
                                required
                                className={`form-control ${!formData.oocAdminRecordLink ? 'is-invalid' : ''}`}
                            />
                            <Button
                                variant="outline-secondary"
                                onClick={() => document.getElementById('physician-oocAdminRecordUpload').click()}
                                disabled={isUploading}
                            >
                                {isUploading ? <Spinner as="span" animation="border" size="sm" /> : <i className="fas fa-upload"></i>}
                            </Button>
                        </InputGroup>
                        <input
                            type="file"
                            id="physician-oocAdminRecordUpload"
                            style={{ display: 'none' }}
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'oocAdminRecordLink')}
                        />
                        {!formData.oocAdminRecordLink && <div className="invalid-feedback d-block custom-validation-message">Admin Record link is required.</div>}
                        <div className="mb-4"></div> {/* Spacer if not invalid */}
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>5.7 Character Statistics (/stats) Screenshot Link</Form.Label>
                        <InputGroup>
                            <Form.Control
                                type="url"
                                name="oocStatsLink"
                                value={formData.oocStatsLink || ''}
                                onChange={handleChange}
                                onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')}
                                placeholder="Direct link to image (e.g., Imgur)"
                                required
                                className={`form-control ${!formData.oocStatsLink ? 'is-invalid' : ''}`}
                            />
                            <Button
                                variant="outline-secondary"
                                onClick={() => document.getElementById('physician-oocStatsUpload').click()}
                                disabled={isUploading}
                            >
                                {isUploading ? <Spinner as="span" animation="border" size="sm" /> : <i className="fas fa-upload"></i>}
                            </Button>
                        </InputGroup>
                        <input
                            type="file"
                            id="physician-oocStatsUpload"
                            style={{ display: 'none' }}
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'oocStatsLink')}
                        />
                        {/* No validation message for this one in original, but added mb-4 for consistency */}
                        <div className="mb-4"></div>
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>5.8 Character's Background Story</Form.Label>
                        <Form.Control as="textarea" rows={8} name="charBackground" value={formData.charBackground || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} required className={`form-control ${!formData.charBackground ? 'is-invalid' : ''} mb-4`} />
                    </Form.Group>
                </div>
            )}
        </>
    );
};

export default PhysicianFields;
