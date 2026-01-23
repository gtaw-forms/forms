import { useCallback } from 'react';
import { database } from '../firebase';
import { ref, set, runTransaction } from 'firebase/database';
import * as Sentry from "@sentry/react";
import { useNotification } from '../contexts/NotificationContext';
import { useData } from '../contexts/DataContext';
import { getCharacterName, getCharacterID } from '../utils/characterUtils';
import useGtaWorldAuth from './useGtaWorldAuth';

const comprehensiveSanitize = (str) => {
    if (!str) return '';
    let sanitized = str.trim().replace(/[.#$[\/ \]]+/g, '_');
    sanitized = sanitized.replace(/_{2,}/g, '_');
    sanitized = sanitized.replace(/^_+|_+$/g, '');
    return sanitized;
};

export const useMigrationSaver = () => {
    const { showNotification } = useNotification();
    const { sendDataRequestLog } = useData();
    const { user: gtaWorldUser, isAuthenticated: isGtaAuthenticated } = useGtaWorldAuth();

    const logWebhook = useCallback(async (type, payload) => {
        // Log to Firebase RTDB
        const logRef = ref(database, 'webhook_logs/' + Date.now());
        try {
            await set(logRef, {
                type: type,
                payload: payload,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error("Error logging webhook to Firebase:", error);
        }

        // Send to Discord
        const discordWebhookUrl = import.meta.env.VITE_DISCORD_WEBHOOK_FORMS || import.meta.env.VITE_DISCORD_REPORTS_WEBHOOK_URL;
        if (discordWebhookUrl) {
            try {
                const discordPayload = {
                    embeds: [
                        {
                            title: 'Legacy Report Migrated',
                            description: `A legacy report has been migrated by **${payload.author}**.`,
                            color: 0xf59e0b,
                            fields: [
                                { name: 'Author', value: payload.author, inline: true },
                                { name: 'Form Name', value: payload.formName, inline: true },
                                { name: 'Report Title', value: `\`${payload.originalKey}\``, inline: false },
                            ],
                            timestamp: new Date().toISOString(),
                            footer: {
                                text: `BBCodeVersion: ${payload.bbCodeVersion} | ReportKey: ${payload.reportKey}`
                            }
                        }
                    ]
                };

                if (payload.hasGtawData) {
                    discordPayload.embeds[0].fields.push(
                        { name: 'GTAW Username', value: payload.gtawUsername, inline: true },
                        { name: 'GTAW Character', value: `${payload.gtawCharacterName} (${payload.gtawCharacterId})`, inline: true }
                    );
                }

                await fetch(discordWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(discordPayload)
                });
            } catch (error) {
                console.error("Error sending webhook to Discord:", error);
            }
        }
    }, []);

    const saveMigratedReport = useCallback(async (migratedReport, bbCodeContent) => {
        const currentAuthor = migratedReport.authorName;
        const key = migratedReport.originalKey;

        if (!currentAuthor) {
            showNotification('Cannot determine report author for migration.', 'error');
            return { success: false, error: 'Cannot determine report author for migration.' };
        }

        const sanitizedAuthorId = comprehensiveSanitize(currentAuthor);
        const sanitizedKey = key.trim().replace(/[.#$[\/ \]]+/g, '_') + '_' + Date.now();

        let baseReportPath = `savedReports`;
        let baseBbCodePath = `savedReportBBCode`;

        if (migratedReport.hasOwnProperty('legacy') && migratedReport.legacy === false) {
            baseReportPath = `newSavedReports`;
            baseBbCodePath = `newSavedReportBBCode`;
        }
        
        const reportPath = `${baseReportPath}/${sanitizedAuthorId}/${sanitizedKey}`;
        const bbCodePath = `${baseBbCodePath}/${sanitizedAuthorId}/${sanitizedKey}`;

        let gtawDataFound = false;
        let userForGtawData = null;

        if (isGtaAuthenticated && gtaWorldUser) {
            gtawDataFound = true;
            userForGtawData = gtaWorldUser;
        } else {
            const storedProfileRaw = localStorage.getItem('phmc_gtaw_oauth_profile');
            if (storedProfileRaw) {
                try {
                    const storedProfile = JSON.parse(storedProfileRaw);
                    if (storedProfile) {
                        gtawDataFound = true;
                        userForGtawData = storedProfile;
                    }
                } catch (e) {
                    console.error("Error parsing stored profile:", e);
                }
            }
        }

        try {
            const reportRef = ref(database, reportPath);
            const bbCodeRef = ref(database, bbCodePath);
            const userReportCountRef = ref(database, `userReportCounts/${sanitizedAuthorId}/total`);

            await Promise.all([
                set(reportRef, migratedReport),
                set(bbCodeRef, { bbCode: bbCodeContent }),
                runTransaction(userReportCountRef, (currentCount) => (currentCount || 0) + 1)
            ]);

            if (sendDataRequestLog) {
                const reportSize = new TextEncoder().encode(JSON.stringify(migratedReport)).length;
                const bbCodeSize = new TextEncoder().encode(JSON.stringify({ bbCode: bbCodeContent })).length;
                sendDataRequestLog(
                    'useMigrationSaver.js/saveMigratedReport',
                    false,
                    'Firebase Write',
                    reportSize + bbCodeSize,
                    isGtaAuthenticated,
                    getCharacterName(gtaWorldUser),
                    `Report: ${reportPath}, BBCode: ${bbCodePath}`
                );
            }

            showNotification(`Migrated Report "${key}" saved for ${currentAuthor}!`, 'save');

            const formName = migratedReport.formName || `FormV${migratedReport.bbCodeVersion}`;
            const webhookPayload = {
                author: currentAuthor,
                reportKey: sanitizedKey,
                originalKey: key,
                formName: formName,
                bbCodeVersion: migratedReport.bbCodeVersion,
                hasGtawData: gtawDataFound,
                data: migratedReport.data
            };

            if (gtawDataFound && userForGtawData) {
                webhookPayload.gtawUsername = userForGtawData.username;
                webhookPayload.gtawCharacterId = getCharacterID(userForGtawData);
                webhookPayload.gtawCharacterName = getCharacterName(userForGtawData);
            }

            await logWebhook(`migrated_report_saved by ${currentAuthor}`, webhookPayload);

            return { success: true };

        } catch (error) {
            console.error("Error saving migrated report:", error);
            Sentry.captureException(error, { extra: { context: 'saveMigratedReport' } });
            showNotification('Something went wrong while saving migrated report!', 'error');
            return { success: false, error: error.message };
        }
    }, [showNotification, sendDataRequestLog, isGtaAuthenticated, gtaWorldUser, logWebhook]);

    return { saveMigratedReport };
};