// src/formDefinitions.js
import { lazy } from 'react';
import { generateDevTest } from './phmc-bbcode-generators/devTest';

// Lazy load form field components
// Admin component can be loaded normally as it's a distinct route/view
import AdminAuthAndActions from './components/Admin/AdminAuthAndActions';

// Import generators normally as they are not components
import {
    generateDeathReport, generateEmail, generateSurgicalOps, generatePatientFile,
    generatePhysEvalInternalMed, generatePhysEvalInternalMedPBC, generateMentalHealthPHMC,
    generateMentalHealthPBC, generateConsultationNotesPHMC,
    generateEmergencyProtocol, generateCommentaryNotePHMC, generateCommentaryNotePBC,
    generateMedicalRecords, generateEmailPHMCEmail,
    generateConsultationNotesPBC, generatePsychEvalPHMC, generatePsychEvalPBC,
    generateAutopsy, generateCertificate, generateMassFatality, generateDeathRecord,
    generateSicknessEmail
} from './phmc-bbcode-generators';
import generatePhysician from './phmc-recruitment-generators/generatePhysician';
import generatePsych from './phmc-recruitment-generators/generatePsych';
import admin from './phmc-recruitment-generators/generateAdmin';
import nursing from './phmc-recruitment-generators/generateNursing';
import generateCoroner from './phmc-recruitment-generators/generateCoroner';
import generateEMS from './phmc-recruitment-generators/generateEMS';

// Import your icons
import folder from './assets/folder.png';
import autopsy from './assets/autopsy.png';
import deathCertificate from './assets/death-certificate.png';
import graveyard from './assets/graveyard.png';
import conference from './assets/conference.png';
import emailIcon from './assets/email.png';
import Civilian from './assets/Civilian.png';
import phmcpaletobay from './assets/phmcpaletobaylogo.png';
import surgeon from './assets/surgeon.png';
import nurse from './assets/nurse.png';
import emergency from './assets/emergency.png';
import empathy from './assets/empathy.png';
import paperwork from './assets/paperwork.png';
import psychology from './assets/psychology.png';
import application from './assets/application.png'; // Assuming this is for SAAA or generic

// Lazy load field components with webpack magic comments for optimization
// High priority components (commonly used forms) - prefetch
const DeathReport = lazy(() => import(/* webpackPrefetch: true */ './phmc-field-data/deathReport'));
const CoronerEmail = lazy(() => import(/* webpackPrefetch: true */ './phmc-field-data/CoronerEmail'));
const PhysEval = lazy(() => import(/* webpackPrefetch: true */ './phmc-field-data/PhysEvalPHMC'));
const GeneralConsult = lazy(() => import(/* webpackPrefetch: true */ './phmc-field-data/GeneralConsult'));
const EmergencyForm = lazy(() => import(/* webpackPrefetch: true */ './phmc-field-data/EmergencyForm'));
const DevTest = lazy(() => import('./phmc-field-data/devTest'));

// Medium priority components - lazy load normally
const CommNotePHMC = lazy(() => import('./phmc-field-data/CommNotePHMC'));
const CommNotePBC = lazy(() => import('./phmc-field-data/CommNotePBC'));
const PatientFile = lazy(() => import('./phmc-field-data/PatientFile'));
const MentalHealth = lazy(() => import('./phmc-field-data/MentalHealth'));
const EmailInternal = lazy(() => import('./phmc-field-data/EmailInternal'));
const Surgical = lazy(() => import('./phmc-field-data/Surgical'));
const MedicalRecords = lazy(() => import('./phmc-field-data/MedicalRecords'));
const Shrink = lazy(() => import('./phmc-field-data/Shrink'));
const Autopsy = lazy(() => import('./phmc-field-data/Autopsy'));
const Certificate = lazy(() => import('./phmc-field-data/Certificate'));
const MassFatality = lazy(() => import('./phmc-field-data/MassFatality'));
const DeathRecord = lazy(() => import('./phmc-field-data/DeathRecord'));
const SicknessEmail = lazy(() => import('./phmc-field-data/SicknessEmail'));

// Lazy load recruitment field components with prefetch for popular positions
const PhysicianFields = lazy(() => import(/* webpackPrefetch: true */ './phmc-civilian-fields/Physician'));
const PsychFields = lazy(() => import('./phmc-civilian-fields/Psych'));
const AdminFields = lazy(() => import('./phmc-civilian-fields/Admin'));
const NursingFields = lazy(() => import(/* webpackPrefetch: true */ './phmc-civilian-fields/Nursing'));
const Coroner = lazy(() => import('./phmc-civilian-fields/Coroner'));
const Ems = lazy(() => import(/* webpackPrefetch: true */ './phmc-civilian-fields/Ems'));


export const generateAdminView = (viewData) => {
    if (!viewData.isAdminAuthenticated) {
        return "Please log in using the form fields to view admin controls.";
    }

    const categoryName = viewData.adminSelectedCategoryName || 'Selected Category';
    // Simplified title, and we'll add a newline before the statuses if they exist.
    let adminContent = `[b]${categoryName} Recruitment Statuses:[/b]\n`;

    if (viewData.adminDisplayData && typeof viewData.adminDisplayData === 'object' && Object.keys(viewData.adminDisplayData).length > 0) {
        const statusEntries = Object.entries(viewData.adminDisplayData).map(([key, position]) => {
            const displayName = position.displayName || position.name || key;
            const status = position.status || 'N/A';
            const statusColor = status === "OPEN" ? "green" : "red";
            // Format each position and its status, using color for visual cue
            return `${displayName}: [color=${statusColor}]${status}[/color]`;
        });

        // Join the statuses with a separator for a more compact, single-line display if possible.
        // If you prefer a list for many items, we can revert to `[list]` and `[*] `.
        adminContent += statusEntries.join(' | ');

    } else if (viewData.adminDisplayData === null && viewData.adminSelectedCategoryName) {
        adminContent += `Data for ${categoryName} not found or failed to load.`;
    }
    else if (viewData.adminSelectedCategoryName) {
        // This case might occur briefly while data is loading after category selection
        adminContent += `Loading data for ${categoryName}...`;
    }
    else if (viewData.isAdminAuthenticated && !viewData.adminSelectedCategoryName) {
        adminContent += "Please select a recruitment category in the panel to view statuses.";
    }
    else {
        adminContent += "No recruitment data to display. Please select a category or check logs if issues persist.";
    }
    // No need for an extra newline if join is used, as it doesn't end with one.
    // If using a list, ensure [list]...[/list] structure.
    return adminContent;
};

export const formDefinitions = [
    // Civilian Forms First
    { version: 24, name: "[Civilian] Medical Records", group: "PHMC", icon: Civilian, generator: generateMedicalRecords, FieldComponent: MedicalRecords, titleKey: "medicalRecords", sortOrder: 1, hasCustomTitle: true, titleGenerator: (formData) => formData.formType === 'release' ? `[RELEASE REQUEST] ${formData.patientFirstName || ''} ${formData.patientLastName || ''} `.trim() : `[Medical Information Update] -  ${formData.patientName || 'N/A'}`, userTypes: ['civilian', 'other'], primaryFor: ['civilian'] },
    { version: 25, name: "[Civilian] Patient Files", group: "PHMC", icon: Civilian, generator: generatePatientFile, FieldComponent: PatientFile, titleKey: "patientFile", sortOrder: 2, hasCustomTitle: true, titleGenerator: (formData) => `[Medical Information Registration] -  ${formData.patientName || 'N/A'}`, userTypes: ['civilian', 'other'], primaryFor: ['civilian'] },
    // PHMC Tools (Forensic Services next, then others)
    { version: 1, name: "Forensic Services ", group: "PHMC", icon: folder, generator: generateDeathReport, FieldComponent: DeathReport, titleKey: "deathReport", sortOrder: 10, hasCustomTitle: true, titleGenerator: (formData) => { const { typeOfDeath,decedentName,decedentOOC, dateTime } = formData; const date = dateTime ? new Date(dateTime).toLocaleDateString('en-US') : 'N/A'; return `[${typeOfDeath || 'N/A'}] ${decedentName || 'N/A'} ((${decedentOOC || 'N/A'})) - ${date}`; }, userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    { version: 4, name: "Autopsy Report", group: "PHMC", icon: autopsy /* Placeholder */, generator: generateAutopsy, FieldComponent: Autopsy, titleKey: "autopsyReport", sortOrder: 11, isHiddenInSelector: true, hasCustomTitle: true, titleGenerator: (formData) => { const {decedentName,decedentOOC } = formData; return `CASE ## ${decedentName || 'N/A'} ((${decedentOOC || 'N/A'})) | SENT/COMPLETED/PENDING`; }, userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    {
        version: 2,
        name: "Coroner Email",
        group: "PHMC",
        icon: emailIcon,
        generator: generateEmail,
        FieldComponent: CoronerEmail,
        titleKey: "coronerEmail",
        sortOrder: 12,
        isHiddenInSelector: true,
        hasCustomTitle: true,
        titleGenerator: (formData) => {
            const {decedentName,decedentOOC, paperworkType } = formData;
            if (paperworkType && paperworkType.toLowerCase().includes('mass fatality')) {
                return `Coroner Report - ${decedentName || 'N/A'} | (MASS FATALITY)`;
            }

            const names = (decedentName || '').split(', ').filter(Boolean);
            const oocNames = (decedentOOC || '').split(', ').filter(Boolean);

            let combinedNames = [];
            for (let i = 0; i < names.length; i++) {
                const name = names[i];
                const ooc = oocNames[i] ? `((${oocNames[i]}))` : '';
                combinedNames.push(`${name} ${ooc}`.trim());
            }

            if (combinedNames.length > 0) {
                return `Coroner Report - ${combinedNames.join(', ')}`;
            }

            return `Coroner Report - N/A`;
        },
        userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true
    },
    { version: 8, name: "Certificate of Death", group: "PHMC", icon: deathCertificate, generator: generateCertificate, FieldComponent: Certificate, titleKey: "certificateOfDeath", sortOrder: 13, isHiddenInSelector: true, hasCustomTitle: true, titleGenerator: (formData) => `[Death Certificate] -  ${formData.decedentOOC || 'N/A'}`, userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    { version: 5, name: "Surgical Ops", group: "PHMC", icon: surgeon, generator: generateSurgicalOps, FieldComponent: Surgical, titleKey: "surgicalOps", sortOrder: 20, titleGenerator: (formData) => `Surgical Ops: ${formData.patientName || 'Unknown'}`, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    { version: 6, name: "Physical Evaluation", group: "PHMC", icon: nurse, generator: generatePhysEvalInternalMed, FieldComponent: PhysEval, titleKey: "physEvalPHMC", sortOrder: 21, titleGenerator: (formData) => `Physical Evaluation: ${formData.patientName || 'Unknown'}`, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    { version: 11, name: "Mass Fatality Report", group: "PHMC", icon: graveyard, generator: generateMassFatality, FieldComponent: MassFatality, titleKey: "massFatalityReport", sortOrder: 14, isHiddenInSelector: true, hasCustomTitle: true, titleGenerator: (formData) => { const { decedents, dateTime } = formData; let date = 'No Date'; if (dateTime) { const datePart = dateTime.split('T')[0]; const [year, month, day] = datePart.split('-'); date = `${month}/${day}/${year}`; } if (decedents && decedents.length > 0) { const decedentNames = decedents.map(d => d.decedentName).filter(name => name).join(', '); return `[Mass Fatality Report] - ${decedentNames || 'N/A'} - ${date}`; } return `[Mass Fatality Report] - N/A - ${date}`; }, userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    // Add isHiddenInSelector: true to the PBC version
    { version: 7, name: "Physical Evaluation (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generatePhysEvalInternalMedPBC, FieldComponent: PhysEval, titleKey: "physEvalPBC", sortOrder: 22, isHiddenInSelector: true, titleGenerator: (formData) => `Physical Evaluation: ${formData.patientName || 'Unknown'}`, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    { version: 14, name: "Mental Health", group: "PHMC", icon: psychology, generator: generateMentalHealthPHMC, FieldComponent: MentalHealth, titleKey: "mentalHealthPHMC", sortOrder: 23, hasCustomTitle: true, titleGenerator: (formData) => { const date = formData.dateTime ? new Date(formData.date).toLocaleDateString('en-US') : 'N/A'; return `${formData.patientID || 'Unknown'} - ${date}`; }, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    // Add isHiddenInSelector: true to the PBC version
    { version: 16, name: "Mental Health (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generateMentalHealthPBC, FieldComponent: MentalHealth, titleKey: "mentalHealthPBC", sortOrder: 24, isHiddenInSelector: true, hasCustomTitle: true, titleGenerator: (formData) => { const date = formData.patientID ? new Date(formData.date).toLocaleDateString('en-US') : 'N/A'; return `${formData.patientName || 'Unknown'} - ${date}`; }, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    { version: 19, name: "ER Protocol", group: "PHMC", icon: emergency, generator: generateEmergencyProtocol, FieldComponent: EmergencyForm, titleKey: "erProtocol", sortOrder: 25, titleGenerator: (formData) => `ER Protocol: ${formData.patientName || 'Unknown'}`, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    { version: 20, name: "General Consultation", group: "PHMC", icon: empathy, generator: generateConsultationNotesPHMC, FieldComponent: GeneralConsult, titleKey: "generalConsultPHMC", sortOrder: 26, titleGenerator: (formData) => `General Consultation: ${formData.patientName || 'Unknown'}`, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    // Add isHiddenInSelector: true to the PBC version
    { version: 21, name: "General Consultation (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generateConsultationNotesPBC, FieldComponent: GeneralConsult, titleKey: "generalConsultPBC", sortOrder: 27, isHiddenInSelector: true, titleGenerator: (formData) => `General Consultation: ${formData.patientName || 'Unknown'}`, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    { version: 22, name: "Commentary Notes", group: "PHMC", icon: paperwork, generator: generateCommentaryNotePHMC, FieldComponent: CommNotePHMC, titleKey: "commNotePHMC", sortOrder: 28, titleGenerator: (formData) => `Commentary Note: ${formData.patientName || 'Unknown'}`, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    // Add isHiddenInSelector: true to the PBC version
    { version: 23, name: "Commentary Notes (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generateCommentaryNotePBC, FieldComponent: CommNotePBC, titleKey: "commNotePBC", sortOrder: 29, isHiddenInSelector: true, titleGenerator: (formData) => `Commentary Note: ${formData.patientName || 'Unknown'}`, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    { version: 27, name: "PHMC Internal Email", group: "PHMC", icon: emailIcon, generator: generateEmailPHMCEmail, FieldComponent: EmailInternal, titleKey: "internalEmail", sortOrder: 30, titleGenerator: (formData) => `Internal Email: ${formData.subject || 'No Subject'}`, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    { version: 28, name: "Psychological Evaluation", group: "PHMC", icon: psychology, generator: generatePsychEvalPHMC, FieldComponent: Shrink, titleKey: "psychEvalPHMC", sortOrder: 31, titleGenerator: (formData) => `Psychological Evaluation: ${formData.patientName || 'Unknown'}`, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    // Add isHiddenInSelector: true to the PBC version
    { version: 29, name: "Psychological Evaluation (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generatePsychEvalPBC, FieldComponent: Shrink, titleKey: "psychEvalPBC", sortOrder: 32, isHiddenInSelector: true, titleGenerator: (formData) => `Psychological Evaluation: ${formData.patientName || 'Unknown'}`, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    { version: 35, name: "Medical Sickness Email", group: "PHMC", icon: emailIcon, generator: generateSicknessEmail, FieldComponent: SicknessEmail, titleKey: "sicknessEmail", sortOrder: 33, isHiddenInSelector: true, titleGenerator: (formData) => `Sickness Email: ${formData.phmcEmployee || 'Unknown'}`, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true }, // No FieldComponent for this one
    {
        version: 50,
        name: "Physician Careers",
        group: "PHMC Recruitment",
        icon: application,
        generator: generatePhysician,
        FieldComponent: PhysicianFields,
        titleKey: "phmcGeneralApplication",
        sortOrder: 200,
        hasCustomTitle: true,
        titleGenerator: (formData) => `Application: ${formData.characterName || 'Unknown'}`, 
        userTypes: ['recruitment', 'other'], primaryFor: ['recruitment'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true
    },
    {
        version: 51,
        name: "Psychologist/Psychiatrist Careers",
        group: "PHMC Recruitment",
        icon: application,
        generator: generatePsych,
        FieldComponent: PsychFields,
        titleKey: "phmcPsychApplication",
        sortOrder: 201,
        hasCustomTitle: true,
        titleGenerator: (formData) => `Application: ${formData.characterName || 'Unknown'}`, 
        userTypes: ['recruitment', 'other'], primaryFor: ['recruitment'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true
    },
    {
        version: 52,
        name: "Admin Careers",
        group: "PHMC Recruitment",
        icon: application,
        generator: admin,
        FieldComponent: AdminFields,
        titleKey: "phmcAdminApplication",
        sortOrder: 202,
        hasCustomTitle: true,
        titleGenerator: (formData) => `Application: ${formData.characterName || 'Unknown'}`, 
        userTypes: ['recruitment', 'other'], primaryFor: ['recruitment'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true
    },
    {
        version: 53,
        name: "Nursing Careers",
        group: "PHMC Recruitment",
        icon: application,
        generator: nursing,
        FieldComponent: NursingFields,
        titleKey: "phmcNursingApplication",
        sortOrder: 203,
        hasCustomTitle: true,
        titleGenerator: (formData) => `Application: ${formData.characterName || 'Unknown'}`, 
        userTypes: ['recruitment', 'other'], primaryFor: ['recruitment'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true
    },
    {
        version: 54,
        name: "Coroner Careers",
        group: "PHMC Recruitment",
        icon: application,
        generator: generateCoroner,
        FieldComponent: Coroner,
        titleKey: "phmcCoronerRecruitmentApplication",
        sortOrder: 204,
        hasCustomTitle: true,
        titleGenerator: (formData) => `Application: ${formData.characterName || 'Unknown'}`, 
        userTypes: ['recruitment', 'other'], primaryFor: ['recruitment'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true
    },
    {
        version: 55,
        name: "EMS Careers",
        group: "PHMC Recruitment",
        icon: application,
        generator: generateEMS,
        FieldComponent: Ems,
        titleKey: "phmcEMSApplication",
        sortOrder: 205,
        hasCustomTitle: true,
        titleGenerator: (formData) => `Application: ${formData.characterName || 'Unknown'}`, 
        userTypes: ['recruitment', 'other'], primaryFor: ['recruitment'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true
    },
    {
        version: 999,
        name: "Admin Control Panel",
        group: "Admin",
        icon: application,
        FieldComponent: AdminAuthAndActions,
        generator: generateAdminView,
        titleKey: "adminControlPanel",
        sortOrder: 999,
        titleGenerator: () => 'Admin Control Panel',
        userTypes: ['other'], primaryFor: ['other']
    },
    {
        version: 37, 
        name: "Death Record",
        group: "PHMC",
        icon: conference,
        generator: generateDeathRecord,
        FieldComponent: DeathRecord,
        titleKey: "deathRecord",
        sortOrder: 15,
        hasCustomTitle: true,
        isHiddenInSelector: true,
        
        titleGenerator: (formData) => {
            const { caseNumber,decedentName,decedentOOC, dateOfDeath } = formData;
            const currentYear = new Date().getFullYear();

            let formattedDate = 'N/A';
            if (dateOfDeath) {
                const date = new Date(dateOfDeath + 'T00:00:00');
                const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
                const month = monthNames[date.getMonth()];
                const day = String(date.getDate()).padStart(2, '0');
                const year = date.getFullYear();
                formattedDate = `${month}-${day}-${year}`;
            }

            const name = decedentName || (formData.deathRecordType === 'Unidentified' ? 'JANE/JOHN DOE' : 'JOHN/JANE DOE');
            return `[CASE #${currentYear}-${caseNumber || '(( DEATH REPORT POST ID ))'}] ${name} ((${decedentOOC || 'OOC NAME'})) | [${formattedDate}]`;
        },
        userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true
    },
    {
        version: 1000,
        name: "dev-testing",
        group: "PHMC",
        icon: application,
        generator: generateDevTest,
        FieldComponent: DevTest,
        titleKey: "devTesting",
        sortOrder: 1000,
        hasCustomTitle: true,
        titleGenerator: (formData) => `Dev Test: ${formData.test_field_1 || 'Unknown'}`, 
        userTypes: ['phmcStaff', 'other'],
        requiredFaction: ['PHMC'],
        requiredRank: 1,
        isPHMC: true,
    },
];

// Helper to get form definition by version
export const getFormDefinition = (version) => formDefinitions.find(form => form.version === version);

// Helper to filter forms by user type
export const getFormsByUserType = (userType) => {
    return formDefinitions.filter(form => 
        !form.userTypes || form.userTypes.includes(userType)
    );
};

// Helper to get primary forms for a user type
export const getPrimaryFormsForUserType = (userType) => {
    return formDefinitions.filter(form => 
        form.primaryFor && form.primaryFor.includes(userType)
    );
};

// Helper to get forms by group and user type
export const getFormsByGroupAndUserType = (group, userType) => {
    return formDefinitions.filter(form => 
        form.group === group && 
        (!form.userTypes || form.userTypes.includes(userType))
    );
};

// Helper to generate versionNames map for display (if still needed elsewhere, or can be derived from formDefinitions)
export const generateVersionNames = () => {
    const names = {};
    formDefinitions.forEach(form => {
        names[form.version] = form.name;
    });
    return names;
};