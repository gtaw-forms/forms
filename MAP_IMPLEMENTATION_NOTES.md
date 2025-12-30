# GTA 5 Map Implementation Guide (Leaflet)

## 1. Map Tiles (The Visuals)

Leaflet needs "tiles" to display the map. These are small square images (usually 256x256) at different zoom levels. You cannot just use one giant image.

### Option A: Hosting Your Own Tiles (Recommended for stability)
You need to generate or find a set of GTA 5 map tiles (Satellite or Atlas style).
1.  **Source:** Search for "GTA 5 Leaflet Tiles" or "GTA V Map Tiles". There are several GitHub repositories or dumps available online.
2.  **Structure:** You will usually get a folder structure like `tiles/{z}/{x}/{y}.png` (Zoom / X / Y).
3.  **Hosting:** Put these in your `public/` folder (e.g., `public/assets/map-tiles/`).

### Option B: Using an Existing Service (Easier, but relies on 3rd party)
Some community projects host these tiles. You can point your Leaflet layer to their URL, but if they go offline, your map breaks.

---

## 2. Coordinate Mapping (The Math)

GTA 5 uses a Cartesian coordinate system (X, Y, Z). Leaflet uses Latitude/Longitude.
Because the GTA map is flat (gameplay-wise for the map), we use `L.CRS.Simple`. This creates a flat grid mapping.

### The Transformation
You need to map the game's bounding box to the map's pixel coordinates.

**Standard GTA 5 Map Bounds (approximate):**
*   **Game X:** -4000 to 4500
*   **Game Y:** -4000 to 8000

**Formula:**
You will need a linear transformation function:
```javascript
// Example helper to convert Game (x, y) to Leaflet (lat, lng)
const gameToMap = (x, y) => {
  // These numbers need tuning based on the specific tileset you use!
  // Usually involves an offset and a scaling factor.
  const mapX = (x + offsetX) * scaleFactor;
  const mapY = (y + offsetY) * scaleFactor;
  return [mapY, mapX]; // Note: Leaflet uses [Lat, Lng] which is [Y, X]
};
```

*Tip: When you implement this, you will create a "Debug Mode" where you click a known point on the map (e.g., Legion Square), print the Leaflet coordinates, and compare them to the known in-game `/pos` coordinates to calibrate your offset and scale.*

---

## 3. "Mapping" Streets

User Question: *"How do we map streets?"*

There are two ways to handle streets:

### A. Visual Only (Baked in)
Use "Atlas" style map tiles. These look like Google Maps (grey roads, names written on them).
*   **Pros:** Easiest. No code required.
*   **Cons:** You can't "click" a street to get its name easily unless you build a search index.

### B. Vector Data (Interactive)
You overlay invisible lines (PolyLines) or shapes (Polygons) on top of the roads.
*   **Data Source:** You need a `streets.json` file containing the coordinates of every street in Los Santos. (These datasets exist in the FiveM/GTA modding community).
*   **Implementation:**
    1.  Load `streets.json`.
    2.  Add a `L.geoJSON` layer to Leaflet.
    3.  Bind popups: `layer.bindPopup(feature.properties.streetName)`.

### Recommendation for PHMC Forms
Start with **Option A (Visual)**. Use tiles that already have street names visible. It is much lighter on the browser than rendering thousands of vector lines for streets.

If you need to *find* a street (e.g., "Dispatch to Grove St"), you don't need the vectors displayed. You just need a lookup table:
`Grove St = { x: 100, y: -200 }`
When the user selects "Grove St", the map simply flies to those coordinates.
