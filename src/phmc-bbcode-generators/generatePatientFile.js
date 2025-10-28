const generatePatientFile = (formData) => {
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
        paymentProofPhotos,
        patientDateOfBirth,
        patientID,
        formType, // 'basic' or 'advanced'
        // Advanced fields
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
        date,
    } = formData;

    // Payment/Exempt logic
    let paymentSection = '';
    if (formData.isExempt === true || formData.isExempt === 'true') {
        paymentSection = 'I am exempt from paying this service in accordance with the PHMC policies.';
    } else if (paymentProofPhotos) {
        paymentSection = `[url=${paymentProofPhotos}]Proof Of Payment [/url]`;
    }

    const basicBBCode = `[table][tr][td][center][br][/br][br][/br][b]Patient Information[/b]\n\n[size=110]PATIENT ${patientID}\n\n${patientName}\n[/size]\n\n[/center][td][center][img]https://i.ibb.co/0pgw9hHm/phmc.png[/img][img]https://i.ibb.co/fdGgxDH1/LkRKav2.png[/img]\n[b][size=150]BASIC PATIENT INFORMATION[/size][/center][/table]\n[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]General Information[/b][/color][/size][/center][/divboxcolor]\n[table][tr][td] Title: ${patientTitle}[/td][td] Full Name: ${patientName}\n[tr][td] Date of Birth: ${patientDateOfBirth}  [/td][td] Home Address: ${patientAddress}\n[tr][td] Gender Identity: ${patientGender} [/td][td] Ethnicity: ${patientRace}\n[tr][td] Phone Number: ${patientPH} [/td][td] (( Discord ID: ${patientDiscord}))\n[/table]\n[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Emergency Contact[/b][/color][/size][/center][/divboxcolor]\n[table][tr][td] Full Name: ${patientEmergencyContact} [/td][td] Relationship: ${patientEmergencyContactRelation}\n[tr][td] Phone Number: ${patientEmergencyContactNumber} [/td][td] (( Discord ID: ${patientEmergencyContactDiscord}))\n[/table]\n[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Medical History[/b][/color][/size][/center][/divboxcolor]\n[table][tr][td][b][size=105]Past History[/size][/b][color=transparent]youarecool[/color][/td][td][color=transparent]ifyoureadthisyouareawesomebutdontdeletemeplease![/color]\n[tr][td] Blood Type: [/td][td] [cb${formData.patientBloodType === 'A+' ? 'c' : ''}] A+ [cb${formData.patientBloodType === 'A-' ? 'c' : ''}] A- [cb${formData.patientBloodType === 'B+' ? 'c' : ''}] B+ [cb${formData.patientBloodType === 'B-' ? 'c' : ''}] B- [cb${formData.patientBloodType === 'O+' ? 'c' : ''}] O+ [cb${formData.patientBloodType === 'O-' ? 'c' : ''}] O- [cb${formData.patientBloodType === 'AB+' ? 'c' : ''}] AB+ [cb${formData.patientBloodType === 'AB-' ? 'c' : ''}] AB-\n[tr][td] Known Allergies: [/td][td] ${patientAllergies}\n[tr][td] Current Medications: [/td][td] ${patientCurrentMedicine}\n[tr][td] Chronic Conditions: [/td][td] ${patientChronicDiseases}\n[tr][td] Traumas & Injuries: [/td][td] ${patientNotes}\n[/table] \n\n[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Payment[/b][/color][/size][/center][/divboxcolor]\n[table][tr][td] Please attach an unedited confirmation of your payment, unless you are exempt. [size=70](see question 14 in the FAQ thread on how to pay)[/size][/td][td]\n    ${paymentSection}\n[/table]\n\n`;

    const advancedBBCode = `[table][tr][td][center][br][/br][br][/br][b]Patient Information[/b]\n\n[size=110]PATIENT ${patientID}\n\n${patientName}\n[/size]\n\n[/center][td][center][img]https://i.ibb.co/0pgw9hHm/phmc.png[/img][img]https://i.ibb.co/fdGgxDH1/LkRKav2.png[/img]\n[b][size=150]ADVANCED PATIENT INFORMATION[/size][/center][/table]\n[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]General Information[/b][/color][/size][/center][/divboxcolor]\n[table][tr][td] Title: ${patientTitle}[/td][td] Full Name: ${patientName}\n[tr][td] Date of Birth: ${patientDateOfBirth} [/td][td] Home Address: ${patientAddress}\n[tr][td] Gender Identity: ${patientGender} [/td][td] Ethnicity: ${patientRace}\n[tr][td] Phone Number: ${patientPH} [/td][td] (( Discord ID: ${patientDiscord}))\n[/table]\n    [divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Emergency Contact[/b][/color][/size][/center][/divboxcolor]\n    [table][tr][td] Full Name: ${patientEmergencyContact} [/td][td] Relationship: ${patientEmergencyContactRelation}\n    [tr][td] Phone Number: ${patientEmergencyContactNumber} [/td][td] (( Discord ID: ${patientEmergencyContactDiscord}))\n[/table]\n[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Medical History[/b][/color][/size][/center][/divboxcolor]\n[table][tr][td][b][size=105]Past History[/size][/b][color=transparent]youarecool[/color][/td][td][color=transparent]ifyoureadthisyouareawesomebutdontdeletemeplease![/color]\n[tr][td] Blood Type: [/td][td] [cb${formData.patientBloodType === 'A+' ? 'c' : ''}] A+ [cb${formData.patientBloodType === 'A-' ? 'c' : ''}] A- [cb${formData.patientBloodType === 'B+' ? 'c' : ''}] B+ [cb${formData.patientBloodType === 'B-' ? 'c' : ''}] B- [cb${formData.patientBloodType === 'O+' ? 'c' : ''}] O+ [cb${formData.patientBloodType === 'O-' ? 'c' : ''}] O- [cb${formData.patientBloodType === 'AB+' ? 'c' : ''}] AB+ [cb${formData.patientBloodType === 'AB-' ? 'c' : ''}] AB-\n[tr][td] Known Allergies: [/td][td] ${patientAllergies}\n[tr][td] Current Medications: [/td][td] ${patientCurrentMedicine}\n[tr][td] Chronic Conditions: [/td][td] ${patientChronicDiseases}\n[tr][td] Traumas & Injuries: [/td][td] ${patientNotes}\n[/table]\n[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Mental Health History[/b][/color][/size][/center][/divboxcolor]\n[table][tr][td][b][size=105]Past History[/size][/b][color=transparent]youarecool[/color][/td][td][color=transparent]ifyoureadthisyouareawesomebutdontdeletemeplease![/color]\n[tr][td] Diagnosed Mental Health Conditions: [/td][td] ${patientMental}\n[tr][td] Therapies & Counseling: [/td][td] ${patientTherapy}\n[tr][td] Triggers or Sensors: [/td][td] ${patientTriggers}\n[tr][td] Support & Coping Systems: [/td][td] ${patientSupport}\n[tr][td] Self-Harm History or Tendencies: [/td][td] ${patientHarm}\n[/table]\n[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Family Medical History[/b][/color][/size][/center][/divboxcolor]\n[table][tr][td][b][size=105]Past History[/size][/b][color=transparent]youarecool[/color][/td][td][color=transparent]ifyoureadthisyouareawesomebutdontdeletemeplease![/color]\n[tr][td] Immediate Family Members: [/td][td] ${patientFam}\n[tr][td] Known Genetic Conditions: [/td][td] ${patientGenetic}\n[tr][td] Family Social History: [/td][td] ${patientFamSocial}\n[/table]\n[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Social Information[/b][/color][/size][/center][/divboxcolor]\n[table][tr][td] Marital Status: [cb${formData.maritalStatus === 'Single' ? 'c' : ''}] Single [cb${formData.maritalStatus === 'Married' ? 'c' : ''}] Married [cb${formData.maritalStatus === 'Divorced' ? 'c' : ''}] Divorced/Widowed [/td][td] Number of Children: [cb${formData.numberChildren === '0' ? 'c' : ''}] 0 [cb${formData.numberChildren === '1' ? 'c' : ''}] 1 or more\n[tr][td] Cultural and/or Religious Considerations: ${patientReligion} [/td][td] Financial Status: [cb${formData.financialStatus === 'LowIncome' ? 'c' : ''}] Low Income [cb${formData.financialStatus === 'MiddleIncome' ? 'c' : ''}] Average Income [cb${formData.financialStatus === 'HighIncome' ? 'c' : ''}] High Income\n[/table]\n[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Lifestyle Information[/b][/color][/size][/center][/divboxcolor]\n[table][tr][td] Smoking Status: ${patientSmoker} [/td][td] Alcohol Use: ${patientAlcohol}[/td][td] Other Substances: ${patientDrugs}\n[tr][td] Exercise Habits: ${patientExercise}[/td][td] Dietary Information: ${patientDiet}[/td][td] Sleep Patterns: ${patientSleep}\n[tr][td] Sexual Health: ${patientSexLife}[/td][td] Occupational Hazards: ${patientJobRisks}[/td][td] Environmental Hazards: ${patientHazards}[/table]\n[table][tr][td] Other Information & Preferences: ${patientOther}\n[/table]\n[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Advanced Directives[/b][/color][/size][/center][/divboxcolor]\n[divbox=transparent][list=none]I, ${patientName}, hereby provide the following advance directives regarding my healthcare, to be followed in the event that I become unable to make decisions about my medical treatment.\n\n[list=1][*] [size=110]Living Will[/size]: In the event I am unable to communicate, I direct the following regarding life-sustaining treatments:\n[cb${formData.dnr === 'ProlongLife' ? 'c' : ''}][/cb${formData.dnr === 'ProlongLife' ? 'c' : ''}]I want all available measures taken to prolong my life.\n[cb${formData.dnr === 'ComfortOfLife' ? 'c' : ''}][/cb${formData.dnr === 'ComfortOfLife' ? 'c' : ''}]I want only treatments focused on comfort and quality of life, even if it means not prolonging life.\n[cb${formData.dnr === 'other' ? 'c' : ''}][/cb${formData.dnr === 'other' ? 'c' : ''}]Other instructions: ${dnrOther}\n\n[*][size=110]Healthcare Power of Attorney[/size]:\n[cb${formData.attorney === 'Yes' ? 'c' : ''}][/cb${formData.attorney === 'Yes' ? 'c' : ''}]have appointed the following person as my Healthcare Proxy/Agent to make medical decisions on my behalf:\n[list=none]Full Name: ${attorneyName}\nRelationship to Patient: ${attorneyRelation}\nPhone Number: ${attorneyPH}[/list]\n\n[cb${formData.attorney === 'No' ? 'c' : ''}][/cb${formData.attorney === 'No' ? 'c' : ''}]I have not appointed a Healthcare Proxy/Agent at this time.\n[*] [size=110]Do Not Resuscitate (DNR) Order[/size]:\n[cb${formData.dnrOrder === 'Yes' ? 'c' : ''}][/cb${formData.dnrOrder === 'Yes' ? 'c' : ''}]I have a DNR order in place, instructing medical staff not to perform CPR or other life-saving measures if my heart stops.\n[cb${formData.dnrOrder === 'No' ? 'c' : ''}][/cb${formData.dnrOrder === 'No' ? 'c' : ''}]I do not have a DNR order in place at this time.\n\n[*] [size=110]Consent to Share Advance Directives[/size]:\nI authorize Pillbox Hill Medical Center to keep a copy of my advance directives in my medical record and to share this information with medical staff and emergency personnel as needed to ensure my healthcare wishes are respected.[/list]\nI understand that I may revise or revoke these directives at any time by providing written notice.\n\nSignature: [i][u]${patientName}[/u][/i]\nDate: ${date}[/divbox]\n[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Disclaimer[/b][/color][/size][/center][/divboxcolor]\n[divbox=transparent][list=none]I, ${patientName}, hereby declare that the information provided in this medical history form is true, accurate, and complete to the best of my knowledge. I understand that this information will be stored securely within the systems of Pillbox Hill Medical Center and may be accessed by authorized healthcare professionals involved in my care.\n\nI, ${patientName}, upon submitting this form, consent to the sharing of my medical information among healthcare professionals within Pillbox Hill Medical Center for the purpose of providing comprehensive and coordinated healthcare services. I acknowledge that this information may be used for diagnosis, treatment, and other healthcare-related activities in accordance with applicable laws and regulations, including the Health Insurance Portability and Accountability Act (HIPAA).\n\nI, ${patientName}, retain the right to revoke this consent at any time by notifying Pillbox Hill Medical Center in writing. However, I also understand that revoking consent may limit the ability of healthcare professionals to provide me with optimal and coordinated care.[/list][/divbox]\n    [divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Payment[/b][/color][/size][/center][/divboxcolor]\n    [table][tr][td] Please attach an unedited confirmation of your payment, unless you are exempt. [size=70](see question 14 in the FAQ thread on how to pay)[/size][/td][td]\n    ${paymentSection}\n    [/table]`;

    if (formType === 'advanced') {
        return advancedBBCode;
    }
    return basicBBCode;
};

export default generatePatientFile;
