/**
 * Staging path resolver — shared between DataContext and write components.
 *
 * A staging mode routes all forms reads/writes from /forms to /forms_staging,
 * and version tracking from appMetadata/formsDataVersion to
 * appMetadata/formsDataVersion_staging.
 *
 * Activation (in priority order):
 *   1. ?staging=1  in URL  → staging ON
 *   2. ?staging=0  in URL  → staging OFF (overrides localhost default)
 *   3. localhost            → staging ON by default
 *   4. localStorage flag    → phmc_staging = 'true'
 */

const STAGING_SEGMENTS = ['forms'];

export const isStagingMode = () => {
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  if (params.has('staging')) return params.get('staging') === '1';

  // Localhost no longer defaults to staging — use ?staging=1 or phmc_staging=true to enable

  return localStorage.getItem('phmc_staging') === 'true';
};

/**
 * Resolve a cache segment / Firebase path to its staging equivalent.
 * e.g. 'forms' → 'forms_staging' (when staging is active)
 */
export const resolveStagingPath = (segment) => {
  if (STAGING_SEGMENTS.includes(segment) && isStagingMode()) {
    return `${segment}_staging`;
  }
  return segment;
};

/**
 * Resolve a metadata version ref path for staging.
 * e.g. 'appMetadata/formsDataVersion' → 'appMetadata/formsDataVersion_staging'
 */
export const resolveVersionRef = (basePath) => {
  if (!isStagingMode()) return basePath;
  // Expects paths like "appMetadata/formsDataVersion"
  const parts = basePath.split('/');
  const last = parts[parts.length - 1];
  parts[parts.length - 1] = `${last}_staging`;
  return parts.join('/');
};

/**
 * Get the localStorage version key for a given base key.
 * e.g. 'formsDataVersion' → 'formsDataVersion_staging' (when staging)
 */
export const resolveVersionKey = (baseKey) => {
  if (!isStagingMode()) return baseKey;
  return `${baseKey}_staging`;
};
