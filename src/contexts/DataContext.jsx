import React, { createContext, useState, useEffect, useContext, useCallback, useRef, useMemo } from 'react';
import { database } from '../firebase';
import { ref, get, onValue } from 'firebase/database';
import { useNotification } from './NotificationContext.jsx';
import { useWebhooks } from '../hooks/useWebhooks';
import { useInactivityReload } from '../hooks/useInactivityReload';
import useGtaWorldAuth from '../hooks/useGtaWorldAuth';
import { triggerGetMorgueRecords, triggerGetProtocolsDev } from '../services/firebaseFunctions';
import { isStagingMode, resolveStagingPath, resolveVersionRef, resolveVersionKey } from '../utils/stagingPath';
import { idbGet, idbSet, idbRemove } from '../utils/idbCache';

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
// morgue-records uses IndexedDB (too large for 5MB localStorage quota)
const EXCLUDED_FROM_CACHE = ['savedReports', 'morgue-records'];

// ── Staging Mode ──
// Resolves forms → forms_staging via the shared stagingPath utility.
// Localhost defaults to staging; see ../utils/stagingPath.js for rules.
const IS_STAGING = isStagingMode();
const resolveFormsPath = (segment) => resolveStagingPath(segment);
const FORMS_VERSION_KEY = resolveVersionKey('formsDataVersion');
const FORMS_VERSION_REF_PATH = resolveVersionRef('appMetadata/formsDataVersion');

// ── Localhost dev override ──
// On dev hosts, EMS Protocols load from the VPS-hosted dev dataset (fetched via
// the getProtocolsDev function) so dev content never touches production and the
// heavy base64 images stay out of RTDB. Falls back to prod protocols on error.
const IS_DEV_HOST = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname.startsWith('192.'));
const applyLsccDevOverride = async (data) => {
    if (!IS_DEV_HOST || !data || typeof data !== 'object') return data;
    try {
        const res = await triggerGetProtocolsDev();
        const devProtocols = res?.protocols;
        if (Array.isArray(devProtocols) && devProtocols.length > 0) {
            return { ...data, protocols: devProtocols };
        }
    } catch (err) {
        console.warn('[DataContext] Failed to load dev protocols:', err?.message || err);
    }
    return data;
};

const DataContext = createContext();

export const useData = () => {
    return useContext(DataContext);
};

// Rank-string keywords that classify a PHMC faction member as Coroner staff.
// Used only where the coroner distinction is still needed (legacy UI grouping,
// diagnostics) — the roster itself is a single list (factionListData).
export const CORONER_KEYWORDS = ['Coroner', 'Examiner', 'Attendant'];

export const isCoronerMember = (member) => CORONER_KEYWORDS.some((kw) => (member?.rank || '').includes(kw));

export const DataProvider = ({ children }) => {
    const { user, isAuthenticated } = useGtaWorldAuth();
        const { showNotification, removeNotification } = useNotification();
    const { getIsInactivityWarningTriggered } = useInactivityReload();
        const [factionsData, setFactionsData] = useState({});
    const [agencyDataStore, setAgencyDataStore] = useState({});
    const [selectOptions, setSelectOptions] = useState({});
    const [morgueRecords, setMorgueRecords] = useState([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
  const [morgueLoading, setMorgueLoading] = useState(false);
    const [pendingRefreshInfo, setPendingRefreshInfo] = useState(null);

    const debounceTimers = useRef({});

const webhooks = useWebhooks(null, null, showNotification, getIsInactivityWarningTriggered);
    const updateCacheSegment = useCallback(async (segment, data) => {
        // Update memory cache
        dataCache.current[segment] = data;

        // Skip localStorage for undefined/null segments
        if (!segment) return;

        // Don't cache excluded segments in localStorage
        if (!EXCLUDED_FROM_CACHE.includes(segment)) {
            try {
                const version = getSegmentVersion(segment);
                const cacheSegment = resolveFormsPath(segment); // staging-aware cache key
                localStorage.setItem(getCacheKey(cacheSegment), JSON.stringify(data));
                localStorage.setItem(getTimestampKey(cacheSegment), Date.now().toString());
                localStorage.setItem(getVersionKey(cacheSegment), version);

                const cachedDataSize = (JSON.stringify(data)?.length || 0) / 1024;
                let logMessage = `💾 Updated cache segment: ${segment} (v${version}) (${cachedDataSize.toFixed(2)} KB)`;

                // If updating the forms segment, append the Firebase Data version
                if (segment === CACHE_SEGMENTS.FORMS) {
                    const firebaseDataVersion = localStorage.getItem(FORMS_VERSION_KEY) || 'N/A';
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
            case CACHE_SEGMENTS.FORMS:
            case 'forms_staging': {
                // Ensure formsData is always an array
                const formsAsList = Array.isArray(data) ? data : (data ? Object.keys(data).map(key => ({ ...data[key], firebaseKey: key })) : []);
                setFormsData(formsAsList);
                break;
            }
            case CACHE_SEGMENTS.LSCC: {
                const finalLscc = await applyLsccDevOverride(data);
                setLsccData(finalLscc || {});
                break;
            }
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
    const [morgueRecordsError, setMorgueRecordsError] = useState(null);

    // Segmented cache for fetched data
    const dataCache = useRef({});
    const didLoadFromCache = useRef(false); // Flag to track if cache was used
    const dataInitializedRef = useRef(false); // Flag to track if initial data load is complete
    const hasLoggedInitialLoad = useRef(false); // Flag to prevent duplicate logging in StrictMode
    const [dataLoaded, setDataLoaded] = useState(false);
    const firebaseListeners = useRef({});
    const morgueRecordsLoadedRef = useRef(false);
  const morgueFetchInFlightRef = useRef(null);

    // Cache configuration
    const CACHE_PREFIX = 'firebaseCache';
    const CACHE_EXPIRY = 1000 * 60 * 60 * 24 * 90; // 90 days — was 30d, 20 MB/hr was driven by version churn, not expiry; 90d cuts cold fetches 3×
    const LOCAL_STORAGE_SAFETY_VERSION = '1.0'; // Manually bump this to clear all localStorage if needed

    // Version configuration for each segment, some versions are dynamic updated in Firebase but manually bump if required
    const SEGMENT_VERSIONS = {
        [CACHE_SEGMENTS.FACTIONS]: '1.2',
        [CACHE_SEGMENTS.AGENCIES]: '1.1',
        [CACHE_SEGMENTS.FORMS]: '1.2.3', 
        [CACHE_SEGMENTS.LSCC]: '1.0',
        [CACHE_SEGMENTS.VERIFIED_ADMINS]: '1.0',
        [CACHE_SEGMENTS.MORGUE_RECORDS]: '1.1',  // bumped 2026-07-05 — switched from Firebase to VPS API
    };

    const getSegmentVersion = (segment) => {
        if (segment === CACHE_SEGMENTS.FORMS) return localStorage.getItem(FORMS_VERSION_KEY) || '0';
        if (segment === CACHE_SEGMENTS.FACTIONS) return localStorage.getItem('factionsDataVersion') || '0';
        if (segment === CACHE_SEGMENTS.SELECT_OPTIONS) return localStorage.getItem('selectOptionsDataVersion') || '0';
        if (segment === CACHE_SEGMENTS.LSCC) return localStorage.getItem('lsccDataVersion') || '0';
        if (segment === CACHE_SEGMENTS.MORGUE_RECORDS) return localStorage.getItem('morgueDataVersion') || '0';
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

            const segmentRef = ref(database, resolveFormsPath(segment));
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

    const DEBOUNCE_DELAY_MS = 15 * 60 * 1000; // was 5m — 20 MB/hr was 5 version bumps → herd; 15m coalesces

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

    // Lazy-load morgue records on demand (not fetched during initial app load)
    const loadMorgueRecords = useCallback(async () => {
        // In-flight dedup: concurrent callers (auth init + sidebar + autopsy modal)
        // share one fetch instead of each firing a fresh Cloud Function call.
        if (morgueFetchInFlightRef.current) return morgueFetchInFlightRef.current;
        setMorgueLoading(true);
        morgueFetchInFlightRef.current = (async () => {
        setMorgueRecordsError(null); // Clear any previous error

        // Already loaded — return cached data
        if (morgueRecordsLoadedRef.current && dataCache.current[CACHE_SEGMENTS.MORGUE_RECORDS]) {
            return dataCache.current[CACHE_SEGMENTS.MORGUE_RECORDS];
        }

        const segment = CACHE_SEGMENTS.MORGUE_RECORDS;

        // Try loading from IndexedDB cache first (supports large data, unlike localStorage)
        if (!morgueRecordsLoadedRef.current) {
            try {
                const idbData = await idbGet('morgue-records');
                if (idbData && idbData.data && idbData.version) {
                    const localVersion = localStorage.getItem('morgueDataVersion');
                    if (String(idbData.version) === String(localVersion)) {
                        dataCache.current[segment] = idbData.data;
                        const morgueAsList = Object.keys(idbData.data).map(key => ({ ...idbData.data[key], firebaseKey: key }));
                        setMorgueRecords(morgueAsList);
                        morgueRecordsLoadedRef.current = true;
                        const cacheSizeKB = (JSON.stringify(idbData.data).length / 1024).toFixed(2);
                        console.debug(`[DataContext] Loaded morgue records from IndexedDB (${cacheSizeKB} KB)`);
                        return idbData.data;
                    }
                }
            } catch (err) {
                console.warn('[DataContext] IndexedDB cache read failed, fetching fresh:', err.message);
            }
        }

        // Fetch from VPS API via Firebase Function (replaces direct Firebase RTDB read)
        try {
            const result = await triggerGetMorgueRecords();  // no limit — VPS returns all records

            // Convert the records array back to the Firebase-style object for the cache layer
            const data = {};
            if (result?.records && Array.isArray(result.records)) {
                result.records.forEach(r => {
                    data[r.caseId] = r;
                });
            }

            if (Object.keys(data).length > 0) {
                // Update the local version from the API response
                const version = result.morgueDataVersion;
                if (version) {
                    localStorage.setItem('morgueDataVersion', String(version));
                }

                // Save to IndexedDB for persistent cache (much larger quota than localStorage)
                try {
                    await idbSet('morgue-records', { data, version, cachedAt: Date.now() });
                } catch (idbErr) {
                    console.warn('[DataContext] Failed to save morgue cache to IndexedDB:', idbErr.message);
                }

                const segmentSize = (JSON.stringify(data).length / 1024).toFixed(2);
                await updateCacheSegment(CACHE_SEGMENTS.MORGUE_RECORDS, data);
                morgueRecordsLoadedRef.current = true;
                console.debug(`[DataContext] Fetched morgue records from VPS API via Cloud Function (${segmentSize} KB) — cached to IndexedDB`);

                // Log the lazy load for observability
                try {
                    const loadingMode = {};
                    Object.values(CACHE_SEGMENTS).forEach(s => {
                        loadingMode[s] = s === CACHE_SEGMENTS.MORGUE_RECORDS ? 'network' : 'not_loaded';
                    });
                    webhooks.sendDataRequestLog('DataContext.jsx', false, 'Cloud Function', 0, parseFloat(segmentSize), isAuthenticated, user?.faction?.characterName || user?.username, ['morgue-records'], [], { 'morgue-records': parseFloat(segmentSize) }, null, {
                        route: window.location.hash || '/',
                        trigger: 'lazy',
                        segmentSources: loadingMode
                    });
                } catch (logError) {
                    console.warn('[DataContext] Failed to send morgue data request log:', logError);
                }

                return data;
            } else {
                console.warn('[DataContext] Morgue records API returned empty.');
                morgueRecordsLoadedRef.current = true;
                return null;
            }
        } catch (error) {
            console.error('[DataContext] Failed to fetch morgue records via Cloud Function:', error);

            // Detect Firebase auth failures so the UI can show a meaningful error
            if (error.code === 'permission-denied' ||
                error.message?.includes('unauthenticated') ||
                error.message?.includes('UNAUTHENTICATED') ||
                error.message?.includes('auth/')) {
                setMorgueRecordsError('auth_failed');
            } else {
                setMorgueRecordsError('fetch_failed');
            }

            return null;
        }
        })().finally(() => { morgueFetchInFlightRef.current = null; setMorgueLoading(false); });
        return morgueFetchInFlightRef.current;
    }, [updateCacheSegment, webhooks, isAuthenticated, user]);

    // Remove a single morgue record from in-memory cache + state (no re-fetch)
    const removeMorgueRecord = useCallback((caseId) => {
        const data = dataCache.current[CACHE_SEGMENTS.MORGUE_RECORDS];
        if (data && data[caseId]) {
            delete data[caseId];
            dataCache.current[CACHE_SEGMENTS.MORGUE_RECORDS] = data;
            const morgueAsList = Object.keys(data).map(key => ({ ...data[key], firebaseKey: key }));
            setMorgueRecords(morgueAsList);
        }
    }, []);

    // Setup Firebase listeners — SINGLE appMetadata onValue (was 5×). P2 drastic: 5 WebSockets → 1
    const setupFirebaseListeners = useCallback(() => {
        Object.values(firebaseListeners.current).forEach(unsubscribe => unsubscribe());
        firebaseListeners.current = {};

        (async () => {
            const metaRef = ref(database, 'appMetadata');
            const formsKey = FORMS_VERSION_KEY.split('/').pop(); // handles staging
            const keys = [formsKey, 'factionsDataVersion', 'selectOptionsDataVersion', 'lsccDataVersion', 'morgueDataVersion'];
            const oldLocals = {
                [formsKey]: localStorage.getItem(FORMS_VERSION_KEY),
                factionsDataVersion: localStorage.getItem('factionsDataVersion'),
                selectOptionsDataVersion: localStorage.getItem('selectOptionsDataVersion'),
                lsccDataVersion: localStorage.getItem('lsccDataVersion'),
                morgueDataVersion: localStorage.getItem('morgueDataVersion'),
            };
            let initialMeta = {};
            try {
                const snap = await get(metaRef);
                if (snap.exists()) {
                    initialMeta = snap.val() || {};
                    // Sync local version trackers from server (first get)
                    for (const k of keys) {
                        if (initialMeta[k] !== undefined) {
                            const storageKey = k === formsKey ? FORMS_VERSION_KEY : k;
                            localStorage.setItem(storageKey, String(initialMeta[k]));
                        } else if (k === formsKey) {
                            // no server key — clear
                            const storageKey = FORMS_VERSION_KEY;
                            // keep old if missing
                        }
                    }
                    console.debug(`[DataContext] Initial appMetadata versions:`, initialMeta);
                }
            } catch (e) {
                console.error('[DataContext] Failed to get initial appMetadata:', e);
            }

            // Offline version changed — refresh those segments immediately (before onValue)
            const offlineToRefresh = [];
            for (const k of keys) {
                const storageKey = k === formsKey ? FORMS_VERSION_KEY : k;
                const oldV = oldLocals[k];
                const newV = initialMeta[k] !== undefined ? String(initialMeta[k]) : null;
                if (oldV !== null && newV !== null && oldV !== newV) {
                    console.log(`🔄 ${k} version changed offline (v${oldV} → v${newV}). Refreshing.`);
                    const segMap = { [formsKey]: CACHE_SEGMENTS.FORMS, factionsDataVersion: CACHE_SEGMENTS.FACTIONS, selectOptionsDataVersion: CACHE_SEGMENTS.SELECT_OPTIONS, lsccDataVersion: CACHE_SEGMENTS.LSCC };
                    const seg = segMap[k];
                    if (seg) {
                        localStorage.removeItem(getCacheKey(resolveFormsPath(seg)));
                        localStorage.removeItem(getTimestampKey(resolveFormsPath(seg)));
                        localStorage.removeItem(getVersionKey(resolveFormsPath(seg)));
                        offlineToRefresh.push(seg);
                    } else if (k === 'morgueDataVersion') {
                        morgueRecordsLoadedRef.current = false;
                    }
                }
            }
            if (offlineToRefresh.length) refreshSegments(offlineToRefresh);

            // Single onValue for all versions
            let firstFire = true;
            firebaseListeners.current.meta = onValue(metaRef, async (snapshot) => {
                if (!dataInitializedRef.current) return;
                const val = snapshot.val() || {};
                const toRefreshImmediate = [];
                const toRefreshDebounced = [];
                const handleVersion = (key, seg, versionKey) => {
                    const serverVersion = val[key] !== undefined ? String(val[key]) : null;
                    const localVersion = localStorage.getItem(versionKey);
                    if (serverVersion !== null && localVersion !== serverVersion) {
                        console.log(`🔄 ${key} mismatch (v${localVersion} → v${serverVersion}).${firstFire ? ' immediate' : ' debounced'}`);
                        localStorage.removeItem(getCacheKey(resolveFormsPath(seg)));
                        localStorage.removeItem(getTimestampKey(resolveFormsPath(seg)));
                        localStorage.removeItem(getVersionKey(resolveFormsPath(seg)));
                        localStorage.setItem(versionKey, serverVersion);
                        (firstFire ? toRefreshImmediate : toRefreshDebounced).push(seg);
                    } else if (serverVersion === null && localVersion !== null) {
                        console.log(`🗑️ ${key} deleted`);
                        localStorage.removeItem(getCacheKey(resolveFormsPath(seg)));
                        localStorage.removeItem(getTimestampKey(resolveFormsPath(seg)));
                        localStorage.removeItem(getVersionKey(resolveFormsPath(seg)));
                        localStorage.removeItem(versionKey);
                        toRefreshDebounced.push(seg);
                    }
                };
                handleVersion(formsKey, CACHE_SEGMENTS.FORMS, FORMS_VERSION_KEY);
                handleVersion('factionsDataVersion', CACHE_SEGMENTS.FACTIONS, 'factionsDataVersion');
                handleVersion('selectOptionsDataVersion', CACHE_SEGMENTS.SELECT_OPTIONS, 'selectOptionsDataVersion');
                handleVersion('lsccDataVersion', CACHE_SEGMENTS.LSCC, 'lsccDataVersion');
                // Morgue: just invalidate, no segment fetch
                const mServer = val['morgueDataVersion'] !== undefined ? String(val['morgueDataVersion']) : null;
                const mLocal = localStorage.getItem('morgueDataVersion');
                if (mServer && mLocal !== mServer) {
                    console.log(`[MORGUE] Version changed: ${mLocal} → ${mServer}. Cache invalidated.`);
                    localStorage.setItem('morgueDataVersion', mServer);
                    morgueRecordsLoadedRef.current = false;
                }

                if (toRefreshImmediate.length) await refreshSegments(toRefreshImmediate);
                else if (toRefreshDebounced.length) await debouncedRefresh(toRefreshDebounced);
                firstFire = false;
            });
        })();
    }, [updateCacheSegment, showNotification, refreshSegments, webhooks, isAuthenticated, user]);



    const loadData = useCallback(async (forceRefresh = false) => {
        setHasFirebaseError(false);

        // Skip data loading for non-authenticated users in production — Firebase rules require auth
        // Localhost bypasses this so devs can test with cached Firebase auth state
        if (!isAuthenticated && window.location.hostname !== 'localhost') {
            console.log('[DataContext] User not authenticated. Skipping data load.');
            setDataLoaded(true);
            setIsLoadingData(false);
            return;
        }

        if (dataLoaded && !forceRefresh) {
            console.log('[DataContext] Data already loaded, skipping redundant load.');
            return;
        }
    
        const segmentsToFetch = [];
        const cachedSegments = {};
        const segmentSizes = {};
        let totalCachedSize = 0;
    
        if (forceRefresh) {
            segmentsToFetch.push(...Object.values(CACHE_SEGMENTS).filter(s => s !== CACHE_SEGMENTS.MORGUE_RECORDS));
            didLoadFromCache.current = false;
        } else {
            Object.values(CACHE_SEGMENTS).forEach(segment => {
                if (EXCLUDED_FROM_CACHE.includes(segment)) return;
                if (segment === CACHE_SEGMENTS.MORGUE_RECORDS) return; // Lazy-loaded on demand

                const cacheSegment = resolveFormsPath(segment); // staging-aware cache isolation
                const cacheKey = getCacheKey(cacheSegment);
                const cachedData = localStorage.getItem(cacheKey);

                if (cachedData && isCacheValid(cacheSegment)) {
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
                const loadingMode = {};
                Object.values(CACHE_SEGMENTS).forEach(s => {
                    if (s === CACHE_SEGMENTS.MORGUE_RECORDS) {
                        loadingMode[s] = 'not_loaded'; // lazy-loaded on demand
                    } else if (cachedSegments[s]) {
                        loadingMode[s] = 'cache';
                    } else {
                        loadingMode[s] = 'not_loaded';
                    }
                });
                webhooks.sendDataRequestLog('DataContext.jsx', true, 'Local Storage', totalCachedSize, 0, isAuthenticated, user?.faction?.characterName || user?.username, Object.keys(cachedSegments), [], segmentSizes, null, {
                    route: window.location.hash || '/',
                    trigger: 'initial',
                    segmentSources: loadingMode
                });
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
            
            const promises = segmentsToFetch.map(segment => get(ref(database, resolveFormsPath(segment))).then(snapshot => ({ segment, snapshot })));
            const results = await Promise.allSettled(promises);
    
            const fetchedData = {};
            let totalNetworkTransferSize = 0;
    
            results.forEach((result, idx) => {
                const segment = segmentsToFetch[idx];
                if (result.status === 'rejected') {
                    console.warn(`Segment "${segment}" failed to fetch (likely permission):`, result.reason?.message || result.reason);
                    return;
                }
                const { snapshot } = result.value;
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
                    const loadingMode = {};
                    Object.values(CACHE_SEGMENTS).forEach(s => {
                        if (s === CACHE_SEGMENTS.MORGUE_RECORDS) {
                            loadingMode[s] = 'not_loaded';
                        } else if (cachedSegments[s]) {
                            loadingMode[s] = 'cache';
                        } else if (fetchedData[s]) {
                            loadingMode[s] = 'network';
                        } else {
                            loadingMode[s] = 'not_loaded';
                        }
                    });
                    webhooks.sendDataRequestLog('DataContext.jsx', didLoadFromCache.current, didLoadFromCache.current ? 'Partial Cache' : 'Firebase', totalCachedSize + totalNetworkTransferSize, totalNetworkTransferSize, isAuthenticated, user?.faction?.characterName || user?.username, Object.keys(cachedSegments).concat(segmentsToFetch), segmentsToFetch.filter(s => !fetchedData[s]), segmentSizes, null, {
                        route: window.location.hash || '/',
                        trigger: 'initial',
                        segmentSources: loadingMode
                    });
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
                const loadingMode = {};
                Object.values(CACHE_SEGMENTS).forEach(s => {
                    if (s === CACHE_SEGMENTS.MORGUE_RECORDS) {
                        loadingMode[s] = 'not_loaded';
                    } else if (cachedSegments[s]) {
                        loadingMode[s] = 'cache';
                    } else if (segmentsToFetch.includes(s)) {
                        loadingMode[s] = 'network';
                    } else {
                        loadingMode[s] = 'not_loaded';
                    }
                });
                webhooks.sendDataRequestLog('DataContext.jsx', didLoadFromCache.current, 'Firebase Error', totalCachedSize, 0, isAuthenticated, user?.faction?.characterName || user?.username, Object.keys(cachedSegments), segmentsToFetch, segmentSizes, error.message || 'Unknown Fetch Error', {
                    route: window.location.hash || '/',
                    trigger: 'initial',
                    segmentSources: loadingMode
                });
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

        // Explicitly remove old morgue cache versions (legacy v1.0 — now uses dynamic version from morgueDataVersion)
        const oldMorgueCacheKeys = [
            'firebaseCache_morgue-records_v1.0',
            'firebaseCache_morgue-records_v1.0_timestamp',
            'firebaseCache_morgue-records_v1.0_version',
        ];
        oldMorgueCacheKeys.forEach(key => {
            if (localStorage.getItem(key) !== null) {
                console.log(`🧹 Explicitly cleaning up old morgue cache key: ${key}`);
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
                            // Only attach real-time listeners if authenticated in production
                            // Localhost bypasses this so devs can test with cached Firebase auth
                            if (isAuthenticated || window.location.hostname === 'localhost') {
                                console.log('[DataContext] Data load complete. Setting up Firebase listeners.');
                                sessionStorage.setItem('dataContextInitialized', 'true');
                                setupFirebaseListeners();
                            } else {
                                console.log('[DataContext] Data load skipped (not authenticated). Firebase listeners not attached.');
                                sessionStorage.setItem('dataContextInitialized', 'true');
                            }
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

        // Retry data loading when auth state changes (e.g. user logs in after initial load failed)
        const prevAuthRef = useRef(isAuthenticated);
        useEffect(() => {
            if (isAuthenticated && !prevAuthRef.current) {
                console.log('[DataContext] Auth state changed to authenticated. Retrying data load...');
                setHasFirebaseError(false);
                dataInitializedRef.current = false;
                setDataLoaded(false);
                setIsLoadingData(true);
                loadData().then(() => {
                    setupFirebaseListeners();
                });
            }
            prevAuthRef.current = isAuthenticated;
        }, [isAuthenticated, loadData, setupFirebaseListeners]);

        const factionListData = useMemo(() => {
            // Single enriched roster for PHMC (faction 364). Roster records store
            // the character id as the record KEY — surface it as `characterId` so
            // id-based identity matching works (badge/SN lookups). The legacy
            // phmcListData/coronerListData split is removed; callers that need the
            // coroner distinction use isCoronerMember().
            if (!factionsData['364'] || typeof factionsData['364'].members !== 'object' || !factionsData['364'].members) {
                    console.debug('[DataContext] factionListData: Faction data empty or malformed');
                return [];
            }

            const allMembers = Object.entries(factionsData['364'].members).map(([charId, member]) => ({
                ...member,
                characterId: member.characterId || charId,
                _rosterKey: charId,
            }));

            // Add verified admins to the list
            const adminMembers = Object.values(verifiedAdmins).map(admin => ({
                characterName: admin.username,
                name: admin.username,
                rank: admin.role || 'Senior Management',
                isElevated: true,
                badge: `ADM-${admin.id}`,
                characterId: admin.id,
            }));

            const combinedMembers = [...allMembers, ...adminMembers];

            return combinedMembers.map(member => ({
                ...member,
                name: member.characterName || member.name || member.displayName || member.username || 'Unknown',
                rank: member.rank || '',
                category: member.rank || '',
            }));
        }, [factionsData, verifiedAdmins]);


    const value = {
        factionsData,
        formsData,
        factionListData: factionListData || [],
        agencyDataStore,
        selectOptions,
isLoadingData,
        morgueLoading,
        refreshSegments,
        updateNow,
        pendingRefreshInfo,
        sendDataRequestLog: webhooks.sendDataRequestLog,
        lsccData,
        morgueRecords,
        morgueRecordsError,
        loadMorgueRecords,
        removeMorgueRecord,
        hasFirebaseError,
    };
            
                return (
                    <DataContext.Provider value={value}>
                        {children}
                    </DataContext.Provider>    );
};