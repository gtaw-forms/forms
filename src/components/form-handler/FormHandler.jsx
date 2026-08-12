import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense, useRef } from "react";
import * as Sentry from "@sentry/react";
import useGtaWorldAuth from "../../hooks/useGtaWorldAuth";
import { useModal } from "../../contexts/ModalProvider";
import { useData } from "../../contexts/DataContext";
import FormFieldRenderer from './FormFieldRenderer';
import LeftSidebarNav from '../UI/LeftSidebarNav';
import useBbcodeGenerator from '../../hooks/useBbcodeGenerator';
import { uploadImageToImgBB } from '../../utils/imageUploadUtils'; 
import { useNotification } from '../../contexts/NotificationContext';
import { getUtcFormattedDateTime } from '../../utils/dateTimeUtils';
import { useReportLoader } from '../../hooks/useReportLoader';
import { useReportActions } from '../../hooks/useReportActions';
import { useReportAttachment } from '../../hooks/useReportAttachment';
import { useFormSaver } from '../../hooks/useFormSaver';
import FormQuickLinks from './FormQuickLinks';
import { validateForm, evaluateFieldVisibility } from '../../utils/formValidation';
import { triggerWebhookProxy } from '../../services/firebaseFunctions';
import { database } from '../../firebase';
import { ref, onValue, get } from 'firebase/database';
import { useInactivityReload } from '../../hooks/useInactivityReload';
import { cleanRankText } from '../../utils/textUtils';
import { resolveEmployeeCredentials } from '../../utils/identityUtils';
import { STORAGE_KEYS } from '../../services/gtaWorldAuth';
import { useAuth } from '../../contexts/AuthContext';
import { useConsent, DEPLOY_TRACKED_FORMS } from '../../hooks/useConsent';

// Must match discord-bot/services/deployState.js DEFER_MS
const QUEUE_DELAY_MIN = 5;
import BotDeployOptInModal from '../Modals/BotDeployOptInModal';
import phmcLogo from '../../assets/phmc.png';
import { decedentItemSchema } from '../../formSchemas/decedentSchema';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '../../App.css';
import '../../buttons.css';
import styles from "../ems-dashboard/EmsDashboard.module.css";
import formStyles from './FormHandler.module.css';
import { Spinner } from 'react-bootstrap';

// Lazy load modals and heavy components
const EmployeeCredentialsSection = lazy(() => import('../Modals/EmployeeCredentialsSection'));
const SavedReportsModal = lazy(() => import('../Modals/SavedReportsModal'));
const BugReportModal = lazy(() => import('../Modals/BugReportModal'));
const MapModal = lazy(() => import("../Modals/MapModal"));
import AssignedAutopsiesModal from '../Modals/AssignedAutopsiesModal';
import UnprocessedCKsViewer from './UnprocessedCKsViewer';
import ImagePreviewModal from '../Modals/ImagePreviewModal';

export const FormHandler = () => {
  const isDevelopment = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
  useInactivityReload(); 
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
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [currentUtcTime, setCurrentUtcTime] = useState(getUtcFormattedDateTime());
  const [isUploading, setIsUploading] = useState(false);
  const [keepCredentials, setKeepCredentials] = useState(() => {
    return localStorage.getItem('phmc_gtaw_oauth_persist_enabled') !== 'false';
  });
  const [showBugReportModal, setShowBugReportModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapTargetField, setMapTargetField] = useState(null);
  const [isUploadingMapImage, setIsUploadingMapImage] = useState({});
  const [showAssignedAutopsies, setShowAssignedAutopsies] = useState(false);
  


          // Left Sidebar State
      const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(() => !localStorage.getItem('lastSelectedFormName'));

      // Hooks
      const { showNotification, removeNotification } = useNotification();
      const { 
        imagePreviewUrl, imagesPreviewList, currentPreviewIndex, setCurrentPreviewIndex, closeImagePreview 
      } = useModal();

      const {
        user: realUser,
        isAuthenticated: realIsAuthenticated,
        isPhmcMember: realIsPhmcMember,
        characterName: realCharacterName,
        swappableCharacters,
        selectOptions: authSelectOptions,
        canSwapCharacters,
        swapCharacter,
        factionData,
        updateFactionData,
        triggerFactionSync,
        login,
        logout,
        accessLevel
      } = useGtaWorldAuth();
    
    
      let user = realUser;
      let isAuthenticated = realIsAuthenticated;
      let isPhmcMember = realIsPhmcMember;
      let characterName = realCharacterName;

      // Admin Welcome Notification
      useEffect(() => {
        if (isAuthenticated && (accessLevel === 'president' || accessLevel === 'staff' || accessLevel === 'superadmin')) {
          const hasShownAdminWelcome = sessionStorage.getItem('hasShownAdminWelcome_session') === 'true';
          
          if (!hasShownAdminWelcome) {
            const adminName = user?.username || characterName || 'Admin';
            showNotification(
              `Welcome Admin ${adminName}! You have full access to this website. You can use the right side panel to view the Admin Dashboard.`,
              'check-circle',
              10000
            );
            sessionStorage.setItem('hasShownAdminWelcome_session', 'true');
          }
        }
      }, [isAuthenticated, accessLevel, user, characterName, showNotification]);
    
    


  useEffect(() => {
    if (isPhmcMember && !localStorage.getItem('seenKeepCredentialsPrompt')) {
      localStorage.setItem('phmc_gtaw_oauth_persist_enabled', 'true');
      const token = sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (token) {
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
      }
      setKeepCredentials(true);
      localStorage.setItem('seenKeepCredentialsPrompt', 'true');
    }
  }, [isPhmcMember, setKeepCredentials]);


  const { 
    agencyDataStore, 
    phmcListData, 
    coronerListData: originalCoronerListData,
    selectOptions: dataContextSelectOptions,
    formsData,
    hasFirebaseError,
    factionsData,
    isLoadingData,
  } = useData();

  useEffect(() => {
    if (!selectedForm && formsData && formsData.length > 0) {
      const lastFormName = localStorage.getItem('lastSelectedFormName');
      if (lastFormName) {
        const restoredForm = formsData.find(f => f.name === lastFormName);
        if (restoredForm) {
          console.log(`[FormHandler] Restoring last selected form: ${lastFormName}`);
          setSelectedForm(restoredForm);
          
          // Load progression data for this form
          const savedProgression = localStorage.getItem(`form_progression_${restoredForm.firebaseKey}`);
          if (savedProgression) {
            setFormValues(JSON.parse(savedProgression));
          }
        }
      }
    }
  }, [formsData]); // Run once when formsData is available

  const { saveReport: saveNewReport, validateMembership } = useFormSaver(user, isAuthenticated, { phmcListData, coronerListData });
  const modalCloseTimer = React.useRef(null);
  const { user: firebaseAuthUser } = useAuth();
  const firebaseUid = firebaseAuthUser?.uid || null;
  const lastGeneratedFormKey = React.useRef(null);

  // ── Per-form-type bot consent for auto-deploy ──
  const {
    consent: botConsent,
    saveAllConsent: saveBotConsent,
    setConsent: setBotConsent,
    hasSavedConsent,
    consentLoaded,
  } = useConsent();
  const [showConsentModal, setShowConsentModal] = useState(false);
  const consentJustSaved = useRef(false); // Prevents modal re-trigger right after save
  const pendingSaveAfterConsent = useRef(false); // Re-trigger save once consent modal completes

  // Auto-show assigned autopsies modal when the autopsy form is selected
  useEffect(() => {
    console.log('[AssignedModal] Selected form changed:', selectedForm?.firebaseKey);
    if (selectedForm?.firebaseKey === 'autopsy') {
      console.log('[AssignedModal] Autopsy selected — opening modal');
      setShowAssignedAutopsies(true);
    }
  }, [selectedForm?.firebaseKey]);

  // ── Consent modal auto-prompt ──
  // Only shows on first visit (never saved preferences). Once the user has
  // saved their choices, trust their decision — no reminders on form switch.
  // The modal is unskippable — must navigate all sections and save to close.
  const selectedFormFirebaseKey = selectedForm?.firebaseKey;
  useEffect(() => {
    if (!consentLoaded) return;
    // Skip modal on localhost — no Firebase Auth, can't persist consent across refreshes
    if (window.location.hostname === 'localhost') return;
    // Don't re-trigger right after user just saved
    if (consentJustSaved.current) {
      consentJustSaved.current = false;
      return;
    }
    if (selectedFormFirebaseKey && DEPLOY_TRACKED_FORMS.includes(selectedFormFirebaseKey)) {
      if (!hasSavedConsent) {
        setShowConsentModal(true);
      }
    }
  }, [selectedFormFirebaseKey, botConsent, hasSavedConsent, consentLoaded]);

    // ── First-visit auto-prompt ──
  // Shows the consent modal on mount if authenticated with no consent record yet.
  // Commented out for testing — uncomment once ready for production rollout.
  // useEffect(() => {
  //   if (consentLoading) return;
  //   if (!firebaseUid) return;
  //   if (consentPromptedThisSession) return;
  //   if (hasConsentRecord) return;
  //   if (selectedFormFirebaseKey && DEPLOY_TRACKED_FORMS.includes(selectedFormFirebaseKey)) return;
  //
  //   sessionStorage.setItem('consentPrompted', 'true');
  //   setShowConsentModal(true);
  // }, [consentLoading, firebaseUid, hasConsentRecord, consentPromptedThisSession, selectedFormFirebaseKey]);

  // UI helper: check if user has opted into auto-deploy for the given form type.
  // Uses Firebase consent when available, falls back to legacy localStorage.
  const isFormOptedIn = useCallback((formId) => {
    if (!formId) return false;
    if (!DEPLOY_TRACKED_FORMS.includes(formId)) return false;
    // Wait for consent data to load before making decisions
    if (!consentLoaded) return false;
    // Check Firebase consent record first (populated by useConsent hook)
    if (formId in (botConsent || {})) {
      return botConsent[formId] === true;
    }
    // Fallback: legacy localStorage for backward compatibility
    try {
      return localStorage.getItem('botDeployOptIn') === 'true';
    } catch {
      return false;
    }
  }, [botConsent, consentLoaded]);

  // One-shot consent diagnostic — logs only when the button decision changes
  const lastConsentLog = useRef('');

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
      let validPhmcData = phmcListData.filter(emp => emp && emp.name && typeof emp.name === 'string');
      let validCoronerData = coronerListData.filter(emp => emp && emp.name && typeof emp.name === 'string');

      if (isDevelopment) {
          const devUser = { name: "GTAW User", rank: "Developer", badge: "DEV-01", discord: "Dev#0000" };
          validPhmcData = [devUser, ...validPhmcData];
          validCoronerData = [devUser, ...validCoronerData];
      }

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

  const isFoundInStaffList = useMemo(() => {
    if (!characterName) return false;
    const allNames = [
      ...phmcListData.map(e => e.name),
      ...coronerListData.map(e => e.name)
    ].filter(Boolean).map(n => n.toLowerCase());
    return allNames.includes(characterName.toLowerCase());
  }, [characterName, phmcListData, coronerListData]);

  const employeeType = useMemo(() => {
    if (selectedForm?.accessType === 'Coroner') return 'coroner';
    return 'phmc';
  }, [selectedForm]);

  const mainEmployeeName = useMemo(() => {
    const employeeNameField = `${employeeType}Employee`;
    return formValues[employeeNameField];
  }, [formValues, employeeType]);

  const formProgress = useMemo(() => {
    if (!selectedForm?.fields) return { pct: 0, label: '', decedentName: '' };
    const fillableTypes = ['input','textarea','select','multi_select','checkbox','radio','timer','dynamic_text_list','image','employee_select','multi_employee_select','character_selector','medicine_block','decedent_list'];
    const fillable = selectedForm.fields.filter(f => fillableTypes.includes(f.type));
    const total = fillable.length;
    const filled = fillable.filter(f => {
      const val = formValues[f.name];
      if (f.type === 'checkbox') return !!val;
      if (f.type === 'image' || f.type === 'multi_select' || f.type === 'dynamic_text_list') return Array.isArray(val) && val.length > 0;
      if (f.type === 'decedent_list') return Array.isArray(val) && val.length > 0 && val.some(d => d.decedentName);
      return val !== '' && val !== null && val !== undefined;
    }).length;
    const isMassFat = selectedForm.firebaseKey === 'mass-ftality-test';
    let decedentName = '';
    if (isMassFat && Array.isArray(formValues.decedents)) {
      const named = formValues.decedents.find(d => d.decedentName && d.decedentOOC);
      decedentName = named ? `${named.decedentName} - ${named.decedentOOC}` : (formValues.decedents.length > 0 ? `Decedent (${formValues.decedents.length})` : '');
    } else {
      decedentName = formValues.decedentName || '';
    }
    return { pct: total > 0 ? Math.round((filled / total) * 100) : 0, total, filled, decedentName };
  }, [selectedForm, formValues]);

  // Countdown banner removed — auto-refresh happens silently in background after 5min debounce

  const { generatedBBCode, generatedTitle, showBBCode, setShowBBCode, generateBBCode /*, limitWarning */ } = useBbcodeGenerator(
    selectedForm,
    formValues,
    finalSelectOptions,
    agencyDataStore,
    user, // Pass the user object here
    factionsData
  );

  // Callbacks
  const toggleCategory = (cat) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };



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

  const handleMapSelect = useCallback((locationData) => {
    if (mapTargetField && locationData) {
      console.log(`[FormHandler] Received map data for field '${mapTargetField}':`, locationData);
      
      const { name: formattedName, rawName, isFromMap } = locationData; // Destructure new properties
      let targetFieldName = mapTargetField;

      if (mapTargetField.includes('.')) {
        const [arrayName, indexStr, fieldName] = mapTargetField.split('.');
        const index = parseInt(indexStr, 10);
        
        if (arrayName === 'decedents' && !isNaN(index) && fieldName === 'decedentLocation') {
            setFormValues(prev => {
                const newDecedents = [...(prev.decedents || [])];
                if (newDecedents[index]) {
                    newDecedents[index] = { 
                        ...newDecedents[index], 
                        [fieldName]: formattedName, // Store BBCode for BBCode generator
                        [`${fieldName}_display`]: rawName, // Store raw name for input display
                        [`${fieldName}_isFromMap`]: isFromMap // Store map source flag
                    };
                    return { ...prev, decedents: newDecedents };
                }
                return prev; // Or handle error
            });
        }
      } else {
        handleChange(targetFieldName, formattedName); // Store BBCode for BBCode generator
        handleChange(`${targetFieldName}_display`, rawName); // Store raw name for input display
        handleChange(`${targetFieldName}_isFromMap`, isFromMap); // Store map source flag
      }
    } else {
      console.warn("[FormHandler] Map selection occurred but no target field was set.");
    }
    setShowMapModal(false);
  }, [mapTargetField, handleChange, setFormValues]);


  const validateReportQuality = useCallback(() => {
    if (!selectedForm) return { success: true };
    
    const isCoronerReport = selectedForm.firebaseKey === 'coroner-report';
    const isMassFatality = selectedForm.firebaseKey === 'mass-ftality-test' || selectedForm.id === 'mass-fatality' || selectedForm.name?.toLowerCase().includes('mass fatality');

    if (!isCoronerReport && !isMassFatality) return { success: true };

    const errors = [];
    const SYNOPSIS_MIN_LENGTH = 200;

    // Helper for checking if a value is empty
    const isValueEmpty = (val) => {
      if (val === null || val === undefined) return true;
      if (typeof val === 'string' && val.trim() === "") return true;
      if (Array.isArray(val) && val.length === 0) return true;
      if (typeof val === 'object') {
        if (val.value !== undefined || val.label !== undefined) {
          return !val.value && !val.label;
        }
        return Object.keys(val).length === 0;
      }
      return false;
    };

    // Check individual Coroner Report
    if (isCoronerReport) {
      const typeOfDeath = formValues.typeOfDeath?.value || formValues.typeOfDeath;
      const isCK = typeOfDeath === 'CK';
      const isPK = typeOfDeath === 'PK';
      
      // Mandatory Fields (Always checked for Coroner)
      const mandatoryFields = [
        { key: 'decedentName', label: 'Decedent Name' },
        { key: 'decedentOOC', label: 'Decedent OOC' },
        { key: 'probableCauseOfDeath', label: 'Cause of Death' },
        { key: 'mannerOfDeath', label: 'Manner of Death' },
        { key: 'synopsis', label: 'Synopsis' }
      ];

      mandatoryFields.forEach(field => {
        if (isValueEmpty(formValues[field.key])) {
          errors.push(`Missing mandatory field: ${field.label}`);
        }
      });

      // Strict Mode for CK/PK
      if (isCK || isPK) {
        const typeLabel = isCK ? "CK" : "PK";
        
        // Check ALL displayed fields for CK/PK
        if (selectedForm.fields) {
            selectedForm.fields.forEach(field => {
                // Skip decoration fields and special action fields
                if (['hr', 'fake_line', 'section', 'information_state', 'autopsy_import_button', 'autopsy_diagram_button', 'payment_button', 'attach_report_button'].includes(field.type)) return;
                
                // Skip optional fields even for CK/PK
                if (['additionalStaff', 'additionalstaff', 'ReportRequested', 'evidenceLocker', 'evidenceLockerID'].includes(field.name)) return;

                // Skip scene photos if the "missing due to bug" flag is set
                if (field.name === 'scenePhotosBBCode' && formValues.scenePhotosBBCode_missing_bug) return;

                if (evaluateFieldVisibility(field, formValues)) {
                    if (isValueEmpty(formValues[field.name])) {
                        errors.push(`[${typeLabel} Requirement] Missing field: ${field.label || field.name}`);
                    }
                }
            });
        }

        // Synopsis length check ONLY for CK
        if (isCK) {
          const synopsis = formValues.synopsis || "";
          if (synopsis.length < SYNOPSIS_MIN_LENGTH) {
            errors.push(`Synopsis is too short for a CK report (${synopsis.length}/${SYNOPSIS_MIN_LENGTH} chars).`);
          }
        }

        // Check for images (both scene and morgue/additional are required for CK/PK)
        const hasSceneImages = (formValues.scenePhotosBBCode && formValues.scenePhotosBBCode.length > 0) || (formValues.scenePhotos && formValues.scenePhotos.length > 0) || formValues.scenePhotosBBCode_missing_bug;
        const hasMorgueImages = (formValues.additionalPhotos && formValues.additionalPhotos.length > 0) || (formValues.additionalImages && formValues.additionalImages.length > 0);

        if (!hasSceneImages || !hasMorgueImages) {
          errors.push(`${typeLabel} reports require at least one image upload for BOTH scene and morgue photos.`);
        }
      }
    }

    // Check Mass Fatality Report
    if (isMassFatality && Array.isArray(formValues.decedents)) {
      const lockerIds = new Set();
      formValues.decedents.forEach((dec, idx) => {
        const typeOfDeath = dec.typeOfDeath?.value || dec.typeOfDeath;
        const isCK = typeOfDeath === 'CK';
        const isPK = typeOfDeath === 'PK';
        const name = dec.decedentName || `Decedent #${idx + 1}`;

        // Uniqueness check for evidenceLockerID
        if (dec.evidenceLockerID && dec.evidenceLockerID.trim() !== '') {
          const lid = dec.evidenceLockerID.trim().toLowerCase();
          if (lockerIds.has(lid)) {
            errors.push(`[${name}] Duplicate Evidence Locker ID found: ${dec.evidenceLockerID}. Each ID must be unique.`);
          }
          lockerIds.add(lid);
        }

        if (!dec.decedentName || !dec.decedentOOC) {
          errors.push(`[${name}] Missing Name or OOC.`);
        }

        if (isCK || isPK) {
            const typeLabel = isCK ? "CK" : "PK";
            
            // For mass fatality decedents, check all fields in the schema
            decedentItemSchema.forEach(field => {
                if (field.type === 'section') return;
                
                // Skip optional fields even for CK/PK
                if (['evidenceLockerID', 'additionalStaff'].includes(field.name)) return;

                if (isValueEmpty(dec[field.name])) {
                    errors.push(`[${name}] ${typeLabel} Requirement: Missing field: ${field.label}`);
                }
            });

            // Check for images (both scene and morgue/additional are required for CK/PK)
            const hasSceneImages = (dec.scenePhotos && dec.scenePhotos.length > 0);
            const hasMorgueImages = (dec.additionalPhotos && dec.additionalPhotos.length > 0) || (dec.additionalImages && dec.additionalImages.length > 0);

            if (!hasSceneImages || !hasMorgueImages) {
                errors.push(`[${name}] ${typeLabel} reports require at least one image upload for BOTH scene and morgue photos.`);
            }

            // Synopsis length check ONLY for CK
            if (isCK) {
                const synopsis = dec.synopsis || "";
                if (synopsis.length < SYNOPSIS_MIN_LENGTH) {
                    errors.push(`[${name}] Synopsis is too short for a CK report (${synopsis.length}/${SYNOPSIS_MIN_LENGTH} chars).`);
                }
            }
        }
      });
    }


    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true };
  }, [selectedForm, formValues]);


  const handleSelectChange = useCallback((selectedOption, actionMeta) => {
    const name = selectedOption ? selectedOption.value : '';
    const updates = { [`${employeeType}Employee`]: name || '' };

    if (name) {
      const fullData = [...phmcListData, ...coronerListData].find(e => e.name === name);
      if (fullData) {
        updates[`${employeeType}Rank`] = fullData.rank ? cleanRankText(fullData.rank) : '';
        updates[`${employeeType}Badge`] = fullData.badge || '';
        updates[`${employeeType}Discord`] = fullData.discordName || fullData.discord || '';
        updates[`${employeeType}PHNumber`] = fullData.phNumber || '';
        updates[`${employeeType}FirstName`] = selectedOption?.firstname || '';
        updates[`${employeeType}LastName`] = selectedOption?.lastname || '';
      }
    }

    setFormValues(prev => ({ ...prev, ...updates }));
  }, [employeeType, phmcListData, coronerListData, cleanRankText, setFormValues]);

const handleClearForm = useCallback(() => {
    console.log("[FormHandler] 🗑️ handleClearForm triggered.");
    
    // Always preserve all credential fields regardless of the current form type
    const credentialFieldsToPreserve = [
      'phmcEmployee', 'phmcBadge', 'phmcRank', 'phmcDiscord', 'phmcPHNumber', 'phmcFirstName', 'phmcLastName',
      'coronerEmployee', 'coronerBadge', 'coronerRank', 'coronerDiscord', 'coronerPHNumber', 'coronerFirstName', 'coronerLastName'
    ];

    const preservedValues = {};
    if (keepCredentials || isAuthenticated) {
        credentialFieldsToPreserve.forEach(fieldName => {
            if (formValues[fieldName]) {
                preservedValues[fieldName] = formValues[fieldName];
            }
        });
        
        // Safety: If the form was partially broken/cleared and we are authenticated, 
        // re-populate the current user's credentials from OAuth data.
        if (isAuthenticated && user) {
            const currentRole = selectedForm?.accessType === 'Coroner' ? 'coroner' : 'phmc';
            const factionData = user?.faction || user?.activeCharacter;
            const oauthName = factionData?.characterName;
            
            if (oauthName && factionData) {
                const dbMatch = [...phmcListData, ...coronerListData].find(e =>
                    String(e.characterId) === String(factionData.characterId)
                );

                preservedValues[`${currentRole}Employee`] = oauthName;
                preservedValues[`${currentRole}Rank`] = factionData.rank ? cleanRankText(String(factionData.rank)) : (factionData.scriptRank || '');
                preservedValues[`${currentRole}Badge`] = factionData.characterId || factionData.badge || '';
                preservedValues[`${currentRole}Discord`] = dbMatch?.discordName || dbMatch?.discord || user.username || '';
                preservedValues[`${currentRole}PHNumber`] = dbMatch?.phNumber || '50056';
                preservedValues[`${currentRole}FirstName`] = factionData.firstname || (oauthName.split(' ')[0] || '');
                preservedValues[`${currentRole}LastName`] = factionData.lastname || (oauthName.split(' ').slice(1).join(' ') || '');
            }
        }
    }
    
    console.log("[FormHandler] Final preservedValues object:", preservedValues);
    
    setFormValues(preservedValues);
    if (selectedForm?.firebaseKey) {
        localStorage.removeItem(`form_progression_${selectedForm.firebaseKey}`);
    }
    setShowBBCode(false);
    showNotification('Form cleared!', 'info');
  }, [formValues, setFormValues, selectedForm, showNotification, keepCredentials, isAuthenticated, user, phmcListData, coronerListData, cleanRankText]);

  const copyAndSaveReport = useCallback(async () => {
    // Prevent saving BBCode generated for a different form
    if (lastGeneratedFormKey.current && lastGeneratedFormKey.current !== selectedForm?.firebaseKey) {
      showNotification('Generate BBCode for this form first! The current BBCode is from a different form.', 'error', 8000);
      return;
    }
    // ── Consent gate: require saved preferences before deploy-tracked save ──
    // Prevents the race where a user saves a report, bot queues it, and user
    // then opts out after it's already in the queue.
    const isDeployTrackedForm = selectedForm?.firebaseKey && DEPLOY_TRACKED_FORMS.includes(selectedForm.firebaseKey);
    if (isDeployTrackedForm && consentLoaded && firebaseUid && !pendingSaveAfterConsent.current) {
      try {
        const consentSnap = await get(ref(database, `user-consent/${firebaseUid}`));
        const consentData = consentSnap.val();
        const hasAnyConsentData = consentData !== null && typeof consentData === 'object' && Object.keys(consentData).length > 0;
        if (!hasAnyConsentData) {
          pendingSaveAfterConsent.current = true;
          setShowConsentModal(true);
          showNotification('Set your auto-deploy preferences first.', 'info', 8000);
          return;
        }
      } catch {
        // Firebase read failed — proceed without gating to avoid blocking saves
        console.warn('[FormHandler] Consent check failed (Firebase read error), proceeding with save.');
      }
    }

    // Always regenerate BBCode from the LATEST formValues — reusing cached
    // output could ship an earlier (blank) generation if credentials synced
    // after a preview (Fix D).
    let bbcodeToUse;
    {
      const genResult = generateBBCode();
      if (genResult?.bbcode) {
        bbcodeToUse = genResult.bbcode;
      } else {
        showNotification('Failed to generate BBCode. Check form fields and try again.', 'error', 5000);
        return;
      }
    }
    {
      const isCoronerEmail = selectedForm?.id === 'coroner_email' || selectedForm?.name === 'Coroner Email';

      // Coroner emails require at least one attached report
      if (isCoronerEmail) {
        const hasReports = Array.isArray(formValues.additionalReports) && formValues.additionalReports.length > 0;
        if (!hasReports) {
          showNotification('Please attach at least one report using the "Attach Reports" button before saving.', 'error', 8000);
          return;
        }
      }

      // Medical record forms require a patient name for reliable forum search
      const MEDICAL_FORM_IDS = ['patient_notes', 'er_protocol', 'physical_evaluation', 'staff-patient-file', 'surgical', 'session_notes', 'intensive_treatment', 'psych-eval', 'testing-compact-mode'];
      const isMedicalRecord = selectedForm?.firebaseKey && MEDICAL_FORM_IDS.includes(selectedForm.firebaseKey);
      if (isMedicalRecord) {
        const patientName = formValues.decedentName || formValues.decedentname || formValues.patientName || '';
        if (!patientName.trim()) {
          showNotification('Please enter a Patient Name before saving. This is used to find the correct thread on the forum.', 'error', 8000);
          return;
        }
      }

      const bbcodeToSave = Array.isArray(bbcodeToUse) ? bbcodeToUse.join('\n\n[PART_BREAK]\n\n') : bbcodeToUse;

      const saveResult = await saveNewReport(selectedForm, formValues, generatedTitle, bbcodeToSave, { silent: true });

      let finalNotificationMessage = '';
      let finalNotificationOptions = [];
      let finalNotificationType = 'success'; // Default to success
      let notificationDuration = undefined;

      if (saveResult?.success) {
        const savedTitle = generatedTitle || saveResult.originalKey || 'Report';
        finalNotificationMessage = `Report "${savedTitle}" saved!`;

        // ── Watch for bot deploy status updates ──
        const isDeployTracked = selectedForm?.firebaseKey && DEPLOY_TRACKED_FORMS.includes(selectedForm.firebaseKey);
        const formOptedIn = isFormOptedIn(selectedForm?.firebaseKey);
        const willAutoEmail = (selectedForm?.firebaseKey === 'coroner-report' && (formValues.ReportRequested === true || formValues.ReportRequested === 'true')) ||
                              (selectedForm?.firebaseKey === 'mass-ftality-test' && formValues.requestingOfficer);

        if (isDeployTracked && formOptedIn && saveResult.reportPath) {
          const statusRef = ref(database, saveResult.reportPath);
          const queueMsg = willAutoEmail
            ? '📥 In Queue — coroner email will be sent automatically when posted'
            : '📥 In Queue — bot will deploy shortly';
          const notifIdRef = { current: showNotification(queueMsg, 'spinner fa-spin', 0) };

          const STATUS_MESSAGES = {
            queued:          { icon: '⏳', text: 'Report queued — will deploy in a few min. Re-save to make edits.', color: '#ffc107' },
            searching:       { icon: '🔍', text: 'Searching for patient thread...', color: '#60a5fa' },
            replying:        { icon: '📝', text: 'Posting reply to thread...', color: '#60a5fa' },
            posted:          { icon: '✅', text: 'Report posted successfully!', color: '#28a745', final: true },
            dry_run:         { icon: '🏜️', text: 'Bot filled form (dry run — not submitted)', color: '#ffc107', final: true },
            topic_not_found: { icon: '📭', text: 'Topic not found — create manually on forum', color: '#ffc107', final: true },
            reply_failed:    { icon: '❌', text: 'Reply failed', color: '#dc3545', final: true },
            error:           { icon: '❌', text: 'Missing information', color: '#dc3545', final: true },
          };

          const unsubscribe = onValue(statusRef, (snap) => {
            const data = snap.val();
            if (data?.deployStatus && STATUS_MESSAGES[data.deployStatus]) {
              const msg = STATUS_MESSAGES[data.deployStatus];
              const displayText = data.deployMessage || msg.text;
              removeNotification(notifIdRef.current);
              if (msg.final) {
                const type = data.deployStatus === 'posted' ? 'success' : 'warning';
                showNotification(`${msg.icon} ${displayText}`, type, 15000);
              } else {
                notifIdRef.current = showNotification(`${msg.icon} ${displayText}`, 'spinner fa-spin', 0);
              }
            }
          });

          setTimeout(() => {
            try { unsubscribe(); } catch {}
            removeNotification(notifIdRef.current);
          }, 15 * 1000);
        }

        if (isCoronerEmail) {
          finalNotificationOptions = [
            {
              label: 'Clear Form',
              variant: 'danger',
              handler: (id) => {
                handleClearForm();
                removeNotification(id);
              }
            }
          ];
          notificationDuration = 10000;
        }
      } else {
        finalNotificationMessage = `Failed to save report: ${saveResult?.error || 'Unknown error'}`;
        finalNotificationType = 'error';
      }

      try {
        const textToCopy = Array.isArray(bbcodeToUse) ? bbcodeToUse[0] : bbcodeToUse;
        await navigator.clipboard.writeText(textToCopy);
        if (finalNotificationType === 'success') {
            if (Array.isArray(bbcodeToUse)) {
                finalNotificationMessage += ' Part 1 copied. Please copy other parts manually from the preview below.';
                finalNotificationType = 'info';
            } else {
                finalNotificationMessage += ' and BBCode copied!';
            }
        }
      } catch (err) {
        console.error('Failed to copy BBCode: ', err);
        Sentry.captureException(err, { extra: { context: 'FormHandler - copyAndSaveReport clipboard' } });
        // If report save failed, the message already indicates that.
        // If report save succeeded, append clipboard failure.
        if (finalNotificationType === 'success') {
            finalNotificationMessage += ', but failed to copy BBCode to clipboard.';
            finalNotificationType = 'warning';
        }
      }
      
      showNotification(finalNotificationMessage, finalNotificationType, notificationDuration, { actions: finalNotificationOptions });
    }
  }, [generatedBBCode, selectedForm, formValues, generatedTitle, saveNewReport, showNotification, handleClearForm, removeNotification, firebaseUid, consentLoaded]);




  const { 
      savedReports,
      isLoadingUserReports,
      loadUserSavedReports,
      loadReportForUser
  } = useReportLoader();

  const { deleteReportForUser } = useReportActions();

  const { 
      toggleSavedReports,
      showSavedReports,
      setShowSavedReports,
      handleReportSelectedForAttachment,
      preselectedEmployeeType,
      reportSelectionFilter,
      pendingReportAttachmentCallback,
      currentAttachmentTargetFieldRef,
      isAttachMode
  } = useReportAttachment(
      loadReportForUser,
      formValues, setFormValues, selectedForm, showNotification, removeNotification, modalCloseTimer,
      validateMembership
  );

  const handleLoadReport = useCallback((report, userId) => {
    return loadReportForUser(
        report, 
        userId, 
        false, 
        setFormValues, 
        selectedForm, 
        setSelectedForm, 
        () => formsData
    );
  }, [loadReportForUser, setFormValues, selectedForm, setSelectedForm, formsData]);

  const handleNavToggleSavedReports = () => {
    let type = 'PHMC'; // Default to PHMC
    if (selectedForm) {
        if (selectedForm.accessType === 'Coroner' || (selectedForm.primaryFor && selectedForm.primaryFor.includes('coroner'))) {
            type = 'Coroner';
        }
    }
    toggleSavedReports(null, type, null);
  };


  useEffect(() => {
    localStorage.setItem("formCollapsedCategories", JSON.stringify(collapsedCategories));
  }, [collapsedCategories]);

  useEffect(() => {
    if (selectedForm?.name) {
      localStorage.setItem('lastSelectedFormName', selectedForm.name);
    }
  }, [selectedForm]);


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
      const parentFieldName = activeEl.dataset.parentField;

      if (!fieldName) return;

      let fieldConfig;
      if (parentFieldName && parentFieldName === 'decedents') { // Explicitly check if it's a decedent list
          fieldConfig = decedentItemSchema.find(f => f.name === fieldName);
      } else {
          fieldConfig = selectedForm.fields?.find(f => f.name === fieldName);
      }

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
      const index = activeEl.dataset.index;

      const pastingNotifId = showNotification("Pasting & uploading image...", "spinner fa-spin", 0);
      try {
        setIsUploading(true);
        const result = await uploadImageToImgBB(imageFile);
        const { url, thumb } = result;
        
        setFormValues(prev => {
          if (parentFieldName && index !== undefined) {
              const list = [...(prev[parentFieldName] || [])];
              const itemIndex = parseInt(index, 10);
              if (list[itemIndex]) {
                  const current = list[itemIndex][targetField] || [];
                  const arr = Array.isArray(current) ? current : (typeof current === 'string' ? current.split(', ').filter(Boolean) : []);
                  list[itemIndex] = { ...list[itemIndex], [targetField]: [...arr, url] };
                  return { ...prev, [parentFieldName]: list };
              }
              return prev;
          } else {
              const current = prev[targetField] || [];
              const arr = Array.isArray(current) ? current : (typeof current === 'string' ? current.split(', ').filter(Boolean) : []);
              const updatedImages = [...arr, url];
              return { ...prev, [targetField]: updatedImages };
          }
        });
        
        removeNotification(pastingNotifId);
        showNotification("Image pasted & uploaded!", "success");

        const insertText = `[url=${url}][img]${thumb}[/img][/url]`
        const newValue = activeEl.value.substring(0, activeEl.selectionStart) + (activeEl.value ? "\n" : "") + insertText + "\n" + activeEl.value.substring(activeEl.selectionEnd);
        
        console.log(`[handlePaste] New textarea value for ${fieldName} (including img tag):`, newValue);

        activeEl.value = newValue; // Update the DOM element
        const event = new Event('input', { bubbles: true });
        activeEl.dispatchEvent(event); // Trigger React's onChange for the textarea

      } catch (err) {
        console.error("Upload failed:", err);
        Sentry.captureException(err, { extra: { context: 'FormHandler - handlePaste image upload' } });
        removeNotification(pastingNotifId);
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
    // Only proceed if a form is selected and user is authenticated for PHMC/Coroner forms
    if (!selectedForm || !isAuthenticated) {
      // If it's a patient form, employee credentials are not relevant here.
      // If not authenticated, we don't have OAuth data to sync.
      // If no form is selected, there's no employeeType context.
      return;
    }

    const currentEmployeeType = selectedForm?.accessType === 'Coroner' ? 'coroner' : 'phmc';
    const employeeNameField = `${currentEmployeeType}Employee`;

    setFormValues(currentFormValues => {
      const updates = {};

      // NOTE: the legacy patientName = characterName auto-fill was REMOVED
      // (2026-08-11). It stamped the author's own name into empty patient
      // names on medical forms (Paolina Russo / patient 1919 incident) and
      // the legacy handler is decommissioned — patient names now come only
      // from the patient lookup or the user.

      // Sync employee credentials via the shared resolver (same breadth as
      // author resolution; roster match by id or name; badge = roster key).
      const currentFormEmployeeName = currentFormValues[employeeNameField];
      const currentFormRank = currentFormValues[`${currentEmployeeType}Rank`];
      const currentFormBadge = currentFormValues[`${currentEmployeeType}Badge`];
      if (!currentFormEmployeeName || !currentFormRank || !currentFormBadge) {
        const resolved = resolveEmployeeCredentials(user, {
          phmcListData,
          coronerListData,
          cleanRank: cleanRankText,
        });
        if (resolved.employeeName) {
          if (!currentFormEmployeeName) updates[`${currentEmployeeType}Employee`] = resolved.employeeName;
          if (!currentFormRank) updates[`${currentEmployeeType}Rank`] = resolved.rank;
          if (!currentFormBadge) updates[`${currentEmployeeType}Badge`] = resolved.badge;
          updates[`${currentEmployeeType}Discord`] = resolved.discord;
          updates[`${currentEmployeeType}PHNumber`] = resolved.phNumber;
          updates[`${currentEmployeeType}FirstName`] = resolved.firstName;
          updates[`${currentEmployeeType}LastName`] = resolved.lastName;
        } else if (isDevelopment) {
          console.log(`[FormHandler] User auth lost/changed, but preserving credentials for ${currentEmployeeType} to prevent data loss.`);
        }
      }

      if (Object.keys(updates).length > 0) {
          return { ...currentFormValues, ...updates };
      } else {
          return currentFormValues; // No change
      }
    });

  }, [user, isAuthenticated, selectedForm, setFormValues, characterName, phmcListData, coronerListData, cleanRankText]);



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

  // Effect to auto-clear attached reports for Coroner Email after 30 minutes of inactivity
  useEffect(() => {
    const isCoronerEmail = selectedForm?.id === 'coroner_email' || selectedForm?.name === 'Coroner Email';
    if (isCoronerEmail && formValues.attachedReports) {
      const timer = setTimeout(() => {
        setFormValues(prev => ({
          ...prev,
          attachedReports: ''
        }));
        showNotification('Attached reports have been automatically cleared (30-minute limit).', 'info');
      }, 30 * 60 * 1000);

      return () => clearTimeout(timer);
    }
  }, [selectedForm, formValues.attachedReports, showNotification]);

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
          reason = "Development Mode Access (all forms visible for testing)";
      } else if (form.isHidden) {
          shouldDisplay = false;
          reason = "Hidden form";
      } else if (form.firebaseKey === 'death_record') {
          const userRank = factionData?.rank || '';
          const isMedicalExaminer = userRank.toLowerCase().includes('medical examiner');
          shouldDisplay = isMedicalExaminer;
          reason = isMedicalExaminer ? "Medical Examiner access granted" : "Restricted to Medical Examiners";
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

      // Hide Coroner Email from sidebar only when ALL source forms + email are opted in
      if (form.firebaseKey === 'coroner_email' && isFormOptedIn('coroner_email') && isFormOptedIn('coroner-report') && isFormOptedIn('mass-ftality-test')) {
          shouldDisplay = false;
          reason = 'Auto-generated by bot — no manual save needed';
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
        const categoryOrder = ['DMEC', 'PHMC Staff'];
        const indexA = categoryOrder.indexOf(a);
        const indexB = categoryOrder.indexOf(b);

        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;

        if (a === "Uncategorized") return 1;
        if (b === "Uncategorized") return -1;
        
        return a.localeCompare(b);
    });

    const sortedGroupedForms = {};
    sortedCategoryNames.forEach(catName => {
        sortedGroupedForms[catName] = categoriesMap[catName].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    });

    return [sortedGroupedForms, tempNotDisplayedFormsDetails];
  }, [formsData, searchTerm, isAuthenticated, isPhmcMember, isDevelopment, user, factionData, botConsent, consentLoaded]);

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

  useEffect(() => {
    // Wait for data to fully load before validating — selectOptions may be empty during init
    if (selectedForm && finalSelectOptions && isDevelopment && !isLoadingData && Object.keys(finalSelectOptions).length > 0) {
      const validationErrors = validateForm(selectedForm, finalSelectOptions);

      if (validationErrors.length > 0) {
        const formName = selectedForm.name;
        const errorList = validationErrors.map(e => `- ${e}`).join('\n');

        const payload = {
          embeds: [
            {
              title: "Form Validation Error Detected",
              color: 15158332,
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

        triggerWebhookProxy('admin', payload).catch(err => console.error('Validation webhook failed:', err));
        
        // Also notify the dev in the console
        console.warn(`[Form Validation Error] Form "${formName}" has configuration issues:`, validationErrors);
        showNotification(`The form "${formName}" has validation errors. Maintainers have been notified.`, 'warning', 10000);
      }
    }
  }, [selectedForm, finalSelectOptions, isDevelopment, showNotification, isLoadingData]);


  return (
    <div className={styles.container}>
        <SavedReportsModal
          show={showSavedReports}
          onHide={() => setShowSavedReports(false)}
          onClose={() => setShowSavedReports(false)}
          showNotification={showNotification}
          reportsForSelectedUser={savedReports}
          onEmployeeSelect={loadUserSavedReports}
          employeeOptions={employeeOptions}
          isLoadingReports={isLoadingUserReports}
          loadReport={handleLoadReport}
          deleteReportForUser={deleteReportForUser}
          loadReportForUser={loadReportForUser}
          handleReportSelectedForAttachment={handleReportSelectedForAttachment}
          currentCoronerEmployee={formValues.coronerEmployee}
          currentPhmcEmployee={formValues.phmcEmployee}
          filterByBbCodeVersions={reportSelectionFilter}
          preselectedEmployeeType={preselectedEmployeeType}
          reportSelectionFilter={reportSelectionFilter}
          pendingReportAttachmentCallback={pendingReportAttachmentCallback.current}
          isAttachMode={isAttachMode}
          selectedForm={selectedForm}
          attachmentTargetField={currentAttachmentTargetFieldRef.current} // Add this line
        />
        <MapModal
          show={showMapModal}
          onHide={() => setShowMapModal(false)}
          onSelect={handleMapSelect}
          initialQuery={mapTargetField && formValues[mapTargetField] ? formValues[mapTargetField] : ''}
          setIsUploadingMapImage={setIsUploadingMapImage}
          mapTargetField={mapTargetField}
          selectedForm={selectedForm}
        />
      <LeftSidebarNav
        groupedForms={groupedForms}
        collapsedCategories={collapsedCategories}
        toggleCategory={toggleCategory}
        onSelectForm={(form) => {
            if (selectedForm?.firebaseKey === form.firebaseKey) return;
            // Preserve essential credential fields across form switches.
            const credentialFields = [
            'phmcEmployee', 'phmcBadge', 'phmcRank', 'phmcDiscord', 'phmcPHNumber',
            'coronerEmployee', 'coronerBadge', 'coronerRank', 'coronerDiscord', 'coronerPHNumber'
            ];
            const baseValues = {};
            if (keepCredentials) {
            credentialFields.forEach(key => {
                if (Object.prototype.hasOwnProperty.call(formValues, key)) { // Carry over from current state if the key exists
                    baseValues[key] = formValues[key];
                }
            });
            }

            const savedProgression = localStorage.getItem(`form_progression_${form.firebaseKey}`);
            const savedValues = savedProgression ? JSON.parse(savedProgression) : {};
            

            setSelectedForm(form);
            setFormValues({ ...baseValues, ...savedValues });
            setShowBBCode(false);
        }}
        selectedForm={selectedForm}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onPanelToggle={(isOpen) => setIsLeftSidebarOpen(isOpen)}
        initialOpen={isLeftSidebarOpen}
      />

      <div className={styles.header}>
        <h2>PHMC Tools - Form Generator and more!</h2>
      </div>

      <div className={styles.mainLayout} style={{ display: 'flex', gap: '1.5rem', width: '100%', overflow: 'hidden' }}>
        <div 
            className={styles.mainContent}
            style={{ 
                flex: 5, 
                minWidth: 0, 
                background: '#1e293b', 
                borderRadius: 16, 
                padding: '2rem', 
                boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                marginLeft: isLeftSidebarOpen && window.innerWidth >= 768 ? '300px' : '0',
                transition: 'margin-left 0.3s ease' 
            }}
        >
          {!selectedForm ? (
            hasFirebaseError ? ( // NEW: Check for Firebase Error
                <div style={{ textAlign: "center", marginTop: "8rem", color: "#ffffff" }}>
                    <img src={phmcLogo} alt="PHMC Logo" style={{ height: '120px', marginBottom: '1.5rem', opacity: 0.8 }} />
                    <h3 style={{ color: "#ffffff", fontWeight: "bold" }}>Something has gone wrong, unexpected response from Google Firebase</h3>
                    <p style={{ fontSize: "1.1rem", marginTop: "1rem" }}>
                        Unable to establish a connection to the Firebase database.
                        <br /><br />
                        Try again later or notify the developer of this site with this screenshot.
                    </p>
                </div>
            ) : !isAuthenticated ? (
                <div style={{ textAlign: "center", marginTop: "8rem", color: "#c9d1d9" }}>
                    <img src={phmcLogo} alt="PHMC Logo" style={{ height: '120px', marginBottom: '1.5rem', opacity: 0.8 }} />
                    <h3 style={{ color: "#880a03ff", fontWeight: "bold" }}>Authentication Required</h3>
                    <p style={{ fontSize: "1.1rem", marginTop: "1rem" }}>
                        These forms are restricted to PHMC Employees or GTA World Staff.
                        <br /><br />
                        Please sign in with your GTA World account to continue.
                    </p>
                </div>
            ) : (
                <div style={{ textAlign: "center", marginTop: "8rem", color: "#64748b" }}>
                    <h3>Select a form from the sidebar to begin</h3>
                </div>
            )
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: "2rem" }}>
                <h2 style={{ color: "#60a5fa", margin: 0 }}>{selectedForm.name}</h2>
              </div>
              {selectedForm.formDescription && (
                  <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
                      {selectedForm.formDescription}
                  </div>
              )}

              <UnprocessedCKsViewer 
                selectedForm={selectedForm} 
                onPreload={(values) => setFormValues(prev => ({ ...prev, ...values }))}
              />
              <div style={{ margin: "0 -8px" }}>
                {(() => {
                  let fieldsToRender = [...(selectedForm.fields || [])];

                  return fieldsToRender.map((field) => {
                    
                    return (
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
                      setShowMapModal={setShowMapModal}
                      setMapTargetField={setMapTargetField}
                      isUploadingMapImage={isUploadingMapImage}

                    />
                    );
                  });
                })()}
              </div>
              
              <div style={{ textAlign: "center", margin: "3rem 0", display: "flex", justifyContent: "center", gap: "1rem" }}>
                <button onClick={handleClearForm} className={formStyles.clearButton}>
                  Clear Form
                </button>
                <button 
                  onClick={() => {
                    // --- DEBUG LOG START ---
                    if (selectedForm) {
                        const empType = selectedForm.accessType === 'Coroner' ? 'coroner' : 'phmc';
                        const dName = formValues[`${empType}Employee`] || "N/A";
                        const dRank = formValues[`${empType}Rank`] || "N/A";
                        const dBadge = formValues[`${empType}Badge`] || "N/A";
                        const dIsCoroner = empType === 'coroner' ? "TRUE" : "FALSE";
                        
                        console.log(`[DEBUG] FOUND PHMC EMPLOYEE: ${dName} | ${dRank} | ${dBadge} | (Coroner: ${dIsCoroner}) |`);
                    }

                    // --- Quality Check ---
/*                     const qualityResult = validateReportQuality();
                    if (!qualityResult.success) {
                      showNotification(
                        <div>
                          <strong>Quality Check: Failure</strong>
                          <ul style={{ margin: '5px 0 0 0', paddingLeft: '15px', fontSize: '0.8rem' }}>
                            {qualityResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                          </ul>
                        </div>,
                        'danger',
                        10000
                      );
                      return; // STOP execution here - do not generate BBCode if check fails
                    }
 */
                    generateBBCode();
                    lastGeneratedFormKey.current = selectedForm?.firebaseKey || null;
                  }}
                  className={formStyles.generateButton}
                >                  Generate BBCode
                </button>
              </div>
            </>
          )}
        </div>

        <div className={styles.rightPanel} style={{ flex: '0 0 400px', minWidth: '350px', maxWidth: '450px' }}>
          <div style={{ background: "#1e1b4b", padding: "1.5rem", borderRadius: 12, marginBottom: "1.5rem", border: '1px solid #312e81' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: "#a78bfa", margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>
                <i className="fas fa-user-circle me-2"></i>User Profile
              </h3>
            </div>
            {
              <Suspense fallback={<Spinner animation="border" size="sm" />}>
                <EmployeeCredentialsSection
                  formData={formValues}
                  setFormData={setFormValues}
                  groupedOptions={employeeOptions}
                  handleSelectChange={handleSelectChange}
                  setShowEmployeeModal={setShowEmployeeModal}
                  employeeType={employeeType}
                  showNotification={showNotification}
                  context={selectedForm?.name}
                  persistEnabled={keepCredentials}
                  setPersistEnabled={setKeepCredentials}
                  user={user}
                  isAuthenticated={isAuthenticated}
                  isPhmcMember={isPhmcMember}
                  canSwapCharacters={canSwapCharacters}
                  swapCharacter={swapCharacter}
                  swappableCharacters={swappableCharacters}
                  factionData={factionData}
                  updateFactionData={updateFactionData}
                  triggerFactionSync={triggerFactionSync}
                  login={login}
                  logout={logout}
                />
              </Suspense>
            }
          </div>

          <div>
{generatedBBCode ? (() => {
  const isDeployTracked = selectedForm?.firebaseKey && DEPLOY_TRACKED_FORMS.includes(selectedForm.firebaseKey);
  const optedIn = isFormOptedIn(selectedForm?.firebaseKey);
  if (isDeployTracked && optedIn) return null;
  return (
  <button
    onClick={() => setShowBBCode(!showBBCode)}
    className={formStyles.rightPanelButton}
    style={{ background: showBBCode ? "#7c3aed" : "#4c1d95" }}
  >
    {showBBCode ? "Hide" : "Show"} BBCode Preview
  </button>);
})() : (
  <div style={{ color: "#94a3b8", fontStyle: "italic", padding: "0.75rem" }}>
    Click &quot;Generate BBCode&quot; to preview
  </div>
)}
          {(() => {
            const MEDICAL_FORM_IDS = ['patient_notes', 'er_protocol', 'physical_evaluation', 'staff-patient-file', 'surgical', 'session_notes', 'intensive_treatment', 'psych-eval', 'testing-compact-mode'];
            if (selectedForm?.firebaseKey && MEDICAL_FORM_IDS.includes(selectedForm.firebaseKey) && botConsent?.[selectedForm.firebaseKey]) {
              return (
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                    <i className="fas fa-user me-1" style={{ color: '#6366f1' }}></i>
                    Patient Name <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <div style={{ marginBottom: 6, display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 10px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: 6, fontSize: '0.78rem', color: '#a5b4fc', lineHeight: 1.4 }}>
                      <i className="fas fa-info-circle" style={{ fontSize: '0.85rem', marginTop: 1, flexShrink: 0 }}></i>
                      <span>If you don't know the patient's ID, leave it blank — the bot will automatically find the correct thread or create one.</span>
                    </div>
                  {!(formValues.decedentName || formValues.patientName) && (
                    <div style={{ marginBottom: 6, padding: '6px 10px', background: 'rgba(220, 38, 38, 0.15)', border: '1px solid rgba(220, 38, 38, 0.4)', borderRadius: 6, fontSize: '0.8rem', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <i className="fas fa-exclamation-triangle"></i>
                      <span><strong>Required:</strong> Enter a patient name before saving — the bot needs this to find the correct thread on the forum.</span>
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="Enter patient name for forum search..."
                    value={formValues.decedentName || formValues.patientName || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormValues(prev => ({ ...prev, decedentName: val, patientName: val }));
                    }}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8, border: !(formValues.decedentName || formValues.patientName) ? '1px solid #dc3545' : '1px solid #3d4166',
                      background: '#0f172a', color: '#e2e8f0', fontSize: '0.85rem', outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              );
            }
            return null;
          })()}
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button
              onClick={() => {
                generateBBCode();
                lastGeneratedFormKey.current = selectedForm?.firebaseKey || null;
              }}
              title="Generate BBCode preview only — does not save or queue the report"
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #6366f1',
                background: '#1a1d2e', color: '#e2e8f0', fontSize: '0.85rem',
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              <i className="fas fa-code me-1"></i> Preview
            </button>
            <button onClick={copyAndSaveReport}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #6366f1',
                background: '#1a1d2e', color: '#e2e8f0', fontSize: '0.85rem',
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              {(() => {
                const isDeployTracked = selectedForm?.firebaseKey && DEPLOY_TRACKED_FORMS.includes(selectedForm.firebaseKey);
                const optedIn = isFormOptedIn(selectedForm?.firebaseKey);
                const logKey = 'deploy-btn|' + selectedForm?.firebaseKey + '|' + isDeployTracked + '|' + optedIn + '|' + (!!generatedBBCode);
                if (logKey !== lastConsentLog.current) {
                  lastConsentLog.current = logKey;
                  console.log('[Consent] Button state:', { formKey: selectedForm?.firebaseKey, isDeployTracked, optedIn, hasBbcode: !!generatedBBCode });
                }
                if (isDeployTracked && optedIn) return <><i className="fas fa-cloud-upload-alt me-1"></i> Save and Queue</>;
                if (Array.isArray(generatedBBCode)) return `Copy Part 1 + Save (${generatedBBCode.length} Parts)`;
                return generatedBBCode ? <><i className="fas fa-copy me-1"></i> Save</> : 'No BBCode Yet';
              })()}
            </button>
          </div>
          </div>

{selectedForm?.firebaseKey === 'autopsy' && (
  <button onClick={() => setShowAssignedAutopsies(true)}
    style={{ width: '100%', background: '#1a1d2e', border: '1px solid #6366f1', borderRadius: 12, padding: '14px 18px', marginBottom: '1rem', color: '#e2e8f0', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
    <i className="fas fa-clipboard-list" style={{ fontSize: '1.3rem', color: '#6366f1' }}></i>
    <div style={{ textAlign: 'left' }}>
      <strong style={{ color: '#fff' }}>Assigned Autopsies</strong>
      <p style={{ margin: '2px 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>Click to view your assigned cases</p>
    </div>
    <i className="fas fa-chevron-right" style={{ marginLeft: 'auto', color: '#6366f1' }}></i>
  </button>
)}

{generatedBBCode && (
  <>
    {/* Stale BBCode Warning — generated for a different form */}
    {(() => {
      const isDeployTracked = selectedForm?.firebaseKey && DEPLOY_TRACKED_FORMS.includes(selectedForm.firebaseKey);
      const formMismatch = lastGeneratedFormKey.current && lastGeneratedFormKey.current !== selectedForm?.firebaseKey;
      if (isDeployTracked && formMismatch) {
        return (
          <div style={{
            background: '#2d1b1b',
            border: '2px solid #dc3545',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: '1rem',
            color: '#f5a3a3',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}>
            <i className="fas fa-exclamation-triangle" style={{ fontSize: '1.4rem', color: '#dc3545', marginTop: 2 }}></i>
            <div>
              <strong style={{ color: '#fff', fontSize: '0.95rem' }}>BBCode Not Generated for This Form</strong>
              <p style={{ margin: '6px 0 0 0', color: '#fca5a5', fontSize: '0.85rem' }}>
                The current BBCode was generated for a different form. Click <strong>Generate BBCode</strong> above before saving to avoid posting incorrect data.
              </p>
            </div>
          </div>
        );
      }
      return null;
    })()}

    {/* Bot Deploy Opt-In Notice */}
    {(() => {
      const isDeployTracked = selectedForm?.firebaseKey && DEPLOY_TRACKED_FORMS.includes(selectedForm.firebaseKey);
      const optedIn = isFormOptedIn(selectedForm?.firebaseKey);
      if (isDeployTracked && optedIn) {
        return (
          <div style={{
            background: '#132a1a',
            border: '1px solid #28a745',
            borderRadius: 12,
            padding: '14px 18px',
            marginBottom: '1rem',
            color: '#b7eb8f',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}>
            <i className="fas fa-robot" style={{ fontSize: '1.3rem', color: '#28a745', marginTop: 2 }}></i>
            <div>
              <strong style={{ color: '#fff' }}>Auto-Deploy Enabled</strong>
              <p style={{ margin: '4px 0 0 0', color: '#a3d9a5' }}>
                You have opted in for the PHMC Bot to automatically post your reports.
                You do not need to take any further action. Reports will be posted within {QUEUE_DELAY_MIN} minutes.
                <br /><strong style={{ color: '#d4edda' }}>Made a mistake? Re-save within ~{QUEUE_DELAY_MIN} minutes to apply corrections.</strong>
              </p>
            </div>
          </div>
        );
      }
      return null;
    })()}

    {(() => {
      const isDeployTracked = selectedForm?.firebaseKey && DEPLOY_TRACKED_FORMS.includes(selectedForm.firebaseKey);
      const optedIn = isFormOptedIn(selectedForm?.firebaseKey);
      // Hide title when auto-deploy is enabled
      if (isDeployTracked && optedIn) return null;

      return <>
        {selectedForm?.category === 'DMEC' && (
          <div style={{
            color: "#94a3b8",
            fontSize: "0.85rem",
            marginBottom: "0.6rem",
            fontWeight: "600",
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <i className="fas fa-info-circle" style={{ color: '#60a5fa' }}></i>
            Click this box to copy the generated title!
          </div>
        )}
        <div
          style={{
            background: "#0f172a",
            padding: "1.5rem",
            borderRadius: 12,
            color: selectedForm?.category === 'DMEC' ? "#e2e8f0" : "#fbbf24",
            fontSize: "1.1rem",
            fontWeight: "700",
        marginBottom: "1rem",
        whiteSpace: "pre-wrap",
        cursor: selectedForm?.category === 'DMEC' ? "pointer" : "default",
        borderLeft: selectedForm?.category === 'DMEC' ? 'none' : '4px solid #f59e0b',
        backgroundColor: selectedForm?.category === 'DMEC' ? "#0f172a" : "rgba(245, 158, 11, 0.05)",
        border: selectedForm?.category === 'DMEC' ? '1px solid #334155' : 'none',
        transition: 'all 0.2s ease',
        position: 'relative',
        boxShadow: selectedForm?.category === 'DMEC' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
      }}
      className={selectedForm?.category === 'DMEC' ? formStyles.titleBox : ''}
      onClick={() => {
        if (selectedForm?.category === 'DMEC' && generatedTitle) {
          navigator.clipboard.writeText(generatedTitle);
          showNotification('Title copied to clipboard!', 'success');
        }
      }}
      onMouseEnter={(e) => {
        if (selectedForm?.category === 'DMEC') {
          e.currentTarget.style.borderColor = '#4f46e5';
          e.currentTarget.style.backgroundColor = '#1e293b';
        }
      }}
      onMouseLeave={(e) => {
        if (selectedForm?.category === 'DMEC') {
          e.currentTarget.style.borderColor = '#334155';
          e.currentTarget.style.backgroundColor = '#0f172a';
        }
      }}
      title={selectedForm?.category === 'DMEC' ? "Click to copy title" : ""}
    >
      {selectedForm?.category === 'DMEC' && (
        <i className="fas fa-copy" style={{ 
          position: 'absolute', 
          right: '1rem', 
          top: '1rem', 
          fontSize: '0.9rem', 
          opacity: 0.4,
          color: '#94a3b8'
        }}></i>
      )}
      {selectedForm?.category === 'DMEC'
        ? (generatedTitle || "No Title Generated")
        : (selectedForm?.firebaseKey && DEPLOY_TRACKED_FORMS.includes(selectedForm.firebaseKey) && isFormOptedIn(selectedForm?.firebaseKey))
          ? (generatedTitle || "Auto-deployed by bot")
          : "Please add this to the patient's thread, if one is missing, kindly make one"}
    </div>
    </>})()}

    {(() => {
      const isDeployTracked = selectedForm?.firebaseKey && DEPLOY_TRACKED_FORMS.includes(selectedForm.firebaseKey);
      const optedIn = isFormOptedIn(selectedForm?.firebaseKey);
      // Hide quick links when auto-deploy is enabled — bot handles posting
      if (isDeployTracked && optedIn) return null;
      return (
        <FormQuickLinks
          form={selectedForm}
          formValues={formValues}
          agencyDataStore={agencyDataStore}
          generatedBBCode={generatedBBCode}
          generatedTitle={generatedTitle}
        />
      );
    })()}

    {(() => {
      const isDeployTracked = selectedForm?.firebaseKey && DEPLOY_TRACKED_FORMS.includes(selectedForm.firebaseKey);
      const optedIn = isFormOptedIn(selectedForm?.firebaseKey);
      // Hide BBCode preview when auto-deploy is enabled
      if (isDeployTracked && optedIn) return null;
      if (!showBBCode) return null;

      if (Array.isArray(generatedBBCode)) {
        return <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
          {generatedBBCode.map((part, idx) => (
            <div key={idx} style={{ background: '#0f172a', padding: '1rem', borderRadius: 12, border: '1px solid #1e293b' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ color: '#a78bfa', fontWeight: 'bold', fontSize: '0.9rem' }}>PART {idx + 1} of {generatedBBCode.length}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(part);
                      showNotification(`Part ${idx + 1} copied!`, 'success');
                    }}
                    style={{ padding: '6px 12px', fontSize: '0.8rem', background: '#4f46e5', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontWeight: '600' }}
                  >
                    <i className="fas fa-copy" style={{ marginRight: '6px' }}></i>
                    Copy Part {idx + 1}
                  </button>
               </div>
               <pre
                  style={{
                    background: "#020617",
                    padding: "1rem",
                    borderRadius: 8,
                    color: "#cbd5e1",
                    fontSize: "0.85rem",
                    maxHeight: "30vh",
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                    margin: 0,
                    border: '1px solid #0f172a'
                  }}
                >
                  {part}
                </pre>
            </div>
          ))}
        </div>;
      }

      return <pre
        style={{
          background: "#0f172a",
          padding: "1.5rem",
          borderRadius: 12,
          color: "#e2e8f0",
          fontSize: "0.9rem",
          maxHeight: "60vh",
          overflow: "auto",
          marginTop: "1rem",
          whiteSpace: "pre-wrap",
          cursor: "pointer"
        }}
        onClick={copyAndSaveReport}
        title="Click to Copy BBCode + Save"
      >
        {generatedBBCode}
      </pre>;
    })()}
  </>
)}        </div>
      </div>
      <Suspense fallback={null}>
        <BugReportModal
          show={showBugReportModal}
          onClose={() => setShowBugReportModal(false)}
          showNotification={showNotification}
        />
      </Suspense>

      {/* ── Assigned Autopsies Modal ── */}
      <AssignedAutopsiesModal
        show={showAssignedAutopsies}
        onClose={() => setShowAssignedAutopsies(false)}
        onLoadCase={(morgue, entry) => {
          // Clear previous case fields first
          const clearFields = ['decedentName','decedentOOC','Requester','sex','placeOfDeath','deathType',
            'dnaProfile','bacLevel','narcoticTraces','externalExamination','department',
            'anatomicSummaryListItems','casings','RadiologyResult','synopsis','causeDetail',
            'causeOfDeath','deathCausesListItems','dateTime','timeOfDeath'];
          setFormValues(prev => {
            const cleared = { ...prev };
            clearFields.forEach(f => { cleared[f] = ''; });
            return cleared;
          });
          const updates = {};
          const p = entry?.parsed || {};
          // Extract IC name: "John Doe ((OOC))" -> "John Doe"
          const fullName = p.decedentName || morgue?.name || '';
          const icMatch = fullName.match(/^(.+?)\s*\(\(/);
          const icName = icMatch ? icMatch[1].trim() : fullName.replace(/\(\(.+?\)\)/g, '').trim() || fullName;
          updates.decedentName = icName;
          updates.decedentOOC = entry?.oocName || '';
          if (p.requesterName) updates.Requester = p.requesterName;
          if (p.sex || morgue?.sex) updates.sex = p.sex || morgue.sex;
          if (p.placeOfDeath || morgue?.location) updates.placeOfDeath = p.placeOfDeath || morgue.location;
          if (p.deathType) updates.deathType = (p.deathType || '').toUpperCase() === 'CK' ? 'CK' : 'PK';
          if (morgue?.dnaProfile) updates.dnaProfile = morgue.dnaProfile;
          if (morgue?.bac) updates.bacLevel = morgue.bac;
          if (morgue?.narcotics) updates.narcoticTraces = morgue.narcotics;
          // Build external examination from morgue physical description
          if (morgue?.physicalDescription) {
            let extLines = `** The Morgue Technician provides a written description below of the Decedent ** ((This section is descriptive purposes only and is automatically generated from the Morgue Records ))

`;
            extLines += `Physical Description:
${morgue.physicalDescription || ""}

`;
            if (morgue.tattoos && morgue.tattoos !== "None" && morgue.tattoos !== "Unknown") {
              extLines += `Tattoos/Marks:
${morgue.tattoos}

`;
            }
            if (morgue.estimatedAge && morgue.estimatedAge !== "Unknown") {
              extLines += `Est. Age: ${morgue.estimatedAge}
`;
            }
            updates.externalExamination = extLines.trim();
          }
          const deptMap = { LSPD: 'Los Santos Police Department', LSSD: 'Los Santos County Sheriffs Department', SADCR: 'San Andreas Department of Corrections and Rehabilitation' };
          if (entry?.faction) updates.department = deptMap[entry.faction] || entry.faction;
          if (Array.isArray(morgue?.findings) && morgue.findings.length > 0) {
            updates.anatomicSummaryListItems = morgue.findings.map(f => {
              const type = (f.type || '').trim();
              const part = (f.part || '').trim();
              const typeL = type.toLowerCase();
              const dist = f.dist ? f.dist.replace(/[^\d.]/g, '') : '';
              const distN = parseFloat(dist);
              const distR = !isNaN(distN) ? Math.floor(distN) : null;
              if (!typeL || typeL === 'blood loss' || typeL.includes('wound type') || part.includes('body part') || part === '—' || part === 'N/A') return null;
              if (typeL.includes('gunshot')) {
                return 'Gunshot Wound to ' + part + (distR !== null ? ', estimated range ' + distR + 'm' : '');
              }
              if (typeL.includes('blunt force trauma') || typeL.includes('stab wound')) {
                return type.replace(/\b\w/g, c => c.toUpperCase()) + ' to ' + part;
              }
              return type + ' to ' + part + (distR !== null ? ' (' + distR + 'm)' : '');
            }).filter(Boolean);
          }
          const rawBullets = morgue?.bullets;
          const bulletsArr = rawBullets && typeof rawBullets === 'object'
            ? (Array.isArray(rawBullets) ? rawBullets : [rawBullets])
            : [];
          if (bulletsArr.length > 0) {
            updates.casings = bulletsArr.map(b => {
              const prefix = (b.type || '').toLowerCase().includes('gauge') ? 'Pellet' : 'Bullet';
              return prefix + ' found with striation marks - ' + (b.type || '') + ' #' + (b.id || '');
            });
            updates.RadiologyResult = bulletsArr.length + ' projectiles/slugs were identified via fluoroscopy and recovered during the autopsy.';
          }
          if (!morgue) {
            showNotification('Cannot load case - no morgue record found for this decedent. Upload the body via the PS Logger or Morgue Manager first.', 'error');
            return;
          }
          showNotification('Case loaded from morgue - if the body doesn\'t match the scene, use the Morgue Data Import Tool to find the correct record. Review and generate BBCode.', 'success');
          setFormValues(prev => ({ ...prev, ...updates }));
        }}
      />

      {/* ── Bot Deploy Consent Modal ── */}
      <BotDeployOptInModal
        show={showConsentModal}
        onClose={() => {
          consentJustSaved.current = true;
          setShowConsentModal(false);
          // If save was pending before consent modal, retry it now
          if (pendingSaveAfterConsent.current) {
            pendingSaveAfterConsent.current = false;
            // Fire at next tick so Firebase write + React state settle
            setTimeout(() => copyAndSaveReport(), 0);
          }
        }}
        consent={botConsent}
        saveAllConsent={saveBotConsent}
        setConsent={setBotConsent}
        isLoading={false}
        displayName={characterName}
      />

      {/* Global Image Previewer */}
      <ImagePreviewModal
        isOpen={!!imagePreviewUrl}
        onClose={closeImagePreview}
        imageUrl={imagePreviewUrl}
        images={imagesPreviewList}
        currentIndex={currentPreviewIndex}
        onIndexChange={setCurrentPreviewIndex}
      />


      {selectedForm && formProgress.total > 0 && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 12, background: '#0f172a', border: '1px solid #334155', borderRadius: 16, padding: '12px 18px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', fontWeight: 600, fontSize: '0.85rem', color: '#e2e8f0' }}>
          <div style={{ position: 'relative', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg viewBox="0 0 36 36" style={{ width: 48, height: 48, position: 'absolute' }}>
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#1e293b" strokeWidth="3" />
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={formProgress.pct === 100 ? '#22c55e' : '#3b82f6'} strokeWidth="3" strokeDasharray={`${formProgress.pct}, 100`} style={{ transition: 'stroke-dasharray 0.4s ease' }} />
            </svg>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: formProgress.pct === 100 ? '#22c55e' : '#e2e8f0' }}>{formProgress.pct}%</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{formProgress.filled}/{formProgress.total} fields</div>
            {formProgress.decedentName && (
              <div style={{ fontSize: '0.82rem', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{formProgress.decedentName}</div>
            )}
          </div>
        </div>
      )}

      {/* Countdown banner removed — auto-refresh happens silently in background after 5min debounce */}

    </div>
  );
};
