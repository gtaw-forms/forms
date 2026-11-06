import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getConfigValue } from "./config.js";
import { sniffImageType } from "./imageType.js";

/**
 * Image upload proxy — ImgLink.cc.
 *
 * Every image the app or the Discord bot uploads goes through this callable so
 * the API key stays server-side and traffic egresses from Google Cloud. Images
 * are filed in the `Coroners` album on ImgLink (auto-created on first use).
 *
 * Auth: any signed-in Firebase user (the bot mints a custom token).
 * Contract: { image: <base64>, service?: string } -> { success, url, thumb, ... }
 *
 * `service` is accepted for backward compatibility but ignored: the previous
 * ImgBB/Imgur targets are retired (ImgBB rejected our calls account-side and
 * Imgur blocks cloud egress). A bot or client still deployed with
 * service:'imgbb' therefore keeps working unchanged.
 */

const IMGLINK_UPLOAD_URL = "https://imglink.cc/api/v1/upload";
// Single destination album. Fixed on purpose: all upload paths (medical record
// images, autopsy request screenshots, /card renders) are coroner material.
const IMGLINK_ALBUM = "Coroners";
const IMGLINK_TIMEOUT_MS = 45_000;
// Firebase callables cap the request at 10 MB; this is the server-side guard on
// the base64 string (~9 MB of bytes) before any decoding work happens.
const MAX_BASE64_LEN = 12 * 1024 * 1024;

/** Decode the payload and drop an accidental `data:image/...;base64,` prefix. */
function decodeBase64(image) {
    const raw = image.includes(',') && image.startsWith('data:')
        ? image.slice(image.indexOf(',') + 1)
        : image;
    return Buffer.from(raw, 'base64');
}

/**
 * Map ImgLink's error responses to callable errors with actionable text.
 * Not exported: `functions/index.js` re-exports every export of this module,
 * and Firebase would treat a stray export as a function.
 */
function imglinkError(status, payload) {
    const message = payload?.error || payload?.message || `HTTP ${status}`;
    if (status === 401 || status === 403) {
        return new HttpsError(
            "failed-precondition",
            "The image host rejected the server API key. An administrator needs to check IMGLINK_API_KEY."
        );
    }
    if (status === 413) {
        return new HttpsError(
            "resource-exhausted",
            "The image is too large for the image host, or its storage limit has been reached."
        );
    }
    if (status === 429) {
        return new HttpsError(
            "resource-exhausted",
            "The image host's hourly upload limit has been reached. Please try again in a little while."
        );
    }
    return new HttpsError("internal", `Image host upload failed (${status}): ${message}`);
}

export const uploadImageProxy = onCall({
    region: "europe-west4",
    // NOTE: must be a valid GCF tier (128/256/512MiB, 1GiB…). "300MiB" is NOT
    // valid — a past deploy silently landed on 256MiB and large uploads OOM'd
    // the instance (functions/internal to the client, 2026-09-09).
    // That OOM was a concurrency problem, not a single-upload problem: one
    // in-flight upload peaks at ~40 MB on top of the ~80 MB Node baseline, so
    // the old concurrency 10 could reach ~480 MB. At concurrency 2 the peak is
    // ~160 MB, which fits 256MiB with headroom — and memory × time is what we
    // pay for, so this halves the per-upload cost. Raising concurrency without
    // raising memory reintroduces the 2026-09-09 failure.
    memory: "256MiB",
    concurrency: 2,
    timeoutSeconds: 60,
    secrets: ["PHMC_CONFIG"],
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173'
    ]
}, async (request) => {
    const { image } = request.data || {};

    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required.');
    if (typeof image !== 'string' || image.length === 0) {
        throw new HttpsError("invalid-argument", "The function must be called with an 'image' (base64 string).");
    }
    if (image.length > MAX_BASE64_LEN) {
        throw new HttpsError('invalid-argument', 'Image payload is invalid or too large.');
    }

    const apiKey = getConfigValue("IMGLINK_API_KEY");
    if (!apiKey) {
        console.error('[uploadImageProxy] IMGLINK_API_KEY is not configured in PHMC_CONFIG.');
        throw new HttpsError("failed-precondition", "The image host API key is not configured on the server.");
    }

    let buffer;
    try {
        buffer = decodeBase64(image);
    } catch {
        throw new HttpsError('invalid-argument', 'Image payload is not valid base64.');
    }
    if (!buffer.length) {
        throw new HttpsError('invalid-argument', 'Image payload is empty.');
    }

    const type = sniffImageType(buffer);
    if (!type) {
        throw new HttpsError(
            'invalid-argument',
            'Unsupported image format. Use PNG, JPG, GIF, WebP, BMP, TIFF, AVIF, ICO or SVG.'
        );
    }

    const formData = new FormData();
    formData.append("file", new Blob([buffer], { type: type.mime }), `phmc-${Date.now()}.${type.ext}`);
    formData.append("album", IMGLINK_ALBUM);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IMGLINK_TIMEOUT_MS);

    try {
        const response = await fetch(IMGLINK_UPLOAD_URL, {
            method: "POST",
            headers: { "X-API-Key": apiKey },
            body: formData,
            signal: controller.signal,
        });

        const text = await response.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            // Non-JSON body (upstream error page) — keep the status for the error.
        }

        if (!response.ok) {
            console.error(`[uploadImageProxy] ImgLink returned ${response.status}: ${text.slice(0, 300)}`);
            throw imglinkError(response.status, data);
        }
        if (!data?.success || !data?.url) {
            console.error('[uploadImageProxy] ImgLink returned no URL:', text.slice(0, 300));
            throw new HttpsError("internal", `Image host returned no URL: ${data?.error || 'unknown error'}`);
        }

        console.log(`[uploadImageProxy] imglink ok id=${data.id || '-'} album=${IMGLINK_ALBUM} bytes=${buffer.length} type=${type.ext}`);
        return {
            success: true,
            id: data.id || null,
            url: data.url,
            thumb: data.thumbnail || data.url,
            viewer: data.viewer || null,
        };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        if (error?.name === 'AbortError') {
            console.error('[uploadImageProxy] ImgLink request timed out.');
            throw new HttpsError('deadline-exceeded', 'The image host did not respond in time. Please try again.');
        }
        console.error('[uploadImageProxy] Proxy upload exception:', error?.message || error);
        throw new HttpsError("internal", error?.message || "An internal error occurred during the image upload proxy.");
    } finally {
        clearTimeout(timeout);
    }
});
