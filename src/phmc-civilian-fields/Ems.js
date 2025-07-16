import React, { useState, useEffect, useMemo } from 'react';
import { Form, Button } from 'react-bootstrap';

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

const EMSFields = ({ formData, handleChange, setFormData, selectOptions
}) => {
    // Use emsPositionDetailsData from selectOptions for position dropdown
    const positionDetails = selectOptions?.emsPositionDetailsData || {};
    const selectedRole = formData.recruitmentPosition || '';

    const isParamedic = selectedRole === 'Paramedic';
    const isEMT = selectedRole === 'EMT';
    const isOtherEMS = selectedRole && !isParamedic && !isEMT;

    const [openSections, setOpenSections] = useState({
        personalInfo: true,
        educationalInfo: true,
        employmentInfo: true,
        licensingInfo: true,
        motivationalLetter: true,
        oocInfo: true,
    });
    // List of fields used in this component
const relevantFields = useMemo(() => [
        'recruitmentPosition',
        'applicantTitleAndFullName',
        'genderMale',
        'genderFemale',
        'genderOther',
        'applicantGenderOtherText',
        'applicantDOBAndPlace',
        'applicantAddress',
        'applicantContactDetails',
        'applicantMedicalConditions',
        'citizenUS',
        'citizenPermanent',
        'citizenNone',
        'eduHighSchool',
        'eduCertificate',
        'eduDiploma',
        'eduAssociate',
        'eduBachelor',
        'eduMaster',
        'eduDoctorate',
        'applicantSchoolName',
        'applicantEnrollmentTerm',
        'applicantMajor',
        'applicantLanguages',
        'applicantPrevEmployment',
        'applicantPrevDuties',
        'applicantPrevDismissalReason',
        'emsLicenseLink',
        'emsPartTimeReason',
        'applicantMotivationLetter',
        'oocUcpName',
        'oocForumName',
        'oocAdminRecordLink',
        'oocDiscord',
        'oocTimezone',
        'oocMedicalExperience',
        'oocStatsLink',
        'charBackground',
        'oocOtherCharLicenseProof',
        'dfpSanFireLink',
        'dfpPhmcLink',
        'dfpLegalFactionLink'
], []);
    // Load form data from localStorage on component mount

    const toggleSection = (sectionName) => {
        setOpenSections(prev => ({ ...prev, [sectionName]: !prev[sectionName] }));
    };
    useEffect(() => {
        const loadData = () => {
            const loadedData = {};
            relevantFields.forEach(field => {
                const savedValue = localStorage.getItem(field);
                if (savedValue !== null) {
                    loadedData[field] = savedValue;
                    console.log(`[loadData] Successfully loaded ${field} from localStorage with value: ${savedValue}`);
                } else {
                    console.log(`[loadData] ${field} not found in localStorage.`);
                }
            });

        if (Object.keys(loadedData).length > 0) {
            // Mapping logic here
            if (loadedData.recruitmentPosition === "EMT Trainee") {
                loadedData.recruitmentPosition = "emtTrainee"; // Assuming "emtTrainee" is the correct key
            }
            // Add mappings for other potential values if needed
            setFormData(loadedData);
            console.log("Loaded data (after mapping):", loadedData);
            console.log("positionDetails:", positionDetails);
        } else {
            console.log("[loadData] No data loaded from localStorage to update the form.");
        }
        };

        loadData();
    }, [relevantFields, setFormData]); // Now setFormData is a stable function reference

    return (
        <>
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
                        type="text"
                        name="applicantAddress" //This must be identical to relevantFields
                        value={formData.applicantAddress || ''}
                        onChange={handleChange} //This is important too
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

            {/* --- Conditional Sections Start Here --- */}

            {/* Section 3: Employment History (Paramedic/EMT) */}
            {(isParamedic || isEMT) && (
                <div>
                    <CollapsibleHeader
                        title="3. Employment History"
                        isOpen={openSections.employmentInfo}
                        onToggle={() => toggleSection('employmentInfo')}
                        sectionId="ems-employment-info"
                    />
                    {openSections.employmentInfo && (
                        <div id="collapse-ems-employment-info" style={{ paddingTop: '0.5rem' }}>
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
                </div>
            )}

            {/* Section 3: Licensing & Request Information (OtherEMS) */}
            {isOtherEMS && (
                <div>
                    <CollapsibleHeader
                        title="3. Licensing & Request Information"
                        isOpen={openSections.licensingInfo}
                        onToggle={() => toggleSection('licensingInfo')}
                        sectionId="ems-licensing-info"
                    />
                    {openSections.licensingInfo && (
                        <div id="collapse-ems-licensing-info" style={{ paddingTop: '0.5rem' }}>
                            <Form.Group className="mb-3">
                                <Form.Label>3.1 Provide a copy of your Emergency Medical Technician license (( /licenses ))</Form.Label>
                                <Form.Control type="text" name="emsLicenseLink" value={formData.emsLicenseLink || ''} onChange={handleChange} placeholder="Link to license screenshot" required className={`form-control ${!formData.emsLicenseLink ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>3.2 Please write a short paragraph about why you believe you should be offered a slot with our part-time program:</Form.Label>
                                <Form.Control as="textarea" rows={4} name="emsPartTimeReason" value={formData.emsPartTimeReason || ''} onChange={handleChange} required className={`form-control ${!formData.emsPartTimeReason ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                        </div>
                    )}
                </div>
            )}

            {/* Section 4: Motivational Letter (Paramedic/EMT) */}
            {(isParamedic || isEMT) && (
                <div>
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
                </div>
            )}

            {/* Section 5 for Paramedic/EMT (OOC Info) OR Section 4 for OtherEMS (OOC Info) */}
            {(isParamedic || isEMT) && (
                <div>
                    <CollapsibleHeader
                        title="5. (( Out of Character information ))"
                        isOpen={openSections.oocInfo}
                        onToggle={() => toggleSection('oocInfo')}
                        sectionId="ems-ooc-info-paramedic-emt"
                    />
                    {openSections.oocInfo && (
                        <div id="collapse-ems-ooc-info-paramedic-emt" style={{ paddingTop: '0.5rem' }}>
                            <Form.Group className="mb-3">
                                <Form.Label>5.1 User Control Panel (UCP) Username</Form.Label>
                                <Form.Control type="text" name="oocUcpName" value={formData.oocUcpName || ''} onChange={handleChange} required className={`form-control ${!formData.oocUcpName ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>

                            {isParamedic && (
                                <Form.Group className="mb-3">
                                    <Form.Label>5.2 GTA:W Forum Account Name</Form.Label>
                                    <Form.Control type="text" name="oocForumName" value={formData.oocForumName || ''} onChange={handleChange} required className={`form-control ${!formData.oocForumName ? 'is-invalid' : ''} mb-4`} />
                                </Form.Group>
                            )}
                            {isEMT && (
                                <Form.Group className="mb-3">
                                    <Form.Label>5.2 Unedited Screenshot of your Admin Record:</Form.Label>
                                    <Form.Control type="text" name="oocAdminRecordLink" value={formData.oocAdminRecordLink || ''} onChange={handleChange} placeholder="Direct link to image (e.g., Imgur)" required className={`form-control ${!formData.oocAdminRecordLink ? 'is-invalid' : ''} mb-4`} />
                                </Form.Group>
                            )}

                            <Form.Group className="mb-3">
                                <Form.Label>{isParamedic ? '5.3' : '5.3'} Discord Name</Form.Label>
                                <Form.Control type="text" name="oocDiscord" value={formData.oocDiscord || ''} onChange={handleChange} placeholder="username#1234 or new username format" required className={`form-control ${!formData.oocDiscord ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label>{isParamedic ? '5.4' : (isEMT ? '5.4 GTA:W Forum Account Name' : '5.4 Timezone')}</Form.Label>
                                {isEMT ? (
                                    <Form.Control type="text" name="oocForumName" value={formData.oocForumName || ''} onChange={handleChange} required className={`form-control ${!formData.oocForumName ? 'is-invalid' : ''} mb-4`} />
                                ) : (
                                    <Form.Control type="text" name="oocTimezone" value={formData.oocTimezone || ''} onChange={handleChange} placeholder="e.g., UTC+0, EST, PST" required className={`form-control ${!formData.oocTimezone ? 'is-invalid' : ''} mb-4`} />
                                )}
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label>{isParamedic ? '5.5' : (isEMT ? '5.5 Timezone' : '5.5 Do you have any real life medical experience...?')}</Form.Label>
                                {isEMT ? (
                                    <Form.Control type="text" name="oocTimezone" value={formData.oocTimezone || ''} onChange={handleChange} placeholder="e.g., UTC+0, EST, PST" required className={`form-control ${!formData.oocTimezone ? 'is-invalid' : ''} mb-4`} />
                                ) : (
                                    <Form.Control as="textarea" rows={3} name="oocMedicalExperience" value={formData.oocMedicalExperience || ''} onChange={handleChange} placeholder="Describe in detail (or N/A)" required className={`form-control ${!formData.oocMedicalExperience ? 'is-invalid' : ''} mb-4`} />
                                )}
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label>{isParamedic ? '5.6 Unedited Screenshot of your Admin Record with the current date & time displayed:' : (isEMT ? '5.6 Do you have any real life medical experience...?' : '5.6 Admin Record')}</Form.Label>
                                {isEMT ? (
                                    <Form.Control as="textarea" rows={3} name="oocMedicalExperience" value={formData.oocMedicalExperience || ''} onChange={handleChange} placeholder="Describe in detail (or N/A)" required className={`form-control ${!formData.oocMedicalExperience ? 'is-invalid' : ''} mb-4`} />
                                ) : (
                                    <Form.Control type="text" name="oocAdminRecordLink" value={formData.oocAdminRecordLink || ''} onChange={handleChange} placeholder="Direct link to image (e.g., Imgur)" required className={`form-control ${!formData.oocAdminRecordLink ? 'is-invalid' : ''} mb-4`} />
                                )}
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label>5.7 Provide a screenshot of your character's statistics (/stats) which you're applying with:</Form.Label>
                                <Form.Control type="text" name="oocStatsLink" value={formData.oocStatsLink || ''} onChange={handleChange} placeholder="Direct link to image (e.g., Imgur)" required className={`form-control ${!formData.oocStatsLink ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>5.8 Provide your character's background story:</Form.Label>
                                <Form.Control as="textarea" rows={5} name="charBackground" value={formData.charBackground || ''} onChange={handleChange} required className={`form-control ${!formData.charBackground ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                        </div>
                    )}
                </div>
            )}

            {isOtherEMS && (
                <div>
                    <CollapsibleHeader
                        title="4. (( Out of Character information ))"
                        isOpen={openSections.oocInfo}
                        onToggle={() => toggleSection('oocInfo')}
                        sectionId="ems-ooc-info-other"
                    />
                    {openSections.oocInfo && (
                        <div id="collapse-ems-ooc-info-other" style={{ paddingTop: '0.5rem' }}>
                            <Form.Group className="mb-3">
                                <Form.Label>4.1 User Control Panel (UCP) Username</Form.Label>
                                <Form.Control type="text" name="oocUcpName" value={formData.oocUcpName || ''} onChange={handleChange} required className={`form-control ${!formData.oocUcpName ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>4.2 Unedited Screenshot of your Admin Record:</Form.Label>
                                <Form.Control type="text" name="oocAdminRecordLink" value={formData.oocAdminRecordLink || ''} onChange={handleChange} placeholder="Direct link to image (e.g., Imgur)" required className={`form-control ${!formData.oocAdminRecordLink ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>4.3 GTA:W Forum Account Name</Form.Label>
                                <Form.Control type="text" name="oocForumName" value={formData.oocForumName || ''} onChange={handleChange} required className={`form-control ${!formData.oocForumName ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>4.4 Discord Name</Form.Label>
                                <Form.Control type="text" name="oocDiscord" value={formData.oocDiscord || ''} onChange={handleChange} placeholder="username#1234 or new username format" required className={`form-control ${!formData.oocDiscord ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>4.5 Timezone</Form.Label>
                                <Form.Control type="text" name="oocTimezone" value={formData.oocTimezone || ''} onChange={handleChange} placeholder="e.g., UTC+0, EST, PST" required className={`form-control ${!formData.oocTimezone ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>4.6 Do you hold a valid BLS/ALS license on another character? If yes, provide proof of such via /licenses:</Form.Label>
                                <Form.Control type="text" name="oocOtherCharLicenseProof" value={formData.oocOtherCharLicenseProof || ''} onChange={handleChange} placeholder="ANSWER/LINK (IF APPLICABLE)" className="form-control mb-4" />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>4.7 Provide a screenshot of your character's statistics (/stats) which you're applying with:</Form.Label>
                                <Form.Control type="text" name="oocStatsLink" value={formData.oocStatsLink || ''} onChange={handleChange} placeholder="Direct link to image (e.g., Imgur)" required className={`form-control ${!formData.oocStatsLink ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>4.8 Provide a link of proof to both your DFP from SANFIRE, PHMC and Legal Faction Management:</Form.Label>
                                <Form.Control type="text" name="dfpSanFireLink" value={formData.dfpSanFireLink || ''} onChange={handleChange} placeholder="SAN FIRE DFP Link (or N/A)" className="form-control mb-2" />
                                <Form.Control type="text" name="dfpPhmcLink" value={formData.dfpPhmcLink || ''} onChange={handleChange} placeholder="PHMC DFP Link (or N/A)" className="form-control mb-2" />
                                <Form.Control type="text" name="dfpLegalFactionLink" value={formData.dfpLegalFactionLink || ''} onChange={handleChange} placeholder="Legal Faction Management DFP Link (or N/A)" className="form-control mb-4" />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>4.9 Provide your character's background story:</Form.Label>
                                <Form.Control as="textarea" rows={5} name="charBackground" value={formData.charBackground || ''} onChange={handleChange} required className={`form-control ${!formData.charBackground ? 'is-invalid' : ''} mb-4`} />
                            </Form.Group>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default EMSFields;