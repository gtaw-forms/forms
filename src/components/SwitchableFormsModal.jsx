// src/components/SwitchableFormsModal.js
import React, { useEffect, useState } from 'react'; // Added useState
import { Button, Image } from 'react-bootstrap';
import { getPrimaryFormsForUserType } from '../formDefinitions';
import useFactionPermissions from '../hooks/useFactionPermissions';

// Style definitions (consistent with AgencySelector)
const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '5vh',
    zIndex: 1050, // Ensure it's above other content
    overflowY: 'auto',
};

const modalContentStyleBase = {
    backgroundColor: '#212529',
    color: '#f8f9fa',
    padding: '20px',
    borderRadius: '0.3rem',
    boxShadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.15)',
    position: 'relative',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
};

const modalHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #495057',
    paddingBottom: '10px',
    marginBottom: '15px',
};
const modalTitleStyle = { fontSize: '1.25rem', margin: 0, color: '#f8f9fa' };
const modalCloseButtonStyle = {
    background: 'none', border: 'none', color: '#f8f9fa',
    fontSize: '1.5rem', lineHeight: 1, opacity: 0.75, cursor: 'pointer',
};
const modalBodyStyle = { overflowY: 'auto', flexGrow: 1 };

const formButtonStyle = { // This is the base style for regular buttons
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: '0.75rem',
    height: '8rem', // Default height, recruitment button might need more
    textAlign: 'center',
    backgroundColor: '#343a40',
    color: '#f8f9fa',
    border: '1px solid #495057',
    borderRadius: '0.1rem',
    boxShadow: '0 0.125rem 0.25rem rgba(0, 0, 0, 0.075)',
    transition: 'transform 0.15s ease-in-out, background-color 0.15s ease-in-out',
    width: '100%',
    fontSize: '0.875rem',
};

const gridContainerStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
    justifyContent: 'center',
};

const gridItemStyleBase = {
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'center',
};

// Styles for the recruitment status list on the button
const positionStatusListStyle = {
    fontSize: '0.75rem',
    marginTop: '0.5rem',
    textAlign: 'left',
    width: '90%',
    lineHeight: '1.2',
    listStyleType: 'disc', // Added for ul
    paddingLeft: '15px',   // Added for ul
    marginBlockStart: '0.2em', // Added for ul
    marginBlockEnd: '0.2em',   // Added for ul
};
const openStatusStyle = { color: '#28a745', fontWeight: 'bold' };
const closedStatusStyle = { color: '#dc3545', fontWeight: 'bold' };

// Helper function (can be outside the component or imported)
const getRecruitmentButtonProps = (
    positionDetailsForGroup,
    baseStyle,
    baseText,
    groupDisplayName
) => {
    let overallRecruitmentOpen = false;
    let openPositionDetails = [];
    let closedPositionDetails = [];
    let allPositionsStatusMessages = [];

    // statusKnown will be false if positionDetailsForGroup is undefined, null, or an empty object
    const statusKnown = positionDetailsForGroup && typeof positionDetailsForGroup === 'object' && Object.keys(positionDetailsForGroup).length > 0;

    if (statusKnown) {
        Object.values(positionDetailsForGroup).forEach(position => {
            if (position.status === "OPEN") {
                overallRecruitmentOpen = true;
                openPositionDetails.push(position.displayName);
            } else if (position.status === "CLOSED") {
                closedPositionDetails.push(position.displayName);
            }
            allPositionsStatusMessages.push(`${position.displayName}: ${position.status || 'N/A'}`);
        });
    }

    let buttonText = baseText;
    let buttonTitle = `${groupDisplayName || 'Recruitment'} Status`;
    let dynamicStyle = { ...baseStyle };
    dynamicStyle.height = 'auto';
    dynamicStyle.minHeight = baseStyle.height || '8rem';
    dynamicStyle.justifyContent = 'flex-start';
    dynamicStyle.paddingTop = '0.75rem';
    dynamicStyle.paddingBottom = '0.75rem';

    if (!statusKnown) {
        buttonText += " - Status Unknown"; // Changed from "Status Data Missing"
        buttonTitle = `${groupDisplayName || 'Recruitment'} status could not be loaded or is not configured.`;
        dynamicStyle.color = '#6c757d';
        dynamicStyle.borderColor = '#6c757d';
    } else if (overallRecruitmentOpen) {
        buttonText += ` - Open (${openPositionDetails.length})`;
        buttonTitle = `Open Positions for ${groupDisplayName || 'Recruitment'}: ${openPositionDetails.join(', ') || 'None'}\n\nAll Statuses:\n${allPositionsStatusMessages.join('\n')}`;
        dynamicStyle.color = '#28a745';
        dynamicStyle.borderColor = '#28a745';
    } else {
        buttonText += " - Closed";
        buttonTitle = `All ${groupDisplayName || 'Recruitment'} positions are currently closed or no open positions are listed.\n\nAll Statuses:\n${allPositionsStatusMessages.join('\n')}`;
        dynamicStyle.color = '#dc3545';
        dynamicStyle.borderColor = '#dc3545';
    }
    dynamicStyle.backgroundColor = 'transparent';

    return {
        text: buttonText,
        title: buttonTitle,
        style: dynamicStyle,
        openPositions: openPositionDetails,
        closedPositions: closedPositionDetails,
        overallOpen: overallRecruitmentOpen,
        statusKnown: statusKnown, // This is important for rendering the lists
    };
};


const SwitchableFormsModal = ({
    show, onHide, title, forms, handleFormSelect, isMobile,
    physicianRecruitmentDetails,
    psychRecruitmentStatus, // Assuming this prop is correctly named and passed for Psych data
    adminRecruitmentDetails,
    emsRecruitmentDetails,
    nurseRecruitmentDetails, // This is the prop for Nursing data
    coronerRecruitmentDetails,
    formDefinitions,
    userPreferences // Add user preferences prop
}) => {
    const { factionInfo } = useFactionPermissions();
    // State to track whether to show personalized or all forms
    const [showPersonalizedForms, setShowPersonalizedForms] = useState(true);
    
    // Get recommended forms from user preferences or onboarding
    const getPersonalizedForms = () => {
        if (!userPreferences || !userPreferences.recommendedForms) {
            // If no user preferences, fall back to primary forms for user type
            if (userPreferences && userPreferences.userType) {
                const primaryForms = getPrimaryFormsForUserType(userPreferences.userType);
                return forms.filter(form => primaryForms.some(pf => pf.version === form.version));
            }
            return forms; // Show all if no preferences
        }
        
        // Filter forms based on recommended forms from onboarding
        return forms.filter(form => userPreferences.recommendedForms.includes(form.version));
    };
    
    // Determine which forms to show
    let formsToDisplay;
    if (showPersonalizedForms && userPreferences) {
        const personalizedForms = getPersonalizedForms();
        // Only use personalized forms if we have any, otherwise show all
        formsToDisplay = personalizedForms.length > 0 ? personalizedForms : forms;
    } else {
        formsToDisplay = forms;
    }
    
    // Filter forms based on user preferences (existing functionality)
    const filteredForms = userPreferences ? formsToDisplay.filter(form => {
        // If no userTypes specified on form, show to everyone
        if (!form.userTypes) return true;

        const hasRequiredFaction = !form.requiredFaction || (factionInfo && form.requiredFaction.includes(factionInfo.name));
        const hasRequiredRank = !form.requiredRank || (factionInfo && factionInfo.rank >= form.requiredRank);

        if (form.isPHMC && (!hasRequiredFaction || !hasRequiredRank)) {
            return false;
        }
        
        // Check if user's type is allowed for this form
        return form.userTypes.includes(userPreferences.userType);
    }) : formsToDisplay;
    
    // Reset to personalized view when modal opens
    useEffect(() => {
        if (show && userPreferences) {
            setShowPersonalizedForms(true);
        }
    }, [show, userPreferences]);
    // Log props when the modal is shown or relevant props change
    useEffect(() => {
        if (show) {
            // console.log('[SwitchableFormsModal Effect] Props received:', {
            //     physicianRecruitmentDetails,
            //     psychRecruitmentStatus,
            //     adminRecruitmentDetails,
            //     emsRecruitmentDetails,
            //     nurseRecruitmentDetails,
            //     coronerRecruitmentDetails,
            // });
        }
    }, [show, physicianRecruitmentDetails, psychRecruitmentStatus, adminRecruitmentDetails, emsRecruitmentDetails, nurseRecruitmentDetails, coronerRecruitmentDetails]);

    // Helper function to generate modal title
    const getModalTitle = () => {
        if (!userPreferences) {
            return `${title} (${filteredForms.length})`;
        }
        
        const baseTitle = title.replace(/^Select\\s+/, ''); // Remove "Select " prefix if present
        const modeText = showPersonalizedForms ? 'My' : 'All';
        return `${modeText} ${baseTitle} (${filteredForms.length})`;
    };

    if (!show || !filteredForms || filteredForms.length === 0) {
        return null;
    }

    const modalContentStyle = {
        ...modalContentStyleBase,
        width: isMobile ? '90%' : (filteredForms.length > 2 ? '75%' : '50%'),
        maxWidth: filteredForms.length > 3 ? '1140px' : (filteredForms.length > 2 ? '900px' : '600px'),
    };

    const gridItemStyle = {
        ...gridItemStyleBase,
        flex: isMobile ? '1 0 48%' :
              filteredForms.length === 1 ? '1 0 98%' :
              filteredForms.length === 2 ? '1 0 48%' :
              filteredForms.length === 3 ? '1 0 30%' :
              '1 0 23%',
    };

    return (
        <div style={modalOverlayStyle} onClick={onHide}>
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
                        <button
                            type="button"
                            style={modalCloseButtonStyle}
                            onClick={onHide}
                            aria-label="Close selector"
                        >
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                </div>
                <div style={modalBodyStyle}>
                    {userPreferences && showPersonalizedForms && filteredForms.length > 0 && (
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
                    <div style={gridContainerStyle}>
                        {filteredForms.map(form => {
                            let buttonDisplayProps = {
                                text: form.name,
                                title: form.name,
                                style: { ...formButtonStyle },
                                openPositions: [],
                                closedPositions: [],
                                isRecruitmentForm: false,
                                overallOpen: false,
                                statusKnown: true,
                            };

                            const definition = formDefinitions?.find(def => def.version === form.version);
                            const isRecruitmentGroupForm = definition?.group === "PHMC Recruitment";

                            if (isRecruitmentGroupForm) {
                                let currentRecruitmentDataSource;
                                let groupDisplayName = form.name; // Default to form name

                                if (definition?.titleKey === "phmcGeneralApplication") {
                                    currentRecruitmentDataSource = physicianRecruitmentDetails;
                                    groupDisplayName = "Physician Careers";
                                } else if (definition?.titleKey === "phmcPsychApplication") {
                                    currentRecruitmentDataSource = psychRecruitmentStatus;
                                    groupDisplayName = "Psychologist/Psychiatrist Careers";
                                } else if (definition?.titleKey === "phmcAdminApplication") {
                                    currentRecruitmentDataSource = adminRecruitmentDetails;
                                    groupDisplayName = "Admin Careers";
                                } else if (definition?.titleKey === "phmcEMSApplication") {
                                    currentRecruitmentDataSource = emsRecruitmentDetails;
                                    groupDisplayName = "EMS Careers";
                                } else if (definition?.titleKey === "phmcNursingApplication") {
                                    currentRecruitmentDataSource = nurseRecruitmentDetails;
                                    groupDisplayName = "Nursing Careers";
                                } else if (definition?.titleKey === "phmcCoronerRecruitmentApplication") {
                                    currentRecruitmentDataSource = coronerRecruitmentDetails;
                                    groupDisplayName = "Coroner Careers";
                                }

                                // Only call getRecruitmentButtonProps if currentRecruitmentDataSource is defined
                                // and it's an object (even if empty, getRecruitmentButtonProps handles that)
                                if (currentRecruitmentDataSource !== undefined && typeof currentRecruitmentDataSource === 'object') {
                                    const recruitmentProps = getRecruitmentButtonProps(
                                        currentRecruitmentDataSource,
                                        formButtonStyle,
                                        form.name,
                                        groupDisplayName
                                    );
                                    buttonDisplayProps = {
                                        ...buttonDisplayProps,
                                        ...recruitmentProps,
                                        isRecruitmentForm: true,
                                    };
                                } else if (currentRecruitmentDataSource === undefined) {
                                    // This is the case that was causing critical logs.
                                    // We still mark it as a recruitment form for styling, but acknowledge status is unknown.
                                    buttonDisplayProps.text = `${form.name} - Status Unknown`;
                                    buttonDisplayProps.title = `${groupDisplayName} status could not be loaded or is not configured.`;
                                    buttonDisplayProps.style = {
                                        ...formButtonStyle,
                                        height: 'auto',
                                        minHeight: formButtonStyle.height || '8rem',
                                        justifyContent: 'flex-start',
                                        paddingTop: '0.75rem',
                                        paddingBottom: '0.75rem',
                                        color: '#6c757d',
                                        borderColor: '#6c757d',
                                        backgroundColor: 'transparent',
                                    };
                                    buttonDisplayProps.isRecruitmentForm = true; // Still treat as recruitment for hover, etc.
                                    buttonDisplayProps.statusKnown = false; // Explicitly set statusKnown to false
                                    // console.warn( // Changed to warn for undefined data source
                                    //     `[SwitchableFormsModal] WARN: currentRecruitmentDataSource for ${groupDisplayName} (titleKey: ${definition?.titleKey}) ` +
                                    //     `is UNDEFINED. This might indicate a missing prop or incorrect data structure.`
                                    // );
                                }
                            }


                            return (
                                <div key={form.version} style={gridItemStyle}>
                                    <Button
                                        variant="custom-dark"
                                        style={buttonDisplayProps.style}
                                        onMouseOver={(e) => {
                                            if (buttonDisplayProps.isRecruitmentForm) {
                                                e.currentTarget.style.backgroundColor = buttonDisplayProps.statusKnown
                                                    ? (buttonDisplayProps.overallOpen ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)')
                                                    : 'rgba(108, 117, 125, 0.1)';
                                            } else {
                                                e.currentTarget.style.backgroundColor = '#495057';
                                            }
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.backgroundColor = buttonDisplayProps.isRecruitmentForm
                                                ? 'transparent'
                                                : formButtonStyle.backgroundColor;
                                        }}
                                        onClick={() => handleFormSelect(form.version)}
                                        title={buttonDisplayProps.title}
                                    >
                                        <Image
                                            src={form.icon}
                                            alt={form.name}
                                            fluid
                                            style={{ maxHeight: '3.5rem', objectFit: 'contain', marginBottom: '0.25rem', width: 'auto' }}
                                        />
                                        <span className="text-break">{buttonDisplayProps.text}</span>

                                        {buttonDisplayProps.isRecruitmentForm && buttonDisplayProps.statusKnown && (
                                            <>
                                                {buttonDisplayProps.openPositions.length > 0 && (
                                                    <div style={{...positionStatusListStyle, alignSelf: 'stretch'}}>
                                                        <strong style={openStatusStyle}>Open:</strong>
                                                        <ul style={{ paddingLeft: '15px', marginBlockStart: '0.2em', marginBlockEnd: '0.2em' }}>
                                                            {buttonDisplayProps.openPositions.slice(0, 9).map(pos => <li key={`open-${form.version}-${pos}`}>{pos}</li>)}
                                                            {buttonDisplayProps.openPositions.length > 9 && <li>...and more</li>}
                                                        </ul>
                                                    </div>
                                                )}
                                                {buttonDisplayProps.closedPositions.length > 0 && (
                                                    <div style={{...positionStatusListStyle, alignSelf: 'stretch'}}>
                                                        <strong style={closedStatusStyle}>Closed:</strong>
                                                        <ul style={{ paddingLeft: '15px', marginBlockStart: '0.2em', marginBlockEnd: '0.2em' }}>
                                                            {buttonDisplayProps.closedPositions.slice(0, 3).map(pos => <li key={`closed-${form.version}-${pos}`}>{pos}</li>)}
                                                            {buttonDisplayProps.closedPositions.length > 3 && <li>...and more</li>}
                                                        </ul>
                                                    </div>
                                                )}
                                                {buttonDisplayProps.openPositions.length === 0 && buttonDisplayProps.closedPositions.length === 0 && (
                                                     <div style={{...positionStatusListStyle, textAlign: 'center', color: '#6c757d', alignSelf: 'stretch'}}>
                                                        No positions listed.
                                                    </div>
                                                )}
                                            </>
                                        )}
                                         {buttonDisplayProps.isRecruitmentForm && !buttonDisplayProps.statusKnown && (
                                             <div style={{...positionStatusListStyle, textAlign: 'center', color: '#6c757d', alignSelf: 'stretch'}}>
                                                {/* Text is already "Status Unknown" from getRecruitmentButtonProps, so this div might just be for spacing or additional info if needed */}
                                            </div>
                                         )}
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SwitchableFormsModal;
