const generateSurgicalOps = (formData) => {
    const {
        phmcEmployee,
        extraStaff,
        patientID,
        patientSummaryConsultation,
        patientAddress,
        phmcRank,
        date,
        patientSummary,
        lastName,
        surgeryProcedures
    } = formData;
    const extraStaffNames = Array.isArray(extraStaff) ? extraStaff.join(', ') : extraStaff;

    let bbCode = `[divbox=white][table][tr][td][center][br][/br][br][/br][b]SURGICAL REPORT[/b]

PATIENT ${patientID}

Date: ${date}
Signed: ${phmcRank} ${lastName}

[/center][td][center][img]https://i.imgur.com/QMaz0OC.png[/img][/center][td][center][br][/br][br][/br][size=100][b]PILLBOX HILL MEDICAL CENTER[/b]
ELGIN AVE. / STRAWBERRY AVE.
PO BOX 742
LOS SANTOS, SAN ANDREAS
P: 50056[/size][/center][/table][/divbox]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Personnel[/b][/color][/center][/divboxcolor]
[table][tr][td]Lead Surgeon[/td][td]
${phmcEmployee}
[/td][/tr]
[tr][td]Additional Staff [i](leave empty if none)[/i][/td][td]
${extraStaff}
[/td][/tr][/table]
[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Surgical Inquiry[/b][/color][/center][/divboxcolor]
[table]

[tr][td]Name of the procedure[/td][td]
${surgeryProcedures}

[tr][td]Did the patient or their family consent, or did they have a life threatening or severe injury that requires immediate surgical intervention?[/td][td]
[cb${formData.patientConsentOption === 'Yes' ? 'c' : ''}] Yes
[cb${formData.patientConsentOption === 'No' ? 'c' : ''}] No


[/td][/tr]

[tr][td]Did any medical complications occur during the surgery?[/td][td]
[cb${formData.patientComplicationOptions === 'Yes' ? 'c' : ''}] Yes
[cb${formData.patientComplicationOptions === 'No' ? 'c' : ''}] No
[/td][/tr]

[tr][td]Was the procedure completed successfully, and did it result in the desired clinical outcome?[/td][td]
[cb${formData.procedureGoodOptions === 'Yes' ? 'c' : ''}] Yes
[cb${formData.procedureGoodOptions === 'No' ? 'c' : ''}] No
[/td][/tr]
[/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Post-Anesthesia Report[/b][/color][/center][/divboxcolor]
[table]

[tr][td]Type & Dosage of Anesthesia Administered[/td][td] ${patientSummaryConsultation}
[/td][/tr]

[tr][td]Post-Operative Anesthesia Details[/td][td]${patientAddress}
[/td][/tr]

[/table]

[divboxcolor=black][center][color=#FF0000]>[/color] [color=#FFFFFF][b]Summary of Surgical Procedure[/b][/color][/center][/divboxcolor]
[table]

[tr][td]
${patientSummary}

[/table]`;

    return bbCode;
};

export default generateSurgicalOps;