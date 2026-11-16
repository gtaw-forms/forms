import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const triggerFunction = async (functionName, data) => {
    const callable = httpsCallable(functions, functionName);
    try {
        const result = await callable(data);
        return result.data;
    } catch (error) {
        // console.warn, not .error: the console interceptor forwards every
        // console.error to the Discord error channel when Sentry is blocked —
        // a failing callable would otherwise fan out into error-webhook calls.
        console.warn(`Error calling ${functionName}:`, error);
        throw error;
    }
};


export const triggerValidateGtaWorldToken = (data) => triggerFunction('validateGtaWorldToken', data);
export const triggerCheckFactionMembership = (data) => triggerFunction('checkFactionMembership', data);
export const triggerFetchExternalUrl = (data) => triggerFunction('fetchExternalUrl', data);
export const triggerRefreshGtawUser = (data) => triggerFunction('refreshGtawUser', data);
export const triggerWebhookProxy = (webhookType, payload, webhookId = null) => {
    console.log(`[Webhook] Dispatching '${webhookType}'${webhookId ? ` (ID: ${webhookId})` : ''}...`);
    return triggerFunction('sendWebhookProxy', { webhookType, payload, webhookId });
};
export const triggerGetPublicConfig = () => triggerFunction('getPublicConfig');
export const triggerGetMorgueRecords = (data) => triggerFunction('getMorgueRecords', data);
export const triggerGetFormsData = (data) => triggerFunction('getFormsData', data);
export const triggerDeleteMorgueRecord = (data) => triggerFunction('deleteMorgueRecord', data);
// P1 (d) cost plan: bulk delete — 1 invocation for up to 100 rows (was N serial).
export const triggerDeleteMorgueRecords = (data) => triggerFunction('deleteMorgueRecords', data);
export const triggerPurgeMorgueRecords = () => triggerFunction('purgeMorgueRecords', { confirmed: true });
export const triggerSyncMorgueFile = () => triggerFunction('syncMorgueFile', {});
// Manual "please re-import the morgue" note to the maintainer (morgue panel).
export const triggerRequestMorgueUpdate = () => triggerFunction('requestMorgueUpdate', {});
export const triggerCheckOfficerName = (data) => triggerFunction('checkOfficerName', data);
// Full roster snapshot (name-only, ~9 KB) cached in IndexedDB for 24 h — backs
// the offline-safe officer autocomplete. See src/utils/officerRosterCache.js.
export const triggerGetOfficerRoster = () => triggerFunction('getOfficerRoster', {});
export const triggerGetAgencyCredentials = () => triggerFunction('getAgencyCredentials', {});
export const triggerGetCctvData = (data) => triggerFunction('getCctvData', data);
export const triggerCctvFetch = () => triggerFunction('triggerCctvFetch', {});
export const triggerListSavedReports = (data) => triggerFunction('listSavedReports', data);
export const triggerListRecentSavedReports = (data) => triggerFunction('listRecentSavedReports', data);
export const triggerGetSavedReport = (data) => triggerFunction('getSavedReport', data);
// LEO (law-enforcement) forwarded reports: list + audited open + cache-hit log.
export const triggerListLeoReports = (data) => triggerFunction('listLeoReports', data);
export const triggerGetLeoReport = (data) => triggerFunction('getLeoReport', data);
export const triggerLogLeoReportView = (data) => triggerFunction('logLeoReportView', data);
export const triggerLogLeoPanelAccess = (data) => triggerFunction('logLeoPanelAccess', data);
// Migration UI / generic saved-report view audit (metadata only).
export const triggerLogReportView = (data) => triggerFunction('logReportView', data);
export const triggerSaveSavedReport = (data) => triggerFunction('saveSavedReport', data);
export const triggerDeleteSavedReport = (data) => triggerFunction('deleteSavedReport', data);
export const triggerGetSavedReportStats = () => triggerFunction('getSavedReportStats');
export const triggerCreateSavedReportsBackup = () => triggerFunction('createSavedReportsBackup');
export const triggerRestoreSavedReportsBackup = (data) => triggerFunction('restoreSavedReportsBackup', data);
export const triggerGetTowReports = () => triggerFunction('getTowReports', {});
export const triggerSaveTowReport = (data) => triggerFunction('saveTowReport', data);
// P1 (e) cost plan: triggerLogTowAudit removed — zero callers (dead export).
export const triggerAddTowAccess = (data) => triggerFunction('addTowAccess', data);
export const triggerRemoveTowAccess = (data) => triggerFunction('removeTowAccess', data);
