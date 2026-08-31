/**
 * banstate-remove.mjs — remove one IP entry from data/ban-state.json and show
 * whether it was found. Usage: node debug-testing-scripts/banstate-remove.mjs <ip>
 */
import fs from 'fs';

const ip = process.argv[2];
if (!ip) { console.error('usage: banstate-remove.mjs <ip>'); process.exit(1); }
const path = 'data/ban-state.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

let removed = false;
const walk = (obj) => {
    for (const k of Object.keys(obj)) {
        if (k === ip) { delete obj[k]; removed = true; }
        else if (obj[k] && typeof obj[k] === 'object' && !(obj[k] instanceof Array)) walk(obj[k]);
    }
};
walk(data);

if (removed) {
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
    console.log(`[OK] removed ${ip} from ${path}`);
} else {
    console.log(`[--] ${ip} not present in ${path} (top-level keys: ${Object.keys(data).slice(0, 6).join(', ')})`);
}
