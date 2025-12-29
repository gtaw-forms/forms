import { db } from './firebase.js';
import { sendWebhook } from './helpers.js';

// In-memory cache to prevent spam during a single function execution (e.g., a loop)
const reportedThisExecution = new Set();

export async function processUntrackedLocation(place, street = null, area = null, reportKey = null) {
    if (!place || typeof place !== 'string') {
        return { success: false, message: "Missing or invalid 'place' data." };
    }

    // Normalize for consistency
    const normalizedPlace = place.trim();
    const lookupKey = normalizedPlace.toLowerCase();

    // Check in-memory cache first
    if (reportedThisExecution.has(lookupKey)) {
        console.log(`[Untracked Location] Skipping duplicate in-memory for '${normalizedPlace}'`);
        return { success: true, message: "Already processed in this session." };
    }

    // Sanitize place for DB key
    const safePlaceKey = lookupKey.replace(/[.#$[\\\]\/]/g, "_");
    const logRef = db.ref(`untracked_locations_log/${safePlaceKey}`);
    
    try {
        const snapshot = await logRef.once('value');
        const oneHourAgo = Date.now() - (60 * 60 * 1000);

        if (snapshot.exists() && snapshot.val().timestamp > oneHourAgo) {
            console.log(`[Untracked Location] Skipping report for '${normalizedPlace}' as it was reported recently.`);
            reportedThisExecution.add(lookupKey); // Add to cache anyway
            return { success: true, message: "Already reported recently." };
        }

                // Add to memory cache immediately before sending webhook to prevent race conditions

                reportedThisExecution.add(lookupKey);

        

                /* Webhook temporarily disabled for manual scan/purge cleanup

                const embed = {

                    title: "🗺️ New Untracked Location Detected",

                    description: `A location from a coroner report could not be confidently matched. Please review and consider adding it to the Location Manager in the Admin Dashboard.`,

                    color: 0x3498DB, // Blue

                    fields: [

                        { name: "Original Input", value: `\n${normalizedPlace}\n`, inline: false },

                        { name: "Suggested Street", value: street || 'N/A', inline: true },

                        { name: "Suggested Area", value: area || 'N/A', inline: true },

                    ],

                    footer: { text: "PHMC Tools - Automated Location Discovery" },

                    timestamp: new Date().toISOString()

                };

        

                if (reportKey) {

                    embed.fields.push({ name: "Source Report Key", value: reportKey, inline: false });

                }

        

                await sendWebhook({ embeds: [embed] });

                */

        

                // Log that we've reported this place to prevent spam.

        
        await logRef.set({
            place: normalizedPlace,
            timestamp: Date.now(),
            lastReportKey: reportKey || 'N/A'
        });

        return { success: true, message: "Reported successfully." };
    } catch (error) {
        console.error(`[Untracked Location] Error processing '${normalizedPlace}':`, error);
        return { success: false, message: "Error during processing." };
    }
}
