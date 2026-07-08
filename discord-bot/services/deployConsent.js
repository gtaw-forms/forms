/**
 * Deploy Consent — user consent checks for auto-deploy.
 *
 * Checks Firebase `user-consent/<uid>/<formId>` before allowing deploy.
 * Zero state dependencies — imports only from deployLogger.js.
 */

import { logFnCall, sendWebhook } from './deployLogger.js';

const CONSENT_PATH = 'user-consent';

/**
 * Check whether a user has consented to auto-deploy for a specific form type.
 * Uses Firebase `user-consent/<uid>/<formId>` set by the web app's consent modal.
 *
 * @param {object} db       - Firebase database ref
 * @param {string} authorId - Firebase Auth UID
 * @param {string} formId   - Form type (e.g. 'coroner-report', 'coroner_email')
 * @returns {Promise<boolean>} true if consent is given or missing (backward compat), false if explicitly denied
 */
export async function checkUserConsent(db, authorId, formId) {
    logFnCall('deployConsent', 'checkUserConsent', 'Checking deploy consent', { authorId, formId });
    try {
        const snap = await db.ref(`${CONSENT_PATH}/${authorId}/${formId}`).once('value');
        const val = snap.val();
        return val !== false;
    } catch (err) {
        console.error(`[AUTO] Consent check error for ${authorId}/${formId}: ${err.message}`);
        return true;
    }
}

/**
 * Handle a report that was skipped because the user denied consent.
 * Marks it in Firebase and sends a notification webhook.
 */
export async function skipDueToConsent(db, authorId, reportKey, formId, label) {
    logFnCall('deployConsent', 'skipDueToConsent', 'Skipping report due to consent', { authorId, formId });
    console.log(`[AUTO] ${label} user has not consented to ${formId}`);
    try {
        await db.ref(`scheduledReports/${authorId}/${reportKey}`).update({
            hasdeployed: true,
            deployStatus: 'skipped_no_consent',
            deployMessage: `Auto-deploy blocked: user has not consented to ${formId}. Visit the Bot Consent settings to opt in.`,
            deployCheckedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error(`[AUTO] Failed to mark consent-skip for ${reportKey}: ${err.message}`);
    }

    await sendWebhook(null, {
        title: ' Skipped — No Consent',
        description: [
            `**Report:** ${label}`,
            `**Key:** \`${reportKey}\``,
            `**Form:** ${formId}`,
            `**Author:** \`${authorId}\``,
            '',
            'This user has not opted into auto-deploy for this form type. The report was saved but will not be posted automatically.',
        ].join('\n'),
        color: 0xffc107,
        footer: { text: 'PHMC Bot — Auto Deploy / Consent' },
        timestamp: new Date().toISOString(),
    });
}
