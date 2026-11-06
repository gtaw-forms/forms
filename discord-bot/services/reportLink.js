/**
 * reportLink.js — portal deep links for bot-sent notices.
 *
 * Prefers short `#/r/<code>` links (RTDB `shortLinksByReport/<author>/<key>`,
 * written at save time + backfill), falling back to the long
 * `#/report/<author>/<key>` form. Callers pass their admin-database handle;
 * every failure mode returns the long link — a notice never fails closed on
 * link shortening.
 */
import { buildReportUrl, buildShortReportUrl } from './lspdReportRoute.js';

const SITE_BASE = (process.env.PHMC_SITE_URL || 'https://gtaw-forms.github.io/forms/').trim()
  || 'https://gtaw-forms.github.io/forms/';

/** Short code recorded for a report address, or null. */
export async function shortCodeForReport(db, author, key) {
  try {
    if (!db || !author || !key) return null;
    const ref = typeof db.ref === 'function' ? db.ref(`shortLinksByReport/${author}/${key}`) : null;
    if (!ref) return null;
    const snap = await ref.once('value');
    const code = snap.exists() ? snap.val() : null;
    return typeof code === 'string' && code ? code : null;
  } catch {
    return null;
  }
}

/**
 * Best portal URL for a report: short link when the index has a code,
 * long link otherwise (and when author/key are missing, '' so callers can
 * still fail closed on unbuildable links).
 */
export async function portalReportUrl(db, { author, key, baseUrl = SITE_BASE } = {}) {
  const cleanAuthor = String(author ?? '').trim();
  const cleanKey = String(key ?? '').trim();
  if (!cleanAuthor || !cleanKey) return '';
  const code = await shortCodeForReport(db, cleanAuthor, cleanKey);
  if (code) return buildShortReportUrl(code, baseUrl);
  return buildReportUrl(cleanAuthor, cleanKey, baseUrl);
}
