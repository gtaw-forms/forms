import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../../firebase';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import './SplashGate.css';

const CACHE_KEY = 'phmc_maintenance_splash';
const GOODBYE_CACHE_KEY = 'phmc_goodbye';
const GOODBYE_ACK_KEY = 'phmc_goodbye_ack';
// NOTE: the goodbye dismiss is in-memory only (a reload brings the card back
// while blocks stay retired). The SEPARATE "Acknowledge, don't show again"
// button below persists a per-retirement opt-out in localStorage (see
// blocksSignature): acknowledging THIS retirement silences it, but a later
// different retirement (or a lift + re-retire) surfaces again.

// Hardcoded retirement stats for gtaw-forms/forms (pulled 2026-10-04 — no
// runtime GitHub API calls, avoids the 60 req/hr anonymous rate limit).
const GOODBYE_STATS = {
  since: '21st January 2025',
  commits: 724,
  linesChanged: '776,434',
};

const GOODBYE_BLOCK_LABELS = {
  er: 'ER Protocols',
  'mental-health': 'Mental Health',
  coroner: 'Coroners',
};

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

const readGoodbyeCache = () => {
  try {
    const raw = localStorage.getItem(GOODBYE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
};

const writeCache = (splash) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(splash || { active: false }));
  } catch { /* ignore quota/private-mode errors */ }
};

const writeGoodbyeCache = (goodbye) => {
  try {
    localStorage.setItem(GOODBYE_CACHE_KEY, JSON.stringify(goodbye || { active: false }));
  } catch { /* ignore quota/private-mode errors */ }
};

/** "a, b and c" joining for the retired-block list. */
const joinBlocks = (labels) => {
  if (labels.length <= 1) return labels.join('');
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
};

/** Sorted retired-block keys, e.g. "er,mental-health" — the ack signature. */
const retiredKeys = (blocks) => Object.entries(blocks || {})
  .filter(([, v]) => v)
  .map(([gk]) => gk)
  .sort()
  .join(',');

const readGoodbyeAck = () => {
  try { return localStorage.getItem(GOODBYE_ACK_KEY) || ''; }
  catch { return ''; }
};

const writeGoodbyeAck = (sig) => {
  try { localStorage.setItem(GOODBYE_ACK_KEY, sig); }
  catch { /* ignore quota/private-mode errors */ }
};

const clearGoodbyeAck = () => {
  try { localStorage.removeItem(GOODBYE_ACK_KEY); }
  catch { /* ignore */ }
};

/**
 * GoodbyeCard — retirement notice shown when form blocks are toggled off via
 * `/manage-forms disable`. Driven by `appMetadata/goodbye`
 * `{ active, blocks: { er, mental-health, coroner } }`, synced automatically
 * by the bot (never hand-edited). Audience paths:
 *   - PHMC members → "Continue to dashboard" dismiss (staff ops).
 *   - Signed-in non-members (LEO) → "Continue to Coroner and Morgue Records"
 *     (or "Continue to Morgue Records" once Coroners are retired) → #/morgue.
 *   - Signed out → "Sign In" (opens login in a new tab, gate stays put) plus
 *     the LEO-intended-use notice.
 * Every path also offers "Acknowledge, don't show again" — a persistent
 * per-retirement opt-out (localStorage signature of the retired blocks).
 */
const GoodbyeCard = ({ goodbye, onDismiss, onAcknowledge }) => {
  const { isPhmcMember, isAuthenticated } = useGtaWorldAuth();
  const retired = Object.entries(goodbye.blocks || {})
    .filter(([, v]) => v)
    .map(([gk]) => GOODBYE_BLOCK_LABELS[gk] || gk);
  const blockText = retired.length > 0 ? joinBlocks(retired) : 'these forms';
  // Button names the Coroners while their block is still live; once retired
  // (or, equivalently, when every block is gone) it's Morgue Records only.
  const coronerLive = !goodbye.blocks?.coroner;
  const leoLabel = coronerLive
    ? 'Continue to Coroner and Morgue Records'
    : 'Continue to Morgue Records';

  const goMorgue = () => {
    // SplashGate sits outside the Router, so set the hash BEFORE dismissing —
    // the app mounts fresh on dismiss and picks up the morgue route.
    window.location.hash = '#/morgue';
    onDismiss();
  };

  const goSignIn = () => {
    // New tab: this tab keeps the gate so the LEO Access button appears here
    // after sign-in (on reload) instead of the goodbye being skipped.
    const base = `${window.location.origin}${window.location.pathname}`;
    window.open(`${base}#/login`, '_blank', 'noopener');
  };

  return (
    <div className="splash-overlay" role="alertdialog" aria-modal="true" aria-label="Goodbye">
      <div className="splash-card goodbye-card">
        <div className="splash-icon goodbye-icon"><i className="fas fa-heart" /></div>
        <h1 className="splash-title">Goodbye</h1>
        <p className="splash-message">
          This is likely the end of PHMC Forms for: <strong>{blockText}</strong>.
          I want to thank every one of you that&apos;s contributed, helped and
          otherwise been around — it&apos;s been a huge effort spanning {GOODBYE_STATS.since} and {GOODBYE_STATS.commits} commits,
          along with {GOODBYE_STATS.linesChanged} lines changed.
        </p>
        <p className="splash-message">
          The forms will remain available for LEO factions, as per agreement with
          Senior Leadership of PHMC. In the event of a website issue, outage or
          otherwise, these forms will temporarily be restored until the issue is resolved.
        </p>
        <div className="splash-actions">
          {isPhmcMember ? (
            <button className="splash-dismiss" onClick={onDismiss}>
              Continue to dashboard
            </button>
          ) : isAuthenticated ? (
            <button className="splash-dismiss splash-primary" onClick={goMorgue}>
              {leoLabel}
            </button>
          ) : (
            <button className="splash-dismiss splash-primary" onClick={goSignIn}>
              Sign In
            </button>
          )}
          <button className="splash-dismiss splash-quiet" onClick={onAcknowledge}>
            Acknowledge, don&apos;t show again
          </button>
        </div>
        {!isPhmcMember && !isAuthenticated && (
          <p
            className="splash-note"
            title="This is intended for LEO Factions, abuse of this service and/or our records will be reported to Legal Faction Management"
          >
            <i className="fas fa-info-circle" /> This service is intended for LEO
            factions — abuse of this service and/or our records will be reported
            to Legal Faction Management.
          </p>
        )}
      </div>
    </div>
  );
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
  const cachedGoodbye = readGoodbyeCache();
  const [status, setStatus] = useState(cached?.active ? 'active' : 'loading');
  const [splash, setSplash] = useState(cached && cached.active ? cached : null);
  const [goodbye, setGoodbye] = useState(cachedGoodbye && cachedGoodbye.active ? cachedGoodbye : null);
  const [goodbyeStatus, setGoodbyeStatus] = useState(cachedGoodbye?.active ? 'active' : 'loading');
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('maintenance-splash-dismissed') === '1'
  );
  // In-memory only (see note on dismiss keys above): a reload brings the
  // goodbye back while blocks remain retired.
  const [goodbyeDismissed, setGoodbyeDismissed] = useState(false);
  // Persistent per-retirement opt-out ("Acknowledge, don't show again").
  const [goodbyeAck, setGoodbyeAck] = useState(() => readGoodbyeAck());
  const { isPhmcMember } = useGtaWorldAuth();

  // Live source of truth — refreshes the cached splash state.

  // Live source of truth — refreshes the cached splash state.
  useEffect(() => {
    const splashRef = ref(database, 'appMetadata/maintenance/splash');
    const unsub = onValue(splashRef, (snap) => {
      const next = snap.val() || null;
      setSplash(next);
      writeCache(next);
      setStatus(next && next.active ? 'active' : 'clear');
    });
    const goodbyeRef = ref(database, 'appMetadata/goodbye');
    const unsubGoodbye = onValue(goodbyeRef, (snap) => {
      const next = snap.val() || null;
      setGoodbye(next);
      writeGoodbyeCache(next);
      setGoodbyeStatus(next && next.active ? 'active' : 'clear');
    });
    return () => { unsub(); unsubGoodbye(); };
  }, []);

  // When an operator lifts the splash remotely, clear the local dismiss so a
  // future outage surfaces again instead of being hidden by a stale dismiss.
  useEffect(() => {
    if (splash && !splash.active) {
      sessionStorage.removeItem('maintenance-splash-dismissed');
      setDismissed(false);
    }
  }, [splash]);

  // Reset the in-memory goodbye dismiss when the message is lifted, so a
  // later retirement surfaces again within the same tab session. The persisted
  // ack is cleared too — a fresh retirement is a fresh notice.
  useEffect(() => {
    if (goodbye && !goodbye.active) {
      setGoodbyeDismissed(false);
      setGoodbyeAck('');
      clearGoodbyeAck();
    }
  }, [goodbye]);

  const dismiss = () => {
    sessionStorage.setItem('maintenance-splash-dismissed', '1');
    setDismissed(true);
  };

  const dismissGoodbye = () => {
    setGoodbyeDismissed(true);
  };

  const acknowledgeGoodbye = () => {
    // Persist this exact retirement so the card stays away across reloads;
    // any different block combination has a different signature and resurfaces.
    const sig = retiredKeys(goodbye?.blocks);
    writeGoodbyeAck(sig);
    setGoodbyeAck(sig);
    setGoodbyeDismissed(true);
  };

  if (status === 'loading' || goodbyeStatus === 'loading') {
    return <AppLoadingScreen />;
  }

  const active = status === 'active' && splash && splash.active && !dismissed;

  if (!active) {
    const acked = goodbye && retiredKeys(goodbye.blocks) !== '' && retiredKeys(goodbye.blocks) === goodbyeAck;
    const goodbyeActive = goodbyeStatus === 'active' && goodbye && goodbye.active && !goodbyeDismissed && !acked;
    if (goodbyeActive) return <GoodbyeCard goodbye={goodbye} onDismiss={dismissGoodbye} onAcknowledge={acknowledgeGoodbye} />;
    return children;
  }

  const lastUpdated = splash.updatedAt ? new Date(splash.updatedAt).toLocaleString() : '';

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
