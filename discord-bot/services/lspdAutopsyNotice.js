/**
 * lspdAutopsyNotice.js — LSPD targeting helpers for the autopsy pipeline.
 *
 * Inbox retirement (Nov 2026): the notice builders are gone with the inbox
 * sends. What remains are the two dependency-free helpers the native form
 * filings still need: isLspdAutopsyTarget (LSPD case predicate) and
 * autopsyNoticeRecipient (requesting officer's CHARACTER name, strict).
 *
 * Unit-tested in tests/lspd-autopsy-notice.test.js.
 */

/** True when the autopsy request belongs to LSPD (request tags win; report dept is a hint). */
export function isLspdAutopsyTarget(entry = {}) {
  const faction = String(entry?.faction || '').toLowerCase();
  const tag = (/\[(lssd|lspd)\]/i.exec(entry?.title || '') || [])[1]?.toLowerCase() || '';
  if (faction === 'lspd' || tag === 'lspd') return true;
  if (faction === 'lssd' || tag === 'lssd') return false;
  const dept = String(entry?.parsed?.requesterDept || '').toLowerCase();
  return dept.includes('lspd') || dept.includes('police');
}

/**
 * Portal recipient: the requesting officer's CHARACTER name. Strict — '' when
 * absent so callers fail closed instead of guessing (forum usernames and
 * placeholder names are never valid portal recipients).
 */
export function autopsyNoticeRecipient(entry = {}) {
  return String(entry?.parsed?.requesterName || '').trim();
}
