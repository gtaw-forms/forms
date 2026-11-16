// feedback/constants.js — single source of truth for feedback-bot UI tokens.
// No emojis here: status markers are plain ASCII/colored dots by design.
export const COLORS = {
  REVIEW: 0x5865f2, // blurple — Reviewing / Plan updated
  WORKING: 0xf0b232, // amber — Working / Applying / Testing / Deploying
  DONE: 0x23a559, // green — Done
  PAUSED: 0x80848e, // grey — Paused
  FAILED: 0xda373c, // red — Failed / needs attention
};

export const MARKERS = {
  DONE: '[done]',
  ACTIVE: '[...]',
};

export const LIMITS = {
  TITLE: 256,
  DESCRIPTION: 4096,
  FIELD_NAME: 256,
  FIELD_VALUE: 1024,
  FIELD_COUNT: 25,
  FOOTER: 2048,
  TOTAL: 6000,
};

export const CUSTOM_ID_PREFIX = 'fb';

export function feedbackCustomId(action, sessionId) {
  return `${CUSTOM_ID_PREFIX}:${action}:${sessionId}`;
}

export function parseFeedbackCustomId(customId) {
  if (typeof customId !== 'string') return null;
  const parts = customId.split(':');
  if (parts.length !== 3 || parts[0] !== CUSTOM_ID_PREFIX) return null;
  return { action: parts[1], sessionId: parts[2] };
}

// Canonical states. Rendered from state, never ad hoc.
export const STATES = {
  IDLE: 'IDLE',
  REVIEWING: 'REVIEWING',
  AWAITING_ANSWERS: 'AWAITING_ANSWERS',
  READY: 'READY',
  WORKING: 'WORKING',
  TESTING: 'TESTING',
  DEPLOYING: 'DEPLOYING',
  DONE: 'DONE',
  PAUSED: 'PAUSED',
  FAILED: 'FAILED',
  COMPLETED: 'COMPLETED',
  // Terminal verdict when the agent judges no repo change is warranted
  // (owner pressed No Action Needed). Ends at Complete Session like DONE,
  // but with no tag/commit/push and no Revert. NO_ACTION → COMPLETED.
  NO_ACTION: 'NO_ACTION',
  // Render-only terminal marker for a pre-execution session replaced by a
  // newer /feedback. Never persisted, never transitioned to — the old status
  // message is re-rendered with it so the outcome is visible inline.
  SUPERSEDED: 'SUPERSEDED',
};

export const ALLOWED_TRANSITIONS = {
  IDLE: ['REVIEWING'],
  REVIEWING: ['AWAITING_ANSWERS', 'READY', 'PAUSED', 'FAILED', 'NO_ACTION'],
  AWAITING_ANSWERS: ['REVIEWING', 'READY', 'PAUSED', 'FAILED', 'NO_ACTION'],
  READY: ['WORKING', 'PAUSED', 'FAILED', 'NO_ACTION'],
  WORKING: ['TESTING', 'PAUSED', 'FAILED'],
  TESTING: ['DEPLOYING', 'PAUSED', 'FAILED'],
  DEPLOYING: ['DONE', 'PAUSED', 'FAILED'],
  DONE: ['COMPLETED', 'FAILED', 'PAUSED'],
  PAUSED: ['REVIEWING', 'WORKING', 'READY', 'FAILED'],
  FAILED: ['REVIEWING', 'WORKING', 'COMPLETED'],
  NO_ACTION: ['COMPLETED'],
  COMPLETED: [],
};

export const DEFAULT_MODEL = {
  providerID: 'opencode-go',
  modelID: 'muse-spark-1.3-contributor',
};

// Agent names are verified at runtime via client.app.agents() (see
// services/feedback/opencode.js). These are the expected names; when the
// server reports different names the bot fails closed and lists what it saw.
export const DEFAULT_AGENTS = {
  plan: 'plan',
  build: 'build',
};

export const OPENCODE_DEFAULT_URL = 'http://127.0.0.1:4096';
