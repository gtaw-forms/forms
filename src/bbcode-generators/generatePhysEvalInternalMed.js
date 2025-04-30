const generatePhysEvalInternalMed = (formData) => {
    const {
        patientID,
        date,
        lastName,
        patientHeight,
        patientWeight,
        phmcRank,
        careerRisks,
        patientAllergies,
        patientMedicine,
        patientcareerNo,
        patientSummary,
        patientCareer,
        patientImpairments,
    } = formData;

        let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]PHYSICAL EXAMINATION[/b]

PATIENT ${patientID}

Date: ${date}
Signed: ${phmcRank} ${lastName}
[/center][td][center][img]https://i.imgur.com/QMaz0OC.png[/img][/center][td][center][br][/br][br][/br][size=100][b]PILLBOX HILL MEDICAL CENTER[/b]
ELGIN AVE. / STRAWBERRY AVE.
PO BOX 742
LOS SANTOS, SAN ANDREAS
P: 50056[/size][/center][/table][/divbox]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Patient Measurements[/b][/color][/center][/divboxcolor]
[table][tr][td][list=none][br][/br]Height: ${patientHeight}
[br][/br]
Weight: ${patientWeight}
[/list][td]
[list=none][u]Body Mass Index: [/u][br][/br]
[cb${formData.BodyMassIndex === 'Underweight' ? 'c' : ''}][/cb${formData.BodyMassIndex === 'Underweight' ? 'c' : ''}] Underweight
[cb${formData.BodyMassIndex === 'Normal' ? 'c' : ''}][/cb${formData.BodyMassIndex === 'Normal' ? 'c' : ''}] Normal
[cb${formData.BodyMassIndex === 'Overweight' ? 'c' : ''}][/cb${formData.BodyMassIndex === 'Overweight' ? 'c' : ''}] Overweight
[cb${formData.BodyMassIndex === 'Obese' ? 'c' : ''}][/cb${formData.BodyMassIndex === 'Obese' ? 'c' : ''}] Obese
[cb${formData.BodyMassIndex === 'ExtremeObese' ? 'c' : ''}][/cb${formData.BodyMassIndex === 'ExtremeObese' ? 'c' : ''}] Extremely Obese
[/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Vitals[/b][/color][/center][/divboxcolor]
[table][tr][td][center]Temperature: [cb${formData.temperature === 'patientTempNormal' ? 'c' : ''}] Normal [cb${formData.temperature === 'patientHypothermic' ? 'c' : ''}] Hypothermic [cb${formData.temperature === 'patientHyperthermic' ? 'c' : ''}] Hyperthermic[/center]
[td][center]Heart Rate: [cb${formData.heartRate === 'patientHeartRateNormal' ? 'c' : ''}] Normal [cb${formData.heartRate === 'patientHeartRateBradycardia' ? 'c' : ''}] Bradycardia [cb${formData.heartRate === 'patientHeartRateTachycardia' ? 'c' : ''}] Tachycardia[/center][/table]
[table][tr][td][center]Breathing: [cb${formData.breathing === 'patientBreathingNormal' ? 'c' : ''}] Normal [cb${formData.breathing === 'patientBreathingSlow' ? 'c' : ''}] Slow [cb${formData.breathing === 'patientBreathingFast' ? 'c' : ''}] Fast [cb${formData.breathing === 'patientBreathingObstructed' ? 'c' : ''}] Obstructed[/center]
[td][center]Blood Pressure: [cb${formData.bloodPressure === 'patientBloodPressureNormal' ? 'c' : ''}] Normal [cb${formData.bloodPressure === 'patientBloodPressureHypotension' ? 'c' : ''}] Hypotension [cb${formData.bloodPressure === 'patientBloodPressureHypertension' ? 'c' : ''}] Hypertension [/center][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Anamnesis[/b][/color][/center][/divboxcolor]
[table][tr][td][list=none][u]Does the patient have a job? [/u][br][/br]
[cb${formData.patientJob === 'Yes' ? 'c' : ''}][/cb${formData.patientJob === 'Yes' ? 'c' : ''}] Yes: ${patientCareer}
[cb${formData.patientJob === 'No' ? 'c' : ''}][/cb${formData.patientJob === 'No' ? 'c' : ''}] No: ${patientcareerNo} [/list]
[td][list=none][u]If yes, are harmful risk factors present? [/u][br][/br]
[cb${formData.patientJobRisks === 'Yes' ? 'c' : ''}][/cb${formData.patientJobRisks === 'Yes' ? 'c' : ''}] Yes: ${careerRisks}
[cb${formData.patientJobRisks === 'No' ? 'c' : ''}][/cb${formData.patientJobRisks === 'No' ? 'c' : ''}] No [/list]
[/td][/tr]
[tr][td][list=none][u]Are allergies or risks (implants, case of incompatibility, pacemaker, etc.) present?[/u][br][/br]
[cb${formData.patientAllergiesRisk === 'Yes' ? 'c' : ''}][/cb${formData.patientAllergiesRisk === 'Yes' ? 'c' : ''}] Yes: ${patientAllergies}
[cb${formData.patientAllergiesRisk === 'No' ? 'c' : ''}][/cb${formData.patientAllergiesRisk === 'No' ? 'c' : ''}] No [/list]
[td][list=none][u]Does the patient take medications on a regular basis? [/u][br][/br]
[cb${formData.patientMedicineRegular === 'Yes' ? 'c' : ''}][/cb${formData.patientMedicineRegular === 'Yes' ? 'c' : ''}] Yes: ${patientMedicine}
[cb${formData.patientMedicineRegular === 'No' ? 'c' : ''}][/cb${formData.patientMedicineRegular === 'No' ? 'c' : ''}] No[/list]
[/td][/tr]
[tr][td][list=none][u]Does the patient have other medical condition(s) or physical impairments?[/u][br][/br]
[cb${formData.patientOther === 'Yes' ? 'c' : ''}][/cb${formData.patientOther === 'Yes' ? 'c' : ''}] Yes: ${patientImpairments}
[cb${formData.patientOther === 'No' ? 'c' : ''}][/cb${formData.patientOther === 'No' ? 'c' : ''}] No [/list]
[td][list=none][u]Genetic Predisposition[/u][br][/br]
[cb${formData.predisposition === 'Existing' ? 'c' : ''}][/cb${formData.predisposition === 'Existing' ? 'c' : ''}] Existing
[cb${formData.predisposition === 'NonExisting' ? 'c' : ''}][/cb${formData.predisposition === 'NonExisting' ? 'c' : ''}] Non-existing [/list]
[/td][/tr][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Evaluation Summary[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Assessment Statement: [/u][br][/br]
${patientSummary}
[br][/br][/left][/list][/table]

`;

        return bbCode;
    };
export default generatePhysEvalInternalMed;