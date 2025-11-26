import { useCallback } from 'react';
import { database } from '../firebase';
import { ref, set, runTransaction } from 'firebase/database';
import * as Sentry from "@sentry/react";
import useGtaWorldAuth from './useGtaWorldAuth';
import { getCharacterName, getCharacterID } from '../utils/characterUtils';
import { useNotification } from '../contexts/NotificationContext';

const comprehensiveSanitize = (str) => {
    if (!str) return '';
    let sanitized = str.trim().replace(/[.#$[\/ \]]+/g, '_');
    sanitized = sanitized.replace(/_{2,}/g, '_');
    sanitized = sanitized.replace(/^_+|_+$/g, '');
    return sanitized;
};

export const useFormSaver = () => {
    const { user: gtaWorldUser, isAuthenticated: isGtaAuthenticated } = useGtaWorldAuth();
    const { showNotification } = useNotification();

    const saveReport = useCallback(async (selectedForm, formValues, title, bbCode) => {
        if (!selectedForm || !formValues || !title || !bbCode) {
            showNotification('Missing data required to save the report.', 'error');
            return { success: false, error: 'Missing data.' };
        }

        const currentAuthor = getCharacterName(gtaWorldUser);
        if (!currentAuthor) {
            showNotification('Cannot determine report author. Please ensure you are signed in.', 'error');
            return { success: false, error: 'Cannot determine report author.' };
        }

        const sanitizedAuthorId = comprehensiveSanitize(currentAuthor);
        const sanitizedKey = title.trim().replace(/[.#$[\/ \]]+/g, '_') + '_' + Date.now();

        const reportDataToSave = {
            formId: selectedForm.firebaseKey,
            formName: selectedForm.name,
            data: formValues,
            timestamp: Date.now(),
            originalKey: title,
            authorName: currentAuthor,
            legacy: false, // As requested
        };

        // Add GTAW Auth data if available
        if (isGtaAuthenticated && gtaWorldUser) {
            reportDataToSave.gtawUsername = gtaWorldUser.username;
            reportDataToSave.gtawCharacterId = getCharacterID(gtaWorldUser);
            reportDataToSave.gtawCharacterName = getCharacterName(gtaWorldUser);
            reportDataToSave.gtawSyncTimestamp = new Date().toISOString();
        }

        const reportPath = `newSavedReports/${sanitizedAuthorId}/${sanitizedKey}`;
        const bbCodePath = `newSavedReportBBCode/${sanitizedAuthorId}/${sanitizedKey}`;

        try {
            const reportRef = ref(database, reportPath);
            const bbCodeRef = ref(database, bbCodePath);

            // Save both main report data and BBCode data in parallel
            await Promise.all([
                set(reportRef, reportDataToSave),
                set(bbCodeRef, { bbCode: bbCode }),
            ]);

            showNotification(`Report "${title}" saved successfully!`, 'save');
            return { success: true };

        } catch (error) {
            console.error("Error saving new report to Firebase:", error);
            Sentry.captureException(error, { extra: { context: 'useFormSaver - saveReport' } });
            showNotification('Something went wrong while saving the report.', 'error');
            return { success: false, error: error.message };
        }
    }, [gtaWorldUser, isGtaAuthenticated, showNotification]);

    return { saveReport };
};
