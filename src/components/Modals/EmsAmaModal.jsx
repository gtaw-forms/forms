import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Form, Button } from 'react-bootstrap';
import * as Sentry from "@sentry/react";
import EMSAMAImage from '../../assets/EMSAMA.png';
import { copyToClipboard } from '../UI/notificationService';
import BaseModal from './BaseModal';

const EmsAmaModal = ({ show, onHide, showNotification, commitInfo, handleImageUpload }) => {
    const [patientSignature, setPatientSignature] = useState('');
    const [date, setDate] = useState('');
    const [guardianSignature, setGuardianSignature] = useState('');
    const [paramedicSignature, setParamedicSignature] = useState('');
    const [imageUrl, setImageUrl] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (show) {
            setPatientSignature(localStorage.getItem('emsAmaPatientSignature') || '');
            setDate(localStorage.getItem('emsAmaDate') || '');
            setGuardianSignature(localStorage.getItem('emsAmaGuardianSignature') || '');
            setParamedicSignature(localStorage.getItem('emsAmaParamedicSignature') || '');
            setImageUrl(null);
        }
    }, [show]);

    const handleSave = useCallback(async () => {
        setIsSaving(true);
        showNotification('Generating AMA form...', 'upload');

        localStorage.setItem('emsAmaPatientSignature', patientSignature);
        localStorage.setItem('emsAmaDate', date);
        localStorage.setItem('emsAmaGuardianSignature', guardianSignature);
        localStorage.setItem('emsAmaParamedicSignature', paramedicSignature);

        const canvas = document.createElement('canvas');
        canvas.width = 1000; canvas.height = 1414;
        const ctx = canvas.getContext('2d');

        try {
            const baseImage = await new Promise((res, rej) => {
                const img = new Image(); img.crossOrigin = "anonymous";
                img.onload = () => res(img); img.onerror = rej;
                img.src = EMSAMAImage;
            });

            ctx.drawImage(baseImage, 0, 0, 1000, 1414);
            ctx.textBaseline = 'top';
            ctx.fillStyle = 'black';
            ctx.font = 'bold 20px sans-serif';

            ctx.fillText(patientSignature, 1000 * 0.12, 1414 * 0.73);
            ctx.fillText(date, 1000 * 0.12, 1414 * 0.83);
            ctx.fillText(guardianSignature, 1000 * 0.60, 1414 * 0.73);
            ctx.fillText(paramedicSignature, 1000 * 0.60, 1414 * 0.83);

            const dataUrl = canvas.toDataURL('image/png');
            const result = await handleImageUpload(dataUrl);
            const link = result[0].url;
            
            setImageUrl(link);
            await copyToClipboard(link, showNotification, 'Link copied!');
            showNotification('AMA Form Saved!', 'success');
        } catch (error) {
            Sentry.captureException(error);
            showNotification('Failed to generate AMA form.', 'error');
        } finally {
            setIsSaving(false);
        }
    }, [patientSignature, date, guardianSignature, paramedicSignature, handleImageUpload, showNotification]);

    return (
        <BaseModal
            isOpen={show}
            onClose={onHide}
            title="Against Medical Advice (AMA)"
            modalSize="large"
            variant="info"
            footer={
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Processing...' : 'Generate & Upload AMA'}
                </Button>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {imageUrl && (
                    <div style={{ padding: '10px', backgroundColor: 'rgba(63, 185, 80, 0.1)', border: '1px solid #3fb950', borderRadius: '8px' }}>
                        <strong>Link:</strong> <a href={imageUrl} target="_blank" rel="noreferrer" style={{ color: '#58a6ff' }}>{imageUrl}</a>
                    </div>
                )}

                <div style={{ position: 'relative', border: '1px solid #30363d', borderRadius: '8px', overflow: 'hidden' }}>
                    <img src={EMSAMAImage} alt="Preview" style={{ width: '100%', display: 'block' }} />
                    <div style={{ position: 'absolute', top: '73%', left: '12%', color: 'black', fontSize: 'clamp(8px, 2vw, 16px)', fontWeight: 'bold' }}>{patientSignature}</div>
                    <div style={{ position: 'absolute', top: '83%', left: '12%', color: 'black', fontSize: 'clamp(8px, 2vw, 16px)', fontWeight: 'bold' }}>{date}</div>
                    <div style={{ position: 'absolute', top: '73%', left: '60%', color: 'black', fontSize: 'clamp(8px, 2vw, 16px)', fontWeight: 'bold' }}>{guardianSignature}</div>
                    <div style={{ position: 'absolute', top: '83%', left: '60%', color: 'black', fontSize: 'clamp(8px, 2vw, 16px)', fontWeight: 'bold' }}>{paramedicSignature}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <Form.Group>
                        <Form.Label style={{ fontSize: '0.85rem', color: '#8b949e' }}>Patient Signature</Form.Label>
                        <Form.Control type="text" value={patientSignature} onChange={e => setPatientSignature(e.target.value)} style={{ backgroundColor: '#161b22', color: '#e6edf3', borderColor: '#30363d' }} />
                    </Form.Group>
                    <Form.Group>
                        <Form.Label style={{ fontSize: '0.85rem', color: '#8b949e' }}>Date</Form.Label>
                        <Form.Control type="text" value={date} onChange={e => setDate(e.target.value)} placeholder="MM/DD/YYYY" style={{ backgroundColor: '#161b22', color: '#e6edf3', borderColor: '#30363d' }} />
                    </Form.Group>
                    <Form.Group>
                        <Form.Label style={{ fontSize: '0.85rem', color: '#8b949e' }}>Guardian Signature (Optional)</Form.Label>
                        <Form.Control type="text" value={guardianSignature} onChange={e => setGuardianSignature(e.target.value)} style={{ backgroundColor: '#161b22', color: '#e6edf3', borderColor: '#30363d' }} />
                    </Form.Group>
                    <Form.Group>
                        <Form.Label style={{ fontSize: '0.85rem', color: '#8b949e' }}>Paramedic Signature</Form.Label>
                        <Form.Control type="text" value={paramedicSignature} onChange={e => setParamedicSignature(e.target.value)} style={{ backgroundColor: '#161b22', color: '#e6edf3', borderColor: '#30363d' }} />
                    </Form.Group>
                </div>
            </div>
        </BaseModal>
    );
};

export default EmsAmaModal;
