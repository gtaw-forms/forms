// One-time staff guide: "how LSPD coroner emails work now".
// Versioned localStorage flag — bump GUIDE_VERSION to re-show after copy changes.
export const GUIDE_VERSION = 'v1';
const GUIDE_KEY = `phmc-lspd-guide-seen:${GUIDE_VERSION}`;

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** True once this browser has dismissed the guide (private-mode safe). */
export function hasSeenLspdGuide() {
  try {
    return storage()?.getItem(GUIDE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Persist dismissal (per browser, versioned). Never throws. */
export function markLspdGuideSeen() {
  try {
    storage()?.setItem(GUIDE_KEY, '1');
  } catch {
    /* ignore quota/private-mode errors */
  }
}
