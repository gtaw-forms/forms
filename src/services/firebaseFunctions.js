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


export const triggerExchangeAuthCodeForToken = (data) => triggerFunction('exchangeAuthCodeForToken', data);
export const triggerGetTokenForSecrets = (data) => triggerFunction('getTokenForSecrets', data);
export const triggerGetManagedGtaWorldToken = () => triggerFunction('getManagedGtaWorldToken');
export const triggerGetProfileWithManagedToken = () => triggerFunction('getProfileWithManagedToken');
export const triggerValidateGtaWorldToken = (data) => triggerFunction('validateGtaWorldToken', data);
export const triggerGetCachedGtaWorldProfile = (data) => triggerFunction('getCachedGtaWorldProfile', data);
export const triggerGetGtaWorldProfile = (data) => triggerFunction('getGtaWorldProfile', data);
export const triggerUploadFactionData = (data) => triggerFunction('uploadFactionData', data);
export const triggerBatchCheckFactionMembership = (data) => triggerFunction('batchCheckFactionMembership', data);
export const triggerCheckFactionMembership = (data) => triggerFunction('checkFactionMembership', data);
export const triggerTestHealthAlert = (data) => triggerFunction('triggerTestHealthAlert', data);
export const triggerFetchExternalUrl = (data) => triggerFunction('fetchExternalUrl', data);
export const triggerManualMaintenance = () => triggerFunction('triggerManualMaintenance');
export const triggerRefreshGtawUser = (data) => triggerFunction('refreshGtawUser', data);
