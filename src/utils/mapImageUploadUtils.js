import domtoimage from 'dom-to-image';
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

export const captureMapScreenshotAndUpload = async (mapNode) => {
    if (!mapNode) return { screenshotUrl: null, error: "Map node not found." };
    try {
        // Convert map node to base64
        const dataUrl = await domtoimage.toPng(mapNode, {
            width: mapNode.offsetWidth,
            height: mapNode.offsetHeight,
            filter: (node) => true
        });

        // Split dataUrl to get base64 part
        const base64Image = dataUrl.split(',')[1];

        // Call the Firebase Function proxy
        const uploadProxy = httpsCallable(functions, 'uploadImageProxy');
        const result = await uploadProxy({
            image: base64Image,
            service: 'imgur',
            title: `Map Screenshot ${Date.now()}`
        });

        const data = result.data;
        if (data.success) {
            console.log("DEBUG: Screenshot uploaded via proxy:", data.url);
            return { screenshotUrl: data.url, error: null };
        } else {
            console.error("DEBUG: Proxy upload failed:", data.error);
            return { screenshotUrl: null, error: `Upload failed: ${data.error}` };
        }
    } catch (error) {
        console.error("DEBUG: Screenshot capture/upload failed:", error);
        return { screenshotUrl: null, error: `Screenshot process failed: ${error.message}` };
    }
};
