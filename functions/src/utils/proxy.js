import { onCall } from "firebase-functions/v2/https";
import fetch from "node-fetch";
import * as logger from "firebase-functions/logger";

export const fetchExternalUrl = onCall(async (request) => {
    // Ensure the user is authenticated (optional, but good practice for "admin" tools)
    // For now, we'll leave it open or check context.auth if needed.
    // Given it's a "tester" tool for the user, maybe restrict to admin?
    // request.auth check can be added later if needed.

    const url = request.data.url;
    const cookie = request.data.cookie || '';
    const userAgent = request.data.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    
    if (!url) {
        throw new Error("URL is required");
    }

    logger.info(`Fetching external URL: ${url}`, { structuredData: true });

    try {
        const headers = {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'max-age=0',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1'
        };

        if (cookie) {
            headers['Cookie'] = cookie;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        return {
            status: response.status,
            contentType: response.headers.get('content-type'),
            data: text
        };

    } catch (error) {
        logger.error("Error fetching external URL", error);
        throw new Error(`Fetch failed: ${error.message}`);
    }
});
