// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK.
// This should be done once at the top level of your functions/index.js file.
if (admin.apps.length === 0) {
    admin.initializeApp();
}

/**
 * Callable function to set an admin custom claim on a user.
 * @param {object} data - The data passed to the function.
 * @param {string} data.email - The email of the user to make an admin.
 * @param {object} context - The context of the function call.
 * @param {object} context.auth - Authentication information about the caller.
 */
exports.setAdminRole = functions.https.onCall(async (data, context) => {
    // --- IMPORTANT SECURITY CHECK ---
    // This function should ONLY be callable by an already authenticated admin.
    // For initial setup, you might temporarily disable this check or call it from a trusted environment.
    // In a production scenario, you'd verify context.auth.token.admin === true here.
    // For now, let's assume you're calling this from a secure environment or will add that check later.
    /*
    if (!context.auth || !context.auth.token.admin) {
        console.error("Unauthorized attempt to call setAdminRole by UID:", context.auth ? context.auth.uid : "No Auth");
        throw new functions.https.HttpsError(
            "permission-denied",
            "You must be an admin to set admin roles."
        );
    }
    */
    // --- END SECURITY CHECK ---

    const email = data.email;
    if (!email) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "The function must be called with an 'email' argument."
        );
    }

    try {
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().setCustomUserClaims(user.uid, { admin: true });
        console.log(`Successfully set admin role for ${email} (UID: ${user.uid})`);
        return { message: `Success! ${email} has been made an admin.` };
    } catch (error) {
        console.error("Error setting admin role:", error);
        let errorCode = 'internal';
        if (error.code === 'auth/user-not-found') {
            errorCode = 'not-found';
        }
        throw new functions.https.HttpsError(
            errorCode,
            `Unable to set admin role for ${email}. Reason: ${error.message}`
        );
    }
});
