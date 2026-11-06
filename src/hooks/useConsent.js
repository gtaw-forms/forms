import { useState, useEffect, useCallback } from 'react';
import { database } from '../firebase';
import { ref, get, set, onValue } from 'firebase/database';
import { useAuth } from '../contexts/AuthContext';

// Deploy-tracked forms. Medical Records + Patient Files were retired (new
// platform owns medical/patient now) — only coroner/autopsy/death/mass remain.
export const DEPLOY_TRACKED_FORMS = [
    // Coroners
    'coroner-report',
    'coroner_email',
    'death_record',
    'autopsy',
    'mass-ftality-test',
];

export const FORM_LABELS = {
    // Coroners
    coroner_email:        'Coroner Email (PM)',
    'coroner-report':     'Coroner Report',
    death_record:         'Death Record',
    autopsy:              'Autopsy',
    'mass-ftality-test':  'Mass Fatality',
};

/** Section grouping for the consent modal UI (multi-step wizard) */
export const FORM_SECTIONS = {
    'Coroners': [
        'coroner-report',
        'coroner_email',
        'death_record',
        'mass-ftality-test',
        'autopsy',
    ],
};

/** Section icons (Font Awesome classes) */
export const SECTION_ICONS = {
    'Coroners':            'fa-skull',
    'Clinical Department': 'fa-notes-medical',
    'Mental Health':       'fa-brain',
};

const CONSENT_ROOT = 'user-consent';

// Localhost fallback: without a Firebase uid there is nowhere server-side to
// persist consent, so opt-outs used to evaporate on reload and never reach
// other hook instances. A localStorage mirror fixes both (same shape as RTDB).
const LOCAL_CONSENT_KEY = 'phmc-consent-local';

function readLocalConsent() {
    try {
        const raw = localStorage.getItem(LOCAL_CONSENT_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function writeLocalConsent(patch) {
    try {
        localStorage.setItem(LOCAL_CONSENT_KEY, JSON.stringify({ ...readLocalConsent(), ...patch }));
    } catch {
        /* ignore quota/private-mode errors */
    }
}

function withDefaults(data) {
    const out = { ...(data || {}) };
    for (const formId of DEPLOY_TRACKED_FORMS) {
        if (out[formId] === undefined) out[formId] = true;
    }
    return out;
}

/**
 * Check consent directly from Firebase (no React hook needed).
 * Used by useFormSaver.js to determine deploy path.
 */
export async function checkConsentDirect(uid, formId) {
    if (!uid) return false;
    try {
        const snap = await get(ref(database, `${CONSENT_ROOT}/${uid}/${formId}`));
        return snap.val() !== false;
    } catch {
        return true;
    }
}

/**
A * React hook for reading/writing per-form-type bot deploy consent.
 * Defaults to true (opted in) for all tracked forms.
 */
export function useConsent() {
    const { user } = useAuth();
    const uid = user?.uid;
    const [consent, setConsentState] = useState({});
    const [hasSavedConsent, setHasSavedConsent] = useState(false);
    const [consentLoaded, setConsentLoaded] = useState(false);

    useEffect(() => {
        if (!uid) {
            // No Firebase user (e.g. localhost dev) — defaults over the local
            // mirror so opt-outs survive reloads and remounts.
            const data = withDefaults(readLocalConsent());
            console.log('[useConsent] No uid — using local mirror:', data);
            setConsentState(data);
            setHasSavedConsent(Object.keys(readLocalConsent()).length > 0);
            setConsentLoaded(true);
            return;
        }
        // Live subscription (not a one-time get): consent toggled in another
        // tab, route or hook instance reflects here without a remount.
        const r = ref(database, `${CONSENT_ROOT}/${uid}`);
        const unsubscribe = onValue(r, (snap) => {
            const raw = snap.val();
            const hasRealData = raw !== null && Object.keys(raw).length > 0;
            const data = withDefaults(raw || {});
            console.log('[useConsent] Loaded from Firebase:', { hasRealData, data });
            setConsentState(data);
            setHasSavedConsent(hasRealData);
            setConsentLoaded(true);
        }, () => {
            const defaults = withDefaults({});
            console.log('[useConsent] Firebase read failed — using defaults:', defaults);
            setConsentState(defaults);
            setHasSavedConsent(false);
            setConsentLoaded(true);
        });
        return () => {
            try { unsubscribe(); } catch { /* ignore */ }
        };
    }, [uid]);

    const setConsent = useCallback(async (formId, value) => {
        if (!uid) {
            console.log('[useConsent] No uid (localhost) — writing to local mirror');
            writeLocalConsent({ [formId]: value });
            setConsentState(prev => ({ ...prev, [formId]: value }));
            setHasSavedConsent(true);
            return;
        }
        await set(ref(database, `${CONSENT_ROOT}/${uid}/${formId}`), value);
        setConsentState(prev => ({ ...prev, [formId]: value }));
        setHasSavedConsent(true);
    }, [uid]);

    const saveAllConsent = useCallback(async (all) => {
        if (!uid) {
            // Localhost dev — no Firebase Auth, mirror + local state only
            console.log('[useConsent] No uid (localhost) — saving to local mirror only');
            writeLocalConsent(all);
            setConsentState(prev => ({ ...prev, ...all }));
            setHasSavedConsent(true);
            return;
        }
        // Scope to the user's consent path — NEVER write to the root ref (would wipe the DB)
        const userConsentRef = ref(database, `${CONSENT_ROOT}/${uid}`);
        const sanitized = {};
        for (const [formId, value] of Object.entries(all)) {
            if (formId) sanitized[formId] = value;
        }
        await set(userConsentRef, sanitized);
        setConsentState(prev => ({ ...prev, ...sanitized }));
        setHasSavedConsent(true);
    }, [uid]);

    const getConsent = useCallback((formId) => {
        return consent[formId] !== false;
    }, [consent]);

    return { consent, setConsent, saveAllConsent, getConsent, hasSavedConsent, consentLoaded };
}
