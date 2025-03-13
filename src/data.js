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
    { value: 'Emergency Medicine', label: 'Emergency Medicine' },
    { value: 'SurgicalDepartment', label: 'Surgical Department' },
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
export const vitals = [
    { value: 'patientTempNormal', label: 'Normal' },
    { value: 'patientHypothermic', label: 'Hypothermic' },
    { value: 'patientHyperthermic', label: 'Hyperthermic' }
];
export const patientTitle = [
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
    { value: 'patientBleeding', label: 'Bleeding' },
    { value: 'patientHematoma', label: 'Hematoma' }
];
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
    export const phmcList = [
    // NPC Leadership and Supervisor
    { name: 'Doctor Smith', lastName: 'Smith', signature: 'Doctor Smith ', category: '(( NPC DOCTOR ))' },
    { name: 'Evelyn Bleichroder', lastName: 'Bleichroder', signature: 'https://i.imgur.com/knYKimz.png', category: 'Leadership' },
    { name: 'Amaya Kim', lastName: 'Kim', signature: 'https://i.imgur.com/ZSy7QZs.png', category: 'Leadership' },
    { name: 'Kaden Malik', lastName: 'Malik', signature: 'https://i.imgur.com/K9G0mZ9.png', category: 'Leadership' },
    { name: 'Lyla Malik', lastName: 'Malik', signature: 'https://i.imgur.com/jvttdmC.png', category: 'Leadership' },
    { name: 'Roan Roybal', lastName: 'Roybal', signature: 'https://i.imgur.com/vtbmbuT.png', category: 'Leadership' },
    { name: 'Sydney Lear', lastName: 'Lear', signature: 'https://i.imgur.com/lASeSxM.png', category: 'Hospital Supervisor' },
    { name: 'Danielle Shaw', lastName: 'Shaw', signature: '', category: 'Hospital Supervisor' },

    // Physician
    { name: 'Raven Lewis', lastName: 'Lewis', signature: 'https://i.imgur.com/BwM3SOT.png', category: 'Physician' },
    { name: 'Kaiden Weiner', lastName: 'Weiner', signature: 'https://i.imgur.com/jDT3FNr.png', category: 'Physician' },
    { name: 'Freya Stiglitz', lastName: 'Stiglitz', signature: 'Doctor Freya Stiglitz', category: 'Physician' },
    { name: 'Lyanna Nystrom', lastName: 'Nystrom', signature: '', category: 'Physician' },
    { name: 'Esme Crawford', lastName: 'Crawford', signature: '', category: 'Physician Assistant' },
    { name: 'Julie Kang	', lastName: 'Kang', signature: '', category: 'Physician Assistant' },


    // Misc roles
    { name: 'Gavin Reed	', lastName: 'Reed', signature: '', category: 'Pharmacist' },
    { name: 'Sanad Qaqish	', lastName: 'Qaqish', signature: '', category: 'Dentist' },

    // Internal Medicine
    { name: 'Lillian Chandler	', lastName: 'Chandler', signature: '', category: 'Psychiatrist' },
    { name: 'Ulrica Vacker', lastName: 'Vacker', signature: '', category: 'Psychiatrist' },

    // Psychologist
    { name: 'Julian Leander	', lastName: 'Leander', signature: '', category: 'Psychologist' },
    { name: 'Madison Cooper	', lastName: 'Cooper', signature: '', category: 'Psychologist' },
    { name: 'Paolina Russo	', lastName: 'Russo', signature: '', category: 'Psychologist' },
    { name: 'Rahi Badman', lastName: 'Badman', signature: '', category: 'Psychologist' },
    { name: 'Sarah Hyun		', lastName: 'Hyun', signature: '', category: 'Psychologist' },
    { name: 'Nicole Robinson', lastName: 'Robinson', signature: '', category: 'Psychologist' },

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

];
export const coronerList = [
    { name: 'Anne Carter', badge: '4892', rank: 'Chief Medical Examiner', discord: 'ralof.from.riverwood', category: 'Chief Boss' },
    { name: 'Elena Hill', badge: '108273', rank: 'Deputy Chief Medical Examiner', discord: 'unity0034', category: 'Chief Boss' },
    { name: 'Laurent Hall', badge: '91338854', rank: 'Supervisor Forensic Attendant', discord: 'faethewtich', category: 'Supervisor' },
    { name: 'Chloe Howard', badge: '54372', rank: 'Medical Examiner', discord: 'lovely4ngel', category: 'Medical Examiner' },
    { name: 'Wesley Kramer', badge: '16511', rank: 'Coroner Investigator', discord: 'lucasin16', category: 'Coroner Investigator' },
    { name: 'Roger Rose', badge: '1552', rank: 'Coroner Investigator', discord: 'nazmaldun', category: 'Coroner Investigator' },
    { name: 'Pubert Kennedy', badge: '171763', rank: 'Forensic Attendant', discord: 'mynameiscian', category: 'Forensic Attendant' },
    { name: 'Alyson Frost', badge: '5573', rank: 'Coroner Investigator', discord: 'fr0sty.js', category: 'Coroner Investigator' },
    { name: 'Arthur Blackwood', badge: '153528', rank: 'Medical Examiner', discord: 'deputysmall', category: 'Medical Examiner' },
    { name: 'Ellie Paisley', badge: '151785', rank: 'Coroner Investigator', discord: 'hoperunsthin', category: 'Coroner Investigator' },
    { name: 'Adam Kilroy', badge: '128989', rank: 'Coroner Investigator', discord: 'simon4444', category: 'Coroner Investigator' },
    { name: 'Dominic Castañeda', badge: '', rank: 'Medical Examiner', discord: 'hangonda', category: 'Medical Examiner' },
    { name: 'Avery Purcell', badge: '181311', rank: 'Coroner Investigator', discord: 'urkaaa_', category: 'Coroner Investigator' },
    { name: 'Luna Rosario', badge: '157235', rank: 'Coroner Investigator', discord: 'assszzz', category: 'Coroner Investigator' },
];

export const formatSignature = (signature) => {
    if (!signature) return '';
    return signature.startsWith('http') ? `[img]${signature}[/img]` : signature;
};

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