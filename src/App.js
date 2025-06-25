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
import EasterEggImages from './EasterEggParticles'; 
import * as Sentry from "@sentry/react";
import WebhookModal from './components/WebhookModal'; 
import CoronerRankModal from './components/CoronerRankModal'; 
import CoronerTipsModal from './components/CoronerTipsModal'; 
import BusinessCardModal from './components/BusinessCardModal'; 
import EasterEggModal from './components/EasterEggModal'; 
import EmsAmaModal from './components/EmsAmaModal';
import SwitchableFormsModal from './components/SwitchableFormsModal'; 
import MissingEmployeeModal from './components/MissingEmployeeModal';
import SaaaEmployeeModal from './saaa-components/SaaaEmployeeModal'; 
import RecruitmentStatusDisplay from './components/RecruitmentStatusDisplay'; // Add this import
// admin
import AdminModal from './components/Admin/AdminModal'; 
import FormImageLink from './components/FormImageLink';

// 
import { handleFormCopyAndNotify, handlePhmcRecruitmentCopyAndNotify } from './components/notificationService'; // Add the new import

import FlightSchoolTipsModal from './saaa-components/FlightSchoolTipsModal';
import saaaLogo from './assets/saaa-button.png'; 
import {
    generateDeathReport,
} from './phmc-bbcode-generators'; 
import PositionInfoModal from './components/PositionInfoModal'; // Adjust path as needed

// logos
import email from './assets/email.png'
import Civilian from './assets/Civilian.png'
import nurse from './assets/nurse.png'
import PHMCLogo from './assets/phmc.png'
import corpse from './assets/corpse.png'
import phmcpaletobay from './assets/phmcpaletobaylogo.png'
import './assets/fonts/Poppins-Medium.ttf';

// css fun
import './App.css';
import './buttons.css'

import 'react-bootstrap-typeahead/css/Typeahead.css';

// database
import { database } from './firebase'; // Your Firebase config
import { ref, get, set, remove} from 'firebase/database'; // Added set
import SaaaBusinessCardModal from './saaa-components/SaaaBusinessCardModal';

// Automated Imports from field-data
function App() {
    const [isMobile, setIsMobile] = useState(false);
    const modalCloseTimer = useRef(null);

const initialFormData = {
    coronerRank: 'Forensic Attendant',
    placeOfDeath: '',
    evidenceLockerID: '',
    evidenceLocker: '',
    department: '',
    dateTime: '',
    phmcEmployeeLastName: '',  
    serialNumber: '',
    decedentName: '',
    phmcEmployee: '', // This will be preserved in clearForm
    pronouncedTimeOfDeath: '',
    synopsis: '',
    probableCauseOfDeath: '',
    mannerOfDeath: '',
    typeOfDeath: '',
    coronerEmployee: '', // This will be preserved in clearForm
    MedicalRecordsRelease: [],
    payNow: false,
    paymentProofPhotos: '',
    PurposeMedicalInformationReleaseFormat: '',
    PurposeMedicalInformationRelease: '',
    lab: [''],
    extraStaff: [],
    decedentOOC: '',
    scenePhotos: '',
    patientMedInfoFormatOther: '',
    patientZIP: '',
    lastName: '', // This will be preserved in clearForm (related to phmcEmployee)
    bloodOxy: '',
    coronerBadge: '', // This will be preserved in clearForm
    additionalImages: '',
    requestingOfficer: '',
    coronerDiscord: '', // This will be preserved in clearForm
    coronerPHNumber: '50056',
    deathReport: '',
    additionalReports: [],
    showAdditionalReports: false,
    internalReport: '',
    internalAdditionalReports: '',
    policeNotification: '',
    treatmentLocation: '',
    moreDeathReports: [''],
    patientAllergies: '',
    surgeryComplications: '',
    surgeryProcedures: '',
    drugType: '',
    postDrugtype: '',
    surgicalSummery: '',
    surgeryTime: '',
    medicalComplications: '',
    treatmentProcedures: '',
    medType: '',
    postTreatment: '',
    medicalSummary: '',
    evalTime: '',
    patientPH: '',
    patientBPM: '',
    patientBMI: '',
    patientTemperature: '',
    patientCareer: '',
    patientHeight: '',
    patientWeight: '',
    patientpulse: '',
    patientOxi: '',
    patientImpairments: '',
    patientPastDiseases: '',
    patientAssessment: '',
    appointmentDate: '',
    PatientMedicalRecord: '',
    PatientName: '', // This is the one to keep if it's the primary patient name field
    patientChewing: '',
    patientPriority: '',
    patientMedicine: '',
    patientNewMedicine: '',
    patientTreatment: '',
    patientDiagnosis: '',
    patientPrescription: '',
    date: '',
    patientRace: '',
    race: '',
    patientMedicalRecord: '',
    patientGender: '',
    patientDateOfBirth: '',
    patientMedicalHistory: '',
    patientEmail: '',
    patientAddress: '',
    patientEmergencyContact: '',
    patientEmergencyContactNumber: '',
    patientEmergencyContactRelation: '',
    patientBloodType: '',
    patientChronicDiseases: '',
    patientBP: '',
    SubmitDate: new Date().toISOString().split('T')[0],
    patientResperation: '',
    patientConsultation: '',
    patientPerscription: '',
    patientCondition: '',
    patientNotes: '',
    patientBaggageofParents: '',
    oneFetus: false,
    twoFetuses: false,
    threeFetuses: false,
    fourFetuses: false,
    patientContractions: '',
    patientBleeding: '',
    patientDiscomfort: '',
    patientFatter: '',
    patientBabyGender: '',
        attachedReportSummary: '', // New field for the attached report BBCode
    patientKnowBabyGender: '',
    patientUltraSummary: '',
    patientWellWomanExam: '',
    patientInjuryMechanism: '',
    patientLastWellWomanExam: '',
    patientPapResults: '',
    patientSTI: '',
    patientSTIResults: '',
    patientBloodAnalysis: '',
    patientBloodAnalysisResults: '',
    patientUrine: '',
    patientUrineResults: '',
    patientPap: '',
    patientDateofPregnancy: '',
    patientFetalMeasurements: '',
    patientCurrentMedicine: '',
    patientAdditionalPregnancy: '',
    patientJobTasks: '',
    patientLivingHabits: '',
    patientPreHealth: '',
    patientPregProblems: '',
    patientPartnerName: '',
    patientPartnerPH: '',
    patientPartnerDiscord: '',
    caseOpen: false,
    caseClosed: false,
    violenceToSelf: false,
    violenceToOthers: false,
    LowRisk: false,
    noRisk: true,
    HighRisk: false,
    MediumRisk: false,
    patientFileCreation: '',
    patientVisitReason: '',
    patientSurgicalHistory: '',
    patientMedHistory: '',
    patientPsychDiagnoses: '',
    patientEvalFile: '',
    patientMedicalFile: '',
    patientSubstance: '',
    patientTrauma: ``,
    showRequestingOfficerInput: false,
    patientEdu: ``,
    patientDev: ``,
    patientLegal: ``,
    patientSpiritual: ``,
    patientMale: false,
    patientFemale: false,
    patientFormYes: false,
    patientFormNo: false,
    patientFormYes2: false,
    patientFormNo2: false,
    patientConsent: '',
    patientConsentOption: '',
    patientConsentNo: '',
    patientConsentYes: '',
    patientComplicationOptions: '',
    complications: '',
    patientComplaint: '',
    triageNoPain: false,
    triageNormalPain: false,
    triageMildPain: false,
    triageSeverePain: false,
    triageCriticalPain: false,
    patientTempNormal: false,
    patientTempHigh: false,
    patientTempLow: false,
    patientHeartRateNormal: false,
    patientHeartRateBradycardia: false,
    patientHeartRateTachycardia: false,
    patientBreathingNormal: false,
    patientBreathingSlow: false,
    patientBreathingFast: false,
    patientBreathingObstructed: false,
    patientBloodPressureNormal: false,
    patientBloodPressureHypotension: false,
    patientBloodPressureHypertension: false,
    assignedDepartment: '',
    departmentLarge: '',
    patientChiefComplaint: '',
    patientID: '',
    rank: '', 
    patientProcedure: '',
    patientPhoneType: '',
    patientPhoneMobile: '',
    patientPhoneHome: '',
    patientPhoneWork: '',
    patientPhoneOther: '',
    patientGenderMale: '',
    patientGenderFemale: '',
    PurposeAttorney: '',
    PurposePersonal: '',
    patientAdvise: '',
    drugList: '',
    PurposeFurtherCare  : '',
    PurposeOther: '',
    CarePurposeMedicalInformationRelease: '',
    patientMedInfoReleaseOther: '',
    MedicalRecordsReleaseOther: '',
    StupidDateFrom: '',
    StupidDateTo: '',
    patientFirstName: '',
    patientMiddleName: '',
    patientTitle: '',
    patientComplicationsYes: '',
    patientComplicationsNo: '',
    procedureGoodOptions: '',
    procedureGoodYes: '',
    procedureGoodNo: '',
    BodyMassIndex: '',
    phmcRank: '', 
    temperature: '',
    heartRate: '',
    bloodPressure: '',
    careerRisks: '',
    patientJob: '',
    patientcareerNo: '',
    patientAllergiesRisk: '',
    patientMedicineRegular: '',
    patientOther: '',
    predisposition: '',
    breathing: '',
    patientTherapy: '',
    patientFamily: '',
    patientGentic: '',
    patientFamSocial: '',
    patientMental: '',
    maritalStatus: '',
    numberChildren: '',
    financialStatus: '',
    dnr: '',
    dnrOrder: '',
    attorney: '',
    patientSupport: '',
    patientHarm: '',
    patientFam: '',
    patientGenetic: '',
    patientReligion: '',
    patientSmoker: '',
    patientAlcohol: '',
    patientDrugs: '',
    patientExercise: '',
    patientDiet: '',
    patientSleep: '',
    patientSexLife: '',
    patientJobRisks: '',
    patientHazards: '',
    attorneyName: '',
    attorneyPH: '',
    attorneyRelation: '',
    dnrOther: '',
    patientEmergencyContactDiscord: '',
    patientSecondaryDiagnosis: '',
    patientTriggers: '',
    patientStress: '',
    patientSymptoms: '',
    patientDrugsUsage: '',
    patientTreatmentMedicine: '',
    patientSafety: '',
    patientFollowUp: '',
    patientTreatmentPlan: '',
    patientRelationship: '',
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
    admission: '',
    followup: '',
    sono: '',
    pupils: '',
    lungs: '',
    painLevel: '',
    wounds: '',
    findings: '',
    patientFindings:'',
    paletoClinicDepartment: '',
    ecg: '',
    autopsyDeathCauses: [''],
    autopsyAnatomicSummaryItems: [''],
    autopsyAlbumUrl: '',
    autopsyPhotosUnavailable: false,
    autopsyDate: '',
    autopsyTime: '',
    externalExamination: '',
        patientContactNumber: '',
    patientDOB: '',
    patientBirth: '',
    healthImpairments: '',
    healthStandingIssues: '',
    eduHighSchoolName: '',
    eduHighSchoolYear: '',
    eduCollegeName: '',
    eduCollegeYear: '',
    eduCollegeDegree: '',
    empGovExperience: '',
    empPrev1Name: '',
    empPrev1Period: '',
    empPrev1Rank: '',
    empPrev1Reason: '',
    empPrev2Name: '',
    empPrev2Period: '',
    empPrev2Rank: '',
    empPrev2Reason: '',
    licCitizenship: '',
    licPilotLicense: '',
    oocUcpName: '',
    oocDiscord: '',
    oocForumName: '',
    oocTimezone: '',
    oocGtawPlaytime: '',
    oocEnglishProficiency: '',
    oocOtherFactionInfo: '',
    oocFactionBans: '',
    oocOtherCharacters: '',
    charBackground: '',
    ackAuthorize: false, // For the checkbox
    Imaging: [],
    XrayResults: [],
    ctResults: [],
    mriResults: [],
    ultrasoundResults: [],
    recruitmentPosition: '',
    applicantTitleAndFullName: '',
    genderMale: false,
    genderFemale: false,
    genderOther: false,
    applicantGenderOtherText: '',
    applicantDOBAndPlace: '',
    applicantAddress: '',
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
    oocMedicalExperience: '',
    oocAdminRecordLink: '',
    oocStatsLink: '',
    saaaJobSelection: '',
    emailPurpose: '',
    emailRecipient: '',
    patientName: '', // This is the primary patient name field

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

    const [saaaFormCompletionNotified, setSaaaFormCompletionNotified] = useState(false);

    const [showFlightSchoolTipsModal, setShowFlightSchoolTipsModal] = useState(false);

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
        setParsedBBCode('');
        setLastWebhookIdentifier(null);
        showNotification('Form cleared! Employee selections preserved.', 'check-circle');
    };
  const ER_PROTOCOL_VERSION = 19;
 const CONSULTATION_NOTES_PHMC_VERSION = 20;
 const CONSULTATION_NOTES_PBC_VERSION = 21;

    const [showSaaaEmployeeModal, setShowSaaaEmployeeModal] = useState(false);
    const [saaaListData, setSaaaListData] = useState([]); // To store SAAA staff list

    useEffect(() => {
        let isMounted = true;
        let loadingNotificationId = null;

        const fetchData = async () => {
            if (!isMounted) return;
            setIsLoadingData(true);
            loadingNotificationId = showNotification(
                "Loading data, please wait!",
                'spinner fa-spin',
                0 // Indefinite
            );

            try {
                const dbRootRef = ref(database);
                const snapshot = await get(dbRootRef);

                if (loadingNotificationId && isMounted) {
                    removeNotification(loadingNotificationId);
                    loadingNotificationId = null;
                }

                if (!isMounted) return;

                if (snapshot.exists()) {
                    const allData = snapshot.val();
                    setPhmcListData(allData.staff?.phmc || []);
                    setCoronerListData(allData.staff?.coroner || []);
                    setSaaaListData(allData.staff?.saaa || []);
                    setAgencyDataStore(allData.agencies || {});
                    const fetchedSelectOptions = allData.selectOptions || {};
                    setSelectOptions(fetchedSelectOptions);
                    
                    setPhysicianRecruitmentDetails(fetchedSelectOptions.physicianRecruitmentDetails || {});
                    setPsychRecruitmentDetails(fetchedSelectOptions.psychPositionDetailsData || {}); // New
                    setSaaaRecruitmentDetails(fetchedSelectOptions.saaaPositionDetailsData || {});

                    showNotification('Data loaded successfully!', 'check-circle');
                } else {
                    showNotification('Initial application data not found on server.', 'error');
                    setPhmcListData([]);
                    setCoronerListData([]);
                    setSaaaListData([]);
                    setAgencyDataStore({});
                    setSelectOptions({});
                    setPhysicianRecruitmentDetails({});
                    setSaaaRecruitmentStatus({});
                    setPhysicianRecruitmentDetails({});
                    setPsychRecruitmentDetails({});
                    setSaaaRecruitmentDetails({});

                }
            } catch (error) {
                if (isMounted) {
                    if (loadingNotificationId) {
                        removeNotification(loadingNotificationId);
                        loadingNotificationId = null;
                    }
                    console.error("Error fetching data from Realtime Database:", error);
                    Sentry.captureException(error, { extra: { context: 'Firebase Data Fetch' } });
                    showNotification('Failed to load initial application data. Please try again later.', 'error');
                    setPhysicianRecruitmentDetails({});
                    setSaaaRecruitmentStatus({}); // Clear SAAA status on error
                }
            } finally {
                if (isMounted) {
                    setIsLoadingData(false);
                    if (loadingNotificationId) {
                        removeNotification(loadingNotificationId);
                    }
                }
            }
        };

        fetchData();

        return () => {
            isMounted = false;
            if (loadingNotificationId) {
                removeNotification(loadingNotificationId);
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showNotification, removeNotification]);
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

    const [isLoadingData, setIsLoadingData] = useState(true); // Assuming you have this state
    const [showAgencyGroupSelectorModal, setShowAgencyGroupSelectorModal] = useState(false);
    const [hideAgencyGroupSelectorPreference, setHideAgencyGroupSelectorPreference] = useState(false);
    const [physicianRecruitmentDetails, setPhysicianRecruitmentDetails] = useState({});
    const [psychRecruitmentDetails, setPsychRecruitmentDetails] = useState({}); // New
    const [saaaRecruitmentDetails, setSaaaRecruitmentDetails] = useState({});
    const [adminRecruitmentDetails, setAdminRecruitmentDetails] = useState({});
    const [emsRecruitmentDetails, setEmsRecruitmentDetails] = useState({});
    const [nurseRecruitmentDetails, setNurseRecruitmentDetails] = useState({});
    const [coronerRecruitmentDetails, setCoronerRecruitmentDetails] = useState({});
    const loadingNotificationIdRef = useRef(null);

    const fetchAllApplicationData = useCallback(async (isInitialLoad = false) => {
        if (isInitialLoad) {
            setIsLoadingData(true);
            if (loadingNotificationIdRef.current) {
                removeNotification(loadingNotificationIdRef.current);
            }
            loadingNotificationIdRef.current = showNotification(
                "Loading application data...",
                'spinner fa-spin',
                0 // Indefinite
            );
        } else {
            showNotification("Refreshing recruitment data...", 'sync-alt', 2000);
        }

        try {
            const dbRootRef = ref(database);
            const snapshot = await get(dbRootRef);

            if (isInitialLoad && loadingNotificationIdRef.current) {
                removeNotification(loadingNotificationIdRef.current);
                loadingNotificationIdRef.current = null;
            }

            if (snapshot.exists()) {
                const allData = snapshot.val();
                setPhmcListData(allData.staff?.phmc || []);
                setCoronerListData(allData.staff?.coroner || []);
                setSaaaListData(allData.staff?.saaa || []);
                setAgencyDataStore(allData.agencies || {});

                const fetchedSelectOptions = allData.selectOptions || {};
                setSelectOptions(fetchedSelectOptions);

                // Update states that RecruitmentStatusDisplay depends on
                setPhysicianRecruitmentDetails(fetchedSelectOptions.physicianRecruitmentDetails || {});
                setPsychRecruitmentDetails(fetchedSelectOptions.psychPositionDetailsData || {});
                setSaaaRecruitmentDetails(fetchedSelectOptions.saaaPositionDetailsData || {});
                // Update new states
                setAdminRecruitmentDetails(fetchedSelectOptions.adminPositionDetailsData || {});
                setEmsRecruitmentDetails(fetchedSelectOptions.emsPositionDetailsData || {});
                setNurseRecruitmentDetails(fetchedSelectOptions.nursePositionDetailsData || {});
                setCoronerRecruitmentDetails(fetchedSelectOptions.coronerPositionDetailsData || {});


                if (isInitialLoad) {
                    showNotification('Application data loaded successfully!', 'check-circle');
                }
            } else {
                showNotification('Initial application data not found on server.', 'error');
                // Reset all relevant states
                setPhmcListData([]); setCoronerListData([]); setSaaaListData([]);
                setAgencyDataStore({}); setSelectOptions({});
                setPhysicianRecruitmentDetails({}); setPsychRecruitmentDetails({}); setSaaaRecruitmentDetails({});
                // Reset new states
                setAdminRecruitmentDetails({}); setEmsRecruitmentDetails({}); setNurseRecruitmentDetails({}); setCoronerRecruitmentDetails({});
            }
        } catch (error) {
            console.error("Error fetching data from Realtime Database:", error);
            Sentry.captureException(error, { extra: { context: 'Firebase Data Fetch (fetchAllApplicationData)' } });
            if (isInitialLoad && loadingNotificationIdRef.current) {
                removeNotification(loadingNotificationIdRef.current);
                loadingNotificationIdRef.current = null;
            }
            showNotification('Failed to load application data. Please try again later.', 'error');
        } finally {
            if (isInitialLoad) {
                setIsLoadingData(false);
                if (loadingNotificationIdRef.current) {
                    removeNotification(loadingNotificationIdRef.current);
                    loadingNotificationIdRef.current = null;
                }
            }
        }
    }, [
        showNotification, removeNotification, setIsLoadingData,
        setPhmcListData, setCoronerListData, setSaaaListData, setAgencyDataStore,
        setSelectOptions, setPhysicianRecruitmentDetails, setPsychRecruitmentDetails, setSaaaRecruitmentDetails,
        // Add new state setters to dependency array
        setAdminRecruitmentDetails, setEmsRecruitmentDetails, setNurseRecruitmentDetails, setCoronerRecruitmentDetails
    ]);

    useEffect(() => {
        fetchAllApplicationData(true);
    }, [fetchAllApplicationData]);

    const saaaGroupedOptions = useMemo(() => {
        if (!saaaListData || saaaListData.length === 0) return [];
        // Assuming SAAA staff have 'name' and 'rank' properties
        // You might want to group them by rank or have a single group
        return [{
            label: 'SAAA Employees',
            options: saaaListData.map(emp => ({
                value: emp.name, // Or a unique ID
                label: `${emp.name} (${emp.rank || 'N/A'})`
            })).sort((a, b) => a.label.localeCompare(b.label))
        }];
    }, [saaaListData]);
    const handleSaaaEmployeeSubmit = async (isAddMode, saaaData) => {
        const webhookURL = process.env.REACT_APP_SAAA_DISCORD_WEBHOOK_URL || process.env.REACT_APP_DISCORD_WEBHOOK_URL; // Use SAAA specific or fallback
        const { employeeName, employeeRank, employeePhoneNumber, requester, staffToRemove, authorizedBy } = saaaData;

        if (!webhookURL) {
            showNotification('Configuration error: SAAA Webhook URL missing.', 'exclamation-triangle');
            Sentry.captureMessage('SAAA Webhook URL missing for employee management.', 'error');
            return;
        }

        let embedData = {};
        let requestActionTitle = '';
        let firebaseUpdateSuccessful = false;

        if (isAddMode) {
            requestActionTitle = '➕ New SAAA Employee Addition Request';
            // Adjust validation: requester is only required if there are SAAA employees to select from
            if (!employeeName?.trim() || !employeeRank?.trim() || (saaaListData.length > 0 && !requester?.trim())) {
                let missingFieldsMsg = 'Please fill in Employee Name and Rank.';
                if (saaaListData.length > 0 && !requester?.trim()) {
                    missingFieldsMsg = 'Please fill in Employee Name, Rank, and Requester for adding SAAA staff.';
                }
                showNotification(missingFieldsMsg, 'warning');
                return;
            }
            embedData = {
                title: requestActionTitle,
                color: 0x007bff, // SAAA theme color (e.g., blue)
                fields: [
                    // Conditionally add requester field
                    ...(requester?.trim() ? [{ name: "Requested By", value: requester, inline: false }] : [{ name: "Requested By", value: "N/A (No SAAA staff in system)", inline: false }]),
                    { name: "Name to Add", value: employeeName, inline: true },
                    { name: "Rank/Position", value: employeeRank, inline: true },
                    ...(employeePhoneNumber?.trim() ? [{ name: "Phone Number", value: employeePhoneNumber, inline: true }] : []),
                ],
                timestamp: new Date().toISOString(),
                footer: { text: `Submitted via Forms Tool - v${commitInfo.sha || 'N/A'}` }
            };

            // Firebase Add Logic
            const newSaaaEmployee = {
                name: employeeName.trim(),
                rank: employeeRank.trim(),
                phoneNumber: employeePhoneNumber?.trim() || '',
            };
            try {
                const saaaListRef = ref(database, 'staff/saaa');
                const snapshot = await get(saaaListRef);
                const currentSaaaStaff = snapshot.exists() ? snapshot.val() : [];
                if (!currentSaaaStaff.find(s => s.name === newSaaaEmployee.name)) {
                    const updatedSaaaStaff = [...currentSaaaStaff, newSaaaEmployee];
                    await set(saaaListRef, updatedSaaaStaff);
                    setSaaaListData(updatedSaaaStaff); // Update local state
                    firebaseUpdateSuccessful = true;
                } else {
                    showNotification(`SAAA Employee ${newSaaaEmployee.name} already exists.`, 'warning');
                    return; 
                }
            } catch (dbError) {
                console.error("Error adding SAAA employee to Firebase:", dbError);
                Sentry.captureException(dbError, { extra: { context: 'Firebase Add SAAA Employee' } });
                showNotification('Failed to update SAAA database.', 'error');
                return; 
            }

        } else { // Remove Mode
            requestActionTitle = '➖ SAAA Staff Removal Request';
            // For remove mode, if saaaListData is empty, staffToRemove will also be empty.
            // The existing validation for staffToRemove and authorizedBy should still apply.
            if (!staffToRemove || staffToRemove.length === 0) {
                showNotification('Please select at least one SAAA staff member to remove.', 'warning');
                return;
            }
            if (!authorizedBy?.trim()) {
                showNotification('Please enter your name in the "Authorized By" field.', 'warning');
                return;
            }
            embedData = {
                title: requestActionTitle,
                color: 0xdc3545, 
                fields: [
                    { name: "Authorized By", value: authorizedBy, inline: false },
                    { name: `Staff to Remove (${staffToRemove.length})`, value: staffToRemove.join('\n') || "None selected", inline: false },
                ],
                timestamp: new Date().toISOString(),
                footer: { text: `Submitted via Forms Tool - v${commitInfo.sha || 'N/A'}` }
            };

            // Firebase Remove Logic
            try {
                const saaaListRef = ref(database, 'staff/saaa');
                const snapshot = await get(saaaListRef);
                let currentSaaaStaff = snapshot.exists() ? snapshot.val() : [];
                const initialCount = currentSaaaStaff.length;
                currentSaaaStaff = currentSaaaStaff.filter(s => !staffToRemove.includes(s.name));
                if (currentSaaaStaff.length < initialCount) {
                    await set(saaaListRef, currentSaaaStaff);
                    setSaaaListData(currentSaaaStaff); 
                    firebaseUpdateSuccessful = true;
                } else {
                    showNotification('No matching SAAA staff found in database to remove.', 'warning');
                    return; 
                }
            } catch (dbError) {
                console.error("Error removing SAAA staff from Firebase:", dbError);
                Sentry.captureException(dbError, { extra: { context: 'Firebase Remove SAAA Staff' } });
                showNotification('Failed to update SAAA database for removal.', 'error');
                return; 
            }
        }

        if (firebaseUpdateSuccessful || (!isAddMode && staffToRemove.length > 0 && authorizedBy?.trim())) {
            try {
                const response = await fetch(webhookURL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: `New SAAA Employee Management Request: ${requestActionTitle}`,
                        embeds: [embedData]
                    }),
                });
                if (!response.ok) {
                    console.error(`Failed to send SAAA employee management webhook. Status: ${response.status}`);
                    Sentry.captureMessage(`SAAA Discord webhook failed: ${response.status}`, { level: 'error' });
                    showNotification(`Database updated, but failed to send Discord notification. Status: ${response.status}`, 'warning');
                } else {
                    showNotification(`SAAA Employee request processed and notification sent!`, 'check-circle');
                }
            } catch (error) {
                console.error('Error sending SAAA employee management webhook:', error);
                Sentry.captureException(error, { extra: { context: 'SAAA Employee Webhook Submission' } });
                showNotification('Database updated, but a network error occurred sending Discord notification.', 'warning');
            }
        }
        
        setShowSaaaEmployeeModal(false);
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
            } else if (definition.group === "SAAA") { // SAAA Forms
                // saaaRecruitmentDetails is a dedicated state variable
                specificPositionData = saaaRecruitmentDetails || {};
            }
            // Add other conditions for other groups if they need specific data passed this way

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
    useEffect(() => {
        const fetchData = async () => {
            setIsLoadingData(true);
            // Show indefinite loading notification
            loadingNotificationIdRef.current = showNotification(
                "Loading data, please wait!",
                'spinner fa-spin', // Font Awesome spinner icon with spin animation
                0 // Indefinite duration
            );

            try {
                const dbRootRef = ref(database);
                const snapshot = await get(dbRootRef);

                // Remove loading notification once data attempt is complete (before specific success/error)
                if (loadingNotificationIdRef.current) {
                    removeNotification(loadingNotificationIdRef.current);
                    loadingNotificationIdRef.current = null;
                }

                if (snapshot.exists()) {
                    const allData = snapshot.val();
                    console.log("Data fetched from Realtime DB:", allData);

                    setPhmcListData(allData.staff?.phmc || []);
                    setCoronerListData(allData.staff?.coroner || []);
                    setAgencyDataStore(allData.agencies || {});
                    setSelectOptions(allData.selectOptions || {});
                } else {
                    console.warn("No data available in Realtime Database.");
                    showNotification('Initial application data not found on server.', 'error');
                    setPhmcListData([]);
                    setCoronerListData([]);
                    setAgencyDataStore({});
                    setSelectOptions({});
                }
            } catch (error) {
                console.error("Error fetching data from Realtime Database:", error);
                Sentry.captureException(error, { extra: { context: 'Firebase Data Fetch' }});
                // Ensure loading notification is removed even if an error occurs before it's naturally removed
                if (loadingNotificationIdRef.current) {
                    removeNotification(loadingNotificationIdRef.current);
                    loadingNotificationIdRef.current = null;
                }
                showNotification('Failed to load initial application data. Please try again later.', 'error');
            } finally {
                setIsLoadingData(false);
                // Ensure the loading notification is cleared if it hasn't been already
                // (e.g., if an error happened very early or if snapshot.exists() was false)
                if (loadingNotificationIdRef.current) {
                    removeNotification(loadingNotificationIdRef.current);
                    loadingNotificationIdRef.current = null;
                }
            }
        };

        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Keep dependencies as they were if showNotification/removeNotification are stable

    const [formData, setFormData] = useState(initialFormData);

    const [saaaRecruitmentStatus, setSaaaRecruitmentStatus] = useState({}); // New state for SAAA

    const [isUploading, setIsUploading] = useState(false);
    const [isJohnDoe, setIsJohnDoe] = useState(false);
    const [isJaneDoe, setIsJaneDoe] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const resultNotificationIdRef = useRef(null);  // For timed result messages
    const [showUpdateNotification, setShowUpdateNotification] = useState(false); // New state for notification visibility
    const [commitInfo, setCommitInfo] = useState({ sha: '', date: null });
    const { imageSource: deathReportImage, className: deathReportClass } = SeasonalEvents({ imageType: 'deathReport' });
    const { imageSource: civilianPaperworkImage, className: civilianPaperworkClass } = SeasonalEvents({ imageType: 'civilianPaperwork' });


    useEffect(() => {
        fetch('https://api.github.com/repos/GTAW-PHMC/forms/commits/gh-pages')
            .then(response => response.json())
            .then(data => {
                const commitDate = new Date(data.commit.author.date);
                setCommitInfo({
                    sha: data.sha.substring(0, 7),
                    date: commitDate.toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZoneName: 'short'
                    })
                });
            })
            .catch(error => console.error('Error fetching commit:', error));
    }, []);

// Switch Form Handling Logic
    const [showPHMCModal, setShowPHMCModal] = useState(false); // This state will now control the generic SwitchableFormsModal
    const [switchableModalTitle, setSwitchableModalTitle] = useState('');
    const [switchableFormsList, setSwitchableFormsList] = useState([]);
    const openSwitchableModal = (title, formsArray) => {
        setSwitchableModalTitle(title);
        setSwitchableFormsList(formsArray);
        setShowPHMCModal(true); // Use the existing state to show/hide the modal
    };
    // useEffect for SAAA form completion notification
    useEffect(() => {
        if (selectedAgencyGroup === 'SAAA') {
            const definition = getFormDefinition(bbCodeVersion);
            if (definition && definition.requiredFields && definition.requiredFields.length > 0) {
                let allFieldsValid = true;
                for (const fieldName of definition.requiredFields) {
                    const value = formData[fieldName];
                    let fieldIsInvalid = false;

                    // Specific check for specOtherText in Airline form (version 33)
                    if (bbCodeVersion === 33 && fieldName === 'specOtherText') {
                        if (formData.specOther && (typeof value === 'string' && !value.trim())) {
                            fieldIsInvalid = true;
                        }
                        // If formData.specOther is false, specOtherText is not considered for this check
                    } else if (typeof value === 'string' && !value.trim()) {
                        fieldIsInvalid = true;
                    } else if (typeof value === 'boolean' && !value) { // For checkboxes like ackAuthorize
                        fieldIsInvalid = true;
                    } else if (value === undefined || value === null) { // Catches uninitialized fields
                        fieldIsInvalid = true;
                    } else if (typeof value === 'number' && fieldName === 'heliportNumPads' && value < 1) { // Example for number field with min value
                        fieldIsInvalid = true;
                    }
                    // Add more specific checks if other field types have unique "empty" or "invalid" states

                    if (fieldIsInvalid) {
                        allFieldsValid = false;
                        break;
                    }
                }
                 // Additional check for Airline form's specOtherText if specOther is true,
                 // even if specOtherText is not in the main requiredFields list (or if it is, this ensures the conditionality)
                if (bbCodeVersion === 33 && formData.specOther && (typeof formData.specOtherText !== 'string' || !formData.specOtherText.trim())) {
                    allFieldsValid = false;
                }


                if (allFieldsValid) {
                    if (!saaaFormCompletionNotified) {
                        showNotification("Form Completed!", 'check-circle', 5000);
                        setSaaaFormCompletionNotified(true);
                    }
                } else {
                    // If any field becomes invalid again, reset the notification state
                    if (saaaFormCompletionNotified) {
                        setSaaaFormCompletionNotified(false);
                    }
                }
            } else {
                 // If no required fields defined for this SAAA form or no definition found
                if (saaaFormCompletionNotified) {
                    setSaaaFormCompletionNotified(false);
                }
            }
        } else {
            // If not an SAAA form, reset the notification state
            if (saaaFormCompletionNotified) {
                setSaaaFormCompletionNotified(false);
            }
        }
    }, [formData, bbCodeVersion, selectedAgencyGroup, showNotification, saaaFormCompletionNotified]); // removeNotification is stable due to useCallback

    // Reset SAAA form completion notification state when form or group changes
    useEffect(() => {
        setSaaaFormCompletionNotified(false);
    }, [bbCodeVersion, selectedAgencyGroup]);

    // Define form lists for each switchable group
    const coronerFormsSubGroup = [
        { version: 1, name: "Decedent Services", icon: corpse },
        { version: 2, name: "Email Generator", icon: email },
        { version: 4, name: "Autopsy Report", icon: corpse },
        { version: 8, name: "Death Certificate", icon: PHMCLogo }
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
        { version: 3, name: "Detailed Patient File", icon: nurse } // Assuming nurse icon for advanced
    ];
        const phmcInternalEmails = [
        { version: 24, name: "Internal Email", icon: Civilian },
        { version: 35, name: "Sick Note", icon: nurse }, // Assuming nurse icon for basic
    ];

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
                        'Authorization': `Bearer ${imgurAccessToken}`, // Use access token
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
                const currentValue = formData[fieldName];
                const newValue = currentValue
                    ? `${currentValue}, ${uploadedUrls.join(', ')}`
                    : uploadedUrls.join(', ');
    
                setFormData(prev => ({
                    ...prev,
                    [fieldName]: newValue
                }));
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
    const [showMissingEmployeeModal, setShowMissingEmployeeModal] = useState(false);
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
    console.log('[Autopsy Photos] Starting individual image upload process...');
    const files = event.target.files;
    if (!files || files.length === 0) {
        console.log('[Autopsy Photos] No files selected.');
        showNotification('No files selected for autopsy photos.', 'warning');
        return;
    }

    let indefiniteNotificationId = null;

    setIsUploading(true);
    indefiniteNotificationId = showNotification('Processing autopsy photos, please wait...', 'info-circle', 0);
    console.log('[Autopsy Photos] UI notification shown, isUploading set to true.');

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
        console.log(`[Autopsy Photos] Starting to upload ${files.length} image(s) individually.`);
        
        for (const file of files) {
            console.log(`[Autopsy Photos] Preparing to upload image: "${file.name}"`);
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
            console.log(`[Autopsy Photos] Raw image upload response for "${file.name}":`, imageData);

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

    const handleMissingEmployeeSubmit = async () => {
        const webhookURL = process.env.REACT_APP_DISCORD_WEBHOOK_URL;

        if (!webhookURL) {
            console.error('Discord webhook URL not configured for employee management.');
            Sentry.captureMessage('Discord webhook URL is missing for employee management submission.', 'error');
            showNotification('Configuration error: Unable to submit request. Please contact the administrator.', 'exclamation-triangle');
            return;
        }

        let embedData = {};
        let submissionValid = false;
        let successMessage = '';
        let requestActionTitle = '';

        if (isJohnDoe || isJaneDoe) {
            const isCoronerRequest = isJohnDoe;
            requestActionTitle = `➕ Missing ${isCoronerRequest ? 'Coroner' : 'Hospital Staff'} Addition Request`;
            let requiredFields = [];

            if (isCoronerRequest) {
                requiredFields = ['coronerName', 'coronerDiscord', 'coronerRank', 'coronerBadge', 'coronerEmployee'];
            } else { // isJaneDoe (addPhmc)
                requiredFields = ['coronerName', 'employeeLastName', 'coronerRank', 'phmcEmployee'];
            }

            const emptyFields = requiredFields.filter(key => !missingEmployeeData[key]?.trim());
            if (emptyFields.length > 0) {
                showNotification(`Please fill in all required fields for adding staff. Missing: ${emptyFields.join(', ')}`, 'exclamation-circle');
                return;
            }

            const requester = isCoronerRequest ? missingEmployeeData.coronerEmployee : missingEmployeeData.phmcEmployee;

            embedData = {
                title: requestActionTitle,
                color: isCoronerRequest ? 0x8B0000 : 0x00008B,
                fields: [
                    { name: "Requested By", value: requester || "Unknown", inline: false },
                    { name: "Name to Add", value: missingEmployeeData.coronerName || "N/A", inline: true },
                    { name: isCoronerRequest ? "Discord Tag" : "Department/Discord", value: missingEmployeeData.coronerDiscord || "N/A", inline: true },
                    { name: "Rank/Position", value: missingEmployeeData.coronerRank || "N/A", inline: true },
                ],
                timestamp: new Date().toISOString(),
                footer: { text: `Submitted via PHMC Forms Tool - v${commitInfo.sha || 'N/A'}` }
            };

            let dataJsEntry = '';
            let parsedLastNameForEmbed = "N/A";

            if (isCoronerRequest) {
                if (missingEmployeeData.coronerBadge?.trim()) {
                    embedData.fields.push({ name: "Badge", value: missingEmployeeData.coronerBadge, inline: true });
                }
                dataJsEntry = `{ name: '${missingEmployeeData.coronerName || 'MISSING_NAME'}', badge: '${missingEmployeeData.coronerBadge || 'MISSING_BADGE'}', phNumber: '${missingEmployeeData.coronerPHNumber || ''}', rank: '${missingEmployeeData.coronerRank || 'MISSING_RANK'}', discord: '${missingEmployeeData.coronerDiscord || 'MISSING_DISCORD'}', category: '${missingEmployeeData.coronerRank || 'MISSING_CATEGORY'}' },`;
            } else { // isJaneDoe (add hospital staff)
                const rawFirstNameInput = missingEmployeeData.coronerName || "";
                const rawLastNameInput = missingEmployeeData.employeeLastName || "";
                let calculatedFullName;
                let parsedLastName = "";
                const trimmedFirstName = rawFirstNameInput.trim();
                const trimmedRawLastName = rawLastNameInput.trim();
                if (trimmedRawLastName) {
                    const lastNameWords = trimmedRawLastName.split(' ');
                    parsedLastName = lastNameWords[lastNameWords.length - 1];
                }
                if (trimmedFirstName && parsedLastName) {
                    if (trimmedFirstName.toLowerCase().endsWith(parsedLastName.toLowerCase()) && trimmedFirstName.includes(' ')) {
                        calculatedFullName = trimmedFirstName;
                    } else if (trimmedFirstName.toLowerCase() === parsedLastName.toLowerCase()) {
                        calculatedFullName = parsedLastName;
                    } else {
                        calculatedFullName = `${trimmedFirstName} ${parsedLastName}`;
                    }
                } else if (trimmedFirstName) {
                    calculatedFullName = trimmedFirstName;
                } else if (parsedLastName) {
                    calculatedFullName = parsedLastName;
                } else {
                    calculatedFullName = 'MISSING_FULL_NAME';
                }
                if (calculatedFullName.trim() === '' && calculatedFullName !== 'MISSING_FULL_NAME') {
                     calculatedFullName = 'MISSING_FULL_NAME';
                }
                const finalLastNameForEntry = parsedLastName || 'MISSING_LAST_NAME';
                parsedLastNameForEmbed = parsedLastName || "N/A";
                dataJsEntry = `{ name: '${calculatedFullName}', lastName: '${finalLastNameForEntry}', rank: '${missingEmployeeData.coronerRank || 'MISSING_RANK'}', category: '${missingEmployeeData.coronerRank || 'MISSING_CATEGORY'}' },`;
            }
            embedData.fields.push({ name: "Last Name", value: parsedLastNameForEmbed, inline: true });
            if (missingEmployeeData.coronerPHNumber?.trim()) {
                embedData.fields.push({ name: "Phone Number", value: missingEmployeeData.coronerPHNumber, inline: true });
            }
            embedData.fields.push({ name: "Google Firebase Debug String: ", value: `\`\`\`javascript\n${dataJsEntry}\n\`\`\``, inline: false });

            submissionValid = true;

        } else if (isRemoveStaff) {
            requestActionTitle = "➖ Staff Removal Request";
            if (!missingEmployeeData.staffToRemove || missingEmployeeData.staffToRemove.length === 0) {
                showNotification('Please select at least one staff member to remove.', 'warning');
                return;
            }
            if (!missingEmployeeData.authorizedBy?.trim()) {
                showNotification('Please enter your name in the "Authorized By" field.', 'warning');
                return;
            }
            const removedStaffDataStrings = [];
            for (const staffNameToRemove of missingEmployeeData.staffToRemove) {
                const coronerData = coronerListData.find(c => c.name === staffNameToRemove);
                if (coronerData) {
                    removedStaffDataStrings.push(
                        `Coroner: { name: '${coronerData.name}', badge: '${coronerData.badge}', phNumber: '${coronerData.phNumber || ''}', rank: '${coronerData.rank}', discord: '${coronerData.discord}', category: '${coronerData.category}' }`
                    );
                    continue; // Move to next staff member if found in coroners
                }

                const phmcData = phmcListData.find(p => p.name === staffNameToRemove);
                if (phmcData) {
                    removedStaffDataStrings.push(
                        `PHMC: { name: '${phmcData.name}', lastName: '${phmcData.lastName}', rank: '${phmcData.rank || phmcData.category}', category: '${phmcData.category}',  }`
                    );
                }
            }

            embedData = {
                title: requestActionTitle,
                color: 0xFFA500,
                fields: [
                    { name: "Authorized By", value: missingEmployeeData.authorizedBy, inline: false },
                    {
                        name: `Staff to Remove (${missingEmployeeData.staffToRemove.length})`,
                        value: missingEmployeeData.staffToRemove.join('\n') || "None selected",
                        inline: false
                    },
                    ...(removedStaffDataStrings.length > 0 ? [{
                        name: "Data of Removed Staff (for restoration)",
                        value: `\`\`\`javascript\n${removedStaffDataStrings.join('\n')}\n\`\`\``,
                        inline: false
                    }] : [])

                ],
                timestamp: new Date().toISOString(),
                footer: { text: `Submitted via PHMC Forms Tool - v${commitInfo.sha || 'N/A'}` }
            };
            submissionValid = true;
            successMessage = 'Processed! Any abuse of the forms will be reported to PHMC Leadership';
        } else {
            showNotification('Please select an action (Add Coroner, Add Staff, or Remove Staff).', 'warning');
            return;
        }

        if (submissionValid) {
            try {
                const response = await fetch(webhookURL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: `New Employee Management Request: ${requestActionTitle}`,
                        embeds: [embedData]
                    }),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`Failed to send message to Discord webhook. Status: ${response.status} ${response.statusText}`, errorText);
                    Sentry.captureMessage(`Discord webhook failed for employee management: ${response.status}`, {
                        level: 'error',
                        extra: { statusText: response.statusText, responseBody: errorText, requestType: requestActionTitle }
                    });
                    showNotification(`Failed to submit request. Status: ${response.status}`, 'exclamation-triangle');
                } else {
                    setShowMissingEmployeeModal(false);

                    // --- START Firebase Database Update ---
                    if (isJohnDoe) { // Add Coroner
                        const newCoroner = {
                            name: missingEmployeeData.coronerName,
                            badge: missingEmployeeData.coronerBadge,
                            phNumber: missingEmployeeData.coronerPHNumber || '',
                            rank: missingEmployeeData.coronerRank,
                            discord: missingEmployeeData.coronerDiscord,
                            category: missingEmployeeData.coronerRank // Or a more specific category if available
                        };
                        try {
                            const coronerListRef = ref(database, 'staff/coroner');
                            const snapshot = await get(coronerListRef);
                            const currentCoroners = snapshot.exists() ? snapshot.val() : [];
                            if (!currentCoroners.find(c => c.name === newCoroner.name)) {
                                const updatedCoroners = [...currentCoroners, newCoroner];
                                await set(coronerListRef, updatedCoroners);
                                showNotification(`Coroner ${newCoroner.name} added to database.`, 'check-circle');
                                setCoronerListData(updatedCoroners); // Update local state
                            } else {
                                showNotification(`Coroner ${newCoroner.name} already exists in database.`, 'warning');
                            }
                        } catch (dbError) {
                            console.error("Error adding coroner to Firebase:", dbError);
                            Sentry.captureException(dbError, { extra: { context: 'Firebase Add Coroner' } });
                            showNotification('Failed to update database for coroner.', 'error');
                        }
                    } else if (isJaneDoe) { // Add PHMC Staff
                        const rawFirstNameInput = missingEmployeeData.coronerName || "";
                        const rawLastNameInput = missingEmployeeData.employeeLastName || "";
                        let calculatedFullName;
                        let parsedLastName = "";
                        const trimmedFirstName = rawFirstNameInput.trim();
                        const trimmedRawLastName = rawLastNameInput.trim();
                        if (trimmedRawLastName) {
                            const lastNameWords = trimmedRawLastName.split(' ');
                            parsedLastName = lastNameWords[lastNameWords.length - 1];
                        }
                        if (trimmedFirstName && parsedLastName) {
                            if (trimmedFirstName.toLowerCase().endsWith(parsedLastName.toLowerCase()) && trimmedFirstName.includes(' ')) {
                                calculatedFullName = trimmedFirstName;
                            } else if (trimmedFirstName.toLowerCase() === parsedLastName.toLowerCase()) {
                                calculatedFullName = parsedLastName;
                            } else {
                                calculatedFullName = `${trimmedFirstName} ${parsedLastName}`;
                            }
                        } else if (trimmedFirstName) {
                            calculatedFullName = trimmedFirstName;
                        } else if (parsedLastName) {
                            calculatedFullName = parsedLastName;
                        } else {
                            calculatedFullName = 'MISSING_FULL_NAME';
                        }
                        if (calculatedFullName.trim() === '' && calculatedFullName !== 'MISSING_FULL_NAME') {
                             calculatedFullName = 'MISSING_FULL_NAME';
                        }
                        const finalLastNameForEntry = parsedLastName || 'MISSING_LAST_NAME';

                        const newPhmcStaff = {
                            name: calculatedFullName,
                            lastName: finalLastNameForEntry,
                            rank: missingEmployeeData.coronerRank,
                            category: missingEmployeeData.coronerRank,
                        };
                        try {
                            const phmcListRef = ref(database, 'staff/phmc');
                            const snapshot = await get(phmcListRef);
                            const currentPhmcStaff = snapshot.exists() ? snapshot.val() : [];
                            if (!currentPhmcStaff.find(p => p.name === newPhmcStaff.name)) {
                                const updatedPhmcStaff = [...currentPhmcStaff, newPhmcStaff];
                                await set(phmcListRef, updatedPhmcStaff);
                                showNotification(`PHMC Staff ${newPhmcStaff.name} added to database.`, 'check-circle');
                                setPhmcListData(updatedPhmcStaff); // Update local state
                            } else {
                                showNotification(`PHMC Staff ${newPhmcStaff.name} already exists in database.`, 'warning');
                            }
                        } catch (dbError) {
                            console.error("Error adding PHMC staff to Firebase:", dbError);
                            Sentry.captureException(dbError, { extra: { context: 'Firebase Add PHMC Staff' } });
                            showNotification('Failed to update database for PHMC staff.', 'error');
                        }
                    } else if (isRemoveStaff) {
                        const staffNamesToRemove = missingEmployeeData.staffToRemove || [];
                        if (staffNamesToRemove.length > 0) {
                            let coronerListUpdated = false;
                            let phmcListUpdated = false;
                            try {
                                const coronerListRef = ref(database, 'staff/coroner');
                                const coronerSnapshot = await get(coronerListRef);
                                let currentCoroners = coronerSnapshot.exists() ? coronerSnapshot.val() : [];
                                const initialCoronerCount = currentCoroners.length;
                                currentCoroners = currentCoroners.filter(c => !staffNamesToRemove.includes(c.name));
                                if (currentCoroners.length < initialCoronerCount) {
                                    await set(coronerListRef, currentCoroners);
                                    setCoronerListData(currentCoroners);
                                    coronerListUpdated = true;
                                }

                                const phmcListRef = ref(database, 'staff/phmc');
                                const phmcSnapshot = await get(phmcListRef);
                                let currentPhmcStaff = phmcSnapshot.exists() ? phmcSnapshot.val() : [];
                                const initialPhmcCount = currentPhmcStaff.length;
                                currentPhmcStaff = currentPhmcStaff.filter(p => !staffNamesToRemove.includes(p.name));
                                if (currentPhmcStaff.length < initialPhmcCount) {
                                    await set(phmcListRef, currentPhmcStaff);
                                    setPhmcListData(currentPhmcStaff);
                                    phmcListUpdated = true;
                                }

                                if (coronerListUpdated || phmcListUpdated) {
                                    showNotification(`Selected staff removed from database.`, 'check-circle');
                                } else {
                                    showNotification(`No matching staff found in database to remove.`, 'warning');
                                }
                            } catch (dbError) {
                                console.error("Error removing staff from Firebase:", dbError);
                                Sentry.captureException(dbError, { extra: { context: 'Firebase Remove Staff' } });
                                showNotification('Failed to update database for staff removal.', 'error');
                            }
                        }
                    }
                    // --- END Firebase Database Update ---

                    setMissingEmployeeData({
                        coronerName: '', coronerDiscord: '', coronerRank: '', coronerPHNumber: '',
                        coronerEmployee: '', coronerBadge: '', phmcEmployee: '',
                        staffToRemove: [], authorizedBy: '', employeeLastName: '',
                    });
                    setIsJohnDoe(false);
                    setIsJaneDoe(false);
                    setIsRemoveStaff(false);
                }
            } catch (error) {
                console.error('Error submitting employee management request:', error);
                Sentry.captureException(error, { extra: { context: 'Employee Management Submission Fetch', requestType: requestActionTitle } });
                showNotification('A network error occurred. Please try again.', 'exclamation-triangle');
            }
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

const [showCoronerRankModal, setShowCoronerRankModal] = useState(false);
const uniqueCoronerRanks = [...new Set(coronerListData.map(c => c.rank))].sort();
const handleCoronerRankSubmit = async ({ selectedEmployee, newRank }) => { // Accept the object
    const webhookURL = process.env.REACT_APP_DISCORD_WEBHOOK_URL;

    if (!webhookURL) {
        console.error('Discord webhook URL not configured.');
        Sentry.captureMessage('Discord webhook URL is missing for Coroner Rank submission.', 'error');
        showNotification('Configuration error: Unable to send rank.', 'exclamation-triangle');
        return;
    }

    // Determine the description and fields based on what was submitted
    let description = '';
    const fields = [];

    if (newRank && selectedEmployee) {
        // Case: Updating rank for a selected employee
        description = `**${selectedEmployee}** has updated their rank`;
        fields.push({ name: "Selected Coroner", value: selectedEmployee, inline: true });
        fields.push({ name: "New Rank Submitted", value: `**${newRank}**`, inline: true });
    } else if (selectedEmployee) {
        // Case: Only an employee was selected (no new rank entered) - Less likely with current modal logic, but handle it
        description = `Coroner **${selectedEmployee}** was selected.`;
        fields.push({ name: "Selected Coroner", value: selectedEmployee, inline: false });
    } else {
        // Should not happen if modal validation works, but handle as fallback
        console.warn("handleCoronerRankSubmit called without selectedEmployee or newRank.");
        showNotification('No information submitted.', 'warning');
        return;
    }

    // --- Construct Embed Payload ---
    const embed = {
        title: "Coroner Rank Update Request", // More specific title
        description: description,
        content: `A Coroner has updated their rank! Details here`,
        color: 0x8B0000, // Dark Red (Coroner theme)
        fields: fields, // Use the dynamically created fields array
        timestamp: new Date().toISOString(),
        footer: {
            text: `Submitted via PHMC Forms Tool - v${commitInfo.sha || 'N/A'}`
        }
    };

    // --- Construct Full Payload ---
    const payload = {
        username: "PHMC", // Use standard PHMC username
        avatar_url: phmcLogoUrl, // Use standard PHMC logo
        embeds: [embed] // Send the embed
    };
    // --- End Payload Construction ---

    try {
        const response = await fetch(webhookURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to send coroner rank embed. Status: ${response.status} ${response.statusText}`, errorText);
            Sentry.captureMessage(`Coroner Rank webhook failed: ${response.status}`, {
                level: 'error',
                extra: { statusText: response.statusText, responseBody: errorText }
            });
            showNotification(`Failed to send rank info. Status: ${response.status}`, 'exclamation-triangle');
        } else {
            // Use submittedValue for notification consistency if needed, or customize
            const notificationValue = newRank ? `${selectedEmployee} -> ${newRank}` : selectedEmployee;
            setShowCoronerRankModal(false); // Close modal on success
        }
    } catch (error) {
        console.error('Error sending coroner rank embed:', error);
        Sentry.captureException(error, { extra: { context: 'Coroner Rank Submission Fetch' } });
        showNotification('A network error occurred submitting the rank info.', 'exclamation-triangle');
    }
};

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


    // Keep this function as is
    const handleDoeChange = (type) => (e) => {
        if (e.target.checked) {
            setIsRemoveStaff(false); // <-- Add this line to turn off removal mode
            // Clear removal-specific fields when switching back to add
            setMissingEmployeeData(prev => ({
                ...prev,
                staffToRemove: [],
                employeeLastName: '',
                authorizedBy: '',
            }));
        }
        if (type === 'john') {
            setIsJohnDoe(e.target.checked);
            setIsJaneDoe(false);
            if (e.target.checked) {
                setFormData(prev => ({ ...prev, decedentName: 'John Doe' })); // This seems unrelated to the modal, but keeping it as per original code
            } else if (formData.decedentName === 'John Doe') {
                setFormData(prev => ({ ...prev, decedentName: '' })); // This seems unrelated to the modal
            }
        } else if (type === 'jane') {
            setIsJaneDoe(e.target.checked);
            setIsJohnDoe(false);
            if (e.target.checked) {
                setFormData(prev => ({ ...prev, decedentName: 'Jane Doe' })); // This seems unrelated to the modal
            } else if (formData.decedentName === 'Jane Doe') {
                setFormData(prev => ({ ...prev, decedentName: '' }));
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
        const coronerFormVersions = [1, 2, 4, 8, 18];
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
    const bbCodeContent = getBBCodeContent(); // Correctly called here

    const currentAuthor = getCurrentReportAuthor(formData); // Assumes getCurrentReportAuthor is defined elsewhere

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
        const definition = getFormDefinition(bbCodeVersion);
        const formName = definition ? definition.name : `Form v${bbCodeVersion}`;
        if (bbCodeContent && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(bbCodeContent).then(() => {
                showNotification(`BBCode for "${formName}" copied to clipboard!`, 'clipboard', 7000);
            }).catch(err => {
                console.error(`Failed to copy BBCode for "${formName}": `, err);
                Sentry.captureException(err, { extra: { context: 'PHMC Recruitment Clipboard Copy Fail', formName: formName } });
                showNotification(`Failed to copy BBCode for "${formName}" to clipboard.`, 'exclamation-triangle', 10000);
            });
        } else if (!bbCodeContent) {
             showNotification(`Could not generate BBCode for "${formName}" to copy.`, 'error', 10000);
        } else {
            showNotification(`Clipboard API not available. BBCode for "${formName}" not copied.`, 'exclamation-triangle', 10000);
        }
        return false; // Prevent Firebase saving for PHMC Recruitment forms
    }
    // --- END MODIFICATION ---
    else { // Default handler for any other bbCodeVersion (includes SAAA)
        const definition = getFormDefinition(bbCodeVersion); // Get current form definition

        if (definition && definition.group === 'SAAA') {
            if (bbCodeContent && navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(bbCodeContent).then(() => {
                    showNotification(`Copied to clipboard! `, 'clipboard', 7000);
                }).catch(err => {
                    console.error('Failed to copy SAAA form BBCode: ', err);
                    Sentry.captureException(err, { extra: { context: 'SAAA Form Clipboard Copy Fail', formName: definition.name } });
                    showNotification(`Failed to copy BBCode for "${definition.name}" to clipboard. Saving not defined.`, 'exclamation-triangle', 10000);
                });
            } else if (!bbCodeContent) {
                 showNotification(`Could not generate BBCode for "${definition.name}" to copy. Saving not defined.`, 'error', 10000);
            } else {
                showNotification(`Clipboard API not available. BBCode for "${definition.name}" not copied. Saving not defined.`, 'exclamation-triangle', 10000);
            }
            return false; // Prevent Firebase saving for SAAA forms
        }

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
        const reportRef = ref(database, reportPath);
        await set(reportRef, reportDataToSave);
        showNotification(`Report "${key}" saved for ${currentAuthor} to Firebase!`, 'save');

        if (selectedUserForSavedReports === currentAuthor) {
             loadUserSavedReports(currentAuthor);
        }
        return true; // Indicate success

    } catch (error) {
        console.error("Error saving report to Firebase:", error);
        Sentry.captureException(error, { extra: { context: 'Firebase set report', path: reportPath } });
        showNotification('Failed to save report to Firebase. Copying will be skipped.', 'error');
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
        showNotification(`Loading reports for ${userId}...`, 'info-circle', 0);

        const sanitizedUserId = userId.replace(/[.#$[\]/]/g, '_');
        const userReportsPath = `savedReports/${sanitizedUserId}`;
        const reportsRef = ref(database, userReportsPath);

        try {
            const snapshot = await get(reportsRef);
            if (snapshot.exists()) {
                const reportsData = snapshot.val();
                const validReports = [];
                const now = Date.now();
                const thirtyOneDays = 31 * 24 * 60 * 60 * 1000;
                let expiredCount = 0;
                const deletionPromises = [];

                for (const reportKey in reportsData) {
                    const report = reportsData[reportKey];
                    if (report.timestamp && (now - report.timestamp < thirtyOneDays)) {
                        validReports.push({
                            key: reportKey,
                            originalKey: report.originalKey,
                            bbCodeVersion: report.bbCodeVersion,
                            timestamp: report.timestamp,
                            authorName: report.authorName,
                            bbCode: report.bbCode,
                        });
                    } else {
                        console.log(`Report "${report.originalKey || reportKey}" for user ${userId} is expired. Deleting.`);
                        const reportToDeletePath = `${userReportsPath}/${reportKey}`;
                        deletionPromises.push(remove(ref(database, reportToDeletePath)));
                        expiredCount++;
                    }
                }

                if (deletionPromises.length > 0) {
                    await Promise.all(deletionPromises);
                    if (expiredCount > 0) {
                        showNotification(`${expiredCount} expired report(s) for ${userId} were automatically deleted.`, 'trash', 5000);
                    }
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
            console.error(`Error loading reports for user ${userId}:`, error);
            Sentry.captureException(error, { extra: { context: 'loadUserSavedReports', userId } });
            showNotification(`Failed to load reports for ${userId}.`, 'error');
            setSavedReports([]);
        } finally {
            setIsLoadingUserReports(false);
        }
    }, [showNotification, removeNotification, setSavedReports, setSelectedUserForSavedReports, setIsLoadingUserReports, database]); // Add all necessary dependencies

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

            if (!returnOnly) { // Only set state if not in 'returnOnly' mode
                if (bbCodeVersion === 2 && loadedVersion === 1) {
                    // This block now uses the already modified loadedBbCode
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
                            updatedDeathReport = loadedBbCode; // Use the universally modified BBCode
                            notificationMessage = `Loaded report for ${loadedFormData.decedentName || reportData.originalKey} into main Death Report field.`;
                        } else {
                            updatedAdditionalReports = [...updatedAdditionalReports, loadedBbCode]; // Use the universally modified BBCode
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
                    setParsedBBCode(''); // Clear parsed BBCode as it's now directly in formData
                    showNotification(notificationMessage, 'plus-circle');
                } else {
                    // This else block will also benefit from the universal conversion
                    setFormData(prev => ({
                        ...prev,
                        ...loadedFormData,
                        coronerEmployee: loadedFormData.coronerEmployee || prev.coronerEmployee,
                        phmcEmployee: loadedFormData.phmcEmployee || prev.phmcEmployee,
                    }));
                    setBbCodeVersion(loadedVersion);
                    setParsedBBCode(loadedBbCode); // This will now be the modified BBCode
                    showNotification(`Report "${reportData.originalKey || reportFirebaseKey}" loaded.`, 'upload');
                }
                setShowSavedReports(false); // Close modal if directly loading
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

    const result = await loadReportForUser(reportFirebaseKey, userId, true);

    if (result.success && pendingReportAttachmentCallback.current) {
        const reportData = result.reportData;
        const loadedVersion = reportData.bbCodeVersion;

        // Specific handling for loading a v1 Death Report into the v2 Coroner Email form.
        if (loadedVersion === 1 && bbCodeVersion === 2) {
            setFormData(prev => {
                const currentDeathReportIsEmpty = !prev.deathReport || prev.deathReport.trim() === '';
                
                if (currentDeathReportIsEmpty) {
                    // If the main death report field is empty, this is the first report.
                    showNotification(`Loaded report for ${reportData.originalKey} into main Death Report field.`, 'upload');
                    return {
                        ...prev,
                        deathReport: reportData.bbCode,
                    };
                } else {
                    // If the main field is already filled, append this as an additional report.
                    showNotification(`Added report for ${reportData.originalKey} as an additional report.`, 'plus-circle');
                    return {
                        ...prev,
                        additionalReports: [...prev.additionalReports, reportData.bbCode],
                    };
                }
            });
        }

        // The pending callback handles other cases, like attaching reports to SicknessEmail.
        // For CoronerEmail, the callback is a no-op, which is correct since we handled the logic above.
        pendingReportAttachmentCallback.current(result.reportData);

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
    }, 5000); // <--- INCREASED THIS VALUE TO 1000ms

}, [loadReportForUser, bbCodeVersion, showNotification, setFormData, formData.deathReport, formData.additionalReports]);

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
        } else if (selectedAgencyGroup === 'SAAA' && selectOptions?.saaaPositionDetailsData) {
            // This part remains for SAAA if you have a similar button for it
            data = selectOptions.saaaPositionDetailsData[positionKey];
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

// switching agency logic


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

    // ... (keep existing useEffects for commit info, image upload, data fetching, etc.)
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
        const reSyncSelectedAgencyGroup = useCallback(() => {
        const definition = getFormDefinition(bbCodeVersion);
        if (definition) {
            // Only update if the current selectedAgencyGroup is different from the form's actual group
            if (selectedAgencyGroup !== definition.group) {
                setSelectedAgencyGroup(definition.group);
                localStorage.setItem('selectedAgencyGroup', definition.group);
            }
        } else {
            // If no valid form definition for the current bbCodeVersion, reset selectedAgencyGroup
            if (selectedAgencyGroup !== null) {
                setSelectedAgencyGroup(null);
                localStorage.removeItem('selectedAgencyGroup');
            }
        }
    }, [bbCodeVersion, selectedAgencyGroup, setSelectedAgencyGroup]); // Add all dependencies

    // Handler for closing the SwitchableFormsModal (e.g., PHMC Recruitment forms list)
    const handleCloseSwitchableModal = useCallback(() => {
        setShowPHMCModal(false);
        reSyncSelectedAgencyGroup(); // Re-sync after modal closes
    }, [setShowPHMCModal, reSyncSelectedAgencyGroup]);

    // Handler for closing the AgencySelector modal (e.g., PHMC or SAAA forms list)
    const handleCloseAgencySelector = useCallback(() => {
        setShowAgencySelector(false);
        reSyncSelectedAgencyGroup(); // Re-sync after modal closes
    }, [setShowAgencySelector, reSyncSelectedAgencyGroup]);

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
        } else if (bbCodeVersion === 25 || bbCodeVersion === 26) { // Patient File - Basic
            const { patientName } = formData;
            return `[Medical Information Registration] -  ${patientName || 'N/A'}`;
        } else if (bbCodeVersion === 8) { // Death Certificate
            const { decedentOOC } = formData;
            return `[Death Certificate] -  ${decedentOOC || 'N/A'}`;
        } else if (bbCodeVersion === 30) { // SAAA Job Selection
            const { saaaJobSelection, patientFirstName, patientLastName } = formData;
            let positionDisplay = saaaJobSelection || "N/A";
            if (saaaJobSelection && selectOptions?.saaaPositionDetailsData?.[saaaJobSelection]) {
                positionDisplay = selectOptions.saaaPositionDetailsData[saaaJobSelection].shortCode || saaaJobSelection;
            }
            return `[${positionDisplay}] - ${patientFirstName || ''} ${patientLastName || ''}`.trim();
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


    //  BBCode generation logic
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
    const [parsedBBCode, setParsedBBCode] = useState('');
    // update Switch logic
    const parseBBCode = () => {
        let deathReportBbCode = generateDeathReport(formData);

        if (!deathReportBbCode) { // Check for null, undefined, or empty string
            console.error("parseBBCode: generateDeathReport(formData) returned invalid content.");
            showNotification(`Failed to generate Death Report BBCode for parsing.`, 'error');
            return;
        }

        deathReportBbCode = deathReportBbCode.replace(/\[bold\]/g, '[b]').replace(/\[\/bold\]/g, '[/b]');

        setParsedBBCode(deathReportBbCode);

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
        const fiveDayExpiryFields = ['phmcEmployee', 'coronerEmployee', 'department', /* other fields */];
        if (fiveDayExpiryFields.includes(name)) {
             localStorage.setItem(name, valToSet);
             localStorage.setItem(`${name}_timestamp`, timestamp);
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
            />

            
            <EasterEggModal
                show={showEasterEggModal}
                type={easterEggType} // Pass the type ('normal' or 'rare')
                onHide={() => {
                    setShowEasterEggModal(false);
                    setEasterEggType(null); // Reset type on hide
                }}
            />
{season === "Christmas" && <Snowfall images={EasterEggImages} snowflakeCount={75} />}

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
                    <CoronerRankModal
    show={showCoronerRankModal}
    onClose={() => setShowCoronerRankModal(false)}
    onSubmit={handleCoronerRankSubmit}
    coronerList={coronerListData} 
    setCoronerListData={setCoronerListData}
    showNotification={showNotification}    
                    />
        <CoronerTipsModal
            show={showCoronerTips}
            onClose={() => setShowCoronerTips(false)}
        />
            <FlightSchoolTipsModal
                show={showFlightSchoolTipsModal}
                onHide={() => setShowFlightSchoolTipsModal(false)}
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
                                    saaaRecruitmentDetails={saaaRecruitmentDetails} // <<< Add this prop

                        />
                        
                    )}
                                <PositionInfoModal
                show={showPositionInfoModal}
                onClose={() => setShowPositionInfoModal(false)}
                // Pass the correct position key based on the form
                selectedPositionKey={bbCodeVersion === 50 ? formData.recruitmentPosition : formData.saaaJobSelection}
                positionData={currentPositionInfo}
            />
                    <AdminModal
                        show={bbCodeVersion === 999 && formData.isAdminAuthenticated === false && selectedAgencyGroup === "Admin"} // Example condition for showing AdminModal for login
                        onHide={() => { /* Logic to hide admin modal or switch form */ }}
                        showNotification={showNotification}
                        commitInfo={commitInfo}
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
                        {selectedAgencyGroup === 'SAAA' && (
                <Button
                    variant="info" // Or SAAA theme color
                    className="changelog-button" // Or a new class
                    onClick={() => setShowSaaaEmployeeModal(true)}
                    title="Manage SAAA Employees"
                >
                    <i className="fas fa-users-cog"></i> {/* Example Icon */}
                    Manage SAAA Staff
                </Button>
            )}
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
                                    Change Agency Group
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
                                    <h3>Changelog - Version 2.6.1b -  </h3>
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
                <li>Sick Notes have been added to the Generator, this covers both `Sick Notes` and `Illness Confirmation`.</li>
                <li>Employees can import reports from either: ER Protocol or General Consultation. (Feedback welcome for more form support)</li>
                <li>OPTIONAL: Employees can enclose report's for the Patient's Employer (Requires patient confirmation)</li>
            </ul>
        </li>
        <li><strong>Updated:</strong>
            <ul>
                <li>Advanced Patient Files now support dropdowns.</li>
                <li>Autopsy Modal has had a number of bug fixes and optimizations.</li>
            </ul>
        </li>
        <li><strong>Terms of Service:</strong>
            <ul>
                <li>Privacy Policy has been updated to cover Google Firebase.</li>
            </ul>
        </li>
        <li><strong>Admin Panel:</strong>
            <ul>
                <li>Admin Panel now has a 'Go Back' button for people that get lost.</li>
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
                    {selectedAgencyGroup === 'SAAA' && (
                        <Button
                            type="button"
                            variant="info" // Or an SAAA specific variant if you have one
                            className="changelog-button"
                            onClick={() => window.open('https://saaa.gta.world/', '_blank')}
                        >
                            SAAA
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

                        {(bbCodeVersion === 1 || bbCodeVersion === 2 || bbCodeVersion === 4 || bbCodeVersion === 8) && (
                            <Button
                                className="changelog-button"
                                variant='secondary'
                                onClick={() => openSwitchableModal("Coroner Forms", coronerFormsSubGroup)}
                            >
                                <i className="fa fa-laptop"></i>
                                <span>Coroner Forms</span>
                            </Button>
                        )}
                        {bbCodeVersion === 31 && ( // Changed FLIGHT_SCHOOL_FORM_VERSION to 31
                            <Button
                                className="changelog-button" // Or a more specific class
                                variant='info' // Or any other variant
                                onClick={() => setShowFlightSchoolTipsModal(true)}
                                style={{ marginLeft: '10px' }} // Example style
                            >
                                <i className="fas fa-info-circle"></i>
                                <span>Flight School Regs</span>
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
                        {(bbCodeVersion === 3 || bbCodeVersion === 24 || bbCodeVersion === 25) && (
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
                                        setFormData={setFormData}
                                        commitInfo={commitInfo}
                                        // Pass all necessary props from App.js state and selectOptions
                                        // Example for DeathReport:
                                        typeOfDeathOptions={selectOptions.typeOfDeathOptions || []}
                                        mannerOfDeathOptions={selectOptions.mannerOfDeathOptions || []}
                                        requestingAgencyOptions={selectOptions.requestingAgenciesOptions || []}
                                        // Pass other props like phmcGroupedOptions, coronerGroupedOptions, etc.
                                        phmcGroupedOptions={phmcGroupedOptions}
                                        coronerGroupedOptions={coronerGroupedOptions}
                                        setShowMissingEmployeeModal={setShowMissingEmployeeModal}
                                        setShowCoronerRankModal={setShowCoronerRankModal}
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
                                        isJohnDoe={isJohnDoe}
                                        isJaneDoe={isJaneDoe}
                                        handleDoeChange={handleDoeChange}
                                        currentUtcTime={currentUtcTime}
                                        Imaging={selectOptions.Imaging || []}
                                        XrayResults={selectOptions.XrayResults || []}
                                        ctResults={selectOptions.ctResults || []}
                                        mriResults={selectOptions.mriResults || []}
                                        ultrasoundResults={selectOptions.ultrasoundResults || []}
                                        patientBloodType={selectOptions.patientBloodType || []} 
                                        selectOptions={selectOptions} // Make sure this is passed
                                        physicianRecruitmentDetails={physicianRecruitmentDetails}
                                        psychRecruitmentDetails={psychRecruitmentDetails}
                                        saaaRecruitmentDetails={saaaRecruitmentDetails}
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
                    variant="danger"
                    className="changelog-button" // You can keep this or use a new class for specific floating styles
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
    saaaRecruitmentDetails={saaaRecruitmentDetails}
    coronerRecruitmentDetails={selectOptions.coronerPositionDetailsData || {}}
    // Pass other recruitment details objects as props when you add them
/>

<MissingEmployeeModal
    show={showMissingEmployeeModal}
    onHide={() => {
        setShowMissingEmployeeModal(false);
        setIsJohnDoe(false); // Reset state on close
        setIsJaneDoe(false); // Reset state on close
        setIsRemoveStaff(false); // Reset state on close
    }}
    isJohnDoe={isJohnDoe}
    isJaneDoe={isJaneDoe}
    isRemoveStaff={isRemoveStaff}
    handleDoeChange={handleDoeChange}
    handleRemoveStaffChange={handleRemoveStaffChange}
    missingEmployeeData={missingEmployeeData}
    handleMissingEmployeeChange={handleMissingEmployeeChange}
    phmcGroupedOptions={phmcGroupedOptions}
    coronerGroupedOptions={coronerGroupedOptions}
    combinedStaffOptions={combinedStaffOptions}
    handleMissingEmployeeSubmit={handleMissingEmployeeSubmit}
/>
            <SaaaEmployeeModal
                show={showSaaaEmployeeModal}
                onHide={() => setShowSaaaEmployeeModal(false)}
                saaaGroupedOptions={saaaGroupedOptions}
                handleSaaaEmployeeSubmit={handleSaaaEmployeeSubmit}
                showNotification={showNotification}
                // commitInfo={commitInfo} // Pass if needed
            />
            {showFeatureRequestModal && (
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
                    {selectedAgencyGroup === 'SAAA' && (
                        <SaaaBusinessCardModal
                            show={showBusinessCard} // Assuming SAAA card also uses showBusinessCard state
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
    loadReportForUser={loadReportForUser} // This is the original load function for direct form loading
    deleteReportForUser={deleteReportForUser}
    currentCoronerEmployee={formData.coronerEmployee}
    currentPhmcEmployee={formData.phmcEmployee}
    filterByBbCodeVersions={reportSelectionFilter} // Pass the filter
    onReportSelectedForAttachment={handleReportSelectedForAttachment} // New prop for attachment flow
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
                                    if (navigator.clipboard && navigator.clipboard.writeText) {
                                        navigator.clipboard.writeText(title).then(() => {
                                            showNotification('Title copied to clipboard!', 'check-circle');
                                        }).catch(err => {
                                            console.error('Failed to copy: ', err);
                                            showNotification('Failed to copy title to clipboard!', 'exclamation-triangle');
                                        });
                                    } else {
                                        console.warn("Clipboard API not available");
                                        showNotification('Clipboard API not available!', 'exclamation-triangle');
                                    }
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
    saaaLogo={saaaLogo} // Make sure saaaLogo is imported and available in App.js scope
/>

                </div>
                            </div>
                            <Footer />
                                    </div>
    );
}

export default App;
