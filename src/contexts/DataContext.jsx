import React, { createContext, useState, useEffect, useContext, useCallback, useRef, useMemo } from 'react';
import { database } from '../firebase';
import { ref, get, onChildChanged, onValue, set } from 'firebase/database';
import { useNotification } from './NotificationContext.jsx';
import { useWebhooks } from '../hooks/useWebhooks';
import useGtaWorldAuth from '../hooks/useGtaWorldAuth';

// Define cache segments
const CACHE_SEGMENTS = {
    FACTIONS: 'factions',
    AGENCIES: 'agencies',
    SELECT_OPTIONS: 'selectOptions',
    FORMS: 'forms',
    LSCC: 'lscc'
};

// Define segments that should not be cached in localStorage
const EXCLUDED_FROM_CACHE = ['savedReports'];

const DataContext = createContext();

export const useData = () => {
    return useContext(DataContext);
};

export const DataProvider = ({ children }) => {
    const { sendDataRequestLog } = useWebhooks();
    const { user, isAuthenticated } = useGtaWorldAuth();


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
                console.log(`💾 Updated cache segment: ${segment} (v${version})`);
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
                setPhysicianRecruitmentDetails(data?.physicianRecruitmentDetails || {});
                setPsychRecruitmentDetails(data?.psychPositionDetailsData || {});
                setAdminRecruitmentDetails(data?.adminPositionDetailsData || {});
                setEmsRecruitmentDetails(data?.emsPositionDetailsData || {});
                setNurseRecruitmentDetails(data?.nursePositionDetailsData || {});
                setCoronerRecruitmentDetails(data?.coronerPositionDetailsData || {});
                break;
            case CACHE_SEGMENTS.FORMS:
                // Ensure formsData is always an array
                const formsAsList = Array.isArray(data) ? data : (data ? Object.keys(data).map(key => ({ ...data[key], firebaseKey: key })) : []);
                setFormsData(formsAsList);
                break;
            case CACHE_SEGMENTS.LSCC:
                // Assuming you want to set some state for LSCC data as well
                setLsccData(data || {});
                break;
            default:
                console.warn(`Unknown cache segment: ${segment}`);
        }
    }, []);

    const updateStateWithData = (data) => {
        Object.entries(CACHE_SEGMENTS).forEach(([key, segment]) => {
            if (data[segment]) {
                updateCacheSegment(segment, data[segment]);
            }
        });
    };
    const { showNotification, removeNotification } = useNotification();
    const [factionsData, setFactionsData] = useState({});
    const [agencyDataStore, setAgencyDataStore] = useState({});
    const [selectOptions, setSelectOptions] = useState({});
    const [physicianRecruitmentDetails, setPhysicianRecruitmentDetails] = useState({});
    const [psychRecruitmentDetails, setPsychRecruitmentDetails] = useState({});
    const [adminRecruitmentDetails, setAdminRecruitmentDetails] = useState({});
    const [emsRecruitmentDetails, setEmsRecruitmentDetails] = useState({});
    const [nurseRecruitmentDetails, setNurseRecruitmentDetails] = useState({});
    const [coronerRecruitmentDetails, setCoronerRecruitmentDetails] = useState({});
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [loading, setLoading] = useState(true);

    const [formsData, setFormsData] = useState([]);
    const [lsccData, setLsccData] = useState({}); // New state for LSCC data
    const [isDevMode, setIsDevMode] = useState(false); // Add isDevMode state

    // Segmented cache for fetched data
    const dataCache = useRef({});
    const didLoadFromCache = useRef(false); // Flag to track if cache was used
    const dataInitializedRef = useRef(false); // Flag to track if initial data load is complete
    const hasLoggedInitialLoad = useRef(false); // Flag to prevent duplicate logging in StrictMode
    const [dataLoaded, setDataLoaded] = useState(false);
    const firebaseListeners = useRef({});

    // Cache configuration
    const CACHE_PREFIX = 'firebaseCache';
    const CACHE_VERSION = '1.0';
    const CACHE_EXPIRY = 1000 * 60 * 60 * 24 * 30; // 30 days in milliseconds

    // Version configuration for each segment
    const SEGMENT_VERSIONS = {
        [CACHE_SEGMENTS.FACTIONS]: '1.1',
        [CACHE_SEGMENTS.AGENCIES]: '1.1',
        [CACHE_SEGMENTS.SELECT_OPTIONS]: '1.2.2',
        [CACHE_SEGMENTS.FORMS]: '1.2.2', // Increment version for structural changes
        [CACHE_SEGMENTS.LSCC]: '1.0',
    };

    const getSegmentVersion = (segment) => SEGMENT_VERSIONS[segment] || '1.0';

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

    // Setup Firebase listeners for real-time updates
    const setupFirebaseListeners = useCallback(() => {
        // Cleanup existing listeners
        Object.values(firebaseListeners.current).forEach(unsubscribe => unsubscribe());
        firebaseListeners.current = {};

        // --- Listener for factions changes ---
        const factionsRef = ref(database, CACHE_SEGMENTS.FACTIONS);
        firebaseListeners.current.factions = onValue(factionsRef, (snapshot) => {
            if (!dataInitializedRef.current) return; // Only process updates after initial load

            if (snapshot.exists()) {
                const factionsData = snapshot.val();
                // Only update if data has actually changed to prevent unnecessary re-renders
                if (JSON.stringify(factionsData) !== JSON.stringify(dataCache.current[CACHE_SEGMENTS.FACTIONS])) {
                    updateCacheSegment(CACHE_SEGMENTS.FACTIONS, factionsData);
                    console.log('🔄 Factions data updated from Firebase (real-time)');
                }
            }
        });

        // --- Listener for agency changes ---
        const agenciesRef = ref(database, CACHE_SEGMENTS.AGENCIES);
        firebaseListeners.current.agencies = onValue(agenciesRef, (snapshot) => {
            if (!dataInitializedRef.current) return; // Only process updates after initial load

            if (snapshot.exists()) {
                const agencyData = snapshot.val();
                if (JSON.stringify(agencyData) !== JSON.stringify(dataCache.current[CACHE_SEGMENTS.AGENCIES])) {
                    updateCacheSegment(CACHE_SEGMENTS.AGENCIES, agencyData);
                    console.log('🔄 Agency data updated from Firebase (real-time)');
                }
            }
        });

        // --- Listener for select options changes ---
        const optionsRef = ref(database, CACHE_SEGMENTS.SELECT_OPTIONS);
        firebaseListeners.current.options = onValue(optionsRef, (snapshot) => {
            if (!dataInitializedRef.current) return; // Only process updates after initial load

            if (snapshot.exists()) {
                const optionsData = snapshot.val();
                if (JSON.stringify(optionsData) !== JSON.stringify(dataCache.current[CACHE_SEGMENTS.SELECT_OPTIONS])) {
                    updateCacheSegment(CACHE_SEGMENTS.SELECT_OPTIONS, optionsData);
                    console.log('🔄 Select options updated from Firebase (real-time)');
                }
            }
        });

        // --- Listener for forms changes ---
        const formsRef = ref(database, CACHE_SEGMENTS.FORMS);
        firebaseListeners.current.forms = onValue(formsRef, (snapshot) => {
            if (!dataInitializedRef.current) return;

            if (!snapshot.exists()) {
                if ((dataCache.current[CACHE_SEGMENTS.FORMS] || []).length > 0) {
                    updateCacheSegment(CACHE_SEGMENTS.FORMS, []);
                }
                return;
            }

            const firebaseFormsObject = snapshot.val();
            const serverFormsList = Object.keys(firebaseFormsObject).map(key => ({ ...firebaseFormsObject[key], firebaseKey: key }));
            const localFormsData = dataCache.current[CACHE_SEGMENTS.FORMS];
            const localFormsList = Array.isArray(localFormsData) ? localFormsData : [];
            // Filter out any null or undefined entries before mapping
            const cleanLocalFormsList = localFormsList.filter(f => f && typeof f === 'object');
            const localFormsMap = new Map(cleanLocalFormsList.map(f => [f.firebaseKey, f]));
            let needsUpdate = false;

            serverFormsList.forEach(serverForm => {
                const localForm = localFormsMap.get(serverForm.firebaseKey);
                if (!localForm) {
                    needsUpdate = true;
                    return;
                }

                const serverTimestamp = serverForm.lastUpdated || 0;
                const localTimestamp = localForm.lastUpdated || 0;

                if (serverTimestamp > localTimestamp) {
                    needsUpdate = true;
                }
            });

            const somethingWasDeleted = localFormsList.some(oldForm => !firebaseFormsObject.hasOwnProperty(oldForm.firebaseKey));
            if (somethingWasDeleted) {
                needsUpdate = true;
            }

            if (needsUpdate) {
                serverFormsList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                updateCacheSegment(CACHE_SEGMENTS.FORMS, serverFormsList);
            }
        });
    }, [updateCacheSegment]);


    const loadData = useCallback(async (forceRefresh = false) => {
        // If data is already loaded and we are not forcing a refresh, exit early.
        // This is crucial to prevent re-fetching in StrictMode's double invocation.
        if (dataLoaded && !forceRefresh) {
            console.log('[DataContext] Data already loaded and no force refresh. Skipping redundant loadData call.');
            return;
        }

        // Check memory cache first for each segment
        if (dataLoaded && !forceRefresh && Object.values(CACHE_SEGMENTS).every(segment => 
            dataCache.current[segment] && isCacheValid(segment))) {
            if (!hasLoggedInitialLoad.current) {
                console.log('📦 Using memory-cached Firebase data');
                const size = JSON.stringify(dataCache.current).length;
                const portions = Object.keys(dataCache.current).join(', ');
                sendDataRequestLog('DataContext.jsx', true, 'Memory Cache', size, isAuthenticated, user?.faction?.characterName || user?.username, portions);
                hasLoggedInitialLoad.current = true;
            }
            setIsLoadingData(false);
            setLoading(false);
            return;
        }

        // Check localStorage cache for each segment
        if (!forceRefresh) {
            const allSegmentsLoaded = Object.values(CACHE_SEGMENTS).every(segment => {
                const cachedData = localStorage.getItem(getCacheKey(segment));
                if (cachedData && isCacheValid(segment)) {
                    try {
                        const parsedData = JSON.parse(cachedData);
                        dataCache.current[segment] = parsedData;
                        return true;
                    } catch (error) {
                        console.error(`Error parsing cached data for ${segment}:`, error);
                        return false;
                    }
                }
                return false;
            });

            if (allSegmentsLoaded) {
                if (!hasLoggedInitialLoad.current) {
                    console.log('📦 Using localStorage-cached Firebase data');
                    if (dataCache.current[CACHE_SEGMENTS.FORMS]) {
                        const formsList = Array.isArray(dataCache.current[CACHE_SEGMENTS.FORMS]) ? dataCache.current[CACHE_SEGMENTS.FORMS] : [];
                        console.log(`📦 -> Forms loaded from cache: ${formsList.length} forms.`);
                    }
                    const size = JSON.stringify(dataCache.current).length;
                    const portions = Object.keys(dataCache.current).join(', ');
                    sendDataRequestLog('DataContext.jsx', true, 'Local Storage', size, isAuthenticated, user?.faction?.characterName || user?.username, portions);
                    hasLoggedInitialLoad.current = true;
                }
                updateStateWithData(dataCache.current);
                setDataLoaded(true);
                setIsLoadingData(false);
                setLoading(false);
                didLoadFromCache.current = true; // Set the flag
                return;
            }
        }

        let loadingNotificationId;
        try {
            loadingNotificationId = showNotification(`Data Loading from ${window.location.hostname}...`, 'spinner fa-spin', 0);
            console.log('🔄 Fetching fresh data from Firebase...');
            
            const segmentsToFetch = Object.values(CACHE_SEGMENTS);
            console.log('🔄 Fetching fresh data from Firebase for segments:', segmentsToFetch);

            const promises = segmentsToFetch.map(segment => {
                const segmentRef = ref(database, segment);
                return get(segmentRef).then(snapshot => ({ segment, snapshot }));
            });

            const results = await Promise.all(promises);

            const allData = {};
            let hasData = false;

            results.forEach(({ segment, snapshot }) => {
                if (snapshot.exists()) {
                    // Special handling for FORMS: convert object to list and add firebaseKey
                    if (segment === CACHE_SEGMENTS.FORMS) {
                        const formsObject = snapshot.val();
                        allData[segment] = Object.keys(formsObject).map(key => ({ ...formsObject[key], firebaseKey: key }));
                    } else {
                        allData[segment] = snapshot.val();
                    }
                    hasData = true;
                } else {
                    console.warn(`Segment "${segment}" does not exist in Firebase.`);
                }
            });

            if (hasData) {
                if (!hasLoggedInitialLoad.current) {
                    const size = JSON.stringify(allData).length;
                    const portions = Object.keys(allData).join(', ');
                    sendDataRequestLog('DataContext.jsx', false, 'Firebase', size, isAuthenticated, user?.faction?.characterName || user?.username, portions);
                    hasLoggedInitialLoad.current = true;
                }
                console.log('[DataContext] Raw data from Firebase:', allData);

                // Update each cache segment independently
                Object.entries(allData).forEach(([path, data]) => {
                    dataCache.current[path] = data;
                    if (!EXCLUDED_FROM_CACHE.includes(path)) {
                        try {
                            localStorage.setItem(getCacheKey(path), JSON.stringify(data));
                            localStorage.setItem(getTimestampKey(path), Date.now().toString());
                            localStorage.setItem(getVersionKey(path), getSegmentVersion(path)); // Ensure version is stored
                        } catch (error) {
                            console.warn(`Failed to cache ${path} to localStorage:`, error);
                            try {
                                localStorage.removeItem(getCacheKey(path));
                                localStorage.removeItem(getTimestampKey(path));
                                localStorage.removeItem(getVersionKey(path));
                            } catch (clearError) {
                                console.error(`Failed to clear cache for ${path}:`, clearError);
                            }
                        }
                    } else {
                        console.log(`⏩ Skipping localStorage cache for ${path} (excluded segment)`);
                    }
                });

                console.log('💾 Firebase data cached to localStorage by segments');
                
                if (allData[CACHE_SEGMENTS.FORMS]) {
                    const formsList = Array.isArray(allData[CACHE_SEGMENTS.FORMS]) ? allData[CACHE_SEGMENTS.FORMS] : [];
                    console.log(` fetched from Firebase: ${formsList.length} forms.`);
                }

                // Update all state values
                updateStateWithData(allData);
                showNotification("Data Loaded!", 'check-circle', 2000);
                setDataLoaded(true);
            } else {
                showNotification('Initial application data not found on server.', 'error');
            }
        } catch (error) {
            showNotification("An error has happened, contact the maintainer", 'error');
            console.error("Error fetching data from Realtime Database:", error);
            const portions = Object.values(CACHE_SEGMENTS).join(', ');
            sendDataRequestLog('DataContext.jsx', false, 'Firebase Error', 0, isAuthenticated, user?.faction?.characterName || user?.username, portions, error.message || 'Unknown Fetch Error');
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
        setPhysicianRecruitmentDetails, setPsychRecruitmentDetails, setAdminRecruitmentDetails,
        setEmsRecruitmentDetails, setNurseRecruitmentDetails, setCoronerRecruitmentDetails,
        setIsLoadingData, setLoading, setFormsData,
        isAuthenticated, user, sendDataRequestLog
    ]);

    const refreshData = useCallback(async () => {
        setDataLoaded(false); // Invalidate cache
        Object.values(CACHE_SEGMENTS).forEach(segment => {
            localStorage.removeItem(getCacheKey(segment));
            localStorage.removeItem(getTimestampKey(segment));
        });
        await loadData(true); // Force a refresh
    }, [loadData]);

    // Function to refresh specific segments
    const refreshSegments = useCallback(async (segments = []) => {
        const segmentsToRefresh = segments.length > 0 ? segments : Object.values(CACHE_SEGMENTS);
        
        for (const segment of segmentsToRefresh) {
            if (!CACHE_SEGMENTS[segment]) {
                console.warn(`Invalid segment: ${segment}`);
                continue;
            }

            const segmentRef = ref(database, segment);
            try {
                const snapshot = await get(segmentRef);
                if (snapshot.exists()) {
                    await updateCacheSegment(segment, snapshot.val());
                }
            } catch (error) {
                console.error(`Failed to refresh segment ${segment}:`, error);
                showNotification(`Failed to refresh ${segment} data`, 'error');
            }
        }
    }, [updateCacheSegment, showNotification]);

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
            
            const normalizedMembers = allMembers.map(member => ({
                ...member,
                name: member.characterName || member.name || member.displayName || member.username || 'Unknown',
                rank: member.rank || '',
            }));
    
            let dataSource = normalizedMembers.filter(member =>
                !CORONER_KEYWORDS.some(kw => member.rank.includes(kw))
            ).map(member => ({ ...member, category: member.rank }));
            
            return dataSource;
        }, [factionsData]);
            
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
            
            const normalizedMembers = allMembers.map(member => ({
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
    }, [factionsData]);

    const value = {
        factionsData,
        formsData,
        phmcListData,
        coronerListData,
        agencyDataStore,
        selectOptions,
        physicianRecruitmentDetails,
        psychRecruitmentDetails,
        adminRecruitmentDetails,
        emsRecruitmentDetails,
        nurseRecruitmentDetails,
        coronerRecruitmentDetails,
        isLoadingData,
        loading,
        refreshData,
        refreshSegments,
        notifyDataUpdate, // Expose the notification function
        sendDataRequestLog, // Expose the logging function
                isDevMode,
                setIsDevMode,
                lsccData, // Add lsccData to the context value
            };
            
                return (
                    <DataContext.Provider value={value}>
                        {children}
                    </DataContext.Provider>    );
};