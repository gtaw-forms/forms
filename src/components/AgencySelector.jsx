// src/components/AgencySelector.js
import React, { useState, useEffect } from 'react';
import { Button, Form, Image } from 'react-bootstrap';
import { getPrimaryFormsForUserType } from '../formDefinitions';

// Style definitions for recruitment forms
const positionStatusListStyle = {
    fontSize: '0.75rem',
    marginTop: '0.5rem',
    textAlign: 'left',
    width: '90%',
    lineHeight: '1.2',
    listStyleType: 'disc',
    paddingLeft: '15px',
    marginBlockStart: '0.2em',
    marginBlockEnd: '0.2em',
    alignSelf: 'stretch',
};
const openStatusStyle = { color: '#28a745', fontWeight: 'bold' };
const closedStatusStyle = { color: '#dc3545', fontWeight: 'bold' };

// Sub-form styles - REMOVED (no longer needed)
// const subFormListContainerStyle = { ... };
// const subFormListHeaderStyle = { ... };
// const subFormListStyle = { ... };
// const subFormListItemStyle = { ... };
// Related Form Mapping - REMOVED to prevent grouping
// const phmcSubFormMap = {
//     1: [2, 4, 11, 37],
//     6: [7],
//     14: [16],
//     20: [21],
//     22: [23],
//     24: [26],
//     25: [3], 
//     28: [29],
//     27: [35],
// };


const AgencySelector = ({
    showAgencySelector,
    setShowAgencySelector,
    handleAgencySelect,
    isMobile,
    hideAgencySelector,
    setHideAgencySelector,
    selectedAgencyGroup,
    formDefinitions,
    physicianRecruitmentDetails,
    psychRecruitmentDetails,
    adminRecruitmentDetails,
    emsRecruitmentDetails,
    nurseRecruitmentDetails,
    coronerRecruitmentDetails,
    userPreferences,
}) => {
    // State to track whether to show personalized or all forms
    const [showPersonalizedForms, setShowPersonalizedForms] = useState(true);
    
    // Reset to personalized view when agency group changes or modal opens
    useEffect(() => {
        if (showAgencySelector && userPreferences) {
            setShowPersonalizedForms(true);
        }
    }, [showAgencySelector, selectedAgencyGroup, userPreferences]);
    
    if (!showAgencySelector || !selectedAgencyGroup) {
        return null;
    }

    // Get recommended forms from user preferences or onboarding
    const getPersonalizedForms = (allForms) => {
        if (!userPreferences || !userPreferences.recommendedForms) {
            // If no user preferences, fall back to primary forms for user type
            // BUT skip grouping for coroner users to avoid nested "Forensic Services" display
            if (userPreferences && userPreferences.userType && userPreferences.userType !== 'coroner') {
                const primaryForms = getPrimaryFormsForUserType(userPreferences.userType);
                return allForms.filter(form => primaryForms.some(pf => pf.version === form.version));
            }
            return allForms; // Show all forms for coroners or if no preferences
        }
        
        // Filter forms based on recommended forms from onboarding
        return allForms.filter(form => userPreferences.recommendedForms.includes(form.version));
    };

    // Filter forms based on user preferences (existing functionality)
    const filteredFormDefinitions = userPreferences
        ? formDefinitions.filter(form => {
            // If no userTypes specified on form, show to everyone
            if (!form.userTypes) return true;

            // Check if user's type is allowed for this form
            const isAllowedByUserType = form.userTypes.includes(userPreferences.userType);

            // Special case: Allow LEO users to see forms in their recommended list
            // even if 'leo' is not in the form's userTypes array
            const isRecommendedForLeo = userPreferences.userType === 'leo' &&
                                      userPreferences.recommendedForms &&
                                      userPreferences.recommendedForms.includes(form.version);

            return isAllowedByUserType || isRecommendedForLeo;
        })
        : formDefinitions;    // Get forms for the selected agency group - include all forms (no longer hiding sub-forms)
    const agencyGroupForms = filteredFormDefinitions
        .filter(form => form.group === selectedAgencyGroup && !form.name.includes('(PBC)'));
    
    // Determine which forms to show (personalized or all)
    let formsToDisplay;
    if (showPersonalizedForms && userPreferences) {
        const personalizedForms = getPersonalizedForms(agencyGroupForms);
        // Only use personalized forms if we have any, otherwise show all
        formsToDisplay = personalizedForms.length > 0 ? personalizedForms : agencyGroupForms;
    } else {
        formsToDisplay = agencyGroupForms;
    }

    const availableForms = formsToDisplay
        .sort((a, b) => {
            const orderA = a.sortOrder !== undefined ? a.sortOrder : Infinity;
            const orderB = b.sortOrder !== undefined ? b.sortOrder : Infinity;
            if (orderA !== orderB) return orderA - orderB;
            return a.name.localeCompare(b.name);
        });
    
    // Helper function to generate modal title
    const getModalTitle = () => {
        if (!userPreferences) {
            return `${selectedAgencyGroup} Form Selection (${availableForms.length})`;
        }
        
        const modeText = showPersonalizedForms ? 'My' : 'All';
        return `${modeText} ${selectedAgencyGroup} Forms (${availableForms.length})`;
    };
    
        // --- Recruitment Details Mapping ---
        // Use props passed from App.js
        const recruitmentDetailsMap = {
            50: physicianRecruitmentDetails || {},
            51: psychRecruitmentDetails || {},
            52: adminRecruitmentDetails || {},
            53: nurseRecruitmentDetails || {},
            54: coronerRecruitmentDetails || {},
            55: emsRecruitmentDetails || {},
        };
        const recruitmentGroupMap = {
            50: "Physician",
            51: "Psych",
            52: "Admin",
            53: "Nurse",
            54: "Coroner",
            55: "EMS",
        };

    const overlayStyle = {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex',
        alignItems: 'flex-start', justifyContent: 'center', paddingTop: '5vh',
        zIndex: 1050, overflowY: 'auto',
    };

    const modalContentStyle = {
        backgroundColor: '#212529', color: '#f8f9fa', padding: '20px',
        borderRadius: '0.3rem', width: isMobile ? '90%' : '75%',
        maxWidth: '1140px', boxShadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.15)',
        position: 'relative', maxHeight: '90vh', display: 'flex',
        flexDirection: 'column',
    };

    const modalHeaderStyle = {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid #495057', paddingBottom: '10px', marginBottom: '15px',
    };
    const modalTitleStyle = { fontSize: '1.25rem', margin: 0 };
    const closeButtonStyle = {
        background: 'none', border: 'none', color: '#f8f9fa',
        fontSize: '1.5rem', lineHeight: 1, opacity: 0.75, cursor: 'pointer',
    };
    const modalBodyStyle = { overflowY: 'auto', flexGrow: 1 };

    // --- MODIFICATION HERE ---
    const formButtonStyleBase = {
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'flex-start', // Changed from space-around to flex-start
        paddingTop: '0.75rem',        // Ensure consistent padding
        paddingBottom: '0.75rem',     // Ensure consistent padding
        paddingLeft: '0.5rem',        // Horizontal padding
        paddingRight: '0.5rem',       // Horizontal padding
        textAlign: 'center', backgroundColor: '#343a40', color: '#f8f9fa',
        border: '1px solid #495057', borderRadius: '0.1rem',
        boxShadow: '0 0.125rem 0.25rem rgba(0, 0, 0, 0.075)',
        transition: 'transform 0.15s ease-in-out, background-color 0.15s ease-in-out',
        width: '100%',
        fontSize: '0.875rem',
    };
    // --- END MODIFICATION ---

    const gridContainerStyle = {
        display: 'flex', flexWrap: 'wrap', gap: '0.75rem',
    };

    const gridItemStyleBase = {
        boxSizing: 'border-box', display: 'flex', justifyContent: 'center',
    };

    const renderFormButtonElement = (form, formSpecificButtonProps) => {
        return (
            <Button
                variant="custom-dark"
                style={formSpecificButtonProps.style} // This style will be dynamically adjusted
                onMouseOver={(e) => {
                    if (formSpecificButtonProps.isRecruitmentForm) {
                        e.currentTarget.style.backgroundColor = formSpecificButtonProps.statusKnown
                            ? (formSpecificButtonProps.overallOpen ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)')
                            : 'rgba(108, 117, 125, 0.1)';
                    } else {
                        e.currentTarget.style.backgroundColor = '#495057';
                    }
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = formSpecificButtonProps.isRecruitmentForm
                        ? 'transparent'
                        : formButtonStyleBase.backgroundColor;
                }}
                onClick={() => handleAgencySelect(form.version)}
                title={formSpecificButtonProps.title}
            >
                <Image
                    src={form.icon} alt={form.name} fluid
                    style={{ maxHeight: '3.5rem', objectFit: 'contain', marginBottom: '0.25rem', width: 'auto' }}
                />
                <span className="text-break" style={{ marginBottom: '0.5rem' }}>{formSpecificButtonProps.text}</span> {/* Added margin-bottom */}

                {formSpecificButtonProps.isRecruitmentForm && formSpecificButtonProps.statusKnown && (
                    <>
                        {formSpecificButtonProps.openPositions.length > 0 && (
                            <div style={positionStatusListStyle}>
                                <strong style={openStatusStyle}>Open:</strong>
                                <ul style={{ paddingLeft: '15px', marginBlockStart: '0.2em', marginBlockEnd: '0.2em' }}>
                                    {formSpecificButtonProps.openPositions.slice(0, 3).map(pos => <li key={`open-${form.version}-${pos}`}>{pos}</li>)}
                                    {formSpecificButtonProps.openPositions.length > 3 && <li>...and more</li>}
                                </ul>
                            </div>
                        )}
                        {formSpecificButtonProps.closedPositions.length > 0 && (
                            <div style={positionStatusListStyle}>
                                <strong style={closedStatusStyle}>Closed:</strong>
                                <ul style={{ paddingLeft: '15px', marginBlockStart: '0.2em', marginBlockEnd: '0.2em' }}>
                                    {formSpecificButtonProps.closedPositions.slice(0, 3).map(pos => <li key={`closed-${form.version}-${pos}`}>{pos}</li>)}
                                    {formSpecificButtonProps.closedPositions.length > 3 && <li>...and more</li>}
                                </ul>
                            </div>
                        )}
                        {formSpecificButtonProps.openPositions.length === 0 && formSpecificButtonProps.closedPositions.length === 0 && (
                            <div style={{...positionStatusListStyle, textAlign: 'center', color: '#6c757d'}}>
                                No positions listed.
                            </div>
                        )}
                    </>
                )}
                {formSpecificButtonProps.isRecruitmentForm && !formSpecificButtonProps.statusKnown && (
                    <div style={{...positionStatusListStyle, textAlign: 'center', color: '#6c757d'}}>
                        {/* Status is unknown, text already updated by helper */}
                    </div>
                )}

                {/* PHMC Sub-Forms List - REMOVED
                {formSpecificButtonProps.subForms && formSpecificButtonProps.subForms.length > 0 && (
                    <div style={subFormListContainerStyle}>
                        <div style={subFormListHeaderStyle}>Related Forms:</div>
                        <ul style={subFormListStyle}>
                            {formSpecificButtonProps.subForms.map(subForm => (
                                <li key={`subform-${form.version}-${subForm.version}`} style={subFormListItemStyle}>
                                    {subForm.name.replace('[Civilian] ', '').replace('(PBC)', 'PBC Version')}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                */}
            </Button>
        );
    };

    return (
        <div style={overlayStyle} onClick={() => setShowAgencySelector(false)}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                                <div style={modalHeaderStyle}>
                    <h4 style={modalTitleStyle}>{getModalTitle()}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {userPreferences && (
                            <Button
                                variant={showPersonalizedForms ? "outline-primary" : "primary"}
                                size="sm"
                                onClick={() => setShowPersonalizedForms(!showPersonalizedForms)}
                                style={{
                                    fontSize: '0.75rem',
                                    padding: '0.25rem 0.5rem',
                                    minWidth: '80px'
                                }}
                            >
                                {showPersonalizedForms ? 'Show All' : 'Show My Forms'}
                            </Button>
                        )}
                        <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => setHideAgencySelector(true)}
                            style={{
                                fontSize: '0.75rem',
                                padding: '0.25rem 0.5rem'
                            }}
                        >
                            Hide Selector
                        </Button>
                        <button
                            type="button"
                            style={closeButtonStyle}
                            onClick={() => setShowAgencySelector(false)}
                            aria-label="Close selector"
                        >
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                </div>

                <div style={modalBodyStyle}>
                    {userPreferences && showPersonalizedForms && availableForms.length > 0 && (
                        <div style={{
                            backgroundColor: '#1a3a5c',
                            border: '1px solid #007bff',
                            borderRadius: '0.25rem',
                            padding: '0.75rem',
                            marginBottom: '1rem',
                            fontSize: '0.875rem',
                            color: '#e3f2fd'
                        }}>
                            <i className="fas fa-info-circle" style={{ marginRight: '0.5rem', color: '#007bff' }}></i>
                            Showing your personalized forms based on your onboarding preferences. 
                            <strong>Click "Show All"</strong> to see all available forms.
                        </div>
                    )}
                    {isMobile ? (
                        <Form.Select
                            aria-label={`Select a ${selectedAgencyGroup} form`}
                            onChange={(e) => { if (e.target.value) handleAgencySelect(parseInt(e.target.value)); }}
                            defaultValue="" className="bg-secondary text-white border-secondary mb-3"
                        >
                            <option value="" disabled>Select a {selectedAgencyGroup} form</option>
                            {availableForms.map(form => (
                                <option key={form.version} value={form.version}>{form.name}</option>
                            ))}
                        </Form.Select>
                    ) : (
                        <>
                                <div style={gridContainerStyle}>
                                    {availableForms.map(form => {
                                        let buttonDisplayProps = {
                                            text: form.name, title: form.name,
                                            style: { ...formButtonStyleBase },
                                            openPositions: [], closedPositions: [],
                                            isRecruitmentForm: false, overallOpen: false, statusKnown: true,
                                            subForms: [],
                                        };

                                        // Remove sub-forms grouping - show all forms individually
                                        // if (selectedAgencyGroup === 'PHMC' && phmcSubFormMap[form.version]) {
                                        //     const subFormVersions = phmcSubFormMap[form.version];
                                        //     const relatedSubForms = formDefinitions.filter(def =>
                                        //         subFormVersions.includes(def.version) && def.isHiddenInSelector
                                        //     ).map(sf => ({ version: sf.version, name: sf.name, icon: sf.icon }));

                                        //     if (relatedSubForms.length > 0) {
                                        //         buttonDisplayProps.subForms = relatedSubForms;
                                        //         buttonDisplayProps.style = {
                                        //             ...buttonDisplayProps.style,
                                        //             height: 'auto',
                                        //         };
                                        //     }
                                        // }

                                        // For PHMC Recruitment, set recruitment status props before rendering
                                        if (selectedAgencyGroup === 'PHMC Recruitment' && recruitmentDetailsMap[form.version]) {
                                            const details = recruitmentDetailsMap[form.version];
                                            const groupFilter = recruitmentGroupMap[form.version]; // Get the group filter
                                            buttonDisplayProps.isRecruitmentForm = true;
                                            buttonDisplayProps.openPositions = Object.values(details).filter(pos => pos.status === 'OPEN' && pos.group === groupFilter).map(pos => pos.displayName);
                                            buttonDisplayProps.closedPositions = Object.values(details).filter(pos => pos.status === 'CLOSED' && pos.group === groupFilter).map(pos => pos.displayName);
                                            buttonDisplayProps.statusKnown = Object.keys(details).length > 0;
                                            buttonDisplayProps.overallOpen = buttonDisplayProps.openPositions.length > 0;
                                        }

                                        let currentGridItemStyle = { ...gridItemStyleBase, flex: isMobile ? '1 0 48%' : '1 0 23%' };
                                        return (
                                            <div key={form.version} style={currentGridItemStyle}>
                                                {renderFormButtonElement(form, buttonDisplayProps)}
                                            </div>
                                        );
                                    })}
                                </div>
                        </>
                    )}
                    <div className="mt-4">
                        <Form.Check
                            type="checkbox" id="hideMainFormSelector"

                            label=" Don't show this popup again (for this session)"
                            checked={hideAgencySelector}
                            onChange={(e) => {
                                setHideAgencySelector(e.target.checked);
                                if (e.target.checked) setShowAgencySelector(false);
                            }}
                            className="text-muted"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AgencySelector;
