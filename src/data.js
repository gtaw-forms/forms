// TO DO: update the new logos

import LSPDLogo from './assets/lspd.png'
import LSSDLogo from './assets/lssd.png'
import LSFDLogo from './assets/lsfd.png'
import PHMCLogo from './assets/phmc.png'
import sanfire from './assets/sanfire.png'
import sadcr from './assets/sadcr.png'
import lsgov from './assets/lsgov.png'

export const agencyData = {
    LSPD: {
        logo: LSPDLogo,
        url: 'https://lspd.gta.world/ucp.php?i=pm&mode=compose'
    },
    LSSD: {
        logo: LSSDLogo,
        url: 'https://lssd.gta.world/ucp.php?i=pm&mode=compose'
    },
    LSFD: {
        logo: LSFDLogo,
        url: 'https://lsfd.gta.world/ucp.php?i=pm&mode=compose'
    },
    PHMC: {
        logo: PHMCLogo,
        url: 'https://phmc.gta.world/ucp.php?i=pm&mode=compose'
    },
    SANFIRE: {
        logo: sanfire,
        url: 'https://sfm-forum.gta.world/ucp.php?i=pm&mode=compose'
    },
    SADCR: {
        logo: sadcr,
        url: 'https://sadcr.gta.world/ucp.php?i=pm&mode=compose'
    },
    LSGOV: {
        logo: lsgov,
        url: 'https://lsgov.gta.world/ucp.php?i=pm&mode=compose'
    },
};

export const PurposeMedicalInformationRelease = [
    { value: 'Further Treatment', label: 'Further Treatment / Continued Care' },
    { value: 'Personal', label: 'Personal Use' },
    { value: 'Attorney', label: 'Attorney Client' },
    { value: 'Other', label: 'Other' },
];
export const PurposeMedicalInformationReleaseFormat = [
    { value: 'CopyofRecords', label: 'Copy of Record Pickup' },
    { value: 'VerbalRelease', label: 'Verbal Release' },
    { value: 'ElectronicRelease', label: 'Electronical Release' },
    { value: 'Other', label: 'Other' },
];


export const patientBloodType = [
    { value: 'A+', label: 'A+' },
    { value: 'A-', label: 'A-' },
    { value: 'B+', label:  'B+' },
    { value: 'B-', label: 'B-' },
    { value: 'O+', label: 'O+' },
    { value: 'O-', label: 'O-' },
    { value: 'AB+', label: 'AB+' },
    { value: 'AB-', label: 'AB-' },
];
// to add in next update, replace isNurse, isDoctor with Form.Select 
export const phmcRank = [
    { value: 'Nurse', label: 'Nurse' },
    { value: 'NP', label: 'Nurse Practitioner' },
    { value: 'Psych', label: 'Psych' },
    { value: 'Physician', label: 'Physician' },
    { value: 'Surgeon', label: 'Surgeon' },
    { value: 'PA', label: 'Physician Assistant' },
    { value: 'Phyiscal Therapist', label: 'Physical Therapist' },
];
export const MedicalRecordsRelease = [
    { value: 'ERVisit', label: 'Emergency Room Visit: ER notes, progress notes, consultations, procedure notes, test results' },
    { value: 'HospitalStay', label: 'Hospital Stay: History and physical, progress notes, consultations, operative reports, discharge summary, test results' },
    { value: 'Outpatient', label: 'Outpatient Surgery/Procedure: History and physical, progress notes, consultations, procedure notes, test results' },
    { value: 'OfficeClinic', label: 'Clinic, Office Visit or Immediate Care: Office notes, progress notes, procedure notes, test results' },
    { value: 'PsychologyVisits', label: 'Psychology Visits: Office notes, progress notes, procedure notes, evaluation results' },
    { value: 'Other', label: 'Other' },

];
export const followup = [
    { value: 'AsNeeded', label: 'As Needed' },
    { value: 'Recommended', label: 'Recommended' },
    { value: 'Electiveprocedure', label: 'No' },
];
export const departmentLarge = [
    { value: 'InternalMedicine', label: 'Internal Medicine' },
    { value: 'EmergencyMedicine', label: 'Emergency Medicine' },
    { value: 'Surgical', label: 'Surgical Department' },
    { value: 'Midwifery', label: 'Midwifery' },
    { value: 'PhysicalTherapy', label: 'Physical Therapy' },
    { value: 'Dentistry', label: 'Dentistry' },
    { value: 'MentalHealth', label: 'Mental Health' },
    { value: 'Administration', label: 'Administration' }
];

export const assignedDepartment = [
    { value: 'InternalMedicine', label: 'Internal Medicine' },
    { value: 'SurgicalDepartment', label: 'Surgical Department' },
    { value: 'Midwifery', label: 'Midwifery' },
    { value: 'Dialysis', label: 'Dialysis' }
];
export const paletoClinicDepartment = [
    { value: 'InternalMedicine', label: 'Internal Medicine' },
    { value: 'SurgicalDepartment', label: 'Surgical Department' },
];

export const BodyMassIndex = [
    { value: 'Underweight', label: 'Underweight' },
    { value: 'Normal', label: 'Normal' },
    { value: 'Overweight', label: 'Overweight' },
    { value: 'Obese', label: 'Obese' },
    { value: 'ExtremeObese', label: 'Extreme Obese'}
];

// Triage System for ER Protocol
export const painLevel = [
    { value: 'patientNoPain', label: 'No pain/non-urgent' },
    { value: 'patientNormalPain', label: 'Normal pain/less-urgent' },
    { value: 'patientMildPain', label: 'Mild pain/urgent' },
    { value: 'patientSeverePain', label: 'Severe pain/urgent' },
    { value: 'patientCritical', label: 'Critical/Emergent' }
];
// Vitals for ER Protocol
export const temperature = [
    { value: 'patientTempNormal', label: 'Normal' },
    { value: 'patientHypothermic', label: 'Hypothermic' },
    { value: 'patientHyperthermic', label: 'Hyperthermic' }
];
export const patientTitle = [
    { value: 'Mstr', label: 'Master (Child <18 Y/O)' },
    { value: 'Mr', label: 'Mr' },
    { value: 'Mrs', label: 'Mrs' },
    { value: 'Ms', label: 'Ms' },
    { value: 'Other', label: 'Other' }
];

export const patientPhone = [
    { value: 'Mobile', label: 'Mobile' },
    { value: 'Home', label: 'Home' },
    { value: 'Work', label: 'Work' },
    { value: 'Other', label: 'Other' }
];
export const heartRate = [
    { value: 'patientHeartRateNormal', label: 'Normal' },
    { value: 'patientHeartRateBradycardia', label: 'Bradycardia' },
    { value: 'patientHeartRateTachycardia', label: 'Tachycardia' }
];
export const breathing = [
    { value: 'patientBreathingNormal', label: 'Normal' },
    { value: 'patientBreathingSlow', label: 'Slow' },
    { value: 'patientBreathingFast', label: 'Fast' },
    { value: 'patientBreathingObstructed', label: 'Obstructed' }
];
export const bloodPressure = [
    { value: 'patientBloodPressureNormal', label: 'Normal' },
    { value: 'patientBloodPressureHypotension', label: 'Hypotension' },
    { value: 'patientBloodPressureHypertension', label: 'Hypertension' }
];
// Findings for ER Protocol
export const findings = [
    { value: 'patientNormal', label: 'Normal' },
    { value: 'patientImpared', label: 'Impared' }
];
export const lungs = [
    { value: 'patientNormal', label: 'Normal' },
    { value: 'patientRhonchi', label: 'Rhonchi' },
    { value: 'patientCrack', label: 'Crackles' }
];
export const pupils = [
    { value: 'patientPupilsNormal', label: 'Normal' },
    { value: 'patientPupilsAbnormal', label: 'Abnormal' }
];
export const wounds = [
    { value: 'patientNoWounds', label: 'No wounds' },
    { value: 'patientFractures', label: 'Fractures' },
    { value: 'Contusions', label: 'Contusions' },
    { value: 'patientBleeding', label: 'Bleeding' },
    { value: 'patientHematoma', label: 'Hematoma' }
];
export const bloodOxy =[ 
    { value: 'patientBloodOxyHigh', label: 'Normal (95%+)' },
    { value: 'patientBloodOxyNormal', label: 'Hypoxic (Below 90%)' },
    { value: 'patientBloodOxyLow', label: 'Borderline (90-94%)' },
]
export const ecg = [
    { value: 'patientSinusRhythm', label: 'Sinus Rhythm' },
    { value: 'patientArrhythmia', label: 'Arrhythmia' },
    { value: 'patientInfaction', label: 'Infaction' }
];
export const sono = [
    { value: 'patientNormal', label: 'Normal' },
    { value: 'patientFluids', label: 'Fluids' },
    { value: 'patientTissue', label: 'Tissue' }
];
export const lab = [
    { value: 'WNL', label: 'Within Normal Limits' },
    { value: 'Anemia', label: 'Anemia' },
    { value: 'Inflammation/Infection', label: 'Inflammation/Infection' },
    { value: 'Dysfunction', label: 'Dysfunction' },
    { value: 'ElectrolyteImbalance', label: 'Electrolyte Imbalance' },
    { value: 'Infarct', label: 'Infarct/Embolism' },
    { value: 'Tumor', label: 'Tumor' }
];
export const gender = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
];
export const patientConsent = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No' },
];
export const complications = [ 
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No' },
];
export const procedureGood = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No' },
]

export const admission = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No' },
];
export const patientJob = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No' },
];
export const patientJobRisks = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No' },
];
export const patientAllergiesRisk = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No' },
];
export const patientMedicineRegular = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No' },
];
export const patientOther = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No' },
];
export const predisposition = [
    { value: 'Existing', label: 'Existing' },
    { value: 'NonExisting', label: 'Non-existing' },
];
//Marital Status
export const maritalStatus = [
    { value: 'Single', label: 'Single' },
    { value: 'Married', label: 'Married' },
    { value: 'Divorced', label: 'Divorced' },
];
export const numberChildren = [
    { value: '0', label: '0' },
    { value: '1', label: '1' },
    { value: '1', label : '2' },
    { value: '1', label : '3+' },

]
//financial status
export const financialStatus = [
    { value: 'LowIncome', label: 'Low Income' },
    { value: 'MiddleIncome', label: 'Middle Income' },
    { value: 'HighIncome', label: 'High Income' },
]
// patient DNR
export const dnr = [
    { value: 'ProlongLife', label: 'Prolong Life'},
    { value: 'ComfortOfLife', label: 'Comfort Of Life'},
    { value: 'other', label: 'Other'}
]
// power of attorney
export const attorney = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No'}
]
export const dnrOrder = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No'}
]
// shrink chaos
export const Appearance = [
    { value: 'Good', label: 'Well-groomed' },
    { value: 'Disheveled', label: 'Disheveled'},
    { value: 'Inappropriate', label: 'Inappropriate'},
]
export const Behavior = [
    { value: 'Cooperative', label: 'Cooperative' },
    { value: 'Agitated', label: 'Agitated'},
    { value: 'Withdrawn', label: 'Withdrawn'},
]
export const Speech = [ 
    { value: 'Normal', label: 'Normal' },
    { value: 'Pressured', label: 'Pressured'},
    { value: 'Slurred', label: 'Slurred'},
    { value: 'Slow', label: 'Slow'},
]
export const Mood = [
    { value: 'Euthymic', label: 'Euthymic' },
    { value: 'Depressed', label: 'Depressed'},
    { value: 'Anxious', label: 'Anxious'},
    { value: 'Angry', label: 'Angry'},
]
export const Affect =[ 
    { value: 'Congruent', label: 'Congruent' },
    { value: 'Flat', label: 'Flat'},
    { value: 'Inappropriate', label: 'Inappropriate'},
]
export const ThoughtProcess = [
    { value: 'Logical', label: 'Logical' },
    { value: 'Organized', label: 'Organized'},
    { value: 'Tangential', label: 'Tangential'},
    { value: 'Disorganised', label: 'Disorganised'},
]
export const ThoughtContent = [
    { value: 'Nodelusions', label: 'Nodelusions' },
    { value: 'Delusions', label: 'Delusions'},
    { value: 'Hallucinations', label: 'Hallucinations'},
    { value: 'Suicidal', label: 'Suicidal'},
    { value: 'Homicidal', label: 'Homicidal'},
]
export const Insight = [
    { value: 'Intact', label: 'Intact' },
    { value: 'Limited', label: 'Limited'},
    { value: 'Poor', label: 'Poor'},
]
export const Cognition = [
    { value: 'Oriented', label: 'Oriented' },
    { value: 'Memory', label: 'Memory'},
    { value: 'Attention', label: 'Attention'},
]
export const Risk = [
    { value: 'Suicidal', label: 'Suicidal' },
    { value: 'Homicidal', label: 'Homicidal'},
    { value: 'Self', label: 'Self'},
]
export const drugList = [
    { value: 'cooldrugs', label: 'cooldrugs' },
    { value: 'Ketamine', label: 'Ketamine'},
    { value: 'Cocaine', label: 'Cocaine'},
    { value: 'Other', label: 'Other'},
]
    export const phmcList = [
    // NPC Leadership and Supervisor
    { name: 'Missing Name', lastName: 'Missing Last Name', signature: '', category: 'Missing Category' },
    { name: 'Doctor Smith', lastName: 'Smith', signature: 'Doctor Smith ', category: '(( NPC DOCTOR ))' },
    { name: 'Evelyn Bleichroder', lastName: 'Bleichroder', signature: 'https://i.imgur.com/knYKimz.png', category: 'Leadership' },
    { name: 'Amaya Kim', lastName: 'Kim', signature: 'https://i.imgur.com/ZSy7QZs.png', category: 'Leadership' },
    { name: 'Kaden Malik', lastName: 'Malik', signature: 'https://i.imgur.com/K9G0mZ9.png', category: 'Leadership' },
    { name: 'Lyla Epps', lastName: 'Epps', signature: 'https://i.imgur.com/jvttdmC.png', category: 'Leadership' },
    { name: 'Roan Roybal', lastName: 'Roybal', signature: 'https://i.imgur.com/vtbmbuT.png', category: 'Leadership' },
    { name: 'Sydney Lear', lastName: 'Lear', signature: 'https://i.imgur.com/lASeSxM.png', category: 'Hospital Supervisor' },

    // Physician
    { name: 'Gavin Reed	', lastName: 'Reed', signature: '', category: 'Resident Physician' },
    { name: 'Austin Rhodes    ', lastName: 'Rhodes', signature: '', category: 'Resident Physician' },
    { name: 'Damien Heredia', lastName: 'Heredia', signature: '', category: 'Resident Physician' },
    { name: 'Christine Lin	', lastName: 'Lin', signature: '', category: 'Resident Physician' },

    { name: 'Raven Lewis', lastName: 'Lewis', signature: 'https://i.imgur.com/BwM3SOT.png', category: 'Physician' },
    { name: 'Kaiden Weiner', lastName: 'Weiner', signature: 'https://i.imgur.com/jDT3FNr.png', category: 'Physician' },
    { name: 'Freya Stiglitz', lastName: 'Stiglitz', signature: 'Doctor Freya Stiglitz', category: 'Physician' },
    { name: 'Lyanna Nystrom', lastName: 'Nystrom', signature: '', category: 'Physician' },
    { name: 'Esme Crawford', lastName: 'Crawford', signature: '', category: 'Physician Assistant' },
    { name: 'Cory Valentine', lastName: 'Valentine', signature: '', category: 'Physician Assistant' },

    { name: 'Julie Kang	', lastName: 'Kang', signature: '', category: 'Physician Assistant' },


    // Misc roles
    { name: 'Sanad Qaqish	', lastName: 'Qaqish', signature: '', category: 'Dentist' },

    // Internal Medicine
    { name: 'Lillian Chandler	', lastName: 'Chandler', signature: '', category: 'Psychiatrist' },
    { name: 'Sabrina Schaefer    ', lastName: 'Schaefer', signature: '', category: 'Psychiatrist' },
    { name: 'Joe Whiteman', lastName: 'Whiteman', signature: '', category: 'Psychiatrist' },
    { name: 'Anna Li', lastName: 'Li', rank: 'Resident Physician', category: 'Resident Physician' },
    // Psychologist
    { name: 'Julian Leander	', lastName: 'Leander', signature: '', category: 'Psychologist' },
    { name: 'Paolina Russo	', lastName: 'Russo', signature: '', category: 'Psychologist' },
    { name: 'Rahi Badman', lastName: 'Badman', signature: '', category: 'Psychologist' },
    { name: 'Sia Rousseau', lastName: 'Rousseau', signature: '', category: 'Psychologist' },

    // Nurses
    { name: 'Ash Edelweiss		', lastName: 'Edelweiss', signature: '', category: 'Nursing' },
    { name: 'Erika Krieger	', lastName: 'Krieger', signature: '', category: 'Nursing' },
    { name: 'Jaya Tiwari', lastName: 'Tiwari', signature: '', category: 'Nursing' },
    { name: 'Khinara Bishop	', lastName: 'Bishop', signature: '', category: 'Nursing' },
    { name: 'Lindsay Thompson	', lastName: 'Thompson', signature: '', category: 'Nursing' },
    { name: 'Mireille Simmonds	', lastName: 'Simmonds', signature: '', category: 'Nursing' },
    { name: 'Nina Kim', lastName: 'Kim', signature: '', category: 'Nursing' },
    { name: 'Nour Hayek	', lastName: 'Hayek', signature: '', category: 'Nursing' },
    { name: 'Rayne Krauser	', lastName: 'Krauser', signature: '', category: 'Nursing' },
    { name: 'Rubina Nerkararyan	', lastName: 'Nerkararyan', signature: '', category: 'Nursing' },
    { name: 'Sandra Dawson	', lastName: 'Dawson', signature: '', category: 'Nursing' },
    { name: 'Skylar Marsh', lastName: 'Marsh', signature: '', category: 'Nursing' },
    { name: 'Tamina Dellavedova	', lastName: 'Dellavedova', signature: '', category: 'Nursing' },
    { name: 'Winter Calderone', lastName: 'Calderone', signature: '', category: 'Nursing' },
    { name: `Evelyn Myers`, lastName: 'Myers', signature: '', category: 'Nursing' },
    { name: 'Aika Irabon', lastName: 'Irabon', signature: '', category: 'Resident Physician' },
    { name: 'Erik Schaefer', lastName: 'Schaefer', signature: '', category: 'Resident Physician' },
    { name: 'Mia Robinson' , lastName: 'Robinson', signature: '', category: 'Nursing' },
    { name: 'Emile Sarkis', lastName: 'Sarkis', signature: '', category: 'Resident Physician' },
    { name: 'Jayden Woo', lastName: 'Woo', signature: '', category: 'Nursing' },
    { name: 'Harper Cassidy', lastName: 'Cassidy',  category: 'Attending Physician' },
    // ems
    { name: 'Will Flanary', lastName: 'Flanary', signature: '', category: 'Emergency Medical Services' },
];
export const coronerList = [
    { name: 'Developer Testing', badge: 'Developer_Testing', phNumber: '123123', rank: 'Developer Testing', discord: 'developer.testing', category: 'Developer Testing' },
    { name: 'Missing Name', badge: 'Missing_Badge', rank: 'Missing_Rank', discord: 'missing.discord', category: 'Missing_Category' },
    { name: 'Anne Carter', badge: '4892', rank: 'Chief Medical Examiner', discord: 'ralof.from.riverwood', category: 'Chief Boss' },
    { name: 'Elena Hill', badge: '108273', rank: 'Deputy Chief Medical Examiner', discord: 'unity0034', category: 'Chief Boss' },
    { name: 'Laurent Hall', badge: '91338854', rank: 'Supervisor Forensic Attendant', discord: 'faethewtich', category: 'Supervisor' },
    { name: 'Alyson Frost', badge: '5573', rank: 'Senior Coroner Investigator', discord: 'fr0sty.js', category: 'Senior Coroner Investigator' },
    { name: 'Arthur Blackwood', badge: '153528', rank: 'Senior Medical Examiner', discord: 'deputysmall', category: 'Senior Medical Examiner' },
    { name: 'Ellie Paisley', badge: '151785', rank: 'Coroner Investigator', discord: 'hoperunsthin', category: 'Coroner Investigator' },
    { name: 'Avery Purcell', badge: '181311', rank: 'Coroner Investigator', discord: 'urkaaa_', category: 'Coroner Investigator' },
    { name: 'Luna Rosario', badge: '157235', rank: 'Coroner Investigator', discord: 'assszzz', category: 'Coroner Investigator' },
{ name: 'Norah Reed', badge: '93014', phNumber: '58855328', rank: 'Medical Examiner', discord: 'amnesia5290', category: 'Medical Examiner' },    { name: 'James McKinney', badge: 'ID_MISSING_ERROR', rank: 'Forensic Attendant', discord: 'boots7163', category: 'Forensic Attendant' },
    { name: 'Luca Raymond', badge: '181726', rank: 'Forensic Attendant', discord: 'itscharlie3529', category: 'Forensic Attendant' },
    { name: 'Roger Rose', badge: '1552', phNumber: '45100', rank: 'Medical Examiner', discord: 'nazmaldun', category: 'Medical Examiner' },
    { name: 'Valeria Zaldívar', badge: '183550', phNumber: '23516250', rank: 'Medical Examiner', discord: 'm3aqq', category: 'Medical Examiner' },
    { name: 'Brynn Cappelli', badge: '117468', phNumber: '22000258', rank: 'Coroner Investigator', discord: 'Coroner Investigator', category: 'Coroner Investigator' },
    { name: 'William Gao', badge: '165529', phNumber: '75725652', rank: 'Coroner Investigator', discord: '.slump.', category: 'Coroner Investigator' },
    { name: 'Oscar Castro', badge: '184273', phNumber: '43464144', rank: 'Coroner Investigator', discord: 't3_tris', category: 'Coroner Investigator' },
    { name: 'Nikita Medina', badge: '150723', phNumber: '10032024', rank: 'Trainee Forensic-Attendant', discord: 'nikitamonroe', category: 'Trainee Forensic-Attendant' },
    { name: 'Rosalie Brown', badge: '161606 ', phNumber: '03810764', rank: 'Medical Examiner', discord: 'kayp99', category: 'Medical Examiner' },
{ name: 'Isaac Bailey', badge: '185929', phNumber: '', rank: 'Coroner Investigator', discord: 'psychoticlmao', category: 'Coroner Investigator' },
];

export const skyCare = [
    {name: 'Placeholder Name'} 
]; // Placeholder for SkyCare list, to be filled with actual data later
export const departmentFullName = (abbreviation) => {
    switch (abbreviation) {
        case 'LSPD':
            return 'Los Santos Police Department';
        case 'LSFD':
            return 'Los Santos Fire Department';
        case 'LSSD':
            return 'Los Santos Sheriff Department';
        case 'PHMC':
            return 'Pillbox Hill Medical Center';
        case 'SANFIRE':
            return 'San Andreas Department of Forestry and Fire Protection';
        case 'SADCR':
            return 'San Andreas Department of Corrections and Rehabilitation';
        case 'LSGOV':
            return 'Los Santos City Government';
        case '911 Call':
            return 'Emergency 911 Dispatch Center';
        case 'Protech':
            return 'ProTech Security Solutions';
        default:
            return '';
    }
};