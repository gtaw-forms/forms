import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense, useRef } from "react";
import * as Sentry from "@sentry/react";
import useGtaWorldAuth from "../../hooks/useGtaWorldAuth";
import { useModal } from "../../contexts/ModalProvider";
import { useData } from "../../contexts/DataContext";
import FormFieldRenderer from './FormFieldRenderer';
import FormHandlerNavButtons from './FormHandlerNavButtons';
import LeftSidebarNav from '../UI/LeftSidebarNav';
import useBbcodeGenerator from '../../hooks/useBbcodeGenerator';

import { uploadImageToImgBB, uploadDataUrlToImgBB } from '../../utils/imageUploadUtils'; 
import { useNotification } from '../../contexts/NotificationContext';
import { getUtcFormattedDateTime } from '../../utils/dateTimeUtils';
import { useReportLoader } from '../../hooks/useReportLoader';
import { useReportActions } from '../../hooks/useReportActions';
import { useReportAttachment } from '../../hooks/useReportAttachment';
import { useFormSaver } from '../../hooks/useFormSaver';
import FormQuickLinks from './FormQuickLinks';
import { validateForm } from '../../utils/formValidation';
import { sendDiscordWebhook } from '../../utils/webhookUtils';
import { sendBingoNotification, sendPhraseRequestNotification } from '../UI/notificationService';
import { useInactivityReload } from '../../hooks/useInactivityReload';
import { useUserMetrics } from '../../hooks/useUserMetrics';
import { cleanRankText } from '../../utils/textUtils';
import { STORAGE_KEYS } from '../../services/gtaWorldAuth';
import phmcLogo from '../../assets/phmc.png';
import { decedentItemSchema } from '../../formSchemas/decedentSchema';
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
const BugReportModal = lazy(() => import('../Modals/BugReportModal'));
const MapModal = lazy(() => import("../Modals/MapModal"));
const AgencyIncidentModal = lazy(() => import('../Modals/AgencyIncidentModal'));
const SurveyModal = lazy(() => import('../Modals/SurveyModal'));
import UnprocessedCKsViewer from './UnprocessedCKsViewer';
import FormTour, { sectionExplanations } from '../UI/FormTour';
import ImagePreviewModal from '../Modals/ImagePreviewModal';

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
  


    // Survey State
    const [showSurveyModal, setShowSurveyModal] = useState(false);
  
      // Tour State
      const [showTour, setShowTour] = useState(false);
      const [tourType, setTourType] = useState(null); // 'general' or 'form-specific'

      // Left Sidebar State
      const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);

      // Helper for consistent name comparison
      const normalizeName = useCallback((name) => String(name || '').trim().toLowerCase(), []);

      // Hooks
      const { showNotification, removeNotification } = useNotification();
      const { 
        showEmsBingoModal, setShowEmsBingoModal,
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
    
      // General Tour Prompt on Visit
      useEffect(() => {
        // We use localStorage so it only prompts once ever (until cleared)
        const hasSeenGeneralTour = localStorage.getItem('hasSeenGeneralTourPrompt') === 'true';
        
        if (!hasSeenGeneralTour || isDevelopment) {
          // Add a slight delay so it doesn't pop up instantly with auth notices
          const timer = setTimeout(() => {
            showNotification(
              "Welcome to PHMC Forms! Would you like a quick 1-minute tour of the interface?",
              "info",
              0, // Persistent until acted upon
              { actions: [
                {
                  label: 'Start Tour',
                  handler: (id) => {
                    setTourType('general');
                    setShowTour(true);
                    localStorage.setItem('hasSeenGeneralTourPrompt', 'true');
                    removeNotification(id);
                  },
                },
                {
                  label: 'Later',
                  handler: (id) => {
                    removeNotification(id);
                  },
                },
                {
                  label: "Don't show again",
                  handler: (id) => {
                    localStorage.setItem('hasSeenGeneralTourPrompt', 'true');
                    removeNotification(id);
                  },
                },
              ]}
            );
          }, 2000);
          return () => clearTimeout(timer);
        }
      }, [showNotification, removeNotification]);

      // Form-specific tour trigger
      useEffect(() => {
        const isTourableForm = selectedForm?.id && sectionExplanations[selectedForm.id];
    
        if (isTourableForm) {
          const hasBeenOfferedTour = sessionStorage.getItem(`hasBeenOfferedTour_${selectedForm.id}`) === 'true';
    
          if (!hasBeenOfferedTour) {
            sessionStorage.setItem(`hasBeenOfferedTour_${selectedForm.id}`, 'true');
    
            showNotification(
              `New to the ${selectedForm.name}? We can guide you through it.`,
              "info",
              15000,
              { actions: [
                {
                  label: 'Start Section Guide',
                  handler: (id) => {
                    setTourType('form-specific');
                    setShowTour(true);
                    removeNotification(id);
                  },
                },
                {
                  label: 'No Thanks',
                  handler: (id) => {
                    removeNotification(id);
                  },
                },
              ]}
            );
          }
        }
      }, [selectedForm, showNotification, removeNotification]);
    
    
      useEffect(() => {
        const hasSeenIncidentNotice = localStorage.getItem('seenAgencyIncidentNotice') === 'true';
        if (isAuthenticated && !hasSeenIncidentNotice) {
          showNotification(
            <span>You can report Agency Incidents in the <i className="fas fa-cog"></i> More Panel, this can be pushed up to Faction Leadership.</span>,
            'info',
            0,
            { actions: [
              {
                label: 'Dismiss',
                handler: (id) => {
                  localStorage.setItem('seenAgencyIncidentNotice', 'true');
                  removeNotification(id);
                },
              },
            ]}
          );
        }
      }, [isAuthenticated, showNotification, removeNotification]);  

  useEffect(() => {
    const hasSeenPrompt = localStorage.getItem('seenKeepCredentialsPrompt') === 'true';
    const hasSeenThisSession = sessionStorage.getItem('hasSeenKeepCredentialsPrompt_session') === 'true';
    
    // Check if the token is already in localStorage (meaning they are already persisted)
    const isAlreadyPersisted = !!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);

    if (isPhmcMember && !hasSeenPrompt && !hasSeenThisSession && !isAlreadyPersisted) {
      sessionStorage.setItem('hasSeenKeepCredentialsPrompt_session', 'true');
      showNotification(
        'Do you want us to keep you logged in and remember your employee credentials across sessions?',
        'info',
        0, // Set to 0 to make it persistent until an action is taken
        { actions: [
          {
            label: 'Yes, Persist',
            handler: (id) => {
              localStorage.setItem('phmc_gtaw_oauth_persist_enabled', 'true');
              setKeepCredentials(true);
              
              const token = sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
              if (token) {
                localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
              }

              localStorage.setItem('seenKeepCredentialsPrompt', 'true');
              removeNotification(id);
              showNotification('You will stay logged in across sessions.', 'success');
            },
          },
          {
            label: 'No, Session Only',
            handler: (id) => {
              localStorage.setItem('phmc_gtaw_oauth_persist_enabled', 'false');
              setKeepCredentials(false);
              localStorage.setItem('seenKeepCredentialsPrompt', 'true');
              removeNotification(id);
            },
          },
          {
            label: 'Ask Me Later',
            handler: (id) => {
              removeNotification(id);
            },
          },
        ]}
      );
    } else if (isAlreadyPersisted && !hasSeenPrompt) {
      // If they are already persisted, don't show the prompt and mark as seen
      localStorage.setItem('seenKeepCredentialsPrompt', 'true');
      localStorage.setItem('phmc_gtaw_oauth_persist_enabled', 'true');
      if (!keepCredentials) setKeepCredentials(true);
    }
  }, [isPhmcMember, showNotification, removeNotification, setKeepCredentials, keepCredentials]);
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
                { actions: [
                    {
                        label: "Request Access",
                        handler: (id) => {
                             handleRequestAccess();
                             removeNotification(id);
                        }
                    },
                    { label: "Dismiss", handler: (id) => removeNotification(id) }
                ]}
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
    hasFirebaseError,
    surveyData,
    submitSurveyResponse,
    factionsData,
  } = useData();
  const { showEmsBingoModal, setShowEmsBingoModal } = useModal();
  const { saveReport: saveNewReport } = useFormSaver(user, isAuthenticated);
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


  const sendBingoWebhook = useCallback(async (payload) => {
    await sendBingoNotification(payload);
  }, []);

  const sendPhraseRequestWebhook = useCallback(async (payload) => {
    await sendPhraseRequestNotification(payload);
  }, []);

  const validateReportQuality = useCallback(() => {
    if (!selectedForm) return { success: true };
    
    const isCoronerReport = selectedForm.firebaseKey === 'coroner-report';
    const isMassFatality = selectedForm.firebaseKey === 'mass-ftality-test' || selectedForm.id === 'mass-fatality' || selectedForm.name?.toLowerCase().includes('mass fatality');

    if (!isCoronerReport && !isMassFatality) return { success: true };

    const errors = [];
    const SYNOPSIS_MIN_LENGTH = 200;

    // Check individual Coroner Report
    if (isCoronerReport) {
      const isCK = formValues.typeOfDeath === 'CK' || formValues.typeOfDeath?.value === 'CK';
      
      // Mandatory Fields
      const mandatoryFields = [
        { key: 'decedentName', label: 'Decedent Name' },
        { key: 'decedentOOC', label: 'Decedent OOC' },
        { key: 'probableCauseOfDeath', label: 'Cause of Death' },
        { key: 'mannerOfDeath', label: 'Manner of Death' },
        { key: 'synopsis', label: 'Synopsis' }
      ];

      mandatoryFields.forEach(field => {
        const val = formValues[field.key];
        const isEmpty = !val || (typeof val === 'string' && val.trim() === "") || (typeof val === 'object' && val !== null && !val.value && !val.label);
        
        if (isEmpty) {
          errors.push(`Missing mandatory field: ${field.label}`);
        }
      });

      // Strict Mode for CK
      if (isCK) {
        const synopsis = formValues.synopsis || "";
        if (synopsis.length < SYNOPSIS_MIN_LENGTH) {
          errors.push(`Synopsis is too short for a CK report (${synopsis.length}/${SYNOPSIS_MIN_LENGTH} chars).`);
        }

        // Check for images (both scene and morgue/additional are required for CK)
        const hasSceneImages = (formValues.scenePhotosBBCode && formValues.scenePhotosBBCode.length > 0);
        const hasMorgueImages = (formValues.additionalPhotos && formValues.additionalPhotos.length > 0);

        if (!hasSceneImages || !hasMorgueImages) {
          errors.push("CK reports require at least one image upload for BOTH scene and morgue photos.");
        }
      }
    }

    // Check Mass Fatality Report
    if (isMassFatality && Array.isArray(formValues.decedents)) {
      formValues.decedents.forEach((dec, idx) => {
        const isCK = dec.typeOfDeath === 'CK' || dec.typeOfDeath?.value === 'CK';
        const name = dec.decedentName || `Decedent #${idx + 1}`;

        if (!dec.decedentName || !dec.decedentOOC) {
          errors.push(`[${name}] Missing Name or OOC.`);
        }

        if (isCK) {
            // Check for images (both scene and morgue/additional are required for CK)
            const hasSceneImages = (dec.scenePhotos && dec.scenePhotos.length > 0);
            const hasMorgueImages = (dec.additionalPhotos && dec.additionalPhotos.length > 0);

            if (!hasSceneImages || !hasMorgueImages) {
                errors.push(`[${name}] CK reports require at least one image upload for BOTH scene and morgue photos.`);
            }

            const synopsis = dec.synopsis || "";
            if (synopsis.length < SYNOPSIS_MIN_LENGTH) {
                errors.push(`[${name}] Synopsis is too short for a CK report (${synopsis.length}/${SYNOPSIS_MIN_LENGTH} chars).`);
            }
        }
      });
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true };
  }, [selectedForm, formValues]);

  const updateEmployeeCredentials = useCallback((employeeName, empType) => {
    const updates = {};
    const targetNameNormalized = normalizeName(employeeName);
    
    updates[`${empType}Employee`] = employeeName || ''; 

    if (employeeName) {
      const currentUserCharName = user?.faction?.characterName || user?.activeCharacter?.characterName;
      const isCurrentUser = normalizeName(currentUserCharName) === targetNameNormalized;

      if (isCurrentUser) {
          console.log(`%c[DEBUG] Credential Sync Origin: LIVE OAUTH (${employeeName})`, "color: #2ecc71; font-weight: bold;");
          const factionData = user?.faction || user?.activeCharacter || {};
          
          // Try to find the user in the database list to get their persistent Discord name
          const dbMatch = [...phmcListData, ...coronerListData].find(e => 
              normalizeName(e.characterName) === targetNameNormalized || 
              String(e.characterId) === String(factionData.characterId)
          );

          let rawRank = factionData.rank || factionData.scriptRank || '';
          updates[`${empType}Rank`] = rawRank ? cleanRankText(String(rawRank)) : '';
          updates[`${empType}Badge`] = factionData.characterId || factionData.badge || '';
          
          // Prioritize Database Discord Name > User Profile Username
          const resolvedDiscord = dbMatch?.discordName || dbMatch?.discord || user.username || '';
          updates[`${empType}Discord`] = resolvedDiscord;
          updates[`${empType}PHNumber`] = dbMatch?.phNumber || '50056';

          console.log(`[DEBUG] Resolved Discord for ${employeeName}: ${resolvedDiscord} (Source: ${dbMatch?.discordName || dbMatch?.discord ? 'Firebase' : 'UCP Fallback'})`);

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
          
          const staticDiscord = fullEmployeeData.discordName || fullEmployeeData.discord || '';
          updates[`${empType}Discord`] = staticDiscord;
          updates[`${empType}PHNumber`] = fullEmployeeData.phNumber || '';
          updates[`${empType}FirstName`] = selectedOption.firstname || '';
          updates[`${empType}LastName`] = selectedOption.lastname || '';

          console.log(`[DEBUG] Resolved Discord for ${employeeName}: ${staticDiscord} (Source: STATIC_LIST_FIREBASE)`);
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
        const result = await uploadDataUrlToImgBB(dataUrl);
        return [result.url];
    } catch (error) {
        showNotification('Failed to upload diagram image.', 'error');
        console.error("Autopsy Diagram upload failed:", error);
        Sentry.captureException(error, { extra: { context: 'FormHandler - handleDiagramUpload' } });
        return [];
    }
  }, [showNotification]);

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
        // try to re-derive the current user's credentials to ensure they aren't lost in the clear.
        if (isAuthenticated && user) {
            const currentRole = selectedForm?.accessType === 'Coroner' ? 'coroner' : 'phmc';
            const oauthName = user?.faction?.characterName || user?.activeCharacter?.characterName;
            
            if (oauthName) {
                const liveUpdates = updateEmployeeCredentials(oauthName, currentRole);
                Object.assign(preservedValues, liveUpdates);
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
  }, [formValues, setFormValues, selectedForm, showNotification, keepCredentials, isAuthenticated, user, updateEmployeeCredentials]);

  const copyAndSaveReport = useCallback(async () => {
    if (generatedBBCode) {
      const isCoronerEmail = selectedForm?.id === 'coroner_email' || selectedForm?.name === 'Coroner Email';
      
      // Join multi-part BBCode with a separator for saving to database (keeping logic but it will be a string now)
      const bbcodeToSave = Array.isArray(generatedBBCode) ? generatedBBCode.join('\n\n[PART_BREAK]\n\n') : generatedBBCode;
      
      const saveResult = await saveNewReport(selectedForm, formValues, generatedTitle, bbcodeToSave, { silent: true });
      trackMetric('form_handler', `save_report_${selectedForm.name}`);

      let finalNotificationMessage = '';
      let finalNotificationOptions = [];
      let finalNotificationType = 'success'; // Default to success
      let notificationDuration = undefined;

      if (saveResult?.success) {
        finalNotificationMessage = `Report "${generatedTitle}" saved!`;
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
        finalNotificationMessage = 'Failed to save report.';
        finalNotificationType = 'error';
      }

      try {
        const textToCopy = Array.isArray(generatedBBCode) ? generatedBBCode[0] : generatedBBCode;
        await navigator.clipboard.writeText(textToCopy);
        if (finalNotificationType === 'success') { // Only append if report save was successful
            if (Array.isArray(generatedBBCode)) {
                finalNotificationMessage += ' Part 1 copied. Please copy other parts manually from the preview below.';
                finalNotificationType = 'info'; // Change type if it's info
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
  }, [generatedBBCode, selectedForm, formValues, generatedTitle, saveNewReport, showNotification, handleClearForm, removeNotification, trackMetric]);




  const { 
      savedReports,
      isLoadingUserReports,
      loadUserSavedReports,
      loadUserRecoveryReports,
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
      formValues, setFormValues, selectedForm, showNotification, removeNotification, modalCloseTimer
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
                
                const fData = user?.faction || user?.activeCharacter || {};
                
                // Also attempt to resolve persistent Discord info in fallback
                const dbMatch = [...phmcListData, ...coronerListData].find(e => 
                    normalizeName(e.characterName) === normalizeName(oauthEmployeeName) || 
                    String(e.characterId) === String(fData.characterId)
                );

                credentialUpdates[`${currentEmployeeType}Employee`] = oauthEmployeeName;
                credentialUpdates[`${currentEmployeeType}Rank`] = fData.rank ? cleanRankText(String(fData.rank)) : (fData.scriptRank || '');
                credentialUpdates[`${currentEmployeeType}Badge`] = fData.characterId || fData.badge || '';
                
                // Fallback also respects Database Discord Name
                credentialUpdates[`${currentEmployeeType}Discord`] = dbMatch?.discordName || dbMatch?.discord || user.username || '';
                credentialUpdates[`${currentEmployeeType}PHNumber`] = dbMatch?.phNumber || '50056';
                
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

      if (isDevelopment) {
          shouldDisplay = true;
          reason = "Development Mode Access (all forms visible for testing)";
      } else if (form.isHidden) {
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
      {showTour && (
        <FormTour
          tourType={tourType}
          selectedForm={selectedForm}
          showNotification={showNotification}
          onComplete={() => {
            setShowTour(false);
            setTourType(null);
          }}
          onSkip={() => {
            setShowTour(false);
            setTourType(null);
          }}
        />
      )}
      <Suspense fallback={null}>
              <EmsBingoModal
                show={showEmsBingoModal}
                onHide={() => setShowEmsBingoModal(false)}
                allEmployeeGroupedOptions={employeeOptions}
                currentPhmcEmployee={mainEmployeeName}
                showNotification={showNotification}
                setShowEmployeeModal={setShowEmployeeModal}
                isAdmin={isPhmcMember} // Assuming PHMC members are admins for bingo
                sendBingoWebhook={sendBingoWebhook}
                sendPhraseRequestWebhook={sendPhraseRequestWebhook}
                persistEnabled={keepCredentials}
                setPersistEnabled={setKeepCredentials}
              />
        <SavedReportsModal
          show={showSavedReports}
          onHide={() => setShowSavedReports(false)}
          onClose={() => setShowSavedReports(false)}
          showNotification={showNotification}
          reportsForSelectedUser={savedReports}
          onEmployeeSelect={loadUserSavedReports}
          loadUserRecoveryReports={loadUserRecoveryReports}
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
        <AgencyIncidentModal
          show={showAgencyIncidentModal}
          onHide={() => setShowAgencyIncidentModal(false)}
          showNotification={showNotification}
        />
        <SurveyModal
          show={showSurveyModal}
          onClose={() => setShowSurveyModal(false)}
          survey={surveyData}
          onSubmit={(surveyId, response) => {
            console.log("--- Survey Response ---");
            console.log("Survey ID:", surveyId);
            console.log("Response:", response);
            console.log("-----------------------");
            showNotification('Thank you for your feedback!', 'success');
            // Prevent survey from showing again this session
            if (surveyData?.id) {
              sessionStorage.setItem('dismissedSurveyId', surveyData.id);
            }
          }}
        />
      </Suspense>
      <FormHandlerNavButtons 
        onToggleSavedReports={handleNavToggleSavedReports} 
        onToggleAgencyIncident={() => setShowAgencyIncidentModal(true)}
        onStartTour={() => {
          // Reset all tour-related flags
          localStorage.removeItem('hasSeenGeneralTourPrompt');
          // We also clear any session storage flags that start with our tour prefix
          Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith('hasBeenOfferedTour')) {
              sessionStorage.removeItem(key);
            }
          });
          
          setTourType('general');
          setShowTour(true);
        }}
        phmcLogoSrc={phmcLogo}
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
        selectedForm={selectedForm}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onPanelToggle={(isOpen) => setIsLeftSidebarOpen(isOpen)}
      />

      <div className={styles.header}>
        <h2>PHMC Tools - Form Generator and more!</h2>
      </div>

      <div className={styles.mainLayout} style={{ display: 'flex', gap: '1.5rem', width: '100%', overflow: 'hidden' }}>
        <div 
            className={styles.mainContent} 
            data-tour="main-content" 
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
                        We are unable to connect to the database.
                        <br /><br />
                        Please contact a maintainer or try again later.
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
                {selectedForm.id && sectionExplanations[selectedForm.id] && (
                  <button 
                    onClick={() => {
                      setTourType('form-specific');
                      setShowTour(true);
                    }}
                    className="btn btn-outline-info btn-sm"
                    style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                  >
                    <i className="fas fa-route" style={{ marginRight: '5px' }}></i>
                    Start Guide
                  </button>
                )}
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

                    // --- Quality Check ---
                    const qualityResult = validateReportQuality();
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

        <div className={styles.rightPanel} style={{ flex: '0 0 400px', minWidth: '350px', maxWidth: '450px' }}>
          <div style={{ background: "#1e1b4b", padding: "1.5rem", borderRadius: 12, marginBottom: "1.5rem", border: '1px solid #312e81' }} data-tour="right-panel-top">
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
                  login={login}
                  logout={logout}
                />
              </Suspense>
            }
          </div>

          <div data-tour="right-panel-bottom">
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
    Click &quot;Generate BBCode&quot; to preview
  </div>
)}
          <button onClick={copyAndSaveReport} disabled={!generatedBBCode} className={`${formStyles.rightPanelButton} ${generatedBBCode ? formStyles.copy : ''}`}>
            {Array.isArray(generatedBBCode) ? `Copy Part 1 + Save (${generatedBBCode.length} Parts)` : (generatedBBCode ? "Copy BBCode + Save" : "No BBCode Yet")}
          </button>
          </div>

{generatedBBCode && (
  <>
{/*     {limitWarning && (
      <div className="alert alert-danger" style={{ marginBottom: '1rem', background: '#450a0a', border: '1px solid #991b1b', color: '#fca5a5', padding: '1rem', borderRadius: '8px' }}>
        <i className="fas fa-exclamation-triangle" style={{ marginRight: '8px' }}></i>
        <strong>{limitWarning}</strong>
      </div>
    )}
 */}    {generatedTitle && (
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

    <FormQuickLinks 
      form={selectedForm} 
      formValues={formValues} 
      agencyDataStore={agencyDataStore} 
      generatedBBCode={generatedBBCode}
      generatedTitle={generatedTitle}
    />

    {showBBCode && (
      Array.isArray(generatedBBCode) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
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
        </div>
      ) : (
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
      )
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

      {/* Global Image Previewer */}
      <ImagePreviewModal 
        isOpen={!!imagePreviewUrl}
        onClose={closeImagePreview}
        imageUrl={imagePreviewUrl}
        images={imagesPreviewList}
        currentIndex={currentPreviewIndex}
        onIndexChange={setCurrentPreviewIndex}
      />

    </div>
  );
};
