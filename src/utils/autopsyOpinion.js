/**
 * CK autopsy quality gate — a Character Kill report is a permanent, reviewed
 * record, and a one-line "no findings" opinion is the exact thing reviewers
 * bounce. CK reports therefore need a substantive Medical Examiner opinion
 * (`synopsis`, the "Opinion (Medical Examiner's Synopsis)" field): more than
 * 250 characters. PK reports are unaffected.
 *
 * Pure module (no React/firebase) so the save guard, the field hint and the
 * tests all agree on one rule.
 */

/** CK opinions must be *more than* this many characters. */
export const CK_OPINION_MIN_MORE_THAN = 250;

/** Smallest passing length (251), derived so the copy stays "more than 250". */
export const CK_OPINION_REQUIRED_CHARS = CK_OPINION_MIN_MORE_THAN + 1;

/**
 * True when the report is marked CK. `deathType` is the autopsy form's Manner
 * of Death field; coroner reports use `typeOfDeath`, which is a different
 * classification and is deliberately not treated as CK here.
 */
export function isCkDeath(values = {}) {
  const raw = String(values?.deathType ?? '').trim().toUpperCase();
  return raw === 'CK';
}

/**
 * Length of the trimmed opinion — whitespace-only padding must not count
 * towards the minimum.
 */
export function opinionLength(values = {}) {
  return String(values?.synopsis ?? '').trim().length;
}

/**
 * Why a CK opinion is still too short, or null when it passes (or when the
 * report is not a CK at all).
 *
 * @returns {{ length: number, required: number, remaining: number } | null}
 */
export function ckOpinionProblem(values = {}) {
  if (!isCkDeath(values)) return null;
  const length = opinionLength(values);
  if (length >= CK_OPINION_REQUIRED_CHARS) return null;
  return { length, required: CK_OPINION_REQUIRED_CHARS, remaining: CK_OPINION_REQUIRED_CHARS - length };
}

/** Human sentence for the field hint / save block. */
export function ckOpinionMessage(values = {}) {
  const problem = ckOpinionProblem(values);
  if (!problem) return '';
  return `CK autopsies need an Opinion longer than ${CK_OPINION_MIN_MORE_THAN} characters — `
    + `${problem.length} so far, ${problem.remaining} more needed.`;
}
