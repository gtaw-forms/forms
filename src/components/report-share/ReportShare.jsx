// Report share page — the landing point of a portal deep link:
//
//   #/report/<author>/<key>
//
// This is what a law-enforcement notice links to ("A Coroner Report has been
// finalized and is available to view on the PHMC portal"). The full report
// document therefore never has to survive someone else's message composer: the
// notice carries a reference and a URL, the document stays here.
//
// Rules this page keeps:
//   • Sign-in first. Reports are private; getSavedReport only answers a
//     signed-in caller (read policy set 2026-10-02), and the link itself is not
//     a credential — anyone with the URL still needs an account.
//   • One report only. ReportView renders in `readOnly` mode, which drops the
//     dataset switcher, the back button and the raw payload, so a visitor
//     cannot pivot to other reports or see the internal record shape.
//   • Every open is audited (triggerLogReportView, context 'report-link'), same
//     as the records UI — attribution comes from verified Auth claims.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import { useNotification } from '../../contexts/NotificationContext';
import { triggerLogReportView } from '../../services/firebaseFunctions';
import { useMigrationRecords } from '../migration-ui/useMigrationRecords';
import { kindFromFormId, recordTitle } from '../migration-ui/viewModel';
import ReportView from '../migration-ui/ReportView';
import ReportShareSidebar from './ReportShareSidebar';
import { buildReportPath, buildShortReportPath, isValidReportRef, isValidShareCode } from './shareLink';
import { readShareCode } from '../../utils/shareCodes';
import './ReportShare.css';

const CONTEXT = 'report-link';

/** Signed-in display name, mirroring the records UI's identity fallbacks. */
function viewerNameFor(user, characterName) {
  return characterName
    || user?.activeCharacter?.characterName
    || user?.faction?.characterName
    || user?.character?.[0]?.name
    || user?.character?.[0]?.characterName
    || user?.characters?.[0]?.name
    || user?.characters?.[0]?.characterName
    || user?.username
    || '';
}

function Shell({ children }) {
  return (
    <div className="pmc pmc-embed">
      <div className="shell">
        <ReportShareSidebar />
        <main>
          <div className="wrap">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function ReportShare() {
  const { author = '', key = '', code = '' } = useParams();
  const { showNotification } = useNotification();
  const { isAuthenticated, isLoading, user, characterName, login } = useGtaWorldAuth();
  const { fetchDetail } = useMigrationRecords();

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Short-code resolution (`#/r/<code>` → author/key via the RTDB index).
  const [resolved, setResolved] = useState(null);

  const isShort = !author && !!code;
  const valid = isShort
    ? isValidShareCode(code)
    : isValidReportRef(author, key);
  const refAuthor = isShort ? (resolved?.author || '') : author;
  const refKey = isShort ? (resolved?.key || '') : key;
  const returnPath = useMemo(
    () => {
      if (isShort) return valid ? buildShortReportPath(code) : '#/';
      return valid ? buildReportPath(author, key) : '#/';
    },
    [valid, isShort, author, key, code],
  );
  const viewerName = viewerNameFor(user, characterName);

  // Resolve short codes once signed in. The index requires auth (root
  // `auth != null` rule), so resolving logged-out would permission-deny and
  // misreport a good link as mistyped. Signed-out visitors get the sign-in
  // card meanwhile; login returns them here via returnPath.
  useEffect(() => {
    if (!isShort) { setResolved(null); return undefined; }
    if (!isValidShareCode(code)) { setResolved(null); return undefined; }
    if (!isAuthenticated) return undefined;
    let cancelled = false;
    setError('');
    readShareCode(code).then((entry) => {
      if (cancelled) return;
      if (!entry) {
        setError('This share link is not recognised — it may have been mistyped or withdrawn.');
      }
      setResolved(entry);
    });
    return () => { cancelled = true; };
  }, [isShort, code, isAuthenticated]);

  const ready = valid && (!isShort || resolved);

  useEffect(() => {
    if (!ready || !isAuthenticated) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setDetail(null);

    fetchDetail(refAuthor, refKey)
      .then((payload) => {
        if (cancelled) return;
        const report = payload?.report || {};
        const values = report.data && typeof report.data === 'object' ? report.data : {};
        const kind = kindFromFormId(report.formId);
        setDetail({
          kind,
          values,
          title: report.originalKey || recordTitle(kind, values),
          meta: {
            savedAt: Number(report.timestamp) || 0,
            updatedAt: Number(payload?.updatedAt) || 0,
          },
        });
        // Everyone who opens a report is recorded (fire-and-forget).
        // Sample rows stay local: never audited.
        if (refAuthor !== 'Demo_Author') {
          triggerLogReportView({ author: refAuthor, key: refKey, context: CONTEXT, characterName: viewerName })
            .catch(() => {});
        }
      })
      .catch((e) => {
        if (cancelled) return;
        const errCode = e?.code || '';
        setError(
          errCode === 'functions/not-found' || errCode === 'not-found'
            ? 'This report no longer exists. It may have been withdrawn or replaced.'
            : errCode === 'functions/permission-denied' || errCode === 'permission-denied'
              ? 'Your account is not allowed to open this report.'
              : `The report could not be loaded${e?.message ? `: ${e.message}` : '.'}`,
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [ready, isAuthenticated, refAuthor, refKey, fetchDetail, viewerName]);

  const handleSignIn = useCallback(() => {
    login({
      role: 'non-employee', // report reads need an account, not PHMC membership
      returnPath,
      onError: (message) => showNotification(`Sign in failed: ${message}`, 'error'),
    });
  }, [login, returnPath, showNotification]);

  if (!valid) {
    return (
      <Shell>
        <div className="notice err">
          This report link is not valid — the report address is incomplete or malformed.
        </div>
        <p className="share-hint">
          Ask the Forensic Medicine and Pathology Department for a fresh link, and quote the report
          reference from the notice you received.
        </p>
      </Shell>
    );
  }

  if (isLoading) {
    return (
      <Shell>
        <div className="notice">Restoring your session…</div>
      </Shell>
    );
  }

  if (!isAuthenticated) {
    return (
      <Shell>
        <div className="card">
          <h2><span className="ic">⚿</span>Sign in to view this report</h2>
          <div className="body">
            <p className="share-lead">
              Coroner Reports are restricted. Sign in with the GTA:World account you use at work
              and you will be brought straight back to this report.
            </p>
            <ul className="share-list">
              <li>The report stays on the PHMC portal — nothing is downloaded or emailed.</li>
              <li>Each view is recorded against your account for the report&apos;s audit trail.</li>
            </ul>
            <div className="share-actions">
              <button type="button" className="btn" onClick={handleSignIn}>
                Sign in with GTA:World
              </button>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  if (loading || (!detail && !error)) {
    return (
      <Shell>
        <div className="notice">Loading report…</div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <div className="notice err">{error}</div>
        <p className="share-hint">
          If you were sent this link for a case you are working, contact the Forensic Medicine and
          Pathology Department and quote the report reference from the notice.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <ReportView
        readOnly
        kind={detail.kind}
        values={detail.values}
        title={detail.title}
        meta={detail.meta}
        author={refAuthor}
        reportKey={refKey}
      />
      <p className="share-hint">
        Report reference: <span className="mono">{detail.title}</span>
        {viewerName ? <> · viewed as {viewerName}</> : null}
        {' '}· this view has been recorded.
      </p>
    </Shell>
  );
}
