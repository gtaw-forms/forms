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
// (Including Imaging, XrayResults, ctResults, mriResults, ultrasoundResults,
// and all others like PurposeMedicalInformationRelease, patientBloodType, etc.)

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
    { value: 'Aortic Dissection', label: 'Aortic Dissection' },
    { value: 'Intracranial Hemorrhage', label: 'Intracranial Hemorrhage' },
    { value: 'Midline Shift' , label: 'Midline Shift' },
    { value: 'Pulmonary Embolism' , label: 'Pulmonary Embolism' },
    { value: 'Skull Fracture' , label: 'Skull Fracture' },
    { value: 'Solid Organ Injury', label: 'Solid Organ Injury' },
    { value: 'Tumor', label: 'Tumor' },
];
const mriResults = [
    { value: 'Cancerous Mass', label: 'Cancerous Mass' },
    { value: 'Degenerative Disc Disease', label: 'Degenerative Disc Disease' },
    { value: 'Herniated Disc', label: 'Herniated Disc' },
    { value: 'Multiple Sclerosis', label: 'Multiple Sclerosis' },
    { value: 'Tumor', label: 'Tumor' },
    { value: 'Spinal Stenosis', label: 'Spinal Stenosis' },
    { value: 'Stroke', label: 'Stroke' },
];
const ultrasoundResults = [
    { value: 'Cyst', label: 'Cyst' },
    { value: 'Ectopic Pregnancy', label: 'Ectopic Pregnancy' },
    { value: 'Free Fluid Accumulation', label: 'Free Fluid Accumulation' },
    { value: 'Gallstones', label: 'Gallstones' },
    { value: 'Internal Bleeding', label: 'Internal Bleeding' },
    { value: 'Organ Damage', label: 'Organ Damage' },
    { value: 'Ovarian Torsion', label: 'Ovarian Torsion' },
    { value: 'Pregnancy Confirmation', label: 'Pregnancy Confirmation' },
];

const selectOptionsData = {
    // Include ALL existing selectOptions you want to keep
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

    // Add the new imaging options
    Imaging,
    XrayResults,
    ctResults,
    mriResults,
    ultrasoundResults,
};

async function migrateToRealtimeDB() {
  console.log('Starting Realtime Database migration for selectOptions...');

  const rootRef = db.ref();

  try {
    // This will overwrite the entire selectOptions node with the content of selectOptionsData
    await rootRef.child('selectOptions').set(selectOptionsData);
    console.log('selectOptions migrated successfully!');

    // The 'agencies' and 'staff' nodes will not be touched by this operation.

  } catch (error) {
    console.error('Migration FAILED:', error);
  }
}

migrateToRealtimeDB();
