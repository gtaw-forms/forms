import { logAdminAction, getUserContext } from '../../utils/adminLogger';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import { ref, get, set, remove, update } from "firebase/database";
import './UserManagementModal.css';

const UserManagementModal = ({ show, onHide, database, showNotification }) => {
    const { user: gtawUser, username: gtawUsername } = useGtaWorldAuth();
    const [users, setUsers] = useState([]);
    const [sourceUser, setSourceUser] = useState('');
    const [destinationUser, setDestinationUser] = useState('');
    const [confirm, setConfirm] = useState(false);
    const [error, setError] = useState('');

    const comprehensiveSanitize = (str) => {
        if (!str) return '';
        let sanitized = str.trim().replace(/[.#$[/ \]]+/g, '_');
        sanitized = sanitized.replace(/_{2,}/g, '_');
        sanitized = sanitized.replace(/^_+|_+$/g, '');
        return sanitized;
    };

    useEffect(() => {
        if (show) {
            const fetchUsers = async () => {
                try {
                    const savedReportsRef = ref(database, 'savedReports');
                    const snapshot = await get(savedReportsRef);
                    if (snapshot.exists()) {
                        setUsers(Object.keys(snapshot.val()));
                    } else {
                        setUsers([]);
                    }
                } catch (error) {
                    console.error("Error fetching users:", error);
                    setError("Failed to fetch users.");
                }
            };
            fetchUsers();
        }
    }, [show, database]);

    const sanitizeForFirebasePath = (str) => {
        return str.replace(/[.#$[/ \]]/g, '_');
    };

    const handleSanitizeAllUsernames = async () => {
        if (!window.confirm("Are you sure you want to sanitize all usernames? This will clean up spaces and multiple underscores. This is a one-time operation and cannot be undone.")) {
            return;
        }
        const { userAgent, timeZone } = getUserContext();
        logAdminAction(
            gtawUsername,
            'Sanitized All Usernames',
            'Triggered sanitization for all usernames.',
            'User Management',
            userAgent,
            timeZone,
            gtawUsername,
            gtawUser
        );

        const savedReportsRef = ref(database, 'savedReports');
        try {
            const snapshot = await get(savedReportsRef);
            if (!snapshot.exists()) {
                showNotification("No saved reports found to sanitize.", "info");
                return;
            }

            const allReports = snapshot.val();
            const updates = {};
            let sanitizedCount = 0;

            for (const userName in allReports) {
                const sanitizedUserName = comprehensiveSanitize(userName);
                if (userName !== sanitizedUserName) {
                    const oldUserData = allReports[userName];
                    const newUserData = allReports[sanitizedUserName] || {};

                    for (const reportId in oldUserData) {
                        if (!newUserData[reportId]) {
                            newUserData[reportId] = oldUserData[reportId];
                        }
                    }

                    updates[`savedReports/${sanitizedUserName}`] = newUserData;
                    updates[`savedReports/${userName}`] = null;
                    sanitizedCount++;
                }
            }

            if (sanitizedCount > 0) {
                await update(ref(database), updates);
                showNotification(`Successfully sanitized ${sanitizedCount} usernames.`, "success");
            } else {
                showNotification("No usernames found that required sanitization.", "info");
            }

            const newSnapshot = await get(savedReportsRef);
            if (newSnapshot.exists()) {
                setUsers(Object.keys(newSnapshot.val()));
            } else {
                setUsers([]);
            }

        } catch (error) {
            console.error("Error sanitizing all usernames:", error);
            showNotification(`Error sanitizing usernames: ${error.message}`, "error");
        }
    };

    const handleMigrateAllUsernames = async () => {
        if (!window.confirm("Are you sure you want to migrate all usernames with spaces to use underscores? This is a one-time operation and cannot be undone.")) {
            return;
        }

        const { userAgent, timeZone } = getUserContext();
        logAdminAction(
            gtawUsername,
            'Migrated All Usernames',
            'Triggered migration for all usernames with spaces.',
            'User Management',
            userAgent,
            timeZone,
            gtawUsername,
            gtawUser
        );
    
        const savedReportsRef = ref(database, 'savedReports');
        try {
            const snapshot = await get(savedReportsRef);
            if (!snapshot.exists()) {
                showNotification("No saved reports found to migrate.", "info");
                return;
            }
    
            const allReports = snapshot.val();
            const updates = {};
            let migratedCount = 0;
    
            for (const userName in allReports) {
                if (userName.includes(' ')) {
                    const newUserName = userName.replace(/ /g, '_');
                    const oldUserData = allReports[userName];
                    const newUserData = allReports[newUserName] || {};
    
                    // Merge old data into new data, avoiding overwrites
                    for (const reportId in oldUserData) {
                        if (!newUserData[reportId]) {
                            newUserData[reportId] = oldUserData[reportId];
                        }
                    }
    
                    updates[`savedReports/${newUserName}`] = newUserData;
                    updates[`savedReports/${userName}`] = null; // Mark for deletion
                    migratedCount++;
                }
            }
    
            if (migratedCount > 0) {
                await update(ref(database), updates);
                showNotification(`Successfully migrated ${migratedCount} usernames.`, "success");
            } else {
                showNotification("No usernames with spaces found to migrate.", "info");
            }
    
            // Refresh users in the dropdown
            const newSnapshot = await get(savedReportsRef);
            if (newSnapshot.exists()) {
                setUsers(Object.keys(newSnapshot.val()));
            } else {
                setUsers([]);
            }
    
        } catch (error) {
            console.error("Error migrating all usernames:", error);
            showNotification(`Error migrating usernames: ${error.message}`, "error");
        }
    };

    const handleMigrate = async () => {
        if (!sourceUser || !destinationUser || !confirm) {
            setError("Please select both users and confirm the migration.");
            return;
        }

        if (sourceUser === destinationUser) {
            setError("Source and destination users cannot be the same.");
            return;
        }

        setError('');

        const { userAgent, timeZone } = getUserContext();
        logAdminAction(
            gtawUsername,
            'Migrated User Data',
            `From: ${sourceUser}\nTo: ${destinationUser}`,
            'User Management',
            userAgent,
            timeZone,
            gtawUsername,
            gtawUser
        );

        const sourceUserRef = ref(database, `savedReports/${sourceUser}`);
        const destinationUserRef = ref(database, `savedReports/${destinationUser}`);
        const backupDate = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
        const sanitizedDestinationUser = sanitizeForFirebasePath(destinationUser);
        const backupRef = ref(database, `migrationBackups/${sanitizedDestinationUser}_${backupDate}`);
        let destinationBackup = null;

        try {
            const sourceSnapshot = await get(sourceUserRef);
            if (!sourceSnapshot.exists()) {
                showNotification("Source user has no data to migrate.", "warning");
                return;
            }

            const destinationSnapshot = await get(destinationUserRef);
            if (destinationSnapshot.exists()) {
                destinationBackup = destinationSnapshot.val();
                await set(backupRef, destinationBackup);
            }

            const sourceReports = sourceSnapshot.val();
            const destinationReports = destinationBackup || {};
            const conflictedReports = [];
            let migratedCount = 0;

            Object.keys(sourceReports).forEach(key => {
                if (destinationReports[key]) {
                    conflictedReports.push(key);
                } else {
                    destinationReports[key] = sourceReports[key];
                    migratedCount++;
                }
            });

            await set(destinationUserRef, destinationReports);
            await remove(sourceUserRef);

            if (conflictedReports.length > 0) {
                showNotification(`Migration complete, but ${conflictedReports.length} reports were not migrated due to conflicts.`, "warning");
            } else {
                showNotification("User data migrated successfully.", "success");
            }
            
            if (migratedCount > 0) {
                // Not sending notification for each migration anymore.
            }

            onHide();

        } catch (error) {
            console.error("Error migrating data:", error);
            showNotification(`Error migrating data: ${error.message}`, "error");

            if (destinationBackup) {
                await set(destinationUserRef, destinationBackup);
                showNotification("Migration failed. Destination user's original data has been restored.", "info");
            }
        }
    };

    return (
        <Modal show={show} onHide={onHide} className="user-management-modal">
            <Modal.Header closeButton>
                <Modal.Title>User Management</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                <p>Migrate saved reports from one user to another.</p>
                <Form>
                    <Form.Group className="mb-3">
                        <Form.Label>Select User to Migrate From</Form.Label>
                        <Form.Control as="select" value={sourceUser} onChange={e => setSourceUser(e.target.value)}>
                            <option value="">Select User</option>
                            {users.map(user => <option key={user} value={user}>{user}</option>)}
                        </Form.Control>
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Select User to Migrate To</Form.Label>
                        <Form.Control as="select" value={destinationUser} onChange={e => setDestinationUser(e.target.value)}>
                            <option value="">Select User</option>
                            {users.map(user => <option key={user} value={user}>{user}</option>)}
                        </Form.Control>
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="formBasicCheckbox">
                        <Form.Check type="checkbox" label="I confirm I want to migrate the data." checked={confirm} onChange={e => setConfirm(e.target.checked)} />
                    </Form.Group>
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>
                    Close
                </Button>
                <Button variant="success" onClick={handleSanitizeAllUsernames}>
                    Sanitize All Usernames
                </Button>
                <Button variant="warning" onClick={handleMigrateAllUsernames}>
                    Migrate All Usernames
                </Button>
                <Button variant="primary" onClick={handleMigrate} disabled={!sourceUser || !destinationUser || !confirm}>
                    Migrate Data
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default UserManagementModal;
