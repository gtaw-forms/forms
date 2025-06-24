// src/components/Admin/AdminAuthAndActions.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Form as BootstrapForm, Button, Spinner, ListGroup } from 'react-bootstrap';
import { auth, database } from '../../firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { ref, get, update } from "firebase/database";
import AddRoleModal from './RoleModal';
import RenameRoleKeyModal from './RenameRoleKeyModal';
import WebhookModal from '../WebhookModal';
import * as Sentry from "@sentry/react";

const recruitmentCategories = {
    physician: { displayName: "Physician Recruitment", path: 'selectOptions/physicianRecruitmentDetails' },
    psych: { displayName: "Psychologist/Psychiatrist Recruitment", path: 'selectOptions/psychPositionDetailsData' },
    admin: { displayName: "Admin Recruitment", path: 'selectOptions/adminPositionDetailsData' },
    nursing: { displayName: "Nursing Recruitment", path: 'selectOptions/nursePositionDetailsData' },
    ems: { displayName: "EMS Recruitment", path: 'selectOptions/emsPositionDetailsData' },
    coroner: { displayName: "Coroner Recruitment", path: 'selectOptions/coronerPositionDetailsData' },
    saaa: { displayName: "SAAA Recruitment", path: 'selectOptions/saaaPositionDetailsData' },
};

const requestNotificationPermission = async () => {
    console.log("[Desktop Notify] Requesting permission...");
    if (!("Notification" in window)) {
        console.warn("[Desktop Notify] This browser does not support desktop notification.");
        return false;
    } else if (Notification.permission === "granted") {
        console.log("[Desktop Notify] Permission already granted.");
        return true;
    } else if (Notification.permission !== "denied") {
        console.log("[Desktop Notify] Permission is default, prompting user.");
        const permission = await Notification.requestPermission();
        console.log("[Desktop Notify] User responded with permission:", permission);
        return permission === "granted";
    }
    console.log("[Desktop Notify] Permission is denied.");
    return false;
};

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

// Helper to get user agent and timezone
const getUserContext = () => {
    const userAgent = navigator.userAgent || "N/A";
    let timeZone = "N/A";
    try {
        timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
        console.warn("Could not determine user timezone:", e);
    }
    return { userAgent, timeZone };
};

const sendAdminActionWebhook = async (adminEmail, action, details, categoryName = null, userAgent = "N/A", userTimezone = "N/A") => {
    const webhookURL = process.env.REACT_APP_ADMIN_ACTION_DISCORD_WEBHOOK_URL || process.env.REACT_APP_DISCORD_WEBHOOK_URL;
    console.log('[AdminAuthAndActions] sendAdminActionWebhook called. URL used:', webhookURL);
    if (!webhookURL) {
        console.warn("Admin action webhook URL not configured. Skipping log.");
        Sentry.captureMessage("Admin Action Webhook URL not configured", "warning");
        return;
    }
    const embed = {
        title: "Admin Panel Action Logged",
        color: 0xFFA500,
        fields: [
            { name: "Admin User", value: adminEmail || "Unknown", inline: true },
            { name: "Action Taken", value: action || "Unknown Action", inline: true },
            ...(categoryName ? [{ name: "Category", value: categoryName, inline: true }] : []),
            { name: "Details", value: `\`\`\`\n${details.substring(0,1000)}\n\`\`\``, inline: false },
            { name: "User Agent", value: `\`\`\`${userAgent.substring(0, 250)}\`\`\``, inline: false }, // Truncate for Discord field limit
            { name: "Timezone", value: userTimezone, inline: true },
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


const AdminAuthAndActions = ({ formData, setFormData, showNotification: showInAppNotification, commitInfo }) => {
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
    const [roleToEdit, setRoleToEdit] = useState(null);

    const [showRenameKeyModal, setShowRenameKeyModal] = useState(false);
    const [roleToRenameKeyDetails, setRoleToRenameKeyDetails] = useState(null);

    const [desktopNotificationPermission, setDesktopNotificationPermission] = useState(Notification.permission);

    const [showAdminCustomWebhookModal, setShowAdminCustomWebhookModal] = useState(false);
    const [adminCustomWebhookTitle, setAdminCustomWebhookTitle] = useState('');
    const [adminCustomWebhookMessage, setAdminCustomWebhookMessage] = useState('');
    const [showCoronerWebhookModal, setShowCoronerWebhookModal] = useState(false);
    const [coronerWebhookTitle, setCoronerWebhookTitle] = useState('');
    const [coronerWebhookMessage, setCoronerWebhookMessage] = useState('');

    const prevUserUidRef = useRef(null);


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
                setDesktopNotificationPermission(Notification.permission);
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
            if (showInAppNotification) showInAppNotification("Invalid recruitment category selected.", "error");
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
            const wasLoggedIn = prevUserUidRef.current !== null;
            const isLoggedIn = user !== null;
            const { userAgent, timeZone } = getUserContext(); // Capture user context

            if (isLoggedIn && !wasLoggedIn) {
                // User just logged in
                setCurrentUser(user);
                setFormData(prev => ({ ...prev, isAdminAuthenticated: true, adminUserEmail: user.email, adminDisplayData: null, adminSelectedCategoryName: null }));
                sendAdminActionWebhook(user.email, "Admin Login", "User successfully logged in to the Admin Panel.", null, userAgent, timeZone);
                if (showInAppNotification) showInAppNotification(`Welcome, ${user.email}!`, "check-circle");
            } else if (!isLoggedIn && wasLoggedIn) {
                // User just logged out
                const loggedOutEmail = currentUser?.email || "Unknown User";
                setCurrentUser(null);
                setFormData(prev => ({ ...prev, isAdminAuthenticated: false, adminUserEmail: null, adminDisplayData: null, adminSelectedCategoryName: null }));
                setCurrentRecruitmentData({});
                setSelectedRecruitmentCategory('');
                sendAdminActionWebhook(loggedOutEmail, "Admin Logout", "User successfully logged out from the Admin Panel.", null, userAgent, timeZone);
                if (showInAppNotification) showInAppNotification(`Logged out from Admin Panel.`, "info-circle");
            } else if (isLoggedIn && wasLoggedIn) {
                // User is still logged in (e.g., component re-rendered)
                setCurrentUser(user);
                setFormData(prev => ({ ...prev, isAdminAuthenticated: true, adminUserEmail: user.email }));
            } else {
                // User is still logged out
                setCurrentUser(null);
                setFormData(prev => ({ ...prev, isAdminAuthenticated: false, adminUserEmail: null }));
            }

            prevUserUidRef.current = user ? user.uid : null;
            setIsLoadingAuth(false);
        });
        return () => unsubscribe();
    }, [setFormData, showInAppNotification, currentUser]);

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
        const { userAgent, timeZone } = getUserContext(); // Capture user context
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setError(err.message || "Failed to login.");
            setIsLoadingAuth(false);
            sendAdminActionWebhook(email, "Admin Login Failed", `Attempted login with email: ${email}. Error: ${err.message}`, null, userAgent, timeZone);
            if (showInAppNotification) showInAppNotification(`Login failed: ${err.message}`, "error");
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
        const { userAgent, timeZone } = getUserContext(); // Capture user context
        try {
            await signOut(auth);
        } catch (err) {
            setError(err.message || "Failed to logout.");
            sendAdminActionWebhook(currentUser?.email || "Unknown User", "Admin Logout Failed", `Failed to log out. Error: ${err.message}`, null, userAgent, timeZone);
            if (showInAppNotification) showInAppNotification(`Logout failed: ${err.message}`, "error");
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
        const { userAgent, timeZone } = getUserContext(); // Capture user context
        try {
            await update(ref(database), { [positionStatusPath]: newStatus });
            const successMessage = `${positionDetails.displayName || positionDetails.name || positionKey} status updated to ${newStatus} for ${categoryConfig.displayName}.`;
            if (showInAppNotification) showInAppNotification(successMessage, "check-circle");
            if (currentUser?.email) {
                sendAdminActionWebhook(currentUser.email, "Toggled Recruitment Status", `Position: ${positionDetails.displayName || positionDetails.name || positionKey}\nNew Status: ${newStatus}`, categoryConfig.displayName, userAgent, timeZone);
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
            sendAdminActionWebhook(currentUser?.email || "Unknown User", "Failed to Toggle Recruitment Status", `Position: ${positionDetails.displayName || positionDetails.name || positionKey}\nAttempted Status: ${newStatus}\nError: ${dbError.message}`, categoryConfig.displayName, userAgent, timeZone);
        }
        setIsUpdatingDb(false);
    };

    const handleRoleSaved = (savedRoleData, actionType) => {
        if (selectedRecruitmentCategory) {
            fetchRecruitmentDataForCategory(selectedRecruitmentCategory);
        }
        const { userAgent, timeZone } = getUserContext(); // Capture user context
        if (currentUser?.email && savedRoleData) {
            const categoryConfig = recruitmentCategories[selectedRecruitmentCategory];
            const action = actionType === 'edited' ? "Edited Role" : "Added New Role";
            sendAdminActionWebhook(
                currentUser.email, action,
                `Role Name: ${savedRoleData.displayName || savedRoleData.originalKey}\nShort Code: ${savedRoleData.shortCode || 'N/A'}\nStatus: ${savedRoleData.status || 'N/A'}\nKey: ${savedRoleData.originalKey}`,
                categoryConfig?.displayName || "Unknown Category",
                userAgent,
                timeZone
            );
            if (desktopNotificationPermission === "granted" && savedRoleData?.displayName) {
                 const notificationTitle = actionType === 'edited' ? `Role Updated: ${categoryConfig?.displayName || 'Recruitment'}` : `New Role Added: ${categoryConfig?.displayName || 'Recruitment'}`;
                 const notificationBody = actionType === 'edited'
                    ? `Role "${savedRoleData.displayName}" (${savedRoleData.shortCode || 'N/A'}) has been updated.`
                    : `Role "${savedRoleData.displayName}" (${savedRoleData.shortCode || 'N/A'}) has been added.`;
                showDesktopNotification(notificationTitle, { body: notificationBody, icon: '/phmc512.png', tag: `${actionType}-role-${selectedRecruitmentCategory}-${savedRoleData.originalKey}` });
            }
        }
    };

    const handleAddRoleClick = () => {
        setRoleToEdit(null);
        setShowRoleModal(true);
        const { userAgent, timeZone } = getUserContext(); // Capture user context
        sendAdminActionWebhook(currentUser?.email || "Unknown User", "Opened Add Role Modal", "Admin opened the modal to add a new role.", recruitmentCategories[selectedRecruitmentCategory]?.displayName, userAgent, timeZone);
    };

    const handleEditRoleClick = (roleKey, roleData) => {
        setRoleToEdit({ ...roleData, originalKey: roleKey });
        setShowRoleModal(true);
        const { userAgent, timeZone } = getUserContext(); // Capture user context
        sendAdminActionWebhook(currentUser?.email || "Unknown User", "Opened Edit Role Modal", `Admin opened the modal to edit role: ${roleData.displayName || roleKey}`, recruitmentCategories[selectedRecruitmentCategory]?.displayName, userAgent, timeZone);
    };

    const handleCloseRoleModal = () => {
        setShowRoleModal(false);
        setRoleToEdit(null);
        const { userAgent, timeZone } = getUserContext(); // Capture user context
        sendAdminActionWebhook(currentUser?.email || "Unknown User", "Closed Role Modal", "Admin closed the role add/edit modal.", recruitmentCategories[selectedRecruitmentCategory]?.displayName, userAgent, timeZone);
    };

    const handleRenameRoleKeyClick = (roleKey, roleData) => {
        setRoleToRenameKeyDetails({ key: roleKey, data: roleData });
        setShowRenameKeyModal(true);
        const { userAgent, timeZone } = getUserContext(); // Capture user context
        sendAdminActionWebhook(currentUser?.email || "Unknown User", "Opened Rename Role Key Modal", `Admin opened the modal to rename key for role: ${roleData.displayName || roleKey}`, recruitmentCategories[selectedRecruitmentCategory]?.displayName, userAgent, timeZone);
    };

    const handleRoleKeyRenamed = () => {
        if (selectedRecruitmentCategory) {
            fetchRecruitmentDataForCategory(selectedRecruitmentCategory);
        }
        if (currentUser?.email && roleToRenameKeyDetails && desktopNotificationPermission === "granted") {
            const categoryConfig = recruitmentCategories[selectedRecruitmentCategory];
            showDesktopNotification(`Role Key Renamed: ${categoryConfig?.displayName || 'Recruitment'}`, {
                body: `Key for "${roleToRenameKeyDetails.data.displayName || roleToRenameKeyDetails.key}" has been changed.`,
                icon: '/phmc512.png',
                tag: `rename-key-${selectedRecruitmentCategory}-${roleToRenameKeyDetails.key}`
            });
        }
        setRoleToRenameKeyDetails(null);
    };

    const handleEnableDesktopNotifications = async () => {
        console.log("[Desktop Notify] 'Enable Desktop Notifications' button clicked.");
        const granted = await requestNotificationPermission();
        const currentPermission = Notification.permission;
        console.log("[Desktop Notify] Permission after request:", currentPermission, "(Granted flag:", granted, ")");
        setDesktopNotificationPermission(currentPermission);
        const { userAgent, timeZone } = getUserContext(); // Capture user context
        if (currentUser?.email) {
            sendAdminActionWebhook(currentUser.email, "Desktop Notification Preference Changed", `Permission status: ${currentPermission}${granted ? ' (Granted by user)' : ' (Not granted or dismissed)'}`, null, userAgent, timeZone);
        }
        if (granted) {
            if (showInAppNotification) showInAppNotification("Desktop notifications enabled for this site! Please ensure your OS settings also allow notifications from your browser.", "check-circle", 7000);
            showDesktopNotification("PHMC Forms: Notifications Enabled", { body: "You will now receive desktop notifications for important admin actions. Ensure your OS allows browser notifications.", icon: '/phmc512.png' });
        } else {
            if (currentPermission === 'denied') {
                if (showInAppNotification) showInAppNotification("Desktop notifications are blocked. Please enable them in your browser settings.", "warning");
            } else {
                if (showInAppNotification) showInAppNotification("Desktop notifications were not enabled.", "warning");
            }
        }
    };

    const handleOpenAdminCustomWebhookModal = () => {
        setAdminCustomWebhookTitle('');
        setAdminCustomWebhookMessage('');
        setShowAdminCustomWebhookModal(true);
        const { userAgent, timeZone } = getUserContext(); // Capture user context
        sendAdminActionWebhook(currentUser?.email || "Unknown User", "Opened Admin Custom Webhook Modal", "Admin opened the modal to send a custom webhook to the Admin Action channel.", null, userAgent, timeZone);
    };

    const handleAdminCustomWebhookSubmit = async (payloadFromModal) => {
        const webhookURLIdentifier = "REACT_APP_PHMC_DISCORD or REACT_APP_DISCORD_WEBHOOK_URL";
        const webhookURL = process.env.REACT_APP_PHMC_DISCORD || process.env.REACT_APP_DISCORD_WEBHOOK_URL;
        const { userAgent, timeZone } = getUserContext(); // Capture user context

        if (!webhookURL) {
            if (showInAppNotification) showInAppNotification('Admin Webhook URL (PHMC_DISCORD) not configured.', 'error');
            Sentry.captureMessage("Admin Custom Webhook URL (PHMC_DISCORD) not configured for AdminAuthAndActions", "error");
            sendAdminActionWebhook(currentUser?.email || "Unknown User", "Failed to Send Admin Custom Webhook", "Webhook URL not configured.", null, userAgent, timeZone);
            return false;
        }
        try {
            const response = await fetch(webhookURL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadFromModal),
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Failed to send admin custom webhook. Status: ${response.status}`, errorText);
                Sentry.captureMessage(`Admin Custom Discord webhook failed (AdminAuthAndActions): ${response.status}`, {
                    level: 'error',
                    extra: { statusText: response.statusText, responseBody: errorText }
                });
                if (showInAppNotification) showInAppNotification(`Failed to send admin webhook. Status: ${response.status}`, 'error');
                sendAdminActionWebhook(currentUser?.email || "Unknown User", "Failed to Send Admin Custom Webhook", `Status: ${response.status}, Error: ${errorText}`, null, userAgent, timeZone);
                return false;
            } else {
                if (showInAppNotification) showInAppNotification('Admin webhook message sent successfully!', 'check-circle');
                setShowAdminCustomWebhookModal(false);
                sendAdminActionWebhook(currentUser?.email || "Unknown User", "Sent Admin Custom Webhook", "Admin successfully sent a custom webhook to the Admin Action channel.", null, userAgent, timeZone);
                return true;
            }
        } catch (error) {
            console.error('Error sending admin custom webhook:', error);
            Sentry.captureException(error, { extra: { context: 'Admin Custom Webhook Submission Fetch (AdminAuthAndActions)' } });
            if (showInAppNotification) showInAppNotification('A network error occurred sending the admin webhook.', 'error');
            sendAdminActionWebhook(currentUser?.email || "Unknown User", "Failed to Send Admin Custom Webhook", `Network Error: ${error.message}`, null, userAgent, timeZone);
            return false;
        }
    };

    const handleOpenCoronerWebhookModal = () => {
        setCoronerWebhookTitle('');
        setCoronerWebhookMessage('');
        setShowCoronerWebhookModal(true);
        const { userAgent, timeZone } = getUserContext(); // Capture user context
        sendAdminActionWebhook(currentUser?.email || "Unknown User", "Opened Coroner Webhook Modal", "Admin opened the modal to send a custom webhook to the Coroner Updates channel.", null, userAgent, timeZone);
    };

    const handleCoronerWebhookSubmit = async (payloadFromModal) => {
        const webhookURLIdentifier = "REACT_APP_CORONER_DISCORD_UPDATES";
         const webhookURL = process.env.REACT_APP_CORONER_DISCORD_UPDATES;
         const { userAgent, timeZone } = getUserContext(); // Capture user context

        if (!webhookURL) {
            if (showInAppNotification) showInAppNotification('Coroner Webhook URL (CORONER_DISCORD_UPDATES) not configured.', 'error');
            Sentry.captureMessage("Coroner Webhook URL (CORONER_DISCORD_UPDATES) not configured", "error");
            sendAdminActionWebhook(currentUser?.email || "Unknown User", "Failed to Send Coroner Custom Webhook", "Webhook URL not configured.", null, userAgent, timeZone);
            return false;
        }
        try {
            const response = await fetch(webhookURL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadFromModal),
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Failed to send Coroner webhook. Status: ${response.status}`, errorText);
                Sentry.captureMessage(`Coroner Discord webhook failed: ${response.status}`, {
                    level: 'error',
                    extra: { statusText: response.statusText, responseBody: errorText }
                });
                if (showInAppNotification) showInAppNotification(`Failed to send Coroner webhook. Status: ${response.status}`, 'error');
                sendAdminActionWebhook(currentUser?.email || "Unknown User", "Failed to Send Coroner Custom Webhook", `Status: ${response.status}, Error: ${errorText}`, null, userAgent, timeZone);
                return false;
            } else {
                if (showInAppNotification) showInAppNotification('Coroner webhook message sent successfully!', 'check-circle');
                setShowCoronerWebhookModal(false);
                sendAdminActionWebhook(currentUser?.email || "Unknown User", "Sent Coroner Custom Webhook", "Admin successfully sent a custom webhook to the Coroner Updates channel.", null, userAgent, timeZone);
                return true;
            }
        } catch (error) {
            console.error('Error sending Coroner webhook:', error);
            Sentry.captureException(error, { extra: { context: 'Coroner Webhook Submission Fetch' } });
            if (showInAppNotification) showInAppNotification('A network error occurred sending the Coroner webhook.', 'error');
            sendAdminActionWebhook(currentUser?.email || "Unknown User", "Failed to Send Coroner Custom Webhook", `Network Error: ${error.message}`, null, userAgent, timeZone);
            return false;
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
                    <BootstrapForm.Control type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={handlePasswordKeyDown} required />
                </BootstrapForm.Group>
                {error && <p className="text-danger">{error}</p>}
                <Button variant="primary" type="button" onClick={handleLoginAttempt}>Login to Admin Panel</Button>
            </div>
        );
    }

    return (
        <div>
            <p>Logged in as: {currentUser.email}</p>
            {desktopNotificationPermission === 'default' && (
                <Button variant="outline-info" size="sm" onClick={handleEnableDesktopNotifications} className="mb-2 d-block mx-auto" title="Click to allow desktop notifications for status updates">
                    <i className="fas fa-bell"></i> Enable Desktop Notifications
                </Button>
            )}
            {desktopNotificationPermission === 'denied' && ( <p className="text-warning small text-center mb-2">Desktop notifications are blocked. Please enable them in your browser settings if desired.</p> )}
            <hr />
            HELLO! WHAT YOU ARE ABOUT TO DO MAYBE DANGEROUS, PLEASE REVIEW EVERYTHING BEFORE CHANGING ANYTHING!
            <hr />
            <BootstrapForm.Group className="mb-3" controlId="selectRecruitmentCategory">
                <BootstrapForm.Label>Select Recruitment Option</BootstrapForm.Label>
                <BootstrapForm.Select value={selectedRecruitmentCategory} onChange={(e) => setSelectedRecruitmentCategory(e.target.value)}>
                    <option value="">-- Select an Option --</option>
                    {Object.entries(recruitmentCategories).map(([key, cat]) => ( <option key={key} value={key}>{cat.displayName}</option> ))}
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
                    {isLoadingRecruitmentData ? ( <Spinner animation="border" /> ) : Object.keys(currentRecruitmentData).length > 0 ? (
                        <ListGroup variant="flush" className="mb-3">
                            {Object.entries(currentRecruitmentData).map(([key, position]) => (
                                <ListGroup.Item key={key} className="d-flex justify-content-between align-items-center">
                                    <div>
                                        {position.displayName || position.name || key}: {}
                                        <strong style={{color: position.status === "OPEN" ? 'green' : 'red'}}>{position.status || "N/A"}</strong>
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
                                        <Button variant={position.status === "OPEN" ? "outline-danger" : "outline-success"} size="sm" onClick={() => handleTogglePositionStatus(key, position.status)} disabled={isUpdatingDb} style={{minWidth: '120px'}}>
                                            {isUpdatingDb && <Spinner as="span" animation="border" size="sm" />}
                                            {position.status === "OPEN" ? "Set CLOSED" : "Set OPEN"}
                                        </Button>
                                    </div>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    ) : ( <p>No positions loaded for {recruitmentCategories[selectedRecruitmentCategory]?.displayName}.</p> )}
                </>
            ) : ( <p>Please select a recruitment option from the dropdown to manage statuses or add roles.</p> )}

            <Button variant="info" onClick={handleOpenAdminCustomWebhookModal} className="mt-3 me-2">
                <i className="fas fa-bullhorn"></i> ADMIN WEBHOOK
            </Button>
            <Button variant="dark" onClick={handleOpenCoronerWebhookModal} className="mt-3 me-2">
                <i className="fas fa-skull-crossbones"></i> CORONER WEBHOOK
            </Button>

            <Button variant="warning" onClick={handleLogout} className="mt-3">Logout</Button>

            {selectedRecruitmentCategory && recruitmentCategories[selectedRecruitmentCategory] && (
                <AddRoleModal show={showRoleModal} onHide={handleCloseRoleModal} categoryKey={selectedRecruitmentCategory} categoryConfig={recruitmentCategories[selectedRecruitmentCategory]} showNotification={showInAppNotification} onRoleSaved={handleRoleSaved} roleToEdit={roleToEdit} />
            )}
            {roleToRenameKeyDetails && selectedRecruitmentCategory && recruitmentCategories[selectedRecruitmentCategory] && (
                <RenameRoleKeyModal show={showRenameKeyModal} onHide={() => { setShowRenameKeyModal(false); setRoleToRenameKeyDetails(null); }} categoryConfig={recruitmentCategories[selectedRecruitmentCategory]} currentRoleKey={roleToRenameKeyDetails.key} currentRoleData={roleToRenameKeyDetails.data} showInAppNotification={showInAppNotification} onKeyRenamed={handleRoleKeyRenamed} sendAdminActionWebhook={sendAdminActionWebhook} adminUserEmail={currentUser?.email} />
            )}

            <WebhookModal
                show={showAdminCustomWebhookModal}
                onClose={() => setShowAdminCustomWebhookModal(false)}
                webhookTitle={adminCustomWebhookTitle}
                setWebhookTitle={setAdminCustomWebhookTitle}
                webhookMessage={adminCustomWebhookMessage}
                setWebhookMessage={setAdminCustomWebhookMessage}
                onSubmit={handleAdminCustomWebhookSubmit}
                showNotification={showInAppNotification}
                commitInfo={commitInfo}
                modalHeaderText="Send Admin Action Embed"
                primaryButtonText="Send to Admin Action Hook"
                primaryWebhookUrlIdentifier="REACT_APP_PHMC_DISCORD or REACT_APP_DISCORD_WEBHOOK_URL"
                showSecondaryButton={false}
            />
                        <WebhookModal
                show={showCoronerWebhookModal}
                onClose={() => setShowCoronerWebhookModal(false)}
                webhookTitle={coronerWebhookTitle}
                setWebhookTitle={setCoronerWebhookTitle}
                webhookMessage={coronerWebhookMessage}
                setWebhookMessage={setCoronerWebhookMessage}
                onSubmit={handleCoronerWebhookSubmit}
                showNotification={showInAppNotification}
                commitInfo={commitInfo}
                modalHeaderText="Send Coroner Update Embed"
                primaryButtonText="Send to Coroner Updates"
                primaryWebhookUrlIdentifier="REACT_APP_CORONER_DISCORD_UPDATES"
                showSecondaryButton={false}
            />

        </div>
    );
};

export default AdminAuthAndActions;
