/**
 * Component Preloader Utility
 * Intelligently prefetches components based on user interaction patterns
 */

const preloadedComponents = new Set();

/**
 * Preload a component during idle time
 * @param {Function} importFn - The dynamic import function
 * @param {string} componentName - Name for tracking
 */
export const preloadComponent = (importFn, componentName = 'unknown') => {
  if (preloadedComponents.has(componentName)) {
    return Promise.resolve();
  }

  const loadComponent = () => {
    preloadedComponents.add(componentName);
    return importFn().catch(err => {
      console.warn(`Failed to preload ${componentName}:`, err);
      preloadedComponents.delete(componentName);
    });
  };

  // Use requestIdleCallback if available, otherwise setTimeout
  if ('requestIdleCallback' in window) {
    return new Promise(resolve => {
      window.requestIdleCallback(
        () => {
          loadComponent().then(resolve);
        },
        { timeout: 2000 }
      );
    });
  } else {
    return new Promise(resolve => {
      setTimeout(() => {
        loadComponent().then(resolve);
      }, 0);
    });
  }
};

/**
 * Preload multiple components in sequence
 * @param {Array<{importFn: Function, name: string}>} components
 */
export const preloadComponents = async (components) => {
  for (const { importFn, name } of components) {
    await preloadComponent(importFn, name);
  }
};

/**
 * Preload components on hover (for buttons/links)
 * @param {Function} importFn
 * @param {string} componentName
 */
export const createHoverPreloader = (importFn, componentName) => {
  let hasPreloaded = false;

  return () => {
    if (!hasPreloaded) {
      hasPreloaded = true;
      preloadComponent(importFn, componentName);
    }
  };
};

/**
 * Get list of preloaded components
 */
export const getPreloadedComponents = () => {
  return Array.from(preloadedComponents);
};

/**
 * Clear preloaded components tracking (for testing)
 */
export const clearPreloadedTracking = () => {
  preloadedComponents.clear();
};
