#!/usr/bin/env node
// tools/feedback-dryrun.mjs — simulate review + execute event streams without
// calling the model. Prints the rendered views per step (what the embed would
// show as events stream in). UI testing only: no files change, nothing pushes.
import { buildFeedbackView } from '../discord-bot/services/feedback/render.js';
import { STATES } from '../discord-bot/services/feedback/constants.js';
import { DRY_RUN_SCRIPT, DRY_RUN_EXEC_SCRIPT } from '../discord-bot/services/feedback/dryrun.js';

const data = {
  shortId: 'dry1', sessionId: 'dry1',
  awaitingRequest: true,
  requestSummary: 'Waiting for your first message…',
  investigated: [], progress: [], planItems: [], questions: [],
};

function show(state) {
  const v = buildFeedbackView(state, data);
  console.log(`\n=== ${state} ===`);
  console.log(`title: ${v.embed.title}`);
  console.log(`desc: ${v.embed.description}`);
  for (const f of v.embed.fields) console.log(`[${f.name}] ${String(f.value).slice(0, 200).replace(/\n/g, ' | ')}`);
  console.log(`buttons: ${v.components.map((c) => c.label).join(' | ')}`);
}

show(STATES.REVIEWING);
data.awaitingRequest = false;
data.requestSummary = 'Double-submit on the intake form (dry run)';
show(STATES.REVIEWING);
for (const step of DRY_RUN_SCRIPT) {
  const ev = step.event;
  if (ev.kind === 'file') data.investigated.push(`Read ${ev.path}`);
  else if (ev.kind === 'tool-start' || ev.kind === 'tool-done') data.investigated.push(`${ev.kind === 'tool-done' ? 'Ran' : 'Running'} ${ev.tool}`);
  await new Promise((r) => setTimeout(r, 50));
}
data.planItems = ['Disable the button + spinner.', 'Ignore repeat clicks.', 'Re-enable on error.'];
data.questions = ['Button spinner or overlay?', 'Add a regression test?'];
show(STATES.AWAITING_ANSWERS);

data.progress = [];
for (const step of DRY_RUN_EXEC_SCRIPT) {
  const ev = step.event;
  data.progress.push(`${ev.kind === 'tool-done' ? 'Finished' : 'Started'} ${ev.tool}`);
  await new Promise((r) => setTimeout(r, 50));
}
show(STATES.WORKING);

data.checks = ['Tests passed (42/42) — dry run', 'Tagged pre-feedback-dryrun', 'Pushed to main · deploy succeeded (simulated)'];
data.filesChanged = [{ path: 'src/forms/submit.js', size: '1.9 KB', added: 11, removed: 2 }];
data.summary = 'Dry run complete — no files changed, nothing pushed.';
show(STATES.DONE);
show(STATES.PAUSED);
data.error = 'Simulated failure';
show(STATES.FAILED);
console.log('\n[dryrun] done — no model called, no files changed.');
