// Migration UI — the new PHMC platform shell.
// 1:1 with plan/coroner-report-handoff/mock-site.html: sidebar + topbar +
// records / report / create views, extended with View Morgue Records and
// View LEO Reports. Route: /migration-ui. Reports save through the SAME
// Firebase flow as the legacy app (bot deploy behaviour unchanged).
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { database } from '../../firebase';
import { useData } from '../../contexts/DataContext';
import { useNotification } from '../../contexts/NotificationContext';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import useBbcodeGenerator from '../../hooks/useBbcodeGenerator';
import { useFormSaver } from '../../hooks/useFormSaver';
import { useConsent } from '../../hooks/useConsent';
import { triggerLogReportView } from '../../services/firebaseFunctions';
import { resolveEmployeeCredentials } from '../../utils/identityUtils';
import { cleanRankText } from '../../utils/textUtils';
import {
  MIGRATION_FORM_IDS, kindFromFormId, recordTitle,
} from './viewModel';
import { buildShortReportUrl } from '../report-share/shareLink';
import { useMigrationRecords, PAGE_SIZE, FILTERS } from './useMigrationRecords';
import ReportView from './ReportView';
import LspdGuideModal from './LspdGuideModal';
import { hasSeenLspdGuide, markLspdGuideSeen } from './lspdGuide';
import { detailTitle } from './ReportDetail';
import CreateCoroner, { emptyCoronerValues } from './CreateCoroner';
import CreateMass, { emptyMassValues } from './CreateMass';
import CreateAutopsy, { emptyAutopsyValues } from './CreateAutopsy';
import CreateEmail, { emptyEmailValues } from './CreateEmail';
import MorgueView from './MorgueView';
import LeoView from './LeoView';
import AssignedAutopsiesModal from '../Modals/AssignedAutopsiesModal';
import { oocFromParsedName } from '../../utils/doePlaceholders';
import { useLeoReports } from './useLeoReports';

const KIND_LABEL = { coroner: 'Coroner', mass: 'Mass Fatality', autopsy: 'Autopsy', email: 'Email' };
const KIND_TO_FILTER = { coroner: 'coroner', mass: 'mass', autopsy: 'autopsy', email: 'email' };
const CREATE_TYPES = [
  { kind: 'coroner', label: 'Coroner' },
  { kind: 'mass', label: 'Mass Fatality' },
  { kind: 'autopsy', label: 'Autopsy' },
  { kind: 'email', label: 'Email' },
];
const CONSENT_FORMS = [
  { id: 'coroner-report', label: 'Coroner Report' },
  { id: 'mass-ftality-test', label: 'Mass Fatality' },
  { id: 'autopsy', label: 'Autopsy' },
  { id: 'coroner_email', label: 'Coroner Email' },
];
// Last reportsDataVersion this browser refreshed for. Stored so a report saved
// while the app was closed is picked up on the next load, not after the TTL.
const REPORTS_VERSION_STORAGE_KEY = 'phmc_reportsDataVersion';

export default function MigrationUI() {
  const { showNotification, removeNotification } = useNotification();
  const { formsData, agencyDataStore, factionsData, factionListData, loadMorgueRecords } = useData();
  const {
    user, isAuthenticated, characterName, login, logout, swapCharacter,
    swappableCharacters, canSwapCharacters, factionData,
  } = useGtaWorldAuth();

  const [view, setView] = useState('records'); // records | report | create | morgue | leo
  const [createKind, setCreateKind] = useState('coroner');
  const [drafts, setDrafts] = useState({
    coroner: emptyCoronerValues(),
    mass: emptyMassValues(),
    autopsy: emptyAutopsyValues(),
    email: emptyEmailValues(),
  });
  const [detail, setDetail] = useState(null); // { kind, values, title, meta, raw }
  const [detailLoading, setDetailLoading] = useState(false);
  const [datasetNotice, setDatasetNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [recordsNotice, setRecordsNotice] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const [showAssignments, setShowAssignments] = useState(false);
  const [autopsyCase, setAutopsyCase] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const rec = useMigrationRecords({ liveRefresh: isAuthenticated });
  // LEO audit display name: Auth claims only carry a PHMC faction character, so
  // fall back to the OAuth character list for non-PHMC law-enforcement users.
  const leoCharacterName = characterName
    || user?.activeCharacter?.characterName
    || user?.faction?.characterName
    || user?.character?.[0]?.name
    || user?.character?.[0]?.characterName
    || user?.characters?.[0]?.name
    || user?.characters?.[0]?.characterName
    || '';
  const leo = useLeoReports({
    enabled: isAuthenticated,
    active: view === 'leo',
    characterName: leoCharacterName,
  });
  const { consent, setConsent } = useConsent();

  // Live-feed invalidation: the VPS bumps appMetadata/reportsDataVersion
  // whenever the saved-report store changes (another user saved/deleted a
  // report). Refetch instead of waiting for the 5-minute cache TTL.
  const reportsVersionRef = useRef(null);
  const reportsVersionSeenRef = useRef(false);
  const recRef = useRef(rec);
  recRef.current = rec;
  const leoRef = useRef(leo);
  leoRef.current = leo;

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const versionRef = ref(database, 'appMetadata/reportsDataVersion');
    const unsubscribe = onValue(versionRef, (snapshot) => {
      const version = snapshot.val();
      // The first callback is the initial snapshot, not a live change. Compare
      // it with the version last seen in this browser: a report saved while the
      // app was closed (or before this build existed) must still invalidate.
      if (!reportsVersionSeenRef.current) {
        reportsVersionSeenRef.current = true;
        reportsVersionRef.current = version;
        if (version == null) return;
        let previous = null;
        try {
          const raw = localStorage.getItem(REPORTS_VERSION_STORAGE_KEY);
          previous = raw == null ? null : Number(raw);
        } catch { /* storage unavailable — treat as first run */ }
        try { localStorage.setItem(REPORTS_VERSION_STORAGE_KEY, String(version)); } catch { /* ignore */ }
        if (previous == null || previous !== Number(version)) {
          recRef.current?.invalidateAndRefresh?.();
          leoRef.current?.invalidate?.();
        }
        return;
      }
      if (version == null) return;
      if (version === reportsVersionRef.current) return;
      reportsVersionRef.current = version;
      try { localStorage.setItem(REPORTS_VERSION_STORAGE_KEY, String(version)); } catch { /* ignore */ }
      recRef.current?.invalidateAndRefresh?.();
      leoRef.current?.invalidate?.();
    }, (error) => {
      console.warn('[MigrationUI] reportsDataVersion listener failed:', error?.message || error);
    });
    return () => unsubscribe();
  }, [isAuthenticated]);

  // Close the account menu on an outside click.
  useEffect(() => {
    if (!userMenuOpen) return undefined;
    const onDown = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [userMenuOpen]);

  const handleSignIn = useCallback(() => {
    setUserMenuOpen(false);
    login({
      role: 'employee',
      onError: (message) => showNotification(`Sign in failed: ${message}`, 'error'),
    });
  }, [login, showNotification]);

  const handleSignOut = useCallback(() => {
    setUserMenuOpen(false);
    logout();
    window.location.reload();
  }, [logout]);

  // Loading toasts: feed/tab navigation that hits Firebase/VPS announces
  // itself (sticky, removed on settle) so a slow load never looks dead.
  // Inline notices remain the source of truth; toasts are just the signal.
  const feedToastRef = useRef(null);
  useEffect(() => {
    if (rec.loading && isAuthenticated) {
      if (!feedToastRef.current) {
        feedToastRef.current = showNotification('Loading records…', 'spinner fa-spin', 0);
      }
    } else if (feedToastRef.current) {
      removeNotification(feedToastRef.current);
      feedToastRef.current = null;
    }
  }, [rec.loading, isAuthenticated, showNotification, removeNotification]);
  const leoToastRef = useRef(null);
  useEffect(() => {
    if (leo.loading && isAuthenticated && !leo.demoMode) {
      if (!leoToastRef.current) {
        leoToastRef.current = showNotification('Loading LEO reports…', 'spinner fa-spin', 0);
      }
    } else if (leoToastRef.current) {
      removeNotification(leoToastRef.current);
      leoToastRef.current = null;
    }
  }, [leo.loading, isAuthenticated, leo.demoMode, showNotification, removeNotification]);

  // First 25 load only once signed in (the callable requires auth).
  useEffect(() => {
    if (isAuthenticated) rec.fetchPage({ nextOffset: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Deep links (share-page sidebar, portal notices): ?view=leo|morgue|records
  // and ?filter=coroner|mass|autopsy. Applied when the params change — never
  // fights in-app navigation, which doesn't touch the URL.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const view = searchParams.get('view');
    const filter = searchParams.get('filter');
    if (view === 'leo' || view === 'morgue') {
      setView(view);
      window.scrollTo(0, 0);
    } else if (filter === 'coroner' || filter === 'mass' || filter === 'autopsy') {
      goRecords(filter, '');
    } else if (view === 'records') {
      goRecords('all', '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // One-time staff guide opener (defined here so Request cards and headers
  // can reach it; the auto-show effect lives below resolvedCredentials —
  // its dep array reads that binding, so it must be declared after it).
  const closeGuide = useCallback(() => {
    setGuideOpen(false);
    markLspdGuideSeen();
  }, []);

  const formsByKey = useMemo(() => {
    const map = {};
    for (const f of formsData || []) if (f.firebaseKey) map[f.firebaseKey] = f;
    return map;
  }, [formsData]);
  const selectedCreateForm = formsByKey[MIGRATION_FORM_IDS[createKind]] || null;
  const draft = drafts[createKind];

  const resolvedCredentials = useMemo(
    () => (isAuthenticated && user
      ? resolveEmployeeCredentials(user, { factionListData, cleanRank: cleanRankText })
      : null),
    [user, isAuthenticated, factionListData],
  );

  const finalSelectOptions = useMemo(() => ({}), []);
  const { generateBBCode } = useBbcodeGenerator(
    selectedCreateForm, draft, finalSelectOptions, agencyDataStore,
    user, factionsData, factionListData, resolvedCredentials,
  );
  const { saveReport } = useFormSaver(user, isAuthenticated, { factionListData, resolvedCredentials });

  // One-time staff guide: PHMC members see the LSPD-portal tutorial once
  // (per browser, versioned). Re-openable any time from the Request cards.
  useEffect(() => {
    if (isAuthenticated && resolvedCredentials && !hasSeenLspdGuide()) {
      setGuideOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, !!resolvedCredentials]);

  const copyText = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        return ok;
      } catch {
        return false;
      }
    }
  }, []);

  const loadAutopsyCase = useCallback((morgue, entry) => {
    setShowAssignments(false);
    setAutopsyCase({ entry: entry || null, morgue: morgue || null });
    setCreateKind('autopsy');
    setView('create');
    setFormError('');

    const p = entry?.parsed || {};
    const fullName = p.decedentName || morgue?.name || '';
    const icMatch = String(fullName).match(/^(.+?)\s*\(\(/);
    const icName = icMatch
      ? icMatch[1].trim()
      : String(fullName).replace(/\(\(.*?\)\)/g, '').trim() || String(fullName);
    const oocName = entry?.oocName || oocFromParsedName(p.decedentName) || '';

    const updates = {};
    if (icName) updates.decedentName = icName;
    if (oocName) updates.decedentOOC = oocName;
    if (p.requesterName) updates.Requester = p.requesterName;
    if (p.sex || morgue?.sex) updates.sex = p.sex || morgue.sex;
    if (p.placeOfDeath || morgue?.location) updates.placeOfDeath = p.placeOfDeath || morgue.location;
    if (p.deathType) updates.deathType = String(p.deathType).toUpperCase() === 'CK' ? 'CK' : 'PK';
    if (morgue?.dnaProfile) updates.dnaProfile = morgue.dnaProfile;
    if (morgue?.bac) updates.bacLevel = morgue.bac;
    if (morgue?.narcotics) updates.narcoticTraces = morgue.narcotics;
    if (morgue?.physicalDescription) {
      let ext = '** The Morgue Technician provides a written description below of the Decedent ** ((This section is descriptive purposes only and is automatically generated from the Morgue Records ))\n\n';
      ext += `Physical Description:\n${morgue.physicalDescription}\n\n`;
      if (morgue.tattoos && morgue.tattoos !== 'None' && morgue.tattoos !== 'Unknown') {
        ext += `Tattoos/Marks:\n${morgue.tattoos}\n\n`;
      }
      if (morgue.estimatedAge && morgue.estimatedAge !== 'Unknown') {
        ext += `Est. Age: ${morgue.estimatedAge}\n`;
      }
      updates.externalExamination = ext.trim();
    }
    if (entry?.faction) updates.department = String(entry.faction).toLowerCase();
    if (Array.isArray(morgue?.findings)) {
      updates.anatomicSummaryListItems = morgue.findings.map((f) => {
        const type = (f.type || '').trim();
        const part = (f.part || '').trim();
        const typeL = type.toLowerCase();
        const distN = parseFloat(String(f.dist || '').replace(/[^\d.]/g, ''));
        const distR = Number.isNaN(distN) ? null : Math.floor(distN);
        if (!typeL || typeL === 'blood loss' || typeL.includes('wound type')
          || part.includes('body part') || part === '-' || part === 'N/A') return null;
        if (typeL.includes('gunshot')) {
          return `Gunshot Wound to ${part}${distR !== null ? `, estimated range ${distR}m` : ''}`;
        }
        if (typeL.includes('blunt force trauma') || typeL.includes('stab wound')) {
          return `${type.replace(/\b\w/g, (c) => c.toUpperCase())} to ${part}`;
        }
        return `${type} to ${part}${distR !== null ? ` (${distR}m)` : ''}`;
      }).filter(Boolean);
    }
    const rawBullets = morgue?.bullets;
    const bullets = rawBullets && typeof rawBullets === 'object'
      ? (Array.isArray(rawBullets) ? rawBullets : [rawBullets]) : [];
    if (bullets.length) {
      updates.casings = bullets.map((b) => {
        const prefix = String(b.type || '').toLowerCase().includes('gauge') ? 'Pellet' : 'Bullet';
        return `${prefix} found with striation marks - ${b.type || ''} #${b.id || ''}`;
      });
      updates.RadiologyResult = `${bullets.length} projectiles/slugs were identified via fluoroscopy and recovered during the autopsy.`;
    }
    if (entry?.assignedTo) updates.assignedTo = entry.assignedTo;
    const caseNumber = p.caseNumber || entry?.caseNum;
    if (caseNumber) updates.caseNumber = String(caseNumber);
    if (entry?.caseUrl || entry?.topicUrl) updates.caseUrl = entry.caseUrl || entry.topicUrl;
    if (p.timeOfDeath) updates.timeOfDeath = p.timeOfDeath;
    if (p.dateOfDeath) updates.dateTime = p.dateOfDeath;
    if (morgue?.caseId) updates.morgueCaseId = String(morgue.caseId);

    setDrafts((prev) => {
      const cleared = { ...prev.autopsy };
      [
        'decedentName', 'decedentOOC', 'Requester', 'sex', 'placeOfDeath', 'dnaProfile',
        'bacLevel', 'narcoticTraces', 'externalExamination', 'department', 'assignedTo',
        'caseNumber', 'caseUrl', 'timeOfDeath', 'morgueCaseId', 'synopsis',
      ].forEach((key) => { cleared[key] = ''; });
      cleared.anatomicSummaryListItems = [];
      cleared.casings = [];
      cleared.deathCausesListItems = [''];
      cleared.decedentPhotographyImages = [];
      cleared.autopsyDiagram = [];
      return { ...prev, autopsy: { ...cleared, ...updates } };
    });
    showNotification(`Loaded assigned case — ${icName || 'Unknown'}`, 'success');
  }, [showNotification]);

  const copyGenerated = useCallback(async (what) => {
    let gen;
    try {
      gen = generateBBCode();
    } catch (error) {
      showNotification(`Could not generate ${what === 'title' ? 'the title' : 'BBCode'}: ${error?.message || 'unknown error'}`, 'error');
      return;
    }
    if (!gen?.bbcode) {
      showNotification('Nothing to copy yet — check the required fields.', 'error');
      return;
    }
    const text = what === 'title' ? gen.finalTitle : gen.bbcode;
    const ok = await copyText(String(text || ''));
    showNotification(
      ok ? `${what === 'title' ? 'Title' : 'BBCode'} copied to clipboard.` : 'Clipboard unavailable — copy failed.',
      ok ? 'success' : 'error',
    );
  }, [generateBBCode, copyText, showNotification]);

  const goRecords = useCallback((filterId = 'all', q = '') => {
    setView('records');
    setRecordsNotice('');
    setDatasetNotice('');
    if (!isAuthenticated) {
      setRecordsNotice('Sign in first — records load after sign-in.');
      return;
    }
    rec.fetchPage({ nextOffset: 0, nextFilter: filterId, nextQuery: q });
    window.scrollTo(0, 0);
  }, [rec, isAuthenticated]);

  const guardedFetch = useCallback((args, { force = false } = {}) => {
    if (!isAuthenticated) { showNotification('Sign in first — records load after sign-in.', 'warning'); return; }
    setDatasetNotice('');
    rec.fetchPage({ ...args, force });
  }, [rec, isAuthenticated, showNotification]);

  const openDetail = useCallback(async (row, extraMeta = {}) => {
    const kind = kindFromFormId(row.formId);
    setDetailLoading(true);
    setView('report');
    setDatasetNotice('');
    try {
      const payload = await rec.fetchDetail(row.author, row.key);
      // Audit every migration-UI view, including cached opens (fire-and-forget;
      // identity is attached server-side from verified Auth claims).
      // Sample rows stay local: never audited.
      if (!row.demo) {
        triggerLogReportView({
          author: row.author, key: row.key, context: 'migration-ui', characterName: leoCharacterName,
        })
          .catch(() => {});
      }
      const report = payload?.report || {};
      const values = report.data && typeof report.data === 'object' ? report.data : {};
      setDetail({
        kind,
        author: row.author,
        key: row.key,
        values,
        title: report.originalKey || row.title || recordTitle(kind, values),
        meta: {
          savedAt: Number(report.timestamp) || Number(row.timestamp) || 0,
          updatedAt: Number(row.updatedAt) || 0,
          ...extraMeta,
        },
        raw: payload,
      });
      window.scrollTo(0, 0);
    } catch (e) {
      showNotification(`Failed to open report: ${e?.message || 'unknown error'}`, 'error');
      setView('records');
    } finally {
      setDetailLoading(false);
    }
  }, [rec, showNotification, leoCharacterName]);

  const switchDataset = useCallback(async (kind) => {    if (!isAuthenticated) {
      showNotification('Sign in first — records load after sign-in.', 'warning');
      return;
    }
    const rows = await rec.fetchPage({ nextOffset: 0, nextFilter: kind, nextQuery: '' });
    if (rows && rows.length) {
      await openDetail(rows[0]);
    } else {
      setDatasetNotice(`No ${KIND_LABEL[kind]} reports yet. File one with + Add report.`);
    }
  }, [rec, isAuthenticated, openDetail, showNotification]);

  // Email compose: attach a filed report — fills decedent/officer/department
  // from the report and pins its identity so the notice links straight to it.
  // Appends (dedupe by author:key); the first attachment drives the notice.
  const attachReportToEmail = useCallback(async (row) => {
    if (!row?.author || !row?.key) return;
    const dup = (drafts.email.additionalReports || []).some(
      (a) => (a.attachedAuthor || '') === row.author && (a.attachedKey || '') === row.key,
    );
    if (dup) {
      showNotification('Already attached — skipped.', 'warning');
      return;
    }
    try {
      const payload = await rec.fetchDetail(row.author, row.key);
      const values = payload?.report?.data && typeof payload.report.data === 'object'
        ? payload.report.data
        : {};
      const decedents = Array.isArray(values.decedents) ? values.decedents : [];
      const identity = {
        bbCode: '',
        originalKey: row.title || payload?.report?.originalKey || 'Attached report',
        formId: row.formId || payload?.report?.formId || '',
        attachedAuthor: row.author,
        attachedKey: row.key,
      };
      setDrafts((prev) => {
        const cur = prev.email;
        const existing = Array.isArray(cur.additionalReports) ? cur.additionalReports : [];
        const already = existing.some((a) => a.attachedAuthor === row.author && a.attachedKey === row.key);
        return {
          ...prev,
          email: {
            ...cur,
            requestingOfficer: cur.requestingOfficer || String(values.requestingOfficer || row.requestingOfficer || '').trim(),
            department: cur.department || String(values.department || row.department || ''),
            decedentName: cur.decedentName
              || String(values.decedentName || decedents.map((d) => d?.decedentName).filter(Boolean).join(', ') || row.decedentName || '').trim(),
            decedentOOC: cur.decedentOOC
              || String(values.decedentOOC || decedents.map((d) => d?.decedentOOC).filter(Boolean).join(', ') || '').trim(),
            additionalReports: already ? existing : [...existing, identity],
          },
        };
      });
      showNotification('Report attached — notice will link straight to it.', 'success');
    } catch (e) {
      showNotification(`Could not attach report: ${e?.message || 'unknown error'}`, 'error');
    }
  }, [rec, showNotification, drafts.email.additionalReports]);

  // Email compose: seed the coroner identity from the signed-in staffer so the
  // notice signature never renders blank (overrides only empty fields).
  useEffect(() => {
    if (view !== 'create' || createKind !== 'email' || !resolvedCredentials?.employeeName) return;
    setDrafts((prev) => {
      const cur = prev.email;
      if (cur.coronerEmployee) return prev;
      return {
        ...prev,
        email: {
          ...cur,
          coronerEmployee: resolvedCredentials.employeeName,
          coronerRank: cur.coronerRank || cleanRankText(resolvedCredentials.rank),
          coronerBadge: cur.coronerBadge || String(resolvedCredentials.badge || ''),
        },
      };
    });
  }, [view, createKind, resolvedCredentials]);

  const submitCreate = useCallback(async () => {
    setFormError('');
    if (!selectedCreateForm) { setFormError('Form definition still loading — try again in a moment.'); return; }    let values = draft;
    if (createKind === 'coroner') {
      if (!draft.decedentName.trim()) { setFormError('Decedent name is required.'); return; }
    } else if (createKind === 'mass') {
      if (!draft.placeOfDeath.trim()) { setFormError('Incident location is required.'); return; }
      const named = draft.decedents.filter((d) => d.decedentName.trim());
      if (!named.length) { setFormError('At least one decedent with a name is required.'); return; }
      values = { ...draft, decedents: named };
    } else if (createKind === 'email') {
      if (!draft.requestingOfficer.trim()) { setFormError('Requesting officer is required.'); return; }
      if (!draft.department) { setFormError('Department is required.'); return; }
      values = {
        ...draft,
        requestingOfficer: draft.requestingOfficer.trim(),
        decedentName: (draft.decedentName || '').trim(),
        decedentOOC: (draft.decedentOOC || '').trim(),
        additionalReports: Array.isArray(draft.additionalReports) ? draft.additionalReports : [],
      };
    } else {
      if (!draft.decedentName.trim()) { setFormError('Decedent name is required.'); return; }
      values = {
        ...draft,
        deathCausesListItems: (draft.deathCausesListItems || []).filter((s) => s.trim()),
        anatomicSummaryListItems: (draft.anatomicSummaryListItems || []).filter((s) => s.trim()),
        casings: (draft.casings || []).filter((s) => s.trim()),
      };
    }
    setSaving(true);
    try {
      const gen = generateBBCode();
      if (!gen?.bbcode) { setFormError('Failed to generate report text. Check the fields.'); return; }
      const result = await saveReport(selectedCreateForm, values, gen.finalTitle, gen.bbcode);
      if (result?.success) {
        if (String(result.reportPath || '').startsWith('scheduledReports')) {
          showNotification('Your report has been queued for deployment.', 'success');
        }
        // Short share link (`#/r/`), with a one-tap copy action.
        if (result?.shareCode) {
          const shortUrl = buildShortReportUrl(result.shareCode);
          showNotification(`Report link ready — ${shortUrl}`, 'success', 15000, {
            actions: [{
              label: 'Copy link',
              handler: () => copyText(shortUrl).then((ok) => {
                showNotification(ok ? 'Link copied.' : 'Copy failed — long-press the link above.', ok ? 'success' : 'error');
              }),
            }],
          });
        }
        if (createKind === 'autopsy') setAutopsyCase(null);
        setDrafts((prev) => ({
          ...prev,
          coroner: createKind === 'coroner' ? emptyCoronerValues() : prev.coroner,
          mass: createKind === 'mass' ? emptyMassValues() : prev.mass,
          autopsy: createKind === 'autopsy' ? emptyAutopsyValues() : prev.autopsy,
          email: createKind === 'email' ? emptyEmailValues() : prev.email,
        }));
        await rec.fetchPage({ nextOffset: 0, nextFilter: rec.filter, nextQuery: rec.query, force: true });
        // Mock behaviour: filing opens the new report. Fall back to the list if
        // the saved-report store has not indexed it yet.
        if (result.reportKey && result.authorId) {
          try {
            const payload = await rec.fetchDetail(result.authorId, result.reportKey);
            const report = payload?.report || {};
            const savedValues = report.data && typeof report.data === 'object' ? report.data : values;
            setDetail({
              kind: createKind,
              author: result.authorId,
              key: result.reportKey,
              values: savedValues,
              title: report.originalKey || gen.finalTitle,
              meta: { savedAt: Number(report.timestamp) || Date.now(), updatedAt: 0 },
              raw: payload,
            });
            triggerLogReportView({
              author: result.authorId, key: result.reportKey, context: 'migration-ui', characterName: leoCharacterName,
            })
              .catch(() => {});
            setView('report');
            window.scrollTo(0, 0);
            return;
          } catch {
            /* fall through to the records list */
          }
        }
        setView('records');
      } else if (result?.error !== 'cancelled-duplicate') {
        setFormError(`Save failed: ${result?.error || 'unknown error'}`);
      }
    } finally {
      setSaving(false);
    }
  }, [selectedCreateForm, draft, createKind, generateBBCode, saveReport, rec, showNotification, leoCharacterName]);

  const page = Math.floor(rec.offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(rec.total / PAGE_SIZE));

  // Sidebar highlight follows where the user is (mock parity).
  const activeNav = view === 'records'
    ? (rec.filter === 'all' ? '' : KIND_TO_FILTER[rec.filter] || '')
    : view === 'report' && detail ? detail.kind
      : view === 'create' ? createKind
        : view;

  const displayName = characterName || user?.username || 'Not signed in';
  const initials = displayName.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const createTitle = detailTitle(createKind, createKind === 'mass' ? { ...draft, date: undefined } : draft);

  return (
    <div className="pmc">
      <div className="shell">
        <aside>
          <div className="brand">
            <div className="cross">+</div>
            <div><b>PHMC</b><span>Pillbox Hill Medical</span></div>
          </div>

          <button type="button" className="side-btn" onClick={() => goRecords('all', searchInput)}>
            ▤&nbsp;&nbsp;View all records
          </button>

          <div className="nav-sec">Reports</div>
          {['coroner', 'email', 'mass', 'autopsy'].map((k) => (
            <button
              key={k}
              type="button"
              className={`nav-item${activeNav === k ? ' active' : ''}`}
              onClick={() => goRecords(KIND_TO_FILTER[k], searchInput)}
            >
              <span className="g" aria-hidden="true">{k === 'autopsy' ? '◍' : k === 'email' ? '✉' : '✚'}</span>
              {k === 'coroner' ? 'Coroner Reports' : k === 'email' ? 'Coroner Email' : k === 'mass' ? 'Mass Fatality' : 'Autopsy Reports'}
            </button>
          ))}

          <div className="nav-sec">Records</div>
          <button
            type="button"
            className={`nav-item${activeNav === 'morgue' ? ' active' : ''}`}
            onClick={() => { setView('morgue'); window.scrollTo(0, 0); }}
          >
            <span className="g" aria-hidden="true">○</span>
            Morgue Records
          </button>

          <div className="nav-sec">Law Enforcement</div>
          <button
            type="button"
            className={`nav-item${activeNav === 'leo' ? ' active' : ''}`}
            onClick={() => { setView('leo'); window.scrollTo(0, 0); }}
          >
            <span className="g" aria-hidden="true">▤</span>
            LEO Reports
            {leo.total && !leo.demoMode ? <span className="n">{leo.total}</span> : null}
          </button>
        </aside>

        <main>
          <header className="top">
            <div className="who">
              ☰&nbsp;&nbsp;{displayName}
              {resolvedCredentials?.rank ? ` · ${resolvedCredentials.rank}` : ''}
            </div>
            <div className="user-wrap" ref={userMenuRef}>
              <button
                type="button"
                className="user user-btn"
                onClick={() => setUserMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
              >
                <span className="avatar">{initials}</span>
                <span className="user-name">{displayName}</span>
                <span className="caret" aria-hidden="true">▾</span>
              </button>
              {userMenuOpen ? (
                <div className="user-menu" role="menu">
                  {!isAuthenticated ? (
                    <button type="button" role="menuitem" className="mi" onClick={handleSignIn}>
                      <span>Sign In</span>
                      <small>GTA World OAuth</small>
                    </button>
                  ) : (
                    <>
                      <div className="menu-sec">Switch Character</div>
                      {(canSwapCharacters && (swappableCharacters || []).length) ? swappableCharacters.map((c) => {
                        const active = String(c.id) === String(factionData?.characterId || factionData?.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            role="menuitem"
                            className={`mi${active ? ' active' : ''}`}
                            onClick={() => { swapCharacter(c); setUserMenuOpen(false); }}
                          >
                            <span>{c.characterName}{active ? ' ✓' : ''}</span>
                            <small>{c.isFactionMember ? (c.rank || 'PHMC Staff') : 'Non Employee'}</small>
                          </button>
                        );
                      }) : <div className="menu-empty">No other characters available.</div>}
                      <div className="menu-sec">Deploy Consent</div>
                      {CONSENT_FORMS.map((f) => {
                        const on = consent[f.id] !== false;
                        return (
                          <label key={f.id} className="menu-consent" title={on ? 'Queued to the bot on save' : 'Saved only — no bot deploy'}>
                            <span>{f.label}</span>
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => setConsent(f.id, !on)}
                            />
                          </label>
                        );
                      })}
                      <button type="button" role="menuitem" className="mi danger" onClick={handleSignOut}>
                        <span>Sign Out</span>
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </header>

          {view === 'records' && (
            <div className="wrap">
              {!isAuthenticated && (
                <div className="notice warn">
                  Not signed in — sign in with GTA World OAuth to load records. Filing requires
                  PHMC membership; LEO reports require a signed-in account.
                </div>
              )}

              <div className="page-head">
                <div>
                  <h1>All records</h1>
                  <p>
                    {!isAuthenticated
                      ? 'No records loaded yet.'
                      : rec.total === 0
                        ? 'No records match.'
                        : `${rec.rows.length} of ${rec.total} records${rec.filter !== 'all' ? ` · ${KIND_LABEL[rec.filter]}` : ''}`}
                    {rec.fromCache ? ' · cached' : ''}
                    {rec.demoMode ? ' · sample' : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setGuideOpen(true)}
                    title="How LSPD coroner emails work now"
                  >
                    ✉ LSPD guide
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={rec.loading || !isAuthenticated}
                    onClick={() => guardedFetch({ nextOffset: rec.offset }, { force: true })}
                  >
                    {rec.loading ? 'Refreshing…' : 'Refresh'}
                  </button>
                  <button type="button" className="btn" onClick={() => { setView('create'); window.scrollTo(0, 0); }}>
                    + Add report
                  </button>
                  <button
                    type="button"
                    className="btn"
                    title="Compose a coroner email"
                    onClick={() => { setCreateKind('email'); setView('create'); setFormError(''); window.scrollTo(0, 0); }}
                  >
                    ✉ Email
                  </button>
                </div>
              </div>

              <div className="tools">
                <input
                  type="search"
                  value={searchInput}
                  placeholder="Search title, decedent, officer…"
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') guardedFetch({ nextOffset: 0, nextQuery: searchInput }); }}
                />
                <div className="tabs rep-switch">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={rec.filter === f.id ? 'active' : ''}
                      onClick={() => guardedFetch({ nextOffset: 0, nextFilter: f.id, nextQuery: searchInput })}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {recordsNotice ? <div className="notice warn">{recordsNotice}</div> : null}
              {rec.demoMode ? (
                <div className="notice warn">
                  Sample data — local preview only. These fictional reports let you open and review
                  the report view without OAuth or a backend. Nothing here is real and nothing is logged.
                </div>
              ) : null}
              {rec.loading ? (
                <div className="notice">
                  {rec.rows.length ? 'Refreshing records…' : 'Loading records…'}
                </div>
              ) : null}
              {rec.error ? <div className="notice err">{rec.error}</div> : null}

              {!rec.loading && !rec.error && !rec.rows.length && isAuthenticated ? (
                <div className="empty">No records match.</div>
              ) : null}

              {rec.rows.map((r) => (
                <button
                  key={`${r.author}:${r.key}`}
                  type="button"
                  className="rec"
                  onClick={() => openDetail(r)}
                >
                  <div className="type"><span className="pill">{KIND_LABEL[kindFromFormId(r.formId)]}</span></div>
                  <div className="main">
                    <div className="t">{r.title}</div>
                    <div className="d">{r.authorName || r.author} · {r.formName}</div>
                  </div>
                  <div><span className={`pill${r.demo ? ' amber' : ''}`}>{r.demo ? 'Sample' : 'Filed'}</span></div>
                  <div className="arrow">›</div>
                </button>
              ))}

              {rec.total > PAGE_SIZE && (
                <div className="tools" style={{ justifyContent: 'space-between', marginTop: 6 }}>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={rec.offset === 0 || rec.loading}
                    onClick={() => guardedFetch({ nextOffset: Math.max(0, rec.offset - PAGE_SIZE) })}
                  >
                    ← Prev
                  </button>
                  <span style={{ color: '#8e8e96', fontSize: 13 }}>Page {page} of {pageCount}</span>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={rec.offset + PAGE_SIZE >= rec.total || rec.loading}
                    onClick={() => guardedFetch({ nextOffset: rec.offset + PAGE_SIZE })}
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}

          {view === 'report' && (
            detailLoading || !detail
              ? <div className="wrap"><div className="notice">Loading report…</div></div>
              : (
                <ReportView
                  kind={detail.kind}
                  values={detail.values}
                  title={detail.title}
                  meta={detail.meta}
                  notice={datasetNotice}
                  author={detail.author}
                  reportKey={detail.key}
                  onSwitchDataset={switchDataset}
                  onBack={() => { setView('records'); setDatasetNotice(''); window.scrollTo(0, 0); }}
                />
              )
          )}

          {view === 'create' && (
            <div className="wrap">
              <div className="page-head">
                <div>
                  <h1>New report</h1>
                  <p>Filed through the normal save flow — bot deploy behaviour unchanged.</p>
                </div>
                <button type="button" className="btn ghost" onClick={() => setView('records')}>← Back to records</button>
              </div>

              <div className="switchrow">
                <span className="cap">REPORT TYPE:</span>
                <div className="tabs rep-switch">
                  {CREATE_TYPES.map((t) => (
                    <button
                      key={t.kind}
                      type="button"
                      className={createKind === t.kind ? 'active' : ''}
                      onClick={() => { setCreateKind(t.kind); setFormError(''); }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {createKind === 'coroner' && (
                <CreateCoroner
                  v={drafts.coroner}
                  set={(v) => setDrafts((p) => ({ ...p, coroner: v }))}
                  factionsData={factionsData}
                  onOpenGuide={() => setGuideOpen(true)}
                />
              )}
              {createKind === 'mass' && (
                <CreateMass v={drafts.mass} set={(v) => setDrafts((p) => ({ ...p, mass: v }))} onOpenGuide={() => setGuideOpen(true)} />
              )}
              {createKind === 'autopsy' && (
                <CreateAutopsy
                  v={drafts.autopsy}
                  set={(v) => setDrafts((p) => ({ ...p, autopsy: v }))}
                  showNotification={showNotification}
                  caseInfo={autopsyCase}
                  onOpenAssignments={() => setShowAssignments(true)}
                  onClearCase={() => setAutopsyCase(null)}
                />
              )}
              {createKind === 'email' && (
                <CreateEmail
                  v={drafts.email}
                  set={(v) => setDrafts((p) => ({ ...p, email: v }))}
                  reports={rec.rows}
                  onAttachReport={attachReportToEmail}
                  onOpenGuide={() => setGuideOpen(true)}
                />
              )}

              <div className={`form-err${formError ? ' visible' : ''}`}>{formError}</div>

              <div className="form-actions">
                <button type="button" className="btn" disabled={saving} onClick={submitCreate}>
                  {saving ? 'Filing…' : 'File report'}
                </button>
                <button type="button" className="btn ghost" onClick={() => copyGenerated('title')}>
                  Copy Title
                </button>
                <button type="button" className="btn ghost" onClick={() => copyGenerated('bbcode')}>
                  Copy BBCode
                </button>
                <button type="button" className="btn ghost" onClick={() => setView('records')}>Cancel</button>
              </div>

              <div className="report-sub" style={{ marginTop: 12 }}>Title: {createTitle}</div>
            </div>
          )}

          {view === 'morgue' && (
            <MorgueView
              isAuthenticated={isAuthenticated}
              onBackToRecords={() => goRecords('all', searchInput)}
            />
          )}

          {view === 'leo' && (
            <LeoView
              leo={leo}
              isAuthenticated={isAuthenticated}
              viewerName={displayName}
              onBackToRecords={() => goRecords('all', searchInput)}
              onOpenGuide={() => setGuideOpen(true)}
            />
          )}
        </main>
      </div>

      <AssignedAutopsiesModal
        show={showAssignments}
        onClose={() => setShowAssignments(false)}
        onLoadCase={loadAutopsyCase}
        factionsData={factionsData}
        loadMorgueRecords={loadMorgueRecords}
      />
      <LspdGuideModal open={guideOpen} onClose={closeGuide} />
    </div>
  );
}
