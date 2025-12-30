import domtoimage from 'dom-to-image';

export const captureMapScreenshotAndUpload = async (mapNode) => {
    if (!mapNode) return { screenshotUrl: null, error: "Map node not found." };
    try {
        const blob = await domtoimage.toBlob(mapNode, {
            width: mapNode.offsetWidth,
            height: mapNode.offsetHeight,
            filter: (node) => true // Include all nodes for now
        });

        const imgurClientId = import.meta.env.VITE_IMGUR_CLIENT_ID;
        const imgurAccessToken = import.meta.env.VITE_IMGUR_ACCESS_TOKEN;

        if (!imgurClientId && !imgurAccessToken) {
            console.error("DEBUG: Missing Imgur credentials");
            return { screenshotUrl: null, error: "Missing Imgur credentials" };
        }

        const formData = new FormData();
        formData.append('image', blob);
        formData.append('type', 'file');
        formData.append('title', `Map Screenshot ${Date.now()}`);

        const headers = {};
        if (imgurAccessToken) {
            headers['Authorization'] = `Bearer ${imgurAccessToken}`;
        } else {
            headers['Authorization'] = `Client-ID ${imgurClientId}`;
        }

        const response = await fetch('https://api.imgur.com/3/image', {
            method: 'POST',
            headers: headers,
            body: formData,
        });

        console.log("DEBUG: Imgur API Response Status:", response.status, response.statusText);

        const data = await response.json();
        if (data.success) {
            console.log("DEBUG: Screenshot uploaded to Imgur:", data.data.link);
            return { screenshotUrl: data.data.link, error: null };
        } else {
            console.error("DEBUG: Imgur upload failed:", data.data.error);
            return { screenshotUrl: null, error: `Imgur upload failed: ${data.data.error.message || data.data.error}` };
        }
    } catch (error) {
        console.error("DEBUG: Screenshot capture failed:", error);
        return { screenshotUrl: null, error: `Screenshot capture failed: ${error.message}` };
    }
};
