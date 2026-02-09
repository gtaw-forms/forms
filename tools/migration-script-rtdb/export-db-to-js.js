// migration-script-rtdb/export-db-to-js.js
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Path to your service account key
const serviceAccount = require('../firebase-admin-key.json'); // Adjust if needed
const DATABASE_URL = "https://gtaw-forms-default-rtdb.europe-west1.firebasedatabase.app"; // Your DB URL

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: DATABASE_URL
});

const db = admin.database();

async function exportSelectOptions() {
  console.log('Fetching selectOptions from Firebase...');
  const selectOptionsRef = db.ref('selectOptions');
  const outputPath = path.join(__dirname, '../src/data-from-firebase.jsx'); // Output to src directory

  try {
    const snapshot = await selectOptionsRef.once('value');
    const data = snapshot.val();

    if (data) {
      let jsContent = '// Fetched from Firebase at ' + new Date().toISOString() + '\n\n';
      for (const key in data) {
        if (Object.hasOwnProperty.call(data, key)) {
          jsContent += `export const ${key} = ${JSON.stringify(data[key], null, 4)};\n\n`;
        }
      }

      fs.writeFileSync(outputPath, jsContent);
      console.log(`selectOptions successfully exported to ${outputPath}`);
    } else {
      console.log('No data found at selectOptions node.');
    }
  } catch (error) {
    console.error('Failed to export selectOptions:', error);
  } finally {
    admin.app().delete(); // Close the Firebase connection
  }
}

exportSelectOptions();
