import React, { useState, useEffect } from 'react';
import coroner from '../assets/county-coroner.png';

// --- Styles ---
// ... (Keep other styles: modalStyle, modalContentStyle, etc.) ...
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
const logoStyle = {
    display: 'block', margin: '10px auto 15px auto', maxWidth: '350px', height: 'auto',
};
const buttonContainerStyle = {
    display: 'flex',
    justifyContent: 'center', // Center the buttons
    gap: '10px', // Add space between buttons
    marginBottom: '20px', // Increased space below buttons
};
const sectionButtonStyle = {
    backgroundColor: '#21262d', // Darker, inactive background
    color: '#c9d1d9', // Light text
    border: '1px solid #30363d',
    padding: '8px 15px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.95em',
    transition: 'background-color 0.2s ease, border-color 0.2s ease', // Smooth transition
};
const activeSectionButtonStyle = {
    ...sectionButtonStyle, // Inherit base styles
    backgroundColor: '#238636', // Green background for active
    color: '#ffffff', // White text for active
    borderColor: '#30363d', // Keep border consistent or make slightly brighter if desired
};
const contentDisplayStyle = {
    width: '96%',
    // minHeight: '300px', // <-- REMOVED this line
    backgroundColor: '#161b22',
    color: '#c9d1d9',
    border: '1px solid #30363d',
    borderRadius: '5px',
    padding: '8px 9px',
    fontSize: '0.95em',
    lineHeight: '1.3',
    marginBottom: '20px',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word', // Use overflowWrap instead of wordWrap
};

// --- Updated Footer Style ---
const modalFooterStyle = {
    display: 'flex',
    justifyContent: 'flex-end', // Keep items to the right
    alignItems: 'center', // Align items vertically
    marginTop: '20px',
    paddingTop: '15px',
    borderTop: '1px solid #30363d',
    gap: '8px', // Adjust gap for checkbox
};
// --- End Updated Footer Style ---

// --- Style for the label text ---
const footerLabelStyle = {
    fontSize: '0.9em',
    color: '#8b949e', // Dimmer color like helper text
    cursor: 'pointer', // Make label clickable to toggle checkbox
    userSelect: 'none', // Prevent text selection on click
};
// --- End Label Style ---

// --- Style for the checkbox ---
const checkboxStyle = {
    cursor: 'pointer',
    width: '16px', // Adjust size as needed
    height: '16px', // Adjust size as needed
    accentColor: '#6e7681', // Match the old button color for the checkmark
};
// --- End Checkbox Style ---

const closeButtonStyle = {
    position: 'absolute', top: '15px', right: '15px', background: 'none',
    border: 'none', color: '#f85149', fontSize: '24px', cursor: 'pointer', lineHeight: '1',
};
// --- End Styles ---

const LOCAL_STORAGE_KEY = 'hideCoronerTipsModal';

// --- Content Definitions (Keep as they are) ---
const tipsContent = `Welcome to the Coroner Information Page

**Basic Information**
- If your name is missing from this website, click the 'Missing Employee Data' button.
- Handbooks can be located here: https://phmc.gta.world/viewtopic.php?t=3930

**Radio Handling **
- The highest rank on duty will usually handle the radio.
- You can /setdep (faction) and /dep to reply to factions.
- Example: /setdep LSPD | /dep Coroner's Office, you have a unit dispatched, ETA is 5 minutes.
- If you NPC a unit, inform the LEOs that the unit is NPC'd and tell them to /sendtomorgue.

More tips coming soon!`;

const commandsContent = `**Duty Commands:**
/cduty | /duty - Go on/off duty as Coroner.
/trunk - Opens the trunk
/ctrunk | /cremove - Stores a body into the trunk, removes a body from the trunk.
/cdrag - Drag a body to the Coroner Van - NOTE: You must right click to stop dragging otherwise you become a space ship
/cdamages | /cexamine | /cdna - Examine the decedent for damages, DNA, and body attributes.
/cloot - Check the decedent's for items on the body.

**Roleplay Commands:**
/createscene - Creates a AOE /do for others to see.
/rb - Spawns a item on the ground, you can use Legal Factions - Gurney or Bodybag.
More commands coming soon!`;

const sceneInfoContent = `**Initial Approach:**
<ul>- Ensure the scene is secure before entering.
- Observe the overall scene layout without disturbing evidence.
- Identify the handling Law Enforcement Officer and ask to be cleared to move the body.</ul>**Documentation:**
<ul>- Take brief notes of the scene and fill out the Brief Summary as you go.
- Photograph important details (/camera): (Decedent, blood splatters or pools, evidence).</ul>**Decedent Examination (On Scene):**
<ul>- Note the decedent's position and attire.
- Examine the Decedent and determine the causes of death (/cdamages & /cdna - Take a screenshot of this as you'll need it for report).
- Check for identification, personal effects (/cloot).</ul>**Evidence Handling:**
<ul>- Do not move any evidence prior to collecting photographs.
- If evidence must be moved, document its original location first.
- Inform LEOs if firearms/drugs are located, if none present, store in the Evidence Locker (/el).</ul>**Final Steps:**
<ul>- Move the Decedent to the Coroner Van (/cdrag). When at the van, right click to stop dragging and (/ctrunk) to store the Decedent inside.
- Return to the Morgue and open the trunk (/trunk) and take the Decedent out (/cremove) and place them into the morgue (/cmorgue).
- Fill out the Decedent Report and file it on the forums.
`;
// --- End Content ---

// --- Helper function to parse simple markdown-like bold ---
const parseBoldMarkdown = (text) => {
    const boldRegex = /\*\*(.*?)\*\*/g;
    const htmlText = text.replace(boldRegex, '<b>$1</b>');
    return { __html: htmlText };
};
// --- End Helper Function ---

const CoronerTipsModal = ({ show, onClose }) => {
    const [displayMode, setDisplayMode] = useState('tips');
    const [dontShowAgain, setDontShowAgain] = useState(false);

    useEffect(() => {
        if (show) {
            // Check localStorage when the modal becomes visible
            const shouldHidePermanently = localStorage.getItem(LOCAL_STORAGE_KEY) === 'true';
            setDontShowAgain(shouldHidePermanently); // Set checkbox state based on storage
            setDisplayMode('tips'); // Reset content view
        }
    }, [show]); // Run when the 'show' prop changes

    const handleDontShowAgainChange = (event) => {
        const isChecked = event.target.checked;
        setDontShowAgain(isChecked); // Update the state immediately

        try {
            if (isChecked) {
                localStorage.setItem(LOCAL_STORAGE_KEY, 'true');
                // Optionally close the modal immediately when checked, or wait for user to close
                // onClose();
            } else {
                // If unchecked, remove the item from localStorage
                localStorage.removeItem(LOCAL_STORAGE_KEY);
            }
        } catch (error) {
            console.error("Failed to update localStorage item:", error);
            // Revert state if localStorage fails? Optional.
            // setDontShowAgain(!isChecked);
        }
    };

    const handleClose = () => {
        onClose();
    };

    if (!show) {
        return null;
    }

    let currentContent;
    switch (displayMode) {
        // ... switch cases ...
        case 'commands':
            currentContent = commandsContent;
            break;
        case 'scene':
            currentContent = sceneInfoContent;
            break;
        case 'tips':
        default:
            currentContent = tipsContent;
            break;
    }

    const parsedHtmlContent = parseBoldMarkdown(currentContent);

    return (
        <div style={modalStyle} onClick={handleClose}>
            <div
                style={modalContentStyle}
                className="coroner-tips-modal-content"
                onClick={(e) => e.stopPropagation()}
            >
                <button onClick={handleClose} style={closeButtonStyle} aria-label="Close modal">
                    &times;
                </button>
                <div style={modalHeaderStyle}>
                    Coroner Quick Reference Guide
                </div>
                <img src={coroner} alt="Coroner Logo" style={logoStyle} />

                <div style={buttonContainerStyle}>
                    {/* ... section buttons ... */}
                     <button
                        onClick={() => setDisplayMode('tips')}
                        style={displayMode === 'tips' ? activeSectionButtonStyle : sectionButtonStyle}
                    >
                        Tips & Tricks
                    </button>
                    <button
                        onClick={() => setDisplayMode('commands')}
                        style={displayMode === 'commands' ? activeSectionButtonStyle : sectionButtonStyle}
                    >
                        Useful Commands
                    </button>
                    <button
                        onClick={() => setDisplayMode('scene')}
                        style={displayMode === 'scene' ? activeSectionButtonStyle : sectionButtonStyle}
                    >
                        Scene Handling Summary
                    </button>
                </div>

                <div
                    style={contentDisplayStyle}
                    dangerouslySetInnerHTML={parsedHtmlContent}
                />

                {/* --- Updated Footer with Checkbox --- */}
                <div style={modalFooterStyle}>
                    <label htmlFor="dontShowAgainCheckbox" style={footerLabelStyle}>
                        Don't show this again automatically?
                    </label>
                    <input
                        type="checkbox"
                        id="dontShowAgainCheckbox"
                        checked={dontShowAgain} // <-- Control checked state
                        onChange={handleDontShowAgainChange} // <-- Use updated handler
                        style={checkboxStyle}
                        title="Prevent this modal from showing automatically" // Updated title
                    />
                </div>
                {/* --- End Updated Footer --- */}
            </div>
        </div>
    );
};

export default CoronerTipsModal;