import { useState, useEffect, useCallback } from 'react';
import { 
    hasPermission, 
    canAccessFeature, 
    getFactionInfo, 
    getAccessLevel, 
    getUserPermissions, 
    isFactionMember,
    refreshFactionData,
    getCurrentUser 
} from '../services/gtaWorldAuth';

/**
 * Custom hook for faction-based permissions and access control
 * @returns {Object} Faction permission utilities
 */
const useFactionPermissions = () => {
    const [factionData, setFactionData] = useState(null);
    const [permissions, setPermissions] = useState([]);
    const [accessLevel, setAccessLevel] = useState('none');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Load faction data from storage
    const loadFactionData = useCallback(() => {
        try {
            const userData = getCurrentUser();
            if (userData && userData.faction) {
                setFactionData(userData.faction);
                setPermissions(userData.permissions || []);
                setAccessLevel(userData.accessLevel || 'none');
            } else {
                setFactionData(null);
                setPermissions([]);
                setAccessLevel('none');
            }
            setError(null);
        } catch (err) {
            console.error('[Faction Hook] Error loading faction data:', err);
            setError(err.message);
            setFactionData(null);
            setPermissions([]);
            setAccessLevel('none');
        }
    }, []);

    // Initial load
    useEffect(() => {
        loadFactionData();
    }, [loadFactionData]);

    // Refresh faction data from server
    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            await refreshFactionData();
            loadFactionData(); // Reload from updated storage
        } catch (err) {
            console.error('[Faction Hook] Refresh failed:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [loadFactionData]);

    // Permission checking functions with fallbacks
    const checkPermission = useCallback((permission) => {
        try {
            return hasPermission(permission);
        } catch (err) {
            console.warn('[Faction Hook] Permission check failed:', err);
            return false;
        }
    }, []);

    const checkFeatureAccess = useCallback((feature) => {
        try {
            return canAccessFeature(feature);
        } catch (err) {
            console.warn('[Faction Hook] Feature access check failed:', err);
            return false;
        }
    }, []);

    // Get current values with fallbacks
    let isMember = false;
    let factionInfo = null;
    let currentAccessLevel = 'none';
    let currentPermissions = [];

    try {
        isMember = isFactionMember();
        factionInfo = getFactionInfo();
        currentAccessLevel = getAccessLevel();
        currentPermissions = getUserPermissions();
    } catch (err) {
        console.warn('[Faction Hook] Error getting faction status:', err);
    }

    return {
        // Faction data
        factionData,
        factionInfo,
        isMember,
        
        // Permissions
        permissions: currentPermissions,
        accessLevel: currentAccessLevel,
        
        // Permission checking
        hasPermission: checkPermission,
        canAccessFeature: checkFeatureAccess,
        
        // State management
        isLoading,
        error,
        refresh,
        
        // Convenience getters for common permissions (with safe fallbacks)
        canAccessAdmin: checkFeatureAccess('admin_panel'),
        canUploadFactionData: checkFeatureAccess('faction_upload'),
        canAccessDatabase: checkFeatureAccess('database_editor'),
        canManageWebhooks: checkFeatureAccess('webhook_management'),
        canViewAllReports: checkFeatureAccess('all_reports'),
        canViewDepartmentReports: checkFeatureAccess('department_reports'),
        canViewOwnReports: checkFeatureAccess('own_reports'),
        canCreateReports: checkFeatureAccess('create_reports'),
        canViewMembers: checkFeatureAccess('view_members'),
        canAccessAuditLogs: checkFeatureAccess('audit_logs'),
        
        // Role level checks
        isLeadership: currentAccessLevel === 'Leadership',
        isSeniorManagement: currentAccessLevel === 'Senior Management',
        isMiddleManagement: currentAccessLevel === 'Middle Management',
        isSupervisor: currentAccessLevel === 'Supervisor',
        isAttending: currentAccessLevel === 'Attending',
        isResident: currentAccessLevel === 'Resident',
        isUpperLevel: currentAccessLevel === 'Upper Level',
        isMidLevel: currentAccessLevel === 'Mid Level',
        isAdministration: currentAccessLevel === 'Administration',
        isEntryLevel: currentAccessLevel === 'Entry Level',
        
        // Legacy aliases for backward compatibility
        isPresident: currentAccessLevel === 'Leadership',
        isExecutive: currentAccessLevel === 'Leadership',
        isChief: currentAccessLevel === 'Senior Management',
        isDeputyChief: currentAccessLevel === 'Middle Management',
        isManager: currentAccessLevel === 'Supervisor',
        isSeniorStaff: currentAccessLevel === 'Attending',
        isRegularStaff: currentAccessLevel === 'Mid Level',
        isTrainee: currentAccessLevel === 'Entry Level'
    };
};

export default useFactionPermissions;