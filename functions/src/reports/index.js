import { onCall } from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import { db, admin } from '../utils/firebase.js';
import { sendWebhook } from '../utils/helpers.js';

export * from './coroner.js';
export * from './untracked.js';

export const getSavedReports = onCall({
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
    ]
}, async (request) => {
    console.log('[Saved Reports] Starting saved reports retrieval');
    
    const { userId } = request.data;
    
    if (!userId) {
        throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
    }
    
    try {
        console.log('[Saved Reports] Looking up reports for user ID:', userId);
        
        const sanitizedUserId = userId.trim().replace(/[.#$[\\] ]+/g, '_');
        const userReportsPath = `savedReports/${sanitizedUserId}`;
        const reportsRef = db.ref(userReportsPath);
        
        const snapshot = await reportsRef.once('value');
        
        if (!snapshot.exists()) {
            console.log('[Saved Reports] No reports found for user:', userId);
            return {
                success: true,
                reports: [],
                message: 'No reports found for this user'
            };
        }
        
        const reportsData = snapshot.val();
        const sanitizedReports = Object.keys(reportsData).map(reportKey => {
            const report = reportsData[reportKey];
            return {
                key: reportKey,
                originalKey: report.originalKey,
                bbCodeVersion: report.bbCodeVersion,
                timestamp: report.timestamp,
                authorName: report.authorName,
            };
        });
        
        console.log(`[Saved Reports] Found ${sanitizedReports.length} reports for user:`, userId);
        
        return {
            success: true,
            reports: sanitizedReports,
            message: `Found ${sanitizedReports.length} reports`
        };
        
    } catch (error) {
        console.error('[Saved Reports] Error retrieving reports:', error);
        
        throw new functions.https.HttpsError('internal', 'Failed to retrieve saved reports', {
            originalError: error.message
        });
    }
});

export const migrateReportsToNewStructure = onCall({
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
    ]
}, async (request) => {
    console.log('[Migration] Starting report structure migration.');

    // Security: Ensure the user is an administrator
    // This assumes you have a custom claim 'admin' set to true for your admin users.
    // if (request.auth?.token?.admin !== true) { // Example: require admin claim
    //     console.warn(`[Migration] Unauthorized attempt by UID: ${request.auth?.uid}`);
    //     throw new functions.https.HttpsError('permission-denied', 'You must be an admin to perform this operation.');
    // }

    try {
        const reportsRef = db.ref('savedReports');
        const snapshot = await reportsRef.once('value');

        if (!snapshot.exists()) {
            console.log('[Migration] No reports found to migrate.');
            return { success: true, message: 'No reports found. Nothing to migrate.', migratedCount: 0 };
        }

        const allUsersReports = snapshot.val();
        const updates = {};
        let migratedCount = 0;
        let processedCount = 0;

        console.log('[Migration] Scanning all user reports for old structure...');

        for (const userId in allUsersReports) {
            const userReports = allUsersReports[userId]; // Fix: was allUserData[userId] which is undefined
            if (!userReports || typeof userReports !== 'object') continue;

            for (const reportId in userReports) {
                processedCount++;
                const report = userReports[reportId];

                // Check if the report is in the old format (has a bbCode property)
                if (report && typeof report === 'object' && report.hasOwnProperty('bbCode')) {
                    const bbCodeContent = report.bbCode;

                    // 1. Define path for the new BBCode-only entry
                    const bbCodePath = `/savedReportBBCode/${userId}/${reportId}`;
                    updates[bbCodePath] = { bbCode: bbCodeContent };

                    // 2. Define path to remove the bbCode from the original report
                    const originalReportBbCodePath = `/savedReports/${userId}/${reportId}/bbCode`;
                    updates[originalReportBbCodePath] = null; // Setting to null deletes the key in a multi-path update

                    migratedCount++;
                }
            }
        }

        console.log(`[Migration] Scan complete. Found ${migratedCount} reports to migrate out of ${processedCount} total reports.`);

        if (migratedCount > 0) {
            console.log('[Migration] Applying multi-path update to migrate reports...');
            await db.ref().update(updates);
            console.log('[Migration] Multi-path update complete.');
        } else {
            console.log('[Migration] No reports required migration.');
        }

        return {
            success: true,
            message: `Migration complete. Scanned ${processedCount} reports and migrated ${migratedCount} to the new structure.`, 
            migratedCount: migratedCount,
            totalScanned: processedCount
        };

    } catch (error) {
        console.error('[Migration] Error during report migration:', error);
        throw new functions.https.HttpsError('internal', 'An error occurred during the migration process.', {
            originalError: error.message
        });
    }
});

export const syncReportCounts = onCall({
    cors: [
        "https://phmc-forms.web.app",
        "https://phmc-forms.firebaseapp.com",
        "https://phmc.gta.world",
        "http://localhost:5173",
        "http://localhost:3000"
    ]
}, async (request) => {
    console.log('[Sync Counts] Starting combined report count sync process.');

    const legacyReportsRef = db.ref('/savedReports');
    const newReportsRef = db.ref('/newSavedReports');
    const countsRef = db.ref('/userReportCounts');
    
    try {
        const [legacySnapshot, newSnapshot] = await Promise.all([
            legacyReportsRef.once('value'),
            newReportsRef.once('value')
        ]);

        const legacyUsers = legacySnapshot.exists() ? legacySnapshot.val() : {};
        const newUsers = newSnapshot.exists() ? newSnapshot.val() : {};

        if (Object.keys(legacyUsers).length === 0 && Object.keys(newUsers).length === 0) {
            console.log('[Sync Counts] No reports found in legacy or new paths to sync.');
            return { success: true, message: 'No reports found to sync.', syncedUsers: 0 };
        }

        const combinedUserIds = new Set([...Object.keys(legacyUsers), ...Object.keys(newUsers)]);
        const updates = {};
        let syncedUsers = 0;

        for (const userId of combinedUserIds) {
            const legacyUserReports = legacyUsers[userId];
            const newUserReports = newUsers[userId];

            const legacyCount = (legacyUserReports && typeof legacyUserReports === 'object') ? Object.keys(legacyUserReports).length : 0;
            const newCount = (newUserReports && typeof newUserReports === 'object') ? Object.keys(newUserReports).length : 0;
            
            const totalCount = legacyCount + newCount;
            updates[`${userId}/total`] = totalCount;
            syncedUsers++;
        }

        if (syncedUsers > 0) {
            await countsRef.update(updates);
        }

        const successMessage = `Successfully synced combined counts for ${syncedUsers} users.`;
        console.log(`[Sync Counts] ${successMessage}`);
        
        await sendWebhook({
            embeds: [{
                title: "Report Count Sync Complete (Combined)",
                description: successMessage,
                color: 0x00FF00,
                footer: { text: "PHMC Tools - Admin Action" }
            }]
        });

        return {
            success: true,
            message: successMessage,
            syncedUsers
        };

    } catch (error) {
        console.error('[Sync Counts] Error during combined report count sync:', error);
        await sendWebhook({
            embeds: [{
                title: "Report Count Sync Failed (Combined)",
                description: `An error occurred: ${error.message}`,
                color: 0xFF0000,
                footer: { text: "PHMC Tools - Admin Action" }
            }]
        });
        throw new functions.https.HttpsError('internal', 'Failed to sync combined report counts.', error.message);
    }
});

/**
 * Upload and process faction member data from CSV
 */
export const uploadFactionData = onCall({
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
    ]
}, async (request) => {
    console.log('[Faction Upload] Starting faction data upload');
    
    const { factionData, metadata } = request.data;
    
    if (!factionData || !Array.isArray(factionData)) {
        throw new functions.https.HttpsError('invalid-argument', 'Faction data must be an array');
    }
    
    if (!metadata || !metadata.factionId) {
        throw new functions.https.HttpsError('invalid-argument', 'Metadata with faction ID is required');
    }
    
    try {
        console.log('[Faction Upload] Processing faction data:', {
            recordCount: factionData.length,
            factionId: metadata.factionId,
            fileName: metadata.fileName
        });
        
        // Validate and process the data
        const processedData = {};
        const errors = [];
        const statistics = {
            totalRecords: factionData.length,
            validRecords: 0,
            duplicates: 0,
            errors: 0,
            rankDistribution: {}
        };
        
        for (const member of factionData) {
            try {
                // Validate required fields
                if (!member.characterId || !member.characterName || !member.rank || member.scriptRank === undefined) {
                    errors.push(`Invalid member data: ${JSON.stringify(member)}`);
                    statistics.errors++;
                    continue;
                }
                
                const characterId = parseInt(member.characterId);
                if (isNaN(characterId)) {
                    errors.push(`Invalid character ID: ${member.characterId}`);
                    statistics.errors++;
                    continue;
                }
                
                // Check for duplicates
                if (processedData[characterId]) {
                    console.warn(`[Faction Upload] Duplicate character ID: ${characterId}`);
                    statistics.duplicates++;
                    continue;
                }
                
                // Process the member data
                const processedMember = {
                    characterId: characterId,
                    characterName: member.characterName.trim(),
                    rank: member.rank.trim(),
                    scriptRank: parseInt(member.scriptRank),
                    factionId: metadata.factionId,
                    lastDuty: member.lastDuty || null,
                    lastOnline: member.lastOnline || null,
                    activity: member.activity || null,
                    uploadedAt: admin.database.ServerValue.TIMESTAMP,
                    uploadedBy: request.auth?.uid || 'unknown',
                    dataVersion: metadata.uploadTime || new Date().toISOString()
                };
                
                processedData[characterId] = processedMember;
                statistics.validRecords++;
                
                // Track rank distribution
                const scriptRank = processedMember.scriptRank;
                statistics.rankDistribution[scriptRank] = (statistics.rankDistribution[scriptRank] || 0) + 1;
                
            } catch (memberError) {
                console.error('[Faction Upload] Error processing member:', memberError);
                errors.push(`Error processing member ${member.characterId}: ${memberError.message}`);
                statistics.errors++;
            }
        }
        
        console.log('[Faction Upload] Data processing complete:', statistics);
        
        // Store the processed data in Firebase
        const factionRef = db.ref(`factions/${metadata.factionId}`);
        
        // Create backup of existing data if it exists
        const existingData = await factionRef.once('value');
        if (existingData.exists()) {
            const backupRef = db.ref(`factions/${metadata.factionId}/backups/${Date.now()}`);
            await backupRef.set({
                data: existingData.val().members || {},
                metadata: existingData.val().metadata || {},
                backedUpAt: admin.database.ServerValue.TIMESTAMP
            });
            console.log('[Faction Upload] Created backup of existing data');
        }
        
        // Store new data
        await factionRef.set({
            members: processedData,
            metadata: {
                ...metadata,
                lastUpdated: admin.database.ServerValue.TIMESTAMP,
                uploadedBy: request.auth?.uid || 'unknown',
                statistics: statistics
            }
        });
        
        console.log('[Faction Upload] Data stored successfully');
        
        // Log the upload for audit purposes
        await db.ref('audit/faction_uploads').push({
            factionId: metadata.factionId,
            fileName: metadata.fileName,
            recordCount: statistics.validRecords,
            uploadedBy: request.auth?.uid || 'unknown',
            uploadedAt: admin.database.ServerValue.TIMESTAMP,
            statistics: statistics
        });
        
        return {
            success: true,
            statistics: statistics,
            errors: errors.slice(0, 10), // Limit errors in response
            message: `Successfully uploaded ${statistics.validRecords} faction members`
        };
        
    } catch (error) {
        console.error('[Faction Upload] Upload failed:', error);
        
        throw new functions.https.HttpsError('internal', 'Failed to upload faction data', {
            originalError: error.message
        });
    }
});
