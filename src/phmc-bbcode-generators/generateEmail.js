
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
        agencyDataStore, // Added agencyDataStore
    } = formData;

    const getDepartmentFullName = (shortCode) => {
        if (agencyDataStore && agencyDataStore[shortCode]) {
            return agencyDataStore[shortCode].fullName;
        }
        return shortCode; // fallback to shortcode
    };

    let bbCode = `[center][img]https://i.ibb.co/GfSHbMMj/ItaoQkO.webp[/img][/center]
[hr][/hr]

TO: ${requestingOfficer} - ${getDepartmentFullName(department)}
FROM: ${coronerEmployee} @ phmc.health
SUBJECT: Death Report Paperwork

For the attention of: [b]${getDepartmentFullName(department)}[/b] - [b]${requestingOfficer}[/b]

This Coroner Report has been written by ${coronerRank} ${coronerEmployee} you can find the enclosed documents attached to this email. 

[b]AUTOPSY INFORMATION / REQUEST(S)[/B] 
If you require an autopsy, please follow this link and follow the instructions: [url=https://phmc.gta.world/viewforum.php?f=265]Autopsy Portal[/url].


[altspoiler=Request a Autopsy FAQ]
1) How do I request an autopsy report and/or a death certificate?
Autopsies and death certificates can aid in various situations, especially whenever the cause of death plays a vital role in. Our professionals attempt to handle each and every request in a timely manner. However, given the fact that the effort of documentation is immense, a request fee is associated along with it. Upon its payment, the report or certificate will be sent to you directly.


2) Is there a fee associated with the request process?
Yes, there is a $2,000 fee associated with the request. This fee covers administrative costs related to processing and maintaining your requested report/certificate securely within our systems. It ensures the continued improvement of our services, maintaining the highest standards in healthcare data management.


3) How do I pay the $2,000 request fee?
To pay your $2,000 request fee, please log into the banking website and navigate to the "Payment" section. Select your preferred payment method (e.g., credit card, debit card), insert our routing number (020000062), enter the required payment details, review the transaction, and confirm your payment. (( Type /transfer 2000 020000062 ))

(( Autopsies for Player Kills (PK) and Character Kills (CK) will only be accepted if they are deemed strictly necessary and relevant to an important case or investigation. Prior to making a request for such an autopsy, a member of the Medical-Examiners must be notified and consulted with. Furthermore, it is mandatory to provide information about /cdamages and /cexamine. In the event that this information is not available, please do not hesitate to contact an administrator in-game, who can provide it. If these steps are not followed, an automatic denial will cause your request to be archived.

Also if it is a PK, please be sure to use John/Jane Doe with their character name in OOC brackets . Ex: John Doe (( James Smith ))

[url=https://phmc.gta.world/ucp.php?i=pm&mode=compose&g=50]Click here to contact a Medical-Examiner to get the green light![/url] ))
[/altspoiler]
If you have further enquiries, feel free to reach out to the following individual:
[list] ${coronerEmployee}
[*] Phone Number: ${coronerPHNumber}
[*] (( Discord: ${coronerDiscord} ))[/list]

[altspoiler=Coroner Report]
${deathReport}
[code]
${deathReport}

[/code]
[/altspoiler]
${additionalReports && additionalReports.length > 0
            ? additionalReports
                .filter(report => report.trim())
                .map((report, index) => `
[altspoiler=Coroner Report - Additional ${index + 1}]
${report}
[code]
${report}
[/code]
[/altspoiler]`).join('\n\n')
            : ''
        }

Kind regards
${coronerRank} ${coronerEmployee}
Pillbox Hill Medical Center - Pathology  and Forensic Medicine

[size=75]The content of this email is intended for the person or entity to which it is addressed only. This email may contain confidential information. If you are not the person to whom this message is addressed, be aware that any use, reproduction, or distribution of this message is strictly prohibited. If you received this in error, please contact the sender and immediately delete this email and any attachments.[/size]`;

    return bbCode;
};

export default generateEmail;