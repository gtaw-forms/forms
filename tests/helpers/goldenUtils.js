// tests/helpers/goldenUtils.js
// Stage T2 (test-strategy plan) shared golden-test utilities: the department
// name constants and the BBCode tag-balance machinery used by BOTH the
// hook-level oracle (tests/capture-baseline.test.js) and the pure-core golden
// (tests/golden-core.test.js). Single source of truth so the balance logic
// lives in ONE place.
import { expect } from 'vitest';
import generateDecedentBBCode from '../../src/phmc-bbcode-generators/generateMassFatality';

// phpBB tags checked for balance. Self-closing [hr], [br], [*] and tags the
// pinned inputs do not emit ([url], [spoiler], [cbc], [cb]) are fine to keep in
// the set — they are asserted as balanced at 0/0. [color] (emitted by the
// decedent generator for the morgue-unavailable line) is intentionally NOT in
// the set.
export const TAG_SET = ['b', 'i', 'u', 'size', 'url', 'img', 'center', 'divbox', 'list', 'spoiler', 'altspoiler', 'cbc', 'cb', 'bold'];

const openRe = (tag) => new RegExp(`\\[${tag}(?:=[^\\]]*)?\\]`, 'gi');
const closeRe = (tag) => new RegExp(`\\[/${tag}\\]`, 'gi');

export const tagCount = (s, tag) => ({
  open: (s.match(openRe(tag)) || []).length,
  close: (s.match(closeRe(tag)) || []).length,
});

// Expected open-minus-close delta per tag, computed from the pinned inputs the
// hook consumes verbatim: the template plus (for mass) the decedent block the
// generator splices in. The rendered output must reproduce these deltas exactly.
export const pinnedTagDeltas = (template, decedents, coronerInfo) => {
  const delta = {};
  for (const tag of TAG_SET) delta[tag] = 0;
  const add = (s) => {
    for (const tag of TAG_SET) {
      const c = tagCount(s, tag);
      delta[tag] += c.open - c.close;
    }
  };
  add(template);
  if (decedents) add(generateDecedentBBCode(decedents, coronerInfo));
  return delta;
};

export const assertTagBalance = (bbcode, template, decedents, coronerInfo) => {
  const delta = pinnedTagDeltas(template, decedents, coronerInfo);
  for (const tag of TAG_SET) {
    const c = tagCount(bbcode, tag);
    expect(
      c.open - c.close,
      `[ERR] '${tag}' drifted from pinned delta ${delta[tag]} (rendered ${c.open}/${c.close})`
    ).toBe(delta[tag]);
    if (delta[tag] === 0) {
      expect(c.open, `[ERR] '${tag}' unbalanced: ${c.open} opens vs ${c.close} closes`).toBe(c.close);
    }
  }
};

// Department short code -> raw value fed into the template's
// {{getDepartmentFullName(formData.department, agencyDataStore)}} placeholder.
// 'unknown' carries the literal code "XYZ" (getDepartmentFullName falls back to
// the raw code); 'legacy-full-name' carries a full name to exercise passthrough.
export const DEPARTMENT_VALUES = {
  lspd: 'lspd',
  lssd: 'lssd',
  sadcr: 'sadcr',
  dao: 'dao',
  lsfd: 'lsfd',
  unknown: 'XYZ',
  'legacy-full-name': 'Los Santos Police Department',
};

export const EXPECTED_DEPARTMENT_NAMES = {
  lspd: 'Los Santos Police Department',
  lssd: 'Los Santos County Sheriffs Department',
  sadcr: 'San Andreas Department of Corrections and Rehabilitation',
  dao: "District Attorney's Office",
  lsfd: 'Los Santos Fire Department',
  unknown: 'XYZ',
  'legacy-full-name': 'Los Santos Police Department',
};