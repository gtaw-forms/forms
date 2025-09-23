import React from 'react';
import { Card, Nav, Tab, Container, Row, Col, Button, Spinner, Form as BootstrapForm, ListGroup } from 'react-bootstrap';
import './AdminDashboard.css';

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
    handleGtaWorldLogin
}) => {
    return (
        <Container fluid className="admin-dashboard-container">
            <Tab.Container id="admin-dashboard-tabs" defaultActiveKey="serviceStatus">
                <Row>
                    <Col sm={3} md={2} lg={2} className="sidebar">
                        <div className="sidebar-header">
                            <h5>Admin Panel</h5>
                            <p className="text-muted small">Logged in as: {currentUser.email}</p>
                        </div>
                        <Nav variant="pills" className="flex-column">
                            <Nav.Item>
                                <Nav.Link eventKey="serviceStatus"><i className="fas fa-server me-2"></i>Service Status</Nav.Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Nav.Link eventKey="recruitment"><i className="fas fa-user-plus me-2"></i>Recruitment</Nav.Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Nav.Link eventKey="bingo"><i className="fas fa-dice me-2"></i>Bingo</Nav.Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Nav.Link eventKey="users"><i className="fas fa-users-cog me-2"></i>Users</Nav.Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Nav.Link eventKey="webhooks"><i className="fas fa-bullhorn me-2"></i>Webhooks</Nav.Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Nav.Link eventKey="dev"><i className="fas fa-code me-2"></i>Developer</Nav.Link>
                            </Nav.Item>
                        </Nav>
                        <div className="sidebar-footer">
                            {desktopNotificationPermission === 'default' && (
                                <Button variant="outline-info" size="sm" onClick={handleEnableDesktopNotifications} className="w-100 mb-2" title="Click to allow desktop notifications for status updates">
                                    <i className="fas fa-bell"></i> Enable Notifications
                                </Button>
                            )}
                            <Button variant="warning" onClick={handleLogout} className="w-100">Logout</Button>
                        </div>
                    </Col>
                    <Col sm={9} md={10} lg={10} className="main-content">
                        <Tab.Content>
                            <Tab.Pane eventKey="serviceStatus">
                                <Card>
                                    <Card.Header>Service Status</Card.Header>
                                    <Card.Body>
                                        {isLoadingStatus ? (
                                            <Spinner animation="border" size="sm" />
                                        ) : (
                                            <>
                                                <BootstrapForm.Group className="mb-3">
                                                    <BootstrapForm.Label>Form Generator Status</BootstrapForm.Label>
                                                    <BootstrapForm.Control
                                                        type="text"
                                                        value={formGeneratorStatus}
                                                        onChange={(e) => setFormGeneratorStatus(e.target.value)}
                                                        placeholder="e.g., Fully Updated"
                                                    />
                                                </BootstrapForm.Group>
                                                <BootstrapForm.Group className="mb-3">
                                                    <BootstrapForm.Label>Alternative Form Generator Status</BootstrapForm.Label>
                                                    <BootstrapForm.Control
                                                        type="text"
                                                        value={alternativeFormGeneratorStatus}
                                                        onChange={(e) => setAlternativeFormGeneratorStatus(e.target.value)}
                                                        placeholder="e.g., Updates Delayed"
                                                    />
                                                </BootstrapForm.Group>
                                                <BootstrapForm.Group className="mb-3">
                                                    <BootstrapForm.Label>Localhost/Staging Status</BootstrapForm.Label>
                                                    <BootstrapForm.Control
                                                        type="text"
                                                        value={localHostStatus}
                                                        onChange={(e) => setLocalHostStatus(e.target.value)}
                                                        placeholder="e.g., Under Development"
                                                    />
                                                </BootstrapForm.Group>
                                            </>
                                        )}
                                        <Button variant="primary" onClick={handleUpdateServiceStatus} disabled={isUpdatingDb || isLoadingStatus}>
                                            {isUpdatingDb ? <Spinner as="span" animation="border" size="sm" /> : "Update Statuses"}
                                        </Button>
                                    </Card.Body>
                                </Card>
                            </Tab.Pane>
                            <Tab.Pane eventKey="recruitment">
                                <Card>
                                    <Card.Header>Recruitment Management</Card.Header>
                                    <Card.Body>
                                        <BootstrapForm.Group className="mb-3" controlId="selectRecruitmentCategory">
                                            <BootstrapForm.Label>Select Recruitment Option</BootstrapForm.Label>
                                            <BootstrapForm.Select value={selectedRecruitmentCategory} onChange={(e) => setSelectedRecruitmentCategory(e.target.value)}>
                                                <option value="">-- Select an Option --</option>
                                                {Object.entries(recruitmentCategories).map(([key, cat]) => (<option key={key} value={key}>{cat.displayName}</option>))}
                                            </BootstrapForm.Select>
                                        </BootstrapForm.Group>

                                        {selectedRecruitmentCategory && recruitmentCategories[selectedRecruitmentCategory] ? (
                                            <>
                                                <div className="d-flex justify-content-between align-items-center mb-2">
                                                    <h5>Manage {recruitmentCategories[selectedRecruitmentCategory]?.displayName}</h5>
                                                    <Button variant="success" size="sm" onClick={handleAddRoleClick}>
                                                        <i className="fas fa-plus-circle"></i> Add Role
                                                    </Button>
                                                </div>
                                                {isLoadingRecruitmentData ? (<Spinner animation="border" />) : Object.keys(currentRecruitmentData).length > 0 ? (
                                                    <ListGroup variant="flush" className="mb-3">
                                                        {Object.entries(currentRecruitmentData).map(([key, position]) => (
                                                            <ListGroup.Item key={key} className="d-flex justify-content-between align-items-center">
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
                                                            </ListGroup.Item>
                                                        ))}
                                                    </ListGroup>
                                                ) : (<p>No positions loaded for {recruitmentCategories[selectedRecruitmentCategory]?.displayName}.</p>)}
                                            </>
                                        ) : (<p>Select a recruitment category to manage positions.</p>)}
                                    </Card.Body>
                                </Card>
                            </Tab.Pane>
                            <Tab.Pane eventKey="bingo">
                                <Card>
                                    <Card.Header>Bingo Management</Card.Header>
                                    <Card.Body>
                                        <BootstrapForm.Group className="mb-3">
                                            <BootstrapForm.Label>Select Bingo Type:</BootstrapForm.Label>
                                            <BootstrapForm.Select
                                                value={selectedAdminBingoType}
                                                onChange={(e) => setSelectedAdminBingoType(e.target.value)}
                                                disabled={isUpdatingDb}
                                            >
                                                {BINGO_TYPES.map(type => (
                                                    <option key={type.id} value={type.id}>{type.name}</option>
                                                ))}
                                            </BootstrapForm.Select>
                                        </BootstrapForm.Group>
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
                                    </Card.Body>
                                </Card>
                            </Tab.Pane>
                            <Tab.Pane eventKey="users">
                                <Card>
                                    <Card.Header>User Management</Card.Header>
                                    <Card.Body>
                                        <Button variant="primary" onClick={() => setShowUserManagementModal(true)}>
                                            <i className="fas fa-users-cog"></i> Manage Users
                                        </Button>
                                    </Card.Body>
                                </Card>
                            </Tab.Pane>
                            <Tab.Pane eventKey="webhooks">
                                <Card>
                                    <Card.Header>Webhook Tools</Card.Header>
                                    <Card.Body>
                                        <Button variant="info" onClick={handleOpenAdminCustomWebhookModal} className="me-2">
                                            <i className="fas fa-bullhorn"></i> PHMC WEBHOOK
                                        </Button>
                                        <Button variant="dark" onClick={handleOpenCoronerWebhookModal} className="me-2">
                                            <i className="fas fa-skull-crossbones"></i> CORONER WEBHOOK
                                        </Button>
                                        <Button variant="secondary" onClick={handleOpenDevWebhookModal} className="me-2">
                                            <i className="fas fa-code"></i> DEV WEBHOOK
                                        </Button>
                                    </Card.Body>
                                </Card>
                            </Tab.Pane>
                            <Tab.Pane eventKey="dev">
                                <Card>
                                    <Card.Header>Developer Tools</Card.Header>
                                    <Card.Body>
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
                                        <div className="mb-3">
                                            <Button onClick={() => setShowMarkdownModal(true)}>Open Markdown Converter</Button>
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
                                    </Card.Body>
                                </Card>
                            </Tab.Pane>
                        </Tab.Content>
                    </Col>
                </Row>
            </Tab.Container>
        </Container>
    );
};

export default AdminDashboard;