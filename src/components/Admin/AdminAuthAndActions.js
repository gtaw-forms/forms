import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Form as BootstrapForm, Button, Spinner, ListGroup } from 'react-bootstrap';
import { auth, database } from '../../firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { ref, get, update, remove, set, serverTimestamp } from "firebase/database"; 
import AddRoleModal from './RoleModal';
import RenameRoleKeyModal from './RenameRoleKeyModal';
import WebhookModal from '../WebhookModal';
import { captureMessage, captureException, getClient } from "@sentry/react";
import EditBingoPhrasesModal from './EditBingoPhrasesModal';
import ReviewPhraseRequestsModal from './ReviewPhraseRequestsModal';
import * as Sentry from "@sentry/react";
import CctvRequestWebhookModal from './CctvRequestWebhookModal'; // Import the new modal

const recruitmentCategories = {
    physician: { displayName: "Physician Recruitment", path: 'selectOptions/physicianRecruitmentDetails' },
    psych: { displayName: "Psychologist/Psychiatrist Recruitment", path: 'selectOptions/psychPositionDetailsData' },
    admin: { displayName: "Admin Recruitment", path: 'selectOptions/adminPositionDetailsData' },
    nursing: { displayName: "Nursing Recruitment", path: 'selectOptions/nursePositionDetailsData' },
    ems: { displayName: "EMS Recruitment", path: 'selectOptions/emsPositionDetailsData' },
    coroner: { displayName: "Coroner Recruitment", path: 'selectOptions/coronerPositionDetailsData' },
};
const BINGO_TYPES = [
    { id: 'er', name: 'Emergency Room', path: 'ER' },
    { id: 'ems', name: 'EMS', path: 'EMS' },
    { id: 'coroner', name: 'Coroner', path: 'Coroner' }
];
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
        captureMessage("Admin Action Webhook URL not configured", "warning");
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
            captureMessage(`Admin Action Discord webhook failed: ${response.status}`, "error");
        } else {
            console.log(`Admin action logged to Discord: ${action}`);
        }
    } catch (error) {
        console.error('Error sending admin action webhook:', error);
        captureException(error, { extra: { context: 'Admin Action Webhook Submission' } });
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
    const [selectedAdminBingoType, setSelectedAdminBingoType] = useState(BINGO_TYPES[0].id);
    const [showEditBingoPhrasesModal, setShowEditBingoPhrasesModal] = useState(false);
    const [showReviewPhrasesModal, setShowReviewPhrasesModal] = useState(false);

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
    const [showCctvWebhookModal, setShowCctvWebhookModal] = useState(false);

    const prevUserUidRef = useRef(null);

    const handleCctvWebhookSubmit = async (cctvData) => {
        const webhookURL = process.env.REACT_APP_DISCORD_WEBHOOK_URL; // Using the general dev webhook for this test
        const { userAgent, timeZone } = getUserContext();

        if (!webhookURL) {
            if (showInAppNotification) showInAppNotification('Webhook URL (REACT_APP_DISCORD_WEBHOOK_URL) not configured.', 'error');
            Sentry.captureMessage("CCTV Test Webhook URL not configured", "error");
            return false; // Indicate failure
        }

        const embed = {
            title: "📹 CCTV Footage Request (Test)",
            color: 0x5865F2, // Discord Blurple
            fields: [
                { name: "Requesting Officer Rank", value: cctvData.rank || "N/A", inline: true },
                { name: "Requesting Officer", value: cctvData.officer || "N/A", inline: true },
                { name: "Officer Phone Number", value: cctvData.officerPH || "N/A", inline: true },
                { name: "Requesting Department", value: cctvData.department || "N/A", inline: true },
                ...(cctvData.discordUsername ? [{ name: "Discord Username", value: cctvData.discordUsername, inline: true }] : []),
                { name: "Date/Time of Incident", value: cctvData.incidentDateTime || "N/A", inline: true },
                { name: "Reason for Request", value: cctvData.requestReason || "N/A", inline: true },
                { name: "CCTV Location", value: cctvData.location || "N/A", inline: false },
                { name: "Description of Events", value: `\`\`\`${cctvData.description || "N/A"}\`\`\``, inline: false },
                ...(cctvData.oocNotes ? [{ name: "OOC Notes", value: `\`\`\`${cctvData.oocNotes}\`\`\``, inline: false }] : []),
            ],
            timestamp: new Date().toISOString(),
            footer: { text: "PHMC Forms - CCTV Test Webhook" }
        };

        try {
            const response = await fetch(webhookURL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [embed] })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Failed to send CCTV test webhook. Status: ${response.status}`, errorText);
                Sentry.captureMessage(`CCTV Test Webhook failed: ${response.status}`, { level: 'error', extra: { responseBody: errorText } });
                if (showInAppNotification) showInAppNotification(`Failed to send test webhook. Status: ${response.status}`, 'error');
                return false;
            } else {
                if (showInAppNotification) showInAppNotification('CCTV Test Webhook sent successfully!', "check-circle");
                sendAdminActionWebhook(currentUser?.email, "Sent CCTV Test Webhook", `Sent a test webhook for a CCTV request to the dev channel.`, "Developer Testing", userAgent, timeZone);
                return true;
            }
        } catch (error) {
            console.error('Error sending CCTV test webhook:', error);
            Sentry.captureException(error, { extra: { context: 'CCTV Test Webhook Submission' } });
            if (showInAppNotification) showInAppNotification('A network error occurred sending the test webhook.', "error");
            return false;
        }
    };

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
            // onAuthStateChanged will handle the success case
        } catch (err) {
            setError(err.message || "Failed to login.");
            setIsLoadingAuth(false);

            Sentry.captureException(err, {
                level: 'warning',
                extra: {
                    email: email, // Log the email that was used for the attempt.
                    context: 'Admin Login Attempt'
                },
                tags: {
                    login_result: 'failure'
                }
            });
            // --- MODIFICATION END ---

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
    // --- 1. Initial Validation & Early Exit ---
    if (!currentUser || !selectedRecruitmentCategory || !recruitmentCategories[selectedRecruitmentCategory]) {
        // No notification here, as this might be a normal state (e.g., user not logged in).
        return;
    }

    const positionDetails = currentRecruitmentData[positionKey];
    if (!positionDetails) {
        console.error("Position details not found for key:", positionKey);
        showInAppNotification("Error: Position details missing.", "error");
        return;
    }

    // Extract frequently used or calculated values into clear variables.
    const positionDisplayName = positionDetails.displayName || positionDetails.name || positionKey;
    const newStatus = currentStatus === "OPEN" ? "CLOSED" : "OPEN";
    const categoryConfig = recruitmentCategories[selectedRecruitmentCategory];
    const positionStatusPath = `${categoryConfig.path}/${positionKey}/status`;
    const { userAgent, timeZone } = getUserContext(); // Capture user context for logging.

    // Indicate that an asynchronous operation is in progress.
    setIsUpdatingDb(true);

    try {
        // --- 4. Core Operation: Firebase Update ---
        await update(ref(database), { [positionStatusPath]: newStatus });

        // --- 5. Success Path: Notifications & Webhooks ---
        const successMessage = `${positionDisplayName} status updated to ${newStatus} for ${categoryConfig.displayName}.`;
        showInAppNotification(successMessage, "check-circle"); // Notify user in-app.

        // Log the successful action to the admin webhook.
        sendAdminActionWebhook(
            currentUser.email,
            "Toggled Recruitment Status",
            `Position: ${positionDisplayName}\nNew Status: ${newStatus}`,
            categoryConfig.displayName,
            userAgent,
            timeZone
        );

        // Show desktop notification if permission is granted.
        if (desktopNotificationPermission === "granted") {
            showDesktopNotification(`Recruitment Status Updated: ${categoryConfig.displayName}`, {
                body: `${positionDisplayName} is now ${newStatus}.`,
                icon: '/phmc512.png', // Ensure this path is correct and accessible.
                tag: `status-update-${selectedRecruitmentCategory}-${positionKey}` // Unique tag to prevent duplicate notifications.
            });
        }

        // Refresh the recruitment data in the UI to reflect the change.
        fetchRecruitmentDataForCategory(selectedRecruitmentCategory);

    } catch (dbError) {
        // --- 6. Error Path: Notifications & Webhooks ---
        console.error(`Error updating status for ${positionKey}:`, dbError); // Log error to console for debugging.
        showInAppNotification(`Failed to update status for ${positionKey}.`, "error"); // Notify user in-app.

        // Log the failed action to the admin webhook.
        sendAdminActionWebhook(
            currentUser?.email || "Unknown User", // Fallback for email if not available.
            "Failed to Toggle Recruitment Status",
            `Position: ${positionDisplayName}\nAttempted Status: ${newStatus}\nError: ${dbError.message}`,
            categoryConfig.displayName,
            userAgent,
            timeZone
        );
    } finally {
        // --- 7. Reset Loading State ---
        // Always reset loading state regardless of whether the operation succeeded or failed.
        setIsUpdatingDb(false);
    }
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
                if (showInAppNotification) showInAppNotification('Admin webhook message sent successfully!', "check-circle");
                setShowAdminCustomWebhookModal(false);
                sendAdminActionWebhook(currentUser?.email || "Unknown User", "Sent Admin Custom Webhook", "Admin successfully sent a custom webhook to the Admin Action channel.", null, userAgent, timeZone);
                return true;
            }
        } catch (error) {
            console.error('Error sending admin custom webhook:', error);
            Sentry.captureException(error, { extra: { context: 'Admin Custom Webhook Submission Fetch (AdminAuthAndActions)' } });
            if (showInAppNotification) showInAppNotification('A network error occurred sending the admin webhook.', "error");
            sendAdminActionWebhook(currentUser?.email || "Unknown User", "Failed to Send Admin Custom Webhook", `Network Error: ${error.message}`, null, userAgent, timeZone);
            return false;
        }
    };
    // Bingo Activity Log Functions
    const getShuffledPhrases = (phrases) => {
    if (!phrases || phrases.length === 0) return [];
    return [...phrases].sort(() => 0.5 - Math.random());
};


    const handleClearBingoActivity = async () => {
        const selectedType = BINGO_TYPES.find(type => type.id === selectedAdminBingoType);
        if (!selectedType) return;

        if (!window.confirm(`Are you sure you want to clear ALL ${selectedType.name} Bingo activity logs? This action cannot be undone.`)) {
            return;
        }

        setIsUpdatingDb(true);
        const bingoLogRef = ref(database, `bingo/logs/${selectedType.path}/activityLog`);
        const { userAgent, timeZone } = getUserContext();

        try {
            await remove(bingoLogRef);
            showInAppNotification(`${selectedType.name} Bingo activity log has been cleared.`, "check-circle");
            sendAdminActionWebhook(
                currentUser.email,
                `Cleared ${selectedType.name} Bingo Activity`,
                `The 'bingo/logs/${selectedType.path}/activityLog' path was deleted from Firebase.`,
                `${selectedType.name} Bingo`,
                userAgent,
                timeZone
            );
        } catch (dbError) {
            console.error("Error clearing bingo activity log:", dbError);
            showInAppNotification(`Failed to clear ${selectedType.name} bingo activity log.`, "error");
            sendAdminActionWebhook(
                currentUser.email,
                `Failed to Clear ${selectedType.name} Bingo Activity`,
                `Error: ${dbError.message}`,
                `${selectedType.name} Bingo`,
                userAgent,
                timeZone
            );
        } finally {
            setIsUpdatingDb(false);
        }
    };

    // NEW: Handler to generate a new bingo card
    const handleGenerateNewBingoCard = async () => {
        const selectedType = BINGO_TYPES.find(type => type.id === selectedAdminBingoType);
        if (!selectedType) return;

        if (!window.confirm(`Are you sure you want to generate a NEW ${selectedType.name} Bingo card? This will clear the current game and activity log for ALL users.`)) {
            return;
        }

        setIsUpdatingDb(true);
        const masterPhrasesRef = ref(database, `bingo/phrases/${selectedType.path}`);
        const currentCardRef = ref(database, `bingo/cards/${selectedType.path}/phrases`);
        const activityLogRef = ref(database, `bingo/logs/${selectedType.path}/activityLog`);
        const { userAgent, timeZone } = getUserContext();

        try {
            // 1. Fetch master phrases
            const snapshot = await get(masterPhrasesRef);
            if (!snapshot.exists()) {
                showInAppNotification(`Error: Master phrases for ${selectedType.name} not found. Cannot generate new card.`, "error");
                sendAdminActionWebhook(
                    currentUser.email,
                    `Failed to Generate New ${selectedType.name} Bingo Card`,
                    `Master phrases not found in Firebase at 'bingo/phrases/${selectedType.path}'.`,
                    `${selectedType.name} Bingo`,
                    userAgent,
                    timeZone
                );
                setIsUpdatingDb(false);
                return;
            }
            const masterPhrasesData = snapshot.val();
            const masterPhrases = Array.isArray(masterPhrasesData)
                ? masterPhrasesData
                : (typeof masterPhrasesData === 'object' && masterPhrasesData !== null)
                    ? Object.values(masterPhrasesData).map(p => (typeof p === 'object' ? p.phrase : p)).filter(Boolean)
                    : [];

            if (masterPhrases.length < 24) {
                showInAppNotification(`Error: Not enough master phrases for ${selectedType.name} (need at least 24).`, "error");
                sendAdminActionWebhook(
                    currentUser.email,
                    `Failed to Generate New ${selectedType.name} Bingo Card`,
                    `Not enough master phrases (${masterPhrases.length} found, need 24).`,
                    `${selectedType.name} Bingo`,
                    userAgent,
                    timeZone
                );
                setIsUpdatingDb(false);
                return;
            }

            // 2. Shuffle and save new card
            const shuffledPhrases = getShuffledPhrases(masterPhrases).slice(0, 24);
            await set(currentCardRef, shuffledPhrases);

            // 3. Clear activity log for a fresh game
            await remove(activityLogRef);

            showInAppNotification(`New ${selectedType.name} Bingo card generated and activity log cleared!`, "check-circle");
            sendAdminActionWebhook(
                currentUser.email,
                `Generated New ${selectedType.name} Bingo Card`,
                `A new card was generated and the activity log cleared for all users.`,
                `${selectedType.name} Bingo`,
                userAgent,
                timeZone
            );
        } catch (dbError) {
            console.error("Error generating new bingo card:", dbError);
            showInAppNotification("Failed to generate new bingo card.", "error");
            sendAdminActionWebhook(
                currentUser.email,
                `Failed to Generate New ${selectedType.name} Bingo Card`,
                `Error: ${dbError.message}`,
                `${selectedType.name} Bingo`,
                userAgent,
                timeZone
            );
        } finally {
            setIsUpdatingDb(false);
        }
    };

    // NEW: Handler to disable a bingo card
    const handleDisableBingoCard = async () => {
        const selectedType = BINGO_TYPES.find(type => type.id === selectedAdminBingoType);
        if (!selectedType) return;

        if (!window.confirm(`Are you sure you want to DISABLE the ${selectedType.name} Bingo card? This will remove the current card and clear all progress. The game will be unavailable until a new card is generated.`)) {
            return;
        }

        setIsUpdatingDb(true);
        // We will remove the entire node for the card type to ensure a clean slate.
        const cardNodeRef = ref(database, `bingo/cards/${selectedType.path}`);
        const logNodeRef = ref(database, `bingo/logs/${selectedType.path}`);
        const { userAgent, timeZone } = getUserContext();

        try {
            // Remove both the card and the log data for this bingo type.
            await remove(cardNodeRef);
            await remove(logNodeRef);

            showInAppNotification(`${selectedType.name} Bingo has been disabled and all data cleared.`, "check-circle");
            sendAdminActionWebhook(
                currentUser.email,
                `Disabled ${selectedType.name} Bingo Card`,
                `The card and activity log for '${selectedType.name}' were deleted from Firebase.`,
                `${selectedType.name} Bingo`,
                userAgent,
                timeZone
            );
        } catch (dbError) {
            console.error("Error disabling bingo card:", dbError);
            showInAppNotification(`Failed to disable ${selectedType.name} bingo card.`, "error");
            sendAdminActionWebhook(
                currentUser.email,
                `Failed to Disable ${selectedType.name} Bingo Card`,
                `Error: ${dbError.message}`,
                `${selectedType.name} Bingo`,
                userAgent,
                timeZone
            );
        } finally {
            setIsUpdatingDb(false);
        }
    };

    const handleManualResetAllBingoCards = async () => {
        if (!window.confirm("Are you sure you want to manually reset all active Bingo cards? This will clear their current progress.")) {
            return;
        }

        const metaRef = ref(database, 'bingo/meta');
        // We can still update the timestamp to log this manual reset
        await update(metaRef, { lastManualRegenTimestamp: serverTimestamp() });
    
        showInAppNotification('Manual daily bingo reset initiated...', 'sync-alt', 5000);
    
        const results = {
            success: [],
            noCard: [],
            notEnoughPhrases: [],
            errors: [],
        };
    
        // This Promise.all logic is perfect and remains the same
        await Promise.all(BINGO_TYPES.map(async (bingoType) => {
            const cardPhrasesRef = ref(database, `bingo/cards/${bingoType.path}/phrases`);
            
            const cardSnapshot = await get(cardPhrasesRef);
            if (!cardSnapshot.exists()) {
                results.noCard.push(bingoType.name);
                return;
            }
    
            const masterPhrasesRef = ref(database, `bingo/phrases/${bingoType.path}`);
            const masterSnapshot = await get(masterPhrasesRef);
            if (!masterSnapshot.exists()) {
                results.notEnoughPhrases.push(`${bingoType.name} (no master list)`);
                return;
            }
            
            const masterPhrasesData = masterSnapshot.val();
            const masterPhrases = Array.isArray(masterPhrasesData)
                ? masterPhrasesData.filter(Boolean)
                : (typeof masterPhrasesData === 'object' && masterPhrasesData !== null)
                    ? Object.values(masterPhrasesData).map(p => (typeof p === 'object' ? p.phrase : p)).filter(Boolean)
                    : [];
    
            if (masterPhrases.length < 24) {
                results.notEnoughPhrases.push(`${bingoType.name} (${masterPhrases.length}/24)`);
                return;
            }
    
            try {
                const shuffledPhrases = getShuffledPhrases(masterPhrases).slice(0, 24);
                const activityLogRef = ref(database, `bingo/logs/${bingoType.path}/activityLog`);
                
                await set(cardPhrasesRef, shuffledPhrases);
                await remove(activityLogRef);
                
                results.success.push(bingoType.name);
            } catch (error) {
                console.error(`Error manually regenerating ${bingoType.name} card:`, error);
                results.errors.push(`${bingoType.name}: ${error.message}`);
            }
        }));
    
        // --- MODIFICATION FOR MANUAL ACTION ---
        const { userAgent, timeZone } = getUserContext();
        let details = '';
        if (results.success.length > 0) details += `✅ Regenerated: ${results.success.join(', ')}\n`;
        if (results.noCard.length > 0) details += `➖ Skipped (Disabled): ${results.noCard.join(', ')}\n`;
        if (results.notEnoughPhrases.length > 0) details += `⚠️ Skipped (Not Enough Phrases): ${results.notEnoughPhrases.join(', ')}\n`;
        if (results.errors.length > 0) details += `❌ Errors: ${results.errors.join(', ')}\n`;
    
        sendAdminActionWebhook(
            currentUser.email, // Use the logged-in admin's email
            "Manual Bingo Reset", // Change action text
            details.trim(),
            "Bingo Management",
            userAgent,
            timeZone
        );
    
        showInAppNotification('Manual bingo reset complete!', 'check-circle');
    };
  const [sentryStatus, setSentryStatus] = useState('unknown'); // 'unknown', 'ok', 'blocked'
  const [isCheckingSentry, setIsCheckingSentry] = useState(false);


  const triggerSentryTestError = () => {
    throw new Error("Sentry Test: This is an intentional error from the Admin Auth page.");
  };

  const checkSentryStatus = async () => {
      setIsCheckingSentry(true);
      setSentryStatus('unknown'); // Reset status
      showInAppNotification("Checking Sentry connection...", 'info-circle', 4000);

      const client = getClient();
      if (!client || !client.getDsn()) {
          setSentryStatus('blocked');
          showInAppNotification("Sentry client not found. Fallback should be active.", "error");
          setIsCheckingSentry(false);
          return;
      }

      const dsn = client.getDsn();
      const ingestUrl = `${dsn.protocol}://${dsn.host}/api/${dsn.projectId}/envelope/`;

      try {
          // A 'no-cors' HEAD request is a lightweight way to check for network-level blocking.
          await fetch(ingestUrl, { method: 'HEAD', mode: 'no-cors' });
          setSentryStatus('ok');
          showInAppNotification("Sentry connection appears to be OK.", "check-circle");
      } catch (error) {
          // A TypeError is the classic sign of a request being blocked by an ad-blocker.
          setSentryStatus('blocked');
          showInAppNotification("Sentry appears to be blocked (e.g., by an ad-blocker). Fallback should be active.", "warning");
          console.warn("Sentry connectivity check failed in admin panel:", error);
      } finally {
          setIsCheckingSentry(false);
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
                if (showInAppNotification) showInAppNotification('Coroner webhook message sent successfully!', "check-circle");
                setShowCoronerWebhookModal(false);
                sendAdminActionWebhook(currentUser?.email || "Unknown User", "Sent Coroner Custom Webhook", "Admin successfully sent a custom webhook to the Coroner Updates channel.", null, userAgent, timeZone);
                return true;
            }
        } catch (error) {
            console.error('Error sending Coroner webhook:', error);
            Sentry.captureException(error, { extra: { context: 'Coroner Webhook Submission Fetch' } });
            if (showInAppNotification) showInAppNotification('A network error occurred sending the Coroner webhook.', "error");
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

    const selectedTypeForEdit = BINGO_TYPES.find(type => type.id === selectedAdminBingoType);

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
            ) : ( <p></p> )}
            <hr />
            <h5>Bingo Management</h5>
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
            <p className="text-muted small mt-1">"Generate Card" and "Clear Log" apply to the selected Bingo type. Phrase editing is also type-specific.</p>
            
            <hr />
            <Button variant="info" onClick={handleOpenAdminCustomWebhookModal} className="mt-3 me-2">
                <i className="fas fa-bullhorn"></i> ADMIN WEBHOOK
            </Button>
            <Button variant="dark" onClick={handleOpenCoronerWebhookModal} className="mt-3 me-2">
                <i className="fas fa-skull-crossbones"></i> CORONER WEBHOOK
            </Button>
            <div className="my-3 p-3 border border-warning rounded">
                <h5 className="text-warning"><i className="fas fa-vial me-2"></i>Developer Testing Area</h5>
                <p>
                    Use these tools to test error reporting. Your fallback mechanism should trigger if Sentry status is "Blocked".
                </p>
                <div className="d-flex align-items-center mb-2">
                    <Button variant="info" onClick={checkSentryStatus} disabled={isCheckingSentry}>
                        {isCheckingSentry ? <Spinner as="span" animation="border" size="sm" className="me-2" /> : <i className="fas fa-network-wired me-2"></i>}
                        Check Sentry Status
                    </Button>
                    <span className="ms-3">
                        Status: {
                            sentryStatus === 'ok' ? <strong className="text-success">OK</strong> :
                            sentryStatus === 'blocked' ? <strong className="text-danger">Blocked</strong> :
                            'Unknown'
                        }
                    </span>
                </div>
                <Button variant="danger" onClick={triggerSentryTestError} title="This will throw an unhandled error to test Sentry and fallback error reporting.">
                    <i className="fas fa-bug me-2"></i>
                    Trigger Sentry Test Error
                </Button>
                                    <Button variant="secondary" onClick={() => setShowCctvWebhookModal(true)} title="Send a test webhook simulating a CCTV request.">
                        <i className="fas fa-video me-2"></i>
                        CCTV Request Test
                    </Button>

            </div>
            <hr />
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
            <EditBingoPhrasesModal
                show={showEditBingoPhrasesModal}
                onHide={() => setShowEditBingoPhrasesModal(false)}
                showNotification={showInAppNotification}
                commitInfo={commitInfo}
                sendAdminActionWebhook={sendAdminActionWebhook}
                adminUserEmail={currentUser?.email}
                bingoType={selectedTypeForEdit}
            />
            <ReviewPhraseRequestsModal
                show={showReviewPhrasesModal}
                onHide={() => setShowReviewPhrasesModal(false)}
                showNotification={showInAppNotification}
                sendAdminActionWebhook={sendAdminActionWebhook}
                adminUserEmail={currentUser?.email}
            />
            <CctvRequestWebhookModal
                show={showCctvWebhookModal}
                onHide={() => setShowCctvWebhookModal(false)}
                onSubmit={handleCctvWebhookSubmit}
                showNotification={showInAppNotification}
            />

        </div>
    );
};

export default AdminAuthAndActions;
