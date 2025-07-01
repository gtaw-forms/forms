// src/components/Admin/CctvRequestWebhookModal.js
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import * as Sentry from "@sentry/react";

// --- MODIFICATION START: Generic Modal Styles ---
const modalOverlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1055, // High z-index
};
const modalContentStyle = {
    position: 'relative', backgroundColor: '#161b22', color: '#c9d1d9',
    padding: '25px 30px', borderRadius: '10px', boxShadow: '0 7px 20px rgba(0,0,0,0.5)',
    width: '90%', maxWidth: '800px', maxHeight: '90vh',
    display: 'flex', flexDirection: 'column', border: '1px solid #30363d',
};
const modalHeaderStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderBottom: '1px solid #30363d', paddingBottom: '15px', marginBottom: '20px',
};
const modalTitleStyle = { margin: 0, fontSize: '1.4rem', fontWeight: '500' };
const modalBodyStyle = { overflowY: 'auto', flexGrow: 1 };
const modalFooterStyle = {
    display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #30363d',
    paddingTop: '20px', marginTop: '25px',
};
const closeButtonStyle = {
    background: 'none', border: 'none', color: '#aaa', textDecoration: 'none',
    fontSize: '1.5rem', padding: '0 .5rem', lineHeight: 1, cursor: 'pointer',
};
// --- MODIFICATION END ---

const CctvRequestWebhookModal = ({ show, onHide, onSubmit, showNotification }) => {
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

    useEffect(() => {
        if (!show) {
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
        }
    }, [show]);

    const handleSubmit = async () => {
        if (!officer.trim() || !department.trim() || !location.trim() || !description.trim() || !incidentDateTime.trim() || !requestReason.trim()) {
            showNotification('Please fill out all required fields.', 'warning');
            return;
        }

        setIsSubmitting(true);
        try {
            const success = await onSubmit({
                rank, officer, officerPH, department, location, description,
                discordUsername, oocNotes, incidentDateTime, requestReason,
            });

            if (success) {
                onHide();
            }
        } catch (error) {
            console.error("Error submitting CCTV webhook:", error);
            Sentry.captureException(error, { extra: { context: 'CctvRequestWebhookModal Submit' } });
            showNotification('An error occurred during submission.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!show) return null;

    // --- MODIFICATION START: Use a portal for the modal ---
    const modalContent = (
        <div style={modalOverlayStyle} onClick={onHide}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                <div style={modalHeaderStyle}>
                    <h5 style={modalTitleStyle}>CCTV Request (Test Webhook)</h5>
                    <button onClick={onHide} style={closeButtonStyle} aria-label="Close modal">&times;</button>
                </div>
                <div style={modalBodyStyle}>
                    <p className="text-muted small">This form is sent directly to PHMC Supervisors to request CCTV Footage. It will be handled within the next 24 hours and you'll be contacted via Cell Phone or Departmental.</p>
                    <Form>
                        {/* --- MODIFICATION START: Reorganized form layout --- */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                            <Form.Group className="flex-fill" style={{ minWidth: '200px' }}>
                                <Form.Label>Requesting Officer Rank</Form.Label>
                                <Form.Control type="text" value={rank} onChange={(e) => setRank(e.target.value)} placeholder="e.g., Sergeant I" disabled={isSubmitting} />
                            </Form.Group>
                            <Form.Group className="flex-fill" style={{ minWidth: '200px' }}>
                                <Form.Label>Requesting Officer *</Form.Label>
                                <Form.Control type="text" value={officer} onChange={(e) => setOfficer(e.target.value)} placeholder="e.g., John Smith" required disabled={isSubmitting} />
                            </Form.Group>
                            <Form.Group className="flex-fill" style={{ minWidth: '200px' }}>
                                <Form.Label>Officer Phone Number</Form.Label>
                                <Form.Control type="text" value={officerPH} onChange={(e) => setOfficerPH(e.target.value)} placeholder="(Optional)" disabled={isSubmitting} />
                            </Form.Group>
                        </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                            <Form.Group className="flex-fill" style={{ minWidth: '200px' }}>
                                <Form.Label>Requesting Department *</Form.Label>
                                <Form.Control type="text" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g., LSPD, LSSD" required disabled={isSubmitting} />
                            </Form.Group>
                            <Form.Group className="flex-fill" style={{ minWidth: '200px' }}>
                                <Form.Label>Discord Username</Form.Label>
                                <Form.Control type="text" value={discordUsername} onChange={(e) => setDiscordUsername(e.target.value)} placeholder="e.g., frosty.js" disabled={isSubmitting} />
                            </Form.Group>
                        </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                            <Form.Group className="flex-fill" style={{ minWidth: '200px' }}>
                                <Form.Label>Date & Time of Incident *</Form.Label>
                                <Form.Control type="text" value={incidentDateTime} onChange={(e) => setIncidentDateTime(e.target.value)} placeholder="e.g., 15/JAN/2024 around 23:00" required disabled={isSubmitting} />
                            </Form.Group>
                            <Form.Group className="flex-fill" style={{ minWidth: '200px' }}>
                                <Form.Label>Reason for Request *</Form.Label>
                                <Form.Select value={requestReason} onChange={(e) => setRequestReason(e.target.value)} required disabled={isSubmitting}>
                                    <option value="">Select a reason...</option>
                                    <option value="Criminal Investigation">Criminal Investigation</option>
                                    <option value="Internal Affairs Investigation">Internal Affairs Investigation</option>
                                    <option value="Traffic Incident Review">Traffic Incident Review</option>
                                    <option value="General Security Review">General Security Review</option>
                                    <option value="Other">Other (Specify in Description)</option>
                                </Form.Select>
                            </Form.Group>
                        </div>

                            <Form.Label>Requesting CCTV Location *</Form.Label>
                                                    <Form.Control type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Pillbox Hill Medical Center - Main Entrance" required disabled={isSubmitting} />
                                                    <Form.Label>Requesting Description & OOC Information </Form.Label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                            <Form.Control as="textarea" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Provide a brief description of the events and the timeframe for the footage request." required disabled={isSubmitting} />
                            <Form.Control as="textarea" rows={4} value={oocNotes} onChange={(e) => setOocNotes(e.target.value)} placeholder="(( If you know names (or masked names) involved, as this will help us narrow our search of CCTV Logs (which can be very large) ))" disabled={isSubmitting} />
</div>                        {/* --- MODIFICATION END --- */}
                    </Form>
                </div>
                <div style={modalFooterStyle}>
                    <Button variant="secondary" onClick={onHide} disabled={isSubmitting}>Cancel</Button>
                    <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting} style={{ marginLeft: '10px' }}>
                        {isSubmitting ? <Spinner as="span" animation="border" size="sm" /> : 'Send Test Webhook'}
                    </Button>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.getElementById('modal-root'));
    // --- MODIFICATION END ---
};

export default CctvRequestWebhookModal;
