const generateDeathReport = (formData) => {
    const {
        coronerRank,
        placeOfDeath,
        department,
        dateTime,
        coronerEmployee,
        coronerBadge,
        decedentName,
        decedentOOC,
        pronouncedTimeOfDeath,
        synopsis,
        probableCauseOfDeath,
        mannerOfDeath,
        typeOfDeath,
        scenePhotos,
                agencyDataStore,
        additionalImages,
        evidenceLockerID,
        morgueStatus,
    } = formData;

    const { decedentAttributes, decedentPlaceholder } = formData;

const getDepartmentFullName = (shortCode) => {
    if (agencyDataStore && agencyDataStore[shortCode]) {
        return agencyDataStore[shortCode].fullName;
    }
    return shortCode; // fallback to shortcode
};

    // --- Input Validation (Optional but Recommended) ---
    // Add checks here if certain fields are absolutely required before generating
    // Example:
    // if (!placeOfDeath || !department || !dateTime /* ... other required fields */) {
    //     console.error("Missing required fields for death report generation.");
    //     return "Error: Missing required information for report."; // Or throw an error
    // }

    // --- Image URL Processing ---
    // Use optional chaining and provide default empty arrays to prevent errors if fields are null/undefined/empty
    const scenePhotosArray = (scenePhotos || '').split(',').map(url => url.trim()).filter(url => url);
    const additionalImagesArray = (additionalImages || '').split(',').map(url => url.trim()).filter(url => url);
    const decedentAttributesArray = (decedentAttributes || '').split(',').map(url => url.trim()).filter(url => url);
    const decedentPlaceholderArray = (decedentPlaceholder || '').split(',').map(url => url.trim()).filter(url => url);

    const scenePhotosBBCode = scenePhotosArray.length > 0
        ? scenePhotosArray.map(photo => `[img]${photo}[/img]`).join('\n')
        : '[i]No scene photos provided.[/i]'; // Provide fallback text

    const additionalImagesBBCode = additionalImagesArray.length > 0
        ? additionalImagesArray.map(photo => `[img]${photo}[/img]`).join('\n')
        : '[i]No additional images provided.[/i]'; // Provide fallback text

    const decedentAttributesBBCode = decedentAttributesArray.length > 0
        ? `[b]Decedent /attributes:[/b]\n${decedentAttributesArray.map(photo => `[img]${photo}[/img]`).join('\n')}`
        : '';

    // --- Evidence Locker Logic ---
    let evidenceLockerText = 'No';
    let evidenceLockerListItems = '';

    // Check if evidenceLockerID has a value, indicating evidence submission
    if (evidenceLockerID && evidenceLockerID.trim() !== '') {
        evidenceLockerText = 'Yes';
        evidenceLockerListItems = `[list][*] ${evidenceLockerID.trim()} - ${decedentName} (( ${decedentOOC} ))[/list]`;
    }
    const morgueStatusMessage = morgueStatus === 'true' || morgueStatus === true
     ? '[bold][color=red]The Morgue Screen Photo is currently unavailable. [/color][/bold]\n'
     : '';


/*     // --- Debug Logs ---
    console.log("[generateDeathReport] Evidence Locker Values:", {
        evidenceLockerID,
        evidenceLockerText,
        evidenceLockerListItems
    });
 */
    // --- Morgue Status Message ---

    // --- BBCode Template ---
    // Use template literals for better readability
    const bbCode = `[divbox=transparent][center][img]https://i.ibb.co/0pgw9hHm/phmc.png[/img][/center][/divbox]

[divbox=transparent][br][/br][center]DEATH INVESTIGATION REPORT[/center]
[hr][/hr]

[center][bold]A. WRITTEN REPORT[/bold][/center]

The County Coroner's Office has been called regarding the decease that occurred at the location of [bold]${placeOfDeath || 'Unknown Location'}[/bold]. Upon receiving the call from[bold] ${getDepartmentFullName(department) || 'Unknown Department'}[/bold], Coroner's Office dispatched a ${coronerRank || 'Coroner'} to the crime scene to conduct an investigation on the [bold]${dateTime || 'Unknown Date/Time'}[/bold].

The ${coronerRank || 'Coroner'}, [bold]${coronerEmployee || 'Unknown Coroner'}[/bold], Serial Number [bold]${coronerBadge || 'N/A'}[/bold], arrived at the scene and identified the individual as [bold]${decedentName || 'Unidentified Decedent'}[/bold], who is estimated to have died at [bold]${pronouncedTimeOfDeath || 'Unknown Time'}[/bold]. Following an initial investigation, The ${coronerRank || 'Coroner'} came up with the following [bold]synopsis[/bold]: ${synopsis || 'No synopsis provided.'}

Based on the information gathered from the scene investigation and the decedent's medical history (if available), the probable cause of death was determined to be [bold]${probableCauseOfDeath || 'Undetermined'}[/bold]. The manner of death was classified as [bold]${mannerOfDeath || 'Undetermined'}[/bold].
[/divbox]
[divbox=transparent][center][bold]B. PHOTOGRAPHIC DOCUMENTARY RECORD[/center]
[hr][/hr]
[center][size=85][bold][u]SCENE PHOTOGRAPHY[/u][/bold][/size][/center]
${scenePhotosBBCode}
[/divbox]

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

[divbox=transparent][center][bold][u](( OUT OF CHARACTER IMAGES ))[/u][/bold][/center][hr][/hr]

This section clarifies whether or not if the player was character killed or player killed.
In this case the player was; ${typeOfDeath || 'Unknown'}
Player OOC Name: ${decedentOOC || 'Unknown'}
Morgue screen, cinjuries, cdna links: ${morgueStatusMessage || ''}
[size=85][u] THESE IMAGES ARE [bold]OUT OF CHARACTER[/bold] FOR INTERNAL RECORDS, DO NOT USE THESE AS EVIDENCE. [/u][/size]
${additionalImagesBBCode}

${decedentAttributesBBCode}

[/divbox]
`;

    return bbCode;
};

// Export the function so it can be imported elsewhere
export default generateDeathReport;
