/**
 * shareCode.js — helpers for the report share-code index.
 *
 *   shortLinks/<code>                  = { author, key, formId, createdAt }
 *   shortLinksByReport/<author>/<key>  = <code>
 *
 * The reverse entry (report -> code) is what keeps a report's link stable, and
 * the 2026-11-14 rules lockdown scopes its write to the report's author. That
 * means anyone who can *read* a report (all signed-in users, the getSavedReport
 * policy) but did not write it — an LEO officer opening a forwarded coroner
 * report, a colleague sharing a teammate's report — cannot mint the code
 * client-side. The ensureReportShareCode callable does it with the Admin SDK
 * after checking the report exists, and this module holds the pure parts so the
 * callable and its tests agree.
 *
 * Pure module: no firebase imports, so vitest can load it directly.
 */
import { randomBytes } from 'crypto';

/** Unambiguous alphabet (no 0/O, 1/l/I), URL-safe. Mirrors the client. */
export const SHARE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/** Length of a share code (`#/r/Ab3k9Q`). */
export const SHARE_CODE_LENGTH = 6;

/** Longest accepted author/key segment. */
export const MAX_SEGMENT_LENGTH = 200;

/**
 * True when a value can be used as one RTDB path segment for a report address.
 * RTDB forbids `. # $ [ ] /` in keys, and control characters have no business
 * in a report address (log-injection defence). Sanity check only — the
 * callable still requires a signed-in caller and an existing report.
 */
export function isShareSegment(value) {
    if (typeof value !== 'string') return false;
    const text = value.trim();
    if (!text || text.length > MAX_SEGMENT_LENGTH) return false;
    if (/[\u0000-\u001f\u007f]/.test(text)) return false;
    return !/[.#$[\]/]/.test(text);
}

/**
 * Random share code from the unambiguous alphabet.
 * `bytes` is injectable so tests can pin the output.
 */
export function newShareCode(byteSource = randomBytes) {
    const bytes = byteSource(SHARE_CODE_LENGTH);
    let code = '';
    for (let i = 0; i < SHARE_CODE_LENGTH; i++) {
        code += SHARE_CODE_ALPHABET[bytes[i] % SHARE_CODE_ALPHABET.length];
    }
    return code;
}
