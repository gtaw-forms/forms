import React, { useState } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import './AdminDashboard.css';
import DatabaseEditor from './DatabaseEditor';
import UserStats from './UserStats';
import WebhookLogs from './WebhookLogs';

const AdminDashboard = ({
    currentUser,
    desktopNotificationPermission,
    handleEnableDesktopNotifications,
    isLoadingStatus,
    formGeneratorStatus,
    setFormGeneratorStatus,
    alternativeFormGeneratorStatus,
    setAlternativeFormGeneratorStatus,
    localHostStatus,
    setLocalHostStatus,
    handleUpdateServiceStatus,
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
    handleOpenAdminCustomWebhookModal,
    handleOpenCoronerWebhookModal,
    handleOpenDevWebhookModal,
    setShowCctvWebhookModal,
    setShowMarkdownModal,
    handleLogout,
    Sentry,
    showInAppNotification,
    setShowOAuthTokenExchangeModal,
    setShowUserDataExchangeModal,
    handleGtaWorldLogin,
    lockdownConfig,
    setLockdownConfig,
    handleUpdateLockdownStatus
}) => {

    const [selectedSection, setSelectedSection] = useState('serviceStatus');
    const navigate = useNavigate();

    return (
        <div className="admin-dashboard-container">
            <div className="admin-dashboard-layout">
                <div className="sidebar">
                    <div className="sidebar-header">
                        <h5>Admin Panel</h5>
                        <p>Logged in as: {currentUser.email}</p>
                    </div>
                    <div className="nav-pills-flex-column">
                        <button className={`nav-link ${selectedSection === 'serviceStatus' ? 'active' : ''}`} onClick={() => setSelectedSection('serviceStatus')}><i className="fas fa-server me-2"></i>Service Status</button>
                        <button className={`nav-link ${selectedSection === 'lockdown' ? 'active' : ''}`} onClick={() => setSelectedSection('lockdown')}><i className="fas fa-lock me-2"></i>Lockdown</button>
                        <button className={`nav-link ${selectedSection === 'recruitment' ? 'active' : ''}`} onClick={() => setSelectedSection('recruitment')}><i className="fas fa-user-plus me-2"></i>Recruitment</button>
                        <button className={`nav-link ${selectedSection === 'bingo' ? 'active' : ''}`} onClick={() => setSelectedSection('bingo')}><i className="fas fa-dice me-2"></i>Bingo</button>
                        <button className={`nav-link ${selectedSection === 'users' ? 'active' : ''}`} onClick={() => setSelectedSection('users')}><i className="fas fa-users-cog me-2"></i>Users</button>
                        <button className={`nav-link ${selectedSection === 'webhooks' ? 'active' : ''}`} onClick={() => setSelectedSection('webhooks')}><i className="fas fa-bullhorn me-2"></i>Webhooks</button>
                        <button className={`nav-link ${selectedSection === 'dev' ? 'active' : ''}`} onClick={() => setSelectedSection('dev')}><i className="fas fa-code me-2"></i>Developer</button>
                        <button className={`nav-link ${selectedSection === 'database' ? 'active' : ''}`} onClick={() => setSelectedSection('database')}><i className="fas fa-database me-2"></i>Database</button>
                    </div>
                    <div className="sidebar-footer">
                        {desktopNotificationPermission === 'default' && (
                            <Button variant="outline-info" size="sm" onClick={handleEnableDesktopNotifications} className="w-100 mb-2" title="Click to allow desktop notifications for status updates">
                                <i className="fas fa-bell"></i> Enable Notifications
                            </Button>
                        )}
                        <Button variant="warning" onClick={handleLogout} className="w-100">Logout</Button>
                                    <Button type="button" variant="secondary" className="changelog-button" onClick={() => navigate('/')} title="Go to Home" > <i className="fas fa-home"></i>Home</Button>

                    </div>
                </div>
                <div className="main-content">
                    {selectedSection === 'serviceStatus' && (
                        <div className="card">
                            <div className="card-header">Service Status</div>
                            <div className="card-body">
                                {isLoadingStatus ? (
                                    <Spinner animation="border" size="sm" />
                                ) : (
                                    <>
                                        <div className="form-group mb-3">
                                            <label>Form Generator Status</label>
                                            <input
                                                type="text"
                                                value={formGeneratorStatus}
                                                onChange={(e) => setFormGeneratorStatus(e.target.value)}
                                                placeholder="e.g., Fully Updated"
                                                className="form-control"
                                            />
                                        </div>
                                        <div className="form-group mb-3">
                                            <label>Alternative Form Generator Status</label>
                                            <input
                                                type="text"
                                                value={alternativeFormGeneratorStatus}
                                                onChange={(e) => setAlternativeFormGeneratorStatus(e.target.value)}
                                                placeholder="e.g., Updates Delayed"
                                                className="form-control"
                                            />
                                        </div>
                                        <div className="form-group mb-3">
                                            <label>Localhost/Staging Status</label>
                                            <input
                                                type="text"
                                                value={localHostStatus}
                                                onChange={(e) => setLocalHostStatus(e.target.value)}
                                                placeholder="e.g., Under Development"
                                                className="form-control"
                                            />
                                        </div>
                                    </>
                                )}
                                <Button variant="primary" onClick={handleUpdateServiceStatus} disabled={isUpdatingDb || isLoadingStatus}>
                                    {isUpdatingDb ? <Spinner as="span" animation="border" size="sm" /> : "Update Statuses"}
                                </Button>
                            </div>
                        </div>
                    )}
                    {selectedSection === 'lockdown' && (
                        <div className="card">
                            <div className="card-header">Site Lockdown</div>
                            <div className="card-body">
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
                            </div>
                        </div>
                    )}
                    {selectedSection === 'users' && (
                        <div className="card">
                            <div className="card-header">User Management</div>
                            <div className="card-body">
                                <Button variant="primary" onClick={() => setShowUserManagementModal(true)}>
                                    <i className="fas fa-users-cog"></i> Manage Users
                                </Button>
                            </div>
                            <UserStats currentUser={currentUser} />
                        </div>
                    )}
                    {selectedSection === 'webhooks' && (
                        <div className="card">
                            <div className="card-header">Webhook Tools</div>
                            <div className="card-body">
                                <Button variant="info" onClick={handleOpenAdminCustomWebhookModal} className="me-2">
                                    <i className="fas fa-bullhorn"></i> PHMC WEBHOOK
                                </Button>
                                <Button variant="dark" onClick={handleOpenCoronerWebhookModal} className="me-2">
                                    <i className="fas fa-skull-crossbones"></i> CORONER WEBHOOK
                                </Button>
                                <Button variant="secondary" onClick={handleOpenDevWebhookModal} className="me-2">
                                    <i className="fas fa-code"></i> DEV WEBHOOK
                                </Button>
                            </div>
                            <WebhookLogs />
                        </div>
                    )}
                    {selectedSection === 'dev' && (
                        <div className="card">
                            <div className="card-header">Developer Tools</div>
                            <div className="card-body">
                                <div className="mb-3">
                                    <Button variant="primary" onClick={handleGtaWorldLogin}>
                                        <i className="fas fa-sign-in-alt me-2"></i>
                                        Login to GTA World
                                    </Button>
                                </div>
                                <div className="mb-3">
                                    <Button variant="info" onClick={() => setShowOAuthTokenExchangeModal(true)}>
                                        <i className="fas fa-exchange-alt me-2"></i>
                                        OAuth Token Exchange
                                    </Button>
                                    <Button variant="info" onClick={() => setShowUserDataExchangeModal(true)} className="ms-2">
                                        <i className="fas fa-user-secret me-2"></i>
                                        User Data Exchange
                                    </Button>
                                </div>
                                <div className="mb-3">
                                    <Button variant="secondary" onClick={() => setShowCctvWebhookModal(true)} title="Send a test webhook simulating a CCTV request.">
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
                            </div>
                        </div>
                    )}
                    {selectedSection === 'database' && (
                        <DatabaseEditor showNotification={showInAppNotification} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;