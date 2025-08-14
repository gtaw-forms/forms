import React, { useState, useEffect, useRef, useMemo, useCallback} from 'react';
import { formDefinitions, getFormDefinition } from './formDefinitions'; 
import '@fortawesome/fontawesome-free/css/all.min.css';
import Notification from './components/Notification';
import { Modal, Form, Button } from 'react-bootstrap';
import SavedReportsModal from './components/SavedReportsModal'; 
import getRelevantFields from './components/RevelantFields';
import AgencyGroupSelectorModal from './components/AgencyGroupSelectorModal'; // Corrected import
import AgencySelector from './components/AgencySelector'; // Expected import
import Footer from './components/Footer';
import SeasonalEvents from './components/SeasonalEvents';
import HeaderInfo from './components/HeaderInfo';
import Snowfall from 'react-snowfall'; 
import * as Sentry from "@sentry/react";
import WebhookModal from './components/WebhookModal'; 
import CoronerRankModal from './components/CoronerRankModal'; 
import CoronerTipsModal from './components/CoronerTipsModal'; 
import BusinessCardModal from './components/BusinessCardModal'; 
import EasterEggModal from './components/EasterEggModal'; 
import EmsAmaModal from './components/EmsAmaModal';
import SwitchableFormsModal from './components/SwitchableFormsModal'; 
import MissingEmployeeModal from './components/MissingEmployeeModal';
import RecruitmentStatusDisplay from './components/RecruitmentStatusDisplay'; // Add this import
import CctvRequestWebhookModal from './components/Admin/CctvRequestWebhookModal'; // Add this import
import { sendBingoNotification, sendPhraseRequestNotification } from './components/notificationService';

import FormImageLink from './components/FormImageLink';

// 
import { copyToClipboard, handleFormCopyAndNotify, handlePhmcRecruitmentCopyAndNotify } from './components/notificationService'; // Add copyToClipboard

import {
    generateDeathReport,
} from './phmc-bbcode-generators'; 
import PositionInfoModal from './components/PositionInfoModal'; // Adjust path as needed
import EmsBingoModal from './components/EmsBingoModal'; // <-- ADD THIS IMPORT

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
import './buttons.css'

import 'react-bootstrap-typeahead/css/Typeahead.css';

// database
import { database } from './firebase'; // Your Firebase config
import { ref, get, set, remove} from 'firebase/database'; // Added set
import { phmcList } from './data';



function App() {
    const [isMobile, setIsMobile] = useState(false);
    const modalCloseTimer = useRef(null);
    const [showEmsBingoModal, setShowEmsBingoModal] = useState(false);

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
    patientStress: '',
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
    UpdateMedicalFile: [],
    oocAdminRecordLink: '',
    oocStatsLink: '',
        recruitmentPosition: '',
        applicantTitleAndFullName: '',
        genderMale: '',
        genderFemale: '',
        genderOther: '',
        applicantGenderOtherText: '',
        applicantDOBAndPlace: '',
        applicantAddress: '',
        applicantContactDetails: '',
        applicantMedicalConditions: '',
        citizenUS: '',
        citizenPermanent: '',
        citizenNone: '',
        eduHighSchool: '',
        eduCertificate: '',
        eduDiploma: '',
        eduAssociate: '',
        eduBachelor: '',
        eduMaster: '',
        eduDoctorate: '',
        applicantSchoolName: '',
        applicantEnrollmentTerm: '',
        applicantMajor: '',
        applicantLanguages: '',
        applicantPrevEmployment: '',
        applicantPrevDuties: '',
        applicantPrevDismissalReason: '',
        emsLicenseLink: '',
        emsPartTimeReason: '',
        applicantMotivationLetter: '',
        oocUcpName: '',
        oocForumName: '',
        oocAdminRecordLink: '',
        oocDiscord: '',
        oocTimezone: '',
        oocMedicalExperience: '',
        oocStatsLink: '',
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


};

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



    const removeNotification = useCallback((idToRemove) => {
        setNotifications(prevNotifications =>
            prevNotifications.filter(notif => notif.id !== idToRemove)
        );
        // Clear refs if the removed notification was the one being tracked
        if (loadingNotificationIdRef.current === idToRemove) {
            loadingNotificationIdRef.current = null;
        }
        if (resultNotificationIdRef.current === idToRemove) {
            resultNotificationIdRef.current = null;
        }
    }, []);

    const showNotification = useCallback((message, icon = 'check-circle', duration = DEFAULT_NOTIFICATION_DURATION, actions = []) => {

        const newNotificationId = Date.now() + Math.random();
        const isInteractive = actions && actions.length > 0;
        // Persistent loading notifications are those with duration 0 AND no actions
        const isPersistentLoading = duration === 0 && !isInteractive;

        const newNotification = {
            id: newNotificationId,
            message: message,
            icon: getIconClass(icon),
            actions: actions, // Pass actions to the notification object
        };

        setNotifications(prevNotifications => {
            let updatedNotifications = [...prevNotifications];

            if (isPersistentLoading) {
                if (loadingNotificationIdRef.current) {
                    updatedNotifications = updatedNotifications.filter(n => n.id !== loadingNotificationIdRef.current);
                }
                loadingNotificationIdRef.current = newNotificationId;
            } else if (!isInteractive) { // Standard, non-interactive result notification
                if (resultNotificationIdRef.current) {
                    updatedNotifications = updatedNotifications.filter(n => n.id !== resultNotificationIdRef.current);
                }
                resultNotificationIdRef.current = newNotificationId;
            }
            // Interactive notifications are just added; they don't use the loading/result refs.

            updatedNotifications.push(newNotification);

            // Auto-dismiss for non-interactive, non-persistent-loading notifications
            if (!isInteractive && !isPersistentLoading && duration > 0) {
                setTimeout(() => {
                    removeNotification(newNotificationId);
                }, duration);
            }

            return updatedNotifications;
        });
        return newNotificationId;
    }, [removeNotification]);
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
  const ER_PROTOCOL_VERSION = 19;
 const CONSULTATION_NOTES_PHMC_VERSION = 20;
 const CONSULTATION_NOTES_PBC_VERSION = 21;

    
    // --- START: Data Fetching and Caching Logic ---
    const [phmcListData, setPhmcListData] = useState([]);
    const [coronerListData, setCoronerListData] = useState([]);
    const [agencyDataStore, setAgencyDataStore] = useState({});
    const [selectOptions, setSelectOptions] = useState({});
    const [bbCodeVersion, setBbCodeVersion] = useState(() => {
        const storedVersion = localStorage.getItem('bbCodeVersion');
        return storedVersion ? parseInt(storedVersion, 10) : (formDefinitions[0]?.version || 1);
    });
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
    const loadingNotificationIdRef = useRef(null);
        const [loading, setLoading] = useState(true); // Add a loading state

    const [showCctvRequestModal, setShowCctvRequestModal] = useState(false); // --- MODIFICATION: Add new state
    const handleShowCctvRequestModal = () => {
        setShowAgencyGroupSelectorModal(false); // Hide the main selector if it's open
        setShowCctvRequestModal(true);
    };

const loadData = async () => {
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

        // Log the data right before calling setFormData

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
};
useEffect(() => {
    loadData();
}, [
    showNotification, setPhmcListData, setCoronerListData,
    setAgencyDataStore, setSelectOptions, setPhysicianRecruitmentDetails,
    setPsychRecruitmentDetails, setAdminRecruitmentDetails,
    setEmsRecruitmentDetails, setNurseRecruitmentDetails, setCoronerRecruitmentDetails
]);


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
        return `BBCode generation for form "${formName}" is not implemented.`;
    }
};
        const initialLoadFormData = () => {
        const storedData = localStorage.getItem('formData');
        return storedData ? JSON.parse(storedData) : initialFormData;
    };

    const [formData, setFormData] = useState(initialLoadFormData);
        useEffect(() => {
        const { evidenceLockerID, ...formDataToPersist } = formData; // Exclude evidenceLocker
        localStorage.setItem('formData', JSON.stringify(formDataToPersist));
    }, [formData]);


    const [isUploading, setIsUploading] = useState(false);
    const [isJohnDoe, setIsJohnDoe] = useState(false);
    const [isJaneDoe, setIsJaneDoe] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const resultNotificationIdRef = useRef(null);  // For timed result messages
    const [showUpdateNotification, setShowUpdateNotification] = useState(false); // New state for notification visibility
    const [commitInfo, setCommitInfo] = useState({ sha: '', date: null, error: null });
    const { imageSource: deathReportImage, className: deathReportClass } = SeasonalEvents({ imageType: 'deathReport' });
    const { imageSource: civilianPaperworkImage, className: civilianPaperworkClass } = SeasonalEvents({ imageType: 'civilianPaperwork' });


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
    const [showPHMCModal, setShowPHMCModal] = useState(false); // This state will now control the generic SwitchableFormsModal
    const [switchableModalTitle, setSwitchableModalTitle] = useState('');
    const [switchableFormsList, setSwitchableFormsList] = useState([]);
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

    
    const [showChangelog, setShowChangelog] = useState(false);


    // Coroner Tips Handling

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

    const [showFeatureRequestModal, setShowFeatureRequestModal] = useState(false);
    const [featureRequest, setFeatureRequest] = useState('');
    const [discordName, setDiscordName] = useState('');
    const [isRemoveStaff, setIsRemoveStaff] = useState(false); 
    const [missingEmployeeData, setMissingEmployeeData] = useState({
        coronerName: '',
        coronerDiscord: '', // This will still be used for 'Add Coroner'
        employeeLastName: '', // <-- Add this for hospital staff last name
        coronerRank: '',
        coronerPHNumber: '',
        coronerEmployee: '',
        coronerBadge: '',
        phmcEmployee: '',
        staffToRemove: [],
        authorizedBy: '',
    });

// Inside src/App.js

const handleAutopsyImageUploadAndCreateAlbum = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
        showNotification('No files selected for autopsy photos.', 'warning');
        return;
    }

    let indefiniteNotificationId = null;

    setIsUploading(true);
    indefiniteNotificationId = showNotification('Processing autopsy photos, please wait...', 'info-circle', 0);

    const imgurAccessToken = process.env.REACT_APP_IMGUR_ACCESS_TOKEN;

    if (!imgurAccessToken) {
        console.error('[Autopsy Photos] Imgur access token not configured.');
        Sentry.captureMessage('Imgur access token not configured for image upload.', 'error');
        showNotification('Configuration error: Imgur token missing.', 'exclamation-triangle');
        setIsUploading(false);
        if (indefiniteNotificationId) removeNotification(indefiniteNotificationId);
        return;
    }

    const delayBetweenIndividualImageUploads = 1000; // 1 second delay
    const uploadedImageLinks = [];

    try {
        
        for (const file of files) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenIndividualImageUploads));
            
            const imageFormData = new FormData();
            imageFormData.append('image', file);
            // No album ID needed for individual uploads if not grouping them

            const imageUploadResponse = await fetch('https://api.imgur.com/3/image', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${imgurAccessToken}` },
                body: imageFormData,
            });
            const imageData = await imageUploadResponse.json();

            if (imageData.success && imageData.data.link) {
                uploadedImageLinks.push(imageData.data.link); // Collect direct image links
                console.log(`[Autopsy Photos] Successfully uploaded image: "${file.name}" (Link: ${imageData.data.link}). Collected ${uploadedImageLinks.length} image links.`);
            } else {
                console.warn(`[Autopsy Photos] Failed to upload image "${file.name}". Imgur response:`, imageData);
                // Optionally, notify about individual failures
                showNotification(`Failed to upload ${file.name}. Error: ${imageData.data?.error?.message || 'Unknown'}`, 'warning', 4000);
            }
        }
        console.log(`[Autopsy Photos] Finished individual image uploads. ${uploadedImageLinks.length}/${files.length} images successfully uploaded.`);

        if (uploadedImageLinks.length > 0) {
            // Append new links to existing ones, if any
            setFormData(prev => {
                const existingLinks = prev.autopsyAlbumUrl ? prev.autopsyAlbumUrl.split(',').map(s => s.trim()).filter(s => s) : [];
                const allLinks = [...existingLinks, ...uploadedImageLinks];
                // Remove duplicates just in case, though unlikely with new uploads
                const uniqueLinks = [...new Set(allLinks)]; 
                return {
                    ...prev,
                    autopsyAlbumUrl: uniqueLinks.join(', '), // Store as comma-separated string
                    autopsyPhotosUnavailable: false
                };
            });
            showNotification(`Successfully uploaded ${uploadedImageLinks.length}/${files.length} image(s). Links added to the photography field.`, 'check-circle', 7000);
        } else if (files.length > 0) {
            showNotification(`No images were successfully uploaded.`, 'warning', 5000);
        }

    } catch (error) {
        console.error('[Autopsy Photos] An error occurred during image upload:', error);
        Sentry.captureException(error, { extra: { context: 'handleAutopsyImageUploadAndCreateAlbum' } });
        showNotification(`Error uploading images: ${error.message}`, 'exclamation-triangle', 7000);
    } finally {
        setIsUploading(false);
        if (indefiniteNotificationId) {
            removeNotification(indefiniteNotificationId);
        }
        console.log('[Autopsy Photos] Process finished. isUploading set to false, indefinite notification removed.');
    }
};
    const [staffToRemove, setStaffToRemove] = useState([]);
    const [authorizedBy, setAuthorizedBy] = useState('');

const handleMissingEmployeeSubmit = async (actionType, employeeType, selectedEmployeeName, newRank, staffToRemove, authorizedBy, missingEmployeeData, updatedStaff) => {
    await sendMissingEmployeeNotification(
        actionType,
        employeeType,
        selectedEmployeeName,
        newRank,
        coronerListData, // Pass coronerListData
        phmcList,
        staffToRemove,
        authorizedBy,
        missingEmployeeData,
        commitInfo,
        showNotification,
        database, // should be LAST
    );

    // Trigger refresh after any action involving MissingEmployeeModal
    if (actionType === 'updateRank') {
        showNotification("Refreshing staff data...", 'info-circle', 2000);
    }
    await loadData(); // Call the main data loading function to refresh data

    if (actionType === 'updateRank') {
        showNotification("Staff data refreshed.", 'check-circle', 3000);
    }
};
const [showWebhookModal, setShowWebhookModal] = useState(false);
const [webhookMessage, setWebhookMessage] = useState('');
const [webhookTitle, setWebhookTitle] = useState(''); // <-- New state for title
const phmcLogoUrl = 'https://i.imgur.com/QMaz0OC.png'; // Publicly accessible URL for the logo
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

    // --- Function to open the webhook modal with the template ---
    const openWebhookModalWithTemplate = () => {
        setWebhookTitle(''); // Set to empty string
        setWebhookMessage(''); // Set to empty string
        setShowWebhookModal(true);
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
            url.pathname = url.pathname.replace(/\/bingo$/, '') || '/';
        }

        window.history.replaceState({}, document.title, url.href);

    }, []);

    

    const handleHideCctvRequestModal = useCallback(() => {
        setShowCctvRequestModal(false);
        // When the modal is closed, remove '/cctv' from the URL if it's there
        const url = new URL(window.location.href);
        if (url.pathname.endsWith('/cctv')) {
            url.pathname = url.pathname.replace(/\/cctv$/, '') || '/';
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

const uniqueCoronerRanks = [...new Set(coronerListData.map(c => c.rank))].sort();

const handlePhmcWebhookSubmit = async (payload) => { // Receive payload from modal
    if (!payload) return; // Should not happen if modal validates, but good check
    const webhookURL = process.env.REACT_APP_PHMC_DISCORD;
    // Pass showNotification directly to sendWebhookPayload
    await sendWebhookPayload(webhookURL, payload, 'PHMC webhook embed sent successfully!', 'PHMC', showNotification);
};

const handleWebhookSubmit = async (payload) => { // Receive payload from modal
    if (!payload) return;
    const webhookURL = process.env.REACT_APP_DISCORD_WEBHOOK_URL; // Dev URL
    // Pass showNotification directly to sendWebhookPayload
    await sendWebhookPayload(webhookURL, payload, 'Dev webhook embed sent successfully!', 'Dev', showNotification);
};
    const [isBbcodeRequest, setIsBbcodeRequest] = useState(false);
    const [bbcodeTitleRequest, setBbcodeTitleRequest] = useState('');
    const [bbcodeRequestText, setBbcodeRequestText] = useState(''); // New state for BBCode text

    // ... (existing useEffects and functions)

    const handleFeatureRequestSubmit = async () => {
        const webhookURL = process.env.REACT_APP_DISCORD_WEBHOOK_URL;

        if (!webhookURL) {
            console.error('Discord webhook URL not configured for feature requests.');
            Sentry.captureMessage('Discord webhook URL is missing for feature request submission.', 'error');
            showNotification('Configuration error: Unable to submit request. Please contact the administrator.', 'exclamation-triangle');
            return;
        }

        // Validations
        if (!featureRequest.trim() && (!isBbcodeRequest || !bbcodeRequestText.trim())) {
            showNotification('Please enter your bug report/feature request or the BBCode details.', 'warning');
            return;
        }
        if (!discordName.trim()) {
            showNotification('Please enter your Discord name.', 'warning');
            return;
        }
        if (isBbcodeRequest && !bbcodeTitleRequest.trim()) {
            showNotification('Please enter a title for your BBCode format request.', 'warning');
            return;
        }
        // If it's a BBCode request, the BBCode text itself is now also required for file attachment
        if (isBbcodeRequest && !bbcodeRequestText.trim()) {
            showNotification('Please enter the BBCode for your new format request.', 'warning');
            return;
        }

        const debugInfo = {
            bbCodeVersion: bbCodeVersion,
            userAgent: navigator.userAgent,
        };

        const MAX_FIELD_LENGTH = 1000;
        const requestChunks = [];
        let currentChunk = "";
        const mainRequestDetails = featureRequest || (isBbcodeRequest ? "See BBCode file for details." : "No details provided.");

        mainRequestDetails.split('\n').forEach(line => {
            if (currentChunk.length + line.length + 1 > MAX_FIELD_LENGTH) {
                requestChunks.push(currentChunk);
                currentChunk = line;
            } else {
                currentChunk += (currentChunk ? '\n' : '') + line;
            }
        });
        if (currentChunk) {
            requestChunks.push(currentChunk);
        }

        // Base fields for the embed
        const baseEmbedFields = [
            { name: "Submitted By", value: discordName || "N/A", inline: true },
            { name: "Request Type", value: isBbcodeRequest ? "New BBCode Format" : "Bug/Feature", inline: true },
        ];

        if (isBbcodeRequest) {
            baseEmbedFields.push({ name: "Proposed BBCode Title", value: bbcodeTitleRequest || "N/A", inline: false });
        }

        let firstMessageBody;
        let firstMessageHeaders = { 'Content-Type': 'application/json' }; // Default for JSON payload

        // --- MODIFICATION START ---
        const requestDetailsFieldName = `Request Details${requestChunks.length > 1 ? ` (Part 1 of ${requestChunks.length})` : ''}`;
        // --- MODIFICATION END ---

        if (isBbcodeRequest && bbcodeRequestText.trim()) {
            const bbcodeFile = new File([new Blob([bbcodeRequestText], { type: 'text/plain;charset=utf-8' })], 'requested_bbcode.txt');
            const formDataForFile = new FormData();

            const fieldsForFileEmbed = [
                ...baseEmbedFields,
                { name: "Requested BBCode", value: "See attached 'requested_bbcode.txt'", inline: false },
                { name: requestDetailsFieldName, value: requestChunks[0] || "No details provided.", inline: false },
                { name: "Debug Info", value: `\`\`\`json\n${JSON.stringify(debugInfo, null, 2)}\n\`\`\``, inline: false }
            ];

            const embedPayloadForFile = {
                title: "📝 Bug Report / Feature Request",
                color: 0x3498DB,
                fields: fieldsForFileEmbed,
                timestamp: new Date().toISOString(),
                footer: { text: `Submitted via PHMC Forms Tool - v${commitInfo.sha || 'N/A'}` }
            };

            formDataForFile.append('payload_json', JSON.stringify({
                content: `Feedback / Bug Report (Part 1${requestChunks.length > 1 ? ` of ${requestChunks.length}` : ''})`,
                embeds: [embedPayloadForFile]
            }));
            formDataForFile.append('file1', bbcodeFile); // 'file1' is a common key for Discord attachments

            firstMessageBody = formDataForFile;
            firstMessageHeaders = {}; // Browser sets Content-Type for FormData, so remove explicit header
        } else {
            // Standard JSON payload (not a BBCode request, or BBCode text is empty)
            const fieldsForJsonEmbed = [
                ...baseEmbedFields,
                { name: requestDetailsFieldName, value: requestChunks[0] || "No details provided.", inline: false },
                { name: "Debug Info", value: `\`\`\`json\n${JSON.stringify(debugInfo, null, 2)}\n\`\`\``, inline: false }
            ];

            const firstEmbedData = {
                title: "📝 Bug Report / Feature Request",
                color: 0x3498DB,
                fields: fieldsForJsonEmbed,
                timestamp: new Date().toISOString(),
                footer: { text: `Submitted via PHMC Forms Tool - v${commitInfo.sha || 'N/A'}` }
            };
            firstMessageBody = JSON.stringify({
                content: `Feedback / Bug Report (Part 1${requestChunks.length > 1 ? ` of ${requestChunks.length}` : ''})`,
                embeds: [firstEmbedData]
            });
        }

        let allWebhooksSentSuccessfully = true;

        try {
            // Send the first message (either FormData with file or JSON)
            const firstResponse = await fetch(webhookURL, {
                method: 'POST',
                headers: firstMessageHeaders,
                body: firstMessageBody,
            });

            if (!firstResponse.ok) {
                allWebhooksSentSuccessfully = false;
                const errorText = await firstResponse.text();
                console.error(`Failed to send message (Part 1) to Discord webhook. Status: ${firstResponse.status} ${firstResponse.statusText}`, errorText);
                Sentry.captureMessage(`Discord webhook failed for feature request (Part 1): ${firstResponse.status}`, {
                    level: 'error',
                    extra: { statusText: firstResponse.statusText, responseBody: errorText }
                });
            }

            // Send subsequent chunks for long "Request Details" (always JSON)
            if (allWebhooksSentSuccessfully && requestChunks.length > 1) {
                for (let i = 1; i < requestChunks.length; i++) {
                    await new Promise(resolve => setTimeout(resolve, 1200)); // Delay

                    const subsequentEmbedData = {
                        title: `📝 Bug/Feature Request Details (Part ${i + 1} of ${requestChunks.length})`,
                        description: requestChunks[i],
                        color: 0x3498DB,
                        timestamp: new Date().toISOString(),
                        footer: {
                            text: `Submitted by: ${discordName || "N/A"} | PHMC Forms Tool - v${commitInfo.sha || 'N/A'}`
                        }
                    };
                    const subsequentResponse = await fetch(webhookURL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }, // Subsequent parts are always JSON
                        body: JSON.stringify({
                            content: `Feedback / Bug Report (Part ${i + 1} of ${requestChunks.length})`,
                            embeds: [subsequentEmbedData]
                        }),
                    });

                    if (!subsequentResponse.ok) {
                        allWebhooksSentSuccessfully = false;
                        const errorText = await subsequentResponse.text();
                        console.error(`Failed to send message (Part ${i + 1}) to Discord webhook. Status: ${subsequentResponse.status} ${subsequentResponse.statusText}`, errorText);
                        Sentry.captureMessage(`Discord webhook failed for feature request (Part ${i + 1}): ${subsequentResponse.status}`, {
                            level: 'error',
                            extra: { statusText: subsequentResponse.statusText, responseBody: errorText }
                        });
                        break;
                    }
                }
            }

            if (allWebhooksSentSuccessfully) {
                showNotification('Thanks for your feedback! I will work on it soon', 'check-circle');
                setShowFeatureRequestModal(false);
                setFeatureRequest('');
                setDiscordName('');
                setIsBbcodeRequest(false);
                setBbcodeTitleRequest('');
                setBbcodeRequestText('');
            } else {
                showNotification(`Partially submitted or failed. Please check console or try again.`, 'exclamation-triangle');
            }

        } catch (error) {
            console.error('Error submitting feature request:', error);
            Sentry.captureException(error, { extra: { context: 'Feature Request Submission Fetch' } });
            showNotification('A network error occurred. Please try again.', 'exclamation-triangle');
        }
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

    const handleRemoveStaffChange = (e) => {
        if (e.target.checked) {
            setIsRemoveStaff(true);
            setIsJohnDoe(false); // Turn off other modes
            setIsJaneDoe(false); // Turn off other modes
            setMissingEmployeeData(prev => ({
                ...prev,
                coronerName: '',
                coronerDiscord: '',
                coronerRank: '',
                coronerPHNumber: '',
                coronerBadge: '',
            }));
        }
    };

    const handleMissingEmployeeChange = (value, type) => {
        setMissingEmployeeData(prevData => ({
            ...prevData,
            [type]: value,
        }));
    };


    // UTC time stuff
    const [currentUtcTime, setCurrentUtcTime] = useState('');
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
    
    // Saved Reports State and Functions
    const [savedReports, setSavedReports] = useState([]);
    const [showSavedReports, setShowSavedReports] = useState(false);
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
    const [showEasterEggModal, setShowEasterEggModal] = useState(false);
    const sendEasterEggNotification = async (type = 'normal') => { // Default to 'normal'
        const webhookUrl = process.env.REACT_APP_DISCORD_WEBHOOK_URL;
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
                text: `PHMC Forms Tool | ${triggerSource}` // Use dynamic trigger source
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

const [selectedUserForSavedReports, setSelectedUserForSavedReports] = useState(null);

    const getCurrentReportAuthor = useCallback((formData) => {
        // Define which bbCodeVersions are primarily Coroner forms
        const coronerFormVersions = [1, 2, 4, 8, 11, 18];
        // Define which bbCodeVersions are primarily PHMC forms
        const phmcFormVersions = [
            5, 6, 7, 9, 10, 12, 13, 14, 16, 19, 20, 21, 22, 23, 27, 28, 29, 35 // Added Sickness Email
        ];

        if (coronerFormVersions.includes(bbCodeVersion)) {
            if (formData.coronerEmployee) return formData.coronerEmployee;
        } else if (phmcFormVersions.includes(bbCodeVersion)) {
            if (formData.phmcEmployee) return formData.phmcEmployee;
        }

        // Fallback logic if the form isn't strictly one or the other,
        // or if the primary employee field for that form type is empty.
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

const saveReport = async () => {
    let key = '';
    const bbCodeContent = getBBCodeContent();
    const currentAuthor = getCurrentReportAuthor(formData);

    // --- Validation logic to determine the key ---
    if (bbCodeVersion === 1) { // Death Report
        if (!formData.decedentOOC || !formData.dateTime) {
            showNotification(`Please fill in Decedent OOC and Date/Time fields.`, 'exclamation-circle');
            return false;
        }
        key = `[DEATH-REPORT] ${formData.decedentOOC} - ${formData.dateTime}`;
    } else if (bbCodeVersion === 4) { // Autopsy Report
        if (!formData.decedentName || !formData.decedentOOC || !formData.autopsyDate) {
            showNotification(`Please fill in Decedent IC Name, OOC Name, and Autopsy Date fields.`, 'exclamation-circle');
            return false;
        }
        key = `[Autopsy] ${formData.decedentName} (${formData.decedentOOC}) - ${formData.autopsyDate}`;
    } else if (((bbCodeVersion >= 3 && bbCodeVersion <= 7) && bbCodeVersion !== 4)) { // PatientAdvanced (3), SurgicalOps (5), PhysEval PHMC/PBC (6,7)
        let patientIdMissing = !formData.patientID;
        let dateMissing = !formData.date;
        let patientNameMissing = false;
        if (bbCodeVersion !== 5) { // Surgical doesn't strictly require patientName for this validation step.
            patientNameMissing = !formData.patientName;
        }
        if (patientIdMissing || dateMissing || patientNameMissing) {
            let missingFieldLabels = [];
            if (patientIdMissing) missingFieldLabels.push('Patient ID');
            if (patientNameMissing) missingFieldLabels.push('Patient Name');
            if (dateMissing) missingFieldLabels.push('Date');
            if (missingFieldLabels.length > 0) {
                 showNotification(`Please fill in ${missingFieldLabels.join(', ')} fields.`, 'exclamation-circle');
                 return false;
            }
        }
        key = `${formData.patientID || 'NO_ID'} - ${formData.patientName || 'NO_NAME'} - ${formData.date || 'NO_DATE'}`;
    } else if (bbCodeVersion === 19) { // EmergencyProtocol
        if (!formData.patientID  || !formData.date) {
            showNotification(`Please fill in Patient ID, and Date fields.`, 'exclamation-circle');
            return false;
        }
        key = `${formData.patientID} - ${formData.lastName} - ${formData.date}`;
    } else if (bbCodeVersion === 25) { // BasicPatientFile
        if (!formData.patientName || !formData.date) {
            showNotification(`Please fill in Patient Name and Date fields.`, 'exclamation-circle');
            return false;
        }
        key = `${formData.patientName} - ${formData.date}`;
    }
    // --- Add more 'else if' blocks here for other specific bbCodeVersions ---
    // Example for Coroner Email (bbCodeVersion 2)
    else if (bbCodeVersion === 2) {
        if (!formData.coronerEmployee || !formData.requestingOfficer || (!formData.decedentName && !formData.decedentOOC)) {
            showNotification(`Please fill in Coroner, Requesting Officer, and Decedent Name/OOC for Coroner Email.`, 'exclamation-circle');
            return false;
        }
        key = `[Email] ${formData.requestingOfficer} re: ${formData.decedentName || formData.decedentOOC} - ${new Date().toISOString().split('T')[0]}`;
    }
    // Example for Agency Feedback (bbCodeVersion 18)
    else if (bbCodeVersion === 18) {
        if (!formData.department || !formData.dateTime || !formData.synopsis) {
            showNotification(`Please fill in Department, Date/Time, and Synopsis for Agency Feedback.`, 'exclamation-circle');
            return false;
        }
        key = `[Feedback] ${formData.department} - ${formData.dateTime}`;
    }
    // --- MODIFICATION FOR PHMC RECRUITMENT ---
    else if (getFormDefinition(bbCodeVersion)?.group === 'PHMC Recruitment') {
        return false; // Prevent Firebase saving for PHMC Recruitment forms
    }
    // --- END MODIFICATION ---
    else if (bbCodeVersion === 11) { // Mass Fatality Report
        const { decedents, dateTime } = formData;
        if (!decedents || decedents.length === 0) {
            showNotification(`Please add at least one decedent to the report.`, 'exclamation-circle');
            return false;
        }
        const firstDecedent = decedents[0];
        if (!firstDecedent.decedentName || !dateTime) {
            showNotification(`The first decedent must have a name and the main date/time must be set.`, 'exclamation-circle');
            return false;
        }
        const decedentNames = decedents.map(d => d.decedentName).filter(name => name).join(', ');
        key = `[Mass Fatality Report] - ${decedentNames} - ${(dateTime && dateTime.split('T')[0]) || 'No Date'}`;
    }
    else { // Default handler for any other bbCodeVersion (includes SAAA)
        const definition = getFormDefinition(bbCodeVersion); // Get current form definition


        // Existing generic key generation for non-SAAA, non-PHMC Recruitment forms
        const formName = versionNames[bbCodeVersion] || `FormV${bbCodeVersion}`;

        // MODIFIED: Prioritize decedentName, then patientName, then a generic placeholder
        let identifier = formData.decedentName || formData.patientName || 'Unnamed Report';
        if (Array.isArray(identifier)) identifier = identifier.join(', ');

        // MODIFIED: Ensure dateField always has a value
        const dateField = formData.date || formData.dateTime || formData.autopsyDate || 'No Date';

        // MODIFIED: Removed the check that would prevent saving if identifier was empty.
        // The identifier will now always have a value ('Unnamed Report' at minimum).

        key = `[${formName}] ${identifier} - ${dateField}`;
    }

    // If key is still empty, something went wrong (should be caught by validations)
    if (!key) {
        showNotification('Could not generate a report key. Save aborted.', 'error');
        return false;
    }

    if (!currentAuthor) {
        showNotification('Cannot determine report author. Please ensure an employee is selected or patient name is filled if applicable for this form type.', 'error');
        return false;
    }

    const sanitizedAuthorId = currentAuthor.replace(/[.#$[\]/]/g, '_');
    const sanitizedKey = key.replace(/[.#$[\]/]/g, '_');

    // --- Easter Egg Logic ---
    const currentSavedCountForAuthor = savedReports.filter(r => r.authorName === currentAuthor).length;
    const easterEggAlreadyShown = localStorage.getItem('easterEggShown') === 'true';
    let showNormalEasterEgg = false;
    let showRareEasterEgg = false;

    if (currentSavedCountForAuthor === 4 && !easterEggAlreadyShown) {
        showNormalEasterEgg = true;
    } else if (currentSavedCountForAuthor > 4 && !easterEggAlreadyShown) {
        showNormalEasterEgg = Math.random() < 0.05;
    } else if (easterEggAlreadyShown) {
        showRareEasterEgg = Math.random() < 0.01;
    }

    if (showNormalEasterEgg) {
        setShowEasterEggModal(true);
        setEasterEggType('normal');
        localStorage.setItem('easterEggShown', 'true');
        sendEasterEggNotification('normal');
    } else if (showRareEasterEgg) {
        setShowEasterEggModal(true);
        setEasterEggType('rare');
        sendEasterEggNotification('rare');
    }
    // --- End Easter Egg Logic ---


    const reportDataToSave = {
        bbCodeVersion: bbCodeVersion,
        data: filterFormData(formData, bbCodeVersion),
        bbCode: bbCodeContent,
        timestamp: Date.now(),
        originalKey: key,
        authorName: currentAuthor
    };

    const reportPath = `savedReports/${sanitizedAuthorId}/${sanitizedKey}`;

    try {
        const reportRef = ref(database, `savedReports/${currentAuthor.replace(/[.#$[\]/]/g, '_')}/${key.replace(/[.#$[\]/]/g, '_')}`);
        await set(reportRef, reportDataToSave);
        showNotification(`Report "${key}" saved for ${currentAuthor} to Firebase!`, 'save');
        return true; // Indicate success

    } catch (error) {
        console.error("Error saving report to Firebase:", error);
        Sentry.captureException(error, { extra: { context: 'Firebase set report' } });
        showNotification('Failed to save report to Firebase.', 'error');
        return false; // Indicate failure
    }
};
const [isLoadingUserReports, setIsLoadingUserReports] = useState(false);
    const [preselectedEmployeeType, setPreselectedEmployeeType] = useState(null);

const loadUserSavedReports = useCallback(async (userId) => {
    if (!userId) {
        setSavedReports([]);
        setSelectedUserForSavedReports(null);
        return;
    }

    setIsLoadingUserReports(true);
    setSelectedUserForSavedReports(userId);
    const loadingNotifId = showNotification(`Loading reports for ${userId}...`, 'info-circle', 0);

    const sanitizedUserId = userId.replace(/[.#$[\]/]/g, '_');
    const userReportsPath = `savedReports/${sanitizedUserId}`;
    const reportsRef = ref(database, userReportsPath);

    try {
        const snapshot = await get(reportsRef);
        removeNotification(loadingNotifId);

        if (snapshot.exists()) {
            const reportsData = snapshot.val();
            const validReports = [];
            for (const reportKey in reportsData) {
                const report = reportsData[reportKey];
                validReports.push({
                    key: reportKey,
                    originalKey: report.originalKey,
                    bbCodeVersion: report.bbCodeVersion,
                    timestamp: report.timestamp,
                    authorName: report.authorName,
                    bbCode: report.bbCode,
                });
            }

            validReports.sort((a, b) => b.timestamp - a.timestamp);
            setSavedReports(validReports);

            if (validReports.length > 0) {
                showNotification(`Loaded ${validReports.length} report(s) for ${userId}.`, 'check-circle');
            } else {
                showNotification(`No active reports found for ${userId}.`, 'info-circle');
            }

        } else {
            setSavedReports([]);
            showNotification(`No reports found for ${userId}.`, 'info-circle');
        }
    } catch (error) {
        removeNotification(loadingNotifId);
        console.error(`Error loading reports for user ${userId}:`, error);
        Sentry.captureException(error, { extra: { context: 'loadUserSavedReports', userId } });
        showNotification(`Failed to load reports for ${userId}.`, 'error');
        setSavedReports([]);
    } finally {
        setIsLoadingUserReports(false);
    }
}, [showNotification, removeNotification, setSavedReports, setSelectedUserForSavedReports, setIsLoadingUserReports, database]);

    const pendingReportAttachmentCallback = useRef(null); // Use ref for callback to avoid re-renders
const [reportSelectionFilter, setReportSelectionFilter] = useState(null); // Array of bbCodeVersions to filter by


const loadReportForUser = async (reportFirebaseKey, userId, returnOnly = false) => {
    if (!userId || !reportFirebaseKey) {
        if (!returnOnly) showNotification('Cannot load report: User ID or Report Key is missing.', 'error');
        return { success: false, message: 'User ID or Report Key is missing.' };
    }

    const sanitizedUserId = userId.replace(/[.#$[\]/]/g, '_');
    const reportPath = `savedReports/${sanitizedUserId}/${reportFirebaseKey}`;
    const reportRef = ref(database, reportPath);

    let loadingNotifId;
    if (!returnOnly) { // Only show notification if we are directly loading into the form
        loadingNotifId = showNotification(`Loading report: ${reportFirebaseKey} for ${userId}...`, 'info-circle', 0);
    }

    try {
        const snapshot = await get(reportRef);
        if (snapshot.exists()) {
            const reportData = snapshot.val();
            const loadedVersion = reportData.bbCodeVersion;
            let loadedBbCode = reportData.bbCode || ''; // Get the BBCode from the saved report
            let loadedFormData = reportData.data || {};

            loadedBbCode = loadedBbCode.replace(/\[bold\]/gi, '[b]').replace(/\[\/bold\]/gi, '[/b]');
            const loadedCoronerEmployee = loadedFormData.coronerEmployee;
            const loadedPhmcEmployee = loadedFormData.phmcEmployee;
            const currentTimestamp = Date.now().toString();

            if (loadedCoronerEmployee) {
                 const coronerDetails = coronerListData.find(c => c.name === loadedCoronerEmployee);
                 if (coronerDetails) {
                     loadedFormData.coronerEmployee = loadedCoronerEmployee;
                     loadedFormData.coronerBadge = coronerDetails.badge || '';
                     loadedFormData.coronerRank = coronerDetails.rank || '';
                     loadedFormData.coronerDiscord = coronerDetails.discord || '';
                     loadedFormData.coronerPHNumber = coronerDetails.phNumber || '50056';
                     if (!returnOnly) { // Only update localStorage if directly loading
                         localStorage.setItem('coronerEmployee', loadedFormData.coronerEmployee);
                         localStorage.setItem('coronerEmployee_timestamp', currentTimestamp);
                         localStorage.setItem('coronerBadge', loadedFormData.coronerBadge);
                         localStorage.setItem('coronerBadge_timestamp', currentTimestamp);
                         localStorage.setItem('coronerRank', loadedFormData.coronerRank);
                         localStorage.setItem('coronerRank_timestamp', currentTimestamp);
                         localStorage.setItem('coronerDiscord', loadedFormData.coronerDiscord);
                         localStorage.setItem('coronerDiscord_timestamp', currentTimestamp);
                         localStorage.setItem('coronerPHNumber', loadedFormData.coronerPHNumber);
                         localStorage.setItem('coronerPHNumber_timestamp', currentTimestamp);
                     }
                 } else {
                     if (!returnOnly) showNotification(`Coroner "${loadedCoronerEmployee}" not found in current staff list. Using data from saved report.`, 'warning', 7000);
                     if (!returnOnly) { // Update localStorage timestamps for loaded data
                         if (loadedFormData.coronerEmployee) localStorage.setItem('coronerEmployee_timestamp', currentTimestamp);
                         if (loadedFormData.coronerBadge) localStorage.setItem('coronerBadge_timestamp', currentTimestamp);
                         if (loadedFormData.coronerRank) localStorage.setItem('coronerRank_timestamp', currentTimestamp);
                         if (loadedFormData.coronerDiscord) localStorage.setItem('coronerDiscord_timestamp', currentTimestamp);
                         if (loadedFormData.coronerPHNumber) localStorage.setItem('coronerPHNumber_timestamp', currentTimestamp);
                     }
                 }
            } else if (!returnOnly) { // Clear localStorage if no coronerEmployee in loaded report and not in returnOnly mode
                const coronerFieldsToClear = ['coronerEmployee', 'coronerBadge', 'coronerRank', 'coronerDiscord', 'coronerPHNumber'];
                coronerFieldsToClear.forEach(field => {
                    localStorage.removeItem(field);
                    localStorage.removeItem(`${field}_timestamp`);
                });
            }

             if (loadedPhmcEmployee) {
                 const phmcDetails = phmcListData.find(p => p.name === loadedPhmcEmployee);
                 if (phmcDetails) {
                     loadedFormData.phmcEmployee = loadedPhmcEmployee;
                     loadedFormData.phmcEmployeeLastName = phmcDetails.lastName || '';
                     loadedFormData.phmcRank = phmcDetails.category || phmcDetails.rank || '';
                     if (!returnOnly) { // Only update localStorage if directly loading
                         localStorage.setItem('phmcEmployee', loadedFormData.phmcEmployee);
                         localStorage.setItem('phmcEmployee_timestamp', currentTimestamp);
                         localStorage.setItem('phmcEmployeeLastName', loadedFormData.phmcEmployeeLastName);
                         localStorage.setItem('phmcEmployeeLastName_timestamp', currentTimestamp);
                         localStorage.setItem('phmcRank', loadedFormData.phmcRank);
                         localStorage.setItem('phmcRank_timestamp', currentTimestamp);
                     }
                 } else {
                     if (!returnOnly) showNotification(`PHMC Staff "${loadedPhmcEmployee}" not found in current staff list. Using data from saved report.`, 'warning', 7000);
                     if (!returnOnly) { // Update localStorage timestamps for loaded data
                         if (loadedFormData.phmcEmployee) localStorage.setItem('phmcEmployee_timestamp', currentTimestamp);
                         if (loadedFormData.phmcEmployeeLastName) localStorage.setItem('phmcEmployeeLastName_timestamp', currentTimestamp);
                         if (loadedFormData.phmcRank) localStorage.setItem('phmcRank_timestamp', currentTimestamp);
                     }
                 }
             } else if (!returnOnly) { // Clear localStorage if no phmcEmployee in loaded report and not in returnOnly mode
                const phmcFieldsToClear = ['phmcEmployee', 'phmcEmployeeLastName', 'phmcRank'];
                phmcFieldsToClear.forEach(field => {
                    localStorage.removeItem(field);
                    localStorage.removeItem(`${field}_timestamp`);
                });
             }

            const localStorageManagedFields = [
                'placeOfDeath', 'pronouncedTimeOfDeath', 'dateTime', 'department',
                'mannerOfDeath',
            ];
            localStorageManagedFields.forEach(field => {
                if (loadedFormData.hasOwnProperty(field) && loadedFormData[field]) {
                    if (!returnOnly) { // Only update localStorage if directly loading
                        localStorage.setItem(field, loadedFormData[field]);
                        localStorage.setItem(`${field}_timestamp`, currentTimestamp);
                    }
                }
            });
            // --- End Employee Sync Logic ---

            if (!returnOnly) {
                if (loadedVersion === 11) {
                    // Mass Fatality Report: set decedents array and other relevant fields
                    setFormData(prev => ({
                        ...prev,
                        ...loadedFormData,
                        decedents: Array.isArray(loadedFormData.decedents) ? loadedFormData.decedents : [],
                        coronerEmployee: loadedFormData.coronerEmployee || prev.coronerEmployee,
                        phmcEmployee: loadedFormData.phmcEmployee || prev.phmcEmployee,
                    }));
                    setBbCodeVersion(loadedVersion);
                    showNotification(`Mass Fatality Report loaded.`, 'upload');
                } else if (bbCodeVersion === 2 && loadedVersion === 1) {
                    // ...existing code for v2 loading v1...
                    const currentDeathReportIsEmpty = !formData.deathReport || formData.deathReport.trim() === '';
                    let notificationMessage = '';
                    setFormData(prevFormData => {
                        let updatedName = prevFormData.decedentName || '';
                        let updatedOoc = prevFormData.decedentOOC || '';
                        let updatedDeathReport = prevFormData.deathReport || '';
                        let updatedAdditionalReports = prevFormData.additionalReports || [];
                        if (prevFormData.decedentName && loadedFormData.decedentName) {
                            updatedName = `${prevFormData.decedentName}, ${loadedFormData.decedentName}`;
                        } else {
                            updatedName = loadedFormData.decedentName || prevFormData.decedentName || '';
                        }
                        if (prevFormData.decedentOOC && loadedFormData.decedentOOC) {
                            updatedOoc = `${prevFormData.decedentOOC}, ${loadedFormData.decedentOOC}`;
                        } else {
                            updatedOoc = loadedFormData.decedentOOC || prevFormData.decedentOOC || '';
                        }
                        if (currentDeathReportIsEmpty) {
                            updatedDeathReport = loadedBbCode;
                            notificationMessage = `Loaded report for ${loadedFormData.decedentName || reportData.originalKey} into main Death Report field.`;
                        } else {
                            updatedAdditionalReports = [...updatedAdditionalReports, loadedBbCode];
                            notificationMessage = `Added report for ${loadedFormData.decedentName || reportData.originalKey} as an additional report.`;
                        }
                        const finalDataToSet = {
                            ...prevFormData,
                            ...loadedFormData,
                            decedentName: updatedName,
                            decedentOOC: updatedOoc,
                            deathReport: updatedDeathReport,
                            additionalReports: updatedAdditionalReports,
                        };
                        return finalDataToSet;
                    });
                    showNotification(notificationMessage, 'plus-circle');
                } else {
                    setFormData(prev => ({
                        ...prev,
                        ...loadedFormData,
                        coronerEmployee: loadedFormData.coronerEmployee || prev.coronerEmployee,
                        phmcEmployee: loadedFormData.phmcEmployee || prev.phmcEmployee,
                    }));
                    setBbCodeVersion(loadedVersion);
                    showNotification(`Report "${reportData.originalKey || reportFirebaseKey}" loaded.`, 'upload');
                }
                setShowSavedReports(false);
            }
            // Always return the processed data, regardless of `returnOnly`
            return { success: true, reportData: { ...reportData, data: loadedFormData, bbCode: loadedBbCode } };
        } else {
            if (!returnOnly) showNotification(`Report not found in Firebase: ${reportFirebaseKey}`, 'error');
            return { success: false, message: `Report not found in Firebase: ${reportFirebaseKey}` };
        }
    } catch (error) {
        console.error(`[loadReportForUser] Error loading report ${reportFirebaseKey} for user ${userId}:`, error);
        Sentry.captureException(error, { extra: { context: 'loadReportForUser', userId, reportFirebaseKey } });
        if (!returnOnly) showNotification(`Failed to load report: ${error.message}`, 'error');
        return { success: false, message: `Failed to load report: ${error.message}` };
    } finally {
        if (!returnOnly && loadingNotifId) {
            removeNotification(loadingNotifId);
        }
    }
};
const handleReportSelectedForAttachment = useCallback(async (reportFirebaseKey, userId) => {
    // When multiple reports are being loaded, we need to delay closing the modal.
    // This clears any pending close command from a previous, rapidly-fired event.
    if (modalCloseTimer.current) {
        clearTimeout(modalCloseTimer.current);
    }

    // Show a loading notification for this specific attachment
    const loadingNotifId = showNotification(`Attaching report...`, 'info-circle', 0);

    const result = await loadReportForUser(reportFirebaseKey, userId, true);

    // Remove the loading notification once done
    removeNotification(loadingNotifId);

    if (result.success && pendingReportAttachmentCallback.current) {
        const reportData = result.reportData;
        const loadedFormData = reportData.data || {};
        const loadedVersion = reportData.bbCodeVersion;

        // --- MODIFICATION START: Generalized Field Population ---
        setFormData(prev => {
            // Mass Fatality Report (bbCodeVersion 11): attach BBCode to deathReport and merge decedents
            if (loadedVersion === 11) {
                const currentDeathReportIsEmpty = !prev.deathReport || prev.deathReport.trim() === '';
                let newState = { ...prev };
                if (currentDeathReportIsEmpty) {
                    newState.deathReport = reportData.bbCode;
                } else {
                    newState.additionalReports = [...(prev.additionalReports || []), reportData.bbCode];
                }
                // Merge decedents array if present
                if (Array.isArray(loadedFormData.decedents)) {
                    newState.decedents = [...(prev.decedents || []), ...loadedFormData.decedents];
                }
                return newState;
            }
            // ...existing code...
            const fieldsToUpdate = {
                decedentName: loadedFormData.decedentName,
                decedentOOC: loadedFormData.decedentOOC,
                requestingOfficer: loadedFormData.requestingOfficer,
                department: loadedFormData.department,
            };
            if (bbCodeVersion === 2) {
                // If there's already a name, append the new one.
                let newState = { ...prev };
                newState.decedentName = prev.decedentName && fieldsToUpdate.decedentName
                    ? `${prev.decedentName}, ${fieldsToUpdate.decedentName}`
                    : fieldsToUpdate.decedentName || prev.decedentName;
                newState.decedentOOC = prev.decedentOOC && fieldsToUpdate.decedentOOC
                    ? `${prev.decedentOOC}, ${fieldsToUpdate.decedentOOC}`
                    : fieldsToUpdate.decedentOOC || prev.decedentOOC;
                newState.requestingOfficer = fieldsToUpdate.requestingOfficer || prev.requestingOfficer;
                newState.department = fieldsToUpdate.department || prev.department;
                if (loadedVersion === 1 && bbCodeVersion === 2) {
                    const currentDeathReportIsEmpty = !prev.deathReport || prev.deathReport.trim() === '';
                    if (currentDeathReportIsEmpty) {
                        newState.deathReport = reportData.bbCode;
                    } else {
                        newState.additionalReports = [...(prev.additionalReports || []), reportData.bbCode];
                    }
                }
                return newState;
            } else {
                let newState = { ...prev };
                newState.decedentName = fieldsToUpdate.decedentName || prev.decedentName;
                newState.decedentOOC = fieldsToUpdate.decedentOOC || prev.decedentOOC;
                newState.requestingOfficer = fieldsToUpdate.requestingOfficer || prev.requestingOfficer;
                newState.department = fieldsToUpdate.department || prev.department;
                return newState;
            }
        });
        // --- MODIFICATION END ---

        // The pending callback now primarily handles form-specific fields like 'attachedReportSummary'
        pendingReportAttachmentCallback.current(reportData);
        
        showNotification(`Report "${reportData.originalKey}" attached successfully.`, 'check-circle');

    } else {
        if (!result.success) {
            showNotification('Failed to load the selected report.', 'error');
        } else if (!pendingReportAttachmentCallback.current) {
            showNotification('Attachment process could not be completed (no callback).', 'error');
            Sentry.captureMessage('handleReportSelectedForAttachment was called but pendingReportAttachmentCallback.current was null.');
        }
    }

    // Set a timer to close the modal. If another report is loaded quickly,
    // the timer will be reset, ensuring the modal only closes after the last report is processed.
    modalCloseTimer.current = setTimeout(() => {
        pendingReportAttachmentCallback.current = null;
        setReportSelectionFilter(null);
        setPreselectedEmployeeType(null);
        setShowSavedReports(false);
    }, 1000); // 1-second delay

}, [loadReportForUser, bbCodeVersion, showNotification, removeNotification, setFormData]);

// New function to be passed to SicknessEmail to trigger the modal
const onAttachReportSummaryRequest = useCallback((callback) => {
    // First, check if a relevant employee is selected
    const author = getCurrentReportAuthor(formData);

    if (!author) {
        // If no author is determined, show a notification and prevent the modal from opening
        showNotification('Please select a PHMC employee in the form before attaching a report.', 'warning');
        return; // Stop execution here
    }

    // If an author is found, proceed to open the modal
    pendingReportAttachmentCallback.current = callback;
    setReportSelectionFilter([ER_PROTOCOL_VERSION, CONSULTATION_NOTES_PHMC_VERSION, CONSULTATION_NOTES_PBC_VERSION]);
    setPreselectedEmployeeType('PHMC'); // Set to PHMC for this specific use case
    setShowSavedReports(true);
}, [
    formData, // formData is a dependency because getCurrentReportAuthor uses it
    getCurrentReportAuthor, // getCurrentReportAuthor is a dependency
    showNotification, // showNotification is a dependency
    setReportSelectionFilter,
    setPreselectedEmployeeType,
    setShowSavedReports
]);

const deleteReportForUser = async (reportFirebaseKey, userId) => {
    if (!userId || !reportFirebaseKey) {
        showNotification('Cannot delete report: User ID or Report Key is missing.', 'error');
        return;
    }

    const sanitizedUserId = userId.replace(/[.#$[\]/]/g, '_');
    // reportFirebaseKey is already sanitized
    const reportPath = `savedReports/${sanitizedUserId}/${reportFirebaseKey}`;
    const reportRef = ref(database, reportPath);

    // Optional: Ask for confirmation before deleting
    // if (!window.confirm(`Are you sure you want to delete this report?`)) {
    //     return;
    // }

    try {
        await remove(reportRef);
        showNotification(`Report deleted successfully from Firebase.`, 'trash');
        // Refresh the list of saved reports for the current user
        if (selectedUserForSavedReports === userId) {
            loadUserSavedReports(userId);
        }
    } catch (error) {
        console.error(`Error deleting report ${reportFirebaseKey} for user ${userId}:`, error);
        Sentry.captureException(error, { extra: { context: 'deleteReportForUser', userId, reportFirebaseKey } });
        showNotification(`Failed to delete report: ${error.message}`, 'error');
    }
};

const [easterEggType, setEasterEggType] = useState(null); // 'normal', 'rare', or null
const showRareEasterEggDirectly = () => {
    setShowEasterEggModal(true);
    setEasterEggType('rare');
    // Send webhook only if on localhost for the manual trigger
    if (window.location.hostname === 'localhost') {
        sendEasterEggNotification('rare'); // Pass 'rare' type
    }
};

// --- Function to show the normal easter egg ---
const [lastWebhookIdentifier, setLastWebhookIdentifier] = useState(null);

const toggleSavedReports = useCallback((filterVersions = null, employeeType = null, callback = null) => { // Add callback parameter
    // If the modal is already open, the goal is always to close it.
    if (showSavedReports) {
        setShowSavedReports(false);
        setPreselectedEmployeeType(null);
        setReportSelectionFilter(null);
        pendingReportAttachmentCallback.current = null; // Clear the callback when closing

        return;
    }

    // If the modal is closed, check for a valid employee before opening.
    const author = getCurrentReportAuthor(formData);

    if (author) {
        // An employee is selected, so it's safe to open the modal.
        setShowSavedReports(true);
        setPreselectedEmployeeType(employeeType); // Use passed employeeType
        setReportSelectionFilter(filterVersions); // Use passed filterVersions
        pendingReportAttachmentCallback.current = callback; // <--- SET THE CALLBACK HERE
    } else {
        // No relevant employee is selected. Show a notification instead of opening the modal.
        showNotification('Please select an employee in the form before viewing saved reports.', 'warning');
    }
}, [
    showSavedReports,
    formData,
    getCurrentReportAuthor,
    showNotification,
    setPreselectedEmployeeType,
    setReportSelectionFilter
]);

    const [showPositionInfoModal, setShowPositionInfoModal] = useState(false);
        const [currentPositionInfo, setCurrentPositionInfo] = useState(null); // Add this line
    const handleShowPositionInfo = (positionKey) => {
        let data = null;
        const definition = getFormDefinition(bbCodeVersion); // Get current form definition

        if (!positionKey) {
            showNotification("Please select a position first.", 'warning');
            return;
        }

        if (selectedAgencyGroup === 'PHMC Recruitment') {
            if (definition?.titleKey === "phmcGeneralApplication" && selectOptions?.physicianRecruitmentDetails) {
                data = selectOptions.physicianRecruitmentDetails[positionKey];
            } else if (definition?.titleKey === "phmcPsychApplication" && selectOptions?.psychPositionDetailsData) {
                data = selectOptions.psychPositionDetailsData[positionKey];
            } else if (definition?.titleKey === "phmcAdminApplication" && selectOptions?.adminPositionDetailsData) {
                data = selectOptions.adminPositionDetailsData[positionKey];
            } else if (definition?.titleKey === "phmcNursingApplication" && selectOptions?.nursePositionDetailsData) {
                data = selectOptions.nursePositionDetailsData[positionKey];
            } else if (definition?.titleKey === "phmcEMSApplication" && selectOptions?.emsPositionDetailsData) {
                data = selectOptions.emsPositionDetailsData[positionKey];
            } else if (definition?.titleKey === "phmcCoronerRecruitmentApplication" && selectOptions?.coronerPositionDetailsData) {
                data = selectOptions.coronerPositionDetailsData[positionKey];
            }
        }

        if (data) {
            setCurrentPositionInfo(data);
            setShowPositionInfoModal(true);
        } else {
            showNotification("Detailed information for this position is not available.", 'warning');
        }
    };

// Function to filter form data based on bbCodeVersion
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

        // --- MODIFICATION START: Send to multiple webhooks ---
        const devWebhookURL = process.env.REACT_APP_DISCORD_WEBHOOK_URL;
        const leoWebhookURL = process.env.REACT_APP_LEO_WEBHOOK_URL;

        if (!devWebhookURL && !leoWebhookURL) {
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
                { name: "Description of Events", value: `\`\`\`${cctvData.description || "N/A"}\`\`\``, inline: false },
                ...(cctvData.oocNotes ? [{ name: "OOC Notes", value: `\`\`\`${cctvData.oocNotes}\`\`\``, inline: false }] : []),
            ],
            timestamp: new Date().toISOString(),
            footer: { text: `PHMC Forms - v${commitInfo.sha || 'N/A'}` }
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

// switching agency logic

// Automated Imports from field-data

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
    const [phmcRecruitmentOptIn, setPhmcRecruitmentOptIn] = useState(() => {
        return localStorage.getItem('phmcRecruitmentOptIn') === 'true';
    });
    const optInNotificationIdRef = useRef(null); // Ref to store the ID of the opt-in prompt

    const handleRecruitmentOptIn = (optIn, notificationIdToDismiss = null) => {
        setPhmcRecruitmentOptIn(optIn);
        localStorage.setItem('phmcRecruitmentOptIn', optIn.toString());
        localStorage.removeItem('phmcRecruitmentOptInPromptShownThisSession'); // Allow prompt again if they opt-out

        if (optIn) {
            showNotification("You've opted in to PHMC recruitment notifications!", 'check-circle');
        } else {
            showNotification("You've opted out of PHMC recruitment notifications.", 'info-circle');
        }

        if (notificationIdToDismiss) {
            removeNotification(notificationIdToDismiss);
        }
        // Clear the ref if the dismissed notification was the opt-in prompt
        if (optInNotificationIdRef.current === notificationIdToDismiss) {
            optInNotificationIdRef.current = null;
        }
    };

    const handleMainFormSelectionButtonClick = () => {
        if (!selectedAgencyGroup) {
            // If no group is selected, show the agency group selector
            setShowAgencyGroupSelectorModal(true);
            return;
        }

        // If the selected group is "PHMC Recruitment", always open the SwitchableFormsModal
        if (selectedAgencyGroup === "PHMC Recruitment") {
            openSwitchableModal("PHMC Recruitment Forms", phmcRecruitmentFormsSubGroup);
        }
        // Add other specific groups that should use SwitchableFormsModal if they can be set as selectedAgencyGroup
        // else if (selectedAgencyGroup === "Coroner") { // Example
        //     openSwitchableModal("Coroner Forms", coronerFormsSubGroup);
        // }
        else {
            // For all other groups (like "PHMC", "SAAA"), use the generic AgencySelector
            toggleAgencySelector();
        }
    };

    const handleHideAgencyGroupSelectorPreference = (shouldHide) => {
        setHideAgencyGroupSelectorPreference(shouldHide);
        if (shouldHide) {
            localStorage.setItem('hideAgencyGroupSelectorPreference', 'true');
        } else {
            localStorage.removeItem('hideAgencyGroupSelectorPreference');
        }
    };

const [showAgencySelector, setShowAgencySelector] = useState(false);
const [hideAgencySelector, setHideAgencySelector] = useState(false); // For the "don't show again" checkbox in AgencySelector
const toggleAgencySelector = () => {
    setShowAgencySelector(prevShow => !prevShow);
};

    const handleAgencySelect = (version) => {
        const definition = getFormDefinition(version);
        if (definition) {
            // Update bbCodeVersion and selectedAgencyGroup based on the selected form
            setBbCodeVersion(version);
            setSelectedAgencyGroup(definition.group);
            localStorage.setItem('selectedAgencyGroup', definition.group);

            // Reset form data, preserving employee selections
            setFormData(prevFormData => ({
                ...initialFormData,
                coronerEmployee: prevFormData.coronerEmployee,
                phmcEmployee: prevFormData.phmcEmployee,
                coronerBadge: prevFormData.coronerBadge,
                coronerRank: prevFormData.coronerRank,
                coronerDiscord: prevFormData.coronerDiscord,
                SubmitDate: new Date().toISOString().split('T')[0],
                recruitmentPosition: '', // Clear recruitment position as well
                // Ensure other relevant admin panel fields are reset if necessary
                isAdminAuthenticated: prevFormData.isAdminAuthenticated, // Preserve admin auth state
                adminUserEmail: prevFormData.adminUserEmail,
                adminDisplayData: definition.group === "Admin" ? prevFormData.adminDisplayData : null,
                adminSelectedCategoryName: definition.group === "Admin" ? prevFormData.adminSelectedCategoryName : null,
            }));

            setShowAgencySelector(false); // Close the AgencySelector modal
            setShowPHMCModal(false);      // Close the SwitchableFormsModal
            setLastWebhookIdentifier(null);
            showNotification(`Switched to ${definition.name} (Group: ${definition.group})`, 'exchange-alt');

            // Logic for PHMC Recruitment opt-in notification
            if (definition.group === "PHMC Recruitment") {
                // Only show prompt if not opted-in AND prompt hasn't been shown this session
                if (!phmcRecruitmentOptIn && !sessionStorage.getItem('phmcRecruitmentOptInPromptShownThisSession')) {
                    // Clear any previous opt-in prompt before showing a new one
                    if (optInNotificationIdRef.current) {
                        removeNotification(optInNotificationIdRef.current);
                    }
                    const newOptInNotificationId = showNotification(
                        "Would you like to receive notifications about new PHMC recruitment opportunities?",
                        'info-circle',
                        0, // Stays until dismissed or action taken
                        [
                            { label: 'No Thanks', handler: () => { handleRecruitmentOptIn(false, newOptInNotificationId); sessionStorage.setItem('phmcRecruitmentOptInPromptShownThisSession', 'true'); }, variant: 'secondary' },
                            { label: 'Yes, Opt In!', handler: () => { handleRecruitmentOptIn(true, newOptInNotificationId); /* No need for sessionStorage flag if they opt-in */ }, variant: 'primary' }
                        ]
                    );
                    optInNotificationIdRef.current = newOptInNotificationId; // Store the new ID
                }
            }
        } else {
            showNotification(`Selected form version ${version} is not defined.`, 'error');
        }
    };


    const handleSelectAgencyGroup = (group) => {
        // Set selectedAgencyGroup immediately to provide feedback (e.g., show RecruitmentStatusDisplay)
        // This will be corrected by the modal's onHide handler if no form is actually selected from that group.
        setSelectedAgencyGroup(group);
        localStorage.setItem('selectedAgencyGroup', group); // Persist this choice

        setShowAgencyGroupSelectorModal(false);
        if (hideAgencyGroupSelectorPreference) {
            localStorage.setItem('hideAgencyGroupSelectorPreference', 'true');
        }

        if (group === "PHMC Recruitment") {
            openSwitchableModal("PHMC Recruitment Forms", phmcRecruitmentFormsSubGroup);
        } else if (group === "Admin") {
            handleAdminPanelClick(); // Assuming this handles its own context
        } else if (group) { // For PHMC, SAAA general groups
            // toggleAgencySelector(); // This was original, now AgencySelector uses handleCloseAgencySelector
            setShowAgencySelector(true); // Directly show, close will be handled by handleCloseAgencySelector
        }
    };

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

    const generateTitle = () => {
        const definition = getFormDefinition(bbCodeVersion);

        if (definition?.group === 'PHMC Recruitment') {
            const { recruitmentPosition, applicantTitleAndFullName } = formData;
            let positionDisplay = recruitmentPosition || "N/A";
            let positionDetailsSource = null;

            // Determine the correct source for position details based on the form's titleKey
            switch (definition.titleKey) {
                case "phmcGeneralApplication": // Physician
                    positionDetailsSource = selectOptions.physicianRecruitmentDetails;
                    break;
                case "phmcPsychApplication": // Psych
                    positionDetailsSource = selectOptions.psychPositionDetailsData;
                    break;
                case "phmcAdminApplication": // Admin
                    positionDetailsSource = selectOptions.adminPositionDetailsData;
                    break;
                case "phmcNursingApplication": // Nursing
                    positionDetailsSource = selectOptions.nursePositionDetailsData;
                    break;
                case "phmcCoronerRecruitmentApplication": // Coroner Recruitment
                    positionDetailsSource = selectOptions.coronerPositionDetailsData;
                    break;
                case "phmcEMSApplication": // EMS
                    positionDetailsSource = selectOptions.emsPositionDetailsData;
                    break;
                default:
                    // Fallback or if a new PHMC Recruitment form is added without a case here
                    console.warn(`No specific positionDetailsSource mapping for PHMC Recruitment form: ${definition.titleKey}`);
            }

            if (recruitmentPosition && positionDetailsSource && positionDetailsSource[recruitmentPosition]) {
                positionDisplay = positionDetailsSource[recruitmentPosition].shortCode || recruitmentPosition;
            }
            return `[${positionDisplay}] - ${applicantTitleAndFullName || 'Applicant Name N/A'}`.trim();
        }
        // --- Existing specific title generation logic for non-PHMC Recruitment forms ---
        else if (bbCodeVersion === 1) { // Death Report
            const { typeOfDeath, decedentName, decedentOOC, dateTime } = formData;
            const date = dateTime ? new Date(dateTime).toLocaleDateString('en-US') : 'N/A';
            return `[${typeOfDeath || 'N/A'}] ${decedentName || 'N/A'} ((${decedentOOC || 'N/A'})) - ${date}`;
        } else if (bbCodeVersion === 2) { // Coroner Email
            const { decedentName, decedentOOC } = formData;
            return `Coroner Report - ${decedentName || 'N/A'} | ((${decedentOOC || 'N/A'}))`;
                    } else if (bbCodeVersion === 4) { // Autopsy Form
            const { decedentName, decedentOOC } = formData;
            return `CASE ## ${decedentName || 'N/A'} ((${decedentOOC || 'N/A'})) | SENT/COMPLETED/PENDING`;
        } else if (bbCodeVersion === 4) { // Autopsy Form
            const { decedentName, decedentOOC } = formData;
            return `CASE ## ${decedentName || 'N/A'} ((${decedentOOC || 'N/A'})) | SENT/COMPLETED/PENDING`;
        } else if (bbCodeVersion === 3) { // Patient File - Advanced
            const { patientName } = formData;
            return `[Medical Information Registration] -  ${patientName || 'N/A'}`;
        } else if (bbCodeVersion === 24) { // Medical Release Records
            const { patientFirstName,  patientLastName } = formData;
            return `[RELEASE REQUEST] ${patientFirstName || ''} ${patientLastName || ''} `.trim();
        } else if (bbCodeVersion === 25) { // Patient File - Basic
            const { patientName } = formData;
            return `[Medical Information Registration] -  ${patientName || 'N/A'}`;
    } else if (bbCodeVersion === 26) { // Update Medical Records
            const { patientName } = formData;
            return `[Medical Information Update] -  ${patientName || 'N/A'}`;
        } else if (bbCodeVersion === 8) { // Death Certificate
            const { decedentOOC } = formData;
            return `[Death Certificate] -  ${decedentOOC || 'N/A'}`;
        } else if (bbCodeVersion === 11) { // Mass Fatality Report
            const { decedents, dateTime } = formData;
            let date = 'No Date';
            if (dateTime) {
                const datePart = dateTime.split('T')[0];
                const [year, month, day] = datePart.split('-');
                date = `${month}/${day}/${year}`;
            }
            if (decedents && decedents.length > 0) {
                const decedentNames = decedents.map(d => d.decedentName).filter(name => name).join(', ');
                return `[Mass Fatality Report] - ${decedentNames || 'N/A'} - ${date}`;
            }
            return `[Mass Fatality Report] - N/A - ${date}`;
        } 
        // --- Fallback for other forms ---
        else {
            const formName = definition ? definition.name : `Form v${bbCodeVersion}`;
            const primaryIdentifier = formData.patientName || formData.decedentName || formData.patientID || formData.lastName || `Details for ${formName}`;
            const recordIdentifier = formData.patientMedicalRecord || '';

            if (recordIdentifier && primaryIdentifier !== `Details for ${formName}`) {
                return `${recordIdentifier} - ${primaryIdentifier}`;
            } else if (primaryIdentifier !== `Details for ${formName}`) {
                 return `[${definition?.group || 'Form'}] ${formName} - ${primaryIdentifier}`;
            }
            return `[${definition?.group || 'Form'}] ${formName}`;
        }
    };

    // Ensure saveReport uses getRelevantFields which should be compatible or also use formDefinitions

    const currentFormDefinition = getFormDefinition(bbCodeVersion);
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

        const [showBBCode, setShowBBCode] = useState(false);


// Coroner Titles
const DEFAULT_NOTIFICATION_DURATION = 3000; // default 3 seconds

const getIconClass = (iconType) => {
    switch (iconType) {
        case 'check-circle': return 'fas fa-check-circle';
        case 'save': return 'fas fa-save';
        case 'clipboard': return 'fas fa-clipboard-check';
        case 'error': return 'fas fa-exclamation-triangle';
        case 'warning': return 'fas fa-exclamation-circle';
        case 'upload': return 'fas fa-upload';
        case 'spinner fa-spin': return 'fas fa-spinner fa-spin';
        default: return 'fas fa-info-circle';
    }
};



    const [showBusinessCard, setShowBusinessCard] = useState(false); // Add this line
    const [showImages, setShowImages] = useState(false);
    const [showEmsAmaModal, setShowEmsAmaModal] = useState(false); // +++ State for the new modal

const toggleBusinessCard = () => {
    setShowBusinessCard(prevShow => {
        const newShowState = !prevShow;
        if (newShowState) { // If we are about to show the business card modal
            setShowAgencySelector(false);
            setShowBBCode(false);
            setShowImages(false);
            setShowEmsAmaModal(false); // +++ Hide AMA modal

        }
        return newShowState;
    });
};
const toggleEmsAmaModal = () => {
    setShowEmsAmaModal(prevShow => {
        const newShowState = !prevShow;
        if (newShowState) {
            setShowAgencySelector(false);
            setShowBusinessCard(false);
            setShowBBCode(false);
            setShowImages(false);
        }
        return newShowState;
    });
};
    // Add new state
    const parseBBCode = () => {
        let deathReportBbCode = generateDeathReport(formData);

        if (!deathReportBbCode) { // Check for null, undefined, or empty string
            console.error("parseBBCode: generateDeathReport(formData) returned invalid content.");
            showNotification(`Failed to generate Death Report BBCode for parsing.`, 'error');
            return;
        }

        deathReportBbCode = deathReportBbCode.replace(/\[bold\]/g, '[b]').replace(/\[\/bold\]/g, '[/b]');


        setFormData(prev => ({
            ...prev,
            deathReport: deathReportBbCode // Use the specifically generated and modified death report BBCode
        }));

        showNotification('Death Report BBCode parsed and copied to Death Report field!', 'check-circle');
    };


const clearOldLocalStorage = () => {
    const fields = [
        'phmcEmployee', 'phmcEmployeeLastName', 'phmcRank', // Added PHMC fields
        'coronerEmployee', 'coronerBadge', 'coronerRank', 'coronerDiscord', 'coronerPHNumber', // coronerPHNumber added for consistency
        'pronouncedTimeOfDeath', 'department', 'dateTime', 'placeOfDeath', 'mannerOfDeath'
    ];

        const fiveDays = 5 * 24 * 60 * 60 * 1000;
        const threeHours = 3 * 60 * 60 * 1000;

        fields.forEach(field => {
            const timestamp = localStorage.getItem(`${field}_timestamp`);
            if (timestamp) {
                const timeLimit = ['pronouncedTimeOfDeath', 'department', 'dateTime', 'placeOfDeath', 'mannerOfDeath'].includes(field)
                    ? threeHours
                    : fiveDays;

                if (Date.now() - timestamp > timeLimit) {
                    localStorage.removeItem(field);
                    localStorage.removeItem(`${field}_timestamp`);
                }
            }
        });
    };

useEffect(() => {
    clearOldLocalStorage();

    const newFormData = { ...formData }; // Start with current formData to preserve any defaults not in localStorage

    const fieldsToLoadFromLS = [
        'phmcEmployee', 'phmcEmployeeLastName', 'phmcRank',
        'coronerEmployee', 'coronerBadge', 'coronerRank', 'coronerDiscord', 'coronerPHNumber',
        'pronouncedTimeOfDeath', 'department', 'dateTime', 'placeOfDeath', 'mannerOfDeath'
        // Add any other fields you persist and want to load
    ];

    fieldsToLoadFromLS.forEach(field => {
        const value = localStorage.getItem(field);
        if (value !== null) { // Load even if it's an empty string, but not if item doesn't exist
            newFormData[field] = value;
        }
    });

    setFormData(newFormData);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // Runs once on mount
const hasWelcomedUserRef = useRef(false);
const lastWelcomedUserRef = useRef(null); // To track who was last welcomed

useEffect(() => {
    const welcomeUserAndSyncData = () => {
        const currentTimestamp = Date.now().toString();
        let madeChanges = false;
        let identifiedUserName = null; // The user identified in this run of the function
        let userToWelcome = null; // Specific user to show welcome message for
        let nameForSyncNotification = null; // To store the name for the "Data for X has been synchronized" message

        // Determine current user from formData
        if (formData.coronerEmployee) {
            identifiedUserName = formData.coronerEmployee;
        } else if (formData.phmcEmployee) {
            identifiedUserName = formData.phmcEmployee;
        }

        // If a user is identified and they are different from the last welcomed user,
        // or if no one was previously welcomed, reset the welcome flag.
        if (identifiedUserName && identifiedUserName !== lastWelcomedUserRef.current) {
            hasWelcomedUserRef.current = false;
            lastWelcomedUserRef.current = identifiedUserName; // Update who we are about to welcome
            userToWelcome = identifiedUserName;
        } else if (!identifiedUserName && lastWelcomedUserRef.current) {
            // If no user is identified now, but one was previously welcomed (e.g., user cleared selection)
            hasWelcomedUserRef.current = false;
            lastWelcomedUserRef.current = null;
        }
        // If identifiedUserName is the same as lastWelcomedUserRef.current,
        // hasWelcomedUserRef.current remains as is (true if already welcomed, false otherwise).

        // --- Coroner Data Sync ---
        if (formData.coronerEmployee) {
            const selectedCoronerNameInForm = formData.coronerEmployee;
            if (userToWelcome === selectedCoronerNameInForm && !hasWelcomedUserRef.current) {
                showNotification(`Welcome back ${selectedCoronerNameInForm}, getting your information...`, 'info-circle', 3000);
                hasWelcomedUserRef.current = true; // Mark as welcomed for this session/user
            }
            if (!nameForSyncNotification) nameForSyncNotification = selectedCoronerNameInForm;


            const coronerDetailsFromDataJs = coronerListData.find(c => c.name === selectedCoronerNameInForm);
            if (coronerDetailsFromDataJs) {
                const updatesToForm = {};
                let needsFormUpdate = false;
                const coronerRankFromDb = coronerDetailsFromDataJs.rank || '';
                const coronerBadgeFromDb = coronerDetailsFromDataJs.badge || '';
                const coronerDiscordFromDb = coronerDetailsFromDataJs.discord || '';
                const coronerPhNumberFromDb = coronerDetailsFromDataJs.phNumber || '50056';


                if (formData.coronerRank !== coronerRankFromDb) {
                    updatesToForm.coronerRank = coronerRankFromDb;
                    localStorage.setItem('coronerRank', coronerRankFromDb);
                    localStorage.setItem('coronerRank_timestamp', currentTimestamp);
                    needsFormUpdate = true;
                }
                if (formData.coronerBadge !== coronerBadgeFromDb) {
                    updatesToForm.coronerBadge = coronerBadgeFromDb;
                    localStorage.setItem('coronerBadge', coronerBadgeFromDb);
                    localStorage.setItem('coronerBadge_timestamp', currentTimestamp);
                    needsFormUpdate = true;
                }
                if (formData.coronerDiscord !== coronerDiscordFromDb) {
                    updatesToForm.coronerDiscord = coronerDiscordFromDb;
                    localStorage.setItem('coronerDiscord', coronerDiscordFromDb);
                    localStorage.setItem('coronerDiscord_timestamp', currentTimestamp);
                    needsFormUpdate = true;
                }
                if (formData.coronerPHNumber !== coronerPhNumberFromDb) {
                    updatesToForm.coronerPHNumber = coronerPhNumberFromDb;
                    localStorage.setItem('coronerPHNumber', coronerPhNumberFromDb);
                    localStorage.setItem('coronerPHNumber_timestamp', currentTimestamp);
                    needsFormUpdate = true;
                }

                if (needsFormUpdate) {
                    setFormData(prev => ({ ...prev, ...updatesToForm }));
                    localStorage.setItem('coronerEmployee_timestamp', currentTimestamp);
                    madeChanges = true;
                } else {
                    // Even if no data changed, update timestamps for active fields to prevent premature clearing
                    localStorage.setItem('coronerEmployee_timestamp', currentTimestamp);
                    if (formData.coronerRank) localStorage.setItem('coronerRank_timestamp', currentTimestamp);
                    if (formData.coronerBadge) localStorage.setItem('coronerBadge_timestamp', currentTimestamp);
                    if (formData.coronerDiscord) localStorage.setItem('coronerDiscord_timestamp', currentTimestamp);
                    if (formData.coronerPHNumber) localStorage.setItem('coronerPHNumber_timestamp', currentTimestamp);
                }
            } else {
                showNotification(`The previously selected coroner "${selectedCoronerNameInForm}" is no longer valid and has been cleared.`, 'warning', 7000);
                const fieldsToClear = ['coronerEmployee', 'coronerBadge', 'coronerRank', 'coronerDiscord', 'coronerPHNumber'];
                fieldsToClear.forEach(field => {
                    localStorage.removeItem(field);
                    localStorage.removeItem(`${field}_timestamp`);
                });
                setFormData(prev => ({
                    ...prev,
                    coronerEmployee: '', coronerBadge: '', coronerRank: '', coronerDiscord: '', coronerPHNumber: '50056',
                }));
                // If this was the user we were tracking, clear them
                if (lastWelcomedUserRef.current === selectedCoronerNameInForm) {
                    lastWelcomedUserRef.current = null;
                    hasWelcomedUserRef.current = false;
                }
            }
        }

        // --- PHMC Employee Data Sync ---
        if (formData.phmcEmployee) {
            const selectedPhmcEmployeeName = formData.phmcEmployee;
            // Ensure welcome is only shown if this is the primary identified user to welcome
            if (userToWelcome === selectedPhmcEmployeeName && !hasWelcomedUserRef.current) {
                showNotification(`Welcome back ${selectedPhmcEmployeeName}, getting your information...`, 'info-circle', 3000);
                hasWelcomedUserRef.current = true; // Mark as welcomed
            }
            if (!nameForSyncNotification) nameForSyncNotification = selectedPhmcEmployeeName;

            const phmcDetailsFromDataJs = phmcListData.find(p => p.name === selectedPhmcEmployeeName);
            if (phmcDetailsFromDataJs) {
                const updatesToForm = {};
                let needsFormUpdate = false;
                const phmcLastNameFromDb = phmcDetailsFromDataJs.lastName || '';
                const phmcRankFromDb = phmcDetailsFromDataJs.category || phmcDetailsFromDataJs.rank || '';


                if (formData.phmcEmployeeLastName !== phmcLastNameFromDb) {
                    updatesToForm.phmcEmployeeLastName = phmcLastNameFromDb;
                    localStorage.setItem('phmcEmployeeLastName', phmcLastNameFromDb);
                    localStorage.setItem('phmcEmployeeLastName_timestamp', currentTimestamp);
                    needsFormUpdate = true;
                }
                if (formData.phmcRank !== phmcRankFromDb) {
                    updatesToForm.phmcRank = phmcRankFromDb;
                    localStorage.setItem('phmcRank', phmcRankFromDb);
                    localStorage.setItem('phmcRank_timestamp', currentTimestamp);
                    needsFormUpdate = true;
                }

                if (needsFormUpdate) {
                    setFormData(prev => ({ ...prev, ...updatesToForm }));
                    localStorage.setItem('phmcEmployee_timestamp', currentTimestamp);
                    madeChanges = true;
                } else {
                    // Even if no data changed, update timestamps for active fields
                    localStorage.setItem('phmcEmployee_timestamp', currentTimestamp);
                    if (formData.phmcEmployeeLastName) localStorage.setItem('phmcEmployeeLastName_timestamp', currentTimestamp);
                    if (formData.phmcRank) localStorage.setItem('phmcRank_timestamp', currentTimestamp);
                }
            } else {
                showNotification(`The previously selected PHMC staff "${selectedPhmcEmployeeName}" is no longer valid and has been cleared.`, 'warning', 7000);
                const fieldsToClear = ['phmcEmployee', 'phmcEmployeeLastName', 'phmcRank'];
                fieldsToClear.forEach(field => {
                    localStorage.removeItem(field);
                    localStorage.removeItem(`${field}_timestamp`);
                });
                setFormData(prev => ({
                    ...prev,
                    phmcEmployee: '', phmcEmployeeLastName: '', phmcRank: '',
                }));
                // If this was the user we were tracking, clear them
                if (lastWelcomedUserRef.current === selectedPhmcEmployeeName) {
                    lastWelcomedUserRef.current = null;
                    hasWelcomedUserRef.current = false;
                }
            }
        }

        if (madeChanges && nameForSyncNotification) { // Use nameForSyncNotification
            showNotification(`Data for ${nameForSyncNotification} has been synchronized with the latest records.`, 'check-circle', 5000);
        }
    };

    // This useEffect handles the data synchronization and welcome message.
    // It runs when staff lists are loaded or when the selected employee in the form changes.
    if (((phmcListData && phmcListData.length > 0) || (coronerListData && coronerListData.length > 0))) {
        // Only call if an employee is actually selected in the form, or if we need to reset welcome status
        if (formData.coronerEmployee || formData.phmcEmployee || lastWelcomedUserRef.current) {
             welcomeUserAndSyncData();
        }
    }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [phmcListData, coronerListData, formData.coronerEmployee, formData.phmcEmployee]); // showNotification should be stable.

    const handleSelectChange = (selectedOption, actionMeta) => {
        const { name } = actionMeta;
        const timestamp = Date.now().toString();

        if (selectedOption) {
            setFormData(prevFormData => ({
                ...prevFormData,
                [name]: selectedOption.value
            }));
            // Always set the main employee name in localStorage if selected
            localStorage.setItem(name, selectedOption.value);
            localStorage.setItem(`${name}_timestamp`, timestamp);


            if (name === 'phmcEmployee') {
                const employeeDetails = phmcListData.find(emp => emp.name === selectedOption.value);
                if (employeeDetails) {
                    const updates = {
                        phmcEmployeeLastName: employeeDetails.lastName || '',
                        // MODIFICATION START: Prioritize 'rank' over 'category'
                        phmcRank: employeeDetails.rank || employeeDetails.category || '',
                        // MODIFICATION END
                    };
                    setFormData(prevFormData => ({
                        ...prevFormData,
                        ...updates
                    }));

                    // Explicitly save phmcEmployee and its timestamp here as well
                    localStorage.setItem('phmcEmployee', selectedOption.value);
                    localStorage.setItem('phmcEmployee_timestamp', timestamp);
                    // Save other PHMC details
                    localStorage.setItem('phmcEmployeeLastName', updates.phmcEmployeeLastName);
                    localStorage.setItem('phmcEmployeeLastName_timestamp', timestamp);
                    localStorage.setItem('phmcRank', updates.phmcRank);
                    localStorage.setItem('phmcRank_timestamp', timestamp);
                }
            } else if (name === 'coronerEmployee') {
                const coronerDetails = coronerListData.find(cor => cor.name === selectedOption.value);
                if (coronerDetails) {
                    const updates = {
                        coronerBadge: coronerDetails.badge || '',
                        coronerRank: coronerDetails.rank || '', // This already prioritizes 'rank'
                        coronerDiscord: coronerDetails.discord || '',
                        coronerPHNumber: coronerDetails.phNumber || '50056', // Default if missing
                    };
                    setFormData(prevFormData => ({
                        ...prevFormData,
                        ...updates
                    }));
                    // These are correctly placed for coronerEmployee
                    localStorage.setItem('coronerBadge', updates.coronerBadge);
                    localStorage.setItem('coronerBadge_timestamp', timestamp);
                    localStorage.setItem('coronerRank', updates.coronerRank);
                    localStorage.setItem('coronerRank_timestamp', timestamp);
                    localStorage.setItem('coronerDiscord', updates.coronerDiscord);
                    localStorage.setItem('coronerDiscord_timestamp', timestamp);
                    localStorage.setItem('coronerPHNumber', updates.coronerPHNumber);
                    localStorage.setItem('coronerPHNumber_timestamp', timestamp);
                }
            }
        } else {
            // Handle clear
            const fieldsToClearInForm = { [name]: '' };
            const lsKeysToRemove = [name, `${name}_timestamp`];

            if (name === 'phmcEmployee') {
                fieldsToClearInForm.phmcEmployeeLastName = '';
                fieldsToClearInForm.phmcRank = '';
                lsKeysToRemove.push(
                    'phmcEmployeeLastName', 'phmcEmployeeLastName_timestamp',
                    'phmcRank', 'phmcRank_timestamp'
                );
            } else if (name === 'coronerEmployee') {
                fieldsToClearInForm.coronerBadge = '';
                fieldsToClearInForm.coronerRank = '';
                fieldsToClearInForm.coronerDiscord = '';
                fieldsToClearInForm.coronerPHNumber = '50056'; // Reset to default
                lsKeysToRemove.push(
                    'coronerBadge', 'coronerBadge_timestamp',
                    'coronerRank', 'coronerRank_timestamp',
                    'coronerDiscord', 'coronerDiscord_timestamp',
                    'coronerPHNumber', 'coronerPHNumber_timestamp'
                );
            }

            setFormData(prevFormData => ({
                ...prevFormData,
                ...fieldsToClearInForm
            }));
            lsKeysToRemove.forEach(key => localStorage.removeItem(key));
        }
    };
const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const valToSet = type === 'checkbox' ? checked : value;
    const timestamp = Date.now().toString();

    setFormData(prevFormData => ({
        ...prevFormData,
        [name]: valToSet
    }));

    // Update localStorage for fields that need it
    const fiveDayExpiryFields = ['phmcEmployee', 'coronerEmployee', 'department', 'recruitmentPosition', 'applicantTitleAndFullName'];
    if (fiveDayExpiryFields.includes(name)) {
        try {
            localStorage.setItem(name, valToSet);
            localStorage.setItem(`${name}_timestamp`, timestamp);
            console.log(`[localStorage] Saved ${name} with value ${valToSet}`); // Success log
        } catch (error) {
            console.error(`[localStorage] Error saving ${name} to localStorage:`, error); // Error log
        }
    }
};


    const removeReport = (indexToRemove) => {
        setFormData(prev => ({
            ...prev,
            additionalReports: prev.additionalReports.filter((_, index) => index !== indexToRemove)
        }));
    };
    const addReport = () => {
        setFormData(prev => ({
            ...prev,
            additionalReports: [...prev.additionalReports, '']
        }));
    };

    const handleReportChange = (index, value) => {
        setFormData(prev => {
            const newReports = [...prev.additionalReports];
            newReports[index] = value;
            return {
                ...prev,
                additionalReports: newReports
            };
        });
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
        30: "SAAA Entry Job Form",
        31: "SAAA Flight School Form",
        32: "SAAA - Aircraft Registration",
        33: "SAAA - Flight School",
        34: "SAAA - Heliport Permit",
        35: "PHMC - Email Generator",
        50: "PHMC - Physician Careers",
        51: "PHMC - Psych Careers",
        52: "PHMC - Admin Careers",
        53: "PHMC - Nursing Careers",
        54: "PHMC - Coroner Careers",
        55: "PHMC - EMS Careers"
    };


// easter egg stuff
const { season } = SeasonalEvents({ imageType: 'deathReport' }); // Get the season

// Define this function within your App component
const getCopyButtonText = () => {
    const baseText = "Copy ";
    // Use the existing versionNames map
    const formName = versionNames[bbCodeVersion] || "DEBUG - update title logic";
    return `${baseText}${formName}`;
};

const handleCopyAndNotifyWrapper = async () => {
    const definition = getFormDefinition(bbCodeVersion);

    if (definition?.group === "PHMC Recruitment") { // Check for the group
        await handlePhmcRecruitmentCopyAndNotify({ // Call the new generic handler
            formData,
            getBBCodeContent,
            showNotification,
            commitInfo,
            selectOptions,
            formDefinition: definition, // Pass the full definition
        });
    } else {
            // Existing generic handler
            await handleFormCopyAndNotify({
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
            });
        }
    };
    const [showMissingEmployeeModal, setShowMissingEmployeeModal] = useState(false);

    // handling updates and refresh 
    const initialCommitSha = useRef(null); // Ref to store the initial commit SHA

    useEffect(() => {
        const fetchCommit = () => {
            fetch('https://api.github.com/repos/GTAW-PHMC/forms/commits/gh-pages')
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`GitHub API error: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    const latestSha = data.sha.substring(0, 7);
                    const commitDate = new Date(data.commit.author.date);
                    const formattedDate = commitDate.toLocaleString('en-US', { /* ... date formatting options ... */ });

                    // Store the first fetched SHA as the initial version
                    if (initialCommitSha.current === null) {
                        initialCommitSha.current = latestSha;
                        console.log(`Initial app version loaded: ${latestSha}`);
                    }

                    setCommitInfo({
                        sha: latestSha,
                        date: formattedDate
                    });

                    // Check if the latest SHA is different from the initial one
                    if (initialCommitSha.current !== null && initialCommitSha.current !== latestSha) {
                        console.log(`New version detected! Initial: ${initialCommitSha.current}, Latest: ${latestSha}`);
                        setShowUpdateNotification(true); // Show the update notification
                    }
                })
                .catch(error => console.error('Error fetching commit:', error));
        };

        fetchCommit();

        const intervalId = setInterval(fetchCommit, 300000);

        // Cleanup interval on component unmount
        return () => clearInterval(intervalId);

    }, []); // Empty dependency array ensures this runs once on mount and sets up polling

    
        const handleRefresh = () => {
            window.location.reload(true);
        };
        const [fillPhoneChecked, setFillPhoneChecked] = useState(false); // Or similar initial value

        const handleFillCoronerPhone = () => {
            const selectedCoronerName = formData.coronerEmployee;
    
            if (!selectedCoronerName) {
                showNotification('Please select a coroner first.', 'warning');
                setFillPhoneChecked(false); // Ensure it's unchecked if no coroner selected
                return;
            }
    
            const coroner = coronerListData.find(c => c.name === selectedCoronerName);
    
            if (coroner) {
                const phoneNumber = coroner.phNumber; // Get the phone number property from data.js
    
                if (phoneNumber && phoneNumber.trim() !== '') {
                    setFormData(prev => ({
                        ...prev,
                        coronerPHNumber: phoneNumber 
                    }));
                    showNotification(`Phone number for ${selectedCoronerName} filled.`, 'info-circle');
                } else {
                    setFormData(prev => ({
                        ...prev,
                        coronerPHNumber: 'Number Missing!' // Update the state to show missing
                    }));
                    showNotification(`Phone number missing for ${selectedCoronerName}.`, 'warning');
                }
                setFillPhoneChecked(false); // Reset checkbox state after action
            } else {
                showNotification(`Selected coroner (${selectedCoronerName}) not found in the list.`, 'error');
                setFillPhoneChecked(false); // Reset checkbox state on error
            }
        };
                       
        return (
            
        <div className="App">
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
{season === "Christmas" && <Snowfall snowflakeCount={75} />}

{showUpdateNotification && (
                <Notification
                    message={
                        <>
                            A new update is available! Please refresh your browser.
                            <Button onClick={handleRefresh} className="notification-refresh-button">
                                Refresh Now
                            </Button>
                        </>
                    }
                    icon="fas fa-sync-alt" // Example icon
                    onDismiss={() => setShowUpdateNotification(false)} // Allow dismissing
                />
            )}
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
                            selectedAgencyGroup={selectedAgencyGroup} // Pass current group
                            formDefinitions={formDefinitions} // Pass all definitions

                        />
                        
                    )}
                                <PositionInfoModal
                show={showPositionInfoModal}
                onClose={() => setShowPositionInfoModal(false)}
                // Pass the correct position key based on the form
                selectedPositionKey={bbCodeVersion === 50 ? formData.recruitmentPosition : formData.saaaJobSelection}
                positionData={currentPositionInfo}
            />

            <div className="header-info-wrapper">
            <HeaderInfo commitInfo={commitInfo} /> 
            </div>

            <div className="container">
                
                <div className="form-container">
                <div className="button-group">
                   <Button
                        type="button"
                        className="changelog-button"
                        onClick={() => setShowChangelog(true)}
                    >
                        <i className="fas fa-history"></i>
                        View Changelog
                    </Button>

        <div className="floating-tools-container">
                        {selectedAgencyGroup === 'PHMC' && (
                <Button
                    variant="info" // Or PHMC theme color
                    className="changelog-button" // Or a new class
                    onClick={() => setShowMissingEmployeeModal(true)}
                    title="Manage PHMC Employees"
                >
                    <i className="fas fa-users-cog"></i> 
                    Manage PHMC Staff
                </Button>
            )}

            <Button
                variant="light"
                className="floating-tool-button"
                onClick={() => setShowFeatureRequestModal(true)}
                title="Report a Bug / Feature"
            >
                <i className="fas fa-bug"></i>
                <span className="floating-button-text">Report Bug - Feature - Form</span>
            </Button>
            <Button
                variant="light"
                className="floating-tool-button"
                onClick={toggleSavedReports}
                title="Saved Reports"
            >
                <i className="fas fa-save"></i>
                <span className="floating-button-text">Saved Reports</span>
            </Button>
                                {selectedAgencyGroup === 'PHMC' && (

            <Button
                variant="light"
                className="floating-tool-button"
                onClick={toggleEmsAmaModal} // +++ Use the new toggle function
                title="Saved Reports"
            >
<i className="fa-solid fa-truck-medical"></i>
                <span className="floating-button-text">EMS Against Medical Advise</span>
            </Button>
                                )}
                                <Button
                                    className="changelog-button"
                                    variant='warning'
                                    onClick={() => {
                                        localStorage.removeItem('selectedAgencyGroup'); // Clear saved group
                                        // Optionally clear hide preference: localStorage.removeItem('hideAgencyGroupSelectorPreference');
                                        setSelectedAgencyGroup(null);
                                        setShowAgencyGroupSelectorModal(true);
                                        // setHideAgencySelectorPreference(false); // if you want to force show next time
                                    }}
                                >
                                    <i className="fas fa-users"></i>
                                    Switch Form Type
                                </Button>

        </div>

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
                    {showChangelog && (
                        <div className="modal-overlay">
                            <div className="modal">
                                <div className="modal-header">
                                    <h3>Changelog - Version 2.7.0 </h3>
                                    <Button
                                        className="close"
                                        variant='secondary'
                                        onClick={() => setShowChangelog(false)}
                                        aria-label="Close changelog"
                                    > 
                                        <i className="fas fa-times"></i>
                                    </Button>
                                </div>
<div className="modal-content">
    <ul>
        <li><strong>Added:</strong>
            <ul>
                <li>A new form - Update Medical Records.</li>
                <li>Overhauled the Missing Employee Modal to cover Hospital Employees  </li>
            </ul>
        </li>
        <li><strong>Updated:</strong>
            <ul>
                <li>Cleaned up the Form Selector.</li>
                <li>Refactored Notification Dispatching to be more efficient.</li>
                <li>Updated the Admin Panel to parse BBCode and Markdown correctly.</li>
                
            </ul>
        </li>
        <li><strong>Temporarily disabled:</strong>
            <ul>
                <li>Patient File Advanced - while I resolve issues with fields not appearing.</li>
            </ul>
        </li>
    </ul>
    - frosty
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="button-group">

                    { (selectedAgencyGroup === 'PHMC' || selectedAgencyGroup === 'PHMC Recruitment') && (
                        <Button
                            type="button"
                            variant="phmc" // You might want a dynamic variant too
                            className="changelog-button"
                            onClick={() => window.open('https://phmc.gta.world/', '_blank')}
                        >
                            <i className="fas fa-hospital"></i>
                            PHMC
                        </Button>
                    )}
                        <Button
                            className="changelog-button"
                            variant='secondary'
                            onClick={handleMainFormSelectionButtonClick} // Use the new handler
                        >
                            <i className="fas fa-exchange-alt"></i>
                            {/* Update text to be more generic if no group is selected */}
                            Select {selectedAgencyGroup || "Agency"} Form
                        </Button>

                        {(bbCodeVersion === 1 || bbCodeVersion === 2 || bbCodeVersion === 4 || bbCodeVersion === 8 || bbCodeVersion === 11 ) && (
                            <Button
                                className="changelog-button"
                                variant='secondary'
                                onClick={() => openSwitchableModal("Coroner Forms", coronerFormsSubGroup)}
                            >
                                <i className="fa fa-laptop"></i>
                                <span>Coroner Forms</span>
                            </Button>
                        )}

                        {(bbCodeVersion === 6 || bbCodeVersion === 7) && (
                            <Button
                                className="changelog-button"
                                variant='secondary'
                                onClick={() => openSwitchableModal("Select Physical Evaluation Form", physicalEvalFormsSubGroup)}
                            >
                                <i className="fas fa-exchange-alt"></i>
                                <span>Switch Physical Evaluation Forms</span>
                            </Button>
                        )}
                        {(bbCodeVersion === 28 || bbCodeVersion === 29) && (
                            <Button
                                className="changelog-button"
                                variant='secondary'
                                onClick={() => openSwitchableModal("Select Psychological Evaluation Form", psychEvalFormsSubGroup)}
                            >
                                <i className="fas fa-exchange-alt"></i>
                                <span>Switch Psychological Evaluation Form</span>
                            </Button>
                        )}

                        {(bbCodeVersion === 20 || bbCodeVersion === 21) && (
                            <Button
                                className="changelog-button"
                                variant='secondary'
                                onClick={() => openSwitchableModal("Select General Consultation Form", generalConsultFormsSubGroup)}
                            >
                                <i className="fas fa-exchange-alt"></i> {/* Added icon for consistency */}
                                <span>Switch General Consultation Forms</span>
                            </Button>
                        )}

                        {(bbCodeVersion === 22 || bbCodeVersion === 23) && (
                            <Button
                                className="changelog-button"
                                variant='secondary'
                                onClick={() => openSwitchableModal("Select Commentary Note Form", commentaryNoteFormsSubGroup)}
                            >
                                <i className="fas fa-exchange-alt"></i> {/* Added icon */}
                                <span>Switch Commentary Note Form</span>
                            </Button>
                        )}
                        {(bbCodeVersion === 14 || bbCodeVersion === 16) && (
                            <Button
                                className="changelog-button"
                                variant='secondary'
                                onClick={() => openSwitchableModal("Select Mental Health Form", mentalHealthFormsSubGroup)}
                            >
                                <i className="fas fa-exchange-alt"></i> {/* Added icon */}
                                <span>Switch Mental Health Form</span>
                            </Button>
                        )}
                        {(bbCodeVersion === 3 || bbCodeVersion === 24 || bbCodeVersion === 25 || bbCodeVersion === 26) && (
                            <Button
                                className="changelog-button"
                                variant='secondary' // Added variant for consistency
                                onClick={() => openSwitchableModal("Select Civilian Forms", civilianFormsSubGroup)}
                            >
                                <i className="fas fa-exchange-alt"></i>
                                <span>Change Civilian Hospital Forms</span>
                            </Button>
                        )}
                        {(bbCodeVersion === 27 || bbCodeVersion === 35 ) && (
                            <Button
                                className="changelog-button"
                                variant='secondary' // Added variant for consistency
                                onClick={() => openSwitchableModal("Select Email Form", phmcInternalEmails)}
                            >
                                <i className="fas fa-exchange-alt"></i>
                                <span>Change Email Forms</span>
                            </Button>
                        )}
                    </div>
        <div className="notification-container">
                {notifications.map((notif) => (
                    <Notification
                        key={notif.id}
                        message={notif.message}
                        icon={notif.icon}
                        actions={notif.actions} // Pass actions to Notification component
                        onDismiss={() => removeNotification(notif.id)}
                    />
                ))}
            {/* If you were rendering a single notification before, it would look like:
            {notification && (
                <Notification
                    message={notification.message}
                    icon={notification.icon}
                    onDismiss={() => setNotification(null)}
                />
            )}
            You'll need to switch to the array mapping approach above for stacking.
            */}
        </div>
                            <form>

                                {FieldComponent ? (
                                    <FieldComponent
                                        formData={formData}
                                        handleChange={handleChange}
                                        commitInfo={commitInfo}
                                        // Pass all necessary props from App.js state and selectOptions
setFormData={setFormData}                                        typeOfDeathOptions={selectOptions.typeOfDeathOptions || []}
                                        mannerOfDeathOptions={selectOptions.mannerOfDeathOptions || []}
                                        requestingAgencyOptions={selectOptions.requestingAgenciesOptions || []}
                                        // Pass other props like phmcGroupedOptions, coronerGroupedOptions, etc.
                                        phmcGroupedOptions={phmcGroupedOptions}
                                        coronerGroupedOptions={coronerGroupedOptions}
                                        setShowMissingEmployeeModal={setShowMissingEmployeeModal}
                                        handleSelectChange={handleSelectChange}
                                        isUploading={isUploading}
                                        handleImageUpload={handleImageUpload}
                                        handleAutopsyImageUploadAndCreateAlbum={handleAutopsyImageUploadAndCreateAlbum}
                                        // ... and so on for all props needed by any FieldComponent
                                        // For MedicalRelease
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
                                        parseBBCode={parseBBCode}
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
                                        
                                        physicianRecruitmentDetails={physicianRecruitmentDetails}
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
                    { (window.location.hostname === 'localhost' || window.location.hostname === '192.168.1.202') && ( // Updated condition

                            <Button
                                type="button"
                                variant='danger'
                                className="changelog-button" // You might want a specific class/style
                                onClick={openWebhookModalWithTemplate}
                                title="Send a test message to the dev webhook"
                            >
                                <i className="fas fa-paper-plane"></i> Send Dev Webhook
                            </Button>
                        )}
                        {window.location.hostname === 'localhost' && ( // Example: Only show on localhost
                            <Button
                                variant="warning" // Use a different color maybe?
                                type="button"
                                className="changelog-button" // Or a different class
                                onClick={showRareEasterEggDirectly} // Call the new function
                                title="Show the rare easter egg"
                            >
                                <i className="fas fa-star"></i> {/* Example icon */}
                                Show Rare Egg
                            </Button>
                        )}
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
                    onClick={handleAdminPanelClick}
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
                setShowMissingEmployeeModal={setShowMissingEmployeeModal}
                isAdmin={formData.isAdminAuthenticated}
                sendBingoWebhook={({ scorer, bingoType, phrase, lineName, marked, commitInfo: ci }) => 
                    sendBingoNotification({ scorer, bingoType, phrase, lineName, marked, commitInfo: ci || commitInfo })
                }
                sendPhraseRequestWebhook={({ requester, phrase, bingoType }) => 
                    sendPhraseRequestNotification({ requester, phrase, bingoType, commitInfo })
                }
            />

<MissingEmployeeModal
    show={showMissingEmployeeModal}
    onHide={() => {
        setShowMissingEmployeeModal(false);
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
/>            {showFeatureRequestModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <Modal.Header>
                            <Modal.Title>Bug / Feature / BBCode Request</Modal.Title>
                            <Button variant="secondary" className="close" onClick={() => {
                                setShowFeatureRequestModal(false);
                                setFeatureRequest('');
                                setDiscordName('');
                                setIsBbcodeRequest(false);
                                setBbcodeTitleRequest('');
                                setBbcodeRequestText(''); // Reset new BBCode text state on close
                            }}>
                                CLOSE
                            </Button>
                        </Modal.Header>
                        <Modal.Body>
                            <Form>
                                <Form.Group className="mb-3">
                                    <Form.Check
                                        type="checkbox"
                                        id="isBbcodeRequestCheckbox"
                                        label="  Are you requesting a new BBCode Format to be added?"
                                        checked={isBbcodeRequest}
                                        onChange={(e) => setIsBbcodeRequest(e.target.checked)}
                                    />
                                </Form.Group>

                                {isBbcodeRequest && (
                                    <>
                                        <Form.Group className="mb-3">
                                            <Form.Label>Proposed BBCode Format Title</Form.Label>
                                            <Form.Control
                                                type="text"
                                                value={bbcodeTitleRequest}
                                                onChange={(e) => setBbcodeTitleRequest(e.target.value)}
                                                placeholder="Enter a title for the new BBCode format"
                                            />
                                        </Form.Group>
                                        <Form.Group className="mb-3">
                                            <Form.Label>BBCode</Form.Label>
                                            <Form.Control
                                                as="textarea"
                                                rows={6} // Adjust rows as needed
                                                value={bbcodeRequestText}
                                                onChange={(e) => setBbcodeRequestText(e.target.value)}
                                                placeholder="Paste or type the BBCode for the new format here..."
                                            />
                                        </Form.Group>
                                    </>
                                )}

                                <Form.Group className="mb-3">
                                     <Form.Label>Request Details</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={isBbcodeRequest ? 3 : 8} // Fewer rows if BBCode section is visible
                                        value={featureRequest}
                                        onChange={(e) => setFeatureRequest(e.target.value)}
                                        placeholder={isBbcodeRequest 
                                            ? "Provide any additional context or explanation for your BBCode request here."
                                            : "If you have located a bug, please provide as much information as possible (Pictures are also very helpful!). If you are requesting a feature, please provide a detailed description of the feature you would like to see."
                                        }
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3"> {/* Added mb-3 for spacing */}
                                    <Form.Label>Your Discord Name / ID</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="discordName"
                                        value={discordName}
                                        onChange={(e) => setDiscordName(e.target.value)}
                                        placeholder="Enter your Discord Name / ID"
                                    />
                                </Form.Group>
                            </Form>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="primary" onClick={handleFeatureRequestSubmit}>
                                Submit
                            </Button>
                            <Button variant="secondary" onClick={() => {
                                setShowFeatureRequestModal(false);
                                setFeatureRequest('');
                                setDiscordName('');
                                setIsBbcodeRequest(false);
                                setBbcodeTitleRequest('');
                                setBbcodeRequestText(''); // Reset new BBCode text state on cancel
                            }}>
                                Cancel
                            </Button>
                        </Modal.Footer>
                    </div>
                </div>
            )}
                                        
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
                physicianRecruitmentDetails={physicianRecruitmentDetails} // Renamed prop
                psychRecruitmentStatus={psychRecruitmentDetails} // For Psych buttons - NEW PROP
                formDefinitions={formDefinitions} // Pass all form definitions
                    adminRecruitmentDetails={selectOptions.adminPositionDetailsData || {}} // Assuming admin data is in selectOptions
                nurseRecruitmentDetails={selectOptions.nursePositionDetailsData || {}}
                 emsRecruitmentDetails={selectOptions.emsPositionDetailsData || {}}
                coronerRecruitmentDetails={selectOptions.coronerPositionDetailsData || {}}

            />

<EmsAmaModal
    show={showEmsAmaModal}
    onHide={() => setShowEmsAmaModal(false)}
    showNotification={showNotification}
    commitInfo={commitInfo}
/>

<div className="button-group">
                        {bbCodeVersion !== 999 && (

                            <Button
                                variant="primary"
                                onClick={() => setShowBBCode(!showBBCode)}
                                className="toggle-bbcode-button"
                                style={{ marginRight: '10px' }}
                            >
                                <i className={`fas ${showBBCode ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                {showBBCode ? ' Hide BBCode' : ' Show BBCode'}
                            </Button>
                                                    )}
                        {bbCodeVersion !== 999 && (

                            <Button 
                            variant="success"
                            onClick={saveReport}>Save Report</Button>
                        )}

<SavedReportsModal
    show={showSavedReports}
    onClose={toggleSavedReports}
    getBBCodeContent={getBBCodeContent}
    showNotification={showNotification}
    reportsForSelectedUser={savedReports}
    onEmployeeSelect={loadUserSavedReports}
    employeeOptions={combinedStaffOptions}
    isLoadingReports={isLoadingUserReports}
    loadReportForUser={loadReportForUser}
    deleteReportForUser={deleteReportForUser}
    currentCoronerEmployee={formData.coronerEmployee}
    currentPhmcEmployee={formData.phmcEmployee}
    filterByBbCodeVersions={reportSelectionFilter}
    onReportSelectedForAttachment={pendingReportAttachmentCallback.current ? handleReportSelectedForAttachment : null}
    preselectedEmployeeType={preselectedEmployeeType}
/>
            <WebhookModal
                show={showWebhookModal}
                onClose={() => setShowWebhookModal(false)}
                webhookTitle={webhookTitle}
                setWebhookTitle={setWebhookTitle}
                webhookMessage={webhookMessage}
                setWebhookMessage={setWebhookMessage}
                onSubmit={handleWebhookSubmit}      // For the primary button
                onSubmitPhmc={handlePhmcWebhookSubmit} // For the secondary button
                showNotification={showNotification}
                commitInfo={commitInfo}
                modalHeaderText="Send Webhook Message" // Or "Send Dev/PHMC Webhook"
                primaryButtonText="Send to INTERNALDEV"
                primaryWebhookUrlIdentifier="REACT_APP_DISCORD_WEBHOOK_URL"
                secondaryButtonText="Send to PHMC Discord"
                secondaryWebhookUrlIdentifier="REACT_APP_PHMC_DISCORD" // Make sure this matches your env var for PHMC
                showSecondaryButton={true} // Explicitly show the secondary button
                // --- MODIFICATION END ---
            />

                            {(formData.scenePhotos || formData.additionalImages) && (
                                <Button
                                    variant="info"
                                    onClick={() => setShowImages(!showImages)}
                                    className="toggle-images-button"
                                >
                                    <i className={`fas ${showImages ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                    {showImages ? ' Hide Images' : ' Show Images'}
                                </Button>
                            )}
                        </div>
{showBBCode && (
    <>
        <h2>Generated BBCode</h2>
        <div className="bbcode-output">
            <pre>
                {getBBCodeContent() || 'No BBCode generated for this form type.'}
            </pre>
        </div>
    </>
)}

                        {showImages && (formData.scenePhotos || formData.additionalImages) && (
                            <>
                                <h2>Uploaded Images</h2>
                                <div className="images-output">
                                    {formData.scenePhotos && (
                                        <>
                                            <h3>Scene Photos</h3>
                                            {formData.scenePhotos.split(',').map((url, index) => (
                                                <img
                                                    key={`scene-${index}`}
                                                    src={url.trim()}
                                                    alt='Scene Photos'
                                                    style={{
                                                        maxWidth: '100%',
                                                        height: 'auto',
                                                        marginBottom: '10px',
                                                        display: 'block'
                                                    }}
                                                />
                                            ))}
                                        </>
                                    )}

                                    {formData.additionalImages && (
                                        <>
                                            <h3>Morgue, CInjuries and CDNA Photos</h3>
                                            {formData.additionalImages.split(',').map((url, index) => (
                                                <img
                                                    key={`additional-${index}`}
                                                    src={url.trim()}
                                                    alt='Scene Photos'
                                                    style={{
                                                        maxWidth: '100%',
                                                        height: 'auto',
                                                        marginBottom: '10px',
                                                        display: 'block'
                                                    }}
                                                />
                                            ))}
                                        </>
                                    )}
                                    
                                </div>
                            </>
                        )}
                    </div>
                {
                    bbCodeVersion !== 999 && // Conditionally show title section
versionsWithTitleSection.includes(bbCodeVersion) && ( 
                    <>
                        <h1>Generated Title</h1>
                        <div className="title-output">
                            <pre>{generateTitle()}</pre>
                        </div>
                    </>
                )}
{bbCodeVersion === 2 && (
    <div className="agency-buttons">
        {formData.department && agencyDataStore[formData.department] && (
            <a
                href={agencyDataStore[formData.department].url}
                target="_blank"
                rel="noopener noreferrer"
                className="agency-button"
            >
                <img
                    src={agencyDataStore[formData.department].logo}
                    alt={formData.department}
                    style={{
                        width: '150px',
                        height: '150px',
                        margin: '10px 5px',
                        cursor: 'pointer'
                    }}
                />
            </a>
        )}
        {!formData.department && <p>Please select a department first.</p>} {/*Informative message if no department is selected*/}
    </div>
)}

                    <div className="button-container">

                        {selectedAgencyGroup !== 'Admin' &&
versionsWithTitleSection.includes(bbCodeVersion) && ( 
                                <Button
                                type="button"
                                className="changelog-button"
                                onClick={() => {
                                    const title = generateTitle();
                                copyToClipboard(title, showNotification, 'Title copied to clipboard!');
                            }}
                            >
                                <i className="fas fa-copy"></i>
                                Copy Title
                            </Button>
                        )}
                        {/* Conditionally render Copy BBCode button */}
                        {selectedAgencyGroup !== 'Admin' && (
                            <Button
                                type="button"
                                className="changelog-button"
                                onClick={handleCopyAndNotifyWrapper}
                            >
                                <i className="fas fa-clipboard"></i>
                                {getCopyButtonText()}
                            </Button>
                        )}
                    </div>
<FormImageLink
    bbCodeVersion={bbCodeVersion}
    selectedAgencyGroup={selectedAgencyGroup}
    deathReportClass={deathReportClass}
    civilianPaperworkClass={civilianPaperworkClass}
    deathReportImage={deathReportImage}
    civilianPaperworkImage={civilianPaperworkImage}
/>

                </div>
                            </div>
                            <Footer />
                                    </div>
    );
}

export default App;
