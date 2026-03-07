import { onCall, HttpsError } from "firebase-functions/v2/https";
import fetch from "node-fetch";
import FormData from "form-data";
import { getConfigValue } from "./config.js";

/**
 * Proxy image uploads to ImgBB or Imgur to bypass regional blocks.
 */
export const uploadImageProxy = onCall({
    secrets: ["PHMC_CONFIG"],
    cors: [
        'https://gtaw-forms.github.io',
        'https://phmc-tools.gta.world',
        'http://localhost:3000'
    ]
}, async (request) => {
    const { image, service, title } = request.data;

    if (!image) {
        throw new HttpsError("invalid-argument", "The function must be called with an 'image' (base64 string).");
    }

    const targetService = service || "imgbb"; // Default to imgbb if not specified

    try {
        if (targetService === "imgbb") {
            const apiKey = getConfigValue("IMGBB_API_KEY");
            if (!apiKey) {
                throw new HttpsError("failed-precondition", "ImgBB API Key is not configured on the server.");
            }

            const formData = new FormData();
            formData.append("image", image);

            const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const text = await response.text();
                console.error(`ImgBB API returned error ${response.status}:`, text);
                return { success: false, error: `ImgBB API error (${response.status})` };
            }

            const data = await response.json();
            if (data.success) {
                return { url: data.data.url, thumb: data.data.thumb?.url || data.data.url, success: true };
            } else {
                console.error("ImgBB proxy upload failed:", data.error);
                return { success: false, error: data.error.message };
            }

        } else if (targetService === "imgur") {
            const clientId = getConfigValue("IMGUR_CLIENT_ID");
            const accessToken = getConfigValue("IMGUR_ACCESS_TOKEN");

            if (!clientId && !accessToken) {
                throw new HttpsError("failed-precondition", "Imgur credentials are not configured on the server.");
            }

            const formData = new FormData();
            formData.append("image", image);
            formData.append("type", "base64");
            if (title) formData.append("title", title);

            const headers = {};
            if (accessToken) {
                headers["Authorization"] = `Bearer ${accessToken}`;
            } else {
                headers["Authorization"] = `Client-ID ${clientId}`;
            }

            const response = await fetch("https://api.imgur.com/3/image", {
                method: "POST",
                headers: headers,
                body: formData,
            });

            if (!response.ok) {
                const text = await response.text();
                console.error(`Imgur API returned error ${response.status}:`, text);
                // Catch cases where Imgur returns XML (e.g. rate limits or blocks)
                if (text.includes("<?xml") || text.includes("<html")) {
                    return { success: false, error: `Imgur service error (${response.status}). Possibly rate limited or blocked.` };
                }
                try {
                    const errData = JSON.parse(text);
                    return { success: false, error: errData.data?.error?.message || errData.data?.error || `Imgur error ${response.status}` };
                } catch (e) {
                    return { success: false, error: `Imgur API error (${response.status})` };
                }
            }

            const data = await response.json();
            if (data.success) {
                return { url: data.data.link, success: true };
            } else {
                console.error("Imgur proxy upload failed:", data.data.error);
                return { success: false, error: data.data.error.message || data.data.error };
            }
        } else {
            throw new HttpsError("invalid-argument", `Unsupported service: ${targetService}`);
        }
    } catch (error) {
        console.error("Proxy upload exception:", error);
        throw new HttpsError("internal", error.message || "An internal error occurred during the image upload proxy.");
    }
});
