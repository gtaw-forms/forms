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
  const [factionRequired, setFactionRequired] = useState(false);

  const [newField, setNewField] = useState({
    type: "input",
    label: "",
    name: "",
    placeholder: "",
    layout: "full",
    rows: 4,
    maxImages: 6,
    optionsKey: "",
    showIf: null // { field: "someField", value: true }
  });

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
      setFields(editingForm.fields || []);
      setFactionRequired(!!editingForm.factionRequired);
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
    setFactionRequired(false);
    setNewField({
      type: "input",
      label: "",
      name: "",
      placeholder: "",
      layout: "full",
      rows: 4,
      maxImages: 6,
      optionsKey: "",
      showIf: null
    });
  };

  const addField = () => {
    if (newField.type === "hr") {
      // No specific validation needed for HR, name is not needed
      setFields([...fields, { type: "hr" }]);
    } else if (newField.type === "small_header") {
      if (!newField.label) {
        alert("Header Text is required for Small Header!");
        return;
      }
      // Auto-generate name if not provided
      const finalName = newField.name || `header_${fields.length + 1}`;
      setFields([...fields, { type: "small_header", label: newField.label, name: finalName }]);
    } else {
      // Existing validation for other types
      if (!newField.label || !newField.name) {
        alert("Label and Name are required!");
        return;
      }
      setFields([...fields, { ...newField }]);
    }

    setNewField({
      type: "input",
      label: "",
      name: "",
      placeholder: "",
      layout: "full",
      rows: 4,
      maxImages: 6,
      optionsKey: "",
      showIf: null
    });
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
      factionRequired
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
            <input type="checkbox" checked={factionRequired} onChange={e => setFactionRequired(e.target.checked)} style={{ marginRight: "0.8rem" }} />
            <strong>PHMC Only</strong>
          </label>

          <h4 style={{ color: "#60a5fa", marginTop: "2rem" }}>BBCode Template</h4>
          <textarea rows={12} value={bbcodeTemplate} onChange={e => setBbcodeTemplate(e.target.value)} style={{ ...inputStyle, fontFamily: "monospace" }} />

          {/* New: Title Generator Code Input */}
          <h4 style={{ color: "#60a5fa", marginTop: "2rem" }}>Title Generator Function</h4>
          <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "1rem" }}>
            Enter a JavaScript function body like `(formData) => \`[TITLE] \${formData.field || 'N/A'}\``.
          </p>
          <textarea
            rows={6}
            value={titleGeneratorCode}
            onChange={e => setTitleGeneratorCode(e.target.value)}
            style={{ ...inputStyle, fontFamily: "monospace" }}
            placeholder="(formData) => \`[FORM_NAME] \${formData.patientName || 'N/A'}\`"
          />

          <h4 style={{ color: "#60a5fa", marginTop: "2rem" }}>Add Field</h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <select value={newField.type} onChange={e => setNewField({ ...newField, type: e.target.value })} style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}>
              <option value="input">Text Input</option>
              <option value="textarea">Textarea</option>
              <option value="select">Dropdown</option>
              <option value="checkbox">Checkbox</option>
              <option value="image">Image Upload</option>
              <option value="hr">Horizontal Rule</option>
              <option value="small_header">Small Header</option>
            </select>

            {newField.type !== "hr" && (
              <input 
                placeholder={newField.type === "small_header" ? "Header Text" : "Label"} 
                value={newField.label} 
                onChange={e => setNewField({ ...newField, label: e.target.value })} 
                style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}} 
              />
            )}
            
            {newField.type !== "hr" && newField.type !== "small_header" && (
              <input 
                placeholder="Name {{}}" 
                value={newField.name} 
                onChange={e => setNewField({ ...newField, name: e.target.value })} 
                style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}} 
              />
            )}

            {newField.type !== "hr" && newField.type !== "checkbox" && newField.type !== "select" && newField.type !== "image" && newField.type !== "small_header" && (
              <input 
                placeholder="Placeholder" 
                value={newField.placeholder} 
                onChange={e => setNewField({ ...newField, placeholder: e.target.value })} 
                style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}} 
              />
            )}

            {newField.type !== "hr" && newField.type !== "checkbox" && newField.type !== "image" && newField.type !== "small_header" && (
              <select value={newField.layout || "full"} onChange={e => setNewField({ ...newField, layout: e.target.value })} style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}>
                <option value="full">Full Width</option>
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

            <button onClick={addField} style={{ background: "#10b981", color: "white", border: "none", padding: "0.8rem", borderRadius: 8, flex: '0 0 auto' }}>Add Field</button>
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
                  {f.type === "hr" ? (
                    <span style={{ color: "#a78bfa" }}>Horizontal Rule</span>
                  ) : f.type === "small_header" ? (
                    <span style={{ color: "#a78bfa" }}>Small Header: <strong>{f.label}</strong></span>
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