import { firefox } from 'playwright';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const notifier = require('node-notifier');

// ————————————————————————————————————————————————
//   IMPORTANT: Add "type": "module" to your package.json
//   to avoid the module type warning
// ————————————————————————————————————————————————

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Configuration ---
const UCP_AUTH_STATE_FILE = join(__dirname, 'faction-data-helper', 'ucp-auth-state.json');

const UCP_LOGIN_URL = 'https://ucp.gta.world/login';

const FACTION_DATA_URL = "https://ucp.gta.world/view/faction/364/populate?draw=2&columns[0][data]=actions&columns[0][name]=actions&columns[0][searchable]=true&columns[0][orderable]=true&columns[0][search][value]=&columns[0][search][regex]=false&columns[1][data]=id&columns[1][name]=characters.id&columns[1][searchable]=true&columns[1][orderable]=true&columns[1][search][value]=&columns[1][search][regex]=false&columns[2][data]=name&columns[2][name]=name&columns[2][searchable]=true&columns[2][orderable]=true&columns[2][search][value]=&columns[2][search][regex]=false&columns[3][data]=rank&columns[3][name]=rank&columns[3][searchable]=true&columns[3][orderable]=true&columns[3][search][value]=&columns[3][search][regex]=false&columns[4][data]=scriptrank&columns[4][name]=scriptrank&columns[4][searchable]=true&columns[4][orderable]=true&columns[4][search][value]=&columns[4][search][regex]=false&columns[5][data]=lastduty&columns[5][name]=lastduty&columns[5][searchable]=true&columns[5][orderable]=true&columns[5][search][value]=&columns[5][search][regex]=false&columns[6][data]=lastonline&columns[6][name]=lastonline&columns[6][searchable]=true&columns[6][orderable]=true&columns[6][search][value]=&columns[6][search][regex]=false&columns[7][data]=abas&columns[7][name]=abas&columns[7][searchable]=true&columns[7][orderable]=true&columns[7][search][value]=&columns[7][search][regex]=false&order[0][column]=3&order[0][dir]=desc&start=0&length=1000&search[value]=&search[regex]=false&type=members&filters=&searchTerm=";

const DOWNLOADS_PATH = process.env.USERPROFILE ? join(process.env.USERPROFILE, 'Downloads') : __dirname;
const FACTION_DATA_FILE = join(DOWNLOADS_PATH, 'faction_data.json');

// ======================
//   FIREBASE INTEGRATION
// ======================

// SDK DETAILS REQUIRED HERE ——————————————————————
// 1. Run:   npm install firebase-admin
// 2. Go to Firebase Console → Project Settings → Service accounts
// 3. Generate new private key → download JSON
// 4. Place it somewhere safe (NOT in git repo!)
//    Example safe location:  ./service-account.json  (gitignore it)
// 5. Fill in the values below:
// ——————————————————————————————————————————————————————
const SERVICE_ACCOUNT_PATH = join(__dirname, 'service-account.json'); // ← change if needed

// Usually looks like: https://your-project-id-default-rtdb.firebaseio.com
// or https://your-project-id-default-rtdb.[region].firebasedatabase.app
const DATABASE_URL = 'https://gtaw-forms-default-rtdb.europe-west1.firebasedatabase.app/'; // ← REQUIRED

// The exact path you want to overwrite
// Adjust if the structure is e.g. /factions/364/membersList or /data/faction/364/...
const RTDB_PATH = '/factions/364/members'; // ← confirm this path in your console

// ——————————————————————————————————————————————————————

// Helper function for UCP interactive login
async function performInteractiveLogin(browser, loginUrl, authFile, siteName, logoutSelector) {
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log(`\x1b[33mAuthentication file for ${siteName} not found. Please log in manually.\x1b[0m`);
    await page.goto(loginUrl);

    try {
        await page.locator(logoutSelector).waitFor({ timeout: 300000 });
        console.log(`\x1b[32mLogin to ${siteName} successful!\x1b[0m`);

        await context.storageState({ path: authFile });
        console.log(`Authentication state for ${siteName} saved to: ${authFile}`);

        if (fs.existsSync(authFile)) {
            const stats = fs.statSync(authFile);
            console.log(`\x1b[32mConfirmed: ${authFile} exists with size ${stats.size} bytes.\x1b[0m`);
        }
        return context;
    } catch (error) {
        console.error(`\x1b[31mLogin to ${siteName} failed or timed out.\x1b[0m`);
        await browser.close();
        throw error;
    }
}

// Gets an authenticated context for the UCP
async function getUcpContext(browser) {
    if (fs.existsSync(UCP_AUTH_STATE_FILE)) {
        console.log('UCP auth state found, creating context from file.');
        return browser.newContext({ storageState: UCP_AUTH_STATE_FILE });
    }
    return performInteractiveLogin(browser, UCP_LOGIN_URL, UCP_AUTH_STATE_FILE, 'UCP', 'a:has-text("Logout")');
}

// ——————————————————————————————————————————————————————
//   Main logic
// ——————————————————————————————————————————————————————
(async () => {
    // ======== PART 1: DOWNLOAD DATA FROM UCP ========
    console.log('\n--- PART 1: Downloading Faction Data from UCP ---');
    const browser = await firefox.launch({
        headless: fs.existsSync(UCP_AUTH_STATE_FILE), // headful when login needed
        slowMo: 40, // helps when debugging login
    });

    let ucpContext;
    try {
        ucpContext = await getUcpContext(browser);
        const page = await ucpContext.newPage();
        console.log('Fetching faction data...');
        await page.goto(FACTION_DATA_URL);
        const jsonContent = await page.locator('pre').innerText();
        fs.writeFileSync(FACTION_DATA_FILE, jsonContent, 'utf-8');
        console.log(`\x1b[32mSuccessfully downloaded faction data to: ${FACTION_DATA_FILE}\x1b[0m`);
    } catch (error) {
        console.error('\x1b[31mFailed to fetch faction data from UCP.\x1b[0m');
        console.error('Your saved UCP authentication might be expired. Delete:', UCP_AUTH_STATE_FILE);
        console.error(error);
        notifier.notify({
            title: 'PHMC Faction Sync FAILED',
            message: 'Could not fetch data from UCP. Authentication may have expired.'
        });
        await browser.close();
        return;
    }

    // ======== PART 2: WRITE DIRECTLY TO FIREBASE REALTIME DB ========
    console.log('\n--- PART 2: Uploading data to Firebase Realtime Database ---');

    let admin;
    try {
        admin = (await import('firebase-admin')).default;
    } catch (e) {
        console.error('\x1b[31mfirebase-admin is not installed.\x1b[0m');
        console.error('Run: npm install firebase-admin');
        notifier.notify({
            title: 'PHMC Faction Sync FAILED',
            message: 'Module firebase-admin is not installed. Please run "npm install".'
        });
        await browser.close();
        return;
    }

    let serviceAccount;
    try {
        serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
    } catch (e) {
        console.error(`\x1b[31mCannot read service account file: ${SERVICE_ACCOUNT_PATH}\x1b[0m`);
        console.error('Make sure the path is correct and the file exists.');
        notifier.notify({
            title: 'PHMC Faction Sync FAILED',
            message: 'Cannot read Firebase service account file. Check path and permissions.'
        });
        await browser.close();
        return;
    }

    try {
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: DATABASE_URL,
            });
        }

        const db = admin.database();
        const ref = db.ref(RTDB_PATH);

        // --- MERGE LOGIC START ---
        console.log('Fetching existing database records to preserve Discord info...');
        const existingSnapshot = await ref.once('value');
        const existingData = existingSnapshot.val() || {};
        // --- MERGE LOGIC END ---

        console.log('Reading downloaded faction JSON...');
        const rawData = fs.readFileSync(FACTION_DATA_FILE, 'utf-8');
        let data;

        try {
            data = JSON.parse(rawData);
        } catch (e) {
            console.error('\x1b[31mDownloaded file is not valid JSON!\x1b[0m');
            console.error(e);
            notifier.notify({
                title: 'PHMC Faction Sync FAILED',
                message: 'Downloaded faction data is not valid JSON. UCP might be down.'
            });
            await browser.close();
            return;
        }

        // Most common UCP DataTables response structure
        const membersData = data?.data ?? [];
        let membersObject = {}; // Declare here for wider scope

        if (!Array.isArray(membersData) || membersData.length === 0) {
            console.warn('\x1b[33mNo members found in data → uploading empty object.\x1b[0m');
            await ref.set({});
            membersObject = {}; // Ensure it's defined even if no members
        } else {
            console.log('Transforming and validating member data...');
            membersObject = membersData.reduce((acc, member, index) => {
                const characterIdMatch = member.id ? String(member.id).match(/character\/(\d+)/) : null;
                const characterId = characterIdMatch && characterIdMatch[1] ? parseInt(characterIdMatch[1], 10) : null;

                let characterName = (member.firstname && member.lastname) ? `${member.firstname.trim()} ${member.lastname.trim()}` : null;
                // Fallback: If firstname/lastname are not available, try to extract from the 'name' HTML string.
                if (!characterName && member.name) {
                    const nameMatch = String(member.name).match(/>([^<]+)</);
                    if (nameMatch && nameMatch[1]) {
                        characterName = nameMatch[1].trim();
                    }
                }

                const rank = member.rank ? String(member.rank).trim() : null;
                const scriptRank = (member.scriptrank !== undefined && member.scriptrank !== null) ? parseInt(member.scriptrank, 10) : null;

                const missingFields = [];
                if (!characterId) missingFields.push('characterId');
                if (!characterName) missingFields.push('characterName');
                if (!rank) missingFields.push('rank');
                if (scriptRank === null) missingFields.push('scriptRank');

                if (missingFields.length > 0) {
                    console.warn(`Skipping invalid member at index ${index}. Reason: Missing or invalid fields - [${missingFields.join(', ')}]. Original data:`, JSON.stringify(member));
                    return acc;
                }

                // Storing without characterId inside the object, as it's the key.
                acc[characterId] = {
                    characterName,
                    rank,
                    scriptRank,
                    lastDuty: member.lastduty || null,
                    lastOnline: member.lastonline || null,
                    activity: member.abas || null,
                    // Preserve existing Discord information
                    discordName: existingData[characterId]?.discordName || null,
                    discord: existingData[characterId]?.discord || null
                };

                return acc;
            }, {});

            console.log(`Uploading ${Object.keys(membersObject).length} valid members to ${RTDB_PATH}`);
            await ref.set(membersObject);

            console.log('Updating metadata and app version...');
            const metadataRef = db.ref('factions/364/metadata');
            await metadataRef.set({
                lastUpdated: new Date().toISOString(),
                uploadedBy: 'Automated Script (update-database.js)',
                fileName: 'faction_data.json', // As downloaded by the script
                statistics: {
                    totalRecords: membersData.length,
                    validRecords: Object.keys(membersObject).length
                }
            });

            const appVersionRef = db.ref('appMetadata/factionsDataVersion');
            await appVersionRef.set(Date.now());

            console.log('Successfully updated metadata and invalidated client cache.');
        }

        console.log(`\x1b[32mSUCCESS: All data written to Firebase.\x1b[0m`);
        notifier.notify({
          title: 'PHMC Faction Sync',
          message: `Update complete! ${Object.keys(membersObject).length} members synced.`,
          appID: 'com.phmc-forms.faction-sync'
        });
    } catch (error) {
        console.error('\x1b[31mFirebase write failed\x1b[0m');
        console.error(error.message || error);
        notifier.notify({
            title: 'PHMC Faction Sync FAILED',
            message: 'Could not write data to Firebase. Check logs for details.',
            appID: 'com.phmc-forms.faction-sync'
        });
        if (error.message?.includes('PERMISSION_DENIED')) {
            console.error('\x1b[33m→ Check your Database Rules — admin SDK should bypass them, but confirm.\x1b[0m');
            console.error('→ Also verify service account has "Firebase Realtime Database Admin" role.\x1b[0m');
        }
    } finally {
        if (admin && admin.apps.length) { // Check if app was initialized
            await admin.app().delete();
            console.log('Firebase connection closed.');
        }
        await browser.close();
        console.log('Browser closed.');
    }
})();
