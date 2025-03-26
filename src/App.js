import React, { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import '@fortawesome/fontawesome-free/css/all.min.css';
import Notification from './components/Notification';
import { Modal, Form, Button, InputGroup } from 'react-bootstrap';
import domtoimage from 'dom-to-image';
// logos
import LSPDLogo from './assets/lspd.png'
import LSSDLogo from './assets/lssd.png'
import LSFDLogo from './assets/lsfd.png'
import maternity from './assets/maternity.png'
import obstetrical from './assets/obstetrical.png'
import psychology from './assets/psychology.png'
import gyne from './assets/gyne.png'
import emergency from './assets/emergency.png'
import empathy from './assets/empathy.png'
import email from './assets/email.png'
import gynecology from './assets/gynecology.png'
import surgeon from './assets/surgeon.png'
import PHMCCivilian from './assets/PHMCCivilian.png'
import Civilian from './assets/Civilian.png'
import application from './assets/application.png'
import nurse from './assets/nurse.png'
import PHMCLogo from './assets/phmc.png'
// import developer from './assets/developer.png'
import corpse from './assets/corpse.png'
import Paperwork from './assets/myPaperwork2.png';
import paperwork2 from './assets/paperwork.png'
import Feedback from './assets/feedback.png';
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
    paletoClinicDepartment,
    painLevel,
    vitals,
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
    formatSignature,
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
    Speech,
    Mood,
    Affect,
    Risk,
    ThoughtProcess,
    ThoughtContent,
    Insight,
    Cognition
} from './data';

// css fun

import './App.css';
import './buttons.css'

import 'react-bootstrap-typeahead/css/Typeahead.css';
import { FormHelperText } from '@mui/material';
// HALF OF THIS CODE IS SPAGHETTI, A MESS, IT CAUSES ME HEADACHES, I WILL NOT REFACTOR BECAUSE ITS 1K LINES LONG
// IM SORRY FOR WHOEVER WORKS ON THIS GITHUB REPOSITORY 
// - FROSTYYY
function App() {
    const [isMobile, setIsMobile] = useState(false);
    const [formData, setFormData] = useState({
        coronerRank: 'Forensic Attendant',
        placeOfDeath: '',
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
        decedentOOC: '',
        scenePhotos: '',
        patientMedInfoFormatOther: '',
        patientZIP: '',
        lastName: '',
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
        extraStaff: '',
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
        // surgical ops v2 vitals
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
        PurposeAttorney: '',
        PurposePersonal: '',
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
        vitals: '',
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
    const [isDoctor, setIsDoctor] = useState(false);
    const [isNurse, setIsNurse] = useState(false);
    const [isPsych, setIsPsych] = useState(false);
    const [isSurgeon, setIsSurgeon] = useState(false);
    const [notification, setNotification] = useState(null);
    const [selectedForm, setSelectedForm] = useState(null);
    const [commitInfo, setCommitInfo] = useState({ sha: '', date: null });
    const [showPHMCModal, setShowPHMCModal] = useState(false);


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
    const [showFeatureRequestModal, setShowFeatureRequestModal] = useState(false);
    const [featureRequest, setFeatureRequest] = useState('');
    const [discordName, setDiscordName] = useState('');
    const [showMissingEmployeeModal, setShowMissingEmployeeModal] = useState(false);
    const [missingEmployeeData, setMissingEmployeeData] = useState({
        coronerName: '',
        coronerDiscord: '',
        coronerRank: '',
        coronerPHNumber: '',
        coronerEmployee: '',
        coronerBadge: '',
        phmcEmployee: '',

    });
    const handleMissingEmployeeChange = (value, type) => {
        setMissingEmployeeData(prevData => ({
            ...prevData,
            [type]: value,
        }));
    };
const handleMissingEmployeeSubmit = async () => {
    try {
        const webhookURL = process.env.REACT_APP_DISCORD_WEBHOOK_URL;

        if (!webhookURL) {
            console.error('Something has gone wrong with the .env file.');
            setNotification({
                message: 'Discord webhook URL is not defined.',
                icon: 'fas fa-exclamation-triangle',
            });
            return;
        }

        const response = await fetch(webhookURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: `<@228306972204597248> New Employee Name Request by: ${missingEmployeeData.phmcEmployee} ${missingEmployeeData.coronerEmployee}  \n name: ${missingEmployeeData.coronerName} \n discord/department: ${missingEmployeeData.coronerDiscord}\n rank: ${missingEmployeeData.coronerRank} \n badge: ${missingEmployeeData.coronerBadge}`,
            }),
        });

        if (response.ok) {
            setNotification({
                message: 'Success! Added to next server restart',
                icon: 'fas fa-check-circle',
            });
            setShowMissingEmployeeModal(false);
            setMissingEmployeeData({
                coronerName: '',
                coronerDiscord: '',
                coronerRank: '',
                coronerPHNumber: '',
                coronerEmployee: '',
                coronerBadge: '',
                phmcEmployee: '',
            });
            // Add fade-out effect
            setTimeout(() => {
                setNotification(null);
            }, 2000); // 2 seconds
        } else {
            console.error('Failed to send message to Discord webhook.');
            setNotification({
                message: 'Failed to submit. Please try again.',
                icon: 'fas fa-exclamation-triangle',

            });
        }
    } catch (error) {
        console.error('Error submitting data:', error);
        setNotification({
            message: 'An error occurred. Please try again.',
            icon: 'fas fa-exclamation-triangle',
        });
    }
};
const handleFeatureRequestSubmit = async () => {
    const webhookURL = process.env.REACT_APP_DISCORD_WEBHOOK_URL;

    if (!webhookURL) {
        console.error('Something has gone wrong.');
        setNotification({
            message: 'Internal Server Error..',
            icon: 'fas fa-exclamation-triangle',
        });
        return;
    }

    // Collect debug information
    const debugInfo = {
        bbCodeVersion: bbCodeVersion,
        userAgent: navigator.userAgent,
        errors: localStorage.getItem('consoleErrors') || 'No errors were logged',
    };

    try {
        const response = await fetch(process.env.REACT_APP_DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: `New Bug/Feature Request: ${featureRequest} - Discord: ${discordName}\nDebug Info: ${JSON.stringify(debugInfo, null, 2)}`,
            }),
        });

        if (response.ok) {
            setNotification({
                message: 'Thanks for your feedback! I will work on it soon',
                icon: 'fas fa-check-circle',
            });
            setShowFeatureRequestModal(false); // Close the modal
            setTimeout(() => {
                setNotification(null);
            }, 2000); // 2 seconds
        } else {
            console.error('Failed to send message to Discord webhook.');
            setNotification({
                message: 'Failed to submit. Please try again.',
                icon: 'fas fa-exclamation-triangle',

            });
        }
    } catch (error) {
        console.error('Error submitting data:', error);
        setNotification({
            message: 'An error occurred. Please try again.',
            icon: 'fas fa-exclamation-triangle',
        });
    }
};    // Separate PHMC options
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
        // Log each category group
        return {
            label: category,
            options: options.sort((a, b) => a.label.localeCompare(b.label))
        };
    });

    // Update handleChange function

    const handleDoeChange = (type) => (e) => {
        if (type === 'john') {
            setIsJohnDoe(e.target.checked);
            setIsJaneDoe(false);
            if (e.target.checked) {
                setFormData(prev => ({ ...prev, decedentName: 'John Doe' }));
            } else if (formData.decedentName === 'John Doe') {
                setFormData(prev => ({ ...prev, decedentName: '' }));
            }
        } else if (type === 'jane') {
            setIsJaneDoe(e.target.checked);
            setIsJohnDoe(false);
            if (e.target.checked) {
                setFormData(prev => ({ ...prev, decedentName: 'Jane Doe' }));
            } else if (formData.decedentName === 'Jane Doe') {
                setFormData(prev => ({ ...prev, decedentName: '' }));
            }
        }
    };

    const handlePHMCRank = (type) => (e) => {
        if (type === 'doctor') {
            setIsDoctor(e.target.checked);
            setIsNurse(false);
            setIsPsych(false);
            setIsSurgeon(false);
            if (e.target.checked) {
                setRank('DOC');
                setFormData(prev => ({ ...prev, phmcRank: 'DOC' }));
            } else {
                setRank('');
                setFormData(prev => ({ ...prev, phmcRank: '' }));
            }
        } else if (type === 'nurse') {
            setIsNurse(e.target.checked);
            setIsDoctor(false);
            setIsPsych(false);
            setIsSurgeon(false);
            if (e.target.checked) {
                setRank('NURSE');
                setFormData(prev => ({ ...prev, phmcRank: 'NURSE' }));
            } else {
                setRank('');
                setFormData(prev => ({ ...prev, phmcRank: '' }));
            }
        } else if (type === 'psych') {
            setIsPsych(e.target.checked);
            setIsDoctor(false);
            setIsNurse(false);
            setIsSurgeon(false);
            if (e.target.checked) {
                setRank('PSYCH');
                setFormData(prev => ({ ...prev, phmcRank: 'PSYCH' }));
            } else {
                setRank('');
                setFormData(prev => ({ ...prev, phmcRank: '' }));
            }
        } else if (type === 'surgeon') {
            setIsSurgeon(e.target.checked);
            setIsDoctor(false);
            setIsNurse(false);
            setIsPsych(false);
            if (e.target.checked) {
                setRank('SURGEON');
                setFormData(prev => ({ ...prev, phmcRank: 'Surgeon' }));
            } else {
                setRank('');
                setFormData(prev => ({ ...prev, phmcRank: '' }));
            }
        }
    };

    useEffect(() => {
        // Store console errors in localStorage
        let consoleErrors = JSON.parse(localStorage.getItem('consoleErrors')) || [];
        const originalConsoleError = console.error;
    
        console.error = function (message) {
            const timestamp = new Date().getTime(); // Get current timestamp
            consoleErrors.push({
                message: message,
                bbCodeVersion: bbCodeVersion,
                timestamp: timestamp, // Store timestamp with the error
            });
            localStorage.setItem('consoleErrors', JSON.stringify(consoleErrors));
            sendErrorToDiscord(message, bbCodeVersion);
            originalConsoleError.apply(console, arguments);
        };
    
        window.onerror = async (message, source, lineno, colno, error) => {
            let lineContent = '';
            try {
                // Attempt to fetch the line content from the source file
                const response = await fetch(source);
                if (response.ok) {
                    const fileContent = await response.text();
                    const lines = fileContent.split('\n');
                    lineContent = lines[lineno - 1] || 'Line content not available';
                } else {
                    lineContent = `Failed to fetch source file: ${response.status} ${response.statusText}`;
                }
            } catch (fetchError) {
                lineContent = `Error fetching source file: ${fetchError.message}`;
            }
    
            const errorMessage = `
                Error: ${message}
                Source: ${source}
                Line: ${lineno}
                Column: ${colno}
                Line Content: ${lineContent}
                Error Object: ${error ? error.stack : 'No stack available'}
                BBCode Version: ${bbCodeVersion}
            `;
    
            sendErrorToDiscord(errorMessage, bbCodeVersion); // Send window.onerror to Discord
    
            return true; // Prevent default error handling
        };
    
        // Cleanup function to restore original console.error and clear old errors
        return () => {
            console.error = originalConsoleError;
    
            // Clear errors older than 30 minutes (1800000 milliseconds)
            const now = new Date().getTime();
            const thirtyMinutes = 1800000;
            const updatedErrors = consoleErrors.filter(error => now - error.timestamp < thirtyMinutes);
            localStorage.setItem('consoleErrors', JSON.stringify(updatedErrors));
        };
    }, [bbCodeVersion]);

    const sendErrorToDiscord = async (errorMessage, bbCodeVersion) => {
        const discordWebhookUrl = process.env.REACT_APP_DISCORD_WEBHOOK_URL;
    
        if (!discordWebhookUrl) {
            console.error("Discord webhook URL is not defined in .env file.");
            return;
        }
    
        // Retrieve all console errors from localStorage
        const allConsoleErrors = JSON.parse(localStorage.getItem('consoleErrors')) || [];
    
        // Format all console errors into a single string
        const formattedConsoleErrors = allConsoleErrors.map((err, index) => `Error ${index + 1}:\nMessage: ${err.message}\nBBCode Version: ${err.bbCodeVersion}\n`).join('\n');
    
        // Combine the main error message and console errors
        let fullMessage = `**ERROR REPORT**\nBBCode Version: ${bbCodeVersion}\n${errorMessage}\n\n**All Console Errors:**\n${formattedConsoleErrors}`;
    
        // Discord's message limit is 2000 characters
        if (fullMessage.length > 2000) {
            // Split the message into chunks
            const chunks = [];
            let currentChunk = '';
            const lines = fullMessage.split('\n');
    
            for (const line of lines) {
                if (currentChunk.length + line.length + 1 <= 2000) {
                    currentChunk += line + '\n';
                } else {
                    chunks.push(currentChunk);
                    currentChunk = line + '\n';
                }
            }
            chunks.push(currentChunk);
    
            for (const chunk of chunks) {
                try {
                    await fetch(discordWebhookUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            content: chunk
                        })
                    });
                } catch (error) {
                    console.error("Error sending error message to Discord:", error);
                }
            }
        } else {
            try {
                await fetch(discordWebhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        content: fullMessage
                    })
                });
            } catch (error) {
                console.error("Error sending error message to Discord:", error);
            }
        }
    };    
    const generateDeath = () => {
        const {
            coronerRank,
            placeOfDeath,
            department,
            dateTime,
            coronerEmployee,
            coronerBadge,
            decedentName,
            decedentOOC,
            pronouncedTimeOfDeath,
            synopsis,
            probableCauseOfDeath,
            mannerOfDeath,
            typeOfDeath,
            scenePhotos,
            additionalImages,
        } = formData;

        const scenePhotosBBCode = scenePhotos.split(',').map(photo => `[img]${photo.trim()}[/img]`).join('\n');
        const additionalImagesBBCode = additionalImages.split(',').map(photo => `[img]${photo.trim()}[/img]`).join('\n');
        // Base BBCode for ID 1
        const bbCode = `[divbox=transparent][center][img]https://i.imgur.com/Hxjt4M2.png[/img][/center][/divbox]

[divbox=transparent][br][/br][center]DEATH INVESTIGATION REPORT[/center]
[hr][/hr]

[center][b]A. WRITTEN REPORT[/b][/center]

The County Coroner's Office has been called regarding the decease that occurred at the location of [b]${placeOfDeath}[/b]. Upon receiving the call from[b] ${departmentFullName(department)}[/b], Coroner's Office dispatched a ${coronerRank} to the crime scene to conduct an investigation on the [b]${dateTime}[/b].

The ${coronerRank}, [b]${coronerEmployee}[/b], Serial Number [b]${coronerBadge}[/b], arrived at the scene and identified the individual as [b]${decedentName}[/b], who is estimated to have died at [b]${pronouncedTimeOfDeath}[/b]. Following an initial investigation, The ${coronerRank} came up with the following [b]synopsis[/b]: ${synopsis}

Based on the information gathered from the scene investigation and the decedent's medical history (if available), the probable cause of death was determined to be [b]${probableCauseOfDeath}[/b]. The manner of death was classified as [b]${mannerOfDeath}[/b].
[/divbox]
[divbox=transparent][center][b]B. PHOTOGRAPHIC DOCUMENTARY RECORD[/b][/center]
[hr][/hr]
[center][size=85][b][u]SCENE PHOTOGRAPHY[/u][/b][/size][/center]
${scenePhotosBBCode}
[/divbox]

[divbox=transparent]
[center][b]C. STATEMENT[/b][/center]
[hr][/hr]
[size=85]As a ${coronerRank}, I have made detailed notes of my findings and conclusions, and these notes are available for review if necessary. However, I must note that these notes do not contain any personal opinions and are solely based on the evidence and facts available to me.

In conclusion, I hope that this report provides the necessary information required for the agency to move forward with any necessary actions. Please let me know if you require any additional information or if I can be of further assistance.

I certify that the information contained in this report is true and accurate to the best of my knowledge and belief. I have reviewed the report and ensured that all information included is complete and accurate. [/size][/divbox]

[divbox=transparent]
[center][b]D. PRIVACY AND CONFIDENTIALITY[/b][/center]
[hr][/hr]
[center][size=85]This document from the Forensic Medicine and Pathology Department of Pillbox Hill Medical Center certifies the authenticity of the information contained within. Any unauthorized distribution or use of this information is in violation of the Health Insurance Portability and Accountability Act (HIPAA), as well as state and federal privacy laws, including but not limited to the San Andreas Confidentiality of Medical Information Act (CMIA) and the San Andreas Information Practices Act (IPA).

It is imperative that all parties handling this document respect the privacy and confidentiality of the decedent and their family. Any violation of these laws may result in legal action being taken against the responsible parties.

This document is provided for official purposes only and is not to be construed as legal advice or medical diagnosis. If additional information or clarification is needed, please contact the Forensic Medicine and Pathology Department of Pillbox Hill Medical Center.[/size][/divbox]

[divbox=transparent][center][b][u](( OUT OF CHARACTER IMAGES ))[/u][/b][/center][hr][/hr]

This section clarifies whether or not if the player was character killed or player killed. 
In this case the player was; ${typeOfDeath}
Player OOC Name: ${decedentOOC}
${formData.morgueStatus === 'true' ? '[b][color=red](( The Morgue Screen is currently bugged and we unfortunately cannot pull Morgue Screen images )) [/color][/b]' : ''}
Morgue screen, cinjuries, cdna links: 
[size=85][u] THESE IMAGES ARE [B]OUT OF CHARACTER[/B] FOR INTERNAL RECORDS, DO NOT USE THESE AS EVIDENCE. [/u][/size]
${additionalImagesBBCode}

[/divbox]
`;

        return bbCode;
    };

    const generateEmail = () => {
        const {
            requestingOfficer,
            department,
            coronerEmployee,
            coronerRank,
            coronerDiscord,
            coronerPHNumber,
            deathReport,
            additionalReports,
        } = formData;

        // Base BBCode for ID 2
        let bbCode = `[center][img]https://i.imgur.com/ItaoQkO.png[/img][/center]
[hr][/hr]
    
TO: ${requestingOfficer} - ${department}
FROM: ${coronerEmployee} @ phmc.health
SUBJECT: Death Report Paperwork

For the attention of: [b]${department}[/b] - [b]${requestingOfficer}[/b]

This Coroner Report has been written by ${coronerRank} ${coronerEmployee} you can find the enclosed documents attached to this email. 

[b]AUTOPSY INFORMATION / REQUEST(S)[/B] 
If you require an autopsy, please follow this link and follow the instructions: [url=https://phmc.gta.world/viewforum.php?f=265]Autopsy Portal[/url].


[altspoiler=Request a Autopsy FAQ]
1) How do I request an autopsy report and/or a death certificate?
Autopsies and death certificates can aid in various situations, especially whenever the cause of death plays a vital role in. Our professionals attempt to handle each and every request in a timely manner. However, given the fact that the effort of documentation is immense, a request fee is associated along with it. Upon its payment, the report or certificate will be sent to you directly.


2) Is there a fee associated with the request process?
Yes, there is a $2,000 fee associated with the request. This fee covers administrative costs related to processing and maintaining your requested report/certificate securely within our systems. It ensures the continued improvement of our services, maintaining the highest standards in healthcare data management.


3) How do I pay the $2,000 request fee?
To pay your $2,000 request fee, please log into the banking website and navigate to the "Payment" section. Select your preferred payment method (e.g., credit card, debit card), insert our routing number (020000062), enter the required payment details, review the transaction, and confirm your payment. (( Type /transfer 2000 020000062 ))

(( Autopsies for Player Kills (PK) and Character Kills (CK) will only be accepted if they are deemed strictly necessary and relevant to an important case or investigation. Prior to making a request for such an autopsy, a member of the Medical-Examiners must be notified and consulted with. Furthermore, it is mandatory to provide information about /cdamages and /cexamine. In the event that this information is not available, please do not hesitate to contact an administrator in-game, who can provide it. If these steps are not followed, an automatic denial will cause your request to be archived.

Also if it is a PK, please be sure to use John/Jane Doe with their character name in OOC brackets . Ex: John Doe (( James Smith ))

[url=https://phmc.gta.world/ucp.php?i=pm&mode=compose&g=50]Click here to contact a Medical-Examiner to get the green light![/url] ))
[/altspoiler]
If you have further enquiries, feel free to reach out to the following individual:
[list] ${coronerEmployee}
[*] Phone Number: ${coronerPHNumber}
[*] (( Discord: ${coronerDiscord} ))[/list]

[altspoiler=Coroner Report]
${deathReport}
[code]
${deathReport}

[/code]
[/altspoiler]
${additionalReports && additionalReports.length > 0
                ? additionalReports
                    .filter(report => report.trim())
                    .map((report, index) => `
[altspoiler=Coroner Report - Additional ${index + 1}]
${report}
[code]
${report}
[/code]
[/altspoiler]`).join('\n\n')
                : ''
            }

Kind regards
${coronerRank} ${coronerEmployee}
Pillbox Hill Medical Center - Pathology  and Forensic Medicine

[size=75]The content of this email is intended for the person or entity to which it is addressed only. This email may contain confidential information. If you are not the person to whom this message is addressed, be aware that any use, reproduction, or distribution of this message is strictly prohibited. If you received this in error, please contact the sender and immediately delete this email and any attachments.[/size]`;

        return bbCode;
    };

    // Base BBCode for ID 4
    const generateDental = () => {
        const {
            PatientMedicalRecord,
            PatientName,
            patientWeight,
            patientChewing,
            patientDateofBirth,
            patientMedicine,
            patientNewMedicine,
            patientTreatment,
            patientDiagnosis,
            patientPrescription,
            patientSummary,
            phmcEmployee,
            date,
        } = formData;

        let bbCode = `[divbox=lightgrey][size=150]

[center][b]DEPARTMENT OF DENTAL MEDICINE[/b]
[color=#800000][b]DENTAL CONSULTATION[/b][/color][/center][/size]

[/divbox]

[divbox=lightgrey][b]SECTION 0: PERSONAL INFORMATION[/b][/divbox]
[divbox=transparent][table][tr][td][b]0.1[/b] Identifying
[/td][td]
[b]Medical Record Number:[/b] ${PatientMedicalRecord}
[b]Full Name:[/b] ${PatientName}
[b]Date Of Birth:[/b] ${patientDateofBirth}

[/table][/divbox]

[divbox=lightgrey][b]SECTION 1: PATIENT MEASUREMENTS[/b][/divbox]
[divbox=transparent][table][tr][td][b]1.1[/b] Weight[/td][td]
${patientWeight}

[tr][td][b]1.2[/b] Problems With Chewing & Swallowing[/td][td]
${patientChewing}

[/table][/divbox]

[divbox=lightgrey][b]SECTION 2: PRIORITY CLASSIFICATION[/b][/divbox]
[divbox=transparent][table][tr][td][b]2.1[/b] Priority Criteria [/td][td]
[cb${formData.patientFormYes ? 'c' : ''}][/cb${formData.patientFormYes ? 'c' : ''}] Priority 1: Immediate care
[cb${formData.patientFormNo ? 'c' : ''}][/cb${formData.patientFormNo ? 'c' : ''}] Priority 2: Extensive amount of decay
[cb${formData.patientMale ? 'c' : ''}][/cb${formData.patientMale ? 'c' : ''}] Priority 3: Obvious cavities
[cb${formData.patientFormYes2 ? 'c' : ''}][/cb${formData.patientFormYes2 ? 'c' : ''}] Priority 0: No obvious cavities

[/table][/divbox]

[divbox=lightgrey][b]SECTION 3: MEDICATIONS[/b][/divbox]
[divbox=transparent][table][tr][td][b]3.1[/b] Current Medications[/td][td]
${patientMedicine}

[tr][td][b]3.2[/b] New Medications[/td][td]
${patientNewMedicine}

[/table][/divbox]

[divbox=lightgrey][b]SECTION 4: DIAGNOSIS[/divbox]
[divbox=transparent][table]

[tr][td][b]4.1[/b] Mark Tooth Decay Area[/td][td]
[img]https://i.imgur.com/31wOMlD.jpeg[/img]

[tr][td][b]4.2[/b] Diagnosed With[/td][td]
${patientDiagnosis}

[tr][td][b]4.3[/b] Treatment[/td][td]
${patientTreatment}

[tr][td][b]4.4[/b] Prescription[/td][td]
${patientPrescription}

[/table][/divbox]

[divbox=lightgrey][b]SECTION 5: SUMMARY OF CONSULTATION[/b][/divbox]
[divbox=transparent][list=none]

${patientSummary}

[/divbox][divbox=lightgrey][b]SECTION 6: PERSON IN CHARGE OF THE CONSULTATION[/b][/divbox]

[divbox=transparent][table][tr][td][b]6.1[/b] Full Name (Signature)[/td][td] ${phmcEmployee}
[tr][td][b]6.2[/b] Full Name (Print)[/td][td]${phmcEmployee}
[tr][td][b]6.3[/b] Date[/td][td]${date}[/table][/divbox]`;

        return bbCode;
    };

    // Add new generation Surgical Ops function 5 generateSurgicalOps
    const generateSurgicalOps = () => {
        const {
            phmcEmployee,
            extraStaff,
            patientID,
            patientSummaryConsultation,
            patientAddress,
            rank,
            date,
            patientSummary,
            lastName,
            surgeryProcedures
        } = formData;
        const extraStaffNames = Array.isArray(extraStaff) ? extraStaff.join(', ') : extraStaff;

        let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]SURGICAL REPORT[/b]

PATIENT ${patientID}

Date: ${date}
Signed: ${rank} ${lastName}

[/center][td][center][img]https://i.imgur.com/QMaz0OC.png[/img][/center][td][center][br][/br][br][/br][size=100][b]PILLBOX HILL MEDICAL CENTER[/b]
ELGIN AVE. / STRAWBERRY AVE.
PO BOX 742
LOS SANTOS, SAN ANDREAS
P: 50056[/size][/center][/table][/divbox]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Personnel[/b][/color][/center][/divboxcolor]
[table][tr][td]Lead Surgeon[/td][td]
${phmcEmployee}
[/td][/tr]
[tr][td]Additional Staff [i](leave empty if none)[/i][/td][td]
${extraStaff}
[/td][/tr][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Surgical Inquiry[/b][/color][/center][/divboxcolor]
[table]

[tr][td]Name of the procedure[/td][td]
${surgeryProcedures}

[tr][td]Did the patient or their family consent, or did they have a life threatening or severe injury that requires immediate surgical intervention?[/td][td]
[cb${formData.patientConsentOption === 'Yes' ? 'c' : ''}] Yes
[cb${formData.patientConsentOption === 'No' ? 'c' : ''}] No


[/td][/tr]

[tr][td]Did any medical complications occur during the surgery?[/td][td]
[cb${formData.patientComplicationOptions === 'Yes' ? 'c' : ''}] Yes
[cb${formData.patientComplicationOptions === 'No' ? 'c' : ''}] No
[/td][/tr]

[tr][td]Was the procedure completed successfully, and did it result in the desired clinical outcome?[/td][td]
[cb${formData.procedureGoodOptions === 'Yes' ? 'c' : ''}] Yes
[cb${formData.procedureGoodOptions === 'No' ? 'c' : ''}] No
[/td][/tr]
[/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Post-Anesthesia Report[/b][/color][/center][/divboxcolor]
[table]

[tr][td]Type & Dosage of Anesthesia Administered[/td][td] ${patientSummaryConsultation}
[/td][/tr]

[tr][td]Post-Operative Anesthesia Details[/td][td]${patientAddress}
[/td][/tr]

[/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Summary of Surgical Procedure[/b][/color][/center][/divboxcolor]
[table]

[tr][td]
${patientSummary}

[/table]`;

        return bbCode;
    };

    // Base BBCode for ID 6 Physical Evaluation (Internal Medicine generatePhysEvalInternalMed)

    const generatePhysEvalInternalMed = () => {
        const {
            patientID,
            date,
            lastName,
            patientHeight,
            patientWeight,
            phmcRank,
            careerRisks,
            patientAllergies,
            patientMedicine,
            patientcareerNo,
            patientSummary,
            patientCareer,
            patientImpairments,
        } = formData;

        let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]PHYSICAL EXAMINATION[/b]

PATIENT ${patientID}

Date: ${date}
Signed: ${phmcRank} ${lastName}
[/center][td][center][img]https://i.imgur.com/QMaz0OC.png[/img][/center][td][center][br][/br][br][/br][size=100][b]PILLBOX HILL MEDICAL CENTER[/b]
ELGIN AVE. / STRAWBERRY AVE.
PO BOX 742
LOS SANTOS, SAN ANDREAS
P: 50056[/size][/center][/table][/divbox]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Patient Measurements[/b][/color][/center][/divboxcolor]
[table][tr][td][list=none][br][/br]Height: ${patientHeight}
[br][/br]
Weight: ${patientWeight}
[/list][td]
[list=none][u]Body Mass Index: [/u][br][/br]
[cb${formData.BodyMassIndex === 'Underweight' ? 'c' : ''}][/cb${formData.BodyMassIndex === 'Underweight' ? 'c' : ''}] Underweight
[cb${formData.BodyMassIndex === 'Normal' ? 'c' : ''}][/cb] Normal
[cb${formData.BodyMassIndex === 'Overweight' ? 'c' : ''}][/cb] Overweight
[cb${formData.BodyMassIndex === 'Obese' ? 'c' : ''}][/cb] Obese
[cb${formData.BodyMassIndex === 'ExtremeObese' ? 'c' : ''}][/cb] Extremely Obese
[/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Vitals[/b][/color][/center][/divboxcolor]
[table][tr][td][center]Temperature: [cb${formData.vitals === 'patientTempNormal' ? 'c' : ''}] Normal [cb${formData.vitals === 'patientHypothermic' ? 'c' : ''}] Hypothermic [cb${formData.vitals === 'patientHyperthermic' ? 'c' : ''}] Hyperthermic[/center]
[td][center]Heart Rate: [cb${formData.heartRate === 'patientHeartRateNormal' ? 'c' : ''}] Normal [cb${formData.heartRate === 'patientHeartRateBradycardia' ? 'c' : ''}] Bradycardia [cb${formData.heartRate === 'patientHeartRateTachycardia' ? 'c' : ''}] Tachycardia[/center][/table]
[table][tr][td][center]Breathing: [cb${formData.breathing === 'patientBreathingNormal' ? 'c' : ''}] Normal [cb${formData.breathing === 'patientBreathingSlow' ? 'c' : ''}] Slow [cb${formData.breathing === 'patientBreathingFast' ? 'c' : ''}] Fast [cb${formData.breathing === 'patientBreathingObstructed' ? 'c' : ''}] Obstructed[/center]
[td][center]Blood Pressure: [cb${formData.bloodPressure === 'patientBloodPressureNormal' ? 'c' : ''}] Normal [cb${formData.bloodPressure === 'patientBloodPressureHypotension' ? 'c' : ''}] Hypotension [cb${formData.bloodPressure === 'patientBloodPressureHypertension' ? 'c' : ''}] Hypertension [/center][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Anamnesis[/b][/color][/center][/divboxcolor]
[table][tr][td][list=none][u]Does the patient have a job? [/u][br][/br]
[cb${formData.patientJob === 'Yes' ? 'c' : ''}][/cb${formData.patientJob === 'Yes' ? 'c' : ''}] Yes: ${patientCareer}
[cb${formData.patientJob === 'No' ? 'c' : ''}][/cb${formData.patientJob === 'No' ? 'c' : ''}] No: ${patientcareerNo} [/list]
[td][list=none][u]If yes, are harmful risk factors present? [/u][br][/br]
[cb${formData.patientJobRisks === 'Yes' ? 'c' : ''}][/cb${formData.patientJobRisks === 'Yes' ? 'c' : ''}] Yes: ${careerRisks}
[cb${formData.patientJobRisks === 'No' ? 'c' : ''}][/cb${formData.patientJobRisks === 'No' ? 'c' : ''}] No [/list]
[/td][/tr]
[tr][td][list=none][u]Are allergies or risks (implants, case of incompatibility, pacemaker, etc.) present?[/u][br][/br]
[cb${formData.patientAllergiesRisk === 'Yes' ? 'c' : ''}][/cb${formData.patientAllergiesRisk === 'Yes' ? 'c' : ''}] Yes: ${patientAllergies}
[cb${formData.patientAllergiesRisk === 'No' ? 'c' : ''}][/cb${formData.patientAllergiesRisk === 'No' ? 'c' : ''}] No [/list]
[td][list=none][u]Does the patient take medications on a regular basis? [/u][br][/br]
[cb${formData.patientMedicineRegular === 'Yes' ? 'c' : ''}][/cb${formData.patientMedicineRegular === 'Yes' ? 'c' : ''}] Yes: ${patientMedicine}
[cb${formData.patientMedicineRegular === 'No' ? 'c' : ''}][/cb${formData.patientMedicineRegular === 'No' ? 'c' : ''}] No[/list]
[/td][/tr]
[tr][td][list=none][u]Does the patient have other medical condition(s) or physical impairments?[/u][br][/br]
[cb${formData.patientOther === 'Yes' ? 'c' : ''}][/cb${formData.patientOther === 'Yes' ? 'c' : ''}] Yes: ${patientImpairments}
[cb${formData.patientOther === 'No' ? 'c' : ''}][/cb${formData.patientOther === 'No' ? 'c' : ''}] No [/list]
[td][list=none][u]Genetic Predisposition[/u][br][/br]
[cb${formData.predisposition === 'Existing' ? 'c' : ''}][/cb${formData.predisposition === 'Existing' ? 'c' : ''}] Existing
[cb${formData.predisposition === 'NonExisting' ? 'c' : ''}][/cb${formData.predisposition === 'NonExisting' ? 'c' : ''}] Non-existing [/list]
[/td][/tr][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Evaluation Summary[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Assessment Statement: [/u][br][/br]
${patientSummary}
[br][/br][/left][/list][/table]

`;

        return bbCode;
    };
        // Base BBCode for ID 28 Physical Evaluation (Internal Medicine generatePhysEvalInternalMedPBC)

    const generatePhysEvalInternalMedPBC = () => {
        const {
            patientID,
            date,
            lastName,
            patientHeight,
            patientWeight,
            phmcRank,
            careerRisks,
            patientAllergies,
            patientMedicine,
            patientcareerNo,
            patientSummary,
            patientCareer,
            patientImpairments,
        } = formData;

        let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]PHYSICAL EXAMINATION[/b]

PATIENT ${patientID}

Date: ${date}
Signed: ${phmcRank} ${lastName}
[/center][td][center][img]https://i.imgur.com/LkRKav2.png[/img][/center][td][center][br][/br][br][/br][size=100][b]PALETO BAY CLINIC[/b]
PALETO BAY BLVD.
PO BOX 685
PALETO BAY, SAN ANDREAS
P: 50056[/size][/center][/table][/divbox]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Patient Measurements[/b][/color][/center][/divboxcolor]
[table][tr][td][list=none][br][/br]Height: ${patientHeight}
[br][/br]
Weight: ${patientWeight}
[/list][td]
[list=none][u]Body Mass Index: [/u][br][/br]
[cb${formData.BodyMassIndex === 'Underweight' ? 'c' : ''}][/cb${formData.BodyMassIndex === 'Underweight' ? 'c' : ''}] Underweight
[cb${formData.BodyMassIndex === 'Normal' ? 'c' : ''}][/cb] Normal
[cb${formData.BodyMassIndex === 'Overweight' ? 'c' : ''}][/cb] Overweight
[cb${formData.BodyMassIndex === 'Obese' ? 'c' : ''}][/cb] Obese
[cb${formData.BodyMassIndex === 'ExtremeObese' ? 'c' : ''}][/cb] Extremely Obese
[/table]
[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Vitals[/b][/color][/center][/divboxcolor]
[table][tr][td][center]Temperature: [cb${formData.vitals === 'patientTempNormal' ? 'c' : ''}] Normal [cb${formData.vitals === 'patientHypothermic' ? 'c' : ''}] Hypothermic [cb${formData.vitals === 'patientHyperthermic' ? 'c' : ''}] Hyperthermic[/center]
[td][center]Heart Rate: [cb${formData.heartRate === 'patientHeartRateNormal' ? 'c' : ''}] Normal [cb${formData.heartRate === 'patientHeartRateBradycardia' ? 'c' : ''}] Bradycardia [cb${formData.heartRate === 'patientHeartRateTachycardia' ? 'c' : ''}] Tachycardia[/center][/table]
[table][tr][td][center]Breathing: [cb${formData.breathing === 'patientBreathingNormal' ? 'c' : ''}] Normal [cb${formData.breathing === 'patientBreathingSlow' ? 'c' : ''}] Slow [cb${formData.breathing === 'patientBreathingFast' ? 'c' : ''}] Fast [cb${formData.breathing === 'patientBreathingObstructed' ? 'c' : ''}] Obstructed[/center]
[td][center]Blood Pressure: [cb${formData.bloodPressure === 'patientBloodPressureNormal' ? 'c' : ''}] Normal [cb${formData.bloodPressure === 'patientBloodPressureHypotension' ? 'c' : ''}] Hypotension [cb${formData.bloodPressure === 'patientBloodPressureHypertension' ? 'c' : ''}] Hypertension [/center][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Anamnesis[/b][/color][/center][/divboxcolor]
[table][tr][td][list=none][u]Does the patient have a job? [/u][br][/br]
[cb${formData.patientJob === 'Yes' ? 'c' : ''}][/cb${formData.patientJob === 'Yes' ? 'c' : ''}] Yes: ${patientCareer}
[cb${formData.patientJob === 'No' ? 'c' : ''}][/cb${formData.patientJob === 'No' ? 'c' : ''}] No: ${patientcareerNo} [/list]
[td][list=none][u]If yes, are harmful risk factors present? [/u][br][/br]
[cb${formData.patientJobRisks === 'Yes' ? 'c' : ''}][/cb${formData.patientJobRisks === 'Yes' ? 'c' : ''}] Yes: ${careerRisks}
[cb${formData.patientJobRisks === 'No' ? 'c' : ''}][/cb${formData.patientJobRisks === 'No' ? 'c' : ''}] No [/list]
[/td][/tr]
[tr][td][list=none][u]Are allergies or risks (implants, case of incompatibility, pacemaker, etc.) present?[/u][br][/br]
[cb${formData.patientAllergiesRisk === 'Yes' ? 'c' : ''}][/cb${formData.patientAllergiesRisk === 'Yes' ? 'c' : ''}] Yes: ${patientAllergies}
[cb${formData.patientAllergiesRisk === 'No' ? 'c' : ''}][/cb${formData.patientAllergiesRisk === 'No' ? 'c' : ''}] No [/list]
[td][list=none][u]Does the patient take medications on a regular basis? [/u][br][/br]
[cb${formData.patientMedicineRegular === 'Yes' ? 'c' : ''}][/cb${formData.patientMedicineRegular === 'Yes' ? 'c' : ''}] Yes: ${patientMedicine}
[cb${formData.patientMedicineRegular === 'No' ? 'c' : ''}][/cb${formData.patientMedicineRegular === 'No' ? 'c' : ''}] No[/list]
[/td][/tr]
[tr][td][list=none][u]Does the patient have other medical condition(s) or physical impairments?[/u][br][/br]
[cb${formData.patientOther === 'Yes' ? 'c' : ''}][/cb${formData.patientOther === 'Yes' ? 'c' : ''}] Yes: ${patientImpairments}
[cb${formData.patientOther === 'No' ? 'c' : ''}][/cb${formData.patientOther === 'No' ? 'c' : ''}] No [/list]
[td][list=none][u]Genetic Predisposition[/u][br][/br]
[cb${formData.predisposition === 'Existing' ? 'c' : ''}][/cb${formData.predisposition === 'Existing' ? 'c' : ''}] Existing
[cb${formData.predisposition === 'NonExisting' ? 'c' : ''}][/cb${formData.predisposition === 'NonExisting' ? 'c' : ''}] Non-existing [/list]
[/td][/tr][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Evaluation Summary[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Assessment Statement: [/u][br][/br]
${patientSummary}
[br][/br][/left][/list][/table]

`;

        return bbCode;
    };

    const generateObsMainFile = () => {
        const {
            phmcEmployee,
            patientName,
            patientMedicalRecord,
            patientJob,
            patientPartnerPH,
            patientDateofBirth,
            patientPartnerName,
            patientJobTasks,
            patientLivingHabits,
            patientPreHealth,
            patientBaggageofParents,
            patientTemperature,
            patientBP,
            patientWeight,
            patientSummaryConsultation,
            patientBPM,
            patientResperation,
            patientOxi,
            patientDateofPregnancy,
            patientFetalMeasurements,
            patientWellWomanExam,
            patientPapResults,
            patientSTI,
            patientSTIResults,
            patientHeight,
            patientBloodAnalysis,
            patientBloodAnalysisResults,
            patientUrine,
            patientUrineResults,
            date,
            patientPap,
            patientPartnerDiscord,
            phmcSignature,
            patientAdditionalPregnancy,
            patientPregProblems,
        } = formData;

        let bbCode = `[divbox=transparent] [center] [img]https://i.imgur.com/bUn7H8J.png[/img] [/center] [/divbox]
[divbox=lightgrey][size=150]

[center][b]DEPARTMENT OF OBSTETRICS AND GYNECOLOGY[/b][/center][/size]

[/divbox]

[divbox=lightgrey][b]SECTION 0: PERSONAL INFORMATION[/b][/divbox]
[divbox=transparent][table][tr][td][b]0.1[/b] Identifying
[/td][td]
[b]Medical Record Number:[/b] ${patientMedicalRecord}
[b]Full Name:[/b] ${patientName}
[b]Date of Birth:[/b] ${patientDateofBirth}
[tr][td][b]0.2[/b] Partner
[/td][td][b]Full Name:[/b] ${patientPartnerName}
[b]Telephone Number:[/b] ${patientPartnerPH}
[b]Email:[/b] ${patientPartnerDiscord}
[/td][/tr][tr][td][b]0.3[/b] Job
[/td][td][b]Employer:[/b] ${patientJob}
[b]Tasks:[/b] ${patientJobTasks}

[/table][/divbox]

[divbox=lightgrey][b]SECTION 1: HEALTH STORY[/b][/divbox]
[divbox=transparent][table]

[tr][td][b]1.1[/b] Pre-Pregnancy Health 
[i](Health problems, medications, allergies, surgical procedures, problems related to anesthesia, depression, etc.)[/i][/td][td]
${patientPreHealth}

[tr][td][b]1.2[/b] Previous Pregnancies
[i](If yes, specify if she has had miscarriages and/or abortions.)[/i][/td][td]
${patientAdditionalPregnancy} [/td][/tr]

[tr][td][b]1.3[/b] Hereditary Baggage Of Parents[/td][td]
${patientBaggageofParents}

[tr][td][b]1.4[/b] Previous Gynecological Problems[/td][td]
${patientPregProblems}[/td][/tr]

[tr][td][b]1.5[/b] Patient's Living Habits
[i](Diet, physical activity, smoking, alcohol and drugs.)[/i][/td][td]
${patientLivingHabits}

[/table][/divbox]

[divbox=lightgrey][b]SECTION 2: PATIENT MEASUREMENTS[/b][/divbox]
[divbox=transparent][table][tr][td][b]2.1[/b] Height[/td][td]
${patientHeight}

[tr][td][b]2.2[/b] Weight[/td][td]
${patientWeight}

[/table][/divbox]

[divbox=lightgrey][b]SECTION 3: VITALS[/b][/divbox]
[divbox=transparent][table][tr][td][b]3.1[/b] Body Temperature[/td][td]
${patientTemperature}

[tr][td][b]3.2[/b] Heart Rate[/td][td]
${patientBPM}

[tr][td][b]3.3[/b] Respiration Rate[/td][td]
${patientResperation}

[tr][td][b]3.4[/b] Pulse Oximetry[/td][td]
${patientOxi}

[tr][td][b]3.5[/b] Blood Pressure[/td][td]
${patientBP}

[/table][/divbox]

[divbox=lightgrey][b]SECTION 4: ABDOMINAL OR TRANSVAGINAL ULTRASONOGRAPHY[/b][/divbox]
[divbox=transparent][table][tr][td][b]4.1[/b] Dating Of Pregnancy[/td][td]
${patientDateofPregnancy}

[tr][td][b]4.2[/b] Identification Of Multiple Pregnancies[/td][td]
[cb${formData.oneFetus ? 'c' : ''}][/cb${formData.oneFetus ? 'c' : ''}] 1 Fetus
[cb${formData.twoFetuses ? 'c' : ''}][/cb${formData.twoFetuses ? 'c' : ''}] 2 Fetuses
[cb${formData.threeFetuses ? 'c' : ''}][/cb${formData.threeFetuses ? 'c' : ''}] 3 Fetuses
[cb${formData.fourFetuses ? 'c' : ''}][/cb${formData.fourFetuses ? 'c' : ''}] 4 Fetuses and more

[/td][/tr]

[tr][td][b]4.3[/b] Fetal Measurements[/td][td]
${patientFetalMeasurements}
[/td][/tr]

[/table][/divbox]

[divbox=lightgrey][b]SECTION 5: GYNECOLOGICAL AND BIOLOGICAL EXAMINATIONS[/divbox]
[divbox=transparent][table]

[tr][td][b]5.1[/b] Well-Woman Exam
[i](Free Annual Preventive Exam - Pap Smear, Pelvic Exam, Mammography, etc...)[/i][/td][td]
[cb][/cb] [b]Last Well-Woman Exam:[/b] ${patientWellWomanExam}
[/td][/tr]

[tr][td][b]5.2[/b] Pap Smear[/td][td]
${patientPap}
[b]Results:[/b] ${patientPapResults}
[/td][/tr]

[tr][td][b]5.3[/b] STI Screening[/td][td]
${patientSTI}
[b]Results:[/b] ${patientSTIResults}
[/td][/tr]

[tr][td][b]5.4[/b] Blood Analysis

[i]-Determination of blood type
-Toxoplasmosis serology
-Rubella serology
-HIV 1 and 2 serology
-Research of irregular agglutinins
-First screening for Down syndrome
- Gestational Diabetes[/i][/td][td]
${patientBloodAnalysis}
[b]Results:[/b] ${patientBloodAnalysisResults}
[/td][/tr]

[tr][td][b]5.5[/b] Urine Analysis

[i]-Glycosuria
-Proteinuria[/i][/td][td]
${patientUrine}
[b]Results:[/b] ${patientUrineResults}
[/td][/tr]

[/table][/divbox]

[divbox=lightgrey][b]SECTION 6: SUMMARY OF CONSULTATION[/b][/divbox]
[divbox=transparent][list=none]

${patientSummaryConsultation}

[/list][/divbox][divbox=lightgrey][b]SECTION 7: PERSON IN CHARGE OF THE CONSULTATION[/b][/divbox]

[divbox=transparent][table][tr][td][b]7.1[/b] Full Name (Signature)[/td][td]${formatSignature(phmcSignature)}
[tr][td][b]7.2[/b] Full Name (Print)[/td][td]${phmcEmployee}
[tr][td][b]7.3[/b] Date[/td][td]${date}[/table][/divbox]`;

        return bbCode;
    };

    const generateObsFollowUp = () => {
        const {
            phmcEmployee,
            patientName,
            patientMedicalRecord,
            patientContractions,
            patientBleeding,
            patientDateofBirth,
            patientDiscomfort,
            patientFatter,
            patientBabyGender,
            patientKnowBabyGender,
            patientTemperature,
            patientBP,
            patientWeight,
            patientSummaryConsultation,
            patientBPM,
            patientResperation,
            patientOxi,
            patientDateofPregnancy,
            patientFetalMeasurements,
            patientBloodAnalysis,
            patientBloodAnalysisResults,
            patientUrine,
            patientUrineResults,
            date,
            patientUltraSummary,
            phmcSignature,
        } = formData;

        let bbCode = `[divbox=transparent] [center] [img]https://i.imgur.com/bUn7H8J.png[/img] [/center] [/divbox]
[divbox=lightgrey][size=150]

[center][b]DEPARTMENT OF OBSTETRICS AND GYNECOLOGY[/b]
[color=#800000][b]OBSTETRIC FOLLOW-UP[/b][/color][/center][/size]

[/divbox]

[divbox=lightgrey][b]SECTION 0: PERSONAL INFORMATION[/b][/divbox]
[divbox=transparent][table][tr][td][b]0.1[/b] Identifying
[/td][td]
[b]Medical record number:[/b] ${patientMedicalRecord}
[b]Full name:[/b] ${patientName}
[b]Date Of Birth:[/b] ${patientDateofBirth}

[/table][/divbox]

[divbox=lightgrey][b]SECTION 1: PATIENT HEALTH STATUS[/b][/divbox]
[divbox=transparent][table]

[tr][td][b]1.1[/b] Pregnancy Length[/td][td]
${patientDateofPregnancy}

[tr][td][b]1.2[/b] Contractions[/td][td]
${patientContractions}
[/td][/tr]

[tr][td][b]1.3[/b] Discharge Or Bleeding[/td][td]
${patientBleeding}
[/td][/tr]

[tr][td][b]1.4[/b] Discomfort When Urinating[/td][td]
${patientDiscomfort}
[/td][/tr]

[tr][td][b]1.5[/b] Fetal Movements[/td][td]
${patientFetalMeasurements}
[/td][/tr]

[/table][/divbox]

[divbox=lightgrey][b]SECTION 2: PATIENT WEIGHT[/b][/divbox]
[divbox=transparent][table][tr][td][b]2.1[/b] Weight[/td][td]
${patientWeight}

[tr][td][b]2.2[/b] Weight Gained[/td][td]
${patientFatter}

[/table][/divbox]

[divbox=lightgrey][b]SECTION 3: VITALS[/b][/divbox]
[divbox=transparent][table][tr][td][b]3.1[/b] Body Temperature[/td][td]
${patientTemperature}

[tr][td][b]3.2[/b] Heart Rate[/td][td]
${patientBPM}

[tr][td][b]3.3[/b] Respiration Rate[/td][td]
${patientResperation}

[tr][td][b]3.4[/b] Pulse Oximetry[/td][td]
${patientOxi}

[tr][td][b]3.5[/b] Blood Pressure[/td][td]
${patientBP}

[/table][/divbox]

[divbox=lightgrey][b]SECTION 4: ABDOMINAL ULTRASONOGRAPHY[/b][/divbox]
[divbox=transparent][table]

[tr][td][b]4.1[/b] Gender[/td][td]
${patientBabyGender}
[/td][/tr]

[tr][td][b]4.2[/b] Parent Knows Baby's Gender[/td][td]
${patientKnowBabyGender}
[/td][/tr]

[tr][td][b]4.3[/b] Ultrasonography Summary[/td][td]
${patientUltraSummary}

[/table][/divbox]

[divbox=lightgrey][b]SECTION 5: BIOLOGICAL EXAMINATIONS[/divbox]
[divbox=transparent][table]

[tr][td][b]5.1[/b] Blood Analysis

[i]-Toxoplasmosis Serology (if negative)[/i][/td][td]
${patientBloodAnalysis}
[b]Results:[/b] ${patientBloodAnalysisResults}
[/td][/tr]

[tr][td][b]5.2[/b] Urine Analysis

[i]-Glycosuria
-Proteinuria[/i][/td][td]
${patientUrine}
[b]Results:[/b] ${patientUrineResults}
[/td][/tr]

[/table][/divbox]

[divbox=lightgrey][b]SECTION 6: SUMMARY OF CONSULTATION[/b][/divbox]
[divbox=transparent][list=none]

${patientSummaryConsultation}

[/list][/divbox][divbox=lightgrey][b]SECTION 7: PERSON IN CHARGE OF THE CONSULTATION[/b][/divbox]

[divbox=transparent][table][tr][td][b]7.1[/b] Full Name (Signature)[/td][td]${formatSignature(phmcSignature)}
[tr][td][b]7.2[/b] Full Name (Print)[/td][td]${phmcEmployee}
[tr][td][b]7.3[/b] Date[/td][td]${date}[/table][/divbox]`;

        return bbCode;
    };
    const generateGyneMainFile = () => {
        const {
            phmcEmployee,
            patientName,
            patientMedicalRecord,
            patientJob,
            patientPartnerPH,
            patientDateofBirth,
            patientPartnerName,
            patientJobTasks,
            patientLivingHabits,
            patientBaggageofParents,
            patientTemperature,
            patientBP,
            patientWeight,
            patientSummaryConsultation,
            patientBPM,
            patientResperation,
            patientOxi,
            patientNotes,
            patientWellWomanExam,
            patientPapResults,
            patientSTI,
            patientSTIResults,
            patientHeight,
            patientBloodAnalysis,
            patientBloodAnalysisResults,
            patientUrine,
            patientUrineResults,
            date,
            patientPap,
            patientPartnerDiscord,
            phmcSignature,
            patientAdditionalPregnancy,
            patientPregProblems,
        } = formData;

        let bbCode = `[divbox=transparent] [center] [img]https://i.imgur.com/bUn7H8J.png[/img] [/center] [/divbox]
[divbox=lightgrey][size=150]

[center][b]DEPARTMENT OF OBSTETRICS AND GYNECOLOGY[/b][/center][/size]

[/divbox]

[divbox=lightgrey][b]SECTION 0: PERSONAL INFORMATION[/b][/divbox]
[divbox=transparent][table][tr][td][b]0.1[/b] Identifying
[/td][td]
[b]Medical Record Number:[/b] ${patientMedicalRecord}
[b]Full Name:[/b] ${patientName}
[b]Date of Birth:[/b] ${patientDateofBirth}
[tr][td][b]0.2[/b] Partner
[/td][td][b]Full Name:[/b] ${patientPartnerName}
[b]Telephone Number:[/b] ${patientPartnerPH}
[b]Email:[/b] ${patientPartnerDiscord}
[/td][/tr][tr][td][b]0.3[/b] Job
[/td][td][b]Employer:[/b] ${patientJob}
[b]Tasks:[/b] ${patientJobTasks}

[/table][/divbox]

[divbox=lightgrey][b]SECTION 1: HEALTH STORY[/b][/divbox]
[divbox=transparent][table]

[tr][td][b]1.1[/b] Previous Gynecological Problems[/td][td]
${patientPregProblems}[/td][/tr]

[tr][td][b]1.2[/b] Previous Pregnancies
[i](If yes, specify if she has had miscarriages and/or abortions.)[/i][/td][td]
${patientAdditionalPregnancy} [/td][/tr]

[tr][td][b]1.3[/b] Hereditary Baggage Of Parents[/td][td]
${patientBaggageofParents}


[tr][td][b]1.5[/b] Patient's Living Habits
[i](Diet, physical activity, smoking, alcohol and drugs.)[/i][/td][td]
${patientLivingHabits}

[/table][/divbox]

[divbox=lightgrey][b]SECTION 2: PATIENT MEASUREMENTS[/b][/divbox]
[divbox=transparent][table][tr][td][b]2.1[/b] Height[/td][td]
${patientHeight}

[tr][td][b]2.2[/b] Weight[/td][td]
${patientWeight}

[/table][/divbox]

[divbox=lightgrey][b]SECTION 3: VITALS[/b][/divbox]
[divbox=transparent][table][tr][td][b]3.1[/b] Body Temperature[/td][td]
${patientTemperature}

[tr][td][b]3.2[/b] Heart Rate[/td][td]
${patientBPM}

[tr][td][b]3.3[/b] Respiration Rate[/td][td]
${patientResperation}

[tr][td][b]3.4[/b] Pulse Oximetry[/td][td]
${patientOxi}

[tr][td][b]3.5[/b] Blood Pressure[/td][td]
${patientBP}

[/table][/divbox]

[divbox=lightgrey][b]SECTION 5: GYNECOLOGICAL AND BIOLOGICAL EXAMINATIONS[/b][/divbox]
[divbox=transparent][table][tr][td][b]4.1[/b] Findings [/td][td]
${patientNotes}

[/table][/divbox]

[divbox=lightgrey][b]SECTION 5: GYNECOLOGICAL AND BIOLOGICAL EXAMINATIONS[/divbox]
[divbox=transparent][table]

[tr][td][b]5.1[/b] Well-Woman Exam
[i](Free Annual Preventive Exam - Pap Smear, Pelvic Exam, Mammography, etc...)[/i][/td][td]
[cb][/cb] [b]Last Well-Woman Exam:[/b] ${patientWellWomanExam}
[/td][/tr]

[tr][td][b]5.2[/b] Pap Smear[/td][td]
${patientPap}
[b]Results:[/b] ${patientPapResults}
[/td][/tr]

[tr][td][b]5.3[/b] STI Screening[/td][td]
${patientSTI}
[b]Results:[/b] ${patientSTIResults}
[/td][/tr]

[tr][td][b]5.4[/b] Blood Analysis

[i]-Determination of blood type
-Toxoplasmosis serology
-Rubella serology
-HIV 1 and 2 serology
-Research of irregular agglutinins
-First screening for Down syndrome
- Gestational Diabetes[/i][/td][td]
${patientBloodAnalysis}
[b]Results:[/b] ${patientBloodAnalysisResults}
[/td][/tr]

[tr][td][b]5.5[/b] Urine Analysis

[i]-Glycosuria
-Proteinuria[/i][/td][td]
${patientUrine}
[b]Results:[/b] ${patientUrineResults}
[/td][/tr]

[/table][/divbox]

[divbox=lightgrey][b]SECTION 6: SUMMARY OF CONSULTATION[/b][/divbox]
[divbox=transparent][list=none]

${patientSummaryConsultation}

[/list][/divbox][divbox=lightgrey][b]SECTION 7: PERSON IN CHARGE OF THE CONSULTATION[/b][/divbox]

[divbox=transparent][table][tr][td][b]7.1[/b] Full Name (Signature)[/td][td]${formatSignature(phmcSignature)}
[tr][td][b]7.2[/b] Full Name (Print)[/td][td]${phmcEmployee}
[tr][td][b]7.3[/b] Date[/td][td]${date}[/table][/divbox]`;

        return bbCode;
    };
    const generateGyneFollowUp = () => {
        const {
            phmcEmployee,
            patientName,
            patientMedicalRecord,
            patientBleeding,
            patientDateofBirth,
            patientDiscomfort,
            patientFatter,
            patientTemperature,
            patientBP,
            patientWeight,
            patientSummaryConsultation,
            patientBPM,
            patientResperation,
            patientOxi,
            patientBloodAnalysis,
            patientBloodAnalysisResults,
            patientUrine,
            patientUrineResults,
            date,
            patientUltraSummary,
            phmcSignature,
        } = formData;

        let bbCode = `[divbox=transparent] [center] [img]https://i.imgur.com/bUn7H8J.png[/img] [/center] [/divbox]
[divbox=lightgrey][size=150]

[center][b]DEPARTMENT OF OBSTETRICS AND GYNECOLOGY[/b]
[color=#800000][b]OBSTETRIC FOLLOW-UP[/b][/color][/center][/size]

[/divbox]

[divbox=lightgrey][b]SECTION 0: PERSONAL INFORMATION[/b][/divbox]
[divbox=transparent][table][tr][td][b]0.1[/b] Identifying
[/td][td]
[b]Medical record number:[/b] ${patientMedicalRecord}
[b]Full name:[/b] ${patientName}
[b]Date Of Birth:[/b] ${patientDateofBirth}

[/table][/divbox]

[divbox=lightgrey][b]SECTION 1: PATIENT HEALTH STATUS[/b][/divbox]
[divbox=transparent][table]


[tr][td][b]1.1[/b] Discharge Or Bleeding[/td][td]
${patientBleeding}
[/td][/tr]

[tr][td][b]1.2[/b] Discomfort When Urinating[/td][td]
${patientDiscomfort}
[/td][/tr]

[/td][/tr]

[/table][/divbox]

[divbox=lightgrey][b]SECTION 2: PATIENT WEIGHT[/b][/divbox]
[divbox=transparent][table][tr][td][b]2.1[/b] Weight[/td][td]
${patientWeight}

[tr][td][b]2.2[/b] Weight Gained[/td][td]
${patientFatter}

[/table][/divbox]

[divbox=lightgrey][b]SECTION 3: VITALS[/b][/divbox]
[divbox=transparent][table][tr][td][b]3.1[/b] Body Temperature[/td][td]
${patientTemperature}

[tr][td][b]3.2[/b] Heart Rate[/td][td]
${patientBPM}

[tr][td][b]3.3[/b] Respiration Rate[/td][td]
${patientResperation}

[tr][td][b]3.4[/b] Pulse Oximetry[/td][td]
${patientOxi}

[tr][td][b]3.5[/b] Blood Pressure[/td][td]
${patientBP}

[/table][/divbox]

[divbox=lightgrey][b]SECTION 4: ABDOMINAL ULTRASONOGRAPHY[/b][/divbox]
[divbox=transparent][table]

[tr][td][b]4.3[/b] Ultrasonography Summary[/td][td]
${patientUltraSummary}

[/table][/divbox]

[divbox=lightgrey][b]SECTION 5: BIOLOGICAL EXAMINATIONS[/divbox]
[divbox=transparent][table]

[tr][td][b]5.1[/b] Blood Analysis

[i]-Toxoplasmosis Serology (if negative)[/i][/td][td]
${patientBloodAnalysis}
[b]Results:[/b] ${patientBloodAnalysisResults}
[/td][/tr]

[tr][td][b]5.2[/b] Urine Analysis

[i]-Glycosuria
-Proteinuria[/i][/td][td]
${patientUrine}
[b]Results:[/b] ${patientUrineResults}
[/td][/tr]

[/table][/divbox]

[divbox=lightgrey][b]SECTION 6: SUMMARY OF CONSULTATION[/b][/divbox]
[divbox=transparent][list=none]

${patientSummaryConsultation}

[/list][/divbox][divbox=lightgrey][b]SECTION 7: PERSON IN CHARGE OF THE CONSULTATION[/b][/divbox]

[divbox=transparent][table][tr][td][b]7.1[/b] Full Name (Signature)[/td][td]${formatSignature(phmcSignature)}
[tr][td][b]7.2[/b] Full Name (Print)[/td][td]${phmcEmployee}
[tr][td][b]7.3[/b] Date[/td][td]${date}[/table][/divbox]`;

        return bbCode;
    };
    const generateMentalHealthPHMC = () => {
        const {
            lastName,
            patientID,
            date,
            patientChiefComplaint,
            rank,
            patientNotes, 
            patientDiagnosis,
            patientMedicine,
            patientProcedure,
        } = formData;

        let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]Session Notes[/b]

PATIENT ${patientID}

Date: ${date}
Signed: ${rank} ${lastName}
[/center][td][center][img]https://i.imgur.com/QMaz0OC.png[/img][/center][td][center][br][/br][br][/br][size=100][b]PILLBOX HILL MEDICAL CENTER[/b]
ELGIN AVE. / STRAWBERRY AVE.
PO BOX 742
LOS SANTOS, SAN ANDREAS
P: 50056[/size][/center][/table][/divbox]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Anamnesis[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Chief Complaint: [/u][br][/br]
${patientChiefComplaint}
[br][/br]
[u]Assigned Department: [/u][br][/br]
[cbc] Mental Health
[br][/br][/left]
[/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Findings[/b][/color][/center][/divboxcolor]
[table][tr][td][list=none]Notes: ${patientNotes}[/list][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Discharge Diagnosis[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Primary Diagnosis: [/u][br][/br]
${patientDiagnosis}[/list][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Therapy[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Admission: [/u][br][/br]
[cb${formData.admission === 'Yes' ? 'c' : ''}] Yes
[cb${formData.admission === 'No' ? 'c' : ''}] No
[br][/br]
[u]Procedure: [/u][br][/br]
${patientProcedure}
[br][/br]
[u]Medication: [/u][br][/br]
${patientMedicine}
[br][/br]
[u]Follow-Up: [/u][br][/br]
[cb${formData.followup === 'AsNeeded' ? 'c' : ''}] As needed
[cb${formData.followup === 'Recommended' ? 'c' : ''}] Recommended
[cb${formData.followup === 'ElectiveProcedure' ? 'c' : ''}] Elective procedure 
[/left][/list][/table]
`;

        return bbCode;
    };


    const generateMentalHealthPBC = () => {
        const {
            lastName,
            patientID,
            rank,
            date,
            patientChiefComplaint,
            patientNotes, 
            patientDiagnosis,
            patientMedicine,
            patientProcedure,
        } = formData;

        let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]Session Notes[/b]

PATIENT ${patientID}

Date: ${date}
Signed: ${rank} ${lastName}
[/center][td][center][img]https://i.imgur.com/LkRKav2.png[/img][/center][td][center][br][/br][br][/br][size=100][b]PALETO BAY CLINIC[/b]
PALETO BAY BLVD.
PO BOX 685
PALETO BAY, SAN ANDREAS
P: 50056[/size][/center][/table][/divbox]
[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Anamnesis[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Chief Complaint: [/u][br][/br]
${patientChiefComplaint}
[br][/br]
[u]Assigned Department: [/u][br][/br]
[cbc] Mental Health
[br][/br][/left]
[/table]
[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Findings[/b][/color][/center][/divboxcolor]
[table][tr][td][list=none]Notes: ${patientNotes}[/list][/table]
[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Discharge Diagnosis[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Primary Diagnosis: [/u][br][/br]
${patientDiagnosis}[/list][/table]
[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Therapy[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Admission: [/u][br][/br]
[cb${formData.admission === 'Yes' ? 'c' : ''}] Yes
[cb${formData.admission === 'No' ? 'c' : ''}] No
[br][/br]
[u]Procedure: [/u][br][/br]
${patientProcedure}
[br][/br]
[u]Medication: [/u][br][/br]
${patientMedicine}
[br][/br]
[u]Follow-Up: [/u][br][/br]
[cb${formData.followup === 'AsNeeded' ? 'c' : ''}] As needed
[cb${formData.followup === 'Recommended' ? 'c' : ''}] Recommended
[cb${formData.followup === 'ElectiveProcedure' ? 'c' : ''}] Elective procedure 
[/left][/list][/table]
`;

        return bbCode;
    };
    const generateAgencyFeedback = () => {
        const {
            coronerRank,
            coronerEmployee,
            placeOfDeath,
            department,
            dateTime,
            decedentName,
            synopsis,
            scenePhotos,
        } = formData;

        const scenePhotosBBCode = scenePhotos.split(',').map(photo => `[img]${photo.trim()}[/img]`).join('\n');

        let bbCode = `[divbox=transparent][center][img]https://i.imgur.com/Hxjt4M2.png[/img] [/center]
[hr][/hr][color=#5597D0][right]
[U][SIZE=80][/SIZE][/U][/RIGHT][/COLOR]
[CENTER][B]DEPARTMENT OF PATHOLOGY AND FORENSIC MEDICINE 
AGENCY INCIDENT REPORT[/B][/CENTER]
[HR][/HR]
[b]EMPLOYEE DETAILS[/b]
[divbox=transparent][b]Name:[/b] ${coronerEmployee}
[HR][/HR]
[b]RANK:[/b] ${coronerRank}
[/DIVBOX]
[b]DESCRIPTION OF INCIDENT[/b]
[divbox=transparent][b]DATE OF INCIDENT:[/b] ${dateTime}
[HR][/HR]
[b]LOCATION OF INCIDENT:[/b] ${placeOfDeath}
[HR][/HR]
[b]INCIDENT DETAILS[/b]
[i][color=#0080FF](How the incident happened, factors leading to the event, and what took place. Be as specific as possible.)[/color][/i][DIVBOX=transparent] ${synopsis}[/DIVBOX]
[HR][/HR]
[b]DEPARTMENT INVOLVED[/B]
${department}
[b]NAME / ROLE / CONTACT OF PARTIES INVOLVED[/b]
${decedentName}
[HR][/HR]
[/DIVBOX]
[b]PHOTO OF INCIDENT (IF POSSIBLE)[/b]
[divbox=transparent] ${scenePhotosBBCode}`

        return bbCode;
    };
    const generateEmergencyProtocol = () => {
        const {
            lastName,
            phmcRank,
            patientID,
            date,
            patientDiagnosis,
            patientSecondaryDiagnosis,
            patientMedicine,
            patientProcedure,
            patientChiefComplaint,
        } = formData;

        let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]EMERGENCY PROTOCOL[/b]

PATIENT ID: ${patientID}

Date: ${date}

Signed: ${phmcRank} ${lastName}
[/center][td][center][img]https://i.imgur.com/QMaz0OC.png[/img][/center][td][center][br][/br][br][/br][size=100][b]PILLBOX HILL MEDICAL CENTER[/b]
ELGIN AVE. / STRAWBERRY AVE.
PO BOX 742
LOS SANTOS, SAN ANDREAS
P: 50056[/size][/center][/table][/divbox]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Anamnesis[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Chief Complaint: [/u][br][/br]
${patientChiefComplaint}
[br][/br]
[u]Pain Level/Emergency Severity Index (ESI): [/u][br][/br]
[cb${formData.painLevel === 'patientNoPain' ? 'c' : ''}] [color=#0040FF]Level 5: no pain/non-urgent[/color] [cb${formData.painLevel === 'patientNormalPain' ? 'c' : ''}] [color=#00BF00]Level 4: normal pain/less urgent[/color] [cb${formData.painLevel === 'patientMildPain' ? 'c' : ''}] [color=#FFFF00]Level 3: mild pain/urgent[/color] [cb${formData.painLevel === 'patientSeverePain' ? 'c' : ''}] [color=#FF8040]Level 2: Severe pain/very urgent [/color][cb${formData.painLevel === 'patientCritical' ? 'c' : ''}] [color=#FF0000]Level 1: Critical/Emergent [/color][/left]
[/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Vitals[/b][/color][/center][/divboxcolor]
[table][tr][td][center]Temperature: [cb${formData.vitals === 'patientTempNormal' ? 'c' : ''}] Normal [cb${formData.vitals === 'patientHypothermic' ? 'c' : ''}] Hypothermic [cb${formData.vitals === 'patientHyperthermic' ? 'c' : ''}] Hyperthermic[/center]
[td][center]Heart Rate: [cb${formData.heartRate === 'patientHeartRateNormal' ? 'c' : ''}] Normal [cb${formData.heartRate === 'patientHeartRateBradycardia' ? 'c' : ''}] Bradycardia [cb${formData.heartRate === 'patientHeartRateTachycardia' ? 'c' : ''}] Tachycardia[/center][/table]
[table][tr][td][center]Breathing: [cb${formData.breathing === 'patientBreathingNormal' ? 'c' : ''}] Normal [cb${formData.breathing === 'patientBreathingSlow' ? 'c' : ''}] Slow [cb${formData.breathing === 'patientBreathingFast' ? 'c' : ''}] Fast [cb${formData.breathing === 'patientBreathingObstructed' ? 'c' : ''}] Obstructed[/center]
[td][center]Blood Pressure: [cb${formData.bloodPressure === 'patientBloodPressureNormal' ? 'c' : ''}] Normal [cb${formData.bloodPressure === 'patientBloodPressureHypotension' ? 'c' : ''}] Hypotension [cb${formData.bloodPressure === 'patientBloodPressureHypertension' ? 'c' : ''}] Hypertension [/center][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Findings[/b][/color][/center][/divboxcolor]
[table][tr][td][center]General Health Condition (GHC): [cb${formData.findings === 'patientNormal' ? 'c' : ''}] Normal [cb${formData.findings === 'patientImpared' ? 'c' : ''}] Impaired[/center]
[td][center]Lungs (Auscultation): [cb${formData.lungs === 'patientNormal' ? 'c' : ''}] Normal [cb${formData.findings === 'patientRhonchi' ? 'c' : ''}] Rhonchi [cb${formData.findings === 'patientCrack' ? 'c' : ''}] Crackles [/center][/table]
[table][tr][td][center]Pupils: [cb${formData.pupils === 'patientPupilsNormal' ? 'c' : ''}] Normal [cb${formData.pupils === 'patientPupilsAbnormal' ? 'c' : ''}] Abnormal [/center]
[td][center]Wounds: [cb${formData.wounds === 'patientFractures' ? 'c' : ''}] Fracture(s) [cb${formData.wounds === 'patientBleeding' ? 'c' : ''}] Bleeding [cb${formData.wounds === 'patientHematoma' ? 'c' : ''}] Hematoma [cb${formData.wounds === 'patientNoWounds' ? 'c' : ''}] None [/center][/table]
[table][tr][td][center]ECG: [cb${formData.ecg === 'patientSinusRhythm' ? 'c' : ''}] Sinus rhythm [cb${formData.ecg === 'patientArrhythmia' ? 'c' : ''}] Arrhythmia [cb${formData.ecg === 'patientInfaction' ? 'c' : ''}] Infarct [/center]
[td][center]Sono: [cb${formData.sono === 'patientNormal' ? 'c' : ''}] Normal [cb${formData.sono === 'patientFluids' ? 'c' : ''}] Fluids [cb${formData.sono === 'patientTissue' ? 'c' : ''}] Tissue Change[/center][/table]
[table][tr][td][center]Lab: [cb${formData.lab.includes('WNL') ? 'c' : ''}] WNL  [cb${formData.lab.includes('Anemia') ? 'c' : ''}] Anemia [cb${formData.lab.includes('Inflammation/Infection') ? 'c' : ''}] Inflammation/Infection [cb${formData.lab.includes('Dysfunction') ? 'c' : ''}] Dysfunction/Disorder [cb${formData.lab.includes('ElectrolyteImbalance') ? 'c' : ''}] Electrolyte Imbalance [cb${formData.lab.includes('Infarct') ? 'c' : ''}] Infarct/Embolism [cb${formData.lab.includes('Tumor') ? 'c' : ''}] Tumor [/center][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Preliminary Diagnosis[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Primary Diagnosis: [/u][br][/br]
${patientDiagnosis}
[br][/br][u]Secondary Diagnosis: [/u][br][/br]
${patientSecondaryDiagnosis}[/left][/list][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Therapy[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Admission: [/u][br][/br]
[cb${formData.admission === 'Yes' ? 'c' : ''}] Yes
[cb${formData.admission === 'No' ? 'c' : ''}] No
[br][/br]
[u]Procedure/Free Text: [/u][br][/br]
${patientProcedure}
[br][/br]
[u]Medication: [/u][br][/br]
${patientMedicine}
[/left][/list][/table]`
        return bbCode;
    };
    const generateConsultationNotesPHMC = () => {
        const {
            lastName,
            phmcRank,
            patientID,
            date,
            patientDiagnosis,
            patientSecondaryDiagnosis,
            patientMedicine,
            patientProcedure,
            patientChiefComplaint,
        } = formData;

        let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]Consultation Notes[/b]

PATIENT ID: ${patientID}

Date: ${date}

Signed: ${phmcRank} ${lastName}
[/center][td][center][img]https://i.imgur.com/QMaz0OC.png[/img][/center][td][center][br][/br][br][/br][size=100][b]PILLBOX HILL MEDICAL CENTER[/b]
ELGIN AVE. / STRAWBERRY AVE.
PO BOX 742
LOS SANTOS, SAN ANDREAS
P: 50056[/size][/center][/table][/divbox]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Anamnesis[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Reason for Visit: [/u][br][/br]
${patientChiefComplaint}
[br][/br]
[u]Assigned Department: [/u][br][/br]
[cb${formData.assignedDepartment === 'InternalMedicine' ? 'c' : ''}] Internal Medicine 
[cb${formData.assignedDepartment === 'SurgicalDepartment' ? 'c' : ''}] Surgical Department
[cb${formData.assignedDepartment === 'Widwifery' ? 'c' : ''}] Midwifery
[cb${formData.assignedDepartment === 'Dialysis' ? 'c' : ''}] Dialysis
[/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Vitals[/b][/color][/center][/divboxcolor]
[table][tr][td][center]Temperature: [cb${formData.vitals === 'patientTempNormal' ? 'c' : ''}] Normal [cb${formData.vitals === 'patientHypothermic' ? 'c' : ''}] Hypothermic [cb${formData.vitals === 'patientHyperthermic' ? 'c' : ''}] Hyperthermic[/center]
[td][center]Heart Rate: [cb${formData.heartRate === 'patientHeartRateNormal' ? 'c' : ''}] Normal [cb${formData.heartRate === 'patientHeartRateBradycardia' ? 'c' : ''}] Bradycardia [cb${formData.heartRate === 'patientHeartRateTachycardia' ? 'c' : ''}] Tachycardia[/center][/table]
[table][tr][td][center]Breathing: [cb${formData.breathing === 'patientBreathingNormal' ? 'c' : ''}] Normal [cb${formData.breathing === 'patientBreathingSlow' ? 'c' : ''}] Slow [cb${formData.breathing === 'patientBreathingFast' ? 'c' : ''}] Fast [cb${formData.breathing === 'patientBreathingObstructed' ? 'c' : ''}] Obstructed[/center]
[td][center]Blood Pressure: [cb${formData.bloodPressure === 'patientBloodPressureNormal' ? 'c' : ''}] Normal [cb${formData.bloodPressure === 'patientBloodPressureHypotension' ? 'c' : ''}] Hypotension [cb${formData.bloodPressure === 'patientBloodPressureHypertension' ? 'c' : ''}] Hypertension [/center][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Findings[/b][/color][/center][/divboxcolor]
[table][tr][td][center]General Health Condition (GHC): [cb${formData.findings === 'patientNormal' ? 'c' : ''}] Normal [cb${formData.findings === 'patientImpared' ? 'c' : ''}] Impaired[/center]
[td][center]Lungs (Auscultation): [cb${formData.lungs === 'patientNormal' ? 'c' : ''}] Normal [cb${formData.findings === 'patientRhonchi' ? 'c' : ''}] Rhonchi [cb${formData.findings === 'patientCrack' ? 'c' : ''}] Crackles [/center][/table]
[table][tr][td][center]Pupils: [cb${formData.pupils === 'patientPupilsNormal' ? 'c' : ''}] Normal [cb${formData.pupils === 'patientPupilsAbnormal' ? 'c' : ''}] Abnormal [/center]
[td][center]Wounds: [cb${formData.wounds === 'patientFractures' ? 'c' : ''}] Fracture(s) [cb${formData.wounds === 'patientBleeding' ? 'c' : ''}] Bleeding [cb${formData.wounds === 'patientHematoma' ? 'c' : ''}] Hematoma [cb${formData.wounds === 'patientNoWounds' ? 'c' : ''}] None [/center][/table]
[table][tr][td][center]ECG: [cb${formData.ecg === 'patientSinusRhythm' ? 'c' : ''}] Sinus rhythm [cb${formData.ecg === 'patientArrhythmia' ? 'c' : ''}] Arrhythmia [cb${formData.ecg === 'patientInfaction' ? 'c' : ''}] Infarct [/center]
[td][center]Sono: [cb${formData.sono === 'patientNormal' ? 'c' : ''}] Normal [cb${formData.sono === 'patientFluids' ? 'c' : ''}] Fluids [cb${formData.sono === 'patientTissue' ? 'c' : ''}] Tissue Change[/center][/table]
[table][tr][td][center]Lab: [cb${formData.lab.includes('WNL') ? 'c' : ''}] WNL  [cb${formData.lab.includes('Anemia') ? 'c' : ''}] Anemia [cb${formData.lab.includes('Inflammation/Infection') ? 'c' : ''}] Inflammation/Infection [cb${formData.lab.includes('Dysfunction') ? 'c' : ''}] Dysfunction/Disorder [cb${formData.lab.includes('ElectrolyteImbalance') ? 'c' : ''}] Electrolyte Imbalance [cb${formData.lab.includes('Infarct') ? 'c' : ''}] Infarct/Embolism [cb${formData.lab.includes('Tumor') ? 'c' : ''}] Tumor [/center][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Preliminary Diagnosis[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Primary Diagnosis: [/u][br][/br]
${patientDiagnosis}
[br][/br][u]Secondary Diagnosis: [/u][br][/br]
${patientSecondaryDiagnosis}[/left][/list][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Therapy[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Admission: [/u][br][/br]
[cb${formData.admission === 'Yes' ? 'c' : ''}] Yes
[cb${formData.admission === 'No' ? 'c' : ''}] No
[br][/br]
[u]Treatment plan/Free Text: [/u][br][/br]
${patientProcedure}
[br][/br]
[u]Medication: [/u][br][/br]
${patientMedicine}
[br][/br]
[u]Follow-Up: [/u][br][/br]
[cb${formData.followup === 'AsNeeded' ? 'c' : ''}] As needed
[cb${formData.followup === 'Recommended' ? 'c' : ''}] Recommended
[cb${formData.followup === 'ElectiveProcedure' ? 'c' : ''}] Elective procedure 
[/left][/list][/table]`
        return bbCode;
        };
        const generateConsultationNotesPBC = () => {
            const {
                lastName,
                phmcRank,
                patientID,
                date,
                patientDiagnosis,
                patientSecondaryDiagnosis,
                patientMedicine,
                patientProcedure,
                patientChiefComplaint,
                patientNotes,
            } = formData;
    
            let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]Consultation Notes[/b]
    
PATIENT ID: ${patientID}

Date: ${date}

Signed: ${phmcRank} ${lastName}
[/center][td][center][img]https://i.imgur.com/LkRKav2.png[/img][/center][td][center][br][/br][br][/br][size=100][b]PALETO BAY CLINIC[/b]
PALETO BAY BLVD.
PO BOX 685
PALETO BAY, SAN ANDREAS
P: 50056[/size][/center][/table][/divbox]
[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Anamnesis[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Reason for Visit: [/u][br][/br]
${patientChiefComplaint}
[br][/br]
[u]Assigned Department: [/u][br][/br]
[cb${formData.paletoClinicDepartment === 'InternalMedicine' ? 'c' : ''}] Internal Medicine 
[cb${formData.paletoClinicDepartment === 'SurgicalDepartment' ? 'c' : ''}] Surgical Department
[/table]
[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Vitals[/b][/color][/center][/divboxcolor]
[table][tr][td][center]Temperature: [cb${formData.vitals === 'patientTempNormal' ? 'c' : ''}] Normal [cb${formData.vitals === 'patientHypothermic' ? 'c' : ''}] Hypothermic [cb${formData.vitals === 'patientHyperthermic' ? 'c' : ''}] Hyperthermic[/center]
[td][center]Heart Rate: [cb${formData.heartRate === 'patientHeartRateNormal' ? 'c' : ''}] Normal [cb${formData.heartRate === 'patientHeartRateBradycardia' ? 'c' : ''}] Bradycardia [cb${formData.heartRate === 'patientHeartRateTachycardia' ? 'c' : ''}] Tachycardia[/center][/table]
[table][tr][td][center]Breathing: [cb${formData.breathing === 'patientBreathingNormal' ? 'c' : ''}] Normal [cb${formData.breathing === 'patientBreathingSlow' ? 'c' : ''}] Slow [cb${formData.breathing === 'patientBreathingFast' ? 'c' : ''}] Fast [cb${formData.breathing === 'patientBreathingObstructed' ? 'c' : ''}] Obstructed[/center]
[td][center]Blood Pressure: [cb${formData.bloodPressure === 'patientBloodPressureNormal' ? 'c' : ''}] Normal [cb${formData.bloodPressure === 'patientBloodPressureHypotension' ? 'c' : ''}] Hypotension [cb${formData.bloodPressure === 'patientBloodPressureHypertension' ? 'c' : ''}] Hypertension [/center][/table]
[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Findings[/b][/color][/center][/divboxcolor]
[table][tr][td][center]General Health Condition (GHC): [cb${formData.findings === 'patientNormal' ? 'c' : ''}] Normal [cb${formData.findings === 'patientImpared' ? 'c' : ''}] Impaired[/center]
[td][center]Lungs (Auscultation): [cb${formData.lungs === 'patientNormal' ? 'c' : ''}] Normal [cb${formData.findings === 'patientRhonchi' ? 'c' : ''}] Rhonchi [cb${formData.findings === 'patientCrack' ? 'c' : ''}] Crackles [/center][/table]
[table][tr][td][center]Pupils: [cb${formData.pupils === 'patientPupilsNormal' ? 'c' : ''}] Normal [cb${formData.pupils === 'patientPupilsAbnormal' ? 'c' : ''}] Abnormal [/center]
[td][center]Wounds: [cb${formData.wounds === 'patientFractures' ? 'c' : ''}] Fracture(s) [cb${formData.wounds === 'patientBleeding' ? 'c' : ''}] Bleeding [cb${formData.wounds === 'patientHematoma' ? 'c' : ''}] Hematoma [cb${formData.wounds === 'patientNoWounds' ? 'c' : ''}] None [/center][/table]
[table][tr][td][center]ECG: [cb${formData.ecg === 'patientSinusRhythm' ? 'c' : ''}] Sinus rhythm [cb${formData.ecg === 'patientArrhythmia' ? 'c' : ''}] Arrhythmia [cb${formData.ecg === 'patientInfaction' ? 'c' : ''}] Infarct [/center]
[td][center]Sono: [cb${formData.sono === 'patientNormal' ? 'c' : ''}] Normal [cb${formData.sono === 'patientFluids' ? 'c' : ''}] Fluids [cb${formData.sono === 'patientTissue' ? 'c' : ''}] Tissue Change[/center][/table]
[table][tr][td][center]Lab: [cb${formData.lab.includes('WNL') ? 'c' : ''}] WNL  [cb${formData.lab.includes('Anemia') ? 'c' : ''}] Anemia [cb${formData.lab.includes('Inflammation/Infection') ? 'c' : ''}] Inflammation/Infection [cb${formData.lab.includes('Dysfunction') ? 'c' : ''}] Dysfunction/Disorder [cb${formData.lab.includes('ElectrolyteImbalance') ? 'c' : ''}] Electrolyte Imbalance [cb${formData.lab.includes('Infarct') ? 'c' : ''}] Infarct/Embolism [cb${formData.lab.includes('Tumor') ? 'c' : ''}] Tumor [/center][/table]
[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Discharge Diagnosis[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Primary Diagnosis: [/u][br][/br]
${patientDiagnosis}
[br][/br][u]Secondary Diagnosis: [/u][br][/br]
${patientSecondaryDiagnosis}[/left][/list][/table]
[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Therapy[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Admission: [/u][br][/br]
[cb${formData.admission === 'Yes' ? 'c' : ''}] Yes
[cb${formData.admission === 'No' ? 'c' : ''}] No
[br][/br]
[u]Treatment plan/Free Text: [/u][br][/br]
${patientProcedure}
[br][/br]
[u]Additional Notes: [/u][br][/br]
${patientNotes}
[br][/br]
[u]Medication: [/u][br][/br]
${patientMedicine}
[br][/br]
[u]Follow-Up: [/u][br][/br]
[cb${formData.followup === 'AsNeeded' ? 'c' : ''}] As needed
[cb${formData.followup === 'Recommended' ? 'c' : ''}] Recommended
[cb${formData.followup === 'ElectiveProcedure' ? 'c' : ''}] Elective procedure 
[/left][/list][/table]`
            return bbCode;
            };
            const generateCommentaryNotePHMC = () => {
                const {
                    phmcEmployee,
                    date,
                    patientID,
                } = formData;
        
                let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]Session Notes[/b]

PATIENT ID: ${patientID}

Date: ${date}

[/center][td][center][img]https://i.imgur.com/QMaz0OC.png[/img][/center][td][center][br][/br][br][/br][size=100][b]PILLBOX HILL MEDICAL CENTER[/b]
ELGIN AVE. / STRAWBERRY AVE.
PO BOX 742
LOS SANTOS, SAN ANDREAS
P: 50056[/size][/center][/table][/divbox]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Commentary Note[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Firstname Lastname: [/u][br][/br]
${phmcEmployee}
[br][/br]
[u]Department: [/u][br][/br]
[cb${formData.departmentLarge === 'EmergencyMedicine' ? 'c' : ''}] Emergency Medicine
[cb${formData.departmentLarge === 'InternalMedicine' ? 'c' : ''}] Internal Medicine
[cb${formData.departmentLarge === 'Surgical' ? 'c' : ''}] Surgical Department
[cb${formData.departmentLarge === 'Midwifery' ? 'c' : ''}] Midwifery
[cb${formData.departmentLarge === 'PhysicalTherapy' ? 'c' : ''}] Physical Therapy
[cb${formData.departmentLarge === 'Dentistry' ? 'c' : ''}] Dentistry
[cb${formData.departmentLarge === 'MentalHealth' ? 'c' : ''}] Mental Health
[cb${formData.departmentLarge === 'Administration' ? 'c' : ''}] Administration
[br][/br][/left]
[/table]
`
                return bbCode;
                };
                const generateCommentaryNotePBC = () => {
                    const {
                        phmcEmployee,
                        date,
                        patientID,
                    } = formData;
            
                    let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]Session Notes[/b]
    
PATIENT ID: ${patientID}

Date: ${date}

[/center][td][center][img]https://i.imgur.com/LkRKav2.png[/img][/center][td][center][br][/br][br][/br][size=100][b]PALETO BAY CLINIC[/b]
PALETO BAY BLVD.
PO BOX 685
PALETO BAY, SAN ANDREAS
P: 50056[/size][/center][/table][/divbox]
[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Commentary Note[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Firstname Lastname: [/u][br][/br]
${phmcEmployee}
[br][/br]
[u]Department: [/u][br][/br]
[cb${formData.departmentLarge === 'EmergencyMedicine' ? 'c' : ''}] Emergency Medicine
[cb${formData.departmentLarge === 'InternalMedicine' ? 'c' : ''}] Internal Medicine
[cb${formData.departmentLarge === 'Surgical' ? 'c' : ''}] Surgical Department
[cb${formData.departmentLarge === 'Midwifery' ? 'c' : ''}] Midwifery
[cb${formData.departmentLarge === 'PhysicalTherapy' ? 'c' : ''}] Physical Therapy
[cb${formData.departmentLarge === 'Dentistry' ? 'c' : ''}] Dentistry
[cb${formData.departmentLarge === 'MentalHealth' ? 'c' : ''}] Mental Health
[cb${formData.departmentLarge === 'Administration' ? 'c' : ''}] Administration
[br][/br][/left]
[/table]
    `
                    return bbCode;
                    };

                    const generateMedicalRecordRelease = () => {
                        const {
                            patientFirstName,
                            patientMiddleName,
                            patientLastName,
                            patientPH,
                            patientDateOfBirth,
                            patientAddress,
                            patientZIP,
                            patientEmail,
                            patientMedInfoReleaseOther,
                            phmcEmployee,
                            MedicalRecordsReleaseOther,
                            patientMedInfoFormatOther,
                            StupidDateFrom,
                            StupidDateTo,
                            SubmitDate,
                        } = formData;
                        let bbCode = `[divbox=white] [center] [img]https://i.imgur.com/Hxjt4M2.png[/img] [/center] [/divbox]
[divbox=white]
[br][/br][color=#800000][size=150][b]I. PATIENT INFORMATION[/b][/size][/color][hr][/hr]
[list=none][b]Title:[/b] [i](select one)[/i]
[list=none][${formData.patientTitle === 'Mr' ? 'x' : ''}] Mr.
[*][${formData.patientTitle === 'Mrs' ? 'x' : ''}] Mrs.
[*][${formData.patientTitle === 'Ms' ? 'x' : ''}] Ms.
[*][${formData.patientTitle === 'Other' ? 'x' : ''}] Other[/list]
[b]First Name:[/b]
[i]${patientFirstName}[/i][br][/br]
[b]Middle Name:[/b] [i](optional)[/i]
[i]${patientMiddleName}[/i][br][/br]
[b]Last Name:[/b]
[i]${patientLastName}[/i][br][/br]
[b]Gender:[/b] [i](select one)[/i]
[list=none]
[*][${formData.patientGender === 'Male' ? 'X' : ''}] Male
[*][${formData.patientGender === 'Female' ? 'X' : ''}] Female[/list]
[b]Date of Birth:[/b]
[i]${patientDateOfBirth}[/i][br][/br]
[b]Address:[/b]
[i]${patientAddress}[/i][br][/br]
[b]ZIP / Postal Code:[/b]
[i]${patientZIP}[/i][br][/br][/list]
[br][/br][color=#800000][size=150][b]II. CONTACT INFORMATION[/b][/size][/color][hr][/hr]
[list=none]
[b]Phone Type:[/b] [i](select one)[/i]
[list=none]
[*][${formData.patientPhoneType === 'Mobile' ? 'X' : ''}] Mobile
[*][${formData.patientPhoneType === 'Home' ? 'X' : ''}] Home
[*][${formData.patientPhoneType === 'Work' ? 'X' : ''}] Work
[*][${formData.patientPhoneType === 'Other' ? 'X' : ''}] Other[/list][b]Phone Number:[/b]
[i]${patientPH}[/i][br][/br]
[b]Email:[/b]
[i]${patientEmail}[/i][br][/br][/list]
[br][/br][color=#800000][size=150][b]III. RELEASE INFORMATION[/b][/size][/color][hr][/hr]
[list=none][b]Purpose of Medical Information Release:[/b]
[list=none]
[*][${formData.CarePurposeMedicalInformationRelease === 'Further Treatment' ? 'X' : ''}] Further Treatment / Continued 
[*][${formData.CarePurposeMedicalInformationRelease === 'Personal' ? 'X' : ''}] Personal Use
[*][${formData.CarePurposeMedicalInformationRelease === 'Attorney' ? 'X' : ''}] Attorney / Client
[*][${formData.CarePurposeMedicalInformationRelease === 'Other' ? 'X' : ''}] Other: ${patientMedInfoReleaseOther}[/list][/list]
[list=none][b]Format of Medical Information Release:[/b]
[list=none]
[*][${formData.PurposeMedicalInformationReleaseFormat === 'CopyofRecords' ? 'X' : ''}] Copy of Record to be picked up
[*][${formData.PurposeMedicalInformationReleaseFormat === 'VerbalRelease' ? 'X' : ''}] Verbal Release (e.g. phone conversation)
[*][${formData.PurposeMedicalInformationReleaseFormat === 'ElectronicRelease' ? 'X' : ''}] Electronical Release (sent via email)
[*][${formData.PurposeMedicalInformationReleaseFormat === 'Other' ? 'X' : ''}] Other: ${patientMedInfoFormatOther}[/list][/list]
[list=none][b]Date Range:[/b]
[i]I authorize the release of information covering the period(s) of treatment:[/i]
[list=none]
[*][b]From:[/b] [i]${StupidDateFrom}[/i]    
[*][b]To:[/b] [i]${StupidDateTo}[/i][/list][/list]
[list=none][b]Medical Records to be Released:[/b] [i](check all that apply)[/i]
[list=none]
[*][${formData.MedicalRecordsRelease?.includes('ERVisit') ? 'X' : ''}] [b]Emergency Room Visit[/b] (ER notes, progress notes, consultations, procedure notes, test results)
[*][${formData.MedicalRecordsRelease?.includes('HospitalStay') ? 'X' : ''}] [b]Hospital Stay[/b] (History and physical, progress notes, consultations, operative reports, discharge summary, test results)
[*][${formData.MedicalRecordsRelease?.includes('Outpatient') ? 'X' : ''}] [b]Outpatient Surgery/Procedure[/b] (History and physical, progress notes, consultations, procedure notes, test results)
[*][${formData.MedicalRecordsRelease?.includes('OfficeClinic') ? 'X' : ''}] [b]Clinic, Office Visit or Immediate Care[/b] (Office notes, progress notes, procedure notes, test results)
[*][${formData.MedicalRecordsRelease?.includes('PsychologyVisits') ? 'X' : ''}] [b]Psychology Visits[/b] (Office notes, progress notes, procedure notes, evaluation results)
[*][${formData.MedicalRecordsRelease?.includes('Other') ? 'X' : ''}] [b]Other Records:[/b] ${MedicalRecordsReleaseOther}[/list][/list]
[list=none][b]Practitioner's name seen by:[/b]
[i]${phmcEmployee}[/i]
[br][/br][/list]
[color=#800000][size=150][b]IV. AUTHORIZATION FOR RELEASE INFORMATION[/b][/size][/color][hr][/hr][br][/br]
[list=none]I, ${patientFirstName} ${patientMiddleName} ${patientLastName}, hereby authorize Pillbox Hill Medical Center to disclose my individually identifiable health information. I understand that this authorization is voluntary and I may refuse to sign this authorization. I further understand that my health care will not be affected if I do not sign this form.

I, ${patientFirstName} ${patientMiddleName} ${patientLastName}, understand that if the recipient authorized to receive the information is not a covered entity, the released information may no longer be protected by federal and state privacy regulations.

I, ${patientFirstName} ${patientMiddleName} ${patientLastName}, further understand that I may revoke this authorization at any time by notifying, in writing, the Pillbox Hill Medical Center facility where this authorization is being signed. I also understand the revocation must be signed and dated with a date that is later than the date on this authorization. The revocation will not affect any releases made prior to the receipt of the written revocation.

I, ${patientFirstName} ${patientMiddleName} ${patientLastName}, understand the record might not be complete, if it is a recent visit, and additional documentation could be added after submitting this request. 

By typing my name below, I, ${patientFirstName} ${patientMiddleName} ${patientLastName}, certify that this information can be used for the purpose of processing my Authorization for Medical Records Release request. I consider this as my electronic signature for this request.
[br][/br]
[/list]
[list=none][b]Signature:[/b] 
[i]${patientFirstName} ${patientMiddleName} ${patientLastName}[/i][br][/br]
[b]Date:[/b]
[i]${SubmitDate}[/i][/list][/divbox]`
return bbCode;
};
const generateBasicPatientFile = () => {
    const {
        patientName,
        patientAddress,
        patientRace,
        patientGender,
        patientPH,
        patientDiscord,
        patientEmergencyContact,
        patientEmergencyContactNumber,
        patientEmergencyContactRelation,
        patientEmergencyContactDiscord,
        patientTitle,
        patientAllergies,
        patientCurrentMedicine,
        patientChronicDiseases,
        patientNotes,
        date,
        patientID,
    } = formData;

    let bbCode = `[table][tr][td][center][br][/br][br][/br][b]Patient Information[/b]

[size=110]PATIENT ${patientID}

${patientName}
[/size]

[/center][td][center][img]https://i.imgur.com/QMaz0OC.png[/img][img]https://i.imgur.com/LkRKav2.png[/img]
[b][size=150]BASIC PATIENT INFORMATION[/size][/center][/table]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]General Information[/b][/color][/size][/center][/divboxcolor]
[table][tr][td] Title: ${patientTitle}[/td][td] Full Name: ${patientName}
[tr][td] Date of Birth: ${date} [/td][td] Home Address: ${patientAddress}
[tr][td] Gender Identity: ${patientGender} [/td][td] Ethnicity: ${patientRace}
[tr][td] Phone Number: ${patientPH} [/td][td] ((Discord ID: ${patientDiscord}))
[/table]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Emergency Contact[/b][/color][/size][/center][/divboxcolor]
[table][tr][td] Full Name: ${patientEmergencyContact} [/td][td] Relationship: ${patientEmergencyContactRelation}
[tr][td] Phone Number: ${patientEmergencyContactNumber} [/td][td] ((Discord ID: ${patientEmergencyContactDiscord}))
[/table]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Medical History[/b][/color][/size][/center][/divboxcolor]
[table][tr][td][b][size=105]Past History[/size][/b][color=transparent]youarecool[/color][/td][td][color=transparent]ifyoureadthisyouareawesomebutdontdeletemeplease![/color]
[tr][td] Blood Type: [/td][td] [cb${formData.patientBloodType === 'A+' ? 'c' : ''}] A+ [cb${formData.patientBloodType === 'A-' ? 'c' : ''}] A- [cb${formData.patientBloodType === 'B+' ? 'c' : ''}] B+ [cb${formData.patientBloodType === 'B-' ? 'c' : ''}] B- [cb${formData.patientBloodType === 'O+' ? 'c' : ''}] O+ [cb${formData.patientBloodType === 'O-' ? 'c' : ''}] O- [cb${formData.patientBloodType === 'AB+' ? 'c' : ''}] AB+ [cb${formData.patientBloodType === 'AB-' ? 'c' : ''}] AB-
[tr][td] Known Allergies: [/td][td] ${patientAllergies}
[tr][td] Current Medications: [/td][td] ${patientCurrentMedicine}
[tr][td] Chronic Conditions: [/td][td] ${patientChronicDiseases}
[tr][td] Traumas & Injuries: [/td][td] ${patientNotes}
[/table] 
`
    return bbCode;
    };
    const generateBasicPatientFileStaff = () => {
        const {
            patientName,
            patientAddress,
            patientRace,
            patientGender,
            patientPH,
            patientDiscord,
            patientEmergencyContact,
            patientEmergencyContactNumber,
            patientEmergencyContactRelation,
            patientEmergencyContactDiscord,
            patientTitle,
            patientAllergies,
            patientCurrentMedicine,
            patientChronicDiseases,
            patientNotes,
            date,
            patientID,
        } = formData;
    
        let bbCode = `[table][tr][td][center][br][/br][br][/br][b]Patient Information[/b]
    
    [size=110]PATIENT ${patientID}
    
    ${patientName}
    [/size]
    
    [/center][td][center][img]https://i.imgur.com/QMaz0OC.png[/img][img]https://i.imgur.com/LkRKav2.png[/img]
    [b][size=150]BASIC PATIENT INFORMATION[/size][/center][/table]
    [divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]General Information[/b][/color][/size][/center][/divboxcolor]
    [table][tr][td] Title: ${patientTitle}[/td][td] Full Name: ${patientName}
    [tr][td] Date of Birth: ${date} [/td][td] Home Address: ${patientAddress}
    [tr][td] Gender Identity: ${patientGender} [/td][td] Ethnicity: ${patientRace}
    [tr][td] Phone Number: ${patientPH} [/td][td] ((Discord ID: ${patientDiscord}))
    [/table]
    [divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Emergency Contact[/b][/color][/size][/center][/divboxcolor]
    [table][tr][td] Full Name: ${patientEmergencyContact} [/td][td] Relationship: ${patientEmergencyContactRelation}
    [tr][td] Phone Number: ${patientEmergencyContactNumber} [/td][td] ((Discord ID: ${patientEmergencyContactDiscord}))
    [/table]
    [divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Medical History[/b][/color][/size][/center][/divboxcolor]
    [table][tr][td][b][size=105]Past History[/size][/b][color=transparent]youarecool[/color][/td][td][color=transparent]ifyoureadthisyouareawesomebutdontdeletemeplease![/color]
    [tr][td] Blood Type: [/td][td] [cb${formData.patientBloodType === 'A+' ? 'c' : ''}] A+ [cb${formData.patientBloodType === 'A-' ? 'c' : ''}] A- [cb${formData.patientBloodType === 'B+' ? 'c' : ''}] B+ [cb${formData.patientBloodType === 'B-' ? 'c' : ''}] B- [cb${formData.patientBloodType === 'O+' ? 'c' : ''}] O+ [cb${formData.patientBloodType === 'O-' ? 'c' : ''}] O- [cb${formData.patientBloodType === 'AB+' ? 'c' : ''}] AB+ [cb${formData.patientBloodType === 'AB-' ? 'c' : ''}] AB-
    [tr][td] Known Allergies: [/td][td] ${patientAllergies}
    [tr][td] Current Medications: [/td][td] ${patientCurrentMedicine}
    [tr][td] Chronic Conditions: [/td][td] ${patientChronicDiseases}
    [tr][td] Traumas & Injuries: [/td][td] ${patientNotes}
    [/table] 
    `
        return bbCode;
        };
    
    const generateEmailPHMCEmail = () => {
        const {
            scenePhotos,
            decedentName,
            patientNotes,
            synopsis,
            phmcEmployee,
            decedentOOC,
            patientCareer,
        } = formData;
        const scenePhotosBBCode = scenePhotos.split(',').map(photo => `[img]${photo.trim()}[/img]`).join('\n');

        let bbCode = `[divbox=na][br][/br][imageleft]https://i.imgur.com/dkdFQtg.png[/imageleft] [b][size=110]Pillbox Hill Medical Center[/size][/b] 
[center][/center][br][/br]
[center][size=130][/center][/size]
[center][size=150][b]RE: ${patientNotes} [/b][/size][/center]

[hr][/hr][br][/br][list=none]
Dear ${decedentName},

${synopsis}


Respectfully submitted,
${scenePhotosBBCode} 
[/list][hr][/hr][list=none]
[b][size=105]${phmcEmployee}[/size][/b]
[size=85]${decedentOOC}
${patientCareer}
[/size]

[b]Pillbox Hill Medical Center[/b]
[size=85]Elgin Avenue/Strawberry Avenue, Pillbox Hill, Los Santos, SA
Phone: 50056
Mail: [url=https://phmc.gta.world/ucp.php?i=pm&mode=compose&g=40]info@phmc.health[/url]
Website: [url=https://phmc.gta.world/index.php]www.phmc.health[/url]

Follow us on Facebrowser: [url=https://face.gta.world/pages/PHMC?ref=qs]Pillbox Hill Medical Center[/url][/size]

[size=70][i]The contents of this message and any attachments are confidential. They are intended for the named recipient(s) only.  If you have received this email by mistake, please notify the sender immediately and do not disclose the contents to anyone or make copies thereof.[/i][/size][/divbox] 
`
        return bbCode;
        };
        const generateHUGEFUCKINGFORM = () => {
            const {
                patientName,
                patientAddress,
                patientRace,
                patientGender,
                patientPH,
                patientDiscord,
                patientEmergencyContact,
                patientEmergencyContactNumber,
                patientEmergencyContactRelation,
                patientEmergencyContactDiscord,
                patientTitle,
                patientAllergies,
                patientCurrentMedicine,
                patientChronicDiseases,
                patientNotes,
                date,
                patientID,
                patientTherapy, 
                patientTriggers,
                patientSupport,
                patientHarm,
                patientFam,
                patientGenetic,
                patientMental,
                patientFamSocial,
                patientReligion,
                attorneyName,
                attorneyRelation,
                attorneyPH,
                patientDateOfBirth,
                patientSmoker, 
                patientAlcohol,
                patientDrugs,
                patientExercise,
                patientDiet,
                patientSleep,
                patientSexLife, 
                patientJobRisks,
                patientHazards, 
                patientOther, 
                dnrOther,
                decedentOOC
                    } = formData;
    
            let bbCode = `[table][tr][td][center][br][/br][br][/br][b]Patient Information[/b]

[size=110]PATIENT ${patientID}

${patientName}
[/size]

[/center][td][center][img]https://i.imgur.com/QMaz0OC.png[/img][img]https://i.imgur.com/LkRKav2.png[/img]
[b][size=150]ADVANCED PATIENT INFORMATION[/size][/center][/table]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]General Information[/b][/color][/size][/center][/divboxcolor]
[table][tr][td] Title: ${patientTitle}[/td][td] Full Name: ${patientName}
[tr][td] Date of Birth: ${patientDateOfBirth} [/td][td] Home Address: ${patientAddress}
[tr][td] Gender Identity: ${patientGender} [/td][td] Ethnicity: ${patientRace}
[tr][td] Phone Number: ${patientPH} [/td][td] ((Discord ID: ${patientDiscord}))
[/table]
    [divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Emergency Contact[/b][/color][/size][/center][/divboxcolor]
    [table][tr][td] Full Name: ${patientEmergencyContact} [/td][td] Relationship: ${patientEmergencyContactRelation}
    [tr][td] Phone Number: ${patientEmergencyContactNumber} [/td][td] ((Discord ID: ${patientEmergencyContactDiscord}))
[/table]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Medical History[/b][/color][/size][/center][/divboxcolor]
[table][tr][td][b][size=105]Past History[/size][/b][color=transparent]youarecool[/color][/td][td][color=transparent]ifyoureadthisyouareawesomebutdontdeletemeplease![/color]
[tr][td] Blood Type: [/td][td] [cb${formData.patientBloodType === 'A+' ? 'c' : ''}] A+ [cb${formData.patientBloodType === 'A-' ? 'c' : ''}] A- [cb${formData.patientBloodType === 'B+' ? 'c' : ''}] B+ [cb${formData.patientBloodType === 'B-' ? 'c' : ''}] B- [cb${formData.patientBloodType === 'O+' ? 'c' : ''}] O+ [cb${formData.patientBloodType === 'O-' ? 'c' : ''}] O- [cb${formData.patientBloodType === 'AB+' ? 'c' : ''}] AB+ [cb${formData.patientBloodType === 'AB-' ? 'c' : ''}] AB-
[tr][td] Known Allergies: [/td][td] ${patientAllergies}
[tr][td] Current Medications: [/td][td] ${patientCurrentMedicine}
[tr][td] Chronic Conditions: [/td][td] ${patientChronicDiseases}
[tr][td] Traumas & Injuries: [/td][td] ${patientNotes}
[/table]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Mental Health History[/b][/color][/size][/center][/divboxcolor]
[table][tr][td][b][size=105]Past History[/size][/b][color=transparent]youarecool[/color][/td][td][color=transparent]ifyoureadthisyouareawesomebutdontdeletemeplease![/color]
[tr][td] Diagnosed Mental Health Conditions: [/td][td] ${patientMental}
[tr][td] Therapies & Counseling: [/td][td] ${patientTherapy}
[tr][td] Triggers or Sensors: [/td][td] ${patientTriggers}
[tr][td] Support & Coping Systems: [/td][td] ${patientSupport}
[tr][td] Self-Harm History or Tendencies: [/td][td] ${patientHarm}
[/table]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Family Medical History[/b][/color][/size][/center][/divboxcolor]
[table][tr][td][b][size=105]Past History[/size][/b][color=transparent]youarecool[/color][/td][td][color=transparent]ifyoureadthisyouareawesomebutdontdeletemeplease![/color]
[tr][td] Immediate Family Members: [/td][td] ${patientFam}
[tr][td] Known Genetic Conditions: [/td][td] ${patientGenetic}
[tr][td] Family Social History: [/td][td] ${patientFamSocial}
[/table]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Social Information[/b][/color][/size][/center][/divboxcolor]
[table][tr][td] Marital Status: [cb${formData.maritalStatus === 'Single' ? 'c' : ''}] Single [cb${formData.maritalStatus === 'Married' ? 'c' : ''}] Married [cb${formData.maritalStatus === 'Divorced' ? 'c' : ''}] Divorced/Widowed [/td][td] Number of Children: [cb${formData.numberChildren === '0' ? 'c' : ''}] 0 [cb${formData.numberChildren === '1' ? 'c' : ''}] 1 or more
[tr][td] Cultural and/or Religious Considerations: ${patientReligion} [/td][td] Financial Status: [cb${formData.financialStatus === 'LowIncome' ? 'c' : ''}] Low Income [cb${formData.financialStatus === 'MiddleIncome' ? 'c' : ''}] Average Income [cb${formData.financialStatus === 'HighIncome' ? 'c' : ''}] High Income
[/table]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Lifestyle Information[/b][/color][/size][/center][/divboxcolor]
[table][tr][td] Smoking Status: ${patientSmoker} [/td][td] Alcohol Use: ${patientAlcohol}[/td][td] Other Substances: ${patientDrugs}
[tr][td] Exercise Habits: ${patientExercise}[/td][td] Dietary Information: ${patientDiet}[/td][td] Sleep Patterns: ${patientSleep}
[tr][td] Sexual Health: ${patientSexLife}[/td][td] Occupational Hazards: ${patientJobRisks}[/td][td] Environmental Hazards: ${patientHazards}[/table]
[table][tr][td] Other Information & Preferences: ${patientOther}
[/table]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Advanced Directives[/b][/color][/size][/center][/divboxcolor]
[divbox=transparent][list=none]I, ${patientName}, hereby provide the following advance directives regarding my healthcare, to be followed in the event that I become unable to make decisions about my medical treatment:

[list=1][*] [size=110]Living Will[/size]: In the event I am unable to communicate, I direct the following regarding life-sustaining treatments:
[cb${formData.dnr === 'ProlongLife' ? 'c' : ''}][/cb${formData.dnr === 'ProlongLife' ? 'c' : ''}]I want all available measures taken to prolong my life.
[cb${formData.dnr === 'ComfortOfLife' ? 'c' : ''}][/cb${formData.dnr === 'ComfortOfLife' ? 'c' : ''}]I want only treatments focused on comfort and quality of life, even if it means not prolonging life.
[cb${formData.dnr === 'other' ? 'c' : ''}][/cb${formData.dnr === 'other' ? 'c' : ''}]Other instructions: ${dnrOther}

[*][size=110]Healthcare Power of Attorney[/size]:
[cb${formData.attorney === 'Yes' ? 'c' : ''}][/cb${formData.attorney === 'Yes' ? 'c' : ''}]have appointed the following person as my Healthcare Proxy/Agent to make medical decisions on my behalf:
[list=none]Full Name: ${attorneyName}
Relationship to Patient: ${attorneyRelation}
Phone Number: ${attorneyPH}[/list]

[cb${formData.attorney === 'No' ? 'c' : ''}][/cb${formData.attorney === 'No' ? 'c' : ''}]I have not appointed a Healthcare Proxy/Agent at this time.
[*] [size=110]Do Not Resuscitate (DNR) Order[/size]:
[cb${formData.dnrOrder === 'Yes' ? 'c' : ''}][/cb${formData.dnrOrder === 'Yes' ? 'c' : ''}]I have a DNR order in place, instructing medical staff not to perform CPR or other life-saving measures if my heart stops.
[cb${formData.dnrOrder === 'No' ? 'c' : ''}][/cb${formData.dnrOrder === 'No' ? 'c' : ''}]I do not have a DNR order in place at this time.

[*] [size=110]Consent to Share Advance Directives[/size]:
I authorize Pillbox Hill Medical Center to keep a copy of my advance directives in my medical record and to share this information with medical staff and emergency personnel as needed to ensure my healthcare wishes are respected.[/list]
I understand that I may revise or revoke these directives at any time by providing written notice.

Signature: [i][u]${patientName}[/u][/i]
Date: ${date}[/divbox]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Disclaimer[/b][/color][/size][/center][/divboxcolor]
[divbox=transparent][list=none]I, ${patientName}, hereby declare that the information provided in this medical history form is true, accurate, and complete to the best of my knowledge. I understand that this information will be stored securely within the systems of Pillbox Hill Medical Center and may be accessed by authorized healthcare professionals involved in my care.

I, ${patientName}, upon submitting this form, consent to the sharing of my medical information among healthcare professionals within Pillbox Hill Medical Center for the purpose of providing comprehensive and coordinated healthcare services. I acknowledge that this information may be used for diagnosis, treatment, and other healthcare-related activities in accordance with applicable laws and regulations, including the Health Insurance Portability and Accountability Act (HIPAA).

I, ${patientName}, retain the right to revoke this consent at any time by notifying Pillbox Hill Medical Center in writing. However, I also understand that revoking consent may limit the ability of healthcare professionals to provide me with optimal and coordinated care.[/list][/divbox]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Payment[/b][/color][/size][/center][/divboxcolor]
[table][tr][td] Please attach an unedited confirmation of your payment, unless you are exempt. [size=70](see question 14 in the FAQ thread on how to pay)[/size][/td][td]
[url=${decedentOOC}]Proof Of Payment [/url]
[/table]`
            return bbCode;
            };
    
// generatePsychEvalPHMC
const generatePsychEvalPHMC = () => {
    const {
        patientID,
        date,
        phmcRank,
        lastName,
        patientChiefComplaint,
        patientTriggers,
        patientStress,
        patientTreatment,
        patientFamily,
        patientJobRisks,
        patientMedicalRecord,
        patientAllergies,
        patientChronicDiseases,
        patientVisitReason,
        patientSymptoms,
        patientCondition,
        patientDrugs,
        patientDrugsUsage,
        patientMental,
        patientJob,
        patientFam,
        patientLegal,
        patientRelationship,
        patientFindings,
        patientTreatmentPlan,
        patientSafety,
        patientFollowUp,
        patientTreatmentMedicine,
        patientDiagnosis,
        patientTherapy,
        patientRiskAssessment,
        patientTherapyMedicine,
    } = formData;

    let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]Session Notes[/b]
PATIENT ${patientID}
Date: ${date}
Signed: ${phmcRank} ${lastName}
[/center][td][center][img]https://i.imgur.com/QMaz0OC.png[/img][/center][td][center][br][/br][br][/br][size=100][b]PILLBOX HILL MEDICAL CENTER[/b]
ELGIN AVE. / STRAWBERRY AVE.
PO BOX 742
LOS SANTOS, SAN ANDREAS
P: 50056[/size][/center][/table][/divbox]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Anamnesis[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Chief Complaint: [/u][br][/br]
${patientChiefComplaint}
[br][/br]
[u]Assigned Department: [/u][br][/br]
[cbc] Mental Health
[br][/br][/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Presenting Problem[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Description of the issue (e.g., anxiety, depression, psychosis): [/u][br][/br]
${patientVisitReason}
[br][/br]
[u]Onset and duration of symptoms: [/u][br][/br]
${patientSymptoms}
[br][/br]
[u]Triggers or stressors: [/u][br][/br]
${patientTriggers}
[br][/br]
[u]Impact on daily life: [/u][br][/br]
${patientStress}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Mental Status Examination (MSE)[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[u]Appearance: [/u][br][/br]
[cb${formData.Appearance === 'Good' ? 'c' : ''}] Well-groomed [cb${formData.Appearance === 'Disheveled' ? 'c' : ''}] Disheveled [cb${formData.Appearance === 'Inappropriate' ? 'c' : ''}] Inappropriate
[br][/br]
[u]Behavior: [/u][br][/br]
[cb${formData.Behavior === 'Cooperative' ? 'c' : ''}] Cooperative [cb${formData.Behavior === 'Agitated' ? 'c' : ''}] Agitated [cb${formData.Behavior === 'Withdrawn' ? 'c' : ''}] Withdrawn
[br][/br]
[u]Speech: [/u][br][/br]
[cb${formData.Speech === 'Normal' ? 'c' : ''}] Normal [cb${formData.Speech === 'Pressured' ? 'c' : ''}] Pressured [cb${formData.Speech === 'Slurred' ? 'c' : ''}] Slurred [cbcb${formData.Speech === 'Slow' ? 'c' : ''}] Slow
[br][/br]
[u]Mood: [/u][br][/br]
[cb${formData.Mood === 'Euthymic' ? 'c' : ''}] Euthymic [cb${formData.Mood === 'Depressed' ? 'c' : ''}] Depressed [cb${formData.Mood === 'Anxious' ? 'c' : ''}] Anxious [cb${formData.Mood === 'Angry' ? 'c' : ''}] Angry
[br][/br]
[u]Affect: [/u][br][/br]
[cb${formData.Affect === 'Congruent' ? 'c' : ''}] Congruent [cb${formData.Affect === 'Flat' ? 'c' : ''}] Flat [cb${formData.Affect === 'Inappropriate' ? 'c' : ''}] Inappropriate
[br][/br]
[u]Thought Process: [/u][br][/br]
[cb${formData.ThoughtProcess === 'Logical' ? 'c' : ''}] Logical [cb${formData.ThoughtProcess === 'Organized' ? 'c' : ''}] Organized [cb${formData.ThoughtProcess === 'Tangential' ? 'c' : ''}] Tangential [cb${formData.ThoughtProcess === 'Disorganized' ? 'c' : ''}] Disorganized
[br][/br]
[u]Thought Content: [/u][br][/br]
[cb${formData.ThoughtContent === 'Nodelusions' ? 'c' : ''}] No delusions [cb${formData.ThoughtContent === 'Delusions' ? 'c' : ''}] Delusions [cb${formData.ThoughtContent === 'Hallucinations' ? 'c' : ''}] Hallucinations [cb${formData.ThoughtContent === 'Suicidal' ? 'c' : ''}] Suicidal thoughts [cb${formData.ThoughtContent === 'Homicidal' ? 'c' : ''}] Homicidal thoughts
[br][/br]
[u]Insight and Judgment: [/u][br][/br]
[cb${formData.Insight === 'Intact' ? 'c' : ''}] Intact [cb${formData.Insight === 'Limited' ? 'c' : ''}] Limited [cb${formData.Insight === 'Poor' ? 'c' : ''}] Poor
[br][/br]
[u]Cognition: [/u][br][/br]
[cb${formData.Cognition === 'Oriented' ? 'c' : ''}] Oriented to time, place, person [cb${formData.Cognition === 'Memory' ? 'c' : ''}] Memory intact [cb${formData.Cognition === 'Attention' ? 'c' : ''}] Attention intact
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Psychiatric History[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[u]Past psychiatric diagnoses and treatments: [/u][br][/br]
${patientTreatment}
[br][/br]
[u]Hospitalizations: [/u][br][/br]
${patientMedicalRecord}
[br][/br]
[u]Family psychiatric history: [/u][br][/br]
${patientFamily}
[br][/br]
[u]History of self-harm or suicide attempts: [/u][br][/br]
${patientJobRisks}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Medical History[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[u]Current and past medical conditions: [/u][br][/br]
${patientCondition}
[br][/br]
[u]Medications (including psychiatric and non-psychiatric): [/u][br][/br]
${patientChronicDiseases}
[br][/br]
[u]Allergies: [/u][br][/br]
${patientAllergies}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Substance Use History[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[u]Use of alcohol, drugs, nicotine, and other substances: [/u][br][/br]
${patientDrugs}
[br][/br]
[u]Frequency and duration of use: [/u][br][/br]
${patientDrugsUsage}
[br][/br]
[u]Impact on mental health: [/u][br][/br]
${patientMental}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Psychosocial History[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[u]Childhood and family background: [/u][br][/br]
${patientFam}
[br][/br]
[u]Education and employment history: [/u][br][/br]
${patientJob}
[br][/br]
[u]Relationships and support system: [/u][br][/br]
${patientRelationship}
[br][/br]
[u]Legal issues: [/u][br][/br]
${patientLegal}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Risk Assessment[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[cb${formData.Risk === 'Suicidal' ? 'c' : ''}] Suicidal ideation or attempts [cb${formData.Risk === 'Homicidal' ? 'c' : ''}] Homicidal thoughts or violent behavior [cb${formData.Risk === 'Self' ? 'c' : ''}] Self-injury or harm to others
[br][/br]
[u]Details: [/u][br][/br]
${patientRiskAssessment}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Findings[/b][/color][/center][/divboxcolor]
[table][tr][td][list=none]
Notes: ${patientFindings}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Discharge Diagnosis[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[u]Primary Diagnosis: [/u][br][/br]
${patientDiagnosis}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Therapy[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Admission: [/u][br][/br]
[cb${formData.admission === 'Yes' ? 'c' : ''}] Yes [cb${formData.admission === 'No' ? 'c' : ''}] No
[br][/br]
[u]Treatment Plan: [/u][br][/br]
${patientTreatmentPlan}
[br][/br]
[u]Medication: [/u][br][/br]
${patientTherapyMedicine}
[br][/br]
[u]Follow-Up: [/u][br][/br]
[cb${formData.followup === 'AsNeeded' ? 'c' : ''}] As needed [cb${formData.followup === 'Recommended' ? 'c' : ''}] Recommended

[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Treatment Plan/Recommendations[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[u]Medications: [/u][br][/br]
${patientTreatmentMedicine}
[br][/br]
[u]Therapy (e.g., CBT, DBT): [/u][br][/br]
${patientTherapy}
[br][/br]
[u]Follow-up appointments: [/u][br][/br]
${patientFollowUp}
[br][/br]
[u]Safety planning (if at risk): [/u][br][/br]
${patientSafety}
[/list][/td][/tr][/table]`
    return bbCode;
    };
// generatePsychEvalPBC
const generatePsychEvalPBC = () => {
    const {
        patientID,
        date,
        Affect,
        phmcRank,
        lastName,
        patientChiefComplaint,
        patientTriggers,
        patientStress,
        patientTreatment,
        patientFamily,
        patientJobRisks,
        patientMedicalRecord,
        patientAllergies,
        patientChronicDiseases,
        patientVisitReason,
        patientSymptoms,
        patientCondition,
        patientDrugs,
        patientDrugsUsage,
        patientMental,
        patientJob,
        patientFam,
        patientLegal,
        patientRelationship,
        patientFindings,
        patientTreatmentPlan,
        patientSafety,
        patientFollowUp,
        patientTreatmentMedicine,
        patientDiagnosis,
        patientTherapy,
        patientRiskAssessment,
        patientTherapyMedicine,
    } = formData;

    let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]Session Notes[/b]
PATIENT ${patientID}
Date: ${date}
Signed: ${phmcRank} ${lastName}
[/center][td][center][img]https://i.imgur.com/LkRKav2.png[/img][/center][td][center][br][/br][br][/br][size=100][b]PALETO BAY CLINIC[/b]
PALETO BAY BLVD.
PO BOX 685
PALETO BAY, SAN ANDREAS
P: 50056[/size][/center][/table][/divbox]

[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Anamnesis[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Chief Complaint: [/u][br][/br]
${patientChiefComplaint}
[br][/br]
[u]Assigned Department: [/u][br][/br]
[cbc] Mental Health
[br][/br][/list][/td][/tr][/table]

[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Presenting Problem[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Description of the issue (e.g., anxiety, depression, psychosis): [/u][br][/br]
${patientVisitReason}
[br][/br]
[u]Onset and duration of symptoms: [/u][br][/br]
${patientSymptoms}
[br][/br]
[u]Triggers or stressors: [/u][br][/br]
${patientTriggers}
[br][/br]
[u]Impact on daily life: [/u][br][/br]
${patientStress}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Mental Status Examination (MSE)[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[u]Appearance: [/u][br][/br]
[cb${formData.Appearance === 'Good' ? 'c' : ''}] Well-groomed [cb${formData.Appearance === 'Disheveled' ? 'c' : ''}] Disheveled [cb${formData.Appearance === 'Inappropriate' ? 'c' : ''}] Inappropriate
[br][/br]
[u]Behavior: [/u][br][/br]
[cb${formData.Behavior === 'Cooperative' ? 'c' : ''}] Cooperative [cb${formData.Behavior === 'Agitated' ? 'c' : ''}] Agitated [cb${formData.Behavior === 'Withdrawn' ? 'c' : ''}] Withdrawn
[br][/br]
[u]Speech: [/u][br][/br]
[cb${formData.Speech === 'Normal' ? 'c' : ''}] Normal [cb${formData.Speech === 'Pressured' ? 'c' : ''}] Pressured [cb${formData.Speech === 'Slurred' ? 'c' : ''}] Slurred [cbcb${formData.Speech === 'Slow' ? 'c' : ''}] Slow
[br][/br]
[u]Mood: [/u][br][/br]
[cb${formData.Mood === 'Euthymic' ? 'c' : ''}] Euthymic [cb${formData.Mood === 'Depressed' ? 'c' : ''}] Depressed [cb${formData.Mood === 'Anxious' ? 'c' : ''}] Anxious [cb${formData.Mood === 'Angry' ? 'c' : ''}] Angry
[br][/br]
[u]Affect: [/u][br][/br]
[cb${formData.Affect === 'Congruent' ? 'c' : ''}] Congruent [cb${formData.Affect === 'Flat' ? 'c' : ''}] Flat [cb${formData.Affect === 'Inappropriate' ? 'c' : ''}] Inappropriate
[br][/br]
[u]Thought Process: [/u][br][/br]
[cb${formData.ThoughtProcess === 'Logical' ? 'c' : ''}] Logical [cb${formData.ThoughtProcess === 'Organized' ? 'c' : ''}] Organized [cb${formData.ThoughtProcess === 'Tangential' ? 'c' : ''}] Tangential [cb${formData.ThoughtProcess === 'Disorganized' ? 'c' : ''}] Disorganized
[br][/br]
[u]Thought Content: [/u][br][/br]
[cb${formData.ThoughtContent === 'Nodelusions' ? 'c' : ''}] No delusions [cb${formData.ThoughtContent === 'Delusions' ? 'c' : ''}] Delusions [cb${formData.ThoughtContent === 'Hallucinations' ? 'c' : ''}] Hallucinations [cb${formData.ThoughtContent === 'Suicidal' ? 'c' : ''}] Suicidal thoughts [cb${formData.ThoughtContent === 'Homicidal' ? 'c' : ''}] Homicidal thoughts
[br][/br]
[u]Insight and Judgment: [/u][br][/br]
[cb${formData.Insight === 'Intact' ? 'c' : ''}] Intact [cb${formData.Insight === 'Limited' ? 'c' : ''}] Limited [cb${formData.Insight === 'Poor' ? 'c' : ''}] Poor
[br][/br]
[u]Cognition: [/u][br][/br]
[cb${formData.Cognition === 'Oriented' ? 'c' : ''}] Oriented to time, place, person [cb${formData.Cognition === 'Memory' ? 'c' : ''}] Memory intact [cb${formData.Cognition === 'Attention' ? 'c' : ''}] Attention intact
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Psychiatric History[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[u]Past psychiatric diagnoses and treatments: [/u][br][/br]
${patientTreatment}
[br][/br]
[u]Hospitalizations: [/u][br][/br]
${patientMedicalRecord}
[br][/br]
[u]Family psychiatric history: [/u][br][/br]
${patientFamily}
[br][/br]
[u]History of self-harm or suicide attempts: [/u][br][/br]
${patientJobRisks}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Medical History[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[u]Current and past medical conditions: [/u][br][/br]
${patientCondition}
[br][/br]
[u]Medications (including psychiatric and non-psychiatric): [/u][br][/br]
${patientChronicDiseases}
[br][/br]
[u]Allergies: [/u][br][/br]
${patientAllergies}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Substance Use History[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[u]Use of alcohol, drugs, nicotine, and other substances: [/u][br][/br]
${patientDrugs}
[br][/br]
[u]Frequency and duration of use: [/u][br][/br]
${patientDrugsUsage}
[br][/br]
[u]Impact on mental health: [/u][br][/br]
${patientMental}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Psychosocial History[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[u]Childhood and family background: [/u][br][/br]
${patientFam}
[br][/br]
[u]Education and employment history: [/u][br][/br]
${patientJob}
[br][/br]
[u]Relationships and support system: [/u][br][/br]
${patientRelationship}
[br][/br]
[u]Legal issues: [/u][br][/br]
${patientLegal}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Risk Assessment[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[cb${formData.Risk === 'Suicidal' ? 'c' : ''}] Suicidal ideation or attempts [cb${formData.Risk === 'Homicidal' ? 'c' : ''}] Homicidal thoughts or violent behavior [cb${formData.Risk === 'Self' ? 'c' : ''}] Self-injury or harm to others
[br][/br]
[u]Details: [/u][br][/br]
${patientRiskAssessment}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Findings[/b][/color][/center][/divboxcolor]
[table][tr][td][list=none]
Notes: ${patientFindings}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Discharge Diagnosis[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[u]Primary Diagnosis: [/u][br][/br]
${patientDiagnosis}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Therapy[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Admission: [/u][br][/br]
[cb${formData.admission === 'Yes' ? 'c' : ''}] Yes [cb${formData.admission === 'No' ? 'c' : ''}] No
[br][/br]
[u]Treatment Plan: [/u][br][/br]
${patientTreatmentPlan}
[br][/br]
[u]Medication: [/u][br][/br]
${patientTherapyMedicine}
[br][/br]
[u]Follow-Up: [/u][br][/br]
[cb${formData.followup === 'AsNeeded' ? 'c' : ''}] As needed [cb${formData.followup === 'Recommended' ? 'c' : ''}] Recommended

[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Treatment Plan/Recommendations[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[u]Medications: [/u][br][/br]
${patientTreatmentMedicine}
[br][/br]
[u]Therapy (e.g., CBT, DBT): [/u][br][/br]
${patientTherapy}
[br][/br]
[u]Follow-up appointments: [/u][br][/br]
${patientFollowUp}
[br][/br]
[u]Safety planning (if at risk): [/u][br][/br]
${patientSafety}
[/list][/td][/tr][/table]`
    return bbCode;
    };

    // Update BBCode generation logic
    const bbCode = bbCodeVersion === 1 ? generateDeath() :
        bbCodeVersion === 2 ? generateEmail() :
        bbCodeVersion === 3 ? generateHUGEFUCKINGFORM() :  
                bbCodeVersion === 4 ? generateDental() :
                    bbCodeVersion === 5 ? generateSurgicalOps() :
                        bbCodeVersion === 6 ? generatePhysEvalInternalMed() :
                            bbCodeVersion === 7 ? generatePhysEvalInternalMedPBC() :
                                    bbCodeVersion === 9 ? generateObsMainFile() :
                                        bbCodeVersion === 10 ? generateObsFollowUp() :
                                                bbCodeVersion === 12 ? generateGyneMainFile() :
                                                    bbCodeVersion === 13 ? generateGyneFollowUp() :
                                                        bbCodeVersion === 14 ? generateMentalHealthPHMC() :
                                                                bbCodeVersion === 16 ? generateMentalHealthPBC() :
                                                                        bbCodeVersion === 18 ? generateAgencyFeedback() :
                                                                            bbCodeVersion === 19 ? generateEmergencyProtocol() :
                                                                                bbCodeVersion === 20 ? generateConsultationNotesPHMC() :
                                                                                    bbCodeVersion === 21 ? generateConsultationNotesPBC() :
                                                                                    bbCodeVersion === 22 ? generateCommentaryNotePHMC() :
                                                                                    bbCodeVersion === 23 ? generateCommentaryNotePBC() :
                                                                                    bbCodeVersion === 24 ? generateMedicalRecordRelease() :
                                                                                        bbCodeVersion === 25 ? generateBasicPatientFile() :
                                                                                            bbCodeVersion === 26 ? generateBasicPatientFileStaff() :
                                                                                            bbCodeVersion === 27 ? generateEmailPHMCEmail() : 
                                                                                            bbCodeVersion === 28 ? generatePsychEvalPHMC() :
                                                                                            bbCodeVersion === 29 ? generatePsychEvalPBC() :
                                                                                generateDeath();
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
        setFormData({
            coronerRank: 'Forensic Attendant',
            placeOfDeath: '',
            department: '',
            dateTime: '',
            BodyMassIndex: '',
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
            decedentOOC: '',
            scenePhotos: '',
            lastName: '',
            coronerBadge: '',
            additionalImages: '',
            requestingOfficer: '',
            coronerDiscord: '',
            coronerPHNumber: '50056',
            deathReport: '',
            SubmitDate: '',
            additionalReports: [],
            showAdditionalReports: false,
            internalReport: '',
            internalAdditionalReports: '',
            policeNotification: '',
            treatmentLocation: '',
            moreDeathReports: [''],
            extraStaff: '',
            patientName: '',
            patientConsent: '',
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
            patientLastName: '',
            patientTitle: '',
            patientComplicationsYes: '',
            patientComplicationsNo: '',
            procedureGoodOptions: '',
            procedureGoodYes: '',
            procedureGoodNo: '',
            vitals: '',
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
        });

            const fieldsToRemove = [
            'dateTime',
            'department',
            'pronouncedTimeOfDeath',
            'placeOfDeath'
        ];

        fieldsToRemove.forEach(field => {
            localStorage.removeItem(field);
            localStorage.removeItem(`${field}_timestamp`);
        });

        setParsedBBCode('');
        showNotification('Form cleared!', 'check-circle');
    };

        const showNotification = (message, icon = 'check-circle') => {
        setNotification({
            message,
            icon
        });

        setTimeout(() => {
            setNotification(null);
        }, 3000);
    };


    // Add new state
    const [parsedBBCode, setParsedBBCode] = useState('');
    // update Switch logic
    const getBBCodeContent = () => {
        switch (bbCodeVersion) {
            case 1:
                return generateDeath();
            case 2:
                return generateEmail();
            case 3: 
                return generateHUGEFUCKINGFORM();
            case 4:
                return generateDental();
            case 5:
                return generateSurgicalOps();
            case 6:
                return generatePhysEvalInternalMed();
            case 7: 
                return generatePhysEvalInternalMedPBC();
            case 9:
                return generateObsMainFile();
            case 10:
                return generateObsFollowUp();
            case 11:
                return generateGyneMainFile();
            case 13:
                return generateGyneFollowUp();
            case 14:
                return generateMentalHealthPHMC();
            case 16:
                return generateMentalHealthPBC();
            case 18:
                return generateAgencyFeedback();
            case 19:
                return generateEmergencyProtocol();
            case 20:
                return generateConsultationNotesPHMC();
            case 21:
                return generateConsultationNotesPBC();
            case 22:
                return generateCommentaryNotePHMC();
            case 23:
                return generateCommentaryNotePBC();
            case 24:
                return generateMedicalRecordRelease();
            case 25:
                return generateBasicPatientFile();
            case 26:
                return generateBasicPatientFileStaff();
            case 27:
                return generateEmailPHMCEmail();
             case 28: 
                return generatePsychEvalPHMC();
            case 29:
              return generatePsychEvalPBC();
            default:
       }
    };
    const parseBBCode = () => {
        const bbCode = generateDeath();
        setParsedBBCode(bbCode);
        setFormData(prev => ({
            ...prev,
            deathReport: bbCode
        }));
        showNotification('BBCode parsed and copied to Death Report field!', 'check-circle');
    };

    // Add clear function
    const clearParsedBBCode = () => {
        setParsedBBCode('');
        setFormData(prev => ({
            ...prev,
            deathReport: ''
        }));
        showNotification('Parsed BBCode cleared!', 'trash-alt');
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

    const addReport = () => {
        setFormData(prev => ({
            ...prev,
            additionalReports: [...prev.additionalReports, '']
        }));
    };

    const removeReport = (indexToRemove) => {
        setFormData(prev => ({
            ...prev,
            additionalReports: prev.additionalReports.filter((_, index) => index !== indexToRemove)
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
        2: "Email Generator",
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
        26: "Patient File - Advanced",
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
        showNotification(`Switched to ${versionNames[version]}`, 'exchange-alt');
    };
    
    const toggleAgencySelector = () => {
        setShowAgencySelector(prev => !prev);
    };
    useEffect(() => {
        // Save the value to localStorage whenever hideAgencySelector changes
        localStorage.setItem('hideAgencySelector', JSON.stringify(hideAgencySelector));
    }, [hideAgencySelector]);

    
// business card stuff
    const [namePosition, setNamePosition] = useState({ top: 105.5, left: 22 });
    const [rankPosition, setRankPosition] = useState({ top: 143.65, left: 26.5 });
    const [phoneNumberPosition, setPhoneNumberPosition] = useState({ top: 229.65, left: 88.5  });
    const businessCardRef = useRef(null); // Ref to the business card image container
    const nameRef = useRef(null); // Ref to the name overlay
    const rankRef = useRef(null); // Ref to the rank overlay
    const departmentRef = useRef(null); // Ref to the department overlay
    const [imgurLink, setImgurLink] = useState(null);

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = () => {
        setIsSaving(true); // Disable the button
    
        localStorage.setItem('name', name);
        localStorage.setItem('rank', rank);
        localStorage.setItem('badgeNR', badgeNR);
        localStorage.setItem('department', department);
        localStorage.setItem('phoneNumber', phoneNumber);
    
        domtoimage.toPng(businessCardRef.current)
            .then(function (dataUrl) {
                uploadToImgur(dataUrl)
                    .then(imgurLink => {
                        setImgurLink(imgurLink);
                        showNotification(`Business Card Saved & Uploaded to Imgur: ${imgurLink}`, 'save');
                        sendDiscordWebhook(name, imgurLink);
    
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            navigator.clipboard.writeText(imgurLink)
                                .then(() => {
                                    showNotification('Imgur link copied to clipboard!', 'clipboard');
                                })
                                .catch(err => {
                                    console.error('Failed to copy Imgur link to clipboard:', err);
                                    showNotification('Failed to copy Imgur link to clipboard', 'error');
                                });
                        } else {
                            console.warn('Clipboard API not available in this environment.');
                            showNotification('Clipboard API not available', 'warning');
                        }
    
                        setTimeout(() => {
                        }, 10000);
                    })
                    .catch(error => {
                        console.error('Error uploading to Imgur:', error, error.response, error.request);
                        showNotification('Error uploading to Imgur', 'error');
                        sendDiscordWebhook(name, `Imgur Upload Error: ${error.message}.  Full debug: ${JSON.stringify(error)}`);
                    })
                    .finally(() => {
                        setIsSaving(false); // Re-enable the button
                    });
            })
            .catch(function (error) {
                console.error('Error converting to image:', error);
                showNotification('Error converting business card to image', 'error');
                sendDiscordWebhook(name, `Error converting business card to image: ${error.message}. Full debug: ${JSON.stringify(error)}`);
                setIsSaving(false); // Re-enable the button in case of error
            });
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
    
    const sendDiscordWebhook = async (name, messageContent) => {
        const webhookURL = process.env.REACT_APP_DISCORD_WEBHOOK_URL;
    
        if (!webhookURL) {
            console.warn('Discord webhook URL is not set in environment variables.');
            return;
        }
    
        const message = {
            content: `Business Card Creation Alert!`,
            embeds: [{
                fields: [
                    {
                        name: name + " has created a business card!",
                        value: messageContent
                    }
                ]
            }]
        };
    
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
            } else {
                console.log('DEBUG: Discord webhook sent successfully!');
            }
        } catch (error) {
            console.error('Error sending Discord webhook:', error);
        }
    };
    useEffect(() => {
        setName(localStorage.getItem('name') || '');
        setRank(localStorage.getItem('rank') || '');
        setBadgeNR(localStorage.getItem('badgeNR') || '');
        setDepartment(localStorage.getItem('department') || '');
        setPhoneNumber(localStorage.getItem('phoneNumber') || '');
        }, []);
    
    
        const toggleBusinessCard = () => {
            if (/Mobi|Android/i.test(navigator.userAgent)) {
                showNotification("Sorry, this feature is not supported on mobile devices. Please use a desktop browser.", 'warning');
                return;
            }
        
            setShowBusinessCard(!showBusinessCard);
            setShowAgencySelector(false); // Close Agency Selector
            setShowBBCode(false); // Close BBCode modal
            setShowImages(false); // Close Images modal
            // Log positions when the business card is opened
        };    // Add state near other useState declarations
    const [name, setName] = useState('');
    const [rank, setRank] = useState('');
    const [badgeNR, setBadgeNR] = useState('');
    const [department, setDepartment] = useState('');
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
    
    
    const handleDepartmentChange = (e) => {
        setDepartment(e.target.value);
    };
    useEffect(() => {
        window.onerror = async (message, source, lineno, colno, error) => {
            let lineContent = '';
            try {
                // Attempt to fetch the line content from the source file
                const response = await fetch(source);
                if (response.ok) {
                    const fileContent = await response.text();
                    const lines = fileContent.split('\n');
                    lineContent = lines[lineno - 1] || 'Line content not available';
                } else {
                    lineContent = `Failed to fetch source file: ${response.status} ${response.statusText}`;
                }
            } catch (fetchError) {
                lineContent = `Error fetching source file: ${fetchError.message}`;
            }
    
            const errorMessage = `
                Error: ${message}
                Source: ${source}
                Line: ${lineno}
                Column: ${colno}
                Line Content: ${lineContent}
                Error Object: ${error ? error.stack : 'No stack available'}
                BBCode Version: ${bbCodeVersion}
                Show Agency Selector: ${showAgencySelector}
                Show Feature Request Modal: ${showFeatureRequestModal}
                Show Missing Employee Modal: ${showMissingEmployeeModal}
                Show Changelog: ${showChangelog}
                Show Business Card: ${showBusinessCard}
                Show BBCode: ${showBBCode}
                Show Images: ${showImages}
            `;
    
            sendErrorToDiscord(errorMessage, bbCodeVersion); // Send window.onerror to Discord
    
            return true; // Prevent default error handling
        };
    }, [bbCodeVersion, showAgencySelector, showFeatureRequestModal, showMissingEmployeeModal, showChangelog, showBusinessCard, showBBCode, showImages]);
        return (
        <div className="App">
            {showAgencySelector && (
                <div className="modal-overlay">
                    <div className="agency-selector-modal">
                        <div className="modal-header">
                            <h4>Form Selection</h4>
                            <button
                                className="close-button"
                                onClick={() => setShowAgencySelector(false)}
                                aria-label="Close selector"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        {isMobile ? (
                            <Form.Select
                                onChange={(e) => {
                                    handleAgencySelect(parseInt(e.target.value));
                                }}
                            >
                                <option value="">Select a form</option>
                                <option value="24">[Civilian] Medical Release Form | Patient Files</option>
                                <option value="1">Forensic Services</option>
                                <option value="19">ER Protocol</option>
                                <option value="20">General Consultation</option>
                                <option value="22">Commentary Notes</option>
                                <option value="14">Mental Health</option>
                                <option value="6">Physical Evaluation</option>
                                <option value="27">Email Forms</option>
                                <option value="5">Surgical Ops</option>
                                <option value="28">Psychological Evaluation- WIP</option>
                            </Form.Select>
                        ) : (
                            <div className="agency-selector-buttons">
                                <div className="agency-row">
                                    <button
                                        className="agency-select-button"
                                        onClick={() => handleAgencySelect(24)}
                                    >
                                        <img src={Civilian}
                                            className="Center"
                                            alt="Feedback"
                                        />
                                        <span>[Civilian] Medical Release Form | Patient Files </span>
                                    </button>

                                    <button
                                        className="agency-select-button"
                                        onClick={() => handleAgencySelect(1)}
                                    >
                                        <img src={application}
                                            className="Center"
                                            alt="Feedback"
                                        />
                                        <span>Forensic Services </span>
                                    </button>
                                    <button
                                        className="agency-select-button"
                                        onClick={() => handleAgencySelect(19)}
                                    >
                                        <img src={emergency}
                                            className="Center"
                                            alt="Feedback"
                                        />
                                        <span>ER Protocol </span>
                                    </button>
                                    <button
                                        className="agency-select-button"
                                        onClick={() => handleAgencySelect(20)}
                                    >
                                        <img src={empathy}
                                            className="Center"
                                            alt="Feedback"
                                        />
                                        <span>General Consultation </span>
                                    </button>
                                </div>
                                <div className="agency-row">
                                    <button
                                        className="agency-select-button"
                                        onClick={() => handleAgencySelect(22)}
                                    >
                                        <img src={paperwork2}
                                            className="Center"
                                            alt="Feedback"
                                        />
                                        <span>Commentary Notes </span>
                                    </button>

                                    <button
                                        className="agency-select-button"
                                        onClick={() => handleAgencySelect(14)}
                                    >
                                        <img src={psychology}
                                            className="Center"
                                            alt="Feedback"
                                        />
                                        <span> Mental Health </span>
                                    </button>

                                    <button
                                        className="agency-select-button"
                                        onClick={() => handleAgencySelect(6)}
                                    >
                                        <img src={nurse}
                                            className="Center"
                                            alt="Feedback"
                                        />
                                        <span>Physical Evaluation </span>
                                    </button>
                                    <button
                                        className="agency-select-button"
                                        onClick={() => handleAgencySelect(27)}
                                    >
                                        <img src={email}
                                            className="Center"
                                            alt="Feedback"
                                        />
                                        <span>Email Forms </span>
                                    </button>

                                </div>
                                <div className="agency-row">
                                    <button
                                        className="agency-select-button"
                                        onClick={() => handleAgencySelect(5)}
                                    >
                                        <img src={surgeon}
                                            className="Center"
                                            alt="Feedback"
                                        />
                                        <span>Surgical Ops </span>
                                    </button>
                                    <button
                                        className="agency-select-button"
                                        onClick={() => handleAgencySelect(28)}
                                    >
                                        <img src={psychology}
                                            className="Center"
                                            alt="Feedback"
                                        />
                                        <span>Psychological Evaluation </span>
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="hide-selector-option">
                        <input
                        type="checkbox"
                        id="hideSelector"
                        checked={hideAgencySelector}
                        onChange={(e) => {
                            setHideAgencySelector(e.target.checked);
                            setShowAgencySelector(!e.target.checked); // Close the selector when checked
                        }}
                                        />                           
                     <label htmlFor="hideSelector">Don't show this popup again</label>
                        </div>
                    </div>
                </div>
            )}
            <div className="header-info-wrapper">
                <div className="header-info">
                    {commitInfo.date && (
                        <>
                            <span className="version-info">
                                <a href="https://github.com/GTAW-PHMC/forms/tree/gh-pages" target="_blank" rel="noopener noreferrer">
                                    This website was last updated on {commitInfo.date} with version #{commitInfo.sha}</a>
                            </span>
                            <span className="contact-info">
                                Need help? Contact Alyson Frost on <a
                                    href="http://discord.gg/rrzJ4EeHfK"
                                    className="discord-link"
                                >
                                    Discord  <i className="fab fa-discord"></i>
                                </a>❄️❄️
                            </span>
                        </>
                    )}
                </div>
            </div>
            <div className="container">
                <div className="form-container">
                <div className="button-group">

                    <button
                        type="button"
                        className="changelog-button"
                        onClick={() => setShowChangelog(true)}
                    >
                        <i className="fas fa-history"></i>
                        View Changelog
                    </button>
                    <button
                        type="button"
                        className="changelog-button"
                        onClick={() => setShowMissingEmployeeModal(true)}
                        style={{
                            position: 'fixed',
                            bottom: '20px',
                            right: '20px',
                            zIndex: 1000, // Ensure it's above other elements
                        }}
                    >
                        Missing Employee / Coroner?
                    </button>                    <button
                        type="button"
                        className="changelog-button"
                        onClick={() => setShowFeatureRequestModal(true)}
                        style={{
                            position: 'fixed',
                            bottom: '20px',
                            right: '250px',
                            zIndex: 1000, // Ensure it's above other elements
                        }}

                    >
                        Report Bug / Feature Request
                    </button>
                    <button
                        type="button"
                        className="changelog-button"
                        onClick={toggleBusinessCard}
                    >
                        Business Card Tool
                    </button>

</div>
                    {showChangelog && (
                        <div className="modal-overlay">
                            <div className="modal">
                                <div className="modal-header">
                                    <h3>Changelog - Version 1.8.9d - ❄️ Frostbite Update </h3>
                                    <button
                                        className="close-button"
                                        onClick={() => setShowChangelog(false)}
                                        aria-label="Close changelog"
                                    >
                                        <i className="fas fa-times"></i>
                                    </button>
                                </div>
                                <div className="modal-content">
                                    <ul>
                                        <li> Business Cards are here! - Updated to Beta</li>
                                        <li> Disabled Mobile Support for Business Cards</li>
                                        <li> Expanded debugging for Business Cards to track error rates </li>
                                        <li> New names rotated in </li>
                                        <li> Fixed bugs because Mecovy keeps breaking stuff.</li>
                                    </ul>
                                    - frosty
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="button-group">
                        <button
                            type="button"
                            className="changelog-button"
                            onClick={() => window.open('https://phmc.gta.world/', '_blank')}
                        >
                            <i className="fas fa-hospital"></i>
                            PHMC
                        </button>
                        <button
                            className="changelog-button"
                            onClick={toggleAgencySelector}
                        >
                            <i className="fas fa-exchange-alt"></i>
                            Select Form
                        </button>

                        {(bbCodeVersion === 1 || bbCodeVersion === 2 || bbCodeVersion === 18) && (
                            <>
                                <button
                                    className="changelog-button"
                                    onClick={() => setShowPHMCModal(true)}
                                >
                                    <i className="fa fa-laptop"></i>
                                    <span>Coroner Forms </span>
                                </button>

                                {showPHMCModal && (
                                    <div className="modal-overlay" onClick={() => setShowPHMCModal(false)}>
                                        <div className="agency-selector-modal" onClick={e => e.stopPropagation()}>
                                            <div className="modal-header">
                                                <h4>Coroner Forms (3)</h4>
                                                <button
                                                    className="close-button"
                                                    onClick={() => setShowPHMCModal(false)}
                                                    aria-label="Close selector"
                                                >
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            </div>
                                            <div className="agency-selector-buttons">
                                                <div className="agency-row">
                                                    <button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(1)}
                                                    >
                                                        <img src={corpse}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Decedent Services </span>
                                                    </button>
                                                    <button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(2)}
                                                    >
                                                        <img src={email}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Email Generator </span>
                                                    </button>
                                                    <button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(18)}
                                                    >
                                                        <img src={PHMCLogo}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Agency Incidents </span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {(bbCodeVersion === 6 || bbCodeVersion === 7) && (
                            <>
                                <button
                                    className="changelog-button"
                                    onClick={() => setShowPHMCModal(true)}
                                >
                                    <i className="fas fa-exchange-alt"></i>
                                    <span>Switch Physical Evaluation Forms</span>
                                </button>

                                {showPHMCModal && (
                                    <div className="modal-overlay" onClick={() => setShowPHMCModal(false)}>
                                        <div className="agency-selector-modal" onClick={e => e.stopPropagation()}>
                                            <div className="modal-header">
                                                <h4>Select Internal Medicine Consultation Form (2)</h4>
                                                <button
                                                    className="close-button"
                                                    onClick={() => setShowPHMCModal(false)}
                                                    aria-label="Close selector"
                                                >
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            </div>
                                            <div className="agency-selector-buttons">
                                                <div className="agency-row">
                                                    <button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(6)}
                                                    >
                                                        <img src={PHMCLogo}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Physical Evaluation PHMC </span>
                                                    </button>
                                                    <button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(7)}
                                                    >
                                                        <img src={PHMCLogo}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Physical Evaluation PBC </span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                                                {(bbCodeVersion === 28 || bbCodeVersion === 29) && (
                            <>
                                <button
                                    className="changelog-button"
                                    onClick={() => setShowPHMCModal(true)}
                                >
                                    <i className="fas fa-exchange-alt"></i>
                                    <span>Switch Psychological Evaluation Form</span>
                                </button>

                                {showPHMCModal && (
                                    <div className="modal-overlay" onClick={() => setShowPHMCModal(false)}>
                                        <div className="agency-selector-modal" onClick={e => e.stopPropagation()}>
                                            <div className="modal-header">
                                                <h4>Select Psychological Evaluation Form (2)</h4>
                                                <button
                                                    className="close-button"
                                                    onClick={() => setShowPHMCModal(false)}
                                                    aria-label="Close selector"
                                                >
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            </div>
                                            <div className="agency-selector-buttons">
                                                <div className="agency-row">
                                                    <button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(28)}
                                                    >
                                                        <img src={PHMCLogo}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Psychological Evaluation | PHMC </span>
                                                    </button>
                                                    <button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(29)}
                                                    >
                                                        <img src={phmcpaletobay}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Psychological Evaluation | PBC </span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {(bbCodeVersion === 9 || bbCodeVersion === 10 || bbCodeVersion === 12 || bbCodeVersion === 13) && (
                            <>
                                <button
                                    className="changelog-button"
                                    onClick={() => setShowPHMCModal(true)}
                                >
                                    <i className="fa-solid fa-plus"></i>
                                    <span>Gyne and Obs Forms</span>
                                </button>

                                {showPHMCModal && (
                                    <div className="modal-overlay" onClick={() => setShowPHMCModal(false)}>
                                        <div className="agency-selector-modal" onClick={e => e.stopPropagation()}>
                                            <div className="modal-header">
                                                <h4>Gynecology and Obstetrics Forms (4)</h4>
                                                <button
                                                    className="close-button"
                                                    onClick={() => setShowPHMCModal(false)}
                                                    aria-label="Close selector"
                                                >
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            </div>
                                            <div className="agency-selector-buttons">
                                                <div className="agency-row">
                                                    <button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(9)}
                                                    >
                                                        <img src={maternity}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Obstetrics Main File</span>
                                                    </button>
                                                    <button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(10)}
                                                    >
                                                        <img src={obstetrical}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />

                                                        <span>Obstetrics Follow Up</span>
                                                    </button>
                                                    <button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(12)}
                                                    >
                                                        <img src={gyne}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />

                                                        <span>Gynecology Main File</span>
                                                    </button>
                                                    <button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(13)}
                                                    >
                                                        <img src={gynecology}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Gynecology Follow Up</span>
                                                    </button>

                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        {( bbCodeVersion === 20 || bbCodeVersion === 21) && (
                            <>
                                <button
                                    className="changelog-button"
                                    onClick={() => setShowPHMCModal(true)}
                                >
                                    <span>Switch General Consultation Forms </span>
                                </button>

                                {showPHMCModal && (
                                    <div className="modal-overlay" onClick={() => setShowPHMCModal(false)}>
                                        <div className="agency-selector-modal" onClick={e => e.stopPropagation()}>
                                            <div className="modal-header">
                                                <h4>Select General Consultation Form (2)</h4>
                                                <button
                                                    className="close-button"
                                                    onClick={() => setShowPHMCModal(false)}
                                                    aria-label="Close selector"
                                                >
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            </div>
                                            <div className="agency-selector-buttons">
                                                <div className="agency-row">
                                                    <button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(20)}
                                                    >
                                                        <img src={PHMCLogo}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>General Consultation | PHMC </span>
                                                    </button>
                                                    <button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(21)}
                                                    >
                                                        <img src={phmcpaletobay}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>General Consultation | PBC </span>
                                                    </button>

                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {(bbCodeVersion === 8 || bbCodeVersion === 11) && (
                            <>
                                <button
                                    className="changelog-button"
                                    onClick={() => setShowPHMCModal(true)}
                                >
                                    <span>Emergency Medicine Consultation Forms </span>
                                </button>

                                {showPHMCModal && (
                                    <div className="modal-overlay" onClick={() => setShowPHMCModal(false)}>
                                        <div className="agency-selector-modal" onClick={e => e.stopPropagation()}>
                                            <div className="modal-header">
                                                <h4>Select Emergency Medicine Consultation Form (2)</h4>
                                                <button
                                                    className="close-button"
                                                    onClick={() => setShowPHMCModal(false)}
                                                    aria-label="Close selector"
                                                >
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            </div>
                                            <div className="agency-selector-buttons">
                                                <div className="agency-row">
                                                    <button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(8)}
                                                    >
                                                        <img src={PHMCLogo}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Emergency Medicine Consult | NEW FILE </span>
                                                    </button>
                                                    <button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(11)}
                                                    >
                                                        <img src={PHMCLogo}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Emergency Medicine Consult | ADD FILES </span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        {(bbCodeVersion === 22 || bbCodeVersion === 23) && (
                            <>
                                <button
                                    className="changelog-button"
                                    onClick={() => setShowPHMCModal(true)}
                                >
                                    <span>Switch Commentary Note Form </span>
                                </button>

                                {showPHMCModal && (
                                    <div className="modal-overlay" onClick={() => setShowPHMCModal(false)}>
                                        <div className="agency-selector-modal" onClick={e => e.stopPropagation()}>
                                            <div className="modal-header">
                                                <h4>Select Commentary Note Form (2)</h4>
                                                <button
                                                    className="close-button"
                                                    onClick={() => setShowPHMCModal(false)}
                                                    aria-label="Close selector"
                                                >
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            </div>
                                            <div className="agency-selector-buttons">
                                                <div className="agency-row">
                                                    <button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(22)}
                                                    >
                                                        <img src={PHMCLogo}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Commentary Note | PHMC </span>
                                                    </button>
                                                    <button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(23)}
                                                    >
                                                        <img src={phmcpaletobay}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Commentary Note | PBC </span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        {(bbCodeVersion === 14 || bbCodeVersion === 16) && (
                            <>
                                <button
                                    className="changelog-button"
                                    onClick={() => setShowPHMCModal(true)}
                                >
                                    <span>Switch Mental Health Form </span>
                                </button>

                                {showPHMCModal && (
                                    <div className="modal-overlay" onClick={() => setShowPHMCModal(false)}>
                                        <div className="agency-selector-modal" onClick={e => e.stopPropagation()}>
                                            <div className="modal-header">
                                                <h4>Select Mental Health Form (2)</h4>
                                                <button
                                                    className="close-button"
                                                    onClick={() => setShowPHMCModal(false)}
                                                    aria-label="Close selector"
                                                >
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            </div>
                                            <div className="agency-selector-buttons">
                                                <div className="agency-row">
                                                    <button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(14)}
                                                    >
                                                        <img src={PHMCLogo}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Mental Health - PHMC </span>
                                                    </button>
                                                    <button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(16)}
                                                    >
                                                        <img src={phmcpaletobay}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Mental Health | PBC </span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        {(bbCodeVersion === 3 || bbCodeVersion === 24 || bbCodeVersion === 25) && (
                            <>
                                <button
                                    className="changelog-button"
                                    onClick={() => setShowPHMCModal(true)}
                                >
                                    <i className="fas fa-exchange-alt"></i>
                                    <span>Change Civilian Hospital Forms</span>
                                </button>

                                {showPHMCModal && (
                                    <div className="modal-overlay" onClick={() => setShowPHMCModal(false)}>
                                        <div className="agency-selector-modal" onClick={e => e.stopPropagation()}>
                                            <div className="modal-header">
                                                <h4>Select Civilian Forms (3)</h4>
                                                <button
                                                    className="close-button"
                                                    onClick={() => setShowPHMCModal(false)}
                                                    aria-label="Close selector"
                                                >
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            </div>
                                            <div className="agency-selector-buttons">
                                                <div className="agency-row">
                                                    <button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(24)}
                                                    >
                                                        <img src={Civilian}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Civilian - Medical Record Release </span>
                                                    </button>
                                                    <button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(25)}
                                                    >
                                                        <img src={nurse}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Basic Patient File </span>
                                                    </button>
                                                    <button
                                                        className="agency-select-button"
                                                        onClick={() => handleAgencySelect(3)}
                                                    >
                                                        <img src={nurse}
                                                            className="Center"
                                                            alt="Feedback"
                                                        />
                                                        <span>Detailed Patient File </span>
                                                    </button>

                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                    </div>
                    {notification && (
                        <Notification
                            message={notification.message}
                            icon={notification.icon}
                            onDismiss={() => setNotification(null)}
                        />
                    )}
                    <form>
                        {bbCodeVersion === 1 ? (
                            <>
                                <p>The Coroner Report Generated needs to be filled out fully, you can upload images locally or link pictures. </p>
                                <Form.Label>Employee Credentials:</Form.Label>
                                <Select
                                    name="coronerEmployee"
                                    value={coronerGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.coronerEmployee) || null}
                                    onChange={(selectedOption) => handleSelectChange(selectedOption, 'coroner')}
                                    options={coronerGroupedOptions}
                                    isClearable
                                    placeholder="Search or select coroner..."
                                    className={`form-control ${!formData.coronerEmployee ? 'is-invalid' : ''}`}
                                    styles={{
                                        control: (base) => ({
                                            ...base,
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
                                        }),
                                        group: (base) => ({
                                            ...base,
                                            paddingTop: 8,
                                            paddingBottom: 8
                                        }),
                                        groupHeading: (base) => ({
                                            ...base,
                                            color: '#6c757d',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            fontSize: '0.75rem',
                                            marginBottom: 4
                                        })
                                    }}
                                />
                                <FormHelperText></FormHelperText>
                                <Form.Label></Form.Label>
                                <Form.Label>Dispatch Time | Decedent Time of Death</Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control
                                    type="datetime-local"
                                    name="dateTime"
                                    value={formData.dateTime}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.dateTime ? 'is-invalid' : ''}`}
                                />
                                <Form.Control
                                    type="datetime-local"
                                    name="pronouncedTimeOfDeath"
                                    value={formData.pronouncedTimeOfDeath}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.pronouncedTimeOfDeath ? 'is-invalid' : ''}`}
                                />
                                </div>
                                <Form.Select
                                    name="department"
                                    value={formData.department}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.department ? 'is-invalid' : ''}`}
                                >
                                    <option value="" disabled>Select Requesting Agency</option>
                                    <option value="LSFD">LSFD</option>
                                    <option value="LSPD">LSPD</option>
                                    <option value="LSSD">LSSD</option>
                                    <option value="PHMC">PHMC</option>
                                    <option value="SANFIRE">SANFIRE</option>
                                    <option value="SADCR">SADCR</option>
                                    <option value="LSGOV">LSGOV</option>
                                    <option value="911 Call">Emergency 911 Dispatch</option>
                                    <option value="Protech">Protech Security Solutions</option>

                                </Form.Select>

                                <div className="radio-inline-container">
                                    <span className="radio-text">Decedent Name:</span>
                                    <div className="radio-button-group">
                                        <Form.Check
                                            type="radio"
                                            id="johnDoe"
                                            label="   John Doe"
                                            checked={isJohnDoe}
                                            onChange={handleDoeChange('john')}
                                            inline
                                        />
                                        <Form.Check
                                            type="radio"
                                            id="janeDoe"
                                            label="   Jane Doe"
                                            checked={isJaneDoe}
                                            onChange={handleDoeChange('jane')}
                                            inline
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="decedentName"
                                            value={formData.decedentName}
                                            onChange={handleChange}
                                            placeholder="Decedent's IC name"
                                            required
                                            className={`form-control ${!formData.decedentName ? 'is-invalid' : ''}`}
                                        />
                                        <Form.Control
                                        type="text"
                                        name="decedentOOC"
                                        value={formData.decedentOOC}
                                        onChange={handleChange}
                                        placeholder="Decedent's OOC name"
                                        required
                                        className={`form-control ${!formData.decedentOOC ? 'is-invalid' : ''}`}
                                        />
                                    </div>

                                <Form.Select
                                    name="typeOfDeath"
                                    value={formData.typeOfDeath}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.typeOfDeath ? 'is-invalid' : ''}`}
                                >
                                    <option value="..." >Select Type of Death</option>
                                    <option value="PK">PK</option>
                                    <option value="CK">CK</option>
                                </Form.Select>
                                <Form.Control
                                    type="text"
                                    name="placeOfDeath"
                                    value={formData.placeOfDeath}
                                    onChange={handleChange}
                                    placeholder="Place of death"
                                    required
                                    className={`form-control ${!formData.placeOfDeath ? 'is-invalid' : ''}`}
                                />                                
                                <Form.Select
                                    name="mannerOfDeath"
                                    value={formData.mannerOfDeath} // Set default value to "Natural"
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.mannerOfDeath ? 'is-invalid' : ''}`}
                                >
                                    <option value="" disabled>Select Manner of Death</option>
                                    <option value="Natural">Natural - the death resulted from natural causes, such as disease or old age.</option>
                                    <option value="Accident">Accidental - the death resulted from an unintentional or unexpected event, such as a car accident or drug overdose.</option>
                                    <option value="Suicide">Suicide - the death resulted from a self-inflicted injury with the intention to end ones life.</option>
                                    <option value="Homicide">Homicide - the death resulted from the intentional actions of another person, such as a murder, manslaughter and/or legally justified means such as self defense. </option>
                                    <option value="Undetermined">Undetermined - the evidence is insufficient to determine the manner of death</option>
                                </Form.Select>

                                <Form.Control
                                    as="textarea"
                                    name="synopsis"
                                    value={formData.synopsis}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Brief Summary"
                                    required
                                    className={`form-control ${!formData.synopsis ? 'is-invalid' : ''}`}
                                />
                                <Form.Control
                                    type="text"
                                    name="probableCauseOfDeath"
                                    value={formData.probableCauseOfDeath}
                                    onChange={handleChange}
                                    placeholder="Probable cause of death"
                                    required
                                    className={`form-control ${!formData.probableCauseOfDeath ? 'is-invalid' : ''}`}
                                />

                                <Form.Group className="mb-3 upload-container">
                                    <InputGroup>
                                        <Form.Control
                                            as="textarea"
                                            name="scenePhotos"
                                            value={formData.scenePhotos}
                                            onChange={handleChange}
                                            rows="2"
                                            required
                                            className={`form-control ${!formData.scenePhotos ? 'is-invalid' : ''}`}
                                            placeholder="Upload Scene Photos (comma-separated)"
                                            onPaste={(e) => {
                                                console.log('Paste event triggered');
                                                const clipboardData = e.clipboardData || window.clipboardData;
                                                const pastedData = clipboardData.getData('text');
                                                const items = clipboardData.items;

                                                console.log('Pasted content:', pastedData);
                                                console.log('Clipboard items:', items);

                                                let hasImageItem = false;

                                                // Check if pasted content is a URL
                                                const urlRegex = /(https?:\/\/[^\s]+)/g;
                                                const containsUrl = urlRegex.test(pastedData);

                                                console.log('Contains URL:', containsUrl);

                                                // Handle image files from clipboard
                                                for (let i = 0; i < items.length; i++) {
                                                    console.log('Checking item:', items[i].type);
                                                    if (items[i].type.indexOf('image') !== -1) {
                                                        hasImageItem = true;
                                                        const file = items[i].getAsFile();
                                                        handleImageUpload({ target: { files: [file] } }, 'scenePhotos');
                                                        e.preventDefault();
                                                        break;
                                                    }
                                                }

                                                // If it's a URL and not an image file, allow direct paste
                                                if (containsUrl && !hasImageItem) {
                                                    console.log('Processing URL paste');

                                                    // Get current value and cursor position
                                                    const currentValue = formData.scenePhotos || '';
                                                    const cursorPos = e.target.selectionStart;

                                                    console.log('Current value:', currentValue);
                                                    console.log('Cursor position:', cursorPos);

                                                    // Add comma if there's existing content
                                                    const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                                                    const newValue = currentValue.slice(0, cursorPos) +
                                                        (cursorPos > 0 ? separator : '') +
                                                        pastedData +
                                                        currentValue.slice(cursorPos);

                                                    console.log('New value:', newValue);

                                                    // Update form data
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        scenePhotos: newValue
                                                    }));

                                                    e.preventDefault();
                                                } else {
                                                    console.log('No URL detected or image item present');
                                                }
                                            }}
                                        />
                                        <Button
                                            variant="success"
                                            disabled={isUploading}
                                            onClick={() => {
                                                const input = document.createElement('input');
                                                input.type = 'file';
                                                input.accept = 'image/*';
                                                input.multiple = true;
                                                input.onchange = (e) => handleImageUpload(e, 'scenePhotos');
                                                input.click();
                                            }}
                                        >
                                            <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                                            {isUploading ? 'Uploading...' : 'Upload Images'}
                                        </Button>

                                    </InputGroup>
                                    <span className="helper-text">
                                        This supports clipboard uploading, ctrl + V! | Hosted by Imgur! - <a href="https://imgur.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                                    </span>
                                </Form.Group>
                                <Form.Group className="mb-3 upload-container">
                                    <div className="input-group">
                                        <Form.Control
                                            as="textarea"
                                            name="additionalImages"
                                            value={formData.additionalImages}
                                            onChange={handleChange}
                                            rows="2"
                                            required
                                            className={`form-control ${!formData.additionalImages ? 'is-invalid' : ''}`}
                                            placeholder="Morgue Screen, Cinjuries, CDNA Links (comma-separated)"
                                            onPaste={(e) => {
                                                console.log('Paste event triggered');
                                                const clipboardData = e.clipboardData || window.clipboardData;
                                                const pastedData = clipboardData.getData('text');
                                                const items = clipboardData.items;

                                                console.log('Pasted content:', pastedData);
                                                console.log('Clipboard items:', items);

                                                let hasImageItem = false;

                                                // Check if pasted content is a URL
                                                const urlRegex = /(https?:\/\/[^\s]+)/g;
                                                const containsUrl = urlRegex.test(pastedData);

                                                console.log('Contains URL:', containsUrl);

                                                // Handle image files from clipboard
                                                for (let i = 0; i < items.length; i++) {
                                                    console.log('Checking item:', items[i].type);
                                                    if (items[i].type.indexOf('image') !== -1) {
                                                        hasImageItem = true;
                                                        const file = items[i].getAsFile();
                                                        handleImageUpload({ target: { files: [file] } }, 'additionalImages');
                                                        e.preventDefault();
                                                        break;
                                                    }
                                                }

                                                // If it's a URL and not an image file, allow direct paste
                                                if (containsUrl && !hasImageItem) {
                                                    console.log('Processing URL paste');

                                                    // Get current value and cursor position
                                                    const currentValue = formData.additionalImages || '';
                                                    const cursorPos = e.target.selectionStart;

                                                    console.log('Current value:', currentValue);
                                                    console.log('Cursor position:', cursorPos);

                                                    // Add comma if there's existing content
                                                    const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                                                    const newValue = currentValue.slice(0, cursorPos) +
                                                        (cursorPos > 0 ? separator : '') +
                                                        pastedData +
                                                        currentValue.slice(cursorPos);

                                                    console.log('New value:', newValue);

                                                    // Update form data
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        additionalImages: newValue
                                                    }));

                                                    e.preventDefault();
                                                } else {
                                                    console.log('No URL detected or image item present');
                                                }
                                            }}
                                        />
                                        <Button
                                            variant="success"
                                            disabled={isUploading}
                                            onClick={() => {
                                                const input = document.createElement('input');
                                                input.type = 'file';
                                                input.accept = 'image/*';
                                                input.multiple = true;
                                                input.onchange = (e) => handleImageUpload(e, 'additionalImages');
                                                input.click();
                                            }}
                                        >
                                            <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                                            {isUploading ? 'Uploading...' : 'Upload Images'}
                                        </Button>
                                    </div>
                                    <span className="helper-text">
                                    This supports clipboard uploading, ctrl + V! | Hosted by Imgur! - <a href="https://imgur.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                                    </span>
    <label>Morgue Bugs:</label>
                                    <Form.Check
                                        type="checkbox"
                                        id="morgueStatus"
                                        label="       Tick if Morgue Screen is unavailable / broken / inaccesssable"
                                        checked={formData.morgueStatus === 'true'}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            morgueStatus: e.target.checked.toString()
                                        }))}
                                    />
</Form.Group>
                            </>
                        ) : bbCodeVersion === 2 ? (
                            <>
                                <p>This generator prefills most of the forms for you, take a moment to review the BBCode prior to sending! </p>
                                <Form.Label>Employee Credentials:</Form.Label>
                                <Select
                                    name="coronerEmployee"
                                    value={coronerGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.coronerEmployee) || null}
                                    onChange={(selectedOption) => handleSelectChange(selectedOption, 'coroner')}
                                    options={coronerGroupedOptions}
                                    isClearable
                                    placeholder="Search or select coroner..."
                                    className={`form-control ${!formData.coronerEmployee ? 'is-invalid' : ''}`}
                                    styles={{
                                        control: (base) => ({
                                            ...base,
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
                                        }),
                                        group: (base) => ({
                                            ...base,
                                            paddingTop: 8,
                                            paddingBottom: 8
                                        }),
                                        groupHeading: (base) => ({
                                            ...base,
                                            color: '#6c757d',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            fontSize: '0.75rem',
                                            marginBottom: 4
                                        })
                                    }}
                                />
                                <Form.Group className="mb-3">
                                    <Form.Label> <br></br>Officer Name or Badge Number:</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="requestingOfficer"
                                        value={formData.requestingOfficer}
                                        onChange={handleChange}
                                        required
                                        className={`form-control ${!formData.requestingOfficer ? 'is-invalid' : ''}`}
                                        />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Requesting Agency:</Form.Label>
                                    <Form.Select
                                        name="department"
                                        value={formData.department}
                                        onChange={handleChange}
                                        required
                                        className={`form-control ${!formData.department ? 'is-invalid' : ''}`}
                                    >
                                        <option value="" disabled>Select Department</option>
                                        <option value="LSFD">LSFD</option>
                                        <option value="LSPD">LSPD</option>
                                        <option value="LSSD">LSSD</option>
                                        <option value="PHMC">PHMC</option>
                                        <option value="SANFIRE">SANFIRE</option>
                                        <option value="SADCR">SADCR</option>
                                        <option value="LSGOV">LSGOV</option>
                                    </Form.Select>
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>
                                        Coroner Contact Number:
                                    </Form.Label>
                                    <span className="helper-text">
                                        (By default PHMC Landline is added, if you have a work number please add it)
                                    </span>

                                    <Form.Control
                                        type="text"
                                        name="coronerPHNumber"
                                        value={formData.coronerPHNumber}
                                        onChange={handleChange}
                                        required
                                        className={`form-control ${!formData.coronerPHNumber ? 'is-invalid' : ''}`}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Decedent(s) Names:</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="decedentName"
                                        value={formData.decedentName}
                                        onChange={handleChange}
                                        required
                                        className={`form-control ${!formData.decedentName ? 'is-invalid' : ''}`}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Decedent OOC Name:</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="decedentOOC"
                                        value={formData.decedentOOC}
                                        onChange={handleChange}
                                        required
                                        className={`form-control ${!formData.decedentOOC ? 'is-invalid' : ''}`}
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Paste Death Report BBCode:</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="deathReport"
                                        value={formData.deathReport}
                                        onChange={handleChange}
                                        placeholder="Paste Death Report"
                                        rows="2"
                                        className={`form-control ${!formData.deathReport ? 'is-invalid' : ''}`}

                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Additional Reports:</Form.Label>
                                    <div className="reports-container">
                                        {formData.additionalReports.map((report, index) => (
                                            <div key={index} className="report-input">
                                                <Form.Control
                                                    as="textarea"
                                                    value={report}
                                                    onChange={(e) => handleReportChange(index, e.target.value)}
                                                    placeholder="Paste additional coroner report here"
                                                    rows="4"
                                                    className={`form-control ${!formData.additionalReports ? 'is-invalid' : ''}`}
                                                    />
                                                <Button
                                                    variant="danger"
                                                    onClick={() => removeReport(index)}
                                                    className="remove-report-button"
                                                >
                                                    Remove Report
                                                </Button>
                                            </div>
                                        ))}
                                        <div className="email-buttons">
                                            <Button
                                                variant="success"
                                                onClick={addReport}
                                                className="email-button"
                                            >
                                                <i className="fas fa-plus"></i> Add Report
                                            </Button>
                                            <Button
                                                variant="primary"
                                                onClick={parseBBCode}
                                                className="email-button"
                                            >
                                                <i className="fas fa-copy"></i> Parse BBCode
                                            </Button>
                                            <Button
                                                variant="danger"
                                                onClick={clearParsedBBCode}
                                                className="remove-report-button"
                                            >
                                                <i className="fas fa-exchange-alt"></i> Clear BBCode
                                            </Button>
                                        </div>

                                    </div>
                                </Form.Group>
                            </>
                        ) : bbCodeVersion === 3 ? ( // HUGE FUCKING FORM
                        <>
                                                        <Form.Label>Patient ID, leave blank if unsure</Form.Label>
                                <Form.Control
                                            type="text"
                                            name="patientID"
                                            value={formData.patientID}
                                            onChange={handleChange}
                                            placeholder="Patient ID  (Optional)"
                                            className={`form-control ${!formData.patientID ? 'is-invalid' : ''}`}

                                        />
                                <Form.Label>Title / Patient Name Name  / Date of Birth</Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Select
                                    name="patientTitle"
                                    value={formData.patientTitle}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.patientTitle ? 'is-invalid' : ''}`}
                                >
                                    <option value="" disabled>Title</option>
                                    {patientTitle.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </Form.Select>
                                        <Form.Control
                                            type="text"
                                            name="patientName"
                                            value={formData.patientName}
                                            onChange={handleChange}
                                            placeholder="Patient Name"
                                            required
                                            className={`form-control ${!formData.patientName ? 'is-invalid' : ''}`}

                                        />

                                        <Form.Control
                                            type="date"
                                            name="patientDateOfBirth"
                                            value={formData.patientDateOfBirth}
                                            onChange={handleChange}
                                            placeholder="Date of Birth"
                                            required
                                            className={`form-control ${!formData.patientDateOfBirth ? 'is-invalid' : ''}`}

                                        />
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <Form.Control
                                            type="text"
                                            name="patientAddress"
                                            value={formData.patientAddress}
                                            onChange={handleChange}
                                            placeholder="Patient Home Address"
                                            required
                                            className={`form-control ${!formData.patientAddress ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientGender"
                                            value={formData.patientGender}
                                            onChange={handleChange}
                                            placeholder="Patient Gender"
                                            required
                                            className={`form-control ${!formData.patientGender ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientRace"
                                            value={formData.patientRace}
                                            onChange={handleChange}
                                            placeholder="Patient Race"
                                            required
                                            className={`form-control ${!formData.patientRace ? 'is-invalid' : ''}`}

                                        />

                                    </div>

                                    <div className="input-group">                                                               
                                 <Form.Control
                                            type="text"
                                            name="patientPH"
                                            value={formData.patientPH}
                                            onChange={handleChange}
                                            placeholder="Patient Phone Number"
                                            required
                                            className={`form-control ${!formData.patientPH ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientDiscord"
                                            value={formData.patientDiscord}
                                            onChange={handleChange}
                                            placeholder="(( Patient Discord ID )) "
                                            required
                                            className={`form-control ${!formData.patientDiscord ? 'is-invalid' : ''}`}

                                        />
                                    </div>
                                    <Form.Label>Emergency Contact Information </Form.Label>

                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="patientEmergencyContact"
                                            value={formData.patientEmergencyContact}
                                            onChange={handleChange}
                                            placeholder="Emergency Contact Full Name"
                                            required
                                            className={`form-control ${!formData.patientEmergencyContact ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientEmergencyContactRelation"
                                            value={formData.patientEmergencyContactRelation}
                                            onChange={handleChange}
                                            placeholder="Emergency Contact Relation to Patient"
                                            required
                                            className={`form-control ${!formData.patientEmergencyContactRelation ? 'is-invalid' : ''}`}

                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="patientEmergencyContactNumber"
                                            value={formData.patientEmergencyContactNumber}
                                            onChange={handleChange}
                                            placeholder="Emergency Contact Contact Number"
                                            required
                                            className={`form-control ${!formData.patientEmergencyContactNumber ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientEmergencyContactDiscord"
                                            value={formData.patientEmergencyContactDiscord}
                                            onChange={handleChange}
                                            placeholder="(( Patient Emergency Contact Discord )) "
                                            required
                                            className={`form-control ${!formData.patientEmergencyContactDiscord ? 'is-invalid' : ''}`}

                                        />
                                    </div>

                                <Form.Label>Medical History </Form.Label>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Select
                                    name="patientBloodType"
                                    value={formData.patientBloodType || ""}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.patientBloodType ? 'is-invalid' : ''}`}
                                >
                                    <option value="" disabled>Patient Blood Type</option>
                                    {patientBloodType.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </Form.Select>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="patientAllergies"
                                            value={formData.patientAllergies}
                                            onChange={handleChange}
                                            placeholder="Patient Known Allergies"
                                            required
                                            className={`form-control ${!formData.patientAllergies ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientCurrentMedicine"
                                            value={formData.patientCurrentMedicine}
                                            onChange={handleChange}
                                            placeholder="Patient Current Medicine"
                                            required
                                            className={`form-control ${!formData.patientCurrentMedicine ? 'is-invalid' : ''}`}

                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="patientChronicDiseases"
                                            value={formData.patientChronicDiseases}
                                            onChange={handleChange}
                                            placeholder="Patient Chronic Conditions"
                                            required
                                            className={`form-control ${!formData.patientChronicDiseases ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientNotes"
                                            value={formData.patientNotes}
                                            onChange={handleChange}
                                            placeholder="Patient Traumas & Injuries"
                                            required
                                            className={`form-control ${!formData.patientNotes ? 'is-invalid' : ''}`}

                                        />
                                    </div>
                                        <Form.Label>Mental Health History </Form.Label>

                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <Form.Control
                                            type="text"
                                            name="patientMental"
                                            value={formData.patientMental}
                                            onChange={handleChange}
                                            placeholder="Diagnosed Mental Health Conditions"
                                            required
                                            className={`form-control ${!formData.patientAddress ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientTherapy"
                                            value={formData.patientTherapy}
                                            onChange={handleChange}
                                            placeholder="Therapies & Counseling"
                                            required
                                            className={`form-control ${!formData.patientTherapy ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientTriggers"
                                            value={formData.patientTriggers}
                                            onChange={handleChange}
                                            placeholder="Triggers or Sensors"
                                            required
                                            className={`form-control ${!formData.patientTriggers ? 'is-invalid' : ''}`}

                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                            <Form.Control
                                            type="text"
                                            name="patientSupport"
                                            value={formData.patientSupport}
                                            onChange={handleChange}
                                            placeholder="Support & Coping Systems"
                                            required
                                            className={`form-control ${!formData.patientSupport ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientHarm"
                                            value={formData.patientHarm}
                                            onChange={handleChange}
                                            placeholder="Self-Harm History or Tendencies"
                                            required
                                            className={`form-control ${!formData.patientHarm ? 'is-invalid' : ''}`}

                                        />
                                    </div>
                                    <Form.Label>Family Medical History </Form.Label>

                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                        type="text"
                                        name="patientFam"
                                        value={formData.patientFam}
                                        onChange={handleChange}
                                        placeholder="Immediate Family Members"
                                        required
                                        className={`form-control ${!formData.patientFam ? 'is-invalid' : ''}`}

                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientGenetic"
                                        value={formData.patientGenetic}
                                        onChange={handleChange}
                                        placeholder="Known Genetic Conditions"
                                        required
                                        className={`form-control ${!formData.patientGenetic ? 'is-invalid' : ''}`}

                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientFamSocial"
                                        value={formData.patientFamSocial}
                                        onChange={handleChange}
                                        placeholder="Family Social History"
                                        required
                                        className={`form-control ${!formData.patientFamSocial ? 'is-invalid' : ''}`}

                                    />
                                    </div>
                                    <Form.Label>Social Status </Form.Label>

                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Select
                                    name="maritalStatus"
                                    value={formData.maritalStatus}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.maritalStatus ? 'is-invalid' : ''}`}
                                >
                                    <option value="" disabled>Marital Status</option>
                                    {maritalStatus.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </Form.Select>
                                <Form.Select
                                    name="numberChildren"
                                    value={formData.numberChildren}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.numberChildren ? 'is-invalid' : ''}`}
                                >
                                    <option value="" disabled>Number of Children</option>
                                    {numberChildren.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </Form.Select>
                                    <Form.Control
                                        type="text"
                                        name="patientReligion"
                                        value={formData.patientReligion}
                                        onChange={handleChange}
                                        placeholder="Patient's Religion"
                                        required
                                        className={`form-control ${!formData.patientReligion ? 'is-invalid' : ''}`}
                                    />
                                    <Form.Select
                                    name="financialStatus"
                                    value={formData.financialStatus}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.financialStatus ? 'is-invalid' : ''}`}
                                >
                                    <option value="" disabled>Income Bracket</option>
                                    {financialStatus.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </Form.Select>
                                    </div>
                                    <Form.Label>Lifestyle Information </Form.Label>

                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <Form.Control
                                            type="text"
                                            name="patientSmoker"
                                            value={formData.patientSmoker}
                                            onChange={handleChange}
                                            placeholder="Patient Smoker Status"
                                            required
                                            className={`form-control ${!formData.patientSmoker ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientAlcohol"
                                            value={formData.patientAlcohol}
                                            onChange={handleChange}
                                            placeholder="Patient Alcohol Use"
                                            required
                                            className={`form-control ${!formData.patientAlcohol ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientDrugs"
                                            value={formData.patientDrugs}
                                            onChange={handleChange}
                                            placeholder="Other Substance Usage"
                                            required
                                            className={`form-control ${!formData.patientDrugs ? 'is-invalid' : ''}`}

                                        />
                                            <Form.Control
                                            type="text"
                                            name="patientExercise"
                                            value={formData.patientExercise}
                                            onChange={handleChange}
                                            placeholder="Patient Exercise Habits"
                                            required
                                            className={`form-control ${!formData.patientExercise ? 'is-invalid' : ''}`}

                                        />

                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="patientDiet"
                                            value={formData.patientDiet}
                                            onChange={handleChange}
                                            placeholder="Patient Dietary Information"
                                            required
                                            className={`form-control ${!formData.patientDiet ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientSleep"
                                            value={formData.patientSleep}
                                            onChange={handleChange}
                                            placeholder="Patient Sleeping Patterns"
                                            required
                                            className={`form-control ${!formData.patientSleep ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientSexLife"
                                            value={formData.patientSexLife}
                                            onChange={handleChange}
                                            placeholder="Patient Sexual Health"
                                            required
                                            className={`form-control ${!formData.patientSexLife ? 'is-invalid' : ''}`}

                                        />

                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="patientJobRisks"
                                            value={formData.patientJobRisks}
                                            onChange={handleChange}
                                            placeholder="Patient Job Risks"
                                            required
                                            className={`form-control ${!formData.patientJobRisks ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientHazards"
                                            value={formData.patientHazards}
                                            onChange={handleChange}
                                            placeholder="Patient Occupational Hazards"
                                            required
                                            className={`form-control ${!formData.patientHazards ? 'is-invalid' : ''}`}
                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientOther"
                                            value={formData.patientOther}
                                            onChange={handleChange}
                                            placeholder="Other Information & Preferences"
                                            required
                                            className={`form-control ${!formData.patientOther ? 'is-invalid' : ''}`}
                                        />

                                        </div>
                                        <Form.Label>Advanced Directives </Form.Label>

                                        <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Select
                                        name="dnr"
                                        value={formData.dnr}
                                        onChange={handleChange}
                                        required
                                        className={`form-control ${!formData.dnr ? 'is-invalid' : ''}`}
                                        >
                                        <option value="" disabled>Living Will</option>
                                        {dnr.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                        </Form.Select>
                                        <Form.Select
                                        name="attorney"
                                        value={formData.attorney}
                                        onChange={handleChange}
                                        required
                                        className={`form-control ${!formData.attorney ? 'is-invalid' : ''}`}
                                        >
                                        <option value="" disabled>Healthcare Power of Attorney</option>
                                        {attorney.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                        </Form.Select>
                                        <Form.Select
                                        name="dnrOrder"
                                        value={formData.dnrOrder}
                                        onChange={handleChange}
                                        required
                                        className={`form-control ${!formData.dnrOrder ? 'is-invalid' : ''}`}
                                        >
                                        <option value="" disabled>Do Not Resuscitate Order </option>
                                        {dnrOrder.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                        </Form.Select>
                                        </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                {formData.dnr === 'other' && (
                                    <Form.Control
                                    type="text"
                                    name="dnrOther"
                                    value={formData.dnrOther}
                                    onChange={handleChange}
                                    placeholder="dnrOther"
                                    required
                                    className="form-control"
                                    />
                                )}

                                        {formData.attorney === 'Yes' && (
                                    <Form.Control
                                    type="text"
                                    name="attorneyName"
                                    value={formData.attorneyName}
                                    onChange={handleChange}
                                    placeholder="attorneyName"
                                    required
                                    className="form-control"
                                    />
                                )}
                                    {formData.attorney === 'Yes' && (
                                    <Form.Control
                                    type="text"
                                    name="attorneyRelation"
                                    value={formData.attorneyRelation}
                                    onChange={handleChange}
                                    placeholder="attorneyRelation"
                                    required
                                    className="form-control"
                                    />
                                )}
                                    {formData.attorney === 'Yes' && (
                                    <Form.Control
                                    type="text"
                                    name="attorneyPH"
                                    value={formData.attorneyPH}
                                    onChange={handleChange}
                                    placeholder="attorneyPH"
                                    required
                                    className="form-control"
                                    />
                                )}
                                        </div>
                                        <Form.Label>Date and Proof of Payment </Form.Label>

                                        <Form.Control
                                            type="date"
                                            name="date"
                                            value={formData.date}
                                            onChange={handleChange}
                                            placeholder="date"
                                            required
                                            className={`form-control ${!formData.date ? 'is-invalid' : ''}`}
                                        />
                                    <Form.Control
                                    type="text"
                                    name="decedentOOC"
                                    value={formData.decedentOOC}
                                    onChange={handleChange}
                                    placeholder="Proof of Payment URL"
                                    required
                                    className="form-control"
                                    />


                                </>
                        ) : bbCodeVersion === 4 ? (
                            // Dental Consultation fields
                            <>
                                <p>The generated form must be used and added to the file for each medical appointment, follow the others.</p>
                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        handleChange({
                                            target: {
                                                name: 'phmcEmployee',
                                                value: selectedOption?.value || ''
                                            }
                                        });
                                        if (selectedOption) {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: selectedOption.signature || ''
                                            }));
                                        } else {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: ''
                                            }));
                                        }
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"  // Match Bootstrap styling
                                    styles={{
                                        control: (base) => ({
                                            ...base,
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
                                        }),
                                        group: (base) => ({
                                            ...base,
                                            paddingTop: 8,
                                            paddingBottom: 8
                                        }),
                                        groupHeading: (base) => ({
                                            ...base,
                                            color: '#6c757d',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            fontSize: '0.75rem',
                                            marginBottom: 4
                                        })
                                    }}
                                />
                                <Form.Label></Form.Label>
                                <Form.Control
                                    type="text"
                                    name="phmcSignature"
                                    value={formData.phmcSignature}
                                    onChange={handleChange}
                                    placeholder="Employee Signature"
                                    required
                                />

                                <Form.Group className="mb-3">
                                    <Form.Label>Patient Information</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="PatientMedicalRecord"
                                        value={formData.PatientMedicalRecord}
                                        onChange={handleChange}
                                        placeholder="Medical Record Number"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="PatientName"
                                        value={formData.PatientName}
                                        onChange={handleChange}
                                        placeholder="Patient Full Name"
                                        required
                                    />
                                    <Form.Text className="text-muted">
                                        Patient's date of birth
                                    </Form.Text>
                                    <Form.Control
                                        type="date"
                                        name="patientDateofBirth"
                                        value={formData.patientDateofBirth}
                                        onChange={handleChange}
                                        placeholder="Date of Birth"
                                        required
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Physical Assessment</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientWeight"
                                        value={formData.patientWeight}
                                        onChange={handleChange}
                                        placeholder="Weight"
                                        required
                                    />
                                    <Form.Select
                                        name="patientChewing"
                                        value={formData.patientChewing}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="">Select Chewing Problems</option>
                                        <option value="No Issues">No Issues</option>
                                        <option value="Mild Difficulty">Mild Difficulty</option>
                                        <option value="Moderate Difficulty">Moderate Difficulty</option>
                                        <option value="Severe Difficulty">Severe Difficulty</option>
                                    </Form.Select>
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Priority Classification</Form.Label>
                                    <Form.Label>Priority Classification</Form.Label>
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Medications</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="patientMedicine"
                                        value={formData.patientMedicine}
                                        onChange={handleChange}
                                        placeholder="Current Medications"
                                        rows="2"
                                    />
                                    <Form.Control
                                        as="textarea"
                                        name="patientNewMedicine"
                                        value={formData.patientNewMedicine}
                                        onChange={handleChange}
                                        placeholder="Prescribed Medications"
                                        rows="2"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Diagnosis & Treatment</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="patientDiagnosis"
                                        value={formData.patientDiagnosis}
                                        onChange={handleChange}
                                        placeholder="Diagnosis"
                                        rows="3"
                                        required
                                    />
                                    <Form.Control
                                        as="textarea"
                                        name="patientTreatment"
                                        value={formData.patientTreatment}
                                        onChange={handleChange}
                                        placeholder="Treatment Plan"
                                        rows="3"
                                        required
                                    />
                                    <Form.Control
                                        as="textarea"
                                        name="patientPrescription"
                                        value={formData.patientPrescription}
                                        onChange={handleChange}
                                        placeholder="Prescriptions"
                                        rows="2"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Consultation Summary</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="patientSummary"
                                        value={formData.patientSummary}
                                        onChange={handleChange}
                                        placeholder="Summary of Consultation"
                                        rows="4"
                                        required
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Appointment Date</Form.Label>
                                    <Form.Control
                                        type="date"
                                        name="date"
                                        value={formData.date}
                                        onChange={handleChange}
                                        required
                                    />
                                </Form.Group>
                            </>
                        ) : bbCodeVersion === 5 ? (
                            <>
                                <p>The FORM below must be used and added to the file for each surgery appointment, following the others.</p>
                                <Form.Label>Patient ID, leave blank if unsure</Form.Label>
                                <Form.Control
                                            type="text"
                                            name="patientID"
                                            value={formData.patientID}
                                            onChange={handleChange}
                                            placeholder="Patient ID  (Optional)"
                                            className={`form-control ${!formData.patientID ? 'is-invalid' : ''}`}

                                        />

                                    <Form.Label>Appointment Date</Form.Label>
                                    <Form.Control
                                        type="date"
                                        name="date"
                                        value={formData.date}
                                        onChange={handleChange}
                                        className={`form-control ${!formData.date ? 'is-invalid' : ''}`}

                                        required
                                    />

                                <div className="radio-inline-container">
                                <span className="radio-text">Role:</span>
                                    <Form.Check
                                        type="radio"
                                        id="doctorRank"
                                        label="   Doctor"
                                        checked={isDoctor}
                                        onChange={handlePHMCRank('doctor')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="nurseRank"
                                        label="   Nurse"
                                        checked={isNurse}
                                        onChange={handlePHMCRank('nurse')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="psychRank"
                                        label="   Psychiatrist"
                                        checked={isPsych}
                                        onChange={handlePHMCRank('psych')}
                                        inline
                                    /> 
                                                                        <Form.Check
                                        type="radio"
                                        id="surgeonRank"
                                        label="   Surgeon"
                                        checked={isSurgeon}
                                        onChange={handlePHMCRank('surgeon')}
                                        inline
                                    /> 

                                    </div>
                                <Form.Label></Form.Label>

 
                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        // eslint-disable-next-line no-unused-vars
                                        const lastName = selectedOption ? selectedOption.lastName : '';
                                        setFormData(prev => ({
                                            ...prev,
                                            phmcEmployee: selectedOption ? selectedOption.value : '',
                                            lastName: selectedOption ? selectedOption.lastName : '' // Use lastName from the selected option
                                        }));
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select Surgeon..."
                                    className="form-control"
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
                                <Form.Label></Form.Label>

                                <Select
                                    isMulti
                                    name="extraStaff"
                                    options={phmcGroupedOptions.map(group => ({
                                        label: group.label,
                                        options: group.options.map(option => ({ value: option.value, label: option.label }))
                                    }))}
                                    value={Array.isArray(formData.extraStaff)
                                        ? formData.extraStaff.map(staff => ({ value: staff, label: staff }))
                                        : []}
                                    onChange={(selectedOptions) => {
                                        const selectedValues = selectedOptions ? selectedOptions.map(option => option.value) : [];
                                        handleChange({
                                            target: {
                                                name: 'extraStaff',
                                                value: selectedValues
                                            }
                                        });
                                    }}
                                    className="form-control"
                                    placeholder="Enter staff present (( Leave empty if none)  )) "
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
                                <Form.Label></Form.Label>
                                    <Form.Label>Surgical Inquiry   </Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="surgeryProcedures"
                                        value={formData.surgeryProcedures}
                                        onChange={handleChange}
                                        placeholder="Name of the procedure	"
                                        required
                                    />

                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Select
                                    name="patientConsentOption"
                                    value={formData.patientConsentOption}
                                    onChange={(e) => {
                                        const selectedType = e.target.value;
                                        setFormData(prev => ({
                                            ...prev,
                                            patientConsentOption: selectedType,
                                            patientConsentYes: selectedType === 'Yes' ? prev.patientConsentYes : '',
                                            patientConsentNo: selectedType === 'No' ? prev.patientConsentNo : '',
                                        }));
                                    }}
                                    required
                                    className={`form-control ${!formData.patientConsentOption ? 'is-invalid' : ''}`}
                                >
                                    <option value="" disabled>Patient Consented?</option>
                                    {patientConsent.map((option) => (
                                        <option key={option.value} value={option.value}>{option.value}</option>
                                    ))}
                                </Form.Select>        
                                <Form.Select
                                    name="patientComplicationOptions"
                                    value={formData.patientComplicationOptions}
                                    onChange={(e) => {
                                        const selectedType = e.target.value;
                                        setFormData(prev => ({
                                            ...prev,
                                            patientComplicationOptions: selectedType,
                                            patientComplicationsYes: selectedType === 'Yes' ? prev.patientComplicationsYes : '',
                                            patientComplicationsNo: selectedType === 'No' ? prev.patientComplicationsNo : '',
                                        }));
                                    }}
                                    required
                                    className={`form-control ${!formData.patientComplicationOptions ? 'is-invalid' : ''}`}
                                >
                                    <option value="" disabled>Surgery Complications?</option>
                                    {complications.map((option) => (
                                        <option key={option.value} value={option.value}>{option.value}</option>
                                    ))}
                                </Form.Select>
                                <Form.Select
                                    name="procedureGoodOptions"
                                    value={formData.procedureGoodOptions}
                                    onChange={(e) => {
                                        const selectedType = e.target.value;
                                        setFormData(prev => ({
                                            ...prev,
                                            procedureGoodOptions: selectedType,
                                            procedureGoodYes: selectedType === 'Yes' ? prev.procedureGoodYes : '',
                                            procedureGoodNo: selectedType === 'No' ? prev.procedureGoodNo : '',
                                        }));
                                    }}
                                    required
                                    className={`form-control ${!formData.procedureGoodOptions ? 'is-invalid' : ''}`}
                                >
                                    <option value="" disabled>Procedure Good?</option>
                                    {procedureGood.map((option) => (
                                        <option key={option.value} value={option.value}>{option.value}</option>
                                    ))}
                                </Form.Select>
                                </div>

                                    <Form.Label> Post-Anesthesia Report</Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Control
                                        as="textarea"
                                        name="patientSummaryConsultation"
                                        value={formData.patientSummaryConsultation}
                                        onChange={handleChange}
                                        placeholder="Summary of Consultation"
                                        rows="4"
                                        required
                                        className={`form-control ${!formData.patientSummaryConsultation ? 'is-invalid' : ''}`}
                                    />
                                    <Form.Control
                                        as="textarea"
                                        name="patientAddress"
                                        value={formData.patientAddress}
                                        onChange={handleChange}
                                        rows="4"
                                        required
                                        className={`form-control ${!formData.patientAddress ? 'is-invalid' : ''}`}
                                        placeholder="Post-Operative Anesthesia Details	"
                                    /></div>
                                    <Form.Label> Summary of Surgical Procedure</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="patientSummary"
                                        value={formData.patientSummary}
                                        onChange={handleChange}
                                        rows="4"
                                        required
                                        className={`form-control ${!formData.patientSummary ? 'is-invalid' : ''}`}
                                        placeholder="Summary of Surgical Procedure	"
                                    />
                            </>
                        ) : bbCodeVersion === 6 ? ( // generatePhysEvalInternalMed
                            <>
                                <p>The FORM below must be used and added to the file for each medical appointment, following the others.</p>
                                <p> This form contains various small cosmetic issues, they'll be solved in the coming week(S)</p>
                                <Form.Label>Patient ID | Date:</Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>

                                <Form.Control
                                    type="text"
                                    name="patientID"
                                    value={formData.patientID}
                                    onChange={handleChange}
                                    placeholder="Patient ID"
                                    required
                                    className="form-control"
                                />

                                <Form.Control
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    className="form-control"
                                    
                                /> </div>

                                <div className="radio-inline-container">

                                    <span className="radio-text">Role:</span>
                                    <Form.Check
                                        type="radio"
                                        id="doctorRank"
                                        label="   Doctor"
                                        checked={isDoctor}
                                        onChange={handlePHMCRank('doctor')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="nurseRank"
                                        label="   Nurse"
                                        checked={isNurse}
                                        onChange={handlePHMCRank('nurse')}
                                        inline
                                    />
                                      </div>
                                <Form.Label></Form.Label>
                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        // eslint-disable-next-line no-unused-vars
                                        const lastName = selectedOption ? selectedOption.lastName : '';
                                        setFormData(prev => ({
                                            ...prev,
                                            phmcEmployee: selectedOption ? selectedOption.value : '',
                                            lastName: selectedOption ? selectedOption.lastName : '' // Use lastName from the selected option
                                        }));
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"
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
                                <Form.Label></Form.Label>


                                    <Form.Label>Patient Measurements</Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>

                                    <Form.Control
                                        type="text"
                                        name="patientHeight"
                                        value={formData.patientHeight}
                                        onChange={handleChange}
                                        placeholder="Height"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientWeight"
                                        value={formData.patientWeight}
                                        onChange={handleChange}
                                        placeholder="Weight"
                                    />

                                    <Form.Select
                                        name="BodyMassIndex"
                                        value={formData.BodyMassIndex}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                BodyMassIndex: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Body Mass Index</option>
                                        {BodyMassIndex.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select></div>


                                    <Form.Label>Vitals</Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Select
                                        name="vitals"
                                        value={formData.vitals}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                vitals: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Select Temperature</option>
                                        {vitals.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="heartRate"
                                        value={formData.heartRate}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                heartRate: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Select Heart Rate</option>
                                        {heartRate.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="breathing"
                                        value={formData.breathing}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                breathing: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Breathing</option>
                                        {breathing.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="bloodPressure"
                                        value={formData.bloodPressure}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                bloodPressure: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Blood Pressure</option>
                                        {bloodPressure.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select></div>

                                <Form.Group className="mb-3">
                                    <Form.Label>Anamnesis</Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Select
                                        name="patientJob"
                                        value={formData.patientJob}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                patientJob: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Patient Job</option>
                                        {patientJob.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="patientJobRisks"
                                        value={formData.patientJobRisks}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                patientJobRisks: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Job Risks (Optional) </option>
                                        {patientJobRisks.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="patientAllergiesRisk"
                                        value={formData.patientAllergiesRisk}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                patientAllergiesRisk: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Patient Allergies Risk</option>
                                        {patientAllergiesRisk.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
</div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    {formData.patientJob === 'Yes' && (
                                    <Form.Control
                                    type="text"
                                    name="patientCareer"
                                    value={formData.patientCareer}
                                    onChange={handleChange}
                                    placeholder="Patient Job"
                                    required
                                    className="form-control"
                                    />
                                )}
                                    {formData.patientJob === 'No' && (
                                    <Form.Control
                                    type="text"
                                    name="patientCareer"
                                    value={formData.patientCareer}
                                    onChange={handleChange}
                                    placeholder="Patient Job No"
                                    required
                                    className="form-control"
                                    />
                                )} 
                                    {formData.patientJobRisks === 'Yes' && (
                                    <Form.Control
                                    type="text"
                                    name="careerRisks"
                                    value={formData.careerRisks}
                                    onChange={handleChange}
                                    placeholder="Patient Job Risks"
                                    required
                                    className="form-control"
                                    />
                                )} 
                                  {formData.patientAllergiesRisk === 'Yes' && (
                                    <Form.Control
                                    type="text"
                                    name="patientAllergies"
                                    value={formData.patientAllergies}
                                    onChange={handleChange}
                                    placeholder="Patient Job Risks"
                                    required
                                    className="form-control"
                                    />
                                )} 

                                </div>
                                
                                <div style={{ display: 'flex', gap: '10px' }}>

                                <Form.Select
                                        name="patientMedicineRegular"
                                        value={formData.patientMedicineRegular}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                patientMedicineRegular: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Patient Medicine Regular?</option>
                                        {patientMedicineRegular.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="patientOther"
                                        value={formData.patientOther}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                patientOther: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Patient Imparements?</option>
                                        {patientOther.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="predisposition"
                                        value={formData.predisposition}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                predisposition: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Predisposition</option>
                                        {predisposition.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select></div>
                                    <div style={{ display: 'flex', gap: '10px' }}>

                                    {formData.patientMedicineRegular === 'Yes' && (
                                    <Form.Control
                                    type="text"
                                    name="patientMedicine"
                                    value={formData.patientMedicine}
                                    onChange={handleChange}
                                    placeholder="patientMedicine"
                                    required
                                    className="form-control"
                                    />
                                )} 
                                    {formData.patientOther === 'Yes' && (
                                    <Form.Control
                                    type="text"
                                    name="patientImpairments"
                                    value={formData.patientImpairments}
                                    onChange={handleChange}
                                    placeholder="patientImpairments"
                                    required
                                    className="form-control"
                                    />
                                )} </div>
                                        <Form.Control
                                        as="textarea"
                                        name="patientSummary"
                                        value={formData.patientSummary}
                                        onChange={handleChange}
                                        rows="4"
                                        required
                                        className={`form-control ${!formData.patientSummary ? 'is-invalid' : ''}`}
                                        placeholder="Assessment Statement"
                                    />
                                </Form.Group>
                            </>
                                                    ) : bbCodeVersion === 7 ? ( // generatePhysEvalInternalMed
                                                        <>
                                                            <p>The FORM below must be used and added to the file for each medical appointment, following the others.</p>
                                                            <Form.Label>Patient ID | Date:</Form.Label>
                                                            <div style={{ display: 'flex', gap: '10px' }}>
                            
                                                            <Form.Control
                                                                type="text"
                                                                name="patientID"
                                                                value={formData.patientID}
                                                                onChange={handleChange}
                                                                placeholder="Patient ID"
                                                                required
                                                                className="form-control"
                                                            />
                            
                                                            <Form.Control
                                                                type="date"
                                                                name="date"
                                                                value={formData.date}
                                                                onChange={handleChange}
                                                                required
                                                                className="form-control"
                                                                
                                                            /> </div>
                            
                                                            <div className="radio-inline-container">
                            
                                                                <span className="radio-text">Role:</span>
                                                                <Form.Check
                                                                    type="radio"
                                                                    id="doctorRank"
                                                                    label="   Doctor"
                                                                    checked={isDoctor}
                                                                    onChange={handlePHMCRank('doctor')}
                                                                    inline
                                                                />
                                                                <Form.Check
                                                                    type="radio"
                                                                    id="nurseRank"
                                                                    label="   Nurse"
                                                                    checked={isNurse}
                                                                    onChange={handlePHMCRank('nurse')}
                                                                    inline
                                                                />
                                                                  </div>
                                                            <Form.Label></Form.Label>
                                                            <Form.Label>Employee Credentials:</Form.Label>
                            
                                                            <Select
                                                                name="phmcEmployee"
                                                                value={phmcGroupedOptions
                                                                    .flatMap(group => group.options)
                                                                    .find(option => option.value === formData.phmcEmployee) || null}
                                                                onChange={(selectedOption) => {
                                                                    // eslint-disable-next-line no-unused-vars
                                                                    const lastName = selectedOption ? selectedOption.lastName : '';
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        phmcEmployee: selectedOption ? selectedOption.value : '',
                                                                        lastName: selectedOption ? selectedOption.lastName : '' // Use lastName from the selected option
                                                                    }));
                                                                }}
                                                                options={phmcGroupedOptions}
                                                                isClearable
                                                                placeholder="Search or select doctor..."
                                                                className="form-control"
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
                                                            <Form.Label></Form.Label>
                            
                            
                                                                <Form.Label>Patient Measurements</Form.Label>
                                                                <div style={{ display: 'flex', gap: '10px' }}>
                            
                                                                <Form.Control
                                                                    type="text"
                                                                    name="patientHeight"
                                                                    value={formData.patientHeight}
                                                                    onChange={handleChange}
                                                                    placeholder="Height"
                                                                />
                                                                <Form.Control
                                                                    type="text"
                                                                    name="patientWeight"
                                                                    value={formData.patientWeight}
                                                                    onChange={handleChange}
                                                                    placeholder="Weight"
                                                                />
                            
                                                                <Form.Select
                                                                    name="BodyMassIndex"
                                                                    value={formData.BodyMassIndex}
                                                                    onChange={(e) => {
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            BodyMassIndex: e.target.value
                                                                        }));
                                                                    }}
                                                                    className="form-control"
                                                                >
                                                                    <option value="" disabled>Body Mass Index</option>
                                                                    {BodyMassIndex.map((option) => (
                                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                                    ))}
                                                                </Form.Select></div>
                            
                            
                                                                <Form.Label>Vitals</Form.Label>
                                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                                <Form.Select
                                                                    name="vitals"
                                                                    value={formData.vitals}
                                                                    onChange={(e) => {
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            vitals: e.target.value
                                                                        }));
                                                                    }}
                                                                    className="form-control"
                                                                >
                                                                    <option value="" disabled>Select Temperature</option>
                                                                    {vitals.map((option) => (
                                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                                    ))}
                                                                </Form.Select>
                                                                <Form.Select
                                                                    name="heartRate"
                                                                    value={formData.heartRate}
                                                                    onChange={(e) => {
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            heartRate: e.target.value
                                                                        }));
                                                                    }}
                                                                    className="form-control"
                                                                >
                                                                    <option value="" disabled>Select Heart Rate</option>
                                                                    {heartRate.map((option) => (
                                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                                    ))}
                                                                </Form.Select>
                                                                <Form.Select
                                                                    name="breathing"
                                                                    value={formData.breathing}
                                                                    onChange={(e) => {
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            breathing: e.target.value
                                                                        }));
                                                                    }}
                                                                    className="form-control"
                                                                >
                                                                    <option value="" disabled>Breathing</option>
                                                                    {breathing.map((option) => (
                                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                                    ))}
                                                                </Form.Select>
                                                                <Form.Select
                                                                    name="bloodPressure"
                                                                    value={formData.bloodPressure}
                                                                    onChange={(e) => {
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            bloodPressure: e.target.value
                                                                        }));
                                                                    }}
                                                                    className="form-control"
                                                                >
                                                                    <option value="" disabled>Blood Pressure</option>
                                                                    {bloodPressure.map((option) => (
                                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                                    ))}
                                                                </Form.Select></div>
                            
                                                            <Form.Group className="mb-3">
                                                                <Form.Label>Anamnesis</Form.Label>
                                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                                <Form.Select
                                                                    name="patientJob"
                                                                    value={formData.patientJob}
                                                                    onChange={(e) => {
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            patientJob: e.target.value
                                                                        }));
                                                                    }}
                                                                    className="form-control"
                                                                >
                                                                    <option value="" disabled>Patient Job</option>
                                                                    {patientJob.map((option) => (
                                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                                    ))}
                                                                </Form.Select>
                                                                <Form.Select
                                                                    name="patientJobRisks"
                                                                    value={formData.patientJobRisks}
                                                                    onChange={(e) => {
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            patientJobRisks: e.target.value
                                                                        }));
                                                                    }}
                                                                    className="form-control"
                                                                >
                                                                    <option value="" disabled>Job Risks (Optional) </option>
                                                                    {patientJobRisks.map((option) => (
                                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                                    ))}
                                                                </Form.Select>
                                                                <Form.Select
                                                                    name="patientAllergiesRisk"
                                                                    value={formData.patientAllergiesRisk}
                                                                    onChange={(e) => {
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            patientAllergiesRisk: e.target.value
                                                                        }));
                                                                    }}
                                                                    className="form-control"
                                                                >
                                                                    <option value="" disabled>patientAllergiesRisk</option>
                                                                    {patientAllergiesRisk.map((option) => (
                                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                                    ))}
                                                                </Form.Select>
                            </div>
                                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                                {formData.patientJob === 'Yes' && (
                                                                <Form.Control
                                                                type="text"
                                                                name="patientCareer"
                                                                value={formData.patientCareer}
                                                                onChange={handleChange}
                                                                placeholder="Patient Job"
                                                                required
                                                                className="form-control"
                                                                />
                                                            )}
                                                                {formData.patientJob === 'No' && (
                                                                <Form.Control
                                                                type="text"
                                                                name="patientCareer"
                                                                value={formData.patientCareer}
                                                                onChange={handleChange}
                                                                placeholder="Patient Job No"
                                                                required
                                                                className="form-control"
                                                                />
                                                            )} 
                                                                {formData.patientJobRisks === 'Yes' && (
                                                                <Form.Control
                                                                type="text"
                                                                name="careerRisks"
                                                                value={formData.careerRisks}
                                                                onChange={handleChange}
                                                                placeholder="Patient Job Risks"
                                                                required
                                                                className="form-control"
                                                                />
                                                            )} 
                                                              {formData.patientAllergiesRisk === 'Yes' && (
                                                                <Form.Control
                                                                type="text"
                                                                name="patientAllergies"
                                                                value={formData.patientAllergies}
                                                                onChange={handleChange}
                                                                placeholder="Patient Job Risks"
                                                                required
                                                                className="form-control"
                                                                />
                                                            )} 
                            
                                                            </div>
                                                            
                                                            <div style={{ display: 'flex', gap: '10px' }}>
                            
                                                            <Form.Select
                                                                    name="patientMedicineRegular"
                                                                    value={formData.patientMedicineRegular}
                                                                    onChange={(e) => {
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            patientMedicineRegular: e.target.value
                                                                        }));
                                                                    }}
                                                                    className="form-control"
                                                                >
                                                                    <option value="" disabled>patientMedicineRegular</option>
                                                                    {patientMedicineRegular.map((option) => (
                                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                                    ))}
                                                                </Form.Select>
                                                                <Form.Select
                                                                    name="patientOther"
                                                                    value={formData.patientOther}
                                                                    onChange={(e) => {
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            patientOther: e.target.value
                                                                        }));
                                                                    }}
                                                                    className="form-control"
                                                                >
                                                                    <option value="" disabled>patientOther</option>
                                                                    {patientOther.map((option) => (
                                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                                    ))}
                                                                </Form.Select>
                                                                <Form.Select
                                                                    name="predisposition"
                                                                    value={formData.predisposition}
                                                                    onChange={(e) => {
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            predisposition: e.target.value
                                                                        }));
                                                                    }}
                                                                    className="form-control"
                                                                >
                                                                    <option value="" disabled>predisposition</option>
                                                                    {predisposition.map((option) => (
                                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                                    ))}
                                                                </Form.Select></div>
                                                                <div style={{ display: 'flex', gap: '10px' }}>
                            
                                                                {formData.patientMedicineRegular === 'Yes' && (
                                                                <Form.Control
                                                                type="text"
                                                                name="patientMedicine"
                                                                value={formData.patientMedicine}
                                                                onChange={handleChange}
                                                                placeholder="patientMedicine"
                                                                required
                                                                className="form-control"
                                                                />
                                                            )} 
                                                                {formData.patientOther === 'Yes' && (
                                                                <Form.Control
                                                                type="text"
                                                                name="patientImpairments"
                                                                value={formData.patientImpairments}
                                                                onChange={handleChange}
                                                                placeholder="patientImpairments"
                                                                required
                                                                className="form-control"
                                                                />
                                                            )} </div>
                                                                    <Form.Control
                                                                    as="textarea"
                                                                    name="patientSummary"
                                                                    value={formData.patientSummary}
                                                                    onChange={handleChange}
                                                                    rows="4"
                                                                    required
                                                                    className={`form-control ${!formData.patientSummary ? 'is-invalid' : ''}`}
                                                                    placeholder="Assessment Statement"
                                                                />
                                                            </Form.Group>
                                                        </>
                            
                        ) : bbCodeVersion === 8 ? ( // Emergency Medical File2
                            <>
                                <h5>(The FORM below is intended for the opening of a basic medical file, it must appear at the top.)</h5>

                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        handleChange({
                                            target: {
                                                name: 'phmcEmployee',
                                                value: selectedOption?.value || ''
                                            }
                                        });
                                        if (selectedOption) {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: selectedOption.signature || ''
                                            }));
                                        } else {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: ''
                                            }));
                                        }
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"  // Match Bootstrap styling
                                    styles={{
                                        control: (base) => ({
                                            ...base,
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
                                        }),
                                        group: (base) => ({
                                            ...base,
                                            paddingTop: 8,
                                            paddingBottom: 8
                                        }),
                                        groupHeading: (base) => ({
                                            ...base,
                                            color: '#6c757d',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            fontSize: '0.75rem',
                                            marginBottom: 4
                                        })
                                    }}
                                />
                                <Form.Label></Form.Label>
                                <Form.Control
                                    type="text"
                                    name="phmcSignature"
                                    value={formData.phmcSignature}
                                    onChange={handleChange}
                                    placeholder="Employee Signature"
                                    required
                                />
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 1: Medical Patient Record</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientMedicalRecord"
                                        value={formData.patientMedicalRecord}
                                        onChange={handleChange}
                                        placeholder="Patient Number"
                                        required
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Section 2: Patient Demographics</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientName"
                                        value={formData.patientName}
                                        onChange={handleChange}
                                        placeholder="Patient Name"
                                        required
                                    />
                                    <Form.Select
                                        name="patientGender"
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setFormData(prev => ({
                                                ...prev,
                                                patientMale: value === 'male',
                                                patientFemale: value === 'female'
                                            }));
                                        }}
                                    >
                                        <option value="...">Select Gender</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                    </Form.Select>
                                    <Form.Text className="text-muted">
                                        Patient's date of birth
                                    </Form.Text>
                                    <Form.Control
                                        type="date"
                                        name="patientDateofBirth"
                                        value={formData.patientDateofBirth}
                                        onChange={handleChange}
                                        placeholder="Date of Birth"
                                        required
                                    />
                                    <Form.Control
                                        type="tel"
                                        name="patientPH"
                                        value={formData.patientPH}
                                        onChange={handleChange}
                                        placeholder="Telephone Number"
                                        required
                                    />
                                    <Form.Control
                                        type="email"
                                        name="patientEmail"
                                        value={formData.patientEmail}
                                        onChange={handleChange}
                                        placeholder="Email Address / ((Include a Discord handle if available))"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientAddress"
                                        value={formData.patientAddress}
                                        onChange={handleChange}
                                        placeholder="Home Address"
                                        required
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Section 3: Emergency Contact Information</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientEmergencyContact"
                                        value={formData.patientEmergencyContact}
                                        onChange={handleChange}
                                        placeholder="Emergency Contact Name"
                                        required
                                    />
                                    <Form.Control
                                        type="tel"
                                        name="patientEmergencyContactNumber"
                                        value={formData.patientEmergencyContactNumber}
                                        onChange={handleChange}
                                        placeholder="Emergency Contact Number"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientEmergencyContactRelation"
                                        value={formData.patientEmergencyContactRelation}
                                        onChange={handleChange}
                                        placeholder="Relation to Patient"
                                        required
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Section 4: Health Status Information</Form.Label>
                                    <Form.Select
                                        name="patientBloodType"
                                        value={formData.patientBloodType}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="">Select Blood Type</option>
                                        <option value="A+">A+</option>
                                        <option value="A-">A-</option>
                                        <option value="B+">B+</option>
                                        <option value="B-">B-</option>
                                        <option value="AB+">AB+</option>
                                        <option value="AB-">AB-</option>
                                        <option value="O+">O+</option>
                                        <option value="O-">O-</option>
                                    </Form.Select>
                                    <Form.Control
                                        as="textarea"
                                        name="patientChronicDiseases"
                                        value={formData.patientChronicDiseases}
                                        onChange={handleChange}
                                        placeholder="Known Chronic Diseases"
                                        rows="2"
                                    />
                                    <Form.Control
                                        as="textarea"
                                        name="patientAllergies"
                                        value={formData.patientAllergies}
                                        onChange={handleChange}
                                        placeholder="Known Allergies"
                                        rows="2"
                                    />
                                </Form.Group>
                            </>
                        ) : bbCodeVersion === 9 ? ( // generateObsMainFile
                            <>

                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        handleChange({
                                            target: {
                                                name: 'phmcEmployee',
                                                value: selectedOption?.value || ''
                                            }
                                        });
                                        if (selectedOption) {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: selectedOption.signature || ''
                                            }));
                                        } else {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: ''
                                            }));
                                        }
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"  // Match Bootstrap styling
                                    styles={{
                                        control: (base) => ({
                                            ...base,
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
                                        }),
                                        group: (base) => ({
                                            ...base,
                                            paddingTop: 8,
                                            paddingBottom: 8
                                        }),
                                        groupHeading: (base) => ({
                                            ...base,
                                            color: '#6c757d',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            fontSize: '0.75rem',
                                            marginBottom: 4
                                        })
                                    }}
                                />
                                <Form.Label></Form.Label>
                                <Form.Control
                                    type="text"
                                    name="phmcSignature"
                                    value={formData.phmcSignature}
                                    onChange={handleChange}
                                    placeholder="Employee Signature"
                                    required
                                />
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 0: Patient Information</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientMedicalRecord"
                                        value={formData.patientMedicalRecord}
                                        onChange={handleChange}
                                        placeholder="Patient Number"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientName"
                                        value={formData.patientName}
                                        onChange={handleChange}
                                        placeholder="Patient Name"
                                        required
                                    />
                                    <Form.Text className="text-muted">
                                        Patient's date of birth
                                    </Form.Text>

                                    <Form.Control
                                        type="date"
                                        name="patientDateofBirth"
                                        value={formData.patientDateofBirth}
                                        onChange={handleChange}
                                        placeholder="Patient Number"
                                        required
                                    />
                                    <Form.Label>Partner Information</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientPartnerName"
                                        value={formData.patientPartnerName}
                                        onChange={handleChange}
                                        placeholder="Patient Partner Name"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientPartnerPH"
                                        value={formData.patientPartnerPH}
                                        onChange={handleChange}
                                        placeholder="Patient Partner Phone Number"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientPartnerDiscord"
                                        value={formData.patientPartnerDiscord}
                                        onChange={handleChange}
                                        placeholder="Patient Partner Email (( & Discord ))"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientJob"
                                        value={formData.patientJob}
                                        onChange={handleChange}
                                        placeholder="Patient Employeer"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientJobTasks"
                                        value={formData.patientJobTasks}
                                        onChange={handleChange}
                                        placeholder="Patient Job Tasks"
                                        required
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Section 1: Health Story</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientPreHealth"
                                        value={formData.patientPreHealth}
                                        onChange={handleChange}
                                        placeholder="Health problems, medications, allergies, surgical procedures, problems related to anesthesia, depression, etc."
                                        required
                                    />

                                    <Form.Select
                                        type="text"
                                        name="patientAdditionalPregnancy"
                                        value={formData.patientAdditionalPregnancy}
                                        onChange={handleChange}

                                        required
                                    >
                                        <option value="">Multiple Pregnancies</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>

                                    <Form.Control
                                        type="text"
                                        name="patientBaggageofParents"
                                        value={formData.patientBaggageofParents}
                                        onChange={handleChange}
                                        placeholder="Baggage of Parents"
                                        required
                                    />
                                    <Form.Select
                                        type="text"
                                        name="patientPregProblems"
                                        value={formData.patientPregProblems}
                                        onChange={handleChange}

                                        required
                                    >
                                        <option value="">Previous Gynecological Problems</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Text className="text-muted">This covers Patient's Living Habits.</Form.Text>
                                    <Form.Control
                                        type="text"
                                        name="patientLivingHabits"
                                        value={formData.patientLivingHabits}
                                        onChange={handleChange}
                                        placeholder="Diet, physical activity, smoking, alcohol and drugs."
                                        required
                                    />
                                    <Form.Label>Section 2: Patient Measurements</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientHeight"
                                        value={formData.patientHeight}
                                        onChange={handleChange}
                                        placeholder="Patient's Height"
                                    />

                                    <Form.Control
                                        type="text"
                                        name="patientWeight"
                                        value={formData.patientWeight}
                                        onChange={handleChange}
                                        placeholder="Patient's Weight"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Section 3: Vitals</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientTemperature"
                                        value={formData.patientTemperature}
                                        onChange={handleChange}
                                        placeholder="Body Temperature"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientBPM"
                                        value={formData.patientBPM}
                                        onChange={handleChange}
                                        placeholder="Heart Rate (BPM)"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientResperation"
                                        value={formData.patientResperation}
                                        onChange={handleChange}
                                        placeholder="Respiration Rate"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientOxi"
                                        value={formData.patientOxi}
                                        onChange={handleChange}
                                        placeholder="Pulse Oximetry"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientBP"
                                        value={formData.patientBP}
                                        onChange={handleChange}
                                        placeholder="Blood Pressure"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Section 4: Abdominal or Transvaginal Ultrasound<br></br></Form.Label>
                                    <Form.Text className="text-muted">Date of Pregnancy.</Form.Text>
                                    <Form.Control
                                        type="date"
                                        name="patientDateofPregnancy"
                                        value={formData.patientDateofPregnancy}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    />
                                    <Form.Label>Identification of Multiple Pregnancies:</Form.Label>
                                    <Form.Select
                                        name="violenceHistory"
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setFormData(prev => ({
                                                ...prev,
                                                oneFetus: value === 'One',
                                                twoFetuses: value === 'Two',
                                                threeFetuses: value === 'Three',
                                                fourFetuses: value === 'Four',
                                            }));
                                        }}
                                    >
                                        <option value="">Number of Fetus</option>
                                        <option value="One">One Fetus</option>
                                        <option value="Two">Two Fetus</option>
                                        <option value="Three">Three Fetus</option>
                                        <option value="Four">Four or more</option>
                                    </Form.Select>

                                    <Form.Control
                                        type="text"
                                        name="patientFetalMeasurements"
                                        value={formData.patientFetalMeasurements}
                                        onChange={handleChange}
                                        placeholder="Fetal Measurements"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 5: Gynecological and Biological Examinations</Form.Label>
                                    <Form.Text className="text-muted"><br></br>Last Well Woman Exam.</Form.Text>
                                    <Form.Control
                                        type="date"
                                        name="patientWellWomanExam"
                                        value={formData.patientWellWomanExam}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    />
                                    <Form.Select
                                        type="text"
                                        name="patientPap"
                                        value={formData.patientPap}
                                        onChange={handleChange}

                                        required
                                    >
                                        <option value="">Pap Smear</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Control
                                        type="text"
                                        name="patientPapResults"
                                        value={formData.patientPapResults}
                                        onChange={handleChange}
                                        placeholder="Pap Smear Results"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Select
                                        type="text"
                                        name="patientSTI"
                                        value={formData.patientSTI}
                                        onChange={handleChange}

                                        required
                                    >
                                        <option value="">STI Screaning</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Control
                                        type="text"
                                        name="patientSTIResults"
                                        value={formData.patientSTIResults}
                                        onChange={handleChange}
                                        placeholder="STI Results"
                                        required
                                        className="form-control"
                                    />

                                    <Form.Select
                                        type="text"
                                        name="patientBloodAnalysis"
                                        value={formData.patientBloodAnalysis}
                                        onChange={handleChange}

                                        required
                                    >
                                        <option value="">Blood Analysis</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Control
                                        type="text"
                                        name="patientBloodAnalysisResults"
                                        value={formData.patientBloodAnalysisResults}
                                        onChange={handleChange}
                                        placeholder="Patient Blood Analysis Results"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Select
                                        type="text"
                                        name="patientUrine"
                                        value={formData.patientUrine}
                                        onChange={handleChange}

                                        required
                                    >
                                        <option value="">Urine Analysis</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Control
                                        type="text"
                                        name="patientUrineResults"
                                        value={formData.patientUrineResults}
                                        onChange={handleChange}
                                        placeholder="Patient Urine Results"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Label>Section 6: Summary of Consultation </Form.Label>
                                <Form.Group className="mb-3">
                                    <Form.Control
                                        as="textarea"
                                        name="patientSummaryConsultation"
                                        value={formData.patientSummaryConsultation}
                                        onChange={handleChange}
                                        placeholder="Summary of Consultation"
                                        rows="4"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Label>Appointment Date</Form.Label>
                                <Form.Group className="mb-3">
                                    <Form.Control
                                        type="date"
                                        name="date"
                                        value={formData.date}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    />

                                </Form.Group>
                            </>
                        ) : bbCodeVersion === 10 ? ( // generateObsFollowup
                            <>
                                <h5> The FORM below should be used and added to the file, following the others.<br></br>(( Please note that it isn't mandatory to make a medical record for every patient you meet in the ER. You can either do it if you feel like it, offer it to the patient or simply do it at the patient's request. ))</h5>

                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        handleChange({
                                            target: {
                                                name: 'phmcEmployee',
                                                value: selectedOption?.value || ''
                                            }
                                        });
                                        if (selectedOption) {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: selectedOption.signature || ''
                                            }));
                                        } else {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: ''
                                            }));
                                        }
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"  // Match Bootstrap styling
                                    styles={{
                                        control: (base) => ({
                                            ...base,
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
                                        }),
                                        group: (base) => ({
                                            ...base,
                                            paddingTop: 8,
                                            paddingBottom: 8
                                        }),
                                        groupHeading: (base) => ({
                                            ...base,
                                            color: '#6c757d',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            fontSize: '0.75rem',
                                            marginBottom: 4
                                        })
                                    }}
                                />
                                <Form.Label></Form.Label>
                                <Form.Control
                                    type="text"
                                    name="phmcSignature"
                                    value={formData.phmcSignature}
                                    onChange={handleChange}
                                    placeholder="Employee Signature"
                                    required
                                />
                                <Form.Label>Section 0: Patient Information</Form.Label>
                                <Form.Group className="mb-3">
                                    <Form.Control
                                        type="text"
                                        name="patientMedicalRecord"
                                        value={formData.patientMedicalRecord}
                                        onChange={handleChange}
                                        placeholder="Patient Medical Number"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientName"
                                        value={formData.patientName}
                                        onChange={handleChange}
                                        placeholder="Patient's name"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Text className="text-muted"> Patient's date of birth</Form.Text>
                                    <Form.Control
                                        type="date"
                                        name="patientDateofBirth"
                                        value={formData.patientDateofBirth}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Label>Section 1: Patient Health Status</Form.Label>
                                <Form.Group className="mb-3">
                                    <Form.Control
                                        type="date"
                                        name="patientDateofPregnancy"
                                        value={formData.patientDateofPregnancy}
                                        onChange={handleChange}
                                        placeholder="Date of Pregnancy"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Select
                                        name="patientContractions"
                                        value={formData.patientContractions}
                                        onChange={handleChange}
                                        placeholder="Is the Patient suffering from contractions?  - CHANGE TO YES/NO"
                                        required
                                        className="form-control"
                                    >
                                        <option value="">Is Patient suffering from contractions?</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Select
                                        name="patientBleeding"
                                        value={formData.patientBleeding}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    >
                                        <option value="">Is Patient suffering from discharge or bleeding?</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Select
                                        name="patientDiscomfort"
                                        value={formData.patientDiscomfort}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    >
                                        <option value="">Patient Discomfort during urination?</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Select
                                        name="patientFetalMeasurements"
                                        value={formData.patientFetalMeasurements}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    >
                                        <option value="">Fetal Measurements</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                </Form.Group>
                                <Form.Label>Section 2: Patient Weight</Form.Label>
                                <Form.Group className="mb-3">
                                    <Form.Control
                                        type="text"
                                        name="patientWeight"
                                        value={formData.patientWeight}
                                        onChange={handleChange}
                                        placeholder="Patient's Weight"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientFatter"
                                        value={formData.patientFatter}
                                        onChange={handleChange}
                                        placeholder="Patient's Height"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>


                                <Form.Group className="mb-3">
                                    <Form.Label>Section 3: Vitals</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientTemperature"
                                        value={formData.patientTemperature}
                                        onChange={handleChange}
                                        placeholder="Temperature"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientBPM"
                                        value={formData.patientBPM}
                                        onChange={handleChange}
                                        placeholder="Heart Rate (BPM)"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientResperation"
                                        value={formData.patientResperation}
                                        onChange={handleChange}
                                        placeholder="Respiration Rate"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientOxi"
                                        value={formData.patientOxi}
                                        onChange={handleChange}
                                        placeholder="Oxygen Saturation (%)"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientBP"
                                        value={formData.patientBP}
                                        onChange={handleChange}
                                        placeholder="Blood Pressure (MMHG)"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 4: Abdominal Ultrasonography</Form.Label>
                                    <Form.Select
                                        name="patientBabyGender"
                                        value={formData.patientBabyGender}
                                        onChange={handleChange}
                                        placeholder="Baby Gender"
                                    >
                                        <option value=""> Baby Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </Form.Select>
                                    <Form.Select
                                        name="patientKnowBabyGender"
                                        value={formData.patientKnowBabyGender}
                                        onChange={handleChange}
                                    >
                                        <option value="">Does the Patient know the gender of the baby?</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Control
                                        type="text"
                                        name="patientUltraSummary"
                                        value={formData.patientUltraSummary}
                                        onChange={handleChange}
                                        placeholder="Summary of the Ultrasound"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 5: Biological Examinations</Form.Label>
                                    <Form.Select
                                        name="patientBloodAnalysis"
                                        value={formData.patientBloodAnalysis}
                                        onChange={handleChange}
                                    >
                                        <option value="">Has a blood analysis been performed?</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Control
                                        type="text"
                                        name="patientBloodAnalysisResults"
                                        value={formData.patientBloodAnalysisResults}
                                        onChange={handleChange}
                                        placeholder="Patient Blood Analysis Results"
                                    />
                                    <Form.Select
                                        name="patientUrine"
                                        value={formData.patientUrine}
                                        onChange={handleChange}
                                    >
                                        <option value="">Has a Urine analysis been performed?</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>

                                    <Form.Control
                                        type="text"
                                        name="patientUrineResults"
                                        value={formData.patientUrineResults}
                                        onChange={handleChange}
                                        placeholder="Urine Analysis"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 6: Summary of Consultation</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="patientSummaryConsultation"
                                        value={formData.patientSummaryConsultation}
                                        onChange={handleChange}
                                        placeholder="Summary of Consultation"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Appointment Date</Form.Label>
                                    <Form.Control
                                        type="date"
                                        name="date"
                                        value={formData.date}
                                        onChange={handleChange}
                                    />
                                </Form.Group>
                            </>
                        ) : bbCodeVersion === 12 ? ( // generateGyneMainFile
                            <>
                                <h5>(The FORM below is intended for the opening of a basic medical file, it must appear at the top.)</h5>

                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        handleChange({
                                            target: {
                                                name: 'phmcEmployee',
                                                value: selectedOption?.value || ''
                                            }
                                        });
                                        if (selectedOption) {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: selectedOption.signature || ''
                                            }));
                                        } else {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: ''
                                            }));
                                        }
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"  // Match Bootstrap styling
                                    styles={{
                                        control: (base) => ({
                                            ...base,
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
                                        }),
                                        group: (base) => ({
                                            ...base,
                                            paddingTop: 8,
                                            paddingBottom: 8
                                        }),
                                        groupHeading: (base) => ({
                                            ...base,
                                            color: '#6c757d',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            fontSize: '0.75rem',
                                            marginBottom: 4
                                        })
                                    }}
                                />
                                <Form.Label></Form.Label>
                                <Form.Control
                                    type="text"
                                    name="phmcSignature"
                                    value={formData.phmcSignature}
                                    onChange={handleChange}
                                    placeholder="Employee Signature"
                                    required
                                />
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 0: Personal Information</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientMedicalRecord"
                                        value={formData.patientMedicalRecord}
                                        onChange={handleChange}
                                        placeholder="Patient Number"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientName"
                                        value={formData.patientName}
                                        onChange={handleChange}
                                        placeholder="Patient Name"
                                        required
                                    />
                                    <Form.Text className="text-muted">
                                        Patient's date of birth
                                    </Form.Text>

                                    <Form.Control
                                        type="date"
                                        name="patientDateofBirth"
                                        value={formData.patientDateofBirth}
                                        onChange={handleChange}
                                        placeholder="Patient Number"
                                        required
                                    />
                                    <Form.Label>Partner Information</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientPartnerName"
                                        value={formData.patientPartnerName}
                                        onChange={handleChange}
                                        placeholder="Patient Partner Name"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientPartnerPH"
                                        value={formData.patientPartnerPH}
                                        onChange={handleChange}
                                        placeholder="Patient Partner Phone Number"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientPartnerDiscord"
                                        value={formData.patientPartnerDiscord}
                                        onChange={handleChange}
                                        placeholder="Patient Partner Email (( & Discord ))"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientJob"
                                        value={formData.patientJob}
                                        onChange={handleChange}
                                        placeholder="Patient Employeer"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientJobTasks"
                                        value={formData.patientJobTasks}
                                        onChange={handleChange}
                                        placeholder="Patient Job Tasks"
                                        required
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Section 1: Health Story</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientPreHealth"
                                        value={formData.patientPreHealth}
                                        onChange={handleChange}
                                        placeholder="Gynecological Problems"
                                        required
                                    />

                                    <Form.Control
                                        type="text"
                                        name="patientBaggageofParents"
                                        value={formData.patientBaggageofParents}
                                        onChange={handleChange}
                                        placeholder="Baggage of Parents"
                                        required
                                    />
                                    <Form.Text className="text-muted">This covers Patient's Living Habits.</Form.Text>
                                    <Form.Control
                                        type="text"
                                        name="patientLivingHabits"
                                        value={formData.patientLivingHabits}
                                        onChange={handleChange}
                                        placeholder="Diet, physical activity, smoking, alcohol and drugs."
                                        required
                                    />
                                    <Form.Label>Section 2: Patient Measurements</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientHeight"
                                        value={formData.patientHeight}
                                        onChange={handleChange}
                                        placeholder="Patient's Height"
                                    />

                                    <Form.Control
                                        type="text"
                                        name="patientWeight"
                                        value={formData.patientWeight}
                                        onChange={handleChange}
                                        placeholder="Patient's Weight"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Section 3: Vitals</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientTemperature"
                                        value={formData.patientTemperature}
                                        onChange={handleChange}
                                        placeholder="Body Temperature"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientBPM"
                                        value={formData.patientBPM}
                                        onChange={handleChange}
                                        placeholder="Heart Rate (BPM)"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientResperation"
                                        value={formData.patientResperation}
                                        onChange={handleChange}
                                        placeholder="Respiration Rate"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientOxi"
                                        value={formData.patientOxi}
                                        onChange={handleChange}
                                        placeholder="Pulse Oximetry"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientBP"
                                        value={formData.patientBP}
                                        onChange={handleChange}
                                        placeholder="Blood Pressure"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Section 4: Abdominal or Transvaginal Ultrasound</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientNotes"
                                        value={formData.patientNotes}
                                        onChange={handleChange}
                                        placeholder="Findings of Ultrasound"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 5: Gynecological and Biological Examinations</Form.Label>
                                    <Form.Text className="text-muted"><br></br>Last Well Woman Exam.</Form.Text>
                                    <Form.Control
                                        type="date"
                                        name="patientWellWomanExam"
                                        value={formData.patientWellWomanExam}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    />
                                    <Form.Select
                                        type="text"
                                        name="patientPap"
                                        value={formData.patientPap}
                                        onChange={handleChange}

                                        required
                                    >
                                        <option value="">Pap Smear</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Control
                                        type="text"
                                        name="patientPapResults"
                                        value={formData.patientPapResults}
                                        onChange={handleChange}
                                        placeholder="Pap Smear Results"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Select
                                        type="text"
                                        name="patientSTI"
                                        value={formData.patientSTI}
                                        onChange={handleChange}

                                        required
                                    >
                                        <option value="">STI Screaning</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Control
                                        type="text"
                                        name="patientSTIResults"
                                        value={formData.patientSTIResults}
                                        onChange={handleChange}
                                        placeholder="STI Results"
                                        required
                                        className="form-control"
                                    />

                                    <Form.Select
                                        type="text"
                                        name="patientBloodAnalysis"
                                        value={formData.patientBloodAnalysis}
                                        onChange={handleChange}

                                        required
                                    >
                                        <option value="">Blood Analysis</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Control
                                        type="text"
                                        name="patientBloodAnalysisResults"
                                        value={formData.patientBloodAnalysisResults}
                                        onChange={handleChange}
                                        placeholder="Patient Blood Analysis Results"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Select
                                        type="text"
                                        name="patientUrine"
                                        value={formData.patientUrine}
                                        onChange={handleChange}

                                        required
                                    >
                                        <option value="">Urine Analysis</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Control
                                        type="text"
                                        name="patientUrineResults"
                                        value={formData.patientUrineResults}
                                        onChange={handleChange}
                                        placeholder="Patient Urine Results"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Label>SECTION 6: SUMMARY OF CONSULTATION</Form.Label>
                                <Form.Group className="mb-3">
                                    <Form.Control
                                        as="textarea"
                                        name="patientSummaryConsultation"
                                        value={formData.patientSummaryConsultation}
                                        onChange={handleChange}
                                        placeholder="Summary of Consultation"
                                        rows="4"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Label>Appointment Date</Form.Label>
                                <Form.Group className="mb-3">
                                    <Form.Control
                                        type="date"
                                        name="date"
                                        value={formData.date}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                            </>
                        ) : bbCodeVersion === 13 ? ( // generateGyneFollowUp
                            <>
                                <h5> This is the GYNE FOLLOW UP FORM.<br></br>(( Please note that it isn't mandatory to make a medical record for every patient you meet in the ER. You can either do it if you feel like it, offer it to the patient or simply do it at the patient's request. ))</h5>
                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        handleChange({
                                            target: {
                                                name: 'phmcEmployee',
                                                value: selectedOption?.value || ''
                                            }
                                        });
                                        if (selectedOption) {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: selectedOption.signature || ''
                                            }));
                                        } else {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: ''
                                            }));
                                        }
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"  // Match Bootstrap styling
                                    styles={{
                                        control: (base) => ({
                                            ...base,
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
                                        }),
                                        group: (base) => ({
                                            ...base,
                                            paddingTop: 8,
                                            paddingBottom: 8
                                        }),
                                        groupHeading: (base) => ({
                                            ...base,
                                            color: '#6c757d',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            fontSize: '0.75rem',
                                            marginBottom: 4
                                        })
                                    }}
                                />
                                <Form.Label></Form.Label>
                                <Form.Control
                                    type="text"
                                    name="phmcSignature"
                                    value={formData.phmcSignature}
                                    onChange={handleChange}
                                    placeholder="Employee Signature"
                                    required
                                />
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 0: Patient Information</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientMedicalRecord"
                                        value={formData.patientMedicalRecord}
                                        onChange={handleChange}
                                        placeholder="Patient Number"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientName"
                                        value={formData.patientName}
                                        onChange={handleChange}
                                        placeholder="Patient Name"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Text className="text-muted">
                                        Patient's date of birth
                                    </Form.Text>
                                    <Form.Control
                                        type="date"
                                        name="patientDateofBirth"
                                        value={formData.patientDateofBirth}
                                        onChange={handleChange}
                                        placeholder="Date of Birth"
                                        required
                                        className="form-control"
                                    />

                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 1: Patient Health Status</Form.Label>
                                    <Form.Select
                                        name="patientBleeding"
                                        value={formData.patientBleeding}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    >
                                        <option value="">Is Patient suffering from discharge or bleeding?</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Select
                                        name="patientDiscomfort"
                                        value={formData.patientDiscomfort}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    >
                                        <option value="">Is Patient experiencing during urination? </option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 2: Patient Weight</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientWeight"
                                        value={formData.patientWeight}
                                        onChange={handleChange}
                                        placeholder="Patient's Weight"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientFatter"
                                        value={formData.patientFatter}
                                        onChange={handleChange}
                                        placeholder="Patient's Weight Gained"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 3: Vitals</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientTemperature"
                                        value={formData.patientTemperature}
                                        onChange={handleChange}
                                        placeholder="Body Temperature"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientBPM"
                                        value={formData.patientBPM}
                                        onChange={handleChange}
                                        placeholder="Heart Rate (BPM)"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientResperation"
                                        value={formData.patientResperation}
                                        onChange={handleChange}
                                        placeholder="Respiration Rate"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientOxi"
                                        value={formData.patientOxi}
                                        onChange={handleChange}
                                        placeholder="Pulse Oximetry"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientBP"
                                        value={formData.patientBP}
                                        onChange={handleChange}
                                        placeholder="Blood Pressure"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 4: Abdominal or Transvaginal Ultrasonography</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientUltraSummary"
                                        value={formData.patientUltraSummary}
                                        onChange={handleChange}
                                        placeholder="Finding's of the Ultrasound"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 5: Biological Examinations </Form.Label>
                                    <Form.Select
                                        name="patientBloodAnalysis"
                                        value={formData.patientBloodAnalysis}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    >
                                        <option value="">Was a Blood Analysis conducted? </option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>

                                    <Form.Control
                                        type="text"
                                        name="patientBloodAnalysisResults"
                                        value={formData.patientBloodAnalysisResults}
                                        onChange={handleChange}
                                        placeholder="Patient Blood Analysis Results"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Select
                                        name="patientUrine"
                                        value={formData.patientUrine}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    >
                                        <option value="">Was a Urine Analysis conducted? </option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Control
                                        type="text"
                                        name="patientUrineResults"
                                        value={formData.patientUrineResults}
                                        onChange={handleChange}
                                        placeholder="Patient Urine Results"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Section 5: Summary of Consultation</Form.Label>
                                    <Form.Control
                                        type="textarea"
                                        name="patientSummaryConsultation"
                                        value={formData.patientSummaryConsultation}
                                        onChange={handleChange}
                                        placeholder="Summary of Consultation"
                                        rows="4"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Appointment Date</Form.Label>
                                    <Form.Control
                                        type="date"
                                        name="date"
                                        value={formData.date}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                            </>
                        ) : bbCodeVersion === 14 ? ( // generateMentalHealthPHMC
                            <>
                            <Form.Control
                                    type="text"
                                    name="patientID"
                                    value={formData.patientID}
                                    onChange={handleChange}
                                    placeholder="Patient ID"
                                    required
                                    className="form-control"
                                />

                                <Form.Label>Date:</Form.Label>
                                <Form.Control
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    className="form-control"
                                />

                                <div className="radio-inline-container">

                                    <span className="radio-text">Role:</span>
                                    <Form.Check
                                        type="radio"
                                        id="doctorRank"
                                        label="   Doctor"
                                        checked={isDoctor}
                                        onChange={handlePHMCRank('doctor')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="nurseRank"
                                        label="   Nurse"
                                        checked={isNurse}
                                        onChange={handlePHMCRank('nurse')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="psychRank"
                                        label="   Psychiatrist"
                                        checked={isPsych}
                                        onChange={handlePHMCRank('psych')}
                                        inline
                                    />  </div>
                                <Form.Label></Form.Label>

 
                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        // eslint-disable-next-line no-unused-vars
                                        const lastName = selectedOption ? selectedOption.lastName : '';
                                        setFormData(prev => ({
                                            ...prev,
                                            phmcEmployee: selectedOption ? selectedOption.value : '',
                                            lastName: selectedOption ? selectedOption.lastName : '' // Use lastName from the selected option
                                        }));
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"
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
                                <Form.Label></Form.Label>
                                                                                    <Form.Group className="mb-3">
                                                                    <Form.Control
                                        as="textarea"
                                        name="patientChiefComplaint"
                                        value={formData.patientChiefComplaint}
                                        onChange={handleChange}
                                        placeholder="Patient Chief Complaint"
                                        rows="3"
                                        required
                                                                                        />

                                    <Form.Control
                                        type="text"
                                        name="patientNotes"
                                        value={formData.patientNotes}
                                        onChange={handleChange}
                                        placeholder="Patient Notes"
                                        required
                                        className="form-control"
                                    />
                                <Form.Label></Form.Label>

                                <Select
                                    name="admission"
                                    value={admission.find(option => option.value === formData.admission)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            admission: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={admission}
                                    isClearable
                                    placeholder="Was Patient Admitted?"
                                    className="form-control"
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
                                <Form.Label></Form.Label>
                                    <Form.Label><br></br></Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="patientDiagnosis"
                                        value={formData.patientDiagnosis}
                                        onChange={handleChange}
                                        placeholder="Diagnosis"
                                        rows="3"
                                        required
                                                                                        />
                                                                        <Form.Control
                                        as="textarea"
                                        name="patientProcedure"
                                        value={formData.patientProcedure}
                                        onChange={handleChange}
                                        placeholder="Patient Procedure"
                                        rows="2"
                                    />

                                    <Form.Control
                                        as="textarea"
                                        name="patientMedicine"
                                        value={formData.patientMedicine}
                                        onChange={handleChange}
                                        placeholder="Patient Medicine"
                                        rows="2"
                                    />
                                </Form.Group>
                                <Select
                                    name="followup"
                                    value={followup.find(option => option.value === formData.followup)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            followup: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={followup}
                                    isClearable
                                    placeholder="Select Followup Process..."
                                    className="form-control"
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
                        ) : bbCodeVersion === 16 ? ( // generateMentalHealthPBC
                            <>
                                                            <Form.Control
                                    type="text"
                                    name="patientID"
                                    value={formData.patientID}
                                    onChange={handleChange}
                                    placeholder="Patient ID"
                                    required
                                    className="form-control"
                                />

                                <Form.Label>Date:</Form.Label>
                                <Form.Control
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    className="form-control"
                                />

                                <div className="radio-inline-container">

                                    <span className="radio-text">Role:</span>
                                    <Form.Check
                                        type="radio"
                                        id="doctorRank"
                                        label="   Doctor"
                                        checked={isDoctor}
                                        onChange={handlePHMCRank('doctor')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="nurseRank"
                                        label="   Nurse"
                                        checked={isNurse}
                                        onChange={handlePHMCRank('nurse')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="psychRank"
                                        label="   Psychiatrist"
                                        checked={isPsych}
                                        onChange={handlePHMCRank('psych')}
                                        inline
                                    />  </div>
                                <Form.Label></Form.Label>

 
                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        // eslint-disable-next-line no-unused-vars
                                        const lastName = selectedOption ? selectedOption.lastName : '';
                                        console.log("DEBUG: Last Name:", lastName); // Add this line to use the variable
                                        setFormData(prev => ({
                                            ...prev,
                                            phmcEmployee: selectedOption ? selectedOption.value : '',
                                            lastName: selectedOption ? selectedOption.lastName : '' // Use lastName from the selected option
                                        }));
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"
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
                                <Form.Label></Form.Label>
                                                                                    <Form.Group className="mb-3">
                                                                    <Form.Control
                                        as="textarea"
                                        name="patientChiefComplaint"
                                        value={formData.patientChiefComplaint}
                                        onChange={handleChange}
                                        placeholder="Patient's Chief Complaint"
                                        rows="3"
                                        required
                                                                                        />

                                    <Form.Control
                                        type="text"
                                        name="patientNotes"
                                        value={formData.patientNotes}
                                        onChange={handleChange}
                                        placeholder="Patient Notes"
                                        required
                                        className="form-control"
                                    />
                                <Form.Label></Form.Label>

                                <Select
                                    name="admission"
                                    value={admission.find(option => option.value === formData.admission)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            admission: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={admission}
                                    isClearable
                                    placeholder="Was Patient Admitted?"
                                    className="form-control"
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
                                <Form.Label></Form.Label>
                                    <Form.Label><br></br></Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="patientDiagnosis"
                                        value={formData.patientDiagnosis}
                                        onChange={handleChange}
                                        placeholder="Diagnosis"
                                        rows="3"
                                        required
                                                                                        />
                                                                        <Form.Control
                                        as="textarea"
                                        name="patientProcedure"
                                        value={formData.patientProcedure}
                                        onChange={handleChange}
                                        placeholder="Patient Procedure"
                                        rows="2"
                                    />

                                    <Form.Control
                                        as="textarea"
                                        name="patientMedicine"
                                        value={formData.patientMedicine}
                                        onChange={handleChange}
                                        placeholder="Patient Medicine"
                                        rows="2"
                                    />
                                </Form.Group>
                                <Select
                                    name="followup"
                                    value={followup.find(option => option.value === formData.followup)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            followup: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={followup}
                                    isClearable
                                    placeholder="Select Followup Process..."
                                    className="form-control"
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
                        ) : bbCodeVersion === 18 ? ( // generateAgencyFeedback
                            <>
                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="coronerEmployee"
                                    value={coronerGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.coronerEmployee) || null}
                                    onChange={(selectedOption) => handleSelectChange(selectedOption, 'coroner')}
                                    options={coronerGroupedOptions}
                                    isClearable
                                    placeholder="Search or select coroner..."
                                    className="form-control"
                                    styles={{
                                        control: (base) => ({
                                            ...base,
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
                                        }),
                                        group: (base) => ({
                                            ...base,
                                            paddingTop: 8,
                                            paddingBottom: 8
                                        }),
                                        groupHeading: (base) => ({
                                            ...base,
                                            color: '#6c757d',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            fontSize: '0.75rem',
                                            marginBottom: 4
                                        })
                                    }}
                                />
                                <Form.Label></Form.Label>

                                <Form.Label>Agency Involved:</Form.Label>
                                <Form.Select
                                    name="department"
                                    value={formData.department}
                                    onChange={handleChange}
                                    required
                                    className="form-select"
                                >
                                    <option value="" disabled>Select Department</option>
                                    <option value="LSFD">LSFD</option>
                                    <option value="LSPD">LSPD</option>
                                    <option value="LSSD">LSSD</option>
                                    <option value="PHMC">PHMC</option>
                                    <option value="SANFIRE">SANFIRE</option>
                                    <option value="SADCR">SADCR</option>
                                    <option value="LSGOV">LSGOV</option>
                                </Form.Select>

                                <Form.Label>Time of Incident:</Form.Label>
                                <Form.Control
                                    type="datetime-local"
                                    name="dateTime"
                                    value={formData.dateTime}
                                    onChange={handleChange}
                                    required
                                    className="form-control"
                                />
                                <Form.Label>Brief Summary:</Form.Label>
                                <Form.Control
                                    as="textarea"
                                    name="synopsis"
                                    value={formData.synopsis}
                                    onChange={handleChange}
                                    rows="4"
                                    required
                                    className="form-control"
                                />
                                <Form.Label>Incident Location:</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="placeOfDeath"
                                    value={formData.placeOfDeath}
                                    onChange={handleChange}
                                    placeholder="Mirror Park"
                                    required
                                    className="form-control"
                                />
                                <Form.Control
                                    as="textarea"
                                    name="decedentName"
                                    value={formData.decedentName}
                                    onChange={handleChange}
                                    rows="3"
                                    placeholder="Agency Employee's Names"
                                    required
                                    className="form-control"
                                />

                                <Form.Group className="mb-3 upload-container">
                                    <Form.Label>
                                        ((Screenshots or Evidence)):
                                    </Form.Label>
                                    <InputGroup>
                                        <Form.Control
                                            as="textarea"
                                            name="scenePhotos"
                                            value={formData.scenePhotos}
                                            onChange={handleChange}
                                            rows="2"
                                            required
                                            className="form-control"
                                            onPaste={(e) => {
                                                e.preventDefault();
                                                const items = e.clipboardData.items;
                                                for (let i = 0; i < items.length; i++) {
                                                    if (items[i].type.indexOf('image') !== -1) {
                                                        const file = items[i].getAsFile();
                                                        handleImageUpload({ target: { files: [file] } }, 'scenePhotos');
                                                    }
                                                }
                                            }}

                                        />
                                        <Button
                                            variant="success"
                                            disabled={isUploading}
                                            onClick={() => {
                                                const input = document.createElement('input');
                                                input.type = 'file';
                                                input.accept = 'image/*';
                                                input.multiple = true;
                                                input.onchange = (e) => handleImageUpload(e, 'scenePhotos');
                                                input.click();
                                            }}
                                        >
                                            <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                                            {isUploading ? 'Uploading...' : 'Upload Images'}
                                        </Button>

                                    </InputGroup>
                                    <span className="helper-text">
                                    This supports clipboard uploading, ctrl + V! | Hosted by Imgur! - <a href="https://imgur.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                                    </span>
                                </Form.Group>
                            </>
                        ) : bbCodeVersion === 19 ? ( // Emergency Room Forms - generateERForm
                            <>
                  <p>If you require assistance with this form <a href="https://phmc.gta.world/viewforum.php?f=66" target="_blank" rel="noopener noreferrer">use this link! It should contain the information you require.  </a> If you still need help, use the PHMC Discord. </p>
                                <Form.Control
                                    type="text"
                                    name="patientID"
                                    value={formData.patientID}
                                    onChange={handleChange}
                                    placeholder="Patient ID"
                                    required
                                    className={`form-control ${!formData.patientID ? 'is-invalid' : ''}`}
                                />

                                <Form.Label>Date:</Form.Label>
                                <Form.Control
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.date ? 'is-invalid' : ''}`}
                                />

                                <div className="radio-inline-container">

                                    <span className="radio-text">Role:</span>
                                    <Form.Check
                                        type="radio"
                                        id="doctorRank"
                                        label="   Doctor"
                                        checked={isDoctor}
                                        onChange={handlePHMCRank('doctor')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="nurseRank"
                                        label="   Nurse"
                                        checked={isNurse}
                                        onChange={handlePHMCRank('nurse')}
                                        inline
                                    />  </div>
                                <Form.Label></Form.Label>
                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        // eslint-disable-next-line no-unused-vars
                                        const lastName = selectedOption ? selectedOption.lastName : '';
                                        setFormData(prev => ({
                                            ...prev,
                                            phmcEmployee: selectedOption ? selectedOption.value : '',
                                            lastName: selectedOption ? selectedOption.lastName : '' // Use lastName from the selected option
                                        }));
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className={`form-control ${!formData.phmcEmployee ? 'is-invalid' : ''}`}
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
                                <Form.Label></Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Select
                                                name="painLevel"
                                                value={formData.painLevel}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.painLevel ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Pain Scale </option>
                                                {painLevel.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>

                                <Form.Control
                                    type="text"
                                    name="patientChiefComplaint"
                                    value={formData.patientChiefComplaint}
                                    onChange={handleChange}
                                    placeholder="Patient Chief Complaint"
                                    required
                                    className={`form-control ${!formData.patientChiefComplaint ? 'is-invalid' : ''}`}
                                    />
</div>
                                <Form.Label>Vitals Section </Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Select
                                                name="vitals"
                                                value={formData.vitals}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.vitals ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Vitals</option>
                                                {vitals.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="heartRate"
                                                value={formData.heartRate}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.heartRate ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Heart Rate</option>
                                                {heartRate.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="breathing"
                                                value={formData.breathing}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.breathing ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Breathing</option>
                                                {breathing.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="bloodPressure"
                                                value={formData.bloodPressure}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.bloodPressure ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Blood Pressure</option>
                                                {bloodPressure.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            </div>
                                            <Form.Label>Findings </Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Select
                                                name="findings"
                                                value={formData.findings}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.findings ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>General Health Conditions</option>
                                                {findings.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="lungs"
                                                value={formData.lungs}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.lungs ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Patient Lungs</option>
                                                {lungs.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="pupils"
                                                value={formData.pupils}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.pupils ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Patient Pupils</option>
                                                {pupils.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                            
                                            <Form.Select
                                                name="wounds"
                                                value={formData.wounds}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.wounds ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Patient Wounds</option>
                                                {wounds.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="ecg"
                                                value={formData.ecg}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.wounds ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>ECG Results</option>
                                                {ecg.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="sono"
                                                value={formData.sono}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.wounds ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Sonography Results</option>
                                                {sono.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            </div>
                                <Select
                                    isMulti
                                    name="lab"
                                    value={lab.filter(option =>
                                        formData.lab.includes(option.value)
                                    )}
                                    onChange={(selectedOptions) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            lab: selectedOptions ? selectedOptions.map(option => option.value) : []
                                        }));
                                    }}
                                    options={lab}
                                    className={`form-control ${!formData.lab ? 'is-invalid' : ''}`}
                                    placeholder="Select lab results..."
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
                                <Form.Label></Form.Label>
                                <Form.Label>Preliminary Diagnosis </Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>

                                <Form.Control
                                    as="textarea"
                                    name="patientDiagnosis"
                                    value={formData.patientDiagnosis}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Patient Diagnosis"
                                    required
                                    className={`form-control ${!formData.patientDiagnosis ? 'is-invalid' : ''}`}
                                />
                                <Form.Control
                                    as="textarea"
                                    name="patientSecondaryDiagnosis"
                                    value={formData.patientSecondaryDiagnosis}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Patient's Secondary Diagnosis"
                                    required
                                    className={`form-control ${!formData.patientSecondaryDiagnosis ? 'is-invalid' : ''}`}
                                />
                                </div>
                                <Form.Label>Therapy </Form.Label>

                                <Form.Select
                                    name="admission"
                                    value={formData.admission}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.admission ? 'is-invalid' : ''}`}
                                >
                                    <option value="" disabled>Patient Admitted?</option>
                                    {admission.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </Form.Select>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control
                                    as="textarea"
                                    name="patientProcedure"
                                    value={formData.patientProcedure}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Procedure's conducted on Patient"
                                    required
                                    className={`form-control ${!formData.patientProcedure ? 'is-invalid' : ''}`}
                                />
                                <Form.Control
                                    as="textarea"
                                    name="patientMedicine"
                                    value={formData.patientMedicine}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Medication provided to Patient"
                                    required
                                    className={`form-control ${!formData.patientMedicine ? 'is-invalid' : ''}`}
                                />
                                </div>


                            </>
                        ) : bbCodeVersion === 20 ? ( // Emergency Room Forms - generateERForm aaaaaaa
                            <> 
                                <p>If you require assistance with this form <a href="https://phmc.gta.world/viewforum.php?f=66" target="_blank" rel="noopener noreferrer">use this link! It should contain the information you require.  </a> If you still need help, use the PHMC Discord. </p>

                                <Form.Control
                                    type="text"
                                    name="patientID"
                                    value={formData.patientID}
                                    onChange={handleChange}
                                    placeholder="Patient ID"
                                    required
                                    className={`form-control ${!formData.patientID ? 'is-invalid' : ''}`}
                                />

                                <Form.Label>Date:</Form.Label>
                                <Form.Control
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.date ? 'is-invalid' : ''}`}
                                />

                                <div className="radio-inline-container">

                                    <span className="radio-text">Role:</span>
                                    <Form.Check
                                        type="radio"
                                        id="doctorRank"
                                        label="   Doctor"
                                        checked={isDoctor}
                                        onChange={handlePHMCRank('doctor')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="nurseRank"
                                        label="   Nurse"
                                        checked={isNurse}
                                        onChange={handlePHMCRank('nurse')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="psychRank"
                                        label="   Psychiatrist"
                                        checked={isPsych}
                                        onChange={handlePHMCRank('psych')}
                                        inline
                                    />  </div>
                                <Form.Label></Form.Label>
                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        // eslint-disable-next-line no-unused-vars
                                        const lastName = selectedOption ? selectedOption.lastName : '';
                                        setFormData(prev => ({
                                            ...prev,
                                            phmcEmployee: selectedOption ? selectedOption.value : '',
                                            lastName: selectedOption ? selectedOption.lastName : '' // Use lastName from the selected option
                                        }));
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"
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
                                <Form.Label></Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>

                                <Form.Control
                                    type="text"
                                    name="patientChiefComplaint"
                                    value={formData.patientChiefComplaint}
                                    onChange={handleChange}
                                    placeholder="Patient Chief Complaint"
                                    required
                                    className={`form-control ${!formData.patientChiefComplaint ? 'is-invalid' : ''}`}
                                    />
                                                        <Form.Select
                                name="assignedDepartment"
                                value={formData.assignedDepartment}
                                onChange={handleChange}
                                required
                                className={`form-control ${!formData.assignedDepartment ? 'is-invalid' : ''}`}
                            >
                                <option value="" disabled>Assigned Department</option>
                                {assignedDepartment.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </Form.Select>

                                </div> 


                                <Form.Label>Vitals Section </Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Select
                                                name="vitals"
                                                value={formData.vitals}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.vitals ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Vitals</option>
                                                {vitals.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="heartRate"
                                                value={formData.heartRate}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.heartRate ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Heart Rate</option>
                                                {heartRate.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="breathing"
                                                value={formData.breathing}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.breathing ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Breathing</option>
                                                {breathing.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="bloodPressure"
                                                value={formData.bloodPressure}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.bloodPressure ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Blood Pressure</option>
                                                {bloodPressure.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            </div>
                                            <Form.Label>Findings </Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Select
                                                name="findings"
                                                value={formData.findings}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.findings ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>General Health Conditions</option>
                                                {findings.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="lungs"
                                                value={formData.lungs}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.lungs ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Patient Lungs</option>
                                                {lungs.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="pupils"
                                                value={formData.pupils}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.pupils ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Patient Pupils</option>
                                                {pupils.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                            
                                            <Form.Select
                                                name="wounds"
                                                value={formData.wounds}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.wounds ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Patient Wounds</option>
                                                {wounds.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="ecg"
                                                value={formData.ecg}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.wounds ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>ECG Results</option>
                                                {ecg.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="sono"
                                                value={formData.sono}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.wounds ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Sonography Results</option>
                                                {sono.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            </div>

                                <Select
                                    isMulti
                                    name="lab"
                                    value={lab.filter(option =>
                                        formData.lab.includes(option.value)
                                    )}
                                    onChange={(selectedOptions) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            lab: selectedOptions ? selectedOptions.map(option => option.value) : []
                                        }));
                                    }}
                                    options={lab}
                                    className="form-control"
                                    placeholder="Select lab results..."
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
                                /><Form.Label></Form.Label>
                            <Form.Label>Preliminary Diagnosis </Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>

                                <Form.Control
                                    as="textarea"
                                    name="patientDiagnosis"
                                    value={formData.patientDiagnosis}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Patient Diagnosis"
                                    required
                                    className={`form-control ${!formData.patientDiagnosis ? 'is-invalid' : ''}`}
                                />
                                <Form.Control
                                    as="textarea"
                                    name="patientSecondaryDiagnosis"
                                    value={formData.patientSecondaryDiagnosis}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Patient's Secondary Diagnosis"
                                    required
                                    className={`form-control ${!formData.patientSecondaryDiagnosis ? 'is-invalid' : ''}`}
                                />
                                </div>
                                <Form.Select
                                name="admission"
                                value={formData.admission}
                                onChange={handleChange}
                                required
                                className={`form-control ${!formData.admission ? 'is-invalid' : ''}`}
                            >
                                <option value="" disabled>Admission</option>
                                {admission.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </Form.Select>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control
                                    as="textarea"
                                    name="patientProcedure"
                                    value={formData.patientProcedure}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Procedure's conducted on Patient"
                                    required
                                    className={`form-control ${!formData.patientProcedure ? 'is-invalid' : ''}`}
                                />
                                <Form.Control
                                    as="textarea"
                                    name="patientMedicine"
                                    value={formData.patientMedicine}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Medication provided to Patient"
                                    required
                                    className={`form-control ${!formData.patientProcedure ? 'is-invalid' : ''}`}
                                />
                                <Form.Select
                                name="followup"
                                value={formData.followup}
                                onChange={handleChange}
                                required
                                className={`form-control ${!formData.followup ? 'is-invalid' : ''}`}
                            >
                                <option value="" disabled>Follow Up?</option>
                                {followup.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </Form.Select>
                                </div> 
                            </>
                        ) : bbCodeVersion === 21 ? ( // GENERAL CONSULTATION (PBC)
                            <>
                                                            <p>If you require assistance with this form <a href="https://phmc.gta.world/viewforum.php?f=66" target="_blank" rel="noopener noreferrer">use this link! It should contain the information you require.  </a> If you still need help, use the PHMC Discord. </p>

                                <Form.Control
                                    type="text"
                                    name="patientID"
                                    value={formData.patientID}
                                    onChange={handleChange}
                                    placeholder="Patient ID"
                                    required
                                    className={`form-control ${!formData.patientID ? 'is-invalid' : ''}`}
                                />

                                <Form.Label>Date:</Form.Label>
                                <Form.Control
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.date ? 'is-invalid' : ''}`}
                                />

                                <div className="radio-inline-container">

                                    <span className="radio-text">Role:</span>
                                    <Form.Check
                                        type="radio"
                                        id="doctorRank"
                                        label="   Doctor"
                                        checked={isDoctor}
                                        onChange={handlePHMCRank('doctor')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="nurseRank"
                                        label="   Nurse"
                                        checked={isNurse}
                                        onChange={handlePHMCRank('nurse')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="psychRank"
                                        label="   Psychiatrist"
                                        checked={isPsych}
                                        onChange={handlePHMCRank('psych')}
                                        inline
                                    />  </div>
                                <Form.Label></Form.Label>
                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        // eslint-disable-next-line no-unused-vars
                                        const lastName = selectedOption ? selectedOption.lastName : '';
                                        setFormData(prev => ({
                                            ...prev,
                                            phmcEmployee: selectedOption ? selectedOption.value : '',
                                            lastName: selectedOption ? selectedOption.lastName : '' // Use lastName from the selected option
                                        }));
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"
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
                                <Form.Label></Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control
                                    type="text"
                                    name="patientChiefComplaint"
                                    value={formData.patientChiefComplaint}
                                    onChange={handleChange}
                                    placeholder="Patient Chief Complaint"
                                    required
                                    className={`form-control ${!formData.patientChiefComplaint ? 'is-invalid' : ''}`}
                                />
                            <Form.Select
                                    name="paletoClinicDepartment"
                                    value={formData.paletoClinicDepartment}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.paletoClinicDepartment ? 'is-invalid' : ''}`}
                                >
                                    <option value="" disabled>Assigned Department</option>
                                    {paletoClinicDepartment.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </Form.Select></div> 


                                <Form.Label>Vitals Section </Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Select
                                                name="vitals"
                                                value={formData.vitals}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.vitals ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Vitals</option>
                                                {vitals.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="heartRate"
                                                value={formData.heartRate}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.heartRate ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Heart Rate</option>
                                                {heartRate.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="breathing"
                                                value={formData.breathing}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.breathing ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Breathing</option>
                                                {breathing.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="bloodPressure"
                                                value={formData.bloodPressure}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.bloodPressure ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Blood Pressure</option>
                                                {bloodPressure.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            </div>
                                            <Form.Label>Findings </Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Select
                                                name="findings"
                                                value={formData.findings}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.findings ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>General Health Conditions</option>
                                                {findings.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="lungs"
                                                value={formData.lungs}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.lungs ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Patient Lungs</option>
                                                {lungs.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="pupils"
                                                value={formData.pupils}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.pupils ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Patient Pupils</option>
                                                {pupils.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                            
                                            <Form.Select
                                                name="wounds"
                                                value={formData.wounds}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.wounds ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Patient Wounds</option>
                                                {wounds.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="ecg"
                                                value={formData.ecg}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.wounds ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>ECG Results</option>
                                                {ecg.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="sono"
                                                value={formData.sono}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.wounds ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Sonography Results</option>
                                                {sono.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            </div>
                                <Select
                                    isMulti
                                    name="lab"
                                    value={lab.filter(option =>
                                        formData.lab.includes(option.value)
                                    )}
                                    onChange={(selectedOptions) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            lab: selectedOptions ? selectedOptions.map(option => option.value) : []
                                        }));
                                    }}
                                    options={lab}
                                    className="form-control"
                                    placeholder="Select lab results..."
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
                                /><Form.Label></Form.Label>

                            <Form.Label>Preliminary Diagnosis </Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>

                                <Form.Control
                                    as="textarea"
                                    name="patientDiagnosis"
                                    value={formData.patientDiagnosis}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Patient Diagnosis"
                                    required
                                    className={`form-control ${!formData.patientDiagnosis ? 'is-invalid' : ''}`}
                                />
                                <Form.Control
                                    as="textarea"
                                    name="patientSecondaryDiagnosis"
                                    value={formData.patientSecondaryDiagnosis}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Patient's Secondary Diagnosis"
                                    required
                                    className={`form-control ${!formData.patientSecondaryDiagnosis ? 'is-invalid' : ''}`}
                                />
                                </div>
                                <Form.Select
                                name="admission"
                                value={formData.admission}
                                onChange={handleChange}
                                required
                                className={`form-control ${!formData.admission ? 'is-invalid' : ''}`}
                            >
                                <option value="" disabled>Admission</option>
                                {admission.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </Form.Select>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control
                                    as="textarea"
                                    name="patientProcedure"
                                    value={formData.patientProcedure}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Procedure's conducted on Patient"
                                    required
                                    className={`form-control ${!formData.patientProcedure ? 'is-invalid' : ''}`}
                                />
                                <Form.Control
                                    as="textarea"
                                    name="patientMedicine"
                                    value={formData.patientMedicine}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Medication provided to Patient"
                                    required
                                    className={`form-control ${!formData.patientMedicine ? 'is-invalid' : ''}`}
                                />
                                <Form.Select
                                name="followup"
                                value={formData.followup}
                                onChange={handleChange}
                                required
                                className={`form-control ${!formData.followup ? 'is-invalid' : ''}`}
                            >
                                <option value="" disabled>Follow Up?</option>
                                {followup.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </Form.Select>
                                </div> 

                            </>
                        ) : bbCodeVersion === 22 ? ( // COMMENTARY NOTE (phmc)
                            <>
                                <Form.Control
                                    type="text"
                                    name="patientID"
                                    value={formData.patientID}
                                    onChange={handleChange}
                                    placeholder="Patient ID"
                                    required
                                    className="form-control"
                                />

                                <Form.Label>Date:</Form.Label>
                                <Form.Control
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    className="form-control"
                                />
                                <Form.Label></Form.Label>
                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        // eslint-disable-next-line no-unused-vars
                                        const lastName = selectedOption ? selectedOption.lastName : '';
                                        setFormData(prev => ({
                                            ...prev,
                                            phmcEmployee: selectedOption ? selectedOption.value : '',
                                            lastName: selectedOption ? selectedOption.lastName : '' // Use lastName from the selected option
                                        }));
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"
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
                                <Form.Label></Form.Label>
                                <Select
                                    name="departmentLarge"
                                    value={departmentLarge.find(option => option.value === formData.departmentLarge)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            departmentLarge: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={departmentLarge}
                                    isClearable
                                    placeholder="Select Department..."
                                    className="form-control"
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
                                <Form.Label></Form.Label>

                            </>
                        ) : bbCodeVersion === 23 ? ( // COMMENTARY NOTE (PBC)
                            <>
                                <Form.Control
                                    type="text"
                                    name="patientID"
                                    value={formData.patientID}
                                    onChange={handleChange}
                                    placeholder="Patient ID"
                                    required
                                    className="form-control"
                                />

                                <Form.Label>Date:</Form.Label>
                                <Form.Control
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    className="form-control"
                                />
                                <Form.Label></Form.Label>
                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        // eslint-disable-next-line no-unused-vars
                                        const lastName = selectedOption ? selectedOption.lastName : '';
                                        setFormData(prev => ({
                                            ...prev,
                                            phmcEmployee: selectedOption ? selectedOption.value : '',
                                            lastName: selectedOption ? selectedOption.lastName : '' // Use lastName from the selected option
                                        }));
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"
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
                                <Form.Label></Form.Label>
                                <Select
                                    name="departmentLarge"
                                    value={departmentLarge.find(option => option.value === formData.departmentLarge)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            departmentLarge: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={departmentLarge}
                                    isClearable
                                    placeholder="Select Department..."
                                    className="form-control"
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
                                <Form.Label></Form.Label>

                            </>
                     ) : bbCodeVersion === 24 ? ( // Medical Record Release
                                                        <>
                                                        
                                <Form.Group className="mb-3">
                                <Form.Label>Title / First Name / Middle Name / Lastname / Date of Birth</Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                            <Form.Select
                                            name="patientTitle"
                                            value={formData.patientTitle}
                                            onChange={handleChange}
                                            required
                                            className={`form-control ${!formData.patientTitle ? 'is-invalid' : ''}`}
                                        >
                                            <option value="" disabled>Title</option>
                                            {patientTitle.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </Form.Select>
                                        <Form.Control
                                            type="text"
                                            name="patientFirstName"
                                            value={formData.patientFirstName}
                                            onChange={handleChange}
                                            placeholder="First Name"
                                            required
                                            className={`form-control ${!formData.patientFirstName ? 'is-invalid' : ''}`}

                                        />

                                        <Form.Control
                                            type="text"
                                            name="patientMiddleName"
                                            value={formData.patientMiddleName}
                                            onChange={handleChange}
                                            placeholder="Middle Name (Optional)"
                                            className={`form-control ${!formData.patientMiddleName ? 'is-invalid' : ''}`}

                                        />
                                            <Form.Control
                                            type="text"
                                            name="patientLastName"
                                            value={formData.patientLastName}
                                            onChange={handleChange}
                                            placeholder="Last Name"
                                            required
                                            className={`form-control ${!formData.patientLastName ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="date"
                                            name="patientDateOfBirth"
                                            value={formData.patientDateOfBirth}
                                            onChange={handleChange}
                                            placeholder="Date of Birth"
                                            required
                                            className={`form-control ${!formData.patientDateOfBirth ? 'is-invalid' : ''}`}

                                        />

                                    </div>
                                    <Form.Label>Gender:</Form.Label>
                                        <Form.Check
                                            type="radio"
                                            label="   Male"
                                            name="patientGender"
                                            value="Male"
                                            checked={formData.patientGender === 'Male'}
                                            onChange={handleChange}
                                        />
                                        <Form.Check
                                            type="radio"
                                            label="   Female"
                                            name="patientGender"
                                            value="Female"
                                            checked={formData.patientGender === 'Female'}
                                            onChange={handleChange}
                                        />

                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Address & ZIP / Postal Code</Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="patientAddress"
                                            value={formData.patientAddress}
                                            onChange={handleChange}
                                            placeholder="Address (Number, Floor, Street)"
                                            required
                                            className={`form-control ${!formData.patientAddress ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientZIP"
                                            value={formData.patientZIP}
                                            onChange={handleChange}
                                            placeholder="ZIP / Postal Code ((You can make this up))"
                                            required
                                            className={`form-control ${!formData.patientZIP ? 'is-invalid' : ''}`}

                                        />
                                    </div>
                                </Form.Group>
                                    <Form.Label>Contact Information</Form.Label>
                                    <div className="input-group">
                                    <Form.Select
                                    name="patientPhoneType"
                                    value={formData.patientPhoneType}
                                    onChange={(e) => {
                                        const selectedType = e.target.value;
                                        setFormData(prev => ({
                                            ...prev,
                                            patientPhoneType: selectedType,
                                            patientPhoneMobile: selectedType === 'Mobile' ? prev.patientPhoneMobile : '',
                                            patientPhoneHome: selectedType === 'Home' ? prev.patientPhoneHome : '',
                                            patientPhoneWork: selectedType === 'Work' ? prev.patientPhoneWork : '',
                                            patientPhoneOther: selectedType === 'Other' ? prev.patientPhoneOther : '',
                                        }));
                                    }}
                                    required
                                    className={`form-control ${!formData.patientPhoneType ? 'is-invalid' : ''}`}
                                >
                                    <option value="" disabled>Phone Type</option>
                                    {patientPhone.map((option) => (
                                        <option key={option.value} value={option.value}>{option.value}</option>
                                    ))}
                                </Form.Select>        
                                                               
                                 <Form.Control
                                            type="text"
                                            name="patientPH"
                                            value={formData.patientPH}
                                            onChange={handleChange}
                                            placeholder="Phone Number"
                                            required
                                            className={`form-control ${!formData.patientPH ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientEmail"
                                            value={formData.patientEmail}
                                            onChange={handleChange}
                                            placeholder="Email Address"
                                            required
                                            className={`form-control ${!formData.patientEmail ? 'is-invalid' : ''}`}

                                        />
                                    </div>
                                    <Form.Label>Purpose of Medical Information Release</Form.Label>
                                    <Form.Select
                                    name="CarePurposeMedicalInformationRelease"
                                    value={formData.CarePurposeMedicalInformationRelease}
                                    onChange={(e) => {
                                        const selectedType = e.target.value;
                                        setFormData(prev => ({
                                            ...prev,
                                            CarePurposeMedicalInformationRelease: selectedType,
                                            PurposeFurtherCare: selectedType === 'Further Treatment' ? prev.PurposeFurtherCare : '',
                                            PurposePersonal: selectedType === 'Personal' ? prev.PurposePersonal : '',
                                            PurposeAttorney: selectedType === 'Attorney' ? prev.PurposeAttorney : '',
                                            PurposeOther: selectedType === 'Other' ? prev.PurposeOther : '',
                                        }));
                                    }}
                                    required
                                    className={`form-control ${!formData.CarePurposeMedicalInformationRelease ? 'is-invalid' : ''}`}
                                >
                                    <option value="" disabled>Release Information</option>
                                    {PurposeMedicalInformationRelease.map((option) => (
                                        <option key={option.value} value={option.value}>{option.value}</option>
                                    ))}
                                </Form.Select>
                                {formData.CarePurposeMedicalInformationRelease === 'Other' && (
                                    <Form.Control
                                        type="text"
                                        name="patientMedInfoReleaseOther"
                                        value={formData.patientMedInfoReleaseOther}
                                        onChange={handleChange}
                                        placeholder="Add a different release reason (Ex: Insurance / Courts)"
                                        required
                                        className={`form-control ${!formData.patientMedInfoReleaseOther ? 'is-invalid' : ''}`}

                                    />
                                )}

                                    <Form.Label>Format of Medical Information Release </Form.Label>
                                    <Form.Select
                                    name="PurposeMedicalInformationReleaseFormat"
                                    value={formData.PurposeMedicalInformationReleaseFormat || ""}
                                    onChange={(e) => {
                                        const selectedType = e.target.value;
                                        setFormData(prev => ({
                                            ...prev,
                                            PurposeMedicalInformationReleaseFormat: selectedType,
                                            CopyofRecords: selectedType === 'CopyofRecords' ? prev.CopyofRecords : '',
                                            VerbalRelease: selectedType === 'VerbalRelease' ? prev.VerbalRelease : '',
                                            ElectronicRelease: selectedType === 'ElectronicRelease' ? prev.ElectronicRelease : '',
                                            Other: selectedType === 'Other' ? prev.Other : '',
                                        }));
                                    }}
                                    required
                                    className={`form-control ${!formData.PurposeMedicalInformationReleaseFormat ? 'is-invalid' : ''}`}
                                >
                                    <option value="" disabled>Release Information</option>
                                    {PurposeMedicalInformationReleaseFormat.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </Form.Select>                               
                                 {formData.PurposeMedicalInformationReleaseFormat === 'Other' && (
                                    <Form.Control
                                        type="text"
                                        name="patientMedInfoFormatOther"
                                        value={formData.patientMedInfoFormatOther}
                                        onChange={handleChange}
                                        placeholder="Add a different release option (Ex: FAX)"
                                        required
                                        className={`form-control ${!formData.patientMedInfoFormatOther ? 'is-invalid' : ''}`}

                                    />
                                )}
                                  <Form.Label>Record Release Time Frame </Form.Label>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="StupidDateFrom"
                                            value={formData.StupidDateFrom}
                                            onChange={handleChange}
                                            placeholder="Treatment Date From"
                                            required
                                            className={`form-control ${!formData.StupidDateFrom ? 'is-invalid' : ''}`}
                                        />
                                        <Form.Control
                                        type="text"
                                        name="StupidDateTo"
                                        value={formData.StupidDateTo}
                                        onChange={handleChange}
                                        placeholder="Treatment Date To"
                                        required
                                        className={`form-control ${!formData.StupidDateTo ? 'is-invalid' : ''}`}
                                        />
                                    </div>

                                    <Form.Label>Medical Records to be Released </Form.Label>
                                    <Select
                                            isMulti
                                            name="MedicalRecordsRelease"
                                            value={formData.MedicalRecordsRelease ? MedicalRecordsRelease.filter(option =>
                                                formData.MedicalRecordsRelease.includes(option.value)
                                            ) : []}
                                                onChange={(selectedOptions) => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    MedicalRecordsRelease: selectedOptions ? selectedOptions.map(option => option.value) : []
                                                }));
                                            }}
                                            options={MedicalRecordsRelease}
                                            className={`form-control ${!formData.MedicalRecordsRelease ? 'is-invalid' : ''}`}
                                            placeholder="Select Release Options (Multiple Choice)"
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
                                                                        <Form.Label></Form.Label>                                                               

                                    {formData.MedicalRecordsRelease && formData.MedicalRecordsRelease.includes('Other') && (
                                    <Form.Control
                                        type="text"
                                        name="MedicalRecordsReleaseOther"
                                        value={formData.MedicalRecordsReleaseOther}
                                        onChange={handleChange}
                                        placeholder="Please specify other records to be released"
                                        required
                                    />
                                )}
                                    <Form.Label></Form.Label>                                                               
                                    <Form.Label></Form.Label>
                            <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        handleChange({
                                            target: {
                                                name: 'phmcEmployee',
                                                value: selectedOption?.value || ''
                                            }
                                        });
                                        if (selectedOption) {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: selectedOption.signature || ''
                                            }));
                                        } else {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: ''
                                            }));
                                        }
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Which Doctor Treated You? (You can type to search!)"
                                    className="form-control"
                                    styles={{
                                        control: (base) => ({
                                            ...base,
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
                                        }),
                                        group: (base) => ({
                                            ...base,
                                            paddingTop: 8,
                                            paddingBottom: 8
                                        }),
                                        groupHeading: (base) => ({
                                            ...base,
                                            color: '#6c757d',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            fontSize: '0.75rem',
                                            marginBottom: 4
                                        })
                                    }}
                                />
                                    <Form.Label></Form.Label>

                                    <Form.Label>Authorization For Release Information</Form.Label>
                                    <Form.Control
    type="date"
    name="SubmitDate"
    value={formData.SubmitDate || new Date().toISOString().split('T')[0]}
    onChange={handleChange}
    readOnly
                                />                                            
                                </>
                                                     ) : bbCodeVersion === 25 ? ( // Basic Patient File
                                                        <>
                                                        
                                <Form.Group className="mb-3">
                                <Form.Label>Patient ID, leave blank if unsure</Form.Label>
                                <Form.Control
                                            type="text"
                                            name="patientID"
                                            value={formData.patientID}
                                            onChange={handleChange}
                                            placeholder="Patient ID  (Optional)"
                                            className={`form-control ${!formData.patientID ? 'is-invalid' : ''}`}

                                        />
                                <Form.Label>Title / Patient Name Name  / Date of Birth</Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Select
                                    name="patientTitle"
                                    value={formData.patientTitle}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.patientTitle ? 'is-invalid' : ''}`}
                                >
                                    <option value="" disabled>Title</option>
                                    {patientTitle.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </Form.Select>
                                        <Form.Control
                                            type="text"
                                            name="patientName"
                                            value={formData.patientName}
                                            onChange={handleChange}
                                            placeholder="Patient Name"
                                            required
                                            className={`form-control ${!formData.patientName ? 'is-invalid' : ''}`}

                                        />

                                        <Form.Control
                                            type="date"
                                            name="date"
                                            value={formData.date}
                                            onChange={handleChange}
                                            placeholder="Date of Birth"
                                            required
                                            className={`form-control ${!formData.date ? 'is-invalid' : ''}`}

                                        />
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <Form.Control
                                            type="text"
                                            name="patientAddress"
                                            value={formData.patientAddress}
                                            onChange={handleChange}
                                            placeholder="Patient Home Address"
                                            required
                                            className={`form-control ${!formData.patientAddress ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientGender"
                                            value={formData.patientGender}
                                            onChange={handleChange}
                                            placeholder="Patient Gender"
                                            required
                                            className={`form-control ${!formData.patientGender ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientRace"
                                            value={formData.patientRace}
                                            onChange={handleChange}
                                            placeholder="Patient Race"
                                            required
                                            className={`form-control ${!formData.patientRace ? 'is-invalid' : ''}`}

                                        />

                                    </div>

                                </Form.Group>
                                    <div className="input-group">                                                               
                                 <Form.Control
                                            type="text"
                                            name="patientPH"
                                            value={formData.patientPH}
                                            onChange={handleChange}
                                            placeholder="Patient Phone Number"
                                            required
                                            className={`form-control ${!formData.patientPH ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientDiscord"
                                            value={formData.patientDiscord}
                                            onChange={handleChange}
                                            placeholder="(( Patient Discord ID )) "
                                            required
                                            className={`form-control ${!formData.patientDiscord ? 'is-invalid' : ''}`}

                                        />
                                    </div>

                                    <Form.Label>Emergency Contact Information </Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="patientEmergencyContact"
                                            value={formData.patientEmergencyContact}
                                            onChange={handleChange}
                                            placeholder="Emergency Contact Full Name"
                                            required
                                            className={`form-control ${!formData.patientEmergencyContact ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientEmergencyContactRelation"
                                            value={formData.patientEmergencyContactRelation}
                                            onChange={handleChange}
                                            placeholder="Emergency Contact Relation to Patient"
                                            required
                                            className={`form-control ${!formData.patientEmergencyContactRelation ? 'is-invalid' : ''}`}

                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="patientEmergencyContactNumber"
                                            value={formData.patientEmergencyContactNumber}
                                            onChange={handleChange}
                                            placeholder="Emergency Contact Contact Number"
                                            required
                                            className={`form-control ${!formData.patientEmergencyContactNumber ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientEmergencyContactDiscord"
                                            value={formData.patientEmergencyContactDiscord}
                                            onChange={handleChange}
                                            placeholder="(( Patient Emergency Contact Discord )) "
                                            required
                                            className={`form-control ${!formData.patientEmergencyContactDiscord ? 'is-invalid' : ''}`}

                                        />
                                    </div>
                                  <Form.Label>Medical History </Form.Label>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Select
                                    name="patientBloodType"
                                    value={formData.patientBloodType || ""}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.patientBloodType ? 'is-invalid' : ''}`}
                                >
                                    <option value="" disabled>Patient Blood Type</option>
                                    {patientBloodType.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </Form.Select>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="patientAllergies"
                                            value={formData.patientAllergies}
                                            onChange={handleChange}
                                            placeholder="Patient Known Allergies"
                                            required
                                            className={`form-control ${!formData.patientAllergies ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientCurrentMedicine"
                                            value={formData.patientCurrentMedicine}
                                            onChange={handleChange}
                                            placeholder="Patient Current Medicine"
                                            required
                                            className={`form-control ${!formData.patientCurrentMedicine ? 'is-invalid' : ''}`}

                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="patientChronicDiseases"
                                            value={formData.patientChronicDiseases}
                                            onChange={handleChange}
                                            placeholder="Patient Chronic Conditions"
                                            required
                                            className={`form-control ${!formData.patientChronicDiseases ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientNotes"
                                            value={formData.patientNotes}
                                            onChange={handleChange}
                                            placeholder="Patient Traumas & Injuries"
                                            required
                                            className={`form-control ${!formData.patientNotes ? 'is-invalid' : ''}`}

                                        />
                                    </div>

                                </>
                                                     ) : bbCodeVersion === 26 ? ( //Staff Basic Patient File
                                                        <>
                                                        
                                <Form.Group className="mb-3">
                                <Form.Label>Patient ID, leave blank if unsure</Form.Label>
                                <Form.Control
                                            type="text"
                                            name="patientID"
                                            value={formData.patientID}
                                            onChange={handleChange}
                                            placeholder="Patient ID  (Optional)"
                                            className={`form-control ${!formData.patientID ? 'is-invalid' : ''}`}

                                        />
                                <Form.Label>Title / Patient Name Name  / Date of Birth</Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Select
                                    name="patientTitle"
                                    value={formData.patientTitle}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.patientTitle ? 'is-invalid' : ''}`}
                                >
                                    <option value="" disabled>Title</option>
                                    {patientTitle.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </Form.Select>
                                        <Form.Control
                                            type="text"
                                            name="patientName"
                                            value={formData.patientName}
                                            onChange={handleChange}
                                            placeholder="Patient Name"
                                            required
                                            className={`form-control ${!formData.patientName ? 'is-invalid' : ''}`}

                                        />

                                        <Form.Control
                                            type="date"
                                            name="date"
                                            value={formData.date}
                                            onChange={handleChange}
                                            placeholder="Date of Birth"
                                            required
                                            className={`form-control ${!formData.date ? 'is-invalid' : ''}`}

                                        />
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <Form.Control
                                            type="text"
                                            name="patientAddress"
                                            value={formData.patientAddress}
                                            onChange={handleChange}
                                            placeholder="Patient Home Address"
                                            required
                                            className={`form-control ${!formData.patientAddress ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientGender"
                                            value={formData.patientGender}
                                            onChange={handleChange}
                                            placeholder="Patient Gender"
                                            required
                                            className={`form-control ${!formData.patientGender ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientRace"
                                            value={formData.patientRace}
                                            onChange={handleChange}
                                            placeholder="Patient Race"
                                            required
                                            className={`form-control ${!formData.patientRace ? 'is-invalid' : ''}`}

                                        />

                                    </div>

                                </Form.Group>
                                    <div className="input-group">                                                               
                                 <Form.Control
                                            type="text"
                                            name="patientPH"
                                            value={formData.patientPH}
                                            onChange={handleChange}
                                            placeholder="Patient Phone Number"
                                            required
                                            className={`form-control ${!formData.patientPH ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientDiscord"
                                            value={formData.patientDiscord}
                                            onChange={handleChange}
                                            placeholder="(( Patient Discord ID )) "
                                            required
                                            className={`form-control ${!formData.patientDiscord ? 'is-invalid' : ''}`}

                                        />
                                    </div>

                                    <Form.Label>Emergency Contact Information </Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="patientEmergencyContact"
                                            value={formData.patientEmergencyContact}
                                            onChange={handleChange}
                                            placeholder="Emergency Contact Full Name"
                                            required
                                            className={`form-control ${!formData.patientEmergencyContact ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientEmergencyContactRelation"
                                            value={formData.patientEmergencyContactRelation}
                                            onChange={handleChange}
                                            placeholder="Emergency Contact Relation to Patient"
                                            required
                                            className={`form-control ${!formData.patientEmergencyContactRelation ? 'is-invalid' : ''}`}

                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="patientEmergencyContactNumber"
                                            value={formData.patientEmergencyContactNumber}
                                            onChange={handleChange}
                                            placeholder="Emergency Contact Contact Number"
                                            required
                                            className={`form-control ${!formData.patientEmergencyContactNumber ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientEmergencyContactDiscord"
                                            value={formData.patientEmergencyContactDiscord}
                                            onChange={handleChange}
                                            placeholder="(( Patient Emergency Contact Discord )) "
                                            required
                                            className={`form-control ${!formData.patientEmergencyContactDiscord ? 'is-invalid' : ''}`}

                                        />
                                    </div>
                                  <Form.Label>Medical History </Form.Label>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Select
                                    name="patientBloodType"
                                    value={formData.patientBloodType || ""}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.patientBloodType ? 'is-invalid' : ''}`}
                                >
                                    <option value="" disabled>Patient Blood Type</option>
                                    {patientBloodType.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </Form.Select>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="patientAllergies"
                                            value={formData.patientAllergies}
                                            onChange={handleChange}
                                            placeholder="Patient Known Allergies"
                                            required
                                            className={`form-control ${!formData.patientAllergies ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientCurrentMedicine"
                                            value={formData.patientCurrentMedicine}
                                            onChange={handleChange}
                                            placeholder="Patient Current Medicine"
                                            required
                                            className={`form-control ${!formData.patientCurrentMedicine ? 'is-invalid' : ''}`}

                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="patientChronicDiseases"
                                            value={formData.patientChronicDiseases}
                                            onChange={handleChange}
                                            placeholder="Patient Chronic Conditions"
                                            required
                                            className={`form-control ${!formData.patientChronicDiseases ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientNotes"
                                            value={formData.patientNotes}
                                            onChange={handleChange}
                                            placeholder="Patient Traumas & Injuries"
                                            required
                                            className={`form-control ${!formData.patientNotes ? 'is-invalid' : ''}`}

                                        />
                                    </div>

                                </>
                                                     ) : bbCodeVersion === 27 ? ( //PHMC Email Internal
                                                        <>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="patientNotes"
                                            value={formData.patientNotes}
                                            onChange={handleChange}
                                            placeholder="Email Subject"
                                            required
                                            className={`form-control ${!formData.patientNotes ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="decedentName"
                                            value={formData.decedentName}
                                            onChange={handleChange}
                                            placeholder="Email Recipient"
                                            required
                                            className={`form-control ${!formData.decedentName ? 'is-invalid' : ''}`}

                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                        as="textarea"
                                        name="synopsis"
                                        value={formData.synopsis}
                                        onChange={handleChange}
                                        rows="4"
                                        placeholder="Email Body"
                                        required
                                        className={`form-control ${!formData.synopsis ? 'is-invalid' : ''}`}
                                    />
                                    </div>
                                    <Form.Group className="mb-3 upload-container">
                                    <InputGroup>
                                        <Form.Control
                                            as="textarea"
                                            rows="4"
                                            name="scenePhotos"
                                            value={formData.scenePhotos}
                                            onChange={handleChange}
                                            required
                                            className={`form-control ${!formData.scenePhotos ? 'is-invalid' : ''}`}
                                            placeholder="Employee Signature Image"
                                            onPaste={(e) => {
                                                console.log('Paste event triggered');
                                                const clipboardData = e.clipboardData || window.clipboardData;
                                                const pastedData = clipboardData.getData('text');
                                                const items = clipboardData.items;

                                                console.log('Pasted content:', pastedData);
                                                console.log('Clipboard items:', items);

                                                let hasImageItem = false;

                                                // Check if pasted content is a URL
                                                const urlRegex = /(https?:\/\/[^\s]+)/g;
                                                const containsUrl = urlRegex.test(pastedData);

                                                console.log('Contains URL:', containsUrl);

                                                // Handle image files from clipboard
                                                for (let i = 0; i < items.length; i++) {
                                                    console.log('Checking item:', items[i].type);
                                                    if (items[i].type.indexOf('image') !== -1) {
                                                        hasImageItem = true;
                                                        const file = items[i].getAsFile();
                                                        handleImageUpload({ target: { files: [file] } }, 'scenePhotos');
                                                        e.preventDefault();
                                                        break;
                                                    }
                                                }

                                                // If it's a URL and not an image file, allow direct paste
                                                if (containsUrl && !hasImageItem) {
                                                    console.log('Processing URL paste');

                                                    // Get current value and cursor position
                                                    const currentValue = formData.scenePhotos || '';
                                                    const cursorPos = e.target.selectionStart;

                                                    console.log('Current value:', currentValue);
                                                    console.log('Cursor position:', cursorPos);

                                                    // Add comma if there's existing content
                                                    const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                                                    const newValue = currentValue.slice(0, cursorPos) +
                                                        (cursorPos > 0 ? separator : '') +
                                                        pastedData +
                                                        currentValue.slice(cursorPos);

                                                    console.log('New value:', newValue);

                                                    // Update form data
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        scenePhotos: newValue
                                                    }));

                                                    e.preventDefault();
                                                } else {
                                                    console.log('No URL detected or image item present');
                                                }
                                            }}
                                        />
                                        <Button
                                            variant="success"
                                            disabled={isUploading}
                                            onClick={() => {
                                                const input = document.createElement('input');
                                                input.type = 'file';
                                                input.accept = 'image/*';
                                                input.multiple = true;
                                                input.onchange = (e) => handleImageUpload(e, 'scenePhotos');
                                                input.click();
                                            }}
                                        >
                                            <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                                            {isUploading ? 'Uploading...' : 'Upload Images'}
                                        </Button>

                                    </InputGroup>
                                    <span className="helper-text">
                                    This supports clipboard uploading, ctrl + V! | Hosted by Imgur! - <a href="https://imgur.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                                    </span>
                                </Form.Group>

                                    <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        // eslint-disable-next-line no-unused-vars
                                        const lastName = selectedOption ? selectedOption.lastName : '';
                                        setFormData(prev => ({
                                            ...prev,
                                            phmcEmployee: selectedOption ? selectedOption.value : '',
                                            lastName: selectedOption ? selectedOption.lastName : '' // Use lastName from the selected option
                                        }));
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"
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
                                <Form.Label></Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="decedentOOC"
                                            value={formData.decedentOOC}
                                            onChange={handleChange}
                                            placeholder="PHMC Rank / Position"
                                            required
                                            className={`form-control ${!formData.decedentOOC ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientCareer"
                                            value={formData.patientCareer}
                                            onChange={handleChange}
                                            placeholder="Assigned Department"
                                            required
                                            className={`form-control ${!formData.patientCareer ? 'is-invalid' : ''}`}

                                        />
                                    </div>

                                    </>
                                                     ) : bbCodeVersion === 28 ? ( //PHMC Shrink Internal
                                                        <>
                                <Form.Control
                                    type="text"
                                    name="patientID"
                                    value={formData.patientID}
                                    onChange={handleChange}
                                    placeholder="Patient ID"
                                    required
                                    className={`form-control ${!formData.patientID ? 'is-invalid' : ''}`}
                                    />

                                <Form.Label>Date:</Form.Label>
                                <Form.Control
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.date ? 'is-invalid' : ''}`}
                                    />

                                <div className="radio-inline-container">

                                    <span className="radio-text">Role:</span>
                                    <Form.Check
                                        type="radio"
                                        id="doctorRank"
                                        label="   Doctor"
                                        checked={isDoctor}
                                        onChange={handlePHMCRank('doctor')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="nurseRank"
                                        label="   Nurse"
                                        checked={isNurse}
                                        onChange={handlePHMCRank('nurse')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="psychRank"
                                        label="   Psychiatrist"
                                        checked={isPsych}
                                        onChange={handlePHMCRank('psych')}
                                        inline
                                    />  </div>
                                <Form.Label></Form.Label>

 
                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        // eslint-disable-next-line no-unused-vars
                                        const lastName = selectedOption ? selectedOption.lastName : '';
                                        setFormData(prev => ({
                                            ...prev,
                                            phmcEmployee: selectedOption ? selectedOption.value : '',
                                            lastName: selectedOption ? selectedOption.lastName : '' // Use lastName from the selected option
                                        }));
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"
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
                                <Form.Label></Form.Label>
                                        <Form.Control
                                        as="textarea"
                                        name="patientChiefComplaint"
                                        value={formData.patientChiefComplaint}
                                        onChange={handleChange}
                                        placeholder="Patient Chief Complaint"
                                        rows="3"
                                        className={`form-control ${!formData.patientChiefComplaint ? 'is-invalid' : ''}`}
                                        />

                                    <Form.Label> Presenting Problem</Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="patientVisitReason"
                                            value={formData.patientVisitReason}
                                            onChange={handleChange}
                                            placeholder="Description of the issue (eg: anxiety, depression)"
                                            required
                                            className={`form-control ${!formData.patientVisitReason ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientSymptoms"
                                            value={formData.patientSymptoms}
                                            onChange={handleChange}
                                            placeholder="Onset and duration of symptoms"
                                            required
                                            className={`form-control ${!formData.patientSymptoms ? 'is-invalid' : ''}`}

                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="patientTriggers"
                                            value={formData.patientTriggers}
                                            onChange={handleChange}
                                            placeholder="Triggers or stressors:"
                                            required
                                            className={`form-control ${!formData.patientTherapyMedicine ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientStress"
                                            value={formData.patientStress}
                                            onChange={handleChange}
                                            placeholder="Impact on daily life:"
                                            required
                                            className={`form-control ${!formData.patientCareer ? 'is-invalid' : ''}`}

                                        />
                                    </div>

                                    <Form.Label> Mental Status Examination (MSE) </Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>

                                    <Form.Select
                                            name="Appearance"
                                            value={formData.Appearance}
                                            onChange={handleChange}
                                            required
                                            className={`form-control ${!formData.Appearance ? 'is-invalid' : ''}`}
                                        >
                                            <option value="" disabled>Appearance</option>
                                            {Appearance.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </Form.Select>
                                        <Form.Select
                                            name="Behavior"
                                            value={formData.Behavior}
                                            onChange={handleChange}
                                            required
                                            className={`form-control ${!formData.Behavior ? 'is-invalid' : ''}`}
                                        >
                                            <option value="" disabled>Behavior</option>
                                            {Behavior.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </Form.Select>
                                        <Form.Select
                                            name="Speech"
                                            value={formData.Speech}
                                            onChange={handleChange}
                                            required
                                            className={`form-control ${!formData.Speech ? 'is-invalid' : ''}`}
                                        >
                                            <option value="" disabled>Speech</option>
                                            {Speech.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </Form.Select>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Select
                                                name="Mood"
                                                value={formData.Mood}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.Mood ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Mood</option>
                                                {Mood.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="Affect"
                                                value={formData.Affect}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.Affect ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Affect</option>
                                                {Behavior.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="ThoughtProcess"
                                                value={formData.ThoughtProcess}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.ThoughtProcess ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Thought Process</option>
                                                {ThoughtProcess.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Select
                                                name="ThoughtContent"
                                                value={formData.ThoughtContent}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.ThoughtContent ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Thought Content</option>
                                                {ThoughtContent.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="Insight"
                                                value={formData.Insight}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.Insight ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Insight</option>
                                                {Insight.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="Cognition"
                                                value={formData.Cognition}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.Cognition ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Cognition</option>
                                                {Cognition.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            </div>
                                            <Form.Label> Psychiatric History </Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Control
                                        as="textarea"
                                        name="patientTreatment"
                                        value={formData.patientTreatment}
                                        onChange={handleChange}
                                        placeholder="Past psychiatric diagnoses and treatments:"
                                        rows="3"
                                        className={`form-control ${!formData.patientTreatment ? 'is-invalid' : ''}`}
                                        />
                                        <Form.Control
                                        as="textarea"
                                        name="patientMedicalRecord"
                                        value={formData.patientMedicalRecord}
                                        onChange={handleChange}
                                        placeholder="Hospitalizations"
                                        rows="3"
                                        className={`form-control ${!formData.patientMedicalRecord ? 'is-invalid' : ''}`}
                                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Control
                                        as="textarea"
                                        name="patientFamily"
                                        value={formData.patientFamily}
                                        onChange={handleChange}
                                        placeholder="Family psychiatric history:"
                                        rows="3"
                                        className={`form-control ${!formData.patientFamily ? 'is-invalid' : ''}`}
                                         />
                                        <Form.Control
                                        as="textarea"
                                        name="patientJobRisks"
                                        value={formData.patientJobRisks}
                                        onChange={handleChange}
                                        placeholder="History of self-harm or suicide attempts"
                                        rows="3"
                                        className={`form-control ${!formData.patientJobRisks ? 'is-invalid' : ''}`}
                                                        />
                                        </div>
                                        <Form.Label> Medical History </Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Control
                                        as="textarea"
                                        name="patientCondition"
                                        value={formData.patientCondition}
                                        onChange={handleChange}
                                        placeholder="Current and past medical conditions:"
                                        rows="3"
                                        className={`form-control ${!formData.patientCondition ? 'is-invalid' : ''}`}
                                         />
                                        <Form.Control
                                        as="textarea"
                                        name="patientChronicDiseases"
                                        value={formData.patientChronicDiseases}
                                        onChange={handleChange}
                                        placeholder="Medications (including psychiatric and non-psychiatric):"
                                        rows="3"
                                        className={`form-control ${!formData.patientChronicDiseases ? 'is-invalid' : ''}`}
                                        />
                                        <Form.Control
                                        as="textarea"
                                        name="patientAllergies"
                                        value={formData.patientAllergies}
                                        onChange={handleChange}
                                        placeholder="Patient Allergies"
                                        rows="3"
                                        className={`form-control ${!formData.patientAllergies ? 'is-invalid' : ''}`}
                                        />
                                    </div>
                                    <Form.Label> Substance Abuse History </Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Control
                                        type="text"
                                        name="patientDrugs"
                                        value={formData.patientDrugs}
                                        onChange={handleChange}
                                        placeholder="Use of alcohol, drugs, nicotine, and other substances:"
                                        className={`form-control ${!formData.patientDrugs ? 'is-invalid' : ''}`}
                                         />
                                        <Form.Control
                                        type="text"
                                        name="patientDrugsUsage"
                                        value={formData.patientDrugsUsage}
                                        onChange={handleChange}
                                        placeholder="Frequency and duration of use:"
                                        className={`form-control ${!formData.patientDrugsUsage ? 'is-invalid' : ''}`}
                                        />
                                        <Form.Control
                                        type="text"
                                        name="patientMental"
                                        value={formData.patientMental}
                                        onChange={handleChange}
                                        placeholder="Impact on mental health"
                                        className={`form-control ${!formData.patientMental ? 'is-invalid' : ''}`}
                                        />
                                    </div>
                                    <Form.Label> Psychosocial History </Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Control
                                        type="text"
                                        name="patientFam"
                                        value={formData.patientFam}
                                        onChange={handleChange}
                                        placeholder="Childhood and family background:"
                                        className={`form-control ${!formData.patientFam ? 'is-invalid' : ''}`}
                                         />
                                        <Form.Control
                                        type="text"
                                        name="patientJob"
                                        value={formData.patientJob}
                                        onChange={handleChange}
                                        placeholder="Education and employment history:"
                                        className={`form-control ${!formData.patientJob ? 'is-invalid' : ''}`}
                                        />
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                        type="text"
                                        name="patientRelationship"
                                        value={formData.patientRelationship}
                                        onChange={handleChange}
                                        placeholder="Relationships and support system:"
                                        className={`form-control ${!formData.patientRelationship ? 'is-invalid' : ''}`}
                                        />
                                        <Form.Control
                                        type="text"
                                        name="patientLegal"
                                        value={formData.patientLegal}
                                        onChange={handleChange}
                                        placeholder="Legal issues"
                                        className={`form-control ${!formData.patientLegal ? 'is-invalid' : ''}`}
                                        />
                                    </div>
                                    <Form.Label> Risk Assessment </Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Select
                                        name="Risk"
                                        value={formData.Risk}
                                        onChange={handleChange}
                                        required
                                        className={`form-control ${!formData.Risk ? 'is-invalid' : ''}`}
                                    >
                                        <option value="" disabled>Risk Assessment</option>
                                        {Risk.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                        <Form.Control
                                        type="text"
                                        name="patientRiskAssessment"
                                        value={formData.patientRiskAssessment}
                                        onChange={handleChange}
                                        placeholder="Risk Assessment Details:"
                                        className={`form-control ${!formData.patientRiskAssessment ? 'is-invalid' : ''}`}
                                        />
                                        </div>
                                        <Form.Label> Findings </Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                        type="text"
                                        name="patientFindings"
                                        value={formData.patientFindings}
                                        onChange={handleChange}
                                        placeholder="Patient Notes / Findings:"
                                        className={`form-control ${!formData.patientFindings ? 'is-invalid' : ''}`}
                                        />
                                        </div>

                                        <Form.Label> Discharge Diagnosis </Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                        type="text"
                                        name="patientDiagnosis"
                                        value={formData.patientDiagnosis}
                                        onChange={handleChange}
                                        placeholder="Primary Diagnosis:"
                                        className={`form-control ${!formData.patientDiagnosis ? 'is-invalid' : ''}`}
                                        />
                                        </div>
                                        <Form.Label> Therapy </Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Select
                                        name="admission"
                                        value={formData.admission}
                                        onChange={handleChange}
                                        required
                                        className={`form-control ${!formData.admission ? 'is-invalid' : ''}`}
                                    >
                                        <option value="" disabled>Admission</option>
                                        {admission.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                        <Form.Control
                                        type="text"
                                        name="patientTreatmentPlan"
                                        value={formData.patientTreatmentPlan}
                                        onChange={handleChange}
                                        placeholder="Treatment Plan:"
                                        className={`form-control ${!formData.patientTreatmentPlan ? 'is-invalid' : ''}`}
                                        />
                                        <Form.Control
                                        type="text"
                                        name="patientTherapyMedicine"
                                        value={formData.patientTherapyMedicine}
                                        onChange={handleChange}
                                        placeholder="Medicine:"
                                        className={`form-control ${!formData.patientTherapyMedicine ? 'is-invalid' : ''}`}
                                        />
                                        <Form.Select
                                        name="followup"
                                        value={formData.followup}
                                        onChange={handleChange}
                                        required
                                        className={`form-control ${!formData.followup ? 'is-invalid' : ''}`}
                                    >
                                        <option value="" disabled>Follow Up</option>
                                        {followup.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>

                                        </div>
                                        <Form.Label> Treatment Plan / Recommendations </Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                        type="text"
                                        name="patientTreatmentMedicine"
                                        value={formData.patientTreatmentMedicine}
                                        onChange={handleChange}
                                        placeholder="Medications:"
                                        className={`form-control ${!formData.patientTreatmentMedicine ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                        type="text"
                                        name="patientTherapy"
                                        value={formData.patientTherapy}
                                        onChange={handleChange}
                                        placeholder="Therapy (e.g., CBT, DBT):"
                                        className={`form-control ${!formData.patientTherapy ? 'is-invalid' : ''}`}
                                        /></div> 
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                        type="text"
                                        name="patientFollowUp"
                                        value={formData.patientFollowUp}
                                        onChange={handleChange}
                                        placeholder="Follow-up appointments:"
                                        className={`form-control ${!formData.patientFollowUp ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                        type="text"
                                        name="patientSafety"
                                        value={formData.patientSafety}
                                        onChange={handleChange}
                                        placeholder="Safety planning (if at risk):"
                                        className={`form-control ${!formData.patientSafety ? 'is-invalid' : ''}`}
                                        />

                                        </div>

                                        </>
                                                     ) : bbCodeVersion === 29 ? ( //PHMC Shrink Internal
                                                        <>
                                <Form.Control
                                    type="text"
                                    name="patientID"
                                    value={formData.patientID}
                                    onChange={handleChange}
                                    placeholder="Patient ID"
                                    required
                                    className={`form-control ${!formData.patientID ? 'is-invalid' : ''}`}
                                    />

                                <Form.Label>Date:</Form.Label>
                                <Form.Control
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    className={`form-control ${!formData.date ? 'is-invalid' : ''}`}
                                    />

                                <div className="radio-inline-container">

                                    <span className="radio-text">Role:</span>
                                    <Form.Check
                                        type="radio"
                                        id="doctorRank"
                                        label="   Doctor"
                                        checked={isDoctor}
                                        onChange={handlePHMCRank('doctor')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="nurseRank"
                                        label="   Nurse"
                                        checked={isNurse}
                                        onChange={handlePHMCRank('nurse')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="psychRank"
                                        label="   Psychiatrist"
                                        checked={isPsych}
                                        onChange={handlePHMCRank('psych')}
                                        inline
                                    />  </div>
                                <Form.Label></Form.Label>

 
                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        // eslint-disable-next-line no-unused-vars
                                        const lastName = selectedOption ? selectedOption.lastName : '';
                                        setFormData(prev => ({
                                            ...prev,
                                            phmcEmployee: selectedOption ? selectedOption.value : '',
                                            lastName: selectedOption ? selectedOption.lastName : '' // Use lastName from the selected option
                                        }));
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"
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
                                <Form.Label></Form.Label>
                                        <Form.Control
                                        as="textarea"
                                        name="patientChiefComplaint"
                                        value={formData.patientChiefComplaint}
                                        onChange={handleChange}
                                        placeholder="Patient Chief Complaint"
                                        rows="3"
                                        className={`form-control ${!formData.patientChiefComplaint ? 'is-invalid' : ''}`}
                                        />

                                    <Form.Label> Presenting Problem</Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="patientVisitReason"
                                            value={formData.patientVisitReason}
                                            onChange={handleChange}
                                            placeholder="Description of the issue (eg: anxiety, depression)"
                                            required
                                            className={`form-control ${!formData.patientVisitReason ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientSymptoms"
                                            value={formData.patientSymptoms}
                                            onChange={handleChange}
                                            placeholder="Onset and duration of symptoms"
                                            required
                                            className={`form-control ${!formData.patientSymptoms ? 'is-invalid' : ''}`}

                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                            type="text"
                                            name="patientTriggers"
                                            value={formData.patientTriggers}
                                            onChange={handleChange}
                                            placeholder="Triggers or stressors:"
                                            required
                                            className={`form-control ${!formData.patientTherapyMedicine ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                            type="text"
                                            name="patientStress"
                                            value={formData.patientStress}
                                            onChange={handleChange}
                                            placeholder="Impact on daily life:"
                                            required
                                            className={`form-control ${!formData.patientCareer ? 'is-invalid' : ''}`}

                                        />
                                    </div>

                                    <Form.Label> Mental Status Examination (MSE) </Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>

                                    <Form.Select
                                            name="Appearance"
                                            value={formData.Appearance}
                                            onChange={handleChange}
                                            required
                                            className={`form-control ${!formData.Appearance ? 'is-invalid' : ''}`}
                                        >
                                            <option value="" disabled>Appearance</option>
                                            {Appearance.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </Form.Select>
                                        <Form.Select
                                            name="Behavior"
                                            value={formData.Behavior}
                                            onChange={handleChange}
                                            required
                                            className={`form-control ${!formData.Behavior ? 'is-invalid' : ''}`}
                                        >
                                            <option value="" disabled>Behavior</option>
                                            {Behavior.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </Form.Select>
                                        <Form.Select
                                            name="Speech"
                                            value={formData.Speech}
                                            onChange={handleChange}
                                            required
                                            className={`form-control ${!formData.Speech ? 'is-invalid' : ''}`}
                                        >
                                            <option value="" disabled>Speech</option>
                                            {Speech.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </Form.Select>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Select
                                                name="Mood"
                                                value={formData.Mood}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.Mood ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Mood</option>
                                                {Mood.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="Affect"
                                                value={formData.Affect}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.Affect ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Affect</option>
                                                {Behavior.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="ThoughtProcess"
                                                value={formData.ThoughtProcess}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.ThoughtProcess ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Thought Process</option>
                                                {ThoughtProcess.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Select
                                                name="ThoughtContent"
                                                value={formData.ThoughtContent}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.ThoughtContent ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Thought Content</option>
                                                {ThoughtContent.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="Insight"
                                                value={formData.Insight}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.Insight ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Insight</option>
                                                {Insight.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            <Form.Select
                                                name="Cognition"
                                                value={formData.Cognition}
                                                onChange={handleChange}
                                                required
                                                className={`form-control ${!formData.Cognition ? 'is-invalid' : ''}`}
                                            >
                                                <option value="" disabled>Cognition</option>
                                                {Cognition.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </Form.Select>
                                            </div>
                                            <Form.Label> Psychiatric History </Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Control
                                        as="textarea"
                                        name="patientTreatment"
                                        value={formData.patientTreatment}
                                        onChange={handleChange}
                                        placeholder="Past psychiatric diagnoses and treatments:"
                                        rows="3"
                                        className={`form-control ${!formData.patientTreatment ? 'is-invalid' : ''}`}
                                        />
                                        <Form.Control
                                        as="textarea"
                                        name="patientMedicalRecord"
                                        value={formData.patientMedicalRecord}
                                        onChange={handleChange}
                                        placeholder="Hospitalizations"
                                        rows="3"
                                        className={`form-control ${!formData.patientMedicalRecord ? 'is-invalid' : ''}`}
                                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Control
                                        as="textarea"
                                        name="patientFamily"
                                        value={formData.patientFamily}
                                        onChange={handleChange}
                                        placeholder="Family psychiatric history:"
                                        rows="3"
                                        className={`form-control ${!formData.patientFamily ? 'is-invalid' : ''}`}
                                         />
                                        <Form.Control
                                        as="textarea"
                                        name="patientJobRisks"
                                        value={formData.patientJobRisks}
                                        onChange={handleChange}
                                        placeholder="History of self-harm or suicide attempts"
                                        rows="3"
                                        className={`form-control ${!formData.patientJobRisks ? 'is-invalid' : ''}`}
                                                        />
                                        </div>
                                        <Form.Label> Medical History </Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Control
                                        as="textarea"
                                        name="patientCondition"
                                        value={formData.patientCondition}
                                        onChange={handleChange}
                                        placeholder="Current and past medical conditions:"
                                        rows="3"
                                        className={`form-control ${!formData.patientCondition ? 'is-invalid' : ''}`}
                                         />
                                        <Form.Control
                                        as="textarea"
                                        name="patientChronicDiseases"
                                        value={formData.patientChronicDiseases}
                                        onChange={handleChange}
                                        placeholder="Medications (including psychiatric and non-psychiatric):"
                                        rows="3"
                                        className={`form-control ${!formData.patientChronicDiseases ? 'is-invalid' : ''}`}
                                        />
                                        <Form.Control
                                        as="textarea"
                                        name="patientAllergies"
                                        value={formData.patientAllergies}
                                        onChange={handleChange}
                                        placeholder="Patient Allergies"
                                        rows="3"
                                        className={`form-control ${!formData.patientAllergies ? 'is-invalid' : ''}`}
                                        />
                                    </div>
                                    <Form.Label> Substance Abuse History </Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Control
                                        type="text"
                                        name="patientDrugs"
                                        value={formData.patientDrugs}
                                        onChange={handleChange}
                                        placeholder="Use of alcohol, drugs, nicotine, and other substances:"
                                        className={`form-control ${!formData.patientDrugs ? 'is-invalid' : ''}`}
                                         />
                                        <Form.Control
                                        type="text"
                                        name="patientDrugsUsage"
                                        value={formData.patientDrugsUsage}
                                        onChange={handleChange}
                                        placeholder="Frequency and duration of use:"
                                        className={`form-control ${!formData.patientDrugsUsage ? 'is-invalid' : ''}`}
                                        />
                                        <Form.Control
                                        type="text"
                                        name="patientMental"
                                        value={formData.patientMental}
                                        onChange={handleChange}
                                        placeholder="Impact on mental health"
                                        className={`form-control ${!formData.patientMental ? 'is-invalid' : ''}`}
                                        />
                                    </div>
                                    <Form.Label> Psychosocial History </Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Control
                                        type="text"
                                        name="patientFam"
                                        value={formData.patientFam}
                                        onChange={handleChange}
                                        placeholder="Childhood and family background:"
                                        className={`form-control ${!formData.patientFam ? 'is-invalid' : ''}`}
                                         />
                                        <Form.Control
                                        type="text"
                                        name="patientJob"
                                        value={formData.patientJob}
                                        onChange={handleChange}
                                        placeholder="Education and employment history:"
                                        className={`form-control ${!formData.patientJob ? 'is-invalid' : ''}`}
                                        />
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                        type="text"
                                        name="patientRelationship"
                                        value={formData.patientRelationship}
                                        onChange={handleChange}
                                        placeholder="Relationships and support system:"
                                        className={`form-control ${!formData.patientRelationship ? 'is-invalid' : ''}`}
                                        />
                                        <Form.Control
                                        type="text"
                                        name="patientLegal"
                                        value={formData.patientLegal}
                                        onChange={handleChange}
                                        placeholder="Legal issues"
                                        className={`form-control ${!formData.patientLegal ? 'is-invalid' : ''}`}
                                        />
                                    </div>
                                    <Form.Label> Risk Assessment </Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Select
                                        name="Risk"
                                        value={formData.Risk}
                                        onChange={handleChange}
                                        required
                                        className={`form-control ${!formData.Risk ? 'is-invalid' : ''}`}
                                    >
                                        <option value="" disabled>Risk Assessment</option>
                                        {Risk.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                        <Form.Control
                                        type="text"
                                        name="patientRiskAssessment"
                                        value={formData.patientRiskAssessment}
                                        onChange={handleChange}
                                        placeholder="Risk Assessment Details:"
                                        className={`form-control ${!formData.patientRiskAssessment ? 'is-invalid' : ''}`}
                                        />
                                        </div>
                                        <Form.Label> Findings </Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                        type="text"
                                        name="patientFindings"
                                        value={formData.patientFindings}
                                        onChange={handleChange}
                                        placeholder="Patient Notes / Findings:"
                                        className={`form-control ${!formData.patientFindings ? 'is-invalid' : ''}`}
                                        />
                                        </div>

                                        <Form.Label> Discharge Diagnosis </Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                        type="text"
                                        name="patientDiagnosis"
                                        value={formData.patientDiagnosis}
                                        onChange={handleChange}
                                        placeholder="Primary Diagnosis:"
                                        className={`form-control ${!formData.patientDiagnosis ? 'is-invalid' : ''}`}
                                        />
                                        </div>
                                        <Form.Label> Therapy </Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Select
                                        name="admission"
                                        value={formData.admission}
                                        onChange={handleChange}
                                        required
                                        className={`form-control ${!formData.admission ? 'is-invalid' : ''}`}
                                    >
                                        <option value="" disabled>Admission</option>
                                        {admission.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                        <Form.Control
                                        type="text"
                                        name="patientTreatmentPlan"
                                        value={formData.patientTreatmentPlan}
                                        onChange={handleChange}
                                        placeholder="Treatment Plan:"
                                        className={`form-control ${!formData.patientTreatmentPlan ? 'is-invalid' : ''}`}
                                        />
                                        <Form.Control
                                        type="text"
                                        name="patientTherapyMedicine"
                                        value={formData.patientTherapyMedicine}
                                        onChange={handleChange}
                                        placeholder="Medicine:"
                                        className={`form-control ${!formData.patientTherapyMedicine ? 'is-invalid' : ''}`}
                                        />
                                        <Form.Select
                                        name="followup"
                                        value={formData.followup}
                                        onChange={handleChange}
                                        required
                                        className={`form-control ${!formData.followup ? 'is-invalid' : ''}`}
                                    >
                                        <option value="" disabled>Follow Up</option>
                                        {followup.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>

                                        </div>
                                        <Form.Label> Treatment Plan / Recommendations </Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                        type="text"
                                        name="patientTreatmentMedicine"
                                        value={formData.patientTreatmentMedicine}
                                        onChange={handleChange}
                                        placeholder="Medications:"
                                        className={`form-control ${!formData.patientTreatmentMedicine ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                        type="text"
                                        name="patientTherapy"
                                        value={formData.patientTherapy}
                                        onChange={handleChange}
                                        placeholder="Therapy (e.g., CBT, DBT):"
                                        className={`form-control ${!formData.patientTherapy ? 'is-invalid' : ''}`}
                                        /></div> 
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <Form.Control
                                        type="text"
                                        name="patientFollowUp"
                                        value={formData.patientFollowUp}
                                        onChange={handleChange}
                                        placeholder="Follow-up appointments:"
                                        className={`form-control ${!formData.patientFollowUp ? 'is-invalid' : ''}`}

                                        />
                                        <Form.Control
                                        type="text"
                                        name="patientSafety"
                                        value={formData.patientSafety}
                                        onChange={handleChange}
                                        placeholder="Safety planning (if at risk):"
                                        className={`form-control ${!formData.patientSafety ? 'is-invalid' : ''}`}
                                        />

                                        </div>
                                        </>

                        ) : null}
                        <div className="button-group">
                            <button
                                type="button"
                                onClick={clearForm}
                                className="upload-button"
                            >
                                <i className="fas fa-trash-alt"></i>
                                Clear Form
                            </button>
                        </div>
                    </form>

                </div>
                <div className="output-container">
    {showMissingEmployeeModal && (
        <div className="modal-overlay">
            <div className="modal">
                <Modal.Header>
                    <Modal.Title>Add Missing Employee / Coroner</Modal.Title>

                    <Button variant="secondary" className="close" onClick={() => setShowMissingEmployeeModal(false)}>
                        <span>&times;</span>
                        
                    </Button>
                </Modal.Header>
                <div className="radio-inline-container">

                    <span className="radio-text">Who is missing:</span>
                    <Form.Check
                        type="radio"
                        id="doctorRank"
                        label="   Coroner"
                        checked={isDoctor}
                        onChange={handlePHMCRank('doctor')}
                        inline
                    />
                    <Form.Check
                        type="radio"
                        id="nurseRank"
                        label="   Hospital Staff"
                        checked={isNurse}
                        onChange={handlePHMCRank('nurse')}
                        inline
                    />
                    </div>

                <Modal.Body>
                    <Form>
                    {isDoctor && (
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
                        placeholder='Coroner Discord Tags'
                        />
                        <Form.Control
                        type="text"
                        name="coronerRank"
                        value={missingEmployeeData.coronerRank}
                        onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerRank')}
                        placeholder='Coroner Rank / Position'
                        />
                                                    
                        </div>

                        )}
                    {isDoctor && (
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
                            placeholder='Coroner Badge Number (Required or things will go boom)'
                            />

                        </div>

                        )}
                        {isDoctor && (
                            <Select
    name="coronerEmployee"
    value={missingEmployeeData.coronerEmployee ? coronerGroupedOptions
        .flatMap(group => group.options)
        .find(option => option.value === missingEmployeeData.coronerEmployee) || null : null}
    onChange={(selectedOption) => handleMissingEmployeeChange(selectedOption?.value || '', 'coronerEmployee')}
    options={coronerGroupedOptions}
    isClearable
    placeholder="Who is requesting this missing employee..."
    className={`form-control ${!formData.coronerEmployee ? 'is-invalid' : ''}`}
    styles={{
        control: (base) => ({
            ...base,
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
        }),
        group: (base) => ({
            ...base,
            paddingTop: 8,
            paddingBottom: 8
        }),
        groupHeading: (base) => ({
            ...base,
            color: '#6c757d',
            fontWeight: 600,
            textTransform: 'uppercase',
            fontSize: '0.75rem',
            marginBottom: 4
        })
    }}
/>
)}
                    {isNurse && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                    <Form.Control
                        type="text"
                        name="coronerName"
                        value={missingEmployeeData.coronerName}
                        onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerName')}
                        placeholder='Employee Name'

                        />
                        <Form.Control
                        type="text"
                        name="coronerDiscord"
                        value={missingEmployeeData.coronerDiscord}
                        onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerDiscord')}
                        placeholder='Employee Department'
                        />
                        <Form.Control
                        type="text"
                        name="coronerRank"
                        value={missingEmployeeData.coronerRank}
                        onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerRank')}
                        placeholder='Employee Rank / Position'
                        />
                                                    
                        </div>

                        )}
                    {isNurse && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                            <Form.Control
                                type="text"
                                name="coronerPHNumber"
                                value={missingEmployeeData.coronerPHNumber}
                                onChange={(e) => handleMissingEmployeeChange(e.target.value, 'coronerPHNumber')}
                                placeholder='Employee PH number (Optional)'
                            />
                        </div>

                        )}
{isNurse && (
    <Select
        name="phmcEmployee"
        value={missingEmployeeData.phmcEmployee ? phmcGroupedOptions
            .flatMap(group => group.options)
            .find(option => option.value === missingEmployeeData.phmcEmployee) || null : null}
        onChange={(selectedOption) => handleMissingEmployeeChange(selectedOption?.value || '', 'phmcEmployee')}
        options={phmcGroupedOptions}
        isClearable
        placeholder="Who is requesting this missing employee..."
        className={`form-control ${!formData.phmcEmployee ? 'is-invalid' : ''}`}
        styles={{
            control: (base) => ({
                ...base,
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
            }),
            group: (base) => ({
                ...base,
                paddingTop: 8,
                paddingBottom: 8
            }),
            groupHeading: (base) => ({
                ...base,
                color: '#6c757d',
                fontWeight: 600,
                textTransform: 'uppercase',
                fontSize: '0.75rem',
                marginBottom: 4
            })
        }}
    />
)}

                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="primary" onClick={handleMissingEmployeeSubmit}>
                        Submit
                    </Button>
                    <Button variant="secondary" onClick={() => setShowMissingEmployeeModal(false)}>
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
                    <Button variant="secondary" className="close" onClick={() => setShowFeatureRequestModal(false)}>
                        <span>&times;</span>
                    </Button>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group>
                            <Form.Label>Bug / Feature Request:</Form.Label>
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

<div className="image-container">
                        <a href="http://discord.gg/rrzJ4EeHfK" target="_blank" rel="noopener noreferrer">
                            <img src={Feedback}
                                height={350}
                                alt="discord"
                                width={350}
                                className="Center"
                            />
                        </a>
                    </div>
                    <div id="missing-employee-modal"></div>
                                        
{/*                {<div className="form-type-header">
                    <h3>DEV_TEXT: You are viewing:
                            {bbCodeVersion === 1 ? ' generateDeath - FULLY TESTED' :
                                bbCodeVersion === 2 ? ' generateEmail - FULLY TESTED' :
                                    bbCodeVersion === 3 ? 'Patient File - Advanced' : 
                                        bbCodeVersion === 4 ? ' generateDental' :
                                            bbCodeVersion === 5 ? ' generateSurgicalOps ' :
                                                bbCodeVersion === 6 ? ' generatePhysEvalInternalMed ' :
                                                    bbCodeVersion === 7 ? 'GeneratePhysEvalInternalMedPBC' :
                                                            bbCodeVersion === 9 ? ' generateObsMainFile - FULLY TESTED' :
                                                                bbCodeVersion === 10 ? `generateObsFollowUp - FULLY TESTED` :
                                                                        bbCodeVersion === 12 ? `generateGyneMainFile - FULLY TESTED` :
                                                                            bbCodeVersion === 13 ? `generateGyneFollowUp - FULLY TESTED` :
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
                                                                                                                           bbCodeVersion === 26 ? 'Basic Patient File - Staff' :
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
                <button
                    className="close-button"
                    onClick={() => setShowBusinessCard(false)}
                    aria-label="Close selector"
                >
                    <i className="fas fa-times"></i>
                </button>
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
            <div className="business-card-image-container" ref={businessCardRef}  style={{ position: 'relative' }}>
                <img src={BusinessCardImage} alt="Business Card" />
                <div
                    className="name-overlay"
                    ref={nameRef}
                    style={{
                        position: 'absolute',
                        top: namePosition.top,
                        left: namePosition.left,
                        color: 'black',
                        fontSize: '35px',
                        pointerEvents: 'none',
                        cursor: 'default',
                    }}
                >
                    {name}
                </div>
                <div
                    className="rank-overlay"
                    ref={rankRef}
                    style={{
                        position: 'absolute',
                        top: rankPosition.top,
                        left: rankPosition.left,
                        color: '#cb1212',
                        fontSize: '15px',
                        cursor: 'default',
                        pointerEvents: 'none',
                    }}
                >
                    {rank}
                </div>
                <div
                    className="phone-number-overlay"
                    ref={departmentRef}
                    style={{
                        position: 'absolute',
                        top: phoneNumberPosition.top,
                        left: phoneNumberPosition.left,
                        color: 'black',
                        fontSize: '15px',
                        cursor: 'default',
                        pointerEvents: 'none',
                    }}
                >
                    {department}
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
                    value={department}
                    onChange={handleDepartmentChange}
                />

            </div>
        </div>
        <button onClick={handleSave}>Save</button>
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

                            {(formData.scenePhotos || formData.additionalImages) && (
                                <Button
                                    variant="primary"
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
                                        {bbCodeVersion === 1 ? generateDeath() :
                                            bbCodeVersion === 2 ? generateEmail() :
                                                bbCodeVersion === 3 ? generateHUGEFUCKINGFORM() :
                                                    bbCodeVersion === 4 ? generateDental() :
                                                        bbCodeVersion === 5 ? generateSurgicalOps() :
                                                            bbCodeVersion === 6 ? generatePhysEvalInternalMed() :
                                                                bbCodeVersion === 7 ? generatePhysEvalInternalMedPBC() :
                                                                        bbCodeVersion === 9 ? generateObsMainFile() :
                                                                            bbCodeVersion === 10 ? generateObsFollowUp() :
                                                                                    bbCodeVersion === 12 ? generateGyneMainFile() :
                                                                                        bbCodeVersion === 13 ? generateGyneFollowUp() :
                                                                                            bbCodeVersion === 14 ? generateMentalHealthPHMC() :
                                                                                                    bbCodeVersion === 16 ? generateMentalHealthPBC() :
                                                                                                            bbCodeVersion === 18 ? generateAgencyFeedback() :
                                                                                                                bbCodeVersion === 19 ? generateEmergencyProtocol() :
                                                                                                                    bbCodeVersion === 20 ? generateConsultationNotesPHMC() :
                                                                                                                        bbCodeVersion === 21 ? generateConsultationNotesPBC() :
                                                                                                                            bbCodeVersion === 22 ? generateCommentaryNotePHMC() :
                                                                                                                                bbCodeVersion === 23 ? generateCommentaryNotePBC() :
                                                                                                                                bbCodeVersion === 24 ? generateMedicalRecordRelease() :
                                                                                                                                bbCodeVersion === 25 ? generateBasicPatientFile() :
                                                                                                                                bbCodeVersion === 26 ? generateBasicPatientFileStaff() :
                                                                                                                                bbCodeVersion === 27 ? generateEmailPHMCEmail() :  
                                                                                                                                bbCodeVersion === 28 ? generatePsychEvalPHMC() :
                                                                                                                                 bbCodeVersion === 29 ? generatePsychEvalPBC() :
                                                                                                                    generateDeath()}
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
}                  {bbCodeVersion === 2 && (
                        <div className="agency-buttons">
                            <h5>Agency Email Methods: </h5>
                            <a
                                href="https://lspd.gta.world/ucp.php?i=pm&mode=compose"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="agency-button"
                            >
                                <img
                                    src={LSPDLogo}
                                    alt="LSPD"
                                    style={{
                                        width: '50px',
                                        height: '50px',
                                        margin: '10px 5px',
                                        cursor: 'pointer'
                                    }}
                                />
                            </a>
                            <a
                                href="https://lssd.gta.world/ucp.php?i=pm&mode=compose"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="agency-button"
                            >
                                <img
                                    src={LSSDLogo}
                                    alt="LSSD"
                                    style={{
                                        width: '50px',
                                        height: '50px',
                                        margin: '10px 5px',
                                        cursor: 'pointer'
                                    }}
                                />
                            </a>
                            <a
                                href="https://lsfd.gta.world/ucp.php?i=pm&mode=compose"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="agency-button"
                            >
                                <img
                                    src={LSFDLogo}
                                    alt="LSFD"
                                    style={{
                                        width: '50px',
                                        height: '50px',
                                        margin: '10px 5px',
                                        cursor: 'pointer'
                                    }}
                                />
                            </a>
                            <a
                                href="https://phmc.gta.world/ucp.php?i=pm&mode=compose"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="agency-button"
                            >
                                <img
                                    src={PHMCLogo}
                                    alt="PHMC"
                                    style={{
                                        width: '50px',
                                        height: '50px',
                                        margin: '10px 5px',
                                        cursor: 'pointer'
                                    }}
                                />
                            </a>
                        </div>
                    )}

                    <div className="button-container">
                        
                    {
    (bbCodeVersion === 1 || bbCodeVersion === 2 || bbCodeVersion === 3 || bbCodeVersion === 24 || bbCodeVersion === 25) && (
                     <button
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
                        </button>
                    )}
                       <button
                            type="button"
                            className="changelog-button"
                            onClick={() => {
                                const bbCode = bbCodeVersion === 1 ? generateDeath() :
                                    bbCodeVersion === 2 ? generateEmail() :
                                    bbCodeVersion === 3 ? generateHUGEFUCKINGFORM() : 
                                            bbCodeVersion === 4 ? generateDental() :
                                                bbCodeVersion === 5 ? generateSurgicalOps() :
                                                    bbCodeVersion === 6 ? generatePhysEvalInternalMed() :
                                                    bbCodeVersion === 7 ? generatePhysEvalInternalMedPBC() : 
                                                                bbCodeVersion === 9 ? generateObsMainFile() :
                                                                    bbCodeVersion === 10 ? generateObsFollowUp() :
                                                                            bbCodeVersion === 12 ? generateGyneMainFile() :
                                                                                bbCodeVersion === 13 ? generateGyneFollowUp() :
                                                                                    bbCodeVersion === 14 ? generateMentalHealthPHMC() :
                                                                                            bbCodeVersion === 16 ? generateMentalHealthPBC() :
                                                                                                    bbCodeVersion === 18 ? generateAgencyFeedback() :
                                                                                                        bbCodeVersion === 19 ? generateEmergencyProtocol() :
                                                                                                        bbCodeVersion === 20 ? generateConsultationNotesPHMC() :
                                                                                                        bbCodeVersion === 21 ? generateConsultationNotesPBC() :
                                                                                                        bbCodeVersion === 22 ? generateCommentaryNotePHMC() :
                                                                                                        bbCodeVersion === 23 ? generateCommentaryNotePBC() :
                                                                                                        bbCodeVersion === 24 ? generateMedicalRecordRelease() :
                                                                                                        bbCodeVersion === 25 ? generateBasicPatientFile() :
                                                                                                        bbCodeVersion === 26 ? generateBasicPatientFileStaff() :
                                                                                                        bbCodeVersion === 27 ? generateEmailPHMCEmail() : 
                                                                                                         bbCodeVersion === 28 ? generatePsychEvalPHMC() :
                                                                                                        bbCodeVersion === 29 ? generatePsychEvalPBC() :

                                                                                                            generateDeath();
                                const currentDateTime = new Date().toLocaleString();
                                const { decedentName, coronerEmployee, coronerRank, patientName, decedentOOC, phmcEmployee, requestingOfficer, patientID, patientFirstName, patientLastName} = formData;
                                const version = bbCodeVersion === 1 ? "Decedent Report" :
                                    bbCodeVersion === 2 ? "Coroner Report" :
                                        bbCodeVersion === 3 ? "Patient File - Advanced" :
                                            bbCodeVersion === 4 ? "Dental Report " :
                                                bbCodeVersion === 5 ? "Surgical Report " :
                                                    bbCodeVersion === 6 ? "Physical Evaluation (PHMC)" :
                                                        bbCodeVersion === 7 ? "Physical Evaluation (IM) - PBC" :
                                                            bbCodeVersion === 8 ? "Medical Consultation (EM) - Main File" :
                                                                bbCodeVersion === 9 ? "Obstetrics - Main File" :
                                                                    bbCodeVersion === 10 ? "Obstetrics - Follow Up" :
                                                                        bbCodeVersion === 11 ? "Medical Consultation (EM) - Add File" :
                                                                            bbCodeVersion === 12 ? "Gynecology - Main File" :
                                                                                bbCodeVersion === 13 ? "Gynecology - Follow Up" :
                                                                                    bbCodeVersion === 14 ? "Mental Health - PHMC" :
                                                                                            bbCodeVersion === 16 ? "Mental Health - Updating Risk Status" :
                                                                                                    bbCodeVersion === 18 ? "Coroners Agency Incidents" :
                                                                                                        bbCodeVersion === 19 ? "Emergency Protocol Form NEW" :
                                                                                                            bbCodeVersion === 20 ? "General Consultation PHMC" :
                                                                                                                bbCodeVersion === 21 ? "General Consultation PBC" :
                                                                                                                    bbCodeVersion === 22 ? "PHMC Commentary Note" :
                                                                                                                        bbCodeVersion === 23 ? "PBC Commentary Note" :
                                                                                                                        bbCodeVersion === 24 ? "Medical Record Release" :
                                                                                                                        bbCodeVersion === 25 ? 'Basic Patient File' :
                                                                                                                        bbCodeVersion === 26 ? 'Staff Patient Medical File' : 
                                                                                                                        bbCodeVersion === 27 ? 'PHMC Internal Email' : 
                                                                                                                        bbCodeVersion === 28 ? 'Psychological Evaluation PHMC' : 
                                                                                                                        bbCodeVersion === 29 ? 'Psychological Evaluation PBC' :
                                                                                                            "Something has gone wrong, sorry about that! Please inform the website maintainer!";

                navigator.clipboard.writeText(bbCode).then(() => {
                    showNotification(`${version} copied!`, 'check-circle');
                    const discordWebhookUrl = process.env.REACT_APP_DISCORD_WEBHOOK_URL;

                    // Send POST request to Discord Webhook
                    fetch(discordWebhookUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            content: ` ** DEBUG LOGS | TRACE |  gh-pages ${commitInfo.sha} **\n${coronerRank}  ${coronerEmployee} / ${phmcEmployee} / ${patientFirstName} ${patientLastName} has used your website.\nPatient / Decedent Name: ${patientName || decedentName || patientID}\nDecdent Name OOC: ${decedentOOC} \nTime: ${currentDateTime}\nForm: ${version}\nRequesting Officer: ${requestingOfficer}`
                        })
                    }).catch(error => {
                        console.error('Error:', error);
                        fetch(discordWebhookUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                content: `An error occurred in ${version}: ${error.message}\nTimestamp: ${currentDateTime}\n`
                            })
                        });
                    });

                    if (formData.typeOfDeath === 'CK') {
                        fetch(discordWebhookUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                content: `[divbox=transparent][center][phmclogo=250][/center]\n [b]Decedent Name[/b]: ${decedentName}\n [b]Decedent Age: decedentAge\n Date of Death: timeDate\n
                                Decedent Name: ${patientName || decedentName || patientID}\nDecdent Name OOC: ${decedentOOC} \nTime: ${currentDateTime}`
                            })
                        }).catch(error => {
                            console.error('Error sending CK webhook:', error);
                        });
                    }
                });
            }}
            
                        >
                            <i className="fas fa-clipboard"></i>
                            Copy {bbCodeVersion === 1 ? "Death Report" :
                                bbCodeVersion === 2 ? "Coroner Report" :
                                    bbCodeVersion === 3 ? "Detailed Patient File" :
                                        bbCodeVersion === 4 ? "Internal Medicine Report" :
                                            bbCodeVersion === 5 ? "Surgical Operations Report" :
                                                bbCodeVersion === 6 ? "Physical Evaluation Report PHMC" :
                                                    bbCodeVersion === 7 ? "Physical Evaluation Report PBC" :
                                                        bbCodeVersion === 8 ? "Emergency Medicine Consultation" :
                                                            bbCodeVersion === 9 ? "Obs & Gynae Main File" :
                                                                bbCodeVersion === 10 ? "Obs & Gynae Follow Up" :
                                                                    bbCodeVersion === 11 ? "Emergency Medicine - Add File" :
                                                                        bbCodeVersion === 12 ? "Gynecology Main File" :
                                                                            bbCodeVersion === 13 ? "Gynecology Follow Up" :
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
                                                                                                        bbCodeVersion === 26 ? 'Staff Patient Medical Record' : 
                                                                                                        bbCodeVersion === 27 ? 'PHMC Email' : 
                                                                                                        bbCodeVersion === 28 ? 'Psychological Evaluation PHMC' :
                                                                                                         bbCodeVersion === 29 ? 'Psychological Evaluation PBC' :
                                                                                                        "DEBUG - update title logic"}
                        </button>
                        
                    </div>

                    {bbCodeVersion === 1 && (
                        <div className="image-container">
                            <a href="https://phmc.gta.world/posting.php?mode=post&f=267" target="_blank" rel="noopener noreferrer">
                                <img
                                    src={Paperwork}
                                    height={350}
                                    width={350}
                                    className="Center"
                                    alt="Death Reports Link"
                                />
                            </a>
                        </div>
                    )}
                                        {bbCodeVersion === 3 && (
                        <div className="image-container">
                            <a href="https://phmc.gta.world/posting.php?mode=post&f=221" target="_blank" rel="noopener noreferrer">
                                <img
                                    src={PHMCCivilian}
                                    height={350}
                                    width={350}
                                    className="Center"
                                    alt="PHMC Civilian Paperwork"
                                />
                            </a>
                        </div>
                    )}

                    {bbCodeVersion === 24 && (
                        <div className="image-container">
                            <a href="https://phmc.gta.world/posting.php?mode=post&f=109" target="_blank" rel="noopener noreferrer">
                                <img
                                    src={PHMCCivilian}
                                    height={350}
                                    width={350}
                                    className="Center"
                                    alt="Basic Patient File"
                                />
                            </a>
                        </div>
                    )}
                    {bbCodeVersion === 25 && (
                        <div className="image-container">
                            <a href="https://phmc.gta.world/posting.php?mode=post&f=221" target="_blank" rel="noopener noreferrer">
                                <img
                                    src={PHMCCivilian}
                                    height={350}
                                    width={350}
                                    className="Center"
                                    alt="PHMC Civilian Paperwork"
                                />
                            </a>
                        </div>
                    )}
                    {bbCodeVersion === 26 && (
                        <div className="image-container">
                            <a href="https://phmc.gta.world/posting.php?mode=post&f=97" target="_blank" rel="noopener noreferrer">
                                <img
                                    src={PHMCCivilian}
                                    height={350}
                                    width={350}
                                    className="Center"
                                    alt="PHMC Civilian Paperwork"
                                />
                            </a>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

export default App;
