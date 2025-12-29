import { logAdminAction, getUserContext } from '../../utils/adminLogger';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Form as BootstrapForm, Spinner } from 'react-bootstrap';
import { database } from '../../firebase';
import { ref, set, get } from "firebase/database"; // Removed 'update' as 'set' is used for both add/edit
import ReactDOM from 'react-dom';

// Helper to map categoryKey to the correct group identifier for Firebase
const getGroupIdentifier = (categoryKey) => {
    const map = {
        physician: "Physician",
        psych: "Psych",
        admin: "Admin",
        nursing: "Nurse",
        ems: "EMS",
        coroner: "Coroner",
        saaa: "SAAA", // Assuming SAAA roles should also have group: "SAAA"
    };
    // Fallback to capitalizing the categoryKey if not in the specific map,
    // or return as is if it's already in the desired format.
    return map[categoryKey] || (categoryKey ? categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1) : 'Unknown');
};

// Define initialRoleState outside the component
const getInitialRoleState = (categoryDisplayName = '') => ({
    displayName: '',
    group: categoryDisplayName, // This is for display in the form (read-only)
    status: 'OPEN',
    poc: '',
    shortCode: '',
    url: '',
    Overview: '',
    skill1: '',
    skill2: '',
    skill3: '',
    EduRequirement: '',
});

// --- Custom Modal Styles (remain the same) ---
const modalOverlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1040,
};
const modalContentStyle = {
    position: 'relative', backgroundColor: '#2a2a2e', color: '#e1e1e1',
    padding: '25px 30px', borderRadius: '10px', boxShadow: '0 7px 20px rgba(0,0,0,0.5)',
    zIndex: 1050, width: '90%', maxWidth: '750px', maxHeight: '88vh',
    display: 'flex', flexDirection: 'column', border: '1px solid #444',
};
const modalHeaderStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderBottom: '1px solid #444', paddingBottom: '15px', marginBottom: '20px',
    color: '#ffffff',
};
const modalTitleStyle = { margin: 0, fontSize: '1.4rem', fontWeight: '500' };
const modalBodyStyle = {
    overflowY: 'auto', flexGrow: 1, scrollbarWidth: 'thin', scrollbarColor: '#555 #333',
};
const modalFooterStyle = {
    display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #444',
    paddingTop: '20px', marginTop: '25px',
};
// --- End Custom Modal Styles ---

const RoleModal = ({ show, onHide, categoryKey, categoryConfig, showNotification, onRoleSaved, roleToEdit }) => {
    const initialRoleState = useMemo(() => getInitialRoleState(categoryConfig?.displayName || ''), [categoryConfig?.displayName]);
    const [roleData, setRoleData] = useState(() => roleToEdit ? { ...initialRoleState, ...roleToEdit } : initialRoleState);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (show) {
            setRoleData(roleToEdit ? { ...initialRoleState, ...roleToEdit } : initialRoleState);
            setError('');
        }
    }, [show, roleToEdit, initialRoleState]);

    const requiredFields = useMemo(() => [
        'displayName', 'group', 'shortCode', 'poc', 'url',
        'Overview', 'skill1', 'skill2', 'skill3', 'EduRequirement'
    ], []);

    const [isFormValid, setIsFormValid] = useState(false);

    useEffect(() => {
        const validateForm = () => requiredFields.every(field => roleData.hasOwnProperty(field) && String(roleData[field]).trim() !== '');
        setIsFormValid(validateForm());
    }, [roleData, requiredFields]);

    const handleChange = useCallback((e) => {
        const { name, value } = e.target;
        setRoleData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleClose = useCallback(() => {
        setRoleData(initialRoleState);
        setError('');
        onHide();
    }, [onHide, initialRoleState]);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setError('');

        if (!isFormValid) {
            setError('All fields marked with * are required, and others must also be filled.');
            if (showNotification) showNotification('Please fill out all fields in the form.', 'warning');
            return;
        }

        const roleKeyForFirebase = roleToEdit?.originalKey || roleData.displayName.trim().replace(/[.#$[\]/]/g, '_').replace(/\s+/g, '_');
        if (!roleKeyForFirebase) {
            setError('Display Name cannot be empty or invalid for key generation.');
            if (showNotification) showNotification('Display Name is invalid for key.', 'warning');
            return;
        }

        setIsSaving(true);
        if (!categoryConfig || !categoryConfig.path) {
            setError('Category configuration is missing or invalid.');
            if (showNotification) showNotification('Category configuration error.', 'error');
            setIsSaving(false);
            return;
        }

        const rolePath = `${categoryConfig.path}/${roleKeyForFirebase}`;

        try {
            if (!roleToEdit) {
                const existingRoleRef = ref(database, rolePath);
                const snapshot = await get(existingRoleRef);
                if (snapshot.exists()) {
                    setError(`A role with the key "${roleKeyForFirebase}" already exists.`);
                    if (showNotification) showNotification(`Role key "${roleKeyForFirebase}" already exists.`, 'error');
                    setIsSaving(false);
                    return;
                }
            }

            const dataToSave = { ...roleData };
            // *** KEY CHANGE: Set the correct 'group' identifier for Firebase ***
            dataToSave.group = getGroupIdentifier(categoryKey);

            await set(ref(database, rolePath), dataToSave);

            if (onRoleSaved) {
                onRoleSaved({
                    ...dataToSave,
                    originalKey: roleKeyForFirebase
                }, roleToEdit ? 'edited' : 'added');
            }
            handleClose();
        } catch (dbError) {
            setError(`Failed to ${roleToEdit ? 'edit' : 'add'} role: ${dbError.message}`);
            if (showNotification) showNotification(`Failed to ${roleToEdit ? 'edit' : 'add'} role. ${dbError.message}`, "error");
        }
        setIsSaving(false);
    }, [roleData, categoryKey, categoryConfig, showNotification, onRoleSaved, handleClose, isFormValid, roleToEdit]);

    useEffect(() => {
        const handleEsc = (event) => {
            if (event.key === 'Escape') handleClose();
        };
        if (show) document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [show, handleClose]);

    if (!show) return null;

    const modalTitleText = roleToEdit ? `Edit Role: ${roleToEdit.displayName || roleToEdit.originalKey}` : `Add New Role to ${categoryConfig?.displayName || 'Category'}`;
    const submitButtonText = roleToEdit ? (isSaving ? 'Saving...' : 'Save Changes') : (isSaving ? 'Saving...' : 'Save Role');

    const modalPortalContent = (
        <div style={modalOverlayStyle} onClick={handleClose}>
            <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
                <div style={modalHeaderStyle}>
                    <h5 style={modalTitleStyle}>{modalTitleText}</h5>
                    <Button variant="link" onClick={handleClose} aria-label="Close" style={{ color: '#aaa', textDecoration: 'none', fontSize: '1.5rem', padding: '0 .5rem', lineHeight: 1 }}>
                        &times;
                    </Button>
                </div>
                <div style={modalBodyStyle}>
                    <BootstrapForm onSubmit={handleSubmit}>
                        {/* Display Name */}
                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Display Name *</BootstrapForm.Label>
                            <BootstrapForm.Control type="text" name="displayName" value={roleData.displayName || ''} onChange={handleChange} required placeholder="e.g., Senior Paramedic" />
                        </BootstrapForm.Group>

                        {/* Group (Read-only, derived from categoryConfig.displayName) */}
                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Group (Category) *</BootstrapForm.Label>
                            <BootstrapForm.Control type="text" name="group" value={roleData.group || ''} onChange={handleChange} required readOnly />
                        </BootstrapForm.Group>

                        {/* Status */}
                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Status *</BootstrapForm.Label>
                            <BootstrapForm.Select name="status" value={roleData.status || 'OPEN'} onChange={handleChange} required>
                                <option value="OPEN">OPEN</option>
                                <option value="CLOSED">CLOSED</option>
                            </BootstrapForm.Select>
                        </BootstrapForm.Group>

                        {/* POC */}
                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Point of Contact (POC) *</BootstrapForm.Label>
                            <BootstrapForm.Control type="text" name="poc" value={roleData.poc || ''} onChange={handleChange} required placeholder="e.g., John Doe (johndoe#1234)" />
                        </BootstrapForm.Group>

                        {/* Short Code */}
                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Short Code *</BootstrapForm.Label>
                            <BootstrapForm.Control type="text" name="shortCode" value={roleData.shortCode || ''} onChange={handleChange} required placeholder="e.g., SRPARA" />
                        </BootstrapForm.Group>

                        {/* URL */}
                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Application URL *</BootstrapForm.Label>
                            <BootstrapForm.Control type="url" name="url" value={roleData.url || ''} onChange={handleChange} required placeholder="https://forum.example.com/link" />
                        </BootstrapForm.Group>

                        {/* Overview */}
                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Overview *</BootstrapForm.Label>
                            <BootstrapForm.Control as="textarea" rows={3} name="Overview" value={roleData.Overview || ''} onChange={handleChange} required placeholder="Brief role overview..." />
                        </BootstrapForm.Group>

                        {/* Skills */}
                        <BootstrapForm.Group className="mb-3"><BootstrapForm.Label>Skill Requirement 1 *</BootstrapForm.Label><BootstrapForm.Control type="text" name="skill1" value={roleData.skill1 || ''} onChange={handleChange} required placeholder="e.g., Advanced Life Support" /></BootstrapForm.Group>
                        <BootstrapForm.Group className="mb-3"><BootstrapForm.Label>Skill Requirement 2 *</BootstrapForm.Label><BootstrapForm.Control type="text" name="skill2" value={roleData.skill2 || ''} onChange={handleChange} required placeholder="e.g., Emergency Driving" /></BootstrapForm.Group>
                        <BootstrapForm.Group className="mb-3"><BootstrapForm.Label>Skill Requirement 3 *</BootstrapForm.Label><BootstrapForm.Control type="text" name="skill3" value={roleData.skill3 || ''} onChange={handleChange} required placeholder="e.g., Patient Assessment" /></BootstrapForm.Group>

                        {/* Education */}
                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Education Requirement *</BootstrapForm.Label>
                            <BootstrapForm.Control type="text" name="EduRequirement" value={roleData.EduRequirement || ''} onChange={handleChange} required placeholder="e.g., EMT-P Certification" />
                        </BootstrapForm.Group>

                        {error && <p className="text-danger mt-2 mb-0">{error}</p>}

                        <div style={modalFooterStyle}>
                            <Button variant="secondary" onClick={handleClose} disabled={isSaving}>Cancel</Button>
                            <Button variant="primary" type="submit" disabled={isSaving || !isFormValid} style={{ minWidth: '120px', marginLeft: '10px' }}>
                                {isSaving ? <Spinner as="span" animation="border" size="sm" /> : submitButtonText}
                            </Button>
                        </div>
                    </BootstrapForm>
                </div>
            </div>
        </div>
    );
    return ReactDOM.createPortal(modalPortalContent, document.getElementById('modal-root'));
};

export default RoleModal;
