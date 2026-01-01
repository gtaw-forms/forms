import domtoimage from 'dom-to-image';

export const captureMapScreenshot = async (mapNode) => {
    if (!mapNode) return { dataUrl: null, error: "Map node not found." };
    try {
        // Convert map node to base64
        const dataUrl = await domtoimage.toPng(mapNode, {
            width: mapNode.offsetWidth,
            height: mapNode.offsetHeight,
            filter: (node) => true
        });

        return { dataUrl, error: null };
    } catch (error) {
        console.error("DEBUG: Screenshot capture failed:", error);
        return { dataUrl: null, error: `Screenshot process failed: ${error.message}` };
    }
};