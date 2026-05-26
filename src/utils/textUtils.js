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
 * Helper: escape HTML characters for safe insertion into DOM.
 */
export const escapeHtml = (unsafe) => {
  if (!unsafe || typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/**
 * Renders basic Markdown (Bold, Italic, Underline) to HTML.
 * Supports combinations like **__text__** or ***__text__***.
 */
export const renderInlineMarkdown = (text) => {
  if (!text) return '';

  // 1. Escape HTML first
  let html = escapeHtml(text);

  // 2. Combinations (Triple)
  html = html.replace(/\*\*\*__(.*?)__\*\*\*/g, '<strong><em><u>$1</u></em></strong>');
  html = html.replace(/__\*\*\*(.*?)\*\*\*__/g, '<u><strong><em>$1</em></strong></u>');

  // 3. Combinations (Double)
  html = html.replace(/\*\*__(.*?)__\*\*/g, '<strong><u>$1</u></strong>');
  html = html.replace(/__\*\*(.*?)\*\*__/g, '<u><strong>$1</strong></u>');
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');

  // 4. Combinations (Single + Underline)
  html = html.replace(/\*__(.*?)__\*/g, '<em><u>$1</u></em>');
  html = html.replace(/__\*(.*?)\*__/g, '<u><em>$1</em></u>');

  // 5. Basic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.*?)__/g, '<u>$1</u>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  return html;
};

/**
 * Renders full Markdown including block elements (lists, paragraphs).
 */
export const renderMarkdown = (text) => {
  if (!text) return '';

  const lines = text.split('\n');
  let htmlResult = [];
  let openLists = [];

  lines.forEach(line => {
    const trimmed = line.trim();

    // Handle horizontal lines (--- or [hr])
    if (trimmed === '---' || trimmed.toLowerCase() === '[hr]') {
      while (openLists.length > 0) { 
        htmlResult.push('</ul>'); 
        openLists.pop(); 
      }
      htmlResult.push('<hr style="border: 0; border-top: 1px solid #30363d; margin: 15px 0;" />');
      return;
    }

    // Handle custom list levels from EMS Dashboard (> and >>)
    let level = trimmed.startsWith('>>') ? 2 : trimmed.startsWith('>') ? 1 : 0;
    
    if (level > 0) {
      const lineContent = trimmed.substring(level).trim();
      while (openLists.length > level) { 
        htmlResult.push('</ul>'); 
        openLists.pop(); 
      }
      while (openLists.length < level) { 
        htmlResult.push('<ul style="margin-bottom: 5px;">'); 
        openLists.push('ul'); 
      }
      htmlResult.push(`<li>${renderInlineMarkdown(lineContent)}</li>`);
    } else {
      while (openLists.length > 0) { 
        htmlResult.push('</ul>'); 
        openLists.pop(); 
      }
      if (trimmed) {
        htmlResult.push(`<p style="margin-bottom: 8px;">${renderInlineMarkdown(trimmed)}</p>`);
      }
    }
  });

  while (openLists.length > 0) { 
    htmlResult.push('</ul>'); 
    openLists.pop(); 
  }

  return htmlResult.join('');
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
 * Sanitize morgue text to handle malformed characters (like \uFFFD) 
 * and other common encoding artifacts from copy-pasting.
 */
export const sanitizeMorgueText = (text) => {
    if (!text || typeof text !== 'string') return '';
    
    // 1. Replace the common replacement character (\uFFFD) with a hyphen.
    let sanitized = text.replace(/\uFFFD/g, '-');
    
    // 2. Normalize line endings: replace \r\n and \r with \n
    sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // 3. Remove other non-printable control characters
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
    
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
