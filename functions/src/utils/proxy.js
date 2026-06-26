// functions/src/utils/proxy.js
import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

export const fetchExternalUrl = onCall({
    region: "europe-west2",
}, async (request) => {
    const {
        url,
        method = 'GET',
        body = null,
        cookie = '',
        customHeaders = {},
        userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    } = request.data;

    if (!url) {
        throw new Error("URL is required");
    }

    logger.info(`Fetching external URL: [${method}] ${url}`, { structuredData: true });

    try {
        const fetchOptions = {
            method: method,
            headers: {
                'User-Agent': userAgent,
                'Accept': 'application/json, text/html, application/xhtml+xml, application/xml;q=0.9, image/avif, image/webp, image/apng, */*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Connection': 'keep-alive',
                ...customHeaders, // Allow overriding default headers
            },
        };

        if (cookie) {
            fetchOptions.headers['Cookie'] = cookie;
        }

        if (body) {
            // For POST/PUT requests, Discord expects a JSON payload
            if (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT') {
                fetchOptions.body = JSON.stringify(body);
                // Ensure content-type is set for JSON payloads if not already
                if (!fetchOptions.headers['Content-Type']) {
                    fetchOptions.headers['Content-Type'] = 'application/json';
                }
            } else {
                // For other request types, just pass the body as is
                fetchOptions.body = body;
            }
        }
        
        const response = await fetch(url, fetchOptions);

        // For Discord webhooks, they return a 204 No Content on success,
        // so we can't just rely on response.text(). We'll return a success indicator.
        if (response.ok) {
            return {
                status: response.status,
                statusText: response.statusText,
                data: `Request to ${url} was successful.`
            };
        } else {
            // Attempt to get more error context from Discord's response body
            const errorBody = await response.text();
            logger.error(`HTTP Error: ${response.status} ${response.statusText}`, { url, errorBody });
            throw new Error(`HTTP Error: ${response.status} ${response.statusText} - ${errorBody}`);
        }

    } catch (error) {
        logger.error("Error fetching external URL", { errorMessage: error.message, url });
        // Re-throw to be caught by the client
        throw new Error(`Fetch failed: ${error.message}`);
    }
});
