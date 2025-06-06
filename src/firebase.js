// src/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database"; // For Realtime Database

// Your web app's Firebase configuration (from Step 1.3 of the tutorial)
// Make sure this includes your databaseURL
const firebaseConfig = {
  apiKey: "AIzaSyD8HnchqbNsvcAs1PRvi6xCFXlMZUof9Ok",
  authDomain: "gtaw-forms.firebaseapp.com",
  databaseURL: "https://gtaw-forms-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "gtaw-forms",
  storageBucket: "gtaw-forms.firebasestorage.app",
  messagingSenderId: "187858091220",
  appId: "1:187858091220:web:a26e8fdd0f30e8c78e4f41"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database
const database = getDatabase(app);

export { database };
