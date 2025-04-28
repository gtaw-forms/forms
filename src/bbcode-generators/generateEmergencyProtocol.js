const generateEmergencyProtocol = (formData) => {
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

export default generateEmergencyProtocol;
