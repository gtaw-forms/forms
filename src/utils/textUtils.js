// Shared text utilities across the app

/**
 * Normalize rank/category text for consistent display and storage.
 * - Replaces hyphens with single spaces
 * - Collapses multiple whitespace
 * - Trims edges
 */
export const cleanRankText = (text) => {
  if (!text) return '';
  // 1. Remove trailing special chars (dashes, underscores, etc) often found in GTAW ranks
  let cleaned = String(text).replace(/[-_ \s]+$/, '');
  // 2. Replace internal hyphens/underscores with spaces
  cleaned = cleaned.replace(/[-_]/g, ' ');
  // 3. Collapse multiple whitespace and trim
  return cleaned.replace(/\s+/g, ' ').trim();
};
