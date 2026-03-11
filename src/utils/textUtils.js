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
