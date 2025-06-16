// src/components/AgencyGroupSelectorModal.js
import React from 'react'; // Removed useEffect as it's not needed for this change
import { Button, Form, Image } from 'react-bootstrap';
import phmcLogo from '../assets/phmc.png';
import saaLogo from '../assets/saaa.png'; // Assuming SAAA logo is still relevant or can be a generic dev icon

// Helper function to process recruitment data for the button
const getRecruitmentSummary = (recruitmentSources) => {
    const summaries = [];
    let totalOpen = 0;
    let totalClosed = 0;
    let hasData = false;

    for (const groupName in recruitmentSources) {
        const details = recruitmentSources[groupName];
        if (details && typeof details === 'object' && Object.keys(details).length > 0) {
            hasData = true;
            let openCount = 0;
            let closedCount = 0;
            Object.values(details).forEach(position => {
                if (position.status === "OPEN") openCount++;
                if (position.status === "CLOSED") closedCount++;
            });
            if (openCount > 0 || closedCount > 0) { // Only add if there are positions
                summaries.push(`${groupName} (${openCount}O/${closedCount}C)`);
            }
            totalOpen += openCount;
            totalClosed += closedCount;
        }
    }

    if (!hasData || summaries.length === 0) {
        return "Recruitment (Status N/A)";
    }
};
const getRecruitmentSummaryData = (recruitmentSources) => {
    const groupSummaries = [];
    let overallTotalOpen = 0;
    let overallTotalClosed = 0;
    let hasAnyData = false;

    for (const groupName in recruitmentSources) {
        const details = recruitmentSources[groupName];
        if (details && typeof details === 'object' && Object.keys(details).length > 0) {
            hasAnyData = true;
            let groupOpenCount = 0;
            let groupClosedCount = 0;
            const positions = [];

            Object.values(details).forEach(position => {
                if (position.status === "OPEN") groupOpenCount++;
                if (position.status === "CLOSED") groupClosedCount++;
                positions.push({
                    name: position.displayName + (position.status === "CLOSED" ? " [CLOSED]" : ""), // MODIFICATION HERE
                    status: position.status || "N/A"
                });
            });

            if (positions.length > 0) { // Only add group if it has positions
                groupSummaries.push({
                    groupName,
                    openCount: groupOpenCount,
                    closedCount: groupClosedCount,
                    positions // Array of { name, status }
                });
            }
            overallTotalOpen += groupOpenCount;
            overallTotalClosed += groupClosedCount;
        }
    };

    if (!hasAnyData || groupSummaries.length === 0) {
        return {
            // overallSummaryText: "Recruitment (Status N/A)", // REMOVED
            overallTotalOpen: 0,
            overallTotalClosed: 0,
            groupDetails: [],
            hasData: false,
        };
    }

    return {
        overallTotalOpen, // ADDED
        overallTotalClosed, // ADDED
        groupDetails: groupSummaries,
        hasData: true,
    };
};

    const topButtonsContainerStyle = {
        display: 'flex',
        gap: '1.5rem', // Spacing between PHMC and SAAA buttons
        width: '100%',   // Take full width to allow children to flex
        marginBottom: '1.5rem', // Space below this row of buttons
    };

const AgencyGroupSelectorModal = ({
    show,
    onSelectGroup,
    onHideSelectorPreference,
    hidePreference,
    physicianRecruitmentDetails,
    psychRecruitmentDetails,
    adminRecruitmentDetails,
    emsRecruitmentDetails,
    nurseRecruitmentDetails,
    coronerRecruitmentDetails,
}) => {
    if (!show) {
        return null;
    }

    const isDevelopmentEnvironment =
        window.location.hostname === 'localhost' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.') ||
        window.location.hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./);

    const baseButtonStyle = {
        padding: '1rem',
        fontSize: '1.125rem',
        borderRadius: '0.375rem',
        width: '100%',
        marginBottom: '1rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '120px',
        backgroundColor: 'transparent',
        color: '#ffffff',
        border: '1px solid #ffffff',
        transition: 'color 0.2s ease-in-out, border-color 0.2s ease-in-out, background-color 0.2s ease-in-out',
    };

    const imageStyle = {
        maxHeight: '50px',
        marginBottom: '0.5rem',
        objectFit: 'contain',
    };
    const checkboxContainerStyle = {
        marginTop: '2rem',
        display: 'flex',
        justifyContent: 'center',
        width: '100%',
    };

    const labelStyle = {
        fontSize: '1rem',
        color: '#6b7280',
        verticalAlign: 'middle',
    };

    // Prepare data for the recruitment summary
    const phmcRecruitmentSources = {
        Physician: physicianRecruitmentDetails,
        Psych: psychRecruitmentDetails,
        Admin: adminRecruitmentDetails,
        EMS: emsRecruitmentDetails,
        Nursing: nurseRecruitmentDetails,
        Coroner: coronerRecruitmentDetails,
    };

    const recruitmentData = getRecruitmentSummaryData(phmcRecruitmentSources);

    // devButtonTitle now uses recruitmentData which is defined above
    // New styles for the detailed breakdown
    const summaryDetailContainerStyle = {
        display: 'flex',
        flexDirection: 'row', // Arrange groups side-by-side
        flexWrap: 'wrap',    // Allow wrapping if too many groups
        justifyContent: 'space-around', // Distribute space
        width: '100%',
        marginTop: '0.5rem',
        fontSize: '0.7rem', // Smaller font for details
        textAlign: 'left',
        color: '#adb5bd',
    };

    const summaryGroupColumnStyle = {
        // Change flex properties to aim for 3 columns
        flex: '0 0 32%', // Each item takes up roughly 32% of the container width
        // minWidth: '120px', // You can keep or adjust this if needed for very narrow containers
        maxWidth: '32%', // Ensure it doesn't grow beyond this
        padding: '0 5px',
        marginBottom: '0.5rem',
        boxSizing: 'border-box', // Important for percentage widths with padding
    };

    const summaryGroupHeaderStyle = {
        fontWeight: 'bold',
        color: '#ced4da',
        borderBottom: '1px solid #495057',
        marginBottom: '0.25rem',
        paddingBottom: '0.25rem',
        whiteSpace: 'nowrap', // Prevent header text from wrapping
        overflow: 'hidden',
        textOverflow: 'ellipsis', // Add ellipsis if header is too long
    };
    const summaryPositionListStyle = {
        listStyleType: 'none',
        paddingLeft: '0',
        margin: '0',
    };
    const summaryPositionItemOpenStyle = { color: '#28a745' };
    const summaryPositionItemClosedStyle = { color: '#dc3545' };
    const summaryPositionItemOtherStyle = { color: '#6c757d' };


    return (
        <div style={overlayStyle}>
            <div style={modalContentStyle}>
                 <div style={titleStyle}>Welcome!</div>
                <div style={textContainerStyle}>
                   Please select the set of forms you'd like to work with:

                </div>
                <div
                    className="d-flex flex-column align-items-center" // Stack button rows
                    style={{gap: '0rem'}} // No gap here, handled by marginBottom on topButtonsContainerStyle
                >
                    {/* Container for PHMC and SAAA buttons to be side-by-side */}
                    <div style={topButtonsContainerStyle}>
                        <Button
                            variant="outline-light"
                            // MODIFICATION: Adjust flex properties for side-by-side layout
                            style={{...baseButtonStyle, flex: '1 1 0', minWidth: '0', marginBottom: '0'}}
                            onClick={() => onSelectGroup('PHMC')}
                            className="agency-group-button-phmc" // Removed flex-sm-fill
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                            <Image src={phmcLogo} alt="PHMC Logo" style={imageStyle} />
                            PHMC Forms
                        </Button>
                        <Button
                            variant="outline-light"
                            // MODIFICATION: Adjust flex properties for side-by-side layout
                            style={{...baseButtonStyle, flex: '1 1 0', minWidth: '0', marginBottom: '0'}}
                            onClick={() => onSelectGroup('SAAA')}
                            className="agency-group-button-saaa" // Removed flex-sm-fill
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                            <Image src={saaLogo} alt="SAAA Logo" style={imageStyle} />
                            SAAA Forms
                        </Button>
                    </div>

                    {/* PHMC Recruitment (Development) Button - remains as is, will take full width of its parent */}
                    {isDevelopmentEnvironment && (
                        <Button
                            variant="outline-light"
                            style={{ // This button will take the full width of its parent by default
                                ...baseButtonStyle, // Keep existing base styles
                                fontSize: '0.9rem',
                                justifyContent: 'flex-start',
                                minHeight: '150px',
                                paddingTop: '0.5rem',
                                paddingBottom: '0.5rem',
                                // marginBottom is already in baseButtonStyle
                            }}
                            onClick={() => onSelectGroup('PHMC Recruitment')}
                            className="agency-group-button-dev" // Removed flex-sm-fill, width: 100% in baseButtonStyle handles it
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                            <Image src={phmcLogo} alt="Development Logo" style={{...imageStyle, maxHeight: '35px', marginBottom: '0.25rem'}} />
                            PHMC Recruitment
                            <span style={{ fontSize: '0.8rem', color: '#ced4da', marginTop: '0.25rem', display: 'block', width: '100%', textAlign: 'center' }}>
                                {recruitmentData.overallSummaryText}
                            </span>

                            {recruitmentData.hasData && recruitmentData.groupDetails.length > 0 && (
                                <div style={summaryDetailContainerStyle}>
                                    {recruitmentData.groupDetails.map(group => {
                                        const positionsToShow = 8;
                                        return (
                                            <div key={group.groupName} style={summaryGroupColumnStyle}>
                                                <div style={summaryGroupHeaderStyle} title={group.groupName}>
                                                    {group.groupName.length > 15 ? `${group.groupName.substring(0,13)}...` : group.groupName} 
                                                </div>
                                                <ul style={summaryPositionListStyle}>
                                                    {group.positions.slice(0, positionsToShow).map(pos => (
                                                        <li
                                                            key={pos.name}
                                                            style={
                                                                pos.status === "OPEN" ? summaryPositionItemOpenStyle :
                                                                pos.status === "CLOSED" ? summaryPositionItemClosedStyle :
                                                                summaryPositionItemOtherStyle
                                                            }
                                                            title={`${pos.name}: ${pos.status}`}
                                                        >
                                                            {pos.name}
                                                        </li>
                                                    ))}
                                                    {group.positions.length > positionsToShow && <li style={summaryPositionItemOtherStyle}>...more</li>}
                                                </ul>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {!recruitmentData.hasData && (
                                 <span style={{ fontSize: '0.7rem', color: '#6c757d', marginTop: '0.5rem', display: 'block', width: '100%', textAlign: 'center' }}>
                                    (Detailed status loading or unavailable)
                                </span>
                            )}
                        </Button>
                    )}
                </div>
                <div style={checkboxContainerStyle}>
                    <Form.Check
                        type="checkbox"
                        id="hideAgencyGroupSelector"
                        label={
                            <span style={labelStyle}>
                                Remember my choice and don't show this again.
                            </span>
                        }
                        checked={hidePreference}
                        onChange={(e) => onHideSelectorPreference(e.target.checked)}
                    />
                </div>
            </div>
        </div>
    );
};

// Styles (keep existing styles)
const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(31, 41, 55, 0.75)', overflowY: 'auto',
    height: '100%', width: '100%', zIndex: 1060,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const modalContentStyle = {
    position: 'relative', padding: '1.5rem', border: '1px solid #4b5563',
    width: 'auto', maxWidth: '40rem',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    borderRadius: '0.375rem', backgroundColor: '#111827',
    color: '#d1d5db', textAlign: 'center',
};
const titleStyle = {
    fontSize: '1.5rem', lineHeight: '1.5', fontWeight: 500,
    color: '#ffffff', marginTop: '0.75rem',
};
const textContainerStyle = {
    marginTop: '1rem', paddingLeft: '1.75rem', paddingRight: '1.75rem',
    paddingTop: '0.75rem', paddingBottom: '0.75rem',
};
const paragraphStyle = { fontSize: '1.125rem', color: '#9ca3af' };

export default AgencyGroupSelectorModal;
