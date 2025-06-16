// migration-script-rtdb/migrate.js
const admin = require('firebase-admin');

// Path to your service account key
const serviceAccount = require('../firebase-admin-key.json'); // Adjust if needed

const DATABASE_URL = "https://gtaw-forms-default-rtdb.europe-west1.firebasedatabase.app";

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: DATABASE_URL
});

const db = admin.database();

// Define or import all your selectOption arrays here
// ... (other selectOption arrays remain the same) ...

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
];
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
];
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
    { value: '2', label : '2' },
    { value: '3+', label : '3+' },
];
const financialStatus = [
    { value: 'LowIncome', label: 'Low Income' },
    { value: 'MiddleIncome', label: 'Middle Income' },
    { value: 'HighIncome', label: 'High Income' },
];
const dnr = [
    { value: 'ProlongLife', label: 'Prolong Life'},
    { value: 'ComfortOfLife', label: 'Comfort Of Life'},
    { value: 'other', label: 'Other'}
];
const attorney = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No'}
];
const dnrOrder = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No'}
];
const Appearance = [
    { value: 'Good', label: 'Well-groomed' },
    { value: 'Disheveled', label: 'Disheveled'},
    { value: 'Inappropriate', label: 'Inappropriate'},
];
const Behavior = [
    { value: 'Cooperative', label: 'Cooperative' },
    { value: 'Agitated', label: 'Agitated'},
    { value: 'Withdrawn', label: 'Withdrawn'},
];
const Speech = [
    { value: 'Normal', label: 'Normal' },
    { value: 'Pressured', label: 'Pressured'},
    { value: 'Slurred', label: 'Slurred'},
    { value: 'Slow', label: 'Slow'},
];
const Mood = [
    { value: 'Euthymic', label: 'Euthymic' },
    { value: 'Depressed', label: 'Depressed'},
    { value: 'Anxious', label: 'Anxious'},
    { value: 'Angry', label: 'Angry'},
];
const Affect =[
    { value: 'Congruent', label: 'Congruent' },
    { value: 'Flat', label: 'Flat'},
    { value: 'Inappropriate', label: 'Inappropriate'},
];
const ThoughtProcess = [
    { value: 'Logical', label: 'Logical' },
    { value: 'Organized', label: 'Organized'},
    { value: 'Tangential', label: 'Tangential'},
    { value: 'Disorganised', label: 'Disorganised'},
];
const ThoughtContent = [
    { value: 'Nodelusions', label: 'Nodelusions' },
    { value: 'Delusions', label: 'Delusions'},
    { value: 'Hallucinations', label: 'Hallucinations'},
    { value: 'Suicidal', label: 'Suicidal'},
    { value: 'Homicidal', label: 'Homicidal'},
];
const Insight = [
    { value: 'Intact', label: 'Intact' },
    { value: 'Limited', label: 'Limited'},
    { value: 'Poor', label: 'Poor'},
];
const Cognition = [
    { value: 'Oriented', label: 'Oriented' },
    { value: 'Memory', label: 'Memory'},
    { value: 'Attention', label: 'Attention'},
];
const Risk = [
    { value: 'Suicidal', label: 'Suicidal' },
    { value: 'Homicidal', label: 'Homicidal'},
    { value: 'Self', label: 'Self'},
];
const drugList = [
    { value: 'cooldrugs', label: 'cooldrugs' },
    { value: 'Ketamine', label: 'Ketamine'},
    { value: 'Cocaine', label: 'Cocaine'},
    { value: 'Other', label: 'Other'},
];
const typeOfDeathOptions = [
    { value: 'PK', label: 'PK' },
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
const Imaging = [
    { value: 'NoneRequired', label: 'None Required' },
    { value: 'XRay', label: 'X-Ray' },
    { value: 'CTScan', label: 'CT Scan' },
    { value: 'MRI', label: 'MRI' },
    { value: 'Ultrasound', label: 'Ultrasound' },
    { value: 'Other', label: 'Other' },
];
const XrayResults = [
    { value: 'NothingFound' , label: 'Nothing Found' },
    { value: 'Dislocation', label: 'Dislocation' },
    { value: 'Hairline Fracture' , label: 'Hairline Fracture' },
    { value: 'Displaced Fracture', label: 'Displaced Fracture' },
    { value: 'Complete Fracture', label: 'Complete Fracture' },
    { value: 'Pleural Effusion', label: 'Pleural Effusion' },
    { value: 'Pneumothorax', label: 'Pneumothorax - Collapsed Lung' },
    { value: 'Pulmonary Edema', label: 'Pulmonary Edema' },
    { value: 'Hemothorax', label: 'Hemothorax - Blood in Pleural Cavity' },
];
const ctResults  = [
    { value: 'NothingFound' , label: 'Nothing Found' },
    { value: 'Aortic Dissection', label: 'Aortic Dissection' },
    { value: 'Intracranial Hemorrhage', label: 'Intracranial Hemorrhage' },
    { value: 'Midline Shift' , label: 'Midline Shift' },
    { value: 'Pulmonary Embolism' , label: 'Pulmonary Embolism' },
    { value: 'Skull Fracture' , label: 'Skull Fracture' },
    { value: 'Solid Organ Injury', label: 'Solid Organ Injury' },
    { value: 'Tumor', label: 'Tumor' },
];
const mriResults = [
    { value: 'NothingFound' , label: 'Nothing Found' },
    { value: 'Cancerous Mass', label: 'Cancerous Mass' },
    { value: 'Degenerative Disc Disease', label: 'Degenerative Disc Disease' },
    { value: 'Herniated Disc', label: 'Herniated Disc' },
    { value: 'Multiple Sclerosis', label: 'Multiple Sclerosis' },
    { value: 'Tumor', label: 'Tumor' },
    { value: 'Spinal Stenosis', label: 'Spinal Stenosis' },
    { value: 'Stroke', label: 'Stroke' },
];
const ultrasoundResults = [
   { value: 'NothingFound' , label: 'Nothing Found' },
    { value: 'Cyst', label: 'Cyst' },
    { value: 'Ectopic Pregnancy', label: 'Ectopic Pregnancy' },
    { value: 'Free Fluid Accumulation', label: 'Free Fluid Accumulation' },
    { value: 'Gallstones', label: 'Gallstones' },
    { value: 'Internal Bleeding', label: 'Internal Bleeding' },
    { value: 'Organ Damage', label: 'Organ Damage' },
    { value: 'Ovarian Torsion', label: 'Ovarian Torsion' },
    { value: 'Pregnancy Confirmation', label: 'Pregnancy Confirmation' },
];

// --- MODIFIED positionDetailsData ---
const physicianRecruitmentDetails = {
    "Rotation (Medical Students)": {
        displayName: "Sub-Intern",
        group: "Physician",
        shortCode: "MED ROTATION",
        url: "https://phmc.gta.world/viewtopic.php?t=5",
        status: "OPEN",
        Overview: "When the work you do every single day has a crucial impact on the lives of others, every effort, every detail, and every second matters. As a full time medical student within our Rotation program, you will receive first-hand insight on the day-to-day operations at a hospital. Medical students are in a pivotal moment in their academic and future professional career when seeking out a formal internship. Through our program, students will gain first-hand experience alongside medical professionals with decades of experience, helping to prepare them for the ever-expanding medical field. \n\nThis program is designed for those who are currently enrolled in an accredited medical school program, and have completed their pre-clinical coursework. Students will be expected to work alongside our medical professionals, and will be given the opportunity to shadow them in various departments. Students will also be expected to complete a series of assignments and projects throughout the program, which will help to prepare them for their future careers in medicine. \n\n If you are interested in applying for this program, please submit your application through our website. We look forward to hearing from you!",
        skill1: "Strong observational abilities.", // New
        skill2: "Eagerness to learn and adapt.",  // New
        skill3: "Basic medical terminology understanding.", // New
        EduRequirement: "Currently enrolled in an accredited medical school program. Completion of pre-clinical coursework preferred." // New
    },
    "Dentist": {
        displayName: "Dentist",
        group: "Physician",
        shortCode: "Dentist",
        url: "https://phmc.gta.world/viewtopic.php?f=14&t=4016", // Example URL
        status: "OPEN",
        Overview: "When the work you do every single day has a crucial impact on the lives of others... (rest of your overview)",
        skill1: "Strong observational abilities.", // New
        skill2: "Eagerness to learn and adapt.",  // New
        skill3: "Basic medical terminology understanding.", // New
        EduRequirement: "Currently enrolled in an accredited medical school program. Completion of pre-clinical coursework preferred." // New
    },
    "Attending Physician": {
        displayName: "Attending Physician",
        group: "Physician",
        shortCode: "Attending Physician",
        url: "https://phmc.gta.world/viewtopic.php?f=14&t=4017", // Example URL
        status: "OPEN",
        Overview: "When the work you do every single day has a crucial impact on the lives of others... (rest of your overview)",
        skill1: "Strong observational abilities.", // New
        skill2: "Eagerness to learn and adapt.",  // New
        skill3: "Basic medical terminology understanding.", // New
        EduRequirement: "Currently enrolled in an accredited medical school program. Completion of pre-clinical coursework preferred." // New
    },
    "Physical Therapist": {
        displayName: "Physical Therapist",
        group: "Physician",
        shortCode: "Physical",
        url: "https://phmc.gta.world/viewtopic.php?f=14&t=4018", // Example URL
        status: "OPEN",
        Overview: "When the work you do every single day has a crucial impact on the lives of others... (rest of your overview)",
        skill1: "Strong observational abilities.", // New
        skill2: "Eagerness to learn and adapt.",  // New
        skill3: "Basic medical terminology understanding.", // New
        EduRequirement: "Currently enrolled in an accredited medical school program. Completion of pre-clinical coursework preferred." // New
    },
    "Pharmacist": {
        displayName: "Pharmacist",
        group: "Physician",
        shortCode: "Pharmacist",
        url: "https://phmc.gta.world/viewtopic.php?f=14&t=4019", // Example URL
        status: "CLOSED",
        Overview: "When the work you do every single day has a crucial impact on the lives of others... (rest of your overview)",
        skill1: "Strong observational abilities.", // New
        skill2: "Eagerness to learn and adapt.",  // New
        skill3: "Basic medical terminology understanding.", // New
        EduRequirement: "Currently enrolled in an accredited medical school program. Completion of pre-clinical coursework preferred." // New
    },
    "Surgical Resident": {
        displayName: "Surgical Resident",
        group: "Physician",
        shortCode: "Surgical Resident",
        poc: " Dr. Caterina Rosati",
        url: "https://phmc.gta.world/viewtopic.php?f=14&t=4020", // Example URL
        status: "OPEN",
        Overview: "When the work you do every single day has a crucial impact on the lives of others... (rest of your overview)",
        skill1: "Strong observational abilities.", // New
        skill2: "Eagerness to learn and adapt.",  // New
        skill3: "Basic medical terminology understanding.", // New
        EduRequirement: "Currently enrolled in an accredited medical school program. Completion of pre-clinical coursework preferred." // New
    },
    "Physician Assistant": {
        displayName: "Physician Assistant",
        group: "Physician",
        shortCode: "PA",
        url: "https://phmc.gta.world/viewtopic.php?f=14&t=4021", // Example URL
        status: "OPEN",
        Overview: "When the work you do every single day has a crucial impact on the lives of others... (rest of your overview)",
        skill1: "Strong observational abilities.", // New
        skill2: "Eagerness to learn and adapt.",  // New
        skill3: "Basic medical terminology understanding.", // New
        EduRequirement: "Currently enrolled in an accredited medical school program. Completion of pre-clinical coursework preferred." // New
    },
    "Resident Physician": {
        displayName: "Resident Physician",
        group: "Physician",
        shortCode: "Resident",
        url: "https://phmc.gta.world/viewtopic.php?t=5",
        status: "OPEN",
        Overview: "A Resident Physician, often simply referred to as a 'resident,' is a medical doctor who has completed medical school and is undergoing further training in a specific medical specialty. Residents work in hospitals and healthcare facilities under the supervision of experienced attending physicians. Their duties include diagnosing and treating patients, conducting medical procedures, and learning the intricacies of their chosen specialty. Resident Physicians play a vital role in patient care, as they gain hands-on experience, develop clinical skills, and gradually become more independent in their medical practice. This phase of training typically lasts several years, after which they may pursue board certification in their chosen specialty.",
        skill1: "Critical thinking skills, decisive judgment and the ability to work independently as well as in a group is required.\n- The ability to be able to work in a stressful environment and to take appropriate action is a must.The applicant must be in a good physical condition in order to perform requirements such a moving and lifting patients along with the abilities of full body motion, manual finger dexterity with good eye-hand condition.", // New
        skill2: "Strong interpersonal skills to interact with patients and staff is mandatory.\n- Must be at least twenty-six (26) years of age and possess a legal address in the state of San Andreas;",  // New
        skill3: "Must have a satisfactory physical and mental health status to perform the essential functions of the role safely.\n- Must not have been convicted of a felony or a misdemeanor in the recent past.", // New
        EduRequirement: "Must have a degree from a college or university with accreditation recognized in the United States of America. \n- Must be a licensed Medical Doctor (MD) or Doctor of Osteopathic Medicine (DO) in the State of San Andreas.\n- Must have prior experience working in emergency or internal medicine."
    },
};
const physicianRecruitmentPositions = Object.keys(physicianRecruitmentDetails).map(key => ({ // Renamed
    value: key, label: physicianRecruitmentDetails[key].displayName
}));

const psychPositionDetailsData = {
    "Counseling Psychologist": { // REGIONS QUESTION
        displayName: "Counseling Psychologist", group: "Psych", shortCode: "PSYCH INTERN",
        url: "https://phmc.gta.world/viewtopic.php?f=14&t=PSYCH_INTERN_URL", // Replace with actual URL
        status: "OPEN", Overview: "Entry-level internship for aspiring psychologists...",
        skill1: "Basic psychological principles.", skill2: "Communication skills.", skill3: "Empathy.",
        EduRequirement: "Enrolled in/graduated Bachelor's or Master's in Psychology."
    },
    "Resident Psychiatrist": { // // CITIZENSHIP QUESTION
        displayName: "Resident Psychologist", group: "Psych", shortCode: "RES PSYCH",
        url: "https://phmc.gta.world/viewtopic.php?f=14&t=RES_PSYCH_URL", // Replace
        status: "OPEN", Overview: "Training position for post-graduate psychologists...",
        skill1: "Advanced psychological theories.", skill2: "Clinical assessment experience.", skill3: "Team collaboration.",
        EduRequirement: "Doctoral degree (Ph.D./Psy.D.) in Psychology. Licensure eligibility."
    },
    "Attending Psychiatrist": { // CITIZENSHIP QUESTION
        displayName: "Attending Psychiatrist", group: "Psych", shortCode: "ATTND PSYCH",
        url: "https://phmc.gta.world/viewtopic.php?f=14&t=ATTND_PSYCH_URL", // Replace
        status: "CLOSED", Overview: "Licensed medical doctor specializing in psychiatry...",
        skill1: "Psychopharmacology expertise.", skill2: "Leadership skills.", skill3: "Complex case management.",
        EduRequirement: "MD/DO. Psychiatric residency. Board certification. Licensed."
    },
    "Psychologist": {
        displayName: "Psychologist", group: "Psych", shortCode: "LCSW", // REGIONS QUESTION
        url: "https://phmc.gta.world/viewtopic.php?f=14&t=LCSW_URL", // Replace
        status: "OPEN", Overview: "Provides counseling and therapy services...",
        skill1: "Assessment & crisis intervention.", skill2: "Knowledge of community resources.", skill3: "Cultural competence.",
        EduRequirement: "MSW. LCSW license."
    }
};
const psychRecruitmentPositions = Object.keys(psychPositionDetailsData).map(key => ({
    value: key, label: psychPositionDetailsData[key].displayName
}));

// Admin Careers
const adminPositionDetailsData = {
    "Janitor": {
        displayName: "Janitor",
        group: "Admin",
        status: 'CLOSED',
        poc: "Mr. David Wayland",
        shortCode: "JANITOR",
        url: "https://phmc.gta.world/viewtopic.php?t=13",
        Overview: "A janitor performs a variety of cleaning, sanitizing and janitorial tasks in and around hospital buildings or official event sites and minor ground-keeping tasks adjacent to said buildings. They have to ensure that everything is in working condition and if not, they shall take care of the problem and have to repair it immediately. The scope of the duties will be very diverse. Primarily, however, the practical-technical work is in the focus, such as cleaning the stairs, operating the central heating system and ensuring a general smooth running of the hospital.",
        skill1: "Must be at least twenty-one (21) years of age and possess a legal address in the state of San Andreas.\nMust not have been convicted of a felony or a misdemeanor in the recent past.", // New
        skill2: "Must be able to work well within a team, but show ability to work independently at times as well.\nShall be in good health and physical shape to withstand stress from frequent physical activities such as lifting, bending and kneeling as well as standing, walking and reaching around the hospital.",  // New
        skill3: "Must adhere to all hospital policies and ethical guidelines.\nShould have a clean public image/ notable footprint within the city's social networks and corporate circles.", // New
        EduRequirement: "Must have prior experience with custodial work in previous positions, or undergone training that provides custodial experience." // New
    },
    "Cafeteria Staff": {
        displayName: "Cafeteria Staff",
        group: "Admin",
        poc: "Mr. David Wayland",
        shortCode: "CAFETERIA",
        url: "https://phmc.gta.world/viewtopic.php?t=12", // Example URL
        status: "OPEN",
        Overview: "The Cafeteria Staff has to cook foodstuffs according to menus, special dietary or nutritional restrictions and the number of portions to be served. They have to ensure that everyone is getting a meal that is compatible with their digestive tolerance.\nThe job position as a cook shall not be underestimated, since there are several important requirements and responsibilities you have to accomplish, like clean the kitchen area, cut and cook meat, fish, and poultry as well as providing a varied menu for the hospital staff and the patients.",
        skill1: "Must be at least twenty-one (21) years of age and possess a legal address in the state of San Andreas.", // New
        skill2: "Must not have been convicted of a felony or a misdemeanor in the recent past.",  // New
        skill3: "Must adhere to all hospital policies and ethical guidelines.", // New
        EduRequirement: "Must have prior experience." // New
    },
    "Human Resources Assistant": {
        displayName: "Human Resources",
        group: "Admin",
        poc: "Mr. David Wayland",
        shortCode: "HR",
        url: "https://phmc.gta.world/viewtopic.php?t=11", // Example URL
        status: "OPEN",
        Overview: "As a member of Human Resources, you will have the option to focus your time on helping the footstaff in the hospital conduct their duties. You will be expected to apply prior experience to help you fulfill your duties, as well as maintaining a clean public image for both yourself and the hospital. Additionall, you will aid each department with recruitment and onboarding matters, conduct background checks, perform interviews and forward transcripts to supervisors and directors.",
        skill1: "Must be at least twenty-one (21) years of age and possess a legal address in the state of San Andreas.", // New
        skill2: "Must not have been convicted of a felony or a misdemeanor in the recent past.",  // New
        skill3: "Must adhere to all hospital policies and ethical guidelines.", // New
        EduRequirement: "Must have prior experience." // New
    },
};
const adminRecruitmentPositions = Object.keys(adminPositionDetailsData).map(key => ({
    value: key, label: adminPositionDetailsData[key].displayName
}));

const nursePositionDetailsData = {
    "Registered Nurse": {
        displayName: "Registered Nurse",
        group: "Nurse", // Important for filtering in RecruitmentStatusDisplay
        status: "OPEN",
        poc: "Ms Lindsay Thompson", // Example
        shortCode: "RN",
        url: "https://phmc.gta.world/viewtopic.php?t=7", // Replace with actual URL
        Overview: "Conduct comprehensive patient assessments, develop individualized care plans, and evaluate outcomes.\nAdminister medications, perform treatments and procedures, and provide emotional support to patients and families.\nSupervise and delegate tasks to Licensed Vocational Nurses (LVNs), Nurse Interns, and other support staff while ensuring compliance with hospital protocols. \nEducate patients and families about diagnoses, treatment plans, and post-discharge care to promote health and recovery.\NWork closely with physicians, advanced practice providers, and other healthcare professionals to coordinate comprehensive care.\nAct as a first responder in medical emergencies, initiating life-saving measures as needed.",
        skill1: "Must demonstrate the ability to make sound clinical judgments and prioritize effectively in a dynamic healthcare environment.\nMust perform effectively in high-pressure situations, including emergencies.\nMust be in good physical condition to lift, move, and reposition patients, with the ability to meet the physical demands of 12-hour shifts. \nMust have strong verbal and written communication abilities to interact with diverse patients, families, and teams.",
        skill2: "Must have satisfactory physical and mental health to perform essential functions safely, and must adhere to all hospital policies and professional ethical standards.\nPrior clinical experience in a hospital or acute care setting is preferred but not mandatory for new graduates. ",
        skill3: "\n(( If roleplaying prior clinical experience, this should be in the character's background story. ))\nMust be at least 20 to 21 years old.\nMust not have been convicted of a felony or relevant misdemeanor in the past..",
        EduRequirement: "Must hold an Associate’s Degree in Nursing (ADN) or Bachelor of Science in Nursing (BSN) from an accredited program. A BSN is preferred. (( This should be a part of the character background story. ))\nMust possess an active, unencumbered San Andreas Registered Nurse license (RN). (( NPCd ))\nMust hold current Basic Life Support (BLS) certification. Advanced Cardiac Life Support (ACLS), Pediatric Advanced Life Support (PALS), and other department-specific certifications (e.g., TNCC for trauma nurses) are also welcome. (( This should be a part of the character background story. ))\nMust reside in the state of San Andreas or possess the ability to relocate."
    },
    "Nurse Practitioner": {
        displayName: "Nurse Practitioner",
        group: "Nurse",
        status: "CLOSED",
        poc: "Ms Lindsay Thompson",
        shortCode: "NP",
        url: "https://phmc.gta.world/viewtopic.php?t=1590",
        Overview: "Perform comprehensive health assessments, including history-taking, physical examinations, and diagnostic testing.\nFormulate and implement evidence-based treatment plans tailored to individual patient needs.\nPrescribe medications, order diagnostic tests, and recommend therapeutic interventions in compliance with San Andreas Board of Nursing regulations.\nWork closely with physicians, nurses, and allied health professionals in managing complex cases.\nProvide patients and their families with information about health conditions, treatments, and preventative care..\nMentor nursing staff and contribute to staff education initiatives to enhance clinical competencies across the team.\nRespond to acute care situations, initiate life-saving measures, and stabilize critically ill patients.",
        skill1: "Must demonstrate exceptional analytical skills and the ability to make autonomous clinical decisions.\nMust remain composed and effective in high-pressure, fast-paced environments.",
        skill2: "Must be in good physical condition to meet the demands of patient care, including extended shifts and emergencies.\nStrong communication skills to engage effectively with patients, families, and multidisciplinary teams, as well as leadership abilities to mentor and guide staff.",
        skill3: "Must demonstrate satisfactory physical and mental health to perform essential functions safely. Must adhere to all hospital policies and ethical standards.",
        EduRequirement: "Must hold a Master of Science in Nursing (MSN) or Doctor of Nursing Practice (DNP) from an accredited program. (( This should be a part of your character's story. ))\nMust possess an active San Andreas RN license. (( **NPCd** ))\nMust have national board certification in a specialty area (e.g., AANP, ANCC). (( **This should be a part of your character's story**. ))\nA minimum of two years of clinical nursing experience is preferred. Experience as an NP in a similar healthcare setting is highly desirable.",
    },
    "Student Nurse": { // Updated Entry
        displayName: "Student Nurse",
        group: "Nurse",
        status: "OPEN",
        poc: "Ms Lindsay Thompson",
        shortCode: "SN",
        url: "https://phmc.gta.world/viewtopic.php?t=https://phmc.gta.world/viewtopic.php?t=8", // Suggest a new URL
        Overview: "Perform tasks such as measuring vital signs, assisting with hygiene, and reporting observations under the direct supervision of an RN or LVN.\nShadow experienced nurses and participate in non-invasive procedures to build foundational knowledge.\nAid in administrative tasks, restocking supplies, and maintaining clean, organized workspaces.\nParticipate in scheduled training sessions, simulations, and department meetings to enhance clinical competencies.",
        skill1: "Critical thinking skills, decisive judgment, and the ability to adapt to various clinical situations under supervision are required.",
        skill2: "The ability to work in a fast-paced, high-pressure environment while maintaining composure is essential.\nApplicants must be in good physical condition to perform tasks such as moving and lifting patients, with full body motion, manual finger dexterity, and good eye-hand coordination.",
        skill3: "Effective communication and teamwork are mandatory for interacting with patients, families, and staff.\nApplicants must reside in the state of San Andreas and be at least 18 years of age.\nMust not have been convicted of a felony or relevant misdemeanor in the past.",
        EduRequirement: "Must maintain satisfactory physical and mental health to perform essential functions safely and comply with all hospital policies and ethical guidelines."
    },
    "Nursing Intern" : { // Updated Entry
        displayName: "Nursing Intern",
        group: "Nurse",
        status: "OPEN",
        poc: "Ms Lindsay Thompson",
        shortCode: "NURSE INTERN",
        url: "https://phmc.gta.world/viewtopic.php?t=1699", // Placeholder URL, update as needed
        Overview: "Assist licensed nurses with patient hygiene, mobility, nutrition, and comfort measures.\nPerform basic clinical tasks, such as obtaining vital signs, preparing equipment, and monitoring patient conditions under RN or LVN supervision.\nAttend in-service education, simulations, and staff development sessions to enhance clinical competencies.\nEnsure that patient care areas are clean, well-stocked, and organized.",
        skill1: "Critical thinking skills, decisive judgment, and the ability to work both independently and collaboratively within a healthcare team are required.",
        skill2: "Must demonstrate resilience and composure in a high-pressure clinical environment.\nApplicants must be able to meet the physical demands of patient care, including moving and lifting patients, full body motion, and fine motor skills.",
        skill3: "Effective communication and collaboration with patients, families, and healthcare staff are essential.\nMust demonstrate satisfactory physical and mental health to perform essential functions safely and comply with all hospital policies and ethical guidelines.\nMust not have been convicted of a felony or relevant misdemeanor in the past.",
        EduRequirement: "Must have completed at least one year of a San Andreas-approved nursing program or have recently graduated. Must provide proof of ongoing or recent enrollment."
    },
};
const nurseRecruitmentPositions = Object.keys(nursePositionDetailsData).map(key => ({
    value: key, label: nursePositionDetailsData[key].displayName
}));

const emsPositionDetailsData = { // Changed from emsRecruitmentDetails to match other patterns
    "Paramedic": {
        displayName: "Paramedic",
        group: "EMS",
        status: "OPEN",
        poc: "Mr. Kaden Malik",
        shortCode: "PARAMEDIC",
        url: "https://phmc.gta.world/viewtopic.php?t=9",
        Overview: "Paramedics are advanced pre-hospital care providers responsible for responding to emergency medical calls, assessing patient conditions, and administering critical medical interventions. They work in dynamic environments, often under high-pressure, to stabilize patients and transport them to medical facilities. Key responsibilities include advanced life support, medication administration, and trauma care.",
        skill1: "Proficiency in advanced life support (ALS) techniques and emergency medical protocols.",
        skill2: "Strong decision-making skills and the ability to remain calm and effective under pressure.",
        skill3: "Excellent communication and interpersonal skills for patient and team interaction.",
        EduRequirement: "Completion of an accredited Paramedic program and current state certification/licensure as a Paramedic. Valid driver's license."
    },
    "EMT": {
        displayName: "Emergency Medical Technician (EMT)",
        group: "EMS",
        status: "OPEN",
        poc: "Mr. Kaden Malik",
        shortCode: "EMT",
        url: "https://phmc.gta.world/viewtopic.php?t=10",
        Overview: "EMTs provide basic life support (BLS) and emergency medical care to patients at the scene of an incident and during transport to a hospital. They assess patient conditions, manage airways, control bleeding, and assist with medication administration under medical direction. EMTs are crucial first responders in the emergency medical system.",
        skill1: "Competency in basic life support (BLS) skills and patient assessment.",
        skill2: "Ability to work effectively in a team and follow medical protocols accurately.",
        skill3: "Good physical stamina and the ability to lift and move patients safely.",
        EduRequirement: "Completion of an accredited EMT program and current state certification/licensure as an EMT. Valid driver's license."
    },
    "Part-Time EMS Program": {
        displayName: "Part-Time EMS Program",
        group: "EMS",
        status: "OPEN",
        poc: "Mr. Kaden Malik",
        shortCode: "PT EMS",
        url: "https://phmc.gta.world/viewtopic.php?t=4389",
        Overview: "The Part-Time EMS Program offers flexible opportunities for certified EMTs and Paramedics to contribute to emergency medical services on a part-time basis. Participants will respond to calls, provide patient care, and work alongside full-time staff, maintaining their skills and serving the community. This program is ideal for those seeking to balance EMS work with other commitments.",
        skill1: "Current EMT or Paramedic certification/licensure in good standing.",
        skill2: "Ability to adapt to varying schedules and work environments.",
        skill3: "Commitment to maintaining clinical proficiency and adhering to EMS protocols.",
        EduRequirement: "Valid state EMT or Paramedic certification/licensure. Prior field experience is often preferred."
    },
};
const emsRecruitmentPositions = Object.keys(emsPositionDetailsData).map(key => ({
    value: key, label: emsPositionDetailsData[key].displayName
}));

const coronerPositionDetailsData = { // Changed variable name
    "Coroner Internship": {
        displayName: "Coroner Intern",
        group: "Coroner", // Important for filtering in RecruitmentStatusDisplay
        status: "OPEN",
        poc: "Dr. Anne Carter", // Example
        shortCode: "Coroner Intern",
        url: "https://phmc.gta.world/viewtopic.php?t=4390", // Replace with actual URL
        Overview: "As an Intern within our department, you’ll be able to accompany our teams into the field and witness the bulk of our work, from basic crime scene investigation to body transportation. You’ll also be able to attend autopsies and thus witness how our Medical Examiners ascertain someone’s cause of death.\nYour duties will mainly include following our Coroners around on the field, although you may not interact with the scene directly, you may be asked for a synopsis of what you saw at a scene so that you can develop your skills in field investigation. You will also be able to watch autopsies and accompany their whole process with opportunities for you to practice autopsies yourself, of course you will be practicing on animals such as pigs and not actual human cadavers.",
        skill1: "A strong stomach and the ability to function well under extreme stress.",
        skill2: "Must be at least eighteen (18) years of age and possess a legal address in the state of San Andreas.\nA good ability to work within a team and follow directions.",
        skill3: "Must not have been convicted of a felony or a misdemeanor in the recent past.",
        EduRequirement: "Must be enrolled at a college or university with accreditation recognized in the United States of America."
    },
    "Medical Examiner": {
        displayName: "Medical Examiner",
        group: "Coroner",
        status: "CLOSED",
        poc: "Dr. Anne Carter",
        shortCode: "MEDICAL EXAMINER",
        url: "https://phmc.gta.world/viewtopic.php?t=3021",
        Overview: "Medical examiners, also known as forensic pathologists, are physician specialists trained in forensic and anatomical pathology. They use their medical skills to determine the cause of death, whether natural, accidental or intentional of the decedents. They also may be required to testify in legal cases, where their skills have been utilized. Furthermore, they may be gathering and examining evidence to determine the cause of death in criminal cases and unnatural or unattended deaths. Moreover, they may be present at the scene of the death to ensure that collected evidence gets safely transported to the laboratory for analysis. It's in the medical examiner's job to obtain medical records from hospitals and offices for evaluation. Once they have completed their investigation, medical examiners summarize their findings in writing and give verbal reports. They can serve as expert witness and testify in pre-trial and court hearings. Responsibilities of a Deputy Medical Examiner will be to perform autopsies to determine the cause of death, undertaking examinations of specimens, tissues, organs, fluids and blood to determine abnormalities that may have resulted in the death, investigating sudden and/or unnatural deaths, in conjunction with law enforcement while also preparing reports of findings and providing expert testimony in court. Throughout they remain informed of developments in forensic pathology and attend seminars as well as courses in forensic medicine for continuing education and research.",
        skill1: "Working knowledge of applicable laws and statutes governing forensic services.",
        skill2: "Exceptional analytical and research skills.",
        skill3: "Experience using lab testing equipment.\nExcellent communication and writing skills.",
        EduRequirement: "Must have a Bachelor's degree in biology, physical sciences, or a related field\nMedical Degree (Doctorate) and USMLE certificate.",
    },
    "Coroner Investigator": {
        displayName: "Coroner Investigator",
        group: "Coroner",
        status: "OPEN",
        poc: "Dr. Anne Carter",
        shortCode: "CORONER",
        url: "https://phmc.gta.world/viewtopic.php?t=3020",
        Overview: "Coroner Investigators investigate and report death cases which fall within the jurisdiction of the Los Santos Department of Medical Examiner-Coroner. Incumbents in this position take charge of the death scene and the body of the deceased, safeguard the personal property of the deceased, locate and notify the next of kin and conduct other duties as required. In addition to examining bodies and crime scenes, this role aims to complete various administrative tasks when working as one, keeping accurate records of the findings and presenting those findings to a court when necessary. This job requires excellent communication and writing skills. Furthermore, if one individual is the lead member of a team for the morgue, they may also supervise the work of morgue assistants or autopsy technicians. Responsibilities of a Coroner Investigator range from investigating deaths under the jurisdiction of the department, assisting in the establishing cause, manner and circumstances of death, confering with law enforcement agencies to coordinate investigations of death resulting from criminal acts and making positive identification of deceased by taking fingerprints, photographs in order to create case files. A Coroner Investigator may notify family of the deceased, interview witnesses, physicians, law enforcement and family members to obtain facts concerning deaths. They are responsible of the transportation of deceased corpses and may work on special projects assigned to them while also filling death certificates and deciding on when a decendent may be released.",
        skill1: "Working knowledge of applicable laws and statutes governing forensic services.",
        skill2: "Exceptional analytical and research skills.",
        skill3: "Experience using lab testing equipment.\nExcellent communication and writing skills.",
        EduRequirement: "Must have a Bachelor's degree in biology, physical sciences, or a related field."
    },
    "Trainee Forensic Attendant" : {
        displayName: "Trainee Forensic Attendant",
        group: "Coroner",
        status: "OPEN",
        poc: "Dr. Anne Carter",
        shortCode: "TRAINEE FA",
        url: "https://phmc.gta.world/viewtopic.php?t=1699", // Placeholder URL, update as needed
        Overview: "New applicants will go through training provided by our facility to become a Coroner, as a new hire your main job is to complete the field training program and become a fully qualified Coroner. You will have the same duties as a coroner, however, you will not be permitted to receive calls alone until they have completed their field training phase. New applicants will become the backbone of the entire department, making up the highest percentage of members. Without the new hires, day-to-day duties will become difficult, the department requires new hires to sustain itself. New applicants are encouraged to dedicate themselves to the department and will likely be the primary point of contact for the public on a daily basis, as they will handle the most common calls. As a Trainee Forensic Attendant employed at Pillbox Hill Medical Center, you will be you will be taught in aspects of field response to incoming calls, where you will be of assistance to the public, to other departments but most importantly to your own colleagues.",
        skill1: "A high level of literacy is required together with the ability to frame correspondence in a timely manner to fellow departments is crucial.",
        skill2: "The ability to be able to work in a stressful environment and to take appropriate action is a must.",
        skill3: "The applicant must be in a good physical condition in order to perform requirements such a moving and lifting bodies, along with the abilities of full body motion, manual finger dexterity with good eye-hand condition.",
        EduRequirement: "Applicants should possess a high school diploma as an absolute minimum\nMust have a satisfactory physical and mental health status to perform the essential functions of the role safely."
    },
};
const coronerRecruitmentPositions = Object.keys(coronerPositionDetailsData).map(key => ({ // New
    value: key, label: coronerPositionDetailsData[key].displayName
}));

// SAAA Careers
const saaaPositionDetailsData = {
    "Air Traffic Controller": {
        displayName: "Air Traffic Controller",
        group: "SAAA",
        shortCode: "ATC", // Added shortCode
        url: "https://saaa.gta.world/viewtopic.php?f=71&t=YOUR_ATC_TOPIC_ID",
        status: "OPEN"
    },
    "Aviation Safety Investigator": {
        displayName: "Aviation Safety Investigator",
        group: "SAAA",
        shortCode: "ASI", // Added shortCode
        url: "https://saaa.gta.world/viewtopic.php?f=28&t=YOUR_INSTRUCTOR_TOPIC_ID",
        status: "OPEN"
    },
    "Airoprt Operations Officer": {
        displayName: "Airoprt Operations Officer",
        group: "SAAA",
        shortCode: "AOO", // Added shortCode
        url: "https://saaa.gta.world/viewtopic.php?f=71&t=YOUR_GROUND_CREW_TOPIC_ID",
        status: "OPEN"
    },
        "Head Flight Instructor": {
        displayName: "Head Flight Instructor",
        group: "SAAA",
        shortCode: "FI", // Added shortCode
        url: "https://saaa.gta.world/viewtopic.php?f=71&t=YOUR_GROUND_CREW_TOPIC_ID",
        status: "OPEN"
    },
    "Flight Instructor": {
        displayName: "Flight Instructor",
        group: "SAAA",
        shortCode: "FI", // Added shortCode
        url: "https://saaa.gta.world/viewtopic.php?f=71&t=YOUR_GROUND_CREW_TOPIC_ID",
        status: "OPEN"
    },
    "Technician": {
        displayName: "Technician",
        group: "SAAA",
        shortCode: "TECH", // Added shortCode
        url: "https://saaa.gta.world/viewtopic.php?f=71&t=YOUR_GROUND_CREW_TOPIC_ID",
        status: "CLOSED"
    },
    "Legal Advisor": {
        displayName: "Legal Advisor",
        group: "SAAA",
        shortCode: "LC", // Added shortCode
        url: "https://saaa.gta.world/viewtopic.php?f=71&t=YOUR_GROUND_CREW_TOPIC_ID",
        status: "OPEN "
    },
    "Paralegal": {
        displayName: "Paralegal",
        group: "SAAA",
        shortCode: "PL", // Added shortCode
        url: "https://saaa.gta.world/viewtopic.php?f=71&t=YOUR_GROUND_CREW_TOPIC_ID",
        status: "CLOSED"
    },
};
const saaaRecruitmentPositions = Object.keys(saaaPositionDetailsData).map(key => ({
    value: key, label: saaaPositionDetailsData[key].displayName
}));

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
    typeOfDeathOptions,
    mannerOfDeathOptions,
    requestingAgenciesOptions,
    Imaging,
    XrayResults,
    ctResults,
    mriResults,
    ultrasoundResults,
    physicianRecruitmentDetails,
    physicianRecruitmentPositions,
    saaaPositionDetailsData,
    saaaRecruitmentPositions,
    psychPositionDetailsData,
    psychRecruitmentPositions,
    adminPositionDetailsData,
    adminRecruitmentPositions,
    nursePositionDetailsData,
    nurseRecruitmentPositions,
    emsPositionDetailsData, // Added EMS details
    emsRecruitmentPositions, // Added EMS positions
    coronerPositionDetailsData, // Added Coroner details
    coronerRecruitmentPositions, // Added Coroner positions
};

async function migrateToRealtimeDB() {
  console.log('Starting Realtime Database migration for selectOptions...');
  const selectOptionsRef = db.ref('selectOptions');
  let migrationSuccessful = false;

  try {
    const snapshot = await selectOptionsRef.once('value');
    const firebaseData = snapshot.val() || {};

    console.log('--- Comparing local script data with Firebase data ---');
    const changes = {
      newKeys: [],
      changedKeys: [],
    };

    for (const key in selectOptionsData) {
      if (Object.hasOwnProperty.call(selectOptionsData, key)) {
        if (!firebaseData.hasOwnProperty(key)) {
          changes.newKeys.push(key);
        } else if (JSON.stringify(selectOptionsData[key]) !== JSON.stringify(firebaseData[key])) {
          changes.changedKeys.push(key);
        }
      }
    }

    if (changes.newKeys.length === 0 && changes.changedKeys.length === 0) {
      console.log('No new additions or changes detected between local script and Firebase.');
    } else {
      if (changes.newKeys.length > 0) {
        console.log('\nNEW ADDITIONS to be written to Firebase:');
        changes.newKeys.forEach(key => {
          console.log(`  - ${key}`);
        });
      }
      if (changes.changedKeys.length > 0) {
        console.log('\nCHANGES to be written to Firebase (key content will be updated):');
        changes.changedKeys.forEach(key => {
          console.log(`  - ${key} (content differs)`);
        });
      }
    }
    console.log('--- End of comparison ---');

    console.log('\nAttempting to write/overwrite /selectOptions in Firebase...');
    await selectOptionsRef.set(selectOptionsData);
    console.log('selectOptions migrated successfully!');
    migrationSuccessful = true;

  } catch (error) {
    console.error('Migration FAILED:', error);
    migrationSuccessful = false;
  } finally {
    admin.app().delete()
      .then(() => {
        console.log("Firebase app resources released.");
        if (migrationSuccessful) {
          process.exit(0);
        } else {
          process.exit(1);
        }
      })
      .catch(err => {
        console.error("Error closing Firebase app:", err);
        process.exit(1);
      });
  }
}

migrateToRealtimeDB();
