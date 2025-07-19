import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import admin from "firebase-admin";
import fetch from "node-fetch";

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.database();

// Set global options for all v2 functions in this file
setGlobalOptions({ region: "us-central1" }); // Or your preferred region

// --- Helper Functions ---

const getShuffledPhrases = (phrases) => {
    if (!Array.isArray(phrases) || phrases.length === 0) return [];
    const array = [...phrases];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

const sendWebhook = async (payload) => {
    // --- MODIFICATION: Use process.env to access the secret/environment variable
    const webhookURL = process.env.ADMIN_ACTION_WEBHOOK_URL;
    if (!webhookURL) {
        // --- MODIFICATION: Updated warning message
        console.warn("Webhook URL not found. Please set the ADMIN_ACTION_WEBHOOK_URL secret for this function.");
        return;
    }
    try {
        await fetch(webhookURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        console.error("Error sending webhook from Cloud Function:", error);
    }
};

const scheduleDeletion = async (request) => {
    const requestId = request.id;
    const processedAt = new Date(request.processedAt);
    const now = new Date();
    const timeDiff = now.getTime() - processedAt.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));

    let isDeletable = false;

    if (request.status.startsWith('Denied') && daysDiff >= 2) {
        isDeletable = true;
    } else if (request.status === 'approved' && daysDiff >= 1) {
        isDeletable = true;
    }

    if (isDeletable) {
        const requestRef = db.ref(`bingo/phraseRequests/${requestId}`);
        try {
            await requestRef.remove();
            console.log(`Successfully deleted request ${requestId}`);

             const embed = {
                 title: "Bingo Phrase Request Deleted (Scheduled)",
                 description: `Request ID: ${requestId} automatically deleted.`,
                 fields: [
                     { name: "Status", value: request.status, inline: true },
                     { name: "Requested By", value: request.requestedBy, inline: true },
                     { name: "Phrase", value: request.phrase, inline: false },
                 ],
                 timestamp: new Date().toISOString(),
                 footer: { text: "PHMC Forms - Scheduled Cleanup" }
             };
             await sendWebhook({ embeds: [embed] });

        } catch (error) {
            console.error(`Error deleting request ${requestId}:`, error);
            // Consider logging this error to Sentry
        }
    }
};

// --- Scheduled Cloud Function (v2) ---

// Use ESM 'export' syntax instead of 'exports.dailyTaskHandler ='
export const dailyTaskHandler = onSchedule({
    schedule: "every day 09:00",
    timeZone: "UTC",
    // --- MODIFICATION: Add the 'secrets' option to grant access to the webhook URL
    secrets: ["ADMIN_ACTION_WEBHOOK_URL"],
}, async (event) => {
    console.log(`Running daily task handler. Event ID: ${event.id}`);

    // --- Bingo Reset Logic ---
    const BINGO_TYPES = [
        { id: 'er', name: 'Emergency Room', path: 'ER' },
        { id: 'ems', name: 'EMS', path: 'EMS' },
        { id: 'coroner', name: 'Coroner', path: 'Coroner' }
    ];

    const bingoResults = { success: [], noCard: [], notEnoughPhrases: [], errors: [] };

    await db.ref('bingo/meta').update({ lastAutoRegenTimestamp: admin.database.ServerValue.TIMESTAMP });

    await Promise.all(BINGO_TYPES.map(async (bingoType) => {
        const cardPhrasesRef = db.ref(`bingo/cards/${bingoType.path}/phrases`);
        const masterPhrasesRef = db.ref(`bingo/phrases/${bingoType.path}`);
        const activityLogRef = db.ref(`bingo/logs/${bingoType.path}/activityLog`);

        try {
            const cardSnapshot = await cardPhrasesRef.once('value');
            if (!cardSnapshot.exists()) {
                bingoResults.noCard.push(bingoType.name);
                return;
            }

            const masterSnapshot = await masterPhrasesRef.once('value');
            if (!masterSnapshot.exists()) {
                bingoResults.notEnoughPhrases.push(`${bingoType.name} (no master list)`);
                return;
            }

            const masterPhrasesData = masterSnapshot.val();
            // --- IMPROVEMENT: More robustly handle object-or-array data structures from Firebase.
            const masterPhrases = Array.isArray(masterPhrasesData)
                ? masterPhrasesData.filter(Boolean)
                : (typeof masterPhrasesData === 'object' && masterPhrasesData !== null)
                    ? Object.values(masterPhrasesData).map(p => (typeof p === 'object' ? p.phrase : p)).filter(Boolean)
                    : [];

            if (masterPhrases.length < 24) {
                bingoResults.notEnoughPhrases.push(`${bingoType.name} (${masterPhrases.length}/24)`);
                return;
            }

            const shuffledPhrases = getShuffledPhrases(masterPhrases).slice(0, 24);
            await cardPhrasesRef.set(shuffledPhrases);
            await activityLogRef.remove();
            bingoResults.success.push(bingoType.name);

        } catch (error) {
            console.error(`Error processing ${bingoType.name}:`, error);
            bingoResults.errors.push(`${bingoType.name}: ${error.message}`);
        }
    }));

    let bingoDetails = '';
    if (bingoResults.success.length > 0) bingoDetails += `✅ Regenerated: ${bingoResults.success.join(', ')}\n`;
    if (bingoResults.noCard.length > 0) bingoDetails += `➖ Skipped (Disabled): ${bingoResults.noCard.join(', ')}\n`;
    if (bingoResults.notEnoughPhrases.length > 0) bingoDetails += `⚠️ Skipped (Not Enough Phrases): ${bingoResults.notEnoughPhrases.join(', ')}\n`;
    if (bingoResults.errors.length > 0) bingoDetails += `❌ Errors: ${bingoResults.errors.join(', ')}\n`;

    // --- Phrase Request Deletion Logic ---
       const requestsRef = db.ref('bingo/phraseRequests');
    let deletionDetails = '';
       try {
           const snapshot = await requestsRef.once('value');
           if (snapshot.exists()) {
               const requests = snapshot.val();
               let deletionCount = 0;

               // Collect deletion promises
               const deletionPromises = Object.entries(requests)
                   .map(([key, value]) => {
                       const request = { id: key, ...value };
                       if (request.status !== 'pending' && request.processedAt) {
                           return scheduleDeletion(request).then(() => {
                               deletionCount++; // Increment only on successful deletion
                           });
                       }
                       return null;
                   })
                   .filter(Boolean);

               await Promise.all(deletionPromises);
               deletionDetails = `✅ Successfully deleted ${deletionCount} phrase requests.\n`;

           } else {
               deletionDetails = '➖ No phrase requests found to delete.\n';
           }
       } catch (error) {
           console.error('Error during deletion scheduling:', error);
           deletionDetails = `❌ Error during phrase request deletion: ${error.message}\n`;
       }

    const embed = {
        title: "Daily Task Handler",
        color: 0x1E90FF,
        fields: [
            { name: "Bingo Reset Status", value: `\`\`\`\n${bingoDetails.trim() || "No bingo actions taken."}\n\`\`\``, inline: false },
            { name: "Phrase Request Deletion", value: `\`\`\`\n${deletionDetails.trim() || "No phrase request actions taken."}\n\`\`\``, inline: false },
        ],
        timestamp: new Date(event.timestamp).toUTCString(),
        footer: { text: "PHMC Forms - Scheduled Cloud Function (v2)" }
    };

    await sendWebhook({ embeds: [embed] });

    console.log('Daily task handler finished successfully.');

    return null;
});
