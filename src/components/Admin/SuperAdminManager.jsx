import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Form, Spinner, Alert, Card } from 'react-bootstrap';
import { getDatabase, ref, get, set, remove } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';

const SuperAdminManager = ({ showNotification }) => {
    const [admins, setSuperAdmins] = useState([]);
    const [newUid, setNewUid] = useState('');
    const [loading, setLoading] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [error, setError] = useState(null);

    const fetchSuperAdmins = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const db = getDatabase();
            const adminsRef = ref(db, 'super_admins');
            const snapshot = await get(adminsRef);
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list = Object.keys(data).map(uid => ({
                    uid,
                    addedAt: data[uid].addedAt || Date.now()
                }));
                setSuperAdmins(list);
            } else {
                setSuperAdmins([]);
            }
        } catch (err) {
            console.error("Error fetching super admins:", err);
            setError("Failed to load super admins. Check database rules.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSuperAdmins();
    }, [fetchSuperAdmins]);

    const handleSyncMyClaims = async () => {
        setIsSyncing(true);
        try {
            const functions = getFunctions();
            const syncFunc = httpsCallable(functions, 'syncAdminClaims');
            const result = await syncFunc();
            
            if (result.data.success) {
                showNotification && showNotification(result.data.message, 'success');
                // Instruction for the user to refresh
                setTimeout(() => {
                    if (window.confirm("Claims synced! You need to reload the application to apply the new permissions. Reload now?")) {
                        window.location.reload();
                    }
                }, 500);
            } else {
                showNotification && showNotification(result.data.message || "Sync failed", 'warning');
            }
        } catch (err) {
            console.error("Error syncing claims:", err);
            showNotification && showNotification("Failed to sync admin claims. Check console.", 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleAddAdmin = async (e) => {
        e.preventDefault();
        let targetUid = newUid.trim();
        if (!targetUid) return;

        // Auto-prefix numeric IDs with gtaw: if prefix is missing
        if (/^\d+$/.test(targetUid)) {
            targetUid = `gtaw:${targetUid}`;
        }

        setIsAdding(true);
        try {
            const db = getDatabase();
            const adminRef = ref(db, `super_admins/${targetUid}`);
            await set(adminRef, {
                addedAt: Date.now(),
                status: true
            });
            showNotification && showNotification(`UID ${targetUid} added as Super Admin`, 'success');
            setNewUid('');
            fetchSuperAdmins();
        } catch (err) {
            console.error("Error adding super admin:", err);
            showNotification && showNotification("Failed to add super admin. Ensure you have Super Admin claims (Sync first!)", 'error');
        } finally {
            setIsAdding(false);
        }
    };

    const handleRemoveAdmin = async (uid) => {
        if (!window.confirm(`Are you sure you want to remove Super Admin status for UID: ${uid}?`)) return;

        try {
            const db = getDatabase();
            const adminRef = ref(db, `super_admins/${uid}`);
            await remove(adminRef);
            showNotification && showNotification(`UID ${uid} removed from Super Admins`, 'info');
            fetchSuperAdmins();
        } catch (err) {
            console.error("Error removing super admin:", err);
            showNotification && showNotification("Failed to remove super admin", 'error');
        }
    };

    return (
        <Card className="mt-4 border-danger">
            <Card.Header className="bg-danger text-white d-flex justify-content-between align-items-center">
                <h6 className="mb-0"><i className="fas fa-user-shield me-2"></i>Super Admin Management (UID-based)</h6>
                <Button 
                    variant="light" 
                    size="sm" 
                    onClick={handleSyncMyClaims} 
                    disabled={isSyncing}
                    title="Sync your Google account with SuperAdmin claims"
                >
                    {isSyncing ? <Spinner size="sm" /> : <><i className="fas fa-sync me-1"></i> Sync My Claims</>}
                </Button>
            </Card.Header>
            <Card.Body>
                <Alert variant="warning" className="small py-2">
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    <strong>Step 1:</strong> Click <strong>Sync My Claims</strong> to get SuperAdmin permissions on your Google account.
                    <br />
                    <strong>Step 2:</strong> Add other UCP IDs (e.g. <code>43132</code>) or Firebase UIDs here.
                </Alert>

                <Form onSubmit={handleAddAdmin} className="mb-4">
                    <Form.Group className="d-flex gap-2">
                        <Form.Control
                            type="text"
                            placeholder="Enter UCP ID (e.g. 43132) or UID"
                            value={newUid}
                            onChange={(e) => setNewUid(e.target.value)}
                            disabled={isAdding}
                        />
                        <Button variant="danger" type="submit" disabled={isAdding || !newUid.trim()}>
                            {isAdding ? <Spinner size="sm" /> : 'Add Admin'}
                        </Button>
                    </Form.Group>
                </Form>

                {loading ? (
                    <div className="text-center py-3">
                        <Spinner animation="border" size="sm" />
                    </div>
                ) : error ? (
                    <Alert variant="danger">{error}</Alert>
                ) : (
                    <Table size="sm" responsive hover>
                        <thead>
                            <tr>
                                <th>Firebase UID</th>
                                <th>Added</th>
                                <th className="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {admins.length > 0 ? (
                                admins.map(admin => (
                                    <tr key={admin.uid}>
                                        <td className="font-monospace small">{admin.uid}</td>
                                        <td>{new Date(admin.addedAt).toLocaleDateString()}</td>
                                        <td className="text-end">
                                            <Button 
                                                variant="outline-danger" 
                                                size="sm" 
                                                onClick={() => handleRemoveAdmin(admin.uid)}
                                            >
                                                <i className="fas fa-trash"></i>
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="3" className="text-center text-muted py-3">
                                        No UID-based super admins found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                )}
            </Card.Body>
        </Card>
    );
};

export default SuperAdminManager;