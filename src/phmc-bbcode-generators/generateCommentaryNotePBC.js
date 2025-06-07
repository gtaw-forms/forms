const generateCommentaryNotePBC = (formData) => {
    const {
        phmcEmployee,
        date,
        patientID,
        patientNotes
    } = formData;

    let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]Session Notes[/b]

PATIENT ID: ${patientID}

Date: ${date}

[/center][td][center][img]https://i.imgur.com/LkRKav2.png[/img][/center][td][center][br][/br][br][/br][size=100][b]PALETO BAY CLINIC[/b]
PALETO BAY BLVD.
PO BOX 685
PALETO BAY, SAN ANDREAS
P: 50056[/size][/center][/table][/divbox]
[divboxcolor=black][center][color=#0080FF]>[/color] [color=#FFFFFF][b]Commentary Note[/b][/color][/center][/divboxcolor]
[table][tr][td][left][list=none][u]Firstname Lastname: [/u][br][/br]
${phmcEmployee}
[br][/br]
[u]Patient Notes: [/u]
${patientNotes}
[br][/br]
[u]Department: [/u][br][/br]
[cb${formData.departmentLarge === 'EmergencyMedicine' ? 'c' : ''}] Emergency Medicine
[cb${formData.departmentLarge === 'InternalMedicine' ? 'c' : ''}] Internal Medicine
[cb${formData.departmentLarge === 'Surgical' ? 'c' : ''}] Surgical Department
[cb${formData.departmentLarge === 'Midwifery' ? 'c' : ''}] Midwifery
[cb${formData.departmentLarge === 'PhysicalTherapy' ? 'c' : ''}] Physical Therapy
[cb${formData.departmentLarge === 'Dentistry' ? 'c' : ''}] Dentistry
[cb${formData.departmentLarge === 'MentalHealth' ? 'c' : ''}] Mental Health
[cb${formData.departmentLarge === 'Administration' ? 'c' : ''}] Administration
[br][/br][/left]
[/table]
    `
                    return bbCode;
                    };

export default generateCommentaryNotePBC;