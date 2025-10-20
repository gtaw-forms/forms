import { useEffect, useRef } from 'react';
import { checkAndAddDynamicStaff } from '../services/dynamicStaffService';

/**
 * Custom hook for automatically adding authenticated GTAW users to Firebase staff collections
 * @param {Object} gtaWorldUser - The authenticated GTAW user
 * @param {boolean} isGtaAuthenticated - Authentication status
 * @param {Array} phmcListData - Current PHMC staff list
 * @param {Array} coronerListData - Current coroner staff list  
 * @param {Function} showNotification - Notification function
 * @param {Function} refreshPhmcData - Function to refresh PHMC data
 * @param {Function} refreshCoronerData - Function to refresh coroner data
 * @returns {Object} - Hook state and functions
 */
export const useDynamicStaffIntegration = (
    gtaWorldUser,
    isGtaAuthenticated,
    phmcListData,
    coronerListData,
    showNotification,
    refreshPhmcData,
    refreshCoronerData
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
            
            // Only proceed if we have staff data loaded
            if (!phmcListData || !coronerListData || phmcListData.length === 0) {
                return;
            }
            
            console.log('[DynamicStaff Hook] Checking if user needs to be added to staff');
            
            try {
                const result = await checkAndAddDynamicStaff(
                    gtaWorldUser,
                    phmcListData,
                    coronerListData,
                    showNotification
                );
                
                if (result.success) {
                    console.log(`[DynamicStaff Hook] Successfully added ${result.characterName} to ${result.staffType} staff`);
                    
                    // Refresh the appropriate staff data
                    if (result.staffType === 'phmc' && refreshPhmcData) {
                        setTimeout(() => refreshPhmcData(), 1000);
                    } else if (result.staffType === 'coroner' && refreshCoronerData) {
                        setTimeout(() => refreshCoronerData(), 1000);
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
        phmcListData,
        coronerListData,
        showNotification,
        refreshPhmcData,
        refreshCoronerData
    ]);
    
    return {
        hasChecked: hasCheckedRef.current
    };
};

export default useDynamicStaffIntegration;