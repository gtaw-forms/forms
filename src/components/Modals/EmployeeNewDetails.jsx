import React, { useState, useEffect, useMemo } from 'react';
import { useWebhooks } from '../../hooks/useWebhooks';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import * as Sentry from "@sentry/react";
import BaseModal from './BaseModal';

/**
 * EmployeeNewDetails Modal
 * Handle new employee requests via BaseModal
 */
const EmployeeNewDetails = ({ show, onHide, showNotification }) => {
    const { 
        user: gtaWorldUser, 
        swappableCharacters 
    } = useGtaWorldAuth();
    
    const [selectedCharId, setSelectedCharId] = useState('');
    const [department, setDepartment] = useState('PHMC');
    const [discordUsername, setDiscordUsername] = useState('');
    const [rank, setRank] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const { handleWebhookSubmit } = useWebhooks({}, {}, showNotification);

    useEffect(() => {
        if (show && gtaWorldUser) {
            setDiscordUsername(gtaWorldUser.username || '');
            const currentId = gtaWorldUser.faction?.characterId || gtaWorldUser.activeCharacter?.characterId;
            if (currentId) setSelectedCharId(String(currentId));
        }
    }, [show, gtaWorldUser]);

    const characters = useMemo(() => {
        const allChars = new Map();
        const addChar = (char) => {
            if (!char) return;
            const id = String(char.character?.characterId ?? char.id ?? char.characterId ?? '');
            const name = char.characterName || char.name || `${char.firstname} ${char.lastname}`.trim() || 'Unknown Character';
            if (id && id !== 'undefined' && !allChars.has(id)) {
                allChars.set(id, { id, name });
            }
        };

        (swappableCharacters || []).forEach(char => addChar(char));
        if (gtaWorldUser) {
            if (Array.isArray(gtaWorldUser.character)) {
                gtaWorldUser.character.forEach(char => addChar(char));
            } else {
                addChar(gtaWorldUser.character);
            }
            addChar(gtaWorldUser.activeCharacter);
            addChar(gtaWorldUser.faction);
            const nestedChars = gtaWorldUser.characters || gtaWorldUser.allCharacters;
            if (Array.isArray(nestedChars)) {
                nestedChars.forEach(char => addChar(char));
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
                    color: 0xFFAA00,
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
            Sentry.captureException(error, { extra: { context: 'EmployeeNewDetails Save' } });
            showNotification('Failed to send request.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <BaseModal
            isOpen={show}
            onClose={onHide}
            title="New Employee Request"
            modalSize="medium"
            variant="info"
            footer={
                <>
                    <button className="cctv-btn cctv-btn-secondary" onClick={onHide} disabled={isSaving}>
                        Cancel
                    </button>
                    <button className="cctv-btn cctv-btn-primary" onClick={handleSave} disabled={isSaving} style={{ marginLeft: '10px' }}>
                        {isSaving ? <><div className="cctv-spinner"></div> Sending...</> : <><i className="fas fa-paper-plane"></i> Submit Request</>}
                    </button>
                </>
            }
        >
            <div className="cctv-warning-text" style={{ marginBottom: '20px', padding: '15px', borderRadius: '8px', backgroundColor: 'rgba(210, 153, 34, 0.1)', color: '#d29922', border: '1px solid rgba(210, 153, 34, 0.2)' }}>
                <i className="fas fa-exclamation-triangle me-2"></i>
                Please select the PHMC character and fill out the details below. You must be invited to the faction before requesting access.
            </div>

            <div className="cctv-form-section" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="cctv-form-group">
                    <label className="cctv-form-label required" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#8b949e' }}>Select Character</label>
                    <select 
                        className="form-control"
                        value={selectedCharId}
                        onChange={(e) => setSelectedCharId(e.target.value)}
                        disabled={isSaving}
                        style={{ width: '100%', padding: '10px', backgroundColor: '#161b22', color: '#e6edf3', border: '1px solid #30363d', borderRadius: '6px' }}
                    >
                        <option value="">-- Choose Character --</option>
                        {characters.map(char => (
                            <option key={char.id} value={char.id}>{char.name} (#{char.id})</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="cctv-form-group">
                        <label className="cctv-form-label required" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#8b949e' }}>Department</label>
                        <select 
                            className="form-control"
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                            disabled={isSaving}
                            style={{ width: '100%', padding: '10px', backgroundColor: '#161b22', color: '#e6edf3', border: '1px solid #30363d', borderRadius: '6px' }}
                        >
                            <option value="PHMC">PHMC General Staff</option>
                            <option value="Coroner">Coroner</option>
                        </select>
                    </div>
                    <div className="cctv-form-group">
                        <label className="cctv-form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#8b949e' }}>Reported Rank</label>
                        <input
                            type="text"
                            className="form-control"
                            value={rank}
                            onChange={(e) => setRank(e.target.value)}
                            placeholder="e.g. Nursing Staff"
                            disabled={isSaving}
                            style={{ width: '100%', padding: '10px', backgroundColor: '#161b22', color: '#e6edf3', border: '1px solid #30363d', borderRadius: '6px' }}
                        />
                    </div>
                </div>

                <div className="cctv-form-group">
                    <label className="cctv-form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#8b949e' }}>Discord Username</label>
                    <input
                        type="text"
                        className="form-control"
                        value={discordUsername}
                        onChange={(e) => setDiscordUsername(e.target.value)}
                        placeholder="e.g. alysonfrost"
                        disabled={isSaving}
                        style={{ width: '100%', padding: '10px', backgroundColor: '#161b22', color: '#e6edf3', border: '1px solid #30363d', borderRadius: '6px' }}
                    />
                </div>
            </div>
        </BaseModal>
    );
};

export default EmployeeNewDetails;
