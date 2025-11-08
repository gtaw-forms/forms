import * as Sentry from "@sentry/react";
import { ref, get, set, push } from 'firebase/database';
import { database } from '../firebase';
import getRelevantFields from './RevelantFields';
import { cleanRankText } from '../utils/textUtils';

const FORM_GENERATOR_URL = "https://phmc-tools.gta.world/";
const ALTERNATIVE_FORM_GENERATOR_URL = "https://gtaw-forms.github.io/forms/";
const comprehensiveSanitize = (str) => {
    if (!str) return '';
    // This regex now includes the global flag 'g' to replace all occurrences
    // and also includes spaces in the characters to be replaced.
    let sanitized = str.trim().replace(/[.#$[\\/ \]]+/g, '_');
    sanitized = sanitized.replace(/_{2,}/g, '_');
    sanitized = sanitized.replace(/^_+|_+$/g, '');
    return sanitized;
};

const getGeneratorName = () => {
    const currentUrl = window.location.href;
    const hostname = window.location.hostname;
    if (currentUrl.startsWith(ALTERNATIVE_FORM_GENERATOR_URL)) {
        return "Alternative Form Generator";
    }
    if (currentUrl.startsWith(FORM_GENERATOR_URL)) {
        return "Form Generator";
    }
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || (hostname.startsWith('172.') && (parseInt(hostname.split('.')[1], 10) >= 16 && parseInt(hostname.split('.')[1], 10) <= 31))) {
        return "Dev Staging";
    }
    return "Unknown Source";
};

const logWebhookToFirebase = async (type, payload) => {
    const db = database;
    const logsRef = ref(db, 'webhook_logs');
    const newLogRef = push(logsRef);
    await set(newLogRef, {
        type,
        payload,
        timestamp: Date.now(),
    });
};

export const copyToClipboard = async (text, showNotification, successMessage) => {
    // Check if the clipboard API is available at all.
    if (!navigator.clipboard) {
        showNotification('Clipboard API not available in this browser.', 'error');
        Sentry.captureMessage('Clipboard API not available.');
        return false;
    }

    // The Clipboard API is only available in secure contexts (HTTPS or localhost).
    if (!window.isSecureContext) {
        showNotification('Clipboard access is only available on secure sites (HTTPS).', 'error');
        Sentry.captureMessage('Attempted to use clipboard in a non-secure context.');
        return false;
    }

    try {
        await navigator.clipboard.writeText(text);
        showNotification(successMessage, 'clipboard');
        return true;
    } catch (err) {
        console.error('Failed to copy text: ', err);
        Sentry.captureException(err, { extra: { context: 'copyToClipboard helper' } });
        
        let userMessage = 'Failed to copy text automatically.';
        // Provide more specific user guidance based on the error.
        if (err.name === 'NotAllowedError') {
            userMessage = 'Clipboard permission was denied. Please keep the webpage in focus and try again.';
        } else if (err.message.includes('Document is not focused')) {
            userMessage = 'Could not copy. Please click on the page and try the copy button again.';
        } else {
            userMessage += ' Please try again or copy manually.';
        }
        showNotification(userMessage, 'error');
        return false;
    }
};

export const sendDiscordWebhookInternal = async (webhookUrl, embedData, commitInfo = {}, contextMessage = "") => { // Added export
    if (!webhookUrl) {
        console.error("Discord webhook URL not provided to sendDiscordWebhookInternal.");
        Sentry.captureMessage("Discord webhook URL missing in sendDiscordWebhookInternal.", "error");
        return false;
    }

    const {
        title,
        description,
        color,
        fields = [],
        footerText = "Forms Tool",
    } = embedData;

    const generatorName = getGeneratorName();
    fields.push({ name: "Source", value: generatorName, inline: true });

    const embed = {
        title: title || "Notification",
        description: description || "",
        color: color || 0x7289DA, // Default to Discord blurple
        fields: fields,
        timestamp: new Date().toISOString(),
        footer: {
            text: `${footerText} | gh-pages ${commitInfo.sha || 'N/A'}`
        }
    };

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...(contextMessage && { content: contextMessage }),
                embeds: [embed]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to send Discord webhook. Status: ${response.status} ${response.statusText}`, errorText);
            Sentry.captureMessage(`Discord webhook send failed: ${response.status}`, {
                level: 'error',
                extra: {
                    statusText: response.statusText,
                    responseBody: errorText,
                    webhookTitle: title,
                }
            });
            return false;
        }
        await logWebhookToFirebase(title, { embeds: [embed] });
        return true;
    } catch (error) {
        console.error('Error sending Discord webhook:', error);
        Sentry.captureException(error, {
            extra: {
                context: 'sendDiscordWebhookInternal Fetch Error',
                webhookTitle: title,
            }
        });
        return false;
    }
};

export const sendBingoNotification = async ({ scorer, bingoType, phrase, lineName, commitInfo, marked }) => {
    const webhookUrl = import.meta.env.VITE_BINGO_DISCORD_WEBHOOK_URL || import.meta.env.VITE_DEV_WEBHOOK;
    if (!webhookUrl) {
        console.warn("Bingo webhook URL not configured. Skipping notification.");
        return;
    }

    let embedData = {};
    if (marked) {
        embedData = {
            title: `📍 Marker Placed by ${scorer || 'A player'}`,
            description: `A marker was placed on the bingo board.`, 
            color: 0x3498db, // Blue
            fields: [
                { name: "Game", value: bingoType || 'Unknown', inline: true },
                { name: "Phrase", value: phrase || 'Unknown', inline: true },
            ],
            footerText: "PHMC Bingo - Marker Placed",
        };
    } else { // Original Bingo! functionality
        embedData = {
            title: "🎉 BINGO! 🎉",
            description: `**${scorer || 'A player'}** just scored a BINGO!`, 
            color: 0xffd700, // Gold
            fields: [
                { name: "Game", value: bingoType || 'Unknown', inline: true },
                { name: "Line", value: lineName || 'Unknown', inline: true },
            ],
            footerText: "PHMC Bingo - BINGO!",
        };
    }


    await sendDiscordWebhookInternal(webhookUrl, embedData, commitInfo);
};
export const sendMissingEmployeeNotification = async (
    actionType,
    employeeType,
    selectedEmployeeName,
    newRank,
    coronerList,
    phmcList,
    staffToRemove,
    authorizedBy,
    missingEmployeeData,
    commitInfo,
    showNotification,
    coronerEmployee,
    phmcEmployee
) => {
    try {
        const webhookURL = import.meta.env.VITE_DEV_WEBHOOK;

        if (!webhookURL) {
            console.error('Discord webhook URL not configured for employee management.');
            showNotification(
                'Configuration error: Unable to submit request. Please contact the administrator.',
                'exclamation-triangle'
            );
            return;
        }

        let embedData = {};
        let submissionValid = false;
        let successMessage = '';
        let requestActionTitle = '';

        if (actionType === 'addEmployee') {
            const isCoronerRequest = employeeType === 'coroner';
            requestActionTitle = `⬆️ Missing ${ 
                isCoronerRequest ? 'Coroner' : 'Hospital Staff'
            } Addition Request`;
            let requiredFields = [];

            if (isCoronerRequest) {
                requiredFields = ['coronerName', 'coronerDiscord', 'coronerRank', 'coronerBadge'];
            } else {
                requiredFields = ['coronerName', 'employeeLastName', 'coronerRank'];
            }

            const emptyFields = requiredFields.filter((key) => !missingEmployeeData[key]?.trim());
            if (emptyFields.length > 0) {
                showNotification(
                    `Please fill in all required fields for adding staff. Missing: ${emptyFields.join(
                        ', '
                    )}`,
                    'exclamation-circle'
                );
                return;
            }

            embedData = {
                title: requestActionTitle,
                color: isCoronerRequest ? 0x8b0000 : 0x00008b,
                fields: [
                    {
                        name: 'Requested By',
                        value: isCoronerRequest
                            ? coronerEmployee
                            : phmcEmployee,
                        inline: false,
                    },
                    {
                        name: 'Name to Add',
                        value: missingEmployeeData.coronerName || 'N/A',
                        inline: true,
                    },
                    {
                        name: isCoronerRequest ? 'Discord Tag' : 'Department/Discord',
                        value: missingEmployeeData.coronerDiscord || 'N/A',
                        inline: true,
                    },
                    {
                        name: 'Rank/Position',
                        value: missingEmployeeData.coronerRank || 'N/A',
                        inline: true,
                    },
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: `Submitted via PHMC Tools Tool - v${commitInfo.sha || 'N/A'}`,
                },
            };

            let dataJsEntry = '';
            if (isCoronerRequest) {
                embedData.fields.push({
                    name: 'Badge',
                    value: missingEmployeeData.coronerBadge,
                    inline: true,
                });
                dataJsEntry = `{ name: '${missingEmployeeData.coronerName || 
                    'MISSING_NAME'}', badge: '${missingEmployeeData.coronerBadge || 
                    'MISSING_BADGE'}', rank: '${missingEmployeeData.coronerRank || 
                    'MISSING_RANK'}', discord: '${missingEmployeeData.coronerDiscord || 
                    'MISSING_DISCORD'}', category: '${missingEmployeeData.coronerRank || 
                    'MISSING_CATEGORY'}' },`;
            } else {
                dataJsEntry = `{ name: '${missingEmployeeData.coronerName || 
                    'MISSING_NAME'}', lastName: '${missingEmployeeData.employeeLastName || 
                    'MISSING_LAST_NAME'}', rank: '${missingEmployeeData.coronerRank || 
                    'MISSING_RANK'}', category: '${missingEmployeeData.coronerRank || 
                    'MISSING_CATEGORY'}' },`;
            }
            embedData.fields.push({
                name: 'Google Firebase Debug String: ',
                value: `
${dataJsEntry}
`,
                inline: false,
            });

            submissionValid = true;
        } else if (actionType === 'removeStaff') {
            requestActionTitle = '⬆️ Staff Removal Request';
            if (!staffToRemove || staffToRemove.length === 0) {
                showNotification('Please select at least one staff member to remove.', 'warning');
                return;
            }
            if (!authorizedBy?.trim()) {
                showNotification(
                    'Please enter your name in the "Authorized By" field.',
                    'warning'
                );
                return;
            }

            const debugData = staffToRemove.map(name => {
                let staffMember = coronerList.find(c => c.name === name);
                if (!staffMember) {
                    staffMember = phmcList.find(p => p.name === name);
                }
                return staffMember || { name }; // Return at least the name if not found
            });
            const debugString = `
${JSON.stringify(debugData, null, 2)}
`;

            embedData = {
                title: requestActionTitle,
                color: 0xffa500,
                fields: [
                    { name: 'Authorized By', value: authorizedBy, inline: false },
                    {
                        name: `Staff to Remove (${staffToRemove.length})`,
                        value: staffToRemove.join('\n') || 'None selected',
                        inline: false,
                    },
                    { name: 'Firebase Debug (Removed Staff)', value: debugString, inline: false }, // NEW FIELD
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: `Submitted via PHMC Tools Tool - v${commitInfo.sha || 'N/A'}`,
                },
            };

            submissionValid = true;
            successMessage =
                'Processed! Any abuse of the forms will be reported to PHMC Leadership';

      } else if (actionType === 'editUser') {
            requestActionTitle = '⬆️ Employee Information Update Request';

            if (!selectedEmployeeName) {
                showNotification('Please select an employee to update.', 'warning');
                return;
            }

            let updatedFields = [];
            let firebaseDebugString = '';
            let originalData;

            // Determine the correct Firebase reference based on employeeType
            if (employeeType === 'hospitalStaff') {
        originalData = phmcList.find(emp => emp.name === selectedEmployeeName);
        console.log("selectedEmployeeName:", selectedEmployeeName); // Log the value
        console.log("originalData:", originalData); // Log the result to see if it's undefined

                if (missingEmployeeData.coronerName !== originalData?.name) {
                    updatedFields.push({ name: 'First Name', value: `
 -> 
`, inline: false });
                }
                if (missingEmployeeData.employeeLastName !== originalData?.lastName) {
                    updatedFields.push({ name: 'Last Name', value: `
 -> 
`, inline: false });
                }
                if (missingEmployeeData.coronerRank !== originalData?.rank) {
                    updatedFields.push({ name: 'Rank', value: `
 -> 
`, inline: false });
                }

                firebaseDebugString = `
{ name: '${missingEmployeeData.coronerName || 'MISSING_NAME'}', lastName: '${missingEmployeeData.employeeLastName || 'MISSING_LAST_NAME'}', rank: '${missingEmployeeData.coronerRank || 'MISSING_RANK'}' }
`;
            }
    else {

                 originalData = coronerList.find(emp => emp.name === selectedEmployeeName);

                if (missingEmployeeData.coronerName !== originalData?.name) {
                    updatedFields.push({ name: 'Name', value: `
 -> 
`, inline: false });
                }
                if (missingEmployeeData.coronerDiscord !== originalData?.discord) {
                    updatedFields.push({ name: 'Discord', value: `
 -> 
`, inline: false });
                }
                if (missingEmployeeData.coronerRank !== originalData?.rank) {
                    updatedFields.push({ name: 'Rank', value: `
 -> 
`, inline: false });
                }
                if (missingEmployeeData.coronerBadge !== originalData?.badge) {
                    updatedFields.push({ name: 'Badge', value: `
 -> 
`, inline: false });
                }
                if (missingEmployeeData.coronerPHNumber !== originalData?.phNumber) {
                    updatedFields.push({ name: 'PH Number', value: `
 -> 
`, inline: false });
                }

                firebaseDebugString = `
{ name: '${missingEmployeeData.coronerName || 'MISSING_NAME'}', discord: '${missingEmployeeData.coronerDiscord || 'MISSING_DISCORD'}', rank: '${missingEmployeeData.coronerRank || 'MISSING_RANK'}', badge: '${missingEmployeeData.coronerBadge || 'MISSING_BADGE'}', phNumber: '${missingEmployeeData.coronerPHNumber || 'MISSING_PHNUMBER'}' }
`;
            }

            if (updatedFields.length === 0) {
                showNotification('No changes detected.', 'info');
                submissionValid = false;
                return;
            }

            embedData = {
                title: requestActionTitle,
                color: 0x007bff,
                fields: [
                    { name: 'Employee Name', value: selectedEmployeeName, inline: true },
                    { name: 'Employee Type', value: employeeType, inline: true },
                    ...updatedFields,
                    { name: 'Firebase Debug String', value: firebaseDebugString, inline: false }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: `Submitted via PHMC Tools Tool - v${commitInfo.sha || 'N/A'}`,
                },
            };

            submissionValid = true;
            successMessage = `Successfully updated information for ${selectedEmployeeName}.`;
        }

        if (submissionValid) {
            const message = `New Employee Management Request: ${requestActionTitle}`;
            const payload = { content: message, embeds: [embedData] };

            const success = await sendDiscordWebhookInternal(
                webhookURL,
                embedData, // Assuming embedData already has the correct structure for sendDiscordWebhookInternal
                commitInfo, // Include commitInfo for footer
                `Employee Management: ${requestActionTitle}` // Optional context message, could be the title
            );

            if (success) {
                showNotification(successMessage, 'check-circle');
            }
        }
    } catch (error) {
        console.error('Error in sendMissingEmployeeNotification:', error);
        Sentry.captureException(error, { extra: { context: 'sendMissingEmployeeNotification' } });
        showNotification('An unexpected error occurred. Please try again.', 'error');
    }
};


// NEW: Webhook for when a player requests a new phrase
export const sendPhraseRequestNotification = async ({ requester, phrase, bingoType, commitInfo }) => {
    const webhookUrl = import.meta.env.VITE_BINGO_DISCORD_WEBHOOK_URL || import.meta.env.VITE_DEV_WEBHOOK;
    if (!webhookUrl) {
        console.warn("Bingo webhook URL not configured. Skipping notification.");
        return;
    }

    const phraseLines = phrase.split('\n'); // Split the phrase into multiple phrases
    let embedFields = [];

    // Add each line of the phrase as a separate field
    phraseLines.forEach((line, index) => {
        embedFields.push({ name: `Phrase Line ${index + 1}`, value: `\n`, inline: false });
    });

    // Add requester and bingoType fields
    embedFields.push({ name: "Requested For", value: bingoType || 'Unknown Game', inline: true });
    embedFields.push({ name: "Requested By", value: requester || 'Anonymous', inline: true });

    const embedData = {
        title: "📝 New Bingo Phrase Request",
        description: `A new phrase has been requested for review.`, 
        color: 0x7289DA, // Discord Blurple
        fields: embedFields,
        footerText: "PHMC Bingo",
    };

    await sendDiscordWebhookInternal(webhookUrl, embedData, commitInfo);
};


// --- MODIFIED: General PHMC Recruitment Webhook Sender ---
const sendPhmcRecruitmentWebhook = async ({
    webhookUrl,
    formData,
    commitInfo,
    actionMessage,
    selectOptions,
    formDefinition, 
}) => {
    const {
        applicantTitleAndFullName,
        recruitmentPosition,
        applicantContactDetails,
        oocUcpName,
        oocDiscord,
    } = formData;

    let positionDetailsSource = null;
    if (formDefinition) {
        switch (formDefinition.titleKey) {
            case "phmcGeneralApplication":
                positionDetailsSource = selectOptions.physicianRecruitmentDetails;
                break;
            case "phmcPsychApplication":
                positionDetailsSource = selectOptions.psychPositionDetailsData;
                break;
            case "phmcAdminApplication":
                positionDetailsSource = selectOptions.adminPositionDetailsData;
                break;
            case "phmcNursingApplication":
                positionDetailsSource = selectOptions.nursePositionDetailsData;
                break;
            case "phmcCoronerRecruitmentApplication":
                positionDetailsSource = selectOptions.coronerPositionDetailsData;
                break;
            case "phmcEMSApplication":
                positionDetailsSource = selectOptions.emsPositionDetailsData;
                break;
            default:
                console.warn(`No specific positionDetailsSource mapping for PHMC Recruitment form: ${formDefinition.titleKey} in webhook.`);
        }
    }

    const positionDisplayName = positionDetailsSource?.[recruitmentPosition]?.displayName || recruitmentPosition || "N/A";
    const formNameForTitle = formDefinition?.name || "PHMC Recruitment Application";

    const fields = [
        { name: "Applicant Name", value: applicantTitleAndFullName || "N/A", inline: true },
        { name: "Position Applied For", value: positionDisplayName, inline: true },
        { name: "Contact Details", value: applicantContactDetails || "N/A", inline: false },
        { name: "OOC UCP Name", value: oocUcpName || "N/A", inline: true },
        { name: "Discord Name", value: oocDiscord || "N/A", inline: true },
        { name: "Timestamp", value: new Date().toLocaleString(), inline: false },
        { name: "Action", value: actionMessage || "Application Processed", inline: false },
    ];

    const embedData = {
        title: `${formNameForTitle} Notification`,
        color: 0x007bff, 
        fields: fields,
        footerText: "PHMC Recruitment Forms", 
    };

    await sendDiscordWebhookInternal(webhookUrl, embedData, commitInfo);
};

export const handlePhmcRecruitmentCopyAndNotify = async ({
    formData,
    getBBCodeContent,
    showNotification,
    commitInfo,
    selectOptions,
    formDefinition, 
}) => {
    const bbCodeToCopy = getBBCodeContent();
    const formName = formDefinition?.name || "PHMC Recruitment Application";

    if (!bbCodeToCopy) {
        showNotification(`Failed to generate ${formName} BBCode. Copying skipped.`, 'error');
        Sentry.captureMessage(`getBBCodeContent returned null/undefined for ${formName}`, 'error');
        return;
    }

    const copied = await copyToClipboard(bbCodeToCopy, showNotification, `${formName} BBCode copied to clipboard!`);

    if (copied) {
        const discordWebhookUrl = import.meta.env.VITE_PHMC_RECRUITMENT_DISCORD_WEBHOOK_URL || import.meta.env.VITE_DEV_WEBHOOK;

        if (discordWebhookUrl) {
            await sendPhmcRecruitmentWebhook({
                webhookUrl: discordWebhookUrl,
                formData,
                commitInfo,
                actionMessage: `${formName} BBCode Copied`,
                selectOptions,
                formDefinition, 
            });
        } else {
            console.warn(`Discord webhook URL for ${formName} not set, skipping notification.`);
            showNotification("BBCode copied, but Discord notification for recruitment not configured.", 'warning');
        }
    }
};

const sendFormInteractionWebhookInternal = async ({
    webhookUrl,
    formData,
    versionName,
    bbCodeVersion,
    selectedAgencyGroup,
    statusTitle,
    statusColor,
    actionMessage,
    commitInfo,
    firebaseSavedCount,
    errorMessage,
    userSavedCount,
    savedReports,
    coronerListData = [],
    phmcListData = []
}) => {
    const {
        phmcEmployee,
        coronerEmployee,
        coronerRank,
        patientFirstName,
        patientLastName,
        patientName,
        decedentName,
        patientID,
        decedentOOC,
        requestingOfficer,
        registrantFullName,
        ceoFullName,
        autopsyDiagramImgurUrl, // Ensure this is destructured
    } = formData;

    let userValue = 'Unknown User';

    const coronerFormVersions = [1, 2, 4, 8, 11, 18];
    const phmcFormVersions = [5, 6, 7, 9, 10, 12, 13, 14, 16, 19, 20, 21, 22, 23, 27, 28, 29, 35];
    const civilianFormVersions = [3, 24, 25, 26]; // Civilian forms

    const isCoronerForm = coronerFormVersions.includes(bbCodeVersion);
    const isPhmcForm = phmcFormVersions.includes(bbCodeVersion);
    const isCivilianForm = civilianFormVersions.includes(bbCodeVersion);

    if (isCivilianForm) {
        if (patientName) {
            userValue = patientName;
        } else if (patientFirstName || patientLastName) {
            userValue = `${patientFirstName || ''} ${patientLastName || ''}`.trim();
        } else {
            userValue = 'Civilian'; // Fallback for civilian forms if no name is provided
        }
    } else if (isPhmcForm) {
        if (phmcEmployee) {
            // Look up the employee in phmcListData to get the correct category
            const matchedPhmcEmployee = phmcListData.find(emp => emp.name === phmcEmployee);
            const phmcCategory = cleanRankText(matchedPhmcEmployee?.category || 'Hospital Staff');
            userValue = `${phmcCategory} ${phmcEmployee}`;
        } else if (patientName) { // Fallback for PHMC forms if patient name is relevant
            userValue = patientName;
        } else if (patientFirstName || patientLastName) {
            userValue = `${patientFirstName || ''} ${patientLastName || ''}`.trim();
        }
    } else if (isCoronerForm) {
        if (coronerEmployee) {
            // Look up the employee in coronerListData to get the correct category (not the legacy rank)
            const matchedCoronerEmployee = coronerListData.find(emp => emp.name === coronerEmployee);
            const coronerCategory = cleanRankText(matchedCoronerEmployee?.category || coronerRank || 'Coroner');
            userValue = `${coronerCategory} ${coronerEmployee}`;
        }
    } else {
        // Fallback for forms that are not strictly PHMC, Coroner, or Civilian
        if (coronerEmployee) {
            const matchedCoronerEmployee = coronerListData.find(emp => emp.name === coronerEmployee);
            const coronerCategory = cleanRankText(matchedCoronerEmployee?.category || coronerRank || 'Coroner');
            userValue = `${coronerCategory} ${coronerEmployee}`;
        } else if (phmcEmployee) {
            const matchedPhmcEmployee = phmcListData.find(emp => emp.name === phmcEmployee);
            const phmcCategory = cleanRankText(matchedPhmcEmployee?.category || 'Hospital Staff');
            userValue = `${phmcCategory} ${phmcEmployee}`;
        } else if (patientFirstName || patientLastName) {
            userValue = `${patientFirstName || ''} ${patientLastName || ''}`.trim();
        } else if (patientName) {
            userValue = patientName;
        }
    }

    const primaryIdentifier = patientName || decedentName || patientID || registrantFullName || ceoFullName || (selectedAgencyGroup === 'SAAA' ? (formData.aircraftType || formData.companyName || 'SAAA Record') : 'N/A');

    const fields = [
        { name: "User", value: userValue, inline: true },
        { name: "Form Type", value: versionName, inline: true },
        { name: "Primary Identifier", value: primaryIdentifier, inline: true },
        ...(selectedAgencyGroup !== 'SAAA' || formData.decedentOOC ? [{ name: "OOC Name", value: decedentOOC || patientName || "N/A", inline: true }] : []),
        ...(selectedAgencyGroup !== 'SAAA' || formData.requestingOfficer ? [{ name: "Requesting Officer", value: requestingOfficer || "N/A", inline: true }] : []),
        { name: "Timestamp", value: new Date().toLocaleString(), inline: false },
        { name: "Action", value: actionMessage, inline: false },
    ];

    const generatorName = getGeneratorName();
    fields.push({ name: "Source", value: generatorName, inline: true });

    let actualUserSavedCount = userSavedCount;
    if (Array.isArray(savedReports) && formData) {
        const currentAuthor = formData.coronerEmployee || formData.phmcEmployee || formData.patientName || formData.decedentName;
        const sanitizedAuthorId = comprehensiveSanitize(currentAuthor);
        actualUserSavedCount = savedReports.filter(r => comprehensiveSanitize(r.authorName) === sanitizedAuthorId).length;
        console.log('[Discord Webhook] Calculating user saved reports:', {
            currentAuthor,
            sanitizedAuthorId,
            savedReports: savedReports.map(r => ({ authorName: r.authorName, sanitized: comprehensiveSanitize(r.authorName) })),
            actualUserSavedCount
        });
    }
    if (typeof actualUserSavedCount === 'number') {
        fields.push({ name: "Saved Reports (User)", value: actualUserSavedCount.toString(), inline: true });
    }

        if (firebaseSavedCount !== undefined) {
            fields.push({ name: "Total Saved Reports (Firebase)", value: firebaseSavedCount.toString(), inline: true });
        }
    if (errorMessage) {
        fields.push({ name: "Error Details", value: errorMessage, inline: false });
    }

    const validateFields = (fields) => {
        return fields.filter(field => {
            if (!field.name || !field.value) {
                console.warn('Invalid field detected:', field);
                return false;
            }
            if (typeof field.value !== 'string' || field.value.trim() === '') {
                console.warn('Field value must be a non-empty string:', field);
                return false;
            }
            return true;
        });
    };

    const validatedFields = validateFields(fields);

    // Construct the embed object
    const embed = {
        title: statusTitle,
        description: actionMessage,
        color: statusColor,
        fields: validatedFields,
        timestamp: new Date().toISOString(),
        footer: {
            text: `Forms Tool | gh-pages ${commitInfo.sha || 'N/A'}`
        },
    };

    if (versionName === "Autopsy Report" && autopsyDiagramImgurUrl) {
        const imageUrl = Array.isArray(autopsyDiagramImgurUrl) ? autopsyDiagramImgurUrl[0] : autopsyDiagramImgurUrl;
        if (imageUrl && typeof imageUrl === 'string') {
            embed.image = { url: imageUrl };
        }
    }

    console.log('[Discord Webhook] Validated payload:', {
        webhookUrl,
        embed,
        fields: validatedFields
    });
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [embed]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to send Discord webhook. Status: ${response.status} ${response.statusText}`, errorText);
            Sentry.captureMessage(`Discord webhook send failed: ${response.status}`, {
                level: 'error',
                extra: {
                    statusText: response.statusText,
                    responseBody: errorText,
                    webhookTitle: statusTitle,
                }
            });
        }
    } catch (error) {
        console.error('Error sending Discord webhook:', error);
        Sentry.captureException(error, {
            extra: {
                context: 'sendFormInteractionWebhookInternal Fetch Error',
                webhookTitle: statusTitle,
            }
        });
    }
};

const filterFormData = (formData, bbCodeVersion) => {
    const relevantFields = getRelevantFields(bbCodeVersion);
    const filteredData = {};

    relevantFields.forEach(field => {
        if (formData.hasOwnProperty(field)) {
            filteredData[field] = formData[field];
        }
    });

    return filteredData;
};

export const handleFormCopyAndNotify = async ({
    formData,
    bbCodeVersion,
    selectedAgencyGroup,
    getBBCodeContent,
    getFormDefinition,
    saveReport,
    showNotification,
    removeNotification,
    handleAgencySelect,
    setLastWebhookIdentifier,
    lastWebhookIdentifier,
    commitInfo,
    database,
    getCurrentReportAuthor,
    // GTAW OAuth data for automatic character inclusion
    isGtaAuthenticated = false,
    gtaWorldUser = null,
    // Employee lists for correct category/rank lookup
    coronerListData = [],
    phmcListData = [],
}) => {
    // --- Step 1: Generate BBCode ---
    const bbCodeToCopy = getBBCodeContent();
    const definition = getFormDefinition(bbCodeVersion);
    const versionName = definition ? definition.name : "Unknown Form";

    if (!bbCodeToCopy) {
        showNotification(`Failed to generate BBCode for ${versionName}. Please check form data.`, 'error');
        Sentry.captureMessage(`getBBCodeContent returned null/undefined for bbCodeVersion: ${bbCodeVersion}`, 'error');
        return;
    }

    // --- Step 2: Save Report to Firebase (if applicable) ---
    let saveResult = { success: false };
    let savingAsCivilian = false;

    if ([3, 24, 25, 26].includes(bbCodeVersion)) { // Civilian Forms
        savingAsCivilian = true;
        const bbCodeContent = getBBCodeContent();
        const key = `[CIVILIAN-REPORT] - ${formData.patientName || ''} ${formData.patientFirstName || ''} ${formData.patientLastName || ''} - ${new Date().toISOString()}`;
        const sanitizedKey = comprehensiveSanitize(key);
        const reportDataToSave = {
            bbCodeVersion: bbCodeVersion,
            data: filterFormData(formData, bbCodeVersion),
            bbCode: bbCodeContent,
            timestamp: Date.now(),
            originalKey: key,
            authorName: 'CIVILIAN'
        };

        // Automatically add GTAW character data to civilian reports if user is authenticated
        if (isGtaAuthenticated && gtaWorldUser) {
            reportDataToSave.gtawUsername = gtaWorldUser.username;
            reportDataToSave.gtawCharacterId = gtaWorldUser.id;
            reportDataToSave.gtawCharacterName = gtaWorldUser.faction ? 
                ((gtaWorldUser.faction.firstname && gtaWorldUser.faction.lastname) ? 
                    `${gtaWorldUser.faction.firstname} ${gtaWorldUser.faction.lastname}` : 
                    gtaWorldUser.faction.characterName || gtaWorldUser.username) : 
                gtaWorldUser.username;
            reportDataToSave.gtawSyncTimestamp = new Date().toISOString();
            reportDataToSave.gtawSyncVersion = '1.1';
            
            console.log('📄 [Civilian Report Save] Automatically added GTAW data to civilian report:', {
                username: reportDataToSave.gtawUsername,
                characterId: reportDataToSave.gtawCharacterId,
                characterName: reportDataToSave.gtawCharacterName,
                reportType: 'CIVILIAN'
            });
        }

        try {
            const reportRef = ref(database, `savedReports/CIVILIAN/${sanitizedKey}`);
            await set(reportRef, reportDataToSave);
            const webhookPayload = {
                reportKey: sanitizedKey,
                originalKey: key,
                bbCodeVersion: bbCodeVersion,
                hasGtawData: isGtaAuthenticated && !!gtaWorldUser
            };
            
            if (isGtaAuthenticated && gtaWorldUser) {
                webhookPayload.gtawUsername = gtaWorldUser.username;
                webhookPayload.gtawCharacterId = gtaWorldUser.id;
                webhookPayload.gtawCharacterName = reportDataToSave.gtawCharacterName;
            }
            
            await logWebhookToFirebase('report_saved_civilian', webhookPayload);
            saveResult = { success: true };
        } catch (error) {
            console.error("Error saving Civilian report to Firebase:", error);
            Sentry.captureException(error, { extra: { context: 'Firebase set report' } });
            saveResult = { success: false, error: 'Failed to save Civilian report to Firebase.' };
        }
    } else {
        saveResult = await saveReport();
    }

    if (!saveResult.success && !savingAsCivilian) {
        // If there was a specific validation error message from saveReport, show it.
        // Otherwise, show a generic message.
        const message = saveResult.error || 'Report failed to save. Copying and webhook notification will be skipped.';
        showNotification(message, 'error');
        return;
    }

    // --- Step 3: Copy BBCode to Clipboard ---
    const copySuccessful = await copyToClipboard(bbCodeToCopy, showNotification, `${versionName} copied to clipboard!`);

    if (!copySuccessful) {
        showNotification('BBCode could not be copied. Webhook notification will be skipped.', 'warning');
        return;
    }

    // --- Step 4: Send Discord Webhook Notification ---
    try {
        let discordWebhookUrl = import.meta.env.VITE_DEV_WEBHOOK;

        if (discordWebhookUrl) {
            let currentIdentifier;
            if (bbCodeVersion === 11) {
                const { decedents } = formData;
                currentIdentifier = decedents.map(d => `${d.decedentName || ''}|${d.decedentOOC || ''}`).join(',');
            } else {
                const {decedentName,decedentOOC } = formData;
                currentIdentifier =  `${decedentName || ''}|${decedentOOC || ''}`;
            }

            let firebaseSavedCount = 0;
            let userSavedCount = undefined;
            try {
                const allReportsRef = ref(database, 'savedReports');
                const snapshot = await get(allReportsRef);
                if (snapshot.exists()) {
                    const usersData = snapshot.val();
                    firebaseSavedCount = Object.values(usersData).reduce((total, userReports) => total + Object.keys(userReports).length, 0);
                }
            } catch (error) {
                console.error("Error fetching total saved reports count from Firebase:", error);
                Sentry.captureException(error, { extra: { context: 'Firebase Total Saved Reports Count' } });
            }

            try {
                let userKey;
                if (savingAsCivilian) {
                    userKey = 'CIVILIAN'; // Directly use 'CIVILIAN' for civilian forms
                } else {
                    userKey = getCurrentReportAuthor(formData);
                    if (!userKey) {
                        userKey = 'UNKNOWN';
                    }
                }
                
                userKey = comprehensiveSanitize(userKey);
                let userReportsRef = ref(database, `savedReports/${userKey}`);
                let userSnapshot = await get(userReportsRef);

                if (!userSnapshot.exists() && userKey.includes('_')) {
                    const oldUserKey = userKey.replace(/_/g, ' ');
                    userReportsRef = ref(database, `savedReports/${oldUserKey}`);
                    userSnapshot = await get(userReportsRef);
                }

                if (userSnapshot.exists()) {
                    const userReports = userSnapshot.val();
                    userSavedCount = Object.keys(userReports).length;
                } else {
                    userSavedCount = 0;
                }
            } catch (error) {
                console.error("Error fetching user saved reports count from Firebase:", error);
                Sentry.captureException(error, { extra: { context: 'Firebase User Saved Reports Count' } });
            }

            let webhookActionMessage = "BBCode Copied";
            if (saveResult.success) {
                webhookActionMessage = "BBCode Copied & Report Saved to Firebase";
            }

            await sendFormInteractionWebhookInternal({
                webhookUrl: discordWebhookUrl,
                formData,
                versionName,
                bbCodeVersion,
                selectedAgencyGroup,
                statusTitle: "Someone has used your generator!",
                statusColor: 0x00FF00,
                actionMessage: webhookActionMessage,
                commitInfo,
                firebaseSavedCount,
                userSavedCount,
                coronerListData,
                phmcListData,
            });

            setLastWebhookIdentifier(currentIdentifier);

            if (bbCodeVersion === 1 && formData.showRequestingOfficerInput === true) {
                const buttonJSX = (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (typeof handleAgencySelect === 'function') {
                                handleAgencySelect(2);
                            } else {
                                console.error('handleFormCopyAndNotify: Cannot switch form, the component may have unmounted.');
                                showNotification('Action failed: The context was lost. Please navigate to the form manually.', 'error');
                            }
                        }}
                        style={{ marginLeft: '10px', cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.875rem', border: '1px solid #0dcaf0', background: '#0dcaf0', color: 'white', borderRadius: '0.25rem' }}
                    >
                        Switch to Coroner Email Form
                    </button>
                );
                showNotification(
                    <>A Coroner Email was requested for this report. {buttonJSX}</>,
                    'info-circle',
                    15000
                );
            }
        } else {
            console.warn(`Discord webhook URL not set for ${selectedAgencyGroup || 'default'} group, skipping notification.`);
        }
    } catch (error) {
        console.error('Error during webhook notification in service: ', error);
        Sentry.captureException(error, { extra: { context: 'handleFormCopyAndNotify Webhook Error', errorName: error.name, errorMessage: error.message } });
        showNotification('Report processed, but failed to send Discord notification.', 'warning');
    }
};
export const sendErrorToDiscord = async (errorDetails) => {
    // A dedicated webhook for errors, or a fallback.
    const webhookUrl = import.meta.env.VITE_ERROR_DISCORD_WEBHOOK_URL || import.meta.env.VITE_DEV_WEBHOOK;

    if (!webhookUrl) {
        console.error("Error reporting webhook URL not configured. Cannot send error report.");
        // We can't report that we can't report, so just log to console.
        return;
    }

    const { message, source, lineno, colno, error } = errorDetails;
    const stack = error?.stack || (error ? JSON.stringify(error) : 'Not available');

    const embedData = {
        title: "🚨 Unhandled Application Error 🚨",
        description: `An uncaught error was detected. This is a fallback report, likely because Sentry is blocked or failed.`, 
        color: 0xFF0000, // Red
        fields: [
            { name: "Error Message", value: `
${message}
`, 
 inline: false },
            { name: "Source File", value: source || 'N/A', inline: true },
            { name: "Line", value: lineno ? lineno.toString() : 'N/A', inline: true },
            { name: "Column", value: colno ? colno.toString() : 'N/A', inline: true },
            { name: "Stack Trace", value: `
${stack.substring(0, 1000)}
`,
 inline: false },
        ],
        footerText: "Error Fallback Reporter"
    };

    // We don't have commitInfo here, so we pass an empty object.
    await sendDiscordWebhookInternal(webhookUrl, embedData, {});
};
