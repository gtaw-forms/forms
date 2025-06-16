// src/components/Admin/AdminAuthAndActions.js
import React, { useState, useEffect, useCallback } from 'react';
import { Form as BootstrapForm, Button, Spinner, ListGroup } from 'react-bootstrap';
import { auth, database } from '../../firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { ref, get, update } from "firebase/database";
import AddRoleModal from './RoleModal';
import * as Sentry from "@sentry/react"; // For error reporting

const recruitmentCategories = {
    physician: { displayName: "Physician Recruitment", path: 'selectOptions/physicianRecruitmentDetails' },
    psych: { displayName: "Psychologist/Psychiatrist Recruitment", path: 'selectOptions/psychPositionDetailsData' },
    admin: { displayName: "Admin Recruitment", path: 'selectOptions/adminPositionDetailsData' },
    nursing: { displayName: "Nursing Recruitment", path: 'selectOptions/nursePositionDetailsData' },
    ems: { displayName: "EMS Recruitment", path: 'selectOptions/emsPositionDetailsData' },
    coroner: { displayName: "Coroner Recruitment", path: 'selectOptions/coronerPositionDetailsData' },
    saaa: { displayName: "SAAA Recruitment", path: 'selectOptions/saaaPositionDetailsData' },
};

// Helper function to request notification permission
const requestNotificationPermission = async () => {
    console.log("[Desktop Notify] Requesting permission...");
    if (!("Notification" in window)) {
        console.warn("[Desktop Notify] This browser does not support desktop notification.");
        return false;
    } else if (Notification.permission === "granted") {
        console.log("[Desktop Notify] Permission already granted.");
        return true;
    } else if (Notification.permission !== "denied") { // 'default' or not set
        console.log("[Desktop Notify] Permission is default, prompting user.");
        const permission = await Notification.requestPermission();
        console.log("[Desktop Notify] User responded with permission:", permission);
        return permission === "granted";
    }
    // If permission is 'denied'
    console.log("[Desktop Notify] Permission is denied.");
    return false;
};

// Helper function to show a desktop notification
const showDesktopNotification = (title, options) => {
    console.log("[Desktop Notify] Attempting to show notification. Current permission:", Notification.permission);
    if (Notification.permission === "granted") {
        try {
            const notification = new Notification(title, options);
            console.log("[Desktop Notify] Notification created:", notification);
            notification.onclick = () => {
                console.log("[Desktop Notify] Notification clicked.");
                window.focus();
                notification.close();
            };
            notification.onerror = (err) => {
                console.error("[Desktop Notify] Error displaying notification:", err);
            };
            notification.onshow = () => {
                console.log("[Desktop Notify] Notification shown successfully.");
            };
        } catch (error) {
            console.error("[Desktop Notify] Error creating Notification object:", error);
        }
    } else {
        console.warn("[Desktop Notify] Permission not granted, cannot show notification.");
    }
};

// Helper function to send admin action logs to Discord
const sendAdminActionWebhook = async (adminEmail, action, details, categoryName = null) => {
    const webhookURL = process.env.REACT_APP_ADMIN_ACTION_DISCORD_WEBHOOK_URL || process.env.REACT_APP_DISCORD_WEBHOOK_URL;
        console.log('[AdminAuthAndActions] sendAdminActionWebhook called. URL used:', webhookURL); // Log 8
    if (!webhookURL) {
        console.warn("Admin action webhook URL not configured. Skipping log.");
        Sentry.captureMessage("Admin Action Webhook URL not configured", "warning");
        return;
    }

    const embed = {
        title: "Admin Panel Action Logged",
        color: 0xFFA500, // Orange color for admin actions
        fields: [
            { name: "Admin User", value: adminEmail || "Unknown", inline: true },
            { name: "Action Taken", value: action || "Unknown Action", inline: true },
            ...(categoryName ? [{ name: "Category", value: categoryName, inline: true }] : []),
            { name: "Details", value: `\`\`\`\n${details.substring(0,1000)}\n\`\`\``, inline: false },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "PHMC Forms - Admin Panel" }
    };

    try {
        const response = await fetch(webhookURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        });
        if (!response.ok) {
            console.error(`Failed to send admin action webhook. Status: ${response.status}`);
            Sentry.captureMessage(`Admin Action Discord webhook failed: ${response.status}`, "error");
        } else {
            console.log(`Admin action logged to Discord: ${action}`);
        }
    } catch (error) {
        console.error('Error sending admin action webhook:', error);
        Sentry.captureException(error, { extra: { context: 'Admin Action Webhook Submission' } });
    }
};


const AdminAuthAndActions = ({ formData, setFormData, showNotification: showInAppNotification }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);

    const [selectedRecruitmentCategory, setSelectedRecruitmentCategory] = useState('');
    const [currentRecruitmentData, setCurrentRecruitmentData] = useState({});
    const [isLoadingRecruitmentData, setIsLoadingRecruitmentData] = useState(false);
    const [isUpdatingDb, setIsUpdatingDb] = useState(false);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [roleToEdit, setRoleToEdit] = useState(null); // State to hold data of role being edited

    const [desktopNotificationPermission, setDesktopNotificationPermission] = useState(Notification.permission);

    useEffect(() => {
        const updatePermissionStatus = () => {
            console.log("[Desktop Notify] Permission status changed to:", Notification.permission);
            setDesktopNotificationPermission(Notification.permission);
        };

        if ("permissions" in navigator && typeof navigator.permissions.query === "function") {
            navigator.permissions.query({ name: 'notifications' }).then(function (permissionStatus) {
                console.log("[Desktop Notify] Initial permission status (via query):", permissionStatus.state);
                setDesktopNotificationPermission(permissionStatus.state);
                permissionStatus.onchange = updatePermissionStatus;
            }).catch(err => {
                console.warn("[Desktop Notify] Error querying notification permissions, falling back to Notification.permission:", err);
                setDesktopNotificationPermission(Notification.permission); // Fallback
            });
        } else {
            console.log("[Desktop Notify] navigator.permissions.query not supported, using Notification.permission directly. Initial status:", Notification.permission);
            setDesktopNotificationPermission(Notification.permission);
        }

        return () => {
            if ("permissions" in navigator && typeof navigator.permissions.query === "function") {
                navigator.permissions.query({ name: 'notifications' }).then(function (permissionStatus) {
                    permissionStatus.onchange = null;
                }).catch(() => { /*ignore*/ });
            }
        };
    }, []);


    const fetchRecruitmentDataForCategory = useCallback(async (categoryKey) => {
        if (!categoryKey || !recruitmentCategories[categoryKey]) {
            setCurrentRecruitmentData({});
            setFormData(prev => ({ ...prev, adminDisplayData: null, adminSelectedCategoryName: categoryKey ? "Invalid Category" : null }));
            if (categoryKey && showInAppNotification) showInAppNotification("Invalid recruitment category selected.", "error");
            return;
        }
        setIsLoadingRecruitmentData(true);
        const categoryConfig = recruitmentCategories[categoryKey];
        try {
            const dataRef = ref(database, categoryConfig.path);
            const snapshot = await get(dataRef);
            if (snapshot.exists()) {
                const data = snapshot.val();
                setCurrentRecruitmentData(data);
                setFormData(prev => ({ ...prev, adminDisplayData: data, adminSelectedCategoryName: categoryConfig.displayName }));
            } else {
                setCurrentRecruitmentData({});
                setFormData(prev => ({ ...prev, adminDisplayData: null, adminSelectedCategoryName: categoryConfig.displayName }));
                if (showInAppNotification) showInAppNotification(`No data found for ${categoryConfig.displayName}.`, "warning");
            }
        } catch (dbError) {
            console.error(`Error fetching data for ${categoryConfig.displayName}:`, dbError);
            if (showInAppNotification) showInAppNotification(`Failed to load data for ${categoryConfig.displayName}.`, "error");
            setCurrentRecruitmentData({});
            setFormData(prev => ({ ...prev, adminDisplayData: null, adminSelectedCategoryName: categoryConfig.displayName }));
        }
        setIsLoadingRecruitmentData(false);
    }, [setFormData, showInAppNotification]);

    useEffect(() => {
        setIsLoadingAuth(true);
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
                setFormData(prev => ({ ...prev, isAdminAuthenticated: true, adminUserEmail: user.email, adminDisplayData: null, adminSelectedCategoryName: null }));
            } else {
                setCurrentUser(null);
                setFormData(prev => ({ ...prev, isAdminAuthenticated: false, adminUserEmail: null, adminDisplayData: null, adminSelectedCategoryName: null }));
                setCurrentRecruitmentData({});
                setSelectedRecruitmentCategory('');
            }
            setIsLoadingAuth(false);
        });
        return () => unsubscribe();
    }, [setFormData]);

    useEffect(() => {
        if (currentUser && selectedRecruitmentCategory && recruitmentCategories[selectedRecruitmentCategory]) {
            fetchRecruitmentDataForCategory(selectedRecruitmentCategory);
        } else if (currentUser && !selectedRecruitmentCategory) {
            setCurrentRecruitmentData({});
            setFormData(prev => ({ ...prev, adminDisplayData: null, adminSelectedCategoryName: null }));
        }
    }, [currentUser, selectedRecruitmentCategory, fetchRecruitmentDataForCategory, setFormData]);

    const handleLoginAttempt = async () => {
        setError('');
        setIsLoadingAuth(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setError(err.message || "Failed to login.");
            setIsLoadingAuth(false);
        }
    };

    const handlePasswordKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleLoginAttempt();
        }
    };

    const handleLogout = async () => {
        setError('');
        try {
            await signOut(auth);
            setEmail('');
            setPassword('');
        } catch (err) {
            setError(err.message || "Failed to logout.");
        }
    };

    const handleTogglePositionStatus = async (positionKey, currentStatus) => {
        if (!currentUser || !selectedRecruitmentCategory || !recruitmentCategories[selectedRecruitmentCategory]) return;

        const positionDetails = currentRecruitmentData[positionKey];
        if (!positionDetails) {
            console.error("Position details not found for key:", positionKey);
            if (showInAppNotification) showInAppNotification("Error: Position details missing.", "error");
            return;
        }

        setIsUpdatingDb(true);
        const newStatus = currentStatus === "OPEN" ? "CLOSED" : "OPEN";
        const categoryConfig = recruitmentCategories[selectedRecruitmentCategory];
        const positionStatusPath = `${categoryConfig.path}/${positionKey}/status`;

        try {
            await update(ref(database), { [positionStatusPath]: newStatus });
            const successMessage = `${positionDetails.displayName || positionDetails.name || positionKey} status updated to ${newStatus} for ${categoryConfig.displayName}.`;
            if (showInAppNotification) showInAppNotification(successMessage, "check-circle");

            // Log action to Discord
            if (currentUser?.email) {
                sendAdminActionWebhook(
                    currentUser.email,
                    "Toggled Recruitment Status",
                    `Position: ${positionDetails.displayName || positionDetails.name || positionKey}\nNew Status: ${newStatus}`,
                    categoryConfig.displayName
                );
            }

            console.log("[Desktop Notify] Checking permission for status update notification:", desktopNotificationPermission);
            if (desktopNotificationPermission === "granted") {
                showDesktopNotification(`Recruitment Status Updated: ${categoryConfig.displayName}`, {
                    body: `${positionDetails.displayName || positionDetails.name || positionKey} is now ${newStatus}.`,
                    icon: '/phmc512.png',
                    tag: `status-update-${selectedRecruitmentCategory}-${positionKey}`
                });
            }
            fetchRecruitmentDataForCategory(selectedRecruitmentCategory);
        } catch (dbError) {
            if (showInAppNotification) showInAppNotification(`Failed to update status for ${positionKey}.`, "error");
        }
        setIsUpdatingDb(false);
    };

    const handleRoleSaved = (savedRoleData, actionType) => { // Receive savedRoleData and actionType
                console.log('[AdminAuthAndActions] handleRoleSaved called. Action:', actionType, 'Data:', savedRoleData); // Log 6
        if (selectedRecruitmentCategory) {
            fetchRecruitmentDataForCategory(selectedRecruitmentCategory);
        }
        // Log action to Discord
        if (currentUser?.email && savedRoleData) {
            const categoryConfig = recruitmentCategories[selectedRecruitmentCategory];
            const action = actionType === 'edited' ? "Edited Role" : "Added New Role";
                        console.log('[AdminAuthAndActions] Preparing to send webhook for role save.'); // Log 7
            sendAdminActionWebhook(
                currentUser.email,
                action,
                `Role Name: ${savedRoleData.displayName || savedRoleData.originalKey}\nShort Code: ${savedRoleData.shortCode || 'N/A'}\nStatus: ${savedRoleData.status || 'N/A'}\nKey: ${savedRoleData.originalKey}`,
                categoryConfig?.displayName || "Unknown Category"
            );

            // Trigger desktop notification for Add/Edit Role
            console.log(`[Desktop Notify] Checking permission for ${actionType} Role notification:`, desktopNotificationPermission);
            if (desktopNotificationPermission === "granted" && savedRoleData?.displayName) {
                 const notificationTitle = actionType === 'edited' ? `Role Updated: ${categoryConfig?.displayName || 'Recruitment'}` : `New Role Added: ${categoryConfig?.displayName || 'Recruitment'}`;
                 const notificationBody = actionType === 'edited'
                    ? `Role "${savedRoleData.displayName}" (${savedRoleData.shortCode || 'N/A'}) has been updated.`
                    : `Role "${savedRoleData.displayName}" (${savedRoleData.shortCode || 'N/A'}) has been added.`;

                showDesktopNotification(notificationTitle, {
                    body: notificationBody,
                    icon: '/phmc512.png',
                    tag: `${actionType}-role-${selectedRecruitmentCategory}-${savedRoleData.originalKey}` // Unique tag
                });
            }
        }
        // MODIFIED: Clear roleToEdit state when modal is closed after saving
        setRoleToEdit(null);
    };


    // NEW: Function to open the modal for adding a role
    const handleAddRoleClick = () => {
        setRoleToEdit(null); // Ensure roleToEdit is null for adding
        setShowRoleModal(true);
    };

    // NEW: Function to open the modal for editing a role
    const handleEditRoleClick = (roleKey, roleData) => {
        // Store the role data including its key for editing
        setRoleToEdit({ ...roleData, originalKey: roleKey });
        setShowRoleModal(true);
    };
    const handleCloseRoleModal = () => {
        setShowRoleModal(false);
        setRoleToEdit(null); // Clear roleToEdit state when modal is closed
    };

    const handleEnableDesktopNotifications = async () => {
        console.log("[Desktop Notify] 'Enable Desktop Notifications' button clicked.");
        const granted = await requestNotificationPermission();
        const currentPermission = Notification.permission;
        console.log("[Desktop Notify] Permission after request:", currentPermission, "(Granted flag:", granted, ")");
        setDesktopNotificationPermission(currentPermission);

        if (currentUser?.email) {
            sendAdminActionWebhook(
                currentUser.email,
                "Desktop Notification Preference Changed",
                `Permission status: ${currentPermission}${granted ? ' (Granted by user)' : ' (Not granted or dismissed)'}`
            );
        }

        if (granted) {
            if (showInAppNotification) showInAppNotification("Desktop notifications enabled for this site! Please ensure your OS settings also allow notifications from your browser.", "check-circle", 7000);
            showDesktopNotification("PHMC Forms: Notifications Enabled", {
                body: "You will now receive desktop notifications for important admin actions. Ensure your OS allows browser notifications.",
                icon: '/phmc512.png'
            });
        } else {
            if (currentPermission === 'denied') {
                if (showInAppNotification) showInAppNotification("Desktop notifications are blocked. Please enable them in your browser settings.", "warning");
            } else {
                if (showInAppNotification) showInAppNotification("Desktop notifications were not enabled.", "warning");
            }
        }
    };

    if (isLoadingAuth) {
        return <p>Verifying authentication...</p>;
    }

    if (!currentUser) {
        return (
            <div>
                <BootstrapForm.Group className="mb-3" controlId="adminAuthEmail">
                    <BootstrapForm.Label>Admin Email</BootstrapForm.Label>
                    <BootstrapForm.Control type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </BootstrapForm.Group>
                <BootstrapForm.Group className="mb-3" controlId="adminAuthPassword">
                    <BootstrapForm.Label>Admin Password</BootstrapForm.Label>
                    <BootstrapForm.Control
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={handlePasswordKeyDown}
                        required
                    />
                </BootstrapForm.Group>
                {error && <p className="text-danger">{error}</p>}
                <Button variant="primary" type="button" onClick={handleLoginAttempt}>
                    Login to Admin Panel
                </Button>
            </div>
        );
    }

    return (
        <div>
            <p>Logged in as: {currentUser.email}</p>
            {desktopNotificationPermission === 'default' && (
                <Button
                    variant="outline-info"
                    size="sm"
                    onClick={handleEnableDesktopNotifications}
                    className="mb-2 d-block mx-auto"
                    title="Click to allow desktop notifications for status updates"
                >
                    <i className="fas fa-bell"></i> Enable Desktop Notifications
                </Button>
            )}
            {desktopNotificationPermission === 'denied' && (
                 <p className="text-warning small text-center mb-2">
                    Desktop notifications are blocked. Please enable them in your browser settings if desired.
                </p>
            )}
            <hr />
            <BootstrapForm.Group className="mb-3" controlId="selectRecruitmentCategory">
                <BootstrapForm.Label>Select Recruitment Option</BootstrapForm.Label>
                <BootstrapForm.Select
                    value={selectedRecruitmentCategory}
                    onChange={(e) => setSelectedRecruitmentCategory(e.target.value)}
                >
                    <option value="">-- Select an Option --</option>
                    {Object.entries(recruitmentCategories).map(([key, cat]) => (
                        <option key={key} value={key}>{cat.displayName}</option>
                    ))}
                </BootstrapForm.Select>
            </BootstrapForm.Group>

            {selectedRecruitmentCategory && recruitmentCategories[selectedRecruitmentCategory] ? (
                <>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <h5>Manage {recruitmentCategories[selectedRecruitmentCategory]?.displayName}</h5>
                        <Button
                            variant="success"
                            size="sm"
                            onClick={handleAddRoleClick} // MODIFIED: Use new handler
                        >
                            <i className="fas fa-plus-circle"></i> Add Role
                        </Button>
                    </div>
                    {isLoadingRecruitmentData ? (
                        <Spinner animation="border" />
                    ) : Object.keys(currentRecruitmentData).length > 0 ? (
                        <ListGroup variant="flush" className="mb-3">
                            {Object.entries(currentRecruitmentData).map(([key, position]) => (
                                <ListGroup.Item key={key} className="d-flex justify-content-between align-items-center">
                                    <div>
                                        {position.displayName || position.name || key}: {}
                                        <strong style={{color: position.status === "OPEN" ? 'green' : 'red'}}>
                                            {position.status || "N/A"}
                                        </strong>
                                    </div>
                                    {/* NEW: Button group for Edit and Toggle */}
                                    <div className="d-flex gap-2">
                                        <Button
                                            variant="outline-secondary"
                                            size="sm"
                                            onClick={() => handleEditRoleClick(key, position)} // NEW: Edit button handler
                                            disabled={isUpdatingDb}
                                            title={`Edit ${position.displayName || position.name || key}`}
                                        >
                                            <i className="fas fa-edit"></i> Edit
                                        </Button>
                                        <Button
                                            variant={position.status === "OPEN" ? "outline-danger" : "outline-success"}
                                            size="sm"
                                            onClick={() => handleTogglePositionStatus(key, position.status)}
                                            disabled={isUpdatingDb}
                                            style={{minWidth: '120px'}}
                                        >
                                            {isUpdatingDb && <Spinner as="span" animation="border" size="sm" />}
                                            {position.status === "OPEN" ? "Set CLOSED" : "Set OPEN"}
                                        </Button>
                                    </div>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    ) : (
                        <p>No positions loaded for {recruitmentCategories[selectedRecruitmentCategory]?.displayName}.</p>
                    )}
                </>
            ) : (
                <p>Please select a recruitment option from the dropdown to manage statuses or add roles.</p>
            )}
            <Button variant="warning" onClick={handleLogout} className="mt-3">Logout</Button>

            {selectedRecruitmentCategory && recruitmentCategories[selectedRecruitmentCategory] && (
                <AddRoleModal
                    show={showRoleModal}
                    onHide={handleCloseRoleModal} // MODIFIED: Use new handler
                    categoryKey={selectedRecruitmentCategory}
                    categoryConfig={recruitmentCategories[selectedRecruitmentCategory]}
                    showNotification={showInAppNotification}
                    onRoleSaved={handleRoleSaved} // MODIFIED: Use new handler
                    roleToEdit={roleToEdit} // NEW: Pass role data for editing
                />
            )}
        </div>
    );
};

export default AdminAuthAndActions;
