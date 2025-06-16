// src/components/PositionInfoModal.js
import React, { useState, useEffect } from 'react';
import { Button } from 'react-bootstrap';

// --- Styles (remain the same) ---
const modalStyle = {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1050,
};
const modalContentStyle = {
    backgroundColor: '#0d1117', color: '#c9d1d9', padding: '25px',
    borderRadius: '8px', width: '85%', maxWidth: '700px',
    maxHeight: '85vh', overflowY: 'auto', position: 'relative',
    border: '1px solid #30363d', boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
};
const modalHeaderStyle = {
    fontSize: '1.4em', fontWeight: 'bold', marginBottom: '15px',
    textAlign: 'center', borderBottom: '1px solid #30363d', paddingBottom: '15px',
};
const buttonContainerStyle = {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
    marginBottom: '20px',
};
const sectionButtonStyle = {
    backgroundColor: '#21262d',
    color: '#c9d1d9',
    border: '1px solid #30363d',
    padding: '8px 15px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.95em',
    transition: 'background-color 0.2s ease, border-color 0.2s ease',
};
const activeSectionButtonStyle = {
    ...sectionButtonStyle,
    backgroundColor: '#238636', // Green for active
    color: '#ffffff',
};
const contentDisplayStyle = {
    width: '95%',
    backgroundColor: '#161b22',
    color: '#c9d1d9',
    border: '1px solid #30363d',
    borderRadius: '5px',
    padding: '15px',
    fontSize: '0.95em',
    lineHeight: '1.6',
    marginBottom: '15px',
    fontFamily: 'Arial, sans-serif',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
};
const modalFooterStyle = {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '20px',
    paddingTop: '15px',
    borderTop: '1px solid #30363d',
};
const closeButtonStyle = {
    position: 'absolute', top: '15px', right: '15px', background: 'none',
    border: 'none', color: '#f85149', fontSize: '24px', cursor: 'pointer', lineHeight: '1',
};
// --- End Styles ---

const parseBoldMarkdown = (text) => {
    if (!text) return { __html: '' };

    let htmlText = text;

    // Handle [url]...[/url] tags
    // This regex captures the content between [url] and [/url]
    const urlRegex = /\[url\](.*?)\[\/url\]/g;
    htmlText = htmlText.replace(urlRegex, (match, urlContent) => {
        // Ensure the URL starts with http:// or https:// for it to be a valid href
        const properUrl = urlContent.startsWith('http://') || urlContent.startsWith('https://')
            ? urlContent
            : `http://${urlContent}`; // Prepend http:// if missing (optional, adjust as needed)
        return `<a href="${properUrl}" target="_blank" rel="noopener noreferrer">${urlContent}</a>`;
    });

    // Handle **bold** tags
    const boldRegex = /\*\*(.*?)\*\*/g;
    htmlText = htmlText.replace(boldRegex, '<b>$1</b>');

    // Handle newline characters
    htmlText = htmlText.replace(/\n/g, '<br />');

    return { __html: htmlText };
};

const PositionInfoModal = ({
    show,
    onClose,
    selectedPositionKey,
    positionData
}) => {
    const [displayMode, setDisplayMode] = useState('jobInfo');

    useEffect(() => {
        if (show) {
            setDisplayMode('jobInfo');
        }
    }, [show]);

    if (!show || !positionData) {
        return null;
    }

    const jobInformationContent = `**Position:** ${positionData.displayName || 'N/A'}

**Point of Contact:** ${positionData.poc || '[Placeholder: No contact provided]'}

**Overview:**
${positionData.Overview || '[Placeholder: No overview provided for this position.]'}

For more detailed information, please refer to the official posting:
[url]${positionData.url || 'No URL provided'}[/url]
    `;

    // --- MODIFIED skillsQualificationsContent ---
    const skillsQualificationsContent = `**Position:** ${positionData.displayName || 'N/A'}

**Required Skills:**
- ${positionData.skill1 || '[Placeholder: Skill 1 not specified]'}
- ${positionData.skill2 || '[Placeholder: Skill 2 not specified]'}
- ${positionData.skill3 || '[Placeholder: Skill 3 not specified]'}

**Educational Requirements:**
- ${positionData.EduRequirement || '[Placeholder: Education requirements not specified]'}

For more detailed information, please refer to the official posting:
[url]${positionData.url || 'No URL provided'}[/url]
    `;
    // --- END MODIFICATION ---

    let currentContent;
    switch (displayMode) {
        case 'skills':
            currentContent = skillsQualificationsContent;
            break;
        case 'jobInfo':
        default:
            currentContent = jobInformationContent;
            break;
    }

    const parsedHtmlContent = parseBoldMarkdown(currentContent);

    return (
        <div style={modalStyle} onClick={onClose}>
            <div
                style={modalContentStyle}
                className="position-info-modal-content"
                onClick={(e) => e.stopPropagation()}
            >
                <button onClick={onClose} style={closeButtonStyle} aria-label="Close modal">
                    &times;
                </button>
                <div style={modalHeaderStyle}>
                    Information for: {positionData.displayName || "Selected Position"}
                </div>

                <div style={buttonContainerStyle}>
                    <button
                        onClick={() => setDisplayMode('jobInfo')}
                        style={displayMode === 'jobInfo' ? activeSectionButtonStyle : sectionButtonStyle}
                    >
                        Job Information
                    </button>
                    <button
                        onClick={() => setDisplayMode('skills')}
                        style={displayMode === 'skills' ? activeSectionButtonStyle : sectionButtonStyle}
                    >
                        Skills & Qualifications
                    </button>
                </div>

                <div
                    style={contentDisplayStyle}
                    dangerouslySetInnerHTML={parsedHtmlContent}
                />

                <div style={modalFooterStyle}>
                    <Button variant="secondary" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default PositionInfoModal;
