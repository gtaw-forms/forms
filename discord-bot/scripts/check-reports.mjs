const { readFileSync } = require('fs');
const admin = require('firebase-admin');

const sa = JSON.parse(readFileSync('/opt/phmc-bot/firebase-admin-key.json', 'utf-8'));
admin.initializeApp({ credential: admin.credential.cert(sa), databaseURL: 'https://gtaw-forms-default-rtdb.europe-west1.firebasedatabase.app/' });
const db = admin.database();

db.ref('testingSavedReports').once('value').then((snap) => {
  let total = 0, pending = 0;
  snap.forEach((a) => a.forEach((r) => {
    total++;
    const d = r.val();
    const status = d.hasdeployed === true ? 'DONE' : 'PEND';
    if (d.hasdeployed !== true) pending++;
    console.log(status, '|', (d.originalKey || r.key).slice(0, 40), '|', d.formId, '|', new Date(d.timestamp).toLocaleString());
  }));
  console.log('Total:', total, '| Pending:', pending);
  process.exit(0);
}).catch((e) => { console.error(e.message); process.exit(1); });
