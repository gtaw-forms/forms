import fs from 'fs';
const file = 'C:/Users/cross/Downloads/faction_data.json';
const raw = fs.readFileSync(file, 'utf-8');
console.log('Length:', raw.length);
console.log('Starts with:', raw.slice(0, 150));
try {
  const parsed = JSON.parse(raw);
  console.log('Keys:', Object.keys(parsed));
  console.log('data exists?', !!parsed.data);
  if (parsed.data) console.log('data length:', parsed.data.length);
} catch (e) {
  console.error('Parse failed:', e.message);
}