import { onCall } from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import { db, timestamp } from '../utils/firebase.js';
export * from './coroner.js';


/**
 * Upload and process faction member data from CSV.
 *
 * P0 (e) cost plan: this was anonymously invocable with no payload cap and
 * performed a full-node overwrite + unbounded backups/ growth per call.
 * Now: auth + upload_faction_data permission required, 2000-row cap,
 * backups pruned to the 5 most recent.
 */
const MAX_FACTION_UPLOAD_ROWS = 2000;
const MAX_FACTION_BACKUPS = 5;

export const uploadFactionData = onCall({
    region: "europe-west2",
    memory: "256MiB",
    timeoutSeconds: 120,
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
    ]
}, async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    // Same claim convention as triggerFactionSync: superadmin bypasses,
    // otherwise the caller needs the upload_faction_data permission.
    const token = request.auth.token || {};
    const isSuperAdmin = token.isSuperAdmin === true || token.accessLevel === 'superadmin';
    const permissions = Array.isArray(token.permissions) ? token.permissions : [];
    if (!isSuperAdmin && !permissions.includes('upload_faction_data')) {
        throw new functions.https.HttpsError('permission-denied', 'Faction data upload permission required.');
    }

    console.log('[Faction Upload] Starting faction data upload');

    const { factionData, metadata } = request.data;

    if (!factionData || !Array.isArray(factionData)) {
        throw new functions.https.HttpsError('invalid-argument', 'Faction data must be an array');
    }

    if (factionData.length > MAX_FACTION_UPLOAD_ROWS) {
        throw new functions.https.HttpsError('invalid-argument', `Faction data exceeds the ${MAX_FACTION_UPLOAD_ROWS}-row limit.`);
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
                    uploadedAt: timestamp,
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
        
        // Create backup of existing data if it exists (pruned to the most recent few)
        const existingData = await factionRef.once('value');
        if (existingData.exists()) {
            const backupRef = db.ref(`factions/${metadata.factionId}/backups/${Date.now()}`);
            await backupRef.set({
                data: existingData.val().members || {},
                metadata: existingData.val().metadata || {},
                backedUpAt: timestamp
            });
            console.log('[Faction Upload] Created backup of existing data');
            try {
                const backupsSnap = await db.ref(`factions/${metadata.factionId}/backups`).once('value');
                const backupKeys = Object.keys(backupsSnap.val() || {}).sort();
                if (backupKeys.length > MAX_FACTION_BACKUPS) {
                    const stale = {};
                    backupKeys.slice(0, backupKeys.length - MAX_FACTION_BACKUPS).forEach((k) => { stale[k] = null; });
                    await db.ref(`factions/${metadata.factionId}/backups`).update(stale);
                    console.log(`[Faction Upload] Pruned ${backupKeys.length - MAX_FACTION_BACKUPS} old backups`);
                }
            } catch (pruneErr) {
                console.warn('[Faction Upload] Backup prune failed (non-fatal):', pruneErr.message);
            }
        }
        
        // Store new data
        await factionRef.set({
            members: processedData,
            metadata: {
                ...metadata,
                lastUpdated: timestamp,
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
            uploadedAt: timestamp,
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
