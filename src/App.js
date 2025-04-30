import React, { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import '@fortawesome/fontawesome-free/css/all.min.css';
import Notification from './components/Notification';
import { Modal, Form, Button, Dropdown } from 'react-bootstrap';
import domtoimage from 'dom-to-image';
import SavedReportsModal from './components/SavedReportsModal'; 
import getRelevantFields from './components/RevelantFields';
import AgencySelector from './components/AgencySelector';
import Footer from './components/Footer';
import SeasonalEvents from './components/SeasonalEvents';
import HeaderInfo from './components/HeaderInfo';
import Snowfall from 'react-snowfall'; 
import EasterEggImages from './EasterEggParticles'; 
import * as Sentry from "@sentry/react";
import WebhookModal from './components/WebhookModal'; 
import CoronerRankModal from './components/CoronerRankModal'; 
import CoronerTipsModal from './components/CoronerTipsModal'; 
import ToolsDropdown from './ToolsDropdown'; // Adjust the path if needed
import EasterEggModal from './components/EasterEggModal'; // Adjust path if needed
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
    generatePsychEvalPBC
} from './bbcode-generators'; 
import {
    CommNotePHMC,
    CommNotePBC,
    DeathReport,
    CoronerEmail,
    PatientAdvanced,
    MentalHealth,
    EmailInternal,
    Surgical,
    PhysEval,
    AgencyFeedback,
    EmergencyForm,
    GeneralConsult,
    MedicalRelease,
    BasicPatientFile,
    Shrink
} from './field-data';

// logos
import email from './assets/email.png'
import Civilian from './assets/Civilian.png'
import nurse from './assets/nurse.png'
import PHMCLogo from './assets/phmc.png'
import corpse from './assets/corpse.png'
import BusinessCardImage from './assets/business-card.png';
import phmcpaletobay from './assets/phmcpaletobaylogo.png'
import './assets/fonts/Poppins-Medium.ttf';
import {
    PurposeMedicalInformationRelease,
    PurposeMedicalInformationReleaseFormat,
    patientBloodType,
    MedicalRecordsRelease,
    followup,
    departmentLarge,
    assignedDepartment,
    painLevel,
    temperature,
    patientTitle,
    patientPhone,
    heartRate,
    breathing,
    bloodPressure,
    findings,
    lungs,
    pupils,
    wounds,
    ecg,
    sono,
    lab,
    admission,
    phmcList,
    coronerList,
    BodyMassIndex,
    patientConsent,
    procedureGood,
    complications,
    patientJob,
    patientJobRisks,
    patientAllergiesRisk,
    patientOther,
    patientMedicineRegular,
    predisposition,
    maritalStatus,
    numberChildren,
    financialStatus,
    dnr,
    dnrOrder,
    attorney,
    departmentFullName,
    Appearance,
    Behavior,
    bloodOxy,
    Speech,
    Mood,
    Affect,
    Risk,
    ThoughtProcess,
    ThoughtContent,
    Insight,
    Cognition,
    phmcRank,
    agencyData,
    drugList
} from './data';

// css fun

import './App.css';
import './buttons.css'

import 'react-bootstrap-typeahead/css/Typeahead.css';
// Automated Imports from field-data
function App() {
    const [isMobile, setIsMobile] = useState(false);
    const [formData, setFormData] = useState({
        coronerRank: 'Forensic Attendant',
        placeOfDeath: '',
        evidenceLockerID: '',
        evidenceLocker: '',
        department: '',
        dateTime: '',
        serialNumber: '',
        decedentName: '',
        phmcEmployee: '',
        phmcSignature: '',
        pronouncedTimeOfDeath: '',
        synopsis: '',
        probableCauseOfDeath: '',
        mannerOfDeath: '',
        typeOfDeath: '',
        coronerEmployee: '',
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
        lastName: '',
        bloodOxy: '',
        coronerBadge: '',
        // email stuff
        additionalImages: '',
        requestingOfficer: '',
        coronerDiscord: '',
        coronerPHNumber: '50056',
        deathReport: '',
        additionalReports: [],
        showAdditionalReports: false,
        internalReport: '',
        internalAdditionalReports: '',
        policeNotification: '',
        treatmentLocation: '',
        moreDeathReports: [''],
        // surgical operations fields
        extraStaff: [],
        patientName: '',
        patientAllergies: '',
        surgeryComplications: '',
        surgeryProcedures: '',
        drugType: '',
        
        postDrugtype: '',
        surgicalSummery: '',
        surgeryTime: '',
        // physical evaluation fields
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
        // dental fields
        PatientMedicalRecord: '',
        PatientName: '',
        patientChewing: '',
        patientPriority: '',
        patientMedicine: '',
        patientNewMedicine: '',
        patientTreatment: '',
        patientDiagnosis: '',
        patientPrescription: '',
        patientSummary: '',
        date: '',
        // Medical Consultation - Internal Medicine 
        patientRace: '',
        patientDiscord: '',
        race: '',
        patientMedicalRecord: '',
        patientGender: '',
        patientDateofBirth: '',
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
        // New fields for Medical Consultation Internal Medicine 2
        patientResperation: '',
        patientConsultation: '',
        patientPerscription: '',
        patientSummaryConsultation: '',
        patientCondition: '',
        patientNotes: '',
        //gyne stuff
        patientBaggageofParents: '',
        oneFetus: false,
        twoFetuses: false,
        threeFetuses: false,
        fourFetuses: false,
        // New fields for Obstetrics & Gynecology
        patientContractions: '', // Added
        patientBleeding: '', // Added
        patientDiscomfort: '', // Added
        patientFatter: '', // Added
        patientBabyGender: '', // Added
        patientKnowBabyGender: '', // Added
        patientUltraSummary: '', // Added
        patientWellWomanExam: '', // Added
        patientLastWellWomanExam: '', // Added
        patientPapResults: '', // Added
        patientSTI: '', // Added
        patientSTIResults: '', // Added
        patientBloodAnalysis: '', // Added
        patientBloodAnalysisResults: '', // Added
        patientUrine: '', // Added
        patientUrineResults: '', // Added
        patientPap: '', // Added
        patientDateofPregnancy: '', // Added
        patientFetalMeasurements: '', // Added
        patientCurrentMedicine: '', // Missing field for current medications
        patientAdditionalPregnancy: '', // Missing field for previous pregnancies status
        patientJobTasks: '', // Missing field for job duties
        patientLivingHabits: '', // Missing field for living habits
        patientPreHealth: '', // Missing field for pre-pregnancy health
        patientPregProblems: '', // Missing field for pregnancy problems
        patientPartnerName: '', // Missing field for partner name
        patientPartnerPH: '', // Missing field for partner phone
        patientPartnerDiscord: '', // Missing field for partner discord
        // mental health stuff
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
        patientEdu: ``,
        patientDev: ``,
        patientLegal: ``,
        patientSpiritual: ``,
        // Yes / No Values - im really lazy to code something better here
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
        //surgical ops v2 overhaul
        patientComplaint: '',
        triageNoPain: false,
        triageNormalPain: false,
        triageMildPain: false,
        triageSeverePain: false,
        triageCriticalPain: false,
        // surgical ops v2 temperature
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
        lab: [''],
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
        MedicalRecordsRelease: [],
        PurposeMedicalInformationReleaseFormat: [],
        PurposeMedicalInformationRelease: '',
        PurposeMedicalInformationReleaseFormat: '',
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
        patientLastName: '',
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
        // new values
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
        patientTherapyMedicine: '',
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
    });
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
    
    const [isUploading, setIsUploading] = useState(false);
    const [isJohnDoe, setIsJohnDoe] = useState(false);
    const [isJaneDoe, setIsJaneDoe] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [showUpdateNotification, setShowUpdateNotification] = useState(false); // New state for notification visibility
    const [commitInfo, setCommitInfo] = useState({ sha: '', date: null });
    const [showPHMCModal, setShowPHMCModal] = useState(false);
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

    const [bbCodeVersion, setBbCodeVersion] = useState(() => {
        const storedVersion = localStorage.getItem('bbCodeVersion');
        return storedVersion ? parseInt(storedVersion, 10) : 1;
    });

    useEffect(() => {
        localStorage.setItem('bbCodeVersion', bbCodeVersion.toString());
    }, [bbCodeVersion]);
    // Coroner Tips Handling
    const [showCoronerTips, setShowCoronerTips] = useState(false);

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
    
// Feature Request Handling
const [showRequestingOfficerInput, setShowRequestingOfficerInput] = useState(false);

    const [showFeatureRequestModal, setShowFeatureRequestModal] = useState(false);
    const [featureRequest, setFeatureRequest] = useState('');
    const [discordName, setDiscordName] = useState('');
    const [showMissingEmployeeModal, setShowMissingEmployeeModal] = useState(false);
    const [requestType, setRequestType] = useState('');
    const [isRemoveStaff, setIsRemoveStaff] = useState(false); 
    const [missingEmployeeData, setMissingEmployeeData] = useState({
        coronerName: '',
        coronerDiscord: '',
        coronerRank: '',
        coronerPHNumber: '',
        coronerEmployee: '', // Requesting coroner
        coronerBadge: '',
        phmcEmployee: '',    // Requesting PHMC staff
        staffToRemove: [],   // Keep for multi-select removal
        authorizedBy: '',    // Keep for removal authorization
    });

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
    let requestActionTitle = ''; // For the embed title

    // --- Logic based on isJohnDoe, isJaneDoe, isRemoveStaff ---
    if (isJohnDoe || isJaneDoe) { // Handle ADD requests
        const isCoronerRequest = isJohnDoe;
        requestActionTitle = `➕ Missing ${isCoronerRequest ? 'Coroner' : 'Hospital Staff'} Addition Request`;
        let requiredFields = [];

        if (isCoronerRequest) {
            requiredFields = ['coronerName', 'coronerDiscord', 'coronerRank', 'coronerBadge', 'coronerEmployee'];
        } else { // isJaneDoe (addPhmc)
            requiredFields = ['coronerName', 'coronerDiscord', 'coronerRank', 'phmcEmployee'];
        }

        const emptyFields = requiredFields.filter(key => !missingEmployeeData[key]?.trim());
        if (emptyFields.length > 0) {
            showNotification(`Please fill in all required fields for adding staff. Missing: ${emptyFields.join(', ')}`, 'exclamation-circle');
            return;
        }

        const requester = isCoronerRequest ? missingEmployeeData.coronerEmployee : missingEmployeeData.phmcEmployee;

        // --- Construct ADD Embed ---
        embedData = {
            title: requestActionTitle,
            color: isCoronerRequest ? 0x8B0000 : 0x00008B, // Dark Red for Coroner, Dark Blue for PHMC
            fields: [
                { name: "Requested By", value: requester || "Unknown", inline: false },
                { name: "Name to Add", value: missingEmployeeData.coronerName || "N/A", inline: true },
                { name: isCoronerRequest ? "Discord Tag" : "Department/Discord", value: missingEmployeeData.coronerDiscord || "N/A", inline: true },
                { name: "Rank/Position", value: missingEmployeeData.coronerRank || "N/A", inline: true },
            ],
            timestamp: new Date().toISOString(),
            footer: { text: `Submitted via PHMC Forms Tool - v${commitInfo.sha || 'N/A'}` }
        };
        if (isCoronerRequest && missingEmployeeData.coronerBadge?.trim()) {
            embedData.fields.push({ name: "Badge", value: missingEmployeeData.coronerBadge, inline: true });
        }
        if (missingEmployeeData.coronerPHNumber?.trim()) {
            embedData.fields.push({ name: "Phone Number", value: missingEmployeeData.coronerPHNumber, inline: true });
        }
        const dataJsEntry = `{ name: '${missingEmployeeData.coronerName || 'MISSING_NAME'}', ${isCoronerRequest ? `badge: '${missingEmployeeData.coronerBadge || 'MISSING_BADGE'}', ` : ''}${isCoronerRequest ? `phNumber: '${missingEmployeeData.coronerPHNumber || ''}', ` : ''}rank: '${missingEmployeeData.coronerRank || 'MISSING_RANK'}', discord: '${missingEmployeeData.coronerDiscord || 'MISSING_DISCORD'}', category: '${missingEmployeeData.coronerRank || 'MISSING_CATEGORY'}' },`;

        embedData.fields.push({ name: "Suggested data.js Entry", value: `\`\`\`javascript\n${dataJsEntry}\n\`\`\``, inline: false });
        // --- End ADD Embed ---

        submissionValid = true;
        successMessage = 'Addition request submitted! This will be reviewed soon.';

    } else if (isRemoveStaff) { // Handle REMOVE request
        requestActionTitle = "➖ Staff Removal Request";
        // --- Validation for REMOVE ---
        if (!missingEmployeeData.staffToRemove || missingEmployeeData.staffToRemove.length === 0) {
            showNotification('Please select at least one staff member to remove.', 'warning');
            return;
        }
        if (!missingEmployeeData.authorizedBy?.trim()) {
            showNotification('Please enter your name in the "Authorized By" field.', 'warning');
            return;
        }
        // --- End Validation ---

        // --- Construct REMOVE Embed ---
        embedData = {
            title: requestActionTitle,
            color: 0xFFA500, // Orange color for removal/warning
            fields: [
                { name: "Authorized By", value: missingEmployeeData.authorizedBy, inline: false },
                {
                    name: `Staff to Remove (${missingEmployeeData.staffToRemove.length})`,
                    value: missingEmployeeData.staffToRemove.join('\n') || "None selected", // List names on new lines
                    inline: false
                },
            ],
            timestamp: new Date().toISOString(),
            footer: { text: `Submitted via PHMC Forms Tool - v${commitInfo.sha || 'N/A'}` }
        };
        // --- End REMOVE Embed ---

        submissionValid = true;
        successMessage = 'Removal request submitted! This will be reviewed soon.';

    } else {
        showNotification('Please select an action (Add Coroner, Add Staff, or Remove Staff).', 'warning');
        return;
    }

    // --- Common Submission Logic ---
    if (submissionValid) {
        try {
            const response = await fetch(webhookURL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: `<@228306972204597248>`, // Ping user
                    embeds: [embedData] // Send the constructed embed
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
                showNotification(successMessage, 'check-circle');
                setShowMissingEmployeeModal(false);
                // Reset form data including removal fields
                setMissingEmployeeData({
                    coronerName: '', coronerDiscord: '', coronerRank: '', coronerPHNumber: '',
                    coronerEmployee: '', coronerBadge: '', phmcEmployee: '',
                    staffToRemove: [], authorizedBy: '' // Ensure reset
                });
                // Reset radio button states
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
const uniqueCoronerRanks = [...new Set(coronerList.map(c => c.rank))].sort();
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
        description = `Rank update requested for **${selectedEmployee}**.`;
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
            showNotification(`Coroner info "${notificationValue}" submitted successfully!`, 'check-circle');
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
                    content: `<@228306972204597248>`, // Optional: Ping a specific user/role
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
    const phmcGroupedOptions = Object.entries(
        phmcList.reduce((groups, employee) => {
            const categoryName = employee.category || 'Uncategorized';
            if (!groups[categoryName]) {
                groups[categoryName] = [];
            }
            groups[categoryName].push({
                value: employee.name,
                label: employee.name,
                signature: employee.signature,
                category: employee.category,
                lastName: employee.lastName // Include lastName in the option object
            });
            return groups;
        }, {})
    ).map(([category, options]) => ({
        label: category,
        options: options.sort((a, b) => a.label.localeCompare(b.label))
    })).sort((a, b) => {
        const order = {
            'Leadership': 1,
            'Hospital Supervisor': 2
        };
        const orderA = order[a.label] || 99;
        const orderB = order[b.label] || 99;

        if (orderA === orderB) {
            return a.label.localeCompare(b.label);
        }
        return orderA - orderB;
    });
    // First, verify data structure

    const coronerGroupedOptions = Object.entries(
        coronerList.reduce((groups, coroner) => {
            const categoryName = coroner.category || 'Uncategorized';
            if (!groups[categoryName]) {
                groups[categoryName] = [];
            }
            groups[categoryName].push({
                value: coroner.name,
                label: `${coroner.name} (${coroner.rank})`,
                badge: coroner.badge,
                rank: coroner.rank,
                discord: coroner.discord,
                category: categoryName
            });
            return groups;
        }, {})
    ).map(([category, options]) => {
        return {
            label: category,
            options: options.sort((a, b) => a.label.localeCompare(b.label))
        };
    }).sort((a, b) => {
        const priorityOrder = {
            'Chief Boss': 1,
            'Supervisor': 2,
            'Missing_Category': 3,
        };
        const orderA = priorityOrder[a.label] || 99;
        const orderB = priorityOrder[b.label] || 99;

        if (orderA !== orderB) {
            return orderA - orderB;
        } else {
            return a.label.localeCompare(b.label);
        }
    });


    // Keep this function as is
    const handleDoeChange = (type) => (e) => {
        if (e.target.checked) {
            setIsRemoveStaff(false); // <-- Add this line to turn off removal mode
            // Clear removal-specific fields when switching back to add
            setMissingEmployeeData(prev => ({
                ...prev,
                staffToRemove: [],
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
            options: coronerList.map(c => ({ value: c.name, label: `${c.name} (${c.rank || 'Coroner'})` }))
        },
        {
            label: 'PHMC Staff',
            options: phmcList.map(p => ({ value: p.name, label: `${p.name} (${p.category || 'PHMC'})` }))
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

    // Function to load saved reports from local storage
    const saveReport = async () => {
        let key = '';
        // --- Validation logic to determine the key ---
        if (bbCodeVersion === 1) {
            if (!formData.decedentOOC || !formData.dateTime) {
                showNotification(`Please fill in Decedent OOC and Date/Time fields.`, 'exclamation-circle');
                return; // Exit if validation fails
            }
            key = `${formData.decedentOOC} - ${formData.dateTime}`;
        } else if (bbCodeVersion >= 3 && bbCodeVersion <= 7) { // Adjusted range based on your code
            if (!formData.patientID || !formData.patientName || !formData.date) {
                showNotification(`Please fill in Patient ID, Patient Name, and Date fields.`, 'exclamation-circle');
                return; // Exit if validation fails
            }
             key = `${formData.patientID} - ${formData.patientName} - ${formData.date}`;
        } else if (bbCodeVersion === 19) { // Added other relevant bbCodeVersions based on your code
             if (!formData.patientID || !formData.lastName || !formData.date) {
                showNotification(`Please fill in Patient ID, Last Name, and Date fields.`, 'exclamation-circle');
                return; // Exit if validation fails
            }
            key = `${formData.patientID} - ${formData.lastName} - ${formData.date}`;
        } else if (bbCodeVersion === 25 || bbCodeVersion === 26) { // Added patient file versions
             if (!formData.patientName || !formData.date) { // Simplified check for these forms
                showNotification(`Please fill in Patient Name and Date fields.`, 'exclamation-circle');
                return; // Exit if validation fails
            }
            key = `${formData.patientName} - ${formData.date}`; // Key based on name and date
        }
        // Add more 'else if' blocks here for other bbCodeVersions that should be saveable
        // Ensure each block has appropriate validation and key generation
        else {
            // If the form type isn't explicitly handled for saving
            console.warn(`Form type (version${bbCodeVersion}) is not saveable.`, formData);
            showNotification(`I cannot save this report, BBCode has been copied!`, 'exclamation-circle');
            return; // Exit if not a saveable type
        }
        // --- End Validation ---

        // Proceed only if validation passed and a key was generated
    // --- Easter Egg Logic ---
    const currentSavedCount = savedReports.length;
    const easterEggAlreadyShown = localStorage.getItem('easterEggShown') === 'true';
    let showNormalEasterEgg = false;
    let showRareEasterEgg = false;

    // Conditions remain the same
    if (currentSavedCount === 4 && !easterEggAlreadyShown) {
        showNormalEasterEgg = true;
    } else if (currentSavedCount > 4 && !easterEggAlreadyShown) {
        showNormalEasterEgg = Math.random() < 0.05;
    } else if (easterEggAlreadyShown) {
        showRareEasterEgg = Math.random() < 0.01;
    }

    // Set state based on which egg (if any) should show
    if (showNormalEasterEgg) {
        setShowEasterEggModal(true);
        setEasterEggType('normal');
        localStorage.setItem('easterEggShown', 'true');
        sendEasterEggNotification('normal'); // <-- Call with 'normal' type
    } else if (showRareEasterEgg) {
        setShowEasterEggModal(true);
        setEasterEggType('rare');
        sendEasterEggNotification('rare'); // <-- Call with 'rare' type
    }
// --- End Easter Egg Logic ---


    const bbCodeContent = getBBCodeContent();
    if (bbCodeContent == null) {
        console.error("SaveReport: getBBCodeContent() returned null or undefined for version", bbCodeVersion);
        showNotification(`Failed to generate BBCode content for saving.`, 'error');
        return;
    }

    const reportData = JSON.stringify({
        bbCodeVersion: bbCodeVersion,
        data: filterFormData(formData, bbCodeVersion),
        bbCode: bbCodeContent,
        timestamp: Date.now()
    });

    try {
        localStorage.setItem(key, reportData);

        let currentCount = parseInt(localStorage.getItem('SavedReportCount') || '0', 10);
        if (isNaN(currentCount)) {
            currentCount = 0;
        }
        const newCount = currentCount + 1; // Calculate new count *before* setting it
        localStorage.setItem('SavedReportCount', newCount.toString()); // Use newCount

        showNotification(`Report saved! Copied to clipboard`, 'save'); // Use newCount
        loadSavedReports();

    } catch (error) {
        console.error("Error saving report to localStorage:", error);
        Sentry.captureException(error, { extra: { context: 'localStorage.setItem', key: key } });

        if (error.name === 'QuotaExceededError') {
            showNotification('Storage limit reached! Cannot save report. Please delete older reports.', 'error');
        } else {
            showNotification('Failed to save report due to a storage error.', 'error');
        }
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
    

    //  BBCode generation logic
    const bbCode = bbCodeVersion === 1 ? generateDeathReport(formData) :
    bbCodeVersion === 2 ? generateEmail(formData) :
        bbCodeVersion === 3 ? generateAdvancedPatientFile(formData) :  
                    bbCodeVersion === 5 ? generateSurgicalOps(formData) :
                        bbCodeVersion === 6 ? generatePhysEvalInternalMed(formData) :
                            bbCodeVersion === 7 ? generatePhysEvalInternalMedPBC(formData) :
                                                        bbCodeVersion === 14 ? generateMentalHealthPHMC(formData) :
                                                                bbCodeVersion === 16 ? generateMentalHealthPBC(formData) :
                                                                        bbCodeVersion === 18 ? generateAgencyFeedback(formData) :
                                                                            bbCodeVersion === 19 ? generateEmergencyProtocol(formData) :
                                                                                bbCodeVersion === 20 ? generateConsultationNotesPHMC(formData) :
                                                                                    bbCodeVersion === 21 ? generateConsultationNotesPBC(formData) :
                                                                                    bbCodeVersion === 22 ? generateCommentaryNotePHMC(formData) :
                                                                                    bbCodeVersion === 23 ? generateCommentaryNotePBC(formData) :
                                                                                    bbCodeVersion === 24 ? generateMedicalRecordRelease(formData) :
                                                                                        bbCodeVersion === 25 ? generateCommentaryNotePBC(formData) :
                                                                                            bbCodeVersion === 27 ? generateEmailPHMCEmail(formData) : 
                                                                                            bbCodeVersion === 28 ? generatePsychEvalPHMC(formData) :
                                                                                            bbCodeVersion === 29 ? generatePsychEvalPBC(formData) :
                                                                                            generateDeathReport(formData);
                                                                                // generateError();

   
// Coroner Titles
const generateTitle = () => {       
if (bbCodeVersion === 1) {
            const { typeOfDeath, decedentName, decedentOOC, dateTime } = formData;
            const date = new Date(dateTime).toLocaleDateString('en-US');
            return `[${typeOfDeath}] ${decedentName} ((${decedentOOC})) - ${date}`;
// Coroner Email 
        } else if (bbCodeVersion === 2) {
            const { decedentName, decedentOOC } = formData;
            return `Coroner Report - ${decedentName} | ((${decedentOOC}))`;

// Civilian Forms
        } else if (bbCodeVersion === 3) {
            const { patientName } = formData;
            return `[Medical Information Registration] -  ${patientName}`;
        } else if (bbCodeVersion === 24) {
            const { patientFirstName,  patientLastName } = formData;
            return `[RELEASE REQUEST] ${patientFirstName} ${patientLastName} `;
        } else if (bbCodeVersion === 25 || bbCodeVersion === 26) {
            const { patientName } = formData;
            return `[Medical Information Registration] -  ${patientName}`;
// PHMC Email 
        } else {
            const { patientMedicalRecord, patientName } = formData;
            return `${patientMedicalRecord} - ${patientName}`;
        }
    };
// Everything else

const clearForm = () => {
    setFormData(prevFormData => ({ // Use the previous state to access current values
        // Keep coronerEmployee and phmcEmployee from the previous state
        coronerEmployee: prevFormData.coronerEmployee,
        phmcEmployee: prevFormData.phmcEmployee,

        // Reset all other fields to their initial/default values
        placeOfDeath: '',
        evidenceLockerID: '',
        evidenceLocker: '',
        department: '',
        dateTime: '',
        phmcRank: '', // Reset rank if needed, or keep like employee fields
        BodyMassIndex: '',
        serialNumber: '',
        decedentName: '',
        phmcSignature: '', // Reset signature if tied to employee, or keep
        pronouncedTimeOfDeath: '',
        synopsis: '',
        probableCauseOfDeath: '',
        mannerOfDeath: '',
        typeOfDeath: '',
        decedentOOC: '',
        scenePhotos: '',
        lastName: '', // Reset lastName if tied to employee, or keep
        coronerBadge: prevFormData.coronerBadge, // Keep badge if tied to coronerEmployee
        additionalImages: '',
        requestingOfficer: '',
        coronerDiscord: prevFormData.coronerDiscord, // Keep discord if tied to coronerEmployee
        coronerPHNumber: '50056', // Reset to default or keep? Decide based on logic
        deathReport: '',
        SubmitDate: new Date().toISOString().split('T')[0], // Reset to today or keep?
        additionalReports: [],
        showAdditionalReports: false,
        internalReport: '',
        internalAdditionalReports: '',
        policeNotification: '',
        treatmentLocation: '',
        moreDeathReports: [''],
        extraStaff: [], // Reset or keep?
        patientName: '',
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
        PatientName: '',
        patientChewing: '',
        patientPriority: '',
        patientMedicine: '',
        patientNewMedicine: '',
        patientTreatment: '',
        patientDiagnosis: '',
        patientPrescription: '',
        patientSummary: '',
        date: '',
        patientRace: '',
        patientDiscord: '',
        race: '',
        patientMedicalRecord: '',
        patientGender: '',
        patientDateofBirth: '',
        patientDateOfBirth: '', // Duplicate? Keep one
        patientMedicalHistory: '',
        patientEmail: '',
        patientAddress: '',
        patientEmergencyContact: '',
        patientEmergencyContactNumber: '',
        patientEmergencyContactRelation: '',
        patientBloodType: '',
        patientChronicDiseases: '',
        patientBP: '',
        patientResperation: '',
        patientConsultation: '',
        patientPerscription: '',
        patientSummaryConsultation: '',
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
        lab: [],
        departmentLarge: '',
        patientChiefComplaint: '',
        patientID: '',
        rank: '', // Reset rank or keep?
        patientProcedure: '',
        patientPhoneType: '',
        patientPhoneMobile: '',
        patientPhoneHome: '',
        patientPhoneWork: '',
        patientPhoneOther: '',
        patientGenderMale: '',
        patientGenderFemale: '',
        MedicalRecordsRelease: [],
        PurposeMedicalInformationReleaseFormat: '', // Reset or keep?
        PurposeMedicalInformationRelease: '', // Reset or keep?
        PurposeAttorney: '',
        PurposePersonal: '',
        PurposeFurtherCare: '',
        PurposeOther: '',
        CarePurposeMedicalInformationRelease: '',
        patientMedInfoReleaseOther: '',
        MedicalRecordsReleaseOther: '',
        StupidDateFrom: '',
        StupidDateTo: '',
        patientFirstName: '',
        patientMiddleName: '',
        patientLastName: '', // Reset or keep?
        patientTitle: '',
        patientComplicationsYes: '',
        patientComplicationsNo: '',
        procedureGoodOptions: '',
        procedureGoodYes: '',
        procedureGoodNo: '',
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
        patientTherapyMedicine: '',
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
        patientFindings: '',
        paletoClinicDepartment: '',
        coronerRank: prevFormData.coronerRank, // Keep rank if tied to coronerEmployee
        // Add any other fields that should be preserved here
    }));

        const fieldsToRemove = [
        'dateTime',
        'department',
        'pronouncedTimeOfDeath',
        'placeOfDeath'
        // Keep coronerEmployee and phmcEmployee out of this list
    ];

    fieldsToRemove.forEach(field => {
        localStorage.removeItem(field);
        localStorage.removeItem(`${field}_timestamp`);
    });

    setParsedBBCode('');
    setLastWebhookIdentifier(null);
    showNotification('Form cleared! Employee selections preserved.', 'check-circle');
};
const DEFAULT_NOTIFICATION_DURATION = 3000; // default 3 seconds

    const showNotification = (message, icon = 'check-circle', duration = DEFAULT_NOTIFICATION_DURATION) => { // Add duration parameter with default
        const newNotification = {
            id: Date.now() + Math.random(), 
            message: message,
            icon: getIconClass(icon),
        };
        setNotifications(prevNotifications => [...prevNotifications, newNotification]);
    
        setTimeout(() => {
            removeNotification(newNotification.id);
        }, duration); 
    };
        
    const getIconClass = (iconType) => {
        switch (iconType) {
            case 'check-circle':
                return 'fas fa-check-circle';
            case 'save':
                return 'fas fa-save';
            case 'clipboard':
                return 'fas fa-clipboard-check';
            case 'error':
                return 'fas fa-exclamation-triangle';
            case 'warning':
                return 'fas fa-exclamation-circle';
            case 'upload':
                return 'fas fa-upload'; // Add the upload icon
            default:
                return 'fas fa-info-circle';
        }
    };


    // *** IMPLEMENT removeNotification to REMOVE from the array ***
    const removeNotification = (idToRemove) => {
        setNotifications(prevNotifications =>
            prevNotifications.filter(notif => notif.id !== idToRemove)
        );
    };

    // Add new state
    const [parsedBBCode, setParsedBBCode] = useState('');
    // update Switch logic
    const getBBCodeContent = () => {
        switch (bbCodeVersion) {
            case 1:
                return generateDeathReport(formData);
            case 2:
                return generateEmail(formData);
            case 3: 
                return generateAdvancedPatientFile(formData);
            case 5:
                return generateSurgicalOps(formData);
            case 6:
                return generatePhysEvalInternalMed(formData);
            case 7: 
                return generatePhysEvalInternalMedPBC(formData);
            case 14:
                return generateMentalHealthPHMC(formData);
            case 16:
                return generateMentalHealthPBC(formData);
            case 18:
                return generateAgencyFeedback(formData);
            case 19:
                return generateEmergencyProtocol(formData);
            case 20:
                return generateConsultationNotesPHMC(formData);
            case 21:
                return generateConsultationNotesPBC(formData);
            case 22:
                return generateCommentaryNotePHMC(formData);
            case 23:
                return generateCommentaryNotePBC(formData);
            case 24:
                return generateMedicalRecordRelease(formData);
            case 25:
                return generateBasicPatientFile(formData);
            case 27:
                return generateEmailPHMCEmail(formData);
             case 28: 
                return generatePsychEvalPHMC(formData);
            case 29:
              return generatePsychEvalPBC(formData);
            default:
       }
    };
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
            'phmcEmployee', 'phmcSignature',
            'coronerEmployee', 'coronerBadge', 'coronerRank', 'coronerDiscord',
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
    
        const fields = [
            'phmcEmployee', 'phmcSignature',
            'coronerEmployee', 'coronerBadge', 'coronerRank', 'coronerDiscord',
            'pronouncedTimeOfDeath', 'department', 'dateTime', 'placeOfDeath', 'mannerOfDeath'
        ];
        const newFormData = { ...formData };
    
        fields.forEach(field => {
            const value = localStorage.getItem(field);
            if (value) {
                newFormData[field] = value;
            }
        });
    
        setFormData(newFormData);
    }, []); //  The empty dependency array [] ensures this effect runs only once after the initial render.
    const handleSelectChange = (selectedOption, type) => {
        const timestamp = Date.now();
    
        if (selectedOption) {
            if (type === 'coroner') {
                // Update formData and localStorage for coroner
                setFormData(prev => ({
                    ...prev,
                    coronerEmployee: selectedOption.value,
                    coronerBadge: selectedOption.badge,
                    coronerRank: selectedOption.rank,
                    coronerDiscord: selectedOption.discord
                }));
    
                // Save to localStorage with timestamp
                localStorage.setItem('coronerEmployee', selectedOption.value);
                localStorage.setItem('coronerBadge', selectedOption.badge);
                localStorage.setItem('coronerRank', selectedOption.rank);
                localStorage.setItem('coronerDiscord', selectedOption.discord);
                localStorage.setItem('coronerEmployee_timestamp', timestamp.toString());
            }
        } else {
            // Clear coroner data
            const fields = ['coronerEmployee', 'coronerBadge', 'coronerRank', 'coronerDiscord'];
            fields.forEach(field => {
                localStorage.removeItem(field);
                localStorage.removeItem(`${field}_timestamp`);
            });
    
            setFormData(prev => ({
                ...prev,
                coronerEmployee: '',
                coronerBadge: '',
                coronerRank: '',
                coronerDiscord: ''
            }));
        }
    };

        const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prevFormData => ({
            ...prevFormData,
            [name]: type === 'checkbox' ? checked : (type === 'select-multiple' ? Array.from(e.target.selectedOptions, option => option.value) : value)
        }));

        if (name === 'rank') {
            setRank(value);
        }
        const timestamp = Date.now();

        // Save selected employee data
        if (name === 'phmcEmployee' || name === 'coronerEmployee') {
            const fields = name === 'phmcEmployee' ?
                ['phmcEmployee', 'phmcSignature'] :
                ['coronerEmployee', 'coronerBadge', 'coronerRank', 'coronerDiscord'];

            fields.forEach(field => {
                localStorage.setItem(field, formData[field]);
                localStorage.setItem(`${field}_timestamp`, timestamp);
            });
        }
        // Gender processing
        if (name === 'patientGender') {
            setFormData(prevFormData => ({
                ...prevFormData,
                patientGender: value,
            }));
        } else {
            setFormData(prevFormData => ({
                ...prevFormData,
                [name]: type === 'checkbox' ? checked : value
            }));
        }
    
        // Handle 3-hour expiry fields
        if (['pronouncedTimeOfDeath', 'department', 'dateTime', 'placeOfDeath', 'mannerOfDeath'].includes(name)) {
            localStorage.setItem(name, value);
            localStorage.setItem(`${name}_timestamp`, timestamp);
        }

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
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
        4: "Dental Report",
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

    };


    const [hideAgencySelector, setHideAgencySelector] = useState(() => {
        // Load the value from localStorage on component mount
        const storedValue = localStorage.getItem('hideAgencySelector');
        return storedValue ? JSON.parse(storedValue) : false; // Default to false if no value is stored
    });
    const [showAgencySelector, setShowAgencySelector] = useState(!hideAgencySelector);

    const handleAgencySelect = (version) => {
        setBbCodeVersion(version);
        setShowPHMCModal(false);
        setShowAgencySelector(false);
        setLastWebhookIdentifier(null); 
        showNotification(`Switched to ${versionNames[version]}`, 'exchange-alt');
    };
    
    const toggleAgencySelector = () => {
        setShowAgencySelector(!showAgencySelector);
    };
        useEffect(() => {
        // Save the value to localStorage whenever hideAgencySelector changes
        localStorage.setItem('hideAgencySelector', JSON.stringify(hideAgencySelector));
    }, [hideAgencySelector]);

// easter egg stuff
const { season } = SeasonalEvents({ imageType: 'deathReport' }); // Get the season
  
// business card stuff
const businessCardRef = useRef(null);
const nameRef = useRef(null); 
const rankRef = useRef(null);
const departmentRef = useRef(null); 
const [imgurLink, setImgurLink] = useState(null);

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = () => {
        setIsSaving(true);
        showNotification('Uploading, Just a moment....', 'upload');
    
        localStorage.setItem('name', name);
        localStorage.setItem('rank', rank);
        localStorage.setItem('phoneNumber', phoneNumber);
    
        domtoimage.toPng(businessCardRef.current)
            .then(function (dataUrl) {
                uploadToImgur(dataUrl)
                    .then(imgurLink => {
                        setImgurLink(imgurLink);
                        showNotification(`Business Card Saved & Uploaded to Imgur: ${imgurLink}`, 'save');
                        // Send webhook AFTER successful Imgur upload
                        sendDiscordWebhook(name, rank, phoneNumber, imgurLink);

                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            navigator.clipboard.writeText(imgurLink)
                                .then(() => {
                                    showNotification('Imgur link copied to clipboard!', 'clipboard');
                                })
                                .catch(err => {
                                    console.error('Failed to copy Imgur link to clipboard:', err);
                                    // Send more detailed error info to Sentry
                                    Sentry.captureException(err, {
                                        extra: {
                                            message: 'Clipboard writeText failed.',
                                            imgurLink: imgurLink, // Include the link that failed to copy
                                            userAgent: navigator.userAgent,
                                        }
                                    });
                        
                                    // Provide more helpful feedback to the user
                                    let userMessage = 'Failed to copy Imgur link automatically.';
                                    if (err.name === 'NotAllowedError') {
                                        userMessage += ' Please grant clipboard permission when prompted by your browser.';
                                    } else if (err.message.includes('focused')) { // Check for focus-related errors
                                        userMessage += ' Please ensure this window is focused and try copying manually.';
                                    } else {
                                        userMessage += ' Please copy the link manually.';
                                    }
                                    showNotification(userMessage, 'error');
                                });
                        } else {
                            const clipboardWarning = 'Clipboard API not available in this browser/context.';
                            console.warn(clipboardWarning);
                            Sentry.captureMessage(clipboardWarning, 'warning'); // Send warning to Sentry
                            showNotification('Clipboard API not available. Please copy the link manually.', 'warning');
                        }
                            
                        setTimeout(() => {
                        }, 10000);
                    })
                    .catch(error => {
                        console.error('Error uploading to Imgur:', error);
                        Sentry.captureException(error); // Send Imgur upload error to Sentry
                        showNotification('Error uploading to Imgur', 'error');
                        // Send Discord webhook even on Imgur error, but indicate the failure
                        sendDiscordWebhook(name, rank, phoneNumber, null, `Imgur Upload Failed: ${error.message}`);
                    })
                    .finally(() => {
                        setIsSaving(false);
                        let cssLoaded = true;
                        setTimeout(() => {
                            const inputFields = document.querySelectorAll('.business-card-input-fields input');
                            inputFields.forEach(input => {
                                if (window.getComputedStyle(input).color === 'rgb(0, 0, 0)') {
                                    console.error("CSS not properly loaded on input fields after save.");
                                    showNotification("CSS may not have loaded correctly. Refresh the page if styles are missing.", 'warning');
                                    cssLoaded = false;
                                }
                            });
                       }, 500); // Delay to allow CSS to load
                    });
            })
            .catch(function (error) {
                console.error('Error converting to image:', error);
                showNotification('Error converting business card to image', 'error');
                // Send Discord webhook indicating image conversion error
                sendDiscordWebhook(name, rank, phoneNumber, null, `Image Conversion Failed: ${error.message || error}`);
                setIsSaving(false);
            });
            let lastWebhookCallTimestamp = 0;
            const webhookRateLimitDelay = 1100; // Delay in milliseconds (e.g., 1.1 seconds, slightly above Discord's limit per request)
            let webhookQueue = []; // Queue for pending webhook calls
            let isWebhookProcessing = false; // Flag to check if a webhook call is currently being processed
            
            const processWebhookQueue = async () => {
                if (webhookQueue.length === 0 || isWebhookProcessing) {
                    return; // Nothing to process or already processing
                }
        
                isWebhookProcessing = true;
                const now = Date.now();
                const timeSinceLastCall = now - lastWebhookCallTimestamp;
        
                if (timeSinceLastCall < webhookRateLimitDelay) {
                    // Calculate the necessary delay
                    const delay = webhookRateLimitDelay - timeSinceLastCall;
                    console.log(`Rate limiting Discord webhook. Delaying for ${delay}ms.`);
                    setTimeout(() => {
                        isWebhookProcessing = false; // Reset flag after delay
                        processWebhookQueue(); // Try processing again after delay
                    }, delay);
                    return; // Exit function to wait for the delay
                }
        
                // Dequeue the next message
                const { webhookURL, message } = webhookQueue.shift();
        
                try {
                    const response = await fetch(webhookURL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(message)
                    });
        
                    if (!response.ok) {
                        console.error('Failed to send Discord webhook:', response.status, response.statusText);
                        // Optional: Add the message back to the queue for retry?
                        // webhookQueue.unshift({ webhookURL, message });
                    } else {
                        lastWebhookCallTimestamp = Date.now(); // Update timestamp on success
                    }
                } catch (error) {
                    console.error('Error sending Discord webhook:', error);
                    // Optional: Add the message back to the queue for retry?
                    // webhookQueue.unshift({ webhookURL, message });
                } finally {
                    isWebhookProcessing = false; // Reset flag
                    // Process the next item in the queue immediately if any
                    if (webhookQueue.length > 0) {
                        // Use setTimeout to avoid potential stack overflow with rapid calls
                        setTimeout(processWebhookQueue, 0);
                    }
                }
            };
        
            const sendDiscordWebhook = async (name, rank, phoneNumber, imgurLink, errorMessage = null) => {
                const webhookURL = process.env.REACT_APP_DISCORD_WEBHOOK_URL;
        
                if (!webhookURL) {
                    console.warn('Discord webhook URL is not set in environment variables.');
                    return;
                }
        
                // --- Start Embed Construction ---
                const embed = {
                    title: "Business Card Creation Alert!", 
                    description: "A new business card was generated.", 
                    color: errorMessage ? 0xFF0000 : 0x00FF00, 
                    fields: [
                        { name: "Employee Name", value: name || "N/A", inline: true },
                        { name: "Employee Rank", value: rank || "N/A", inline: true },
                        { name: "Phone Number", value: phoneNumber || "N/A", inline: true },
                        errorMessage ? { name: "Error", value: errorMessage, inline: false } : null
                    ].filter(field => field !== null), // Filter out null fields (like the error field if no error)
                    footer: {
                        text: `PHMC Forms Tool | gh-pages ${commitInfo.sha || 'N/A'}`
                    },
                    timestamp: new Date().toISOString()
                };
        
                if (imgurLink) {
                    embed.image = {
                        url: imgurLink
                    };
                } else if (!errorMessage) { // Add a note if upload succeeded but link is missing (shouldn't happen often)
                     embed.fields.push({ name: "Image Status", value: "Image uploaded, but link is missing.", inline: false });
                } else { // Add a note if upload failed
                     embed.fields.push({ name: "Image Status", value: "Image upload failed.", inline: false });
                }
        
        
                const message = {
                    embeds: [embed] 
                };
        
        
                webhookQueue.push({ webhookURL, message });
        
                if (!isWebhookProcessing) {
                    processWebhookQueue();
                }
            };
        
    };
    const uploadToImgur = async (base64Image) => {
        const imgurClientId = process.env.REACT_APP_IMGUR_CLIENT_ID;
        const accessToken = process.env.REACT_APP_IMGUR_ACCESS_TOKEN;
        const albumId = process.env.REACT_APP_IMGUR_ALBUM_ID; // Retrieve album ID from environment variables
        const apiUrl = 'https://api.imgur.com/3/image';
    
        const formData = new FormData();
        formData.append('image', base64Image.split(',')[1]); // Remove the data:image/png;base64, prefix
        formData.append('album', albumId); // Add the album ID to the form data
    
        const headers = {
            'Authorization': `Client-ID ${imgurClientId}`
        };
    
        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }
    
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: formData,
            });
    
            const data = await response.json();
    
            if (data.success) {
                return data.data.link;
            } else {
                console.error('Imgur upload failed:', data); // Log the full response for debugging
                throw new Error(`Imgur upload failed: ${data.data.error}`);
            }
        } catch (error) {
            console.error('Imgur upload failed:', error);
            throw error; // Re-throw the error for the calling function to handle
        }
    };
    
    useEffect(() => {
        setName(localStorage.getItem('name') || '');
        setRank(localStorage.getItem('rank') || '');
        setPhoneNumber(localStorage.getItem('phoneNumber') || '');
        }, []);
    
    
        const toggleBusinessCard = () => {
            // Toggle the business card modal  }
        
            setShowBusinessCard(!showBusinessCard);
            setShowAgencySelector(false); // Close Agency Selector
            setShowBBCode(false); // Close BBCode modal
            setShowImages(false); // Close Images modal
            // Log positions when the business card is opened
        };    // Add state near other useState declarations
    const [name, setName] = useState('');
    const [rank, setRank] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [showBBCode, setShowBBCode] = useState(false);
    const [showImages, setShowImages] = useState(false);
    const [showBusinessCard, setShowBusinessCard] = useState(false);
    
    const handleNameChange = (e) => {
        setName(e.target.value);
    };
    
    const handleRankChange = (e) => {
        setRank(e.target.value);
    };
    const handlephoneNumberChange = (e) => {
        setPhoneNumber(e.target.value);
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
    
            const coroner = coronerList.find(c => c.name === selectedCoronerName);
    
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
                        onSubmit={handleCoronerRankSubmit} // Pass the new handler
                        coronerRankList={uniqueCoronerRanks} // Pass the processed list of ranks
                        coronerList={coronerList} // <-- Pass the full coronerList from data.js

                    />
        <CoronerTipsModal
            show={showCoronerTips}
            onClose={() => setShowCoronerTips(false)}
        />

{showAgencySelector && (
    <AgencySelector
        showAgencySelector={showAgencySelector}
        setShowAgencySelector={setShowAgencySelector}
        handleAgencySelect={handleAgencySelect}
        isMobile={isMobile}
        hideAgencySelector={hideAgencySelector}
        setHideAgencySelector={setHideAgencySelector}
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
                    <ToolsDropdown
         onShowMissingEmployee={() => setShowMissingEmployeeModal(true)}
         onShowFeatureRequest={() => setShowFeatureRequestModal(true)}
         onShowSavedReports={toggleSavedReports} // Use your existing toggle function
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
                                    <h3>Changelog - Version 2.0.6 -  </h3>
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
                                        <li>Enhance Medical Release functionality with payment options and validation; update relevant fields in multiple components</li>
                                    </ul>
                                    - frosty
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
                            Select Form
                        </Button>

                        {(bbCodeVersion === 1 || bbCodeVersion === 2 || bbCodeVersion === 18) && (
                            <>
                                <Button
                                    className="changelog-button"
                                    variant='secondary'
                                    onClick={() => setShowPHMCModal(true)}
                                >
                                    <i className="fa fa-laptop"></i>
                                    <span>Coroner Forms </span>
                                </Button>

                                {showPHMCModal && (
                                    <div className="modal-overlay" onClick={() => setShowPHMCModal(false)}>
                                        <div className="agency-selector-modal" onClick={e => e.stopPropagation()}>
                                            <div className="modal-header">
                                                <h4>Coroner Forms (3)</h4>
                                                <Button
                                                    className="close-button"
                                                    onClick={() => setShowPHMCModal(false)}
                                                    aria-label="Close selector"
                                                >
                                                    <i className="fas fa-times"></i>
                                                </Button>
                                            </div>
                                            <div className="agency-selector-buttons">
                                                <div className="agency-row">
                                                    <Button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(1)}
                                                    >
                                                        <img src={corpse}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Decedent Services </span>
                                                    </Button>
                                                    <Button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(2)}
                                                    >
                                                        <img src={email}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Email Generator </span>
                                                    </Button>
                                                    <Button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(18)}
                                                    >
                                                        <img src={PHMCLogo}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Agency Incidents </span>
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {(bbCodeVersion === 6 || bbCodeVersion === 7) && (
                            <>
                                <Button
                                    className="changelog-button"
                                    variant='secondary'
                                    onClick={() => setShowPHMCModal(true)}
                                >
                                    <i className="fas fa-exchange-alt"></i>
                                    <span>Switch Physical Evaluation Forms</span>
                                </Button>

                                {showPHMCModal && (
                                    <div className="modal-overlay" onClick={() => setShowPHMCModal(false)}>
                                        <div className="agency-selector-modal" onClick={e => e.stopPropagation()}>
                                            <div className="modal-header">
                                                <h4>Select Internal Medicine Consultation Form (2)</h4>
                                                <Button
                                                    className="close-button"
                                                    onClick={() => setShowPHMCModal(false)}
                                                    aria-label="Close selector"
                                                >
                                                    <i className="fas fa-times"></i>
                                                </Button>
                                            </div>
                                            <div className="agency-selector-buttons">
                                                <div className="agency-row">
                                                    <Button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(6)}
                                                    >
                                                        <img src={PHMCLogo}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Physical Evaluation PHMC </span>
                                                    </Button>
                                                    <Button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(7)}
                                                    >
                                                        <img src={PHMCLogo}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Physical Evaluation PBC </span>
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                                                {(bbCodeVersion === 28 || bbCodeVersion === 29) && (
                            <>
                                <Button
                                    className="changelog-button"
                                    variant='secondary'
                                    onClick={() => setShowPHMCModal(true)}
                                >
                                    <i className="fas fa-exchange-alt"></i>
                                    <span>Switch Psychological Evaluation Form</span>
                                </Button>

                                {showPHMCModal && (
                                    <div className="modal-overlay" onClick={() => setShowPHMCModal(false)}>
                                        <div className="agency-selector-modal" onClick={e => e.stopPropagation()}>
                                            <div className="modal-header">
                                                <h4>Select Psychological Evaluation Form (2)</h4>
                                                <Button
                                                    className="close-button"
                                                    onClick={() => setShowPHMCModal(false)}
                                                    aria-label="Close selector"
                                                >
                                                    <i className="fas fa-times"></i>
                                                </Button>
                                            </div>
                                            <div className="agency-selector-buttons">
                                                <div className="agency-row">
                                                    <Button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(28)}
                                                    >
                                                        <img src={PHMCLogo}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Psychological Evaluation | PHMC </span>
                                                    </Button>
                                                    <Button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(29)}
                                                    >
                                                        <img src={phmcpaletobay}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Psychological Evaluation | PBC </span>
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {( bbCodeVersion === 20 || bbCodeVersion === 21) && (
                            <>
                                <Button
                                    className="changelog-button"
                                    variant='secondary'
                                    onClick={() => setShowPHMCModal(true)}
                                >
                                    <span>Switch General Consultation Forms </span>
                                </Button>

                                {showPHMCModal && (
                                    <div className="modal-overlay" onClick={() => setShowPHMCModal(false)}>
                                        <div className="agency-selector-modal" onClick={e => e.stopPropagation()}>
                                            <div className="modal-header">
                                                <h4>Select General Consultation Form (2)</h4>
                                                <Button
                                                    className="close-button"
                                                    onClick={() => setShowPHMCModal(false)}
                                                    aria-label="Close selector"
                                                >
                                                    <i className="fas fa-times"></i>
                                                </Button>
                                            </div>
                                            <div className="agency-selector-buttons">
                                                <div className="agency-row">
                                                    <Button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(20)}
                                                    >
                                                        <img src={PHMCLogo}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>General Consultation | PHMC </span>
                                                    </Button>
                                                    <Button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(21)}
                                                    >
                                                        <img src={phmcpaletobay}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>General Consultation | PBC </span>
                                                    </Button>

                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {(bbCodeVersion === 22 || bbCodeVersion === 23) && (
                            <>
                                <Button
                                    className="changelog-button"
                                    variant='secondary'
                                    onClick={() => setShowPHMCModal(true)}
                                >
                                    <span>Switch Commentary Note Form </span>
                                </Button>

                                {showPHMCModal && (
                                    <div className="modal-overlay" onClick={() => setShowPHMCModal(false)}>
                                        <div className="agency-selector-modal" onClick={e => e.stopPropagation()}>
                                            <div className="modal-header">
                                                <h4>Select Commentary Note Form (2)</h4>
                                                <Button
                                                    className="close-button"
                                                    onClick={() => setShowPHMCModal(false)}
                                                    aria-label="Close selector"
                                                >
                                                    <i className="fas fa-times"></i>
                                                </Button>
                                            </div>
                                            <div className="agency-selector-buttons">
                                                <div className="agency-row">
                                                    <Button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(22)}
                                                    >
                                                        <img src={PHMCLogo}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Commentary Note | PHMC </span>
                                                    </Button>
                                                    <Button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(23)}
                                                    >
                                                        <img src={phmcpaletobay}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Commentary Note | PBC </span>
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        {(bbCodeVersion === 14 || bbCodeVersion === 16) && (
                            <>
                                <Button
                                    className="changelog-button"
                                    variant='secondary'
                                    onClick={() => setShowPHMCModal(true)}
                                >
                                    <span>Switch Mental Health Form </span>
                                </Button>

                                {showPHMCModal && (
                                    <div className="modal-overlay" onClick={() => setShowPHMCModal(false)}>
                                        <div className="agency-selector-modal" onClick={e => e.stopPropagation()}>
                                            <div className="modal-header">
                                                <h4>Select Mental Health Form (2)</h4>
                                                <Button
                                                    className="close-button"
                                                    onClick={() => setShowPHMCModal(false)}
                                                    aria-label="Close selector"
                                                >
                                                    <i className="fas fa-times"></i>
                                                </Button>
                                            </div>
                                            <div className="agency-selector-buttons">
                                                <div className="agency-row">
                                                    <Button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(14)}
                                                    >
                                                        <img src={PHMCLogo}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Mental Health - PHMC </span>
                                                    </Button>
                                                    <Button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(16)}
                                                    >
                                                        <img src={phmcpaletobay}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Mental Health | PBC </span>
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        {(bbCodeVersion === 3 || bbCodeVersion === 24 || bbCodeVersion === 25) && (
                            <>
                                <Button
                                    className="changelog-button"
                                    onClick={() => setShowPHMCModal(true)}
                                >
                                    <i className="fas fa-exchange-alt"></i>
                                    <span>Change Civilian Hospital Forms</span>
                                </Button>

                                {showPHMCModal && (
                                    <div className="modal-overlay" onClick={() => setShowPHMCModal(false)}>
                                        <div className="agency-selector-modal" onClick={e => e.stopPropagation()}>
                                            <div className="modal-header">
                                                <h4>Select Civilian Forms (3)</h4>
                                                <Button
                                                    className="close-button"
                                                    onClick={() => setShowPHMCModal(false)}
                                                    aria-label="Close selector"
                                                >
                                                    <i className="fas fa-times"></i>
                                                </Button>
                                            </div>
                                            <div className="agency-selector-buttons">
                                                <div className="agency-row">
                                                    <Button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(24)}
                                                    >
                                                        <img src={Civilian}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span> Medical Record Release </span>
                                                    </Button>
                                                    <Button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(25)}
                                                    >
                                                        <img src={nurse}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Basic Patient File </span>
                                                    </Button>
                                                    <Button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(3)}
                                                    >
                                                        <img src={nurse}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Detailed Patient File </span>
                                                    </Button>

                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
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
                        {bbCodeVersion === 1 ? (
                            <DeathReport
                            formData={formData}
                            handleChange={handleChange}
                            handleSelectChange={handleSelectChange} 
                            setShowMissingEmployeeModal={setShowMissingEmployeeModal}
                            setShowCoronerRankModal={setShowCoronerRankModal}
                            coronerGroupedOptions={coronerGroupedOptions}
                            handleDoeChange={handleDoeChange}
                            setFormData={setFormData}
                            isJohnDoe={isJohnDoe} 
                            isJaneDoe={isJaneDoe}
                            currentUtcTime={currentUtcTime}
                            isUploading={isUploading}
                            handleImageUpload={handleImageUpload}
                            showRequestingOfficerInput={showRequestingOfficerInput}
                            setShowRequestingOfficerInput={setShowRequestingOfficerInput}
                    
                        />
                    ) : bbCodeVersion === 2 ? (
                        <CoronerEmail
                        formData={formData}
                        handleChange={handleChange}
                        handleSelectChange={handleSelectChange} 
                        setShowMissingEmployeeModal={setShowMissingEmployeeModal}
                        setShowCoronerRankModal={setShowCoronerRankModal}
                        coronerGroupedOptions={coronerGroupedOptions}
                        fillPhoneChecked={fillPhoneChecked} 
                        setFillPhoneChecked={setFillPhoneChecked} 
                        handleFillCoronerPhone={handleFillCoronerPhone}
                        addReport={addReport} 
                        removeReport={removeReport} 
                        handleReportChange={handleReportChange}
                        isUploading={isUploading}
                        parseBBCode={parseBBCode} 
                        toggleSavedReports={toggleSavedReports} 
                    />                    
                        ) : bbCodeVersion === 3 ? ( 
                            <PatientAdvanced
                            formData={formData}
                            handleChange={handleChange}
                            handleImageUpload={handleImageUpload}
                            isUploading={isUploading}
                            setFormData={setFormData} 
                        />
                        ) : bbCodeVersion === 5 ? (
                        <Surgical
                        formData={formData}
                        handleChange={handleChange}
                        phmcGroupedOptions={phmcGroupedOptions}
                        phmcRank={phmcRank}
                        setFormData={setFormData}
                        patientConsent={patientConsent}
                        complications={complications}
                        procedureGood={procedureGood}
                    />

                    ) : bbCodeVersion === 6 ? (
                        <PhysEval
                        formData={formData}
                        handleChange={handleChange}
                        phmcGroupedOptions={phmcGroupedOptions} 
                        setFormData={setFormData} 
                        phmcRank={phmcRank} // <-- PASS THE PROP HERE
                        setShowMissingEmployeeModal={setShowMissingEmployeeModal}
                        BodyMassIndex={BodyMassIndex} 
                        temperature={temperature} 
                        heartRate={heartRate} 
                        breathing={breathing} 
                        bloodPressure={bloodPressure} 
                        patientJob={patientJob} 
                        patientJobRisks={patientJobRisks} 
                        patientAllergiesRisk={patientAllergiesRisk} 
                        patientMedicineRegular={patientMedicineRegular} 
                        patientOther={patientOther} 
                        predisposition={predisposition}                                 
                    />

                    ) : bbCodeVersion === 7 ? ( // generatePhysEvalInternalMed
                        <PhysEval
                        formData={formData}
                        handleChange={handleChange}
                        phmcGroupedOptions={phmcGroupedOptions} 
                        setFormData={setFormData} 
                        phmcRank={phmcRank} // <-- PASS THE PROP HERE
                        setShowMissingEmployeeModal={setShowMissingEmployeeModal}
                        BodyMassIndex={BodyMassIndex} 
                        temperature={temperature} 
                        heartRate={heartRate} 
                        breathing={breathing} 
                        bloodPressure={bloodPressure} 
                        patientJob={patientJob} 
                        patientJobRisks={patientJobRisks} 
                        patientAllergiesRisk={patientAllergiesRisk} 
                        patientMedicineRegular={patientMedicineRegular} 
                        patientOther={patientOther} 
                        predisposition={predisposition}                                 
                    />                            
                        ) : bbCodeVersion === 14 ? ( // generateMentalHealthPHMC
                            <MentalHealth
                            formData={formData}
                            handleChange={handleChange}
                            phmcGroupedOptions={phmcGroupedOptions} 
                            setFormData={setFormData} 
                            phmcRank={phmcRank} // <-- PASS THE PROP HERE
                            setShowMissingEmployeeModal={setShowMissingEmployeeModal}
                            BodyMassIndex={BodyMassIndex} 
                            followup={followup} 
                            admission={admission} 

                        />                                                        
                        ) : bbCodeVersion === 16 ? ( // generateMentalHealthPBC
                            <MentalHealth
                            formData={formData}
                            handleChange={handleChange}
                            phmcGroupedOptions={phmcGroupedOptions} 
                            setFormData={setFormData} 
                            phmcRank={phmcRank} // <-- PASS THE PROP HERE
                            setShowMissingEmployeeModal={setShowMissingEmployeeModal}
                            BodyMassIndex={BodyMassIndex} 
                            followup={followup} 
                            admission={admission} 

                        />                                                        
                        ) : bbCodeVersion === 18 ? ( // generateAgencyFeedbac
                            <AgencyFeedback
                            formData={formData}
                            handleChange={handleChange}
                            handleSelectChange={handleSelectChange} 
                            setShowMissingEmployeeModal={setShowMissingEmployeeModal}
                            setShowCoronerRankModal={setShowCoronerRankModal}
                            coronerGroupedOptions={coronerGroupedOptions}
                            setFormData={setFormData}
                            isUploading={isUploading}
                            handleImageUpload={handleImageUpload}
                        />
                        ) : bbCodeVersion === 19 ? ( // Emergency Form - generateERForm
                            <EmergencyForm
                            formData={formData}
                            handleChange={handleChange}
                            phmcGroupedOptions={phmcGroupedOptions} 
                            setFormData={setFormData} 
                            phmcRank={phmcRank} // <-- PASS THE PROP HERE
                            setShowMissingEmployeeModal={setShowMissingEmployeeModal}
                            BodyMassIndex={BodyMassIndex} 
                            temperature={temperature} 
                            heartRate={heartRate} 
                            breathing={breathing} 
                            bloodPressure={bloodPressure} 
                            painLevel={painLevel} 
                            findings={findings} 
                            lungs={lungs} 
                            pupils={pupils} 
                            wounds={wounds} 
                            ecg={ecg} 
                            sono={sono} 
                            lab={lab} 
                            admission={admission} 
                            followup={followup} 
                            bloodOxy={bloodOxy}
                            
                            />
                        ) : bbCodeVersion === 20 ? ( // General Consultation (PHMC)
                            <GeneralConsult
                            formData={formData}
                            handleChange={handleChange}
                            phmcGroupedOptions={phmcGroupedOptions} 
                            setFormData={setFormData} 
                            phmcRank={phmcRank} // <-- PASS THE PROP HERE
                            setShowMissingEmployeeModal={setShowMissingEmployeeModal}
                            BodyMassIndex={BodyMassIndex} 
                            temperature={temperature} 
                            heartRate={heartRate} 
                            breathing={breathing} 
                            bloodPressure={bloodPressure} 
                            painLevel={painLevel} 
                            findings={findings} 
                            lungs={lungs} 
                            pupils={pupils} 
                            wounds={wounds} 
                            ecg={ecg} 
                            sono={sono} 
                            lab={lab} 
                            followup={followup} 
                            assignedDepartment={assignedDepartment}
                            admission={admission} 
                            drugList={drugList}
                            handleImageUpload={handleImageUpload}
                            isUploading={isUploading}
                            bloodOxy={bloodOxy}
                            />
                           ) : bbCodeVersion === 21 ? ( // GENERAL CONSULTATION (PBC)
                            <GeneralConsult
                            formData={formData}
                            handleChange={handleChange}
                            phmcGroupedOptions={phmcGroupedOptions} 
                            setFormData={setFormData} 
                            phmcRank={phmcRank} // <-- PASS THE PROP HERE
                            setShowMissingEmployeeModal={setShowMissingEmployeeModal}
                            BodyMassIndex={BodyMassIndex} 
                            temperature={temperature} 
                            heartRate={heartRate} 
                            breathing={breathing} 
                            bloodPressure={bloodPressure} 
                            painLevel={painLevel} 
                            findings={findings} 
                            lungs={lungs} 
                            pupils={pupils} 
                            wounds={wounds} 
                            ecg={ecg} 
                            sono={sono} 
                            lab={lab} 
                            followup={followup} 
                            assignedDepartment={assignedDepartment}
                            admission={admission} 
                            drugList={drugList}
                            handleImageUpload={handleImageUpload}
                            isUploading={isUploading}
                            bloodOxy={bloodOxy}

                            />
                    ) : bbCodeVersion === 22 ? ( // COMMENTARY NOTE (phmc)
                        <CommNotePHMC
                            formData={formData}
                            handleChange={handleChange}
                            setShowMissingEmployeeModal={setShowMissingEmployeeModal}
                            phmcGroupedOptions={phmcGroupedOptions}
                            departmentLarge={departmentLarge}
                            setFormData={setFormData} // Pass setFormData down
                        />
                        ) : bbCodeVersion === 23 ? ( // COMMENTARY NOTE (PBC)
                            <>
                        <CommNotePBC
                            formData={formData}
                            handleChange={handleChange}
                            setShowMissingEmployeeModal={setShowMissingEmployeeModal}
                            phmcGroupedOptions={phmcGroupedOptions}
                            departmentLarge={departmentLarge}
                            setFormData={setFormData} // Pass setFormData down
                        />
                            </>
                     ) : bbCodeVersion === 24 ? ( // Medical Record Release
                            <MedicalRelease
                            formData={formData}
                            handleChange={handleChange}
                            handleSelectChange={handleSelectChange}
                            setShowMissingEmployeeModal={setShowMissingEmployeeModal}
                            PurposeMedicalInformationRelease={PurposeMedicalInformationRelease}
                            setFormData={setFormData}
                            MedicalRecordsRelease={MedicalRecordsRelease}
                            phmcGroupedOptions={phmcGroupedOptions} 
                            patientTitle={patientTitle} 
                            patientPhone={patientPhone} 
                            PurposeMedicalInformationReleaseFormat={PurposeMedicalInformationReleaseFormat}
                            handleImageUpload={handleImageUpload}
                            isUploading={isUploading}
 

                            />
                    ) : bbCodeVersion === 25 ? ( // Basic Patient File
                            <BasicPatientFile
                            formData={formData}
                            handleChange={handleChange}
                            handleSelectChange={handleSelectChange}
                            setShowMissingEmployeeModal={setShowMissingEmployeeModal}
                            isUploading={isUploading}
                            handleImageUpload={handleImageUpload}
                            patientTitle={patientTitle} 
                            patientBloodType={patientBloodType} 
                            />
                        ) : bbCodeVersion === 27 ? ( //PHMC Email Internal
                            <EmailInternal
                            formData={formData}
                            handleChange={handleChange}
                            setFormData={setFormData}
                            isUploading={isUploading}
                            handleImageUpload={handleImageUpload}
                            phmcGroupedOptions={phmcGroupedOptions} 
                            />
                        ) : bbCodeVersion === 28 ? ( //PHMC Shrink Internal
                            <Shrink
                            formData={formData}
                            handleChange={handleChange}
                            phmcGroupedOptions={phmcGroupedOptions} 
                            setFormData={setFormData} 
                            phmcRank={phmcRank} // <-- PASS THE PROP HERE
                            setShowMissingEmployeeModal={setShowMissingEmployeeModal}
                            Appearance={Appearance} 
                            Behavior={Behavior} 
                            Speech={Speech} 
                            Mood={Mood} 
                            Affect={Affect} 
                            ThoughtProcess={ThoughtProcess} 
                            ThoughtContent={ThoughtContent} 
                            Insight={Insight} 
                            Cognition={Cognition} 
                            admission={admission} 
                            followup={followup} 
                            Risk={Risk}
                            />

                        ) : bbCodeVersion === 29 ? ( //PBC? Shrink Internal
                            <Shrink
                            formData={formData}
                            handleChange={handleChange}
                            phmcGroupedOptions={phmcGroupedOptions} 
                            setFormData={setFormData} 
                            phmcRank={phmcRank} // <-- PASS THE PROP HERE
                            setShowMissingEmployeeModal={setShowMissingEmployeeModal}
                            Appearance={Appearance} 
                            Behavior={Behavior} 
                            Speech={Speech} 
                            Mood={Mood} 
                            Affect={Affect} 
                            ThoughtProcess={ThoughtProcess} 
                            ThoughtContent={ThoughtContent} 
                            Insight={Insight} 
                            Cognition={Cognition} 
                            admission={admission} 
                            followup={followup} 
                            Risk={Risk}
                            />

                        ) : null}
                        <div className="button-group">
                            <Button
                                type="button"
                                onClick={clearForm}
                                className="remove-report-button"
                            >
                                <i className="fas fa-trash-alt"></i>
                                Clear Form
                            </Button>
                    {window.location.hostname === 'localhost' && (
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
                {showMissingEmployeeModal && (
        <div className="modal-overlay">
            <div className="modal">
                <Modal.Header>
                    <Modal.Title>Manage Employee Data</Modal.Title> {/* Updated Title */}
                    <Button variant="secondary" className="close" onClick={() => { setShowMissingEmployeeModal(false); setRequestType(''); /* Reset type on close */ }}>
                        <span>CLOSE</span>
                    </Button>
                </Modal.Header>
                <div className="radio-inline-container">
                <span className="radio-text">Action:</span>
                    {/* --- Use original handlers and new one --- */}
                    <Form.Check
                        type="radio"
                        id="addCoronerRadio"
                        label="  Add Coroner"
                        name="requestTypeGroup" // Add name for grouping
                        checked={isJohnDoe} // Check against isJohnDoe
                        onChange={handleDoeChange('john')} // Use original handler
                        inline
                    />
                    <Form.Check
                        type="radio"
                        id="addPhmcRadio"
                        label="  Add Hospital Staff"
                        name="requestTypeGroup" // Add name for grouping
                        checked={isJaneDoe} // Check against isJaneDoe
                        onChange={handleDoeChange('jane')} // Use original handler
                        inline
                    />
                    <Form.Check
                        type="radio"
                        id="removeStaffRadio"
                        label="  Remove Staff"
                        name="requestTypeGroup" // Add name for grouping
                        checked={isRemoveStaff} // Check against isRemoveStaff
                        onChange={handleRemoveStaffChange} // Use NEW handler
                        inline
                    />
                    {/* --- End Updated Radio Buttons --- */}
                </div>

                <Modal.Body>
                    <Form>
                        {requestType === 'addPhmc' && ( 
                            <>
                            <hr></hr>
                    <div style={{ display: 'flex', gap: '10px' }}>
                    <Form.Control
                        type="text"
                        name="coronerName"
                        value={missingEmployeeData.coronerName}
                        onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerName')}
                        placeholder='Coroner Name'

                        />
                        <Form.Control
                        type="text"
                        name="coronerDiscord"
                        value={missingEmployeeData.coronerDiscord}
                        onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerDiscord')}
                        placeholder='Coroner Discord Name'
                        />
                        <Form.Control
                        type="text"
                        name="coronerRank"
                        value={missingEmployeeData.coronerRank}
                        onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerRank')}
                        placeholder='Coroner Rank / Position'
                        />
                                                    
                        </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                            <Form.Control
                                type="text"
                                name="coronerPHNumber"
                                value={missingEmployeeData.coronerPHNumber}
                                onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerPHNumber')}
                                placeholder='Coroner PH number (Optional)'
                            />
                            <Form.Control
                            type="text"
                            name="coronerBadge"
                            value={missingEmployeeData.coronerBadge}
                            onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerBadge')}
                            placeholder='Coroner Badge Number (Required***)'
                            />

                        </div>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    <Form.Control type="text" name="coronerPHNumber" value={missingEmployeeData.coronerPHNumber} onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerPHNumber')} placeholder='Employee PH number (Optional)' />
                                </div>
                                <Select
                                    name="phmcEmployee" // This is the REQUESTER
                                    value={missingEmployeeData.phmcEmployee ? phmcGroupedOptions.flatMap(group => group.options).find(option => option.value === missingEmployeeData.phmcEmployee) || null : null}
                                    onChange={(selectedOption) => handleMissingEmployeeChange(selectedOption?.value || '', 'phmcEmployee')}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Who is requesting this addition..."
                                    className="form-control mt-2" // Added margin top
                                    styles={{
                                        control: (base) => ({
                                            ...base,
                                            backgroundColor: '#16202c',
                                            color: '#eeeeeeb0',
                                            borderColor: '#30363d',
                                            '&:hover': {
                                                borderColor: '#30363d'
                                            }
                                        }),
                                        menu: (base) => ({
                                            ...base,
                                            backgroundColor: '#16202c',
                                            zIndex: 1000
                                        }),
                                        option: (base, state) => ({
                                            ...base,
                                            backgroundColor: state.isFocused ? 'Grey' : '#16202c',
                                            color: '#eeeeeeb0'
                                        }),
                                        singleValue: (base) => ({
                                            ...base,
                                            color: '#eeeeeeb0'
                                        }),
                                        input: (base) => ({
                                            ...base,
                                            color: '#eeeeeeb0'
                                        }),
                                        placeholder: (base) => ({
                                            ...base,
                                            color: '#eeeeeeb0'
                                        })
                                    }}
                                />
                            </>
                        )}

{isJohnDoe && ( // <--- Changed back to isJohnDoe
                            <>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Control type="text" name="coronerName" value={missingEmployeeData.coronerName} onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerName')} placeholder='Coroner Name' required />
                                    <Form.Control type="text" name="coronerDiscord" value={missingEmployeeData.coronerDiscord} onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerDiscord')} placeholder='Coroner Discord Name' required />
                                    <Form.Control type="text" name="coronerRank" value={missingEmployeeData.coronerRank} onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerRank')} placeholder='Coroner Rank / Position' required />
                                </div>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                    <Form.Control type="text" name="coronerPHNumber" value={missingEmployeeData.coronerPHNumber} onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerPHNumber')} placeholder='Coroner PH number (Optional)' />
                                    <Form.Control type="text" name="coronerBadge" value={missingEmployeeData.coronerBadge} onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerBadge')} placeholder='Coroner Badge Number (Required***)' required />
                                </div>
                                <Select
                                    name="coronerEmployee" // This is the REQUESTER
                                    value={missingEmployeeData.coronerEmployee ? coronerGroupedOptions.flatMap(group => group.options).find(option => option.value === missingEmployeeData.coronerEmployee) || null : null}
                                    onChange={(selectedOption) => handleMissingEmployeeChange(selectedOption?.value || '', 'coronerEmployee')}
                                    options={coronerGroupedOptions}
                                    isClearable
                                    placeholder="Who is requesting this addition..."
                                    className="form-control mt-2" // Added margin top
                                    styles={{
                                        control: (base) => ({
                                            ...base,
                                            backgroundColor: '#16202c',
                                            color: '#eeeeeeb0',
                                            borderColor: '#30363d',
                                            '&:hover': {
                                                borderColor: '#30363d'
                                            }
                                        }),
                                        menu: (base) => ({
                                            ...base,
                                            backgroundColor: '#16202c',
                                            zIndex: 1000
                                        }),
                                        option: (base, state) => ({
                                            ...base,
                                            backgroundColor: state.isFocused ? 'Grey' : '#16202c',
                                            color: '#eeeeeeb0'
                                        }),
                                        singleValue: (base) => ({
                                            ...base,
                                            color: '#eeeeeeb0'
                                        }),
                                        input: (base) => ({
                                            ...base,
                                            color: '#eeeeeeb0'
                                        }),
                                        placeholder: (base) => ({
                                            ...base,
                                            color: '#eeeeeeb0'
                                        })
                                    }}
                                />
                            </>
                        )}

                        {/* == ADD PHMC STAFF FIELDS (using isJaneDoe) == */}
                        {isJaneDoe && ( // <--- Changed back to isJaneDoe
                            <>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Control type="text" name="coronerName" value={missingEmployeeData.coronerName} onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerName')} placeholder='Employee Name' required />
                                    <Form.Control type="text" name="coronerDiscord" value={missingEmployeeData.coronerDiscord} onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerDiscord')} placeholder='Employee Department/Discord' required />
                                    <Form.Control type="text" name="coronerRank" value={missingEmployeeData.coronerRank} onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerRank')} placeholder='Employee Rank / Position' required />
                                </div>
                                <Select
                                    name="phmcEmployee" // This is the REQUESTER
                                    value={missingEmployeeData.phmcEmployee ? phmcGroupedOptions.flatMap(group => group.options).find(option => option.value === missingEmployeeData.phmcEmployee) || null : null}
                                    onChange={(selectedOption) => handleMissingEmployeeChange(selectedOption?.value || '', 'phmcEmployee')}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Who is requesting this addition..."
                                    className="form-control mt-2" // Added margin top
                                    styles={{
                                        control: (base) => ({
                                            ...base,
                                            backgroundColor: '#16202c',
                                            color: '#eeeeeeb0',
                                            borderColor: '#30363d',
                                            '&:hover': {
                                                borderColor: '#30363d'
                                            }
                                        }),
                                        menu: (base) => ({
                                            ...base,
                                            backgroundColor: '#16202c',
                                            zIndex: 1000
                                        }),
                                        option: (base, state) => ({
                                            ...base,
                                            backgroundColor: state.isFocused ? 'Grey' : '#16202c',
                                            color: '#eeeeeeb0'
                                        }),
                                        singleValue: (base) => ({
                                            ...base,
                                            color: '#eeeeeeb0'
                                        }),
                                        input: (base) => ({
                                            ...base,
                                            color: '#eeeeeeb0'
                                        }),
                                        placeholder: (base) => ({
                                            ...base,
                                            color: '#eeeeeeb0'
                                        })
                                    }}
                                />
                            </>
                        )}
                        {isRemoveStaff && (
                            <>
                                <Form.Label>Staff to Remove:</Form.Label>
                                <Select
                                    isMulti
                                    name="staffToRemove"
                                    options={combinedStaffOptions} // Use the combined list
                                    value={combinedStaffOptions.flatMap(group => group.options).filter(option => missingEmployeeData.staffToRemove.includes(option.value))}
                                    onChange={(selectedOptions) => {
                                        const selectedValues = selectedOptions ? selectedOptions.map(option => option.value) : [];
                                        handleMissingEmployeeChange(selectedValues, 'staffToRemove');
                                    }}
                                    isClearable
                                    placeholder="Select staff member(s) to remove..."
                                    className="form-control mb-2"
                                    styles={{                                        
                                        control: (base) => ({
                                    ...base,
                                    minHeight: '38px',
                                    backgroundColor: '#16202c',
                                    color: '#eeeeeeb0',
                                    borderColor: '#6c757d',
                                    '&:hover': {
                                        borderColor: '#eeeeeeb0'
                                    }
                                }),
                                menu: (base) => ({
                                    ...base,
                                    backgroundColor: '#16202c',
                                    zIndex: 1000,
                                    border: '1px solid #6c757d',
                                    borderRadius: '0.375rem'
                                }),
                                option: (base, state) => ({
                                    ...base,
                                    backgroundColor: state.isFocused ? '#30363d' : '#16202c',
                                    color: '#eeeeeeb0',
                                    padding: '0.5rem 1rem',
                                    '&:hover': {
                                        backgroundColor: '#30363d'
                                    }
                                }),
                                multiValue: (base) => ({
                                    ...base,
                                    backgroundColor: '#30363d',
                                    color: '#eeeeeeb0'
                                }),
                                multiValueLabel: (base) => ({
                                    ...base,
                                    color: '#eeeeeeb0'
                                }),
                                multiValueRemove: (base) => ({
                                    ...base,
                                    color: '#6c757d',
                                    '&:hover': {
                                        backgroundColor: '#dc3545',
                                        color: '#fff'
                                    }
                                }),
                                input: (base) => ({
                                    ...base,
                                    color: '#eeeeeeb0'
                                }),
                                placeholder: (base) => ({
                                    ...base,
                                    color: '#6c757d'
                                })
                            }}
                            />
                        <Form.Label>Authorized By:</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="authorizedBy"
                                    value={missingEmployeeData.authorizedBy}
                                    onChange={(e) => handleMissingEmployeeChange(e.target.value, 'authorizedBy')}
                                    placeholder='Your Name (Authorizing Removal)'
                                    required
                                />
                                <span className="helper-text">
                                    (Only authorized personnel should submit removal requests.)
                                </span>
                            </>
                        )}
                        {/* --- End Conditional Rendering --- */}
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="primary" onClick={handleMissingEmployeeSubmit}>
                        Submit Request
                    </Button>
                    {/* --- Update cancel button onClick --- */}
                    <Button variant="secondary" className="close" onClick={() => {
                        setShowMissingEmployeeModal(false);
                        setIsJohnDoe(false); // Reset state on close
                        setIsJaneDoe(false); // Reset state on close
                        setIsRemoveStaff(false); // Reset state on close
                    }}>
                        Cancel
                    </Button>
                </Modal.Footer>
            </div>
        </div>
    )}
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

                                        
{/*                 {<div className="form-type-header">
                    <h3>You are viewing:
                            {bbCodeVersion === 1 ? ' Decedent Report' :
                                bbCodeVersion === 2 ? ' Coroner Email' :
                                    bbCodeVersion === 3 ? ' Patient File - Advanced' : 
                                            bbCodeVersion === 5 ? ' Surgical Operations' :
                                                bbCodeVersion === 6 ? ' generatePhysEvalInternalMed ' :
                                                    bbCodeVersion === 7 ? 'GeneratePhysEvalInternalMedPBC' :
                                                                                bbCodeVersion === 14 ? 'generateMentalHealthPHMC - FULLY TESTED' :
                                                                                        bbCodeVersion === 16 ? 'generateMentalHealthPBC - FULLY TESTED' :
                                                                                            bbCodeVersion === 17 ? 'generateMentalHealthPBC - FULLY TESTED' :
                                                                                                bbCodeVersion === 18 ? 'Coroner Agency Incidents' :
                                                                                                    bbCodeVersion === 19 ? 'Emergency Protocol Form NEW' :
                                                                                                        bbCodeVersion === 20 ? 'General Consultation PHMC' :
                                                                                                            bbCodeVersion === 21 ? 'General Consultation PBC' :
                                                                                                                bbCodeVersion === 22 ? 'PHMC Commentary Note' :
                                                                                                                    bbCodeVersion === 23 ? 'PBC Commentary Note' :
                                                                                                                        bbCodeVersion === 24 ? 'Medical Record Release' :
                                                                                                                            bbCodeVersion === 25 ? 'Basic Patient File' :
                                                                                                                            bbCodeVersion === 27 ? 'Email PHMC Email' :
                                                                                                                            bbCodeVersion === 28 ? 'Psych Eval PHMC' :
                                                                                                                            bbCodeVersion === 29 ? 'Psych Eval PBC' :

                                                                                                                ' MISSING TITLE - CHANGE DEV_TEXT'}
                        </h3>
                    </div>}
 */}        
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
{showBusinessCard && (
    <div className="modal-overlay">
        <div className="agency-selector-modal business-card-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
                <h4>Business Card - Public Testing</h4>
                <Button
                    variant="secondary"
                    className="close"
                    onClick={() => setShowBusinessCard(false)}
                    aria-label="Close selector"
                >
                    <i className="fas fa-times"></i>
                </Button>
            </div>
            <div className="business-card-content">
                If you get any errors, please let me on Discord.
            {imgurLink && (
                <div className="imgur-link-container">
                    <p>
                        <strong>Imgur Link: </strong>
                        <a href={imgurLink} target="_blank" rel="noopener noreferrer">
                            {imgurLink}
                        </a>
                    </p>
                    Instructions! 
                    <br></br>
            1) /note [id of the blank note item in your inventory] [amount] [name for the cards] 
            <br></br>

            2) /note [id of the new note item in your inventory] [amount] [content] [URL from Imgur] 
                </div>
            )}
                <div className="business-card-image-container" ref={businessCardRef} style={{ position: 'relative', width: '100%', maxWidth: '800px' /* Optional: Set max-width */ }}>
                    <img
                        src={BusinessCardImage}
                        alt="Business Card"
                        style={{ display: 'block', width: '100%', height: 'auto' }} // Make image responsive
                    />
                    <div
                        className="name-overlay"
                        ref={nameRef}
                        style={{
                            position: 'absolute',
                            top: '23.44%',    // <-- Percentage value
                            left: '2.75%',   // <-- Percentage value
                            color: 'black',
                            fontSize: '35px', // Consider using relative units like 'vw' or 'em' if scaling needed
                            pointerEvents: 'none',
                            cursor: 'default',
                            whiteSpace: 'nowrap' // Prevent text wrapping
                        }}
                    >
                        {name}
                    </div>
                    <div
                        className="rank-overlay"
                        ref={rankRef}
                        style={{
                            position: 'absolute',
                            top: '31.92%',    // <-- Percentage value
                            left: '3.31%',   // <-- Percentage value
                            color: '#cb1212',
                            fontSize: '15px', // Consider relative units
                            cursor: 'default',
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap' // Prevent text wrapping
                        }}
                    >
                        {rank}
                    </div>
                    <div
                        className="phone-number-overlay"
                        ref={departmentRef} // Assuming this ref is correct, might be phoneNumberRef?
                        style={{
                            position: 'absolute',
                            top: '51.03%',    // <-- Percentage value
                            left: '11.06%',  // <-- Percentage value
                            color: 'black',
                            fontSize: '15px', // Consider relative units
                            cursor: 'default',
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap' // Prevent text wrapping
                        }}
                    >
                        {phoneNumber}
                    </div>
                </div>
            <div className="business-card-input-fields">
                <Form.Control
                    type="text"
                    placeholder="Name"
                    value={name}
                    onChange={handleNameChange}
                />
                <Form.Control
                    type="text"
                    placeholder="Rank"
                    value={rank}
                    onChange={handleRankChange}
                />
                <Form.Control
                    type="text"
                    placeholder="Phone Number"
                    value={phoneNumber}
                    onChange={handlephoneNumberChange}
                />

            </div>
        </div>
        <Button onClick={handleSave}>Save</Button>
    </div>
</div>
)}
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
                                                        {bbCodeVersion === 1 ? generateDeathReport(formData) : 
                                                        bbCodeVersion === 2 ? generateEmail(formData) :
                                                        bbCodeVersion === 3 ? generateAdvancedPatientFile(formData) :
                                                        bbCodeVersion === 5 ? generateSurgicalOps(formData) :
                                                        bbCodeVersion === 6 ? generatePhysEvalInternalMed(formData) :
                                                        bbCodeVersion === 7 ? generatePhysEvalInternalMedPBC(formData) :
                                                        bbCodeVersion === 14 ? generateMentalHealthPHMC(formData) :
                                                        bbCodeVersion === 16 ? generateMentalHealthPBC(formData) :
                                                        bbCodeVersion === 18 ? generateAgencyFeedback(formData) :
                                                        bbCodeVersion === 19 ? generateEmergencyProtocol(formData) :
                                                        bbCodeVersion === 20 ? generateConsultationNotesPHMC(formData) :
                                                        bbCodeVersion === 21 ? generateConsultationNotesPBC(formData) :
                                                        bbCodeVersion === 22 ? generateCommentaryNotePHMC(formData) :
                                                        bbCodeVersion === 23 ? generateCommentaryNotePBC(formData) :
                                                        bbCodeVersion === 24 ? generateMedicalRecordRelease(formData) :
                                                        bbCodeVersion === 25 ? generateBasicPatientFile(formData) :
                                                        bbCodeVersion === 27 ? generateEmailPHMCEmail(formData) :  
                                                        bbCodeVersion === 28 ? generatePsychEvalPHMC(formData) :
                                                        bbCodeVersion === 29 ? generatePsychEvalPBC(formData) :
                                                        generateDeathReport(formData)}
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
    (bbCodeVersion === 1 || bbCodeVersion === 2 || bbCodeVersion === 3 || bbCodeVersion === 24 || bbCodeVersion === 25) && (
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
        {formData.department && agencyData[formData.department] && (
            <a
                href={agencyData[formData.department].url}
                target="_blank"
                rel="noopener noreferrer"
                className="agency-button"
            >
                <img
                    src={agencyData[formData.department].logo}
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
    (bbCodeVersion === 1 || bbCodeVersion === 2 || bbCodeVersion === 3 || bbCodeVersion === 24 || bbCodeVersion === 25) && (
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
                            className="changelog-button"
                            onClick={() => {
                                    const bbCode = bbCodeVersion === 1 ? generateDeathReport(formData) : 
                                    bbCodeVersion === 2 ? generateEmail(formData) :
                                    bbCodeVersion === 3 ? generateAdvancedPatientFile(formData) : 
                                                bbCodeVersion === 5 ? generateSurgicalOps(formData) :
                                                    bbCodeVersion === 6 ? generatePhysEvalInternalMed(formData) :
                                                    bbCodeVersion === 7 ? generatePhysEvalInternalMedPBC(formData) : 
                                                                                    bbCodeVersion === 14 ? generateMentalHealthPHMC(formData) :
                                                                                            bbCodeVersion === 16 ? generateMentalHealthPBC(formData) :
                                                                                                    bbCodeVersion === 18 ? generateAgencyFeedback(formData) :
                                                                                                        bbCodeVersion === 19 ? generateEmergencyProtocol(formData) :
                                                                                                        bbCodeVersion === 20 ? generateConsultationNotesPHMC(formData) :
                                                                                                        bbCodeVersion === 21 ? generateConsultationNotesPBC(formData) :
                                                                                                        bbCodeVersion === 22 ? generateCommentaryNotePHMC(formData) :
                                                                                                        bbCodeVersion === 23 ? generateCommentaryNotePBC(formData) :
                                                                                                        bbCodeVersion === 24 ? generateMedicalRecordRelease(formData) :
                                                                                                        bbCodeVersion === 25 ? generateBasicPatientFile(formData) :
                                                                                                        bbCodeVersion === 27 ? generateEmailPHMCEmail(formData) : 
                                                                                                         bbCodeVersion === 28 ? generatePsychEvalPHMC(formData) :
                                                                                                        bbCodeVersion === 29 ? generatePsychEvalPBC(formData) :

                                                                                                        generateDeathReport(formData);
                                const currentDateTime = new Date().toLocaleString();
                                const { decedentName, coronerEmployee, coronerRank, patientName, decedentOOC, phmcEmployee, requestingOfficer, patientID, patientFirstName, patientLastName} = formData;
                                const version = bbCodeVersion === 1 ? "Decedent Report" :
                                    bbCodeVersion === 2 ? "Coroner Email" :
                                        bbCodeVersion === 3 ? "Patient File - Advanced" :
                                                bbCodeVersion === 5 ? "Surgical Report " :
                                                    bbCodeVersion === 6 ? "Physical Evaluation (PHMC)" :
                                                        bbCodeVersion === 7 ? "Physical Evaluation (IM) - PBC" :
                                                                bbCodeVersion === 9 ? "Obstetrics - Main File" :
                                                                    bbCodeVersion === 10 ? "Obstetrics - Follow Up" :
                                                                        bbCodeVersion === 11 ? "Medical Consultation (EM) - Add File" :
                                                                            bbCodeVersion === 12 ? "Gynecology - Main File" :
                                                                                bbCodeVersion === 13 ? "Gynecology - Follow Up" :
                                                                                    bbCodeVersion === 14 ? "Mental Health - PHMC" :
                                                                                            bbCodeVersion === 16 ? "Mental Health - Updating Risk Status" :
                                                                                                    bbCodeVersion === 18 ? "Coroners Agency Incidents" :
                                                                                                        bbCodeVersion === 19 ? "Emergency Protocol Form" :
                                                                                                            bbCodeVersion === 20 ? "General Consultation PHMC" :
                                                                                                                bbCodeVersion === 21 ? "General Consultation PBC" :
                                                                                                                    bbCodeVersion === 22 ? "PHMC Commentary Note" :
                                                                                                                        bbCodeVersion === 23 ? "PBC Commentary Note" :
                                                                                                                        bbCodeVersion === 24 ? "Medical Record Release" :
                                                                                                                        bbCodeVersion === 25 ? 'Basic Patient File' :
                                                                                                                        bbCodeVersion === 27 ? 'PHMC Internal Email' : 
                                                                                                                        bbCodeVersion === 28 ? 'Psychological Evaluation PHMC' : 
                                                                                                                        bbCodeVersion === 29 ? 'Psychological Evaluation PBC' :
                                                                                                            "Something has gone wrong, sorry about that! Please inform the website maintainer!";

                        // Check if clipboard API is available before using it
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            navigator.clipboard.writeText(bbCode).then(() => {
                                showNotification(`${version} copied!`, 'check-circle');
                                saveReport(); // Keep saveReport call
                        
                                const discordWebhookUrl = process.env.REACT_APP_DISCORD_WEBHOOK_URL;
                        
                                // Send POST request to Discord Webhook only after successful copy
                                if (discordWebhookUrl) {
                                    let savedCount = parseInt(localStorage.getItem('SavedReportCount') || '0', 10);
                                    if (isNaN(savedCount)) {
                                        savedCount = 0; // Default to 0 if the stored value is invalid
                                    }
                        
                                    // --- Duplicate Check Logic ---
                                    const { decedentName, decedentOOC, phmcEmployee, coronerEmployee, coronerRank, patientFirstName, patientLastName, patientName, patientID, requestingOfficer } = formData;
                                    const currentDateTime = new Date().toLocaleString(); // Keep this for the embed
                        
                                    // Create a unique identifier for the current report content
                                    const currentIdentifier = `${decedentName || ''}|${decedentOOC || ''}`; // Use a separator
                        
                                    // Check if the current identifier matches the last sent one
                                    if (currentIdentifier && currentIdentifier === lastWebhookIdentifier) {
                                        console.log('Duplicate report copy detected, skipping webhook.');
                                        // Optionally show a different notification if desired
                                        // showNotification('Already copied!', 'info-circle');
                                        return; // Stop execution here, don't send webhook
                                    }
                                    // --- End Duplicate Check Logic ---
                        
                                    // Determine user value (simplified and corrected)
                                    const userValue = phmcEmployee
                                        ? `Hospital Staff ${phmcEmployee}`
                                        : coronerEmployee
                                            ? `${coronerRank || 'Coroner'} ${coronerEmployee}`
                                            : (patientFirstName || patientLastName)
                                                ? `${patientFirstName || ''} ${patientLastName || ''}`.trim()
                                                : 'Unknown User';
                        
                                    const successEmbed = {
                                        title: "Someone has used your generator!",
                                        description: "Here's the debug output.",
                                        color: 0x00FF00, // Green
                                        fields: [
                                            { name: "User", value: userValue, inline: true }, // Corrected: Only one User field
                                            { name: "Form Type", value: version || "Unknown Form", inline: true },
                                            { name: "Patient/Decedent", value: `${patientName || decedentName || patientID || 'N/A'}`, inline: true },
                                            { name: "OOC Name", value: decedentOOC || "N/A", inline: true },
                                            { name: "Requesting Officer", value: requestingOfficer || "N/A", inline: true },
                                            { name: "Timestamp", value: currentDateTime || "N/A", inline: false },
                                            { name: "Action", value: "BBCode Copied & Report Saved to Local Storage", inline: false },
                                            { name: "Total Saved Reports", value: savedCount.toString(), inline: false }
                                        ],
                                        footer: {
                                            text: `PHMC Forms Tool | gh-pages ${commitInfo.sha || 'N/A'}`
                                        },
                                        timestamp: new Date().toISOString()
                                    };
                        
                                    fetch(discordWebhookUrl, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify({ embeds: [successEmbed] })
                                    })
                                    .then(response => { // Add .then() to handle the fetch response
                                        if (response.ok) {
                                            // Update the last identifier ONLY if the webhook was sent successfully
                                            setLastWebhookIdentifier(currentIdentifier);
                                        } else {
                                            // Handle fetch error if needed
                                            console.error('Failed to send Discord webhook after copy:', response.status, response.statusText);
                                            Sentry.captureMessage(`Discord webhook failed after copy: ${response.status}`, {
                                                level: 'error',
                                                extra: { statusText: response.statusText }
                                            });
                                        }
                                    })
                                    .catch(error => {
                                        console.error('Failed to send Discord webhook after copy:', error);
                                        Sentry.captureException(error, { extra: { context: 'Discord Webhook Success Send' } });
                                    });
                        
                                } else {
                                     console.warn('Discord webhook URL not set, skipping notification.');
                                }
                        
                            }).catch(err => {
                                console.error('Failed to copy BBCode: ', err);
                                Sentry.captureException(err, { extra: { message: 'BBCode copy failed' } });
                                showNotification('Failed to copy BBCode to clipboard!', 'exclamation-triangle');
                                // Optionally, send a failure webhook here too if needed
                            });
                        } else {
                        // Handle cases where clipboard API is not available
                            console.warn("Clipboard API not available");
                            Sentry.captureMessage('Clipboard API not available for BBCode copy', 'warning');
                            showNotification('Clipboard API not available! BBCode not copied.', 'exclamation-triangle');

                            // Still save the report
                            saveReport();

                            const discordWebhookUrl = process.env.REACT_APP_DISCORD_WEBHOOK_URL;
                             if (discordWebhookUrl) {
                                const failureEmbed = {
                                    title: "BBCode Copy Failed (Clipboard API Unavailable)",
                                    color: 0xFF0000, // Red
                                    fields: [
                                        { name: "User", value: `${coronerRank || ''} ${coronerEmployee || phmcEmployee || `${patientFirstName || ''} ${patientLastName || ''}` || 'Unknown User'}`, inline: true },
                                        { name: "Form Type", value: version || "Unknown Form", inline: true },
                                        { name: "Patient/Decedent", value: `${patientName || decedentName || patientID || 'N/A'}`, inline: true },
                                        { name: "OOC Name", value: decedentOOC || "N/A", inline: true },
                                        { name: "Requesting Officer", value: requestingOfficer || "N/A", inline: true },
                                        { name: "Timestamp", value: currentDateTime || "N/A", inline: false },
                                        { name: "Action", value: "Report was saved, but BBCode could not be copied automatically.", inline: false },
                                    ],
                                    footer: {
                                        text: `PHMC Forms Tool | gh-pages ${commitInfo.sha || 'N/A'}`
                                    },
                                    timestamp: new Date().toISOString()
                                };

                                fetch(discordWebhookUrl, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ embeds: [failureEmbed] }) // Send the failure embed
                                }).catch(error => {
                                    console.error('Failed to send Discord webhook after failed copy:', error);
                                    Sentry.captureException(error, { extra: { context: 'Discord Webhook Clipboard Fail Send' } });
                                });
                             }
                        }
                    }}
                        >
                            <i className="fas fa-clipboard"></i>
    Copy {bbCodeVersion === 1 ? "Death Report" :
        bbCodeVersion === 2 ? "Coroner Report" :
        bbCodeVersion === 3 ? "Detailed Patient File" :
        bbCodeVersion === 5 ? "Surgical Operations Report" :
        bbCodeVersion === 6 ? "Physical Evaluation Report PHMC" :
        bbCodeVersion === 7 ? "Physical Evaluation Report PBC" :
        bbCodeVersion === 11 ? "Emergency Medicine - Add File" :
        bbCodeVersion === 14 ? "Mental Health - PHMC" :
        bbCodeVersion === 16 ? `Mental Health - Update Risk Status` :
        bbCodeVersion === 17 ? `Mental Health - Update Patient File` :
        bbCodeVersion === 18 ? 'Coroner Agency Incidents' :
        bbCodeVersion === 19 ? 'Emergency Protocol Form NEW' :
        bbCodeVersion === 20 ? 'General Consultation PHMC' :
        bbCodeVersion === 21 ? 'General Consultation PBC' :
        bbCodeVersion === 22 ? 'PHMC Commentary Note' :
        bbCodeVersion === 23 ? 'PBC Commentary Note' :
        bbCodeVersion === 24 ? 'Medical Record Release' :
        bbCodeVersion === 25 ? 'Basic Patient File' :
        bbCodeVersion === 27 ? 'PHMC Email' :
        bbCodeVersion === 28 ? 'Psychological Evaluation PHMC' :
        bbCodeVersion === 29 ? 'Psychological Evaluation PBC' :
        "DEBUG - update title logic"}
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
{bbCodeVersion !== 1 && bbCodeVersion !== 2  && bbCodeVersion !== 3 && bbCodeVersion !== 24 && bbCodeVersion !== 25 && bbCodeVersion !== 26 && (
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
                </div>
                            </div>
                            <Footer />
                                    </div>
    );
}

export default App;
