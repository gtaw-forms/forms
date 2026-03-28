import React, { useState, useEffect } from 'react';
import * as Sentry from "@sentry/react";
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import { analytics } from '../../firebase';
import { logEvent } from "firebase/analytics";
import BaseModal from '../Modals/BaseModal';
import './CctvRequestWebhookModal.css';

const CctvRequestWebhookModal = ({ isOpen, onHide, showNotification, commitInfo, formData }) => {
    const { 
        user: gtawUser, 
        isAuthenticated: isGtawAuthenticated, 
        factionData,
        swappableCharacters,
        swapCharacter,
        canSwapCharacters,
        login
    } = useGtaWorldAuth();

    const handleLogin = () => {
        sessionStorage.setItem('showCctvModalAfterLogin', 'true');
        login();
    };
    const [rank, setRank] = useState('');
    const [officer, setOfficer] = useState('');
    const [officerPH, setOfficerPH] = useState('');
    const [department, setDepartment] = useState('');
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [discordUsername, setDiscordUsername] = useState('');
    const [oocNotes, setOocNotes] = useState('');
    const [incidentDateTime, setIncidentDateTime] = useState('');
    const [requestReason, setRequestReason] = useState('');
    const [selectedCharacterId, setSelectedCharacterId] = useState(null);

    useEffect(() => {
        if (!isOpen) { 
            setRank('');
            setOfficer('');
            setOfficerPH('');
            setDepartment('');
            setLocation('');
            setDescription('');
            setIsSubmitting(false);
            setDiscordUsername('');
            setIncidentDateTime('');
            setRequestReason('');
            setOocNotes('');
            setSelectedCharacterId(null);
        }
    }, [isOpen]);

    // Initialize selected character when authenticated
    useEffect(() => {
        if (isGtawAuthenticated && factionData && !selectedCharacterId) {
            setSelectedCharacterId(factionData.characterId);
        }
    }, [isGtawAuthenticated, factionData, selectedCharacterId]);

    // Auto-fill officer field with selected character name
    useEffect(() => {
        if (isGtawAuthenticated) {
            // Try to get the selected character name
            let characterName = '';
            
            if (selectedCharacterId && swappableCharacters) {
                const selectedChar = swappableCharacters.find(char => {
                    // Handle different character data structures
                    if (char.character && char.character.characterId) {
                        return char.character.characterId == selectedCharacterId;
                    } else if (char.id) {
                        return char.id == selectedCharacterId;
                    }
                    return false;
                });
                
                if (selectedChar) {
                    if (selectedChar.character && selectedChar.character.characterName) {
                        // Faction character structure
                        characterName = selectedChar.character.characterName;
                    } else if (selectedChar.name) {
                        // All characters structure with name field
                        characterName = selectedChar.name;
                    } else if (selectedChar.firstname && selectedChar.lastname) {
                        // All characters structure with firstname/lastname
                        characterName = `${selectedChar.firstname} ${selectedChar.lastname}`.trim();
                    }
                }
            }
            
            // Fallback to factionData if no selected character found
            if (!characterName && factionData?.characterName) {
                characterName = factionData.characterName;
            }
            
            if (characterName) {
                setOfficer(characterName);
            }
        }
    }, [isGtawAuthenticated, selectedCharacterId, swappableCharacters, factionData]);

    const handleCharacterChange = (characterId) => {
        setSelectedCharacterId(characterId);
        
        // Immediately update the officer field with the selected character name
        if (swappableCharacters) {
            const selectedChar = swappableCharacters.find(char => {
                if (char.character && char.character.characterId) {
                    return char.character.characterId == characterId;
                } else if (char.id) {
                    return char.id == characterId;
                }
                return false;
            });
            
            if (selectedChar) {
                let characterName = '';
                if (selectedChar.character && selectedChar.character.characterName) {
                    // Faction character structure
                    characterName = selectedChar.character.characterName;
                } else if (selectedChar.name) {
                    // All characters structure with name field
                    characterName = selectedChar.name;
                } else if (selectedChar.firstname && selectedChar.lastname) {
                    // All characters structure with firstname/lastname
                    characterName = `${selectedChar.firstname} ${selectedChar.lastname}`.trim();
                }
                
                if (characterName) {
                    setOfficer(characterName);
                }
            }
        }
        
        // Only call swapCharacter if this is a faction character
        // For non-faction characters, we just track the selection for the form
        if (swappableCharacters) {
            const selectedChar = swappableCharacters.find(char => {
                if (char.character && char.character.characterId) {
                    return char.character.characterId == characterId;
                } else if (char.id) {
                    return char.id == characterId;
                }
                return false;
            });
            
            // If it's a faction character, update the active character
            if (selectedChar && selectedChar.character && selectedChar.character.characterId) {
                swapCharacter(characterId);
            }
        }
    };

    const handleSubmit = async () => {
        // Validation from original handleSubmit
        if (!isGtawAuthenticated || !gtawUser) {
            showNotification('GTAW OAuth authentication is required to submit CCTV requests. Please log in with your GTAW account.', 'warning');
            return;
        }
    
        if (!officer.trim() || !department.trim() || !location.trim() || !description.trim() || !incidentDateTime.trim() || !requestReason.trim()) {
            showNotification('Please fill out all required fields.', 'warning');
            return;
        }
    
        setIsSubmitting(true);
    
        const cctvData = {
            rank, officer, officerPH, department, location, description,
            discordUsername, oocNotes, incidentDateTime, requestReason,
            DEBUG: {
                gtawUser: {
                    id: gtawUser.id,
                    username: gtawUser.username,
                    isFactionMember: gtawUser.isFactionMember,
                },
                selectedCharacter: selectedCharacterId ? (() => {
                    const selectedChar = swappableCharacters?.find(char => {
                        if (char.character && char.character.characterId) {
                            return char.character.characterId == selectedCharacterId;
                        } else if (char.id) {
                            return char.id == selectedCharacterId;
                        }
                        return false;
                    });
                    
                    if (selectedChar) {
                        if (selectedChar.character && selectedChar.character.characterId) {
                            return {
                                characterId: selectedChar.character.characterId,
                                characterName: selectedChar.character.characterName,
                                rank: selectedChar.character.rank,
                                scriptRank: selectedChar.character.scriptRank,
                                isFactionMember: true
                            };
                        } else if (selectedChar.id) {
                            return {
                                characterId: selectedChar.id,
                                characterName: selectedChar.name || `${selectedChar.firstname || ''} ${selectedChar.lastname || ''}`.trim(),
                                isFactionMember: false
                            };
                        }
                    }
                    return null;
                })() : null,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                environment: import.meta.env.NODE_ENV
            }
        };
    
        Sentry.captureMessage('CCTV Request Submitted', {
            level: 'info',
            extra: {
                officer: cctvData.officer,
                department: cctvData.department,
                location: cctvData.location,
                reason: cctvData.requestReason,
                submitter: gtawUser.username || 'Unknown App User'
            },
            tags: {
                webhook_type: 'cctv_request',
                environment: import.meta.env.NODE_ENV
            }
        });
        logEvent(analytics, 'cctv_request', {
            officer: cctvData.officer,
            department: cctvData.department,
            location: cctvData.location,
            reason: cctvData.requestReason,
            submitter: gtawUser.username || 'Unknown App User',
            environment: import.meta.env.NODE_ENV
        });
    
        const devWebhookURL = import.meta.env.VITE_DISCORD_WEBHOOK_ADMIN || import.meta.env.VITE_DEV_WEBHOOK;
        const leoWebhookURL = import.meta.env.VITE_LEO_WEBHOOK_URL; 
    
        if (!devWebhookURL) {
            showNotification('No CCTV webhook URLs are configured.', 'error');
            Sentry.captureMessage('Neither DEV nor LEO webhook URLs are configured for CCTV.', 'error');
            setIsSubmitting(false);
            return;
        }
    
        // Common embed object
        const commonEmbed = {
            title: "📹 CCTV Footage Request",
            color: 0x007bff,
            fields: [
                { name: "Requesting Officer Rank", value: cctvData.rank || "N/A", inline: true },
                { name: "Requesting Officer", value: cctvData.officer || "N/A", inline: true },
                { name: "Officer Phone Number", value: cctvData.officerPH || "N/A", inline: true },
                { name: "Requesting Department", value: cctvData.department || "N/A", inline: true },
                ...(cctvData.discordUsername ? [{ name: "Discord Username", value: cctvData.discordUsername, inline: true }] : []),
                { name: "Date/Time of Incident", value: cctvData.incidentDateTime || "N/A", inline: true },
                { name: "Reason for Request", value: cctvData.requestReason || "N/A", inline: false },
                { name: "CCTV Location", value: cctvData.location || "N/A", inline: false },
                { name: "Description of Events", value: `

${cctvData.description || "N/A"}

`, inline: false },
                ...(cctvData.oocNotes ? [{ name: "OOC Notes", value: `

${cctvData.oocNotes}

`, inline: false }] : []),
            ],
            timestamp: new Date().toISOString(),
            footer: { text: `PHMC CCTV Bot` }
        };

        // DEV-specific payload with Anti-Abuse info
        const devPayload = JSON.stringify({
            username: "CCTV Bot (DEV)",
            avatar_url: 'https://i.ibb.co/0pgw9hHm/phmc.png',
            content: "A new CCTV request has been generated by a Law Enforcement Officer, details enclosed.",
            embeds: [{
                ...commonEmbed,
                fields: [
                    ...commonEmbed.fields,
                    { name: "Anti Abuse Filtering - Submitted User GTAW UCP Data Output: ", value: `\`\`\`json
${JSON.stringify(cctvData.DEBUG, null, 2)}
\`\`\``, inline: false },
                ]
            }]
        });

        // LEO-specific payload without Anti-Abuse info
        const leoPayload = JSON.stringify({
            username: "CCTV Bot",
            avatar_url: 'https://i.ibb.co/0pgw9hHm/phmc.png',
            content: "A new CCTV request has been generated by a Law Enforcement Officer, details enclosed.",
            embeds: [commonEmbed]
        });

        const webhookTargets = [];
        if (devWebhookURL) webhookTargets.push({ name: 'Dev', url: devWebhookURL, payload: devPayload });
        if (leoWebhookURL) webhookTargets.push({ name: 'LEO', url: leoWebhookURL, payload: leoPayload }); 
    
        const sendPromises = webhookTargets.map(target =>
            fetch(target.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: target.payload
            }).then(async response => {
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Request to ${target.name} failed with status ${response.status}: ${errorText}`);
                }
                return { name: target.name, status: 'fulfilled' };
            })
        );
    
        const results = await Promise.allSettled(sendPromises);
        let successfulSends = 0;
    
        results.forEach((result, index) => {
            const targetName = webhookTargets[index].name;
            if (result.status === 'fulfilled') {
                console.log(`Successfully sent CCTV webhook to ${targetName}.`);
                successfulSends++;
            } else {
                console.error(`Failed to send CCTV webhook to ${targetName}:`, result.reason.message);
                Sentry.captureMessage(`CCTV Webhook to ${targetName} failed`, {
                    level: 'error',
                    extra: { reason: result.reason.message }
                });
            }
        });
    
        if (successfulSends === webhookTargets.length) {
            showNotification('CCTV Request sent successfully!', "check-circle");
            onHide();
        } else if (successfulSends > 0) {
            showNotification('CCTV Request sent, but some destinations failed.', "warning");
            onHide();
        } else {
            showNotification('Failed to send CCTV request to any destination.', "error");
        }
        setIsSubmitting(false);
    };

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onHide}
            title="CCTV Request"
            modalSize="large"
            variant="cctv"
            footer={
                <div className="cctv-modal-footer">
                    <button className="cctv-btn cctv-btn-secondary" onClick={onHide} disabled={isSubmitting}>
                        Cancel
                    </button>
                    <button
                        className="cctv-btn cctv-btn-primary"
                        onClick={handleSubmit}
                        disabled={isSubmitting || !isGtawAuthenticated}
                        title={!isGtawAuthenticated ? 'GTAW OAuth authentication required' : ''}
                    >
                        {isSubmitting ? <div className="cctv-spinner"></div> : null}
                        Send CCTV Request
                    </button>
                </div>
            }
        >
            <div className="cctv-modal-body">
                <div className="cctv-danger-text">
                    <i className="fas fa-exclamation-triangle"></i>
                    <div>
                        <strong>Disclaimer:</strong> This form directly requests CCTV footage from PHMC supervisors. Expect a response within 48 hours via phone or departmental channels.
                        <br />
                        <br />
                        <strong>(( Abuse of this system will be reported to Legal Faction Management.)) </strong>
                    </div>
                </div>
                <div className={`cctv-form-section ${isGtawAuthenticated ? 'auth-success' : 'auth-required'}`}>
                    <h5>
                        <i className={`fas ${isGtawAuthenticated ? 'fa-shield-alt' : 'fa-exclamation-triangle'}`}></i>
                        {isGtawAuthenticated ? 'Authenticated' : ' Authentication Required'}
                    </h5>
                    {isGtawAuthenticated ? (
                        <div className="auth-details">
                            <div><strong>UCP User:</strong> {gtawUser.username}</div>
                            
                            {swappableCharacters && swappableCharacters.length > 0 && (
                                <div className="character-selector">
                                    <label className="character-label"><strong>Select Character:</strong></label>
                                    <select
                                        className="form-control character-select" 
                                        value={selectedCharacterId || factionData?.characterId || ''}
                                        onChange={(e) => handleCharacterChange(e.target.value)}
                                        disabled={isSubmitting}
                                    >
                                        {swappableCharacters.map((char) => {
                                            let charId, charName;
                                            if (char.character && char.character.characterId) {
                                                charId = char.character.characterId;
                                                charName = char.character.characterName;
                                            } else if (char.id) {
                                                charId = char.id;
                                                charName = char.name || `${char.firstname || ''} ${char.lastname || ''}`.trim();
                                            } else {
                                                return null;
                                            }
                                            
                                            return (
                                                <option key={charId} value={charId}>
                                                    {charName} (ID: {charId})
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="auth-warning">
                            <i className="fas fa-info-circle"></i>
                            <span> GTAW OAuth authentication is required to submit CCTV requests. Please close this modal and click 'Sign In With GTA World' on the main page.</span>
                        </div>
                    )}
                </div>

                <div className="cctv-form-section">
                    <h5>Officer Information</h5>
                    <div className="cctv-form-row">
                        <div className="cctv-form-group">
                            <label className="cctv-form-label">Requesting Officer Rank</label>
                            <input
                                type="text"
                                className="form-control"
                                value={rank}
                                onChange={(e) => setRank(e.target.value)}
                                placeholder="e.g., Sergeant I"
                                disabled={isSubmitting}
                            />
                        </div>
                        <div className="cctv-form-group">
                            <label className="cctv-form-label required">Requesting Officer</label>
                            <input
                                type="text"
                                className="form-control"
                                value={officer}
                                onChange={(e) => setOfficer(e.target.value)}
                                placeholder={isGtawAuthenticated ? "Auto-filled from selected character" : "e.g., John Smith"}
                                required
                                disabled={isSubmitting}
                                readOnly={isGtawAuthenticated}
                            />
                        </div>
                        <div className="cctv-form-group">
                            <label className="cctv-form-label">Officer Phone Number</label>
                            <input
                                type="text"
                                className="form-control"
                                value={officerPH}
                                onChange={(e) => setOfficerPH(e.target.value)}
                                placeholder="(Optional)"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    <div className="cctv-form-row">
                        <div className="cctv-form-group">
                            <label className="cctv-form-label required">Requesting Department</label>
                            <input
                                type="text"
                                className="form-control"
                                value={department}
                                onChange={(e) => setDepartment(e.target.value)}
                                placeholder="e.g., LSPD, LSSD"
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                        <div className="cctv-form-group">
                            <label className="cctv-form-label">Discord Username</label>
                            <input
                                type="text"
                                className="form-control"
                                value={discordUsername}
                                onChange={(e) => setDiscordUsername(e.target.value)}
                                placeholder="e.g., frosty.js"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                </div>

                <div className="cctv-form-section">
                    <h5>Incident Details</h5>
                    <div className="cctv-form-row">
                        <div className="cctv-form-group">
                            <label className="cctv-form-label required">Date & Time of Incident</label>
                            <input
                                type="text"
                                className="form-control"
                                value={incidentDateTime}
                                onChange={(e) => setIncidentDateTime(e.target.value)}
                                placeholder="e.g., 15/JAN/2024 around 23:00"
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                        <div className="cctv-form-group">
                            <label className="cctv-form-label required">Reason for Request</label>
                            <select
                                className="form-control cctv-select" 
                                value={requestReason}
                                onChange={(e) => setRequestReason(e.target.value)}
                                required
                                disabled={isSubmitting}
                            >
                                <option value="">Select a reason...</option>
                                <option value="Criminal Investigation">Criminal Investigation</option>
                                <option value="Internal Affairs Investigation">Internal Affairs Investigation</option>
                                <option value="Traffic Incident Review">Traffic Incident Review</option>
                                <option value="General Security Review">General Security Review</option>
                                <option value="Other">Other (Specify in Description)</option>
                            </select>
                        </div>
                    </div>

                    <div className="cctv-form-row">
                        <div className="cctv-form-group full-width">
                            <label className="cctv-form-label required">CCTV Location</label>
                            <input
                                type="text"
                                className="form-control"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="e.g., Pillbox Hill Medical Center - Main Entrance"
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                </div>

                <div className="cctv-form-section">
                    <h5>Description & Notes</h5>
                    <div className="cctv-form-row">
                        <div className="cctv-form-group full-width">
                            <label className="cctv-form-label required">Requesting Description & OOC Information</label>
                            <textarea
                                className="form-control"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Provide a brief description of the events and the timeframe for the footage request."
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                    <div className="cctv-form-row">
                        <div className="cctv-form-group full-width">
                            <label className="cctv-form-label">OOC Notes</label>
                            <textarea
                                className="form-control"
                                value={oocNotes}
                                onChange={(e) => setOocNotes(e.target.value)}
                                placeholder="(( If you know names (or masked names) involved, as this will help us narrow our search of CCTV Logs (which can be very large) ))"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </BaseModal>
    );
};

export default CctvRequestWebhookModal;