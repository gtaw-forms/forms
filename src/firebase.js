// src/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase, ref, remove } from "firebase/database"; // Import ref and remove
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getFunctions } from "firebase/functions";
import { resolveStagingPath } from "./utils/stagingPath";

// Your web app's Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);
const analytics = getAnalytics(app);
// Configure functions with the correct region (must match server-side)
const functions = getFunctions(app, 'europe-west2');

// Function to delete a form
const deleteForm = async (formId) => {
  try {
    const formsPath = resolveStagingPath('forms');
    await remove(ref(database, `${formsPath}/${formId}`));
    console.log(`Form with ID ${formId} deleted successfully from ${formsPath}.`);
  } catch (error) {
    console.error(`Error deleting form with ID ${formId}:`, error);
    throw error;
  }
};

export { database, auth, app, analytics, functions, deleteForm };
