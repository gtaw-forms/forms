const generateMedicalRecordRelease = (formData) => {
    const {
        patientFirstName,
        patientMiddleName,
        patientLastName,
        patientPH,
        patientDateOfBirth,
        patientAddress,
        patientZIP,
        patientEmail,
        patientMedInfoReleaseOther,
        phmcEmployee,
        MedicalRecordsReleaseOther,
        patientMedInfoFormatOther,
        StupidDateFrom,
        StupidDateTo,
        SubmitDate,
        paymentProofPhotos,
        MedicalRecordsRelease,
        payNow,
    } = formData;

    const calculateCost = () => {
        const selectedCount = MedicalRecordsRelease?.length || 0;
        if (selectedCount === 0) {
            return 0;
        }
        const costPerItem = 5000;
        return selectedCount * costPerItem;
    };
    const approximateCost = calculateCost();
    const firstPaymentProofUrl = (paymentProofPhotos || '').split(',')[0].trim();
    const patientFullName = `${patientFirstName || ''} ${patientMiddleName || ''} ${patientLastName || ''}`.replace(/\s+/g, ' ').trim(); // Combine and clean up spaces

    let bbCode = `[divbox=white] [center] [img]https://i.ibb.co/0pgw9hHm/phmc.png[/img] [/center] [/divbox]
[divbox=white]
[br][/br][color=#800000][size=150][b]I. PATIENT INFORMATION[/b][/size][/color][hr][/hr]
[list=none][b]Title:[/b] [i](select one)[/i]
[list=none][${formData.patientTitle === 'Mr' ? 'x' : ''}] Mr.
[*][${formData.patientTitle === 'Mrs' ? 'x' : ''}] Mrs.
[*][${formData.patientTitle === 'Ms' ? 'x' : ''}] Ms.
[*][${formData.patientTitle === 'Other' ? 'x' : ''}] Other[/list]
[b]First Name:[/b]
[i]${patientFirstName}[/i][br][/br]
[b]Middle Name:[/b] [i](optional)[/i]
[i]${patientMiddleName}[/i][br][/br]
[b]Last Name:[/b]
[i]${patientLastName}[/i][br][/br]
[b]Gender:[/b] [i](select one)[/i]
[list=none]
[*][${formData.patientGender === 'Male' ? 'X' : ''}] Male
[*][${formData.patientGender === 'Female' ? 'X' : ''}] Female[/list]
[b]Date of Birth:[/b]
[i]${patientDateOfBirth}[/i][br][/br]
[b]Address:[/b]
[i]${patientAddress}[/i][br][/br]
[b]ZIP / Postal Code:[/b]
[i]${patientZIP}[/i][br][/br][/list]
[br][/br][color=#800000][size=150][b]II. CONTACT INFORMATION[/b][/size][/color][hr][/hr]
[list=none]
[b]Phone Type:[/b] [i](select one)[/i]
[list=none]
[*][${formData.patientPhoneType === 'Mobile' ? 'X' : ''}] Mobile
[*][${formData.patientPhoneType === 'Home' ? 'X' : ''}] Home
[*][${formData.patientPhoneType === 'Work' ? 'X' : ''}] Work
[*][${formData.patientPhoneType === 'Other' ? 'X' : ''}] Other[/list][b]Phone Number:[/b]
[i]${patientPH}[/i][br][/br]
[b]Email:[/b]
[i]${patientEmail}[/i][br][/br][/list]
[br][/br][color=#800000][size=150][b]III. RELEASE INFORMATION[/b][/size][/color][hr][/hr]
[list=none][b]Purpose of Medical Information Release:[/b]
[list=none]
[*][${formData.CarePurposeMedicalInformationRelease === 'Further Treatment' ? 'X' : ''}] Further Treatment / Continued 
[*][${formData.CarePurposeMedicalInformationRelease === 'Personal' ? 'X' : ''}] Personal Use
[*][${formData.CarePurposeMedicalInformationRelease === 'Attorney' ? 'X' : ''}] Attorney / Client
[*][${formData.CarePurposeMedicalInformationRelease === 'Other' ? 'X' : ''}] Other: ${patientMedInfoReleaseOther}[/list][/list]
[list=none][b]Format of Medical Information Release:[/b]
[list=none]
[*][${formData.PurposeMedicalInformationReleaseFormat === 'CopyofRecords' ? 'X' : ''}] Copy of Record to be picked up
[*][${formData.PurposeMedicalInformationReleaseFormat === 'VerbalRelease' ? 'X' : ''}] Verbal Release (e.g. phone conversation)
[*][${formData.PurposeMedicalInformationReleaseFormat === 'ElectronicRelease' ? 'X' : ''}] Electronical Release (sent via email)
[*][${formData.PurposeMedicalInformationReleaseFormat === 'Other' ? 'X' : ''}] Other: ${patientMedInfoFormatOther}[/list][/list]
[list=none][b]Date Range:[/b]
[i]I authorize the release of information covering the period(s) of treatment:[/i]
[list=none]
[*][b]From:[/b] [i]${StupidDateFrom}[/i]    
[*][b]To:[/b] [i]${StupidDateTo}[/i][/list][/list]
[list=none][b]Medical Records to be Released:[/b] [i](check all that apply)[/i]
[list=none]
[*][${formData.MedicalRecordsRelease?.includes('ERVisit') ? 'X' : ''}] [b]Emergency Room Visit[/b] (ER notes, progress notes, consultations, procedure notes, test results)
[*][${formData.MedicalRecordsRelease?.includes('HospitalStay') ? 'X' : ''}] [b]Hospital Stay[/b] (History and physical, progress notes, consultations, operative reports, discharge summary, test results)
[*][${formData.MedicalRecordsRelease?.includes('Outpatient') ? 'X' : ''}] [b]Outpatient Surgery/Procedure[/b] (History and physical, progress notes, consultations, procedure notes, test results)
[*][${formData.MedicalRecordsRelease?.includes('OfficeClinic') ? 'X' : ''}] [b]Clinic, Office Visit or Immediate Care[/b] (Office notes, progress notes, procedure notes, test results)
[*][${formData.MedicalRecordsRelease?.includes('PsychologyVisits') ? 'X' : ''}] [b]Psychology Visits[/b] (Office notes, progress notes, procedure notes, evaluation results)
[*][${formData.MedicalRecordsRelease?.includes('Other') ? 'X' : ''}] [b]Other Records:[/b] ${MedicalRecordsReleaseOther}[/list][/list]
[list=none][b]Practitioner's name seen by:[/b]
[i]${phmcEmployee}[/i]
[br][/br][/list]
[color=#800000][size=150][b]IV. AUTHORIZATION FOR RELEASE INFORMATION[/b][/size][/color][hr][/hr][br][/br]
[list=none]I, ${patientFirstName} ${patientMiddleName} ${patientLastName}, hereby authorize Pillbox Hill Medical Center to disclose my individually identifiable health information. I understand that this authorization is voluntary and I may refuse to sign this authorization. I further understand that my health care will not be affected if I do not sign this form.

I, ${patientFirstName} ${patientMiddleName} ${patientLastName}, understand that if the recipient authorized to receive the information is not a covered entity, the released information may no longer be protected by federal and state privacy regulations.

I, ${patientFirstName} ${patientMiddleName} ${patientLastName}, further understand that I may revoke this authorization at any time by notifying, in writing, the Pillbox Hill Medical Center facility where this authorization is being signed. I also understand the revocation must be signed and dated with a date that is later than the date on this authorization. The revocation will not affect any releases made prior to the receipt of the written revocation.

I, ${patientFirstName} ${patientMiddleName} ${patientLastName}, understand the record might not be complete, if it is a recent visit, and additional documentation could be added after submitting this request. 

By typing my name below, I, ${patientFirstName} ${patientMiddleName} ${patientLastName}, certify that this information can be used for the purpose of processing my Authorization for Medical Records Release request. I consider this as my electronic signature for this request.
[br][/br]
[/list]
[list=none][b]Signature:[/b] 
[i]${patientFirstName} ${patientMiddleName} ${patientLastName}[/i][br][/br]
[b]Date:[/b]
[i]${SubmitDate}[/i]
${(payNow === true || payNow === 'true') && approximateCost > 0 ? `
    I, ${patientFullName || 'the undersigned'}, enclose this payment of $${approximateCost.toLocaleString()} for the Medical Records Release Fees. ${firstPaymentProofUrl ? `[url=${firstPaymentProofUrl}]Enclosed Image[/url]` : 'i[/i]'}` : ''}
[/list]
    [/divbox]`; // <-- Moved the closing divbox tag here
    return bbCode;
};
export default generateMedicalRecordRelease;