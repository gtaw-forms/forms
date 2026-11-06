// LSPD condensed Coroner Email — preview/save override (web).
//
// Coroner Emails for LSPD travel as a short portal notice, not the full BBCode
// document (the portal composer renders no BBCode). When the generator runs
// for the coroner_email form with an LSPD department, it returns this
// condensed text instead of the legacy template — so the preview, the saved
// BBCode and Copy BBCode all show exactly what the officer will receive.
//
// Pure module (no React, no env): unit-tested in tests/lspd-condensed.test.js.
import { normalizeDepartment } from '../components/migration-ui/viewModel';
import { buildReportUrl, PORTAL_BASE_URL } from '../components/report-share/shareLink';

/** True when the condensed override applies (Coroner Email form + LSPD). */
export function isLspdCondensedTarget(formKey, department) {
  return String(formKey || '') === 'coroner_email'
    && normalizeDepartment(department) === 'lspd';
}

/** Bare character name from a raw input or a { value, label } select. */
export function bareName(value) {
  if (value == null) return '';
  const raw = typeof value === 'object' ? (value.value || value.label || '') : String(value);
  return raw.trim();
}

const TITLE_PREFIX_RE = /^(coroner report|autopsy report|mass fatality report|coroner email)\s*-\s*/i;

/**
 * Idempotent decedent cleanup. Chained flows (an email attached to another
 * email) can stuff a whole prior title into the name field — without this
 * the next title stacks another prefix on top ("Coroner Report -
 * Coroner Report - …"). Strips stacked prefixes, [bracket] tags and trailing
 * dates; splits an inline ((ooc)) back out instead of doubling it.
 * Returns { name, ooc } (ooc falls back to the passed value).
 */
export function cleanDecedentField(rawName, rawOoc = '') {
  let name = String(rawName || '').trim();
  for (let i = 0; i < 3 && TITLE_PREFIX_RE.test(name); i++) {
    name = name.replace(TITLE_PREFIX_RE, '').trim();
  }
  name = name.replace(/^\[[^\]]+\]\s*/, '').trim();
  let ooc = String(rawOoc || '').trim();
  const inline = name.match(/^(.*?)\s*\(\((.*?)\)\)\s*(.*?)$/);
  if (inline) {
    const before = inline[1].trim();
    const inner = inline[2].trim();
    if (before) name = before;
    if (!ooc) ooc = inner;
  }
  name = name.replace(/\s*-?\s*\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/, '').trim();
  return { name, ooc };
}

/**
 * Identity fallback from the first attached report. Attaching a standard
 * report fills `additionalReports: [{ originalKey, formId, ... }]` but leaves
 * the email form's own decedent fields empty — parse
 * "[PK] John Doe ((JohnDoe_1999)) - 10/17/2026" (or mass titles) instead.
 */
const REPORT_KIND_LABEL = {
  'coroner-report': 'Coroner Report',
  autopsy: 'Autopsy Report',
  'mass-ftality-test': 'Mass Fatality Report',
  'mass-fatality': 'Mass Fatality Report',
};

export function parseAttachedIdentity(additionalReports) {
  const first = Array.isArray(additionalReports) ? additionalReports[0] : null;
  const key = typeof first === 'string' ? first : String(first?.originalKey || '').trim();
  const attachedAuthor = typeof first === 'object' && first !== null ? String(first.attachedAuthor || '').trim() : '';
  const attachedKey = typeof first === 'object' && first !== null ? String(first.attachedKey || '').trim() : '';
  const kind = typeof first === 'object' && first !== null
    ? (REPORT_KIND_LABEL[String(first.formId || '')] || '')
    : '';
  if (!key) {
    const idOnly = (attachedAuthor && attachedKey) ? { attachedAuthor, attachedKey } : {};
    return kind ? { reportKind: kind, ...idOnly } : idOnly;
  }
  let rest = key;
  let type = '';
  const bracket = rest.match(/^\[([^\]]+)\]\s*/);
  if (bracket) {
    type = bracket[1].trim();
    rest = rest.slice(bracket[0].length);
  }
  rest = rest.replace(/\s*-\s*\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/, '').trim();
  let name = rest;
  let ooc = '';
  const oocMatch = rest.match(/^(.*?)\s*\(\(\s*(.*?)\s*\)\)\s*$/);
  if (oocMatch) {
    name = oocMatch[1].trim();
    ooc = oocMatch[2].trim();
  }
  return {
    decedentName: name || '',
    decedentOOC: ooc,
    typeOfDeath: /^(PK|CK)$/i.test(type) ? type.toUpperCase() : '',
    reportKind: kind,
    attachedAuthor,
    attachedKey,
  };
}

/**
 * Build the condensed notice. Link priority: explicit `reportUrl` (bot path),
 * else the attached report's own identity (manual attach flow), else a
 * placeholder — never a faked link.
 */
export function buildLspdCondensedEmail(values = {}, { departmentFullName = '', reportUrl = '', filedDate = '', baseUrl = PORTAL_BASE_URL } = {}) {
  const officer = bareName(values.requestingOfficer) || 'requesting officer';
  const dept = String(departmentFullName || 'Los Santos Police Department');
  const rank = String(values.coronerRank || '').trim();
  const badge = String(values.coronerBadge || '').trim();
  const name = bareName(values.coronerEmployee) || 'PHMC Coroner';
  const coronerFull = [rank || 'Coroner', name].join(' ')
    + (badge ? ` (SN: ${badge})` : '');
  const attached = parseAttachedIdentity(values.additionalReports);
  const rawDecedent = String(values.decedentName || '').trim() || attached.decedentName || '';
  const rawOoc = String(values.decedentOOC || '').trim() || attached.decedentOOC || '';
  const cleaned = cleanDecedentField(rawDecedent, rawOoc);
  const decedent = cleaned.name;
  const ooc = cleaned.ooc;
  // Report line is the document kind, not the title: Coroner / Autopsy /
  // Mass Fatality Report (from the attached report's form, else the default).
  const reference = attached.reportKind || 'Coroner Report';
  // Link: explicit URL wins; else the attached report's own address (the
  // document the officer actually needs); else an honest placeholder.
  const attachedUrl = (attached.attachedAuthor && attached.attachedKey)
    ? buildReportUrl(attached.attachedAuthor, attached.attachedKey, baseUrl)
    : '';
  const viewLink = reportUrl || attachedUrl || '';
  // Every attached report is listed so the preview reflects multi-attach;
  // the first still drives the link and the reference line.
  const attachedAll = Array.isArray(values.additionalReports) ? values.additionalReports : [];
  const attachedLines = attachedAll.length > 1
    ? [
        `- Attached reports: **${attachedAll.length}**`,
        ...attachedAll.map((a) => `  - ${String(a.originalKey || 'Attached report').replace(/[[\]]/g, '').trim().slice(0, 100)}`),
      ]
    : [];
  const filed = String(filedDate || new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }));

  const lines = [
    `For the attention of: **${dept}** - **${officer}**`,
    '',
    'A Coroner Report has been finalized and is available to view on the PHMC portal.',
    '',
    `- Decedent: **${decedent || '—'}**${ooc ? ` (( ${ooc} ))` : ''}`,
    `- Report: **${reference}**`,
    `- Filed: **${filed}** by ${coronerFull}`,
    ...attachedLines,
    '',
    viewLink
      ? `**View the report:** ${viewLink}`
      : '**View the report:** (link is generated when the report is filed)',
    '',
    'If the link does not open for you, contact the Forensic Medicine and Pathology Department and quote the report above.',
    '',
    'Kind regards',
    name,
    'Pillbox Hill Medical Center - Forensic Medicine and Pathology',
  ];

  // Title follows the legacy Coroner Email template convention
  // (bbcodeRenderer.js): `Coroner Report - names (( ooc ))` — the subject
  // staff know, used for manual posts and saved-report titles.
  const nameList = decedent.split(',').map((n) => n.trim()).filter(Boolean).join(', ');
  const title = nameList && ooc
    ? `Coroner Report - ${nameList} (( ${ooc} ))`
    : nameList
      ? `Coroner Report - ${nameList}`
      : 'Coroner Report';
  return { bbcode: `${lines.join('\n')}\n`, finalTitle: title };
}
