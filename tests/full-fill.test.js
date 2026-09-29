// tests/full-fill.test.js
// Full-form golden test: EVERY coroner-report input populated at once
// (tests/fixtures/full-fill-coroner.json), rendered through the PURE
// renderBbcode core for every department code. Asserts full department
// names, zero leftover placeholders, tag balance, the pinned lspd golden,
// and the override-matrix edge (unknown code + legacy full name).
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
const fullFill = fixture('full-fill-coroner.json');
const canonical = fixture('canonical-inputs.json');
const pinned = fixture('baseline-full-fill-coroner.json');

const valuesFor = (code) => ({
    ...fullFill.baseValues,
    [fullFill.departmentField]: DEPARTMENT_VALUES[code],
});

const coronerInfo = {
    coronerRank: fullFill.baseValues.coronerRank,
    coronerEmployee: fullFill.baseValues.coronerEmployee,
};

const renderFull = (code) =>
    renderBbcode({
        template: coronerForm.template,
        form: {
            name: coronerForm.name,
            id: coronerForm.id,
            firebaseKey: coronerForm.firebaseKey,
            fields: coronerForm.fields,
            titleGeneratorCode: coronerForm.titleGeneratorCode,
        },
        values: valuesFor(code),
        coronerInfo,
        agencyDataStore: canonical.agencyDataStore,
        deps: { getDepartmentFullName, generateDecedentBBCode, year: '2026' },
    });

describe('full-fill coroner-report — every input populated', () => {
    for (const code of Object.keys(DEPARTMENT_VALUES)) {
        it(`renders '${code}' with full names, no leftovers, balanced tags`, () => {
            const out = renderFull(code);

            // 1. Full department name (covers the raw-code BBCode regression).
            expect(out.bbcode, `[ERR] dept name not rendered for ${code}`).toContain(EXPECTED_DEPARTMENT_NAMES[code]);
            // 1b. Raw short codes never leak into bold output slots (only
            // applies to real short codes; 'unknown'/'legacy-full-name' are
            // escape hatches by design).
            if (['lspd', 'lssd', 'sadcr', 'dao', 'lsfd'].includes(code)) {
                expect(
                    out.bbcode,
                    `[ERR] raw code leaked for ${code}`
                ).not.toContain(`[bold]${DEPARTMENT_VALUES[code]}[/bold]`);
            }

            // 2. No leftover {{...}} placeholders.
            expect(out.bbcode, `[ERR] leftover placeholders for ${code}`).not.toMatch(/\{\{[^}]+\}\}/);

            // 3. Tag balance matches the pinned template deltas exactly.
            assertTagBalance(out.bbcode, coronerForm.template, null, null);

            // 4. Every populated input surfaces in the output.
            for (const needle of [
                '123 Grove Street, Davis',
                'Sergeant Maria Reyes',
                'Jane Rider',
                'EL#2026-001',
                'https://example.test/photo1.jpg',
                'https://example.test/additional2.jpg',
                'Overview and close-up of the vehicle interior.',
            ]) {
                expect(out.bbcode, `[ERR] populated input missing for ${code}: ${needle}`).toContain(needle);
            }
        });
    }

    it('matches the pinned lspd golden byte-for-byte', () => {
        const out = renderFull('lspd');
        expect({ bbcode: out.bbcode, finalTitle: out.finalTitle }).toEqual({
            bbcode: pinned.bbcode,
            finalTitle: pinned.finalTitle,
        });
    });
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
