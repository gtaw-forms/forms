// src/components/form-handler/FormHandler.jsx
import React, { useState, useEffect, useCallback } from "react";
import { database } from "../../firebase";
import { ref, onValue } from "firebase/database";
import useGtaWorldAuth from "../../hooks/useGtaWorldAuth";
import styles from "../ems-dashboard/EmsDashboard.module.css";
import formStyles from './FormHandler.module.css';
import ImageUploader from './ImageUploader';
import { useModal } from "../../contexts/ModalProvider";
import { useData } from "../../contexts/DataContext";
import EmsBingoModal from '../EmsBingoModal';
import useBbcodeGenerator from '../../hooks/useBbcodeGenerator';
import FormFieldRenderer from './FormFieldRenderer';
import FormHandlerNavButtons from './FormHandlerNavButtons';

import { getUtcFormattedDateTime, getUtcFormattedTime } from '../../utils/dateTimeUtils';

const FormHandler = () => {
        const {
          user,
          isPhmcMember,
          characterName,
          factionRank,
          selectOptions: authSelectOptions
        } = useGtaWorldAuth();  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem("formSearchTerm") || "");
  const [selectedCategory, setSelectedCategory] = useState(() => localStorage.getItem("formSelectedCategory") || "All");
  const [showRestricted, setShowRestricted] = useState(() => localStorage.getItem("formShowRestricted") === "true" || false);
  const [currentUtcTime, setCurrentUtcTime] = useState(''); // New state for current UTC time

  const [selectOptions, setSelectOptions] = useState({});
  const { agencyDataStore } = useData(); // Destructure agencyDataStore
  const finalSelectOptions = { ...selectOptions, ...authSelectOptions };

  const { generatedBBCode, generatedTitle, showBBCode, setShowBBCode, generateBBCode } = useBbcodeGenerator(
    selectedForm,
    formValues,
    finalSelectOptions,
    agencyDataStore // Pass agencyDataStore
  );

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

  // Effect to update currentUtcTime every second
  useEffect(() => {
    const updateUtcTime = () => {
      const now = new Date();
      const pad = (num) => num.toString().padStart(2, '0');
      const utcString = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`;
      setCurrentUtcTime(utcString);
    };

    updateUtcTime(); // Initial update
    const intervalId = setInterval(updateUtcTime, 1000); // Update every second

    return () => clearInterval(intervalId);
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount
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
      <FormHandlerNavButtons />

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
                              {selectedForm.fields?.map((field, index) => (
                                <FormFieldRenderer
                                  key={index}
                                  field={field}
                                  formValues={formValues}
                                  handleChange={handleChange}
                                  finalSelectOptions={finalSelectOptions}
                                  currentUtcTime={currentUtcTime}
                                  agencyDataStore={agencyDataStore} // New prop
                                />
                              ))}
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
