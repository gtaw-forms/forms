// src/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth"; // This should now work

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD8HnchqbNsvcAs1PRvi6xCFXlMZUof9Ok",
  authDomain: "gtaw-forms.firebaseapp.com",
  databaseURL: "https://gtaw-forms-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "gtaw-forms",
  storageBucket: "gtaw-forms.firebasestorage.app",
  messagingSenderId: "187858091220",
  appId: "1:187858091220:web:a26e8fdd0f30e8c78e4f41"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

export { database, auth };
