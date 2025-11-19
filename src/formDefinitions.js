// src/formDefinitions.js
import { lazy } from 'react';
import { generateDevTest } from './phmc-bbcode-generators/devTest';

// Lazy load form field components

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

// Dynamic component loaders - components are loaded only when needed
const componentLoaders = {
    // High priority components (commonly used forms) - prefetch
    DeathReport: () => import(/* webpackPrefetch: true */ './phmc-field-data/deathReport.jsx'),
    CoronerEmail: () => import(/* webpackPrefetch: true */ './phmc-field-data/CoronerEmail.jsx'),
    PhysEval: () => import(/* webpackPrefetch: true */ './phmc-field-data/PhysEvalPHMC.jsx'),
    GeneralConsult: () => import(/* webpackPrefetch: true */ './phmc-field-data/GeneralConsult.jsx'),
    EmergencyForm: () => import(/* webpackPrefetch: true */ './phmc-field-data/EmergencyForm.jsx'),
    DevTest: () => import('./phmc-field-data/devTest.jsx'),

    // Medium priority components - lazy load normally
    CommNotePHMC: () => import('./phmc-field-data/CommNotePHMC.jsx'),
    CommNotePBC: () => import('./phmc-field-data/CommNotePBC.jsx'),
    PatientFile: () => import('./phmc-field-data/PatientFile.jsx'),
    MentalHealth: () => import('./phmc-field-data/MentalHealth.jsx'),
    EmailInternal: () => import('./phmc-field-data/EmailInternal.jsx'),
    Surgical: () => import('./phmc-field-data/Surgical.jsx'),
    MedicalRecords: () => import('./phmc-field-data/MedicalRecords.jsx'),
    Shrink: () => import('./phmc-field-data/Shrink.jsx'),
    Autopsy: () => import('./phmc-field-data/Autopsy.jsx'),
    Certificate: () => import('./phmc-field-data/Certificate.jsx'),
    MassFatality: () => import('./phmc-field-data/MassFatality.jsx'),
    DeathRecord: () => import('./phmc-field-data/DeathRecord.jsx'),
    SicknessEmail: () => import('./phmc-field-data/SicknessEmail.jsx'),

    // Recruitment field components with prefetch for popular positions
    PhysicianFields: () => import(/* webpackPrefetch: true */ './phmc-civilian-fields/Physician.jsx'),
    PsychFields: () => import('./phmc-civilian-fields/Psych.jsx'),
    AdminFields: () => import('./phmc-civilian-fields/Admin.jsx'),
    NursingFields: () => import(/* webpackPrefetch: true */ './phmc-civilian-fields/Nursing.jsx'),
    Coroner: () => import('./phmc-civilian-fields/Coroner.jsx'),
    Ems: () => import(/* webpackPrefetch: true */ './phmc-civilian-fields/Ems.jsx'),
};


// Admin component can be loaded normally as it's a distinct route/view
import AdminAuthAndActions from './components/Admin/AdminAuthAndActions.jsx';


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
    { version: 24, name: "[Civilian] Medical Records", group: "PHMC", icon: Civilian, generator: generateMedicalRecords, componentLoader: componentLoaders.MedicalRecords, titleKey: "medicalRecords", sortOrder: 1, hasCustomTitle: true, userTypes: ['civilian', 'other'], primaryFor: ['civilian'] },
    { version: 25, name: "[Civilian] Patient Files", group: "PHMC", icon: Civilian, generator: generatePatientFile, componentLoader: componentLoaders.PatientFile, titleKey: "patientFile", sortOrder: 2, hasCustomTitle: true, userTypes: ['civilian', 'other'], primaryFor: ['civilian'] },
    // PHMC Tools (Forensic Services next, then others)
    { version: 1, name: "Forensic Services ", group: "PHMC", icon: folder, generator: generateDeathReport, componentLoader: componentLoaders.DeathReport, titleKey: "deathReport", sortOrder: 10, hasCustomTitle: true, userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    { version: 4, name: "Autopsy Report", group: "PHMC", icon: autopsy /* Placeholder */, generator: generateAutopsy, componentLoader: componentLoaders.Autopsy, titleKey: "autopsyReport", sortOrder: 11, isHiddenInSelector: true, hasCustomTitle: true, userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    {
        version: 2,
        name: "Coroner Email",
        group: "PHMC",
        icon: emailIcon,
        generator: generateEmail,
        componentLoader: componentLoaders.CoronerEmail,
        titleKey: "coronerEmail",
        sortOrder: 12,
        isHiddenInSelector: true,
        hasCustomTitle: true,
        userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true
    },
    { version: 8, name: "Certificate of Death", group: "PHMC", icon: deathCertificate, generator: generateCertificate, componentLoader: componentLoaders.Certificate, titleKey: "certificateOfDeath", sortOrder: 13, isHiddenInSelector: true, hasCustomTitle: true, userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    { version: 5, name: "Surgical Ops", group: "PHMC", icon: surgeon, generator: generateSurgicalOps, componentLoader: componentLoaders.Surgical, titleKey: "surgicalOps", sortOrder: 20, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    { version: 6, name: "Physical Evaluation", group: "PHMC", icon: nurse, generator: generatePhysEvalInternalMed, componentLoader: componentLoaders.PhysEval, titleKey: "physEvalPHMC", sortOrder: 21, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    { version: 11, name: "Mass Fatality Report", group: "PHMC", icon: graveyard, generator: generateMassFatality, componentLoader: componentLoaders.MassFatality, titleKey: "massFatalityReport", sortOrder: 14, isHiddenInSelector: true, hasCustomTitle: true, userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    // Add isHiddenInSelector: true to the PBC version
    { version: 7, name: "Physical Evaluation (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generatePhysEvalInternalMedPBC, componentLoader: componentLoaders.PhysEval, titleKey: "physEvalPBC", sortOrder: 22, isHiddenInSelector: true, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    { version: 14, name: "Mental Health", group: "PHMC", icon: psychology, generator: generateMentalHealthPHMC, componentLoader: componentLoaders.MentalHealth, titleKey: "mentalHealthPHMC", sortOrder: 23, hasCustomTitle: true, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    // Add isHiddenInSelector: true to the PBC version
    { version: 16, name: "Mental Health (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generateMentalHealthPBC, componentLoader: componentLoaders.MentalHealth, titleKey: "mentalHealthPBC", sortOrder: 24, isHiddenInSelector: true, hasCustomTitle: true, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    { version: 19, name: "ER Protocol", group: "PHMC", icon: emergency, generator: generateEmergencyProtocol, componentLoader: componentLoaders.EmergencyForm, titleKey: "erProtocol", sortOrder: 25, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    { version: 20, name: "General Consultation", group: "PHMC", icon: empathy, generator: generateConsultationNotesPHMC, componentLoader: componentLoaders.GeneralConsult, titleKey: "generalConsultPHMC", sortOrder: 26, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    // Add isHiddenInSelector: true to the PBC version
    { version: 21, name: "General Consultation (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generateConsultationNotesPBC, componentLoader: componentLoaders.GeneralConsult, titleKey: "generalConsultPBC", sortOrder: 27, isHiddenInSelector: true, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    { version: 22, name: "Commentary Notes", group: "PHMC", icon: paperwork, generator: generateCommentaryNotePHMC, componentLoader: componentLoaders.CommNotePHMC, titleKey: "commNotePHMC", sortOrder: 28, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    // Add isHiddenInSelector: true to the PBC version
    { version: 23, name: "Commentary Notes (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generateCommentaryNotePBC, componentLoader: componentLoaders.CommNotePBC, titleKey: "commNotePBC", sortOrder: 29, isHiddenInSelector: true, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    { version: 27, name: "PHMC Internal Email", group: "PHMC", icon: emailIcon, generator: generateEmailPHMCEmail, componentLoader: componentLoaders.EmailInternal, titleKey: "internalEmail", sortOrder: 30, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    { version: 28, name: "Psychological Evaluation", group: "PHMC", icon: psychology, generator: generatePsychEvalPHMC, componentLoader: componentLoaders.Shrink, titleKey: "psychEvalPHMC", sortOrder: 31, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    // Add isHiddenInSelector: true to the PBC version
    { version: 29, name: "Psychological Evaluation (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generatePsychEvalPBC, componentLoader: componentLoaders.Shrink, titleKey: "psychEvalPBC", sortOrder: 32, isHiddenInSelector: true, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true },
    { version: 35, name: "Medical Sickness Email", group: "PHMC", icon: emailIcon, generator: generateSicknessEmail, componentLoader: componentLoaders.SicknessEmail, titleKey: "sicknessEmail", sortOrder: 33, isHiddenInSelector: true, userTypes: ['phmcStaff', 'other'], primaryFor: ['phmcStaff'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true }, // No FieldComponent for this one
    {
        version: 50,
        name: "Physician Careers",
        group: "PHMC Recruitment",
        icon: application,
        generator: generatePhysician,
        componentLoader: componentLoaders.PhysicianFields,
        titleKey: "phmcGeneralApplication",
        sortOrder: 200,
        hasCustomTitle: true,
        userTypes: ['recruitment', 'other'], primaryFor: ['recruitment'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true
    },
    {
        version: 51,
        name: "Psychologist/Psychiatrist Careers",
        group: "PHMC Recruitment",
        icon: application,
        generator: generatePsych,
        componentLoader: componentLoaders.PsychFields,
        titleKey: "phmcPsychApplication",
        sortOrder: 201,
        hasCustomTitle: true,
        userTypes: ['recruitment', 'other'], primaryFor: ['recruitment'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true
    },
    {
        version: 52,
        name: "Admin Careers",
        group: "PHMC Recruitment",
        icon: application,
        generator: admin,
        componentLoader: componentLoaders.AdminFields,
        titleKey: "phmcAdminApplication",
        sortOrder: 202,
        hasCustomTitle: true,
        userTypes: ['recruitment', 'other'], primaryFor: ['recruitment'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true
    },
    {
        version: 53,
        name: "Nursing Careers",
        group: "PHMC Recruitment",
        icon: application,
        generator: nursing,
        componentLoader: componentLoaders.NursingFields,
        titleKey: "phmcNursingApplication",
        sortOrder: 203,
        hasCustomTitle: true,
        userTypes: ['recruitment', 'other'], primaryFor: ['recruitment'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true
    },
    {
        version: 54,
        name: "Coroner Careers",
        group: "PHMC Recruitment",
        icon: application,
        generator: generateCoroner,
        componentLoader: componentLoaders.Coroner,
        titleKey: "phmcCoronerRecruitmentApplication",
        sortOrder: 204,
        hasCustomTitle: true,
        userTypes: ['recruitment', 'other'], primaryFor: ['recruitment'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true
    },
    {
        version: 55,
        name: "EMS Careers",
        group: "PHMC Recruitment",
        icon: application,
        generator: generateEMS,
        componentLoader: componentLoaders.Ems,
        titleKey: "phmcEMSApplication",
        sortOrder: 205,
        hasCustomTitle: true,
        userTypes: ['recruitment', 'other'], primaryFor: ['recruitment'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true
    },
    {
        version: 999,
        name: "Admin Control Panel",
        group: "Admin",
        icon: application,
        componentLoader: null, // Admin component is imported normally
        generator: generateAdminView,
        titleKey: "adminControlPanel",
        sortOrder: 999,
        userTypes: ['other'], primaryFor: ['other']
    },
    {
        version: 37, 
        name: "Death Record",
        group: "PHMC",
        icon: conference,
        generator: generateDeathRecord,
        componentLoader: componentLoaders.DeathRecord,
        titleKey: "deathRecord",
        sortOrder: 15,
        hasCustomTitle: true,
        isHiddenInSelector: true,
        userTypes: ['phmcStaff', 'coroner', 'other'], primaryFor: ['coroner'], requiredFaction: ['PHMC'], requiredRank: 1, isPHMC: true
    },
    {
        version: 1000,
        name: "dev-testing",
        group: "PHMC",
        icon: application,
        generator: generateDevTest,
        componentLoader: componentLoaders.DevTest,
        titleKey: "devTesting",
        sortOrder: 1000,
        hasCustomTitle: true,
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