import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from 'react-dom';
import { database } from "../../firebase";
import { ref, set, get, update, runTransaction } from "firebase/database";
import Select from 'react-select';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import { useData } from '../../contexts/DataContext';
import { logAdminAction, getUserContext } from '../../utils/logging';
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
import { Button, Form, Badge, Row, Col } from 'react-bootstrap';

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
    padding: '24px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
};

const codeStyle = {
    background: '#1c2128',
    color: '#f0c674',
    padding: '1px 5px',
    borderRadius: '3px',
    fontSize: '0.78rem',
    fontFamily: 'monospace',
    whiteSpace: 'nowrap'
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
  const modalRef = useRef(null);

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
  const [activeTab, setActiveTab] = useState('settings');

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

  const [showConditionalBuilder, setShowConditionalBuilder] = useState(false);
  const [conditionalField, setConditionalField] = useState("");
  const [conditionalValue, setConditionalValue] = useState("");
  const [tempConditions, setTempConditions] = useState([]);
  const [conditionMode, setConditionMode] = useState("and");
  const [exactValue, setExactValue] = useState("");

  const templateVars = useMemo(() => {
    const matches = bbcodeTemplate.match(/\{\{([a-zA-Z0-9_]+)\}\}/g);
    if (!matches) return [];
    const seen = new Set();
    return matches.map(m => m.slice(2, -2)).filter(v => { if (seen.has(v)) return false; seen.add(v); return true; });
  }, [bbcodeTemplate]);

  const allVariables = useMemo(() => {
    const fieldMap = new Map(fields.filter(f => f.name).map(f => [f.name, f]));
    const seen = new Set();
    const result = [];
    templateVars.forEach(name => {
      if (seen.has(name)) return;
      seen.add(name);
      const field = fieldMap.get(name);
      result.push({ name, label: field ? (field.label || field.type) : '(from template)', fromTemplateOnly: !field });
    });
    fields.forEach(f => {
      if (!f.name || seen.has(f.name)) return;
      seen.add(f.name);
      result.push({ name: f.name, label: f.label || f.type, fromTemplateOnly: false });
    });
    return result;
  }, [fields, templateVars]);

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

  useEffect(() => {
    if (!show) return;
    document.body.style.overflow = 'hidden';
    const handleEscape = (e) => { if (e.key === 'Escape') onHide(); };
    window.addEventListener('keydown', handleEscape);
    setTimeout(() => modalRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [show, onHide]);

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
      console.log('[saveForm] 1. Writing form to Firebase...', { path: `forms/${finalFormId}` });
      await update(ref(database, `forms/${finalFormId}`), formData);
      console.log('[saveForm] 2. Form written. Bumping formsDataVersion...');

      const metadataRef = ref(database, 'appMetadata/formsDataVersion');
      const newVersion = await runTransaction(metadataRef, (v) => (v || 0) + 1);
      console.log('[saveForm] 3. Version bumped to:', newVersion);

      const { userAgent, timeZone } = getUserContext();
      logAdminAction(gtawUser?.username, editingForm ? 'Edited Form' : 'Created Form', `Form: ${formName}`, 'Form Management', userAgent, timeZone, gtawUser?.username, gtawUser);

      console.log('[saveForm] 4. Calling refreshSegments([\'forms\'])...');
      await refreshSegments(['forms']);
      console.log('[saveForm] 5. refreshSegments completed.');

      showNotification("Form saved successfully!", "success");
      onHide();
    } catch (err) {
      console.error('[saveForm] ERROR:', err);
      showNotification("Error saving form: " + err.message, "error");
    }
    finally { setSaving(false); }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotification(`Copied ${text} to clipboard`, 'info');
    } catch {
      showNotification('Failed to copy', 'error');
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onHide();
  };

  const modalContent = (
    <div className="aform-overlay" onClick={handleOverlayClick}>
      <div className="aform-container" ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true">
        <div className="aform-header">
          <h2 className="aform-title">
            {editingForm ? (isDuplicate ? "Duplicate Form" : "Edit Form") : "Create New Form"}
          </h2>
          <button className="aform-close" onClick={onHide} aria-label="Close">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="aform-tabs">
          <button className={`aform-tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <i className="fas fa-cog"></i> Settings
          </button>
          <button className={`aform-tab ${activeTab === 'template' ? 'active' : ''}`} onClick={() => setActiveTab('template')}>
            <i className="fas fa-code"></i> Template
          </button>
          <button className={`aform-tab ${activeTab === 'title' ? 'active' : ''}`} onClick={() => setActiveTab('title')}>
            <i className="fas fa-terminal"></i> Title
          </button>
          <button className={`aform-tab ${activeTab === 'fields' ? 'active' : ''}`} onClick={() => setActiveTab('fields')}>
            <i className="fas fa-list"></i> Fields ({fields.length})
          </button>
        </div>

        <div className="aform-body">
          <div className="aform-inner">
            {activeTab === 'settings' && (
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
                <Form.Control as="textarea" rows={3} placeholder="Form description (optional)" value={formDescription} onChange={e => setFormDescription(e.target.value)} style={inputStyle} />
                <Form.Check type="checkbox" label="Hide Form (Dev Mode Only)" checked={isHidden} onChange={e => setIsHidden(e.target.checked)} className="text-light small mb-2" />
              </div>
            )}

            {activeTab === 'template' && (
              <div style={cardStyle}>
                  <h5 style={sectionHeaderStyle}><i className="fas fa-code"></i>BBCode Template</h5>
                  <Form.Control as="textarea" rows={18} value={bbcodeTemplate} onChange={e => setBbcodeTemplate(e.target.value)} style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.85rem' }} placeholder="[b]Name:[/b] {{name}}..." />
                  <details style={{ marginTop: '10px', cursor: 'pointer' }}>
                      <summary style={{ color: '#8b949e', fontSize: '0.8rem', userSelect: 'none' }}>
                          <i className="fas fa-info-circle me-1" style={{ color: '#58a6ff' }}></i>
                          BBCode Template Guide
                      </summary>
                      <div style={{ marginTop: '10px', padding: '12px', background: '#0d1117', borderRadius: '8px', border: '1px solid #30363d', fontSize: '0.8rem', lineHeight: '1.6', color: '#c9d1d9' }}>
                          <div style={{ marginBottom: '10px' }}><strong style={{ color: '#58a6ff' }}>Field Placeholders</strong> — Insert field values using curly braces:</div>
                          <code style={codeStyle}>{`{{name}}`}</code> — renders the value of a field with internal name <code style={codeStyle}>name</code><br />
                          <code style={codeStyle}>{`{{employeeName}}`}</code> — any field&apos;s value by its slug<br />
                          <div style={{ marginTop: '10px', marginBottom: '6px' }}><strong style={{ color: '#58a6ff' }}>Checkbox BBCode</strong>:</div>
                          <code style={codeStyle}>{`[cb:fieldName]Option Text[/cb]`}</code><br />
                          <div style={{ marginTop: '10px', marginBottom: '6px' }}><strong style={{ color: '#58a6ff' }}>Conditional Blocks</strong>:</div>
                          <code style={codeStyle}>{`[conditional field="fieldName" value="Yes"]Content[/conditional]`}</code>
                          <div style={{ marginTop: '10px', marginBottom: '6px' }}><strong style={{ color: '#58a6ff' }}>JavaScript Expressions</strong>:</div>
                          <code style={codeStyle}>{`{{values.name.toUpperCase()}}`}</code><br />
                          <code style={codeStyle}>{`{{new Date().toLocaleDateString()}}`}</code>
                          <div style={{ marginTop: '10px', marginBottom: '6px' }}><strong style={{ color: '#58a6ff' }}>Standard BBCode</strong>:</div>
                          <code style={codeStyle}>[b]bold[/b] [i]italic[/i] [u]underline[/u] [img]url[/img] [url]link[/url] [list][*]item[/list]</code>
                      </div>
                  </details>
              </div>
            )}

            {activeTab === 'title' && (
              <div style={cardStyle}>
                  <h5 style={sectionHeaderStyle}><i className="fas fa-terminal"></i>Title Generator (JS)</h5>
                  <Form.Control as="textarea" rows={12} value={titleGeneratorCode} onChange={e => setTitleGeneratorCode(e.target.value)} style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.85rem', marginBottom: 0 }} placeholder="return `Report - ${values.name}`;" />
              </div>
            )}

            {activeTab === 'fields' && (
              <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                              <Form.Control placeholder="Display Label" value={newField.label} onChange={e => setNewField({ ...newField, label: e.target.value })} style={inputStyle} />
                          </Form.Group>
                          <Form.Group className="flex-grow-1">
                              <Form.Label className="small text-light mb-1">Internal Name (slug)</Form.Label>
                              <Form.Control placeholder="template_variable" value={newField.name} onChange={e => setNewField({ ...newField, name: e.target.value })} style={inputStyle} />
                          </Form.Group>
                      </div>

                      <Form.Group>
                          <Form.Label className="small text-light mb-1">Placeholder / Content</Form.Label>
                          <Form.Control placeholder="Display text..." value={newField.placeholder || newField.content} onChange={e => setNewField({...newField, placeholder: e.target.value, content: e.target.value})} style={inputStyle} />
                      </Form.Group>

                      <div className="d-flex gap-3 flex-wrap">
                          {newField.type === 'textarea' && (
                              <Form.Group className="flex-grow-1">
                                  <Form.Label className="small text-light mb-1">Rows</Form.Label>
                                  <Form.Control type="number" value={newField.rows} onChange={e => setNewField({...newField, rows: parseInt(e.target.value)})} style={inputStyle} />
                              </Form.Group>
                          )}
                          {newField.type === 'image' && (
                              <Form.Group className="flex-grow-1">
                                  <Form.Label className="small text-light mb-1">Max Images</Form.Label>
                                  <Form.Control type="number" min="1" value={newField.maxImages || 6} onChange={e => setNewField({...newField, maxImages: parseInt(e.target.value)})} style={inputStyle} />
                              </Form.Group>
                          )}
                          {['select', 'multi_select'].includes(newField.type) && (
                              <Form.Group className="flex-grow-1">
                                  <Form.Label className="small text-light mb-1">Options Key</Form.Label>
                                  <Form.Control placeholder="e.g. hospitals" value={newField.optionsKey} onChange={e => setNewField({...newField, optionsKey: e.target.value})} style={inputStyle} />
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
                          {['section', 'small_header'].includes(newField.type) && (
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
                                      <Form.Label className="small text-light mb-1">Content</Form.Label>
                                      <Form.Control as="textarea" rows={3} placeholder="Enter message..." value={newField.content || ""} onChange={e => setNewField({...newField, content: e.target.value})} style={inputStyle} />
                                  </Form.Group>
                              </>
                          )}
                          {newField.type === 'radio' && (
                              <Form.Group className="flex-grow-1">
                                  <Form.Label className="small text-light mb-1">Options (comma-separated)</Form.Label>
                                  <Form.Control placeholder="Option 1, Option 2" value={(newField.options || []).join(', ')} onChange={e => setNewField({...newField, options: e.target.value.split(',').map(o => o.trim()).filter(Boolean)})} style={inputStyle} />
                              </Form.Group>
                          )}
                      </div>
                  </div>

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
                                      <Badge key={idx} bg="secondary" className="me-1 mb-1">{c.field} = {String(c.value)}</Badge>
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

                <div className="d-flex justify-content-between align-items-end mb-2 px-1">
                  <h6 className="text-info small mb-0 uppercase tracking-wider font-weight-bold">Field Hierarchy</h6>
                  <span className="extra-small text-light">{fields.length} items total</span>
                </div>

                <div style={{ maxHeight: '450px', overflowY: 'auto', padding: '10px', background: '#0d1117', borderRadius: '12px', border: '1px solid #30363d', flexGrow: 1 }}>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                      {fields.length === 0 ? (
                          <div className="text-center py-5 text-muted small italic">No fields added yet. Use the editor above or Bulk Add.</div>
                      ) : (
                          fields.map((f, i) => (
                              <SortableFieldItem key={f.id} id={f.id}>
                                  <div style={{ background: '#161b22', padding: '12px', marginBottom: '8px', borderRadius: '8px', border: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="field-list-item">
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

                <div className="aform-variables-panel">
                  <h6 className="aform-variables-title"><i className="fas fa-code-branch me-1"></i>Available Variables</h6>
                  {allVariables.length === 0 ? (
                    <div className="aform-variables-empty">No variables yet — add fields or type <code style={codeStyle}>{'{{name}}'}</code> in the BBCode template.</div>
                  ) : (
                    <div className="aform-variables-list">
                      {allVariables.map(v => (
                        <div key={v.name} className={`aform-variable-item${v.fromTemplateOnly ? ' aform-variable-item--orphan' : ''}`} onClick={() => copyToClipboard('{{' + v.name + '}}')} title={'Click to copy {{' + v.name + '}}'}>
                          <code className="aform-variable-code">{'{{' + v.name + '}}'}</code>
                          <span className="aform-variable-label">{v.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="aform-variables-hint">
                    Click a variable to copy it to clipboard.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="aform-footer">
          <Button variant="outline-secondary" onClick={onHide}>Cancel</Button>
          <Button variant="primary" onClick={saveForm} disabled={saving}>
            {saving ? <><i className="fas fa-spinner fa-spin me-2"></i>Saving...</> : <><i className="fas fa-save me-2"></i>Save Form</>}
          </Button>
        </div>
      </div>

      <BulkAddFieldsModal
        show={showBulkAddModal}
        onClose={() => setShowBulkAddModal(false)}
        onBulkAdd={(newFields) => setFields([...fields, ...newFields])}
        bbcodeTemplate={bbcodeTemplate}
      />

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
        .aform-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(6px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 2000;
          padding: 1.5rem;
        }

        .aform-container {
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
          width: 100%;
          max-width: 1400px;
          height: 95vh;
          max-height: 95vh;
          display: flex;
          flex-direction: column;
          animation: aformIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }

        @keyframes aformIn {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .aform-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem 2rem;
          border-bottom: 1px solid #30363d;
          flex-shrink: 0;
          background: #0d1117;
        }

        .aform-title {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 800;
          color: #e6edf3;
          letter-spacing: -0.02em;
        }

        .aform-close {
          width: 40px;
          height: 40px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid #30363d;
          border-radius: 10px;
          color: #7d8590;
          font-size: 1.1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .aform-close:hover {
          color: #e6edf3;
          background: rgba(255, 255, 255, 0.08);
          border-color: #7d8590;
        }

        .aform-tabs {
          display: flex;
          gap: 0;
          border-bottom: 1px solid #30363d;
          padding: 0 2rem;
          background: #161b22;
          flex-shrink: 0;
        }

        .aform-tab {
          padding: 0.85rem 1.5rem;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: #7d8590;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
          margin-bottom: -1px;
        }

        .aform-tab:hover {
          color: #e6edf3;
          background: rgba(255,255,255,0.03);
        }

        .aform-tab.active {
          color: #58a6ff;
          border-bottom-color: #58a6ff;
        }

        .aform-tab i {
          font-size: 0.85rem;
        }

        .aform-body {
          flex: 1;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #30363d transparent;
        }

        .aform-body::-webkit-scrollbar { width: 8px; }
        .aform-body::-webkit-scrollbar-track { background: transparent; }
        .aform-body::-webkit-scrollbar-thumb { background: #30363d; border-radius: 4px; }
        .aform-body::-webkit-scrollbar-thumb:hover { background: #484f58; }

        .aform-inner {
          padding: 2rem 2.5rem;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .aform-footer {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 1rem;
          padding: 1.25rem 2rem;
          border-top: 1px solid #30363d;
          background: #161b22;
          flex-shrink: 0;
        }

        .uppercase { text-transform: uppercase; }
        .tracking-wider { letter-spacing: 0.05em; }
        .extra-small { font-size: 0.75rem; }
        .hover-opacity-100:hover { opacity: 1 !important; }
        .field-list-item:hover {
            background-color: #1c2128 !important;
            border-color: #444c56 !important;
        }

        .aform-variables-panel {
          width: 280px;
          flex-shrink: 0;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 12px;
          padding: 20px;
          position: sticky;
          top: 0;
        }

        .aform-variables-title {
          color: #58a6ff;
          font-size: 0.85rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 16px;
          padding-bottom: 10px;
          border-bottom: 1px solid #30363d;
        }

        .aform-variables-empty {
          color: #484f58;
          font-size: 0.8rem;
          text-align: center;
          padding: 24px 0;
        }

        .aform-variables-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-height: 500px;
          overflow-y: auto;
        }

        .aform-variable-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s;
        }

        .aform-variable-item:hover {
          background: #1c2128;
        }

        .aform-variable-item--orphan .aform-variable-code {
          color: #8b949e;
        }

        .aform-variable-item--orphan .aform-variable-label {
          color: #484f58;
          font-style: italic;
        }

        .aform-variable-code {
          font-size: 0.78rem;
          color: #f0c674;
          background: #0d1117;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: monospace;
          white-space: nowrap;
        }

        .aform-variable-label {
          font-size: 0.78rem;
          color: #8b949e;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .aform-variables-hint {
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px solid #30363d;
          font-size: 0.7rem;
          color: #484f58;
          text-align: center;
        }
      `}</style>
    </div>
  );

  if (!show) return null;
  return createPortal(modalContent, document.getElementById('modal-root') || document.body);
};

export default AddFormModal;
