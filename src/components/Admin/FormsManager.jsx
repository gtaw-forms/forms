// src/components/admin/FormManager.jsx
import React, { useState, useEffect } from "react";
import { database } from "../../firebase";
import { ref, onValue } from "firebase/database";
import AddFormModal from "./AddFormModal";
import styles from "../ems-dashboard/EmsDashboard.module.css";

const FormManager = () => {
  const [forms, setForms] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingForm, setEditingForm] = useState(null);
  const [previewingForm, setPreviewingForm] = useState(null);

  useEffect(() => {
    const formsRef = ref(database, "forms");
    const unsub = onValue(formsRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.keys(data).map(key => ({
        ...data[key],
        firebaseKey: key
      }));
      setForms(list);
    });
    return () => unsub();
  }, []);

  const categories = ["All", ...new Set(forms.map(f => f.category || "Uncategorized"))];

  const filteredForms = forms.filter(form => {
    const matchesSearch = form.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || form.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const openEditModal = (form) => {
    setEditingForm(form);
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingForm(null);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>
          <span style={{ color: "#8b5cf6" }}>Form Manager</span> — Admin Panel
        </h1>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: "0.8rem 2rem",
            background: "#10b981",
            color: "white",
            border: "none",
            borderRadius: 12,
            fontWeight: "700",
            fontSize: "1.1rem",
            cursor: "pointer"
          }}
        >
          + Add New Form
        </button>
      </div>

      <div className={styles.mainLayout}>
        {/* LEFT PANEL — Form List */}
        <div className={styles.leftPanel}>
          <input
            type="text"
            placeholder="Search forms..."
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <div style={{ margin: "1rem 0" }}>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem",
                background: "#1e293b",
                border: "1px solid #334155",
                color: "#e2e8f0",
                borderRadius: 8
              }}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: "0.5rem" }}>
            {filteredForms.length === 0 ? (
              <div style={{ textAlign: "center", color: "#64748b", padding: "2rem" }}>
                No forms found
              </div>
            ) : (
              filteredForms.map((form) => (
                <div
                  key={form.firebaseKey}
                  onClick={() => setPreviewingForm(form)}
                  style={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 12,
                    padding: "1rem",
                    margin: "0.8rem 0",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    position: "relative"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#334155"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "#1e293b"}
                >
                  <div style={{ fontWeight: "700", fontSize: "1.1rem", color: "#e2e8f0" }}>
                    {form.name}
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#94a3b8", margin: "0.4rem 0" }}>
                    {form.category || "Uncategorized"}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: form.factionRequired ? "#f87171" : "#34d399" }}>
                    {form.factionRequired ? "PHMC Only" : "Public"}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(form);
                    }}
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      padding: "0.5rem 1rem",
                      background: "#6366f1",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      fontSize: "0.9rem",
                      fontWeight: "600"
                    }}
                  >
                    Edit Form
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CENTER — Preview */}
        <div className={styles.mainContent}>
          {previewingForm ? (
            <div>
              <h2 style={{ color: '#60a5fa', marginBottom: '2rem' }}>{previewingForm.name}</h2>
              <div style={{ background: '#0f172a', padding: '2rem', borderRadius: 12 }}>
                {previewingForm.fields?.map((field, index) => (
                  <div key={index} style={{ marginBottom: '1.5rem' }}>
                    {field.type === 'hr' ? (
                      <hr style={{ borderTop: "1px solid #334155", margin: "1rem 0" }} />
                    ) : field.type === 'fake_line' ? (
                      <hr style={{ borderTop: "1px dashed #334155", margin: "1rem 0" }} />
                    ) : field.type === 'small_header' ? (
                      <h4 style={{ color: "#a78bfa", marginBottom: "1rem" }}>{field.label}</h4>
                    ) : (
                      <>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#94a3b8' }}>
                          {field.label}
                          {field.displayCurrentTime && field.type === "timer" && (
                            <span style={{ fontSize: '0.7em', marginLeft: '5px', color: '#6c757d' }}> (Server Time)</span>
                          )}
                        </label>
                        {field.type === 'textarea' ? (
                          <textarea
                            rows={field.rows || 3}
                            placeholder={field.placeholder || 'Textarea Input'}
                            style={{ width: '100%', padding: '0.8rem', background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 8 }}
                            readOnly
                          />
                        ) : field.type === 'select' ? (
                          <select
                            style={{ width: '100%', padding: '0.8rem', background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 8 }}
                            disabled
                          >
                            <option>{`Dropdown: ${field.optionsKey || 'No Options Key'}`}</option>
                          </select>
                        ) : field.type === 'checkbox' ? (
                          <div style={{ display: 'flex', alignItems: 'center', color: '#e2e8f0' }}>
                            <input type="checkbox" readOnly style={{ marginRight: '0.5rem' }} />
                            <span>Checkbox</span>
                            {field.associatedInputField && (
                              <span style={{ marginLeft: '10px', fontSize: '0.9em', color: '#94a3b8' }}>
                                (Associated: {field.associatedInputField.type})
                              </span>
                            )}
                          </div>
                        ) : field.type === 'radio' ? (
                          <div style={{ display: 'flex', gap: '10px', color: '#e2e8f0' }}>
                            {field.options?.map((option, optIndex) => (
                              <label key={optIndex} style={{ display: 'flex', alignItems: 'center' }}>
                                <input type="radio" name={field.name} readOnly style={{ marginRight: '0.5rem' }} />
                                {option}
                              </label>
                            ))}
                            {!field.options?.length && <span style={{ color: '#94a3b8' }}>(No options defined)</span>}
                          </div>
                        ) : field.type === 'image' ? (
                          <div style={{ padding: '0.8rem', background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 8 }}>
                            Image Upload (Max {field.maxImages || 6})
                          </div>
                        ) : field.type === 'timer' ? (
                          <input
                            type={field.timerType || 'text'}
                            placeholder={`Timer: ${field.timerType || 'Text'}${field.buttonLabel ? ` (Button: ${field.buttonLabel})` : ''}`}
                            style={{ width: '100%', padding: '0.8rem', background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 8 }}
                            readOnly
                          />
                        ) : field.type === 'input_button_combo' ? (
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <input
                              type={field.inputType || 'text'}
                              placeholder={`Input (${field.inputType || 'text'})`}
                              style={{ width: '100%', padding: '0.8rem', background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 8 }}
                              readOnly
                            />
                            <button style={{ padding: "0.5rem 1rem", background: "#6366f1", color: "white", border: "none", borderRadius: 8 }} disabled>
                              {field.buttonLabel || 'Button'}
                            </button>
                          </div>
                        ) : (
                          <input
                            type={field.type || 'text'} // Fallback for 'input' or unknown types
                            placeholder={field.placeholder || 'Text Input'}
                            style={{ width: '100%', padding: '0.8rem', background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 8 }}
                            readOnly
                          />
                        )}
                      </>
                    )}
                  </div>
                ))}
                {!previewingForm.fields || previewingForm.fields.length === 0 ? (
                  <p style={{ color: '#64748b' }}>This form has no fields defined.</p>
                ) : null}
              </div>
              <div style={{ marginTop: '2rem', borderTop: '1px solid #334155', paddingTop: '2rem' }}>
                <h3 style={{ color: '#94a3b8' }}>BBCode Template</h3>
                <pre style={{ background: '#0f172a', padding: '1.5rem', borderRadius: 12, color: '#e2e8f0', fontSize: '0.9rem', whiteSpace: 'pre-wrap', maxHeight: '400px', overflow: 'auto' }}>
                  {previewingForm.template || 'No template provided.'}
                </pre>
              </div>
              <div style={{ marginTop: '2rem', borderTop: '1px solid #334155', paddingTop: '2rem' }}>
                <h3 style={{ color: '#94a3b8' }}>Title Generator Code</h3>
                <pre style={{ background: '#0f172a', padding: '1.5rem', borderRadius: 12, color: '#e2e8f0', fontSize: '0.9rem', whiteSpace: 'pre-wrap', maxHeight: '400px', overflow: 'auto' }}>
                  {previewingForm.titleGeneratorCode || 'No title generator code provided.'}
                </pre>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', marginTop: '4rem', color: '#64748b' }}>
              <h2>Select a form to preview or edit</h2>
              <p style={{ fontSize: '1.2rem', marginTop: '1rem' }}>
                Total Forms: <strong>{forms.length}</strong>
              </p>
            </div>
          )}
        </div>
        {/* RIGHT PANEL — Stats */}
        <div className={styles.rightPanel}>
          <h2 style={{ color: "#8b5cf6" }}>Form Access Rules</h2>
          <div style={{ background: "#1e293b", padding: "1.5rem", borderRadius: 12, marginBottom: "1rem" }}>
            <div style={{ color: "#f87171", fontWeight: "700" }}>PHMC Only</div>
            <div style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
              Requires GTA:W OAuth + PHMC faction membership
            </div>
          </div>
          <div style={{ background: "#1e293b", padding: "1.5rem", borderRadius: 12 }}>
            <div style={{ color: "#34d399", fontWeight: "700" }}>Public</div>
            <div style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
              Available to all authenticated users
            </div>
          </div>
        </div>
      </div>

      {/* MODAL */}
      <AddFormModal
        show={showAddModal}
        onClose={closeModal}
        editingForm={editingForm}
      />
    </div>
  );
};

export default FormManager;