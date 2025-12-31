import { setGlobalOptions } from "firebase-functions/v2";

// Set global options for all v2 functions in this file
setGlobalOptions({
    region: "us-central1"
});

// Export all functions from sub-modules
export * from './src/auth/index.js';
export * from './src/maintenance/index.js';
export * from './src/maintenance/monitor.js';
export * from './src/reports/index.js';
export * from './src/utils/media.js';