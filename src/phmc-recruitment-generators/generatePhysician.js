// src/phmc-recruitment-generators/generatePhysician.js
const generatePhysician = (formData) => {
    const {
        // Section 1: Personal Information
        recruitmentPosition,
        applicantTitleAndFullName,
        applicantGenderOtherText, // Used if genderOther is true
        applicantAddress,
        applicantContactDetails,
        applicantMedicalConditions,

        // Section 2: Educational Background
        applicantSchoolName,
        applicantEnrollmentTerm,
        applicantMajor,
        applicantLanguages,

        // Section 3: Employment History
        applicantPrevEmployment,
        applicantPrevDuties,
        applicantPrevDismissalReason,

        // Section 4: Motivational Letter
        applicantMotivationLetter,

        // Section 5: OOC Information
        oocUcpName,
        oocForumName,
        oocDiscord,
        oocTimezone,
        oocMedicalExperience,
        oocAdminRecordLink,
        oocStatsLink,
        charBackground,

        // --- This will now come from formData, injected by App.js ---
        positionDetailsData, // Changed from phmcRecruitmentPositionDetails

        // --- Checkbox boolean fields from formData ---
        // Gender
        genderMale,
        genderFemale,
        genderOther,
        // Location
        locationPHMC,
        locationPBC,
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
        applicantDOB,
        // Additional fields
        applicantBirthPlace

    } = formData;

    // Use the positionDetailsMap from formData (now using positionDetailsData)
    const positionDetailsMap = positionDetailsData || {}; // Changed variable name

    // Determine the dynamic display name and URL
    let dynamicDisplayPosition = "Position (Please Select)";
    let dynamicJobPostingUrl = "https://phmc.gta.world/viewforum.php?f=14"; // Default employment forum

    if (formData.recruitmentPosition && Object.keys(positionDetailsMap).length > 0) {
        const selectedPositionKey = formData.recruitmentPosition;
        if (positionDetailsMap[selectedPositionKey]) {
            dynamicDisplayPosition = positionDetailsMap[selectedPositionKey].displayName;
            dynamicJobPostingUrl = positionDetailsMap[selectedPositionKey].url;
        } else {
            dynamicDisplayPosition = selectedPositionKey;
            // Updated console warning to reflect the new variable name
            console.warn(`Position "${selectedPositionKey}" not found in positionDetailsData from Firebase. Using default URL.`);
        }
    } else if (formData.recruitmentPosition) {
        dynamicDisplayPosition = formData.recruitmentPosition;
        // Updated console warning
        console.warn(`positionDetailsData is empty or not provided. Using default URL for "${formData.recruitmentPosition}".`);
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
[b][color=#FF0000]1.3[/color] Date & Place of Birth:[/b] [i]${applicantDOB || 'DD/MMM/YYYY'} in ${applicantBirthPlace || 'Birth Place'}[/i]
[b][color=#FF0000]1.4[/color]  Address:[/b] [i]${applicantAddress || 'ANSWER'}[/i]
[b][color=#FF0000]1.5[/color]  Contact Details:[/b] [i]${applicantContactDetails || 'ANSWER'}[/i]
[b][color=#FF0000]1.6[/color]  Desired Employment Location:[/b] [i](add a c, where applicable like so cb[color=#FF0000][u][b]c[/b][/u][/color]) [/i]
[list=none][cb${locationPHMC ? 'c' : ''}] Pillbox Hill Medical Center (City of Los Santos)
[cb${locationPBC ? 'c' : ''}] PHMC Paleto Bay Clinic (Paleto Bay)
[/list]
[b][color=#FF0000]1.7[/color] Have you been diagnosed with a medical condition, allergies, or prescribed any medication:[/b] [i]${applicantMedicalConditions || 'ANSWER'}[/i]
[b][color=#FF0000]1.8[/color]  Citizenship:[/b] [i](add a c, where applicable like so cb[color=#FF0000][u][b]c[/b][/u][/color]) [/i]
[list=none][cb${citizenUS ? 'c' : ''}] United States Citizen
[cb${citizenPermanent ? 'c' : ''}] Permanent resident alien status and applied for U.S. Citizenship
[cb${citizenNone ? 'c' : ''}] None of the above
[br][/br][/list][/list][/divbox]
[br][/br]
[divbox=na][list=none][b][size=110][color=#FF0000]2[/color].  Educational Background[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]2.1[/color] Highest Level of Education:[/b] [i](add a c, where applicable like so cb[color=#FF0000][u][b]c[/b][/u][/color]) [/i]
[list=none]
[cb${eduHighSchool ? 'c' : ''}] High School Diploma
[cb${eduCertificate ? 'c' : ''}] Certificate (Sub-bachelor or vocational)
[cb${eduDiploma ? 'c' : ''}] Diploma (Sub-bachelor or vocational)
[cb${eduAssociate ? 'c' : ''}] Associate Degree
[cb${eduBachelor ? 'c' : ''}] Bachelor's Degree
[cb${eduMaster ? 'c' : ''}] Master's Degree
[cb${eduDoctorate ? 'c' : ''}] Doctorate
[/list]
[b][color=#FF0000]2.2[/color] School of Attendance:[/b] 
[list=none][color=#FF0000][b]2.2.1[/color] School Name:[/b]  [i]${applicantSchoolName || 'ANSWER'}[/i]
[color=#FF0000][b]2.2.2[/color] Enrollment Term:[/b]  [i]${applicantEnrollmentTerm || 'DD/MMM/YYYY to DD/MMM/YYYY'}[/i]
[color=#FF0000][b]2.2.3[/color] Major Course of Study:[/b] [i]${applicantMajor || 'ANSWER'}[/i]
[/list]
[b][color=#FF0000]2.3[/color] Additional Languages:[/b] [i]${applicantLanguages || 'ANSWER'}[/i][/list]
[br][/br][/divbox]
[divbox=na][list=none][b][size=110][color=#FF0000]3[/color].  Employment History[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]3.1[/color] Previous Employment:[/b] [i]${applicantPrevEmployment || 'ROLE at COMPANY between DD/MMM/YYYY to DD/MMM/YYYY'}[/i]
[b][color=#FF0000]3.2[/color] Duties:[/b] [i]${applicantPrevDuties || 'ANSWER'}[/i]
[b][color=#FF0000]3.3[/color] Reason for Dismissal:[/b] [i]${applicantPrevDismissalReason || 'ANSWER'}[/i][/list]
[br][/br][/divbox]
[divbox=na][list=none][b][size=110][color=#FF0000]4[/color].  Motivational Letter[/size][/b][/list]
[hr][/hr]
[list=none][b][color=#FF0000]4.1[/color] Submit your motivational letter, describing why you wish to join us, why we should choose you rather than someone else, and why the qualities required from this job correspond to you :[/b] i[/i]
[quote][i]${applicantMotivationLetter || 'ANSWER HERE'}[/i][/quote][/list]
[br][/br][/divbox]
[divbox=na][list=none][b][size=110][color=#FF0000]5[/color].  (( Out of Character information ))[/size][/b][/list]
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
[quote][i]${charBackground || 'ANSWER HERE'}[/i][/quote][/list][/divbox]
[divboxcolor=black][center][url=https://phmc.gta.world/viewforum.php?f=18][color=#FF0000]>[/color] [color=#FFFFFF]Medical Faculty[/url] |[/color]  [url=https://phmc.gta.world/viewtopic.php?t=14][color=#FF0000]>[/color] [color=#FFFFFF]Employment Information[/url] |[/color] [url=https://phmc.gta.world/viewforum.php?f=111][color=#FF0000]>[/color]  [color=#FFFFFF]Visitor Guidelines[/color][/url][/center][/divboxcolor]`
    return bbCode;
    };
export default generatePhysician;
