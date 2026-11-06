import { describe, it, expect, beforeEach } from 'vitest';
import { STEPS, COMPOSE_URL } from '../src/components/migration-ui/LspdGuideModal';
import { GUIDE_VERSION, hasSeenLspdGuide, markLspdGuideSeen } from '../src/components/migration-ui/lspdGuide';

beforeEach(() => {
  window.localStorage.clear();
});

describe('lspd staff guide', () => {
  it('walks the manual self-send in order', () => {
    expect(STEPS.length).toBe(3);
    expect(STEPS[0].body).toMatch(/attach the coroner report as normal/i);
    expect(STEPS[0].body).toMatch(/click Generate/i);
    expect(STEPS[0].body).not.toMatch(/bot takes it/i);
    expect(STEPS[1].warn).toMatch(/Ask Coroner Leadership for group access/i);
    expect(STEPS[1].warn).toMatch(/ping Alyson Frost/i);
    expect(STEPS[1].link).toBeUndefined();
    expect(COMPOSE_URL).toContain('/portal/mail/compose?from=');
    expect(STEPS[2].points).toEqual([
      expect.stringMatching(/From shows/i),
      expect.stringMatching(/exact character name/i),
      expect.stringMatching(/about a request/i),
      expect.stringMatching(/SEND MESSAGE/i),
    ]);
    for (const s of STEPS) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(20);
      for (const p of s.points || []) expect(p.length).toBeGreaterThan(20);
    }
  });

  it('shows once per browser (versioned flag)', () => {
    expect(GUIDE_VERSION).toBe('v1');
    expect(hasSeenLspdGuide()).toBe(false);
    markLspdGuideSeen();
    expect(hasSeenLspdGuide()).toBe(true);
  });
});
