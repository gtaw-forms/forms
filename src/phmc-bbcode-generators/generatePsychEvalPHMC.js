const generatePsychEvalPHMC = (formData) => {
    const {
        patientID,
        date,
        phmcRank,
        lastName,
        patientChiefComplaint,
        patientTriggers,
        patientStress,
        patientTreatment,
        patientFamily,
        patientJobRisks,
        patientMedicalRecord,
        patientAllergies,
        patientChronicDiseases,
        patientVisitReason,
        patientSymptoms,
        patientCondition,
        patientDrugs,
        patientDrugsUsage,
        patientMental,
        patientJob,
        patientFam,
        patientLegal,
        patientRelationship,
        patientFindings,
        patientTreatmentPlan,
        patientSafety,
        patientFollowUp,
        patientTreatmentMedicine,
        patientDiagnosis,
        patientTherapy,
        patientRiskAssessment,
        patientTherapyMedicine,
    } = formData;

    let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]Session Notes[/b]
PATIENT ${patientID}
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
[u]Assigned Department: [/u][br][/br]
[cbc] Mental Health
[br][/br][/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Presenting Problem[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Description of the issue (e.g., anxiety, depression, psychosis): [/u][br][/br]
${patientVisitReason}
[br][/br]
[u]Onset and duration of symptoms: [/u][br][/br]
${patientSymptoms}
[br][/br]
[u]Triggers or stressors: [/u][br][/br]
${patientTriggers}
[br][/br]
[u]Impact on daily life: [/u][br][/br]
${patientStress}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Mental Status Examination (MSE)[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[u]Appearance: [/u][br][/br]
[cb${formData.Appearance === 'Good' ? 'c' : ''}] Well-groomed [cb${formData.Appearance === 'Disheveled' ? 'c' : ''}] Disheveled [cb${formData.Appearance === 'Inappropriate' ? 'c' : ''}] Inappropriate
[br][/br]
[u]Behavior: [/u][br][/br]
[cb${formData.Behavior === 'Cooperative' ? 'c' : ''}] Cooperative [cb${formData.Behavior === 'Agitated' ? 'c' : ''}] Agitated [cb${formData.Behavior === 'Withdrawn' ? 'c' : ''}] Withdrawn
[br][/br]
[u]Speech: [/u][br][/br]
[cb${formData.Speech === 'Normal' ? 'c' : ''}] Normal [cb${formData.Speech === 'Pressured' ? 'c' : ''}] Pressured [cb${formData.Speech === 'Slurred' ? 'c' : ''}] Slurred [cbcb${formData.Speech === 'Slow' ? 'c' : ''}] Slow
[br][/br]
[u]Mood: [/u][br][/br]
[cb${formData.Mood === 'Euthymic' ? 'c' : ''}] Euthymic [cb${formData.Mood === 'Depressed' ? 'c' : ''}] Depressed [cb${formData.Mood === 'Anxious' ? 'c' : ''}] Anxious [cb${formData.Mood === 'Angry' ? 'c' : ''}] Angry
[br][/br]
[u]Affect: [/u][br][/br]
[cb${formData.Affect === 'Congruent' ? 'c' : ''}] Congruent [cb${formData.Affect === 'Flat' ? 'c' : ''}] Flat [cb${formData.Affect === 'Inappropriate' ? 'c' : ''}] Inappropriate
[br][/br]
[u]Thought Process: [/u][br][/br]
[cb${formData.ThoughtProcess === 'Logical' ? 'c' : ''}] Logical [cb${formData.ThoughtProcess === 'Organized' ? 'c' : ''}] Organized [cb${formData.ThoughtProcess === 'Tangential' ? 'c' : ''}] Tangential [cb${formData.ThoughtProcess === 'Disorganized' ? 'c' : ''}] Disorganized
[br][/br]
[u]Thought Content: [/u][br][/br]
[cb${formData.ThoughtContent === 'Nodelusions' ? 'c' : ''}] No delusions [cb${formData.ThoughtContent === 'Delusions' ? 'c' : ''}] Delusions [cb${formData.ThoughtContent === 'Hallucinations' ? 'c' : ''}] Hallucinations [cb${formData.ThoughtContent === 'Suicidal' ? 'c' : ''}] Suicidal thoughts [cb${formData.ThoughtContent === 'Homicidal' ? 'c' : ''}] Homicidal thoughts
[br][/br]
[u]Insight and Judgment: [/u][br][/br]
[cb${formData.Insight === 'Intact' ? 'c' : ''}] Intact [cb${formData.Insight === 'Limited' ? 'c' : ''}] Limited [cb${formData.Insight === 'Poor' ? 'c' : ''}] Poor
[br][/br]
[u]Cognition: [/u][br][/br]
[cb${formData.Cognition === 'Oriented' ? 'c' : ''}] Oriented to time, place, person [cb${formData.Cognition === 'Memory' ? 'c' : ''}] Memory intact [cb${formData.Cognition === 'Attention' ? 'c' : ''}] Attention intact
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Psychiatric History[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[u]Past psychiatric diagnoses and treatments: [/u][br][/br]
${patientTreatment}
[br][/br]
[u]Hospitalizations: [/u][br][/br]
${patientMedicalRecord}
[br][/br]
[u]Family psychiatric history: [/u][br][/br]
${patientFamily}
[br][/br]
[u]History of self-harm or suicide attempts: [/u][br][/br]
${patientJobRisks}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Medical History[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[u]Current and past medical conditions: [/u][br][/br]
${patientCondition}
[br][/br]
[u]Medications (including psychiatric and non-psychiatric): [/u][br][/br]
${patientChronicDiseases}
[br][/br]
[u]Allergies: [/u][br][/br]
${patientAllergies}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Substance Use History[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[u]Use of alcohol, drugs, nicotine, and other substances: [/u][br][/br]
${patientDrugs}
[br][/br]
[u]Frequency and duration of use: [/u][br][/br]
${patientDrugsUsage}
[br][/br]
[u]Impact on mental health: [/u][br][/br]
${patientMental}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Psychosocial History[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[u]Childhood and family background: [/u][br][/br]
${patientFam}
[br][/br]
[u]Education and employment history: [/u][br][/br]
${patientJob}
[br][/br]
[u]Relationships and support system: [/u][br][/br]
${patientRelationship}
[br][/br]
[u]Legal issues: [/u][br][/br]
${patientLegal}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Risk Assessment[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[cb${formData.Risk === 'Suicidal' ? 'c' : ''}] Suicidal ideation or attempts [cb${formData.Risk === 'Homicidal' ? 'c' : ''}] Homicidal thoughts or violent behavior [cb${formData.Risk === 'Self' ? 'c' : ''}] Self-injury or harm to others
[br][/br]
[u]Details: [/u][br][/br]
${patientRiskAssessment}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Findings[/b][/color][/center][/divboxcolor]
[table][tr][td][list=none]
Notes: ${patientFindings}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Discharge Diagnosis[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[u]Primary Diagnosis: [/u][br][/br]
${patientDiagnosis}
[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Therapy[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Admission: [/u][br][/br]
[cb${formData.admission === 'Yes' ? 'c' : ''}] Yes [cb${formData.admission === 'No' ? 'c' : ''}] No
[br][/br]
[u]Treatment Plan: [/u][br][/br]
${patientTreatmentPlan}
[br][/br]
[u]Medication: [/u][br][/br]
${patientTherapyMedicine}
[br][/br]
[u]Follow-Up: [/u][br][/br]
[cb${formData.followup === 'AsNeeded' ? 'c' : ''}] As needed [cb${formData.followup === 'Recommended' ? 'c' : ''}] Recommended

[/list][/td][/tr][/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Treatment Plan/Recommendations[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none]
[u]Medications: [/u][br][/br]
${patientTreatmentMedicine}
[br][/br]
[u]Therapy (e.g., CBT, DBT): [/u][br][/br]
${patientTherapy}
[br][/br]
[u]Follow-up appointments: [/u][br][/br]
${patientFollowUp}
[br][/br]
[u]Safety planning (if at risk): [/u][br][/br]
${patientSafety}
[/list][/td][/tr][/table]`
    return bbCode;
    };
export default generatePsychEvalPHMC;