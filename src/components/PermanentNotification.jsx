import React from 'react';

const PermanentNotification = ({ discordLink, onReportBugClick }) => {
  const notificationStyle = {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    backgroundColor: '#333',
    color: '#fff',
    padding: '15px 20px',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
    zIndex: '1000',
    fontSize: '0.9rem',
    maxWidth: '300px',
    lineHeight: '1.4',
  };

  const linkStyle = {
    color: '#60a5fa',
    textDecoration: 'underline',
    fontWeight: 'bold',
  };

  const buttonStyle = {
    padding: '8px 12px',
    marginTop: '10px',
    width: '100%',
    background: '#6366f1',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontWeight: '600',
  };

  return (
    <div style={notificationStyle}>
      You are using a beta website build. Please report bugs to the (<a href={discordLink} target="_blank" rel="noopener noreferrer" style={linkStyle}>PHMC Discord</a>) and notify 'PHMC Leadership' in the Visitor Chat or DM.
      <button style={buttonStyle} onClick={onReportBugClick}>
        Report Bug
      </button>
    </div>
  );
};

export default PermanentNotification;