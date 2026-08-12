import { initializeApp, getApps } from "firebase-admin/app";
import { getDatabase, ServerValue } from "firebase-admin/database";
import { getAuth } from "firebase-admin/auth";
import admin from "firebase-admin";

// Initialize Firebase Admin SDK (v14+ uses getApps(), not admin.apps)
if (getApps().length === 0) {
    initializeApp();
}

export const db = getDatabase();
export const auth = getAuth();
export const timestamp = ServerValue.TIMESTAMP;
export { admin };
