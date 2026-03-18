import React, { createContext, useState, useEffect, useContext, useCallback, useRef, useMemo } from 'react';
import { database } from '../firebase';
import { ref, get, onChildChanged, onValue, set } from 'firebase/database';
import { useNotification } from './NotificationContext.jsx';
import { useWebhooks } from '../hooks/useWebhooks';
import { useInactivityReload } from '../hooks/useInactivityReload';
import useGtaWorldAuth from '../hooks/useGtaWorldAuth';

// Define cache segments
const CACHE_SEGMENTS = {
    FACTIONS: 'factions',
    AGENCIES: 'agencies',
    SELECT_OPTIONS: 'selectOptions',
    FORMS: 'forms',
    LSCC: 'lscc',
    VERIFIED_ADMINS: 'verified_admins',
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
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [loading, setLoading] = useState(true);

const webhooks = useWebhooks(null, null, showNotification, getIsInactivityWarningTriggered);
    const CORONER_KEYWORDS = ['Coroner', 'Examiner', 'Attendant'];
    const updateCacheSegment = useCallback(async (segment, data) => {
        // Update memory cache
        dataCache.current[segment] = data;

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
                console.log(logMessage);

            } catch (error) {
                console.warn(`Failed to update cache for ${segment}:`, error);
                // If we hit quota, clear all cache segments to make space
                console.log(`Clearing all cache segments due to storage error on segment: ${segment}`);
                Object.values(CACHE_SEGMENTS).forEach(s => {
                    if (!EXCLUDED_FROM_CACHE.includes(s)) {
                        try {
                            localStorage.removeItem(getCacheKey(s));
                            localStorage.removeItem(getTimestampKey(s));
                            localStorage.removeItem(getVersionKey(s));
                        } catch (clearError) {
                            console.error(`Failed to clear cache for segment ${s}:`, clearError);
                        }
                    }
                });
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
    const [isDevMode, setIsDevMode] = useState(false); // Add isDevMode state
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

    // Version configuration for each segment, some versions are dynamic updated in Firebase but manually bump if required
    const SEGMENT_VERSIONS = {
        [CACHE_SEGMENTS.FACTIONS]: '1.2',
        [CACHE_SEGMENTS.AGENCIES]: '1.1',
        [CACHE_SEGMENTS.FORMS]: '1.2.3', 
        [CACHE_SEGMENTS.LSCC]: '1.0',
        [CACHE_SEGMENTS.VERIFIED_ADMINS]: '1.0',
    };

    const getSegmentVersion = (segment) => {
        if (segment === CACHE_SEGMENTS.FORMS) return localStorage.getItem('formsDataVersion') || '0';
        if (segment === CACHE_SEGMENTS.FACTIONS) return localStorage.getItem('factionsDataVersion') || '0';
        if (segment === CACHE_SEGMENTS.SELECT_OPTIONS) return localStorage.getItem('selectOptionsDataVersion') || '0';
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

        const isVersionValid = cachedVersion === currentVersion;
        const isTimeValid = timestamp && (Date.now() - parseInt(timestamp)) < CACHE_EXPIRY;

        if (!isVersionValid && cachedVersion) { // Only log if there was an old version
            console.log(`🔄 Cache version mismatch for ${segment}: Stored ${cachedVersion} vs Required ${currentVersion}. Replacing.`);
        } else if (!isTimeValid && timestamp) { // It's not a version issue, but it's expired
            console.log(`⏰ Cache for ${segment} has expired. Replacing.`);
        }

        return isVersionValid && isTimeValid;
    };

    const refreshSegments = useCallback(async (segments = []) => {
        const segmentsToRefresh = segments.length > 0 ? segments : Object.values(CACHE_SEGMENTS);
        
        for (const segment of segmentsToRefresh) {
            if (!Object.values(CACHE_SEGMENTS).includes(segment)) {
                console.warn(`Invalid segment: ${segment}`);
                continue;
            }

            const segmentRef = ref(database, segment);
            try {
                const snapshot = await get(segmentRef);
                if (snapshot.exists()) {
                    let data = snapshot.val();
                    if (segment === CACHE_SEGMENTS.FORMS && data) {
                        data = Object.keys(data).map(key => ({ ...data[key], firebaseKey: key }));
                    }
                    await updateCacheSegment(segment, data);
                }
            } catch (error) {
                console.error(`Failed to refresh segment ${segment}:`, error);
                showNotification(`Failed to refresh ${segment} data`, 'error');
            }
        }
    }, [updateCacheSegment, showNotification]);

    // Setup Firebase listeners for real-time updates
    const setupFirebaseListeners = useCallback(() => {
        // Cleanup existing listeners
        Object.values(firebaseListeners.current).forEach(unsubscribe => unsubscribe());
        firebaseListeners.current = {};

        // --- Listener for factions changes ---
        const factionsRef = ref(database, CACHE_SEGMENTS.FACTIONS);
        firebaseListeners.current.factions = onValue(factionsRef, (snapshot) => {
            if (!dataInitializedRef.current) return;
            if (snapshot.exists()) {
                const factionsData = snapshot.val();
                if (JSON.stringify(factionsData) !== JSON.stringify(dataCache.current[CACHE_SEGMENTS.FACTIONS])) {
                    updateCacheSegment(CACHE_SEGMENTS.FACTIONS, factionsData);
                }
            }
        });

        // --- Listener for agency changes ---
        const agenciesRef = ref(database, CACHE_SEGMENTS.AGENCIES);
        firebaseListeners.current.agencies = onValue(agenciesRef, (snapshot) => {
            if (!dataInitializedRef.current) return;
            if (snapshot.exists()) {
                const agencyData = snapshot.val();
                if (JSON.stringify(agencyData) !== JSON.stringify(dataCache.current[CACHE_SEGMENTS.AGENCIES])) {
                    updateCacheSegment(CACHE_SEGMENTS.AGENCIES, agencyData);
                }
            }
        });

        // --- Listener for select options changes ---
        const optionsRef = ref(database, CACHE_SEGMENTS.SELECT_OPTIONS);
        firebaseListeners.current.options = onValue(optionsRef, (snapshot) => {
            if (!dataInitializedRef.current) return;
            if (snapshot.exists()) {
                const optionsData = snapshot.val();
                if (JSON.stringify(optionsData) !== JSON.stringify(dataCache.current[CACHE_SEGMENTS.SELECT_OPTIONS])) {
                    updateCacheSegment(CACHE_SEGMENTS.SELECT_OPTIONS, optionsData);
                }
            }
        });

        // --- Listener for verified admins changes ---
        const adminsRef = ref(database, CACHE_SEGMENTS.VERIFIED_ADMINS);
        firebaseListeners.current.admins = onValue(adminsRef, (snapshot) => {
            if (!dataInitializedRef.current) return;
            if (snapshot.exists()) {
                const adminsData = snapshot.val();
                updateCacheSegment(CACHE_SEGMENTS.VERIFIED_ADMINS, adminsData);
            }
        });

        // --- Listener for Global Forms Version ---
        // Use an async IIFE to perform a get() before attaching the onValue listener
        // This forces Firebase to update its local cache's understanding of this node.
        (async () => {
            const formsVersionRef = ref(database, 'appMetadata/formsDataVersion');
            let initialServerVersion = null;

            try {
                const snapshot = await get(formsVersionRef);
                if (snapshot.exists()) {
                    initialServerVersion = String(snapshot.val());
                    console.log(`[DataContext] Initial formsDataVersion fetched from server: v${initialServerVersion}`);
                    localStorage.setItem('formsDataVersion', initialServerVersion);
                } else {
                    console.log('[DataContext] formsDataVersion does not exist on server initially. Clearing local version.');
                    localStorage.removeItem('formsDataVersion');
                }

            } catch (error) {
                console.error('[DataContext] Failed to get initial formsDataVersion from server:', error);
                // In case of error during initial get, ensure local storage has a default to prevent further errors
                localStorage.removeItem('formsDataVersion');
            }

            // Now, attach the onValue listener. It should now get an un-poisoned snapshot.
            firebaseListeners.current.formsVersion = onValue(formsVersionRef, async (snapshot) => {
                // Guards for listener invocation
                if (!dataInitializedRef.current) {
                    console.log('[DataContext] Global forms version listener triggered, but DataContext not initialized. Skipping.');
                    return;
                }
                // serverVersion can be null if the node is deleted or doesn't exist
                const serverVersion = snapshot.exists() ? String(snapshot.val()) : null;
                const localVersion = localStorage.getItem('formsDataVersion'); // Get freshest local version

                // Always log the current state for tracking
                console.log(`Global Forms Version - Local: ${localVersion || 'N/A'}, Server: ${serverVersion || 'N/A'}`);

                // Proceed only if server version exists AND it differs from the local one.
                if (serverVersion !== null && localVersion !== serverVersion) { 
                    console.log(`🔄 Global forms version mismatch (v${localVersion} → v${serverVersion}). Clearing and refreshing forms cache...`);

                    // Clear only forms cache
                    localStorage.removeItem(getCacheKey(CACHE_SEGMENTS.FORMS));
                    localStorage.removeItem(getTimestampKey(CACHE_SEGMENTS.FORMS));
                    localStorage.removeItem(getVersionKey(CACHE_SEGMENTS.FORMS));

                    // Update local version
                    localStorage.setItem('formsDataVersion', serverVersion);

                    showNotification("Application forms have been updated.", "success", 4000);

                    // Force reload of the forms segment
                    await refreshSegments([CACHE_SEGMENTS.FORMS]);
                } else if (serverVersion === null && localVersion !== null) {
                    // Scenario: formsDataVersion was deleted from Firebase. Clear local and notify.
                    console.log(`🗑️ Global forms version deleted from server. Clearing local cache.`);
                    localStorage.removeItem(getCacheKey(CACHE_SEGMENTS.FORMS));
                    localStorage.removeItem(getTimestampKey(CACHE_SEGMENTS.FORMS));
                    localStorage.removeItem(getVersionKey(CACHE_SEGMENTS.FORMS));
                    localStorage.removeItem('formsDataVersion'); // Remove local tracker too
                    showNotification("Application forms data cleared due to server-side deletion.", "info", 4000);
                    await refreshSegments([CACHE_SEGMENTS.FORMS]); // Refresh to show empty state
                }
            });
        })(); // Immediately Invoked Async Function Expression

        // --- Listener for Global Factions Version ---
        (async () => {
            const factionsVersionRef = ref(database, 'appMetadata/factionsDataVersion');
            let initialServerVersion = null;

            try {
                const snapshot = await get(factionsVersionRef);
                if (snapshot.exists()) {
                    initialServerVersion = String(snapshot.val());
                    console.log(`[DataContext] Initial factionsDataVersion fetched from server: v${initialServerVersion}`);
                    localStorage.setItem('factionsDataVersion', initialServerVersion);
                } else {
                    console.log('[DataContext] factionsDataVersion does not exist on server initially. Clearing local version.');
                    localStorage.removeItem('factionsDataVersion');
                }
            } catch (error) {
                console.error('[DataContext] Failed to get initial factionsDataVersion from server:', error);
                localStorage.removeItem('factionsDataVersion');
            }

            firebaseListeners.current.factionsVersion = onValue(factionsVersionRef, async (snapshot) => {
                if (!dataInitializedRef.current) {
                    console.log('[DataContext] Global factions version listener triggered, but DataContext not initialized. Skipping.');
                    return;
                }
                const serverVersion = snapshot.exists() ? String(snapshot.val()) : null;
                const localVersion = localStorage.getItem('factionsDataVersion');

                console.log(`Global Factions Version - Local: ${localVersion || 'N/A'}, Server: ${serverVersion || 'N/A'}`);

                if (serverVersion !== null && localVersion !== serverVersion) { 
                    console.log(`🔄 Global factions version mismatch (v${localVersion} → v${serverVersion}). Clearing and refreshing factions cache...`);

                    localStorage.removeItem(getCacheKey(CACHE_SEGMENTS.FACTIONS));
                    localStorage.removeItem(getTimestampKey(CACHE_SEGMENTS.FACTIONS));
                    localStorage.removeItem(getVersionKey(CACHE_SEGMENTS.FACTIONS));

                    localStorage.setItem('factionsDataVersion', serverVersion);

                    showNotification("Employee data has been updated.", "success", 4000);

                    await refreshSegments([CACHE_SEGMENTS.FACTIONS]);
                } else if (serverVersion === null && localVersion !== null) {
                    console.log(`🗑️ Global factions version deleted from server. Clearing local cache.`);
                    localStorage.removeItem(getCacheKey(CACHE_SEGMENTS.FACTIONS));
                    localStorage.removeItem(getTimestampKey(CACHE_SEGMENTS.FACTIONS));
                    localStorage.removeItem(getVersionKey(CACHE_SEGMENTS.FACTIONS));
                    localStorage.removeItem('factionsDataVersion');
                    showNotification("Employee data cleared due to server-side deletion.", "info", 4000);
                    await refreshSegments([CACHE_SEGMENTS.FACTIONS]);
                }
            });
        })();

        // --- Listener for Global Select Options Version ---
        (async () => {
            const optionsVersionRef = ref(database, 'appMetadata/selectOptionsDataVersion');
            let initialServerVersion = null;

            try {
                const snapshot = await get(optionsVersionRef);
                if (snapshot.exists()) {
                    initialServerVersion = String(snapshot.val());
                    console.log(`[DataContext] Initial selectOptionsDataVersion fetched from server: v${initialServerVersion}`);
                    localStorage.setItem('selectOptionsDataVersion', initialServerVersion);
                } else {
                    console.log('[DataContext] selectOptionsDataVersion does not exist on server initially. Clearing local version.');
                    localStorage.removeItem('selectOptionsDataVersion');
                }
            } catch (error) {
                console.error('[DataContext] Failed to get initial selectOptionsDataVersion from server:', error);
                localStorage.removeItem('selectOptionsDataVersion');
            }

            firebaseListeners.current.optionsVersion = onValue(optionsVersionRef, async (snapshot) => {
                if (!dataInitializedRef.current) {
                    console.log('[DataContext] Global options version listener triggered, but DataContext not initialized. Skipping.');
                    return;
                }
                const serverVersion = snapshot.exists() ? String(snapshot.val()) : null;
                const localVersion = localStorage.getItem('selectOptionsDataVersion');

                console.log(`Global Select Options Version - Local: ${localVersion || 'N/A'}, Server: ${serverVersion || 'N/A'}`);

                if (serverVersion !== null && localVersion !== serverVersion) { 
                    console.log(`🔄 Global select options version mismatch (v${localVersion} → v${serverVersion}). Clearing and refreshing options cache...`);

                    localStorage.removeItem(getCacheKey(CACHE_SEGMENTS.SELECT_OPTIONS));
                    localStorage.removeItem(getTimestampKey(CACHE_SEGMENTS.SELECT_OPTIONS));
                    localStorage.removeItem(getVersionKey(CACHE_SEGMENTS.SELECT_OPTIONS));

                    localStorage.setItem('selectOptionsDataVersion', serverVersion);

                    showNotification("Select options have been updated.", "success", 4000);

                    await refreshSegments([CACHE_SEGMENTS.SELECT_OPTIONS]);
                } else if (serverVersion === null && localVersion !== null) {
                    console.log(`🗑️ Global select options version deleted from server. Clearing local cache.`);
                    localStorage.removeItem(getCacheKey(CACHE_SEGMENTS.SELECT_OPTIONS));
                    localStorage.removeItem(getTimestampKey(CACHE_SEGMENTS.SELECT_OPTIONS));
                    localStorage.removeItem(getVersionKey(CACHE_SEGMENTS.SELECT_OPTIONS));
                    localStorage.removeItem('selectOptionsDataVersion');
                    showNotification("Select options data cleared due to server-side deletion.", "info", 4000);
                    await refreshSegments([CACHE_SEGMENTS.SELECT_OPTIONS]);
                }
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
                console.log('📦 Using partially or fully cached data from localStorage for segments:', Object.keys(cachedSegments));
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
            setLoading(false);
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
            setLoading(false);
            if (loadingNotificationId) {
                removeNotification(loadingNotificationId);
            }
        }
    }, [
        showNotification, removeNotification, updateCacheSegment, // Added updateCacheSegment
        setFactionsData, setAgencyDataStore, setSelectOptions,
        setIsLoadingData, setLoading, setFormsData,
        isAuthenticated, user, webhooks // Replaced sendDataRequestLog with webhooks
    ]);

    const refreshData = useCallback(async () => {
        setDataLoaded(false); // Invalidate cache
        Object.values(CACHE_SEGMENTS).forEach(segment => {
            localStorage.removeItem(getCacheKey(segment));
            localStorage.removeItem(getTimestampKey(segment));
        });
        await loadData(true); // Force a refresh
    }, [loadData]);

    // Function to notify of direct Firebase updates
    const notifyDataUpdate = useCallback(async (path, type = 'update') => {
        console.log(`🔔 Received direct update notification for path: ${path}`);
        
        // Determine which segment(s) need to be refreshed based on the path
        const segmentsToRefresh = [];
        
        if (path.startsWith('savedReports/')) {
            // Reports don't need localStorage refresh, but we might want to invalidate related data
            return;
        }
        
        // Check if the path matches any of our cache segments
        Object.entries(CACHE_SEGMENTS).forEach(([key, segment]) => {
            if (path.startsWith(segment)) {
                segmentsToRefresh.push(segment);
            }
        });
        
        if (segmentsToRefresh.length > 0) {
            console.log(`🔄 Refreshing segments due to direct update: ${segmentsToRefresh.join(', ')}`);
            await refreshSegments(segmentsToRefresh);
        }
    }, [refreshSegments]);




    const cleanupCache = useCallback(() => {
        // Remove remnants of both versioning systems to be safe
        localStorage.removeItem('formsDataVersion');
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
                    // Set ref to true immediately to prevent re-entry from StrictMode's double invocation
                    dataInitializedRef.current = true; 
                    console.log('[DataContext] Starting DataContext initialization (first useEffect invocation)...');
        
                    try {
                        // loadData handles internal caching logic (memory/localStorage/Firebase fetch)
                        await loadData(); 
                        if (isMounted) {
                            console.log('[DataContext] Data load complete. Setting up Firebase listeners.');
                            sessionStorage.setItem('dataContextInitialized', 'true'); // Mark session as initialized
                            setupFirebaseListeners();
                            cleanupCache(); // <--- ADD THIS LINE
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
                console.log('[DataContext] phmcListData: Faction data empty or malformed');
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
            console.log('[DataContext] coronerListData: Faction data empty or malformed');
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
            console.log('[DataContext] coronerListData using FACTION data:', dataSource.length, 'members');
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
        loading,
        refreshData,
        refreshSegments,
        notifyDataUpdate, // Expose the notification function
        sendDataRequestLog: webhooks.sendDataRequestLog, // Expose the logging function
        isDevMode,
        setIsDevMode,
        lsccData, // Add lsccData to the context value
        hasFirebaseError, // Expose firebase error status
    };
            
                return (
                    <DataContext.Provider value={value}>
                        {children}
                    </DataContext.Provider>    );
};