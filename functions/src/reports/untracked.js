import { onCall } from "firebase-functions/v2/https";
import { db } from '../utils/firebase.js';
import { sendWebhook } from '../utils/helpers.js';

/**
 * Reports a new, untracked location to the admin webhook for review.
 * This function is designed to be called when the system detects a location
 * that it cannot confidently match to the known list.
 */
export const reportUntrackedLocation = onCall({
    secrets: ["ADMIN_ACTION_WEBHOOK_URL"],
}, async (request) => {
    const { place, street, area } = request.data;

    if (!place) {
        return { success: false, message: "Missing 'place' data." };
    }

    // To avoid spamming, we check if this exact 'place' has been reported recently.
    const logRef = db.ref(`untracked_locations_log/${place.replace(/[.#$[\/]/g, "_")}`);
    const snapshot = await logRef.once('value');
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    if (snapshot.exists() && snapshot.val().timestamp > oneHourAgo) {
        console.log(`[Untracked Location] Skipping report for '${place}' as it was reported recently.`);
        return { success: true, message: "Already reported recently." };
    }

    const embed = {
        title: "🗺️ New Untracked Location Detected",
        description: `A location from a coroner report could not be confidently matched. Please review and consider adding it to \`gtaLocations.js\`.`,
        color: 0x3498DB, // Blue
        fields: [
            { name: "Original Input", value: `


${place}


`, inline: false },
            { name: "Suggested Street", value: street || 'N/A', inline: true },
            { name: "Suggested Area", value: area || 'N/A', inline: true },
        ],
        footer: { text: "PHMC Tools - Automated Location Discovery" },
        timestamp: new Date().toISOString()
    };

    await sendWebhook({ embeds: [embed] });

    // Log that we've reported this place to prevent spam.
    await logRef.set({
        place: place,
        timestamp: Date.now()
    });

    return { success: true };
});
