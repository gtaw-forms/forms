import React, { useEffect, useState } from 'react';

const GtaCallback = () => {
    const [code, setCode] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const authCode = urlParams.get('code');
        const authError = urlParams.get('error');

        if (authCode) {
            setCode(authCode);
            // In a real application, you would now exchange this code for a token.
            // For now, we'll just display it.
        } else if (authError) {
            setError(authError);
        }
    }, []);

    return (
        <div>
            <h2>GTA World API Callback</h2>
            {code && <p>Authorization Code: {code}</p>}
            {error && <p>Error: {error}</p>}
        </div>
    );
};

export default GtaCallback;
