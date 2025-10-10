const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set } = require('firebase/database');
require('dotenv').config();

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

async function migrateLockdownConfig() {
  try {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const database = getDatabase(app);

    // Get current lockdown configuration
    const oldLockdownRef = ref(database, 'adminSettings/lockdown');
    const snapshot = await get(oldLockdownRef);
    const oldConfig = snapshot.val() || {};

    // Create new configuration structure
    const newConfig = {
      enabled: oldConfig.enabled || false,
      notification: oldConfig.notification || '',
      dialog: oldConfig.dialog || '',
      affectedDeployments: ['all'] // Default to affecting all deployments
    };

    // Save new configuration
    const newLockdownRef = ref(database, 'adminSettings/lockdownConfig');
    await set(newLockdownRef, newConfig);

    console.log('Migration completed successfully');
    console.log('New configuration:', newConfig);

    // Don't delete the old configuration yet for safety
    console.log('\nNOTE: The old configuration at adminSettings/lockdown has been preserved.');
    console.log('Once you verify everything is working, you can manually remove it.');

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateLockdownConfig();