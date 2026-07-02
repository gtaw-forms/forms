/**
 * useConsent — per-form-type consent for bot auto-deploy.
 *
 * Reads/writes user consent from Firebase `user-consent/<uid>/<formId>`.
 * Falls back to the legacy localStorage flag when no Firebase record exists.
 * Sends a Discord webhook on consent changes for usability monitoring.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { database } from '../firebase';
import { ref, onValue, set } from 'firebase/database';
import { useAuth } from '../contexts/AuthContext';
import { triggerWebhookProxy } from '../services/firebaseFunctions';
import { getCharacterName } from '../utils/identityUtils';
import { getCurrentUser } from '../services/gtaWorldAuth';

// Mirror of the list in useFormSaver.js — source of truth for which forms are deploy-tracked
export const DEPLOY_TRACKED_FORMS = [
    'coroner-report',
    'coroner_email',
    'death_record',
    'mass-ftality-test',
    'patient_notes',
];

export const FORM_LABELS = {
    coroner_email:      'Coroner Email (PM)',
    'coroner-report':   'Coroner Report',
    death_record:       'Death Record',
    'mass-ftality-test':'Mass Fatality',
    patient_notes:      'Medical Record',
};

/** Section grouping for the consent modal UI */
export const FORM_SECTIONS = {
    Coroners: [
        'coroner-report',
        'coroner_email',
        'death_record',
        'mass-ftality-test',
    ],
    'Medical Files': [
        'patient_notes',
    ],
    'Mental Health': [
        // Reserved for future mental-health deploy-tracked forms
    ],
};

/** Section icons */
export const SECTION_ICONS = {
    'Coroners':       'fa-skull',
    'Medical Files':  'fa-notes-medical',
    'Mental Health':  'fa-brain',
};

const CONSENT_ROOT = 'user-consent';

/**
 * Check the legacy localStorage opt-in (existing users before migration).
 */
function getLegacyPref() {
    try {
        return localStorage.getItem('botDeployOptIn') === 'true';
    } catch {
        return false;
    }
}

/**
 * React hook for reading/writing per-form-type bot deploy consent.
 *
 * @param {boolean} skipFirebaseRead - If true, don't read from Firebase (for cases where
 *   consent is only needed for display, not for routing decisions)
 * @returns {{ consent: object|null, setConsent: function, isLoading: boolean, hasConsentRecord: boolean }}
 */
export function useConsent(skipFirebaseRead = false) {
    const { user: authUser } = useAuth();
    const uid = authUser?.uid || null;
    const [consent, setConsentState] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasConsentRecord, setHasConsentRecord] = useState(false);
    const prevConsentRef = useRef(null);

    useEffect(() => {
        if (!uid || skipFirebaseRead) {
            setConsentState(null);
            setIsLoading(false);
            setHasConsentRecord(false);
            return;
        }

        setIsLoading(true);
        const consentRef = ref(database, `${CONSENT_ROOT}/${uid}`);

        const unsubscribe = onValue(consentRef, (snapshot) => {
            const val = snapshot.val();
            if (val && typeof val === 'object') {
                setConsentState(val);
                setHasConsentRecord(true);
            } else {
                setConsentState(null);
                setHasConsentRecord(false);
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [uid, skipFirebaseRead]);

    /**
     * Check if a specific form type has consent.
     * Returns the Firebase consent value, or falls back to legacy localStorage.
     *
     * @param {string} formId - e.g. 'coroner-report'
     * @returns {boolean}
     */
    const checkConsent = useCallback((formId) => {
        if (consent !== null && formId in consent) {
            return consent[formId] === true;
        }
        // Fall back to legacy localStorage flag for backward compat
        const legacy = getLegacyPref();
        if (legacy) return true; // Legacy opt-in means all forms consented
        return false;
    }, [consent]);

    /**
     * Update consent for a single form type. Writes to Firebase and sends a webhook.
     *
     * @param {string} formId
     * @param {boolean} value
     */
    const setConsent = useCallback(async (formId, value) => {
        if (!uid) return;

        const newConsent = { ...(consent || {}), [formId]: value };
        setConsentState(newConsent);
        setHasConsentRecord(true);

        try {
            await set(ref(database, `${CONSENT_ROOT}/${uid}/${formId}`), value);
        } catch (err) {
            console.error('[useConsent] Failed to save consent:', err);
            // Revert on error
            setConsentState(prevConsentRef.current || consent);
            return;
        }

        prevConsentRef.current = newConsent;

        // Send a Discord webhook for usability monitoring
        try {
            const gtaUser = getCurrentUser();
            const displayName = gtaUser
                ? (getCharacterName(gtaUser) || gtaUser.username || uid)
                : uid;

            const label = FORM_LABELS[formId] || formId;
            const statusEmoji = value ? '✅' : '❌';
            const statusText = value ? 'Granted' : 'Revoked';

            triggerWebhookProxy('forms', {
                embeds: [{
                    title: 'Bot Consent Updated',
                    color: value ? 0x28a745 : 0xdc3545,
                    fields: [
                        { name: 'User', value: displayName, inline: true },
                        { name: 'Form Type', value: label, inline: true },
                        { name: 'Consent', value: `${statusEmoji} ${statusText}`, inline: true },
                    ],
                    timestamp: new Date().toISOString(),
                    footer: { text: `UID: ${uid}` },
                }],
            }).catch(() => {});
        } catch {
            // Webhook is best-effort
        }
    }, [uid, consent]);

    /**
     * Save all form type consents at once (batch from modal).
     * Sends a single webhook summary.
     *
     * @param {object} newConsent - { formId: boolean, ... }
     */
    const saveAllConsent = useCallback(async (newConsent) => {
        if (!uid) return;

        setConsentState(newConsent);
        setHasConsentRecord(true);

        try {
            // Write all at once at the user level
            await set(ref(database, `${CONSENT_ROOT}/${uid}`), newConsent);
        } catch (err) {
            console.error('[useConsent] Failed to save consent batch:', err);
            setConsentState(prevConsentRef.current || consent);
            return;
        }

        prevConsentRef.current = newConsent;

        // Send a summary webhook
        try {
            const gtaUser = getCurrentUser();
            const displayName = gtaUser
                ? (getCharacterName(gtaUser) || gtaUser.username || uid)
                : uid;

            const granted = Object.entries(newConsent)
                .filter(([, v]) => v === true)
                .map(([k]) => FORM_LABELS[k] || k);

            const denied = Object.entries(newConsent)
                .filter(([, v]) => v === false)
                .map(([k]) => FORM_LABELS[k] || k);

            const fields = [];
            if (granted.length > 0) {
                fields.push({ name: '✅ Opted In', value: granted.join('\n'), inline: false });
            }
            if (denied.length > 0) {
                fields.push({ name: '❌ Opted Out', value: denied.join('\n'), inline: false });
            }

            triggerWebhookProxy('forms', {
                embeds: [{
                    title: 'Bot Consent Preferences Saved',
                    color: granted.length > 0 ? 0x28a745 : 0xffc107,
                    fields: [
                        { name: 'User', value: displayName, inline: true },
                        ...fields,
                    ],
                    timestamp: new Date().toISOString(),
                    footer: { text: `UID: ${uid}` },
                }],
            }).catch(() => {});
        } catch {
            // Webhook is best-effort
        }
    }, [uid, consent]);

    return {
        consent,
        setConsent,
        saveAllConsent,
        checkConsent,
        isLoading,
        hasConsentRecord,
    };
}

/**
 * Non-hook utility: check consent for a specific form from Firebase directly.
 * Used outside React components (e.g. useFormSaver routing functions).
 *
 * @param {string} uid - Firebase Auth UID
 * @param {string} formId - Form type key
 * @returns {Promise<boolean>}
 */
export async function checkConsentDirect(uid, formId) {
    if (!uid) {
        // Fall back to localStorage when no UID
        return getLegacyPref();
    }
    try {
        const { get, child, ref: dbRef } = await import('firebase/database');
        const snap = await get(child(dbRef(database), `${CONSENT_ROOT}/${uid}/${formId}`));
        if (snap.exists()) {
            return snap.val() === true;
        }
    } catch (err) {
        console.warn('[useConsent] Direct consent read failed:', err.message);
    }
    // Fallback: legacy localStorage
    return getLegacyPref();
}
