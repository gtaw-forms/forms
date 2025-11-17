// migration-script-rtdb/migrate.js
const admin = require('firebase-admin');

// Path to your service account key
const serviceAccount = require('../firebase-admin-key.json'); // Adjust if needed

const DATABASE_URL = "https://gtaw-forms-default-rtdb.europe-west1.firebasedatabase.app";

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: DATABASE_URL
});

const db = admin.database();

// New data for LSCC protocols migration
// Protocols structured with multi-image support: each protocol has 'content' with optional {image1}, {image2}, etc. placeholders,
// and an 'images' array of URLs (or paths) corresponding to the placeholders in order.
// In the frontend, parse content and insert <img> tags with dividers where {imageN} appears.
// Keywords generated from all protocol names for search/tooling.
const protocols = [
  {
    category: 'General Medical',
    protocols: [
      { id: 'proto5', name: 'Allergic Reaction', content: 'Details about Allergic Reaction protocol...', images: [] },
      { id: 'proto7', name: 'Diabetic Emergency', content: 'Details about Diabetic Emergency protocol...', images: [] },
      { id: 'proto8', name: 'Overdose', content: 'Details about Overdose protocol...', images: [] },
    ]
  },
{
  category: 'Cardiac',
  protocols: [
    {
      id: 'proto1',
      name: 'Cardiac Arrest',
      content: 'Details about Cardiac Arrest protocol... {image1} Additional details here... {image2} Final notes...',
      images: ['assets/phmc.png', 'assets/another-image.png'] // Add as many as needed
    }
  ]
},
 {
    category: 'Trauma',
    protocols: [
      { id: 'proto2', name: 'Traumatic Injury', content: 'Details about Traumatic Injury protocol...', images: [] },
    ]
  },
  {
    category: 'Neurological',
    protocols: [
      { id: 'proto3', name: 'Seizure', content: 'Details about Seizure protocol...', images: [] },
      { id: 'proto4', name: 'Stroke', content: 'Details about Stroke protocol...', images: [] },
    ]
  },
  {
    category: 'Respiratory',
    protocols: [
      { id: 'proto6', name: 'Respiratory Distress', content: 'Details about Respiratory Distress protocol...', images: [] },
    ]
  }
];

// Generate keywords from protocol names (lowercased for search)
const keywords = [];
protocols.forEach(category => {
  category.protocols.forEach(proto => {
    keywords.push(proto.name.toLowerCase());
  });
});

const lsccData = {
  protocols,
  keywords
};

async function migrateToRealtimeDB() {
  console.log('Starting Realtime Database migration...');

  // New migration for lscc
  console.log('\nMigrating lscc...');
  const lsccRef = db.ref('lscc');

  try {
    const lsccSnapshot = await lsccRef.once('value');
    const lsccFirebaseData = lsccSnapshot.val() || {};

    console.log('--- Comparing local script data with Firebase data for lscc ---');
    const lsccChanges = {
      newKeys: [],
      changedKeys: [],
    };

    for (const key in lsccData) {
      if (Object.hasOwnProperty.call(lsccData, key)) {
        if (!lsccFirebaseData.hasOwnProperty(key)) {
          lsccChanges.newKeys.push(key);
        } else if (JSON.stringify(lsccData[key]) !== JSON.stringify(lsccFirebaseData[key])) {
          lsccChanges.changedKeys.push(key);
        }
      }
    }

    if (lsccChanges.newKeys.length === 0 && lsccChanges.changedKeys.length === 0) {
      console.log('No new additions or changes detected for lscc.');
    } else {
      if (lsccChanges.newKeys.length > 0) {
        console.log('\nNEW ADDITIONS to be written to Firebase for lscc:');
        lsccChanges.newKeys.forEach(key => {
          console.log(`  - ${key}`);
        });
      }
      if (lsccChanges.changedKeys.length > 0) {
        console.log('\nCHANGES to be written to Firebase for lscc (key content will be updated):');
        lsccChanges.changedKeys.forEach(key => {
          console.log(`  - ${key} (content differs)`);
        });
      }
    }
    console.log('--- End of comparison for lscc ---');

    console.log('\nAttempting to write/overwrite /lscc in Firebase...');
    await lsccRef.set(lsccData);
    console.log('lscc migrated successfully!');
  } catch (error) {
    console.error('lscc migration FAILED:', error);
    migrationSuccessful = false;
  }

  // Cleanup
  admin.app().delete()
    .then(() => {
      console.log("Firebase app resources released.");
      process.exit(migrationSuccessful ? 0 : 1);
    })
    .catch(err => {
      console.error("Error closing Firebase app:", err);
      process.exit(1);
    });
}

migrateToRealtimeDB();