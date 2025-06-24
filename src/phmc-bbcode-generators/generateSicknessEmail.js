// src/phmc-bbcode-generators/generateSicknessEmail.js

const generateSicknessEmail = (formData) => {
    const {
        emailPurpose, // 'Sickness Note' or 'Illness Confirmation'
        emailRecipient, // Name of the person/entity receiving the email
        patientName, // Name of the patient
        dateOfVisit, // Date patient was seen at PHMC
        sicknessStartDate, // Start date of sickness (for Sickness Note)
        sicknessEndDate, // End date of sickness (for Sickness Note)
        reasonForSickness, // Brief reason for sickness (for Sickness Note)
        illnessCondition, // Diagnosed illness/condition (for Illness Confirmation)
        confirmationPurpose, // Purpose of confirmation (for Illness Confirmation)
        phmcEmployee, // The PHMC employee sending the email
        phmcRank, // Rank of the PHMC employee
        phmcEmployeeDepartment, // Department of the PHMC employee
        phmcEmployeeSignatureImage, // Signature image URL
        attachedReportSummary,
    } = formData;

    let subject = '';
    let emailBody = '';

    const formattedDateOfVisit = dateOfVisit ? new Date(dateOfVisit).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';

    if (emailPurpose === 'Sickness Note') {
        subject = `RE: Sickness Note for ${patientName || 'Patient'}`;
        emailBody = `Dear ${emailRecipient || 'Recipient'},

This email serves as a sickness note for ${patientName || 'the patient'} from ${sicknessStartDate || 'N/A'} to ${sicknessEndDate || 'N/A'}.

${patientName || 'The patient'} was seen at Pillbox Hill Medical Center on ${formattedDateOfVisit} and was advised to rest due to ${reasonForSickness || 'a medical condition'}.

We anticipate ${patientName || 'they'} will be able to resume normal activities after the specified period.

Please do not hesitate to contact us if you require further information.`;
    } else if (emailPurpose === 'Illness Confirmation') {
        subject = `RE: Illness Confirmation for ${patientName || 'Patient'}`;
        emailBody = `Dear ${emailRecipient || 'Recipient'},

This email confirms that ${patientName || 'the patient'} was seen at Pillbox Hill Medical Center on ${formattedDateOfVisit}.

${patientName || 'The patient'} was diagnosed with ${illnessCondition || 'a medical condition'}. This confirmation is provided for ${confirmationPurpose || 'their records'}.

Please do not hesitate to contact us if you require further information.`;
    } else {
        subject = 'PHMC Email - Subject Missing';
        emailBody = 'Please select an email purpose (Sickness Note or Illness Confirmation).';
    }
    const reportSection = attachedReportSummary
        ? `\n\n[b]Attached Medical Report Summary:[/b]\n[altspoiler=Medical Report Summary][quote]${attachedReportSummary}[/quote][/altspoiler]`
        : '';

    const signatureBBCode = phmcEmployeeSignatureImage ? `[img]${phmcEmployeeSignatureImage.trim()}[/img]` : '';

    const bbCode = `[divbox=na][br][/br][imageleft]https://i.imgur.com/dkdFQtg.png[/imageleft] [b][size=110]Pillbox Hill Medical Center[/size][/b] 
[center][/center][br][/br]
[center][size=130][/center][/size]
[center][size=150][b]${subject}[/b][/size][/center]

[hr][/hr][br][/br][list=none]
${emailBody}

${reportSection}

Respectfully submitted,
${signatureBBCode} 
[/list][hr][/hr][list=none]
[b][size=105]${phmcEmployee || 'PHMC Employee'}[/size][/b]
[size=85]${phmcRank || 'N/A'}
[/size]

[b]Pillbox Hill Medical Center[/b]
[size=85]Elgin Avenue/Strawberry Avenue, Pillbox Hill, Los Santos, SA
Phone: 50056
Mail: [url=https://phmc.gta.world/ucp.php?i=pm&mode=compose&g=40]info@phmc.health[/url]
Website: [url=https://phmc.gta.world/index.php]www.phmc.health[/url]

Follow us on Facebrowser: [url=https://face.gta.world/pages/PHMC?ref=qs]Pillbox Hill Medical Center[/url][/size]

[size=70][i]The contents of this message and any attachments are confidential. They are intended for the named recipient(s) only.  If you have received this email by mistake, please notify the sender immediately and do not disclose the contents to anyone or make copies thereof.[/i][/size][/divbox]`;

    return bbCode;
};

export default generateSicknessEmail;
