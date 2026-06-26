/**
 * Utility to manage consolidated configuration from a single JSON secret.
 * This helps reduce Google Cloud Secrets Manager costs by using only one secret.
 */

let memoizedConfig = null;

/**
 * Loads and parses the PHMC_CONFIG secret from environment variables.
 * @returns {Object} The parsed configuration object or an empty object if not found/invalid.
 */
export const getConfig = () => {
    if (memoizedConfig) return memoizedConfig;

    const rawConfig = process.env.PHMC_CONFIG;
    if (!rawConfig) {
        console.warn('[Config] PHMC_CONFIG environment variable is not set.');
        return {};
    }

    try {
        memoizedConfig = JSON.parse(rawConfig);
        return memoizedConfig;
    } catch (error) {
        console.error('[Config] Failed to parse PHMC_CONFIG as JSON:', error);
        return {};
    }
};

/**
 * Convenience helper to get a specific value from the config.
 * @param {string} key The config key to retrieve.
 * @param {any} defaultValue Default value if key is missing.
 * @returns {any}
 */
export const getConfigValue = (key, defaultValue = null) => {
    const config = getConfig();
    return config[key] !== undefined ? config[key] : (process.env[key] || defaultValue);
};
