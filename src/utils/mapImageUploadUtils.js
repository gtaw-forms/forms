import domtoimage from 'dom-to-image';

/**
 * Manually draws the leaflet map onto a canvas as a fallback.
 * This bypasses dom-to-image's complex DOM cloning which often fails with leaflet.
 */
const captureMapCanvasManual = async (mapNode) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = mapNode.offsetWidth;
    canvas.height = mapNode.offsetHeight;

    // 1. Draw Background (Tiles)
    const tiles = Array.from(mapNode.querySelectorAll('.leaflet-tile-container img'));
    for (const img of tiles) {
        if (!img.complete || img.naturalWidth === 0) continue;
        const rect = img.getBoundingClientRect();
        const parentRect = mapNode.getBoundingClientRect();
        ctx.drawImage(img, rect.left - parentRect.left, rect.top - parentRect.top, rect.width, rect.height);
    }

    // 2. Draw Paths (SVG) - This is hard to do manually, so we might skip or use a simple line drawer if needed
    // For now, we prioritize tiles and markers

    // 3. Draw Markers
    const markers = Array.from(mapNode.querySelectorAll('.leaflet-marker-icon'));
    for (const img of markers) {
        if (img.tagName.toLowerCase() === 'img') {
            if (!img.complete || img.naturalWidth === 0) continue;
            const rect = img.getBoundingClientRect();
            const parentRect = mapNode.getBoundingClientRect();
            ctx.drawImage(img, rect.left - parentRect.left, rect.top - parentRect.top, rect.width, rect.height);
        } else if (img.classList.contains('leaflet-div-icon')) {
            // Basic support for div icons (circles/dots)
            const rect = img.getBoundingClientRect();
            const parentRect = mapNode.getBoundingClientRect();
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.arc(rect.left - parentRect.left + rect.width/2, rect.top - parentRect.top + rect.height/2, rect.width/2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.stroke();
        }
    }

    return canvas.toDataURL('image/jpeg', 0.9);
};

export const captureMapScreenshot = async (mapNode) => {
    if (!mapNode) return { dataUrl: null, error: "Map node not found." };
    
    try {
        // 1. Wait for images
        const images = Array.from(mapNode.getElementsByTagName('img'));
        await Promise.all(images.map(img => {
            if (img.complete && img.naturalWidth !== 0) return Promise.resolve();
            return new Promise(resolve => {
                img.onload = img.onerror = () => resolve();
                setTimeout(resolve, 1500);
            });
        }));

        await new Promise(resolve => setTimeout(resolve, 300));

        // 2. Primary Capture (dom-to-image)
        try {
            const dataUrl = await domtoimage.toJpeg(mapNode, {
                quality: 0.9,
                width: mapNode.offsetWidth,
                height: mapNode.offsetHeight,
                cacheBust: true,
                style: { transform: 'none', webkitTransform: 'none' },
                filter: (node) => {
                    if (node.classList && (
                        node.classList.contains('leaflet-control-container') ||
                        node.classList.contains('info-control')
                    )) return false;
                    return true;
                }
            });
            return { dataUrl, error: null };
        } catch (domErr) {
            console.warn("dom-to-image failed, attempting manual canvas capture:", domErr);
            const manualDataUrl = await captureMapCanvasManual(mapNode);
            return { dataUrl: manualDataUrl, error: `Fallback used: ${domErr.message}` };
        }
    } catch (error) {
        console.error("DEBUG: Screenshot capture failed:", error);
        return { dataUrl: null, error: `Screenshot process failed: ${error.message}` };
    }
};