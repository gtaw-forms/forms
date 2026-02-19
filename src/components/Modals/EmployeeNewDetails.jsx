import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useWebhooks } from '../../hooks/useWebhooks';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import * as Sentry from "@sentry/react";

/**
 * EmployeeNewDetails Modal
 * Refactored from EmployeeDetailsModal to handle new employee requests
 * Allows picking a character and department for system access
 */
const EmployeeNewDetails = ({ show, onHide, showNotification }) => {
    const { 
        user: gtaWorldUser, 
        isAuthenticated, 
        swappableCharacters 
    } = useGtaWorldAuth();
    
    const [selectedCharId, setSelectedCharId] = useState('');
    const [department, setDepartment] = useState('PHMC');
    const [discordUsername, setDiscordUsername] = useState('');
    const [rank, setRank] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const { handleWebhookSubmit } = useWebhooks({}, {}, showNotification);

    // Reset fields when opening
    useEffect(() => {
        if (show) {
            if (gtaWorldUser) {
                setDiscordUsername(gtaWorldUser.username || '');
                // Try to find current character if any
                const currentId = gtaWorldUser.faction?.characterId || gtaWorldUser.activeCharacter?.characterId;
                if (currentId) setSelectedCharId(String(currentId));
            }
        }
    }, [show, gtaWorldUser]);

    const characters = useMemo(() => {
        const allChars = new Map();

        // Function to add a character to the map
        const addChar = (char) => {
            if (!char) return;
            
            // The character object can have different structures
            const id = String(char.character?.characterId ?? char.id ?? char.characterId ?? '');
            const name = char.characterName || char.name || `${char.firstname} ${char.lastname}`.trim() || 'Unknown Character';
            
            if (id && id !== 'undefined' && !allChars.has(id)) {
                allChars.set(id, { id, name });
            }
        };

        // Add swappable characters
        (swappableCharacters || []).forEach(char => addChar(char, 'swappableCharacters'));

        // Add the main/active character from the user object just in case it's not in swappable
        if (gtaWorldUser) {
            // The `gtaWorldUser.character` is an array of characters, iterate over it
            if (Array.isArray(gtaWorldUser.character)) {
                gtaWorldUser.character.forEach(char => addChar(char, 'gtaWorldUser.character'));
            } else {
                addChar(gtaWorldUser.character, 'gtaWorldUser.character');
            }

            addChar(gtaWorldUser.activeCharacter, 'gtaWorldUser.activeCharacter');
            addChar(gtaWorldUser.faction, 'gtaWorldUser.faction'); // Faction object can also contain character details
        
            // Also check for nested character arrays
            const nestedChars = gtaWorldUser.characters || gtaWorldUser.allCharacters;
            if (Array.isArray(nestedChars)) {
                nestedChars.forEach(char => addChar(char, 'gtaWorldUser.characters/allCharacters'));
            }
        }
        
        return Array.from(allChars.values());
    }, [swappableCharacters, gtaWorldUser]);

    const handleSave = async () => {
        if (!selectedCharId) {
            showNotification('Please select a character.', 'warning');
            return;
        }

        const selectedChar = characters.find(c => c.id === selectedCharId);
        if (!selectedChar) {
            showNotification('Character selection error.', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const webhookUrl = import.meta.env.VITE_DISCORD_WEBHOOK_AUTH || import.meta.env.VITE_DEV_WEBHOOK;
            
            const payload = {
                username: "PHMC Employee Onboarding",
                avatar_url: "https://i.ibb.co/0pgw9hHm/phmc.png",
                embeds: [{
                    title: "🚨 New Employee Access Request",
                    color: 0xFFAA00, // Amber/Orange
                    description: "A user is requesting to be added to the database.",
                    timestamp: new Date().toISOString(),
                    fields: [
                        { name: "Character Name", value: selectedChar.name, inline: true },
                        { name: "Character ID", value: selectedChar.id, inline: true },
                        { name: "Department", value: department, inline: true },
                        { name: "Discord Username", value: discordUsername || "Not provided", inline: true },
                        { name: "Reported Rank", value: rank || "Not provided", inline: true },
                        { name: "UCP User", value: gtaWorldUser?.username || "Unknown", inline: true }
                    ],
                    footer: { text: "PHMC Forms - Request System" }
                }]
            };

            await handleWebhookSubmit(payload, webhookUrl);
            
            showNotification('Access request sent! Please notify Alyson Frost in Discord.', 'success');
            onHide();
        } catch (error) {
            console.error("Error submitting onboarding request: ", error);
            Sentry.captureException(error, { 
                extra: { 
                    context: 'EmployeeNewDetails Save',
                    selectedCharId,
                    department,
                    user: gtaWorldUser?.username
                } 
            });
            showNotification('Failed to send request.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (!show) return null;

    const modalContent = (
        <div className="modal-overlay" onClick={onHide}>
            <div className="cctv-modal-dialog" onClick={e => e.stopPropagation()}>
                <div className="cctv-modal-header">
                    <h4 className="cctv-title">New Employee Request</h4>
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
                    <div className="cctv-danger-text">
                        <i className="fas fa-exclamation-triangle me-2"></i>
                        Please select the PHMC character and fill out the details below, then notify Alyson Frost in the PHMC Discord for review.  You must be invited to the faction before requesting access.
                    </div>

                    <div className="cctv-form-section">
                        <h5><i className="fas fa-user-plus me-2"></i>Access Details</h5>
                        
                        <div className="cctv-form-row">
                            <div className="cctv-form-group full-width">
                                <label className="cctv-form-label required">Select Character</label>
                                <select 
                                    className="form-control cctv-select"
                                    value={selectedCharId}
                                    onChange={(e) => setSelectedCharId(e.target.value)}
                                    disabled={isSaving}
                                >
                                    <option value="">-- Choose Character --</option>
                                    {characters.map(char => (
                                        <option key={char.id} value={char.id}>{char.name} (#{char.id})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="cctv-form-row">
                            <div className="cctv-form-group">
                                <label className="cctv-form-label required">Department</label>
                                <select 
                                    className="form-control cctv-select"
                                    value={department}
                                    onChange={(e) => setDepartment(e.target.value)}
                                    disabled={isSaving}
                                >
                                    <option value="PHMC">PHMC General Staff</option>
                                    <option value="Coroner">Coroner</option>
                                </select>
                            </div>
                            <div className="cctv-form-group">
                                <label className="cctv-form-label">Reported Rank</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={rank}
                                    onChange={(e) => setRank(e.target.value)}
                                    placeholder="e.g. Nursing Staff"
                                    disabled={isSaving}
                                />
                            </div>
                        </div>

                        <div className="cctv-form-row">
                            <div className="cctv-form-group full-width">
                                <label className="cctv-form-label">Discord Username</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={discordUsername}
                                    onChange={(e) => setDiscordUsername(e.target.value)}
                                    placeholder="e.g. alysonfrost"
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
                        Cancel
                    </button>
                    <button 
                        className="cctv-btn cctv-btn-primary" 
                        onClick={handleSave} 
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <>
                                <div className="cctv-spinner"></div>
                                Sending...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-paper-plane"></i>
                                Submit Request
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.getElementById('modal-root'));
};

export default EmployeeNewDetails;
