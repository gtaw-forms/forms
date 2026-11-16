#!/usr/bin/env node
// tools/feedback-render-test.mjs — test render.js in isolation (no Discord, no
// model). Fails on: limit violations, illegal transitions, missing buttons.
import { buildFeedbackView } from '../discord-bot/services/feedback/render.js';
import { LIMITS, STATES, ALLOWED_TRANSITIONS } from '../discord-bot/services/feedback/constants.js';
import { sampleViews } from '../discord-bot/services/feedback/samples.js';

let failures = 0;
function check(label, good, extra = '') {
  console.log(`${good ? '[OK]  ' : '[FAIL]'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!good) failures += 1;
}

function embedSize(e) {
  return (e.title?.length || 0) + (e.description?.length || 0) + (e.footer?.text?.length || 0) +
    e.fields.reduce((n, f) => n + (f.name?.length || 0) + (f.value?.length || 0), 0);
}

// 1. Every sample state renders within Discord limits.
for (const s of sampleViews()) {
  const { embed, components } = s.view;
  check(`${s.name}: title<=${LIMITS.TITLE}`, embed.title.length <= LIMITS.TITLE, `${embed.title.length}`);
  check(`${s.name}: description<=${LIMITS.DESCRIPTION}`, embed.description.length <= LIMITS.DESCRIPTION);
  check(`${s.name}: fields<=${LIMITS.FIELD_COUNT}`, embed.fields.length <= LIMITS.FIELD_COUNT, `${embed.fields.length}`);
  check(`${s.name}: total<=${LIMITS.TOTAL}`, embedSize(embed) <= LIMITS.TOTAL, `${embedSize(embed)}`);
  check(`${s.name}: footer<=${LIMITS.FOOTER}`, (embed.footer?.text?.length || 0) <= LIMITS.FOOTER);
  let fieldsOk = true;
  for (const f of embed.fields) {
    if (f.name.length > LIMITS.FIELD_NAME || f.value.length > LIMITS.FIELD_VALUE) fieldsOk = false;
  }
  check(`${s.name}: field name/value limits`, fieldsOk);
  check(`${s.name}: 1-5 buttons`, s.name === 'superseded' ? components.length === 0 : (components.length >= 1 && components.length <= 5), `${components.length}`);
  const ids = new Set(components.map((c) => c.customId));
  check(`${s.name}: customIds fb:<action>:<session>`, components.every((c) => /^fb:[a-z-]+:[A-Za-z0-9_-]+$/.test(c.customId)) && ids.size === components.length);
}

// 2. State machine: illegal jumps rejected (mirror of store.ALLOWED_TRANSITIONS).
const illegal = [['IDLE', 'WORKING'], ['REVIEWING', 'DONE'], ['DONE', 'WORKING'], ['COMPLETED', 'REVIEWING']];
for (const [from, to] of illegal) {
  check(`illegal ${from}->${to} rejected`, !(ALLOWED_TRANSITIONS[from] || []).includes(to));
}
const legal = [['IDLE', 'REVIEWING'], ['REVIEWING', 'AWAITING_ANSWERS'], ['AWAITING_ANSWERS', 'READY'], ['READY', 'WORKING'], ['WORKING', 'TESTING'], ['TESTING', 'DEPLOYING'], ['DEPLOYING', 'DONE'], ['DONE', 'COMPLETED'], ['REVIEWING', 'NO_ACTION'], ['AWAITING_ANSWERS', 'NO_ACTION'], ['READY', 'NO_ACTION'], ['NO_ACTION', 'COMPLETED']];
for (const [from, to] of legal) {
  check(`legal ${from}->${to} allowed`, (ALLOWED_TRANSITIONS[from] || []).includes(to));
}
check('illegal WORKING->NO_ACTION rejected', !(ALLOWED_TRANSITIONS[STATES.WORKING] || []).includes(STATES.NO_ACTION));

// 3. Done state carries the session-closer field above the buttons.
{
  const done = sampleViews().find((s) => s.name === 'done');
  check('done: Finished-field present', done.view.embed.fields.some((f) => f.name === 'Finished with this session?'));
}

// 4. Failed state carries Retry + View Full Log + Revert.
{
  const failed = sampleViews().find((s) => s.name === 'failed-tests');
  const labels = failed.view.components.map((c) => c.label);
  check('failed: Retry + View Full Log + Revert', labels.includes('Retry review') && labels.includes('View Full Log') && labels.includes('Revert'), labels.join(','));
}

// 5. Paused state carries Resume.
{
  const paused = sampleViews().find((s) => s.name === 'paused');
  check('paused: Resume', paused.view.components.some((c) => c.label === 'Resume'));
}

// 6. Awaiting state: waiting copy, View Full Log only, nothing else to press.
{
  const awaiting = sampleViews().find((s) => s.name === 'awaiting');
  check('awaiting: title asks for feedback', awaiting.view.embed.title === 'Please send your feedback', awaiting.view.embed.title);
  check('awaiting: single View Full Log button', awaiting.view.components.length === 1 && awaiting.view.components[0].label === 'View Full Log');
}

// 7. Superseded state: closed marker, no buttons, last request echoed.
{
  const sup = sampleViews().find((s) => s.name === 'superseded');
  check('superseded: title', sup.view.embed.title === 'Session closed', sup.view.embed.title);
  check('superseded: no buttons', sup.view.components.length === 0);
  check('superseded: last request shown', sup.view.embed.fields.some((f) => f.name === 'Your last message (kept, not acted on)'));
  const { buildFeedbackView } = await import('../discord-bot/services/feedback/render.js');
  const custom = buildFeedbackView(STATES.SUPERSEDED, { shortId: 'x1', supersedeReason: 'abandoned by the owner — test' });
  check('superseded: custom reason shown', custom.embed.description.includes('abandoned by the owner'));
}

// 7b. Review descriptions surface the live phase label.
{
  const { buildFeedbackView } = await import('../discord-bot/services/feedback/render.js');
  const assessing = buildFeedbackView(STATES.REVIEWING, { shortId: 'x1', phaseLabel: 'Assessing whether action is needed…' });
  check('review: assessing label visible', assessing.embed.description.includes('Assessing whether action is needed'));
}

// 8. History list: active session with stage/step detail + past outcomes.
{
  const { historySample } = await import('../discord-bot/services/feedback/samples.js');
  const h = historySample();
  check('history: title', h.view.embed.title === 'Feedback sessions');
  check('history: active + past fields', h.view.embed.fields.length === 2, `${h.view.embed.fields.length}`);
  check('history: stage detail', /steps: 1\/2 done/.test(h.view.embed.fields[0].value) && /plan: 3 items/.test(h.view.embed.fields[0].value), h.view.embed.fields[0].value.slice(0, 120));
  let ok = true;
  for (const f of h.view.embed.fields) {
    if (f.name.length > LIMITS.FIELD_NAME || f.value.length > LIMITS.FIELD_VALUE) ok = false;
  }
  check('history: field limits', ok);
  check('history: no buttons', h.view.components.length === 0);
}

// 9. Live prose: working state with liveText renders a Latest field.
{
  const w = sampleViews().find((s) => s.name === 'working');
  check('working: Latest field shown', w.view.embed.fields.some((f) => f.name === 'Latest'));
}

// 10. No-action verdict: closed green state, reason + closer, Complete + Log only.
{
  const n = sampleViews().find((s) => s.name === 'no-action');
  check('no-action: title', n.view.embed.title === 'No action needed');
  check('no-action: summary + closer', n.view.embed.fields.some((f) => f.name === 'Summary') && n.view.embed.fields.some((f) => f.name === 'Finished with this session?'));
  const labels = n.view.components.map((c) => c.label);
  check('no-action: Complete + Log, no Revert', labels.includes('Complete Session') && labels.includes('View Full Log') && !labels.includes('Revert'), labels.join(','));
}

// 11. Review states carry the No Action Needed button.
{
  const r = sampleViews().find((s) => s.name === 'review');
  check('review: No Action Needed button', r.view.components.some((c) => c.label === 'No Action Needed' && /^fb:noaction:[A-Za-z0-9_-]+$/.test(c.customId)));
}

// 12. Answer-questions button appears only when questions are open; the
// compiled answers prompt carries every Q/A pair.
{
  const { buildFeedbackView } = await import('../discord-bot/services/feedback/render.js');
  const { buildAnswerPrompt } = await import('../discord-bot/services/feedback/controller.js');
  const withQ = buildFeedbackView(STATES.REVIEWING, { shortId: 'x1', questions: ['First?', 'Second?'] });
  check('review with questions: Answer button', withQ.components.some((c) => c.label === 'Answer questions' && /^fb:answer:[A-Za-z0-9_-]+$/.test(c.customId)));
  const withoutQ = buildFeedbackView(STATES.REVIEWING, { shortId: 'x1', questions: [] });
  check('review without questions: no Answer button', !withoutQ.components.some((c) => c.label === 'Answer questions'));
  const prompt = buildAnswerPrompt([{ q: 'First?', a: 'Yes' }, { q: 'Second?', a: 'No' }]);
  check('answer prompt carries Q/A pairs', prompt.includes('A1 (re: First?): Yes') && prompt.includes('A2 (re: Second?): No') && /re-emit PLAN/i.test(prompt));
}

// 14. Parser drops thinking-aloud fragments; revision windows replace.
{
  const { parsePlanSections } = await import('../discord-bot/services/feedback/controller.js');
  const r = parsePlanSections('QUESTIONS:\nQ1. Is this test reply sufficient, or do you want me to post this answer as well?\nQ4. feedback`?\nQ5. public?');
  check('parser: keeps real questions', r.questions.length === 1 && r.questions[0].startsWith('Is this test reply'), JSON.stringify(r.questions));
  check('parser: reports sections seen', r.sawQ === true && r.sawPlan === false);
}

// 14b. Status hint never points at a missing Answer button.
{
  const { buildFeedbackView } = await import('../discord-bot/services/feedback/render.js');
  const noQ = buildFeedbackView(STATES.AWAITING_ANSWERS, { shortId: 'x1', planRevised: true, questions: [], planItems: ['Do a thing'] });
  check('awaiting without questions: close hint, no Answer pointer', !noQ.embed.description.includes('Answer questions') && noQ.embed.description.includes('No Action Needed'));
  const withQ = buildFeedbackView(STATES.AWAITING_ANSWERS, { shortId: 'x1', planRevised: true, questions: ['Why is this the case here?'] });
  check('awaiting with questions: answer hint', withQ.embed.description.includes('Answer questions'));
}

// 13. Wrongly-failed sessions can retry back into review.
{
  check('legal FAILED->REVIEWING allowed', (ALLOWED_TRANSITIONS[STATES.FAILED] || []).includes(STATES.REVIEWING));
}

// 15. No duplication: structured review hides the raw Latest tail (it stays
// for execution, where the prose is new work rather than plan echo).
{
  const { buildFeedbackView } = await import('../discord-bot/services/feedback/render.js');
  const structured = buildFeedbackView(STATES.REVIEWING, { shortId: 'x1', liveText: 'raw draft tail echoing the plan', planItems: ['Do a thing'], questions: ['Why is this the case here?'] });
  check('review structured: Latest hidden', !structured.embed.fields.some((f) => f.name === 'Latest'));
}

// 15b. The owner's request is quoted first ("User has asked").
{
  const { buildFeedbackView } = await import('../discord-bot/services/feedback/render.js');
  const r = buildFeedbackView(STATES.REVIEWING, { shortId: 'x1', requestSummary: 'Double-submit on the intake form' });
  check('review: User has asked first', r.embed.fields[0]?.name === 'User has asked' && r.embed.fields[0]?.value.includes('Double-submit'));
  const waiting = buildFeedbackView(STATES.REVIEWING, { shortId: 'x1', awaitingRequest: true, requestSummary: 'Waiting for your first message…' });
  check('waiting: no User has asked yet', !waiting.embed.fields.some((f) => f.name === 'User has asked'));
}

// 15c. Prose helpers: markers stripped, tail clips on line boundaries,
// degenerate code spans unwrapped.
{
  const { cleanProse, tailClip, buildFeedbackView } = await import('../discord-bot/services/feedback/render.js');
  check('cleanProse strips markers', cleanProse('a\nNO-CHANGE-NEEDED\nb\nVERDICT: NO-ACTION') === 'a\nb');
  check('cleanProse unwraps prose spans', cleanProse('use `and` then `GET /api/health` ok') === 'use and then `GET /api/health` ok');
  check('tailClip short text untouched', tailClip('abc', 800) === 'abc');
  check('tailClip starts on a line', tailClip('aaa\nbbb\nccc', 7) === '…bbb\nccc');
  check('tailClip breaks long lines at a word', tailClip('A'.repeat(60) + ' hello world test', 20) === '…hello world test');
  check('cleanProse balances a lone tick', cleanProse('with detail in CLAUDE.md`') === 'with detail in CLAUDE.md');
  check('cleanProse leaves fences alone', cleanProse('```js\nx\n``` tail `oops') === '```js\nx\n``` tail oops');
  const marked = buildFeedbackView(STATES.REVIEWING, { shortId: 'x1', liveText: 'hello\nNO-CHANGE-NEEDED' });
  const latest = marked.embed.fields.find((f) => f.name === 'Latest');
  check('Latest hides marker lines', latest && !/NO-CHANGE-NEEDED/.test(latest.value));
}

// 15d. Agent prompt carries the uniform markdown contract.
{
  const { initialPrompt } = await import('../discord-bot/services/feedback/opencode.js');
  const { buildAnswerPrompt } = await import('../discord-bot/services/feedback/controller.js');
  const p = initialPrompt('test request', '/repo').toLowerCase();
  check('prompt demands markdown structure', p.includes('## <one-line finding>') && p.includes('max 5 bullets'));
  check('prompt demands exact machine lines', p.includes('keep machine lines exact') && p.includes('plan:') && p.includes('no-change-needed'));
  check('prompt demands agent self-check', p.includes('self-check the reply') && p.includes('every backtick paired'));
  check('answer prompt repeats format check', buildAnswerPrompt([{ q: 'Q?', a: 'A' }]).includes('format rules'));
  check('prompt demands balanced backticks', p.includes('always balanced'));
}

// 16. Fresh context on new input: stale plan/questions/prose/verdict clear.
{
  const { freshContextPatch } = await import('../discord-bot/services/feedback/controller.js');
  const p = freshContextPatch();
  check('fresh patch clears display state', p.planItems.length === 0 && p.questions.length === 0 && p.liveText === '' && p.planDraft === '');
  check('fresh patch clears verdict path', p.verdict === null && p.noActionAsked === false && p.noActionReason === null && p.answered === false);
  check('fresh patch shows processing label', p.phaseLabel === 'Processing new input…' && p.planRevised === false);

// 17. Pure answers surface without forced plan shape.
{
  const { buildFeedbackView } = await import('../discord-bot/services/feedback/render.js');
  const a = buildFeedbackView(STATES.AWAITING_ANSWERS, { shortId: 'x1', answered: true, liveText: 'The morgue API exposes…' });
  check('answered: status names it', a.embed.description.includes('**Answered**'));
  check('answered: Latest visible (no structured fields)', a.embed.fields.some((f) => f.name === 'Latest'));
}

// 18. /feedback opens an ask modal within Discord limits.
{
  const { askModalDescriptor, isFeedbackEnabled } = await import('../discord-bot/services/feedback/controller.js');
  const m = askModalDescriptor();
  check('ask modal id', /^fb:ask:[a-z]+$/.test(m.customId), m.customId);
  check('ask modal title limit', m.title.length >= 1 && m.title.length <= 45, m.title);
  let fieldsOk = m.fields.length >= 1 && m.fields.length <= 5;
  for (const f of m.fields) {
    if (!(f.label.length >= 1 && f.label.length <= 45)) fieldsOk = false;
    if (f.placeholder && f.placeholder.length > 100) fieldsOk = false;
    if (!(f.maxLength >= 1 && f.maxLength <= 4000)) fieldsOk = false;
  }
  check('ask modal fields within limits', fieldsOk);
}

// 20. Kill-switch defaults on; false pauses new sessions.
{
  const prev = process.env.FEEDBACK_ENABLED;
  delete process.env.FEEDBACK_ENABLED;
  check('feedback enabled by default', (await import('../discord-bot/services/feedback/controller.js')).isFeedbackEnabled() === true);
  process.env.FEEDBACK_ENABLED = 'false';
  const { isFeedbackEnabled } = await import('../discord-bot/services/feedback/controller.js');
  check('feedback pauses on false', isFeedbackEnabled() === false);
  if (prev === undefined) delete process.env.FEEDBACK_ENABLED;
  else process.env.FEEDBACK_ENABLED = prev;
}
}

// 21. Permission labels never render as [object Object].
{
  const { normalizeEvent } = await import('../discord-bot/services/feedback/opencode.js');
  const ev = normalizeEvent({ type: 'permission.asked', properties: { permissionID: 'per_1', description: { messageID: 'm1', callID: 'c1' } } });
  check('permission object label stringified', typeof ev.label === 'string' && !ev.label.includes('[object Object]'), String(ev.label).slice(0, 80));
  const ev2 = normalizeEvent({ type: 'permission.asked', properties: { permissionID: 'per_2' } });
  check('permission missing label falls back', ev2.label === 'extra scope', ev2.label);
}

// 20. Transient send failures retry; permanent ones fail fast.
{
  const { isTransientError, sendPromptWithRetry } = await import('../discord-bot/services/feedback/opencode.js');
  check('transient classifier', isTransientError(new Error('fetch failed')) && isTransientError('socket hang up') && !isTransientError(new Error('session is busy')));
  let calls = 0;
  const flaky = async () => { calls++; if (calls < 3) throw new Error('fetch failed'); return 'ok'; };
  const out = await sendPromptWithRetry('s', { text: 'hi' }, { baseMs: 1 }, flaky);
  check('retry then succeeds', out === 'ok' && calls === 3, `${out}/${calls}`);
  let busyCalls = 0;
  try {
    await sendPromptWithRetry('s', {}, { baseMs: 1 }, async () => { busyCalls++; throw new Error('session is busy'); });
    check('busy fails fast', false);
  } catch (e) {
    check('busy fails fast', busyCalls === 1 && /busy/.test(e.message));
  }
}

if (failures) {
  console.error(`[render-test] ${failures} failure(s).`);
  process.exit(1);
}
console.log('[render-test] all render/state checks passed.');
