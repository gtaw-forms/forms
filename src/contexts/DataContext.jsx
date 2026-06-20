import React, { createContext, useState, useEffect, useContext, useCallback, useRef, useMemo } from 'react';
import { database } from '../firebase';
import { ref, get, onValue } from 'firebase/database';
import { useNotification } from './NotificationContext.jsx';
import { useWebhooks } from '../hooks/useWebhooks';
import { useInactivityReload } from '../hooks/useInactivityReload';
import useGtaWorldAuth from '../hooks/useGtaWorldAuth';

// Cache versions below this threshold are considered dead/broken and force a fresh fetch.
// Bump this after fixing cache-corruption bugs to invalidate all stale client caches.
const MINIMUM_VALID_VERSION = 134;

// Define cache segments
const CACHE_SEGMENTS = {
    FACTIONS: 'factions',
    AGENCIES: 'agencies',
    SELECT_OPTIONS: 'selectOptions',
    FORMS: 'forms',
    LSCC: 'lscc',
    VERIFIED_ADMINS: 'verified_admins',
    MORGUE_RECORDS: 'morgue-records',
};

// Define segments that should not be cached in localStorage
const EXCLUDED_FROM_CACHE = ['savedReports'];

const DataContext = createContext();

export const useData = () => {
    return useContext(DataContext);
};

export const DataProvider = ({ children }) => {
    const { user, isAuthenticated } = useGtaWorldAuth();
        const { showNotification, removeNotification } = useNotification();
    const { getIsInactivityWarningTriggered } = useInactivityReload();
        const [factionsData, setFactionsData] = useState({});
    const [agencyDataStore, setAgencyDataStore] = useState({});
    const [selectOptions, setSelectOptions] = useState({});
    const [morgueRecords, setMorgueRecords] = useState([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [pendingRefreshInfo, setPendingRefreshInfo] = useState(null);

    const debounceTimers = useRef({});

const webhooks = useWebhooks(null, null, showNotification, getIsInactivityWarningTriggered);
    const CORONER_KEYWORDS = ['Coroner', 'Examiner', 'Attendant'];
    const updateCacheSegment = useCallback(async (segment, data) => {
        // Update memory cache
        dataCache.current[segment] = data;

        // Skip localStorage for undefined/null segments
        if (!segment) return;

        // Don't cache excluded segments in localStorage
        if (!EXCLUDED_FROM_CACHE.includes(segment)) {
            try {
                const version = getSegmentVersion(segment);
                localStorage.setItem(getCacheKey(segment), JSON.stringify(data));
                localStorage.setItem(getTimestampKey(segment), Date.now().toString());
                localStorage.setItem(getVersionKey(segment), version);
                
                const cachedDataSize = (JSON.stringify(data)?.length || 0) / 1024;
                let logMessage = `💾 Updated cache segment: ${segment} (v${version}) (${cachedDataSize.toFixed(2)} KB)`;

                // If updating the forms segment, append the Firebase Data version
                if (segment === CACHE_SEGMENTS.FORMS) {
                    const firebaseDataVersion = localStorage.getItem('formsDataVersion') || 'N/A';
                    logMessage = `💾 Updated cache segment: forms (${cachedDataSize.toFixed(2)} KB) | InternalDataContext v${version} | Firebase Data: v${firebaseDataVersion}`;
                }
                console.debug(logMessage);

            } catch (error) {
                console.warn(`Failed to update cache for ${segment}:`, error);
                // If we hit quota, clear all cache segments to make space
                console.log(`Clearing all cache segments due to storage error on segment: ${segment}`);
                Object.values(CACHE_SEGMENTS).forEach(s => {
                    if (s && !EXCLUDED_FROM_CACHE.includes(s)) {
                        try {
                            localStorage.removeItem(getCacheKey(s));
                            localStorage.removeItem(getTimestampKey(s));
                            localStorage.removeItem(getVersionKey(s));
                        } catch (clearError) {
                            console.error(`Failed to clear cache for segment ${s}:`, clearError);
                        }
                    }
                });
                // Retry the write after clearing space
                try {
                    const version = getSegmentVersion(segment);
                    localStorage.setItem(getCacheKey(segment), JSON.stringify(data));
                    localStorage.setItem(getTimestampKey(segment), Date.now().toString());
                    localStorage.setItem(getVersionKey(segment), version);
                } catch (retryError) {
                    console.warn(`Retry failed for ${segment}: localStorage still full.`);
                }
            }
        }
        else {
            console.log(`⏩ Skipping localStorage cache for ${segment} (excluded segment)`);
        }

        // Update relevant state based on segment
        switch (segment) {
            case CACHE_SEGMENTS.FACTIONS:
                setFactionsData(data || {});
                break;
            case CACHE_SEGMENTS.AGENCIES:
                setAgencyDataStore(data || {});
                break;
            case CACHE_SEGMENTS.SELECT_OPTIONS:
                setSelectOptions(data);
                break;
            case CACHE_SEGMENTS.FORMS: {
                // Ensure formsData is always an array
                const formsAsList = Array.isArray(data) ? data : (data ? Object.keys(data).map(key => ({ ...data[key], firebaseKey: key })) : []);
                setFormsData(formsAsList);
                break;
            }
            case CACHE_SEGMENTS.LSCC:
                setLsccData(data || {});
                break;
            case CACHE_SEGMENTS.VERIFIED_ADMINS:
                setVerifiedAdmins(data || {});
                break;
            case CACHE_SEGMENTS.MORGUE_RECORDS: {
                const morgueAsList = data ? Object.keys(data).map(key => ({ ...data[key], firebaseKey: key })) : [];
                setMorgueRecords(morgueAsList);
                break;
            }
            default:
                console.warn(`Unknown cache segment: ${segment}`);
        }
    }, [isAuthenticated, user, webhooks]);

    const updateStateWithData = (data) => {
        Object.entries(CACHE_SEGMENTS).forEach(([key, segment]) => {
            if (data[segment]) {
                updateCacheSegment(segment, data[segment]);
            }
        });
    };



    const [formsData, setFormsData] = useState([]);
    const [lsccData, setLsccData] = useState({}); // New state for LSCC data
    const [verifiedAdmins, setVerifiedAdmins] = useState({}); // New state for verified admins
    const [hasFirebaseError, setHasFirebaseError] = useState(false);

    // Segmented cache for fetched data
    const dataCache = useRef({});
    const didLoadFromCache = useRef(false); // Flag to track if cache was used
    const dataInitializedRef = useRef(false); // Flag to track if initial data load is complete
    const hasLoggedInitialLoad = useRef(false); // Flag to prevent duplicate logging in StrictMode
    const [dataLoaded, setDataLoaded] = useState(false);
    const firebaseListeners = useRef({});

    // Cache configuration
    const CACHE_PREFIX = 'firebaseCache';
    const CACHE_EXPIRY = 1000 * 60 * 60 * 24 * 30; // 30 days in milliseconds
    const LOCAL_STORAGE_SAFETY_VERSION = '1.0'; // Manually bump this to clear all localStorage if needed

    // Version configuration for each segment, some versions are dynamic updated in Firebase but manually bump if required
    const SEGMENT_VERSIONS = {
        [CACHE_SEGMENTS.FACTIONS]: '1.2',
        [CACHE_SEGMENTS.AGENCIES]: '1.1',
        [CACHE_SEGMENTS.FORMS]: '1.2.3', 
        [CACHE_SEGMENTS.LSCC]: '1.0',
        [CACHE_SEGMENTS.VERIFIED_ADMINS]: '1.0',
        [CACHE_SEGMENTS.MORGUE_RECORDS]: '1.0',
    };

    const getSegmentVersion = (segment) => {
        if (segment === CACHE_SEGMENTS.FORMS) return localStorage.getItem('formsDataVersion') || '0';
        if (segment === CACHE_SEGMENTS.FACTIONS) return localStorage.getItem('factionsDataVersion') || '0';
        if (segment === CACHE_SEGMENTS.SELECT_OPTIONS) return localStorage.getItem('selectOptionsDataVersion') || '0';
        if (segment === CACHE_SEGMENTS.LSCC) return localStorage.getItem('lsccDataVersion') || '0';
        return SEGMENT_VERSIONS[segment] || '1.0';
    };

    const getCacheKey = (segment) => `${CACHE_PREFIX}_${segment}_v${getSegmentVersion(segment)}`;
    const getTimestampKey = (segment) => `${CACHE_PREFIX}_${segment}_v${getSegmentVersion(segment)}_timestamp`;
    const getVersionKey = (segment) => `${CACHE_PREFIX}_${segment}_v${getSegmentVersion(segment)}_version`;
    
    // Helper to check if a cache segment is valid
    const isCacheValid = (segment) => {
        const timestamp = localStorage.getItem(getTimestampKey(segment));
        const cachedVersion = localStorage.getItem(getVersionKey(segment));
        const currentVersion = getSegmentVersion(segment);

        // Only enforce the version graveyard for forms — other segments use different versioning (v1.0, v1.1, etc.)
        const isGraveyard = segment === CACHE_SEGMENTS.FORMS && (() => {
            const cachedNum = parseInt(cachedVersion, 10);
            return !isNaN(cachedNum) && cachedNum > 0 && cachedNum < MINIMUM_VALID_VERSION;
        })();

        const isVersionValid = !isGraveyard && cachedVersion === currentVersion;
        const isTimeValid = timestamp && (Date.now() - parseInt(timestamp)) < CACHE_EXPIRY;

        if (isGraveyard) {
            console.log(`💀 Cache for ${segment} (v${cachedVersion}) is below minimum version ${MINIMUM_VALID_VERSION}. Treating as dead.`);
        } else if (!isVersionValid && cachedVersion) {
            console.log(`🔄 Cache version mismatch for ${segment}: Stored ${cachedVersion} vs Required ${currentVersion}. Replacing.`);
        } else if (!isTimeValid && timestamp) {
            console.log(`⏰ Cache for ${segment} has expired. Replacing.`);
        }

        return isVersionValid && isTimeValid;
    };

    const refreshSegments = useCallback(async (segments = []) => {
        const segmentsToRefresh = segments.length > 0 ? segments : Object.values(CACHE_SEGMENTS);
        console.log(`[refreshSegments] Refreshing: ${segmentsToRefresh.join(', ')}`);
        
        for (const segment of segmentsToRefresh) {
            if (!Object.values(CACHE_SEGMENTS).includes(segment)) {
                console.warn(`Invalid segment: ${segment}`);
                continue;
            }

            const segmentRef = ref(database, segment);
            try {
                // For forms, compare cached vs server data to detect staleness
                let cachedOptionsKey = null;
                if (segment === CACHE_SEGMENTS.FORMS) {
                    const cached = localStorage.getItem(getCacheKey(segment));
                    if (cached) {
                        try {
                            const parsed = JSON.parse(cached);
                            const coroner = parsed?.['coroner-report'];
                            const mannerField = coroner?.fields?.find(f => f.name === 'mannerOfDeath');
                            cachedOptionsKey = mannerField?.optionsKey;
                            console.log(`[refreshSegments] CACHED Coroner Report mannerOfDeath optionsKey: "${cachedOptionsKey}"`);
                        } catch { /* ignore parse errors */ }
                    } else {
                        console.log(`[refreshSegments] No cached FORMS data in localStorage`);
                    }
                }

                console.log(`[refreshSegments] Fetching ${segment} from Firebase...`);
                const t0 = performance.now();
                const snapshot = await get(segmentRef);
                const elapsed = (performance.now() - t0).toFixed(1);
                console.log(`[refreshSegments] ${segment} snapshot exists: ${snapshot.exists()}, key count: ${snapshot.exists() ? Object.keys(snapshot.val()).length : 0} (${elapsed}ms)`);
                
                if (snapshot.exists()) {
                    let data = snapshot.val();
                    if (segment === CACHE_SEGMENTS.FORMS && data) {
                        data = Object.keys(data).map(key => ({ ...data[key], firebaseKey: key }));
                        const coroner = data.find(f => f.firebaseKey === 'coroner-report');
                        if (coroner) {
                            const mannerField = coroner.fields?.find(f => f.name === 'mannerOfDeath');
                            const serverOptionsKey = mannerField?.optionsKey;
                            console.log(`[refreshSegments] SERVER Coroner Report mannerOfDeath optionsKey: "${serverOptionsKey}"`);
                            if (cachedOptionsKey !== null && cachedOptionsKey !== serverOptionsKey) {
                                console.log(`[refreshSegments] ✅ SERVER DATA IS DIFFERENT FROM CACHE — refresh will update.`);
                            } else if (cachedOptionsKey !== null && cachedOptionsKey === serverOptionsKey) {
                                console.log(`[refreshSegments] ⚠️ SERVER DATA MATCHES CACHE — get() may have returned cached data.`);
                            }
                        }
                    }
                    await updateCacheSegment(segment, data);
                }
            } catch (error) {
                console.error(`Failed to refresh segment ${segment}:`, error);
                showNotification(`Failed to refresh ${segment} data`, 'error');
            }
        }
        console.log(`[refreshSegments] Done`);
    }, [updateCacheSegment, showNotification]);

    const DEBOUNCE_DELAY_MS = 5 * 60 * 1000;

    const debouncedRefresh = useCallback(async (segments) => {
        const key = segments.sort().join(',');
        const expiresAt = Date.now() + DEBOUNCE_DELAY_MS;

        if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);

        debounceTimers.current[key] = setTimeout(async () => {
            delete debounceTimers.current[key];
            setPendingRefreshInfo((prev) => prev?.segment === key ? null : prev);
            await refreshSegments(segments);
        }, DEBOUNCE_DELAY_MS);

        setPendingRefreshInfo({ segment: key, expiresAt });
    }, [refreshSegments]);

    const updateNow = useCallback(async () => {
        const info = pendingRefreshInfo;
        if (!info) return;
        const segments = info.segment.split(',');
        if (debounceTimers.current[info.segment]) {
            clearTimeout(debounceTimers.current[info.segment]);
            delete debounceTimers.current[info.segment];
        }
        setPendingRefreshInfo(null);
        await refreshSegments(segments);
    }, [pendingRefreshInfo, refreshSegments]);

    // Setup Firebase listeners for real-time version checks
    // Data is loaded via get() in refreshSegments(); version listeners trigger re-fetches.
    // Morgue-records uses a direct onValue() listener (no version node exists for it).
    const setupFirebaseListeners = useCallback(() => {
        // Cleanup existing listeners
        Object.values(firebaseListeners.current).forEach(unsubscribe => unsubscribe());
        firebaseListeners.current = {};

        // --- Listener for morgue records changes ---
        const morgueRef = ref(database, CACHE_SEGMENTS.MORGUE_RECORDS);
        firebaseListeners.current.morgue = onValue(morgueRef, (snapshot) => {
            if (!dataInitializedRef.current) return;
            if (snapshot.exists()) {
                const morgueData = snapshot.val();
                if (JSON.stringify(morgueData) !== JSON.stringify(dataCache.current[CACHE_SEGMENTS.MORGUE_RECORDS])) {
                    updateCacheSegment(CACHE_SEGMENTS.MORGUE_RECORDS, morgueData);
                }
            }
        });

        // --- Listener for Global Forms Version ---
        // Use an async IIFE to perform a get() before attaching the onValue listener
        // This forces Firebase to update its local cache's understanding of this node.
        (async () => {
            const formsVersionRef = ref(database, 'appMetadata/formsDataVersion');
            let initialServerVersion = null;

            // Save the old version BEFORE the get() overwrites it — needed to detect real changes
            const oldLocalVersion = localStorage.getItem('formsDataVersion');

            try {
                const snapshot = await get(formsVersionRef);
                if (snapshot.exists()) {
                    initialServerVersion = String(snapshot.val());
                    console.debug(`[DataContext] Initial formsDataVersion fetched from server: v${initialServerVersion}`);
                    localStorage.setItem('formsDataVersion', initialServerVersion);
                } else {
                    console.log('[DataContext] formsDataVersion does not exist on server initially. Clearing local version.');
                    localStorage.removeItem('formsDataVersion');
                }

            } catch (error) {
                console.error('[DataContext] Failed to get initial formsDataVersion from server:', error);
                localStorage.removeItem('formsDataVersion');
            }

            // If the version changed while the user was away, refresh now (before onValue fires)
            if (oldLocalVersion !== null && initialServerVersion !== null && oldLocalVersion !== initialServerVersion) {
                console.log(`🔄 Forms version changed offline (v${oldLocalVersion} → v${initialServerVersion}). Refreshing forms data.`);
                localStorage.removeItem(getCacheKey(CACHE_SEGMENTS.FORMS));
                localStorage.removeItem(getTimestampKey(CACHE_SEGMENTS.FORMS));
                localStorage.removeItem(getVersionKey(CACHE_SEGMENTS.FORMS));
                // Don't await — let UI render with cached data while refresh happens
                refreshSegments([CACHE_SEGMENTS.FORMS]);
            }

            // Now, attach the onValue listener. It should now get an un-poisoned snapshot.
            let formsFirstFire = true;
            firebaseListeners.current.formsVersion = onValue(formsVersionRef, async (snapshot) => {
                // Guards for listener invocation
                if (!dataInitializedRef.current) {
                    console.log('[DataContext] Global forms version listener triggered, but DataContext not initialized. Skipping.');
                    return;
                }
                // serverVersion can be null if the node is deleted or doesn't exist
                const serverVersion = snapshot.exists() ? String(snapshot.val()) : null;
                const localVersion = localStorage.getItem('formsDataVersion');

                console.debug(`Global Forms Version - Local: ${localVersion || 'N/A'}, Server: ${serverVersion || 'N/A'}`);

                if (serverVersion !== null && localVersion !== serverVersion) { 
                    console.log(`🔄 Global forms version mismatch (v${localVersion} → v${serverVersion}).${formsFirstFire ? ' Refreshing immediately (first load).' : ' Refresh queued (5 min debounce).'}`);

                    localStorage.removeItem(getCacheKey(CACHE_SEGMENTS.FORMS));
                    localStorage.removeItem(getTimestampKey(CACHE_SEGMENTS.FORMS));
                    localStorage.removeItem(getVersionKey(CACHE_SEGMENTS.FORMS));
                    localStorage.setItem('formsDataVersion', serverVersion);

                    if (formsFirstFire) {
                        await refreshSegments([CACHE_SEGMENTS.FORMS]);
                    } else {
                        await debouncedRefresh([CACHE_SEGMENTS.FORMS]);
                    }
                    formsFirstFire = false;
                } else if (serverVersion === null && localVersion !== null) {
                    console.log(`🗑️ Global forms version deleted from server.`);
                    localStorage.removeItem(getCacheKey(CACHE_SEGMENTS.FORMS));
                    localStorage.removeItem(getTimestampKey(CACHE_SEGMENTS.FORMS));
                    localStorage.removeItem(getVersionKey(CACHE_SEGMENTS.FORMS));
                    localStorage.removeItem('formsDataVersion');
                    await debouncedRefresh([CACHE_SEGMENTS.FORMS]);
                    formsFirstFire = false;
                }
                formsFirstFire = false;
            });
        })(); // Immediately Invoked Async Function Expression

        // --- Listener for Global Factions Version ---
        (async () => {
            const factionsVersionRef = ref(database, 'appMetadata/factionsDataVersion');
            let initialServerVersion = null;
            const oldLocalVersion = localStorage.getItem('factionsDataVersion');

            try {
                const snapshot = await get(factionsVersionRef);
                if (snapshot.exists()) {
                    initialServerVersion = String(snapshot.val());
                    console.debug(`[DataContext] Initial factionsDataVersion fetched from server: v${initialServerVersion}`);
                    localStorage.setItem('factionsDataVersion', initialServerVersion);
                } else {
                    console.log('[DataContext] factionsDataVersion does not exist on server initially. Clearing local version.');
                    localStorage.removeItem('factionsDataVersion');
                }
            } catch (error) {
                console.error('[DataContext] Failed to get initial factionsDataVersion from server:', error);
                localStorage.removeItem('factionsDataVersion');
            }

            if (oldLocalVersion !== null && initialServerVersion !== null && oldLocalVersion !== initialServerVersion) {
                console.log(`🔄 Factions version changed offline (v${oldLocalVersion} → v${initialServerVersion}). Refreshing factions data.`);
                localStorage.removeItem(getCacheKey(CACHE_SEGMENTS.FACTIONS));
                localStorage.removeItem(getTimestampKey(CACHE_SEGMENTS.FACTIONS));
                localStorage.removeItem(getVersionKey(CACHE_SEGMENTS.FACTIONS));
                refreshSegments([CACHE_SEGMENTS.FACTIONS]);
            }

            let factionsFirstFire = true;
            firebaseListeners.current.factionsVersion = onValue(factionsVersionRef, async (snapshot) => {
                if (!dataInitializedRef.current) {
                    console.log('[DataContext] Global factions version listener triggered, but DataContext not initialized. Skipping.');
                    return;
                }
                const serverVersion = snapshot.exists() ? String(snapshot.val()) : null;
                const localVersion = localStorage.getItem('factionsDataVersion');

                console.debug(`Global Factions Version - Local: ${localVersion || 'N/A'}, Server: ${serverVersion || 'N/A'}`);

                if (serverVersion !== null && localVersion !== serverVersion) { 
                    console.log(`🔄 Global factions version mismatch (v${localVersion} → v${serverVersion}).${factionsFirstFire ? ' Refreshing immediately (first load).' : ' Refresh queued (5 min debounce).'}`);

                    localStorage.removeItem(getCacheKey(CACHE_SEGMENTS.FACTIONS));
                    localStorage.removeItem(getTimestampKey(CACHE_SEGMENTS.FACTIONS));
                    localStorage.removeItem(getVersionKey(CACHE_SEGMENTS.FACTIONS));
                    localStorage.setItem('factionsDataVersion', serverVersion);

                    if (factionsFirstFire) {
                        await refreshSegments([CACHE_SEGMENTS.FACTIONS]);
                    } else {
                        await debouncedRefresh([CACHE_SEGMENTS.FACTIONS]);
                    }
                    factionsFirstFire = false;
                } else if (serverVersion === null && localVersion !== null) {
                    console.log(`🗑️ Global factions version deleted from server.`);
                    localStorage.removeItem(getCacheKey(CACHE_SEGMENTS.FACTIONS));
                    localStorage.removeItem(getTimestampKey(CACHE_SEGMENTS.FACTIONS));
                    localStorage.removeItem(getVersionKey(CACHE_SEGMENTS.FACTIONS));
                    localStorage.removeItem('factionsDataVersion');
                    await debouncedRefresh([CACHE_SEGMENTS.FACTIONS]);
                }
                factionsFirstFire = false;
            });
        })();

        // --- Listener for Global Select Options Version ---
        (async () => {
            const optionsVersionRef = ref(database, 'appMetadata/selectOptionsDataVersion');
            let initialServerVersion = null;
            const oldLocalVersion = localStorage.getItem('selectOptionsDataVersion');

            try {
                const snapshot = await get(optionsVersionRef);
                if (snapshot.exists()) {
                    initialServerVersion = String(snapshot.val());
                    console.debug(`[DataContext] Initial selectOptionsDataVersion fetched from server: v${initialServerVersion}`);
                    localStorage.setItem('selectOptionsDataVersion', initialServerVersion);
                } else {
                    console.log('[DataContext] selectOptionsDataVersion does not exist on server initially. Clearing local version.');
                    localStorage.removeItem('selectOptionsDataVersion');
                }
            } catch (error) {
                console.error('[DataContext] Failed to get initial selectOptionsDataVersion from server:', error);
                localStorage.removeItem('selectOptionsDataVersion');
            }

            if (oldLocalVersion !== null && initialServerVersion !== null && oldLocalVersion !== initialServerVersion) {
                console.log(`🔄 SelectOptions version changed offline (v${oldLocalVersion} → v${initialServerVersion}). Refreshing selectOptions data.`);
                localStorage.removeItem(getCacheKey(CACHE_SEGMENTS.SELECT_OPTIONS));
                localStorage.removeItem(getTimestampKey(CACHE_SEGMENTS.SELECT_OPTIONS));
                localStorage.removeItem(getVersionKey(CACHE_SEGMENTS.SELECT_OPTIONS));
                refreshSegments([CACHE_SEGMENTS.SELECT_OPTIONS]);
            }

            let optionsFirstFire = true;
            firebaseListeners.current.optionsVersion = onValue(optionsVersionRef, async (snapshot) => {
                if (!dataInitializedRef.current) {
                    console.log('[DataContext] Global options version listener triggered, but DataContext not initialized. Skipping.');
                    return;
                }
                const serverVersion = snapshot.exists() ? String(snapshot.val()) : null;
                const localVersion = localStorage.getItem('selectOptionsDataVersion');

                console.debug(`Global Select Options Version - Local: ${localVersion || 'N/A'}, Server: ${serverVersion || 'N/A'}`);

                if (serverVersion !== null && localVersion !== serverVersion) { 
                    console.log(`🔄 Global select options version mismatch (v${localVersion} → v${serverVersion}).${optionsFirstFire ? ' Refreshing immediately (first load).' : ' Refresh queued (5 min debounce).'}`);

                    localStorage.removeItem(getCacheKey(CACHE_SEGMENTS.SELECT_OPTIONS));
                    localStorage.removeItem(getTimestampKey(CACHE_SEGMENTS.SELECT_OPTIONS));
                    localStorage.removeItem(getVersionKey(CACHE_SEGMENTS.SELECT_OPTIONS));
                    localStorage.setItem('selectOptionsDataVersion', serverVersion);

                    if (optionsFirstFire) {
                        await refreshSegments([CACHE_SEGMENTS.SELECT_OPTIONS]);
                    } else {
                        await debouncedRefresh([CACHE_SEGMENTS.SELECT_OPTIONS]);
                    }
                    optionsFirstFire = false;
                } else if (serverVersion === null && localVersion !== null) {
                    console.log(`🗑️ Global select options version deleted from server.`);
                    localStorage.removeItem(getCacheKey(CACHE_SEGMENTS.SELECT_OPTIONS));
                    localStorage.removeItem(getTimestampKey(CACHE_SEGMENTS.SELECT_OPTIONS));
                    localStorage.removeItem(getVersionKey(CACHE_SEGMENTS.SELECT_OPTIONS));
                    localStorage.removeItem('selectOptionsDataVersion');
                    await debouncedRefresh([CACHE_SEGMENTS.SELECT_OPTIONS]);
                }
                optionsFirstFire = false;
            });
        })();

        // --- Listener for Global LSCC Version ---
        (async () => {
            const lsccVersionRef = ref(database, 'appMetadata/lsccDataVersion');
            let initialServerVersion = null;
            const oldLocalVersion = localStorage.getItem('lsccDataVersion');

            try {
                const snapshot = await get(lsccVersionRef);
                if (snapshot.exists()) {
                    initialServerVersion = String(snapshot.val());
                    console.debug(`[DataContext] Initial lsccDataVersion fetched from server: v${initialServerVersion}`);
                    localStorage.setItem('lsccDataVersion', initialServerVersion);
                } else {
                    console.log('[DataContext] lsccDataVersion does not exist on server initially. Clearing local version.');
                    localStorage.removeItem('lsccDataVersion');
                }
            } catch (error) {
                console.error('[DataContext] Failed to get initial lsccDataVersion from server:', error);
                localStorage.removeItem('lsccDataVersion');
            }

            if (oldLocalVersion !== null && initialServerVersion !== null && oldLocalVersion !== initialServerVersion) {
                console.log(`🔄 LSCC version changed offline (v${oldLocalVersion} → v${initialServerVersion}). Refreshing LSCC data.`);
                localStorage.removeItem(getCacheKey(CACHE_SEGMENTS.LSCC));
                localStorage.removeItem(getTimestampKey(CACHE_SEGMENTS.LSCC));
                localStorage.removeItem(getVersionKey(CACHE_SEGMENTS.LSCC));
                refreshSegments([CACHE_SEGMENTS.LSCC]);
            }

            let lsccFirstFire = true;
            firebaseListeners.current.lsccVersion = onValue(lsccVersionRef, async (snapshot) => {
                if (!dataInitializedRef.current) {
                    console.log('[DataContext] Global LSCC version listener triggered, but DataContext not initialized. Skipping.');
                    return;
                }
                const serverVersion = snapshot.exists() ? String(snapshot.val()) : null;
                const localVersion = localStorage.getItem('lsccDataVersion');

                console.debug(`Global LSCC Version - Local: ${localVersion || 'N/A'}, Server: ${serverVersion || 'N/A'}`);

                if (serverVersion !== null && localVersion !== serverVersion) { 
                    console.log(`🔄 Global LSCC version mismatch (v${localVersion} → v${serverVersion}).${lsccFirstFire ? ' Refreshing immediately (first load).' : ' Refresh queued (5 min debounce).'}`);

                    localStorage.removeItem(getCacheKey(CACHE_SEGMENTS.LSCC));
                    localStorage.removeItem(getTimestampKey(CACHE_SEGMENTS.LSCC));
                    localStorage.removeItem(getVersionKey(CACHE_SEGMENTS.LSCC));
                    localStorage.setItem('lsccDataVersion', serverVersion);

                    if (lsccFirstFire) {
                        await refreshSegments([CACHE_SEGMENTS.LSCC]);
                    } else {
                        await debouncedRefresh([CACHE_SEGMENTS.LSCC]);
                    }
                    lsccFirstFire = false;
                } else if (serverVersion === null && localVersion !== null) {
                    console.log(`🗑️ Global LSCC version deleted from server.`);
                    localStorage.removeItem(getCacheKey(CACHE_SEGMENTS.LSCC));
                    localStorage.removeItem(getTimestampKey(CACHE_SEGMENTS.LSCC));
                    localStorage.removeItem(getVersionKey(CACHE_SEGMENTS.LSCC));
                    localStorage.removeItem('lsccDataVersion');
                    await debouncedRefresh([CACHE_SEGMENTS.LSCC]);
                }
                lsccFirstFire = false;
            });
        })();
    }, [updateCacheSegment, showNotification, refreshSegments]);



    const loadData = useCallback(async (forceRefresh = false) => {
        setHasFirebaseError(false);
        if (dataLoaded && !forceRefresh) {
            console.log('[DataContext] Data already loaded, skipping redundant load.');
            return;
        }
    
        const segmentsToFetch = [];
        const cachedSegments = {};
        const segmentSizes = {};
        let totalCachedSize = 0;
    
        if (forceRefresh) {
            segmentsToFetch.push(...Object.values(CACHE_SEGMENTS));
            didLoadFromCache.current = false;
        } else {
            Object.values(CACHE_SEGMENTS).forEach(segment => {
                if (EXCLUDED_FROM_CACHE.includes(segment)) return;
                
                const cacheKey = getCacheKey(segment);
                const cachedData = localStorage.getItem(cacheKey);
    
                if (cachedData && isCacheValid(segment)) {
                    try {
                        cachedSegments[segment] = JSON.parse(cachedData);
                        const segmentSize = (cachedData.length || 0) / 1024;
                        segmentSizes[segment] = segmentSize;
                        totalCachedSize += segmentSize;
                    } catch (error) {
                        console.error(`Error parsing cached data for ${segment}, refetching.`, error);
                        segmentsToFetch.push(segment);
                    }
                } else {
                    segmentsToFetch.push(segment);
                }
            });
    
            if (Object.keys(cachedSegments).length > 0) {
                console.debug('📦 Using partially or fully cached data from localStorage for segments:', Object.keys(cachedSegments));
                updateStateWithData(cachedSegments);
                dataCache.current = { ...dataCache.current, ...cachedSegments };
                didLoadFromCache.current = true;
            } else {
                didLoadFromCache.current = false;
            }
        }
    
        if (segmentsToFetch.length === 0) {
            if (!hasLoggedInitialLoad.current) {
                webhooks.sendDataRequestLog('DataContext.jsx', true, 'Local Storage', totalCachedSize, 0, isAuthenticated, user?.faction?.characterName || user?.username, Object.keys(cachedSegments), [], segmentSizes, null);
                hasLoggedInitialLoad.current = true;
            }
            setDataLoaded(true);
            setIsLoadingData(false);
            setIsLoadingData(false);
            return;
        }
    
        let loadingNotificationId;
        try {
            loadingNotificationId = showNotification(`Fetching ${segmentsToFetch.join(', ')} from server...`, 'spinner fa-spin', 0);
            
            const promises = segmentsToFetch.map(segment => get(ref(database, segment)).then(snapshot => ({ segment, snapshot })));
            const results = await Promise.all(promises);
    
            const fetchedData = {};
            let totalNetworkTransferSize = 0;
    
            results.forEach(({ segment, snapshot }) => {
                if (snapshot.exists()) {
                    let data = snapshot.val();
                    if (segment === CACHE_SEGMENTS.FORMS) {
                        data = Object.keys(data).map(key => ({ ...data[key], firebaseKey: key }));
                    }
                    fetchedData[segment] = data;
                    const segmentSize = (JSON.stringify(data).length || 0) / 1024;
                    segmentSizes[segment] = segmentSize;
                    totalNetworkTransferSize += segmentSize;
                } else {
                    console.warn(`Segment "${segment}" does not exist in Firebase.`);
                }
            });
    
            if (Object.keys(fetchedData).length > 0) {
                if (!hasLoggedInitialLoad.current) {
                    webhooks.sendDataRequestLog('DataContext.jsx', didLoadFromCache.current, didLoadFromCache.current ? 'Partial Cache' : 'Firebase', totalCachedSize + totalNetworkTransferSize, totalNetworkTransferSize, isAuthenticated, user?.faction?.characterName || user?.username, Object.keys(cachedSegments).concat(segmentsToFetch), segmentsToFetch.filter(s => !fetchedData[s]), segmentSizes, null);
                    hasLoggedInitialLoad.current = true;
                }
    
                Object.entries(fetchedData).forEach(([segment, data]) => {
                    updateCacheSegment(segment, data);
                });
    
                updateStateWithData(fetchedData);
                showNotification("Data updated!", 'check-circle', 2000);
            }
    
            setDataLoaded(true);
    
        } catch (error) {
            showNotification("An error occurred while fetching data.", 'error');
            console.error("Error fetching data from Realtime Database:", error);
            if (!hasLoggedInitialLoad.current) {
                webhooks.sendDataRequestLog('DataContext.jsx', didLoadFromCache.current, 'Firebase Error', totalCachedSize, 0, isAuthenticated, user?.faction?.characterName || user?.username, Object.keys(cachedSegments), segmentsToFetch, segmentSizes, error.message || 'Unknown Fetch Error');
                hasLoggedInitialLoad.current = true;
            }
            setHasFirebaseError(true);
        } finally {
            setIsLoadingData(false);
            setIsLoadingData(false);
            if (loadingNotificationId) {
                removeNotification(loadingNotificationId);
            }
        }
    }, [
        showNotification, removeNotification, updateCacheSegment, // Added updateCacheSegment
        setFactionsData, setAgencyDataStore, setSelectOptions,
        setIsLoadingData, setFormsData,
        isAuthenticated, user, webhooks // Replaced sendDataRequestLog with webhooks
    ]);


    const cleanupCache = useCallback(() => {
        // Remove old static versioned cache keys only (v1.x, v1.x, etc.)
        // Note: We do NOT remove the version trackers (formsDataVersion, etc.)
        // because they are needed by loadData to find the correct cache key.
        // Removing them causes the next page load to fall back to version "0",
        // which doesn't match any cache, causing a wasted full re-fetch.
        localStorage.removeItem('formVersions');

        // Explicitly remove old forms cache versions
        const oldFormsCacheKeys = [
            'firebaseCache_forms_v1.0',
            'firebaseCache_forms_v1.0_timestamp',
            'firebaseCache_forms_v1.0_version',
            'firebaseCache_forms_v1.1',
            'firebaseCache_forms_v1.1_timestamp',
            'firebaseCache_forms_v1.1_version',
            'firebaseCache_forms_v1.2',
            'firebaseCache_forms_v1.2_timestamp',
            'firebaseCache_forms_v1.2_version',
            'firebaseCache_forms_v1.2.1', // Assuming there might have been a minor version before 1.2.2
            'firebaseCache_forms_v1.2.1_timestamp',
            'firebaseCache_forms_v1.2.1_version',
            'firebaseCache_forms_v1.2.2',
            'firebaseCache_forms_v1.2.2_timestamp',
            'firebaseCache_forms_v1.2.2_version',
            
        ];
        oldFormsCacheKeys.forEach(key => {
            if (localStorage.getItem(key) !== null) {
                console.log(`🧹 Explicitly cleaning up old forms cache key: ${key}`);
                localStorage.removeItem(key);
            }
        });

        // Explicitly remove old factions cache versions
        const oldFactionsCacheKeys = [
            'firebaseCache_factions_v1.0',
            'firebaseCache_factions_v1.0_timestamp',
            'firebaseCache_factions_v1.0_version',
            'firebaseCache_factions_v1.1',
            'firebaseCache_factions_v1.1_timestamp',
            'firebaseCache_factions_v1.1_version',
        ];
        oldFactionsCacheKeys.forEach(key => {
            if (localStorage.getItem(key) !== null) {
                console.log(`🧹 Explicitly cleaning up old factions cache key: ${key}`);
                localStorage.removeItem(key);
            }
        });

        // Explicitly remove old selectOptions cache versions
        const oldSelectOptionsCacheKeys = [
            'firebaseCache_selectOptions_v1.2.3',
            'firebaseCache_selectOptions_v1.2.3_timestamp',
            'firebaseCache_selectOptions_v1.2.3_version',
        ];
        oldSelectOptionsCacheKeys.forEach(key => {
            if (localStorage.getItem(key) !== null) {
                console.log(`🧹 Explicitly cleaning up old selectOptions cache key: ${key}`);
                localStorage.removeItem(key);
            }
        });

        const prefix = CACHE_PREFIX + '_';
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                // Check if this key belongs to any current segment
                const isCurrentKey = Object.values(CACHE_SEGMENTS).some(segment => 
                    key === getCacheKey(segment) ||
                    key === getTimestampKey(segment) ||
                    key === getVersionKey(segment)
                );
                
                if (!isCurrentKey) {
                    console.log(`🧹 Cleaning up old cache key: ${key}`);
                    localStorage.removeItem(key);
                }
            }
        }
    }, []);

            useEffect(() => {
                let isMounted = true; // For handling async operations on unmounted components
        
                // Primary guard: ensure loadData is truly called only once by THIS useEffect instance
                if (dataInitializedRef.current) {
                    console.log('[DataContext] Data load already initiated by this useEffect instance. Skipping.');
                    return;
                }
        
                const fetchData = async () => {
                    // Safety check for localStorage corruption/breaking changes
                    const storedSafetyVersion = localStorage.getItem('ls_safety_version');
                    
                    if (!storedSafetyVersion) {
                        // First time seeing this versioning system - just mark it as current
                        localStorage.setItem('ls_safety_version', LOCAL_STORAGE_SAFETY_VERSION);
                    } else if (storedSafetyVersion !== LOCAL_STORAGE_SAFETY_VERSION) {
                        // Version mismatch detected - perform a safe wipe
                        console.warn(`🚨 LocalStorage Safety Version mismatch: ${storedSafetyVersion} vs ${LOCAL_STORAGE_SAFETY_VERSION}. Clearing localStorage.`);
                        localStorage.clear();
                        localStorage.setItem('ls_safety_version', LOCAL_STORAGE_SAFETY_VERSION);
                    }

                    // Set ref to true immediately to prevent re-entry from StrictMode's double invocation
                    dataInitializedRef.current = true; 
                    console.log('[DataContext] Starting DataContext initialization (first useEffect invocation)...');
        
                    try {
                        // Clear stale localStorage BEFORE loading data or attaching listeners
                        // This prevents quota errors from Firebase persistence filling up the cache
                        cleanupCache();
                        // Also clear stale Firebase persistence keys that accumulate over time
                        try {
                            const staleKeys = [];
                            for (let i = 0; i < localStorage.length; i++) {
                                const key = localStorage.key(i);
                                if (key && (key.startsWith('firebase:') || key.startsWith('cache_data_undefined'))) {
                                    staleKeys.push(key);
                                }
                            }
                            staleKeys.forEach(key => {
                                localStorage.removeItem(key);
                                console.log(`🧹 Removed stale key: ${key.substring(0, 60)}`);
                            });
                        } catch { /* best effort */ }

                        // loadData handles internal caching logic (memory/localStorage/Firebase fetch)
                        await loadData(); 
                        if (isMounted) {
                            console.log('[DataContext] Data load complete. Setting up Firebase listeners.');
                            sessionStorage.setItem('dataContextInitialized', 'true'); // Mark session as initialized
                            setupFirebaseListeners();
                        }
                    } catch (error) {
                        console.error('[DataContext] Error during DataContext initialization:', error);
                        // IMPORTANT: Reset ref on error to allow retry on subsequent component mounts/retries
                        dataInitializedRef.current = false; 
                    }
                };
        
                fetchData();
        
                // Cleanup on unmount
                return () => {
                    isMounted = false;
                    // Clear Firebase listeners to prevent memory leaks
                    Object.values(firebaseListeners.current).forEach(unsubscribe => unsubscribe());
                    firebaseListeners.current = {};
                };
            }, [loadData, setupFirebaseListeners, cleanupCache]); // Dependencies: ensure these useCallback functions are stable        // DEPRICATED - USE IN VERY LIMITED APPLICATIONS
        const phmcListData = useMemo(() => {
            // PHMC FACTION = 364, filtered by excluding CORONER categories
            if (!factionsData['364'] || typeof factionsData['364'].members !== 'object' || !factionsData['364'].members) {
                    console.debug('[DataContext] phmcListData: Faction data empty or malformed');
                return [];
            }
    
            const allMembers = Object.values(factionsData['364'].members);
            
            // Add verified admins to the list
            const adminMembers = Object.values(verifiedAdmins).map(admin => ({
                characterName: admin.username,
                name: admin.username,
                rank: admin.role || 'Senior Management',
                isElevated: true,
                badge: `ADM-${admin.id}`,
                characterId: admin.id
            }));

            const combinedMembers = [...allMembers, ...adminMembers];

            const normalizedMembers = combinedMembers.map(member => ({
                ...member,
                name: member.characterName || member.name || member.displayName || member.username || 'Unknown',
                rank: member.rank || '',
            }));
    
            let dataSource = normalizedMembers.filter(member =>
                !CORONER_KEYWORDS.some(kw => member.rank.includes(kw))
            ).map(member => ({ ...member, category: member.rank }));
            
            return dataSource;
        }, [factionsData, verifiedAdmins]);
            
        // DEPRICATED - USE IN VERY LIMITED APPLICATIONS
        const coronerListData = useMemo(() => {
        // PHMC FACTION = 364, filtered by CORONER categories
        if (!factionsData['364'] || typeof factionsData['364'].members !== 'object' || !factionsData['364'].members) {
            console.debug('[DataContext] coronerListData: Faction data empty or malformed');
            return [];
        }

        // Use faction data if available, otherwise use legacy data
        let dataSource = [];
        if (factionsData['364'] && factionsData['364'].members) {
            const allMembers = Object.values(factionsData['364'].members);
            
            // Add verified admins to coroner list too
            const adminMembers = Object.values(verifiedAdmins).map(admin => ({
                characterName: admin.username,
                name: admin.username,
                rank: 'GTAW STAFF',
                isElevated: true,
                badge: `ADM-${admin.id}`,
                characterId: admin.id
            }));

            const combinedMembers = [...allMembers, ...adminMembers];

            const normalizedMembers = combinedMembers.map(member => ({
                ...member,
                name: member.characterName || member.name || member.displayName || member.username || 'Unknown',
                rank: member.rank || '',
            }));


            dataSource = normalizedMembers.filter(member =>
                CORONER_KEYWORDS.some(kw => member.rank.includes(kw))
            ).map(member => {
                // Now that we have only coroners, find the best category for grouping
                const category = member.rank || 'Coroner';
                return { ...member, category };
            });
            console.debug('[DataContext] coronerListData using FACTION data:', dataSource.length, 'members');
        }
        return dataSource;
    }, [factionsData, verifiedAdmins]);


    const value = {
        factionsData,
        formsData,
        phmcListData: phmcListData || [],
        coronerListData: coronerListData || [],
        agencyDataStore,
        selectOptions,
        isLoadingData,
        refreshSegments,
        updateNow,
        pendingRefreshInfo,
        sendDataRequestLog: webhooks.sendDataRequestLog,
        lsccData,
        morgueRecords,
        hasFirebaseError,
    };
            
                return (
                    <DataContext.Provider value={value}>
                        {children}
                    </DataContext.Provider>    );
};