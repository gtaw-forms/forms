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
        Imaging, // This is expected to be an array of selected imaging types
        XrayResults,
        ctResults,
        mriResults,
        ultrasoundResults,
        patientInjuryMechanism,
        prescriptionImage
    } = formData;

    // --- Imaging Section Logic ---
    let imagingSectionBBCode = '';
    if (Imaging && Array.isArray(Imaging) && Imaging.length > 0) {
        const imagingPerformedString = Imaging.join(', '); // e.g., "X-Ray, CT Scan"

        // Build the results string conditionally based on what's filled
        let imagingResultsString = '';
        const results = [];
        if (XrayResults && XrayResults.length > 0) results.push(`X-Ray: ${XrayResults.join(', ')}`);
        if (ctResults && ctResults.length > 0) results.push(`CT: ${ctResults.join(', ')}`);
        if (mriResults && mriResults.length > 0) results.push(`MRI: ${mriResults.join(', ')}`);
        if (ultrasoundResults && ultrasoundResults.length > 0) results.push(`Ultrasound: ${ultrasoundResults.join(', ')}`);

        imagingResultsString = results.length > 0 ? results.join('; ') : 'Results pending or N/A';

        imagingSectionBBCode = `
[table][tr][td][center]Imaging Performed: ${imagingPerformedString}[/center]
[td][center]Imaging Results: ${imagingResultsString}[/center][/tr][/table]`;
    }
    // --- End Imaging Section Logic ---
    // --- Prescription Image Logic ---
    let prescriptionImageBBCode = '';
    if (prescriptionImage && prescriptionImage.trim() !== '') {
        if (prescriptionImage.trim().toLowerCase().startsWith('http://') || prescriptionImage.trim().toLowerCase().startsWith('https://')) {
            prescriptionImageBBCode = `[img]${prescriptionImage.trim()}[/img]`;
        } else {
            prescriptionImageBBCode = prescriptionImage.trim();
        }
    } else {
        prescriptionImageBBCode = 'N/A';
    }

    let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]EMERGENCY PROTOCOL[/b]

PATIENT ID: ${patientID || 'N/A'}

Date: ${date || 'N/A'}

Signed: ${phmcRank || 'N/A'} ${lastName || 'N/A'}
[/center][td][center][img]https://i.ibb.co/0pgw9hHm/phmc.png[/img][/center][td][center][br][/br][br][/br][size=100][b]PILLBOX HILL MEDICAL CENTER[/b]
ELGIN AVE. / STRAWBERRY AVE.
PO BOX 742
LOS SANTOS, SAN ANDREAS
P: 50056[/size][/center][/table][/divbox]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Anamnesis[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Chief Complaint: [/u][br][/br]
${patientChiefComplaint || 'N/A'}

[u] Patient Mechanism of Injury: [/u][br][/br]
${formData.patientInjuryMechanism || 'N/A'}
[br][/br]
[u]Pain Level/Emergency Severity Index (ESI): [/u][br][/br]
[cb${formData.painLevel === 'patientNoPain' ? 'c' : ''}] [color=#0040FF]Level 5: no pain/non-urgent[/color] [cb${formData.painLevel === 'patientNormalPain' ? 'c' : ''}] [color=#00BF00]Level 4: normal pain/less urgent[/color] [cb${formData.painLevel === 'patientMildPain' ? 'c' : ''}] [color=#FFFF00]Level 3: mild pain/urgent[/color] [cb${formData.painLevel === 'patientSeverePain' ? 'c' : ''}] [color=#FF8040]Level 2: Severe pain/very urgent [/color][cb${formData.painLevel === 'patientCritical' ? 'c' : ''}] [color=#FF0000]Level 1: Critical/Emergent [/color][/left]
[/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Vitals[/b][/color][/center][/divboxcolor]
[table][tr][td][center]Temperature: [cb${formData.temperature === 'patientTempNormal' ? 'c' : ''}] Normal [cb${formData.temperature === 'patientHypothermic' ? 'c' : ''}] Hypothermic [cb${formData.temperature === 'patientHyperthermic' ? 'c' : ''}] Hyperthermic[/center]
[td][center]Heart Rate: [cb${formData.heartRate === 'patientHeartRateNormal' ? 'c' : ''}] Normal [cb${formData.heartRate === 'patientHeartRateBradycardia' ? 'c' : ''}] Bradycardia [cb${formData.heartRate === 'patientHeartRateTachycardia' ? 'c' : ''}] Tachycardia[/center][/table]
[table][tr][td][center]Breathing: [cb${formData.breathing === 'patientBreathingNormal' ? 'c' : ''}] Normal [cb${formData.breathing === 'patientBreathingSlow' ? 'c' : ''}] Slow [cb${formData.breathing === 'patientBreathingFast' ? 'c' : ''}] Fast [cb${formData.breathing === 'patientBreathingObstructed' ? 'c' : ''}] Obstructed[/center]
[td][center]Blood Pressure: [cb${formData.bloodPressure === 'patientBloodPressureNormal' ? 'c' : ''}] Normal [cb${formData.bloodPressure === 'patientBloodPressureHypotension' ? 'c' : ''}] Hypotension [cb${formData.bloodPressure === 'patientBloodPressureHypertension' ? 'c' : ''}] Hypertension [/center][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Findings[/b][/color][/center][/divboxcolor]
[table][tr][td][center]General Health Condition (GHC): [cb${formData.findings === 'patientNormal' ? 'c' : ''}] Normal [cb${formData.findings === 'patientImpared' ? 'c' : ''}] Impaired[/center]
[td][center]Lungs (Auscultation): [cb${formData.lungs === 'patientNormal' ? 'c' : ''}] Normal [cb${formData.findings === 'patientRhonchi' ? 'c' : ''}] Rhonchi [cb${formData.findings === 'patientCrack' ? 'c' : ''}] Crackles [/center][/table]
[table][tr][td][center]Pupils: [cb${formData.pupils === 'patientPupilsNormal' ? 'c' : ''}] Normal [cb${formData.pupils === 'patientPupilsAbnormal' ? 'c' : ''}] Abnormal [/center]
[td][center]Wounds: [cb${formData.wounds === 'patientFractures' ? 'c' : ''}] Fracture(s) [cb${formData.wounds === 'patientBleeding' ? 'c' : ''}] Bleeding [cb${formData.wounds === 'patientHematoma' ? 'c' : ''}] Hematoma [cb${formData.wounds === 'patientNoWounds' ? 'c' : ''}] None [/center][/table]${imagingSectionBBCode}
[table][tr][td][center]ECG: [cb${formData.ecg === 'patientSinusRhythm' ? 'c' : ''}] Sinus rhythm [cb${formData.ecg === 'patientArrhythmia' ? 'c' : ''}] Arrhythmia [cb${formData.ecg === 'patientInfaction' ? 'c' : ''}] Infarct [/center]
[td][center]Sono: [cb${formData.sono === 'patientNormal' ? 'c' : ''}] Normal [cb${formData.sono === 'patientFluids' ? 'c' : ''}] Fluids [cb${formData.sono === 'patientTissue' ? 'c' : ''}] Tissue Change[/center][/table]
[table][tr][td][center]Lab: [cb${formData.lab?.includes('WNL') ? 'c' : ''}] WNL  [cb${formData.lab?.includes('Anemia') ? 'c' : ''}] Anemia [cb${formData.lab?.includes('Inflammation/Infection') ? 'c' : ''}] Inflammation/Infection [cb${formData.lab?.includes('Dysfunction') ? 'c' : ''}] Dysfunction/Disorder [cb${formData.lab?.includes('ElectrolyteImbalance') ? 'c' : ''}] Electrolyte Imbalance [cb${formData.lab?.includes('Infarct') ? 'c' : ''}] Infarct/Embolism [cb${formData.lab?.includes('Tumor') ? 'c' : ''}] Tumor [/center][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Preliminary Diagnosis[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Primary Diagnosis: [/u][br][/br]
${patientDiagnosis || 'N/A'}
[br][/br][u]Secondary Diagnosis: [/u][br][/br]
${patientSecondaryDiagnosis || 'N/A'}[/left][/list][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Therapy[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Admission: [/u][br][/br]
[cb${formData.admission === 'Yes' ? 'c' : ''}] Yes
[cb${formData.admission === 'No' ? 'c' : ''}] No
[br][/br]
[u]Procedure/Free Text: [/u][br][/br]
${patientProcedure || 'N/A'}
[br][/br]
[u]Medication: [/u][br][/br]
${patientMedicine || 'N/A'}
${prescriptionImageBBCode}
[u]Follow-Up: [/u][br][/br]
[cb${formData.followup === 'AsNeeded' ? 'c' : ''}] As needed
[cb${formData.followup === 'Recommended' ? 'c' : ''}] Recommended
    
[/left][/list][/table]`;
    return bbCode;
};

export default generateEmergencyProtocol;
