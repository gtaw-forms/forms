/**
 * recipients.js — bot-side mirror of src/utils/recipients.js.
 *
 * Dependency-free on purpose (like lspdReportRoute.js): safe for the static
 * bot-import checker and unit-tested in tests/. src/ is NOT shipped to the
 * VPS, so this copy lives here — keep normalization rules in sync.
 */

export const MAX_TOTAL_RECIPIENTS = 5;
export const MAX_EXTRA_RECIPIENTS = MAX_TOTAL_RECIPIENTS - 1;

const clean = (v) => String(v ?? '').trim();

export function normalizeRecipientRow(row) {
  if (!row || typeof row !== 'object') return null;
  const officer = clean(row.officer ?? row.name);
  if (!officer) return null;
  const rawDept = row.department ?? row.dept ?? '';
  const department = typeof rawDept === 'object' && rawDept !== null
    ? clean(rawDept.value || rawDept.label)
    : clean(rawDept);
  return { officer, department };
}

export function normalizeRecipients(data = {}) {
  const primaryOfficer = clean(data.requestingOfficer ?? data.requesting_officer ?? data.officerName);
  const rawPrimaryDept = data.department ?? data.requestingOfficerDepartment ?? '';
  const primaryDept = typeof rawPrimaryDept === 'object' && rawPrimaryDept !== null
    ? clean(rawPrimaryDept.value || rawPrimaryDept.label)
    : clean(rawPrimaryDept);

  const out = [];
  const seen = new Set();
  if (primaryOfficer) {
    out.push({ officer: primaryOfficer, department: primaryDept });
    seen.add(primaryOfficer.toLowerCase());
  }
  const extras = Array.isArray(data.additionalRecipients) ? data.additionalRecipients : [];
  for (const row of extras) {
    if (out.length >= MAX_TOTAL_RECIPIENTS) break;
    const norm = normalizeRecipientRow(row);
    if (!norm) continue;
    const key = norm.officer.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(norm);
  }
  return out;
}
