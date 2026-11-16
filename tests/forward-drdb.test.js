import { describe, it, expect } from 'vitest';
import {
  FORWARD_FORM,
  FORWARD_QUEUE_NODE,
  buildForwardEntity,
  findExistingLeg,
  forwardEntityKey,
  nextForwardIdx,
  validateForwardName,
} from '../src/utils/forwardDrdb';

describe('forwardDrdb — queue keys', () => {
  it('builds the legacy bare key at idx 0 and suffixed keys above', () => {
    expect(forwardEntityKey('coroner-report', 'A', 'K', 0)).toBe('coroner-report|A|K');
    expect(forwardEntityKey('coroner-report', 'A', 'K', 1)).toBe('coroner-report|A|K|1');
    expect(forwardEntityKey('coroner-report', 'A', 'K', 3)).toBe('coroner-report|A|K|3');
  });

  it('reserves idx 0: first forward starts at 1 even when empty', () => {
    expect(nextForwardIdx([], 'coroner-report', 'A', 'K')).toBe(1);
    expect(nextForwardIdx(['coroner-report|A|K'], 'coroner-report', 'A', 'K')).toBe(1);
    expect(nextForwardIdx(['coroner-report|A|K', 'coroner-report|A|K|1'], 'coroner-report', 'A', 'K')).toBe(2);
  });

  it('ignores other reports and non-numeric suffixes', () => {
    const keys = [
      'coroner-report|A|K|2',
      'coroner-report|A|OTHER|9',
      'coroner-report|B|K|7',
      'coroner-report|A|K|live',
      'something-else',
    ];
    expect(nextForwardIdx(keys, 'coroner-report', 'A', 'K')).toBe(3);
  });
});

describe('forwardDrdb — name validation', () => {
  it('accepts a trimmed name', () => {
    expect(validateForwardName('  Connor Kennedy  ')).toEqual({ ok: true, name: 'Connor Kennedy' });
  });

  it('rejects empty names', () => {
    expect(validateForwardName('').ok).toBe(false);
    expect(validateForwardName('   ').ok).toBe(false);
    expect(validateForwardName(null).ok).toBe(false);
  });

  it('rejects over-long names', () => {
    expect(validateForwardName('x'.repeat(121)).ok).toBe(false);
    expect(validateForwardName('x'.repeat(120)).ok).toBe(true);
  });
});

describe('forwardDrdb — entity + dedupe', () => {
  it('builds a queued worker entity with forward context', () => {
    const e = buildForwardEntity({
      form: 'coroner-report', authorId: 'A', reportKey: 'K',
      recipient: 'Connor Kennedy', forwardedBy: 'Jada Griffin', idx: 1,
      nowIso: '2026-11-10T12:00:00.000Z',
    });
    expect(e.status).toBe('queued');
    expect(e.attempts).toBe(0);
    expect(e.recipient).toBe('Connor Kennedy');
    expect(e.context).toEqual({
      forwardedBy: 'Jada Griffin',
      forwardedAt: '2026-11-10T12:00:00.000Z',
      source: 'migration-ui-forward',
    });
    expect(FORWARD_QUEUE_NODE).toBe('lspd-portal-form-queue');
    expect(FORWARD_FORM).toBe('coroner-report');
  });

  it('finds a pending leg for the same officer (case-insensitive)', () => {
    const entities = {
      'coroner-report|A|K|1': { status: 'retry_queued', recipient: 'connor kennedy' },
      'coroner-report|A|K|2': { status: 'sent', recipient: 'Connor Kennedy' },
      'coroner-report|A|OTHER': { status: 'queued', recipient: 'Connor Kennedy' },
    };
    expect(findExistingLeg(entities, {
      form: 'coroner-report', authorId: 'A', reportKey: 'K', recipient: 'Connor Kennedy',
    })).toBe('coroner-report|A|K|1');
  });

  it('ignores sent legs and empty names', () => {
    const entities = {
      'coroner-report|A|K': { status: 'sent', recipient: 'Connor Kennedy' },
    };
    expect(findExistingLeg(entities, {
      form: 'coroner-report', authorId: 'A', reportKey: 'K', recipient: 'Connor Kennedy',
    })).toBeNull();
    expect(findExistingLeg(entities, {
      form: 'coroner-report', authorId: 'A', reportKey: 'K', recipient: '  ',
    })).toBeNull();
  });
});
