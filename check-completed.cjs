const a = require('firebase-admin');
const k = JSON.parse(require('fs').readFileSync('/opt/phmc-bot/firebase-admin-key.json'));
a.initializeApp({credential:a.credential.cert(k),databaseURL:'https://gtaw-forms-default-rtdb.europe-west1.firebasedatabase.app/'});
a.database().ref('autopsy-requested/9645/completedAt').once('value').then(s => {
  console.log('completedAt:', s.val());
  process.exit();
}).catch(e => { console.error(e.message); process.exit(1); });
