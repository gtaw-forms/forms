import React, { useState } from 'react';
import './MigrationNotice.css';
import phmcLogo from '../../assets/phmc.png';

// ── Project totals (refresh before editing this copy) ──
//   git rev-list --count HEAD
//   git log --pretty=tformat: --numstat (sum col 1 + col 2)
// Last measured 2026-09-12: 678 commits, 366,783 additions + 259,097 deletions.
export const MIGRATION_NOTICE_COMMIT_COUNT = 678;
export const MIGRATION_NOTICE_LINE_CHANGES = 625880;

// Bump NOTICE_VERSION to re-show the notice to everyone after copy changes.
const NOTICE_VERSION = 'v1';
const DISMISS_KEY = `phmc-migration-notice-dismissed:${NOTICE_VERSION}`;

/**
 * MigrationNoticeGate — temporary full-screen Notice shown after the app
 * passes the loading screen (rendered inside SplashGate, around the router).
 * Dismissal persists in localStorage (per browser, versioned) so repeat
 * visits don't re-show it, while Coroners / LEO users who rely on Morgue
 * Records can still continue into the app for daily work.
 */
const MigrationNoticeGate = ({ children }) => {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (dismissed) return children;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore private-mode quota errors */
    }
    setDismissed(true);
  };

  return (
    <>
      <div className="migration-notice-overlay" role="alertdialog" aria-modal="true" aria-label="Notice">
        <div className="migration-notice-card">
          <img src={phmcLogo} alt="PHMC" className="migration-notice-logo" />
          <h1 className="migration-notice-title">Notice</h1>
          <div className="migration-notice-body">
            <p>
              PHMC leadership is planning to migrate portions of this site to a
              dedicated PHMC website. At this time, the future of PHMC Forms is
              uncertain.
            </p>
            <p>
              I will aim to keep this project up and running for the Coroners and
              our Law Enforcement partners who work with us daily and rely on our
              Morgue Records. I will share more information when I have it.
            </p>
            <p className="migration-notice-thanks">
              Thank you for the 2 years of development;{' '}
              {MIGRATION_NOTICE_LINE_CHANGES.toLocaleString('en-US')} line changes,
              GitHub updates: {MIGRATION_NOTICE_COMMIT_COUNT.toLocaleString('en-US')}
            </p>
            <p className="migration-notice-contact">
              Any questions, contact Fr0styDev on Discord for more details.
            </p>
          </div>
          <button className="migration-notice-continue" onClick={dismiss}>
            Continue to PHMC Forms
          </button>
        </div>
      </div>
      {/* Keep the app mounted underneath so continuing is instant. */}
      <div style={{ visibility: 'hidden', position: 'fixed', inset: 0, overflow: 'hidden' }} aria-hidden="true">
        {children}
      </div>
    </>
  );
};

export default MigrationNoticeGate;
