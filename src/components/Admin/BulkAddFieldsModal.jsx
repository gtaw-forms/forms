// src/components/admin/BulkAddFieldsModal.jsx
import React, { useState, useEffect } from "react";

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

const BulkAddFieldsModal = ({ show, onBulkAdd, onClose, existingFields = [], bbcodeTemplate = "" }) => {
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
        id: null,
        associatedInputField: null,
        options: [],
        inputType: "",
        showIf: null,
        infoType: 'Information',
        content: '',
        decedentItemSchemaJson: "",
    });
    
    const [queuedFields, setQueuedFields] = useState([]);
    const [newField, setNewField] = useState(createDefaultNewField());

    const [showConditionalBuilder, setShowConditionalBuilder] = useState(false);
    const [conditionalField, setConditionalField] = useState("");
    const [conditionalValue, setConditionalValue] = useState("");
    const [tempConditions, setTempConditions] = useState([]);
    const [conditionMode, setConditionMode] = useState("and");
    const [exactValue, setExactValue] = useState("");

    const [internalBbcode, setInternalBbcode] = useState("");

    useEffect(() => {
        if (show) {
            setInternalBbcode(bbcodeTemplate);
            console.log('BulkAddFieldsModal: Setting internalBbcode from prop:', bbcodeTemplate);
        }
    }, [show, bbcodeTemplate]);
    
    const allAvailableFields = [...existingFields, ...queuedFields];

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

    const handleQueueField = () => {
        // Handle special case for image field first
        if (newField.type === 'image') {
            if (!newField.label || !newField.name) {
                alert("Label and Name are required for Image field!");
                return;
            }
    
            const imageField = {
                ...newField,
                type: "image",
                id: `new-img-${Date.now()}`,
                maxImages: newField.maxImages || 6,
            };
    
            const narrativeField = {
                ...createDefaultNewField(),
                type: "textarea",
                label: `${newField.label} - Notes`,
                name: `${newField.name}_narrative`,
                placeholder: "Write notes or paste screenshots here (Ctrl+V)",
                rows: 6,
                allowImagePaste: true,
                linkedImageField: newField.name,
                layout: "full",
                id: `new-nar-${Date.now()}`
            };
    
            setQueuedFields(prev => [...prev, imageField, narrativeField]);
            setNewField(createDefaultNewField());
            setShowConditionalBuilder(false);
            setTempConditions([]);
            return; 
        }

        // Basic validation before queueing
        if (newField.type === 'hr' || newField.type === 'fake_line' || newField.type === 'decedent_list') {
            // These types don't require label or name for basic queueing
        } else if (newField.type === 'information_state') {
            if (!newField.content) {
                alert("Content is required for Information State!");
                return;
            }
        } else if (newField.type === 'small_header') {
            if (!newField.label) {
                alert("Header Text is required for Small Header!");
                return;
            }
        } else { // All other field types
            if (!newField.label || !newField.name) {
                alert("Label and Name are required for this field type.");
                return;
            }
        }

        const fieldToQueue = {
            ...newField,
            id: `new-${Date.now()}-${Math.random()}`
        };

        setQueuedFields(prev => [...prev, fieldToQueue]);
        setNewField(createDefaultNewField()); // Reset for next field
        setShowConditionalBuilder(false);
        setTempConditions([]);
    };

    const handleRemoveFromQueue = (id) => {
        setQueuedFields(prev => prev.filter(f => f.id !== id));
    };

    const handleConfirmBulkAdd = () => {
        onBulkAdd(queuedFields);
        setQueuedFields([]); // Clear queue after adding
        onClose(); // Close the bulk add modal
    };

    if (!show) return null;

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", zIndex: 10000, overflow: "auto" }}>
            <div style={{ maxWidth: 1400, margin: "2rem auto", background: "#0f172a", borderRadius: 16 }} onClick={e => e.stopPropagation()}>
                <div style={{ background: "#1e293b", padding: "1.5rem", textAlign: "center" }}>
                    <h2 style={{ margin: 0, color: "#e2e8f0" }}>Add Multiple Fields</h2>
                </div>

                <div style={{ padding: "2rem", display: 'flex', gap: '2rem' }}>
                    {/* Left Column: BBCode Viewer */}
                    <div style={{ flex: 1 }}>
                        <h4 style={{ color: "#60a5fa", marginTop: 0, marginBottom: '1rem' }}>BBCode Template</h4>
                        <div style={{
                            background: '#162032',
                            padding: '1rem',
                            borderRadius: '8px',
                            height: 'calc(100vh - 220px)',
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            color: '#cbd5e1',
                            border: '1px solid #334155'
                        }}>
                            {internalBbcode || "No BBCode template provided."}
                        </div>
                    </div>

                    {/* Right Column: Field Builder */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {/* Section to define a new field */}
                        <div style={{ padding: "1.5rem", background: "#1e293b", borderRadius: 12, border: "1px solid #334155" }}>
                            <h4 style={{ color: "#60a5fa", marginTop: 0 }}>Define New Field</h4>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                              <select value={newField.type} onChange={e => setNewField({ ...createDefaultNewField(), type: e.target.value })} style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}>
                                <option value="input">Text Input</option>
                                <option value="textarea">Textarea</option>
                                <option value="select">Dropdown</option>
                                <option value="character_selector">Dropdown - Character Select</option>
                                <option value="employee_select">Dropdown - Employee Selector</option>
                                <option value="multi_employee_select">Dropdown - Multiple Employees</option>
                                <option value="multi_select">Dropdown (Multiple Selection)</option>
                                <option value="checkbox">Checkbox</option>
                                <option value="radio">Radio Button</option>
                                <option value="image">Image Upload</option>
                                <option value="payment_button">Payment Button</option>
                                <option value="hr">Horizontal Rule</option>
                                <option value="fake_line">Fake Line</option>
                                <option value="small_header">Small Header</option>
                                <option value="timer">Timer Field</option>
                                <option value="input_button_combo">Input Button Combo</option>
                                <option value="attach_report_button">Attach Report Button</option>
                                <option value="decedent_list">Decedent List</option>
                                <option value="dynamic_text_list">Dynamic Text List</option>
                                <option value="autopsy_diagram_button">Autopsy Diagram Button</option>
                                <option value="information_state">Information State</option>
                              </select>
                  
                              {newField.type === "information_state" && (
                                <>
                                    <select
                                        value={newField.infoType}
                                        onChange={e => setNewField({ ...newField, infoType: e.target.value })}
                                        style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}
                                    >
                                        <option value="Information">Information</option>
                                        <option value="Warning">Warning</option>
                                        <option value="Danger">Danger</option>
                                    </select>
                                    <textarea
                                        placeholder="Content for the information state"
                                        value={newField.content}
                                        onChange={e => setNewField({ ...newField, content: e.target.value })}
                                        style={{...inputStyle, flex: '1 1 100%', minWidth: '150px'}}
                                        rows={3}
                                    />
                                </>
                              )}
                  
                              {newField.type !== "hr" && newField.type !== "decedent_list" && newField.type !== "information_state" && (
                                <input
                                  placeholder={newField.type === "small_header" ? "Header Text" : "Label"}
                                  value={newField.label}
                                  onChange={e => setNewField({ ...newField, label: e.target.value })}
                                  style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}
                                />
                              )}                          
                              {newField.type !== "hr" && newField.type !== "small_header" && newField.type !== "attach_report_button" && newField.type !== "decedent_list" && newField.type !== "information_state" && (
                                <input 
                                  placeholder="Name {{}}" 
                                  value={newField.name} 
                                  onChange={e => setNewField({ ...newField, name: e.target.value })} 
                                  style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}} 
                                />
                              )}
                              {newField.type === "dynamic_text_list" && (
                                <input
                                  placeholder="Button Label"
                                  value={newField.buttonLabel}
                                  onChange={e => setNewField({ ...newField, buttonLabel: e.target.value })}
                                  style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}
                                />
                              )}
                  
                              {newField.type === "attach_report_button" && (
                                <>
                                  <select
                                    value={newField.employeeType}
                                    onChange={e => setNewField({ ...newField, employeeType: e.target.value })}
                                    style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}
                                  >
                                    <option value="">— Select Employee Type —</option>
                                    <option value="PHMC">PHMC</option>
                                    <option value="Coroner">Coroner</option>
                                  </select>
                                  <input
                                    placeholder="Target Field Name"
                                    value={newField.targetField}
                                    onChange={e => setNewField({ ...newField, targetField: e.target.value })}
                                    style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}
                                  />
                                </>
                              )}
                              {newField.type === "decedent_list" && (
                                <div style={{ flexBasis: '100%', padding: '1rem', background: '#162032', borderRadius: 8 }}>
                                    <div style={{ color: "#94a3b8", fontSize: "0.9rem", marginTop: '0.5rem' }}>
                                        The decedent list will automatically include fields for Name, OOC, Synopsis, Time/Cause/Manner/Type of Death, Scene Photos and their Notes, and Additional Images and their Notes.
                                    </div>
                                </div>
                              )}
                  
                              {newField.type !== "hr" && newField.type !== "checkbox" && newField.type !== "image" && newField.type !== "small_header" && newField.type !== "timer" && newField.type !== "radio" && newField.type !== "input_button_combo" && newField.type !== "attach_report_button" && newField.type !== "decedent_list" && newField.type !== "information_state" && (
                                <input 
                                  placeholder="Placeholder" 
                                  value={newField.placeholder} 
                                  onChange={e => setNewField({ ...newField, placeholder: e.target.value })} 
                                  style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}} 
                                />
                              )}
                  
                              {newField.type !== "hr" && newField.type !== "checkbox" && newField.type !== "image" && newField.type !== "small_header" && newField.type !== "radio" && newField.type !== "input_button_combo" && newField.type !== "attach_report_button" && newField.type !== "information_state" && (
                                <select value={newField.layout || "full"} onChange={e => setNewField({ ...newField, layout: e.target.value })} style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}>
                                  <option value="full">Full Width</option>
                                  <option value="compact-50">Compact (50%)</option>
                                  <option value="compact-33">Compact (33%)</option>
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
                              
                              {(newField.type === "select" || newField.type === "multi_select") && (
                                <input
                                  placeholder="Options Key (e.g. dnrTypes)"
                                  value={newField.optionsKey}
                                  onChange={e => setNewField({ ...newField, optionsKey: e.target.value })}
                                  style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}
                                />
                              )}
                              {newField.type === "timer" && (
                                <>
                                  <select value={newField.timerType} onChange={e => setNewField({ ...newField, timerType: e.target.value })} style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}}>
                                      <option value="">— Select Timer Type —</option>
                                      <option value="datetime-local">Date & Time</option>
                                      <option value="date">Date Only</option>
                                      <option value="time">Time Only</option>
                                  </select>
                                  <input 
                                    placeholder="Button Label (optional)" 
                                    value={newField.buttonLabel} 
                                    onChange={e => setNewField({ ...newField, buttonLabel: e.target.value })} 
                                    style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}} 
                                  />
                                  {newField.buttonLabel && (
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
                  
                              {newField.type === "radio" && (
                                <textarea
                                  placeholder="Options (comma-separated, e.g., Option A, Option B)"
                                  value={newField.options.join(', ')}
                                  onChange={e => setNewField({ ...newField, options: e.target.value.split(',').map(s => s.trim()).filter(s => s) })}
                                  style={{...inputStyle, flex: '1 1 auto', minWidth: '150px'}} 
                                />
                              )}
          
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
          
                              {newField.type === "payment_button" && (
                                <div style={{ flexBasis: '100%', padding: '1rem', background: '#162032', borderRadius: 8 }}>
                                  <textarea
                                    placeholder="Payment Value Logic (e.g., (formData) => formData.someValue * 100)"
                                    value={newField.paymentValueLogic || ''}
                                    onChange={e => setNewField({ ...newField, paymentValueLogic: e.target.value })}
                                    style={{...inputStyle, width: '100%', fontFamily: 'monospace'}}
                                    rows={3}
                                  />
                                  <div style={{ color: "#94a3b8", fontSize: "0.9rem", marginTop: '0.5rem' }}>
                                      Use a JS arrow function that receives <code>formData</code> and returns the payment amount in cents.
                                      Example: <code>(formData) => 2000</code>
                                  </div>
                                </div>
                              )}
                  
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
                                          {allAvailableFields
                                            .filter(f => f.type === "image")
                                            .map(f => (
                                              <option key={f.id || f.name} value={f.name}>
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
                            </div>
    
                            {/* Conditional Builder */}
                            <div style={{ margin: "1.5rem 0", padding: "1.5rem", background: "#0f172a", borderRadius: 12, border: "1px dashed #334155" }}>
                                <button 
                                  onClick={() => setShowConditionalBuilder(!showConditionalBuilder)}
                                  style={{ background: "#8b5cf6", color: "white", border: "none", padding: "0.8rem 1.5rem", borderRadius: 8, fontWeight: "600", width: '100%' }}
                                >
                                  {showConditionalBuilder ? "Hide" : "Add Conditional Logic"}
                                </button>
                              
                                {showConditionalBuilder && (
                                  <div style={{ marginTop: "1rem" }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.8rem", marginBottom: "1rem" }}>
                                      <select value={conditionalField} onChange={e => setConditionalField(e.target.value)} style={inputStyle}>
                                        <option value="">— Select Trigger Field —</option>
                                        {allAvailableFields.map(f => (
                                          <option key={f.id || f.name} value={f.name}>{f.label || f.name}</option>
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
                                              <strong>{allAvailableFields.find(f => f.name === c.field)?.label || c.field}</strong>
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
                              <div style={{ padding: "0.8rem", background: "#1a253a", borderRadius: 8, color: "#a78bfa", fontSize: "0.9rem", marginBottom: '1rem' }}>
                                <strong>Conditional Logic Applied:</strong> Show this field if {' '}
                                {newField.showIf.mode ? (
                                    <>
                                        <strong>{newField.showIf.mode.toUpperCase()}</strong> of: {' '}
                                        {newField.showIf.conditions.map((condition, idx) => (
                                            <span key={idx}>
                                                {idx > 0 && ", "}
                                                <strong>{allAvailableFields.find(field => field.name === condition.field)?.label || condition.field}</strong>
                                                {' is '}
                                                {condition.value === true ? "filled" : condition.value === false ? "empty" : `"${condition.value}"`}
                                            </span>
                                        ))}
                                    </>
                                ) : (
                                    <>
                                        <strong>{allAvailableFields.find(field => field.name === newField.showIf.field)?.label || newField.showIf.field}</strong>
                                        {' is '}
                                        {newField.showIf.value === true ? "filled" : newField.showIf.value === false ? "empty" : `"${newField.showIf.value}"`}
                                    </>
                                )}
                                <button onClick={() => setNewField({ ...newField, showIf: null })} style={{ marginLeft: "1rem", background: 'none', border: 'none', color: "#ef4444", cursor: 'pointer' }}>Remove</button>
                              </div>
                            )}
    
                            <button onClick={handleQueueField} style={{ background: "#10b981", color: "white", border: "none", padding: "0.8rem 1.5rem", borderRadius: 8, width: '100%', fontWeight: '600', marginTop: '1rem' }}>
                                Add Field to Queue
                            </button>
                        </div>
    
                        {/* Section to show queued fields */}
                        <div style={{ marginTop: '2rem', flex: '1', display: 'flex', flexDirection: 'column' }}>
                            <h4 style={{ color: "#60a5fa" }}>Queued Fields ({queuedFields.length})</h4>
                            {queuedFields.length === 0 ? (
                                <p style={{ color: '#94a3b8', textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No fields queued yet.</p>
                            ) : (
                                <div style={{ flex: '1', maxHeight: '300px', overflowY: 'auto', paddingRight: '1rem' }}>
                                    {queuedFields.map((f, i) => (
                                        <div key={f.id} style={{ background: "#1e293b", padding: "1rem", borderRadius: 10, marginBottom: "0.8rem", border: "1px solid #334155", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>
                                                <strong>{f.label || f.type}</strong> ({f.type}) → <code>{f.name}</code>
                                                {f.showIf && <span style={{ marginLeft: '10px', color: '#8b5cf6', fontSize: '0.8rem', fontWeight: 'bold' }}>(Conditional)</span>}
                                            </span>
                                            <button onClick={() => handleRemoveFromQueue(f.id)} style={{ background: "#ef4444", color: "white", border: "none", padding: "0.4rem 0.8rem", borderRadius: 6 }}>Remove</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
    
                        {/* Modal Actions */}
                        <div style={{ marginTop: "2rem", textAlign: "center", display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button onClick={onClose} style={{ padding: "1rem 2rem", background: "#475569", color: "white", border: "none", borderRadius: 12 }}>Cancel</button>
                            <button onClick={handleConfirmBulkAdd} style={{ padding: "1rem 2rem", background: "#6366f1", color: "white", border: "none", borderRadius: 12 }} disabled={queuedFields.length === 0}>
                                Add {queuedFields.length} Fields to Form
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BulkAddFieldsModal;
