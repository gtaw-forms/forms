import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const key = JSON.parse(readFileSync('C:/Users/cross/Documents/GitHub/phmc-forms/firebase-admin-key.json', 'utf-8'));
const app = initializeApp({
  credential: cert(key),
  databaseURL: 'https://gtaw-forms-default-rtdb.europe-west1.firebasedatabase.app',
});
const db = getDatabase(app);

function sizeOf(val) {
  return Buffer.byteLength(JSON.stringify(val), 'utf-8');
}

async function measure(name) {
  const snap = await db.ref(name).once('value');
  const val = snap.val();
  const bytes = val === null ? 0 : sizeOf(val);
  console.log(`${name.padEnd(38)} ${bytes.toLocaleString().padStart(10)} B  (${(bytes / 1024 / 1024).toFixed(2)} MB)  children=${snap.numChildren()}`);
}

const paths = [
  'autopsy-requested',
  'scheduledReports',
  'scheduledReportsBBCode',
  'retry-queue',
  'coroner-email-queue',
  'deathRecordDrafts',
  'facePostDrafts',
  'appMetadata',
  'monitoring',
  'reportEdits',
  'factions/364/members',
  'factions/364/ucp_auth_state',
  'autopsy-requests',
  'morgue-records',
  'newSavedReports',
  'newSavedReportBBCode',
  'presence',
  'analytics/visitors',
  'user-consent',
  'webhook_logs',
  'lscc',
  'morgueMatchLogs',
];
for (const p of paths) {
  try { await measure(p); } catch (e) { console.log(`${p}: ERR ${e.message}`); }
}
process.exit(0);