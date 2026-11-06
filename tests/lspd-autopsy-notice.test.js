import { describe, it, expect } from 'vitest';
import {
  isLspdAutopsyTarget,
  autopsyNoticeRecipient,
} from '../discord-bot/services/lspdAutopsyNotice.js';

const lspdEntry = (over = {}) => ({
  faction: 'lspd',
  title: '[LSPD] Autopsy request John Doe',
  name: 'John Doe',
  oocName: 'JohnDoe_1999',
  parsed: { requesterName: 'Alexander Ryland', requesterDept: 'Los Santos Police Department' },
  ...over,
});

describe('lspdAutopsyNotice — target + recipient', () => {
  it('targets LSPD requests by faction, title tag, or department hint', () => {
    expect(isLspdAutopsyTarget(lspdEntry())).toBe(true);
    expect(isLspdAutopsyTarget({ title: '[LSPD] x', parsed: {} })).toBe(true);
    expect(isLspdAutopsyTarget({ parsed: { requesterDept: 'Los Santos Police Department' } })).toBe(true);
    expect(isLspdAutopsyTarget({ faction: 'lssd', parsed: {} })).toBe(false);
    expect(isLspdAutopsyTarget({ title: '[LSSD] x', parsed: { requesterDept: 'LSPD' } })).toBe(false);
    expect(isLspdAutopsyTarget({})).toBe(false);
  });

  it('resolves the character-name recipient strictly (never guesses)', () => {
    expect(autopsyNoticeRecipient(lspdEntry())).toBe('Alexander Ryland');
    expect(autopsyNoticeRecipient({ parsed: {} })).toBe('');
    expect(autopsyNoticeRecipient({})).toBe('');
  });
});
