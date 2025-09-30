const generateMedicalFileUpdate = (formData) => {
    const {
        patientName,
        patientAddress,
        patientRace,
        patientGender,
        patientPH,
        patientDiscord,
        patientEmergencyContact,
        patientEmergencyContactNumber,
        patientEmergencyContactRelation,
        patientEmergencyContactDiscord,
        patientTitle,
        patientAllergies,
        patientCurrentMedicine,
        patientChronicDiseases,
        patientNotes,
        date,
        patientID,
        patientTherapy,
        patientTriggers,
        patientSupport,
        patientHarm,
        patientFam,
        patientGenetic,
        patientMental,
        patientFamSocial,
        patientReligion,
        attorneyName,
        attorneyRelation,
        attorneyPH,
        patientDateOfBirth,
        patientSmoker,
        patientAlcohol,
        patientDrugs,
        patientExercise,
        patientDiet,
        patientSleep,
        patientSexLife,
        patientJobRisks,
        patientHazards,
        patientOther,
        dnrOther,
        scenePhotos,
        UpdateMedicalFile, // Add this line
        patientBloodType,
        patientTitleNew,
        patientNameNew,
        patientDateOfBirthNew,
        patientAddressNew,
        patientPHNew,
        patientDiscordNew,
        patientGenderNew,
        patientRaceNew

    } = formData;

    let bbCode = `[table][tr][td][center][br][/br][br][/br][b]Patient Information[/b]

[size=110]PATIENT ${patientID}

${patientName}
[/size]

[/center][td][center][img]https://i.ibb.co/0pgw9hHm/phmc.png[/img][img]https://i.ibb.co/fdGgxDH1/LkRKav2.png[/img]
[b][size=150]PATIENT INFORMATION UPDATE[/size][/center][/table]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Patient Information[/b][/color][/size][/center][/divboxcolor]
[table][tr][td] Title: ${patientTitle}[/td][td] Full Name: ${patientName}
[tr][td] Date of Birth: ${patientDateOfBirth} [/td][td] Home Address: ${patientAddress}
[tr][td] Phone Number: ${patientPH} [/td][td] (( Discord ID: ${patientDiscord}))
[/table]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Updated Information[/b][/color][/size][/center][/divboxcolor]
[u]I hereby request the following information to be updated:[/u]
[i](Tick relevant fields by updating the prefix [cb] to [cbc] and provide the new information within. Please provide the information in full for the requested (ticked!) categories, including non-updated information. Do not add information in categories you haven't ticked![/i]

`;

    if (UpdateMedicalFile?.includes('GeneralInformation')) {
        bbCode += `[cbc][color=#FF0000]>[/color] [bold] General Information[/bold]
[altspoiler=New General Information]
[table][tr][td] Title: ${patientTitleNew}[/td][td] Full Name: ${patientNameNew}
[tr][td] Date of Birth: ${patientDateOfBirthNew} [/td][td] Home Address: ${patientAddressNew}
[tr][td] Gender Identity: ${patientGenderNew} [/td][td] Ethnicity: ${patientRaceNew}
[tr][td] Phone Number: ${patientPHNew} [/td][td] (( Discord ID: ${patientDiscordNew}))
[/table][/altspoiler]`;
    }

    if (UpdateMedicalFile?.includes('EmergencyContact')) {
        bbCode += `[cbc][color=#FF0000]>[/color] [bold] Emergency Contact[/bold]
[altspoiler=New Emergency Contact Details]
[table][tr][td] Full Name: ${patientEmergencyContact} [/td][td] Relationship: ${patientEmergencyContactRelation}
[tr][td] Phone Number: ${patientEmergencyContactNumber} [/td][td] (( Discord ID: ${patientEmergencyContactDiscord}))
[/table][/altspoiler]`;
    }

    if (UpdateMedicalFile?.includes('MedicalHistory')) {
        bbCode += `[cbc][color=#FF0000]>[/color] [bold] Medical History[/bold]
        [altspoiler=New Medical History]

[table][tr][td][b][size=105]Past History[/size][/b][color=transparent]youarecool[/color][/td][td][color=transparent]ifyoureadthisyouareawesomebutdontdeletemeplease![/color]
[tr][td] Blood Type: [/td][td] [cb${patientBloodType === 'A+' ? 'c' : ''}] A+ [cb${patientBloodType === 'A-' ? 'c' : ''}] A- [cb${patientBloodType === 'B+' ? 'c' : ''}] B+ [cb${patientBloodType === 'B-' ? 'c' : ''}] B- [cb${patientBloodType === 'O+' ? 'c' : ''}] O+ [cb${patientBloodType === 'O-' ? 'c' : ''}] O- [cb${patientBloodType === 'AB+' ? 'c' : ''}] AB+ [cb${patientBloodType === 'AB-' ? 'c' : ''}] AB-
[tr][td] Known Allergies: [/td][td] ${patientAllergies}
[tr][td] Current Medications: [/td][td] ${patientCurrentMedicine}
[tr][td] Chronic Conditions: [/td][td] ${patientChronicDiseases}
[tr][td] Traumas & Injuries: [/td][td] ${patientNotes}
[/table][/altspoiler]`;
    }

    if (UpdateMedicalFile?.includes('MentalHealth')) {
        bbCode += `[cbc][color=#FF0000]>[/color] [bold] Mental History[/bold]
        [altspoiler=New Mental Health History]
[table][tr][td] Diagnosed Mental Health Conditions: [/td][td] ${patientMental}
[tr][td] Therapies & Counseling: [/td][td] ${patientTherapy}
[tr][td] Triggers or Sensors: [/td][td] ${patientTriggers}
[tr][td] Support & Coping Systems: [/td][td] ${patientSupport}
[tr][td] Self-Harm History or Tendencies: [/td][td] ${patientHarm}
[/table][/altspoiler]`;
    }

    if (UpdateMedicalFile?.includes('FamilyMedicalHistory')) {
        bbCode += `[cbc][color=#FF0000]>[/color] [bold] Family Medical History[/bold]
        [altspoiler=New Family Medical  History]
[table][tr][td][b][size=105]Past History[/size][/b][color=transparent]youarecool[/color][/td][td][color=transparent]ifyoureadthisyouareawesomebutdontdeletemeplease![/color]
[tr][td] Immediate Family Members: [/td][td] ${patientFam}
[tr][td] Known Genetic Conditions: [/td][td] ${patientGenetic}
[tr][td] Family Social History: [/td][td] ${patientFamSocial}
[/table][/altspoiler]`;
    }

    if (UpdateMedicalFile?.includes('SocialInformation')) {
        bbCode += `[cbc][color=#FF0000]>[/color] [bold]Social Information[/bold]
        [altspoiler=New Social Information]
[table][tr][td] Marital Status: [cb${formData.maritalStatus === 'Single' ? 'c' : ''}] Single [cb${formData.maritalStatus === 'Married' ? 'c' : ''}] Married [cb${formData.maritalStatus === 'Divorced' ? 'c' : ''}] Divorced/Widowed [/td][td] Number of Children: [cb${formData.numberChildren === '0' ? 'c' : ''}] 0 [cb${formData.numberChildren === '1' ? 'c' : ''}] 1 or more
[tr][td] Cultural and/or Religious Considerations: ${patientReligion} [/td][td] Financial Status: [cb${formData.financialStatus === 'LowIncome' ? 'c' : ''}] Low Income [cb${formData.financialStatus === 'MiddleIncome' ? 'c' : ''}] Average Income [cb${formData.financialStatus === 'HighIncome' ? 'c' : ''}] High Income
[/table][/altspoiler]`;
    }

    if (UpdateMedicalFile?.includes('LifestyleInformation')) {
        bbCode += `[cbc][color=#FF0000]>[/color] [bold] Lifestyle Information[/bold]
        [altspoiler=New Lifestyle Information]
[table][tr][td] Smoking Status: ${patientSmoker} [/td][td] Alcohol Use: ${patientAlcohol}[/td][td] Other Substances: ${patientDrugs}
[tr][td] Exercise Habits: ${patientExercise}[/td][td] Dietary Information: ${patientDiet}[/td][td] Sleep Patterns: ${patientSleep}
[tr][td] Sexual Health: ${patientSexLife}[/td][td] Occupational Hazards: ${patientJobRisks}[/td][td] Environmental Hazards: ${patientHazards}[/table]
[table][tr][td] Other Information & Preferences: ${patientOther}
[/table][/altspoiler]`;
    }

    if (UpdateMedicalFile?.includes('AdvancedDirectives')) {
        bbCode += `[cbc][color=#FF0000]>[/color] [bold] Advanced Directives [/bold]
        [altspoiler=New Advanced Directives]
[divbox=transparent][list=none]I, ${patientName}, hereby provide the following advance directives regarding my healthcare, to be followed in the event that I become unable to make decisions about my medical treatment:

[list=1][*] [size=110]Living Will[/size]: In the event I am unable to communicate, I direct the following regarding life-sustaining treatments:
[cb${formData.dnr === 'ProlongLife' ? 'c' : ''}][/cb${formData.dnr === 'ProlongLife' ? 'c' : ''}]I want all available measures taken to prolong my life.
[cb${formData.dnr === 'ComfortOfLife' ? 'c' : ''}][/cb${formData.dnr === 'ComfortOfLife' ? 'c' : ''}]I want only treatments focused on comfort and quality of life, even if it means not prolonging life.
[cb${formData.dnr === 'other' ? 'c' : ''}][/cb${formData.dnr === 'other' ? 'c' : ''}]Other instructions: ${dnrOther}

[*][size=110]Healthcare Power of Attorney[/size]:
[cb${formData.attorney === 'Yes' ? 'c' : ''}][/cb${formData.attorney === 'Yes' ? 'c' : ''}]have appointed the following person as my Healthcare Proxy/Agent to make medical decisions on my behalf:
[list=none]Full Name: ${attorneyName}
Relationship to Patient: ${attorneyRelation}
Phone Number: ${attorneyPH}[/list]

[cb${formData.attorney === 'No' ? 'c' : ''}][/cb${formData.attorney === 'No' ? 'c' : ''}]I have not appointed a Healthcare Proxy/Agent at this time.
[*] [size=110]Do Not Resuscitate (DNR) Order[/size]:
[cb${formData.dnrOrder === 'Yes' ? 'c' : ''}][/cb${formData.dnrOrder === 'Yes' ? 'c' : ''}]I have a DNR order in place, instructing medical staff not to perform CPR or other life-saving measures if my heart stops.
[cb${formData.dnrOrder === 'No' ? 'c' : ''}][/cb${formData.dnrOrder === 'No' ? 'c' : ''}]I do not have a DNR order in place at this time.

[*][size=110]Consent to Share Advance Directives[/size]:
I authorize Pillbox Hill Medical Center to keep a copy of my advance directives in my medical record and to share this information with medical staff and emergency personnel as needed to ensure my healthcare wishes are respected.[/list]
I understand that I may revise or revoke these directives at any time by providing written notice.

Signature: [i][u]${patientName}[/u][/i]
Date: ${date}[/divbox][/altspoiler]`;
    }

    bbCode += `
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Disclaimer[/b][/color][/size][/center][/divboxcolor]
[divbox=transparent][list=none]I, ${patientName}, hereby declare that the information provided in this medical history form is true, accurate, and complete to the best of my knowledge. I understand that this information will be stored securely within the systems of Pillbox Hill Medical Center and may be accessed by authorized healthcare professionals involved in my care.

I, ${patientName}, upon submitting this form, consent to the sharing of my medical information among healthcare professionals within Pillbox Hill Medical Center for the purpose of providing comprehensive and coordinated healthcare services. I acknowledge that this information may be used for diagnosis, treatment, and other healthcare-related activities in accordance with applicable laws and regulations, including the Health Insurance Portability and Accountability Act (HIPAA).

I, ${patientName}, retain the right to revoke this consent at any time by notifying Pillbox Hill Medical Center in writing. However, I also understand that revoking consent may limit the ability of healthcare professionals to provide me with optimal and coordinated care.[/list][/divbox]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Payment[/b][/color][/size][/center][/divboxcolor]
[table][tr][td] Please attach an unedited confirmation of your payment, unless you are exempt. [size=70](see question 14 in the FAQ thread on how to pay)[/size][/td][td]
${scenePhotos ? `[url=${scenePhotos}]Proof Of Payment [/url]` : 'No proof of payment provided'}
[/table]`;

    return bbCode;
};

export default generateMedicalFileUpdate;
