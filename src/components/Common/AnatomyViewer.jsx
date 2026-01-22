import React from 'react';

const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1100, // Higher than AutopsyAssist
    cursor: 'pointer',
};

const contentStyle = {
    position: 'relative',
    maxWidth: '80vw',
    maxHeight: '90vh',
};

const imageStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
};

const titleStyle = {
    position: 'absolute',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    color: 'white',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '1.5rem',
    textAlign: 'center',
};

const closeHintStyle = {
    position: 'absolute',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    color: '#ccc',
    fontSize: '1rem',
};

const AnatomyViewer = ({ imageUrl, title, onHide }) => {
    if (!imageUrl) {
        return null;
    }

    return (
        <div style={overlayStyle} onClick={onHide}>
            <div style={contentStyle} onClick={e => e.stopPropagation()}>
                <img src={imageUrl} alt={title} style={imageStyle} />
                <div style={titleStyle}>{title}</div>
                <div style={closeHintStyle}>(Click anywhere to close)</div>
            </div>
        </div>
    );
};

export default AnatomyViewer;
