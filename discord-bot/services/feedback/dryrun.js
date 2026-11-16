// feedback/dryrun.js — simulated event streams without calling the model.
// FEEDBACK_DRY_RUN=true routes the controller here. Used for UI testing and
// for the sample outputs in samples.js.
export const DRY_RUN_SCRIPT = [
  { at: 100, event: { kind: 'text', text: 'Restating request: double-submit on the intake form.' } },
  { at: 300, event: { kind: 'file', path: 'agent/CLAUDE.md' } },
  { at: 500, event: { kind: 'tool-start', tool: 'grep "submit" (6 matches)' } },
  { at: 700, event: { kind: 'tool-done', tool: 'grep "submit"' } },
  { at: 900, event: { kind: 'file', path: 'src/forms/IntakeForm.js' } },
  { at: 1100, event: { kind: 'file', path: 'src/forms/submit.js' } },
  { at: 1300, event: { kind: 'done' } },
];

export const DRY_RUN_EXEC_SCRIPT = [
  { at: 100, event: { kind: 'tool-start', tool: 'edit src/forms/submit.js' } },
  { at: 600, event: { kind: 'tool-done', tool: 'edit src/forms/submit.js' } },
  { at: 700, event: { kind: 'tool-start', tool: 'edit src/forms/IntakeForm.js' } },
  { at: 1200, event: { kind: 'tool-done', tool: 'edit src/forms/IntakeForm.js' } },
  { at: 1400, event: { kind: 'tool-start', tool: 'edit tests/submit.test.js' } },
  { at: 1800, event: { kind: 'tool-done', tool: 'edit tests/submit.test.js' } },
  { at: 2000, event: { kind: 'done' } },
];

export async function playScript(script, onEvent, signal) {
  for (const step of script) {
    if (signal?.aborted) return false;
    await new Promise((r) => setTimeout(r, step.at - (playScript._last || 0)));
    playScript._last = step.at;
    if (signal?.aborted) return false;
    await onEvent(step.event, { dryRun: true, ...step.event });
  }
  playScript._last = 0;
  return true;
}
