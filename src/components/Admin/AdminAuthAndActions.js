// src/components/Admin/AdminAuthAndActions.js
import React, { useState, useEffect, useCallback } from 'react';
import { Form as BootstrapForm, Button, Spinner, ListGroup } from 'react-bootstrap';
import { auth, database } from '../../firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { ref, get, update } from "firebase/database";
import AddRoleModal from './AddRoleModal';

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
    const [showAddRoleModal, setShowAddRoleModal] = useState(false);

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

            console.log("[Desktop Notify] Checking permission for status update notification:", desktopNotificationPermission);
            if (desktopNotificationPermission === "granted") {
                showDesktopNotification(`Status Updated: ${categoryConfig.displayName}`, {
                    body: `${positionDetails.displayName || positionDetails.name || positionKey} is now ${newStatus}.`,
                    icon: '/logo192.png',
                    tag: `status-update-${selectedRecruitmentCategory}-${positionKey}`
                });
            }
            fetchRecruitmentDataForCategory(selectedRecruitmentCategory);
        } catch (dbError) {
            if (showInAppNotification) showInAppNotification(`Failed to update status for ${positionKey}.`, "error");
        }
        setIsUpdatingDb(false);
    };

    const handleRoleAdded = () => {
        if (selectedRecruitmentCategory) {
            fetchRecruitmentDataForCategory(selectedRecruitmentCategory);
        }
    };

    const handleEnableDesktopNotifications = async () => {
        console.log("[Desktop Notify] 'Enable Desktop Notifications' button clicked.");
        const granted = await requestNotificationPermission();
        // Notification.permission might have been updated by the request, so re-read it
        const currentPermission = Notification.permission;
        console.log("[Desktop Notify] Permission after request:", currentPermission, "(Granted flag:", granted, ")");
        setDesktopNotificationPermission(currentPermission);

        if (granted) {
            if (showInAppNotification) showInAppNotification("Desktop notifications enabled!", "check-circle");
            showDesktopNotification("PHMC Forms: Notifications Enabled", {
                body: "You will now receive desktop notifications for important admin actions.",
                icon: '/logo192.png'
            });
        } else {
            if (currentPermission === 'denied') {
                if (showInAppNotification) showInAppNotification("Desktop notifications are blocked. Please enable them in your browser settings.", "warning");
            } else { // 'default' - user dismissed the prompt
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
                            onClick={() => setShowAddRoleModal(true)}
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
                    show={showAddRoleModal}
                    onHide={() => setShowAddRoleModal(false)}
                    categoryKey={selectedRecruitmentCategory}
                    categoryConfig={recruitmentCategories[selectedRecruitmentCategory]}
                    showNotification={showInAppNotification}
                    onRoleAdded={handleRoleAdded}
                />
            )}
        </div>
    );
};

export default AdminAuthAndActions;
