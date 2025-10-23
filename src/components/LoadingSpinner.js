import React, { useState, useEffect } from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({ message = 'Loading...', delay = 200 }) => {
    const [showSpinner, setShowSpinner] = useState(false);

    useEffect(() => {
        // Delay showing spinner to avoid flash for fast loads
        const timer = setTimeout(() => setShowSpinner(true), delay);
        return () => clearTimeout(timer);
    }, [delay]);

    if (!showSpinner) {
        return null; // Don't show anything for very fast loads
    }

    return (
        <div className="spinner-overlay">
            <div className="spinner-container">
                <div className="spinner-message">{message}</div>
            </div>
        </div>
    );
};

export default LoadingSpinner;
