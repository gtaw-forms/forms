const fs = require('fs');
const path = require('path');

// Read the file as text since it's an ESM export and we want to avoid complex node loaders for a simple export
const filePath = path.join(__dirname, '../functions/src/utils/gtaLocations.js');
const content = fs.readFileSync(filePath, 'utf8');

// Simple regex to extract the object. 
// Note: This assumes the structure remains as provided.
const match = content.match(/export const gtaLocations = (\{[\s\S]*\});/);

if (match && match[1]) {
    try {
        // Clean up potential trailing commas or ESM syntax if any, 
        // but for this specific file, it's valid JS object syntax.
        // We use eval here safely on our own known local file to get the object.
        const gtaLocations = eval('(' + match[1] + ')');
        
        // Apply the requested rename
        const migratedData = {
            los_santos_city: gtaLocations.los_santos_city,
            los_santos_county: gtaLocations.blaine_county, // Renamed
            major_highways: gtaLocations.major_highways
        };

        const outputPath = path.join(__dirname, '../gtaLocations_export.json');
        fs.writeFileSync(outputPath, JSON.stringify(migratedData, null, 2));
        
        console.log(`Successfully exported and migrated data to: ${outputPath}`);
    } catch (error) {
        console.error("Error parsing the location data:", error);
    }
} else {
    console.error("Could not find gtaLocations object in the file.");
}
