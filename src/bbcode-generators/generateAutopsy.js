const generateAutopsy = (formData) => {
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

    let bbCode = `[divbox=white][b][size=150][br][/br][center]DEPARTMENT OF PATHOLOGY AND FORENSIC MEDICINE[/size][/b][/center]
[center][size=120]Autopsy Report by Medical Examiner[/size][/center][hr][/hr][justify][br][/br]I performed an autopsy on the body of [b]John Doe ((William Johnson))[/b] at PHMC's Department of Pathology and Forensic Medicine on DD/MMM/2022, 15:00.
From the anatomic findings and pertinent history, I ascribe the death to:
[list=a]deathEval
[*]deathEvalmore
[*]Blood Loss
[/list]
[b]MANNER OF DEATH:[/b] deathType
[b]HOW INJURY OCCURRED:[/b] causeOfDeath
[b]Anatomic Summary:[/b]
synopsis [list=1]Gunshot wound of head (Gunshot Wound 'A'), long range,
entering occipital scalp, exiting anterolateral bucca;
[*]Gunshot wound of trunk (Gunshot Wound 'B'), long range,
entering superomedial dorsum, exiting medial chest;
[*]Gunshot wound of upper extremities (Gunshot Wound 'C'), long range,
entering left shoulder, exiting anterior;
[/list]
[b]External Examination:[/b]
The body is identified by toe tags and is that of an unembalmed refrigerated adult African-American male, who appears about the reported age of 25 years. The body weighs normal, measures normal, and is well built. The skin is free of abrasions, bruises and lacerations. There are lesions on the skin consistent with postmortem insect activity. Tattoos are present. Please see autopsy photographs.[br][/br]
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
At scene photos are [url=LINK-HERE]available[/url]. Photographs have been taken prior to and during course of the autopsy.[br][/br]
[b]Radiology:[/b]
The body is fluoroscoped and two x-rays were taken. The x-rays show 3 projectiles in the body.[br][/br]
[b]Opinion:[/b]
The decedent died due to gunshot wound of back.[br][/br]
[b]Performed by:[/b]
 Medical Examiner ${coronerEmployee} [br][/br]
[b]Approved by:[/b]
Chief Medical Examiner-Coroner Anne Carter[/justify][/divbox]`

    return bbCode;
};
export default generateAutopsy;