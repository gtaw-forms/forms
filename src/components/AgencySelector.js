// src/components/AgencySelector.js
import React from 'react';
import { Button, Form, Image } from 'react-bootstrap';

// Style definitions (styles for subFormListContainerStyle etc. remain as before)
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

const subFormListContainerStyle = {
    fontSize: '0.75rem',
    marginTop: '0.5rem',
    textAlign: 'left',
    width: '90%',
    lineHeight: '1.2',
    alignSelf: 'stretch',
    color: '#adb5bd',
};
const subFormListHeaderStyle = {
    fontWeight: 'bold',
    color: '#ced4da',
    marginBottom: '0.15rem',
};
const subFormListStyle = {
    listStyleType: 'circle',
    paddingLeft: '15px',
    marginBlockStart: '0.2em',
    marginBlockEnd: '0.2em',
};
const subFormListItemStyle = {
    // No specific style needed
};

const phmcSubFormMap = {
    1: [2, 4],
    6: [7],
    14: [16],
    20: [21],
    22: [23],
    28: [29],
    27: [35],
};

const getSaaaRecruitmentButtonProps = (
    saaaDetails,
    baseStyle,
    baseText
) => {
    let overallRecruitmentOpen = false;
    let openPositionDetails = [];
    let closedPositionDetails = [];
    let allPositionsStatusMessages = [];
    const statusKnown = saaaDetails && typeof saaaDetails === 'object' && Object.keys(saaaDetails).length > 0;
    if (statusKnown) {
        Object.values(saaaDetails).forEach(position => {
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
    let buttonTitle = `SAAA Recruitment Status`;
    let dynamicStyle = { ...baseStyle };
    dynamicStyle.height = 'auto';
    dynamicStyle.minHeight = baseStyle.height || '8rem'; // Will use the updated baseStyle.height
    dynamicStyle.justifyContent = 'flex-start';
    dynamicStyle.paddingTop = '0.75rem';
    dynamicStyle.paddingBottom = '0.75rem';
    dynamicStyle.width = '100%';
    if (!statusKnown) {
        buttonText += " - Status Unknown";
        buttonTitle = `SAAA Recruitment status could not be loaded or is not configured.`;
        dynamicStyle.color = '#6c757d';
        dynamicStyle.borderColor = '#6c757d';
    } else if (overallRecruitmentOpen) {
        buttonText += ` - Open (${openPositionDetails.length})`;
        buttonTitle = `Open Positions for SAAA Recruitment: ${openPositionDetails.join(', ') || 'None'}\n\nAll Statuses:\n${allPositionsStatusMessages.join('\n')}`;
        dynamicStyle.color = '#28a745';
        dynamicStyle.borderColor = '#28a745';
    } else {
        buttonText += " - Closed";
        buttonTitle = `All SAAA Recruitment positions are currently closed or no open positions are listed.\n\nAll Statuses:\n${allPositionsStatusMessages.join('\n')}`;
        dynamicStyle.color = '#dc3545';
        dynamicStyle.borderColor = '#dc3545';
    }
    dynamicStyle.backgroundColor = 'transparent';
    return {
        text: buttonText, title: buttonTitle, style: dynamicStyle,
        openPositions: openPositionDetails, closedPositions: closedPositionDetails,
        overallOpen: overallRecruitmentOpen, statusKnown: statusKnown, isRecruitmentForm: true,
    };
};


const AgencySelector = ({
    showAgencySelector,
    setShowAgencySelector,
    handleAgencySelect,
    isMobile,
    hideAgencySelector,
    setHideAgencySelector,
    selectedAgencyGroup,
    formDefinitions,
    saaaRecruitmentDetails
}) => {
    if (!showAgencySelector || !selectedAgencyGroup) {
        return null;
    }

    const availableForms = formDefinitions
        .filter(form => form.group === selectedAgencyGroup && !form.name.includes('(PBC)') && !form.isHiddenInSelector)
        .sort((a, b) => {
            if (selectedAgencyGroup === 'SAAA') {
                if (a.titleKey === "saaaEntryJob" && b.titleKey !== "saaaEntryJob") return -1;
                if (a.titleKey !== "saaaEntryJob" && b.titleKey === "saaaEntryJob") return 1;
            }
            const orderA = a.sortOrder !== undefined ? a.sortOrder : Infinity;
            const orderB = b.sortOrder !== undefined ? b.sortOrder : Infinity;
            if (orderA !== orderB) return orderA - orderB;
            return a.name.localeCompare(b.name);
        });

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
        height: '11rem', // Increased height for all buttons
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

                {/* SAAA Recruitment Info */}
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

                {/* PHMC Sub-Forms List */}
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
            </Button>
        );
    };

    return (
        <div style={overlayStyle} onClick={() => setShowAgencySelector(false)}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                <div style={modalHeaderStyle}>
                    <h4 style={modalTitleStyle}>{selectedAgencyGroup} Form Selection ({availableForms.length})</h4>
                    <button type="button" style={closeButtonStyle} onClick={() => setShowAgencySelector(false)} aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>

                <div style={modalBodyStyle}>
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
                            {selectedAgencyGroup === 'SAAA' ? (
                                <div>
                                    {(() => {
                                        const saaaEntryJobForm = availableForms.find(form => form.titleKey === "saaaEntryJob");
                                        if (saaaEntryJobForm) {
                                            let buttonDisplayProps = {
                                                text: saaaEntryJobForm.name,
                                                title: saaaEntryJobForm.name,
                                                style: { ...formButtonStyleBase }, // Start with the (taller) base style
                                                openPositions: [], closedPositions: [],
                                                isRecruitmentForm: false, overallOpen: false, statusKnown: true,
                                                subForms: [],
                                            };
                                            const recruitmentProps = getSaaaRecruitmentButtonProps(
                                                saaaRecruitmentDetails,
                                                formButtonStyleBase, // Pass the new taller base style
                                                saaaEntryJobForm.name
                                            );
                                            // getSaaaRecruitmentButtonProps already sets height to 'auto' and minHeight
                                            buttonDisplayProps = { ...buttonDisplayProps, ...recruitmentProps };

                                            return (
                                                <div style={{ ...gridItemStyleBase, flex: '1 0 100%', marginBottom: '0.75rem' }}>
                                                    {renderFormButtonElement(saaaEntryJobForm, buttonDisplayProps)}
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                    <div style={gridContainerStyle}>
                                        {availableForms
                                            .filter(form => form.titleKey !== "saaaEntryJob")
                                            .map(form => {
                                                let buttonDisplayProps = {
                                                    text: form.name, title: form.name,
                                                    style: { ...formButtonStyleBase }, // Use the new taller base style
                                                    openPositions: [], closedPositions: [],
                                                    isRecruitmentForm: false, overallOpen: false, statusKnown: true,
                                                    subForms: [],
                                                };
                                                let currentGridItemStyle = { ...gridItemStyleBase, flex: '1 0 23%' };
                                                return (
                                                    <div key={form.version} style={currentGridItemStyle}>
                                                        {renderFormButtonElement(form, buttonDisplayProps)}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            ) : ( // PHMC and other groups
                                <div style={gridContainerStyle}>
                                    {availableForms.map(form => {
                                        let buttonDisplayProps = {
                                            text: form.name, title: form.name,
                                            style: { ...formButtonStyleBase }, // Use the new taller base style
                                            openPositions: [], closedPositions: [],
                                            isRecruitmentForm: false, overallOpen: false, statusKnown: true,
                                            subForms: [],
                                        };

                                        if (selectedAgencyGroup === 'PHMC' && phmcSubFormMap[form.version]) {
                                            const subFormVersions = phmcSubFormMap[form.version];
                                            const relatedSubForms = formDefinitions.filter(def =>
                                                subFormVersions.includes(def.version) && def.isHiddenInSelector
                                            ).map(sf => ({ version: sf.version, name: sf.name, icon: sf.icon }));

                                            if (relatedSubForms.length > 0) {
                                                buttonDisplayProps.subForms = relatedSubForms;
                                                // Adjust style for dynamic height if sub-forms are present
                                                buttonDisplayProps.style = {
                                                    ...buttonDisplayProps.style, // This already includes the taller base height
                                                    height: 'auto', // Allow it to grow
                                                    // minHeight is already effectively set by formButtonStyleBase.height
                                                    // justifyContent is already 'flex-start' from formButtonStyleBase
                                                    // paddingTop and paddingBottom are already in formButtonStyleBase
                                                };
                                            }
                                        }

                                        let currentGridItemStyle = { ...gridItemStyleBase, flex: isMobile ? '1 0 48%' : '1 0 23%' };
                                        return (
                                            <div key={form.version} style={currentGridItemStyle}>
                                                {renderFormButtonElement(form, buttonDisplayProps)}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
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
