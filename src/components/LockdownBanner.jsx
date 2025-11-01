import React from 'react';
import { Alert } from 'react-bootstrap';

function LockdownBanner({ notification, show }) {
    if (!show) return null;

    return (
        <Alert 
            variant="danger" 
            className="mb-0 text-center" 
            style={{ 
                borderRadius: 0,
                position: 'sticky',
                top: 0,
                zIndex: 1030
            }}
        >
            {notification}
        </Alert>
    );
}

export default LockdownBanner;