// src/components/admin/BulkAddFieldsModal.jsx
import React, { useState, useEffect } from "react";
import { Button, Form } from "react-bootstrap";
import BaseModal from "../Modals/BaseModal";

const inputStyle = {
    width: "100%",
    padding: "0.75rem",
    marginBottom: "1rem",
    background: "#1e293b",
    border: "1px solid #334155",
    color: "#e2e8f0",
    borderRadius: 8,
    fontSize: "1rem"
};

const frequentlyUsedIcons = [
  { class: 'fas fa-id-card', label: 'Identification' },
  { class: 'fas fa-notes-medical', label: 'Medical Findings' },
  { class: 'fas fa-camera', label: 'Scene Evidence' },
  { class: 'fas fa-file-medical', label: 'Morgue / CDNA' },
  { class: 'fas fa-user', label: 'User' },
  { class: 'fas fa-hospital', label: 'Hospital' },
  { class: 'fas fa-ambulance', label: 'Ambulance' },
  { class: 'fas fa-heartbeat', label: 'Heartbeat' },
  { class: 'fas fa-pills', label: 'Medicine' },
  { class: 'fas fa-clipboard-list', label: 'Clipboard' },
  { class: 'fas fa-map-marker-alt', label: 'Location' },
  { class: 'fas fa-clock', label: 'Clock' },
  { class: 'fas fa-exclamation-triangle', label: 'Warning' },
  { class: 'fas fa-info-circle', label: 'Info' },
  { class: 'fas fa-user-ghost', label: 'Decedent' },
  { class: 'fas fa-microscope', label: 'Laboratory' },
];

const BulkAddFieldsModal = ({ show, onBulkAdd, onClose, existingFields = [], bbcodeTemplate = "" }) => {
    const createDefaultNewField = () => ({
        type: "input", label: "", name: "", placeholder: "", layout: "full", rows: 4, maxImages: 6,
        optionsKey: "", timerType: "", buttonLabel: "", buttonAction: "", displayCurrentTime: false,
        id: null, associatedInputField: null, options: [], inputType: "", showIf: null,
        infoType: 'Information', content: '', decedentItemSchemaJson: "",
    });
    
    const [queuedFields, setQueuedFields] = useState([]);
    const [newField, setNewField] = useState(createDefaultNewField());
    const [internalBbcode, setInternalBbcode] = useState("");

    useEffect(() => { if (show) setInternalBbcode(bbcodeTemplate); }, [show, bbcodeTemplate]);

    const handleQueueField = () => {
        if (!newField.label && newField.type !== 'hr') return alert("Label is required!");
        const fieldToQueue = { ...newField, id: `new-${Date.now()}-${Math.random()}` };
        setQueuedFields(prev => [...prev, fieldToQueue]);
        setNewField(createDefaultNewField());
    };

    const handleConfirmBulkAdd = () => {
        onBulkAdd(queuedFields);
        setQueuedFields([]);
        onClose();
    };

    return (
        <BaseModal
            isOpen={show}
            onClose={onClose}
            title="Add Multiple Fields"
            modalSize="full"
            variant="info"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" onClick={handleConfirmBulkAdd} disabled={queuedFields.length === 0} style={{ marginLeft: '10px' }}>
                        Add {queuedFields.length} Fields to Form
                    </Button>
                </>
            }
        >
            <div style={{ display: 'flex', gap: '20px', height: '100%' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h5 style={{ color: '#60a5fa' }}>BBCode Template</h5>
                    <pre style={{ flex: 1, backgroundColor: '#161b22', padding: '15px', borderRadius: '8px', overflow: 'auto', fontSize: '0.85rem', color: '#8b949e', border: '1px solid #30363d' }}>
                        {internalBbcode || "No template provided."}
                    </pre>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ backgroundColor: '#161b22', padding: '15px', borderRadius: '8px', border: '1px solid #30363d' }}>
                        <h5 style={{ color: '#60a5fa' }}>Define New Field</h5>
                        <Form.Select value={newField.type} onChange={e => setNewField({ ...createDefaultNewField(), type: e.target.value })} style={{ backgroundColor: '#0d1117', color: '#e6edf3', borderColor: '#30363d', marginBottom: '10px' }}>
                            <option value="input">Text Input</option>
                            <option value="textarea">Textarea</option>
                            <option value="section">Section Header</option>
                            <option value="select">Dropdown</option>
                            <option value="checkbox">Checkbox</option>
                            <option value="radio">Radio Button</option>
                            <option value="image">Image Upload</option>
                        </Form.Select>
                        <Form.Control placeholder="Label" value={newField.label} onChange={e => setNewField({ ...newField, label: e.target.value })} style={{ backgroundColor: '#0d1117', color: '#e6edf3', borderColor: '#30363d', marginBottom: '10px' }} />
                        <Button onClick={handleQueueField} style={{ width: '100%' }}>Add to Queue</Button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        <h5 style={{ color: '#60a5fa' }}>Queued Fields ({queuedFields.length})</h5>
                        {queuedFields.map((f, i) => (
                            <div key={f.id} style={{ backgroundColor: '#1e293b', padding: '10px', borderRadius: '6px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span><strong>{f.label}</strong> ({f.type})</span>
                                <Button variant="danger" size="sm" onClick={() => setQueuedFields(prev => prev.filter(q => q.id !== f.id))}>Remove</Button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </BaseModal>
    );
};

export default BulkAddFieldsModal;
