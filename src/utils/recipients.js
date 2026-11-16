/**
 * Multi-recipient helpers — pure, dependency-free.
 *
 * One report can go to up to MAX_TOTAL_RECIPIENTS officers in a single save:
 * the primary (requestingOfficer + department) plus up to 4 extras stored as
 * data.additionalRecipients = [{ officer, department }].
 *
 * The bot ships an identical copy of this logic (discord-bot/services/
 * recipients.js) because src/ is not deployed to the VPS — keep the two in
 * sync when changing normalization rules.
 */

export const MAX_TOTAL_RECIPIENTS = 5;
export const MAX_EXTRA_RECIPIENTS = MAX_TOTAL_RECIPIENTS - 1;

const clean = (v) => String(v ?? '').trim();

/** Normalize one { officer, department } row into canonical shape (or null). */
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

/**
 * Full recipient list for a report's data: primary first, then extras.
 * Trims, drops empties, dedupes case-insensitively (extras matching the
 * primary are dropped), caps extras at MAX_EXTRA_RECIPIENTS.
 * Pure — exported for tests.
 */
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

/**
 * Validate a normalized list. Returns an array of human-readable problems
 * (empty = valid). Does NOT check roster membership — the OfficerSearch UI
 * already roster-validates at entry; this is the fail-closed save gate.
 */
export function validateRecipients(list) {
  const problems = [];
  if (!Array.isArray(list) || list.length === 0) {
    return ['No recipients — the primary requesting officer is empty.'];
  }
  if (list.length > MAX_TOTAL_RECIPIENTS) {
    problems.push(`Too many recipients (${list.length}) — maximum is ${MAX_TOTAL_RECIPIENTS}.`);
  }
  list.forEach((r, i) => {
    const label = i === 0 ? 'Primary officer' : `Additional officer ${i + 1}`;
    if (!r || !clean(r.officer)) problems.push(`${label}: name is empty.`);
    if (clean(r.officer).length < 3) problems.push(`${label}: name is too short to be a roster match.`);
  });
  return problems;
}
