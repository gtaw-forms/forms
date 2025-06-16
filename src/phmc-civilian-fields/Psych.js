import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Form, Button } from 'react-bootstrap'; // Removed Row

// Helper component for collapsible section headers (from Physician.js)
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


// Define which fields belong to this form for potential localStorage or other logic
const psychFormFields = [
    'recruitmentPosition', 'applicantTitleAndFullName', 'genderMale', 'genderFemale', 'genderOther',
    'applicantGenderOtherText', 'applicantDOBAndPlace', 'applicantAddress', 'applicantContactDetails',
    'locationPHMC', 'locationPBC', 'applicantMedicalConditions', 'citizenUS', 'citizenPermanent', 'citizenNone',
    'eduHighSchool', 'eduCertificate', 'eduDiploma', 'eduAssociate', 'eduBachelor', 'eduMaster', 'eduDoctorate',
    'applicantSchoolName', 'applicantEnrollmentTerm', 'applicantMajor', 'applicantLanguages',
    'applicantPrevEmployment', 'applicantPrevDuties', 'applicantPrevDismissalReason',
    'applicantMotivationLetter', 'oocUcpName', 'oocForumName', 'oocDiscord', 'oocTimezone',
    'oocMedicalExperience', 'oocAdminRecordLink', 'oocStatsLink', 'charBackground'
];


const PsychFields = ({
    formData,
    handleChange,
    setFormData,
    selectOptions, // For general dropdowns
    psychRecruitmentDetails, // New prop for Psych position details
    }) => {

    const currentPositionDetails = psychRecruitmentDetails || {};
    const currentRecruitmentOptions = selectOptions.psychRecruitmentPositions || []; // From Firebase

    const selectedRecruitmentPositionValue = formData.recruitmentPosition;
    const selectedRecruitmentPosition = currentRecruitmentOptions.find(
        option => option.value === selectedRecruitmentPositionValue
    );

    // --- MODIFIED: Condition for layout ---
    const shouldShowSimplifiedLayout =
        selectedRecruitmentPositionValue === "Counseling Psychologist" ||
        selectedRecruitmentPositionValue === "Psychologist";
    // --- END MODIFICATION ---

    // State for collapsible sections
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

    // Define required fields for each section for auto-collapse logic
    const sectionRequiredFields = {
        personalInfo: [
            'recruitmentPosition', 'applicantTitleAndFullName',
            { anyOf: ['genderMale', 'genderFemale', 'genderOther'] },
            { conditional: { if: { field: 'genderOther', value: true }, then: { field: 'applicantGenderOtherText' } } },
            'applicantDOBAndPlace', 'applicantAddress', 'applicantContactDetails',
            { // --- MODIFIED: Conditional check based on layout ---
                check: (currentFormData, showSimplified) => {
                    if (showSimplified) { // Counseling Psychologist or Psychologist
                        return !!currentFormData.applicantMedicalConditions?.trim() &&
                               (!!currentFormData.citizenUS || !!currentFormData.citizenPermanent || !!currentFormData.citizenNone);
                    } else { // Other Psych roles (only location is required for this dynamic part)
                        return (!!currentFormData.locationPHMC || !!currentFormData.locationPBC);
                    }
                }
            }
            // --- END MODIFICATION ---
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

    const checkFieldsCompletion = useCallback((fieldsToCheck, showSimplifiedFlag) => { // Added showSimplifiedFlag
        for (const field of fieldsToCheck) {
            if (typeof field === 'string') {
                const value = formData[field];
                if (typeof value === 'string' && !value.trim()) return false;
                if (typeof value === 'boolean' && !value && value !== false) return false;
                if (value === undefined || value === null) return false;
            } else if (typeof field === 'object' && field.anyOf) {
                if (!field.anyOf.some(subField => !!formData[subField])) return false;
            } else if (typeof field === 'object' && field.conditional) {
                if (!!formData[field.conditional.if.field] === field.conditional.if.value) {
                    const conditionalValue = formData[field.conditional.then.field];
                    if (typeof conditionalValue === 'string' && !conditionalValue.trim()) return false;
                    if (conditionalValue === undefined || conditionalValue === null) return false;
                }
            } else if (typeof field === 'object' && field.check) {
                // --- MODIFIED: Pass the flag to the check function ---
                if (!field.check(formData, showSimplifiedFlag)) return false;
                // --- END MODIFICATION ---
            }
        }
        return true;
    }, [formData]);

    const handleSectionFieldBlur = useCallback((sectionId, isOpenState, setIsOpenFunction, requiredFieldsKey) => {
        // --- MODIFIED: Pass shouldShowSimplifiedLayout to checkFieldsCompletion ---
        const isNowComplete = checkFieldsCompletion(sectionRequiredFields[requiredFieldsKey], shouldShowSimplifiedLayout);
        // --- END MODIFICATION ---
        const wasCompleteAtLastBlur = prevCompletionStatusOnBlurRef.current[sectionId] === true;

        if (isOpenState && isNowComplete && !wasCompleteAtLastBlur) {
            setIsOpenFunction(false);
        }
        prevCompletionStatusOnBlurRef.current[sectionId] = isNowComplete;
    }, [checkFieldsCompletion, sectionRequiredFields, shouldShowSimplifiedLayout]); // Added shouldShowSimplifiedLayout dependency


    return (
        <>
            {/* Section 1: Personal Information */}
            <CollapsibleHeader
                title="1. Personal Information"
                isOpen={isPersonalInfoOpen}
                onToggle={() => setIsPersonalInfoOpen(!isPersonalInfoOpen)}
                sectionId="psych-personal-info"
            />
            {isPersonalInfoOpen && (
                <div id="collapse-psych-personal-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3" controlId="psychRecruitmentPosition">
                        <Form.Label className="field-label">1.0 Position Applying For:</Form.Label>
                        <Form.Select
                            name="recruitmentPosition"
                            value={formData.recruitmentPosition || ''}
                            onChange={handleChange} // handleChange already handles e.target.name and e.target.value
                            onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            required // Keep if it's a required field
                            className={`form-control ${!formData.recruitmentPosition ? 'is-invalid' : ''}`}
                        >
                            <option value="">Select Psych Position...</option>
                            {currentRecruitmentOptions.map(opt => (
                                <option
                                    key={opt.value}
                                    value={opt.value}
                                    disabled={currentPositionDetails[opt.value]?.status === "CLOSED"}
                                    style={currentPositionDetails[opt.value]?.status === "CLOSED" ? { color: 'red', fontWeight: 'bold' } : {}}
                                >
                                    {opt.label}
                                    {currentPositionDetails[opt.value]?.status === "CLOSED" ? " (Applications Closed)" : ""}
                                </option>
                            ))}
                        </Form.Select>
                        {!formData.recruitmentPosition && <div className="invalid-feedback d-block">Position is required.</div>}
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="psychApplicantTitleAndFullName">
                        <Form.Label className="field-label">1.1 Title & Full Name:</Form.Label>
                        <Form.Control
                            type="text" name="applicantTitleAndFullName" value={formData.applicantTitleAndFullName || ''} onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            placeholder="e.g., Dr. John Doe, Mr. Alex Smith" required
                            className={`form-control ${!formData.applicantTitleAndFullName?.trim() ? 'is-invalid' : ''}`}
                        />
                        {!formData.applicantTitleAndFullName?.trim() && <div className="invalid-feedback d-block">Title & Full Name is required.</div>}
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="psychApplicantGender">
                        <Form.Label className="field-label">1.2 Gender:</Form.Label>
                        <div onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}>
                            <Form.Check inline type="checkbox" label="Male" name="genderMale" checked={!!formData.genderMale} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Female" name="genderFemale" checked={!!formData.genderFemale} onChange={handleChange} />
                            <Form.Check inline type="checkbox" label="Other" name="genderOther" checked={!!formData.genderOther} onChange={handleChange} />
                            {!(formData.genderMale || formData.genderFemale || formData.genderOther) && <div className="invalid-feedback d-block">Gender selection is required.</div>}
                            {formData.genderOther && (
                                <Form.Control
                                    type="text" name="applicantGenderOtherText" value={formData.applicantGenderOtherText || ''} onChange={handleChange}
                                    onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                                    placeholder="Please specify" className={`mt-2 form-control ${!formData.applicantGenderOtherText?.trim() ? 'is-invalid' : ''}`} required={formData.genderOther}
                                />
                            )}
                            {formData.genderOther && !formData.applicantGenderOtherText?.trim() && <div className="invalid-feedback d-block">Specification for 'Other' gender is required.</div>}
                        </div>
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="psychApplicantDOBAndPlace">
                        <Form.Label className="field-label">1.3 Date & Place of Birth:</Form.Label>
                        <Form.Control
                            type="text" name="applicantDOBAndPlace" value={formData.applicantDOBAndPlace || ''} onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            placeholder="DD/MMM/YYYY in City, State/Country" required
                            className={`form-control ${!formData.applicantDOBAndPlace?.trim() ? 'is-invalid' : ''}`}
                        />
                        {!formData.applicantDOBAndPlace?.trim() && <div className="invalid-feedback d-block">Date & Place of Birth is required.</div>}
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="psychApplicantAddress">
                        <Form.Label className="field-label">1.4 Address:</Form.Label>
                        <Form.Control
                            type="text" name="applicantAddress" value={formData.applicantAddress || ''} onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            placeholder="Street Address, City, State, Zip Code" required
                            className={`form-control ${!formData.applicantAddress?.trim() ? 'is-invalid' : ''}`}
                        />
                        {!formData.applicantAddress?.trim() && <div className="invalid-feedback d-block">Address is required.</div>}
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="psychApplicantContactDetails">
                        <Form.Label className="field-label">1.5 Contact Details:</Form.Label>
                        <Form.Control
                            type="text" name="applicantContactDetails" value={formData.applicantContactDetails || ''} onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                            placeholder="Phone Number / Email Address" required
                            className={`form-control ${!formData.applicantContactDetails?.trim() ? 'is-invalid' : ''}`}
                        />
                        {!formData.applicantContactDetails?.trim() && <div className="invalid-feedback d-block">Contact Details are required.</div>}
                    </Form.Group>

                    {/* --- MODIFIED: Conditional Rendering based on shouldShowSimplifiedLayout --- */}
                    {shouldShowSimplifiedLayout ? (
                        <>
                            <Form.Group className="mb-3" controlId="psychApplicantMedicalConditionsSimplified">
                                <Form.Label className="field-label">1.6 Medical Conditions/Allergies/Medication:</Form.Label>
                                <Form.Control
                                    as="textarea" rows={3} name="applicantMedicalConditions" value={formData.applicantMedicalConditions || ''} onChange={handleChange}
                                    onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}
                                    placeholder="List any diagnosed medical conditions, allergies, or prescribed medications. If none, state 'None'." required
                                    className={`form-control ${!formData.applicantMedicalConditions?.trim() ? 'is-invalid' : ''}`}
                                />
                                {!formData.applicantMedicalConditions?.trim() && <div className="invalid-feedback d-block">This field is required (enter N/A if none).</div>}
                            </Form.Group>
                            <Form.Group className="mb-3" controlId="psychApplicantCitizenshipSimplified">
                                <Form.Label className="field-label">1.7 Citizenship:</Form.Label>
                                <div onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}>
                                    <Form.Check type="checkbox" label="United States Citizen" name="citizenUS" checked={!!formData.citizenUS} onChange={handleChange} />
                                    <Form.Check type="checkbox" label="Permanent resident alien status and applied for U.S. Citizenship" name="citizenPermanent" checked={!!formData.citizenPermanent} onChange={handleChange} />
                                    <Form.Check type="checkbox" label="None of the above" name="citizenNone" checked={!!formData.citizenNone} onChange={handleChange} />
                                    {!(formData.citizenUS || formData.citizenPermanent || formData.citizenNone) && <div className="invalid-feedback d-block">Citizenship status is required.</div>}
                                </div>
                            </Form.Group>
                        </>
                    ) : (
                        <>
                            <Form.Group className="mb-3" controlId="psychDesiredEmploymentLocationStandard">
                                <Form.Label className="field-label">1.6 Desired Employment Location:</Form.Label>
                                <div onBlur={() => handleSectionFieldBlur('personalInfo', isPersonalInfoOpen, setIsPersonalInfoOpen, 'personalInfo')}>
                                    <Form.Check inline type="checkbox" label="Pillbox Hill Medical Center (City)" name="locationPHMC" checked={!!formData.locationPHMC} onChange={handleChange} />
                                    <Form.Check inline type="checkbox" label="PHMC Paleto Bay Clinic" name="locationPBC" checked={!!formData.locationPBC} onChange={handleChange} />
                                    {!(formData.locationPHMC || formData.locationPBC) && <div className="invalid-feedback d-block">At least one location must be selected.</div>}
                                </div>
                            </Form.Group>
                            {/* Medical Conditions and Citizenship are NOT shown here for "other" Psych roles as per generatePsych.js logic */}
                        </>
                    )}
                    {/* --- END MODIFICATION --- */}
                </div>
            )}

            {/* Section 2: Educational Background */}
            <CollapsibleHeader
                title="2. Educational Background"
                isOpen={isEducationalInfoOpen}
                onToggle={() => setIsEducationalInfoOpen(!isEducationalInfoOpen)}
                sectionId="psych-educational-info"
            />
            {isEducationalInfoOpen && (
                <div id="collapse-psych-educational-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3" controlId="psychHighestEducation">
                        <Form.Label className="field-label">2.1 Highest Level of Education:</Form.Label>
                        <div onBlur={() => handleSectionFieldBlur('educationalInfo', isEducationalInfoOpen, setIsEducationalInfoOpen, 'educationalInfo')}>
                            <Form.Check type="checkbox" label="High School Diploma" name="eduHighSchool" checked={!!formData.eduHighSchool} onChange={handleChange} />
                            <Form.Check type="checkbox" label="Certificate (Sub-bachelor or vocational)" name="eduCertificate" checked={!!formData.eduCertificate} onChange={handleChange} />
                            <Form.Check type="checkbox" label="Diploma (Sub-bachelor or vocational)" name="eduDiploma" checked={!!formData.eduDiploma} onChange={handleChange} />
                            <Form.Check type="checkbox" label="Associate Degree" name="eduAssociate" checked={!!formData.eduAssociate} onChange={handleChange} />
                            <Form.Check type="checkbox" label="Bachelor's Degree" name="eduBachelor" checked={!!formData.eduBachelor} onChange={handleChange} />
                            <Form.Check type="checkbox" label="Master's Degree" name="eduMaster" checked={!!formData.eduMaster} onChange={handleChange} />
                            <Form.Check type="checkbox" label="Doctorate" name="eduDoctorate" checked={!!formData.eduDoctorate} onChange={handleChange} />
                            {!(formData.eduHighSchool || formData.eduCertificate || formData.eduDiploma || formData.eduAssociate || formData.eduBachelor || formData.eduMaster || formData.eduDoctorate) && <div className="invalid-feedback d-block">Highest level of education is required.</div>}
                        </div>
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychSchoolName">
                        <Form.Label className="field-label">2.2.1 School Name:</Form.Label>
                        <Form.Control type="text" name="applicantSchoolName" value={formData.applicantSchoolName || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('educationalInfo', isEducationalInfoOpen, setIsEducationalInfoOpen, 'educationalInfo')} placeholder="Name of institution" required className={`form-control ${!formData.applicantSchoolName?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.applicantSchoolName?.trim() && <div className="invalid-feedback d-block">School Name is required.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychEnrollmentTerm">
                        <Form.Label className="field-label">2.2.2 Enrollment Term:</Form.Label>
                        <Form.Control type="text" name="applicantEnrollmentTerm" value={formData.applicantEnrollmentTerm || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('educationalInfo', isEducationalInfoOpen, setIsEducationalInfoOpen, 'educationalInfo')} placeholder="DD/MMM/YYYY to DD/MMM/YYYY" required className={`form-control ${!formData.applicantEnrollmentTerm?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.applicantEnrollmentTerm?.trim() && <div className="invalid-feedback d-block">Enrollment Term is required.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychMajor">
                        <Form.Label className="field-label">2.2.3 Major Course of Study:</Form.Label>
                        <Form.Control type="text" name="applicantMajor" value={formData.applicantMajor || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('educationalInfo', isEducationalInfoOpen, setIsEducationalInfoOpen, 'educationalInfo')} placeholder="e.g., Psychology, Clinical Psychology" required className={`form-control ${!formData.applicantMajor?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.applicantMajor?.trim() && <div className="invalid-feedback d-block">Major Course of Study is required.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychLanguages">
                        <Form.Label className="field-label">2.3 Additional Languages:</Form.Label>
                        <Form.Control type="text" name="applicantLanguages" value={formData.applicantLanguages || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('educationalInfo', isEducationalInfoOpen, setIsEducationalInfoOpen, 'educationalInfo')} placeholder="List any additional languages spoken and proficiency (or N/A)" required className={`form-control ${!formData.applicantLanguages?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.applicantLanguages?.trim() && <div className="invalid-feedback d-block">This field is required (enter N/A if none).</div>}
                    </Form.Group>
                </div>
            )}

            {/* Section 3: Employment History */}
            <CollapsibleHeader
                title="3. Employment History"
                isOpen={isEmploymentInfoOpen}
                onToggle={() => setIsEmploymentInfoOpen(!isEmploymentInfoOpen)}
                sectionId="psych-employment-info"
            />
            {isEmploymentInfoOpen && (
                <div id="collapse-psych-employment-info" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3" controlId="psychPrevEmployment">
                        <Form.Label className="field-label">3.1 Previous Employment:</Form.Label>
                        <Form.Control type="text" name="applicantPrevEmployment" value={formData.applicantPrevEmployment || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('employmentInfo', isEmploymentInfoOpen, setIsEmploymentInfoOpen, 'employmentInfo')} placeholder="ROLE at COMPANY, DD/MMM/YYYY to DD/MMM/YYYY (or N/A)" required className={`form-control ${!formData.applicantPrevEmployment?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.applicantPrevEmployment?.trim() && <div className="invalid-feedback d-block">This field is required (enter N/A if none).</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychPrevDuties">
                        <Form.Label className="field-label">3.2 Duties:</Form.Label>
                        <Form.Control as="textarea" rows={3} name="applicantPrevDuties" value={formData.applicantPrevDuties || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('employmentInfo', isEmploymentInfoOpen, setIsEmploymentInfoOpen, 'employmentInfo')} placeholder="Describe your responsibilities (or N/A)" required className={`form-control ${!formData.applicantPrevDuties?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.applicantPrevDuties?.trim() && <div className="invalid-feedback d-block">This field is required (enter N/A if none).</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychPrevDismissalReason">
                        <Form.Label className="field-label">3.3 Reason for Dismissal (if applicable):</Form.Label>
                        <Form.Control as="textarea" rows={2} name="applicantPrevDismissalReason" value={formData.applicantPrevDismissalReason || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('employmentInfo', isEmploymentInfoOpen, setIsEmploymentInfoOpen, 'employmentInfo')} placeholder="Reason for leaving previous employment (or N/A)" />
                    </Form.Group>
                </div>
            )}

            {/* Section 4: Motivational Letter */}
            <CollapsibleHeader
                title="4. Motivational Letter"
                isOpen={isMotivationalLetterOpen}
                onToggle={() => setIsMotivationalLetterOpen(!isMotivationalLetterOpen)}
                sectionId="psych-motivational-letter"
            />
            {isMotivationalLetterOpen && (
                <div id="collapse-psych-motivational-letter" style={{ paddingTop: '0.5rem' }}>
                    <Form.Group className="mb-3" controlId="psychMotivationLetter">
                        <Form.Label className="field-label">4.1 Submit your motivational letter...</Form.Label>
                        <Form.Control
                            as="textarea" rows={8} name="applicantMotivationLetter" value={formData.applicantMotivationLetter || ''} onChange={handleChange}
                            onBlur={() => handleSectionFieldBlur('motivationalLetter', isMotivationalLetterOpen, setIsMotivationalLetterOpen, 'motivationalLetter')}
                            placeholder="Type or paste your motivational letter here..." required
                            className={`form-control ${!formData.applicantMotivationLetter?.trim() ? 'is-invalid' : ''}`}
                        />
                        {!formData.applicantMotivationLetter?.trim() && <div className="invalid-feedback d-block">Motivational Letter is required.</div>}
                    </Form.Group>
                </div>
            )}

            {/* Section 5: OOC Information */}
            <CollapsibleHeader
                title="5. (( Out of Character Information ))"
                isOpen={isOocInfoOpen}
                onToggle={() => setIsOocInfoOpen(!isOocInfoOpen)}
                sectionId="psych-ooc-info"
            />
            {isOocInfoOpen && (
                <div id="collapse-psych-ooc-info" style={{ paddingTop: '0.5rem' }}>
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
                    <Form.Group className="mb-3" controlId="psychOocAdminRecordLink">
                        <Form.Label className="field-label">5.6 Unedited Screenshot of Admin Record (Link):</Form.Label>
                        <Form.Control type="url" name="oocAdminRecordLink" value={formData.oocAdminRecordLink || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} placeholder="Direct link to image (e.g., Imgur)" required className={`form-control ${!formData.oocAdminRecordLink?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.oocAdminRecordLink?.trim() && <div className="invalid-feedback d-block">Admin Record link is required.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychOocStatsLink">
                        <Form.Label className="field-label">5.7 Screenshot of Character Stats (/stats) (Link):</Form.Label>
                        <Form.Control type="url" name="oocStatsLink" value={formData.oocStatsLink || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} placeholder="Direct link to image (e.g., Imgur)" required className={`form-control ${!formData.oocStatsLink?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.oocStatsLink?.trim() && <div className="invalid-feedback d-block">Stats link is required.</div>}
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="psychCharBackground">
                        <Form.Label className="field-label">5.8 Provide your character's background story:</Form.Label>
                        <Form.Control as="textarea" rows={8} name="charBackground" value={formData.charBackground || ''} onChange={handleChange} onBlur={() => handleSectionFieldBlur('oocInfo', isOocInfoOpen, setIsOocInfoOpen, 'oocInfo')} placeholder="Your character's background..." required className={`form-control ${!formData.charBackground?.trim() ? 'is-invalid' : ''}`} />
                        {!formData.charBackground?.trim() && <div className="invalid-feedback d-block">Character Background is required.</div>}
                    </Form.Group>
                </div>
            )}
        </>
    );
};

export default PsychFields;
