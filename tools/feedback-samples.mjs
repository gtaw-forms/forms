#!/usr/bin/env node
// tools/feedback-samples.mjs — dump sample {embed, components} JSON per state
// for comparison against the reference images.
//   node tools/feedback-samples.mjs [--write]   (writes discord-bot/services/feedback/samples-output.json)
import { writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { sampleViews, historySample } from '../discord-bot/services/feedback/samples.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WRITE = process.argv.includes('--write');

const out = sampleViews().map((s) => ({ name: s.name, state: s.state, data: s.data, view: s.view }));
{
  const h = historySample();
  out.push({ name: h.name, state: 'HISTORY', view: h.view });
}
if (WRITE) {
  const p = resolve(__dirname, '..', 'discord-bot', 'services', 'feedback', 'samples-output.json');
  writeFileSync(p, JSON.stringify(out, null, 2), 'utf-8');
  console.log(`[samples] wrote ${p} (${out.length} states)`);
} else {
  console.log(JSON.stringify(out, null, 2).slice(0, 6000));
  console.log(`… (${out.length} states; re-run with --write for the full file)`);
}
