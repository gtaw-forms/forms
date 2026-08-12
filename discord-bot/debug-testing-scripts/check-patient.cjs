const a = require('firebase-admin');
const s = JSON.parse(require('fs').readFileSync('/opt/phmc-bot/firebase-admin-key.json','utf8'));
a.initializeApp({credential:a.credential.cert(s), databaseURL:'https://gtaw-forms-default-rtdb.europe-west1.firebasedatabase.app/'});
const db = a.database();
db.ref('testingSavedReports').once('value').then(s => {
  s.forEach(a => a.forEach(r => {
    const d = r.val();
    const pid = d.data?.patientID || '(empty)';
    const dn = d.data?.decedentName || '(empty)';
    const form = d.formId || '(unknown)';
    console.log((r.key.slice(0,45)+'...'), '| form:', form, '| patientID:', pid, '| decedentName:', dn, '| deployed:', d.hasdeployed);
  }));
  console.log('---done---');
  process.exit();
}).catch(e => { console.error(e.message); process.exit(1); });
