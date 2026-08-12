import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const keyPath = resolve('C:/Users/cross/Documents/GitHub/phmc-forms/firebase-admin-key.json');
const databaseURL = 'https://gtaw-forms-default-rtdb.europe-west1.firebasedatabase.app';
const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));

if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccount), databaseURL });
}
const db = getDatabase();

const QUERY = 'fimbres';
const results = [];

async function walk(path, node, depth) {
  if (!node) return;
  if (typeof node === 'object' && !Array.isArray(node)) {
    const keys = Object.keys(node);
    for (const k of keys) {
      const v = node[k];
      if (typeof v === 'string' && v.toLowerCase().includes(QUERY)) {
        results.push({ path: `${path}/${k}`, value: v });
      }
      walk(`${path}/${k}`, v, depth + 1);
    }
  }
}

const roots = ['autopsy-requested', 'autopsy-requests', 'scheduledReports', 'scheduledReportsBBCode', 'newSavedReports', 'morgue-records'];
for (const root of roots) {
  try {
    const snap = await db.ref(root).once('value');
    if (snap.exists()) {
      await walk(`/${root}`, snap.val(), 0);
    }
  } catch (e) {
    console.log(`[ERR] ${root}: ${e.message}`);
  }
}

if (results.length === 0) {
  console.log('No matches found in any scanned root.');
} else {
  console.log(`Found ${results.length} field(s) containing "${QUERY}":`);
  results.forEach(r => console.log(`${r.path} = ${r.value}`));
}
