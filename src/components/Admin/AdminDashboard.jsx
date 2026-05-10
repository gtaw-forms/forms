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
import { triggerFetchExternalUrl } from '../../services/firebaseFunctions';
import { WebhookProvider } from '../../contexts/WebhookProvider';

// Static imports for managers (removed lazy loading)
import DatabaseEditor from './DatabaseEditor';
import FactionDataUpload from './FactionDataUpload';
import WebhookManager from './WebhookManager';
import FirebaseFunctionsTester from './FirebaseFunctionsTester';
import EmployeeManager from './EmployeeManager';
import LsccManager from './LsccManager';
import FormsManager from './FormsManager';
import MetricsDashboard from './MetricsDashboard';
import AgencyIncidentManager from './AgencyIncidentManager';
import MorgueManager from './MorgueManager';

const AdminDashboard = ({

    currentUser,
    isUpdatingDb,
    selectedAdminBingoType,
    setSelectedAdminBingoType,
    BINGO_TYPES,
    handleManualResetAllBingoCards,
    handleGenerateNewBingoCard,
    handleClearBingoActivity,
    handleDisableBingoCard,
    setShowEditBingoPhrasesModal,
    selectedTypeForEdit,
    setShowReviewPhrasesModal,
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
    const [showMigrator, setShowMigrator] = useState(false);
    const [mapEnabled, setMapEnabled] = useState(false);
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

    const isRank13OrHigher = scriptRank >= 13;
    const isRank14OrHigher = scriptRank >= 14;
    const isRank15OrHigher = scriptRank >= 15;
    const isRank11OrHigher = scriptRank >= 11;
    const hasLsccManagerAccess = isGoogleAdminActive || isSuperAdminAccess || scriptRank >= 10;
    const hasFormsManagerAccess = isGoogleAdminActive || isSuperAdminAccess || scriptRank >= 10;

    // Determine access levels for specific sections
    const hasServiceStatusAccess = isGoogleAdminActive || isSuperAdminAccess || isRank14OrHigher;
    const hasBingoAccess = isGoogleAdminActive || isSuperAdminAccess || isRank14OrHigher;
    const hasUsersAccess = isGoogleAdminActive || isSuperAdminAccess || isRank14OrHigher;
    const hasRankPermissionsAccess = isGoogleAdminActive || isSuperAdminAccess || isRank15OrHigher;
    const hasEmployeeManagerAccess = isGoogleAdminActive || isSuperAdminAccess || isRank13OrHigher;
    
    // Agency Incident Access: Rank 14+ OR Special Coroner Ranks
    const currentRankName = factionData?.rank || gtaWorldUser?.faction?.rank || '';
    const isSpecialCoronerRank = currentRankName.includes("Deputy Chief Medical-Examiner Coroner -") || 
                                currentRankName.includes("Chief Medical-Examiner Coroner -");
    
    const hasAgencyIncidentAccess = isGoogleAdminActive || isSuperAdminAccess || isRank14OrHigher || isSpecialCoronerRank;
    
    const canUseGoogleAdminOverride = isEmailSignin; // Only available for email signin
    
    // Override permissions for Google-authenticated users
    const hasAdminAccess = isGoogleAdminActive || isSuperAdminAccess || canAccessAdmin;
    const hasFactionUpload = isGoogleAdminActive || isSuperAdminAccess || canUploadFactionData || (scriptRank >= 10); // Direct rank check for faction upload
    const hasDatabaseAccess = isGoogleAdminActive || isSuperAdminAccess || canAccessDatabase || (scriptRank >= 12); // Direct rank check for database
    const hasWebhookAccess = isGoogleAdminActive || isSuperAdminAccess || canManageWebhooks || isRank11OrHigher; // Direct rank check for webhook management

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
                username: "PHMC Test",
                avatar_url: 'https://i.ibb.co/0pgw9hHm/phmc.png',
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

            const response = await fetch(webhook.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showInAppNotification && showInAppNotification(`Test webhook sent successfully to ${webhook.name}!`, 'success');
            } else {
                showInAppNotification && showInAppNotification(`Failed to send test webhook: ${response.status}`, 'error');
            }
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


    return (
        <div className="admin-dashboard-container">
            <div className="admin-dashboard-layout">
                {/* Modern Admin Sidebar */}
                <aside className="admin-sidebar">
                    <div className="sidebar-header">
                        <h5><i className="fas fa-shield-alt"></i> <span>Admin Panel</span></h5>
                        <div className="sidebar-user-info">
                            <p><strong>{currentUser?.displayName || currentUser?.email || 'Unknown User'}</strong></p>
                            {gtaWorldUser && (
                                <p className="text-info"><i className="fas fa-user me-1"></i> {gtaWorldUser.username}</p>
                            )}
                        </div>
                        
                        {currentUser && canUseGoogleAdminOverride && (
                            <div className="mt-3 px-1">
                                <div className="form-check form-switch small">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        role="switch"
                                        id="googleAdminToggle"
                                        checked={googleAdminToggle}
                                        onChange={(e) => setGoogleAdminToggle(e.target.checked)}
                                    />
                                    <label className="form-check-label text-muted" htmlFor="googleAdminToggle">
                                        Admin Override
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>

                    <nav className="sidebar-nav">
                        {hasBingoAccess && (
                            <button className={`nav-item-btn ${selectedSection === 'bingo' ? 'active' : ''}`} onClick={() => setSelectedSection('bingo')}>
                                <i className="fas fa-dice"></i> <span>Bingo Manager</span>
                            </button>
                        )}
                        {hasUsersAccess && (
                            <button className={`nav-item-btn ${selectedSection === 'metrics' ? 'active' : ''}`} onClick={() => setSelectedSection('metrics')}>
                                <i className="fas fa-chart-line"></i> <span>User Metrics</span>
                            </button>
                        )}
                        {hasAgencyIncidentAccess && (
                            <button className={`nav-item-btn ${selectedSection === 'agencyIncidents' ? 'active' : ''}`} onClick={() => setSelectedSection('agencyIncidents')}>
                                <i className="fas fa-shield-alt text-danger"></i> <span>Agency Incidents</span>
                            </button>
                        )}
                        {hasEmployeeManagerAccess && (
                            <button className={`nav-item-btn ${selectedSection === 'employeeManager' ? 'active' : ''}`} onClick={() => setSelectedSection('employeeManager')}>
                                <i className="fas fa-users-cog"></i> <span>Employee Metrics</span>
                            </button>
                        )}
                        {hasLsccManagerAccess && (
                            <button className={`nav-item-btn ${selectedSection === 'lscc' ? 'active' : ''}`} onClick={() => setSelectedSection('lscc')}>
                                <i className="fas fa-hospital-alt"></i> <span>LSCC Protocols</span>
                            </button>
                        )}
                        {hasFormsManagerAccess && (
                            <button className={`nav-item-btn ${selectedSection === 'forms' ? 'active' : ''}`} onClick={() => setSelectedSection('forms')}>
                                <i className="fas fa-file-signature"></i> <span>Form Manager</span>
                            </button>
                        )}
                        <button className={`nav-item-btn ${selectedSection === 'webhooks' ? 'active' : ''}`} onClick={() => setSelectedSection('webhooks')}>
                            <i className="fas fa-bullhorn"></i> <span>Webhooks</span>
                        </button>
                        <button className={`nav-item-btn ${selectedSection === 'factions' ? 'active' : ''}`} onClick={() => setSelectedSection('factions')}>
                            <i className="fas fa-users"></i> <span>Faction Data</span>
                        </button>
                        <button className={`nav-item-btn ${selectedSection === 'database' ? 'active' : ''}`} onClick={() => setSelectedSection('database')}>
                            <i className="fas fa-database"></i> <span>Database Editor</span>
                        </button>
                        <button className={`nav-item-btn ${selectedSection === 'morgue' ? 'active' : ''}`} onClick={() => setSelectedSection('morgue')}>
                            <i className="fas fa-microscope"></i> <span>Morgue Records</span>
                        </button>
                        <button className={`nav-item-btn ${selectedSection === 'dev' ? 'active' : ''}`} onClick={() => setSelectedSection('dev')}>
                            <i className="fas fa-terminal"></i> <span>Developer Console</span>
                        </button>
                    </nav>
                </aside>

                <main className="admin-main-content">
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
                        {selectedSection === 'bingo' && (
                            hasBingoAccess ? (
                                <div className="admin-section">
                                    <div className="d-flex justify-content-between align-items-center mb-5">
                                        <h2 className="mb-0 fw-800"><i className="fas fa-dice me-3 text-warning"></i>Bingo Management</h2>
                                    </div>
                                    <div className="card border-0 shadow-lg">
                                        <div className="card-body p-4">
                                            <div className="row mb-4">
                                                <div className="col-md-6">
                                                    <label className="form-label text-muted small uppercase fw-bold mb-2">Select Active Category</label>
                                                    <select
                                                        value={selectedAdminBingoType}
                                                        onChange={(e) => setSelectedAdminBingoType(e.target.value)}
                                                        disabled={isUpdatingDb}
                                                        className="form-select bg-dark border-secondary text-white"
                                                    >
                                                        {BINGO_TYPES.map(type => (
                                                            <option key={type.id} value={type.id}>{type.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="col-md-6 d-flex align-items-end">
                                                    <p className="text-info small mb-2 italic">
                                                        <i className="fas fa-info-circle me-1"></i>
                                                        Server handles daily resets automatically at 09:00 UTC.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="d-flex flex-wrap gap-2">
                                                <Button variant="secondary" onClick={handleManualResetAllBingoCards} disabled={isUpdatingDb} className="admin-btn">
                                                    {isUpdatingDb ? <Spinner animation="border" size="sm" /> : <><i className="fas fa-bomb me-2"></i>Reset All Cards</>}
                                                </Button>
                                                <Button variant="primary" onClick={handleGenerateNewBingoCard} disabled={isUpdatingDb} className="admin-btn">
                                                    {isUpdatingDb ? <Spinner animation="border" size="sm" /> : <><i className="fas fa-sync-alt me-2"></i>Generate New Card</>}
                                                </Button>
                                                <Button variant="danger" onClick={handleClearBingoActivity} disabled={isUpdatingDb} className="admin-btn">
                                                    {isUpdatingDb ? <Spinner animation="border" size="sm" /> : <><i className="fas fa-trash-alt me-2"></i>Clear Activity Log</>}
                                                </Button>
                                                <Button variant="warning" onClick={handleDisableBingoCard} disabled={isUpdatingDb} className="admin-btn">
                                                    {isUpdatingDb ? <Spinner animation="border" size="sm" /> : <><i className="fas fa-power-off me-2"></i>Disable Card</>}
                                                </Button>
                                                <Button variant="info" onClick={() => setShowEditBingoPhrasesModal(true)} disabled={isUpdatingDb || !selectedAdminBingoType} className="admin-btn text-white">
                                                    <i className="fas fa-edit me-2"></i>Edit {selectedTypeForEdit?.name || 'Master'} Phrases
                                                </Button>
                                                <Button variant="outline-warning" onClick={() => setShowReviewPhrasesModal(true)} disabled={isUpdatingDb} className="admin-btn">
                                                    <i className="fas fa-inbox me-2"></i>Review Requests
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="admin-section">
                                    <div className="alert alert-danger border-0 bg-opacity-25 shadow-sm p-4">
                                        <div className="d-flex gap-3 align-items-center">
                                            <i className="fas fa-exclamation-triangle fa-2x"></i>
                                            <div>
                                                <h5 className="mb-1 fw-bold">Unauthorized Access</h5>
                                                <p className="mb-0 text-muted">Your current faction rank ({factionData?.scriptRank || 'N/A'}) does not have permission to manage bingo activities. Required: Rank 14+.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        )}

                        {selectedSection === 'metrics' && (
                            hasUsersAccess ? <MetricsDashboard /> : <div className="admin-section"><div className="alert alert-danger border-0 bg-opacity-25 shadow-sm p-4">Access Denied</div></div>
                        )}

                        {selectedSection === 'agencyIncidents' && (
                            hasAgencyIncidentAccess ? <AgencyIncidentManager /> : <div className="admin-section"><div className="alert alert-danger border-0 bg-opacity-25 shadow-sm p-4">Access Denied</div></div>
                        )}

                        {selectedSection === 'employeeManager' && (
                            hasEmployeeManagerAccess ? <EmployeeManager /> : <div className="admin-section"><div className="alert alert-danger border-0 bg-opacity-25 shadow-sm p-4">Access Denied</div></div>
                        )}

                        {selectedSection === 'lscc' && (
                            hasLsccManagerAccess ? <div className="dark"><LsccManager /></div> : <div className="admin-section"><div className="alert alert-danger border-0 bg-opacity-25 shadow-sm p-4">Access Denied</div></div>
                        )}

                        {selectedSection === 'forms' && (
                            hasFormsManagerAccess ? <FormsManager currentUser={currentUser} /> : <div className="admin-section"><div className="alert alert-danger border-0 bg-opacity-25 shadow-sm p-4">Access Denied</div></div>
                        )}

                        {selectedSection === 'webhooks' && (
                            hasWebhookAccess ? (
                                <div className="admin-section">
                                    <div className="d-flex justify-content-between align-items-center mb-5">
                                        <h2 className="mb-0 fw-800"><i className="fas fa-bullhorn me-3 text-indigo"></i>Webhook Management</h2>
                                        <span className="admin-badge admin-badge-indigo">{webhooks.length} Registered</span>
                                    </div>
                                    <div className="row g-4">
                                        <div className="col-lg-5">
                                            <div className="card h-100 border-0 shadow-sm">
                                                <div className="card-header bg-transparent py-3 small text-muted uppercase fw-bold">Register Webhook</div>
                                                <div className="card-body p-4">
                                                    <div className="form-group mb-3">
                                                        <label className="form-label small text-muted">Friendly Name</label>
                                                        <input type="text" className="form-control bg-dark border-secondary text-white" placeholder="e.g., Dispatch Alerts" value={newWebhook.name} onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))} />
                                                    </div>
                                                    <div className="form-group mb-3">
                                                        <label className="form-label small text-muted">Webhook URL</label>
                                                        <input type="url" className="form-control bg-dark border-secondary text-white font-monospace small" placeholder="https://discord.com/..." value={newWebhook.url} onChange={(e) => setNewWebhook(prev => ({ ...prev, url: e.target.value }))} />
                                                    </div>
                                                    <div className="form-group mb-4">
                                                        <label className="form-label small text-muted">Event Type</label>
                                                        <select className="form-select bg-dark border-secondary text-white" value={newWebhook.type} onChange={(e) => setNewWebhook(prev => ({ ...prev, type: e.target.value }))}>
                                                            <option value="coronerAlerts">Coroner Alerts</option>
                                                            <option value="phmcAlerts">PHMC Alerts</option>
                                                            <option value="dev">Local Dev Alerts</option>
                                                        </select>
                                                    </div>
                                                    <Button variant="primary" onClick={handleAddWebhook} disabled={isUpdatingWebhooks || !newWebhook.name || !newWebhook.url} className="w-100 py-2 admin-btn fw-bold">
                                                        {isUpdatingWebhooks ? <Spinner animation="border" size="sm" /> : <><i className={`fas ${newWebhook.id ? 'fa-save' : 'fa-plus'} me-2`}></i>{newWebhook.id ? "Update Webhook" : "Register Webhook"}</>}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-lg-7">
                                            <div className="admin-modern-table mb-0 h-100">
                                                <Table hover responsive className="mb-0">
                                                    <thead>
                                                        <tr><th>Target Name</th><th>Type</th><th className="text-end">Actions</th></tr>
                                                    </thead>
                                                    <tbody>
                                                        {webhooks.map((webhook) => (
                                                            <tr key={webhook.id}>
                                                                <td className="fw-bold">{webhook.name}</td>
                                                                <td><span className={`admin-badge ${webhook.type === 'coronerAlerts' ? 'admin-badge-danger' : 'admin-badge-indigo'}`}>{webhook.type}</span></td>
                                                                <td className="text-end">
                                                                    <div className="btn-group">
                                                                        <Button variant="link" className="text-info p-1" onClick={() => handleTestWebhook(webhook)}><i className="fas fa-paper-plane"></i></Button>
                                                                        <Button variant="link" className="text-warning p-1" onClick={() => setNewWebhook(webhook)}><i className="fas fa-edit"></i></Button>
                                                                        <Button variant="link" className="text-danger p-1" onClick={() => handleDeleteWebhook(webhook.id)}><i className="fas fa-trash"></i></Button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </Table>
                                            </div>
                                        </div>
                                    </div>
                                    <WebhookProvider>
                                        <div className="card border-0 shadow-sm mt-5">
                                            <div className="card-header bg-transparent py-3">
                                                <h4 className="mb-0 text-indigo fw-bold small uppercase"><i className="fas fa-paper-plane me-2"></i>Send Webhook Announcement</h4>
                                            </div>
                                            <div className="card-body p-4">
                                                <WebhookManager />
                                            </div>
                                        </div>
                                    </WebhookProvider>
                                </div>
                            ) : <div className="admin-section"><div className="alert alert-warning border-0 bg-opacity-25 shadow-sm p-4">Webhook Access Denied</div></div>
                        )}

                        {selectedSection === 'dev' && <div className="admin-section"><FirebaseFunctionsTester showInAppNotification={showInAppNotification} /></div>}

                        {selectedSection === 'factions' && (
                            hasFactionUpload ? <FactionDataUpload showNotification={showInAppNotification} /> : <div className="admin-section"><div className="alert alert-warning border-0 bg-opacity-25 shadow-sm p-4">Denied</div></div>
                        )}

                        {selectedSection === 'database' && (
                            hasDatabaseAccess ? <DatabaseEditor showNotification={showInAppNotification} currentUser={currentUser} gtawUser={gtaWorldUser} /> : <div className="admin-section"><div className="alert alert-warning border-0 bg-opacity-25 shadow-sm p-4">Denied</div></div>
                        )}

                        {selectedSection === 'morgue' && (
                            hasDatabaseAccess ? <MorgueManager showNotification={showInAppNotification} /> : <div className="admin-section"><div className="alert alert-warning border-0 bg-opacity-25 shadow-sm p-4">Denied</div></div>
                        )}
                    </div>
                </main>
            </div>
            <style>{`
                .status-indicator { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
                .status-indicator.online { background-color: var(--admin-success); box-shadow: 0 0 8px var(--admin-success); }
                .status-indicator.degraded { background-color: #ffc107; box-shadow: 0 0 8px #ffc107; }
                .status-indicator.offline { background-color: #dc3545; box-shadow: 0 0 8px #dc3545; }
                .status-indicator.unknown { background-color: #6c757d; }
                .text-indigo { color: var(--admin-accent) !important; }
                .border-indigo { border-color: var(--admin-accent) !important; }
                .bg-indigo { background-color: var(--admin-accent) !important; }
                .uppercase { text-transform: uppercase; }
                .italic { font-style: italic; }
            `}</style>
        </div>
    );
};

export default AdminDashboard;
