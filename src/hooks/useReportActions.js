import { useCallback } from 'react';
import { database } from '../firebase';
import { ref, remove } from 'firebase/database';
import * as Sentry from "@sentry/react";
import { useNotification } from '../contexts/NotificationContext';
import { useData } from '../contexts/DataContext';
import { getCharacterName } from '../utils/identityUtils';
import { comprehensiveSanitize } from '../utils/textUtils';
import useGtaWorldAuth from './useGtaWorldAuth';
import { triggerDeleteSavedReport, triggerCreateSavedReportsBackup } from '../services/firebaseFunctions';

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

        const isRecovery = report.isRecovery;
        const sanitizedUserId = comprehensiveSanitize(userId);

        // Task 3b cutover: saved reports live on the VPS (the backfill covers
        // all legacy authors/keys, so items without `_src` delete via VPS too).
        // Only the bot deploy queue (`scheduledReports`, `_src === 'scheduled')
        // and local recovery snapshots stay on RTDB.
        if (report._src !== 'scheduled' && !isRecovery) {
            try {
                await triggerDeleteSavedReport({ author: sanitizedUserId, key: reportFirebaseKey });
                showNotification('Report deleted successfully.', 'trash');
                if (onSuccess) onSuccess();
            } catch (error) {
                console.error(`Error deleting VPS report ${reportFirebaseKey} for user ${userId}:`, error);
                Sentry.captureException(error, { extra: { context: 'deleteVpsReport', userId, reportFirebaseKey } });
                showNotification(`Failed to delete report: ${error.message}`, 'error');
            }
            return;
        }
        
        let reportPath;
        let bbCodePath = null;

        if (isRecovery) {
            reportPath = `recoveredReports/${sanitizedUserId}/${reportFirebaseKey}`;
        } else {
            reportPath = `scheduledReports/${sanitizedUserId}/${reportFirebaseKey}`;
            bbCodePath = `scheduledReportsBBCode/${sanitizedUserId}/${reportFirebaseKey}`;
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

    // Task 3b cutover (Q2: admin-only backups): per-user self-service backup
    // is dropped. The old flow duplicated report data inside RTDB under
    // `migrateBackup/<author>_<timestamp>`; backups are now full VPS snapshots
    // via `triggerCreateSavedReportsBackup` (superadmin-gated server-side).
    // This passthrough keeps the hook API stable for any caller.
    const backupUserReports = useCallback(async () => {
        try {
            const result = await triggerCreateSavedReportsBackup();
            return { success: true, backupId: result?.backupId || null, count: result?.count || 0 };
        } catch (error) {
            console.error(`Error creating VPS saved-reports backup:`, error);
            Sentry.captureException(error, { extra: { context: 'backupUserReports' } });
            return { success: false, error: error.message || "Failed to create VPS backup." };
        }
    }, []);

    return {
        deleteReportForUser,
        backupUserReports
    };
};
