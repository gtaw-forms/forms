import { useState, useCallback } from 'react';
import { getUtcFormattedDateTime, getUtcFormattedTime } from '../utils/dateTimeUtils';
import { getDepartmentFullName } from '../utils/bbcodeHelpers';
import generateDecedentBBCode from '../phmc-bbcode-generators/generateMassFatality';

const useBbcodeGenerator = (selectedForm, formValues, finalSelectOptions, agencyDataStore) => {
  const [generatedBBCode, setGeneratedBBCode] = useState("");
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [showBBCode, setShowBBCode] = useState(false);

  const generateBBCode = useCallback(() => {
    if (!selectedForm?.template) return;

    console.log("--- BBCode Generation Triggered ---");
    console.log("Selected Form:", selectedForm.name);
    console.log("Form Values:", formValues);

    let bbcode = selectedForm.template;
    let title = "";

    // Evaluation context with case-insensitive fallbacks
    const evaluationContext = { ...formValues };
    evaluationContext.formData = evaluationContext;

    // Case-insensitive fallbacks
    const addFallback = (src, target) => {
      if (formValues[src] !== undefined && evaluationContext[target] === undefined) {
        evaluationContext[target] = formValues[src];
      }
    };
    addFallback('patientName', 'PatientName'); addFallback('PatientName', 'patientName');
    addFallback('employeeName', 'EmployeeName'); addFallback('EmployeeName', 'employeeName');
    addFallback('phmcEmployee', 'PHMCEmployee'); addFallback('PHMCEmployee', 'phmcEmployee');
    addFallback('coronerEmployee', 'CoronerEmployee'); addFallback('CoronerEmployee', 'coronerEmployee');

    // ──────────────────────────────────────────────────────────────
    // SPECIAL CORONER EMAIL TITLE (already working perfectly)
    // ──────────────────────────────────────────────────────────────
    if (selectedForm.name === "Coroner Email" || selectedForm.id === "coroner_email") {
      let decedentNames = [];
      if (formValues.decedentName) decedentNames.push(formValues.decedentName.trim());
      if (formValues.patientName && !formValues.decedentName) decedentNames.push(formValues.patientName.trim());
      if (Array.isArray(formValues.decedents)) {
        formValues.decedents.forEach(d => {
          const n = (d.name || d.decedentName || d.fullName || "").trim();
          if (n) decedentNames.push(n);
        });
      }
      if (decedentNames.length === 0) decedentNames = ["Unknown Decedent"];
      const decedentDisplay = decedentNames.join(", ");

      const attachedTitles = Array.isArray(formValues.attachedReportTitles)
        ? formValues.attachedReportTitles.filter(Boolean)
        : [];

      const reportSuffix = attachedTitles.length > 0 ? ' — ' + attachedTitles.join(' | ') : '';
      title = `[Coroner Email] ${decedentDisplay}${reportSuffix}`;
      setGeneratedTitle(title);
    }
    // Normal title fallback
    else if (selectedForm.titleGeneratorCode) {
      try {
        const fn = new Function('formName', 'formData', 'ctx', selectedForm.titleGeneratorCode);
        title = fn(selectedForm.name, formValues, evaluationContext);
        setGeneratedTitle(title);
      } catch (e) {
        title = `${selectedForm.name} (Title Error)`;
        setGeneratedTitle(title);
      }
    } else {
      title = selectedForm.name || "Untitled Report";
      setGeneratedTitle(title);
    }

    // ──────────────────────────────────────────────────────────────
    // NUCLEAR-GRADE [cb:field]Text FIX — MULTI-SELECT SAFE
    // ──────────────────────────────────────────────────────────────
    let processed = bbcode;

    // Main format: [cb:field]Text
    const cbRegex = /\[cb:([^\]]+)\]([^\[\]]*)/g;
    processed = processed.replace(cbRegex, (match, fieldName, displayText) => {
      const field = fieldName.trim();
      const text = displayText.trim();
      if (!field || !text) return match;

      const value = formValues[field];
      const isSelected = Array.isArray(value)
        ? value.map(v => String(v).trim()).includes(text)
        : String(value || '').trim() === text;

      return isSelected ? `[cbc] ${text}` : `[cb] ${text}`;
    });

    // Optional: [cb:field]Text[/cb:field] format
    const cbClosingRegex = /\[cb:([^\]]+)\](.+?)\[\/cb:\1\]/gi;
    processed = processed.replace(cbClosingRegex, (match, fieldName, text) => {
      const field = fieldName.trim();
      const cleanText = text.trim();
      if (!field || !cleanText) return match;

      const value = formValues[field];
      const selected = Array.isArray(value)
        ? value.map(v => String(v).trim()).includes(cleanText)
        : String(value || '').trim() === cleanText;

      return selected ? `[cbc] ${cleanText}` : `[cb] ${cleanText}`;
    });

    // Standalone [cb:field] → [cbc] if field has value
    processed = processed.replace(/\[cb:([^\]]+)\]/gi, (match, fieldName) => {
      const field = fieldName.trim();
      const value = formValues[field];
      const hasValue = value && value !== '' && value !== false && (!Array.isArray(value) || value.length > 0);
      return hasValue ? '[cbc]' : '[cb]';
    });

    bbcode = processed;

    // ──────────────────────────────────────────────────────────────
    // Normal field replacement: {{fieldName}}
    // ──────────────────────────────────────────────────────────────
    const placeholderRegex = /{{([^}]+)}}/g;
    selectedForm.fields?.forEach(field => {
      const placeholder = `{{${field.name}}}`;
      if (!bbcode.includes(placeholder)) return;

      let replacementValue = formValues[field.name] || '';

      if (field.type === "image_upload" && replacementValue) {
        replacementValue = `[img]${replacementValue}[/img]`;
      } else if (field.type === "checkbox" && typeof replacementValue === "boolean") {
        replacementValue = replacementValue ? "Yes" : "No";
      } else if (field.type === "multi_select" && Array.isArray(replacementValue)) {
        replacementValue = replacementValue.join(", ");
      }

      bbcode = bbcode.replace(placeholderRegex, replacementValue);
    });

    // ──────────────────────────────────────────────────────────────
    // JavaScript expressions: {{some.js.code}}
    // ──────────────────────────────────────────────────────────────
    const expressionRegex = /{{(.+?)}}/g;
    bbcode = bbcode.replace(expressionRegex, (match, expression) => {
      const trimmed = expression.trim();
      const isLiteral = trimmed.includes(':') && !trimmed.match(/[\.\(\)\+\-\*\/%&|\^~!=<>?]/) ||
                       trimmed.startsWith(' ') || !trimmed.match(/[a-zA-Z0-9_.]/);

      if (isLiteral) return trimmed;

      try {
        const evalFn = new Function('context', 'getDepartmentFullName', 'agencyDataStore', 'generateDecedentBBCode',
          `with (context) { return ${trimmed}; }`
        );
        const result = evalFn(evaluationContext, getDepartmentFullName, agencyDataStore, generateDecedentBBCode);
        return Array.isArray(result) ? result.join(', ') : String(result || '');
      } catch (error) {
        console.warn(`Expression error "${trimmed}":`, error);
        return '';
      }
    });

    // ──────────────────────────────────────────────────────────────
    // Final output
    // ──────────────────────────────────────────────────────────────
    setGeneratedBBCode(bbcode);
    setShowBBCode(true);
  }, [selectedForm, formValues, agencyDataStore]);

  return { generatedBBCode, generatedTitle, showBBCode, setShowBBCode, generateBBCode };
};

export default useBbcodeGenerator;