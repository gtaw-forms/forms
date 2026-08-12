// src/components/admin/FormManager.jsx
import { logAdminAction, getUserContext } from '../../utils/logging';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import React, { useState, useEffect } from "react";
import { database, deleteForm } from "../../firebase";
import { ref, onValue, update } from "firebase/database";
import AddFormModal from "./AddFormModal";
import styles from "./FormManager.module.css";
import { useNotification } from '../../contexts/NotificationContext';
import { resolveStagingPath } from '../../utils/stagingPath';

const FormManager = ({ currentUser }) => {
  const { user: gtawUser, username: gtawUsername } = useGtaWorldAuth();
  const [forms, setForms] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingForm, setEditingForm] = useState(null);
  const [previewingForm, setPreviewingForm] = useState(null);
  const [isDuplicate, setIsDuplicate] = useState(false);

  const { showNotification } = useNotification(); 

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
    setIsDuplicate(false);
    setShowAddModal(true);
  };

  const openDuplicateModal = (form) => {
    setEditingForm(form);
    setIsDuplicate(true);
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingForm(null);
    setIsDuplicate(false);
  };

  const handleFixBBCode = async () => {
    if (!window.confirm("Are you sure you want to scan all forms and replace [b] tags with [bold]? This will modify the database.")) {
      return;
    }

    let updatedCount = 0;
    const updates = {};

    forms.forEach(form => {
      if (form.template && (form.template.includes('[b]') || form.template.includes('[/b]'))) {
        const newTemplate = form.template
          .replace(/\[b\]/gi, '[bold]')
          .replace(/\[\/b\]/gi, '[/bold]');
        
        const formsBase = resolveStagingPath('forms');

        updates[`${formsBase}/${form.firebaseKey}/template`] = newTemplate;
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      try {
        await update(ref(database), updates);
        showNotification(`Successfully updated BBCode in ${updatedCount} forms!`, 'success');
        
        const { userAgent, timeZone } = getUserContext();
        logAdminAction(
            currentUser?.email || gtawUsername,
            'Bulk Fix BBCode',
            `Replaced [b] with [bold] in ${updatedCount} forms.`,
            'Form Management',
            userAgent,
            timeZone,
            gtawUsername,
            gtawUser
        );

      } catch (error) {
        console.error("Error updating forms:", error);
        showNotification(`Failed to update forms: ${error.message}`, 'error');
      }
    } else {
      showNotification("No forms needed BBCode fixes.", 'info');
    }
  };

  const handleDeleteForm = async (formId, formName, e) => {
    e.stopPropagation(); 
    if (window.confirm(`Are you sure you want to delete the form "${formName}"? This action cannot be undone.`)) {
      try {
        const { userAgent, timeZone } = getUserContext();
        logAdminAction(
            currentUser?.email || gtawUsername,
            'Deleted Form',
            `Form Name: ${formName}\nID: ${formId}`,
            'Form Management',
            userAgent,
            timeZone,
            gtawUsername,
            gtawUser
        );
        await deleteForm(formId);
        showNotification(`Form "${formName}" deleted successfully!`, 'success');
        if (previewingForm?.firebaseKey === formId) setPreviewingForm(null);
      } catch (error) {
        showNotification(`Failed to delete form "${formName}". Error: ${error.message}`, 'error');
      }
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>
          <i className="fas fa-file-invoice" style={{ color: "#8b5cf6" }}></i>
          <span className={styles.headerTitle}>Form Manager</span>
        </h1>
        <div className={styles.headerActions}>
          <button onClick={handleFixBBCode} className={`${styles.btn} ${styles.btnWarning}`}>
            <i className="fas fa-magic"></i>
            Fix BBCode [b] → [bold]
          </button>
          <button onClick={() => setShowAddModal(true)} className={`${styles.btn} ${styles.btnPrimary}`}>
            <i className="fas fa-plus"></i>
            Add New Form
          </button>
        </div>
      </div>

      <div className={styles.mainLayout}>
        <div className={styles.leftPanel}>
          <div className={styles.searchWrapper}>
            <i className="fas fa-search"></i>
            <input
              type="text"
              placeholder="Search forms..."
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={styles.categorySelect}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat === "All" ? "📂 All Categories" : cat}</option>
            ))}
          </select>

          <div className={styles.formList}>
            {filteredForms.length === 0 ? (
              <div style={{ textAlign: "center", color: "#64748b", padding: "2rem" }}>
                {forms.length === 0 ? "Loading forms..." : "No matches found."}
              </div>
            ) : (
              filteredForms.map((form) => (
                <div
                  key={form.firebaseKey}
                  onClick={() => setPreviewingForm(form)}
                  className={`${styles.formCard} ${previewingForm?.firebaseKey === form.firebaseKey ? styles.active : ''}`}
                >
                  <div className={styles.formCardHeader}>
                    <div className={styles.formName}>{form.name}</div>
                  </div>
                  
                  <div className={styles.formMeta}>
                    <span className={styles.categoryBadge}>
                      <i className="fas fa-folder-open"></i> {form.category || "Uncategorized"}
                    </span>
                    <span className={styles.accessBadge} style={{ 
                      color: form.accessType === "PHMC" ? "#f87171" : 
                             form.accessType === "Coroner" ? "#f59e0b" : 
                             form.accessType === "Mental Health" ? "#FF69B4" : "#34d399" 
                    }}>
                      <i className="fas fa-shield-alt"></i> {form.accessType || "Public"}
                    </span>
                  </div>

                  <div className={styles.cardActions}>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditModal(form); }}
                      className={styles.actionBtn}
                      style={{ background: "#6366f1" }}
                    >
                      <i className="fas fa-edit"></i> Edit
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openDuplicateModal(form); }}
                      className={styles.actionBtn}
                      style={{ background: "#f59e0b" }}
                    >
                      <i className="fas fa-copy"></i> Duplicate
                    </button>
                    <button
                      onClick={(e) => handleDeleteForm(form.firebaseKey, form.name, e)}
                      className={styles.actionBtn}
                      style={{ background: "#ef4444" }}
                    >
                      <i className="fas fa-trash"></i> Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={styles.mainContent}>
          {previewingForm ? (
            <div>
              <div className={styles.previewHeader}>
                <h2>{previewingForm.name}</h2>
                <span className={styles.accessBadge} style={{ 
                  color: previewingForm.accessType === "PHMC" ? "#f87171" : 
                         previewingForm.accessType === "Coroner" ? "#f59e0b" : 
                         previewingForm.accessType === "Mental Health" ? "#FF69B4" : "#34d399",
                  fontSize: '1rem'
                }}>
                  {previewingForm.accessType || "Public Access"}
                </span>
              </div>

              <div className={styles.previewContainer}>
                {previewingForm.fields?.map((field, index) => (
                  <div key={index} className={styles.fieldGroup}>
                    {field.type === 'hr' ? (
                      <hr style={{ borderTop: "2px solid #334155", margin: "2rem 0" }} />
                    ) : field.type === 'fake_line' ? (
                      <hr style={{ borderTop: "2px dashed #334155", margin: "2rem 0" }} />
                    ) : field.type === 'small_header' ? (
                      <h4 style={{ color: "#a78bfa", fontSize: '1.2rem', marginBottom: "1.5rem", display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <i className="fas fa-heading"></i> {field.label}
                      </h4>
                    ) : field.type === 'section' ? (
                      <h3 className={styles.sectionTitle}>
                        {field.icon && <i className={`fas ${field.icon}`}></i>}
                        {field.label}
                      </h3>
                    ) : (
                      <>
                        <label className={styles.fieldLabel}>
                          {field.label}
                          {field.displayCurrentTime && field.type === "timer" && (
                            <span style={{ fontSize: '0.7em', marginLeft: '8px', color: '#64748b' }}> (Server Time)</span>
                          )}
                        </label>
                        {field.type === 'textarea' ? (
                          <div className={styles.inputMock} style={{ minHeight: '80px', color: '#64748b' }}>
                            {field.placeholder || 'Textarea Input Preview'}
                          </div>
                        ) : field.type === 'select' ? (
                          <div className={styles.inputMock} style={{ color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Dropdown: {field.optionsKey || 'No Options Key'}</span>
                            <i className="fas fa-chevron-down"></i>
                          </div>
                        ) : field.type === 'checkbox' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <i className="far fa-square" style={{ fontSize: '1.2rem' }}></i>
                            <span>Checkbox Label</span>
                          </div>
                        ) : field.type === 'radio' ? (
                          <div style={{ display: 'flex', gap: '15px' }}>
                            {field.options?.map((option, optIndex) => (
                              <div key={optIndex} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="far fa-circle"></i>
                                {option}
                              </div>
                            ))}
                            {!field.options?.length && <span style={{ color: '#64748b' }}>(No options defined)</span>}
                          </div>
                        ) : (
                          <div className={styles.inputMock} style={{ color: '#64748b' }}>
                            {field.placeholder || `${field.type?.charAt(0).toUpperCase() + field.type?.slice(1)} Input`}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
                {!previewingForm.fields || previewingForm.fields.length === 0 ? (
                  <div className={styles.emptyState}>
                    <i className="fas fa-layer-group"></i>
                    <p>This form has no fields defined yet.</p>
                  </div>
                ) : null}
              </div>

              <h3 className={styles.sectionTitle}><i className="fas fa-code"></i> BBCode Template</h3>
              <div className={styles.codeBlock}>
                {previewingForm.template || 'No template provided.'}
              </div>

              <h3 className={styles.sectionTitle}><i className="fas fa-terminal"></i> Title Generator Code</h3>
              <div className={styles.codeBlock}>
                {previewingForm.titleGeneratorCode || 'No title generator code provided.'}
              </div>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <i className="fas fa-file-signature"></i>
              <h2>Form Preview</h2>
              <p>Select a form from the left panel to preview its layout and code.</p>
              <div style={{ marginTop: '1rem', background: '#0f172a', padding: '1rem 2rem', borderRadius: '12px' }}>
                Total Managed Forms: <strong style={{ color: '#8b5cf6' }}>{forms.length}</strong>
              </div>
            </div>
          )}
        </div>

        <div className={styles.rightPanel}>
          <h2 style={{ color: "#8b5cf6", fontSize: '1.2rem', marginBottom: '1rem' }}>
            <i className="fas fa-info-circle"></i> Access Control Rules
          </h2>
          
          <div className={styles.ruleCard} style={{ borderLeftColor: "#34d399" }}>
            <div className={styles.ruleTitle} style={{ color: "#34d399" }}>
              <i className="fas fa-globe"></i> Public
            </div>
            <div className={styles.ruleDesc}>Available to any authenticated user on the platform.</div>
          </div>

          <div className={styles.ruleCard} style={{ borderLeftColor: "#f87171" }}>
            <div className={styles.ruleTitle} style={{ color: "#f87171" }}>
              <i className="fas fa-hospital-user"></i> PHMC Only
            </div>
            <div className={styles.ruleDesc}>Restricted to verified members of the PHMC faction.</div>
          </div>

          <div className={styles.ruleCard} style={{ borderLeftColor: "#f59e0b" }}>
            <div className={styles.ruleTitle} style={{ color: "#f59e0b" }}>
              <i className="fas fa-skull-crossbones"></i> Coroner Only
            </div>
            <div className={styles.ruleDesc}>Exclusive access for Department of Medical Examiner staff.</div>
          </div>

          <div className={styles.ruleCard} style={{ borderLeftColor: "#FF69B4" }}>
            <div className={styles.ruleTitle} style={{ color: "#FF69B4" }}>
              <i className="fas fa-brain"></i> Mental Health
            </div>
            <div className={styles.ruleDesc}>Specialized access for Mental Health department personnel.</div>
          </div>
          
          <div className={styles.ruleCard} style={{ borderLeftColor: "#60a5fa" }}>
            <div className={styles.ruleTitle} style={{ color: "#60a5fa" }}>
              <i className="fas fa-user-friends"></i> Civilian
            </div>
            <div className={styles.ruleDesc}>Forms designed for general public submissions.</div>
          </div>
        </div>
      </div>

      <AddFormModal
        show={showAddModal}
        onClose={closeModal}
        editingForm={editingForm}
        user={currentUser}
        isDuplicate={isDuplicate}
      />
    </div>
  );
};

export default FormManager;
