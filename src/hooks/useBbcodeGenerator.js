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
      const code = selectedForm.titleGeneratorCode.trim();
      
      // Check if it's an advanced function or a simple template
      if (code.startsWith('(') || code.startsWith('function')) {
        // Advanced function mode
        try {
          const fn = new Function('formName', 'formData', 'ctx', `return (${code})(formName, formData, ctx)`);
          title = fn(selectedForm.name, formValues, evaluationContext);
          setGeneratedTitle(title);
        } catch (e) {
          title = `${selectedForm.name} (Title Error)`;
          console.error("Title generation error (Advanced):", e);
          setGeneratedTitle(title);
        }
      } else {
        // Simple template mode
        title = code.replace(/{{([^}]+)}}/g, (match, fieldName) => {
          return formValues[fieldName.trim()] || '';
        });
        // Also replace [FORM_NAME]
        title = title.replace(/\[FORM_NAME\]/g, selectedForm.name);
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
    // Conditional BBCode Parsing: [conditional field="X" value="Y"]TEXT[/conditional]
    // This initial implementation supports only single field-value conditions.
    // More complex AND/OR logic would require a more sophisticated parser.
    // ──────────────────────────────────────────────────────────────
    bbcode = bbcode.replace(/\[conditional\s+field="([^"]+)"\s+value="([^"]+)"\](.*?)\[\/conditional\]/gs, (match, fieldName, targetValue, innerText) => {
        const actualValue = formValues[fieldName];

        let conditionMet = false;
        if (targetValue === "true") {
            conditionMet = !!actualValue;
        } else if (targetValue === "false") {
            conditionMet = !actualValue;
        } else {
            conditionMet = String(actualValue) === targetValue;
        }

        return conditionMet ? innerText : '';
    });

    // ──────────────────────────────────────────────────────────────
    // Field and Expression Replacement
    // ──────────────────────────────────────────────────────────────
    bbcode = bbcode.replace(/{{([^}]+)}}/g, (match, placeholder) => {
        const fieldName = placeholder.trim();

        // 1. First, check if the key exists directly in the form values.
        if (Object.prototype.hasOwnProperty.call(formValues, fieldName)) {
            let replacementValue = formValues[fieldName] || '';
            
            const field = selectedForm.fields?.find(f => f.name === fieldName);
            
            if (field?.type === "checkbox" && typeof replacementValue === "boolean") {
                return replacementValue ? "Yes" : "No";
            }
            if (field?.type === "multi_select" && Array.isArray(replacementValue)) {
                return replacementValue.join(", ");
            }
            
            return replacementValue;
        }

        // 2. If it's not a direct key, THEN try to evaluate it as a JS expression.
        try {
            const evalFn = new Function('context', 'getDepartmentFullName', 'agencyDataStore', 'generateDecedentBBCode',
              `with (context) { return ${fieldName}; }`
            );
            const result = evalFn(evaluationContext, getDepartmentFullName, agencyDataStore, generateDecedentBBCode);
            return Array.isArray(result) ? result.join(', ') : String(result || '');
        } catch (error) {
            console.warn(`Placeholder error for "{{${fieldName}}}": Not a valid field or expression.`, error);
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