import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Button, Spinner, Alert, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import './AdminDashboard.css';
import GtaWorldLoginButton from '../Auth/GtaWorldLoginButton';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import useFactionPermissions from '../../hooks/useFactionPermissions';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDatabase, ref, get, set } from 'firebase/database';
import { isGoogleAuthenticated, getGoogleUser } from '../../services/gtaWorldAuth';
import { runOAuthDiagnostics, testFirebaseFunctions, testProfileRetrieval, logEnvironmentInfo } from '../../services/firebaseDebug';
import { WebhookProvider } from '../../contexts/WebhookProvider';

// Static imports for managers (removed lazy loading)
import DatabaseEditor from './DatabaseEditor';
import WebhookLogs from './WebhookLogs';
import FactionDataUpload from './FactionDataUpload';
import WebhookManager from './WebhookManager';
import FirebaseFunctionsTester from './FirebaseFunctionsTester';
import EmployeeManager from './EmployeeManager';
import LsccManager from './LsccManager';
import FormsManager from './FormsManager';
import MetricsDashboard from './MetricsDashboard';
import AgencyIncidentManager from './AgencyIncidentManager';

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


    return (
        <div className="admin-dashboard-container">
            <div className="admin-dashboard-layout">
                <div className="sidebar">
                    <div className="sidebar-header">
                        <h5>Admin Panel</h5>
                        <p>Logged in as: {currentUser?.displayName || currentUser?.email || 'Unknown User'}</p>
                        {gtaWorldUser && (
                            <p className="text-info">
                                <i className="fas fa-user me-1"></i>
                                GTA World: {gtaWorldUser.username}
                            </p>
                        )}
                        {currentUser && canUseGoogleAdminOverride && (
                            <div className="mt-3">
                                <div className="form-check form-switch">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        role="switch"
                                        id="googleAdminToggle"
                                        checked={googleAdminToggle}
                                        onChange={(e) => setGoogleAdminToggle(e.target.checked)}
                                    />
                                    <label className="form-check-label" htmlFor="googleAdminToggle">
                                        <small>Enable Google Admin Override</small>
                                    </label>
                                </div>
                                <small className="text-muted d-block mt-1">
                                    Toggle to test faction permission restrictions
                                </small>
                            </div>
                        )}
                    </div>
                    <div className="nav-pills-flex-column">
                        {hasBingoAccess && (
                            <button className={`nav-link ${selectedSection === 'bingo' ? 'active' : ''}`} onClick={() => setSelectedSection('bingo')}><i className="fas fa-dice me-2"></i>Bingo</button>
                        )}
                        {hasUsersAccess && (
                            <button className={`nav-link ${selectedSection === 'metrics' ? 'active' : ''}`} onClick={() => setSelectedSection('metrics')}><i className="fas fa-chart-line me-2"></i>Metrics</button>
                        )}
                        {hasAgencyIncidentAccess && (
                            <button className={`nav-link ${selectedSection === 'agencyIncidents' ? 'active' : ''}`} onClick={() => setSelectedSection('agencyIncidents')}><i className="fas fa-shield-alt me-2 text-danger"></i>Agency Incidents</button>
                        )}
                        {hasEmployeeManagerAccess && (
                            <button className={`nav-link ${selectedSection === 'employeeManager' ? 'active' : ''}`} onClick={() => setSelectedSection('employeeManager')}><i className="fas fa-users me-2"></i>Employee Report Metrics</button>
                        )}
                        {hasLsccManagerAccess && (
                            <button className={`nav-link ${selectedSection === 'lscc' ? 'active' : ''}`} onClick={() => setSelectedSection('lscc')}><i className="fas fa-building me-2"></i>LSCC Panel</button>
                        )}
                        {hasFormsManagerAccess && (
                            <button className={`nav-link ${selectedSection === 'forms' ? 'active' : ''}`} onClick={() => setSelectedSection('forms')}><i className="fas fa-building me-2"></i>Forms Panel</button>
                        )}

                        <button className={`nav-link ${selectedSection === 'webhooks' ? 'active' : ''}`} onClick={() => setSelectedSection('webhooks')}><i className="fas fa-bullhorn me-2"></i>Webhooks</button>
                        <button className={`nav-link ${selectedSection === 'factions' ? 'active' : ''}`} onClick={() => setSelectedSection('factions')}><i className="fas fa-users me-2"></i>Faction Data</button>
                        <button className={`nav-link ${selectedSection === 'dev' ? 'active' : ''}`} onClick={() => setSelectedSection('dev')}><i className="fas fa-code me-2"></i>Developer</button>
                        <button className={`nav-link ${selectedSection === 'database' ? 'active' : ''}`} onClick={() => setSelectedSection('database')}><i className="fas fa-database me-2"></i>Database</button>
                    </div>
                </div>
                <div className="main-content">
                    {/* Welcome Section for PHMC Users */}
                    {isGtaAuthenticated && isFactionMember && factionData && (
                            <div className="card mb-4">
                                <div className="card-header bg-primary text-white">
                                    <h5 className="mb-0">
                                        <i className="fas fa-user-shield me-2"></i>
                                        Welcome to PHMC Admin Panel
                                    </h5>
                                </div>
                                <div className="card-body">
                                    <div className="row">
                                        <div className="col-md-6">
                                            <h6 className="text-primary">Character Information</h6>
                                            <p className="mb-1"><strong>Character Name:</strong> {factionData.characterName}</p>
                                            <p className="mb-1"><strong>Character ID:</strong> {factionData.characterId}</p>
                                            <p className="mb-1"><strong>UCP User:</strong> {gtaWorldUser.username}</p>
                                        </div>
                                        <div className="col-md-6">
                                            <h6 className="text-primary">PHMC Status</h6>
                                            <p className="mb-1"><strong>Rank:</strong> {factionData.rank}</p>
                                            <p className="mb-1"><strong>Script Rank:</strong> {factionData.scriptRank}</p>
                                            <p className="mb-1"><strong>Access Level:</strong> <span className="badge bg-success">{accessLevel}</span></p>
                                            {factionData.activity && (
                                                <p className="mb-1"><strong>Activity:</strong> {factionData.activity}</p>
                                            )}
                                        </div>
                                    </div>
                                    {factionData.lastOnline && (
                                        <div className="mt-2">
                                            <small className="text-muted">
                                                <i className="fas fa-clock me-1"></i>
                                                Last online: {factionData.lastOnline}
                                            </small>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    {selectedSection === 'bingo' && (
                        <div className="card">
                            <div className="card-header">Bingo Management</div>
                            <div className="card-body">
                                {hasBingoAccess ? (
                                    <>
                                        <div className="form-group mb-3">
                                    <label>Select Bingo Type:</label>
                                    <select
                                        value={selectedAdminBingoType}
                                        onChange={(e) => setSelectedAdminBingoType(e.target.value)}
                                        disabled={isUpdatingDb}
                                        className="form-select"
                                    >
                                        {BINGO_TYPES.map(type => (
                                            <option key={type.id} value={type.id}>{type.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-info small mt-1">
                                    The daily reset now runs automatically on the server at 09:00 UTC.
                                </p>
                                <Button
                                    variant="secondary"
                                    onClick={handleManualResetAllBingoCards}
                                    disabled={isUpdatingDb}
                                    className="mt-2 me-2"
                                    title="Manually run the daily reset for all active bingo cards."
                                >
                                    {isUpdatingDb ? <Spinner as="span" animation="border" size="sm" /> : <><i className="fas fa-bomb"></i> Reset All Cards</>}
                                </Button>

                                <Button
                                    variant="primary"
                                    onClick={handleGenerateNewBingoCard}
                                    disabled={isUpdatingDb}
                                    className="mt-2 me-2"
                                >
                                    {isUpdatingDb ? <Spinner as="span" animation="border" size="sm" /> : <><i className="fas fa-sync-alt"></i> Generate New Card</>}
                                </Button>
                                <Button
                                    variant="danger"
                                    onClick={handleClearBingoActivity}
                                    disabled={isUpdatingDb}
                                    className="mt-2 me-2"
                                >
                                    {isUpdatingDb ? <Spinner as="span" animation="border" size="sm" /> : <><i className="fas fa-trash-alt"></i> Clear Activity Log</>}
                                </Button>
                                <Button
                                    variant="warning"
                                    onClick={handleDisableBingoCard}
                                    disabled={isUpdatingDb}
                                    className="mt-2 me-2"
                                    title="This will remove the current card and log, effectively disabling the game until a new card is generated."
                                >
                                    {isUpdatingDb ? <Spinner as="span" animation="border" size="sm" /> : <><i className="fas fa-power-off"></i> Disable Card</>}
                                </Button>
                                <Button
                                    variant="info"
                                    onClick={() => setShowEditBingoPhrasesModal(true)}
                                    disabled={isUpdatingDb || !selectedAdminBingoType}
                                    className="mt-2 me-2"
                                >
                                    <i className="fas fa-edit"></i> Edit {selectedTypeForEdit?.name || 'Master'} Phrases
                                </Button>
                                <Button
                                    variant="warning"
                                            onClick={() => setShowReviewPhrasesModal(true)}
                                            disabled={isUpdatingDb}
                                            className="mt-2"
                                        >
                                            <i className="fas fa-inbox"></i> Review Phrase Requests
                                        </Button>
                                    </>
                                ) : (
                                    <div className="alert alert-danger">
                                        <i className="fas fa-exclamation-triangle me-2"></i>
                                        <strong>Access Denied:</strong> Your current faction rank ({factionData?.scriptRank || 'N/A'}) does not have permission to manage bingo activities.
                                        <br />
                                        <small>Required: Script Rank 14 or higher, or Google Admin access</small>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {selectedSection === 'metrics' && (
                        <div className="card">
                            <div className="card-header">User Metrics & Engagement</div>
                            <div className="card-body">
                                {hasUsersAccess ? (
                                    <MetricsDashboard />
                                ) : (
                                    <div className="alert alert-danger">
                                        <i className="fas fa-exclamation-triangle me-2"></i>
                                        <strong>Access Denied:</strong> Your current faction rank ({factionData?.scriptRank || 'N/A'}) does not have permission to view metrics.
                                        <br />
                                        <small>Required: Script Rank 14 or higher, or Google Admin access</small>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {selectedSection === 'agencyIncidents' && (
                        <div className="card">
                            <div className="card-body">
                                {hasAgencyIncidentAccess ? (
                                    <AgencyIncidentManager />
                                ) : (
                                    <div className="alert alert-danger">
                                        <i className="fas fa-exclamation-triangle me-2"></i>
                                        <strong>Access Denied:</strong> Your current faction rank ({factionData?.scriptRank || 'N/A'}) does not have permission to view agency incidents.
                                        <br />
                                        <small>Required: Script Rank 14 or higher, or Google Admin access</small>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {selectedSection === 'employeeManager' && (
                        <div className="card">
                            <div className="card-body">
                                {hasEmployeeManagerAccess ? (
                                    <EmployeeManager />
                                ) : (
                                    <div className="alert alert-danger">
                                        <i className="fas fa-exclamation-triangle me-2"></i>
                                        <strong>Access Denied:</strong> Your current faction rank ({factionData?.scriptRank || 'N/A'}) does not have permission to manage employees.
                                        <br />
                                        <small>Required: Script Rank 13 or higher, or Google Admin access</small>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {selectedSection === 'lscc' && (
                            <div className="card-body">
                                {hasLsccManagerAccess ? (
                                    <LsccManager />
                                ) : (
                                    <div className="alert alert-danger">
                                        <i className="fas fa-exclamation-triangle me-2"></i>
                                        <strong>Access Denied:</strong> Your current faction rank ({factionData?.scriptRank || 'N/A'}) does not have permission to access the LSCC Panel.
                                        <br />
                                        <small>Required: Script Rank 10 or higher, or Google Admin access</small>
                                    </div>
                                )}
                        </div>
                    )}
                                        {selectedSection === 'forms' && (
                            <div className="card-body">
                                {hasFormsManagerAccess ? (
                                    <FormsManager currentUser={currentUser} />
                                ) : (
                                    <div className="alert alert-danger">
                                        <i className="fas fa-exclamation-triangle me-2"></i>
                                        <strong>Access Denied:</strong> Your current faction rank ({factionData?.scriptRank || 'N/A'}) does not have permission to access the Forms Panel.
                                        <br />
                                        <small>Required: Script Rank 10 or higher, or Google Admin access</small>
                                    </div>
                                )}
                        </div>
                    )}

                    {selectedSection === 'webhooks' && (
                        <div className="card">
                            <div className="card-header">
                                <div className="d-flex justify-content-between align-items-center">
                                    <h5 className="mb-0">Webhook Management</h5>
                                                                        <h5 className="mb-0">This area is VERY Dangerous - Don&apos;t use </h5>

                                    <div className="badge bg-secondary">
                                        {webhooks.length} webhook{webhooks.length !== 1 ? 's' : ''} configured
                                    </div>
                                </div>
                            </div>
                            <div className="card-body">
                                {isGtaAuthenticated || currentUser ? (
                                    hasWebhookAccess ? (
                                        <div className="row">
                                            {/* Left Column - Send Webhook */}
                                            <div className="col-md-6">
                                                <div className="card h-100">
                                                    <div className="card-header bg-primary text-white">
                                                        <h6 className="mb-0">
                                                            <i className="fas fa-paper-plane me-2"></i>
                                                            Send Webhook
                                                        </h6>
                                                    </div>
                                                    <div className="card-body">
                                                        <WebhookProvider>
                                                            <WebhookManager />
                                                        </WebhookProvider>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right Column - Webhook Management */}
                                            <div className="col-md-6">
                                                <div className="card h-100">
                                                    <div className="card-header bg-success text-white">
                                                        <h6 className="mb-0">
                                                            <i className="fas fa-cogs me-2"></i>
                                                            {newWebhook.id ? 'Edit Webhook' : 'Add New Webhook'}
                                                        </h6>
                                                    </div>
                                                    <div className="card-body">
                                                        {newWebhook.id && (
                                                            <div className="alert alert-info py-2 mb-3">
                                                                <i className="fas fa-info-circle me-2"></i>
                                                                Editing: <strong>{newWebhook.name}</strong>
                                                                <button 
                                                                    type="button" 
                                                                    className="btn btn-sm btn-outline-secondary ms-2"
                                                                    onClick={() => setNewWebhook({ name: '', url: '', type: 'coronerAlerts' })}
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        )}
                                                        <div className="form-group mb-3">
                                                            <label className="form-label">Webhook Name</label>
                                                            <input
                                                                type="text"
                                                                className="form-control"
                                                                placeholder="e.g., Discord Notifications"
                                                                value={newWebhook.name}
                                                                onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                                                            />
                                                        </div>
                                                        <div className="form-group mb-3">
                                                            <label className="form-label">Webhook URL</label>
                                                            <input
                                                                type="url"
                                                                className="form-control"
                                                                placeholder="https://discord.com/api/webhooks/..."
                                                                value={newWebhook.url}
                                                                onChange={(e) => setNewWebhook(prev => ({ ...prev, url: e.target.value }))}
                                                            />
                                                        </div>
                                                        <div className="form-group mb-3">
                                                            <label className="form-label">Event Type</label>
                                                            <select
                                                                className="form-select"
                                                                value={newWebhook.type}
                                                                onChange={(e) => setNewWebhook(prev => ({ ...prev, type: e.target.value }))}
                                                            >
                                                                <option value="coronerAlerts">Coroner Alerts</option>
                                                                <option value="phmcAlerts">PHMC Alerts</option>
                                                                <option value="dev">local dev discord</option>
                                                            </select>
                                                        </div>
                                                        <div className="d-flex gap-2">
                                                            <Button 
                                                                variant={newWebhook.id ? "warning" : "primary"} 
                                                                onClick={handleAddWebhook} 
                                                                disabled={isUpdatingWebhooks || !newWebhook.name || !newWebhook.url}
                                                            >
                                                                {isUpdatingWebhooks ? (
                                                                    <Spinner as="span" animation="border" size="sm" />
                                                                ) : (
                                                                    <>
                                                                        <i className={`fas ${newWebhook.id ? 'fa-save' : 'fa-plus'} me-2`}></i>
                                                                        {newWebhook.id ? "Update" : "Add"} Webhook
                                                                    </>
                                                                )}
                                                            </Button>
                                                            {newWebhook.id && (
                                                                <Button 
                                                                    variant="secondary" 
                                                                    onClick={() => setNewWebhook({ name: '', url: '', type: 'coronerAlerts' })}
                                                                    disabled={isUpdatingWebhooks}
                                                                >
                                                                    Cancel
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="alert alert-warning">
                                            <i className="fas fa-exclamation-triangle me-2"></i>
                                            <strong>Access Denied:</strong> Your current faction rank ({factionData?.scriptRank || 'N/A'}) does not have webhook management permissions.
                                            <br />
                                            <small>Required: Script Rank 11 or higher</small>
                                        </div>
                                    )
                                ) : (
                                    <div className="alert alert-info">
                                        <i className="fas fa-info-circle me-2"></i>
                                        Please log in with your GTA World account to access webhook management features.
                                    </div>
                                )}

                                {/* Existing Webhooks List */}
                                {(isGtaAuthenticated || currentUser) && hasWebhookAccess && (
                                    <div className="mt-4">
                                        <div className="card">
                                            <div className="card-header bg-info text-white">
                                                <h6 className="mb-0">
                                                    <i className="fas fa-list me-2"></i>
                                                    Existing Webhooks ({webhooks.length})
                                                </h6>
                                            </div>
                                            <div className="card-body">
                                                {webhooks.length > 0 ? (
                                                    <div className="table-responsive">
                                                        <table className="table table-sm table-hover">
                                                            <thead>
                                                                <tr>
                                                                    <th>Name</th>
                                                                    <th>Type</th>
                                                                    <th>URL</th>
                                                                    <th>Actions</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {webhooks.map((webhook) => (
                                                                    <tr key={webhook.id}>
                                                                        <td>
                                                                            <strong>{webhook.name}</strong>
                                                                        </td>
                                                                        <td>
                                                                            <span className={`badge ${webhook.type === 'dev' ? 'bg-warning' : webhook.type === 'coronerAlerts' ? 'bg-danger' : 'bg-primary'}`}>
                                                                                {webhook.type}
                                                                            </span>
                                                                        </td>
                                                                        <td>
                                                                            <small className="text-muted" title={webhook.url}>
                                                                                {webhook.url.length > 40 ? `${webhook.url.substring(0, 40)}...` : webhook.url}
                                                                            </small>
                                                                        </td>
                                                                        <td>
                                                                            <div className="btn-group btn-group-sm">
                                                                                <button
                                                                                    className="btn btn-outline-primary"
                                                                                    onClick={() => handleTestWebhook(webhook)}
                                                                                    disabled={isUpdatingWebhooks}
                                                                                    title="Test this webhook"
                                                                                >
                                                                                    <i className="fas fa-paper-plane"></i>
                                                                                </button>
                                                                                <button
                                                                                    className="btn btn-outline-warning"
                                                                                    onClick={() => setNewWebhook(webhook)}
                                                                                    disabled={isUpdatingWebhooks}
                                                                                    title="Edit this webhook"
                                                                                >
                                                                                    <i className="fas fa-edit"></i>
                                                                                </button>
                                                                                <button
                                                                                    className="btn btn-outline-danger"
                                                                                    onClick={() => handleDeleteWebhook(webhook.id)}
                                                                                    disabled={isUpdatingWebhooks}
                                                                                    title="Delete this webhook"
                                                                                >
                                                                                    <i className="fas fa-trash"></i>
                                                                                </button>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : (
                                                    <div className="text-center text-muted py-3">
                                                        <i className="fas fa-inbox fa-2x mb-2"></i>
                                                        <p>No webhooks configured yet. Add one above to get started.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Webhook Logs Section */}
                                {(isGtaAuthenticated || currentUser) && hasWebhookAccess && (
                                    <div className="mt-4">
                                        <div className="card">
                                            <div className="card-body p-0">
                                                <WebhookLogs 
                                                    refreshTrigger={logRefreshTrigger} 
                                                    onRefresh={() => setLogRefreshTrigger(prev => prev + 1)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {selectedSection === 'dev' && (
                        <div className="card">
                            <div className="card-header">Developer Tools</div>
                            <div className="card-body">
                                <div className="mb-3">
                                    <div className="card">
                                        <div className="card-header">
                                            <h6 className="mb-0">GTA World Authentication & Faction Status</h6>
                                        </div>
                                        <div className="card-body">
                                            {isGtaAuthenticated || currentUser ? (
                                                <div>
                                                    <div className="alert alert-success d-flex align-items-center mb-3">
                                                        <i className="fas fa-check-circle me-2"></i>
                                                        <div>
                                                            <strong>Connected as:</strong> {currentUser?.displayName || currentUser?.email || 'Unknown User'}
                                                            <br />
                                                            <small className="text-muted">
                                                                User ID: {currentUser?.uid} | 
                                                                {gtaWorldUser?.isFactionMember && gtaWorldUser?.faction?.scriptRank !== undefined ? 
                                                                    ` Script Rank: ${gtaWorldUser.faction.scriptRank} |` : ''} 
                                                                Last login: {new Date().toLocaleDateString()}
                                                            </small>
                                                        </div>
                                                    </div>                                                    {/* Faction Status */}
                                                    <div className="card border">
                                                        <div className="card-header">
                                                            <h6 className="mb-0">Faction Permissions</h6>
                                                        </div>
                                                        <div className="card-body">
                                                            {factionLoading ? (
                                                                <div className="d-flex align-items-center">
                                                                    <Spinner animation="border" size="sm" className="me-2" />
                                                                    Loading faction data...
                                                                </div>
                                                            ) : isFactionMember ? (
                                                                <div>
                                                                    {/* Google Admin Override */}
                                                                    {currentUser && (
                                                                        <div className={`alert ${googleAdminToggle ? 'alert-success' : 'alert-secondary'} py-2 mb-3`}>
                                                                            <i className={`fas ${googleAdminToggle ? 'fa-crown' : 'fa-toggle-off'} me-2`}></i>
                                                                            <strong>Google Admin Override: {googleAdminToggle ? 'ACTIVE' : 'DISABLED'}</strong>
                                                                            {googleAdminToggle ? (
                                                                                <span> - Full administrative privileges granted</span>
                                                                            ) : (
                                                                                <span> - Testing with normal permissions</span>
                                                                            )}
                                                                            <br />
                                                                            <small>{googleAdminToggle ? 'All faction restrictions bypassed • Script Rank 15 equivalent' : 'Use toggle in sidebar to enable override for testing'}</small>
                                                                        </div>
                                                                    )}
                                                                    
                                                                    <div className="alert alert-success py-2">
                                                                        <i className="fas fa-users me-2"></i>
                                                                        <strong>PHMC Member</strong> - Access granted
                                                                    </div>
                                                                    {factionData && (
                                                                        <div className="row">
                                                                            <div className="col-md-6">
                                                                                <p><strong>Character:</strong> {factionData.characterName}</p>
                                                                                <p><strong>Script Rank:</strong> {factionData.scriptRank}</p>
                                                                                <p><strong>Access Level:</strong> {accessLevel}</p>
                                                                            </div>
                                                                            <div className="col-md-6">
                                                                                <p><strong>Permissions:</strong></p>
                                                                                <ul className="list-unstyled">
                                                                                    <li><i className={`fas ${canAccessAdmin ? 'fa-check text-success' : 'fa-times text-danger'}`}></i> Admin Access</li>
                                                                                    <li><i className={`fas ${canAccessDatabase ? 'fa-check text-success' : 'fa-times text-danger'}`}></i> Database Access</li>
                                                                                    <li><i className={`fas ${canUploadFactionData ? 'fa-check text-success' : 'fa-times text-danger'}`}></i> Faction Upload</li>
                                                                                    <li><i className={`fas ${canManageWebhooks ? 'fa-check text-success' : 'fa-times text-danger'}`}></i> Webhook Management</li>
                                                                                </ul>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    <Button 
                                                                        variant="outline-primary" 
                                                                        size="sm" 
                                                                        onClick={refreshFactionData}
                                                                        disabled={factionLoading}
                                                                    >
                                                                        <i className="fas fa-refresh me-2"></i>
                                                                        Refresh Faction Data
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <div>
                                                                    {/* Google Admin Override */}
                                                                    {currentUser && (
                                                                        <div className={`alert ${googleAdminToggle ? 'alert-success' : 'alert-secondary'} py-2 mb-3`}>
                                                                            <i className={`fas ${googleAdminToggle ? 'fa-crown' : 'fa-toggle-off'} me-2`}></i>
                                                                            <strong>Google Admin Override: {googleAdminToggle ? 'ACTIVE' : 'DISABLED'}</strong>
                                                                            {googleAdminToggle ? (
                                                                                <span> - Full administrative privileges granted</span>
                                                                            ) : (
                                                                                <span> - Testing with normal permissions</span>
                                                                            )}
                                                                            <br />
                                                                            <small>{googleAdminToggle ? 'All faction restrictions bypassed • Script Rank 15 equivalent' : 'Use toggle in sidebar to enable override for testing'}</small>
                                                                        </div>
                                                                    )}
                                                                    
                                                                    {!currentUser && (
                                                                        <div className="alert alert-warning py-2">
                                                                            <i className="fas fa-exclamation-triangle me-2"></i>
                                                                            <strong>Not a PHMC Member</strong> - Limited access
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <p className="text-muted mb-3">
                                                        Connect your GTA World account for enhanced admin features and OAuth testing.
                                                    </p>
                                                    <GtaWorldLoginButton 
                                                        variant="primary"
                                                        returnPath="/admin"
                                                        disabled={gtaAuthLoading || factionLoading}
                                                        onError={(error) => showInAppNotification && showInAppNotification(`Login failed: ${error}`, 'error')}
                                                        onSuccess={() => {
                                                            console.log('Login successful');
                                                            refreshFactionData();
                                                        }}
                                                        onInitiate={() => {
                                                            // Mark as token exchange for testing purposes
                                                            sessionStorage.setItem('oauth-exchange-in-progress', 'true');
                                                        }}
                                                        title={gtaAuthLoading ? "Checking authentication..." : "Connect your GTA World account"}
                                                    >
                                                        {gtaAuthLoading ? (
                                                            <>
                                                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                                Checking authentication...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <i className="fas fa-sign-in-alt me-2"></i>
                                                                Connect GTA World Account
                                                            </>
                                                        )}
                                                    </GtaWorldLoginButton>
                                                </div>
                                            )}
                                            
                                            {gtaAuthError && (
                                                <div className="alert alert-warning mt-2">
                                                    <i className="fas fa-exclamation-triangle me-2"></i>
                                                    {gtaAuthError}
                                                </div>
                                            )}

                                            {/* NEW: SuperAdmin Authorization Linker */}
                                            {isGoogleAdminActive && gtaWorldUser && (
                                                <div className="card mt-3 border-danger">
                                                    <div className="card-header bg-danger text-white py-2">
                                                        <h6 className="mb-0 small"><i className="fas fa-link me-2"></i>SuperAdmin Authorization</h6>
                                                    </div>
                                                    <div className="card-body py-2">
                                                        <p className="small mb-2">You are currently in <strong>Dual-Auth Mode</strong>. You can link this character identity to permanent SuperAdmin access.</p>
                                                        <div className="d-flex align-items-center justify-content-between">
                                                            <code className="text-danger">UID: gtaw:{gtaWorldUser.id}</code>
                                                            <div className="d-flex gap-2">
                                                                <Button 
                                                                    variant="outline-secondary" 
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        const cmd = `gtaw:${gtaWorldUser.id}`;
                                                                        navigator.clipboard.writeText(cmd);
                                                                        showInAppNotification(`UID ${cmd} copied to clipboard!`, 'info');
                                                                    }}
                                                                >
                                                                    Copy
                                                                </Button>
                                                                <Button 
                                                                    variant="danger" 
                                                                    size="sm"
                                                                    onClick={async () => {
                                                                        if (!window.confirm(`Are you sure you want to GRANT PERMANENT SUPERADMIN ACCESS to ${gtaWorldUser.username} (gtaw:${gtaWorldUser.id})?`)) return;
                                                                        try {
                                                                            const db = getDatabase();
                                                                            await set(ref(db, `admin_config/super_admins/uids/gtaw:${gtaWorldUser.id}`), true);
                                                                            showInAppNotification(`Successfully granted SuperAdmin access to gtaw:${gtaWorldUser.id}`, 'success');
                                                                        } catch (error) {
                                                                            console.error('Failed to grant superadmin:', error);
                                                                            showInAppNotification(`Failed to grant access: ${error.message}`, 'error');
                                                                        }
                                                                    }}
                                                                >
                                                                    Grant Access
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="mb-3">
                                    <h6>Firebase Functions Diagnostics</h6>
                                    <div className="d-flex gap-2 mb-3">
                                        <Button 
                                            variant="info" 
                                            size="sm"
                                            onClick={handleTestFirebase}
                                            disabled={!hasDatabaseAccess}
                                            title={hasDatabaseAccess ? "Test Firebase Functions connectivity" : "Requires database access permission"}
                                        >
                                            <i className="fas fa-network-wired me-2"></i>
                                            Test Firebase Functions
                                        </Button>
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            onClick={handleMigrateReports}
                                            disabled={isMigratingReports || !hasAdminAccess}
                                            title={hasAdminAccess ? "Migrate old report data to new structure" : "Requires admin access permission"}
                                        >
                                            {isMigratingReports ? (
                                                <Spinner as="span" animation="border" size="sm" />
                                            ) : (
                                                <i className="fas fa-database me-2"></i>
                                            )}
                                            Migrate Reports
                                        </Button>
                                        <Button 
                                            variant="success" 
                                            size="sm"
                                            onClick={handleTestProfile}
                                            title="Get raw profile data from GTA World API"
                                        >
                                            <i className="fas fa-user-circle me-2"></i>
                                            Get Raw Profile
                                        </Button>
                                        <GtaWorldLoginButton 
                                            variant="warning"
                                            size="sm"
                                            returnPath="/admin"
                                            disabled={gtaAuthLoading || factionLoading}
                                            onError={(error) => showInAppNotification && showInAppNotification(`OAuth Login Test Failed: ${error}`, 'error')}
                                            onSuccess={() => {
                                                console.log('OAuth Login Test successful');
                                                showInAppNotification && showInAppNotification('OAuth Login Test completed successfully!', 'success');
                                                refreshFactionData();
                                            }}
                                            onInitiate={() => {
                                                console.log('OAuth Login Test initiated');
                                                showInAppNotification && showInAppNotification('Testing OAuth login flow...', 'info');
                                            }}
                                            title={gtaAuthLoading ? "Checking authentication..." : "Test OAuth login flow from this section"}
                                        >
                                            {gtaAuthLoading ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                    Checking auth...
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fas fa-sign-in-alt me-2"></i>
                                                    Test OAuth Login
                                                </>
                                            )}
                                        </GtaWorldLoginButton>
                                        <Button 
                                            variant="secondary" 
                                            size="sm"
                                            onClick={logEnvironmentInfo}
                                            title="Log environment information to console"
                                        >
                                            <i className="fas fa-info-circle me-2"></i>
                                            Log Environment Info
                                        </Button>
                                        <Button
                                            variant="info"
                                            size="sm"
                                            onClick={() => setShowMigrator(true)}
                                            disabled={!hasAdminAccess}
                                            title={hasAdminAccess ? "Migrate a legacy report to the new format" : "Requires admin access permission"}
                                        >
                                            <i className="fas fa-magic me-2"></i>
                                            Migrate Legacy Report (Experimental)
                                        </Button>
                                        <Button
                                            variant="outline-warning"
                                            size="sm"
                                            onClick={handleScanLocations}
                                            disabled={isScanningLocations || !hasAdminAccess}
                                            title="Scan reports for unknown locations and log them for mapping."
                                        >
                                            {isScanningLocations ? <Spinner as="span" animation="border" size="sm" /> : <i className="fas fa-search-location me-2"></i>}
                                            Scan for Untracked
                                        </Button>
                                    </div>

                                    <h6 className="mt-4">Feature Toggles</h6>
                                    <Form.Check 
                                        type="switch"
                                        id="map-toggle-switch"
                                        label="Enable Map Feature"
                                        checked={mapEnabled}
                                        onChange={handleToggleMap}
                                        disabled={!hasAdminAccess}
                                    />

                                    <h6 className="mt-4">Coroner Report Manual Triggers (Webhook Test)</h6>
                                    <div className="d-flex gap-2 mb-3 flex-wrap">
                                        <Button
                                            variant="outline-primary"
                                            size="sm"
                                            onClick={() => handleTriggerCoronerReport('weekly')}
                                            disabled={isTriggeringReport || !hasAdminAccess}
                                        >
                                            {isTriggeringReport ? <Spinner size="sm" /> : <i className="fas fa-calendar-week me-1"></i>} Force Weekly Report
                                        </Button>
                                        <Button
                                            variant="outline-primary"
                                            size="sm"
                                            onClick={() => handleTriggerCoronerReport('monthly')}
                                            disabled={isTriggeringReport || !hasAdminAccess}
                                        >
                                            {isTriggeringReport ? <Spinner size="sm" /> : <i className="fas fa-calendar-alt me-1"></i>} Force Monthly Report
                                        </Button>
                                        <Button
                                            variant="outline-primary"
                                            size="sm"
                                            onClick={() => handleTriggerCoronerReport('yearly')}
                                            disabled={isTriggeringReport || !hasAdminAccess}
                                        >
                                            {isTriggeringReport ? <Spinner size="sm" /> : <i className="fas fa-calendar me-1"></i>} Force Yearly Report
                                        </Button>
                                    </div>
                                    
                                    {diagnosticsResult && (
                                        <div className="card">
                                            <div className="card-header">
                                                <h6 className="mb-0">
                                                    Diagnostics Results 
                                                    <span className={`badge ms-2 ${diagnosticsResult.summary?.allTestsPassed ? 'bg-success' : 'bg-danger'}`}>
                                                        {diagnosticsResult.summary?.allTestsPassed ? 'All Tests Passed' : 'Issues Found'}
                                                    </span>
                                                </h6>
                                            </div>
                                            <div className="card-body">
                                                {diagnosticsResult.summary && (
                                                    <div className="mb-3">
                                                        <p><strong>Tests:</strong> {diagnosticsResult.summary.passedTests}/{diagnosticsResult.summary.totalTests} passed</p>
                                                        {diagnosticsResult.summary.criticalIssues.length > 0 && (
                                                            <Alert variant="danger">
                                                                <strong>Critical Issues:</strong>
                                                                <ul className="mb-0 mt-2">
                                                                    {diagnosticsResult.summary.criticalIssues.map((issue, idx) => (
                                                                        <li key={idx}><strong>{issue.test}:</strong> {issue.error}</li>
                                                                    ))}
                                                                </ul>
                                                            </Alert>
                                                        )}
                                                    </div>
                                                )}
                                                <details>
                                                    <summary>View Detailed Results</summary>
                                                    <pre className="mt-2" style={{ fontSize: '12px', maxHeight: '300px', overflow: 'auto' }}>
                                                        {JSON.stringify(diagnosticsResult, null, 2)}
                                                    </pre>
                                                </details>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <Button variant="danger" onClick={() => {
                                    try {
                                        null.throwError();
                                    } catch (error) {
                                        Sentry.captureException(error, { extra: { context: 'Test Error Button Clicked' } });
                                        if (showInAppNotification) showInAppNotification('Test error sent to Sentry!', 'check-circle');
                                        throw error; // Re-throw the error to trigger the global handler
                                    }
                                }}>
                                    <i className="fas fa-bug"></i> Test Sentry Error
                                </Button>
                                <div className="mt-3">
                                    <FirebaseFunctionsTester showInAppNotification={showInAppNotification} />
                                </div>

                                {/* HOTFIX: Local SuperAdmin Whitelist Manager */}
                                {window.location.hostname === 'localhost' && isGoogleAdminActive && (
                                    <div className="mt-4 border-top pt-4">
                                        <h6 className="text-danger"><i className="fas fa-tools me-2"></i>[DEV] SuperAdmin Whitelist Manager</h6>
                                        <p className="small text-muted">Directly manage the dynamic SuperAdmin whitelist in Realtime Database. Only visible on localhost.</p>
                                        
                                        <div className="row g-2">
                                            <div className="col-md-4">
                                                <div className="input-group input-group-sm">
                                                    <input type="text" id="dev-ucp-name" className="form-control" placeholder="UCP Name" />
                                                    <Button variant="outline-danger" onClick={async () => {
                                                        const val = document.getElementById('dev-ucp-name').value;
                                                        if (!val) return;
                                                        try {
                                                            await set(ref(getDatabase(), `admin_config/super_admins/ucp_names/${val}`), true);
                                                            showInAppNotification(`Added UCP ${val} to whitelist`, 'success');
                                                            document.getElementById('dev-ucp-name').value = '';
                                                        } catch (e) { showInAppNotification(e.message, 'error'); }
                                                    }}>Add UCP</Button>
                                                </div>
                                            </div>
                                            <div className="col-md-4">
                                                <div className="input-group input-group-sm">
                                                    <input type="text" id="dev-uid" className="form-control" placeholder="gtaw:ID" />
                                                    <Button variant="outline-danger" onClick={async () => {
                                                        const val = document.getElementById('dev-uid').value;
                                                        if (!val) return;
                                                        try {
                                                            await set(ref(getDatabase(), `admin_config/super_admins/uids/${val}`), true);
                                                            showInAppNotification(`Added UID ${val} to whitelist`, 'success');
                                                            document.getElementById('dev-uid').value = '';
                                                        } catch (e) { showInAppNotification(e.message, 'error'); }
                                                    }}>Add UID</Button>
                                                </div>
                                            </div>
                                            <div className="col-md-4">
                                                <div className="input-group input-group-sm">
                                                    <input type="text" id="dev-email" className="form-control" placeholder="Email" />
                                                    <Button variant="outline-danger" onClick={async () => {
                                                        const val = document.getElementById('dev-email').value;
                                                        if (!val) return;
                                                        try {
                                                            const safeEmail = val.replace(/\./g, ',');
                                                            await set(ref(getDatabase(), `admin_config/super_admins/emails/${safeEmail}`), true);
                                                            showInAppNotification(`Added Email ${val} to whitelist`, 'success');
                                                            document.getElementById('dev-email').value = '';
                                                        } catch (e) { showInAppNotification(e.message, 'error'); }
                                                    }}>Add Email</Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {selectedSection === 'factions' && (
                        <div className="card">
                            <div className="card-header">
                                <h3>Faction Data Management</h3>
                            </div>
                            <div className="card-body">
                                {isGtaAuthenticated || currentUser ? (
                                    hasFactionUpload ? (
                                        <div>
                                            <p className="text-muted mb-4">
                                                Upload and manage faction member data for access control and reporting.
                                            </p>
                                            <FactionDataUpload showNotification={showInAppNotification} />
                                        </div>
                                    ) : (
                                        <div className="alert alert-warning">
                                            <i className="fas fa-exclamation-triangle me-2"></i>
                                            <strong>Access Denied:</strong> Your current faction rank ({factionData?.scriptRank || 'N/A'}) does not have permission to upload faction data.
                                            <br />
                                            <small>Required: Script Rank 10 or higher</small>
                                        </div>
                                    )
                                ) : (
                                    <div className="alert alert-info">
                                        <i className="fas fa-info-circle me-2"></i>
                                        Please log in with your GTA World account to access faction management features.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {selectedSection === 'database' && (
                        <div className="card">
                            <div className="card-header">Database Editor</div>
                            <div className="card-body">
                                {isGtaAuthenticated || currentUser ? (
                                    hasDatabaseAccess ? (
                                        <DatabaseEditor 
    showNotification={showInAppNotification} 
    currentUser={currentUser} 
    gtawUser={gtaWorldUser} 
/>
                                    ) : (
                                        <div className="alert alert-warning">
                                            <i className="fas fa-exclamation-triangle me-2"></i>
                                            <strong>Access Denied:</strong> Your current faction rank ({factionData?.scriptRank || 'N/A'}) does not have database access permissions.
                                            <br />
                                            <small>Required: Script Rank 12 or higher</small>
                                        </div>
                                    )
                                ) : (
                                    <div className="alert alert-info">
                                        <i className="fas fa-info-circle me-2"></i>
                                        Please log in with your GTA World account to access database management features.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
