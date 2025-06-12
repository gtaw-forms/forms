// src/phmc-field-data/Physician.js
import React, { useState } from 'react';
import { Form, Button } from 'react-bootstrap';

// Helper component for collapsible section headers (similar to AircraftRegistration.js)
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
            color: 'inherit', // Or your desired color
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


const PhysicianFields = ({
    formData,
    handleChange,
    selectOptions // This prop should contain the data from Firebase
}) => {

    const phmcRecruitmentPositionsOptions = selectOptions?.phmcRecruitmentPositions || [];

    // State for collapsible sections
    const [isPersonalInfoOpen, setIsPersonalInfoOpen] = useState(true); // Default to open
    const [isEducationalInfoOpen, setIsEducationalInfoOpen] = useState(true);
    const [isEmploymentInfoOpen, setIsEmploymentInfoOpen] = useState(true);
    const [isMotivationalLetterOpen, setIsMotivationalLetterOpen] = useState(true);
    const [isOocInfoOpen, setIsOocInfoOpen] = useState(true);


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
                        >
                            <option value="">Select a Position...</option>
                            {Array.isArray(phmcRecruitmentPositionsOptions) && phmcRecruitmentPositionsOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
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
                            placeholder="e.g., Dr. John Smith"
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.2 Gender</Form.Label>
                        <div>
                            <Form.Check
                                inline
                                type="checkbox"
                                label="Male"
                                name="genderMale"
                                checked={formData.genderMale || false}
                                onChange={handleChange}
                            />
                            <Form.Check
                                inline
                                type="checkbox"
                                label="Female"
                                name="genderFemale"
                                checked={formData.genderFemale || false}
                                onChange={handleChange}
                            />
                            <Form.Check
                                inline
                                type="checkbox"
                                label="Other"
                                name="genderOther"
                                checked={formData.genderOther || false}
                                onChange={handleChange}
                            />
                        </div>
                        {formData.genderOther && (
                            <Form.Control
                                type="text"
                                name="applicantGenderOtherText"
                                value={formData.applicantGenderOtherText || ''}
                                onChange={handleChange}
                                placeholder="Specify other gender"
                                className="mt-2"
                            />
                        )}
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.3 Date & Place of Birth</Form.Label>
                        <Form.Control
                            type="text"
                            name="applicantDOBAndPlace"
                            value={formData.applicantDOBAndPlace || ''}
                            onChange={handleChange}
                            placeholder="DD/MMM/YYYY in CITY"
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.4 Address</Form.Label>
                        <Form.Control
                            type="text"
                            name="applicantAddress"
                            value={formData.applicantAddress || ''}
                            onChange={handleChange}
                            placeholder="Your residential address"
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.5 Contact Details</Form.Label>
                        <Form.Control
                            type="text"
                            name="applicantContactDetails"
                            value={formData.applicantContactDetails || ''}
                            onChange={handleChange}
                            placeholder="Phone Number / Email"
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.6 Desired Employment Location</Form.Label>
                        <div>
                            <Form.Check
                                inline
                                type="checkbox"
                                label="Pillbox Hill Medical Center (City of Los Santos)"
                                name="locationPHMC"
                                checked={formData.locationPHMC || false}
                                onChange={handleChange}
                            />
                            <Form.Check
                                inline
                                type="checkbox"
                                label="PHMC Paleto Bay Clinic (Paleto Bay)"
                                name="locationPBC"
                                checked={formData.locationPBC || false}
                                onChange={handleChange}
                            />
                        </div>
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.7 Medical Conditions, Allergies, or Prescribed Medication</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            name="applicantMedicalConditions"
                            value={formData.applicantMedicalConditions || ''}
                            onChange={handleChange}
                            placeholder="List any relevant medical information, or N/A"
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label>1.8 Citizenship</Form.Label>
                        <div>
                            <Form.Check
                                inline
                                type="checkbox"
                                label="United States Citizen"
                                name="citizenUS"
                                checked={formData.citizenUS || false}
                                onChange={handleChange}
                            />
                            <Form.Check
                                inline
                                type="checkbox"
                                label="Permanent resident alien status and applied for U.S. Citizenship"
                                name="citizenPermanent"
                                checked={formData.citizenPermanent || false}
                                onChange={handleChange}
                            />
                            <Form.Check
                                inline
                                type="checkbox"
                                label="None of the above"
                                name="citizenNone"
                                checked={formData.citizenNone || false}
                                onChange={handleChange}
                            />
                        </div>
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
                        <div>
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
                        <Form.Control type="text" name="applicantSchoolName" value={formData.applicantSchoolName || ''} onChange={handleChange} placeholder="Name of the institution" />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>2.2.2 Enrollment Term</Form.Label>
                        <Form.Control type="text" name="applicantEnrollmentTerm" value={formData.applicantEnrollmentTerm || ''} onChange={handleChange} placeholder="DD/MMM/YYYY to DD/MMM/YYYY" />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>2.2.3 Major Course of Study</Form.Label>
                        <Form.Control type="text" name="applicantMajor" value={formData.applicantMajor || ''} onChange={handleChange} placeholder="Your major or field of study" />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>2.3 Additional Languages</Form.Label>
                        <Form.Control type="text" name="applicantLanguages" value={formData.applicantLanguages || ''} onChange={handleChange} placeholder="List any additional languages spoken" />
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
                        <Form.Control type="text" name="applicantPrevEmployment" value={formData.applicantPrevEmployment || ''} onChange={handleChange} placeholder="ROLE at COMPANY between DD/MMM/YYYY to DD/MMM/YYYY" />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>3.2 Duties</Form.Label>
                        <Form.Control as="textarea" rows={3} name="applicantPrevDuties" value={formData.applicantPrevDuties || ''} onChange={handleChange} placeholder="Describe your duties" />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>3.3 Reason for Dismissal (if applicable)</Form.Label>
                        <Form.Control as="textarea" rows={2} name="applicantPrevDismissalReason" value={formData.applicantPrevDismissalReason || ''} onChange={handleChange} placeholder="Reason for leaving previous employment" />
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
                            as="textarea"
                            rows={8}
                            name="applicantMotivationLetter"
                            value={formData.applicantMotivationLetter || ''}
                            onChange={handleChange}
                            placeholder="Describe why you wish to join us, why we should choose you rather than someone else, and why the qualities required from this job correspond to you."
                        />
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
                        <Form.Control type="text" name="oocUcpName" value={formData.oocUcpName || ''} onChange={handleChange} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>5.2 GTA:W Forum Account Name</Form.Label>
                        <Form.Control type="text" name="oocForumName" value={formData.oocForumName || ''} onChange={handleChange} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>5.3 Discord Name</Form.Label>
                        <Form.Control type="text" name="oocDiscord" value={formData.oocDiscord || ''} onChange={handleChange} placeholder="username#1234 or new username format" />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>5.4 Timezone</Form.Label>
                        <Form.Control type="text" name="oocTimezone" value={formData.oocTimezone || ''} onChange={handleChange} placeholder="e.g., UTC+0, EST, PST" />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>5.5 Real-life Medical Experience / Medical Faction Roleplay History</Form.Label>
                        <Form.Control as="textarea" rows={3} name="oocMedicalExperience" value={formData.oocMedicalExperience || ''} onChange={handleChange} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>5.6 Admin Record Screenshot Link</Form.Label>
                        <Form.Control type="url" name="oocAdminRecordLink" value={formData.oocAdminRecordLink || ''} onChange={handleChange} placeholder="Direct link to image (e.g., Imgur)" />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>5.7 Character Statistics (/stats) Screenshot Link</Form.Label>
                        <Form.Control type="url" name="oocStatsLink" value={formData.oocStatsLink || ''} onChange={handleChange} placeholder="Direct link to image (e.g., Imgur)" />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>5.8 Character's Background Story</Form.Label>
                        <Form.Control as="textarea" rows={8} name="charBackground" value={formData.charBackground || ''} onChange={handleChange} />
                    </Form.Group>
                </div>
            )}
        </>
    );
};

export default PhysicianFields;
