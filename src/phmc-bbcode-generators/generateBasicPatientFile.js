const generateBasicPatientFile = (formData) => {
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
        patientDateOfBirth  ,
        patientID,
    } = formData;
    const scenePhotosBBCode = paymentProofPhotos.split(',').map(photo => `[img]${photo.trim()}[/img]`).join('\n');

    let bbCode = `[table][tr][td][center][br][/br][br][/br][b]Patient Information[/b]

[size=110]PATIENT ${patientID}

${patientName}
[/size]

[/center][td][center][img]https://i.imgur.com/QMaz0OC.png[/img][img]https://i.imgur.com/LkRKav2.png[/img]
[b][size=150]BASIC PATIENT INFORMATION[/size][/center][/table]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]General Information[/b][/color][/size][/center][/divboxcolor]
[table][tr][td] Title: ${patientTitle}[/td][td] Full Name: ${patientName}
[tr][td] Date of Birth: ${patientDateOfBirth}  [/td][td] Home Address: ${patientAddress}
[tr][td] Gender Identity: ${patientGender} [/td][td] Ethnicity: ${patientRace}
[tr][td] Phone Number: ${patientPH} [/td][td] (( Discord ID: ${patientDiscord}))
[/table]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Emergency Contact[/b][/color][/size][/center][/divboxcolor]
[table][tr][td] Full Name: ${patientEmergencyContact} [/td][td] Relationship: ${patientEmergencyContactRelation}
[tr][td] Phone Number: ${patientEmergencyContactNumber} [/td][td] (( Discord ID: ${patientEmergencyContactDiscord}))
[/table]
[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Medical History[/b][/color][/size][/center][/divboxcolor]
[table][tr][td][b][size=105]Past History[/size][/b][color=transparent]youarecool[/color][/td][td][color=transparent]ifyoureadthisyouareawesomebutdontdeletemeplease![/color]
[tr][td] Blood Type: [/td][td] [cb${formData.patientBloodType === 'A+' ? 'c' : ''}] A+ [cb${formData.patientBloodType === 'A-' ? 'c' : ''}] A- [cb${formData.patientBloodType === 'B+' ? 'c' : ''}] B+ [cb${formData.patientBloodType === 'B-' ? 'c' : ''}] B- [cb${formData.patientBloodType === 'O+' ? 'c' : ''}] O+ [cb${formData.patientBloodType === 'O-' ? 'c' : ''}] O- [cb${formData.patientBloodType === 'AB+' ? 'c' : ''}] AB+ [cb${formData.patientBloodType === 'AB-' ? 'c' : ''}] AB-
[tr][td] Known Allergies: [/td][td] ${patientAllergies}
[tr][td] Current Medications: [/td][td] ${patientCurrentMedicine}
[tr][td] Chronic Conditions: [/td][td] ${patientChronicDiseases}
[tr][td] Traumas & Injuries: [/td][td] ${patientNotes}
[/table] 

[divboxcolor=black][center][size=115][color=#FF0000]>[/color] [color=#FFFFFF][b]Payment[/b][/color][/size][/center][/divboxcolor]
[table][tr][td] Please attach an unedited confirmation of your payment, unless you are exempt. [size=70](see question 14 in the FAQ thread on how to pay)[/size][/td][td]
[url=${paymentProofPhotos}]Proof Of Payment [/url]
[/table]

`
    return bbCode;
    };
export default generateBasicPatientFile;