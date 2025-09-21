import React from 'react';

const AdminActions = ({ formData, setFormData, showNotification, commitInfo }) => {
    return (
        <div>
            <h4>Admin Actions</h4>
            <p>Here you can perform admin actions.</p>
            {/* Example of using a prop */}
            <p>Current Commit SHA: {commitInfo?.sha || 'N/A'}</p>
        </div>
    );
};

export default AdminActions;
