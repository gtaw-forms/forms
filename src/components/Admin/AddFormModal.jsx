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
  const [fields, setFields] = useState([]);
  const [factionRequired, setFactionRequired] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [newField, setNewField] = useState({
    type: "input",
    label: "",
    name: "",
    placeholder: "",
    rows: 4,
    maxImages: 6
  });

  useEffect(() => {
    if (editingForm) {
      setFormId(editingForm.id || "");
      setFormName(editingForm.name || "");
      setCategory(editingForm.category || "");
      setBbcodeTemplate(editingForm.template || "");
      setFields(editingForm.fields || []);
      setFactionRequired(!!editingForm.factionRequired);
      setCompactMode(!!editingForm.compactMode);
    } else {
      resetForm();
    }
  }, [editingForm]);
const moveFieldUp = (index) => {
  if (index === 0) return;
  const newFields = [...fields];
  [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
  setFields(newFields);
};

const moveFieldDown = (index) => {
  if (index === fields.length - 1) return;
  const newFields = [...fields];
  [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
  setFields(newFields);
};
  const resetForm = () => {
    setFormId("");
    setFormName("");
    setCategory("");
    setBbcodeTemplate("");
    setFields([]);
    setFactionRequired(false);
    setCompactMode(false);
    setNewField({ type: "input", label: "", name: "", placeholder: "", rows: 4, maxImages: 6 });
  };

  const addField = () => {
    if (!newField.label || !newField.name) {
      alert("Label and Name are required!");
      return;
    }
    setFields([...fields, { ...newField }]);
    setNewField({ type: "input", label: "", name: "", placeholder: "", rows: 4, maxImages: 6 });
  };

  const removeField = (idx) => {
    setFields(fields.filter((_, i) => i !== idx));
  };

  const saveForm = () => {
    if (!formId || !formName) {
      alert("Form ID and Name are required!");
      return;
    }

    const formData = {
      id: formId,
      name: formName,
      category,
      template: bbcodeTemplate,
      fields,
      factionRequired: !!factionRequired,
      compactMode: !!compactMode
    };

    const formRef = ref(database, `forms/${formId}`);
    update(formRef, formData)
      .then(() => {
        alert("Form saved successfully!");
        onClose();
      })
      .catch((err) => alert("Error: " + err.message));
  };

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        style={{ maxWidth: 1000, borderRadius: 16, background: "#0f172a" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ background: "#1e293b", padding: "1.5rem", borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
          <h3 style={{ margin: 0, color: "#e2e8f0" }}>
            {editingForm ? "Edit" : "Add New"} Form Template
          </h3>
        </div>

        <div style={{ padding: "2rem", maxHeight: "85vh", overflowY: "auto" }}>
          <input placeholder="Form ID (slug)" value={formId} onChange={(e) => setFormId(e.target.value.replace(/\s/g, "_").toLowerCase())} style={inputStyle} />
          <input placeholder="Form Name" value={formName} onChange={(e) => setFormName(e.target.value)} style={inputStyle} />
          <input placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle} />

          <div style={{ margin: "2rem 0" }}>
            <label style={{ display: "flex", alignItems: "center", color: "#e2e8f0", cursor: "pointer" }}>
              <input type="checkbox" checked={compactMode} onChange={(e) => setCompactMode(e.target.checked)} style={{ marginRight: "0.8rem" }} />
              <strong>Compact Mode</strong> — 2-column layout
            </label>
            <label style={{ display: "flex", alignItems: "center", marginTop: "1rem", color: "#e2e8f0", cursor: "pointer" }}>
              <input type="checkbox" checked={factionRequired} onChange={(e) => setFactionRequired(e.target.checked)} style={{ marginRight: "0.8rem" }} />
              <strong>PHMC Only</strong> — Requires faction membership
            </label>
          </div>

          <h4 style={{ color: "#60a5fa", marginTop: "2rem" }}>BBCode Template (use &#123;&#123;fieldName&#125;&#125;)</h4>
          <textarea
            rows={15}
            value={bbcodeTemplate}
            onChange={(e) => setBbcodeTemplate(e.target.value)}
            style={{ width: "100%", background: "#1e293b", color: "#e2e8f0", padding: "1rem", borderRadius: 8, fontFamily: "monospace" }}
          />

          <h4 style={{ color: "#60a5fa", marginTop: "2rem" }}>Fields</h4>
{/* Inside the fields grid — replace the old one */}
<div style={{ 
  display: "grid", 
  gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr auto", 
  gap: "0.5rem", 
  marginBottom: "1rem", 
  alignItems: "center" 
}}>
<select value={newField.type} onChange={e => setNewField({ ...newField, type: e.target.value })} style={inputStyle}>
    <option value="input">Text Input</option>
    <option value="textarea">Textarea</option>
    <option value="select">Dropdown (Select)</option>
    <option value="image">Image Upload</option>
    <option value="checkbox">Checkbox</option>
  </select>

  <input placeholder="Label" value={newField.label} onChange={e => setNewField({...newField, label: e.target.value})} style={inputStyle} />
  <input placeholder="Name {{}}" value={newField.name} onChange={e => setNewField({...newField, name: e.target.value})} style={inputStyle} />
  <input placeholder="Placeholder" value={newField.placeholder} onChange={e => setNewField({...newField, placeholder: e.target.value})} style={inputStyle} />

  {/* Layout selector */}
{/* Layout */}
  <select value={newField.layout || "full"} onChange={e => setNewField({ ...newField, layout: e.target.value })} style={inputStyle}>
    <option value="full">Full Width</option>
    <option value="compact">Compact (33%)</option>
  </select>

  {/* Only show optionsKey for select type */}
  {newField.type === "select" && (
    <input 
      placeholder="Options Key (e.g. 'genders')" 
      value={newField.optionsKey || ""} 
      onChange={e => setNewField({ ...newField, optionsKey: e.target.value })}
      style={inputStyle}
    />
  )}  {/* Optional extra inputs */}
  {newField.type === "textarea" && (
    <input type="number" placeholder="Rows" value={newField.rows || 4} onChange={e => setNewField({...newField, rows: +e.target.value})} style={inputStyle} />
  )}
  {newField.type === "image" && (
    <input type="number" placeholder="Max" value={newField.maxImages || 6} onChange={e => setNewField({...newField, maxImages: +e.target.value})} style={inputStyle} />
  )}

  <button onClick={addField} style={{background:"#10b981",color:"white",border:"none",padding:"0.6rem",borderRadius:8}}>+ Add</button>
</div>
{fields.map((f, i) => (
  <div
    key={i}
    style={{
      background: "#1e293b",
      padding: "0.9rem",
      borderRadius: 10,
      marginBottom: "0.7rem",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      border: "1px solid #334155"
    }}
  >
    <div>
      <strong>{f.label}</strong> → <code style={{background:"#334155",padding:"0.3rem 0.6rem",borderRadius:6}}>&#123;&#123;{f.name}&#125;&#125;</code>
      <span style={{marginLeft:"1rem", fontSize:"0.85rem", color: f.layout === "compact" ? "#a78bfa" : "#64748b"}}>
        {f.layout === "compact" ? "Compact (33%)" : "Full Width"}
      </span>
      {f.type === "select" && <span style={{color:"#f59e0b", marginLeft:"0.8rem"}}>Options: {f.optionsKey}</span>}
      {f.type === "image" && <span style={{color:"#60a5fa", marginLeft:"0.8rem"}}>Images ({f.maxImages || 6})</span>}
    </div>

    <div style={{display:"flex", gap:"0.5px"}}>
      {i > 0 && (
        <button onClick={() => moveFieldUp(i)} style={{background:"#6366f1", color:"white", border:"none", width:32, height:32, borderRadius:6, cursor:"pointer"}}>Up</button>
      )}
      {i < fields.length - 1 && (
        <button onClick={() => moveFieldDown(i)} style={{background:"#6366f1", color:"white", border:"none", width:32, height:32, borderRadius:6, cursor:"pointer"}}>Down</button>
      )}
      <button onClick={() => removeField(i)} style={{background:"#ef4444", color:"white", border:"none", padding:"0 0.8rem", borderRadius:6}}>Remove</button>
    </div>
  </div>
))}
          <div style={{ marginTop: "2rem", textAlign: "center" }}>
            <button onClick={saveForm} style={{ padding: "1rem 2rem", background: "#6366f1", color: "white", border: "none", borderRadius: 12, marginRight: "1rem" }}>Save Form</button>
            <button onClick={onClose} style={{ padding: "1rem 2rem", background: "#475569", color: "white", border: "none", borderRadius: 12 }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddFormModal;