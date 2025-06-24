// src/formDefinitions.js
import {
    CommNotePHMC, CommNotePBC, DeathReport, CoronerEmail, PatientAdvanced, MentalHealth,
    EmailInternal, Surgical, PhysEval, EmergencyForm, GeneralConsult,
    MedicalRelease, BasicPatientFile, Shrink, Autopsy, Certificate
} from './phmc-field-data'; // Assuming all field components are here for now

import {
    generateDeathReport, generateEmail, generateSurgicalOps, generateAdvancedPatientFile,
    generatePhysEvalInternalMed, generatePhysEvalInternalMedPBC, generateMentalHealthPHMC,
    generateMentalHealthPBC, generateConsultationNotesPHMC,
    generateEmergencyProtocol, generateCommentaryNotePHMC, generateCommentaryNotePBC,
    generateMedicalRecordRelease, generateBasicPatientFile, generateEmailPHMCEmail,
    generateConsultationNotesPBC, generatePsychEvalPHMC, generatePsychEvalPBC,
    generateAutopsy, generateCertificate
} from './phmc-bbcode-generators'; // Assuming all PHMC generators are here
import generatePhysician from './phmc-recruitment-generators/generatePhysician'; // Make sure this path is correct
import PhysicianFields from './phmc-civilian-fields/Physician'; // Path to your new component

import generateEntryJob from './saaa-form-generators/generateEntryJob'; // SAAA generator
import generateFlightSchool from './saaa-form-generators/generateFlightSchool'; // SAAA generator
import generateAircraftReg from './saaa-form-generators/generateAircraftReg'; // SAAA generator
import generateAirline from './saaa-form-generators/generateAirline';
import generateHeliport from './saaa-form-generators/generateHeliport'; // SAAA generator
import AdminAuthAndActions from './components/Admin/AdminAuthAndActions'; // New component
// Import your icons
import corpse from './assets/corpse.png';
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
import EntryJob from './saaa-field-data/EntryJob';
import FlightSchool from './saaa-field-data/FlightSchool';
import AircraftRegistration from './saaa-field-data/AircraftRegistration';
import Airline from './saaa-field-data/Airline';
import Heliport from './saaa-field-data/Heliport'; 
import generatePsych from './phmc-recruitment-generators/generatePsych'; // New Psych generator
import PsychFields from './phmc-civilian-fields/Psych'; // New Psych field component
import AdminFields  from './phmc-civilian-fields/Admin';
import admin from './phmc-recruitment-generators/generateAdmin';
import nursing from './phmc-recruitment-generators/generateNursing';
import NursingFields from './phmc-civilian-fields/Nursing';
import generateCoroner from './phmc-recruitment-generators/generateCoroner';
import Coroner from './phmc-civilian-fields/Coroner';
import generateEMS from './phmc-recruitment-generators/generateEMS';
import Ems from './phmc-civilian-fields/Ems';
import SicknessEmail, { default as SicknessEmailFields } from './phmc-field-data/SicknessEmail'; // Import the new field component
import { default as generateSicknessEmail } from './phmc-bbcode-generators/generateSicknessEmail'; // Import the new generator

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
        // If you prefer a list for many items, we can revert to `[list]` and `[*]`.
        adminContent += statusEntries.join(' | ');

    } else if (viewData.adminDisplayData === null && viewData.adminSelectedCategoryName) {
        adminContent += `Data for ${categoryName} not found or failed to load.`;
    } else if (viewData.adminSelectedCategoryName) {
        // This case might occur briefly while data is loading after category selection
        adminContent += `Loading data for ${categoryName}...`;
    } else if (viewData.isAdminAuthenticated && !viewData.adminSelectedCategoryName) {
        adminContent += "Please select a recruitment category in the panel to view statuses.";
    } else {
        adminContent += "No recruitment data to display. Please select a category or check logs if issues persist.";
    }
    // No need for an extra newline if join is used, as it doesn't end with one.
    // If using a list, ensure [list]...[/list] structure.
    return adminContent;
};

export const formDefinitions = [
    // Civilian Forms First
    { version: 3, name: "[Civilian] Patient File - Advanced", group: "PHMC", icon: Civilian, generator: generateAdvancedPatientFile, FieldComponent: PatientAdvanced, titleKey: "patientFileAdvanced", sortOrder: 3, hasCustomTitle: true },
    { version: 24, name: "[Civilian] Medical Release Form", group: "PHMC", icon: Civilian, generator: generateMedicalRecordRelease, FieldComponent: MedicalRelease, titleKey: "medicalRelease", sortOrder: 1, hasCustomTitle: true },
    { version: 25, name: "[Civilian] Patient File - Basic", group: "PHMC", icon: Civilian, generator: generateBasicPatientFile, FieldComponent: BasicPatientFile, titleKey: "patientFileBasic", sortOrder: 2, hasCustomTitle: true },

    // PHMC Forms (Forensic Services next, then others)
    { version: 1, name: "Forensic Services ", group: "PHMC", icon: corpse, generator: generateDeathReport, FieldComponent: DeathReport, titleKey: "deathReport", sortOrder: 10, hasCustomTitle: true },
    { version: 4, name: "Autopsy Report", group: "PHMC", icon: corpse /* Placeholder */, generator: generateAutopsy, FieldComponent: Autopsy, titleKey: "autopsyReport", sortOrder: 11, isHiddenInSelector: true, hasCustomTitle: true },
    { version: 2, name: "Coroner Email", group: "PHMC", icon: emailIcon, generator: generateEmail, FieldComponent: CoronerEmail, titleKey: "coronerEmail", sortOrder: 12, isHiddenInSelector: true, hasCustomTitle: true },
    { version: 8, name: "Certificate of Death", group: "PHMC", icon: corpse, generator: generateCertificate, FieldComponent: Certificate, titleKey: "certificateOfDeath", sortOrder: 13, isHiddenInSelector: true, hasCustomTitle: true },
    { version: 5, name: "Surgical Ops", group: "PHMC", icon: surgeon, generator: generateSurgicalOps, FieldComponent: Surgical, titleKey: "surgicalOps", sortOrder: 20 },
    { version: 6, name: "Physical Evaluation", group: "PHMC", icon: nurse, generator: generatePhysEvalInternalMed, FieldComponent: PhysEval, titleKey: "physEvalPHMC", sortOrder: 21 },

    // Add isHiddenInSelector: true to the PBC version
    { version: 7, name: "Physical Evaluation (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generatePhysEvalInternalMedPBC, FieldComponent: PhysEval, titleKey: "physEvalPBC", sortOrder: 22, isHiddenInSelector: true },
    { version: 14, name: "Mental Health", group: "PHMC", icon: psychology, generator: generateMentalHealthPHMC, FieldComponent: MentalHealth, titleKey: "mentalHealthPHMC", sortOrder: 23 },
    // Add isHiddenInSelector: true to the PBC version
    { version: 16, name: "Mental Health (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generateMentalHealthPBC, FieldComponent: MentalHealth, titleKey: "mentalHealthPBC", sortOrder: 24, isHiddenInSelector: true },
    { version: 19, name: "ER Protocol", group: "PHMC", icon: emergency, generator: generateEmergencyProtocol, FieldComponent: EmergencyForm, titleKey: "erProtocol", sortOrder: 25 },
    { version: 20, name: "General Consultation", group: "PHMC", icon: empathy, generator: generateConsultationNotesPHMC, FieldComponent: GeneralConsult, titleKey: "generalConsultPHMC", sortOrder: 26 },
    // Add isHiddenInSelector: true to the PBC version
    { version: 21, name: "General Consultation (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generateConsultationNotesPBC, FieldComponent: GeneralConsult, titleKey: "generalConsultPBC", sortOrder: 27, isHiddenInSelector: true },
    { version: 22, name: "Commentary Notes", group: "PHMC", icon: paperwork, generator: generateCommentaryNotePHMC, FieldComponent: CommNotePHMC, titleKey: "commNotePHMC", sortOrder: 28 },
    // Add isHiddenInSelector: true to the PBC version
    { version: 23, name: "Commentary Notes (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generateCommentaryNotePBC, FieldComponent: CommNotePBC, titleKey: "commNotePBC", sortOrder: 29, isHiddenInSelector: true },
    { version: 27, name: "PHMC Internal Email", group: "PHMC", icon: emailIcon, generator: generateEmailPHMCEmail, FieldComponent: EmailInternal, titleKey: "internalEmail", sortOrder: 30 },
    { version: 28, name: "Psychological Evaluation", group: "PHMC", icon: psychology, generator: generatePsychEvalPHMC, FieldComponent: Shrink, titleKey: "psychEvalPHMC", sortOrder: 31 },
    // Add isHiddenInSelector: true to the PBC version
    { version: 29, name: "Psychological Evaluation (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generatePsychEvalPBC, FieldComponent: Shrink, titleKey: "psychEvalPBC", sortOrder: 32, isHiddenInSelector: true },
    { version: 35, name: "Medical Sickness Email", group: "PHMC", icon: emailIcon, generator: generateSicknessEmail, FieldComponent: SicknessEmail, titleKey: "sicknessEmail", sortOrder: 33, isHiddenInSelector: true }, // No FieldComponent for this one
    // SAAA Forms
    {
        version: 30,
        name: "SAAA Entry Level Employment",
        group: "SAAA",
        icon: application,
        generator: generateEntryJob,
        FieldComponent: EntryJob,
        titleKey: "saaaEntryJob",
        sortOrder: 100,
        hasCustomTitle: true,
        requiredFields: [
            'patientTitle', 'patientFirstName', 'patientLastName', 'patientContactNumber', 'patientDOB', 'patientBirth',
            'healthImpairments', 'healthStandingIssues', 'eduHighSchoolName', 'eduHighSchoolYear',
            'empGovExperience', 'licCitizenship', 'licPilotLicense', 'oocUcpName', 'oocDiscord',
            'oocForumName', 'oocTimezone', 'oocGtawPlaytime', 'oocEnglishProficiency',
            'oocOtherFactionInfo', 'oocFactionBans', 'oocOtherCharacters', 'adminRecordLink',
            'inGameStatsLink', 'charBackground', 'ackAuthorize'
        ]
    },
    {
        version: 31,
        name: "SAAA Flight School Application",
        group: "SAAA",
        icon: application,
        generator: generateFlightSchool,
        FieldComponent: FlightSchool,
        titleKey: "saaaFlightSchool",
        sortOrder: 101,
        requiredFields: [
            'regFullName', 'regContactNumber', 'regPosition', 'companyName', 'companyAddress',
            'chiefPilotFullName', 'chiefPilotContactNumber', 'trainingPlanLink'
        ]
    },
    {
        version: 32,
        name: "SAAA Aircraft Registration",
        group: "SAAA",
        icon: application,
        generator: generateAircraftReg,
        FieldComponent: AircraftRegistration,
        titleKey: "saaaAircraftReg",
        sortOrder: 102,
        requiredFields: [
            'registrantFirstName', 'registrantLastName', 'registrantDateOfBirth', 'registrantPlaceOfBirth',
            'registrantAddress', 'registrantContactNumber', 'aircraftType', 'aircraftModel',
            'aircraftDateOfPurchase', 'aircraftImageLink', 'requestedCallsign'
        ]
    },
    {
        version: 33,
        name: "SAAA Airline / Agency Operation Permit",
        group: "SAAA",
        icon: application,
        generator: generateAirline,
        FieldComponent: Airline,
        titleKey: "saaaAirlinePermit",
        sortOrder: 103,
        requiredFields: [
            'companyName', 'contactNumber', 'companyAddress', 'ceoFullName',
            'chiefPilots', 'staffList', 'ackAuthorize',
        ]
    },
    {
        version: 34,
        name: "SAAA Heliport Registration",
        group: "SAAA",
        icon: application,
        generator: generateHeliport,
        FieldComponent: Heliport,
        titleKey: "saaaHeliportReg",
        sortOrder: 104,
        requiredFields: [
            'registrantFullName', 'registrantContactNumbers', 'registrantResidentialAddress',
            'heliportAddresses', 'heliportNumPads', 'heliportPhotoLinks',
            'heliportLayoutPlanLinks', 'ackAuthorize'
        ]
        
    },
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
    },
];

// Helper to get form definition by version
export const getFormDefinition = (version) => formDefinitions.find(form => form.version === version);

// Helper to generate versionNames map for display (if still needed elsewhere, or can be derived from formDefinitions)
export const generateVersionNames = () => {
    const names = {};
    formDefinitions.forEach(form => {
        names[form.version] = form.name;
    });
    return names;
};
