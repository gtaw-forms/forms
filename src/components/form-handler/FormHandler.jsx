// src/components/form-handler/FormHandler.jsx
import React, { useState, useEffect, useCallback } from "react";
import { database } from "../../firebase";
import { ref, onValue } from "firebase/database";
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import useGtaWorldAuth from "../../hooks/useGtaWorldAuth";
import styles from "../ems-dashboard/EmsDashboard.module.css";
import formStyles from './FormHandler.module.css';
import { useModal } from "../../contexts/ModalProvider";
import { useData } from "../../contexts/DataContext";
import EmsBingoModal from '../EmsBingoModal';
import useBbcodeGenerator from '../../hooks/useBbcodeGenerator';
import FormFieldRenderer from './FormFieldRenderer';
import FormHandlerNavButtons from './FormHandlerNavButtons';
import { uploadImageToImgBB } from '../../utils/imageUploadUtils'; 
import { useNotification } from '../../contexts/NotificationContext';
import { getUtcFormattedDateTime, getUtcFormattedTime } from '../../utils/dateTimeUtils';

// Helper: escape HTML characters for safe insertion into DOM
const escapeHtml = (unsafe) => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const FormHandler = () => {
  // State declarations first
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem("formSearchTerm") || "");
  const [selectedCategory, setSelectedCategory] = useState(() => localStorage.getItem("formSelectedCategory") || "All");
  const [showRestricted, setShowRestricted] = useState(() => localStorage.getItem("formShowRestricted") === "true" || false);
  const [currentUtcTime, setCurrentUtcTime] = useState('');
  const [selectOptions, setSelectOptions] = useState({});

  // NEW STATE FOR PATIENT TYPE MANAGEMENT
  const [patientType, setPatientType] = useState(() => localStorage.getItem('formPatientType') || 'gtaw');
  const [civilianNames, setCivilianNames] = useState(() => JSON.parse(localStorage.getItem('formCivilianNames')) || [
    'John Doe', 'Jane Smith', 'Michael Johnson', 'Emily Davis', 'Chris Brown'
  ]);
  const [phmcNames, setPhmcNames] = useState(() => JSON.parse(localStorage.getItem('formPhmcNames')) || [
    'Dr. Alyson (PHMC)', 'Dr. Bell (PHMC)', 'Nurse Carol (PHMC)', 'Paramedic Dave (PHMC)'
  ]);
  const [currentCivilianIndex, setCurrentCivilianIndex] = useState(() => parseInt(localStorage.getItem('formCurrentCivilianIndex'), 10) || 0);
  const [currentPhmcIndex, setCurrentPhmcIndex] = useState(() => parseInt(localStorage.getItem('formCurrentPhmcIndex'), 10) || 0);
  const [tempPatientName, setTempPatientName] = useState('');

  // Then other hooks
  const { showNotification } = useNotification();
  const [isUploading, setIsUploading] = useState(false);

  let {
    user,
    isAuthenticated, // Re-added
    isPhmcMember,
    characterName,
    factionRank,
    selectOptions: authSelectOptions
  } = useGtaWorldAuth();
  let { agencyDataStore, phmcListData, coronerListData } = useData();

  // GLOBAL CLIPBOARD PASTE LISTENER — WORKS IN ANY TEXTAREA
useEffect(() => {
  const handlePaste = async (e) => {
    if (!selectedForm) {
      console.log("No form selected");
      return;
    }

    const activeEl = document.activeElement;
    if (!activeEl || !['TEXTAREA', 'INPUT'].includes(activeEl.tagName)) {
      console.log("Not in a text field");
      return;
    }

    const fieldName = activeEl.name || activeEl.dataset.field;
    if (!fieldName) {
      console.log("No field name");
      return;
    }

    const fieldConfig = selectedForm.fields?.find(f => f.name === fieldName);
    if (!fieldConfig?.allowImagePaste) {
      console.log(`Field ${fieldName} does not allow image paste`);
      return;
    }

    const items = e.clipboardData?.items;
    if (!items) {
      console.log("No clipboard items");
      return;
    }

    let imageFile = null;

    console.log("Paste event detected!", e.clipboardData.types);

    for (let item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file && file.type.startsWith('image/')) {
          imageFile = file;
          break;
        }
      }
    }

    if (!imageFile) {
      console.log("No valid image file in clipboard");
      return;
    }

    e.preventDefault();

    const targetField = fieldConfig.linkedImageField || fieldName;

    try {
      setIsUploading(true);
      const url = await uploadImageToImgBB(imageFile);

      setFormValues(prev => {
        const current = prev[targetField] || [];
        const arr = Array.isArray(current)
          ? current
          : (typeof current === 'string' ? current.split(', ').filter(Boolean) : []);

        return {
          ...prev,
          [targetField]: [...arr, url]
        };
      });

showNotification("Image pasted & uploaded!", "success");

// AUTO-INSERT URL INTO THE TEXTAREA (THE ONE YOU PASTED INTO)
const activeEl = document.activeElement;
if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
  const currentValue = activeEl.value || "";
  const cursorPos = activeEl.selectionStart;

  // Choose format: raw URL or BBCode [img]
  const insertText = `[img]${url}[/img]`;  // Change to just `${url}` if you prefer plain

  const newValue =
    currentValue.substring(0, cursorPos) +
    (currentValue && !currentValue.endsWith("\n") ? "\n" : "") +
    insertText +
    "\n" +
    currentValue.substring(cursorPos);

  // Update textarea value
  activeEl.value = newValue;

  // Update React state so it stays after re-render
  setFormValues(prev => ({
    ...prev,
    [fieldName]: newValue
  }));

  // Move cursor after inserted text
  const newCursorPos = cursorPos + insertText.length + 2; // +2 for newlines
  setTimeout(() => {
    activeEl.focus();
    activeEl.setSelectionRange(newCursorPos, newCursorPos);
  }, 0);
}    } catch (err) {
      console.error("Upload failed:", err);
      showNotification("Failed to upload image", "error");
    } finally {
      setIsUploading(false);
    }
  };

  document.addEventListener('paste', handlePaste);
  return () => document.removeEventListener('paste', handlePaste);
}, [selectedForm, showNotification, setIsUploading]);

useEffect(() => { localStorage.setItem('formPatientType', patientType); }, [patientType]);
  useEffect(() => { localStorage.setItem('formCivilianNames', JSON.stringify(civilianNames)); }, [civilianNames]);
  useEffect(() => { localStorage.setItem('formPhmcNames', JSON.stringify(phmcNames)); }, [phmcNames]);
  useEffect(() => { localStorage.setItem('formCurrentCivilianIndex', currentCivilianIndex.toString()); }, [currentCivilianIndex]);
  useEffect(() => { localStorage.setItem('formCurrentPhmcIndex', currentPhmcIndex.toString()); }, [currentPhmcIndex]);

  // Effect to manage tempPatientName based on selections
  useEffect(() => {
    let nameToSet = '';
    if (patientType === 'civilian' && civilianNames.length > 0) {
      nameToSet = civilianNames[currentCivilianIndex];
    } else if (patientType === 'phmc' && phmcNames.length > 0) {
      nameToSet = phmcNames[currentPhmcIndex];
    } else if (patientType === 'gtaw') {
      nameToSet = characterName || '';
    }
    setTempPatientName(nameToSet);
  }, [patientType, currentCivilianIndex, currentPhmcIndex, civilianNames, phmcNames, characterName]);

  // --- DEV OVERRIDE START ---
  // For development, we can forcefully override auth data to test different user roles.
  // Change `devMode` to "Civilian", "PHMC", "Coroner", or `null` to disable.
  const isDevelopment = process.env.NODE_ENV === 'development';
  let isCoronerForDev = null;
  if (isDevelopment) {
    const devMode = patientType; // Use the selected patientType for devMode

    switch (devMode) {
      case "civilian":
        isAuthenticated = true;
        isPhmcMember = false;
        characterName = civilianNames[currentCivilianIndex] || "John Doe (Dev Civilian)";
        factionRank = 0;
        user = { username: "civ_dev", id: 12345, ...user };
        isCoronerForDev = false;
        break;
      case "phmc":
        isAuthenticated = true;
        isPhmcMember = true;
        characterName = phmcNames[currentPhmcIndex] || "Jane Smith (Dev PHMC)";
        factionRank = 5;
        user = { username: "phmc_dev", id: 54321, ...user };
        isCoronerForDev = false;
        break;
      case "gtaw": // Fallback for GTAW Character
      default:
        // No override, use actual GTAW auth data
        break;
    }
    // Also handle the Coroner case from the original DEV OVERRIDE if it's set specifically
    if (selectedForm?.accessType === "Coroner") { // If a coroner form is selected in dev mode
      isAuthenticated = true;
      isPhmcMember = true;
      characterName = "Dr. Crime (Dev Coroner)";
      factionRank = 10;
      user = { username: "coroner_dev", id: 666, ...user };
      isCoronerForDev = true;
      // Create a fake coroner entry to be found by the useEffect
      coronerListData = [{
          name: "Dr. Crime (Dev Coroner)",
          rank: "Chief Dev Examiner",
          badge: "DEV666"
      }, ...coronerListData];
    }
  }
  // --- DEV OVERRIDE END ---

  const finalSelectOptions = { ...selectOptions, ...authSelectOptions };

  const isCoroner = React.useMemo(() => {
    if (isCoronerForDev !== null) return isCoronerForDev; // Dev override takes precedence
    if (!isAuthenticated || !tempPatientName || coronerListData.length === 0) return false; // Use tempPatientName
    return coronerListData.some(coroner => coroner.name?.toLowerCase() === tempPatientName.toLowerCase()); // Use tempPatientName
  }, [isAuthenticated, tempPatientName, coronerListData, isCoronerForDev]);

  const { generatedBBCode, generatedTitle, showBBCode, setShowBBCode, generateBBCode } = useBbcodeGenerator(
    selectedForm,
    formValues,
    finalSelectOptions,
    agencyDataStore // Pass agencyDataStore
  );

    const {
        showEmsBingoModal, setShowEmsBingoModal,
    } = useModal();
    
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

  // Derive unique categories from forms and ensure "All" is present
  const categories = React.useMemo(() => {
    const uniqueCategories = [...new Set(forms.map(form => form.category))];
    const sortedCategories = uniqueCategories.sort();
    return ["All", ...sortedCategories];
  }, [forms]);

  // Filter forms based on search term, selected category, and restricted status
  const filteredForms = React.useMemo(() => {
    return forms.filter(form => {
      const matchesSearchTerm = form.name && form.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "All" || form.category === selectedCategory;
      const isRestricted = form.accessType === "PHMC" || form.accessType === "Coroner";
      const passesRestriction = !showRestricted || (isRestricted ? (isAuthenticated && isPhmcMember) : true);

      return matchesSearchTerm && matchesCategory && passesRestriction;
    });
  }, [forms, searchTerm, selectedCategory, showRestricted, isAuthenticated, isPhmcMember]);

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

  // Effect to auto-fill employee details based on OAuth data
  useEffect(() => {
    const shouldBypassDataCheck = isDevelopment;

    if (isAuthenticated && selectedForm && (shouldBypassDataCheck || phmcListData.length > 0 || coronerListData.length > 0)) {
      setFormValues(prevFormValues => {
        let updates = {};

        // Identify the name field based on form's access type
        let nameField = '';
        if (selectedForm.accessType === "PHMC" || selectedForm.accessType === "Coroner") {
          nameField = 'employeeName'; // Assuming PHMC/Coroner forms use 'employeeName'
          // For PHMC/Coroner, only pre-fill if empty
          if (tempPatientName && !prevFormValues[nameField]) {
            updates[nameField] = tempPatientName;
          }
        } else if (selectedForm.accessType === "Civilian") {
          nameField = 'patientName'; // Corrected case from 'PatientName'
          // For Civilian, only update if the name is different, to prevent loops
          if ((patientType === 'civilian' || patientType === 'gtaw') && tempPatientName && prevFormValues[nameField] !== tempPatientName) {
            updates[nameField] = tempPatientName;
          }
        }

        // Check if the form is a coroner form by its category
        const isCoronerForm = selectedForm.category === 'DMEC';

        if (isCoronerForm && !prevFormValues.coronerEmployee && tempPatientName) {
          updates.coronerEmployee = tempPatientName; // Use tempPatientName

          const matchedCoroner = coronerListData.find(coroner =>
            coroner.name?.toLowerCase() === tempPatientName.toLowerCase() // Use tempPatientName
          );

          if (matchedCoroner) {
            updates.coronerRank = matchedCoroner.rank || '';
            updates.coronerBadge = matchedCoroner.badge || '';
          } else if (factionRank) {
            updates.coronerRank = factionRank;
            if (shouldBypassDataCheck && tempPatientName.includes("Dev Coroner")) { // Use tempPatientName
                updates.coronerBadge = "DEV666_BADGE";
            } else {
                updates.coronerBadge = '';
            }
          }
        }

        if (Object.keys(updates).length > 0) {
          return { ...prevFormValues, ...updates };
        }
        return prevFormValues;
      });
    }
  }, [isAuthenticated, tempPatientName, factionRank, phmcListData, coronerListData, selectedForm, setFormValues, isDevelopment, patientType]);

    const switchCivilianName = () => {
    setCurrentCivilianIndex((prevIndex) => (prevIndex + 1) % civilianNames.length);
  };

  const switchPhmcName = () => {
    setCurrentPhmcIndex((prevIndex) => (prevIndex + 1) % phmcNames.length);
  };

  const handleChange = useCallback((fieldName, value) => {
    setFormValues(prevValues => ({
      ...prevValues,
      [fieldName]: value
    }));
  }, []);

  const copyAndSaveReport = useCallback(async () => {
    if (generatedBBCode) {
      try {
        await navigator.clipboard.writeText(generatedBBCode);
        // Optionally, add a notification here that BBCode was copied
        // For example: alert('BBCode copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy BBCode: ', err);
        // Optionally, add an error notification here
      }
    }
  }, [generatedBBCode]);

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
              
                            {/* Patient Type Selector and Name Switcher */}
                            <div style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #334155', borderRadius: '8px' }}>
                              <Form.Label style={{ color: '#e2e8f0' }}>Character / Patient Type</Form.Label>
                              <div style={{ display: 'flex', gap: '15px', marginBottom: '10px' }}>
                                <Form.Check
                                  type="radio"
                                  id="typeGtaw"
                                  label="GTAW Character"
                                  name="patientTypeSelection"
                                  value="gtaw"
                                  checked={patientType === 'gtaw'}
                                  onChange={(e) => setPatientType(e.target.value)}
                                  inline
                                  className={formStyles.customRadio}
                                />
                                <Form.Check
                                  type="radio"
                                  id="typeCivilian"
                                  label="Civilian"
                                  name="patientTypeSelection"
                                  value="civilian"
                                  checked={patientType === 'civilian'}
                                  onChange={(e) => setPatientType(e.target.value)}
                                  inline
                                  className={formStyles.customRadio}
                                />
                                <Form.Check
                                  type="radio"
                                  id="typePhmc"
                                  label="PHMC Employee"
                                  name="patientTypeSelection"
                                  value="phmc"
                                  checked={patientType === 'phmc'}
                                  onChange={(e) => setPatientType(e.target.value)}
                                  inline
                                  className={formStyles.customRadio}
                                />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                                <span style={{ color: '#cbd5e1', fontSize: '1.1rem', fontWeight: 'bold' }}>
                                  Selected: <span dangerouslySetInnerHTML={{ __html: escapeHtml(tempPatientName) }} />
                                </span>
                                {patientType === 'civilian' && civilianNames.length > 1 && (
                                  <Button variant="outline-light" size="sm" onClick={switchCivilianName} title="Switch Civilian Name">
                                    <i className="fas fa-sync-alt"></i>
                                  </Button>
                                )}
                                {patientType === 'phmc' && phmcNames.length > 1 && (
                                  <Button variant="outline-light" size="sm" onClick={switchPhmcName} title="Switch PHMC Name">
                                    <i className="fas fa-sync-alt"></i>
                                  </Button>
                                )}
                              </div>
                            </div>
              
                            <div style={{ margin: "0 -8px" }}>
                              {selectedForm.fields?.map((field, index) => (
                                <FormFieldRenderer
                                  key={index}
                                  field={field}
                                  selectedForm={selectedForm}
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
              {tempPatientName || user?.username || "Not signed in"}
            </div>
            {isPhmcMember && <div style={{ color: "#34d399", marginTop: "0.5rem" }}>PHMC Member • Rank {factionRank}</div>}
          </div>

          {generatedTitle && (
            <div style={{ background: "#0f172a", padding: "1.5rem", borderRadius: 12, color: "#e2e8f0", fontSize: "1.1rem", fontWeight: "700", marginBottom: "1rem", whiteSpace: "pre-wrap" }}>
              {generatedTitle}
            </div>
          )}

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
