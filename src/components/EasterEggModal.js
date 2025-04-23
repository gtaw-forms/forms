import React from 'react';
import { Button } from 'react-bootstrap'; // Keep Button if you use it, otherwise remove

// --- Styles copied from App.js ---
const easterEggModalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)', // Semi-transparent background
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1051, // Ensure it's higher than other potential modals
};

const easterEggModalContentStyle = {
    backgroundColor: '#0d1117', // Dark background to match theme
    color: '#c9d1d9',           // Light text
    padding: '20px',
    borderRadius: '8px',        // Slightly rounded corners
    width: '90%',               // Responsive width
    maxWidth: '500px',          // Max width for larger screens
    maxHeight: '80vh',          // Limit height
    overflowY: 'auto',          // Allow scrolling if content is tall
    position: 'relative',       // Needed for absolute positioning of close button
    border: '1px solid #30363d', // Subtle border
    boxShadow: '0 5px 15px rgba(0,0,0,0.3)', // Add a shadow for depth
    textAlign: 'center'         // Center content inside the modal body
};

const easterEggModalHeaderStyle = {
    fontSize: '1.3em',
    fontWeight: 'bold',
    marginBottom: '15px',
    borderBottom: '1px solid #30363d',
    paddingBottom: '10px',
    color: '#c9d1d9',
    display: 'flex',            // Use flexbox for alignment
    justifyContent: 'space-between', // Space out title and close button
    alignItems: 'center'        // Vertically align items
};

const easterEggModalTitleStyle = {
    margin: 0, // Remove default margin
};

const easterEggCloseButtonStyle = { // Style for the close button
    background: 'none',
    border: 'none',
    color: '#c9d1d9',
    fontSize: '24px',
    cursor: 'pointer',
    lineHeight: '1',
    padding: '0 5px',
};

const easterEggModalBodyStyle = {
    paddingTop: '10px',
    // textAlign is now handled by easterEggModalContentStyle
};

const easterEggModalFooterStyle = {
    borderTop: '1px solid #30363d',
    paddingTop: '15px',
    marginTop: '20px',
    display: 'flex',
    justifyContent: 'flex-end', // Align button to the right
    gap: '10px',
};
// --- End Styles ---

const EasterEggModal = ({ show, onHide }) => {
    if (!show) {
        return null;
    }

    return (
        // Apply the overlay style to the outer div
        <div style={easterEggModalOverlayStyle} onClick={onHide}>
            {/* Apply the content style to the inner div, stop propagation */}
            <div style={easterEggModalContentStyle} onClick={e => e.stopPropagation()}>
                {/* Apply header styles */}
                <div style={easterEggModalHeaderStyle}>
                    <h5 style={easterEggModalTitleStyle}>🎉 GRASS DLC: UNLOCKED! 🎉</h5>
                    {/* Simple close button using the style */}
                    <button onClick={onHide} style={easterEggCloseButtonStyle} aria-label="Close modal">
                        &times;
                    </button>
                </div>

                {/* Apply body styles */}
                <div style={easterEggModalBodyStyle}>
                    <p>Okay we need to have a talk</p>
                    <img
                        src="https://media1.tenor.com/m/cXYPZhsqJlkAAAAC/chien-perplexe.gif" // Example GIF
                        alt="Easter Egg"
                        style={{ maxWidth: '100%', height: 'auto', marginTop: '15px', borderRadius: '5px' }}
                    />
                    <p style={{ marginTop: '15px', fontSize: '0.9em' }}>
                        Your love for paperwork concerns me... thanks for the hard work though! 
                    </p>
                </div>

                {/* Apply footer styles */}
                <div style={easterEggModalFooterStyle}>
                    <Button variant="secondary" onClick={onHide}>
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default EasterEggModal;
