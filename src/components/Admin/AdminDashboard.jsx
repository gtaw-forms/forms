import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Button, Spinner, Alert, Form, Table } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import './AdminDashboard.css';
import { formatAccessLevel } from '../../utils/textUtils';
import GtaWorldLoginButton from '../Auth/GtaWorldLoginButton';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import useFactionPermissions from '../../hooks/useFactionPermissions';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDatabase, ref, get, set } from 'firebase/database';
import { isGoogleAuthenticated, getGoogleUser } from '../../services/gtaWorldAuth';
import { runOAuthDiagnostics, testFirebaseFunctions, testProfileRetrieval, logEnvironmentInfo } from '../../services/firebaseDebug';
import { triggerFetchExternalUrl, triggerWebhookProxy } from '../../services/firebaseFunctions';
import { logAdminAction, getUserContext } from '../../utils/logging';
import LoginSplash from '../Auth/LoginSplash';

// Static imports for managers (removed lazy loading)
import DatabaseEditor from './DatabaseEditor';
import FactionDataUpload from './FactionDataUpload';
import FirebaseFunctionsTester from './FirebaseFunctionsTester';
import EmployeeManager from './EmployeeManager';
import LsccManager from './LsccManager';
import FormsManager from './FormsManager';
import MorgueManager from './MorgueManager';
import CctvViewer from './CctvViewer';

const AdminDashboard = ({

    currentUser,
    Sentry,
    showInAppNotification,
    webhooks,
    newWebhook,
    setNewWebhook,
    handleAddWebhook,
    handleDeleteWebhook,
    isUpdatingWebhooks,
    logRefreshTrigger,
    setLogRefreshTrigger,
}) => {

    const [selectedSection, setSelectedSection] = useState('serviceStatus');
    const [diagnosticsResult, setDiagnosticsResult] = useState(null);
    const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
    const [isMigratingReports, setIsMigratingReports] = useState(false);
    const [isTriggeringReport, setIsTriggeringReport] = useState(false);
    const [isScanningLocations, setIsScanningLocations] = useState(false);
    const [lsccModalActive, setLsccModalActive] = useState(null);
    const [showMigrator, setShowMigrator] = useState(false);
    const [mapEnabled, setMapEnabled] = useState(false);
    const [maintenanceActive, setMaintenanceActive] = useState(false);
    const [maintenanceMessage, setMaintenanceMessage] = useState('');
    const [isSavingMaintenance, setIsSavingMaintenance] = useState(false);
    const [morgueBannerText, setMorgueBannerText] = useState('');
    const [morgueBannerType, setMorgueBannerType] = useState('info');
    const [isSavingMorgueBanner, setIsSavingMorgueBanner] = useState(false);
    const navigate = useNavigate();

    const [externalStatuses, setExternalStatuses] = useState({
        github: { status: 'checking', description: 'Checking...' },
        cloudflare: { status: 'checking', description: 'Checking...' },
        googlecloud: { status: 'checking', description: 'Checking...' },
    });

    useEffect(() => {
        const fetchExternalStatuses = async () => {
            const endpoints = [
                { key: 'github', url: 'https://www.githubstatus.com/api/v2/status.json' },
                { key: 'cloudflare', url: 'https://www.cloudflarestatus.com/api/v2/status.json' },
                { key: 'googlecloud', url: 'https://status.cloud.google.com/incidents.json' },
            ];

            const results = { ...externalStatuses };

            await Promise.all(
                endpoints.map(async ({ key, url }) => {
                    try {
                        const response = await triggerFetchExternalUrl({ url });
                        const data = response.data;
                        
                        if (key === 'googlecloud') {
                            // Google Cloud returns an array of incidents. 
                            // If empty, it's operational. If it has items, it's degraded/outage.
                            const hasIncidents = Array.isArray(data) && data.length > 0;
                            results[key] = {
                                status: hasIncidents ? 'minor' : 'none',
                                description: hasIncidents ? 'Issues Reported' : 'Operational',
                            };
                        } else {
                            const indicator = data.status?.indicator;
                            results[key] = {
                                status: indicator || 'unknown',
                                description: data.status?.description || 'Unknown',
                            };
                        }
                    } catch (error) {
                        console.error(`Failed to fetch ${key} status:`, error);
                        results[key] = { status: 'unknown', description: 'Unable to reach' };
                    }
                })
            );

            setExternalStatuses(results);
        };

        fetchExternalStatuses();
        const interval = setInterval(fetchExternalStatuses, 60000);
        return () => clearInterval(interval);
    }, []);

    const getStatusIndicator = (status) => {
        switch (status) {
            case 'none':
                return { className: 'online', label: 'Operational' };
            case 'minor':
                return { className: 'degraded', label: 'Degraded' };
            case 'major':
            case 'critical':
                return { className: 'offline', label: 'Outage' };
            default:
                return { className: 'unknown', label: 'Unknown' };
        }
    };

    // State for PHMC Auth State upload
    const [phmcAuthStateInput, setPhmcAuthStateInput] = useState('');
    const [isUploadingPhmcAuthState, setIsUploadingPhmcAuthState] = useState(false);

    useEffect(() => {
        const fetchMapStatus = async () => {
            const dbRef = ref(getDatabase(), '/map/settings/enabled');
            const snapshot = await get(dbRef);
            if (snapshot.exists()) {
                setMapEnabled(snapshot.val());
            }
        };
        fetchMapStatus();

        // Load current maintenance state
        const loadMaintenance = async () => {
            const dbRef = ref(getDatabase(), 'appMetadata/maintenance');
            const snapshot = await get(dbRef);
            if (snapshot.exists()) {
                const data = snapshot.val();
                setMaintenanceActive(!!data.active);
                setMaintenanceMessage(data.message || '');
            }
        };
        loadMaintenance();
    }, []);

    const handleToggleMap = async () => {
        const newStatus = !mapEnabled;
        try {
            const dbRef = ref(getDatabase(), '/map/settings/enabled');
            await set(dbRef, newStatus);
            setMapEnabled(newStatus);
            showInAppNotification(`Map feature has been ${newStatus ? 'enabled' : 'disabled'}.`, 'success');
        } catch (error) {
            showInAppNotification('Failed to update map status.', 'error');
        }
    };

    const handleScanLocations = async () => {
        setIsScanningLocations(true);
        showInAppNotification && showInAppNotification("Scanning reports for unknown locations...", "info");
        try {
            const functions = getFunctions();
            const scanFunc = httpsCallable(functions, 'scanUntrackedLocations');
            const result = await scanFunc();
            showInAppNotification && showInAppNotification(result.data.message, result.data.success ? "success" : "error");
        } catch (error) {
            showInAppNotification && showInAppNotification("Error scanning locations.", "error");
        } finally {
            setIsScanningLocations(false);
        }
    };
    
    // Use the unified GTA World auth hook
    const { 
        user: gtaWorldUser, 
        isAuthenticated: isGtaAuthenticated, 
        error: gtaAuthError,
        isLoading: gtaAuthLoading 
    } = useGtaWorldAuth();
    
    // Use faction permissions hook
    const {
        isMember: isFactionMember,
        factionData,
        accessLevel,
        permissions,
        canAccessAdmin,
        canUploadFactionData,
        canAccessDatabase,
        canManageWebhooks,
        refresh: refreshFactionData,
        isLoading: factionLoading
    } = useFactionPermissions();
    
    // Check for Google authentication override
    const isGoogleAdmin = isGoogleAuthenticated();
    const googleUser = getGoogleUser();
    
    // Google Admin toggle for testing
    const [googleAdminToggle, setGoogleAdminToggle] = useState(false);
    const isGoogleAdminActive = (isGoogleAdmin || googleAdminToggle) && currentUser;
    
    // Permission helper functions based on ranks and auth type
    const isEmailSignin = currentUser && !currentUser.isGtaAuth && !currentUser.isGoogleAuth;
    const scriptRank = gtaWorldUser?.faction?.scriptRank;
    const isSuperAdminAccess = accessLevel === 'superadmin' || permissions.includes('superadmin_access');

    // Simplified: Rank 11+ sees everything. Rank Permissions stays hardcoded at 15+.
    const isRank11OrHigher = scriptRank >= 11;
    const isRank15OrHigher = scriptRank >= 15;
    const hasAdminPageAccess = isGoogleAdminActive || isSuperAdminAccess || isRank11OrHigher;
    const hasRankPermissionsAccess = isGoogleAdminActive || isSuperAdminAccess || isRank15OrHigher;

    const canUseGoogleAdminOverride = isEmailSignin;

    // -----------------------------------------------------------------------
    // Rank check helpers for admin action logging
    // -----------------------------------------------------------------------
    const getAccessForSection = (section) => {
        switch (section) {
            case 'employeeManager': return hasAdminPageAccess;
            case 'lscc': return hasAdminPageAccess;
            case 'forms': return hasAdminPageAccess;
            case 'factions': return hasAdminPageAccess;
            case 'database': return hasAdminPageAccess;
            case 'morgue': return hasAdminPageAccess;
            case 'cctv': return hasAdminPageAccess;
            case 'dev': return hasAdminPageAccess;
            default: return true;
        }
    };

    const getRequiredRank = (section) => {
        switch (section) {
            case 'employeeManager': return 13;
            case 'lscc': return 10;
            case 'forms': return 10;
            case 'factions': return 10;
            case 'database': return 12;
            case 'morgue': return 12;
            case 'cctv': return 11;
            case 'dev': return 11;
            default: return null;
        }
    };

    const handleRunDiagnostics = async () => {
        setIsRunningDiagnostics(true);
        try {
            logEnvironmentInfo();
            const result = await runOAuthDiagnostics();
            setDiagnosticsResult(result);
        } catch (error) {
            console.error('Diagnostics failed:', error);
            setDiagnosticsResult({
                error: 'Failed to run diagnostics',
                details: error.message
            });
        } finally {
            setIsRunningDiagnostics(false);
        }
    };

    const handleTestFirebase = async () => {
        try {
            const result = await testFirebaseFunctions();
            showInAppNotification && showInAppNotification(
                result.success ? 'Firebase Functions test passed' : `Test failed: ${result.error}`,
                result.success ? 'success' : 'error'
            );
            console.info('Firebase test result:', result);
        } catch (error) {
            showInAppNotification && showInAppNotification(`Test error: ${error.message}`, 'error');
        }
    };

    const handleTestProfile = async () => {
        try {
            const result = await testProfileRetrieval();
            showInAppNotification && showInAppNotification(
                result.success ? 'Profile retrieval successful - check console for raw data' : `Profile test failed: ${result.error}`,
                result.success ? 'success' : 'error'
            );
            console.info('Profile test result:', result);
            if (result.success && result.rawProfileData) {
                console.group('🔍 RAW PROFILE DATA');
                console.log('Full API Response:', result.rawProfileData);
                console.log('Data Structure:', result.dataStructure);
                console.groupEnd();
            }
        } catch (error) {
            showInAppNotification && showInAppNotification(`Profile test error: ${error.message}`, 'error');
        }
    };

    const handleTestWebhook = async (webhook) => {
        try {
            const payload = {
                embeds: [{
                    title: "🧪 Webhook Test",
                    description: `This is a test message for the webhook: **${webhook.name}**\n\nWebhook Type: ${webhook.type}\nTest Time: ${new Date().toLocaleString()}`,
                    color: 0x00FF00,
                    timestamp: new Date().toISOString(),
                    footer: {
                        text: 'PHMC Form Generator - Admin Panel Test'
                    }
                }]
            };

            await triggerWebhookProxy('test', payload, webhook.id);
            showInAppNotification && showInAppNotification(`Test webhook sent successfully to ${webhook.name}!`, 'success');
        } catch (error) {
            console.error('Error sending test webhook:', error);
            showInAppNotification && showInAppNotification('Error sending test webhook', 'error');
        }
    };

    const handleMigrateReports = async () => {
        if (!window.confirm("Are you sure you want to run the report migration? This operation cannot be undone.")) {
            return;
        }

        setIsMigratingReports(true);
        showInAppNotification && showInAppNotification('Starting report migration...', 'info');

        try {
            const functions = getFunctions();
            const migrateReports = httpsCallable(functions, 'migrateReportsToNewStructure');
            const result = await migrateReports();

            if (result.data.success) {
                showInAppNotification && showInAppNotification(
                    `Migration complete: ${result.data.migratedCount} reports migrated.`,
                    'success'
                );
                console.log('Migration result:', result.data);
            } else {
                showInAppNotification && showInAppNotification(
                    `Migration failed: ${result.data.message || 'Unknown error'}`,
                    'error'
                );
                console.error('Migration failed:', result.data);
            }
        } catch (error) {
            console.error('Error calling migrateReportsToNewStructure:', error);
            showInAppNotification && showInAppNotification(
                `Error during migration: ${error.message}`,
                'error'
            );
            Sentry.captureException(error, { extra: { context: 'handleMigrateReports' } });
        } finally {
            setIsMigratingReports(false);
        }
    };

    const handleTriggerCoronerReport = async (type) => {
        if (!window.confirm(`Are you sure you want to force trigger a ${type} coroner report? This will send a webhook to the admin channel.`)) {
            return;
        }

        setIsTriggeringReport(true);
        showInAppNotification && showInAppNotification(`Triggering ${type} report...`, 'info');

        try {
            const functions = getFunctions();
            const triggerReport = httpsCallable(functions, 'triggerCoronerReport');
            const result = await triggerReport({ type });

            if (result.data.success) {
                showInAppNotification && showInAppNotification(
                    result.data.message || 'Report triggered successfully.',
                    'success'
                );
            } else {
                showInAppNotification && showInAppNotification(
                    `Trigger failed: ${result.data.message || 'Unknown error'}`,
                    'error'
                );
            }
        } catch (error) {
            console.error('Error triggering coroner report:', error);
            showInAppNotification && showInAppNotification(
                `Error: ${error.message}`,
                'error'
            );
        } finally {
            setIsTriggeringReport(false);
        }
    };

    const handleUploadPhmcAuthState = async () => {
        if (!phmcAuthStateInput) {
            showInAppNotification('Please paste the PHMC Auth State JSON.', 'warning');
            return;
        }

        setIsUploadingPhmcAuthState(true);
        try {
            const storageState = JSON.parse(phmcAuthStateInput);
            if (!storageState || !storageState.cookies) {
                throw new Error('Invalid Playwright storageState JSON. Missing "cookies" array.');
            }

            const functions = getFunctions();
            const uploadAuthState = httpsCallable(functions, 'updateAuthState'); // Use the generic updateAuthState
            
            const result = await uploadAuthState({ 
                path: '/phmc/auth_state', // The target path for PHMC forum auth state
                storageState: storageState 
            });

            if (result.data.success) {
                showInAppNotification('PHMC Auth State uploaded successfully!', 'success');
                setPhmcAuthStateInput(''); // Clear input on success
            } else {
                showInAppNotification(`Failed to upload PHMC Auth State: ${result.data.message || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Error uploading PHMC Auth State:', error);
            showInAppNotification(`Error uploading PHMC Auth State: ${error.message}`, 'error');
        } finally {
            setIsUploadingPhmcAuthState(false);
        }
    };


    const handleSaveMaintenance = async () => {
        setIsSavingMaintenance(true);
        try {
            const dbRef = ref(getDatabase(), 'appMetadata/maintenance');
            await set(dbRef, {
                active: maintenanceActive,
                message: maintenanceMessage.trim(),
                updatedAt: Date.now(),
                updatedBy: currentUser?.email || 'unknown',
            });
            showInAppNotification(
                maintenanceActive ? '🔧 Maintenance mode enabled.' : '✅ Maintenance mode disabled.',
                'success'
            );
        } catch (error) {
            showInAppNotification('Failed to save maintenance settings.', 'error');
        } finally {
            setIsSavingMaintenance(false);
        }
    };

    // Load current morgue banner on mount
    useEffect(() => {
        const dbRef = ref(getDatabase(), 'appMetadata/morgueBanner');
        get(dbRef).then((snap) => {
            if (snap.exists()) {
                const val = snap.val();
                setMorgueBannerText(val.text || '');
                setMorgueBannerType(val.type || 'info');
            }
        }).catch(() => {});
    }, []);

    const handleSaveMorgueBanner = async () => {
        setIsSavingMorgueBanner(true);
        try {
            const dbRef = ref(getDatabase(), 'appMetadata/morgueBanner');
            await set(dbRef, {
                text: morgueBannerText.trim(),
                type: morgueBannerType,
                updatedAt: Date.now(),
            });
            showInAppNotification('Morgue banner updated.', 'success');
        } catch (error) {
            showInAppNotification('Failed to save morgue banner.', 'error');
        } finally {
            setIsSavingMorgueBanner(false);
        }
    };

    const handleClearMorgueBanner = async () => {
        try {
            const dbRef = ref(getDatabase(), 'appMetadata/morgueBanner');
            await set(dbRef, null);
            setMorgueBannerText('');
            setMorgueBannerType('info');
            showInAppNotification('Morgue banner cleared.', 'success');
        } catch (error) {
            showInAppNotification('Failed to clear morgue banner.', 'error');
        }
    };

    const handleSectionChange = (sectionName, sectionLabel) => {
        setSelectedSection(sectionName);
        const { userAgent, timeZone } = getUserContext();

        const requiredRank = getRequiredRank(sectionName);
        const granted = getAccessForSection(sectionName);
        const rankCheckStr = requiredRank != null
            ? `\nRank Check: ${scriptRank ?? 'N/A'} - Required: ${requiredRank} - ${granted ? 'GRANTED' : 'DENIED'}`
            : '';

        logAdminAction(
            currentUser?.email || 'Unknown Admin',
            `Navigated to ${sectionLabel}`,
            `Section: ${sectionName}${rankCheckStr}`,
            'Navigation',
            userAgent,
            timeZone,
            gtaWorldUser?.username,
            gtaWorldUser ? { faction: gtaWorldUser.faction || null } : null
        ).catch(() => {});
    };

    const isLocalhost = window.location.hostname === 'localhost';
    if (!currentUser && !isLocalhost) {
        return <LoginSplash />;
    }

    return (
        <div className="app">
                <div className="sidebar">
                    <div className="sidebar-head">
                        <div className="brand">
                            <div className="brand-mark">AD</div>
                            <div className="brand-text">
                                <div className="t1">Admin Panel</div>
                                <div className="t2">{currentUser?.displayName || currentUser?.email || 'Unknown'}</div>
                            </div>
                        </div>
                    </div>

                    <div className="form-tree">
                        <div className="cat-head" style={{ cursor: 'default' }}><span>Management</span></div>
                        <div className={`form-item ${selectedSection === 'employeeManager' ? 'active' : ''}`} onClick={() => handleSectionChange('employeeManager', 'Employee Metrics')}>
                            <span className="dot" />Employee Metrics
                        </div>
                        <div className={`form-item ${selectedSection === 'forms' ? 'active' : ''}`} onClick={() => handleSectionChange('forms', 'Form Manager')}>
                            <span className="dot" />Form Manager
                        </div>
                        <div className={`form-item ${selectedSection === 'lscc' ? 'active' : ''}`} onClick={() => handleSectionChange('lscc', 'LSCC Protocols')}>
                            <span className="dot" />LSCC Protocols
                        </div>

                        <div className="cat-head" style={{ cursor: 'default', marginTop: 12 }}><span>Data & Records</span></div>
                        <div className={`form-item ${selectedSection === 'factions' ? 'active' : ''}`} onClick={() => handleSectionChange('factions', 'Faction Data')}>
                            <span className="dot" />Faction Data
                        </div>
                        <div className={`form-item ${selectedSection === 'database' ? 'active' : ''}`} onClick={() => handleSectionChange('database', 'Database Editor')}>
                            <span className="dot" />Database Editor
                        </div>
                        <div className={`form-item ${selectedSection === 'morgue' ? 'active' : ''}`} onClick={() => handleSectionChange('morgue', 'Morgue Records')}>
                            <span className="dot" />Morgue Records
                        </div>

                        <div className="cat-head" style={{ cursor: 'default', marginTop: 12 }}><span>System</span></div>
                        <div className={`form-item ${selectedSection === 'cctv' ? 'active' : ''}`} onClick={() => handleSectionChange('cctv', 'CCTV')}>
                            <span className="dot" />CCTV
                        </div>
                        <div className={`form-item ${selectedSection === 'maintenance' ? 'active' : ''}`} onClick={() => handleSectionChange('maintenance', 'System Maintenance')}>
                            <span className="dot" />System Maintenance
                        </div>
                        <div className={`form-item ${selectedSection === 'dev' ? 'active' : ''}`} onClick={() => handleSectionChange('dev', 'Developer Console')}>
                            <span className="dot" />Developer Console
                        </div>
                    </div>
                </div>

                <div className="main-content" style={{ flex: 1, overflow: 'auto', padding: 22, border: 'none', borderRadius: 0 }}>
                    {/* Welcome Page / System Status */}
                    {selectedSection === 'serviceStatus' && (
                        <div className="welcome-hero">
                            <div className="welcome-hero-content">
                                <h1>Welcome back, {gtaWorldUser?.username || currentUser?.displayName || 'Admin'}</h1>
                                <p className="lead text-muted mb-4">System Dashboard</p>
                                
                                <div className="row g-4">
                                    {isGtaAuthenticated && isFactionMember && factionData && (
                                        <div className="col-md-6">
                                            <div className="card h-100 bg-opacity-10 border-indigo">
                                                <div className="card-header py-2 bg-transparent border-0">
                                                    <i className="fas fa-user-shield me-2 text-indigo"></i> Profile Identity
                                                </div>
                                                <div className="card-body py-2">
                                                    <div className="d-flex justify-content-between mb-1 small">
                                                        <span className="text-muted">Character:</span>
                                                        <strong>{factionData.characterName}</strong>
                                                    </div>
                                                    <div className="d-flex justify-content-between mb-1 small">
                                                        <span className="text-muted">Rank:</span>
                                                        <span>{factionData.rank}</span>
                                                    </div>
                                                    <div className="d-flex justify-content-between mb-1 small">
                                                        <span className="text-muted">Access:</span>
                                                        <span className="badge bg-success">{formatAccessLevel(accessLevel)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="col-md-6">
                                        <div className="card h-100 bg-opacity-10 border-info">
                                            <div className="card-header py-2 bg-transparent border-0">
                                                <i className="fas fa-microchip me-2 text-info"></i> System Health
                                            </div>
                                            <div className="card-body py-2">
                                                <div className="d-flex align-items-center gap-2 mb-2">
                                                    <div className="status-indicator online"></div>
                                                    <span className="small text-light">Firebase Realtime DB: Connected</span>
                                                </div>
                                                {Object.entries(externalStatuses).map(([key, service]) => {
                                                    const indicator = getStatusIndicator(service.status);
                                                    return (
                                                        <div key={key} className="d-flex align-items-center gap-2 mb-2">
                                                            <div className={`status-indicator ${indicator.className}`}></div>
                                                            <span className="small text-light">{key === 'googlecloud' ? 'Google Cloud' : key.charAt(0).toUpperCase() + key.slice(1)}: {service.description}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Section Rendering */}
                    <div className="section-content-wrapper">
                        {selectedSection === 'employeeManager' && (
                            hasAdminPageAccess ? <EmployeeManager /> : <div className="admin-section"><div className="alert alert-danger border-0 bg-opacity-25 shadow-sm p-4">Access Denied</div></div>
                        )}

                        {selectedSection === 'lscc' && (
                            hasAdminPageAccess ? <div className="dark"><LsccManager /></div> : <div className="admin-section"><div className="alert alert-danger border-0 bg-opacity-25 shadow-sm p-4">Access Denied</div></div>
                        )}

                        {selectedSection === 'forms' && (
                            hasAdminPageAccess ? <FormsManager currentUser={currentUser} /> : <div className="admin-section"><div className="alert alert-danger border-0 bg-opacity-25 shadow-sm p-4">Access Denied</div></div>
                        )}


                        {selectedSection === 'dev' && (
                            hasAdminPageAccess ? <div className="admin-section"><FirebaseFunctionsTester showInAppNotification={showInAppNotification} /></div> : <div className="admin-section"><div className="alert alert-danger border-0 bg-opacity-25 shadow-sm p-4">Access Denied</div></div>
                        )}

                        {selectedSection === 'factions' && (
                            hasAdminPageAccess ? <FactionDataUpload showNotification={showInAppNotification} /> : <div className="admin-section"><div className="alert alert-warning border-0 bg-opacity-25 shadow-sm p-4">Denied</div></div>
                        )}

                        {selectedSection === 'database' && (
                            hasAdminPageAccess ? <DatabaseEditor showNotification={showInAppNotification} currentUser={currentUser} gtawUser={gtaWorldUser} /> : <div className="admin-section"><div className="alert alert-warning border-0 bg-opacity-25 shadow-sm p-4">Denied</div></div>
                        )}

                        {selectedSection === 'morgue' && (
                            hasAdminPageAccess ? <MorgueManager showNotification={showInAppNotification} /> : <div className="admin-section"><div className="alert alert-warning border-0 bg-opacity-25 shadow-sm p-4">Denied</div></div>
                        )}

                        {selectedSection === 'cctv' && (
                            hasAdminPageAccess ? <CctvViewer showInAppNotification={showInAppNotification} /> : <div className="admin-section"><div className="alert alert-danger border-0 bg-opacity-25 shadow-sm p-4">Access Denied</div></div>
                        )}

                        {selectedSection === 'maintenance' && (
                            hasAdminPageAccess ? (
                                <div className="admin-section">
                                    <div className="d-flex justify-content-between align-items-center mb-4">
                                        <h2 className="mb-0 fw-800"><i className="fas fa-wrench me-3 text-warning"></i>System Maintenance</h2>
                                    </div>
                                    <div className="card border-0 shadow-sm">
                                        <div className="card-body p-4">
                                            <div className="form-check form-switch mb-4">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    role="switch"
                                                    id="maintenanceToggle"
                                                    checked={maintenanceActive}
                                                    onChange={(e) => setMaintenanceActive(e.target.checked)}
                                                    style={{ transform: 'scale(1.5)', marginRight: '12px', cursor: 'pointer' }}
                                                />
                                                <label className="form-check-label fw-bold" htmlFor="maintenanceToggle" style={{ fontSize: '1.1rem' }}>
                                                    {maintenanceActive ? '🔧 Maintenance Mode Active' : '✅ Maintenance Mode Off'}
                                                </label>
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label fw-bold">Maintenance Message</label>
                                                <textarea
                                                    className="form-control bg-dark border-secondary text-white"
                                                    rows={4}
                                                    placeholder="Enter the message users will see..."
                                                    value={maintenanceMessage}
                                                    onChange={(e) => setMaintenanceMessage(e.target.value)}
                                                />
                                                <div className="form-text text-muted mt-1">
                                                    This message will be shown as a banner at the top of the app for all users.
                                                </div>
                                            </div>

                                            <button
                                                className="btn btn-warning fw-bold px-4 py-2"
                                                onClick={handleSaveMaintenance}
                                                disabled={isSavingMaintenance}
                                            >
                                                {isSavingMaintenance ? (
                                                    <><Spinner animation="border" size="sm" className="me-2" />Saving...</>
                                                ) : (
                                                    <><i className="fas fa-save me-2"></i>Save Settings</>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <hr className="my-4 border-secondary" />

                                    <div className="admin-section-title"><i className="fas fa-bullhorn me-2" />Morgue Banner</div>
                                    <p className="text-muted" style={{ fontSize: '0.9rem' }}>
                                        Set a banner message shown at the top of the Morgue Records page (e.g. absence notices).
                                    </p>
                                    <div className="mb-3">
                                        <label className="form-label fw-bold">Banner Message</label>
                                        <textarea
                                            className="form-control bg-dark border-secondary text-white"
                                            rows={3}
                                            placeholder="e.g. Morgue records may be delayed — on leave until Aug 5th."
                                            value={morgueBannerText}
                                            onChange={(e) => setMorgueBannerText(e.target.value)}
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label fw-bold me-3">Banner Type</label>
                                        <select
                                            className="form-select bg-dark border-secondary text-white d-inline-block w-auto"
                                            value={morgueBannerType}
                                            onChange={(e) => setMorgueBannerType(e.target.value)}
                                        >
                                            <option value="info">Info</option>
                                            <option value="warning">Warning</option>
                                        </select>
                                    </div>
                                    <div className="d-flex gap-2">
                                        <button
                                            className="btn btn-warning fw-bold px-4 py-2"
                                            onClick={handleSaveMorgueBanner}
                                            disabled={isSavingMorgueBanner}
                                        >
                                            {isSavingMorgueBanner ? (
                                                <><Spinner animation="border" size="sm" className="me-2" />Saving...</>
                                            ) : (
                                                <><i className="fas fa-save me-2"></i>Save Banner</>
                                            )}
                                        </button>
                                        <button
                                            className="btn btn-outline-danger fw-bold px-4 py-2"
                                            onClick={handleClearMorgueBanner}
                                        >
                                            <i className="fas fa-times me-2"></i>Clear Banner
                                        </button>
                                    </div>
                                </div>
                            ) : <div className="admin-section"><div className="alert alert-danger border-0 bg-opacity-25 shadow-sm p-4">Access Denied</div></div>
                        )}
                    </div>
                </div>
        </div>
    );
};

export default AdminDashboard;
