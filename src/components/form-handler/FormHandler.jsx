// src/components/form-handler/FormHandler.jsx
import React, { useState, useEffect, useCallback } from "react";
import { database } from "../../firebase";
import { ref, onValue } from "firebase/database";
import useGtaWorldAuth from "../../hooks/useGtaWorldAuth";
import styles from "../ems-dashboard/EmsDashboard.module.css";
import formStyles from './FormHandler.module.css';
import ImageUploader from './ImageUploader';
import { useModal } from "../../contexts/ModalProvider";
import EmsBingoModal from '../EmsBingoModal';

// Helper function to get current UTC time in 'YYYY-MM-DDTHH:MM' format
const getUtcFormattedDateTime = () => {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}T${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
};

// Helper function to get current UTC time in 'HH:MM' format
const getUtcFormattedTime = () => {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
};

const FormHandler = () => {
  const { 
    user, 
    isAuthenticated, 
    isPhmcMember,
    characterName,
    factionRank,
    selectOptions: authSelectOptions
  } = useGtaWorldAuth();

  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem("formSearchTerm") || "");
  const [selectedCategory, setSelectedCategory] = useState(() => localStorage.getItem("formSelectedCategory") || "All");
  const [showRestricted, setShowRestricted] = useState(() => localStorage.getItem("formShowRestricted") === "true" || false);
  const [generatedBBCode, setGeneratedBBCode] = useState("");
  const [generatedTitle, setGeneratedTitle] = useState(""); // New state for generated title
  const [showBBCode, setShowBBCode] = useState(false);

  const [selectOptions, setSelectOptions] = useState({});
  const finalSelectOptions = { ...selectOptions, ...authSelectOptions };

  // Save filters to localStorage
  useEffect(() => {
    localStorage.setItem("formSearchTerm", searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    localStorage.setItem("formSelectedCategory", selectedCategory);
  }, [selectedCategory]);
  
  useEffect(() => {
    localStorage.setItem("formShowRestricted", String(showRestricted));
  }, [showRestricted]);

  // Load selectOptions
  useEffect(() => {
    const optionsRef = ref(database, "selectOptions");
    const unsub = onValue(optionsRef, (snap) => {
      const data = snap.val();
      if (data) setSelectOptions(data);
    });
    return () => unsub();
  }, []);

  // Load forms
  useEffect(() => {
    const formsRef = ref(database, "forms");
    const unsub = onValue(formsRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.keys(data).map(key => ({ ...data[key], firebaseKey: key }));
      setForms(list);
    });
    return () => unsub();
  }, []);
    const {
        showEmsBingoModal, setShowEmsBingoModal,
    } = useModal();
    
  const categories = ["All", ...new Set(forms.map(f => f.category || "Uncategorized"))];

  const filteredForms = forms.filter(form => {
    const matchesSearch = form.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         form.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         form.uniqueWords?.some(word => word.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === "All" || form.category === selectedCategory;
    if (form.factionRequired && !isPhmcMember && !showRestricted) return false;
    return matchesSearch && matchesCategory;
  });

  const handleChange = useCallback((name, value) => {
    setFormValues(prev => ({ ...prev, [name]: value }));
  }, []);

  const generateBBCode = () => {
    if (!selectedForm?.template) return;
    let bbcode = selectedForm.template;
    let title = "";

    // Generate title if titleGeneratorCode exists
    if (selectedForm.titleGeneratorCode) {
      try {
        const funcString = selectedForm.titleGeneratorCode;
        const arrowIndex = funcString.indexOf('=>');

        if (arrowIndex !== -1) {
          const paramsString = funcString.substring(0, arrowIndex).trim();
          const bodyString = funcString.substring(arrowIndex + 2).trim();

          const params = (paramsString.startsWith('(') && paramsString.endsWith(')'))
                         ? paramsString.substring(1, paramsString.length - 1).trim()
                         : paramsString.trim();

          const firstBacktickIndex = bodyString.indexOf('`');
          const lastBacktickIndex = bodyString.lastIndexOf('`');

          let actualBodyContent = bodyString;
          if (firstBacktickIndex !== -1 && lastBacktickIndex !== -1 && firstBacktickIndex < lastBacktickIndex) {
              actualBodyContent = bodyString.substring(firstBacktickIndex + 1, lastBacktickIndex);
          } else {
              console.warn("titleGeneratorCode body might not be a template literal or is malformed when using arrow function syntax:", bodyString);
          }

          const titleFn = new Function(params, `return 
${actualBodyContent}
`);
          title = titleFn(formValues);

        } else {
          // If it's not an arrow function, assume it's just the template literal content
          // and wrap it in a function, replacing [FORM_NAME]
          let processedFuncString = funcString.replace(/\n[FORM_NAME]\n/g, selectedForm.name || '');
          try {
              const titleFn = new Function('formData', `return 
${processedFuncString}
`);
              title = titleFn(formValues);
          } catch (fnError) {
              console.error("Error generating title from plain template string:", fnError);
              title = `Error processing title template: ${fnError.message}`;
          }
        }
      } catch (error) {
        console.error("Error generating title with new Function():", error);
        title = `Error generating title: ${error.message}`;
      }
    } else {
      title = selectedForm.name || "Untitled Report";
    }
    setGeneratedTitle(title); // Set the generated title

    // Replace placeholders in the BBCode template
    selectedForm.fields?.forEach(field => {
      if (field.type === "hr") {
        bbcode = bbcode.replace(new RegExp(`{{${field.name}}}`, "g"), "\n[hr]\n");
        return; // Move to next field
      }

      const placeholder = `{{${field.name}}}`;
      let replacementValue = "";

      if (field.type === "small_header") {
        replacementValue = `[size=10][b]${field.label}[/b][/size]`;
      } else {
        const value = formValues[field.name] ?? "";

        if (field.type === "image") {
          if (value) {
            const imageUrls = value.split(', ');
            replacementValue = imageUrls.map(url => `[img]${url}[/img]`).join(",");
          } else {
            replacementValue = "[No images]";
          }
        } else if (field.type === "checkbox") {
          replacementValue = value ? "Yes" : "No";
        } else {
          replacementValue = value || "";
        }
      }
      bbcode = bbcode.replace(new RegExp(placeholder, "g"), replacementValue);
    });

    setGeneratedBBCode(bbcode);
    setShowBBCode(true);
  };

  const copyAndSaveReport = () => {
    if (!generatedBBCode) return;
    const fullReportContent = generatedTitle ? `[center][size=150][b]${generatedTitle}[/b][/size][/center]\n\n${generatedBBCode}` : generatedBBCode;
    navigator.clipboard.writeText(fullReportContent);
    alert("BBCode copied to clipboard!");
  };

  return (
    <div className={styles.container}>
      <EmsBingoModal
        show={showEmsBingoModal}
        onHide={() => setShowEmsBingoModal(false)}
      />
      <div style={{
        position: "fixed",
        top: 20,
        right: 20,
        zIndex: 1000,
        display: "flex",
        gap: "10px", // Space between buttons
      }}>
        {isPhmcMember && (
          <button
            className={formStyles.topButton}
            onClick={() => window.location.href = "/admin"}
          >
            Admin Panel
          </button>
        )}
        {isPhmcMember && (
          <button
            className={formStyles.topButton}
            onClick={() => window.location.href = "/ems-dashboard"}
          >
            EMS Dashboard
          </button>
        )}
        <button
          className={formStyles.topButton}
          onClick={() => window.location.href = "/auth/gtaworld"}
        >
          {isAuthenticated ? `Signed in as ${characterName || user?.username}` : "Sign in with GTA:W"}
        </button>
        <button
            type="button"
            className={formStyles.bingoButton}
            onClick={() => setShowEmsBingoModal(true)}
            title="Open Bingo Night!"
        >
            <i className="fas fa-trophy"></i>
            Bingo Night!
        </button>
        
      </div>

      {/* ORIGINAL HEADER */}
      <div className={styles.header}>
        <h2>PHMC Tools - Form Generator and more!</h2>
      </div>

      {/* MAIN 3-COLUMN LAYOUT */}
      <div className={styles.mainLayout}>
        {/* LEFT: Form Picker */}
        <div className={styles.leftPanel}>
          <input
            type="text"
            placeholder="Search forms..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />

          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className={styles.categorySelect}
          >
            {categories.map(cat => (
              <option key={cat}>{cat}</option>
            ))}
          </select>

          <button
              onClick={() => setShowRestricted(prev => !prev)}
              className={`${formStyles.filterButton} ${showRestricted ? formStyles.active : ''}`}
              title={showRestricted ? "Hide forms requiring faction membership" : "Show forms requiring faction membership"}
          >
              {showRestricted ? 'Showing All Forms' : 'Show Restricted'}
          </button>

          <div className={styles.formList}>
            {filteredForms.map(form => (
              <div
                key={form.firebaseKey}
                onClick={() => {
                  setSelectedForm(form);
                  setFormValues({});
                  setGeneratedBBCode("");
                  setShowBBCode(false);
                }}
                className={`${styles.formCard} ${selectedForm?.firebaseKey === form.firebaseKey ? styles.selected : ""}`}
              >
                <div className={styles.formTitle}>{form.name}</div>
                <div className={styles.formCategory}>{form.category}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER: Selected Form */}
        <div className={styles.mainContent}>
          {!selectedForm ? (
            <div style={{ textAlign: "center", marginTop: "8rem", color: "#64748b" }}>
              <h3>Select a form from the left to begin</h3>
            </div>
          ) : (
            <>
              <h2 style={{ color: "#60a5fa", marginBottom: "2rem" }}>{selectedForm.name}</h2>

              <div style={{ margin: "0 -8px" }}>
                {selectedForm.fields?.map((field, index) => {
                  // Conditional visibility
if (field.showIf) {
  let shouldShow = false;

  if (field.showIf.mode === "and" || field.showIf.mode === "or") {
    // Multiple conditions
    const conditions = field.showIf.conditions || [];
    const results = conditions.map(cond => {
      const current = formValues[cond.field];
      if (cond.value === true) return !!current && current !== "";
      if (cond.value === false) return !current || current === "";
      return current === cond.value;
    });

    shouldShow = field.showIf.mode === "and"
      ? results.every(r => r)
      : results.some(r => r);
  } else if (field.showIf.conditions) {
    // Backwards compatibility
    shouldShow = field.showIf.conditions.every(cond => {
      const current = formValues[cond.field];
      if (cond.value === true) return !!current;
      if (cond.value === false) return !current;
      return current === cond.value;
    });
  } else {
    // Simple mode
    const current = formValues[field.showIf.field];
    if (field.showIf.value === true) shouldShow = !!current && current !== "";
    else if (field.showIf.value === false) shouldShow = !current || current === "";
    else shouldShow = current === field.showIf.value;
  }

  if (!shouldShow) return null;
}                

                  return (
                    <React.Fragment key={index}>
                      {field.type === "hr" && (
                        <div style={{ margin: "0 8px 1.5rem", width: "calc(100% - 16px)", boxSizing: "border-box" }}>
                          <hr style={{ borderTop: "1px solid #334155", margin: "1rem 0" }} />
                        </div>
                      )}

                      {field.type === "fake_line" && (
                        <div style={{ margin: "0 8px 1.5rem", width: "calc(100% - 16px)", boxSizing: "border-box" }}>
                          <hr style={{ borderTop: "1px dashed #334155", margin: "0", height: "1px" }} />
                        </div>
                      )}

                      {field.type === "small_header" && (
                        <div style={{ margin: "0 8px 1.5rem", width: "calc(100% - 16px)", boxSizing: "border-box" }}>
                          <h4 style={{ color: "#a78bfa", marginBottom: "1rem", marginTop: "1rem" }}>
                            {field.label}
                          </h4>
                        </div>
                      )}

                      {field.type === "timer" && (
                        <div
                          style={{
                            margin: "0 8px 1.5rem",
                            width: (field.layout === "compact") ? "calc(20% - 16px)" : "calc(100% - 16px)",
                            display: (field.buttonLabel) ? "flex" : "inline-block", // Use flex if button is present
                            verticalAlign: "top",
                            boxSizing: "border-box",
                            gap: (field.buttonLabel) ? "6px" : "0", // Add gap if button is present
                            alignItems: "center" // Align items in flex container
                          }}
                        >
                          <label style={{ display: (field.buttonLabel) ? "none" : "block", marginBottom: "0.5rem", fontWeight: "600", color: "#94a3b8" }}>
                            {field.label}
                          </label>
                          <input
                            type={field.timerType || 'text'}
                            name={field.name}
                            value={formValues[field.name] || ""}
                            onChange={e => handleChange(field.name, e.target.value)}
                            style={{ width: (field.buttonLabel) ? "auto" : "100%", flexGrow: (field.buttonLabel) ? "1" : "0", padding: "0.8rem", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8 }}
                          />
                          {field.buttonLabel && (
                            <button
                              onClick={() => {
                                if (field.buttonAction === "set_current_time") {
                                  const timeValue = field.timerType === 'datetime-local' ? getUtcFormattedDateTime() : getUtcFormattedTime();
                                  handleChange(field.name, timeValue); // Update the timer field itself
                                }
                              }}
                              style={{
                                padding: "0.5rem 1rem",
                                background: "#6366f1",
                                color: "white",
                                border: "none",
                                borderRadius: 8,
                                fontSize: "0.9rem",
                                fontWeight: "600",
                                flexShrink: 0
                              }}
                            >
                              {field.buttonLabel}
                            </button>
                          )}
                        </div>
                      )}

                      {/* SELECT */}
                      {field.type === "select" && (
                        <div
                          style={{
                            margin: "0 8px 1.5rem",
                            width: (field.layout === "compact") ? "calc(20% - 16px)" : "calc(100% - 16px)",
                            display: "inline-block",
                            verticalAlign: "top",
                            boxSizing: "border-box"
                          }}
                        >
                          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#94a3b8" }}>
                            {field.label}
                          </label>
                          {finalSelectOptions[field.optionsKey] && (
                            <select
                              value={formValues[field.name] || ""}
                              onChange={e => handleChange(field.name, e.target.value)}
                              style={{ width: "100%", padding: "0.8rem", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8 }}
                            >
                              <option value="">— Select —</option>
                              {Object.values(finalSelectOptions[field.optionsKey]).map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}

                      {/* TEXTAREA */}
                      {field.type === "textarea" && (
                        <div
                          style={{
                            margin: "0 8px 1.5rem",
                            width: (field.layout === "compact") ? "calc(20% - 16px)" : "calc(100% - 16px)",
                            display: "inline-block",
                            verticalAlign: "top",
                            boxSizing: "border-box"
                          }}
                        >
                          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#94a3b8" }}>
                            {field.label}
                          </label>
                          <textarea
                            rows={field.rows || 4}
                            value={formValues[field.name] || ""}
                            onChange={e => handleChange(field.name, e.target.value)}
                            placeholder={field.placeholder || ""}
                            style={{ width: "100%", padding: "0.8rem", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8 }}
                          />
                        </div>
                      )}

                      {/* IMAGE */}
                      {field.type === "image" && (
                        <div
                          style={{
                            margin: "0 8px 1.5rem",
                            width: (field.layout === "compact") ? "calc(20% - 16px)" : "calc(100% - 16px)",
                            display: "inline-block",
                            verticalAlign: "top",
                            boxSizing: "border-box"
                          }}
                        >
                          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#94a3b8" }}>
                            {field.label}
                          </label>
                          <ImageUploader
                            images={formValues[field.name] || []}
                            onImagesChange={imgs => handleChange(field.name, imgs)}
                            maxImages={field.maxImages || 6}
                          />
                        </div>
                      )}

                      {/* CHECKBOX */}
                      {field.type === "checkbox" && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            margin: "0 8px 1.5rem",
                            width: (field.layout === "compact") ? "calc(20% - 16px)" : "calc(100% - 16px)",
                            boxSizing: "border-box"
                          }}
                        >
                          <label style={{ display: "flex", alignItems: "center", cursor: "pointer", color: "#e2e8f0" }}>
                            <input
                              type="checkbox"
                              checked={!!formValues[field.name]}
                              onChange={e => handleChange(field.name, e.target.checked)}
                              style={{ marginRight: "0.8rem" }}
                            />
                            {field.label}
                          </label>
                          {formValues[field.name] && field.associatedInputField && (
                            <>
                              {field.associatedInputField.type === "select" && finalSelectOptions[field.associatedInputField.optionsKey] ? (
                                <select
                                  value={formValues[field.associatedInputField.name] || ""}
                                  onChange={e => handleChange(field.associatedInputField.name, e.target.value)}
                                  style={{ width: "100%", padding: "0.8rem", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8 }}
                                >
                                  <option value="">— Select —</option>
                                  {Object.values(finalSelectOptions[field.associatedInputField.optionsKey]).map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                              ) : field.associatedInputField.type === "textarea" ? (
                                <textarea
                                  rows={field.associatedInputField.rows || 1}
                                  value={formValues[field.associatedInputField.name] || ""}
                                  onChange={e => handleChange(field.associatedInputField.name, e.target.value)}
                                  placeholder={field.associatedInputField.placeholder || ""}
                                  style={{ width: "100%", padding: "0.8rem", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8 }}
                                />
                              ) : ( // Default to input type="text"
                                <input
                                  type={field.associatedInputField.type || 'text'}
                                  name={field.associatedInputField.name}
                                  value={formValues[field.associatedInputField.name] || ""}
                                  onChange={e => handleChange(field.associatedInputField.name, e.target.value)}
                                  placeholder={field.associatedInputField.placeholder || ""}
                                  style={{ width: "100%", padding: "0.8rem", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8 }}
                                />
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {/* RADIO */}
                      {field.type === "radio" && (
                        <div
                          style={{
                            margin: "0 8px 1.5rem",
                            width: (field.layout === "compact") ? "calc(20% - 16px)" : "calc(100% - 16px)",
                            display: "inline-block", // Use inline-block for compact radio groups
                            verticalAlign: "top",
                            boxSizing: "border-box"
                          }}
                        >
                          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#94a3b8" }}>
                            {field.label}
                          </label>
                          <div style={{ display: (field.layout === "compact") ? "inline-flex" : "flex", flexWrap: (field.layout === "compact") ? "nowrap" : "wrap", gap: "10px" }}>
                            {field.options.map(option => (
                              <label key={option} style={{ display: "flex", alignItems: "center", cursor: "pointer", color: "#e2e8f0" }}>
                                <input
                                  type="radio"
                                  name={field.name}
                                  value={option}
                                  checked={formValues[field.name] === option}
                                  onChange={e => handleChange(field.name, e.target.value)}
                                  style={{ marginRight: "0.5rem" }}
                                />
                                {option}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* INPUT BUTTON COMBO */}
                      {field.type === "input_button_combo" && (
                        <div
                          style={{
                            margin: "0 8px 1.5rem",
                            width: (field.layout === "compact") ? "calc(20% - 16px)" : "calc(100% - 16px)",
                            display: "inline-flex", // Use inline-flex for compact
                            flexDirection: (field.layout === "compact") ? "row" : "column", // row for compact
                            alignItems: (field.layout === "compact") ? "center" : "stretch", // center for compact
                            gap: "6px",
                            verticalAlign: "top",
                            boxSizing: "border-box"
                          }}
                        >
                          <label style={{ fontWeight: "600", color: "#94a3b8", flexShrink: 0 }}>
                            {field.label}
                          </label>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%' }}>
                            <input
                              type={field.inputType || 'text'}
                              name={field.name}
                              value={formValues[field.name] || ""}
                              onChange={e => handleChange(field.name, e.target.value)}
                              style={{ width: "100%", flexGrow: 1, padding: "0.8rem", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8 }}
                            />
                            <button
                              onClick={() => {
                                if (field.buttonAction === "set_current_time") {
                                  const timeValue = field.inputType === 'datetime-local' ? getUtcFormattedDateTime() : getUtcFormattedTime();
                                  handleChange(field.name, timeValue);
                                }
                              }}
                              style={{
                                padding: "0.5rem 1rem",
                                background: "#6366f1",
                                color: "white",
                                border: "none",
                                borderRadius: 8,
                                fontSize: "0.9rem",
                                fontWeight: "600",
                                flexShrink: 0
                              }}
                            >
                              {field.buttonLabel}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* DEFAULT INPUT (if type is not explicitly set or is 'input') */}
                      {(!field.type || field.type === "input") && (
                        <div
                          style={{
                            margin: "0 8px 1.5rem",
                            width: (field.layout === "compact") ? "calc(20% - 16px)" : "calc(100% - 16px)",
                            display: "inline-block",
                            verticalAlign: "top",
                            boxSizing: "border-box"
                          }}
                        >
                          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#94a3b8" }}>
                            {field.label}
                          </label>
                          <input
                            type="text"
                            value={formValues[field.name] || ""}
                            onChange={e => handleChange(field.name, e.target.value)}
                            placeholder={field.placeholder || ""}
                            style={{ width: "100%", padding: "0.8rem", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8 }}
                          />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              <div style={{ textAlign: "center", margin: "3rem 0" }}>
                <button
                  onClick={generateBBCode}
                  className={formStyles.generateButton}
                >
                  Generate BBCode
                </button>
              </div>
            </>
          )}
        </div>

        {/* RIGHT PANEL — ALWAYS VISIBLE */}
        <div className={styles.rightPanel}>
          <div style={{ background: "linear-gradient(135deg, #2d1b69, #1e1b4b)", padding: "1.5rem", borderRadius: 12, marginBottom: "1.5rem" }}>
            <h3 style={{ color: "#a78bfa", margin: "0 0 1rem" }}>Signed in as</h3>
            <div style={{ fontWeight: "700", fontSize: "1.3rem", color: "#e2e8f0" }}>
              {characterName || user?.username || "Not signed in"}
            </div>
            {isPhmcMember && <div style={{ color: "#34d399", marginTop: "0.5rem" }}>PHMC Member • Rank {factionRank}</div>}
          </div>

          <button
            onClick={() => setShowBBCode(!showBBCode)}
            className={formStyles.rightPanelButton}
          >
            {showBBCode ? "Hide" : "Show"} BBCode Preview
          </button>

          <button
            onClick={copyAndSaveReport}
            disabled={!generatedBBCode}
            className={`${formStyles.rightPanelButton} ${generatedBBCode ? formStyles.copy : ''}`}
          >
            {generatedBBCode ? "Copy BBCode + Save" : "No BBCode Yet"}
          </button>

          {showBBCode && generatedBBCode && (
            <>
              {generatedTitle && (
                <div style={{ background: "#0f172a", padding: "1.5rem", borderRadius: 12, color: "#e2e8f0", fontSize: "1.1rem", fontWeight: "700", marginBottom: "1rem", whiteSpace: "pre-wrap" }}>
                  {generatedTitle}
                </div>
              )}
              <pre style={{ background: "#0f172a", padding: "1.5rem", borderRadius: 12, color: "#e2e8f0", fontSize: "0.9rem", maxHeight: "60vh", overflow: "auto", marginTop: "1rem", whiteSpace: "pre-wrap" }}>
                {generatedBBCode}
              </pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FormHandler;
