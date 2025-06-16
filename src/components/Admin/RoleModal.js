// src/components/Admin/RoleModal.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Form as BootstrapForm, Spinner } from 'react-bootstrap';
import { database } from '../../firebase';
import { ref, set, update, get } from "firebase/database"; // Import update

// Define initialRoleState outside the component for a stable reference
const getInitialRoleState = (categoryDisplayName = '') => ({
    displayName: '',
    group: categoryDisplayName,
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

// MODIFIED: Accept roleToEdit prop and rename onRoleAdded to onRoleSaved
const RoleModal = ({ show, onHide, categoryKey, categoryConfig, showNotification, onRoleSaved, roleToEdit }) => {
    const initialRoleState = useMemo(() => getInitialRoleState(categoryConfig?.displayName || ''), [categoryConfig?.displayName]);
    const [roleData, setRoleData] = useState(() => {
        if (roleToEdit) {
            // Merge, ensuring all keys from initialRoleState exist, defaulting to initial values
            // if not present in roleToEdit.
            return { ...initialRoleState, ...roleToEdit };
        }
        return initialRoleState;
    });
    useEffect(() => {
        if (show) {
            if (roleToEdit) {
                // When modal is shown for editing, merge roleToEdit with initialRoleState
                // to ensure all expected fields are defined in roleData.
                setRoleData({ ...initialRoleState, ...roleToEdit });
            } else {
                // When adding, use initialRoleState (which already considers categoryConfig for group)
                setRoleData(initialRoleState);
            }
            setError('');
        }
    }, [show, roleToEdit, initialRoleState]); // categoryConfig is implicitly handled by initialRoleState's memoization

    // MODIFIED: Initialize state based on roleToEdit or initialRoleState
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    // Define which fields are mandatory for submission
    const requiredFields = useMemo(() => [
        'displayName', 'group', 'shortCode', 'poc', 'url',
        'Overview', 'skill1', 'skill2', 'skill3', 'EduRequirement'
    ], []);

    const [isFormValid, setIsFormValid] = useState(false);

    useEffect(() => {
        if (show) {
            // MODIFIED: Reset state based on roleToEdit when modal is shown
            setRoleData(roleToEdit || initialRoleState);
            setError('');
        }
    }, [show, roleToEdit, initialRoleState]); // Added roleToEdit to deps

    // Validate form whenever roleData changes
    useEffect(() => {
        const validateForm = () => {
            for (const field of requiredFields) {
                // Check if field exists and is not just whitespace
                if (!roleData.hasOwnProperty(field) || String(roleData[field]).trim() === '') {
                    return false;
                }
            }
            return true;
        };
        setIsFormValid(validateForm());
    }, [roleData, requiredFields]);


    const handleChange = useCallback((e) => {
        const { name, value } = e.target;
        setRoleData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleClose = useCallback(() => {
        // MODIFIED: Reset form data based on initial state, not roleToEdit
        setRoleData(initialRoleState);
        setError('');
        onHide();
    }, [onHide, initialRoleState]); // Removed roleToEdit from deps

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        console.log('[RoleModal] handleSubmit called. Event default prevented.'); // Log 1
        setError('');

        if (!isFormValid) {
            console.log('[RoleModal] Form is NOT valid. Aborting.'); // Log 2
            setError('All fields marked with * are required, and others must also be filled.');
            if (showNotification) showNotification('Please fill out all fields in the form.', 'warning');
            return;
        }

        // MODIFIED: Use original key if editing, otherwise generate from displayName
        const roleKey = roleToEdit?.originalKey || roleData.displayName.trim().replace(/[.#$[\]]/g, '_');
        if (!roleKey) {
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

        const rolePath = `${categoryConfig.path}/${roleKey}`;

        try {
            // MODIFIED: Check for existence only if adding (roleToEdit is null)
            if (!roleToEdit) {
                const existingRoleRef = ref(database, rolePath);
                const snapshot = await get(existingRoleRef);
                if (snapshot.exists()) {
                    setError(`A role with the key "${roleKey}" (derived from Display Name) already exists in this category.`);
                    if (showNotification) showNotification(`Role key "${roleKey}" already exists.`, 'error');
                    setIsSaving(false);
                    return;
                }
            }

            // Prepare data to save/update
            const { name, ...dataToSave } = roleData; // 'name' field is not part of the data to save

            // MODIFIED: Use set for adding, update for editing
            if (!roleToEdit) {
                 await set(ref(database, rolePath), dataToSave);
                 if (showNotification) showNotification(`Role "${roleData.displayName}" added successfully!`, 'check-circle');
            } else {
                 // Use update to only change specified fields, or set to overwrite the whole object
                 // Using set here to overwrite the whole role object with the new data
                 await set(ref(database, rolePath), dataToSave);
                 if (showNotification) showNotification(`Role "${roleData.displayName}" updated successfully!`, 'check-circle');
            }


            // MODIFIED: Call onRoleSaved with the saved data and action type
            if (onRoleSaved) {
                console.log('[RoleModal] Calling onRoleSaved with data:', { ...dataToSave, originalKey: roleKey }, roleToEdit ? 'edited' : 'added'); // Log 4
                onRoleSaved({
                    ...dataToSave,
                    originalKey: roleKey
                }, roleToEdit ? 'edited' : 'added');
            }

            handleClose();
        } catch (dbError) {
            console.error(`[RoleModal] Error ${roleToEdit ? 'editing' : 'adding'} role:`, dbError); // Log 5
            setError(`Failed to ${roleToEdit ? 'edit' : 'add'} role: ${dbError.message}`);
            if (showNotification) showNotification(`Failed to ${roleToEdit ? 'edit' : 'add'} role. ${dbError.message}`, "error");
        }
        setIsSaving(false);
    }, [roleData, categoryConfig, showNotification, onRoleSaved, handleClose, isFormValid, roleToEdit]); // Added roleToEdit to deps

    useEffect(() => {
        const handleEsc = (event) => {
            if (event.key === 'Escape') {
                handleClose();
            }
        };
        if (show) {
            document.addEventListener('keydown', handleEsc);
        }
        return () => {
            document.removeEventListener('keydown', handleEsc);
        };
    }, [show, handleClose]);

    if (!show) {
        return null;
    }

    // MODIFIED: Dynamic modal title and button text
    const modalTitle = roleToEdit ? `Edit Role: ${roleToEdit.displayName || roleToEdit.originalKey}` : `Add New Role to ${categoryConfig?.displayName || 'Category'}`;
    const submitButtonText = roleToEdit ? (isSaving ? 'Saving Changes...' : 'Save Changes') : (isSaving ? 'Saving Role...' : 'Save Role');


    return (
        <div style={modalOverlayStyle} onClick={handleClose}>
            <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
                <div style={modalHeaderStyle}>
                    <h5 style={modalTitleStyle}>{modalTitle}</h5>
                    <Button
                        variant="link"
                        onClick={handleClose}
                        aria-label="Close"
                        style={{ color: '#aaa', textDecoration: 'none', fontSize: '1.5rem', padding: '0 .5rem', lineHeight: 1 }}
                    >
                        &times;
                    </Button>
                </div>
                <div style={modalBodyStyle}>
                    <BootstrapForm onSubmit={handleSubmit}>
                         {/* Display Name field - Disable if editing as it's used as the key */}
                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Display Name (Used as Key) *</BootstrapForm.Label>
                            <BootstrapForm.Control
                                type="text"
                                name="displayName"
                                value={roleData.displayName}
                                onChange={handleChange}
                                required
                                disabled={!!roleToEdit} // Disable if editing
                            />
                             {roleToEdit && <BootstrapForm.Text muted>Display Name cannot be changed when editing.</BootstrapForm.Text>}
                        </BootstrapForm.Group>
                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Group *</BootstrapForm.Label>
                            <BootstrapForm.Control type="text" name="group" value={roleData.group} onChange={handleChange} placeholder="e.g., Physician, Admin" required />
                             <BootstrapForm.Text muted>Typically the same as the category name.</BootstrapForm.Text>
                        </BootstrapForm.Group>
                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Status *</BootstrapForm.Label>
                            <BootstrapForm.Select name="status" value={roleData.status} onChange={handleChange} required>
                                <option value="OPEN">OPEN</option>
                                <option value="CLOSED">CLOSED</option>
                            </BootstrapForm.Select>
                        </BootstrapForm.Group>
                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Point of Contact (POC) *</BootstrapForm.Label>
                            <BootstrapForm.Control type="text" name="poc" value={roleData.poc} onChange={handleChange} required />
                        </BootstrapForm.Group>
                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Short Code *</BootstrapForm.Label>
                            <BootstrapForm.Control type="text" name="shortCode" value={roleData.shortCode} onChange={handleChange} required />
                        </BootstrapForm.Group>
                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>URL (Forum Link) *</BootstrapForm.Label>
                            <BootstrapForm.Control type="url" name="url" value={roleData.url} onChange={handleChange} placeholder="https://example.com/link" required />
                        </BootstrapForm.Group>
                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Overview *</BootstrapForm.Label>
                            <BootstrapForm.Control as="textarea" rows={3} name="Overview" value={roleData.Overview} onChange={handleChange} required />
                        </BootstrapForm.Group>
                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Skill 1 *</BootstrapForm.Label>
                            <BootstrapForm.Control as="textarea" rows={2} name="skill1" value={roleData.skill1} onChange={handleChange} required />
                        </BootstrapForm.Group>
                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Skill 2 *</BootstrapForm.Label>
                            <BootstrapForm.Control as="textarea" rows={2} name="skill2" value={roleData.skill2} onChange={handleChange} required />
                        </BootstrapForm.Group>
                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Skill 3 *</BootstrapForm.Label>
                            <BootstrapForm.Control as="textarea" rows={2} name="skill3" value={roleData.skill3} onChange={handleChange} required />
                        </BootstrapForm.Group>
                        <BootstrapForm.Group className="mb-3">
                            <BootstrapForm.Label>Educational Requirement *</BootstrapForm.Label>
                            <BootstrapForm.Control as="textarea" rows={2} name="EduRequirement" value={roleData.EduRequirement} onChange={handleChange} required />
                        </BootstrapForm.Group>

                        {error && <p className="text-danger mt-2 mb-0">{error}</p>}

                        <div style={modalFooterStyle}>
                            <Button variant="secondary" onClick={handleClose} disabled={isSaving}>
                                Cancel
                            </Button>
                            <Button variant="primary" type="submit" disabled={isSaving || !isFormValid}>
                                {submitButtonText}
                            </Button>
                        </div>
                    </BootstrapForm>
                </div>
            </div>
        </div>
    );
};

export default RoleModal;
