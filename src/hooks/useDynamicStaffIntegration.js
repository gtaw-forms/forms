import { useEffect, useRef } from 'react';
import { checkAndAddDynamicStaff } from '../services/dynamicStaffService';

/**
 * Custom hook for automatically adding authenticated GTAW users to Firebase staff collections
 * @param {Object} gtaWorldUser - The authenticated GTAW user
 * @param {boolean} isGtaAuthenticated - Authentication status
 * @param {Function} showNotification - Notification function
 * @param {Function} refreshFactionsData - Function to refresh factions data
 * @returns {Object} - Hook state and functions
 */
export const useDynamicStaffIntegration = (
    gtaWorldUser,
    isGtaAuthenticated,
    showNotification,
    refreshFactionsData
) => {
    const hasCheckedRef = useRef(false);
    const lastUserIdRef = useRef(null);
    
    useEffect(() => {
        const checkAndAddUser = async () => {
            // Reset check flag if user changed
            const currentUserId = gtaWorldUser?.id || gtaWorldUser?.character?.id;
            if (currentUserId !== lastUserIdRef.current) {
                hasCheckedRef.current = false;
                lastUserIdRef.current = currentUserId;
            }
            
            // Only run once per authenticated user session
            if (!isGtaAuthenticated || !gtaWorldUser || hasCheckedRef.current) {
                return;
            }
            
            console.log('[DynamicStaff Hook] Checking if user needs to be added to staff');
            
            try {
                const result = await checkAndAddDynamicStaff(
                    gtaWorldUser,
                    showNotification
                );
                
                if (result.success) {
                    console.log(`[DynamicStaff Hook] Successfully added ${result.characterName} to ${result.staffType} staff`);
                    
                    // Refresh the appropriate staff data
                    if (refreshFactionsData) {
                        setTimeout(() => refreshFactionsData(), 1000);
                    }
                } else {
                    console.log(`[DynamicStaff Hook] ${result.reason}`);
                }
                
            } catch (error) {
                console.error('[DynamicStaff Hook] Error during staff check:', error);
            } finally {
                hasCheckedRef.current = true;
            }
        };
        
        // Add a small delay to ensure data is loaded
        const timeoutId = setTimeout(checkAndAddUser, 2000);
        
        return () => clearTimeout(timeoutId);
        
    }, [
        gtaWorldUser,
        isGtaAuthenticated,
        showNotification,
        refreshFactionsData
    ]);
    
    return {
        hasChecked: hasCheckedRef.current
    };
};

export default useDynamicStaffIntegration;