import { useCallback } from 'react';
import { database } from '../firebase';
import { ref, set, get, remove } from 'firebase/database';
import * as Sentry from "@sentry/react";
import { useNotification } from '../contexts/NotificationContext';
import { useData } from '../contexts/DataContext';
import { getCharacterName } from '../utils/identityUtils';
import { comprehensiveSanitize } from '../utils/textUtils';
import useGtaWorldAuth from './useGtaWorldAuth';

const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const REPORTS_PATH = isLocalHost ? 'testingSavedReports' : 'newSavedReports';
const BBCODE_PATH = isLocalHost ? 'testingSavedReportBBCode' : 'newSavedReportBBCode';

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
        const isRecovery = report.isRecovery;
        const sanitizedUserId = comprehensiveSanitize(userId);
        
        let reportPath;
        let bbCodePath = null;

        if (isRecovery) {
            reportPath = `recoveredReports/${sanitizedUserId}/${reportFirebaseKey}`;
        } else {
            reportPath = isLegacyReport
                ? `savedReports/${sanitizedUserId}/${reportFirebaseKey}`
: `${REPORTS_PATH}/${sanitizedUserId}/${reportFirebaseKey}`;

            bbCodePath = isLegacyReport
                ? `savedReportBBCode/${sanitizedUserId}/${reportFirebaseKey}`
                : `${BBCODE_PATH}/${sanitizedUserId}/${reportFirebaseKey}`;
        }

        const reportRef = ref(database, reportPath);
        const bbCodeRef = bbCodePath ? ref(database, bbCodePath) : null;

        try {
            const promises = [remove(reportRef)];
            if (bbCodeRef) promises.push(remove(bbCodeRef));
            
            await Promise.all(promises);

            if (sendDataRequestLog) {
                sendDataRequestLog(
                    'useReportActions.js/deleteReportForUser',
                    false,
                    'Firebase Delete',
                    0,
                    isGtaAuthenticated,
                    getCharacterName(gtaWorldUser),
                    `Report: ${reportPath}${bbCodePath ? `, BBCode: ${bbCodePath}` : ''}`
                );
            }

            showNotification(`${isRecovery ? 'Recovery snapshot' : 'Report'} deleted successfully.`, 'trash');
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
            const newReportsRef = ref(database, `${REPORTS_PATH}/${sanitizedUserId}`);
            const legacyBBCodeRef = ref(database, `savedReportBBCode/${sanitizedUserId}`);
            const newBBCodeRef = ref(database, `${BBCODE_PATH}/${sanitizedUserId}`);

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
