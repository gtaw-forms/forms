import { db } from './firebase.js';
import { sendWebhook } from './helpers.js';

// In-memory cache to prevent spam during a single function execution (e.g., a loop)
const reportedThisExecution = new Set();

export async function processUntrackedLocation(place, street = null, area = null, reportKey = null, source = "Unknown", metadata = {}) {
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
        const isReportSource = source === "REPORT";

        // Only skip if it's NOT a report source and was reported recently
        // We always want to update/overwrite if it's a discovery from a scan to ensure metadata is fresh
        if (!isReportSource && snapshot.exists() && snapshot.val().timestamp > oneHourAgo) {
            console.log(`[Untracked Location] Skipping report for '${normalizedPlace}' as it was reported recently.`);
            reportedThisExecution.add(lookupKey); 
            return { success: true, message: "Already reported recently." };
        }

        const dataToSet = {
            place: normalizedPlace,
            timestamp: Date.now(),
            lastReportKey: reportKey || 'N/A',
            source: source,
            ...metadata
        };

        if (street) dataToSet.suggestedStreet = street;
        if (area) dataToSet.suggestedArea = area;
        
        await logRef.set(dataToSet);
        reportedThisExecution.add(lookupKey);

        return { success: true, message: "Reported successfully." };
    } catch (error) {
        console.error(`[Untracked Location] Error processing '${normalizedPlace}':`, error);
        return { success: false, message: "Error during processing." };
    }
}
