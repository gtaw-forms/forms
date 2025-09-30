const generateEMS = (formData) => {
    const {
        // Section 1: Personal Information
        recruitmentPosition,
        applicantTitleAndFullName,
        applicantGenderOtherText,
        applicantDOBAndPlace,
        applicantAddress,
        applicantContactDetails,
        applicantMedicalConditions,

        // Section 2: Educational Background
        applicantSchoolName,
        applicantEnrollmentTerm,
        applicantMajor,
        applicantLanguages,

        // Section 3: Employment History (Used for Paramedic & EMT)
        applicantPrevEmployment,
        applicantPrevDuties,
        applicantPrevDismissalReason,

        // Section 4: Motivational Letter (Used for Paramedic & EMT)
        applicantMotivationLetter,

        // Section 5: OOC Information
        oocUcpName,
        oocForumName,
        oocDiscord,
        oocTimezone,
        oocMedicalExperience, // Used in all OOC sections now
        oocAdminRecordLink,
        oocStatsLink,
        charBackground,
        // Gender
        genderMale,
        genderFemale,
        genderOther,
        // Citizenship
        citizenUS,
        citizenPermanent,
        citizenNone,
        // Education
        eduHighSchool,
        eduCertificate,
        eduDiploma,
        eduAssociate,
        eduBachelor,
        eduMaster,
        eduDoctorate,

        // EMS specific position details from formData
        //positionDetailsData, // MODIFIED: Changed from emsPositionDetailsData
        selectOptions,

        // Fields for non-Paramedic/non-EMT EMS (original structure for Section 3)
        emsLicenseLink,
        emsPartTimeReason,
        oocOtherFactionDfpLfm,

    } = formData;

    // Use EMS-specific position details
    const positionDetailsMap = selectOptions?.emsPositionDetailsData || {};
    console.log("DEBUG: positionDetailsMap in generateEMS.js:", positionDetailsMap);

    let dynamicDisplayPosition = "Position (Please Select)";
    let dynamicJobPostingUrl = "https://phmc.gta.world/viewforum.php?f=168";

    if (recruitmentPosition && Object.keys(positionDetailsMap).length > 0) {
        const selectedPositionKey = recruitmentPosition.toUpperCase();
        if (positionDetailsMap[selectedPositionKey]) {
            console.log(`positionDetailsMap[${selectedPositionKey}]`, positionDetailsMap[selectedPositionKey]);
            dynamicDisplayPosition = positionDetailsMap[selectedPositionKey].displayName || selectedPositionKey;
            dynamicJobPostingUrl = positionDetailsMap[selectedPositionKey].url || dynamicJobPostingUrl;
        } else {
            dynamicDisplayPosition = selectedPositionKey;
            // This console.warn will now correctly reference the data source name
            console.warn(`EMS Position "${selectedPositionKey}" not found in positionDetailsMap. Using default URL.`);
        }
    } else if (recruitmentPosition) {
        dynamicDisplayPosition = recruitmentPosition;
        // This console.warn will now correctly reference the data source name
        console.warn(`positionDetailsMap is empty or not provided. Using default URL for "${recruitmentPosition}".`);
    }

    const eduCheck = (field) => field ? 'c' : '';
    let sections3onwardsBBCode = '';

    // ... rest of your generateEMS.js logic remains the same ...
    // (commonSections3And4, if/else if blocks for Paramedic, EMT, EMT Trainee, Other EMS)

    const commonSections3And4 = `[divbox=na][list=none][b][size=110][color=#FF0000]3[/color].  Employment History[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]3.1[/color] Previous Employment:[/b] [i]${applicantPrevEmployment || 'ROLE at COMPANY between DD/MMM/YYYY to DD/MMM/YYYY'}[/i]
[b][color=#FF0000]3.2[/color] Duties:[/b] [i]${applicantPrevDuties || 'ANSWER'}[/i]
[b][color=#FF0000]3.3[/color] Reason for Dismissal:[/b] [i]${applicantPrevDismissalReason || 'ANSWER'}[/i][/list]
[br][/br][/divbox]
[divbox=na][list=none][b][size=110][color=#FF0000]4[/color].  Motivational Letter[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]4.1[/color] Submit your motivational letter, describing why you wish to join us, why we should choose you rather than someone else, and why the qualities required from this job correspond to you :[/b] i[/i]
[quote][i]${applicantMotivationLetter || 'ANSWER HERE'}[/i][/quote][/list]
[br][/br][/divbox]`;

    if (recruitmentPosition === "Paramedic") {
        sections3onwardsBBCode = commonSections3And4 +
`[divbox=na][list=none][b][size=110][color=#FF0000]5[/color].  (( Out of Character information ))[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]5.1[/color] User Control Panel (UCP) Username:[/b] [i]${oocUcpName || 'ANSWER'}[/i]
[b][color=#FF0000]5.2[/color] GTA:W Forum Account Name:[/b] [i]${oocForumName || 'ANSWER'}[/i]
[b][color=#FF0000]5.3[/color] Discord Name:[/b] [i]${oocDiscord || 'ANSWER'}[/i]
[b][color=#FF0000]5.4[/color] Timezone:[/b] [i]${oocTimezone || 'ANSWER'}[/i]
[b][color=#FF0000]5.5[/color] Do you have any real life medical experience or have you roleplayed in medical factions in the past?:[/b] [i]${oocMedicalExperience || 'ANSWER'}[/i]
[b][color=#FF0000]5.6[/color] [u]Unedited[/u] Screenshot of your Admin Record with the current date & time displayed:[/b]
[list=none][altspoiler=Admin Record][img]${oocAdminRecordLink || 'LINK'}[/img][/altspoiler][/list]
[b][color=#FF0000]5.7[/color] Provide a screenshot of your character's statistics (/stats) which you're applying with:[/b] 
[list=none][altspoiler=Stats][img]${oocStatsLink || 'LINK'}[/img][/altspoiler][/list]
[b][color=#FF0000]5.8[/color] Provide your character's background story:[/b]
[quote][i]${charBackground || 'ANSWER HERE'}[/i][/quote][/list][/divbox]`;
    } else if (recruitmentPosition === "EMT") { // Regular EMT
        const oocFieldsBBCode = `[b][color=#FF0000]5.1[/color] User Control Panel (UCP) Username:[/b] [i]${oocUcpName || 'ANSWER'}[/i]
[b][color=#FF0000]5.2[/color] [u]Unedited[/u] Screenshot of your Admin Record:[/b]
[list=none][altspoiler=Admin Record][img]${oocAdminRecordLink || 'LINK'}[/img][/altspoiler][/list]
[b][color=#FF0000]5.3[/color] GTA:W Forum Account Name:[/b] [i]${oocForumName || 'ANSWER'}[/i]
[b][color=#FF0000]5.4[/color] Discord Name:[/b] [i]${oocDiscord || 'ANSWER'}[/i]
[b][color=#FF0000]5.5[/color] Timezone:[/b] [i]${oocTimezone || 'ANSWER'}[/i]
[b][color=#FF0000]5.6[/color] Do you have any real life medical experience or have you roleplayed in medical factions in the past?:[/b] [i]${oocMedicalExperience || 'ANSWER'}[/i]
[b][color=#FF0000]5.7[/color] Provide a screenshot of your character's statistics (/stats) which you're applying with:[/b] 
[list=none][altspoiler=Stats][img]${oocStatsLink || 'LINK'}[/img][/altspoiler][/list]
[b][color=#FF0000]5.8[/color] Provide your character's background story:[/b]
[quote][i]${charBackground || 'ANSWER HERE'}[/i][/quote]`;

        sections3onwardsBBCode = commonSections3And4 +
    `[divbox=na][list=none][b][size=110][color=#FF0000]5[/color].  (( Out of Character information ))[/size][/b][/list]
[hr][/hr]
[list=none]${oocFieldsBBCode}[/list][/divbox]`;
    } else if (recruitmentPosition === "EMT Trainee") { // EMT Trainee - OOC starts at section 4
        sections3onwardsBBCode = `[divbox=na][list=none][b][size=110][color=#FF0000]4[/color].  (( Out of Character information ))[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]4.1[/color] User Control Panel (UCP) Username:[/b] [i]${oocUcpName || 'ANSWER'}[/i]
[b][color=#FF0000]4.2[/color] GTA:W Forum Account Name:[/b] [i]${oocForumName || 'ANSWER'}[/i]
[b][color=#FF0000]4.3[/color] Discord Name:[/b] [i]${oocDiscord || 'ANSWER'}[/i]
[b][color=#FF0000]4.4[/color] Timezone:[/b] [i]${oocTimezone || 'ANSWER'}[/i]
[b][color=#FF0000]4.5[/color] Do you have any real life medical experience or have you roleplayed in medical factions in the past?:[/b] [i]${oocMedicalExperience || 'ANSWER'}[/i]
[b][color=#FF0000]4.6[/color] [u]Unedited[/u] Screenshot of your Admin Record with the current date & time displayed:[/b]
[list=none][altspoiler=Admin Record][img]${oocAdminRecordLink || 'LINK'}[/img][/altspoiler][/list]
[b][color=#FF0000]4.7[/color] Provide a screenshot of your character's statistics (/stats) which you're applying with:[/b] 
[list=none][altspoiler=Stats][img]${oocStatsLink || 'LINK'}[/img][/altspoiler][/list]
[b][color=#FF0000]4.8[/color] If you are a part of another official faction, please post a link to your DFP request from both [b]Pillbox Hill Medical Center[/b] [u]and[/u] your current faction. If utilizing the same character, permissions from LFM must be acquired and provided as well:[/b] [i]${oocOtherFactionDfpLfm || 'ANSWER'}[/i]
[b][color=#FF0000]4.9[/color] Provide your character's background story:[/b]
[quote][i]${charBackground || 'ANSWER HERE'}[/i][/quote][/list][/divbox]`;
    } else { // Other EMS roles (e.g., Part-Time Program)
        const section3Licensing = `[divbox=na][list=none][b][size=110][color=#FF0000]3[/color].  Licensing & Request Information[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]3.1[/color] Provide a copy of your Emergency Medical Technician license (( /licenses )):[/b] [i]${emsLicenseLink || 'ANSWER/LINK'}[/i]
[b][color=#FF0000]3.2[/color][/color] Please write a short paragraph about why you believe you should be offered a slot with our part-time program:
[quote][i]${emsPartTimeReason || 'ANSWER HERE'}[/i][/quote][/list]
[br][/br][/divbox]`;

        // OOC for "Other EMS" also starts at section 4
        const section4OOC_OtherEMS = `[divbox=na][list=none][b][size=110][color=#FF0000]4[/color].  (( Out of Character information ))[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]4.1[/color] User Control Panel (UCP) Username:[/b] [i]${oocUcpName || 'ANSWER'}[/i]
[b][color=#FF0000]4.2[/color] GTA:W Forum Account Name:[/b] [i]${oocForumName || 'ANSWER'}[/i]
[b][color=#FF0000]4.3[/color] Discord Name:[/b] [i]${oocDiscord || 'ANSWER'}[/i]
[b][color=#FF0000]4.4[/color] Timezone:[/b] [i]${oocTimezone || 'ANSWER'}[/i]
[b][color=#FF0000]4.5[/color] Do you have any real life medical experience or have you roleplayed in medical factions in the past?:[/b] [i]${oocMedicalExperience || 'ANSWER'}[/i]
[b][color=#FF0000]4.6[/color] [u]Unedited[/u] Screenshot of your Admin Record with the current date & time displayed:[/b]
[list=none][altspoiler=Admin Record][img]${oocAdminRecordLink || 'LINK'}[/img][/altspoiler][/list]
[b][color=#FF0000]4.7[/color] Provide a screenshot of your character's statistics (/stats) which you're applying with:[/b] 
[list=none][altspoiler=Stats][img]${oocStatsLink || 'LINK'}[/img][/altspoiler][/list]
[b][color=#FF0000]4.8[/color] If you are a part of another official faction, please post a link to your DFP request from both [b]Pillbox Hill Medical Center[/b] [u]and[/u] your current faction. If utilizing the same character, permissions from LFM must be acquired and provided as well:[/b] [i]${oocOtherFactionDfpLfm || 'ANSWER'}[/i]
[b][color=#FF0000]4.9[/color] Provide your character's background story:[/b]
[quote][i]${charBackground || 'ANSWER HERE'}[/i][/quote][/list][/divbox]`;
        sections3onwardsBBCode = section3Licensing + section4OOC_OtherEMS;
    }
    
    let bbCode = `[imageleft]https://i.ibb.co/nMgfpMcv/phmc-curve.png[/imageleft] [b][size=110]Pillbox Hill Medical Center[/size][/b] 
Career Center [center][/center]
[center]Applying as:[/center]
[center][size=150][b]${dynamicDisplayPosition}[/b][/size][/center]
[divboxcolor=black][url=${dynamicJobPostingUrl}][color=#FF0000]>[/color] [color=#FFFFFF]Back to the job posting[/color][/url][/divboxcolor]
[br][/br]
[divbox=na][list=none][b][size=110][color=#FF0000]1[/color].  Personal Information[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]1.1[/color]  Title & Full Name:[/b] [i]${applicantTitleAndFullName || 'ANSWER'}[/i]
[b][color=#FF0000]1.2[/color]  Gender:[/b] [i](add a c, where applicable like so cb[color=#FF0000][u][b]c[/b][/u][/color]) [/i]
[list=none][cb${genderMale ? 'c' : ''}] Male
[cb${genderFemale ? 'c' : ''}] Female
[cb${genderOther ? 'c' : ''}] Other: ${genderOther && applicantGenderOtherText ? applicantGenderOtherText : ''}
[/list]
[b][color=#FF0000]1.3[/color] Date & Place of Birth:[/b] [i]${applicantDOBAndPlace || 'DD/MMM/YYYY in CITY'}[/i]
[b][color=#FF0000]1.4[/color]  Address:[/b] [i]${applicantAddress || 'ANSWER'}[/i]
[b][color=#FF0000]1.5[/color]  Contact Details:[/b] [i]${applicantContactDetails || 'ANSWER'}[/i]
[b][color=#FF0000]1.6[/color] Have you been diagnosed with a medical condition, allergies, or prescribed any medication:[/b] [i]${applicantMedicalConditions || 'ANSWER'}[/i]
[b][color=#FF0000]1.7[/color]  Citizenship:[/b] [i](add a c, where applicable like so cb[color=#FF0000][u][b]c[/b][/u][/color]) [/i]
[list=none][cb${citizenUS ? 'c' : ''}] United States Citizen
[cb${citizenPermanent ? 'c' : ''}] Permanent resident alien status and applied for U.S. Citizenship 
[cb${citizenNone ? 'c' : ''}] None of the above
[br][/br][/list][/list][/divbox]
[br][/br]
[divbox=na][list=none][b][size=110][color=#FF0000]2[/color].  Educational Background[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]2.1[/color] Highest Level of Education:[/b] [i](add a c, where applicable like so cb[color=#FF0000][u][b]c[/b][/u][/color]) [/i]
[list=none]
[cb${eduCheck(eduHighSchool)}] High School Diploma
[cb${eduCheck(eduCertificate)}] Certificate (Sub-bachelor or vocational)
[cb${eduCheck(eduDiploma)}] Diploma (Sub-bachelor or vocational)
[cb${eduCheck(eduAssociate)}] Associate Degree
[cb${eduCheck(eduBachelor)}] Bachelor's Degree
[cb${eduCheck(eduMaster)}] Master's Degree
[cb${eduCheck(eduDoctorate)}] Doctorate
[/list]
[b][color=#FF0000]2.2[/color] School of Attendance:[/b] 
[list=none][color=#FF0000][b]2.2.1[/color] School Name:[/b]  [i]${applicantSchoolName || 'ANSWER'}[/i]
[color=#FF0000][b]2.2.2[/color] Enrollment Term:[/b]  [i]${applicantEnrollmentTerm || 'DD/MMM/YYYY to DD/MMM/YYYY'}[/i]
[color=#FF0000][b]2.2.3[/color] Major Course of Study:[/b] [i]${applicantMajor || 'ANSWER'}[/i]
[/list]
[b][color=#FF0000]2.3[/color] Additional Languages:[/b] [i]${applicantLanguages || 'ANSWER'}[/i][/list]
[br][/br][/divbox]
${sections3onwardsBBCode}
[divboxcolor=black][center][url=https://phmc.gta.world/viewforum.php?f=168][color=#FF0000]>[/color] [color=#FFFFFF]Emergency Medical Services[/url] |[/color]  [url=https://phmc.gta.world/viewtopic.php?t=14][color=#FF0000]>[/color] [color=#FFFFFF]Employment Information[/url] |[/color] [url=https://phmc.gta.world/viewforum.php?f=111][color=#FF0000]>[/color]  [color=#FFFFFF]Visitor Guidelines[/color][/url][/center][/divboxcolor]`;

    return bbCode;
};
export default generateEMS;
