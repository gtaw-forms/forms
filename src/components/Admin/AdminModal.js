// src/components/Admin/AdminModal.js
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom'; // Import ReactDOM for Portals
import { Modal, Button, Form, Spinner, ListGroup } from 'react-bootstrap';
import { auth, database } from '../../firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { ref, get, update } from "firebase/database";

// Consistent overlay style
const adminModalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(31, 41, 55, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99000, // Ensure this is high enough
    overflowY: 'auto',
};

// Base style for the modal's content box
const adminModalContentBoxBaseStyle = {
    position: 'relative',
    backgroundColor: '#0d1117',
    color: '#c9d1d9',
    borderRadius: '8px',
    border: '1px solid #30363d',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden', // Important for internal scrolling of Modal.Body
    maxHeight: '90vh', // Ensure modal doesn't exceed viewport height
};


function AdminModal({ show, onHide, showNotification, commitInfo }) {
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
            // Reset states when modal is hidden to ensure clean state on next open
            setIsLoadingAuth(true);
            setCurrentUser(null);
            setPhysicianPositions({});
            setEmail('');
            setPassword('');
            setError('');
            return;
        }

        setIsLoadingAuth(true);
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                // fetchPhysicianPositions(); // Consider if this should be fetched by AdminAuthAndActions instead
            } else {
                setCurrentUser(null);
                setPhysicianPositions({});
            }
            setIsLoadingAuth(false);
        });
        return () => unsubscribe();
    }, [show]); // Only re-run if 'show' changes

    // fetchPhysicianPositions might be better located in AdminAuthAndActions
    // if AdminModal is purely for authentication.
    // For now, keeping it here as per original structure.
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
            // setCurrentUser will be updated by onAuthStateChanged
            // No need to call fetchPhysicianPositions here, onAuthStateChanged handles it
        } catch (err) {
            setError(err.message || "Failed to login.");
            console.error("Login error:", err);
        }
        setIsLoadingAuth(false); // Ensure this is set in all paths
    };

    const handleLogout = async () => {
        setError('');
        try {
            await signOut(auth);
            // States will be reset by onAuthStateChanged
        } catch (err) {
            setError(err.message || "Failed to logout.");
            console.error("Logout error:", err);
        }
    };

    const handleModalClose = () => {
        // setError(''); // Error is reset in useEffect when show becomes false
        onHide();
    };

    // handleTogglePositionStatus would typically live in AdminAuthAndActions
    // if AdminModal is just for auth. If AdminModal itself manages this data,
    // it can stay, but it seems AdminAuthAndActions is the main data handler.

    const adminModalContentBoxStyle = {
        ...adminModalContentBoxBaseStyle,
        width: currentUser ? '80%' : 'auto', // Adjust width based on login state
        minWidth: '320px', // Minimum width for login form
        maxWidth: currentUser ? '800px' : '500px', // Max width
    };

    if (!show) {
        return null;
    }

    // --- MODIFICATION START: Define the modal's JSX content for the portal ---
    const modalDialogContent = (
        <div style={adminModalOverlayStyle} onClick={handleModalClose}>
            <div style={adminModalContentBoxStyle} onClick={e => e.stopPropagation()}>
                {/* Using react-bootstrap Modal for its built-in accessibility and focus management */}
                <Modal
                    show={true} // This is always true because AdminModal's show prop controls the portal
                    onHide={handleModalClose}
                    backdrop={false} // The custom overlay handles the backdrop
                    keyboard={true}
                    animation={false} // Optional: disable animation if preferred
                    dialogClassName="border-0 shadow-none" // Remove default bootstrap modal borders/shadows
                    contentClassName="bg-transparent text-light p-0" // Make bootstrap modal content transparent
                >
                    <Modal.Header closeButton closeVariant="white" style={{borderBottomColor: '#30363d', padding: '1rem 1.5rem'}}>
                        <Modal.Title>Admin Panel Login</Modal.Title>
                    </Modal.Header>
                    <Modal.Body style={{ overflowY: 'auto', flexGrow: 1, padding: '1.5rem' }}>
                        {isLoadingAuth ? (
                            <div className="text-center"><Spinner animation="border" role="status"><span className="visually-hidden">Loading...</span></Spinner></div>
                        ) : currentUser ? (
                            // If AdminModal is ONLY for login, this part might not be needed here.
                            // The actual admin actions would be in AdminAuthAndActions.
                            // For now, keeping a simple "Logged In" message.
                            <div>
                                <p>You are logged in as: {currentUser.email}</p>
                                <p>Admin actions are available in the main panel.</p>
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
                                <Button variant="primary" type="submit" disabled={isLoadingAuth}>
                                    {isLoadingAuth ? <Spinner as="span" animation="border" size="sm" /> : "Login"}
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
    // --- MODIFICATION END ---

    // --- MODIFICATION START: Use ReactDOM.createPortal ---
    // --- MODIFICATION END ---
}

export default AdminModal;
