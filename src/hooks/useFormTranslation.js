import { useState, useEffect, useMemo, useCallback } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase';

/**
 * useFormTranslation — loads translations for a form and manages the active
 * display language.
 *
 * Reads `translations/<formId>/<langCode>` (all languages) and surfaces the
 * APPROVED ones. `lang` = '' means the base (default-language) form.
 *
 * Translation shape (translations/<formId>/<langCode>):
 *   { status: 'approved'|'draft'|..., langName, formName, formDescription,
 *     fields: { <fieldName>: { label, placeholder, content, buttonLabel } },
 *     template, baseVersion, updatedBy, updatedAt }
 *
 * Returns:
 *   { availableLangs: [{code, langName}], lang, setLang, translation }
 */
const useFormTranslation = (formId) => {
  const [langs, setLangs] = useState({});
  const [lang, setLang] = useState('');

  useEffect(() => {
    setLangs({});
    setLang('');
    if (!formId) return undefined;

    const tRef = ref(database, `translations/${formId}`);
    const unsub = onValue(tRef, (snap) => {
      const data = snap.val() || {};
      const approved = {};
      for (const [code, t] of Object.entries(data)) {
        if (!t || typeof t !== 'object') continue;
        // Status-less translations are treated as approved (forward-compatible).
        if (t.status && t.status !== 'approved') continue;
        approved[code] = t;
      }
      setLangs(approved);
    });
    return () => unsub();
  }, [formId]);

  const availableLangs = useMemo(
    () => Object.entries(langs)
      .map(([code, t]) => ({ code, langName: t.langName || code }))
      .sort((a, b) => a.langName.localeCompare(b.langName)),
    [langs]
  );

  const translation = langs[lang] || null;

  const resetLang = useCallback(() => setLang(''), []);

  return { availableLangs, lang, setLang, resetLang, translation };
};

export default useFormTranslation;
