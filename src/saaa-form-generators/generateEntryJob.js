
const generateEmail = (formData) => {
    const {
        requestingOfficer,
        department,
        coronerEmployee,
        coronerRank,
        coronerDiscord,
        coronerPHNumber,
        deathReport,
        additionalReports,
    } = formData;

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
Title: patientTitle
Firstname: patientFirstname
Lastname: patientLastname
Contact Number: patientContactNumber
Date of Birth: patientDOB
Place of Birth: patientBirth
[/divbox]

[divbox=#FFFFFF][b]2. [color=#107fc0]HEALTH INFORMATION[/color][/b][/divbox]

[divbox=#FFFFFF]
Do you have, or have you ever been diagnosed with any visual or hearing impairment(s), cardiovascular issue(s), color blindness or speech disorder(s)?
Answer

Do you have, or have you ever been diagnosed with any health issues that may impede your ability to stand for long periods of time?
Answer
[/divbox]

[divbox=#FFFFFF][b]3. [color=#107fc0]EDUCATIONAL INFORMATION[/color][/b][/divbox]

[divbox=#FFFFFF]
High School - Name:
Answer

High School - Year of Graduation:
Answer

College/University - Name:
Answer

College/University - Year of Graduation:
Answer

College/University - Qualification/Degree:
Answer

[/divbox]

[divbox=#FFFFFF][b]4. [color=#107fc0]EMPLOYMENT INFORMATION[/color][/b][/divbox]

[divbox=#FFFFFF]
Have you ever worked for any Government Agency before?
Answer

Previous Employers: 
Employer Name: Answer
Period of Employment: DD/MM/YY - DD/MM/YY
Rank or Position: Answer
Reason for leaving: Answer

Previous Employers: 
Employer Name: Answer
Period of Employment: DD/MM/YY - DD/MM/YY
Rank or Position: Answer
Reason for leaving: Answer

[/divbox]

[divbox=#FFFFFF][b]5. [color=#107fc0]LICENSES, PERMITS & CITIZENSHIP[/color][/b][/divbox]

[divbox=#FFFFFF]
Do you possess a valid United States of America citizenship?
Answer

Do you possess a valid Pilot License? (a pilot license is not required to apply, except for the position of Flight Instructor / Safety Investigator)
Answer

[/divbox]

[divbox=#FFFFFF][b]6. [color=#107fc0](( OUT OF CHARACTER ))[/color][/b][/divbox]

[divbox=#FFFFFF]
UCP name:
Answer

Discord:
Answer

Forum name:
Answer

Timezone:
Answer

How long have you been playing on GTA World?
Answer

Are you able to communicate effectively in English?
Answer

Are you currently a member of any other official faction on any of your characters? If yes, post a screenshot of the double faction permission in your answer below.


Are you currently banned from any faction? If yes, please elaborate.
Answer

Please list all of your characters below, excluding the one you are applying with:
Answer

Post a clear, unedited screenshot of your admin record:
LINK

Post a clear, unedited screenshot of your ingame stats:
LINK


Write a brief background of your character:
Answer

[/divbox]

[divbox=#FFFFFF][b]7. [color=#107fc0]ACKNOWLEDGEMENT & AUTHORIZATION[/color][/b][/divbox]

[divbox=#FFFFFF]
By submitting this application, I, Firstname, Lastname, hereby certify that all questions contained in this document were met with truthful statements. I fully authorize the investigation of any content shared on this document. I am aware that lying, omitting, plagiarizing, or maliciously adulterating this application will result in immediate denial and an indefinite ban from applying for future job vacancies.
[/divbox]`;

    return bbCode;
};

export default generateEmail;