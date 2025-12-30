import { database } from '../firebase';
import { ref, get, set, push } from 'firebase/database';
import { getCharacterID } from '../utils/characterUtils';

/**
 * Service for dynamically adding authenticated GTAW users to Firebase staff collections
 */

/**
 * Log webhook to Firebase for tracking
 * @param {string} type - Type of webhook (e.g., 'dynamic_staff_addition')
 * @param {Object} payload - Webhook payload data
 */
const logWebhookToFirebase = async (type, payload) => {
    try {
        const logsRef = ref(database, 'webhook_logs');
        const newLogRef = push(logsRef);
        await set(newLogRef, {
            type,
            payload,
            timestamp: Date.now(),
        });
        console.log(`[DynamicStaff] Webhook logged to Firebase: ${type}`);
    } catch (error) {
        console.error('[DynamicStaff] Error logging webhook to Firebase:', error);
    }
};

/**
 * Send webhook notification for dynamic staff addition
 * @param {Object} gtaWorldUser - The authenticated GTAW user
 * @param {string} staffType - Either 'phmc' or 'coroner' (for webhook display)
 * @param {string} characterName - Character name that was added
 * @param {Object} newStaffEntry - The staff entry that was created
 */
const sendDynamicStaffWebhook = async (gtaWorldUser, staffType, characterName, newStaffEntry) => {
    try {
        const webhookURL = import.meta.env.VITE_DISCORD_WEBHOOK_ADMIN || import.meta.env.VITE_DEV_WEBHOOK;
        if (!webhookURL) {
            console.log('[DynamicStaff] Admin/Dev webhook URL not configured, skipping webhook');
            return;
        }

        const embed = {
            title: "🔄 Dynamic Staff Addition",
            description: `**${characterName}** was automatically added to ${staffType.toUpperCase()} staff database via GTAW OAuth.`,
            color: staffType === 'coroner' ? 0xFF6B6B : 0x4ECDC4, // Red for coroner, teal for PHMC
            fields: [
                { name: "Character Name", value: characterName, inline: true },
                { name: "Staff Type", value: staffType.toUpperCase(), inline: true },
                { name: "Rank/Category", value: newStaffEntry.rank || 'N/A', inline: true },
                { name: "Badge Number", value: newStaffEntry.badge || 'N/A', inline: true },
                { name: "Discord Username", value: newStaffEntry.discord || 'N/A', inline: true },
                { name: "Character ID", value: newStaffEntry.characterId || 'N/A', inline: true },
                { name: "Original Rank", value: gtaWorldUser?.faction?.rank || 'N/A', inline: false },
                { name: "Added Date", value: new Date(newStaffEntry.addedDate).toLocaleString(), inline: false }
            ],
            timestamp: new Date().toISOString(),
            footer: {
                text: "PHMC Dynamic Staff Integration"
            }
        };

        const payload = {
            username: "PHMC Dynamic Staff",
            avatar_url: 'https://i.ibb.co/0pgw9hHm/phmc.png',
            embeds: [embed]
        };

        // Send webhook
        const response = await fetch(webhookURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log(`[DynamicStaff] Successfully sent webhook for ${characterName} addition`);
            
            // Log to Firebase
            await logWebhookToFirebase('dynamic_staff_addition', {
                characterName,
                staffType,
                staffEntry: newStaffEntry,
                webhookSent: true,
                timestamp: new Date().toISOString()
            });
        } else {
            const errorText = await response.text();
            console.error(`[DynamicStaff] Failed to send webhook. Status: ${response.status}`, errorText);
            
            // Still log to Firebase even if webhook failed
            await logWebhookToFirebase('dynamic_staff_addition', {
                characterName,
                staffType,
                staffEntry: newStaffEntry,
                webhookSent: false,
                webhookError: `${response.status}: ${errorText}`,
                timestamp: new Date().toISOString()
            });
        }

    } catch (error) {
        console.error('[DynamicStaff] Error sending webhook:', error);
        
        // Log error to Firebase
        await logWebhookToFirebase('dynamic_staff_addition', {
            characterName,
            staffType,
            staffEntry: newStaffEntry,
            webhookSent: false,
            webhookError: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

// Coroner-specific ranks that should be added to coroner collection
const CORONER_RANKS = [
    'coroner',
    'forensic attendant', 
    'medical examiner',
    'chief medical examiner',
    'deputy chief medical examiner',
    'forensic investigator',
    'coroner investigator',
    'forensic pathologist',
    'senior medical examiner',
    'coroner intern'
];

const PHMC_FACTION_ID = '364'; // All PHMC and Coroner employees belong to this single faction.

/**
 * Check if a rank indicates coroner employment
 * @param {string} rank - The rank to check
 * @returns {boolean} - True if rank indicates coroner role
 */
const isCoronerRank = (rank) => {
    if (!rank) return false;
    const normalizedRank = rank.toLowerCase().trim();
    return CORONER_RANKS.some(coronerRank => 
        normalizedRank.includes(coronerRank)
    );
};

/**
 * Extract character name from GTAW user data
 * @param {Object} gtaWorldUser - The authenticated GTAW user
 * @returns {string|null} - Character name or null if not available
 */
const getCharacterName = (gtaWorldUser) => {
    if (!gtaWorldUser) return null;
    
    // Try faction character name first
    if (gtaWorldUser.faction?.characterName) {
        return gtaWorldUser.faction.characterName;
    }
    
    // Try constructed name from faction data
    if (gtaWorldUser.faction?.firstname && gtaWorldUser.faction?.lastname) {
        return `${gtaWorldUser.faction.firstname} ${gtaWorldUser.faction.lastname}`;
    }
    
    // Fallback to username
    return gtaWorldUser.username || null;
};

/**
 * Check if user exists in Firebase factions collection
 * @param {string} characterName - Name to search for
 * @returns {Promise<boolean>} - True if user exists in staff list
 */
const userExistsInFactions = async (characterName) => {
    if (!characterName) return false;

    const factionMembersRef = ref(database, `factions/${PHMC_FACTION_ID}/members`);
    const snapshot = await get(factionMembersRef);

    if (snapshot.exists()) {
        const membersData = snapshot.val();
        for (const memberId in membersData) {
            const member = membersData[memberId];
            if (member.characterName && member.characterName.toLowerCase() === characterName.toLowerCase()) {
                return true;
            }
        }
    }
    return false;
};

/**
 * Add user to Firebase factions collection
 * @param {Object} gtaWorldUser - The authenticated GTAW user
 * @param {string} characterName - Character name to add
 * @returns {Promise<boolean>} - True if successfully added
 */
const addUserToStaff = async (gtaWorldUser, characterName) => {
    try {
        const characterId = getCharacterID(gtaWorldUser);
        const memberRef = ref(database, `factions/${PHMC_FACTION_ID}/members/${characterId}`);

        // Double-check user doesn't already exist in this specific faction
        const memberSnapshot = await get(memberRef);
        if (memberSnapshot.exists()) {
            console.log(`[DynamicStaff] User ${characterName} already exists in faction ${PHMC_FACTION_ID}`);
            return false;
        }
        
        // Clean rank by removing dashes
        const cleanRank = gtaWorldUser?.faction?.rank ? 
            gtaWorldUser.faction.rank.replace(/-/g, ' ').trim() : 'GTAW User';
        
        // Create new staff entry
        const newStaffEntry = {
            characterName: characterName,
            rank: cleanRank, // Use 'rank' for consistency with factions data
            scriptRank: gtaWorldUser?.faction?.rank || '', // Keep original script rank
            badge: getCharacterID(gtaWorldUser) || '',
            discord: gtaWorldUser?.username || '', // Discord username from GTAW OAuth
            phNumber: '50056', // Default PH number
            addedBy: 'Dynamic GTAW OAuth',
            addedDate: new Date().toISOString(),
            characterId: characterId
        };
        
        await set(memberRef, newStaffEntry);
        
        console.log(`[DynamicStaff] Successfully added ${characterName} to faction ${PHMC_FACTION_ID}:`, newStaffEntry);
        
        // Determine staffType for webhook display
        const staffTypeForWebhook = isCoronerRank(gtaWorldUser?.faction?.rank) ? 'coroner' : 'phmc'; // Determine based on rank
        
        // Send webhook notification and log to Firebase
        await sendDynamicStaffWebhook(gtaWorldUser, staffTypeForWebhook, characterName, newStaffEntry);
        
        return true;
        
    } catch (error) {
        console.error(`[DynamicStaff] Error adding user to faction ${PHMC_FACTION_ID}:`, error);
        return false;
    }
};

/**
 * Main function to check and dynamically add GTAW user to appropriate staff collection
 * @param {Object} gtaWorldUser - The authenticated GTAW user
 * @param {Function} showNotification - Notification function
 * @returns {Promise<Object>} - Result object with success status and staff type
 */
export const checkAndAddDynamicStaff = async (gtaWorldUser, showNotification) => {
    try {
        // Validate inputs
        if (!gtaWorldUser || !gtaWorldUser.faction) {
            console.log('[DynamicStaff] No valid GTAW user or faction data');
            return { success: false, reason: 'No valid GTAW user data' };
        }
        
        const characterName = getCharacterName(gtaWorldUser);
        if (!characterName || characterName === 'GTAW User') {
            console.log('[DynamicStaff] No valid character name found');
            return { success: false, reason: 'No valid character name' };
        }
        
        // Check if user already exists in the PHMC faction
        const existsInPhmcFaction = await userExistsInFactions(characterName);
        
        if (existsInPhmcFaction) {
            console.log(`[DynamicStaff] ${characterName} already exists in PHMC faction`);
            return { success: false, reason: 'User already exists in PHMC faction' };
        }
        
        // Determine staffType for notification/webhook based on rank
        const userRank = gtaWorldUser?.faction?.rank || '';
        const isCoroner = isCoronerRank(userRank);
        const staffTypeForNotification = isCoroner ? 'coroner' : 'phmc';
        
        console.log(`[DynamicStaff] Adding ${characterName} with rank "${userRank}" to PHMC faction`);
        
        // Add user to the PHMC faction
        const addSuccess = await addUserToStaff(gtaWorldUser, characterName); // Removed factionId argument
        
        if (addSuccess && showNotification) {
            showNotification(
                `${characterName} automatically added to ${staffTypeForNotification.toUpperCase()} staff database`,
                'check-circle',
                5000
            );
        }
        
        return { 
            success: addSuccess, 
            staffType: staffTypeForNotification, 
            characterName,
            reason: addSuccess ? 'Successfully added to staff' : 'Failed to add to Firebase'
        };
        
    } catch (error) {
        console.error('[DynamicStaff] Error in checkAndAddDynamicStaff:', error);
        return { success: false, reason: 'Error occurred during processing' };
    }
};

export default {
    checkAndAddDynamicStaff,
    isCoronerRank,
    getCharacterName
};