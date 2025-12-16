import React from 'react';
import './LockdownBanner.css';

const LockdownBanner = ({ message, onAcknowledge }) => {
    if (!message) return null;

    return (
        <div className="lockdown-banner">
            <div className="lockdown-banner-message">
                {message}
            </div>
            {onAcknowledge && (
                <button onClick={onAcknowledge} className="lockdown-banner-button">
                    Acknowledge
                </button>
            )}
        </div>
    );
};

export default LockdownBanner;
