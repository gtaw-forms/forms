const generateConsultationNotesPHMC = (formData) => {
    const {
        lastName,
        phmcRank,
        patientID,
        date,
        patientDiagnosis,
        patientSecondaryDiagnosis,
        // patientMedicine, // This seems unused now, replaced by scenePhotos for medication?
        patientProcedure,
        patientChiefComplaint,
        // patientAdvise, // This seems unused
        scenePhotos, // Used for Medication section now
    } = formData;

    // --- Custom Handling for scenePhotos (Medication) ---
    let medicationBBCode = '[i]No medication details provided.[/i]'; // Default fallback

    if (scenePhotos && scenePhotos.trim()) {
        const items = scenePhotos.split(',')
            .map(item => item.trim()) // Trim whitespace from each item
            .filter(item => item); // Remove any empty items resulting from split/trim

        if (items.length > 0) {
            medicationBBCode = items.map(item => {
                const isImageUrl = item.startsWith('https://') || /\.(jpg|jpeg|png|gif)$/i.test(item);
                if (isImageUrl) {
                    return `[img]${item}[/img]`; // Wrap in img tags
                } else {
                    return item; // Output as plain text
                }
            }).join('\n'); // Join processed items with newlines
        }
    }
    // --- End Custom Handling ---


    let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]Consultation Notes[/b]

PATIENT ID: ${patientID || 'N/A'}

Date: ${date || 'N/A'}

Signed: ${phmcRank || 'N/A'} ${lastName || 'N/A'}
[/center][td][center][img]https://i.imgur.com/QMaz0OC.png[/img][/center][td][center][br][/br][br][/br][size=100][b]PILLBOX HILL MEDICAL CENTER[/b]
ELGIN AVE. / STRAWBERRY AVE.
PO BOX 742
LOS SANTOS, SAN ANDREAS
P: 50056[/size][/center][/table][/divbox]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Anamnesis[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Reason for Visit: [/u][br][/br]
${patientChiefComplaint || 'N/A'}
[br][/br]
[u]Assigned Department: [/u][br][/br]
[cb${formData.assignedDepartment === 'InternalMedicine' ? 'c' : ''}] Internal Medicine
[cb${formData.assignedDepartment === 'SurgicalDepartment' ? 'c' : ''}] Surgical Department
[cb${formData.assignedDepartment === 'Midwifery' ? 'c' : ''}] Midwifery
[cb${formData.assignedDepartment === 'Dialysis' ? 'c' : ''}] Dialysis
[/list][/td][/tr][/table] {/* Corrected closing tag placement */}
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
[u]Treatment plan/Free Text: [/u][br][/br]
${patientProcedure || 'N/A'}
[br][/br]
[u]Medication: [/u][br][/br]
${medicationBBCode} 
[br][/br]
[u]Follow-Up: [/u][br][/br]
[cb${formData.followup === 'AsNeeded' ? 'c' : ''}] As needed
[cb${formData.followup === 'Recommended' ? 'c' : ''}] Recommended
[cb${formData.followup === 'ElectiveProcedure' ? 'c' : ''}] Elective procedure
[/left][/list][/table]`;
    return bbCode;
};

export default generateConsultationNotesPHMC;
