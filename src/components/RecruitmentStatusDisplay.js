// src/components/RecruitmentStatusDisplay.js
import React from 'react';

const RecruitmentStatusDisplay = ({
    selectedAgencyGroup,
    bbCodeVersion, // To determine which specific section to highlight if needed
    physicianRecruitmentDetails,
    psychRecruitmentDetails,
    adminRecruitmentDetails, // For Admin Careers
    emsRecruitmentDetails,   // For EMS Careers
    nurseRecruitmentDetails, // For Nursing Careers
    coronerRecruitmentDetails, // For Coroner Careers - NEW PROP
    saaaRecruitmentDetails,
    // Add other recruitment data props here as they become available
}) => {
    let mainTitle = "Recruitment Overview";
    let sectionsToShow = [];

    // Determine which recruitment data and title to use
    if (selectedAgencyGroup === 'PHMC Recruitment') {
        let allPhmcSections = [];
        allPhmcSections.push({
            title: "Physician Careers",
            data: physicianRecruitmentDetails,
            groupFilter: "Physician",
            isActive: bbCodeVersion === 50,
        });
        allPhmcSections.push({
            title: "Psychologist/Psychiatrist Careers",
            data: psychRecruitmentDetails,
            groupFilter: "Psych",
            isActive: bbCodeVersion === 51,
        });
        allPhmcSections.push({
            title: "Admin Careers",
            data: adminRecruitmentDetails,
            groupFilter: "Admin",
            isActive: bbCodeVersion === 52,
        });
        allPhmcSections.push({
            title: "Nursing Careers",
            data: nurseRecruitmentDetails,
            groupFilter: "Nurse",
            isActive: bbCodeVersion === 53, // Assuming 53 is for Nursing
        });
        allPhmcSections.push({ // ADDED CORONER SECTION
            title: "Coroner Careers",
            data: coronerRecruitmentDetails,
            groupFilter: "Coroner",
            isActive: bbCodeVersion === 54, // Assuming 54 is for Coroner Recruitment
        });
        allPhmcSections.push({
            title: "EMS Careers",
            data: emsRecruitmentDetails,
            groupFilter: "EMS",
            isActive: bbCodeVersion === 55, // Assuming 55 is for EMS
        });


        const activeSection = allPhmcSections.find(s => s.isActive);

        if (activeSection) {
            mainTitle = `${activeSection.title} Status`;
            sectionsToShow = [activeSection];
        } else {
            mainTitle = "PHMC Recruitment Overview";
            sectionsToShow = allPhmcSections;
        }

    } else if (selectedAgencyGroup === 'SAAA') {
        mainTitle = "SAAA Recruitment Status";
        sectionsToShow.push({
            title: "SAAA Careers", // SAAA section title
            data: saaaRecruitmentDetails,
            groupFilter: "SAAA",
            isActive: true,
        });
    } else {
        return null;
    }

    sectionsToShow = sectionsToShow.filter(section => section.data && Object.keys(section.data).length > 0);

    if (sectionsToShow.length === 0) {
        return (
            <div className="recruitment-status-box" style={styles.statusBoxBase}>
                <h5 style={{...styles.mainTitleStyle, borderColor: selectedAgencyGroup === 'SAAA' ? '#0dcaf0' : '#495057', color: selectedAgencyGroup === 'SAAA' ? '#0dcaf0' : '#f8f9fa'}}>
                    {mainTitle}
                </h5>
                <p style={styles.noDataText}>No recruitment data available for this group or category.</p>
            </div>
        );
    }

    return (
        <div
            className="recruitment-status-box"
            style={{
                ...styles.statusBoxBase,
                borderColor: selectedAgencyGroup === 'SAAA' ? '#0dcaf0' : '#495057',
            }}
        >
            <h5 style={{
                ...styles.mainTitleStyle,
                borderColor: selectedAgencyGroup === 'SAAA' ? '#0dcaf0' : '#495057',
                color: selectedAgencyGroup === 'SAAA' ? '#0dcaf0' : '#f8f9fa',
            }}>
                {mainTitle}
            </h5>

            {sectionsToShow.map((section, index) => {
                if (!section.data || Object.keys(section.data).length === 0) {
                    return null;
                }

                const positions = Object.values(section.data).filter(pos => pos.group === section.groupFilter);
                const openPositions = positions.filter(pos => pos.status === "OPEN");
                const closedPositions = positions.filter(pos => pos.status === "CLOSED");

                // Conditionally apply marginTop only if it's not the first section AND there are multiple sections
                const sectionStyle = (index > 0 && sectionsToShow.length > 1) ? { marginTop: '1.5rem' } : {};

                if (positions.length === 0) {
                    return (
                        // Only show section title if there are multiple sections to display (overview mode)
                        sectionsToShow.length > 1 ? (
                            <div key={section.title} style={sectionStyle}>
                                <h6 style={styles.sectionTitleStyle}>{section.title}:</h6>
                                <p style={styles.noDataText}>No positions currently listed or status is not set for this category.</p>
                            </div>
                        ) : (
                            // If it's the only section and has no positions, the main "No recruitment data" message handles it.
                            // Or, if you want to be explicit even for a single section with no positions:
                            <div key={section.title} style={sectionStyle}>
                                 {/* Optionally, if mainTitle doesn't cover it and it's the ONLY section */}
                                 {/* <h6 style={styles.sectionTitleStyle}>{section.title}:</h6> */}
                                <p style={styles.noDataText}>No positions currently listed or status is not set for this category.</p>
                            </div>
                        )
                    );
                }

                return (
                    <div key={section.title} style={sectionStyle}>
                        {/* Only show individual section title if there's more than one section being displayed */}
                        {sectionsToShow.length > 1 && (
                            <h6 style={styles.sectionTitleStyle}>{section.title}:</h6>
                        )}
                        {openPositions.length > 0 && (
                            <div style={{ marginBottom: '0.5rem' }}>
                                <strong style={styles.openStrong}>Open Positions:</strong>
                                <ul style={styles.listStyle}>
                                    {openPositions.map(pos => (
                                        <li key={`${section.title}-open-${pos.displayName}`} style={styles.listItemStyle}>
                                            <span style={styles.openSpan}>{pos.displayName}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {closedPositions.length > 0 && (
                            <div>
                                <strong style={styles.closedStrong}>Closed Positions:</strong>
                                <ul style={styles.listStyle}>
                                    {closedPositions.map(pos => (
                                        <li key={`${section.title}-closed-${pos.displayName}`} style={{ ...styles.listItemStyle, color: '#dc3545' }}>
                                            {pos.displayName} (Applications Closed)
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {openPositions.length === 0 && closedPositions.length === 0 && (
                             <p style={styles.noDataText}>All positions are currently neither explicitly open nor closed, or status is not set for {section.title}.</p>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// Basic styles (can be moved to a CSS file)
const styles = {
    statusBoxBase: {
        marginBottom: '2.5rem',
        padding: '1rem',
        borderRadius: '0.3rem',
        backgroundColor: '#2c3034',
        color: '#f8f9fa',
        border: '1px solid', // Base border, color set dynamically
    },
    mainTitleStyle: {
        borderBottom: '1px solid', // Border color set dynamically
        paddingBottom: '0.5rem',
        marginBottom: '1rem',
    },
    sectionTitleStyle: {
        color: '#6cb2eb', // Light blue for section titles
        fontWeight: 'bold',
        marginBottom: '0.5rem',
    },
    listStyle: {
        listStyleType: 'disc',
        paddingLeft: '20px',
        marginBlockStart: '0.3em',
        fontSize: '0.9em',
    },
    listItemStyle: {
        marginBottom: '0.2rem',
    },
    openStrong: { color: '#28a745' },
    openSpan: { color: '#28a745' },
    closedStrong: { color: '#dc3545' },
    noDataText: {
        color: '#6c757d',
        fontSize: '0.9em',
        marginLeft: '20px',
    },
};

export default RecruitmentStatusDisplay;
