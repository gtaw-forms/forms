// src/saaa-form-generators/generateEntryJob.js

const generateEntryJob = (formData) => {
    const {
        patientTitle = 'N/A',
        patientFirstName = 'N/A',
        patientLastName = 'N/A',
        patientContactNumber = 'N/A',
        patientDOB = 'N/A',
        patientBirth = 'N/A',
        healthImpairments = 'N/A',
        healthStandingIssues = 'N/A',
        eduHighSchoolName = 'N/A',
        eduHighSchoolYear = 'N/A',
        eduCollegeName = 'N/A',
        eduCollegeYear = 'N/A',
        eduCollegeDegree = 'N/A',
        empGovExperience = 'N/A',
        empPrev1Name = 'N/A',
        empPrev1Period = 'N/A',
        empPrev1Rank = 'N/A',
        empPrev1Reason = 'N/A',
        empPrev2Name = 'N/A',
        empPrev2Period = 'N/A',
        empPrev2Rank = 'N/A',
        empPrev2Reason = 'N/A',
        licCitizenship = 'N/A',
        licPilotLicense = 'N/A',
        oocUcpName = 'N/A',
        oocDiscord = 'N/A',
        oocForumName = 'N/A',
        oocTimezone = 'N/A',
        oocGtawPlaytime = 'N/A',
        oocEnglishProficiency = 'N/A',
        oocOtherFactionInfo = 'N/A',
        oocFactionBans = 'N/A',
        oocOtherCharacters = 'N/A',
        adminRecordLink = 'LINK_NOT_PROVIDED',
        inGameStatsLink = 'LINK_NOT_PROVIDED',
        charBackground = 'N/A',
        ackAuthorize = false,
    } = formData;

    const acknowledgementText = ackAuthorize
        ? `[X] By submitting this application, I, ${patientFirstName} ${patientLastName}, hereby certify that all questions contained in this document were met with truthful statements. I fully authorize the investigation of any content shared on this document. I am aware that lying, omitting, plagiarizing, or maliciously adulterating this application will result in immediate denial and an indefinite ban from applying for future job vacancies.`
        : `[ ] By submitting this application, I, ${patientFirstName} ${patientLastName}, hereby certify that all questions contained in this document were met with truthful statements. I fully authorize the investigation of any content shared on this document. I am aware that lying, omitting, plagiarizing, or maliciously adulterating this application will result in immediate denial and an indefinite ban from applying for future job vacancies. (NOT ACKNOWLEDGED)`;

    let bbCode = `[divbox=transparent]
[table]
[tr]
[td]
[saaa=150][/saaa][/td]

[td][align=left][color=#FFFFFF][b][font=arial][size=150]
ADMINISTRATIVE SERVICES DIVISION 

ENTRY LEVEL EMPLOYMENT[/size][/font]
[size=110][font=arial]
SAN ANDREAS AVIATION ADMINISTRATION

[/align][/td]
[/tr]
[/table]
[/divbox]


[divbox=#FFFFFF][b]1. [color=#107fc0]APPLICATION FORM[/color][/b][/divbox]
[divbox=#FFFFFF][b] [color=#107fc0]GENERAL INFORMATION[/color][/b][/divbox]

[divbox=#FFFFFF]
Title: ${patientTitle}
Firstname: ${patientFirstName}
Lastname: ${patientLastName}
Contact Number: ${patientContactNumber}
Date of Birth: ${patientDOB}
Place of Birth: ${patientBirth}
[/divbox]

[divbox=#FFFFFF][b]2. [color=#107fc0]HEALTH INFORMATION[/color][/b][/divbox]

[divbox=#FFFFFF]
Do you have, or have you ever been diagnosed with any visual or hearing impairment(s), cardiovascular issue(s), color blindness or speech disorder(s)?
${healthImpairments}

Do you have, or have you ever been diagnosed with any health issues that may impede your ability to stand for long periods of time?
${healthStandingIssues}
[/divbox]

[divbox=#FFFFFF][b]3. [color=#107fc0]EDUCATIONAL INFORMATION[/color][/b][/divbox]

[divbox=#FFFFFF]
High School - Name:
${eduHighSchoolName}

High School - Year of Graduation:
${eduHighSchoolYear}

College/University - Name:
${eduCollegeName}

College/University - Year of Graduation:
${eduCollegeYear}

College/University - Qualification/Degree:
${eduCollegeDegree}
[/divbox]

[divbox=#FFFFFF][b]4. [color=#107fc0]EMPLOYMENT INFORMATION[/color][/b][/divbox]

[divbox=#FFFFFF]
Have you ever worked for any Government Agency before?
${empGovExperience}

Previous Employers: 
Employer Name: ${empPrev1Name}
Period of Employment: ${empPrev1Period}
Rank or Position: ${empPrev1Rank}
Reason for leaving: ${empPrev1Reason}

Previous Employers: 
Employer Name: ${empPrev2Name}
Period of Employment: ${empPrev2Period}
Rank or Position: ${empPrev2Rank}
Reason for leaving: ${empPrev2Reason}
[/divbox]

[divbox=#FFFFFF][b]5. [color=#107fc0]LICENSES, PERMITS & CITIZENSHIP[/color][/b][/divbox]

[divbox=#FFFFFF]
Do you possess a valid United States of America citizenship?
${licCitizenship}

Do you possess a valid Pilot License? (a pilot license is not required to apply, except for the position of Flight Instructor / Safety Investigator)
${licPilotLicense}
[/divbox]

[divbox=#FFFFFF][b]6. color=#107fc0)[/color][/b][/divbox]

[divbox=#FFFFFF]
UCP name:
${oocUcpName}

Discord:
${oocDiscord}

Forum name:
${oocForumName}

Timezone:
${oocTimezone}

How long have you been playing on GTA World?
${oocGtawPlaytime}

Are you able to communicate effectively in English?
${oocEnglishProficiency}

Are you currently a member of any other official faction on any of your characters? If yes, post a screenshot of the double faction permission in your answer below.
${oocOtherFactionInfo}

Are you currently banned from any faction? If yes, please elaborate.
${oocFactionBans}

Please list all of your characters below, excluding the one you are applying with:
${oocOtherCharacters}

Post a clear, unedited screenshot of your admin record:
${adminRecordLink}

Post a clear, unedited screenshot of your ingame stats:
${inGameStatsLink}

Write a brief background of your character:
${charBackground}
[/divbox]

[divbox=#FFFFFF][b]7. [color=#107fc0]ACKNOWLEDGEMENT & AUTHORIZATION[/color][/b][/divbox]

[divbox=#FFFFFF]
${acknowledgementText}
[/divbox]`;

    return bbCode;
};

export default generateEntryJob;
