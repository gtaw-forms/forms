/**
 * Build-version helpers. The deployed index.html is stamped at build/deploy
 * time (tools/deploy.js) with an inline `window.__PHMC_BUILD__` object holding
 * the entry bundle id + builtAt timestamp. Saved reports attach `appBuild` so
 * we can tell which client build produced a report (stale-vs-current).
 */
export const getAppBuildId = () => {
    try {
        const b = (typeof window !== 'undefined') ? window.__PHMC_BUILD__ : null;
        return (b && b.index) ? String(b.index) : null;
    } catch {
        return null;
    }
};

export const getAppBuiltAt = () => {
    try {
        const b = (typeof window !== 'undefined') ? window.__PHMC_BUILD__ : null;
        return (b && b.builtAt) ? String(b.builtAt) : null;
    } catch {
        return null;
    }
};