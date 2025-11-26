import { useCallback } from 'react';
import { database } from '../../firebase';
import { ref, set, runTransaction } from 'firebase/database';
import * as Sentry from "@sentry/react";

const comprehensiveSanitize = (str) => {
    if (!str) return '';
    let sanitized = str.trim().replace(/[.#$[\/ \]]+/g, '_');
    sanitized = sanitized.replace(/_{2,}/g, '_');
    sanitized = sanitized.replace(/^_+|_+$/g, '');
    return sanitized;
};

export const useFormHandler = (showNotification) => {
    const saveReport = useCallback(async (reportName, bbCodeContent, author, formData, filterFormData) => {
        if (!reportName || !bbCodeContent || !author) {
            const message = 'Report name, content, and author are required to save a report.';
            showNotification(message, 'error');
            return { success: false, error: message };
        }

        const key = `[BBCODE] ${reportName} - ${new Date().toISOString().split('T')[0]}`;
        const sanitizedAuthorId = comprehensiveSanitize(author);
        const sanitizedKey = key.trim().replace(/[.#$[\/ \]]+/g, '_') + '_' + Date.now();

        const reportDataToSave = {
            bbCodeVersion: 'FormHandler',
            data: filterFormData(formData, 'FormHandler'),
            timestamp: Date.now(),
            originalKey: key,
            authorName: author,
            isFormHandler: true,
        };

        const reportPath = `savedReports/${sanitizedAuthorId}/${sanitizedKey}`;
        const bbCodePath = `savedReportBBCode/${sanitizedAuthorId}/${sanitizedKey}`;

        try {
            const reportRef = ref(database, reportPath);
            const bbCodeRef = ref(database, bbCodePath);
            const userReportCountRef = ref(database, `userReportCounts/${sanitizedAuthorId}/total`);

            await Promise.all([
                set(reportRef, reportDataToSave),
                set(bbCodeRef, { bbCode: bbCodeContent }),
                runTransaction(userReportCountRef, (currentCount) => (currentCount || 0) + 1)
            ]);

            showNotification(`Report "${key}" saved for ${author} to Firebase!`, 'save');

            return { success: true };

        } catch (error) {
            console.error("Error saving Form Handler report to Firebase:", error);
            Sentry.captureException(error, { extra: { context: 'Firebase set form handler report' } });
            const message = 'Something unexpected went wrong while saving the BBCode report.';
            showNotification(message, 'error');
            return { success: false, error: message };
        }
    }, [showNotification]);

    return { saveReport };
};