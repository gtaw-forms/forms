import { useGtaWorldAuthContext } from '../contexts/GtaWorldAuthContext';

/**
 * React hook for GTA World authentication
 * Now backed by GtaWorldAuthContext for global state management
 */
export const useGtaWorldAuth = () => {
    return useGtaWorldAuthContext();
};

export default useGtaWorldAuth;
