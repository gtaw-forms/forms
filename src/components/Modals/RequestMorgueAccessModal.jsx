import React, { useState, useEffect } from 'react';
import BaseModal from './BaseModal';
import { useGtaWorldAuth } from '../../hooks/useGtaWorldAuth';
import { Form, Button, Alert } from 'react-bootstrap';

const RequestMorgueAccessModal = ({ show, onHide, showNotification }) => {
    const { user, isAuthenticated, login, swappableCharacters } = useGtaWorldAuth();
    const [selectedCharId, setSelectedCharId] = useState('');
    const [faction, setFaction] = useState('');
    const [department, setDepartment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset fields on show
    useEffect(() => {
        if (show) {
            setSelectedCharId(user?.faction?.characterId || user?.faction?.id || '');
            setFaction('');
            setDepartment('');
        }
    }, [show, user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedCharId || !faction || !department) {
            showNotification('Please fill in all fields.', 'warning');
            return;
        }

        setIsSubmitting(true);
        const selectedChar = swappableCharacters.find(c => c.id === selectedCharId);
        
        const payload = {
            embeds: [{
                title: 'Morgue Intake Access Request',
                color: 0x3498db,
                fields: [
                    { name: 'User', value: user.username, inline: true },
                    { name: 'Character', value: selectedChar?.characterName || 'Unknown', inline: true },
                    { name: 'Character ID', value: selectedCharId, inline: true },
                    { name: 'Faction', value: faction, inline: true },
                    { name: 'Department', value: department, inline: true }
                ],
                footer: { text: 'PHMC Forms Access Management' },
                timestamp: new Date().toISOString()
            }]
        };

        try {
            const webhookUrl = import.meta.env.VITE_DISCORD_WEBHOOK_ADMIN || import.meta.env.VITE_DEV_WEBHOOK;
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showNotification('Access request sent successfully! A supervisor will review it.', 'success');
                onHide();
            } else {
                throw new Error('Failed to send request');
            }
        } catch (error) {
            console.error('Error sending access request:', error);
            showNotification('Failed to send access request. Please try again later.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <BaseModal
            isOpen={show}
            onClose={onHide}
            title="Request Morgue Access"
            variant="info"
            modalSize="md"
            footer={
                <>
                    <Button variant="secondary" onClick={onHide} disabled={isSubmitting}>Cancel</Button>
                    <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting || !isAuthenticated}>
                        {isSubmitting ? 'Sending...' : 'Send Request'}
                    </Button>
                </>
            }
        >
            {!isAuthenticated ? (
                <div className="text-center p-4">
                    <i className="fas fa-lock fa-3x mb-3 text-warning"></i>
                    <h4>Authentication Required</h4>
                    <p className="text-muted">You must sign in with GTA World OAuth to request access.</p>
                    <Button variant="primary" onClick={() => login()}>Sign in with GTA World</Button>
                </div>
            ) : (
                <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3">
                        <Form.Label className="fw-bold">Select a Character</Form.Label>
                        <Form.Select 
                            value={selectedCharId} 
                            onChange={(e) => setSelectedCharId(e.target.value)}
                            required
                        >
                            <option value="">Choose your character...</option>
                            {swappableCharacters.map(char => (
                                <option key={char.id} value={char.id}>
                                    {char.characterName} ({char.rank})
                                </option>
                            ))}
                        </Form.Select>
                        <Form.Text className="text-muted">
                            Only whitelisted characters will be granted access.
                        </Form.Text>
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label className="fw-bold">Faction</Form.Label>
                        <Form.Control 
                            type="text" 
                            placeholder="e.g. LSPD, LSSD, LS FIRE" 
                            value={faction}
                            onChange={(e) => setFaction(e.target.value)}
                            required
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label className="fw-bold">Department</Form.Label>
                        <Form.Control 
                            type="text" 
                            placeholder="e.g. Forensics, Homicide, Detective Bureau" 
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                            required
                        />
                        <Form.Text className="text-muted">
                            Please specify which division requires access (e.g., Forensics, Homicide).
                        </Form.Text>
                    </Form.Group>

                    <Alert variant="info" className="small border-0 shadow-sm mt-4">
                        <i className="fas fa-info-circle me-2"></i>
                        Granting access may take up to 24 hours. You will be notified via Discord or can check back here.
                    </Alert>
                </Form>
            )}
        </BaseModal>
    );
};

export default RequestMorgueAccessModal;
