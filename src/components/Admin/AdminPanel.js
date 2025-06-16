// src/components/Admin/AdminPanel.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../firebase'; // Corrected path
import { signOut } from "firebase/auth"; // Correct import for v9+

function AdminPanel() {
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            // Pass the auth instance as the argument
            await signOut(auth);
            navigate('/admin/login');
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    return (
        <div>
            <h1>Admin Panel</h1>
            <p>Welcome, Admin!</p>
            <button onClick={handleLogout}>Logout</button>
        </div>
    );
}

export default AdminPanel;
