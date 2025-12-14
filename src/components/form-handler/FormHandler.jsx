import React, { useState, useEffect, useCallback, useMemo } from "react";
import { database } from "../../firebase";
import { ref, onValue } from "firebase/database";
import useGtaWorldAuth from "../../hooks/useGtaWorldAuth";
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
import * as Sentry from "@sentry/react";
import FormQuickLinks from './FormQuickLinks';
import PermanentNotification from '../PermanentNotification';
import BugReportModal from '../BugReportModal';
import { validateForm } from '../../utils/formValidation';
import { sendDiscordWebhook } from '../../utils/webhookUtils';
import { useInactivityReload } from '../../hooks/useInactivityReload'; // NEW IMPORT

// Critical CSS imports
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import '../../App.css';
import '../../buttons.css';
import styles from "../ems-dashboard/EmsDashboard.module.css";
import formStyles from './FormHandler.module.css';



const FormHandler = () => {
  useInactivityReload(); // NEW HOOK CALL

  const [selectedForm, setSelectedForm] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem("formSearchTerm") || "");
  const [collapsedCategories, setCollapsedCategories] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("formCollapsedCategories")) || {};
    } catch (e) {
      console.error("Error parsing formCollapsedCategories from localStorage:", e);
      Sentry.captureException(e, { extra: { context: 'FormHandler - parsing formCollapsedCategories' } });
      return {};
    }
  });
  const [seasonalEffectsEnabled, setSeasonalEffectsEnabled] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('seasonalEffectsEnabled')) ?? true;
    } catch (e) {
      console.error("Failed to parse seasonalEffectsEnabled from localStorage", e);
      Sentry.captureException(e, { extra: { context: 'FormHandler - parsing seasonalEffectsEnabled' } });
      return true;
    }
  });
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [currentUtcTime, setCurrentUtcTime] = useState(getUtcFormattedDateTime());
  const [isUploading, setIsUploading] = useState(false);
  const [keepCredentials, setKeepCredentials] = useState(() => {
    return localStorage.getItem('phmc_gtaw_oauth_persist_enabled') === 'true';
  });
  const [showBugReportModal, setShowBugReportModal] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [isAutoUpdatingBbcode, setIsAutoUpdatingBbcode] = useState(false);

  // Hooks
  const { showNotification, removeNotification } = useNotification();
  const {
    user,
    isAuthenticated,
    isPhmcMember,
    characterName,
    swappableCharacters,
    selectOptions: authSelectOptions,
  } = useGtaWorldAuth();

  useEffect(() => {
    const hasSeenPrompt = localStorage.getItem('seenKeepCredentialsPrompt') === 'true';
    if (isPhmcMember && !hasSeenPrompt) {
      showNotification(
        'Do you want us to remember your employee credentials across different forms?',
        'info',
        null,
        [
          {
            label: 'Keep Credentials',
            handler: (id) => {
              localStorage.setItem('phmc_gtaw_oauth_persist_enabled', 'true');
              setKeepCredentials(true);
              localStorage.setItem('seenKeepCredentialsPrompt', 'true');
              removeNotification(id);
              showNotification('Your credentials will be preserved when switching forms.', 'success');
            },
          },
          {
            label: 'Dismiss',
            handler: (id) => {
              localStorage.setItem('phmc_gtaw_oauth_persist_enabled', 'false');
              setKeepCredentials(false);
              localStorage.setItem('seenKeepCredentialsPrompt', 'true');
              removeNotification(id);
            },
          },
        ]
      );
    }
  }, [isPhmcMember, showNotification, removeNotification, setKeepCredentials]);

  const oauthFirstName = user?.faction?.firstname || user?.activeCharacter?.firstname || null;
  const oauthLastName = user?.faction?.lastname || user?.activeCharacter?.lastname || null;
  const { 
    agencyDataStore, 
    phmcListData, 
    coronerListData: originalCoronerListData,
    selectOptions: dataContextSelectOptions,
    formsData
  } = useData();
  const { showEmsBingoModal, setShowEmsBingoModal } = useModal();
  const { saveReport: saveNewReport } = useFormSaver();
  const isDevelopment = process.env.NODE_ENV === 'development';
  const modalCloseTimer = React.useRef(null);

  const isPatientForm = useMemo(() => {
    return selectedForm?.accessType === 'Civilian' ||
           selectedForm?.category?.includes('Patient') ||
           selectedForm?.category?.includes('Medical');
  }, [selectedForm]);

  // Memos
  const finalSelectOptions = useMemo(() => {
    const derivedAgencyOptions = {};
    if (agencyDataStore) {
      // Assuming agencyDataStore is an object where keys are IDs (e.g., "lspd", "DAO")
      // and values are objects containing properties like 'fullName'
      derivedAgencyOptions.agencies = Object.entries(agencyDataStore).map(([key, agency]) => ({
        label: agency.fullName || key, // Use fullName for label, fallback to key
        value: key, // The key (e.g., "lspd", "DAO")
      }));
    }

    return {
      ...(dataContextSelectOptions || {}),
      ...(authSelectOptions || {}),
      ...derivedAgencyOptions, // Add the derived agencies list here
    };
  }, [dataContextSelectOptions, authSelectOptions, agencyDataStore]);

  const coronerListData = useMemo(() => {
    if (isDevelopment && selectedForm?.accessType === "Coroner") {
        return [{ name: "Dr. Crime (Dev Coroner)", rank: "Chief Dev Examiner", badge: "DEV666" }, ...originalCoronerListData];
    }
    return originalCoronerListData;
  }, [isDevelopment, selectedForm, originalCoronerListData]);

  const employeeOptions = useMemo(() => {
      const validPhmcData = phmcListData.filter(emp => emp && emp.name && typeof emp.name === 'string');
      const validCoronerData = coronerListData.filter(emp => emp && emp.name && typeof emp.name === 'string');

      // Helper to enrich employee data with firstname and lastname from OAuth if available
      const enrichEmployeeData = (employeeList, type) => { // Added type for clearer logs
          return employeeList.map(emp => {
              const matchingChar = swappableCharacters.find(char => 
                  char.characterName === emp.name || 
                  (char.firstname && char.lastname && `${char.firstname} ${char.lastname}`.trim() === emp.name)
              );
              if (matchingChar) {
                  return {
                      ...emp,
                      firstname: matchingChar.firstname,
                      lastname: matchingChar.lastname,
                  };
              }
              return emp; 
          });
      };

      const enrichedPhmcData = enrichEmployeeData(validPhmcData, 'PHMC');
      const enrichedCoronerData = enrichEmployeeData(validCoronerData, 'Coroner');

      const phmcOptions = enrichedPhmcData.map(emp => ({
          label: emp.name,
          value: emp.name,
          firstname: emp.firstname, 
          lastname: emp.lastname,   
      }));
      const coronerOptions = enrichedCoronerData.map(emp => ({
          label: emp.name,
          value: emp.name,
          firstname: emp.firstname, 
          lastname: emp.lastname,   
      }));
      
      return [
          { label: 'PHMC Staff', options: phmcOptions },
          { label: 'Coroner Staff', options: coronerOptions }
      ];
  }, [phmcListData, coronerListData, swappableCharacters]);

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
    agencyDataStore,
    user // Pass the user object here
  );

  // Callbacks
  const toggleCategory = (cat) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleOnboardingComplete = (preferences) => {
    localStorage.setItem('onboardingComplete', 'true');
    setShowOnboardingModal(false);
    if (preferences.defaultForm) {
      const defaultFormObj = formsData.find(form => form.firebaseKey === preferences.defaultForm);
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

  const sendBingoWebhook = useCallback(async (payload) => {
    console.log("sendBingoWebhook called with payload:", payload);
    // TODO: Implement actual webhook sending logic here
    showNotification('Bingo webhook sent (dev mode)!', 'info');
  }, [showNotification]);

  const sendPhraseRequestWebhook = useCallback(async (payload) => {
    console.log("sendPhraseRequestWebhook called with payload:", payload);
    // TODO: Implement actual phrase request webhook sending logic here
    showNotification('Phrase request webhook sent (dev mode)!', 'info');
  }, [showNotification]);

  const updateEmployeeCredentials = useCallback((employeeName, empType) => {
    const updates = {};
    updates[`${empType}Employee`] = employeeName || ''; 

    if (employeeName) {
      const selectedOption = employeeOptions.flatMap(group => group.options).find(opt => opt.value === employeeName);
      if (selectedOption) {
        // Find the full employee data from the original list (phmcListData or coronerListData) for rank/badge
        const fullEmployeeData = [...phmcListData, ...coronerListData].find(e => e.name === employeeName);

        if (fullEmployeeData) {
          updates[`${empType}Rank`] = fullEmployeeData.rank || '';
          updates[`${empType}Badge`] = fullEmployeeData.badge || '';
          updates[`${empType}Discord`] = fullEmployeeData.discord || ''; 
          updates[`${empType}PHNumber`] = fullEmployeeData.phNumber || '';
        } else {
          // If fullEmployeeData is not found (e.g., employee not in current list), ensure fields are cleared or default
          updates[`${empType}Rank`] = '';
          updates[`${empType}Badge`] = '';
          updates[`${empType}Discord`] = '';
          updates[`${empType}PHNumber`] = '';
        }
        
        // Add firstname and lastname from the selectedOption itself
        updates[`${empType}FirstName`] = selectedOption.firstname || '';
        updates[`${empType}LastName`] = selectedOption.lastname || '';
      } else {
        // If selectedOption not found (employeeName provided but no matching option), clear dependent fields
        updates[`${empType}Rank`] = '';
        updates[`${empType}Badge`] = '';
        updates[`${empType}FirstName`] = '';
        updates[`${empType}LastName`] = '';
        updates[`${empType}Discord`] = '';
        updates[`${empType}PHNumber`] = '';
      }
    } else {
      // If employeeName is null/empty, clear all related fields
      updates[`${empType}Rank`] = '';
      updates[`${empType}Badge`] = '';
      updates[`${empType}FirstName`] = '';
      updates[`${empType}LastName`] = '';
      updates[`${empType}Discord`] = '';
      updates[`${empType}PHNumber`] = '';
    }
    return updates;
  }, [employeeOptions, phmcListData, coronerListData]); // Dependencies for useCallback

  const handleSelectChange = useCallback((selectedOption, actionMeta) => {
    const name = selectedOption ? selectedOption.value : '';
    // fieldName is implicitly 'coronerEmployee' or 'phmcEmployee' based on where the select is rendered
    
    // Use the helper to get all relevant credential updates
    const credentialUpdates = updateEmployeeCredentials(name, employeeType);
    
    setFormValues(prev => ({...prev, ...credentialUpdates}));
  }, [employeeType, updateEmployeeCredentials, setFormValues]);

  const handleDiagramUpload = useCallback(async (dataUrl) => {
    try {
        const url = await uploadDataUrlToImgBB(dataUrl);
        return [url];
    } catch (error) {
        showNotification('Failed to upload diagram image.', 'error');
        console.error("Autopsy Diagram upload failed:", error);
        Sentry.captureException(error, { extra: { context: 'FormHandler - handleDiagramUpload' } });
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
        Sentry.captureException(err, { extra: { context: 'FormHandler - copyAndSaveReport clipboard' } });
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
    if (keepCredentials) {
        credentialFieldsToPreserve.forEach(fieldName => {
            if (formValues[fieldName]) {
                preservedValues[fieldName] = formValues[fieldName];
            }
        });
    }
    
    setFormValues(preservedValues);
    if (selectedForm?.firebaseKey) {
        localStorage.removeItem(`form_progression_${selectedForm.firebaseKey}`);
    }
    setShowBBCode(false);
    setIsAutoUpdatingBbcode(false);
    showNotification('Form cleared!', 'info');
  }, [formValues, employeeType, setFormValues, selectedForm?.firebaseKey, showNotification, keepCredentials, setShowBBCode, setIsAutoUpdatingBbcode]);

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
      pendingReportAttachmentCallback,
      currentAttachmentTargetFieldRef // Add this line
  } = useReportManagement(
      formValues, setFormValues, null, () => {}, () => '', getCurrentReportAuthor, () => ({}), finalSelectOptions,
      showNotification, removeNotification, () => {}, () => {}, () => {}, modalCloseTimer, selectedForm,
      () => forms, // Changed from forms to () => forms
      setSelectedForm
  );

  const handleNavToggleSavedReports = () => {
    const type = selectedForm?.accessType === 'Coroner' ? 'Coroner' : 'PHMC';
    toggleSavedReports(null, type, null);
  };

  // Effects
  useEffect(() => {
    localStorage.setItem('seasonalEffectsEnabled', JSON.stringify(seasonalEffectsEnabled));
  }, [seasonalEffectsEnabled]);

  useEffect(() => {
    localStorage.setItem("formCollapsedCategories", JSON.stringify(collapsedCategories));
  }, [collapsedCategories]);

  useEffect(() => {
    if (selectedForm?.name) {
      localStorage.setItem('lastSelectedFormName', selectedForm.name);
    }
  }, [selectedForm]);

  useEffect(() => {
    const onboardingComplete = localStorage.getItem('onboardingComplete') === 'true';
    if (!onboardingComplete) {
      setShowOnboardingModal(true);
    }
  }, []);

  useEffect(() => {
    const handlePaste = async (e) => {
      // If the paste is happening inside an ImageUploader, let it handle it.
      if (e.target.closest('.image-uploader-container')) {
          return;
      }
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
      const targetField = fieldConfig.linkedImageField || fieldName; // This determines which field in formValues gets the image URL.

      console.log(`[handlePaste] Processing paste for fieldName: ${fieldName}, linkedImageField: ${fieldConfig.linkedImageField}, targetField: ${targetField}`);

      try {
        setIsUploading(true);
        const url = await uploadImageToImgBB(imageFile);
        
        console.log(`[handlePaste] Image uploaded. URL: ${url}`);
        console.log(`[handlePaste] formValues BEFORE image URL update for ${targetField}:`, JSON.parse(JSON.stringify(formValues)));

        setFormValues(prev => {
          const current = prev[targetField] || [];
          const arr = Array.isArray(current) ? current : (typeof current === 'string' ? current.split(', ').filter(Boolean) : []);
          const updatedImages = [...arr, url];
          
          console.log(`[handlePaste] setFormValues for ${targetField}: new images array:`, updatedImages);
          
          return { ...prev, [targetField]: updatedImages };
        });
        
        // Log formValues state AFTER setFormValues call
        // Note: setFormValues is async, so this log will reflect the state from the previous render cycle,
        // but the internal prev argument in the setter function gives the accurate "before" state.
        // For current formValues after commit, a subsequent useEffect would be needed.
        
        showNotification("Image pasted & uploaded!", "success");

        const insertText = `[img]${url}[/img]`
        const newValue = activeEl.value.substring(0, activeEl.selectionStart) + (activeEl.value ? "\n" : "") + insertText + "\n" + activeEl.value.substring(activeEl.selectionEnd);
        
        console.log(`[handlePaste] New textarea value for ${fieldName} (including img tag):`, newValue);

        activeEl.value = newValue; // Update the DOM element
        const event = new Event('input', { bubbles: true });
        activeEl.dispatchEvent(event); // Trigger React's onChange for the textarea

      } catch (err) {
        console.error("Upload failed:", err);
        Sentry.captureException(err, { extra: { context: 'FormHandler - handlePaste image upload' } });
        showNotification("Failed to upload image", "error");
      } finally {
        setIsUploading(false);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [selectedForm, showNotification, setIsUploading, setFormValues, formValues]); // Added formValues to dependencies to get latest state in log

  useEffect(() => {
    if (selectedForm?.firebaseKey && Object.keys(formValues).length > 0) {
      localStorage.setItem(`form_progression_${selectedForm.firebaseKey}`, JSON.stringify(formValues));
    } else if (selectedForm?.firebaseKey) {
        localStorage.removeItem(`form_progression_${selectedForm.firebaseKey}`);
    }
  }, [formValues, selectedForm?.firebaseKey]);

  useEffect(() => {
    // Debounced effect for auto-updating BBCode
    if (isAutoUpdatingBbcode) {
      const handler = setTimeout(() => {
        generateBBCode();
      }, 300); // Wait for 300ms of inactivity before generating

      // Cleanup function to cancel the timer if the user is still typing
      return () => {
        clearTimeout(handler);
      };
    }
  }, [formValues, isAutoUpdatingBbcode, generateBBCode]); // Reruns on every change to formValues

  useEffect(() => {
    // Only proceed if a form is selected and user is authenticated for PHMC/Coroner forms
    if (!selectedForm || !isAuthenticated || isPatientForm) {
      // If it's a patient form, employee credentials are not relevant here.
      // If not authenticated, we don't have OAuth data to sync.
      // If no form is selected, there's no employeeType context.
      return;
    }

    const currentEmployeeType = selectedForm?.accessType === 'Coroner' ? 'coroner' : 'phmc';
    const employeeNameField = `${currentEmployeeType}Employee`;

    // Determine the "source of truth" for the employee name, usually from OAuth
    const oauthEmployeeName = user?.faction?.characterName || user?.activeCharacter?.characterName || null;
    
    setFormValues(currentFormValues => {
      const updates = {};
      
      // Update patientName based on characterName if not a patient form,
      // and if patientName is not already set by patientCharacterSelector.
      if (!isPatientForm && characterName && currentFormValues.patientName !== characterName) {
        // Only set patientName from characterName if patientCharacterSelector hasn't taken precedence
        if (!currentFormValues.patientCharacterSelector) {
            updates.patientName = characterName;
        }
      }

      // Sync employee credentials from OAuth if OAuth name is available
      if (oauthEmployeeName) {
        const currentFormEmployeeName = currentFormValues[employeeNameField];
        const currentFormRank = currentFormValues[`${currentEmployeeType}Rank`];
        const currentFormBadge = currentFormValues[`${currentEmployeeType}Badge`];

        // This is a heuristic: if the name is different, or if *any* of the key derived fields are missing,
        // we should re-derive to ensure consistency.
        const shouldUpdateCredentials = (
            currentFormEmployeeName !== oauthEmployeeName ||
            !currentFormRank || 
            !currentFormBadge 
        );

        if (shouldUpdateCredentials) {
            console.log(`[FormHandler] Syncing credentials for ${currentEmployeeType}. OAuth: ${oauthEmployeeName}, Form: ${currentFormEmployeeName || 'N/A'}`);
            const credentialUpdates = updateEmployeeCredentials(oauthEmployeeName, currentEmployeeType);
            Object.assign(updates, credentialUpdates); // Merge credential updates
        }
      } else {
        // If OAuth name becomes unavailable (e.g., user logs out or character changes)
        // and form still has employee name, clear it.
        if (currentFormValues[employeeNameField]) {
            console.log(`[FormHandler] Clearing credentials for ${currentEmployeeType} as OAuth data is unavailable.`);
            const credentialUpdates = updateEmployeeCredentials('', currentEmployeeType); // Pass empty name to clear
            Object.assign(updates, credentialUpdates);
        }
      }

      if (Object.keys(updates).length > 0) {
          return { ...currentFormValues, ...updates };
      } else {
          return currentFormValues; // No change
      }
    });

  }, [user, isAuthenticated, selectedForm, isPatientForm, setFormValues, updateEmployeeCredentials, characterName]);

  // Existing useEffect for patient character selector
  useEffect(() => {
    if (!selectedForm || !selectedForm.fields) {
      return;
    }

    setFormValues(currentFormValues => {
        const updates = {};
        const patientNameFromSelector = currentFormValues.patientCharacterSelector;

        if (isPatientForm && patientNameFromSelector && currentFormValues.patientName !== patientNameFromSelector) {
            updates.patientName = patientNameFromSelector;
        }

        if (Object.keys(updates).length > 0) {
            return { ...currentFormValues, ...updates };
        } else {
            return currentFormValues;
        }
    });
  }, [selectedForm, isPatientForm, setFormValues, formValues.patientCharacterSelector, formValues.patientName]);

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

  // Effect to synchronize selectedForm with updates from formsData context
  useEffect(() => {
    if (selectedForm && formsData.length > 0) {
      const newVersionOfSelectedForm = formsData.find(form => form.firebaseKey === selectedForm.firebaseKey);
      
      if (newVersionOfSelectedForm) {
        // If the form in context has a more recent timestamp, update our local state
        if (newVersionOfSelectedForm.lastUpdated > selectedForm.lastUpdated) {
          console.log('🔄 Refreshing selected form with updated data from context...');
          setSelectedForm(newVersionOfSelectedForm);
        }
      } else {
        // The currently selected form was not found in the new data (e.g., deleted)
        console.log('🔌 Selected form no longer exists. Clearing selection.');
        setSelectedForm(null);
        showNotification('The selected form has been removed or is no longer available.', 'warning');
      }
    }
  }, [formsData, selectedForm, showNotification]);

  const [groupedForms, notDisplayedFormsDetails] = React.useMemo(() => {
    const categoriesMap = {};
    const tempNotDisplayedFormsDetails = [];

    formsData.forEach(form => {
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
            const isRestricted = form.accessType === "PHMC" || form.accessType === "Coroner" || form.accessType === "Mental Health";
            const hasRequiredAccess = isAuthenticated && (isPhmcMember || (user && user.faction));
            
            if (!isRestricted) {
                shouldDisplay = true;
                reason = "Public form";
            }
            else { // Form is restricted
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
        sortedGroupedForms[catName] = categoriesMap[catName].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    });

    return [sortedGroupedForms, tempNotDisplayedFormsDetails];
  }, [formsData, searchTerm, isAuthenticated, isPhmcMember, isDevelopment, user]);

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

  useEffect(() => {
    if (selectedForm && finalSelectOptions && isDevelopment) { // Only run in dev for now to be safe
      const validationErrors = validateForm(selectedForm, finalSelectOptions);

      if (validationErrors.length > 0) {
        const webhookUrl = import.meta.env.VITE_DEV_WEBHOOK;
        const formName = selectedForm.name;
        const errorList = validationErrors.map(e => `- ${e}`).join('\n');

        const payload = {
          embeds: [
            {
              title: "Form Validation Error Detected",
              color: 15158332, // Red
              fields: [
                {
                  name: "Form Name",
                  value: formName,
                  inline: true,
                },
                {
                    name: "Timestamp (UTC)",
                    value: new Date().toISOString(),
                    inline: true,
                },
                {
                  name: "Errors",
                  value: `\`\`\`\n${errorList}\n\`\`\``,
                },
              ],
              footer: {
                text: "This is an automated notification from the PHMC Forms application.",
              },
            },
          ],
        };

        sendDiscordWebhook(webhookUrl, payload);
        
        // Also notify the dev in the console
        console.warn(`[Form Validation Error] Form "${formName}" has configuration issues:`, validationErrors);
        showNotification(`The form "${formName}" has validation errors. Maintainers have been notified.`, 'warning', 10000);
      }
    }
  }, [selectedForm, finalSelectOptions, isDevelopment, showNotification]);

  return (
    <div className={styles.container}>
      {seasonalEffectsEnabled && effect}
      <OnboardingModal show={showOnboardingModal} onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip} showNotification={showNotification} />
            <EmsBingoModal
              show={showEmsBingoModal}
              onHide={() => setShowEmsBingoModal(false)}
              phmcGroupedOptions={employeeOptions.find(group => group.label === 'PHMC Staff')?.options || []}
              coronerGroupedOptions={employeeOptions.find(group => group.label === 'Coroner Staff')?.options || []}
              currentPhmcEmployee={mainEmployeeName}
              showNotification={showNotification}
              setShowEmployeeModal={setShowEmployeeModal}
              isAdmin={isPhmcMember} // Assuming PHMC members are admins for bingo
              sendBingoWebhook={sendBingoWebhook}
              sendPhraseRequestWebhook={sendPhraseRequestWebhook}
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
        handleReportSelectedForAttachment={handleReportSelectedForAttachment}
        currentCoronerEmployee={formValues.coronerEmployee}
        currentPhmcEmployee={formValues.phmcEmployee}
        filterByBbCodeVersions={reportSelectionFilter}
        preselectedEmployeeType={preselectedEmployeeType}
        reportSelectionFilter={reportSelectionFilter}
        pendingReportAttachmentCallback={pendingReportAttachmentCallback}
        selectedForm={selectedForm}
        attachmentTargetField={currentAttachmentTargetFieldRef.current} // Add this line
      />
      <FormHandlerNavButtons onToggleSavedReports={handleNavToggleSavedReports} />

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
                                'phmcEmployee', 'phmcBadge', 'phmcRank', 'phmcDiscord', 'phmcPHNumber',
                                'coronerEmployee', 'coronerBadge', 'coronerRank', 'coronerDiscord', 'coronerPHNumber'
                              ];
                              const baseValues = {};
                              if (keepCredentials) {
                                credentialFields.forEach(key => {
                                    if (formValues.hasOwnProperty(key)) { // Carry over from current state if the key exists
                                        baseValues[key] = formValues[key];
                                    }
                                });
                              }

                              console.log("Switching form. Preserving base values:", baseValues);

                              const savedProgression = localStorage.getItem(`form_progression_${form.firebaseKey}`);
                              const savedValues = savedProgression ? JSON.parse(savedProgression) : {};
                              
                              console.log("Found saved progression for new form:", savedValues);

                              setSelectedForm(form);
                              setFormValues({ ...baseValues, ...savedValues });
                              setShowBBCode(false);
                              setIsAutoUpdatingBbcode(false);
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
              Please sign in with OAuth to Generate BBCode and Save Reports. REPORT ISSUES TO ALYSON FROST 
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
                {(() => {
                  let fieldsToRender = [...(selectedForm.fields || [])];
                  if (isPatientForm) {
                    const defaultCharacterSelectorField = {
                      name: 'patientCharacterSelector',
                      label: 'Select Patient Character',
                      type: 'character_selector',
                      id: 'synthetic-char-selector',
                      layout: 'full',
                    };
                    fieldsToRender.unshift(defaultCharacterSelectorField);
                  }

                  return fieldsToRender.map((field) => (
                    <FormFieldRenderer
                      key={field.id || field.name} // Use field.id for stability if available, fallback to name
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
                  ));
                })()}
              </div>
              
              <div style={{ textAlign: "center", margin: "3rem 0", display: "flex", justifyContent: "center", gap: "1rem" }}>
                <button onClick={handleClearForm} className={formStyles.clearButton}>
                  Clear Form
                </button>
                <button onClick={() => {
                  generateBBCode();
                  setIsAutoUpdatingBbcode(true);
                  showNotification('Auto-updating BBCode enabled!', 'info', 2000);
                }} className={formStyles.generateButton}>
                  Generate BBCode
                </button>
              </div>
            </>
          )}
        </div>

        <div className={styles.rightPanel}>
          <div style={{ background: "linear-gradient(135deg, #2d1b69, #1e1b4b)", padding: "1.5rem", borderRadius: 12, marginBottom: "1.5rem" }}>
            <h3 style={{ color: "#a78bfa", margin: "0 0 1rem" }}>Signed in as</h3>
            {isPatientForm ? (
              <div style={{ padding: '10px', backgroundColor: '#f59e0b', color: 'black', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold' }}>
                <i className="fas fa-exclamation-triangle" style={{ marginRight: '8px' }}></i>
                Use the Select Patient Character. Employee Credentials are disabled during Patient Files.
              </div>
            ) : (
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
            )}
          </div>

{generatedBBCode ? (
  <button
    onClick={() => setShowBBCode(!showBBCode)}
    className={formStyles.rightPanelButton}
    style={{ background: showBBCode ? "#7c3aed" : "#4c1d95" }}
  >
    {showBBCode ? "Hide" : "Show"} BBCode Preview
  </button>
) : (
  <div style={{ color: "#94a3b8", fontStyle: "italic", padding: "0.75rem" }}>
    Click "Generate BBCode" to preview
  </div>
)}
          <button onClick={copyAndSaveReport} disabled={!generatedBBCode} className={`${formStyles.rightPanelButton} ${generatedBBCode ? formStyles.copy : ''}`}>
            {generatedBBCode ? "Copy BBCode + Save" : "No BBCode Yet"}
          </button>

{generatedBBCode && (
  <>
    {generatedTitle && (
      <div
        style={{
          background: "#0f172a",
          padding: "1.5rem",
          borderRadius: 12,
          color: "#e2e8f0",
          fontSize: "1.1rem",
          fontWeight: "700",
          marginBottom: "1rem",
          whiteSpace: "pre-wrap",
          cursor: "pointer"
        }}
        onClick={() => {
          navigator.clipboard.writeText(generatedTitle);
          showNotification('Title copied to clipboard!', 'success');
        }}
        title="Click to copy title"
      >
        {generatedTitle}
      </div>
    )}

    <FormQuickLinks form={selectedForm} formValues={formValues} agencyDataStore={agencyDataStore} />

    {showBBCode && (
      <pre style={{
        background: "#0f172a",
        padding: "1.5rem",
        borderRadius: 12,
        color: "#e2e8f0",
        fontSize: "0.9rem",
        maxHeight: "60vh",
        overflow: "auto",
        marginTop: "1rem",
        whiteSpace: "pre-wrap"
      }}>
        {generatedBBCode}
      </pre>
    )}
  </>
)}        </div>
      </div>
      <PermanentNotification
        discordLink="https://discord.gg/fg7ssSMkj9"
        onReportBugClick={() => setShowBugReportModal(true)}
      />
      <BugReportModal
        show={showBugReportModal}
        onClose={() => setShowBugReportModal(false)}
        webhookUrl={import.meta.env.VITE_DEV_WEBHOOK}
        showNotification={showNotification}
      />
    </div>
  );
};

export default FormHandler;

