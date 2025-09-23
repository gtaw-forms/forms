import { useReportManagement } from './components/useReportManagement';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo, useCallback} from 'react';
import { formDefinitions, getFormDefinition } from './formDefinitions'; 
import '@fortawesome/fontawesome-free/css/all.min.css';
import { Button, Dropdown } from 'react-bootstrap';
import SavedReportsModal from './components/SavedReportsModal'; 
import getRelevantFields from './components/RevelantFields';
import AgencyGroupSelectorModal from './components/AgencyGroupSelectorModal'; 
import AgencySelector from './components/AgencySelector';
import Footer from './components/Footer';
import SeasonalEvents from './components/SeasonalEvents';
import HeaderInfo from './components/HeaderInfo';
import 'bootstrap/dist/css/bootstrap.min.css';
import * as Sentry from "@sentry/react";
import { analytics } from './firebase';
import { logEvent } from 'firebase/analytics';
import CoronerTipsModal from './components/CoronerTipsModal'; 
import BusinessCardModal from './components/BusinessCardModal'; 
import EasterEggModal from './components/EasterEggModal'; 
import SwitchableFormsModal from './components/SwitchableFormsModal'; 
import EmployeeModal from './components/EmployeeModal';
import RecruitmentStatusDisplay from './components/RecruitmentStatusDisplay'; 
import CctvRequestWebhookModal from './components/Admin/CctvRequestWebhookModal'; 
import { sendBingoNotification, sendPhraseRequestNotification } from './components/notificationService';
import { useNotification } from './contexts/NotificationContext';
import FeatureRequestModal from './contexts/FeatureRequestModal';
import SwitchableFormButtons from './components/SwitchableFormButtons';
import PrivacyPolicyModal from './components/PrivacyPolicyModal';
import { handleFormCopyAndNotify, handlePhmcRecruitmentCopyAndNotify } from './components/notificationService';

import EmsBingoModal from './components/EmsBingoModal'; 

// logos
import email from './assets/email.png'
import Civilian from './assets/Civilian.png'
import nurse from './assets/nurse.png'
import PHMCLogo from './assets/phmc.png'
import corpse from './assets/corpse.png'
import phmcpaletobay from './assets/phmcpaletobaylogo.png'
import './assets/fonts/Poppins-Medium.ttf';
import { sendMissingEmployeeNotification } from './components/notificationService';

// css fun
import './App.css';
import './buttons.css';

import 'react-bootstrap-typeahead/css/Typeahead.css';

// database
import { database } from './firebase'; // Your Firebase config
import { ref, get} from 'firebase/database'; // Added set

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
    const [showPrivacyPolicyModal, setShowPrivacyPolicyModal] = useState(false);
    const [testSeason, setTestSeason] = useState(null);

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
    const [isMobile, setIsMobile] = useState(false);
    const [showMovedNotification, setShowMovedNotification] = useState(true);
    const [showToolsDropdown, setShowToolsDropdown] = useState(false);
    const modalCloseTimer = useRef(null);
    
    const [showEmsBingoModal, setShowEmsBingoModal] = useState(false);
    const [showGtaCallback, setShowGtaCallback] = useState(false);
    const [showEasterEggModal, setShowEasterEggModal] = useState(false);
    const [easterEggType, setEasterEggType] = useState(null); // 'normal', 'rare', or null
    const [showAgencySelector, setShowAgencySelector] = useState(false);
    const [hideAgencySelector, setHideAgencySelector] = useState(false);
    const [showEmployeeModal, setShowEmployeeModal] = useState(false);
    const [showEmsAmaModal, setShowEmsAmaModal] = useState(false);
    const [showBusinessCard, setShowBusinessCard] = useState(false);
    const [fillPhoneChecked, setFillPhoneChecked] = useState(false);
    const [showBBCode, setShowBBCode] = useState(false);
    const [bbCodeVersion, setBbCodeVersion] = useState(() => {
        const storedVersion = localStorage.getItem('bbCodeVersion');
        return storedVersion ? parseInt(storedVersion, 10) : (formDefinitions[0]?.version || 1);
    });
    const [phmcListData, setPhmcListData] = useState([]);
    const [coronerListData, setCoronerListData] = useState([]);
    const [agencyDataStore, setAgencyDataStore] = useState({});
    const [selectOptions, setSelectOptions] = useState({});
    const [selectedAgencyGroup, setSelectedAgencyGroup] = useState(null);
    const [showCoronerTips, setShowCoronerTips] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [showAgencyGroupSelectorModal, setShowAgencyGroupSelectorModal] = useState(false);
    const [hideAgencyGroupSelectorPreference, setHideAgencyGroupSelectorPreference] = useState(false);
    const [physicianRecruitmentDetails, setPhysicianRecruitmentDetails] = useState({});
    const [psychRecruitmentDetails, setPsychRecruitmentDetails] = useState({});
    const [adminRecruitmentDetails, setAdminRecruitmentDetails] = useState({});
    const [emsRecruitmentDetails, setEmsRecruitmentDetails] = useState({});
    const [nurseRecruitmentDetails, setNurseRecruitmentDetails] = useState({});
    const [coronerRecruitmentDetails, setCoronerRecruitmentDetails] = useState({});
    const [loading, setLoading] = useState(true);
    const [showCctvRequestModal, setShowCctvRequestModal] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isJohnDoe, setIsJohnDoe] = useState(false);
    const [isJaneDoe, setIsJaneDoe] = useState(false);
    const [commitInfo, setCommitInfo] = useState({ sha: '', date: null, error: null });
    const [isLoadingUserReports, setIsLoadingUserReports] = useState(false);
    
    const [showPHMCModal, setShowPHMCModal] = useState(false);
    const [switchableModalTitle, setSwitchableModalTitle] = useState('');
    const [switchableFormsList, setSwitchableFormsList] = useState([]);
    const [showFeatureRequestModal, setShowFeatureRequestModal] = useState(false);
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
    const [showWebhookModal, setShowWebhookModal] = useState(false);
    const [webhookMessage, setWebhookMessage] = useState('');
    const [webhookTitle, setWebhookTitle] = useState('');
    const [isBbcodeRequest, setIsBbcodeRequest] = useState(false);
    const [bbcodeTitleRequest, setBbcodeTitleRequest] = useState('');
    const [bbcodeRequestText, setBbcodeRequestText] = useState('');
    const [currentUtcTime, setCurrentUtcTime] = useState('');
    const [phmcRecruitmentOptIn, setPhmcRecruitmentOptIn] = useState(() => {
        return localStorage.getItem('phmcRecruitmentOptIn') === 'true';
    });

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

    const handleCctvWebhookSubmit = async (cctvData) => {
        // Log the submission attempt to Sentry for tracking and abuse monitoring
        Sentry.captureMessage('CCTV Request Submitted', {
            level: 'info',
            extra: {
                officer: cctvData.officer,
                department: cctvData.department,
                location: cctvData.location,
                reason: cctvData.requestReason,
                submitter: formData.coronerEmployee || formData.phmcEmployee || 'Unknown App User'
            },
            tags: {
                webhook_type: 'cctv_request',
                environment: process.env.NODE_ENV
            }
        });
        // Log the submission for firebase for tracking and abuse monitoring
        logEvent(analytics, 'cctv_request', {
            officer: cctvData.officer,
            department: cctvData.department,
            location: cctvData.location,
            reason: cctvData.requestReason,
            submitter: formData.coronerEmployee || formData.phmcEmployee || 'Unknown App User',
            environment: process.env.NODE_ENV
        });

        // --- MODIFICATION START: Send to multiple webhooks ---
        const devWebhookURL = process.env.REACT_APP_DEV_WEBHOOK;
        const leoWebhookURL = process.env.REACT_APP_LEO_WEBHOOK_URL;

        if (!devWebhookURL) {
            showNotification('No CCTV webhook URLs are configured.', 'error');
            Sentry.captureMessage('Neither DEV nor LEO webhook URLs are configured for CCTV.', 'error');
            return false;
        }

        const embed = {
            title: "📹 CCTV Footage Request",
            color: 0x007bff, // Blue for LEO
            fields: [
                { name: "Requesting Officer Rank", value: cctvData.rank || "N/A", inline: true },
                { name: "Requesting Officer", value: cctvData.officer || "N/A", inline: true },
                { name: "Officer Phone Number", value: cctvData.officerPH || "N/A", inline: true },
                { name: "Requesting Department", value: cctvData.department || "N/A", inline: true },
                ...(cctvData.discordUsername ? [{ name: "Discord Username", value: cctvData.discordUsername, inline: true }] : []),
                { name: "Date/Time of Incident", value: cctvData.incidentDateTime || "N/A", inline: true },
                { name: "Reason for Request", value: cctvData.requestReason || "N/A", inline: false },
                { name: "CCTV Location", value: cctvData.location || "N/A", inline: false },
                { name: "Description of Events", value: ```${cctvData.description || "N/A"}```, inline: false },
                ...(cctvData.oocNotes ? [{ name: "OOC Notes", value: ```${cctvData.oocNotes}```, inline: false }] : []),
            ],
            timestamp: new Date().toISOString(),
            footer: { text: `PHMC Tools - v${commitInfo.sha || 'N/A'}` }
        };

        const payload = JSON.stringify({
            username: "CCTV Bot",
            content: "New CCTV Request! Supervisor Alert: <@&860257102324301864> | Leadership Alert: <@&860257063182925874>",
            embeds: [embed]
        });
        const webhookTargets = [];
        if (devWebhookURL) webhookTargets.push({ name: 'Dev', url: devWebhookURL });
        if (leoWebhookURL) webhookTargets.push({ name: 'LEO', url: leoWebhookURL });

        const sendPromises = webhookTargets.map(target =>
            fetch(target.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload
            }).then(async response => {
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Request to ${target.name} failed with status ${response.status}: ${errorText}`);
                }
                return { name: target.name, status: 'fulfilled' };
            })
        );

        const results = await Promise.allSettled(sendPromises);
        let successfulSends = 0;

        results.forEach((result, index) => {
            const targetName = webhookTargets[index].name;
            if (result.status === 'fulfilled') {
                console.log(`Successfully sent CCTV webhook to ${targetName}.`);
                successfulSends++;
            } else {
                console.error(`Failed to send CCTV webhook to ${targetName}:`, result.reason.message);
                Sentry.captureMessage(`CCTV Webhook to ${targetName} failed`, {
                    level: 'error',
                    extra: { reason: result.reason.message }
                });
            }
        });

        if (successfulSends === webhookTargets.length) {
            showNotification('CCTV Request sent successfully!', "check-circle");
            handleHideCctvRequestModal();
            return true;
        } else if (successfulSends > 0) {
            showNotification('CCTV Request sent, but some destinations failed.', "warning");
            handleHideCctvRequestModal();
            return true;
        } else {
            showNotification('Failed to send CCTV request to any destination.', "error");
            return false;
        }
        // --- MODIFICATION END ---
    };
    const handleRefresh = () => {
        window.location.reload();
    };

    const toggleEmsAmaModal = () => {
        setShowEmsAmaModal(prev => !prev);
    };

    const toggleBusinessCard = () => {
        setShowBusinessCard(prev => !prev);
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
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSelectChange = (selectedOption, action) => {
        const name = typeof action === 'string' ? action : action.name;

        if (name === 'coronerEmployee' && selectedOption) {
            setFormData(prev => ({
                ...prev,
                coronerEmployee: selectedOption.value,
                coronerBadge: selectedOption.badge,
                coronerRank: selectedOption.rank,
                coronerDiscord: selectedOption.discord,
            }));
        } else if (name === 'coronerEmployee' && !selectedOption) {
            setFormData(prev => ({
                ...prev,
                coronerEmployee: '',
                coronerBadge: '',
                coronerRank: '',
                coronerDiscord: '',
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: selectedOption ? selectedOption.value : ''
            }));
        }
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
useEffect(() => {
  if (showToolsDropdown) {
    // Hack: Force reposition after a tick
    setTimeout(() => {
      // If you have a ref to the dropdown, call instance.update()
    }, 0);
  }
}, [showToolsDropdown]);
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


    const generateTitle = () => {
        // Mass Fatality form (bbCodeVersion 11) special handling
        if (bbCodeVersion === 11) {
            const decedents = formData.decedents || [];
            const numDecedents = decedents.length;
            const firstDecedentName = numDecedents > 0 ? (decedents[0].decedentName || 'Unidentified') : 'No Decedents';

            let formattedDate = '';
            if (formData.dateTime) {
                const dateObj = new Date(formData.dateTime);
                // Ensure dateObj is valid before formatting
                if (!isNaN(dateObj.getTime())) {
                    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                    const day = dateObj.getDate().toString().padStart(2, '0');
                    const year = dateObj.getFullYear();
                    formattedDate = `${month}/${day}/${year}`;
                }
            }
            
            return `[Mass Fatality] ${firstDecedentName} (x${numDecedents}) - ${formattedDate}`;
        }

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
            };
            return definition.generator(generatorArgs);
        }
    } else {
        Sentry.captureMessage(`No BBCode generator found for version: ${bbCodeVersion}`);
        const formName = (getFormDefinition(bbCodeVersion) || {}).name || `Form v${bbCodeVersion}`;
        return `BBCode generation for form \"${formName}\" is not implemented.`;
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
    
    const sendEasterEggNotification = async (type = 'normal') => { // Default to 'normal'
        const webhookUrl = process.env.REACT_APP_DEV_WEBHOOK;
        if (!webhookUrl) {
            console.error("Discord webhook URL is not configured.");
            return; // Don't proceed if the URL isn't set
        }

        // Try to get user identifier
        const userIdentifier = formData.coronerEmployee || formData.phmcEmployee || formData.patientName || formData.decedentName || 'Someone';

        // --- Customize embed based on type ---
        let embedTitle = "🎉 Easter Egg Found! 🎉";
        let embedDescription = `Hey! **${userIdentifier}** just found the normal easter egg! 🥚`;
        let embedColor = 0x7289DA; // Discord Blurple for normal
        let triggerSource = "Triggered during report save";

        if (type === 'rare') {
            embedTitle = "✨ Rare Easter Egg Found! ✨";
            embedDescription = `Wow! **${userIdentifier}** just triggered the 1% rare easter egg! 🥚🎉`;
            embedColor = 0xFFD700; // Gold color for rare
        }

        // Check if triggered manually (only for rare currently, but could be expanded)
        const isManualTrigger = window.location.hostname === 'localhost' && type === 'rare'; // Check if manual trigger conditions are met
        if (isManualTrigger) {
            embedTitle += " (Manual Trigger)";
            embedDescription = `Debug: **${userIdentifier}** just triggered the rare easter egg manually! 🥚🎉`;
            triggerSource = "Triggered via Debug Button";
        }
        // --- End Customization ---

        const embed = {
            title: embedTitle,
            description: embedDescription,
            color: embedColor,
            timestamp: new Date().toISOString(),
            footer: {
                text: `PHMC Tools Tool | ${triggerSource}` // Use dynamic trigger source
            }
        };

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ embeds: [embed] }),
            });

            if (!response.ok) {
                console.error(`Error sending ${type} easter egg webhook: ${response.status} ${response.statusText}`);
            } else {
                console.log(`${type} easter egg notification sent successfully.`);
            }
        } catch (error) {
            console.error(`Failed to send ${type} easter egg webhook:`, error);
            Sentry.captureException(error, { extra: { context: `sendEasterEggNotification (${type})` } });
        }
    };

    const getCurrentReportAuthor = useCallback((formData) => {
        // Define which bbCodeVersions are primarily Coroner forms
        const coronerFormVersions = [1, 2, 4, 8, 11, 18];
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

    const handleAdminPanelClick = () => {
        const adminFormGroup = "Admin";
        setSelectedAgencyGroup(adminFormGroup);
        localStorage.setItem('selectedAgencyGroup', adminFormGroup);

        const adminFormVersion = 999;
        setBbCodeVersion(adminFormVersion);

        setFormData(prevFormData => ({
            ...prevFormData,
            coronerEmployee: prevFormData.coronerEmployee,
            phmcEmployee: prevFormData.phmcEmployee,
            coronerBadge: prevFormData.coronerBadge,
            coronerRank: prevFormData.coronerRank,
            coronerDiscord: prevFormData.coronerDiscord,
            SubmitDate: new Date().toISOString().split('T')[0],
            // Updated fields for Admin Panel
            isAdminAuthenticated: false, // Will be set by AdminAuthAndActions
            adminUserEmail: null,      // Will be set by AdminAuthAndActions
            adminDisplayData: null,    // Will hold data for the selected recruitment category
            adminSelectedCategoryName: null, // Will hold the display name of the selected category
        }));

        setShowAgencySelector(false);
        setShowPHMCModal(false);
        setLastWebhookIdentifier(null);
        showNotification(`Switched to Admin Control Panel`, 'info-circle');
    };
    const versionsWithTitleSection = useMemo(() =>
        formDefinitions
            .filter(def => def.hasCustomTitle)
            .map(def => def.version),
    []); // Empty dependency array means this runs only once. 



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

const loadData = useCallback(async () => {
    let loadingNotificationId; // Declare a variable to store the notification ID
    try {
        loadingNotificationId = showNotification("Data Loading...", 'spinner fa-spin', 0); // Store the ID

        // Load formData from localStorage FIRST
        let initialLoadFormData = {};
        const fieldsToLoadFromLS = [
            'phmcEmployee', 'phmcEmployeeLastName', 'phmcRank',
            'coronerEmployee', 'coronerBadge', 'coronerRank', 'coronerDiscord', 'coronerPHNumber',
            'pronouncedTimeOfDeath', 'department', 'dateTime', 'placeOfDeath', 'mannerOfDeath',
        ];

        fieldsToLoadFromLS.forEach(field => {
            const value = localStorage.getItem(field);
            if (value !== null) {
                initialLoadFormData[field] = value;
            }
        });

        // Initialize state with localStorage values
        setFormData(prevFormData => ({
            ...prevFormData,
            ...initialLoadFormData,
        }));

        const dbRootRef = ref(database);
        const snapshot = await get(dbRootRef);

        if (snapshot.exists()) {
            const allData = snapshot.val();
            let fetchedSelectOptions = allData.selectOptions || {};

            setPhmcListData(allData.staff?.phmc || []);
            setCoronerListData(allData.staff?.coroner || []);
            setAgencyDataStore(allData.agencies || {});
            setSelectOptions(allData.selectOptions || {});

            setSelectOptions(fetchedSelectOptions);
            setPhysicianRecruitmentDetails(fetchedSelectOptions.physicianRecruitmentDetails || {});
            setPsychRecruitmentDetails(fetchedSelectOptions.psychPositionDetailsData || {});
            setAdminRecruitmentDetails(fetchedSelectOptions.adminPositionDetailsData || {});
            setEmsRecruitmentDetails(fetchedSelectOptions.emsPositionDetailsData || {});
            setNurseRecruitmentDetails(fetchedSelectOptions.nursePositionDetailsData || {});
            setCoronerRecruitmentDetails(fetchedSelectOptions.coronerPositionDetailsData || {});

            // Merge Firebase data on top of localStorage data
            setFormData(prevFormData => ({
                ...prevFormData,
                phmcEmployee: prevFormData.phmcEmployee, // load all details
                coronerEmployee: prevFormData.coronerEmployee, // Ensure coroner data is re set by load
            }));

            showNotification("Data Loaded!", 'check-circle', 2000);
        } else {
            showNotification('Initial application data not found on server.', 'error');
        }
    } catch (error) {
        showNotification("An error has happened, contact the maintainer", 'error');
        console.error("Error fetching data from Realtime Database:", error);
    } finally {
        setIsLoadingData(false);
        setLoading(false);
        if (loadingNotificationId) {
            removeNotification(loadingNotificationId); // Remove the notification
        }
    }
}, [
    showNotification, removeNotification, setFormData, setPhmcListData, setCoronerListData,
    setAgencyDataStore, setSelectOptions, setPhysicianRecruitmentDetails,
    setPsychRecruitmentDetails, setAdminRecruitmentDetails,
    setEmsRecruitmentDetails, setNurseRecruitmentDetails, setCoronerRecruitmentDetails,
    setIsLoadingData, setLoading
]);

useEffect(() => {
    loadData();
}, [loadData]);


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



    const { imageSource: deathReportImage, className: deathReportClass, season, effect } = SeasonalEvents({ imageType: 'deathReport', season: testSeason });
    const { imageSource: civilianPaperworkImage, className: civilianPaperworkClass } = SeasonalEvents({ imageType: 'civilianPaperwork', season: testSeason });

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




    useEffect(() => {
        const GITHUB_COMMIT_CACHE_KEY = 'githubCommitInfo';
        const GITHUB_COMMIT_CACHE_EXPIRATION_MS = 15 * 60 * 1000; // Cache for 15 minutes

        const fetchCommit = () => {
            // 1. Try to load from cache first
            try {
                const cachedCommitDataString = localStorage.getItem(GITHUB_COMMIT_CACHE_KEY);
                if (cachedCommitDataString) {
                    const cachedData = JSON.parse(cachedCommitDataString);
                    const isCacheFresh = (Date.now() - cachedData.timestamp) < GITHUB_COMMIT_CACHE_EXPIRATION_MS;
                    if (isCacheFresh) {
                        setCommitInfo(cachedData.info);
                        return; // Exit if fresh data is found in cache
                    }
                }
            } catch (e) {
                console.error("Error reading commit info from cache:", e);
            }

            // 2. If cache is stale or doesn't exist, fetch from API
            fetch('https://api.github.com/repos/GTAW-PHMC/forms/commits/gh-pages')
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`GitHub API responded with status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    const commitDate = new Date(data.commit.author.date);
                    const newCommitInfo = {
                        sha: data.sha.substring(0, 7),
                        date: commitDate.toLocaleString('en-US', {
                            year: 'numeric', month: 'long', day: 'numeric',
                            hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
                        }),
                        error: null // Clear any previous error on success
                    };
                    setCommitInfo(newCommitInfo);

                    // 3. Cache the new data
                    try {
                        localStorage.setItem(GITHUB_COMMIT_CACHE_KEY, JSON.stringify({
                            timestamp: Date.now(),
                            info: newCommitInfo
                        }));
                    } catch (e) {
                        console.error("Error writing commit info to cache:", e);
                    }
                })
                .catch(error => {
                    console.error('Error fetching commit:', error);
                    // 4. On failure, set an error message but keep old data if it exists
                    setCommitInfo(prev => ({
                        ...prev,
                        error: 'Could not fetch latest update information.'
                    }));
                });
        };

        fetchCommit();
    }, []); // This effect runs once on mount
    const coronerFormsSubGroup = [
        { version: 1, name: "Decedent Services", icon: corpse },
        { version: 2, name: "Email Generator", icon: email },
        { version: 4, name: "Autopsy Report", icon: corpse },
        { version: 8, name: "Death Certificate", icon: PHMCLogo },
        { version: 11, name: "Mass Fatality Report", icon: corpse },
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

// ---
    const handleImageUpload = async (event, fieldName) => {
        const files = event.target.files;
        if (!files.length) return;
    
        setIsUploading(true);
        const uploadedUrls = [];
    
        try {
            // Access Imgur API credentials from environment variables
            const imgurAccessToken = process.env.REACT_APP_IMGUR_ACCESS_TOKEN;
            const imgurAlbumId = process.env.REACT_APP_IMGUR_ALBUM_ID // Album ID
    
            // Function to upload a single file with a delay
            const uploadFileWithDelay = async (file, delay) => {
                await new Promise(resolve => setTimeout(resolve, delay)); // Introduce delay
                const formData = new FormData();
                formData.append('image', file);
                formData.append('album', imgurAlbumId); // Add album ID
    
                const response = await fetch('https://api.imgur.com/3/image', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${imgurAccessToken}`,
                    },
                    body: formData,
                });
    
                const data = await response.json();
                return data;
            };
    
            const delayBetweenUploads = 1000; // 1 second delay
    
            for (let file of files) {
                const data = await uploadFileWithDelay(file, delayBetweenUploads);
    
                if (data.success) {
                    uploadedUrls.push(data.data.link);
                } else {
                    console.error('Imgur upload failed:', data.data.error);
                    showNotification(`Imgur upload failed: ${data.data.error}`, 'exclamation-circle');
                }
            }
    
            if (uploadedUrls.length > 0) {
                const newUrlString = uploadedUrls.join(', ');

                if (fieldName.includes('-')) {
                    const [key, indexStr] = fieldName.split('-');
                    const index = parseInt(indexStr, 10);

                    setFormData(prev => {
                        const newDecedents = [...prev.decedents];
                        const currentDecedent = newDecedents[index];
                        const currentValue = currentDecedent[key] || '';
                        const newValue = currentValue ? `${currentValue}, ${newUrlString}` : newUrlString;
                        newDecedents[index] = { ...currentDecedent, [key]: newValue };

                        return { ...prev, decedents: newDecedents };
                    });

                } else {
                    const currentValue = formData[fieldName] || '';
                    const newValue = currentValue ? `${currentValue}, ${newUrlString}` : newUrlString;
        
                    setFormData(prev => ({
                        ...prev,
                        [fieldName]: newValue
                    }));
                }
                showNotification(`${uploadedUrls.length} image(s) uploaded successfully!`, 'check-circle');
            }
        } catch (error) {
            console.error('Upload failed:', error);
            showNotification('Upload failed!', 'exclamation-circle');
        } finally {
            setIsUploading(false);
        }
    };


    //Coroner Tips Handling

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
    await loadData(); // Call the main data loading function to refresh data

    if (actionType === 'updateRank') {
        showNotification("Staff data refreshed.", 'check-circle', 3000);
    }
};

const sendWebhookPayload = async (webhookURL, payload, successMessage, context, notifyFunc) => {
    if (!webhookURL) {
        console.error(`Discord webhook URL not configured for ${context}.`);
        Sentry.captureMessage(`Discord webhook URL is missing for ${context} submission.`, 'error');
        notifyFunc('Configuration error: Unable to send message.', 'exclamation-triangle'); // Use passed notifyFunc
        return false;
    }

    try {
        const response = await fetch(webhookURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to send ${context} webhook embed. Status: ${response.status} ${response.statusText}`, errorText);
            Sentry.captureMessage(`Discord webhook embed failed for ${context}: ${response.status}`, {
                level: 'error',
                extra: { statusText: response.statusText, responseBody: errorText }
            });
            notifyFunc(`Failed to send embed to ${context}. Status: ${response.status}`, 'exclamation-triangle'); // Use passed notifyFunc
            return false;
        } else {
            notifyFunc(successMessage, 'check-circle'); // Use passed notifyFunc
            setShowWebhookModal(false);
            setWebhookMessage('');
            setWebhookTitle('');
            // No need to clear imageUrl here, modal handles its own state
            return true;
        }
    } catch (error) {
        console.error(`Error sending ${context} webhook embed:`, error);
        Sentry.captureException(error, { extra: { context: `${context} Webhook Embed Submission Fetch` } });
        notifyFunc(`A network error occurred sending to ${context}. Please try again.`, 'exclamation-triangle'); // Use passed notifyFunc
        return false;
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
        } else if (currentPath.endsWith('/forms/auth/gta/callback')) {
            setShowGtaCallback(true);
        }

        if (redirectedPath) {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('p');
            window.history.replaceState({}, document.title, newUrl.href);
        }
    }, []); // This effect runs once on initial load



const handlePhmcWebhookSubmit = async (payload) => { // Receive payload from modal
    if (!payload) return; // Should not happen if modal validates, but good check
    const webhookURL = process.env.REACT_APP_PHMC_DISCORD;
    // Pass showNotification directly to sendWebhookPayload
    await sendWebhookPayload(webhookURL, payload, 'PHMC webhook embed sent successfully!', 'PHMC', showNotification);
};

const handleWebhookSubmit = async (payload) => { // Receive payload from modal
    if (!payload) return;
    const webhookURL = process.env.REACT_APP_DEV_WEBHOOK; // Dev URL
    // Pass showNotification directly to sendWebhookPayload
    await sendWebhookPayload(webhookURL, payload, 'Dev webhook embed sent successfully!', 'Dev', showNotification);
};
    

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
                    label: `${coroner.name} (${coroner.rank || ''})`,
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
            const order = ['Chief Boss', 'Supervisor', 'Senior Medical Examiner', 'Medical Examiner', 'Senior Coroner Investigator', 'Coroner Investigator', 'Forensic Attendant', 'Trainee Forensic-Attendant', 'Developer Testing', 'Missing_Category', 'Uncategorized'];
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
        const savedGroup = localStorage.getItem('selectedAgencyGroup');
        const hidePreference = localStorage.getItem('hideAgencyGroupSelectorPreference') === 'true';
        setHideAgencyGroupSelectorPreference(hidePreference);

        if (savedGroup && hidePreference) { // Only auto-select if preference is to hide
            setSelectedAgencyGroup(savedGroup);
            setShowAgencyGroupSelectorModal(false);
        } else {
            setShowAgencyGroupSelectorModal(true); // Show if no saved group or preference is not to hide
        }
    }, []);
    
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
            
        <div className="App">
            <PrivacyPolicyModal isOpen={showPrivacyPolicyModal} onClose={handlePrivacyPolicyConfirm} />
 <AgencyGroupSelectorModal
                show={showAgencyGroupSelectorModal && !selectedAgencyGroup}
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
{effect}


        <CoronerTipsModal
            show={showCoronerTips}
            onClose={() => {
                setShowCoronerTips(false);
            }}
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
                        />
                        
                    )}

            <div className="header-info-wrapper">
            <HeaderInfo commitInfo={commitInfo} /> 
            </div>

            <div className="container-fluid"> 
                
                <div className="form-container">
                <div className="button-group">
{/*                     <div style={{ marginBottom: '1rem' }}>
                        <Button variant="warning" onClick={() => {
                            const nextSeason = (() => {
                                const seasons = ['Default', 'Christmas', 'AprilFools', 'Easter', 'Halloween'];
                                const currentIdx = seasons.indexOf(testSeason || 'Default');
                                return seasons[(currentIdx + 1) % seasons.length];
                            })();
                            setTestSeason(nextSeason);
                            showNotification(`Seasonal event set to: ${nextSeason}`, 'info');
                        }}>
                            Test Seasonal Event
                        </Button>
                        <span style={{ marginLeft: '1rem', fontWeight: 'bold', color: '#d7263d' }}>
                            {testSeason ? `Current: ${testSeason}` : 'Current: Auto'}
                        </span>
                  </div> */}
  
        <div className="floating-tools-container">

            <Dropdown drop="up" show={showToolsDropdown} onToggle={(isOpen) => setShowToolsDropdown(isOpen)}>
                <Dropdown.Toggle variant="secondary" id="dropdown-tools">
                    <i className="fas fa-tools"></i> Tools
                </Dropdown.Toggle>

                <Dropdown.Menu>
                    <Dropdown.Item onClick={() => {setShowEmployeeModal(true); setShowToolsDropdown(false);}}>
                        <i className="fas fa-users-cog"></i> Manage PHMC Staff
                    </Dropdown.Item>
{/*                     <Dropdown.Item onClick={() => {setShowFeatureRequestModal(true); setShowToolsDropdown(false);}}>
                        <i className="fas fa-bug"></i> Report Bug/Feature
                    </Dropdown.Item>
 */}
                    <Dropdown.Item onClick={() => {toggleSavedReports(); setShowToolsDropdown(false);}}>
                        <i className="fas fa-save"></i> Saved Reports
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => {toggleEmsAmaModal(); setShowToolsDropdown(false);}}>
                        <i className="fa-solid fa-truck-medical"></i> EMS AMA
                    </Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item onClick={() => {
                        localStorage.removeItem('selectedAgencyGroup');
                        setSelectedAgencyGroup(null);
                        setShowAgencyGroupSelectorModal(true);
                        setShowToolsDropdown(false);
                    }}>
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
                        onClick={toggleBusinessCard}
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
                                        setIsUploading={setIsUploading}
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
    physicianRecruitmentDetails={physicianRecruitmentDetails} // Rename prop here too
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
    setCoronerListData={setCoronerListData}
    isJaneDoe={isJaneDoe}
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
 <div className={`char-counter ${getBBCodeContent()?.length > 60000 ? 'char-counter-warning' : ''}`}>
    Character Counter: {getBBCodeContent()?.length ?? 'Error'}/60000
    {getBBCodeContent()?.length > 60000 && (
        <div className="char-counter-warning-message">
            Hi, you found a new warning: Note that PHPBB has a default Character Limit (60000), some forums are different. You may need to split this form up if you encounter issues!
        </div>
    )}
    {getBBCodeContent() == null ? (
        <div className="char-counter-warning-message">
            Error: Contact a developer, getBBCodeContent() returned null or undefined.
        </div>
    ) : null}
</div>
                    {selectedAgencyGroup === 'PHMC' && (
                        <BusinessCardModal
                            show={showBusinessCard}
                            onHide={() => setShowBusinessCard(false)}
                            showNotification={showNotification}
                            commitInfo={commitInfo}
                        />
                    )}
            <SwitchableFormsModal
                show={showPHMCModal} // Your state that controls this modal's visibility
                onHide={() => setShowPHMCModal(false)}
                title={switchableModalTitle} // Your state for the modal title
                forms={switchableFormsList} // Your state for the list of forms for this modal
                handleFormSelect={handleAgencySelect} // This now triggers the opt-in logic
                isMobile={isMobile}
                physicianRecruitmentDetails={physicianRecruitmentDetails} // Renamed prop here too
                psychRecruitmentStatus={psychRecruitmentDetails} // For Psych buttons - NEW PROP
                formDefinitions={formDefinitions} // Pass all form definitions
                    adminRecruitmentDetails={selectOptions.adminPositionDetailsData || {}} // Assuming admin data is in selectOptions
                nurseRecruitmentDetails={selectOptions.nursePositionDetailsData || {}}
                coronerRecruitmentDetails={selectOptions.coronerPositionDetailsData || {}}
                emsRecruitmentDetails={selectOptions.emsPositionDetailsData || {}}
            />

            <SavedReportsModal
                show={showSavedReports}
                onHide={() => setShowSavedReports(false)}
                savedReports={savedReports}
                loadReport={loadReportForUser}
                deleteReport={deleteReportForUser}
                author={getCurrentReportAuthor(formData)}
                isLoading={isLoadingUserReports}
                onAttachReportSummaryRequest={onAttachReportSummaryRequest}
                reportSelectionFilter={reportSelectionFilter}
                setReportSelectionFilter={setReportSelectionFilter}
                versionNames={versionNames}
            />

            <div className="output-controls">
                <Button
                    type="button"
                    onClick={handleCopyAndNotifyWrapper}
                    className="copy-button"
                >
                    <i className="fas fa-copy"></i>
                    {getCopyButtonText()}
                </Button>
                <Button
                    type="button"
                    onClick={() => setShowBBCode(prev => !prev)}
                    className="preview-button"
                >
                    <i className={`fas ${showBBCode ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    {showBBCode ? 'Hide Preview' : 'Show Preview'}
                </Button>
            </div>

            {showBBCode && (
                <div className="bbcode-preview">
                    <pre><code>{getBBCodeContent()}</code></pre>
                </div>
            )}

            <textarea
                id="bbCodeOutput"
                value={getBBCodeContent()}
                readOnly
                style={{ display: 'none' }} // Keep it off-screen
            />
        </div>
            </div>
            <Footer />
        </div>
        </div>
    );
}

function MainAppWrapper() {
    const [formData, setFormData] = useState({});
    const [lastWebhookIdentifier, setLastWebhookIdentifier] = useState(null);

    const { showNotification, removeNotification, NotificationContainer } = useNotification();

    const initialFormData = {
        // Your initial form data
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