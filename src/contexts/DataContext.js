import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { database } from '../firebase';
import { ref, get, onChildChanged, onValue } from 'firebase/database';
import { useNotification } from './NotificationContext';

// Define cache segments
const CACHE_SEGMENTS = {
    STAFF: 'staff',
    AGENCIES: 'agencies',
    SELECT_OPTIONS: 'selectOptions'
};

// Define segments that should not be cached in localStorage
const EXCLUDED_FROM_CACHE = ['savedReports'];

const DataContext = createContext();

export const useData = () => {
    return useContext(DataContext);
};

export const DataProvider = ({ children }) => {
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
        } else {
            console.log(`⏩ Skipping localStorage cache for ${segment} (excluded segment)`);
        }

        // Update relevant state based on segment
        switch (segment) {
            case CACHE_SEGMENTS.STAFF:
                setPhmcListData(data?.phmc || []);
                setCoronerListData(data?.coroner || []);
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
    const [phmcListData, setPhmcListData] = useState([]);
    const [coronerListData, setCoronerListData] = useState([]);
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

    // Segmented cache for fetched data
    const dataCache = useRef({});
    const didLoadFromCache = useRef(false); // Flag to track if cache was used
    const [dataLoaded, setDataLoaded] = useState(false);
    const firebaseListeners = useRef({});

    // Cache configuration
    const CACHE_PREFIX = 'firebaseCache';
    const CACHE_VERSION = '1.0';
    const CACHE_EXPIRY = 1000 * 60 * 60 * 24 * 7; // 7 days in milliseconds

    // Version configuration for each segment
    const SEGMENT_VERSIONS = {
        [CACHE_SEGMENTS.STAFF]: '1.0',
        [CACHE_SEGMENTS.AGENCIES]: '1.0',
        [CACHE_SEGMENTS.SELECT_OPTIONS]: '1.0'
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

        // --- Listener for staff changes ---
        const staffRef = ref(database, CACHE_SEGMENTS.STAFF);
        let isInitialStaffCallback = true;
        firebaseListeners.current.staff = onValue(staffRef, (snapshot) => {
            if (didLoadFromCache.current && isInitialStaffCallback) {
                isInitialStaffCallback = false;
                console.log('⏩ Skipping initial Firebase staff update because cache was used.');
                return;
            }
            isInitialStaffCallback = false;

            if (snapshot.exists()) {
                const staffData = snapshot.val();
                if (JSON.stringify(staffData) === JSON.stringify(dataCache.current[CACHE_SEGMENTS.STAFF])) return;
                updateCacheSegment(CACHE_SEGMENTS.STAFF, staffData);
                console.log('🔄 Staff data updated from Firebase');
            }
        });

        // --- Listener for agency changes ---
        const agenciesRef = ref(database, CACHE_SEGMENTS.AGENCIES);
        let isInitialAgencyCallback = true;
        firebaseListeners.current.agencies = onValue(agenciesRef, (snapshot) => {
            if (didLoadFromCache.current && isInitialAgencyCallback) {
                isInitialAgencyCallback = false;
                console.log('⏩ Skipping initial Firebase agency update because cache was used.');
                return;
            }
            isInitialAgencyCallback = false;

            if (snapshot.exists()) {
                const agencyData = snapshot.val();
                if (JSON.stringify(agencyData) === JSON.stringify(dataCache.current[CACHE_SEGMENTS.AGENCIES])) return;
                updateCacheSegment(CACHE_SEGMENTS.AGENCIES, agencyData);
                console.log('🔄 Agency data updated from Firebase');
            }
        });

        // --- Listener for select options changes ---
        const optionsRef = ref(database, CACHE_SEGMENTS.SELECT_OPTIONS);
        let isInitialOptionsCallback = true;
        firebaseListeners.current.options = onValue(optionsRef, (snapshot) => {
            if (didLoadFromCache.current && isInitialOptionsCallback) {
                isInitialOptionsCallback = false;
                console.log('⏩ Skipping initial Firebase select options update because cache was used.');
                return;
            }
            isInitialOptionsCallback = false;

            if (snapshot.exists()) {
                const optionsData = snapshot.val();
                if (JSON.stringify(optionsData) === JSON.stringify(dataCache.current[CACHE_SEGMENTS.SELECT_OPTIONS])) return;
                updateCacheSegment(CACHE_SEGMENTS.SELECT_OPTIONS, optionsData);
                console.log('🔄 Select options updated from Firebase');
            }
        });
    }, [updateCacheSegment]);

    const loadData = useCallback(async (forceRefresh = false) => {
        // Check memory cache first for each segment
        if (dataLoaded && !forceRefresh && Object.values(CACHE_SEGMENTS).every(segment => 
            dataCache.current[segment] && isCacheValid(segment))) {
            console.log('📦 Using memory-cached Firebase data');
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

            const dbRootRef = ref(database);
            const snapshot = await get(dbRootRef);

            if (snapshot.exists()) {
                const allData = snapshot.val();
                
                // Update each cache segment independently
                Object.entries(CACHE_SEGMENTS).forEach(([key, path]) => {
                    if (allData[path]) {
                        dataCache.current[path] = allData[path];
                        if (!EXCLUDED_FROM_CACHE.includes(path)) {
                            try {
                                localStorage.setItem(getCacheKey(path), JSON.stringify(allData[path]));
                                localStorage.setItem(getTimestampKey(path), Date.now().toString());
                            } catch (error) {
                                console.warn(`Failed to cache ${path} to localStorage:`, error);
                                // If we hit quota, clear this segment's cache
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
        } finally {
            setIsLoadingData(false);
            setLoading(false);
            if (loadingNotificationId) {
                removeNotification(loadingNotificationId);
            }
        }
    }, [
        showNotification, removeNotification,
        setPhmcListData, setCoronerListData, setAgencyDataStore, setSelectOptions,
        setPhysicianRecruitmentDetails, setPsychRecruitmentDetails, setAdminRecruitmentDetails,
        setEmsRecruitmentDetails, setNurseRecruitmentDetails, setCoronerRecruitmentDetails,
        setIsLoadingData, setLoading
    ]);

    // Cleanup old cache entries
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
        const initialLoad = async () => {
            await loadData();
            // Only set up listeners after the initial data load is complete
            if (!Object.keys(firebaseListeners.current).length) {
                setupFirebaseListeners();
            }
        };

        initialLoad();
        cleanupCache(); // Clean up old cache entries

        // Cleanup listeners on unmount
        return () => {
            Object.values(firebaseListeners.current).forEach(unsubscribe => unsubscribe());
        };
    }, [loadData, setupFirebaseListeners, cleanupCache]);

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

    const value = {
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
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};