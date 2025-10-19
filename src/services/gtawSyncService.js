import { ref, get, set, update } from 'firebase/database';
import { database } from '../firebase';

/**
 * Service for syncing GTAW account data with saved reports
 * Enhanced with backup, validation, and rollback capabilities
 */

/**
 * Create a backup of current saved reports before sync
 * @param {string} gtawUsername - Username for backup identification
 * @returns {Promise<string>} Backup ID for potential rollback
 */
export const createSyncBackup = async (gtawUsername) => {
    try {
        const backupId = `backup_${gtawUsername}_${Date.now()}`;
        const savedReportsRef = ref(database, 'savedReports');
        const backupRef = ref(database, `syncBackups/${backupId}`);
        
        const snapshot = await get(savedReportsRef);
        if (snapshot.exists()) {
            await set(backupRef, {
                data: snapshot.val(),
                metadata: {
                    username: gtawUsername,
                    timestamp: new Date().toISOString(),
                    operation: 'pre_sync_backup'
                }
            });
            
            console.log('💾 [GTAW Sync] Created backup:', backupId);
            return backupId;
        }
        return null;
    } catch (error) {
        console.error('❌ [GTAW Sync] Failed to create backup:', error);
        throw new Error(`Backup creation failed: ${error.message}`);
    }
};

/**
 * Validate sync updates before applying them
 * @param {Object} updates - The updates object to validate
 * @param {Object} originalData - Original reports data for comparison
 * @returns {Object} Validation result
 */
export const validateSyncUpdates = (updates, originalData) => {
    const validation = {
        isValid: true,
        warnings: [],
        errors: [],
        stats: {
            totalUpdates: Object.keys(updates).length,
            newFields: 0,
            modifiedReports: 0
        }
    };
    
    try {
        Object.keys(updates).forEach(updatePath => {
            const pathParts = updatePath.split('/');
            if (pathParts.length !== 3 || pathParts[0] !== 'savedReports') {
                validation.errors.push(`Invalid update path: ${updatePath}`);
                validation.isValid = false;
                return;
            }
            
            const [, authorKey, reportKey] = pathParts;
            const updatedReport = updates[updatePath];
            const originalReport = originalData[authorKey]?.[reportKey];
            
            if (!originalReport) {
                validation.warnings.push(`Report not found in original data: ${updatePath}`);
                return;
            }
            
            // Check if we're only adding GTAW fields, not modifying existing data
            const originalKeys = Object.keys(originalReport);
            const updatedKeys = Object.keys(updatedReport);
            const newKeys = updatedKeys.filter(key => !originalKeys.includes(key));
            
            validation.stats.newFields += newKeys.length;
            validation.stats.modifiedReports++;
            
            // Validate we're not removing any existing fields
            const removedKeys = originalKeys.filter(key => !(key in updatedReport));
            if (removedKeys.length > 0) {
                validation.errors.push(`Would remove existing fields from ${updatePath}: ${removedKeys.join(', ')}`);
                validation.isValid = false;
            }
            
            // Validate GTAW fields are being added
            const expectedGtawFields = ['gtawUsername', 'gtawCharacterId', 'gtawCharacterName', 'gtawSyncTimestamp'];
            const missingGtawFields = expectedGtawFields.filter(field => !(field in updatedReport));
            if (missingGtawFields.length > 0) {
                validation.warnings.push(`Missing GTAW fields in ${updatePath}: ${missingGtawFields.join(', ')}`);
            }
        });
        
        console.log('🔍 [GTAW Sync] Validation complete:', validation.stats);
        if (validation.warnings.length > 0) {
            console.warn('⚠️ [GTAW Sync] Validation warnings:', validation.warnings);
        }
        if (validation.errors.length > 0) {
            console.error('❌ [GTAW Sync] Validation errors:', validation.errors);
        }
        
    } catch (error) {
        validation.isValid = false;
        validation.errors.push(`Validation failed: ${error.message}`);
    }
    
    return validation;
};

/**
 * Rollback to a previous backup if sync fails
 * @param {string} backupId - The backup ID to restore
 * @returns {Promise<Object>} Rollback result
 */
export const rollbackSyncChanges = async (backupId) => {
    try {
        console.log('🔄 [GTAW Sync] Starting rollback to backup:', backupId);
        
        const backupRef = ref(database, `syncBackups/${backupId}`);
        const backupSnapshot = await get(backupRef);
        
        if (!backupSnapshot.exists()) {
            throw new Error(`Backup ${backupId} not found`);
        }
        
        const backupData = backupSnapshot.val();
        const savedReportsRef = ref(database, 'savedReports');
        
        // Restore the backup data
        await set(savedReportsRef, backupData.data);
        
        console.log('✅ [GTAW Sync] Successfully rolled back to backup:', {
            backupId,
            timestamp: new Date().toISOString(),
            originalTimestamp: backupData.metadata?.timestamp
        });
        
        return {
            success: true,
            backupId,
            restoredTimestamp: backupData.metadata?.timestamp
        };
        
    } catch (error) {
        console.error('❌ [GTAW Sync] Rollback failed:', error);
        throw new Error(`Rollback failed: ${error.message}`);
    }
};

/**
 * Delete a successful backup to free up Firebase storage
 * @param {string} backupId - The backup ID to delete
 * @returns {Promise<boolean>} True if backup was deleted successfully
 */
export const deleteSuccessfulBackup = async (backupId) => {
    try {
        console.log('🗑️ [GTAW Sync] Deleting successful backup:', backupId);
        
        const backupRef = ref(database, `syncBackups/${backupId}`);
        const backupSnapshot = await get(backupRef);
        
        if (!backupSnapshot.exists()) {
            console.warn('⚠️ [GTAW Sync] Backup not found for deletion:', backupId);
            return false;
        }
        
        // Delete the backup
        await set(backupRef, null);
        
        console.log('✅ [GTAW Sync] Successfully deleted backup:', {
            backupId,
            deletedAt: new Date().toISOString()
        });
        
        return true;
        
    } catch (error) {
        console.error('❌ [GTAW Sync] Failed to delete backup:', {
            backupId,
            error: error.message
        });
        // Don't throw error - backup deletion failure shouldn't break the sync flow
        return false;
    }
};

/**
 * Clean up old backups based on age and count limits
 * @param {Object} options - Cleanup options
 * @returns {Promise<Object>} Cleanup results
 */
export const cleanupOldBackups = async (options = {}) => {
    const {
        maxAge = 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
        maxCount = 10, // Keep maximum 10 backups per user
        dryRun = false
    } = options;
    
    try {
        console.log('🧹 [GTAW Sync] Starting backup cleanup:', {
            maxAge: `${maxAge / (24 * 60 * 60 * 1000)} days`,
            maxCount,
            dryRun
        });
        
        const backupsRef = ref(database, 'syncBackups');
        const snapshot = await get(backupsRef);
        
        if (!snapshot.exists()) {
            console.log('📭 [GTAW Sync] No backups found for cleanup');
            return { deleted: 0, errors: 0, message: 'No backups found' };
        }
        
        const allBackups = snapshot.val();
        const now = Date.now();
        const backupsToDelete = [];
        const userBackups = {};
        
        // Group backups by user and identify old ones
        Object.keys(allBackups).forEach(backupId => {
            const backup = allBackups[backupId];
            const username = backup.metadata?.username;
            const timestamp = backup.metadata?.timestamp;
            
            if (!username || !timestamp) {
                console.warn('⚠️ [GTAW Sync] Backup missing metadata:', backupId);
                return;
            }
            
            const backupAge = now - new Date(timestamp).getTime();
            
            // Initialize user backup array
            if (!userBackups[username]) {
                userBackups[username] = [];
            }
            
            userBackups[username].push({
                id: backupId,
                timestamp: new Date(timestamp),
                age: backupAge
            });
            
            // Mark for deletion if too old
            if (backupAge > maxAge) {
                backupsToDelete.push({
                    id: backupId,
                    username,
                    reason: 'age',
                    age: Math.round(backupAge / (24 * 60 * 60 * 1000))
                });
            }
        });
        
        // Check count limits per user
        Object.keys(userBackups).forEach(username => {
            const userBackupList = userBackups[username];
            
            if (userBackupList.length > maxCount) {
                // Sort by timestamp (oldest first) and mark excess for deletion
                userBackupList.sort((a, b) => a.timestamp - b.timestamp);
                const excessBackups = userBackupList.slice(0, userBackupList.length - maxCount);
                
                excessBackups.forEach(backup => {
                    // Don't double-add if already marked for age deletion
                    if (!backupsToDelete.find(b => b.id === backup.id)) {
                        backupsToDelete.push({
                            id: backup.id,
                            username,
                            reason: 'count',
                            age: Math.round(backup.age / (24 * 60 * 60 * 1000))
                        });
                    }
                });
            }
        });
        
        console.log('📊 [GTAW Sync] Cleanup analysis:', {
            totalBackups: Object.keys(allBackups).length,
            usersWithBackups: Object.keys(userBackups).length,
            backupsToDelete: backupsToDelete.length,
            deleteReasons: {
                age: backupsToDelete.filter(b => b.reason === 'age').length,
                count: backupsToDelete.filter(b => b.reason === 'count').length
            }
        });
        
        if (dryRun) {
            console.log('🧪 [GTAW Sync] DRY RUN - Would delete backups:', backupsToDelete);
            return {
                deleted: 0,
                errors: 0,
                dryRun: true,
                wouldDelete: backupsToDelete.length,
                analysis: backupsToDelete
            };
        }
        
        // Delete the backups
        let deleted = 0;
        let errors = 0;
        
        for (const backup of backupsToDelete) {
            try {
                const success = await deleteSuccessfulBackup(backup.id);
                if (success) {
                    deleted++;
                    console.log(`🗑️ [GTAW Sync] Deleted ${backup.reason} backup:`, {
                        id: backup.id,
                        user: backup.username,
                        age: `${backup.age} days`
                    });
                } else {
                    errors++;
                }
            } catch (error) {
                errors++;
                console.error('❌ [GTAW Sync] Failed to delete backup during cleanup:', {
                    backupId: backup.id,
                    error: error.message
                });
            }
        }
        
        console.log('✅ [GTAW Sync] Backup cleanup completed:', {
            deleted,
            errors,
            remaining: Object.keys(allBackups).length - deleted
        });
        
        return {
            deleted,
            errors,
            remaining: Object.keys(allBackups).length - deleted,
            message: `Deleted ${deleted} old backups, ${errors} errors`
        };
        
    } catch (error) {
        console.error('❌ [GTAW Sync] Backup cleanup failed:', error);
        return {
            deleted: 0,
            errors: 1,
            message: `Cleanup failed: ${error.message}`
        };
    }
};

/**
 * Match character names from GTAW OAuth data against saved report author names
 * @param {Array} gtaCharacters - Array of character objects from GTAW OAuth
 * @param {Object} savedReports - Firebase saved reports data structure
 * @returns {Object} Matching results with character-to-report mappings
 */
export const matchCharactersToReports = (gtaCharacters, savedReports) => {
    const matches = [];
    const unmatchedReports = [];
    const unmatchedCharacters = [...gtaCharacters];

    console.log('🔍 [GTAW Sync] Starting character-to-report matching:', {
        characterCount: gtaCharacters.length,
        characters: gtaCharacters.map(char => ({
            id: char.id,
            name: char.name || `${char.firstname || ''} ${char.lastname || ''}`.trim(),
            firstname: char.firstname,
            lastname: char.lastname
        })),
        reportAuthors: Object.keys(savedReports || {})
    });

    // Create normalized character name lookup
    const characterLookup = gtaCharacters.map(char => {
        const fullName = char.name || `${char.firstname || ''} ${char.lastname || ''}`.trim();
        return {
            character: char,
            normalizedName: normalizeEmployeeName(fullName),
            originalName: fullName
        };
    });

    // Process each saved report author
    if (savedReports) {
        Object.keys(savedReports).forEach(authorKey => {
            const authorReports = savedReports[authorKey];
            const normalizedAuthorKey = normalizeEmployeeName(authorKey);
            
            // Find matching character
            const matchingChar = characterLookup.find(charData => 
                charData.normalizedName === normalizedAuthorKey
            );

            if (matchingChar) {
                // Found a match
                matches.push({
                    authorKey,
                    character: matchingChar.character,
                    characterName: matchingChar.originalName,
                    reportCount: Object.keys(authorReports).length,
                    reports: authorReports
                });

                // Remove from unmatched characters
                const charIndex = unmatchedCharacters.findIndex(c => c.id === matchingChar.character.id);
                if (charIndex !== -1) {
                    unmatchedCharacters.splice(charIndex, 1);
                }
            } else {
                // No matching character found
                unmatchedReports.push({
                    authorKey,
                    reportCount: Object.keys(authorReports).length,
                    normalizedName: normalizedAuthorKey
                });
            }
        });
    }

    const result = {
        matches,
        unmatchedReports,
        unmatchedCharacters,
        stats: {
            totalReportAuthors: Object.keys(savedReports || {}).length,
            totalCharacters: gtaCharacters.length,
            matchedAuthors: matches.length,
            unmatchedAuthors: unmatchedReports.length,
            unmatchedCharacters: unmatchedCharacters.length
        }
    };

    console.log('📊 [GTAW Sync] Matching results:', result.stats);
    console.log('✅ [GTAW Sync] Matches found:', matches.map(m => ({
        author: m.authorKey,
        character: m.characterName,
        characterId: m.character.id,
        reports: m.reportCount
    })));

    return result;
};

/**
 * Normalize employee names for comparison (remove spaces, lowercase, etc.)
 */
export const normalizeEmployeeName = (name) => {
    if (!name) return '';
    
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric characters
        .trim();
};

/**
 * Update saved reports to include GTAW username and character ID with enhanced safety
 * @param {Array} matches - Array of matched character-to-report mappings
 * @param {string} gtawUsername - The GTAW UCP username
 * @param {Object} options - Additional options for sync behavior
 * @returns {Promise} Promise that resolves when updates are complete
 */
export const updateSavedReportsWithGtawData = async (matches, gtawUsername, options = {}) => {
    const {
        createBackup = true,
        validateBeforeUpdate = true,
        maxRetries = 3,
        dryRun = false
    } = options;
    
    let backupId = null;
    const updates = {};
    let totalReportsUpdated = 0;

    console.log('🔄 [GTAW Sync] Starting saved reports update:', {
        matchCount: matches.length,
        gtawUsername,
        options,
        timestamp: new Date().toISOString()
    });

    try {
        // Step 1: Create backup if requested
        if (createBackup && !dryRun) {
            backupId = await createSyncBackup(gtawUsername);
        }
        
        // Step 2: Get current data for validation
        const currentData = await getAllSavedReports();
        
        // Step 3: Prepare updates
        for (const match of matches) {
            const { authorKey, character, reports } = match;
            
            // Update each individual report under this author
            Object.keys(reports).forEach(reportKey => {
                const reportPath = `savedReports/${authorKey}/${reportKey}`;
                const existingReport = reports[reportKey];
                
                // Check if report already has GTAW data
                if (existingReport.gtawUsername && existingReport.gtawUsername !== gtawUsername) {
                    console.warn(`⚠️ [GTAW Sync] Report ${reportPath} already synced with different user: ${existingReport.gtawUsername}`);
                }
                
                // Add GTAW data to the existing report (preserving all existing fields)
                updates[reportPath] = {
                    ...existingReport,
                    gtawUsername,
                    gtawCharacterId: character.id,
                    gtawCharacterName: character.name || `${character.firstname || ''} ${character.lastname || ''}`.trim(),
                    gtawSyncTimestamp: new Date().toISOString(),
                    gtawSyncVersion: '1.1',
                    gtawBackupId: backupId // Reference to backup for potential rollback
                };
                
                totalReportsUpdated++;
            });

            console.log(`📝 [GTAW Sync] Prepared updates for ${match.reportCount} reports under author "${authorKey}"`);
        }
        
        // Step 4: Validate updates if requested
        if (validateBeforeUpdate) {
            const validation = validateSyncUpdates(updates, currentData);
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
            }
        }
        
        // Step 5: Apply updates with retry logic
        if (dryRun) {
            console.log('🧪 [GTAW Sync] DRY RUN - Would update:', {
                totalReportsUpdated,
                updates: Object.keys(updates)
            });
            
            return {
                success: true,
                dryRun: true,
                updatedReports: totalReportsUpdated,
                updatedAuthors: matches.length,
                gtawUsername,
                backupId,
                matches
            };
        }
        
        let lastError = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 [GTAW Sync] Update attempt ${attempt}/${maxRetries}`);
                
                // Perform batch update
                await update(ref(database), updates);
                
                console.log('✅ [GTAW Sync] Successfully updated saved reports:', {
                    totalReportsUpdated,
                    gtawUsername,
                    characterCount: matches.length,
                    backupId,
                    attempt,
                    timestamp: new Date().toISOString()
                });
                
                // Clean up successful backup to save storage space
                if (backupId && !dryRun) {
                    console.log('🧹 [GTAW Sync] Cleaning up successful backup...');
                    try {
                        const deleted = await deleteSuccessfulBackup(backupId);
                        if (deleted) {
                            console.log('✅ [GTAW Sync] Successfully cleaned up backup after sync');
                        }
                    } catch (cleanupError) {
                        console.warn('⚠️ [GTAW Sync] Failed to cleanup backup (sync still successful):', cleanupError.message);
                        // Don't fail the whole sync if backup cleanup fails
                    }
                }

                return {
                    success: true,
                    updatedReports: totalReportsUpdated,
                    updatedAuthors: matches.length,
                    gtawUsername,
                    backupId: backupId ? `${backupId} (deleted)` : null,
                    backupCleaned: !!backupId,
                    attempt,
                    matches
                };
                
            } catch (updateError) {
                lastError = updateError;
                console.warn(`⚠️ [GTAW Sync] Update attempt ${attempt} failed:`, updateError.message);
                
                if (attempt < maxRetries) {
                    // Wait before retry (exponential backoff)
                    const delay = Math.pow(2, attempt) * 1000;
                    console.log(`⏱️ [GTAW Sync] Waiting ${delay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        // All retries failed
        throw lastError;
        
    } catch (error) {
        console.error('❌ [GTAW Sync] Failed to update saved reports:', {
            error: error.message,
            gtawUsername,
            backupId,
            totalReportsUpdated
        });
        
        // Note: We don't auto-rollback here to avoid data loss
        // Backup can be manually restored if needed
        
        throw new Error(`Failed to sync reports with GTAW data: ${error.message}. Backup ID: ${backupId || 'none'}`);
    }
};

/**
 * Get all saved reports from Firebase for syncing
 * @returns {Promise<Object>} All saved reports data
 */
export const getAllSavedReports = async () => {
    try {
        console.log('📥 [GTAW Sync] Loading all saved reports for syncing...');
        
        const savedReportsRef = ref(database, 'savedReports');
        const snapshot = await get(savedReportsRef);
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            const reportCount = Object.keys(data).length;
            const totalReports = Object.values(data).reduce((total, authorReports) => 
                total + Object.keys(authorReports).length, 0
            );
            
            console.log('📊 [GTAW Sync] Loaded saved reports:', {
                authors: reportCount,
                totalReports,
                authors_list: Object.keys(data)
            });
            
            return data;
        } else {
            console.log('📭 [GTAW Sync] No saved reports found in database');
            return {};
        }
    } catch (error) {
        console.error('❌ [GTAW Sync] Failed to load saved reports:', error);
        throw new Error(`Failed to load saved reports: ${error.message}`);
    }
};

/**
 * Main sync function that orchestrates the entire process with enhanced safety
 * @param {Object} gtaUser - GTA World user data with characters
 * @param {Object} options - Sync options for safety and behavior control
 * @returns {Promise<Object>} Sync results
 */
export const syncGtawAccountWithReports = async (gtaUser, options = {}) => {
    const {
        dryRun = false,
        createBackup = true,
        validateUpdates = true,
        maxRetries = 3
    } = options;
    
    try {
        console.log('🚀 [GTAW Sync] Starting GTAW account sync:', {
            username: gtaUser.username,
            userId: gtaUser.id,
            characterCount: gtaUser.debugInfo?.charactersChecked?.length || 0,
            options,
            timestamp: new Date().toISOString()
        });

        // Get all characters from the user data - check multiple possible locations
        let characters = [];
        
        // First check if we have the actual character array from the API
        if (gtaUser.character && Array.isArray(gtaUser.character)) {
            characters = gtaUser.character;
        } else if (gtaUser.characters && Array.isArray(gtaUser.characters)) {
            characters = gtaUser.characters;
        } else if (gtaUser.userData && gtaUser.userData.character && Array.isArray(gtaUser.userData.character)) {
            characters = gtaUser.userData.character;
        } else if (gtaUser.userData && gtaUser.userData.characters && Array.isArray(gtaUser.userData.characters)) {
            characters = gtaUser.userData.characters;
        }
        
        // If we have faction data but no character array, create one from faction info
        if (characters.length === 0 && gtaUser.faction) {
            characters = [{
                id: gtaUser.faction.characterId,
                name: gtaUser.faction.characterName,
                firstname: gtaUser.faction.firstname || '',
                lastname: gtaUser.faction.lastname || '',
                memberid: gtaUser.id
            }];
        }
        
        console.log('🔍 [GTAW Sync] Character data analysis:', {
            charactersFound: characters.length,
            gtaUserKeys: Object.keys(gtaUser),
            hasUserData: !!gtaUser.userData,
            userDataKeys: gtaUser.userData ? Object.keys(gtaUser.userData) : [],
            hasFaction: !!gtaUser.faction,
            characters: characters.map(c => ({ id: c.id, name: c.name || `${c.firstname || ''} ${c.lastname || ''}`.trim() }))
        });
        
        if (characters.length === 0) {
            throw new Error('No characters found in GTAW user data - checked character, characters, userData.character, userData.characters, and faction fields');
        }

        // Load all saved reports
        const savedReports = await getAllSavedReports();
        
        if (Object.keys(savedReports).length === 0) {
            return {
                success: true,
                message: 'No saved reports found to sync',
                stats: {
                    matches: 0,
                    updatedReports: 0,
                    updatedAuthors: 0
                }
            };
        }

        // Match characters to reports
        const matchingResults = matchCharactersToReports(characters, savedReports);
        
        if (matchingResults.matches.length === 0) {
            return {
                success: true,
                message: 'No matching characters found in saved reports',
                stats: {
                    matches: 0,
                    updatedReports: 0,
                    updatedAuthors: 0,
                    totalCharacters: characters.length,
                    totalReportAuthors: matchingResults.stats.totalReportAuthors
                }
            };
        }

        // Check if sync is actually needed to avoid unnecessary Firebase costs
        const reportsNeedingSync = [];
        let totalReportsChecked = 0;
        
        for (const match of matchingResults.matches) {
            const { authorKey, character, reports } = match;
            
            Object.keys(reports).forEach(reportKey => {
                const report = reports[reportKey];
                totalReportsChecked++;
                
                // Check if report needs syncing
                const needsSync = !report.gtawUsername || 
                                 !report.gtawCharacterId || 
                                 !report.gtawCharacterName ||
                                 report.gtawUsername !== gtaUser.username ||
                                 report.gtawCharacterId !== character.id ||
                                 !report.gtawSyncVersion ||
                                 report.gtawSyncVersion !== '1.1';
                
                if (needsSync) {
                    reportsNeedingSync.push({
                        authorKey,
                        reportKey,
                        character,
                        report,
                        reason: !report.gtawUsername ? 'missing_gtaw_data' : 
                               report.gtawUsername !== gtaUser.username ? 'different_user' :
                               report.gtawCharacterId !== character.id ? 'different_character' :
                               !report.gtawSyncVersion || report.gtawSyncVersion !== '1.1' ? 'outdated_version' : 'unknown'
                    });
                }
            });
        }
        
        console.log('🔍 [GTAW Sync] Sync requirement analysis:', {
            totalReportsChecked,
            reportsNeedingSync: reportsNeedingSync.length,
            alreadySynced: totalReportsChecked - reportsNeedingSync.length,
            syncReasons: reportsNeedingSync.reduce((acc, r) => {
                acc[r.reason] = (acc[r.reason] || 0) + 1;
                return acc;
            }, {}),
            currentUser: gtaUser.username
        });
        
        if (reportsNeedingSync.length === 0) {
            return {
                success: true,
                message: `All ${totalReportsChecked} matching reports are already synced`,
                stats: {
                    matches: matchingResults.matches.length,
                    updatedReports: 0,
                    updatedAuthors: 0,
                    totalCharacters: characters.length,
                    totalReportAuthors: matchingResults.stats.totalReportAuthors,
                    alreadySynced: totalReportsChecked
                },
                details: {
                    syncSkipped: true,
                    reason: 'all_reports_already_synced'
                }
            };
        }
        
        // Filter matches to only include those with reports that need syncing
        const filteredMatches = matchingResults.matches.map(match => {
            const reportsToSync = {};
            Object.keys(match.reports).forEach(reportKey => {
                const needsSync = reportsNeedingSync.some(r => 
                    r.authorKey === match.authorKey && r.reportKey === reportKey
                );
                if (needsSync) {
                    reportsToSync[reportKey] = match.reports[reportKey];
                }
            });
            
            return {
                ...match,
                reports: reportsToSync,
                reportCount: Object.keys(reportsToSync).length
            };
        }).filter(match => match.reportCount > 0);

        // Update the matched reports with GTAW data using enhanced safety features
        const updateResults = await updateSavedReportsWithGtawData(
            filteredMatches, 
            gtaUser.username,
            {
                createBackup,
                validateBeforeUpdate: validateUpdates,
                maxRetries,
                dryRun
            }
        );

        const message = dryRun 
            ? `DRY RUN: Would sync ${updateResults.updatedReports} reports across ${updateResults.updatedAuthors} authors`
            : `Successfully synced ${updateResults.updatedReports} reports across ${updateResults.updatedAuthors} authors${updateResults.backupCleaned ? ' (backup cleaned up)' : ''}`;

        // Optionally run periodic cleanup of old backups
        if (!dryRun && updateResults.success) {
            try {
                console.log('🧹 [GTAW Sync] Running periodic backup cleanup...');
                const cleanupResults = await cleanupOldBackups({
                    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                    maxCount: 5 // Keep max 5 backups per user
                });
                console.log('✅ [GTAW Sync] Periodic cleanup completed:', cleanupResults.message);
            } catch (cleanupError) {
                console.warn('⚠️ [GTAW Sync] Periodic cleanup failed (sync still successful):', cleanupError.message);
            }
        }

        return {
            success: true,
            message,
            dryRun,
            stats: {
                matches: matchingResults.matches.length,
                updatedReports: updateResults.updatedReports,
                updatedAuthors: updateResults.updatedAuthors,
                totalCharacters: characters.length,
                totalReportAuthors: matchingResults.stats.totalReportAuthors,
                alreadySynced: totalReportsChecked - reportsNeedingSync.length,
                reportsNeedingSync: reportsNeedingSync.length
            },
            details: {
                matchingResults,
                updateResults,
                backupId: updateResults.backupId,
                backupCleaned: updateResults.backupCleaned,
                syncAnalysis: {
                    totalReportsChecked,
                    reportsNeedingSync: reportsNeedingSync.length,
                    syncReasons: reportsNeedingSync.reduce((acc, r) => {
                        acc[r.reason] = (acc[r.reason] || 0) + 1;
                        return acc;
                    }, {})
                }
            }
        };

    } catch (error) {
        console.error('❌ [GTAW Sync] Sync process failed:', error);
        return {
            success: false,
            message: `Sync failed: ${error.message}`,
            error: error.message,
            canRollback: error.message.includes('Backup ID:'),
            backupInfo: error.message.includes('Backup ID:') ? 
                error.message.match(/Backup ID: (\S+)/)?.[1] : null
        };
    }
};