import { getFunctions, httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const triggerFunction = async (functionName, data) => {
    const callable = httpsCallable(functions, functionName);
    try {
        const result = await callable(data);
        return result.data;
    } catch (error) {
        console.error(`Error calling ${functionName}:`, error);
        throw error;
    }
};


export const triggerExchangeAuthCodeForToken = (data) => triggerFunction('processGtaWorldAuth', data);
export const triggerValidateGtaWorldToken = (data) => triggerFunction('validateGtaWorldToken', data);
export const triggerUploadFactionData = (data) => triggerFunction('uploadFactionData', data);
export const triggerCheckFactionMembership = (data) => triggerFunction('checkFactionMembership', data);
export const triggerTestHealthAlert = (data) => triggerFunction('triggerTestHealthAlert', data);
export const triggerFetchExternalUrl = (data) => triggerFunction('fetchExternalUrl', data);
export const triggerRefreshGtawUser = (data) => triggerFunction('refreshGtawUser', data);
export const triggerWebhookProxy = (webhookType, payload, webhookId = null) => {
    console.log(`[Webhook] Dispatching '${webhookType}'${webhookId ? ` (ID: ${webhookId})` : ''}...`);
    return triggerFunction('sendWebhookProxy', { webhookType, payload, webhookId });
};
export const triggerGetPublicConfig = () => triggerFunction('getPublicConfig');
export const triggerGetMorgueRecords = (data) => triggerFunction('getMorgueRecords', data);
export const triggerGetProtocolsDev = (data) => triggerFunction('getProtocolsDev', data);
export const triggerDeleteMorgueRecord = (data) => triggerFunction('deleteMorgueRecord', data);
export const triggerPurgeMorgueRecords = () => triggerFunction('purgeMorgueRecords', { confirmed: true });
export const triggerSyncMorgueFile = () => triggerFunction('syncMorgueFile', {});
export const triggerCheckOfficerName = (data) => triggerFunction('checkOfficerName', data);
export const triggerGetPatientNames = (data) => triggerFunction('getPatientNames', data);
export const triggerGetAgencyCredentials = () => triggerFunction('getAgencyCredentials', {});
export const triggerGetCctvData = (data) => triggerFunction('getCctvData', data);
export const triggerCctvFetch = () => triggerFunction('triggerCctvFetch', {});
export const triggerSaveReportBBCode = (data) => triggerFunction('saveReportBBCode', data);
export const triggerGetReportBBCode = (data) => triggerFunction('getReportBBCode', data);
export const triggerListSavedReports = (data) => triggerFunction('listSavedReports', data);
export const triggerGetSavedReport = (data) => triggerFunction('getSavedReport', data);
export const triggerSaveSavedReport = (data) => triggerFunction('saveSavedReport', data);
export const triggerDeleteSavedReport = (data) => triggerFunction('deleteSavedReport', data);
export const triggerGetSavedReportStats = () => triggerFunction('getSavedReportStats');
export const triggerCreateSavedReportsBackup = () => triggerFunction('createSavedReportsBackup');
export const triggerRestoreSavedReportsBackup = (data) => triggerFunction('restoreSavedReportsBackup', data);
