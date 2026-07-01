import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const keyPath = resolve(process.cwd(), '../firebase-admin-key.json');
const key = JSON.parse(readFileSync(keyPath, 'utf-8'));
admin.initializeApp({
  credential: admin.credential.cert(key),
  databaseURL: 'https://gtaw-forms-default-rtdb.europe-west1.firebasedatabase.app'
});
const db = admin.database();

const snap = await db.ref('scheduledReports').once('value');
if (!snap.exists()) { console.log('No reports.'); process.exit(0); }

let reset = 0;
snap.forEach(authorSnap => {
  const authorId = authorSnap.key;
  authorSnap.forEach(reportSnap => {
    const d = reportSnap.val();
    const k = reportSnap.key;
    if (d.deployStatus === 'retry_queued') {
      console.log('Resetting: ' + authorId + '/' + k.slice(0,60) + ' | ' + (d.originalKey || ''));
      db.ref('scheduledReports/' + authorId + '/' + k).update({
        deployStatus: 'queued',
        deployMessage: 'Manually re-queued after code fix',
        retryAt: null,
        deployRetries: 0,
        deployLastFailedAt: null,
      }).then(() => { reset++; console.log('  OK'); });
    }
  });
});

setTimeout(() => {
  console.log('Reset ' + reset + ' report(s). Bot should pick them up.');
  process.exit(0);
}, 3000);
