import { useState, useEffect, useCallback, useRef } from 'react';
import { Form as BootstrapForm, Button, Spinner, ListGroup } from 'react-bootstrap';
import { auth, database, db } from '../../firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { ref, get, update, remove, set, serverTimestamp, onValue, push } from "firebase/database";
import { collection, addDoc, deleteDoc, doc, getDocs } from 'firebase/firestore'; 
import AddRoleModal from './RoleModal';
import RenameRoleKeyModal from './RenameRoleKeyModal';

import { captureMessage, captureException } from "@sentry/react";
import EditBingoPhrasesModal from './EditBingoPhrasesModal';
import ReviewPhraseRequestsModal from './ReviewPhraseRequestsModal';
import * as Sentry from "@sentry/react";
import CctvRequestWebhookModal from './CctvRequestWebhookModal'; // Import the new modal
import UserManagementModal from './UserManagementModal';
import AdminDashboard from './AdminDashboard';
import OAuthTokenExchangeModal from './OAuthTokenExchangeModal';
import UserDataExchangeModal from './UserDataExchangeModal';


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
    const webhookURL = process.env.REACT_APP_ADMIN_ACTION_DISCORD_WEBHOOK_URL || process.env.REACT_APP_DEV_WEBHOOK;
    if (!webhookURL) {
        console.warn("Admin action webhook URL not configured. Skipping log.");
        captureMessage("Admin Action Webhook URL not configured", "warning");
        return;
    }

    // Simplified description for a cleaner look
    const description = categoryName
        ? `**Action:** ${action || "Unknown Action"}\n**Admin:** ${adminEmail || "Unknown"}\n**Category:** ${categoryName}`
        : `**Action:** ${action || "Unknown Action"}\n**Admin:** ${adminEmail || "Unknown"}`;

    const embed = {
        title: "Admin Action Logged",
        color: 0xFFA500, // Orange
        description: description,
        fields: [
            { name: "Details", value: `\`\`\`${details.substring(0, 1000)}\`\`\``, inline: false },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: `PHMC Tools | ${userTimezone}` }
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



const AdminAuthAndActions = ({ formData, setFormData, showNotification, showNotification: showInAppNotification, commitInfo }) => {
    // --- Custom Webhook Panel State (must be first, before any logic or return) ---
    const [customWebhookChannel, setCustomWebhookChannel] = useState('');
    const [customWebhookTitle, setCustomWebhookTitle] = useState('');
    const [customWebhookMessage, setCustomWebhookMessage] = useState('');
    const [customWebhookUrl, setCustomWebhookUrl] = useState('');
    const [customWebhookSending, setCustomWebhookSending] = useState(false);
    const [customWebhookResult, setCustomWebhookResult] = useState(null);

    // GTA World OAuth login handler
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);

    const handleGtaWorldLogin = () => {
        // Replace with your actual client ID and callback URL
        const clientId = process.env.REACT_APP_GTAWORLD_CLIENT_ID || 'YOUR_CLIENT_ID';
        const redirectUri = encodeURIComponent(window.location.origin + '/auth/gta/callback');
        const authUrl = `https://ucp.gta.world/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`;
        window.location.href = authUrl;
    };

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


    const [showCctvWebhookModal, setShowCctvWebhookModal] = useState(false);
    
    // Webhook Management States
    const [webhooks, setWebhooks] = useState([]);
    const [newWebhook, setNewWebhook] = useState({ name: '', url: '', type: 'all' });
    const [isUpdatingWebhooks, setIsUpdatingWebhooks] = useState(false);
    const [logRefreshTrigger, setLogRefreshTrigger] = useState(0);
    
    const [showUserManagementModal, setShowUserManagementModal] = useState(false);
    const [showOAuthTokenExchangeModal, setShowOAuthTokenExchangeModal] = useState(false);
    const [showUserDataExchangeModal, setShowUserDataExchangeModal] = useState(false);
    const [gtaWorldUser, setGtaWorldUser] = useState(null);

    const [formGeneratorStatus, setFormGeneratorStatus] = useState('');
    const [alternativeFormGeneratorStatus, setAlternativeFormGeneratorStatus] = useState('');
    const [localHostStatus, setLocalHostStatus] = useState('');
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);

    const [lockdownConfig, setLockdownConfig] = useState({
        enabled: false,
        notification: '',
        dialog: '',
        affectedDeployments: [],
    });

    const prevUserUidRef = useRef(null);

    const logWebhookToFirebase = async (type, payload) => {
        const db = database;
        const logsRef = ref(db, 'webhook_logs');
        const newLogRef = push(logsRef);
        await set(newLogRef, {
            type,
            payload,
            timestamp: Date.now(),
        });
    };

    useEffect(() => {
        const statusRef = ref(database, 'serviceStatus');
        const unsubscribe = onValue(statusRef, (snapshot) => {
            const statusData = snapshot.val();
            setFormGeneratorStatus(statusData?.formGeneratorStatus || '');
            setAlternativeFormGeneratorStatus(statusData?.alternativeFormGeneratorStatus || '');
            setLocalHostStatus(statusData?.localHostStatus || '');
            setIsLoadingStatus(false);
        });
        return () => unsubscribe();
    }, []);

    // Load webhooks on component mount
    useEffect(() => {
        if (currentUser) {
            loadWebhooks();
        }
    }, [currentUser]);

    useEffect(() => {
        const lockdownRef = ref(database, 'adminSettings/lockdownConfig');
        const unsubscribe = onValue(lockdownRef, (snapshot) => {
            const lockdownData = snapshot.val();
            if (lockdownData) {
                setLockdownConfig({
                    enabled: lockdownData.enabled || false,
                    notification: lockdownData.notification || '',
                    dialog: lockdownData.dialog || '',
                    affectedDeployments: lockdownData.affectedDeployments || [],
                });
            }
        });
        return () => unsubscribe();
    }, []);

    const handleUpdateServiceStatus = async () => {
        setIsUpdatingDb(true);
        const statusRef = ref(database, 'serviceStatus');
        const { userAgent, timeZone } = getUserContext();
        const newStatuses = {
            formGeneratorStatus,
            alternativeFormGeneratorStatus,
            localHostStatus
        };
        try {
            await update(statusRef, newStatuses);
            showInAppNotification(`Service statuses updated.`, "check-circle");
            sendAdminActionWebhook(
                currentUser.email,
                "Updated Service Status",
                `Form Generator: ${formGeneratorStatus}\
Alternative Form Generator: ${alternativeFormGeneratorStatus}\
Localhost/Staging: ${localHostStatus}`,
                "Service Status",
                userAgent,
                timeZone
            );
        } catch (error) {
            console.error("Error updating service status:", error);
            showInAppNotification("Failed to update service statuses.", "error");
            sendAdminActionWebhook(
                currentUser.email,
                "Failed to Update Service Status",
                `Error: ${error.message}`,
                "Service Status",
                userAgent,
                timeZone
            );
        } finally {
            setIsUpdatingDb(false);
        }
    };

    const handleUpdateLockdownStatus = async () => {
        setIsUpdatingDb(true);
        const lockdownRef = ref(database, 'adminSettings/lockdownConfig');
        const { userAgent, timeZone } = getUserContext();
        try {
            await update(lockdownRef, lockdownConfig);
            showInAppNotification(`Lockdown status updated.`, "check-circle");
            sendAdminActionWebhook(
                currentUser.email,
                "Updated Lockdown Status",
                `Enabled: ${lockdownConfig.enabled}\
Notification: ${lockdownConfig.notification}\
Dialog: ${lockdownConfig.dialog}\
Affected Deployments: ${lockdownConfig.affectedDeployments.join(', ')}`,
                "Lockdown Status",
                userAgent,
                timeZone
            );
        } catch (error) {
            console.error("Error updating lockdown status:", error);
            showInAppNotification("Failed to update lockdown status.", "error");
            sendAdminActionWebhook(
                currentUser.email,
                "Failed to Update Lockdown Status",
                `Error: ${error.message}`,
                "Lockdown Status",
                userAgent,
                timeZone
            );
        } finally {
            setIsUpdatingDb(false);
        }
    };

    const handleCctvWebhookSubmit = async (cctvData) => {
        const webhookURL = process.env.REACT_APP_LEO_WEBHOOK_URL; // Using the general dev webhook for this test
        const { userAgent, timeZone } = getUserContext();

        if (!webhookURL) {
            if (showInAppNotification) showInAppNotification('Webhook URL (REACT_APP_LEO_WEBHOOK_URL) not configured.', 'error');
            Sentry.captureMessage("CCTV Test Webhook URL not configured", "error");
            return false; // Indicate failure
        }

        const embed = {
            title: "(( 📹 Alert from the System Administrator )) ",
            color: 0x5865F2, // Discord Blurplenull
            fields: [
                { name: "Notes:", value: cctvData.rank || "N/A", inline: true },
/*                 { name: "Requesting Officer", value: cctvData.officer || "N/A", inline: true },
                { name: "Officer Phone Number", value: cctvData.officerPH || "N/A", inline: true },
                { name: "Requesting Department", value: cctvData.department || "N/A", inline: true },
                ...(cctvData.discordUsername ? [{ name: "Discord Username", value: cctvData.discordUsername, inline: true }] : []),
                { name: "Date/Time of Incident", value: cctvData.incidentDateTime || "N/A", inline: true },
                { name: "Reason for Request", value: cctvData.requestReason || "N/A", inline: true },
                { name: "CCTV Location", value: cctvData.location || "N/A", inline: false },
                { name: "Description of Events", value: ```${cctvData.description || "N/A"}```, inline: false },
                ...(cctvData.oocNotes ? [{ name: "OOC Notes", value: ```${cctvData.oocNotes}```, inline: false }] : []),
 */            ],
            timestamp: new Date().toISOString(),
            footer: { text: "PHMC Tools - Developer Notification Service" }
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
        } finally {
            setIsLoadingRecruitmentData(false);
        }
    }, [setFormData, showInAppNotification]);
    const [webhookMessage, setWebhookMessage] = useState('');

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
    }, [setFormData, showInAppNotification]);

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

    // Webhook Management Functions
    const handleAddWebhook = async () => {
        if (!newWebhook.name || !newWebhook.url || !newWebhook.type) {
            if (showInAppNotification) showInAppNotification('Please fill in all webhook fields', 'error');
            return;
        }

        setIsUpdatingWebhooks(true);
        try {
            const webhooksRef = ref(database, 'webhooks');
            const newWebhookRef = push(webhooksRef);
            await set(newWebhookRef, {
                ...newWebhook,
                createdAt: Date.now(),
                createdBy: currentUser.email
            });
            
            // Reset form
            setNewWebhook({ name: '', url: '', type: 'all' });
            
            if (showInAppNotification) showInAppNotification('Webhook added successfully!', 'check-circle');
            
            // Refresh webhooks list
            await loadWebhooks();
        } catch (error) {
            console.error('Error adding webhook:', error);
            if (showInAppNotification) showInAppNotification('Failed to add webhook', 'error');
        } finally {
            setIsUpdatingWebhooks(false);
        }
    };

    const handleDeleteWebhook = async (webhookId) => {
        if (!window.confirm('Are you sure you want to delete this webhook?')) return;
        
        setIsUpdatingWebhooks(true);
        try {
            const webhookRef = ref(database, `webhooks/${webhookId}`);
            await remove(webhookRef);
            if (showInAppNotification) showInAppNotification('Webhook deleted successfully!', 'check-circle');
            
            // Refresh webhooks list
            await loadWebhooks();
        } catch (error) {
            console.error('Error deleting webhook:', error);
            if (showInAppNotification) showInAppNotification('Failed to delete webhook', 'error');
        } finally {
            setIsUpdatingWebhooks(false);
        }
    };

    const loadWebhooks = async () => {
        try {
            const webhooksRef = ref(database, 'webhooks');
            const snapshot = await get(webhooksRef);
            if (snapshot.exists()) {
                const webhooksData = snapshot.val();
                const webhooksList = Object.keys(webhooksData).map(key => ({
                    id: key,
                    ...webhooksData[key]
                }));
                setWebhooks(webhooksList);
            } else {
                setWebhooks([]);
            }
        } catch (error) {
            console.error('Error loading webhooks:', error);
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
            `Position: ${positionDisplayName}\
New Status: ${newStatus}`,
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
            `Position: ${positionDisplayName}\
Attempted Status: ${newStatus}\
Error: ${dbError.message}`,
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
                `Role Name: ${savedRoleData.displayName || savedRoleData.originalKey}\
Short Code: ${savedRoleData.shortCode || 'N/A'}\
Status: ${savedRoleData.status || 'N/A'}\
Key: ${savedRoleData.originalKey}`,
                categoryConfig?.displayName || "Unknown Category",
                userAgent,
                timeZone
            );
            if (desktopNotificationPermission === "granted" && savedRoleData?.displayName) {
                 const notificationTitle = actionType === 'edited' ? `Role Updated: ${categoryConfig?.displayName || 'Recruitment'}` : `New Role Added: ${categoryConfig?.displayName || 'Recruitment'}`;
                 const notificationBody = actionType === 'edited'
                    ? `Role \"${savedRoleData.displayName}\" (${savedRoleData.shortCode || 'N/A'}) has been updated.`
                    : `Role \"${savedRoleData.displayName}\" (${savedRoleData.shortCode || 'N/A'}) has been added.`;
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
            showDesktopNotification(`Role Key Renamed: ${categoryConfig?.displayName || 'Recruitment'}`, 
                { body: `Key for \"${roleToRenameKeyDetails.data.displayName || roleToRenameKeyDetails.key}\" has been changed.`, 
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
            showDesktopNotification("PHMC Tools: Notifications Enabled", { body: "You will now receive desktop notifications for important admin actions. Ensure your OS allows browser notifications.", icon: '/phmc512.png' });
        } else {
            if (currentPermission === 'denied') {
                if (showInAppNotification) showInAppNotification("Desktop notifications are blocked. Please enable them in your browser settings.", "warning");
            } else {
                if (showInAppNotification) showInAppNotification("Desktop notifications were not enabled.", "warning");
            }
        }
    };

    const handleAdminCustomWebhookSubmit = async (payloadFromModal) => {
        const webhookURLIdentifier = "REACT_APP_PHMC_DISCORD or REACT_APP_DEV_WEBHOOK";
        const webhookURL = process.env.REACT_APP_PHMC_DISCORD || process.env.REACT_APP_DEV_WEBHOOK;
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
                // setShowAdminCustomWebhookModal(false); // REMOVED - state no longer exists
                sendAdminActionWebhook(currentUser?.email || "Unknown User", "Sent Admin Custom Webhook", "Admin successfully sent a custom webhook to the Admin Action channel.", null, userAgent, timeZone);
                logWebhookToFirebase('Admin Custom Webhook Sent', { admin: currentUser?.email, title: payloadFromModal.embeds[0].title });
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
        if (results.success.length > 0) details += `✅ Regenerated: ${results.success.join(', ')}\
`;
        if (results.noCard.length > 0) details += `➖ Skipped (Disabled): ${results.noCard.join(', ')}\
`;
        if (results.notEnoughPhrases.length > 0) details += `⚠️ Skipped (Not Enough Phrases): ${results.notEnoughPhrases.join(', ')}\
`;
        if (results.errors.length > 0) details += `❌ Errors: ${results.errors.join(', ')}\
`;
    
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







    const handleOpenDevWebhookModal = () => {
        // setDevWebhookTitle(''); // REMOVED - state no longer exists
        // setDevWebhookMessage(''); // REMOVED - state no longer exists
        // setShowDevWebhookModal(true); // REMOVED - state no longer exists
        const { userAgent, timeZone } = getUserContext();
        sendAdminActionWebhook(currentUser?.email || "Unknown User", "Opened Dev Webhook Modal", "Admin opened the modal to send a custom webhook to the Dev channel.", null, userAgent, timeZone);
    };

    const handleDevWebhookSubmit = async (payloadFromModal) => {
        const webhookURLIdentifier = "REACT_APP_DEV_WEBHOOK";
        const webhookURL = process.env.REACT_APP_DEV_WEBHOOK;
        const { userAgent, timeZone } = getUserContext();

        if (!webhookURL) {
            if (showInAppNotification) showInAppNotification('Dev Webhook URL (REACT_APP_DEV_WEBHOOK) not configured.', 'error');
            Sentry.captureMessage("Dev Webhook URL (REACT_APP_DEV_WEBHOOK) not configured", "error");
            sendAdminActionWebhook(currentUser?.email || "Unknown User", "Failed to Send Dev Custom Webhook", "Webhook URL not configured.", null, userAgent, timeZone);
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
                console.error(`Failed to send Dev webhook. Status: ${response.status}`, errorText);
                Sentry.captureMessage(`Dev Discord webhook failed: ${response.status}`, {
                    level: 'error',
                    extra: { statusText: response.statusText, responseBody: errorText }
                });
                if (showInAppNotification) showInAppNotification(`Failed to send Dev webhook. Status: ${response.status}`, 'error');
                sendAdminActionWebhook(currentUser?.email || "Unknown User", "Failed to Send Dev Custom Webhook", `Status: ${response.status}, Error: ${errorText}`, null, userAgent, timeZone);
                return false;
            } else {
                if (showInAppNotification) showInAppNotification('Dev webhook message sent successfully!', "check-circle");
                // setShowDevWebhookModal(false); // REMOVED - state no longer exists
                sendAdminActionWebhook(currentUser?.email || "Unknown User", "Sent Dev Custom Webhook", "Admin successfully sent a custom webhook to the Dev channel.", null, userAgent, timeZone);
                return true;
            }
        } catch (error) {
            console.error('Error sending Dev webhook:', error);
            Sentry.captureException(error, { extra: { context: 'Dev Webhook Submission Fetch' } });
            if (showInAppNotification) showInAppNotification('A network error occurred sending the Dev webhook.', "error");
            sendAdminActionWebhook(currentUser?.email || "Unknown User", "Failed to Send Dev Custom Webhook", `Network Error: ${error.message}`, null, userAgent, timeZone);
            return false;
        }
    };


    const handleOpenCoronerWebhookModal = () => {
        // setCoronerWebhookTitle(''); // REMOVED - state no longer exists
        // setCoronerWebhookMessage(''); // REMOVED - state no longer exists
        // setShowCoronerWebhookModal(true); // REMOVED - state no longer exists
        const { userAgent, timeZone } = getUserContext(); // Capture user context
        sendAdminActionWebhook(currentUser?.email || "Unknown User", "Opened Coroner Webhook Modal", "Admin opened the modal to send a custom webhook to the Coroner Updates channel.", null, userAgent, timeZone);
    };
    const [showMarkdownModal, setShowMarkdownModal] = useState(false);

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
                // setShowCoronerWebhookModal(false); // REMOVED - state no longer exists
                sendAdminActionWebhook(currentUser?.email || "Unknown User", "Sent Coroner Custom Webhook", "Admin successfully sent a custom webhook to the Coroner Updates channel.", null, userAgent, timeZone);
                logWebhookToFirebase('Coroner Custom Webhook Sent', { admin: currentUser?.email, title: payloadFromModal.embeds[0].title });
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
            <div className="container mt-5">
                <div className="row justify-content-center">
                    <div className="col-md-6 col-lg-4">
                        <div className="card">
                            <div className="card-body">
                                <h3 className="card-title text-center mb-4">Admin Login</h3>
                                <BootstrapForm.Group className="mb-3" controlId="adminAuthEmail">
                                    <BootstrapForm.Label>Email address</BootstrapForm.Label>
                                    <BootstrapForm.Control type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Enter email" />
                                </BootstrapForm.Group>
                                <BootstrapForm.Group className="mb-3" controlId="adminAuthPassword">
                                    <BootstrapForm.Label>Password</BootstrapForm.Label>
                                    <BootstrapForm.Control type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={handlePasswordKeyDown} required placeholder="Password" />
                                </BootstrapForm.Group>
                                {error && <p className="text-danger text-center">{error}</p>}
                                <div className="d-grid">
                                    <Button variant="primary" type="button" onClick={handleLoginAttempt}>
                                        Login
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const selectedTypeForEdit = BINGO_TYPES.find(type => type.id === selectedAdminBingoType);


    // Helper to build rich Discord embed payload with PHMC branding
    const buildWebhookPayload = (title, message, customUrl = '') => {
        const FORM_GENERATOR_URL = "https://phmc-tools.gta.world/";
        const ALTERNATIVE_FORM_GENERATOR_URL = "https://gtaw-forms.github.io/forms/";
        const phmcLogoUrl = 'https://i.ibb.co/0pgw9hHm/phmc.png';
        
        // Create embed fields with form generator links
        const embedFields = [];
        if (FORM_GENERATOR_URL) {
            embedFields.push({ 
                name: "[Delayed Updates] Form Generator Link", 
                value: FORM_GENERATOR_URL, 
                inline: false 
            });
        }
        if (ALTERNATIVE_FORM_GENERATOR_URL) {
            embedFields.push({ 
                name: "Alternative Form Generator Link", 
                value: ALTERNATIVE_FORM_GENERATOR_URL, 
                inline: false 
            });
        }
        
        // Add custom URL field if provided
        if (customUrl && customUrl.trim()) {
            embedFields.push({
                name: "Related Link",
                value: customUrl.trim(),
                inline: false
            });
        }
                
        const embed = {
            title: title || "PHMC Admin Notification",
            url: customUrl && customUrl.trim() ? customUrl.trim() : FORM_GENERATOR_URL,
            description: message || undefined,
            color: 0x7289DA, // Discord blue color matching WebhookModal
            timestamp: new Date().toISOString(),
            fields: embedFields,
            footer: {
                text: `PHMC Form Generator v${commitInfo?.sha || 'N/A'}`
            }
        };
        
        return {
            username: "PHMC Admin",
            avatar_url: phmcLogoUrl,
            embeds: [embed]
        };
    };

    const handleSendCustomWebhook = async (e) => {
        e.preventDefault();
        setCustomWebhookSending(true);
        setCustomWebhookResult(null);
        
        // Find the selected webhook
        const selectedWebhook = webhooks.find(hook => hook.id === customWebhookChannel);
        if (!selectedWebhook) {
            console.error('No webhook selected or webhook not found');
            setCustomWebhookResult('error');
            setCustomWebhookSending(false);
            return;
        }

        const payload = buildWebhookPayload(customWebhookTitle, customWebhookMessage, customWebhookUrl);
        let result = false;
        
        try {
            const response = await fetch(selectedWebhook.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            result = response.ok;
            if (!result) {
                console.error('Webhook send failed:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('Error sending custom webhook:', error);
            result = false;
        }
        
        setCustomWebhookResult(result ? 'success' : 'error');
        setCustomWebhookSending(false);
        if (result) {
            setCustomWebhookTitle('');
            setCustomWebhookMessage('');
            setCustomWebhookUrl('');
        }
    };

    return (
        <>
            {/* --- Main Admin Dashboard --- */}
            <AdminDashboard
                currentUser={currentUser}
                gtaWorldUser={gtaWorldUser}
                desktopNotificationPermission={desktopNotificationPermission}
                handleEnableDesktopNotifications={handleEnableDesktopNotifications}
                isLoadingStatus={isLoadingStatus}
                formGeneratorStatus={formGeneratorStatus}
                setFormGeneratorStatus={setFormGeneratorStatus}
                alternativeFormGeneratorStatus={alternativeFormGeneratorStatus}
                setAlternativeFormGeneratorStatus={setAlternativeFormGeneratorStatus}
                localHostStatus={localHostStatus}
                setLocalHostStatus={setLocalHostStatus}
                handleUpdateServiceStatus={handleUpdateServiceStatus}
                isUpdatingDb={isUpdatingDb}
                selectedRecruitmentCategory={selectedRecruitmentCategory}
                setSelectedRecruitmentCategory={setSelectedRecruitmentCategory}
                recruitmentCategories={recruitmentCategories}
                handleAddRoleClick={handleAddRoleClick}
                isLoadingRecruitmentData={isLoadingRecruitmentData}
                currentRecruitmentData={currentRecruitmentData}
                handleRenameRoleKeyClick={handleRenameRoleKeyClick}
                handleEditRoleClick={handleEditRoleClick}
                handleTogglePositionStatus={handleTogglePositionStatus}
                selectedAdminBingoType={selectedAdminBingoType}
                setSelectedAdminBingoType={setSelectedAdminBingoType}
                BINGO_TYPES={BINGO_TYPES}
                handleManualResetAllBingoCards={handleManualResetAllBingoCards}
                handleGenerateNewBingoCard={handleGenerateNewBingoCard}
                handleClearBingoActivity={handleClearBingoActivity}
                handleDisableBingoCard={handleDisableBingoCard}
                setShowEditBingoPhrasesModal={setShowEditBingoPhrasesModal}
                selectedTypeForEdit={selectedTypeForEdit}
                setShowReviewPhrasesModal={setShowReviewPhrasesModal}
                setShowUserManagementModal={setShowUserManagementModal}

                setShowCctvWebhookModal={setShowCctvWebhookModal}
                setShowMarkdownModal={setShowMarkdownModal}
                handleLogout={handleLogout}
                Sentry={Sentry}
                showInAppNotification={showInAppNotification}
                handleGtaWorldLogin={handleGtaWorldLogin}
                setShowOAuthTokenExchangeModal={setShowOAuthTokenExchangeModal}
                setShowUserDataExchangeModal={setShowUserDataExchangeModal}
                lockdownConfig={lockdownConfig}
                setLockdownConfig={setLockdownConfig}
                handleUpdateLockdownStatus={handleUpdateLockdownStatus}
                webhooks={webhooks}
                newWebhook={newWebhook}
                setNewWebhook={setNewWebhook}
                handleAddWebhook={handleAddWebhook}
                handleDeleteWebhook={handleDeleteWebhook}
                isUpdatingWebhooks={isUpdatingWebhooks}
                customWebhookChannel={customWebhookChannel}
                setCustomWebhookChannel={setCustomWebhookChannel}
                customWebhookTitle={customWebhookTitle}
                setCustomWebhookTitle={setCustomWebhookTitle}
                customWebhookMessage={customWebhookMessage}
                setCustomWebhookMessage={setCustomWebhookMessage}
                customWebhookUrl={customWebhookUrl}
                setCustomWebhookUrl={setCustomWebhookUrl}
                customWebhookSending={customWebhookSending}
                customWebhookResult={customWebhookResult}
                handleSendCustomWebhook={handleSendCustomWebhook}
                logRefreshTrigger={logRefreshTrigger}
            />

            {selectedRecruitmentCategory && recruitmentCategories[selectedRecruitmentCategory] && (
                <AddRoleModal show={showRoleModal} onHide={handleCloseRoleModal} categoryKey={selectedRecruitmentCategory} categoryConfig={recruitmentCategories[selectedRecruitmentCategory]} showNotification={showInAppNotification} onRoleSaved={handleRoleSaved} roleToEdit={roleToEdit} />
            )}
            {roleToRenameKeyDetails && selectedRecruitmentCategory && recruitmentCategories[selectedRecruitmentCategory] && (
                <RenameRoleKeyModal show={showRenameKeyModal} onHide={() => { setShowRenameKeyModal(false); setRoleToRenameKeyDetails(null); }} categoryConfig={recruitmentCategories[selectedRecruitmentCategory]} currentRoleKey={roleToRenameKeyDetails.key} currentRoleData={roleToRenameKeyDetails.data} showInAppNotification={showInAppNotification} onKeyRenamed={handleRoleKeyRenamed} sendAdminActionWebhook={sendAdminActionWebhook} adminUserEmail={currentUser?.email} />
            )}


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

            <UserManagementModal
                show={showUserManagementModal}
                onHide={() => setShowUserManagementModal(false)}
                database={database}
                showNotification={showInAppNotification}
            />
            <OAuthTokenExchangeModal
                show={showOAuthTokenExchangeModal}
                onHide={() => setShowOAuthTokenExchangeModal(false)}
                showNotification={showInAppNotification}
                sendAdminActionWebhook={sendAdminActionWebhook}
                adminUserEmail={currentUser?.email}
                onUserDataReceived={setGtaWorldUser}
            />
            <UserDataExchangeModal
                show={showUserDataExchangeModal}
                onHide={() => setShowUserDataExchangeModal(false)}
                showNotification={showInAppNotification}
                sendAdminActionWebhook={sendAdminActionWebhook}
                adminUserEmail={currentUser?.email}
            />
        </>
    );
};

export default AdminAuthAndActions;