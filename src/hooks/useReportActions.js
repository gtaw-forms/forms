import { useCallback } from 'react';
import { database } from '../firebase';
import { ref, remove } from 'firebase/database';
import * as Sentry from "@sentry/react";
import { useNotification } from '../contexts/NotificationContext';
import { comprehensiveSanitize } from '../utils/textUtils';
import { triggerDeleteSavedReport } from '../services/firebaseFunctions';

export const useReportActions = () => {
    const { showNotification } = useNotification();

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

            showNotification(`${isRecovery ? 'Recovery snapshot' : 'Report'} deleted successfully.`, 'trash');
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error(`Error deleting report ${reportFirebaseKey} for user ${userId}:`, error);
            Sentry.captureException(error, { extra: { context: 'deleteReportForUser', userId, reportFirebaseKey } });
            showNotification(`Failed to delete report: ${error.message}`, 'error');
        }
    }, [showNotification]);

    // P2 (h) cost plan: backupUserReports passthrough removed — zero UI
    // callers (admin backups run from DatabaseEditor via
    // triggerCreateSavedReportsBackup directly).
    return {
        deleteReportForUser
    };
};
