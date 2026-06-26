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
export const triggerManualMaintenance = () => triggerFunction('triggerManualMaintenance');
export const triggerRefreshGtawUser = (data) => triggerFunction('refreshGtawUser', data);
export const triggerWebhookProxy = (webhookType, payload, webhookId = null) => {
    console.log(`[Webhook] Dispatching '${webhookType}'${webhookId ? ` (ID: ${webhookId})` : ''}...`);
    return triggerFunction('sendWebhookProxy', { webhookType, payload, webhookId });
};
export const triggerGetPublicConfig = () => triggerFunction('getPublicConfig');
