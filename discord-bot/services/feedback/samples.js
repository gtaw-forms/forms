// feedback/samples.js — sample {state, data} outputs for every UI state,
// compared against the reference images. Regenerate with:
//   node tools/feedback-samples.mjs [--write]
import { buildFeedbackView } from './render.js';
import { buildFeedbackHistoryView } from './render.js';
import { STATES } from './constants.js';

const BASE = {
  shortId: 'a1b2c3',
  sessionId: 'a1b2c3',
  requestSummary: 'Submit button double-submit on the intake form',
  oneLineResult: 'double-submit fixed',
  investigated: [
    'Read agent/CLAUDE.md (project scope)',
    'Searched files: "submit" (6 matches)',
    'Read src/forms/IntakeForm.js, src/forms/submit.js',
  ],
  planItems: [
    'Disable the button and show a spinner while the request is pending.',
    'Ignore repeat clicks in submit.js.',
    'Re-enable on error with a message.',
  ],
  questions: [
    'Spinner on the button, or a full-form overlay?',
    'Add a regression test for double-submit?',
  ],
};

export function sampleViews() {
  return [
    {
      name: 'awaiting',
      state: STATES.REVIEWING,
      data: { ...BASE, awaitingRequest: true, requestSummary: 'Waiting for your first message…' },
      view: buildFeedbackView(STATES.REVIEWING, { ...BASE, awaitingRequest: true, requestSummary: 'Waiting for your first message…' }),
    },
    {
      name: 'review',
      state: STATES.REVIEWING,
      data: { ...BASE },
      view: buildFeedbackView(STATES.REVIEWING, { ...BASE }),
    },
    {
      name: 'plan-updated',
      state: STATES.AWAITING_ANSWERS,
      data: { ...BASE, planRevised: true },
      view: buildFeedbackView(STATES.AWAITING_ANSWERS, { ...BASE, planRevised: true }),
    },
    {
      name: 'working',
      state: STATES.WORKING,
      data: {
        ...BASE,
        phaseLabel: 'Applying changes',
        progress: [{ text: 'Edited src/forms/submit.js', done: true }, { text: 'Editing src/forms/IntakeForm.js…', done: false }],
        liveText: 'Applying the spinner change to IntakeForm.js now — button disables on submit, re-enables on error.',
      },
      view: buildFeedbackView(STATES.WORKING, {
        ...BASE,
        phaseLabel: 'Applying changes',
        progress: [{ text: 'Edited src/forms/submit.js', done: true }, { text: 'Editing src/forms/IntakeForm.js…', done: false }],
        liveText: 'Applying the spinner change to IntakeForm.js now — button disables on submit, re-enables on error.',
      }),
    },
    {
      name: 'done',
      state: STATES.DONE,
      data: {
        ...BASE,
        summary: 'The submit button now disables with a spinner while the request is pending, repeat clicks are ignored, and it re-enables with a message on error.',
        filesChanged: [
          { path: 'src/forms/IntakeForm.js', size: '4.2 KB', added: 18, removed: 3 },
          { path: 'src/forms/submit.js', size: '1.9 KB', added: 11, removed: 2 },
          { path: 'tests/submit.test.js', size: '0.8 KB', added: 24, removed: 0 },
        ],
        checks: ['Tests passed (42/42)', 'Tagged pre-feedback-0911', 'Pushed to source · deploy succeeded'],
      },
      view: buildFeedbackView(STATES.DONE, {
        ...BASE,
        summary: 'The submit button now disables with a spinner while the request is pending, repeat clicks are ignored, and it re-enables with a message on error.',
        filesChanged: [
          { path: 'src/forms/IntakeForm.js', size: '4.2 KB', added: 18, removed: 3 },
          { path: 'src/forms/submit.js', size: '1.9 KB', added: 11, removed: 2 },
          { path: 'tests/submit.test.js', size: '0.8 KB', added: 24, removed: 0 },
        ],
        checks: ['Tests passed (42/42)', 'Tagged pre-feedback-0911', 'Pushed to source · deploy succeeded'],
      }),
    },
    {
      name: 'paused',
      state: STATES.PAUSED,
      data: { ...BASE, pausedFrom: STATES.WORKING },
      view: buildFeedbackView(STATES.PAUSED, { ...BASE, pausedFrom: STATES.WORKING }),
    },
    {
      name: 'failed-tests',
      state: STATES.FAILED,
      data: {
        ...BASE,
        error: 'tests failed (3 failing) — no changes pushed',
        failedStep: 'TESTING',
        checks: [{ label: 'Tests failed (39/42)', ok: false }],
        filesChanged: [{ path: 'src/forms/submit.js', size: '1.9 KB', added: 11, removed: 2 }],
      },
      view: buildFeedbackView(STATES.FAILED, {
        ...BASE,
        error: 'tests failed (3 failing) — no changes pushed',
        failedStep: 'TESTING',
        checks: [{ label: 'Tests failed (39/42)', ok: false }],
        filesChanged: [{ path: 'src/forms/submit.js', size: '1.9 KB', added: 11, removed: 2 }],
      }),
    },
    {
      name: 'superseded',
      state: STATES.SUPERSEDED,
      data: { ...BASE, lastRequest: 'Double-submit on the intake form' },
      view: buildFeedbackView(STATES.SUPERSEDED, { ...BASE, lastRequest: 'Double-submit on the intake form' }),
    },
    {
      name: 'no-action',
      state: STATES.NO_ACTION,
      data: { ...BASE, noActionReason: 'No defect found — the button already disables; the double submits came from an old cached bundle.' },
      view: buildFeedbackView(STATES.NO_ACTION, { ...BASE, noActionReason: 'No defect found — the button already disables; the double submits came from an old cached bundle.' }),
    },
  ];
}

export function historySample() {
  const active = {
    id: 'f99ff7',
    state: STATES.WORKING,
    data: {
      requestSummary: 'Double-submit on the intake form',
      phaseLabel: 'Applying changes',
      progress: [{ text: 'Edited src/forms/submit.js', done: true }, { text: 'Editing src/forms/IntakeForm.js…', done: false }],
      planItems: ['Disable the button + spinner.', 'Ignore repeat clicks.', 'Re-enable on error.'],
      questions: ['Button spinner or overlay?'],
    },
  };
  const history = [
    { shortId: '43cb0c', outcome: 'superseded', summary: 'Describe the bug or feature in this DM…', detail: 'replaced before anything started', endedAt: new Date().toISOString() },
    { shortId: 'a1b2c3', outcome: 'deployed', summary: 'Double-submit fixed', preDeployTag: 'pre-feedback-0911', endedAt: new Date().toISOString() },
  ];
  return { name: 'history', view: buildFeedbackHistoryView(active, history) };
}
