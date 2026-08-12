import { readFileSync } from 'fs';
import pkg from 'firebase-admin';
const { initializeApp, cert } = pkg;
const { getDatabase } = await import('firebase-admin/database');

const sa = JSON.parse(readFileSync('/opt/phmc-bot/firebase-admin-key.json', 'utf-8'));
initializeApp({ credential: cert(sa), databaseURL: 'https://gtaw-forms-default-rtdb.europe-west1.firebasedatabase.app/' });
const db = getDatabase();

const snap = await db.ref('testingSavedReports').once('value');
snap.forEach((a) => a.forEach((r) => {
  const d = r.val();
  const pid = d.data?.patientID || '(empty)';
  const dn = d.data?.decedentName || '(empty)';
  const form = d.formId || '(unknown)';
  console.log((r.key.slice(0,45)+'...'), '| form:', form, '| patientID:', pid, '| decedentName:', dn, '| deployed:', d.hasdeployed);
}));
console.log('---done---');
process.exit();
