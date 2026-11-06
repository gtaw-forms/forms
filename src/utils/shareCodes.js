// Share-code index (RTDB) — maps short codes to report addresses and back.
//
//   shortLinks/<code>              = { author, key, formId, createdAt }
//   shortLinksByReport/<author>/<key> = <code>
//
// Root database rules already grant authed read/write, so no rules change is
// needed. Writes are create-wins (never overwrite a live code); reads are
// best-effort — every caller falls back to the long `#/report/` link.
import { database } from '../firebase';
import { ref, get, set } from 'firebase/database';
import { generateShareCode } from '../components/report-share/shareLink';

const CODE_NODE = 'shortLinks';
const REVERSE_NODE = 'shortLinksByReport';
const ASSIGN_ATTEMPTS = 5;

/** Read one code entry ({ author, key } or null). */
export async function readShareCode(code) {
  try {
    const snap = await get(ref(database, `${CODE_NODE}/${code}`));
    const v = snap.exists() ? snap.val() : null;
    if (!v || typeof v.author !== 'string' || typeof v.key !== 'string') return null;
    return { author: v.author, key: v.key };
  } catch {
    return null;
  }
}

/** Existing code for a report address, or null. */
export async function codeForReport(author, key) {
  try {
    if (!author || !key) return null;
    const snap = await get(ref(database, `${REVERSE_NODE}/${author}/${key}`));
    const code = snap.exists() ? snap.val() : null;
    return typeof code === 'string' && code ? code : null;
  } catch {
    return null;
  }
}

/**
 * Ensure a report has a code: return the existing one, else generate + write
 * both index directions (create-wins verified per attempt). Never throws —
 * callers fall back to long links when this returns null.
 */
export async function ensureShareCode({ author, key, formId = '' } = {}) {
  try {
    if (!author || !key) return null;
    const existing = await codeForReport(author, key);
    if (existing) return existing;
    for (let i = 0; i < ASSIGN_ATTEMPTS; i++) {
      const code = generateShareCode();
      const taken = await readShareCode(code);
      if (taken && (taken.author !== author || taken.key !== key)) continue;
      try {
        await set(ref(database, `${CODE_NODE}/${code}`), {
          author, key, formId: String(formId || ''), createdAt: new Date().toISOString(),
        });
        await set(ref(database, `${REVERSE_NODE}/${author}/${key}`), code);
        return code;
      } catch {
        // Lost a race (or offline) — try a fresh code.
      }
    }
    return null;
  } catch {
    return null;
  }
}
