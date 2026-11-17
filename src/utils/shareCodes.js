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
import { triggerEnsureReportShareCode } from '../services/firebaseFunctions';

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
 * Ensure a report has a code, returning it or null (never throws — callers fall
 * back to long links).
 *
 * `preferLocal` is for the author's own save path (`useFormSaver`): the saver
 * wrote the report, so the author-scoped reverse index accepts a direct write
 * and no callable invocation is needed. Every other surface (records view, LEO
 * reports) goes server-first, because a viewer who did not write the report can
 * read it but cannot write `shortLinksByReport/<author>/<key>`.
 */
export async function ensureShareCode({ author, key, formId = '', preferLocal = false } = {}) {
  if (!author || !key) return null;

  if (!preferLocal) {
    try {
      const minted = await triggerEnsureReportShareCode({ author, key, formId });
      if (minted?.code) return String(minted.code);
    } catch {
      // Callable unavailable (undeployed/offline): fall through to the local path.
    }
  }

  try {
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
      } catch {
        // Code collided (or offline) — try a fresh one.
        continue;
      }
      try {
        await set(ref(database, `${REVERSE_NODE}/${author}/${key}`), code);
        return code;
      } catch {
        // The report -> code binding was refused (not the author, or offline).
        // Retrying would only mint more unused shortLinks entries, so stop: the
        // caller reports no link and the report keeps working without sharing.
        return null;
      }
    }
    return null;
  } catch {
    return null;
  }
}
