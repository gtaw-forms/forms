const generateAutopsy = (formData) => {
    const {
        coronerRank,
        coronerEmployee,
        synopsis,       // Used for Opinion
        decedentName,
        externalExamination, // Added this from your Autopsy.js
        decedentOOC,
        autopsyDeathCauses,
        deathType,
        causeOfDeath,
        autopsyAnatomicSummaryItems,
        autopsyAlbumUrl,             // This now holds comma-separated image URLs
        autopsyPhotosUnavailable,
        RadiologyResult,             // Added this from your Autopsy.js
        autopsyDate: formAutopsyDate,
        autopsyTime: formAutopsyTime,
        autopsyDiagramImgurUrl, // Assuming the Imgur URL is stored here

    } = formData;

    // --- Dynamic Death Causes List ---
    let deathCausesListItems = '[list=a][*]N/A[/list]';
    if (autopsyDeathCauses && Array.isArray(autopsyDeathCauses)) {
        const filteredCauses = autopsyDeathCauses
            .map(cause => (cause || '').trim())
            .filter(cause => cause);
        if (filteredCauses.length > 0) {
            deathCausesListItems = `[list=a]${filteredCauses[0]}`;
            if (filteredCauses.length > 1) {
                deathCausesListItems += `\n${filteredCauses.slice(1).map(cause => `[*]${cause}`).join('\n')}`;
            }
            deathCausesListItems += `\n[/list]`;
        }
    }

    // --- Dynamic Anatomic Summary List ---
    let anatomicSummaryListItems = '[list=1][*]N/A[/list]';
    if (autopsyAnatomicSummaryItems && Array.isArray(autopsyAnatomicSummaryItems)) {
        const filteredSummaryItems = autopsyAnatomicSummaryItems
            .map(item => (item || '').trim())
            .filter(item => item);
        if (filteredSummaryItems.length > 0) {
            anatomicSummaryListItems = `[list=1]${filteredSummaryItems[0]}`;
            if (filteredSummaryItems.length > 1) {
                anatomicSummaryListItems += `\n${filteredSummaryItems.slice(1).map(item => `[*]${item}`).join('\n')}`;
            }
            anatomicSummaryListItems += `\n[/list]`;
        }
    }
    // --- Autopsy Diagram Logic ---
    let autopsyDiagramBBCode = '';
    if (autopsyDiagramImgurUrl && autopsyDiagramImgurUrl.trim() !== '') {
        autopsyDiagramBBCode = `[b]Autopsy Diagram[/b]:\n[img]${autopsyDiagramImgurUrl.trim()}[/img]\n`;
    } else {
        // Option 1: Omit the line if no diagram
        // autopsyDiagramBBCode = ''; 
        // Option 2: Indicate no diagram is available
        autopsyDiagramBBCode = `[b]Autopsy Diagram[/b]: N/A\n`;
    }

    // --- Photography Link/Image Logic ---
    let photographySectionBBCode = '';
    if (autopsyPhotosUnavailable) {
        photographySectionBBCode = 'Photographs are unavailable for this autopsy.';
    } else if (autopsyAlbumUrl && autopsyAlbumUrl.trim() !== '') {
        const photoUrls = autopsyAlbumUrl.split(',')
            .map(url => url.trim())
            .filter(url => url); // Filter out empty strings

        if (photoUrls.length > 0) {
            photographySectionBBCode = `At scene photos are available: ${photoUrls.map((url, index) => `[url=${url}]Photo ${index + 1}[/url]`).join(' | ')} Photographs have been taken prior to and during course of the autopsy.`;
        } else {
            photographySectionBBCode = 'No valid photo URLs provided.';
        }
    } else {
        photographySectionBBCode = 'No photographs provided for this autopsy.';
    }

    // --- Format date and time for the report ---
    let finalAutopsyDate = 'DD/MMM/YYYY';
    if (formAutopsyDate) {
        const dateParts = formAutopsyDate.split('-'); // YYYY-MM-DD
        if (dateParts.length === 3) {
            const dateObj = new Date(dateParts[0], parseInt(dateParts[1], 10) - 1, dateParts[2]); // Month is 0-indexed
            finalAutopsyDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        }
    }
    const finalAutopsyTime = formAutopsyTime || 'HH:MM';

    let bbCode = `[divbox=white][center][img]https://i.ibb.co/0pgw9hHm/phmc.png[/img][/center][/divbox]

[divbox=white][b][size=150][br][/br][center]DEPARTMENT OF PATHOLOGY AND FORENSIC MEDICINE[/size][/b][/center]
[center][size=120]Autopsy Report by Medical Examiner[/size][/center][hr][/hr][justify][br][/br]I performed an autopsy on the body of [b]${decedentName || 'John Doe'} ((${decedentOOC || 'OOC Name'}))[/b] at PHMC's Department of Pathology and Forensic Medicine on ${finalAutopsyDate}, ${finalAutopsyTime}.
From the anatomic findings and pertinent history, I ascribe the death to:
${deathCausesListItems}
[b]MANNER OF DEATH:[/b] ${deathType || 'Undetermined'}
[b]HOW INJURY OCCURRED:[/b] ${causeOfDeath || 'Unknown'}
${autopsyDiagramBBCode} 
[b]Anatomic Summary:[/b]
${anatomicSummaryListItems}
[b]External Examination:[/b]
${externalExamination || 'No external examination details provided.'}[br][/br]
[b]Clothing:[/b]
The body was not clothed and the clothing was not available at the time of autopsy.[br][/br]
[b]Initial Incision:[/b]
The body cavities are entered through the standard coronal and the standard Y-shaped incisions.[br][/br]
[b]Internal Examination:[/b]
Consistent with the stated cause of death, nothing out of the ordinary was observed.[br][/br]
[b]Histologic Sections:[/b]
Representative sections from various organs are preserved in one storage jar in %10 formalin.[br][/br]
[b]Toxicology:[/b]
Chest blood, femoral blood, EDTA blood, urine, stomach contents and vitreous have been submitted to the lab. A comprehensive screen was requested.[br][/br]
[b]Photography:[/b]
${photographySectionBBCode}[br][/br]
[b]Radiology:[/b]
The body is fluoroscoped and two x-rays were taken; ${RadiologyResult || 'No specific radiology results noted.'}[br][/br]
[b]Opinion:[/b]
${synopsis || 'No opinion provided.'}[br][/br]
[b]Performed by:[/b]
${coronerRank || 'Medical Examiner'} ${coronerEmployee || 'Unknown Coroner'} [br][/br]
[b]Approved by:[/b]
Chief Medical Examiner-Coroner Anne Carter[/justify][/divbox]`

    return bbCode;
};
export default generateAutopsy;
