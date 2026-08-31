import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ref, get, set, onValue, off } from 'firebase/database';
import { database } from '../../firebase';
import { useData } from '../../contexts/DataContext';
import { useNotification } from '../../contexts/NotificationContext';
import { logAdminAction } from '../../utils/logging';

const INPUT = { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '8px 10px', fontSize: 12.5, boxSizing: 'border-box' };
const BASE_STYLE = { fontSize: 11, color: 'var(--text-faint)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', marginBottom: 4 };

const extractTokens = (tpl) => {
  const set = new Set();
  const re = /\{\{([^}]+)\}\}/g;
  let m;
  while ((m = re.exec(tpl || ''))) set.add(m[1].trim());
  return set;
};

/**
 * TranslationEditor — `/translate` page.
 *
 * Lets community translators author translations of PHMC forms. Reads the base
 * form definition, lets the translator edit per-field strings + the BBCode
 * template, then saves to `translations/<formId>/<langCode>` (draft or
 * submitted). The app only renders `status: 'approved'` translations.
 *
 * Access is gated by a PHMC-issued code when `appMetadata/translatorAccessCode`
 * is configured (Decision C placeholder until the GTAW multi-server OAuth
 * investigation concludes).
 */
const TranslationEditor = () => {
  const { formsData } = useData();
  const { showNotification } = useNotification();

  const [formId, setFormId] = useState('');
  const [langs, setLangs] = useState({});
  const [langCode, setLangCode] = useState('');
  const [isNewLang, setIsNewLang] = useState(false);
  const [newLangCode, setNewLangCode] = useState('');
  const [langName, setLangName] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [template, setTemplate] = useState('');
  const [overrides, setOverrides] = useState({});
  const [accessCode, setAccessCode] = useState('');
  const [configuredCode, setConfiguredCode] = useState('');
  const [saving, setSaving] = useState(false);

  const baseForm = formsData?.find(f => f.firebaseKey === formId) || null;
  const activeLangCode = isNewLang ? newLangCode.trim() : langCode;

  // Load the configured access code once.
  useEffect(() => {
    get(ref(database, 'appMetadata/translatorAccessCode')).then((snap) => {
      if (snap.exists()) setConfiguredCode(String(snap.val()));
    }).catch(() => {});
  }, []);

  // Subscribe to existing translations for the selected form.
  useEffect(() => {
    setLangs({});
    setLangCode('');
    setIsNewLang(false);
    setNewLangCode('');
    setTemplate('');
    setOverrides({});
    if (!formId) return undefined;
    const tRef = ref(database, `translations/${formId}`);
    const handle = (snap) => setLangs(snap.val() || {});
    onValue(tRef, handle);
    return () => off(tRef, 'value', handle);
  }, [formId]);

  // Load base form + existing translation into the editor when form/lang changes.
  useEffect(() => {
    if (!baseForm) return;
    const t = (activeLangCode && langs[activeLangCode]) || null;
    setFormName(t?.formName || baseForm.name || '');
    setFormDescription(t?.formDescription != null ? t.formDescription : baseForm.formDescription || '');
    setTemplate(t?.template != null ? t.template : baseForm.template || '');
    setOverrides(t?.fields || {});
  }, [baseForm, activeLangCode, langs]);

  const tokenMismatch = useMemo(() => {
    if (!baseForm?.template || !template) return null;
    const base = extractTokens(baseForm.template);
    const cur = extractTokens(template);
    const missing = [...base].filter(t => !cur.has(t));
    const added = [...cur].filter(t => !base.has(t));
    if (missing.length === 0 && added.length === 0) return null;
    return { missing, added };
  }, [baseForm, template]);

  const selectForm = useCallback((id) => {
    setFormId(id);
    setLangCode('');
    setIsNewLang(false);
  }, []);

  const setField = (name, key, value) => {
    setOverrides(prev => {
      const cur = prev[name] || {};
      return { ...prev, [name]: { ...cur, [key]: value } };
    });
  };

  const save = async (status) => {
    if (configuredCode && accessCode.trim() !== configuredCode) {
      showNotification('Invalid translator access code.', 'error');
      return;
    }
    if (!formId || !activeLangCode) {
      showNotification('Select a form and a language first.', 'warning');
      return;
    }
    if (tokenMismatch) {
      showNotification('Template tokens differ from the base form — fix before saving.', 'warning');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        baseFormId: formId,
        langCode: activeLangCode,
        langName: langName.trim() || activeLangCode,
        status,
        formName: formName.trim(),
        formDescription: formDescription.trim(),
        fields: overrides,
        template,
        baseVersion: baseForm?.lastUpdated || 0,
        updatedBy: accessCode.trim() ? `code:${accessCode.trim()}` : 'translator',
        updatedAt: Date.now(),
      };
      await set(ref(database, `translations/${formId}/${activeLangCode}`), payload);
      showNotification(status === 'submitted' ? 'Translation submitted for review.' : 'Translation draft saved.', 'success');
      logAdminAction('translate', `Saved ${status} translation`, `form=${formId} lang=${activeLangCode}`, 'Translations').catch(() => {});
    } catch (err) {
      showNotification('Failed to save: ' + (err?.message || err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const translatableFields = (baseForm?.fields || []).filter(f => f.name && f.label);

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <i className="fas fa-language" style={{ color: 'var(--teal)', fontSize: 22 }} />
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Translate Forms</h1>
        <a href="#/ui-prototype" style={{ marginLeft: 'auto', color: 'var(--teal)', fontSize: 12 }}>← Back to forms</a>
      </div>
      <p style={{ color: 'var(--text-faint)', fontSize: 12.5, marginTop: 0 }}>
        Community translations of PHMC forms. Saved as drafts / submitted; only approved translations appear in the app's language picker.
      </p>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
      {/* Form + language selection */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px' }}>
          <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>Form</label>
          <select value={formId} onChange={e => selectForm(e.target.value)} style={INPUT}>
            <option value="">— Select a form —</option>
            {(formsData || []).map(f => (
              <option key={f.firebaseKey} value={f.firebaseKey}>{f.name} ({f.firebaseKey})</option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1 1 220px' }}>
          <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>Language</label>
          <select
            value={isNewLang ? '__new__' : langCode}
            onChange={e => {
              if (e.target.value === '__new__') { setIsNewLang(true); setLangCode(''); } else { setIsNewLang(false); setLangCode(e.target.value); }
            }}
            style={INPUT}
            disabled={!formId}
          >
            <option value="">— None —</option>
            {Object.keys(langs).sort().map(code => (
              <option key={code} value={code}>{langs[code]?.langName || code}{langs[code]?.status === 'approved' ? '' : ` (${langs[code]?.status || 'draft'})`}</option>
            ))}
            <option value="__new__">+ New language…</option>
          </select>
        </div>
      </div>

      {formId && (langCode || isNewLang) && (
        <>
          {isNewLang && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 140px' }}>
                <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>Language code</label>
                <input value={newLangCode} onChange={e => setNewLangCode(e.target.value.toLowerCase())} placeholder="fr, es, ru…" style={INPUT} />
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>Language name</label>
                <input value={langName} onChange={e => setLangName(e.target.value)} placeholder="Français, Español…" style={INPUT} />
              </div>
            </div>
          )}

          {!isNewLang && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>Language name</label>
              <input value={langName} onChange={e => setLangName(e.target.value)} style={{ ...INPUT, maxWidth: 280 }} />
            </div>
          )}

          {/* Form name / description */}
          <div className="admin-section-title" style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Form title &amp; description</div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>Form name (translated)</label>
            <input value={formName} onChange={e => setFormName(e.target.value)} style={INPUT} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>Form description (translated)</label>
            <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={2} style={INPUT} />
          </div>

          {/* Field translations */}
          <div className="admin-section-title" style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Fields</div>
          {translatableFields.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: 12 }}>No translatable fields.</p>}
          {translatableFields.map(f => {
            const ov = overrides[f.name] || {};
            return (
              <div key={f.name} style={{ marginBottom: 14, padding: 12, background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginBottom: 6 }}>{f.name}</div>
                <div style={BASE_STYLE}>Base: {f.label || '(no label)'}</div>
                <input value={ov.label || ''} onChange={e => setField(f.name, 'label', e.target.value)} placeholder={`${f.label || 'Label'} (translated)`} style={INPUT} />
                {f.placeholder && (
                  <>
                    <div style={{ ...BASE_STYLE, marginTop: 8 }}>Base placeholder: {f.placeholder}</div>
                    <input value={ov.placeholder || ''} onChange={e => setField(f.name, 'placeholder', e.target.value)} placeholder={`${f.placeholder} (translated)`} style={{ ...INPUT, marginTop: 4 }} />
                  </>
                )}
                {f.content && (
                  <>
                    <div style={{ ...BASE_STYLE, marginTop: 8 }}>Base content: {String(f.content).slice(0, 120)}{String(f.content).length > 120 ? '…' : ''}</div>
                    <textarea value={ov.content || ''} onChange={e => setField(f.name, 'content', e.target.value)} rows={2} placeholder="Content (translated)" style={{ ...INPUT, marginTop: 4 }} />
                  </>
                )}
                {f.buttonLabel && (
                  <>
                    <div style={{ ...BASE_STYLE, marginTop: 8 }}>Base button label: {f.buttonLabel}</div>
                    <input value={ov.buttonLabel || ''} onChange={e => setField(f.name, 'buttonLabel', e.target.value)} placeholder={`${f.buttonLabel} (translated)`} style={{ ...INPUT, marginTop: 4 }} />
                  </>
                )}
              </div>
            );
          })}

          {/* BBCode template */}
          <div className="admin-section-title" style={{ fontSize: 13, fontWeight: 700, marginTop: 8, marginBottom: 8 }}>BBCode template</div>
          <div style={BASE_STYLE}>Translate the report template. Keep the <strong style={{ color: 'var(--teal)' }}>{'{{placeholders}}'}</strong> exactly as-is — they map to the saved data.</div>
          <textarea value={template} onChange={e => setTemplate(e.target.value)} rows={14} style={{ ...INPUT, fontFamily: 'var(--mono)', fontSize: 11.5, whiteSpace: 'pre' }} />
          {tokenMismatch && (
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: 'var(--amber-dim)', border: '1px solid var(--amber)', color: 'var(--amber)', fontSize: 12 }}>
              <i className="fas fa-exclamation-triangle me-1" />
              Template tokens differ from the base form
              {tokenMismatch.missing.length > 0 && ` — missing: ${tokenMismatch.missing.join(', ')}`}
              {tokenMismatch.added.length > 0 && ` — extra: ${tokenMismatch.added.join(', ')}`}
            </div>
          )}

          {/* Access code + actions */}
          <div style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {configuredCode && (
              <input value={accessCode} onChange={e => setAccessCode(e.target.value)} placeholder="Translator access code" style={{ ...INPUT, maxWidth: 220 }} type="password" />
            )}
            <button className="btn btn-ghost" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-accent)', color: 'var(--text)', borderRadius: 6, padding: '9px 16px', fontSize: 12.5, cursor: 'pointer' }} onClick={() => save('draft')} disabled={saving}>
              <i className="fas fa-save me-1" /> Save draft
            </button>
            <button className="btn btn-ghost" style={{ background: 'var(--teal-dim)', border: '1px solid var(--teal)', color: 'var(--teal)', borderRadius: 6, padding: '9px 16px', fontSize: 12.5, cursor: 'pointer' }} onClick={() => save('submitted')} disabled={saving}>
              <i className="fas fa-paper-plane me-1" /> Submit for review
            </button>
            {saving && <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Saving…</span>}
          </div>
        </>
      )}

      {!formId && (
        <p style={{ color: 'var(--text-faint)', fontSize: 13, marginTop: 24 }}>Select a form to start translating.</p>
      )}
      </div>

      {/* ── Live form preview (updates in real time as translations are written) ── */}
      {formId && (
        <div style={{ flex: '0 0 400px', position: 'sticky', top: 16, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, maxHeight: 'calc(100vh - 32px)', overflow: 'auto' }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>
            <i className="fas fa-eye me-1" />Live preview
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{formName || baseForm?.name || 'Form'}</div>
          {baseForm?.formDescription && (
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 10 }}>{formDescription || baseForm.formDescription}</div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {translatableFields.map(f => {
              const ov = overrides[f.name] || {};
              const label = ov.label || f.label || f.name;
              const placeholder = ov.placeholder || f.placeholder || '';
              const half = f.layout === 'compact-50';
              const isArea = f.type === 'textarea' || f.type === 'section' || !!f.content;
              return (
                <div key={f.name} style={{ width: half ? 'calc(50% - 5px)' : '100%', boxSizing: 'border-box' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 3, color: 'var(--text)' }}>{label}</div>
                  {isArea ? (
                    <div style={{ ...INPUT, minHeight: 40, background: 'var(--bg-surface)', color: 'var(--text-faint)', fontSize: 11.5, display: 'flex', alignItems: 'center' }}>{placeholder || '…'}</div>
                  ) : (
                    <div style={{ ...INPUT, background: 'var(--bg-surface)', color: 'var(--text-faint)', fontSize: 11.5 }}>{placeholder || '…'}</div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 14, marginBottom: 4 }}>BBCode template</div>
          <pre style={{ ...INPUT, fontFamily: 'var(--mono)', fontSize: 10.5, whiteSpace: 'pre-wrap', maxHeight: 260, overflow: 'auto', margin: 0 }}>{template || '…'}</pre>
        </div>
      )}
      </div>
    </div>
  );
};

export default TranslationEditor;
