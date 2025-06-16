// src/services/notificationService.js
import * as Sentry from "@sentry/react";
import { ref, get } from 'firebase/database';

// Helper function to send a generic Discord webhook (previously in webhookService.js)
const sendDiscordWebhookInternal = async (webhookUrl, embedData, commitInfo = {}, contextMessage = "") => {
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

// --- MODIFIED: General PHMC Recruitment Webhook Sender ---
const sendPhmcRecruitmentWebhook = async ({
    webhookUrl,
    formData,
    commitInfo,
    actionMessage,
    selectOptions,
    formDefinition, // Added: to get form name and determine position details source
}) => {
    const {
        applicantTitleAndFullName,
        recruitmentPosition,
        applicantContactDetails,
        oocUcpName,
        oocDiscord,
    } = formData;

    let positionDetailsSource = null;
    // Determine the correct source for position details based on the form's titleKey
    // This logic mirrors what's in App.js's generateTitle and getBBCodeContent
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
        color: 0x007bff, // Blue, or your PHMC Recruitment theme color
        fields: fields,
        footerText: "PHMC Recruitment Forms", // Custom footer
    };

    await sendDiscordWebhookInternal(webhookUrl, embedData, commitInfo);
};

// --- MODIFIED: General PHMC Recruitment Handler ---
export const handlePhmcRecruitmentCopyAndNotify = async ({
    formData,
    getBBCodeContent,
    showNotification,
    commitInfo,
    selectOptions,
    formDefinition, // Added: to pass to the webhook sender
}) => {
    const bbCodeToCopy = getBBCodeContent();
    const formName = formDefinition?.name || "PHMC Recruitment Application";

    if (!bbCodeToCopy) {
        showNotification(`Failed to generate ${formName} BBCode. Copying skipped.`, 'error');
        Sentry.captureMessage(`getBBCodeContent returned null/undefined for ${formName}`, 'error');
        return;
    }

    try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
            throw new Error("Clipboard API not available");
        }
        await navigator.clipboard.writeText(bbCodeToCopy);
        showNotification(`${formName} BBCode copied to clipboard!`, 'clipboard');

        const discordWebhookUrl = process.env.REACT_APP_PHMC_RECRUITMENT_DISCORD_WEBHOOK_URL || process.env.REACT_APP_DISCORD_WEBHOOK_URL;

        if (discordWebhookUrl) {
            await sendPhmcRecruitmentWebhook({ // Call the generalized function
                webhookUrl: discordWebhookUrl,
                formData,
                commitInfo,
                actionMessage: `${formName} BBCode Copied`,
                selectOptions,
                formDefinition, // Pass the definition
            });
        } else {
            console.warn(`Discord webhook URL for ${formName} not set, skipping notification.`);
            showNotification("BBCode copied, but Discord notification for recruitment not configured.", 'warning');
        }

    } catch (error) {
        console.error(`Error during ${formName} copy or webhook: `, error);
        Sentry.captureException(error, { extra: { context: `handlePhmcRecruitmentCopyAndNotify for ${formName}` } });
        let userMessage = `Failed to copy ${formName} BBCode.`;
        if (error.message === "Clipboard API not available") {
            userMessage = "Clipboard API not available! BBCode not copied.";
        }
        showNotification(userMessage, 'exclamation-triangle');
    }
};
// --- END MODIFICATIONS ---

// Helper function to prepare and send a standardized form interaction webhook (previously in webhookService.js)
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
    } = formData;

    let userValue = 'Unknown User';

    if (selectedAgencyGroup === 'SAAA') {
        if (registrantFullName) {
            userValue = `SAAA Registrant: ${registrantFullName}`;
        } else if (ceoFullName) {
            userValue = `SAAA CEO: ${ceoFullName}`;
        } else if (patientFirstName || patientLastName) { // For SAAA Entry Job
            userValue = `SAAA Applicant: ${patientFirstName || ''} ${patientLastName || ''}`.trim();
        }
        // Add more SAAA specific user identifiers if needed
    } else { // PHMC or Coroner group
        if (coronerEmployee) {
            userValue = `${coronerRank || 'Coroner'} ${coronerEmployee}`;
        } else if (phmcEmployee) {
            userValue = `Hospital Staff ${phmcEmployee}`;
        } else if (patientFirstName || patientLastName) { // General patient/user for PHMC civilian forms
            userValue = `${patientFirstName || ''} ${patientLastName || ''}`.trim();
        } else if (patientName) { // Fallback patient name
            userValue = patientName;
        }
    }

    const primaryIdentifier = patientName || decedentName || patientID || registrantFullName || ceoFullName || (selectedAgencyGroup === 'SAAA' ? (formData.aircraftType || formData.companyName || 'SAAA Record') : 'N/A');

    const fields = [
        { name: "User", value: userValue, inline: true },
        { name: "Form Type", value: versionName, inline: true },
        { name: "Primary Identifier", value: primaryIdentifier, inline: true },
        // Only show OOC Name and Requesting Officer if not SAAA, or if relevant to SAAA
        ...(selectedAgencyGroup !== 'SAAA' || formData.decedentOOC ? [{ name: "OOC Name", value: decedentOOC || "N/A", inline: true }] : []),
        ...(selectedAgencyGroup !== 'SAAA' || formData.requestingOfficer ? [{ name: "Requesting Officer", value: requestingOfficer || "N/A", inline: true }] : []),
        { name: "Timestamp", value: new Date().toLocaleString(), inline: false },
        { name: "Action", value: actionMessage, inline: false },
    ];

    if (firebaseSavedCount !== undefined) {
        fields.push({ name: "Total Saved Reports (Firebase)", value: firebaseSavedCount.toString(), inline: false });
    }
    if (errorMessage) {
        fields.push({ name: "Error Details", value: errorMessage, inline: false });
    }

    const embedData = {
        title: statusTitle,
        color: statusColor,
        fields: fields,
        footerText: "Forms Tool",
    };

    await sendDiscordWebhookInternal(webhookUrl, embedData, commitInfo);
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
    const bbCodeToCopy = getBBCodeContent();
    const definition = getFormDefinition(bbCodeVersion);
    const versionName = definition ? definition.name : "Unknown Form";

    if (!bbCodeToCopy) {
        showNotification(`Failed to generate BBCode for ${versionName}. Please check form data. Copying and saving skipped.`, 'error');
        Sentry.captureMessage(`getBBCodeContent returned null/undefined for bbCodeVersion: ${bbCodeVersion} in handleFormCopyAndNotify`, 'error');
        return;
    }

    const canProceedAfterSaveAttempt = await saveReport();

    if (!canProceedAfterSaveAttempt) {
        if (selectedAgencyGroup === 'PHMC Recruitment') {
            console.log("PHMC Recruitment form: Processed (copied to clipboard, no Firebase save). Generic webhook skipped.");
            return;
        } else if (selectedAgencyGroup !== 'SAAA') {
            console.log("Report saving failed for non-SAAA, non-PHMC Recruitment form, or validation error occurred. Webhook and further copy skipped.");
            return;
        }
    }

    const {
        decedentName, decedentOOC,
    } = formData;

    let firebaseSavedCount = 0;
    try {
        const allReportsRef = ref(database, 'savedReports');
        const snapshot = await get(allReportsRef);
        if (snapshot.exists()) {
            const usersData = snapshot.val();
            for (const userId in usersData) {
                if (typeof usersData[userId] === 'object' && usersData[userId] !== null) {
                    firebaseSavedCount += Object.keys(usersData[userId]).length;
                }
            }
        }
    } catch (error) {
        console.error("Error fetching total saved reports count from Firebase:", error);
        Sentry.captureException(error, { extra: { context: 'Firebase Total Saved Reports Count in Service' } });
        firebaseSavedCount = 0;
    }

    try {
        if (selectedAgencyGroup !== 'SAAA') {
            if (!navigator.clipboard || !navigator.clipboard.writeText) {
                throw new Error("Clipboard API not available");
            }
            await navigator.clipboard.writeText(bbCodeToCopy);
            showNotification(`${versionName} copied to clipboard!`, 'check-circle');

            if (bbCodeVersion === 1 && formData.showRequestingOfficerInput === true) {
                const buttonJSX = (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleAgencySelect(2);
                        }}
                        style={{ marginLeft: '10px', cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.875rem', border: '1px solid #0dcaf0', background: '#0dcaf0', color: 'white', borderRadius: '0.25rem' }}
                    >
                        Switch to Coroner Email Form
                    </button>
                );
                showNotification(
                    <>
                        A Coroner Email was requested for this report. {buttonJSX}
                    </>,
                    'info-circle',
                    15000
                );
            }
        }

        let discordWebhookUrl;
        if (selectedAgencyGroup === 'SAAA') {
            discordWebhookUrl = process.env.REACT_APP_SAAA_DISCORD_WEBHOOK_URL || process.env.REACT_APP_DISCORD_WEBHOOK_URL;
            if (!process.env.REACT_APP_SAAA_DISCORD_WEBHOOK_URL && process.env.REACT_APP_DISCORD_WEBHOOK_URL) {
                console.warn("SAAA specific webhook URL (REACT_APP_SAAA_DISCORD_WEBHOOK_URL) not set, using default PHMC/Coroner webhook URL.");
            }
        } else {
            discordWebhookUrl = process.env.REACT_APP_DISCORD_WEBHOOK_URL;
        }

        if (discordWebhookUrl) {
            const currentIdentifier = selectedAgencyGroup === 'SAAA'
                ? `${formData.registrantFullName || formData.ceoFullName || formData.patientFirstName || 'SAAA_Form'}_${Date.now()}`
                : `${decedentName || ''}|${decedentOOC || ''}`;

            if (currentIdentifier && currentIdentifier === lastWebhookIdentifier && selectedAgencyGroup !== 'SAAA') {
                console.log('Duplicate PHMC/Coroner report copy detected, skipping webhook.');
            } else {
                let webhookActionMessage = "BBCode Copied";
                if (canProceedAfterSaveAttempt && selectedAgencyGroup !== 'SAAA') {
                    webhookActionMessage = "BBCode Copied & Report Save Processed";
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
            }
        } else {
            console.warn(`Discord webhook URL not set for ${selectedAgencyGroup || 'default'} group, skipping notification.`);
        }

    } catch (error) {
        console.error('Error during copy or webhook in service: ', error);
        Sentry.captureException(error, { extra: { context: 'handleFormCopyAndNotify Service', errorName: error.name, errorMessage: error.message } });

        const saveStatusMessage = (selectedAgencyGroup === 'SAAA')
            ? "SAAA form processed (no server save)."
            : (canProceedAfterSaveAttempt ? "Report saving process was run." : "Report saving failed or was skipped.");

        let copyFailUserMessage = `An error occurred. ${saveStatusMessage}`;
        if (error.message === "Clipboard API not available") {
            copyFailUserMessage = `Clipboard API not available! BBCode not copied. ${saveStatusMessage}`;
        } else if (selectedAgencyGroup !== 'SAAA') {
            copyFailUserMessage = `Failed to copy BBCode! ${saveStatusMessage}`;
        } else {
            copyFailUserMessage = `Error after BBCode copy. ${saveStatusMessage}`;
        }
        showNotification(copyFailUserMessage, 'exclamation-triangle');

        let failureWebhookUrl;
        if (selectedAgencyGroup === 'SAAA') {
            failureWebhookUrl = process.env.REACT_APP_SAAA_DISCORD_WEBHOOK_URL || process.env.REACT_APP_DISCORD_WEBHOOK_URL;
        } else {
            failureWebhookUrl = process.env.REACT_APP_DISCORD_WEBHOOK_URL;
        }

        if (failureWebhookUrl) {
            let failureActionMessage = `Error during processing. ${saveStatusMessage}`;
            if (error.message === "Clipboard API not available") {
                failureActionMessage = `Clipboard API unavailable. ${saveStatusMessage}`;
            } else if (selectedAgencyGroup !== 'SAAA') {
                failureActionMessage = `BBCode could not be copied. ${saveStatusMessage}`;
            } else {
                failureActionMessage = `Error after BBCode copy. ${saveStatusMessage}`;
            }

                await sendFormInteractionWebhookInternal({
                    webhookUrl: failureWebhookUrl,
                    formData,
                    versionName,
                    selectedAgencyGroup,
                    statusTitle: `Processing Failed (...)`,
                    statusColor: 0xFF0000,
                    actionMessage: failureActionMessage,
                    commitInfo,
                    errorMessage: error.message,
                });
        }
    }
};
