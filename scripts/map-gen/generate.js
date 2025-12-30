const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// --- CONFIGURATION ---
// 1. Place your giant map image in this folder and name it 'source.png' (or change the name below)
const INPUT_FILE = path.join(__dirname, 'source.png');

// 2. The output folder where tiles will be generated
const OUTPUT_DIR = path.join(__dirname, 'tiles');
// ---------------------

async function generateTiles() {
    console.log(`\n🗺️  Map Tile Generator for Leaflet`);
    console.log(`-----------------------------------`);

    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`❌ Error: Source file not found: ${INPUT_FILE}`);
        console.log(`👉 Please place your high-res map image in this folder and name it 'source.png'.`);
        return;
    }

    console.log(`Reading image: ${INPUT_FILE}`);
    console.log(`Output directory: ${OUTPUT_DIR}`);
    console.log(`\n🚀 Starting generation... (This might take a while for large images)`);

    try {
        // Clear output directory if it exists to avoid stale tiles
        if (fs.existsSync(OUTPUT_DIR)) {
            console.log(`Cleaning previous output...`);
            fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
        }
        fs.mkdirSync(OUTPUT_DIR);

        await sharp(INPUT_FILE)
            .tile({
                size: 256,          // Standard Leaflet tile size
                layout: 'google',   // Standard x/y/z folder structure (sharp calls it 'google')
                overlap: 0,         // No overlap
                background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background if image has transparency
            })
            .toFile(OUTPUT_DIR);

        console.log(`\n✅ Success! Tiles generated in: ${OUTPUT_DIR}`);
        console.log(`\nNext Steps:`);
        console.log(`1. Move the 'tiles' folder to your main project's 'public/assets/map-tiles/'`);
        console.log(`2. Update your Leaflet configuration to point to that path.`);

    } catch (error) {
        console.error(`\n❌ Error during generation:`);
        console.error(error);
    }
}

generateTiles();
