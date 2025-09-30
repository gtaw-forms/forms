const generateCertificate = (formData) => {
    const {
        scenePhotos,
        decedentName,
        patientAge,
        probableCauseOfDeath,
        patientDateOfBirth,
        dateofdeath,
        TimeofDeath,
        witnessName,
        coronerEmployee,
        date,
    } = formData;
    const scenePhotosBBCode = (scenePhotos || '').split(',').map(photo => `[img]${photo.trim()}[/img]`).join('\n');

    let bbCode = `[divbox=#E8E8E8][br][/br][center][img]https://i.ibb.co/0pgw9hHm/phmc.png[/img][/center][br][/br]


[hr][/hr]
[center][size=125][b]DEPARTMENT OF PATHOLOGY AND FORENSIC MEDICINE ISSUED
CERTIFICATE OF DEATH[/center][/b][/size]
[hr][/hr][br]

[center]I, [b]${coronerEmployee}[/b], on behalf of the Department of Pathology and Forensic Medicine of Pillbox Hill Medical Center, in the State of San Andreas, document, record, seal and hereby certify the death of [b]${decedentName}[/b]. I confirm the following information is factual to the best of my abilities:[/center][br][/br]

[table][tr][td]NAME[/td][td]
${decedentName || 'INSERT DECEDENT NAME HERE'}

[tr][td]AGE[/td][td]
${patientAge}	

[tr][td]DATE OF BIRTH[/td][td]
${patientDateOfBirth || 'INSERT DATE OF BIRTH HERE'}	

[tr][td]CAUSE OF DEATH[/td][td]
${probableCauseOfDeath || 'INSERT CAUSE OF DEATH HERE'}	

[tr][td]TIME OF DEATH[/td][td]
${TimeofDeath || 'INSERT TIME OF DEATH HERE'}	

[tr][td]DATE OF DEATH[/td][td]
${dateofdeath || 'INSERT DATE OF DEATH HERE'}	
[/table][br][/br]
[list=none][left]
SIGNATURE OF MEDICAL-EXAMINER:
PRINT NAME: Dr. Anne Carter

SIGNATURE OF WITNESS:
PRINT NAME: ${witnessName || 'INSERT WITNESS NAME HERE'}

DATE CERTIFICATE ISSUED: ${date}
[/list]

[br][hr][/hr]
[center]Note: This is the master copy of the death certificate. Additional copies can be requested at an additional fee[/center][br][/br]`
    return bbCode;
    };
export default generateCertificate;