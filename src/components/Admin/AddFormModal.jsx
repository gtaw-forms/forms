import React, { useState, useEffect, useMemo, useCallback } from "react";
import { database } from "../../firebase";
import { ref, set, get, update, runTransaction } from "firebase/database";
import Select from 'react-select';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import { useData } from '../../contexts/DataContext';
import { logAdminAction, getUserContext } from '../../utils/adminLogger';
import BulkAddFieldsModal from './BulkAddFieldsModal';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableFieldItem } from './SortableFieldItem';
import { useNotification } from "../../contexts/NotificationContext";
import BaseModal from '../Modals/BaseModal';
import { Button, Form, Badge, Row, Col, Card } from 'react-bootstrap';

const inputStyle = {
  width: "100%",
  padding: "0.75rem",
  marginBottom: "1rem",
  background: "#0d1117",
  border: "1px solid #30363d",
  color: "#e6edf3",
  borderRadius: 8,
  fontSize: "0.95rem"
};

const sectionHeaderStyle = {
    color: '#60a5fa',
    fontSize: '1.1rem',
    fontWeight: '600',
    marginBottom: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderBottom: '1px solid #30363d',
    paddingBottom: '8px'
};

const cardStyle = {
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
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

const AddFormModal = ({ show, onClose: onHide, editingForm = null, isDuplicate = false }) => {
  const { showNotification } = useNotification();
  const { user: gtawUser } = useGtaWorldAuth();
  const { refreshSegments } = useData();

  const [formId, setFormId] = useState("");
  const [formName, setFormName] = useState("");
  const [category, setCategory] = useState("");
  const [bbcodeTemplate, setBbcodeTemplate] = useState("");
  const [titleGeneratorCode, setTitleGeneratorCode] = useState("");
  const [fields, setFields] = useState([]);
  const [accessType, setAccessType] = useState("Public");
  const [formDescription, setFormDescription] = useState("");
  const [isHidden, setIsHidden] = useState(false);
  const [saving, setSaving] = useState(false);

  // State for field deletion confirmation
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState(null);

  const createDefaultNewField = () => ({
    type: "input", label: "", name: "", placeholder: "", layout: "full", rows: 4, maxImages: 6,
    optionsKey: "", timerType: "", buttonLabel: "", buttonAction: "", displayCurrentTime: false,
    id: null, associatedInputField: null, options: [], inputType: "", showIf: null,
    infoType: 'Information', content: '', decedentItemSchemaJson: "", icon: "", listType: ""
  });

  const [newField, setNewField] = useState(createDefaultNewField());
  const [editingFieldIndex, setEditingFieldIndex] = useState(null);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);

  // Conditional Logic Builder State
  const [showConditionalBuilder, setShowConditionalBuilder] = useState(false);
  const [conditionalField, setConditionalField] = useState("");
  const [conditionalValue, setConditionalValue] = useState("");
  const [tempConditions, setTempConditions] = useState([]);
  const [conditionMode, setConditionMode] = useState("and");
  const [exactValue, setExactValue] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), 
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (editingForm) {
      setFormId(isDuplicate ? `${editingForm.id}_copy` : (editingForm.id || ""));
      setFormName(isDuplicate ? `${editingForm.name} (Copy)` : (editingForm.name || ""));
      setCategory(editingForm.category || "");
      setBbcodeTemplate(editingForm.template || editingForm.bbcodeTemplate || "");
      setTitleGeneratorCode(editingForm.titleGeneratorCode || "");
      const rawFields = Array.isArray(editingForm.fields) ? editingForm.fields : (editingForm.fields ? Object.values(editingForm.fields) : []);
      setFields(rawFields.filter(f => f !== null).map(f => ({ ...f, id: f.id || `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` })));
      setAccessType(editingForm.accessType || "Public");
      setFormDescription(editingForm.formDescription || "");
      setIsHidden(!!editingForm.isHidden);
    } else {
      setFormId(""); setFormName(""); setCategory(""); setBbcodeTemplate(""); setTitleGeneratorCode(""); setFields([]); setAccessType("Public"); setFormDescription(""); setIsHidden(false);
    }
  }, [editingForm, isDuplicate, show]);

  const handleSaveField = () => {
    if (!newField.label && !['hr', 'fake_line', 'decedent_list'].includes(newField.type)) {
        showNotification("Label is required!", "warning");
        return;
    }
    
    let fieldToSave = { ...newField, id: newField.id || `field-${Date.now()}` };

    if (fieldToSave.type === "decedent_list") {
        fieldToSave.name = "decedents";
        const defaultDecedentSchema = [
            { name: "decedentName", label: "Decedent Name", type: "text", placeholder: "Full Name", layout: "compact-50" },
            { name: "decedentOOC", label: "Decedent OOC", type: "text", placeholder: "OOC Name", layout: "compact-50" },
            { name: "synopsis", label: "Injuries / Notes", type: "textarea", rows: 4, placeholder: "Brief synopsis..." },
            { name: "scenePhotos", label: "Scene Photos", type: "image", maxImages: 3 }
        ];
        fieldToSave.decedentItemSchemaJson = JSON.stringify(defaultDecedentSchema, null, 2);
    } else if (fieldToSave.type === "image") {
        // No narrative field is created automatically for image fields
    }

    if (editingFieldIndex !== null) {
        const updated = [...fields];
        updated[editingFieldIndex] = fieldToSave;
        setFields(updated);
        setEditingFieldIndex(null);
    } else {
        setFields([...fields, fieldToSave]);
    }
    setNewField(createDefaultNewField());
    setShowConditionalBuilder(false);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.findIndex(f => f.id === active.id);
        const newIndex = items.findIndex(f => f.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const addCondition = () => {
    if (!conditionalField) return;
    let value = conditionalValue === "filled" ? true : conditionalValue === "empty" ? false : exactValue;
    setTempConditions([...tempConditions, { field: conditionalField, value }]);
    setConditionalField(""); setConditionalValue(""); setExactValue("");
  };

  const applyAdvancedCondition = () => {
    if (tempConditions.length === 0) return;
    const showIf = tempConditions.length === 1
      ? { field: tempConditions[0].field, value: tempConditions[0].value }
      : { mode: conditionMode, conditions: tempConditions };
    setNewField({ ...newField, showIf });
    setTempConditions([]); setShowConditionalBuilder(false);
  };

  const confirmDeleteField = useCallback((field) => {
    setFieldToDelete(field);
    setShowDeleteConfirmModal(true);
  }, []);

  const handleDeleteField = useCallback(() => {
    if (fieldToDelete) {
      setFields(fields.filter(field => field.id !== fieldToDelete.id));
      showNotification(`Field "${fieldToDelete.label || fieldToDelete.type}" deleted.`, "info");
      setFieldToDelete(null);
      setShowDeleteConfirmModal(false);
    }
  }, [fieldToDelete, fields, showNotification]);

  const saveForm = async () => {
    if (!formId || !formName) return showNotification("ID and Name required!", "warning");
    setSaving(true);
    try {
      const finalFormId = formId.replace(/\s/g, "_").toLowerCase();
      const formData = {
        id: finalFormId, name: formName, category, template: bbcodeTemplate, bbcodeTemplate,
        titleGeneratorCode, fields, accessType, formDescription, isHidden, updatedAt: Date.now()
      };
      await update(ref(database, `forms/${finalFormId}`), formData);
      
      const metadataRef = ref(database, 'appMetadata/formsDataVersion');
      await runTransaction(metadataRef, (v) => (v || 0) + 1);

      const { userAgent, timeZone } = getUserContext();
      logAdminAction(gtawUser?.username, editingForm ? 'Edited Form' : 'Created Form', `Form: ${formName}`, 'Form Management', userAgent, timeZone, gtawUser?.username, gtawUser);
      
      refreshSegments(['forms']);
      showNotification("Form saved successfully!", "success");
      onHide();
    } catch (err) { showNotification("Error saving form: " + err.message, "error"); }
    finally { setSaving(false); }
  };

  return (
    <BaseModal
      isOpen={show}
      onClose={onHide}
      title={editingForm ? (isDuplicate ? "Duplicate Form" : "Edit Form") : "Create New Form"}
      modalSize="xl"
      variant="info"
      footer={
        <>
          <Button variant="outline-secondary" onClick={onHide}>Cancel</Button>
          <Button variant="primary" onClick={saveForm} disabled={saving} style={{ marginLeft: '10px' }}>
            {saving ? <><i className="fas fa-spinner fa-spin me-2"></i>Saving...</> : <><i className="fas fa-save me-2"></i>Save Form</>}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', padding: '10px' }}>
        
        {/* Section: General Settings */}
        <div style={cardStyle}>
            <h5 style={sectionHeaderStyle}><i className="fas fa-cog"></i>General Settings</h5>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <Form.Group className="mb-3">
                    <Form.Label className="small text-light">Form ID (slug)</Form.Label>
                    <Form.Control placeholder="e.g. general_consultation" value={formId} onChange={e => setFormId(e.target.value)} disabled={!!editingForm && !isDuplicate} style={inputStyle} />
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label className="small text-light">Display Name</Form.Label>
                    <Form.Control placeholder="e.g. General Consultation" value={formName} onChange={e => setFormName(e.target.value)} style={inputStyle} />
                </Form.Group>
            </div>

            <Row>
                <Col md={6}>
                    <Form.Group className="mb-3">
                        <Form.Label className="small text-light">Category</Form.Label>
                        <Form.Control placeholder="PHMC" value={category} onChange={e => setCategory(e.target.value)} style={inputStyle} />
                    </Form.Group>
                </Col>
                <Col md={6}>
                    <Form.Group className="mb-3">
                        <Form.Label className="small text-light">Access Level</Form.Label>
                        <Form.Select value={accessType} onChange={e => setAccessType(e.target.value)} style={inputStyle}>
                            <option value="Public">Public</option>
                            <option value="PHMC">PHMC Staff</option>
                            <option value="Coroner">Coroner</option>
                            <option value="Mental Health">Mental Health</option>
                        </Form.Select>
                    </Form.Group>
                </Col>
            </Row>

            <Form.Check type="checkbox" label="Hide Form (Dev Mode Only)" checked={isHidden} onChange={e => setIsHidden(e.target.checked)} className="text-light small mb-2" />
        </div>
          
        {/* Section: Templates */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            <div style={{ ...cardStyle, marginBottom: 0 }}>
                <h5 style={sectionHeaderStyle}><i className="fas fa-code"></i>BBCode Template</h5>
                <Form.Control as="textarea" rows={6} value={bbcodeTemplate} onChange={e => setBbcodeTemplate(e.target.value)} style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.85rem', marginBottom: 0 }} placeholder="[b]Name:[/b] {{name}}..." />
            </div>
            
            <div style={{ ...cardStyle, marginBottom: 0 }}>
                <h5 style={sectionHeaderStyle}><i className="fas fa-terminal"></i>Title Generator (JS)</h5>
                <Form.Control as="textarea" rows={6} value={titleGeneratorCode} onChange={e => setTitleGeneratorCode(e.target.value)} style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.85rem', marginBottom: 0 }} placeholder="return `Report - ${values.name}`;" />
            </div>
        </div>

        {/* Section: Field Management */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          
          {/* New/Edit Field Card */}
          <div style={{ ...cardStyle, border: '1px solid #60a5fa44' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h5 style={{ ...sectionHeaderStyle, borderBottom: 'none', marginBottom: 0 }}>
                    <i className="fas fa-plus-circle"></i> {editingFieldIndex !== null ? "Edit Field" : "Add New Field"}
                </h5>
                <Button variant="outline-info" size="sm" onClick={() => setShowBulkAddModal(true)}>
                    <i className="fas fa-list-ol me-1"></i> Bulk Add
                </Button>
            </div>

            <div className="d-flex flex-column gap-3">
                {/* Quick Add Helper */}
                <Form.Group>
                    <Form.Label className="small text-info mb-1"><i className="fas fa-bolt me-1"></i>Quick-Add (Shorthand)</Form.Label>
                    <Form.Control 
                        placeholder="Label type{{name}}layout (e.g. Probable Cause input{{pc}}compact-50)" 
                        onChange={e => {
                            const val = e.target.value;
                            if (val.includes('{{') && val.includes('}}')) {
                                const match = val.match(/^(.*?)\s*([a-z_]+)?\s*\{\{([a-zA-Z0-9_]+)\}\}\s*([a-z0-9-]+)?$/);
                                if (match) {
                                    const [, label, type, name, layout] = match;
                                    setNewField(prev => ({
                                        ...prev,
                                        label: label.trim(),
                                        type: type || prev.type,
                                        name: name,
                                        layout: layout || prev.layout
                                    }));
                                }
                            }
                        }} 
                        style={{ ...inputStyle, border: '1px dashed #60a5fa88' }} 
                    />
                </Form.Group>

                <div className="d-flex gap-3">
                    <Form.Group className="flex-grow-1">
                        <Form.Label className="small text-light mb-1">Field Type</Form.Label>
                        <Form.Select value={newField.type} onChange={e => setNewField({ ...createDefaultNewField(), type: e.target.value })} style={inputStyle}>
                            <option value="input">Text Input</option>
                            <option value="textarea">Textarea</option>
                            <option value="section">Section Header</option>
                            <option value="small_header">Small Header</option>
                            <option value="select">Dropdown</option>
                            <option value="multi_select">Multi-Select Dropdown</option>
                            <option value="checkbox">Checkbox</option>
                            <option value="radio">Radio Buttons</option>
                            <option value="employee_select">Employee Select</option>
                            <option value="multi_employee_select">Multi Employee Select</option>
                            <option value="image">Image Gallery</option>
                            <option value="timer">Timer/DateTime</option>
                            <option value="dynamic_text_list">Dynamic Text List</option>
                            <option value="information_state">Information State</option>
                            <option value="decedent_list">Decedent List</option>
                            <option value="autopsy_diagram_button">Autopsy Diagram</option>
                            <option value="payment_button">Payment Button</option>
                            <option value="character_selector">Character Selector</option>
                            <option value="medicine_block">Medicine Block</option>
                            <option value="hr">Separator Line</option>
                            <option value="fake_line">Dashed Line</option>
                        </Form.Select>
                    </Form.Group>

                    <Form.Group style={{ width: '180px' }}>
                        <Form.Label className="small text-light mb-1">Width Layout</Form.Label>
                        <Form.Select value={newField.layout} onChange={e => setNewField({...newField, layout: e.target.value})} style={inputStyle}>
                            <option value="full">100% (Full)</option>
                            <option value="compact-50">50% (Half)</option>
                            <option value="compact-33">33% (Third)</option>
                        </Form.Select>
                    </Form.Group>
                </div>

                <div className="d-flex gap-3">
                    <Form.Group className="flex-grow-1">
                        <Form.Label className="small text-light mb-1">Field Label</Form.Label>
                        <Form.Control 
                            placeholder="Display Label" 
                            value={newField.label} 
                            onChange={e => setNewField({ ...newField, label: e.target.value })} 
                            style={inputStyle} 
                        />
                    </Form.Group>

                    <Form.Group className="flex-grow-1">
                        <Form.Label className="small text-light mb-1">Internal Name (slug)</Form.Label>
                        <Form.Control 
                            placeholder="template_variable" 
                            value={newField.name} 
                            onChange={e => setNewField({ ...newField, name: e.target.value })} 
                            style={inputStyle} 
                        />
                    </Form.Group>
                </div>

                <Form.Group>
                    <Form.Label className="small text-light mb-1">Placeholder / Content</Form.Label>
                    <Form.Control placeholder="Display text..." value={newField.placeholder || newField.content} onChange={e => setNewField({...newField, placeholder: e.target.value, content: e.target.value})} style={inputStyle} />
                </Form.Group>

                {/* Specific Config */}
                <div className="d-flex gap-3">
                    {newField.type === 'select' && (
                        <Form.Group className="flex-grow-1">
                            <Form.Label className="small text-light mb-1">Options Key</Form.Label>
                            <Form.Control placeholder="e.g. hospitals" value={newField.optionsKey} onChange={e => setNewField({...newField, optionsKey: e.target.value})} style={inputStyle} />
                        </Form.Group>
                    )}
                    
                    {newField.type === 'textarea' && (
                        <Form.Group className="flex-grow-1">
                            <Form.Label className="small text-light mb-1">Rows</Form.Label>
                            <Form.Control type="number" value={newField.rows} onChange={e => setNewField({...newField, rows: parseInt(e.target.value)})} style={inputStyle} />
                        </Form.Group>
                    )}

                    {newField.type === 'dynamic_text_list' && (
                        <Form.Group className="flex-grow-1">
                            <Form.Label className="small text-light mb-1">List Type</Form.Label>
                            <Form.Select value={newField.listType || ""} onChange={e => setNewField({...newField, listType: e.target.value})} style={inputStyle}>
                                <option value="">Standard List</option>
                                <option value="1">Numbered (1, 2, 3...)</option>
                                <option value="a">Lettered (a, b, c...)</option>
                                <option value="A">Lettered (A, B, C...)</option>
                                <option value="i">Roman (i, ii, iii...)</option>
                                <option value="I">Roman (I, II, III...)</option>
                                <option value="none">Plain Text (No List Tags)</option>
                            </Form.Select>
                        </Form.Group>
                    )}

                    {newField.type === 'timer' && (
                        <>
                            <Form.Group className="flex-grow-1">
                                <Form.Label className="small text-light mb-1">Timer Type</Form.Label>
                                <Form.Select value={newField.timerType || ""} onChange={e => setNewField({...newField, timerType: e.target.value})} style={inputStyle}>
                                    <option value="">Select Timer Type</option>
                                    <option value="datetime-local">DateTime (Date + Time)</option>
                                    <option value="date">Date Only</option>
                                    <option value="time">Time Only</option>
                                </Form.Select>
                            </Form.Group>

                            <Form.Group className="flex-grow-1">
                                <Form.Label className="small text-light mb-1">Button Label</Form.Label>
                                <Form.Control placeholder="e.g. Capture Time" value={newField.buttonLabel || ""} onChange={e => setNewField({...newField, buttonLabel: e.target.value})} style={inputStyle} />
                            </Form.Group>

                            <Form.Group className="flex-grow-1">
                                <Form.Label className="small text-light mb-1">Button Action</Form.Label>
                                <Form.Select value={newField.buttonAction || ""} onChange={e => setNewField({...newField, buttonAction: e.target.value})} style={inputStyle}>
                                    <option value="">Select Action</option>
                                    <option value="capture">Capture Time</option>
                                </Form.Select>
                            </Form.Group>

                            <Form.Group>
                                <Form.Check type="checkbox" label="Display Current Time" checked={newField.displayCurrentTime || false} onChange={e => setNewField({...newField, displayCurrentTime: e.target.checked})} className="text-light small" />
                            </Form.Group>
                        </>
                    )}

                    {newField.type === 'section' && (
                        <Form.Group className="flex-grow-1">
                            <Form.Label className="small text-light mb-1">Icon</Form.Label>
                            <Form.Select value={newField.icon} onChange={e => setNewField({...newField, icon: e.target.value})} style={inputStyle}>
                                <option value="">No Icon</option>
                                {frequentlyUsedIcons.map(icon => <option key={icon.class} value={icon.class}>{icon.label}</option>)}
                            </Form.Select>
                        </Form.Group>
                    )}

                    {newField.type === 'small_header' && (
                        <Form.Group className="flex-grow-1">
                            <Form.Label className="small text-light mb-1">Icon</Form.Label>
                            <Form.Select value={newField.icon} onChange={e => setNewField({...newField, icon: e.target.value})} style={inputStyle}>
                                <option value="">No Icon</option>
                                {frequentlyUsedIcons.map(icon => <option key={icon.class} value={icon.class}>{icon.label}</option>)}
                            </Form.Select>
                        </Form.Group>
                    )}

                    {newField.type === 'information_state' && (
                        <>
                            <Form.Group className="flex-grow-1">
                                <Form.Label className="small text-light mb-1">Info Type</Form.Label>
                                <Form.Select value={newField.infoType || "Information"} onChange={e => setNewField({...newField, infoType: e.target.value})} style={inputStyle}>
                                    <option value="Information">Information (Blue)</option>
                                    <option value="Warning">Warning (Orange)</option>
                                    <option value="Danger">Danger (Red)</option>
                                </Form.Select>
                            </Form.Group>

                            <Form.Group className="flex-grow-1">
                                <Form.Label className="small text-light mb-1">Content / Message</Form.Label>
                                <Form.Control 
                                    as="textarea" 
                                    rows={3}
                                    placeholder="Enter the information message..." 
                                    value={newField.content || ""} 
                                    onChange={e => setNewField({...newField, content: e.target.value})} 
                                    style={inputStyle} 
                                />
                            </Form.Group>
                        </>
                    )}

                    {newField.type === 'multi_select' && (
                        <Form.Group className="flex-grow-1">
                            <Form.Label className="small text-light mb-1">Options Key</Form.Label>
                            <Form.Control placeholder="e.g. hospitals, agencies" value={newField.optionsKey} onChange={e => setNewField({...newField, optionsKey: e.target.value})} style={inputStyle} />
                        </Form.Group>
                    )}

                    {newField.type === 'select' && (
                        <Form.Group className="flex-grow-1">
                            <Form.Label className="small text-light mb-1">Options Key</Form.Label>
                            <Form.Control placeholder="e.g. hospitals" value={newField.optionsKey} onChange={e => setNewField({...newField, optionsKey: e.target.value})} style={inputStyle} />
                        </Form.Group>
                    )}

                    {newField.type === 'image' && (
                        <Form.Group className="flex-grow-1">
                            <Form.Label className="small text-light mb-1">Max Images</Form.Label>
                            <Form.Control type="number" min="1" value={newField.maxImages || 6} onChange={e => setNewField({...newField, maxImages: parseInt(e.target.value)})} style={inputStyle} />
                        </Form.Group>
                    )}

                    {newField.type === 'radio' && (
                        <Form.Group className="flex-grow-1">
                            <Form.Label className="small text-light mb-1">Options (comma-separated)</Form.Label>
                            <Form.Control placeholder="Option 1, Option 2, Option 3" value={(newField.options || []).join(', ')} onChange={e => setNewField({...newField, options: e.target.value.split(',').map(o => o.trim()).filter(Boolean)})} style={inputStyle} />
                        </Form.Group>
                    )}
                </div>
            </div>

            {/* Advanced Logic Toggle */}
            <div className="d-flex justify-content-between align-items-center mt-3 mb-3">
                <Button variant="link" size="sm" className="p-0 text-info text-decoration-none" onClick={() => setShowConditionalBuilder(!showConditionalBuilder)}>
                    <i className={`fas ${showConditionalBuilder ? 'fa-minus-square' : 'fa-plus-square'} me-1`}></i>
                    {showConditionalBuilder ? "Hide Conditional Logic" : "Add Conditional Logic"}
                </Button>
                {newField.showIf && <Badge bg="info" className="px-2 py-1">Logic Active</Badge>}
            </div>

            {showConditionalBuilder && (
                <div style={{ background: '#0d1117', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px dashed #30363d' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', marginBottom: '10px' }}>
                        <Form.Select value={conditionalField} onChange={e => setConditionalField(e.target.value)} style={{...inputStyle, marginBottom: 0}}>
                            <option value="">Select Trigger...</option>
                            {fields.filter(f => f.name).map(f => <option key={f.id} value={f.name}>{f.label || f.name}</option>)}
                        </Form.Select>
                        <Form.Select value={conditionalValue} onChange={e => setConditionalValue(e.target.value)} style={{...inputStyle, marginBottom: 0}}>
                            <option value="filled">Is Filled</option>
                            <option value="empty">Is Empty</option>
                            <option value="exact">Equals...</option>
                        </Form.Select>
                        <Button variant="success" size="sm" onClick={addCondition}>Add</Button>
                    </div>
                    {conditionalValue === 'exact' && <Form.Control placeholder="Exact Value" value={exactValue} onChange={e => setExactValue(e.target.value)} style={{...inputStyle, marginBottom: '10px'}} />}
                    
                    {tempConditions.length > 0 && (
                        <div className="mb-2 p-2 bg-dark rounded">
                            {tempConditions.map((c, idx) => (
                                <Badge key={idx} bg="secondary" className="me-1 mb-1">
                                    {c.field} = {String(c.value)}
                                </Badge>
                            ))}
                        </div>
                    )}

                    <Button variant="primary" size="sm" className="w-100" onClick={applyAdvancedCondition} disabled={tempConditions.length === 0}>
                        Apply Conditions ({tempConditions.length})
                    </Button>
                </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
                <Button variant="success" className="w-100" onClick={handleSaveField}>
                    {editingFieldIndex !== null ? <><i className="fas fa-check me-1"></i>Update Field</> : <><i className="fas fa-plus me-1"></i>Add Field</>}
                </Button>
                {editingFieldIndex !== null && (
                    <Button variant="outline-secondary" onClick={() => { setEditingFieldIndex(null); setNewField(createDefaultNewField()); }}>
                        Cancel
                    </Button>
                )}
            </div>
          </div>

          {/* Draggable List Header */}
          <div className="d-flex justify-content-between align-items-end mb-2 px-1">
            <h6 className="text-info small mb-0 uppercase tracking-wider font-weight-bold">Field Hierarchy</h6>
            <span className="extra-small text-light">{fields.length} items total</span>
          </div>

          {/* Draggable List */}
          <div style={{ 
              maxHeight: '450px', 
              overflowY: 'auto', 
              padding: '10px', 
              background: '#0d1117', 
              borderRadius: '12px', 
              border: '1px solid #30363d',
              flexGrow: 1
          }}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                {fields.length === 0 ? (
                    <div className="text-center py-5 text-muted small italic">No fields added yet. Use the editor above or Bulk Add.</div>
                ) : (
                    fields.map((f, i) => (
                        <SortableFieldItem key={f.id} id={f.id}>
                            <div style={{ 
                                background: '#161b22', 
                                padding: '12px', 
                                marginBottom: '8px', 
                                borderRadius: '8px', 
                                border: '1px solid #30363d', 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                transition: 'transform 0.2s, background-color 0.2s'
                            }} className="field-list-item">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <i className="fas fa-grip-lines" style={{ color: '#484f58', cursor: 'grab' }}></i>
                                    <div>
                                        <div className="d-flex align-items-center gap-2">
                                            <strong style={{ color: '#e6edf3', fontSize: '0.9rem' }}>{f.label || "(Separator)"}</strong>
                                            {f.icon && <i className={`${f.icon} text-info`} style={{ fontSize: '0.75rem' }}></i>}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: '#8b949e', marginTop: '2px' }}>
                                            <Badge bg="secondary" className="me-1 text-white font-monospace" style={{ fontWeight: 600 }}>{f.type}</Badge>
                                            <code className="text-info opacity-100">{`{{${f.name}}}`}</code>
                                            {f.showIf && <Badge bg="info" className="ms-1" pill>Conditional</Badge>}
                                            <span className="ms-2 opacity-75 text-light">{f.layout}</span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <Button variant="link" size="sm" className="p-1 text-info opacity-75 hover-opacity-100" onClick={() => { setEditingFieldIndex(i); setNewField(f); }}>
                                        <i className="fas fa-edit"></i>
                                    </Button>
                                    <Button variant="link" size="sm" className="p-1 text-danger opacity-75 hover-opacity-100" onClick={() => confirmDeleteField(f)}>
                                        <i className="fas fa-trash"></i>
                                    </Button>
                                </div>
                            </div>
                        </SortableFieldItem>
                    ))
                )}
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </div>

      <BulkAddFieldsModal 
        show={showBulkAddModal} 
        onClose={() => setShowBulkAddModal(false)} 
        onBulkAdd={(newFields) => setFields([...fields, ...newFields])} 
        bbcodeTemplate={bbcodeTemplate} 
      />

      {/* Delete Confirmation Modal */}
      <BaseModal
        isOpen={showDeleteConfirmModal}
        onClose={() => setShowDeleteConfirmModal(false)}
        title="Confirm Field Deletion"
        variant="danger"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteConfirmModal(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleDeleteField} style={{ marginLeft: '10px' }}>Delete</Button>
          </>
        }
      >
        <p className="text-light">Are you sure you want to delete the field: <strong>{fieldToDelete?.label || fieldToDelete?.type}</strong>?</p>
        <p className="text-danger small">This action cannot be undone.</p>
      </BaseModal>

      <style>{`
        .uppercase { text-transform: uppercase; }
        .tracking-wider { letter-spacing: 0.05em; }
        .extra-small { font-size: 0.75rem; }
        .hover-opacity-100:hover { opacity: 1 !important; }
        .field-list-item:hover { 
            background-color: #1c2128 !important;
            border-color: #444c56 !important;
        }
      `}</style>
    </BaseModal>
  );
};

export default AddFormModal;