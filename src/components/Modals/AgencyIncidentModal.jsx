import React, { useState, useEffect } from 'react';
import { Form, Button, Spinner, Badge, ListGroup } from 'react-bootstrap';
import Select from 'react-select';
import { database } from '../../firebase';
import { ref, push, set } from 'firebase/database';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import { useData } from '../../contexts/DataContext';
import { sendDiscordWebhook } from '../../utils/webhookUtils';
import { useImageUpload } from '../../hooks/useImageUpload';
import * as Sentry from "@sentry/react";

const AgencyIncidentModal = ({ show, onHide, showNotification }) => {
    const { user, characterName } = useGtaWorldAuth();
    const { agencyDataStore } = useData();
    const [isLoading, setIsLoading] = useState(false);
    const [serverTime, setServerTime] = useState('');
    
    const { isUploading: isUploadingImage, handleImageUpload } = useImageUpload(showNotification, null);

    const [formData, setFormData] = useState({
        agency: null,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
        screenshotUrl: '',
        description: ''
    });

    // Real-time Server Time (France)
    useEffect(() => {
        const updateTimer = () => {
            const now = new Date().toLocaleString('en-GB', { 
                timeZone: 'Europe/Paris',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            setServerTime(now);
        };
        
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, []);

    const agencyOptions = Object.entries(agencyDataStore || {}).map(([key, data]) => ({
        value: key,
        label: data.fullName || key
    }));

    const onFileChange = async (e) => {
        const urls = await handleImageUpload(e);
        if (urls && urls.length > 0) {
            setFormData({ ...formData, screenshotUrl: urls[0].url });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.agency || !formData.date || !formData.time) {
            showNotification('Please fill in all required fields (Agency, Date, Time).', 'warning');
            return;
        }

        setIsLoading(true);
        try {
            const incidentRef = ref(database, 'agency_incidents');
            const newIncidentRef = push(incidentRef);
            
            const reporter = characterName || user?.username || 'Unknown';
            const dateTime = `${formData.date} ${formData.time}`;

            const payload = {
                agency: formData.agency.value,
                agencyLabel: formData.agency.label,
                dateTime: dateTime,
                screenshotUrl: formData.screenshotUrl,
                description: formData.description,
                reportedBy: reporter,
                reportedByUid: user?.id || 'Unknown',
                timestamp: Date.now(),
                serverTime: serverTime, // France Time at moment of submit
                status: 'Pending'
            };

            await set(newIncidentRef, payload);

            // Discord Webhook
            const webhookUrl = import.meta.env.VITE_DISCORD_WEBHOOK_ADMIN || import.meta.env.VITE_DEV_WEBHOOK;
            if (webhookUrl) {
                const embed = {
                    title: "🚨 New Agency Incident Reported",
                    color: 0xff4757,
                    fields: [
                        { name: "Agency", value: payload.agencyLabel, inline: true },
                        { name: "Incident Time", value: dateTime, inline: true },
                        { name: "Reporter", value: reporter, inline: true },
                        { name: "Description", value: payload.description || "No description provided.", inline: false },
                        { name: "Server Time (FR)", value: serverTime, inline: true }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: { text: "Agency Incident Tracker" }
                };
                if (payload.screenshotUrl) {
                    embed.image = { url: payload.screenshotUrl };
                }
                await sendDiscordWebhook(webhookUrl, { embeds: [embed] });
            }

            showNotification('Agency incident reported successfully.', 'success');
            onHide();
            // Reset form
            setFormData({
                agency: null,
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
                screenshotUrl: '',
                description: ''
            });
        } catch (error) {
            console.error("Error saving agency incident:", error);
            Sentry.captureException(error, { extra: { context: 'AgencyIncidentModal Submit' } });
            showNotification('Failed to report incident. Please try again.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    if (!show) return null;

    const overlayStyle = {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 10000, backdropFilter: 'blur(8px)', padding: '20px'
    };

    const modalStyle = {
        backgroundColor: '#0d1117', borderRadius: '12px', border: '1px solid #30363d',
        width: '100%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto',
        padding: '2rem', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)', position: 'relative'
    };

    const selectStyles = {
        control: (base) => ({
            ...base, backgroundColor: '#161b22', borderColor: '#30363d', color: '#c9d1d9',
            '&:hover': { borderColor: '#8b949e' }
        }),
        menu: (base) => ({ ...base, backgroundColor: '#161b22', border: '1px solid #30363d' }),
        option: (base, state) => ({
            ...base, backgroundColor: state.isFocused ? '#1f2937' : 'transparent',
            color: '#c9d1d9', '&:active': { backgroundColor: '#238636' }
        }),
        singleValue: (base) => ({ ...base, color: '#c9d1d9' }),
        input: (base) => ({ ...base, color: '#c9d1d9' })
    };

    return (
        <div style={overlayStyle} onClick={onHide}>
            <div style={modalStyle} onClick={e => e.stopPropagation()}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                    <h2 style={{ color: '#fff', margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>
                        <i className="fas fa-shield-alt text-danger me-2"></i>
                        Agency Incident Tracker
                    </h2>
                    <button onClick={onHide} style={{ background: 'none', border: 'none', color: '#8b949e', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                </div>
                
                <div className="mb-4 text-center">
                    <Badge bg="dark" className="border border-secondary py-2 px-3">
                        <i className="fas fa-clock text-warning me-2"></i>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>Server Time: {serverTime}</span>
                    </Badge>
                </div>

                <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3">
                        <Form.Label style={{ color: '#c9d1d9' }}>Involved Agency *</Form.Label>
                        <Select
                            options={agencyOptions}
                            styles={selectStyles}
                            value={formData.agency}
                            onChange={(val) => setFormData({ ...formData, agency: val })}
                            placeholder="Select Agency..."
                            isSearchable
                        />
                    </Form.Group>

                    <div className="row">
                        <div className="col-md-6">
                            <Form.Group className="mb-3">
                                <Form.Label style={{ color: '#c9d1d9' }}>Date *</Form.Label>
                                <Form.Control
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    style={{ backgroundColor: '#161b22', borderColor: '#30363d', color: '#c9d1d9' }}
                                />
                            </Form.Group>
                        </div>
                        <div className="col-md-6">
                            <Form.Group className="mb-3">
                                <Form.Label style={{ color: '#c9d1d9' }}>Time *</Form.Label>
                                <Form.Control
                                    type="time"
                                    value={formData.time}
                                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                    style={{ backgroundColor: '#161b22', borderColor: '#30363d', color: '#c9d1d9' }}
                                />
                            </Form.Group>
                        </div>
                    </div>

                    <Form.Group className="mb-3">
                        <Form.Label style={{ color: '#c9d1d9' }}>Screenshot / Evidence (Optional)</Form.Label>
                        <div className="d-flex gap-2 mb-2">
                            <Form.Control
                                type="url"
                                placeholder="Paste Imgur URL..."
                                value={formData.screenshotUrl}
                                onChange={(e) => setFormData({ ...formData, screenshotUrl: e.target.value })}
                                style={{ backgroundColor: '#161b22', borderColor: '#30363d', color: '#c9d1d9' }}
                            />
                            <div style={{ position: 'relative' }}>
                                <Button variant="outline-info" disabled={isUploadingImage} style={{ whiteSpace: 'nowrap' }}>
                                    {isUploadingImage ? <Spinner size="sm" /> : <><i className="fas fa-upload me-1"></i>Upload</>}
                                </Button>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={onFileChange}
                                    style={{
                                        position: 'absolute',
                                        top: 0, left: 0, width: '100%', height: '100%',
                                        opacity: 0, cursor: 'pointer'
                                    }}
                                />
                            </div>
                        </div>
                        {formData.screenshotUrl && (
                            <div className="text-muted small">
                                <i className="fas fa-check-circle text-success me-1"></i>
                                Attached: {formData.screenshotUrl.substring(0, 40)}...
                            </div>
                        )}
                    </Form.Group>

                    <Form.Group className="mb-4">
                        <Form.Label style={{ color: '#c9d1d9' }}>Description / Notes (Optional)</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            placeholder="Provide any additional context..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            style={{ backgroundColor: '#161b22', borderColor: '#30363d', color: '#c9d1d9' }}
                        />
                    </Form.Group>

                    <div className="d-grid">
                        <Button variant="danger" type="submit" disabled={isLoading} style={{ fontWeight: 'bold', padding: '12px' }}>
                            {isLoading ? <><Spinner size="sm" className="me-2" /> Reporting...</> : 'Submit Incident'}
                        </Button>
                    </div>
                </Form>
            </div>
        </div>
    );
};

export default AgencyIncidentModal;