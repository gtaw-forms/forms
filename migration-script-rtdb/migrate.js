const admin = require('firebase-admin');

// Path to your service account key
const serviceAccount = require('../firebase-admin-key.json'); // Adjust if needed

const DATABASE_URL = "https://gtaw-forms-default-rtdb.europe-west1.firebasedatabase.app";

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: DATABASE_URL
});

const db = admin.database();

 const agencyData = {
    LSPD: {
        logo: 'https://i.imgur.com/sYnULYt.png', // e.g., https://your-hosting.com/lspd.png
        url: 'https://lspd.gta.world/ucp.php?i=pm&mode=compose'
    },
    LSSD: {
        logo: 'https://i.imgur.com/XQeluZx.png', // e.g., https://your-hosting.com/lssd.png
        url: 'https://lssd.gta.world/ucp.php?i=pm&mode=compose'
    },
    LSFD: {
        logo: 'https://i.imgur.com/R6pGW86.png', // e.g., https://your-hosting.com/lsfd.png
        url: 'https://lsfd.gta.world/ucp.php?i=pm&mode=compose'
    },
    PHMC: {
        logo: 'https://i.imgur.com/5ShU1CJ.png', // e.g., https://your-hosting.com/phmc.png
        url: 'https://phmc.gta.world/ucp.php?i=pm&mode=compose'
    },
    SANFIRE: {
        logo: 'https://i.imgur.com/MCsxqMe.png', // e.g., https://your-hosting.com/sanfire.png
        url: 'https://sfm-forum.gta.world/ucp.php?i=pm&mode=compose'
    },
    SADCR: {
        logo: 'https://i.imgur.com/gf9nDwC.png', // e.g., https://your-hosting.com/sadcr.png
        url: 'https://sadcr.gta.world/ucp.php?i=pm&mode=compose'
    },
    LSGOV: {
        logo: 'https://i.imgur.com/qMyb4b7.png', // e.g., https://your-hosting.com/lsgov.png
        url: 'https://lsgov.gta.world/ucp.php?i=pm&mode=compose'
    },
};

 const PurposeMedicalInformationRelease = [
    { value: 'Further Treatment', label: 'Further Treatment / Continued Care' },
    { value: 'Personal', label: 'Personal Use' },
    { value: 'Attorney', label: 'Attorney Client' },
    { value: 'Other', label: 'Other' },
];
 const PurposeMedicalInformationReleaseFormat = [
    { value: 'CopyofRecords', label: 'Copy of Record Pickup' },
    { value: 'VerbalRelease', label: 'Verbal Release' },
    { value: 'ElectronicRelease', label: 'Electronical Release' },
    { value: 'Other', label: 'Other' },
];


 const patientBloodType = [
    { value: 'A+', label: 'A+' },
    { value: 'A-', label: 'A-' },
    { value: 'B+', label:  'B+' },
    { value: 'B-', label: 'B-' },
    { value: 'O+', label: 'O+' },
    { value: 'O-', label: 'O-' },
    { value: 'AB+', label: 'AB+' },
    { value: 'AB-', label: 'AB-' },
];
 const phmcRank = [
    { value: 'Nurse', label: 'Nurse' },
    { value: 'NP', label: 'Nurse Practitioner' },
    { value: 'Psych', label: 'Psych' },
    { value: 'Physician', label: 'Physician' },
    { value: 'Surgeon', label: 'Surgeon' },
    { value: 'PA', label: 'Physician Assistant' },
    { value: 'Phyiscal Therapist', label: 'Physical Therapist' },
];
 const MedicalRecordsRelease = [
    { value: 'ERVisit', label: 'Emergency Room Visit: ER notes, progress notes, consultations, procedure notes, test results' },
    { value: 'HospitalStay', label: 'Hospital Stay: History and physical, progress notes, consultations, operative reports, discharge summary, test results' },
    { value: 'Outpatient', label: 'Outpatient Surgery/Procedure: History and physical, progress notes, consultations, procedure notes, test results' },
    { value: 'OfficeClinic', label: 'Clinic, Office Visit or Immediate Care: Office notes, progress notes, procedure notes, test results' },
    { value: 'PsychologyVisits', label: 'Psychology Visits: Office notes, progress notes, procedure notes, evaluation results' },
    { value: 'Other', label: 'Other' },

];
 const followup = [
    { value: 'AsNeeded', label: 'As Needed' },
    { value: 'Recommended', label: 'Recommended' },
    { value: 'Electiveprocedure', label: 'No' },
];
 const departmentLarge = [
    { value: 'InternalMedicine', label: 'Internal Medicine' },
    { value: 'EmergencyMedicine', label: 'Emergency Medicine' },
    { value: 'Surgical', label: 'Surgical Department' },
    { value: 'Midwifery', label: 'Midwifery' },
    { value: 'PhysicalTherapy', label: 'Physical Therapy' },
    { value: 'Dentistry', label: 'Dentistry' },
    { value: 'MentalHealth', label: 'Mental Health' },
    { value: 'Administration', label: 'Administration' }
];

 const assignedDepartment = [
    { value: 'InternalMedicine', label: 'Internal Medicine' },
    { value: 'SurgicalDepartment', label: 'Surgical Department' },
    { value: 'Midwifery', label: 'Midwifery' },
    { value: 'Dialysis', label: 'Dialysis' }
];
 const paletoClinicDepartment = [
    { value: 'InternalMedicine', label: 'Internal Medicine' },
    { value: 'SurgicalDepartment', label: 'Surgical Department' },
];

 const BodyMassIndex = [
    { value: 'Underweight', label: 'Underweight' },
    { value: 'Normal', label: 'Normal' },
    { value: 'Overweight', label: 'Overweight' },
    { value: 'Obese', label: 'Obese' },
    { value: 'ExtremeObese', label: 'Extreme Obese'}
];

 const painLevel = [
    { value: 'patientNoPain', label: 'No pain/non-urgent' },
    { value: 'patientNormalPain', label: 'Normal pain/less-urgent' },
    { value: 'patientMildPain', label: 'Mild pain/urgent' },
    { value: 'patientSeverePain', label: 'Severe pain/urgent' },
    { value: 'patientCritical', label: 'Critical/Emergent' }
];
 const temperature = [
    { value: 'patientTempNormal', label: 'Normal' },
    { value: 'patientHypothermic', label: 'Hypothermic' },
    { value: 'patientHyperthermic', label: 'Hyperthermic' }
];
 const patientTitle = [
    { value: 'Mstr', label: 'Master (Child <18 Y/O)' },
    { value: 'Mr', label: 'Mr' },
    { value: 'Mrs', label: 'Mrs' },
    { value: 'Ms', label: 'Ms' },
    { value: 'Other', label: 'Other' }
];

 const patientPhone = [
    { value: 'Mobile', label: 'Mobile' },
    { value: 'Home', label: 'Home' },
    { value: 'Work', label: 'Work' },
    { value: 'Other', label: 'Other' }
];
 const heartRate = [
    { value: 'patientHeartRateNormal', label: 'Normal' },
    { value: 'patientHeartRateBradycardia', label: 'Bradycardia' },
    { value: 'patientHeartRateTachycardia', label: 'Tachycardia' }
];
 const breathing = [
    { value: 'patientBreathingNormal', label: 'Normal' },
    { value: 'patientBreathingSlow', label: 'Slow' },
    { value: 'patientBreathingFast', label: 'Fast' },
    { value: 'patientBreathingObstructed', label: 'Obstructed' }
];
 const bloodPressure = [
    { value: 'patientBloodPressureNormal', label: 'Normal' },
    { value: 'patientBloodPressureHypotension', label: 'Hypotension' },
    { value: 'patientBloodPressureHypertension', label: 'Hypertension' }
];
 const findings = [
    { value: 'patientNormal', label: 'Normal' },
    { value: 'patientImpared', label: 'Impared' }
];
 const lungs = [
    { value: 'patientNormal', label: 'Normal' },
    { value: 'patientRhonchi', label: 'Rhonchi' },
    { value: 'patientCrack', label: 'Crackles' }
];
 const pupils = [
    { value: 'patientPupilsNormal', label: 'Normal' },
    { value: 'patientPupilsAbnormal', label: 'Abnormal' }
];
 const wounds = [
    { value: 'patientNoWounds', label: 'No wounds' },
    { value: 'patientFractures', label: 'Fractures' },
    { value: 'Contusions', label: 'Contusions' },
    { value: 'patientBleeding', label: 'Bleeding' },
    { value: 'patientHematoma', label: 'Hematoma' }
];
 const bloodOxy =[
    { value: 'patientBloodOxyHigh', label: 'Normal (95%+)' },
    { value: 'patientBloodOxyNormal', label: 'Hypoxic (Below 90%)' },
    { value: 'patientBloodOxyLow', label: 'Borderline (90-94%)' },
]
 const ecg = [
    { value: 'patientSinusRhythm', label: 'Sinus Rhythm' },
    { value: 'patientArrhythmia', label: 'Arrhythmia' },
    { value: 'patientInfaction', label: 'Infaction' }
];
 const sono = [
    { value: 'patientNormal', label: 'Normal' },
    { value: 'patientFluids', label: 'Fluids' },
    { value: 'patientTissue', label: 'Tissue' }
];
 const lab = [
    { value: 'WNL', label: 'Within Normal Limits' },
    { value: 'Anemia', label: 'Anemia' },
    { value: 'Inflammation/Infection', label: 'Inflammation/Infection' },
    { value: 'Dysfunction', label: 'Dysfunction' },
    { value: 'ElectrolyteImbalance', label: 'Electrolyte Imbalance' },
    { value: 'Infarct', label: 'Infarct/Embolism' },
    { value: 'Tumor', label: 'Tumor' }
];
 const gender = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
];
 const patientConsent = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No' },
];
 const complications = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No' },
];
 const procedureGood = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No' },
]

 const admission = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No' },
];
 const patientJob = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No' },
];
 const patientJobRisks = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No' },
];
 const patientAllergiesRisk = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No' },
];
 const patientMedicineRegular = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No' },
];
 const patientOther = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No' },
];
 const predisposition = [
    { value: 'Existing', label: 'Existing' },
    { value: 'NonExisting', label: 'Non-existing' },
];
 const maritalStatus = [
    { value: 'Single', label: 'Single' },
    { value: 'Married', label: 'Married' },
    { value: 'Divorced', label: 'Divorced' },
];
 const numberChildren = [
    { value: '0', label: '0' },
    { value: '1', label: '1' },
    { value: '2', label : '2' }, // Corrected label
    { value: '3+', label : '3+' }, // Corrected label

]
 const financialStatus = [
    { value: 'LowIncome', label: 'Low Income' },
    { value: 'MiddleIncome', label: 'Middle Income' },
    { value: 'HighIncome', label: 'High Income' },
]
 const dnr = [
    { value: 'ProlongLife', label: 'Prolong Life'},
    { value: 'ComfortOfLife', label: 'Comfort Of Life'},
    { value: 'other', label: 'Other'}
]
 const attorney = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No'}
]
 const dnrOrder = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No'}
]
 const Appearance = [
    { value: 'Good', label: 'Well-groomed' },
    { value: 'Disheveled', label: 'Disheveled'},
    { value: 'Inappropriate', label: 'Inappropriate'},
]
 const Behavior = [
    { value: 'Cooperative', label: 'Cooperative' },
    { value: 'Agitated', label: 'Agitated'},
    { value: 'Withdrawn', label: 'Withdrawn'},
]
 const Speech = [
    { value: 'Normal', label: 'Normal' },
    { value: 'Pressured', label: 'Pressured'},
    { value: 'Slurred', label: 'Slurred'},
    { value: 'Slow', label: 'Slow'},
]
 const Mood = [
    { value: 'Euthymic', label: 'Euthymic' },
    { value: 'Depressed', label: 'Depressed'},
    { value: 'Anxious', label: 'Anxious'},
    { value: 'Angry', label: 'Angry'},
]
 const Affect =[
    { value: 'Congruent', label: 'Congruent' },
    { value: 'Flat', label: 'Flat'},
    { value: 'Inappropriate', label: 'Inappropriate'},
]
 const ThoughtProcess = [
    { value: 'Logical', label: 'Logical' },
    { value: 'Organized', label: 'Organized'},
    { value: 'Tangential', label: 'Tangential'},
    { value: 'Disorganised', label: 'Disorganised'},
]
 const ThoughtContent = [
    { value: 'Nodelusions', label: 'Nodelusions' },
    { value: 'Delusions', label: 'Delusions'},
    { value: 'Hallucinations', label: 'Hallucinations'},
    { value: 'Suicidal', label: 'Suicidal'},
    { value: 'Homicidal', label: 'Homicidal'},
]
 const Insight = [
    { value: 'Intact', label: 'Intact' },
    { value: 'Limited', label: 'Limited'},
    { value: 'Poor', label: 'Poor'},
]
 const Cognition = [
    { value: 'Oriented', label: 'Oriented' },
    { value: 'Memory', label: 'Memory'},
    { value: 'Attention', label: 'Attention'},
]
 const Risk = [
    { value: 'Suicidal', label: 'Suicidal' },
    { value: 'Homicidal', label: 'Homicidal'},
    { value: 'Self', label: 'Self'},
]
 const drugList = [
    { value: 'cooldrugs', label: 'cooldrugs' },
    { value: 'Ketamine', label: 'Ketamine'},
    { value: 'Cocaine', label: 'Cocaine'},
    { value: 'Other', label: 'Other'},
]
// Data for Death Report dropdowns
const typeOfDeathOptions = [
    { value: 'PK', label: 'PK' }, // Corrected typo: label was 'CK'
    { value: 'CK', label: 'CK' }
];
const mannerOfDeathOptions = [
    { value: 'Natural', label: 'Natural - the death resulted from natural causes...' },
    { value: 'Accident', label: 'Accidental - the death resulted from an unintentional...' },
    { value: 'Suicide', label: 'Suicide - the death resulted from a self-inflicted...' },
    { value: 'Homicide', label: 'Homicide - the death resulted from the intentional...' },
    { value: 'Undetermined', label: 'Undetermined - the evidence is insufficient...' }
];
const requestingAgenciesOptions = [
    { value: 'LSFD', label: 'LSFD' },
    { value: 'LSPD', label: 'LSPD' },
    { value: 'LSSD', label: 'LSSD' },
    { value: 'PHMC', label: 'PHMC' },
    { value: 'SANFIRE', label: 'SANFIRE' },
    { value: 'SADCR', label: 'SADCR' },
    { value: 'LSGOV', label: 'LSGOV' },
    { value: '911 Call', label: 'Emergency 911 Dispatch' },
    { value: 'Protech', label: 'Protech Security Solutions' }
];

const selectOptionsData = {
    PurposeMedicalInformationRelease,
    PurposeMedicalInformationReleaseFormat,
    patientBloodType,
    phmcRank,
    MedicalRecordsRelease,
    followup,
    departmentLarge,
    assignedDepartment,
    paletoClinicDepartment,
    BodyMassIndex,
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
    bloodOxy,
    ecg,
    sono,
    lab,
    gender,
    patientConsent,
    complications,
    procedureGood,
    admission,
    patientJob,
    patientJobRisks,
    patientAllergiesRisk,
    patientMedicineRegular,
    patientOther,
    predisposition,
    maritalStatus,
    numberChildren,
    financialStatus,
    dnr,
    attorney,
    dnrOrder,
    Appearance,
    Behavior,
    Speech,
    Mood,
    Affect,
    ThoughtProcess,
    ThoughtContent,
    Insight,
    Cognition,
    Risk,
    drugList,
    // Added these to ensure they are part of selectOptions in Firebase
    typeOfDeathOptions,
    mannerOfDeathOptions,
    requestingAgenciesOptions,
};
     const phmcList = [
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

{ name: 'Thiago Larranaga', lastName: 'Larranaga', rank: 'Registered Nurse', category: 'Registered Nurse' },
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
    { name: 'Sabrina Santiago', lastName: 'Santiago', rank: 'Resident Physician', category: 'Resident Physician' },
    { name: 'Will Flanary', lastName: 'Flanary', signature: '', category: 'Emergency Medical Services' },
];
 const coronerList = [
    { name: 'Developer Testing', badge: 'random badge', phNumber: '123123', rank: 'GOOD STRING', discord: 'developer.testing', category: 'Developer Testing' },
    { name: 'Missing Name', badge: 'Badge Field Variable', rank: 'Rank String Checker', discord: 'missing.discord', category: 'Missing_Category' },
    { name: 'Anne Carter', badge: '4892', rank: 'Chief Medical Examiner', discord: 'ralof.from.riverwood', category: 'Chief Boss' },
    { name: 'Elena Hill', badge: '108273', rank: 'Deputy Chief Medical Examiner', discord: 'unity0034', category: 'Chief Boss' },
    { name: 'Laurent Hall', badge: '91338854', rank: 'Supervisor Forensic Attendant', discord: 'faethewtich', category: 'Supervisor' },
    { name: 'Alyson Frost', badge: '5573', rank: 'Developer', discord: 'fr0sty.js', category: 'Senior Coroner Investigator' },
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
    { name: 'Nikita Medina', badge: '150723', phNumber: '10032024', rank: 'Forensic Attendant', discord: 'nikitamonroe', category: 'Trainee Forensic-Attendant' },
    { name: 'Rosalie Brown', badge: '161606 ', phNumber: '03810764', rank: 'Medical Examiner', discord: 'kayp99', category: 'Medical Examiner' },
{ name: 'Isaac Bailey', badge: '185929', phNumber: '', rank: 'Coroner Investigator', discord: 'psychoticlmao', category: 'Coroner Investigator' },
{ name: 'Matthias Morse', badge: '169662', phNumber: '5951335 ', rank: 'Medical Examiner', discord: 'zez6nho', category: 'Medical Examiner' },
];

// --- End data copy ---

async function migrateToRealtimeDB() {
  console.log('Starting Realtime Database migration...');

  const rootRef = db.ref();
  const dataToUpload = {
    agencies: agencyData,
    staff: {
      phmc: phmcList,
      coroner: coronerList
    },
    selectOptions: selectOptionsData
  };

  try {
    await rootRef.set(dataToUpload);
    console.log('Data migrated to Realtime Database successfully!');
  } catch (error) {
    console.error('Migration to Realtime Database FAILED:', error);
  }
}

migrateToRealtimeDB();
