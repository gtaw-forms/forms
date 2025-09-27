const generateEmailPHMCEmail = (formData) => {
    const {
        scenePhotos,
        decedentName,
        patientNotes,
        synopsis,
        phmcEmployee,
        decedentOOC,
        patientCareer,
    } = formData;
    const scenePhotosBBCode = (scenePhotos || '').split(',').map(photo => `[img]${photo.trim()}[/img]`).join('\n');

    let bbCode = `[divbox=na][br][/br][imageleft]https://i.imgur.com/dkdFQtg.png[/imageleft] [b][size=110]Pillbox Hill Medical Center[/size][/b] 
[center][/center][br][/br]
[center][size=130][/center][/size]
[center][size=150][b]RE: ${patientNotes} [/b][/size][/center]

[hr][/hr][br][/br][list=none]
Dear ${decedentName},

${synopsis}


Respectfully submitted,
${scenePhotosBBCode} 
[/list][hr][/hr][list=none]
[b][size=105]${phmcEmployee}[/size][/b]
[size=85]${decedentOOC}
${patientCareer}
[/size]

[b]Pillbox Hill Medical Center[/b]
[size=85]Elgin Avenue/Strawberry Avenue, Pillbox Hill, Los Santos, SA
Phone: 50056
Mail: [url=https://phmc.gta.world/ucp.php?i=pm&mode=compose&g=40]info@phmc.health[/url]
Website: [url=https://phmc.gta.world/index.php]www.phmc.health[/url]

Follow us on Facebrowser: [url=https://face.gta.world/pages/PHMC?ref=qs]Pillbox Hill Medical Center[/url][/size]

[size=70][i]The contents of this message and any attachments are confidential. They are intended for the named recipient(s) only.  If you have received this email by mistake, please notify the sender immediately and do not disclose the contents to anyone or make copies thereof.[/i][/size][/divbox] 
`
    return bbCode;
    };
export default generateEmailPHMCEmail;