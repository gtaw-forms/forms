// src/formDefinitions.js
import {
    CommNotePHMC, CommNotePBC, DeathReport, CoronerEmail, PatientAdvanced, MentalHealth,
    EmailInternal, Surgical, PhysEval, EmergencyForm, GeneralConsult,
    MedicalRelease, BasicPatientFile, Shrink, Autopsy,
} from './phmc-field-data'; // Assuming all field components are here for now

import {
    generateDeathReport, generateEmail, generateSurgicalOps, generateAdvancedPatientFile,
    generatePhysEvalInternalMed, generatePhysEvalInternalMedPBC, generateMentalHealthPHMC,
    generateMentalHealthPBC, generateConsultationNotesPHMC,
    generateEmergencyProtocol, generateCommentaryNotePHMC, generateCommentaryNotePBC,
    generateMedicalRecordRelease, generateBasicPatientFile, generateEmailPHMCEmail,
    generateConsultationNotesPBC, generatePsychEvalPHMC, generatePsychEvalPBC,
    generateAutopsy,
} from './phmc-bbcode-generators'; // Assuming all PHMC generators are here
import generatePhysician from './phmc-recruitment-generators/generatePhysician'; // Make sure this path is correct
import PhysicianFields from './phmc-field-data/Physician'; // Path to your new component

import generateEntryJob from './saaa-form-generators/generateEntryJob'; // SAAA generator
import generateFlightSchool from './saaa-form-generators/generateFlightSchool'; // SAAA generator
import generateAircraftReg from './saaa-form-generators/generateAircraftReg'; // SAAA generator
import generateAirline from './saaa-form-generators/generateAirline';
import generateHeliport from './saaa-form-generators/generateHeliport'; // SAAA generator
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
export const formDefinitions = [
    // Civilian Forms First
    { version: 3, name: "[Civilian] Patient File - Advanced", group: "PHMC", icon: Civilian, generator: generateAdvancedPatientFile, FieldComponent: PatientAdvanced, titleKey: "patientFileAdvanced", sortOrder: 3 },
    { version: 24, name: "[Civilian] Medical Release Form", group: "PHMC", icon: Civilian, generator: generateMedicalRecordRelease, FieldComponent: MedicalRelease, titleKey: "medicalRelease", sortOrder: 1 },
    { version: 25, name: "[Civilian] Patient File - Basic", group: "PHMC", icon: Civilian, generator: generateBasicPatientFile, FieldComponent: BasicPatientFile, titleKey: "patientFileBasic", sortOrder: 2 },

    // PHMC Forms (Forensic Services next, then others)
    { version: 1, name: "Forensic Services ", group: "PHMC", icon: corpse, generator: generateDeathReport, FieldComponent: DeathReport, titleKey: "deathReport", sortOrder: 10 },
    { version: 4, name: "Autopsy Report", group: "PHMC", icon: corpse /* Placeholder */, generator: generateAutopsy, FieldComponent: Autopsy, titleKey: "autopsyReport", sortOrder: 11, isHiddenInSelector: true }, // Restored and marked as hidden
    { version: 2, name: "Coroner Email", group: "PHMC", icon: emailIcon, generator: generateEmail, FieldComponent: CoronerEmail, titleKey: "coronerEmail", sortOrder: 12, isHiddenInSelector: true },
    { version: 5, name: "Surgical Ops", group: "PHMC", icon: surgeon, generator: generateSurgicalOps, FieldComponent: Surgical, titleKey: "surgicalOps", sortOrder: 20 },
    { version: 6, name: "Physical Evaluation", group: "PHMC", icon: nurse, generator: generatePhysEvalInternalMed, FieldComponent: PhysEval, titleKey: "physEvalPHMC", sortOrder: 21 },
    { version: 7, name: "Physical Evaluation (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generatePhysEvalInternalMedPBC, FieldComponent: PhysEval, titleKey: "physEvalPBC", sortOrder: 22 },
    { version: 14, name: "Mental Health", group: "PHMC", icon: psychology, generator: generateMentalHealthPHMC, FieldComponent: MentalHealth, titleKey: "mentalHealthPHMC", sortOrder: 23 },
    { version: 16, name: "Mental Health (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generateMentalHealthPBC, FieldComponent: MentalHealth, titleKey: "mentalHealthPBC", sortOrder: 24 },
    { version: 19, name: "ER Protocol", group: "PHMC", icon: emergency, generator: generateEmergencyProtocol, FieldComponent: EmergencyForm, titleKey: "erProtocol", sortOrder: 25 },
    { version: 20, name: "General Consultation", group: "PHMC", icon: empathy, generator: generateConsultationNotesPHMC, FieldComponent: GeneralConsult, titleKey: "generalConsultPHMC", sortOrder: 26 },
    { version: 21, name: "General Consultation (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generateConsultationNotesPBC, FieldComponent: GeneralConsult, titleKey: "generalConsultPBC", sortOrder: 27 },
    { version: 22, name: "Commentary Notes", group: "PHMC", icon: paperwork, generator: generateCommentaryNotePHMC, FieldComponent: CommNotePHMC, titleKey: "commNotePHMC", sortOrder: 28 },
    { version: 23, name: "Commentary Notes (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generateCommentaryNotePBC, FieldComponent: CommNotePBC, titleKey: "commNotePBC", sortOrder: 29 },
    { version: 27, name: "Internal Email", group: "PHMC", icon: emailIcon, generator: generateEmailPHMCEmail, FieldComponent: EmailInternal, titleKey: "internalEmail", sortOrder: 30 },
    { version: 28, name: "Psychological Evaluation", group: "PHMC", icon: psychology, generator: generatePsychEvalPHMC, FieldComponent: Shrink, titleKey: "psychEvalPHMC", sortOrder: 31 },
    { version: 29, name: "Psychological Evaluation (PBC)", group: "PHMC", icon: phmcpaletobay, generator: generatePsychEvalPBC, FieldComponent: Shrink, titleKey: "psychEvalPBC", sortOrder: 32 },

    // SAAA Forms
    // Make sure to use a unique version number for SAAA forms that doesn't clash with PHMC
    {
        version: 30,
        name: "SAAA Entry Level Employment",
        group: "SAAA",
        icon: application,
        generator: generateEntryJob,
        FieldComponent: EntryJob,
        titleKey: "saaaEntryJob",
        sortOrder: 100,
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
            // Note: aircraftTypesSelected & aircraftModelsSelected (multi-selects) are not included here
            // as "required" for this notification unless specific "at least one" validation is added.
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
            // ackAuthorize is not in the AircraftRegistration.js FieldComponent UI, so not listed here.
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
            // specOtherText is conditionally required; handled in App.js logic if specOther is true
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
        name: "PHMC General Application",
        group: "PHMC Recruitment",
        icon: application, // Or your preferred icon
        generator: generatePhysician, // Use the updated generator
        FieldComponent: PhysicianFields, // Use the new field component
        titleKey: "phmcGeneralApplication",
        sortOrder: 200,
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
