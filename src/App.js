import React, { useState, useEffect, useRef, useMemo, useCallback} from 'react'; 
import { formDefinitions, getFormDefinition, generateVersionNames as generateVersionNamesFromDefs } from './formDefinitions'; 
import '@fortawesome/fontawesome-free/css/all.min.css';
import Notification from './components/Notification';
import { Modal, Form, Button } from 'react-bootstrap';
import { handleFormCopyAndNotify } from './notificationService'; // Adjust path if needed
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
import FlightSchoolTipsModal from './saaa-components/FlightSchoolTipsModal';
import saaaLogo from './assets/saaa-button.png'; // Import SAAA logo
import {
    generateDeathReport,
    generateEmail,
    generateSurgicalOps,
    generateAdvancedPatientFile,
    generatePhysEvalInternalMed,
    generatePhysEvalInternalMedPBC,
    generateMentalHealthPHMC,
    generateMentalHealthPBC,
    generateConsultationNotesPHMC,
    generateAgencyFeedback,
    generateEmergencyProtocol,
    generateCommentaryNotePHMC,
    generateCommentaryNotePBC,
    generateMedicalRecordRelease,
    generateBasicPatientFile,
    generateEmailPHMCEmail,
    generateConsultationNotesPBC,
    generatePsychEvalPHMC,
    generatePsychEvalPBC,
} from './phmc-bbcode-generators'; 

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

const initialFormData = {
    coronerRank: 'Forensic Attendant',
    placeOfDeath: '',
    evidenceLockerID: '',
    evidenceLocker: '',
    department: '',
    dateTime: '',
    phmcEmployeeSignature: '',
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
    // patientName: '', // This is duplicated below, ensure one source of truth
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

};
    const [saaaFormCompletionNotified, setSaaaFormCompletionNotified] = useState(false);

    // ... existing useEffects ...



    const [showFlightSchoolTipsModal, setShowFlightSchoolTipsModal] = useState(false);

    const removeNotification = useCallback((idToRemove) => {
        setNotifications(prevNotifications =>
            prevNotifications.filter(notif => notif.id !== idToRemove)
        );
    }, []); // setNotifications is stable

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

        const showNotification = useCallback((message, icon = 'check-circle', duration = DEFAULT_NOTIFICATION_DURATION) => {
        const newNotification = {
            id: Date.now() + Math.random(),
            message: message,
            icon: getIconClass(icon), // getIconClass is stable (defined outside)
        };
        setNotifications(prevNotifications => [...prevNotifications, newNotification]);
        if (duration > 0) {
            setTimeout(() => {
                removeNotification(newNotification.id); // removeNotification is stable
            }, duration);
        }
        return newNotification.id;
    }, [removeNotification]);
    const [showSaaaEmployeeModal, setShowSaaaEmployeeModal] = useState(false);
    const [saaaListData, setSaaaListData] = useState([]); // To store SAAA staff list

    useEffect(() => {
        let isMounted = true; // Flag to prevent state updates if component unmounts
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

                // Attempt to remove loading notification as soon as fetch completes
                if (loadingNotificationId && isMounted) {
                    removeNotification(loadingNotificationId);
                    loadingNotificationId = null; // Clear it so cleanup doesn't try again
                }

                if (!isMounted) return; // Check again before setting state

                if (snapshot.exists()) {
                    const allData = snapshot.val();
                    setPhmcListData(allData.staff?.phmc || []);
                    setCoronerListData(allData.staff?.coroner || []);
                    setSaaaListData(allData.staff?.saaa || []); // Add this
                    setAgencyDataStore(allData.agencies || {});
                    setSelectOptions(allData.selectOptions || {});
                    showNotification('Data loaded successfully!', 'check-circle');
                } else {
                    showNotification('Initial application data not found on server.', 'error');
                    setPhmcListData([]);
                    setCoronerListData([]);
                    setAgencyDataStore({});
                    setSelectOptions({});
                }
            } catch (error) {
                if (isMounted) {
                    if (loadingNotificationId) { // Ensure it's removed on error too
                        removeNotification(loadingNotificationId);
                        loadingNotificationId = null;
                    }
                    console.error("Error fetching data from Realtime Database:", error);
                    Sentry.captureException(error, { extra: { context: 'Firebase Data Fetch' } });
                    showNotification('Failed to load initial application data. Please try again later.', 'error');
                }
            } finally {
                if (isMounted) {
                    setIsLoadingData(false);
                    // Final check to remove loading notification if it's somehow still there
                    if (loadingNotificationId) {
                        removeNotification(loadingNotificationId);
                        loadingNotificationId = null;
                    }
                }
            }
        };

        fetchData();

        return () => {
            isMounted = false;
            // Cleanup: If the component unmounts while the loading notification is still visible, remove it.
            if (loadingNotificationId) {
                removeNotification(loadingNotificationId);
            }
        };
    }, [showNotification, removeNotification]); // Add stable dependencies
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

    const getBBCodeContent = () => {
        const definition = getFormDefinition(bbCodeVersion);
        if (definition && definition.generator) {
            return definition.generator(formData);
        }
        Sentry.captureMessage(`No BBCode generator found for version: ${bbCodeVersion}`);
        const formName = versionNames[bbCodeVersion] || `Form v${bbCodeVersion}`;
        return `BBCode generation for form "${formName}" is not implemented.`;
    };

    const [isLoadingData, setIsLoadingData] = useState(true); 
    const loadingNotificationIdRef = useRef(null); 
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

    const [isUploading, setIsUploading] = useState(false);
    const [isJohnDoe, setIsJohnDoe] = useState(false);
    const [isJaneDoe, setIsJaneDoe] = useState(false);
    const [notifications, setNotifications] = useState([]);
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
        { version: 18, name: "Agency Incidents", icon: PHMCLogo },
        { version: 4, name: "Autopsy Report", icon: corpse }
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

    const [showFeatureRequestModal, setShowFeatureRequestModal] = useState(false);
    const [featureRequest, setFeatureRequest] = useState('');
    const [discordName, setDiscordName] = useState('');
    const [showMissingEmployeeModal, setShowMissingEmployeeModal] = useState(false);
    const [requestType, setRequestType] = useState('');
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
                dataJsEntry = `{ name: '${calculatedFullName}', lastName: '${finalLastNameForEntry}', rank: '${missingEmployeeData.coronerRank || 'MISSING_RANK'}', category: '${missingEmployeeData.coronerRank || 'MISSING_CATEGORY'}', signature: '' },`;
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
                        `PHMC: { name: '${phmcData.name}', lastName: '${phmcData.lastName}', rank: '${phmcData.rank || phmcData.category}', category: '${phmcData.category}', signature: '${phmcData.signature || ''}' }`
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
                            signature: ''
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
const webhookBodyTemplate = `A new update detected... parsing details
Name(s) added:
Name(s) removed: `;

    // --- Function to open the webhook modal with the template ---
    const openWebhookModalWithTemplate = () => {
        setWebhookTitle('New Update Detected'); // Also clear the title when opening
        setWebhookMessage(webhookBodyTemplate); // Set the template here
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

    const handleFeatureRequestSubmit = async () => {
        const webhookURL = process.env.REACT_APP_DISCORD_WEBHOOK_URL;

        if (!webhookURL) {
            console.error('Discord webhook URL not configured for feature requests.');
            Sentry.captureMessage('Discord webhook URL is missing for feature request submission.', 'error');
            showNotification('Configuration error: Unable to submit request. Please contact the administrator.', 'exclamation-triangle');
            return;
        }

        // Basic validation
        if (!featureRequest.trim()) {
            showNotification('Please enter your bug report or feature request.', 'warning');
            return;
        }
        if (!discordName.trim()) {
            showNotification('Please enter your Discord name.', 'warning');
            return;
        }

        // Collect debug information
        const debugInfo = {
            bbCodeVersion: bbCodeVersion,
            userAgent: navigator.userAgent,
            // Consider adding more relevant debug info if available
            // errors: localStorage.getItem('consoleErrors') || 'No errors were logged', // Be cautious with potentially large error logs
        };
 
        // --- Start Embed Construction ---
        const embedData = {
            title: "📝 Bug Report / Feature Request",
            color: 0x3498DB, // Blue color for general feedback
            fields: [
                { name: "Submitted By", value: discordName || "N/A", inline: true },
                { name: "Request Type", value: "Bug/Feature", inline: true }, // You could add a radio button later to specify Bug vs Feature
                { name: "Request Details", value: featureRequest || "No details provided.", inline: false },
                { name: "Debug Info", value: `\`\`\`json\n${JSON.stringify(debugInfo, null, 2)}\n\`\`\``, inline: false } // Format debug info in a code block
            ],
            timestamp: new Date().toISOString(),
            footer: {
                text: `Submitted via PHMC Forms Tool - v${commitInfo.sha || 'N/A'}`
            }
        };
        // --- End Embed Construction ---

        try {
            const response = await fetch(webhookURL, { // Use the constant webhookURL
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                // Send the embed structure
                body: JSON.stringify({
                    content: `Feedback / Bug Report`, 
                    embeds: [embedData] // Send the embed data as an array
                }),
            });

            if (response.ok) {
                showNotification('Thanks for your feedback! I will work on it soon', 'check-circle');
                setShowFeatureRequestModal(false); // Close the modal
                setFeatureRequest(''); // Clear the form fields
                setDiscordName('');   // Clear the form fields
                // No need for setTimeout for notification, showNotification handles it
            } else {
                const errorText = await response.text();
                console.error(`Failed to send message to Discord webhook. Status: ${response.status} ${response.statusText}`, errorText);
                Sentry.captureMessage(`Discord webhook failed for feature request: ${response.status}`, {
                    level: 'error',
                    extra: { statusText: response.statusText, responseBody: errorText }
                });
                showNotification(`Failed to submit. Please try again. Status: ${response.status}`, 'exclamation-triangle');
            }
        } catch (error) {
            console.error('Error submitting feature request:', error);
            Sentry.captureException(error, { extra: { context: 'Feature Request Submission Fetch' } });
            showNotification('An network error occurred. Please try again.', 'exclamation-triangle');
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
                    signature: employee.signature,
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
    
    // Save Coroner Form BBCode to local storage
    const [savedReports, setSavedReports] = useState([]);
    const [showSavedReports, setShowSavedReports] = useState(false);
    useEffect(() => {
        loadSavedReports();
    }, []); // Empty dependency array ensures this runs only once on mount

    // Function to delete a saved report
    const deleteReport = (key) => {
        localStorage.removeItem(key);
        showNotification(`Report deleted: ${key}`, 'trash');
        loadSavedReports(); // Refresh the list of saved reports
    };
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

const getCurrentReportAuthor = (formData) => {
    // Define which bbCodeVersions are primarily Coroner forms
    const coronerFormVersions = [1, 2, 4, 18];
    // Define which bbCodeVersions are primarily PHMC forms
    const phmcFormVersions = [
        5, 6, 7, 9, 10, 12, 13, 14, 16, 19, 20, 21, 22, 23, 27, 28, 29
    ];

    if (coronerFormVersions.includes(bbCodeVersion)) {
        if (formData.coronerEmployee) return formData.coronerEmployee;
    } else if (phmcFormVersions.includes(bbCodeVersion)) {
        if (formData.phmcEmployee) return formData.phmcEmployee;
    }

    // Fallback logic if the form isn't strictly one or the other,
    // or if the primary employee field for that form type is empty.
    // Prioritize coroner if both are somehow filled for a non-specific form.
    if (formData.coronerEmployee) return formData.coronerEmployee;
    if (formData.phmcEmployee) return formData.phmcEmployee;

    // Fallback for forms where patient might be considered the "author"
    if (bbCodeVersion === 25 || bbCodeVersion === 3 || bbCodeVersion === 24) { // BasicPatientFile, PatientAdvanced, MedicalRelease
        // For these, if no employee is set, the patient name might be the best identifier for "author"
        if (formData.patientName) return formData.patientName;
        if (formData.patientFirstName && formData.patientLastName) return `${formData.patientFirstName} ${formData.patientLastName}`;
        if (formData.patientFirstName) return formData.patientFirstName;
        if (formData.patientLastName) return formData.patientLastName;
    }
    
    return null; // If no author can be determined
};

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
        key = `${formData.decedentOOC} - ${formData.dateTime}`;
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
        if (!formData.patientID || !formData.lastName || !formData.date) {
            showNotification(`Please fill in Patient ID, Last Name, and Date fields.`, 'exclamation-circle');
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
    // Add other specific forms as needed...
    else { // Default handler for any other bbCodeVersion
        const definition = getFormDefinition(bbCodeVersion); // Get current form definition

        if (definition && definition.group === 'SAAA') {
            const bbCodeToCopy = getBBCodeContent();
            if (bbCodeToCopy && navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(bbCodeToCopy).then(() => {
                    showNotification(`Copied to clipboard! `, 'clipboard', 7000);
                }).catch(err => {
                    console.error('Failed to copy SAAA form BBCode: ', err);
                    Sentry.captureException(err, { extra: { context: 'SAAA Form Clipboard Copy Fail', formName: definition.name } });
                    showNotification(`Failed to copy BBCode for "${definition.name}" to clipboard. Saving not defined.`, 'exclamation-triangle', 10000);
                });
            } else if (!bbCodeToCopy) {
                 showNotification(`Could not generate BBCode for "${definition.name}" to copy. Saving not defined.`, 'error', 10000);
            } else {
                showNotification(`Clipboard API not available. BBCode for "${definition.name}" not copied. Saving not defined.`, 'exclamation-triangle', 10000);
            }
            return false; // Prevent Firebase saving
        }

        // Existing generic key generation for non-SAAA forms or SAAA forms that might have specific logic above
        const formName = versionNames[bbCodeVersion] || `FormV${bbCodeVersion}`;
        
        let identifier = formData.patientName || formData.decedentName || formData.patientID || formData.decedentOOC || formData.lastName;
        if (Array.isArray(identifier)) identifier = identifier.join(', '); 

        const dateField = formData.date || formData.dateTime || formData.autopsyDate; 

        if (!identifier || !dateField) {
            let missing = [];
            if (!identifier) missing.push("an identifier (e.g., Patient/Decedent Name/ID)");
            if (!dateField) missing.push("a date field");
            showNotification(`To save this report (${formName}), please fill in at least ${missing.join(' and ')}.`, 'exclamation-circle');
            return false; 
        }
        key = `[${formName}] ${identifier} - ${dateField}`;
        console.log(`Using generic key for bbCodeVersion ${bbCodeVersion}: ${key}`);
    }
    // END <<-------------------------------- MODIFICATION HERE

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

const loadUserSavedReports = async (userId) => {
    if (!userId) {
        setSavedReports([]); // Clear reports if no user is selected
        setSelectedUserForSavedReports(null);
        return;
    }

    setIsLoadingUserReports(true);
    setSelectedUserForSavedReports(userId); // Store the currently selected user
    showNotification(`Loading reports for ${userId}...`, 'info-circle', 0); // Indefinite notification

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
                        key: reportKey, // This is the sanitized key used in Firebase
                        originalKey: report.originalKey,
                        bbCodeVersion: report.bbCodeVersion,
                        timestamp: report.timestamp,
                        authorName: report.authorName, // Assuming you store this
                        bbCode: report.bbCode, // Needed for 'Copy BBCode' in modal
                        // data: report.data // Only include if modal needs it for display, otherwise load on demand
                    });
                } else {
                    // Report is expired, mark for deletion
                    console.log(`Report "${report.originalKey || reportKey}" for user ${userId} is expired. Deleting.`);
                    const reportToDeletePath = `${userReportsPath}/${reportKey}`;
                    deletionPromises.push(remove(ref(database, reportToDeletePath)));
                    expiredCount++;
                }
            }

            // Wait for all deletions to complete
            if (deletionPromises.length > 0) {
                await Promise.all(deletionPromises);
                if (expiredCount > 0) {
                    showNotification(`${expiredCount} expired report(s) for ${userId} were automatically deleted.`, 'trash', 5000);
                }
            }

            // Sort reports by timestamp, newest first
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
        setSavedReports([]); // Clear reports on error
    } finally {
        setIsLoadingUserReports(false);
        // Remove the indefinite loading notification
        // This assumes your showNotification returns an ID that can be used with removeNotification
        // If not, you might need a different way to manage indefinite notifications.
        // For simplicity, we'll rely on the subsequent success/error notifications to override.
    }
};
const loadReportForUser = async (reportFirebaseKey, userId) => {
    if (!userId || !reportFirebaseKey) {
        showNotification('Cannot load report: User ID or Report Key is missing.', 'error');
        return;
    }

    const sanitizedUserId = userId.replace(/[.#$[\]/]/g, '_');
    // reportFirebaseKey is already sanitized as it comes from Firebase keys
    const reportPath = `savedReports/${sanitizedUserId}/${reportFirebaseKey}`;
    const reportRef = ref(database, reportPath);

    showNotification(`Loading report: ${reportFirebaseKey} for ${userId}...`, 'info-circle', 0);

    try {
        const snapshot = await get(reportRef);
        if (snapshot.exists()) {
            const reportData = snapshot.val();
            const loadedVersion = reportData.bbCodeVersion;
            const loadedBbCode = reportData.bbCode || '';
            const loadedFormData = reportData.data || {};

            // --- Fields managed by localStorage with expiry (similar to old loadReport) ---
            // This part might need adjustment if you're moving away from localStorage for these fields too.
            // For now, keeping it similar to your previous `loadReport` logic.
            const localStorageManagedFields = [
                'placeOfDeath', 'pronouncedTimeOfDeath', 'dateTime', 'department',
                'mannerOfDeath', 'coronerEmployee', 'coronerBadge', 'coronerRank',
                'coronerDiscord', 'phmcEmployee', 'phmcSignature'
            ];
            const currentTimestamp = Date.now().toString();
            localStorageManagedFields.forEach(field => {
                if (loadedFormData.hasOwnProperty(field) && loadedFormData[field]) {
                    localStorage.setItem(field, loadedFormData[field]);
                    localStorage.setItem(`${field}_timestamp`, currentTimestamp);
                }
            });
            // --- End localStorage management ---

            // Logic to handle loading into different form versions (like your old loadReport)
            if (bbCodeVersion === 2 && loadedVersion === 1) { // Loading Death Report into Coroner Email
                let modifiedBbCode = loadedBbCode.replace(/\[bold\]/g, '[b]').replace(/\[\/bold\]/g, '[/b]');
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
                        updatedDeathReport = modifiedBbCode;
                        notificationMessage = `Loaded report for ${loadedFormData.decedentName || reportData.originalKey} into main Death Report field.`;
                    } else {
                        updatedAdditionalReports = [...updatedAdditionalReports, modifiedBbCode];
                        notificationMessage = `Added report for ${loadedFormData.decedentName || reportData.originalKey} as an additional report.`;
                    }
                    return {
                        ...prevFormData, // Keep existing form data
                        ...loadedFormData, // Apply loaded data
                        decedentName: updatedName,
                        decedentOOC: updatedOoc,
                        deathReport: updatedDeathReport,
                        additionalReports: updatedAdditionalReports,
                    };
                });
                setParsedBBCode(''); // Clear any previously parsed BBCode
                showNotification(notificationMessage, 'plus-circle');

            } else { // Default loading for other cases
                setFormData(prev => ({ ...prev, ...loadedFormData })); // Merge, prioritizing loaded data for relevant fields
                setBbCodeVersion(loadedVersion);
                setParsedBBCode(loadedBbCode);
                showNotification(`Report "${reportData.originalKey || reportFirebaseKey}" loaded.`, 'upload');
            }
            setShowSavedReports(false); // Close the modal
        } else {
            showNotification(`Report not found in Firebase: ${reportFirebaseKey}`, 'error');
        }
    } catch (error) {
        console.error(`Error loading report ${reportFirebaseKey} for user ${userId}:`, error);
        Sentry.captureException(error, { extra: { context: 'loadReportForUser', userId, reportFirebaseKey } });
        showNotification(`Failed to load report: ${error.message}`, 'error');
    } finally {
        // Remove indefinite loading notification if one was set by showNotification
    }
};
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
const showNormalEasterEggDirectly = () => {
    setShowEasterEggModal(true);
    setEasterEggType('normal');
    // Optionally send a webhook for the normal manual trigger if desired
    // if (window.location.hostname === 'localhost') {
    //     sendEasterEggNotification('normal'); // Pass 'normal' type
    // }
};
const [lastWebhookIdentifier, setLastWebhookIdentifier] = useState(null);

const loadReport = (key) => {
    const reportData = localStorage.getItem(key);
    if (reportData) {
        try {
            const parsedData = JSON.parse(reportData);
            const loadedVersion = parsedData.bbCodeVersion;
            let loadedBbCode = parsedData.bbCode || '';
            const loadedFormData = parsedData.data || {};

            // --- Fields managed by localStorage with expiry ---
            const localStorageManagedFields = [
                'placeOfDeath',
                'pronouncedTimeOfDeath',
                'dateTime',
                'department',
                'mannerOfDeath', 
                'coronerEmployee',
                'coronerBadge',
                'coronerRank',
                'coronerDiscord',
                'phmcEmployee',
                'phmcSignature'
            ];

            // --- Update localStorage for managed fields when loading ---
            const timestamp = Date.now().toString(); // Get current timestamp for loaded data
            localStorageManagedFields.forEach(field => {
                if (loadedFormData.hasOwnProperty(field) && loadedFormData[field]) {
                    localStorage.setItem(field, loadedFormData[field]);
                    localStorage.setItem(`${field}_timestamp`, timestamp);
                    console.log(`Updated localStorage for ${field} from loaded report.`);
                } else {
                }
            });


            // --- Fancy spaghetti whatever the fuck for deathReport and coronerEmail idk (v2) ---
            if (bbCodeVersion === 2 && loadedVersion === 1) {

                if (loadedBbCode) {
                    loadedBbCode = loadedBbCode.replace(/\[bold\]/g, '[b]').replace(/\[\/bold\]/g, '[/b]');
                }

                let notificationMessage = '';
                const currentDeathReportIsEmpty = !formData.deathReport || formData.deathReport.trim() === '';

                if (currentDeathReportIsEmpty) {
                    notificationMessage = `Loaded report for ${loadedFormData.decedentName || key} into main Death Report field.`;
                } else {
                    notificationMessage = `Added report for ${loadedFormData.decedentName || key} as an additional report.`;
                }

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

                    if (!prevFormData.deathReport || prevFormData.deathReport.trim() === '') {
                        updatedDeathReport = loadedBbCode;
                    } else {
                        updatedAdditionalReports = [...updatedAdditionalReports, loadedBbCode];
                    }

                    return {
                        ...prevFormData,
                        ...loadedFormData, // Apply loaded data first
                        decedentName: updatedName,
                        decedentOOC: updatedOoc,
                        deathReport: updatedDeathReport,
                        additionalReports: updatedAdditionalReports,
                    };
                });

                setParsedBBCode('');
                showNotification(notificationMessage, 'plus-circle');
                setShowSavedReports(false);

            } else {
                 // --- Default Loading Logic (for all other cases) ---
                setFormData(prevFormData => {
                    // Create a new state object based on the loaded data
                    let newState = { ...loadedFormData };

                    // If loading *into* v2 (Coroner Email), handle potential merging
                    if (bbCodeVersion === 2 && loadedVersion === 2) {
                         if (prevFormData.decedentName && loadedFormData.decedentName) {
                            newState.decedentName = `${prevFormData.decedentName}, ${loadedFormData.decedentName}`;
                        }
                        if (prevFormData.decedentOOC && loadedFormData.decedentOOC) {
                            newState.decedentOOC = `${prevFormData.decedentOOC}, ${loadedFormData.decedentOOC}`;
                        }
                    }

                    for (const key in prevFormData) {
                        if (!newState.hasOwnProperty(key)) {
                            newState[key] = prevFormData[key];
                        }
                    }

                    return newState;
                });

                setBbCodeVersion(loadedVersion);
                setParsedBBCode(loadedBbCode);
                showNotification(`Report loaded from ${key}`, 'upload');
                setShowSavedReports(false);
            }

        } catch (error) {
            console.error("Error parsing report data:", error);
            Sentry.captureException(error, { extra: { context: 'loadReport Parse Error', key: key } });
            localStorage.removeItem(key);
            showNotification(`Invalid report data deleted: ${key}`, 'trash');
            loadSavedReports();
        }
    } else {
        console.warn(`Attempted to load non-existent report with key: ${key}`);
        showNotification(`Report not found: ${key}`, 'warning');
    }
};
    const toggleSavedReports = () => {
        setShowSavedReports(prev => !prev);
    };

    const loadSavedReports = () => {
        const saved = [];
        const now = Date.now();
        const thirtyOneDays = 31 * 24 * 60 * 60 * 1000; // 31 days in milliseconds

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.includes(' - ')) {
                const reportData = localStorage.getItem(key);
                if (reportData) {
                    try {
                        const parsedData = JSON.parse(reportData);
                        if (parsedData.timestamp && now - parsedData.timestamp < thirtyOneDays) {
                            // Report is not expired
                            saved.push(key);
                        } else {
                            // Report is expired, delete it
                            localStorage.removeItem(key);
                            showNotification(`Expired report deleted: ${key}`, 'trash');
                        }
                    } catch (error) {
                        console.error("Error parsing report data:", error);
                        // Handle parsing errors (e.g., invalid JSON)
                        localStorage.removeItem(key); // Remove potentially corrupted data
                        showNotification(`Invalid report data deleted: ${key}`, 'trash');
                    }
                }
            }
        }
        setSavedReports(saved);
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
    const [showAgencyGroupSelectorModal, setShowAgencyGroupSelectorModal] = useState(false);
    const [hideAgencyGroupSelectorPreference, setHideAgencyGroupSelectorPreference] = useState(false);


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

    const handleSelectAgencyGroup = (group) => {
        setSelectedAgencyGroup(group);
        localStorage.setItem('selectedAgencyGroup', group);
        setShowAgencyGroupSelectorModal(false);
        if (hideAgencyGroupSelectorPreference) {
            localStorage.setItem('hideAgencyGroupSelectorPreference', 'true');
        }
        // Reset bbCodeVersion or select a default for the new group
        const defaultFormForGroup = formDefinitions.find(form => form.group === group);
        if (defaultFormForGroup) {
            setBbCodeVersion(defaultFormForGroup.version);
        } else {
            // Fallback if no forms are defined for the group yet
            // Or, you might want to set bbCodeVersion to null and prompt form selection
            setBbCodeVersion(formDefinitions[0]?.version || 1); // Default to the very first form or 1
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
        if (definition && definition.group === selectedAgencyGroup) {
            setBbCodeVersion(version);
            setShowAgencySelector(false);
                        setShowPHMCModal(false);
            setLastWebhookIdentifier(null);
            showNotification(`Switched to ${definition.name}`, 'exchange-alt');
        } else if (definition) {
            showNotification(`This form belongs to the ${definition.group} group. You are currently in the ${selectedAgencyGroup} group. Please change agency group if you wish to use this form.`, 'warning', 7000);
        } else {
            showNotification(`Selected form version ${version} is not defined.`, 'error');
        }
    };

    const generateTitle = () => {
        if (bbCodeVersion === 1) { // Death Report
            const { typeOfDeath, decedentName, decedentOOC, dateTime } = formData;
            // Added a check for dateTime to prevent "Invalid Date"
            const date = dateTime ? new Date(dateTime).toLocaleDateString('en-US') : 'N/A';
            return `[${typeOfDeath || 'N/A'}] ${decedentName || 'N/A'} ((${decedentOOC || 'N/A'})) - ${date}`;
        // Coroner Email
        } else if (bbCodeVersion === 2) {
            const { decedentName, decedentOOC } = formData;
            return `Coroner Report - ${decedentName || 'N/A'} | ((${decedentOOC || 'N/A'}))`;
    // Autopsy Form
        } else if (bbCodeVersion === 4) {
            const { decedentName, decedentOOC } = formData;
            return `CASE ## ${decedentName || 'N/A'} ((${decedentOOC || 'N/A'})) | SENT/COMPLETED/PENDING`;
// Civilian Forms
        } else if (bbCodeVersion === 3) { // Patient File - Advanced
            const { patientName } = formData;
            return `[Medical Information Registration] -  ${patientName || 'N/A'}`;
        } else if (bbCodeVersion === 24) { // Medical Release Records
            const { patientFirstName,  patientLastName } = formData;
            return `[RELEASE REQUEST] ${patientFirstName || ''} ${patientLastName || ''} `.trim();
        } else if (bbCodeVersion === 25 || bbCodeVersion === 26) { // Patient File - Basic (26 is not in formDefinitions, but keeping logic)
            const { patientName } = formData;
            return `[Medical Information Registration] -  ${patientName || 'N/A'}`;
// PHMC Email or other forms
        } else {
            // Fallback for other PHMC forms or if specific fields aren't present
            const definition = getFormDefinition(bbCodeVersion);
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
        'phmcEmployee', 'phmcEmployeeSignature', 'phmcEmployeeLastName', 'phmcRank', // Added PHMC fields
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
        'phmcEmployee', 'phmcEmployeeSignature', 'phmcEmployeeLastName', 'phmcRank',
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

useEffect(() => {
    const welcomeUserAndSyncData = () => {
        let userWelcomed = false;
        const currentTimestamp = Date.now().toString();
        let madeChanges = false;
        let updatedUserName = null;

        // --- Coroner Data Sync ---
        if (formData.coronerEmployee) {
            const selectedCoronerNameInForm = formData.coronerEmployee;
            if (!userWelcomed) { // Welcome only once if both are filled
                showNotification(`Welcome back ${selectedCoronerNameInForm}, getting your information...`, 'info-circle', 3000);
                userWelcomed = true;
            }
            updatedUserName = selectedCoronerNameInForm;

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
                    localStorage.setItem('coronerEmployee_timestamp', currentTimestamp);
                    localStorage.setItem('coronerRank_timestamp', currentTimestamp);
                    localStorage.setItem('coronerBadge_timestamp', currentTimestamp);
                    localStorage.setItem('coronerDiscord_timestamp', currentTimestamp);
                    localStorage.setItem('coronerPHNumber_timestamp', currentTimestamp);
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
            }
        }

        // --- PHMC Employee Data Sync ---
        if (formData.phmcEmployee) {
            const selectedPhmcEmployeeName = formData.phmcEmployee;
            if (!userWelcomed) {
                showNotification(`Welcome back ${selectedPhmcEmployeeName}, getting your information...`, 'info-circle', 3000);
                userWelcomed = true;
            }
            if (!updatedUserName) updatedUserName = selectedPhmcEmployeeName;

            const phmcDetailsFromDataJs = phmcListData.find(p => p.name === selectedPhmcEmployeeName);
            if (phmcDetailsFromDataJs) {
                const updatesToForm = {};
                let needsFormUpdate = false;
                const phmcSignatureFromDb = phmcDetailsFromDataJs.signature || '';
                const phmcLastNameFromDb = phmcDetailsFromDataJs.lastName || '';
                const phmcRankFromDb = phmcDetailsFromDataJs.category || phmcDetailsFromDataJs.rank || '';


                if (formData.phmcEmployeeSignature !== phmcSignatureFromDb) {
                    updatesToForm.phmcEmployeeSignature = phmcSignatureFromDb;
                    localStorage.setItem('phmcEmployeeSignature', phmcSignatureFromDb);
                    localStorage.setItem('phmcEmployeeSignature_timestamp', currentTimestamp);
                    needsFormUpdate = true;
                }
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
                    localStorage.setItem('phmcEmployee_timestamp', currentTimestamp);
                    localStorage.setItem('phmcEmployeeSignature_timestamp', currentTimestamp);
                    localStorage.setItem('phmcEmployeeLastName_timestamp', currentTimestamp);
                    localStorage.setItem('phmcRank_timestamp', currentTimestamp);
                }
            } else {
                showNotification(`The previously selected PHMC staff "${selectedPhmcEmployeeName}" is no longer valid and has been cleared.`, 'warning', 7000);
                const fieldsToClear = ['phmcEmployee', 'phmcEmployeeSignature', 'phmcEmployeeLastName', 'phmcRank'];
                fieldsToClear.forEach(field => {
                    localStorage.removeItem(field);
                    localStorage.removeItem(`${field}_timestamp`);
                });
                setFormData(prev => ({
                    ...prev,
                    phmcEmployee: '', phmcEmployeeSignature: '', phmcEmployeeLastName: '', phmcRank: '',
                }));
            }
        }

        if (madeChanges && updatedUserName) {
            showNotification(`Data for ${updatedUserName} has been synchronized with the latest records.`, 'check-circle', 5000);
        }
    };

    // Only run if there's data to sync against (i.e., after Firebase data is loaded)
    if (phmcListData.length > 0 || coronerListData.length > 0) {
        welcomeUserAndSyncData();
    }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [phmcListData, coronerListData]); // Re-run if staff lists change. `showNotification` should be stable.

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
                        phmcEmployeeSignature: employeeDetails.signature || '',
                        phmcEmployeeLastName: employeeDetails.lastName || '',
                        // Use category as primary for rank, fallback to rank field if category isn't rank-like
                        phmcRank: employeeDetails.category || employeeDetails.rank || '',
                    };
                    setFormData(prevFormData => ({
                        ...prevFormData,
                        ...updates
                    }));

                    // Explicitly save phmcEmployee and its timestamp here as well
                    localStorage.setItem('phmcEmployee', selectedOption.value);
                    localStorage.setItem('phmcEmployee_timestamp', timestamp);
                    // Save other PHMC details
                    localStorage.setItem('phmcEmployeeSignature', updates.phmcEmployeeSignature);
                    localStorage.setItem('phmcEmployeeSignature_timestamp', timestamp);
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
                        coronerRank: coronerDetails.rank || '',
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
                fieldsToClearInForm.phmcEmployeeSignature = '';
                fieldsToClearInForm.phmcEmployeeLastName = '';
                fieldsToClearInForm.phmcRank = '';
                lsKeysToRemove.push(
                    'phmcEmployeeSignature', 'phmcEmployeeSignature_timestamp',
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

// New main handler function
const handleCopyAndNotifyWrapper = async () => {
    await handleFormCopyAndNotify({
        formData,
        bbCodeVersion,
        selectedAgencyGroup,
        getBBCodeContent,    // This is already a method in App.js
        getFormDefinition,   // This is imported from formDefinitions.js
        saveReport,          // This is already a method in App.js
        showNotification,    // This is already a method in App.js
        removeNotification,  // This is already a method in App.js
        handleAgencySelect,  // This is already a method in App.js
        setLastWebhookIdentifier, // State setter from App.js
        lastWebhookIdentifier,    // State from App.js
        commitInfo,          // State from App.js
        database,            // Imported in App.js from firebase.js
    });
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
                        />
                    )}
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
                <span className="floating-button-text">Report Bug - Feature</span>
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
                                    <h3>Changelog - Version 2.5.0 -  </h3>
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
        <li><strong>Firebase Deployment:</strong>
            <ul>
                <li>Migrated core application data (staff lists, agency details, form dropdown options) to Firebase Realtime Database.</li>
            </ul>
        </li>
        <li><strong>Dynamic Data Management:</strong>
            <ul>
                <li>Coroner Rank Modal now directly updates coroner rank and category in Firebase.</li>
                <li>Employee Management (Add/Remove Staff) now updates Firebase records for both Coroners and PHMC staff.</li>
            </ul>
        </li>
        <li><strong>Bug Fixes & Minor Tweaks:</strong>
            <ul>
                <li>Cleaned up redundant code and unused variables.</li>
            </ul>
        </li>
    </ul>
    - frosty x Austin Rhodes (Bailey - i3aileyy)
</div>
                            </div>
                        </div>
                    )}

                    <div className="button-group">

                     <Button
                            type="button"
                            variant="phmc"
                            className="changelog-button"
                            onClick={() => window.open('https://phmc.gta.world/', '_blank')}
                        >
                            <i className="fas fa-hospital"></i>
                            PHMC
                        </Button>
                                <Button
                                    className="changelog-button"
                                    variant='secondary'
                                    onClick={toggleAgencySelector}
                                >
                                    <i className="fas fa-exchange-alt"></i>
                                    Select {selectedAgencyGroup} Form
                                </Button>

                        {(bbCodeVersion === 1 || bbCodeVersion === 2 || bbCodeVersion === 4 || bbCodeVersion === 18) && (
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

                    </div>
                    <div className="notification-container">
            {notifications.map((notif) => (
                <Notification
                    key={notif.id}
                    message={notif.message}
                    icon={notif.icon}
                    onDismiss={() => removeNotification(notif.id)}
                    // Pass other necessary props
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
                    <Modal.Title>Bug / Feature Request</Modal.Title>
                                        <Button variant="secondary" className="close" onClick={() => {
                                            setShowFeatureRequestModal(false);
                                            setFeatureRequest(''); // Reset state on close
                                            setDiscordName(''); // Reset state on close
                                        }}>
                                            CLOSE
                                        </Button>

                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                value={featureRequest}
                                onChange={(e) => setFeatureRequest(e.target.value)}
                                placeholder="If you have located a bug, please provide as much information as possible (Pictures are also very helpful!). If you are requesting a feature, please provide a detailed description of the feature you would like to see."
                            />
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
                    <Button variant="secondary" onClick={() => setShowFeatureRequestModal(false)}>
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
                show={showPHMCModal}
                onHide={() => setShowPHMCModal(false)}
                title={switchableModalTitle}
                forms={switchableFormsList}
                handleFormSelect={handleAgencySelect} // Pass the existing handler
                isMobile={isMobile}
            />

<EmsAmaModal
    show={showEmsAmaModal}
    onHide={() => setShowEmsAmaModal(false)}
    showNotification={showNotification}
    commitInfo={commitInfo}
/>

<div className="button-group">
                            <Button
                                variant="primary"
                                onClick={() => setShowBBCode(!showBBCode)}
                                className="toggle-bbcode-button"
                                style={{ marginRight: '10px' }}
                            >
                                <i className={`fas ${showBBCode ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                {showBBCode ? ' Hide BBCode' : ' Show BBCode'}
                            </Button>
                            
                            <Button 
                            variant="success"
                            onClick={saveReport}>Save Report</Button>

            <SavedReportsModal
                show={showSavedReports}
                onClose={toggleSavedReports}
                savedReports={savedReports}
                loadReport={loadReport}
                deleteReport={deleteReport}
                getBBCodeContent={getBBCodeContent} 
                showNotification={showNotification}
                    reportsForSelectedUser={savedReports} // savedReports state from App.js
                    onEmployeeSelect={loadUserSavedReports} // Pass the new function
                    employeeOptions={combinedStaffOptions} // Your existing staff options
                    isLoadingReports={isLoadingUserReports} // Pass the new loading state
                    loadReportForUser={loadReportForUser} // You'll update this function next
                    deleteReportForUser={deleteReportForUser} // You'll update this function next
    currentCoronerEmployee={formData.coronerEmployee}
    currentPhmcEmployee={formData.phmcEmployee}

            />
            <WebhookModal
                show={showWebhookModal}
                onClose={() => setShowWebhookModal(false)}
                webhookTitle={webhookTitle}
                setWebhookTitle={setWebhookTitle}
                webhookMessage={webhookMessage}
                setWebhookMessage={setWebhookMessage}
                onSubmit={handleWebhookSubmit} // Pass updated handler
                onSubmitPhmc={handlePhmcWebhookSubmit} // Pass updated handler
                showNotification={showNotification} // Pass notification function
                commitInfo={commitInfo} // Pass commit info
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
    (bbCodeVersion === 1 || bbCodeVersion === 2 || bbCodeVersion === 3 || bbCodeVersion === 4 ||  bbCodeVersion === 24 || bbCodeVersion === 25) && (
        <>
            <h1>Generated Title</h1>
            <div className="title-output">
                <pre>{generateTitle()}</pre>
            </div>
        </>
    )
}                
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

                    {
    (bbCodeVersion === 1 || bbCodeVersion === 2 || bbCodeVersion === 3 || bbCodeVersion === 4 ||  bbCodeVersion === 24 || bbCodeVersion === 25) && (
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
<Button
    type="button"
    className="changelog-button" // Or your existing class
    onClick={handleCopyAndNotifyWrapper} // Use the new wrapper
>
    <i className="fas fa-clipboard"></i>
    {getCopyButtonText()}
</Button>
                    </div>

{bbCodeVersion === 1 && (
    <div className="image-container">
        <a href="https://phmc.gta.world/posting.php?mode=post&f=267" target="_blank" rel="noopener noreferrer" className={deathReportClass} title="Easter Bunny goes bounce bounce">
            <img
                src={deathReportImage}
                height={350}
                width={350}
                className="Center"
                alt="Death Reports Link"
            />
        </a>
    </div>
)}
{bbCodeVersion === 4 && (
    <div className="image-container">
        <a href="https://phmc.gta.world/posting.php?mode=post&f=266" target="_blank" rel="noopener noreferrer" className={deathReportClass} title="Easter Bunny goes bounce bounce">
            <img
                src={deathReportImage}
                height={350}
                width={350}
                className="Center"
                alt="Death Reports Link"
            />
        </a>
    </div>
)}

 {bbCodeVersion === 24 && (
    <div className="image-container">
        <a href="https://phmc.gta.world/posting.php?mode=post&f=109" target="_blank" rel="noopener noreferrer" className={civilianPaperworkClass} title="Easter Bunny goes bounce bounce">
            <img
                src={civilianPaperworkImage}
                height={350}
                width={350}
                className="Center"
                alt="Request Medical Records"
            />
        </a>
    </div>
)}
 {bbCodeVersion === 3 || bbCodeVersion === 25 && (
    <div className="image-container">
        <a href="https://phmc.gta.world/posting.php?mode=post&f=221" target="_blank" rel="noopener noreferrer" className={civilianPaperworkClass} title="Easter Bunny goes bounce bounce">
            <img
                src={civilianPaperworkImage}
                height={350}
                width={350}
                className="Center"
                alt="Basic Patient File"
            />
        </a>
    </div>
)}
{selectedAgencyGroup === 'PHMC' && bbCodeVersion !== 1 && bbCodeVersion !== 2  && bbCodeVersion !== 3 && bbCodeVersion !== 4 && bbCodeVersion !== 24 && bbCodeVersion !== 25 && bbCodeVersion !== 26 && (
    <div className="image-container">
        <a href="https://phmc.gta.world/viewforum.php?f=97" target="_blank" rel="noopener noreferrer" className={civilianPaperworkClass} title="Easter Bunny goes bounce bounce">
            <img
                src={civilianPaperworkImage}
                height={350}
                width={350}
                className="Center"
                alt="Staff Area - Medical Records"
            />
        </a>
    </div>
)}
{bbCodeVersion === 30 && (
    <div className="image-container">
        <a href="https://saaa.gta.world/posting.php?mode=post&f=71" target="_blank" rel="noopener noreferrer">
            <img
                src={saaaLogo}
                height={350}
                width={350}
                className="Center"
                alt="Entry Recruitment Form"
            />
        </a>
    </div>
)}
{bbCodeVersion === 31 && (
    <div className="image-container">
        <a href="https://saaa.gta.world/posting.php?mode=post&f=28" target="_blank" rel="noopener noreferrer">
            <img
                src={saaaLogo}
                height={350}
                width={350}
                className="Center"
                alt="Flight School Application Form"
            />
        </a>
    </div>
)}
{bbCodeVersion === 32 && (
    <div className="image-container">
        <a href="https://saaa.gta.world/posting.php?mode=post&f=7" target="_blank" rel="noopener noreferrer">
            <img
                src={saaaLogo}
                height={350}
                width={350}
                className="Center"
                alt="Aircraft Registration Form"
            />
        </a>
    </div>
)}

{bbCodeVersion === 33 && (
    <div className="image-container">
        <a href="https://saaa.gta.world/posting.php?mode=post&f=112" target="_blank" rel="noopener noreferrer">
            <img
                src={saaaLogo}
                height={350}
                width={350}
                className="Center"
                alt="Airline Companies Registration"
            />
        </a>
    </div>
)}
{bbCodeVersion === 34 && (
    <div className="image-container">
        <a href="https://saaa.gta.world/posting.php?mode=post&f=216" target="_blank" rel="noopener noreferrer">
            <img
                src={saaaLogo}
                height={350}
                width={350}
                className="Center"
                alt="Heliport Registration Form"
            />
        </a>
    </div>
)}

                </div>
                            </div>
                            <Footer />
                                    </div>
    );
}

export default App;
