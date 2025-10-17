/**
 * Client ID Diagnostic Tool
 * Run this in browser console to debug client ID issues
 */

const diagnoseClientId = () => {
    console.log('=== CLIENT ID DIAGNOSTICS ===');
    
    // 1. Check environment variable
    const envClientId = process.env.REACT_APP_GTAWORLD_CLIENT_ID;
    console.log('Environment Client ID:', {
        exists: !!envClientId,
        value: envClientId ? `${envClientId.substring(0, 8)}...` : 'NOT_SET',
        length: envClientId?.length || 0,
        type: typeof envClientId
    });
    
    // 2. Check stored OAuth state
    const storedOAuthData = sessionStorage.getItem('gta-oauth-state');
    let parsedOAuthData = null;
    try {
        parsedOAuthData = storedOAuthData ? JSON.parse(storedOAuthData) : null;
    } catch (e) {
        console.error('Failed to parse stored OAuth data:', e);
    }
    
    console.log('Stored OAuth Data:', {
        exists: !!storedOAuthData,
        hasClientId: !!(parsedOAuthData?.clientId),
        clientId: parsedOAuthData?.clientId ? `${parsedOAuthData.clientId.substring(0, 8)}...` : 'NOT_SET',
        fullData: parsedOAuthData
    });
    
    // 3. Check if they match
    const clientIdsMatch = envClientId === parsedOAuthData?.clientId;
    console.log('Client ID Comparison:', {
        match: clientIdsMatch,
        envId: envClientId ? `${envClientId.substring(0, 8)}...` : 'NOT_SET',
        storedId: parsedOAuthData?.clientId ? `${parsedOAuthData.clientId.substring(0, 8)}...` : 'NOT_SET'
    });
    
    // 4. Check current URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    console.log('URL Parameters:', {
        search: Object.fromEntries(urlParams),
        hash: Object.fromEntries(hashParams),
        hasCode: !!(urlParams.get('code') || hashParams.get('code')),
        hasState: !!(urlParams.get('state') || hashParams.get('state'))
    });
    
    // 5. Recommendations
    console.log('=== RECOMMENDATIONS ===');
    if (!envClientId) {
        console.warn('❌ REACT_APP_GTAWORLD_CLIENT_ID not set in environment');
    }
    if (!clientIdsMatch && parsedOAuthData) {
        console.warn('⚠️  Client ID mismatch between environment and stored state');
        console.log('💡 Try clearing session storage and starting OAuth flow again');
    }
    if (envClientId && clientIdsMatch) {
        console.log('✅ Client IDs match - issue may be server-side');
    }
    
    return {
        envClientId: !!envClientId,
        storedClientId: !!(parsedOAuthData?.clientId),
        match: clientIdsMatch,
        hasOAuthState: !!parsedOAuthData
    };
};

// Auto-run diagnostics
diagnoseClientId();