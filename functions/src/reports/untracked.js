import { onCall } from "firebase-functions/v2/https";
import { processUntrackedLocation } from '../utils/locationReporting.js';

/**
 * Reports a new, untracked location to the admin webhook for review.
 * This function is designed to be called when the system detects a location
 * that it cannot confidently match to the known list.
 */
export const reportUntrackedLocation = onCall({
    secrets: ["ADMIN_ACTION_WEBHOOK_URL"],
}, async (request) => {
    const { place, street, area, reportKey } = request.data;
    return await processUntrackedLocation(place, street, area, reportKey);
});