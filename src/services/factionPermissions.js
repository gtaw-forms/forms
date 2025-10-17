/**
 * Faction-based Access Control System
 * Manages permissions based on Script Rank IDs from faction data
 */

// Permission levels mapped to Script Rank IDs
export const FACTION_PERMISSIONS = {
    // Leadership Level (Script Rank 15)
    HOSPITAL_PRESIDENT: {
        scriptRanks: [15],
        permissions: [
            'admin_full_access',
            'upload_faction_data',
            'manage_all_reports',
            'view_all_members',
            'configure_permissions',
            'access_audit_logs',
            'manage_webhooks',
            'database_access'
        ]
    },
    
    // Executive Level (Script Rank 14)
    EXECUTIVE_LEADERSHIP: {
        scriptRanks: [14],
        permissions: [
            'admin_full_access',
            'upload_faction_data',
            'manage_department_reports',
            'view_all_members',
            'access_audit_logs',
            'manage_webhooks'
        ]
    },
    
    // Chief Level (Script Rank 13)
    CHIEF_OFFICERS: {
        scriptRanks: [13],
        permissions: [
            'admin_limited_access',
            'manage_department_reports',
            'view_department_members',
            'create_reports',
            'view_audit_logs'
        ]
    },
    
    // Deputy Chief Level (Script Rank 12)
    DEPUTY_CHIEFS: {
        scriptRanks: [12],
        permissions: [
            'admin_limited_access',
            'manage_own_reports',
            'view_department_members',
            'create_reports'
        ]
    },
    
    // Manager/Captain Level (Script Rank 11)
    MANAGEMENT_STAFF: {
        scriptRanks: [11],
        permissions: [
            'view_own_reports',
            'create_reports',
            'view_team_members'
        ]
    },
    
    // Senior Staff Level (Script Rank 10)
    SENIOR_STAFF: {
        scriptRanks: [10],
        permissions: [
            'view_own_reports',
            'create_basic_reports'
        ]
    },
    
    // Regular Staff Level (Script Rank 7-9)
    REGULAR_STAFF: {
        scriptRanks: [7, 8, 9],
        permissions: [
            'view_own_reports',
            'create_basic_reports'
        ]
    },
    
    // Entry Level (Script Rank 4-6)
    ENTRY_LEVEL: {
        scriptRanks: [4, 5, 6],
        permissions: [
            'view_own_reports'
        ]
    },
    
    // Trainee/Volunteer Level (Script Rank 1-3)
    TRAINEE_VOLUNTEER: {
        scriptRanks: [1, 2, 3],
        permissions: [
            'limited_access'
        ]
    }
};

// Feature access control mappings
export const FEATURE_ACCESS = {
    admin_panel: {
        required_permissions: ['admin_full_access', 'admin_limited_access'],
        minimum_script_rank: 12
    },
    faction_upload: {
        required_permissions: ['upload_faction_data'],
        minimum_script_rank: 14
    },
    database_editor: {
        required_permissions: ['database_access'],
        minimum_script_rank: 15
    },
    webhook_management: {
        required_permissions: ['manage_webhooks'],
        minimum_script_rank: 13
    },
    all_reports: {
        required_permissions: ['manage_all_reports'],
        minimum_script_rank: 14
    },
    department_reports: {
        required_permissions: ['manage_department_reports', 'manage_all_reports'],
        minimum_script_rank: 12
    },
    own_reports: {
        required_permissions: ['view_own_reports', 'manage_own_reports', 'manage_department_reports', 'manage_all_reports'],
        minimum_script_rank: 7
    },
    create_reports: {
        required_permissions: ['create_reports', 'create_basic_reports'],
        minimum_script_rank: 7
    },
    view_members: {
        required_permissions: ['view_all_members', 'view_department_members', 'view_team_members'],
        minimum_script_rank: 10
    },
    audit_logs: {
        required_permissions: ['access_audit_logs', 'view_audit_logs'],
        minimum_script_rank: 13
    }
};

/**
 * Get user permissions based on script rank
 * @param {number} scriptRank - User's script rank from faction data
 * @returns {Array} Array of permission strings
 */
export const getUserPermissions = (scriptRank) => {
    if (!scriptRank || typeof scriptRank !== 'number') {
        return [];
    }
    
    // Find matching permission level
    for (const [levelName, levelData] of Object.entries(FACTION_PERMISSIONS)) {
        if (levelData.scriptRanks.includes(scriptRank)) {
            return levelData.permissions;
        }
    }
    
    return []; // No permissions if rank not found
};

/**
 * Check if user has specific permission
 * @param {number} scriptRank - User's script rank
 * @param {string} permission - Permission to check
 * @returns {boolean} True if user has permission
 */
export const hasPermission = (scriptRank, permission) => {
    const userPermissions = getUserPermissions(scriptRank);
    return userPermissions.includes(permission);
};

/**
 * Check if user can access a specific feature
 * @param {number} scriptRank - User's script rank
 * @param {string} feature - Feature to check access for
 * @returns {boolean} True if user can access feature
 */
export const canAccessFeature = (scriptRank, feature) => {
    const featureConfig = FEATURE_ACCESS[feature];
    if (!featureConfig) {
        console.warn(`Unknown feature: ${feature}`);
        return false;
    }
    
    // Check minimum script rank
    if (scriptRank < featureConfig.minimum_script_rank) {
        return false;
    }
    
    // Check if user has any of the required permissions
    const userPermissions = getUserPermissions(scriptRank);
    return featureConfig.required_permissions.some(permission => 
        userPermissions.includes(permission)
    );
};

/**
 * Get user's role level based on script rank
 * @param {number} scriptRank - User's script rank
 * @returns {string} Role level name
 */
export const getUserRoleLevel = (scriptRank) => {
    for (const [levelName, levelData] of Object.entries(FACTION_PERMISSIONS)) {
        if (levelData.scriptRanks.includes(scriptRank)) {
            return levelName;
        }
    }
    return 'UNKNOWN';
};

/**
 * Get formatted permission summary for display
 * @param {number} scriptRank - User's script rank
 * @returns {Object} Permission summary with role and capabilities
 */
export const getPermissionSummary = (scriptRank) => {
    const permissions = getUserPermissions(scriptRank);
    const roleLevel = getUserRoleLevel(scriptRank);
    
    // Categorize permissions for display
    const categories = {
        admin: permissions.filter(p => p.includes('admin')),
        reports: permissions.filter(p => p.includes('report')),
        members: permissions.filter(p => p.includes('member') || p.includes('view')),
        management: permissions.filter(p => p.includes('manage') || p.includes('upload') || p.includes('configure')),
        access: permissions.filter(p => p.includes('access') || p.includes('database') || p.includes('webhook'))
    };
    
    return {
        scriptRank,
        roleLevel,
        permissions,
        categories,
        accessibleFeatures: Object.keys(FEATURE_ACCESS).filter(feature => 
            canAccessFeature(scriptRank, feature)
        )
    };
};

/**
 * Validate faction member data structure
 * @param {Object} memberData - Faction member data from database
 * @returns {boolean} True if data is valid
 */
export const validateFactionMember = (memberData) => {
    if (!memberData || typeof memberData !== 'object') {
        return false;
    }
    
    const required = ['characterId', 'characterName', 'rank', 'scriptRank', 'factionId'];
    return required.every(field => memberData[field] !== undefined && memberData[field] !== null);
};

/**
 * Create permission context for React components
 * @param {Object} factionMember - Faction member data
 * @returns {Object} Permission context object
 */
export const createPermissionContext = (factionMember) => {
    if (!validateFactionMember(factionMember)) {
        return {
            isValid: false,
            scriptRank: null,
            permissions: [],
            canAccess: () => false,
            hasPermission: () => false,
            summary: null
        };
    }
    
    const scriptRank = factionMember.scriptRank;
    
    return {
        isValid: true,
        scriptRank,
        factionMember,
        permissions: getUserPermissions(scriptRank),
        canAccess: (feature) => canAccessFeature(scriptRank, feature),
        hasPermission: (permission) => hasPermission(scriptRank, permission),
        summary: getPermissionSummary(scriptRank)
    };
};

// Export permission constants for use in components
export const PERMISSION_LEVELS = Object.keys(FACTION_PERMISSIONS);
export const AVAILABLE_FEATURES = Object.keys(FEATURE_ACCESS);

export default {
    FACTION_PERMISSIONS,
    FEATURE_ACCESS,
    getUserPermissions,
    hasPermission,
    canAccessFeature,
    getUserRoleLevel,
    getPermissionSummary,
    validateFactionMember,
    createPermissionContext,
    PERMISSION_LEVELS,
    AVAILABLE_FEATURES
};