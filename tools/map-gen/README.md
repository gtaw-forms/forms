# Map Tile Generator

This tool slices a single large image into thousands of small tiles compatible with Leaflet JS.

## Setup

1.  Open your terminal in this folder:
    ```powershell
    cd scripts/map-gen
    ```

2.  Install the dependencies (specifically `sharp` image processor):
    ```powershell
    npm install
    ```

## Usage

1.  **Get your map:** Place your high-resolution map image (PNG or JPG) inside this folder (`scripts/map-gen/`).
2.  **Rename it:** Rename your image file to **`source.png`** (or edit `generate.js` to match your filename).
3.  **Run the script:**
    ```powershell
    npm start
    ```

## Output

The script will create a **`tiles`** folder.
Inside, you will see numbered folders (zoom levels).

## Integration

1.  Move the entire `tiles` folder to your main project: `public/assets/tiles`
2.  In your Leaflet component, use this URL pattern:
    ```javascript
    L.tileLayer('/assets/tiles/{z}/{x}/{y}.png', { ... })
    ```
