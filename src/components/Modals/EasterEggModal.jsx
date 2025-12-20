import React from 'react';
import { Button } from 'react-bootstrap';

// --- Styles (Keep existing styles) ---
const easterEggModalOverlayStyle = {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1051,
};
const easterEggModalContentStyle = {
    backgroundColor: '#0d1117', color: '#c9d1d9', padding: '20px',
    borderRadius: '8px', width: '90%', maxWidth: '500px',
    maxHeight: '80vh', overflowY: 'auto', position: 'relative',
    border: '1px solid #30363d', boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
    textAlign: 'center'
};
const easterEggModalHeaderStyle = {
    fontSize: '1.3em', fontWeight: 'bold', marginBottom: '15px',
    borderBottom: '1px solid #30363d', paddingBottom: '10px',
    color: '#c9d1d9', display: 'flex', justifyContent: 'space-between',
    alignItems: 'center'
};
const easterEggModalTitleStyle = { margin: 0 };
const easterEggCloseButtonStyle = {
    background: 'none', border: 'none', color: '#c9d1d9',
    fontSize: '24px', cursor: 'pointer', lineHeight: '1', padding: '0 5px',
};
const easterEggModalBodyStyle = { paddingTop: '10px' };
const easterEggModalFooterStyle = {
    borderTop: '1px solid #30363d', paddingTop: '15px', marginTop: '20px',
    display: 'flex', justifyContent: 'flex-end', gap: '10px',
};
// --- End Styles ---

// --- Content Definitions ---
const normalContent = {
    title: "🎉 GRASS DLC: UNLOCKED! 🎉",
    text: "Okay we need to have a talk",
    imageUrl: "https://media1.tenor.com/m/cXYPZhsqJlkAAAAC/chien-perplexe.gif",
    altText: "Confused Dog GIF",
    footerText: "Your love for paperwork concerns me... thanks for the hard work though!"
};

const rareContent = {
    title: "✨ STOP CRIMINAL SCUM! ✨",
    text: "So you have found something so rare, you must ping Jade Stewart and let her know she's stinky",
    imageUrl: "https://media1.tenor.com/m/FPj2Ns2pFugAAAAd/oblivion-elder-scrolls.gif",
    altText: "Dean Pelton Amazed GIF",
    footerText: "Seriously, this is a 1 in 100000 chance! But congrats on finding this!"
};
const EasterEggModal = ({ show, onHide, type = 'normal' }) => { // Default to 'normal'
    if (!show) {
        return null;
    }

    const content = type === 'rare' ? rareContent : normalContent;

    return (
        <div style={easterEggModalOverlayStyle} onClick={onHide}>
            <div style={easterEggModalContentStyle} onClick={e => e.stopPropagation()}>
                <div style={easterEggModalHeaderStyle}>
                    <h5 style={easterEggModalTitleStyle}>{content.title}</h5>
                    <button onClick={onHide} style={easterEggCloseButtonStyle} aria-label="Close modal">
                        &times;
                    </button>
                </div>

                <div style={easterEggModalBodyStyle}>
                    <p>{content.text}</p>
                    <img
                        src={content.imageUrl} // Use imageUrl from content object
                        alt={content.altText}   // Use altText from content object
                        style={{ maxWidth: '100%', height: 'auto', marginTop: '15px', borderRadius: '5px' }}
                    />
                    {/* Use footerText from content object */}
                    <p style={{ marginTop: '15px', fontSize: '0.9em' }}>
                        {content.footerText}
                    </p>
                </div>

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
