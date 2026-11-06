import { describe, it, expect } from 'vitest';
import {
  BLOCKED_MESSAGE,
  parseBlockedLabels,
  isBlockedLabel,
} from '../discord-bot/services/apiConsumerBlock.js';

describe('apiConsumerBlock', () => {
  it('carries the exact LSSD revocation message', () => {
    expect(BLOCKED_MESSAGE).toBe(
      'Contact PHMC CORONER LEADERSHIP - ALYSON FROST / FR0STYDEV to restore access | BLOCKED: 02958e - This application is not authorized to use PHMC Tools',
    );
  });

  it('parses the env label list (trims, lowercases, drops empties)', () => {
    expect([...parseBlockedLabels('lssd-pengu, Other-App ,,')]).toEqual(['lssd-pengu', 'other-app']);
    expect([...parseBlockedLabels('')]).toEqual([]);
    expect([...parseBlockedLabels(null)]).toEqual([]);
  });

  it('matches labels case-insensitively and never matches empty', () => {
    const blocked = parseBlockedLabels('lssd-pengu');
    expect(isBlockedLabel('lssd-pengu', blocked)).toBe(true);
    expect(isBlockedLabel('LSSD-PENGU', blocked)).toBe(true);
    expect(isBlockedLabel('  lssd-pengu  ', blocked)).toBe(true);
    expect(isBlockedLabel('phmc-bot', blocked)).toBe(false);
    expect(isBlockedLabel('', blocked)).toBe(false);
    expect(isBlockedLabel('lssd-pengu', null)).toBe(false);
  });
});
