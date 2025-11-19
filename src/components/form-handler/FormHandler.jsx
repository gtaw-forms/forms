// src/components/form-handler/FormHandler.jsx
import React, { useState, useEffect, useCallback } from "react";
import { database } from "../../firebase";
import { ref, onValue } from "firebase/database";
import useGtaWorldAuth from "../../hooks/useGtaWorldAuth";
import styles from "../ems-dashboard/EmsDashboard.module.css";
import ImageUploader from './ImageUploader';
import { useModal } from "../../contexts/ModalProvider";
import EmsBingoModal from '../EmsBingoModal';
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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [generatedBBCode, setGeneratedBBCode] = useState("");
  const [showBBCode, setShowBBCode] = useState(false);

  const [selectOptions, setSelectOptions] = useState({});
  const finalSelectOptions = { ...selectOptions, ...authSelectOptions };

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
        showEasterEggModal, setShowEasterEggModal,
        easterEggType, setEasterEggType,
        showAgencySelector, setShowAgencySelector,
        hideAgencySelector, setHideAgencySelector,
        showEmployeeModal, setShowEmployeeModal,
        showEmsAmaModal, setShowEmsAmaModal,
        showBusinessCard, setShowBusinessCard,
        showAgencyGroupSelectorModal, setShowAgencyGroupSelectorModal,
        showCctvRequestModal, setShowCctvRequestModal,
        showPHMCModal, setShowPHMCModal,
        switchableModalTitle, setSwitchableModalTitle,
        switchableFormsList, setSwitchableFormsList,
        showFeatureRequestModal, setShowFeatureRequestModal
    } = useModal();
  const categories = ["All", ...new Set(forms.map(f => f.category || "Uncategorized"))];

  const filteredForms = forms.filter(form => {
    const matchesSearch = form.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         form.category?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || form.category === selectedCategory;
    if (form.factionRequired && !isPhmcMember) return false;
    return matchesSearch && matchesCategory;
  });

  const handleChange = useCallback((name, value) => {
    setFormValues(prev => ({ ...prev, [name]: value }));
  }, []);

  const generateBBCode = () => {
    if (!selectedForm?.template) return;
    let bbcode = selectedForm.template;

    selectedForm.fields?.forEach(field => {
      if (field.type === "hr") {
        bbcode += "\n[hr]\n"; // Append [hr] directly without placeholder replacement
        return; // Move to next field
      }

      const placeholder = `{{${field.name}}}`;

      if (field.type === "small_header") {
        bbcode = bbcode.replace(new RegExp(placeholder, "g"), `[size=10][b]${field.label}[/b][/size]`);
      } else {
        const value = formValues[field.name] ?? "";

        if (field.type === "image") {
          if (value) { // Check if value is not empty string
            const imageUrls = value.split(', '); // Split the comma-separated string into an array
            const imagesBBCode = imageUrls.map(url => `[img]${url}[/img]`).join(",");
            bbcode = bbcode.replace(new RegExp(placeholder, "g"), imagesBBCode);
          } else {
            bbcode = bbcode.replace(new RegExp(placeholder, "g"), "[No images]");
          }
        } else if (field.type === "checkbox") {
          bbcode = bbcode.replace(new RegExp(placeholder, "g"), value ? "Yes" : "No");
        } else {
          bbcode = bbcode.replace(new RegExp(placeholder, "g"), value || "");
        }
      }
    });

    setGeneratedBBCode(bbcode);
    setShowBBCode(true);
  };

  const copyAndSaveReport = () => {
    if (!generatedBBCode) return;
    navigator.clipboard.writeText(generatedBBCode);
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
            style={{
              padding: "12px 24px",
              background: "#8b5cf6",
              color: "white",
              border: "none",
              borderRadius: 12,
              fontWeight: "700",
              fontSize: "1rem",
              boxShadow: "0 4px 12px rgba(139,92,246,0.4)",
              cursor: "pointer"
            }}
            onClick={() => window.location.href = "/admin"}
          >
            Admin Panel
          </button>
        )}
        {isPhmcMember && (
          <button
            style={{
              padding: "12px 24px",
              background: "#8b5cf6",
              color: "white",
              border: "none",
              borderRadius: 12,
              fontWeight: "700",
              fontSize: "1rem",
              boxShadow: "0 4px 12px rgba(139,92,246,0.4)",
              cursor: "pointer"
            }}
            onClick={() => window.location.href = "/ems-dashboard"}
          >
            EMS Dashboard
          </button>
        )}
        <button
          style={{
            padding: "12px 24px",
            background: "#8b5cf6",
            color: "white",
            border: "none",
            borderRadius: 12,
            fontWeight: "700",
            fontSize: "1rem",
            boxShadow: "0 4px 12px rgba(139,92,246,0.4)",
            cursor: "pointer"
          }}
          onClick={() => window.location.href = "/auth/gtaworld"}
        >
          {isAuthenticated ? `Signed in as ${characterName || user?.username}` : "Sign in with GTA:W"}
        </button>
                        <button
                            type="button"
                            variant="warning"
                            className="changelog-button"
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

                      {field.type === "small_header" && (
                        <div style={{ margin: "0 8px 1.5rem", width: "calc(100% - 16px)", boxSizing: "border-box" }}>
                          <h4 style={{ color: "#a78bfa", marginBottom: "1rem", marginTop: "1rem" }}>
                            {field.label}
                          </h4>
                        </div>
                      )}

                      {field.type !== "hr" && field.type !== "small_header" && (
                        <div
                          style={{
                            margin: "0 8px 1.5rem",
                            width: (field.layout === "compact" && field.type !== "checkbox") ? "calc(20% - 16px)" : "calc(100% - 16px)",
                            display: "inline-block",
                            verticalAlign: "top",
                            boxSizing: "border-box"
                          }}
                        >
                          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#94a3b8" }}>
                            {field.label}
                          </label>

                          {/* SELECT */}
                          {field.type === "select" && finalSelectOptions[field.optionsKey] && (
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

                          {/* TEXTAREA */}
                          {field.type === "textarea" && (
                            <textarea
                              rows={field.rows || 4}
                              value={formValues[field.name] || ""}
                              onChange={e => handleChange(field.name, e.target.value)}
                              placeholder={field.placeholder || ""}
                              style={{ width: "100%", padding: "0.8rem", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8 }}
                            />
                          )}

                          {/* IMAGE */}
                          {field.type === "image" && (
                            <ImageUploader
                              images={formValues[field.name] || []}
                              onImagesChange={imgs => handleChange(field.name, imgs)}
                              maxImages={field.maxImages || 6}
                            />
                          )}

                          {/* CHECKBOX */}
                          {field.type === "checkbox" && (
                            <label style={{ display: "flex", alignItems: "center", cursor: "pointer", color: "#e2e8f0" }}>
                              <input
                                type="checkbox"
                                checked={!!formValues[field.name]}
                                onChange={e => handleChange(field.name, e.target.checked)}
                                style={{ marginRight: "0.8rem" }}
                              />
                              {field.label}
                            </label>
                          )}

                          {/* DEFAULT INPUT */}
                          {(!field.type || field.type === "input") && (
                            <input
                              type="text"
                              value={formValues[field.name] || ""}
                              onChange={e => handleChange(field.name, e.target.value)}
                              placeholder={field.placeholder || ""}
                              style={{ width: "100%", padding: "0.8rem", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8 }}
                            />
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              <div style={{ textAlign: "center", margin: "3rem 0" }}>
                <button
                  onClick={generateBBCode}
                  style={{ padding: "1.2rem 4rem", background: "#6366f1", color: "white", border: "none", borderRadius: 16, fontSize: "1.3rem", fontWeight: "700" }}
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
            style={{ width: "100%", padding: "1rem", background: "#475569", color: "white", border: "none", borderRadius: 8, marginBottom: "1rem" }}
          >
            {showBBCode ? "Hide" : "Show"} BBCode Preview
          </button>

          <button
            onClick={copyAndSaveReport}
            disabled={!generatedBBCode}
            style={{ width: "100%", padding: "1rem", background: generatedBBCode ? "#10b981" : "#475569", color: "white", border: "none", borderRadius: 8 }}
          >
            {generatedBBCode ? "Copy BBCode + Save" : "No BBCode Yet"}
          </button>

          {showBBCode && generatedBBCode && (
            <pre style={{ background: "#0f172a", padding: "1.5rem", borderRadius: 12, color: "#e2e8f0", fontSize: "0.9rem", maxHeight: "60vh", overflow: "auto", marginTop: "1rem", whiteSpace: "pre-wrap" }}>
              {generatedBBCode}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

export default FormHandler;