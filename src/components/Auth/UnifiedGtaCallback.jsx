import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { triggerRefreshGtawUser } from '../../services/firebaseFunctions';
import { Spinner } from 'react-bootstrap';
import { formatAccessLevel } from '../../utils/textUtils';
import phmcLogo from '../../assets/phmc.png';

const UnifiedGtaCallback = () => {
    const [steps, setSteps] = useState([
        { key: 'auth', text: 'Processing GTA:W authentication...', status: 'processing' },
        { key: 'faction', text: 'Verifying PHMC faction membership...', status: 'pending' },
        { key: 'admin', text: 'Checking for administrative privileges...', status: 'pending' },
        { key: 'sync', text: 'Syncing latest faction member data...', status: 'pending' },
        { key: 'reverify', text: 'Finalizing session...', status: 'pending' } // New Step 3.5
    ]);
    const [error, setError] = useState(null);
    const location = useLocation();
    const navigate = useNavigate();
    const { processCallback, isAuthenticated, user, error: authError } = useGtaWorldAuth();
    const flowStarted = useRef(false);
    const syncRun = useRef(false);

    const updateStep = (key, status, text) => {
        setSteps(prevSteps =>
            prevSteps.map(step => (step.key === key ? { ...step, status, text: text || step.text } : step))
        );
    };
    
    useEffect(() => {
        if (flowStarted.current) return;
        
        const searchParams = new URLSearchParams(location.search);
        const code = searchParams.get('code');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (errorParam) {
            flowStarted.current = true;
            console.error('❌ [UnifiedGtaCallback] OAuth Error Received on page load:', errorParam, errorDescription);
            updateStep('auth', 'error', errorDescription || errorParam);
            setError(errorDescription || errorParam);
            return;
        }
        if (!code) {
            flowStarted.current = true;
            console.error('❌ [UnifiedGtaCallback] No authorization code received on page load.');
            updateStep('auth', 'error', 'No authorization code received.');
            setError('No authorization code received.');
            return;
        }
        
        flowStarted.current = true; 
        console.log('🔄 [UnifiedGtaCallback] Initializing authentication. Calling processCallback...');
        processCallback(code, searchParams.get('state')).catch(err => {
            console.error('❌ [UnifiedGtaCallback] Initial processCallback promise was rejected:', err);
            setError(err.message || 'Authentication failed');
            updateStep('auth', 'error', err.message || 'Authentication failed');
        });

    }, [location, processCallback]);

    useEffect(() => {
        if (authError && !error) {
            console.error('❌ [Auth State] Auth hook reported an error:', authError);
            setError(authError);
            updateStep('auth', 'error', authError);
            return;
        }

        if (isAuthenticated && user) {
            console.log('✅ [Auth State] User is authenticated. Starting multi-step checks.');
            updateStep('auth', 'success', 'Authentication successful!');

            (async () => {
                console.log('⏳ [Auth State] Adding a small delay to ensure Firebase token propagation.');
                await new Promise(resolve => setTimeout(resolve, 500));
                console.log('✅ [Auth State] Delay complete. Proceeding with checks.');

                let currentUser = user;

                // Step 2: Faction Check
                console.log('➡️ [Step 2] Verifying PHMC faction membership.');
                updateStep('faction', 'processing');
                await new Promise(resolve => setTimeout(resolve, 300));

                if (currentUser?.isFactionMember) {
                    console.log('✅ [Step 2] User is a PHMC Faction Member.', currentUser.faction);
                    updateStep('faction', 'success', `Verified as PHMC Faction Member (Rank: ${currentUser.faction?.rank || 'N/A'}).`);
                } else {
                    console.warn('⚠️ [Step 2] User is NOT a PHMC Faction Member. Initiating sync/re-check flow.');
                    updateStep('faction', 'processing', 'Membership not found. Attempting one-time data sync...');
                    try {
                        console.log('➡️ [Step 2.5] Triggering faction data sync.');
                        const triggerSync = httpsCallable(functions, 'triggerFactionSync');
                        await triggerSync();
                        syncRun.current = true;
                        console.log('✅ [Step 2.5] Sync triggered. Waiting 5 seconds for database update.');
                        updateStep('faction', 'processing', 'Sync triggered. Waiting for database update (5s)...');

                        await new Promise(resolve => setTimeout(resolve, 5000));

                        console.log('➡️ [Step 2.8] Re-checking faction membership after sync.');
                        updateStep('faction', 'processing', 'Re-checking faction membership...');
                        const accessToken = sessionStorage.getItem('gta-access-token');
                        if (accessToken) {
                            const refreshedResult = await triggerRefreshGtawUser({ accessToken });
                            if (refreshedResult.success && refreshedResult.user) {
                                currentUser = refreshedResult.user;
                                console.log('✅ [Step 2.8] Re-check successful. Refreshed user data:', currentUser);
                                if (currentUser.isFactionMember) {
                                    updateStep('faction', 'success', `Verified as Member after sync (Rank: ${currentUser.faction?.rank || 'N/A'}).`);
                                } else {
                                    updateStep('faction', 'skipped', 'Still not a faction member after sync.');
                                }
                            } else {
                                throw new Error('Failed to retrieve updated user profile after sync.');
                            }
                        } else {
                            throw new Error('Cannot re-check membership without a valid access token.');
                        }
                    } catch (syncError) {
                        console.error('❌ [Step 2.5/2.8] Sync/re-check process failed:', syncError);
                        updateStep('faction', 'error', `Sync & Re-check failed: ${syncError.message}`);
                    }
                }
                console.log('🔚 [Step 2] Faction membership check completed.');

                // Step 3: Admin Check
                console.log('➡️ [Step 3] Checking for administrative privileges.');
                updateStep('admin', 'processing');
                const isAdmin = currentUser && (currentUser.accessLevel === 'superadmin' || currentUser.accessLevel === 'admin');
                console.log('ℹ️ [Step 3] Is Admin:', isAdmin, 'Access Level:', currentUser?.accessLevel);

                if (isAdmin) {
                    updateStep('admin', 'success', `Welcome, ${formatAccessLevel(currentUser.accessLevel)}!`);
                    
                    console.log('➡️ [Step 4] Checking if admin remote sync is needed. Sync already performed by faction check:', syncRun.current);
                    if (!syncRun.current) { 
                        // Admin sync logic...
                    } else {
                        updateStep('sync', 'skipped', 'Sync performed during faction check.');
                    }
                } else {
                    updateStep('admin', 'skipped', 'Standard user privileges verified.');
                    updateStep('sync', 'skipped');
                }
                console.log('🔚 [Step 3/4] Admin checks completed.');

                // Step 3.5: Finalize Session State
                console.log('➡️ [Step 3.5] Finalizing session state.');
                updateStep('reverify', 'processing');
                try {
                    localStorage.setItem('gta-user-data', JSON.stringify(currentUser));
                    console.log('✅ [Step 3.5] Updated user data in localStorage to persist refreshed state.');
                    updateStep('reverify', 'success', 'Session state finalized.');
                } catch (e) {
                    console.error('❌ [Step 3.5] Failed to update localStorage:', e);
                    updateStep('reverify', 'error', 'Failed to save session.');
                }
                
                // Final redirect
                const destinationPath = sessionStorage.getItem('gta-auth-return-path') || '/';
                console.log(`➡️ [Final Step] All checks complete. Redirecting to ${destinationPath} in 2.5 seconds.`);
                setTimeout(() => navigate(destinationPath, { replace: true }), 2500);

            })();
        }
    }, [isAuthenticated, user, authError, navigate]);

    const getStepIcon = (status) => {
        switch (status) {
            case 'processing':
                return <Spinner animation="border" size="sm" variant="primary" />;
            case 'success':
                return <i className="fas fa-check-circle text-success"></i>;
            case 'error':
                return <i className="fas fa-times-circle text-danger"></i>;
            case 'skipped':
                return <i className="fas fa-minus-circle text-muted"></i>;
            case 'pending':
            default:
                return <i className="far fa-clock text-muted"></i>;
        }
    };

    if (error && steps.some(s => s.key === 'auth' && s.status === 'error')) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
                {/* ... error UI ... */}
            </div>
        );
    }
    
    return (
        <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh', backgroundColor: '#f4f7f6' }}>
            <div className="card shadow-sm" style={{ width: '450px', border: 'none' }}>
                <div className="card-body p-4">
                    <img src={phmcLogo} alt="PHMC Logo" className="mb-4" style={{ maxWidth: '100px', display: 'block', margin: '0 auto' }} />
                    <h4 className="text-center mb-4">GTA World Authentication</h4>
                    <ul className="list-group list-group-flush">
                        {steps.map(step => (
                            <li key={step.key} className="list-group-item d-flex justify-content-between align-items-center px-0">
                                <span>{step.text}</span>
                                {getStepIcon(step.status)}
                            </li>
                        ))}
                    </ul>
                    {steps.every(s => s.status === 'success' || s.status === 'skipped' || s.status === 'error') && !error && (
                        <div className="text-center mt-4">
                            <p className="text-success mb-2">All checks complete! Redirecting...</p>
                            <Spinner animation="border" size="sm" variant="success" />
                        </div>
                    )}
                     {steps.some(s => s.status === 'error') && (
                        <p className="text-danger mt-3 text-center small">
                            One or more steps failed. Please try again or contact an administrator if the issue persists.
                        </p>
                     )}
                </div>
            </div>
        </div>
    );
};

export default UnifiedGtaCallback;
