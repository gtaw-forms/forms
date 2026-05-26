import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { validateFirebaseConfig } from './gtaWorldAuth';

/**
 * Utility functions for testing and debugging Firebase Functions connectivity
 */

/**
 * Tests Firebase Functions connectivity with client ID validation
 * @returns {Object} Test result
 */
export const testClientIdValidation = async () => {
    console.info('[Client ID Test] Starting validation test...');
    
    try {
        const envClientId = import.meta.env.VITE_GTAWORLD_CLIENT_ID;
        
        if (!envClientId) {
            return {
                success: false,
                error: 'VITE_GTAWORLD_CLIENT_ID not configured',
                details: 'Environment variable is missing'
            };
        }

        console.info('[Client ID Test] Environment client ID found:', {
            hasClientId: true,
            clientIdPrefix: `${envClientId.substring(0, 8)}...`,
            length: envClientId.length
        });

        // Test the OAuth function with real client ID but fake code
        const exchangeFunction = httpsCallable(functions, 'processGtaWorldAuth');
        
        try {
            await exchangeFunction({
                code: 'fake_code_for_testing',
                redirectUri: 'https://gtaw-forms.github.io/forms/#/auth/gta/callback',
                clientId: envClientId // Use real client ID
            });
        } catch (testError) {
            console.info('[Client ID Test] Response received:', {
                code: testError.code,
                message: testError.message?.substring(0, 200) + '...'
            });

            // Analyze the error to determine if client ID validation passed
            if (testError.code === 'functions/invalid-argument' && 
                testError.message?.includes('Invalid client ID')) {
                return {
                    success: false,
                    error: 'Client ID validation failed on server',
                    details: {
                        serverRejectsClientId: true,
                        providedClientId: `${envClientId.substring(0, 8)}...`,
                        hint: 'Check if GTAWORLD_CLIENT_ID secret matches VITE_GTAWORLD_CLIENT_ID'
                    }
                };
            } else if (testError.code === 'functions/invalid-argument' && 
                       !testError.message?.includes('Invalid client ID')) {
                return {
                    success: true,
                    message: 'Client ID validation passed',
                    details: {
                        clientIdAccepted: true,
                        nextStepNeeded: 'Real authorization code required',
                        errorReceived: testError.message
                    }
                };
            } else {
                return {
                    success: false,
                    error: 'Unexpected error during client ID test',
                    details: {
                        code: testError.code,
                        message: testError.message
                    }
                };
            }
        }

        return {
            success: false,
            error: 'Unexpected success - function should have failed with fake code',
            details: 'This indicates a problem with validation logic'
        };

    } catch (error) {
        console.error('[Client ID Test] Test failed:', error);
        return {
            success: false,
            error: 'Client ID test failed',
            details: error.message
        };
    }
};

/**
 * Tests basic Firebase Functions connectivity
 * @returns {Object} Test result
 */
export const testFirebaseFunctions = async () => {
    console.info('[Firebase Test] Starting connectivity test...');
    
    try {
        // Validate configuration first
        const configValidation = validateFirebaseConfig();
        if (!configValidation.valid) {
            return {
                success: false,
                error: 'Configuration validation failed',
                details: configValidation.issues
            };
        }

        console.info('[Firebase Test] Functions instance created:', {
            app: !!functions.app,
            region: 'us-central1 (configured)',
            customDomain: functions._delegate?._url?.includes('cloudfunctions.net'),
            functionsUrl: functions._delegate?._url || 'unknown'
        });

        // Test the OAuth function specifically
        const exchangeFunction = httpsCallable(functions, 'processGtaWorldAuth');
        console.info('[Firebase Test] Function callable created');

        // This should fail with a validation error, but it will confirm connectivity
        try {
            await exchangeFunction({
                code: 'test',
                redirectUri: 'test',
                clientId: 'test'
            });
        } catch (testError) {
            console.info('[Firebase Test] Expected error received:', {
                code: testError.code,
                message: testError.message?.substring(0, 100) + '...'
            });

            // If we get a validation error, it means the function is reachable
            if (testError.code === 'invalid-argument' || 
                testError.code === 'functions/invalid-argument' ||
                testError.message?.includes('invalid-argument')) {
                return {
                    success: true,
                    message: 'Firebase Functions connectivity confirmed',
                    functionReachable: true,
                    expectedError: testError.code
                };
            }

            // If we get an internal error, there might be a deployment issue
            if (testError.code === 'functions/internal' || 
                testError.code === 'internal') {
                return {
                    success: false,
                    error: 'Firebase Function internal error',
                    details: {
                        code: testError.code,
                        message: testError.message,
                        suggestion: 'Check Firebase Functions deployment and logs'
                    }
                };
            }

            // If we get a not-found error, the function isn't deployed
            if (testError.code === 'functions/not-found') {
                return {
                    success: false,
                    error: 'Firebase Function not found',
                    details: {
                        code: testError.code,
                        suggestion: 'Deploy the processGtaWorldAuth function'
                    }
                };
            }

            // Other errors
            return {
                success: false,
                error: 'Unexpected error during connectivity test',
                details: {
                    code: testError.code,
                    message: testError.message
                }
            };
        }

        // If no error was thrown, something unexpected happened
        return {
            success: false,
            error: 'Unexpected success during test call',
            details: 'Expected a validation error but got success'
        };

    } catch (error) {
        console.error('[Firebase Test] Connectivity test failed:', error);
        return {
            success: false,
            error: 'Failed to initialize Firebase Functions',
            details: {
                message: error.message,
                code: error.code,
                stack: error.stack?.split('\n').slice(0, 3)
            }
        };
    }
};

/**
 * Tests profile retrieval with actual authentication to get raw API response
 * @returns {Object} Test result with raw profile data
 */
export const testProfileRetrieval = async () => {
    console.info('[Profile Test] Starting profile retrieval test...');
    
    try {
        // Check if we have an authenticated session using direct storage access
        const currentToken = sessionStorage.getItem('gta-access-token');
        const currentUserData = sessionStorage.getItem('gta-user-data');
        const currentUser = currentUserData ? JSON.parse(currentUserData) : null;
        
        console.info('[Profile Test] Session check:', {
            hasToken: !!currentToken,
            tokenPrefix: currentToken ? `${currentToken.substring(0, 10)}...` : 'none',
            hasUser: !!currentUser,
            username: currentUser?.username || 'unknown',
            userId: currentUser?.id || 'unknown'
        });
        
        if (!currentToken) {
            // Check all possible storage locations for debugging
            const manualTokenCheck = sessionStorage.getItem('gta-access-token');
            const legacyTokenCheck = sessionStorage.getItem('gtaworld-access-token');
            
            return {
                success: false,
                error: 'No authenticated session found',
                details: 'User must be logged in to test profile retrieval',
                suggestion: 'Complete OAuth login first',
                debugInfo: {
                    properStorageKey: !!manualTokenCheck,
                    legacyStorageKey: !!legacyTokenCheck,
                    allSessionKeys: Object.keys(sessionStorage)
                }
            };
        }

        console.info('[Profile Test] Found access token, testing profile API...');
        
        try {
            // Use the Firebase Function to validate token and get live API data
            console.info('[Profile Test] Using Firebase Function to get live API data...');
            
            // Import Firebase functions
            const { httpsCallable } = require('firebase/functions');
            const { functions } = require('../firebase');
            
            const validateToken = httpsCallable(functions, 'validateGtaWorldToken');
            const result = await validateToken({ accessToken: currentToken });
            
            console.info('[Profile Test] Firebase Function result:', result.data);
            
            if (!result.data.success) {
                throw new Error(`Profile retrieval failed: ${result.data.error || 'Unknown error'}`);
            }
            
            const userData = result.data.user || {};
            const profileData = {
                message: 'Live API data from GTA World /api/user endpoint',
                liveApiData: userData,
                storedSessionData: currentUser,
                comparison: {
                    liveApiKeys: Object.keys(userData),
                    storedDataKeys: currentUser ? Object.keys(currentUser) : [],
                    dataSize: JSON.stringify(userData).length,
                    timestamp: result.data.timestamp
                },
                analysis: {
                    hasFactionsData: !!(userData?.factions),
                    hasRoleData: !!(userData?.role),
                    hasCharacterData: !!(userData?.character || userData?.characters),
                    userStructure: userData?.user ? Object.keys(userData.user) : 'No user object found'
                }
            };
            
            return {
                success: true,
                message: 'Profile retrieval successful',
                rawProfileData: profileData,
                dataStructure: {
                    keys: Object.keys(profileData || {}),
                    hasUsername: !!(profileData?.username || profileData?.name),
                    hasId: !!(profileData?.id || profileData?.user_id || profileData?.uid),
                    dataType: typeof profileData,
                    isArray: Array.isArray(profileData),
                    dataSize: JSON.stringify(profileData || {}).length
                },
                currentSession: {
                    storedUser: currentUser,
                    tokenPresent: !!currentToken
                }
            };
            
        } catch (apiError) {
            console.error('[Profile Test] API call failed:', apiError);
            
            return {
                success: false,
                error: 'Profile API call failed',
                details: {
                    message: apiError.message,
                    code: apiError.code,
                    suggestion: 'Check if access token is valid and API endpoint is correct'
                }
            };
        }
        
    } catch (error) {
        console.error('[Profile Test] Profile test failed:', error);
        return {
            success: false,
            error: 'Profile retrieval test failed',
            details: error.message
        };
    }
};

/**
 * Runs a comprehensive diagnostic of the OAuth system
 * @returns {Object} Diagnostic result
 */
export const runOAuthDiagnostics = async () => {
    console.info('[OAuth Diagnostics] Starting comprehensive diagnostics...');
    
    const results = {
        timestamp: new Date().toISOString(),
        tests: {}
    };

    // Test 1: Configuration validation
    console.info('[OAuth Diagnostics] Testing configuration...');
    results.tests.configuration = validateFirebaseConfig();

    // Test Firebase Functions connectivity
    console.info('[OAuth Diagnostics] Testing Firebase Functions...');
    results.tests.firebaseFunctions = await testFirebaseFunctions();

    // Test Client ID validation specifically
    console.info('[OAuth Diagnostics] Testing Client ID validation...');
    results.tests.clientIdValidation = await testClientIdValidation();

    // Test Profile Retrieval (if authenticated)
    console.info('[OAuth Diagnostics] Testing profile retrieval...');
    results.tests.profileRetrieval = await testProfileRetrieval();

    // Test 3: Environment check
    console.info('[OAuth Diagnostics] Checking environment...');
    results.tests.environment = {
        success: true,
        details: {
            hostname: window.location.hostname,
            protocol: window.location.protocol,
            origin: window.location.origin,
            userAgent: navigator.userAgent.substring(0, 100) + '...',
            isLocalhost: window.location.hostname === 'localhost',
            isGithubPages: window.location.hostname.includes('github.io'),
            isProduction: window.location.hostname.includes('gta.world')
        }
    };

    // Test 4: Session storage
    console.info('[OAuth Diagnostics] Testing session storage...');
    try {
        const testKey = 'oauth-diagnostics-test';
        const testValue = { test: true, timestamp: Date.now() };
        sessionStorage.setItem(testKey, JSON.stringify(testValue));
        const retrieved = JSON.parse(sessionStorage.getItem(testKey));
        sessionStorage.removeItem(testKey);
        
        results.tests.sessionStorage = {
            success: retrieved.test === true,
            message: 'Session storage working correctly'
        };
    } catch (error) {
        results.tests.sessionStorage = {
            success: false,
            error: 'Session storage not available',
            details: error.message
        };
    }

    // Summary
    const allPassed = Object.values(results.tests).every(test => test.success);
    results.summary = {
        allTestsPassed: allPassed,
        passedTests: Object.entries(results.tests).filter(([_, test]) => test.success).length,
        totalTests: Object.keys(results.tests).length,
        criticalIssues: Object.entries(results.tests)
            .filter(([_, test]) => !test.success)
            .map(([name, test]) => ({ test: name, error: test.error }))
    };

    console.info('[OAuth Diagnostics] Diagnostics complete:', results.summary);
    return results;
};

/**
 * Logs detailed environment and configuration information
 */
export const logEnvironmentInfo = () => {
    console.group('[OAuth Environment Info]');
    
    console.info('Environment Variables:', {
        hasClientId: !!import.meta.env.VITE_GTAWORLD_CLIENT_ID,
        clientIdPrefix: import.meta.env.VITE_GTAWORLD_CLIENT_ID?.substring(0, 8) + '...',
        nodeEnv: import.meta.env.NODE_ENV,
        publicUrl: import.meta.env.PUBLIC_URL
    });
    
    console.info('Firebase Config:', {
        hasApiKey: !!import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID
    });
    
    console.info('Browser Environment:', {
        origin: window.location.origin,
        hostname: window.location.hostname,
        protocol: window.location.protocol,
        userAgent: navigator.userAgent
    });
    
    console.groupEnd();
};