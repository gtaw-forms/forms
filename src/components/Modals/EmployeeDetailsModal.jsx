import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { database } from '../../firebase';
import { ref, update, get } from 'firebase/database';
import './Admin/CctvRequestWebhookModal.css';
import { useWebhooks } from '../../hooks/useWebhooks';
import * as Sentry from "@sentry/react";

const EmployeeDetailsModal = ({ show, onHide, user, showNotification }) => {
    const [employeeDetails, setEmployeeDetails] = useState({
        name: '',
        rank: '',
        discord: '',
        phNumber: '',
        family: '',
        closeFamily: '',
        address: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const { handleWebhookSubmit } = useWebhooks({}, {}, showNotification);

    // Load existing employee record from Firebase when modal opens
    useEffect(() => {
        if (show && user) {
            const characterName = user.faction?.characterName || (user.faction?.firstname && user.faction?.lastname ? `${user.faction.firstname} ${user.faction.lastname}` : null);
            
            // Set name and rank from user object first
            setEmployeeDetails(prevDetails => ({
                ...prevDetails,
                name: characterName || prevDetails.name,
                rank: user.faction?.rank || prevDetails.rank,
            }));

            const loadExistingRecord = async () => {
                try {
                    const characterId = user.faction?.characterId || user.characterArray?.[0]?.id || user.id;
                    const employeeId = characterId ? `char_${characterId}` : null;
                    
                    if (employeeId) {
                        const employeeRef = ref(database, `Nursing_Records/${employeeId}`);
                        const snapshot = await get(employeeRef);
                        
                        if (snapshot.exists()) {
                            const data = snapshot.val();
                            // Merge with existing state
                            setEmployeeDetails(prevDetails => ({
                                ...prevDetails,
                                discord: data.discord || prevDetails.discord,
                                phNumber: data.phoneNumber || prevDetails.phNumber,
                                family: data.family || prevDetails.family,
                                closeFamily: data.closeFamily || prevDetails.closeFamily,
                                address: data.address || prevDetails.address
                            }));
                            console.log('[EmployeeDetailsModal] Loaded existing record:', data);
                        }
                    }
                } catch (error) {
                    console.error('Error loading existing employee record:', error);
                    Sentry.captureException(error, { extra: { context: 'EmployeeDetailsModal Load Existing' } });
                }
            };
            
            loadExistingRecord();
        }
    }, [show, user]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setEmployeeDetails(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        if (!employeeDetails.name) {
            showNotification('Employee name is missing.', 'error');
            return;
        }

        setIsSaving(true);
        let updates = {};
        try {
            // Use character ID from faction data for consistency
            const characterId = user.faction?.characterId || user.characterArray?.[0]?.id || user.id;
            const employeeId = characterId ? `char_${characterId}` : employeeDetails.name.replace(/\s+/g, '_');
            const employeeRef = ref(database, `Nursing_Records/${employeeId}`);
            
            const [firstName, ...lastNameParts] = employeeDetails.name.split(' ');
            const lastName = lastNameParts.join(' ');
            
            // Use the current OAuth faction rank instead of form state to avoid stale data
            const currentFactionRank = user.faction?.rank || employeeDetails.rank || '';
            
            updates = {
                characterId: characterId || '',
                name: firstName || '',
                surname: lastName || '',
                discord: employeeDetails.discord,
                phoneNumber: employeeDetails.phNumber,
                factionRank: currentFactionRank,
                family: employeeDetails.family || '',
                closeFamily: employeeDetails.closeFamily || '',
                address: employeeDetails.address || '',
                lastUpdated: new Date().toISOString()
            };

            await update(employeeRef, updates);
            showNotification('Nursing employee details saved successfully!', 'success');

            // Send webhook
            const webhookPayload = {
                username: "PHMC Employee Records",
                avatar_url: "https://i.ibb.co/0pgw9hHm/phmc.png",
                embeds: [{
                    title: "Employee Record Updated",
                    color: 0x7289DA,
                    timestamp: new Date().toISOString(),
                    fields: [
                        { name: "Employee Name", value: employeeDetails.name, inline: true },
                        { name: "Updated By", value: user.username || "Unknown", inline: true },
                        ...Object.entries(updates).map(([key, value]) => ({ name: key, value: String(value) || "N/A", inline: true}))
                    ]
                }]
            };
            await handleWebhookSubmit(webhookPayload);

            onHide();
        } catch (error) {
            console.error("Error saving employee details: ", error, { updates });
            Sentry.captureException(error, { 
                extra: { 
                    context: 'EmployeeDetailsModal Save',
                    employeeDetails,
                    user
                } 
            });
            showNotification('Failed to save employee details. The error has been logged.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (!show) return null;

    const modalContent = (
        <div className="modal-overlay" onClick={onHide}>
            <div className="cctv-modal-dialog" onClick={e => e.stopPropagation()}>
                <div className="cctv-modal-header">
                    <h4 className="cctv-title">Complete Your Employee Profile</h4>
                    <button 
                        type="button" 
                        className="modal-close-btn" 
                        onClick={onHide} 
                        aria-label="Close"
                    >
                        &times;
                    </button>
                </div>
                <div className="cctv-modal-body">
                    <p style={{ color: '#e2e8f0', marginBottom: '20px' }}>
                        Welcome! To streamline your experience, please complete your employee profile. This information will be used to auto-fill forms.
                    </p>
                    
                    <div className="cctv-form-section">
                        <h5><i className="fas fa-user me-2"></i>Nursing Staff Information</h5>
                        
                        <div className="cctv-form-row">
                            <div className="cctv-form-group">
                                <label className="cctv-form-label required">Name</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    name="name"
                                    value={employeeDetails.name}
                                    onChange={handleChange}
                                    disabled
                                    title="Name is auto-filled from your GTAW account"
                                />
                            </div>
                        </div>

                        <div className="cctv-form-row">
                            <div className="cctv-form-group">
                                <label className="cctv-form-label">Rank/Position</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    name="rank"
                                    value={employeeDetails.rank}
                                    onChange={handleChange}
                                    placeholder="Your nursing rank"
                                    disabled
                                    title="Rank is auto-filled from your GTAW account"
                                />
                            </div>
                        </div>

                        <div className="cctv-form-row">
                            <div className="cctv-form-group">
                                <label className="cctv-form-label">Discord</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    name="discord"
                                    value={employeeDetails.discord}
                                    onChange={handleChange}
                                    placeholder="e.g., username#1234"
                                    disabled={isSaving}
                                />
                            </div>
                            <div className="cctv-form-group">
                                <label className="cctv-form-label">Phone Number</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    name="phNumber"
                                    value={employeeDetails.phNumber}
                                    onChange={handleChange}
                                    placeholder="e.g., 123-4567"
                                    disabled={isSaving}
                                />
                            </div>
                        </div>

                        <div className="cctv-form-row">
                            <div className="cctv-form-group full-width">
                                <label className="cctv-form-label">Family</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    name="family"
                                    value={employeeDetails.family}
                                    onChange={handleChange}
                                    placeholder="Extended family connections"
                                    disabled={isSaving}
                                />
                            </div>
                        </div>

                        <div className="cctv-form-row">
                            <div className="cctv-form-group full-width">
                                <label className="cctv-form-label">Close Family</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    name="closeFamily"
                                    value={employeeDetails.closeFamily}
                                    onChange={handleChange}
                                    placeholder="Immediate family members"
                                    disabled={isSaving}
                                />
                            </div>
                        </div>

                        <div className="cctv-form-row">
                            <div className="cctv-form-group full-width">
                                <label className="cctv-form-label">Address</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    name="address"
                                    value={employeeDetails.address}
                                    onChange={handleChange}
                                    placeholder="Residential address"
                                    disabled={isSaving}
                                />
                            </div>
                        </div>

                    </div>
                </div>
                <div className="cctv-modal-footer">
                    <button 
                        className="cctv-btn cctv-btn-secondary" 
                        onClick={onHide} 
                        disabled={isSaving}
                    >
                        Later
                    </button>
                    <button 
                        className="cctv-btn cctv-btn-primary" 
                        onClick={handleSave} 
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <>
                                <div className="cctv-spinner"></div>
                                Saving...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-save"></i>
                                Save Details
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.getElementById('modal-root'));
};

export default EmployeeDetailsModal;
