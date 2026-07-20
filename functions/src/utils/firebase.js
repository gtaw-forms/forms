import { initializeApp, getApps } from "firebase-admin/app";
import { getDatabase, ServerValue } from "firebase-admin/database";
import admin from "firebase-admin";

// Initialize Firebase Admin SDK (v14+ uses getApps(), not admin.apps)
if (getApps().length === 0) {
    initializeApp();
}

export const db = getDatabase();
export const timestamp = ServerValue.TIMESTAMP;
export { admin };
