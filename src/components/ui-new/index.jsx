import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import * as Sentry from "@sentry/react";
import { useData } from '../../contexts/DataContext';
import { useModal } from '../../contexts/ModalProvider';
import { useNotification } from '../../contexts/NotificationContext';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import { evaluateFieldVisibility } from '../../utils/formValidation';
import { resolveEmployeeCredentials } from '../../utils/identityUtils';
import useBbcodeGenerator from '../../hooks/useBbcodeGenerator';
import useFormTranslation from '../../hooks/useFormTranslation';
import { useFormSaver } from '../../hooks/useFormSaver';
import { useReportAttachment } from '../../hooks/useReportAttachment';
import { useConsent, DEPLOY_TRACKED_FORMS, FORM_SECTIONS, FORM_LABELS } from '../../hooks/useConsent';
import { useAgencyCredentials } from '../../hooks/useAgencyCredentials';
import { useReportLoader } from '../../hooks/useReportLoader';
import { useReportActions } from '../../hooks/useReportActions';
import SavedReportsModal from '../Modals/SavedReportsModal';
import FixDeployedReportModal from '../Modals/FixDeployedReportModal';
import AssignedAutopsiesModal from '../Modals/AssignedAutopsiesModal';
import MapModal from '../Modals/MapModal';
import PrototypeFieldRenderer from './PrototypeFieldRenderer';
import SurgicalDiagramModal from './SurgicalDiagramModal';
import PatientSearch from './PatientSearch';
import MorgueBrowser from './MorgueBrowser';
import EmsPanel from './EmsPanel';
import TimeDisplay from './TimeDisplay';
import ServiceStatusTicker from './ServiceStatusTicker';
import BusinessCardModal from '../UI/BusinessCard';
import { useImageUpload } from '../../hooks/useImageUpload';
import { triggerGetPatientNames } from '../../services/firebaseFunctions';
import { ref, onValue } from 'firebase/database';
import { database } from '../../firebase';
import './styles.css';
import moduleStyles from './index.module.css';
import phmcLogo from '../../assets/phmc.png';
/**
 * New UI Prototype — grid-based form layout with
 * branded sidebar, top bar, and tabbed right panel.
 * Route: /ui-prototype
 */
const NewUIPrototype = ({ basicMode = false }) => {
  const [activeMiscTab, setActiveMiscTab] = useState('profile');
  const [showCharSwitch, setShowCharSwitch] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [selectedForm, setSelectedForm] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [activeView, setActiveView] = useState('forms'); // 'forms' | 'morgue' | 'ems'

  // EMS Protocols (tree lives in the sidebar, selection renders in main content)
  const [emsProtocols, setEmsProtocols] = useState([]);
  const [emsInjuries, setEmsInjuries] = useState({});
  const [selectedEmsProtocol, setSelectedEmsProtocol] = useState(null);
  const [selectedEmsInjury, setSelectedEmsInjury] = useState(null);
  const [emsOpen, setEmsOpen] = useState(false);
  const [emsCollapsed, setEmsCollapsed] = useState(new Set());

  const { formsData, morgueRecords, isLoadingData, morgueLoading, morgueRecordsError, loadMorgueRecords, factionsData, agencyDataStore, selectOptions: dataContextSelectOptions, factionListData, lsccData } = useData();
  const { user: realUser, isAuthenticated: realIsAuthenticated, characterName, swappableCharacters, factionData, isPhmcMember: realIsPhmcMember, accessLevel: realAccessLevel, login, logout, swapCharacter, canSwapCharacters, isLoading: authLoading, error: authError, credentialsLoading, identityRefreshStatus } = useGtaWorldAuth();

  // ── Initial auth check — show loader until auth is fully resolved ──
  const [authChecking, setAuthChecking] = useState(true);
  const authFinalized = useRef(false);

  // Latest auth state, readable from the fallback timer when it fires — the
  // effect closure captures stale values, so a long OAuth flow would otherwise
  // be misread as "still idle" and the sign-in buttons would reappear.
  const authStateRef = useRef({ authLoading, realIsAuthenticated, credentialsLoading });
  authStateRef.current = { authLoading, realIsAuthenticated, credentialsLoading };

  useEffect(() => {
    if (authFinalized.current) {
      // If a fresh OAuth flow starts after we gave up (buttons shown) and the
      // user is still not signed in, let the loader come back. Never reset while
      // authenticated — that would flash the spinner on an authLoading flap.
      if (authLoading && !realIsAuthenticated) {
        authFinalized.current = false;
        setAuthChecking(true);
      }
      return;
    }
    console.log('[Auth] Progress:', { isAuthenticated: realIsAuthenticated, authLoading, credentialsLoading, user: realUser?.username || null, characterName: characterName || null, rank: factionData?.rank || null });
    if (realIsAuthenticated && !credentialsLoading) {
      authFinalized.current = true;
      console.log('[Auth] Finalized (authenticated):', { user: realUser?.username, characterName, rank: factionData?.rank });
      setAuthChecking(false);
    } else if (!authLoading && !credentialsLoading && !realIsAuthenticated) {
      const t = setTimeout(() => {
        // Re-check at fire time: if auth work is still in progress, don't give up.
        const latest = authStateRef.current;
        if (latest.authLoading || latest.credentialsLoading || latest.realIsAuthenticated) return;
        authFinalized.current = true;
        console.log('[Auth] Finalized (unauthenticated): giving up after 2s');
        setAuthChecking(false);
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [authLoading, realIsAuthenticated, credentialsLoading, realUser, characterName, factionData]);

  // ── Dev auth override ──
  const isAuthenticated = realIsAuthenticated;
  const isPhmcMember = realIsPhmcMember;
  const accessLevel = realAccessLevel;
  const user = realUser;
  const isLocalhostDev = window.location.hostname === 'localhost';
  const isMedicalExaminer = isLocalhostDev || (factionData?.rank || '').toLowerCase().includes('medical examiner');
  const { showNotification, removeNotification } = useNotification();
  const { openImagePreview } = useModal();
  const { handleImageUpload, isUploading: isSigUploading } = useImageUpload(showNotification, () => {});

  // ── Sign in handler ──
  const handleLogin = (role) => {
    console.log('[Auth] Initiating login with role:', role);
    login({
      role,
      onSuccess: (userData) => {
        console.log('[Auth] Login successful:', userData?.username);
        showNotification(`Signed in as ${userData?.username || 'Unknown'}`, 'success');
      },
      onError: (err) => {
        console.error('[Auth] Login failed:', err);
        showNotification('Sign in failed: ' + err, 'error');
      },
    });
  };

  // Derive finalSelectOptions like the production FormHandler does
  const finalSelectOptions = useMemo(() => {
    const derivedAgencyOptions = {};
    if (agencyDataStore) {
      derivedAgencyOptions.agencies = Object.entries(agencyDataStore).map(([key, agency]) => ({
        label: agency.fullName || key,
        value: key,
      }));
    }
    return {
      ...(dataContextSelectOptions || {}),
      ...derivedAgencyOptions,
    };
  }, [dataContextSelectOptions, agencyDataStore]);

  // ── Consent (must be before groupedForms which references it) ──
  const { consent, setConsent, getConsent, consentLoaded } = useConsent();
  const formConsent = selectedForm ? getConsent(selectedForm.firebaseKey) : true;
  const isDeployTracked = selectedForm ? DEPLOY_TRACKED_FORMS.includes(selectedForm.firebaseKey) : false;
  // Auto-deploy hides the BBCode/title tools — opted-out users still need them for manual posting
  const bbcodeToolsVisible = !(consentLoaded && isDeployTracked && formConsent);

  // ── Manual-post guide (shown when the user is opted OUT of auto-deploy) ──
  // Coroner Email → one icon per faction the email can be posted to.
  // Coroner Report / Mass Fatality → a single PHMC button to the f=267 posting page.
  const formKey = selectedForm?.firebaseKey || '';
  const showManualPostGuide = isDeployTracked && !formConsent;
  const isCoronerEmail = formKey === 'coroner_email';
  const isCoronerOrMassFatal = formKey === 'coroner-report' || formKey === 'mass-ftality-test';
  const MANUAL_POST_FACTIONS = ['LSPD', 'LSSD', 'SADCR', 'DAO'];
  // Shared faction-forum credentials come from the VPS via the PHMC-employee
  // gated Firebase function (never bundled client-side).
  const { creds: agencyCreds } = useAgencyCredentials();

  // Selected department (short code or full name, object or string).
  const deptValRaw = formValues?.department || formValues?.requestingOfficerDepartment || '';
  const deptVal = (typeof deptValRaw === 'object' && deptValRaw !== null)
    ? (deptValRaw.label || deptValRaw.value || '')
    : String(deptValRaw || '');

  // agencyDataStore is keyed by short code (e.g. "LSPD", "DAO") — the agency
  // objects themselves have no `shortCode` field, so match the key first, then
  // fall back to fullName/shortCode.
  const findAgency = (code) => {
    if (!agencyDataStore) return null;
    if (agencyDataStore[code]) return agencyDataStore[code];
    return Object.values(agencyDataStore).find(
      (a) => String(a.shortCode || '').toUpperCase() === code
        || String(a.fullName || '').toUpperCase().includes(code)
    ) || null;
  };
  const phmcAgency = findAgency('PHMC');

  // Resolve the selected department to an agency entry { key, agency }.
  const resolveDeptAgency = () => {
    if (!deptVal || !agencyDataStore) return null;
    const dv = deptVal.toLowerCase();
    for (const [key, a] of Object.entries(agencyDataStore)) {
      if (key.toLowerCase() === dv
        || String(a.shortCode || '').toLowerCase() === dv
        || String(a.fullName || '').toLowerCase().includes(dv)
        || dv.includes(key.toLowerCase())) {
        return { key, agency: a };
      }
    }
    return null;
  };
  const deptAgency = resolveDeptAgency();

  // Guide factions: when a department is selected show only that faction's icon
  // (PHMC fallback if the department isn't in the agency data); otherwise all.
  const displayFactions = deptVal
    ? [deptAgency ? deptAgency.key : 'PHMC']
    : MANUAL_POST_FACTIONS;

  // Dynamic credentials for a faction (based on its forum hostname).
  const credsForFaction = (code) => {
    const a = findAgency(code);
    if (!a) return null;
    let domain = '';
    try { domain = new URL(a.url).hostname; } catch (e) {}
    return domain ? (agencyCreds[domain] || null) : null;
  };
  const displayCreds = displayFactions.map(credsForFaction).filter(Boolean);

  const isFormOptedIn = useCallback((formId) => consent[formId] !== false, [consent]);

  const groupedForms = useMemo(() => {
    if (!formsData) return {};
    const map = {};

    const isLocalhost = window.location.hostname === 'localhost';
    const userRank = factionData?.rank || '';

    for (const form of formsData) {
      // Visibility checks (mirrors FormHandler.jsx access logic)
      if (form.isHidden && !isLocalhost) continue;

      // death_record restricted to Medical Examiners
      if (form.firebaseKey === 'death_record' && !isLocalhost) {
        const isMedicalExaminer = userRank.toLowerCase().includes('medical examiner');
        if (!isMedicalExaminer) continue;
      }

      // Restricted access types
      const isRestricted = form.accessType === "PHMC" || form.accessType === "Coroner" || form.accessType === "Mental Health";
      if (isRestricted && !isLocalhost) {
        const hasAccess = isAuthenticated && (isPhmcMember || (user && user.faction));
        if (!hasAccess) continue;
      }

      // Hide coroner_email when all source forms + email are opted in (auto-generated)
      if (form.firebaseKey === 'coroner_email') {
        if (isFormOptedIn('coroner_email') && isFormOptedIn('coroner-report') && isFormOptedIn('mass-ftality-test')) {
          continue;
        }
      }

      const matches = form.name?.toLowerCase().includes(searchTerm.toLowerCase());
      // In EMS view the search box filters the protocol tree, not forms.
      if (!matches && searchTerm && activeView !== 'ems') continue;
      const cat = form.category || 'Uncategorized';
      if (!map[cat]) map[cat] = [];
      map[cat].push(form);
    }
    return map;
  }, [formsData, searchTerm, isAuthenticated, isPhmcMember, user, factionData, consent, activeView]);

  // ── EMS Protocols data (normalized categories from lsccData) ──
  useEffect(() => {
    if (!lsccData) return;
    const protocolOrder = ["Introduction", "Legalities", "Emergency Vehicle Protocols", "Radio Procedures + Encodes", "Miscellaneous Information + Tips"];
    const protocolOrderMap = new Map(protocolOrder.map((name, index) => [name, index]));

    const normalized = Array.isArray(lsccData.protocols)
      ? lsccData.protocols.map((cat) => {
          const sorted = [...(cat.protocols || [])].sort((pA, pB) => {
            const idxA = protocolOrderMap.get(pA.name) ?? Infinity;
            const idxB = protocolOrderMap.get(pB.name) ?? Infinity;
            if (idxA !== idxB) return idxA - idxB;
            return pA.name.localeCompare(pB.name);
          });
          return { ...cat, protocols: sorted };
        })
      : [];
    normalized.sort((a, b) => {
      const idA = parseInt(a.category.match(/^\[(\d+)\]/)?.[1] || Infinity);
      const idB = parseInt(b.category.match(/^\[(\d+)\]/)?.[1] || Infinity);
      if (idA !== idB) return idA - idB;
      return a.category.localeCompare(b.category);
    });

    setEmsProtocols(normalized);
    setEmsInjuries(lsccData.injuries || {});
  }, [lsccData]);

  const filteredEmsProtocols = useMemo(() => {
    return emsProtocols.map(cat => ({
      ...cat,
      protocols: (cat.protocols || []).filter(p => {
        const search = searchTerm.toLowerCase();
        const matches = p.name.toLowerCase().includes(search) || (p.uniqueWords || []).some(w => w.toLowerCase().includes(search));
        if (!matches) return false;
        if (!selectedEmsInjury) return true;
        const content = (p.content || '').toLowerCase();
        return selectedEmsInjury.words.toLowerCase().split(",").some(w => content.includes(w.trim()));
      })
    })).filter(cat => cat.protocols.length > 0);
  }, [emsProtocols, searchTerm, selectedEmsInjury]);

  const toggleEms = useCallback(() => {
    setEmsOpen(prev => {
      const next = !prev;
      // Only switch into the EMS view when expanding; collapsing keeps the current view.
      if (next) {
        setActiveView('ems');
        setSelectedForm(null);
        setFormValues({});
      }
      return next;
    });
  }, []);
  const toggleEmsCat = useCallback((name) => {
    setEmsCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  const handleChange = useCallback((name, value) => {
    setFormValues(prev => ({ ...prev, [name]: value }));
  }, []);


  // ── Translations (community i18n) ──
  const { availableLangs, lang, setLang, translation } = useFormTranslation(selectedForm?.firebaseKey);

  // A translated view of the selected form: same field names/ids/types (data +
  // bot stay intact), with name/description/labels/placeholders/template swapped
  // for the active language. Used ONLY for rendering + BBCode generation;
  // `selectedForm` remains the source of truth for logic (save, deploy, access).
  const formForRender = useMemo(() => {
    if (!translation || !selectedForm) return selectedForm;
    const tFields = translation.fields || {};
    return {
      ...selectedForm,
      name: translation.formName || selectedForm.name,
      formDescription: translation.formDescription || selectedForm.formDescription,
      template: translation.template || selectedForm.template,
      fields: (selectedForm.fields || []).map(f => {
        const ov = tFields[f.name];
        if (!ov) return f;
        return {
          ...f,
          label: ov.label != null ? ov.label : f.label,
          placeholder: ov.placeholder != null ? ov.placeholder : f.placeholder,
          content: ov.content != null ? ov.content : f.content,
          buttonLabel: ov.buttonLabel != null ? ov.buttonLabel : f.buttonLabel,
        };
      }),
    };
  }, [translation, selectedForm]);

  // ── Clean rank text ──
  // Strips BBCode-ish brackets/parens and leading/trailing dashes (e.g.
  // "Medical Examiner -" -> "Medical Examiner"), then collapses whitespace.
  const cleanRankText = useCallback((rank) => {
    if (!rank) return '';
    return String(rank)
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/^\s*[-–—]\s*|\s*[-–—]\s*$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }, []);

  // Fix A: resolve credentials synchronously this render (not via an async
  // effect writing setFormValues) so the save handler never reads stale state.
  // Computed BEFORE the BBCode generator so the generator's fallback can use
  // the same memo — this is the authoritative resolver that the save-time
  // backfill relies on, and it provably matches.
  const resolvedCredentials = useMemo(
    () => (isAuthenticated && selectedForm?.accessType && user
      ? resolveEmployeeCredentials(user, { factionListData, cleanRank: cleanRankText })
      : null),
    [user, isAuthenticated, selectedForm, factionListData, cleanRankText]
  );

  // ── BBCode Generator ──
  const { generatedBBCode, generatedTitle, showBBCode, setShowBBCode, generateBBCode, clearBBCode } = useBbcodeGenerator(
    formForRender, formValues, finalSelectOptions, agencyDataStore, user, factionsData, factionListData, resolvedCredentials
  );

  const { saveReport, validateMembership } = useFormSaver(user, isAuthenticated, { factionListData, resolvedCredentials });

  // ── Medical record patient name gate ──
  const MEDICAL_FORM_IDS = ['patient_notes', 'er_protocol', 'physical_evaluation', 'staff-patient-file', 'surgical', 'session_notes', 'intensive_treatment', 'psych-eval', 'general_consultation'];
  const isMedicalRecord = selectedForm?.firebaseKey && MEDICAL_FORM_IDS.includes(selectedForm.firebaseKey);

  // ── Patient ID → name validation (bidirectional patient lookup) ──
  // If the ME typed a patient ID but no patient name is set, resolve the name
  // from the patient index by ID (the /api/patients lookup now matches ids).
  // Prevents the "patientName = author name" leak (Paolina Russo / 1919).
  const patientIdFilledRef = useRef(false);
  useEffect(() => {
    const id = String(formValues.patientID || '').trim();
    const hasName = !!String(formValues.patientName || formValues.decedentName || '').trim();
    if (!isMedicalRecord || !id || id.length < 2 || hasName) {
      patientIdFilledRef.current = !!id && !hasName;
      return;
    }
    // Only auto-fill once per ID entry — don't fight the user's typing.
    if (patientIdFilledRef.current) return;
    patientIdFilledRef.current = true;

    let cancelled = false;
    triggerGetPatientNames({ q: id })
      .then((res) => {
        if (cancelled) return;
        const matches = res?.matches || [];
        const exact = matches.find((m) => m.id != null && String(m.id) === id);
        if (exact) {
          setFormValues(prev => ({
            ...prev,
            decedentName: exact.name,
            patientName: exact.name,
            patientID: String(exact.id),
          }));
        }
      })
      .catch((err) => {
        console.warn('[PatientID] lookup by id failed (save will still work):', err?.message || err);
      });
    return () => { cancelled = true; };
  }, [formValues.patientID, formValues.patientName, formValues.decedentName, isMedicalRecord, setFormValues]);
  const patientName = formValues.decedentName || formValues.decedentname || formValues.patientName || '';

  // ── "That's YOUR name, doc" validator ──
  // Catches the patientName = author-name leak (Paolina Russo / patient 1919)
  // with a friendly warning before save. Exact case-insensitive match against
  // the signed-in character name / username.
  const signedInIdentity = characterName || user?.faction?.characterName || user?.activeCharacter?.characterName || user?.username || '';
  const isOwnNameAsPatient = !!patientName.trim() && !!signedInIdentity &&
    patientName.trim().toLowerCase() === String(signedInIdentity).trim().toLowerCase();

  // ── Progress stamp ──
  const fillableTypes = ['input', 'textarea', 'select', 'multi_select', 'checkbox', 'radio', 'timer', 'employee_select', 'multi_employee_select', 'dynamic_text_list', 'requesting_officer', 'medicine_block', 'body_tampered'];
  const { totalFields, filledFields } = useMemo(() => {
    if (!selectedForm?.fields) return { totalFields: 0, filledFields: 0 };
    const visible = selectedForm.fields.filter(f => fillableTypes.includes(f.type) && evaluateFieldVisibility(f, formValues));
    const total = visible.length;
    const filled = visible.filter(f => {
      const v = formValues[f.name];
      if (f.type === 'checkbox') return !!v;
      if (Array.isArray(v)) return v.length > 0 && v.some(i => i !== '');
      if (typeof v === 'object' && v !== null) return Object.values(v).some(x => x);
      return v && String(v).trim().length > 0;
    }).length;
    return { totalFields: total, filledFields: filled };
  }, [selectedForm, formValues]);
  const pct = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
  const circumference = 251.2;
  const dashOffset = circumference - (circumference * pct / 100);

  const searchRef = useRef(null);
  useEffect(() => { searchRef.current?.focus(); }, []);

  // Log auth state changes — fires on initial load and after OAuth redirect
  useEffect(() => {
    console.log('[Auth] State:', { isAuthenticated: realIsAuthenticated, isLoading: authLoading, user: realUser?.username || null, characterName: characterName || null, isPhmcMember: realIsPhmcMember });
  }, [realIsAuthenticated, authLoading, realUser, characterName, realIsPhmcMember]);

  // ── Auto-save / restore form progress ──
  useEffect(() => {
    if (selectedForm?.firebaseKey && Object.keys(formValues).length > 0) {
      localStorage.setItem(`form_progression_${selectedForm.firebaseKey}`, JSON.stringify(formValues));
    }
  }, [formValues, selectedForm?.firebaseKey]);

  // Restore progress when selecting a form.
  // Merge instead of wholesale overwrite so a stale progression (saved before
  // OAuth credential sync) can never wipe the current coroner/phmc identity.
  const CREDENTIAL_KEYS = [
    'coronerEmployee', 'coronerRank', 'coronerBadge', 'coronerDiscord', 'coronerPHNumber',
    'coronerFirstName', 'coronerLastName',
    'phmcEmployee', 'phmcRank', 'phmcBadge', 'phmcDiscord', 'phmcPHNumber',
    'phmcFirstName', 'phmcLastName',
  ];
  useEffect(() => {
    if (selectedForm?.firebaseKey) {
      const saved = localStorage.getItem(`form_progression_${selectedForm.firebaseKey}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setFormValues(prev => {
            const merged = { ...parsed };
            CREDENTIAL_KEYS.forEach(k => {
              if (prev[k]) merged[k] = prev[k];
            });
            return merged;
          });
        } catch {}
      }
    }
  }, [selectedForm?.firebaseKey]);

  // ── Draft backups (safety net for accidental clears) ──
  // form_progression is DELETED on "Clear Form", so before wiping we push the
  // draft onto a per-form stack of restore points (each tagged with the clear
  // time + a summary of key fields). Backups are cleared after a successful save.
  const BACKUPS_KEY_PREFIX = 'form_progression_backups_';
  const MAX_BACKUPS = 6;
  const BACKUP_TTL_MS = 48 * 60 * 60 * 1000; // backups are temporary — auto-delete after 48h

  const loadBackups = (formKey) => {
    try {
      const raw = localStorage.getItem(BACKUPS_KEY_PREFIX + formKey);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      const now = Date.now();
      const fresh = arr.filter(b => b && b.ts && (now - b.ts) <= BACKUP_TTL_MS);
      if (fresh.length !== arr.length) persistBackups(formKey, fresh); // prune expired
      return fresh;
    } catch { return []; }
  };

  const persistBackups = (formKey, arr) => {
    try { localStorage.setItem(BACKUPS_KEY_PREFIX + formKey, JSON.stringify(arr)); } catch { /* ignore */ }
  };

  const [formBackups, setFormBackups] = useState([]);
  const [backupMenuOpen, setBackupMenuOpen] = useState(false);

  useEffect(() => {
    if (selectedForm?.firebaseKey) {
      setFormBackups(loadBackups(selectedForm.firebaseKey));
    } else {
      setFormBackups([]);
    }
    setBackupMenuOpen(false);
  }, [selectedForm?.firebaseKey]);

  const summarizeDraft = (data) => {
    const pick = (keys) => {
      for (const k of keys) {
        const v = data?.[k];
        if (v != null && String(v).trim()) return String(v).trim();
      }
      return '';
    };
    const name = pick(['decedentName', 'patientName', 'caseTitle', 'name']) || '(unnamed)';
    const ooc = pick(['decedentOOC', 'oocName']);
    const dept = pick(['department', 'agency', 'faction', 'placeOfDeath', 'location']);
    return [name, ooc ? `((${ooc}))` : '', dept].filter(Boolean).join(' · ');
  };

  const formatClearTime = (ts) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  const handleClearForm = () => {
    if (selectedForm?.firebaseKey && Object.keys(formValues).length > 0) {
      const entry = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ts: Date.now(), data: formValues };
      const next = [entry, ...loadBackups(selectedForm.firebaseKey)].slice(0, MAX_BACKUPS);
      persistBackups(selectedForm.firebaseKey, next);
      setFormBackups(next);
      showNotification('Draft backed up — restore it anytime from the top of this form.', 'check-circle');
    }
    setFormValues({});
    clearBBCode();
    if (selectedForm?.firebaseKey) localStorage.removeItem(`form_progression_${selectedForm.firebaseKey}`);
  };

  const restoreBackup = (entry) => {
    if (!selectedForm?.firebaseKey) return;
    try {
      setFormValues(prev => {
        const merged = { ...entry.data };
        CREDENTIAL_KEYS.forEach(k => { if (prev[k]) merged[k] = prev[k]; });
        return merged;
      });
      const next = formBackups.filter(b => b.id !== entry.id);
      persistBackups(selectedForm.firebaseKey, next);
      setFormBackups(next);
      setBackupMenuOpen(false);
      showNotification('Draft restored from backup.', 'check-circle');
    } catch { /* ignore */ }
  };

  const dismissBackups = () => {
    if (selectedForm?.firebaseKey) {
      try { localStorage.removeItem(BACKUPS_KEY_PREFIX + selectedForm.firebaseKey); } catch { /* ignore */ }
    }
    setFormBackups([]);
    setBackupMenuOpen(false);
  };

  const clearFormBackups = () => {
    if (selectedForm?.firebaseKey) {
      try { localStorage.removeItem(BACKUPS_KEY_PREFIX + selectedForm.firebaseKey); } catch { /* ignore */ }
    }
    setFormBackups([]);
    setBackupMenuOpen(false);
  };

  // ── Sync OAuth employee credentials into formValues ──
  useEffect(() => {
    if (!selectedForm || !isAuthenticated) return;

    const currentEmployeeType = selectedForm?.accessType === 'Coroner' ? 'coroner' : 'phmc';
    const employeeNameField = `${currentEmployeeType}Employee`;

    setFormValues(currentFormValues => {
      const currentFormEmployeeName = currentFormValues[employeeNameField];
      const currentFormRank = currentFormValues[`${currentEmployeeType}Rank`];
      const currentFormBadge = currentFormValues[`${currentEmployeeType}Badge`];

      const name = String(currentFormEmployeeName || '').trim();
      const rank = String(currentFormRank || '').trim();
      const badge = String(currentFormBadge || '').trim();

      // Single source of truth — same breadth as author resolution
      // (getCharacterData), roster match by id or name, badge = roster key.
      // Never overwrite a name the user deliberately typed when the resolved
      // value differs (e.g. a different employee on a shared report) — but DO
      // correct a wrong/stale badge/rank when the stored employee matches the
      // resolved roster record (the account-id-as-badge leak, e.g. 43132 -> 5573).
      const resolved = resolveEmployeeCredentials(user, {
        factionListData,
        cleanRank: cleanRankText,
      });
      if (!resolved.employeeName) return currentFormValues;

      const employeeMatches = !!name && name.toLowerCase() === String(resolved.employeeName).trim().toLowerCase();
      const badgeMismatch = employeeMatches && !!resolved.badge && !!badge && badge !== String(resolved.badge).trim();
      const rankMismatch = employeeMatches && !!resolved.rank && !!rank && rank !== String(resolved.rank).trim();

      const updates = {};
      if (!name) updates[`${currentEmployeeType}Employee`] = resolved.employeeName;
      if (!rank || rankMismatch) updates[`${currentEmployeeType}Rank`] = resolved.rank;
      if (!badge || badgeMismatch) updates[`${currentEmployeeType}Badge`] = resolved.badge;
      updates[`${currentEmployeeType}Discord`] = resolved.discord;
      updates[`${currentEmployeeType}PHNumber`] = resolved.phNumber;
      updates[`${currentEmployeeType}FirstName`] = resolved.firstName;
      updates[`${currentEmployeeType}LastName`] = resolved.lastName;

      if (Object.keys(updates).length > 0) {
        if (resolved.matchedBy === 'none') {
          console.warn('[CredentialSync] No roster match for', resolved.employeeName, '— rank/badge may be blank until roster syncs.');
        }
        if (badgeMismatch || rankMismatch) {
          console.warn(`[CredentialSync] Corrected stale credentials for ${resolved.employeeName} (matchedBy: ${resolved.matchedBy})`, { badgeMismatch, rankMismatch, fromBadge: badge || null, toBadge: resolved.badge || null, fromRank: rank || null, toRank: resolved.rank || null });
        }
        return { ...currentFormValues, ...updates };
      }
      return currentFormValues;
    });
  }, [user, isAuthenticated, selectedForm, factionListData, cleanRankText]);

  // Live UTC clock
  const fmtUtc = (d) => { const p = n => n.toString().padStart(2,'0'); return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`; };
  const [currentUtcTime, setCurrentUtcTime] = useState(() => fmtUtc(new Date()));
  useEffect(() => { const id = setInterval(() => setCurrentUtcTime(fmtUtc(new Date())), 1000); return () => clearInterval(id); }, []);

  // ── Staging mode ──
  const [isStaging] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('staging') === '1' || localStorage.getItem('phmc_staging') === 'true';
  });
  // ── Misc modals ──
  const [showAssignedAutopsies, setShowAssignedAutopsies] = useState(false);
  const [showConsentPrefs, setShowConsentPrefs] = useState(false);
  const [showBusinessCard, setShowBusinessCard] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapTargetField, setMapTargetField] = useState(null);
  const [isUploadingMapImage, setIsUploadingMapImage] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const modalCloseTimer = useRef(null);

  // ── Deploy Countdown ──
  const [deployCountdown, setDeployCountdown] = useState(null); // { endTime: number, label: string }
  useEffect(() => {
    if (!deployCountdown) return;
    const interval = setInterval(() => {
      const remaining = deployCountdown.endTime - Date.now();
      if (remaining <= 0) { setDeployCountdown(null); clearInterval(interval); return; }
      setDeployCountdown(prev => prev ? { ...prev } : null);
    }, 1000);
    return () => clearInterval(interval);
  }, [deployCountdown?.endTime]);

  // ── Pending Autopsies (bell dropdown) ──
  const [pendingAutopsies, setPendingAutopsies] = useState([]);
  const [showAutopsyBell, setShowAutopsyBell] = useState(false);
  const bellRef = useRef(null);
  const charSwitchRef = useRef(null);
  const charSwitchLogged = useRef(false);
  useEffect(() => {
    const isLocalHost = window.location.hostname === 'localhost';
    const r = ref(database, 'autopsy-requested');
    const unsub = onValue(r, (snap) => {
      const data = snap.val();
      const list = [];
      if (data) {
        Object.entries(data)
          .filter(([, v]) => v.assignedTo && v.wasMatch && !v.completedAt)
          .forEach(([key, v]) => {
            const detected = v.detectedAt ? new Date(v.detectedAt).getTime() : Date.now();
            const hours = ((Date.now() - detected) / 3600000).toFixed(1);
            list.push({ key, name: v.name || 'Unknown', oocName: v.oocName || '', assignedTo: v.assignedTo || 'Unassigned', hours, detectedAt: v.detectedAt });
          });
      }
      // On localhost, ensure at least one mock entry so the UI is visible
      if (isLocalHost && list.length === 0) {
        list.push({
          key: 'dev-demo',
          name: 'Marcus Johnson',
          oocName: 'DevTest_Player',
          assignedTo: 'Dr. Alyson Frost',
          hours: '2.5',
          detectedAt: new Date(Date.now() - 9000000).toISOString(),
        });
      }
      setPendingAutopsies(list);
    });
    return () => unsub();
  }, []);

  // Close bell dropdown on outside click
  useEffect(() => {
    if (!showAutopsyBell) return;
    const handler = (e) => { if (bellRef.current && !bellRef.current.contains(e.target)) setShowAutopsyBell(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAutopsyBell]);

  // Close char switch dropdown on outside click
  useEffect(() => {
    if (!showCharSwitch) return;
    const handler = (e) => { if (charSwitchRef.current && !charSwitchRef.current.contains(e.target)) setShowCharSwitch(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCharSwitch]);

  // ── Saved Reports ──
  const { savedReports, isLoadingReports, loadUserSavedReports, loadReportForUser } = useReportLoader();
  const { deleteReportForUser } = useReportActions();

  // ── Fix Deployed Report (Edit & Repost) ──
  const [editingDeployedReport, setEditingDeployedReport] = useState(null); // { key, label }
  const [showFixDeployedReport, setShowFixDeployedReport] = useState(false);

  // Wrapper to properly populate form fields when loading a saved report
  const handleLoadReport = useCallback((report, userId) => {
    return loadReportForUser(
      report, userId, false,
      setFormValues,
      selectedForm,
      setSelectedForm,
      () => formsData
    );
  }, [loadReportForUser, setFormValues, selectedForm, setSelectedForm, formsData]);

  // ── Report Attachment (attach reports to coroner email, etc.) ──
  const {
    toggleSavedReports,
    showSavedReports,
    setShowSavedReports,
    handleReportSelectedForAttachment,
    preselectedEmployeeType,
    reportSelectionFilter,
    pendingReportAttachmentCallback,
    currentAttachmentTargetFieldRef,
    isAttachMode,
  } = useReportAttachment(
    loadReportForUser,
    formValues, setFormValues, selectedForm, showNotification, removeNotification, modalCloseTimer,
    validateMembership
  );

  const handleNavToggleSavedReports = useCallback(() => {
    let type = 'PHMC';
    if (selectedForm) {
      if (selectedForm.accessType === 'Coroner' || (selectedForm.primaryFor && selectedForm.primaryFor.includes('coroner'))) {
        type = 'Coroner';
      }
    }
    toggleSavedReports(null, type, null);
  }, [toggleSavedReports, selectedForm]);

  const savedReportEmployeeOptions = useMemo(() => {
    if (!factionsData || !factionsData['364'] || !factionsData['364'].members) return [];
    const options = Object.entries(factionsData['364'].members).map(([id, m]) => ({
      value: m.characterName || m.name || id,
      label: m.characterName || m.name || id,
    }));
    return [{ label: 'PHMC Staff', options }];
  }, [factionsData]);

  const handleMapSelect = useCallback((locationData) => {
    if (mapTargetField && locationData) {
      console.log('[Prototype] Map selected:', locationData);
      const { name: formattedName, rawName, isFromMap } = locationData;
      if (isFromMap) {
        handleChange(`${mapTargetField}_isFromMap`, true);
        handleChange(`${mapTargetField}_display`, rawName || formattedName);
      }
      handleChange(mapTargetField, formattedName || rawName || '');
    }
    setShowMapModal(false);
    setMapTargetField(null);
  }, [mapTargetField, handleChange]);

  const navigateTo = (path) => {
    window.location.hash = `#${path}`;
  };

  // ── Collapsible sidebar categories ──
  const [collapsedCats, setCollapsedCats] = useState(new Set());
  const toggleCat = (name) => {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const activeForm = formForRender;
  const displayName = characterName || user?.username || 'Guest';
  const userRole = cleanRankText(factionData?.rank) || cleanRankText(user?.faction?.rank) || 'Employee';

  // ── Employee image signature (non-DMEC PHMC Staff forms) ──
  // Toggle at the top of the form -> modal to paste the signature URL -> preview
  // -> approve. Stored in formValues.phmcSignature + persisted per character.
  const DMEC_CORONER_FORMS = ['autopsy', 'coroner-report', 'coroner_email', 'death_record', 'mass-ftality-test'];
  const signatureEnabled = !!selectedForm && !DMEC_CORONER_FORMS.includes(selectedForm.firebaseKey);
  const [sigOpen, setSigOpen] = useState(false);
  const [sigUrl, setSigUrl] = useState('');
  const sigStorageKey = `phmcSignature_${(characterName || '').trim().toLowerCase()}`;

  const isSurgicalDev = selectedForm?.firebaseKey === 'surgical' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const [surgicalDiagramOpen, setSurgicalDiagramOpen] = useState(false);
  const [surgicalDiagram, setSurgicalDiagram] = useState({ imageType: 'male', texts: [], shapes: [] });

  // Auto-fill the approved signature for this character from a previous session.
  useEffect(() => {
    if (!signatureEnabled) return;
    try {
      const saved = localStorage.getItem(sigStorageKey);
      console.log('[SIGTRACE] auto-fill effect', { signatureEnabled, sigStorageKey, saved: saved ? saved.slice(0, 60) : null });
      if (saved && /^https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i.test(saved)) {
        setFormValues(prev => {
          if (prev.phmcSignature === saved) return prev;
          console.log('[SIGTRACE] auto-fill SETTING phmcSignature from localStorage →', saved.slice(0, 60), '| prev was', (prev.phmcSignature || '').slice(0, 60) || '(empty)');
          return { ...prev, phmcSignature: saved };
        });
      } else {
        console.log('[SIGTRACE] auto-fill: no valid saved signature, leaving formValues.phmcSignature =', (formValues.phmcSignature || '').slice(0, 60) || '(empty)');
      }
    } catch (e) { console.error('[SIGTRACE] auto-fill error', e); }
  }, [sigStorageKey, signatureEnabled, formValues.phmcSignature]);

  const openSignatureModal = () => {
    setSigUrl(String(formValues.phmcSignature || ''));
    setSigOpen(true);
  };

  const approveSignature = () => {
    const url = String(sigUrl || '').trim();
    const pass = /^https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i.test(url);
    console.log('[SIGTRACE] approveSignature called', { url, pass, sigUrlType: typeof sigUrl, sigUrl, sigStorageKey });
    if (!pass) return;
    setFormValues(prev => ({ ...prev, phmcSignature: url }));
    try { localStorage.setItem(sigStorageKey, url); } catch { /* ignore */ }
    console.log('[SIGTRACE] phmcSignature SET in formValues →', url, '| stored under', sigStorageKey);
    setSigOpen(false);
  };

  const handleSigPaste = async (e) => {
    const items = e && e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item && item.type && item.type.indexOf('image') === 0) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        try {
          const urls = await handleImageUpload(file, 'phmcSignature');
          if (urls && urls[0]) setSigUrl(urls[0]?.url || '');
        } catch (err) {
          showNotification('Signature paste failed: ' + (err?.message || err), 'error');
        }
        return;
      }
    }
  };

  const clearSignature = () => {
    console.log('[SIGTRACE] clearSignature called — removing phmcSignature from formValues + localStorage', { sigStorageKey });
    setFormValues(prev => {
      const next = { ...prev };
      delete next.phmcSignature;
      return next;
    });
    try { localStorage.removeItem(sigStorageKey); } catch { /* ignore */ }
  };

  return (
    <div className="app">

      {/* ═══ LEFT SIDEBAR ═══ */}
      <div className="sidebar">
        <div className="sidebar-head">
          <div className="brand">
            <div className="brand-mark">
<img src={phmcLogo} alt="PHMC" style={{ width: 22, height: 22, objectFit: 'contain' }} />            </div>
            <div className="brand-text">
              <div className="t1">PHMC Tools</div>
              <div className="t2">{isAuthenticated ? characterName || 'Authenticated' : 'Not signed in'}</div>
            </div>
          </div>
          <div className="search-box">
            <input ref={searchRef} type="text" placeholder={activeView === 'ems' ? 'Search protocols…' : 'Search forms…'} value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="form-tree">
          <div className="cat open">
            <div className="cat-head"><span><i className="fas fa-language" style={{ marginRight: 6, color: 'var(--teal)' }} />Translations</span></div>
            <div className="cat-items">
              <div onClick={() => navigateTo('/translate')} className="form-item">
                <span className="dot" />Translate Forms
              </div>
            </div>
          </div>
          {!basicMode && (
            <>
              <div className={`cat${!collapsedCats.has('Tools') ? ' open' : ''}`}>
                <div className="cat-head" onClick={() => toggleCat('Tools')}><span>Morgue Intake Records</span><span className="chev">▶</span></div>
                <div className="cat-items">
                  <div onClick={() => { setActiveView('morgue'); setSelectedForm(null); setFormValues({}); }}
                    className={`form-item${activeView === 'morgue' ? ' active' : ''}`}>
                    <span className="dot" />Morgue Records
                  </div>
                </div>
              </div>

              {/* ── EMS Protocols — own top-level category ── */}
              <div className={`cat ems-root${emsOpen ? ' open' : ''}`}>
                <div className="cat-head" onClick={toggleEms}><span>EMS Protocols</span><span className="chev">▶</span></div>
                <div className="cat-items">
                  {filteredEmsProtocols.map(cat => (
                    <div key={cat.category} className={`cat ems-subcat${!emsCollapsed.has(cat.category) ? ' open' : ''}`}>
                      <div className="cat-head ems-subhead" onClick={() => toggleEmsCat(cat.category)}>
                        {cat.category} ({cat.protocols.length})<span className="chev">▶</span>
                      </div>
                      <div className="cat-items">
                        {cat.protocols.map(p => (
                          <div key={p.id}
                            onClick={() => { setSelectedEmsProtocol(p); setActiveView('ems'); setSelectedForm(null); setFormValues({}); }}
                            className={`form-item ems-protocol${selectedEmsProtocol?.id === p.id && activeView === 'ems' ? ' active' : ''}`}>
                            <span className="dot" />{p.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {filteredEmsProtocols.length === 0 && (
                    <div className="ems-empty">No protocols match.</div>
                  )}
                </div>
              </div>

              <div className={`cat${!collapsedCats.has('Administration') ? ' open' : ''}`}>
                <div className="cat-head" onClick={() => toggleCat('Administration')}><span>Administration</span><span className="chev">▶</span></div>
                <div className="cat-items">
                  <div onClick={() => navigateTo('/admin')} className="form-item">
                    <span className="dot" />Admin Panel
                  </div>
                </div>
              </div>
            </>
          )}
          {Object.entries(groupedForms).map(([cat, forms]) => (
            <div key={cat} className={`cat${!collapsedCats.has(cat) ? ' open' : ''}`}>
              <div className="cat-head" onClick={() => toggleCat(cat)}><span>{cat}</span><span className="chev">▶</span></div>
              <div className="cat-items">
                {forms.map(form => (
                  <div key={form.firebaseKey}
                    onClick={() => { setSelectedForm(form); setFormValues(prev => {
                      // Preserve live OAuth credentials across form switches so
                      // the restore effect can merge them back (Fix E).
                      const keep = {};
                      CREDENTIAL_KEYS.forEach(k => { if (prev[k]) keep[k] = prev[k]; });
                      return keep;
                    }); clearBBCode(); setActiveView('forms'); }}
                    className={`form-item${selectedForm?.firebaseKey === form.firebaseKey ? ' active' : ''}`}>
                    <span className="dot" />{form.name}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ MAIN WRAPPER ═══ */}
      <div className="main-wrap">

        {/* ═══ TOP BAR ═══ */}
        <div className="topbar">
          <div className="topbar-title">
            <h1>{activeView === 'morgue' ? 'Morgue Records' : activeView === 'ems' ? 'LS County EMS Protocols' : activeForm?.name || 'No Form Selected'}</h1>
            {activeView === 'morgue' ? <span className="case-tag">Database</span> : activeView === 'ems' ? <span className="case-tag">Protocols</span> : activeForm && <span className="case-tag">{activeForm.accessType || 'General'}</span>}
            {availableLangs.length > 0 && activeView === 'forms' && (
              <select
                value={lang}
                onChange={(e) => { setLang(e.target.value); clearBBCode(); }}
                title="Form language"
                style={{ marginLeft: 10, background: 'var(--bg-surface)', border: '1px solid var(--border-accent)', color: 'var(--text)', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}
              >
                <option value="">English (default)</option>
                {availableLangs.map(({ code, langName }) => (
                  <option key={code} value={code}>{langName}</option>
                ))}
              </select>
            )}
          </div>
          <div className="topbar-center">
            <ServiceStatusTicker />
          </div>
          <div className="topbar-actions">
                        <div className="status-pill">
              <span className="led" style={{
                background: isAuthenticated ? 'var(--teal)' : 'var(--amber)',
                boxShadow: isAuthenticated ? '0 0 6px var(--teal)' : '0 0 6px var(--amber)',
              }} />
              {isAuthenticated ? 'Connected' : 'Offline'}
            </div>

            <TimeDisplay compact />
            {isMedicalExaminer && (
            <div ref={bellRef} style={{ position: 'relative' }}>
              <div className="icon-btn" title="Pending Autopsies" onClick={() => setShowAutopsyBell(p => !p)} style={{ position: 'relative' }}>
                <i className="fas fa-bell" />
                {pendingAutopsies.length > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16,
                    borderRadius: 8, background: 'var(--danger)', color: '#fff',
                    fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px', lineHeight: 1,
                  }}>{pendingAutopsies.length}</span>
                )}
              </div>
              {showAutopsyBell && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 1100,
                  width: 360, background: 'var(--bg-elevated)', border: '1px solid var(--border-accent)',
                  borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', overflow: 'hidden',
                }}>
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    Pending Autopsies ({pendingAutopsies.length})
                  </div>
                  {pendingAutopsies.length === 0 ? (
                    <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: 12.5, color: 'var(--text-faint)' }}>
                      No outstanding autopsies.
                    </div>
                  ) : (
                    <div style={{ maxHeight: 320, overflow: 'auto' }}>
                      {pendingAutopsies.map(a => (
                        <div key={a.key} onClick={() => { setShowAssignedAutopsies(true); setShowAutopsyBell(false); }}
                          style={{
                            padding: '11px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                            {a.name}{a.oocName ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> (({a.oocName}))</span> : ''}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                            <span style={{ fontSize: 11, color: 'var(--teal)', fontFamily: 'var(--mono)' }}>
                              <i className="fas fa-user-md" style={{ marginRight: 4, fontSize: 10 }} />{a.assignedTo}
                            </span>
                            <span style={{ fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                              <i className="fas fa-clock" style={{ marginRight: 3 }} />{a.hours}h
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--teal)', cursor: 'pointer' }}
                      onClick={() => { setShowAssignedAutopsies(true); setShowAutopsyBell(false); }}>
                      View All Assigned Autopsies →
                    </span>
                  </div>
                </div>
              )}
            </div>
            )}
            <div className="icon-btn" title="Auto-Deploy Preferences" onClick={() => setShowConsentPrefs(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, width: 'auto', padding: '0 10px' }}>
              <i className="fas fa-toggle-on" style={{ fontSize: 11 }} />
              <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', fontWeight: 600, whiteSpace: 'nowrap' }}>Deploy Consent</span>
            </div>
          </div>
        </div>

        {/* ═══ CONTENT ROW ═══ */}
        <div className="content-row">

          {/* ─── MAIN CONTENT ─── */}
          <div className="main-content" key={activeView === 'morgue' ? 'morgue' : activeView === 'ems' ? 'ems' : activeForm?.firebaseKey || 'empty'}>
            {activeView === 'ems' ? (
              <EmsPanel protocol={selectedEmsProtocol} injuries={emsInjuries} selectedInjury={selectedEmsInjury}
                onSelectInjury={setSelectedEmsInjury} onClearInjury={() => setSelectedEmsInjury(null)} />
            ) : activeView === 'morgue' ? (
              <MorgueBrowser records={morgueRecords || []} isLoading={morgueLoading || isLoadingData} loadRecords={loadMorgueRecords} showNotification={showNotification}
                isAuthenticated={isAuthenticated} characterName={characterName} user={realUser} />
            ) : activeForm ? (
              <>
                <div className="doc-header">
                  <div className="doc-eyebrow">{activeForm.category || 'Form'} / {activeForm.name}</div>
                  <h2>{activeForm.name}</h2>
                  {activeForm.formDescription && (
                    <div className="doc-desc">
                      <i className="fas fa-info-circle" style={{ marginTop: 1 }} />
                      <span>{activeForm.formDescription}</span>
                    </div>
                  )}
                  {isStaging && (
                    <div style={{
                      marginTop: 10, padding: '8px 12px', borderRadius: 7,
                      background: 'var(--amber-dim)', border: '1px solid var(--amber)',
                      color: 'var(--amber)', fontSize: 12, display: 'flex', gap: 8, alignItems: 'center',
                    }}>
                      <i className="fas fa-flask" />
                      <span><strong>Staging Mode</strong> — Forms loaded from <code style={{ fontFamily: 'var(--mono)' }}>forms_staging</code></span>
                    </div>
                  )}
                </div>
                <div className="doc-body">
                  {formBackups.length > 0 && selectedForm && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--amber)', borderRadius: 8 }}>
                      <i className="fas fa-history" style={{ color: 'var(--amber)' }} />
                      <span style={{ fontSize: 12, color: 'var(--text)', flex: 1, minWidth: 0 }}>
                        {formBackups.length} cleared draft{formBackups.length !== 1 ? 's' : ''} backed up (auto-delete after 48h) — restore to recover your work (incl. pasted images).
                      </span>
                      <div style={{ position: 'relative' }}>
                        <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px', whiteSpace: 'nowrap' }} onClick={() => setBackupMenuOpen(o => !o)}>
                          <i className="fas fa-undo me-1" />Restore progress
                          <i className={`fas fa-chevron-${backupMenuOpen ? 'up' : 'down'}`} style={{ marginLeft: 6, fontSize: 9 }} />
                        </button>
                        {backupMenuOpen && (
                          <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', minWidth: 280, maxHeight: formBackups.length > 4 ? 280 : 'none', overflowY: formBackups.length > 4 ? 'auto' : 'visible', background: 'var(--bg-elevated)', border: '1px solid var(--border-accent)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 60 }}>
                            {formBackups.map((b, i) => (
                              <button key={b.id} onClick={() => restoreBackup(b)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', borderBottom: i < formBackups.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', textAlign: 'left' }}>
                                <span style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                                  <i className="fas fa-undo me-1" style={{ color: 'var(--amber)', fontSize: 10 }} />
                                  {summarizeDraft(b.data)}
                                </span>
                                <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                                  <i className="fas fa-clock me-1" style={{ fontSize: 9 }} />Cleared {formatClearTime(b.ts)}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 10px', whiteSpace: 'nowrap' }} onClick={dismissBackups}>
                        Dismiss
                      </button>
                    </div>
                  )}
                  {signatureEnabled && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-accent)', borderRadius: 8 }}>
<label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, color: 'var(--text)', whiteSpace: 'nowrap', margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={!!formValues.phmcSignature}
                          onChange={(e) => { if (e.target.checked) { openSignatureModal(); } else { clearSignature(); } }}
                          style={{ width: 15, height: 15, margin: 0, flexShrink: 0, verticalAlign: 'middle' }}
                        />
                        <i className="fas fa-signature" style={{ color: 'var(--teal)', fontSize: 13, flexShrink: 0, display: 'inline-block' }} />
                        Use employee signature
                      </label>
                      {formValues.phmcSignature ? (
                        <>
                          <img src={formValues.phmcSignature} alt="signature" style={{ height: 34, maxWidth: 180, objectFit: 'contain', borderRadius: 4, background: '#fff', padding: 2 }} />
                          <button onClick={openSignatureModal} style={{ background: 'transparent', border: 'none', color: 'var(--teal)', cursor: 'pointer', fontSize: 12 }}>Change</button>
                        </>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Not set — report will show the typed employee name.</span>
                      )}
                    </div>
                  )}
                  <div className="field-grid">
                    {(activeForm.fields || []).filter(f => evaluateFieldVisibility(f, formValues)).map(field => (
                      <div key={field.name} className={!field.layout || field.layout === 'full' ? 'full' : ''} style={{ display: 'contents' }}>
                        <PrototypeFieldRenderer field={field} value={formValues[field.name]} onChange={val => handleChange(field.name, val)} allValues={formValues} onFieldChange={handleChange}
                          factionsData={factionsData}
                          morgueRecords={morgueRecords}
                          isLoadingData={isLoadingData}
                          loadMorgueRecords={loadMorgueRecords}
                          showNotification={showNotification}
                          currentUtcTime={currentUtcTime}
                          finalSelectOptions={finalSelectOptions}
                          agencyDataStore={agencyDataStore}
                          setShowMapModal={setShowMapModal}
                          setMapTargetField={setMapTargetField}
                          isUploadingMapImage={isUploadingMapImage}
                          isUploading={isUploading}
                          toggleSavedReports={toggleSavedReports}
                          openImagePreview={openImagePreview}
                        />
                      </div>
                    ))}
                  </div>
                  {isSurgicalDev && (
                    <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px dashed var(--amber)', borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <i className="fas fa-syringe" style={{ color: 'var(--amber)' }} />
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
                          Surgical Diagram <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--amber)', fontFamily: 'var(--mono)', marginLeft: 6 }}>DEV</span>
                        </span>
                        <button className="btn btn-primary" style={{ marginLeft: 'auto', fontSize: 12, padding: '6px 14px' }} onClick={() => setSurgicalDiagramOpen(true)}>
                          <i className="fas fa-edit me-1" />Annotate
                        </button>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: '6px 0 0' }}>
                        Full-screen annotation layer over the body silhouette — optional, visual only. Male/female toggle, free text, drag, resize.
                      </p>
                    </div>
                  )}
                </div>
                <div className="doc-footer" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, maxWidth: 300 }}>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-surface)', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: 'var(--teal)', transition: 'width 0.3s ease' }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
                      {filledFields}/{totalFields}
                    </span>
                  </div>
                  <button className="btn btn-ghost" onClick={handleClearForm}>
                    <i className="fas fa-trash-alt me-1" /> Clear Form
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', gap: 16 }}>
                <i className="fas fa-file-medical" style={{ fontSize: 48, opacity: 0.3 }} />
                <p style={{ fontSize: 15, margin: 0 }}>Select a form from the sidebar</p>
              </div>
            )}
          </div>

          {/* ─── RIGHT PANEL ─── */}
          <div className="right-panel">
              <div className="panel-card">
                {basicMode ? (
                  <div className="panel-section active">
                    <div className="id-badge">
                      <div className="id-avatar" style={{ background: 'var(--bg-surface)', color: 'var(--text-faint)', border: '1px solid var(--border-accent)' }}>
                        <i className="fas fa-file-alt" />
                      </div>
                      <div>
                        <div className="id-name">PHMC Forms</div>
                        <div className="id-role">Basic Mode — Generate Forms</div>
                      </div>
                    </div>
                    <div className="patient-note" style={{ background: 'var(--bg-surface)', color: 'var(--text-faint)', border: '1px solid var(--border)', marginTop: 14 }}>
                      <span>ℹ️</span>
                      <span>Select a form, fill it out, and use <strong>Preview</strong> to generate the BBCode. Sign-in is not required.</span>
                    </div>
                  </div>
                ) : (
                  <>
                <div className="panel-tabs">
                  <div onClick={() => setActiveMiscTab('profile')}
                    className={`panel-tab${activeMiscTab === 'profile' ? ' active' : ''}`}>
                    <i className="fas fa-user-circle" /> Profile
                  </div>
                  <div onClick={() => setActiveMiscTab('misc')}
                    className={`panel-tab${activeMiscTab === 'misc' ? ' active' : ''}`}>
                    <i className="fas fa-cogs" /> Misc
                  </div>
                </div>

              {activeMiscTab === 'profile' && (
                <div className="panel-section active">
                  <div className="id-badge">
                    <div className="id-avatar" style={{
                      background: isAuthenticated && isPhmcMember ? 'var(--teal-dim)' : 'var(--bg-surface)',
                      color: isAuthenticated && isPhmcMember ? 'var(--teal)' : 'var(--text-faint)',
                      border: isAuthenticated && isPhmcMember ? '1px solid var(--teal)' : '1px solid var(--border-accent)',
                    }}>
                      <i className={`fas ${isAuthenticated && isPhmcMember ? 'fa-user-md' : isAuthenticated ? 'fa-user' : 'fa-user-md'}`} />
                    </div>
                    <div>
                      <div className="id-name">{displayName}</div>
                      <div className="id-role">{isAuthenticated ? (cleanRankText(factionData?.rank) || (isPhmcMember ? 'PHMC Staff' : 'Non Employee')) : 'Not signed in'}</div>
                    </div>
                  </div>
                  {isAuthenticated && (
                    <>
                      {identityRefreshStatus === 'refreshing' && (
                        <div className="patient-note" style={{ background: 'var(--teal-dim)', color: 'var(--teal)', border: '1px solid var(--teal)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                            border: '2px solid var(--teal-dim)', borderTopColor: 'var(--teal)',
                            animation: 'spin 0.8s linear infinite',
                          }} />
                          <span>
                            Welcome back {cleanRankText(factionData?.rank) ? `${cleanRankText(factionData?.rank)} ` : ''}{characterName || realUser?.username || 'Member'}, verifying your credentials&hellip;
                          </span>
                        </div>
                      )}
                      {!isPhmcMember && !factionData?.rank && (
                        <div className="patient-note" style={{ background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid rgba(232,163,61,0.25)', marginBottom: 14 }}>
                          <span>ℹ️</span>
                          <span><strong>Non Employee</strong> — You have limited access. Morgue Records and public forms are available.</span>
                        </div>
                      )}
                      <div className="field">
                        <label>{isPhmcMember ? 'Employee Name' : 'User'}</label>
                        <div style={{
                          padding: '10px 12px', background: 'var(--bg-surface)', borderRadius: 8,
                          border: '1px solid var(--border)', fontSize: 13, color: 'var(--text)',
                        }}>
                          {characterName || user?.username || 'Unknown'}
                        </div>
                      </div>
                      {credentialsLoading && (
                        <div className="field">
                          <label>Status</label>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '10px 12px', background: 'var(--bg-surface)', borderRadius: 8,
                            border: '1px solid var(--teal-dim)', fontSize: 13, color: 'var(--teal)',
                          }}>
                            <div style={{
                              width: 14, height: 14, borderRadius: '50%',
                              border: '2px solid var(--teal-dim)', borderTopColor: 'var(--teal)',
                              animation: 'spin 0.8s linear infinite',
                            }} />
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                            Fetching credentials...
                          </div>
                        </div>
                      )}
                      {factionData?.rank && (
                        <div className="field">
                          <label>Rank</label>
                          <div style={{
                            padding: '10px 12px', background: 'var(--bg-surface)', borderRadius: 8,
                            border: '1px solid var(--border)', fontSize: 13, color: 'var(--text)',
                          }}>
                            {cleanRankText(factionData.rank)}
                          </div>
                        </div>
                      )}
                      <div className="field">
                        <label>Access Level</label>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', overflow: 'hidden' }}>
                          <span className="status-badge reviewed" style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{accessLevel || 'member'}</span>
                          {isPhmcMember && <span className="status-badge reviewed" style={{ flexShrink: 0 }}>PHMC Member</span>}
                        </div>
                      </div>
                      {/* Switch / Sign Out row */}
                {editingDeployedReport && (
                  <div style={{
                    marginBottom: 8, padding: '7px 9px', borderRadius: 6, fontSize: 11.5,
                    background: 'var(--teal-dim)', border: '1px solid var(--teal)', color: 'var(--teal)',
                    display: 'flex', gap: 6, alignItems: 'center',
                  }}>
                    <i className="fas fa-pen" />
                    <span>
                      Editing deployed report{editingDeployedReport.label ? `: ${editingDeployedReport.label}` : ''} —
                      Save will queue an in-place forum edit (no duplicate).
                    </span>
                    <button onClick={() => setEditingDeployedReport(null)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--teal)', cursor: 'pointer', fontSize: 12 }} title="Cancel edit">
                      ✕
                    </button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        {canSwapCharacters && (
                          <div ref={charSwitchRef} style={{ position: 'relative', flex: 1 }}>
                            <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
                              onClick={() => {
                                if (!charSwitchLogged.current) {
                                  charSwitchLogged.current = true;
                                  console.log('[CharSwitch] swappableCharacters:', JSON.parse(JSON.stringify(swappableCharacters)));
                                  console.log('[CharSwitch] factionData:', JSON.parse(JSON.stringify(factionData)));
                                  console.log('[CharSwitch] isPhmcMember:', isPhmcMember, 'characterName:', characterName);
                                }
                                setShowCharSwitch(prev => !prev);
                              }}>
                              <i className="fas fa-exchange-alt me-1" /> Switch
                            </button>
                            {showCharSwitch && (
                              <div style={{
                                position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 6,
                                background: 'var(--bg-elevated)', border: '1px solid var(--border-accent)',
                                borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', overflow: 'hidden',
                                zIndex: 100,
                              }}>
                                <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                  Switch Character
                                </div>
                                {swappableCharacters.map(c => {
                                  const isActive = String(c.id) === String(factionData?.characterId || factionData?.id);
                                  return (
                                    <div key={c.id}
                                      onClick={() => { swapCharacter(c); setShowCharSwitch(false); }}
                                      style={{
                                        padding: '10px 12px', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        background: isActive ? 'var(--teal-dim)' : 'transparent',
                                        borderBottom: '1px solid var(--border)',
                                        transition: 'background 0.15s',
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                                      onMouseLeave={e => e.currentTarget.style.background = isActive ? 'var(--teal-dim)' : 'transparent'}
                                    >
                                      <div style={{
                                        width: 28, height: 28, borderRadius: '50%',
                                        background: c.isFactionMember ? 'var(--teal-dim)' : 'var(--bg-surface)',
                                        color: c.isFactionMember ? 'var(--teal)' : 'var(--text-muted)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 12, fontWeight: 600, flexShrink: 0,
                                      }}>
                                        {c.characterName?.charAt(0) || '?'}
                                      </div>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {c.characterName}
                                          {isActive && <span style={{ color: 'var(--teal)', marginLeft: 6 }}>✓</span>}
                                        </div>
                                        <div style={{ fontSize: 10.5, color: c.isFactionMember ? 'var(--teal)' : 'var(--text-faint)', marginTop: 2 }}>
                                          {c.isFactionMember ? (c.rank || 'PHMC Staff') : 'Non Employee'}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                        <button className="btn btn-ghost" style={{ flex: canSwapCharacters ? 1 : undefined, width: canSwapCharacters ? undefined : '100%', justifyContent: 'center', fontSize: 12 }}
                          onClick={() => { logout(); window.location.reload(); }}>
                          <i className="fas fa-sign-out-alt me-1" /> Sign Out
                        </button>
                      </div>
                    </>
                  )}
                  {isLocalhostDev && (
                    <div style={{ padding: '12px 0' }}>
                      <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: 11, borderColor: 'var(--amber)', color: 'var(--amber)' }}
                        onClick={() => {
                          setDeployCountdown({ endTime: Date.now() + 150000, label: 'Test Report' });
                          // Multi-step progress notification — updates lines as each step completes
                          showNotification(
                            '[PK] John Doe ((DevTest)) 27/JUL/2026\n' +
                            '├ Queued for auto-deploy',
                            'cloud-upload-alt', 0, { key: 'deploy-progress' }
                          );
                          setTimeout(() => showNotification(
                            '[PK] John Doe ((DevTest)) 27/JUL/2026\n' +
                            '├ Queued for auto-deploy  ✅\n' +
                            '└ Deploying to Case Management...',
                            'spinner fa-spin', 0, { key: 'deploy-progress' }
                          ), 500);
                          setTimeout(() => showNotification(
                            '[PK] John Doe ((DevTest)) 27/JUL/2026\n' +
                            '├ Queued for auto-deploy  ✅\n' +
                            '├ Reply posted to #9837  ✅\n' +
                            '└ LSPD Crosspost...',
                            'spinner fa-spin', 0, { key: 'deploy-progress' }
                          ), 3000);
                          setTimeout(() => showNotification(
                            '[PK] John Doe ((DevTest)) 27/JUL/2026\n' +
                            '├ Queued for auto-deploy  ✅\n' +
                            '├ Reply posted to #9837  ✅\n' +
                            '└ LSPD Crosspost — Created topic #127703  ✅',
                            'check-circle', 6000, { key: 'deploy-progress' }
                          ), 5500);
                        }}>
                        <i className="fas fa-vial me-1" /> Test Notification Flow
                      </button>
                    </div>
                  )}
                  {(authChecking || authLoading) && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '30px 0' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--teal)', animation: 'spin 0.8s linear infinite' }} />
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{authLoading ? 'Signing in...' : 'Checking authentication...'}</div>
                    </div>
                  )}
                  {!isAuthenticated && !authChecking && !authLoading && (
                    <>
                      <div className="patient-note" style={{ background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid rgba(232,163,61,0.25)' }}>
                        <span>⚠️</span>
                        <span>Not signed in — some forms may be hidden.</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                        <button className="btn btn-primary" style={{ justifyContent: 'center', width: '100%' }}
                          onClick={() => setShowLoginDialog(true)}>
                          <i className="fas fa-sign-in-alt me-1" /> Login
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeMiscTab === 'misc' && (
                <div className="panel-section active">
                  <div className="misc-item reports"
                    onClick={() => handleNavToggleSavedReports()}>
                    <div className="misc-icon"><i className="fas fa-save" /></div>
                    <div><div className="misc-title">Saved Reports</div><div className="misc-sub">Load, attach, or delete drafts</div></div>
                    <div className="arrow">›</div>
                  </div>
                  <div className="misc-item fix-deployed"
                    onClick={() => setShowFixDeployedReport(true)}>
                    <div className="misc-icon"><i className="fas fa-pen" /></div>
                    <div><div className="misc-title">Fix Deployed Report</div><div className="misc-sub">Edit a posted report in place</div></div>
                    <div className="arrow">›</div>
                  </div>
                  <div className="misc-item business-card"
                    onClick={() => setShowBusinessCard(true)}>
                    <div className="misc-icon"><i className="fas fa-id-card" /></div>
                    <div><div className="misc-title">Business Card</div><div className="misc-sub">Generate and upload your ID card</div></div>
                    <div className="arrow">›</div>
                  </div>
                  {selectedForm?.firebaseKey === 'autopsy' && (
                    <div className="misc-item autopsy"
                      onClick={() => setShowAssignedAutopsies(true)}>
                      <div className="misc-icon"><i className="fas fa-microscope" /></div>
                      <div><div className="misc-title">Assigned Autopsies</div><div className="misc-sub">Open your case queue</div></div>
                      <div className="arrow">›</div>
                    </div>
                  )}
                  <div className="misc-item admin"
                    onClick={() => navigateTo('/admin')}>
                    <div className="misc-icon"><i className="fas fa-shield-alt" /></div>
                    <div><div className="misc-title">Admin Panel</div><div className="misc-sub">User management, form config</div></div>
                    <div className="arrow">›</div>
                  </div>
                  <div className="misc-item" style={{ borderColor: formConsent ? 'var(--teal)' : 'var(--amber)' }}
                    onClick={() => setShowConsentPrefs(true)}>
                    <div className="misc-icon" style={{ background: formConsent ? 'var(--teal-dim)' : 'var(--amber-dim)', color: formConsent ? 'var(--teal)' : 'var(--amber)' }}>
                      <i className="fas fa-toggle-on" /></div>
                    <div><div className="misc-title">Auto-Deploy Preferences</div><div className="misc-sub">Manage which forms deploy to the forum</div></div>
                    <div className="arrow">›</div>
                  </div>
                </div>
              )}
                  </>
                )}
            </div>

            <div className="panel-card" style={{ overflow: 'visible' }}>
              <div className="bbcode-panel">
                {bbcodeToolsVisible && (
                <div className={`bbcode-banner ${generatedTitle ? 'success' : ''}`}
                  style={!generatedTitle ? { border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-faint)' } : {}}
                  onClick={() => {
                    if (generatedTitle) {
                      navigator.clipboard.writeText(generatedTitle);
                      showNotification('Title copied!', 'check-circle');
                    }
                  }}
                  title={generatedTitle ? 'Click to copy title' : ''}>
                  <i className="fas fa-code" /> {generatedTitle || 'Generated BBCode will appear here'}
                  {generatedTitle && <i className="fas fa-copy" style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.6 }} />}
                </div>
                )}
                {isMedicalRecord && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                      <i className="fas fa-user" style={{ color: 'var(--teal)', fontSize: 11 }} />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Patient Name</span>
                      <span style={{ color: 'var(--danger)' }}>*</span>
                    </div>
                    <PatientSearch
                      value={patientName}
                      onSelect={(name, id) => {
                        // Write the patient name to BOTH decedentName and patientName —
                        // decedentName is what the bot's thread search + BBCode use for
                        // the subject, patientName keeps {{patientName}} placeholders and
                        // older consumers accurate. A selected match sets patientID; typing
                        // (id === null) CLEARS it so a new patient never inherits a previous
                        // selection's ID (e.g. "Alyson Test" must not reuse Alyson Frost's 1424).
                        setFormValues(prev => ({
                          ...prev,
                          decedentName: name,
                          patientName: name,
                          patientID: id ? String(id) : '',
                        }));
                      }}
                    />
                    {!patientName.trim() && (
                      <div style={{
                        marginTop: 6, padding: '6px 8px', borderRadius: 5, fontSize: 10.5,
                        background: 'var(--amber-dim)', border: '1px solid var(--amber)',
                        color: 'var(--amber)', display: 'flex', gap: 5, alignItems: 'flex-start',
                      }}>
                        <i className="fas fa-exclamation-triangle" style={{ marginTop: 1 }} />
                        <span>Enter a patient name above — the bot needs this to find the correct forum thread.</span>
                      </div>
                    )}
                    {isOwnNameAsPatient && (
                      <div style={{
                        marginTop: 6, padding: '6px 8px', borderRadius: 5, fontSize: 10.5,
                        background: 'var(--amber-dim)', border: '1px solid var(--amber)',
                        color: 'var(--amber)', display: 'flex', gap: 5, alignItems: 'flex-start',
                      }}>
                        <i className="fas fa-user-md" style={{ marginTop: 1 }} />
                        <span>
                          Ahem, please don&apos;t use your own name as the patient — it&apos;s a otherwise the bot will post the report to your own thread.
                          Enter the <strong>patient&apos;s</strong> name (or pick one from the dropdown) before saving!
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {bbcodeToolsVisible && (() => {
                  const tpl = String(activeForm?.template || '');
                  const missing = (activeForm?.fields || [])
                    .filter(f => tpl.includes(`{{${f.name}}}`))
                    .filter(f => {
                      const v = formValues[f.name];
                      return v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);
                    })
                    .map(f => f.label || f.name);
                  if (tpl.includes('{{phmcSignature}}') && !String(formValues.phmcSignature || '').trim()) missing.push('Employee Signature');
                  return (
                  <div>
                  {showBBCode && missing.length > 0 && (
                    <div style={{ marginBottom: 6, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--amber)', color: 'var(--amber)', fontSize: 11, lineHeight: 1.5 }}>
                      <i className="fas fa-exclamation-triangle me-1" />Missing fields: <strong>{missing.join(' · ')}</strong>
                    </div>
                  )}
                <pre className="bbcode-pre" style={{ maxHeight: showBBCode ? '200px' : '60px' }}>
                  {showBBCode && generatedBBCode
                    ? generatedBBCode
                    : 'Select a form, fill it out, and click "Generate BBCode" to preview it here.'}
                </pre>
                  </div>
                  );
                })()}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {bbcodeToolsVisible && (
                  <button className="btn btn-ghost" style={{ flex: 1, fontSize: 12, justifyContent: 'center', borderColor: 'var(--teal)', color: 'var(--teal)' }} onClick={() => {
                    generateBBCode();
                    showNotification('BBCode generated!', 'success');
                  }}>
                    <i className="fas fa-code me-1" /> Preview
                  </button>
                  )}
                  {!basicMode && (
                  <button className="btn btn-ghost" style={{ flex: 1, fontSize: 12, justifyContent: 'center' }}
                    onClick={async () => {
                      // Validate required fields (only checks fields the form actually has)
                      const formFieldNames = new Set((selectedForm?.fields || []).map(f => f.name));
                      const missing = [];
                      if (formFieldNames.has('decedentName') && (!formValues.decedentName || !String(formValues.decedentName).trim())) missing.push('decedentName');
                      if (formFieldNames.has('decedentOOC') && (!formValues.decedentOOC || !String(formValues.decedentOOC).trim())) missing.push('decedentOOC');
                      // Check death-type fields if the form has any of them
                      const deathFields = ['causeOfDeath', 'typeOfDeath', 'deathType', 'causeDetail'];
                      const hasDeathField = deathFields.some(f => formFieldNames.has(f));
                      if (hasDeathField) {
                        const deathVal = deathFields.reduce((v, f) => v || formValues[f], '');
                        if (!deathVal || !String(deathVal).trim()) missing.push('cause of death');
                      }
                      if (missing.length > 0) {
                        showNotification('Fill in ' + missing.join(' and ') + ' before saving.', 'warning');
                        return;
                      }
                      // Always regenerate BBCode from the LATEST formValues —
                      // reusing cached output could ship an earlier (blank)
                      // generation if credentials synced after a preview (Fix D).
                      let bbcode;
                      let title;
                      const genResult = generateBBCode();
                      if (genResult?.bbcode) {
                        bbcode = genResult.bbcode;
                        title = genResult.finalTitle;
                      } else {
                        showNotification('Failed to generate BBCode. Check form fields.', 'error');
                        return;
                      }
                      const result = await saveReport(
                        selectedForm, formValues, title, bbcode,
                        editingDeployedReport ? { editDeployedReport: editingDeployedReport } : {}
                      );
                      if (result.success) {
                        clearFormBackups();
                        if (editingDeployedReport) {
                          setEditingDeployedReport(null);
                          showNotification('Edit queued — the bot will update the forum post in place.', 'check-circle');
                        } else {
                          const isAutoDeploy = isDeployTracked && formConsent;
                          if (isAutoDeploy) {
                            setDeployCountdown({ endTime: Date.now() + 150000, label: title || selectedForm?.name || 'Report' });
                          }
                          const isManualDeploy = isDeployTracked && !formConsent;
                          if (isManualDeploy) {
                            const textToCopy = Array.isArray(bbcode) ? bbcode.join('\n\n[PART_BREAK]\n\n') : bbcode;
                            navigator.clipboard.writeText(textToCopy).catch(() => {});
                          }
                          const deployStatus = isAutoDeploy
                            ? 'Queued for auto-deploy'
                            : (isManualDeploy ? 'Saved & BBCode copied (post manually)' : 'Saved (not deploy-tracked)');
                          const reportLabel = title || selectedForm?.name || 'Report';
                          showNotification(
                            `${reportLabel} — ${deployStatus}`,
                            isAutoDeploy ? 'cloud-upload-alt' : 'save',
                            isAutoDeploy ? 8000 : 5000
                          );
                        }
                      } else {
                        showNotification('Save failed: ' + (result.error || 'unknown error'), 'error');
                      }
                    }}>
                    <i className={`fas ${editingDeployedReport ? 'fa-pen' : (isDeployTracked && !formConsent ? 'fa-copy' : 'fa-cloud-upload-alt')} me-1`} />
                    {editingDeployedReport
                      ? 'Save & Edit Deployed Post'
                      : (isDeployTracked && !formConsent ? 'Save & Copy BBCode' : 'Save & Queue')}
                  </button>
                  )}
                </div>
                {bbcodeToolsVisible && generatedBBCode && !(isDeployTracked && !formConsent) && (
                  <button className="btn btn-ghost" style={{ width: '100%', marginTop: 6, fontSize: 12 }}
                    onClick={() => navigator.clipboard.writeText(generatedBBCode).then(() => showNotification('BBCode copied!', 'success'))}>
                    <i className="fas fa-copy me-1" /> Copy BBCode
                  </button>
                )}
                {!basicMode && (
                <>
                {showManualPostGuide && isCoronerEmail && (
                  <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--amber)', color: 'var(--text-muted)', fontSize: 10.5, lineHeight: 1.5 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {displayFactions.map((code) => {
                        const agency = findAgency(code);
                        const iconSrc = agency?.logo;
                        const name = agency?.fullName || code;
                        return (
                          <a key={code} href={agency?.url || '#'} target="_blank" rel="noopener noreferrer"
                            title={`${name} — open PM compose`}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', textDecoration: 'none' }}>
                            {iconSrc ? (
                              <img src={iconSrc} alt={code} style={{ width: 30, height: 30, borderRadius: 6, objectFit: 'contain', flexShrink: 0 }} />
                            ) : (
                              <i className="fas fa-building" style={{ fontSize: 20, color: 'var(--text-muted)', width: 30, textAlign: 'center' }} />
                            )}
                            <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600 }}>Email to {name}</span>
                          </a>
                        );
                      })}
                    </div>
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ cursor: 'pointer', fontSize: 10.5, color: 'var(--teal)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <i className="fas fa-key" /> Click for Credentials
                      </summary>
                      <div style={{ marginTop: 6, padding: '6px 8px', borderRadius: 6, background: 'var(--bg-elevated)', fontSize: 10.5, lineHeight: 1.7 }}>
                        {displayFactions.map((code) => {
                          const c = credsForFaction(code);
                          const name = findAgency(code)?.fullName || code;
                          return (
                            <div key={code} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '2px 0' }}>
                              <span style={{ color: 'var(--text)', fontWeight: 700 }}>{name}</span>
                              {c ? (
                                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 10 }}>{c.username} / {c.password}</span>
                              ) : (
                                <span style={{ color: 'var(--amber)', fontSize: 10, textAlign: 'right' }}>No credentials found, please contact Fr0styDev</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  </div>
                )}
                {showManualPostGuide && isCoronerOrMassFatal && (
                  <a href="https://phmc.gta.world/posting.php?mode=post&f=267" target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--teal)', color: 'var(--teal)', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>
                    {phmcAgency?.logo ? (
                      <img src={phmcAgency.logo} alt="PHMC" style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'contain' }} />
                    ) : (
                      <i className="fas fa-plus-square" />
                    )}
                    Post to PHMC Forum (f=267)
                  </a>
                )}
                {isDeployTracked && (
                  <div style={{
                    marginTop: 10, padding: '8px 10px', borderRadius: 6, fontSize: 10.5,
                    background: 'var(--bg-surface)', border: '1px solid var(--border)',
                    color: 'var(--text-muted)', lineHeight: 1.5, display: 'flex', gap: 6, alignItems: 'flex-start',
                  }}>
                    <i className="fas fa-robot" style={{ marginTop: 1, color: 'var(--teal)' }} />
                    <span>
                      {formConsent ? (
                        <>
                          Finished with the form? Click on <strong>Save & Queue</strong>, the PHMC Bot will do everything for you.
                          {' '}If you wish to opt out, you can use the 'Deploy Consent' button at the top right.
                        </>
                      ) : (
                        <>
                          Auto-deploy is off for this form. Save, then post the BBCode below manually — or re-enable it in the
                          {' '}Deploy Consent button at the top right.
                        </>
                      )}
                    </span>
                  </div>
                )}
                {deployCountdown && (() => {
                  const remaining = Math.max(0, deployCountdown.endTime - Date.now());
                  const mins = Math.floor(remaining / 60000);
                  const secs = Math.floor((remaining % 60000) / 1000);
                  const pct = (remaining / 150000) * 100;
                  return (
                    <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--teal-dim)', border: '1px solid rgba(99,102,241,0.25)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--teal)' }}>
                          <i className="fas fa-clock me-1" /> Auto-deploy in {mins}:{secs.toString().padStart(2, '0')}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Save & re-queue to reset</span>
                      </div>
                      <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--bg-surface)', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: 'var(--teal)', transition: 'width 1s linear' }} />
                      </div>
                    </div>
                  );
                })()}
                </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Modals ─── */}
      {sigOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(6,10,18,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setSigOpen(false)}>
          <div style={{ maxWidth: 420, width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-accent)', borderRadius: 12, padding: 20 }} onClick={e => e.stopPropagation()} onPaste={handleSigPaste}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}><i className="fas fa-signature" style={{ marginRight: 6, color: 'var(--teal)' }} />Employee Signature</div>
            <p style={{ fontSize: 11.5, color: 'var(--text-faint)', margin: '0 0 12px' }}>Paste your signature image (Ctrl+V) or its URL, or upload an image. It will be shown on this report's sign-off in place of the typed employee name.</p>
            <input
              value={sigUrl}
              onChange={e => setSigUrl(e.target.value)}
              placeholder="Paste image (Ctrl+V) or enter https://…/signature.png"
              style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '9px 11px', fontSize: 12.5, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>or</span>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', background: 'var(--bg-surface)', border: '1px dashed var(--border-accent)', borderRadius: 6, padding: '7px 12px', fontSize: 12, color: 'var(--teal)' }}>
                <i className="fas fa-upload" style={{ fontSize: 12, lineHeight: 1 }} />
                {isSigUploading ? 'Uploading…' : 'Upload image'}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  disabled={isSigUploading}
                  onChange={async (e) => {
                    if (!e.target.files || e.target.files.length === 0) return;
                    try {
                      const urls = await handleImageUpload(e, 'phmcSignature');
                      if (urls && urls[0]) setSigUrl(urls[0]?.url || '');
                    } catch (err) {
                      showNotification('Signature upload failed: ' + (err?.message || err), 'error');
                    } finally {
                      e.target.value = '';
                    }
                  }}
                />
              </label>
            </div>
            {/^https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i.test(String(sigUrl || '').trim()) && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>Preview:</div>
                <div style={{ background: '#fff', borderRadius: 6, padding: 8, textAlign: 'center' }}>
                  <img src={String(sigUrl || '').trim()} alt="signature preview" style={{ maxHeight: 120, maxWidth: '100%', objectFit: 'contain' }} />
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <button onClick={() => setSigOpen(false)} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '8px 14px', fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
              <button onClick={approveSignature} disabled={!/^https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i.test(String(sigUrl || '').trim())} style={{ background: 'var(--teal-dim)', border: '1px solid var(--teal)', color: 'var(--teal)', borderRadius: 6, padding: '8px 14px', fontSize: 12.5, cursor: 'pointer', opacity: /^https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i.test(String(sigUrl || '').trim()) ? 1 : 0.4 }}>Approve</button>
            </div>
          </div>
        </div>
      )}
      {isSurgicalDev && surgicalDiagramOpen && (
        <SurgicalDiagramModal
          show={surgicalDiagramOpen}
          onClose={() => setSurgicalDiagramOpen(false)}
          data={surgicalDiagram}
          onChange={setSurgicalDiagram}
        />
      )}
      <AssignedAutopsiesModal
        show={showAssignedAutopsies}
        onClose={() => setShowAssignedAutopsies(false)}
        factionsData={factionsData}
        onLoadCase={(morgue, entry) => {
          setShowAssignedAutopsies(false);
          const autopsyForm = formsData?.find(f => f.firebaseKey === 'autopsy');
          if (!autopsyForm) { showNotification('Autopsy form not found', 'warning'); return; }
          setSelectedForm(autopsyForm);
          clearBBCode();
          setActiveView('forms');
          // Clear previous case fields first
          const clearFields = ['decedentName','decedentOOC','Requester','sex','placeOfDeath','deathType',
            'dnaProfile','bacLevel','narcoticTraces','externalExamination','department',
            'anatomicSummaryListItems','casings','RadiologyResult','synopsis','causeDetail',
            'causeOfDeath','deathCausesListItems','dateTime','timeOfDeath'];
          setFormValues(prev => {
            const cleared = { ...prev };
            clearFields.forEach(f => { cleared[f] = ''; });
            return cleared;
          });
          const updates = {};
          const p = entry?.parsed || {};
          // Extract IC name: "John Doe ((OOC))" -> "John Doe"
          const fullName = p.decedentName || morgue?.name || '';
          const icMatch = fullName.match(/^(.+?)\s*\(\(/);
          const icName = icMatch ? icMatch[1].trim() : fullName.replace(/\(\(.+?\)\)/g, '').trim() || fullName;
          updates.decedentName = icName;
          updates.decedentOOC = entry?.oocName || '';
          if (p.requesterName) updates.Requester = p.requesterName;
          if (p.sex || morgue?.sex) updates.sex = p.sex || morgue.sex;
          if (p.placeOfDeath || morgue?.location) updates.placeOfDeath = p.placeOfDeath || morgue.location;
          if (p.deathType) updates.deathType = (p.deathType || '').toUpperCase() === 'CK' ? 'CK' : 'PK';
          if (morgue?.dnaProfile) updates.dnaProfile = morgue.dnaProfile;
          if (morgue?.bac) updates.bacLevel = morgue.bac;
          if (morgue?.narcotics) updates.narcoticTraces = morgue.narcotics;
          // Build external examination from physical description
          if (morgue?.physicalDescription) {
            let extLines = '** The Morgue Technician provides a written description below of the Decedent ** ((This section is descriptive purposes only and is automatically generated from the Morgue Records ))\n\n';
            extLines += `Physical Description:\n${morgue.physicalDescription}\n\n`;
            if (morgue.tattoos && morgue.tattoos !== 'None' && morgue.tattoos !== 'Unknown') {
              extLines += `Tattoos/Marks:\n${morgue.tattoos}\n\n`;
            }
            if (morgue.estimatedAge && morgue.estimatedAge !== 'Unknown') {
              extLines += `Est. Age: ${morgue.estimatedAge}\n`;
            }
            updates.externalExamination = extLines.trim();
          }
          const deptMap = { LSPD: 'Los Santos Police Department', LSSD: 'Los Santos County Sheriffs Department', SADCR: 'San Andreas Department of Corrections and Rehabilitation' };
          if (entry?.faction) updates.department = deptMap[entry.faction] || entry.faction;
          if (Array.isArray(morgue?.findings)) {
            updates.anatomicSummaryListItems = morgue.findings.map(f => {
              const type = (f.type || '').trim();
              const part = (f.part || '').trim();
              const typeL = type.toLowerCase();
              const dist = f.dist ? f.dist.replace(/[^\d.]/g, '') : '';
              const distN = parseFloat(dist);
              const distR = !isNaN(distN) ? Math.floor(distN) : null;
              if (!typeL || typeL === 'blood loss' || typeL.includes('wound type') || part.includes('body part') || part === '-' || part === 'N/A') return null;
              if (typeL.includes('gunshot')) return `Gunshot Wound to ${part}${distR !== null ? `, estimated range ${distR}m` : ''}`;
              if (typeL.includes('blunt force trauma') || typeL.includes('stab wound')) return type.replace(/\b\w/g, c => c.toUpperCase()) + ' to ' + part;
              return type + ' to ' + part + (distR !== null ? ` (${distR}m)` : '');
            }).filter(Boolean);
          }
          const rawBullets = morgue?.bullets;
          const bulletsArr = rawBullets && typeof rawBullets === 'object'
            ? (Array.isArray(rawBullets) ? rawBullets : [rawBullets])
            : [];
          if (bulletsArr.length > 0) {
            updates.casings = bulletsArr.map(b => {
              const prefix = (b.type || '').toLowerCase().includes('gauge') ? 'Pellet' : 'Bullet';
              return `${prefix} found with striation marks - ${b.type || ''} #${b.id || ''}`;
            });
            updates.RadiologyResult = `${bulletsArr.length} projectiles/slugs were identified via fluoroscopy and recovered during the autopsy.`;
          }
          if (!morgue) {
            showNotification('Cannot load case — no morgue record found.', 'error');
            return;
          }
          setFormValues(prev => ({ ...prev, ...updates }));
          showNotification(`Loaded case #${morgue?.caseId} — ${updates.decedentName || 'Unknown'}`, 'success');
        }}
      />
      <SavedReportsModal
        show={showSavedReports}
        onHide={() => setShowSavedReports(false)}
        employeeOptions={savedReportEmployeeOptions}
        showNotification={showNotification}
        loadReport={handleLoadReport}
        loadReportForUser={loadReportForUser}
        deleteReportForUser={deleteReportForUser}
        onEmployeeSelect={loadUserSavedReports}
        reportsForSelectedUser={savedReports}
        isLoadingReports={isLoadingReports}
        isAttachMode={isAttachMode}
        currentPhmcEmployee={characterName}
        currentCoronerEmployee={formValues.coronerEmployee}
        preselectedEmployeeType={preselectedEmployeeType}
        reportSelectionFilter={reportSelectionFilter}
        handleReportSelectedForAttachment={handleReportSelectedForAttachment}
        pendingReportAttachmentCallback={pendingReportAttachmentCallback.current}
      />
      <FixDeployedReportModal
        show={showFixDeployedReport}
        onHide={() => setShowFixDeployedReport(false)}
        reports={savedReports}
        isLoadingReports={isLoadingReports}
        currentUserId={characterName}
        onLoadReports={loadUserSavedReports}
        loadReport={handleLoadReport}
        onEditReport={(meta) => setEditingDeployedReport(meta)}
      />
      {/* ─── Sign In Role Dialog ─── */}
      {showLoginDialog && (
        <div className="modal-overlay open" onClick={() => setShowLoginDialog(false)} style={{ display: 'flex', zIndex: 1100 }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="modal-head">
              <h3><i className="fas fa-sign-in-alt" style={{ color: 'var(--teal)' }} /> Sign In</h3>
              <button className="modal-close" onClick={() => setShowLoginDialog(false)} aria-label="Close">✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                Are you PHMC staff or a non-staff member?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="btn btn-primary" style={{ justifyContent: 'center' }}
                  onClick={() => { setShowLoginDialog(false); handleLogin('employee'); }}>
                  <i className="fas fa-user-md me-1" /> PHMC Staff
                </button>
                <button className="btn btn-ghost" style={{ justifyContent: 'center' }}
                  onClick={() => { setShowLoginDialog(false); handleLogin('non-employee'); }}>
                  <i className="fas fa-user me-1" /> Non Staff
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ─── Consent Preferences ─── */}
      {showConsentPrefs && (
        <div className="modal-overlay open" onClick={() => setShowConsentPrefs(false)} style={{ display: 'flex', zIndex: 1100 }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-head">
              <h3><i className="fas fa-toggle-on" style={{ color: 'var(--teal)' }} /> Auto-Deploy Preferences</h3>
              <button className="modal-close" onClick={() => setShowConsentPrefs(false)} aria-label="Close">✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                Toggle which form types automatically deploy to the forum when saved.
              </p>
              {Object.entries(FORM_SECTIONS).map(([section, formIds]) => (
                <div key={section} style={{ marginBottom: 16 }}>
                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--text-faint)',
                    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8,
                  }}>{section}</div>
                  {formIds.map(fid => (
                    <div key={fid} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 10px', borderRadius: 7, marginBottom: 4,
                      background: 'var(--bg-surface)',
                    }}>
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>{FORM_LABELS[fid] || fid}</span>
                      <label style={{
                        position: 'relative', width: 36, height: 20, cursor: 'pointer',
                      }}>
                        <input type="checkbox" checked={consent[fid] !== false}
                          onChange={() => setConsent(fid, consent[fid] === false)}
                          style={{ display: 'none' }} />
                        <span style={{
                          position: 'absolute', inset: 0, borderRadius: 10,
                          background: consent[fid] !== false ? 'var(--teal)' : 'var(--border)',
                          transition: 'background 0.2s',
                        }}>
                          <span style={{
                            position: 'absolute', top: 2, left: consent[fid] !== false ? 18 : 2,
                            width: 16, height: 16, borderRadius: '50%', background: '#fff',
                            transition: 'left 0.2s',
                          }} />
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="modal-foot">
              <button className="btn btn-primary" onClick={() => {
                setShowConsentPrefs(false);
                showNotification('Deploy preferences saved!', 'check-circle');
              }}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Map Modal ─── */}
      <MapModal
        show={showMapModal}
        onHide={() => { setShowMapModal(false); setMapTargetField(null); }}
        onSelect={handleMapSelect}
        mapTargetField={mapTargetField}
        setIsUploadingMapImage={setIsUploadingMapImage}
        selectedForm={selectedForm}
      />

      {/* ─── Business Card Modal ─── */}
      <BusinessCardModal
        show={showBusinessCard}
        onHide={() => setShowBusinessCard(false)}
        showNotification={showNotification}
        handleImageUpload={handleImageUpload}
        commitInfo={{ sha: '' }}
        defaultName={characterName || ''}
        defaultRank={cleanRankText(factionData?.rank) || ''}
        swappableCharacters={swappableCharacters || []}
        onSwapCharacter={(c) => swapCharacter(c)}
        canSwapCharacters={canSwapCharacters}
      />

    </div>
  );
};

export default NewUIPrototype;
