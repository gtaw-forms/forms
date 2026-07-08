const fs = require('fs');
const fp = 'C:/Users/cross/Documents/GitHub/phmc-forms/src/components/form-handler/FormHandler.jsx';
let c = fs.readFileSync(fp, 'utf-8');
const lines = c.split('\n');
// Fix line 1676 (0-indexed: 1675)
lines[1675] = '\t          updates.decedentName = icName.replace(/\\(\\(" + "(.+?)\\" + "\\)\\)/g, \\'\\').trim() || icName;';
// Check line 1790
if (lines[1789] && lines[1789].includes('unterminated')) {
  console.log('Line 1790 has issue:', lines[1789]);
}
c = lines.join('\n');
fs.writeFileSync(fp, c);
console.log('DONE');
