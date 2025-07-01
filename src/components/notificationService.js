import * as Sentry from "@sentry/react";
import { ref, get } from 'firebase/database';

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

// NEW: Webhook for when a player scores a bingo
export const sendBingoNotification = async ({ scorer, bingoType, lineName, commitInfo }) => {
    const webhookUrl = process.env.REACT_APP_BINGO_DISCORD_WEBHOOK_URL || process.env.REACT_APP_DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
        console.warn("Bingo webhook URL not configured. Skipping notification.");
        return;
    }

    const embedData = {
        title: "🎉 BINGO! 🎉",
        description: `**${scorer || 'A player'}** just scored a BINGO!`,
        color: 0xffd700, // Gold
        fields: [
            { name: "Game", value: bingoType || 'Unknown', inline: true },
            { name: "Line", value: lineName || 'Unknown', inline: true },
        ],
        footerText: "PHMC Bingo",
    };

    await sendDiscordWebhookInternal(webhookUrl, embedData, commitInfo);
};

// NEW: Webhook for when a player requests a new phrase
export const sendPhraseRequestNotification = async ({ requester, phrase, bingoType, commitInfo }) => {
    const webhookUrl = process.env.REACT_APP_BINGO_DISCORD_WEBHOOK_URL || process.env.REACT_APP_DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
        console.warn("Bingo webhook URL not configured. Skipping notification.");
        return;
    }

    const embedData = {
        title: "📝 New Bingo Phrase Request",
        description: `A new phrase has been requested for review.`,
        color: 0x7289DA, // Discord Blurple
        fields: [
            { name: "Requested Phrase", value: `\`\`\`${phrase || 'N/A'}\`\`\``, inline: false },
            { name: "Requested For", value: bingoType || 'Unknown Game', inline: true },
            { name: "Requested By", value: requester || 'Anonymous', inline: true },
        ],
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
        const discordWebhookUrl = process.env.REACT_APP_PHMC_RECRUITMENT_DISCORD_WEBHOOK_URL || process.env.REACT_APP_DISCORD_WEBHOOK_URL;

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
    selectedAgencyGroup,
    statusTitle,
    statusColor,
    actionMessage,
    commitInfo,
    firebaseSavedCount,
    errorMessage,
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

    if (selectedAgencyGroup === 'SAAA') {
        if (registrantFullName) {
            userValue = `SAAA Registrant: ${registrantFullName}`;
        } else if (ceoFullName) {
            userValue = `SAAA CEO: ${ceoFullName}`;
        } else if (patientFirstName || patientLastName) {
            userValue = `SAAA Applicant: ${patientFirstName || ''} ${patientLastName || ''}`.trim();
        }
    } else {
        if (coronerEmployee) {
            userValue = `${coronerRank || 'Coroner'} ${coronerEmployee}`;
        } else if (phmcEmployee) {
            userValue = `Hospital Staff ${phmcEmployee}`;
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

    // --- MODIFICATION START ---
    // Remove the previous field for the Autopsy Image URL
    // The image will now be part of the main embed structure if available.
    // --- MODIFICATION END ---


    if (firebaseSavedCount !== undefined) {
        fields.push({ name: "Total Saved Reports (Firebase)", value: firebaseSavedCount.toString(), inline: false });
    }
    if (errorMessage) {
        fields.push({ name: "Error Details", value: errorMessage, inline: false });
    }

    // Construct the embed object
    const embed = {
        title: statusTitle,
        description: actionMessage,
        color: statusColor,
        fields: fields,
        timestamp: new Date().toISOString(),
        footer: {
            text: `Forms Tool | gh-pages ${commitInfo.sha || 'N/A'}`
        },
        // --- MODIFICATION START ---
        // Conditionally add the image to the embed if it's an Autopsy Report and the URL exists
        ...(versionName === "Autopsy Report" && autopsyDiagramImgurUrl && { image: { url: autopsyDiagramImgurUrl } })
        // --- MODIFICATION END ---
    };

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
                    webhookTitle: statusTitle, // Use statusTitle here as embed.title might be default
                }
            });
            // Optionally, you might want to return false or throw an error
        }
        // Optionally, return true on success
    } catch (error) {
        console.error('Error sending Discord webhook:', error);
        Sentry.captureException(error, {
            extra: {
                context: 'sendFormInteractionWebhookInternal Fetch Error',
                webhookTitle: statusTitle, // Use statusTitle here
            }
        });
        // Optionally, return false or throw the error
    }
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
    // The saveReport function should return `true` on success, and `false` if saving is not applicable (e.g., SAAA forms) or fails.
    const saveSuccessful = await saveReport();

    // For standard forms (PHMC, Coroner), if saving fails, we stop the entire process.
    if (selectedAgencyGroup !== 'SAAA' && !saveSuccessful) {
        showNotification('Report failed to save to Firebase. Copying and webhook notification will be skipped.', 'error');
        return;
    }

    // --- Step 3: Copy BBCode to Clipboard ---
    // SAAA forms don't save to Firebase, but they do need to be copied.
    const copySuccessful = await copyToClipboard(bbCodeToCopy, showNotification, `${versionName} copied to clipboard!`);

    if (!copySuccessful) {
        // If copy fails, we stop the process. The user has already been notified by copyToClipboard.
        // We might add a small extra notification for context.
        showNotification('BBCode could not be copied. Webhook notification will be skipped.', 'warning');
        return;
    }

    // --- Step 4: Send Discord Webhook Notification ---
    // This part runs if the previous steps were successful.
    try {
        let discordWebhookUrl;
        if (selectedAgencyGroup === 'SAAA') {
            discordWebhookUrl = process.env.REACT_APP_SAAA_DISCORD_WEBHOOK_URL || process.env.REACT_APP_DISCORD_WEBHOOK_URL;
        } else {
            discordWebhookUrl = process.env.REACT_APP_DISCORD_WEBHOOK_URL;
        }

        if (discordWebhookUrl) {
            const { decedentName, decedentOOC } = formData;
            const currentIdentifier = selectedAgencyGroup === 'SAAA'
                ? `${formData.registrantFullName || formData.ceoFullName || formData.patientFirstName || 'SAAA_Form'}_${Date.now()}`
                : `${decedentName || ''}|${decedentOOC || ''}`;

            // Prevent spamming webhooks for the same PHMC/Coroner report
            if (currentIdentifier && currentIdentifier === lastWebhookIdentifier && selectedAgencyGroup !== 'SAAA') {
                console.log('Duplicate PHMC/Coroner report copy detected, skipping webhook.');
                return;
            }

            // Get total saved reports count for context
            let firebaseSavedCount = 0;
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

            let webhookActionMessage = "BBCode Copied";
            if (saveSuccessful && selectedAgencyGroup !== 'SAAA') {
                webhookActionMessage = "BBCode Copied & Report Saved to Firebase";
            }

            await sendFormInteractionWebhookInternal({
                webhookUrl: discordWebhookUrl,
                formData,
                versionName,
                selectedAgencyGroup,
                statusTitle: "Someone has used your generator!",
                statusColor: 0x00FF00,
                actionMessage: webhookActionMessage,
                commitInfo,
                firebaseSavedCount,
            });

            if (selectedAgencyGroup !== 'SAAA') {
                setLastWebhookIdentifier(currentIdentifier);
            }

            // Special handling for Death Report to prompt for Coroner Email
            if (bbCodeVersion === 1 && formData.showRequestingOfficerInput === true) {
                const buttonJSX = (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleAgencySelect(2); // Switch to Coroner Email form
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
    const webhookUrl = process.env.REACT_APP_ERROR_DISCORD_WEBHOOK_URL || process.env.REACT_APP_DISCORD_WEBHOOK_URL;

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
            { name: "Error Message", value: `\`\`\`\n${message}\n\`\`\``, inline: false },
            { name: "Source File", value: source || 'N/A', inline: true },
            { name: "Line", value: lineno ? lineno.toString() : 'N/A', inline: true },
            { name: "Column", value: colno ? colno.toString() : 'N/A', inline: true },
            { name: "Stack Trace", value: `\`\`\`javascript\n${stack.substring(0, 1000)}\n\`\`\``, inline: false },
        ],
        footerText: "Error Fallback Reporter"
    };

    // We don't have commitInfo here, so we pass an empty object.
    await sendDiscordWebhookInternal(webhookUrl, embedData, {});
};
