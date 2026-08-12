import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

class FirebaseService {
    constructor() {
        this.db = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return this.db;

        const databaseURL = process.env.FIREBASE_DATABASE_URL;
        const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH || '../firebase-admin-key.json';

        if (!databaseURL) {
            console.error('[FIREBASE] ❌ FIREBASE_DATABASE_URL is not set in .env');
            process.exit(1);
        }

        console.log(`[FIREBASE] 🔧 Initializing with databaseURL: ${databaseURL}`);

        try {
            // Resolve relative to process.cwd() (the discord-bot/ directory when running npm start)
            const resolvedPath = resolve(process.cwd(), keyPath);
            console.log(`[FIREBASE] 📂 Loading service account from: ${resolvedPath}`);

            const serviceAccount = JSON.parse(readFileSync(resolvedPath, 'utf-8'));

            if (getApps().length === 0) {
                initializeApp({
                    credential: cert(serviceAccount),
                    databaseURL,
                });
            }

            this.db = getDatabase();
            this.initialized = true;
            console.log('[FIREBASE] ✅ Firebase Admin initialized successfully');
            return this.db;
        } catch (error) {
            console.error('[FIREBASE] ❌ Failed to initialize Firebase Admin:', error.message);
            process.exit(1);
        }
    }

    /**
     * Fetch all morgue records from RTDB
     * @returns {Promise<Array>} Array of morgue records with firebaseKey
     */
    async getMorgueRecords() {
        this.init();
        console.log('[FIREBASE] 🔍 Fetching morgue records from RTDB...');

        try {
            const snapshot = await this.db.ref('morgue-records').once('value');

            if (!snapshot.exists()) {
                console.log('[FIREBASE] 📭 No morgue records found in database');
                return [];
            }

            const data = snapshot.val();
            const records = Object.keys(data).map(key => ({
                ...data[key],
                firebaseKey: key,
            }));

            console.log(`[FIREBASE] ✅ Fetched ${records.length} morgue records`);
            return records;
        } catch (error) {
            console.error('[FIREBASE] ❌ Error fetching morgue records:', error.message);
            throw error;
        }
    }

    /**
     * Search morgue records by query (matches name, caseId, location)
     * @param {string} query - Search term
     * @returns {Promise<Array>} Filtered records
     */
    async searchMorgueRecords(query) {
        const records = await this.getMorgueRecords();

        if (!query || !query.trim()) {
            console.log('[FIREBASE] 🔍 No search query provided, returning all records');
            return records;
        }

        const q = query.toLowerCase().trim();
        const filtered = records.filter(record =>
            (record.name || '').toLowerCase().includes(q) ||
            String(record.caseId || '').toLowerCase().includes(q) ||
            (record.location || '').toLowerCase().includes(q)
        );

        console.log(`[FIREBASE] 🔍 Search "${query}" matched ${filtered.length} records`);
        return filtered;
    }
}

export default new FirebaseService();
