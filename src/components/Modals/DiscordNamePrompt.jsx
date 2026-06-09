import React, { useState } from 'react';
import BaseModal from './BaseModal';
import { updateDiscordName } from '../../utils/identityUtils';
import { useNotification } from '../../contexts/NotificationContext';

/**
 * DiscordNamePrompt Modal
 * One-time check to ensure user has a Discord Name saved in the database
 */
const DiscordNamePrompt = ({ show, onHide, characterId, initialValue = '', promptType = 'initial' }) => {
    const [discordName, setDiscordName] = useState(initialValue);
    const [isSaving, setIsSaving] = useState(false);
    const { showNotification } = useNotification();

    // Reset local state when initialValue changes or modal opens
    React.useEffect(() => {
        if (show) {
            setDiscordName(initialValue);
        }
    }, [show, initialValue]);

    const handleSave = async () => {
        if (!discordName || discordName.trim().length < 2) {
            showNotification('Please enter a valid Discord username.', 'warning');
            return;
        }

        setIsSaving(true);
        try {
            await updateDiscordName(characterId, discordName.trim());
            showNotification('Discord name saved successfully!', 'success');
            onHide(true); // Pass true to indicate successful save
        } catch (error) {
            console.error('Failed to save Discord name:', error);
            showNotification('Failed to save Discord name. Please try again.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <BaseModal
            isOpen={show}
            onClose={() => onHide(false)}
            title="Discord Integration"
            modalSize="small"
            variant="info"
            showCloseButton={false} // Force completion
            closeOnOverlayClick={false}
            footer={
                <button 
                    className="cctv-btn cctv-btn-primary w-100" 
                    onClick={handleSave} 
                    disabled={isSaving}
                >
                    {isSaving ? <><i className="fas fa-spinner fa-spin me-2"></i>Saving...</> : 'Save & Continue'}
                </button>
            }
        >
            <div className="text-center mb-3">
                <i className="fab fa-discord fa-3x mb-3" style={{ color: '#5865F2' }}></i>
                <h5>{promptType === 'manual' ? 'Update Discord Username' : 'Discord Integration'}</h5>
                <p className="text-center mb-3" style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
                    {promptType === 'manual' 
                        ? 'Confirm or change your Discord username for form auto-filling.' 
                        : 'We use this to automatically fill your details in forms and logs. This is a one-time setup.'}
                </p>
            </div>

            <div className="cctv-form-group">
                <input
                    type="text"
                    className="form-control text-center"
                    value={discordName}
                    onChange={(e) => setDiscordName(e.target.value)}
                    placeholder="e.g. alysonfrost"
                    disabled={isSaving}
                    autoFocus
                    style={{ 
                        fontSize: '1.2rem', 
                        padding: '12px',
                        backgroundColor: '#161b22',
                        color: '#e6edf3',
                        border: '1px solid #30363d',
                        borderRadius: '8px'
                    }}
                />
            </div>
        </BaseModal>
    );
};

export default DiscordNamePrompt;
