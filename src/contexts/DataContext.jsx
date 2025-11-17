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
    STAFF: 'staff'
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

    // Define consistent Coroner Categories
    const CORONER_CATEGORIES = [
        'Chief Boss', 'Deputy Chief Medical Examiner-Coroner', 'Supervisor', 
        'Senior Medical Examiner', 'Medical Examiner', 'Senior Coroner Investigator', 
        'Coroner Investigator', 'Forensic Attendant', 'Trainee Forensic-Attendant'
    ];
    // Helper function to update all state values from data
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
                // If we hit quota, clear this segment's cache
                try {
                    localStorage.removeItem(getCacheKey(segment));
                    localStorage.removeItem(getTimestampKey(segment));
                    localStorage.removeItem(getVersionKey(segment));
                } catch (clearError) {
                    console.error(`Failed to clear cache for ${segment}:`, clearError);
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
                setPhysicianRecruitmentDetails(data?.physicianRecruitmentDetails || {});
                setPsychRecruitmentDetails(data?.psychPositionDetailsData || {});
                setAdminRecruitmentDetails(data?.adminPositionDetailsData || {});
                setEmsRecruitmentDetails(data?.emsPositionDetailsData || {});
                setNurseRecruitmentDetails(data?.nursePositionDetailsData || {});
                setCoronerRecruitmentDetails(data?.coronerPositionDetailsData || {});
                break;
            case CACHE_SEGMENTS.STAFF:
                setLegacyPhmcData(data?.phmc || []);
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
    const [legacyPhmcData, setLegacyPhmcData] = useState([]);
    const [isDevMode, setIsDevMode] = useState(false); // Add isDevMode state

    // Segmented cache for fetched data
    const dataCache = useRef({});
    const didLoadFromCache = useRef(false); // Flag to track if cache was used
    const dataInitializedRef = useRef(false); // Flag to track if initial data load is complete
    const [dataLoaded, setDataLoaded] = useState(false);
    const firebaseListeners = useRef({});

    // Cache configuration
    const CACHE_PREFIX = 'firebaseCache';
    const CACHE_VERSION = '1.0';
    const CACHE_EXPIRY = 1000 * 60 * 60 * 24 * 7; // 7 days in milliseconds

    // Version configuration for each segment
    const SEGMENT_VERSIONS = {
        [CACHE_SEGMENTS.FACTIONS]: '1.0',
        [CACHE_SEGMENTS.AGENCIES]: '1.0',
        [CACHE_SEGMENTS.SELECT_OPTIONS]: '1.0',
        [CACHE_SEGMENTS.STAFF]: '1.0'
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
    }, [updateCacheSegment]);


    const loadData = useCallback(async (forceRefresh = false) => {
        // Check memory cache first for each segment
        if (dataLoaded && !forceRefresh && Object.values(CACHE_SEGMENTS).every(segment => 
            dataCache.current[segment] && isCacheValid(segment))) {
            console.log('📦 Using memory-cached Firebase data');
            const size = JSON.stringify(dataCache.current).length;
            const portions = Object.keys(dataCache.current).join(', ');
            sendDataRequestLog('DataContext.jsx', true, 'Memory Cache', size, isAuthenticated, user?.faction?.characterName || user?.username, portions);
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
                console.log('📦 Using localStorage-cached Firebase data');
                const size = JSON.stringify(dataCache.current).length;
                const portions = Object.keys(dataCache.current).join(', ');
                sendDataRequestLog('DataContext.jsx', true, 'Local Storage', size, isAuthenticated, user?.faction?.characterName || user?.username, portions);
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
            loadingNotificationId = showNotification("Data Loading...", 'spinner fa-spin', 0);
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
                    allData[segment] = snapshot.val();
                    hasData = true;
                } else {
                    console.warn(`Segment "${segment}" does not exist in Firebase.`);
                }
            });

            if (hasData) {
                const size = JSON.stringify(allData).length;
                const portions = Object.keys(allData).join(', ');
                sendDataRequestLog('DataContext.jsx', false, 'Firebase', size, isAuthenticated, user?.faction?.characterName || user?.username, portions);
                console.log('[DataContext] Raw data from Firebase:', allData);

                // Update each cache segment independently
                Object.entries(allData).forEach(([path, data]) => {
                    dataCache.current[path] = data;
                    if (!EXCLUDED_FROM_CACHE.includes(path)) {
                        try {
                            localStorage.setItem(getCacheKey(path), JSON.stringify(data));
                            localStorage.setItem(getTimestampKey(path), Date.now().toString());
                        } catch (error) {
                            console.warn(`Failed to cache ${path} to localStorage:`, error);
                            try {
                                localStorage.removeItem(getCacheKey(path));
                                localStorage.removeItem(getTimestampKey(path));
                            } catch (clearError) {
                                console.error(`Failed to clear cache for ${path}:`, clearError);
                            }
                        }
                    } else {
                        console.log(`⏩ Skipping localStorage cache for ${path} (excluded segment)`);
                    }
                });

                console.log('💾 Firebase data cached to localStorage by segments');

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
        showNotification, removeNotification,
        setFactionsData, setAgencyDataStore, setSelectOptions,
        setPhysicianRecruitmentDetails, setPsychRecruitmentDetails, setAdminRecruitmentDetails,
        setEmsRecruitmentDetails, setNurseRecruitmentDetails, setCoronerRecruitmentDetails,
        setLegacyPhmcData, setIsLoadingData, setLoading,
        isAuthenticated, user, sendDataRequestLog, dataLoaded
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

    const coronerListData = useMemo(() => {
        // PHMC FACTION = 364, filtered by CORONER categories
        if ((!factionsData['364'] || !factionsData['364'].members) ) {
            console.log('[DataContext] coronerListData: Both faction and legacy data empty');
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

            const CORONER_KEYWORDS = ['Coroner', 'Examiner', 'Attendant'];
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

    const phmcListData = useMemo(() => {
        // PHMC FACTION = 364, filtered by excluding CORONER categories
        // Fallback to legacy /staff/phmc if faction data is empty
        if ((!factionsData['364'] || !factionsData['364'].members) && (!legacyPhmcData || legacyPhmcData.length === 0)) {
            console.log('[DataContext] phmcListData: Both faction and legacy data empty');
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
                    
                    
                    
                                const CORONER_KEYWORDS = ['Coroner', 'Examiner', 'Attendant'];
                    
                                dataSource = normalizedMembers.filter(member =>
                    
                                    !CORONER_KEYWORDS.some(kw => member.rank.includes(kw))
                    
                                ).map(member => ({ ...member, category: member.rank }));
            
        } else if (legacyPhmcData && legacyPhmcData.length > 0) {
            dataSource = legacyPhmcData.filter(member => !CORONER_CATEGORIES.includes(member.category));
        }

        return dataSource;
    }, [factionsData, legacyPhmcData]);
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
        let isMounted = true;

        const initializeApp = async () => {
            try {
                console.log('[DataContext] Starting full initialization...');
                await loadData(); // This will fetch from Firebase if cache is invalid
                
                if (isMounted) {
                    console.log('[DataContext] Full initialization complete.');
                    sessionStorage.setItem('dataContextInitialized', 'true'); // Mark session as initialized
                    dataInitializedRef.current = true;
                    setupFirebaseListeners();
                }
            } catch (error) {
                console.error('[DataContext] Error during full initialization:', error);
            }
        };

        const loadFromCacheAndListen = async () => {
            try {
                console.log('[DataContext] Session already initialized. Loading from cache...');
                await loadData(); // This will prioritize memory/localStorage cache
                
                if (isMounted) {
                    console.log('[DataContext] Loaded from cache. Setting up listeners.');
                    dataInitializedRef.current = true;
                    setupFirebaseListeners();
                }
            } catch (error) {
                console.error('[DataContext] Error loading from cache:', error);
            }
        };

        if (dataInitializedRef.current) {
            console.log('[DataContext] Already initialized in this component instance. Skipping.');
            return;
        }

        const isSessionInitialized = sessionStorage.getItem('dataContextInitialized') === 'true';

        if (isSessionInitialized) {
            loadFromCacheAndListen();
        } else {
            initializeApp();
        }
        
        cleanupCache();

        // Cleanup on unmount
        return () => {
            isMounted = false;
            Object.values(firebaseListeners.current).forEach(unsubscribe => unsubscribe());
            firebaseListeners.current = {};
        };
    }, []);

    const phmcGroupedOptions = useMemo(() => {
        if (!phmcListData || phmcListData.length === 0) {
            console.log('[DataContext] phmcGroupedOptions: Empty - phmcListData has', phmcListData?.length || 0, 'items');
            return [];
        }
        const grouped = Object.entries(
            phmcListData.reduce((groups, employee) => {
                const categoryName = employee.category || 'Uncategorized';
                if (!groups[categoryName]) {
                    groups[categoryName] = [];
                }
                groups[categoryName].push({
                    value: employee.name,
                    label: employee.name,
                    category: employee.category,
                    lastName: employee.lastName
                });
                return groups;
            }, {})
        ).map(([category, options]) => ({
            label: category,
            options: options.sort((a, b) => {
                if (!a?.label || !b?.label) return 0;
                return a.label.localeCompare(b.label);
            })
        })).sort((a, b) => {
            const order = ['Leadership', 'Hospital Supervisor', 'Chief Resident', 'Physician', 'Resident Physician', 'Physician Assistant', 'Psychiatrist', 'Psychologist', 'Dentist', 'Nursing', 'Emergency Medical Services', 'Attending Physician', 'Uncategorized'];
            return order.indexOf(a.label) - order.indexOf(b.label);
        });
        console.log('[DataContext] phmcGroupedOptions created:', grouped.length, 'groups');
        return grouped;
    }, [phmcListData]);

    const coronerGroupedOptions = useMemo(() => {
        if (!coronerListData || coronerListData.length === 0) return [];
        return Object.entries(
            coronerListData.reduce((groups, coroner) => {
                const categoryName = coroner.category || 'Uncategorized';
                if (!groups[categoryName]) {
                    groups[categoryName] = [];
                }
                groups[categoryName].push({
                    value: coroner.name, // Or a unique ID
                    label: coroner.name,
                    badge: coroner.badge,
                    rank: coroner.rank,
                    discord: coroner.discord,
                    category: categoryName
                    // Add other fields
                });
                return groups;
            }, {})
        ).map(([category, options]) => ({
            label: category,
            options: options.sort((a, b) => {
                if (!a?.label || !b?.label) return 0;
                return a.label.localeCompare(b.label);
            })
        })).sort((a, b) => { // Your existing sorting logic for coroner categories
            const order = ['Chief Boss', 'Deputy Chief Medical Examiner-Coroner', 'Supervisor', 'Senior Medical Examiner', 'Medical Examiner', 'Senior Coroner Investigator', 'Coroner Investigator', 'Forensic Attendant', 'Trainee Forensic-Attendant', 'Developer Testing', 'Missing_Category', 'Uncategorized'];
            return order.indexOf(a.label) - order.indexOf(b.label);
        });
    }, [coronerListData]);

    const value = {
        factionsData,
        phmcListData,
        coronerListData,
        phmcGroupedOptions,
        coronerGroupedOptions,
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
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};