/**
 * apiConsumerBlock.js — per-consumer API revocation with an explicit reason.
 *
 * When a consumer's access is cut (e.g. LSSD staff request), deleting the key
 * outright yields a generic 401 that looks like a bug. A blocked LABEL keeps
 * the key validating and returns 403 + a contact message so the consumer
 * knows exactly who can restore access. Matching is label-based (never key
 * material); unknown/invalid keys still get the generic 401 so the block
 * list never leaks to random probers.
 *
 * Dependency-free: unit-tested in tests/api-consumer-block.test.js.
 */

export const BLOCKED_MESSAGE =
  'Contact PHMC CORONER LEADERSHIP - ALYSON FROST / FR0STYDEV to restore access | BLOCKED: 02958e - This application is not authorized to use PHMC Tools';

/** Parse a comma-separated label list (`MORGUE_BLOCKED_KEY_LABELS`). */
export function parseBlockedLabels(raw) {
  return new Set(
    String(raw || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** True when this consumer label is blocked (case-insensitive). */
export function isBlockedLabel(label, blockedSet) {
  const norm = String(label || '').trim().toLowerCase();
  return !!norm && !!blockedSet && blockedSet.has(norm);
}
