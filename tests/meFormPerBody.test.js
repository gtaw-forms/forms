/**
 * LSPD ME liaison form — one filing per body in a shared mass collection.
 *
 * Case 561 (#10493, LS Freeway SADCR, 3 bodies) completed with every body
 * marked done but produced ZERO DRDB medical-examiner forms: the step was
 * deferred until the whole collection finished, and by then only the last
 * body's report was in hand — the other two were never filed. The step is now
 * per body (`lspdMedicalExaminerForm@<idx>`) and files as the body completes.
 */
import { describe, it, expect } from 'vitest';
import { meFormStepName, resolveBodyFilingData } from '../discord-bot/services/deployAutopsyReply.js';

describe('meFormStepName — per-body ME form steps', () => {
    it('keys each body of a shared collection separately', () => {
        expect(meFormStepName(true, 0)).toBe('lspdMedicalExaminerForm@0');
        expect(meFormStepName(true, 2)).toBe('lspdMedicalExaminerForm@2');
        expect(meFormStepName(true, '1')).toBe('lspdMedicalExaminerForm@1');
    });

    it('keeps the bare name for per-topic records and legacy paths', () => {
        expect(meFormStepName(false, 0)).toBe('lspdMedicalExaminerForm');
        expect(meFormStepName(true, null)).toBe('lspdMedicalExaminerForm');
        expect(meFormStepName(true, undefined)).toBe('lspdMedicalExaminerForm');
    });
});

describe('resolveBodyFilingData — the request body owns a mass decedent identity', () => {
    const report = (name, ooc) => ({ data: { decedentName: name, decedentOOC: ooc, placeOfDeath: 'Los Santos Freeway' } });

    it('fills a placeholder report identity from the body (live: Ricci)', () => {
        const out = resolveBodyFilingData(
            report('Unknown', 'PK'),
            { name: 'Cristian Ricci', oocName: 'PK' },
        );
        expect(out.data.decedentName).toBe('Cristian Ricci');
        // A PK/CK marker is a death type — never filed as an OOC name.
        expect(out.data.decedentOOC).toBe('');
        expect(out.data.placeOfDeath).toBe('Los Santos Freeway');
    });

    it('keeps a real report identity', () => {
        const src = report('Genevieve Kennedy', 'Elena Hill');
        expect(resolveBodyFilingData(src, { name: 'Genevieve Kennedy', oocName: '' })).toBe(src);
    });

    it("uses the body's OOC when the report has none", () => {
        const out = resolveBodyFilingData(report('Maya Zapata', ''), { name: 'Maya Zapata', oocName: 'Arthur Blackwood' });
        expect(out.data).toMatchObject({ decedentName: 'Maya Zapata', decedentOOC: 'Arthur Blackwood' });
    });

    it('drops an OOC that just repeats the IC name', () => {
        // Live: "Jane Doe ((Genevieve Kennedy))" reports — filing
        // "Genevieve Kennedy ((Genevieve Kennedy))" says nothing.
        const out = resolveBodyFilingData(report('Jane Doe', 'Genevieve Kennedy'), { name: 'Genevieve Kennedy', oocName: 'PK' });
        expect(out.data).toMatchObject({ decedentName: 'Genevieve Kennedy', decedentOOC: '' });
    });

    it('is a no-op outside a collection body or without a report', () => {
        const src = report('Unknown', 'PK');
        expect(resolveBodyFilingData(src, null)).toBe(src);
        expect(resolveBodyFilingData(null, { name: 'A' })).toBeNull();
    });
});
