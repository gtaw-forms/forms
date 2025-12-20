import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';

const UnifiedGtaCallback = () => {
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { processCallback } = useGtaWorldAuth();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(location.hash.split('?')[1] || '');
    const code = searchParams.get('code') || hashParams.get('code');
    const state = searchParams.get('state') || hashParams.get('state');
    const errorParam = searchParams.get('error') || hashParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (errorParam) {
      setStatus('error');
      setError(errorDescription || errorParam);
      return;
    }
    if (!code) {
      setStatus('error');
      setError('No authorization code received');
      return;
    }

    (async () => {
      try {
        console.log('🎯 [UnifiedGtaCallback] Starting processCallback with:', { code: code?.substring(0, 10) + '...', state });
        const result = await processCallback(code, state);
        console.log('✅ [UnifiedGtaCallback] processCallback completed successfully');
        setStatus('success');
        // EXPERIMENTAL: Prepare a compact, safe OAuth profile object for optional persistence
        try {
          const rawUser = sessionStorage.getItem('gta-user-data') || sessionStorage.getItem('gtaworld_user_data');
          const userData = rawUser ? JSON.parse(rawUser) : null;

          if (userData) {
            const faction = userData.faction || null;
            const preferredName = faction?.characterName || null;
            const preferredBadge = faction?.characterId || null;
            const preferredRank = faction?.rank || faction?.scriptRank || null;
            const compactProfile = {
              username: userData.username || null,
              userId: userData.id || null,
              isFactionMember: !!userData.isFactionMember,
              faction: faction
                ? {
                    characterName: faction.characterName || null,
                    characterId: faction.characterId || null,
                    rank: faction.rank || null,
                    scriptRank: faction.scriptRank || null,
                  }
                : null,
              // Derived fields commonly used by forms (no secrets)
              preferredEmployee: {
                name: preferredName || null,
                badge: preferredBadge || null,
                rank: preferredRank || null,
                discord: userData.username || null,
                phNumber: '50056',
              },
              accessLevel: userData.accessLevel || 'none',
              permissions: Array.isArray(userData.permissions) ? userData.permissions : [],
              savedAt: Date.now(),
              version: 1,
            };

            // Always place the latest profile in sessionStorage for intra-session consumers
            sessionStorage.setItem('phmc_gtaw_oauth_latest', JSON.stringify(compactProfile));

            // If the user had previously opted in, persist to localStorage as well
            const persistEnabled = localStorage.getItem('phmc_gtaw_oauth_persist_enabled') === 'true';
            if (persistEnabled) {
              localStorage.setItem('phmc_gtaw_oauth_profile', JSON.stringify(compactProfile));
            }

            console.log('[UnifiedGtaCallback] Prepared compact OAuth profile for persistence.', {
              hasUser: !!userData,
              wroteSessionKey: 'phmc_gtaw_oauth_latest',
              persistedToLocalStorage: persistEnabled,
            });
          } else {
            console.warn('[UnifiedGtaCallback] No user data found in sessionStorage to prepare persistence profile.');
          }
        } catch (persistErr) {
          console.warn('[UnifiedGtaCallback] Failed to prepare/persist compact OAuth profile:', persistErr);
        }
        
        const destinationPath = result?.returnPath || '/';
        console.log(`🔄 [UnifiedGtaCallback] Setting up navigation to ${destinationPath} in 800ms`);
        
        setTimeout(() => {
          console.log(`🚀 [UnifiedGtaCallback] Navigating to ${destinationPath} (preserving sessionStorage)`);
          console.log('📦 [UnifiedGtaCallback] SessionStorage before navigation:', {
            userData: !!sessionStorage.getItem('gta-user-data'),
            accessToken: !!sessionStorage.getItem('gta-access-token'),
            storageKeys: Object.keys(sessionStorage)
          });
          // Use React Router navigate to preserve sessionStorage
          navigate(destinationPath.startsWith('#') ? destinationPath.substring(1) : destinationPath, { replace: true });
        }, 800);
      } catch (err) {
        console.error('❌ [UnifiedGtaCallback] processCallback failed:', err);
        setStatus('error');
        setError(err.message || 'Authentication failed');
      }
    })();
  }, [location.search, location.hash, processCallback]);

  if (status === 'processing') {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Processing...</span>
          </div>
          <h4 className="mt-3">GTA World Authentication</h4>
          <p className="text-muted">Processing authentication...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="text-center">
          <div className="text-success mb-3">
            <i className="fas fa-check-circle" style={{ fontSize: '4rem' }}></i>
          </div>
          <h4 className="text-success">Authentication Successful!</h4>
          <p className="text-muted">Redirecting to homepage...</p>
          <div className="spinner-border spinner-border-sm text-primary mt-2">
            <span className="visually-hidden">Redirecting...</span>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <div className="text-center">
          <div className="alert alert-danger" role="alert" style={{ maxWidth: '500px' }}>
            <h4 className="alert-heading">
              <i className="fas fa-exclamation-triangle me-2"></i>
              Authentication Error
            </h4>
            <p className="mb-3">{error}</p>
            <hr />
            <div className="d-flex gap-2 justify-content-center">
              <button className="btn btn-primary" onClick={() => navigate('/', { replace: true })}>
                <i className="fas fa-home me-2"></i>
                Return to Homepage
              </button>
              <button className="btn btn-outline-secondary" onClick={() => window.location.reload()}>
                <i className="fas fa-redo me-2"></i>
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default UnifiedGtaCallback;