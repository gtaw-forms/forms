// tests/capture-baseline.test.js
// Stages T2-A/T2-B of the test-strategy plan: render useBbcodeGenerator
// (src/hooks/useBbcodeGenerator.js) for the coroner-report and mass-fatality
// templates across 7 canonical department inputs and pin/compare a reproducible
// BASELINE.
//
// T2-A pinned the goldens in tests/fixtures/baseline-*.json. T2-B flipped this
// harness into a no-behavior-change ORACLE: once a pinned baseline file exists,
// each run asserts the rendered { bbcode, finalTitle } is byte-identical to the
// pinned golden (year is compared only at capture time, so the oracle is
// year-stable). If the hook's behavior changes, the assertion fails — that is
// the intended signal.
//
// [OK] The baseline file is only WRITTEN on first-run bootstrap when the pinned
// file is MISSING (JSON.stringify(baseline, null, 2), 2-space indent).
//
// [OK] This file renders the CURRENT hook in jsdom and asserts structure on
// every fresh capture (proving current behavior is correct on these inputs).
//
// [OK] Known, PRE-EXISTING tag imbalances live in the pinned inputs themselves
// (not the harness):
//   - coroner template line "[center][bold]B. PHOTOGRAPHIC DOCUMENTARY
//     RECORD[/center]" opens [bold] without a close;
//   - both templates' section D privacy body opens [center] and never closes it
//     (phpBB auto-closes at end of message, so reports still render);
//   - generateMassFatality.js opens "[altspoiler=N - NAME - OOC X]" per decedent
//     without [/altspoiler], and "[center][bold]DECEDENT DOCUMENTARY
//     RECORD[/center]" without [/bold].
// The tag-balance assertion therefore reproduces the pinned template+generator
// deltas exactly (never masks drift) and asserts strict balance for every tag
// the pinned inputs keep balanced.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import useBbcodeGenerator from '../src/hooks/useBbcodeGenerator';
import generateDecedentBBCode from '../src/phmc-bbcode-generators/generateMassFatality';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));

// Read a pinned baseline file, or null when it does not exist yet (bootstrap).
const readBaselineOrNull = (name) => {
  const filePath = path.join(__dirname, 'fixtures', name);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

// Compare the freshly rendered bbcode+finalTitle against the pinned golden.
// `year` is intentionally ignored so the oracle is year-stable.
const assertMatchesPinned = (out, pinnedForCode) => {
  expect({ bbcode: out.bbcode, finalTitle: out.finalTitle }).toEqual({
    bbcode: pinnedForCode.bbcode,
    finalTitle: pinnedForCode.finalTitle,
  });
};

const coronerForm = fixture('coroner-report.template.json');
const massForm = fixture('mass-fatality.template.json');
const canonical = fixture('canonical-inputs.json');

// Department short code -> raw value fed into the template's
// {{getDepartmentFullName(formData.department, agencyDataStore)}} placeholder.
// 'unknown' carries the literal code "XYZ" (getDepartmentFullName falls back to
// the raw code); 'legacy-full-name' carries a full name to exercise passthrough.
const DEPARTMENT_VALUES = {
  lspd: 'lspd',
  lssd: 'lssd',
  sadcr: 'sadcr',
  dao: 'dao',
  lsfd: 'lsfd',
  unknown: 'XYZ',
  'legacy-full-name': 'Los Santos Police Department',
};

const EXPECTED_DEPARTMENT_NAMES = {
  lspd: 'Los Santos Police Department',
  lssd: 'Los Santos County Sheriffs Department',
  sadcr: 'San Andreas Department of Corrections and Rehabilitation',
  dao: "District Attorney's Office",
  lsfd: 'Los Santos Fire Department',
  unknown: 'XYZ',
  'legacy-full-name': 'Los Santos Police Department',
};

// Non-null user with an OAuth faction -> isLocalInstance is false, so the local
// fallbacks (LocalEmployee/LocalRank) never stamp; values are pre-filled anyway.
const GTAW_USER = {
  username: 'john_doe',
  faction: { characterName: 'John Doe', rank: 'Coroner Investigator' },
};

// ---------------------------------------------------------------------------
// BBCode tag balance helpers
// ---------------------------------------------------------------------------
// phpBB tags checked for balance. Self-closing [hr], [br], [*] and tags the
// pinned inputs do not emit ([url], [spoiler], [cbc], [cb]) are fine to keep in
// the set — they are asserted as balanced at 0/0. [color] (emitted by the
// decedent generator for the morgue-unavailable line) is intentionally NOT in
// the set.
const TAG_SET = ['b', 'i', 'u', 'size', 'url', 'img', 'center', 'divbox', 'list', 'spoiler', 'altspoiler', 'cbc', 'cb', 'bold'];
const openRe = (tag) => new RegExp(`\\[${tag}(?:=[^\\]]*)?\\]`, 'gi');
const closeRe = (tag) => new RegExp(`\\[/${tag}\\]`, 'gi');
const tagCount = (s, tag) => ({
  open: (s.match(openRe(tag)) || []).length,
  close: (s.match(closeRe(tag)) || []).length,
});

// Expected open-minus-close delta per tag, computed from the pinned inputs the
// hook consumes verbatim: the template plus (for mass) the decedent block the
// generator splices in. The rendered output must reproduce these deltas exactly.
const pinnedTagDeltas = (template, decedents, coronerInfo) => {
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

const assertTagBalance = (bbcode, template, decedents, coronerInfo) => {
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

// ---------------------------------------------------------------------------
// Render harness — mounts a component that calls generateBBCode() once and
// stashes the synchronous { bbcode, finalTitle } return value.
// ---------------------------------------------------------------------------
let lastResult = null;

function Harness(props) {
  const { generateBBCode } = useBbcodeGenerator(
    props.selectedForm,
    props.formValues,
    props.finalSelectOptions,
    props.agencyDataStore,
    props.gtaWorldUser,
    props.factionsData,
    props.factionListData,
    props.resolvedCredentials
  );
  useEffect(() => {
    lastResult = generateBBCode();
  }, [generateBBCode]);
  return null;
}

const renderOnce = (props) => {
  lastResult = null;
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => {
    root.render(React.createElement(Harness, props));
  });
  act(() => {
    root.unmount();
  });
  container.remove();
  return lastResult;
};

const formValuesFor = (spec, code) => ({
  ...spec.baseValues,
  [spec.departmentField]: DEPARTMENT_VALUES[code],
  ...(spec.decedents ? { decedents: spec.decedents } : {}),
});

const commonProps = (form, formValues) => ({
  selectedForm: form,
  formValues,
  finalSelectOptions: {},
  agencyDataStore: canonical.agencyDataStore,
  gtaWorldUser: GTAW_USER,
  factionsData: {},
  factionListData: [],
  resolvedCredentials: null,
});

// ---------------------------------------------------------------------------
describe('T2-A/T2-B baseline oracle — coroner-report', () => {
  it('renders current hook for every department, asserts structure, compares/pins baseline', () => {
    const spec = canonical.coronerReport;
    const pinned = readBaselineOrNull('baseline-coroner-report.json');
    const baseline = {};

    for (const code of canonical.departmentCodes) {
      const out = renderOnce(commonProps(coronerForm, formValuesFor(spec, code)));
      const year = new Date().getFullYear();

      expect(out, `[ERR] generateBBCode returned nothing for ${code}`).toBeTruthy();
      expect(typeof out.bbcode, `[ERR] bbcode missing for ${code}`).toBe('string');
      expect(out.bbcode.length, `[ERR] bbcode empty for ${code}`).toBeGreaterThan(0);

      // 1. Full department names render (raw-code fallback + passthrough too).
      expect(out.bbcode, `[ERR] dept name not rendered for ${code}`).toContain(EXPECTED_DEPARTMENT_NAMES[code]);

      // 2. No leftover {{...}} placeholders.
      expect(out.bbcode, `[ERR] leftover placeholders for ${code}`).not.toMatch(/\{\{[^}]+\}\}/);

      // 3. Tag balance reproduces the pinned template deltas exactly.
      assertTagBalance(out.bbcode, coronerForm.template, null, null);

      // Deterministic golden title from the pinned titleGeneratorCode.
      expect(out.finalTitle).toBe('[Suicide] John Doe ((JohnDoe_1999)) - 09/29/2026');

      // 4. Compare against the pinned golden (or bootstrap-capture on first run).
      if (pinned) {
        assertMatchesPinned(out, pinned[code]);
      } else {
        baseline[code] = { bbcode: out.bbcode, finalTitle: out.finalTitle, year };
      }
    }

    // Bootstrap only: write the golden when no pinned baseline exists yet.
    if (!pinned) {
      fs.writeFileSync(
        path.join(__dirname, 'fixtures', 'baseline-coroner-report.json'),
        JSON.stringify(baseline, null, 2)
      );
    }
  });
});

describe('T2-A/T2-B baseline oracle — mass-fatality', () => {
  it('renders current hook for every department, asserts structure, compares/pins baseline', () => {
    const spec = canonical.massFatality;
    const coronerInfo = {
      coronerRank: spec.baseValues.coronerRank || spec.baseValues.phmcRank || 'Coroner',
      coronerEmployee: spec.baseValues.coronerEmployee || spec.baseValues.phmcEmployee || spec.baseValues.employeeName || 'Unknown Coroner',
    };
    const pinned = readBaselineOrNull('baseline-mass-fatality.json');
    const baseline = {};

    for (const code of canonical.departmentCodes) {
      const out = renderOnce(commonProps(massForm, formValuesFor(spec, code)));
      const year = new Date().getFullYear();

      expect(out, `[ERR] generateBBCode returned nothing for ${code}`).toBeTruthy();
      expect(typeof out.bbcode, `[ERR] bbcode missing for ${code}`).toBe('string');
      expect(out.bbcode.length, `[ERR] bbcode empty for ${code}`).toBeGreaterThan(0);

      expect(out.bbcode, `[ERR] dept name not rendered for ${code}`).toContain(EXPECTED_DEPARTMENT_NAMES[code]);
      expect(out.bbcode, `[ERR] leftover placeholders for ${code}`).not.toMatch(/\{\{[^}]+\}\}/);
      assertTagBalance(out.bbcode, massForm.template, spec.decedents, coronerInfo);

      expect(out.finalTitle).toBe('[Multi Fatality Report] John Doe | Jane Doe - 09/29/2026');

      // 4. Compare against the pinned golden (or bootstrap-capture on first run).
      if (pinned) {
        assertMatchesPinned(out, pinned[code]);
      } else {
        baseline[code] = { bbcode: out.bbcode, finalTitle: out.finalTitle, year };
      }
    }

    // Bootstrap only: write the golden when no pinned baseline exists yet.
    if (!pinned) {
      fs.writeFileSync(
        path.join(__dirname, 'fixtures', 'baseline-mass-fatality.json'),
        JSON.stringify(baseline, null, 2)
      );
    }
  });
});

// Silence the hook's debug chatter (Sentry/diagnostic paths also log), keep the
// runner output clean. Restored after all tests so later files are unaffected.
beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});