import { describe, it, expect } from 'vitest';
import { firstApiKey, resolveVpsConfig } from '../discord-bot/services/vpsReportMirror.js';

describe('post-deploy VPS report mirror', () => {
  it('picks the key out of labeled and bare key lists', () => {
    expect(firstApiKey('forms-functions:pmc_morgue_abc,facebrowser:pmc_morgue_def'))
      .toBe('pmc_morgue_abc');
    expect(firstApiKey('pmc_morgue_bare')).toBe('pmc_morgue_bare');
    expect(firstApiKey(' label:key , other:key2 ')).toBe('key');
    expect(firstApiKey('')).toBe('');
  });

  it('uses the local API by default and strips a trailing slash', () => {
    expect(resolveVpsConfig({ MORGUE_API_KEYS: 'label:abc' }))
      .toEqual({ apiUrl: 'http://127.0.0.1:3001', apiKey: 'abc' });
    expect(resolveVpsConfig({ MORGUE_API_KEYS: 'label:abc', MORGUE_API_URL: 'http://example.test/' }))
      .toEqual({ apiUrl: 'http://example.test', apiKey: 'abc' });
  });

  it('supports write-key and bare-key env names', () => {
    expect(resolveVpsConfig({ MORGUE_WRITE_API_KEYS: 'ops:write-key' }).apiKey).toBe('write-key');
    expect(resolveVpsConfig({ MORGUE_API_KEY: 'single-key' }).apiKey).toBe('single-key');
  });
});
