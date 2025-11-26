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
import { getUtcFormattedDateTime, getUtcFormattedTime } from '../../utils/dateTimeUtils';
import { useReportManagement } from '../useReportManagement';
import { useFormSaver } from '../../hooks/useFormSaver'; // Added useFormSaver import
import SavedReportsModal from '../SavedReportsModal';
import OnboardingModal from '../OnboardingModal'; // NEW IMPORT
import seasonalEvents from '../../components/SeasonalEvents'; // Import seasonalEvents function

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
  // Helper function to find a field name case-insensitively
  const findFieldNameCaseInsensitive = useCallback((fields, targetName) => {
    if (!fields) return null;
    const foundField = fields.find(field => field.name?.toLowerCase() === targetName.toLowerCase());
    return foundField ? foundField.name : null;
  }, []);
  // State declarations first
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
  const [showRestricted, setShowRestricted] = useState(() => localStorage.getItem("formShowRestricted") === "true" || false);

  // NEW STATE FOR PATIENT TYPE MANAGEMENT - PRESERVED
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
const [currentUtcTime, setCurrentUtcTime] = useState(getUtcFormattedDateTime());
  const [seasonalEffectsEnabled, setSeasonalEffectsEnabled] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('seasonalEffectsEnabled')) ?? true;
    } catch (e) {
      console.error("Failed to parse seasonalEffectsEnabled from localStorage", e);
      return true;
    }
  });

  useEffect(() => {
    localStorage.setItem('seasonalEffectsEnabled', JSON.stringify(seasonalEffectsEnabled));
  }, [seasonalEffectsEnabled]);

  const toggleCategory = (cat) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const [showOnboardingModal, setShowOnboardingModal] = useState(false); // NEW STATE

  useEffect(() => {
    localStorage.setItem("formCollapsedCategories", JSON.stringify(collapsedCategories));
  }, [collapsedCategories]);

  // Effect to check onboarding status
  useEffect(() => {
    const onboardingComplete = localStorage.getItem('onboardingComplete') === 'true';
    if (!onboardingComplete) {
      setShowOnboardingModal(true);
    }
  }, []); // Empty dependency array to run only once on mount

  const handleOnboardingComplete = (preferences) => {
    localStorage.setItem('onboardingComplete', 'true');
    setShowOnboardingModal(false);
    // Optionally, use preferences to set initial form, etc.
    if (preferences.defaultForm) {
      // Find the form object in forms based on preferences.defaultForm (firebaseKey)
      const defaultFormObj = forms.find(form => form.firebaseKey === preferences.defaultForm);
      if (defaultFormObj) {
        setSelectedForm(defaultFormObj);
        setFormValues({});
      }
    }
    showNotification('Welcome! Your preferences have been saved.', 'success');
  };

  const handleOnboardingSkip = () => {
    localStorage.setItem('onboardingComplete', 'true'); // Mark as complete even if skipped
    setShowOnboardingModal(false);
    showNotification('Onboarding skipped. You can always set preferences later.', 'info');
  };

  // Then other hooks
  const { showNotification, removeNotification } = useNotification();
  const [isUploading, setIsUploading] = useState(false);

let {
  user,
  isAuthenticated,
  isPhmcMember,
  characterName,
  factionRank,
  selectOptions: authSelectOptions
} = useGtaWorldAuth();
let { 
  agencyDataStore, 
  phmcListData, 
  coronerListData: originalCoronerListData,
  selectOptions: dataContextSelectOptions  // ← Pull selectOptions from useData too!
} = useData();
  const isDevelopment = process.env.NODE_ENV === 'development';
  let isCoronerForDev = null;

    const getCurrentReportAuthor = useCallback(() => {
        return characterName;
    }, [characterName]);

const finalSelectOptions = { 
  ...(dataContextSelectOptions || {}), 
  ...(authSelectOptions || {}) 
};
    const coronerListData = useMemo(() => {
      if (isDevelopment && selectedForm?.accessType === "Coroner") {
          return [{
              name: "Dr. Crime (Dev Coroner)",
              rank: "Chief Dev Examiner",
              badge: "DEV666"
          }, ...originalCoronerListData];
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

    const modalCloseTimer = React.useRef(null);

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
        formValues,
        setFormValues,
        null, // bbCodeVersion is not relevant for dynamic forms
        () => {}, // setBbCodeVersion placeholder
        () => '', // getBBCodeContent placeholder
        getCurrentReportAuthor,
        () => ({}), // filterFormData placeholder
        finalSelectOptions, // Pass finalSelectOptions
        showNotification,
        removeNotification,
        () => {}, // setShowEasterEggModal placeholder
        () => {}, // setEasterEggType placeholder
        () => {}, // sendEasterEggNotification placeholder
        modalCloseTimer,
        selectedForm
    );



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

  // Effect to save form progression to localStorage
  useEffect(() => {
    if (selectedForm?.firebaseKey && Object.keys(formValues).length > 0) {
      localStorage.setItem(`form_progression_${selectedForm.firebaseKey}`, JSON.stringify(formValues));
    } else if (selectedForm?.firebaseKey) {
        // If formValues are empty, ensure no old progression is left for this form.
        localStorage.removeItem(`form_progression_${selectedForm.firebaseKey}`);
    }
  }, [formValues, selectedForm?.firebaseKey]);

  // Effect to manage tempPatientName based on selections
  useEffect(() => {
    let nameToSet = '';
    if (patientType === 'civilian' && civilianNames.length > 0) {
      nameToSet = civilianNames[currentCivilianIndex];
    } else if (patientType === 'phmc' && phmcNames.length > 0) {
      nameToSet = phmcNames[currentPhmcIndex];
    } else if (patientType === 'gtaw' || patientType === 'coroner') {
      nameToSet = characterName || '';
    }
    setTempPatientName(nameToSet);
  }, [patientType, currentCivilianIndex, currentPhmcIndex, civilianNames, phmcNames, characterName]);





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
      case "coroner":
        isAuthenticated = true;
        isPhmcMember = true;
        characterName = "Dr. Crime (Dev Coroner)";
        factionRank = 10;
        user = { username: "coroner_dev", id: 666, ...user };
        isCoronerForDev = true;
        break;
      case "gtaw": // Fallback for GTAW Character
      default:
        // No override, use actual GTAW auth data
        break;
    }
  }
  // --- DEV OVERRIDE END ---

  const isCoroner = React.useMemo(() => {
    if (isCoronerForDev !== null) return isCoronerForDev; // Dev override takes precedence
    if (!isAuthenticated || !tempPatientName || coronerListData.length === 0) return false; // Use tempPatientName
    return coronerListData.some(coroner => coroner.name?.toLowerCase() === tempPatientName.toLowerCase()); // Use tempPatientName
  }, [isAuthenticated, tempPatientName, coronerListData, isCoronerForDev]);

  const isPatientForm = useMemo(() => {
    return selectedForm?.accessType === 'Civilian' ||
           selectedForm?.category?.includes('Patient') ||
           selectedForm?.category?.includes('Medical');
  }, [selectedForm]);

  const userHasMultiplePhmcCharacters = useMemo(() => {
    return user?.characterArray?.length > 1;
  }, [user]);

  const { generatedBBCode, generatedTitle, showBBCode, setShowBBCode, generateBBCode } = useBbcodeGenerator(
    selectedForm,
    formValues,
    finalSelectOptions,
    agencyDataStore // Pass agencyDataStore
  );
useEffect(() => {
  if (!selectedForm || !generatedTitle) return;

  // List of fields that can have attached reports (add more if needed)
  const reportFields = ['deathReport', 'additionalReports', 'attachedReports', 'coronerReport'];

  const hasAttachedReports = reportFields.some(field => 
    formValues[field] && formValues[field].includes('[altspoiler=') // or any marker
  );

  if (hasAttachedReports) {
    generateBBCode(); // ← Re-run title generation!
  }
}, [formValues, selectedForm, generatedTitle, generateBBCode]);
    const {
        showEmsBingoModal, setShowEmsBingoModal,
    } = useModal();
    
  // Save filters to localStorage
  useEffect(() => {
    localStorage.setItem("formSearchTerm", searchTerm);
  }, [searchTerm]);
  
  useEffect(() => {
    localStorage.setItem("formShowRestricted", String(showRestricted));
  }, [showRestricted]);

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

  // Derive and group forms by category, and apply search/restriction filters
  const [groupedForms, notDisplayedFormsDetails] = React.useMemo(() => { // MODIFIED: Return an array
    const categoriesMap = {};
    const tempNotDisplayedFormsDetails = []; // NEW: Array to store details of forms not displayed

    forms.forEach(form => {
      const matchesSearchTerm = form.name && form.name.toLowerCase().includes(searchTerm.toLowerCase());
      const isRestricted = form.accessType === "PHMC" || form.accessType === "Coroner";
      const hasRequiredAccess = isAuthenticated && (isPhmcMember || (user && user.faction));

      let shouldDisplay = false;
      let reason = "Unknown reason"; // Default reason

      // Filter out hidden forms unless in development mode
      if (form.isHidden && !isDevelopment) {
          shouldDisplay = false;
          reason = "Hidden form (not in dev mode)";
      } else if (isDevelopment && isRestricted && hasRequiredAccess) {
          shouldDisplay = true;
          reason = "Authorized dev role"; // Explicit reason for display
      } else if (!isRestricted) {
          shouldDisplay = true;
          reason = "Not restricted"; // Explicit reason for display
      } else { // Form is restricted
          shouldDisplay = hasRequiredAccess; // This was the last change
          if (!hasRequiredAccess) {
              reason = "No permission (restricted form)";
          } else {
              reason = "Has permission (restricted form)"; // Explicit reason for display
          }
      }

      if (matchesSearchTerm && shouldDisplay) {
        const categoryName = form.category || "Uncategorized";
        if (!categoriesMap[categoryName]) {
          categoriesMap[categoryName] = [];
        }
        categoriesMap[categoryName].push(form);
      } else {
          // If not displayed, add to tempNotDisplayedFormsDetails with the reason
          let finalReason = reason;
          if (!matchesSearchTerm) {
              finalReason = `Does not match search term: "${searchTerm}"`;
          } else if (!shouldDisplay && reason === "Unknown reason") {
              // Catch-all for any missed scenarios
              finalReason = "Filtering logic prevented display";
          }
          tempNotDisplayedFormsDetails.push({ name: form.name, reason: finalReason });
      }
    });

    // Sort categories and forms within categories
    const sortedCategoryNames = Object.keys(categoriesMap).sort((a, b) => {
        // "Uncategorized" at the end
        if (a === "Uncategorized") return 1;
        if (b === "Uncategorized") return -1;
        return a.localeCompare(b);
    });

    const sortedGroupedForms = {};
    sortedCategoryNames.forEach(catName => {
        sortedGroupedForms[catName] = categoriesMap[catName].sort((a, b) => a.name.localeCompare(b.name));
    });

    return [sortedGroupedForms, tempNotDisplayedFormsDetails]; // MODIFIED: Return both
  }, [forms, searchTerm, isAuthenticated, isPhmcMember, isDevelopment, user]); // Removed showRestricted from dependencies

  // DEBUG LOGGING START
  useEffect(() => {
    const viewableCategories = Object.keys(groupedForms);
    const viewableFormsCount = Object.values(groupedForms).flat().length;
    console.log(
        "[FormHandler Debug] Auth Status:",
        {
            isAuthenticated,
            isPhmcMember,
            userFaction: user?.faction,
            employeeName: tempPatientName
        },
        "| Viewable Forms:",
        {
            categories: viewableCategories,
            totalForms: viewableFormsCount,
            formsByCategory: groupedForms,
            notDisplayedForms: notDisplayedFormsDetails // NEW: Include reasons for forms not displayed
        }
    );
  }, [groupedForms, notDisplayedFormsDetails, isAuthenticated, isPhmcMember, user, tempPatientName]);
  // DEBUG LOGGING END

  // DEBUG LOGGING START
  useEffect(() => {
    const viewableCategories = Object.keys(groupedForms);
    const viewableFormsCount = Object.values(groupedForms).flat().length;
    console.log(
        "[FormHandler Debug] Auth Status:",
        {
            isAuthenticated,
            isPhmcMember,
            userFaction: user?.faction,
            employeeName: tempPatientName
        },
        "| Viewable Forms:",
        {
            categories: viewableCategories,
            totalForms: viewableFormsCount,
            formsByCategory: groupedForms
        }
    );
  }, [groupedForms, isAuthenticated, isPhmcMember, user, tempPatientName]);
  // DEBUG LOGGING END

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


        // Find the actual field names from the selectedForm's fields, case-insensitively
        const actualPatientNameField = findFieldNameCaseInsensitive(selectedForm.fields, 'patientName');
        const actualEmployeeNameField = findFieldNameCaseInsensitive(selectedForm.fields, 'employeeName');
        const actualPhmcEmployeeField = findFieldNameCaseInsensitive(selectedForm.fields, 'phmcEmployee');
        const actualCoronerEmployeeField = findFieldNameCaseInsensitive(selectedForm.fields, 'coronerEmployee');

        // Logic for auto-filling PHMC/Coroner Employee Name
        if (selectedForm.accessType === "PHMC" || selectedForm.accessType === "Coroner") {
          // Prioritize actualPhmcEmployeeField or actualCoronerEmployeeField if they exist
          let targetEmployeeNameField = null;
          if (selectedForm.accessType === "PHMC" && actualPhmcEmployeeField) {
            targetEmployeeNameField = actualPhmcEmployeeField;
          } else if (selectedForm.accessType === "Coroner" && actualCoronerEmployeeField) {
            targetEmployeeNameField = actualCoronerEmployeeField;
          } else if (actualEmployeeNameField) { // Fallback to generic employeeName if specific not found
            targetEmployeeNameField = actualEmployeeNameField;
          }

          if (targetEmployeeNameField && tempPatientName && !prevFormValues[targetEmployeeNameField]) {
            updates[targetEmployeeNameField] = tempPatientName;
          }
        }
        // Logic for auto-filling Civilian Patient Name
        else if (selectedForm.accessType === "Civilian") {
          // Use actualPatientNameField if found, otherwise fall back to a default 'patientName'
          const targetPatientNameField = actualPatientNameField || 'patientName';

          if (tempPatientName && prevFormValues[targetPatientNameField] !== tempPatientName) {
            updates[targetPatientNameField] = tempPatientName;
          }
        }

        // Check if the form is a coroner form by its category and explicitly handle coronerEmployee details
        const isCoronerForm = selectedForm.category === 'DMEC';
        if (isCoronerForm && tempPatientName) { // Always attempt to set if it's a coroner form and a name is available
          const targetCoronerEmployeeField = actualCoronerEmployeeField || 'coronerEmployee';
          const targetCoronerRankField = 'coronerRank'; // Always use this key
          const targetCoronerBadgeField = 'coronerBadge'; // Always use this key

          if (!prevFormValues[targetCoronerEmployeeField] || prevFormValues[targetCoronerEmployeeField] !== tempPatientName) {
            updates[targetCoronerEmployeeField] = tempPatientName;
          }

          const matchedCoroner = coronerListData.find(coroner =>
            coroner.name?.toLowerCase() === tempPatientName.toLowerCase()
          );

          if (matchedCoroner) {
            updates[targetCoronerRankField] = matchedCoroner.rank || '';
            updates[targetCoronerBadgeField] = matchedCoroner.badge || '';
          } else if (factionRank) {
            updates[targetCoronerRankField] = factionRank;
            if (shouldBypassDataCheck && tempPatientName.includes("Dev Coroner")) {
                updates[targetCoronerBadgeField] = "DEV666_BADGE";
            } else {
                updates[targetCoronerBadgeField] = '';
            }
          }
        }

        if (Object.keys(updates).length > 0) {
          return { ...prevFormValues, ...updates };
        }
        return prevFormValues;
      });
    }
  }, [isAuthenticated, tempPatientName, factionRank, phmcListData, coronerListData, selectedForm, setFormValues, isDevelopment, patientType, findFieldNameCaseInsensitive]);

    const switchCivilianName = useCallback(() => {
    setCurrentCivilianIndex((prevIndex) => (prevIndex + 1) % civilianNames.length);
  }, [civilianNames]);

  const cyclePhmcName = useCallback(() => {
    setCurrentPhmcIndex((prevIndex) => (prevIndex + 1) % phmcNames.length);
  }, [phmcNames]);

  const PATIENT_TYPES_CYCLE = ['gtaw', 'civilian', 'phmc', 'coroner'];

  const cyclePatientType = useCallback(() => {
    const currentIndex = PATIENT_TYPES_CYCLE.indexOf(patientType);
    const nextIndex = (currentIndex + 1) % PATIENT_TYPES_CYCLE.length;
    setPatientType(PATIENT_TYPES_CYCLE[nextIndex]);
  }, [patientType]);

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
  const handleDiagramUpload = useCallback(async (dataUrl) => {
    try {
        const url = await uploadDataUrlToImgBB(dataUrl);
        return [url]; // Return as an array to match modal's expectation
    } catch (error) {
        showNotification('Failed to upload diagram image.', 'error');
        console.error("Autopsy Diagram upload failed:", error); // Add more specific logging
        return [];
    }
}, [showNotification]);

  const { saveReport: saveNewReport } = useFormSaver();

  const copyAndSaveReport = useCallback(async () => {
    if (generatedBBCode) {
      // First, save the report
      await saveNewReport(selectedForm, formValues, generatedTitle, generatedBBCode);
      
      // Then, copy to clipboard
      try {
        await navigator.clipboard.writeText(generatedBBCode);
        // The save function already shows a notification, so we might not need another one.
        // Or, we can change the save notification and add a more specific one here.
        // For now, relying on the notification from the saver hook.
      } catch (err) {
        console.error('Failed to copy BBCode: ', err);
        showNotification('Report saved, but failed to copy BBCode to clipboard.', 'warning');
      }
    }
  }, [generatedBBCode, selectedForm, formValues, generatedTitle, saveNewReport, showNotification]);

  // Determine current seasonal effect
  const { effect } = seasonalEvents({});

  return (
    <div className={styles.container}>
      {seasonalEffectsEnabled && effect}
      {/* NEW: OnboardingModal */}
      <OnboardingModal
        show={showOnboardingModal}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
        showNotification={showNotification}
      />
      <EmsBingoModal
        show={showEmsBingoModal}
        onHide={() => setShowEmsBingoModal(false)}
      />
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
        loadReportForUser={loadReportForUser}
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

          {isDevelopment && (
            <button
              onClick={cyclePatientType}
              className={`${formStyles.filterButton} ${formStyles.devModeButton}`} // Add a new style for dev mode button
              title={`Current Dev Mode: ${patientType}`}
            >
              Dev Mode: {patientType.charAt(0).toUpperCase() + patientType.slice(1)}
            </button>
          )}


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
                          className={`${styles.categoryHeader} ${
                            collapsedCategories[categoryName] ? styles.collapsed : ""
                           }`}
                           onClick={() => toggleCategory(categoryName)}
                         >
                           {categoryName} ({formsInCategory.length})
                         </div>
                       {!collapsedCategories[categoryName] && (
                         <ul className={styles.protocolList}> {/* Reusing protocolList style for now */}       
                           {formsInCategory.map((form) => (
                             <li
                               key={form.firebaseKey}
                               onClick={() => {
                                 setSelectedForm(form);
                                 // Load saved progression or reset
                                 const savedProgression = localStorage.getItem(`form_progression_${form.firebaseKey}`);
                                 setFormValues(savedProgression ? JSON.parse(savedProgression) : {});
                                 setShowBBCode(false);
                               }}
                               className={`${styles.formCard} ${selectedForm?.firebaseKey === form.firebaseKey 
      ? styles.selected : ""}`}
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
        {/* CENTER: Selected Form */}
        <div className={styles.mainContent}>
          {!isAuthenticated && (
            <div style={{
              backgroundColor: '#f8d7da', // Light red background
              color: '#721c24', // Dark red text
              border: '1px solid #f5c6cb', // Border color
              borderRadius: '0.25rem',
              padding: '1rem',
              marginBottom: '1rem',
              textAlign: 'center',
              fontWeight: 'bold'
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
                                <Form.Check
                                  type="radio"
                                  id="typeCoroner"
                                  label="Coroner Only"
                                  name="patientTypeSelection"
                                  value="coroner"
                                  checked={patientType === 'coroner'}
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
                                  <Button variant="outline-light" size="sm" onClick={() => switchCivilianName()} title="Switch Civilian Name">
                                    <i className="fas fa-sync-alt"></i>
                                  </Button>
                                )}
                                {patientType === 'phmc' && phmcNames.length > 1 && (
                                  <Button variant="outline-light" size="sm" onClick={() => switchPhmcName()} title="Switch PHMC Name">
                                    <i className="fas fa-sync-alt"></i>
                                  </Button>
                                )}
                              </div>
                            </div>
              
                            <div style={{ margin: "0 -8px" }}>
                              {selectedForm.fields?.map((field, index) => (
                                <FormFieldRenderer
                                  key={field.name}
                                  field={field}
                                  selectedForm={selectedForm}
                                  formValues={formValues}
                                  handleChange={handleChange}
                                  finalSelectOptions={finalSelectOptions}
                                  currentUtcTime={currentUtcTime}
                                  agencyDataStore={agencyDataStore} // New prop
                                  toggleSavedReports={toggleSavedReports}
                                  showNotification={showNotification}
                                  isUploading={isUploading}
                                  handleDiagramUpload={handleDiagramUpload}
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
