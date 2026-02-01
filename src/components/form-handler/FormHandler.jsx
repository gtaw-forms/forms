import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense, useRef } from "react";
import * as Sentry from "@sentry/react";
import useGtaWorldAuth from "../../hooks/useGtaWorldAuth";
import { useModal } from "../../contexts/ModalProvider";
import { useData } from "../../contexts/DataContext";
import FormFieldRenderer from './FormFieldRenderer';
import FormHandlerNavButtons from './FormHandlerNavButtons';
import useBbcodeGenerator from '../../hooks/useBbcodeGenerator';

import { uploadImageToImgBB, uploadDataUrlToImgBB } from '../../utils/imageUploadUtils'; 
import { useNotification } from '../../contexts/NotificationContext';
import { getUtcFormattedDateTime } from '../../utils/dateTimeUtils';
import { useReportLoader } from '../../hooks/useReportLoader';
import { useReportActions } from '../../hooks/useReportActions';
import { useReportAttachment } from '../../hooks/useReportAttachment';
import { useFormSaver } from '../../hooks/useFormSaver';
import seasonalEvents from '../UI/SeasonalEvents';
import FormQuickLinks from './FormQuickLinks';
import { validateForm } from '../../utils/formValidation';
import { sendDiscordWebhook } from '../../utils/webhookUtils';
import { ref, get } from 'firebase/database';
import { database } from '../../firebase';
import { useInactivityReload } from '../../hooks/useInactivityReload';
import { useUserMetrics } from '../../hooks/useUserMetrics';
import { cleanRankText } from '../../utils/textUtils';
import phmcLogo from '../../assets/phmc.png';

// Critical CSS imports
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import '../../App.css';
import '../../buttons.css';
import styles from "../ems-dashboard/EmsDashboard.module.css";
import formStyles from './FormHandler.module.css';

import { Spinner } from 'react-bootstrap';

// Lazy load modals and heavy components
const EmsBingoModal = lazy(() => import('../Modals/EmsBingoModal'));
const EmployeeCredentialsSection = lazy(() => import('../Modals/EmployeeCredentialsSection'));
const SavedReportsModal = lazy(() => import('../Modals/SavedReportsModal'));
const OnboardingModal = lazy(() => import('../Modals/OnboardingModal'));
const BugReportModal = lazy(() => import('../Modals/BugReportModal'));
const MapModal = lazy(() => import("../Modals/MapModal"));
const AgencyIncidentModal = lazy(() => import('../Modals/AgencyIncidentModal'));
const AutopsyAssist = lazy(() => import('./AutopsyAssist'));
import UnprocessedCKsViewer from './UnprocessedCKsViewer';

export const FormHandler = () => {
  const isDevelopment = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
  useInactivityReload(); 
  const { trackMetric } = useUserMetrics();
  
  // Track visited forms for debug traces
  const visitedFormsRef = React.useRef([]);
  const transitionHistoryRef = React.useRef([]);

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
  const [showAgencyIncidentModal, setShowAgencyIncidentModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapTargetField, setMapTargetField] = useState(null);
  const [isUploadingMapImage, setIsUploadingMapImage] = useState({});
  
  // Autopsy Assist State
  const [showAutopsyAssistModal, setShowAutopsyAssistModal] = useState(false);
  const [autopsyAssistTargetField, setAutopsyAssistTargetField] = useState(null);


  // Hooks
  const { showNotification, removeNotification } = useNotification();
  const {
    user: realUser,
    isAuthenticated: realIsAuthenticated,
    isPhmcMember: realIsPhmcMember,
    characterName: realCharacterName,
    swappableCharacters,
    selectOptions: authSelectOptions,
  } = useGtaWorldAuth();


  let user = realUser;
  let isAuthenticated = realIsAuthenticated;
  let isPhmcMember = realIsPhmcMember;
  let characterName = realCharacterName;


  useEffect(() => {
    const hasSeenIncidentNotice = localStorage.getItem('seenAgencyIncidentNotice') === 'true';
    if (isAuthenticated && !hasSeenIncidentNotice) {
      showNotification(
        <span>You can report Agency Incidents in the <i className="fas fa-cog"></i> More Panel, this can be pushed up to Faction Leadership.</span>,
        'info',
        0,
        [
          {
            label: 'Dismiss',
            handler: (id) => {
              localStorage.setItem('seenAgencyIncidentNotice', 'true');
              removeNotification(id);
            },
          },
        ]
      );
    }
  }, [isAuthenticated, showNotification, removeNotification]);

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
  const handleRequestAccess = useCallback(async () => {
    const webhookUrl = import.meta.env.VITE_DISCORD_WEBHOOK_AUTH || import.meta.env.VITE_DEV_WEBHOOK;
    if (!webhookUrl) {
      showNotification('Auth webhook not configured.', 'error');
      return;
    }
    showNotification('Sending access request...', 'spinner fa-spin');
    const payload = {
        content: "<@310464654922645505>", // Ping specific user
        embeds: [{
            title: "🔐 PHMC Access Request",
            color: 16776960, // Yellow
            description: "A user has requested access to PHMC forms.",
            fields: [
                { name: "UCP Username", value: user?.username || "Unknown", inline: true },
                { name: "Character Name", value: user?.faction?.characterName || user?.activeCharacter?.characterName || characterName || "Unknown", inline: true },
                { name: "Faction Status", value: isPhmcMember ? "Member (System Error?)" : "Not Detected", inline: true },
                { name: "User ID", value: String(user?.id || "N/A"), inline: true }
            ],
            footer: { text: "Please verify this user in the faction roster." },
            timestamp: new Date().toISOString()
        }]
    };
    try {
        await sendDiscordWebhook(webhookUrl, payload);
        showNotification('Access request sent! An admin has been notified.', 'success');
    } catch (e) {
        showNotification('Failed to send request.', 'error');
        console.error(e);
    }
  }, [user, characterName, isPhmcMember, showNotification]);

  useEffect(() => {
    // Check if authenticated but not a PHMC member (according to our data)
    if (isAuthenticated && !isPhmcMember && !isDevelopment) {
        // Use sessionStorage to ensure it only shows once per session to avoid spamming
        const hasShownAuthPrompt = sessionStorage.getItem('hasShownAuthPrompt');
        
        if (!hasShownAuthPrompt) {
             showNotification(
                "If you are a PHMC Member and cannot see forms, please click here.",
                "info",
                15000, // 15 seconds
                [
                    {
                        label: "Request Access",
                        handler: (id) => {
                             handleRequestAccess();
                             removeNotification(id);
                        }
                    },
                    { label: "Dismiss", handler: (id) => removeNotification(id) }
                ]
            );
            sessionStorage.setItem('hasShownAuthPrompt', 'true');
        }
    }
  }, [isAuthenticated, isPhmcMember, isDevelopment, handleRequestAccess, showNotification, removeNotification]);

  // NEW: Track form handler visit
  useEffect(() => {
    trackMetric('form_handler', 'main_page');
  }, [trackMetric]);

  const oauthFirstName = user?.faction?.firstname || user?.activeCharacter?.firstname || null;
  const oauthLastName = user?.faction?.lastname || user?.activeCharacter?.lastname || null;
  const { 
    agencyDataStore, 
    phmcListData, 
    coronerListData: originalCoronerListData,
    selectOptions: dataContextSelectOptions,
    formsData,
  } = useData();
  const { showEmsBingoModal, setShowEmsBingoModal } = useModal();
  const { saveReport: saveNewReport } = useFormSaver();
  const modalCloseTimer = React.useRef(null);

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

  const handleAutopsyAssistInsert = useCallback((text) => {
      if (!autopsyAssistTargetField) return;
      
      setFormValues(prev => {
          const currentVal = prev[autopsyAssistTargetField] || "";
          const newVal = currentVal ? `${currentVal}\n${text}` : text;
          return { ...prev, [autopsyAssistTargetField]: newVal };
      });
      // Do not close modal automatically? Or maybe close it? User might want to add more.
      // For now, let's keep it open? The modal has "Insert & Close".
  }, [autopsyAssistTargetField]);

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
    const normalizeName = (name) => String(name || '').trim().toLowerCase();
    const targetNameNormalized = normalizeName(employeeName);
    
    updates[`${empType}Employee`] = employeeName || ''; 

    if (employeeName) {
      const currentUserCharName = user?.faction?.characterName || user?.activeCharacter?.characterName;
      const isCurrentUser = normalizeName(currentUserCharName) === targetNameNormalized;

      if (isCurrentUser) {
          console.log(`%c[DEBUG] Credential Sync Origin: LIVE OAUTH (${employeeName})`, "color: #2ecc71; font-weight: bold;");
          const factionData = user?.faction || user?.activeCharacter || {};
          
          let rawRank = factionData.rank || factionData.scriptRank || '';
          updates[`${empType}Rank`] = rawRank ? cleanRankText(String(rawRank)) : '';
          updates[`${empType}Badge`] = factionData.characterId || factionData.badge || '';
          updates[`${empType}Discord`] = user.username || ''; 
          updates[`${empType}PHNumber`] = '50056';

          if (factionData.firstname && factionData.lastname) {
              updates[`${empType}FirstName`] = factionData.firstname;
              updates[`${empType}LastName`] = factionData.lastname;
          } else {
               const parts = employeeName.split(' ');
               updates[`${empType}FirstName`] = parts[0] || '';
               updates[`${empType}LastName`] = parts.slice(1).join(' ') || '';
          }
          return updates;
      }

      const selectedOption = employeeOptions.flatMap(group => group.options).find(opt => opt.value === employeeName);
      const fullEmployeeData = [...phmcListData, ...coronerListData].find(e => e.name === employeeName);

      if (selectedOption && fullEmployeeData) {
          console.log(`%c[DEBUG] Credential Sync Origin: STATIC LIST (${employeeName})`, "color: #3498db; font-weight: bold;");
          updates[`${empType}Rank`] = fullEmployeeData.rank ? cleanRankText(fullEmployeeData.rank) : '';
          updates[`${empType}Badge`] = fullEmployeeData.badge || '';
          updates[`${empType}Discord`] = fullEmployeeData.discord || ''; 
          updates[`${empType}PHNumber`] = fullEmployeeData.phNumber || '';
          updates[`${empType}FirstName`] = selectedOption.firstname || '';
          updates[`${empType}LastName`] = selectedOption.lastname || '';
      } else {
          console.warn(`%c[DEBUG] Credential Sync Origin: UNKNOWN/CLEAR (${employeeName})`, "color: #e67e22; font-weight: bold;");
          if (!employeeName) {
            console.trace("[DEBUG] Credentials wiped due to empty employee name. Trace:");
          }
          updates[`${empType}Rank`] = '';
          updates[`${empType}Badge`] = '';
          updates[`${empType}FirstName`] = '';
          updates[`${empType}LastName`] = '';
          updates[`${empType}Discord`] = '';
          updates[`${empType}PHNumber`] = '';
      }
    } else {
      console.log(`%c[DEBUG] Credential Sync Origin: EMPTY/RESET`, "color: #95a5a6;");
      console.trace("[DEBUG] Credentials reset trace:");
      updates[`${empType}Rank`] = '';
      updates[`${empType}Badge`] = '';
      updates[`${empType}FirstName`] = '';
      updates[`${empType}LastName`] = '';
      updates[`${empType}Discord`] = '';
      updates[`${empType}PHNumber`] = '';
    }
    return updates;
  }, [employeeOptions, phmcListData, coronerListData, user]); // Dependencies for useCallback

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
      trackMetric('form_handler', `save_report_${selectedForm.name}`);
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
    console.log("[FormHandler] 🗑️ handleClearForm triggered.");
    console.log("[FormHandler] Current State - Keep credentials:", keepCredentials, "Is Auth:", isAuthenticated, "Employee Type:", employeeType);
    
    const credentialFieldsToPreserve = [
      `${employeeType}Employee`,
      `${employeeType}Badge`,
      `${employeeType}Rank`,
      `${employeeType}Discord`,
      `${employeeType}PHNumber`,
      `${employeeType}FirstName`,
      `${employeeType}LastName`
    ];

    const preservedValues = {};
    if (keepCredentials || isAuthenticated) {
        credentialFieldsToPreserve.forEach(fieldName => {
            if (formValues[fieldName]) {
                preservedValues[fieldName] = formValues[fieldName];
            } else {
                console.warn(`[FormHandler] Credential field '${fieldName}' was missing or empty in formValues before clear.`);
            }
        });
    } else {
        console.log("[FormHandler] Not preserving credentials (KeepCredentials=false AND IsAuth=false)");
    }
    
    console.log("[FormHandler] Final preservedValues object:", preservedValues);
    
    setFormValues(preservedValues);
    if (selectedForm?.firebaseKey) {
        localStorage.removeItem(`form_progression_${selectedForm.firebaseKey}`);
    }
    setShowBBCode(false);
    showNotification('Form cleared!', 'info');
  }, [formValues, employeeType, setFormValues, selectedForm?.firebaseKey, showNotification, keepCredentials, isAuthenticated, setShowBBCode]);




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
      currentAttachmentTargetFieldRef
  } = useReportAttachment(
      loadReportForUser,
      formValues, setFormValues, selectedForm, showNotification, removeNotification, modalCloseTimer
  );

  const handleNavToggleSavedReports = () => {
    let type = 'PHMC'; // Default to PHMC
    if (selectedForm) {
        if (selectedForm.accessType === 'Coroner' || (selectedForm.primaryFor && selectedForm.primaryFor.includes('coroner'))) {
            type = 'Coroner';
        }
    }
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

      // Update navigation history
      const entry = {
        name: selectedForm.name,
        id: selectedForm.id || selectedForm.firebaseKey,
        timestamp: new Date().toISOString()
      };
      
      // Avoid duplicate consecutive entries
      const lastEntry = visitedFormsRef.current[0];
      if (!lastEntry || lastEntry.id !== entry.id) {
         visitedFormsRef.current = [entry, ...visitedFormsRef.current].slice(0, 10); // Keep last 10
      }
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
    // Only proceed if a form is selected and user is authenticated for PHMC/Coroner forms
    if (!selectedForm || !isAuthenticated) {
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
      if (characterName && currentFormValues.patientName !== characterName) {
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

        // --- DEBUG LOG START ---
        // Always log the current state for debugging, even if valid
        const dName = currentFormEmployeeName || "N/A";
        const dRank = currentFormRank || "N/A";
        const dBadge = currentFormBadge || "N/A";
        const dIsCoroner = currentEmployeeType === 'coroner' ? "TRUE" : "FALSE";
        console.log(`[DEBUG] FOUND PHMC EMPLOYEE: ${dName} | ${dRank} | ${dBadge} | (Coroner: ${dIsCoroner}) |`);
        // --- DEBUG LOG END ---

        // This is a heuristic: if the name is different, or if *any* of the key derived fields are missing,
        // we should re-derive to ensure consistency.
        const shouldUpdateCredentials = (
            currentFormEmployeeName !== oauthEmployeeName ||
            !currentFormRank || 
            !currentFormBadge 
        );

        if (shouldUpdateCredentials) {
            console.log(`[FormHandler] Syncing credentials for ${currentEmployeeType}. OAuth: ${oauthEmployeeName}, Form: ${currentFormEmployeeName || 'N/A'}`);
            let credentialUpdates = updateEmployeeCredentials(oauthEmployeeName, currentEmployeeType);

            // --- REDUNDANCY/FALLBACK CHECK ---
            // If the standard sync returned incomplete data (missing rank/badge) but we have a valid OAuth user,
            // forcefully inject the data from the user object to prevent clearing credentials.
            if (!credentialUpdates[`${currentEmployeeType}Rank`] || !credentialUpdates[`${currentEmployeeType}Badge`]) {
                console.warn(`[FormHandler] ⚠️ Credential Sync returned empty values despite valid OAuth user. Engaging Emergency Fallback.`);
                console.warn(`[FormHandler] Failed update object:`, credentialUpdates);
                
                const fData = user?.faction || user?.activeCharacter || {};
                console.warn(`[FormHandler] Forcefully using OAuth Data:`, fData);

                credentialUpdates[`${currentEmployeeType}Employee`] = oauthEmployeeName;
                credentialUpdates[`${currentEmployeeType}Rank`] = fData.rank ? cleanRankText(String(fData.rank)) : (fData.scriptRank || '');
                credentialUpdates[`${currentEmployeeType}Badge`] = fData.characterId || fData.badge || '';
                credentialUpdates[`${currentEmployeeType}Discord`] = user.username || '';
                credentialUpdates[`${currentEmployeeType}PHNumber`] = '50056';
                
                if (fData.firstname && fData.lastname) {
                    credentialUpdates[`${currentEmployeeType}FirstName`] = fData.firstname;
                    credentialUpdates[`${currentEmployeeType}LastName`] = fData.lastname;
                } else {
                     const parts = oauthEmployeeName.split(' ');
                     credentialUpdates[`${currentEmployeeType}FirstName`] = parts[0] || '';
                     credentialUpdates[`${currentEmployeeType}LastName`] = parts.slice(1).join(' ') || '';
                }
            }
            // --- END REDUNDANCY CHECK ---

            Object.assign(updates, credentialUpdates); // Merge credential updates
        }
      } else {
        // If OAuth name becomes unavailable (e.g., user logs out), we DO NOT automatically clear the form credentials.
        // This prevents flickering 'isAuthenticated' states from wiping work in progress.
        // If the user effectively logs out, the UI usually redirects or covers the form anyway.
        if (isDevelopment) {
             console.log(`[FormHandler] User auth lost/changed, but preserving credentials for ${currentEmployeeType} to prevent data loss.`);
        }
      }

      if (Object.keys(updates).length > 0) {
          return { ...currentFormValues, ...updates };
      } else {
          return currentFormValues; // No change
      }
    });

  }, [user, isAuthenticated, selectedForm, setFormValues, updateEmployeeCredentials, characterName]);

  useEffect(() => {
    const monitoringFields = ['coronerEmployee', 'phmcEmployee', 'coronerBadge', 'phmcBadge', 'coronerRank', 'phmcRank'];
    const currentValues = monitoringFields.reduce((acc, field) => {
        acc[field] = formValues[field] || '';
        return acc;
    }, {});

    // Only log if one of these fields actually changed
    if (window.prevMonitoredValues) {
        const changes = {};
        let hasChanges = false;
        monitoringFields.forEach(f => {
            if (window.prevMonitoredValues[f] !== currentValues[f]) {
                changes[f] = { from: window.prevMonitoredValues[f], to: currentValues[f] };
                hasChanges = true;
            }
        });

        if (hasChanges) {
            console.log(`%c[DEBUG] Credential State Transition:`, "color: #8e44ad; font-weight: bold;", changes);
            
            // Push to local history ref for Discord Webhook (Keep last 15)
            const historyEntry = {
                timestamp: new Date().toISOString(),
                changes: changes
            };
            transitionHistoryRef.current = [historyEntry, ...transitionHistoryRef.current].slice(0, 15);
        }
    }
    window.prevMonitoredValues = currentValues;
  }, [formValues.coronerEmployee, formValues.phmcEmployee, formValues.coronerBadge, formValues.phmcBadge, formValues.coronerRank, formValues.phmcRank]);

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

      if (form.isHidden) {
          shouldDisplay = false;
          reason = "Hidden form";
      } else if (isDevelopment) {
          shouldDisplay = true;
          reason = "Development Mode Access";
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
        const webhookUrl = import.meta.env.VITE_DISCORD_WEBHOOK_ADMIN || import.meta.env.VITE_DEV_WEBHOOK;
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
      <Suspense fallback={null}>
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
        <MapModal
          show={showMapModal}
          onHide={() => setShowMapModal(false)}
          onSelect={handleMapSelect}
          initialQuery={mapTargetField && formValues[mapTargetField] ? formValues[mapTargetField] : ''}
          setIsUploadingMapImage={setIsUploadingMapImage}
          mapTargetField={mapTargetField}
          selectedForm={selectedForm}
        />
        <AgencyIncidentModal
          show={showAgencyIncidentModal}
          onHide={() => setShowAgencyIncidentModal(false)}
          showNotification={showNotification}
        />
        <AutopsyAssist
          show={showAutopsyAssistModal}
          onHide={() => setShowAutopsyAssistModal(false)}
          onInsert={handleAutopsyAssistInsert}
          formValues={formValues}
        />
      </Suspense>
      <FormHandlerNavButtons 
        onToggleSavedReports={handleNavToggleSavedReports} 
        onToggleAgencyIncident={() => setShowAgencyIncidentModal(true)}
      />

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
                Access Denied
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
                              if (selectedForm?.firebaseKey === form.firebaseKey) return;
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
                              
                              // --- DEBUG LOG START ---
                              console.log(`[DEBUG] Loaded progression for ${form.name}:`, savedValues);
                              // --- DEBUG LOG END ---

                              setSelectedForm(form);
                              setFormValues({ ...baseValues, ...savedValues });
                              setShowBBCode(false);
                              trackMetric('form_handler', `view_form_${form.name}`);
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
          {!selectedForm ? (
            !isAuthenticated ? (
                <div style={{ textAlign: "center", marginTop: "8rem", color: "#c9d1d9" }}>
                    <img src={phmcLogo} alt="PHMC Logo" style={{ height: '120px', marginBottom: '1.5rem', opacity: 0.8 }} />
                    <h3 style={{ color: "#880a03ff", fontWeight: "bold" }}>Authentication Required</h3>
                    <p style={{ fontSize: "1.1rem", marginTop: "1rem" }}>
                        These forms are restricted to PHMC Employees.
                        <br /><br />
                        Please sign in with your GTA World account to continue.
                    </p>
                </div>
            ) : (
                <div style={{ textAlign: "center", marginTop: "8rem", color: "#64748b" }}>
                    <h3>Select a form from the left to begin</h3>
                </div>
            )
          ) : (
            <>
              <h2 style={{ color: "#60a5fa", marginBottom: "2rem" }}>{selectedForm.name}</h2>
              {selectedForm.formDescription && (
                  <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
                      {selectedForm.formDescription}
                  </div>
              )}

              <UnprocessedCKsViewer selectedForm={selectedForm} />
              
              <div style={{ margin: "0 -8px" }}>
                {(() => {
                  let fieldsToRender = [...(selectedForm.fields || [])];

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
                      setShowMapModal={setShowMapModal}
                      setMapTargetField={setMapTargetField}
                      isUploadingMapImage={isUploadingMapImage}
                      setShowAutopsyAssistModal={setShowAutopsyAssistModal}
                      setAutopsyAssistTargetField={setAutopsyAssistTargetField}
                    />
                  ));
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
                        

                        
                    generateBBCode();
                        
                    trackMetric('form_handler', `generate_bbcode_${selectedForm.name}`);
                        
                  }} 
                        
                  className={formStyles.generateButton}
                        
                >                  Generate BBCode
                </button>
              </div>
            </>
          )}
        </div>

        <div className={styles.rightPanel}>
          <div style={{ background: "linear-gradient(135deg, #2d1b69, #1e1b4b)", padding: "1.5rem", borderRadius: 12, marginBottom: "1.5rem" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: "#a78bfa", margin: 0 }}>
                Signed in as {mainEmployeeName || characterName || 'Guest'}
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
                />
              </Suspense>
            }
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
      <pre 
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
      </pre>
    )}
  </>
)}        </div>
      </div>
      <Suspense fallback={null}>
        <BugReportModal
          show={showBugReportModal}
          onClose={() => setShowBugReportModal(false)}
          webhookUrl={import.meta.env.VITE_DISCORD_WEBHOOK_ADMIN || import.meta.env.VITE_DEV_WEBHOOK}
          showNotification={showNotification}
        />
      </Suspense>
    </div>
  );
};


