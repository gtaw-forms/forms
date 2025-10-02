const generateDeathRecord = (formData) => {
    const {
        caseNumber,
        caseStatus,
        bodyStatus,
        sex,
        ethnicity,
        placeOfDeath,
        manner,
        coronerEmployee,
        chiefMedicalExaminer,
        causeA,
        causeB,
        causeC,
        causeD,
        otherSignificantConditions,
        deathRecordType,
        hairColor,
        eyeColor,
        weight,
        height,
        tattoos,
        jewelry,
        comments,
        decedentName,
        dateOfDeath,
        age,
        deathReportPostId,
    } = formData;


    let detailsBlock;
    if (deathRecordType === 'Unidentified') {
        detailsBlock = `[table]
[tr]
[td bgcolor=#E6E6E6][bold]Hair Color[/bold]: ${hairColor || 'N/A'}[/td]
[td bgcolor=#E6E6E6][bold]Eye Color[/bold]: ${eyeColor || 'N/A'}[/td]
[/tr]
[tr]
[td bgcolor=#E6E6E6][bold]Weight[/bold]: ${weight || 'N/A'}[/td]
[td bgcolor=#E6E6E6][bold]Height[/bold]: ${height || 'N/A'}[/td]
[/tr]
[tr]
[td bgcolor=#E6E6E6][bold]Tattoos[/bold]: ${tattoos || 'None'}[/td]
[td bgcolor=#E6E6E6][bold]Jewelry[/bold]: ${jewelry || 'None'}[/td]
[/tr]
[tr]
[td bgcolor=#E6E6E6][bold]Comments[/bold]: ${comments || 'None'}[/td]
[/tr]
[/table]`;
    } else {
        detailsBlock = `[table]
[tr]
[td bgcolor=#E6E6E6][bold]Cause A[/bold]: ${causeA || ''}[/td]
[td bgcolor=#E6E6E6][bold]Cause B[/bold]: ${causeB || ''}[/td]
[/tr]
[tr]
[td bgcolor=#E6E6E6][bold]Cause C[/bold]: ${causeC || ''}[/td]
[td bgcolor=#E6E6E6][bold]Cause D[/bold]: ${causeD || ''}[/td]
[/tr]
[tr]
[td bgcolor=#E6E6E6][bold]Other Significant Conditions[/bold]: ${otherSignificantConditions || 'None'}[/td]
[/tr]
[/table]`;
    }

    const caseNumberDisplay = deathReportPostId 
        ? `[url=${deathReportPostId}]${caseNumber}[/url]` 
        : caseNumber || '';

    let formattedDateOfDeath = '[DATE HERE]';
    if (dateOfDeath) {
        const date = new Date(dateOfDeath + 'T00:00:00'); // Add time to avoid timezone issues
        formattedDateOfDeath = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }

    const bbCode = `[divbox=#FFFFFF]
[center][img]https://i.ibb.co/Rk5bRDxX/image.png[/img][/center]
[/divbox]

[divbox=#4D4D4D][center][bold][size=150]PUBLIC DECEDENT RECORD[/size][/bold][/center][/divbox]

[divbox=#000000][center][size=130]${decedentName || 'FULL NAME HERE'}[/size][/center]
[center]Date of Death: ${formattedDateOfDeath}[/center]
[center]${deathRecordType === 'Unidentified' ? 'Approx Age' : 'Age'}: ${age || '[AGE HERE]'}[/center][/divbox]

[table]
[tr]
[td bgcolor=#E6E6E6][bold]Case Number[/bold]: ${caseNumberDisplay}[/td]
[td bgcolor=#E6E6E6][bold]Case Status[/bold]: ${caseStatus || ''}[/td]
[td bgcolor=#E6E6E6][bold]Body Status[/bold]: ${bodyStatus || ''}[/td]
[/tr]
[tr]
[td bgcolor=#E6E6E6][bold]Sex[/bold]: ${sex || ''}[/td]
[td bgcolor=#E6E6E6][bold]Ethnicity[/bold]: ${ethnicity || ''}[/td]
[/tr]
[/table]

[table]
[tr]
[td bgcolor=#E6E6E6][bold]Place of Death[/bold]: ${placeOfDeath || ''}[/td]
[td bgcolor=#E6E6E6][bold]Manner[/bold]: ${manner || ''}[/td]
[/tr]
[tr]
[td bgcolor=#E6E6E6][bold]Investigator[/bold]: ${coronerEmployee || ''}[/td]
[td bgcolor=#E6E6E6][bold]Chief Medical Examiner[/bold]: ${chiefMedicalExaminer || ''}[/td]
[/tr]
[/table]

${detailsBlock}

[divbox=#4D4D4D][center][b]These public records are of disclosed cases involving a Medical Examiner from the Department of Pathology & Forensic Medicine only. 
These are not records of every death that occurs in Los Santos County.

For further inquiries into any cases or for further documentation:
The Chief/Deputy Chief Medical Examiner-Coroner can be emailed through PHMC's online portal [url=https://phmc.gta.world/ucp.php?i=pm&mode=compose]HERE[/url].
PHMC's landline can be reached through the number 50056 for any physical records or the next-of-kin process.[/b][/center][/divbox]`;

    return bbCode;
};

export default generateDeathRecord;
