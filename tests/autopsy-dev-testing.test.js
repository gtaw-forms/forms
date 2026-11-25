import { describe, it, expect, afterEach } from 'vitest';
import {
  isAutopsyDevTesting,
  effectiveAutopsyDryRun,
  simNoticeTag,
} from '../discord-bot/services/autopsyDevTesting.js';

// "Autopsy Dev Testing" mode: intake + completion simulate without touching the
// outside world. Pure flag logic — the call sites (monitor dry-run branches,
// handleAutopsyReply DRY) just OR this in.

const OLD_DEV = process.env.AUTOPSY_DEV_TESTING;
const OLD_DRY = process.env.AUTOPSY_DRY_RUN;

afterEach(() => {
  if (OLD_DEV === undefined) delete process.env.AUTOPSY_DEV_TESTING;
  else process.env.AUTOPSY_DEV_TESTING = OLD_DEV;
  if (OLD_DRY === undefined) delete process.env.AUTOPSY_DRY_RUN;
  else process.env.AUTOPSY_DRY_RUN = OLD_DRY;
});

describe('isAutopsyDevTesting', () => {
  it('is off unless explicitly true', () => {
    delete process.env.AUTOPSY_DEV_TESTING;
    expect(isAutopsyDevTesting()).toBe(false);
    process.env.AUTOPSY_DEV_TESTING = 'false';
    expect(isAutopsyDevTesting()).toBe(false);
    process.env.AUTOPSY_DEV_TESTING = 'TRUE';
    expect(isAutopsyDevTesting()).toBe(true);
  });
});

describe('effectiveAutopsyDryRun', () => {
  it('forces dry-run when dev testing is on, even with legacy flag false (live)', () => {
    process.env.AUTOPSY_DRY_RUN = 'false';
    process.env.AUTOPSY_DEV_TESTING = 'true';
    expect(effectiveAutopsyDryRun()).toBe(true);
  });

  it('preserves legacy semantics (unset/anything-but-false counts as dry)', () => {
    delete process.env.AUTOPSY_DEV_TESTING;
    delete process.env.AUTOPSY_DRY_RUN;
    expect(effectiveAutopsyDryRun()).toBe(true);
    process.env.AUTOPSY_DRY_RUN = 'false';
    expect(effectiveAutopsyDryRun()).toBe(false);
  });
});

describe('simNoticeTag', () => {
  it('labels dev-testing notices distinctly from legacy dry-run', () => {
    process.env.AUTOPSY_DEV_TESTING = 'true';
    expect(simNoticeTag()).toBe('[DEV-TEST SIMULATION]');
    process.env.AUTOPSY_DEV_TESTING = 'false';
    expect(simNoticeTag()).toBe('[DRY RUN]');
  });
});
