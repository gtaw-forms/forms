import { describe, it, expect } from 'vitest';
import {
  DEMO_LEO_ROWS,
  filterDemoRecords,
  findDemoRecordPayload,
} from '../src/components/migration-ui/demoData';

describe('demo records feed (local preview)', () => {
  it('exposes the sample rows as the records feed', () => {
    const all = filterDemoRecords({});
    expect(all.length).toBe(DEMO_LEO_ROWS.length);
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((r) => r.demo && r.author === 'Demo_Author')).toBe(true);
  });

  it('filters by formId like the feed would', () => {
    expect(filterDemoRecords({ formId: 'coroner-report' }).every((r) => r.formId === 'coroner-report')).toBe(true);
    expect(filterDemoRecords({ formId: 'coroner-report' }).length).toBe(DEMO_LEO_ROWS.length - 1);
    const mass = filterDemoRecords({ formId: 'mass-ftality-test' });
    expect(mass.map((r) => r.key)).toEqual(['demo-mass-1']);
    expect(filterDemoRecords({ formId: 'autopsy' })).toEqual([]);
  });

  it('filters by free-text query over title/decedent/officer', () => {
    expect(filterDemoRecords({ q: 'reyes' }).map((r) => r.key)).toEqual(['demo-leo-1', 'demo-mass-1']);
    expect(filterDemoRecords({ q: 'elena' }).map((r) => r.key)).toEqual(['demo-leo-2']);
    expect(filterDemoRecords({ q: 'jane doe' }).map((r) => r.key)).toEqual(['demo-mass-1']);
    expect(filterDemoRecords({ q: 'no-such-person' })).toEqual([]);
  });

  it('resolves sample payloads only for the demo author', () => {
    const payload = findDemoRecordPayload('Demo_Author', 'demo-leo-1');
    expect(payload?.report?.formId).toBe('coroner-report');
    expect(payload?.report?.data?.decedentName).toBe('John Doe');
    const mass = findDemoRecordPayload('Demo_Author', 'demo-mass-1');
    expect(mass?.report?.formId).toBe('mass-ftality-test');
    expect(mass?.report?.data?.department).toBe('lspd');
    expect(mass?.report?.data?.decedents?.length).toBe(2);
    expect(mass?.report?.originalKey).toBe('[Mass Fatality Report] John Doe, Jane Doe - 10/13/2026');
    expect(findDemoRecordPayload('Demo_Author', 'nope')).toBeNull();
    expect(findDemoRecordPayload('Alyson_Frost', 'demo-leo-1')).toBeNull();
  });
});
