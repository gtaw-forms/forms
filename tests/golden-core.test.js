// tests/golden-core.test.js
// Stage T2-C of the test-strategy plan: GOLDEN BBCode test that drives the PURE
// render core (src/utils/bbcodeRenderer.js) directly with the canonical inputs,
// bypassing the hook. Asserts (a) structural invariants (department full names
// render, no leftover {{...}} placeholders, BBCode tag balance reproduces the
// pinned template+generator deltas) and (b) the no-behavior-change proof:
// byte-identical output vs the T2-A pinned baselines
// (tests/fixtures/baseline-*.json), which were captured THROUGH the full hook
// pipeline. If the differential fails, the values fed here no longer mirror
// what the hook feeds the core.
//
// [OK] The pinned baselines are compared on { bbcode, finalTitle } only; the
// captured year is used to feed deps.year but is not itself compared.
//
// [OK] The hook's enrichment (credential formatting, placeholder init,
// currentYear) runs BEFORE the core. The canonical baseValues were chosen so
// that enrichment is a passthrough (employee values already in "(SN: ...)"
// form, all primitives, all placeholders present). This test therefore feeds
// ONLY baseValues + department + decedents — no placeholder-init, no
// currentYear — so the differential is apples-to-apples against the hook.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { renderBbcode } from '../src/utils/bbcodeRenderer';
import { getDepartmentFullName } from '../src/utils/bbcodeHelpers';
import generateDecedentBBCode from '../src/phmc-bbcode-generators/generateMassFatality';
import { assertTagBalance, DEPARTMENT_VALUES, EXPECTED_DEPARTMENT_NAMES } from './helpers/goldenUtils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));

const coronerForm = fixture('coroner-report.template.json');
const massForm = fixture('mass-fatality.template.json');
const canonical = fixture('canonical-inputs.json');
const coronerPinned = fixture('baseline-coroner-report.json');
const massPinned = fixture('baseline-mass-fatality.json');

// Canonical values mirrored from tests/capture-baseline.test.js so the
// differential is apples-to-apples with the hook oracle.
const valuesFor = (spec, code) => ({
  ...spec.baseValues,
  [spec.departmentField]: DEPARTMENT_VALUES[code],
  ...(spec.decedents ? { decedents: spec.decedents } : {}),
});

const coronerInfoFor = (spec) => ({
  coronerRank: spec.baseValues.coronerRank || spec.baseValues.phmcRank || 'Coroner',
  coronerEmployee:
    spec.baseValues.coronerEmployee ||
    spec.baseValues.phmcEmployee ||
    spec.baseValues.employeeName ||
    'Unknown Coroner',
});

const depsFor = (pinnedForCode) => ({
  getDepartmentFullName,
  generateDecedentBBCode,
  year: pinnedForCode.year,
});

const renderCore = (form, spec, code, pinnedForCode) =>
  renderBbcode({
    template: form.template,
    form: {
      name: form.name,
      id: form.id,
      firebaseKey: form.firebaseKey,
      fields: form.fields,
      titleGeneratorCode: form.titleGeneratorCode,
    },
    values: valuesFor(spec, code),
    coronerInfo: coronerInfoFor(spec),
    agencyDataStore: canonical.agencyDataStore,
    deps: depsFor(pinnedForCode),
  });

describe('T2-C golden core — coroner-report (pure renderBbcode)', () => {
  const spec = canonical.coronerReport;

  for (const code of canonical.departmentCodes) {
    it(`renders department '${code}' identically to the pinned hook baseline`, () => {
      const out = renderCore(coronerForm, spec, code, coronerPinned[code]);

      // 1. Full department names render (raw-code fallback + passthrough too).
      expect(out.bbcode, `[ERR] dept name not rendered for ${code}`).toContain(EXPECTED_DEPARTMENT_NAMES[code]);

      // 2. No leftover {{...}} placeholders.
      expect(out.bbcode, `[ERR] leftover placeholders for ${code}`).not.toMatch(/\{\{[^}]+\}\}/);

      // 3. Tag balance reproduces the pinned template deltas exactly.
      assertTagBalance(out.bbcode, coronerForm.template, null, null);

      // 4. Deterministic golden title from the pinned titleGeneratorCode.
      expect(out.finalTitle).toBe('[Suicide] John Doe ((JohnDoe_1999)) - 09/29/2026');

      // 5. Differential vs the T2-A pinned baseline (core no-behavior-change proof).
      expect({ bbcode: out.bbcode, finalTitle: out.finalTitle }).toEqual({
        bbcode: coronerPinned[code].bbcode,
        finalTitle: coronerPinned[code].finalTitle,
      });
    });
  }
});

describe('T2-C golden core — mass-fatality (pure renderBbcode)', () => {
  const spec = canonical.massFatality;

  for (const code of canonical.departmentCodes) {
    it(`renders department '${code}' identically to the pinned hook baseline`, () => {
      const out = renderCore(massForm, spec, code, massPinned[code]);
      const coronerInfo = coronerInfoFor(spec);

      expect(out.bbcode, `[ERR] dept name not rendered for ${code}`).toContain(EXPECTED_DEPARTMENT_NAMES[code]);
      expect(out.bbcode, `[ERR] leftover placeholders for ${code}`).not.toMatch(/\{\{[^}]+\}\}/);
      assertTagBalance(out.bbcode, massForm.template, spec.decedents, coronerInfo);

      expect(out.finalTitle).toBe('[Multi Fatality Report] John Doe | Jane Doe - 09/29/2026');

      expect({ bbcode: out.bbcode, finalTitle: out.finalTitle }).toEqual({
        bbcode: massPinned[code].bbcode,
        finalTitle: massPinned[code].finalTitle,
      });
    });
  }
});

// The core logs diagnostic chatter via console; silence around the renders and
// restore after so the runner output stays clean.
beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});