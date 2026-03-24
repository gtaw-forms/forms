// Shared text utilities across the app

/**
 * Normalize rank/category text for consistent display and storage.
 * - Replaces hyphens with single spaces
 * - Collapses multiple whitespace
 * - Trims edges
 */
export const cleanRankText = (text) => {
  if (!text) return '';
  return String(text).replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
};

/**
 * Sanitize strings for use as Firebase paths/keys.
 * - Replaces ., #, $, [, ], /, and whitespace with a single underscore.
 * - Collapses multiple underscores and trims them from start/end.
 */
export const comprehensiveSanitize = (str) => {
    if (!str || typeof str !== 'string') return '';
    let sanitized = str.trim().replace(/[.#$[/ \]]+/g, '_');
    sanitized = sanitized.replace(/_{2,}/g, '_');
    sanitized = sanitized.replace(/^_+|_+$/g, '');
    return sanitized;
};

/**
 * Formats the access level string for display in the UI.
 * Transforms internal role names into more descriptive, user-friendly text.
 * @param {string} level - The access level string (e.g., 'superadmin', 'admin').
 * @returns {string} The formatted access level string.
 */
export const formatAccessLevel = (level) => {
    if (!level) return 'N/A';
    if (level === 'superadmin' || level === 'president') {
      return 'GTAW-STAFF/DEVELOPER/FORM-DEV';
    }
    // Capitalize other levels for consistency, e.g., 'admin' -> 'Admin'
    return level.charAt(0).toUpperCase() + level.slice(1);
  };
