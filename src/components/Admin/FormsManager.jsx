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
                  key={form.id}
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
          <div style={{ textAlign: "center", marginTop: "4rem", color: "#64748b" }}>
            <h2>Select a form to preview or edit</h2>
            <p style={{ fontSize: "1.2rem", marginTop: "1rem" }}>
              Total Forms: <strong>{forms.length}</strong>
            </p>
          </div>
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