// src/components/form-handler/FormHandler.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import Select from 'react-select';
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
import { uploadImageToImgBB, uploadDataUrlToImgBB } from '../../utils/imageUploadUtils'; 
import { useNotification } from '../../contexts/NotificationContext';
import { getUtcFormattedDateTime } from '../../utils/dateTimeUtils';
import { useReportManagement } from '../useReportManagement';
import EmployeeCredentialsSection from '../EmployeeCredentialsSection';
import { useFormSaver } from '../../hooks/useFormSaver';
import SavedReportsModal from '../SavedReportsModal';
import OnboardingModal from '../OnboardingModal';
import seasonalEvents from '../../components/SeasonalEvents';

const FormHandler = () => {
  // State
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem("formSearchTerm") || "");
  const [collapsedCategories, setCollapsedCategories] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("formCollapsedCategories")) || {};
    } catch (e) {
      console.error("Error parsing formCollapsedCategories from localStorage:", e);
      return {};
    }
  });
  const [seasonalEffectsEnabled, setSeasonalEffectsEnabled] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('seasonalEffectsEnabled')) ?? true;
    } catch (e) {
      console.error("Failed to parse seasonalEffectsEnabled from localStorage", e);
      return true;
    }
  });
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [currentUtcTime, setCurrentUtcTime] = useState(getUtcFormattedDateTime());
  const [isUploading, setIsUploading] = useState(false);

  // Hooks
  const { showNotification } = useNotification();
  const {
    user,
    isAuthenticated,
    isPhmcMember,
    characterName,
    selectOptions: authSelectOptions,
  } = useGtaWorldAuth();
  const { 
    agencyDataStore, 
    phmcListData, 
    coronerListData: originalCoronerListData,
    selectOptions: dataContextSelectOptions
  } = useData();
  const { showEmsBingoModal, setShowEmsBingoModal } = useModal();
  const { saveReport: saveNewReport } = useFormSaver();
  const isDevelopment = process.env.NODE_ENV === 'development';
  const modalCloseTimer = React.useRef(null);

  // Memos
  const finalSelectOptions = useMemo(() => ({
    ...(dataContextSelectOptions || {}), 
    ...(authSelectOptions || {}) 
  }), [dataContextSelectOptions, authSelectOptions]);

  const coronerListData = useMemo(() => {
    if (isDevelopment && selectedForm?.accessType === "Coroner") {
        return [{ name: "Dr. Crime (Dev Coroner)", rank: "Chief Dev Examiner", badge: "DEV666" }, ...originalCoronerListData];
    }
    return originalCoronerListData;
  }, [isDevelopment, selectedForm, originalCoronerListData]);

  const employeeOptions = useMemo(() => {
      const phmcOptions = phmcListData.map(emp => ({ label: emp.name, value: emp.name }));
      const coronerOptions = coronerListData.map(emp => ({ label: emp.name, value: emp.name }));
      return [
          { label: 'PHMC Staff', options: phmcOptions },
          { label: 'Coroner Staff', options: coronerOptions }
      ];
  }, [phmcListData, coronerListData]);

  const employeeType = useMemo(() => {
    if (selectedForm?.accessType === 'Coroner') return 'coroner';
    return 'phmc';
  }, [selectedForm]);

  const mainEmployeeName = useMemo(() => {
    const employeeNameField = `${employeeType}Employee`;
    return formValues[employeeNameField];
  }, [formValues, employeeType]);

  const { generatedBBCode, generatedTitle, showBBCode, setShowBBCode, generateBBCode } = useBbcodeGenerator(
    selectedForm,
    formValues,
    finalSelectOptions,
    agencyDataStore
  );

  // Callbacks
  const toggleCategory = (cat) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleOnboardingComplete = (preferences) => {
    localStorage.setItem('onboardingComplete', 'true');
    setShowOnboardingModal(false);
    if (preferences.defaultForm) {
      const defaultFormObj = forms.find(form => form.firebaseKey === preferences.defaultForm);
      if (defaultFormObj) {
        setSelectedForm(defaultFormObj);
        setFormValues({});
      }
    }
    showNotification('Welcome! Your preferences have been saved.', 'success');
  };

  const handleOnboardingSkip = () => {
    localStorage.setItem('onboardingComplete', 'true');
    setShowOnboardingModal(false);
    showNotification('Onboarding skipped. You can always set preferences later.', 'info');
  };

  const getCurrentReportAuthor = useCallback(() => {
    return characterName;
  }, [characterName]);
  
  const handleChange = useCallback((fieldName, valueOrUpdater) => {
    setFormValues(prevValues => {
      const newValue = typeof valueOrUpdater === 'function' 
        ? valueOrUpdater(prevValues) 
        : valueOrUpdater;
      return {
        ...prevValues,
        [fieldName]: newValue
      };
    });
  }, []);

  const handleSelectChange = useCallback((selectedOption, actionMeta) => {
    const name = selectedOption ? selectedOption.value : '';
    const fieldName = actionMeta.name;

    const employeeData = [...phmcListData, ...coronerListData].find(e => e.name === name);

    let updates = { [fieldName]: name };
    if (employeeData) {
        updates[`${employeeType}Rank`] = employeeData.rank || '';
        updates[`${employeeType}Badge`] = employeeData.badge || '';
    }
    
    setFormValues(prev => ({...prev, ...updates}));
  }, [employeeType, phmcListData, coronerListData, setFormValues]);

  const handleDiagramUpload = useCallback(async (dataUrl) => {
    try {
        const url = await uploadDataUrlToImgBB(dataUrl);
        return [url];
    } catch (error) {
        showNotification('Failed to upload diagram image.', 'error');
        console.error("Autopsy Diagram upload failed:", error);
        return [];
    }
  }, [showNotification]);

  const copyAndSaveReport = useCallback(async () => {
    if (generatedBBCode) {
      await saveNewReport(selectedForm, formValues, generatedTitle, generatedBBCode);
      try {
        await navigator.clipboard.writeText(generatedBBCode);
      } catch (err) {
        console.error('Failed to copy BBCode: ', err);
        showNotification('Report saved, but failed to copy BBCode to clipboard.', 'warning');
      }
    }
  }, [generatedBBCode, selectedForm, formValues, generatedTitle, saveNewReport, showNotification]);

  const handleClearForm = useCallback(() => {
    const credentialFieldsToPreserve = [
      `${employeeType}Employee`,
      `${employeeType}Badge`,
      `${employeeType}Rank`,
      `${employeeType}Discord`,
      `${employeeType}PHNumber`
    ];

    const preservedValues = {};
    credentialFieldsToPreserve.forEach(fieldName => {
        if (formValues[fieldName]) {
            preservedValues[fieldName] = formValues[fieldName];
        }
    });
    
    setFormValues(preservedValues);
    if (selectedForm?.firebaseKey) {
        localStorage.removeItem(`form_progression_${selectedForm.firebaseKey}`);
    }
    showNotification('Form cleared!', 'info');
  }, [formValues, employeeType, setFormValues, selectedForm?.firebaseKey, showNotification]);

  const { 
      toggleSavedReports,
      showSavedReports,
      setShowSavedReports,
      savedReports,
      isLoadingUserReports,
      loadUserSavedReports,
      handleReportSelectedForAttachment,
      deleteReportForUser,
      loadReportForUser,
      preselectedEmployeeType,
      reportSelectionFilter,
      pendingReportAttachmentCallback 
  } = useReportManagement(
      formValues, setFormValues, null, () => {}, () => '', getCurrentReportAuthor, () => ({}), finalSelectOptions,
      showNotification, () => {}, () => {}, () => {}, () => {}, modalCloseTimer, selectedForm
  );

  // Effects
  useEffect(() => {
    localStorage.setItem('seasonalEffectsEnabled', JSON.stringify(seasonalEffectsEnabled));
  }, [seasonalEffectsEnabled]);

  useEffect(() => {
    localStorage.setItem("formCollapsedCategories", JSON.stringify(collapsedCategories));
  }, [collapsedCategories]);

  useEffect(() => {
    const onboardingComplete = localStorage.getItem('onboardingComplete') === 'true';
    if (!onboardingComplete) {
      setShowOnboardingModal(true);
    }
  }, []);

  useEffect(() => {
    const handlePaste = async (e) => {
      if (!selectedForm) return;
      const activeEl = document.activeElement;
      if (!activeEl || !['TEXTAREA', 'INPUT'].includes(activeEl.tagName)) return;

      const fieldName = activeEl.name || activeEl.dataset.field;
      if (!fieldName) return;

      const fieldConfig = selectedForm.fields?.find(f => f.name === fieldName);
      if (!fieldConfig?.allowImagePaste) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      let imageFile = null;
      for (let item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          imageFile = item.getAsFile();
          break;
        }
      }

      if (!imageFile) return;

      e.preventDefault();
      const targetField = fieldConfig.linkedImageField || fieldName;

      try {
        setIsUploading(true);
        const url = await uploadImageToImgBB(imageFile);
        setFormValues(prev => {
          const current = prev[targetField] || [];
          const arr = Array.isArray(current) ? current : (typeof current === 'string' ? current.split(', ').filter(Boolean) : []);
          return { ...prev, [targetField]: [...arr, url] };
        });
        showNotification("Image pasted & uploaded!", "success");

        const insertText = `[img]${url}[/img]`
        const newValue = activeEl.value.substring(0, activeEl.selectionStart) + (activeEl.value ? "\n" : "") + insertText + "\n" + activeEl.value.substring(activeEl.selectionEnd);
        
        activeEl.value = newValue;
        const event = new Event('input', { bubbles: true });
        activeEl.dispatchEvent(event);

      } catch (err) {
        console.error("Upload failed:", err);
        showNotification("Failed to upload image", "error");
      } finally {
        setIsUploading(false);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [selectedForm, showNotification, setIsUploading, setFormValues]);

  useEffect(() => {
    if (selectedForm?.firebaseKey && Object.keys(formValues).length > 0) {
      localStorage.setItem(`form_progression_${selectedForm.firebaseKey}`, JSON.stringify(formValues));
    } else if (selectedForm?.firebaseKey) {
        localStorage.removeItem(`form_progression_${selectedForm.firebaseKey}`);
    }
  }, [formValues, selectedForm?.firebaseKey]);

  useEffect(() => {
    if (!selectedForm || !selectedForm.fields || !mainEmployeeName) return;

    setFormValues(currentFormValues => {
        const updates = {};
        const possibleNames = ['patientname', 'employeename', 'phmcemployee', 'coroneremployee'];
        
        selectedForm.fields.forEach(field => {
            const fieldNameLower = field.name?.toLowerCase();
            if (possibleNames.includes(fieldNameLower)) {
                if (currentFormValues[field.name] !== mainEmployeeName) {
                    updates[field.name] = mainEmployeeName;
                }
            }
        });

        if (Object.keys(updates).length > 0) {
            return { ...currentFormValues, ...updates };
        } else {
            return currentFormValues; // No change
        }
    });
  }, [mainEmployeeName, selectedForm, setFormValues]);

  useEffect(() => {
    if (!selectedForm || !generatedTitle) return;
    const reportFields = ['deathReport', 'additionalReports', 'attachedReports', 'coronerReport'];
    const hasAttachedReports = reportFields.some(field => formValues[field] && formValues[field].includes('[altspoiler='));
    if (hasAttachedReports) {
      generateBBCode();
    }
  }, [formValues, selectedForm, generatedTitle, generateBBCode]);

  useEffect(() => {
    localStorage.setItem("formSearchTerm", searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    const formsRef = ref(database, "forms");
    const unsub = onValue(formsRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.keys(data).map(key => ({ ...data[key], firebaseKey: key }));
      setForms(list);
    });
    return () => unsub();
  }, []);

  const [groupedForms, notDisplayedFormsDetails] = React.useMemo(() => {
    const categoriesMap = {};
    const tempNotDisplayedFormsDetails = [];

    forms.forEach(form => {
      const matchesSearchTerm = form.name && form.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      let shouldDisplay = false;
      let reason = "";

      if (isDevelopment) {
        shouldDisplay = true;
        reason = "Development Mode";
      } else {
        if (form.isHidden) {
            shouldDisplay = false;
            reason = "Hidden form";
        } else {
            const isRestricted = form.accessType === "PHMC" || form.accessType === "Coroner";
            const hasRequiredAccess = isAuthenticated && (isPhmcMember || (user && user.faction));
            
            if (!isRestricted) {
                shouldDisplay = true;
                reason = "Public form";
            } else { // Form is restricted
                shouldDisplay = hasRequiredAccess;
                reason = hasRequiredAccess ? "Access granted" : "Access denied";
            }
        }
      }

      if (matchesSearchTerm && shouldDisplay) {
        const categoryName = form.category || "Uncategorized";
        if (!categoriesMap[categoryName]) {
          categoriesMap[categoryName] = [];
        }
        categoriesMap[categoryName].push(form);
      } else {
          let finalReason = reason;
          if (!matchesSearchTerm) {
            finalReason = `Does not match search term: "${searchTerm}"`;
          }
          if(!shouldDisplay) {
            finalReason = reason;
          }
          tempNotDisplayedFormsDetails.push({ name: form.name, reason: finalReason });
      }
    });

    const sortedCategoryNames = Object.keys(categoriesMap).sort((a, b) => {
        if (a === "Uncategorized") return 1;
        if (b === "Uncategorized") return -1;
        return a.localeCompare(b);
    });

    const sortedGroupedForms = {};
    sortedCategoryNames.forEach(catName => {
        sortedGroupedForms[catName] = categoriesMap[catName].sort((a, b) => a.name.localeCompare(b.name));
    });

    return [sortedGroupedForms, tempNotDisplayedFormsDetails];
  }, [forms, searchTerm, isAuthenticated, isPhmcMember, isDevelopment, user]);

  useEffect(() => {
    console.log(
        "[FormHandler Debug] Auth Status:", { isAuthenticated, isPhmcMember, userFaction: user?.faction, employeeName: mainEmployeeName },
        "| Viewable Forms:", { categories: Object.keys(groupedForms), totalForms: Object.values(groupedForms).flat().length,
        formsByCategory: groupedForms, notDisplayedForms: notDisplayedFormsDetails }
    );
  }, [groupedForms, notDisplayedFormsDetails, isAuthenticated, isPhmcMember, user, mainEmployeeName]);

  useEffect(() => {
    const updateUtcTime = () => {
      const now = new Date();
      const pad = (num) => num.toString().padStart(2, '0');
      const utcString = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`;
      setCurrentUtcTime(utcString);
    };

    updateUtcTime();
    const intervalId = setInterval(updateUtcTime, 1000);

    return () => clearInterval(intervalId);
  }, []);
  
  const { effect } = seasonalEvents({});

  return (
    <div className={styles.container}>
      {seasonalEffectsEnabled && effect}
      <OnboardingModal show={showOnboardingModal} onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip} showNotification={showNotification} />
      <EmsBingoModal show={showEmsBingoModal} onHide={() => setShowEmsBingoModal(false)} />
      <SavedReportsModal
        show={showSavedReports}
        onHide={() => setShowSavedReports(false)}
        onClose={() => setShowSavedReports(false)}
        showNotification={showNotification}
        reportsForSelectedUser={savedReports}
        onEmployeeSelect={loadUserSavedReports}
        employeeOptions={employeeOptions}
        isLoadingReports={isLoadingUserReports}
        loadReport={loadReportForUser}
        deleteReportForUser={deleteReportForUser}
        handleReportSelectedForAttachment={handleReportSelectedForAttachment}
        currentCoronerEmployee={formValues.coronerEmployee}
        currentPhmcEmployee={formValues.phmcEmployee}
        filterByBbCodeVersions={reportSelectionFilter}
        preselectedEmployeeType={preselectedEmployeeType}
        reportSelectionFilter={reportSelectionFilter}
        pendingReportAttachmentCallback={pendingReportAttachmentCallback}
        selectedForm={selectedForm}
      />
      <FormHandlerNavButtons />

      <div className={styles.header}>
        <h2>PHMC Tools - Form Generator and more!</h2>
      </div>

      <div className={styles.mainLayout}>
        <div className={styles.leftPanel}>
          <input
            type="text"
            placeholder="Search forms..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />

          <div className={styles.formList}>
            {Object.entries(groupedForms).length === 0 ? (
              <div style={{ textAlign: "center", color: "#64748b", padding: "2rem" }}>
                No forms found
              </div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {Object.entries(groupedForms).map(([categoryName, formsInCategory]) => (
                  <li key={categoryName}>
                    <div
                      className={`${styles.categoryHeader} ${collapsedCategories[categoryName] ? styles.collapsed : ""}`}
                      onClick={() => toggleCategory(categoryName)}
                    >
                      {categoryName} ({formsInCategory.length})
                    </div>
                    {!collapsedCategories[categoryName] && (
                      <ul className={styles.protocolList}>
                        {formsInCategory.map((form) => (
                          <li
                            key={form.firebaseKey}
                            onClick={() => {
                              // Preserve essential credential fields across form switches.
                              const credentialFields = [
                                `${employeeType}Employee`,
                                `${employeeType}Badge`,
                                `${employeeType}Rank`,
                                `${employeeType}Discord`,
                                `${employeeType}PHNumber`
                              ];
                              const baseValues = {};
                              credentialFields.forEach(key => {
                                  if (formValues[key]) { // Carry over from current state
                                      baseValues[key] = formValues[key];
                                  }
                              });

                              console.log("Switching form. Preserving base values:", baseValues);

                              const savedProgression = localStorage.getItem(`form_progression_${form.firebaseKey}`);
                              const savedValues = savedProgression ? JSON.parse(savedProgression) : {};
                              
                              console.log("Found saved progression for new form:", savedValues);

                              setSelectedForm(form);
                              setFormValues({ ...baseValues, ...savedValues });
                              setShowBBCode(false);
                            }}
                            className={`${styles.formCard} ${selectedForm?.firebaseKey === form.firebaseKey ? styles.selected : ""}`}
                          >
                            <div className={styles.formTitle}>{form.name}</div>
                            <div className={styles.formCategory}>{form.category}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className={styles.mainContent}>
          {!isAuthenticated && (
            <div style={{
              backgroundColor: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb',
              borderRadius: '0.25rem', padding: '1rem', marginBottom: '1rem',
              textAlign: 'center', fontWeight: 'bold'
            }}>
              Please sign in with OAuth to Generate BBCode and Save Reports.
            </div>
          )}
          {!selectedForm ? (
            <div style={{ textAlign: "center", marginTop: "8rem", color: "#64748b" }}>
              <h3>Select a form from the left to begin</h3>
            </div>
          ) : (
            <>
              <h2 style={{ color: "#60a5fa", marginBottom: "2rem" }}>{selectedForm.name}</h2>
              {selectedForm.formDescription && (
                  <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
                      {selectedForm.formDescription}
                  </div>
              )}
              
              <div style={{ margin: "0 -8px" }}>
                {selectedForm.fields?.map((field) => (
                  <FormFieldRenderer
                    key={field.name}
                    field={field}
                    selectedForm={selectedForm}
                    formValues={formValues}
                    handleChange={handleChange}
                    finalSelectOptions={finalSelectOptions}
                    currentUtcTime={currentUtcTime}
                    agencyDataStore={agencyDataStore}
                    toggleSavedReports={toggleSavedReports}
                    showNotification={showNotification}
                    isUploading={isUploading}
                    handleDiagramUpload={handleDiagramUpload}
                  />
                ))}
              </div>
              
              <div style={{ textAlign: "center", margin: "3rem 0", display: "flex", justifyContent: "center", gap: "1rem" }}>
                <button onClick={handleClearForm} className={formStyles.clearButton}>
                  Clear Form
                </button>
                <button onClick={generateBBCode} className={formStyles.generateButton}>
                  Generate BBCode
                </button>
              </div>
            </>
          )}
        </div>

        <div className={styles.rightPanel}>
          <div style={{ background: "linear-gradient(135deg, #2d1b69, #1e1b4b)", padding: "1.5rem", borderRadius: 12, marginBottom: "1.5rem" }}>
            <h3 style={{ color: "#a78bfa", margin: "0 0 1rem" }}>Signed in as</h3>
            <EmployeeCredentialsSection
              formData={formValues}
              setFormData={setFormValues}
              groupedOptions={employeeOptions}
              handleSelectChange={handleSelectChange}
              setShowEmployeeModal={setShowEmployeeModal}
              employeeType={employeeType}
              showNotification={showNotification}
              context={selectedForm?.name}
            />
          </div>

          <button onClick={() => setShowBBCode(!showBBCode)} className={formStyles.rightPanelButton}>
            {showBBCode ? "Hide" : "Show"} BBCode Preview
          </button>

          <button onClick={copyAndSaveReport} disabled={!generatedBBCode} className={`${formStyles.rightPanelButton} ${generatedBBCode ? formStyles.copy : ''}`}>
            {generatedBBCode ? "Copy BBCode + Save" : "No BBCode Yet"}
          </button>

          {showBBCode && generatedBBCode && (
            <>
              {generatedTitle && (
                <div
                  style={{ background: "#0f172a", padding: "1.5rem", borderRadius: 12, color: "#e2e8f0", fontSize: "1.1rem", fontWeight: "700", marginBottom: "1rem", whiteSpace: "pre-wrap", cursor: "pointer" }}
                  onClick={() => {
                    navigator.clipboard.writeText(generatedTitle);
                    showNotification('Title copied to clipboard!', 'success');
                  }}
                  title="Click to copy title"
                >
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
