const generateAgencyFeedback = (formData) => {
    const {
        coronerRank,
        coronerEmployee,
        placeOfDeath,
        department,
        dateTime,
        decedentName,
        synopsis,
        scenePhotos,
    } = formData;

    const scenePhotosBBCode = scenePhotos.split(',').map(photo => `[img]${photo.trim()}[/img]`).join('\n');

    let bbCode = `[divbox=transparent][center][img]https://i.imgur.com/Hxjt4M2.png[/img] [/center]
[hr][/hr][color=#5597D0][right]
[U][SIZE=80][/SIZE][/U][/RIGHT][/COLOR]
[CENTER][B]DEPARTMENT OF PATHOLOGY AND FORENSIC MEDICINE 
AGENCY INCIDENT REPORT[/B][/CENTER]
[HR][/HR]
[b]EMPLOYEE DETAILS[/b]
[divbox=transparent][b]Name:[/b] ${coronerEmployee}
[HR][/HR]
[b]RANK:[/b] ${coronerRank}
[/DIVBOX]
[b]DESCRIPTION OF INCIDENT[/b]
[divbox=transparent][b]DATE OF INCIDENT:[/b] ${dateTime}
[HR][/HR]
[b]LOCATION OF INCIDENT:[/b] ${placeOfDeath}
[HR][/HR]
[b]INCIDENT DETAILS[/b]
[i][color=#0080FF](How the incident happened, factors leading to the event, and what took place. Be as specific as possible.)[/color][/i][DIVBOX=transparent] ${synopsis}[/DIVBOX]
[HR][/HR]
[b]DEPARTMENT INVOLVED[/B]
${department}
[b]NAME / ROLE / CONTACT OF PARTIES INVOLVED[/b]
${decedentName}
[HR][/HR]
[/DIVBOX]
[b]PHOTO OF INCIDENT (IF POSSIBLE)[/b]
[divbox=transparent] ${scenePhotosBBCode}`

    return bbCode;
};
export default generateAgencyFeedback;