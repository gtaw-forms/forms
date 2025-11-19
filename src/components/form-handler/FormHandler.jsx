// src/components/form-handler/FormHandler.jsx
import React, { useState, useEffect, useCallback } from "react";
import { database } from "../../firebase";
import { ref, set, onValue } from "firebase/database";
import { ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";
import useGtaWorldAuth from "../../hooks/useGtaWorldAuth";
import styles from "../ems-dashboard/EmsDashboard.module.css";

const FormHandler = () => {
  const { 
    user, 
    isAuthenticated, 
    isPhmcMember,
    characterName,
    factionRank,
  } = useGtaWorldAuth();

  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [generatedBBCode, setGeneratedBBCode] = useState("");
  const [showBBCode, setShowBBCode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectOptions, setSelectOptions] = useState({});
useEffect(() => {
  const optionsRef = ref(database, "selectOptions");
  const unsub = onValue(optionsRef, (snap) => {
    const data = snap.val();
    if (data) {
      setSelectOptions(data);
    }
  });
  return () => unsub();
}, []);
  // Load forms from Firebase
  useEffect(() => {
    const formsRef = ref(database, "forms");
    const unsub = onValue(formsRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.keys(data).map(key => ({ ...data[key], firebaseKey: key }));
      setForms(list);
    });
    return () => unsub();
  }, []);

  const categories = ["All", ...new Set(forms.map(f => f.category || "Uncategorized"))];

  const filteredForms = forms.filter(form => {
    const matchesSearch = form.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         form.category?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || form.category === selectedCategory;

    // Enforce factionRequired
    if (form.factionRequired && !isPhmcMember) return false;

    return matchesSearch && matchesCategory;
  });

  const handleChange = useCallback((name, value) => {
    setFormValues(prev => {
      const updated = { ...prev, [name]: value };

      // Auto-save draft locally
      localStorage.setItem(
        `draft_${selectedForm?.id || 'unknown'}_${user?.id || 'guest'}`,
        JSON.stringify({ values: updated, formId: selectedForm?.id, savedAt: new Date().toISOString() })
      );

      generateBBCode(updated);
      return updated;
    });
  }, [selectedForm, user]);

  const generateBBCode = (values) => {
    if (!selectedForm?.template) {
      setGeneratedBBCode("");
      return;
    }
    let bbcode = selectedForm.template;
    selectedForm.fields?.forEach(field => {
      const val = values[field.name] || "";
      bbcode = bbcode.replace(new RegExp(`{{${field.name}}}`, "g"), val);
    });
    setGeneratedBBCode(bbcode);
  };

  // AUTO-SAVE ON COPY — FINAL VERSION
  const copyAndSaveReport = async () => {
    if (!generatedBBCode) return;

    try {
      // 1. Copy to clipboard
      await navigator.clipboard.writeText(generatedBBCode);

      // 2. Only save if authenticated
      if (!isAuthenticated || !user?.id) {
        alert("Copied! (Login required to save reports)");
        return;
      }

      setIsSaving(true);

      const userId = user.id.toString();
      const patientName = formValues.patientName || formValues.decedentName || "Unknown_Patient";
      const patientDOB = formValues.patientDOB || formValues.dateOfBirth || "No_DOB";
      const reportKey = `${patientName} - ${patientDOB}`.trim();

      const timestamp = Date.now();

      const reportData = {
        authorName: characterName || user.username,
        authorId: user.id,
        authorRank: factionRank || 0,
        bbCodeVersion: selectedForm.id,
        data: formValues,
        originalKey: reportKey,
        timestamp,
        formName: selectedForm.name
      };

      const bbCodeOnly = {
        authorName: characterName || user.username,
        bbCode: generatedBBCode,
        timestamp,
        formName: selectedForm.name
      };

      // Save both — your old system stays 100% compatible
      await Promise.all([
        set(ref(database, `forms/savedReports/${userId}/${reportKey}`), reportData),
        set(ref(database, `forms/savedReportsBBCode/${userId}/${reportKey}`), bbCodeOnly)
      ]);

      console.log("Report saved:", reportKey);
      alert("Copied & Saved!");
    } catch (err) {
      console.error("Save failed:", err);
      alert("Copied! (Save failed)");
    } finally {
      setIsSaving(false);
    }
  };
// Helper to take while condition
Array.prototype.takeWhile = function(predicate) {
  const result = [];
  for (const item of this) {
    if (!predicate(item)) break;
    result.push(item);
  }
  return result;
};
  // Auto-load draft on form select
  useEffect(() => {
    if (!selectedForm || !user?.id) {
      setFormValues({});
      return;
    }

    const draftKey = `draft_${selectedForm.id}_${user.id}`;
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      const draft = JSON.parse(saved);
      setFormValues(draft.values || {});
      generateBBCode(draft.values || {});
    } else {
      setFormValues({});
      setGeneratedBBCode("");
    }
  }, [selectedForm, user?.id]);

  return (
    <div className={styles.container}>
      {/* OAuth Button */}
      <button
        style={{ position: "fixed", top: 20, right: 20, zIndex: 1000, padding: "12px 24px", background: "#8b5cf6", color: "white", border: "none", borderRadius: 12, fontWeight: "700" }}
        onClick={() => window.location.href = "/auth/gtaworld"} // or your login route
      >
        {isAuthenticated ? `Signed in as ${characterName || user?.username}` : "Sign in with GTA:W"}
      </button>

      {/* Rest of your layout */}
      <div className={styles.header}>
        <h2>PHMC Tools - Form Generator and more!</h2>
      </div>

      <div className={styles.mainLayout}>
        {/* LEFT: Form Picker */}
        <div className={styles.leftPanel}>
          <input
            type="text"
            placeholder="Search forms..."
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ width: "100%", padding: "0.75rem", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8, margin: "1rem 0" }}
          >
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>

          {filteredForms.map(form => (
            <div
              key={form.id}
              onClick={() => setSelectedForm(form)}
              style={{
                background: selectedForm?.id === form.id ? "#6366f1" : "#334155",
                color: "white",
                padding: "1rem",
                borderRadius: 10,
                margin: "0.5rem 0",
                cursor: "pointer"
              }}
            >
              <div style={{ fontWeight: "600" }}>{form.name}</div>
              <small>{form.category}</small>
              {form.factionRequired && <span style={{ color: "#f87171", fontSize: "0.8rem" }}> PHMC Only</span>}
            </div>
          ))}
        </div>

        {/* CENTER: Form */}
        <div className={styles.mainContent}>
<div style={{ margin: "0 -1%" }}> {/* Negative margin to offset padding */}
  {selectedForm?.fields?.map((field, index) => {
    const isCompact = field.layout === "compact";
    const isFirstInRow = index === 0 || 
      selectedForm.fields[index - 1]?.layout !== "compact" || 
      selectedForm.fields[index - 1]?.layout === "full";

    const compactFieldsInRow = selectedForm.fields
      .slice(index)
      .takeWhile(f => f.layout === "compact")
      .length;

    // Only apply 33% if it's a compact field
    if (!isCompact) {
      return (
        <div key={index} style={{ marginBottom: "2rem", clear: "both" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#94a3b8" }}>
            {field.label || field.name}
          </label>

          {field.type === "image" && (
            <ImageUploader
              images={formValues[field.name] || []}
              onImagesChange={(imgs) => handleChange(field.name, imgs)}
              maxImages={field.maxImages || 6}
            />
          )}

          {field.type === "textarea" && (
            <textarea
              rows={field.rows || 5}
              value={formValues[field.name] || ""}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder={field.placeholder || ""}
              style={{ width: "100%", padding: "1rem", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8 }}
            />
          )}

          {field.type === "checkbox" && (
            <label style={{ display: "flex", alignItems: "center", cursor: "pointer", color: "#e2e8f0" }}>
              <input type="checkbox" checked={!!formValues[field.name]} onChange={(e) => handleChange(field.name, e.target.checked)} style={{ marginRight: "0.8rem" }} />
              {field.label}
            </label>
          )}

          {(!field.type || field.type === "input") && (
            <input
              type="text"
              value={formValues[field.name] || ""}
              onChange={(e) => handleChange(field.name, e.target.value)}
              placeholder={field.placeholder || ""}
              style={{ width: "100%", padding: "1rem", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8 }}
            />
          )}
{field.type === "select" && (
  <>
    {selectOptions?.[field.optionsKey] ? (
      <select
        value={formValues[field.name] || ""}
        onChange={(e) => handleChange(field.name, e.target.value)}
        style={{
          width: "100%",
          padding: "0.8rem",
          background: "#1e293b",
          border: "1px solid #334155",
          color: "#e2e8f0",
          borderRadius: 8,
          fontSize: "0.95rem"
        }}
      >
        <option value="">— Select {field.label.toLowerCase()} —</option>
        {Object.values(selectOptions[field.optionsKey]).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    ) : (
      <div style={{ color: "#ef4444", fontSize: "0.9rem", padding: "0.8rem" }}>
        Warning: No options found for key: <strong>{field.optionsKey}</strong>
      </div>
    )}
  </>
)}        </div>
      );
    }
    // Compact field — 33% width
    return (
      <div
        key={index}
        style={{
          width: "32%",
          margin: "0 0.666% 1.5rem",
          display: "inline-block",
          verticalAlign: "top",
          boxSizing: "border-box",
          float: "left",
          clear: isFirstInRow ? "both" : "none"
        }}
      >
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#94a3b8", fontSize: "0.95rem" }}>
          {field.label || field.name}
        </label>

        {field.type === "textarea" ? (
          <textarea
            rows={field.rows || 3}
            value={formValues[field.name] || ""}
            onChange={(e) => handleChange(field.name, e.target.value)}
            placeholder={field.placeholder || ""}
            style={{ width: "100%", padding: "0.7rem", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8, fontSize: "0.95rem" }}
          />
        ) : (
          <input
            type="text"
            value={formValues[field.name] || ""}
            onChange={(e) => handleChange(field.name, e.target.value)}
            placeholder={field.placeholder || ""}
            style={{ width: "100%", padding: "0.7rem", background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8, fontSize: "0.95rem" }}
          />
        )}
      </div>
    );
  })}
</div>
     <button
            onClick={copyAndSaveReport}
            disabled={!generatedBBCode || isSaving}
            style={{
              padding: "1.2rem 3rem",
              background: generatedBBCode ? "#10b981" : "#475569",
              color: "white",
              border: "none",
              borderRadius: 16,
              fontSize: "1.2rem",
              fontWeight: "700",
              cursor: generatedBBCode ? "pointer" : "not-allowed"
            }}
          >
            {isSaving ? "Saving..." : "Copy BBCode + Save Report"}
          </button>
        </div>

        {/* RIGHT: BBCode + User */}
        <div className={styles.rightPanel}>
          <div style={{ background: "linear-gradient(135deg, #1e293b, #0f172a)", padding: "1.5rem", borderRadius: 12, marginBottom: "1rem" }}>
            <h3 style={{ color: "#60a5fa" }}>Signed in as</h3>
            <div style={{ fontWeight: "700", fontSize: "1.4rem" }}>
              {characterName || user?.username || "Not signed in"}
            </div>
            {isPhmcMember && <div style={{ color: "#34d399" }}>PHMC Member • Rank {factionRank}</div>}
          </div>

          <button onClick={() => setShowBBCode(!showBBCode)}>
            {showBBCode ? "Hide" : "Show"} BBCode
          </button>

          {showBBCode && (
            <pre style={{ background: "#0f172a", padding: "1.5rem", borderRadius: 12, color: "#e2e8f0", maxHeight: "60vh", overflow: "auto" }}>
              {generatedBBCode || "No BBCode yet..."}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

export default FormHandler;