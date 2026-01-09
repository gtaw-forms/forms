const generateDecedentBBCode = (decedents, coronerInfo = {}) => {
    let bbCode = '';
    const { coronerRank, coronerEmployee } = coronerInfo;

    if (!Array.isArray(decedents) || decedents.length === 0) {
        return '[center][i]No decedents provided.[/i][/center]';
    }

    decedents.forEach((dec, idx) => {
        // Image URL Processing
        const scenePhotosArray = Array.isArray(dec.scenePhotos) ? dec.scenePhotos.filter(url => url) : [];
        const additionalImagesArray = Array.isArray(dec.additionalImages) ? dec.additionalImages.filter(url => url) : [];
        const scenePhotosBBCode = scenePhotosArray.length > 0
            ? scenePhotosArray.map(photo => `[img]${photo}[/img]`).join('\n')
            : '[i]No scene photos provided.[/i]';
        const additionalImagesBBCode = additionalImagesArray.length > 0
            ? additionalImagesArray.map(photo => `[img]${photo}[/img]`).join('\n')
            : '[i]No additional images provided.[/i]';

        // Evidence Locker Logic
        let evidenceLockerText = 'No';
        let evidenceLockerListItems = '';
        if (dec.evidenceLockerID && dec.evidenceLockerID.trim() !== '') {
            evidenceLockerText = 'Yes';
            evidenceLockerListItems = `[list][*] ${dec.evidenceLockerID.trim()} - ${dec.decedentName} (( ${dec.decedentOOC} ))[/list]`;
        }
        const morgueStatusMessage = dec.morgueStatus === 'true' || dec.morgueStatus === true
            ? '[bold][color=red]The Morgue Screen Photo is currently unavailable. [/color][/bold]\n'
            : '';

        bbCode += `
[divbox=transparent][altspoiler=${idx + 1} - ${dec.decedentName || 'Unidentified'} - OOC ${dec.decedentOOC || 'Unknown'}]
[divbox=transparent][center][bold]DECEDENT INFORMATION[/bold][/center]
[bold] DECEDENT NAME: [/bold] ${dec.decedentName || 'Unidentified Decedent'}
[bold] DECEDENT OOC NAME: [/bold] (( ${dec.decedentOOC || 'Unknown'} ))
[bold] PRONOUNCED TIME OF DEATH: [/bold] ${dec.pronouncedTimeOfDeath || 'Unknown Time'}
[bold] PROBABLE CAUSE OF DEATH: [/bold] ${dec.probableCauseOfDeath || 'Unknown Cause'}
[bold] MANNER OF DEATH: [/bold] ${dec.mannerOfDeath || 'Unknown Manner'}
[bold] TYPE OF DEATH: [/bold] ${dec.typeOfDeath || 'Unknown Type'}
[bold] Decedent Injuries / Things of Note: [/bold] ${dec.synopsis || 'No Synopsis Provided'}

[hr][/hr]
[/divbox]
[divbox=transparent][center][bold]DECEDENT DOCUMENTARY RECORD[/center]
[hr][/hr]
[center][size=85][bold][u]SCENE PHOTOGRAPHY[/u][/bold][/size][/center]
${scenePhotosBBCode}
[/divbox]
[divbox=transparent][center][bold][u](( OUT OF CHARACTER IMAGES ))[/u][/bold][/center][hr][/hr]

This section clarifies whether or not if the player was character killed or player killed.
In this case the player was; ${dec.typeOfDeath || 'Unknown'}
Morgue screen, cinjuries, cdna links: ${morgueStatusMessage || ''}
[size=85][u] THESE IMAGES ARE [bold]OUT OF CHARACTER[/bold] FOR INTERNAL RECORDS, DO NOT USE THESE AS EVIDENCE. [/u][/size]
${additionalImagesBBCode}

${coronerRank || 'Coroner'} ${coronerEmployee || 'Unknown Coroner'} has added something to the evidence locker: ${evidenceLockerText}
${evidenceLockerListItems}

[/divbox][/divbox]
`;
    });

    return bbCode;
};

export default generateDecedentBBCode;