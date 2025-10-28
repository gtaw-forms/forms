import React, { useState } from 'react';
import { Button, Spinner, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import './AdminDashboard.css';
import DatabaseEditor from './DatabaseEditor';
import UserStats from './UserStats';
import WebhookLogs from './WebhookLogs';
import FactionDataUpload from './FactionDataUpload';
import GtaWorldLoginButton from '../Auth/GtaWorldLoginButton';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import useFactionPermissions from '../../hooks/useFactionPermissions';
import { isGoogleAuthenticated, getGoogleUser } from '../../services/gtaWorldAuth';
import { runOAuthDiagnostics, testFirebaseFunctions, testProfileRetrieval, logEnvironmentInfo } from '../../services/firebaseDebug';
import WebhookManager from './WebhookManager';
import { WebhookProvider } from '../../contexts/WebhookProvider';
import FirebaseFunctionsTester from './FirebaseFunctionsTester';

const AdminDashboard = ({
    currentUser,
    desktopNotificationPermission,
    handleEnableDesktopNotifications,
    isUpdatingDb,
    selectedRecruitmentCategory,
    setSelectedRecruitmentCategory,
    recruitmentCategories,
    handleAddRoleClick,
    isLoadingRecruitmentData,
    currentRecruitmentData,
    handleRenameRoleKeyClick,
    handleEditRoleClick,
    handleTogglePositionStatus,
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
    setShowUserManagementModal,

    setShowCctvWebhookModal,
    handleLogout,
    Sentry,
    showInAppNotification,
    setShowOAuthTokenExchangeModal,
    setShowUserDataExchangeModal,
    lockdownConfig,
    setLockdownConfig,
    handleUpdateLockdownStatus,
    webhooks,
    newWebhook,
    setNewWebhook,
    handleAddWebhook,
    handleDeleteWebhook,
    isUpdatingWebhooks,
    customWebhookChannel,
    setCustomWebhookChannel,
    customWebhookTitle,
    setCustomWebhookTitle,
    customWebhookMessage,
    setCustomWebhookMessage,
    customWebhookUrl,
    setCustomWebhookUrl,
    customWebhookSending,
    customWebhookResult,
    handleSendCustomWebhook,
    logRefreshTrigger,
    setLogRefreshTrigger,
    handleScanDuplicateReports,
    handleDeleteDuplicateReports,
    duplicateReports,
    isScanningDuplicates,
    isDeletingDuplicates
}) => {

    const [selectedSection, setSelectedSection] = useState('serviceStatus');
    const [diagnosticsResult, setDiagnosticsResult] = useState(null);
    const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
    const navigate = useNavigate();
    
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
    const isRank14OrHigher = scriptRank >= 14;
    const isRank15OrHigher = scriptRank >= 15;
    const isRank11OrHigher = scriptRank >= 11;
    
    // Determine access levels for specific sections
    const hasServiceStatusAccess = isGoogleAdminActive || isRank14OrHigher;
    const hasLockdownAccess = isGoogleAdminActive || isRank14OrHigher;
    const hasBingoAccess = isGoogleAdminActive || isRank14OrHigher;
    const hasUsersAccess = isGoogleAdminActive || isRank14OrHigher;
    const hasRankPermissionsAccess = isGoogleAdminActive || isRank15OrHigher;
    const canUseGoogleAdminOverride = isEmailSignin; // Only available for email signin
    
    // Override permissions for Google-authenticated users
    const hasAdminAccess = isGoogleAdminActive || canAccessAdmin;
    const hasFactionUpload = isGoogleAdminActive || canUploadFactionData || (scriptRank >= 10); // Direct rank check for faction upload
    const hasDatabaseAccess = isGoogleAdminActive || canAccessDatabase || (scriptRank >= 12); // Direct rank check for database
    const hasWebhookAccess = isGoogleAdminActive || canManageWebhooks || isRank11OrHigher; // Direct rank check for webhook management

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

    return (
        <div className="admin-dashboard-container">
            <div className="admin-dashboard-layout">
                <div className="sidebar">
                    <div className="sidebar-header">
                        <h5>Admin Panel</h5>
                        <p>Logged in as: {(() => {
                            if (isGtaAuthenticated && gtaWorldUser) {
                                return gtaWorldUser.username;
                            }
                            return currentUser?.email || 'Unknown';
                        })()}</p>
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
                        {hasLockdownAccess && (
                            <button className={`nav-link ${selectedSection === 'lockdown' ? 'active' : ''}`} onClick={() => setSelectedSection('lockdown')}><i className="fas fa-lock me-2"></i>Lockdown</button>
                        )}
                        <button className={`nav-link ${selectedSection === 'recruitment' ? 'active' : ''}`} onClick={() => setSelectedSection('recruitment')}><i className="fas fa-user-plus me-2"></i>Recruitment</button>
                        {hasBingoAccess && (
                            <button className={`nav-link ${selectedSection === 'bingo' ? 'active' : ''}`} onClick={() => setSelectedSection('bingo')}><i className="fas fa-dice me-2"></i>Bingo</button>
                        )}
                        {hasUsersAccess && (
                            <button className={`nav-link ${selectedSection === 'users' ? 'active' : ''}`} onClick={() => setSelectedSection('users')}><i className="fas fa-users-cog me-2"></i>Users</button>
                        )}
                        <button className={`nav-link ${selectedSection === 'webhooks' ? 'active' : ''}`} onClick={() => setSelectedSection('webhooks')}><i className="fas fa-bullhorn me-2"></i>Webhooks</button>
                        <button className={`nav-link ${selectedSection === 'factions' ? 'active' : ''}`} onClick={() => setSelectedSection('factions')}><i className="fas fa-users me-2"></i>Faction Data</button>
                        <button className={`nav-link ${selectedSection === 'dev' ? 'active' : ''}`} onClick={() => setSelectedSection('dev')}><i className="fas fa-code me-2"></i>Developer</button>
                        <button className={`nav-link ${selectedSection === 'database' ? 'active' : ''}`} onClick={() => setSelectedSection('database')}><i className="fas fa-database me-2"></i>Database</button>
                        {hasRankPermissionsAccess && (
                            <button className={`nav-link ${selectedSection === 'rankPermissions' ? 'active' : ''}`} onClick={() => setSelectedSection('rankPermissions')}><i className="fas fa-user-shield me-2"></i>Rank Permissions</button>
                        )}
                    </div>
                    <div className="sidebar-footer">
                        {desktopNotificationPermission === 'default' && (
                            <Button variant="outline-info" size="sm" onClick={handleEnableDesktopNotifications} className="w-100 mb-2" title="Click to allow desktop notifications for status updates">
                                <i className="fas fa-bell"></i> Enable Notifications
                            </Button>
                        )}
                        <Button variant="warning" onClick={handleLogout} className="w-100">
                            <i className="fas fa-sign-out-alt me-2"></i>
                            Sign Out {(() => {
                                if (gtaWorldUser) return '(GTA World)';
                                if (isGoogleAdmin) return '(Google Admin)';
                                return '(Firebase)';
                            })()}
                        </Button>
                                    <Button type="button" variant="secondary" className="changelog-button" onClick={() => navigate('/')} title="Go to Home" > <i className="fas fa-home"></i>Home</Button>

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
                    {selectedSection === 'lockdown' && (
                        <div className="card">
                            <div className="card-header">Site Lockdown</div>
                            <div className="card-body">
                                {hasLockdownAccess ? (
                                    <>
                                        <div className="form-check form-switch mb-3">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        role="switch"
                                        id="lockdownSwitch"
                                        checked={lockdownConfig.enabled}
                                        onChange={(e) => setLockdownConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                                    />
                                    <label className="form-check-label" htmlFor="lockdownSwitch">
                                        Enable Site Lockdown
                                    </label>
                                </div>
                                <div className="form-group mb-3">
                                    <label>Notification Message</label>
                                    <input
                                        type="text"
                                        value={lockdownConfig.notification}
                                        onChange={(e) => setLockdownConfig(prev => ({ ...prev, notification: e.target.value }))}
                                        placeholder="e.g., The site is currently undergoing maintenance."
                                        className="form-control"
                                    />
                                </div>
                                <div className="form-group mb-3">
                                    <label>Popup Dialog Text</label>
                                    <textarea
                                        value={lockdownConfig.dialog}
                                        onChange={(e) => setLockdownConfig(prev => ({ ...prev, dialog: e.target.value }))}
                                        placeholder="e.g., The BBCode generator is temporarily disabled."
                                        className="form-control"
                                        rows="3"
                                    ></textarea>
                                </div>
                                <div className="form-group mb-3">
                                    <label>Affected Deployments</label>
                                    <div>
                                        {['all', 'phmc-tools', 'github-pages', 'local'].map((deployment) => (
                                            <div className="form-check form-check-inline" key={deployment}>
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    id={`deployment-${deployment}`}
                                                    value={deployment}
                                                    checked={lockdownConfig.affectedDeployments.includes(deployment)}
                                                    onChange={(e) => {
                                                        const { value, checked } = e.target;
                                                        setLockdownConfig((prev) => {
                                                            let newDeployments;
                                                            if (checked) {
                                                                newDeployments = [...prev.affectedDeployments, value];
                                                            } else {
                                                                newDeployments = prev.affectedDeployments.filter((d) => d !== value);
                                                            }
                                                            return { ...prev, affectedDeployments: newDeployments };
                                                        });
                                                    }}
                                                />
                                                <label className="form-check-label" htmlFor={`deployment-${deployment}`}>
                                                    {deployment.charAt(0).toUpperCase() + deployment.slice(1)}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                        <Button variant="primary" onClick={handleUpdateLockdownStatus} disabled={isUpdatingDb}>
                                            {isUpdatingDb ? <Spinner as="span" animation="border" size="sm" /> : "Update Lockdown Status"}
                                        </Button>
                                    </>
                                ) : (
                                    <div className="alert alert-danger">
                                        <i className="fas fa-exclamation-triangle me-2"></i>
                                        <strong>Access Denied:</strong> Your current faction rank ({factionData?.scriptRank || 'N/A'}) does not have permission to manage site lockdown.
                                        <br />
                                        <small>Required: Script Rank 14 or higher, or Google Admin access</small>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {selectedSection === 'recruitment' && (
                        <div className="card">
                            <div className="card-header">Recruitment Management</div>
                            <div className="card-body">
                                <div className="form-group mb-3">
                                    <label htmlFor="selectRecruitmentCategory">Select Recruitment Option</label>
                                    <select id="selectRecruitmentCategory" value={selectedRecruitmentCategory} onChange={(e) => setSelectedRecruitmentCategory(e.target.value)} className="form-select">
                                        <option value="">-- Select an Option --</option>
                                        {Object.entries(recruitmentCategories).map(([key, cat]) => (<option key={key} value={key}>{cat.displayName}</option>))}
                                    </select>
                                </div>

                                {selectedRecruitmentCategory && recruitmentCategories[selectedRecruitmentCategory] ? (
                                    <>
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <h5>Manage {recruitmentCategories[selectedRecruitmentCategory]?.displayName}</h5>
                                            <Button variant="success" size="sm" onClick={handleAddRoleClick}>
                                                <i className="fas fa-plus-circle"></i> Add Role
                                            </Button>
                                        </div>
                                        {isLoadingRecruitmentData ? (<Spinner animation="border" />) : Object.keys(currentRecruitmentData).length > 0 ? (
                                            <div className="list-group mb-3">
                                                {Object.entries(currentRecruitmentData).map(([key, position]) => (
                                                    <div key={key} className="list-group-item d-flex justify-content-between align-items-center">
                                                        <div>
                                                            {position.displayName || position.name || key}: {}
                                                            <strong style={{ color: position.status === "OPEN" ? 'green' : 'red' }}>{position.status || "N/A"}</strong>
                                                            <br />
                                                            <small className="text-muted">DB Key: {key}</small>
                                                        </div>
                                                        <div className="d-flex gap-2">
                                                            <Button variant="outline-warning" size="sm" onClick={() => handleRenameRoleKeyClick(key, position)} disabled={isUpdatingDb} title={`Rename Database Key for ${position.displayName || position.name || key}`}>
                                                                <i className="fas fa-key"></i> Rename Key
                                                            </Button>
                                                            <Button variant="outline-secondary" size="sm" onClick={() => handleEditRoleClick(key, position)} disabled={isUpdatingDb} title={`Edit ${position.displayName || position.name || key}`}>
                                                                <i className="fas fa-edit"></i> Edit
                                                            </Button>
                                                            <Button variant={position.status === "OPEN" ? "outline-danger" : "outline-success"} size="sm" onClick={() => handleTogglePositionStatus(key, position.status)} disabled={isUpdatingDb} style={{ minWidth: '120px' }}>
                                                                {isUpdatingDb && <Spinner as="span" animation="border" size="sm" />}
                                                                {position.status === "OPEN" ? "Set CLOSED" : "Set OPEN"}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (<p>No positions loaded for {recruitmentCategories[selectedRecruitmentCategory]?.displayName}.</p>)}
                                    </>
                                ) : (<p>Select a recruitment category to manage positions.</p>)}
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
                    {selectedSection === 'users' && (
                        <div className="card">
                            <div className="card-header">User Management</div>
                            <div className="card-body">
                                {hasUsersAccess ? (
                                    <>
                                        <Button variant="primary" onClick={() => setShowUserManagementModal(true)}>
                                            <i className="fas fa-users-cog"></i> Manage Users
                                        </Button>
                                        <UserStats currentUser={currentUser} />
                                    </>
                                ) : (
                                    <div className="alert alert-danger">
                                        <i className="fas fa-exclamation-triangle me-2"></i>
                                        <strong>Access Denied:</strong> Your current faction rank ({factionData?.scriptRank || 'N/A'}) does not have permission to manage users.
                                        <br />
                                        <small>Required: Script Rank 14 or higher, or Google Admin access</small>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {selectedSection === 'webhooks' && (
                        <div className="card">
                            <div className="card-header">
                                <div className="d-flex justify-content-between align-items-center">
                                    <h5 className="mb-0">Webhook Management</h5>
                                                                        <h5 className="mb-0">This area is VERY Dangerous - Don't use </h5>

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
                                                            <strong>Connected as:</strong> {(() => {
                                                                if (gtaWorldUser?.isFactionMember && gtaWorldUser?.faction) {
                                                                    const characterName = (gtaWorldUser.faction.firstname && gtaWorldUser.faction.lastname) ? 
                                                                        `${gtaWorldUser.faction.firstname} ${gtaWorldUser.faction.lastname}` : 
                                                                        gtaWorldUser.faction.characterName;
                                                                    return characterName ? `${characterName} (${gtaWorldUser.username})` : gtaWorldUser.username;
                                                                }
                                                                return gtaWorldUser?.username || gtaWorldUser?.name || currentUser?.email || 'Unknown';
                                                            })()}
                                                            <br />
                                                            <small className="text-muted">
                                                                User ID: {gtaWorldUser?.id || currentUser?.uid} | 
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
                                            variant="warning" 
                                            size="sm"
                                            onClick={handleRunDiagnostics}
                                            disabled={isRunningDiagnostics || !hasAdminAccess}
                                            title={hasAdminAccess ? "Run comprehensive OAuth diagnostics" : "Requires admin access permission"}
                                        >
                                            {isRunningDiagnostics ? (
                                                <Spinner as="span" animation="border" size="sm" />
                                            ) : (
                                                <i className="fas fa-stethoscope me-2"></i>
                                            )}
                                            Run Full Diagnostics
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
                                <div className="mb-3">
                                    <Button 
                                        variant="secondary" 
                                        onClick={() => setShowCctvWebhookModal(true)} 
                                        title={hasWebhookAccess ? "Send a test webhook simulating a CCTV request" : "Requires webhook management permission"}
                                        disabled={!hasWebhookAccess}
                                    >
                                        <i className="fas fa-video me-2"></i>
                                        CCTV Request Test
                                    </Button>
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
                                        <DatabaseEditor showNotification={showInAppNotification} />
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
                    {selectedSection === 'rankPermissions' && (
                        <div className="card">
                            <div className="card-header">
                                <i className="fas fa-user-shield me-2"></i>
                                Rank Permissions Management
                            </div>
                            <div className="card-body">
                                {hasRankPermissionsAccess ? (
                                    <div>
                                        <div className="alert alert-info">
                                            <i className="fas fa-info-circle me-2"></i>
                                            <strong>Rank Permissions Editor</strong>
                                            <p className="mb-0 mt-2">Configure which ranks have access to different admin panel sections.</p>
                                        </div>
                                        
                                        <div className="row">
                                            <div className="col-md-6">
                                                <h6>Current Permission Levels</h6>
                                                <div className="list-group">
                                                    <div className="list-group-item">
                                                        <strong>Faction Data Upload:</strong> Rank 10+
                                                    </div>
                                                    <div className="list-group-item">
                                                        <strong>Database Editor:</strong> Rank 12+
                                                    </div>
                                                    <div className="list-group-item">
                                                        <strong>Bingo Management:</strong> Rank 14+
                                                    </div>
                                                    <div className="list-group-item">
                                                        <strong>User Management:</strong> Rank 14+
                                                    </div>
                                                    <div className="list-group-item">
                                                        <strong>Rank Permissions:</strong> Rank 15+
                                                    </div>
                                                    <div className="list-group-item">
                                                        <strong>Google Admin Override:</strong> Email Login Only
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <h6>Permission Configuration</h6>
                                                <div className="alert alert-warning">
                                                    <i className="fas fa-construction me-2"></i>
                                                    <strong>Coming Soon</strong>
                                                    <p className="mb-0 mt-2">Dynamic permission configuration interface will be available in a future update.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="alert alert-danger">
                                        <i className="fas fa-exclamation-triangle me-2"></i>
                                        <strong>Access Denied:</strong> Your current faction rank ({factionData?.scriptRank || 'N/A'}) does not have permission to manage rank permissions.
                                        <br />
                                        <small>Required: Script Rank 15 or higher, or Google Admin access</small>
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