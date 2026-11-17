/**
 * lspdReportRoute.js — "Is this an LSPD Coroner or Mass Fatality report?"
 *
 * Single home for the LSPD portal routing decision. Both the enqueue path
 * (deployCoronerEmail.handleCoronerEmail) and the predicates it shares go
 * through this module so routing cannot drift apart. Inbox notice copy was
 * removed Nov 2026 (LSPD takes no inbox notices — their portal replaced
 * them); LSPD delivery is the native form filings plus the share links.
 *
 * Deliberately dependency-free (no discord.js, no playwright, no env reads
 * at import time): unit-tested in tests/lspd-report-route.test.js and safe
 * for the static bot-import checker.
 *
 * Routing rule: formId is coroner-report, mass-fatality or mass-ftality-test
 * AND the department normalises to lspd. Every other department keeps the
 * legacy phpBB forum-PM path untouched.
 */

export const PORTAL_FORM_IDS = ['coroner-report', 'mass-fatality', 'mass-ftality-test'];

/** Canonical public site; hosting moves override via PHMC_SITE_URL env. */
export const PORTAL_BASE_URL = 'https://gtaw-forms.github.io/forms/';

const DEPARTMENT_BY_KEY = {
  lspd: 'Los Santos Police Department',
  lssd: "Los Santos Sheriff's Department",
  sadcr: 'San Andreas Department of Corrections and Rehabilitation',
  dao: "District Attorney's Office",
  lsfd: 'Los Santos Fire Department',
  saaa: 'San Andreas Aviation Administration',
};

const DEPARTMENT_BY_NAME = {
  ...Object.fromEntries(
    Object.entries(DEPARTMENT_BY_KEY).map(([key, label]) => [label.toLowerCase(), key]),
  ),
  'los santos county sheriffs department': 'lssd',
  "los santos county sheriff's department": 'lssd',
  'district attorney’s office': 'dao',
};

/** Normalise a department key ("LSPD"), object ({value}) or legacy full name. */
export function normalizeDepartment(value) {
  const raw = (typeof value === 'object' && value !== null
    ? (value.value || value.label || '')
    : String(value ?? '')).trim().toLowerCase();
  if (!raw) return '';
  if (DEPARTMENT_BY_KEY[raw]) return raw;
  return DEPARTMENT_BY_NAME[raw] || '';
}

/** Full agency name for a department value (falls back to the raw string). */
export function departmentFullName(value) {
  const key = normalizeDepartment(value);
  if (key) return DEPARTMENT_BY_KEY[key];
  const raw = (typeof value === 'object' && value !== null
    ? (value.label || value.value || '')
    : String(value ?? '')).trim();
  return raw || 'Unknown Department';
}

/**
 * True when this report must travel the LSPD portal path (native form
 * filing) instead of the legacy forum-PM email.
 */
export function isLspdPortalReport({ formId = '', data = {} } = {}) {
  if (!PORTAL_FORM_IDS.includes(String(formId || ''))) return false;
  return normalizeDepartment(data?.department) === 'lspd';
}

/**
 * True when a manually filed coroner EMAIL must travel the LSPD portal path
 * (native form filing) instead of the legacy forum-PM email.
 */
export function isLspdEmailReport({ formId = '', data = {} } = {}) {
  if (String(formId || '') !== 'coroner_email') return false;
  return normalizeDepartment(data?.department) === 'lspd';
}

/**
 * Absolute deep link to one saved report. Fail-closed: '' when either
 * segment is missing, so callers can refuse to send a dead link.
 */
export function buildReportUrl(authorId, reportKey, baseUrl = PORTAL_BASE_URL) {
  const author = String(authorId ?? '').trim();
  const key = String(reportKey ?? '').trim();
  if (!author || !key) return '';
  const base = String(baseUrl || PORTAL_BASE_URL).trim() || PORTAL_BASE_URL;
  const clean = base.endsWith('/') ? base : `${base}/`;
  return `${clean}#/report/${encodeURIComponent(author)}/${encodeURIComponent(key)}`;
}

/**
 * Absolute SHORT link (`#/r/<code>`). Prefer portalReportUrl
 * (services/reportLink.js): same shape with automatic index fallback.
 */
export function buildShortReportUrl(code, baseUrl = PORTAL_BASE_URL) {
  const cleanCode = String(code ?? '').trim();
  if (!cleanCode) return '';
  const base = String(baseUrl || PORTAL_BASE_URL).trim() || PORTAL_BASE_URL;
  const clean = base.endsWith('/') ? base : `${base}/`;
  return `${clean}#/r/${cleanCode}`;
}
