import React, { useState } from 'react';
import { Form, Button } from 'react-bootstrap';
import * as Sentry from "@sentry/react";
// --- Styles ---
const modalOverlayStyle = {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1050,
};
const modalContentStyle = {
    backgroundColor: '#0d1117', color: '#c9d1d9', padding: '20px',
    borderRadius: '5px', width: '90%',
    maxWidth: '750px', 
    maxHeight: '1500px', position: 'relative',
    border: '1px solid #30363d',
};
const modalHeaderStyle = {
    fontSize: '1.2em', fontWeight: 'bold', marginBottom: '15px',
    borderBottom: '1px solid #30363d', paddingBottom: '10px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    color: '#c9d1d9',
};
const modalTitleStyle = { margin: 0 };
const closeButtonStyle = {
    background: 'none', border: 'none', color: '#c9d1d9',
    fontSize: '24px', cursor: 'pointer', lineHeight: '1', padding: '0 5px',
};
const modalBodyStyle = { paddingTop: '10px' };
const modalFooterStyle = {
    borderTop: '1px solid #30363d', paddingTop: '15px', marginTop: '20px',
    display: 'flex', justifyContent: 'flex-end', gap: '10px',
};
const formControlStyle = {
    backgroundColor: '#0d1117', color: '#c9d1d9',
    borderColor: '#30363d', width: '100%',
};
const formLabelStyle = {
    color: '#c9d1d9',
    marginBottom: '8px', 
    marginTop: '10px',   
    display: 'block',
};
const reactSelectStyles = {
    control: (base) => ({
        ...base,
        backgroundColor: '#0d1117', 
        color: '#c9d1d9',           
        borderColor: '#30363d',     
        '&:hover': {
            borderColor: '#c9d1d9' 
        }
    }),
    menu: (base) => ({
        ...base,
        backgroundColor: '#0d1117', 
        zIndex: 1051 
    }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isFocused ? '#1f2937' : '#0d1117', 
        color: '#c9d1d9',
        '&:hover': {
            backgroundColor: '#1f2937' 
        }
    }),
    singleValue: (base) => ({
        ...base,
        color: '#c9d1d9' 
    }),
    input: (base) => ({
        ...base,
        color: '#c9d1d9' 
    }),
    placeholder: (base) => ({
        ...base,
        color: '#6c757d' 
    }),
        group: (base) => ({ ...base, paddingTop: 8, paddingBottom: 8 }),
    groupHeading: (base) => ({ ...base, color: '#6c757d', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: 4 })

};
// --- End Styles ---

const EmployeeModal = ({
    show,
    onHide,
    showNotification
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [reportData, setReportData] = useState({
        characterName: '',
        discordName: '',
        rank: '',
        accountType: 'phmc', // phmc or coroner
        additionalInfo: ''
    });

    const handleInputChange = (e) => {
        setReportData({ ...reportData, [e.target.name]: e.target.value });
    };
    const sendMissingAccountWebhook = async (reportData) => {
        try {
            const webhookURL = process.env.REACT_APP_DEV_WEBHOOK;
            if (!webhookURL) {
                console.warn('Dev webhook URL not configured for missing account reports.');
                return;
            }

            const embed = {
                title: "🚨 Missing Account Report",
                color: 0xff6b35, // Orange color for attention
                fields: [
                    { name: "Character Name", value: reportData.characterName || 'Not provided', inline: true },
                    { name: "Discord Name", value: reportData.discordName || 'Not provided', inline: true },
                    { name: "Rank/Position", value: reportData.rank || 'Not provided', inline: true },
                    { name: "Account Type", value: reportData.accountType === 'phmc' ? 'PHMC Staff' : 'Coroner', inline: true },
                    { name: "Additional Information", value: reportData.additionalInfo || 'None provided', inline: false }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: "PHMC Forms - Missing Account System"
                }
            };

            const payload = {
                username: "Missing Account Bot",
                embeds: [embed]
            };

            const response = await fetch(webhookURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log('Missing account webhook sent successfully');
                return true;
            } else {
                console.error('Failed to send missing account webhook:', response.status);
                return false;
            }
        } catch (error) {
            console.error('Error sending missing account webhook:', error);
            Sentry.captureException(error, { extra: { context: 'Missing Account Webhook' } });
            return false;
        }
    };

    const handleSubmit = async () => {
        // Validate required fields
        if (!reportData.characterName.trim()) {
            showNotification('Please enter your character name.', 'warning');
            return;
        }

        if (!reportData.discordName.trim()) {
            showNotification('Please enter your Discord name.', 'warning');
            return;
        }

        setIsLoading(true);

        try {
            const success = await sendMissingAccountWebhook(reportData);
            
            if (success) {
                showNotification('Please ping Alyson Frost in the PHMC Discord for approval.', 'success');
                
                // Clear form after successful submission
                setReportData({
                    characterName: '',
                    discordName: '',
                    rank: '',
                    accountType: 'phmc',
                    additionalInfo: ''
                });
                
                // Close modal after a brief delay
                setTimeout(() => {
                    handleClose();
                }, 2000);
                
            } else {
                showNotification('Failed to submit your report. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Error submitting missing account report:', error);
            showNotification('An error occurred while submitting your report. Please try again.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (typeof onHide === 'function') {
            onHide();
        } else {
            console.error('EmployeeModal: onHide is not a function', onHide);
        }
    };

    return (
        show ? (
            <div style={modalOverlayStyle} onClick={handleClose}>
                <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                    <div style={modalHeaderStyle}>
                        <h5 style={modalTitleStyle}>My Account Isn't Listed</h5>
                        <button onClick={handleClose} style={closeButtonStyle} aria-label="Close modal">
                            &times;
                        </button>
                    </div>
                    <div style={modalBodyStyle}>
                        <div style={{ marginBottom: '20px', color: '#c9d1d9', fontSize: '14px' }}>
                            <p>If your account isn't showing up in the employee list, please fill out this form and an administrator will add it to the system.</p>
                        </div>
                        <Form>
                            <Form.Group className="mb-3">
                                <Form.Label style={formLabelStyle}>Character Name *</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="characterName"
                                    value={reportData.characterName}
                                    onChange={handleInputChange}
                                    placeholder="Enter your in-character name"
                                    required
                                    style={formControlStyle}
                                />
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label style={formLabelStyle}>Discord Name *</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="discordName"
                                    value={reportData.discordName}
                                    onChange={handleInputChange}
                                    placeholder="Enter your Discord username"
                                    required
                                    style={formControlStyle}
                                />
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label style={formLabelStyle}>Rank/Position</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="rank"
                                    value={reportData.rank}
                                    onChange={handleInputChange}
                                    placeholder="Enter your rank or position (optional)"
                                    style={formControlStyle}
                                />
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label style={formLabelStyle}>Account Type</Form.Label>
                                <div key={`inline-radio`} className="mb-3">
                                    <Form.Check
                                        inline
                                        label="PHMC Staff"
                                        name="accountType"
                                        type="radio"
                                        id={`phmc-radio`}
                                        value="phmc"
                                        checked={reportData.accountType === 'phmc'}
                                        onChange={handleInputChange}
                                        style={{ color: '#c9d1d9' }}
                                    />
                                    <Form.Check
                                        inline
                                        label="Coroner"
                                        name="accountType"
                                        type="radio"
                                        id={`coroner-radio`}
                                        value="coroner"
                                        checked={reportData.accountType === 'coroner'}
                                        onChange={handleInputChange}
                                        style={{ color: '#c9d1d9' }}
                                    />
                                </div>
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label style={formLabelStyle}>Additional Information</Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={3}
                                    name="additionalInfo"
                                    value={reportData.additionalInfo}
                                    onChange={handleInputChange}
                                    placeholder="Any additional information that might help (badge number, PH number, etc.)"
                                    style={formControlStyle}
                                />
                            </Form.Group>
                        </Form>
                    </div>
                    <div style={modalFooterStyle}>
                        <Button variant="primary" onClick={handleSubmit} disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                                    Submitting...
                                </>
                            ) : (
                                'Submit Report'
                            )}
                        </Button>
                        <Button variant="secondary" onClick={handleClose}>
                            Cancel
                        </Button>
                    </div>
                </div>
            </div>
        ) : null
    );
};

export default EmployeeModal;
