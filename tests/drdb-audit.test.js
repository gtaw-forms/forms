import { describe, it, expect, beforeEach } from 'vitest';
import {
  DRDB_SEND_SOURCE,
  buildDrdbSendLine,
  parseAuditLine,
  isDrdbSentInLines,
  loadDrdbSentSet,
  isDrdbSent,
  getDrdbSentSet,
  _resetDrdbSentCache,
  drdbReportId,
} from '../discord-bot/services/drdbAudit.js';

const SEND = '2026-11-10T06:53:23.741Z | viewer=LSPD DRDB | viewerSource=send | verifiedViewer=none | oauth=phmc-bot | uid=bot | report=Alyson_Frost/_PK_John_Doe_Wayne_Stryker_10_29_2026_1793312499031 | title=[PK] John Doe ((Wayne Stryker)) 10/29/2026 | agency=lspd | source=portal-send | ip=127.0.0.1 | recipient=Jada Griffin | formUrl=https://lspd.gta.world/portal/x | reference=CR-26-0001';
const OFFICER_VIEW = '2026-11-10T06:53:51.647Z | viewer=Connor Kennedy | viewerSource=client | verifiedViewer=Connor Kennedy | oauth=Jesso | uid=gtaw:213029 | report=Alyson_Frost/_PK_John_Doe_Wayne_Stryker_10_29_2026_1793312499031 | title=[PK] John Doe ((Wayne Stryker)) 10/29/2026 | agency=lspd | source=live | ip=2001:1a10:1880:b701:adaf:69bf:b027:a488';

describe('drdbAudit — send line', () => {
  it('builds a pipe-delimited line with the portal-send source', () => {
    const line = buildDrdbSendLine({
      author: 'Alyson_Frost',
      key: '_PK_John_Doe_Wayne_Stryker_10_29_2026_1793312499031',
      title: '[PK] John Doe ((Wayne Stryker)) 10/29/2026',
      recipient: 'Jada Griffin',
      formUrl: 'https://lspd.gta.world/portal/x',
    });
    expect(line).toContain('source=portal-send');
    expect(line).toContain('report=Alyson_Frost/_PK_John_Doe_Wayne_Stryker_10_29_2026_1793312499031');
    expect(line).toContain('viewer=LSPD DRDB');
    expect(line).toContain('recipient=Jada Griffin');
  });

  it('sanitizes the audit identity like the on-disk store', () => {
    expect(drdbReportId('Alyson_Frost', 'a(b)c')).toBe('Alyson_Frost/abc');
    const line = buildDrdbSendLine({ author: 'A b', key: 'k(1)' });
    expect(line).toContain('report=Ab/k1');
  });

  it('strips control characters (log-injection defense)', () => {
    const line = buildDrdbSendLine({ author: 'a', key: 'k', title: 'x\nINJECTED=y' });
    expect(line).not.toContain('\nINJECTED');
  });
});

describe('drdbAudit — derivation', () => {
  const author = 'Alyson_Frost';
  const key = '_PK_John_Doe_Wayne_Stryker_10_29_2026_1793312499031';

  it('marks sent on a portal-send record', () => {
    expect(isDrdbSentInLines([SEND], author, key)).toBe(true);
  });

  it('does NOT mark sent on an officer view alone', () => {
    expect(isDrdbSentInLines([OFFICER_VIEW], author, key)).toBe(false);
  });

  it('marks sent when the DRDB integration pulls directly', () => {
    const pull = OFFICER_VIEW.replace('viewer=Connor Kennedy', 'viewer=lspd-drdb-leo').replace('source=live', 'source=live');
    expect(isDrdbSentInLines([pull], author, key)).toBe(true);
  });

  it('ignores other reports and garbage lines', () => {
    expect(isDrdbSentInLines([SEND], 'Someone_Else', 'other')).toBe(false);
    expect(isDrdbSentInLines(['', 'garbage without fields', 'report=nope | source=portal-send'], author, key)).toBe(false);
    expect(isDrdbSentInLines([], author, key)).toBe(false);
    expect(isDrdbSentInLines([SEND], '', '')).toBe(false);
  });

  it('parses k=v fields tolerantly (values may contain =)', () => {
    const parsed = parseAuditLine('2026-11-10T00:00:00.000Z | viewer=a=b | report=A/K | source=portal-send | extra');
    expect(parsed).toEqual({ report: 'A/K', source: 'portal-send', viewer: 'a=b' });
    expect(parseAuditLine('no fields here')).toEqual({ report: '', source: '', viewer: '' });
  });
});

describe('drdbAudit — log file set', () => {
  beforeEach(() => _resetDrdbSentCache());

  it('returns an empty set for a missing log (pre-DRDB reports read false)', async () => {
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'drdb-'));
    expect(loadDrdbSentSet(join(dir, 'nope.log')).size).toBe(0);
    expect(isDrdbSent('A', 'K', join(dir, 'nope.log'))).toBe(false);
  });

  it('loads sent identities from a log file and caches by mtime', async () => {
    const { mkdtempSync, writeFileSync, appendFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'drdb-'));
    const log = join(dir, 'leo-report-access.log');
    writeFileSync(log, `${OFFICER_VIEW}\n${SEND}\n`);
    expect(isDrdbSent('Alyson_Frost', '_PK_John_Doe_Wayne_Stryker_10_29_2026_1793312499031', log)).toBe(true);
    expect(isDrdbSent('Nobody', 'Else', log)).toBe(false);
    // Cache hit: same Set object while the file is unchanged.
    expect(getDrdbSentSet(log)).toBe(getDrdbSentSet(log));
    appendFileSync(log, '2026-11-11T00:00:00.000Z | viewer=LSPD DRDB | report=New_Guy/NK1 | source=portal-send\n');
    expect(isDrdbSent('New_Guy', 'NK1', log)).toBe(true);
  });
});

describe('drdbAudit — send source constant', () => {
  it('uses the portal-send marker', () => {
    expect(DRDB_SEND_SOURCE).toBe('portal-send');
  });
});
