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

// --- Scheduled Cloud Function (v2) ---

// Use ESM 'export' syntax instead of 'exports.scheduledBingoReset ='
export const scheduledBingoReset = onSchedule({
    schedule: "every day 09:00",
    timeZone: "UTC",
    // --- MODIFICATION: Add the 'secrets' option to grant access to the webhook URL
    secrets: ["ADMIN_ACTION_WEBHOOK_URL"],
}, async (event) => {
    console.log(`Running daily scheduled bingo reset. Event ID: ${event.id}`);

    const BINGO_TYPES = [
        { id: 'er', name: 'Emergency Room', path: 'ER' },
        { id: 'ems', name: 'EMS', path: 'EMS' },
        { id: 'coroner', name: 'Coroner', path: 'Coroner' }
    ];

    const results = { success: [], noCard: [], notEnoughPhrases: [], errors: [] };

    await db.ref('bingo/meta').update({ lastAutoRegenTimestamp: admin.database.ServerValue.TIMESTAMP });

    await Promise.all(BINGO_TYPES.map(async (bingoType) => {
        const cardPhrasesRef = db.ref(`bingo/cards/${bingoType.path}/phrases`);
        const masterPhrasesRef = db.ref(`bingo/phrases/${bingoType.path}`);
        const activityLogRef = db.ref(`bingo/logs/${bingoType.path}/activityLog`);

        try {
            const cardSnapshot = await cardPhrasesRef.once('value');
            if (!cardSnapshot.exists()) {
                results.noCard.push(bingoType.name);
                return;
            }

            const masterSnapshot = await masterPhrasesRef.once('value');
            if (!masterSnapshot.exists()) {
                results.notEnoughPhrases.push(`${bingoType.name} (no master list)`);
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
                results.notEnoughPhrases.push(`${bingoType.name} (${masterPhrases.length}/24)`);
                return;
            }

            const shuffledPhrases = getShuffledPhrases(masterPhrases).slice(0, 24);
            await cardPhrasesRef.set(shuffledPhrases);
            await activityLogRef.remove();
            results.success.push(bingoType.name);

        } catch (error) {
            console.error(`Error processing ${bingoType.name}:`, error);
            results.errors.push(`${bingoType.name}: ${error.message}`);
        }
    }));

    let details = '';
    if (results.success.length > 0) details += `✅ Regenerated: ${results.success.join(', ')}\n`;
    if (results.noCard.length > 0) details += `➖ Skipped (Disabled): ${results.noCard.join(', ')}\n`;
    if (results.notEnoughPhrases.length > 0) details += `⚠️ Skipped (Not Enough Phrases): ${results.notEnoughPhrases.join(', ')}\n`;
    if (results.errors.length > 0) details += `❌ Errors: ${results.errors.join(', ')}\n`;

    const embed = {
        title: "Automatic Daily Bingo Reset",
        color: 0x1E90FF,
        fields: [
            { name: "Status", value: "Completed", inline: true },
            { name: "Timestamp", value: new Date(event.timestamp).toUTCString(), inline: true },
            { name: "Details", value: `\`\`\`\n${details.trim() || "No actions taken."}\n\`\`\``, inline: false },
        ],
        footer: { text: "PHMC Forms - Scheduled Cloud Function (v2)" }
    };

    await sendWebhook({ embeds: [embed] });

    console.log('Daily scheduled bingo reset finished successfully.');
    return null;
});
