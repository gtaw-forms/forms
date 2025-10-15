import { useReportManagement } from './components/useReportManagement';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import { formDefinitions, getFormDefinition } from './formDefinitions'; 
import '@fortawesome/fontawesome-free/css/all.min.css';
import { Button, Dropdown } from 'react-bootstrap';
import getRelevantFields from './components/RevelantFields';
import SeasonalEvents from './components/SeasonalEvents';
import 'bootstrap/dist/css/bootstrap.min.css';
import * as Sentry from "@sentry/react";
import { useNotification } from './contexts/NotificationContext';
import SwitchableFormButtons from './components/SwitchableFormButtons';
import { handleFormCopyAndNotify, handlePhmcRecruitmentCopyAndNotify, sendBingoNotification, sendPhraseRequestNotification } from './components/notificationService';
import { useData } from './contexts/DataContext';
import LoadingSpinner from './components/LoadingSpinner';
import { useModal } from './contexts/ModalProvider';
import { useSettings } from './contexts/SettingsProvider';
import { useWebhooks } from './hooks/useWebhooks';
import { useImageUpload } from './hooks/useImageUpload';
import { useLockdown } from './contexts/LockdownContext';
import LockdownBanner from './components/LockdownBanner';
import LockdownDialog from './components/LockdownDialog';
// logos
import email from './assets/email.png'
import Civilian from './assets/Civilian.png'
import nurse from './assets/nurse.png'
import PHMCLogo from './assets/phmc.png'
import corpse from './assets/corpse.png'
import tombstone from './assets/tombstone.png'
import phmcpaletobay from './assets/phmcpaletobaylogo.png'
import './assets/fonts/Poppins-Medium.ttf';
import { sendMissingEmployeeNotification } from './components/notificationService';

// css fun
import './App.css';
import './buttons.css';

import 'react-bootstrap-typeahead/css/Typeahead.css';

// database
import { database } from './firebase'; // Your Firebase config
// Lazy-loaded components
const SavedReportsModal = lazy(() => import('./components/SavedReportsModal'));
const AgencyGroupSelectorModal = lazy(() => import('./components/AgencyGroupSelectorModal'));
const AgencySelector = lazy(() => import('./components/AgencySelector'));
const OnboardingModal = lazy(() => import('./components/OnboardingModal'));
const Footer = lazy(() => import('./components/Footer'));
const HeaderInfo = lazy(() => import('./components/HeaderInfo'));
const CoronerTipsModal = lazy(() => import('./components/CoronerTipsModal'));
const BusinessCardModal = lazy(() => import('./components/BusinessCardModal'));
const EmsAmaModal = lazy(() => import('./components/EmsAmaModal'));
const EasterEggModal = lazy(() => import('./components/EasterEggModal'));
const SwitchableFormsModal = lazy(() => import('./components/SwitchableFormsModal'));
const EmployeeModal = lazy(() => import('./components/EmployeeModal'));
const RecruitmentStatusDisplay = lazy(() => import('./components/RecruitmentStatusDisplay'));
const CctvRequestWebhookModal = lazy(() => import('./components/Admin/CctvRequestWebhookModal'));
const FeatureRequestModal = lazy(() => import('./contexts/FeatureRequestModal'));
const PrivacyPolicyModal = lazy(() => import('./components/PrivacyPolicyModal'));
const FormImageLink = lazy(() => import('./components/FormImageLink'));
const EmsBingoModal = lazy(() => import('./components/EmsBingoModal'));

function MainApp({
    formData,
    setFormData,
    lastWebhookIdentifier,
    setLastWebhookIdentifier,
    initialFormData,
    showNotification,
    removeNotification,
}) { 
    const navigate = useNavigate();

    const {
        showEmsBingoModal, setShowEmsBingoModal,
        showEasterEggModal, setShowEasterEggModal,
        easterEggType, setEasterEggType,
        showAgencySelector, setShowAgencySelector,
        hideAgencySelector, setHideAgencySelector,
        showEmployeeModal, setShowEmployeeModal,
        showEmsAmaModal, setShowEmsAmaModal,
        showBusinessCard, setShowBusinessCard,
        showCoronerTips, setShowCoronerTips,
        showAgencyGroupSelectorModal, setShowAgencyGroupSelectorModal,
        showCctvRequestModal, setShowCctvRequestModal,
        showPHMCModal, setShowPHMCModal,
        switchableModalTitle, setSwitchableModalTitle,
        switchableFormsList, setSwitchableFormsList,
        showFeatureRequestModal, setShowFeatureRequestModal,

        showPrivacyPolicyModal, setShowPrivacyPolicyModal,
    } = useModal();

    useEffect(() => {
        const hasAcceptedPrivacyPolicy = localStorage.getItem('hasAcceptedPrivacyPolicy');
        if (!hasAcceptedPrivacyPolicy) {
            setShowPrivacyPolicyModal(true);
        }
    }, []);

    const handlePrivacyPolicyConfirm = () => {
        localStorage.setItem('hasAcceptedPrivacyPolicy', 'true');
        setShowPrivacyPolicyModal(false);
    };

    // Onboarding detection and initialization
    useEffect(() => {
        const onboardingCompleteFlag = localStorage.getItem('onboardingComplete');
        const userPreferences = localStorage.getItem('userOnboardingPreferences');
        
        if (userPreferences) {
            try {
                const preferences = JSON.parse(userPreferences);
                setUserOnboardingPreferences(preferences);
                setOnboardingComplete(true);
            } catch (error) {
                console.warn('Failed to parse user onboarding preferences:', error);
                localStorage.removeItem('userOnboardingPreferences');
            }
        }
        
        // Show onboarding for first-time users
        if (!onboardingCompleteFlag && !userPreferences) {
            setShowOnboarding(true);
        } else {
            setOnboardingComplete(true);
        }
    }, []);

    const handleOnboardingComplete = (preferences) => {
        setUserOnboardingPreferences(preferences);
        setOnboardingComplete(true);
        setShowOnboarding(false);
        
        // Apply user preferences immediately
        if (preferences.allowedCategories?.length === 1) {
            setSelectedAgencyGroup(preferences.allowedCategories[0]);
            localStorage.setItem('selectedAgencyGroup', preferences.allowedCategories[0]);
        }
        
        // Set the default form based on user preferences
        if (preferences.defaultForm) {
            setBbCodeVersion(preferences.defaultForm);
            localStorage.setItem('selectedForm', preferences.defaultForm.toString());
        }
        
        showNotification(`Welcome! Your interface has been customized for ${preferences.userType} users.`, 'check-circle');
    };

    const handleOnboardingSkip = () => {
        setShowOnboarding(false);
        setOnboardingComplete(true);
        showNotification('Onboarding skipped. You can restart it anytime from the Tools menu.', 'info-circle');
    };

    const restartOnboarding = () => {
        localStorage.removeItem('onboardingComplete');
        localStorage.removeItem('onboardingSkipped');
        localStorage.removeItem('userOnboardingPreferences');
        setUserOnboardingPreferences(null);
        setOnboardingComplete(false);
        setShowOnboarding(true);
    };
    const [isMobile, setIsMobile] = useState(false);
    const [showMovedNotification, setShowMovedNotification] = useState(true);
    const [showToolsDropdown, setShowToolsDropdown] = useState(false);
    const modalCloseTimer = useRef(null);
    
    const [fillPhoneChecked, setFillPhoneChecked] = useState(false);
    const [showBBCode, setShowBBCode] = useState(false);
    const [bbCodeVersion, setBbCodeVersion] = useState(() => {
        const storedVersion = localStorage.getItem('bbCodeVersion');
        return storedVersion ? parseInt(storedVersion, 10) : (formDefinitions[0]?.version || 1);
    });
    const [selectedAgencyGroup, setSelectedAgencyGroup] = useState(null);
    const [hideAgencyGroupSelectorPreference, setHideAgencyGroupSelectorPreference] = useState(false);
    
    // Get data from DataContext
    const { 
        phmcListData,
        coronerListData,
        agencyDataStore,
        selectOptions,
        physicianRecruitmentDetails,
        psychRecruitmentDetails,
        adminRecruitmentDetails,
        emsRecruitmentDetails,
        nurseRecruitmentDetails,
        coronerRecruitmentDetails,
        isLoadingData,
        loading
    } = useData();
    const [isJohnDoe, setIsJohnDoe] = useState(false);
    const [isJaneDoe, setIsJaneDoe] = useState(false);
    const [commitInfo, setCommitInfo] = useState({ sha: '', date: null, error: null });
    
    // Onboarding state management
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [userOnboardingPreferences, setUserOnboardingPreferences] = useState(null);
    const [onboardingComplete, setOnboardingComplete] = useState(false);
    const [isLoadingUserReports, setIsLoadingUserReports] = useState(false);
    
    const [featureRequest, setFeatureRequest] = useState('');
    const [discordName, setDiscordName] = useState('');
      const ER_PROTOCOL_VERSION = 19;
 const CONSULTATION_NOTES_PHMC_VERSION = 20;
 const CONSULTATION_NOTES_PBC_VERSION = 21;

    const [isRemoveStaff, setIsRemoveStaff] = useState(false);
    const [missingEmployeeData, setMissingEmployeeData] = useState({
        coronerName: '',
        coronerDiscord: '',
        employeeLastName: '',
        coronerRank: '',
        coronerPHNumber: '',
        coronerEmployee: '',
        coronerBadge: '',
        phmcEmployee: '',
        staffToRemove: [],
        authorizedBy: '',
    });
    const [staffToRemove, setStaffToRemove] = useState([]);
    const [webhookMessage, setWebhookMessage] = useState('');
    const [webhookTitle, setWebhookTitle] = useState('');
    const [isBbcodeRequest, setIsBbcodeRequest] = useState(false);
    const [bbcodeTitleRequest, setBbcodeTitleRequest] = useState('');
    const [bbcodeRequestText, setBbcodeRequestText] = useState('');
    const [currentUtcTime, setCurrentUtcTime] = useState('');
    const [phmcRecruitmentOptIn, setPhmcRecruitmentOptIn] = useState(() => {
        return localStorage.getItem('phmcRecruitmentOptIn') === 'true';
    });

    const { seasonalEffectsEnabled, toggleSeasonalEffects } = useSettings();
    const { lockdownConfig, showDialog, hideDialog, isLockdownActive } = useLockdown();
    const parseBBCode = (bbCode) => {
        const deathReportDefinition = getFormDefinition(1); // Assuming '1' is the ID for Death Report
        if (deathReportDefinition && deathReportDefinition.parser) {
            return deathReportDefinition.parser(bbCode);
        }
        return null; // Return null if no parser is found
    };

    // Get webhooks functions
    const { 
        sendEasterEggNotification,
        handleCctvWebhookSubmit,
    } = useWebhooks(formData, commitInfo, showNotification);
    // Get image upload functions
    const { isUploading, handleImageUpload } = useImageUpload(showNotification, setFormData);
    // All references to bbCodeVersion now occur after its initialization
    const handleSelectAgencyGroup = (group) => {
        setSelectedAgencyGroup(group);
        localStorage.setItem('selectedAgencyGroup', group);
        setShowAgencyGroupSelectorModal(false);
        setShowAgencySelector(true);
    };

    const handleAgencySelect = useCallback((version) => {
        setBbCodeVersion(version);
        setShowAgencySelector(false);
        setShowPHMCModal(false);
    }, [setBbCodeVersion, setShowAgencySelector, setShowPHMCModal]);

    const handleHideAgencyGroupSelectorPreference = (hide) => {
        setHideAgencyGroupSelectorPreference(hide);
        localStorage.setItem('hideAgencyGroupSelectorPreference', hide);
    };




    const handleRecruitmentOptIn = (optIn) => {
        setPhmcRecruitmentOptIn(optIn);
        localStorage.setItem('phmcRecruitmentOptIn', optIn);
        showNotification(`PHMC Recruitment Notifications ${optIn ? 'enabled' : 'disabled'}.`, 'info');
    };

    const handleMainFormSelectionButtonClick = () => {
        setShowAgencySelector(true);
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : value;
        
        setFormData(prev => {
            const newFormData = {
                ...prev,
                [name]: newValue
            };
            // Save to localStorage immediately after state update
            localStorage.setItem('formData', JSON.stringify(newFormData));
            return newFormData;
        });
    };

    const handleSelectChange = (selectedOption, action) => {
        const name = typeof action === 'string' ? action : action.name;

        setFormData(prev => {
            let newFormData;
            if (name === 'coronerEmployee' && selectedOption) {
                newFormData = {
                    ...prev,
                    coronerEmployee: selectedOption.value,
                    coronerBadge: selectedOption.badge,
                    coronerRank: selectedOption.rank,
                    coronerDiscord: selectedOption.discord,
                };
            } else if (name === 'coronerEmployee' && !selectedOption) {
                newFormData = {
                    ...prev,
                    coronerEmployee: '',
                    coronerBadge: '',
                    coronerRank: '',
                    coronerDiscord: '',
                };
            } else {
                newFormData = {
                    ...prev,
                    [name]: selectedOption ? selectedOption.value : ''
                };
            }
            // Save to localStorage immediately after state update
            localStorage.setItem('formData', JSON.stringify(newFormData));
            return newFormData;
        });
    };

    const handleFillCoronerPhone = () => {
        // Logic to fill coroner phone
        showNotification("Coroner phone filled (placeholder)", 'info');
    };

    const addReport = () => {
        setFormData(prev => ({
            ...prev,
            additionalReports: [...(prev.additionalReports || []), '']
        }));
    };

    const removeReport = (index) => {
        setFormData(prev => ({
            ...prev,
            additionalReports: (prev.additionalReports || []).filter((_, i) => i !== index)
        }));
    };
    const handleReportChange = (index, value) => {
        setFormData(prev => {
            const newReports = [...(prev.additionalReports || [])];
            newReports[index] = value;
            return {
                ...prev,
                additionalReports: newReports
            };
        });
    };


    const handleCopyTitle = () => {
        const title = generateTitle();
        navigator.clipboard.writeText(title);
        showNotification('Title copied to clipboard!', 'check-circle');
    };

    const generateTitle = () => {

        const definition = getFormDefinition(bbCodeVersion);
        if (definition && definition.titleGenerator) {
            return definition.titleGenerator(formData);
        }
        return "Untitled Report";
    };
        useEffect(() => {
        const timer = setTimeout(() => {
            setShowMovedNotification(false);
        }, 5000); // Hides after 5 seconds
        return () => clearTimeout(timer);
    }, []);

const getBBCodeContent = () => {
    const definition = getFormDefinition(bbCodeVersion);

    if (definition && definition.generator) {
        if (bbCodeVersion === 999) { // Admin Control Panel version
            return definition.generator({
                isAdminAuthenticated: formData.isAdminAuthenticated,
                adminUserEmail: formData.adminUserEmail,
                adminDisplayData: formData.adminDisplayData,
                adminSelectedCategoryName: formData.adminSelectedCategoryName,
            });
        } else { // For all other forms that have a definition and generator
            let specificPositionData = {}; // Initialize as empty

            // Populate specificPositionData based on the form's group and titleKey
            if (definition.group === "PHMC Recruitment") {
                if (definition.titleKey === "phmcGeneralApplication") { // Physician (50)
                    // physicianRecruitmentDetails is a dedicated state variable
                    specificPositionData = physicianRecruitmentDetails || {};
                } else if (definition.titleKey === "phmcPsychApplication") { // Psych (51)
                    // psychRecruitmentDetails is a dedicated state variable
                    specificPositionData = psychRecruitmentDetails || {};
                } else if (definition.titleKey === "phmcAdminApplication") { // Admin (52)
                    specificPositionData = selectOptions.adminPositionDetailsData || {};
                } else if (definition.titleKey === "phmcNursingApplication") { // Nursing (53)
                    specificPositionData = selectOptions.nursePositionDetailsData || {};
                } else if (definition.titleKey === "phmcCoronerRecruitmentApplication") { // Coroner (54)
                    specificPositionData = selectOptions.coronerPositionDetailsData || {};
                } else if (definition.titleKey === "phmcEMSApplication") { // EMS (55)
                    specificPositionData = selectOptions.emsPositionDetailsData || {};
                }
            } // Closing brace moved outside the 'if' block

            const generatorArgs = {
                ...formData,
                // Ensure positionDetailsData is always an object, even if specificPositionData is null/undefined
                positionDetailsData: specificPositionData || {},
                agencyDataStore: agencyDataStore, // Pass agencyDataStore
            };
            return definition.generator(generatorArgs);
        }
    } else {
        Sentry.captureMessage(`No BBCode generator found for version: ${bbCodeVersion}`);
        const formName = (getFormDefinition(bbCodeVersion) || {}).name || `Form v${bbCodeVersion}`;
        return `BBCode generation for form "${formName}" is not implemented.`;
    }
};
        const initialLoadFormData = () => {
        const storedData = localStorage.getItem('formData');
        return storedData ? JSON.parse(storedData) : initialFormData;
    };

        useEffect(() => {
        const fieldsToSaveToLS = [
            'phmcEmployee', 'phmcEmployeeLastName', 'phmcRank',
            'coronerEmployee', 'coronerBadge', 'coronerRank', 'coronerDiscord', 'coronerPHNumber',
            'pronouncedTimeOfDeath', 'department', 'dateTime', 'placeOfDeath', 'mannerOfDeath',
        ];

        fieldsToSaveToLS.forEach(field => {
            if (formData[field]) {
                localStorage.setItem(field, formData[field]);
            } else {
                localStorage.removeItem(field);
            }
        });

        const { evidenceLockerID, ...formDataToPersist } = formData;
        localStorage.setItem('formData', JSON.stringify(formDataToPersist));
    }, [formData]);


    const getCopyButtonText = () => {
        if (selectedAgencyGroup === 'PHMC Recruitment') {
            return 'Copy Recruitment BBCode';
        }
        return 'Copy BBCode';
    };
    
    const getCurrentReportAuthor = useCallback((formData) => {
        // Define which bbCodeVersions are primarily Coroner forms
        const coronerFormVersions = [1, 2, 4, 8, 11, 18, 37];
        // Define which bbCodeVersions are primarily PHMC forms
        const phmcFormVersions = [
            5, 6, 7, 9, 10, 12, 13, 14, 16, 19, 20, 21, 22, 23, 27, 28, 29, 35 // Added Sickness Email
        ];

        if (coronerFormVersions.includes(bbCodeVersion)) {
            return formData.coronerEmployee || null;
        } else if (phmcFormVersions.includes(bbCodeVersion)) {
            return formData.phmcEmployee || null;
        }

        // Fallback logic for forms that are not strictly coroner or phmc
        if (formData.coronerEmployee) return formData.coronerEmployee;
        if (formData.phmcEmployee) return formData.phmcEmployee;

        // Fallback for forms where patient might be considered the "author"
        if (bbCodeVersion === 25 || bbCodeVersion === 3 || bbCodeVersion === 24) {
            if (formData.patientName) return formData.patientName;
            if (formData.patientFirstName && formData.patientLastName) return `${formData.patientFirstName} ${formData.patientLastName}`;
            if (formData.patientFirstName) return formData.patientFirstName;
            if (formData.patientLastName) return formData.patientLastName;
        }
        
        return null; // If no author can be determined
    }, [bbCodeVersion]); // This hook depends on the current bbCodeVersion

    const filterFormData = (formData, bbCodeVersion) => {
        const relevantFields = getRelevantFields(bbCodeVersion);
        const filteredData = {};

        relevantFields.forEach(field => {
            if (formData.hasOwnProperty(field)) {
                filteredData[field] = formData[field];
            }
        });

        return filteredData;
    };
    const versionNames = {
        1: "Death Report",
        2: "Coroner Email",
        3: "Patient File - Advanced",
        4: "Autopsy Report",
        5: "Surgery Report",
        6: "Physical Evaluation (PHMC)",
        7: "Physical Evaluation (PBC)",
        8: "Death Certificate",
        9: "Obs Main File",
        10: "Obs Follow Up",
        11: "Mass Fatality Report",
        12: "Gynecology - Main File",
        13: "Gynecology - Add Reply",
        14: "Mental Health - PHMC",
        16: "Mental Health - PBC",
        18: "Agency Feedback",
        19: "Emergency Room Protocols",
        20: "Consultation Notes (PHMC)",
        21: "Consultation Notes (PBC)",
        22: "Commentary Note (PHMC)",
        23: "Commentary Note (PBC)",
        24: "Medical Release Records",
        25: "Patient File - Basic",
        26: "Medical Record Update",
        27: "Email Forms",
        28: "Psychological Evaluation PHMC",
        29: "Psychological Evaluation PBC",
        35: "PHMC - Email Generator",
        50: "PHMC - Physician Careers",
        51: "PHMC - Psych Careers",
        52: "PHMC - Admin Careers",
        53: "PHMC - Nursing Careers",
        54: "PHMC - Coroner Careers",
        55: "PHMC - EMS Careers"
    };

    const { 
        saveReport,
        savedReports,
        setSavedReports,
        showSavedReports,
        setShowSavedReports,
        
        loadUserSavedReports,
        loadReportForUser,
        handleReportSelectedForAttachment,
        onAttachReportSummaryRequest,
        deleteReportForUser,
        showRareEasterEggDirectly,
        toggleSavedReports,
        showPositionInfoModal,
        setShowPositionInfoModal,
        currentPositionInfo,
        setCurrentPositionInfo,
        handleShowPositionInfo,
        pendingReportAttachmentCallback,
        reportSelectionFilter,
        setReportSelectionFilter
    } = useReportManagement(
        formData,
        setFormData,
        bbCodeVersion,
        setBbCodeVersion,
        getBBCodeContent,
        getCurrentReportAuthor,
        filterFormData,
        coronerListData,
        phmcListData,
        selectOptions,
        showNotification,
        removeNotification,
        setShowEasterEggModal,
        setEasterEggType,
        sendEasterEggNotification,
        modalCloseTimer,
        versionNames,
        ER_PROTOCOL_VERSION,
        CONSULTATION_NOTES_PHMC_VERSION,
        CONSULTATION_NOTES_PBC_VERSION,
        physicianRecruitmentDetails,
        psychRecruitmentDetails,
        adminRecruitmentDetails,
        emsRecruitmentDetails,
        nurseRecruitmentDetails,
        coronerRecruitmentDetails,
        selectedAgencyGroup
    );



    const clearForm = () => {
        setFormData(prevFormData => ({
            ...initialFormData,
            coronerEmployee: prevFormData.coronerEmployee,
            phmcEmployee: prevFormData.phmcEmployee,
            coronerBadge: prevFormData.coronerBadge,
            coronerRank: prevFormData.coronerRank,
            coronerDiscord: prevFormData.coronerDiscord,
            SubmitDate: new Date().toISOString().split('T')[0],
        }));
        const fieldsToRemove = [
            'dateTime', 'department', 'pronouncedTimeOfDeath', 'placeOfDeath', 'mannerOfDeath'
        ];
        fieldsToRemove.forEach(field => {
            localStorage.removeItem(field);
            localStorage.removeItem(`${field}_timestamp`);
        });
        setLastWebhookIdentifier(null);
        showNotification('Form cleared! Employee selections preserved.', 'check-circle');
    };

    
    // --- START: Data Fetching and Caching Logic ---
    
    const handleShowCctvRequestModal = () => {
        setShowAgencyGroupSelectorModal(false); // Hide the main selector if it's open
        setShowCctvRequestModal(true);
    };
    


    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768); // Adjust breakpoint as needed
        };

        // Set initial value
        handleResize();

        // Listen for window resize events
        window.addEventListener('resize', handleResize);

        // Clean up the event listener on unmount
        return () => window.removeEventListener('resize', handleResize);
    }, []);



    const { imageSource: deathReportImage, className: deathReportClass, season, effect } = seasonalEffectsEnabled ? SeasonalEvents({ imageType: 'deathReport' }) : {};
    const { imageSource: civilianPaperworkImage, className: civilianPaperworkClass } = seasonalEffectsEnabled ? SeasonalEvents({ imageType: 'civilianPaperwork'  }) : {};

    const handleCopyAndNotifyWrapper = useCallback(() => {
        if (selectedAgencyGroup === 'PHMC Recruitment') {
            handlePhmcRecruitmentCopyAndNotify({
                formData,
                getBBCodeContent,
                showNotification,
                commitInfo,
                selectOptions,
                formDefinition: getFormDefinition(bbCodeVersion),
            });
        } else {
            handleFormCopyAndNotify({
                formData,
                bbCodeVersion,
                selectedAgencyGroup,
                getBBCodeContent,
                getFormDefinition,
                saveReport,
                showNotification,
                removeNotification,
                handleAgencySelect,
                setLastWebhookIdentifier,
                lastWebhookIdentifier,
                commitInfo,
                database,
                getCurrentReportAuthor,
            });
        }
    }, [
        selectedAgencyGroup, 
        formData, 
        getBBCodeContent, 
        showNotification, 
        commitInfo, 
        selectOptions, 
        bbCodeVersion, 
        saveReport, 
        removeNotification, 
        handleAgencySelect, 
        setLastWebhookIdentifier, 
        lastWebhookIdentifier, 
        database,
        getCurrentReportAuthor
    ]);

    const currentFormDefinition = useMemo(() => getFormDefinition(bbCodeVersion), [bbCodeVersion]);
    const FieldComponent = currentFormDefinition ? currentFormDefinition.FieldComponent : null;
    if (selectedAgencyGroup && !FieldComponent && !isLoadingData) {
        const warningMessage = `No FieldComponent found for bbCodeVersion: ${bbCodeVersion} in group: ${selectedAgencyGroup}.`;
        console.warn(`[App.js] ${warningMessage}`, currentFormDefinition);
        Sentry.captureMessage(warningMessage, {
            level: 'warning',
            extra: {
                bbCodeVersion: bbCodeVersion,
                selectedAgencyGroup: selectedAgencyGroup,
                currentFormDefinition: currentFormDefinition || 'Not found', // Ensure currentFormDefinition is not undefined for Sentry
                isLoadingData: isLoadingData
            }
        });
    }
    const coronerFormsSubGroup = [
        { version: 1, name: "Decedent Services", icon: corpse },
        { version: 2, name: "Email Generator", icon: email },
        { version: 4, name: "Autopsy Report", icon: corpse },
        { version: 8, name: "Death Certificate", icon: PHMCLogo },
        { version: 11, name: "Mass Fatality Report", icon: corpse },
        { version: 37, name: "Public Death Record ", icon: tombstone }
    ];
    const physicalEvalFormsSubGroup = [
        { version: 6, name: "Physical Evaluation PHMC", icon: PHMCLogo },
        { version: 7, name: "Physical Evaluation PBC", icon: phmcpaletobay }
    ];
    const psychEvalFormsSubGroup = [
        { version: 28, name: "Psychological Evaluation | PHMC", icon: PHMCLogo },
        { version: 29, name: "Psychological Evaluation | PBC", icon: phmcpaletobay }
    ];
    const generalConsultFormsSubGroup = [
        { version: 20, name: "General Consultation | PHMC", icon: PHMCLogo },
        { version: 21, name: "General Consultation | PBC", icon: phmcpaletobay }
    ];
    const commentaryNoteFormsSubGroup = [
        { version: 22, name: "Commentary Note | PHMC", icon: PHMCLogo },
        { version: 23, name: "Commentary Note | PBC", icon: phmcpaletobay }
    ];
    const mentalHealthFormsSubGroup = [
        { version: 14, name: "Mental Health - PHMC", icon: PHMCLogo },
        { version: 16, name: "Mental Health | PBC", icon: phmcpaletobay }
    ];
    const civilianFormsSubGroup = [
        { version: 24, name: "Medical Record Release", icon: Civilian },
        { version: 25, name: "Basic Patient File", icon: nurse }, // Assuming nurse icon for basic
        { version: 3, name: "Detailed Patient File", icon: nurse }, // Assuming nurse icon for advanced
        { version: 26, name: "Update Medical Records", icon: Civilian},
    ];
    const phmcInternalEmails = [
    { version: 24, name: "Internal Email", icon: Civilian },
    { version: 35, name: "Sick Note", icon: nurse }, // Assuming nurse icon for basic
    ];

// Switch Form Handling Logic
    
 const openSwitchableModal = (title, formsArray) => {
        setSwitchableModalTitle(title);
        setSwitchableFormsList(formsArray);
        setShowPHMCModal(true); // Use the existing state to show/hide the modal
    };


    // --- Updated useEffect for CoronerTipsModal ---
    useEffect(() => {
        const isCoronerForm = [1, 2, 18].includes(bbCodeVersion);
        // Check localStorage *here* to prevent automatic showing
        const shouldHidePermanently = localStorage.getItem('hideCoronerTipsModal') === 'true';

        // Only set state to show automatically if it's a coroner form AND not permanently hidden
        if (isCoronerForm && !shouldHidePermanently) {
            setShowCoronerTips(true);
        } else {
            // Ensure it's hidden if not a coroner form or if permanently hidden
            // This prevents it from staying open if the user switches away from a coroner form
            // while the modal is open AND they haven't clicked "Don't show again".
            setShowCoronerTips(false);
        }

    }, [bbCodeVersion]); // Re-run only when bbCodeVersion changes
        useEffect(() => {
        localStorage.setItem('bbCodeVersion', bbCodeVersion.toString());
    }, [bbCodeVersion]);


    useEffect(() => {
        // Only save bbCodeVersion if a group has been selected
        if (selectedAgencyGroup) {
            localStorage.setItem('bbCodeVersion', bbCodeVersion.toString());
        }
    }, [bbCodeVersion, selectedAgencyGroup]);

// Feature Request Handling
const phmcRecruitmentFormsSubGroup = formDefinitions.filter(
    form => form.group === "PHMC Recruitment"
);

    

// Inside src/App.js


const handleMissingEmployeeSubmit = async (actionType, employeeType, selectedEmployeeName, newRank, staffToRemove, authorizedBy, missingEmployeeData, updatedStaff) => {
    await sendMissingEmployeeNotification(
        actionType,
        employeeType,
        selectedEmployeeName,
        newRank,
        coronerListData, 
        phmcListData, 
        staffToRemove,
        authorizedBy,
        missingEmployeeData,
        commitInfo,
        showNotification, 
        formData.coronerEmployee, 
        formData.phmcEmployee
    );

    // Trigger refresh after any action involving EmployeeModal
    if (actionType === 'updateRank') {
        showNotification("Refreshing staff data...", 'info-circle', 2000);
    }

    if (actionType === 'updateRank') {
        showNotification("Staff data refreshed.", 'check-circle', 3000);
    }
};




    useEffect(() => {
        // Check for a redirect from the 404 page via sessionStorage
        const redirectPath = sessionStorage.getItem('redirectPath');
        if (redirectPath) {
            sessionStorage.removeItem('redirectPath'); // Clear it after use

            // Use history.replaceState to update the URL in the address bar
            // without reloading the page. This makes the URL look correct to the user.
            window.history.replaceState(null, '', redirectPath);
        }

        // Now, use the current URL's pathname for routing logic.
        // After the replaceState, window.location.pathname will be the path we want.
        const currentPath = window.location.pathname;
        const hash = window.location.hash;


        if (hash === '#bingo' || currentPath.endsWith('/bingo')) {
            console.log("Bingo route detected. Opening Bingo modal.");
            setShowEmsBingoModal(true);
        } else if (currentPath.endsWith('/cctv')) {
            console.log("CCTV route detected. Opening CCTV modal.");
            handleShowCctvRequestModal();
        }
    }, []); // Empty dependency array ensures this runs only once on initial load
    const handleHideEmsBingoModal = useCallback(() => {
        setShowEmsBingoModal(false);

        const url = new URL(window.location.href);

        // Check and clean the hash.
        if (url.hash === '#bingo') {
            url.hash = '';
        }

        // Check and clean the path.
        if (url.pathname.endsWith('/bingo')) {
            url.pathname = url.pathname.replace(/bingo$/, '') || '/';
        }

        window.history.replaceState({}, document.title, url.href);

    }, []);

    

    const handleHideCctvRequestModal = useCallback(() => {
        setShowCctvRequestModal(false);
        // When the modal is closed, remove '/cctv' from the URL if it's there
        const url = new URL(window.location.href);
        if (url.pathname.endsWith('/cctv')) {
            url.pathname = url.pathname.replace(/cctv$/, '') || '/';
            window.history.replaceState({}, document.title, url.href);
        }
    }, []);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const redirectedPath = urlParams.get('p');
        const currentPath = window.location.pathname;
        const hash = window.location.hash;

        if (hash === '#bingo' || currentPath.endsWith('/bingo') || (redirectedPath && redirectedPath.endsWith('/bingo'))) {
            setShowEmsBingoModal(true);
        } else if (currentPath.endsWith('/cctv') || (redirectedPath && redirectedPath.endsWith('/cctv'))) {
            handleShowCctvRequestModal();
        }

        if (redirectedPath) {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('p');
            window.history.replaceState({}, document.title, newUrl.href);
        }
    }, []); // This effect runs once on initial load




    

    // --- Add state to explicitly control dropdown visibility ---
// Separate PHMC options
    const phmcGroupedOptions = useMemo(() => {
        if (!phmcListData || phmcListData.length === 0) return [];
        return Object.entries(
            phmcListData.reduce((groups, employee) => {
                const categoryName = employee.category || 'Uncategorized';
                if (!groups[categoryName]) {
                    groups[categoryName] = [];
                }
                groups[categoryName].push({
                    value: employee.name, // Or a unique ID if 'name' isn't unique
                    label: employee.name,
                    category: employee.category,
                    lastName: employee.lastName
                    // Add any other fields needed by the Select component or your logic
                });
                return groups;
            }, {})
        ).map(([category, options]) => ({
            label: category,
            options: options.sort((a, b) => a.label.localeCompare(b.label))
        })).sort((a, b) => { // Your existing sorting logic for categories
            const order = ['Leadership', 'Hospital Supervisor', 'Chief Resident', 'Physician', 'Resident Physician', 'Physician Assistant', 'Psychiatrist', 'Psychologist', 'Dentist', 'Nursing', 'Emergency Medical Services', 'Attending Physician', 'Uncategorized'];
            return order.indexOf(a.label) - order.indexOf(b.label);
        });
    }, [phmcListData]);

    const coronerGroupedOptions = useMemo(() => {
        if (!coronerListData || coronerListData.length === 0) return [];
        return Object.entries(
            coronerListData.reduce((groups, coroner) => {
                const categoryName = coroner.category || 'Uncategorized';
                if (!groups[categoryName]) {
                    groups[categoryName] = [];
                }
                groups[categoryName].push({
                    value: coroner.name, // Or a unique ID
                    label: `${coroner.name} (${coroner.rank || 'Coroner'})`,
                    badge: coroner.badge,
                    rank: coroner.rank,
                    discord: coroner.discord,
                    category: categoryName
                    // Add other fields
                });
                return groups;
            }, {})
        ).map(([category, options]) => ({
            label: category,
            options: options.sort((a, b) => a.label.localeCompare(b.label))
        })).sort((a, b) => { // Your existing sorting logic for coroner categories
            const order = ['Chief Boss', 'Deputy Chief Medical Examiner-Coroner,', 'Supervisor', 'Senior Medical Examiner', 'Medical Examiner', 'Senior Coroner Investigator', 'Coroner Investigator', 'Forensic Attendant', 'Trainee Forensic-Attendant', 'Developer Testing', 'Missing_Category', 'Uncategorized'];
            return order.indexOf(a.label) - order.indexOf(b.label);
        });
    }, [coronerListData]);


    const handleDoeChange = (type) => (e) => {
        const isChecked = e.target.checked;

        if (isChecked) {
            setFormData(prev => ({ ...prev, massFatality: false }));
        }

        // This part resets other modal states when a 'Doe' option is selected.
        if (isChecked) {
            setIsRemoveStaff(false);
            setMissingEmployeeData(prev => ({
                ...prev,
                staffToRemove: [],
                employeeLastName: '',
                authorizedBy: '',
            }));
        }

        if (type === 'john') {
            setIsJohnDoe(isChecked);
            if (isChecked) {
                setIsJaneDoe(false); 
                setFormData(prev => ({ ...prev, decedentName: 'John Doe' }));
            } else {
                if (formData.decedentName === 'John Doe') {
                    setFormData(prev => ({ ...prev, decedentName: '' }));
                }
            }
        } else if (type === 'jane') {
            setIsJaneDoe(isChecked);
            if (isChecked) {
                setIsJohnDoe(false); // Uncheck the other 'Doe'
                setFormData(prev => ({ ...prev, decedentName: 'Jane Doe' }));
            } else {
                if (formData.decedentName === 'Jane Doe') {
                    setFormData(prev => ({ ...prev, decedentName: '' }));
                }
            }
        }
    };


    // UTC time stuff
    useEffect(() => {
        const updateUtcTime = () => {
            const now = new Date();

            const pad = (num) => num.toString().padStart(2, '0');

            // Get UTC date components
            const day = pad(now.getUTCDate());
            const monthName = now.toLocaleString('en-US', { timeZone: 'UTC', month: 'long' });
            const year = now.getUTCFullYear();

            // Get UTC time components
            const hours = pad(now.getUTCHours());
            const minutes = pad(now.getUTCMinutes());
            const seconds = pad(now.getUTCSeconds());

            // Construct the desired string format
            const utcString = `${day}/${monthName}/${year} ${hours}:${minutes}:${seconds} UTC`;

            setCurrentUtcTime(utcString);
        };

        updateUtcTime(); // Initial update
        const intervalId = setInterval(updateUtcTime, 1000); // Update every second

        return () => clearInterval(intervalId);
    }, []); 
    
    
    const combinedStaffOptions = [
        {
            label: 'Coroners',
            options: coronerListData.map(c => ({ value: c.name, label: `${c.name} (${c.rank || 'Coroner'})` }))
        },
        {
            label: 'PHMC Staff',
            options: phmcListData.map(p => ({ value: p.name, label: `${p.name} (${p.category || 'PHMC'})` }))
        }
    ].filter(group => group.options.length > 0); // Filter out empty groups if any list is empty
    // Effect to manage initial agency group selection
    useEffect(() => {
        // Skip if onboarding is not complete yet
        if (!onboardingComplete) return;
        
        const savedGroup = localStorage.getItem('selectedAgencyGroup');
        const hidePreference = localStorage.getItem('hideAgencyGroupSelectorPreference') === 'true';
        setHideAgencyGroupSelectorPreference(hidePreference);

        // If user has onboarding preferences, respect them
        if (userOnboardingPreferences?.allowedCategories?.length === 1) {
            const preferredGroup = userOnboardingPreferences.allowedCategories[0];
            setSelectedAgencyGroup(preferredGroup);
            setShowAgencyGroupSelectorModal(false);
            return;
        }

        if (savedGroup && hidePreference) { // Only auto-select if preference is to hide
            setSelectedAgencyGroup(savedGroup);
            setShowAgencyGroupSelectorModal(false);
        } else if (onboardingComplete) { // Only show selector after onboarding is complete
            setShowAgencyGroupSelectorModal(true); // Show if no saved group or preference is not to hide
        }
    }, [onboardingComplete, userOnboardingPreferences]);
    
    // This useEffect ensures selectedAgencyGroup is primarily driven by bbCodeVersion.
    // It runs when bbCodeVersion changes, correcting selectedAgencyGroup if needed.
    useEffect(() => {
        localStorage.setItem('bbCodeVersion', bbCodeVersion.toString());
        const definition = getFormDefinition(bbCodeVersion);
        if (definition) {
            if (selectedAgencyGroup !== definition.group) { // Optimization
                setSelectedAgencyGroup(definition.group);
            }
            // Always ensure localStorage is in sync with the definition's group
            localStorage.setItem('selectedAgencyGroup', definition.group);
        } else {
            if (selectedAgencyGroup !== null) { // Optimization
                setSelectedAgencyGroup(null);
            }
            localStorage.removeItem('selectedAgencyGroup');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bbCodeVersion]); // This effect should primarily react to bbCodeVersion changes.
        return ( 
            
        <Suspense fallback={<LoadingSpinner />}>
            <div className="App">
                <LockdownBanner notification={lockdownConfig.notification} show={isLockdownActive} />
                <LockdownDialog show={showDialog} onHide={hideDialog} message={lockdownConfig.dialog} />
                <PrivacyPolicyModal isOpen={showPrivacyPolicyModal} onClose={handlePrivacyPolicyConfirm} />
                <OnboardingModal 
                    show={showOnboarding} 
                    onComplete={handleOnboardingComplete}
                    onSkip={handleOnboardingSkip}
                    formDefinitions={formDefinitions}
                    showNotification={showNotification}
                    phmcList={phmcListData}
                    coronerList={coronerListData}
                />
                <AgencyGroupSelectorModal
                show={showAgencyGroupSelectorModal && !selectedAgencyGroup && onboardingComplete}
                onSelectGroup={handleSelectAgencyGroup}
                onHideSelectorPreference={handleHideAgencyGroupSelectorPreference}
    physicianRecruitmentDetails={selectOptions.physicianRecruitmentDetails || {}}
    psychRecruitmentDetails={selectOptions.psychPositionDetailsData || {}}
    adminRecruitmentDetails={selectOptions.adminPositionDetailsData || {}}
    emsRecruitmentDetails={selectOptions.emsPositionDetailsData || {}}
                    handleFormSelect={handleAgencySelect} // This now triggers the opt-in logic
    nurseRecruitmentDetails={selectOptions.nursePositionDetailsData || {}}
    coronerRecruitmentDetails={selectOptions.coronerPositionDetailsData || {}}
                    onShowCctvRequest={handleShowCctvRequestModal} // --- MODIFICATION: Pass new handler

            />

            <SwitchableFormsModal
                show={showPHMCModal}
                onHide={() => setShowPHMCModal(false)}
                title={switchableModalTitle}
                forms={switchableFormsList}
                handleFormSelect={(version) => {
                    setBbCodeVersion(version);
                    setShowPHMCModal(false);
                }}
                isMobile={isMobile}
                physicianRecruitmentDetails={selectOptions.physicianRecruitmentDetails}
                psychRecruitmentStatus={selectOptions.psychPositionDetailsData}
                adminRecruitmentDetails={selectOptions.adminPositionDetailsData}
                emsRecruitmentDetails={selectOptions.emsPositionDetailsData}
                nurseRecruitmentDetails={selectOptions.nursePositionDetailsData}
                coronerRecruitmentDetails={selectOptions.coronerPositionDetailsData}
                formDefinitions={formDefinitions}
                userPreferences={userOnboardingPreferences}
            />

            <CctvRequestWebhookModal
                show={showCctvRequestModal}
                onHide={handleHideCctvRequestModal} // Ensure this uses the new handler
                onSubmit={handleCctvWebhookSubmit}
                showNotification={showNotification}
            />

            <EasterEggModal
                show={showEasterEggModal}
                type={easterEggType} // Pass the type ('normal' or 'rare')
                onHide={() => {
                    setShowEasterEggModal(false);
                    setEasterEggType(null); // Reset type on hide
                }}
            />
            {seasonalEffectsEnabled && effect}


        <CoronerTipsModal
            show={showCoronerTips}
            onClose={() => {
                setShowCoronerTips(false);
            }}
        />

        <EmsAmaModal
                show={showEmsAmaModal}
                onHide={() => setShowEmsAmaModal(false)}
                showNotification={showNotification}
                commitInfo={commitInfo}
                handleImageUpload={handleImageUpload}
            />

                    {showAgencySelector && ( // Only show if a group is selected
                        <AgencySelector
                            showAgencySelector={showAgencySelector}
                            setShowAgencySelector={setShowAgencySelector}
                            handleAgencySelect={handleAgencySelect}
                            isMobile={isMobile}
                            hideAgencySelector={hideAgencySelector}
                            setHideAgencySelector={setHideAgencySelector}
                            selectedAgencyGroup={selectedAgencyGroup}
                            formDefinitions={formDefinitions}
                            physicianRecruitmentDetails={physicianRecruitmentDetails}
                            psychRecruitmentDetails={psychRecruitmentDetails}
                            adminRecruitmentDetails={adminRecruitmentDetails}
                            emsRecruitmentDetails={emsRecruitmentDetails}
                            nurseRecruitmentDetails={nurseRecruitmentDetails}
                            coronerRecruitmentDetails={coronerRecruitmentDetails}
                            userPreferences={userOnboardingPreferences}
                        />
                        
                    )}

            <div className="header-info-wrapper">
            <HeaderInfo commitInfo={commitInfo} /> 
            </div>

            <div className="container-fluid"> 
                
                <div className="form-container">
                <div className="button-group">
  
        <div className="floating-tools-container">

            <Dropdown drop="up" show={showToolsDropdown} onToggle={(isOpen) => setShowToolsDropdown(isOpen)}>
                <Dropdown.Toggle variant="secondary" id="dropdown-tools">
                    <i className="fas fa-tools"></i> Tools
                </Dropdown.Toggle>

                <Dropdown.Menu>
                    <Dropdown.Item onClick={() => {setShowEmployeeModal(true); setShowToolsDropdown(false);}}>
                        <i className="fas fa-users-cog"></i> Manage PHMC Staff
                    </Dropdown.Item>
                     <Dropdown.Item onClick={() => {setShowFeatureRequestModal(true); setShowToolsDropdown(false);}}>
                        <i className="fas fa-bug"></i> Report Bug/Feature
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => {toggleSavedReports(); setShowToolsDropdown(false);}}>
                        <i className="fas fa-save"></i> Saved Reports
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => {setShowEmsAmaModal(prev => !prev); setShowToolsDropdown(false);}}>
                        <i className="fa-solid fa-truck-medical"></i> EMS AMA
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => {toggleSeasonalEffects(); setShowToolsDropdown(false);}}>
                        <i className={`fas ${seasonalEffectsEnabled ? 'fa-snowflake' : 'fa-sun'}`}></i> 
                        {seasonalEffectsEnabled ? 'Disable' : 'Enable'} Seasonal Effects
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => {restartOnboarding(); setShowToolsDropdown(false);}}>
                        <i className="fas fa-play-circle"></i> Restart Setup Guide
                    </Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item onClick={() => {{
                        localStorage.removeItem('selectedAgencyGroup');
                        setSelectedAgencyGroup(null);
                        setShowAgencyGroupSelectorModal(true);
                        setShowToolsDropdown(false);
                    }}}>
                        <i className="fas fa-users"></i> Switch Form Type
                    </Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown>
        </div>

            <FeatureRequestModal
                show={showFeatureRequestModal}
                onClose={() => setShowFeatureRequestModal(false)}
                featureRequest={featureRequest}
                setFeatureRequest={setFeatureRequest}
                discordName={discordName}
                setDiscordName={setDiscordName}
                isBbcodeRequest={isBbcodeRequest}
                setIsBbcodeRequest={setIsBbcodeRequest}
                bbcodeTitleRequest={bbcodeTitleRequest}
                setBbcodeTitleRequest={setBbcodeTitleRequest}
                bbcodeRequestText={bbcodeRequestText}
                setBbcodeRequestText={setBbcodeRequestText}
                bbCodeVersion={bbCodeVersion}
                commitInfo={commitInfo}
                setShowFeatureRequestModal={setShowFeatureRequestModal}
            />

                 <Button
                        variant="secondary"
                        type="button"
                        className="changelog-button"
                        onClick={() => setShowBusinessCard(prev => !prev)}
                    >
                        <i className="fa-solid fa-address-card"></i>
                        Business Card Tool
                    </Button>
            <div className="floating-top-right-tools">
                {selectedAgencyGroup === 'PHMC Recruitment' && (
                    <Button
                        variant={phmcRecruitmentOptIn ? "outline-success" : "outline-secondary"}
                        onClick={() => handleRecruitmentOptIn(!phmcRecruitmentOptIn)}
                        className="changelog-button" // You can use existing or new class
                        title={phmcRecruitmentOptIn ? "Click to Opt-out of PHMC Recruitment Notifications" : "Click to Opt-in to PHMC Recruitment Notifications"}
                    > Desktop Alert Toggle
                        <i className={`fas ${phmcRecruitmentOptIn ? 'fa-bell-slash' : 'fa-bell'}`}></i>
                        {/* Optionally, keep text for larger screens or use icons only */}
                        {/* {phmcRecruitmentOptIn ? " Rec. Notifs: ON" : " Rec. Notifs: OFF"} */}
                    </Button>
                )}
            </div>

                    {(() => {
                        if (selectedAgencyGroup === 'PHMC Recruitment' && formData.recruitmentPosition) {

                            let currentRecruitmentDetailsSource = null;
                            let positionDisplayNameForTitle = formData.recruitmentPosition || 'selected position';
                            const currentFormDef = getFormDefinition(bbCodeVersion);

                            if (currentFormDef?.titleKey === "phmcGeneralApplication") {
                                currentRecruitmentDetailsSource = selectOptions.physicianRecruitmentDetails;
                            } else if (currentFormDef?.titleKey === "phmcPsychApplication") {
                                currentRecruitmentDetailsSource = selectOptions.psychPositionDetailsData;
                            } else if (currentFormDef?.titleKey === "phmcAdminApplication") {
                                currentRecruitmentDetailsSource = selectOptions.adminPositionDetailsData;
                            } else if (currentFormDef?.titleKey === "phmcNursingApplication") {
                                currentRecruitmentDetailsSource = selectOptions.nursePositionDetailsData;
                            } else if (currentFormDef?.titleKey === "phmcEMSApplication") {
                                currentRecruitmentDetailsSource = selectOptions.emsPositionDetailsData;
                            } else if (currentFormDef?.titleKey === "phmcCoronerRecruitmentApplication") {
                                currentRecruitmentDetailsSource = selectOptions.coronerPositionDetailsData;
                            }

                            if (currentRecruitmentDetailsSource && currentRecruitmentDetailsSource[formData.recruitmentPosition]) {
                                positionDisplayNameForTitle = currentRecruitmentDetailsSource[formData.recruitmentPosition].displayName || formData.recruitmentPosition;
                            }

                            // Only render the button if the source data for the current form type is available
                            if (currentRecruitmentDetailsSource) {
                                return (
                                    <Button
                                        variant="info"
                                        type="button"
                                        className="changelog-button"
                                        onClick={() => handleShowPositionInfo(formData.recruitmentPosition)}
                                        title={`More info about ${positionDisplayNameForTitle}`}
                                    >
                                        <i className="fas fa-info-circle"></i>
                                        Position Info
                                    </Button>
                                );
                            }
                        }
                        return null; // Return null if conditions aren't met
                        
                    })()}

                    {(bbCodeVersion === 1 || bbCodeVersion === 2 || bbCodeVersion === 18) && (

                    <Button
                    variant="secondary"
                type="button"
                className="changelog-button"
                onClick={() => setShowCoronerTips(true)} // This button click ALWAYS sets show to true
            >
                Coroner Tips
            </Button>
                    )}
</div>

                    <div className="button-group">

                        <Button
                            type="button"
                            variant="phmc" // You might want a dynamic variant too
                            className="changelog-button"
                            onClick={() => window.open('https://phmc.gta.world/', '_blank')}
                        >
                            <i className="fas fa-hospital"></i>
                            PHMC
                        </Button>
                        <Button
                            className="changelog-button"
                            variant='secondary'
                            onClick={handleMainFormSelectionButtonClick} // Use the new handler
                        >
                            <i className="fas fa-exchange-alt"></i>
                            {/* Update text to be more generic if no group is selected */}
                            Select {selectedAgencyGroup || "Agency"} Form
                        </Button>

                        <SwitchableFormButtons
                            bbCodeVersion={bbCodeVersion}
                            openSwitchableModal={openSwitchableModal}
                            formGroups={{
                                coronerFormsSubGroup,
                                physicalEvalFormsSubGroup,
                                psychEvalFormsSubGroup,
                                generalConsultFormsSubGroup,
                                commentaryNoteFormsSubGroup,
                                mentalHealthFormsSubGroup,
                                civilianFormsSubGroup,
                                phmcInternalEmails
                            }}
                        />
                    </div>
                            <form> 
                                <Suspense fallback={<LoadingSpinner />}>
                                    {FieldComponent ? (
                                        <FieldComponent
                                            formData={formData}
                                            handleChange={handleChange}
                                            commitInfo={commitInfo}
                                            // Pass all necessary props from App.js state and selectOptions
                                            setFormData={setFormData}                                        
                                            typeOfDeathOptions={selectOptions.typeOfDeathOptions || []}
                                            mannerOfDeathOptions={selectOptions.mannerOfDeathOptions || []}
                                            requestingAgencyOptions={selectOptions.requestingAgenciesOptions || []}
                                            // Pass other props like phmcGroupedOptions, coronerGroupedOptions, etc.
                                            phmcGroupedOptions={phmcGroupedOptions}
                                            coronerGroupedOptions={coronerGroupedOptions}
                                            setShowEmployeeModal={setShowEmployeeModal}
                                            handleSelectChange={handleSelectChange}
                                            isUploading={isUploading}
                                            handleImageUpload={handleImageUpload}
                                            removeNotification={removeNotification}
                                            patientTitleOptions={selectOptions.patientTitle || []}
                                            patientPhoneOptions={selectOptions.patientPhone || []}
                                            purposeOptions={selectOptions.PurposeMedicalInformationRelease || []}
                                            formatOptions={selectOptions.PurposeMedicalInformationReleaseFormat || []}
                                            medicalRecordOptions={selectOptions.MedicalRecordsRelease || []}
                                            // For Surgical
                                            phmcRank={selectOptions.phmcRank || []}
                                            patientConsent={selectOptions.patientConsent || []}
                                            complications={selectOptions.complications || []}
                                            procedureGood={selectOptions.procedureGood || []}
                                            // For PhysEval
                                            BodyMassIndex={selectOptions.BodyMassIndex || []}
                                            temperature={selectOptions.temperature || []}
                                            heartRate={selectOptions.heartRate || []}
                                            breathing={selectOptions.breathing || []}
                                            bloodPressure={selectOptions.bloodPressure || []}
                                            patientJob={selectOptions.patientJob || []}
                                            patientJobRisks={selectOptions.patientJobRisks || []}
                                            patientAllergiesRisk={selectOptions.patientAllergiesRisk || []}
                                            patientMedicineRegular={selectOptions.patientMedicineRegular || []}
                                            patientOther={selectOptions.patientOther || []}
                                            predisposition={selectOptions.predisposition || []}
                                            // For MentalHealth & ER & GeneralConsult
                                            admission={selectOptions.admission || []}
                                            followup={selectOptions.followup || []}
                                            // For ER & GeneralConsult
                                            painLevel={selectOptions.painLevel || []}
                                            findings={selectOptions.findings || []}
                                            lungs={selectOptions.lungs || []}
                                            pupils={selectOptions.pupils || []}
                                            wounds={selectOptions.wounds || []}
                                            ecg={selectOptions.ecg || []}
                                            sono={selectOptions.sono || []}
                                            lab={selectOptions.lab || []}
                                            bloodOxy={selectOptions.bloodOxy || []}
                                            assignedDepartment={selectOptions.assignedDepartment || []}
                                            departmentLarge={ (currentFormDefinition?.version === 23 && selectedAgencyGroup === "PHMC") ? (selectOptions.paletoClinicDepartment || []) : (selectOptions.departmentLarge || [])}
                                            // For Shrink
                                            Appearance={selectOptions.Appearance || []}
                                            Behavior={selectOptions.Behavior || []}
                                            Speech={selectOptions.Speech || []}
                                            Mood={selectOptions.Mood || []}
                                            Affect={selectOptions.Affect || []}
                                            ThoughtProcess={selectOptions.ThoughtProcess || []}
                                            ThoughtContent={selectOptions.ThoughtContent || []}
                                            Insight={selectOptions.Insight || []}
                                            Cognition={selectOptions.Cognition || []}
                                            Risk={selectOptions.Risk || []}
                                            // For CoronerEmail
                                            fillPhoneChecked={fillPhoneChecked}
                                            setFillPhoneChecked={setFillPhoneChecked}
                                            handleFillCoronerPhone={handleFillCoronerPhone}
                                            addReport={addReport}
                                            removeReport={removeReport}
                                            handleReportChange={handleReportChange}
                                            toggleSavedReports={toggleSavedReports}
                                            // For DeathReport specific
                                            dnr={selectOptions.dnr || []}
                                            attorney={selectOptions.attorney || []}
                                            dnrOrder={selectOptions.dnrOrder || []}
                                            isJohnDoe={isJohnDoe}
                                            isJaneDoe={isJaneDoe}
                                            handleDoeChange={handleDoeChange}
                                            currentUtcTime={currentUtcTime}
                                            UpdateMedicalFile={selectOptions.UpdateMedicalFile || []}
                                            Imaging={selectOptions.Imaging || []}
                                            patientTitleNew={selectOptions.patientTitleNew || []}
                                            XrayResults={selectOptions.XrayResults || []}
                                            ctResults={selectOptions.ctResults || []}
                                            mriResults={selectOptions.mriResults || []}
                                            ultrasoundResults={selectOptions.ultrasoundResults || []}
                                            patientBloodType={selectOptions.patientBloodType || []} 
                                            selectOptions={selectOptions} 
                                            
                                            maritalStatus={selectOptions.maritalStatus || []}
                                            numberChildren={selectOptions.numberChildren || []}
                                            financialStatus={selectOptions.financialStatus || []}
                                            
                                            physicianRecruitmentDetails={physicianRecruitmentDetails} // Renamed prop here too
                                            psychRecruitmentDetails={psychRecruitmentDetails}
                        adminRecruitmentDetails={adminRecruitmentDetails}
                        emsRecruitmentDetails={emsRecruitmentDetails}
                        nurseRecruitmentDetails={nurseRecruitmentDetails}
                        coronerRecruitmentDetails={coronerRecruitmentDetails}
                    showNotification={showNotification}
                    onAttachReportSummaryRequest={onAttachReportSummaryRequest}

                                    />
                                ) : (
                                    <p>Please select an agency group and then a form type.</p>
                                )}
                                </Suspense>
                        <div className="button-group">
                            <Button
                                type="button"
                                onClick={clearForm}
                                className="remove-report-button"
                            >
                                <i className="fas fa-trash-alt"></i>
                                Clear Form
                            </Button>
                        </div>
                    </form>
                </div>
                
                <div className="output-container">
                <div className="floating-admin-button-container">
                <Button
                    type="button"
                    variant="warning"
                    className="changelog-button"
                    onClick={() => setShowEmsBingoModal(true)}
                    title="Open Bingo Night!"
                >
                    <i className="fas fa-trophy"></i>
                    Bingo Night!
                </Button>
                <Button
                    type="button"
                    variant="danger"
                    className="changelog-button"
                    onClick={() => navigate('/admin')}
                    title="Open Admin Control Panel"
                >
                    <i className="fas fa-user-shield"></i>
                    Admin Panel
                </Button>
                
            </div>

<RecruitmentStatusDisplay
    selectedAgencyGroup={selectedAgencyGroup}
    bbCodeVersion={bbCodeVersion}
    physicianRecruitmentDetails={physicianRecruitmentDetails} // Renamed prop here too
    psychRecruitmentDetails={psychRecruitmentDetails}
    adminRecruitmentDetails={selectOptions.adminPositionDetailsData || {}} // Assuming admin data is in selectOptions
    emsRecruitmentDetails={selectOptions.emsPositionDetailsData || {}}     // Assuming EMS data is in selectOptions
    nurseRecruitmentDetails={selectOptions.nursePositionDetailsData || {}} // Assuming Nurse data is in selectOptions
    coronerRecruitmentDetails={selectOptions.coronerPositionDetailsData || {}}
    // Pass other recruitment details objects as props when you add them
/>
            <EmsBingoModal
                show={showEmsBingoModal}
                onHide={handleHideEmsBingoModal}
                phmcGroupedOptions={phmcGroupedOptions}
                coronerGroupedOptions={coronerGroupedOptions}
                currentPhmcEmployee={formData.phmcEmployee}
                showNotification={showNotification}
                setShowEmployeeModal={setShowEmployeeModal}
                isAdmin={formData.isAdminAuthenticated}
                sendBingoWebhook={({ scorer, bingoType, phrase, lineName, marked, commitInfo: ci }) => 
                    sendBingoNotification({ scorer, bingoType, phrase, lineName, marked, commitInfo: ci || commitInfo })
                }
                sendPhraseRequestWebhook={({ requester, phrase, bingoType }) => 
                    sendPhraseRequestNotification({ requester, phrase, bingoType, commitInfo })
                }
            />

<EmployeeModal
    show={showEmployeeModal}
    onHide={() => {
        setShowEmployeeModal(false);
        setIsJohnDoe(false);
        setIsJaneDoe(false);
        setIsRemoveStaff(false);
    }}
    isJohnDoe={isJohnDoe}
    coronerList={coronerListData}
    phmcList={phmcListData}
    isRemoveStaff={isRemoveStaff}
    showNotification={showNotification}
    handleDoeChange={handleDoeChange}
    handleRemoveStaffChange={(selectedOptions) => {
        setStaffToRemove(selectedOptions ? selectedOptions.map(option => option.value) : []);
    }}
    missingEmployeeData={missingEmployeeData}
    handleMissingEmployeeChange={(e) => {
        setMissingEmployeeData({ ...missingEmployeeData, [e.target.name]: e.target.value });
    }}
    phmcGroupedOptions={phmcGroupedOptions}
    coronerGroupedOptions={coronerGroupedOptions}
    employeeOptions={combinedStaffOptions}
    handleMissingEmployeeSubmit={handleMissingEmployeeSubmit}
/>            
                                        
 <div className="bbcode-section">
    {getBBCodeContent()?.length > 30000 && (
        <div className={`char-counter ${getBBCodeContent()?.length > 60000 ? 'char-counter-warning' : ''}`}>
            Character Count: {getBBCodeContent()?.length ?? 'Error'} / 60000
            {getBBCodeContent()?.length > 60000 && (
                <div className="char-counter-warning-message">
                    Warning: PHPBB forums often have a character limit around 60,000. You may need to split this form.
                </div>
            )}
        </div>
    )}

    <div className="modern-output-controls">
        <Button
            type="button"
            onClick={() => setShowBBCode(prev => !prev)}
            className="control-button"
        >
            <i className={`fas ${showBBCode ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            {showBBCode ? 'Hide BBCode' : 'Show BBCode'}
        </Button>
        <Button
            type="button"
            onClick={toggleSavedReports}
            className="control-button"
        >
            <i className="fas fa-save"></i>
            Save Report
        </Button>
    </div>
            <p className="generated-title-label">Generated Title</p>
            <p className="generated-title-string">{generateTitle()}</p>

    {showBBCode && (
        <div className="generated-title-container">
        </div>
    )}
    
    <div className="modern-copy-controls">
        <Button
            type="button"
            onClick={handleCopyTitle}
            className="copy-button-modern"
        >
            <i className="fas fa-copy"></i>
            Copy Title
        </Button>

        <Button
            type="button"
            onClick={handleCopyAndNotifyWrapper}
            className="copy-button-modern"
            disabled={isLockdownActive}
            title={isLockdownActive ? 'BBCode copying is disabled during site lockdown' : ''}
        >
            <i className="fas fa-copy"></i>
            {getCopyButtonText()}
        </Button>

        {/* Agency Image Row: Only show for selected department */}
    </div>
    

    {showBBCode && (
        <pre className="bbcode-output">
            {getBBCodeContent()}
        </pre>
    )}
        {bbCodeVersion === 2 && formData.department && agencyDataStore && agencyDataStore[formData.department] && agencyDataStore[formData.department].logo && agencyDataStore[formData.department].url && (
            <div className="agency-buttons" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '18px 0 0 0', flexWrap: 'wrap' }}>
                <button
                    className="agency-button"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                    onClick={() => window.open(agencyDataStore[formData.department].url, '_blank')}
                    title={agencyDataStore[formData.department].fullName || formData.department}
                >
                    <img
                        src={agencyDataStore[formData.department].logo}
                        alt={agencyDataStore[formData.department].fullName || formData.department}
                        style={{ height: '100px', width: 'auto', borderRadius: '6px', border: '1px solid #30363d', background: '#16202c', padding: '4px', marginBottom: '2px' }}
                    />
                </button>
                <div style={{ color: '#eeeeeeb0', fontWeight: 600, fontSize: '1.1rem', textAlign: 'center', marginTop: '2px' }}>
                    {agencyDataStore[formData.department].fullName || formData.department}
                </div>
            </div>
        )}

    <FormImageLink
        bbCodeVersion={bbCodeVersion}
        selectedAgencyGroup={selectedAgencyGroup}
        deathReportClass={deathReportClass}
        civilianPaperworkClass={civilianPaperworkClass}
        deathReportImage={deathReportImage}
        civilianPaperworkImage={civilianPaperworkImage}
    />
</div>
                    {selectedAgencyGroup === 'PHMC' && (
                        <BusinessCardModal
                            show={showBusinessCard}
                            onHide={() => setShowBusinessCard(false)}
                            showNotification={showNotification}
                            commitInfo={commitInfo}
                            handleImageUpload={handleImageUpload}
                        />
                    )}
            <SwitchableFormsModal
                show={showPHMCModal} // Your state that controls this modal's visibility
                onHide={() => setShowPHMCModal(false)}
                title={switchableModalTitle} // Your state for the modal title
                forms={switchableFormsList} // Your state for the list of forms for this modal
                handleFormSelect={handleAgencySelect} // This now triggers the opt-in logic
                isMobile={isMobile}
                physicianRecruitmentDetails={selectOptions.physicianRecruitmentDetails} // Renamed prop here too
                psychRecruitmentStatus={psychRecruitmentDetails} // For Psych buttons - NEW PROP
                formDefinitions={formDefinitions} // Pass all form definitions
                    adminRecruitmentDetails={selectOptions.adminPositionDetailsData || {}} // Assuming admin data is in selectOptions
                nurseRecruitmentDetails={selectOptions.nursePositionDetailsData || {}}
                coronerRecruitmentDetails={selectOptions.coronerPositionDetailsData || {}}
                emsRecruitmentDetails={selectOptions.emsPositionDetailsData || {}}
                userPreferences={userOnboardingPreferences}
            />

            <SavedReportsModal
                show={showSavedReports}
                onHide={() => setShowSavedReports(false)}
                onClose={() => setShowSavedReports(false)}
                savedReports={savedReports}
                reportsForSelectedUser={savedReports}
                loadReport={loadReportForUser}
                deleteReport={deleteReportForUser}
                author={getCurrentReportAuthor(formData)}
                isLoading={isLoadingUserReports}
                onAttachReportSelectedForAttachment={handleReportSelectedForAttachment}
                reportSelectionFilter={reportSelectionFilter}
                versionNames={versionNames}
                onEmployeeSelect={(employeeValue) => {
                    // Handle employee selection
                    if (employeeValue) {
                        loadUserSavedReports(employeeValue);
                    }
                }}
                employeeOptions={[
                    {
                        label: 'PHMC Staff',
                        options: phmcListData.map(p => ({
                            value: p.name,
                            label: `${p.name} (${p.category || 'PHMC'})`
                        })).sort((a, b) => a.label.localeCompare(b.label))
                    },
                    {
                        label: 'Coroners',
                        options: coronerListData.map(c => ({
                            value: c.name,
                            label: `${c.name} (${c.rank || 'Coroner'})`
                        })).sort((a, b) => a.label.localeCompare(b.label))
                    }
                ]}
                currentPhmcEmployee={formData.phmcEmployee}
                currentCoronerEmployee={formData.coronerEmployee}
                showNotification={showNotification}
                removeNotification={removeNotification}
                bbCodeVersion={bbCodeVersion}
                handleReportSelectedForAttachment={handleReportSelectedForAttachment}
            />

            


                </div>
            </div>
            <Footer />
            </div>
        </Suspense>
        
    );
}

function MainAppWrapper() {
    const [formData, setFormData] = useState(() => {
        const savedFormData = localStorage.getItem('formData');
        return savedFormData ? JSON.parse(savedFormData) : {};
    });
    const [lastWebhookIdentifier, setLastWebhookIdentifier] = useState(null);

    const { showNotification, removeNotification, NotificationContainer } = useNotification();

    // Save form data to localStorage whenever it changes
    useEffect(() => {
        if (Object.keys(formData).length > 0) {
            localStorage.setItem('formData', JSON.stringify(formData));
        }
    }, [formData]);

const initialFormData = {
    // Core user state to preserve
    phmcEmployee: '',
    coronerEmployee: '',
    coronerBadge: '',
    coronerRank: 'Forensic Attendant',
    coronerDiscord: '',
    coronerPHNumber: '50056',
    lastName: '',
    phmcRank: '',
    // Common form fields
    department: '',
    dateTime: '',
    date: '',
    decedentName: '',
    decedentOOC: '',
    synopsis: '',
    scenePhotos: '',
    additionalImages: '',
    patientID: '',
    patientName: '',
    patientAddress: '',
    massFatality: false,
    patientRace: '',
    patientGender: '',
    patientPH: '',
    patientDiscord: '',
    patientEmergencyContact: '',
    patientEmergencyContactNumber: '',
    patientEmergencyContactRelation: '',
    decedents: [],
    patientEmergencyContactDiscord: '',
    patientTitle: '',
    patientTitleOptions: '',
    patientAllergies: '',
    patientCurrentMedicine: '',
    patientChronicDiseases: '',
    patientNotes: '',
    patientDateOfBirth: '',
    patientBloodType: '',
    patientChiefComplaint: '',
    patientProcedure: '',
    patientDiagnosis: '',
    patientSecondaryDiagnosis: '',
    patientMedicine: '',
    admission: '',
    followup: '',
    SubmitDate: new Date().toISOString().split('T')[0],
    patientExercise: '',
    // Form-specific fields
    placeOfDeath: '',
    evidenceLockerID: '',
    evidenceLocker: '',
    pronouncedTimeOfDeath: '',
    mannerOfDeath: '',
    typeOfDeath: '',
    showRequestingOfficerInput: false,
    requestingOfficer: '',
    deathReport: '',
    additionalReports: [],
    autopsyDate: '',
    autopsyTime: '',
    autopsyDeathCauses: [''],
    autopsyAnatomicSummaryItems: [''],
    autopsyAlbumUrl: '',
    autopsyPhotosUnavailable: false,
    autopsyDiagramMarkers: [],
    autopsyDiagramImgurUrl: '',
    externalExamination: '',
    RadiologyResult: '',
    deathType: '',
    causeOfDeath: '',
    extraStaff: [],
    patientSummaryConsultation: '',
    patientSummary: '',
    surgeryProcedures: '',
    patientConsentOption: '',
    patientComplicationOptions: '',
    procedureGoodOptions: '',
    patientHeight: '',
    patientWeight: '',
    BodyMassIndex: '',
    temperature: '',
    heartRate: '',
    breathing: '',
    bloodPressure: '',
    patientJob: '',
    patientJobRisks: '',
    patientAllergiesRisk: '',
    patientMedicineRegular: '',
    patientOther: '',
    predisposition: '',
    patientCareer: '',
    patientImpairments: '',
    patientTriggers: '',
    patientFamily: '',
    patientFam: '',
    patientMedicalRecord: '',
    patientVisitReason: '',
    patientSymptoms: '',
    patientDrugs: '',
    patientDrugsUsage: '',
    patientMental: '',
    patientFamSocial: '',
    patientLegal: '',
    patientRelationship: '',
    patientFindings: '',
    patientTreatmentPlan: '',
    patientSafety: '',
    patientFollowUp: '',
    patientTreatmentMedicine: '',
    patientTherapy: '',
    patientRiskAssessment: '',
    Speech: '',
    Behavior: '',
    Appearance: '',
    Mood: '',
    Affect: '',
    Risk: '',
    ThoughtProcess: '',
    ThoughtContent: '',
    Insight: '',
    Cognition: '',
    painLevel: '',
    findings: '',
    lungs: '',
    pupils: '',
    wounds: '',
    ecg: '',
    sono: '',
    lab: [],
    bloodOxy: '',
    assignedDepartment: '',
    departmentLarge: '',
    paletoClinicDepartment: '',
    MedicalRecordsRelease: [],
    payNow: false,
    paymentProofPhotos: '',
    PurposeMedicalInformationReleaseFormat: '',
    CarePurposeMedicalInformationRelease: '',
    patientMedInfoReleaseOther: '',
    MedicalRecordsReleaseOther: '',
    patientMedInfoFormatOther: '',
    StupidDateFrom: '',
    StupidDateTo: '',
    patientFirstName: '',
    patientMiddleName: '',
    patientLastName: '',
    patientEmail: '',
    patientPhoneType: '',
    patientZIP: '',
    dnr: '',
    dnrOrder: '',
    attorney: '',
    dnrOther: '',
    attorneyName: '',
    attorneyRelation: '',
    attorneyPH: '',
    maritalStatus: '',
    numberChildren: '',
    financialStatus: '',
    patientSupport: '',
    patientHarm: '',
    patientGenetic: '',
    patientReligion: '',
    patientSmoker: '',
    patientAlcohol: '',
    patientDiet: '',
    patientSleep: '',
    patientSexLife: '',
    patientHazards: '',
    prescriptionImage: '',
    attachedReportSummary: '',
    emailPurpose: '',
    emailRecipient: '',
    dateOfVisit: '',
    sicknessStartDate: '',
    sicknessEndDate: '',
    reasonForSickness: '',
    illnessCondition: '',
    confirmationPurpose: '',
    phmcEmployeeSignatureImage: '',

    // Recruitment Fields
    recruitmentPosition: '',
    applicantContactDetails: '',
    locationPHMC: false,
    locationPBC: false,
    applicantMedicalConditions: '',
    citizenUS: false,
    citizenPermanent: false,
    citizenNone: false,
    eduHighSchool: false,
    eduCertificate: false,
    eduDiploma: false,
    eduAssociate: false,
    eduBachelor: false,
    eduMaster: false,
    eduDoctorate: false,
    applicantSchoolName: '',
    applicantEnrollmentTerm: '',
    applicantMajor: '',
    applicantLanguages: '',
    applicantPrevEmployment: '',
    applicantPrevDuties: '',
    applicantPrevDismissalReason: '',
    applicantMotivationLetter: '',
    exemptCheckbox: false,
    oocMedicalExperience: '',
    oocAdminRecordLink: '',
    oocStatsLink: '',
        applicantTitleAndFullName: '',
        genderMale: '',
        genderFemale: '',
        genderOther: '',
        applicantGenderOtherText: '',
        applicantDOBAndPlace: '',
        applicantAddress: '',
        emsLicenseLink: '',
        emsPartTimeReason: '',
        oocUcpName: '',
        oocForumName: '',
        oocDiscord: '',
        oocTimezone: '',
        charBackground: '',
        oocOtherCharLicenseProof: '',
        dfpSanFireLink: '',
        dfpPhmcLink: '',
        dfpLegalFactionLink: '',

    // Imaging Fields
    Imaging: [],
    XrayResults: [],
    ctResults: [],
    mriResults: [],
    ultrasoundResults: [],
        patientTitleNew: '',
    patientNameNew: '',
    patientDateOfBirthNew: '',
    patientAddressNew: '',
    patientPHNew: '',
    patientDiscordNew: '',
    patientGenderNew: '',
    patientRaceNew: '',
    // Death Report Type Fields
    deathRecordType: '',


};

    return (
        <MainApp
            formData={formData}
            setFormData={setFormData}
            lastWebhookIdentifier={lastWebhookIdentifier}
            setLastWebhookIdentifier={setLastWebhookIdentifier}
            initialFormData={initialFormData}
            showNotification={showNotification}
            removeNotification={removeNotification}
        />
    );
}


export default MainAppWrapper;
