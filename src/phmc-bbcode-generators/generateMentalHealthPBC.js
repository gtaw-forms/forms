    const generateMentalHealthPBC = (formData) => {
        const {
            lastName,
            patientID,
            phmcRank,
            date,
            patientChiefComplaint,
            patientNotes, 
            patientDiagnosis,
            patientMedicine,
            patientProcedure,
        } = formData;

        let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]Session Notes[/b]

PATIENT ${patientID}

Date: ${date}
Signed: ${phmcRank} ${lastName}
[/center][td][center][img]https://i.imgur.com/LkRKav2.png[/img][/center][td][center][br][/br][br][/br][size=100][b]PALETO BAY CLINIC[/b]
PALETO BAY BLVD.
PO BOX 685
PALETO BAY, SAN ANDREAS
P: 50056[/size][/center][/table][/divbox]
[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Anamnesis[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Chief Complaint: [/u][br][/br]
${patientChiefComplaint}
[br][/br]
[u]Assigned Department: [/u][br][/br]
[cbc] Mental Health
[br][/br][/left]
[/table]
[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Findings[/b][/color][/center][/divboxcolor]
[table][tr][td][list=none]Notes: ${patientNotes}[/list][/table]
[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Discharge Diagnosis[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Primary Diagnosis: [/u][br][/br]
${patientDiagnosis}[/list][/table]
[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Therapy[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Admission: [/u][br][/br]
[cb${formData.admission === 'Yes' ? 'c' : ''}] Yes
[cb${formData.admission === 'No' ? 'c' : ''}] No
[br][/br]
[u]Procedure: [/u][br][/br]
${patientProcedure}
[br][/br]
[u]Medication: [/u][br][/br]
${patientMedicine}
[br][/br]
[u]Follow-Up: [/u][br][/br]
[cb${formData.followup === 'AsNeeded' ? 'c' : ''}] As needed
[cb${formData.followup === 'Recommended' ? 'c' : ''}] Recommended
[cb${formData.followup === 'ElectiveProcedure' ? 'c' : ''}] Elective procedure 
[/left][/list][/table]
`;

        return bbCode;
    };
export default generateMentalHealthPBC;