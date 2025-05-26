import React, { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import '@fortawesome/fontawesome-free/css/all.min.css';
import Notification from './components/Notification';
import { Modal, Form, Button } from 'react-bootstrap';
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
import BusinessCardModal from './components/BusinessCardModal'; 
import EasterEggModal from './components/EasterEggModal'; 
import EmsAmaModal from './components/EmsAmaModal'; // +++ Import the new modal
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
        showRequestingOfficerInput: false,        
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
    useEffect(() => {
        if (bbCodeVersion === 1) { // Only log for Death Report form for relevance
            console.log("formData.showRequestingOfficerInput in App.js updated to:", formData.showRequestingOfficerInput);
        }
    }, [formData.showRequestingOfficerInput, bbCodeVersion]);

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
            requiredFields = ['coronerName', 'employeeLastName', 'coronerRank', 'phmcEmployee']; // <-- Use employeeLastName
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
                { name: "Last Name", value: missingEmployeeData.employeeLastName || "N/A", inline: true },

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
        let dataJsEntry = '';
        if (isCoronerRequest) {
            dataJsEntry = `{ name: '${missingEmployeeData.coronerName || 'MISSING_NAME'}', badge: '${missingEmployeeData.coronerBadge || 'MISSING_BADGE'}', phNumber: '${missingEmployeeData.coronerPHNumber || ''}', rank: '${missingEmployeeData.coronerRank || 'MISSING_RANK'}', discord: '${missingEmployeeData.coronerDiscord || 'MISSING_DISCORD'}', category: '${missingEmployeeData.coronerRank || 'MISSING_CATEGORY'}' },`;
        } else { // isJaneDoe (add hospital staff)
            dataJsEntry = `{ name: '${missingEmployeeData.coronerName || 'MISSING_FULL_NAME'}', lastName: '${missingEmployeeData.employeeLastName || 'MISSING_LAST_NAME'}', rank: '${missingEmployeeData.coronerRank || 'MISSING_RANK'}', category: '${missingEmployeeData.coronerRank || 'MISSING_CATEGORY'}' },`; // <-- Updated for lastName
        }
        // This part remains the same:
        embedData.fields.push({ name: "Suggested data.js Entry", value: `\`\`\`javascript\n${dataJsEntry}\n\`\`\``, inline: false });
                // --- End ADD Embed ---

        submissionValid = true;
        successMessage = 'Done! Please ping Alyson on Discord to approve.';

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
                    staffToRemove: [], authorizedBy: '', employeeLastName: '', 
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
            'Missing Category': 1,
            'Leadership': 2,
            'Hospital Supervisor': 3
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
            'Chief Boss': 2,
            'Supervisor': 3,
            'Missing_Category': 1,
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
    let isSaveableForm = false; // Flag to track if the form type is configured for saving

    // --- Validation logic to determine the key ---
    // Check if the current bbCodeVersion is one that should be saveable
    if (bbCodeVersion === 1) {
        isSaveableForm = true;
        if (!formData.decedentOOC || !formData.dateTime) {
            showNotification(`Please fill in Decedent OOC and Date/Time fields.`, 'exclamation-circle');
            return false; // Validation failed, do not proceed with save or allow copy
        }
        key = `${formData.decedentOOC} - ${formData.dateTime}`;
    } else if (bbCodeVersion >= 3 && bbCodeVersion <= 7) { // Covers PatientAdvanced, SurgicalOps (5), PhysEval PHMC/PBC
        isSaveableForm = true;
        let patientIdMissing = !formData.patientID;
        let dateMissing = !formData.date;
        let patientNameMissing = false;

        // For Surgical Report (bbCodeVersion 5), patientName is not strictly required for this validation step.
        // For other forms in this range (3, 4, 6, 7), patientName is required for the save validation.
        if (bbCodeVersion !== 5) {
            patientNameMissing = !formData.patientName;
        }

        if (patientIdMissing || dateMissing || patientNameMissing) {
            let missingFieldLabels = [];
            if (patientIdMissing) missingFieldLabels.push('Patient ID');
            // patientNameMissing will only be true if bbCodeVersion is not 5 AND patientName is missing
            if (patientNameMissing) missingFieldLabels.push('Patient Name');
            if (dateMissing) missingFieldLabels.push('Date');

            // If only patientName is missing for bbCodeVersion 5, this condition won't be met by patientNameMissing,
            // so the message will correctly list only Patient ID and/or Date if they are missing.
            if (missingFieldLabels.length > 0) {
                 showNotification(`Please fill in ${missingFieldLabels.join(', ')} fields.`, 'exclamation-circle');
                 return false;
            }
        }
        // The key will use formData.patientName, which might be an empty string if not provided for bbCodeVersion 5.
        key = `${formData.patientID} - ${formData.patientName} - ${formData.date}`;
    } else if (bbCodeVersion === 19) { // EmergencyProtocol
        isSaveableForm = true;
        if (!formData.patientID || !formData.lastName || !formData.date) {
            showNotification(`Please fill in Patient ID, Last Name, and Date fields.`, 'exclamation-circle');
            return false;
        }
        key = `${formData.patientID} - ${formData.lastName} - ${formData.date}`;
    } else if (bbCodeVersion === 25 || bbCodeVersion === 26) { // BasicPatientFile
        isSaveableForm = true;
        if (!formData.patientName || !formData.date) {
            showNotification(`Please fill in Patient Name and Date fields.`, 'exclamation-circle');
            return false;
        }
        key = `${formData.patientName} - ${formData.date}`;
    }
    // Add other 'else if' conditions for other saveable bbCodeVersions here, setting isSaveableForm = true;

    if (!isSaveableForm) {
        console.warn(`Form type (version ${bbCodeVersion}) is not configured for saving. Copying will proceed if BBCode is valid.`);
        return true; // Indicate that copying can proceed
    }

    // --- Easter Egg Logic ---
    const currentSavedCount = savedReports.length;
    const easterEggAlreadyShown = localStorage.getItem('easterEggShown') === 'true';
    let showNormalEasterEgg = false;
    let showRareEasterEgg = false;

    if (currentSavedCount === 4 && !easterEggAlreadyShown) {
        showNormalEasterEgg = true;
    } else if (currentSavedCount > 4 && !easterEggAlreadyShown) {
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

    const bbCodeContent = getBBCodeContent();
    if (bbCodeContent == null) {
        console.error("SaveReport: getBBCodeContent() returned null or undefined for version", bbCodeVersion);
        showNotification(`Failed to generate BBCode content. Cannot save or copy.`, 'error');
        return false; // Cannot save or copy if BBCode generation failed
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
        const newCount = currentCount + 1;
        localStorage.setItem('SavedReportCount', newCount.toString());

        loadSavedReports();
        return true; // Indicate success

    } catch (error) {
        console.error("Error saving report to localStorage:", error);
        Sentry.captureException(error, { extra: { context: 'localStorage.setItem', key: key } });

        if (error.name === 'QuotaExceededError') {
            showNotification('Storage limit reached! Cannot save report. Copying will be skipped.', 'error');
        } else {
            showNotification('Failed to save report due to a storage error. Copying will be skipped.', 'error');
        }
        return false; // Indicate failure
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

    const showNotification = (message, icon = 'check-circle', duration = DEFAULT_NOTIFICATION_DURATION) => {
        const newNotification = {
            id: Date.now() + Math.random(), // Unique ID for the notification
            message: message,
            icon: getIconClass(icon),
        };
        setNotifications(prevNotifications => [...prevNotifications, newNotification]);

        // Only set a timeout if a positive duration is provided
        if (duration > 0) {
            setTimeout(() => {
                removeNotification(newNotification.id);
            }, duration);
        }
        return newNotification.id; // Return the ID of the created notification
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
        const [showBusinessCard, setShowBusinessCard] = useState(false); // Add this line
    const [showBBCode, setShowBBCode] = useState(false);
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
    
        // Load phmcEmployee separately as phmcSignature is removed
        const phmcEmployeeValue = localStorage.getItem('phmcEmployee');
        if (phmcEmployeeValue) {
            newFormData.phmcEmployee = phmcEmployeeValue;
        }

        ['coronerEmployee', 'coronerBadge', 'coronerRank', 'coronerDiscord', 'pronouncedTimeOfDeath', 'department', 'dateTime', 'placeOfDeath', 'mannerOfDeath'].forEach(field => {
            const value = localStorage.getItem(field);
            if (value) {
                newFormData[field] = value;
            }
        });
    
        setFormData(newFormData);
    }, []); // The empty dependency array [] ensures this effect runs only once after the initial render.
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
        const { name, value: originalValue, type, checked } = e.target;

        // Determine the value to set based on input type
        let valueToSet = type === 'checkbox'
            ? checked
            : type === 'select-multiple'
                ? Array.from(e.target.selectedOptions, option => option.value)
                : originalValue;

        // --- Specific processing for deathReport ---
        // Check if the changed field is 'deathReport' and the value is a string
        if (name === 'deathReport' && typeof valueToSet === 'string') { 
            // Replace [bold] with [b] and [/bold] with [/b] globally
            valueToSet = valueToSet.replace(/\[bold\]/g, '[b]').replace(/\[\/bold\]/g, '[/b]');
        }
        // --- End specific processing ---

        // Update the main form data state
        setFormData(prevFormData => ({
            ...prevFormData,
            [name]: valueToSet
        }));

        // --- LocalStorage Logic ---
        const timestamp = Date.now().toString();

        // Fields with 5-day expiry (only save if this specific field changed)
        const fiveDayExpiryFields = ['phmcEmployee', 'coronerEmployee', 'coronerBadge', 'coronerRank', 'coronerDiscord'];
        if (fiveDayExpiryFields.includes(name)) {
            // Special handling for employee selects to save related data
            if (name === 'phmcEmployee') {
                // Find the selected employee to get the signature
                localStorage.setItem('phmcEmployee', valueToSet);
                localStorage.setItem('phmcEmployee_timestamp', timestamp);
            } else if (name === 'coronerEmployee') {
                const selectedCoroner = coronerList.find(cor => cor.name === valueToSet);
                const badgeToSave = selectedCoroner?.badge || '';
                const rankToSave = selectedCoroner?.rank || '';
                const discordToSave = selectedCoroner?.discord || '';
                localStorage.setItem('coronerEmployee', valueToSet);
                localStorage.setItem('coronerBadge', badgeToSave);
                localStorage.setItem('coronerRank', rankToSave);
                localStorage.setItem('coronerDiscord', discordToSave);
                localStorage.setItem('coronerEmployee_timestamp', timestamp);
                localStorage.setItem('coronerBadge_timestamp', timestamp);
                localStorage.setItem('coronerRank_timestamp', timestamp);
                localStorage.setItem('coronerDiscord_timestamp', timestamp);
                setFormData(prev => ({
                    ...prev,
                    coronerBadge: badgeToSave,
                    coronerRank: rankToSave,
                    coronerDiscord: discordToSave
                }));
            } else {
                localStorage.setItem(name, valueToSet);
                localStorage.setItem(`${name}_timestamp`, timestamp);
            }
        }

        const threeHourExpiryFields = ['pronouncedTimeOfDeath', 'department', 'dateTime', 'placeOfDeath', 'mannerOfDeath'];
        if (threeHourExpiryFields.includes(name)) {
            localStorage.setItem(name, valueToSet);
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

// Define this function within your App component
const getCopyButtonText = () => {
    const baseText = "Copy ";
    // Use the existing versionNames map
    const formName = versionNames[bbCodeVersion] || "DEBUG - update title logic";
    return `${baseText}${formName}`;
};

// New main handler function
const handleCopyAndNotify = async () => {
    const bbCodeToCopy = getBBCodeContent(); // Use your existing function
    const versionName = versionNames[bbCodeVersion] || "Unknown Form"; // Use existing map

    if (!bbCodeToCopy) {
        showNotification(`Failed to generate BBCode for ${versionName}. Please check form data. Copying and saving skipped.`, 'error');
        Sentry.captureMessage(`getBBCodeContent returned null/undefined for bbCodeVersion: ${bbCodeVersion} in handleCopyAndNotify`, 'error');
        return;
    }

    const canProceedAfterSaveAttempt = await saveReport();

    if (!canProceedAfterSaveAttempt) {
        console.log("Report saving failed, or validation error occurred for saveable form, or BBCode generation failed. Copying to clipboard is skipped.");
        return; // Exit without copying
    }

    const currentDateTime = new Date().toLocaleString();
    const {
        decedentName, coronerEmployee, coronerRank, patientName, decedentOOC,
        phmcEmployee, requestingOfficer, patientID, patientFirstName, patientLastName,
        showRequestingOfficerInput // Ensure this is destructured if not already
    } = formData;

    try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
            throw new Error("Clipboard API not available");
        }

        await navigator.clipboard.writeText(bbCodeToCopy);
        showNotification(`${versionName} copied to clipboard!`, 'check-circle'); // Main copy notification
        console.log(`Notification 1: ${versionName} copied to clipboard!`);


        // --- Debugging for Coroner Email Switch Notification ---
        console.log("Attempting to show Coroner Email switch notification. Current state:", {
            bbCodeVersion: bbCodeVersion,
            isDeathReportForm: bbCodeVersion === 1,
            showRequestingOfficerInput: formData.showRequestingOfficerInput,
            isReportRequested: formData.showRequestingOfficerInput === true
        });

        if (bbCodeVersion === 1 && formData.showRequestingOfficerInput === true) {
            console.log("CONDITIONS MET: Showing Coroner Email switch notification.");
            // Capture the ID of this specific notification
            const coronerEmailNotificationId = showNotification(
                <>
                    A Coroner Email was requested for this report.
                    <Button
                        variant="info"
                        size="sm"
                        className="ms-2 notification-action-button"
                        onClick={() => {
                            console.log("Coroner Email switch button CLICKED in notification.");
                            handleAgencySelect(2); // Switch to Coroner Email (bbCodeVersion 2)
                            removeNotification(coronerEmailNotificationId); // Dismiss this notification
                        }}
                    >
                        Switch to Coroner Email Form
                    </Button>
                </>,
                'info-circle', // Icon for the notification
                15000          // Duration in milliseconds (15 seconds)
            );
        } else {
            console.log("CONDITIONS NOT MET for Coroner Email switch notification. formData.showRequestingOfficerInput is:", formData.showRequestingOfficerInput);
        }
        // --- END ADDED NOTIFICATION LOGIC ---

        // Proceed to send webhook
        const discordWebhookUrl = process.env.REACT_APP_DISCORD_WEBHOOK_URL;
        if (discordWebhookUrl) {
            const currentIdentifier = `${decedentName || ''}|${decedentOOC || ''}`;

            if (currentIdentifier && currentIdentifier === lastWebhookIdentifier) {
                console.log('Duplicate report copy detected, skipping webhook.');
            } else {
                let savedCount = parseInt(localStorage.getItem('SavedReportCount') || '0', 10);
                if (isNaN(savedCount)) savedCount = 0;

                const userValue = phmcEmployee
                    ? `Hospital Staff ${phmcEmployee}`
                    : coronerEmployee
                        ? `${coronerRank || 'Coroner'} ${coronerEmployee}`
                        : (patientFirstName || patientLastName)
                            ? `${patientFirstName || ''} ${patientLastName || ''}`.trim()
                            : 'Unknown User';
                
                let actionMessage = "BBCode Copied";
                const knownSaveableVersions = [1, 3, 4, 5, 6, 7, 19, 25];
                if (knownSaveableVersions.includes(bbCodeVersion) && canProceedAfterSaveAttempt) {
                    let validationForSavePassed = false;
                    if (bbCodeVersion === 1 && formData.decedentOOC && formData.dateTime) validationForSavePassed = true;
                    else if ((bbCodeVersion >= 3 && bbCodeVersion <= 7) && formData.patientID && formData.patientName && formData.date) validationForSavePassed = true;
                    else if (bbCodeVersion === 19 && formData.patientID && formData.lastName && formData.date) validationForSavePassed = true;
                    else if (bbCodeVersion === 25 && formData.patientName && formData.date) validationForSavePassed = true;
                    
                    if(validationForSavePassed) actionMessage = "BBCode Copied & Report Saved to Local Storage";
                }

                const successEmbed = {
                    title: "Someone has used your generator!",
                    description: "Here's the debug output.",
                    color: 0x00FF00,
                    fields: [
                        { name: "User", value: userValue, inline: true },
                        { name: "Form Type", value: versionName, inline: true },
                        { name: "Patient/Decedent", value: `${patientName || decedentName || patientID || 'N/A'}`, inline: true },
                        { name: "OOC Name", value: decedentOOC || "N/A", inline: true },
                        { name: "Requesting Officer", value: requestingOfficer || "N/A", inline: true },
                        { name: "Timestamp", value: currentDateTime, inline: false },
                        { name: "Action", value: actionMessage, inline: false },
                        { name: "Total Saved Reports", value: savedCount.toString(), inline: false }
                    ],
                    footer: { text: `PHMC Forms Tool | gh-pages ${commitInfo.sha || 'N/A'}` },
                    timestamp: new Date().toISOString()
                };

                const response = await fetch(discordWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ embeds: [successEmbed] })
                });

                if (response.ok) {
                    setLastWebhookIdentifier(currentIdentifier);
                } else {
                    console.error('Failed to send Discord webhook after copy:', response.status, response.statusText);
                    Sentry.captureMessage(`Discord webhook failed after copy: ${response.status}`, {
                        level: 'error',
                        extra: { statusText: response.statusText }
                    });
                }
            }
        } else {
            console.warn('Discord webhook URL not set, skipping notification.');
        }

    } catch (error) {
        console.error('Error during copy/save or webhook: ', error);
        Sentry.captureException(error, { extra: { context: 'handleCopyAndNotify', errorName: error.name, errorMessage: error.message } });

        const saveStatusMessage = canProceedAfterSaveAttempt ? "Report saving process was run (saved if applicable)." : "Report saving failed or was skipped due to validation.";

        if (error.message === "Clipboard API not available") {
            showNotification(`Clipboard API not available! BBCode not copied. ${saveStatusMessage}`, 'exclamation-triangle');
        } else {
            showNotification(`Failed to copy BBCode! ${saveStatusMessage}`, 'exclamation-triangle');
        }

        const discordWebhookUrl = process.env.REACT_APP_DISCORD_WEBHOOK_URL;
        if (discordWebhookUrl) {
            const userValue = phmcEmployee
                ? `Hospital Staff ${phmcEmployee}`
                : coronerEmployee
                    ? `${coronerRank || 'Coroner'} ${coronerEmployee}`
                    : (patientFirstName || patientLastName)
                        ? `${patientFirstName || ''} ${patientLastName || ''}`.trim()
                        : 'Unknown User';
            const failureEmbed = {
                title: `BBCode Copy Failed (${error.message === "Clipboard API not available" ? "Clipboard API Unavailable" : "Error"})`,
                color: 0xFF0000,
                fields: [
                    { name: "User", value: userValue, inline: true },
                    { name: "Form Type", value: versionName, inline: true },
                    { name: "Patient/Decedent", value: `${patientName || decedentName || patientID || 'N/A'}`, inline: true },
                    { name: "OOC Name", value: decedentOOC || "N/A", inline: true },
                    { name: "Requesting Officer", value: requestingOfficer || "N/A", inline: true },
                    { name: "Timestamp", value: currentDateTime, inline: false },
                    { name: "Action", value: `Report saving process was run (saved if applicable), but BBCode could not be copied. Error: ${error.message}`, inline: false },
                ],
                footer: { text: `PHMC Forms Tool | gh-pages ${commitInfo.sha || 'N/A'}` },
                timestamp: new Date().toISOString()
            };
            fetch(discordWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [failureEmbed] })
            }).catch(fetchError => {
                console.error('Failed to send Discord failure webhook:', fetchError);
                Sentry.captureException(fetchError, { extra: { context: 'Discord Webhook Clipboard Fail Send' } });
            });
        }
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
        <div className="floating-tools-container">
            <Button
                variant="light" // Or your preferred style
                className="floating-tool-button"
                onClick={() => setShowMissingEmployeeModal(true)}
                title="Missing Employee Data"
            >
                <i className="fas fa-user-plus"></i>
                <span className="floating-button-text">Missing Employee</span>
            </Button>
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
            <Button
                variant="light"
                className="floating-tool-button"
                onClick={toggleEmsAmaModal} // +++ Use the new toggle function
                title="Saved Reports"
            >
<i class="fa-solid fa-truck-medical"></i>
                <span className="floating-button-text">EMS Against Medical Advise</span>
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
                                    <h3>Changelog - Version 2.0.9 -  </h3>
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
                                        New Employees have been added to PHMC List.
                                        
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
                            <Button
                                type="button"
                                variant='danger'
                                className="changelog-button" // You might want a specific class/style
                                onClick={openWebhookModalWithTemplate}
                                title="Send a test message to the dev webhook"
                            >
                                <i className="fas fa-paper-plane"></i> Send Dev Webhook
                            </Button>
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
            <Form.Control type="text" name="coronerName" value={missingEmployeeData.coronerName} onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerName')} placeholder='Employee First Name and Last Name' required />
            <Form.Control type="text" name="employeeLastName" value={missingEmployeeData.employeeLastName} onChange={(e) => handleMissingEmployeeChange(e.target.value, 'employeeLastName')} placeholder='Employee Last Name' required />
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
<BusinessCardModal
    show={showBusinessCard}
    onHide={() => setShowBusinessCard(false)} // Or onHide={toggleBusinessCard} if you prefer
    showNotification={showNotification}
    commitInfo={commitInfo}
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
                            onClick={handleCopyAndNotify}
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
