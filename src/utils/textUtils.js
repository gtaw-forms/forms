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
