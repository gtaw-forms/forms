// src/components/Admin/AdminModal.js
import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Spinner, ListGroup } from 'react-bootstrap';
import { auth, database } from '../../firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { ref, get, update } from "firebase/database";

// Consistent overlay style - MODIFIED
const adminModalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(31, 41, 55, 0.75)', // Your backdrop color
    display: 'flex',
    alignItems: 'center', // Vertically center the content box
    justifyContent: 'center', // Horizontally center the content box
    zIndex: 99000,
    overflowY: 'auto', // Allow scrolling of the overlay if content box is very tall
    // Removed padding: '1rem' from here
};

// Base style for the modal's content box (remains the same)
const adminModalContentBoxBaseStyle = {
    position: 'relative',
    backgroundColor: '#0d1117',
    color: '#c9d1d9',
    borderRadius: '8px',
    border: '1px solid #30363d',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    maxHeight: '90vh',
};


function AdminModal({ show, onHide, showNotification, commitInfo }) {
    // ... (rest of your component logic remains the same) ...

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [isUpdatingDb, setIsUpdatingDb] = useState(false);

    const [physicianPositions, setPhysicianPositions] = useState({});
    const [isLoadingPositions, setIsLoadingPositions] = useState(false);

    useEffect(() => {
        if (!show) {
            setIsLoadingAuth(true);
            setPhysicianPositions({});
            return;
        }

        setIsLoadingAuth(true);
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                fetchPhysicianPositions();
            } else {
                setCurrentUser(null);
                setPhysicianPositions({});
            }
            setIsLoadingAuth(false);
        });
        return () => unsubscribe();
    }, [show]);

    const fetchPhysicianPositions = async () => {
        setIsLoadingPositions(true);
        try {
            const positionsRef = ref(database, 'selectOptions/physicianRecruitmentDetails');
            const snapshot = await get(positionsRef);
            if (snapshot.exists()) {
                setPhysicianPositions(snapshot.val());
            } else {
                setPhysicianPositions({});
                if (showNotification) showNotification("No physician recruitment data found.", "warning");
            }
        } catch (dbError) {
            console.error("Error fetching physician positions:", dbError);
            if (showNotification) showNotification("Failed to load physician positions.", "error");
            setPhysicianPositions({});
        }
        setIsLoadingPositions(false);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoadingAuth(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setError(err.message || "Failed to login.");
            console.error("Login error:", err);
            setIsLoadingAuth(false);
        }
    };

    const handleLogout = async () => {
        setError('');
        try {
            await signOut(auth);
            setEmail('');
            setPassword('');
            setPhysicianPositions({});
        } catch (err) {
            setError(err.message || "Failed to logout.");
            console.error("Logout error:", err);
        }
    };

    const handleModalClose = () => {
        setError('');
        onHide();
    };

    const handleTogglePositionStatus = async (positionKey, currentStatus) => {
        if (!currentUser) {
            if (showNotification) showNotification("You must be logged in to perform this action.", "error");
            return;
        }
        setIsUpdatingDb(true);
        const newStatus = currentStatus === "OPEN" ? "CLOSED" : "OPEN";
        const positionStatusPath = `selectOptions/physicianRecruitmentDetails/${positionKey}/status`;

        try {
            await update(ref(database), { [positionStatusPath]: newStatus });
            if (showNotification) showNotification(`${positionKey} status updated to ${newStatus}.`, "check-circle");
            fetchPhysicianPositions();
        } catch (dbError) {
            console.error("Error updating position status:", dbError);
            if (showNotification) showNotification(`Failed to update status for ${positionKey}.`, "error");
        }
        setIsUpdatingDb(false);
    };

    const adminModalContentBoxStyle = {
        ...adminModalContentBoxBaseStyle,
        width: currentUser ? '80%' : 'auto',
        minWidth: '320px',
        maxWidth: currentUser ? '800px' : '500px',
    };

    if (!show) {
        return null;
    }

    return (
        <div style={adminModalOverlayStyle} onClick={handleModalClose}>
            <div style={adminModalContentBoxStyle} onClick={e => e.stopPropagation()}>
                <Modal
                    show={true}
                    onHide={handleModalClose}
                    backdrop={false}
                    keyboard={true}
                    animation={false}
                    dialogClassName="border-0 shadow-none"
                    contentClassName="bg-transparent text-light p-0"
                >
                    <Modal.Header closeButton closeVariant="white" style={{borderBottomColor: '#30363d', padding: '1rem 1.5rem'}}>
                        <Modal.Title>Admin Panel</Modal.Title>
                    </Modal.Header>
                    <Modal.Body style={{ overflowY: 'auto', flexGrow: 1, padding: '1.5rem' }}>
                        {isLoadingAuth ? (
                            <p>Verifying authentication...</p>
                        ) : currentUser ? (
                            <div>
                                <p>Welcome, ({currentUser.email})!</p>
                                <hr style={{borderColor: '#30363d'}} />
                                <h5>Manage Physician Recruitment</h5>
                                {isLoadingPositions ? (
                                    <Spinner animation="border" role="status">
                                        <span className="visually-hidden">Loading positions...</span>
                                    </Spinner>
                                ) : Object.keys(physicianPositions).length > 0 ? (
                                    <ListGroup variant="flush">
                                        {Object.entries(physicianPositions).map(([key, position]) => (
                                            <ListGroup.Item key={key} className="d-flex justify-content-between align-items-center bg-transparent text-light py-2" style={{borderBottom: '1px solid rgba(255,255,255,0.1)'}}>
                                                <div>
                                                    {position.displayName || key} - Current: <strong style={{color: position.status === "OPEN" ? 'green' : 'red'}}>{position.status || "N/A"}</strong>
                                                </div>
                                                <Button
                                                    variant={position.status === "OPEN" ? "outline-danger" : "outline-success"}
                                                    size="sm"
                                                    onClick={() => handleTogglePositionStatus(key, position.status)}
                                                    disabled={isUpdatingDb}
                                                    style={{ minWidth: '120px' }}
                                                >
                                                    {isUpdatingDb && <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />}
                                                    {position.status === "OPEN" ? "Set CLOSED" : "Set OPEN"}
                                                </Button>
                                            </ListGroup.Item>
                                        ))}
                                    </ListGroup>
                                ) : (
                                    <p>No physician positions found or loaded.</p>
                                )}
                                <hr style={{borderColor: '#30363d'}} />
                                <Button variant="warning" onClick={handleLogout} className="mt-3">
                                    Logout
                                </Button>
                            </div>
                        ) : (
                            <Form onSubmit={handleLogin}>
                                <Form.Group className="mb-3" controlId="adminModalEmail">
                                    <Form.Label>Email address</Form.Label>
                                    <Form.Control
                                        type="email"
                                        placeholder="Enter email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="bg-secondary text-light border-secondary"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3" controlId="adminModalPassword">
                                    <Form.Label>Password</Form.Label>
                                    <Form.Control
                                        type="password"
                                        placeholder="Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="bg-secondary text-light border-secondary"
                                    />
                                </Form.Group>
                                {error && <p className="text-danger mt-2">{error}</p>}
                                <Button variant="primary" type="submit">
                                    Login
                                </Button>
                            </Form>
                        )}
                    </Modal.Body>
                    <Modal.Footer style={{borderTopColor: '#30363d', padding: '1rem 1.5rem'}}>
                        <Button variant="secondary" onClick={handleModalClose}>
                            Close
                        </Button>
                    </Modal.Footer>
                </Modal>
            </div>
        </div>
    );
}

export default AdminModal;
