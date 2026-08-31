import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../../firebase';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import './SplashGate.css';

const CACHE_KEY = 'phmc_maintenance_splash';

/**
 * AppLoadingScreen — single shared loading screen used both by SplashGate (while
 * it checks the splash status) and by the app's lazy-route Suspense fallback.
 * Both phases show the exact same screen, so a normal load is one continuous
 * "Loading Application, one moment" instead of two different loaders in a row.
 */
export const AppLoadingScreen = () => (
  <div className="splash-loading" aria-label="Loading application">
    <div className="splash-loading-spinner"><i className="fas fa-circle-notch fa-spin" /></div>
    <div className="splash-loading-text">Loading Application, one moment</div>
  </div>
);

const readCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
};

const writeCache = (splash) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(splash || { active: false }));
  } catch { /* ignore quota/private-mode errors */ }
};

/**
 * SplashGate — gates the whole app behind the maintenance splash status.
 *
 * The splash status comes from an async RTDB read (`appMetadata/maintenance/splash`),
 * which is exactly why the app used to paint before the splash landed. To kill that
 * flash:
 *   - While the status is unknown (first load, no cache) it renders a themed
 *     full-screen cover, so the app underneath is never revealed prematurely.
 *   - If a splash is active it renders ONLY the splash — the app isn't mounted
 *     at all.
 *   - If clear, it renders the app.
 * The last-known splash state is cached in localStorage, so repeat loads during
 * an outage show the splash instantly (before the RTDB round-trip). Public users
 * get a hard splash; PHMC staff get a "Continue to dashboard" button (per-tab,
 * sessionStorage) so ops can still reach the admin panel to lift it.
 */
const SplashGate = ({ children }) => {
  const cached = readCache();
  const [status, setStatus] = useState(cached?.active ? 'active' : 'loading');
  const [splash, setSplash] = useState(cached && cached.active ? cached : null);
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('maintenance-splash-dismissed') === '1'
  );
  const { isPhmcMember } = useGtaWorldAuth();

  // Live source of truth — refreshes the cached splash state.
  useEffect(() => {
    const splashRef = ref(database, 'appMetadata/maintenance/splash');
    const unsub = onValue(splashRef, (snap) => {
      const next = snap.val() || null;
      setSplash(next);
      writeCache(next);
      setStatus(next && next.active ? 'active' : 'clear');
    });
    return () => unsub();
  }, []);

  // When an operator lifts the splash remotely, clear the local dismiss so a
  // future outage surfaces again instead of being hidden by a stale dismiss.
  useEffect(() => {
    if (splash && !splash.active) {
      sessionStorage.removeItem('maintenance-splash-dismissed');
      setDismissed(false);
    }
  }, [splash]);

  if (status === 'loading') {
    return <AppLoadingScreen />;
  }

  const active = status === 'active' && splash && splash.active && !dismissed;

  if (!active) return children;

  const lastUpdated = splash.updatedAt ? new Date(splash.updatedAt).toLocaleString() : '';

  const dismiss = () => {
    sessionStorage.setItem('maintenance-splash-dismissed', '1');
    setDismissed(true);
  };

  return (
    <div className="splash-overlay" role="alertdialog" aria-modal="true" aria-label="Maintenance">
      <div className="splash-card">
        <div className="splash-icon"><i className="fas fa-wrench" /></div>
        <h1 className="splash-title">{splash.title || 'Maintenance'}</h1>
        <p className="splash-message">{splash.message || 'Service is temporarily unavailable. Please try again later.'}</p>
        {splash.eta && (
          <p className="splash-eta"><i className="fas fa-clock" /> ETA: {splash.eta}</p>
        )}
        {(splash.updatedBy || lastUpdated) && (
          <p className="splash-meta">
            {splash.updatedBy ? `Set by ${splash.updatedBy}` : 'Set by operator'}
            {lastUpdated ? ` \u00b7 ${lastUpdated}` : ''}
          </p>
        )}
        {isPhmcMember && (
          <button className="splash-dismiss" onClick={dismiss}>
            Continue to dashboard
          </button>
        )}
      </div>
    </div>
  );
};

export default SplashGate;
