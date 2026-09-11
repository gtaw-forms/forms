/**
 * imageProxy.js — route bot image uploads through the deployed uploadImageProxy
 * Cloud Function (europe-west4) so traffic egresses from Google Cloud instead
 * of the VPS (direct api.imgbb.com calls from the VPS are forbidden/103).
 *
 * Auth: mint a Firebase custom token with the admin SDK, exchange it for an
 * ID token, then call the v2 callable endpoint ({ data } -> { result }).
 * Fail-open: every step degrades to null — callers must still deliver their
 * primary payload (e.g. /card's native attachment).
 *
 * No new secrets: the web API key below is a public client key (also shipped
 * in the web bundle); server auth comes from the admin SDK key on the VPS.
 */

import firebase from './firebase.js';
import { getAuth } from 'firebase-admin/auth';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'gtaw-forms';
// Public Firebase web client key (NOT a secret — same value the web app ships).
const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyD8HnchqbNsvcAs1PRvi6xCFXlMZUof9Ok';
const FUNCTION_URL = `https://europe-west4-${PROJECT_ID}.cloudfunctions.net/uploadImageProxy`;

/** Mint a Firebase ID token for the bot via custom-token exchange. */
async function mintIdToken() {
    firebase.init();
    const custom = await getAuth().createCustomToken('phmc-bot');
    const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: custom, returnSecureToken: true }),
            signal: AbortSignal.timeout(15000),
        }
    );
    if (!res.ok) throw new Error(`token exchange HTTP ${res.status}`);
    const data = await res.json().catch(() => null);
    if (!data?.idToken) throw new Error('token exchange returned no idToken');
    return data.idToken;
}

/**
 * Upload image bytes via the Cloud Function proxy.
 *
 * @param {Buffer} buffer — image bytes
 * @param {string} [service] — 'imgbb' (default) or 'imgur'
 * @returns {Promise<string|null>} public URL or null
 */
export async function uploadViaProxy(buffer, service = 'imgbb') {
    try {
        const idToken = await mintIdToken();
        const res = await fetch(FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ data: { image: buffer.toString('base64'), service } }),
            signal: AbortSignal.timeout(45000),
        });
        if (!res.ok) {
            console.warn(`[IMG-PROXY] Function HTTP ${res.status} — continuing without URL`);
            return null;
        }
        const data = await res.json().catch(() => null);
        const url = data?.result?.url || null;
        if (!url) {
            console.warn(`[IMG-PROXY] No URL (err: ${data?.result?.error || data?.error?.message || 'unknown'}) — continuing without URL`);
        }
        return url;
    } catch (err) {
        console.warn(`[IMG-PROXY] Upload failed (${err.message}) — continuing without URL`);
        return null;
    }
}
