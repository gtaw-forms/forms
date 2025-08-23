import { departmentFullName } from '../data';

const generateMassFatality = (formData) => {
    const {
        coronerRank,
        placeOfDeath,
        department,
        dateTime,
        requestingOfficer,
        coronerEmployee,
        coronerBadge,
        synopsis,
        showRequestingOfficerInput,
        decedents = [], // Array of decedent objects
    } = formData;
const numberToWords = (num) => {
    const words = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
    if (num >= 0 && num <= 10) {
        return words[num];
    }
    return num.toString(); // Fallback for numbers > 10
};

    // --- BBCode Header ---
    let bbCode = `[divbox=transparent][center][img]https://i.imgur.com/Hxjt4M2.png[/img][/center][/divbox]

[divbox=transparent][br][/br][center]MASS FATALITY REPORT[/center]
[hr][/hr]

[center][bold]A. WRITTEN REPORT[/bold][/center]

The County Coroner's Office has been called regarding a Mass Fatality Incident that occurred at the location of [bold]${placeOfDeath || 'Unknown Location'}[/bold]. Upon receiving the call from[bold] ${departmentFullName(department) || 'Unknown Department'}[/bold], Coroner's Office dispatched a ${coronerRank || 'Coroner'} to the crime scene to conduct an investigation on the [bold]${dateTime || 'Unknown Date/Time'}[/bold].

The ${coronerRank || 'Coroner'}, [bold]${coronerEmployee || 'Unknown Coroner'}[/bold], Serial Number [bold]${coronerBadge || 'N/A'}[/bold], arrived at the scene and identified a total of [bold]${numberToWords(Array.isArray(decedents) ? decedents.length : 0)} Decedents.[/bold]. Following an initial investigation, The ${coronerRank || 'Coroner'} came up with the following [bold]synopsis[/bold]: ${synopsis || 'No synopsis provided.'}

${showRequestingOfficerInput ? `
An official from the ${departmentFullName(department) || 'Unknown Department'} has requested the report be forwarded via Secure Intranet to [b]${requestingOfficer}[/b], it has since been sent to the officer for further processing and review.` : ''}
[/divbox]
`;

    // --- Loop through decedents and add BBCode for each ---
    if (Array.isArray(decedents)) {
        decedents.forEach((dec, idx) => {
            // Image URL Processing
            const scenePhotosArray = (dec.scenePhotos || '').split(',').map(url => url.trim()).filter(url => url);
            const additionalImagesArray = (dec.additionalImages || '').split(',').map(url => url.trim()).filter(url => url);
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
[divbox=transparent][altspoiler=${idx + 1} - ${dec.decedentName} - OOC ${dec.decedentOOC || 'Unknown'}]
[divbox=transparent][center][bold]DECEDENT INFORMATION[/bold][/center]
[b] DECEDENT NAME: [/b] ${dec.decedentName || 'Unidentified Decedent'}
[b] DECEDENT OOC NAME: [/b] (( ${dec.decedentOOC || 'Unknown'} ))
[b] PRONOUNCED TIME OF DEATH: [/b] ${dec.pronouncedTimeOfDeath || 'Unknown Time'}
[b] PROBABLE CAUSE OF DEATH: [/b] ${dec.probableCauseOfDeath || 'Unknown Cause'}
[b] MANNER OF DEATH: [/b] ${dec.mannerOfDeath || 'Unknown Manner'}
[b] TYPE OF DEATH: [/b] ${dec.typeOfDeath || 'Unknown Type'}
[b] Decedent Injuries / Things of Note: [/b] ${dec.synopsis || 'No Synopsis Provided'}

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
    }

    bbCode += `
[divbox=transparent]
[center][bold]C. STATEMENT[/bold][/center]
[hr][/hr]
[size=85]As a ${coronerRank || 'Coroner'}, I have made detailed notes of my findings and conclusions, and these notes are available for review if necessary. However, I must note that these notes do not contain any personal opinions and are solely based on the evidence and facts available to me.

In conclusion, I hope that this report provides the necessary information required for the agency to move forward with any necessary actions. Please let me know if you require any additional information or if I can be of further assistance.

I certify that the information contained in this report is true and accurate to the best of my knowledge and belief. I have reviewed the report and ensured that all information included is complete and accurate. [/size][/divbox]

[divbox=transparent][center][bold]D. PRIVACY AND CONFIDENTIALITY[/bold][/center]
[hr][/hr]
[center][size=85]This document from the Forensic Medicine and Pathology Department of Pillbox Hill Medical Center certifies the authenticity of the information contained within. Any unauthorized distribution or use of this information is in violation of the Health Insurance Portability and Accountability Act (HIPAA), as well as state and federal privacy laws, including but not limited to the San Andreas Confidentiality of Medical Information Act (CMIA) and the San Andreas Information Practices Act (IPA).

It is imperative that all parties handling this document respect the privacy and confidentiality of the decedent and their family. Any violation of these laws may result in legal action being taken against the responsible parties.

This document is provided for official purposes only and is not to be construed as legal advice or medical diagnosis. If additional information or clarification is needed, please contact the Forensic Medicine and Pathology Department of Pillbox Hill Medical Center.[/size][/divbox]
`;

    return bbCode;
};

export default generateMassFatality;