import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin FIRST, before importing anything else
if (admin.apps.length === 0) {
  try {
    // Load service account key from parent directory
    const serviceAccountPath = join(__dirname, '..', 'firebase-admin-key.json');
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: 'https://gtaw-forms-default-rtdb.firebaseio.com' // Firebase Realtime Database URL
    });

    console.log('✅ Firebase Admin initialized successfully with service account');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    process.exit(1);
  }
}

// Now import the function after Firebase is initialized
import { dailyMaintenanceTask } from './index.js';

async function triggerMaintenance() {
  console.log('🔧 Manually triggering dailyMaintenanceTask...');

  try {
    // Create a mock event object like the scheduler would
    const mockEvent = {
      id: `manual-trigger-${Date.now()}`,
      time: new Date().toISOString(),
      timestamp: admin.database.ServerValue.TIMESTAMP
    };

    console.log('📅 Mock event created:', mockEvent);

    // Call the function directly
    const result = await dailyMaintenanceTask(mockEvent);

    console.log('✅ Maintenance task completed successfully!');
    console.log('📊 Result:', result);

  } catch (error) {
    console.error('❌ Error running maintenance task:');
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Run the trigger
triggerMaintenance();