// feedback/render.js — ONE pure renderer: { state, data } -> { embed, components }.
// No Discord calls, no network, no filesystem. Tested in isolation via
// tools/feedback-render-test.mjs and the dry-run samples.
import {
  COLORS,
  LIMITS,
  STATES,
  MARKERS,
  feedbackCustomId,
} from './constants.js';

function truncate(str, max) {
  const s = String(str ?? '');
  if (s.length <= max) return s;
  if (max <= 1) return s.slice(0, max);
  return s.slice(0, max - 1) + '…';
}

function truncateLines(lines, maxLines, maxChars) {
  const out = [];
  let total = 0;
  for (const line of lines) {
    const s = String(line);
    if (out.length >= maxLines) break;
    if (total + s.length + 1 > maxChars) break;
    out.push(s);
    total += s.length + 1;
  }
  return out;
}

function dots(ok) {
  return ok ? MARKERS.DONE : MARKERS.ACTIVE;
}

// Display-only readability self-check (runs locally before every render):
// machine marker lines out, degenerate spans unwrapped, backticks balanced
// (a lone tick is dropped — appending one would swallow the field into a chip;
// fenced blocks are left alone).
export function cleanProse(t) {
  // Fenced blocks are set aside first so span pairing can never eat fence
  // ticks. The placeholder carries underscores (a "code char"), which keeps
  // the unwrapper from touching any span it lands inside.
  const fences = [];
  const defenced = String(t ?? '').replace(/```[\s\S]*?```/g, (m) => {
    fences.push(m);
    return `__FB_FENCE_${fences.length - 1}__`;
  });
  const withoutMarkers = defenced
    .split('\n')
    .filter((l) => !/^\s*(VERDICT\s*:.*|NO-CHANGE-NEEDED)\s*$/i.test(l))
    .join('\n')
    .trim();
  const unwrapped = withoutMarkers.replace(/`([^`\n]{1,60})`/g, (m, inner) =>
    /[/.:#(){}\[\]<>|*_=+-]/.test(inner) ? m : inner,
  );
  const balanced = (() => {
    if (/```/.test(unwrapped)) return unwrapped;
    const ticks = (unwrapped.match(/`/g) || []).length;
    if (ticks % 2 === 1) {
      const i = unwrapped.lastIndexOf('`');
      return (unwrapped.slice(0, i) + unwrapped.slice(i + 1)).trim();
    }
    return unwrapped;
  })();
  return balanced.replace(/__FB_FENCE_(\d+)__/g, (_, i) => fences[Number(i)] ?? '');
}

// Rolling-tail clip that never starts mid-word: cut to max chars, then drop
// the partial first line — unless the cut already starts on a line boundary.
export function tailClip(t, max) {
  const s = String(t ?? '');
  if (s.length <= max) return s;
  const start = s.length - max;
  const cut = s.slice(start);
  if (s[start - 1] === '\n') return '…' + cut;
  const nl = cut.indexOf('\n');
  if (nl >= 0 && nl < 300) return '…' + cut.slice(nl + 1);
  // No line break handy: break at a word boundary instead of mid-word.
  const sp = cut.indexOf(' ');
  if (sp >= 0 && sp < 100) return '…' + cut.slice(sp + 1);
  return '…' + cut;
}

function fileLine(f) {
  const size = f.size ? `${f.size} · ` : '';
  const added = Number.isFinite(f.added) ? `+${f.added}` : '+?';
  const removed = Number.isFinite(f.removed) ? `−${f.removed}` : '−?';
  return `\`${f.path}\` — ${size}${added} ${removed}`.trim();
}

// Button descriptors (plain data). toDiscord() maps style strings to
// discord.js ButtonStyle. No custom colors exist in Discord — styles only.
function btn(label, style, action, sessionId, disabled = false) {
  return { label, style, customId: feedbackCustomId(action, sessionId), disabled };
}

function buttonsFor(state, data, sessionId) {
  let sid = sessionId || data.shortId || 'pending';
  // Legacy records stored sessionId as `fb:<sid>` (double prefix). Strip it
  // so customIds stay exactly fb:<action>:<sid> — the parser rejects anything
  // else and an unparsed press times out with no reply.
  if (sid.startsWith('fb:')) sid = sid.slice(3);
  // Waiting for the owner's first message: nothing has started, so the only
  // valid action is reading the log.
  if (data.awaitingRequest) {
    return [btn('View Full Log', 'Secondary', 'log', sid)];
  }
  // Closed marker: outcome is visible inline, nothing left to press.
  if (state === STATES.SUPERSEDED) return [];
  if (state === STATES.NO_ACTION) {
    return [
      btn('Complete Session', 'Success', 'complete', sid),
      btn('View Full Log', 'Secondary', 'log', sid),
    ];
  }
  switch (state) {
    case STATES.REVIEWING:
    case STATES.AWAITING_ANSWERS:
    case STATES.READY: {
      const row = [
        btn('Approve & Execute', 'Success', 'approve', sid, false),
        btn('No Action Needed', 'Secondary', 'noaction', sid),
      ];
      if ((data.questions || []).length) row.push(btn('Answer questions', 'Secondary', 'answer', sid));
      row.push(btn('Pause', 'Secondary', 'pause', sid));
      row.push(btn('View Full Log', 'Secondary', 'log', sid));
      return row;
    }
    case STATES.WORKING:
    case STATES.TESTING:
    case STATES.DEPLOYING: {
      const rows = [
        btn('Pause', 'Secondary', 'pause', sid),
        btn('View Full Log', 'Secondary', 'log', sid),
      ];
      if (data.permissionPending) {
        rows.push(btn(`Allow: ${data.permissionPending.label || 'extra scope'}`, 'Success', 'allow', sid));
        rows.push(btn('Deny', 'Danger', 'deny', sid));
      }
      return rows;
    }
    case STATES.DONE:
      return [
        btn('Complete Session', 'Success', 'complete', sid),
        btn('View Full Log', 'Secondary', 'log', sid),
        btn('Revert', 'Danger', 'revert', sid),
      ];
    case STATES.PAUSED:
      return [
        btn('Resume', 'Success', 'resume', sid),
        btn('View Full Log', 'Secondary', 'log', sid),
      ];
    case STATES.FAILED:
      return [
        btn('Retry review', 'Success', 'retry', sid),
        btn('View Full Log', 'Secondary', 'log', sid),
        btn('Revert', 'Danger', 'revert', sid),
        btn('Complete Session', 'Secondary', 'complete', sid),
      ];
    default:
      return [btn('View Full Log', 'Secondary', 'log', sid)];
  }
}

function colorFor(state, data) {
  if (state === STATES.SUPERSEDED) return COLORS.PAUSED;
  if (state === STATES.FAILED) return COLORS.FAILED;
  if (state === STATES.DONE || state === STATES.COMPLETED) return COLORS.DONE;
  if (state === STATES.NO_ACTION) return COLORS.DONE;
  if (state === STATES.PAUSED) return COLORS.PAUSED;
  if (state === STATES.WORKING || state === STATES.TESTING || state === STATES.DEPLOYING) return COLORS.WORKING;
  return COLORS.REVIEW;
}

function titleFor(state, data) {
  if (data.awaitingRequest) return 'Please send your feedback';
  if (state === STATES.SUPERSEDED) return 'Session closed';
  if (state === STATES.NO_ACTION) return 'No action needed';
  switch (state) {
    case STATES.REVIEWING:
      return 'Feedback noted';
    case STATES.AWAITING_ANSWERS:
      return data.planRevised ? 'Plan updated' : 'Feedback noted';
    case STATES.READY:
      return 'Plan updated';
    case STATES.WORKING:
      return 'Working on it';
    case STATES.TESTING:
      return 'Working on it';
    case STATES.DEPLOYING:
      return 'Working on it';
    case STATES.DONE:
      return `Done: ${data.oneLineResult || data.requestSummary || 'change applied'}`;
    case STATES.PAUSED:
      return 'Paused';
    case STATES.FAILED:
      return data.failTitle || 'Failed: needs attention';
    case STATES.COMPLETED:
      return 'Session complete';
    default:
      return 'Feedback';
  }
}

function descriptionFor(state, data) {
  if (data.awaitingRequest) {
    return 'Status: **Waiting** · describe the bug or feature request in this DM and I will investigate before changing anything';
  }
  if (state === STATES.SUPERSEDED) {
    return `Status: **Superseded** · ${data.supersedeReason || 'a newer /feedback replaced this session before anything started — nothing was changed'}`;
  }
  if (state === STATES.NO_ACTION) {
    return 'Status: **Closed** · judged to need no repo changes';
  }
  switch (state) {
    case STATES.REVIEWING:
      return `Status: **Reviewing** · ${data.phaseLabel || 'read-only, no changes made'}`;
    case STATES.AWAITING_ANSWERS: {
      if (!data.planRevised) {
        if (data.answered) return 'Status: **Answered** · read the reply in Latest above — Approve & Execute to act on it, or No Action Needed to close';
        return `Status: **Reviewing** · ${data.phaseLabel || 'read-only, no changes made'}`;
      }
      const hint = (data.questions || []).length
        ? 'press Answer questions to reply, or Approve & Execute to start'
        : 'press Approve & Execute to start, or No Action Needed to close';
      return `Status: **Plan updated** · ${hint}`;
    }
    case STATES.READY:
      return `Status: **Ready** · ${data.phaseLabel || 'approved, press Approve & Execute to start'}`;
    case STATES.WORKING:
      return `Status: **${data.phaseLabel || 'Applying changes'}**`;
    case STATES.TESTING:
      return 'Status: **Testing** · running tests/lint';
    case STATES.DEPLOYING:
      return 'Status: **Deploying** · tagging, pushing the deploy branch';
    case STATES.DONE:
      return 'Status: **Deployed**';
    case STATES.PAUSED:
      return 'Stopped before the next step. Send feedback or extra info and I will re-check the plan before continuing.';
    case STATES.FAILED:
      return `Status: **Failed** · ${data.error || 'see log'}`;
    case STATES.COMPLETED:
      return 'Status: **Complete** · session archived, slot free';
    default:
      return `Status: **${state}**`;
  }
}

export function buildFeedbackView(state, data = {}) {
  const d = { shortId: 'fb-1', ...data };
  const fields = [];

  // 0. The owner's original request — verbatim context for everything below.
  const isPlaceholderSummary = !d.requestSummary || /waiting for your first message|collecting your request|^describe the bug/i.test(d.requestSummary);
  if (!d.awaitingRequest && !isPlaceholderSummary && ![STATES.SUPERSEDED, STATES.COMPLETED, STATES.NO_ACTION].includes(state)) {
    fields.push({
      name: 'User has asked',
      value: truncate(d.requestSummary.slice(0, 1000), LIMITS.FIELD_VALUE),
      inline: false,
    });
  }

  // 1. Investigated (review) or Progress (execution).
  const steps = d.progress?.length ? d.progress : d.investigated;
  if (steps?.length) {
    const isProgress = !!d.progress?.length;
    const lines = steps.map((s) => {
      if (typeof s === 'string') return `${MARKERS.DONE} ${s}`;
      const mark = s.done === false ? MARKERS.ACTIVE : MARKERS.DONE;
      return `${mark} ${s.text || s.label || ''}`.trim();
    });
    const visible = truncateLines(lines, 8, LIMITS.FIELD_VALUE - 20);
    let value = visible.join('\n');
    if (lines.length > visible.length) value += `\n+${lines.length - visible.length} more`;
    // Permission request surfaces as its own block, never as a silent scope jump.
    if (d.permissionPending && (state === STATES.WORKING || state === STATES.TESTING)) {
      value += `\n${MARKERS.ACTIVE} Waiting on permission: ${d.permissionPending.label || 'extra scope'} — use Allow/Deny below`;
    }
    fields.push({
      name: truncate(isProgress ? 'Progress' : 'Investigated', LIMITS.FIELD_NAME),
      value: truncate(value || '—', LIMITS.FIELD_VALUE),
      inline: false,
    });
  }

  // Mostly-live agent prose — but once the structured plan/questions render,
  // the raw tail would just duplicate them, so it shows only while unstructured.
  const structured = (d.planItems?.length || d.questions?.length) &&
    [STATES.REVIEWING, STATES.AWAITING_ANSWERS, STATES.READY].includes(state);
  if (d.liveText && !structured && state !== STATES.SUPERSEDED && state !== STATES.COMPLETED) {
    const prose = cleanProse(d.liveText);
    if (prose) {
      fields.push({
        name: 'Latest',
        // ~1000 of the 1024 field budget — the tailClip keeps line starts clean.
        value: truncate(tailClip(prose, 1000), LIMITS.FIELD_VALUE),
        inline: false,
      });
    }
  }

  // 2. Proposed plan (review states).
  if ([STATES.REVIEWING, STATES.AWAITING_ANSWERS, STATES.READY].includes(state) && d.planItems?.length) {
    const numbered = d.planItems.slice(0, 5).map((p, i) => `${i + 1}. ${p}`);
    let value = numbered.join('\n');
    if (d.planItems.length > 5) value += `\n+${d.planItems.length - 5} more`;
    fields.push({ name: 'Proposed plan', value: truncate(value, LIMITS.FIELD_VALUE), inline: false });
  }

  // 3. Questions (phase 1 only).
  if ([STATES.REVIEWING, STATES.AWAITING_ANSWERS].includes(state) && d.questions?.length) {
    const qs = d.questions.slice(0, 5).map((q, i) => `**Q${i + 1}.** ${q}`);
    fields.push({
      name: 'Questions before I change anything',
      value: truncate(qs.join('\n'), LIMITS.FIELD_VALUE),
      inline: false,
    });
  }

  // 4. Summary (done / no-action verdict).
  if ((state === STATES.DONE || state === STATES.COMPLETED) && d.summary) {
    fields.push({ name: 'Summary', value: truncate(d.summary, LIMITS.FIELD_VALUE), inline: false });
  }
  if (state === STATES.NO_ACTION && (d.noActionReason || d.summary)) {
    fields.push({ name: 'Summary', value: truncate(d.noActionReason || d.summary, LIMITS.FIELD_VALUE), inline: false });
  }

  // 5. Files changed.
  if (d.filesChanged?.length && [STATES.TESTING, STATES.DEPLOYING, STATES.DONE, STATES.FAILED].includes(state)) {
    const lines = d.filesChanged.map(fileLine);
    fields.push({
      name: `Files changed (${d.filesChanged.length})`,
      value: truncate(truncateLines(lines, 8, LIMITS.FIELD_VALUE - 20).join('\n') +
        (lines.length > 8 ? `\n+${lines.length - 8} more` : ''), LIMITS.FIELD_VALUE),
      inline: false,
    });
  }

  // 6. Checks & deploy.
  if (d.checks?.length && [STATES.TESTING, STATES.DEPLOYING, STATES.DONE, STATES.FAILED].includes(state)) {
    const lines = d.checks.map((c) => {
      if (typeof c === 'string') return `${MARKERS.DONE} ${c}`;
      return `${dots(c.ok !== false)} ${c.label || c.text || ''}`.trim();
    });
    fields.push({ name: 'Checks & deploy', value: truncate(lines.join('\n'), LIMITS.FIELD_VALUE), inline: false });
  }

  // 7. Terminal-state session closer (above the buttons).
  if (state === STATES.DONE) {
    fields.push({
      name: 'Finished with this session?',
      value: 'Press Complete Session to archive it and free the slot, or Revert to roll main back.',
      inline: false,
    });
  }
  if (state === STATES.NO_ACTION) {
    fields.push({
      name: 'Finished with this session?',
      value: 'Press Complete Session to archive it and free the slot. Nothing was changed, so there is nothing to revert.',
      inline: false,
    });
  }

  if (state === STATES.PAUSED && d.pausedFrom) {
    fields.push({ name: 'Paused from', value: truncate(String(d.pausedFrom), LIMITS.FIELD_VALUE), inline: false });
  }

  if (state === STATES.SUPERSEDED && d.lastRequest) {
    fields.push({
      name: 'Your last message (kept, not acted on)',
      value: truncate(String(d.lastRequest), LIMITS.FIELD_VALUE),
      inline: false,
    });
  }

  if (state === STATES.FAILED && d.failedStep) {
    fields.push({ name: 'Failed step', value: truncate(String(d.failedStep), LIMITS.FIELD_VALUE), inline: false });
  }

  // Enforce the 25-field cap (we never get near it, but the contract is the contract).
  const capped = fields.slice(0, LIMITS.FIELD_COUNT);

  const embed = {
    title: truncate(titleFor(state, d), LIMITS.TITLE),
    description: truncate(descriptionFor(state, d), LIMITS.DESCRIPTION),
    color: colorFor(state, d),
    fields: capped,
    footer: { text: truncate(`PHMC Forms · session ${d.shortId || 'fb-1'}`, LIMITS.FOOTER) },
  };

  // Total-budget guard: drop trailing fields until under 6000 chars.
  function embedSize(e) {
    return (e.title?.length || 0) + (e.description?.length || 0) +
      (e.footer?.text?.length || 0) +
      e.fields.reduce((n, f) => n + (f.name?.length || 0) + (f.value?.length || 0), 0);
  }
  while (embed.fields.length > 1 && embedSize(embed) > LIMITS.TOTAL) embed.fields.pop();
  if (embedSize(embed) > LIMITS.TOTAL) {
    embed.description = truncate(embed.description, Math.max(100, LIMITS.DESCRIPTION - (embedSize(embed) - LIMITS.TOTAL)));
  }

  return { embed, components: buttonsFor(state, d, d.sessionId || d.shortId) };
}

// Convert the plain view into discord.js builders at the call site.
export async function toDiscordMessage(view) {
  const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
  const embed = new EmbedBuilder()
    .setTitle(view.embed.title)
    .setDescription(view.embed.description)
    .setColor(view.embed.color);
  for (const f of view.embed.fields) embed.addFields({ name: f.name, value: f.value, inline: !!f.inline });
  if (view.embed.footer?.text) embed.setFooter({ text: view.embed.footer.text });
  const styleMap = { Success: ButtonStyle.Success, Secondary: ButtonStyle.Secondary, Danger: ButtonStyle.Danger };
  const buttons = (view.components || []).map((b) => {
    const btn = new ButtonBuilder()
      .setLabel(b.label)
      .setStyle(styleMap[b.style] || ButtonStyle.Secondary)
      .setCustomId(b.customId);
    if (b.disabled) btn.setDisabled(true);
    return btn;
  });
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }
  return { embeds: [embed], components: rows };
}

// /feedback-list view: live session (with stage/step detail) plus history.
export function buildFeedbackHistoryView(active, history) {
  const fields = [];
  if (active) {
    const d = active.data || {};
    const prog = Array.isArray(d.progress) ? d.progress : [];
    const doneSteps = prog.filter((p) => (typeof p === 'string' ? true : p.done !== false)).length;
    const stageBits = [
      `phase: ${d.phaseLabel || active.state}`,
      prog.length ? `steps: ${doneSteps}/${prog.length} done` : null,
      (d.planItems || []).length ? `plan: ${d.planItems.length} items` : null,
      (d.questions || []).length ? `questions: ${d.questions.length}` : null,
      d.preDeployTag ? `tag: ${d.preDeployTag}` : null,
    ].filter(Boolean).join(' · ');
    fields.push({
      name: 'Active now',
      value: truncate(`\`${active.id}\` — **${active.state}**\n${stageBits}\n> ${(d.requestSummary || '(no summary)').slice(0, 200)}`, LIMITS.FIELD_VALUE),
      inline: false,
    });
  }
  const items = (history || []).slice(0, 10);
  if (items.length) {
    const lines = items.map((h) => {
      const when = h.endedAt ? ` · <t:${Math.floor(new Date(h.endedAt).getTime() / 1000)}:R>` : '';
      const tag = h.preDeployTag ? ` · \`${h.preDeployTag}\`` : '';
      const detail = h.detail ? ` — ${String(h.detail).slice(0, 80)}` : '';
      return `\`${h.shortId || h.id}\` — **${h.outcome}** · ${(h.summary || '(no summary)').slice(0, 100)}${tag}${when}${detail}`;
    });
    fields.push({ name: `Past sessions (${(history || []).length})`, value: truncate(lines.join('\n'), LIMITS.FIELD_VALUE), inline: false });
  }
  return {
    embed: {
      title: 'Feedback sessions',
      description: active ? `Status: **${active.state}**` : 'Status: **Idle** · no active session — run /feedback to start one',
      color: active ? colorFor(active.state, active.data || {}) : COLORS.PAUSED,
      fields: fields.slice(0, LIMITS.FIELD_COUNT),
      footer: { text: 'PHMC Forms · feedback history (last 20)' },
    },
    components: [],
  };
}

export { dots as _dotsForTests };
