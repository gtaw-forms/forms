import admin from "firebase-admin";

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
    admin.initializeApp();
}

export const db = admin.database();
export { admin };
