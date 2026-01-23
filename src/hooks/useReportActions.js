import { useCallback } from 'react';
import { database } from '../firebase';
import { ref, set, get, remove } from 'firebase/database';
import * as Sentry from "@sentry/react";
import { useNotification } from '../contexts/NotificationContext';
import { useData } from '../contexts/DataContext';
import { getCharacterName } from '../utils/characterUtils';
import useGtaWorldAuth from './useGtaWorldAuth';

const comprehensiveSanitize = (str) => {
    if (!str) return '';
    let sanitized = str.trim().replace(/[.#$[\/ \]]+/g, '_');
    sanitized = sanitized.replace(/_{2,}/g, '_');
    sanitized = sanitized.replace(/^_+|_+$/g, '');
    return sanitized;
};

export const useReportActions = () => {
    const { showNotification } = useNotification();
    const { sendDataRequestLog } = useData();
    const { user: gtaWorldUser, isAuthenticated: isGtaAuthenticated } = useGtaWorldAuth();

    const deleteReportForUser = useCallback(async (report, userId, onSuccess) => {
        const reportFirebaseKey = report?.key;
        if (!userId || !reportFirebaseKey) {
            showNotification('Cannot delete report: User ID or Report Key is missing.', 'error');
            return;
        }

        const isLegacyReport = report.legacy;
        const sanitizedUserId = comprehensiveSanitize(userId);
        const reportPath = isLegacyReport
            ? `savedReports/${sanitizedUserId}/${reportFirebaseKey}`
            : `newSavedReports/${sanitizedUserId}/${reportFirebaseKey}`;
        const bbCodePath = isLegacyReport
            ? `savedReportBBCode/${sanitizedUserId}/${reportFirebaseKey}`
            : `newSavedReportBBCode/${sanitizedUserId}/${reportFirebaseKey}`;

        const reportRef = ref(database, reportPath);
        const bbCodeRef = ref(database, bbCodePath);

        try {
            await Promise.all([
                remove(reportRef),
                remove(bbCodeRef)
            ]);

            if (sendDataRequestLog) {
                sendDataRequestLog(
                    'useReportActions.js/deleteReportForUser',
                    false,
                    'Firebase Delete',
                    0,
                    isGtaAuthenticated,
                    getCharacterName(gtaWorldUser),
                    `Report: ${reportPath}, BBCode: ${bbCodePath}`
                );
            }

            showNotification(`Report deleted successfully from Firebase.`, 'trash');
            if (onSuccess) onSuccess();
        } catch (error) {
            if (sendDataRequestLog) {
                sendDataRequestLog(
                    'useReportActions.js/deleteReportForUser',
                    false,
                    'Firebase Delete Error',
                    0,
                    isGtaAuthenticated,
                    getCharacterName(gtaWorldUser),
                    `Report: ${reportPath}, BBCode: ${bbCodePath}`,
                    error.message || 'Unknown Delete Error'
                );
            }
            console.error(`Error deleting report ${reportFirebaseKey} for user ${userId}:`, error);
            Sentry.captureException(error, { extra: { context: 'deleteReportForUser', userId, reportFirebaseKey } });
            showNotification(`Failed to delete report: ${error.message}`, 'error');
        }
    }, [showNotification, sendDataRequestLog, isGtaAuthenticated, gtaWorldUser]);

    const backupUserReports = useCallback(async (userId) => {
        if (!userId) {
            return { success: false, error: "User ID is required for backup." };
        }

        const sanitizedUserId = comprehensiveSanitize(userId);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fullBackupPath = `migrateBackup/${sanitizedUserId}_${timestamp}`;

        try {
            const legacyReportsRef = ref(database, `savedReports/${sanitizedUserId}`);
            const newReportsRef = ref(database, `newSavedReports/${sanitizedUserId}`);
            const legacyBBCodeRef = ref(database, `savedReportBBCode/${sanitizedUserId}`);
            const newBBCodeRef = ref(database, `newSavedReportBBCode/${sanitizedUserId}`);

            const [
                legacyReportSnapshot,
                newReportSnapshot,
                legacyBBCodeSnapshot,
                newBBCodeSnapshot
            ] = await Promise.all([
                get(legacyReportsRef),
                get(newReportsRef),
                get(legacyBBCodeRef),
                get(newBBCodeRef)
            ]);

            const allReportsToBackup = {};
            const allBBCodesToBackup = {};

            if (legacyReportSnapshot.exists()) allReportsToBackup.legacy = legacyReportSnapshot.val();
            if (newReportSnapshot.exists()) allReportsToBackup.new = newReportSnapshot.val();
            if (legacyBBCodeSnapshot.exists()) allBBCodesToBackup.legacy = legacyBBCodeSnapshot.val();
            if (newBBCodeSnapshot.exists()) allBBCodesToBackup.new = newBBCodeSnapshot.val();

            if (Object.keys(allReportsToBackup).length === 0 && Object.keys(allBBCodesToBackup).length === 0) {
                return { success: true, path: fullBackupPath, message: "No reports found to backup." };
            }

            const backupRef = ref(database, fullBackupPath);
            await set(backupRef, {
                reports: allReportsToBackup,
                bbCodes: allBBCodesToBackup,
                timestamp: Date.now(),
                userId: userId
            });

            if (sendDataRequestLog) {
                const reportsSize = new TextEncoder().encode(JSON.stringify(allReportsToBackup)).length;
                const bbCodeSize = new TextEncoder().encode(JSON.stringify(allBBCodesToBackup)).length;
                sendDataRequestLog(
                    'useReportActions.js/backupUserReports',
                    false,
                    'Firebase Write (Backup)',
                    reportsSize + bbCodeSize,
                    isGtaAuthenticated,
                    getCharacterName(gtaWorldUser),
                    `Backup path: ${fullBackupPath}`
                );
            }

            return { success: true, path: fullBackupPath };

        } catch (error) {
            console.error(`Error backing up reports for user ${userId}:`, error);
            Sentry.captureException(error, { extra: { context: 'backupUserReports', userId } });
            if (sendDataRequestLog) {
                sendDataRequestLog(
                    'useReportActions.js/backupUserReports',
                    false,
                    'Firebase Write Error (Backup)',
                    0,
                    isGtaAuthenticated,
                    getCharacterName(gtaWorldUser),
                    `Backup path: ${fullBackupPath}`,
                    error.message || 'Unknown Backup Error'
                );
            }
            return { success: false, error: error.message || "Failed to backup reports." };
        }
    }, [sendDataRequestLog, isGtaAuthenticated, gtaWorldUser]);

    return {
        deleteReportForUser,
        backupUserReports
    };
};
