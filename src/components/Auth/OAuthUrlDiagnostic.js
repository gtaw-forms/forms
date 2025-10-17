import React, { useEffect, useState } from 'react';

/**
 * Simple OAuth URL Diagnostic Component
 * Shows exactly what parameters GTA World is sending
 */
const OAuthUrlDiagnostic = () => {
    const [urlInfo, setUrlInfo] = useState(null);

    useEffect(() => {
        // Capture all URL information immediately
        const info = {
            timestamp: new Date().toISOString(),
            fullUrl: window.location.href,
            origin: window.location.origin,
            pathname: window.location.pathname,
            search: window.location.search,
            hash: window.location.hash,
            
            // Parse all possible parameter locations
            searchParams: Object.fromEntries(new URLSearchParams(window.location.search)),
            hashParams: Object.fromEntries(new URLSearchParams(window.location.hash.split('?')[1] || '')),
            
            // Check for specific OAuth parameters
            hasCode: !!(new URLSearchParams(window.location.search).get('code') || 
                       new URLSearchParams(window.location.hash.split('?')[1] || '').get('code')),
            hasState: !!(new URLSearchParams(window.location.search).get('state') || 
                        new URLSearchParams(window.location.hash.split('?')[1] || '').get('state')),
            hasError: !!(new URLSearchParams(window.location.search).get('error') || 
                        new URLSearchParams(window.location.hash.split('?')[1] || '').get('error')),
                        
            // Extract actual values
            code: new URLSearchParams(window.location.search).get('code') || 
                  new URLSearchParams(window.location.hash.split('?')[1] || '').get('code'),
            state: new URLSearchParams(window.location.search).get('state') || 
                   new URLSearchParams(window.location.hash.split('?')[1] || '').get('state'),
            error: new URLSearchParams(window.location.search).get('error') || 
                   new URLSearchParams(window.location.hash.split('?')[1] || '').get('error')
        };
        
        setUrlInfo(info);
        console.log('[OAuth URL Diagnostic]', info);
        
        // Also log to session storage for persistence
        sessionStorage.setItem('oauth-url-diagnostic', JSON.stringify(info));
    }, []);

    if (!urlInfo) {
        return <div>Loading URL diagnostic...</div>;
    }

    return (
        <div style={{ padding: '20px', fontFamily: 'monospace', fontSize: '12px' }}>
            <h2>OAuth URL Diagnostic</h2>
            <div style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
                <h3>URL Components:</h3>
                <p><strong>Full URL:</strong> {urlInfo.fullUrl}</p>
                <p><strong>Search:</strong> {urlInfo.search || '(empty)'}</p>
                <p><strong>Hash:</strong> {urlInfo.hash || '(empty)'}</p>
                
                <h3>Parameters Found:</h3>
                <p><strong>Search Params:</strong> {JSON.stringify(urlInfo.searchParams)}</p>
                <p><strong>Hash Params:</strong> {JSON.stringify(urlInfo.hashParams)}</p>
                
                <h3>OAuth Parameters:</h3>
                <p><strong>Code:</strong> {urlInfo.code ? `${urlInfo.code.substring(0, 20)}...` : 'NOT FOUND'}</p>
                <p><strong>State:</strong> {urlInfo.state ? `${urlInfo.state.substring(0, 20)}...` : 'NOT FOUND'}</p>
                <p><strong>Error:</strong> {urlInfo.error || 'NOT FOUND'}</p>
                
                <h3>Status:</h3>
                <p style={{ color: urlInfo.hasCode ? 'green' : 'red' }}>
                    ✓ Has Code: {urlInfo.hasCode ? 'YES' : 'NO'}
                </p>
                <p style={{ color: urlInfo.hasState ? 'green' : 'red' }}>
                    ✓ Has State: {urlInfo.hasState ? 'YES' : 'NO'}
                </p>
                <p style={{ color: urlInfo.hasError ? 'red' : 'green' }}>
                    ✓ Has Error: {urlInfo.hasError ? 'YES' : 'NO'}
                </p>
            </div>
            
            <div style={{ marginTop: '20px' }}>
                <button onClick={() => window.location.href = '/#/admin'}>
                    Continue to Admin
                </button>
                <button onClick={() => navigator.clipboard.writeText(JSON.stringify(urlInfo, null, 2))} style={{ marginLeft: '10px' }}>
                    Copy Diagnostic Data
                </button>
            </div>
        </div>
    );
};

export default OAuthUrlDiagnostic;