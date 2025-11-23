// src/components/admin/AddFormModal.jsx
import React, { useState, useEffect } from "react";
import { database } from "../../firebase";
import { ref, update } from "firebase/database";

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

const AddFormModal = ({ show, onClose, editingForm = null }) => {
  const [formId, setFormId] = useState("");
  const [formName, setFormName] = useState("");
  const [category, setCategory] = useState("");
  const [bbcodeTemplate, setBbcodeTemplate] = useState("");
  const [titleGeneratorCode, setTitleGeneratorCode] = useState(""); // New state
  const [fields, setFields] = useState([]);
  const [accessType, setAccessType] = useState("Public"); // New state for form access control (e.g., "Public", "PHMC", "Coroner", "Civilian")

  const createDefaultNewField = () => ({
    type: "input",
    label: "",
    name: "",
    placeholder: "",
    layout: "full",
    rows: 4,
    maxImages: 6,
    optionsKey: "",
    timerType: "",
    buttonLabel: "",
    buttonAction: "",
    displayCurrentTime: false,
    id: null, // New: Unique ID for field for editing purposes
    associatedInputField: null,
    options: [],
    inputType: "",
    showIf: null
  });

  const [newField, setNewField] = useState(createDefaultNewField());

  const [editingFieldIndex, setEditingFieldIndex] = useState(null); // New state to track which field is being edited

  const [showConditionalBuilder, setShowConditionalBuilder] = useState(false);
  const [conditionalField, setConditionalField] = useState("");
  const [conditionalValue, setConditionalValue] = useState("");
  const [tempConditions, setTempConditions] = useState([]);
  const [conditionMode, setConditionMode] = useState("and");
  const [exactValue, setExactValue] = useState("");
  useEffect(() => {
    if (editingForm) {
      setFormId(editingForm.id || "");
      setFormName(editingForm.name || "");
      setCategory(editingForm.category || "");
      setBbcodeTemplate(editingForm.template || "");
      setTitleGeneratorCode(editingForm.titleGeneratorCode || ""); // Load existing code
      // Ensure all loaded fields have an 'id' for consistent editing
      const safeFields = (editingForm.fields || []).map(f => ({
        ...f,
        id: f.id || `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` // Assign a unique ID if missing
      }));
      setFields(safeFields);
      setAccessType(editingForm.accessType || "Public"); // Load accessType
      setNewField(createDefaultNewField()); // Reset newField to default for adding new fields
      setEditingFieldIndex(null); // Ensure no field is selected for editing initially
    } else {
      resetForm();
    }
  }, [editingForm]);

  const resetForm = () => {
    setFormId("");
    setFormName("");
    setCategory("");
    setBbcodeTemplate("");
    setTitleGeneratorCode(""); // Reset new state
    setFields([]);
    setAccessType("Public"); // Reset accessType
    setNewField(createDefaultNewField());
    setEditingFieldIndex(null); // Ensure editing mode is off when resetting the form
  };

  const saveField = () => {
    // Assign a temporary ID if adding a new field without one
    const fieldToSave = { ...newField };
    if (editingFieldIndex === null && !fieldToSave.id) {
        fieldToSave.id = `field-${Date.now()}`;
    }

    if (fieldToSave.type === "hr") {
      setFields(prevFields => {
        if (editingFieldIndex !== null) {
          const updatedFields = [...prevFields];
          updatedFields[editingFieldIndex] = { type: "hr", id: fieldToSave.id };
          return updatedFields;
        }
        return [...prevFields, { type: "hr", id: fieldToSave.id }];
      });
    } else if (fieldToSave.type === "fake_line") {
      setFields(prevFields => {
        if (editingFieldIndex !== null) {
          const updatedFields = [...prevFields];
          updatedFields[editingFieldIndex] = { type: "fake_line", id: fieldToSave.id };
          return updatedFields;
        }
        return [...prevFields, { type: "fake_line", id: fieldToSave.id }];
      });
    } else if (fieldToSave.type === "small_header") {
      if (!fieldToSave.label) {
        alert("Header Text is required for Small Header!");
        return;
      }
      const finalName = fieldToSave.name || `header_${fields.length + 1}`;
      setFields(prevFields => {
        if (editingFieldIndex !== null) {
          const updatedFields = [...prevFields];
          updatedFields[editingFieldIndex] = { ...fieldToSave, name: finalName, id: fieldToSave.id };
          return updatedFields;
        }
        return [...prevFields, { ...fieldToSave, name: finalName, id: fieldToSave.id }];
      });
    } else if (fieldToSave.type === "timer") {
        if (!fieldToSave.label || !fieldToSave.name || !fieldToSave.timerType) {
            alert("Label, Name, and Timer Type are required for Timer!");
            return;
        }
        if (fieldToSave.buttonLabel && !fieldToSave.buttonAction) {
            alert("If Button Label is provided, Button Action is required for Timer!");
            return;
        }
        setFields(prevFields => {
            if (editingFieldIndex !== null) {
                const updatedFields = [...prevFields];
                updatedFields[editingFieldIndex] = { ...fieldToSave, id: fieldToSave.id };
                return updatedFields;
            }
            return [...prevFields, { ...fieldToSave, id: fieldToSave.id }];
        });
    } else if (fieldToSave.type === "checkbox") {
        if (!fieldToSave.label || !fieldToSave.name) {
            alert("Label and Name are required for Checkbox!");
            return;
        }
        if (fieldToSave.associatedInputField) {
            if (!fieldToSave.associatedInputField.name || !fieldToSave.associatedInputField.type) {
                alert("Associated Input Field Name and Type are required!");
                return;
            }
            if (fieldToSave.associatedInputField.type === "select" && !fieldToSave.associatedInputField.optionsKey) {
                alert("Associated Input Options Key is required for Select type!");
                return;
            }
        }
        
        setFields(prevFields => {
            if (editingFieldIndex !== null) {
                const updatedFields = [...prevFields];
                updatedFields[editingFieldIndex] = { ...fieldToSave, id: fieldToSave.id };
                return updatedFields;
            }
            return [...prevFields, { ...fieldToSave, id: fieldToSave.id }];
        });
    } else if (fieldToSave.type === "radio") {
        if (!fieldToSave.label || !fieldToSave.name || fieldToSave.options.length === 0) {
            alert("Label, Name, and Options are required for Radio Buttons!");
            return;
        }
        setFields(prevFields => {
            if (editingFieldIndex !== null) {
                const updatedFields = [...prevFields];
                updatedFields[editingFieldIndex] = { ...fieldToSave, id: fieldToSave.id };
                return updatedFields;
            }
            return [...prevFields, { ...fieldToSave, id: fieldToSave.id }];
        });
    } else if (fieldToSave.type === "input_button_combo") {
        if (!fieldToSave.label || !fieldToSave.name || !fieldToSave.inputType || !fieldToSave.buttonLabel || !fieldToSave.buttonAction) {
            alert("Label, Name, Input Type, Button Label, and Button Action are required for Input Button Combo!");
            return;
        }
        setFields(prevFields => {
            if (editingFieldIndex !== null) {
                const updatedFields = [...prevFields];
                updatedFields[editingFieldIndex] = { ...fieldToSave, id: fieldToSave.id };
                return updatedFields;
            }
            return [...prevFields, { ...fieldToSave, id: fieldToSave.id }];
        });
    } else if (fieldToSave.type === "image") {
  if (!fieldToSave.label || !fieldToSave.name) {
    alert("Label and Name are required for Image field!");
    return;
  }

  const imageField = {
    ...fieldToSave,
    type: "image",
    maxImages: fieldToSave.maxImages || 6,
    id: fieldToSave.id || `img-${Date.now()}`
  };

  const narrativeField = {
    type: "textarea",
    label: `${fieldToSave.label} - Notes`,
    name: `${fieldToSave.name}_narrative`,
    placeholder: "Write notes or paste screenshots here (Ctrl+V)",
    rows: 6,
    allowImagePaste: true,
    linkedImageField: fieldToSave.name,
    layout: "full",
    id: `nar-${Date.now()}`
  };

  setFields(prevFields => {
    if (editingFieldIndex !== null) {
      const updated = [...prevFields];
      updated[editingFieldIndex] = imageField;

      const narrativeIndex = updated.findIndex(
        f => f.linkedImageField === fieldToSave.name && f.type === "textarea"
      );
      if (narrativeIndex !== -1) {
        updated[narrativeIndex] = {
          ...updated[narrativeIndex],
          label: narrativeField.label,
          placeholder: narrativeField.placeholder
        };
      }
      return updated;
    }

    return [...prevFields, imageField, narrativeField];
  });

  setNewField(createDefaultNewField());
  setEditingFieldIndex(null);
  return;
    } else {
      if (!fieldToSave.label || !fieldToSave.name) {
        alert("Label and Name are required!");
        return;
      }
      setFields(prevFields => {
        if (editingFieldIndex !== null) {
          const updatedFields = [...prevFields];
          updatedFields[editingFieldIndex] = { ...fieldToSave, id: fieldToSave.id };
          return updatedFields;
        }
        return [...prevFields, { ...fieldToSave, id: fieldToSave.id }];
      });
    }

    setNewField(createDefaultNewField()); // Reset to default after saving
    setEditingFieldIndex(null); // Exit editing mode
    setShowConditionalBuilder(false);
  };

  const removeField = (idx) => setFields(fields.filter((_, i) => i !== idx));

  const moveFieldUp = (i) => {
    if (i === 0) return;
    const newFields = [...fields];
    [newFields[i - 1], newFields[i]] = [newFields[i], newFields[i - 1]];
    setFields(newFields);
  };

  const moveFieldDown = (i) => {
    if (i === fields.length - 1) return;
    const newFields = [...fields];
    [newFields[i], newFields[i + 1]] = [newFields[i + 1], newFields[i]];
    setFields(newFields);
  };

  const startEditField = (fieldToEdit, index) => {
    // Make a deep copy to avoid direct mutation of the original field in the `fields` array
    setNewField(JSON.parse(JSON.stringify(fieldToEdit)));
    setEditingFieldIndex(index);
    setShowConditionalBuilder(false); // Hide conditional builder when editing field
    setTempConditions([]); // Clear temporary conditions
  };

const addCondition = () => {
  if (!conditionalField) return;
  let value = conditionalValue === "filled" ? true : conditionalValue === "empty" ? false : exactValue;
  if (conditionalValue === "exact" && !exactValue) return alert("Enter exact value");

  setTempConditions([...tempConditions, { field: conditionalField, value }]);
  setConditionalField("");
  setConditionalValue("");
  setExactValue("");
};

const removeTempCondition = (i) => setTempConditions(tempConditions.filter((_, idx) => idx !== i));

const applyAdvancedCondition = () => {
  if (tempConditions.length === 0) return;

  const showIf = tempConditions.length === 1
    ? { field: tempConditions[0].field, value: tempConditions[0].value }
    : { mode: conditionMode, conditions: tempConditions };

  setNewField({ ...newField, showIf });
  setTempConditions([]);
  setConditionMode("and");
  setShowConditionalBuilder(false);
};
  const saveForm = () => {
    if (!formId || !formName) {
      alert("Form ID and Name required!");
      return;
    }

    const formData = {
      id: formId,
      name: formName,
      category,
      template: bbcodeTemplate,
      titleGeneratorCode, // Save the titleGeneratorCode
      fields,
      accessType // Store accessType
    };

    update(ref(database, `forms/${formId}`), formData)
      .then(() => {
        alert("Form saved!");
        onClose();
      })
      .catch(err => alert("Error: " + err.message));
  };

  if (!show) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 9999, overflow: "auto" }} onClick={onClose}>
      <div style={{ maxWidth: 1100, margin: "2rem auto", background: "#0f172a", borderRadius: 16, overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ background: "#1e293b", padding: "1.5rem", textAlign: "center" }}>
          <h2 style={{ margin: 0, color: "#e2e8f0" }}>{editingForm ? "Edit" : "Create"} Form</h2>
        </div>

        <div style={{ padding: "2rem" }}>
          <input placeholder="Form ID (e.g. medical_release)" value={formId} onChange={e => setFormId(e.target.value.replace(/\s/g, "_").toLowerCase())} style={inputStyle} />
          <input placeholder="Form Name" value={formName} onChange={e => setFormName(e.target.value)} style={inputStyle} />
          <input placeholder="Category" value={category} onChange={e => setCategory(e.target.value)} style={inputStyle} />

          <label style={{ display: "flex", alignItems: "center", color: "#e2e8f0", margin: "1rem 0" }}>
            <strong style={{ marginRight: "1rem" }}>Access Type:</strong>
            <select value={accessType} onChange={e => setAccessType(e.target.value)} style={{ ...inputStyle, margin: 0, width: 'auto', flexGrow: 1 }}>
              <option value="Public">Public (Anyone)</option>
              <option value="PHMC">PHMC Only</option>
              <option value="Coroner">Coroner Only</option>
              <option value="Civilian">Civilian</option>
            </select>
          </label>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ color: "#60a5fa", marginTop: "2rem" }}>BBCode Template</h4>
            <button
              onClick={() => {
                let newTemplate = bbcodeTemplate.replace(/\$\{(.*?)(?:\|\|.*?)?\}/g, (match, p1) => `{{${p1.trim()}}}`);
                newTemplate = newTemplate.replace(/\{\{(.*?)(?:\|\|.*?)?\}\}/g, (match, p1) => `{{${p1.trim()}}}`);
                setBbcodeTemplate(newTemplate);
              }}
              style={{ background: "#8b5cf6", color: "white", border: "none", padding: "0.5rem 1rem", borderRadius: 8, fontWeight: "600", cursor: 'pointer' }}
            >
              Parse Legacy BBCode
            </button>
          </div>
          <div style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "1rem" }}>
            Use <code>{"{{ fieldName }}"}</code> for form fields. <br />
            For conditional BBCode, use <code>[conditional field="hasDNR" value="true" and field="attorney" value="Yes"] TEXT [/conditional]</code>.
            This conditional BBCode must be manually parsed when generating reports.
          </div>

          <textarea rows={12} value={bbcodeTemplate} onChange={e => setBbcodeTemplate(e.target.value)} style={{ ...inputStyle, fontFamily: "monospace", maxHeight: "200px", overflowY: "auto" }} />

          {/* New: Title Generator Code Input */}
          <h4 style={{ color: "#60a5fa", marginTop: "2rem" }}>Title Generator Function</h4>
          <textarea
            rows={6}
            value={titleGeneratorCode}
            onChange={e => setTitleGeneratorCode(e.target.value)}
            style={{ ...inputStyle, fontFamily: "monospace", maxHeight: "200px", overflowY: "auto" }}
            placeholder="(formData) => \`[FORM_NAME] \${formData.patientName || 'N/A'}\`"
          />

          <h4 style={{ color: "#60a5fa", marginTop: "2rem" }}>Add Field</h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <select value={newField.type} onChange={e => setNewField({ ...newField, type: e.target.value })} style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}>
              <option value="input">Text Input</option>
              <option value="textarea">Textarea</option>
              <option value="select">Dropdown</option>
              <option value="checkbox">Checkbox</option>
              <option value="radio">Radio Button</option>
              <option value="image">Image Upload</option>
              <option value="hr">Horizontal Rule</option>
              <option value="fake_line">Fake Line</option>
              <option value="small_header">Small Header</option>
              <option value="timer">Timer Field</option>
              <option value="input_button_combo">Input Button Combo</option>
            </select>

            {newField.type !== "hr" && newField.type !== "timerButton" && (
              <input 
                placeholder={newField.type === "small_header" ? "Header Text" : "Label"} 
                value={newField.label} 
                onChange={e => setNewField({ ...newField, label: e.target.value })} 
                style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}} 
              />
            )}
            
            {newField.type !== "hr" && newField.type !== "small_header" && newField.type !== "timerButton" && (
              <input 
                placeholder="Name {{}}" 
                value={newField.name} 
                onChange={e => setNewField({ ...newField, name: e.target.value })} 
                style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}} 
              />
            )}

            {newField.type !== "hr" && newField.type !== "checkbox" && newField.type !== "image" && newField.type !== "small_header" && newField.type !== "timer" && newField.type !== "radio" && newField.type !== "input_button_combo" && (
              <input 
                placeholder="Placeholder" 
                value={newField.placeholder} 
                onChange={e => setNewField({ ...newField, placeholder: e.target.value })} 
                style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}} 
              />
            )}

            {newField.type !== "hr" && newField.type !== "checkbox" && newField.type !== "image" && newField.type !== "small_header" && newField.type !== "radio" && newField.type !== "input_button_combo" && (
              <select value={newField.layout || "full"} onChange={e => setNewField({ ...newField, layout: e.target.value })} style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}>
                <option value="full">Full Width</option>
                <option value="compact-50">Compact (50%)</option>
                <option value="compact">Compact (20%)</option>
              </select>
            )}

            {newField.type === "textarea" && (
              <input 
                type="number" 
                placeholder="Rows" 
                value={newField.rows} 
                onChange={e => setNewField({ ...newField, rows: +e.target.value || 4 })} 
                style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}} 
              />
            )}
                        {newField.type === "image" && (
                          <input
                            type="number"
                            placeholder="Max Images"
                            value={newField.maxImages}
                            onChange={e => setNewField({ ...newField, maxImages: +e.target.value || 6 })}
                            style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}
                          />
                        )}
                        
                        {newField.type === "select" && (
                          <input
                            placeholder="Options Key (e.g. dnrTypes)"
                            value={newField.optionsKey}
                            onChange={e => setNewField({ ...newField, optionsKey: e.target.value })}
                            style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}
                          />
                        )}                        
                                    {/* New Timer fields */}
                                    {newField.type === "timer" && (
                                      <>
                                        <select value={newField.timerType} onChange={e => setNewField({ ...newField, timerType: e.target.value })} style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}>
                                            <option value="">— Select Timer Type —</option>
                                            <option value="datetime-local">Date & Time</option>
                                            <option value="time">Time Only</option>
                                        </select>
                                        <input 
                                          placeholder="Button Label (optional)" 
                                          value={newField.buttonLabel} 
                                          onChange={e => setNewField({ ...newField, buttonLabel: e.target.value })} 
                                          style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}} 
                                        />
                                        {newField.buttonLabel && ( // Only show action if label is present
                                          <select value={newField.buttonAction || ""} onChange={e => setNewField({ ...newField, buttonAction: e.target.value })} style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}>
                                              <option value="">— Select Button Action —</option>
                                              <option value="set_current_time">Set Current Time</option>
                                          </select>
                                        )}
                                        <label style={{ display: "flex", alignItems: "center", color: "#e2e8f0", marginTop: "0.5rem", flex: '1 1 auto', minWidth: '150px' }}>
                                          <input
                                            type="checkbox"
                                            checked={newField.displayCurrentTime}
                                            onChange={e => setNewField({ ...newField, displayCurrentTime: e.target.checked })}
                                            style={{ marginRight: "0.8rem" }}
                                          />
                                          Show Current Server Time
                                        </label>
                                      </>
                                    )}
                        
                                    {/* New Radio fields */}
                                    {newField.type === "radio" && (
                                      <textarea
                                        placeholder="Options (comma-separated, e.g., Option A, Option B)"
                                        value={newField.options.join(', ')}
                                        onChange={e => setNewField({ ...newField, options: e.target.value.split(',').map(s => s.trim()).filter(s => s) })}
                                        style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}} 
                                      />
                                    )}

                                    {/* New Input Button Combo fields */}
                                    {newField.type === "input_button_combo" && (
                                      <>
                                        <select value={newField.inputType} onChange={e => setNewField({ ...newField, inputType: e.target.value })} style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}>
                                            <option value="">— Select Input Type —</option>
                                            <option value="text">Text</option>
                                            <option value="datetime-local">Date & Time</option>
                                            <option value="time">Time Only</option>
                                        </select>
                                        <input 
                                          placeholder="Button Label" 
                                          value={newField.buttonLabel} 
                                          onChange={e => setNewField({ ...newField, buttonLabel: e.target.value })} 
                                          style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}} 
                                        />
                                        <select value={newField.buttonAction || ""} onChange={e => setNewField({ ...newField, buttonAction: e.target.value })} style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}>
                                            <option value="">— Select Button Action —</option>
                                            <option value="set_current_time">Set Current Time</option>
                                        </select>
                                      </>
                                    )}
                        
                                    {/* Associated Input Field for Checkbox */}
                                    {newField.type === "checkbox" && (
                                      <div style={{...inputStyle, flex: '1 1 auto', minWidth: '150px', border: "1px dashed #334155", padding: "1rem", margin: "0.5rem 0" }}>
                                        <label style={{ display: "flex", alignItems: "center", color: "#e2e8f0", marginBottom: "0.5rem" }}>
                                          <input
                                            type="checkbox"
                                            checked={!!newField.associatedInputField}
                                            onChange={e => setNewField({ ...newField, associatedInputField: e.target.checked ? { type: "input", name: "", placeholder: "", optionsKey: "" } : null })}
                                            style={{ marginRight: "0.8rem" }}
                                          />
                                          Has Associated Input Field
                                        </label>
                                        {newField.associatedInputField && (
                                          <>
                                            <select
                                              value={newField.associatedInputField.type}
                                              onChange={e => setNewField({ ...newField, associatedInputField: { ...newField.associatedInputField, type: e.target.value } })}
                                              style={inputStyle}
                                            >
                                              <option value="input">Text Input</option>
                                              <option value="textarea">Textarea</option>
                                              <option value="select">Dropdown</option>
                                            </select>
                                            <input
                                              placeholder="Associated Input Name {{}}"
                                              value={newField.associatedInputField.name}
                                              onChange={e => setNewField({ ...newField, associatedInputField: { ...newField.associatedInputField, name: e.target.value } })}
                                              style={inputStyle}
                                            />
                                            {newField.associatedInputField.type !== "textarea" && newField.associatedInputField.type !== "select" && (
                                              <input
                                                placeholder="Associated Input Placeholder"
                                                value={newField.associatedInputField.placeholder}
                                                onChange={e => setNewField({ ...newField, associatedInputField: { ...newField.associatedInputField, placeholder: e.target.value } })}
                                                style={inputStyle}
                                              />
                                            )}
                                            {newField.associatedInputField.type === "select" && (
                                              <input
                                                placeholder="Associated Options Key (e.g. dnrTypes)"
                                                value={newField.associatedInputField.optionsKey}
                                                onChange={e => setNewField({ ...newField, associatedInputField: { ...newField.associatedInputField, optionsKey: e.target.value } })}
                                                style={inputStyle}
                                              />
                                            )}
                                          </>
                                        )}
                                      </div>
                                    )}            
                                    {(newField.type === "textarea" || newField.type === "input" || newField.type === "timer") && (
  <div style={{ margin: "1rem 0", padding: "1rem", background: "#162032", borderRadius: 8, border: "1px dashed #334155" }}>
    <label style={{ display: "flex", alignItems: "center", color: "#e2e8f0", marginBottom: "0.8rem" }}>
      <input
        type="checkbox"
        checked={!!newField.allowImagePaste}
        onChange={e => setNewField({ ...newField, allowImagePaste: e.target.checked })}
        style={{ marginRight: "0.8rem" }}
      />
      <strong>Enable Clipboard Image Paste (Ctrl+V)</strong>
    </label>
    {newField.allowImagePaste && (
      <>
        <p style={{ margin: "0.5rem 0", fontSize: "0.9rem", color: "#94a3b8" }}>
          Users will be able to paste screenshots directly into this field.
        </p>
        <label style={{ display: "block", marginTop: "0.8rem", color: "#cbd5e1" }}>
          <strong>Target Image Field:</strong>
          <select
            value={newField.linkedImageField || ""}
            onChange={e => setNewField({ ...newField, linkedImageField: e.target.value || undefined })}
            style={{ ...inputStyle, marginTop: "0.4rem" }}
          >
            <option value="">→ Auto (uses field name + "_images")</option>
            {fields
              .filter(f => f.type === "image")
              .map(f => (
                <option key={f.name} value={f.name}>
                  {f.label || f.name} ({f.name})
                </option>
              ))}
          </select>
        </label>
        <small style={{ color: "#64748b", display: "block", marginTop: "0.4rem" }}>
          Pasted images will be uploaded and added to this image gallery field.
        </small>
      </>
    )}
  </div>
)}
                        <button onClick={saveField} style={{ background: "#10b981", color: "white", border: "none", padding: "0.8rem", borderRadius: 8, flex: '0 0 auto' }}>{editingFieldIndex !== null ? 'Update Field' : 'Add Field'}</button>
                        {editingFieldIndex !== null && (
                          <button onClick={() => { setNewField(createDefaultNewField()); setEditingFieldIndex(null); setShowConditionalBuilder(false); }} style={{ background: "#f59e0b", color: "white", border: "none", padding: "0.8rem", borderRadius: 8, flex: '0 0 auto' }}>Cancel Edit</button>
                        )}
                      </div>

          {/* Conditional Builder */}
{/* ADVANCED CONDITIONAL BUILDER */}
<div style={{ margin: "1.5rem 0", padding: "1.5rem", background: "#1e293b", borderRadius: 12, border: "1px dashed #334155" }}>
  <button 
    onClick={() => setShowConditionalBuilder(!showConditionalBuilder)}
    style={{ background: "#8b5cf6", color: "white", border: "none", padding: "0.8rem 1.5rem", borderRadius: 8, fontWeight: "600" }}
  >
    {showConditionalBuilder ? "Hide" : "Add Conditional Logic"} (AND/OR, Exact Values)
  </button>

  {showConditionalBuilder && (
    <div style={{ marginTop: "1rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.8rem", marginBottom: "1rem" }}>
        <select value={conditionalField} onChange={e => setConditionalField(e.target.value)} style={inputStyle}>
          <option value="">— Select Trigger Field —</option>
          {fields.map(f => (
            <option key={f.name} value={f.name}>{f.label || f.name}</option>
          ))}
        </select>

        <select value={conditionalValue} onChange={e => setConditionalValue(e.target.value)} style={inputStyle}>
          <option value="">— Condition —</option>
          <option value="filled">Has ANY value</option>
          <option value="empty">Is empty</option>
          <option value="exact">Exact value →</option>
        </select>

        <button onClick={addCondition} style={{ background: "#10b981", color: "white", border: "none", borderRadius: 8 }}>
          Add Rule
        </button>
      </div>

      {conditionalValue === "exact" && (
        <input
          placeholder="Enter exact value (e.g. GeneralInformation)"
          value={exactValue}
          onChange={e => setExactValue(e.target.value)}
          style={{ ...inputStyle, marginBottom: "1rem" }}
        />
      )}

      {tempConditions.length > 0 && (
        <>
          <div style={{ margin: "1rem 0", fontWeight: "600", color: "#94a3b8" }}>
            Show this field when:
            <select value={conditionMode} onChange={e => setConditionMode(e.target.value)} style={{ marginLeft: "1rem", padding: "0.4rem", background: "#334155", border: "none", borderRadius: 6, color: "#e2e8f0" }}>
              <option value="and">ALL</option>
              <option value="or">ANY</option>
            </select>
            of these are true:
          </div>

          {tempConditions.map((c, i) => (
            <div key={i} style={{ padding: "0.8rem", background: "#334155", borderRadius: 8, marginBottom: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>
                <strong>{fields.find(f => f.name === c.field)?.label || c.field}</strong>
                {c.value === true ? " is filled" : c.value === false ? " is empty" : ` = "${c.value}"`}
              </span>
              <button onClick={() => removeTempCondition(i)} style={{ background: "#ef4444", color: "white", border: "none", padding: "0.4rem 0.8rem", borderRadius: 6 }}>Remove</button>
            </div>
          ))}

          <button onClick={applyAdvancedCondition} style={{ background: "#8b5cf6", color: "white", padding: "0.8rem", border: "none", borderRadius: 8, width: "100%", marginTop: "1rem" }}>
            Apply Conditions ({tempConditions.length})
          </button>
        </>
      )}
    </div>
  )}
</div>
          {newField.showIf && (
            <div style={{ padding: "0.8rem", background: "#1e293b", borderRadius: 8, color: "#a78bfa", fontSize: "0.9rem" }}>
              Show this field if <strong>{fields.find(f => f.name === newField.showIf.field)?.label || newField.showIf.field}</strong> is {newField.showIf.value === true ? "checked" : "unchecked"}
              <button onClick={() => setNewField({ ...newField, showIf: null })} style={{ marginLeft: "1rem", color: "#ef4444" }}>Remove</button>
            </div>
          )}

          <h4 style={{ color: "#60a5fa", marginTop: "2rem" }}>Fields ({fields.length})</h4>
          {fields.map((f, i) => (
            <div key={i} style={{ background: "#1e293b", padding: "1rem", borderRadius: 10, marginBottom: "0.8rem", border: "1px solid #334155" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  { f.type === "image" ? (
                    <span style={{ color: "#a78bfa" }}>
                      Image Gallery: <strong>{f.label}</strong> → <code>{"{{" + f.name + "}}"}</code>
                      <span style={{ color: "#34d399", marginLeft: "0.5rem" }}>
                        (Auto-paired with narrative field below)
                      </span>
                    </span>
                  ) : f.allowImagePaste ? (
                    <span style={{ color: "#34d399" }}>
                      Text + Paste: <strong>{f.label}</strong> → <code>{"{{" + f.name + "}}"}</code>
                      <span style={{ color: "#fbbf24", fontSize: "0.85rem" }}>
                        → pastes into <strong>{f.linkedImageField}</strong>
                      </span>
                    </span>
                  ) : f.type === "hr" ? (
                    <span style={{ color: "#a78bfa" }}>Horizontal Rule</span>
                  ) : f.type === "fake_line" ? (
                    <span style={{ color: "#a78bfa" }}>Fake Line (Thinner Horizontal Rule)</span>
                  ) : f.type === "small_header" ? (
                    <span style={{ color: "#a78bfa" }}>Small Header: <strong>{f.label}</strong></span>
                  ) : f.type === "timer" ? (
                    <span style={{ color: "#a78bfa" }}>Timer: <strong>{f.label}</strong> → <code>{"{{" + f.name + "}}"}</code> ({f.timerType})
                      {f.buttonLabel && ` [Button: ${f.buttonLabel} (${f.buttonAction})]`}
                    </span>
                  ) : f.type === "checkbox" ? (
                    <span style={{ color: "#a78bfa" }}>Checkbox: <strong>{f.label}</strong> → <code>{"{{" + f.name + "}}"}</code>
                      {f.associatedInputField && ` [Associated Input: ${f.associatedInputField.type} -> ${f.associatedInputField.name}]`}
                    </span>
                  ) : f.type === "radio" ? (
                    <span style={{ color: "#a78bfa" }}>Radio: <strong>{f.label}</strong> → <code>{"{{" + f.name + "}}"}</code> (Options: {f.options.join(', ')})</span>
                  ) : f.type === "input_button_combo" ? (
                    <span style={{ color: "#a78bfa" }}>Input Button Combo: <strong>{f.label}</strong> → <code>{"{{" + f.name + "}}"}</code> (Type: {f.inputType}, Button: {f.buttonLabel} ({f.buttonAction}))</span>
                  ) : (
                    <>
                      <strong>{f.label}</strong> → <code>{"{{" + f.name + "}}"}</code>
                    </>
                  )}
                  {f.layout === "compact" && <span style={{ marginLeft: "1rem", color: "#a78bfa" }}>20%</span>}
                  {f.type === "select" && <span style={{ marginLeft: "1rem", color: "#f59e0b" }}>Options: {f.optionsKey}</span>}
                  {f.showIf && <span style={{ marginLeft: "1rem", color: "#8b5cf6" }}>Show if {f.showIf.field} = {String(f.showIf.value)}</span>}
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={() => startEditField(f, i)} style={{ background: "#6366f1", color: "white", border: "none", padding: "0 1rem", borderRadius: 8 }}>Edit</button>
                  {i > 0 && <button onClick={() => moveFieldUp(i)} style={{ background: "#6366f1", color: "white", border: "none", width: 36, height: 36, borderRadius: 8 }}>Up</button>}
                  {i < fields.length - 1 && <button onClick={() => moveFieldDown(i)} style={{ background: "#6366f1", color: "white", border: "none", width: 36, height: 36, borderRadius: 8 }}>Down</button>}
                  <button onClick={() => removeField(i)} style={{ background: "#ef4444", color: "white", border: "none", padding: "0 1rem", borderRadius: 8 }}>Remove</button>
                </div>
              </div>
            </div>
          ))}

          <div style={{ marginTop: "2rem", textAlign: "center" }}>
            <button onClick={saveForm} style={{ padding: "1rem 3rem", background: "#6366f1", color: "white", border: "none", borderRadius: 12, margin: "0 1rem" }}>Save Form</button>
            <button onClick={onClose} style={{ padding: "1rem 3rem", background: "#475569", color: "white", border: "none", borderRadius: 12 }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddFormModal;